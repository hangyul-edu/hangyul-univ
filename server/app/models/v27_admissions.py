"""V27 — verified admission rules (REPORT §356–§357).

Two tables, both loaded only from the research evidence in ``app/data/research/v27/`` (never from a guess):

``AdmissionLanguageRule``  which language qualifications an institution's **current** official rule accepts for one
                           study level and track, and the minimum it names. Rules sharing a ``group_key`` are
                           alternatives (any one satisfies the group); different groups must all be satisfied.
                           A test that no rule names is simply not accepted there — TOEIC, Duolingo, PTE and
                           Cambridge are never assumed.
``AdmissionGuide``         one official international-admission guide (모집요강) for one university × intake ×
                           study level × applicant type. Its ``document_requirements`` rows (``guide_id``) are the
                           **only** rows a student's checklist is built from. No VERIFIED guide → no checklist and
                           the application is ``ADMISSION_GUIDE_REVIEW_REQUIRED`` (``services/guides.py``).
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import JSON, Date, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, SourcedMixin, TimestampMixin, fk

#: Korean and English qualifications the registry can represent. ``OTHER`` needs a note naming the test.
LANGUAGE_TESTS = (
    "TOPIK", "TOPIK_IBT", "KIIP", "KING_SEJONG", "UNIV_KLI",
    "TOEFL_IBT", "IELTS_ACADEMIC", "TEPS", "NEW_TEPS", "TOEIC", "DUOLINGO", "CAMBRIDGE", "PTE", "OTHER",
)
KOREAN_TESTS = frozenset({"TOPIK", "TOPIK_IBT", "KIIP", "KING_SEJONG", "UNIV_KLI"})
TRACKS = ("KOREAN", "ENGLISH", "ANY")
#: VERIFIED = read from the current official guide · STALE = the latest guide found is for an earlier round ·
#: REVIEW_REQUIRED = no usable guide yet · CONFLICT = official sources disagree, a person must decide.
GUIDE_STATUSES = ("VERIFIED", "STALE", "REVIEW_REQUIRED", "CONFLICT")


class AdmissionLanguageRule(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "admission_language_rules"

    institution_id: Mapped[uuid.UUID] = fk("institutions.id")
    degree_level: Mapped[str] = mapped_column(String(16), index=True)
    track: Mapped[str] = mapped_column(String(12), default="ANY")
    group_key: Mapped[str] = mapped_column(String(8), default="A")
    test: Mapped[str] = mapped_column(String(24))
    #: Numeric minimum where the test has a numeric scale; ``min_text`` keeps the source's own wording.
    min_value: Mapped[float | None] = mapped_column(Float)
    min_text: Mapped[str | None] = mapped_column(String(80))
    #: APPLICATION (needed to apply) · GRADUATION (needed before graduating, not to apply).
    stage: Mapped[str] = mapped_column(String(16), default="APPLICATION")
    note: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str | None] = mapped_column(String(300))


class AdmissionGuide(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "admission_guides"

    institution_id: Mapped[uuid.UUID] = fk("institutions.id")
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True, ondelete="SET NULL")
    intake_year: Mapped[int] = mapped_column(Integer)
    term: Mapped[str] = mapped_column(String(8))
    degree_level: Mapped[str] = mapped_column(String(16), index=True)
    applicant_type: Mapped[str] = mapped_column(String(16), default="FRESHMAN")
    track: Mapped[str | None] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(24), default="REVIEW_REQUIRED", index=True)
    title: Mapped[str | None] = mapped_column(String(300))
    source_document: Mapped[str | None] = mapped_column(String(300))
    source_page_url: Mapped[str | None] = mapped_column(String(1000))
    publication_date: Mapped[date | None] = mapped_column(Date)
    application_opens: Mapped[date | None] = mapped_column(Date)
    application_closes: Mapped[date | None] = mapped_column(Date)
    document_deadline: Mapped[date | None] = mapped_column(Date)
    submission_channel: Mapped[str | None] = mapped_column(Text)
    reviewer_note: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[list | None] = mapped_column(JSON)
    conflicts: Mapped[list | None] = mapped_column(JSON)
    language_rules: Mapped[list | None] = mapped_column(JSON)
