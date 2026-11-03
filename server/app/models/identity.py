import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin, enum_col, fk
from app.models.enums import OrgType, Role


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    # Names are stored as given; no assumption about given/family order across cultures.
    preferred_name: Mapped[str | None] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(String(16), default="en")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Seoul")
    #: E.164 only (V22): `+82101234567`. Normalised server-side by `services/identity.normalize_phone`; never a
    #: display format. Verified by an SMS one-time code; changing it clears `phone_verified_at`.
    phone: Mapped[str | None] = mapped_column(String(40))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    roles: Mapped[list["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserRole(IdMixin, Base):
    """Global roles (STUDENT, HANGYUL_*). Org-scoped roles live on OrganizationMember."""
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role"),)
    user_id: Mapped[uuid.UUID] = fk("users.id")
    role: Mapped[Role] = enum_col(Role)
    user: Mapped[User] = relationship(back_populates="roles")


class Organization(IdMixin, TimestampMixin, Base):
    __tablename__ = "organizations"
    type: Mapped[OrgType] = enum_col(OrgType, index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    country_code: Mapped[str | None] = mapped_column(String(2))
    # For UNIVERSITY orgs: the catalog university this tenant administers.
    university_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("universities.id", ondelete="SET NULL"))
    is_partner: Mapped[bool] = mapped_column(Boolean, default=False)
    # Agency operating data (null for other org types)
    languages: Mapped[list[str] | None] = mapped_column(JSON)
    timezone: Mapped[str | None] = mapped_column(String(64))
    capacity_active_cases: Mapped[int | None] = mapped_column(Integer)
    sla_first_response_hours: Mapped[int | None] = mapped_column(Integer, default=24)
    license_number: Mapped[str | None] = mapped_column(String(80))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    # V9 (REPORT §59 A4/A12): editable load weights (null = defaults in services/agency_ops.LOAD_WEIGHTS) and the agency's
    # legal identity per case. Registration is NOT_RECORDED until a real registration is recorded (never inferred from
    # license_number, which seed data fills with placeholders).
    load_weights: Mapped[dict | None] = mapped_column(JSON)
    legal_name: Mapped[str | None] = mapped_column(String(200))
    registration_status: Mapped[str] = mapped_column(String(24), default="NOT_RECORDED", server_default="NOT_RECORDED")  # NOT_RECORDED | RECORDED | VERIFIED
    registration_number: Mapped[str | None] = mapped_column(String(80))
    registration_authority: Mapped[str | None] = mapped_column(String(160))
    registration_checked_on: Mapped[date | None] = mapped_column(Date)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    specialties: Mapped[list["AgencySpecialty"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class OrganizationMember(IdMixin, TimestampMixin, Base):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    user_id: Mapped[uuid.UUID] = fk("users.id")
    role: Mapped[Role] = enum_col(Role)
    title: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    languages: Mapped[list[str] | None] = mapped_column(JSON)
    # V9 team (REPORT §59 A4): per-person expertise, availability and capacity (in weighted load points).
    countries: Mapped[list[str] | None] = mapped_column(JSON)
    university_ids: Mapped[list[str] | None] = mapped_column(JSON)
    degrees: Mapped[list[str] | None] = mapped_column(JSON)
    majors: Mapped[list[str] | None] = mapped_column(JSON)
    capacity_points: Mapped[int | None] = mapped_column(Integer)
    on_leave_until: Mapped[date | None] = mapped_column(Date)
    leave_note: Mapped[str | None] = mapped_column(String(200))
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    left_reason: Mapped[str | None] = mapped_column(String(300))

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class AgencySpecialty(IdMixin, Base):
    """Configurable expertise used by the assignment engine."""
    __tablename__ = "agency_specialties"
    organization_id: Mapped[uuid.UUID] = fk("organizations.id")
    kind: Mapped[str] = mapped_column(String(32))  # COUNTRY | LANGUAGE | UNIVERSITY | DEGREE | DOCUMENT
    value: Mapped[str] = mapped_column(String(120))
    weight: Mapped[int] = mapped_column(Integer, default=1)
    organization: Mapped[Organization] = relationship(back_populates="specialties")


class RefreshToken(IdMixin, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    client: Mapped[str] = mapped_column(String(32))
    active_org_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    user_agent: Mapped[str | None] = mapped_column(String(300))
    ip: Mapped[str | None] = mapped_column(String(64))


class LoginEvent(IdMixin, Base):
    __tablename__ = "login_events"
    user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    email: Mapped[str] = mapped_column(String(255))
    success: Mapped[bool] = mapped_column(Boolean)
    reason: Mapped[str | None] = mapped_column(String(120))
    client: Mapped[str | None] = mapped_column(String(32))
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ConsentRecord(IdMixin, Base):
    __tablename__ = "consent_records"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    purpose: Mapped[str] = mapped_column(String(64))  # TERMS | PRIVACY | CROSS_BORDER_VERIFICATION | MARKETING | PURCHASE_TERMS | SHARE_WITH_AGENCY | SHARE_WITH_UNIVERSITY | …
    version: Mapped[str] = mapped_column(String(32))
    granted: Mapped[bool] = mapped_column(Boolean)
    scope_org_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # V22 evidence (REPORT §245 L2): which text, in which language, from where. Never only `granted=true`.
    locale: Mapped[str | None] = mapped_column(String(16))
    document_version: Mapped[str | None] = mapped_column(String(32))
    policy_effective_on: Mapped[date | None] = mapped_column(Date)
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    #: How the consent was captured: SIGNUP | CHECKOUT | SETTINGS | PLAN_PURCHASE | SPONSOR_LINK
    source: Mapped[str | None] = mapped_column(String(32))


class VerificationChallenge(IdMixin, Base):
    """One one-time code sent to one target for one purpose (V22, REPORT §244 R1/R2, brief §15).

    The code itself is never stored: `code_hash` is an HMAC over (challenge id, code) keyed from the server
    secret, so a copy of this table cannot be brute-forced offline. `target` is the normalised address or E.164
    number — kept so the code can be re-sent and the proof bound to the value that was actually verified; rows
    are purged by `services/verification.purge_expired` once they are a day old. Provider state is tracked in
    safe, Hangyul-owned vocabulary; the provider's own error code is kept for operations and never shown.
    """
    __tablename__ = "verification_challenges"
    user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    purpose: Mapped[str] = mapped_column(String(40), index=True)  # SIGNUP_EMAIL | SIGNUP_PHONE | CONTACT_EMAIL | CONTACT_PHONE | PASSWORD_RESET | INVITE
    channel: Mapped[str] = mapped_column(String(8))  # EMAIL | SMS
    target: Mapped[str] = mapped_column(String(255), index=True)
    target_hash: Mapped[str] = mapped_column(String(64), index=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    locale: Mapped[str] = mapped_column(String(16), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    send_count: Mapped[int] = mapped_column(Integer, default=1)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Set when the proof minted from this challenge was spent (registration committed, contact changed, password reset).
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    request_ip_hash: Mapped[str | None] = mapped_column(String(64))
    signup_session_hash: Mapped[str | None] = mapped_column(String(64))
    provider: Mapped[str | None] = mapped_column(String(24))  # sendgrid | twilio | console
    provider_message_id: Mapped[str | None] = mapped_column(String(64), index=True)
    delivery_status: Mapped[str] = mapped_column(String(16), default="QUEUED")  # QUEUED | SENT | DELIVERED | UNDELIVERED | FAILED | SKIPPED
    delivery_error_code: Mapped[str | None] = mapped_column(String(32))
    delivery_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSecurityEvent(IdMixin, Base):
    """Abuse-control events: throttles, lockouts, CAPTCHA escalations, OTP limit hits (V22, brief §73).

    Identifiers are hashed — the event is for operations and incident review, not for profiling a person.
    """
    __tablename__ = "auth_security_events"
    kind: Mapped[str] = mapped_column(String(40), index=True)
    email_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    target_hash: Mapped[str | None] = mapped_column(String(64))
    ip_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    client: Mapped[str | None] = mapped_column(String(32))
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class DataRequest(IdMixin, TimestampMixin, Base):
    """Account/data deletion and export workflow (PIPA/GDPR style)."""
    __tablename__ = "data_requests"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    kind: Mapped[str] = mapped_column(String(16))  # DELETE | EXPORT
    status: Mapped[str] = mapped_column(String(24), default="RECEIVED")  # RECEIVED | IN_REVIEW | COMPLETED | REJECTED
    note: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
