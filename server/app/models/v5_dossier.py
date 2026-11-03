"""V5 — universal dossier models (owned by the dossier workstream). See docs/DOCUMENT_AUTOMATION.md.

* ``DocumentAnalysis`` — what the automatic check could compute for ONE file version (page count, text length, image
  size, detected document type). Computed once per version; never stores the document text itself.
* ``DocumentFinding`` — one plain-language problem found on a document (expired, too old for a university, name does
  not match the profile…). Recomputed automatically; staff can resolve or dismiss it, which sticks for that version.
* ``ExtractedField`` — a value read from a document (e.g. passport expiry from the passport's machine-readable zone),
  stored as a SUGGESTION. It is written to the profile only when a person explicitly confirms it.
* ``DossierDocumentState`` — per-document dossier facts that have no home on ``Document`` (translation status set by
  staff).
* ``DossierReuseEvent`` — a recorded reuse decision (a university request answered with an existing document, an
  upload avoided because the student kept the verified copy, a new version instead of a duplicate). Feeds the
  "duplicate uploads avoided" metric.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = ["DocumentAnalysis", "DocumentFinding", "ExtractedField", "DossierDocumentState", "DossierReuseEvent"]


class DocumentAnalysis(IdMixin, TimestampMixin, Base):
    __tablename__ = "document_analyses"
    __table_args__ = (UniqueConstraint("document_id", "version"),)
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    version: Mapped[int] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    page_count: Mapped[int | None] = mapped_column(Integer)
    text_chars: Mapped[int | None] = mapped_column(Integer)  # characters of machine-readable text (0 = scanned image / no text layer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    detected_category: Mapped[str | None] = mapped_column(String(48))
    has_mrz: Mapped[bool] = mapped_column(Boolean, default=False)
    # File-based findings computed at analysis time ({code, severity, params}); merged with metadata findings on refresh.
    file_findings: Mapped[list[dict] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(String(200))
    method: Mapped[str] = mapped_column(String(24), default="RULES")  # RULES (automatic check) — no OCR, no AI
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class DocumentFinding(IdMixin, TimestampMixin, Base):
    __tablename__ = "document_findings"
    __table_args__ = (UniqueConstraint("document_id", "code", "version"),)
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    version: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[str] = mapped_column(String(12))  # BLOCKER | WARNING | INFO
    params: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(12), default="OPEN", index=True)  # OPEN | RESOLVED | DISMISSED
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")  # null + RESOLVED = no longer applies
    note: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class ExtractedField(IdMixin, TimestampMixin, Base):
    __tablename__ = "extracted_fields"
    __table_args__ = (UniqueConstraint("document_id", "version", "field"),)
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    version: Mapped[int] = mapped_column(Integer)
    field: Mapped[str] = mapped_column(String(32))  # full_name | date_of_birth | passport_number | passport_expiry | school | graduation_date | gpa | test_score | issue_date | expiry_date | document_number
    value: Mapped[str] = mapped_column(String(200))  # passport / document numbers are stored masked
    confidence: Mapped[str] = mapped_column(String(8))  # low | medium | high (rule-based)
    source: Mapped[str] = mapped_column(String(12))  # text | mrz | filename
    status: Mapped[str] = mapped_column(String(12), default="SUGGESTED", index=True)  # SUGGESTED | CONFIRMED | REJECTED
    confirmed_value: Mapped[str | None] = mapped_column(String(200))  # what the person confirmed (may be edited)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    applied: Mapped[list[str] | None] = mapped_column(JSON)  # which profile/document fields the confirmation updated
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class DossierDocumentState(IdMixin, TimestampMixin, Base):
    __tablename__ = "dossier_document_states"
    __table_args__ = (UniqueConstraint("document_id"),)
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    translation_status: Mapped[str | None] = mapped_column(String(12))  # PROVIDED | NEEDED (null = derived)
    updated_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")


class DossierReuseEvent(IdMixin, TimestampMixin, Base):
    __tablename__ = "dossier_reuse_events"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    request_id: Mapped[uuid.UUID | None] = fk("document_requests.id", nullable=True, ondelete="SET NULL")
    category: Mapped[str | None] = mapped_column(String(48))
    # SENT_EXISTING (request answered with a document already in the dossier) | KEPT_EXISTING (upload avoided)
    # | NEW_VERSION (replaced in place, no duplicate) | NEW_DOCUMENT (a legitimately different copy)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
