"""V5 — concierge API (owned by the concierge workstream; see docs/ARRIVAL_SERVICES.md).

Student: service cases, arrival journey, flight, airport pickup, housing actions (dorm application, listing interest,
lease review, move-in), "Need help in Korea?".
Agency / Hangyul: service-case queue with views, case detail + updates + events, vendors, service metrics.
Universities have no access (404).
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul, require_student
from app.models import Document, HousingListing, ServiceCase, User, Vendor
from app.models.base import utcnow
from app.models.enums import HousingStatus
from app.services import concierge as svc
from app.services.access import ensure_student_access

router = APIRouter(tags=["concierge"])

AIRPORTS = {"ICN", "GMP", "PUS", "CJU", "TAE", "CJJ", "MWX", "YNY"}
CONTACT_METHODS = {"KAKAOTALK", "WHATSAPP", "PHONE", "IN_APP", "ZALO", "LINE", "TELEGRAM"}


def _doc_of_student(db: Session, doc_id: str | None, student_user_id):
    if not doc_id:
        return None
    d = db.get(Document, parse_uuid(doc_id))
    if not d or d.owner_user_id != student_user_id:
        raise HTTPException(422, "Attach a document from this student's documents.")
    return d.id


# =============================================================================================== student
@router.get("/me/service-cases")
def my_cases(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == p.id).order_by(ServiceCase.created_at.desc())).all()
    return {"items": [svc.ser_case(db, c, staff=False, with_events=True) for c in rows]}


class StudentCaseIn(BaseModel):
    type: str
    note: str | None = Field(default=None, max_length=2000)
    details: dict | None = None


@router.post("/me/service-cases", status_code=201)
def request_case(body: StudentCaseIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    if body.type not in svc.STUDENT_REQUESTABLE:
        raise HTTPException(422, "This service can't be requested here.")
    if svc.open_cases(db, p.id, body.type) and body.type != "OTHER":
        raise HTTPException(409, "You already have an open request of this kind.")
    details = {k: v for k, v in (body.details or {}).items() if isinstance(v, (str, int, float, bool)) or v is None}
    c = svc.create_case(db, p.id, body.type, actor_id=p.id, details=details, note=body.note)
    audit(db, action="service_case.create", entity_type="service_case", entity_id=c.id, actor=p, subject_user_id=p.id, detail={"type": c.case_type})
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


class FeedbackIn(BaseModel):
    ok: bool
    comment: str | None = Field(default=None, max_length=500)


@router.post("/me/service-cases/{case_id}/feedback")
def case_feedback(case_id: str, body: FeedbackIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    if not svc.is_closed(c) and c.status not in ("PICKED_UP",):
        raise HTTPException(409, "You can tell us how it went once this is finished.")
    c.feedback_ok, c.feedback_comment, c.feedback_at = body.ok, (body.comment or None), utcnow()
    svc.add_event(db, c, "FEEDBACK", actor_id=p.id, body=body.comment, data={"ok": body.ok})
    db.commit()
    return {"ok": True}


@router.post("/me/service-cases/{case_id}/cancel")
def cancel_case(case_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    svc.transition(db, c, "CANCELLED", actor_id=p.id, staff=False, note="Cancelled by the student")
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


class StudentStepIn(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=1000)
    document_id: str | None = None
    details: dict | None = None


# Steps the student may record themselves (their own external actions) — everything else is staff-only.
STUDENT_MOVES = {
    ("DORMITORY", "PLANNING", "APPLIED"), ("DORMITORY", "ASSIGNED", "CONFIRMED"), ("DORMITORY", "CONFIRMED", "MOVED_IN"),
    ("HOUSING_SEARCH", "DEPOSIT", "CONFIRMED"), ("HOUSING_SEARCH", "CONFIRMED", "MOVED_IN"),
    ("RESIDENCE_CARD", "PREPARING", "APPOINTMENT_BOOKED"), ("RESIDENCE_CARD", "APPOINTMENT_BOOKED", "SUBMITTED"),
    ("RESIDENCE_CARD", "PREPARING", "GROUP_FILING"), ("RESIDENCE_CARD", "READY", "COLLECTED"), ("RESIDENCE_CARD", "SUBMITTED", "READY"),
    ("TEMPORARY_HOUSING", "BOOKED", "CHECKED_IN"), ("TEMPORARY_HOUSING", "CHECKED_IN", "COMPLETED"),
}


@router.post("/me/service-cases/{case_id}/step")
def student_step(case_id: str, body: StudentStepIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student records their own external step (applied on the dorm portal, booked the HiKorea visit, submitted…)."""
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    if (c.case_type, c.status, body.status) not in STUDENT_MOVES:
        raise HTTPException(409, "Your counselor updates this step.")
    doc = _doc_of_student(db, body.document_id, p.id)
    if body.details:
        d = dict(c.details or {})
        for k in ("appointment_at", "office", "reference", "receipt_note"):
            if k in body.details:
                d[k] = str(body.details[k])[:200] if body.details[k] is not None else None
        c.details = d
        if c.case_type == "RESIDENCE_CARD" and body.details.get("appointment_at"):
            try:
                c.due_at = datetime.fromisoformat(str(body.details["appointment_at"]).replace("Z", "+00:00"))
            except ValueError:
                raise HTTPException(422, "Appointment date is not valid.")
    svc.transition(db, c, body.status, actor_id=p.id, staff=False, note=body.note, attachment_document_id=doc)
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


@router.get("/me/arrival-journey")
def arrival_journey(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    return svc.arrival_journey(db, p.id)


class ItemsIn(BaseModel):
    completed_items: list[str]


@router.put("/me/arrival-journey/items")
def set_items(body: ItemsIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    plan = svc._plan(db, p.id)
    keep = [i for i in (plan.completed_items or []) if i not in svc.SELF_ITEMS]
    plan.completed_items = sorted(set(keep) | {i for i in body.completed_items if i in svc.SELF_ITEMS})
    db.commit()
    return {"ok": True, "completed_items": plan.completed_items}


class FlightIn(BaseModel):
    number: str = Field(min_length=2, max_length=20)
    airport: str
    scheduled_arrival: datetime
    terminal: str | None = Field(default=None, max_length=8)


@router.put("/me/flight")
def set_flight(body: FlightIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    if body.airport not in AIRPORTS:
        raise HTTPException(422, "Choose an arrival airport from the list.")
    plan = svc.set_flight(db, p.id, number=body.number, airport=body.airport, scheduled_arrival=body.scheduled_arrival, terminal=body.terminal)
    db.commit()
    return svc.flight_view(plan)


class PickupIn(BaseModel):
    passengers: int = Field(ge=1, le=6)
    luggage: int = Field(ge=0, le=10)
    destination_kind: str = Field(pattern="^(DORM|HOUSING|TEMPORARY|OTHER)$")
    destination_address: str | None = Field(default=None, max_length=300)
    special_requests: str | None = Field(default=None, max_length=500)
    contact_method: str
    contact_handle: str | None = Field(default=None, max_length=120)


@router.post("/me/pickup", status_code=201)
def request_pickup(body: PickupIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    if body.contact_method not in CONTACT_METHODS:
        raise HTTPException(422, "Choose how we can reach you on arrival day.")
    c = svc.request_pickup(db, p.id, body.model_dump(), actor_id=p.id)
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


# ---------------------------------------------------------------- housing actions
class HousingPlanIn(BaseModel):
    option: str | None = None
    profile: dict | None = None
    move_in: dict | None = None


@router.put("/me/housing-plan")
def update_housing_plan(body: HousingPlanIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    h = svc._housing(db, p.id)
    if body.option is not None:
        if body.option not in svc.HOUSING_OPTIONS:
            raise HTTPException(422, "Unknown housing option.")
        h.preference = None if body.option == "UNDECIDED" else body.option
        if h.status == HousingStatus.NOT_STARTED:
            h.status = HousingStatus.RESEARCHING
    if body.profile is not None:
        h.profile = svc.clean_profile(body.profile)
        h.budget_monthly_krw = h.profile.get("monthly_budget_krw")
        h.max_commute_minutes = h.profile.get("max_commute_minutes")
    if body.move_in is not None:
        mi = dict(h.move_in or {})
        for k in ("date", "address", "check_in_method", "manager_contact", "deposit_status"):
            if k in body.move_in:
                v = body.move_in[k]
                mi[k] = str(v)[:300] if v not in (None, "") else None
        if "checklist_done" in body.move_in:
            mi["checklist_done"] = [x for x in body.move_in["checklist_done"] or [] if x in svc.MOVE_IN_CHECKLIST]
        if mi.get("deposit_status") not in (None, "UNPAID", "PAID", "NOT_APPLICABLE"):
            raise HTTPException(422, "Unknown deposit status.")
        h.move_in = mi
    db.commit()
    return {"ok": True}


class DormApplyIn(BaseModel):
    dormitory_id: str
    status: str = Field(default="PLANNING", pattern="^(PLANNING|APPLIED)$")


@router.post("/me/housing/dorm-application", status_code=201)
def dorm_application(body: DormApplyIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    from app.models import Dormitory

    d = db.get(Dormitory, parse_uuid(body.dormitory_id))
    if not d:
        raise HTTPException(404, "Dormitory not found.")
    h = svc._housing(db, p.id)
    h.dormitory_id, h.university_id, h.preference = d.id, d.university_id, "DORM"
    c = next(iter(svc.open_cases(db, p.id, "DORMITORY")), None)
    if c is None:
        c = svc.create_case(db, p.id, "DORMITORY", actor_id=p.id, details={"dormitory_id": str(d.id), "dormitory": d.name},
                            due_at=datetime.combine(d.application_closes, datetime.min.time()).replace(tzinfo=svc.SEOUL) if d.application_closes else None)
    else:
        c.details = {**(c.details or {}), "dormitory_id": str(d.id), "dormitory": d.name}
    if body.status == "APPLIED" and c.status == "PLANNING":
        svc.transition(db, c, "APPLIED", actor_id=p.id, staff=False, note="Student applied on the university portal")
    svc._on_status(db, c, c.status, c.status, at=utcnow())
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


@router.post("/me/housing/listings/{listing_id}/interest", status_code=201)
def listing_interest(listing_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    li = db.get(HousingListing, parse_uuid(listing_id))
    if not li or not li.is_active:
        raise HTTPException(404, "Listing not found.")
    for c in svc.open_cases(db, p.id, "HOUSING_SEARCH"):
        if (c.details or {}).get("listing_id") == str(li.id):
            raise HTTPException(409, "You already asked about this place.")
    v = db.get(Vendor, li.vendor_id)
    c = svc.create_case(db, p.id, "HOUSING_SEARCH", actor_id=p.id,
                        details={"listing_id": str(li.id), "listing": li.title, "is_demo_listing": li.is_demo},
                        note=f"Interested in: {li.title}")
    c.vendor_id = v.id if v else None
    h = svc._housing(db, p.id)
    if h.preference not in ("OFF_CAMPUS", "PARTNER"):
        h.preference = "PARTNER" if svc.student_vendor_label(v) == "PARTNER" else "OFF_CAMPUS"
    svc._on_status(db, c, c.status, c.status, at=utcnow())
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


class LeaseIn(BaseModel):
    case_id: str | None = None
    document_id: str | None = None
    address: str | None = Field(default=None, max_length=300)
    deposit_krw: int | None = Field(default=None, ge=0)
    rent_monthly_krw: int | None = Field(default=None, ge=0)
    start_date: date | None = None
    end_date: date | None = None
    landlord_name: str | None = Field(default=None, max_length=120)
    agent_name: str | None = Field(default=None, max_length=120)


@router.post("/me/housing/lease-review", status_code=201)
def lease_review(body: LeaseIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student shares a proposed contract (document) + the key terms they can read; the counselor/partner reviews it.
    Automatic flags cover only missing/unclear fields — never legal conclusions."""
    doc = _doc_of_student(db, body.document_id, p.id)
    c = svc.get_case_for(db, p, parse_uuid(body.case_id)) if body.case_id else None
    if c is not None and c.case_type != "HOUSING_SEARCH":
        raise HTTPException(422, "Lease review belongs to a housing search.")
    if c is None:
        c = svc.create_case(db, p.id, "HOUSING_SEARCH", actor_id=p.id, details={"source": "STUDENT_FOUND"}, note="Lease review requested")
    lease = {k: (v.isoformat() if isinstance(v, date) else v) for k, v in body.model_dump(exclude={"case_id", "document_id"}).items()}
    lease["document_id"] = str(doc) if doc else None
    c.details = {**(c.details or {}), "lease": lease}
    svc.add_event(db, c, "ATTACHMENT" if doc else "UPDATE", actor_id=p.id, body="Contract shared for review", visibility="STUDENT",
                  attachment_document_id=doc, data={"flags": svc.lease_flags(lease)})
    if c.status != "CONTRACT_REVIEW" and svc.can_transition(c.case_type, c.status, "CONTRACT_REVIEW"):
        svc.transition(db, c, "CONTRACT_REVIEW", actor_id=p.id, staff=False)
    h = svc._housing(db, p.id)
    h.status = HousingStatus.CONTRACT_REVIEW
    db.commit()
    return svc.ser_case(db, c, staff=False, with_events=True)


class HelpIn(BaseModel):
    category: str
    message: str = Field(min_length=3, max_length=2000)


@router.post("/me/help", status_code=201)
def need_help(body: HelpIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    c = svc.create_help(db, p.id, body.category, body.message, actor_id=p.id)
    audit(db, action="service_case.help", entity_type="service_case", entity_id=c.id, actor=p, subject_user_id=p.id,
          detail={"category": body.category, "routed_to": c.routed_to})
    db.commit()
    out = svc.ser_case(db, c, staff=False, with_events=True)
    if body.category == "MEDICAL":
        out["emergency"] = svc.emergency_numbers()
    return out


@router.get("/me/help")
def help_info(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == p.id, ServiceCase.help_category.is_not(None))
                      .order_by(ServiceCase.created_at.desc())).all()
    return {"categories": svc.HELP_CATEGORIES, "emergency": svc.emergency_numbers(), "requests": [svc.ser_case(db, c, staff=False, with_events=True) for c in rows]}


# =============================================================================================== agency / Hangyul
@router.get("/agency/service-cases")
def queue(view: str | None = Query(None), type: str | None = Query(None), owner: str | None = Query(None), student_id: str | None = None,
          p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if view and view not in svc.VIEWS:
        raise HTTPException(422, "Unknown view.")
    sid = parse_uuid(student_id) if student_id else None
    if sid:
        ensure_student_access(db, p, sid)
    return svc.list_cases(db, p, view=view, case_type=type, owner=owner, student_id=sid)


@router.get("/agency/service-cases/{case_id}")
def case_detail(case_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    return svc.ser_case(db, c, staff=True, with_events=True)


class StaffCaseIn(BaseModel):
    student_id: str
    type: str
    note: str | None = Field(default=None, max_length=2000)
    details: dict | None = None
    due_at: datetime | None = None


@router.post("/agency/service-cases", status_code=201)
def staff_create(body: StaffCaseIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not svc.staff_can_edit(p):
        raise HTTPException(403, "You do not have permission for this action.")
    sid = parse_uuid(body.student_id)
    ensure_student_access(db, p, sid)
    c = svc.create_case(db, sid, body.type, actor_id=p.id, details=body.details or {}, note=body.note, due_at=body.due_at)
    audit(db, action="service_case.create", entity_type="service_case", entity_id=c.id, actor=p, subject_user_id=sid, detail={"type": c.case_type})
    db.commit()
    return svc.ser_case(db, c, staff=True, with_events=True)


class CasePatch(BaseModel):
    status: str | None = None
    note: str | None = Field(default=None, max_length=2000)
    attachment_document_id: str | None = None
    owner_user_id: str | None = None
    vendor_id: str | None = None
    internal_notes: str | None = Field(default=None, max_length=4000)
    priority: str | None = None
    due_at: datetime | None = None
    cost: dict | None = None
    details: dict | None = None  # merged; staff-editable keys only (driver, dormitory, reference, lease…)


STAFF_DETAIL_KEYS = {"driver", "meeting_point", "reference", "dormitory", "room", "office", "appointment_at", "lease", "check_in",
                     "address", "provider_note", "listing"}


@router.patch("/agency/service-cases/{case_id}")
def patch_case(case_id: str, body: CasePatch, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not svc.staff_can_edit(p):
        raise HTTPException(403, "You do not have permission for this action.")
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    data = body.model_dump(exclude_unset=True)
    if "owner_user_id" in data:
        oid = parse_uuid(data["owner_user_id"]) if data["owner_user_id"] else None
        if oid and not (p.is_hangyul or db.scalar(select(User.id).where(User.id == oid))):
            raise HTTPException(422, "Unknown owner.")
        if oid and p.is_agency:
            from app.models import OrganizationMember

            if not db.scalar(select(OrganizationMember.id).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == oid,
                                                                 OrganizationMember.is_active.is_(True))):
                raise HTTPException(422, "Owner must be a member of your team.")
        c.owner_user_id = oid
        svc.add_event(db, c, "OWNER", actor_id=p.id, data={"owner_user_id": str(oid) if oid else None})
        svc._mark_first_action(c)
    if "vendor_id" in data:
        v = db.scalar(svc.vendors_visible_to(db, p).where(Vendor.id == parse_uuid(data["vendor_id"]))) if data["vendor_id"] else None
        if data["vendor_id"] and not v:
            raise HTTPException(422, "Unknown provider.")
        if v and v.quality_status == "SUSPENDED":
            raise HTTPException(422, "This provider is suspended.")
        c.vendor_id = v.id if v else None
        svc.add_event(db, c, "VENDOR", actor_id=p.id, body=v.name if v else None, visibility="STUDENT" if v else "INTERNAL")
        svc._mark_first_action(c)
    if "internal_notes" in data:
        c.internal_notes = data["internal_notes"]
    if "priority" in data and data["priority"]:
        if data["priority"] not in svc.PRIORITIES:
            raise HTTPException(422, "Unknown priority.")
        c.priority = data["priority"]
    if "due_at" in data:
        c.due_at = data["due_at"]
    if "cost" in data and data["cost"] is not None:
        cost = data["cost"]
        if cost.get("payer") not in svc.PAYERS:
            raise HTTPException(422, "Say who pays: student, hangyul, university or included.")
        amt = cost.get("amount")
        c.cost_amount = int(amt) if isinstance(amt, (int, float)) else None
        c.cost_currency = (cost.get("currency") or "KRW")[:3].upper()
        c.cost_payer = cost["payer"]
    if data.get("details"):
        d = dict(c.details or {})
        for k, v in data["details"].items():
            if k in STAFF_DETAIL_KEYS:
                d[k] = v
        c.details = d
    doc = _doc_of_student(db, data.get("attachment_document_id"), c.student_user_id)
    if data.get("status") and data["status"] != c.status:
        svc.transition(db, c, data["status"], actor_id=p.id, note=data.get("note"), attachment_document_id=doc)
    else:
        if data.get("note") or doc:
            svc.add_event(db, c, "NOTE", actor_id=p.id, body=data.get("note"), attachment_document_id=doc)
        svc.sync_tasks(db, c)
    audit(db, action="service_case.update", entity_type="service_case", entity_id=c.id, actor=p, subject_user_id=c.student_user_id,
          detail={k: str(v)[:80] for k, v in data.items() if k != "internal_notes"})
    db.commit()
    return svc.ser_case(db, c, staff=True, with_events=True)


class EventIn(BaseModel):
    kind: str = Field(pattern="^(NOTE|FLIGHT_CHANGE|PROOF|NO_SHOW|STUDENT_UPDATE)$")
    body: str | None = Field(default=None, max_length=2000)
    visibility: str = Field(default="INTERNAL", pattern="^(INTERNAL|STUDENT)$")
    attachment_document_id: str | None = None
    estimated_arrival: datetime | None = None
    terminal: str | None = Field(default=None, max_length=8)


@router.post("/agency/service-cases/{case_id}/events", status_code=201)
def add_event(case_id: str, body: EventIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not svc.staff_can_edit(p):
        raise HTTPException(403, "You do not have permission for this action.")
    c = svc.get_case_for(db, p, parse_uuid(case_id))
    doc = _doc_of_student(db, body.attachment_document_id, c.student_user_id)
    if body.kind == "FLIGHT_CHANGE":
        if c.case_type != "AIRPORT_PICKUP":
            raise HTTPException(422, "Flight changes belong to an airport pickup.")
        svc.record_flight_change(db, c, estimated_arrival=body.estimated_arrival, terminal=body.terminal, actor_id=p.id, note=body.body)
    elif body.kind == "NO_SHOW":
        svc.transition(db, c, "NO_SHOW", actor_id=p.id, note=body.body, attachment_document_id=doc)
    elif body.kind == "PROOF":
        if not (body.body or doc):
            raise HTTPException(422, "Add a note or a photo as proof.")
        svc.add_event(db, c, "PROOF", actor_id=p.id, body=body.body, attachment_document_id=doc, visibility=body.visibility)
    else:
        svc.add_event(db, c, "NOTE" if body.kind == "NOTE" else "UPDATE", actor_id=p.id, body=body.body, attachment_document_id=doc,
                      visibility=body.visibility)
        if body.visibility == "STUDENT":
            svc._mark_first_action(c)
    db.commit()
    return svc.ser_case(db, c, staff=True, with_events=True)


# ---------------------------------------------------------------- vendors
class VendorIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    kind: str
    service_area: list[str] | None = None
    languages: list[str] | None = None
    price_model: str | None = Field(default=None, max_length=300)
    availability: str | None = Field(default=None, max_length=300)
    sla_hours: int | None = Field(default=None, ge=1, le=720)
    contact: dict | None = None
    quality_status: str | None = Field(default=None, pattern="^(NEW|GOOD|WATCH|SUSPENDED)$")
    agreement: dict | None = None
    notes: str | None = Field(default=None, max_length=2000)
    network: bool = False  # Hangyul only: create in the Hangyul network (visible to every agency)


def _clean_agreement(a: dict | None) -> dict | None:
    if not a:
        return None
    out = {"active": bool(a.get("active")), "reference": (str(a.get("reference"))[:80] if a.get("reference") else None)}
    for k in ("since", "until"):
        v = a.get(k)
        try:
            out[k] = date.fromisoformat(v).isoformat() if v else None
        except (TypeError, ValueError):
            raise HTTPException(422, "Agreement dates must be YYYY-MM-DD.")
    if out["active"] and not out["reference"]:
        raise HTTPException(422, "An active agreement needs a contract reference.")
    return out


@router.get("/agency/vendors")
def list_vendors(kind: str | None = None, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    stmt = svc.vendors_visible_to(db, p)
    if kind:
        stmt = stmt.where(Vendor.kind == kind)
    rows = db.scalars(stmt.order_by(Vendor.kind, Vendor.name)).all()
    return {"items": [svc.ser_vendor(v, staff=True) for v in rows], "kinds": svc.VENDOR_KINDS, "can_manage": svc.staff_can_manage_vendors(p)}


@router.post("/agency/vendors", status_code=201)
def create_vendor(body: VendorIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not svc.staff_can_manage_vendors(p):
        raise HTTPException(403, "You do not have permission for this action.")
    if body.kind not in svc.VENDOR_KINDS:
        raise HTTPException(422, "Unknown provider kind.")
    v = Vendor(organization_id=None if (p.is_hangyul and body.network) or not p.is_agency else p.org_id, name=body.name, kind=body.kind,
               service_area=body.service_area, languages=body.languages, price_model=body.price_model, availability=body.availability,
               sla_hours=body.sla_hours, contact=body.contact, quality_status=body.quality_status or "NEW",
               agreement=_clean_agreement(body.agreement), notes=body.notes, is_demo=False)
    db.add(v)
    db.flush()
    audit(db, action="vendor.create", entity_type="vendor", entity_id=v.id, actor=p, detail={"kind": v.kind})
    db.commit()
    return svc.ser_vendor(v, staff=True)


@router.patch("/agency/vendors/{vendor_id}")
def update_vendor(vendor_id: str, body: VendorIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not svc.staff_can_manage_vendors(p):
        raise HTTPException(403, "You do not have permission for this action.")
    v = db.scalar(svc.vendors_visible_to(db, p).where(Vendor.id == parse_uuid(vendor_id)))
    if not v:
        raise HTTPException(404, "Not found or not permitted.")
    if v.organization_id is None and not p.is_hangyul:
        raise HTTPException(403, "Hangyul network providers are managed by Hangyul.")
    if body.kind not in svc.VENDOR_KINDS:
        raise HTTPException(422, "Unknown provider kind.")
    for k in ("name", "kind", "service_area", "languages", "price_model", "availability", "sla_hours", "contact", "notes"):
        setattr(v, k, getattr(body, k))
    if body.quality_status:
        v.quality_status = body.quality_status
    v.agreement = _clean_agreement(body.agreement)
    audit(db, action="vendor.update", entity_type="vendor", entity_id=v.id, actor=p, detail={"agreement_active": svc.agreement_active(v)})
    db.commit()
    return svc.ser_vendor(v, staff=True)


@router.get("/agency/service-metrics")
def service_metrics(days: int = Query(90, ge=7, le=730), p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    end = utcnow()
    return svc.concierge_metrics(db, None if p.is_hangyul else p.org_id, end - timedelta(days=days), end)


@router.get("/agency/service-today")
def service_today(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Preview of the items the coordinator merges into Agency Today."""
    return {"items": svc.today_items(db, p)}

