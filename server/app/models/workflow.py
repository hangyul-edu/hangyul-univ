"""Applications, documents, essays, tasks, messaging, notifications."""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin, enum_col, fk
from app.models.enums import (
    ApplicationStatus,
    AssignmentStatus,
    ConversationKind,
    DocumentCategory,
    DocumentStatus,
    EssayStatus,
    EssayType,
    LegalizationPath,
    LegalizationStatus,
    MessageVisibility,
    TaskPriority,
    TaskStatus,
    TaskType,
)


class AgencyAssignment(IdMixin, TimestampMixin, Base):
    __tablename__ = "agency_assignments"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    counselor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    status: Mapped[AssignmentStatus] = enum_col(AssignmentStatus, default=AssignmentStatus.ACTIVE, index=True)
    score: Mapped[float | None] = mapped_column(Float)
    score_breakdown: Mapped[list[dict] | None] = mapped_column(JSON)  # explainable factors
    assigned_by: Mapped[str] = mapped_column(String(24), default="ENGINE")  # ENGINE | OPERATIONS_OVERRIDE | STUDENT_PREFERENCE
    override_reason: Mapped[str | None] = mapped_column(String(300))
    order_id: Mapped[uuid.UUID | None] = fk("orders.id", nullable=True, ondelete="SET NULL")
    first_response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # V9 (REPORT §59 A12): a sub-agent that referred / co-handles this case (optional, as recorded by the agency).
    sub_agent_name: Mapped[str | None] = mapped_column(String(200))


class Application(IdMixin, TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("student_user_id", "intake_id"),)
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    intake_id: Mapped[uuid.UUID] = fk("program_intakes.id")
    university_id: Mapped[uuid.UUID] = fk("universities.id")  # denormalized for tenant filtering
    agency_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    status: Mapped[ApplicationStatus] = enum_col(ApplicationStatus, default=ApplicationStatus.DRAFT, index=True)
    readiness_percent: Mapped[int] = mapped_column(Integer, default=0)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_reference: Mapped[str | None] = mapped_column(String(80))  # e.g. university portal / UwayApply number
    university_reviewer_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(String(300))
    interview_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    offer_scholarship_note: Mapped[str | None] = mapped_column(String(300))
    tuition_amount_krw: Mapped[int | None] = mapped_column(Integer)
    tuition_due: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    history: Mapped[list["ApplicationStatusHistory"]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="ApplicationStatusHistory.created_at"
    )


class ApplicationStatusHistory(IdMixin, Base):
    __tablename__ = "application_status_history"
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    from_status: Mapped[ApplicationStatus | None] = enum_col(ApplicationStatus, nullable=True)
    to_status: Mapped[ApplicationStatus] = enum_col(ApplicationStatus)
    actor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    actor_org_type: Mapped[str | None] = mapped_column(String(16))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    application: Mapped[Application] = relationship(back_populates="history")


class Document(IdMixin, TimestampMixin, Base):
    """A logical document in the student's vault. Files live in DocumentVersion; reusable across applications."""
    __tablename__ = "documents"
    owner_user_id: Mapped[uuid.UUID] = fk("users.id")
    category: Mapped[DocumentCategory] = enum_col(DocumentCategory, index=True)
    title: Mapped[str] = mapped_column(String(200))
    issuing_country: Mapped[str | None] = mapped_column(String(2))
    issue_date: Mapped[date | None] = mapped_column(Date)
    expires_on: Mapped[date | None] = mapped_column(Date)
    language: Mapped[str | None] = mapped_column(String(16))
    translation_required: Mapped[bool] = mapped_column(Boolean, default=False)
    legalization_path: Mapped[LegalizationPath] = enum_col(LegalizationPath, default=LegalizationPath.NONE)
    legalization_status: Mapped[LegalizationStatus] = enum_col(LegalizationStatus, default=LegalizationStatus.NOT_REQUIRED)
    legalization_progress: Mapped[list[str] | None] = mapped_column(JSON)  # completed step keys
    status: Mapped[DocumentStatus] = enum_col(DocumentStatus, default=DocumentStatus.UPLOADED, index=True)
    reviewer_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    reusable: Mapped[bool] = mapped_column(Boolean, default=True)
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentVersion.version"
    )


class DocumentVersion(IdMixin, Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version"),)
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    version: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(300))  # private object key; never a public URL
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(16), default="PENDING")  # PENDING | CLEAN | INFECTED | SKIPPED
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    document: Mapped[Document] = relationship(back_populates="versions")


class ApplicationDocument(IdMixin, Base):
    """Links a vault document to an application requirement (document reuse across universities)."""
    __tablename__ = "application_documents"
    __table_args__ = (UniqueConstraint("application_id", "requirement_id"),)
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    requirement_id: Mapped[uuid.UUID] = fk("document_requirements.id")
    document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    shared_with_university: Mapped[bool] = mapped_column(Boolean, default=False)


class DocumentReview(IdMixin, Base):
    __tablename__ = "document_reviews"
    document_id: Mapped[uuid.UUID] = fk("documents.id")
    version: Mapped[int] = mapped_column(Integer)
    reviewer_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    reviewer_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    decision: Mapped[str] = mapped_column(String(24))  # VERIFIED | NEEDS_CORRECTION | AI_PRECHECK
    reason: Mapped[str | None] = mapped_column(Text)
    checks: Mapped[list[dict] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Essay(IdMixin, TimestampMixin, Base):
    __tablename__ = "essays"
    owner_user_id: Mapped[uuid.UUID] = fk("users.id")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True, ondelete="SET NULL")
    essay_type: Mapped[EssayType] = enum_col(EssayType)
    title: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str | None] = mapped_column(Text)
    word_limit: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[EssayStatus] = enum_col(EssayStatus, default=EssayStatus.DRAFT, index=True)
    reviewer_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    due_date: Mapped[date | None] = mapped_column(Date)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    precheck: Mapped[list[dict] | None] = mapped_column(JSON)

    versions: Mapped[list["EssayVersion"]] = relationship(
        back_populates="essay", cascade="all, delete-orphan", order_by="EssayVersion.version"
    )
    comments: Mapped[list["EssayComment"]] = relationship(back_populates="essay", cascade="all, delete-orphan")


class EssayVersion(IdMixin, Base):
    __tablename__ = "essay_versions"
    __table_args__ = (UniqueConstraint("essay_id", "version"),)
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    version: Mapped[int] = mapped_column(Integer)
    body: Mapped[str] = mapped_column(Text)
    author_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    note: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    essay: Mapped[Essay] = relationship(back_populates="versions")


class EssayComment(IdMixin, Base):
    __tablename__ = "essay_comments"
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    version: Mapped[int] = mapped_column(Integer)
    author_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    anchor_start: Mapped[int | None] = mapped_column(Integer)
    anchor_end: Mapped[int | None] = mapped_column(Integer)
    quote: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str | None] = mapped_column(Text)  # proposed replacement text for the quoted span
    visibility: Mapped[MessageVisibility] = enum_col(MessageVisibility, default=MessageVisibility.PARTICIPANTS)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    essay: Mapped[Essay] = relationship(back_populates="comments")


class Task(IdMixin, TimestampMixin, Base):
    __tablename__ = "tasks"
    title: Mapped[str] = mapped_column(String(300))
    # i18n: engine tasks carry a translation key + params; `title` is the English fallback.
    title_key: Mapped[str | None] = mapped_column(String(120))
    title_params: Mapped[dict | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)
    task_type: Mapped[TaskType] = enum_col(TaskType, index=True)
    priority: Mapped[TaskPriority] = enum_col(TaskPriority, default=TaskPriority.MEDIUM)
    status: Mapped[TaskStatus] = enum_col(TaskStatus, default=TaskStatus.OPEN, index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    # Owner is either a user or an org queue (e.g. an agency's document-review queue).
    owner_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    owner_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    student_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True)
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True)
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    depends_on_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(32), default="MANUAL")  # MANUAL | ENGINE | MESSAGE | UNIVERSITY
    dedupe_key: Mapped[str | None] = mapped_column(String(200), unique=True)  # makes engine generation idempotent
    link: Mapped[str | None] = mapped_column(String(300))  # deep link within the relevant app
    reminder_offsets_hours: Mapped[list[int] | None] = mapped_column(JSON)
    visible_to_student: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")


class Conversation(IdMixin, TimestampMixin, Base):
    __tablename__ = "conversations"
    kind: Mapped[ConversationKind] = enum_col(ConversationKind)
    subject: Mapped[str] = mapped_column(String(200))
    student_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True)
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    participants: Mapped[list["ConversationParticipant"]] = relationship(cascade="all, delete-orphan")


class ConversationParticipant(IdMixin, Base):
    """Either a specific user or a whole organization (all active members may read)."""
    __tablename__ = "conversation_participants"
    conversation_id: Mapped[uuid.UUID] = fk("conversations.id")
    user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True)
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)


class Message(IdMixin, Base):
    __tablename__ = "messages"
    conversation_id: Mapped[uuid.UUID] = fk("conversations.id")
    author_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    body: Mapped[str] = mapped_column(Text)
    visibility: Mapped[MessageVisibility] = enum_col(MessageVisibility, default=MessageVisibility.PARTICIPANTS)
    mentions: Mapped[list[str] | None] = mapped_column(JSON)  # user ids
    attachment_document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    # Delivery channel. Only IN_APP is live; EMAIL / KAKAO / WHATSAPP / SMS are reserved for future connectors (not integrated).
    channel: Mapped[str] = mapped_column(String(16), default="IN_APP", server_default="IN_APP")
    created_task_id: Mapped[uuid.UUID | None] = fk("tasks.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class MessageRead(IdMixin, Base):
    __tablename__ = "message_reads"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)
    conversation_id: Mapped[uuid.UUID] = fk("conversations.id")
    user_id: Mapped[uuid.UUID] = fk("users.id")
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Notification(IdMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(48))
    # i18n: title_key + params let each client render in the user's locale (multilingual notifications).
    title_key: Mapped[str] = mapped_column(String(120))
    params: Mapped[dict | None] = mapped_column(JSON)
    fallback_text: Mapped[str] = mapped_column(String(400))
    link: Mapped[str | None] = mapped_column(String(300))
    channel: Mapped[str] = mapped_column(String(16), default="IN_APP")  # IN_APP | EMAIL | PUSH | SMS (adapters)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
