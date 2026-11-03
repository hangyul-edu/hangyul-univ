"""V5 — admission success + submission models (owned by the success workstream).

* ``SubmissionConnector`` — how an application to one university (optionally one program / degree level / intake term)
  is actually submitted: method, provider, official portal, application fee and who is paid, confirmation method,
  provenance (source_url, last_verified, verification_status). Never stores credentials.
* ``ApplicationSubmission`` — what happened to one application at submission: hand-off, the student's or counselor's
  record of the external submission and its evidence (confirmation id and/or receipt document), and the university
  application-fee status (kept apart from the Hangyul service fee and from tuition).
* ``PortfolioReview`` — a counselor's recorded review of a student's set of applications (decision + note).
* ``LanguageRecommendation`` — a program's *recommended* (not minimum) language level. Seeded only as SAMPLE data.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = ["SubmissionConnector", "ApplicationSubmission", "PortfolioReview", "LanguageRecommendation", "SubmissionAgencyPermission",
           "SubmissionAuthorization"]


class SubmissionConnector(IdMixin, TimestampMixin, Base):
    __tablename__ = "submission_connectors"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    # Optional narrowing: the most specific matching row wins (program > degree level + term > degree level > university).
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True)
    degree_level: Mapped[str | None] = mapped_column(String(24))
    intake_term: Mapped[str | None] = mapped_column(String(16))
    # DIRECT_API | PARTNER_API | AUTHORIZED_AGENCY | APPLICATION_PROVIDER | GUIDED_EXTERNAL | MANUAL
    # (V6: AGENCY_ASSISTED is read as an alias of AUTHORIZED_AGENCY; migration e6a1b2c3d4f5 rewrote stored values.)
    method: Mapped[str] = mapped_column(String(24), default="MANUAL")
    provider: Mapped[str | None] = mapped_column(String(160))  # e.g. "University online application system"
    portal_name: Mapped[str | None] = mapped_column(String(160))  # V6: the portal people actually open ("JinhakApply")
    portal_url: Mapped[str | None] = mapped_column(String(1000))
    official_url: Mapped[str | None] = mapped_column(String(1000))  # V6: the university's own notice/guide page
    supported_actions: Mapped[list[str] | None] = mapped_column(JSON)  # HANDOFF | RECORD_CONFIRMATION | UPLOAD_RECEIPT | SUBMIT_VIA_API
    login_requirements: Mapped[str | None] = mapped_column(Text)  # described only; credentials are never stored
    fee_amount: Mapped[int | None] = mapped_column(Integer)  # university application fee (not Hangyul's fee, not tuition)
    fee_currency: Mapped[str | None] = mapped_column(String(3))
    fee_payment_method: Mapped[str | None] = mapped_column(String(160))
    fee_payee: Mapped[str | None] = mapped_column(String(160))  # who is paid (the university, a provider…)
    fee_payer: Mapped[str | None] = mapped_column(String(16))  # V6: STUDENT | AGENCY | UNKNOWN — who pays it
    documents_accepted: Mapped[str | None] = mapped_column(String(16))  # ONLINE | MAIL | BOTH | UNKNOWN
    originals_by_mail: Mapped[bool | None] = mapped_column(Boolean)  # V6: paper originals must also be posted
    confirmation_method: Mapped[str | None] = mapped_column(Text)
    receipt_method: Mapped[str | None] = mapped_column(Text)  # V6: what proof the portal gives (slip, printable form, e-mail)
    # V6: how Hangyul learns the outcome after submission — NONE | MANUAL | WEBHOOK | POLLING. Only NONE/MANUAL exist today.
    status_sync: Mapped[str] = mapped_column(String(16), default="NONE", server_default="NONE")
    # V6: AUTHORIZED_AGENCY is only usable with an explicit legal basis (agreement clause / provider terms) on record.
    # No catalogued university has one (2026-10: applicants must apply personally on UWAY / JinhakApply / Gradnet).
    agency_submission_basis: Mapped[str | None] = mapped_column(Text)
    agency_submission_basis_url: Mapped[str | None] = mapped_column(String(1000))
    agency_submission_basis_verified: Mapped[date | None] = mapped_column(Date)
    instructions: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    last_verified: Mapped[date | None] = mapped_column(Date)
    verified_source: Mapped[str | None] = mapped_column(String(300))  # V6: title of the source that was checked
    # VERIFIED | NEEDS_REVIEW | SAMPLE — NEEDS_REVIEW rows say "your counselor confirms it" in every UI.
    verification_status: Mapped[str] = mapped_column(String(24), default="NEEDS_REVIEW")
    notes: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class ApplicationSubmission(IdMixin, TimestampMixin, Base):
    __tablename__ = "application_submissions"
    __table_args__ = (UniqueConstraint("application_id"),)
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    connector_id: Mapped[uuid.UUID | None] = fk("submission_connectors.id", nullable=True, ondelete="SET NULL")
    method: Mapped[str] = mapped_column(String(24))
    # NOT_STARTED | READY_FOR_HANDOFF | HANDED_OFF | SUBMITTED_CONFIRMED | SUBMITTED_UNCONFIRMED
    status: Mapped[str] = mapped_column(String(24), default="NOT_STARTED", index=True)
    handed_off_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    handed_off_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    submitted_on: Mapped[date | None] = mapped_column(Date)  # the date the student/counselor says it was submitted
    external_reference: Mapped[str | None] = mapped_column(String(120))  # confirmation / application number
    receipt_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    evidence_kind: Mapped[str] = mapped_column(String(24), default="NONE")  # NONE | CONFIRMATION_ID | RECEIPT | CONFIRMATION_AND_RECEIPT
    recorded_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    recorded_by_role: Mapped[str | None] = mapped_column(String(16))  # STUDENT | AGENCY | HANGYUL
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # University application fee — never the Hangyul service fee and never tuition.
    fee_status: Mapped[str] = mapped_column(String(16), default="UNKNOWN")  # NOT_REQUIRED | UNPAID | PAID | CONFIRMED | UNKNOWN
    fee_amount: Mapped[int | None] = mapped_column(Integer)
    fee_currency: Mapped[str | None] = mapped_column(String(3))
    fee_payee: Mapped[str | None] = mapped_column(String(160))
    fee_paid_on: Mapped[date | None] = mapped_column(Date)
    # Share of required checklist items that were ready when the submission was recorded (metrics; 0–1).
    completeness_at_submission: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)
    # V6: the student's authorisation the agency submitted under (AUTHORIZED_AGENCY), and the last reported failure.
    authorization_id: Mapped[uuid.UUID | None] = fk("submission_authorizations.id", nullable=True, ondelete="SET NULL")
    failure_reason: Mapped[str | None] = mapped_column(Text)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class SubmissionAgencyPermission(IdMixin, TimestampMixin, Base):
    """V6: which agency may submit under a connector's recorded legal basis (per-connector / per-agency flag).
    A connector only allows agency submission when it records ``agency_submission_basis``; this row then names the
    agency that is party to it. ``basis`` DEMO rows are development fixtures (no real agreement) — never in production."""
    __tablename__ = "submission_agency_permissions"
    __table_args__ = (UniqueConstraint("connector_id", "agency_org_id"),)
    connector_id: Mapped[uuid.UUID] = fk("submission_connectors.id")
    agency_org_id: Mapped[uuid.UUID] = fk("organizations.id")
    basis: Mapped[str] = mapped_column(String(16), default="CONTRACT")  # CONTRACT | DEMO
    contract_reference: Mapped[str | None] = mapped_column(String(160))
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class SubmissionAuthorization(IdMixin, TimestampMixin, Base):
    """V6: the student's explicit consent for their agency to submit one application, with a snapshot of exactly what
    was authorised (form summary, university/program/intake, documents, fee and payer, who submits). ACTIVE until the
    agency records the submission (USED) or the student withdraws it before submission (REVOKED)."""
    __tablename__ = "submission_authorizations"
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    agency_org_id: Mapped[uuid.UUID] = fk("organizations.id")
    submitter_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")  # the named counselor
    permission_id: Mapped[uuid.UUID | None] = fk("submission_agency_permissions.id", nullable=True, ondelete="SET NULL")
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", index=True)  # ACTIVE | REVOKED | USED
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str] = mapped_column(String(32))
    snapshot: Mapped[dict] = mapped_column(JSON)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class PortfolioReview(IdMixin, TimestampMixin, Base):
    __tablename__ = "portfolio_reviews"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    reviewed_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    decision: Mapped[str] = mapped_column(String(24))  # BALANCED | ADD_OPTION | DROP_OPTION | SPREAD_DEADLINES | BUDGET_TALK | DISCUSS
    note: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[list[str] | None] = mapped_column(JSON)  # observation codes shown when the review was recorded
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class LanguageRecommendation(IdMixin, TimestampMixin, Base):
    """A *recommended* language level for a program (above the published minimum). Honest labelling: basis SAMPLE
    rows are demo data and every UI says so; a university-published recommendation would be OFFICIAL with a source."""
    __tablename__ = "language_recommendations"
    __table_args__ = (UniqueConstraint("program_id"),)
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    recommended_topik_level: Mapped[int | None] = mapped_column(Integer)
    recommended_ielts: Mapped[float | None] = mapped_column(Float)
    basis: Mapped[str] = mapped_column(String(16), default="SAMPLE")  # SAMPLE | OFFICIAL
    source_url: Mapped[str | None] = mapped_column(String(1000))
    note: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
