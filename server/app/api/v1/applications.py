from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.api.common import Page, actor_kind, iso, paginate, parse_uuid, ser_application
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_student
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    DocumentRequest,
    Essay,
    Organization,
    Program,
    ProgramIntake,
    StudentEnrollment,
    StudentProfile,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, DocumentCategory, EssayStatus, EssayType, PipelineStage, Role, VisaStatus
from app.services import document_requests, eligibility_summary
from app.services import entitlements as entitlements_svc
from app.services.access import get_application_for, scope_applications
from app.services.notify import notify
from app.services.readiness import application_readiness, requirements_for
from app.services.readiness import checklist as readiness_checklist
from app.services.state_machine import UNIVERSITY, allowed_next, check_transition
from app.services.tasks_engine import generate_for_student
from app.services.visa import infer_visa

router = APIRouter(prefix="/applications", tags=["applications"])

EVENT_FOR = {S.SUBMITTED: "application_submitted", S.OFFERED: "offer_received", S.OFFER_ACCEPTED: "offer_accepted",
             S.TUITION_PAID: "tuition_paid", S.VISA_ISSUED: "visa_issued", S.ENROLLED: "student_enrolled"}
PIPELINE_FOR = {S.SUBMITTED: PipelineStage.APPLIED, S.INTERVIEW: PipelineStage.INTERVIEW, S.OFFERED: PipelineStage.OFFERED,
                S.REJECTED: PipelineStage.REJECTED, S.WAITLISTED: PipelineStage.WAITLISTED, S.TUITION_PENDING: PipelineStage.TUITION_PENDING,
                S.VISA_PREPARATION: PipelineStage.VISA_PREPARATION, S.VISA_ISSUED: PipelineStage.VISA_ISSUED, S.ENROLLED: PipelineStage.ENROLLED,
                S.READY: PipelineStage.READY_TO_APPLY, S.DOCUMENT_PREPARATION: PipelineStage.DOCUMENT_PREPARATION}
UNIVERSITY_WRITE_ROLES = (Role.UNIVERSITY_ADMIN,)  # V22: the one university permission (legacy rows read as it)


def filter_applications(db: Session, p: Principal, *, status=None, q=None, program_id=None, nationality=None, agency_id=None, university_id=None, flagged=None, requests=None, intake=None, degree=None, reviewer=None, admin_check=None, reached=None, ids=None, eligibility=None):
    """The applicant-list predicate, shared by `GET /applications` and the university CSV export (V23 §273 U1) so an
    export can never contain a different set of rows from the table it was exported from."""
    from app.models import ApplicationAdminCheck
    from app.models.enums import DegreeLevel
    from app.services import metrics as metrics_svc
    from app.services.analytics import intake_clause

    stmt = scope_applications(select(Application), p)
    if status:
        # V23: an unknown status is the caller's mistake (422), not a database error (it was a 500).
        if bad := [x for x in status if x not in S.__members__]:
            raise HTTPException(422, f"Unknown status: {', '.join(bad[:3])}")
        stmt = stmt.where(Application.status.in_(status))
    if program_id:
        stmt = stmt.where(Application.program_id == parse_uuid(program_id))
    if agency_id:
        stmt = stmt.where(Application.agency_org_id == parse_uuid(agency_id))
    if university_id:
        stmt = stmt.where(Application.university_id == parse_uuid(university_id))
    if flagged is not None:
        stmt = stmt.where(Application.flagged.is_(flagged))
    if nationality:
        stmt = stmt.where(Application.student_user_id.in_(select(StudentProfile.user_id).where(StudentProfile.nationality == nationality.upper())))
    # V8: the same intake / degree filters as university analytics, so every chart row drills down to exactly its records.
    if intake:
        stmt = stmt.where(intake_clause(intake))
    if degree:
        if degree.upper() not in DegreeLevel.__members__:
            raise HTTPException(422, "Unknown degree level.")
        stmt = stmt.where(Application.program_id.in_(select(Program.id).where(Program.degree_level == DegreeLevel[degree.upper()])))
    if reviewer:
        if reviewer == "none":
            stmt = stmt.where(Application.university_reviewer_id.is_(None))
        else:
            stmt = stmt.where(Application.university_reviewer_id == (p.id if reviewer == "me" else parse_uuid(reviewer)))
    if admin_check:
        checked = select(ApplicationAdminCheck.application_id)
        stmt = stmt.where(Application.id.in_(checked) if admin_check == "done" else Application.id.not_in(checked))
    if ids:
        stmt = stmt.where(Application.id.in_([parse_uuid(i) for i in ids]))
    if reached:
        if reached not in metrics_svc.STEPS or not (p.is_university or p.is_hangyul):
            raise HTTPException(422, "Unknown funnel step.")
        uid = p.university_id if p.is_university else (parse_uuid(university_id) if university_id else None)
        if uid is None:
            raise HTTPException(422, "university_id is required with reached.")
        f = {"nationality": nationality.upper() if nationality else None, "program_id": parse_uuid(program_id) if program_id else None,
             "degree": degree.upper() if degree else None, "intake": intake, "agency_id": parse_uuid(agency_id) if agency_id else None}
        stmt = stmt.where(Application.id.in_(metrics_svc.reached_ids(db, uid, f, reached) or [None]))
    if requests:
        # University triage (V4): "open" = at least one document request still waiting on the applicant;
        # "returned" = waiting for documents and every request has been answered (ready to re-review).
        open_ids = select(DocumentRequest.application_id).where(DocumentRequest.status == "OPEN")
        if requests == "open":
            stmt = stmt.where(Application.id.in_(open_ids))
        else:
            answered = select(DocumentRequest.application_id).where(DocumentRequest.status == "FULFILLED")
            stmt = stmt.where(Application.status == S.ADDITIONAL_DOCUMENTS, Application.id.in_(answered), Application.id.not_in(open_ids))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Application.student_user_id.in_(select(User.id).where(or_(User.full_name.ilike(like), User.email.ilike(like)))),
            Application.program_id.in_(select(Program.id).where(Program.name_en.ilike(like))),
            Application.university_id.in_(select(University.id).where(University.name_en.ilike(like))),
            Application.external_reference.ilike(like),
        ))
    if eligibility:
        # V9 additive: the drill-down behind "qualified demand" (university analytics) — same check as the row summary.
        if not (p.is_university or p.is_hangyul):
            raise HTTPException(422, "Unknown filter.")
        cand = db.scalars(stmt).all()
        summ = eligibility_summary.summarize(db, cand)
        stmt = stmt.where(Application.id.in_([a.id for a in cand if (summ.get(a.id) or {}).get("status") == eligibility] or [None]))
    return stmt


# Mirrors apps/university-web/src/lib/workflow.ts AWAITING_DECISION (the headline's "결정이 필요한 지원자").
AWAITING_DECISION = (S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.WAITLISTED)


@router.get("")
def list_applications(
    page: Page = Depends(),
    status: list[str] | None = Query(None),
    q: str | None = None,
    program_id: str | None = None,
    nationality: str | None = None,
    agency_id: str | None = None,
    university_id: str | None = None,
    flagged: bool | None = None,
    requests: str | None = Query(None, pattern="^(open|returned)$"),
    intake: str | None = Query(None, max_length=64, description="Intake key YYYY-TERM (e.g. 2027-SPRING) or one intake id"),
    degree: str | None = Query(None, max_length=24, description="Program degree level (Program.degree_level)"),
    reviewer: str | None = Query(None, max_length=64, description="University reviewer: user id, 'me' or 'none'"),
    admin_check: str | None = Query(None, pattern="^(done|pending)$"),
    reached: str | None = Query(None, max_length=24, description="Funnel step reached (university only): SUBMITTED … ENROLLED"),
    ids: list[str] | None = Query(None, max_length=500),
    eligibility: str | None = Query(None, pattern="^(MEETS|BELOW|TO_CHECK|UNKNOWN)$",
                                    description="V9 (university): applicant vs. published minimums, as in the list's eligibility summary"),
    sort: str = Query("updated", pattern="^(updated|deadline|readiness|submitted|decision)$"),
    # V25 (REPORT §315 U1): "what changed recently" on the university home — applications submitted, or moved, within the
    # last N days. Same population and tenancy as every other filter, so a headline number is the row count it opens.
    submitted_within_days: int | None = Query(None, ge=1, le=366),
    updated_within_days: int | None = Query(None, ge=1, le=366),
    # V25 (REPORT §315): a month on the Insights trend opens exactly the applications submitted in it.
    submitted_month: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    p: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    stmt = filter_applications(db, p, status=status, q=q, program_id=program_id, nationality=nationality, agency_id=agency_id,
                               university_id=university_id, flagged=flagged, requests=requests, intake=intake, degree=degree,
                               reviewer=reviewer, admin_check=admin_check, reached=reached, ids=ids, eligibility=eligibility)
    if submitted_within_days:
        stmt = stmt.where(Application.submitted_at >= utcnow() - timedelta(days=submitted_within_days))
    if submitted_month:
        y, m = (int(x) for x in submitted_month.split("-"))
        start = datetime(y, m, 1, tzinfo=UTC)
        end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=UTC)
        stmt = stmt.where(Application.submitted_at >= start, Application.submitted_at < end)
    if updated_within_days:
        stmt = stmt.where(Application.updated_at >= utcnow() - timedelta(days=updated_within_days))
    if sort == "deadline":
        stmt = stmt.join(ProgramIntake, ProgramIntake.id == Application.intake_id).order_by(ProgramIntake.application_deadline)
    elif sort == "readiness":
        stmt = stmt.order_by(Application.readiness_percent.desc())
    elif sort == "submitted":
        stmt = stmt.order_by(Application.submitted_at.desc().nulls_last())
    elif sort == "decision":
        # V26 (REPORT §336 U2): the applicants who need a decision first, the longest-waiting at the top; everyone else
        # after them, newest submission first. `id` breaks ties so pages never shuffle.
        waiting = case((Application.status.in_(AWAITING_DECISION), 0), else_=1)
        stmt = stmt.order_by(waiting, case((Application.status.in_(AWAITING_DECISION), Application.submitted_at)).asc().nulls_last(),
                             Application.submitted_at.desc().nulls_last(), Application.id)
    else:
        stmt = stmt.order_by(Application.updated_at.desc())
    out = paginate(db, stmt, page, lambda a: ser_application(a, db, include_student=not p.is_student))
    if p.is_university or p.is_hangyul:
        # Admissions triage: applicant vs. published minimums and open document requests, batched for the page.
        ids = [parse_uuid(i["id"]) for i in out["items"]]
        apps = db.scalars(select(Application).where(Application.id.in_(ids))).all() if ids else []
        elig = eligibility_summary.summarize(db, apps)
        open_req = dict(db.execute(select(DocumentRequest.application_id, func.count()).where(DocumentRequest.application_id.in_(ids), DocumentRequest.status == "OPEN")
                                   .group_by(DocumentRequest.application_id)).all()) if ids else {}
        returned = dict(db.execute(select(DocumentRequest.application_id, func.count()).where(DocumentRequest.application_id.in_(ids), DocumentRequest.status == "FULFILLED")
                                   .group_by(DocumentRequest.application_id)).all()) if ids else {}
        docs = _document_summaries(db, apps)
        from app.models import ApplicationAdminCheck

        checks = {c.application_id: c for c in db.scalars(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id.in_(ids)))} if ids else {}
        for i in out["items"]:
            aid = parse_uuid(i["id"])
            c = checks.get(aid)
            i["admin_check"] = {"checked_at": iso(c.checked_at), "by": (u.full_name if (u := db.get(User, c.checked_by_user_id)) else None) if c.checked_by_user_id else None} if c else None
            i["eligibility"] = elig.get(aid)
            i["open_document_requests"] = open_req.get(aid, 0)
            i["returned_document_requests"] = returned.get(aid, 0)
            i["documents"] = docs.get(aid)
    return out


def _document_summaries(db: Session, apps: list) -> dict:
    """What was verified, per application, for the university list ("8/8 verified") — counts, not a readiness percentage.

    ``required`` = required checklist items for the program; ``verified`` = those verified by Hangyul / the agency;
    ``shared`` = required items whose document the student shared with the university at submission.
    """
    if not apps:
        return {}
    today = utcnow().date()
    nat = dict(db.execute(select(StudentProfile.user_id, StudentProfile.nationality).where(StudentProfile.user_id.in_({a.student_user_id for a in apps}))).all())
    shared = defaultdict(set)
    for app_id, req_id in db.execute(select(ApplicationDocument.application_id, ApplicationDocument.requirement_id).where(
            ApplicationDocument.application_id.in_([a.id for a in apps]), ApplicationDocument.shared_with_university.is_(True),
            ApplicationDocument.document_id.is_not(None))).all():
        shared[app_id].add(str(req_id))
    out = {}
    for a in apps:
        items = [i for i in readiness_checklist(db, a.student_user_id, db.get(Program, a.program_id), db.get(University, a.university_id), nat.get(a.student_user_id), today)
                 if i["required"]]
        out[a.id] = {"required": len(items), "verified": sum(1 for i in items if i["status"] == "VERIFIED"),
                     "shared": sum(1 for i in items if i["requirement_id"] in shared[a.id])}
    return out


class CreateIn(BaseModel):
    program_id: str
    intake_id: str | None = None


@router.post("", status_code=201)
def create_application(body: CreateIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prog = db.get(Program, parse_uuid(body.program_id))
    if not prog or not prog.is_active:
        raise HTTPException(404, "Program not found")
    today = utcnow().date()
    if body.intake_id:
        intake = db.get(ProgramIntake, parse_uuid(body.intake_id))
        if not intake or intake.program_id != prog.id:
            raise HTTPException(404, "Intake not found")
    else:
        intake = min((i for i in prog.intakes if i.is_open and i.application_deadline >= today), key=lambda i: i.application_deadline, default=None)
    if intake is None or not intake.is_open or intake.application_deadline < today:
        raise HTTPException(409, "This intake is not accepting applications.")
    if db.scalar(select(Application).where(Application.student_user_id == p.id, Application.intake_id == intake.id)):
        raise HTTPException(409, "You already started an application for this intake.")
    a_ = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    app = Application(student_user_id=p.id, program_id=prog.id, intake_id=intake.id, university_id=prog.university_id,
                      agency_org_id=a_.organization_id if a_ else None, status=S.DRAFT)
    db.add(app)
    db.flush()
    db.add(ApplicationStatusHistory(application_id=app.id, from_status=None, to_status=S.DRAFT, actor_user_id=p.id, actor_org_type="STUDENT", created_at=utcnow()))
    # V9 reliability (student changes target intake): essays already written for a withdrawn application to the same
    # program move to this one instead of being left behind; only missing types get a fresh workspace.
    carried = _carry_over_from_withdrawn(db, p.id, app, intake)
    # Pre-create essay workspaces the program typically needs (student writes; never auto-generated).
    for et, title in ((EssayType.PERSONAL_STATEMENT, "Personal statement"), (EssayType.STUDY_PLAN, "Study plan")):
        if et in carried:
            continue
        if prog.degree_level.value != "LANGUAGE" or et == EssayType.STUDY_PLAN:
            db.add(Essay(owner_user_id=p.id, application_id=app.id, program_id=prog.id, essay_type=et,
                         title=f"{title} — {db.get(University, prog.university_id).name_en}", word_limit=1000 if et == EssayType.PERSONAL_STATEMENT else 1500,
                         due_date=intake.application_deadline))
    track(db, "application_started", user_id=p.id, university_id=prog.university_id, application_id=app.id)
    db.flush()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == p.id))
    app.readiness_percent, _ = application_readiness(db, app, prof, today)
    generate_for_student(db, p.id)
    db.commit()
    return ser_application(app, db, include_student=False)


def _has_work(e: Essay) -> bool:
    return bool(e.versions and any((v.body or "").strip() for v in e.versions)) or e.status != EssayStatus.DRAFT


def move_essays(db: Session, src: Application, dst: Application, intake: ProgramIntake) -> set:
    """Move the student's written essays from ``src`` (being withdrawn) to ``dst`` (same student, same program). An empty
    workspace of the same type on ``dst`` is swapped back onto ``src`` so nothing is deleted. Returns the moved types."""
    moved = set()
    dst_by_type = {e.essay_type: e for e in db.scalars(select(Essay).where(Essay.application_id == dst.id))}
    for e in db.scalars(select(Essay).where(Essay.application_id == src.id)).all():
        if not _has_work(e):
            continue
        target = dst_by_type.get(e.essay_type)
        if target is not None:
            if _has_work(target):
                continue  # the new application already has its own text for this type — keep both, change nothing
            target.application_id = src.id
        e.application_id, e.due_date = dst.id, intake.application_deadline
        moved.add(e.essay_type)
    return moved


def _carry_over_from_withdrawn(db: Session, student_id, app: Application, intake: ProgramIntake) -> set:
    db.flush()
    moved: set = set()
    for old in db.scalars(select(Application).where(Application.student_user_id == student_id, Application.program_id == app.program_id,
                                                    Application.status == S.WITHDRAWN, Application.id != app.id)
                          .order_by(Application.updated_at.desc())).all():
        moved |= move_essays(db, old, app, intake)
    return moved


@router.get("/{app_id}")
def application_detail(app_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    app = get_application_for(db, p, parse_uuid(app_id))
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    pct, items = application_readiness(db, app, prof, utcnow().date())
    app.readiness_percent = pct
    history = []
    for h in app.history:
        actor = db.get(User, h.actor_user_id) if h.actor_user_id else None
        history.append({"from": h.from_status.value if h.from_status else None, "to": h.to_status.value, "at": iso(h.created_at),
                        "actor": actor.full_name if actor and not p.is_student else (h.actor_org_type or "SYSTEM"), "actor_org_type": h.actor_org_type,
                        "note": h.note})
    links = {str(l.requirement_id): l for l in db.scalars(select(ApplicationDocument).where(ApplicationDocument.application_id == app.id))}
    if p.is_university:
        items = [dict(i, document_id=i["document_id"] if (l := links.get(i["requirement_id"])) and l.shared_with_university else None) for i in items]
    else:
        for i in items:
            l = links.get(i["requirement_id"])
            i["shared_with_university"] = bool(l and l.shared_with_university)
    # Explicit university document requests appear in every checklist, first, with the university's exact note.
    items = document_requests.checklist_items(db, app) + items
    essays = db.scalars(select(Essay).where(Essay.application_id == app.id)).all()
    agency = db.get(Organization, app.agency_org_id) if app.agency_org_id else None
    d = ser_application(app, db, include_student=not p.is_student)
    from app.services.guides import managed_support
    from app.services.guides import state_for as guide_state

    d.update({
        "readiness_percent": pct,
        "checklist": items,
        # V27: which official guide the checklist comes from — or that there is none yet (REPORT §357).
        "admission_guide": guide_state(db, app),
        # V29: whether this intake is in the managed-application set (verified, complete current guide).
        "managed_support": managed_support(db, app),
        "history": history,
        "allowed_transitions": [s.value for s in allowed_next(app.status, actor_kind(p))] if not (p.is_university and not p.has(*UNIVERSITY_WRITE_ROLES)) else [],
        "essays": [{"id": str(e.id), "title": e.title, "essay_type": e.essay_type.value, "status": e.status.value, "due_date": iso(e.due_date)} for e in essays],
        "agency": {"id": str(agency.id), "name": agency.name} if agency else None,
        "document_requests": [document_requests.ser_request(r, db) for r in document_requests.requests_for(db, app.id)],
    })
    if not p.is_student:
        from app.models import ApplicationAdminCheck

        c = db.scalar(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id == app.id))
        d["admin_check"] = {"checked_at": iso(c.checked_at), "note": c.note,
                            "by": (u.full_name if (u := db.get(User, c.checked_by_user_id)) else None) if c.checked_by_user_id else None} if c else None
    if not p.is_student and prof:
        d["student_profile"] = {
            "nationality": prof.nationality, "residence_country": prof.residence_country,
            "education": [{"level": e.level, "institution": e.institution, "country": e.country, "gpa_percent": e.gpa_percent, "graduation_status": e.graduation_status} for e in prof.educations],
            "languages": [{"test": l.test.value, "score": l.score, "is_planned": l.is_planned, "verified": l.verified} for l in prof.languages],
        }
    if p.is_university:
        audit(db, action="application.view", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id)
    db.commit()
    return d


class TransitionIn(BaseModel):
    to: S
    note: str | None = Field(default=None, max_length=2000)
    interview_at: datetime | None = None
    tuition_amount_krw: int | None = None
    tuition_due: date | None = None
    offer_scholarship_note: str | None = Field(default=None, max_length=300)
    external_reference: str | None = Field(default=None, max_length=80)


@router.post("/{app_id}/transition")
def transition(app_id: str, body: TransitionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    app = get_application_for(db, p, parse_uuid(app_id))
    kind = actor_kind(p)
    if kind == UNIVERSITY and not p.has(*UNIVERSITY_WRITE_ROLES):
        raise HTTPException(403, "Your role is read-only.")
    check_transition(app.status, body.to, kind)
    # V15 (REPORT §117, brief Part 6): an application leaving DRAFT is one of the 지원 학교 최대 N곳 the plan
    # sells. Guarded here rather than at creation, because a student may draft freely — what is rationed is
    # the work Hangyul then does on it. The refusal carries its own numbers so the console can explain it
    # and offer the one legitimate next step instead of failing with an internal error.
    # V17: **except withdrawal.** `WITHDRAWN` also leaves DRAFT, so the allowance refused it too — which
    # meant a student whose plan includes no managed applications could not delete their own draft, and was
    # offered an upgrade in order to do so. The allowance rations the work Hangyul takes on; giving a draft
    # up is the opposite of asking for work, and a boundary that traps someone is not a boundary.
    if app.status == S.DRAFT and body.to not in (S.DRAFT, S.WITHDRAWN):
        try:
            entitlements_svc.check(db, app.student_user_id, "max_managed_applications")
        except entitlements_svc.OutOfScope as exc:
            raise HTTPException(409, exc.as_detail()) from exc
        track(db, "managed_application_started", user_id=app.student_user_id, properties={})
    if body.to == S.READY:
        # V27: "ready" against no verified guide would be a false complete checklist (REPORT §357).
        from app.services.guides import REVIEW_REQUIRED
        from app.services.guides import state_for as guide_state

        if guide_state(db, app)["state"] == "REVIEW_REQUIRED":
            raise HTTPException(409, {"code": REVIEW_REQUIRED, "message": "The university's current admission guide has not been verified yet."})
    if body.to == S.SUBMITTED:
        # V5 (success): never "submitted" without evidence — a student records the confirmation first (/submission/confirm).
        from app.services import submission as submission_hub

        if kind == "STUDENT":
            submission_hub.require_evidence_for_student(db, app)
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
        pct, items = application_readiness(db, app, prof, utcnow().date())
        missing = [i["label"] for i in items if i["required"] and i["status"] == "MISSING"]
        if missing:
            raise HTTPException(409, f"Required documents are missing: {', '.join(missing)}.")
        app.readiness_percent = pct
        app.submitted_at = utcnow()
        # Share linked documents with the university at submission (student consented at application start).
        for r in requirements_for(db, db.get(Program, app.program_id), prof.nationality if prof else None):
            item = next((i for i in items if i["requirement_id"] == str(r.id)), None)
            if item and item["document_id"]:
                link = db.scalar(select(ApplicationDocument).where(ApplicationDocument.application_id == app.id, ApplicationDocument.requirement_id == r.id))
                if link is None:
                    db.add(ApplicationDocument(application_id=app.id, requirement_id=r.id, document_id=parse_uuid(item["document_id"]), shared_with_university=True))
                else:
                    link.document_id, link.shared_with_university = parse_uuid(item["document_id"]), True
        submission_hub.on_submitted(db, app, actor_id=p.id, actor_kind=kind, external_reference=body.external_reference)
    if body.to == S.INTERVIEW:
        app.interview_at = body.interview_at
    if body.to in (S.OFFERED, S.REJECTED, S.WAITLISTED):
        app.decided_at = utcnow()
        app.university_reviewer_id = p.id if kind == UNIVERSITY else app.university_reviewer_id
    if body.to == S.OFFERED and body.offer_scholarship_note:
        app.offer_scholarship_note = body.offer_scholarship_note
    if body.to == S.TUITION_PENDING:
        app.tuition_amount_krw = body.tuition_amount_krw or app.tuition_amount_krw
        app.tuition_due = body.tuition_due or app.tuition_due
    if body.external_reference:
        app.external_reference = body.external_reference
    prev = app.status
    app.status = body.to
    db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=body.to, actor_user_id=p.id, actor_org_type=kind, note=body.note, created_at=utcnow()))
    from app.seed.extra_40_partner_consistency import OFFER_ONWARD
    from app.services import partner_quota

    if (prev in OFFER_ONWARD) != (body.to in OFFER_ONWARD):
        partner_quota.sync_for(db, app)  # partner "seats used" follows the offers (was seed-only until V29)
    audit(db, action="application.transition", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
          detail={"from": prev.value, "to": body.to.value})
    if body.to in EVENT_FOR:
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
        track(db, EVENT_FOR[body.to], user_id=app.student_user_id, university_id=app.university_id, application_id=app.id,
              organization_id=app.agency_org_id, nationality=prof.nationality if prof else None)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    if prof and body.to in PIPELINE_FOR:
        prof.pipeline_stage = PIPELINE_FOR[body.to]
    uni = db.get(University, app.university_id)
    if kind != "STUDENT":
        notify(db, app.student_user_id, "APPLICATION_STATUS", f"notify.application.{body.to.value}",
               f"{uni.name_en}: your application is now {body.to.value.replace('_', ' ').lower()}.",
               params={"university": uni.name_en, "university_id": str(uni.id), "status": body.to.value}, link=f"/applications/{app.id}")
    if kind == UNIVERSITY and app.agency_org_id:
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == app.student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if a and a.counselor_user_id:
            notify(db, a.counselor_user_id, "APPLICATION_STATUS", f"notify.application.{body.to.value}", f"{uni.name_en} moved an application to {body.to.value}",
                   params={"university": uni.name_en, "university_id": str(uni.id), "status": body.to.value}, link=f"/applications/{app.id}")
    if body.to == S.ADMISSION_CERTIFICATE_ISSUED:
        # Automation: open the visa case as soon as the standard admission letter is issued.
        if not db.scalar(select(VisaCase).where(VisaCase.application_id == app.id)):
            vt, why = infer_visa(db.get(Program, app.program_id).degree_level)
            intake = db.get(ProgramIntake, app.intake_id)
            db.add(VisaCase(student_user_id=app.student_user_id, application_id=app.id, visa_type=vt, visa_type_reason=why,
                            status=VisaStatus.DOCUMENT_PREPARATION, target_entry_date=intake.semester_start, completed_steps=["admission_certificate"]))
            track(db, "visa_started", user_id=app.student_user_id, application_id=app.id)
    if body.to == S.WITHDRAWN:
        # V9 reliability (target intake changed after the new application was started): the written essays follow the
        # student's live application to the same program instead of staying on the withdrawn one.
        live = db.scalar(select(Application).where(Application.student_user_id == app.student_user_id, Application.program_id == app.program_id,
                                                   Application.id != app.id, Application.status.in_([S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY]))
                         .order_by(Application.created_at.desc()))
        if live is not None:
            move_essays(db, app, live, db.get(ProgramIntake, live.intake_id))
    if body.to == S.ENROLLED:
        intake = db.get(ProgramIntake, app.intake_id)
        if not db.scalar(select(StudentEnrollment).where(StudentEnrollment.application_id == app.id)):
            db.add(StudentEnrollment(student_user_id=app.student_user_id, university_id=app.university_id, program_id=app.program_id, application_id=app.id,
                                     agency_org_id=app.agency_org_id, cohort_label=f"{intake.year}-{intake.term.value}", nationality=prof.nationality if prof else None,
                                     enrolled_on=utcnow().date()))
    generate_for_student(db, app.student_user_id)
    db.commit()
    return application_detail(app_id, p, db)


class AppPatch(BaseModel):
    flagged: bool | None = None
    flag_reason: str | None = Field(default=None, max_length=300)
    external_reference: str | None = Field(default=None, max_length=80)
    university_reviewer_id: str | None = None


@router.patch("/{app_id}")
def patch_application(app_id: str, body: AppPatch, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    app = get_application_for(db, p, parse_uuid(app_id))
    if p.is_student:
        raise HTTPException(403, "Not allowed")
    if p.is_university and not p.has(*UNIVERSITY_WRITE_ROLES):
        raise HTTPException(403, "Your role is read-only.")
    data = body.model_dump(exclude_unset=True)
    if "university_reviewer_id" in data:
        if not p.is_university:
            raise HTTPException(403, "Only the university assigns its reviewers.")
        rid = data.pop("university_reviewer_id")
        if rid:
            from app.models import OrganizationMember

            m = db.scalar(select(OrganizationMember).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == parse_uuid(rid),
                                                          OrganizationMember.is_active.is_(True)))
            if not m:
                raise HTTPException(422, "The reviewer must be an active member of your admissions team.")
        app.university_reviewer_id = parse_uuid(rid) if rid else None
    for k, v in data.items():
        setattr(app, k, v)
    audit(db, action="application.update", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id, detail={"fields": sorted(data)})
    db.commit()
    return ser_application(app, db)


# ---------------------------------------------------------------- University document requests


class DocumentRequestIn(BaseModel):
    label: str = Field(min_length=2, max_length=200)
    note: str = Field(min_length=3, max_length=2000)
    category: DocumentCategory | None = None
    due_date: date | None = None


@router.post("/{app_id}/document-requests", status_code=201)
def create_document_request(app_id: str, body: DocumentRequestIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """A university asks the applicant for one more document. The note is shown to the student exactly as written."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if not (p.is_university and p.has(*UNIVERSITY_WRITE_ROLES)) and not p.is_hangyul:
        raise HTTPException(403, "Only the university's admissions team can request documents.")
    r = document_requests.create_request(db, app, actor_id=p.id, actor_org_id=p.org_id, label=body.label, note=body.note,
                                         category=body.category.value if body.category else None, due_date=body.due_date)
    audit(db, action="application.document_request", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
          detail={"request_id": str(r.id), "label": r.label})
    generate_for_student(db, app.student_user_id)
    db.commit()
    return document_requests.ser_request(r, db)


requests_router = APIRouter(prefix="/document-requests", tags=["applications"])


class FulfillIn(BaseModel):
    document_id: str


def _request_and_app(db: Session, p: Principal, request_id: str):
    r = db.get(DocumentRequest, parse_uuid(request_id))
    if not r:
        raise HTTPException(404, "Not found")
    app = get_application_for(db, p, r.application_id)  # tenant + ownership checks (404 on denial)
    return r, app


@requests_router.post("/{request_id}/fulfill")
def fulfill_document_request(request_id: str, body: FulfillIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The student (or their agency) answers a request with a document from the student's vault."""
    r, app = _request_and_app(db, p, request_id)
    if p.is_university:
        raise HTTPException(403, "The applicant or their counselor sends requested documents.")
    document_requests.fulfill_request(db, r, app, actor_id=p.id, document_id=parse_uuid(body.document_id))
    audit(db, action="application.document_request_fulfilled", entity_type="application", entity_id=app.id, actor=p,
          subject_user_id=app.student_user_id, detail={"request_id": str(r.id)})
    db.commit()
    return document_requests.ser_request(r, db)


@requests_router.post("/{request_id}/cancel")
def cancel_document_request(request_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    r, app = _request_and_app(db, p, request_id)
    if not (p.is_university and p.has(*UNIVERSITY_WRITE_ROLES)) and not p.is_hangyul:
        raise HTTPException(403, "Only the university's admissions team can cancel a request.")
    document_requests.cancel_request(db, r)
    audit(db, action="application.document_request_cancelled", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id)
    db.commit()
    return document_requests.ser_request(r, db)
