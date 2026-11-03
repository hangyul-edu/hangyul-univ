"""V5 — visa route models (owned by the visa_routes workstream; see docs/VISA_ROUTES.md → Implementation).

* ``VisaRoute`` / ``VisaRouteDocument`` — the researched embassy playbooks (docs/research/visa-playbooks.json), versioned:
  a changed playbook becomes a new version and the previous one stops being current. Never edited by hand in the app.
* ``VisaRouteAnswer`` — the one jurisdiction answer (region / hukou / passport place of issue) and the sponsor choice the
  student gave for route resolution (also usable before admission).
* ``VisaCaseTrack`` — what Hangyul records around an existing ``VisaCase``: resolved route + post snapshot, the
  preparation form the student confirmed (for their own preparation — never submitted anywhere), the documents linked to
  visa items, the appointment, the submission evidence, the decision and the issued visa. ``VisaCase.status`` /
  ``submitted_on`` / ``issued_on`` stay the canonical fields other modules (concierge home stage) read.
* ``VisaEmbassyRequest`` — "the embassy asked for something": note + due date → student task + visa support case.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = ["VisaRoute", "VisaRouteDocument", "VisaRouteAnswer", "VisaCaseTrack", "VisaEmbassyRequest"]


class VisaRoute(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_routes"
    __table_args__ = (UniqueConstraint("country", "visa_type", "version", name="uq_visa_route_version"),)
    country: Mapped[str] = mapped_column(String(2), index=True)
    country_name: Mapped[str] = mapped_column(String(80))
    visa_type: Mapped[str] = mapped_column(String(8))  # D-2-2 | D-2-3 | D-2-4 | D-2 | D-4-1
    degree_levels: Mapped[list[str]] = mapped_column(JSON, default=list)  # BACHELOR | MASTER | DOCTORAL | LANGUAGE
    jurisdiction: Mapped[list[dict]] = mapped_column(JSON, default=list)  # [{post_name, city, url, covers_regions}]
    application_method: Mapped[dict] = mapped_column(JSON, default=dict)  # {kind, details, url}
    e_visa_available: Mapped[bool] = mapped_column(Boolean, default=False)
    e_visa_condition: Mapped[str | None] = mapped_column(Text)
    financial: Mapped[dict | None] = mapped_column(JSON)
    fees: Mapped[dict | None] = mapped_column(JSON)
    processing_time: Mapped[str | None] = mapped_column(Text)
    special_notes: Mapped[list[str] | None] = mapped_column(JSON)
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    sources: Mapped[list[dict]] = mapped_column(JSON, default=list)
    verification_status: Mapped[str] = mapped_column(String(24))  # VERIFIED | PARTIAL | NEEDS_REVIEW (research status, as-is)
    verified_at: Mapped[date | None] = mapped_column(Date)
    effective_from: Mapped[date | None] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    dataset: Mapped[str] = mapped_column(String(120), default="docs/research/visa-playbooks.json")


class VisaRouteDocument(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_route_documents"
    route_id: Mapped[uuid.UUID] = fk("visa_routes.id", ondelete="CASCADE")
    key: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(Text)  # research wording (English), shown only as "exact wording"
    requirement: Mapped[str] = mapped_column(String(16))  # REQUIRED | CONDITIONAL | OPTIONAL
    condition: Mapped[str | None] = mapped_column(Text)
    validity_text: Mapped[str | None] = mapped_column(Text)
    validity_days: Mapped[int | None] = mapped_column(Integer)  # parsed from validity_text when it says "issued within N days/weeks/months"
    legalization: Mapped[str | None] = mapped_column(String(16))  # APOSTILLE | CONSULAR | NONE | null (unknown)
    translation: Mapped[str | None] = mapped_column(Text)
    provided_by: Mapped[str | None] = mapped_column(String(16))  # student | university | bank | sponsor | authority
    notes: Mapped[str | None] = mapped_column(Text)
    document_category: Mapped[str | None] = mapped_column(String(48))  # dossier category it can reuse (None = visa-only paper)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class VisaRouteAnswer(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_route_answers"
    student_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)  # {post_key, region_label, sponsor}


class VisaCaseTrack(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_case_tracks"
    visa_case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("visa_cases.id", ondelete="CASCADE"), unique=True)
    student_user_id: Mapped[uuid.UUID] = fk("users.id", ondelete="CASCADE")
    route_id: Mapped[uuid.UUID | None] = fk("visa_routes.id", nullable=True, ondelete="SET NULL")
    post_key: Mapped[str | None] = mapped_column(String(64))
    method: Mapped[str | None] = mapped_column(String(24))
    form: Mapped[dict | None] = mapped_column(JSON)  # {section: {confirmed_at, values}} — the student's own confirmation
    item_documents: Mapped[dict | None] = mapped_column(JSON)  # {route doc key: document id}
    item_marks: Mapped[dict | None] = mapped_column(JSON)  # {route doc key: {received_at}} — paper from the university in hand
    appointment_on: Mapped[date | None] = mapped_column(Date)
    appointment_status: Mapped[str | None] = mapped_column(String(12))  # PLANNED | BOOKED
    appointment_post: Mapped[str | None] = mapped_column(String(64))
    appointment_reference: Mapped[str | None] = mapped_column(String(120))
    handoff_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submission_reference: Mapped[str | None] = mapped_column(String(120))
    submission_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    decision: Mapped[str | None] = mapped_column(String(12))  # APPROVED | REFUSED
    decision_on: Mapped[date | None] = mapped_column(Date)
    decision_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    visa_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    pack_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pack_reviewed_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    support_case_id: Mapped[uuid.UUID | None] = fk("service_cases.id", nullable=True, ondelete="SET NULL")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class VisaEmbassyRequest(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_embassy_requests"
    visa_case_id: Mapped[uuid.UUID] = fk("visa_cases.id", ondelete="CASCADE")
    student_user_id: Mapped[uuid.UUID] = fk("users.id", ondelete="CASCADE")
    note: Mapped[str] = mapped_column(Text)
    due_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="OPEN")  # OPEN | SENT | CLOSED
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
