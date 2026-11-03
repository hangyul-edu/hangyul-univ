"""V5 — writing review models (owned by the writing workstream; see docs/WRITING_REVIEW.md).

The essay itself (text, versions, comments, status) stays in ``workflow.py`` (Essay / EssayVersion / EssayComment).
Everything the professional review workflow adds lives here, keyed by essay:

- WritingPrompt   — the university's question, versioned per university / program / intake, with source + verification.
- ReviewRubric    — the dimensions a reviewer assesses (Hangyul default or an organisation's own).
- RubricScore     — one categorical rating per dimension per essay (Meets / Needs work / Not assessed) + note.
- EssayReview     — 1:1 review state of an essay: prompt used, round, SLA, reviewer assignment, approved version.
- WritingFinding  — automatic-check and fact-check findings (never edits the text), resolvable / dismissible.
- ReviewerProfile — reviewer expertise + capacity used by reviewer matching.
- WritingPolicy   — review-time targets (first / revision / final review hours), Hangyul default or per organisation.
- WritingEvent    — review timeline (submitted, reviewed, approved, overdue, escalated, reassigned) for SLA + metrics.
- WritingOutcome  — internal link from the approved essay version + review metrics to the application decision.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk

__all__ = [
    "WritingPrompt",
    "ReviewRubric",
    "RubricScore",
    "EssayReview",
    "WritingFinding",
    "ReviewerProfile",
    "WritingPolicy",
    "WritingEvent",
    "WritingOutcome",
]


class WritingPrompt(IdMixin, TimestampMixin, Base):
    """A university's essay question. Prompts change by intake, so every wording is a version.

    Applicability: ``intake_year``/``intake_term`` set → exactly that intake; otherwise the prompt applies from
    ``effective_from_year``/``effective_from_term`` (or always, when unset) until a later version takes over.
    ``superseded_by_id`` points at the version that replaced this one for later intakes.
    ``verification_status``: SAMPLE (demo wording written by Hangyul — never the official text) · COUNSELOR_ENTERED
    (typed in by a reviewer, not yet checked against the source) · VERIFIED (checked against ``source_url`` on ``verified_at``).
    """
    __tablename__ = "writing_prompts"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True)
    # Organisation that entered the prompt (NULL = Hangyul catalogue, visible to every reviewer).
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    essay_type: Mapped[str] = mapped_column(String(32), index=True)
    intake_year: Mapped[int | None] = mapped_column(Integer)
    intake_term: Mapped[str | None] = mapped_column(String(16))
    effective_from_year: Mapped[int | None] = mapped_column(Integer)
    effective_from_term: Mapped[str | None] = mapped_column(String(16))
    prompt_text: Mapped[str] = mapped_column(Text)
    prompt_language: Mapped[str] = mapped_column(String(8), default="en")
    word_limit: Mapped[int | None] = mapped_column(Integer)
    char_limit: Mapped[int | None] = mapped_column(Integer)
    required_language: Mapped[str | None] = mapped_column(String(8))  # language the essay must be written in
    source_url: Mapped[str | None] = mapped_column(String(1000))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_status: Mapped[str] = mapped_column(String(24), default="SAMPLE")
    version: Mapped[int] = mapped_column(Integer, default=1)
    superseded_by_id: Mapped[uuid.UUID | None] = fk("writing_prompts.id", nullable=True, ondelete="SET NULL")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    note: Mapped[str | None] = mapped_column(String(500))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class ReviewRubric(IdMixin, TimestampMixin, Base):
    """Rubric = ordered list of dimension keys (labels are i18n keys ``writing:dim.<key>``; custom dimensions carry a label)."""
    __tablename__ = "review_rubrics"
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)  # NULL = Hangyul default
    name: Mapped[str] = mapped_column(String(120))
    dimensions: Mapped[list[dict]] = mapped_column(JSON)  # [{"key": "ANSWERS_PROMPT", "label": null, "gate": "PROMPT_ANSWERED"}]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class RubricScore(IdMixin, TimestampMixin, Base):
    __tablename__ = "rubric_scores"
    __table_args__ = (UniqueConstraint("essay_id", "dimension"),)
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    dimension: Mapped[str] = mapped_column(String(48))
    rating: Mapped[str] = mapped_column(String(16), default="NOT_ASSESSED")  # MEETS | NEEDS_WORK | NOT_ASSESSED
    note: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int | None] = mapped_column(Integer)  # essay version the rating was given on
    reviewer_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")


class EssayReview(IdMixin, TimestampMixin, Base):
    __tablename__ = "essay_reviews"
    __table_args__ = (UniqueConstraint("essay_id"),)
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    prompt_id: Mapped[uuid.UUID | None] = fk("writing_prompts.id", nullable=True, ondelete="SET NULL")
    rubric_id: Mapped[uuid.UUID | None] = fk("review_rubrics.id", nullable=True, ondelete="SET NULL")
    review_round: Mapped[int] = mapped_column(Integer, default=0)  # 1 = first review, 2+ = revisions
    first_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # current round
    expected_review_by: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    overdue_flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    escalated_to_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    sla_breaches: Mapped[int] = mapped_column(Integer, default=0)
    reviewer_assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_by: Mapped[str | None] = mapped_column(String(24))  # ENGINE | OVERRIDE | COUNSELOR_DEFAULT
    assignment_reasons: Mapped[list[dict] | None] = mapped_column(JSON)
    override_reason: Mapped[str | None] = mapped_column(String(500))
    approved_version: Mapped[int | None] = mapped_column(Integer)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    approval_override_reason: Mapped[str | None] = mapped_column(String(1000))
    approval_override_blockers: Mapped[list[str] | None] = mapped_column(JSON)
    checks_version: Mapped[int | None] = mapped_column(Integer)  # essay version the automatic checks last ran on
    checks_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checks_provider: Mapped[str | None] = mapped_column(String(24))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class WritingFinding(IdMixin, Base):
    """One automatic-check finding. ``kind`` groups it (LIMIT, PROMPT, REPETITION, GENERIC, OTHER_UNIVERSITY, NAME,
    SIMILARITY, FACT, CLARITY); ``code`` + ``params`` render it through i18n (``writing:finding.<code>``); ``text`` is the
    English fallback. ``fingerprint`` keeps a dismissal stable across re-runs. Findings never change the essay text."""
    __tablename__ = "writing_findings"
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    version: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(24), index=True)
    code: Mapped[str] = mapped_column(String(48))
    severity: Mapped[str] = mapped_column(String(16))  # BLOCKER | WARNING | INFO
    params: Mapped[dict | None] = mapped_column(JSON)
    text: Mapped[str] = mapped_column(Text)
    quote: Mapped[str | None] = mapped_column(Text)
    anchor_start: Mapped[int | None] = mapped_column(Integer)
    anchor_end: Mapped[int | None] = mapped_column(Integer)
    staff_only: Mapped[bool] = mapped_column(Boolean, default=False)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="OPEN")  # OPEN | RESOLVED | DISMISSED
    resolved_note: Mapped[str | None] = mapped_column(String(1000))
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReviewerProfile(IdMixin, TimestampMixin, Base):
    __tablename__ = "reviewer_profiles"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    languages: Mapped[list[str] | None] = mapped_column(JSON)  # ISO 639-1
    degrees: Mapped[list[str] | None] = mapped_column(JSON)  # DegreeLevel values
    fields: Mapped[list[str] | None] = mapped_column(JSON)  # field taxonomy keys
    university_ids: Mapped[list[str] | None] = mapped_column(JSON)
    countries: Mapped[list[str] | None] = mapped_column(JSON)  # ISO 3166 alpha-2 (student nationality context)
    capacity: Mapped[int] = mapped_column(Integer, default=12)  # max open reviews
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class WritingPolicy(IdMixin, TimestampMixin, Base):
    __tablename__ = "writing_policies"
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)  # NULL = Hangyul default
    first_review_hours: Mapped[int] = mapped_column(Integer, default=48)
    revision_review_hours: Mapped[int] = mapped_column(Integer, default=48)
    final_review_hours: Mapped[int] = mapped_column(Integer, default=24)


class WritingEvent(IdMixin, Base):
    __tablename__ = "writing_events"
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    kind: Mapped[str] = mapped_column(String(24), index=True)  # SUBMITTED | REVIEWED | FINAL | APPROVED | OVERDUE | ESCALATED | ASSIGNED | REASSIGNED
    round: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int | None] = mapped_column(Integer)
    actor_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detail: Mapped[dict | None] = mapped_column(JSON)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class WritingOutcome(IdMixin, TimestampMixin, Base):
    """Internal analytics only. Never shown to students; groups with n < 5 are withheld; no causal claims."""
    __tablename__ = "writing_outcomes"
    __table_args__ = (UniqueConstraint("essay_id", "application_id"),)
    essay_id: Mapped[uuid.UUID] = fk("essays.id")
    application_id: Mapped[uuid.UUID] = fk("applications.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True, ondelete="SET NULL")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True, ondelete="SET NULL")
    essay_type: Mapped[str] = mapped_column(String(32))
    intake_year: Mapped[int | None] = mapped_column(Integer)
    approved_version: Mapped[int | None] = mapped_column(Integer)
    decision: Mapped[str] = mapped_column(String(16))  # OFFERED | REJECTED | WAITLISTED
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_rounds: Mapped[int] = mapped_column(Integer, default=0)
    first_turnaround_hours: Mapped[float | None] = mapped_column(Float)
    sla_breaches: Mapped[int] = mapped_column(Integer, default=0)
    rubric_meets: Mapped[int] = mapped_column(Integer, default=0)
    rubric_needs_work: Mapped[int] = mapped_column(Integer, default=0)
    override_used: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
