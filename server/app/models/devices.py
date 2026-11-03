from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk


class PushToken(IdMixin, TimestampMixin, Base):
    """A device registered for push notifications. Delivery goes through a provider adapter (Expo push service);
    in-app notifications remain the source of truth, so a failed push never loses information."""
    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("token", name="uq_push_tokens_token"),)
    user_id: Mapped[uuid.UUID] = fk("users.id")
    token: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(16))  # ios | android
    app: Mapped[str] = mapped_column(String(16), default="student")  # student | agency | university
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
