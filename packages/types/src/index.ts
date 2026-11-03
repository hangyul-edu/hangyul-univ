/** Domain types shared by all web and mobile apps. They mirror the FastAPI serializers in server/app/api. */

export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;

export type Role =
  | 'STUDENT'
  | 'HANGYUL_SUPER_ADMIN' | 'HANGYUL_OPERATIONS' | 'HANGYUL_COUNSELOR' | 'HANGYUL_FINANCE'
  // V22: one permission per tenant. The remaining values are legacy aliases the API maps to the two admins.
  | 'AGENCY_ADMIN' | 'UNIVERSITY_ADMIN'
  | 'AGENCY_OWNER' | 'AGENCY_MANAGER' | 'AGENCY_COUNSELOR' | 'AGENCY_DOCUMENT_REVIEWER'
  | 'UNIVERSITY_ADMISSIONS' | 'UNIVERSITY_REVIEWER' | 'UNIVERSITY_ANALYST';
export type OrgType = 'HANGYUL' | 'AGENCY' | 'UNIVERSITY';
export type ClientApp = 'student' | 'agency' | 'university' | 'marketing';

export type DegreeLevel = 'LANGUAGE' | 'ASSOCIATE' | 'BACHELOR' | 'TRANSFER' | 'MASTER' | 'DOCTORATE' | 'COMBINED';
export const DEGREE_LEVELS: DegreeLevel[] = ['LANGUAGE', 'ASSOCIATE', 'BACHELOR', 'TRANSFER', 'MASTER', 'DOCTORATE', 'COMBINED'];
export type InstitutionType = 'NATIONAL' | 'PUBLIC' | 'PRIVATE';
export type InstructionLanguage = 'KOREAN' | 'ENGLISH' | 'BILINGUAL';
export type IntakeTerm = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';
export type VerificationStatus = 'CURRENT' | 'REVIEW_DUE' | 'CHANGED' | 'CONFLICT' | 'ARCHIVED' | 'DEMO';
export type LanguageTest = 'TOPIK' | 'IELTS' | 'TOEFL_IBT' | 'DUOLINGO' | 'SKA';

export type DocumentCategory =
  | 'PASSPORT' | 'NATIONAL_ID' | 'PHOTO' | 'TRANSCRIPT' | 'GRADUATION_CERTIFICATE' | 'EXPECTED_GRADUATION_CERTIFICATE'
  | 'FAMILY_RELATION_CERTIFICATE' | 'BIRTH_CERTIFICATE' | 'BANK_STATEMENT' | 'SPONSOR_DOCUMENT' | 'EMPLOYMENT_INCOME_PROOF'
  | 'TOPIK' | 'IELTS' | 'TOEFL' | 'RECOMMENDATION' | 'PERSONAL_STATEMENT' | 'STUDY_PLAN' | 'CV' | 'APOSTILLE' | 'NOTARIZATION'
  | 'CERTIFIED_TRANSLATION' | 'RESIDENCE_CARD' | 'VISA' | 'ADMISSION_LETTER'
  // V27: categories official guides name (LANGUAGE_CERTIFICATE is met by a TOPIK / IELTS / TOEFL upload, never uploaded as such)
  | 'APPLICATION_FORM' | 'PARENT_ID' | 'PORTFOLIO' | 'RESEARCH_PROPOSAL' | 'CONSENT_FORM' | 'LANGUAGE_CERTIFICATE' | 'OTHER';
export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'PASSPORT', 'NATIONAL_ID', 'PHOTO', 'TRANSCRIPT', 'GRADUATION_CERTIFICATE', 'EXPECTED_GRADUATION_CERTIFICATE', 'FAMILY_RELATION_CERTIFICATE',
  'BIRTH_CERTIFICATE', 'BANK_STATEMENT', 'SPONSOR_DOCUMENT', 'EMPLOYMENT_INCOME_PROOF', 'TOPIK', 'IELTS', 'TOEFL', 'RECOMMENDATION',
  'PERSONAL_STATEMENT', 'STUDY_PLAN', 'CV', 'APOSTILLE', 'NOTARIZATION', 'CERTIFIED_TRANSLATION', 'RESIDENCE_CARD', 'VISA', 'ADMISSION_LETTER',
  'APPLICATION_FORM', 'PARENT_ID', 'PORTFOLIO', 'RESEARCH_PROPOSAL', 'CONSENT_FORM', 'OTHER',
];
export type DocumentStatus = 'MISSING' | 'UPLOADED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'NEEDS_CORRECTION' | 'VERIFIED' | 'EXPIRED';
export type LegalizationPath = 'NONE' | 'APOSTILLE' | 'CONSULAR_LEGALIZATION' | 'ISSUER_VERIFICATION' | 'UNKNOWN';
export type LegalizationStatus = 'NOT_REQUIRED' | 'REQUIRED' | 'IN_PROGRESS' | 'COMPLETED';

export type ApplicationStatus =
  | 'DRAFT' | 'PROFILE_REVIEW' | 'DOCUMENT_PREPARATION' | 'READY' | 'SUBMITTED' | 'UNIVERSITY_REVIEW' | 'ADDITIONAL_DOCUMENTS'
  | 'INTERVIEW' | 'OFFERED' | 'WAITLISTED' | 'REJECTED' | 'OFFER_ACCEPTED' | 'TUITION_PENDING' | 'TUITION_PAID'
  | 'ADMISSION_CERTIFICATE_PENDING' | 'ADMISSION_CERTIFICATE_ISSUED' | 'VISA_PREPARATION' | 'VISA_SUBMITTED' | 'VISA_ISSUED'
  | 'ENROLLED' | 'WITHDRAWN';
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'DRAFT', 'PROFILE_REVIEW', 'DOCUMENT_PREPARATION', 'READY', 'SUBMITTED', 'UNIVERSITY_REVIEW', 'ADDITIONAL_DOCUMENTS', 'INTERVIEW',
  'OFFERED', 'WAITLISTED', 'REJECTED', 'OFFER_ACCEPTED', 'TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_PENDING',
  'ADMISSION_CERTIFICATE_ISSUED', 'VISA_PREPARATION', 'VISA_SUBMITTED', 'VISA_ISSUED', 'ENROLLED', 'WITHDRAWN',
];

export type PipelineStage =
  | 'NEW_LEAD' | 'PROFILE_INCOMPLETE' | 'QUALIFIED' | 'SERVICE_PURCHASED' | 'ASSIGNED' | 'DOCUMENT_PREPARATION' | 'READY_TO_APPLY'
  | 'APPLIED' | 'INTERVIEW' | 'OFFERED' | 'REJECTED' | 'WAITLISTED' | 'TUITION_PENDING' | 'ENROLLED' | 'VISA_PREPARATION'
  | 'VISA_ISSUED' | 'ARRIVAL_PREPARATION' | 'ARRIVED' | 'ACTIVE_STUDENT' | 'GRADUATED' | 'WITHDRAWN';
export const PIPELINE_STAGES: PipelineStage[] = [
  'NEW_LEAD', 'PROFILE_INCOMPLETE', 'QUALIFIED', 'SERVICE_PURCHASED', 'ASSIGNED', 'DOCUMENT_PREPARATION', 'READY_TO_APPLY', 'APPLIED',
  'INTERVIEW', 'OFFERED', 'REJECTED', 'WAITLISTED', 'TUITION_PENDING', 'ENROLLED', 'VISA_PREPARATION', 'VISA_ISSUED',
  'ARRIVAL_PREPARATION', 'ARRIVED', 'ACTIVE_STUDENT', 'GRADUATED', 'WITHDRAWN',
];

export type EssayType = 'PERSONAL_STATEMENT' | 'STUDY_PLAN' | 'CV' | 'RECOMMENDATION';
export type EssayStatus = 'DRAFT' | 'SUBMITTED' | 'AI_PRECHECK' | 'AGENCY_REVIEW' | 'CHANGES_REQUESTED' | 'STUDENT_REVISION' | 'FINAL_REVIEW' | 'APPROVED';
export type VisaType = 'D-2-1' | 'D-2-2' | 'D-2-3' | 'D-2-4' | 'D-2-5' | 'D-2-6' | 'D-2-7' | 'D-2-8' | 'D-4-1' | 'OTHER';
export type VisaStatus =
  | 'NOT_STARTED' | 'ELIGIBILITY_CHECK' | 'WAITING_FOR_ADMISSION' | 'DOCUMENT_PREPARATION' | 'READY_TO_APPLY' | 'SUBMITTED'
  | 'ADDITIONAL_DOCUMENTS' | 'APPROVED' | 'ISSUED' | 'REJECTED';
export const VISA_STATUSES: VisaStatus[] = ['NOT_STARTED', 'ELIGIBILITY_CHECK', 'WAITING_FOR_ADMISSION', 'DOCUMENT_PREPARATION', 'READY_TO_APPLY', 'SUBMITTED', 'ADDITIONAL_DOCUMENTS', 'APPROVED', 'ISSUED', 'REJECTED'];
export type HousingStatus = 'NOT_STARTED' | 'RESEARCHING' | 'DORM_APPLYING' | 'DORM_CONFIRMED' | 'OFF_CAMPUS_SEARCH' | 'CONTRACT_REVIEW' | 'CONFIRMED';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskType =
  | 'DOCUMENT_UPLOAD' | 'DOCUMENT_REVIEW' | 'ESSAY_WRITE' | 'ESSAY_REVIEW' | 'APPLICATION_DEADLINE' | 'APPLICATION_SUBMIT' | 'INTERVIEW'
  | 'TUITION_PAYMENT' | 'VISA_STEP' | 'DORM_APPLICATION' | 'ARRIVAL_STEP' | 'SCHOLARSHIP_DEADLINE' | 'PROFILE' | 'CONSULTATION'
  | 'UNIVERSITY_REQUEST' | 'SLA_FOLLOW_UP' | 'FRESHNESS_REVIEW' | 'GENERAL';
export type ScholarshipKind = 'UNIVERSITY' | 'GOVERNMENT' | 'HANGYUL_PARTNER' | 'OTHER';
export type MatchTier = 'STRONG' | 'COMPETITIVE' | 'REACH' | 'NOT_ELIGIBLE';
export type JourneyStage = 'EXPLORE' | 'PROFILE' | 'MATCH' | 'APPLY' | 'DECISION' | 'ENROLL' | 'VISA' | 'ARRIVAL' | 'STUDENT_LIFE';

export interface Page<T> { items: T[]; total: number; page: number; page_size: number; }

export interface Freshness {
  source_url: string | null;
  verified_at: ISODateTime | null;
  verification_status: VerificationStatus | string | null;
  effective_from?: ISODate | null;
  effective_to?: ISODate | null;
}

// ---------- auth ----------
export interface Membership { org_id: UUID; org_type: OrgType; org_name: string; role: Role; university_id: UUID | null; }
export interface SessionUser { id: UUID; email: string; full_name: string; preferred_name: string | null; locale: string; timezone: string; is_demo: boolean; }
export interface Session {
  user: SessionUser;
  roles: Role[];
  memberships: Membership[];
  active_org: Membership | null;
  /** V22: whether the account's email and mobile number have been verified by a one-time code. */
  verified?: { email: boolean; phone: boolean };
}
export interface TokenResponse extends Session { access_token: string; refresh_token: string; token_type: 'bearer'; expires_in: number; }

// ---------- V22 identity & registration ----------
export interface ConsentCatalogueItem { key: string; required: boolean; version: string; document: string | null; basis: string }
export interface SignupConfig {
  captcha: { required: boolean; provider: 'turnstile' | null; site_key: string | null };
  otp: { ttl_seconds: number; resend_cooldown_seconds: number; max_attempts: number; delivery_mode: 'providers' | 'console' | 'blocked' };
  password: { min_length: number };
  consents: { items: ConsentCatalogueItem[]; purchase: ConsentCatalogueItem; policy_effective_on: string | null; canonical_locale: string };
}
export interface VerificationSent { challenge_id: string; channel: 'EMAIL' | 'SMS'; target_masked: string; expires_in: number; resend_in: number; delivery: 'sent' | 'console' }
export interface VerificationVerified { verified: true; channel: 'EMAIL' | 'SMS'; proof: string; proof_expires_in: number }
export interface RegisterBody {
  email: string; email_proof: string; phone: string; phone_country: string; phone_proof: string;
  password: string; password_confirm: string; full_name: string; locale: string; nationality?: string;
  consents: Record<string, boolean>;
}
/** Display identity of a message/comment author as the viewer may see it (V22, REPORT §246 A3). */
export interface AuthorIdentity { id: string; full_name: string; kind?: 'team' | 'staff' | 'student' }

// ---------- reference ----------
export interface Country {
  code: string; name_en: string; name_native: string | null; name_ko: string | null; region: string; default_locale: string; currency: string;
  is_priority_market: boolean; priority_rank: number | null; apostille_member: boolean | null; apostille_effective_from: ISODate | null;
  apostille_verified_at: ISODate | null; apostille_source_url: string | null; aliases: string[];
}
export interface LocaleInfo { code: string; name_en: string; name_native: string; direction: 'ltr' | 'rtl'; translation_status: string; }

// ---------- catalog ----------
export interface UniversityCard extends Freshness {
  id: UUID; slug: string; name_en: string; name_ko: string; institution_type: InstitutionType; region: string; city: string;
  is_partner: boolean; brand_color: string | null; photo?: UniversityPhotoRef | null; certification_status: string; est_living_cost_monthly_krw: number | null; summary: string | null;
  program_count?: number; saved_at?: ISODateTime; program_id?: UUID | null; note?: string | null;
}
export interface Intake extends Freshness {
  id: UUID; year: number; term: IntakeTerm; round: number; application_opens: ISODate | null; application_deadline: ISODate;
  document_deadline: ISODate | null; interview_window: string | null; decision_date: ISODate | null; tuition_deadline: ISODate | null;
  semester_start: ISODate | null; seats_international: number | null; is_open: boolean;
}
export interface Requirements extends Freshness {
  min_prior_education: string | null; min_gpa_percent: number | null; min_topik_level: number | null; min_ielts: number | null;
  min_toefl_ibt: number | null; language_alternative: boolean; requires_interview: boolean; requires_portfolio: boolean; notes: string | null;
}
export interface Program extends Freshness {
  id: UUID; university_id: UUID; name_en: string; name_ko: string | null; degree_level: DegreeLevel; field: string;
  instruction_language: InstructionLanguage; duration_semesters: number | null; tuition_per_semester_krw: number | null;
  application_fee_krw: number | null; description: string | null; requirements: Requirements | null;
  university?: UniversityCard; intakes?: Intake[]; next_intake?: Intake | null; estimated_annual_cost_krw?: number | null;
  /** V4: the one cost figure shown wherever a program appears (budget service; before scholarship). */
  first_year_range_krw?: FirstYearRange;
  required_documents?: { category: DocumentCategory; label: string; required: boolean; legalization_required: boolean; notes: string | null }[];
  applications?: number;
  /** University console (V8): false for programs the university no longer offers (or development fixtures). */
  is_active?: boolean;
}
export interface Dormitory extends Freshness {
  id: UUID; name: string; room_types: string[]; capacity: number | null; cost_per_semester_krw_min: number | null;
  cost_per_semester_krw_max: number | null; international_priority: boolean; meal_plan: boolean | null; application_note: string | null;
}
export interface ScholarshipEligibility { status: 'ELIGIBLE' | 'POSSIBLE' | 'NOT_ELIGIBLE'; checks: { ok: boolean | null; text: string; /** V9: rule code for localized text */ field?: string; operator?: string | null; value?: unknown }[]; }
export interface Scholarship extends Freshness {
  id: UUID; university_id: UUID | null; kind: ScholarshipKind; name: string; provider: string; description: string | null; coverage: string | null;
  tuition_waiver_percent_min: number | null; tuition_waiver_percent_max: number | null; amount_krw: number | null; degree_levels: string[];
  application_deadline: ISODate | null; is_automatic: boolean; rules: { field: string; operator: string; value: string; description: string }[];
  eligibility: ScholarshipEligibility | null; university_name?: string;
}
export interface RequiredDocument extends Freshness {
  category: DocumentCategory; label: string; required: boolean; legalization_required: boolean; translation_required: boolean;
  applies_to_nationalities: string[] | null; notes: string | null; max_age_days: number | null;
}
export interface UniversityDetail extends UniversityCard {
  website_url: string | null; international_admissions_url: string | null; founded_year: number | null; international_services: string[];
  certification_source_url: string | null; certification_verified_at: ISODate | null; location: { latitude: number | null; longitude: number | null };
  campuses: { id: UUID; name: string; city: string; address: string | null; is_main: boolean }[];
  programs: Program[]; dormitories: Dormitory[]; scholarships: Scholarship[]; required_documents: RequiredDocument[];
  deadlines: (Intake & { program_id: UUID; program: string; degree_level: DegreeLevel })[];
  partner: { active: boolean; benefits: string[]; guarantee_available: boolean; guarantee_terms: string | null; is_demo: boolean | null };
  outcomes: null | Record<string, unknown>;
}

// ---------- matching ----------
export interface MatchReason { kind: 'met' | 'missing' | 'warning' | 'info'; code: string; text: string; params: Record<string, unknown>; }
export interface MatchFactor { factor: string; weight: number; points: number; note: string; }
// ---------- quick eligibility (anonymous) ----------
export type QuickLanguageKind = 'TOPIK' | 'IELTS' | 'TOEFL_IBT' | 'NONE' | 'PREPARING';
export type QuickTier = 'STRONG' | 'POSSIBLE' | 'NOT_YET';
export interface QuickEligibilityInput { nationality: string; degree: DegreeLevel; language: { kind: QuickLanguageKind; level?: number } }
export interface QuickEligibilityResult {
  engine_version: string; total_open: number; meets_count: number; possible_count: number; not_yet_count: number;
  unlock: { kind: 'TOPIK' | 'IELTS'; level: number; additional_count: number } | null;
  sample: { program_id: UUID; program_name: string; university_name: string; university_slug: string; city: string; degree_level: DegreeLevel;
    tier: QuickTier; yearly_cost_krw: number | null; deadline: ISODate | null; reason: string; reason_code: string }[];
  data_quality: { status: 'SAMPLE' | 'MIXED' | 'VERIFIED'; note: string };
}
export interface Match {
  program_id: UUID; intake_id: UUID | null; eligible: boolean; tier: MatchTier; score: number; reasons: MatchReason[]; factors: MatchFactor[];
  estimated_annual_cost_krw: number | null; scholarship_ids: UUID[]; guarantee: { contract_id: UUID; terms: string | null; seats_left: number } | null;
  engine_version: string; program: Program; intake: Intake | null; recommended?: boolean;
  first_year_range_krw?: FirstYearRange;
}
export interface MatchResponse { engine_version: string; profile_percent: number; counts: Record<MatchTier, number>; items: Match[]; methodology: string; }

// ---------- student ----------
export interface Education {
  id: UUID; level: string; institution: string; country: string; major: string | null; start_year: number | null; graduation_year: number | null;
  graduation_status: string; gpa_value: number | null; gpa_scale_min: number | null; gpa_scale_max: number | null; gpa_percent: number | null;
  gpa_override_note: string | null;
}
export interface LanguageScore { id: UUID; test: LanguageTest; score: number; test_date: ISODate | null; expires_on: ISODate | null; is_planned: boolean; verified: boolean; }
export interface ProfileStep { key: string; done: boolean; }
export interface StudentProfile {
  id: UUID; nationality: string | null; residence_country: string | null; date_of_birth: ISODate | null; gender: string | null;
  has_passport: boolean | null; passport_number_masked: string | null; passport_expiry: ISODate | null; target_degree: DegreeLevel | null;
  target_intake_year: number | null; target_intake_term: IntakeTerm | null; desired_fields: string[]; preferred_regions: string[];
  preferred_university_ids: string[]; annual_budget_krw: number | null; needs_scholarship: boolean | null; housing_preference: string | null;
  korean_self_level: string | null; english_self_level: string | null; previous_korean_visa: string | null; current_korean_visa: string | null;
  in_korea_now: boolean | null; financial_sponsor: string | null; academic_priorities: string[]; career_goal: string | null;
  onboarding_step: number; onboarding_completed: boolean; pipeline_stage: PipelineStage; educations: Education[]; languages: LanguageScore[];
  is_demo: boolean; completion?: { percent: number; steps: ProfileStep[] };
}
export interface NextAction { code: string; title: string; link: string; params: Record<string, unknown>; }
export interface DeadlineItem { kind: string; title: string; title_key?: string | null; title_params?: Record<string, unknown> | null; date: ISODate; link: string | null; /** V4 */ application_id?: UUID | null; application_label?: string | null; }
export interface ChecklistItem {
  requirement_id: UUID; category: DocumentCategory; label: string; required: boolean; legalization_required: boolean; translation_required: boolean;
  notes: string | null; document_id: UUID | null; status: DocumentStatus; ready: boolean; reused: boolean; action_code: string | null;
  action: string | null; verification_status: string; shared_with_university?: boolean; application_id?: UUID; university?: string;
  /** V5 i18n: params for translating `action` from `action_code` (university, days, issued, path_code, country, reason). */
  action_params?: Record<string, unknown> | null;
  /** Set when the item is an explicit university document request (action_code 'UNIVERSITY_REQUEST'). */
  request_id?: UUID; due_date?: ISODate | null;
  /** V4: when a document has been waiting for its first review, and whether that is past the 48 h target. */
  review_since?: ISODateTime | null; review_overdue?: boolean | null;
  /** V27 (REPORT §357): what the official guide says about this document, with its evidence. */
  name_ko?: string | null; condition?: string | null; applies?: boolean | null;
  original_or_copy?: 'ORIGINAL' | 'COPY' | 'EITHER' | null; submission_method?: string | null;
  notarization_required?: boolean; legalization_rule?: string | null; max_age_days?: number | null;
  /** Decided on the server from the issuing country and the date (`readiness.treatment`). */
  treatment?: RequirementTreatment;
  source?: { url: string | null; page: string | null; evidence: string | null; verified_at: string | null } | null;
}
export interface RequirementTreatment {
  legalization: 'NONE' | 'APOSTILLE' | 'CONSULAR' | 'CHINA_CHSI' | 'STAFF_REVIEW' | 'UNSPECIFIED';
  legalization_done: boolean; translation: boolean; notarization: boolean;
  country: string | null; country_basis: 'document' | 'nationality' | null;
}
/** V27: which official admission guide an application's checklist is built from (`services/guides.state_for`). */
export interface AdmissionGuideState {
  state: 'CURRENT' | 'PREVIOUS_ROUND' | 'REVIEW_REQUIRED';
  code: 'ADMISSION_GUIDE_REVIEW_REQUIRED' | null; blocks: boolean;
  guide: { id: string; title: string | null; intake_year: number; term: string; degree_level: string; status: string;
    source_url: string | null; source_page_url: string | null; publication_date: string | null; verified_at: string | null;
    application_opens: string | null; application_closes: string | null; document_deadline: string | null } | null;
}
export interface Dashboard {
  greeting_name: string;
  journey: { stage: JourneyStage; stages: JourneyStage[] };
  profile: { percent: number; steps: ProfileStep[]; onboarding_completed: boolean };
  readiness: { percent: number; basis: string; applications: number };
  next_action: NextAction;
  deadlines: DeadlineItem[];
  recommendations: Match[];
  /** STRONG = requirements met; POSSIBLE = none met yet, closest programs with their exact gap; NONE = nothing to show. */
  recommendations_kind?: 'STRONG' | 'POSSIBLE' | 'NONE';
  applications: Application[];
  missing_documents: ChecklistItem[];
  document_counts: Partial<Record<DocumentStatus, number>>;
  counselor: { organization: string; organization_id: UUID; counselor: PublicUser | null; languages: string[]; since: ISODateTime } | null;
  unread_messages: number;
  scholarships: { eligible: number; possible: number; top: { id: UUID; name: string; kind: ScholarshipKind; coverage: string | null }[] };
  visa: { status: VisaStatus; visa_type: VisaType; id: UUID } | null;
  arrival: { arrival_at: ISODateTime | null; completed: number; arrived: boolean } | null;
  cost_estimate: { tuition_year_krw: number; living_year_krw: number; application_fee_krw: number | null; basis: string; is_estimate: boolean; verification_status: string } | null;
  open_tasks: number;
  /** V5: arrival/settlement stage once admitted (null before admission). */
  concierge?: { stage: 'ADMITTED' | 'READY_TO_COME' | 'ARRIVED' | 'SETTLED'; title_key: string; next: { key: string; link: string; title_key: string } | null;
    done: number; total: number; residence_card_due: ISODate | null } | null;
  /** V5: "What you can do today" — top student-owned improvements across applications (strategy items). */
  improve?: (StrategyItem & { application_id: UUID; university: string; deadline: ISODate | null })[];
  /** V5: dossier nudges (details to check, a newer copy needed). */
  dossier?: { code: string; title_key: string; params: Record<string, unknown>; link: string }[];
}
export interface PublicUser { id: UUID; full_name: string; }

// ---------- applications ----------
export interface Application {
  id: UUID; status: ApplicationStatus; readiness_percent: number; submitted_at: ISODateTime | null; decided_at: ISODateTime | null;
  external_reference: string | null; flagged: boolean; university_reviewer_id?: string | null; flag_reason: string | null; interview_at: ISODateTime | null;
  offer_scholarship_note: string | null; tuition_amount_krw: number | null; tuition_due: ISODate | null;
  program: { id: UUID; name_en: string; degree_level: DegreeLevel; field: string; instruction_language: InstructionLanguage };
  university: { id: UUID; name_en: string; name_ko: string; slug: string; city: string; brand_color: string | null; photo?: UniversityPhotoRef | null };
  intake: { id: UUID; year: number; term: IntakeTerm; application_deadline: ISODate; semester_start: ISODate | null };
  agency_org_id: UUID | null; student: { id: UUID; full_name: string; nationality: string | null } | null;
  updated_at: ISODateTime; created_at: ISODateTime; is_demo: boolean;
  /** University console list rows only: applicant vs. published minimums, and open document requests. */
  eligibility?: { status: 'MEETS' | 'BELOW' | 'TO_CHECK' | 'UNKNOWN'; below: string[]; unknown: string[] } | null;
  open_document_requests?: number;
  /** V4 university list rows: answered requests, and required documents verified / shared ("8/8 verified"). */
  returned_document_requests?: number;
  documents?: { required: number; verified: number; shared: number } | null;
  /** V8: "administrative check complete" (audited; never a decision). University/Hangyul views only. */
  admin_check?: { checked_at: ISODateTime; by: string | null; note?: string | null } | null;
}
export interface ApplicationHistoryItem { from: ApplicationStatus | null; to: ApplicationStatus; at: ISODateTime; actor: string; actor_org_type: string | null; note: string | null; }
export interface ApplicationDetail extends Application {
  checklist: ChecklistItem[]; history: ApplicationHistoryItem[]; allowed_transitions: ApplicationStatus[];
  admission_guide?: AdmissionGuideState;
  /** V29: in the managed-application set only when the current intake's guide is verified and complete. */
  managed_support?: { state: 'SUPPORTED' | 'ADMISSION_GUIDE_REVIEW_REQUIRED'; missing: string[] };
  essays: { id: UUID; title: string; essay_type: EssayType; status: EssayStatus; due_date: ISODate | null }[];
  agency: { id: UUID; name: string } | null;
  document_requests?: DocumentRequest[];
  student_profile?: { nationality: string | null; residence_country: string | null; education: { level: string; institution: string; country: string; gpa_percent: number | null; graduation_status: string }[]; languages: { test: LanguageTest; score: number; is_planned: boolean; verified: boolean }[] };
}

// ---------- documents ----------
export interface DocumentFile { filename: string; mime_type: string; size_bytes: number; scan_status: string; uploaded_at: ISODateTime; }
export interface LegalizationInfo {
  path: LegalizationPath; requires_notarization?: boolean; requires_translation?: boolean; steps: { key: string; title: string; detail?: string }[];
  note: string | null; verified: boolean; verification_status?: string; verified_at?: string | null; effective_from?: string | null; source_url?: string | null;
  /** V5 i18n: translatable form of `note` (JOINS | JOINED | UNVERIFIED) with {country, date}. */
  note_code?: string | null; note_params?: Record<string, string | null> | null;
}
export interface VaultDocument {
  id: UUID; owner_user_id: UUID; category: DocumentCategory; title: string; issuing_country: string | null; issue_date: ISODate | null;
  expires_on: ISODate | null; language: string | null; translation_required: boolean; legalization_path: LegalizationPath;
  legalization_status: LegalizationStatus; legalization_progress: string[]; status: DocumentStatus; reviewer_user_id: UUID | null;
  rejection_reason: string | null; reusable: boolean; current_version: number; latest_file: DocumentFile | null;
  versions: { version: number; filename: string; uploaded_at: ISODateTime; size_bytes: number }[]; updated_at: ISODateTime; is_demo: boolean;
  owner_name?: string; owner_nationality?: string | null; waiting_hours?: number;
  /** Review queue (V3): SLA target, whether it is exceeded, and who is assigned to review it. */
  sla_hours?: number; over_sla?: boolean; assigned_reviewer?: PublicUser | null;
  reviews?: { decision: string; reason: string | null; version: number; checks: unknown; at: ISODateTime; reviewer: string }[];
  legalization?: LegalizationInfo | null; used_in_applications?: { application_id: UUID; shared_with_university: boolean; /** V4 */ university?: string | null }[];
}

// ---------- essays ----------
export interface EssayComment {
  id: UUID; version: number; author: PublicUser | null; anchor_start: number | null; anchor_end: number | null; quote: string | null;
  body: string; suggestion: string | null; visibility: 'PARTICIPANTS' | 'INTERNAL'; resolved: boolean; at: ISODateTime;
}
export interface EssaySummary {
  id: UUID; owner_user_id: UUID; title: string; essay_type: EssayType; status: EssayStatus; prompt: string | null; word_limit: number | null;
  due_date: ISODate | null; current_version: number; application_id: UUID | null; reviewer: PublicUser | null; word_count: number;
  updated_at: ISODateTime; open_comments: number; owner_name?: string;
  /** V5 writing review block (server/app/services/writing.py `essay_block`). */
  writing?: WritingBlock;
}
export interface Essay extends EssaySummary {
  body: string; precheck: { level: 'ok' | 'warning' | 'error'; code: string; text: string }[];
  versions: { version: number; at: ISODateTime; author: PublicUser | null; note: string | null; word_count: number }[];
  comments: EssayComment[]; allowed_transitions: EssayStatus[];
}

// ---------- tasks / messages / notifications ----------
export interface Task {
  id: UUID; title: string; title_key?: string | null; title_params?: Record<string, unknown> | null; description: string | null; task_type: TaskType; priority: TaskPriority; status: TaskStatus; due_at: ISODateTime | null;
  overdue: boolean; owner: PublicUser | null; owner_org_id: UUID | null; student_id: UUID | null; application_id: UUID | null; source: string;
  link: string | null; completed_at: ISODateTime | null; created_at: ISODateTime; depends_on_id: UUID | null; student_name?: string | null; university?: string;
  /** V3: whether the student sees (and owns) this task, and the task it waits on. */
  visible_to_student?: boolean;
  depends_on?: { title: string; title_key: string | null; title_params: Record<string, unknown>; done: boolean } | null;
  /** V4 (staff only): status of the linked application, to say who the task is waiting on. */
  application_status?: ApplicationStatus | null;
}
export interface ConversationSummary {
  id: UUID; kind: string; subject: string; student: PublicUser | null; application_id: UUID | null; last_message_at: ISODateTime | null;
  last_message: { body: string; internal: boolean; author: PublicUser | null } | null; unread: number;
  /** V4 (staff only): the student wrote last and is waiting for a reply; the related application. */
  awaiting_reply?: boolean; application?: { id: UUID; university: string | null; status: ApplicationStatus } | null;
}
export interface ChatMessage {
  id: UUID; body: string; internal: boolean; at: ISODateTime; author: PublicUser | null; mine: boolean; mentions: string[];
  created_task_id: UUID | null; attachment_document_id: UUID | null;
  /** Private files attached to the message (V3). Attachments on internal notes are never returned to students. */
  attachments?: MessageAttachment[];
  /** Delivery channel. Only IN_APP is live; EMAIL / KAKAO / WHATSAPP / SMS are reserved for future connectors. */
  channel?: 'IN_APP' | 'EMAIL' | 'KAKAO' | 'WHATSAPP' | 'SMS';
}
export interface MessageAttachment { id: UUID; filename: string; mime_type: string; size_bytes: number; }
export interface ConversationDetail { id: UUID; subject: string; kind: string; student: PublicUser | null; messages: ChatMessage[]; application_id: UUID | null; }
export interface NotificationItem { id: UUID; kind: string; title_key: string; params: Record<string, unknown>; text: string; link: string | null; read: boolean; at: ISODateTime; }

// ---------- visa / housing / arrival ----------
export interface VisaChecklistItem {
  key: string; title: string; detail: string | null; document_category: string | null; required: boolean; done: boolean; blocked: boolean;
  depends_on: string[]; country_specific: boolean; source_url: string | null; verified_at: string | null; verification_status: string;
  /** V4 student presentation: the requirement's name, and the sourced rule as its explanation. */
  name?: string; name_key?: string | null; rule?: string | null;
  /** V5 visa routes: status of a researched-route item, whether the student can tick it (university paper), who provides it. */
  route_status?: string; toggle?: boolean; who?: string;
}
export interface VisaCase {
  id: UUID; student_id: UUID; student_name: string; visa_type: VisaType; visa_type_reason: string | null; status: VisaStatus; consulate: string | null;
  submitted_on: ISODate | null; issued_on: ISODate | null; expires_on: ISODate | null; target_entry_date: ISODate | null; notes: string | null;
  blockers: string[]; application_id: UUID | null; university: string | null; checklist: VisaChecklistItem[]; progress: number; disclaimer: string;
  /** V5: one-line summary of the researched route (null fields when no verified route). */
  route?: { status: string; visa_type: string | null; verification_status: string | null; verified_at: string | null; source_url: string | null;
    post: { key: string; city: string; name_en: string; kind: string } | null; method: string | null; needs_answer: boolean; display_status: string;
    pack: { needed: number; ready: number; all_ready: boolean } | null };
}
export interface HousingInfo {
  case: { status: HousingStatus; preference: string | null; budget_monthly_krw: number | null; room_preference: string | null; max_commute_minutes: number | null; dormitory_id: UUID | null; application_deadline: ISODate | null; completed_items: string[]; notes: string | null } | null;
  checklist: string[];
  university: { id: UUID; name_en: string; slug: string; est_living_cost_monthly_krw: number | null } | null;
  dormitories: (Dormitory & { source_url: string | null })[];
  off_campus_note: string;
}
export interface ArrivalInfo {
  plan: { flight_number: string | null; arrival_airport: string | null; arrival_at: ISODateTime | null; pickup_requested: boolean; pickup_status: string | null; completed_items: string[]; arrived_at: ISODateTime | null; residence_card_due: ISODate | null } | null;
  checklist: string[];
  notes: Record<string, string>;
  sources: string[];
}

// ---------- services ----------
export interface ServiceProduct {
  code: string; name_key: string; name_en: string; name_ko: string | null; tagline_en: string | null; features: string[];
  /** V15: machine-readable scope. `features` is display only — see packages/types/src/plans.ts. */
  entitlements: PlanEntitlements;
  recommended: boolean;
  price: { id: UUID; currency: string; amount_minor: number; is_demo: boolean } | null;
}
export interface ServicesResponse {
  products: ServiceProduct[]; owned: string[]; plan: StudentPlan | null;
  /** V16: which provider is configured, and the one order (if any) still waiting to be paid. */
  payment?: { provider: string; pending_order_id: UUID | null };
  /** V16: compact purchase history — inside this screen, never a new destination (brief Part 24). */
  history?: OrderRow[];
  /** V26: what each included service is doing now (empty without a plan). */
  now?: ServiceNowLine[];
  /** V29: the catalogue the page sells from, and whether an upgrade can be priced (it cannot until the owner decides). */
  catalog?: { version: string; effective_from: string };
  upgrade_policy?: { status: string; kind: string; usage_rule: string };
}
export interface OrderRow {
  id: UUID; product_name: string; product_code: string; status: string; amount_minor: number; currency: string; at: string | null;
  /** V29: PLAN · UPGRADE · ADD_ON, and the catalogue version the receipt was sold under. */
  kind?: 'PLAN' | 'UPGRADE' | 'ADD_ON'; catalog_version?: string | null;
}

/**
 * Everything the browser needs to open the provider's own window — and nothing it needs to decide the
 * outcome. There is no secret here and no status: `amount` is the server's canonical figure, echoed back so
 * the SDK can be called with it, and the server re-derives it from the order before it confirms anything.
 */
export interface TossCheckout {
  sdk: string; client_key: string; customer_key: string;
  order_id: string; order_name: string;
  amount: { value: number; currency: string };
  success_url: string; fail_url: string; env: string;
}
export interface OrderResult {
  order_id: UUID; status: string; provider: string; redirect_url: string | null; is_demo_payment: boolean;
  assignment: { organization: string; organization_id: UUID } | null;
  /**
   * V21 — the server's number, for the card form to print. The browser displays it and never sends
   * it back: the amount charged is read from the Order row.
   */
  amount_minor?: number; currency?: string; product_code?: string; product_name?: string;
  /** True when this server takes the card itself (no provider window). See `PaymentsConfig`. */
  card_form?: boolean;
  checkout?: TossCheckout | null;
  customer?: { name: string; email: string } | null;
}
export interface PaymentResult {
  order_id: UUID; status: string; product_code: string; product_name: string;
  amount_minor: number; currency: string; paid_at: string | null;
  method: string | null; receipt_url: string | null;
  assignment?: { organization: string; organization_id: UUID } | null;
}

// ---------- agency ----------
export interface AgencyStudentRow {
  id: UUID; full_name: string; email: string; nationality: string | null; residence_country: string | null; target_degree: DegreeLevel | null;
  target_intake: string | null; pipeline_stage: PipelineStage; profile_percent: number; counselor: PublicUser | null; organization_id: UUID | null;
  assigned_at: ISODateTime | null; open_tasks: number; overdue_tasks: number; applications: number; documents_to_review: number;
  sla_first_response_due: ISODateTime | null; sla_breached: boolean; updated_at: ISODateTime; is_demo: boolean;
  /** Operational columns (additive). */
  next_task?: { id: string; title: string; title_key: string | null; title_params: Record<string, unknown> | null; task_type: TaskType; due_at: ISODateTime | null; overdue: boolean } | null;
  next_deadline?: { date: string; university: string; university_ko?: string | null } | null;
  top_university?: { name: string; name_ko?: string | null; status: ApplicationStatus } | null;
  documents_to_fix?: number; documents_verified?: number; documents_total?: number;
  waiting_on_university?: number;
  /** V9: who the case waits on (docs/STATE_MAP.md, server services/waiting.py). Legacy `us` only in filters. */
  waiting_on?: AgencyWaitingParty | null;
  /** The one reason behind `waiting_on` (docs/STATE_MAP.md). */
  waiting_reason?: AgencyWaitingReason | null;
  /** V9: who exactly holds the next action, and that action in their voice. */
  waiting_owner?: AgencyWaitingOwner | null;
  next_action?: AgencyNextAction | null;
  /** V9: the V4–V8 value for old clients (counselor/agency/hangyul → us). */
  waiting_on_legacy?: 'us' | 'student' | 'university' | 'external' | null;
  student_replied?: boolean;
  last_activity_at?: ISODateTime | null;
  /** V26 (REPORT §341): the exact records behind the row's work — a queue row opens the item, not the student. */
  targets?: AgencyRowTargets;
}
export interface WorkspaceRequest { id: UUID; label: string; note: string; category: string | null; due_date: ISODate | null; requested_at: ISODateTime }
/** V26 (REPORT §334 S3): one included service, as it stands now — read from the records that prove it. */
export interface ServiceNowLine {
  key: string;
  state: 'ACTIVE' | 'YOU' | 'LATER' | 'DONE' | 'AVAILABLE';
  owner: 'TEAM' | 'STUDENT' | 'UNIVERSITY';
  items: {
    label: string; sub: string | null; status: string | null; link: string; counted?: boolean;
    /** V29: an institution is sent as its id and both names, never one stored display string. */
    university_id?: string; name_en?: string; name_ko?: string | null; sub_ko?: string | null; user_content?: boolean;
  }[];
  next: { code: string; link: string; params?: Record<string, string>; names?: { name_en: string; name_ko: string | null } } | null;
  when: string | null;
  usage?: EntitlementUse; counts?: { review: number; fix: number; verified: number };
  /** V29: the graded level behind a line (who does the work), and the plan's support window. */
  level?: string; scope?: string | null;
  support_window_type?: string | null; support_window_days?: number | null; follow_up_level?: string | null;
}
export interface AgencyRowTargets {
  /** An open university request; `id` is null when the university only moved the application to ADDITIONAL_DOCUMENTS. */
  request?: { id: string | null; application_id: string };
  reply_thread?: string; thread?: string; review_doc?: string; fix_doc?: string; essay?: string; deadline_app?: string; task?: string; app?: string;
}
export type AgencyViewKey = 'all' | 'mine' | 'attention' | 'waiting_student' | 'waiting_us' | 'university' | 'incomplete' | 'docs' | 'deadline' | 'visa' | 'arrived'
  /** V4 */ | 'waiting_external' | 'requested'
  /** V8 operational views */ | 'urgent' | 'deadline7' | 'student_silent' | 'visa_blocked' | 'new_paid' | 'unassigned'
  /** V9 waiting views */ | 'waiting_counselor' | 'waiting_agency' | 'waiting_hangyul';
export interface AgencySavedView {
  id: UUID; name: string; scope: 'PERSONAL' | 'TEAM'; filters: Record<string, unknown>; columns: string[] | null; sort: string | null;
  owner_user_id: UUID; mine: boolean; can_edit: boolean; updated_at: ISODateTime;
}
export type TemplateKind = 'DOCUMENT_CORRECTION' | 'APOSTILLE' | 'ESSAY_FEEDBACK' | 'DEADLINE_REMINDER' | 'UNIVERSITY_REQUEST' | 'VISA_REMINDER'
  | /** V9 */ 'PAYMENT' | 'ARRIVAL' | 'HOUSING' | 'GENERAL';
export interface MessageTemplate {
  id: UUID; title: string; body: string; kind: TemplateKind; scope: 'PERSONAL' | 'TEAM' | 'ORG'; locale: string; mine: boolean; can_edit: boolean; updated_at: ISODateTime;
  /** V9: language variants of one template share a group key. */
  group_key?: string;
}
export interface AgencyToday {
  overdue_tasks: { count: number; oldest: { title: string; title_key: string | null; title_params: Record<string, unknown> | null; student: string | null; due_at: ISODateTime | null } | null; queue: string };
  documents_waiting: { count: number; over_sla: number; sla_hours: number; oldest: { title: string; student: string | null; since: ISODateTime } | null; queue: string };
  student_replies: { count: number; queue: string; /** V4 */ conversations?: number; oldest?: { student: string | null; since: ISODateTime | null } | null };
  closing_soon: { count: number; /** V4 */ students?: number; next: { university: string; deadline: ISODate; student: string | null } | null; queue: string };
  sla_risk: { count: number; breached: number; next: { student: string | null; due_at: ISODateTime | null } | null; queue: string };
  /** V4 */
  university_requests?: { count: number; queue: string };
  /** V5: essay reviews (SLA), service cases (pickup, housing, residence card, visa support), document checks — one Today. */
  writing_reviews?: { count: number; overdue: number; revised: number; queue: string; revised_queue: string;
    oldest: { kind: string; title: string; essay_type: string; student: { id: string; name: string }; university: string | null; due_at: string | null; reviewer: string | null; link: string } | null };
  service_cases?: { count: number; view: string | null; overdue: number; queue: string;
    oldest: { type: string; reason: string; title_key: string; params: Record<string, unknown>; student: string | { name?: string } | null; due_at: string | null; link: string } | null };
  visa_cases?: { count: number; overdue: number; queue: string;
    oldest: { reason: string; title_key: string; params: Record<string, unknown>; student: { id: string; full_name: string }; due_at: string | null; overdue: boolean; link: string } | null };
  document_checks?: { count: number; queue: string; oldest: { student_name: string; category: string; title: string; title_key: string; title_params: Record<string, unknown>; link: string } | null };
  waiting_on?: Partial<Record<AgencyWaitingParty | 'us', number>>;
}
/** V9: the seven waiting parties (server services/waiting.py). */
export type AgencyWaitingParty = 'counselor' | 'agency' | 'hangyul' | 'student' | 'university' | 'external';
/** Why a case is waiting on someone (V9 reason codes; `app`/`app_university` carry the application status). */
export interface AgencyWaitingReason { code: string; count?: number; status?: ApplicationStatus }
export interface AgencyWaitingOwner { kind: 'person' | 'agency' | 'hangyul' | 'student' | 'university' | 'embassy' | 'rail' | 'provider'; id?: string; name: string | null }
export interface AgencyNextAction {
  party: AgencyWaitingParty; code: string; params: { count?: number; status?: ApplicationStatus | null; university?: string };
  task: { id: string; title: string; title_key: string | null; title_params: Record<string, unknown> | null; due_at: ISODateTime | null; overdue: boolean } | null;
}
export interface AgencyIdentity {
  agency_id: UUID; trading_name: string; legal_name: string | null; country_code: string | null;
  registration: { status: 'NOT_RECORDED' | 'RECORDED' | 'VERIFIED'; number: string | null; authority: string | null; checked_on: ISODate | null };
  responsible_counselor: { id: UUID; name: string } | null; sub_agent: string | null; note: string;
}
export interface StudentWorkspace {
  student: { id: UUID; full_name: string; preferred_name: string | null; email: string; locale: string; phone: string | null };
  profile: StudentProfile; profile_percent: number;
  assignment: { organization_id: UUID; organization: string; counselor: PublicUser | null; assigned_by: string; score: number | null; score_breakdown: MatchFactor[] | null; since: ISODateTime; first_response_due_at: ISODateTime | null; first_response_at: ISODateTime | null } | null;
  applications: (Application & { /** V9 */ waiting_on?: AgencyWaitingParty | null; waiting_reason?: { code: string } | null; items_remaining?: number; items_in_review?: number;
    /** V15: one readiness state and its named blockers — never a score (brief Part 10). */ readiness?: ApplicationReadiness;
    /** V26: the university's open document requests on this application, in its own words (REPORT §341). */ requests?: WorkspaceRequest[] })[]; documents: VaultDocument[];
  /** V26: the exact records behind the case's work (same as the caseload row). */ targets?: AgencyRowTargets;
  /** V9 */ waiting_on?: AgencyWaitingParty | null; waiting_reason?: AgencyWaitingReason | null;
  /** V9 */ waiting_owner?: AgencyWaitingOwner | null; next_action?: AgencyNextAction | null; next_deadline?: { date: string; university: string; university_ko?: string | null } | null;
  /** V9 (REPORT §59 A12) */ agency_identity?: AgencyIdentity | null;
  /** V15: what the student bought, what is promised, what is left (REPORT §119). */ plan?: StudentPlan | null;
  essays: { id: UUID; title: string; status: EssayStatus; essay_type: EssayType; due_date: ISODate | null }[];
  visa_cases: { id: UUID; visa_type: VisaType; status: VisaStatus }[];
  services: { code: string; name: string; paid_at: ISODateTime | null }[];
  appointments: { id: UUID; kind: string; starts_at: ISODateTime; status: string; channel: string;
    /** V9 meeting record */ outcome_notes?: string | null; decisions?: string[]; follow_ups?: number; next_appointment_id?: UUID | null }[];
}
export interface Kpi { value: number | null; previous?: number; delta_pct?: number | null; }
export interface RateKpi { value: number | null; numerator: number; denominator: number; insufficient_data: boolean; }
export interface CountRow { key: string; count: number; }
export interface SeriesPoint { week: ISODate; value: number; }
/** GET /agency/performance — management view (one intake cohort + rolling operations). */
export interface AgencyPerformance {
  intake: string | null;
  intakes: { intake: string; applications: number }[];
  cohort: {
    population: string; size: number;
    funnel: { step: 'STARTED' | 'SUBMITTED' | 'OFFERED' | 'ACCEPTED' | 'TUITION_PAID' | 'VISA_ISSUED' | 'ENROLLED'; count: number; from_previous: RateKpi | null }[];
    enrollment_conversion: RateKpi;
    processing: { stage: 'prepare' | 'decision' | 'tuition' | 'visa'; label: string; median_days: number | null; n: number; insufficient_data: boolean }[];
    by_nationality: { key: string; count: number }[];
    by_program: { key: string; count: number }[];
  };
  operations: {
    period_days: number;
    sla: RateKpi & { population: string; unanswered: number };
    document_correction: RateKpi & { population: string };
  };
  workload: { user_id: string; name: string; role: string; active_students: number; open_tasks: number; overdue_tasks: number }[];
  revenue: { period_days: number; by_currency: { currency: string; orders: number; amount_minor: number }[]; is_demo: boolean } | null;
  min_denominator: number;
}

export interface AgencyAnalytics {
  period_days: number; definitions: Record<string, string>;
  kpis: {
    new_leads: Kpi; active_students: Kpi; applications_submitted: Kpi; offers: Kpi; visas_issued: Kpi; enrollments: Kpi; overdue_tasks: Kpi;
    offer_rate: RateKpi; sla_met_rate: RateKpi; median_first_response_hours: Kpi; document_correction_rate: RateKpi;
  };
  funnel: { stage: ApplicationStatus; count: number }[];
  status_distribution: CountRow[]; by_university: CountRow[]; by_nationality: CountRow[]; by_degree: CountRow[]; by_intake: CountRow[];
  workload: { user_id: UUID; name: string; role: Role; active_students: number; open_tasks: number; overdue_tasks: number }[];
  task_aging: { bucket: string; count: number }[];
  series: { submitted: SeriesPoint[]; offers: SeriesPoint[] };
}

// ---------- university ----------
export interface UniversityAnalytics {
  definitions: Record<string, string>;
  funnel: { stage: string; count: number; note?: string }[];
  kpis: {
    applicants: Kpi; offers: Kpi; offer_rate: RateKpi; yield: RateKpi; visa_conversion: RateKpi; no_show: RateKpi; retention: RateKpi;
    graduation_rate: RateKpi; withdrawals: Kpi; median_processing_days: { value: number | null; n: number };
  };
  by_nationality: CountRow[]; by_program: (CountRow & { id?: UUID; degree?: DegreeLevel })[]; by_degree: CountRow[]; status_distribution: CountRow[];
  /** V8: submitted applications by intake key (YYYY-TERM); every breakdown row reproduces on GET /applications. */
  by_intake?: CountRow[];
  /** V8: pre-submission work — one aggregate number, never a list. */
  preparing?: number;
  by_agency: { agency: string; agency_id?: string | null; applications: number; offers: number; enrolled: number; offer_rate: RateKpi; yield?: RateKpi; complete_on_first_review?: RateKpi; avg_readiness_at_submission: number | null }[];
  cohorts: ({ cohort: string; total: number } & Record<string, number | string>)[];
  scholarship_pools: { pool_id: UUID; name: string; intake: string; total: number; committed: number; paid: number; remaining: number; recipients: number; contract_status: string; is_demo: boolean }[];
  quotas: { intake: string; program_id: UUID | null; seats: number; used: number; remaining: number }[];
  series: { submitted: SeriesPoint[]; /** V4: submissions per calendar month (last 12), from the applications themselves. */ submitted_monthly?: { month: string; value: number }[] };
}
export type AdmissionsFunnelStep = 'SUBMITTED' | 'REVIEWED' | 'OFFERED' | 'ACCEPTED' | 'TUITION_PAID' | 'VISA_ISSUED' | 'ARRIVED' | 'ENROLLED';
export interface AdmissionsFunnel {
  steps: { key: AdmissionsFunnelStep; count: number; conversion: RateKpi | null; definition?: string }[];
  rejected: number; withdrawn: number; total: number; min_denominator: number;
  population?: MetricPopulation; metrics?: Record<string, Metric>;
}
// ---------- V3 unified university metrics ----------
export interface MetricPopulation { label: string; intake: string | null; filters: Record<string, string>; size: number; period: { from: ISODate | null; to: ISODate | null } }
export interface Metric {
  key: string; value: number | null; numerator: number | null; denominator: number; insufficient: boolean; insufficient_data: boolean;
  population: string; period: { from: ISODate | null; to: ISODate | null }; definition: string; numerator_label?: string; denominator_label?: string;
}
export interface CohortSummary { enrolled: number; by_status: Record<string, number>; retention: RateKpi & { definition: string }; graduation: RateKpi & { definition: string } }
export interface UniversityMetrics {
  pipeline: { population: MetricPopulation; steps: AdmissionsFunnel['steps']; metrics: Record<string, Metric>; counts: Record<string, number>; closed: { rejected: number; withdrawn: number }; min_denominator: number };
  cohorts: { population: string; total: CohortSummary; cohorts: (CohortSummary & { cohort: string; label: string })[]; min_denominator: number; as_of: ISODate };
  intakes: { key: string; label: string; submitted: number; /** V4: the intake in admissions now (nearest open deadline). */ current?: boolean; next_deadline?: ISODate | null }[];
}
export interface UniversityAttention {
  awaiting_review: number; documents_returned: number; waiting_for_documents: number; interviews: number; waitlisted: number;
  offers_awaiting_response: number; tuition_pending: number; enrollment_pending: number; flagged: number; returned_application_ids: UUID[];
  /** V4: split by who acts next. */
  awaiting_tuition_invoice?: number; awaiting_tuition_payment?: number; awaiting_admission_letter?: number;
}
export type OutcomeStep = 'ADMITTED' | 'VISA_ISSUED' | 'ARRIVED' | 'ENROLLED' | 'RETAINED' | 'GRADUATED';
export interface UniversityOutcomes {
  by: 'cohort' | 'nationality' | 'program' | 'agency'; steps: OutcomeStep[]; min_denominator: number; definitions: Record<string, string>;
  rows: { key: string | null; label: string; counts: Record<OutcomeStep, number | null>; visa_rate: RateKpi | null; retention: RateKpi; graduation: RateKpi; tracked_admissions: boolean }[];
}
export interface DocumentRequest {
  id: UUID; application_id: UUID; label: string; note: string; category: string | null; due_date: ISODate | null; status: 'OPEN' | 'FULFILLED' | 'CANCELLED';
  requested_by_user: { id: UUID; full_name: string } | null; requested_by_org: { id: UUID; name: string } | null;
  requested_at: ISODateTime; fulfilled_at: ISODateTime | null; cancelled_at: ISODateTime | null; document_id: UUID | null;
  document: { id: UUID; title: string; category: string; status: string } | null; task_id: UUID | null;
}
export interface RequirementProposal {
  id: UUID; program: { id: UUID; name_en: string; degree_level: DegreeLevel }; changes: Record<string, unknown>; previous: Record<string, unknown>;
  note: string | null; status: 'PENDING' | 'PUBLISHED' | 'DISCARDED'; proposed_by: string | null; proposed_at: ISODateTime; reviewed_by: string | null; reviewed_at: ISODateTime | null;
}
export interface ExportHistory {
  capabilities: { manual: boolean; scheduled: boolean; email: boolean; sftp: boolean; api: boolean };
  jobs: { id: UUID; kind: string; rows: number | null; status: string; schedule: string; delivery: string; by: string | null; at: ISODateTime }[];
}
export interface SSOLookup { sso: boolean; protocol?: 'OIDC' | 'SAML'; organization?: string | null; enforced?: boolean; available?: boolean; start_url?: string }
export interface Partnership {
  id: UUID; title: string; status: string; start_date: ISODate; end_date: ISODate; recruitment_fee_krw: number | null; commission_percent: number | null;
  financials_visible?: boolean; target_programs?: UUID[];
  performance?: { population: string; submitted: number; offered: number; enrolled: number; yield: Metric };
  guaranteed_minimum_krw: number | null; target_countries: string[]; intake_label: string | null; incentive_tiers: { min_enrolled: number; bonus_krw?: number }[];
  guarantee_enabled: boolean; guarantee_terms: string | null; guarantee_criteria: Record<string, unknown> | null; is_demo: boolean;
  pools: { id: UUID; name: string; intake: string; total_krw: number; committed_krw: number; paid_krw: number; remaining_krw: number; rules_summary: string | null; awards: { id: UUID; student: string; amount_krw: number; status: string; note: string | null; updated_at: ISODateTime }[] }[];
  quotas: { id: UUID; intake: string; program_id: UUID | null; seats: number; used: number }[];
}
export interface CohortStudent {
  id: UUID; student: string; nationality: string | null; cohort: string; program: string | null; agency: string | null; status: string;
  enrolled_on: ISODate; expected_graduation: ISODate | null; visa_expires_on: ISODate | null;
  terms: { term: string; registered: boolean; gpa_percent: number | null; attendance_percent: number | null; academic_standing: string | null; data_source: string }[];
  risk: { flags: string[] } | null; is_demo: boolean;
}

// ---------- content & sources ----------
export interface ContentArticle {
  slug: string; locale: string; content_type: string; title: string; summary: string | null; seo_title: string | null; seo_description: string | null;
  country_code: string | null; last_verified_at: ISODate | null; author_name: string | null; reviewer_name: string | null; translation_status: string;
  body_md?: string; sources?: { key: string; name: string; url: string; source_type: string; last_checked_at: string | null; status: string }[];
  fallback_locale?: string | null;
}
export interface SourceRecord {
  id: UUID; key: string; name: string; url: string; source_type: string; topic: string | null; summary: string | null;
  last_checked_at: ISODateTime | null; last_changed_at: ISODateTime | null; review_interval_days: number; status: VerificationStatus; ingestion_method: string;
}
export interface FreshnessReviewItem { id: UUID; entity_type: string; entity_id: string; entity_label: string; reason: VerificationStatus; detail: string | null; created_at: ISODateTime; resolved_at: ISODateTime | null; resolution: string | null; }
export interface AuditEntry { id: UUID; action: string; entity_type: string; entity_id: string | null; actor: string; subject_user_id: UUID | null; detail: Record<string, unknown> | null; ip: string | null; at: ISODateTime; }

export type AgencyStudentView = Exclude<AgencyViewKey, 'all' | 'mine'>;
export type AgencyStudentViewCounts = Record<AgencyViewKey, number>;

// ---------- V3 student journey: budget, fx, profile unlocks ----------
export type CostBasis = 'OFFICIAL' | 'SAMPLE' | 'ESTIMATE' | 'UNKNOWN';
export interface BudgetLine { key: string; amount_min: number | null; amount_max: number | null; basis: CostBasis; source_url: string | null; verified_at: string | null; note: string | null; period: 'YEAR' | 'ONCE' | 'SEMESTER' }
export interface BudgetScholarship { id: UUID; name: string; kind: ScholarshipKind; status: 'ELIGIBLE' | 'POSSIBLE'; amount_min: number | null; amount_max: number | null; coverage: string | null; basis: CostBasis; source_url: string | null; verified_at: string | null }
export interface ProgramBudget {
  program_id: UUID; program_name: string; university_name: string; university_slug: string; city: string; housing: 'DORM' | 'OFF_CAMPUS';
  lines: BudgetLine[]; scholarships: BudgetScholarship[]; unknown_keys: string[];
  first_year_min: number | null; first_year_max: number | null; monthly_living_min: number | null; monthly_living_max: number | null;
  cash_before_arrival_min: number | null; cash_before_arrival_max: number | null;
  /** V4: first year before scholarship, rounded to ₩100k — identical to FirstYearRange low/high. */
  first_year_gross_min?: number | null; first_year_gross_max?: number | null;
  scholarship_best_min?: number | null; scholarship_best_max?: number | null; range_basis?: CostBasis;
}
/** V8: Hangyul's own fee — from the student's order (PAID / DUE) or the lowest active plan price (NONE = optional). */
export interface HangyulFee {
  status: 'PAID' | 'DUE' | 'NONE'; product_code?: string | null; product_name_key?: string | null; product_name_en?: string | null;
  currency: string | null; amount_minor: number | null; paid_at?: string | null; is_demo: boolean;
}
export interface BudgetResponse { source: 'selected' | 'shortlist'; items: ProgramBudget[]; hangyul_fee?: HangyulFee; currency: 'KRW'; basis_legend: Record<CostBasis, string> }
export interface FxTable { base: 'KRW'; as_of: string; basis: CostBasis; indicative: boolean; note: string; krw_per_unit: Record<string, number> }
export interface ProfileUnlockSection { key: 'basics' | 'education' | 'gpa' | 'language' | 'goals' | 'budget' | 'documents' | 'sponsor'; complete: boolean; effect: { kind: string; level?: number | null }; count: number | null }
export interface ProfileUnlocks { total_programs: number; sections: ProfileUnlockSection[] }


// ---------- V4 student: one cost model ----------
/** First year, estimated: tuition + fees + housing + living, before scholarship (server/app/services/budget.py first_year_range). */
export interface FirstYearRange { low: number | null; high: number | null; basis: 'OFFICIAL' | 'SAMPLE' | 'ESTIMATE' | 'UNKNOWN'; tuition_year: number | null; housing: 'DORM' | 'OFF_CAMPUS'; excludes: string[] }
/** V4: an offer with what the student actually pays now (GET /me/offers). `payment.pay` is null when it cannot be computed exactly. */
export interface StudentOffer {
  application_id: UUID; status: ApplicationStatus; university: string; university_slug: string; city: string; program: string;
  tuition_due: ISODate | null; tuition_is_invoice: boolean;
  payment: { tuition: number | null; scholarship: number | null; pay: number | null; scholarship_note: string | null };
  first_year_range_krw: FirstYearRange; first_year_after_scholarship_krw: { low: number; high: number } | null; dormitory: boolean;
}


// ---------- V5 success: strategy, portfolio, submission hub (server/app/services/strategy.py, submission.py) ----------
export type StrategySeverity = 'blocker' | 'improve' | 'info';
export type StrategyOwner = 'student' | 'counselor' | 'university';
export type StrategyState = 'READY' | 'IMPROVABLE' | 'BLOCKED';
/** One thing that still affects an application. `title`/`why` are English fallbacks; translate `success:item.<code>.*` with `params`. */
export interface StrategyItem {
  code: string; severity: StrategySeverity; owner: StrategyOwner; title: string; why: string | null; params: Record<string, unknown>;
  action: { code: string; label: string; link: string | null } | null; sample: boolean;
}
export interface ApplicationStrategy {
  application_id: UUID; status: ApplicationStatus; scope: 'prep' | 'review' | 'closed'; state: StrategyState; items: StrategyItem[]; fit: string[];
  counts: { blocker: number; improve: number; info: number };
  blocked_by: { code: string; title: string; params: Record<string, unknown> } | null;
  history: { cohort: string; n: number; offered: number; population: string } | null;
  application?: { id: UUID; status: ApplicationStatus; university: { id: UUID; name_en: string }; program: { id: UUID; name_en: string }; deadline: ISODate | null };
}
export type TodayImprovement = StrategyItem & { application_id: UUID; university: string; deadline: ISODate | null };
export interface MyStrategy { items: ApplicationStrategy[]; today: TodayImprovement[] }
export type PortfolioGroup = 'strong' | 'possible' | 'not_yet' | 'sent';
export interface PortfolioEntry {
  source: 'application' | 'saved'; application_id: UUID | null; status: ApplicationStatus | null;
  program: { id: UUID; name_en: string; degree_level?: DegreeLevel; field?: string }; university: { id: UUID; name_en: string; slug: string; city?: string; brand_color?: string | null; photo?: UniversityPhotoRef | null };
  tier: MatchTier | null; group: PortfolioGroup; deadline: ISODate | null; pre_submission: boolean;
  first_year: { low: number | null; high: number | null; basis: string | null };
}
export interface PortfolioObservation { code: string; severity: 'improve' | 'info'; text: string; params: Record<string, unknown> }
export type PortfolioDecision = 'BALANCED' | 'ADD_OPTION' | 'DROP_OPTION' | 'SPREAD_DEADLINES' | 'BUDGET_TALK' | 'DISCUSS';
export interface Portfolio {
  entries: PortfolioEntry[]; groups: Record<PortfolioGroup, number>; saved_groups: Record<PortfolioGroup, number>; offers: number; admitted?: boolean;
  deadline_cluster: { count: number; from: ISODate; to: ISODate; days: number } | null;
  budget: { low: number | null; high: number | null; budget: number | null; over_budget: number; basis: string };
  observations: PortfolioObservation[];
  questions: { key: 'too_few' | 'too_difficult' | 'unnecessary' | 'deadlines' | 'budget' | 'realistic_option'; flag: boolean }[];
  review: { id: UUID; decision: PortfolioDecision; note: string | null; reviewed_at: ISODateTime; reviewed_by: PublicUser | null; observations: string[]; stale: boolean } | null;
}
export type SubmissionMethod = 'DIRECT_API' | 'PARTNER_API' | 'AUTHORIZED_AGENCY' | 'APPLICATION_PROVIDER' | 'GUIDED_EXTERNAL' | 'MANUAL';
export type SubmissionStatus = 'NOT_STARTED' | 'READY_FOR_HANDOFF' | 'HANDED_OFF' | 'SUBMITTED_CONFIRMED' | 'SUBMITTED_UNCONFIRMED';
export type ApplicationFeeStatus = 'NOT_REQUIRED' | 'UNPAID' | 'PAID' | 'CONFIRMED' | 'UNKNOWN';
export type FeePayer = 'STUDENT' | 'AGENCY' | 'UNKNOWN';
export interface SubmissionConnectorInfo {
  id?: UUID; method: SubmissionMethod; configured_method?: SubmissionMethod | null; provider: string | null; portal_name?: string | null; portal_url: string | null;
  official_url?: string | null; supported_actions: string[]; login_requirements: string | null;
  fee: { amount: number | null; currency: string | null; payment_method: string | null; payee: string | null; payer?: FeePayer };
  documents_accepted: 'ONLINE' | 'MAIL' | 'BOTH' | 'UNKNOWN'; originals_by_mail?: boolean | null; confirmation_method: string | null; receipt_method?: string | null;
  /** V6: how Hangyul learns the outcome — only NONE / MANUAL exist today. */
  status_sync?: 'NONE' | 'MANUAL' | 'WEBHOOK' | 'POLLING';
  /** V6: AWAITING_PROVIDER for DIRECT_API / PARTNER_API (no integration exists). */
  integration?: 'AWAITING_PROVIDER' | 'NOT_APPLICABLE';
  agency_submission?: { basis: string | null; basis_url: string | null; basis_verified: ISODate | null };
  instructions: string | null; source_url: string | null; verified_source?: string | null; last_verified: ISODate | null;
  verification_status: 'VERIFIED' | 'NEEDS_REVIEW' | 'SAMPLE' | string; placeholder: boolean; partial?: boolean; is_demo?: boolean;
  notes?: string | null; university: string | null;
}
export interface SubmissionRecord {
  id: UUID; method: SubmissionMethod; status: SubmissionStatus; handed_off_at: ISODateTime | null; submitted_on: ISODate | null;
  external_reference: string | null; evidence_kind: 'NONE' | 'CONFIRMATION_ID' | 'RECEIPT' | 'CONFIRMATION_AND_RECEIPT';
  recorded_by_role: 'STUDENT' | 'AGENCY' | 'HANGYUL' | 'SYSTEM' | null; recorded_at: ISODateTime | null;
  fee?: { status: ApplicationFeeStatus; amount: number | null; currency: string | null; payee: string | null; paid_on: ISODate | null };
  recorded_by?: PublicUser | null; receipt?: { id: UUID; title: string } | null; note?: string | null; completeness_at_submission?: number | null;
  /** V6: the agency that submitted under the student's authorisation. */
  recorded_by_org?: string | null;
  /** V6: last reported failed attempt (cleared once the submission is confirmed). */
  failure?: { reason: string; at: ISODateTime } | null;
}
export interface SubmissionFormField { key: 'full_name' | 'email' | 'date_of_birth' | 'nationality' | 'passport' | 'education' | 'language' | 'program' | string; value: string }
/** V6: exactly what the student authorised (stored with the consent). */
export interface SubmissionSnapshot {
  consent_version: string;
  university: { id: UUID; name_en: string }; program: { id: UUID; name_en: string; degree_level: DegreeLevel };
  intake: { id: UUID; year: number; term: IntakeTerm; deadline: ISODate };
  form_fields: SubmissionFormField[];
  documents: { label: string; category: DocumentCategory; document_id: UUID | null; version: number | null; title: string | null; ready: boolean }[];
  essays: { id: UUID; essay_type: EssayType; approved: boolean }[];
  fee: { amount: number | null; currency: string | null; payee: string | null; payer: FeePayer; kind: 'UNIVERSITY_APPLICATION_FEE' };
  submitter: { agency_id: UUID | null; agency: string | null; counselor_id: UUID | null; counselor: string | null };
  mechanism: { method: SubmissionMethod; provider: string | null; portal_name: string | null; portal_url: string | null; basis: string | null };
}
export interface SubmissionAuthorization {
  id: UUID; status: 'ACTIVE' | 'REVOKED' | 'USED'; granted_at: ISODateTime; revoked_at: ISODateTime | null; used_at: ISODateTime | null;
  consent_version: string; snapshot: SubmissionSnapshot; package_changed: boolean;
}
export interface SubmissionGuided {
  self_submit_required: boolean; steps: string[]; minutes: number | null;
  files: { label: string; category: DocumentCategory; ready: boolean; required: boolean; document_id: UUID | null }[];
  form_fields: SubmissionFormField[]; counselor_review: { date: ISODate; by: string | null } | null;
}
export interface SubmissionView {
  application_id: UUID; application_status: ApplicationStatus; university: { id: UUID; name_en: string };
  connector: SubmissionConnectorInfo; status: SubmissionStatus; record: SubmissionRecord | null;
  can_handoff: boolean; student_can_record: boolean; counselor_submits: boolean;
  checklist: { documents: { ready: number; total: number; items: { label: string; category: DocumentCategory; ready: boolean; required?: boolean; document_id: UUID | null }[] };
    essays: { approved: number; total: number; items: { id: UUID; essay_type: EssayType; approved: boolean }[] };
    fee: { status: ApplicationFeeStatus; amount: number | null; currency: string | null; payee: string | null }; complete: boolean } | null;
  /** V6 */
  integration_state?: 'AWAITING_PROVIDER' | 'NOT_APPLICABLE';
  guided?: SubmissionGuided | null;
  agency_submission?: { available: boolean; unavailable_reason: 'NO_BASIS' | 'AGENCY_NOT_AUTHORISED' | 'NO_AGENCY' | null; agency: string | null; counselor: string | null;
    basis: string | null; permission_basis: 'CONTRACT' | 'DEMO' | null };
  authorization?: SubmissionAuthorization | null;
  can_authorize?: boolean; can_revoke?: boolean; consent_version?: string; consent_preview?: SubmissionSnapshot | null;
  final_review?: { code: 'CONSENT' | 'DOCUMENTS' | 'ESSAYS' | 'PACKAGE_UNCHANGED' | 'DEADLINE' | 'FEE' | string; ok: boolean; params: Record<string, unknown> }[] | null;
}
export type SubmissionQueueView = 'ready' | 'awaiting' | 'submitted' | 'all';
export interface SubmissionQueueRow {
  application_id: UUID; group: Exclude<SubmissionQueueView, 'all'>; student: { id: UUID; full_name: string };
  university: { id: UUID; name_en: string }; program: { id: UUID; name_en: string }; intake: { year: number; term: IntakeTerm }; deadline: ISODate;
  authorized_at: ISODateTime | null; authorization_status: 'ACTIVE' | 'REVOKED' | 'USED' | null;
  package: { complete: boolean; ready: number; total: number }; fee_status: ApplicationFeeStatus; failure: string | null;
  external_reference: string | null; submitted_on: ISODate | null;
  /** Development fixture connector (no real agreement exists). */
  fixture: boolean;
}
export interface SubmissionQueue {
  items: SubmissionQueueRow[]; counts: { ready: number; awaiting: number; submitted: number; failed: number }; view: SubmissionQueueView; can_record: boolean;
}
/** University console: evidence only (method, reference, date). */
export interface SubmissionEvidence {
  method: SubmissionMethod; application_status: ApplicationStatus; submitted_at: ISODateTime | null; external_reference: string | null;
  record: Pick<SubmissionRecord, 'method' | 'status' | 'submitted_on' | 'external_reference' | 'evidence_kind' | 'recorded_at'> | null;
}
export interface SubmissionConfirmInput {
  external_reference?: string; submitted_on?: ISODate; receipt_document_id?: UUID; fee_status?: ApplicationFeeStatus; fee_paid_on?: ISODate; note?: string;
}

// ---------- V5 concierge (service cases, vendors, arrival journey) — owned by the concierge workstream ----------
export type ServiceCaseType = 'VISA_SUPPORT' | 'AIRPORT_PICKUP' | 'DORMITORY' | 'HOUSING_SEARCH' | 'TEMPORARY_HOUSING' | 'ARRIVAL_SUPPORT'
  | 'RESIDENCE_CARD' | 'SIM' | 'BANKING_SUPPORT' | 'OTHER';
export type ServiceWaitingOn = 'team' | 'student' | 'provider' | 'external' | 'none';
export type ServiceView = 'needs_assignment' | 'waiting_student' | 'waiting_provider' | 'scheduled' | 'today' | 'overdue' | 'completed';
export type VendorLabel = 'DEMO' | 'PARTNER' | 'PROVIDER';
export interface ServiceVendor {
  id: UUID; name: string; kind: string; label: VendorLabel; is_demo: boolean; languages: string[]; service_area: string[];
  /** Staff only */
  organization_id?: UUID | null; network?: boolean; price_model?: string | null; availability?: string | null; sla_hours?: number | null;
  contact?: Record<string, string>; quality_status?: 'NEW' | 'GOOD' | 'WATCH' | 'SUSPENDED'; agreement?: { active: boolean; since: ISODate | null; until: ISODate | null; reference: string | null } | null;
  agreement_active?: boolean; notes?: string | null;
}
export interface FlightInfo {
  number: string | null; airport: string | null; scheduled_arrival: ISODateTime | null; estimated_arrival: ISODateTime | null; terminal: string | null;
  source: 'MANUAL' | 'PROVIDER'; updated_at: ISODateTime | null; updated_by: 'student' | 'staff' | null; live: boolean;
}
export interface ServiceCaseEvent {
  id: UUID; kind: string; from: string | null; to: string | null; body: string | null; data: Record<string, unknown> | null;
  visibility: 'INTERNAL' | 'STUDENT'; attachment_document_id: UUID | null; actor: string | null; at: ISODateTime;
}
export interface ServiceCase {
  id: UUID; type: ServiceCaseType; status: string; status_key: string; waiting_on: ServiceWaitingOn; bucket: 'open' | 'scheduled' | 'done' | 'cancelled';
  closed: boolean; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; due_at: ISODateTime | null; vendor: ServiceVendor | null;
  cost: { amount: number | null; currency: string | null; payer: 'student' | 'hangyul' | 'university' | 'included' | null } | null;
  details: Record<string, any>; help_category: string | null; routed_to: 'AGENCY' | 'HANGYUL_OPS'; application_id: UUID | null;
  created_at: ISODateTime; updated_at: ISODateTime; closed_at: ISODateTime | null; feedback: { ok: boolean | null; comment: string | null; at: ISODateTime | null };
  owner: { id: UUID; full_name: string } | null; is_demo: boolean; lease_flags?: string[]; flight?: FlightInfo | null; events?: ServiceCaseEvent[];
  /** Staff only */
  allowed_next?: string[]; sla_due_at?: ISODateTime | null; overdue?: boolean; sla_breached?: boolean; internal_notes?: string | null;
  agency_org_id?: UUID | null; student?: { id: UUID; full_name: string; nationality: string | null } | null;
  tasks?: { id: UUID; title: string; title_key: string | null; status: string; due_at: ISODateTime | null; visible_to_student: boolean }[];
}
export interface OfficialFacts {
  topic: string | null; summary: string | null; steps: string[]; documents: string[]; timing: string | null; cost: string | null; notes: string | null;
  sources: { name: string | null; url: string | null; verified_at: string | null }[]; source: { name: string | null; url: string | null; verified_at: string | null } | null;
  status: 'VERIFIED' | 'PARTIAL' | 'NEEDS_REVIEW'; research_file: string | null;
}
export interface EmergencyInfo { numbers: { number: string; key: string; status: 'VERIFIED' | 'NEEDS_REVIEW'; source: { name: string | null; url: string | null; verified_at: string | null } }[]; research_file: string | null }
export type ArrivalStage = 'QUIET' | 'ADMITTED' | 'READY_TO_COME' | 'ARRIVED';
export interface ArrivalJourney {
  stage: ArrivalStage;
  steps: { key: string; status: 'done' | 'next' | 'todo' | 'locked' | 'not_needed'; link: string | null; official: OfficialFacts | null }[];
  next: ArrivalJourney['steps'][number] | null; flight: FlightInfo | null; flight_provider: string; pickup: ServiceCase | null; residence_card: ServiceCase | null;
  arrived_at: ISODateTime | null; residence_card_due: ISODate | null; completed_items: string[]; university: { id: UUID; name_en: string } | null;
  university_arrival: { group_residence_registration: boolean | null; orientation_note: string | null; orientation_date: ISODate | null; verification_status: string; source_url: string | null } | null;
  visa_type: string | null; nationality: string | null; emergency: EmergencyInfo; help_categories: string[];
}
export interface HousingListing {
  id: UUID; title: string; area: string | null; room_type: string | null; rent_monthly_krw: number | null; deposit_krw: number | null; management_fee_krw: number | null;
  contract_months_min: number | null; commute_minutes: number | null; distance_km: number | null; furnished: boolean | null; utilities: string | null;
  available_from: ISODate | null; verification_status: string; verified_at: ISODateTime | null; is_demo: boolean; provider: ServiceVendor | null;
}
export interface DormitoryFacts {
  id: UUID; name: string; room_types: string[]; capacity: number | null; cost_per_semester_krw_min: number | null; cost_per_semester_krw_max: number | null;
  international_priority: boolean; meal_plan: boolean | null; meal_required: boolean | null; application_note: string | null;
  application_opens: ISODate | null; application_closes: ISODate | null; eligibility: string | null; move_in_date: ISODate | null; deposit_krw: number | null;
  required_documents: string[]; location: string | null; source_url: string | null; verified_at: ISODateTime | null; verification_status: string;
}
export type HousingOption = 'DORM' | 'PARTNER' | 'OFF_CAMPUS' | 'TEMPORARY' | 'UNDECIDED';
export interface HousingPlan {
  option: HousingOption; options: { value: HousingOption; available: boolean }[];
  profile: { monthly_budget_krw?: number | null; deposit_budget_krw?: number | null; room?: 'private' | 'shared' | null; max_commute_minutes?: number | null;
    gender_requirement?: 'female' | 'male' | 'any' | null; move_in_date?: ISODate | null; stay_months?: number | null; furnished?: boolean | null };
  move_in: { date?: string | null; address?: string | null; check_in_method?: string | null; manager_contact?: string | null; deposit_status?: 'UNPAID' | 'PAID' | 'NOT_APPLICABLE' | null; checklist_done?: string[] };
  move_in_checklist: string[]; dorm_case: ServiceCase | null; search_cases: ServiceCase[]; temporary_case: ServiceCase | null;
  listings: HousingListing[]; partner_listings: HousingListing[]; partner_providers: ServiceVendor[]; listing_feed: 'NOT_CONNECTED' | string; lease_fields: string[];
}
export interface ServiceQueue { items: ServiceCase[]; counts: Record<ServiceView, number>; views: ServiceView[]; types: ServiceCaseType[] }
export interface ServiceRate { numerator: number; denominator: number; value: number | null; insufficient: boolean; definition: string }
export interface ServiceMetrics {
  period: { start: ISODateTime; end: ISODateTime }; population: string; n_cases: number;
  completion: ServiceRate; sla_breach: ServiceRate; arrival_support_completion: ServiceRate;
  counts: { pickups_completed: number; no_shows: number; student_issues: number; housing_confirmed: number };
  time_to_resolution_hours: { median: number | null; n: number; insufficient: boolean; definition: string };
  feedback: { yes: number; no: number; n: number; share_yes: number | null; insufficient: boolean; definition: string };
}

// ---------- V5 universal dossier (server/app/services/dossier.py) ----------
/** Applicability of one document for one requirement. */
export type DossierStatus = 'READY' | 'NEAR_EXPIRY' | 'IN_REVIEW' | 'NEEDS_FIX' | 'NEEDS_NEW_VERSION' | 'NEEDS_LEGALIZATION' | 'NEEDS_TRANSLATION' | 'EXPIRED' | 'MISSING';
/** Translatable reason: `dossier:reason.{code}` with `params`; `text` is the English fallback. */
export interface DossierReason { code: string; params: Record<string, unknown>; text: string }
export interface DossierDoc {
  id: UUID; category: DocumentCategory; title: string; status: DocumentStatus; issuing_country: string | null; issue_date: ISODate | null;
  expires_on: ISODate | null; language: string | null; current_version: number; updated_at: ISODateTime | null;
  latest_file: { filename: string; uploaded_at: ISODateTime; size_bytes: number } | null;
  translation: 'NOT_NEEDED' | 'PROVIDED' | 'NEEDED' | 'CHECK' | 'UNKNOWN'; legalization: { path: LegalizationPath; status: LegalizationStatus };
  rejection_reason: string | null; is_demo: boolean;
}
export interface DossierFinding {
  id: UUID; document_id: UUID; code: string; text_code: string; severity: 'BLOCKER' | 'WARNING' | 'INFO'; params: Record<string, unknown>;
  explanation: string; action: string | null; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; version: number;
  note?: string | null; resolved_at?: ISODateTime | null; created_at?: ISODateTime | null;
}
export interface DossierUse {
  application_id: UUID; university: string; requirement_id: string | null; label: string; status: DossierStatus; document_id: UUID | null;
  reason: DossierReason; sent: boolean; max_age_days: number | null;
}
export interface DossierRow {
  category: DocumentCategory; label: string; state: 'todo' | 'review' | 'ready' | 'extra'; document: DossierDoc | null;
  other_versions: DossierDoc[]; superseded: DossierDoc[]; applications: DossierUse[]; ready_count: number; needed_count: number;
  summary: DossierReason; findings: DossierFinding[]; essay: { id: UUID; status: EssayStatus } | null;
}
export type PackageBucket = 'ready' | 'student' | 'counselor' | 'request';
export interface DossierPackageItem {
  key: string; kind: 'requirement' | 'request'; label: string; category: string | null; bucket: PackageBucket; status: string; document_id: UUID | null;
  reason: DossierReason; requirement_id?: string | null; request_id?: UUID; note?: string; due_date?: ISODate | null; shared_with_university?: boolean;
}
export interface DossierPackageSummary { total: number; ready: number; student: number; counselor: number; request: number; complete: boolean }
export interface DossierApplication { id: UUID; status: ApplicationStatus; university: string; university_id: UUID; program: string; deadline: ISODate | null; sent: boolean }
export interface DossierPackage { application: DossierApplication; summary: DossierPackageSummary; items: DossierPackageItem[] }
/** GET /applications/{id}/package — a university sees only `shared`. */
export type DossierPackageResponse = DossierPackage | { application: DossierApplication; shared: { label: string; category: string | null; document_id: UUID }[]; summary: { shared: number } };
export interface DossierRequestSuggestion {
  request_id: UUID; application_id: UUID; university: string; label: string; note: string; category: DocumentCategory | null; max_age_days: number | null;
  due_date: ISODate | null; document: DossierDoc | null; status: DossierStatus; reason: DossierReason; action: 'SEND_EXISTING' | 'UPLOAD_NEWER' | 'FIX' | 'UPLOAD';
}
export interface DossierSuggestion {
  id: UUID; document_id: UUID; document_title: string; category: DocumentCategory; version: number; field: string; value: string;
  confidence: 'low' | 'medium' | 'high'; source: 'text' | 'mrz' | 'filename'; status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  confirmed_value: string | null; current_value: string | null; matches_profile: boolean; target: string | null; applied: string[];
}
export interface DossierFacts {
  full_name: string; date_of_birth: ISODate | null; nationality: string | null;
  passport: { number_masked: string | null; expiry: ISODate | null; has_passport: boolean | null; state: 'ok' | 'near' | 'expired' | null };
  education: { level: string; institution: string; country: string; graduation_year: number | null; graduation_status: string; gpa: string | null }[];
  tests: { test: string; score: number; test_date: ISODate | null; expires_on: ISODate | null; verified: boolean; planned: boolean }[];
  sponsor: string | null;
}
export interface Dossier {
  student: { id: UUID; full_name: string; nationality: string | null }; facts: DossierFacts; rows: DossierRow[]; packages: DossierPackage[];
  requests: DossierRequestSuggestion[]; suggestions: DossierSuggestion[];
  counts: { documents: number; ready: number; todo: number; review: number; applications: number; suggestions: number; matching: number };
  method: 'RULES'; ocr_available: boolean; as_of: ISODate;
}
export interface DossierReuse {
  category: DocumentCategory; request: DossierRequestSuggestion | null;
  existing: { document: DossierDoc; used_by: number; universities: string[]; needs_new: { university: string; status: DossierStatus; reason: DossierReason }[] }[];
}
export interface DossierMetrics {
  period: { since: ISODate; until: ISODate };
  duplicate_uploads_avoided: { value: number; sent_existing: number; kept_existing: number; new_versions: number; implicit_reuse_all_time: number; definition: string };
  first_pass_acceptance: { value: number | null; accepted: number; n: number; withheld: boolean; definition: string };
  documents_requested_per_application: { value: number | null; requests: number; applications: number; withheld: boolean; definition: string };
}

// ---------- V5 writing review (server/app/services/writing.py) ----------
export type WritingSeverity = 'BLOCKER' | 'WARNING' | 'INFO';
export type RubricRating = 'MEETS' | 'NEEDS_WORK' | 'NOT_ASSESSED';
export type GateState = 'PASSED' | 'BLOCKER' | 'WAITING';
export type AuthorKind = 'STUDENT' | 'AGENCY' | 'HANGYUL' | 'STAFF' | 'UNKNOWN';
export interface WritingPrompt {
  id: UUID; university_id: UUID; program_id: UUID | null; essay_type: EssayType; intake: { year: number; term: string } | null;
  effective_from: { year: number; term: string } | null; text: string; language: string; word_limit: number | null; char_limit: number | null;
  required_language: string | null; source_url: string | null; verified_at: ISODateTime | null;
  verification_status: 'SAMPLE' | 'COUNSELOR_ENTERED' | 'VERIFIED'; version: number; superseded_by: { id: UUID; version: number } | null;
  entered_by_org: string | null; note: string | null; created_by?: string | null;
}
export interface WritingFinding {
  id: UUID; kind: string; code: string; severity: WritingSeverity; params: Record<string, unknown>; text: string; quote: string | null;
  anchor_start: number | null; anchor_end: number | null; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; version: number; staff_only: boolean;
  resolved_note: string | null; auto_resolved: boolean; source: 'AUTOMATIC_CHECK';
}
export interface WritingGateItem { key: string; state: GateState; reasons: ({ code: string } & Record<string, unknown>)[] }
export interface WritingGate { items: WritingGateItem[]; blockers: string[]; can_approve: boolean; override: { reason: string; blockers: string[] } | null }
export interface WritingStatusLine {
  code: 'DRAFT' | 'WAITING_REVIEWER' | 'REVIEWING' | 'LATE_FLAGGED' | 'LATE' | 'CHANGES' | 'FINAL' | 'READY';
  reviewer: { name: string; kind: AuthorKind; org: string | null } | null; submitted_at: ISODateTime | null; expected_by: ISODateTime | null;
  round: number; flagged_to?: string | null; flagged_to_kind?: string | null; approved_version?: number | null; approved_at?: ISODateTime | null;
}
export interface ReviewerMatchReason { code: string; points: number; value?: string | number }
export interface WritingBlock {
  context: { university: { id: UUID; name: string } | null; program: { id: UUID; name: string; degree_level: string } | null;
    intake: { year: number; term: string; deadline: ISODate | null } | null; application_id: UUID | null };
  prompt_status: 'LINKED' | 'STUDENT_COPY' | 'UNKNOWN'; prompt: WritingPrompt | null;
  limits: { word_limit: number | null; char_limit: number | null };
  review: { round: number; submitted_at: ISODateTime | null; first_submitted_at: ISODateTime | null; expected_review_by: ISODateTime | null;
    overdue: boolean; escalated: boolean; last_reviewed_at: ISODateTime | null; assigned_by?: string | null; assignment_reasons?: ReviewerMatchReason[];
    override_reason?: string | null; sla_breaches?: number; escalated_to?: string | null };
  approved_version: number | null; approved_at: ISODateTime | null; status_line: WritingStatusLine;
  findings?: WritingFinding[]; checks?: { version: number | null; at: ISODateTime | null; label: 'AUTOMATIC_CHECK'; provider: string };
  gate?: WritingGate | null; authors?: Record<UUID, { kind: AuthorKind; name: string | null; org: string | null }>;
  rubric?: { dimensions: { key: string; label: string | null; gate: string }[]; scores: Record<string, { rating: RubricRating; note: string | null; version: number | null; by: string | null }> };
  approval_override?: { reason: string; blockers: string[] } | null;
}
export interface WritingQueueItem {
  id: UUID; title: string; essay_type: EssayType; status: EssayStatus; version: number; student: { id: UUID; name: string };
  university: string | null; program: string | null; deadline: ISODate | null; submitted_at: ISODateTime | null; review_age_hours: number | null;
  expected_review_by: ISODateTime | null; overdue: boolean; round: number;
  reviewer: ({ id: UUID; full_name: string } & { kind: AuthorKind; org: string | null }) | null;
  next_action: 'OVERDUE' | 'FINAL_APPROVAL' | 'REVIEW_REVISION' | 'FIRST_REVIEW' | 'WAITING_STUDENT' | 'NONE';
}
export type WritingQueueView = 'first' | 'revised' | 'final' | 'due48' | 'overdue' | 'mine' | 'team';
export interface WritingQueue { view: WritingQueueView; items: WritingQueueItem[]; total: number; counts: Record<WritingQueueView, number> }
export interface WritingCandidate {
  user: PublicUser; organization: { id: UUID; name: string; type: string }; role: string; points: number; reasons: ReviewerMatchReason[];
  open_reviews: number; capacity: number; at_capacity: boolean;
}
export interface WritingInsights {
  metrics: { period_days: number; reviews: number; median_turnaround_hours: number | null; approved_essays: number; median_revision_rounds: number | null;
    sla_breaches: number; late_reviews: number; definition: string };
  patterns: { n: number; groups: Record<'rounds' | 'sla' | 'override', { group: string; n: number; withheld: boolean; offers: number | null; not_admitted: number | null; waitlisted: number | null }[]>;
    period: { from: number; to: number } | null; population: string; demo: boolean; caveat: string };
}
export interface ApprovedEssay { essay_id: UUID; essay_type: EssayType; title: string; version: number; approved_at: ISODateTime | null; word_count: number; body: string; newer_draft: boolean }

/** V5 outcome metrics (GET /agency/outcome-metrics). */
export interface OutcomeMetric { group: 'admission' | 'documents' | 'writing' | 'services'; key: string; value: number | null;
  unit: 'days' | 'hours' | 'share' | 'count' | 'ratio' | 'rounds'; n: number | null; numerator: number | null; denominator: number | null; withheld: boolean; definition: string }
export interface OutcomeMetrics { period_days: number; scope: string; includes_demo: boolean; min_n: number; metrics: OutcomeMetric[] }

/** V5 visa concierge (GET /me/visa-route, /visa-route/students/{id}). Research text fields end in `_en` (shown only as "exact wording"). */
export type VisaRouteStatus = 'RESOLVED' | 'NEEDS_ANSWER' | 'NO_ROUTE' | 'NOT_VERIFIED' | 'OTHER_RESIDENCE' | 'IN_KOREA' | 'NEEDS_PROFILE' | 'NEEDS_PROGRAM';
export type VisaDisplayStatus = 'PREPARING' | 'READY' | 'SUBMITTED' | 'EMBASSY_REQUEST' | 'APPROVED' | 'ISSUED' | 'NEEDS_ATTENTION';
export type VisaMethodCode = 'IN_PERSON' | 'VISA_CENTRE' | 'APPOINTMENT' | 'AGENCY' | 'E_VISA_UNIVERSITY' | 'CCVI';
export type VisaDocStatus = 'READY' | 'NEAR_EXPIRY' | 'IN_REVIEW' | 'NEEDS_FIX' | 'NEEDS_LEGALIZATION' | 'NEEDS_TRANSLATION' | 'EXPIRED' | 'NEW_FOR_VISA'
  | 'GET_LATER' | 'WAITING_UNIVERSITY' | 'MISSING' | 'FORM' | 'AT_REGISTRATION' | 'NOT_NEEDED';
export interface VisaPost { key: string; name_en: string; city: string; url: string | null; kind: 'embassy' | 'consulate' | 'office' | 'centre'; regions: string[]; covers_text: string | null }
export interface VisaCode { code: string; params: Record<string, unknown>; note_en?: string | null }
export interface VisaRouteDoc {
  key: string; name_en: string; category: DocumentCategory | null; requirement: 'REQUIRED' | 'CONDITIONAL' | 'OPTIONAL'; applies: 'yes' | 'no' | 'maybe';
  condition_code: string | null; condition_en: string | null; provided_by: string | null; who: 'you' | 'university' | 'bank' | 'sponsor' | 'authority';
  validity_days: number | null; validity_en: string | null; legalization: 'APOSTILLE' | 'CONSULAR' | 'NONE' | null; translation_en: string | null; notes_en: string | null;
  slow: boolean; status: VisaDocStatus; reason: VisaCode; reused: boolean;
  document: { id: UUID; title: string; category: DocumentCategory; issue_date: ISODate | null; expires_on: ISODate | null; status: DocumentStatus } | null;
  timing: { get_after: ISODate | null; valid_on: ISODate | null; days: number } | null;
}
export interface VisaRouteStep { key: string; why: string; who: string; done: boolean; state: 'done' | 'current' | 'todo'; items?: string[] }
export interface VisaFormField { field: string; value: string | null; source: string; corrected?: boolean }
export interface VisaFormSection { key: string; fields: VisaFormField[]; confirmed_at: ISODateTime | null; missing: string[] }
export interface VisaEmbassyRequest { id: UUID; note: string; due_on: ISODate | null; status: 'OPEN' | 'SENT' | 'CLOSED'; sent_at: ISODateTime | null; overdue: boolean; created_at: ISODateTime | null }
export interface VisaRoutePlan {
  status: VisaRouteStatus; preview: boolean; display_status: VisaDisplayStatus;
  inputs: { nationality: string | null; country_name: string | null; residence_country: string | null; visa_type: string | null; degree_level: string | null; sponsor: string | null;
    age: number | null; admitted: boolean; university: { id: UUID; name_en: string; name_ko: string; region: string; tier: string; tier_verified_at: ISODate | null } | null;
    program: { id: UUID; name_en: string } | null; semester_start: ISODate | null; application_status: string | null };
  route: { id: UUID; country: string; country_name: string; visa_type: string; verification_status: 'VERIFIED' | 'PARTIAL' | 'NEEDS_REVIEW'; verified_at: ISODate | null;
    version: number; primary_source: string | null; sources: { url: string; title: string; verified_at: string | null; page_date: string | null }[];
    special_notes_en: string[]; reviewer_notes_en: string | null; processing_time_en: string | null; fees: { amount: number | null; currency: string | null; details: string | null } | null } | null;
  post: VisaPost | null; centre?: VisaPost | null; posts?: VisaPost[]; jurisdiction_mode?: 'single' | 'centre' | 'regional' | 'unverified';
  method: { code: VisaMethodCode | null; post_method: VisaMethodCode | null; note_code?: string | null; accredited_agencies: boolean; official_url: string | null; status_url: string;
    details_en: string; processing_time_en: string | null; fees: { amount: number | null; currency: string | null; details: string | null } | null;
    e_visa_condition_en: string | null } | null;
  question: { kind: 'residence_region' | 'hukou' | 'passport_place'; options: { value: string; label: string; post_key: string }[] } | null;
  answer: Record<string, string>;
  why?: VisaCode[]; caveats: VisaCode[]; steps: VisaRouteStep[]; documents: VisaRouteDoc[];
  timing: { key: string; get_after: ISODate | null; valid_on: ISODate | null; days: number }[];
  pack: { needed: number; ready: number; all_ready: boolean; maybe: number; reused: number; valid_on: ISODate | null; form_confirmed: boolean; reviewed_at: ISODateTime | null } | null;
  financial?: { amount_en: string | null; amounts: string[]; stated: boolean; currency: string | null; holding_period_en: string | null; sponsor_rules_en: string | null; source_url: string | null } | null;
  case: { id: UUID; status: VisaStatus; display_status: VisaDisplayStatus; visa_type: VisaType; submitted_on: ISODate | null; issued_on: ISODate | null; expires_on: ISODate | null;
    target_entry_date: ISODate | null; application_id: UUID | null; appointment: { on: ISODate; status: 'PLANNED' | 'BOOKED' | null; post_key: string | null; reference: string | null } | null;
    handoff_opened_at: ISODateTime | null; submission: { on: ISODate; reference: string | null; document_id: UUID | null } | null;
    decision: { decision: 'APPROVED' | 'REFUSED'; on: ISODate | null } | null; visa_document_id: UUID | null; requests: VisaEmbassyRequest[] } | null;
  form: { sections: VisaFormSection[]; all_confirmed: boolean; declarations: false } | null;
  help: { issue: { code: string; who: string; when: ISODate | null; note?: string | null } | null; source_url: string | null; contact: { name: string | null; link: string };
    support_case: { id: UUID; status: string; waiting_on: string; closed: boolean } | null } | null;
  next: { key: string; params: Record<string, unknown>; who: string } | null;
  fallback_checklist?: VisaChecklistItem[];
}

// ---------- V8 university console ----------
export interface GlossaryEntry {
  key: string; kind: 'count' | 'rate' | 'median'; numerator: string; denominator: string | null; population: string; intake: string;
  date_range: string; small_sample: string; definition: string;
  /** Language-neutral codes for population / intake / date range / small-sample rule (clients translate; English stays the reference). */
  codes?: { population: string; intake: string; date_range: string; small_sample: string };
}
export interface UniversityGlossary { min_denominator: number; metrics: GlossaryEntry[] }
export type UniversityBulkAction = 'assign-reviewer' | 'document-request' | 'admin-check';
export interface BulkResult {
  action: UniversityBulkAction; total: number; succeeded: number; failed: number;
  results: { id: string; ok: boolean; result?: 'assigned' | 'cleared' | 'requested' | 'checked' | 'unchanged'; error?: 'not_found' | 'not_requestable'; status?: string; request_id?: string }[];
}
export type ExportPresetKey = 'current_intake' | 'admitted' | 'visa' | 'enrolment' | 'outcomes';
export interface ExportPresets {
  capabilities: { manual: boolean; scheduled: boolean; scheduled_reason: string };
  current_intake: string | null;
  presets: { key: ExportPresetKey; personal_data: boolean; columns: string[]; last_run: { at: ISODateTime; rows: number; by: string | null } | null }[];
  available_columns: string[];
  saved: { id: UUID; name: string; base: ExportPresetKey; columns: string[]; filters: Record<string, string>; schedule: string; created_at: ISODateTime; by: string | null;
    last_run: { at: ISODateTime; rows: number; by: string | null } | null }[];
}
export interface RuleHistory {
  effective_from: ISODate | null; effective_to: ISODate | null; verified_at: ISODateTime | null;
  entries: { kind: 'proposal' | 'direct'; status: string; at: ISODateTime | null; proposed_by: string | null; proposed_at: ISODateTime | null; reviewed_by: string | null;
    reviewed_at: ISODateTime | null; changes: Record<string, unknown>; previous: Record<string, unknown> | null; note: string | null }[];
}

// ---------------------------------------------------------------- V12: the Korean institution directory
// The public directory is institution-level and carries no price, deadline, requirement or match. Those belong
// to the application catalogue (`University`/`Program`), which is an authenticated surface. See REPORT §85.

export type InstitutionKind = 'UNIVERSITY' | 'JUNIOR_COLLEGE' | 'GRADUATE_UNIVERSITY';
export type Establishment = 'NATIONAL' | 'PUBLIC' | 'PRIVATE';

/** 교육국제화역량 인증제 (IEQAS). Absent when the institution appears on none of the published lists —
 *  which means "not listed", never "failed". */
export interface IeqasStatus {
  certified: boolean;
  excellent: boolean;
  language_programme: boolean;
}

export interface InstitutionCard {
  slug: string;
  name_ko: string;
  name_en: string | null;
  institution_type: InstitutionKind;
  establishment: Establishment;
  region: string;
  website_url: string | null;
  major_count: number | null;
  ieqas: IeqasStatus | null;
  last_verified: string | null;
  /** Hangyul holds verified admission data for this institution. Not a partnership. */
  has_catalog: boolean;
  /**
   * V20 — the slice of the content record a *result tile* needs: the licensed mark, the hero photograph
   * if this institution has one, the verified introduction video's id, and the city. That is exactly
   * what `resolveUniversityVisual` reads, so a card picks the same visual tier the detail page will,
   * without the list response carrying the whole record 24 times over.
   */
  enrichment?: UniversityContent | null;
  /** V28 (UX_AUDIT MK-6): verified signals only; an absent key means "not verified", never "no". */
  signals?: { scholarships?: number; gks?: true; english_degrees?: true } | null;
}

export interface InstitutionCampus { name_ko: string; role: string; region: string }
export interface InstitutionSource { name: string; url: string; checked?: string; survey_year?: string }

export interface InstitutionDetail extends InstitutionCard {
  registry_name_ko: string | null;
  establishment_source: string | null;
  other_campuses: InstitutionCampus[];
  latitude: number | null;
  longitude: number | null;
  ieqas_checked_on: string | null;
  sources: Partial<Record<'registry' | 'reference' | 'international', InstitutionSource>>;
  /** Counts only. The list of programmes, with eligibility against them, is a signed-in view. */
  catalog?: { programs: number; open_intakes: number };
  /**
   * V17 — verified facts the national registry does not carry, produced offline by
   * `scripts/catalog/enrich_universities.py` and cached on the institution row.
   *
   * **Every field is optional and most are usually absent**, which is the point: coverage is 290/425
   * founding years, 14/425 licensed logos and 10/425 verified channels, and a page composes around what is
   * missing rather than printing an empty row. Each value carries the source it was read from and the date,
   * so anything shown can be attributed.
   */
  enrichment?: (InstitutionEnrichment & UniversityContent) | null;
}

export interface InstitutionMedia {
  url: string; licence: string; file: string;
  width: number | null; height: number | null;
  source: string; verified_at: ISODate;
}

export interface InstitutionEnrichment {
  wikidata_id: string;
  source_url: string;
  verified_at: ISODate;
  name_en?: string;
  website_url?: string;
  founded_year?: number | null;
  student_count?: number;
  city_ko?: string;
  lat?: number; lon?: number;
  /** 교육 이념 / motto, in the institution's own words, with its provenance. */
  motto?: { ko: string | null; en: string | null; source: string; verified_at: ISODate };
  /**
   * V20 — `logo`, `hero`, `youtube` and `media` moved to `UniversityContent`, which the enrichment blob
   * is merged with at seed time (`server/app/seed/institutions.py › CONTENT_OWNED`). They were removed
   * from here rather than kept in both places because the V17 shapes carried no rights classification
   * and the page rendered them anyway — five institutions were serving a CC BY-SA logo with no credit
   * (REPORT §213.2). A shape that cannot express "may this be shown?" must not be the one a renderer
   * reads.
   */
}

export interface DirectoryRegion {
  key: string;
  count: number;
  by_type: Record<InstitutionKind, number>;
}

export interface DirectoryRegions {
  total: number;
  regions: DirectoryRegion[];
}

// ---------- V15: the service plans (single source of truth — see plans.ts) ----------
export * from './plans';
export * from './admissions';
import type { CountedEntitlement, PlanCode, PlanEntitlements } from './plans';

/**
 * What a student's purchased plan promises, what has been delivered, and what is left (REPORT §117).
 *
 * `limit` is the plan's entitlement **plus approved add-ons**; `used` is derived from the records that prove
 * the work happened, never from a counter. `limit: null` means the allowance is not rationed.
 */
export interface EntitlementUse {
  key: CountedEntitlement;
  limit: number | null;
  used: number;
  /** `limit - used`, floored at 0; `null` when the allowance is not rationed. */
  remaining: number | null;
  /** How much of `limit` came from paid add-ons rather than the plan itself. */
  from_add_ons: number;
  /** V29: what bounds a `null` limit — `CONTRACTED_DOCUMENTS` (Premium editing), `TEAM` / `PRIORITY` (follow-up). */
  scope?: string | null;
}

/**
 * V29: an additional service, from offer to delivery. Only `ACTIVE` / `COMPLETED` grant anything; `APPROVED` is the
 * retired V15–V28 state (granted on approval without payment) and no longer written.
 */
export type AddOnStatus = 'OFFERED' | 'AWAITING_PAYMENT' | 'ACTIVE' | 'COMPLETED' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

export interface ServiceAddOn {
  id: UUID;
  /** The catalogue code (`EXTRA_MANAGED_APPLICATION` …); legacy rows carry `ADDON_<KEY>`. */
  code: string;
  entitlement_key: CountedEntitlement | null;
  quantity: number;
  status: AddOnStatus;
  /** What the student pays: unit × quantity, set by the operator inside the catalogue range. */
  amount_minor: number | null;
  unit_amount_minor?: number | null;
  currency: string | null;
  scope?: string | null;
  note: string | null;
  subject_type?: string | null; subject_id?: string | null;
  order_id?: string | null; case_id?: string | null; catalog_version?: string | null;
  created_at: ISODateTime;
  paid_at?: ISODateTime | null; activated_at?: ISODateTime | null; completed_at?: ISODateTime | null;
}

/** V29: the purchased plan as a service instance with a term (REPORT §390). */
export interface Engagement {
  id: UUID; status: string; catalog_version: string; product_code: string; purchase_terms_version: string | null;
  service_started_at: ISODateTime | null; support_window_ends_at: ISODateTime | null; service_ends_at: ISODateTime | null;
  support_days_left: number | null; term_ended: boolean;
  arrival_at: ISODateTime | null; pre_arrival_starts_at: ISODateTime | null; settlement_ends_at: ISODateTime | null;
  arrival_phase: 'BEFORE_PRE_ARRIVAL' | 'PRE_ARRIVAL' | 'SETTLEMENT' | 'SETTLEMENT_ENDED' | null;
  is_current_catalog: boolean;
}

/** The student's commercial state, as both the student app and the agency console read it. */
export interface StudentPlan {
  code: PlanCode;
  name_ko: string;
  name_en: string;
  amount_minor: number;
  currency: string;
  purchased_at: ISODateTime | null;
  /** V29: the contract snapshot — the entitlements as sold, which may be an earlier catalogue's. */
  catalog_version?: string;
  entitlements: PlanEntitlements;
  engagement?: Engagement;
  usage: EntitlementUse[];
  add_ons: ServiceAddOn[];
  /** Staff views only: the internal dedicated owner (Premium). The student always sees the team. */
  dedicated_owner_user_id?: string | null;
}

/** A refusal the UI can explain, rather than an internal error (brief Part 9, 엔타이틀먼트 behaviour). */
export interface EntitlementRefusal {
  entitlement_key: CountedEntitlement;
  limit: number | null;
  used: number;
  /** Whether an add-on may be offered for this key. */
  add_on_available: boolean;
  /** V29: why — LIMIT_REACHED · NOT_INCLUDED · NEW_DOCUMENT · UNMANAGED_APPLICATION · SERVICE_PERIOD_ENDED · NO_PLAN. */
  reason?: string;
  add_on_code?: string | null;
}

/**
 * V15: service delivery, for the manager's Insights (brief Part 15, visual 4).
 *
 * Deliberately not revenue. This answers "how much of what we sold has been delivered, and where are we
 * over", which is an operations question; what the caseload is worth is not.
 */
export interface PlanUtilization {
  caseload: number;
  with_plan: number;
  by_plan: { code: PlanCode; students: number; at_limit: number; over: number; add_ons: number }[];
  at_limit: number;
  over: number;
  open_offers: number;
  unused_follow_ups: number;
  definition: string;
}

/** One concise readiness state per application — never a score (brief Part 10). */
export type ReadinessState = 'READY' | 'CHECKS_REQUIRED' | 'WAITING_UNIVERSITY' | 'WAITING_STUDENT' | 'SUBMITTED';

export interface ApplicationReadiness {
  state: ReadinessState;
  /** Named, actionable blockers. `key` resolves to copy; `detail` carries the specific document or field. */
  blockers: { key: string; detail: string | null; severity: 'BLOCKING' | 'ADVISORY' }[];
}

/* ================================================================================================
 * V20 — the canonical public university content model (brief §5, §42, §54).
 *
 * Produced offline by `scripts/universities/*` into `server/app/data/university_content.json`,
 * merged onto `Institution.enrichment` at seed time and served as-is by the directory API. Every
 * field is optional and carries its own provenance, because coverage is genuinely partial and a
 * surface composes around absence rather than printing an empty row.
 * ============================================================================================== */

/** How far a university content value has got: captured, reviewed by a person, or asserted by a registry. */
export type ContentVerification =
  /** Captured from the named source by the pipeline, not yet read by a person. Never rendered. */
  | 'SOURCE_CAPTURED'
  /** Read against the source by a person and written in Hangyul's own words. Renders. */
  | 'HANGYUL_REVIEWED'
  /** An authoritative registry asserts it (Wikidata statement, 대학알리미 disclosure). Renders. */
  | 'REGISTRY_ASSERTED';

/** Internal provenance, on every factual item. Never rendered to a customer (§43). */
export interface Provenance {
  source_url?: string;
  verified_at?: string;
  verification_status?: ContentVerification;
}

export type MediaKind = 'HERO' | 'CAMPUS' | 'LIBRARY' | 'STUDENT_LIFE' | 'DORMITORY' | 'CITY' | 'REGION_FALLBACK';

/** Licences under which Hangyul may serve a copy with **no visible credit**. Nothing else is listed. */
/**
 * Licences under which Hangyul may serve a copy.
 *
 * V21 adds `ATTRIBUTION_SUPPORTED`. V14's owner rule was "no customer-visible photo credit", which
 * meant only CC0/PD could be hosted — and measured across the register that rule is the single
 * reason 2 of 425 institutions had a photograph (REPORT §228.1). §15 of the V21 brief permits an
 * attribution-bearing licence *"if its attribution terms are intentionally supported"*, so the
 * credit is now part of the design and the licence class is usable. An asset in this class with no
 * author recorded is refused at harvest time, because a credit that cannot be rendered is not
 * support.
 */
export type ServableRights = 'HANGYUL_OWNED' | 'OWNER_AUTHORISED' | 'COMMERCIAL_NO_ATTRIBUTION'
  | 'CC0_PUBLIC_DOMAIN' | 'ATTRIBUTION_SUPPORTED';

/** Everything a credit line needs. Present exactly when the licence requires one. */
export interface MediaAttribution {
  author: string;
  license: string;
  license_url: string;
  source_url: string;
}

/**
 * V25 (REPORT §313 S3): the linked directory institution's hero, as every catalogue-university serializer now carries it, so
 * the student app can show a campus where it used to draw a letter tile. Null when the institution has no photograph.
 */
export interface UniversityPhotoRef {
  /** V26: the widths on file for this asset (240 is the thumbnail rendition). */ renditions?: number[];
  institution_slug: string;
  local_path: string;
  focal_x: number; focal_y: number;
  focal_mobile_x?: number | null; focal_mobile_y?: number | null;
  formats: ('jpg' | 'webp')[];
  width?: number | null; height?: number | null;
  attribution?: MediaAttribution | null;
}

export interface UniversityMedia {
  /** The file stem in `public/media` and the key in `credits.json`. */
  asset: string;
  /** The institution this depicts, or `null` for a city/region asset that depicts no one institution. */
  university_id: string | null;
  kind: MediaKind;
  /** Where the file came from, for the internal audit trail (§42). */
  media_source: string;
  license_or_permission: string;
  rights_status: ServableRights;
  /** True only for a file the institution itself published for reuse. */
  official_asset: boolean;
  attribution_requirement: MediaAttribution | null;
  local_path: string;
  /**
   * `object-position`, **per asset** (§15). A single `center` ruins the two crops that matter: a gate at
   * the bottom of a landscape frame disappears in a 16:10 tile, and a tower at the top disappears in a
   * tall phone hero. Checked at 390, 768 and 1440 by `qa:v20`.
   */
  focal_x: number;
  focal_y: number;
  /**
   * V25 (REPORT §312, brief §12): the focal point for **portrait** crops (the 4:5 phone hero and card). Absent means the
   * landscape point serves both. A tower near the top of a landscape frame needs a lower point on a phone, where the crop
   * keeps the full height and loses the sides.
   */
  focal_mobile_x?: number;
  focal_mobile_y?: number;
  /** i18n key for the alt text. The alt says what the picture **is**, never what we would like it to imply. */
  alt_key: string;
  width: number;
  height: number;
  /** V25: widths that exist on disk, and the formats each width exists in (`webp` beside `jpg`). */
  renditions?: number[];
  formats?: ('jpg' | 'webp')[];
  /**
   * V25 (brief §11): the per-criterion score a person gave this picture when choosing it — 1–5 per criterion and a 0–100
   * total. Internal; never rendered.
   */
  quality?: Record<string, number> | null;
}

export interface IntlFact { value?: boolean | null; evidence?: string; source?: string }
export interface UniversityIntl {
  researched_at?: string;
  links?: Partial<Record<'international_admissions' | 'international_office' | 'scholarship' | 'dormitory' | 'korean_language_institute' | 'official_website', { url: string; source?: string }>>;
  korean_language_program?: IntlFact & { name?: string };
  english_taught_degrees?: IntlFact & { levels?: string[]; detail?: string };
  support_services?: { key: string; evidence?: string; source?: string }[];
  dormitory?: { available?: boolean | null; international_priority?: boolean | null; cost_semester_krw_min?: number | null; cost_semester_krw_max?: number | null;
    capacity?: number | null; note?: string | null; source?: string };
  gks_participating?: IntlFact & { programme?: string };
  sources?: { id: string; url: string; name?: string; kind?: string; publication_date?: string | null }[];
  gaps?: string[];
}

export interface UniversityContent {
  /* identity */
  name_en?: string;
  official_name_ko?: string;
  official_name_en?: string;
  founded_year?: number | null;
  student_count?: number;
  city_ko?: string;
  address?: string;
  lat?: number;
  lon?: number;
  website_url?: string;

  /* official destinations, read from the institution's own site (§27) */
  international_office_url?: string;
  international_admissions_url?: string;
  dormitory_url?: string;
  philosophy_url?: string;
  official_site?: { url: string; status: string; checked: string; pages_read: number };

  /**
   * 교육 이념 — the university's own statement, plus Hangyul's student-facing reading of it.
   *
   * `statement` is the source wording, stored for the audit trail. `summary_ko` / `summary_en` are what a
   * page renders, and they exist only when a person has read the source and written them (§25). A record
   * still at `SOURCE_CAPTURED` has no summary and the section does not appear.
   */
  education_philosophy?: Provenance & {
    heading?: string;
    statement?: string;
    summary_ko?: string;
    summary_en?: string;
  };

  /**
   * A motto or mission the institution's own Wikidata item asserts (P1451), in its own words.
   *
   * Separate from `education_philosophy` on purpose: nobody has interpreted it, so the page renders it
   * as a short attributed quotation rather than as Hangyul's reading of the institution. Promoting a
   * registry string to a paraphrase would be exactly the fabrication §56 asks us to look for.
   */
  motto?: Provenance & { ko?: string | null; en?: string | null };
  /** One sentence that says what this place is. Hangyul's words, from sourced facts; never adjectives. */
  short_identity?: Provenance & { ko?: string; en?: string };
  /** Two or three genuine identity points for §12's "why this university". Each carries its own source. */
  why?: (Provenance & { key: string; ko?: string; en?: string })[];
  /** Founding and the one or two milestones that explain the institution. Not a chronology (§26). */
  history_summary?: Provenance & { ko?: string; en?: string };
  /** Named colleges or fields the institution itself foregrounds. Strings, not a department database. */
  academic_strengths?: string[];

  /* media */
  logo?: Provenance & {
    url: string; licence: string; width: number | null; height: number | null;
    source: string; rights_status: ServableRights | 'ATTRIBUTION_REQUIRED' | 'UNKNOWN';
    local_path?: string;
  };
  media?: {
    /** The full asset, written by the pipeline with its rights and its per-asset focal point. */
    hero?: UniversityMedia;
    gallery?: UniversityMedia[];
    /** Found and refused, with the licence that refused it. Reported internally, never rendered. */
    blocked?: { slot: string; file: string; licence: string }[];
  };

  /**
   * The institution's **own** channel, and the one official video chosen from it.
   *
   * `verified_via` says how ownership was established: `own-site` (the institution links to the channel
   * from its own pages) or `wikidata:P2397` (the knowledge base asserts it on the institution's item).
   * A search result is neither and is never stored (§16).
   */
  youtube?: Provenance & {
    channel_id?: string;
    channel_url: string;
    channel_title?: string;
    video_id?: string;
    video_title?: string;
    verified_via: 'own-site' | 'own-site-rendered' | 'wikidata:P2397';
    /** V23: the largest YouTube poster that exists for this film (probed); `hqdefault` exists for every video. */
    poster?: 'maxresdefault' | 'sddefault' | 'hqdefault';
    /**
     * V25 (REPORT §312 D2): a person looked at the poster. Only a `CAMPUS_SCENE` (the campus, no dominant title text, no
     * presenter) may lead a directory tile; a title card or a portrait is an advert next to campus photographs. The film
     * itself is unaffected and still plays on the detail page. Absent = not reviewed = does not lead.
     */
    poster_review?: 'CAMPUS_SCENE' | 'NOT_CAMPUS_SCENE';
    /** V27: what the film is for. An international-student film outranks the domestic brand film (brief §5). */
    purpose?: 'INTL_RECRUITMENT' | 'INTL_CAMPUS_INTRO' | 'ENGLISH_INTRO' | 'CAMPUS_TOUR' | 'GENERAL_PROMO';
    videos?: { video_id: string; title?: string; purpose: string; language?: string | null }[];
  };
  /** V27 (REPORT §355): verified international-student facts from the institution's official pages. */
  intl?: UniversityIntl;
  /** V27: official GKS participation, from NIIED's own guidelines. */
  gks?: { programmes: { programme: string; notice_url?: string; notice_date?: string; listed_as?: string }[]; source: string };
  /** Links found on the institution's own site before one was chosen. Input to verification, not output. */
  youtube_candidates?: { links: string[]; found_on: string; verified_at: string };

  /* provenance for the record as a whole */
  wikidata_id?: string;
  source_url?: string;
  verified_at?: string;
  sources?: { name: string; url: string }[];
}


/* ================================================================================================
 * V21 — foreign-card payment (brief §26–§42).
 *
 * `CardInput` is the only shape that ever carries card data, it exists for the duration of one
 * request, and **no response type contains it**. `StudentPaymentMethod` is what the server is
 * willing to say about a card afterwards: a brand, four digits and a flag saying whether it can be
 * charged again. There is deliberately no field for a billing key — not optional, not nullable,
 * absent — so no client can render one and no log can serialise one.
 * ============================================================================================== */

export interface CardInput {
  /** Digits only; the form strips spaces before it sends. */
  number: string;
  /** `MM`. */
  expiry_month: string;
  /** `YY`. */
  expiry_year: string;
  holder_name?: string | null;
}

export interface StudentPaymentMethod {
  id: UUID;
  brand: string | null;
  /** `•••• 4242` — Hangyul's own mask, not the provider's longer one. */
  masked_number: string | null;
  last4: string | null;
  issuer_code: string | null;
  card_type: string | null;
  /**
   * Can this card be charged again **without** the student re-entering it? False on the merchant
   * configuration in use, which issues no reusable credential, and the UI must say so rather than
   * offering a "pay with this card" button that cannot work.
   */
  reusable: boolean;
  is_default: boolean;
  status: 'ACTIVE' | 'REVOKED' | string;
  created_at: ISODateTime;
}

/** `GET /me/payments/config` — merchant configuration, by name. Never a key of any kind. */
export interface PaymentsConfig {
  provider: string;
  env: string;
  currency: string;
  usd_readiness: Record<string, boolean>;
  live_usd_checkout_enabled: boolean;
  /**
   * V21 b — may this server activate a plan without a payment (REPORT §243.2)? `false` in production,
   * always. The student app renders its local paid-state button only when this is true *and* the bundle
   * was built with the flag.
   */
  foreign_card: {
    mid: string | null;
    product: string;
    configured: boolean;
    test_ready: boolean;
    live_ready: boolean;
    enabled: boolean;
    /** `"hangyul"` means the card fields are rendered here and there is no provider window. */
    card_form: 'hangyul' | string;
    reusable_credential: boolean;
    used_by_plan_purchase: boolean;
    methods: string[];
  };
  contract: { foreign_card_review: string; live_credentials_configured: boolean };
  methods_offered: string[];
  one_time: { mid: string | null; product: string; configured: boolean; methods: string[]; used_by_plan_purchase: boolean };
  billing: { key: string; mid: string | null; product: string; configured: boolean; used_by_plan_purchase: boolean }[];
}
export * from './refund-policy';
