"""V5 — visa concierge API (owned by the visa_routes workstream; see docs/VISA_ROUTES.md → Implementation).

Student (``/me/visa-route…``): the resolved plan (route, post, method, steps, documents with reuse status, timing,
caveats, preparation form, tracking, help), the one jurisdiction answer, form confirmation, document links,
appointment, official hand-off, submission (with evidence), embassy requests, decision, issued visa, help.
Staff (``/visa-route/students/{id}…``): the same plan for an assigned student (agency) or any student (Hangyul), the
tracking actions they may record for the student, "pack reviewed", and Hangyul-only university visa tier.
Universities have no access (404). Nothing here submits or declares anything to an official system.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_agency_or_hangyul
from app.models import University
from app.models.base import utcnow
from app.models.v5_visa_routes import VisaEmbassyRequest
from app.services import visa_routes as svc
from app.services.access import ensure_student_access, forbidden
from app.services.tasks_engine import generate_for_student

router = APIRouter(tags=["visa_routes"])


def _student_id(p: Principal, student_id: str | None, db: Session):
    """Students act on themselves; agency (assigned) and Hangyul staff on a student they can see. Universities never."""
    if p.is_university:
        raise forbidden()
    if student_id is None:
        if not p.is_student:
            raise HTTPException(403, "Student account required.")
        return p.id
    if not (p.is_agency or p.is_hangyul):
        raise forbidden()
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    return sid


def _staff_can_write(p: Principal) -> None:
    """V22: every agency admin may update the visa record; the actor is audited."""
    return None


def _done(db: Session, p: Principal, sid, action: str, detail: dict | None = None) -> dict:
    case = svc.current_case(db, sid)
    audit(db, action=f"visa_route.{action}", entity_type="visa_case", entity_id=case.id if case else None, actor=p, subject_user_id=sid, detail=detail or {})
    plan = svc.build_plan(db, sid, staff=not p.is_student)
    generate_for_student(db, sid)
    db.commit()
    return plan


# ---------------------------------------------------------------------------------------------- read
@router.get("/me/visa-route")
def my_plan(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, None, db)
    plan = svc.build_plan(db, sid)
    db.commit()
    return plan


@router.get("/visa-route/students/{student_id}")
def student_plan(student_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    plan = svc.build_plan(db, sid, staff=True)
    db.commit()
    return plan


# ---------------------------------------------------------------------------------------------- inputs
class AnswerIn(BaseModel):
    value: str | None = Field(default=None, max_length=300)
    sponsor: str | None = Field(default=None, max_length=24)


def _answers(sid, body: AnswerIn, p: Principal, db: Session):
    if body.value:
        svc.answer_question(db, sid, body.value)
    if body.sponsor is not None:
        if body.sponsor not in svc.SPONSORS:
            raise HTTPException(422, "Choose who pays for your studies.")
        svc.set_answers(db, sid, {"sponsor": body.sponsor})
    return _done(db, p, sid, "answers", {"value": body.value, "sponsor": body.sponsor})


@router.put("/me/visa-route/answers")
def my_answers(body: AnswerIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _answers(_student_id(p, None, db), body, p, db)


@router.put("/visa-route/students/{student_id}/answers")
def staff_answers(student_id: str, body: AnswerIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _answers(sid, body, p, db)


class SectionIn(BaseModel):
    values: dict[str, str] | None = None


@router.post("/me/visa-route/form/{section}")
def confirm_section(section: str, body: SectionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The student confirms a section of the PREPARATION form (their own check). Nothing is sent or declared anywhere."""
    sid = _student_id(p, None, db)
    case = svc.require_case(db, sid)
    svc.confirm_section(db, case, section, body.values, actor=p)
    return _done(db, p, sid, "form_confirm", {"section": section, "corrected": sorted((body.values or {}).keys())})


@router.delete("/me/visa-route/form/{section}")
def edit_section(section: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, None, db)
    case = svc.require_case(db, sid)
    if section not in svc.FORM_SECTIONS:
        raise HTTPException(422, "Unknown section.")
    svc.unconfirm_section(db, case, section)
    return _done(db, p, sid, "form_edit", {"section": section})


class ItemIn(BaseModel):
    document_id: str | None = Field(default=None, max_length=40)  # "" unlinks
    received: bool | None = None


def _item(sid, key: str, body: ItemIn, p: Principal, db: Session):
    case = svc.require_case(db, sid)
    svc.link_item(db, case, key[:64], document_id=body.document_id, received=body.received)
    return _done(db, p, sid, "item", {"key": key, "document_id": body.document_id, "received": body.received})


@router.post("/me/visa-route/items/{key}")
def my_item(key: str, body: ItemIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _item(_student_id(p, None, db), key, body, p, db)


@router.post("/visa-route/students/{student_id}/items/{key}")
def staff_item(student_id: str, key: str, body: ItemIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _item(sid, key, body, p, db)


# ---------------------------------------------------------------------------------------------- tracking
class AppointmentIn(BaseModel):
    on: date | None = None
    status: str | None = Field(default=None, max_length=12)
    reference: str | None = Field(default=None, max_length=120)
    post_key: str | None = Field(default=None, max_length=64)


def _appointment(sid, body: AppointmentIn, p, db):
    case = svc.require_case(db, sid)
    svc.set_appointment(db, case, on=body.on, status=body.status, reference=body.reference, post_key=body.post_key)
    return _done(db, p, sid, "appointment", {"on": body.on.isoformat() if body.on else None, "status": body.status})


@router.put("/me/visa-route/appointment")
def my_appointment(body: AppointmentIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _appointment(_student_id(p, None, db), body, p, db)


@router.put("/visa-route/students/{student_id}/appointment")
def staff_appointment(student_id: str, body: AppointmentIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _appointment(sid, body, p, db)


@router.post("/me/visa-route/handoff")
def my_handoff(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """The student is leaving Hangyul for the official booking / application system: remember it so we can ask for the
    result when they come back (the link itself is the embassy's / visa portal's official page)."""
    sid = _student_id(p, None, db)
    svc.record_handoff(db, svc.require_case(db, sid))
    return _done(db, p, sid, "handoff")


class SubmissionIn(BaseModel):
    submitted_on: date
    reference: str | None = Field(default=None, max_length=120)
    document_id: str | None = Field(default=None, max_length=40)


def _submission(sid, body: SubmissionIn, p, db):
    case = svc.require_case(db, sid)
    svc.record_submission(db, case, submitted_on=body.submitted_on, reference=body.reference, document_id=body.document_id, actor=p)
    return _done(db, p, sid, "submission", {"on": body.submitted_on.isoformat(), "has_reference": bool(body.reference), "has_receipt": bool(body.document_id)})


@router.post("/me/visa-route/submission")
def my_submission(body: SubmissionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _submission(_student_id(p, None, db), body, p, db)


@router.post("/visa-route/students/{student_id}/submission")
def staff_submission(student_id: str, body: SubmissionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _submission(sid, body, p, db)


class RequestIn(BaseModel):
    note: str = Field(min_length=3, max_length=2000)
    due_on: date | None = None


def _request(sid, body: RequestIn, p, db):
    case = svc.require_case(db, sid)
    svc.add_embassy_request(db, case, note=body.note, due_on=body.due_on, actor=p)
    return _done(db, p, sid, "embassy_request", {"due_on": body.due_on.isoformat() if body.due_on else None})


@router.post("/me/visa-route/requests")
def my_request(body: RequestIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _request(_student_id(p, None, db), body, p, db)


@router.post("/visa-route/students/{student_id}/requests")
def staff_request(student_id: str, body: RequestIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _request(sid, body, p, db)


class SentIn(BaseModel):
    document_id: str | None = Field(default=None, max_length=40)


def _sent(sid, request_id: str, body: SentIn, p, db):
    case = svc.require_case(db, sid)
    r = db.get(VisaEmbassyRequest, parse_uuid(request_id))
    if r is None or r.student_user_id != sid:
        raise forbidden()
    svc.request_sent(db, case, r, document_id=body.document_id)
    return _done(db, p, sid, "embassy_request_sent", {"request_id": request_id})


@router.post("/me/visa-route/requests/{request_id}/sent")
def my_sent(request_id: str, body: SentIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _sent(_student_id(p, None, db), request_id, body, p, db)


@router.post("/visa-route/students/{student_id}/requests/{request_id}/sent")
def staff_sent(student_id: str, request_id: str, body: SentIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _sent(sid, request_id, body, p, db)


class DecisionIn(BaseModel):
    decision: str = Field(max_length=12)
    decided_on: date
    document_id: str | None = Field(default=None, max_length=40)


def _decision(sid, body: DecisionIn, p, db):
    case = svc.require_case(db, sid)
    svc.record_decision(db, case, decision=body.decision, decided_on=body.decided_on, document_id=body.document_id, actor=p)
    return _done(db, p, sid, "decision", {"decision": body.decision})


@router.post("/me/visa-route/decision")
def my_decision(body: DecisionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _decision(_student_id(p, None, db), body, p, db)


@router.post("/visa-route/students/{student_id}/decision")
def staff_decision(student_id: str, body: DecisionIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _decision(sid, body, p, db)


class IssuedIn(BaseModel):
    document_id: str = Field(max_length=40)
    issued_on: date | None = None
    expires_on: date | None = None


def _issued(sid, body: IssuedIn, p, db):
    case = svc.require_case(db, sid)
    svc.record_issued(db, case, document_id=body.document_id, issued_on=body.issued_on, expires_on=body.expires_on, actor=p)
    return _done(db, p, sid, "issued", {"issued_on": body.issued_on.isoformat() if body.issued_on else None})


@router.post("/me/visa-route/issued")
def my_issued(body: IssuedIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _issued(_student_id(p, None, db), body, p, db)


@router.post("/visa-route/students/{student_id}/issued")
def staff_issued(student_id: str, body: IssuedIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    return _issued(sid, body, p, db)


class HelpIn(BaseModel):
    message: str = Field(min_length=3, max_length=2000)


@router.post("/me/visa-route/help", status_code=201)
def my_help(body: HelpIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Ask a person: opens (or adds to) the VISA_SUPPORT service case routed to the agency / Hangyul operations."""
    sid = _student_id(p, None, db)
    plan = svc.resolve(db, sid)
    reason = plan.get("status") if plan.get("status") not in ("RESOLVED", "NEEDS_ANSWER") else "STUDENT_QUESTION"
    sc = svc.escalate_student(db, sid, reason, body.message, p)
    audit(db, action="visa_route.help", entity_type="service_case", entity_id=sc.id, actor=p, subject_user_id=sid, detail={"reason": reason})
    out = svc.build_plan(db, sid)
    db.commit()
    return out


@router.post("/visa-route/students/{student_id}/pack-reviewed")
def pack_reviewed(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = _student_id(p, student_id, db)
    _staff_can_write(p)
    case = svc.require_case(db, sid)
    t = svc.ensure_track(db, case)
    t.pack_reviewed_at, t.pack_reviewed_by_id = utcnow(), p.id
    return _done(db, p, sid, "pack_reviewed")


@router.get("/agency/visa-today")
def visa_today(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Preview of the coordinator hook ``today_items`` (agency Today)."""
    return {"items": svc.today_items(db, p)}


class TierIn(BaseModel):
    tier: str = Field(max_length=16)
    verified_at: date | None = None


@router.put("/visa-route/universities/{university_id}/certification")
def set_tier(university_id: str, body: TierIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Hangyul staff record a university's visa certification tier from the yearly MOJ/MOE results (with the date checked)."""
    if not p.is_hangyul:
        raise forbidden()
    if body.tier not in svc.TIERS:
        raise HTTPException(422, "Unknown tier.")
    if body.tier != "UNKNOWN" and body.verified_at is None:
        raise HTTPException(422, "Add the date the tier was checked in the official results.")
    u = db.scalar(select(University).where(University.id == parse_uuid(university_id)))
    if u is None:
        raise forbidden()
    u.visa_certification, u.visa_certification_verified_at = body.tier, body.verified_at
    audit(db, action="university.visa_certification", entity_type="university", entity_id=u.id, actor=p, detail={"tier": body.tier})
    db.commit()
    return {"id": str(u.id), "visa_certification": u.visa_certification, "verified_at": body.verified_at.isoformat() if body.verified_at else None}
