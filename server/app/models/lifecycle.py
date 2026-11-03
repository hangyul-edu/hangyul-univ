"""Visa, housing, arrival, post-enrollment lifecycle, content, analytics, audit."""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, SourcedMixin, TimestampMixin, enum_col, fk
from app.models.enums import (
    ContentStatus,
    ContentType,
    EnrollmentStatus,
    HousingStatus,
    TicketStatus,
    VisaStatus,
    VisaType,
)


class VisaRequirement(IdMixin, TimestampMixin, SourcedMixin, Base):
    """Rule rows: visa_type + optional nationality/consulate specialisation. More specific rows add to or override generic ones."""
    __tablename__ = "visa_requirements"
    visa_type: Mapped[VisaType] = enum_col(VisaType, index=True)
    nationality: Mapped[str | None] = mapped_column(String(2))
    consulate: Mapped[str | None] = mapped_column(String(120))
    step_key: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str | None] = mapped_column(Text)
    document_category: Mapped[str | None] = mapped_column(String(48))
    depends_on: Mapped[list[str] | None] = mapped_column(JSON)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    replaces_step_key: Mapped[str | None] = mapped_column(String(64))
    sort_order: Mapped[int] = mapped_column(Integer, default=100)


class VisaCase(IdMixin, TimestampMixin, Base):
    __tablename__ = "visa_cases"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    visa_type: Mapped[VisaType] = enum_col(VisaType)
    visa_type_reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[VisaStatus] = enum_col(VisaStatus, default=VisaStatus.NOT_STARTED, index=True)
    consulate: Mapped[str | None] = mapped_column(String(160))
    completed_steps: Mapped[list[str] | None] = mapped_column(JSON)
    submitted_on: Mapped[date | None] = mapped_column(Date)
    issued_on: Mapped[date | None] = mapped_column(Date)
    expires_on: Mapped[date | None] = mapped_column(Date)
    target_entry_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    blockers: Mapped[list[str] | None] = mapped_column(JSON)


class HousingCase(IdMixin, TimestampMixin, Base):
    __tablename__ = "housing_cases"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    dormitory_id: Mapped[uuid.UUID | None] = fk("dormitories.id", nullable=True, ondelete="SET NULL")
    status: Mapped[HousingStatus] = enum_col(HousingStatus, default=HousingStatus.NOT_STARTED)
    preference: Mapped[str | None] = mapped_column(String(24))
    budget_monthly_krw: Mapped[int | None] = mapped_column(Integer)
    room_preference: Mapped[str | None] = mapped_column(String(40))
    max_commute_minutes: Mapped[int | None] = mapped_column(Integer)
    application_deadline: Mapped[date | None] = mapped_column(Date)
    completed_items: Mapped[list[str] | None] = mapped_column(JSON)
    notes: Mapped[str | None] = mapped_column(Text)
    # V5 concierge: housing profile (only prefs that change a decision) and move-in details.
    profile: Mapped[dict | None] = mapped_column(JSON)
    move_in: Mapped[dict | None] = mapped_column(JSON)


class ArrivalPlan(IdMixin, TimestampMixin, Base):
    __tablename__ = "arrival_plans"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    flight_number: Mapped[str | None] = mapped_column(String(20))
    arrival_airport: Mapped[str | None] = mapped_column(String(8))
    arrival_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pickup_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_status: Mapped[str | None] = mapped_column(String(24))  # REQUESTED | CONFIRMED | NOT_AVAILABLE
    completed_items: Mapped[list[str]] = mapped_column(JSON, default=list)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    residence_card_due: Mapped[date | None] = mapped_column(Date)
    # V5 concierge: FlightInfo {number, scheduled_arrival, estimated_arrival, terminal, source MANUAL|PROVIDER, updated_at}
    flight_info: Mapped[dict | None] = mapped_column(JSON)


class StudentEnrollment(IdMixin, TimestampMixin, Base):
    __tablename__ = "student_enrollments"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True, ondelete="SET NULL")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    agency_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    cohort_label: Mapped[str] = mapped_column(String(24), index=True)  # e.g. "2025-FALL"
    nationality: Mapped[str | None] = mapped_column(String(2))
    status: Mapped[EnrollmentStatus] = enum_col(EnrollmentStatus, default=EnrollmentStatus.ENROLLED)
    enrolled_on: Mapped[date] = mapped_column(Date)
    expected_graduation: Mapped[date | None] = mapped_column(Date)
    visa_expires_on: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class StudentTerm(IdMixin, Base):
    __tablename__ = "student_terms"
    __table_args__ = (UniqueConstraint("enrollment_id", "term_label"),)
    enrollment_id: Mapped[uuid.UUID] = fk("student_enrollments.id")
    term_label: Mapped[str] = mapped_column(String(24))
    registered: Mapped[bool] = mapped_column(Boolean, default=True)
    gpa_percent: Mapped[float | None] = mapped_column(Float)  # only when integrated with the university
    attendance_percent: Mapped[float | None] = mapped_column(Float)
    academic_standing: Mapped[str | None] = mapped_column(String(24))  # GOOD | WARNING | PROBATION
    data_source: Mapped[str] = mapped_column(String(24), default="SELF_REPORTED")  # UNIVERSITY_FEED | SELF_REPORTED


class StudentOutcome(IdMixin, TimestampMixin, Base):
    __tablename__ = "student_outcomes"
    enrollment_id: Mapped[uuid.UUID] = fk("student_enrollments.id")
    kind: Mapped[str] = mapped_column(String(32))  # GRADUATED | WITHDRAWN | TRANSFERRED | EMPLOYED_KR | FURTHER_STUDY | RETURNED_HOME
    occurred_on: Mapped[date] = mapped_column(Date)
    detail: Mapped[str | None] = mapped_column(Text)


class SupportTicket(IdMixin, TimestampMixin, Base):
    __tablename__ = "support_tickets"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    category: Mapped[str] = mapped_column(String(32))  # VISA | HOUSING | ACADEMIC | HEALTH | FINANCE | OTHER
    subject: Mapped[str] = mapped_column(String(200))
    status: Mapped[TicketStatus] = enum_col(TicketStatus, default=TicketStatus.OPEN)
    priority: Mapped[str] = mapped_column(String(16), default="MEDIUM")


class ContentArticle(IdMixin, TimestampMixin, Base):
    __tablename__ = "content_articles"
    __table_args__ = (UniqueConstraint("slug", "locale"),)
    slug: Mapped[str] = mapped_column(String(160), index=True)
    locale: Mapped[str] = mapped_column(String(16))
    content_type: Mapped[ContentType] = enum_col(ContentType)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text)
    body_md: Mapped[str] = mapped_column(Text)
    seo_title: Mapped[str | None] = mapped_column(String(300))
    seo_description: Mapped[str | None] = mapped_column(String(400))
    source_keys: Mapped[list[str] | None] = mapped_column(JSON)
    country_code: Mapped[str | None] = mapped_column(String(2))
    status: Mapped[ContentStatus] = enum_col(ContentStatus, default=ContentStatus.DRAFT)
    author_name: Mapped[str | None] = mapped_column(String(120))
    reviewer_name: Mapped[str | None] = mapped_column(String(120))
    last_verified_at: Mapped[date | None] = mapped_column(Date)
    translation_status: Mapped[str] = mapped_column(String(24), default="SOURCE")


class AnalyticsEvent(IdMixin, Base):
    __tablename__ = "analytics_events"
    name: Mapped[str] = mapped_column(String(48), index=True)
    user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    nationality: Mapped[str | None] = mapped_column(String(2))
    properties: Mapped[dict | None] = mapped_column(JSON)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class DailyMetric(IdMixin, Base):
    """Pre-aggregated rollup so dashboards never scan raw events. Rebuilt by app.jobs.rollup."""
    __tablename__ = "daily_metrics"
    __table_args__ = (UniqueConstraint("day", "metric", "scope_type", "scope_id", "dimension", "dimension_value"),)
    day: Mapped[date] = mapped_column(Date, index=True)
    metric: Mapped[str] = mapped_column(String(48))
    scope_type: Mapped[str] = mapped_column(String(16))  # GLOBAL | AGENCY | UNIVERSITY
    scope_id: Mapped[str] = mapped_column(String(64), default="*")
    dimension: Mapped[str] = mapped_column(String(32), default="*")
    dimension_value: Mapped[str] = mapped_column(String(64), default="*")
    value: Mapped[float] = mapped_column(Float)


class AuditLog(IdMixin, Base):
    __tablename__ = "audit_logs"
    actor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    actor_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(48))
    entity_id: Mapped[str | None] = mapped_column(String(64), index=True)
    subject_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")  # whose data
    detail: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
