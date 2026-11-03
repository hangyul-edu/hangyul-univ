import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, enum_col, fk
from app.models.enums import LegalizationPath, SourceType, VerificationStatus


class Country(Base):
    __tablename__ = "countries"
    code: Mapped[str] = mapped_column(String(2), primary_key=True)  # ISO 3166-1 alpha-2
    name_en: Mapped[str] = mapped_column(String(120))
    name_native: Mapped[str | None] = mapped_column(String(120))
    name_ko: Mapped[str | None] = mapped_column(String(120))
    region: Mapped[str] = mapped_column(String(40))
    default_locale: Mapped[str] = mapped_column(String(16))
    currency: Mapped[str] = mapped_column(String(3))
    is_priority_market: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_rank: Mapped[int | None] = mapped_column(Integer)
    # Hague Apostille Convention: time-versioned. Party from `apostille_effective_from` (entry into force for that
    # state). apostille_member=None means unknown / not yet verified. A future effective date = consular route until then.
    apostille_member: Mapped[bool | None] = mapped_column(Boolean)
    apostille_effective_from: Mapped[date | None] = mapped_column(Date)
    apostille_source_url: Mapped[str | None] = mapped_column(String(500))
    apostille_verified_at: Mapped[date | None] = mapped_column(Date)
    aliases: Mapped[list[str] | None] = mapped_column(JSON)  # for search: "Burma", "Viet Nam"...


class Locale(Base):
    __tablename__ = "locales"
    code: Mapped[str] = mapped_column(String(16), primary_key=True)  # BCP-47, e.g. "zh-Hans"
    name_en: Mapped[str] = mapped_column(String(80))
    name_native: Mapped[str] = mapped_column(String(80))
    direction: Mapped[str] = mapped_column(String(3), default="ltr")
    translation_status: Mapped[str] = mapped_column(String(24), default="MACHINE_DRAFT")  # SOURCE_APPROVED | HUMAN_REVIEWED | SYNTHETIC_REVIEWED | MACHINE_DRAFT (V8 taxonomy, docs/I18N.md)


class Source(IdMixin, TimestampMixin, Base):
    """Registry of every external/internal source behind time-sensitive facts."""
    __tablename__ = "sources"
    key: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(1000))
    source_type: Mapped[SourceType] = enum_col(SourceType)
    topic: Mapped[str | None] = mapped_column(String(120))
    summary: Mapped[str | None] = mapped_column(Text)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_interval_days: Mapped[int] = mapped_column(Integer, default=180)
    status: Mapped[VerificationStatus] = enum_col(VerificationStatus, default=VerificationStatus.CURRENT)
    reviewer_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    ingestion_method: Mapped[str] = mapped_column(String(24), default="MANUAL")  # MANUAL | OFFICIAL_API | PUBLIC_DATA | PARTNER_FEED
    terms_note: Mapped[str | None] = mapped_column(Text)


class SourceSnapshot(IdMixin, Base):
    """A captured fingerprint of a source at check time; a changed hash moves records to CHANGED."""
    __tablename__ = "source_snapshots"
    source_id: Mapped[uuid.UUID] = fk("sources.id")
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    content_hash: Mapped[str | None] = mapped_column(String(128))
    http_status: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text)
    checked_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")


class FreshnessReview(IdMixin, TimestampMixin, Base):
    """Review queue item for stale or changed information."""
    __tablename__ = "freshness_reviews"
    entity_type: Mapped[str] = mapped_column(String(48))  # e.g. "program_intake", "scholarship", "source"
    entity_id: Mapped[str] = mapped_column(String(64))
    entity_label: Mapped[str] = mapped_column(String(300))
    reason: Mapped[VerificationStatus] = enum_col(VerificationStatus)
    detail: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[uuid.UUID | None] = fk("sources.id", nullable=True, ondelete="SET NULL")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    resolution: Mapped[str | None] = mapped_column(String(24))  # CONFIRMED | UPDATED | ARCHIVED


class LegalizationRule(IdMixin, TimestampMixin, Base):
    """Data-driven apostille/legalization path. Most specific matching rule wins:
    (issuing_country + document_category + university) > (country + category) > (country) > default."""
    __tablename__ = "legalization_rules"
    issuing_country: Mapped[str | None] = mapped_column(String(2), index=True)
    document_category: Mapped[str | None] = mapped_column(String(48))
    university_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    consulate_note: Mapped[str | None] = mapped_column(Text)
    path: Mapped[LegalizationPath] = enum_col(LegalizationPath)
    requires_notarization: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_translation: Mapped[bool] = mapped_column(Boolean, default=True)  # when not Korean/English
    steps: Mapped[list[dict]] = mapped_column(JSON)  # [{key,title,detail}] human-readable checklist
    source_id: Mapped[uuid.UUID | None] = fk("sources.id", nullable=True, ondelete="SET NULL")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_status: Mapped[VerificationStatus] = enum_col(VerificationStatus, default=VerificationStatus.REVIEW_DUE)
