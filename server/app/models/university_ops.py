"""University operations (V3): document requests, export jobs and single sign-on configuration."""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk


class DocumentRequest(IdMixin, TimestampMixin, Base):
    """A university asks the student for one more document. The exact note is preserved and shown to the student."""
    __tablename__ = "document_requests"
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    label: Mapped[str] = mapped_column(String(200))
    note: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(48))  # DocumentCategory value when known
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="OPEN", index=True)  # OPEN | FULFILLED | CANCELLED
    requested_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    requested_by_org_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fulfilled_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    document_id: Mapped[uuid.UUID | None] = fk("documents.id", nullable=True, ondelete="SET NULL")
    task_id: Mapped[uuid.UUID | None] = fk("tasks.id", nullable=True, ondelete="SET NULL")
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExportJob(IdMixin, TimestampMixin, Base):
    """A report export. V3 runs MANUAL exports only; `schedule` and `delivery` exist so scheduled/e-mail/SFTP delivery
    can be added without a schema change, but the API rejects anything other than MANUAL until implemented."""
    __tablename__ = "export_jobs"
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True)
    requested_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    kind: Mapped[str] = mapped_column(String(32))  # APPLICATIONS | COHORTS | METRICS
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    schedule: Mapped[str] = mapped_column(String(24), default="MANUAL")  # MANUAL (only value accepted today)
    delivery: Mapped[str] = mapped_column(String(24), default="DOWNLOAD")  # DOWNLOAD (only value accepted today)
    status: Mapped[str] = mapped_column(String(16), default="COMPLETED")
    row_count: Mapped[int | None] = mapped_column()
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OrgSSOConfig(IdMixin, TimestampMixin, Base):
    """Single sign-on for one organization. Secrets are never stored here — only the NAME of the environment variable
    or secret-manager entry that holds the client secret (`client_secret_ref`)."""
    __tablename__ = "org_sso_configs"
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    protocol: Mapped[str] = mapped_column(String(8), default="OIDC")  # OIDC | SAML
    issuer: Mapped[str] = mapped_column(String(500))
    client_id: Mapped[str | None] = mapped_column(String(300))
    client_secret_ref: Mapped[str | None] = mapped_column(String(120))
    allowed_domains: Mapped[list[str]] = mapped_column(JSON, default=list)
    default_role: Mapped[str] = mapped_column(String(48))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    enforce: Mapped[bool] = mapped_column(Boolean, default=False)  # when true, password sign-in is refused for these domains
    saml_metadata_url: Mapped[str | None] = mapped_column(String(500))


class SSOLoginState(IdMixin, Base):
    """Short-lived server-side record of an in-flight OIDC login (state, nonce, PKCE verifier)."""
    __tablename__ = "sso_login_states"
    config_id: Mapped[uuid.UUID] = fk("org_sso_configs.id")
    state: Mapped[str] = mapped_column(String(128), unique=True)
    nonce: Mapped[str] = mapped_column(String(128))
    code_verifier: Mapped[str] = mapped_column(String(128))
    client: Mapped[str] = mapped_column(String(16))
    redirect_uri: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)


class RequirementChange(IdMixin, TimestampMixin, Base):
    """A proposed change to a program's published admission rules. Admissions staff propose; an admin publishes.
    Published rules are stamped CURRENT (first-party data) with who published them and when."""
    __tablename__ = "requirement_changes"
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    previous: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="PENDING", index=True)  # PENDING | PUBLISHED | DISCARDED
    proposed_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    reviewed_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
