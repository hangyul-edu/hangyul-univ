import uuid
from datetime import date

from sqlalchemy import JSON, Boolean, Date, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, SourcedMixin, TimestampMixin, enum_col, fk
from app.models.enums import (
    DegreeLevel,
    DocumentCategory,
    InstitutionType,
    InstructionLanguage,
    IntakeTerm,
    ScholarshipKind,
)


class University(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "universities"
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    name_en: Mapped[str] = mapped_column(String(200), index=True)
    name_ko: Mapped[str] = mapped_column(String(200))
    institution_type: Mapped[InstitutionType] = enum_col(InstitutionType)
    region: Mapped[str] = mapped_column(String(60), index=True)  # province / metropolitan city
    city: Mapped[str] = mapped_column(String(60))
    website_url: Mapped[str | None] = mapped_column(String(500))
    international_admissions_url: Mapped[str | None] = mapped_column(String(500))
    summary: Mapped[str | None] = mapped_column(Text)
    founded_year: Mapped[int | None] = mapped_column(Integer)
    has_international_office: Mapped[bool] = mapped_column(Boolean, default=True)
    international_services: Mapped[list[str] | None] = mapped_column(JSON)  # buddy program, orientation, pickup...
    est_living_cost_monthly_krw: Mapped[int | None] = mapped_column(Integer)
    is_partner: Mapped[bool] = mapped_column(Boolean, default=False)  # derived from active PartnerContract; cached
    # Ministry of Education international-student certification tier (교육국제화역량 인증제). Affects visa issuance.
    # EXCELLENT | CERTIFIED | BASIC | VISA_RESTRICTED | UNKNOWN
    certification_status: Mapped[str] = mapped_column(String(24), default="UNKNOWN")
    certification_source_url: Mapped[str | None] = mapped_column(String(500))
    certification_verified_at: Mapped[date | None] = mapped_column(Date)
    # V5 visa routes: the tier the visa resolver uses (MOJ national rules: e-visa / CCVI availability).
    # EXCELLENT | CERTIFIED | GENERAL | UNKNOWN — UNKNOWN unless verified from the yearly MOJ/MOE results.
    visa_certification: Mapped[str | None] = mapped_column(String(16), default="UNKNOWN")
    visa_certification_verified_at: Mapped[date | None] = mapped_column(Date)
    brand_color: Mapped[str | None] = mapped_column(String(9))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    campuses: Mapped[list["Campus"]] = relationship(back_populates="university", cascade="all, delete-orphan")
    programs: Mapped[list["Program"]] = relationship(back_populates="university", cascade="all, delete-orphan")
    dormitories: Mapped[list["Dormitory"]] = relationship(back_populates="university", cascade="all, delete-orphan")
    scholarships: Mapped[list["Scholarship"]] = relationship(back_populates="university", cascade="all, delete-orphan")


class Campus(IdMixin, Base):
    __tablename__ = "campuses"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(60))
    address: Mapped[str | None] = mapped_column(String(300))
    is_main: Mapped[bool] = mapped_column(Boolean, default=True)
    university: Mapped[University] = relationship(back_populates="campuses")


class College(IdMixin, Base):
    __tablename__ = "colleges"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    name: Mapped[str] = mapped_column(String(160))


class Department(IdMixin, Base):
    __tablename__ = "departments"
    college_id: Mapped[uuid.UUID] = fk("colleges.id")
    name: Mapped[str] = mapped_column(String(160))


class Program(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "programs"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    campus_id: Mapped[uuid.UUID | None] = fk("campuses.id", nullable=True, ondelete="SET NULL")
    department_id: Mapped[uuid.UUID | None] = fk("departments.id", nullable=True, ondelete="SET NULL")
    name_en: Mapped[str] = mapped_column(String(200), index=True)
    name_ko: Mapped[str | None] = mapped_column(String(200))
    degree_level: Mapped[DegreeLevel] = enum_col(DegreeLevel, index=True)
    field: Mapped[str] = mapped_column(String(80), index=True)  # normalized field taxonomy key
    instruction_language: Mapped[InstructionLanguage] = enum_col(InstructionLanguage)
    duration_semesters: Mapped[int | None] = mapped_column(Integer)
    tuition_per_semester_krw: Mapped[int | None] = mapped_column(Integer)
    application_fee_krw: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    university: Mapped[University] = relationship(back_populates="programs")
    intakes: Mapped[list["ProgramIntake"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    requirements: Mapped[list["AdmissionRequirement"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class ProgramIntake(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "program_intakes"
    __table_args__ = (UniqueConstraint("program_id", "year", "term", "round"),)
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    year: Mapped[int] = mapped_column(Integer)
    term: Mapped[IntakeTerm] = enum_col(IntakeTerm)
    round: Mapped[int] = mapped_column(Integer, default=1)
    application_opens: Mapped[date | None] = mapped_column(Date)
    application_deadline: Mapped[date] = mapped_column(Date, index=True)
    document_deadline: Mapped[date | None] = mapped_column(Date)
    interview_window: Mapped[str | None] = mapped_column(String(120))
    decision_date: Mapped[date | None] = mapped_column(Date)
    tuition_deadline: Mapped[date | None] = mapped_column(Date)
    semester_start: Mapped[date | None] = mapped_column(Date)
    seats_international: Mapped[int | None] = mapped_column(Integer)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    program: Mapped[Program] = relationship(back_populates="intakes")


class AdmissionRequirement(IdMixin, TimestampMixin, SourcedMixin, Base):
    """Hard-eligibility inputs for matching. Null = no requirement published."""
    __tablename__ = "admission_requirements"
    program_id: Mapped[uuid.UUID] = fk("programs.id")
    min_prior_education: Mapped[str | None] = mapped_column(String(24))  # HIGH_SCHOOL | ASSOCIATE | BACHELOR | MASTER
    min_gpa_percent: Mapped[float | None] = mapped_column(Float)  # normalized 0-100; see GPA methodology
    min_topik_level: Mapped[int | None] = mapped_column(Integer)
    min_ielts: Mapped[float | None] = mapped_column(Float)
    min_toefl_ibt: Mapped[int | None] = mapped_column(Integer)
    language_alternative: Mapped[bool] = mapped_column(Boolean, default=True)  # True: TOPIK *or* English suffices
    requires_both_parents_foreign: Mapped[bool] = mapped_column(Boolean, default=True)
    excluded_nationalities: Mapped[list[str] | None] = mapped_column(JSON)
    requires_interview: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_portfolio: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    program: Mapped[Program] = relationship(back_populates="requirements")


class DocumentRequirement(IdMixin, TimestampMixin, SourcedMixin, Base):
    """Required documents per university (program_id null) or per program; optionally nationality-specific."""
    __tablename__ = "document_requirements"
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True)
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True)
    degree_level: Mapped[str | None] = mapped_column(String(24))
    category: Mapped[DocumentCategory] = enum_col(DocumentCategory)
    label: Mapped[str] = mapped_column(String(200))
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    legalization_required: Mapped[bool] = mapped_column(Boolean, default=False)
    translation_required: Mapped[bool] = mapped_column(Boolean, default=False)
    applies_to_nationalities: Mapped[list[str] | None] = mapped_column(JSON)  # null = everyone
    max_age_days: Mapped[int | None] = mapped_column(Integer)  # e.g. bank statement freshness
    notes: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    # V27 (REPORT §357): a requirement read from an official guide. Only rows with a VERIFIED guide build a checklist.
    guide_id: Mapped[uuid.UUID | None] = fk("admission_guides.id", nullable=True)
    name_ko: Mapped[str | None] = mapped_column(String(300))
    #: The guide's own words for when a CONDITIONAL item applies; `applies_to` is the machine-checkable part.
    condition: Mapped[str | None] = mapped_column(Text)
    applies_to: Mapped[dict | None] = mapped_column(JSON)
    original_or_copy: Mapped[str | None] = mapped_column(String(8))  # ORIGINAL | COPY | EITHER
    submission_method: Mapped[str | None] = mapped_column(String(12))  # UPLOAD | MAIL | IN_PERSON
    notarization_required: Mapped[bool] = mapped_column(Boolean, default=False)
    #: APOSTILLE_OR_CONSULAR · CHINA_CHSI · NOT_REQUIRED · null (guide silent). Which of apostille/consular applies is
    #: decided per document from the issuing country and date (`dossier.route_for`), never stored here.
    legalization_rule: Mapped[str | None] = mapped_column(String(32))
    source_page: Mapped[str | None] = mapped_column(String(60))
    evidence: Mapped[str | None] = mapped_column(Text)


class Dormitory(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "dormitories"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    name: Mapped[str] = mapped_column(String(160))
    room_types: Mapped[list[str] | None] = mapped_column(JSON)
    capacity: Mapped[int | None] = mapped_column(Integer)
    cost_per_semester_krw_min: Mapped[int | None] = mapped_column(Integer)
    cost_per_semester_krw_max: Mapped[int | None] = mapped_column(Integer)
    international_priority: Mapped[bool] = mapped_column(Boolean, default=False)
    meal_plan: Mapped[bool | None] = mapped_column(Boolean)
    application_note: Mapped[str | None] = mapped_column(Text)
    # V5 concierge: decision facts shown to admitted students (each row carries SourcedMixin provenance).
    application_opens: Mapped[date | None] = mapped_column(Date)
    application_closes: Mapped[date | None] = mapped_column(Date)
    eligibility: Mapped[str | None] = mapped_column(Text)
    meal_required: Mapped[bool | None] = mapped_column(Boolean)
    move_in_date: Mapped[date | None] = mapped_column(Date)
    deposit_krw: Mapped[int | None] = mapped_column(Integer)
    required_documents: Mapped[list[str] | None] = mapped_column(JSON)
    location: Mapped[str | None] = mapped_column(String(300))
    university: Mapped[University] = relationship(back_populates="dormitories")


class Scholarship(IdMixin, TimestampMixin, SourcedMixin, Base):
    __tablename__ = "scholarships"
    university_id: Mapped[uuid.UUID | None] = fk("universities.id", nullable=True)
    kind: Mapped[ScholarshipKind] = enum_col(ScholarshipKind, index=True)
    name: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    coverage: Mapped[str | None] = mapped_column(String(200))  # human description e.g. "30–100% tuition"
    tuition_waiver_percent_min: Mapped[int | None] = mapped_column(Integer)
    tuition_waiver_percent_max: Mapped[int | None] = mapped_column(Integer)
    amount_krw: Mapped[int | None] = mapped_column(Integer)
    degree_levels: Mapped[list[str] | None] = mapped_column(JSON)
    application_deadline: Mapped[date | None] = mapped_column(Date)
    is_automatic: Mapped[bool] = mapped_column(Boolean, default=False)  # awarded at admission, no separate application
    # Only HANGYUL_PARTNER scholarships: backed by a scholarship pool of an ACTIVE partner contract.
    pool_id: Mapped[uuid.UUID | None] = fk("scholarship_pools.id", nullable=True, ondelete="SET NULL")
    # V27 (REPORT §355): a scheme read from the institution's official page, one row per scheme or tier.
    institution_id: Mapped[uuid.UUID | None] = fk("institutions.id", nullable=True)
    name_en: Mapped[str | None] = mapped_column(String(300))
    # V28: the scheme's name as the institution publishes it. `name_native` is the Korean name on a Korean official page,
    # `name_official_en` the English name on an English official page; `name_display_ko` is what a Korean screen shows —
    # the native name when there is one, else a Korean description (`display_is_description`), never a translated "name".
    name_native: Mapped[str | None] = mapped_column(String(300))
    name_official_en: Mapped[str | None] = mapped_column(String(300))
    name_display_ko: Mapped[str | None] = mapped_column(String(300))
    display_is_description: Mapped[bool | None] = mapped_column(Boolean)
    #: GKS · UNIVERSITY · FOUNDATION · DEPARTMENT · LANGUAGE · ACADEMIC · HOUSING
    category: Mapped[str | None] = mapped_column(String(16))
    stage: Mapped[str | None] = mapped_column(String(10))  # NEW | ENROLLED | BOTH
    international_only: Mapped[bool | None] = mapped_column(Boolean)
    topik_min: Mapped[int | None] = mapped_column(Integer)
    english_min: Mapped[dict | None] = mapped_column(JSON)  # {"TOEFL_IBT": 80, "IELTS_ACADEMIC": 6.0}
    gpa_requirement: Mapped[str | None] = mapped_column(String(300))
    gpa_min_percent: Mapped[float | None] = mapped_column(Float)
    dormitory_support: Mapped[bool | None] = mapped_column(Boolean)
    living_allowance: Mapped[str | None] = mapped_column(String(300))
    duration: Mapped[str | None] = mapped_column(String(300))
    renewal: Mapped[str | None] = mapped_column(String(500))
    application_period: Mapped[str | None] = mapped_column(String(300))
    department_restriction: Mapped[str | None] = mapped_column(String(300))
    nationality_restriction: Mapped[str | None] = mapped_column(String(300))
    evidence: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str | None] = mapped_column(String(300))
    university: Mapped[University | None] = relationship(back_populates="scholarships")
    rules: Mapped[list["ScholarshipRule"]] = relationship(back_populates="scholarship", cascade="all, delete-orphan")


class ScholarshipRule(IdMixin, Base):
    """Machine-checkable eligibility criteria. field ∈ {topik_level, ielts, gpa_percent, nationality, degree_level, field}."""
    __tablename__ = "scholarship_rules"
    scholarship_id: Mapped[uuid.UUID] = fk("scholarships.id")
    field: Mapped[str] = mapped_column(String(40))
    operator: Mapped[str] = mapped_column(String(8))  # gte | lte | in | not_in | eq
    value: Mapped[str] = mapped_column(String(300))  # JSON-encoded scalar or list
    description: Mapped[str] = mapped_column(String(300))
    scholarship: Mapped[Scholarship] = relationship(back_populates="rules")
