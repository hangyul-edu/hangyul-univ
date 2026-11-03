"""Concierge: one fulfilment model for everything after admission (docs/ARRIVAL_SERVICES.md).

* ``ServiceCase`` + per-type state tables (``TABLES``) — every status says who the case is waiting on, which queue
  bucket it belongs to and which statuses may follow. The visa workstream registers its own VISA_SUPPORT table with
  ``register_case_type``.
* Tasks: a case keeps at most one open team task and one open student task (source ``CONCIERGE``; the engine in
  ``tasks_engine.py`` never touches them).
* Arrival journey: ``arrival_journey`` (the student's "first weeks in Korea" steps with official sources) and
  ``home_stage`` (one stage + one next action for the coordinator's home).
* Honesty: flight data is MANUAL unless a provider is configured (none is); vendors are "partners" only with an
  active agreement; demo vendors/listings are labelled; lease support flags only practical gaps, never legal advice.

Hook functions for the coordinator: ``today_items(db, principal)``, ``home_stage(db, student_user_id)``,
``concierge_metrics(db, org_id, start, end)``.
"""
from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ArrivalPlan,
    Dormitory,
    HousingCase,
    HousingListing,
    Organization,
    ServiceCase,
    ServiceCaseEvent,
    Source,
    StudentProfile,
    Task,
    University,
    UniversityArrivalInfo,
    User,
    Vendor,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus,
    AssignmentStatus,
    HousingStatus,
    OrgType,
    PipelineStage,
    Role,
    TaskPriority,
    TaskStatus,
    TaskType,
    VisaStatus,
)
from app.services.state_machine import reached

SEOUL = ZoneInfo("Asia/Seoul")
REPO_ROOT = Path(__file__).resolve().parents[3]
TASK_SOURCE = "CONCIERGE"

CASE_TYPES = ["VISA_SUPPORT", "AIRPORT_PICKUP", "DORMITORY", "HOUSING_SEARCH", "TEMPORARY_HOUSING", "ARRIVAL_SUPPORT",
              "RESIDENCE_CARD", "SIM", "BANKING_SUPPORT", "OTHER"]
# Types a student may request directly (pickup has its own form; residence card opens itself on arrival).
STUDENT_REQUESTABLE = {"DORMITORY", "HOUSING_SEARCH", "TEMPORARY_HOUSING", "ARRIVAL_SUPPORT", "SIM", "BANKING_SUPPORT", "OTHER"}
PAYERS = {"student", "hangyul", "university", "included"}
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]
VENDOR_KINDS = ["airport_transport", "housing_provider", "translation", "legalization", "sim_esim", "insurance", "relocation"]
VIEWS = ["needs_assignment", "waiting_student", "waiting_provider", "scheduled", "today", "overdue", "completed"]


# ----------------------------------------------------------------------------------------------- state tables
@dataclass(frozen=True)
class St:
    waiting: str  # team | student | provider | external | none
    bucket: str  # open | scheduled | done | cancelled
    next: tuple[str, ...]


GENERIC = {
    "OPEN": St("team", "open", ("IN_PROGRESS", "WAITING_STUDENT", "WAITING_PROVIDER", "SCHEDULED", "COMPLETED", "CANCELLED")),
    "IN_PROGRESS": St("team", "open", ("WAITING_STUDENT", "WAITING_PROVIDER", "SCHEDULED", "COMPLETED", "CANCELLED")),
    "WAITING_STUDENT": St("student", "open", ("IN_PROGRESS", "WAITING_PROVIDER", "SCHEDULED", "COMPLETED", "CANCELLED")),
    "WAITING_PROVIDER": St("provider", "open", ("IN_PROGRESS", "WAITING_STUDENT", "SCHEDULED", "COMPLETED", "CANCELLED")),
    "SCHEDULED": St("provider", "scheduled", ("IN_PROGRESS", "WAITING_STUDENT", "COMPLETED", "CANCELLED")),
    "COMPLETED": St("none", "done", ("IN_PROGRESS",)),
    "CANCELLED": St("none", "cancelled", ("OPEN",)),
}

TABLES: dict[str, dict[str, St]] = {
    "AIRPORT_PICKUP": {
        "REQUESTED": St("team", "open", ("CONFIRMED", "CANCELLED")),
        "CONFIRMED": St("team", "scheduled", ("DRIVER_ASSIGNED", "FLIGHT_DELAYED", "CANCELLED")),
        "DRIVER_ASSIGNED": St("provider", "scheduled", ("FLIGHT_DELAYED", "DRIVER_WAITING", "PICKED_UP", "NO_SHOW", "CANCELLED")),
        "FLIGHT_DELAYED": St("provider", "scheduled", ("CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_WAITING", "PICKED_UP", "NO_SHOW", "CANCELLED")),
        "DRIVER_WAITING": St("student", "scheduled", ("PICKED_UP", "NO_SHOW", "FLIGHT_DELAYED")),
        "PICKED_UP": St("provider", "scheduled", ("COMPLETED",)),
        "COMPLETED": St("none", "done", ()),
        "NO_SHOW": St("team", "open", ("REQUESTED", "CANCELLED")),
        "CANCELLED": St("none", "cancelled", ("REQUESTED",)),
    },
    "DORMITORY": {
        "PLANNING": St("student", "open", ("APPLIED", "CANCELLED")),
        "APPLIED": St("external", "open", ("ASSIGNED", "NOT_ASSIGNED", "CANCELLED")),
        # V9 reliability: the dormitory office can withdraw an assigned/confirmed room → back to the team (NOT_ASSIGNED).
        "ASSIGNED": St("student", "open", ("CONFIRMED", "NOT_ASSIGNED", "CANCELLED")),
        "CONFIRMED": St("none", "scheduled", ("MOVED_IN", "NOT_ASSIGNED", "CANCELLED")),
        "MOVED_IN": St("none", "done", ()),
        "NOT_ASSIGNED": St("team", "open", ("PLANNING", "CANCELLED")),
        "CANCELLED": St("none", "cancelled", ("PLANNING",)),
    },
    "HOUSING_SEARCH": {
        "INTERESTED": St("team", "open", ("VIEWING", "CONTRACT_REVIEW", "CANCELLED")),
        "VIEWING": St("provider", "scheduled", ("INTERESTED", "CONTRACT_REVIEW", "CANCELLED")),
        "CONTRACT_REVIEW": St("team", "open", ("INTERESTED", "DEPOSIT", "CANCELLED")),
        # V9 reliability: the landlord/provider can cancel after the deposit step or confirmation → the search reopens
        # with the team (INTERESTED), instead of only "CANCELLED" (which would close the student's housing case).
        "DEPOSIT": St("student", "open", ("CONFIRMED", "INTERESTED", "CANCELLED")),
        "CONFIRMED": St("none", "scheduled", ("MOVED_IN", "INTERESTED", "CANCELLED")),
        "MOVED_IN": St("none", "done", ()),
        "CANCELLED": St("none", "cancelled", ("INTERESTED",)),
    },
    "TEMPORARY_HOUSING": {
        "PLANNING": St("team", "open", ("BOOKED", "CANCELLED")),
        "BOOKED": St("none", "scheduled", ("CHECKED_IN", "PLANNING", "CANCELLED")),  # V9: booking cancelled by the provider → re-plan
        "CHECKED_IN": St("none", "scheduled", ("COMPLETED",)),
        "COMPLETED": St("none", "done", ()),
        "CANCELLED": St("none", "cancelled", ("PLANNING",)),
    },
    "RESIDENCE_CARD": {
        "PREPARING": St("student", "open", ("APPOINTMENT_BOOKED", "GROUP_FILING", "CANCELLED")),
        "APPOINTMENT_BOOKED": St("student", "scheduled", ("SUBMITTED", "PREPARING")),
        "GROUP_FILING": St("external", "open", ("SUBMITTED", "PREPARING")),
        "SUBMITTED": St("external", "open", ("READY", "PREPARING")),
        "READY": St("student", "open", ("COLLECTED",)),
        "COLLECTED": St("none", "done", ()),
        "CANCELLED": St("none", "cancelled", ("PREPARING",)),
    },
}
INITIAL: dict[str, str] = {"AIRPORT_PICKUP": "REQUESTED", "DORMITORY": "PLANNING", "HOUSING_SEARCH": "INTERESTED",
                           "TEMPORARY_HOUSING": "PLANNING", "RESIDENCE_CARD": "PREPARING"}
# Hours the team has to act on a new case (SLA). Help requests override by urgency.
SLA_HOURS = {"AIRPORT_PICKUP": 24, "DORMITORY": 48, "HOUSING_SEARCH": 48, "TEMPORARY_HOUSING": 24, "RESIDENCE_CARD": 72, "VISA_SUPPORT": 24}
TASK_TYPE = {"AIRPORT_PICKUP": TaskType.ARRIVAL_STEP, "DORMITORY": TaskType.DORM_APPLICATION, "HOUSING_SEARCH": TaskType.DORM_APPLICATION,
             "TEMPORARY_HOUSING": TaskType.DORM_APPLICATION, "RESIDENCE_CARD": TaskType.ARRIVAL_STEP, "VISA_SUPPORT": TaskType.VISA_STEP,
             "ARRIVAL_SUPPORT": TaskType.ARRIVAL_STEP, "SIM": TaskType.ARRIVAL_STEP, "BANKING_SUPPORT": TaskType.ARRIVAL_STEP}
TYPE_LABEL_EN = {"VISA_SUPPORT": "Visa support", "AIRPORT_PICKUP": "Airport pickup", "DORMITORY": "Dormitory application",
                 "HOUSING_SEARCH": "Housing search", "TEMPORARY_HOUSING": "Temporary accommodation", "ARRIVAL_SUPPORT": "Arrival support",
                 "RESIDENCE_CARD": "Residence card", "SIM": "SIM / eSIM", "BANKING_SUPPORT": "Bank account", "OTHER": "Help request"}
# Student tasks created while a case waits on the student: (status → English title).
STUDENT_TASK_EN = {
    ("DORMITORY", "PLANNING"): "Apply for your dormitory",
    ("DORMITORY", "ASSIGNED"): "Confirm your dormitory room and pay the deposit",
    ("HOUSING_SEARCH", "DEPOSIT"): "Pay the housing deposit and upload the receipt",
    ("RESIDENCE_CARD", "PREPARING"): "Apply for your residence card",
    ("RESIDENCE_CARD", "APPOINTMENT_BOOKED"): "Go to your residence card appointment",
    ("RESIDENCE_CARD", "READY"): "Collect your residence card",
    ("AIRPORT_PICKUP", "DRIVER_WAITING"): "Your driver is waiting at the airport",
}


def register_case_type(case_type: str, table: dict[str, St], initial: str, *, sla_hours: int | None = None) -> None:
    """Let another workstream (visa) plug its own status table into the same fulfilment model."""
    assert initial in table
    for s in table.values():
        assert all(n in table for n in s.next), f"unknown next status in {case_type}"
    TABLES[case_type] = table
    INITIAL[case_type] = initial
    if case_type not in CASE_TYPES:
        CASE_TYPES.append(case_type)
    if sla_hours:
        SLA_HOURS[case_type] = sla_hours


def table_for(case_type: str) -> dict[str, St]:
    return TABLES.get(case_type, GENERIC)


def initial_status(case_type: str) -> str:
    return INITIAL.get(case_type, "OPEN")


def state(case: ServiceCase) -> St:
    return table_for(case.case_type).get(case.status) or St("team", "open", ())


def is_closed(case: ServiceCase) -> bool:
    return state(case).bucket in ("done", "cancelled")


def can_transition(case_type: str, frm: str, to: str) -> bool:
    t = table_for(case_type)
    return frm in t and to in t and to in t[frm].next


# ----------------------------------------------------------------------------------------------- vendors
def agreement_active(v: Vendor | None, today: date | None = None) -> bool:
    if not v or not v.agreement or not v.agreement.get("active"):
        return False
    today = today or utcnow().date()
    since, until = v.agreement.get("since"), v.agreement.get("until")
    if since and date.fromisoformat(since) > today:
        return False
    if until and date.fromisoformat(until) < today:
        return False
    return True


def student_vendor_label(v: Vendor | None) -> str | None:
    """What a student may call this provider: DEMO (always, for sample data), PARTNER (active agreement only) or PROVIDER."""
    if v is None:
        return None
    if v.is_demo:
        return "DEMO"
    return "PARTNER" if agreement_active(v) else "PROVIDER"


def ser_vendor(v: Vendor | None, *, staff: bool) -> dict | None:
    if v is None:
        return None
    out = {"id": str(v.id), "name": v.name, "kind": v.kind, "label": student_vendor_label(v), "is_demo": v.is_demo,
           "languages": v.languages or [], "service_area": v.service_area or []}
    if staff:
        out.update({"organization_id": str(v.organization_id) if v.organization_id else None, "network": v.organization_id is None,
                    "price_model": v.price_model, "availability": v.availability, "sla_hours": v.sla_hours, "contact": v.contact or {},
                    "quality_status": v.quality_status, "agreement": v.agreement, "agreement_active": agreement_active(v), "notes": v.notes})
    return out


def vendors_visible_to(db: Session, p) -> Select:
    stmt = select(Vendor)
    if p.is_hangyul:
        return stmt
    return stmt.where(or_(Vendor.organization_id.is_(None), Vendor.organization_id == p.org_id))


# ----------------------------------------------------------------------------------------------- flight provider
class FlightProviderNotConfigured(Exception):
    pass


class FlightDataProvider:
    """Interface for live flight status (e.g. an airline/airport data API under a commercial licence)."""
    name = "base"

    def lookup(self, number: str, on: date) -> dict | None:  # pragma: no cover - interface
        raise NotImplementedError


class NotConfiguredFlightProvider(FlightDataProvider):
    name = "none"

    def lookup(self, number: str, on: date) -> dict | None:
        raise FlightProviderNotConfigured("No flight data provider is configured; flight times are entered manually.")


def get_flight_provider() -> FlightDataProvider:
    # Only "none" exists. A real adapter must be added here, licensed and tested before HG_FLIGHT_PROVIDER may name it.
    _ = os.environ.get("HG_FLIGHT_PROVIDER", "none")
    return NotConfiguredFlightProvider()


def flight_view(plan: ArrivalPlan | None) -> dict | None:
    if not plan or not (plan.flight_number or plan.arrival_at):
        return None
    fi = dict(plan.flight_info or {})
    source = fi.get("source") or "MANUAL"
    return {
        "number": plan.flight_number, "airport": plan.arrival_airport, "scheduled_arrival": plan.arrival_at.isoformat() if plan.arrival_at else None,
        "estimated_arrival": fi.get("estimated_arrival"), "terminal": fi.get("terminal"), "source": source,
        "updated_at": fi.get("updated_at"), "updated_by": fi.get("updated_by"),
        # Never "live" unless the data came from a provider.
        "live": source == "PROVIDER",
    }


# ----------------------------------------------------------------------------------------------- helpers
def _now() -> datetime:
    return utcnow()


def _as_dt(v) -> datetime | None:
    if v is None or isinstance(v, datetime):
        return v
    d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=SEOUL)


def hangyul_org_id(db: Session) -> uuid.UUID | None:
    return db.scalar(select(Organization.id).where(Organization.type == OrgType.HANGYUL))


def active_assignment(db: Session, student_user_id) -> AgencyAssignment | None:
    return db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id,
                                                    AgencyAssignment.status == AssignmentStatus.ACTIVE))


def _latest_application(db: Session, student_user_id) -> Application | None:
    apps = db.scalars(select(Application).where(Application.student_user_id == student_user_id).order_by(Application.updated_at.desc())).all()
    admitted = [a for a in apps if reached(a.status, ApplicationStatus.OFFER_ACCEPTED) and a.status != ApplicationStatus.WITHDRAWN]
    return admitted[0] if admitted else None


def add_event(db: Session, case: ServiceCase, kind: str, *, actor_id=None, body: str | None = None, visibility: str = "INTERNAL",
              frm: str | None = None, to: str | None = None, data: dict | None = None, attachment_document_id=None) -> ServiceCaseEvent:
    ev = ServiceCaseEvent(case_id=case.id, kind=kind, from_status=frm, to_status=to, body=body, visibility=visibility, data=data,
                          attachment_document_id=attachment_document_id, actor_user_id=actor_id, created_at=_now())
    db.add(ev)
    return ev


def _mark_first_action(case: ServiceCase) -> None:
    d = dict(case.details or {})
    if not d.get("first_action_at"):
        d["first_action_at"] = _now().isoformat()
        case.details = d


def sla_breached(case: ServiceCase, now: datetime | None = None) -> bool:
    if not case.sla_due_at:
        return False
    now = now or _now()
    first = (case.details or {}).get("first_action_at")
    if first:
        return _as_dt(first) > case.sla_due_at
    return now > case.sla_due_at and state(case).waiting == "team" and not is_closed(case)


def is_overdue(case: ServiceCase, now: datetime | None = None) -> bool:
    """Late for the team: SLA passed while the case still waits on the team."""
    now = now or _now()
    if is_closed(case) or state(case).waiting != "team":
        return False
    return bool(case.sla_due_at and case.sla_due_at < now)


# ----------------------------------------------------------------------------------------------- tasks
def _student_name(db: Session, student_user_id) -> str:
    u = db.get(User, student_user_id)
    return (u.preferred_name or u.full_name) if u else ""


def sync_tasks(db: Session, case: ServiceCase) -> None:
    """One open team task while the case waits on the team (or needs re-confirmation); one student task while it waits on
    the student. Everything else is closed. Idempotent via dedupe_key."""
    st = state(case)
    closed = is_closed(case)
    cid = str(case.id)
    team_org = hangyul_org_id(db) if case.routed_to == "HANGYUL_OPS" else case.agency_org_id
    wanted: dict[str, dict] = {}
    needs_team = not closed and (st.waiting == "team" or (case.details or {}).get("reconfirm"))
    if needs_team and team_org:
        name = _student_name(db, case.student_user_id)
        reconfirm = bool((case.details or {}).get("reconfirm"))
        wanted[f"svc:{cid}:team"] = dict(
            title=f"{'Flight changed — re-confirm pickup' if reconfirm else TYPE_LABEL_EN.get(case.case_type, 'Service')}: {name}",
            title_key="task.concierge.reconfirm" if reconfirm else "task.concierge.handle",
            title_params={"type": case.case_type, "status": case.status, "student": name},
            task_type=TASK_TYPE.get(case.case_type, TaskType.GENERAL), due_at=case.sla_due_at or case.due_at,
            owner_user_id=case.owner_user_id, owner_org_id=team_org, visible_to_student=False, link=f"/services?case={cid}",
        )
    if not closed and st.waiting == "student":
        title = STUDENT_TASK_EN.get((case.case_type, case.status))
        if title:
            wanted[f"svc:{cid}:student:{case.status}"] = dict(
                title=title, title_key=f"task.concierge.{case.case_type}.{case.status}", title_params={},
                task_type=TASK_TYPE.get(case.case_type, TaskType.GENERAL), due_at=case.due_at, owner_user_id=case.student_user_id,
                owner_org_id=case.agency_org_id, visible_to_student=True,
                link="/arrival" if case.case_type in ("RESIDENCE_CARD", "AIRPORT_PICKUP") else "/housing",
            )
    existing = {t.dedupe_key: t for t in db.scalars(select(Task).where(Task.dedupe_key.like(f"svc:{cid}:%")))}
    now = _now()
    for key, spec in wanted.items():
        t = existing.get(key)
        prio = TaskPriority.URGENT if case.priority == "URGENT" else TaskPriority.HIGH if case.priority == "HIGH" else TaskPriority.MEDIUM
        if t is None:
            db.add(Task(student_user_id=case.student_user_id, source=TASK_SOURCE, dedupe_key=key, priority=prio,
                        application_id=case.application_id, **spec))
        else:
            if t.status in (TaskStatus.DONE, TaskStatus.CANCELLED):
                t.status, t.completed_at = TaskStatus.OPEN, None
            for k, v in spec.items():
                setattr(t, k, v)
            t.priority = prio
    for key, t in existing.items():
        if key not in wanted and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED):
            t.status, t.completed_at = TaskStatus.DONE, now
    db.flush()


# ----------------------------------------------------------------------------------------------- case lifecycle
def create_case(db: Session, student_user_id, case_type: str, *, actor_id=None, details: dict | None = None, status: str | None = None,
                routed_to: str | None = None, priority: str = "MEDIUM", due_at: datetime | None = None, owner_user_id=None,
                help_category: str | None = None, note: str | None = None, application_id=None, is_demo: bool = False,
                sla_hours: int | None = None, created_at: datetime | None = None) -> ServiceCase:
    if case_type not in CASE_TYPES:
        raise HTTPException(422, "Unknown service type.")
    status = status or initial_status(case_type)
    if status not in table_for(case_type):
        raise HTTPException(422, "Status not allowed for this service type.")
    a = active_assignment(db, student_user_id)
    routed = routed_to or ("AGENCY" if a else "HANGYUL_OPS")
    if owner_user_id is None and routed == "AGENCY" and a:
        owner_user_id = a.counselor_user_id
    app = db.get(Application, application_id) if application_id else _latest_application(db, student_user_id)
    now = created_at or _now()
    hours = sla_hours or SLA_HOURS.get(case_type, 48)
    case = ServiceCase(student_user_id=student_user_id, application_id=app.id if app else None, agency_org_id=a.organization_id if a else None,
                       owner_user_id=owner_user_id, routed_to=routed, case_type=case_type, status=status, priority=priority,
                       due_at=due_at, sla_due_at=now + timedelta(hours=hours), details=details or {}, help_category=help_category,
                       created_by_id=actor_id, is_demo=is_demo, created_at=now, updated_at=now)
    db.add(case)
    db.flush()
    ev = add_event(db, case, "CREATED", actor_id=actor_id, to=status, body=note, visibility="STUDENT")
    ev.created_at = now
    sync_tasks(db, case)
    return case


def transition(db: Session, case: ServiceCase, to: str, *, actor_id=None, note: str | None = None, staff: bool = True,
               attachment_document_id=None, at: datetime | None = None) -> None:
    frm = case.status
    if to == frm:
        return
    if not can_transition(case.case_type, frm, to):
        raise HTTPException(409, f"This case can't move from {frm} to {to}.")
    # Type rules that keep the record honest.
    if case.case_type == "AIRPORT_PICKUP":
        if to == "DRIVER_ASSIGNED" and not case.vendor_id:
            raise HTTPException(422, "Assign a transport provider before marking a driver as assigned.")
        if to == "COMPLETED":
            has_proof = db.scalar(select(ServiceCaseEvent.id).where(ServiceCaseEvent.case_id == case.id, ServiceCaseEvent.kind == "PROOF").limit(1))
            if not has_proof and not (note or attachment_document_id):
                raise HTTPException(422, "Add a completion note or photo as proof before completing the pickup.")
            if not has_proof:
                add_event(db, case, "PROOF", actor_id=actor_id, body=note, attachment_document_id=attachment_document_id)
    case.status = to
    now = at or _now()
    if state(case).bucket in ("done", "cancelled"):
        case.closed_at = now
    else:
        case.closed_at = None
    if staff:
        _mark_first_action(case)
        d = dict(case.details or {})
        d.pop("reconfirm", None)
        case.details = d
    ev = add_event(db, case, "STATUS", actor_id=actor_id, frm=frm, to=to, body=note, visibility="STUDENT", attachment_document_id=attachment_document_id)
    ev.created_at = now
    _on_status(db, case, frm, to, at=now)
    if state(case).bucket == "done":
        from app.services import addons

        addons.on_case_closed(db, case)  # V29: a paid extra that opened this case is now delivered
    sync_tasks(db, case)
    _notify_student(db, case)


def _notify_student(db: Session, case: ServiceCase) -> None:
    from app.services.notify import notify

    notify(db, case.student_user_id, "SERVICE_CASE", "notify.serviceCase",
           f"{TYPE_LABEL_EN.get(case.case_type, 'Service')}: status updated",
           params={"type": case.case_type, "status": case.status}, link="/arrival" if case.case_type in ("AIRPORT_PICKUP", "RESIDENCE_CARD") else "/housing" if case.case_type in ("DORMITORY", "HOUSING_SEARCH", "TEMPORARY_HOUSING") else "/help")


def _on_status(db: Session, case: ServiceCase, frm: str, to: str, *, at: datetime) -> None:
    """Side effects that keep the older records (HousingCase / ArrivalPlan) coherent with the case."""
    if case.case_type == "AIRPORT_PICKUP":
        plan = _plan(db, case.student_user_id)
        plan.pickup_requested = to not in ("CANCELLED",)
        plan.pickup_status = to
        if to in ("PICKED_UP", "COMPLETED"):
            mark_arrived(db, case.student_user_id, at=at)
    if case.case_type == "DORMITORY":
        h = _housing(db, case.student_user_id)
        h.status = {"PLANNING": HousingStatus.RESEARCHING, "APPLIED": HousingStatus.DORM_APPLYING, "ASSIGNED": HousingStatus.DORM_APPLYING,
                    "CONFIRMED": HousingStatus.DORM_CONFIRMED, "MOVED_IN": HousingStatus.DORM_CONFIRMED,
                    "NOT_ASSIGNED": HousingStatus.RESEARCHING, "CANCELLED": HousingStatus.RESEARCHING}.get(to, h.status)
    if case.case_type == "HOUSING_SEARCH":
        h = _housing(db, case.student_user_id)
        h.status = {"INTERESTED": HousingStatus.OFF_CAMPUS_SEARCH, "VIEWING": HousingStatus.OFF_CAMPUS_SEARCH, "CONTRACT_REVIEW": HousingStatus.CONTRACT_REVIEW,
                    "DEPOSIT": HousingStatus.CONTRACT_REVIEW, "CONFIRMED": HousingStatus.CONFIRMED, "MOVED_IN": HousingStatus.CONFIRMED}.get(to, h.status)


def _plan(db: Session, student_user_id) -> ArrivalPlan:
    plan = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == student_user_id))
    if plan is None:
        plan = ArrivalPlan(student_user_id=student_user_id, completed_items=[])
        db.add(plan)
        db.flush()
    return plan


def _housing(db: Session, student_user_id) -> HousingCase:
    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == student_user_id))
    if h is None:
        h = HousingCase(student_user_id=student_user_id, status=HousingStatus.NOT_STARTED)
        db.add(h)
        db.flush()
    return h


def open_cases(db: Session, student_user_id, case_type: str | None = None) -> list[ServiceCase]:
    stmt = select(ServiceCase).where(ServiceCase.student_user_id == student_user_id)
    if case_type:
        stmt = stmt.where(ServiceCase.case_type == case_type)
    return [c for c in db.scalars(stmt.order_by(ServiceCase.created_at.desc())) if not is_closed(c)]


def latest_case(db: Session, student_user_id, case_type: str, *, include_cancelled: bool = False) -> ServiceCase | None:
    for c in db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == student_user_id, ServiceCase.case_type == case_type)
                        .order_by(ServiceCase.created_at.desc())):
        if include_cancelled or c.status != "CANCELLED":
            return c
    return None


# ----------------------------------------------------------------------------------------------- arrival
def mark_arrived(db: Session, student_user_id, *, at: datetime | None = None) -> bool:
    """Record arrival once (from the student's confirmation or a completed pickup) and open the settlement steps."""
    plan = _plan(db, student_user_id)
    if plan.arrived_at:
        return False
    at = at or _now()
    plan.arrived_at = at
    plan.residence_card_due = (at + timedelta(days=90)).date()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    if prof:
        prof.pipeline_stage = PipelineStage.ARRIVED
    from app.core.audit import track

    track(db, "student_arrived", user_id=student_user_id, nationality=prof.nationality if prof else None)
    on_arrival(db, student_user_id, at=at)
    return True


def on_arrival(db: Session, student_user_id, *, at: datetime | None = None) -> ServiceCase | None:
    """Arrival activates the residence-card case (and its student task, due 90 days after entry)."""
    if latest_case(db, student_user_id, "RESIDENCE_CARD"):
        return None
    plan = _plan(db, student_user_id)
    at = at or plan.arrived_at or _now()
    due = datetime.combine(plan.residence_card_due or (at + timedelta(days=90)).date(), time(18, 0), tzinfo=SEOUL)
    info = _uni_arrival_info(db, student_user_id)
    return create_case(db, student_user_id, "RESIDENCE_CARD", due_at=due, created_at=at,
                       details={"group_registration": info.group_residence_registration if info else None, "hand_off": "HIKOREA"})


def _uni_arrival_info(db: Session, student_user_id) -> UniversityArrivalInfo | None:
    app = _latest_application(db, student_user_id)
    if not app:
        return None
    return db.scalar(select(UniversityArrivalInfo).where(UniversityArrivalInfo.university_id == app.university_id))


def set_flight(db: Session, student_user_id, *, number: str | None, airport: str | None, scheduled_arrival: datetime | None,
               terminal: str | None = None, actor: str = "student") -> ArrivalPlan:
    plan = _plan(db, student_user_id)
    changed = scheduled_arrival is not None and plan.arrival_at is not None and _as_dt(scheduled_arrival) != plan.arrival_at
    plan.flight_number = (number or "").strip().upper() or None
    plan.arrival_airport = airport
    plan.arrival_at = _as_dt(scheduled_arrival)
    fi = dict(plan.flight_info or {})
    fi.update({"number": plan.flight_number, "scheduled_arrival": plan.arrival_at.isoformat() if plan.arrival_at else None,
               "terminal": terminal if terminal is not None else fi.get("terminal"), "source": "MANUAL",
               "updated_at": _now().isoformat(), "updated_by": actor})
    if changed:
        fi["estimated_arrival"] = None
    plan.flight_info = fi
    items = set(plan.completed_items or [])
    if plan.flight_number and plan.arrival_at:
        items.add("flight_booked")
    plan.completed_items = sorted(items)
    pickup = next(iter(open_cases(db, student_user_id, "AIRPORT_PICKUP")), None)
    if pickup:
        pickup.due_at = plan.arrival_at
        if changed:
            d = dict(pickup.details or {})
            if pickup.status in ("CONFIRMED", "DRIVER_ASSIGNED", "FLIGHT_DELAYED"):
                d["reconfirm"] = True
            pickup.details = d
            add_event(db, pickup, "FLIGHT_CHANGE", body=f"Flight changed by the {actor}", visibility="STUDENT",
                      data={"scheduled_arrival": fi["scheduled_arrival"], "number": plan.flight_number})
            sync_tasks(db, pickup)
    db.flush()
    return plan


DELAY_MINUTES = 30


def record_flight_change(db: Session, case: ServiceCase, *, estimated_arrival: datetime | None, terminal: str | None, actor_id=None,
                         note: str | None = None) -> None:
    """Counselor records a delay/terminal from the airline or the student (manual — no live feed)."""
    plan = _plan(db, case.student_user_id)
    fi = dict(plan.flight_info or {})
    est = _as_dt(estimated_arrival)
    fi.update({"estimated_arrival": est.isoformat() if est else None, "source": "MANUAL", "updated_at": _now().isoformat(), "updated_by": "staff"})
    if terminal:
        fi["terminal"] = terminal
    plan.flight_info = fi
    target = est or plan.arrival_at
    case.due_at = target
    # V9 reliability: staff recording the (changed) flight IS the re-confirmation — before, a student's flight change on
    # a CONFIRMED pickup left a "re-confirm pickup" task that no action could ever close.
    if (case.details or {}).get("reconfirm"):
        d = dict(case.details)
        d.pop("reconfirm", None)
        case.details = d
    add_event(db, case, "FLIGHT_CHANGE", actor_id=actor_id, body=note, visibility="STUDENT",
              data={"estimated_arrival": fi["estimated_arrival"], "terminal": fi.get("terminal")})
    _mark_first_action(case)
    delayed = bool(est and plan.arrival_at and est - plan.arrival_at >= timedelta(minutes=DELAY_MINUTES))
    if delayed and case.status in ("CONFIRMED", "DRIVER_ASSIGNED"):
        transition(db, case, "FLIGHT_DELAYED", actor_id=actor_id)
    elif not delayed and case.status == "FLIGHT_DELAYED":
        transition(db, case, "DRIVER_ASSIGNED" if case.vendor_id and (case.details or {}).get("driver") else "CONFIRMED", actor_id=actor_id)
    else:
        sync_tasks(db, case)


def request_pickup(db: Session, student_user_id, form: dict, *, actor_id=None) -> ServiceCase:
    plan = _plan(db, student_user_id)
    if not (plan.flight_number and plan.arrival_at):
        raise HTTPException(422, "Add your flight number and arrival time first.")
    if open_cases(db, student_user_id, "AIRPORT_PICKUP"):
        raise HTTPException(409, "You already have an airport pickup request.")
    details = {k: form.get(k) for k in ("passengers", "luggage", "destination_kind", "destination_address", "special_requests", "contact_method", "contact_handle")}
    details["airport"] = plan.arrival_airport
    case = create_case(db, student_user_id, "AIRPORT_PICKUP", actor_id=actor_id, details=details, due_at=plan.arrival_at)
    plan.pickup_requested, plan.pickup_status = True, "REQUESTED"
    items = set(plan.completed_items or [])
    items.add("airport_pickup")
    plan.completed_items = sorted(items)
    return case


# ----------------------------------------------------------------------------------------------- housing
HOUSING_OPTIONS = ["DORM", "PARTNER", "OFF_CAMPUS", "TEMPORARY", "UNDECIDED"]
MOVE_IN_CHECKLIST = ["keys_or_code", "room_photos", "meter_readings", "deposit_receipt", "address_report", "internet_utilities"]
LEASE_FIELDS = ["address", "deposit_krw", "rent_monthly_krw", "start_date", "end_date", "landlord_name", "agent_name"]


def clean_profile(data: dict) -> dict:
    out: dict = {}
    for k in ("monthly_budget_krw", "deposit_budget_krw", "max_commute_minutes", "stay_months"):
        v = data.get(k)
        out[k] = int(v) if isinstance(v, (int, float)) and v >= 0 else None
    out["room"] = data.get("room") if data.get("room") in ("private", "shared") else None
    out["gender_requirement"] = data.get("gender_requirement") if data.get("gender_requirement") in ("female", "male", "any") else None
    out["furnished"] = data.get("furnished") if isinstance(data.get("furnished"), bool) else None
    mi = data.get("move_in_date")
    try:
        out["move_in_date"] = date.fromisoformat(mi).isoformat() if mi else None
    except ValueError:
        out["move_in_date"] = None
    return out


def lease_flags(lease: dict | None) -> list[str]:
    """Practical gaps in what the student/counselor entered. Never a legal judgement."""
    lease = lease or {}
    flags = []
    if not (lease.get("address") or "").strip():
        flags.append("MISSING_ADDRESS")
    dep = lease.get("deposit_krw")
    if not isinstance(dep, (int, float)) or dep < 0:
        flags.append("UNCLEAR_DEPOSIT")
    rent = lease.get("rent_monthly_krw")
    if not isinstance(rent, (int, float)) or rent <= 0:
        flags.append("UNCLEAR_RENT")
    try:
        s, e = date.fromisoformat(lease.get("start_date") or ""), date.fromisoformat(lease.get("end_date") or "")
        if e <= s:
            flags.append("UNCLEAR_DATES")
    except ValueError:
        flags.append("UNCLEAR_DATES")
    if not (lease.get("landlord_name") or "").strip() and not (lease.get("agent_name") or "").strip():
        flags.append("MISSING_LANDLORD")
    return flags


def ser_dorm(d: Dormitory) -> dict:
    return {
        "id": str(d.id), "name": d.name, "room_types": d.room_types or [], "capacity": d.capacity,
        "cost_per_semester_krw_min": d.cost_per_semester_krw_min, "cost_per_semester_krw_max": d.cost_per_semester_krw_max,
        "international_priority": d.international_priority, "meal_plan": d.meal_plan, "meal_required": d.meal_required,
        "application_note": d.application_note, "application_opens": d.application_opens.isoformat() if d.application_opens else None,
        "application_closes": d.application_closes.isoformat() if d.application_closes else None, "eligibility": d.eligibility,
        "move_in_date": d.move_in_date.isoformat() if d.move_in_date else None, "deposit_krw": d.deposit_krw,
        "required_documents": d.required_documents or [], "location": d.location,
        "source_url": d.source_url, "verified_at": d.verified_at.isoformat() if d.verified_at else None, "verification_status": d.verification_status,
    }


def ser_listing(li: HousingListing, v: Vendor | None) -> dict:
    return {
        "id": str(li.id), "title": li.title, "area": li.area, "room_type": li.room_type, "rent_monthly_krw": li.rent_monthly_krw,
        "deposit_krw": li.deposit_krw, "management_fee_krw": li.management_fee_krw, "contract_months_min": li.contract_months_min,
        "commute_minutes": li.commute_minutes, "distance_km": li.distance_km, "furnished": li.furnished, "utilities": li.utilities,
        "available_from": li.available_from.isoformat() if li.available_from else None, "verification_status": li.verification_status,
        "verified_at": li.verified_at.isoformat() if li.verified_at else None, "is_demo": li.is_demo,
        "provider": ser_vendor(v, staff=False),
    }


def housing_view(db: Session, student_user_id, uni: University | None) -> dict:
    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == student_user_id))
    listings: list[dict] = []
    partner: list[dict] = []
    if uni:
        rows = db.execute(select(HousingListing, Vendor).join(Vendor, Vendor.id == HousingListing.vendor_id)
                          .where(HousingListing.is_active.is_(True), or_(HousingListing.university_id == uni.id, HousingListing.university_id.is_(None)),
                                 Vendor.quality_status != "SUSPENDED")).all()
        for li, v in rows:
            (partner if student_vendor_label(v) == "PARTNER" else listings).append(ser_listing(li, v))
    partner_vendors = [v for v in db.scalars(select(Vendor).where(Vendor.kind == "housing_provider", Vendor.organization_id.is_(None))) if student_vendor_label(v) == "PARTNER"]
    dorm_case = latest_case(db, student_user_id, "DORMITORY")
    search = [c for c in db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == student_user_id, ServiceCase.case_type == "HOUSING_SEARCH")
                                    .order_by(ServiceCase.created_at.desc()))]
    temp = latest_case(db, student_user_id, "TEMPORARY_HOUSING")
    option = (h.preference if h and h.preference in HOUSING_OPTIONS else None) or "UNDECIDED"
    if h and h.preference == "OFF_CAMPUS":
        option = "OFF_CAMPUS"
    return {
        "option": option,
        "options": [{"value": o, "available": (bool(partner_vendors) if o == "PARTNER" else True)} for o in HOUSING_OPTIONS],
        "profile": (h.profile if h else None) or {},
        "move_in": (h.move_in if h else None) or {},
        "move_in_checklist": MOVE_IN_CHECKLIST,
        "dorm_case": ser_case(db, dorm_case, staff=False) if dorm_case else None,
        "search_cases": [ser_case(db, c, staff=False) for c in search],
        "temporary_case": ser_case(db, temp, staff=False) if temp else None,
        "listings": listings,
        "partner_listings": partner,
        "partner_providers": [ser_vendor(v, staff=False) for v in partner_vendors],
        "listing_feed": "NOT_CONNECTED",
        "lease_fields": LEASE_FIELDS,
    }


# ----------------------------------------------------------------------------------------------- serialisation
def ser_case(db: Session, c: ServiceCase, *, staff: bool, with_events: bool = False) -> dict:
    st = state(c)
    vendor = db.get(Vendor, c.vendor_id) if c.vendor_id else None
    owner = db.get(User, c.owner_user_id) if c.owner_user_id else None
    details = dict(c.details or {})
    if not staff:
        details.pop("first_action_at", None)
    out = {
        "id": str(c.id), "type": c.case_type, "status": c.status, "status_key": f"status.{c.case_type if c.case_type in TABLES else 'GENERIC'}.{c.status}",
        "waiting_on": st.waiting, "bucket": st.bucket, "closed": is_closed(c),
        "priority": c.priority, "due_at": c.due_at.isoformat() if c.due_at else None,
        "vendor": ser_vendor(vendor, staff=staff),
        "cost": {"amount": c.cost_amount, "currency": c.cost_currency, "payer": c.cost_payer} if c.cost_amount is not None or c.cost_payer else None,
        "details": details, "help_category": c.help_category, "routed_to": c.routed_to,
        "application_id": str(c.application_id) if c.application_id else None,
        "created_at": c.created_at.isoformat() if c.created_at else None, "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "closed_at": c.closed_at.isoformat() if c.closed_at else None,
        "feedback": {"ok": c.feedback_ok, "comment": c.feedback_comment, "at": c.feedback_at.isoformat() if c.feedback_at else None},
        "owner": {"id": str(owner.id), "full_name": owner.full_name} if owner else None,
        "is_demo": c.is_demo,
    }
    if c.case_type == "HOUSING_SEARCH":
        out["lease_flags"] = lease_flags(details.get("lease")) if details.get("lease") else []
    if c.case_type == "AIRPORT_PICKUP":
        out["flight"] = flight_view(db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == c.student_user_id)))
    if staff:
        stu = db.get(User, c.student_user_id)
        prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == c.student_user_id))
        out.update({
            "allowed_next": list(st.next), "sla_due_at": c.sla_due_at.isoformat() if c.sla_due_at else None,
            "overdue": is_overdue(c), "sla_breached": sla_breached(c), "internal_notes": c.internal_notes,
            "agency_org_id": str(c.agency_org_id) if c.agency_org_id else None,
            "student": {"id": str(stu.id), "full_name": stu.full_name, "nationality": prof.nationality if prof else None} if stu else None,
        })
    if with_events:
        evs = db.scalars(select(ServiceCaseEvent).where(ServiceCaseEvent.case_id == c.id).order_by(ServiceCaseEvent.created_at)).all()
        users = {u.id: u for u in db.scalars(select(User).where(User.id.in_({e.actor_user_id for e in evs if e.actor_user_id})))} if evs else {}
        out["events"] = [
            {"id": str(e.id), "kind": e.kind, "from": e.from_status, "to": e.to_status, "body": e.body, "data": e.data, "visibility": e.visibility,
             "attachment_document_id": str(e.attachment_document_id) if e.attachment_document_id else None,
             "actor": (users[e.actor_user_id].full_name if e.actor_user_id in users else None), "at": e.created_at.isoformat()}
            for e in evs if staff or e.visibility == "STUDENT"
        ]
        if staff:
            tasks = db.scalars(select(Task).where(Task.dedupe_key.like(f"svc:{c.id}:%"))).all()
            out["tasks"] = [{"id": str(t.id), "title": t.title, "title_key": t.title_key, "status": t.status.value, "due_at": t.due_at.isoformat() if t.due_at else None,
                             "visible_to_student": t.visible_to_student} for t in tasks]
    return out


# ----------------------------------------------------------------------------------------------- scoping + views
def scope_cases(stmt: Select, p) -> Select:
    from app.services.access import agency_student_ids_subquery

    if p.is_hangyul:
        return stmt
    if p.is_agency:
        return stmt.where(ServiceCase.student_user_id.in_(agency_student_ids_subquery(p)))
    if p.is_student:
        return stmt.where(ServiceCase.student_user_id == p.id)
    return stmt.where(False)  # universities have no access to service cases


def get_case_for(db: Session, p, case_id: uuid.UUID) -> ServiceCase:
    c = db.scalar(scope_cases(select(ServiceCase).where(ServiceCase.id == case_id), p))
    if not c:
        raise HTTPException(404, "Not found or not permitted.")
    return c


def in_view(c: ServiceCase, view: str, *, now: datetime, today: date, hangyul: bool = False) -> bool:
    st = state(c)
    closed = st.bucket in ("done", "cancelled")
    if view == "completed":
        return closed
    if closed:
        return False
    if view == "needs_assignment":
        # New requests nobody has acted on yet (or that have no owner) — so a fresh request is never invisible.
        mine = hangyul or c.routed_to == "AGENCY"
        fresh = st.waiting == "team" and not (c.details or {}).get("first_action_at")
        return mine and (c.owner_user_id is None or fresh)
    if view == "waiting_student":
        return st.waiting == "student"
    if view == "waiting_provider":
        return st.waiting in ("provider", "external") and st.bucket == "open"
    if view == "scheduled":
        return st.bucket == "scheduled"
    if view == "today":
        return any(x is not None and x.astimezone(SEOUL).date() == today for x in (c.due_at, c.sla_due_at))
    if view == "overdue":
        return is_overdue(c, now)
    return True


def list_cases(db: Session, p, *, view: str | None = None, case_type: str | None = None, owner: str | None = None,
               student_id: uuid.UUID | None = None) -> dict:
    stmt = scope_cases(select(ServiceCase), p)
    if case_type:
        stmt = stmt.where(ServiceCase.case_type == case_type)
    if student_id:
        stmt = stmt.where(ServiceCase.student_user_id == student_id)
    if owner == "me":
        stmt = stmt.where(ServiceCase.owner_user_id == p.id)
    elif owner and owner not in ("any", "unassigned"):
        stmt = stmt.where(ServiceCase.owner_user_id == uuid.UUID(owner))
    rows = db.scalars(stmt.order_by(ServiceCase.due_at.asc().nulls_last(), ServiceCase.created_at.desc()).limit(500)).all()
    if owner == "unassigned":
        rows = [c for c in rows if c.owner_user_id is None]
    now = _now()
    today = now.astimezone(SEOUL).date()
    counts = {v: sum(1 for c in rows if in_view(c, v, now=now, today=today, hangyul=p.is_hangyul)) for v in VIEWS}
    sel = [c for c in rows if in_view(c, view, now=now, today=today, hangyul=p.is_hangyul)] if view else [c for c in rows if not is_closed(c)]
    return {"items": [ser_case(db, c, staff=True) for c in sel], "counts": counts, "views": VIEWS, "types": CASE_TYPES}


# ----------------------------------------------------------------------------------------------- help
HELP_CATEGORIES = ["HOUSING", "UNIVERSITY", "VISA_RESIDENCE", "LOST_DOCUMENTS", "MEDICAL", "PAYMENT", "OTHER"]
HELP_ROUTING = {  # category → (case type, routed to, priority, SLA hours)
    "HOUSING": ("OTHER", "AGENCY", "MEDIUM", 24),
    "UNIVERSITY": ("OTHER", "AGENCY", "MEDIUM", 24),
    "VISA_RESIDENCE": ("VISA_SUPPORT", "HANGYUL_OPS", "HIGH", 8),
    "LOST_DOCUMENTS": ("OTHER", "HANGYUL_OPS", "HIGH", 8),
    "MEDICAL": ("OTHER", "AGENCY", "URGENT", 4),
    "PAYMENT": ("OTHER", "AGENCY", "MEDIUM", 24),
    "OTHER": ("OTHER", "AGENCY", "MEDIUM", 24),
}


def create_help(db: Session, student_user_id, category: str, message: str, *, actor_id=None) -> ServiceCase:
    if category not in HELP_ROUTING:
        raise HTTPException(422, "Unknown help category.")
    case_type, routed, prio, hours = HELP_ROUTING[category]
    if routed == "AGENCY" and not active_assignment(db, student_user_id):
        routed = "HANGYUL_OPS"
    return create_case(db, student_user_id, case_type, actor_id=actor_id, routed_to=routed, priority=prio, sla_hours=hours,
                       help_category=category, details={"message": message[:2000]}, note=message[:2000])


# ----------------------------------------------------------------------------------------------- official facts
EMERGENCY_FALLBACK = [
    {"number": "112", "key": "police", "source": {"name": "Korean National Police Agency", "url": "https://www.police.go.kr/eng/index.do"}},
    {"number": "119", "key": "fire_ambulance", "source": {"name": "National Fire Agency", "url": "https://www.nfa.go.kr/eng/"}},
    {"number": "1345", "key": "immigration", "source": {"name": "HiKorea — Immigration Contact Center", "url": "https://www.hikorea.go.kr/"}},
    {"number": "1330", "key": "travel_hotline", "source": {"name": "Korea Tourism Organization — 1330 Travel Hotline", "url": "https://english.visitkorea.or.kr/"}},
]

# Our step key → research topic keys (docs/research/arrival-official.json, then post-arrival-official.json) + fallback Source row.
STEP_RESEARCH: dict[str, tuple[tuple[str, ...], str | None]] = {
    "residence_card": (("residence_card_registration", "residence_card_group_application", "alien_registration"), "hikorea"),
    "residence_setup": (("residence_card_registration", "nhis_enrollment_timing", "alien_registration"), "hikorea"),
    "documents_to_carry": (("residence_card_registration", "alien_registration"), None),
    "health_insurance": (("nhis_enrollment_timing", "nhis_student_premium", "private_insurance_bridge", "national_health_insurance"), "nhis-english"),
    "bank_account": (("bank_account_opening",), "investkorea-bank"),
    "sim_esim": (("sim_esim_arrival",), None),
    "transport_card": (("transport_card_tmoney",), None),
    "pickup": (("university_airport_pickup", "airport_to_city"), None),
    "orientation": (("orientation_course_registration",), None),
    "campus_registration": (("orientation_course_registration",), None),
    "emergency_info": (("emergency_and_helplines",), None),
    "address_report": (("residence_report_changes", "address_change_report"), None),
}


@lru_cache(maxsize=8)
def _load_research(path: str, mtime: float):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _ser_src(s: dict) -> dict:
    return {"name": s.get("title") or s.get("name"), "url": s.get("url"), "verified_at": s.get("verified_at") or s.get("checked_at")}


def _normalise(data) -> dict[str, dict]:
    """Both research shapes → {topic_key: {summary, steps, documents, timing, cost, notes, sources, status}}."""
    out: dict[str, dict] = {}
    if isinstance(data, list):  # arrival-official.json: list of topics with inline sources
        for t in data:
            if isinstance(t, dict) and t.get("key"):
                out[t["key"]] = {
                    "summary": t.get("summary"), "steps": t.get("steps") or [], "documents": t.get("documents") or [], "timing": t.get("timing"),
                    "cost": t.get("cost"), "notes": t.get("notes"), "sources": [_ser_src(x) for x in t.get("sources") or [] if isinstance(x, dict)],
                    "status": t.get("verification_status") or "NEEDS_REVIEW", "raw_sources": t.get("sources") or [],
                }
    elif isinstance(data, dict):  # post-arrival-official.json: items with facts + a sources map
        srcs = data.get("sources") or {}
        for it in data.get("items") or []:
            if not isinstance(it, dict) or not it.get("key"):
                continue
            facts = [f for f in it.get("facts") or [] if isinstance(f, dict)]
            refs = [srcs.get(f.get("source_ref")) for f in facts if f.get("source_ref") in srcs]
            statuses = {f.get("status") for f in facts}
            out[it["key"]] = {
                "summary": " ".join(f.get("fact", "") for f in facts if f.get("status") == "VERIFIED") or None, "steps": [], "documents": [],
                "timing": None, "cost": None, "notes": " ".join(f.get("note", "") for f in facts if f.get("note")) or None,
                "sources": [_ser_src(x) for x in refs if x], "raw_sources": [],
                "status": "VERIFIED" if statuses == {"VERIFIED"} else ("PARTIAL" if statuses & {"VERIFIED", "PARTIAL"} else "NEEDS_REVIEW"),
            }
    return out


def research_topics() -> list[tuple[str, dict[str, dict]]]:
    out = []
    for name in ("arrival-official.json", "post-arrival-official.json"):
        p = REPO_ROOT / "docs" / "research" / name
        if p.exists():
            data = _load_research(str(p), p.stat().st_mtime)
            if data:
                out.append((name, _normalise(data)))
    return out


def official_facts(db: Session, step: str) -> dict:
    """What the student needs to know for a step, with its official source and verification status.
    Order: arrival-official.json → post-arrival-official.json → a Source row → NEEDS_REVIEW (never invented)."""
    cands, fallback_source = STEP_RESEARCH.get(step, ((step,), None))
    for fname, topics in research_topics():
        hit = next((k for k in cands if k in topics), None)
        if hit:
            t = topics[hit]
            srcs = t["sources"]
            return {"topic": hit, "summary": t["summary"], "steps": t["steps"], "documents": t["documents"], "timing": t["timing"], "cost": t["cost"],
                    "notes": t["notes"], "sources": srcs, "source": srcs[0] if srcs else None, "status": t["status"] if srcs else "NEEDS_REVIEW",
                    "research_file": fname}
    empty = {"topic": None, "summary": None, "steps": [], "documents": [], "timing": None, "cost": None, "notes": None, "sources": [], "research_file": None}
    if fallback_source:
        s = db.scalar(select(Source).where(Source.key == fallback_source))
        if s:
            src = {"name": s.name, "url": s.url, "verified_at": s.last_checked_at.date().isoformat() if s.last_checked_at else None}
            return {**empty, "sources": [src], "source": src, "status": "NEEDS_REVIEW"}
    return {**empty, "source": None, "status": "NEEDS_REVIEW"}


EMERGENCY_NUMBERS = [("112", "police"), ("119", "fire_ambulance"), ("1345", "immigration"), ("1330", "travel_helpline")]


def emergency_numbers() -> dict:
    """112 / 119 / 1345 / 1330 with the official page that confirms each (from the research file); a number whose page was
    not verified keeps status NEEDS_REVIEW — it is still shown, because these are the national numbers."""
    raw: list[dict] = []
    fname = None
    for name, topics in research_topics():
        t = topics.get("emergency_and_helplines")
        if t:
            raw, fname = t["raw_sources"], name
            break
    out = []
    for number, key in EMERGENCY_NUMBERS:
        src = next((x for x in raw if number in (x.get("title") or "") or number in (x.get("quote") or "")), None)
        if src is None:
            src = next((x for x in EMERGENCY_FALLBACK if x["number"] == number))["source"]
            out.append({"number": number, "key": key, "source": {"name": src["name"], "url": src["url"], "verified_at": None}, "status": "NEEDS_REVIEW"})
        else:
            out.append({"number": number, "key": key, "source": _ser_src(src), "status": "VERIFIED"})
    extra = next((x for x in raw if "033-811-2000" in (x.get("quote") or "")), None)
    if extra:
        out.append({"number": "033-811-2000", "key": "nhis_foreigners", "source": _ser_src(extra), "status": "VERIFIED"})
    return {"numbers": out, "research_file": fname}


# ----------------------------------------------------------------------------------------------- journey
BEFORE_STEPS = ["housing", "flight", "pickup", "documents_to_carry", "sim_esim", "orientation", "residence_setup"]
AFTER_STEPS = ["residence_card", "health_insurance", "bank_account", "sim_esim", "transport_card", "campus_registration", "emergency_info"]
# Steps the student ticks off themselves (ArrivalPlan.completed_items keys).
SELF_ITEMS = {"documents_to_carry", "sim_esim", "orientation", "residence_setup", "health_insurance", "bank_account", "transport_card",
              "campus_registration", "emergency_info", "pickup_not_needed"}


def _visa_issued(db: Session, student_user_id) -> bool:
    if db.scalar(select(VisaCase.id).where(VisaCase.student_user_id == student_user_id, VisaCase.status == VisaStatus.ISSUED).limit(1)):
        return True
    apps = db.scalars(select(Application).where(Application.student_user_id == student_user_id)).all()
    return any(reached(a.status, ApplicationStatus.VISA_ISSUED) and a.status != ApplicationStatus.WITHDRAWN for a in apps)


def _admitted(db: Session, student_user_id) -> bool:
    return _latest_application(db, student_user_id) is not None


def _housing_done(db: Session, student_user_id) -> bool:
    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == student_user_id))
    if h and h.status in (HousingStatus.DORM_CONFIRMED, HousingStatus.CONFIRMED):
        return True
    for t, ok in (("DORMITORY", {"CONFIRMED", "MOVED_IN"}), ("HOUSING_SEARCH", {"CONFIRMED", "MOVED_IN"}), ("TEMPORARY_HOUSING", {"BOOKED", "CHECKED_IN", "COMPLETED"})):
        c = latest_case(db, student_user_id, t)
        if c and c.status in ok:
            return True
    return False


def _housing_started(db: Session, student_user_id) -> bool:
    h = db.scalar(select(HousingCase).where(HousingCase.student_user_id == student_user_id))
    return bool(h and (h.preference or h.status != HousingStatus.NOT_STARTED)) or any(
        latest_case(db, student_user_id, t) for t in ("DORMITORY", "HOUSING_SEARCH", "TEMPORARY_HOUSING"))


def _stage(db: Session, student_user_id, plan: ArrivalPlan | None) -> str:
    if plan and plan.arrived_at:
        return "ARRIVED"
    if _visa_issued(db, student_user_id):
        return "READY_TO_COME"
    if _admitted(db, student_user_id):
        return "ADMITTED"
    return "QUIET"


def _step_status(db: Session, student_user_id, key: str, plan: ArrivalPlan | None) -> str:
    items = set((plan.completed_items if plan else None) or [])
    if key == "housing":
        return "done" if _housing_done(db, student_user_id) else "todo"
    if key == "flight":
        return "done" if plan and plan.flight_number and plan.arrival_at else "todo"
    if key == "pickup":
        if "pickup_not_needed" in items:
            return "not_needed"
        return "done" if latest_case(db, student_user_id, "AIRPORT_PICKUP") else "todo"
    if key == "residence_card":
        c = latest_case(db, student_user_id, "RESIDENCE_CARD")
        return "done" if c and c.status in ("SUBMITTED", "READY", "COLLECTED") else "todo"
    return "done" if key in items else "todo"


STEP_LINKS = {"housing": "/housing", "flight": "/arrival#flight", "pickup": "/arrival#pickup", "residence_card": "/arrival#residence",
              "emergency_info": "/help"}


def arrival_journey(db: Session, student_user_id) -> dict:
    plan = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == student_user_id))
    stage = _stage(db, student_user_id, plan)
    keys = AFTER_STEPS if stage == "ARRIVED" else BEFORE_STEPS
    if stage == "ARRIVED" and plan and "sim_esim" in (plan.completed_items or []):
        keys = [k for k in keys if k != "sim_esim"]  # done before arrival — don't ask again
    steps = []
    next_found = False
    for k in keys:
        status = _step_status(db, student_user_id, k, plan)
        locked = stage == "ADMITTED" and k != "housing"
        if locked:
            status = "locked"
        elif status == "todo" and not next_found:
            status, next_found = "next", True
        steps.append({"key": k, "status": status, "link": STEP_LINKS.get(k), "official": official_facts(db, k) if k in STEP_RESEARCH else None})
    app = _latest_application(db, student_user_id)
    uni = db.get(University, app.university_id) if app else None
    info = db.scalar(select(UniversityArrivalInfo).where(UniversityArrivalInfo.university_id == uni.id)) if uni else None
    pickup = latest_case(db, student_user_id, "AIRPORT_PICKUP", include_cancelled=True)
    rc = latest_case(db, student_user_id, "RESIDENCE_CARD")
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == student_user_id).order_by(VisaCase.updated_at.desc()))
    return {
        "stage": stage,
        "steps": steps,
        "next": next((s for s in steps if s["status"] == "next"), None),
        "flight": flight_view(plan),
        "flight_provider": get_flight_provider().name,
        "pickup": ser_case(db, pickup, staff=False, with_events=True) if pickup else None,
        "residence_card": ser_case(db, rc, staff=False, with_events=True) if rc else None,
        "arrived_at": plan.arrived_at.isoformat() if plan and plan.arrived_at else None,
        "residence_card_due": plan.residence_card_due.isoformat() if plan and plan.residence_card_due else None,
        "completed_items": (plan.completed_items if plan else None) or [],
        "university": {"id": str(uni.id), "name_en": uni.name_en} if uni else None,
        "university_arrival": {"group_residence_registration": info.group_residence_registration, "orientation_note": info.orientation_note,
                               "orientation_date": info.orientation_date.isoformat() if info.orientation_date else None,
                               "verification_status": info.verification_status, "source_url": info.source_url} if info else None,
        "visa_type": visa.visa_type.value if visa else None,
        "nationality": prof.nationality if prof else None,
        "emergency": emergency_numbers(),
        "help_categories": HELP_CATEGORIES,
    }


def home_stage(db: Session, student_user_id) -> dict | None:
    """For the coordinator's student home: current arrival/settlement stage and ONE next action, or None before admission.

    Returns {stage: ADMITTED|READY_TO_COME|ARRIVED|SETTLED, next: {key, link, title_key (concierge ns)} | None,
    done, total, residence_card_due}.
    """
    j = arrival_journey(db, student_user_id)
    if j["stage"] == "QUIET":
        return None
    steps = [s for s in j["steps"] if s["status"] != "locked"]
    nxt = j["next"]
    stage = j["stage"]
    if stage == "ARRIVED" and nxt is None:
        stage = "SETTLED"
    if stage == "ADMITTED" and _housing_started(db, student_user_id):
        # After admission housing is actionable; once it is under way, visa/tuition stay the main track (no concierge action).
        nxt = None
    return {
        "stage": stage,
        "title_key": f"concierge:home.{stage}",
        "next": {"key": nxt["key"], "link": nxt["link"] or "/arrival", "title_key": f"concierge:step.{nxt['key']}.title"} if nxt else None,
        "done": sum(1 for s in steps if s["status"] in ("done", "not_needed")),
        "total": len(steps),
        "residence_card_due": j["residence_card_due"],
    }


# ----------------------------------------------------------------------------------------------- agency Today + metrics
def today_items(db: Session, principal) -> list[dict]:
    """Service work for the coordinator's Agency Today: overdue SLAs, unassigned requests, pickups today/tomorrow,
    delayed flights, flight changes to re-confirm. Each item: {kind, case_id, type, status, reason, title_key (concierge ns),
    params, student, due_at, overdue, priority, link}."""
    stmt = scope_cases(select(ServiceCase), principal)
    now = _now()
    today = now.astimezone(SEOUL).date()
    out = []
    for c in db.scalars(stmt):
        if is_closed(c):
            continue
        reason = None
        if is_overdue(c, now):
            reason = "overdue"
        elif (c.details or {}).get("reconfirm"):
            reason = "reconfirm"
        elif c.case_type == "AIRPORT_PICKUP" and c.status == "FLIGHT_DELAYED":
            reason = "flight_delayed"
        elif c.owner_user_id is None and (principal.is_hangyul or c.routed_to == "AGENCY"):
            reason = "needs_assignment"
        elif c.case_type == "AIRPORT_PICKUP" and c.due_at and c.due_at.astimezone(SEOUL).date() in (today, today + timedelta(days=1)):
            reason = "pickup_soon"
        elif c.priority == "URGENT":
            reason = "urgent"
        if not reason:
            continue
        stu = db.get(User, c.student_user_id)
        out.append({"kind": "service_case", "case_id": str(c.id), "type": c.case_type, "status": c.status, "reason": reason,
                    "title_key": f"concierge:today.{reason}", "params": {"type": c.case_type, "student": stu.full_name if stu else ""},
                    "student": {"id": str(stu.id), "full_name": stu.full_name} if stu else None,
                    "due_at": (c.sla_due_at if reason == "overdue" else c.due_at or c.sla_due_at).isoformat() if (c.due_at or c.sla_due_at) else None,
                    "overdue": reason == "overdue", "priority": c.priority, "link": f"/services?case={c.id}"})
    order = {"overdue": 0, "urgent": 1, "flight_delayed": 2, "reconfirm": 3, "pickup_soon": 4, "needs_assignment": 5}
    out.sort(key=lambda x: (order[x["reason"]], x["due_at"] or "9999"))
    return out[:50]


MIN_N = 5


def _rate(num: int, den: int, definition: str) -> dict:
    return {"numerator": num, "denominator": den, "value": (round(num / den, 3) if den >= MIN_N else None), "insufficient": den < MIN_N,
            "definition": definition}


def concierge_metrics(db: Session, org_id: uuid.UUID | None, start: datetime, end: datetime) -> dict:
    """Service quality for one agency (org_id) or everyone (None). Population: cases created in [start, end)."""
    stmt = select(ServiceCase).where(ServiceCase.created_at >= start, ServiceCase.created_at < end)
    if org_id:
        stmt = stmt.where(ServiceCase.agency_org_id == org_id)
    cases = db.scalars(stmt).all()
    now = _now()
    decided = [c for c in cases if c.status != "CANCELLED"]
    completed = [c for c in decided if state(c).bucket == "done"]
    with_sla = [c for c in cases if c.sla_due_at and (c.sla_due_at < now or (c.details or {}).get("first_action_at"))]
    breached = [c for c in with_sla if sla_breached(c, now)]
    pickups_due = [c for c in cases if c.case_type == "AIRPORT_PICKUP" and c.status != "CANCELLED" and c.due_at and c.due_at < now]
    pickups_done = [c for c in pickups_due if c.status == "COMPLETED"]
    ids = [c.id for c in cases]
    no_show_n = len(db.scalars(select(ServiceCaseEvent.id).where(ServiceCaseEvent.case_id.in_(ids), ServiceCaseEvent.to_status == "NO_SHOW")).all()) if ids else 0
    hours = [(c.closed_at - c.created_at).total_seconds() / 3600 for c in completed if c.closed_at and c.created_at]
    fb = [c for c in cases if c.feedback_ok is not None]
    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "population": "Service cases created in the period" + (" for this agency's students" if org_id else ""),
        "n_cases": len(cases),
        "completion": _rate(len(completed), len(decided), "Completed ÷ cases created in the period (cancelled excluded)"),
        "sla_breach": _rate(len(breached), len(with_sla), "Cases where the team acted after the SLA (or has not acted and the SLA passed) ÷ cases whose SLA has come due"),
        "arrival_support_completion": _rate(len(pickups_done), len(pickups_due), "Airport pickups completed ÷ pickups whose arrival time has passed (cancelled excluded)"),
        "counts": {
            "pickups_completed": sum(1 for c in cases if c.case_type == "AIRPORT_PICKUP" and c.status == "COMPLETED"),
            "no_shows": no_show_n,
            "student_issues": sum(1 for c in cases if c.help_category),
            "housing_confirmed": sum(1 for c in cases if (c.case_type, c.status) in {("DORMITORY", "CONFIRMED"), ("DORMITORY", "MOVED_IN"), ("HOUSING_SEARCH", "CONFIRMED"), ("HOUSING_SEARCH", "MOVED_IN")}),
        },
        "time_to_resolution_hours": {"median": round(median(hours), 1) if len(hours) >= MIN_N else None, "n": len(hours), "insufficient": len(hours) < MIN_N,
                                     "definition": "Median hours from request to completion, completed cases only"},
        "feedback": {"yes": sum(1 for c in fb if c.feedback_ok), "no": sum(1 for c in fb if not c.feedback_ok), "n": len(fb),
                     "share_yes": round(sum(1 for c in fb if c.feedback_ok) / len(fb), 3) if len(fb) >= MIN_N else None, "insufficient": len(fb) < MIN_N,
                     "definition": "Students who answered 'Did this go well?' — yes ÷ answers; withheld below 5 answers"},
    }


def staff_can_edit(p) -> bool:
    return p.is_hangyul or p.is_agency


def staff_can_manage_vendors(p) -> bool:
    return p.has(Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS) or p.is_agency
