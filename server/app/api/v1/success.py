"""V5 — admission success API (owned by the success workstream; see docs/ADMISSION_SUCCESS.md, docs/SUBMISSION_CONNECTORS.md).

Strategy (what still affects each application), portfolio (the student's set of options + counselor review) and the
submission hub (method per university, guided hand-off, evidence, application-fee status). Tenant isolation goes through
``app.services.access`` (404 on anything outside the caller's scope).
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import iso, parse_uuid
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_agency_or_hangyul, require_student
from app.models import Application, PortfolioReview, Program, ProgramIntake, SubmissionConnector, University
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.services import strategy, submission
from app.services.access import ensure_student_access, forbidden, get_application_for

router = APIRouter(tags=["success"])

REVIEW_DECISIONS = ("BALANCED", "ADD_OPTION", "DROP_OPTION", "SPREAD_DEADLINES", "BUDGET_TALK", "DISCUSS")


def _app_summary(db: Session, app: Application) -> dict:
    uni = db.get(University, app.university_id)
    prog = db.get(Program, app.program_id)
    intake = db.get(ProgramIntake, app.intake_id)
    return {"id": str(app.id), "status": app.status.value, "university": {"id": str(uni.id), "name_en": uni.name_en},
            "program": {"id": str(prog.id), "name_en": prog.name_en}, "deadline": iso(intake.application_deadline)}


def _audience(p: Principal) -> str:
    return "student" if p.is_student else "agency"


def _staff_app(db: Session, p: Principal, app_id: str) -> Application:
    """Strategy is Hangyul's advice to the student and their counselor — never shown to universities."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if p.is_university:
        raise forbidden()
    return app


# ------------------------------------------------------------------------------------------------------------ strategy


@router.get("/me/strategy")
def my_strategy(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """One line per application (Ready / N things to improve / Blocked by X) + the top three things to do today."""
    items = []
    for s in strategy.strategies_for_student(db, p.id):
        app = db.get(Application, parse_uuid(s["application_id"]))
        items.append({**s, "application": _app_summary(db, app)})
    return {"items": items, "today": strategy.today_for_student(db, p.user)}


@router.get("/applications/{app_id}/strategy")
def application_strategy(app_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    app = _staff_app(db, p, app_id)
    out = strategy.application_strategy(db, app, audience=_audience(p))
    out["application"] = _app_summary(db, app)
    return out


@router.get("/agency/students/{student_id}/strategy")
def student_strategy(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    items = []
    for s in strategy.strategies_for_student(db, sid, audience="agency"):
        items.append({**s, "application": _app_summary(db, db.get(Application, parse_uuid(s["application_id"])))})
    return {"items": items}


# ----------------------------------------------------------------------------------------------------------- portfolio


@router.get("/me/portfolio")
def my_portfolio(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    out = strategy.portfolio(db, p.id)
    if out["review"]:
        # The counselor's review note is a staff note; the student sees that (and when) their plan was reviewed.
        out["review"] = {k: v for k, v in out["review"].items() if k not in ("note", "observations", "stale")}
    return out


@router.get("/agency/students/{student_id}/portfolio")
def student_portfolio(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    return strategy.portfolio(db, sid)


class ReviewIn(BaseModel):
    decision: str = Field(pattern="^(" + "|".join(REVIEW_DECISIONS) + ")$")
    note: str | None = Field(default=None, max_length=2000)


@router.post("/agency/students/{student_id}/portfolio/review", status_code=201)
def review_portfolio(student_id: str, body: ReviewIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    if False:  # V22: every agency admin may record outcomes
        raise HTTPException(403, "Only counselors and managers record a portfolio review.")
    current = strategy.portfolio(db, sid)
    r = PortfolioReview(student_user_id=sid, organization_id=p.org_id, reviewed_by_user_id=p.id, reviewed_at=utcnow(), decision=body.decision,
                        note=(body.note or "").strip() or None, observations=[o["code"] for o in current["observations"]])
    db.add(r)
    audit(db, action="portfolio.review", entity_type="student", entity_id=sid, actor=p, subject_user_id=sid, detail={"decision": body.decision})
    db.commit()
    return strategy.portfolio(db, sid)


# ---------------------------------------------------------------------------------------------------------- submission


def _viewer(p: Principal) -> str:
    return "university" if p.is_university else "student" if p.is_student else "agency"


@router.get("/applications/{app_id}/submission")
def get_submission(app_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    app = get_application_for(db, p, parse_uuid(app_id))
    return submission.submission_view(db, app, viewer=_viewer(p))


@router.post("/applications/{app_id}/submission/handoff")
def submission_handoff(app_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student is leaving for the official portal: remember it, so the page asks for the confirmation on return."""
    app = get_application_for(db, p, parse_uuid(app_id))
    submission.handoff(db, app, p.id)
    track(db, "submission_handed_off", user_id=p.id, university_id=app.university_id, application_id=app.id)
    audit(db, action="submission.handoff", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id)
    db.commit()
    return submission.submission_view(db, app, viewer="student")


class ConfirmIn(BaseModel):
    external_reference: str | None = Field(default=None, max_length=120)
    submitted_on: date | None = None
    receipt_document_id: str | None = None
    fee_status: str | None = Field(default=None, pattern="^(NOT_REQUIRED|UNPAID|PAID|CONFIRMED|UNKNOWN)$")
    fee_paid_on: date | None = None
    note: str | None = Field(default=None, max_length=2000)


@router.post("/applications/{app_id}/submission/confirm")
def submission_confirm(app_id: str, body: ConfirmIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Record the external submission. With a confirmation number or receipt → SUBMITTED_CONFIRMED and the application
    moves READY → SUBMITTED through the normal transition (same permissions and side effects). Without evidence →
    SUBMITTED_UNCONFIRMED and the application stays where it is."""
    from app.api.v1.applications import TransitionIn, transition

    app = get_application_for(db, p, parse_uuid(app_id))
    if p.is_university:
        raise forbidden()
    if False:  # V22: every agency admin may record outcomes
        raise HTTPException(403, "Document reviewers cannot record submissions.")
    role = "STUDENT" if p.is_student else "HANGYUL" if p.is_hangyul else "AGENCY"
    receipt = parse_uuid(body.receipt_document_id) if body.receipt_document_id else None
    before = submission.get_record(db, app.id)
    before_state = (before.status, before.external_reference, before.receipt_document_id) if before else None
    rec = submission.record_confirmation(db, app, actor_id=p.id, actor_role=role, external_reference=body.external_reference,
                                         submitted_on=body.submitted_on, receipt_document_id=receipt, fee_status=body.fee_status,
                                         fee_paid_on=body.fee_paid_on, note=body.note, actor_org_id=p.org_id if p.is_agency else None)
    if before_state == (rec.status, rec.external_reference, rec.receipt_document_id) and rec.status == "SUBMITTED_CONFIRMED" and not body.fee_status:
        db.commit()  # duplicate action: already recorded exactly like this — no second audit row, no second transition
        return submission.submission_view(db, app, viewer=_viewer(p))
    audit(db, action="submission.record", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
          detail={"status": rec.status, "evidence": rec.evidence_kind, "method": rec.method,
                  "authorization_id": str(rec.authorization_id) if rec.authorization_id else None})
    if rec.status == "SUBMITTED_CONFIRMED" and app.status == S.READY:
        track(db, "submission_confirmed", user_id=app.student_user_id, university_id=app.university_id, application_id=app.id)
        # The state machine stays authoritative: the existing transition endpoint does the move (and commits).
        transition(str(app.id), TransitionIn(to=S.SUBMITTED, external_reference=(rec.external_reference or None) and rec.external_reference[:80],
                                             note="Submission confirmed with evidence"), p, db)
    else:
        if rec.status == "SUBMITTED_CONFIRMED" and rec.external_reference and not app.external_reference:
            app.external_reference = rec.external_reference[:80]
        db.commit()
    return submission.submission_view(db, app, viewer=_viewer(p))


class FeeIn(BaseModel):
    status: str = Field(pattern="^(NOT_REQUIRED|UNPAID|PAID|CONFIRMED|UNKNOWN)$")
    amount: int | None = Field(default=None, ge=0)
    paid_on: date | None = None


@router.post("/applications/{app_id}/submission/fee")
def submission_fee(app_id: str, body: FeeIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """University application fee status — separate from the Hangyul service fee and from tuition."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if p.is_university:
        raise forbidden()
    role = "STUDENT" if p.is_student else "HANGYUL" if p.is_hangyul else "AGENCY"
    rec = submission.ensure_record(db, app)
    submission.set_fee(rec, body.status, actor_role=role, paid_on=body.paid_on, amount=body.amount)
    audit(db, action="submission.fee", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id, detail={"status": body.status})
    db.commit()
    return submission.submission_view(db, app, viewer=_viewer(p))


class AuthorizeIn(BaseModel):
    accept: bool
    consent_version: str = Field(max_length=32)


@router.post("/applications/{app_id}/submission/authorize")
def submission_authorize(app_id: str, body: AuthorizeIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """V6: the student authorises the assigned agency to submit (explicit consent + snapshot of what is authorised)."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if not body.accept:
        raise HTTPException(422, "Consent must be given explicitly.")
    if body.consent_version != submission.CONSENT_VERSION:
        raise HTTPException(409, "The consent text changed — please review it again.")
    had = submission.active_authorization(db, app.id)
    auth = submission.authorize(db, app, p.id)
    if had is None:
        audit(db, action="submission.authorize", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
              detail={"authorization_id": str(auth.id), "agency_org_id": str(auth.agency_org_id), "consent_version": auth.consent_version,
                      "documents": len(auth.snapshot.get("documents", []))})
        track(db, "submission_authorized", user_id=p.id, university_id=app.university_id, application_id=app.id, organization_id=app.agency_org_id)
    db.commit()
    return submission.submission_view(db, app, viewer="student")


class RevokeIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


@router.post("/applications/{app_id}/submission/authorization/revoke")
def submission_revoke(app_id: str, body: RevokeIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """V6: withdraw consent before the agency submits (idempotent)."""
    app = get_application_for(db, p, parse_uuid(app_id))
    was = submission.active_authorization(db, app.id)
    auth = submission.revoke(db, app, p.id, body.reason)
    if was is not None and auth is not None:
        audit(db, action="submission.revoke", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
              detail={"authorization_id": str(auth.id)})
    db.commit()
    return submission.submission_view(db, app, viewer="student")


class FailureIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


@router.post("/applications/{app_id}/submission/failure")
def submission_failure(app_id: str, body: FailureIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """V6: the authorised agency's attempt on the official portal failed — record why (nothing is marked submitted)."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if not p.is_agency:
        raise forbidden() if p.is_university else HTTPException(403, "Only the authorised agency reports a submission problem.")
    if not (p.is_agency or p.is_hangyul):
        raise HTTPException(403, "Document reviewers cannot record submissions.")
    submission.report_failure(db, app, reason=body.reason)
    audit(db, action="submission.failure", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id,
          detail={"reason": body.reason[:200]})
    db.commit()
    return submission.submission_view(db, app, viewer="agency")


@router.post("/applications/{app_id}/submission/api-submit")
def submission_api_submit(app_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """DIRECT_API / PARTNER_API would submit here. No integration exists, so this always answers 409 "awaiting provider
    integration" (the UI never shows a button for it)."""
    app = get_application_for(db, p, parse_uuid(app_id))
    if p.is_university:
        raise forbidden()
    try:
        submission.api_submit(db, app)
    except submission.NotConfigured as e:
        audit(db, action="submission.api_not_configured", entity_type="application", entity_id=app.id, actor=p, subject_user_id=app.student_user_id)
        db.commit()
        raise HTTPException(409, f"AWAITING_PROVIDER: {e}") from None
    raise HTTPException(409, "AWAITING_PROVIDER")  # pragma: no cover - no connector submits today


@router.get("/agency/submissions")
def agency_submissions(view: str = Query("ready", pattern="^(ready|awaiting|submitted|all)$"), p: Principal = Depends(require_agency_or_hangyul),
                       db: Session = Depends(get_db)):
    """V6 "Ready to submit" queue (authorised agency submission). Scoped like every agency list; reviewers read only."""
    out = submission.agency_queue(db, p, view=view)
    out["can_record"] = bool(p.is_agency)
    return out


@router.post("/dev/submission-fixture/application", status_code=201)
def dev_fixture_application(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Development only (404 in production): start an application on the authorised-submission *fixture* program
    (an inactive, clearly named demo program) so E2E can exercise the agency flow without touching real catalogue data."""
    from app.api.v1.applications import CreateIn, create_application

    if submission._production():
        raise HTTPException(404, "Not found")
    conn = submission.fixture_connector(db)
    if conn is None:
        raise HTTPException(404, "No development fixture is seeded.")
    prog = db.get(Program, conn.program_id)
    prog.is_active = True  # create_application only accepts active programs; the fixture is re-hidden right after
    try:
        return create_application(CreateIn(program_id=str(prog.id)), p, db)
    finally:
        prog.is_active = False
        db.commit()


@router.get("/submission/connectors")
def list_connectors(university_id: str | None = None, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Submission method per university (research-backed or NEEDS_REVIEW placeholder)."""
    stmt = select(SubmissionConnector, University).join(University, University.id == SubmissionConnector.university_id).order_by(University.name_en)
    if university_id:
        stmt = stmt.where(SubmissionConnector.university_id == parse_uuid(university_id))
    return {"items": [submission.ser_connector(c, u) for c, u in db.execute(stmt).all()], "research_file": submission.RESEARCH_FILE.exists()}


@router.get("/success/metrics")
def metrics(cohort: str | None = Query(None, pattern=r"^\d{4}-(SPRING|FALL|SUMMER|WINTER)$"), agency_id: str | None = None,
            p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    org = p.org_id if p.is_agency else (parse_uuid(agency_id) if agency_id else None)
    return strategy.success_metrics(db, org, cohort)
