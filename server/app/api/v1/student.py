import hashlib
import logging
import re
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.common import iso, parse_uuid, ser_application, ser_intake, ser_profile, ser_program
from app.core import crypto
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
    ServiceEngagement,
    ServiceProduct,
    StudentEducation,
    StudentEnrollment,
    StudentLanguage,
    StudentPaymentMethod,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    AddOnStatus,
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
from app.models.enums import (
    ApplicationStatus as S,
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
from app.services.foreign_card import CardInput, get_foreign_card
from app.services.matching import ENGINE_VERSION, language_routes, match_program, normalize_gpa, scholarship_eligibility
from app.services.notify import notify
from app.services.payments import Approval, NotConfigured, ProviderError, billing_configs, get_provider, get_toss
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
    # V17: the currency gate runs **before** an order exists. Toss holds one currency per MID (REPORT §152),
    # so a USD price on a KRW MID is a contract that does not exist — and a refusal that still leaves a
    # PENDING order behind is not a refusal, it is a row for the recovery sweep to find later.
    settings = get_settings()
    # V21 — the gate is now about **this** route's merchant configuration, not about the 결제창's.
    #
    # Until V21 the only question asked was `live_usd_checkout_enabled`, which is
    # `toss_env == "live" and all four contract flags`. Every plan is priced in USD, so that refused
    # 100 % of purchases and — because the first conjunct is `live` — refused them in test too. There
    # was no test path at all (REPORT §230).
    #
    # The foreign-card configuration is a different contract and a different endpoint, and the sandbox
    # proves it settles USD (REPORT §229.3). A USD order is allowed when **either** route can take it:
    # the foreign-card key-in route, or the old 결제창 route once its live contracts land.
    if (settings.payment_provider == "toss" and price.currency != "KRW"
            and not settings.foreign_billing_enabled and not settings.live_usd_checkout_enabled):
        audit(db, action="order.currency_unavailable", entity_type="service_product", entity_id=prod.id, actor=p,
              subject_user_id=p.id, detail={"currency": price.currency, "readiness": settings.usd_readiness})
        db.commit()
        raise HTTPException(503, detail={
            "code": "CURRENCY_NOT_CONTRACTED",
            "currency": price.currency,
            "readiness": settings.usd_readiness,
            "message": f"{price.currency} payment is not enabled for this merchant yet.",
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
                                                 currency=price.currency, description=prod.name_en,
                                                 language=_toss_language(p))
    except NotConfigured as exc:
        raise HTTPException(503, str(exc))
    db.add(Payment(order_id=order.id, provider=session.provider, provider_ref=session.provider_ref, status=session.status,
                   amount_minor=price.amount_minor, currency=price.currency, raw={"demo": session.provider == "demo"}))
    assignment = None
    if session.status == "PAID":
        assignment = activate_paid_order(db, order, prod, prof, p.user, provider=session.provider)
    audit(db, action="order.create", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id, detail={"product": prod.code, "status": order.status.value})
    db.commit()
    # `checkout` is the only value that crosses to the browser, and it carries the **client** key and the
    # amount the server just computed — never a status, and never a secret. The browser cannot make an order
    # paid; only `/me/payments/toss/confirm` can, and it re-derives the amount from this row.
    # V21 — the amount and currency are part of the order response now, because the card form is
    # Hangyul's and has to print the figure the student is about to be charged. It is the **server's**
    # number: the browser displays it and never sends it back as the amount.
    return {"order_id": str(order.id), "status": order.status.value, "provider": session.provider, "redirect_url": session.redirect_url,
            "is_demo_payment": session.provider == "demo", "assignment": assignment,
            "amount_minor": order.amount_minor, "currency": order.currency,
            "product_code": prod.code, "product_name": prod.name_en,
            "card_form": get_settings().foreign_billing_enabled,
            "checkout": session.client,
            "customer": {"name": p.user.full_name, "email": p.user.email} if session.client else None}


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


# ---------------- the local paid-state activation (V21 b, REPORT §243.2) ----------------

#: What the Payment row records as its provider. Deliberately **not** a provider's name and deliberately
#: not shaped like one of their transaction ids: a reconciliation that mistook one of these rows for a
#: Toss payment would be the worst outcome this feature could have.
TEST_PAID_PROVIDER = "test-bypass"


class TestPaidStateIn(BaseModel):
    product_code: str


@router.post("/orders/dev-complete", tags=["services"])
def dev_complete_order(body: TestPaidStateIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Activate the selected plan as if a payment had completed — **development and test only**.

    Why this exists. Inspecting the paid student product otherwise costs a real card transaction, and a
    plan is bought once per account; the owner was re-registering accounts to look at a screen. What it is
    *not* is a second payment path: it reaches no payment provider, it has no card, it creates no billing
    key and it writes no credential. It performs the one state transition a successful payment performs —
    ``activate_paid_order`` — with the real Order, the real price and the real entitlements, so the student
    app and the API cannot disagree about what the student owns. That is the whole difference between this
    and a `localStorage` flag, which would have made every subsequent screen lie.

    Four guards, and the first of them is the only one that matters:

    * **production answers 404.** `test_payment_bypass_enabled` is false when `HG_ENV=production`, and the
      explicit flag cannot override it (`app/core/config.py`). 404 rather than 403 because a 403 would
      confirm the route exists.
    * **authentication** — `require_student`, like every other `/me` route.
    * **this student only.** The order is created for the caller; no order id crosses the wire at all, so
      there is nothing to point at somebody else's.
    * **no duplicate active plan.** A plan already owned is returned as it stands rather than bought twice,
      and a *lower* plan is refused, because the product has no downgrade (``upgradeOffer`` returns
      ``None`` for one and the refund policy is unapproved — REPORT §152, §155).
    """
    settings = get_settings()
    if not settings.test_payment_bypass_enabled:
        raise HTTPException(404, "Not found")
    prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == body.product_code, ServiceProduct.is_active.is_(True)))
    if not prod:
        raise HTTPException(404, "Service not found")

    # Already owned → the existing order, untouched. Clicking the button twice must not produce two PAID
    # orders for one plan, and `purchased_product` would hide that from the UI while the history showed it.
    paid = db.scalar(select(Order).where(Order.user_id == p.id, Order.product_id == prod.id,
                                        Order.status == OrderStatus.PAID).order_by(Order.paid_at.desc()))
    if paid is not None:
        return {**_order_payload(db, paid, prod), "already_paid": True, "provider": TEST_PAID_PROVIDER,
                "assignment": None, "plan": entitlements_svc.student_plan(db, p.id)}

    current = entitlements_svc.purchased_product(db, p.id)
    if current is not None and prod.sort_order <= current.sort_order:
        raise HTTPException(409, detail={
            "code": "NOT_AN_UPGRADE",
            "current": current.code,
            "message": f"{current.code} is already active; {prod.code} is not an upgrade on it.",
        })

    price = _plan_price(prod)
    if price is None:
        raise HTTPException(409, "This service has no price configured.")
    # Reuse the order the student already started if there is one: the card form creates a PENDING order
    # before the digits are typed, and abandoning it to create a second one would leave a row for the
    # recovery sweep to puzzle over.
    order = db.scalar(select(Order).where(Order.user_id == p.id, Order.product_id == prod.id,
                                          Order.status == OrderStatus.PENDING).order_by(Order.created_at.desc()))
    if order is None:
        plan = entitlements_svc.plan_def(prod.code)
        order = Order(user_id=p.id, product_id=prod.id, price_id=price.id, currency=price.currency,
                      amount_minor=price.amount_minor, kind="UPGRADE" if current is not None else "PLAN",
                      catalog_version=entitlements_svc.catalog_version(),
                      plan_snapshot=entitlements_svc.snapshot(plan, amount_minor=price.amount_minor, currency=price.currency) if plan else None)
        db.add(order)
        db.flush()
    db.add(Payment(order_id=order.id, provider=TEST_PAID_PROVIDER,
                   provider_ref=f"testbypass_{secrets.token_hex(6)}", status="PAID",
                   amount_minor=order.amount_minor, currency=order.currency,
                   raw={"simulated_paid_state": True, "payment_provider_called": False, "env": settings.env}))
    assignment = activate_paid_order(db, order, prod, get_profile(db, p.id), p.user, provider=TEST_PAID_PROVIDER)
    audit(db, action="order.test_paid_state", entity_type="order", entity_id=order.id, actor=p,
          subject_user_id=p.id, detail={"product": prod.code, "env": settings.env, "provider_called": False})
    db.commit()
    return {**_order_payload(db, order, prod), "already_paid": False, "provider": TEST_PAID_PROVIDER,
            "assignment": assignment, "plan": entitlements_svc.student_plan(db, p.id)}


@router.post("/orders/{order_id}/dev-complete", tags=["services"])
def dev_complete_add_on_order(order_id: uuid.UUID, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """V29: the same local paid-state action for an **add-on** order the student approved — development and test only.

    Production answers 404 whatever the flags say (``test_payment_bypass_enabled`` is false there). It performs the one
    state transition a successful payment performs, so the add-on lifecycle can be reviewed without a card.
    """
    if not get_settings().test_payment_bypass_enabled:
        raise HTTPException(404, "Not found")
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.user_id != p.id or order.kind != "ADD_ON":
        raise HTTPException(404, "Order not found.")
    prod = db.get(ServiceProduct, order.product_id)
    if order.status != OrderStatus.PAID:
        if order.status != OrderStatus.PENDING:
            raise HTTPException(409, "This order can no longer be paid.")
        db.add(Payment(order_id=order.id, provider=TEST_PAID_PROVIDER, provider_ref=f"testbypass_{secrets.token_hex(6)}", status="PAID",
                       amount_minor=order.amount_minor, currency=order.currency,
                       raw={"simulated_paid_state": True, "payment_provider_called": False, "env": get_settings().env}))
        activate_paid_order(db, order, prod, get_profile(db, p.id), p.user, provider=TEST_PAID_PROVIDER)
        audit(db, action="order.test_paid_state", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
              detail={"kind": "ADD_ON", "env": get_settings().env, "provider_called": False})
        db.commit()
    return {**_order_payload(db, order, prod), "plan": entitlements_svc.student_plan(db, p.id)}


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


# ---------------- Toss one-time payment (V16, REPORT §135) ----------------


class TossConfirmIn(BaseModel):
    """Exactly what Toss puts on the success URL. Nothing here is trusted as a *fact* — `amount` is compared
    with the stored amount and then discarded; the number sent to Toss is always the server's own."""
    payment_key: str = Field(min_length=3, max_length=200)
    order_id: uuid.UUID
    amount: int = Field(ge=0)


def _order_payload(db: Session, order: Order, prod: ServiceProduct) -> dict:
    pay = db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc()))
    raw = pay.raw if isinstance(pay.raw, dict) else {}
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
        "method": raw.get("method"),
        "receipt_url": raw.get("receiptUrl"),
    }


def _finish(db: Session, order: Order, approval, *, provider: str) -> dict:
    """Turn a successful provider approval into a paid order — once. Everything after this point is the
    product switching on, and it must happen exactly once per order no matter how many times we are asked."""
    prod = db.get(ServiceProduct, order.product_id)
    user = db.get(User, order.user_id)
    pay = db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc()))
    if pay is not None:
        pay.status = "PAID"
        pay.provider_ref = approval.provider_ref or pay.provider_ref
        pay.amount_minor = approval.amount_minor or pay.amount_minor
        pay.raw = approval.raw
    assignment = activate_paid_order(db, order, prod, get_profile(db, user.id), user, provider=provider)
    audit(db, action="order.paid", entity_type="order", entity_id=order.id, actor=None, subject_user_id=user.id,
          detail={"provider": provider, "method": approval.method})
    db.commit()
    out = _order_payload(db, order, prod)
    out["assignment"] = assignment
    return out


@router.post("/payments/toss/confirm", tags=["services"])
def toss_confirm(body: TossConfirmIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """결제 승인 — the only place an order can become paid.

    Every check below exists because the browser supplied the inputs:

      * the order exists **and belongs to the caller** — an order id is a UUID, but a guessed UUID must not
        pay for somebody else's plan or read back their payment;
      * the order is still payable, or is already paid — the second case is not an error, it is a refresh;
      * the amount Toss put on the URL equals the amount this server stored *before* the window opened;
      * the product is still on sale at that price.

    Only then is Toss asked to approve, with **the stored amount**, under an order-derived idempotency key.
    """
    order = db.scalar(select(Order).where(Order.id == body.order_id).with_for_update())
    if order is None or order.user_id != p.id:
        raise HTTPException(404, "Order not found.")
    prod = db.get(ServiceProduct, order.product_id)
    # A refresh of the success URL, the back button, or a second tab: the answer is the order, not an error.
    if order.status == OrderStatus.PAID:
        db.commit()
        return _order_payload(db, order, prod)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(409, "This order can no longer be paid.")
    if body.amount != order.amount_minor:
        audit(db, action="order.amount_mismatch", entity_type="order", entity_id=order.id, actor=p,
              subject_user_id=p.id, detail={"expected": order.amount_minor, "returned": body.amount})
        db.commit()
        raise HTTPException(409, "The payment amount does not match this order.")
    # V17: the order's own currency, not a hardcoded one. This said `!= "KRW"` under V16, when KRW was the
    # product currency — which would have rejected every confirmation the moment the USD contract landed,
    # *after* the student had already paid. What matters is that the currency is the one this server priced
    # the order in, which it is by construction, and that the merchant is contracted for it.
    settings = get_settings()
    # This is the **결제창** confirm path and only that; the foreign-card route never reaches here, so
    # its readiness is deliberately not consulted. A USD order that arrives at this endpoint really is
    # one the 결제창 may not take.
    if order.currency != "KRW" and not settings.live_usd_checkout_enabled:
        raise HTTPException(409, detail={
            "code": "CURRENCY_NOT_CONTRACTED",
            "currency": order.currency,
            "message": f"{order.currency} payment is not enabled for this merchant.",
        })
    try:
        approval = get_toss().confirm(payment_key=body.payment_key, order_id=str(order.id), amount_minor=order.amount_minor)
    except NotConfigured as exc:
        raise HTTPException(503, str(exc)) from None
    except ProviderError as exc:
        pay = db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc()))
        if pay is not None:
            pay.status = "FAILED"
        order.status = OrderStatus.FAILED
        audit(db, action="order.failed", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
              detail={"code": exc.code})
        db.commit()
        raise HTTPException(402, detail={"code": exc.code, "message": exc.message}) from None
    if approval.status != "PAID":
        db.commit()
        raise HTTPException(402, detail={"code": approval.failure or approval.status, "message": "Payment was not approved."})
    return _finish(db, order, approval, provider="toss")


# ======================================================================================================
# V21 — foreign-card payment: Hangyul's own card form, Toss's key-in API, USD, one action
#
# The architecture here is the owner's (brief §21–§49) and the route is the one the merchant
# configuration actually serves (REPORT §229). `bill_talkoab1` accepts `POST /v1/payments/key-in`: the
# card's digits reach **Hangyul's backend** and go server-to-server to Toss under the secret key. It
# settles USD, which is what the plans are priced in.
#
# Three things are true of every endpoint below and are the reason they are written this way:
#
#   * **The card is never persisted and never logged.** It exists as a `CardInput` for the duration of
#     one function call. `_CardIn` has no `__repr__` that can print it, FastAPI never echoes the request
#     body, and the audit rows carry the order and the result — never the instrument.
#   * **The amount is the server's.** Nothing a browser sends is used as the amount. The Order was
#     priced from `ServicePrice` before the form opened.
#   * **A charge happens at most once per order.** A row lock, an early return when the order is already
#     paid, and a Toss `Idempotency-Key` derived from the order id. Double-click, refresh, retry and a
#     lost response all converge on one payment.
# ======================================================================================================

_CARD_RATE_LIMIT = 8          # attempts
_CARD_RATE_WINDOW = 300.0     # seconds
_card_hits: dict[str, deque] = defaultdict(deque)


def _card_rate_limited(request: Request, p: Principal = Depends(require_student)) -> None:
    """Per student **and** per IP. Card testing is the attack; the student id is the cheap bound on it."""
    now = time.monotonic()
    ip = request.client.host if request.client else "unknown"
    for bucket in (f"u:{p.id}", f"ip:{ip}"):
        q = _card_hits[bucket]
        while q and now - q[0] > _CARD_RATE_WINDOW:
            q.popleft()
        if len(q) >= _CARD_RATE_LIMIT:
            raise HTTPException(429, detail={
                "code": "TOO_MANY_CARD_ATTEMPTS",
                "message": "Too many card attempts. Please wait a few minutes and try again.",
            })
    for bucket in (f"u:{p.id}", f"ip:{ip}"):
        _card_hits[bucket].append(now)


class _CardIn(BaseModel):
    """The only fields this merchant configuration needs — verified against the live sandbox.

    Toss's generic 자동결제 guide also lists `cardPassword` and `customerIdentityNumber`. The probe in
    REPORT §229.3 charged this MID successfully **without either**, and asking someone in Hanoi for the
    first two digits of a Korean card password or a 주민등록번호 would be asking for data that does not
    exist and that Hangyul must not hold. They are not accepted here, so they cannot be sent.
    """

    model_config = {"extra": "forbid"}

    number: str = Field(min_length=12, max_length=25)
    expiry_month: str = Field(min_length=1, max_length=2)
    expiry_year: str = Field(min_length=2, max_length=4)
    holder_name: str | None = Field(default=None, max_length=60)

    @field_validator("number")
    @classmethod
    def _digits_and_luhn(cls, v: str) -> str:
        digits = re.sub(r"[^0-9]", "", v)
        if not 12 <= len(digits) <= 19:
            raise ValueError("card number length")
        # Checked locally so an obvious typo costs a round trip to Toss rather than a declined
        # authorisation on the student's statement.
        total, parity = 0, len(digits) % 2
        for i, ch in enumerate(digits):
            d = int(ch)
            if i % 2 == parity:
                d *= 2
                if d > 9:
                    d -= 9
            total += d
        if total % 10 != 0:
            raise ValueError("card number checksum")
        return digits

    @field_validator("expiry_month")
    @classmethod
    def _month(cls, v: str) -> str:
        m = re.sub(r"[^0-9]", "", v)
        if not m or not 1 <= int(m) <= 12:
            raise ValueError("expiry month")
        return m.zfill(2)

    @field_validator("expiry_year")
    @classmethod
    def _year(cls, v: str) -> str:
        y = re.sub(r"[^0-9]", "", v)
        if len(y) not in (2, 4):
            raise ValueError("expiry year")
        return y[-2:]

    def __repr__(self) -> str:  # noqa: D105 - never let a validation error print the PAN
        return "<CardIn redacted>"

    __str__ = __repr__


class PayWithCardIn(BaseModel):
    model_config = {"extra": "forbid"}
    card: _CardIn
    #: Keep the card for a later upgrade. Honoured only where the configuration issues a reusable
    #: credential; `reusable` on the stored method is the truth the UI reads.
    save_card: bool = True


def _method_payload(m: StudentPaymentMethod) -> dict:
    """What a browser may know about a stored card. The credential is not in this dict by construction."""
    return {
        "id": str(m.id),
        "brand": m.card_brand,
        "last4": m.last4,
        "masked_number": m.masked_number,
        "issuer_code": m.issuer_code,
        "card_type": m.card_type,
        "reusable": m.reusable,
        "is_default": m.is_default,
        "status": m.status,
        "created_at": iso(m.created_at),
    }


def _remember_card(db: Session, *, user_id, result, save: bool) -> StudentPaymentMethod:
    """Record the safe echo of the card that just paid, and the credential if there is one.

    `customer_key` is 32 bytes of randomness (brief §31) — not the email, not the user id, not a UUID
    that appears anywhere else, because a customer key is a handle an attacker should not be able to
    guess from anything they already know.
    """
    # Compared against the mask **we** store, not the one Toss echoes: the row holds `•••• 1111` and
    # the provider sends `41111111****111*`, so matching on the provider's string never matched
    # anything and every charge on the same card opened another row. `issuer_code` is carried too,
    # because two different cards can share their last four digits.
    stored_mask = f"•••• {result.last4}" if result.last4 else None
    existing = db.scalar(
        select(StudentPaymentMethod).where(
            StudentPaymentMethod.user_id == user_id,
            StudentPaymentMethod.status == "ACTIVE",
            StudentPaymentMethod.masked_number == stored_mask,
            StudentPaymentMethod.issuer_code == result.issuer_code,
        )
    ) if stored_mask else None
    if existing is not None:
        existing.updated_at = utcnow()
        return existing
    db.execute(
        update(StudentPaymentMethod)
        .where(StudentPaymentMethod.user_id == user_id, StudentPaymentMethod.is_default.is_(True))
        .values(is_default=False)
    )
    m = StudentPaymentMethod(
        user_id=user_id,
        provider="TOSS",
        provider_mid=get_settings().toss_foreign_billing_mid,
        customer_key="hgc_" + secrets.token_urlsafe(24),
        reusable=False,  # key-in issues no credential; see REPORT §229.2
        card_brand=_brand_of(result.masked_number),
        issuer_code=result.issuer_code,
        acquirer_code=result.acquirer_code,
        # **Our** mask, not the provider's. Toss echoes `41111111****111*` — the BIN plus eight more
        # digits, which is inside PCI DSS's display allowance and is still eleven digits of a card
        # number that this product has no use for. The last four identify the card to its owner; the
        # rest is stored by nobody here.
        masked_number=stored_mask,
        last4=result.last4,
        card_type=result.card_type,
        owner_type=result.owner_type,
        is_default=True,
        status="ACTIVE" if save else "REVOKED",
        revoked_at=None if save else utcnow(),
    )
    db.add(m)
    db.flush()
    return m


def _brand_of(masked: str | None) -> str | None:
    """The network, from the first digit of the provider's masked echo. Nothing more is inferable."""
    if not masked:
        return None
    first = masked[0]
    return {"4": "Visa", "5": "Mastercard", "3": "Amex/JCB", "6": "Discover/UnionPay"}.get(first)


@router.post("/orders/{order_id}/pay-with-card", tags=["services"],
             dependencies=[Depends(_card_rate_limited)])
def pay_order_with_card(order_id: uuid.UUID, body: PayWithCardIn,
                        p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Register the card and pay this order — **one action** (brief §34, §35).

    There is no "generate a billing key" step for the student to understand, because for this merchant
    configuration there is not one to perform: the card authorises and captures in a single call.
    """
    settings = get_settings()
    if not settings.foreign_billing_enabled:
        raise HTTPException(503, detail={
            "code": "FOREIGN_BILLING_NOT_READY",
            "message": "Card payment is not configured on this server.",
            "readiness": {"test": settings.foreign_billing_test_ready, "live": settings.foreign_billing_live_ready},
        })

    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.user_id != p.id:
        raise HTTPException(404, "Order not found.")
    prod = db.get(ServiceProduct, order.product_id)
    # A second submit, a refresh, or a retry after a lost response: the answer is the order.
    if order.status == OrderStatus.PAID:
        db.commit()
        return {**_order_payload(db, order, prod), "already_paid": True}
    if order.status != OrderStatus.PENDING:
        raise HTTPException(409, "This order can no longer be paid.")

    # The response to the *first* attempt may have been lost in transit; ask Toss before charging again.
    provider = get_foreign_card()
    prior = provider.lookup(order_id=str(order.id))
    if prior is not None and prior.status == "DONE":
        method = _remember_card(db, user_id=p.id, result=prior, save=body.save_card)
        return _finish_card_payment(db, order, prior, method)

    pay = Payment(order_id=order.id, provider="toss", status="PENDING",
                  amount_minor=order.amount_minor, currency=order.currency)
    db.add(pay)
    db.flush()
    try:
        result = provider.charge(
            card=CardInput(number=body.card.number, expiry_year=body.card.expiry_year,
                           expiry_month=body.card.expiry_month, holder_name=body.card.holder_name),
            order_id=str(order.id),
            amount_minor=order.amount_minor,
            currency=order.currency,
            order_name=(prod.name_en if prod else "Hangyul plan"),
            idempotency_key=f"hg-keyin-{order.id}",
        )
    except NotConfigured as exc:
        raise HTTPException(503, str(exc)) from None
    except ProviderError as exc:
        # The card was declined or the network failed. The order stays payable so the student can try
        # another card without losing the plan they chose (brief §40).
        pay.status = "FAILED"
        audit(db, action="order.card_declined", entity_type="order", entity_id=order.id, actor=p,
              subject_user_id=p.id, detail={"code": exc.code})
        db.commit()
        raise HTTPException(402, detail={"code": exc.code, "message": exc.message}) from None
    finally:
        body.card.number = ""  # the request model does not outlive the call either

    if result.status != "DONE":
        pay.status = "FAILED"
        db.commit()
        raise HTTPException(402, detail={"code": result.status, "message": "The payment was not approved."})
    method = _remember_card(db, user_id=p.id, result=result, save=body.save_card)
    return _finish_card_payment(db, order, result, method)


def _finish_card_payment(db: Session, order: Order, result, method: StudentPaymentMethod) -> dict:
    """Shared tail: mark paid, switch the plan on, return the order and the saved card."""
    approval = Approval(status="PAID", provider_ref=result.payment_key, amount_minor=result.amount_minor,
                        method="CARD", approved_at=result.approved_at, receipt_url=result.receipt_url,
                        raw=result.raw, failure=None)
    out = _finish(db, order, approval, provider="toss")
    out["payment_method"] = _method_payload(method)
    return out


@router.post("/orders/{order_id}/pay-with-saved-card", tags=["services"],
             dependencies=[Depends(_card_rate_limited)])
def pay_order_with_saved_card(order_id: uuid.UUID, p: Principal = Depends(require_student),
                              db: Session = Depends(get_db)):
    """Pay with a card already on file (brief §38).

    It exists, it is authenticated, it validates ownership and amount, and on `bill_talkoab1` it
    **refuses with a specific reason**: that configuration performs a 키인 one-time charge and returns
    no reusable credential (REPORT §229.2), so there is nothing to charge with. Returning
    `CARD_NOT_REUSABLE` is the honest answer; silently re-prompting for the card from an endpoint whose
    name promises otherwise is not.
    """
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.user_id != p.id:
        raise HTTPException(404, "Order not found.")
    prod = db.get(ServiceProduct, order.product_id)
    if order.status == OrderStatus.PAID:
        db.commit()
        return {**_order_payload(db, order, prod), "already_paid": True}
    if order.status != OrderStatus.PENDING:
        raise HTTPException(409, "This order can no longer be paid.")

    method = db.scalar(
        select(StudentPaymentMethod)
        .where(StudentPaymentMethod.user_id == p.id, StudentPaymentMethod.status == "ACTIVE")
        .order_by(StudentPaymentMethod.is_default.desc(), StudentPaymentMethod.created_at.desc())
    )
    if method is None:
        raise HTTPException(404, detail={"code": "NO_SAVED_CARD", "message": "No saved card."})
    if not method.reusable or not method.billing_key_ciphertext:
        raise HTTPException(409, detail={
            "code": "CARD_NOT_REUSABLE",
            "message": "This card cannot be charged again without re-entering it.",
            "card": _method_payload(method),
        })
    # Reachable only when a billing-key route is contracted; the credential is opened here and nowhere
    # else, and it is never returned, logged or placed in an exception.
    billing_key = crypto.open_sealed(method.billing_key_ciphertext,
                                     key_version=method.billing_key_version or 1,
                                     aad=str(method.user_id))
    provider = get_foreign_card()
    try:
        result = provider.charge_with_billing_key(
            billing_key=billing_key, customer_key=method.customer_key, order_id=str(order.id),
            amount_minor=order.amount_minor, currency=order.currency,
            order_name=(prod.name_en if prod else "Hangyul plan"),
            idempotency_key=f"hg-billing-{order.id}")
    except ProviderError as exc:
        audit(db, action="order.card_declined", entity_type="order", entity_id=order.id, actor=p,
              subject_user_id=p.id, detail={"code": exc.code})
        db.commit()
        raise HTTPException(402, detail={"code": exc.code, "message": exc.message}) from None
    finally:
        billing_key = ""
    if result.status != "DONE":
        raise HTTPException(402, detail={"code": result.status, "message": "The payment was not approved."})
    return _finish_card_payment(db, order, result, method)


@router.get("/payment-methods", tags=["services"])
def my_payment_methods(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The cards on file. The credential is not in this response and has no endpoint that returns it."""
    rows = db.scalars(
        select(StudentPaymentMethod)
        .where(StudentPaymentMethod.user_id == p.id, StudentPaymentMethod.status == "ACTIVE")
        .order_by(StudentPaymentMethod.is_default.desc(), StudentPaymentMethod.created_at.desc())
    ).all()
    return {"items": [_method_payload(m) for m in rows]}


@router.delete("/payment-methods/{method_id}", tags=["services"], status_code=200)
def delete_payment_method(method_id: uuid.UUID, p: Principal = Depends(require_student),
                          db: Session = Depends(get_db)):
    """Remove a card (brief §42).

    Where a reusable credential exists it is revoked **at Toss first** and then locally, because the
    opposite order can leave a credential alive at the provider that Hangyul no longer knows about. A
    provider that is unreachable does not block the local revocation — the row is marked revoked and
    can never be charged again from here either way.
    """
    m = db.scalar(select(StudentPaymentMethod).where(StudentPaymentMethod.id == method_id))
    if m is None or m.user_id != p.id or m.status != "ACTIVE":
        raise HTTPException(404, "Card not found.")
    remote = "not_applicable"
    if m.reusable and m.billing_key_ciphertext:
        try:
            billing_key = crypto.open_sealed(m.billing_key_ciphertext,
                                             key_version=m.billing_key_version or 1, aad=str(m.user_id))
            remote = "revoked" if get_foreign_card().revoke_billing_key(billing_key=billing_key) else "already_gone"
        except (crypto.DecryptionFailed, ProviderError, NotConfigured):
            remote = "unreachable"
        finally:
            billing_key = ""
    m.status, m.revoked_at, m.is_default = "REVOKED", utcnow(), False
    m.billing_key_ciphertext, m.billing_key_version, m.reusable = None, None, False
    audit(db, action="payment_method.revoked", entity_type="payment_method", entity_id=m.id, actor=p,
          subject_user_id=p.id, detail={"remote": remote})
    db.commit()
    return {"deleted": True, "remote": remote}


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
        order.status = OrderStatus.CANCELLED
        pay = db.scalar(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at.desc()))
        if pay is not None and pay.status == "PENDING":
            pay.status = "CANCELLED"
        db.commit()
    prod = db.get(ServiceProduct, order.product_id)
    return _order_payload(db, order, prod)


def reconcile_pending_orders(db: Session, user_id) -> bool:
    """Payment recovery (brief Part 17): ask the provider what really happened to any order we still think
    is pending.

    The case this exists for is the one a redirect cannot cover — the browser was closed, or lost the
    network, between Toss approving and the success URL loading. Locally the order is PENDING; at Toss the
    payment is DONE. `/me/services` calls this before it renders, so the next thing the student sees is
    their active plan rather than a second request for money.

    Only orders from the last day are checked: a one-time Toss payment that was never confirmed within ten
    minutes has expired, and asking about every order a student ever abandoned would make this screen's load
    time a function of their history.
    """
    s = get_settings()
    if s.payment_provider != "toss":
        return False
    cutoff = utcnow() - timedelta(days=1)
    pending = db.scalars(select(Order).where(Order.user_id == user_id, Order.status == OrderStatus.PENDING,
                                             Order.created_at >= cutoff)).all()
    if not pending:
        return False
    changed = False
    try:
        toss = get_toss()
    except NotConfigured:
        return False
    for order in pending:
        # **A reconciliation failure must not take the page down** (V21).
        #
        # This runs on every `/me/services` load, once per pending order, against the real provider.
        # Before V21 a USD order could not be created, so there were never any pending orders and this
        # loop never ran; now there are, and Toss rate-limited us — `요청량이 초과되었습니다` — which
        # escaped as a `ProviderError` and **500'd the whole services page**. Reconciliation is a
        # convenience that recovers a payment approved while the browser was gone; the student's plan
        # screen does not depend on it, and a provider that is unreachable or cross must not be able to
        # stop them seeing what they own.
        try:
            approval = toss.lookup(order_id=str(order.id))
        except (ProviderError, NotConfigured) as exc:
            log.warning("order reconciliation skipped for %s: %s", order.id, type(exc).__name__)
            continue
        if approval is None or approval.status != "PAID":
            continue
        # The same equality the confirm endpoint enforces. A provider that reports a different total than
        # the one we priced is a reconciliation problem for a human, not something to activate on.
        if approval.amount_minor is not None and approval.amount_minor != order.amount_minor:
            audit(db, action="order.amount_mismatch", entity_type="order", entity_id=order.id, actor=None,
                  subject_user_id=user_id, detail={"expected": order.amount_minor, "provider": approval.amount_minor})
            continue
        _finish(db, order, approval, provider="toss")
        changed = True
    return changed


def _toss_language(p: Principal) -> str:
    """The payment window's language, from the reader's own locale.

    Toss's 결제창 supports KO / EN / JA / ZH. Everyone else gets EN, which is the right answer for a
    Vietnamese or Nepali student: an English payment window is legible, and a Korean one is not.
    """
    loc = (getattr(p.user, "locale", None) or "en").lower()
    if loc.startswith("ko"):
        return "KO"
    if loc.startswith("ja"):
        return "JA"
    if loc.startswith("zh"):
        return "ZH"
    return "EN"


class RefundIn(BaseModel):
    """What a refund needs, and what it deliberately does not compute.

    `amount_minor` is **required**. There is no default and no pro-rata rule, because Hangyul has no
    approved refund policy (REPORT §152) and a server that invents one would be making a legal decision in
    a request handler. A person decides the amount; this records and executes it.
    """
    amount_minor: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=200)


@router.post("/orders/{order_id}/refund", tags=["services"])
def refund_order(order_id: uuid.UUID, body: RefundIn, p: Principal = Depends(require_student),
                 db: Session = Depends(get_db)):
    """Refund a paid order, in whole or in part (V17, REPORT §152).

    The **technical** path only. Every check here is about whether this refund is possible and safe, never
    about whether it is owed:

      * the order is the caller's, and is PAID;
      * the amount does not exceed what is left unrefunded;
      * the provider is asked with an idempotency key derived from *this* refund, so a retry is a no-op but
        a genuine second partial refund is not swallowed as a duplicate;
      * the plan is switched off only once the provider confirms.

    A student may ask for their own refund here. Staff-initiated refunds go through the same endpoint from
    the operations console with the student's id, which is why the ownership check is explicit rather than
    implied by the route.
    """
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or order.user_id != p.id:
        raise HTTPException(404, "Order not found.")
    if order.status != OrderStatus.PAID:
        raise HTTPException(409, "Only a paid order can be refunded.")
    pay = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.status == "PAID")
                    .order_by(Payment.created_at.desc()))
    if pay is None or not pay.provider_ref:
        raise HTTPException(409, "This order has no provider payment to refund.")
    already = pay.refunded_amount_minor or 0
    remaining = order.amount_minor - already
    if body.amount_minor > remaining:
        raise HTTPException(409, detail={"code": "AMOUNT_EXCEEDS_REMAINING", "remaining_minor": remaining})

    # The key identifies *this* refund attempt: order + how much has already gone back. A second refund of
    # a different amount therefore gets a different key, while a retry of the same one does not.
    key = f"hg-refund-{order.id}-{already}-{body.amount_minor}"
    try:
        result = get_toss().cancel(payment_key=pay.provider_ref, reason=body.reason,
                                   amount_minor=body.amount_minor, idempotency_key=key)
    except NotConfigured as exc:
        raise HTTPException(503, str(exc)) from None
    except ProviderError as exc:
        audit(db, action="order.refund_failed", entity_type="order", entity_id=order.id, actor=p,
              subject_user_id=p.id, detail={"code": exc.code, "amount_minor": body.amount_minor})
        db.commit()
        raise HTTPException(402, detail={"code": exc.code, "message": exc.message}) from None

    now = utcnow()
    pay.refunded_amount_minor = already + body.amount_minor
    pay.refund_ref = result.provider_ref or pay.refund_ref
    pay.refunded_at = now
    pay.raw = result.raw or pay.raw
    order.refund_amount_minor = (order.refund_amount_minor or 0) + body.amount_minor
    order.refund_reason = body.reason
    order.refunded_at = now
    full = order.refund_amount_minor >= order.amount_minor
    if full:
        # A fully refunded order is no longer a purchase, so the plan it bought stops being active. A
        # partial refund does not: the student keeps the service they are still paying for.
        order.status = OrderStatus.REFUNDED
        # V29: the service instance it bought ends with it (the plan below it, if any, is not revived).
        for eng in db.scalars(select(ServiceEngagement).where(ServiceEngagement.order_id == order.id)):
            eng.status = "REFUNDED"
        if order.kind == "ADD_ON":
            for row in db.scalars(select(ServiceAddOn).where(ServiceAddOn.order_id == order.id)):
                row.status = AddOnStatus.CANCELLED
    audit(db, action="order.refunded", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
          detail={"amount_minor": body.amount_minor, "full": full, "provider_ref": result.provider_ref,
                  "reason": body.reason})
    track(db, "service_refunded", user_id=p.id, properties={"full": full, "amount_minor": body.amount_minor})
    db.commit()
    prod = db.get(ServiceProduct, order.product_id)
    out = _order_payload(db, order, prod)
    out["refunded_amount_minor"] = order.refund_amount_minor
    out["fully_refunded"] = full
    return out


@router.get("/payments/config", tags=["services"])
def payment_config(p: Principal = Depends(require_student)):
    """What this deployment is configured to charge with — for support and for `npm run qa:v16`.

    It names merchant configurations and says which one the plan purchase uses. It contains **no keys**:
    not the secret, not the security key, and not the client key, which is handed out only with an actual
    order so there is exactly one code path that can start a payment.
    """
    s = get_settings()
    return {
        "provider": s.payment_provider,
        "env": s.toss_env,
        # V17 — the four contract facts that gate a live USD checkout, by name, so a status surface can say
        # *which* one is missing rather than only that something is. See docs/payments/TOSS_FOREIGN_CARD_REVIEW.md.
        "currency": "USD",
        "usd_readiness": s.usd_readiness,
        "live_usd_checkout_enabled": s.live_usd_checkout_enabled,
        # V21 b — may this server activate a plan without a payment (REPORT §243.2)? The student app asks
        # before it renders the local paid-state button, so the server is the authority on whether it
        # exists, not a build flag. False in production by construction.
        "test_payment_bypass": s.test_payment_bypass_enabled,
        # V21 — the route a student's plan purchase actually takes, and its own two readiness states.
        # `card_form: "hangyul"` is the contract the student UI reads: Hangyul renders the fields and
        # there is no provider window to open. `reusable_credential` is false because this merchant
        # configuration issues none (REPORT §229.2) — the UI must not promise a saved card it cannot
        # charge.
        "foreign_card": {
            "mid": s.toss_foreign_billing_mid,
            "product": "해외카드 키인 결제 (/v1/payments/key-in)",
            "configured": s.foreign_billing_configured,
            "test_ready": s.foreign_billing_test_ready,
            "live_ready": s.foreign_billing_live_ready,
            "enabled": s.foreign_billing_enabled,
            "card_form": "hangyul",
            "reusable_credential": False,
            "used_by_plan_purchase": True,
            "methods": ["OVERSEAS_CARD"],
        },
        # Owner-confirmed 2026-10-21: the foreign-card review/contract is complete (brief §25). Test
        # credentials are not live credentials, so the two are reported separately and neither is
        # inferred from the other.
        "contract": {
            "foreign_card_review": "OWNER_CONFIRMED_COMPLETE",
            "live_credentials_configured": s.foreign_billing_live_ready,
        },
        "methods_offered": ["OVERSEAS_CARD"],
        "one_time": {"mid": s.toss_normal_mid, "product": "일반 결제 (결제창)", "configured": s.toss_configured,
                     "methods": ["CARD", "EASY_PAY"], "used_by_plan_purchase": False},
        "billing": billing_configs(),
    }


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
    from datetime import timedelta

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
                      "status": order.status.value, "card_form": get_settings().foreign_billing_enabled} if order else None,
            "plan": entitlements_svc.student_plan(db, p.id)}
