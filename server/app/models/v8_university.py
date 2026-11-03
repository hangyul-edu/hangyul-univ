"""V8 university console: administrative check (a lightweight, audited per-application flag) and saved export configurations."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = ["ApplicationAdminCheck", "ExportPreset"]


class ApplicationAdminCheck(IdMixin, TimestampMixin, Base):
    """"Administrative check complete" — the admissions office confirmed the file is administratively in order (fee,
    identity, forms). It is NOT a decision and never changes the application status; one row per application, audited."""
    __tablename__ = "application_admin_checks"
    __table_args__ = (UniqueConstraint("application_id"),)
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    checked_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)


class ExportPreset(IdMixin, TimestampMixin, Base):
    """A saved export configuration (columns + filters) for one university. Runs manually; scheduled delivery needs a
    scheduled-jobs worker that does not exist yet (`schedule` stays MANUAL)."""
    __tablename__ = "export_presets"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    name: Mapped[str] = mapped_column(String(120))
    base: Mapped[str] = mapped_column(String(40))  # one of the export job presets (current_intake, admitted, visa, enrolment, outcomes)
    columns: Mapped[list] = mapped_column(JSON, default=list)
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    schedule: Mapped[str] = mapped_column(String(24), default="MANUAL")
