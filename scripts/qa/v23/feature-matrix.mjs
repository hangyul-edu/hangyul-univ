// V23 — the functional completeness matrix (brief §44–§45): docs/qa/v23/FEATURE_COMPLETENESS.csv.
//
// One row per customer-facing feature. Every cell names its evidence — a test file, a gate section or a crawl — and the
// script refuses to write the CSV if a cited file does not exist. Allowed statuses: COMPLETE, BLOCKED_EXTERNAL,
// NOT_APPLICABLE. "n/a" in a cell means the condition does not exist for that feature (a static page has no empty state).
//
// Evidence vocabulary
//   e2e:<spec>         e2e/<spec>.spec.ts (Playwright, run by test:release)
//   pytest:<file>      server/tests/<file>.py
//   vitest:<path>      a unit/integration test file
//   errm:<page>        scripts/qa/v19/error-matrix.mjs page (loading · empty · partial · offline · 401 · 403 · 404 · 409 · 422 · 429 · 500 · timeout)
//   crawl              scripts/qa/v23/crawl.mjs (390/768/1440; renders, no console error, no overflow, no dead link)
//   v23:<SECTION>      scripts/qa/v23-gate.mjs section
//   v22 / v21 / v20     the earlier gates still in test:release
//   l10n               v23 LOCALIZATION (priority keys present in 33/33 markets) + qa:v18-locales core
//   qstate             the screen renders through @hangyul/ui QueryState (loading skeleton + ErrorState with retry)
//   emu                Android emulator smoke on the V23 preview APK (REPORT §283)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const C = 'COMPLETE'; const B = 'BLOCKED_EXTERNAL'; const N = 'NOT_APPLICABLE';

// product, route, feature, api, happy, empty, loading, permission, network, mobile, translation, tests, status
const R = [
  // ------------------------------------------------------------------------------------------- marketing
  ['Marketing', '/', 'Home: one conversion action (내 유학 준비), services, FAQ', 'GET /public/*', 'e2e:v11-marketing; e2e:v13-hierarchy', 'n/a', 'n/a (static)', 'n/a (public)', 'n/a (static)', 'crawl 390/768', 'l10n', 'e2e:v11-marketing; e2e:v13-hierarchy; crawl', C],
  ['Marketing', '(footer)', 'Social media block (YouTube·Instagram·TikTok·Reddit·Facebook, owner config)', 'none', 'v23:MARKETING', 'n/a', 'n/a', 'n/a', 'external links open in new tab', 'v23:MARKETING (390, 1440)', 'l10n (heading + label ×33)', 'v23:MARKETING', C],
  ['Marketing', '/universities', 'Search by name', 'GET /directory/institutions?q', 'v23:DISCOVERY; crawl', 'EmptyState + "전국" reset (crawl ?q=zzzz)', 'SkeletonCard ×6', 'n/a (public)', 'ErrorState + retry', 'v23:DISCOVERY 360–1728', 'l10n', 'e2e:v12-directory-legal; v23:DISCOVERY; crawl', C],
  ['Marketing', '/universities', 'Region groups, 17 regions (sheet on phones), institution type, map', 'GET /directory/regions, /directory/institutions', 'v23:DISCOVERY (sheet)', 'EmptyState', 'SkeletonCard', 'n/a', 'ErrorState + retry', 'v23:DISCOVERY phone sheet', 'l10n', 'e2e:v12-directory-legal; v23:DISCOVERY', C],
  ['Marketing', '/universities', '425 tiles with an intentional visual (photo · official film · identity composition)', 'GET /directory/institutions', 'v23:DISCOVERY 425/425', 'n/a', 'lazy images', 'n/a', 'film poster from YouTube; identity needs no network image', 'v23:DISCOVERY', 'l10n', 'v23:DISCOVERY; UNIVERSITY_VISUAL_COVERAGE.csv', C],
  ['Marketing', '/universities/:slug', 'University detail (hero, facts, links, gallery, film facade) — 425 routes', 'GET /directory/institutions/{slug}', 'v23:DISCOVERY 425×200', 'sections omitted when unsourced', 'route skeleton', 'n/a', 'ErrorState + retry', 'v23:DISCOVERY overflow; crawl', 'l10n', 'e2e:v12-directory-legal; v20; v23:DISCOVERY', C],
  ['Marketing', '/start', 'Free eligibility check (no account)', 'POST /public/quick-eligibility', 'e2e:v16-journey', 'result "no programme yet" copy', 'button loading', 'n/a', 'error callout', 'crawl 390', 'l10n', 'e2e:v16-journey; crawl', C],
  ['Marketing', '/privacy, /terms', 'Legal pages (processors incl. Toss Payments, statutory refunds)', 'none', 'v23:LEGAL', 'n/a', 'n/a', 'n/a', 'n/a', 'crawl 390', 'ko/en (Korean text governs; other markets read English by design)', 'vitest:apps/marketing-web/src/test/v12-legal.test.ts; v23:LEGAL', C],
  ['Marketing', '(all)', 'Language selection, ?lang= URL', 'none', 'v14 locale-url', 'n/a', 'n/a', 'n/a', 'n/a', 'v14', 'l10n', 'v14', C],
  // --------------------------------------------------------------------------------------------- student
  ['Student', '/register', '4-step verified sign-up (email + SMS codes, consents)', 'POST /auth/signup/session, /auth/verification/*, /auth/register', 'e2e:v16-journey; pytest:test_v22_registration', 'n/a', 'step buttons loading', 'rate limits → localized message', 'retry per step; draft kept', 'crawl 390', 'v22 (33/33)', 'pytest:test_v22_registration; e2e:v16-journey; v22', C],
  ['Student', '/register', 'Live email/SMS/CAPTCHA delivery', 'SendGrid, Twilio, Turnstile', 'BLOCKED: provider credentials not on host', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'v22 provider smoke (prints BLOCKED)', B],
  ['Student', '/login', 'Sign in', 'POST /auth/login', 'v23:TEST ACCESS', 'n/a', 'button loading', 'invalid → localized', 'error callout', 'crawl 390', 'l10n', 'pytest:test_v23_environment; v23:TEST ACCESS', C],
  ['Student', '/forgot', 'Password reset', 'POST /auth/forgot-password, /auth/reset-password', 'pytest:test_v22_registration (test_forgot_and_reset_password)', 'n/a', 'button loading', 'always 202', 'error callout', 'crawl 390', 'l10n', 'pytest:test_v22_registration; crawl', C],
  ['Student', '/', 'Home: stage journey, one next action, team card', 'GET /me/dashboard', 'e2e:v3-student', 'qstate', 'qstate (HomeSkeleton)', 'errm:home 401/403', 'errm:home offline/500/timeout', 'crawl 390', 'l10n', 'e2e:v3-student; errm:home; crawl', C],
  ['Student', '/explore', 'Free university recommendations (matching) and catalogue', 'GET /me/matches, /programs', 'e2e:v3-student', 'errm:explore empty', 'errm:explore loading', 'errm:explore 401/403', 'errm:explore offline/500', 'crawl 390', 'l10n', 'e2e:v3-student; errm:explore', C],
  ['Student', '/explore?tab=saved', 'Save / unsave a university', 'POST/DELETE /me/saved', 'e2e:v3-student', 'EmptyState', 'qstate', 'n/a', 'toast + retry', 'crawl 390', 'l10n', 'e2e:v3-student', C],
  ['Student', '/universities/:slug', 'University detail inside the app', 'GET /universities/{slug}', 'e2e:redesign', 'EmptyState', 'qstate', 'n/a', 'qstate', 'crawl 390', 'l10n', 'e2e:redesign; crawl', C],
  ['Student', '/compare', 'Compare shortlisted programmes, budget', 'GET /me/compare', 'e2e:v3-student', 'EmptyState', 'qstate', 'n/a', 'qstate', 'crawl 390', 'l10n', 'e2e:v3-student; crawl', C],
  ['Student', '/services', 'Select Basic / All-in-One / Premium; real Toss test payment (foreign card key-in)', 'POST /me/orders, /me/orders/{id}/pay-with-card', 'pytest:test_v21_foreign_card; v21', 'n/a', 'button loading', 'decline → localized, order kept; 8 attempts/300 s', 'errm:services; no raw transport message (v23:STUDENT)', 'crawl 390', 'l10n', 'pytest:test_v21_foreign_card; errm:services; v21', C],
  ['Student', '/services/payment/*', 'Payment success / failure / retry', 'POST /me/payments/toss/confirm', 'v21', 'n/a', 'loading', 'n/a', 'retry link', 'crawl 390', 'l10n', 'v21; v16', C],
  ['Student', '(live)', 'Live USD card payment', 'Toss live MID', 'BLOCKED: live keys, card review, overseas-card USD contract (owner + Toss)', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'release:check', B],
  ['Student', '/documents', 'Upload, replace, see review status', 'GET/POST /documents', 'e2e:v5-dossier', 'errm:documents empty', 'errm:documents loading', 'errm:documents 403', 'errm:documents offline/500', 'crawl 390', 'l10n', 'e2e:v5-dossier; e2e:v3-student; errm:documents', C],
  ['Student', '/applications, /applications/:id', 'Follow applications; lanes You · Hangyul Univ team · University', 'GET /applications', 'e2e:v5-flow-a; e2e:v6-submission', 'errm:applications empty', 'errm:applications loading', 'errm:applications 403', 'errm:applications offline/500', 'crawl 390', 'l10n', 'e2e:v5-flow-a; errm:applications', C],
  ['Student', '/essays', 'Essay / study-plan review with team comments', 'GET/PUT /essays', 'e2e:v5-writing; e2e:v6-writing', 'errm:essays empty', 'errm:essays loading', 'errm:essays 403', 'errm:essays offline/500', 'crawl 390', 'l10n', 'e2e:v6-writing; errm:essays', C],
  ['Student', '/messages', 'Messages with 한귤 유니브 상담팀', 'GET/POST /conversations', 'e2e:v3-student', 'errm:messages empty', 'errm:messages loading', 'errm:messages 403', 'errm:messages offline/500', 'crawl 390', 'l10n', 'e2e:v3-student; errm:messages; v22 identity', C],
  ['Student', '/notifications', 'Notifications', 'GET /notifications', 'e2e:v6-writing', 'errm:notifications empty', 'errm:notifications loading', 'errm:notifications 403', 'errm:notifications offline/500', 'crawl 390', 'l10n', 'errm:notifications; crawl', C],
  ['Student', '/visa', 'Visa preparation (route, pack, appointment)', 'GET /visa', 'e2e:v5-visa', 'qstate', 'errm:visa loading', 'errm:visa 403', 'errm:visa offline/500', 'crawl 390', 'l10n', 'e2e:v5-visa; e2e:v5-myanmar; errm:visa', C],
  ['Student', '/housing', 'Housing from named providers', 'GET /me/housing', 'e2e:v5-arrival', 'EmptyState', 'qstate', 'n/a', 'qstate', 'crawl 390', 'l10n', 'e2e:v5-arrival; e2e:v5-flow-g', C],
  ['Student', '/arrival', 'Arrival: flight, pickup, residence card', 'GET/PUT /me/arrival', 'e2e:v5-arrival', 'EmptyState', 'qstate', 'n/a', 'qstate', 'crawl 390', 'l10n', 'e2e:v5-arrival; crawl', C],
  ['Student', '/profile, /settings', 'Profile, language, consents, data export/delete', 'GET/PUT /me/profile, /me/consents, /me/data-requests', 'e2e:v3-student', 'n/a', 'qstate / Skeleton', 'n/a', 'ErrorState + retry (V23 S3)', 'crawl 390', 'l10n', 'errm:profile; crawl', C],
  ['Student', '/family, /scholarships, /help, /support', 'Family link, scholarships, help, support', 'GET /me/family, /me/scholarships, /help', 'crawl', 'EmptyState', 'qstate', 'n/a', 'qstate', 'crawl 390', 'l10n', 'crawl', C],
  // ---------------------------------------------------------------------------------------------- agency
  ['Agency', '/login', 'Sign in', 'POST /auth/login', 'v23:TEST ACCESS', 'n/a', 'button loading', 'production 404', 'error callout', 'crawl 390', 'ko/en (console namespaces) + priority keys ×33', 'v23:TEST ACCESS', C],
  ['Agency', '/', 'Today: process strip whose counts open exactly those students; work table', 'GET /agency/stage-counts, /agency/students', 'v23:AGENCY (counts = rows)', 'EmptyState + clear filters', 'skeleton', 'role gate (AGENCY_ADMIN)', 'qstate', 'crawl 390/768/1728', 'priority keys ×33', 'v23:AGENCY; e2e:v3-agency; v22', C],
  ['Agency', '/students, /students/:id', 'Student management and case workspace (end-to-end case)', 'GET /agency/students/*', 'e2e:v3-agency; e2e:lifecycle', 'EmptyState', 'skeleton', 'tenant 404', 'qstate', 'crawl 390', 'priority keys ×33', 'e2e:v3-agency; e2e:lifecycle', C],
  ['Agency', '/review', 'Work: documents, writing, applications (+ submissions queue link)', 'GET /documents/review-queue, /essays, /applications', 'e2e:v3-agency; e2e:v6-submission', 'EmptyState', 'skeleton', 'tenant 404', 'qstate', 'crawl 390', 'priority keys ×33', 'e2e:v3-agency; e2e:v6-writing; e2e:v6-submission', C],
  ['Agency', '/messages', 'Messages (students see the team identity; audit keeps the actor)', 'GET/POST /conversations', 'e2e:v3-agency', 'EmptyState', 'skeleton', 'tenant 404', 'qstate', 'crawl 390', 'priority keys ×33', 'v22 identity; e2e:v3-agency', C],
  ['Agency', '/performance', 'Insights with drill-downs (member, intake filters honoured)', 'GET /agency/analytics', 'crawl; v23 static A2/A3', 'insufficient-sample note', 'skeleton', 'role gate', 'qstate', 'crawl 1728', 'priority keys ×33', 'crawl; v23:AGENCY', C],
  ['Agency', '/manage, /settings, /team, /templates, /payments, /audit, /tasks, /notifications', 'Settings hub and its pages', 'various /agency/*', 'crawl', 'EmptyState', 'skeleton', 'role gate', 'qstate', 'crawl 390', 'priority keys ×33', 'crawl; pytest:test_v22_roles', C],
  // ------------------------------------------------------------------------------------------ university
  ['University', '/login', 'Sign in', 'POST /auth/login', 'v23:TEST ACCESS', 'n/a', 'button loading', 'production 404', 'error callout', 'crawl 390', 'priority keys ×33', 'v23:TEST ACCESS', C],
  ['University', '/', 'Applicants: pipeline strip whose counts open exactly those applicants; table', 'GET /applications', 'v22; e2e:v3-university', 'EmptyState', 'skeleton', 'tenant 404', 'qstate', 'crawl 390/1728', 'priority keys ×33', 'v22; e2e:v3-university', C],
  ['University', '/applications/:id', 'Review and decide a Hangyul applicant; request documents', 'GET /applications/{id}, POST /transition, /document-requests', 'e2e:v3-university', 'n/a', 'skeleton', 'cross-tenant 404', 'qstate', 'crawl 390', 'priority keys ×33', 'e2e:v3-university; e2e:tenancy', C],
  ['University', '/', 'Export filtered = exactly the table', 'GET /university/export/applications.csv', 'pytest:test_v23_university', 'header-only CSV', 'button loading', 'tenant scoped (pytest)', 'toast', 'n/a', 'n/a', 'pytest:test_v23_university', C],
  ['University', '/analytics', 'Insights by question; every bar opens its applicants', 'GET /university/metrics, /analytics', 'v23:UNIVERSITY', 'empty copy', 'skeleton', 'tenant scoped', 'qstate', 'crawl 390/1728', 'priority keys ×33', 'v23:UNIVERSITY; crawl', C],
  ['University', '/cohorts/*', 'After enrolment: cohort table → that cohort\'s students; risk; visa expiry', 'GET /university/cohorts', 'v23:UNIVERSITY', 'EmptyState', 'skeleton', 'tenant scoped', 'qstate', 'crawl 390', 'priority keys ×33', 'v23:UNIVERSITY; crawl', C],
  ['University', '/messages, /manage, /settings, /programs, /exports …', 'Messages and settings pages', 'various /university/*', 'crawl', 'EmptyState', 'skeleton', 'tenant scoped', 'qstate', 'crawl 390', 'priority keys ×33', 'crawl; pytest:test_security', C],
  ['University', '(all)', 'No cross-tenant leakage', 'all /university/* and /applications', 'e2e:tenancy; pytest:test_security; pytest:test_v23_university', 'n/a', 'n/a', '404 policy', 'n/a', 'n/a', 'n/a', 'e2e:tenancy; pytest:test_security; pytest:test_v23_university', C],
  // -------------------------------------------------------------------------------------------- native
  ['Student native', '(auth)', 'Native verified sign-up', 'same four endpoints', 'vitest:apps/student-mobile/src/signup/state.test.ts; v22 emulator walk', 'n/a', 'step loading', 'localized limits', 'resend/retry', 'native', 'mobile:signup ×33', 'vitest:apps/student-mobile/src/signup/state.test.ts', C],
  ['Student native', '(auth)', 'Sign in', '/auth/login', 'emu', 'n/a', 'button loading', 'production bundle has none (v23:NATIVE)', 'network error callout', 'native', 'inline copy (dev-only)', 'v23:NATIVE; emu', C],
  ['Student native', '(tabs)', 'Home, universities/matching, applications, messages, more (documents upload, visa, tasks, saved, notifications, plan hand-off, housing/arrival on web, profile, settings, language)', 'same API as web', 'emu; typecheck', 'EmptyState', 'LoadingState', 'n/a', 'offline cache + ErrorState', 'native', 'mobile ×33', 'v18; v22; emu', C],
  ['Agency native', '(tabs)', '오늘 · 학생 · 지원·서류 · 메시지 · 설정 (one role)', '/agency/today, /documents/review-queue …', 'emu; typecheck', 'EmptyState', 'LoadingState', 'server enforces', 'ErrorState', 'native', 'mobile (ko/en; others fall back)', 'v23:NATIVE; emu', C],
  ['University native', '(tabs)', '지원자 · 메시지 · 현황 · 설정 (one role)', '/university/attention, /applications …', 'emu; typecheck', 'EmptyState', 'LoadingState', 'server enforces', 'ErrorState', 'native', 'mobile (ko/en; others fall back)', 'v23:NATIVE; emu', C],
  ['Native', '(Android)', 'APK + AAB for student, agency, university (QA-signed)', 'n/a', 'result/*/android, BUILD_INFO.json', 'n/a', 'n/a', 'n/a', 'n/a', 'native', 'n/a', 'emu', C],
  ['Native', '(Android store)', 'Play-signed upload + production API origin', 'n/a', 'BLOCKED: upload keystore and production HTTPS API origin (owner)', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', B],
  ['Native', '(iOS)', 'iOS builds (simulator / IPA)', 'n/a', 'BLOCKED: EAS not authenticated, no Apple credentials (docs/qa/v23/IOS_BUILD_BLOCKER.md)', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', B],
  ['Native', '(web)', 'Web push / web build of the native apps', 'n/a', 'not a product surface', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a', N],
];

const COLS = ['product', 'route', 'feature', 'api', 'happy_path', 'empty_state', 'loading_state', 'permission_denied', 'network_failure', 'mobile', 'translation', 'test_coverage', 'status'];
const problems = [];
for (const r of R) {
  if (r.length !== COLS.length) problems.push(`column count ${r.length}: ${r[2]}`);
  if (![C, B, N].includes(r[12])) problems.push(`status ${r[12]}`);
  for (const cell of r.slice(4, 12)) {
    for (const m of String(cell).matchAll(/e2e:([\w-]+)/g)) if (!fs.existsSync(path.join(ROOT, 'e2e', `${m[1]}.spec.ts`))) problems.push(`missing e2e/${m[1]}.spec.ts`);
    for (const m of String(cell).matchAll(/pytest:(\w+)/g)) if (!fs.existsSync(path.join(ROOT, 'server/tests', `${m[1]}.py`))) problems.push(`missing server/tests/${m[1]}.py`);
    for (const m of String(cell).matchAll(/vitest:([\w/.-]+)/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push(`missing ${m[1]}`);
  }
}
if (problems.length) { console.error([...new Set(problems)].join('\n')); process.exit(1); }
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(ROOT, 'docs/qa/v23/FEATURE_COMPLETENESS.csv'), [COLS.join(','), ...R.map((r) => r.map(csv).join(','))].join('\n') + '\n');
const count = (s) => R.filter((r) => r[12] === s).length;
console.log(`${R.length} features: ${count(C)} COMPLETE, ${count(B)} BLOCKED_EXTERNAL, ${count(N)} NOT_APPLICABLE`);
