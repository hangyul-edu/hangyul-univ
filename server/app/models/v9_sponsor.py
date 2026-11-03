"""V9 sponsor view (REPORT §58 S3): a read-only, expiring, revocable link a student gives a parent or sponsor.

Only the SHA-256 of the token is stored; the token itself is shown once, at creation. Every view is recorded.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin

SPONSOR_SCOPES = ("money", "family_documents", "dates", "progress", "arrival")


class SponsorLink(IdMixin, TimestampMixin, Base):
    __tablename__ = "sponsor_links"
    student_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str | None] = mapped_column(String(80))  # e.g. "Mother" — the student's own words
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    locale: Mapped[str | None] = mapped_column(String(12))  # default reading language for the sponsor
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, default=0)


class SponsorLinkView(IdMixin, Base):
    """Audit of every sponsor view (no IP address kept; only the user agent family, truncated)."""
    __tablename__ = "sponsor_link_views"
    link_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sponsor_links.id", ondelete="CASCADE"), index=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    locale: Mapped[str | None] = mapped_column(String(12))
    user_agent: Mapped[str | None] = mapped_column(String(120))
