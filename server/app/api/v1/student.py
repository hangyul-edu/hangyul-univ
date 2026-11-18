import hashlib
import logging
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import iso, parse_uuid, ser_application, ser_intake, ser_profile, ser_program
from app.core.audit import audit, track
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import Principal, require_student
from app.core.security import mask
from app.models import (
    AgencyAssignment,
    Application,
    ArrivalPlan,
    ConsentRecord,
    Conversation,
    DataRequest,
    Document,
    Dormitory,
    Essay,
    HousingCase,
    MatchSnapshot,
    Message,
    MessageRead,
    Order,
    Organization,
    PartnerContract,
    Payment,
    Program,
    ProgramIntake,
    Scholarship,
    ServiceAddOn,
    ServiceProduct,
    StudentEducation,
    StudentEnrollment,
    StudentLanguage,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus as S,
)
from app.models.enums import (
    AssignmentStatus,
    ContractStatus,
    DegreeLevel,
    IntakeTerm,
    LanguageTest,
    MessageVisibility,
    OrderStatus,
    PipelineStage,
    TaskStatus,
    VisaStatus,
)
from app.services import assignment as assignment_svc
from app.services import concierge as concierge_svc
from app.services import dossier as dossier_svc
from app.services import entitlements as entitlements_svc
from app.services import money as money_svc
from app.services import services_now
from app.services import strategy as strategy_svc
from app.services import visa_routes as visa_routes_svc
from app.services.budget import first_year_range
from app.services.display_identity import team_identity
from app.services.facts import withheld
from app.services.matching import ENGINE_VERSION, language_routes, match_program, normalize_gpa, scholarship_eligibility
from app.services.notify import notify
from app.services.payments import NotConfigured, get_provider
from app.services.readiness import application_readiness, profile_percent, profile_steps, workspace_next
from app.services.state_machine import TERMINAL, reached
from app.services.tasks_engine import generate_for_student
from app.services.visa import step_presentation

log = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["student"])


def get_profile(db: Session, user_id) -> StudentProfile:
    prof = db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
        .options(selectinload(StudentProfile.educations), selectinload(StudentProfile.languages))
    )
    if prof is None:
        prof = StudentProfile(user_id=user_id)
        db.add(prof)
        db.flush()
    return prof


@router.get("/profile")
def read_profile(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    db.commit()
    return {**ser_profile(prof), "completion": {"percent": profile_percent(prof), "steps": profile_steps(prof)}}


class ProfilePatch(BaseModel):
    nationality: str | None = Field(default=None, min_length=2, max_length=2)
    residence_country: str | None = Field(default=None, min_length=2, max_length=2)
    date_of_birth: date | None = None
    gender: str | None = None
    has_passport: bool | None = None
    passport_number: str | None = Field(default=None, max_length=20)
    passport_expiry: date | None = None
    target_degree: DegreeLevel | None = None
    target_intake_year: int | None = Field(default=None, ge=2025, le=2035)
    target_intake_term: IntakeTerm | None = None
    desired_fields: list[str] | None = None
    preferred_regions: list[str] | None = None
    preferred_university_ids: list[str] | None = None
    annual_budget_krw: int | None = Field(default=None, ge=0)
    needs_scholarship: bool | None = None
    housing_preference: str | None = Field(default=None, pattern="^(DORM|OFF_CAMPUS|NO_PREFERENCE)$")
    korean_self_level: str | None = None
    english_self_level: str | None = None
    previous_korean_visa: str | None = None
    current_korean_visa: str | None = None
    in_korea_now: bool | None = None
    financial_sponsor: str | None = None
    academic_priorities: list[str] | None = None
    career_goal: str | None = Field(default=None, max_length=2000)
    onboarding_step: int | None = None
    onboarding_completed: bool | None = None
    full_name: str | None = Field(default=None, max_length=200)
    preferred_name: str | None = Field(default=None, max_length=120)
    locale: str | None = Field(default=None, max_length=16)


@router.patch("/profile")
def update_profile(body: ProfilePatch, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    data = body.model_dump(exclude_unset=True)
    for k in ("full_name", "preferred_name", "locale"):
        if k in data:
            setattr(p.user, k, data.pop(k))
    if "passport_number" in data:
        # Only a masked form is kept; the full number stays on the passport document itself.
        prof.passport_number_masked = mask(data.pop("passport_number"), 3)
    completed = data.pop("onboarding_completed", None)
    for k in ("nationality", "residence_country"):
        if data.get(k):
            data[k] = data[k].upper()
    was_complete = profile_percent(prof) == 100
    for k, v in data.items():
        setattr(prof, k, v)
    if completed and not prof.onboarding_completed_at:
        prof.onboarding_completed_at = utcnow()
    db.flush()
    pct = profile_percent(prof)
    if pct == 100 and not was_complete:
        track(db, "profile_completed", user_id=p.id, nationality=prof.nationality)
        if prof.pipeline_stage in (PipelineStage.NEW_LEAD, PipelineStage.PROFILE_INCOMPLETE):
            prof.pipeline_stage = PipelineStage.QUALIFIED
    elif prof.pipeline_stage == PipelineStage.NEW_LEAD:
        prof.pipeline_stage = PipelineStage.PROFILE_INCOMPLETE
        track(db, "profile_started", user_id=p.id, nationality=prof.nationality)
    audit(db, action="profile.update", entity_type="student_profile", entity_id=prof.id, actor=p, subject_user_id=p.id,
          detail={"fields": sorted(body.model_dump(exclude_unset=True).keys())})
    if set(data) & {"nationality", "residence_country", "passport_expiry", "in_korea_now", "current_korean_visa"}:
        # V9 reliability: nationality-dependent document and visa tasks are recomputed now, not left from the old answer.
        generate_for_student(db, p.id)
    db.commit()
    db.refresh(prof)
    return {**ser_profile(prof), "completion": {"percent": pct, "steps": profile_steps(prof)}}


class EducationIn(BaseModel):
    level: str = Field(pattern="^(HIGH_SCHOOL|ASSOCIATE|BACHELOR|MASTER|DOCTORATE)$")
    # Optional so a student can confirm their level first (quick check → sign-up) and add the school later.
    institution: str = Field(default="", max_length=200)
    country: str = Field(min_length=2, max_length=2)
    major: str | None = None
    start_year: int | None = None
    graduation_year: int | None = None
    graduation_status: str = Field(default="GRADUATED", pattern="^(GRADUATED|EXPECTED|IN_PROGRESS)$")
    gpa_value: float | None = None
    gpa_scale_min: float | None = 0
    gpa_scale_max: float | None = None


def _apply_gpa(e: StudentEducation):
    if e.gpa_value is not None and e.gpa_scale_max:
        e.gpa_percent = normalize_gpa(e.gpa_value, e.gpa_scale_min or 0, e.gpa_scale_max)
    else:
        e.gpa_percent = None


@router.post("/educations", status_code=201)
def add_education(body: EducationIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    if body.gpa_value is not None and body.gpa_scale_max is not None and body.gpa_value > body.gpa_scale_max:
        raise HTTPException(422, "GPA cannot be higher than the scale maximum.")
    e = StudentEducation(profile_id=prof.id, **{**body.model_dump(), "country": body.country.upper()})
    _apply_gpa(e)
    db.add(e)
    db.commit()
    return {"id": str(e.id), "gpa_percent": e.gpa_percent}


@router.put("/educations/{edu_id}")
def update_education(edu_id: str, body: EducationIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    e = db.get(StudentEducation, parse_uuid(edu_id))
    if not e or e.profile_id != prof.id:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    e.country = body.country.upper()
    _apply_gpa(e)
    db.commit()
    return {"id": str(e.id), "gpa_percent": e.gpa_percent}


@router.delete("/educations/{edu_id}", status_code=204)
def delete_education(edu_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    e = db.get(StudentEducation, parse_uuid(edu_id))
    if e and e.profile_id == prof.id:
        db.delete(e)
        db.commit()


class LanguageIn(BaseModel):
    test: LanguageTest
    score: float = Field(ge=0, le=1000)
    test_date: date | None = None
    expires_on: date | None = None
    is_planned: bool = False


def _limits() -> dict:
    """Maximum score per test, from the shared V27 registry (IELTS here = the registry's IELTS_ACADEMIC)."""
    from app.services.fit import TESTS

    out = {LanguageTest.IELTS: 9.0, LanguageTest.DUOLINGO: 160.0}
    for code, d in TESTS.items():
        if code in LanguageTest.__members__:
            out[LanguageTest(code)] = float(d["max"])
    return out


LANG_LIMITS = _limits()


@router.post("/languages", status_code=201)
def add_language(body: LanguageIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    if body.test in LANG_LIMITS and body.score > LANG_LIMITS[body.test]:
        raise HTTPException(422, f"{body.test.value} scores go up to {LANG_LIMITS[body.test]:g}.")
    exp = body.expires_on
    if exp is None and body.test_date and body.test in (LanguageTest.TOPIK, LanguageTest.IELTS, LanguageTest.TOEFL_IBT):
        exp = date(body.test_date.year + 2, body.test_date.month, min(body.test_date.day, 28))  # 2-year validity
    lang = StudentLanguage(profile_id=prof.id, test=body.test, score=body.score, test_date=body.test_date, expires_on=exp, is_planned=body.is_planned)
    db.add(lang)
    db.commit()
    return {"id": str(lang.id)}


@router.delete("/languages/{lang_id}", status_code=204)
def delete_language(lang_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    l = db.get(StudentLanguage, parse_uuid(lang_id))
    if l and l.profile_id == prof.id:
        db.delete(l)
        db.commit()


# ---------------- matching ----------------

def compute_matches(db: Session, prof: StudentProfile, today: date) -> list[dict]:
    programs = db.scalars(select(Program).where(Program.is_active.is_(True)).options(
        selectinload(Program.requirements), selectinload(Program.intakes))).all()
    unis = {u.id: u for u in db.scalars(select(University))}
    schol = {}
    for s in db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))):
        schol.setdefault(s.university_id, []).append(s)
    dorms: dict = {}
    for d in db.scalars(select(Dormitory)):
        dorms.setdefault(d.university_id, []).append(d)
    dorm_unis = set(dorms)
    contracts = {c.university_id: c for c in db.scalars(select(PartnerContract).where(
        PartnerContract.status == ContractStatus.ACTIVE, PartnerContract.guarantee_enabled.is_(True),
        PartnerContract.start_date <= today, PartnerContract.end_date >= today)).all()}
    out = []
    for prog in programs:
        u = unis[prog.university_id]
        m = match_program(prof, prog, u, prog.intakes, schol.get(u.id, []) + schol.get(None, []), u.id in dorm_unis, today,
                          contracts.get(u.id)).dict()
        m["program"] = ser_program(prog, u)
        m["first_year_range_krw"] = first_year_range(prog, u, dorms.get(u.id, []))
        intake = next((i for i in prog.intakes if str(i.id) == m["intake_id"]), None)
        m["intake"] = ser_intake(intake) if intake else None
        out.append(m)
    tier_rank = {"STRONG": 0, "COMPETITIVE": 1, "REACH": 2, "NOT_ELIGIBLE": 3}
    out.sort(key=lambda m: (tier_rank[m["tier"]], -m["score"]))
    for i, m in enumerate(out):
        m["recommended"] = i < 3 and m["tier"] == "STRONG"
    return out


def _slim_match(m: dict) -> dict:
    """List payload: drop long prose the discovery list never shows (program description, university summary,
    source links and effective dates, the per-factor score breakdown) — the program page loads those itself."""
    drop = {"summary", "source_url", "effective_from", "effective_to"}

    def slim(d: dict | None) -> dict | None:
        return {k: v for k, v in d.items() if k not in drop} if d else d

    prog = slim(m["program"])
    prog.pop("description", None)
    prog["university"] = slim(prog.get("university"))
    prog["requirements"] = slim(prog.get("requirements"))
    # The score breakdown is explained once in "How matching works"; the per-row list only needs the reasons.
    return {**m, "program": prog, "intake": slim(m.get("intake")), "factors": []}


def routes_for(db: Session, prof: StudentProfile | None) -> dict | None:
    """V9 S1: the realistic routes when language blocks the student's target degree (same engine as the quick check)."""
    if not prof or not prof.nationality or not prof.target_degree:
        return None
    langs = [lng for lng in prof.languages if not lng.is_planned]
    pick = (max((x for x in langs if x.test == LanguageTest.TOPIK), key=lambda x: x.score, default=None)
            or max((x for x in langs if x.test == LanguageTest.IELTS), key=lambda x: x.score, default=None)
            or max((x for x in langs if x.test == LanguageTest.TOEFL_IBT), key=lambda x: x.score, default=None))
    return language_routes(db, prof.nationality, prof.target_degree, kind=pick.test.value if pick else "NONE",
                           level=float(pick.score) if pick else None, today=utcnow().date())


@router.get("/matches")
def matches(tier: list[str] | None = Query(None), degree: str | None = None, limit: int = Query(60, le=300),
            p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    res = compute_matches(db, prof, utcnow().date())
    if degree:
        res = [m for m in res if m["program"]["degree_level"] == degree]
    counts = {t: sum(1 for m in res if m["tier"] == t) for t in ("STRONG", "COMPETITIVE", "REACH", "NOT_ELIGIBLE")}
    if tier:
        res = [m for m in res if m["tier"] in tier]
    track(db, "match_generated", user_id=p.id, nationality=prof.nationality, properties={"engine": ENGINE_VERSION, **counts})
    db.commit()
    return {"engine_version": ENGINE_VERSION, "profile_percent": profile_percent(prof), "counts": counts, "items": [_slim_match(m) for m in res[:limit]],
            "routes": routes_for(db, prof),
            "methodology": "Rules-based. Stage 1 checks published hard requirements; Stage 2 ranks by named, weighted preference factors. No admission probability is estimated."}


@router.post("/matches/snapshot", status_code=201)
def snapshot_matches(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Persist the current explanation set (used for analytics and future model training with consent)."""
    prof = get_profile(db, p.id)
    now = utcnow()
    res = compute_matches(db, prof, now.date())
    for m in res[:30]:
        db.add(MatchSnapshot(user_id=p.id, program_id=uuid.UUID(m["program_id"]), engine_version=ENGINE_VERSION, eligible=m["eligible"],
                             tier=m["tier"], score=m["score"], reasons=m["reasons"], created_at=now))
    db.commit()
    return {"saved": min(30, len(res))}


# ---------------- dashboard ----------------

JOURNEY = ["EXPLORE", "PROFILE", "MATCH", "APPLY", "DECISION", "ENROLL", "VISA", "ARRIVAL", "STUDENT_LIFE"]


def journey_stage(prof: StudentProfile, apps: list[Application], visa: VisaCase | None, arrival: ArrivalPlan | None, enrolled: bool) -> str:
    if enrolled or (arrival and arrival.arrived_at):
        return "STUDENT_LIFE"
    if visa and visa.status == VisaStatus.ISSUED:
        return "ARRIVAL"
    if any(reached(a.status, S.ADMISSION_CERTIFICATE_ISSUED) for a in apps):
        return "VISA"
    # An offer in hand is admission: the student's work is now choosing and securing a place.
    if any(a.status == S.OFFERED or reached(a.status, S.OFFER_ACCEPTED) for a in apps):
        return "ENROLL"
    if any(reached(a.status, S.SUBMITTED) for a in apps):
        return "DECISION"
    if apps:
        return "APPLY"
    if profile_percent(prof) >= 70:
        return "MATCH"
    if prof.onboarding_step > 0 or prof.nationality:
        return "PROFILE"
    return "EXPLORE"


def profile_unlock(prof: StudentProfile, matches: list[dict]) -> dict | None:
    """The single most useful profile answer for an early student, with how many programs it affects (from their own matches)."""
    def count(code: str) -> int:
        return sum(1 for m in matches if any(r["code"] == code for r in m["reasons"]))

    has_lang = any(not lng.is_planned for lng in prof.languages)
    if not prof.educations and count("EDUCATION_UNKNOWN"):
        return {"section": "education", "count": count("EDUCATION_UNKNOWN"), "title": "Confirm your education to check your programs"}
    if not has_lang:
        blocked = sum(1 for m in matches if any(r["code"] in ("LANGUAGE_BELOW", "LANGUAGE_GAP_SMALL") for r in m["reasons"]))
        if blocked:
            return {"section": "language", "count": blocked, "title": "Add your language test result"}
    if count("GPA_UNKNOWN"):
        return {"section": "gpa", "count": count("GPA_UNKNOWN"), "title": "Add your grades to check academic minimums"}
    if prof.annual_budget_krw is None and matches:
        return {"section": "budget", "count": sum(1 for m in matches if m["eligible"]), "title": "Add your yearly budget to see what fits"}
    return None


@router.get("/dashboard")
def dashboard(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    now = utcnow()
    today = now.date()
    prof = get_profile(db, p.id)
    apps = db.scalars(select(Application).where(Application.student_user_id == p.id).order_by(Application.updated_at.desc())).all()
    visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == p.id).order_by(VisaCase.created_at.desc()))
    arrival = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == p.id))
    enrollment = db.scalar(select(StudentEnrollment).where(StudentEnrollment.student_user_id == p.id))
    tasks = db.scalars(select(Task).where(Task.student_user_id == p.id, Task.visible_to_student.is_(True),
                                          Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])).order_by(Task.due_at.asc().nulls_last())).all()
    assignment = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    pct = profile_percent(prof)
    stage = journey_stage(prof, apps, visa, arrival, enrollment is not None)

    # Readiness: profile + documents + essays for active applications (never an admission probability)
    active_apps = [a for a in apps if a.status not in TERMINAL]
    # V4: two applications at the same university must never read identically — name the program too.
    uni_count: dict = {}
    for a in active_apps:
        uni_count[a.university_id] = uni_count.get(a.university_id, 0) + 1
    app_label: dict = {}
    for a in active_apps:
        uname = db.get(University, a.university_id).name_en
        app_label[a.id] = f"{uname} · {db.get(Program, a.program_id).name_en}" if uni_count[a.university_id] > 1 else uname

    def task_app(t):
        """The application a task belongs to (essay tasks link to the essay, which knows its application)."""
        if t.application_id:
            return t.application_id
        if t.link and t.link.startswith("/essays/"):
            try:
                e = db.get(Essay, uuid.UUID(t.link.split("/")[2]))
            except (ValueError, IndexError):
                return None
            return e.application_id if e else None
        return None

    # A task that belongs to a withdrawn, rejected or finished application is no longer something to do.
    closed_ids = {a.id for a in apps if a.status in TERMINAL}
    tasks = [t for t in tasks if task_app(t) not in closed_ids]

    def with_program(title: str, params: dict | None, application_id) -> tuple[str, dict]:
        params = dict(params or {})
        if "program" in params:  # already names the program
            return title, params
        lbl = app_label.get(application_id)
        if lbl and " · " in lbl:
            uname = lbl.split(" · ")[0]
            if params.get("university") == uname:
                params["university"] = lbl
            if uname in title and lbl not in title:
                title = title.replace(uname, lbl, 1)
            elif lbl not in title:
                title = f"{title} · {lbl.split(' · ', 1)[1]}"
        return title, params

    readiness_parts = []
    missing_docs = []
    remaining_by_app: dict[str, int] = {}
    items_by_app: dict[str, list[dict]] = {}
    for a in active_apps[:5]:
        r, items = application_readiness(db, a, prof, today)
        a.readiness_percent = r
        readiness_parts.append(r)
        remaining_by_app[str(a.id)] = sum(1 for i in items if i["required"] and not i["ready"])
        items_by_app[str(a.id)] = items
        for i in items:
            if i["required"] and not i["ready"] and i["action_code"] not in (None, "IN_REVIEW"):
                missing_docs.append({**i, "application_id": str(a.id), "university": db.get(University, a.university_id).name_en})
    readiness = round(sum(readiness_parts) / len(readiness_parts)) if readiness_parts else round(pct * 0.4)
    seen = set()
    missing_docs = [m for m in missing_docs if not (m["category"] in seen or seen.add(m["category"]))]

    matches = compute_matches(db, prof, today) if prof.target_degree else []

    # Next best action (one primary CTA)
    unlock = profile_unlock(prof, matches) if (pct < 70 and not apps) else None
    if unlock:
        step = {"education": "education", "gpa": "education", "language": "language", "budget": "preferences"}[unlock["section"]]
        nxt = {"code": "PROFILE_UNLOCK", "title": unlock["title"], "link": f"/profile?edit={step}",
               "params": {"section": unlock["section"], "count": unlock["count"], "total": len(matches), "percent": pct}}
    elif pct < 70 and not apps:
        nxt = {"code": "COMPLETE_PROFILE", "title": "Finish your profile to see which universities fit you", "link": "/profile", "params": {"percent": pct}}
    elif not apps:
        nxt = {"code": "REVIEW_MATCHES", "title": "Review your university matches", "link": "/matches", "params": {}}
    elif len(offers := [a for a in apps if a.status == S.OFFERED]) > 1:
        # Several offers: the decision is a comparison, not a reply to whichever offer happens to be first.
        nxt = {"code": "COMPARE_OFFERS", "title": f"Compare your {len(offers)} offers and choose one", "link": "/applications", "params": {"count": len(offers)}}
    elif offers:
        uname = db.get(University, offers[0].university_id).name_en
        nxt = {"code": "RESPOND_OFFER", "title": f"Respond to your offer from {uname}", "link": f"/applications/{offers[0].id}", "params": {"university": uname}}
    elif tasks and (ws_next := _home_application_item(db, tasks[0], task_app(tasks[0]), items_by_app)):
        # V4: the most urgent open item of the application behind the earliest task — the same item the application
        # page leads with (fix before revise before legalize before upload before write), so both screens agree.
        ws_app, item = ws_next
        closes = db.get(ProgramIntake, ws_app.intake_id).application_deadline
        uni_label = app_label.get(ws_app.id, db.get(University, ws_app.university_id).name_en)
        titles = {"REQUEST": "Send your {label} to {u}", "FIX": "Fix your {label} for {u}", "REVISE_ESSAY": "Revise your {label} for {u}",
                  "LEGALIZE": "Get an apostille for your {label} for {u}", "RENEW": "Get a new {label} for {u}", "TOO_OLD": "Get a more recent {label} for {u}",
                  "UPLOAD": "Upload your {label} for {u}", "WRITE_ESSAY": "Write your {label} for {u}"}
        label = _mid_sentence(item["label"])
        nxt = {"code": "APPLICATION_ITEM", "title": titles[item["item"]].format(label=label, u=uni_label), "link": f"/applications/{ws_app.id}",
               "params": {"item": item["item"], "label": label, "university": uni_label, "application_id": str(ws_app.id),
                          "category": item.get("category"), "essay_type": item.get("essay_type"),  # V5 i18n: translatable label
                          "remaining": remaining_by_app.get(str(ws_app.id), 0), "due_at": iso(closes) if closes else iso(tasks[0].due_at)}}
    elif tasks and tasks[0].task_type.value in ("APPLICATION_DEADLINE", "APPLICATION_SUBMIT") and remaining_by_app.get(str(tasks[0].application_id), 0) > 0:
        # The deadline task says "submit", but submission is not possible while required items are missing: say "finish".
        t = tasks[0]
        app_ = db.get(Application, t.application_id)
        u = db.get(University, app_.university_id)
        # The intake's published closing date, so the hero agrees with "Coming up" (the task stores it as a UTC instant).
        closes = db.get(ProgramIntake, app_.intake_id).application_deadline
        nxt = {"code": "FINISH_APPLICATION", "title": f"Finish your {app_label.get(app_.id, u.name_en)} application", "link": f"/applications/{t.application_id}",
               "params": {"university": app_label.get(app_.id, u.name_en), "application_id": str(app_.id), "remaining": remaining_by_app[str(t.application_id)], "due_at": iso(closes) if closes else iso(t.due_at)}}
    elif tasks:
        t = tasks[0]
        t_app = task_app(t)
        t_title, t_params = with_program(t.title, t.title_params, t_app)
        t_key, t_detail = t.title_key, None
        if t.task_type.value == "VISA_STEP" and (t.title_key or "").startswith("task.visa."):
            # The step's recognisable name ("Bank balance certificate"), never the raw embassy rule sentence.
            pres = step_presentation(t.title_key.removeprefix("task.visa."), t.title)
            t_title, t_key = pres["name"], (f"student:v4.visaStep.{pres['name_key']}" if pres["name_key"] else None)
            t_detail = pres["rule"]
        nxt = {"code": "TASK", "title": t_title, "link": t.link or "/tasks", "params": {"due_at": iso(t.due_at), "task_id": str(t.id), "type": t.task_type.value, "title_key": t_key, "title_params": t_params, "detail": t_detail,
                                                                                  "application_id": str(t_app) if t_app else None}}
    elif stage == "ARRIVAL":
        nxt = {"code": "ARRIVAL_CHECKLIST", "title": "Prepare for your arrival in Korea", "link": "/arrival", "params": {}}
    else:
        nxt = {"code": "WAIT", "title": "You're all caught up — we'll notify you when something needs your attention", "link": "/applications", "params": {}}

    # Upcoming deadlines (applications, scholarships, tasks)
    deadlines = []
    for a in active_apps:
        intake = db.get(ProgramIntake, a.intake_id)
        u = db.get(University, a.university_id)
        if not reached(a.status, S.SUBMITTED) and intake.application_deadline >= today:
            prog = db.get(Program, a.program_id)
            deadlines.append({"kind": "APPLICATION", "title": f"{u.name_en} application closes — {prog.name_en}",
                              "title_key": "task.applicationCloses", "title_params": {"university": u.name_en, "university_id": str(u.id), "program": prog.name_en}, "date": iso(intake.application_deadline), "link": f"/applications/{a.id}",
                              "application_id": str(a.id), "application_label": app_label.get(a.id, u.name_en)})
        # An offer is secured by paying tuition, so the deadline matters from the offer on, not only after accepting.
        if a.status in (S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING) and (a.tuition_due or intake.tuition_deadline):
            deadlines.append({"kind": "TUITION", "title": f"Pay tuition for {u.name_en}", "title_key": "task.payTuition", "title_params": {"university": u.name_en, "university_id": str(u.id)},
                              "date": iso(a.tuition_due or intake.tuition_deadline), "link": f"/applications/{a.id}", "application_id": str(a.id),
                              "application_label": app_label.get(a.id, u.name_en)})
    for t in tasks:
        if t.due_at and t.task_type.value not in ("APPLICATION_DEADLINE", "TUITION_PAYMENT"):
            t_app = task_app(t)
            t_title, t_params = with_program(t.title, t.title_params, t_app)
            deadlines.append({"kind": t.task_type.value, "title": t_title, "title_key": t.title_key, "title_params": t_params, "date": iso(t.due_at.date()), "link": t.link,
                              "application_id": str(t_app) if t_app else None, "application_label": app_label.get(t_app) if t_app else None})
    deadlines.sort(key=lambda d: d["date"])

    counselor = None
    if assignment:
        org = db.get(Organization, assignment.organization_id)
        # V22 (REPORT §246 A3/A4): the student is served by the Hangyul team, never by a named individual. The real
        # case owner stays on the assignment row for the agency and the audit trail.
        counselor = {"organization": org.name, "organization_id": str(org.id), "counselor": team_identity(), "team": team_identity(),
                     "languages": org.languages or [], "since": iso(assignment.created_at)}

    conv_ids = [c for c in db.scalars(select(Conversation.id).where(Conversation.student_user_id == p.id))]
    unread = 0
    if conv_ids:
        reads = dict(db.execute(select(MessageRead.conversation_id, MessageRead.last_read_at).where(MessageRead.user_id == p.id)).all())
        for cid in conv_ids:
            q = select(func.count()).select_from(Message).where(Message.conversation_id == cid, Message.visibility == MessageVisibility.PARTICIPANTS,
                                                                  Message.author_user_id != p.id)
            if reads.get(cid):
                q = q.where(Message.created_at > reads[cid])
            unread += db.scalar(q) or 0

    schol = db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))).all()
    eligible_sch = [s for s in schol if scholarship_eligibility(s, prof)["status"] == "ELIGIBLE"]
    possible_sch = [s for s in schol if scholarship_eligibility(s, prof)["status"] == "POSSIBLE"]

    # Recommendations: programs whose published requirements are met; if none yet, the closest ones with their exact gap.
    strong = [m for m in matches if m["tier"] in ("STRONG", "COMPETITIVE")]
    close = [m for m in matches if m["tier"] == "REACH"]
    recs, recs_kind = (strong[:3], "STRONG") if strong else (close[:3], "POSSIBLE") if close else ([], "NONE")
    doc_counts = dict(db.execute(select(Document.status, func.count()).where(Document.owner_user_id == p.id).group_by(Document.status)).all())

    cost = None
    target = next((a for a in active_apps), None)
    if target:
        prog = db.get(Program, target.program_id)
        u = db.get(University, target.university_id)
        if prog.tuition_per_semester_krw and not withheld(prog):
            cost = {"tuition_year_krw": prog.tuition_per_semester_krw * 2, "living_year_krw": (u.est_living_cost_monthly_krw or 0) * 12,
                    "application_fee_krw": prog.application_fee_krw, "basis": f"{u.name_en} — {prog.name_en}", "is_estimate": True,
                    "verification_status": prog.verification_status}
    # ---- V5: one journey. The home changes with the student's stage: after the visa, arrival and settlement lead;
    # a READY application leads with its guided submission; otherwise the V4 next step stands.
    concierge_stage = concierge_svc.home_stage(db, p.id)
    improve = strategy_svc.today_for_student(db, p.id, limit=3) if stage not in ("VISA", "ARRIVAL", "STUDENT_LIFE") else []
    if concierge_stage and concierge_stage["stage"] in ("READY_TO_COME", "ARRIVED") and concierge_stage["next"]:
        n = concierge_stage["next"]
        nxt = {"code": "CONCIERGE", "title": n["key"], "link": n["link"], "params": {"title_key": n["title_key"], "stage": concierge_stage["stage"],
                                                                               "done": concierge_stage["done"], "total": concierge_stage["total"]}}
    elif (visa_step := visa_routes_svc.home_step(db, p.id)) is not None:
        # Visa preparation: the resolved route's single next step (the requirement name, never the raw embassy rule).
        nxt = {"code": "VISA_STEP", "title": visa_step["key"], "link": visa_step["link"],
               "params": {**visa_step["params"], "title_key": visa_step["title_key"], "status_key": visa_step["status_key"], "who": visa_step["who"]}}
    elif improve and improve[0]["code"] in ("SUBMISSION_AUTHORIZE", "SUBMISSION_HANDOFF", "SUBMISSION_CONFIRM") and nxt["code"] not in ("COMPARE_OFFERS", "RESPOND_OFFER"):
        h = improve.pop(0)
        nxt = {"code": h["code"], "title": h["title"], "link": h["action"]["link"] if h.get("action") else f"/applications/{h['application_id']}",
               "params": {**h.get("params", {}), "application_id": h["application_id"], "due_at": h.get("deadline")}}
    elif improve and nxt["code"] == "APPLICATION_ITEM":
        # The hero already names the most urgent item; don't list it twice.
        improve = [i for i in improve if i.get("application_id") != nxt["params"].get("application_id") or i["severity"] != "blocker"][:3]
    refund_case = money_svc.ensure_refund_case(db, p.id)  # V9 S8: opened once, when a refund trigger exists
    db.commit()
    return {
        "concierge": concierge_stage,
        "improve": improve,
        "dossier": dossier_svc.home_items(db, p.id),
        "greeting_name": p.user.preferred_name or p.user.full_name.split(" ")[0],
        "journey": {"stage": stage, "stages": JOURNEY},
        "profile": {"percent": pct, "steps": profile_steps(prof), "onboarding_completed": prof.onboarding_completed_at is not None},
        "readiness": {"percent": readiness, "basis": "profile 20% · required documents verified 60% · essays approved 20% (per active application)", "applications": len(readiness_parts)},
        "next_action": nxt,
        "deadlines": deadlines[:8],
        "recommendations": recs,
        "recommendations_kind": recs_kind,
        "applications": [ser_application(a, db, include_student=False) for a in apps[:6]],
        "missing_documents": missing_docs[:6],
        "document_counts": {k.value: v for k, v in doc_counts.items()},
        "counselor": counselor,
        "unread_messages": unread,
        "scholarships": {"eligible": len(eligible_sch), "possible": len(possible_sch),
                         "top": [{"id": str(s.id), "name": s.name, "kind": s.kind.value, "coverage": s.coverage} for s in (eligible_sch + possible_sch)[:3]]},
        "visa": {"status": visa.status.value, "visa_type": visa.visa_type.value, "id": str(visa.id)} if visa else None,
        "arrival": {"arrival_at": iso(arrival.arrival_at), "completed": len(arrival.completed_items or []), "arrived": arrival.arrived_at is not None} if arrival else None,
        "cost_estimate": cost,
        "open_tasks": len(tasks),
        # V9 S1: early home — the realistic routes when language blocks the target degree (None otherwise).
        "routes": routes_for(db, prof) if not apps else None,
        # V9 S8: an open tuition refund case (visa refused / withdrawn after tuition), with elapsed days.
        "refund": money_svc.refund_summary(db, p.id) if refund_case is not None else None,
    }


# ---------------- services & orders ----------------

@router.get("/services", tags=["services"])
def services(db: Session = Depends(get_db), p: Principal = Depends(require_student)):
    """The three plans, plus — if this student has bought one — what it promises and what is left.

    V15: ``country`` is gone as a parameter. There is one approved retail price per plan (business plan §3),
    so resolving a price by residence would be answering a question the business no longer asks, and a VND
    row would let the homepage and this screen disagree.
    """
    out = []
    for prod in db.scalars(select(ServiceProduct).where(ServiceProduct.is_active.is_(True)).order_by(ServiceProduct.sort_order)
                           .options(selectinload(ServiceProduct.prices))):
        today = utcnow().date()
        valid = [pr for pr in prod.prices if (pr.valid_from is None or pr.valid_from <= today) and (pr.valid_to is None or pr.valid_to >= today)]
        price = next((pr for pr in valid if pr.country_code is None), None) or (valid[0] if valid else None)
        out.append({"code": prod.code, "name_key": prod.name_key, "name_en": prod.name_en, "name_ko": prod.name_ko,
                    "tagline_en": prod.tagline_en, "features": prod.features,
                    "entitlements": prod.entitlements or {}, "recommended": prod.is_recommended,
                    "price": {"id": str(price.id), "currency": price.currency, "amount_minor": price.amount_minor, "is_demo": price.is_demo} if price else None})
    # Payment recovery before anything is rendered (brief Part 17). If a payment succeeded at the provider
    # and the browser never came back, this is where the product finds out — not the student, by being asked
    # to pay a second time.
    reconcile_pending_orders(db, p.id)
    # Every plan with a PAID plan order (an upgrade keeps the lower one in the history); add-on orders are not plans.
    owned = {code for (code,) in db.execute(select(ServiceProduct.code).join(Order, Order.product_id == ServiceProduct.id)
                                            .where(Order.user_id == p.id, Order.status == OrderStatus.PAID, Order.kind != "ADD_ON"))}
    pending = db.scalar(select(Order).where(Order.user_id == p.id, Order.status == OrderStatus.PENDING, Order.kind != "ADD_ON")
                        .order_by(Order.created_at.desc()))
    history = db.execute(select(Order, ServiceProduct).join(ServiceProduct, ServiceProduct.id == Order.product_id)
                         .where(Order.user_id == p.id, Order.status.in_([OrderStatus.PAID, OrderStatus.FAILED]))
                         .order_by(Order.created_at.desc()).limit(10)).all()
    return {
        "products": out,
        "owned": sorted(owned),
        "plan": (plan := entitlements_svc.student_plan(db, p.id)),
        # V26 (REPORT §334 S3): what each included service is doing now — items, who acts, what is next, when.
        "now": services_now.lines(db, p.id, plan),
        "payment": {"provider": get_settings().payment_provider, "pending_order_id": str(pending.id) if pending else None},
        # Compact, inside this screen — not a new top-level destination (brief Part 24).
        # V29: a receipt shows what was bought *then* — the order's own snapshot, never today's catalogue.
        "history": [{"id": str(o.id), "kind": o.kind,
                     "product_name": (o.plan_snapshot or {}).get("name_en") or prod.name_en,
                     "product_code": (o.plan_snapshot or {}).get("code") or prod.code, "status": o.status.value,
                     "amount_minor": o.amount_minor, "currency": o.currency, "catalog_version": o.catalog_version,
                     "at": iso(o.paid_at or o.created_at)} for o, prod in history],
        "catalog": entitlements_svc.manifest()["catalog"],
        "upgrade_policy": entitlements_svc.manifest().get("upgrade_policy"),
    }


@router.get("/plan", tags=["services"])
def my_plan(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """What I bought, what is included, how much of each allowance is left (REPORT §117).

    ``None`` is a legitimate answer and not an error: the product deliberately lets someone explore, save
    and start a profile before buying anything.
    """
    return entitlements_svc.student_plan(db, p.id)


class CheckoutIn(BaseModel):
    product_code: str
    #: V22 (REPORT §245 L5): the version of the purchase summary / refund article the buyer saw. Recorded as a
    #: PURCHASE_TERMS consent with the order; refused when it is not the current version (the screen is stale).
    purchase_terms_version: str | None = None


def _plan_price(prod: ServiceProduct):
    """The plan's one approved price.

    One approved price per plan (business plan §3) — no regional resolution, so the amount a student is
    charged is provably the amount the homepage showed them.
    """
    return next((pr for pr in prod.prices if pr.country_code is None), None) or (prod.prices[0] if prod.prices else None)


@router.post("/orders", tags=["services"], status_code=201)
def checkout(body: CheckoutIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == body.product_code, ServiceProduct.is_active.is_(True)))
    if not prod:
        raise HTTPException(404, "Service not found")
    from app.core import legal as legal_cfg

    if body.purchase_terms_version is not None and body.purchase_terms_version != legal_cfg.PURCHASE_TERMS_VERSION:
        raise HTTPException(409, {"code": "PURCHASE_TERMS_STALE", "message": "The terms shown are out of date. Reload and try again."})
    prof = get_profile(db, p.id)
    price = _plan_price(prod)
    if price is None:
        raise HTTPException(409, "This service has no price configured for your region.")
    # V29 (brief §18): a student who already holds a plan cannot be charged for another one by this route. Buying the
    # same plan twice is refused, and an upgrade has no approved price rule — charging the list price or the difference
    # would both be a commercial decision taken in code. The UI offers a conversation with the team instead.
    current = entitlements_svc.active_engagement(db, p.id)
    if current is not None:
        if current.product_code == prod.code:
            raise HTTPException(409, {"code": "PLAN_ALREADY_ACTIVE", "message": "This plan is already active on your account."})
        cur_order = next((pl["sort_order"] for pl in entitlements_svc.plan_defs() if pl["code"] == current.product_code), -1)
        if prod.sort_order <= cur_order:
            raise HTTPException(409, {"code": "NOT_AN_UPGRADE", "current": current.product_code,
                                      "message": f"{current.product_code} is already active; {prod.code} is not an upgrade on it."})
        policy = entitlements_svc.manifest().get("upgrade_policy") or {}
        if policy.get("status") != "APPROVED":
            track(db, "upgrade_started", user_id=p.id, properties={"from": current.product_code, "to": prod.code, "priced": False})
            db.commit()
            raise HTTPException(409, {"code": "UPGRADE_POLICY_REQUIRED", "current": current.product_code, "target": prod.code,
                                      "message": "Upgrade pricing has not been set yet. The Hangyul Univ team will arrange it with you."})
    # The gate runs **before** an order exists: a refusal that still leaves a PENDING order behind is not a
    # refusal, it is a row for the reconciler to find later. With Toss, an order can only ever be paid on the
    # billing-key rail, on a merchant that settles the order's own currency — there is no conversion and no
    # ordinary-payment fallback — so if no payment method could pay it, it is not created.
    settings = get_settings()
    if settings.payment_provider == "toss":
        from app.services import billing as billing_svc

        if not billing_svc.available_kinds(currency=price.currency):
            reasons = {k: billing_svc.availability(k, currency=price.currency).reason for k in billing_svc.METHOD_KINDS}
            audit(db, action="order.payment_unavailable", entity_type="service_product", entity_id=prod.id, actor=p,
                  subject_user_id=p.id, detail={"currency": price.currency, "reasons": reasons})
            db.commit()
            raise HTTPException(503, detail={
                "code": "PAYMENT_UNAVAILABLE",
                "currency": price.currency,
                "message": "Payment is not available yet. You have not been charged.",
            })
    plan = entitlements_svc.plan_def(prod.code)
    order = Order(user_id=p.id, product_id=prod.id, price_id=price.id, currency=price.currency, amount_minor=price.amount_minor,
                  kind="PLAN", catalog_version=entitlements_svc.catalog_version(),
                  plan_snapshot=entitlements_svc.snapshot(plan, amount_minor=price.amount_minor, currency=price.currency) if plan else None,
                  purchase_terms_version=body.purchase_terms_version or legal_cfg.PURCHASE_TERMS_VERSION)
    db.add(order)
    db.flush()
    if body.purchase_terms_version:
        # V22: the buyer saw plan · price · one-time · included service · service-start condition · refund link; record which
        # version, in which language, from where (REPORT §245 L5; 전자상거래법 제13조/제17조⑥ pre-contract notice).
        db.add(ConsentRecord(user_id=p.id, purpose="PURCHASE_TERMS", version=body.purchase_terms_version, granted=True, created_at=utcnow(),
                             scope_org_id=None, locale=p.user.locale, document_version=body.purchase_terms_version, source="CHECKOUT",
                             ip_hash=hashlib.sha256((p.ip or "unknown").encode()).hexdigest()[:32], user_agent=None))
    track(db, "service_checkout_started", user_id=p.id, properties={"product": prod.code, "purchase_terms_version": body.purchase_terms_version})
    track(db, "checkout_started", user_id=p.id, properties={"plan": prod.code, "catalog_version": order.catalog_version})
    try:
        session = get_provider().create_checkout(order_id=str(order.id), amount_minor=price.amount_minor,
                                                 currency=price.currency, description=prod.name_en)
    except NotConfigured as exc:
        raise HTTPException(503, str(exc))
    if session.provider != "toss":
        # The billing-key rail records one Payment row per *charge attempt*; an order that has not been charged has none.
        db.add(Payment(order_id=order.id, provider=session.provider, provider_ref=session.provider_ref, status=session.status,
                       amount_minor=price.amount_minor, currency=price.currency, raw={"demo": session.provider == "demo"}))
    assignment = None
    if session.status == "PAID":
        assignment = activate_paid_order(db, order, prod, prof, p.user, provider=session.provider)
        order.payment_state = "PAID"
    audit(db, action="order.create", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id, detail={"product": prod.code, "status": order.status.value})
    db.commit()
    # Nothing that can start a payment crosses to the browser here — no client key, no status it could act on.
    # The amount and currency are the **server's**: the browser displays them and the pay endpoint refuses a
    # confirmation that does not echo exactly these numbers.
    if session.provider == "toss":
        from app.api.v1 import billing as billing_api

        billing_api.settle_initial_state(db, order)
        db.commit()
    return {"order_id": str(order.id), "status": order.status.value, "payment_state": order.payment_state,
            "provider": session.provider, "redirect_url": session.redirect_url,
            "is_demo_payment": session.provider == "demo", "assignment": assignment,
            "amount_minor": order.amount_minor, "currency": order.currency,
            "product_code": prod.code, "product_name": prod.name_en, "one_time": True}


def activate_paid_order(db: Session, order: Order, prod: ServiceProduct, prof: StudentProfile, user: User, *, provider: str) -> dict | None:
    """Everything a PAID order switches on — exactly once. V9 reliability: shared by the synchronous checkout and the
    (possibly delayed) provider callback; a second call for an order already PAID does nothing."""
    if order.status == OrderStatus.PAID:
        return None
    assignment = None
    order.status, order.paid_at = OrderStatus.PAID, utcnow()
    if order.kind == "ADD_ON":
        # V29: a paid extra switches on its allowance or opens its service case — nothing about the plan changes.
        from app.services import addons as addons_svc

        addons_svc.activate(db, order)
        return None
    track(db, "service_purchased", user_id=user.id, properties={"product": prod.code, "provider": provider})
    track(db, "plan_purchased", user_id=user.id, properties={"plan": prod.code, "catalog_version": order.catalog_version, "kind": order.kind})
    # V29: the service instance this order buys, frozen from the order's snapshot (never the live catalogue row).
    eng = entitlements_svc.start_engagement(db, order, prod)
    from app.services import plan_operations

    plan_operations.on_engagement_started(db, eng)
    if prof.pipeline_stage in (PipelineStage.NEW_LEAD, PipelineStage.PROFILE_INCOMPLETE, PipelineStage.QUALIFIED):
        prof.pipeline_stage = PipelineStage.SERVICE_PURCHASED
    if prod.includes_agency_assignment:
        # The service includes a partner-agency counselor: record the student's consent to share their file with that agency.
        db.add(ConsentRecord(user_id=user.id, purpose="SHARE_WITH_AGENCY", version="2026-09", granted=True, created_at=utcnow()))
        existing = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == user.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if not existing:
            try:
                a = assignment_svc.assign(db, user.id, order_id=order.id)
                prof.pipeline_stage = PipelineStage.ASSIGNED
                for app in db.scalars(select(Application).where(Application.student_user_id == user.id, Application.agency_org_id.is_(None))):
                    app.agency_org_id = a.organization_id
                org = db.get(Organization, a.organization_id)
                track(db, "agency_assigned", user_id=user.id, organization_id=a.organization_id)
                notify(db, user.id, "AGENCY_ASSIGNED", "notify.agencyAssigned", f"{org.name} is now supporting your application.", params={"agency": org.name}, link="/messages")
                if a.counselor_user_id:
                    notify(db, a.counselor_user_id, "NEW_STUDENT", "notify.newStudent", f"New student assigned: {user.full_name}", params={"student": user.full_name}, link=f"/students/{user.id}")
                _ensure_support_conversation(db, user, a)
                assignment = {"organization": org.name, "organization_id": str(org.id)}
            except ValueError:
                pass
    generate_for_student(db, user.id)
    return assignment


payments_router = APIRouter(prefix="/payments", tags=["services"])


class PaymentCallbackIn(BaseModel):
    provider_ref: str = Field(min_length=3, max_length=120)
    payload: dict | None = None


@payments_router.post("/callback/{provider}")
def payment_callback(provider: str, body: PaymentCallbackIn, db: Session = Depends(get_db)):
    """V9 reliability: the provider's (possibly late) confirmation. The payment is re-verified with the provider — the
    callback body itself is never trusted — and the order is activated exactly once (repeats are no-ops). Until it
    arrives the order stays PENDING and nothing is switched on. Unconfigured providers answer 503."""
    pay = db.scalar(select(Payment).where(Payment.provider == provider, Payment.provider_ref == body.provider_ref))
    if pay is None:
        raise HTTPException(404, "Unknown payment.")
    try:
        prov = get_provider()
        if prov.name != provider:
            raise HTTPException(409, "This provider is not the one configured here.")
        status_ = prov.verify(body.provider_ref, body.payload)
    except NotConfigured as exc:
        raise HTTPException(503, str(exc)) from None
    order = db.get(Order, pay.order_id)
    already = order.status == OrderStatus.PAID
    if status_ == "PAID" and not already:
        pay.status = "PAID"
        prod = db.get(ServiceProduct, order.product_id)
        user = db.get(User, order.user_id)
        activate_paid_order(db, order, prod, get_profile(db, user.id), user, provider=provider)
        audit(db, action="order.paid_callback", entity_type="order", entity_id=order.id, actor=None, subject_user_id=user.id, detail={"provider": provider})
    elif status_ in ("FAILED", "CANCELLED") and order.status == OrderStatus.PENDING:
        pay.status = status_
        order.status = OrderStatus.FAILED if status_ == "FAILED" else OrderStatus.CANCELLED
    db.commit()
    return {"order_id": str(order.id), "status": order.status.value, "duplicate": already}


def _ensure_support_conversation(db: Session, p, a: AgencyAssignment):
    from app.models import ConversationParticipant
    from app.models.enums import ConversationKind

    conv = db.scalar(select(Conversation).where(Conversation.student_user_id == p.id, Conversation.kind == ConversationKind.STUDENT_SUPPORT))
    if conv is None:
        conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject="Your study-in-Korea team", student_user_id=p.id, last_message_at=utcnow())
        db.add(conv)
        db.flush()
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=p.id))
    if not any(pt.organization_id == a.organization_id for pt in conv.participants):
        db.add(ConversationParticipant(conversation_id=conv.id, organization_id=a.organization_id))
    db.add(Message(conversation_id=conv.id, author_user_id=a.counselor_user_id, body="Hello from the Hangyul Univ team! We'll review your profile and documents and reply within one business day.",
                   created_at=utcnow()))


# ---------------- order payloads shared with the billing-key rail (app/api/v1/billing.py) ----------------


def _order_payload(db: Session, order: Order, prod: ServiceProduct) -> dict:
    pay = (db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.status == "PAID").order_by(Payment.created_at.desc()))
           or db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc())))
    raw = pay.raw if pay is not None and isinstance(pay.raw, dict) else {}
    return {
        "order_id": str(order.id),
        "status": order.status.value,
        "product_code": prod.code,
        "product_name": prod.name_en,
        "kind": order.kind,
        "add_on_code": (order.plan_snapshot or {}).get("code") if order.kind == "ADD_ON" else None,
        "amount_minor": order.amount_minor,
        "currency": order.currency,
        "paid_at": iso(order.paid_at),
        "payment_state": order.payment_state,
        "one_time": True,
        "method": raw.get("method"),
        "receipt_url": raw.get("receiptUrl"),
        "refunded_amount_minor": order.refund_amount_minor or 0,
    }


@router.post("/orders/{order_id}/cancel", tags=["services"])
def cancel_order(order_id: uuid.UUID, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student closed the payment window. Nothing was charged; the order simply stops being open.

    It is **not** an error and it is not destructive: the plan they chose is still the plan they chose, and
    the next attempt creates a fresh order with a fresh id, because a Toss order id may only be used once.
    """
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.user_id != p.id:
        raise HTTPException(404, "Order not found.")
    if order.status == OrderStatus.PENDING:
        if order.payment_state == "CHARGING":
            # A charge is in flight and may yet succeed: cancelling now could leave a paid, cancelled order.
            raise HTTPException(409, detail={"code": "PAYMENT_IN_PROGRESS", "message": "A payment for this order is being processed."})
        order.status, order.payment_state = OrderStatus.CANCELLED, "CANCELLED"
        pay = db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc()))
        if pay is not None and pay.status == "PENDING":
            pay.status = "CANCELLED"
        db.commit()
    prod = db.get(ServiceProduct, order.product_id)
    return _order_payload(db, order, prod)


def reconcile_pending_orders(db: Session, user_id) -> bool:
    """Ask the provider what really happened to any order whose charge outcome is unknown here."""
    from app.api.v1 import billing as billing_api

    return billing_api.reconcile_user_orders(db, user_id)


@router.get("/orders", tags=["services"])
def my_orders(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.execute(select(Order, ServiceProduct).join(ServiceProduct, ServiceProduct.id == Order.product_id).where(Order.user_id == p.id).order_by(Order.created_at.desc())).all()
    return [{"id": str(o.id), "product_code": prod.code, "product_name": prod.name_en, "status": o.status.value, "amount_minor": o.amount_minor,
             "currency": o.currency, "paid_at": iso(o.paid_at), "created_at": iso(o.created_at)} for o, prod in rows]


# ---------------- housing / arrival / lifecycle ----------------

HOUSING_CHECKLIST = ["compare_options", "check_dorm_eligibility", "submit_dorm_application", "pay_deposit", "review_contract", "confirm_move_in"]
ARRIVAL_CHECKLIST = [
    "flight_booked", "airport_pickup", "housing_confirmed", "orientation_registered", "sim_esim", "transport_card",
    "bank_account", "residence_card_application", "health_insurance", "campus_registration", "emergency_contacts",
]


class HousingIn(BaseModel):
    status: str | None = None
    preference: str | None = None
    budget_monthly_krw: int | None = None
    room_preference: str | None = None
    max_commute_minutes: int | None = None
    dormitory_id: str | None = None
    completed_items: list[str] | None = None
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/housing")
def housing(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == p.id))
    app = db.scalar(select(Application).where(Application.student_user_id == p.id, Application.status.not_in(list(TERMINAL - {S.ENROLLED})))
                    .order_by(Application.updated_at.desc()))
    uni = db.get(University, h.university_id if h and h.university_id else app.university_id) if (h and h.university_id) or app else None
    dorms = db.scalars(select(Dormitory).where(Dormitory.university_id == uni.id)).all() if uni else []
    from app.services import concierge as concierge_svc  # V5: options, profile, dorm facts, listings, cases, move-in

    return {**concierge_svc.housing_view(db, p.id, uni),
        "case": {"status": h.status.value, "preference": h.preference, "budget_monthly_krw": h.budget_monthly_krw, "room_preference": h.room_preference,
                 "max_commute_minutes": h.max_commute_minutes, "dormitory_id": str(h.dormitory_id) if h.dormitory_id else None,
                 "application_deadline": iso(h.application_deadline), "completed_items": h.completed_items or [], "notes": h.notes} if h else None,
        "checklist": HOUSING_CHECKLIST,
        "university": {"id": str(uni.id), "name_en": uni.name_en, "slug": uni.slug, "est_living_cost_monthly_krw": uni.est_living_cost_monthly_krw} if uni else None,
        "dormitories": [concierge_svc.ser_dorm(d) for d in dorms],
        "off_campus_note": "Hangyul does not invent listings: you see only rooms a provider has given us, each labelled. Your counselor can review a contract with you before you sign.",
    }


@router.put("/housing")
def update_housing(body: HousingIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    from app.models.enums import HousingStatus

    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == p.id))
    if h is None:
        h = HousingCase(student_user_id=p.id)
        db.add(h)
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        h.status = HousingStatus(data.pop("status"))
    if "dormitory_id" in data:
        did = data.pop("dormitory_id")
        h.dormitory_id = parse_uuid(did) if did else None
        if h.dormitory_id:
            h.university_id = db.get(Dormitory, h.dormitory_id).university_id
    if "completed_items" in data:
        data["completed_items"] = [i for i in data["completed_items"] if i in HOUSING_CHECKLIST]
    for k, v in data.items():
        setattr(h, k, v)
    db.commit()
    return {"ok": True, "status": h.status.value}


class ArrivalIn(BaseModel):
    flight_number: str | None = Field(default=None, max_length=20)
    arrival_airport: str | None = Field(default=None, max_length=8)
    arrival_at: datetime | None = None
    pickup_requested: bool | None = None
    completed_items: list[str] | None = None
    arrived: bool | None = None


@router.get("/arrival")
def arrival(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    a = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == p.id))
    return {
        "plan": {"flight_number": a.flight_number, "arrival_airport": a.arrival_airport, "arrival_at": iso(a.arrival_at), "pickup_requested": a.pickup_requested,
                 "pickup_status": a.pickup_status, "completed_items": a.completed_items or [], "arrived_at": iso(a.arrived_at),
                 "residence_card_due": iso(a.residence_card_due)} if a else None,
        "checklist": ARRIVAL_CHECKLIST,
        "notes": {
            "residence_card": "Register for a residence card (alien registration) within 90 days of entry — book via HiKorea.",
            "health_insurance": "International students are enrolled in National Health Insurance; check your NHIS notice and pay monthly.",
        },
        "sources": ["hikorea-residence", "nhis-foreigners"],
    }


@router.put("/arrival")
def update_arrival(body: ArrivalIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    a = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == p.id))
    if a is None:
        a = ArrivalPlan(student_user_id=p.id, completed_items=[])
        db.add(a)
    data = body.model_dump(exclude_unset=True)
    arrived = data.pop("arrived", None)
    if "completed_items" in data:
        data["completed_items"] = [i for i in data["completed_items"] if i in ARRIVAL_CHECKLIST]
    # V5: an airport pickup is a service case (POST /me/pickup) — the old boolean is no longer written from here.
    data.pop("pickup_requested", None)
    for k, v in data.items():
        setattr(a, k, v)
    if arrived and not a.arrived_at:
        # V5: one arrival rule (also used when a pickup completes) — opens the residence-card case and task.
        from app.services import concierge as concierge_svc

        db.flush()
        concierge_svc.mark_arrived(db, p.id)
    db.commit()
    return {"ok": True}


@router.get("/enrollment")
def my_enrollment(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    e = db.scalar(select(StudentEnrollment).where(StudentEnrollment.student_user_id == p.id))
    if not e:
        return None
    u = db.get(University, e.university_id)
    return {"university": u.name_en, "university_id": str(u.id), "cohort": e.cohort_label, "status": e.status.value, "enrolled_on": iso(e.enrolled_on),
            "expected_graduation": iso(e.expected_graduation), "visa_expires_on": iso(e.visa_expires_on)}


# ---------------- privacy ----------------

@router.get("/consents")
def consents(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.scalars(select(ConsentRecord).where(ConsentRecord.user_id == p.id).order_by(ConsentRecord.created_at.desc())).all()
    latest: dict[str, ConsentRecord] = {}
    for r in rows:
        latest.setdefault(r.purpose, r)
    return [{"purpose": r.purpose, "granted": r.granted, "version": r.version, "at": iso(r.created_at)} for r in latest.values()]


class ConsentIn(BaseModel):
    purpose: str = Field(pattern="^(SHARE_WITH_AGENCY|SHARE_WITH_UNIVERSITY|MARKETING|CROSS_BORDER_TRANSFER|OUTCOME_RESEARCH)$")
    granted: bool


@router.post("/consents", status_code=201)
def set_consent(body: ConsentIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    db.add(ConsentRecord(user_id=p.id, purpose=body.purpose, version="2026-09", granted=body.granted, created_at=utcnow()))
    audit(db, action="consent.set", entity_type="consent", entity_id=body.purpose, actor=p, subject_user_id=p.id, detail={"granted": body.granted})
    db.commit()
    return {"ok": True}


class DataRequestIn(BaseModel):
    kind: str = Field(pattern="^(DELETE|EXPORT)$")
    note: str | None = Field(default=None, max_length=1000)


@router.post("/data-requests", status_code=201)
def data_request(body: DataRequestIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):

    r = DataRequest(user_id=p.id, kind=body.kind, note=body.note, due_at=utcnow() + timedelta(days=10))
    if body.kind == "DELETE":
        p.user.deletion_requested_at = utcnow()
    db.add(r)
    audit(db, action=f"data_request.{body.kind.lower()}", entity_type="data_request", actor=p, subject_user_id=p.id)
    db.commit()
    return {"id": str(r.id), "status": r.status, "due_at": iso(r.due_at)}


@router.get("/data-requests")
def list_data_requests(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    return [{"id": str(r.id), "kind": r.kind, "status": r.status, "created_at": iso(r.created_at), "due_at": iso(r.due_at)}
            for r in db.scalars(select(DataRequest).where(DataRequest.user_id == p.id).order_by(DataRequest.created_at.desc()))]


@router.get("/assignment")
def my_assignment(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    if not a:
        return None
    org = db.get(Organization, a.organization_id)
    return {"organization": org.name, "organization_id": str(org.id), "counselor": team_identity(), "team": team_identity(),
            "languages": org.languages or [], "since": iso(a.created_at), "assigned_by": a.assigned_by}


@router.get("/appointments")
def my_appointments(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    from app.models import Appointment

    rows = db.scalars(select(Appointment).where(Appointment.student_user_id == p.id).order_by(Appointment.starts_at)).all()
    return [{"id": str(a.id), "kind": a.kind, "starts_at": iso(a.starts_at), "duration_minutes": a.duration_minutes, "channel": a.channel,
             "status": a.status, "notes": a.notes, "host": team_identity() if a.host_user_id else None} for a in rows]


# ---------------- support tickets ----------------

class TicketIn(BaseModel):
    category: str = Field(pattern="^(VISA|HOUSING|ACADEMIC|HEALTH|FINANCE|OTHER)$")
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=8000)


@router.get("/support-tickets")
def my_tickets(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    from app.models import SupportTicket

    # A ticket opens a support conversation with the same subject; link each ticket to it so the student can reply there.
    convs = {c.subject: c.id for c in db.scalars(select(Conversation).where(Conversation.student_user_id == p.id).order_by(Conversation.created_at.asc()))}
    return [{"id": str(t.id), "category": t.category, "subject": t.subject, "status": t.status.value, "priority": t.priority, "created_at": iso(t.created_at),
             "conversation_id": str(convs[f"[{t.category}] {t.subject}"]) if f"[{t.category}] {t.subject}" in convs else None}
            for t in db.scalars(select(SupportTicket).where(SupportTicket.student_user_id == p.id).order_by(SupportTicket.created_at.desc()))]


@router.post("/support-tickets", status_code=201)
def create_ticket(body: TicketIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """A ticket opens a support conversation with the student's team (agency if assigned, otherwise Hangyul)."""
    from app.models import ConversationParticipant, SupportTicket
    from app.models.enums import ConversationKind, OrgType

    t = SupportTicket(student_user_id=p.id, category=body.category, subject=body.subject, priority="HIGH" if body.category in ("VISA", "HEALTH") else "MEDIUM")
    db.add(t)
    conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject=f"[{body.category}] {body.subject}", student_user_id=p.id, last_message_at=utcnow())
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=p.id))
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    org_id = a.organization_id if a else db.scalar(select(Organization.id).where(Organization.type == OrgType.HANGYUL))
    if org_id:
        db.add(ConversationParticipant(conversation_id=conv.id, organization_id=org_id))
    db.add(Message(conversation_id=conv.id, author_user_id=p.id, body=body.body, created_at=utcnow()))
    db.commit()
    return {"id": str(t.id), "conversation_id": str(conv.id)}


_PREP = {S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY}


def _mid_sentence(label: str) -> str:
    """"Family relationship certificate" → "family relationship certificate"; acronyms ("TOPIK certificate") stay."""
    first = label.split(" ", 1)[0]
    if len(first) > 1 and (first.isupper() or any(c.isupper() for c in first[1:])):
        return label
    return label[:1].lower() + label[1:]


def _home_application_item(db: Session, task: Task, app_id, items_by_app: dict[str, list[dict]]):
    """(application, item) when the earliest task belongs to an application still being prepared that has a student item."""
    if not app_id:
        return None
    app_ = db.get(Application, app_id)
    if not app_ or app_.status not in _PREP or str(app_.id) not in items_by_app:
        return None
    item = workspace_next(db, app_, items_by_app[str(app_.id)])
    return (app_, item) if item else None


# ---------------------------------------------------------- V15: optional extras the counselor offered

@router.get("/add-ons", tags=["services"])
def my_add_ons(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.scalars(select(ServiceAddOn).where(ServiceAddOn.user_id == p.id).order_by(ServiceAddOn.created_at.desc())).all()
    return [entitlements_svc.add_on_payload(a) for a in rows]


class AddOnDecisionIn(BaseModel):
    approve: bool


@router.post("/add-ons/{add_on_id}", tags=["services"])
def decide_add_on(add_on_id: str, body: AddOnDecisionIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student answers an offer. Approving raises one entitlement limit; declining ends it, and is final.

    There is no re-offer loop and no consequence to declining — the case continues on the plan that was
    bought. That is the brief's "no dark pattern" requirement expressed as behaviour rather than as copy.
    """
    from app.services import addons as addons_svc

    row = db.scalar(select(ServiceAddOn).where(ServiceAddOn.id == parse_uuid(add_on_id)).with_for_update())
    if row is None or row.user_id != p.id:
        raise HTTPException(404, "Not found")
    order = addons_svc.decide(db, p, row, body.approve)
    db.commit()
    # V29: approval is not a grant. It returns the order the student now pays; the allowance or service case switches
    # on only when that order is PAID (``activate_paid_order`` → ``addons.activate``).
    return {"id": str(row.id), "status": row.status.value,
            "order": {"order_id": str(order.id), "amount_minor": order.amount_minor, "currency": order.currency,
                      "status": order.status.value, "payment_state": order.payment_state, "one_time": True} if order else None,
            "plan": entitlements_svc.student_plan(db, p.id)}
