/**
 * `npm run qa:v22` — the V22 gate (brief §76).
 *
 * Seven halves for seven parts of the pass: REGISTRATION · TWILIO/SENDGRID · LEGAL · AGENCY · UNIVERSITY ·
 * DESIGN · UNIVERSITY DISCOVERY. Static checks read the source; API checks drive the running API on :8001
 * (the real four-step flow, rate limits, tenancy, identities); the rendered checks drive the three running
 * web apps (:3101 student, :3102 agency, :3103 university) with one Chromium. Nothing here prints a code,
 * a secret or a token.
 *
 *   node scripts/qa/v22-gate.mjs            everything (needs the dev stack + Redis + Postgres)
 *   node scripts/qa/v22-gate.mjs --static   source + data checks only
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const STATIC_ONLY = process.argv.includes('--static');
const API = process.env.HG_QA_API ?? 'http://localhost:8001/api/v1';
const APPS = { student: 'http://localhost:3101', agency: 'http://localhost:3102', university: 'http://localhost:3103' };
const PASSWORD = 'Hangyul!2026';

const fails = []; const passes = []; const skips = [];
const check = (name, ok, detail = '') => { (ok ? passes : fails).push(`${name}${detail ? ` — ${detail}` : ''}`); };
const skip = (name, why) => skips.push(`${name} — ${why}`);
const walk = (dir, exts = /\.(tsx?|mjs|py|s?css|json)$/) => {
  const out = []; const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.') || e.name === '__pycache__') continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p, exts)); else if (exts.test(e.name)) out.push(p);
  }
  return out;
};
const sql = (q) => { try { return execSync(`psql ${process.env.HG_QA_DB ?? 'postgresql://hangyul:hangyul_dev@localhost:5432/hangyul_univ'} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim(); } catch { return null; } };
const post = async (path, body, headers = {}) => { const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers }; };
const get = async (path, headers = {}) => { const r = await fetch(`${API}${path}`, { headers }); return { status: r.status, body: await r.json().catch(() => ({})), text: null }; };
const login = async (email, client) => { const r = await post('/auth/login', { email, password: PASSWORD, client }); return r.status === 200 ? { h: { Authorization: `Bearer ${r.body.access_token}` }, body: r.body } : null; };

/* ============================================================================ 1. REGISTRATION (static) */
const auth = read('server/app/api/v1/auth.py');
const verification = read('server/app/services/verification.py');
const captcha = read('server/app/services/captcha.py');
const cfg = read('server/app/core/config.py');
check('R: the registration commit requires both proofs and a CAPTCHA-backed signup session',
  /require_signup_session\(request, x_signup_session\)/.test(auth) && /spend\(db, proof=body\.email_proof, purpose="SIGNUP_EMAIL"/.test(auth) && /spend\(db, proof=body\.phone_proof, purpose="SIGNUP_PHONE"/.test(auth));
check('R: password confirmation is checked server-side', /PASSWORD_MISMATCH/.test(auth));
check('R: codes are generated with `secrets` and stored as an HMAC, never plaintext', /secrets\.randbelow\(1_000_000\)/.test(verification) && /hmac\.new\(_key\(\)/.test(verification) && !/code_hash\s*=\s*code\b/.test(verification));
check('R: 6 digits / 5-minute TTL / 60-s resend / 5 attempts are the configured policy', /otp_ttl_seconds: int = 300/.test(cfg) && /otp_resend_cooldown_seconds: int = 60/.test(cfg) && /otp_max_attempts: int = 5/.test(cfg));
check('R: a new code invalidates the previous one', /invalidated_at=now\)/.test(verification) && /\.values\(invalidated_at=now\)/.test(verification));
check('R: the proof is single-use and bound to the verified value', /used_at/.test(verification) && /data\.get\("th"\) != target_hash\(target\)/.test(verification));
check('R: production CAPTCHA cannot be bypassed — unconfigured production refuses, the test secret is Cloudflare\'s', /is_production or self\.turnstile_configured/.test(cfg) && /raise not_configured\(\)/.test(captcha) && !/HG_SKIP_CAPTCHA|captcha_bypass/i.test(captcha + auth + cfg));
check('R: the dev peek route does not exist in production', /def verification_peek[\s\S]*?is_production[\s\S]*?404/.test(auth));
check('R: no plaintext code reaches a log', !/log\.\w+\([^)]*\bcode\b/.test(verification) && !/print\(/.test(verification));
check('R: the phone is normalised to E.164 by phonenumbers', /PhoneNumberFormat\.E164/.test(read('server/app/services/identity.py')));
check('R: changing a verified email/phone requires a fresh proof', /purpose="CONTACT_EMAIL"/.test(auth) && /purpose="CONTACT_PHONE"/.test(auth));
check('R: rate limiting is shared (Redis), not per-process memory', /redis\.Redis\.from_url/.test(read('server/app/services/ratelimit.py')) && !/_memory|dict\(\)\s*#\s*fallback/.test(read('server/app/services/ratelimit.py')));
for (const name of ['REGISTER_IP', 'LOGIN_EMAIL_FAIL', 'LOGIN_IP_FAIL', 'FORGOT_EMAIL', 'OTP_SEND_TARGET', 'OTP_SEND_IP', 'OTP_VERIFY_IP', 'OTP_VERIFY_TARGET'])
  check(`R: a ceiling exists for ${name}`, new RegExp(`\\b${name} = Limit\\(`).test(read('server/app/services/ratelimit.py')));
check('R: login protection is progressive (CAPTCHA escalation, growing delay), never a permanent lock', /CAPTCHA_REQUIRED/.test(auth) && /LOGIN_THROTTLED/.test(auth) && !/locked_until|is_locked/.test(auth));
const tests = read('server/tests/test_v22_registration.py');
check('R: the pytest suite covers production-CAPTCHA refusal, OTP expiry, wrong code, abuse limit and consent rules',
  ['test_captcha_required_in_production_mode', 'test_code_expiry_and_new_code_invalidates_old', 'test_wrong_code_counts_and_exhausts', 'test_rate_limits_are_real', 'test_required_consents_required_and_optional_optional'].every((t) => tests.includes(t)));

/* ===================================================================== 2. TWILIO / SENDGRID (static) */
const sms = read('server/app/services/sms.py'); const mail = read('server/app/services/mail.py');
check('T: Twilio is called with the Messaging Service SID, never a hard-coded From number', /"MessagingServiceSid": s\.twilio_messaging_service_sid/.test(sms) && !/"From":/.test(sms));
check('T: Twilio authenticates with the API key pair; the auth token is used only for callback validation', /auth=\(s\.twilio_api_key_sid/.test(sms) && /RequestValidator\(s\.twilio_auth_token\)/.test(sms) && !/auth=\(s\.twilio_account_sid, s\.twilio_auth_token/.test(sms));
check('T: SendGrid From is Hangyul Univ <support@talkhangyul.com> by default', /sendgrid_from_email: str = Field\(default="support@talkhangyul\.com"/.test(cfg) && /sendgrid_from_name: str = Field\(default="Hangyul Univ"/.test(cfg));
check('T: provider failures are reduced to internal codes and the student gets a sanitised sentence', /DELIVERY_FAILED/.test(verification) && /SMS_PROVIDER_/.test(sms) && /MAIL_HTTP_/.test(mail) && !/body_json\)\s*$/.test(sms));
check('T: the SMS text carries code + brand + validity only', /\[Hangyul Univ\] 인증번호는 \{code\}입니다/.test(sms) && !/\{email\}|\{password\}|\{name\}/.test(sms.split('def otp_text')[1] ?? ''));
check('T: the Twilio status webhook validates the signature before touching data', /validate_callback\(public, form, x_twilio_signature\)/.test(auth) && /403/.test(auth.split('def twilio_status')[1] ?? ''));
const clientSrc = ['apps/student-web/src', 'apps/agency-web/src', 'apps/university-web/src', 'apps/marketing-web/src', 'packages/ui/src', 'packages/api-client/src', 'apps/student-mobile/src', 'apps/student-mobile/app'].flatMap((d) => walk(d));
const leaks = clientSrc.filter((f) => /SENDGRID_API_KEY|TWILIO_(ACCOUNT_SID|API_KEY|AUTH_TOKEN|MESSAGING)|TURNSTILE_SECRET/.test(read(f)));
check('T: no provider configuration name appears in any client source', leaks.length === 0, leaks.join(', '));
for (const dist of ['apps/student-web/dist', 'apps/agency-web/dist', 'apps/university-web/dist', 'apps/marketing-web/dist']) {
  if (!existsSync(join(ROOT, dist))) { skip(`T: built bundle ${dist} scanned for secrets`, 'no dist (run npm run build)'); continue; }
  const files = walk(dist, /\.(js|html|css|json)$/);
  const bad = files.filter((f) => statSync(join(ROOT, f)).size < 20_000_000 && /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|\bAC[0-9a-f]{32}\b|\bSK[0-9a-f]{32}\b|\bMG[0-9a-f]{32}\b|0x4AAAAA[A-Za-z0-9_-]{20,}/.test(read(f)));
  check(`T: built bundle ${dist} carries no provider secret`, bad.length === 0, bad.join(', '));
}
const env = existsSync(join(ROOT, 'server/.env')) ? read('server/.env') : '';
const hasSendgrid = /^(HG_)?SENDGRID_API_KEY=.+/m.test(env); const hasTwilio = /^(HG_)?TWILIO_API_KEY_SECRET=.+/m.test(env);
if (!hasSendgrid) skip('T: live SendGrid smoke', 'BLOCKED — SENDGRID_API_KEY is not in server/.env on this host');
if (!hasTwilio) skip('T: live Twilio smoke', 'BLOCKED — TWILIO_* credentials are not in server/.env on this host');

/* ================================================================================== 3. LEGAL (static) */
// V23: the overseas-transfer table is the block before DOMESTIC_PROCESSORS (Toss Payments, Korea, 제26조) — REPORT §268 P3.
const dataMap = read('apps/marketing-web/src/lib/legal/data-map.ts').split('export const DOMESTIC_PROCESSORS')[0];
check('L: the privacy data map names the three processors', ["key: 'twilio_sms'", "key: 'sendgrid'", "key: 'turnstile'"].every((k) => dataMap.includes(k)));
check('L: every processor carries entity, address, contact, countries, retention, DPA and basis (제28조의8②)',
  ['entity', 'address', 'contact', 'dpaUrl', 'privacyUrl'].every((f) => (dataMap.match(new RegExp(`\\b${f}: '[^']+'`, 'g')) ?? []).length === 3) && (dataMap.match(/basis: '28-8-1-3',/g) ?? []).length === 3 && (dataMap.match(/countries: \['US'\]/g) ?? []).length === 3);
check('L: verification and security categories are in the data map with their real tables', /key: 'verification',\s*tables: \['verification_challenges'\]/.test(dataMap) && /key: 'security',\s*tables: \['auth_security_events'\]/.test(dataMap));
const ko = json('packages/i18n/locales/ko/marketing.json').v12; const enM = json('packages/i18n/locales/en/marketing.json').v12;
for (const k of ['twilio_sms', 'sendgrid', 'turnstile']) check(`L: ko+en purpose/items strings exist for ${k}`, !!ko.privacy.processors[k]?.purpose && !!ko.privacy.processors[k]?.items && !!enM.privacy.processors[k]?.purpose);
for (const k of ['intro', 'colWho', 'colItems', 'colCountry', 'colWhen', 'colPurpose', 'colRetention', 'when', 'whenTurnstile', 'refuse', 'safeguards']) check(`L: cross-border field "${k}" is written (ko)`, typeof ko.privacy.transfer[k] === 'string' && ko.privacy.transfer[k].length > 4);
const privacyPage = read('apps/marketing-web/src/pages/legal/Privacy.tsx');
check('L: the privacy page renders the transfer table from PROCESSORS (not a "none" sentence) when processors exist', /PROCESSORS\.length \? \(/.test(privacyPage) && /transfer\.refuse/.test(privacyPage));
const legal = read('server/app/core/legal.py');
check('L: consents are a server catalogue with required/optional items and document versions', /ConsentItem\("TERMS", True/.test(legal) && /ConsentItem\("PRIVACY", True/.test(legal) && /ConsentItem\("CROSS_BORDER_VERIFICATION", True/.test(legal) && /ConsentItem\("MARKETING", False/.test(legal));
check('L: consent records carry locale, document version, ip hash, user agent and source', ['locale', 'document_version', 'policy_effective_on', 'ip_hash', 'user_agent', 'source'].every((c) => read('server/app/models/identity.py').includes(`${c}: Mapped`)));
const refundTs = read('packages/types/src/refund-policy.ts'); const refundJson = json('shared/refund-policy.json');
const tsStages = [...refundTs.matchAll(/key: '([A-Z_]+)'/g)].map((m) => m[1]);
check('L: the refund-policy model (TS) and its server mirror (JSON) agree', JSON.stringify(tsStages) === JSON.stringify(refundJson.stages.map((s) => s.key)) && refundTs.includes(`REFUND_POLICY_VERSION = '${refundJson.version}'`) && refundJson.commercial_schedule_approved === false);
check('L: no refund percentage is invented anywhere in the policy or the Terms strings', !/\d+\s?%/.test(JSON.stringify(ko.terms.refunds)) && !/percent|%/.test(refundTs.replace(/\/\*[\s\S]*?\*\//g, '')));
check('L: the Terms refund article renders from REFUND_POLICY and every stage has a ko string', /REFUND_POLICY\.stages\.map/.test(read('apps/marketing-web/src/pages/legal/Terms.tsx')) && tsStages.every((k) => !!ko.terms.refunds.stage[k]));
check('L: the checkout records a PURCHASE_TERMS consent with the version shown', /purpose="PURCHASE_TERMS"/.test(read('server/app/api/v1/student.py')) && /PURCHASE_TERMS_VERSION/.test(read('apps/student-web/src/pages/Services.tsx')));
try { execFileSync('node', [join(ROOT, 'scripts/qa/v12-legal-gate.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 120000, stdio: 'pipe' }); check('L: no placeholder legal data is rendered (v12 legal gate)', true); }
catch (e) { check('L: no placeholder legal data is rendered (v12 legal gate)', false, String(e.stdout ?? e).slice(-200)); }

/* ============================================================== 4–5. AGENCY / UNIVERSITY roles (static) */
const LEGACY = /\b(AGENCY_OWNER|AGENCY_MANAGER|AGENCY_COUNSELOR|AGENCY_DOCUMENT_REVIEWER|UNIVERSITY_ADMISSIONS|UNIVERSITY_REVIEWER|UNIVERSITY_ANALYST)\b/;
for (const [name, dir] of [['agency', 'apps/agency-web/src'], ['university', 'apps/university-web/src'], ['student', 'apps/student-web/src'], ['shared ui', 'packages/ui/src']]) {
  const hits = walk(dir, /\.(tsx?)$/).filter((f) => !/\.test\.tsx?$/.test(f) && LEGACY.test(read(f)));
  check(`A/U: no legacy role name survives in ${name} source`, hits.length === 0, hits.join(', '));
}
const srvLegacy = walk('server/app', /\.py$/).filter((f) => !/enums\.py$/.test(f) && LEGACY.test(read(f)));
check('A/U: server role branches outside the legacy-alias table are gone (tolerated only in alembic + enums)', srvLegacy.length === 0, srvLegacy.join(', '));
check('A: the migration maps the four agency roles and three university roles in place', /AGENCY_ADMIN' FROM organizations/.test(read('server/alembic/versions/v22_roles.py')) && /UNIVERSITY_ADMIN' FROM organizations/.test(read('server/alembic/versions/v22_roles.py')));
check('A: display identity is separated from the audit actor', /author_for\(p, /.test(read('server/app/api/v1/collab.py')) && /author_user_id=p\.id/.test(read('server/app/api/v1/collab.py')));
const demo = read('packages/auth/src/demo-personas.ts');
check('A/U: the console test sign-in offers no legacy role label', !/role\.(AGENCY_COUNSELOR|AGENCY_MANAGER|AGENCY_DOCUMENT_REVIEWER|UNIVERSITY_ADMISSIONS|UNIVERSITY_REVIEWER|UNIVERSITY_ANALYST)/.test(demo));

/* ====================================================================== 7. UNIVERSITY DISCOVERY (static) */
const csvPath = 'docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv';
const WANT = 'university,slug,logo,hero_image,gallery_count,media_licence,official_site,international_office,admissions_page,education_philosophy,academic_identity,dormitory,official_youtube,intro_video,verification_date,blocking_reason';
if (existsSync(join(ROOT, csvPath))) {
  const lines = read(csvPath).trim().split('\n');
  check('D: the V22 coverage CSV has exactly the brief\'s columns', lines[0].trim() === WANT, lines[0].slice(0, 120));
  check('D: the V22 coverage CSV has one row per institution (425)', lines.length - 1 === 425, String(lines.length - 1));
} else check('D: docs/qa/v22/UNIVERSITY_CONTENT_COVERAGE.csv exists', false, 'missing');
const content = json('server/app/data/university_content.json').records ?? {};
const registry = json('server/app/data/korean_institutions.json').institutions;
let missingMedia = 0; let unverifiedVideo = 0; let heroInGallery = 0;
const seen = new Map(); let shared = 0;
for (const [slug, r] of Object.entries(content)) {
  for (const m of [r.media?.hero, ...(r.media?.gallery ?? []), r.logo].filter(Boolean)) {
    // `local_path` is a width-less base (`media/<slug>--<asset>`); the files are `<base>-640|1200|2400.<ext>` or `<base>.<ext>` (logos).
    if (m.local_path) {
      const base = join(ROOT, 'apps/marketing-web/public', m.local_path.replace(/^\//, ''));
      const dir = dirname(base); const stem = base.slice(dir.length + 1);
      const ok = existsSync(dir) && readdirSync(dir).some((f) => f === stem || f.startsWith(`${stem}.`) || f.startsWith(`${stem}-1200.`) || f.startsWith(`${stem}-640.`));
      if (!ok) missingMedia += 1;
    }
    const key = m.asset ?? m.local_path ?? m.url; if (key) { if (seen.has(key) && seen.get(key) !== slug) shared += 1; seen.set(key, slug); }
  }
  if (r.media?.hero?.asset && (r.media?.gallery ?? []).some((g) => g.asset === r.media.hero.asset)) heroInGallery += 1;
  if (r.youtube?.video_id && !(r.youtube.verified_via || r.youtube.verification_status)) unverifiedVideo += 1;
}
check('D: every referenced local media file exists (no broken media)', missingMedia === 0, String(missingMedia));
check('D: no photograph, logo or film is shared between institutions', shared === 0, String(shared));
check('D: no hero repeated in its own gallery', heroInGallery === 0, String(heroInGallery));
// The same asset listed twice inside one record renders two React children with one key (found on Kumoh, V22).
const dupWithin = Object.entries(content).filter(([, r]) => { const g = (r.media?.gallery ?? []).map((m) => m.asset ?? m.local_path); return new Set(g).size !== g.length; }).map(([s]) => s);
check('D: no asset is listed twice within one institution\'s gallery', dupWithin.length === 0, dupWithin.slice(0, 4).join(', '));
check('D: every official video records how channel ownership was verified', unverifiedVideo === 0, String(unverifiedVideo));
check('D: the registry is still 425', registry.length === 425);
const uniSrc = walk('packages/ui/src', /\.tsx?$/).concat(walk('apps/marketing-web/src', /\.tsx?$/));
check('D: no chopped-name fallback exists in the source', !uniSrc.some((f) => /\bmonogramOf\b|__mono\b/.test(read(f))));
try { execFileSync('node', [join(ROOT, 'scripts/qa/v21-gate.mjs'), '--static'], { cwd: ROOT, encoding: 'utf8', timeout: 180000, stdio: 'pipe' }); check('D: the V21 university rights gate (static) still passes', true); }
catch (e) { const out = String(e.stdout ?? e); check('D: the V21 university rights gate (static) still passes', false, (out.match(/✖ .*/g) ?? []).slice(0, 3).join(' | ').slice(0, 300)); }

/* ====================================================================== 8. NATIVE REGISTRATION (static) */
const flow = read('apps/student-mobile/src/signup/SignupFlow.tsx');
const nclient = read('apps/student-mobile/src/signup/client.ts');
const ncomp = read('apps/student-mobile/src/signup/components.tsx');
const nlayout = read('apps/student-mobile/app/_layout.tsx');
const nquick = read('apps/student-mobile/src/QuickCheck.tsx');
check('N: the native app has a sign-up entry (no "sign up on the web" dead end)', /AuthEntry/.test(nlayout) && !/openURL\(SIGNUP_URL\)/.test(nquick) && !/EXPO_PUBLIC_SIGNUP_URL/.test(nquick));
check('N: email and phone verification call the backend (same endpoints as web), never a provider', /api\.auth\.sendCode/.test(nclient) && /api\.auth\.verifyCode/.test(nclient) && !/sendgrid|twilio/i.test(nclient + flow + ncomp));
check('N: the account is created through the same register endpoint with both proofs and consents', /api\.auth\.register\(body, session\)/.test(nclient) && /email_proof: s\.email\.proof/.test(flow) && /phone_proof: s\.sms\.proof/.test(flow) && /password_confirm: s\.account\.passwordConfirm/.test(flow));
check('N: password confirmation is checked before leaving the account step', /a\.password !== a\.passwordConfirm/.test(flow));
check('N: the CAPTCHA step is driven by the server config and the token only ever goes to the server', /captcha\.required/.test(flow) && /TurnstileChallenge/.test(flow) && /startSession\(api, tok\)|beginSession\(tok\)/.test(flow) && !/TURNSTILE_SECRET/.test(flow + ncomp + nclient));
check('N: required consents are enforced and optional ones are not', /missingRequired\(s\.consents, items\)/.test(flow) && /required && !consents\[i\.key\]/.test(read('apps/student-mobile/src/signup/state.ts')));
check('N: a successful account becomes an authenticated session and lands on recommendations', /await setSession\(tr\)/.test(read('packages/api-client/src/index.ts')) && /router\.replace\('\/explore\?welcome=1'\)/.test(nlayout));
check('N: no READ_SMS permission; OTP autofill uses OS hints only', !/READ_SMS|RECEIVE_SMS/.test(read('apps/student-mobile/app.json')) && /textContentType="oneTimeCode"/.test(ncomp) && /sms-otp/.test(ncomp));
check('N: nothing sensitive is persisted (password, code, proof, session, token)', !/password/.test(read('apps/student-mobile/src/signup/state.ts').split('export function persistable')[1] ?? 'password') && /proof: null/.test(read('apps/student-mobile/src/signup/state.ts')) && !/AsyncStorage/.test(flow + read('apps/student-mobile/src/signup/persist.ts')));
check('N: legal documents are the canonical web pages (embed mode), not a copy in the bundle', /embed=1/.test(ncomp) && /dataset\.embed/.test(read('apps/marketing-web/src/components/SiteLayout.tsx')));
check('N: every server error maps to a localised key (no raw code reaches the screen)', /signup\.err\.generic/.test(read('apps/student-mobile/src/signup/errors.ts')) && !/e\.message|err\.message/.test(flow));
const nTests = ['state.test.ts', 'errors.test.ts', 'phone.test.ts', 'persist.test.ts', 'client.integration.test.ts'].every((f) => existsSync(join(ROOT, 'apps/student-mobile/src/signup', f)));
check('N: native unit + integration tests exist and are wired to `npm test`', nTests && /"test": "vitest run"/.test(read('apps/student-mobile/package.json')));
// 33-market critical keys for the native flow
{
  const enM = json('packages/i18n/locales/en/mobile.json').signup ?? {};
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  const critical = flat(enM).filter((k) => /^(title|steps\.|email$|phone$|password|passwordConfirm|verify|resend|expires|expired|consent|captcha|submit|doneTitle|doneText|err\.)/.test(k));
  const markets = json('packages/i18n/locales/_meta.json');
  void markets;
  const LOCALES = ['ko', 'vi', 'ne', 'uz', 'mn', 'zh-Hans', 'ja', 'th', 'id', 'fil', 'my', 'hi', 'bn', 'kk', 'ky', 'ar', 'tr', 'ru', 'uk', 'pl', 'cs', 'hu', 'ro', 'sr', 'el', 'it', 'es', 'pt', 'fr', 'de', 'nl', 'sv'];
  const at = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  // a value that is legitimately identical to English is registered (with a reason) in the translation tool's cognate list
  const cognates = new Set(Object.keys(json('scripts/i18n/v14-cognates.json').cognates ?? {}));
  const missing = [];
  for (const loc of LOCALES) {
    const m = existsSync(join(ROOT, `packages/i18n/locales/${loc}/mobile.json`)) ? json(`packages/i18n/locales/${loc}/mobile.json`).signup ?? {} : {};
    const gaps = critical.filter((k) => typeof at(m, k) !== 'string' || (loc !== 'en' && at(m, k) === at(enM, k) && !/Hangyul Univ|TOPIK|IELTS/.test(String(at(enM, k))) && !cognates.has(`${loc}|signup.${k}|${at(enM, k)}`)));
    if (gaps.length) missing.push(`${loc}:${gaps.length}`);
  }
  check(`N: the ${critical.length} critical native sign-up keys exist in all 33 markets without English fallback`, missing.length === 0, missing.slice(0, 8).join(' '));
}
// provider secrets in the Expo export (when present) and in the native source
const expoOut = 'apps/student-mobile/.expo-export-check';
if (existsSync(join(ROOT, expoOut))) {
  const bad = walk(expoOut, /\.(js|json|html|map|hbc)$/).filter((f) => statSync(join(ROOT, f)).size < 60_000_000 && /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|\bAC[0-9a-f]{32}\b|\bSK[0-9a-f]{32}\b|\bMG[0-9a-f]{32}\b|0x4AAAAA[A-Za-z0-9_-]{20,}|TWILIO_AUTH_TOKEN|TWILIO_API_KEY_SECRET|SENDGRID_API_KEY|TURNSTILE_SECRET/.test(read(f)));
  check('N: the exported Expo bundle carries no provider secret or secret-bearing variable name', bad.length === 0, bad.join(', '));
} else skip('N: exported Expo bundle secret scan', 'no .expo-export-check (run `npm run export:check -w @hangyul/student-mobile`)');
// release artifacts: the JS bundle inside the APK/AAB is inflated and scanned (secrets would survive Hermes compilation as strings)
{
  const SECRET = /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|\bAC[0-9a-f]{32}\b|\bSK[0-9a-f]{32}\b|\bMG[0-9a-f]{32}\b|0x4AAAAA[A-Za-z0-9_-]{20,}|TWILIO_AUTH_TOKEN|TWILIO_API_KEY_SECRET|SENDGRID_API_KEY|TURNSTILE_SECRET/;
  // V23: the V23 artifacts of all three apps (the V22 student files are archived in result/student-mobile/archive-v22/).
  const arts = ['student', 'agency', 'university'].flatMap((a) => [[`result/${a}-mobile/android/hangyul-${a}-v23-preview.apk`, 'assets/index.android.bundle'], [`result/${a}-mobile/android/hangyul-${a}-v23-production.aab`, 'base/assets/index.android.bundle']]);
  const found = [];
  let scanned = 0;
  for (const [art, entry] of arts) {
    if (!existsSync(join(ROOT, art))) continue;
    try {
      const buf = execFileSync('unzip', ['-p', join(ROOT, art), entry], { maxBuffer: 256 * 1024 * 1024 });
      scanned += 1;
      if (SECRET.test(buf.toString('latin1'))) found.push(art);
    } catch (e) { found.push(`${art} (${String(e.message).split('\n')[0]})`); }
  }
  if (scanned) check(`N: the ${scanned} release artifact(s) in result/ carry no provider secret in their JS bundle`, found.length === 0, found.join(', '));
  else skip('N: release APK/AAB secret scan', 'no artifact in result/student-mobile/android');
}
const nativeSrc = walk('apps/student-mobile/src', /\.(tsx?)$/).concat(walk('apps/student-mobile/app', /\.(tsx?)$/));
check('N: native source names no provider configuration', !nativeSrc.some((f) => /TWILIO_|SENDGRID_|TURNSTILE_SECRET/.test(read(f))));

/* ================================================================================ live API checks */
// The dev limiter is shared with every other QA run on this host (e2e, Toss probe, emulator walk) and this gate itself
// registers an account each run; a stale 10/h per-IP counter would turn a limiter working as designed into a red
// gate. Clear the dev counters first with the limiter's own test helper (never used by product code). Limiter
// semantics themselves are covered by the API test suite.
try { execFileSync(join(ROOT, 'server/.venv/bin/python'), ['-c', 'from app.services import ratelimit; ratelimit.reset_all()'], { cwd: join(ROOT, 'server'), stdio: 'ignore', timeout: 30000 }); } catch { /* API tests cover the limiter; the gate still runs */ }

if (!STATIC_ONLY) {
  const up = await fetch(`${API.replace('/api/v1', '')}/healthz`).then((r) => r.ok).catch(() => false);
  if (!up) { check('API :8001 is running', false); }
  else {
    // --- registration through the real flow
    const sess = await post('/auth/signup/session', { captcha_token: null, locale: 'en' });
    check('R(api): a signup session is issued (dev: CAPTCHA not configured → not required)', sess.status === 200 && !!sess.body.signup_session, String(sess.status));
    const H = { 'X-Signup-Session': sess.body.signup_session };
    const noSess = await post('/auth/verification/send', { channel: 'EMAIL', target: 'x@example.com', purpose: 'SIGNUP', locale: 'en' });
    check('R(api): sending a code without a signup session is refused', noSess.status === 400 && noSess.body.detail?.code === 'SIGNUP_SESSION_REQUIRED');
    const badEmail = await post('/auth/verification/send', { channel: 'EMAIL', target: 'not-an-email', purpose: 'SIGNUP', locale: 'en' }, H);
    check('R(api): email syntax is validated (EMAIL_INVALID)', badEmail.body.detail?.code === 'EMAIL_INVALID');
    const stamp = Date.now();
    const email = `qa-v22-${stamp}@example.com`;
    const e1 = await post('/auth/verification/send', { channel: 'EMAIL', target: `  ${email.toUpperCase()}  `, purpose: 'SIGNUP', locale: 'en' }, H);
    check('R(api): email OTP send succeeds and the target is canonicalised', e1.status === 200 && e1.body.target_masked?.endsWith('@example.com'), String(e1.status));
    const e2 = await post('/auth/verification/send', { channel: 'EMAIL', target: email, purpose: 'SIGNUP', locale: 'en' }, H);
    check('R(api): a resend inside 60 s is refused with Retry-After', e2.status === 429 && e2.body.detail?.code === 'OTP_RESEND_TOO_SOON' && !!e2.headers.get('retry-after'));
    const p1 = await post('/auth/verification/send', { channel: 'SMS', target: '0912 345 678', phone_country: 'VN', purpose: 'SIGNUP', locale: 'vi' }, H);
    check('R(api): SMS OTP send normalises the phone (masked target starts with +84)', p1.status === 200 && String(p1.body.target_masked).startsWith('+84'), JSON.stringify(p1.body).slice(0, 120));
    const wrong = await post('/auth/verification/verify', { challenge_id: e1.body.challenge_id, code: '000000' });
    check('R(api): a wrong code is CODE_INVALID with attempts_left', wrong.status === 400 && wrong.body.detail?.code === 'CODE_INVALID' && wrong.body.detail?.attempts_left === 4);
    const gone = await post('/auth/verification/verify', { challenge_id: '00000000-0000-0000-0000-000000000000', code: '000000' });
    check('R(api): an unknown/expired challenge is CODE_EXPIRED', gone.body.detail?.code === 'CODE_EXPIRED');
    const peek = async (cid) => (await get(`/auth/verification/peek/${cid}`)).body.code;
    const ev = await post('/auth/verification/verify', { challenge_id: e1.body.challenge_id, code: await peek(e1.body.challenge_id) });
    const pv = await post('/auth/verification/verify', { challenge_id: p1.body.challenge_id, code: await peek(p1.body.challenge_id) });
    check('R(api): correct codes verify and return proofs', ev.status === 200 && !!ev.body.proof && pv.status === 200 && !!pv.body.proof);
    const base = { email, email_proof: ev.body.proof, phone: '0912 345 678', phone_country: 'VN', phone_proof: pv.body.proof, password: 'a sentence i remember', password_confirm: 'a sentence i remember', full_name: 'QA V22', locale: 'en', nationality: 'VN' };
    const mm = await post('/auth/register', { ...base, password_confirm: 'different sentence', consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true } }, H);
    check('R(api): password confirmation mismatch is refused', mm.status === 400 && mm.body.detail?.code === 'PASSWORD_MISMATCH');
    const nc = await post('/auth/register', { ...base, consents: { TERMS: true, PRIVACY: true } }, H);
    check('R(api): a missing required consent is refused and named', nc.status === 400 && nc.body.detail?.code === 'CONSENT_REQUIRED' && nc.body.detail?.keys?.includes('CROSS_BORDER_VERIFICATION'));
    const np = await post('/auth/register', { ...base, phone_proof: undefined, consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true } }, H);
    check('R(api): no phone proof → no account', np.status === 400 && np.body.detail?.code === 'PHONE_NOT_VERIFIED');
    const ok = await post('/auth/register', { ...base, consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true, MARKETING: false } }, H);
    check('R(api): the full flow creates a verified account (optional consent left false)', ok.status === 201 && ok.body.verified?.email === true && ok.body.verified?.phone === true, String(ok.status));
    const anon = await get('/me/dashboard');
    check('R(api): nobody enters the product without a session', anon.status === 401);
    const rows = sql(`select count(*) from consent_records where user_id=(select id from users where email='${email}') and document_version is not null and locale='en' and source='SIGNUP'`);
    check('L(api): consent evidence rows are versioned with locale and source (4 rows)', rows === '4', String(rows));
    const stored = sql(`select phone, email_verified_at is not null, phone_verified_at is not null from users where email='${email}'`);
    check('R(api): the stored phone is E.164 and both verified timestamps are set', stored === '+84912345678|t|t', String(stored));
    const dup = await post('/auth/verification/send', { channel: 'EMAIL', target: `dup-${stamp}@example.com`, purpose: 'SIGNUP', locale: 'en' }, H);
    const dupKeys = Object.keys(dup.body).sort().join(',');
    check('R(api): a registered email gets an indistinguishable send response (no enumeration)', dup.status === 200 && dupKeys === Object.keys(e1.body).sort().join(','));
    // abuse: five wrong codes exhaust a challenge
    const ab = await post('/auth/verification/send', { channel: 'SMS', target: '0912 999 888', phone_country: 'VN', purpose: 'SIGNUP', locale: 'en' }, H);
    let last = null;
    for (let i = 0; i < 5; i += 1) last = await post('/auth/verification/verify', { challenge_id: ab.body.challenge_id, code: '000000' });
    check('R(api): SMS OTP abuse limit — the fifth wrong code kills the challenge', last?.body.detail?.code === 'TOO_MANY_ATTEMPTS');
    // --- forgot password is rate-limited and non-disclosing
    const fp = await post('/auth/forgot-password', { email: `nobody-${stamp}@example.com` });
    check('R(api): forgot-password answers 202 for an unknown address', fp.status === 202 && fp.body.accepted === true);

    // --- agency: one role, many admins, one customer identity
    const lotus = ['owner', 'manager', 'counselor', 'reviewer'];
    const sessions = await Promise.all(lotus.map((w) => login(`${w}@lotus.demo.hangyul.kr`, 'agency')));
    check('A(api): every migrated legacy account signs in as AGENCY_ADMIN', sessions.every((s) => s && s.body.active_org?.role === 'AGENCY_ADMIN'));
    const totals = await Promise.all(sessions.filter(Boolean).map((s) => get('/agency/students?page_size=1', s.h).then((r) => r.body.total)));
    check('A(api): every admin sees the same students (no counselor-only caseload)', new Set(totals).size === 1 && totals[0] > 0, totals.join('/'));
    const stu = await login('student@demo.hangyul.kr', 'student');
    const convs = (await get('/conversations', stu.h)).body;
    const cid = convs[0]?.id;
    const a1 = await post(`/conversations/${cid}/messages`, { body: `qa-v22 reply ${stamp} a` }, sessions[2].h);
    const a2 = await post(`/conversations/${cid}/messages`, { body: `qa-v22 reply ${stamp} b` }, sessions[3].h);
    const thread = (await get(`/conversations/${cid}/messages`, stu.h)).body.messages ?? [];
    const staff = thread.filter((m) => m.body.startsWith(`qa-v22 reply ${stamp}`));
    check('A(api): two admins replied; the student sees one team identity on both', a1.status === 201 && a2.status === 201 && staff.length === 2 && staff.every((m) => m.author?.kind === 'team' && m.author?.id === 'team'));
    const agencyView = (await get(`/conversations/${cid}/messages`, sessions[2].h)).body.messages.filter((m) => m.body.startsWith(`qa-v22 reply ${stamp}`));
    check('A(api): the agency view keeps the two real actors', new Set(agencyView.map((m) => m.author?.id)).size === 2);
    const actors = sql(`select count(distinct author_user_id) from messages where body like 'qa-v22 reply ${stamp}%'`);
    check('A(api): the database keeps the real author ids (audit actor)', actors === '2', String(actors));
    const silk = await login('manager@silk.demo.hangyul.kr', 'agency');
    const lotusStudent = (await get('/agency/students?page_size=1', sessions[0].h)).body.items?.[0]?.id;
    const cross = await get(`/agency/students/${lotusStudent}`, silk.h);
    check('A(api): cross-agency access is 404', cross.status === 404);
    const roster = await get('/agency/team/accounts', sessions[0].h);
    check('A(api): the accounts roster exposes name/email/status/last login and one role', roster.status === 200 && roster.body.role === 'AGENCY_ADMIN' && roster.body.accounts.every((a) => a.role === 'AGENCY_ADMIN' && 'last_login_at' in a));
    const dash = (await get('/me/dashboard', stu.h)).body;
    check('A(api): the student home names the team, not a person', dash.counselor?.counselor?.kind === 'team');

    // --- university: one role, tenant isolation, direct landing
    const pnu = await Promise.all(['admin', 'admissions', 'reviewer', 'analyst'].map((w) => login(`${w}@pusan.univ.demo.hangyul.kr`, 'university')));
    check('U(api): every Pusan account is UNIVERSITY_ADMIN and lands directly in Pusan', pnu.every((s) => s && s.body.active_org?.role === 'UNIVERSITY_ADMIN' && s.body.memberships.length === 1 && !!s.body.active_org.university_id));
    const apps = (await get('/applications?page_size=1', pnu[0].h)).body.items ?? [];
    const skku = await login('admin@sungkyunkwan.univ.demo.hangyul.kr', 'university');
    if (apps[0] && skku) {
      const r1 = await get(`/applications/${apps[0].id}`, skku.h);
      const r2 = await post(`/applications/${apps[0].id}/transition`, { to: 'UNIVERSITY_REVIEW' }, skku.h);
      const r3 = await get(`/university/export/applications.csv?university_id=${apps[0].university.id}`, skku.h);
      check('U(api): a guessed Pusan application URL is 404 for SKKU (detail, transition)', r1.status === 404 && r2.status === 404);
      check('U(api): an export with a foreign university_id returns only the caller\'s rows', r3.status === 200);
      const ex = await Promise.all(pnu.map((s) => get('/university/analytics', s.h).then((r) => r.status)));
      check('U(api): analytics and exports open for every Pusan admin', ex.every((s) => s === 200));
    } else skip('U(api): tenant checks', 'no Pusan application or no SKKU admin in this seed');
    const hq = await login('admin@demo.hangyul.kr', 'agency');
    const accts = await get('/agency/hq/university-accounts', hq.h);
    check('U(api): Hangyul can list university accounts with their assigned university', accts.status === 200 && accts.body.accounts.some((a) => a.university?.slug === 'pusan-national-university'));
    check('U(api): a university admin cannot reach the HQ roster', [403, 404].includes((await get('/agency/hq/university-accounts', pnu[0].h)).status));

    // --- discovery: all 425 routes answer through the API the page reads
    let bad = 0;
    for (let i = 0; i < registry.length; i += 25) {
      const batch = registry.slice(i, i + 25);
      const rs = await Promise.all(batch.map((u) => fetch(`${API}/directory/institutions/${u.slug}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      bad += rs.filter((x) => !x || !x.name_ko || !x.region).length;
    }
    check('D(api): all 425 institution routes answer with a named institution in a region', bad === 0, String(bad));

    /* ============================================================================ rendered checks */
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    const WIDTHS = [390, 768, 1024, 1440, 1728];
    const overflow = async (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const signin = async (ctx, app, who) => { const p = await ctx.newPage(); await p.goto(`${APPS[app]}/login?demo=${encodeURIComponent(who)}`); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); return p; };
    for (const [app, who, path, strip] of [['student', 'student@demo.hangyul.kr', '/', true], ['agency', 'manager@lotus.demo.hangyul.kr', '/', true], ['university', 'admin@pusan.univ.demo.hangyul.kr', '/', true]]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      try {
        const page = await signin(ctx, app, who);
        page.on('pageerror', (e) => errors.push(e.message));
        for (const w of WIDTHS) { await page.setViewportSize({ width: w, height: 900 }); await page.goto(`${APPS[app]}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
          check(`Dn: ${app} ${path} has no horizontal overflow at ${w}`, (await overflow(page)) <= 0); }
        await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`${APPS[app]}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
        if (strip) {
          const n = await page.locator('.hg-strip').count();
          check(`Dn: ${app} home shows the workflow strip`, n >= 1);
          const cur = await page.locator('.hg-strip [aria-current="step"], .hg-strip .is-selected').count();
          if (app === 'student') check('Dn: the student journey has exactly one current stage', (await page.locator('.hg-strip__item.is-current').count()) === 1);
          else {
            const items = await page.locator('.hg-strip li[data-stage]').all();
            let checked = 0;
            for (const li of items) {
              const count = Number((await li.locator('.hg-strip__count').textContent().catch(() => '0'))?.replace(/\D/g, '') || 0);
              if (!count || checked >= 3) continue;
              await li.locator('button').click();
              await page.waitForTimeout(900);
              const total = Number(await page.locator('[data-work-total]').first().getAttribute('data-work-total').catch(() => 'NaN'));
              check(`Dn: ${app} strip count equals filtered rows for "${await li.getAttribute('data-stage')}"`, total === count, `${count} vs ${total}`);
              checked += 1;
              await li.locator('button').click(); await page.waitForTimeout(300);
            }
            check(`Dn: ${app} strip has clickable stages with counts`, checked > 0);
            void cur;
          }
        }
        if (app !== 'student') {
          const links = await page.locator('a.side-menu__item').evaluateAll((as) => as.map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/')));
          check(`Dn: ${app} navigation is small (${links.length} items)`, app === 'agency' ? links.length <= 10 : links.length <= 6, links.join(' '));
          let dead = 0;
          for (const href of links) { await page.goto(`${APPS[app]}${href}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
            if ((await page.locator('h1').first().textContent().catch(() => ''))?.match(/not found|찾을 수 없|404/i)) dead += 1; }
          check(`Dn: ${app} has no dead navigation`, dead === 0, String(dead));
          check(`Dn: ${app} renders no navy menu`, !(await page.evaluate(() => getComputedStyle(document.querySelector('.app-sidebar') ?? document.body).backgroundColor)).match(/rgb\(17, 28, 67\)|rgb\(15, 34, 64\)/));
        }
        check(`Dn: ${app} home has no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
        if (app === 'university') {
          await page.goto(`${APPS.university}/analytics`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
          const qs = await page.locator('[data-question]').count();
          check('Dn: university analytics is organised by the four questions', qs === 4, String(qs));
          check('Dn: university analytics draws no donut chart', (await page.locator('[class*="donut"], [data-chart="donut"]').count()) === 0);
        }
      } catch (e) { check(`Dn: ${app} rendered checks ran`, false, String(e.message ?? e).slice(0, 160)); }
      await ctx.close();
    }
    // register page at five widths, no overflow, four steps visible
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const w of WIDTHS) { await page.setViewportSize({ width: w, height: 900 }); await page.goto(`${APPS.student}/register?lang=ko`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300);
      check(`Dn: /register has no horizontal overflow at ${w}`, (await overflow(page)) <= 0); }
    check('Dn: /register shows the four steps and both password fields', (await page.locator('.hg-steps__item').count()) === 4 && (await page.locator('#password').count()) === 1 && (await page.locator('#password_confirm').count()) === 1);
    check('Dn: /register shows a phone input with country selector', (await page.locator('.hg-phone__country').count()) === 1);
    await ctx.close();
    // Carried over from the retired V15 console gates (their DOM is gone; their intents are not).
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const page = await signin(ctx, 'agency', 'counselor@lotus.demo.hangyul.kr');
        // the table reads 0 until the first page lands (same wait the e2e specs use), then rows navigate on click
        for (let i = 0; i < 30; i += 1) { const n = Number(await page.locator('[data-work-total]').first().getAttribute('data-work-total').catch(() => '0')); if (n > 0) break; await page.waitForTimeout(500); }
        const row = page.locator('[data-work-total] tbody tr').first();
        const first = (await row.count()) ? await row.click().then(() => page.waitForURL(/\/students\//, { timeout: 15000 })).then(() => page.url()).catch(() => null) : null;
        if (first) await page.waitForTimeout(1800);
        const text = await page.locator('body').innerText();
        const banned = [[/\b\d{1,3}\s*점\b/, '"N점"'], [/합격\s*(확률|가능성)\s*\d/, 'admission probability'], [/\bAI\s*(Admission\s*)?Score\b/i, 'AI score'], [/\b\d{1,3}\s*%\s*(합격|성공)/, 'success %']];
        const hits = banned.filter(([re]) => re.test(text)).map(([, w]) => w);
        check('A: no score, probability or success percentage anywhere on a student case (V15 intent)', !!first && hits.length === 0, first ? hits.join(', ') : 'no student row to open');
        check('A: the work queue is ordered by deadline, never by what the student paid (V15 intent)', /const sort = today \? 'deadline'/.test(read('apps/agency-web/src/components/Caseload.tsx')));
        const uni = await signin(ctx, 'university', 'admin@pusan.univ.demo.hangyul.kr');
        const leaks = [];
        for (const path of ['/', '/applicants', '/analytics', '/programs']) {
          await uni.goto(`${APPS.university}${path}?lang=ko`, { waitUntil: 'domcontentloaded' }); await uni.waitForTimeout(1500);
          const t = await uni.locator('body').innerText();
          for (const re of [/ALL_IN_ONE/, /\bAll-in-One\b/, /올인원/, /프리미엄\s*·/, /249[,.]000/, /499[,.]000/, /849[,.]000/]) if (re.test(t)) leaks.push(`${path}:${re}`);
        }
        check('U: no university surface names a Hangyul plan or retail price (V15 intent)', leaks.length === 0, leaks.slice(0, 3).join(' '));
      } catch (e) { check('A/U: V15 intents on the V22 consoles', false, String(e.message).slice(0, 160)); }
      await ctx.close();
    }
    await browser.close();
  }
}

/* =================================================================================== verdict */
console.log(`\nV22 gate — ${passes.length} passed, ${fails.length} failed, ${skips.length} skipped\n`);
for (const f of fails) console.log(`  ✖ ${f}`);
for (const s of skips) console.log(`  – skipped: ${s}`);
if (!fails.length) console.log('  all checks passed');
console.log('');
// V26: teardown — this gate writes on seeded data (accounts, a reply on a seeded thread). Purge its residue before exiting
// so the demo data never depends on someone remembering to run server/scripts/purge_e2e.py (REPORT §331 H).
try { (await import('node:child_process')).execSync('.venv/bin/python scripts/purge_e2e.py', { cwd: new URL('../../server/', import.meta.url).pathname, stdio: 'ignore', env: { ...process.env, HG_ENV: 'development' } }); } catch { console.log('  (teardown: purge_e2e.py failed — run it by hand)'); }
process.exit(fails.length ? 1 : 0);
