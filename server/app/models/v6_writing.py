"""V6 — writing review additions (owned by the writing workstream; see docs/WRITING_REVIEW.md §V6).

- EssaySuggestionDecision — the student's decision on a reviewer's suggested wording (ACCEPTED / REJECTED), so the
  reviewer sees what happened to each suggestion. Accepting creates a new student-authored version; nothing is applied
  without the student.
- EssayAttestation — the student's authorship statement ("These are my own words and facts") recorded with the exact
  version it covers (text hash + statement code + locale + time).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, fk

__all__ = ["EssaySuggestionDecision", "EssayAttestation"]


class EssaySuggestionDecision(IdMixin, Base):
    __tablename__ = "essay_suggestion_decisions"
    __table_args__ = (UniqueConstraint("comment_id"),)
    comment_id: Mapped[uuid.UUID] = fk("essay_comments.id", ondelete="CASCADE")
    essay_id: Mapped[uuid.UUID] = fk("essays.id", ondelete="CASCADE")
    state: Mapped[str] = mapped_column(String(16))  # ACCEPTED | REJECTED
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)  # optional reason the student gives for declining
    version_created: Mapped[int | None] = mapped_column(Integer)  # the version an acceptance created


class EssayAttestation(IdMixin, Base):
    __tablename__ = "essay_attestations"
    __table_args__ = (UniqueConstraint("essay_id", "version"),)
    essay_id: Mapped[uuid.UUID] = fk("essays.id", ondelete="CASCADE")
    version: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[uuid.UUID] = fk("users.id", ondelete="CASCADE")
    statement_code: Mapped[str] = mapped_column(String(40))  # OWN_WORDS_AND_FACTS_V1
    statement_text: Mapped[str] = mapped_column(Text)  # English text of the statement as shown
    locale: Mapped[str | None] = mapped_column(String(10))
    body_sha256: Mapped[str] = mapped_column(String(64))
    attested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
