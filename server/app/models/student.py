import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin, enum_col, fk
from app.models.enums import DegreeLevel, IntakeTerm, LanguageTest, PipelineStage


class StudentProfile(IdMixin, TimestampMixin, Base):
    __tablename__ = "student_profiles"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    nationality: Mapped[str | None] = mapped_column(String(2), index=True)
    residence_country: Mapped[str | None] = mapped_column(String(2))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(24))
    passport_number_masked: Mapped[str | None] = mapped_column(String(32))  # only last 3 chars kept in clear
    passport_expiry: Mapped[date | None] = mapped_column(Date)
    has_passport: Mapped[bool | None] = mapped_column(Boolean)
    target_degree: Mapped[DegreeLevel | None] = enum_col(DegreeLevel, nullable=True)
    target_intake_year: Mapped[int | None] = mapped_column(Integer)
    target_intake_term: Mapped[IntakeTerm | None] = enum_col(IntakeTerm, nullable=True)
    desired_fields: Mapped[list[str] | None] = mapped_column(JSON)
    preferred_regions: Mapped[list[str] | None] = mapped_column(JSON)
    preferred_university_ids: Mapped[list[str] | None] = mapped_column(JSON)
    annual_budget_krw: Mapped[int | None] = mapped_column(Integer)
    needs_scholarship: Mapped[bool | None] = mapped_column(Boolean)
    housing_preference: Mapped[str | None] = mapped_column(String(24))  # DORM | OFF_CAMPUS | NO_PREFERENCE
    korean_self_level: Mapped[str | None] = mapped_column(String(24))  # NONE | BEGINNER | INTERMEDIATE | ADVANCED
    english_self_level: Mapped[str | None] = mapped_column(String(24))
    previous_korean_visa: Mapped[str | None] = mapped_column(String(16))
    current_korean_visa: Mapped[str | None] = mapped_column(String(16))
    in_korea_now: Mapped[bool | None] = mapped_column(Boolean)
    financial_sponsor: Mapped[str | None] = mapped_column(String(24))  # SELF | PARENTS | RELATIVE | SCHOLARSHIP | EMPLOYER
    academic_priorities: Mapped[list[str] | None] = mapped_column(JSON)  # RANKING | COST | SCHOLARSHIP | LOCATION | ENGLISH_PROGRAMS
    career_goal: Mapped[str | None] = mapped_column(Text)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pipeline_stage: Mapped[PipelineStage] = enum_col(PipelineStage, default=PipelineStage.NEW_LEAD, index=True)
    lead_source: Mapped[str | None] = mapped_column(String(48))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    educations: Mapped[list["StudentEducation"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    languages: Mapped[list["StudentLanguage"]] = relationship(back_populates="profile", cascade="all, delete-orphan")


class StudentEducation(IdMixin, TimestampMixin, Base):
    __tablename__ = "student_educations"
    profile_id: Mapped[uuid.UUID] = fk("student_profiles.id")
    level: Mapped[str] = mapped_column(String(24))  # HIGH_SCHOOL | ASSOCIATE | BACHELOR | MASTER | DOCTORATE
    institution: Mapped[str] = mapped_column(String(200))
    country: Mapped[str] = mapped_column(String(2))
    major: Mapped[str | None] = mapped_column(String(160))
    start_year: Mapped[int | None] = mapped_column(Integer)
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    graduation_status: Mapped[str] = mapped_column(String(24), default="GRADUATED")  # GRADUATED | EXPECTED | IN_PROGRESS
    gpa_value: Mapped[float | None] = mapped_column(Float)
    gpa_scale_min: Mapped[float | None] = mapped_column(Float, default=0)
    gpa_scale_max: Mapped[float | None] = mapped_column(Float)
    # Transparent linear normalization: (value - min) / (max - min) * 100. Stored so reviewers can audit/override.
    gpa_percent: Mapped[float | None] = mapped_column(Float)
    gpa_override_note: Mapped[str | None] = mapped_column(String(300))
    profile: Mapped[StudentProfile] = relationship(back_populates="educations")


class StudentLanguage(IdMixin, TimestampMixin, Base):
    __tablename__ = "student_languages"
    profile_id: Mapped[uuid.UUID] = fk("student_profiles.id")
    test: Mapped[LanguageTest] = enum_col(LanguageTest)
    score: Mapped[float] = mapped_column(Float)  # TOPIK: level 1-6; IELTS band; TOEFL iBT total
    test_date: Mapped[date | None] = mapped_column(Date)
    expires_on: Mapped[date | None] = mapped_column(Date)
    is_planned: Mapped[bool] = mapped_column(Boolean, default=False)  # planned test date, not yet taken
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    profile: Mapped[StudentProfile] = relationship(back_populates="languages")


class SavedUniversity(IdMixin, Base):
    __tablename__ = "saved_universities"
    __table_args__ = (UniqueConstraint("user_id", "university_id"),)
    user_id: Mapped[uuid.UUID] = fk("users.id")
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True, ondelete="SET NULL")
    note: Mapped[str | None] = mapped_column(String(300))
    #: V15 — ``STUDENT`` saved it themselves, ``HANGYUL`` is one of the 최대 N곳 the plan promises. The plan
    #: sells a counted number of recommendations, so they have to be distinguishable from the student's saves.
    source: Mapped[str] = mapped_column(String(16), default="STUDENT")
    recommended_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Comparison(IdMixin, TimestampMixin, Base):
    __tablename__ = "comparisons"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    program_ids: Mapped[list[str]] = mapped_column(JSON)
    name: Mapped[str | None] = mapped_column(String(120))


class MatchSnapshot(IdMixin, Base):
    """Persisted match result for analytics and future model training; explanations stored verbatim."""
    __tablename__ = "match_snapshots"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    engine_version: Mapped[str] = mapped_column(String(24))
    eligible: Mapped[bool] = mapped_column(Boolean)
    tier: Mapped[str] = mapped_column(String(24))
    score: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Appointment(IdMixin, TimestampMixin, Base):
    """Consultations and interviews."""
    __tablename__ = "appointments"
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id", nullable=True)
    host_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True)
    kind: Mapped[str] = mapped_column(String(24))  # CONSULTATION | INTERVIEW | INTERVIEW_PREP
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    channel: Mapped[str] = mapped_column(String(24), default="VIDEO")
    status: Mapped[str] = mapped_column(String(24), default="SCHEDULED")
    notes: Mapped[str | None] = mapped_column(Text)
    # Close-out (V3): what was agreed, and the follow-up task it produced.
    outcome_notes: Mapped[str | None] = mapped_column(Text)
    follow_up_task_id: Mapped[uuid.UUID | None] = fk("tasks.id", nullable=True, ondelete="SET NULL")
    # V9 meeting record (REPORT §59 A8): decisions, every follow-up task, and the next appointment, as one record.
    decisions: Mapped[list[str] | None] = mapped_column(JSON)
    follow_up_task_ids: Mapped[list[str] | None] = mapped_column(JSON)
    next_appointment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
