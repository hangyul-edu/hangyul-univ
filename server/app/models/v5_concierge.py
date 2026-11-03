"""V5 — concierge models (owned by the concierge workstream).

One fulfilment model for everything that happens after admission: ``ServiceCase`` (+ ``ServiceCaseEvent`` history),
a vendor / partner network (``Vendor``), off-campus listings from vendors (``HousingListing``) and per-university
arrival facts (``UniversityArrivalInfo``). Status values are VARCHAR and validated per case type by the state table in
``app/services/concierge.py`` — the visa workstream registers its own VISA_SUPPORT table there.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = ["Vendor", "ServiceCase", "ServiceCaseEvent", "HousingListing", "UniversityArrivalInfo"]


class Vendor(IdMixin, TimestampMixin, Base):
    """A provider that fulfils part of a service (driver company, housing provider, translator…).

    ``organization_id`` NULL = Hangyul network (visible to every agency); set = an agency's own provider.
    A vendor is presented to students as a *partner* only while ``agreement.active`` is true and today is within
    ``since``/``until``. Demo vendors (``is_demo``) are always labelled "Demo provider".
    """
    __tablename__ = "vendors"
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(32), index=True)  # airport_transport | housing_provider | translation | legalization | sim_esim | insurance | relocation
    service_area: Mapped[list[str] | None] = mapped_column(JSON)  # e.g. ["ICN", "GMP", "Seoul"]
    languages: Mapped[list[str] | None] = mapped_column(JSON)
    price_model: Mapped[str | None] = mapped_column(String(300))  # human description, e.g. "Fixed fare per vehicle, quoted per booking"
    availability: Mapped[str | None] = mapped_column(String(300))
    sla_hours: Mapped[int | None] = mapped_column(Integer)  # confirm a request within N hours
    contact: Mapped[dict | None] = mapped_column(JSON)  # {name, phone, email, kakao, whatsapp}
    quality_status: Mapped[str] = mapped_column(String(16), default="NEW")  # NEW | GOOD | WATCH | SUSPENDED
    agreement: Mapped[dict | None] = mapped_column(JSON)  # {active, since, until, reference} | null
    notes: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class ServiceCase(IdMixin, TimestampMixin, Base):
    __tablename__ = "service_cases"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    agency_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    owner_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    routed_to: Mapped[str] = mapped_column(String(16), default="AGENCY")  # AGENCY | HANGYUL_OPS
    case_type: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    priority: Mapped[str] = mapped_column(String(12), default="MEDIUM")  # LOW | MEDIUM | HIGH | URGENT
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)  # when the service happens (pickup time, move-in…)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)  # when the team must have acted
    vendor_id: Mapped[uuid.UUID | None] = fk("vendors.id", nullable=True, ondelete="SET NULL")
    cost_amount: Mapped[int | None] = mapped_column(Integer)
    cost_currency: Mapped[str | None] = mapped_column(String(3))
    cost_payer: Mapped[str | None] = mapped_column(String(16))  # student | hangyul | university | included
    details: Mapped[dict | None] = mapped_column(JSON)  # type-specific (flight, pickup, dormitory, lease, help…)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    help_category: Mapped[str | None] = mapped_column(String(32))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    feedback_ok: Mapped[bool | None] = mapped_column(Boolean)
    feedback_comment: Mapped[str | None] = mapped_column(String(500))
    feedback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class ServiceCaseEvent(IdMixin, Base):
    """History of a case. ``visibility`` STUDENT events are shown to the student; INTERNAL never leave the console."""
    __tablename__ = "service_case_events"
    case_id: Mapped[uuid.UUID] = fk("service_cases.id")
    kind: Mapped[str] = mapped_column(String(24))  # CREATED | STATUS | OWNER | VENDOR | NOTE | FLIGHT_CHANGE | PROOF | NO_SHOW | FEEDBACK | ATTACHMENT | UPDATE
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str | None] = mapped_column(String(32))
    body: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON)
    visibility: Mapped[str] = mapped_column(String(12), default="INTERNAL")  # INTERNAL | STUDENT
    attachment_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    actor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class HousingListing(IdMixin, TimestampMixin, Base):
    """An off-campus room offered by a vendor. Hangyul never invents listings: rows come from a vendor feed or are
    entered by staff from a vendor, and carry ``verification_status`` (DEMO | UNVERIFIED | PROVIDER_CONFIRMED | STAFF_VERIFIED)."""
    __tablename__ = "housing_listings"
    vendor_id: Mapped[uuid.UUID] = fk("vendors.id")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    title: Mapped[str] = mapped_column(String(200))
    area: Mapped[str | None] = mapped_column(String(160))  # neighbourhood, never an exact address before a viewing
    room_type: Mapped[str | None] = mapped_column(String(40))  # studio | shared | goshiwon | one_room…
    rent_monthly_krw: Mapped[int | None] = mapped_column(Integer)
    deposit_krw: Mapped[int | None] = mapped_column(Integer)
    management_fee_krw: Mapped[int | None] = mapped_column(Integer)
    contract_months_min: Mapped[int | None] = mapped_column(Integer)
    commute_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_km: Mapped[float | None] = mapped_column()
    furnished: Mapped[bool | None] = mapped_column(Boolean)
    utilities: Mapped[str | None] = mapped_column(String(200))
    available_from: Mapped[date | None] = mapped_column(Date)
    verification_status: Mapped[str] = mapped_column(String(24), default="UNVERIFIED")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class UniversityArrivalInfo(IdMixin, TimestampMixin, Base):
    """Per-university arrival facts that change the student's steps (e.g. group residence-card registration)."""
    __tablename__ = "university_arrival_info"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    group_residence_registration: Mapped[bool | None] = mapped_column(Boolean)  # null = unknown → "ask your international office"
    orientation_note: Mapped[str | None] = mapped_column(Text)
    orientation_date: Mapped[date | None] = mapped_column(Date)
    international_office_contact: Mapped[str | None] = mapped_column(String(300))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_status: Mapped[str] = mapped_column(String(24), default="DEMO")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
