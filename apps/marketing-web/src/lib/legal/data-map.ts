/**
 * What Hangyul actually processes (V12, brief Part 3 / Part 24).
 *
 * This is not a legal template. Every row was read out of the running code and the live schema, and the audit
 * that produced it is `docs/qa/v12/PRIVACY_DATA_MAP.md`, which is generated from **this file** so the published
 * policy and the engineering audit cannot drift apart. The sources, per category:
 *
 *   account      `server/app/models/identity.py` → `users`
 *   profile      `server/app/models/student.py`  → `student_profiles`, `student_educations`, `student_languages`
 *   documents    `server/app/models/workflow.py` → `documents`, `document_versions`; categories from
 *                `DocumentCategory` in `server/app/models/enums.py`
 *   counselling  `messages`, `essays` + `essay_comments`, `consultations`, `application_status_history`
 *   payment      `server/app/models/business.py` → `orders`, `payments`
 *   automatic    `login_events`, `audit_logs`, `analytics_events`
 *
 * Two findings shape the policy and are worth stating here rather than only in the report:
 *
 *  1. **No card data is processed.** `payments` holds a provider reference, status, amount and a sanitised
 *     payload; checkout is provider-hosted. The policy therefore says what it stores, and does not claim to
 *     hold payment instruments.
 *  2. **There is no third-party analytics, advertising or tracking of any kind.** A repository-wide scan for
 *     Google Analytics, GTM, Segment, Mixpanel, Hotjar, Meta, Sentry, PostHog, Amplitude and Clarity returns
 *     nothing. Browser storage is one httpOnly refresh cookie per app, scoped to `/api/v1/auth`, plus
 *     `localStorage` interface preferences. That is why there is no cookie banner: there is no non-essential
 *     cookie to consent to, and a banner asking permission for nothing is theatre.
 */

export type Recipient = 'HANGYUL' | 'AGENCY' | 'UNIVERSITY' | 'SPONSOR';

export interface DataCategory {
  /** i18n key suffix under `v12.privacy.collect.<key>`. */
  key: string;
  /** The tables this category is actually stored in — rendered in the engineering audit, not on the page. */
  tables: string[];
  /** Field names, for the audit. The page renders the localised plain-language list instead. */
  fields: string[];
  /** Who can receive it, and under what condition. */
  recipients: Recipient[];
  /** True when the category is only populated because the student chose a service that needs it. */
  optional: boolean;
}

export const DATA_CATEGORIES: DataCategory[] = [
  {
    key: 'account',
    tables: ['users', 'user_roles', 'consent_records'],
    fields: ['email', 'email_verified_at', 'password_hash (Argon2id)', 'full_name', 'preferred_name', 'phone (E.164)', 'phone_verified_at', 'locale', 'timezone',
      'last_login_at', 'deletion_requested_at', 'consent purpose/version/granted/locale/document_version/ip_hash/user_agent/source'],
    recipients: ['HANGYUL', 'AGENCY'],
    optional: false,
  },
  {
    key: 'profile',
    tables: ['student_profiles', 'student_educations', 'student_languages'],
    fields: ['nationality', 'residence_country', 'date_of_birth', 'gender', 'passport_number_masked (last 3 characters)',
      'passport_expiry', 'has_passport', 'previous_korean_visa', 'current_korean_visa', 'in_korea_now',
      'target_degree', 'target_intake_year/term', 'desired_fields', 'preferred_regions', 'preferred_university_ids',
      'annual_budget_krw', 'needs_scholarship', 'housing_preference', 'financial_sponsor', 'academic_priorities',
      'career_goal', 'korean_self_level', 'english_self_level',
      'education: level/institution/country/major/years/graduation_status/gpa_value/gpa_scale/gpa_percent',
      'language test + score'],
    recipients: ['HANGYUL', 'AGENCY', 'UNIVERSITY'],
    optional: false,
  },
  {
    key: 'documents',
    tables: ['documents', 'document_versions', 'application_documents', 'document_reviews', 'audit_logs'],
    fields: ['category (24 kinds: passport, national ID, photo, transcript, graduation and expected-graduation',
      'certificates, family-relation and birth certificates, bank statement, sponsor document, employment and',
      'income proof, TOPIK/IELTS/TOEFL reports, recommendation, personal statement, study plan, CV, apostille,',
      'notarisation, certified translation, residence card, visa, admission letter, other)',
      'title', 'issuing_country', 'issue_date', 'expires_on', 'language', 'the uploaded file itself',
      'review status and rejection_reason'],
    recipients: ['HANGYUL', 'AGENCY', 'UNIVERSITY'],
    optional: false,
  },
  {
    key: 'counselling',
    tables: ['messages', 'message_attachments', 'conversations', 'essays', 'essay_versions', 'essay_comments',
      'appointments', 'application_status_history', 'tasks'],
    fields: ['message bodies and attachments', 'essay and study-plan drafts and their revision history',
      'counsellor review comments', 'consultation notes and outcomes', 'application progress records',
      'university requests'],
    recipients: ['HANGYUL', 'AGENCY', 'UNIVERSITY'],
    optional: false,
  },
  {
    key: 'payment',
    // No card number, expiry, CVC or billing address is stored anywhere: checkout is hosted by the provider and
    // only its reference comes back. `raw` is a sanitised provider payload.
    tables: ['orders', 'payments', 'service_cases'],
    fields: ['order contents and amount', 'currency', 'payment status', 'provider name', 'provider transaction reference',
      'sanitised provider payload', 'refund records'],
    recipients: ['HANGYUL'],
    optional: true,
  },
  {
    // V22: one-time codes for email and mobile verification. The code itself is never stored (an HMAC is); the
    // target is kept for the life of the challenge and purged after 24 hours (`services/verification.purge_expired`).
    key: 'verification',
    tables: ['verification_challenges'],
    fields: ['email address or mobile number (E.164) being verified', 'HMAC of the one-time code (never the code)', 'purpose and channel',
      'sent/expiry/attempt/consumed timestamps', 'hashed requesting IP', 'provider message id and delivery state'],
    recipients: ['HANGYUL'],
    optional: false,
  },
  {
    key: 'security',
    tables: ['auth_security_events'],
    fields: ['hashed email', 'hashed IP', 'event kind (throttle, CAPTCHA escalation, code-attempt limit)', 'time'],
    recipients: ['HANGYUL'],
    optional: false,
  },
  {
    key: 'automatic',
    tables: ['login_events', 'audit_logs', 'analytics_events'],
    fields: ['IP address', 'user agent', 'sign-in time and result', 'client application',
      'record access, review and export events with the data subject', 'service-usage events and their properties'],
    recipients: ['HANGYUL'],
    optional: false,
  },
];

/**
 * Third parties that can receive personal information, and the state in the product that puts them there.
 * A recipient is listed on the page only when the student's own case has reached that state — which is what
 * brief Part 3 means by "the application sharing state in the backend must control the truth". Hangyul does not
 * claim every university or agency receives every document.
 */
export const DISCLOSURES = [
  { key: 'agency', consent: 'SHARE_WITH_AGENCY', trigger: 'the student buys a plan that includes agency support, or accepts an assignment' },
  { key: 'university', consent: 'SHARE_WITH_UNIVERSITY', trigger: 'the student submits an application to that university' },
  { key: 'sponsor', consent: 'sponsor-link create/revoke record', trigger: 'the student creates a read-only, expiring sponsor link and chooses its scopes' },
] as const;

/**
 * Processors (수탁자) and overseas transfers (국외 이전), V22.
 *
 * Until V22 this list was empty, and the policy said so. Email verification (Twilio SendGrid), mobile verification
 * (Twilio Programmable Messaging) and automated-signup protection (Cloudflare Turnstile) changed that: an email
 * address, a mobile number and the CAPTCHA signals leave Korea for the United States every time someone signs up.
 * Each row carries the items 개인정보 보호법 제28조의8② requires a transfer disclosure to state (docs/legal/
 * V22_LEGAL_RESEARCH.md §7, verified 2026-10-23 against the vendors' own legal pages). The legal basis recorded is
 * 제28조의8①3 (계약 체결·이행을 위한 처리위탁, disclosed in this policy per 시행령 제31조①2); the signup screen
 * additionally asks the person to acknowledge the notice. `retention` is the vendor's published figure; where the
 * vendor publishes none the field says so rather than guessing.
 */
export interface Processor {
  key: 'twilio_sms' | 'sendgrid' | 'turnstile' | 'tosspayments';
  name: string;
  /** Legal entity, address and privacy contact — the 제28조의8②3 "이전받는 자의 성명 및 연락처". */
  entity: string;
  address: string;
  contact: string;
  /** ISO country codes of processing; rendered as names in the viewer's language. */
  countries: string[];
  /** Vendor's published retention; `null` when nothing is published. Rendered through
   *  `v23.privacy.retention.<key>` so the Korean page never shows an English cell (V23 §268 P4). */
  retention: string | null;
  /** Links a reader can check. */
  privacyUrl: string;
  dpaUrl: string;
  /** PIPA basis: 제28조의8①3 for an overseas transfer; 제26조 (처리위탁) for a domestic processor. */
  basis: '28-8-1-3' | '26';
}

export const PROCESSORS: Processor[] = [
  {
    key: 'twilio_sms', name: 'Twilio Programmable Messaging', entity: 'Twilio Inc.',
    address: '101 Spear Street, 5th Floor, San Francisco, CA 94105, United States', contact: 'privacy@twilio.com',
    countries: ['US'], retention: 'message logs 13 months (400 days) by default; Hangyul requests content redaction',
    privacyUrl: 'https://www.twilio.com/en-us/legal/privacy', dpaUrl: 'https://www.twilio.com/en-us/legal/data-protection-addendum', basis: '28-8-1-3',
  },
  {
    key: 'sendgrid', name: 'Twilio SendGrid', entity: 'Twilio Inc.',
    address: '101 Spear Street, 5th Floor, San Francisco, CA 94105, United States', contact: 'privacy@twilio.com',
    countries: ['US'], retention: 'recipient data up to 37 days; pseudonymised event data up to 1 year',
    privacyUrl: 'https://www.twilio.com/en-us/legal/privacy', dpaUrl: 'https://www.twilio.com/en-us/legal/data-protection-addendum', basis: '28-8-1-3',
  },
  {
    key: 'turnstile', name: 'Cloudflare Turnstile', entity: 'Cloudflare, Inc.',
    address: '101 Townsend St., San Francisco, CA 94107, United States', contact: 'privacyquestions@cloudflare.com',
    countries: ['US'], retention: null,
    privacyUrl: 'https://www.cloudflare.com/turnstile-privacy-policy/', dpaUrl: 'https://www.cloudflare.com/cloudflare-customer-dpa/', basis: '28-8-1-3',
  },
];

/** Statutory commerce records under Korean law, applicable once Hangyul is the seller of record. */
export const STATUTORY_RECORDS = [
  { key: 'advertising', months: 6 },
  { key: 'contract', years: 5 },
  { key: 'payment', years: 5 },
  { key: 'complaint', years: 3 },
] as const;

/**
 * **Domestic processors** (V23, REPORT §268 P3). Since V21 a plan is bought with card details typed into Hangyul's own
 * form and relayed by Hangyul's server to Toss Payments' key-in API (`POST /v1/payments/key-in`); Toss is therefore a
 * processor (개인정보 보호법 제26조) and is disclosed in §4. It is in Korea, so it is **not** an overseas transfer and is
 * not listed in §5. Entity, address and privacy policy read from tosspayments.com's own footer on 2026-10-25
 * (사업자등록번호 411-86-01799).
 */
export const DOMESTIC_PROCESSORS: Processor[] = [
  {
    key: 'tosspayments', name: 'Toss Payments', entity: '토스페이먼츠 주식회사',
    address: '서울특별시 강남구 테헤란로 131, 14층 (역삼동, 한국지식재산센터)', contact: 'https://pages.tosspayments.com/terms/homepage/privacy/policy',
    countries: ['KR'], retention: null,
    privacyUrl: 'https://pages.tosspayments.com/terms/homepage/privacy/policy', dpaUrl: 'https://pages.tosspayments.com/terms/homepage/privacy/policy', basis: '26',
  },
];
