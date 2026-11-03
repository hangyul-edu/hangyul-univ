"""V5 — writing review API (owned by the writing workstream; see docs/WRITING_REVIEW.md).

The essay itself stays on /essays (collab.py); this router adds the professional review layer: the review queue,
prompts (versioned per university / program / intake), rubric ratings, automatic-check findings, reviewer matching and
override, SLA policy, approved versions for applications, and internal insights.
Tenant rules: every essay endpoint goes through ``_essay`` (same access rule as /essays); prompts entered by an agency
are visible only to that agency and Hangyul; university consoles never reach essay drafts.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import parse_uuid
from app.api.v1.collab import _essay, ser_essay
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, get_principal
from app.models import (
    Application,
    OrganizationMember,
    Program,
    ReviewerProfile,
    University,
    User,
    WritingPolicy,
    WritingPrompt,
)
from app.models.enums import EssayType, IntakeTerm
from app.services import writing as W
from app.services.access import forbidden, get_application_for

router = APIRouter(tags=["writing"])


def _staff(p: Principal) -> None:
    if p.is_student or p.is_university or not p.has(*W.REVIEWER_ROLES):
        raise forbidden()


def _manager(p: Principal) -> None:
    if not p.has(*W.MANAGER_ROLES) or p.is_university:
        raise HTTPException(403, "Managers only.")


# ------------------------------------------------------------------ queue

@router.get("/writing/queue")
def writing_queue(view: str = Query("first", pattern="^(first|revised|final|due48|overdue|mine|team)$"),
                  p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    out = W.queue(db, p, view)
    db.commit()
    return out


@router.get("/writing/today")
def writing_today(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Same rows the coordinator's Agency Today uses (``services.writing.today_items``)."""
    _staff(p)
    out = W.today_items(db, p)
    db.commit()
    return {"items": out}


@router.get("/writing/essays/{essay_id}/next")
def next_essay(essay_id: str, view: str | None = Query(None, pattern="^(first|revised|final|due48|overdue|mine|team)$"),
               pos: int | None = Query(None, ge=0, le=10000), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Next essay in the reviewer's queue view (V6: stays in ``view``; ``pos`` = this essay's former position)."""
    _staff(p)
    e = _essay(db, p, essay_id)
    nxt = W.next_in_queue(db, p, e.id, view, pos)
    db.commit()
    return {"id": nxt}


# ------------------------------------------------------------------ checks + findings

@router.post("/writing/essays/{essay_id}/checks")
def run_checks(essay_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Run the automatic checks on the current version (student before submitting, or reviewer). Never edits the text."""
    e = _essay(db, p, essay_id)
    if p.is_student and e.owner_user_id != p.id:
        raise forbidden()
    W.run_checks(db, e)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


class DismissIn(BaseModel):
    note: str = Field(min_length=3, max_length=1000)


@router.post("/writing/essays/{essay_id}/findings/{finding_id}/dismiss")
def dismiss_finding(essay_id: str, finding_id: str, body: DismissIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """A reviewer confirms a finding does not apply (e.g. the profile is outdated) — recorded with the note."""
    _staff(p)
    e = _essay(db, p, essay_id)
    parse_uuid(finding_id)
    W.dismiss_finding(db, e, finding_id, body.note, p)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


# ------------------------------------------------------------------ rubric

class RubricIn(BaseModel):
    rating: str = Field(pattern="^(MEETS|NEEDS_WORK|NOT_ASSESSED)$")
    note: str | None = Field(default=None, max_length=2000)


@router.put("/writing/essays/{essay_id}/rubric/{dimension}")
def set_rubric(essay_id: str, dimension: str, body: RubricIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    e = _essay(db, p, essay_id)
    W.set_score(db, e, dimension, body.rating, body.note, p)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


# ------------------------------------------------------------------ reviewer matching

@router.get("/writing/essays/{essay_id}/candidates")
def candidates(essay_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    e = _essay(db, p, essay_id)
    items = W.reviewer_candidates(db, e)
    if not p.is_hangyul:
        items = [c for c in items if c["organization"]["id"] == str(p.org_id) or c["organization"]["type"] == "HANGYUL"]
    db.commit()
    return {"items": items, "current": str(e.reviewer_user_id) if e.reviewer_user_id else None, "can_override": p.has(*W.MANAGER_ROLES)}


class ReviewerIn(BaseModel):
    user_id: str
    reason: str = Field(min_length=5, max_length=500)


@router.post("/writing/essays/{essay_id}/reviewer")
def set_reviewer(essay_id: str, body: ReviewerIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    e = _essay(db, p, essay_id)
    parse_uuid(body.user_id)
    W.override_reviewer(db, e, body.user_id, body.reason, p)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


# ------------------------------------------------------------------ prompts

class PromptIn(BaseModel):
    university_id: str
    program_id: str | None = None
    essay_type: EssayType
    intake_year: int | None = Field(default=None, ge=2020, le=2040)
    intake_term: IntakeTerm | None = None
    effective_from_year: int | None = Field(default=None, ge=2020, le=2040)
    effective_from_term: IntakeTerm | None = None
    prompt_text: str = Field(min_length=10, max_length=4000)
    prompt_language: str = Field(default="en", max_length=8)
    word_limit: int | None = Field(default=None, ge=50, le=10000)
    char_limit: int | None = Field(default=None, ge=100, le=50000)
    required_language: str | None = Field(default=None, max_length=8)
    source_url: str | None = Field(default=None, max_length=1000)
    verification_status: str | None = Field(default=None, pattern="^(SAMPLE|COUNSELOR_ENTERED|VERIFIED)$")
    note: str | None = Field(default=None, max_length=500)


def _prompt_data(db: Session, body: PromptIn) -> dict:
    uni = db.get(University, parse_uuid(body.university_id))
    if not uni:
        raise HTTPException(404, "University not found")
    prog = None
    if body.program_id:
        prog = db.get(Program, parse_uuid(body.program_id))
        if not prog or prog.university_id != uni.id:
            raise HTTPException(404, "Program not found")
    d = body.model_dump()
    d.update(university_id=uni.id, program_id=prog.id if prog else None, essay_type=body.essay_type.value,
             intake_term=body.intake_term.value if body.intake_term else None,
             effective_from_term=body.effective_from_term.value if body.effective_from_term else None)
    return d


@router.get("/writing/prompts")
def list_prompts(university_id: str | None = None, program_id: str | None = None, essay_type: str | None = None, include_superseded: bool = False,
                 p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    q = select(WritingPrompt)
    if university_id:
        q = q.where(WritingPrompt.university_id == parse_uuid(university_id))
    if program_id:
        q = q.where(WritingPrompt.program_id == parse_uuid(program_id))
    if essay_type:
        q = q.where(WritingPrompt.essay_type == essay_type)
    if not include_superseded:
        q = q.where(WritingPrompt.superseded_by_id.is_(None))
    rows = [x for x in db.scalars(q.order_by(WritingPrompt.created_at.desc())).all() if W.visible_prompt(p, x)]
    return {"items": [W.ser_prompt(db, x, staff=True) for x in rows]}


@router.post("/writing/prompts", status_code=201)
def create_prompt(body: PromptIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    new = W.create_prompt(db, p, _prompt_data(db, body))
    db.commit()
    return W.ser_prompt(db, new, staff=True)


class AttachIn(BaseModel):
    prompt_id: str | None = None
    prompt: PromptIn | None = None


@router.post("/writing/essays/{essay_id}/prompt")
def attach_prompt(essay_id: str, body: AttachIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Reviewer attaches a known prompt version to the essay, or enters the university's question (a new version)."""
    _staff(p)
    e = _essay(db, p, essay_id)
    if body.prompt_id:
        pr = db.get(WritingPrompt, parse_uuid(body.prompt_id))
        if not pr or not W.visible_prompt(p, pr):
            raise forbidden()
    elif body.prompt:
        pr = W.create_prompt(db, p, _prompt_data(db, body.prompt))
    else:
        raise HTTPException(422, "Give a prompt_id or a prompt.")
    t = W.essay_target(db, e)
    if t["university"] and pr.university_id != t["university"].id:
        raise HTTPException(422, "This prompt belongs to another university.")
    r = W.review_for(db, e)
    r.prompt_id = pr.id
    if pr.word_limit:
        e.word_limit = pr.word_limit
    audit(db, action="writing.prompt_attached", entity_type="essay", entity_id=e.id, actor=p, subject_user_id=e.owner_user_id,
          detail={"prompt_id": str(pr.id), "version": pr.version})
    W.run_checks(db, e, r)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


# ------------------------------------------------------------------ approved versions (application / package)

@router.get("/writing/applications/{application_id}/approved")
def approved_for_application(application_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The exact approved essay versions an application uses. Universities see them only for submitted applications
    (``get_application_for`` enforces that); drafts are never exposed."""
    app: Application = get_application_for(db, p, parse_uuid(application_id))
    return {"application_id": str(app.id), "items": W.approved_essays_for_application(db, app.id)}


# ------------------------------------------------------------------ SLA policy + reviewer profiles (managers)

class PolicyIn(BaseModel):
    first_review_hours: int = Field(ge=4, le=240)
    revision_review_hours: int = Field(ge=4, le=240)
    final_review_hours: int = Field(ge=2, le=240)


@router.get("/writing/policy")
def get_policy(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    return W.policy_hours(db, None if p.is_hangyul else p.org_id)


@router.put("/writing/policy")
def put_policy(body: PolicyIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _manager(p)
    org_id = None if p.is_hangyul else p.org_id
    pol = db.scalar(select(WritingPolicy).where(WritingPolicy.organization_id == org_id)) if org_id else \
        db.scalar(select(WritingPolicy).where(WritingPolicy.organization_id.is_(None)))
    if pol is None:
        pol = WritingPolicy(organization_id=org_id)
        db.add(pol)
    pol.first_review_hours, pol.revision_review_hours, pol.final_review_hours = body.first_review_hours, body.revision_review_hours, body.final_review_hours
    audit(db, action="writing.policy_updated", entity_type="writing_policy", actor=p, detail=body.model_dump())
    db.commit()
    return W.policy_hours(db, org_id)


def _ser_profile(db: Session, m: OrganizationMember, rp: ReviewerProfile | None) -> dict:
    u = db.get(User, m.user_id)
    return {"user": {"id": str(u.id), "full_name": u.full_name}, "role": m.role.value,
            "languages": (rp.languages if rp else None) or m.languages or [], "degrees": rp.degrees if rp else [],
            "fields": rp.fields if rp else [], "university_ids": rp.university_ids if rp else [], "countries": rp.countries if rp else [],
            "capacity": rp.capacity if rp else 12, "open_reviews": W._open_reviews(db, u.id), "has_profile": rp is not None}


@router.get("/writing/reviewers")
def reviewers(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _staff(p)
    q = select(OrganizationMember).where(OrganizationMember.is_active.is_(True), OrganizationMember.role.in_(W.REVIEWER_ROLES))
    q = q.where(OrganizationMember.organization_id == p.org_id)
    return {"items": [_ser_profile(db, m, db.scalar(select(ReviewerProfile).where(ReviewerProfile.user_id == m.user_id)))
                      for m in db.scalars(q).all()]}


class ProfileIn(BaseModel):
    languages: list[str] = Field(default_factory=list, max_length=12)
    degrees: list[str] = Field(default_factory=list, max_length=8)
    fields: list[str] = Field(default_factory=list, max_length=20)
    university_ids: list[str] = Field(default_factory=list, max_length=20)
    countries: list[str] = Field(default_factory=list, max_length=20)
    capacity: int = Field(default=12, ge=1, le=100)


@router.put("/writing/reviewers/{user_id}")
def put_reviewer(user_id: str, body: ProfileIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    _manager(p)
    uid = parse_uuid(user_id)
    m = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == uid, OrganizationMember.organization_id == p.org_id))
    if not m:
        raise forbidden()
    rp = db.scalar(select(ReviewerProfile).where(ReviewerProfile.user_id == uid))
    if rp is None:
        rp = ReviewerProfile(user_id=uid, organization_id=p.org_id)
        db.add(rp)
    for k, v in body.model_dump().items():
        setattr(rp, k, v)
    audit(db, action="writing.reviewer_profile", entity_type="reviewer_profile", entity_id=uid, actor=p, detail=body.model_dump())
    db.commit()
    return _ser_profile(db, m, rp)


# ------------------------------------------------------------------ internal insights (managers)

@router.get("/writing/insights")
def insights(period_days: int = Query(90, ge=7, le=730), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Manager analytics: review turnaround, revision rounds, SLA breaches, and outcome patterns (n per group,
    n<5 withheld, no causal claims). Agencies see their own organisation; Hangyul sees everything."""
    _manager(p)
    org_id = None if p.is_hangyul else p.org_id
    W.record_outcomes(db)
    out = {"metrics": W.writing_metrics(db, org_id, period_days), "patterns": W.outcome_patterns(db, org_id)}
    db.commit()
    return out


# ------------------------------------------------------------------ V6: suggestion decisions + authorship statement

class DecisionIn(BaseModel):
    decision: str = Field(pattern="^(ACCEPT|REJECT)$")
    note: str | None = Field(default=None, max_length=1000)


@router.post("/writing/essays/{essay_id}/suggestions/{comment_id}/decision")
def decide_suggestion(essay_id: str, comment_id: str, body: DecisionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The student accepts (applied as a new version written by the student) or declines a reviewer's suggested
    wording. The reviewer sees the decision on the comment."""
    e = _essay(db, p, essay_id)
    W.decide_suggestion(db, e, comment_id, body.decision, body.note, p)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


class AttestIn(BaseModel):
    confirm: bool
    locale: str | None = Field(default=None, max_length=10)


@router.post("/writing/essays/{essay_id}/attest")
def attest(essay_id: str, body: AttestIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The student's authorship statement for the current version ("These are my own words and facts"). Clients that
    submit without it (older apps) can record it here; the web app sends it with the submission."""
    if not body.confirm:
        raise HTTPException(422, "Confirm the statement to record it.")
    e = _essay(db, p, essay_id)
    W.attest(db, e, p, body.locale)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)
