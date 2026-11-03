"""Domain enums. Stored as VARCHAR (native_enum=False) so adding a value never needs a DB type migration."""
from enum import StrEnum


class Role(StrEnum):
    STUDENT = "STUDENT"
    HANGYUL_SUPER_ADMIN = "HANGYUL_SUPER_ADMIN"
    HANGYUL_OPERATIONS = "HANGYUL_OPERATIONS"
    HANGYUL_COUNSELOR = "HANGYUL_COUNSELOR"
    HANGYUL_FINANCE = "HANGYUL_FINANCE"
    # V22 (REPORT §246–247): one operational permission per tenant type. Every member of a partner agency is an
    # AGENCY_ADMIN; every member of a university tenant is a UNIVERSITY_ADMIN. The values below the marker are
    # **legacy aliases** kept only so pre-migration rows and in-flight tokens still deserialise; `canonical_role()`
    # maps each of them to the single current role and nothing offers them as a choice.
    AGENCY_ADMIN = "AGENCY_ADMIN"
    UNIVERSITY_ADMIN = "UNIVERSITY_ADMIN"
    # --- legacy aliases (V2–V21), migrated by alembic `v22roles0001`
    AGENCY_OWNER = "AGENCY_OWNER"
    AGENCY_MANAGER = "AGENCY_MANAGER"
    AGENCY_COUNSELOR = "AGENCY_COUNSELOR"
    AGENCY_DOCUMENT_REVIEWER = "AGENCY_DOCUMENT_REVIEWER"
    UNIVERSITY_ADMISSIONS = "UNIVERSITY_ADMISSIONS"
    UNIVERSITY_REVIEWER = "UNIVERSITY_REVIEWER"
    UNIVERSITY_ANALYST = "UNIVERSITY_ANALYST"


HANGYUL_ROLES = {Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS, Role.HANGYUL_COUNSELOR, Role.HANGYUL_FINANCE}
LEGACY_AGENCY_ROLES = {Role.AGENCY_OWNER, Role.AGENCY_MANAGER, Role.AGENCY_COUNSELOR, Role.AGENCY_DOCUMENT_REVIEWER}
LEGACY_UNIVERSITY_ROLES = {Role.UNIVERSITY_ADMISSIONS, Role.UNIVERSITY_REVIEWER, Role.UNIVERSITY_ANALYST}
#: Accepted on a membership row (so a stale row still signs in); the principal always sees the canonical role.
AGENCY_ROLES = {Role.AGENCY_ADMIN} | LEGACY_AGENCY_ROLES
UNIVERSITY_ROLES = {Role.UNIVERSITY_ADMIN} | LEGACY_UNIVERSITY_ROLES
#: The roles a client may be offered or assigned today. Legacy values are deliberately absent.
ASSIGNABLE_TENANT_ROLES = {Role.AGENCY_ADMIN, Role.UNIVERSITY_ADMIN}
LEGACY_ROLE_MAP: dict["Role", "Role"] = {
    **{r: Role.AGENCY_ADMIN for r in LEGACY_AGENCY_ROLES},
    **{r: Role.UNIVERSITY_ADMIN for r in LEGACY_UNIVERSITY_ROLES},
}


def canonical_role(role: "Role") -> "Role":
    """The one permission a tenant member has today, whatever the row says (REPORT §246 A7)."""
    return LEGACY_ROLE_MAP.get(role, role)


class OrgType(StrEnum):
    HANGYUL = "HANGYUL"
    AGENCY = "AGENCY"
    UNIVERSITY = "UNIVERSITY"


class DegreeLevel(StrEnum):
    LANGUAGE = "LANGUAGE"  # Korean language institute (non-degree, typically D-4-1)
    ASSOCIATE = "ASSOCIATE"
    BACHELOR = "BACHELOR"
    TRANSFER = "TRANSFER"
    MASTER = "MASTER"
    DOCTORATE = "DOCTORATE"
    COMBINED = "COMBINED"  # integrated master's-doctorate


class InstitutionType(StrEnum):
    NATIONAL = "NATIONAL"
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class InstructionLanguage(StrEnum):
    KOREAN = "KOREAN"
    ENGLISH = "ENGLISH"
    BILINGUAL = "BILINGUAL"


class IntakeTerm(StrEnum):
    SPRING = "SPRING"
    SUMMER = "SUMMER"
    FALL = "FALL"
    WINTER = "WINTER"


class VerificationStatus(StrEnum):
    """Freshness state of any time-sensitive record."""
    CURRENT = "CURRENT"
    REVIEW_DUE = "REVIEW_DUE"
    CHANGED = "CHANGED"
    CONFLICT = "CONFLICT"
    ARCHIVED = "ARCHIVED"
    DEMO = "DEMO"  # development/sample data; never presented as verified fact


class SourceType(StrEnum):
    GOVERNMENT = "GOVERNMENT"
    OFFICIAL_PORTAL = "OFFICIAL_PORTAL"
    UNIVERSITY = "UNIVERSITY"
    INTERNATIONAL_ORG = "INTERNATIONAL_ORG"
    COMMERCIAL = "COMMERCIAL"
    NEWS = "NEWS"
    PARTNER_CONTRACT = "PARTNER_CONTRACT"
    INTERNAL = "INTERNAL"
    DEMO = "DEMO"


class ScholarshipKind(StrEnum):
    UNIVERSITY = "UNIVERSITY"
    GOVERNMENT = "GOVERNMENT"
    HANGYUL_PARTNER = "HANGYUL_PARTNER"
    OTHER = "OTHER"


class LanguageTest(StrEnum):
    TOPIK = "TOPIK"
    IELTS = "IELTS"
    TOEFL_IBT = "TOEFL_IBT"
    DUOLINGO = "DUOLINGO"
    SKA = "SKA"  # Sejong Korean Assessment etc.; extend as needed
    # V27 — the test registry (packages/types/src/admissions.ts). IELTS here is the academic module.
    TOPIK_IBT = "TOPIK_IBT"
    KIIP = "KIIP"
    KING_SEJONG = "KING_SEJONG"
    UNIV_KLI = "UNIV_KLI"
    TEPS = "TEPS"
    NEW_TEPS = "NEW_TEPS"
    TOEIC = "TOEIC"
    PTE = "PTE"
    CAMBRIDGE = "CAMBRIDGE"


class DocumentCategory(StrEnum):
    PASSPORT = "PASSPORT"
    NATIONAL_ID = "NATIONAL_ID"
    PHOTO = "PHOTO"
    TRANSCRIPT = "TRANSCRIPT"
    GRADUATION_CERTIFICATE = "GRADUATION_CERTIFICATE"
    EXPECTED_GRADUATION_CERTIFICATE = "EXPECTED_GRADUATION_CERTIFICATE"
    FAMILY_RELATION_CERTIFICATE = "FAMILY_RELATION_CERTIFICATE"
    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE"
    BANK_STATEMENT = "BANK_STATEMENT"
    SPONSOR_DOCUMENT = "SPONSOR_DOCUMENT"
    EMPLOYMENT_INCOME_PROOF = "EMPLOYMENT_INCOME_PROOF"
    TOPIK = "TOPIK"
    IELTS = "IELTS"
    TOEFL = "TOEFL"
    RECOMMENDATION = "RECOMMENDATION"
    PERSONAL_STATEMENT = "PERSONAL_STATEMENT"
    STUDY_PLAN = "STUDY_PLAN"
    CV = "CV"
    APOSTILLE = "APOSTILLE"
    NOTARIZATION = "NOTARIZATION"
    CERTIFIED_TRANSLATION = "CERTIFIED_TRANSLATION"
    RESIDENCE_CARD = "RESIDENCE_CARD"
    VISA = "VISA"
    ADMISSION_LETTER = "ADMISSION_LETTER"
    # V27 — categories official guides name that the earlier list could not represent.
    APPLICATION_FORM = "APPLICATION_FORM"
    PARENT_ID = "PARENT_ID"
    PORTFOLIO = "PORTFOLIO"
    RESEARCH_PROPOSAL = "RESEARCH_PROPOSAL"
    CONSENT_FORM = "CONSENT_FORM"
    #: A guide asking for "a language certificate" — fulfilled by whichever of TOPIK / IELTS / TOEFL the student holds.
    LANGUAGE_CERTIFICATE = "LANGUAGE_CERTIFICATE"
    OTHER = "OTHER"


class DocumentStatus(StrEnum):
    MISSING = "MISSING"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    NEEDS_CORRECTION = "NEEDS_CORRECTION"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"


class LegalizationStatus(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    REQUIRED = "REQUIRED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class LegalizationPath(StrEnum):
    NONE = "NONE"
    APOSTILLE = "APOSTILLE"
    CONSULAR_LEGALIZATION = "CONSULAR_LEGALIZATION"
    ISSUER_VERIFICATION = "ISSUER_VERIFICATION"  # e.g. official degree verification services


class EssayType(StrEnum):
    PERSONAL_STATEMENT = "PERSONAL_STATEMENT"
    STUDY_PLAN = "STUDY_PLAN"
    CV = "CV"
    RECOMMENDATION = "RECOMMENDATION"


class EssayStatus(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    AI_PRECHECK = "AI_PRECHECK"
    AGENCY_REVIEW = "AGENCY_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    STUDENT_REVISION = "STUDENT_REVISION"
    FINAL_REVIEW = "FINAL_REVIEW"
    APPROVED = "APPROVED"


class ApplicationStatus(StrEnum):
    DRAFT = "DRAFT"
    PROFILE_REVIEW = "PROFILE_REVIEW"
    DOCUMENT_PREPARATION = "DOCUMENT_PREPARATION"
    READY = "READY"
    SUBMITTED = "SUBMITTED"
    UNIVERSITY_REVIEW = "UNIVERSITY_REVIEW"
    ADDITIONAL_DOCUMENTS = "ADDITIONAL_DOCUMENTS"
    INTERVIEW = "INTERVIEW"
    OFFERED = "OFFERED"
    WAITLISTED = "WAITLISTED"
    REJECTED = "REJECTED"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    TUITION_PENDING = "TUITION_PENDING"
    TUITION_PAID = "TUITION_PAID"
    ADMISSION_CERTIFICATE_PENDING = "ADMISSION_CERTIFICATE_PENDING"
    ADMISSION_CERTIFICATE_ISSUED = "ADMISSION_CERTIFICATE_ISSUED"
    VISA_PREPARATION = "VISA_PREPARATION"
    VISA_SUBMITTED = "VISA_SUBMITTED"
    VISA_ISSUED = "VISA_ISSUED"
    ENROLLED = "ENROLLED"
    WITHDRAWN = "WITHDRAWN"


class PipelineStage(StrEnum):
    NEW_LEAD = "NEW_LEAD"
    PROFILE_INCOMPLETE = "PROFILE_INCOMPLETE"
    QUALIFIED = "QUALIFIED"
    SERVICE_PURCHASED = "SERVICE_PURCHASED"
    ASSIGNED = "ASSIGNED"
    DOCUMENT_PREPARATION = "DOCUMENT_PREPARATION"
    READY_TO_APPLY = "READY_TO_APPLY"
    APPLIED = "APPLIED"
    INTERVIEW = "INTERVIEW"
    OFFERED = "OFFERED"
    REJECTED = "REJECTED"
    WAITLISTED = "WAITLISTED"
    TUITION_PENDING = "TUITION_PENDING"
    ENROLLED = "ENROLLED"
    VISA_PREPARATION = "VISA_PREPARATION"
    VISA_ISSUED = "VISA_ISSUED"
    ARRIVAL_PREPARATION = "ARRIVAL_PREPARATION"
    ARRIVED = "ARRIVED"
    ACTIVE_STUDENT = "ACTIVE_STUDENT"
    GRADUATED = "GRADUATED"
    WITHDRAWN = "WITHDRAWN"


class VisaType(StrEnum):
    D2_1 = "D-2-1"  # associate degree
    D2_2 = "D-2-2"  # bachelor's
    D2_3 = "D-2-3"  # master's
    D2_4 = "D-2-4"  # doctorate
    D2_5 = "D-2-5"  # research
    D2_6 = "D-2-6"  # exchange
    D2_7 = "D-2-7"  # work-study
    D2_8 = "D-2-8"  # short-term
    D4_1 = "D-4-1"  # Korean language trainee
    OTHER = "OTHER"


class VisaStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    ELIGIBILITY_CHECK = "ELIGIBILITY_CHECK"
    WAITING_FOR_ADMISSION = "WAITING_FOR_ADMISSION"
    DOCUMENT_PREPARATION = "DOCUMENT_PREPARATION"
    READY_TO_APPLY = "READY_TO_APPLY"
    SUBMITTED = "SUBMITTED"
    ADDITIONAL_DOCUMENTS = "ADDITIONAL_DOCUMENTS"
    APPROVED = "APPROVED"
    ISSUED = "ISSUED"
    REJECTED = "REJECTED"


class HousingStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    RESEARCHING = "RESEARCHING"
    DORM_APPLYING = "DORM_APPLYING"
    DORM_CONFIRMED = "DORM_CONFIRMED"
    OFF_CAMPUS_SEARCH = "OFF_CAMPUS_SEARCH"
    CONTRACT_REVIEW = "CONTRACT_REVIEW"
    CONFIRMED = "CONFIRMED"


class TaskStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class TaskPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskType(StrEnum):
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    DOCUMENT_REVIEW = "DOCUMENT_REVIEW"
    ESSAY_WRITE = "ESSAY_WRITE"
    ESSAY_REVIEW = "ESSAY_REVIEW"
    APPLICATION_DEADLINE = "APPLICATION_DEADLINE"
    APPLICATION_SUBMIT = "APPLICATION_SUBMIT"
    INTERVIEW = "INTERVIEW"
    TUITION_PAYMENT = "TUITION_PAYMENT"
    VISA_STEP = "VISA_STEP"
    DORM_APPLICATION = "DORM_APPLICATION"
    ARRIVAL_STEP = "ARRIVAL_STEP"
    SCHOLARSHIP_DEADLINE = "SCHOLARSHIP_DEADLINE"
    PROFILE = "PROFILE"
    CONSULTATION = "CONSULTATION"
    UNIVERSITY_REQUEST = "UNIVERSITY_REQUEST"
    SLA_FOLLOW_UP = "SLA_FOLLOW_UP"
    FRESHNESS_REVIEW = "FRESHNESS_REVIEW"
    GENERAL = "GENERAL"


class AssignmentStatus(StrEnum):
    PROPOSED = "PROPOSED"
    ACTIVE = "ACTIVE"
    REASSIGNED = "REASSIGNED"
    ENDED = "ENDED"


class OrderStatus(StrEnum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"


class ContractStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"


class AddOnStatus(StrEnum):
    """An optional paid service offered inside a case (V29 add-on catalogue, REPORT §390).

    ``OFFERED`` is a priced proposal the student sees; it grants nothing. Approving creates an ADD_ON order and
    moves to ``AWAITING_PAYMENT`` — still nothing granted. Only a PAID order makes it ``ACTIVE`` (allowance raised
    or service case opened), and ``COMPLETED`` once that case is done. Declining is a terminal, blameless state —
    no dark pattern, no re-offer loop.

    ``APPROVED`` is the V15–V28 state, when approving granted the entitlement without payment. V29's migration
    moved every such row to ``ACTIVE`` (legacy demo grants, recorded in the migration) and nothing writes it now.
    """
    OFFERED = "OFFERED"
    AWAITING_PAYMENT = "AWAITING_PAYMENT"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    APPROVED = "APPROVED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class AwardStatus(StrEnum):
    PROPOSED = "PROPOSED"
    COMMITTED = "COMMITTED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class MessageVisibility(StrEnum):
    """INTERNAL messages are staff-only notes and must never be returned to students."""
    PARTICIPANTS = "PARTICIPANTS"
    INTERNAL = "INTERNAL"


class ConversationKind(StrEnum):
    STUDENT_SUPPORT = "STUDENT_SUPPORT"  # student <-> Hangyul/agency
    STAFF = "STAFF"  # Hangyul <-> agency / university
    APPLICATION = "APPLICATION"  # scoped to an application; university may be included


class EnrollmentStatus(StrEnum):
    ENROLLED = "ENROLLED"
    ON_LEAVE = "ON_LEAVE"
    WITHDRAWN = "WITHDRAWN"
    TRANSFERRED = "TRANSFERRED"
    GRADUATED = "GRADUATED"


class ContentType(StrEnum):
    STUDY_GUIDE = "STUDY_GUIDE"
    VISA_GUIDE = "VISA_GUIDE"
    UNIVERSITY_GUIDE = "UNIVERSITY_GUIDE"
    DEGREE_GUIDE = "DEGREE_GUIDE"
    MAJOR_GUIDE = "MAJOR_GUIDE"
    COUNTRY_GUIDE = "COUNTRY_GUIDE"
    SCHOLARSHIP_GUIDE = "SCHOLARSHIP_GUIDE"
    COST_GUIDE = "COST_GUIDE"
    DORMITORY_GUIDE = "DORMITORY_GUIDE"
    APPLICATION_CALENDAR = "APPLICATION_CALENDAR"
    FAQ = "FAQ"


class ContentStatus(StrEnum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class TicketStatus(StrEnum):
    OPEN = "OPEN"
    WAITING_STUDENT = "WAITING_STUDENT"
    RESOLVED = "RESOLVED"
