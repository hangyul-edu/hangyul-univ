import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import iso, parse_uuid, real_partner, ser_program
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_university
from app.models import (
    AdmissionRequirement,
    Application,
    ApplicationStatusHistory,
    ArrivalPlan,
    ExportJob,
    Organization,
    OrganizationMember,
    PartnerContract,
    Program,
    ProgramIntake,
    RequirementChange,
    ScholarshipAward,
    ScholarshipPool,
    StudentEnrollment,
    StudentProfile,
    StudentTerm,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import AwardStatus, Role, canonical_role
from app.services import analytics, document_requests, metrics
from app.services.access import get_application_for, scope_applications, university_visible
from app.services.notify import notify

router = APIRouter(prefix="/university", tags=["university"])


def _uni_id(p: Principal, university_id: str | None) -> "object":
    if p.is_university:
        return p.university_id
    if university_id:  # Hangyul staff may view any university
        return parse_uuid(university_id)
    raise HTTPException(400, "university_id is required")


@router.get("/overview")
def overview(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    u = db.get(University, uid)
    return {"university": {"id": str(u.id), "name_en": u.name_en, "name_ko": u.name_ko, "slug": u.slug, "certification_status": u.certification_status,
                           "is_partner": real_partner(db, u), "brand_color": u.brand_color}}


@router.get("/analytics")
def uni_analytics(university_id: str | None = None, nationality: str | None = None, program_id: str | None = None, degree: str | None = None,
                  intake: str | None = None, agency_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    return analytics.university_dashboard(db, uid, {"nationality": nationality, "program_id": program_id, "degree": degree, "intake": intake, "agency_id": agency_id})


def _filters(nationality, program_id, degree, intake, agency_id) -> dict:
    return {"nationality": nationality, "program_id": program_id, "degree": degree, "intake": intake, "agency_id": agency_id}


@router.get("/admissions-funnel")
def admissions_funnel(university_id: str | None = None, nationality: str | None = None, program_id: str | None = None, degree: str | None = None,
                      intake: str | None = None, agency_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Submitted → reviewed → offered → accepted → tuition paid → visa issued → arrived → enrolled (unified metrics service)."""
    uid = _uni_id(p, university_id)
    m = metrics.pipeline(db, uid, _filters(nationality, program_id, degree, intake, agency_id))
    return {"steps": m["steps"], "rejected": m["closed"]["rejected"], "withdrawn": m["closed"]["withdrawn"], "total": m["counts"]["SUBMITTED"],
            "population": m["population"], "metrics": m["metrics"], "min_denominator": m["min_denominator"]}


@router.get("/metrics")
def university_metrics(university_id: str | None = None, nationality: str | None = None, program_id: str | None = None, degree: str | None = None,
                       intake: str | None = None, agency_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """One source of truth for every rate shown in the console and the native app.

    ``pipeline`` = submitted applications (optionally one intake); ``cohorts`` = enrolled students by entry cohort.
    The two populations are never mixed.
    """
    uid = _uni_id(p, university_id)
    f = _filters(nationality, program_id, degree, intake, agency_id)
    return {"pipeline": metrics.pipeline(db, uid, f), "cohorts": metrics.cohorts(db, uid, f), "intakes": metrics.intakes(db, uid)}


@router.get("/programs")
def programs(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    rows = db.scalars(select(Program).where(Program.university_id == uid).options(selectinload(Program.intakes), selectinload(Program.requirements)).order_by(Program.degree_level, Program.name_en)).all()
    counts = dict(db.execute(scope_applications(select(Application.program_id, func.count()), p).where(Application.university_id == uid).group_by(Application.program_id)).all())
    return [{**ser_program(pr, with_intakes=True), "applications": counts.get(pr.id, 0), "is_active": pr.is_active} for pr in rows]


class RequirementPatch(BaseModel):
    min_gpa_percent: float | None = Field(default=None, ge=0, le=100)
    min_topik_level: int | None = Field(default=None, ge=0, le=6)
    min_ielts: float | None = Field(default=None, ge=0, le=9)
    min_toefl_ibt: int | None = Field(default=None, ge=0, le=120)
    language_alternative: bool | None = None
    requires_interview: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)
    source_url: str | None = Field(default=None, max_length=1000)
    # V9 additive: prior education is a published minimum too (impact preview covers it).
    min_prior_education: str | None = Field(default=None, pattern="^(HIGH_SCHOOL|ASSOCIATE|BACHELOR|MASTER)$")


@router.get("/programs/{program_id}/student-preview")
def program_student_preview(program_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Exactly what a student sees for this program: requirements, first-year cost (the shared budget model), next deadline and
    required documents. Same serializers as the public program page, without recording a student "program viewed" event."""
    from app.models import Dormitory
    from app.services.budget import first_year_range
    from app.services.readiness import requirements_for

    prog = _own_program(db, p, program_id)
    u = db.get(University, prog.university_id)
    d = ser_program(prog, u, with_intakes=True)
    d["first_year_range_krw"] = first_year_range(prog, u, list(db.scalars(select(Dormitory).where(Dormitory.university_id == u.id))))
    d["required_documents"] = [{"category": r.category.value, "label": r.label, "required": r.is_required,
                                "legalization_required": r.legalization_required, "translation_required": r.translation_required, "notes": r.notes}
                               for r in requirements_for(db, prog, None)]
    return d


@router.patch("/programs/{program_id}/requirements")
def update_requirements(program_id: str, body: RequirementPatch, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """University-maintained admission rules. Stamped CURRENT with the editor and time — this is first-party data."""
    if not p.has(*PUBLISH_ROLES):
        raise HTTPException(403, "Only an admin can publish admission rules directly. Propose a change for review instead.")
    prog = _own_program(db, p, program_id)
    data = body.model_dump(exclude_unset=True)
    _apply_requirements(db, prog, data)
    audit(db, action="requirements.update", entity_type="admission_requirement", entity_id=prog.id, actor=p, detail=data)
    db.commit()
    return ser_program(prog)


PUBLISH_ROLES = (Role.UNIVERSITY_ADMIN, Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN)  # V22: one university permission
PROPOSE_ROLES = PUBLISH_ROLES
REQ_FIELDS = ("min_gpa_percent", "min_topik_level", "min_ielts", "min_toefl_ibt", "language_alternative", "requires_interview", "notes", "source_url",
              "min_prior_education")


def _own_program(db: Session, p: Principal, program_id: str) -> Program:
    prog = db.get(Program, parse_uuid(program_id))
    if not prog or (p.is_university and prog.university_id != p.university_id):
        raise HTTPException(404, "Not found")
    return prog


def _current_requirements(prog: Program) -> dict:
    req = prog.requirements[0] if prog.requirements else None
    return {k: getattr(req, k) for k in REQ_FIELDS} if req else {}


def _apply_requirements(db: Session, prog: Program, data: dict) -> None:
    req = prog.requirements[0] if prog.requirements else AdmissionRequirement(program_id=prog.id)
    if req.id is None:
        db.add(req)
    for k, v in data.items():
        setattr(req, k, v)
    req.verified_at = utcnow()
    req.verification_status = "CURRENT"


class ProposalIn(RequirementPatch):
    note: str | None = Field(default=None, max_length=1000)  # type: ignore[assignment]
    requirement_notes: str | None = Field(default=None, max_length=2000)


def ser_change(c: RequirementChange, db: Session) -> dict:
    prog = db.get(Program, c.program_id)
    by = db.get(User, c.proposed_by_user_id) if c.proposed_by_user_id else None
    rev = db.get(User, c.reviewed_by_user_id) if c.reviewed_by_user_id else None
    return {"id": str(c.id), "program": {"id": str(prog.id), "name_en": prog.name_en, "degree_level": prog.degree_level.value},
            "changes": c.changes, "previous": c.previous, "note": c.note, "status": c.status, "proposed_by": by.full_name if by else None,
            "proposed_at": iso(c.created_at), "reviewed_by": rev.full_name if rev else None, "reviewed_at": iso(c.reviewed_at)}


@router.post("/programs/{program_id}/requirement-proposals", status_code=201)
def propose_requirements(program_id: str, body: ProposalIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Admissions staff propose a rule change; it goes live only after an admin publishes it."""
    if not p.has(*PROPOSE_ROLES):
        raise HTTPException(403, "Only admissions staff can propose rule changes.")
    prog = _own_program(db, p, program_id)
    data = body.model_dump(exclude_unset=True)
    note = data.pop("note", None)
    if "requirement_notes" in data:
        data["notes"] = data.pop("requirement_notes")
    if not data:
        raise HTTPException(422, "Nothing to change.")
    prev = _current_requirements(prog)
    c = RequirementChange(program_id=prog.id, changes=data, previous={k: prev.get(k) for k in data}, note=note, status="PENDING", proposed_by_user_id=p.id)
    db.add(c)
    audit(db, action="requirements.propose", entity_type="admission_requirement", entity_id=prog.id, actor=p, detail=data)
    db.commit()
    return ser_change(c, db)


@router.get("/requirement-proposals")
def list_proposals(status: str = "PENDING", university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    rows = db.scalars(select(RequirementChange).join(Program, Program.id == RequirementChange.program_id)
                      .where(Program.university_id == uid, RequirementChange.status == status).order_by(RequirementChange.created_at.desc())).all()
    out = []
    for c in rows:
        d = ser_change(c, db)
        if c.status == "PENDING":
            # V9 U6: what publishing this proposal would do to currently matching prospective students.
            from app.services.university_value import requirement_impact

            prog = db.get(Program, c.program_id)
            d["impact"] = requirement_impact(db, prog, _current_requirements(prog), c.changes or {})
        out.append(d)
    return out


@router.post("/programs/{program_id}/impact-preview")
def impact_preview(program_id: str, body: RequirementPatch, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """V9 U6: before proposing or publishing — how many prospective students who match this program today would stop meeting
    the changed minimum. Shown only when every counted profile has the data the rule needs; otherwise "not enough data"."""
    from app.services.university_value import requirement_impact

    prog = _own_program(db, p, program_id)
    return requirement_impact(db, prog, _current_requirements(prog), body.model_dump(exclude_unset=True))


@router.post("/requirement-proposals/{change_id}/{decision}")
def decide_proposal(change_id: str, decision: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    if decision not in ("publish", "discard"):
        raise HTTPException(404, "Not found")
    if not p.has(*PUBLISH_ROLES):
        raise HTTPException(403, "Only an admin can publish or discard rule changes.")
    c = db.get(RequirementChange, parse_uuid(change_id))
    if not c:
        raise HTTPException(404, "Not found")
    prog = _own_program(db, p, str(c.program_id))
    if c.status != "PENDING":
        raise HTTPException(409, "This proposal was already decided.")
    if decision == "publish":
        _apply_requirements(db, prog, c.changes)
    c.status = "PUBLISHED" if decision == "publish" else "DISCARDED"
    c.reviewed_by_user_id, c.reviewed_at = p.id, utcnow()
    audit(db, action=f"requirements.{decision}", entity_type="admission_requirement", entity_id=prog.id, actor=p, detail=c.changes)
    db.commit()
    return ser_change(c, db)


@router.get("/attention")
def attention(university_id: str | None = None, nationality: str | None = None, program_id: str | None = None, agency_id: str | None = None,
              p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Counts behind "Needs your decision" — the same numbers the applicant quick views show."""
    uid = _uni_id(p, university_id)
    f = {"nationality": nationality, "program_id": program_id, "agency_id": agency_id}
    base = analytics._app_filter(scope_applications(select(Application.status, func.count()), p), university_id=uid, filters=f).group_by(Application.status)
    by = {st.value: n for st, n in db.execute(base).all()}
    flagged = db.scalar(analytics._app_filter(scope_applications(select(func.count()).select_from(Application), p), university_id=uid, filters=f)
                        .where(Application.flagged.is_(True))) or 0
    rq = document_requests.returned_counts(db, uid)
    return {
        "awaiting_review": by.get("SUBMITTED", 0) + by.get("UNIVERSITY_REVIEW", 0),
        "documents_returned": rq["returned"],
        "waiting_for_documents": max(by.get("ADDITIONAL_DOCUMENTS", 0) - rq["returned"], 0),
        "interviews": by.get("INTERVIEW", 0),
        "waitlisted": by.get("WAITLISTED", 0),
        "offers_awaiting_response": by.get("OFFERED", 0),
        "tuition_pending": by.get("OFFER_ACCEPTED", 0) + by.get("TUITION_PENDING", 0),
        "enrollment_pending": sum(by.get(k, 0) for k in ("TUITION_PAID", "ADMISSION_CERTIFICATE_PENDING", "ADMISSION_CERTIFICATE_ISSUED", "VISA_PREPARATION", "VISA_SUBMITTED", "VISA_ISSUED")),
        "flagged": flagged,
        "returned_application_ids": rq["returned_ids"],
        # V4: split by who acts next, so the Overview can list only what waits on the university.
        "awaiting_tuition_invoice": by.get("OFFER_ACCEPTED", 0),
        "awaiting_tuition_payment": by.get("TUITION_PENDING", 0),
        "awaiting_admission_letter": by.get("TUITION_PAID", 0) + by.get("ADMISSION_CERTIFICATE_PENDING", 0),
    }


OUTCOME_STEPS = ["ADMITTED", "VISA_ISSUED", "ARRIVED", "ENROLLED", "RETAINED", "GRADUATED"]


@router.get("/outcomes")
def outcomes(by: str = "cohort", university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Longitudinal outcomes for the same people over time, grouped by entry cohort, country, program or agency.

    Admitted → visa → arrived come from Hangyul applications; enrolled → retained → graduated from enrolment records.
    Students enrolled before Hangyul tracked applications have no admission record — those cells are ``null`` (not 0).
    """
    if by not in ("cohort", "nationality", "program", "agency"):
        raise HTTPException(422, "by must be cohort, nationality, program or agency")
    uid = _uni_id(p, university_id)
    apps = db.execute(select(Application.id, Application.status, Application.student_user_id, Application.program_id, Application.agency_org_id,
                             Application.intake_id).where(Application.university_id == uid, university_visible())).all()
    # V23 §273 U2: only applications this university can see (no pre-submission drafts), and the arrival/organisation
    # lookups restricted to the people and agencies in that set rather than every row in the database.
    reached_offer = {a.id for a in apps if metrics._RANK.get(a.status.value, -1) >= 2}
    hist = db.execute(select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status)
                      .where(ApplicationStatusHistory.application_id.in_([a.id for a in apps] or [None]))).all()
    reached = {}
    for app_id, st in hist:
        reached.setdefault(app_id, set()).add(st.value)
    intake_key = {i.id: f"{i.year}-{i.term.value}" for i in db.scalars(select(ProgramIntake).where(ProgramIntake.id.in_([a.intake_id for a in apps] or [None])))}
    nat = dict(db.execute(select(StudentProfile.user_id, StudentProfile.nationality).where(StudentProfile.user_id.in_([a.student_user_id for a in apps] or [None]))).all())
    arrived_students = set(db.scalars(select(ArrivalPlan.student_user_id).where(
        ArrivalPlan.arrived_at.is_not(None), ArrivalPlan.student_user_id.in_([a.student_user_id for a in apps] or [None]))).all())
    enrollments = db.scalars(select(StudentEnrollment).where(StudentEnrollment.university_id == uid)).all()
    terms: dict = {}
    for eid, in db.execute(select(StudentTerm.enrollment_id).where(StudentTerm.enrollment_id.in_([e.id for e in enrollments] or [None]))).all():
        terms[eid] = terms.get(eid, 0) + 1
    names = {"program": dict(db.execute(select(Program.id, Program.name_en).where(Program.university_id == uid)).all()),
             "agency": dict(db.execute(select(Organization.id, Organization.name).where(
                 Organization.id.in_({a.agency_org_id for a in apps if a.agency_org_id} | {e.agency_org_id for e in enrollments if e.agency_org_id} or {None}))).all())}

    def key_app(a):
        return {"cohort": intake_key.get(a.intake_id), "nationality": nat.get(a.student_user_id), "program": a.program_id, "agency": a.agency_org_id}[by]

    def key_enr(e):
        return {"cohort": e.cohort_label, "nationality": e.nationality, "program": e.program_id, "agency": e.agency_org_id}[by]

    groups: dict = {}

    def g(k):
        return groups.setdefault(k, {"ADMITTED": 0, "VISA_ISSUED": 0, "ARRIVED": 0, "ENROLLED": 0, "RETAINED": 0, "GRADUATED": 0,
                                     "reached_second_term": 0, "graduation_due": 0, "tracked_admissions": False})

    for a in apps:
        if a.id not in reached_offer and "OFFERED" not in reached.get(a.id, set()):
            continue
        row = g(key_app(a))
        row["tracked_admissions"] = True
        row["ADMITTED"] += 1
        top = metrics._RANK.get(a.status.value, 0)
        if top >= 5 or "VISA_ISSUED" in reached.get(a.id, set()):
            row["VISA_ISSUED"] += 1
            if a.student_user_id in arrived_students or top >= 7:
                row["ARRIVED"] += 1
    today = utcnow().date()
    for e in enrollments:
        row = g(key_enr(e))
        row["ENROLLED"] += 1
        if terms.get(e.id, 0) >= 2 or e.status.value == "GRADUATED":
            row["reached_second_term"] += 1
            row["RETAINED"] += e.status.value in ("ENROLLED", "GRADUATED", "ON_LEAVE")
        if e.expected_graduation and e.expected_graduation < today:
            row["graduation_due"] += 1
            row["GRADUATED"] += e.status.value == "GRADUATED"

    def label(k):
        if k is None:
            return "Unknown"
        if by == "cohort":
            return metrics.intake_label(k)
        if by in ("program", "agency"):
            return names[by].get(k, "Hangyul direct" if by == "agency" else "—")
        return k

    out = []
    for k, r in groups.items():
        out.append({
            "key": str(k) if k is not None else None, "label": label(k),
            "counts": {s: (r[s] if (r["tracked_admissions"] or s in ("ENROLLED", "RETAINED", "GRADUATED")) else None) for s in OUTCOME_STEPS},
            "visa_rate": metrics.rate(r["VISA_ISSUED"], r["ADMITTED"]) if r["tracked_admissions"] else None,
            "retention": metrics.rate(r["RETAINED"], r["reached_second_term"]),
            "graduation": metrics.rate(r["GRADUATED"], r["graduation_due"]),
            "tracked_admissions": r["tracked_admissions"],
        })
    out.sort(key=lambda x: (x["key"] or ""), reverse=by == "cohort")
    return {"by": by, "steps": OUTCOME_STEPS, "rows": out, "min_denominator": metrics.MIN_DENOMINATOR,
            "definitions": {"retention": metrics.COHORT_DEFINITIONS["retention"], "graduation": metrics.COHORT_DEFINITIONS["graduation"],
                            "visa_rate": "Visas issued ÷ students admitted in the same group."}}


@router.get("/partnership")
def partnership(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    contracts = db.scalars(select(PartnerContract).where(PartnerContract.university_id == uid).options(
        selectinload(PartnerContract.pools).selectinload(ScholarshipPool.awards), selectinload(PartnerContract.quotas))).all()
    out = []
    for c in contracts:
        pools = []
        for pool in c.pools:
            committed = sum(a.amount_krw for a in pool.awards if a.status == AwardStatus.COMMITTED)
            paid = sum(a.amount_krw for a in pool.awards if a.status == AwardStatus.PAID)
            pools.append({"id": str(pool.id), "name": pool.name, "intake": pool.intake_label, "total_krw": pool.total_krw, "committed_krw": committed, "paid_krw": paid,
                          "remaining_krw": pool.total_krw - committed - paid, "rules_summary": pool.rules_summary,
                          "awards": [{"id": str(a.id), "student": db.get(User, a.student_user_id).full_name, "amount_krw": a.amount_krw, "status": a.status.value,
                                      "note": a.note, "updated_at": iso(a.updated_at)} for a in pool.awards]})
        fin = can_see_financials(p)
        tiers = c.incentive_tiers or []
        out.append({"id": str(c.id), "title": c.title, "status": c.status.value, "start_date": iso(c.start_date), "end_date": iso(c.end_date),
                    "financials_visible": fin,
                    "recruitment_fee_krw": c.recruitment_fee_krw if fin else None, "commission_percent": c.commission_percent if fin else None,
                    "guaranteed_minimum_krw": c.guaranteed_minimum_krw if fin else None,
                    "target_countries": c.target_countries or [], "target_programs": [str(x) for x in (getattr(c, "target_program_ids", None) or [])],
                    "intake_label": c.intake_label,
                    "incentive_tiers": tiers if fin else [{k: v for k, v in t.items() if "krw" not in k and "amount" not in k} for t in tiers],
                    "performance": _contract_performance(db, uid, c.intake_label),
                    "guarantee_enabled": c.guarantee_enabled, "guarantee_terms": c.guarantee_terms, "guarantee_criteria": c.guarantee_criteria,
                    "is_demo": c.is_demo, "pools": pools,
                    "quotas": [{"id": str(q.id), "intake": q.intake_label, "program_id": str(q.program_id) if q.program_id else None, "seats": q.seats, "used": q.used} for q in c.quotas]})
    return out


FINANCE_ROLES = (Role.UNIVERSITY_ADMIN, Role.HANGYUL_FINANCE, Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS)  # V22: unchanged — admin is the only university role


def can_see_financials(p: Principal) -> bool:
    """Recruitment fees, commission, guaranteed minimums and incentive amounts: university admins and Hangyul finance only."""
    return p.has(*FINANCE_ROLES)


def _contract_performance(db: Session, uid, intake: str | None) -> dict:
    m = metrics.pipeline(db, uid, {"intake": intake} if intake else {})
    c = m["counts"]
    return {"population": m["population"]["label"], "submitted": c["SUBMITTED"], "offered": c["OFFERED"], "enrolled": c["ENROLLED"],
            "yield": m["metrics"]["yield"]}


class AwardIn(BaseModel):
    pool_id: str
    student_id: str
    amount_krw: int = Field(gt=0)
    application_id: str | None = None
    note: str | None = Field(default=None, max_length=300)


@router.post("/scholarship-awards", status_code=201)
def create_award(body: AwardIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    if not p.has(Role.UNIVERSITY_ADMIN, Role.HANGYUL_FINANCE, Role.HANGYUL_SUPER_ADMIN):
        raise HTTPException(403, "Only university admins or Hangyul finance can allocate scholarships.")
    pool = db.get(ScholarshipPool, parse_uuid(body.pool_id))
    if not pool:
        raise HTTPException(404, "Pool not found")
    contract = db.get(PartnerContract, pool.contract_id)
    if p.is_university and contract.university_id != p.university_id:
        raise HTTPException(404, "Pool not found")
    if contract.status.value != "ACTIVE":
        raise HTTPException(409, "Benefits can only be allocated from an active partnership.")
    sid = parse_uuid(body.student_id)
    if not db.scalar(scope_applications(select(Application.id), p).where(Application.student_user_id == sid, Application.university_id == contract.university_id)):
        raise HTTPException(404, "Student has no application to this university.")
    # V23 §273 U3: a named application must be this student's, at this pool's university, and visible to the caller.
    if body.application_id and not db.scalar(scope_applications(select(Application.id), p).where(
            Application.id == parse_uuid(body.application_id), Application.student_user_id == sid,
            Application.university_id == contract.university_id)):
        raise HTTPException(404, "Application not found")
    used = sum(a.amount_krw for a in pool.awards if a.status in (AwardStatus.COMMITTED, AwardStatus.PAID, AwardStatus.PROPOSED))
    if used + body.amount_krw > pool.total_krw:
        raise HTTPException(409, "This award exceeds the pool's remaining budget.")
    a = ScholarshipAward(pool_id=pool.id, student_user_id=sid, amount_krw=body.amount_krw, application_id=parse_uuid(body.application_id) if body.application_id else None,
                         status=AwardStatus.PROPOSED, decided_by_id=p.id, note=body.note)
    db.add(a)
    audit(db, action="scholarship.award.create", entity_type="scholarship_award", entity_id=pool.id, actor=p, subject_user_id=sid, detail={"amount": body.amount_krw})
    db.commit()
    return {"id": str(a.id)}


class AwardStatusIn(BaseModel):
    status: AwardStatus


@router.post("/scholarship-awards/{award_id}/status")
def award_status(award_id: str, body: AwardStatusIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    a = db.get(ScholarshipAward, parse_uuid(award_id))
    if not a:
        raise HTTPException(404, "Not found")
    contract = db.get(PartnerContract, db.get(ScholarshipPool, a.pool_id).contract_id)
    if p.is_university and contract.university_id != p.university_id:
        raise HTTPException(404, "Not found")
    allowed = {AwardStatus.PROPOSED: {AwardStatus.COMMITTED, AwardStatus.CANCELLED}, AwardStatus.COMMITTED: {AwardStatus.PAID, AwardStatus.CANCELLED}}
    if body.status not in allowed.get(a.status, set()):
        raise HTTPException(409, f"Cannot move award from {a.status.value} to {body.status.value}.")
    if body.status == AwardStatus.PAID and not p.has(Role.HANGYUL_FINANCE, Role.HANGYUL_SUPER_ADMIN, Role.UNIVERSITY_ADMIN):
        raise HTTPException(403, "Only finance can mark an award as paid.")
    prev = a.status
    a.status = body.status
    audit(db, action="scholarship.award.status", entity_type="scholarship_award", entity_id=a.id, actor=p, subject_user_id=a.student_user_id, detail={"from": prev.value, "to": body.status.value})
    if body.status == AwardStatus.COMMITTED:
        notify(db, a.student_user_id, "SCHOLARSHIP", "notify.scholarshipCommitted", f"You've been awarded a Hangyul Partner Scholarship of ₩{a.amount_krw:,}.",
               params={"amount": a.amount_krw}, link="/scholarships")
    db.commit()
    return {"ok": True, "status": a.status.value}


@router.get("/cohorts")
def cohorts(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    uid = _uni_id(p, university_id)
    rows = db.scalars(select(StudentEnrollment).where(StudentEnrollment.university_id == uid).order_by(StudentEnrollment.cohort_label)).all()
    out = []
    for e in rows:
        terms = db.scalars(select(StudentTerm).where(StudentTerm.enrollment_id == e.id).order_by(StudentTerm.term_label)).all()
        u = db.get(User, e.student_user_id)
        prog = db.get(Program, e.program_id) if e.program_id else None
        agency = db.get(Organization, e.agency_org_id) if e.agency_org_id else None
        out.append({"id": str(e.id), "student": u.full_name, "nationality": e.nationality, "cohort": e.cohort_label, "program": prog.name_en if prog else None,
                    "agency": agency.name if agency else None, "status": e.status.value, "enrolled_on": iso(e.enrolled_on), "expected_graduation": iso(e.expected_graduation),
                    "visa_expires_on": iso(e.visa_expires_on),
                    "terms": [{"term": t.term_label, "registered": t.registered, "gpa_percent": t.gpa_percent, "attendance_percent": t.attendance_percent,
                               "academic_standing": t.academic_standing, "data_source": t.data_source} for t in terms],
                    "risk": _risk(e, terms), "is_demo": e.is_demo})
    return out


def _risk(e: StudentEnrollment, terms: list[StudentTerm]) -> dict | None:
    """Transparent early-warning flags (only from integrated data); not a predictive score."""
    flags = []
    last = terms[-1] if terms else None
    if last and last.attendance_percent is not None and last.attendance_percent < 70:
        flags.append("LOW_ATTENDANCE")
    if last and last.academic_standing in ("WARNING", "PROBATION"):
        flags.append("ACADEMIC_STANDING")
    if e.visa_expires_on and (e.visa_expires_on - utcnow().date()).days < 60 and e.status.value == "ENROLLED":
        flags.append("VISA_EXPIRING")
    if last and not last.registered:
        flags.append("NOT_REGISTERED")
    return {"flags": flags} if flags else None


@router.get("/agencies")
def uni_agencies(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Agencies that have submitted applications to this university."""
    uid = _uni_id(p, university_id)
    rows = db.execute(scope_applications(select(Application.agency_org_id, func.count()), p).where(Application.university_id == uid, Application.agency_org_id.is_not(None))
                      .group_by(Application.agency_org_id)).all()
    out = []
    for org_id, n in rows:
        o = db.get(Organization, org_id)
        out.append({"id": str(o.id), "name": o.name, "country_code": o.country_code, "applications": n, "is_demo": o.is_demo})
    return sorted(out, key=lambda r: -r["applications"])


@router.get("/team")
def uni_team(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    org_id = p.org_id if p.is_university else None
    if not p.is_university and university_id:
        org_id = db.scalar(select(Organization.id).where(Organization.university_id == parse_uuid(university_id)))
    if not org_id:
        return []
    members = db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org_id)).all()
    uni = db.scalar(select(Organization.university_id).where(Organization.id == org_id))
    load = dict(db.execute(select(Application.university_reviewer_id, func.count()).where(
        Application.university_id == uni, Application.status.not_in(CLOSED_FOR_REVIEW), Application.university_reviewer_id.is_not(None))
        .group_by(Application.university_reviewer_id)).all()) if uni else {}
    # V9 additive: is_active and open assignments, so leaving members are never left holding applicants.
    return [{"user_id": str(u.id), "full_name": u.full_name, "role": canonical_role(m.role).value, "title": m.title, "is_active": bool(m.is_active),
             "open_assignments": load.get(u.id, 0)} for m, u in members]


@router.get("/export/applications.csv")
def export_applications(university_id: str | None = None, ids: list[str] | None = Query(None, max_length=500), status: list[str] | None = Query(None),
                        intake: str | None = None, program_id: str | None = None, nationality: str | None = None, degree: str | None = None,
                        agency_id: str | None = None, q: str | None = Query(None, max_length=120), flagged: bool | None = None,
                        reviewer: str | None = Query(None, max_length=64), reached: str | None = Query(None, max_length=24),
                        requests: str | None = Query(None, pattern="^(open|returned)$"), admin_check: str | None = Query(None, pattern="^(done|pending)$"),
                        eligibility: str | None = Query(None, pattern="^(MEETS|BELOW|TO_CHECK|UNKNOWN)$"),
                        p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """CSV export of submitted applications: the selected ``ids`` or **exactly the list's current filters**.

    V23 (REPORT §273 U1): this used to accept six of the list's thirteen filters, so "Export filtered" on a searched or
    stage-filtered table wrote a different, larger set of rows. It now runs the list's own predicate
    (`applications.filter_applications`) inside this university's scope. Personal data limited to what the university
    needs; the export is audited."""
    from app.api.v1.applications import filter_applications

    uid = _uni_id(p, university_id)
    stmt = filter_applications(db, p, status=status, q=q, program_id=program_id, nationality=nationality, agency_id=agency_id,
                               university_id=str(uid), flagged=flagged, requests=requests, intake=intake, degree=degree,
                               reviewer=reviewer, admin_check=admin_check, reached=reached, ids=ids, eligibility=eligibility)
    stmt = stmt.where(Application.university_id == uid, university_visible())
    rows = db.scalars(stmt.order_by(Application.submitted_at)).all()
    content = _applications_csv(db, rows)
    scope = {k: v for k, v in {"selected": len(ids) if ids else None, "status": status, "intake": intake, "program_id": program_id,
                                "nationality": nationality, "degree": degree, "agency_id": agency_id, "q": q, "flagged": flagged,
                                "reviewer": reviewer, "reached": reached, "requests": requests, "admin_check": admin_check,
                                "eligibility": eligibility}.items() if v}
    audit(db, action="export.applications", entity_type="university", entity_id=uid, actor=p, detail={"rows": len(rows), **scope})
    _log_export(db, p, uid, "APPLICATIONS", len(rows), scope)
    db.commit()
    return StreamingResponse(iter([content]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="applications.csv"'})


def _applications_csv(db: Session, rows) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["application_id", "student_name", "nationality", "program", "degree", "status", "readiness_percent", "submitted_at", "decided_at", "agency", "external_reference"])
    for a in rows:
        u = db.get(User, a.student_user_id)
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == a.student_user_id))
        prog = db.get(Program, a.program_id)
        ag = db.get(Organization, a.agency_org_id) if a.agency_org_id else None
        w.writerow([a.id, u.full_name, prof.nationality if prof else "", prog.name_en, prog.degree_level.value, a.status.value, a.readiness_percent,
                    iso(a.submitted_at) or "", iso(a.decided_at) or "", ag.name if ag else "", a.external_reference or ""])
    return buf.getvalue()


def _log_export(db: Session, p: Principal, uid, kind: str, rows: int, params: dict | None = None) -> None:
    db.add(ExportJob(organization_id=p.org_id, university_id=uid, requested_by_user_id=p.id, kind=kind, params=params or {}, schedule="MANUAL",
                     delivery="DOWNLOAD", status="COMPLETED", row_count=rows, completed_at=utcnow()))


@router.get("/exports")
def export_history(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Manual export history. Scheduled reports, e-mail delivery and SFTP/API delivery are not available yet."""
    uid = _uni_id(p, university_id)
    jobs = db.scalars(select(ExportJob).where(ExportJob.university_id == uid).order_by(ExportJob.created_at.desc()).limit(50)).all()
    return {
        "capabilities": {"manual": True, "scheduled": False, "email": False, "sftp": False, "api": False},
        "jobs": [{"id": str(j.id), "kind": j.kind, "rows": j.row_count, "status": j.status, "schedule": j.schedule, "delivery": j.delivery,
                  "by": (u.full_name if (u := db.get(User, j.requested_by_user_id)) else None), "at": iso(j.created_at)} for j in jobs],
    }


@router.get("/export/{kind}.csv")
def export_kind(kind: str, university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Server-generated aggregate exports (no personal data): cohort outcomes or pipeline metrics."""
    if kind not in ("outcomes", "metrics"):
        raise HTTPException(404, "Unknown export")
    uid = _uni_id(p, university_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    if kind == "outcomes":
        data = outcomes("cohort", university_id, p, db)
        w.writerow(["cohort", *data["steps"], "retention", "graduation"])
        for r in data["rows"]:
            w.writerow([r["label"], *[("" if r["counts"][s] is None else r["counts"][s]) for s in data["steps"]],
                        "" if r["retention"]["value"] is None else r["retention"]["value"], "" if r["graduation"]["value"] is None else r["graduation"]["value"]])
        n = len(data["rows"])
    else:
        m = metrics.pipeline(db, uid, {})
        w.writerow(["metric", "value", "numerator", "denominator", "population", "definition"])
        for k, v in m["metrics"].items():
            w.writerow([k, "" if v["value"] is None else v["value"], "" if v.get("numerator") is None else v["numerator"], v["denominator"], v["population"], v["definition"]])
        n = len(m["metrics"])
    audit(db, action=f"export.{kind}", entity_type="university", entity_id=uid, actor=p, detail={"rows": n})
    _log_export(db, p, uid, kind.upper(), n)
    db.commit()
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'})


# ---------------------------------------------------------------- V6: measured value + reader view

@router.get("/preparation")
def preparation(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """How prepared Hangyul applications arrive: verified shared documents and how fast document requests are answered."""
    from app.services import university_value

    return university_value.preparation(db, _uni_id(p, university_id))


@router.get("/applications/{app_id}/statements")
def application_statements(app_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Approved statement text for a submitted application (reader view). Every read is audited."""
    from app.services import university_value
    from app.services.access import get_application_for

    app = get_application_for(db, p, parse_uuid(app_id))
    out = university_value.statements(db, app)
    if out:
        audit(db, action="application.statements_view", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
              detail={"essays": len(out)})
        db.commit()
    return out


# ---------------------------------------------------------------- V8: glossary, safe bulk actions, export presets, rule history

@router.get("/glossary")
def glossary(p: Principal = Depends(require_university)):
    """Every university metric with numerator, denominator, population, intake scope, date range and small-sample rule —
    the single definition screens show on demand (services/metrics.py GLOSSARY)."""
    return {"min_denominator": metrics.MIN_DENOMINATOR, "metrics": metrics.GLOSSARY}


BULK_WRITE_ROLES = (Role.UNIVERSITY_ADMIN,)  # V22
REQUESTABLE = {"SUBMITTED", "UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "WAITLISTED"}
STANDARD_REQUEST_CATEGORIES = ("BANK_STATEMENT", "TRANSCRIPT", "GRADUATION_CERTIFICATE", "TOPIK", "IELTS", "PASSPORT", "RECOMMENDATION", "SPONSOR_DOCUMENT")


class BulkIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    reviewer_id: str | None = None  # assign-reviewer; null clears the assignment
    category: str | None = None  # document-request: one of the standard categories
    label: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=2000)
    due_date: str | None = None


def _reviewer_ok(db: Session, p: Principal, reviewer_id) -> bool:
    m = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == reviewer_id,
                                                  OrganizationMember.is_active.is_(True)))
    return bool(m)


def _bulk_params(db: Session, p: Principal, action: str, body) -> dict:
    """Validate a safe bulk action once (V8 rules, shared by the id-based and the V9 filter-based endpoints)."""
    from datetime import date as _date

    if action not in ("assign-reviewer", "document-request", "admin-check"):
        raise HTTPException(404, "Unknown bulk action")
    if not (p.is_university and p.has(*BULK_WRITE_ROLES)):
        raise HTTPException(403, "Only the university's admissions team can run bulk actions.")
    reviewer = None
    if action == "assign-reviewer" and body.reviewer_id:
        reviewer = parse_uuid(body.reviewer_id)
        if not _reviewer_ok(db, p, reviewer):
            raise HTTPException(422, "The reviewer must be an active member of your admissions team.")
    due = None
    if action == "document-request":
        if body.category not in STANDARD_REQUEST_CATEGORIES:
            raise HTTPException(422, "Choose one of the standard document types.")
        if not body.note or len(body.note.strip()) < 3:
            raise HTTPException(422, "Write the note the applicants will see.")
        if body.due_date:
            try:
                due = _date.fromisoformat(body.due_date)
            except ValueError:
                raise HTTPException(422, "due_date must be YYYY-MM-DD") from None
    return {"reviewer": reviewer, "due": due}


def _bulk_one(db: Session, p: Principal, action: str, app: Application, body, prm: dict, raw: str, many: bool, touched: set) -> dict:
    """One application of a safe bulk action: never a decision; audited per application."""
    from app.models import ApplicationAdminCheck

    if action == "assign-reviewer":
        reviewer = prm["reviewer"]
        if app.university_reviewer_id == reviewer:
            return {"id": raw, "ok": True, "result": "unchanged"}
        app.university_reviewer_id = reviewer
        audit(db, action="application.update", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
              detail={"fields": ["university_reviewer_id"], "bulk": True})
        return {"id": raw, "ok": True, "result": "assigned" if reviewer else "cleared"}
    if action == "document-request":
        if app.status.value not in REQUESTABLE:
            return {"id": raw, "ok": False, "error": "not_requestable", "status": app.status.value}
        label = (body.label or "").strip() or body.category.replace("_", " ").title()
        r = document_requests.create_request(db, app, actor_id=p.id, actor_org_id=p.org_id, label=label, note=body.note.strip(),
                                             category=body.category, due_date=prm["due"])
        audit(db, action="application.document_request", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
              detail={"request_id": str(r.id), "label": r.label, "bulk": True})
        touched.add(app.student_user_id)
        return {"id": raw, "ok": True, "result": "requested", "request_id": str(r.id)}
    existing = db.scalar(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id == app.id))
    if existing:
        return {"id": raw, "ok": True, "result": "unchanged"}
    db.add(ApplicationAdminCheck(application_id=app.id, checked_by_user_id=p.id, checked_at=utcnow(), note=(body.note or "").strip() or None))
    audit(db, action="application.admin_check", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
          detail={"bulk": many})
    return {"id": raw, "ok": True, "result": "checked"}


def _bulk_finish(db: Session, action: str, results: list, touched: set, extra: dict | None = None) -> dict:
    from app.services.tasks_engine import generate_for_student

    db.flush()
    for sid in touched:
        generate_for_student(db, sid)
    db.commit()
    ok = sum(1 for r in results if r["ok"])
    return {"action": action, "total": len(results), "succeeded": ok, "failed": len(results) - ok, "results": results, **(extra or {})}


@router.post("/bulk/{action}")
def bulk(action: str, body: BulkIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Safe bulk actions only (V8): assign a reviewer, request one standard document (same note to all), mark the
    administrative check complete. Never a decision. Each id is checked against the caller's tenant and reported
    separately ({id, ok, result|error}); one failure never blocks the others. Every change is audited per application."""
    prm = _bulk_params(db, p, action, body)
    results: list = []
    touched: set = set()
    for raw in dict.fromkeys(body.ids):  # de-duplicate, keep order
        try:
            app = get_application_for(db, p, parse_uuid(raw))
        except HTTPException:
            results.append({"id": raw, "ok": False, "error": "not_found"})
            continue
        results.append(_bulk_one(db, p, action, app, body, prm, raw, len(body.ids) > 1, touched))
    return _bulk_finish(db, action, results, touched)


# ---------------------------------------------------------------- V9 U3: "select all N matching" (filter-based safe bulk)

BULK_FILTER_CAP = 1000
FILTER_ACTIONS = ("assign-reviewer", "document-request", "admin-check", "export")


class ListFilter(BaseModel):
    """The applicant list's filters (GET /applications), so "all N matching" is exactly the list the officer sees."""
    status: list[str] | None = Field(default=None, max_length=30)
    q: str | None = Field(default=None, max_length=200)
    program_id: str | None = None
    nationality: str | None = Field(default=None, max_length=2)
    agency_id: str | None = None
    intake: str | None = Field(default=None, max_length=64)
    degree: str | None = Field(default=None, max_length=24)
    reviewer: str | None = Field(default=None, max_length=64)
    admin_check: str | None = Field(default=None, pattern="^(done|pending)$")
    reached: str | None = Field(default=None, max_length=24)
    flagged: bool | None = None
    requests: str | None = Field(default=None, pattern="^(open|returned)$")
    eligibility: str | None = Field(default=None, pattern="^(MEETS|BELOW|TO_CHECK|UNKNOWN)$")
    sort: str = Field(default="submitted", pattern="^(updated|deadline|readiness|submitted)$")


class BulkFilterIn(BaseModel):
    filters: ListFilter
    reviewer_id: str | None = None
    category: str | None = None
    label: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=2000)
    due_date: str | None = None
    expected_total: int | None = Field(default=None, ge=0)  # the count the officer confirmed in the preview


def _list_stmt(db: Session, p: Principal, f: ListFilter):
    """The same clauses as GET /applications (applications.list_applications) for a university principal. Kept in step by
    tests/test_v9_university.py, which compares count and order with the list endpoint for several filter sets."""
    from sqlalchemy import or_

    from app.models import ApplicationAdminCheck, DocumentRequest
    from app.models import University as Uni
    from app.models.enums import ApplicationStatus as S
    from app.models.enums import DegreeLevel
    from app.services.analytics import intake_clause

    stmt = scope_applications(select(Application), p)
    if f.status:
        stmt = stmt.where(Application.status.in_(f.status))
    if f.program_id:
        stmt = stmt.where(Application.program_id == parse_uuid(f.program_id))
    if f.agency_id:
        stmt = stmt.where(Application.agency_org_id == parse_uuid(f.agency_id))
    if f.flagged is not None:
        stmt = stmt.where(Application.flagged.is_(f.flagged))
    if f.nationality:
        stmt = stmt.where(Application.student_user_id.in_(select(StudentProfile.user_id).where(StudentProfile.nationality == f.nationality.upper())))
    if f.intake:
        stmt = stmt.where(intake_clause(f.intake))
    if f.degree:
        if f.degree.upper() not in DegreeLevel.__members__:
            raise HTTPException(422, "Unknown degree level.")
        stmt = stmt.where(Application.program_id.in_(select(Program.id).where(Program.degree_level == DegreeLevel[f.degree.upper()])))
    if f.reviewer:
        if f.reviewer == "none":
            stmt = stmt.where(Application.university_reviewer_id.is_(None))
        else:
            stmt = stmt.where(Application.university_reviewer_id == (p.id if f.reviewer == "me" else parse_uuid(f.reviewer)))
    if f.admin_check:
        checked = select(ApplicationAdminCheck.application_id)
        stmt = stmt.where(Application.id.in_(checked) if f.admin_check == "done" else Application.id.not_in(checked))
    if f.reached:
        if f.reached not in metrics.STEPS:
            raise HTTPException(422, "Unknown funnel step.")
        mf = {"nationality": f.nationality.upper() if f.nationality else None, "program_id": parse_uuid(f.program_id) if f.program_id else None,
              "degree": f.degree.upper() if f.degree else None, "intake": f.intake, "agency_id": parse_uuid(f.agency_id) if f.agency_id else None}
        stmt = stmt.where(Application.id.in_(metrics.reached_ids(db, p.university_id, mf, f.reached) or [None]))
    if f.requests:
        open_ids = select(DocumentRequest.application_id).where(DocumentRequest.status == "OPEN")
        if f.requests == "open":
            stmt = stmt.where(Application.id.in_(open_ids))
        else:
            answered = select(DocumentRequest.application_id).where(DocumentRequest.status == "FULFILLED")
            stmt = stmt.where(Application.status == S.ADDITIONAL_DOCUMENTS, Application.id.in_(answered), Application.id.not_in(open_ids))
    if f.q:
        like = f"%{f.q}%"
        stmt = stmt.where(or_(
            Application.student_user_id.in_(select(User.id).where(or_(User.full_name.ilike(like), User.email.ilike(like)))),
            Application.program_id.in_(select(Program.id).where(Program.name_en.ilike(like))),
            Application.university_id.in_(select(Uni.id).where(Uni.name_en.ilike(like))),
            Application.external_reference.ilike(like),
        ))
    if f.eligibility:
        from app.services import eligibility_summary

        cand = db.scalars(stmt).all()
        summ = eligibility_summary.summarize(db, cand)
        stmt = stmt.where(Application.id.in_([a.id for a in cand if (summ.get(a.id) or {}).get("status") == f.eligibility] or [None]))
    if f.sort == "deadline":
        stmt = stmt.join(ProgramIntake, ProgramIntake.id == Application.intake_id).order_by(ProgramIntake.application_deadline)
    elif f.sort == "readiness":
        stmt = stmt.order_by(Application.readiness_percent.desc())
    elif f.sort == "submitted":
        stmt = stmt.order_by(Application.submitted_at.desc().nulls_last())
    else:
        stmt = stmt.order_by(Application.updated_at.desc())
    return stmt


def _matching(db: Session, p: Principal, f: ListFilter) -> list[Application]:
    total = db.scalar(select(func.count()).select_from(_list_stmt(db, p, f).order_by(None).subquery())) or 0
    if total > BULK_FILTER_CAP:
        raise HTTPException(422, f"More than {BULK_FILTER_CAP} applications match. Narrow the filters first.")
    return list(db.scalars(_list_stmt(db, p, f)).all())


def _filter_preview(db: Session, apps: list[Application], action: str) -> dict:
    skipped = [a for a in apps if action == "document-request" and a.status.value not in REQUESTABLE]
    first = []
    for a in apps[:8]:
        u = db.get(User, a.student_user_id)
        prog = db.get(Program, a.program_id)
        first.append({"id": str(a.id), "student": u.full_name if u else None, "program": prog.name_en if prog else None, "status": a.status.value,
                      "will_skip": a in skipped})
    return {"action": action, "total": len(apps), "eligible": len(apps) - len(skipped), "skipped": {"not_requestable": len(skipped)} if skipped else {},
            "first": first, "cap": BULK_FILTER_CAP}


@router.post("/bulk-filter/{action}/preview")
def bulk_filter_preview(action: str, body: BulkFilterIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Server-side count + first rows of "all N matching" before any change (safe actions and export only)."""
    if action not in FILTER_ACTIONS:
        raise HTTPException(404, "Unknown bulk action")
    if not p.is_university:
        raise HTTPException(403, "Only the university's admissions team can run bulk actions.")
    if action == "export":
        pass  # V22: every university admin may export (audited)
    elif not p.has(*BULK_WRITE_ROLES):
        raise HTTPException(403, "Only the university's admissions team can run bulk actions.")
    return _filter_preview(db, _matching(db, p, body.filters), action)


@router.post("/bulk-filter/{action}")
def bulk_filter(action: str, body: BulkFilterIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Run a safe action on every application matching the list filters (V8 logic per item; per-item results). Refused with
    409 when the matching set changed since the preview (``expected_total``). Never admits or rejects anyone."""
    if action not in FILTER_ACTIONS:
        raise HTTPException(404, "Unknown bulk action")
    if action == "export":
        if not p.is_university:
            raise HTTPException(403, "Only the university's own administrators can export applicant data.")
        apps = _matching(db, p, body.filters)
        if body.expected_total is not None and body.expected_total != len(apps):
            raise HTTPException(409, f"The matching list changed ({len(apps)} now, {body.expected_total} previewed). Preview again.")
        rows = sorted(apps, key=lambda a: (a.submitted_at is None, a.submitted_at))
        buf = _applications_csv(db, rows)
        detail = {"rows": len(rows), "filter_bulk": True, **{k: v for k, v in body.filters.model_dump(exclude_none=True).items() if k != "sort"}}
        audit(db, action="export.applications", entity_type="university", entity_id=p.university_id, actor=p, detail={k: str(v) for k, v in detail.items()})
        _log_export(db, p, p.university_id, "APPLICATIONS", len(rows), {k: str(v) for k, v in detail.items()})
        db.commit()
        return StreamingResponse(iter([buf]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="applications.csv"'})
    prm = _bulk_params(db, p, action, body)
    apps = _matching(db, p, body.filters)
    if body.expected_total is not None and body.expected_total != len(apps):
        raise HTTPException(409, f"The matching list changed ({len(apps)} now, {body.expected_total} previewed). Preview again.")
    results: list = []
    touched: set = set()
    for a in apps:
        results.append(_bulk_one(db, p, action, a, body, prm, str(a.id), True, touched))
    return _bulk_finish(db, action, results, touched, {"mode": "filter"})


@router.delete("/applications/{app_id}/admin-check", status_code=204)
def undo_admin_check(app_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    from app.models import ApplicationAdminCheck

    if not (p.is_university and p.has(*BULK_WRITE_ROLES)):
        raise HTTPException(403, "Your role is read-only.")
    app = get_application_for(db, p, parse_uuid(app_id))
    c = db.scalar(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id == app.id))
    if c:
        db.delete(c)
        audit(db, action="application.admin_check_undone", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id)
        db.commit()


# Export job presets: what each contains is stated in the UI; personal data presets need admissions roles.
ADMITTED = ["OFFERED", "OFFER_ACCEPTED", "TUITION_PENDING", "TUITION_PAID", "ADMISSION_CERTIFICATE_PENDING", "ADMISSION_CERTIFICATE_ISSUED",
            "VISA_PREPARATION", "VISA_SUBMITTED", "VISA_ISSUED", "ENROLLED"]
VISA = ["ADMISSION_CERTIFICATE_ISSUED", "VISA_PREPARATION", "VISA_SUBMITTED", "VISA_ISSUED", "ENROLLED"]
APP_COLUMNS = ["application_id", "student_name", "nationality", "program", "degree", "intake", "status", "documents_verified", "submitted_at",
               "decided_at", "agency", "reviewer", "admin_check", "external_reference", "tuition_krw", "tuition_due", "scholarship_note",
               "visa_status", "semester_start"]
EXPORT_PRESETS = {
    "current_intake": {"personal": True, "statuses": None, "current_intake": True,
                       "columns": ["application_id", "student_name", "nationality", "program", "degree", "intake", "status", "documents_verified",
                                   "submitted_at", "decided_at", "agency", "reviewer", "admin_check", "external_reference"]},
    "admitted": {"personal": True, "statuses": ADMITTED,
                 "columns": ["application_id", "student_name", "nationality", "program", "degree", "intake", "status", "decided_at", "tuition_krw",
                             "tuition_due", "scholarship_note", "agency", "external_reference"]},
    "visa": {"personal": True, "statuses": VISA,
             "columns": ["application_id", "student_name", "nationality", "program", "intake", "status", "visa_status", "semester_start", "agency"]},
    "enrolment": {"personal": True, "enrolment": True,
                  "columns": ["student_name", "nationality", "cohort", "program", "agency", "enrolment_status", "enrolled_on", "expected_graduation",
                              "visa_expires_on"]},
    "outcomes": {"personal": False, "aggregate": True, "columns": ["cohort", "ADMITTED", "VISA_ISSUED", "ARRIVED", "ENROLLED", "RETAINED", "GRADUATED", "retention", "graduation"]},
}


def _preset_key(kind: str) -> str:
    return f"PRESET:{kind}"[:32]


@router.get("/export-presets")
def export_presets(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Built-in export jobs (contents, personal-data flag, last run) and this university's saved configurations."""
    from app.models import ExportPreset

    uid = _uni_id(p, university_id)
    last = {}
    for j in db.scalars(select(ExportJob).where(ExportJob.university_id == uid).order_by(ExportJob.created_at.desc()).limit(200)).all():
        k = j.kind.split(":", 1)[1] if j.kind.startswith("PRESET:") else {"APPLICATIONS": "applications", "OUTCOMES": "outcomes", "METRICS": "metrics"}.get(j.kind, j.kind)
        if k not in last:
            last[k] = {"at": iso(j.created_at), "rows": j.row_count, "by": (u.full_name if (u := db.get(User, j.requested_by_user_id)) else None)}
    saved = db.scalars(select(ExportPreset).where(ExportPreset.university_id == uid).order_by(ExportPreset.created_at.desc())).all()
    current = next((i["key"] for i in metrics.intakes(db, uid) if i["current"]), None)
    return {
        "capabilities": {"manual": True, "scheduled": False, "scheduled_reason": "needs_worker"},
        "current_intake": current,
        "presets": [{"key": k, "personal_data": v["personal"], "columns": v["columns"], "last_run": last.get(k)} for k, v in EXPORT_PRESETS.items()],
        "available_columns": APP_COLUMNS,
        "saved": [{"id": str(x.id), "name": x.name, "base": x.base, "columns": x.columns, "filters": x.filters, "schedule": x.schedule,
                   "created_at": iso(x.created_at), "by": (u.full_name if (u := db.get(User, x.created_by_user_id)) else None) if x.created_by_user_id else None,
                   "last_run": last.get(f"saved:{x.id}"[:24])} for x in saved],
    }


class PresetIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    base: str
    columns: list[str] = Field(default_factory=list, max_length=40)
    filters: dict = Field(default_factory=dict)


EXPORT_FILTER_KEYS = ("intake", "program_id", "nationality", "degree", "agency_id")


def _clean_filters(f: dict) -> dict:
    return {k: str(v)[:64] for k, v in (f or {}).items() if k in EXPORT_FILTER_KEYS and v}


@router.post("/export-presets", status_code=201)
def save_export_preset(body: PresetIn, university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    from app.models import ExportPreset

    if body.base not in EXPORT_PRESETS or EXPORT_PRESETS[body.base].get("aggregate"):
        raise HTTPException(422, "Unknown export.")
    allowed = set(EXPORT_PRESETS[body.base]["columns"]) | (set(APP_COLUMNS) if not EXPORT_PRESETS[body.base].get("enrolment") else set())
    cols = [c for c in body.columns if c in allowed] or EXPORT_PRESETS[body.base]["columns"]
    uid = _uni_id(p, university_id)
    x = ExportPreset(university_id=uid, organization_id=p.org_id, created_by_user_id=p.id, name=body.name.strip(), base=body.base, columns=cols,
                     filters=_clean_filters(body.filters), schedule="MANUAL")
    db.add(x)
    audit(db, action="export.preset_saved", entity_type="university", entity_id=uid, actor=p, detail={"name": x.name, "base": x.base})
    db.commit()
    return {"id": str(x.id), "name": x.name, "base": x.base, "columns": x.columns, "filters": x.filters, "schedule": x.schedule}


@router.delete("/export-presets/{preset_id}", status_code=204)
def delete_export_preset(preset_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    from app.models import ExportPreset

    x = db.get(ExportPreset, parse_uuid(preset_id))
    if not x or (p.is_university and x.university_id != p.university_id):
        raise HTTPException(404, "Not found")
    db.delete(x)
    db.commit()


def _app_export_rows(db: Session, p: Principal, uid, statuses, filters: dict, columns: list[str]) -> list[list]:
    from app.models import ApplicationAdminCheck, VisaCase

    stmt = analytics._app_filter(scope_applications(select(Application), p).where(Application.university_id == uid, university_visible()), filters=filters)
    if statuses:
        stmt = stmt.where(Application.status.in_(statuses))
    apps = db.scalars(stmt.order_by(Application.submitted_at)).all()
    ids = [a.id for a in apps]
    checks = set(db.scalars(select(ApplicationAdminCheck.application_id).where(ApplicationAdminCheck.application_id.in_(ids or [None]))).all())
    visas = {v.application_id: v.status.value for v in db.scalars(select(VisaCase).where(VisaCase.application_id.in_(ids or [None])))}
    docs = {}
    if "documents_verified" in columns:
        from app.api.v1.applications import _document_summaries

        docs = _document_summaries(db, apps)
    out = []
    for a in apps:
        u = db.get(User, a.student_user_id)
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == a.student_user_id))
        prog = db.get(Program, a.program_id)
        intake = db.get(ProgramIntake, a.intake_id)
        ag = db.get(Organization, a.agency_org_id) if a.agency_org_id else None
        rv = db.get(User, a.university_reviewer_id) if a.university_reviewer_id else None
        vals = {
            "application_id": a.id, "student_name": u.full_name, "nationality": prof.nationality if prof else "", "program": prog.name_en,
            "degree": prog.degree_level.value, "intake": f"{intake.year}-{intake.term.value}", "status": a.status.value,
            "documents_verified": f"{d['verified']}/{d['required']}" if (d := docs.get(a.id)) else "", "submitted_at": iso(a.submitted_at) or "", "decided_at": iso(a.decided_at) or "",
            "agency": ag.name if ag else "", "reviewer": rv.full_name if rv else "", "admin_check": "yes" if a.id in checks else "",
            "external_reference": a.external_reference or "", "tuition_krw": a.tuition_amount_krw or "", "tuition_due": iso(a.tuition_due) or "",
            "scholarship_note": a.offer_scholarship_note or "", "visa_status": visas.get(a.id, ""), "semester_start": iso(intake.semester_start) or "",
        }
        out.append([vals.get(c, "") for c in columns])
    return out


@router.get("/export/preset/{kind}.csv")
def export_preset(kind: str, university_id: str | None = None, saved_id: str | None = None, columns: str | None = None, intake: str | None = None,
                  program_id: str | None = None, nationality: str | None = None, degree: str | None = None, agency_id: str | None = None,
                  p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Run one export job (or a saved configuration of it). Downloads only; audited and logged in the export history."""
    from app.models import ExportPreset

    if kind not in EXPORT_PRESETS:
        raise HTTPException(404, "Unknown export")
    spec = EXPORT_PRESETS[kind]
    uid = _uni_id(p, university_id)
    if spec.get("aggregate"):
        return export_kind("outcomes", university_id, p, db)
    filters = {"intake": intake, "program_id": program_id, "nationality": nationality, "degree": degree, "agency_id": agency_id}
    cols = [c for c in (columns.split(",") if columns else []) if c]
    log_key = kind
    if saved_id:
        x = db.get(ExportPreset, parse_uuid(saved_id))
        if not x or x.university_id != uid or x.base != kind:
            raise HTTPException(404, "Not found")
        filters = {**filters, **x.filters}
        cols = x.columns
        log_key = f"saved:{x.id}"[:24]
    filters = {k: (v.upper() if k in ("nationality", "degree") and v else v) for k, v in filters.items()}
    filters = {k: (parse_uuid(v) if k in ("program_id", "agency_id") and v else v) for k, v in filters.items()}
    buf = io.StringIO()
    w = csv.writer(buf)
    if spec.get("enrolment"):
        cols = [c for c in cols if c in spec["columns"]] or spec["columns"]
        stmt = select(StudentEnrollment).where(StudentEnrollment.university_id == uid)
        if filters.get("program_id"):
            stmt = stmt.where(StudentEnrollment.program_id == filters["program_id"])
        if filters.get("nationality"):
            stmt = stmt.where(StudentEnrollment.nationality == filters["nationality"])
        if filters.get("agency_id"):
            stmt = stmt.where(StudentEnrollment.agency_org_id == filters["agency_id"])
        if filters.get("intake"):
            stmt = stmt.where(StudentEnrollment.cohort_label == str(filters["intake"]))
        rows = []
        for e in db.scalars(stmt.order_by(StudentEnrollment.cohort_label)).all():
            prog = db.get(Program, e.program_id) if e.program_id else None
            ag = db.get(Organization, e.agency_org_id) if e.agency_org_id else None
            v = {"student_name": db.get(User, e.student_user_id).full_name, "nationality": e.nationality or "", "cohort": e.cohort_label,
                 "program": prog.name_en if prog else "", "agency": ag.name if ag else "", "enrolment_status": e.status.value,
                 "enrolled_on": iso(e.enrolled_on) or "", "expected_graduation": iso(e.expected_graduation) or "", "visa_expires_on": iso(e.visa_expires_on) or ""}
            rows.append([v[c] for c in cols])
    else:
        cols = [c for c in cols if c in APP_COLUMNS] or spec["columns"]
        if spec.get("current_intake") and not filters.get("intake"):
            filters["intake"] = next((i["key"] for i in metrics.intakes(db, uid) if i["current"]), None) or "0000-SPRING"
        rows = _app_export_rows(db, p, uid, spec.get("statuses"), filters, cols)
    w.writerow(cols)
    w.writerows(rows)
    detail = {"rows": len(rows), "preset": kind, "saved": bool(saved_id), **{k: str(v) for k, v in filters.items() if v}}
    audit(db, action=f"export.preset.{kind}", entity_type="university", entity_id=uid, actor=p, detail=detail)
    _log_export(db, p, uid, _preset_key(log_key if not saved_id else log_key), len(rows), detail)
    db.commit()
    buf.seek(0)
    return StreamingResponse(iter(["﻿" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'})


@router.get("/programs/{program_id}/rule-history")
def rule_history(program_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Who changed this program's admission rules, when, and what (proposals, publications, discards, direct edits)."""
    from app.models import AuditLog

    prog = _own_program(db, p, program_id)
    out = []
    for c in db.scalars(select(RequirementChange).where(RequirementChange.program_id == prog.id).order_by(RequirementChange.created_at.desc())).all():
        d = ser_change(c, db)
        out.append({"kind": "proposal", "status": c.status, "at": d["reviewed_at"] or d["proposed_at"], "proposed_at": d["proposed_at"],
                    "proposed_by": d["proposed_by"], "reviewed_by": d["reviewed_by"], "reviewed_at": d["reviewed_at"], "changes": c.changes,
                    "previous": c.previous, "note": c.note})
    for a in db.scalars(select(AuditLog).where(AuditLog.entity_id == str(prog.id), AuditLog.action == "requirements.update")
                        .order_by(AuditLog.created_at.desc()).limit(50)).all():
        u = db.get(User, a.actor_user_id) if a.actor_user_id else None
        out.append({"kind": "direct", "status": "PUBLISHED", "at": iso(a.created_at), "proposed_by": u.full_name if u else None,
                    "proposed_at": iso(a.created_at), "reviewed_by": u.full_name if u else None, "reviewed_at": iso(a.created_at),
                    "changes": {k: v for k, v in (a.detail or {}).items() if k in REQ_FIELDS}, "previous": None, "note": None})
    out.sort(key=lambda x: x["at"] or "", reverse=True)
    req = prog.requirements[0] if prog.requirements else None
    return {"effective_from": iso(req.effective_from) if req else None, "effective_to": iso(req.effective_to) if req else None,
            "verified_at": iso(req.verified_at) if req else None, "entries": out}


# ---------------------------------------------------------------- V9 U8: a reviewer leaves — nothing is orphaned

CLOSED_FOR_REVIEW = ("REJECTED", "WITHDRAWN", "ENROLLED", "DRAFT", "PROFILE_REVIEW", "DOCUMENT_PREPARATION", "READY")
TEAM_ADMIN_ROLES = (Role.UNIVERSITY_ADMIN,)


def _ser_assigned(db: Session, a: Application) -> dict:
    u = db.get(User, a.student_user_id)
    prog = db.get(Program, a.program_id)
    return {"id": str(a.id), "student": u.full_name if u else None, "program": prog.name_en if prog else None, "status": a.status.value,
            "reviewer_id": str(a.university_reviewer_id) if a.university_reviewer_id else None}


def _member(db: Session, p: Principal, user_id: str) -> OrganizationMember:
    if not p.is_university:
        raise HTTPException(403, "Only the university's own admins manage its team.")
    m = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == parse_uuid(user_id)))
    if not m:
        raise HTTPException(404, "Not found")
    return m


def _open_assigned(db: Session, university_id, reviewer_ids) -> list[Application]:
    return list(db.scalars(select(Application).where(Application.university_id == university_id, Application.university_reviewer_id.in_(list(reviewer_ids) or [None]),
                                                     Application.status.not_in(CLOSED_FOR_REVIEW)).order_by(Application.submitted_at)).all())


@router.get("/team/{user_id}/assignments")
def member_assignments(user_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Open applications assigned to one team member (what must be handed over before they leave)."""
    m = _member(db, p, user_id)
    return [_ser_assigned(db, a) for a in _open_assigned(db, p.university_id, [m.user_id])]


class DeactivateIn(BaseModel):
    reassign_to: str | None = None  # an active admissions/reviewer member; required when open assignments exist
    note: str | None = Field(default=None, max_length=300)


@router.post("/team/{user_id}/deactivate")
def deactivate_member(user_id: str, body: DeactivateIn, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Admin removes a member's access. Their open applicants are reassigned in the same transaction (each audited) — the
    API refuses to deactivate someone who still holds open applicants without a valid new reviewer."""
    if not p.has(*TEAM_ADMIN_ROLES):
        raise HTTPException(403, "Only a university admin can change the team.")
    m = _member(db, p, user_id)
    if m.user_id == p.id:
        raise HTTPException(409, "You cannot deactivate your own access.")
    if not m.is_active:
        raise HTTPException(409, "This member is already inactive.")
    admins = db.scalar(select(func.count()).select_from(OrganizationMember).where(
        OrganizationMember.organization_id == p.org_id, OrganizationMember.is_active.is_(True))) or 0
    if admins <= 1:
        raise HTTPException(409, "The university needs at least one active admin.")
    open_apps = _open_assigned(db, p.university_id, [m.user_id])
    target = None
    if open_apps:
        if not body.reassign_to:
            raise HTTPException(422, f"{len(open_apps)} open applicants are assigned to this member. Choose who takes them over.")
        target = parse_uuid(body.reassign_to)
        if target == m.user_id or not _reviewer_ok(db, p, target):
            raise HTTPException(422, "The new reviewer must be another active member of your admissions team.")
    for a in open_apps:
        a.university_reviewer_id = target
        audit(db, action="application.update", entity_type="application", entity_id=a.id, actor=p, subject_user_id=a.student_user_id,
              detail={"fields": ["university_reviewer_id"], "reason": "member_deactivated", "from": str(m.user_id), "to": str(target)})
    m.is_active = False
    audit(db, action="team.member_deactivated", entity_type="organization_member", entity_id=m.id, actor=p,
          detail={"user_id": str(m.user_id), "reassigned": len(open_apps), "to": str(target) if target else None, "note": body.note})
    db.commit()
    return {"ok": True, "reassigned": len(open_apps), "to": str(target) if target else None}


@router.post("/team/{user_id}/reactivate")
def reactivate_member(user_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    if not p.has(*TEAM_ADMIN_ROLES):
        raise HTTPException(403, "Only a university admin can change the team.")
    m = _member(db, p, user_id)
    if not m.is_active:
        m.is_active = True
        audit(db, action="team.member_reactivated", entity_type="organization_member", entity_id=m.id, actor=p, detail={"user_id": str(m.user_id)})
        db.commit()
    return {"ok": True}


@router.get("/orphaned-assignments")
def orphaned_assignments(university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Open applications whose reviewer is no longer an active member (e.g. access removed outside this console)."""
    uid = _uni_id(p, university_id)
    org = db.scalar(select(Organization.id).where(Organization.university_id == uid))
    active = set(db.scalars(select(OrganizationMember.user_id).where(OrganizationMember.organization_id == org, OrganizationMember.is_active.is_(True))).all())
    apps = db.scalars(select(Application).where(Application.university_id == uid, Application.university_reviewer_id.is_not(None),
                                                Application.status.not_in(CLOSED_FOR_REVIEW))).all()
    return [_ser_assigned(db, a) for a in apps if a.university_reviewer_id not in active]


# ---------------------------------------------------------------- V9: analytics by question, partnership value, agency identity

@router.get("/analytics/questions")
def analytics_questions(university_id: str | None = None, nationality: str | None = None, program_id: str | None = None, degree: str | None = None,
                        intake: str | None = None, agency_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Which countries convert to enrollment? Which programs attract qualified demand? (one population, drillable)."""
    uid = _uni_id(p, university_id)
    return analytics.university_questions(db, uid, _filters(nationality, program_id, degree, intake, agency_id))


@router.get("/partnership-value")
def partnership_value(intake: str | None = None, university_id: str | None = None, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Every partnership number with numerator, denominator and cohort; visa outcome per agency for this university."""
    from app.services import university_value

    uid = _uni_id(p, university_id)
    return university_value.partnership_value(db, uid, intake)


@router.get("/applications/{app_id}/agency")
def application_agency(app_id: str, p: Principal = Depends(require_university), db: Session = Depends(get_db)):
    """Who is responsible for this applicant on the agency side (MOJ plans the agency on the CoA). Uses the agency
    workstream's helper (services/agency_ops.agency_identity): legal name and registration as recorded — registration is
    NOT_RECORDED until a real one is recorded, never inferred."""
    from app.services.agency_ops import agency_identity

    app = get_application_for(db, p, parse_uuid(app_id))
    if not app.agency_org_id:
        return {"agency": None}
    ident = agency_identity(db, app.student_user_id, app)
    if not ident or ident["agency_id"] != str(app.agency_org_id):
        # The student moved agency after applying: the application's own agency is the one that sent it.
        o = db.get(Organization, app.agency_org_id)
        ident = {"agency_id": str(o.id), "trading_name": o.name, "legal_name": getattr(o, "legal_name", None), "country_code": o.country_code,
                 "registration": {"status": "NOT_RECORDED", "number": None, "authority": None, "checked_on": None},
                 "responsible_counselor": None, "sub_agent": None}
    return {"agency": {"id": ident["agency_id"], "name": ident["trading_name"], "legal_name": ident.get("legal_name"),
                       "country_code": ident.get("country_code"), "registration_status": ident["registration"]["status"],
                       "registration": ident["registration"],
                       "responsible_counselor": (ident.get("responsible_counselor") or {}).get("name"), "sub_agent": ident.get("sub_agent")}}
