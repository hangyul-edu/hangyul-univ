"""V29 production-security tables: staff MFA, the durable worker's run ledger, operational failure events and legal
holds. Migration: `alembic/versions/v29_security.py` (revision `v29sec0001`)."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, fk, utcnow


class StaffMfa(IdMixin, Base):
    """One TOTP factor per user. The secret is AES-256-GCM sealed (`app/core/crypto.py`), bound to the user id."""
    __tablename__ = "staff_mfa"
    user_id: Mapped[uuid.UUID] = fk("users.id", index=False)
    secret_ciphertext: Mapped[str] = mapped_column(Text)
    key_version: Mapped[int] = mapped_column(Integer, default=1)
    #: NULL while enrolment is pending (secret shown, first code not yet confirmed).
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: The last accepted TOTP time-step: a code cannot be replayed inside its own 30-s window.
    last_used_step: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    __table_args__ = (UniqueConstraint("user_id", name="uq_staff_mfa_user_id"),)


class MfaRecoveryCode(IdMixin, Base):
    """Ten one-time codes per enrolment, stored as SHA-256 of a 50-bit random value; shown once."""
    __tablename__ = "mfa_recovery_codes"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    code_hash: Mapped[str] = mapped_column(String(64))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobRun(IdMixin, Base):
    """One row per (job, schedule window). The unique key is what makes a window run at most once to success across
    worker replicas; the advisory lock only stops two replicas working on it at the same moment."""
    __tablename__ = "job_runs"
    name: Mapped[str] = mapped_column(String(64))
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="RUNNING")  # RUNNING | SUCCEEDED | FAILED
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict | None] = mapped_column(JSON)
    worker_id: Mapped[str | None] = mapped_column(String(120))
    __table_args__ = (UniqueConstraint("name", "scheduled_for", name="uq_job_runs_name_window"), Index("ix_job_runs_status_started", "status", "started_at"))


class OpsEvent(IdMixin, Base):
    """An operational failure worth a human's attention (API 5xx, job failure, payment/provider/scan error).
    `detail` is sanitised by `services/monitoring.py` — never document content, OTPs, card data or secrets."""
    __tablename__ = "ops_events"
    kind: Mapped[str] = mapped_column(String(40), index=True)  # API_5XX | JOB_FAILED | PAYMENT_ERROR | DELIVERY_FAILED | SCAN_ERROR | MALWARE_DETECTED
    severity: Mapped[str] = mapped_column(String(12), default="error")
    source: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(500))
    detail: Mapped[dict | None] = mapped_column(JSON)
    alerted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class LegalHold(IdMixin, Base):
    """Blocks retention deletion/anonymisation of a user's records or of one document while active."""
    __tablename__ = "legal_holds"
    subject_type: Mapped[str] = mapped_column(String(16))  # USER | DOCUMENT
    subject_id: Mapped[uuid.UUID] = mapped_column(index=True)
    reason: Mapped[str] = mapped_column(String(500))
    placed_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL", index=False)
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
