"""Agency operations (V3): server-backed saved views, team message templates, message attachments."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk


class SavedView(IdMixin, TimestampMixin, Base):
    """A named caseload filter. PERSONAL views belong to one user; TEAM views are shared with the whole organization."""
    __tablename__ = "saved_views"
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    owner_user_id: Mapped[uuid.UUID] = fk("users.id")
    scope: Mapped[str] = mapped_column(String(16), default="PERSONAL")  # PERSONAL | TEAM
    name: Mapped[str] = mapped_column(String(80))
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    columns: Mapped[list | None] = mapped_column(JSON)
    sort: Mapped[str | None] = mapped_column(String(24))


class MessageTemplate(IdMixin, TimestampMixin, Base):
    """Reusable message text with {{placeholders}}. PERSONAL < TEAM < ORG (org-wide, managed by owners/managers)."""
    __tablename__ = "message_templates"
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    owner_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    scope: Mapped[str] = mapped_column(String(16), default="PERSONAL")  # PERSONAL | TEAM | ORG
    kind: Mapped[str] = mapped_column(String(32), default="GENERAL")
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(12), default="en")
    # V9: language variants of one template share a group key (one per kind + purpose); inserting picks the student's locale.
    group_key: Mapped[str | None] = mapped_column(String(64), index=True)


class MessageAttachment(IdMixin, Base):
    """A private file attached to a message. Uploaded first (message_id NULL), then linked when the message is posted."""
    __tablename__ = "message_attachments"
    conversation_id: Mapped[uuid.UUID] = fk("conversations.id")
    message_id: Mapped[uuid.UUID | None] = fk("messages.id", nullable=True, ondelete="CASCADE")
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    storage_key: Mapped[str] = mapped_column(String(300), unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(16), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# Composite indexes for the caseload aggregates (declared here so autogenerate keeps them).
from sqlalchemy import Index  # noqa: E402

from app.models.workflow import Application, Document, Message, Task  # noqa: E402

Index("ix_tasks_student_status_due", Task.student_user_id, Task.status, Task.due_at)
Index("ix_documents_owner_status", Document.owner_user_id, Document.status)
Index("ix_applications_student_status", Application.student_user_id, Application.status)
Index("ix_messages_author_created", Message.author_user_id, Message.created_at)
