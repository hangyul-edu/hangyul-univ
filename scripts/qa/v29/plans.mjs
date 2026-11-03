/**
 * `npm run qa:plans-v29` — the V29 service contract is the same everywhere (brief §77).
 *
 * One definition (`packages/types/src/plans.ts`) and every place that could disagree with it:
 *
 *   MANIFEST     the owner's numbers, asserted literally (so the manifest itself cannot drift from the contract)
 *   GENERATED    shared/plans.json === a regeneration from plans.ts; the previous catalogue is frozen
 *   API          GET /api/v1/public/plans serves the manifest's entitlements, prices, catalogue and add-ons
 *   DATABASE     what the seed wrote (the API reads service_products) — via the same response
 *   SURFACES     marketing pricing, student /services, student native, agency panel render from the shared
 *                functions (`compareCell` / `planText` / API usage) and hold no plan numbers of their own
 *   CHECKOUT     the server snapshots the catalogue on every order (code path asserted; behaviour in pytest)
 *   I18N         every offered locale has every `common:v29.pricing` plan key, and the numbers inside them are
 *                the contract's (2 rounds on All-in-One; no round count on Premium; no minutes anywhere)
 *   STALE        no source file still carries the retired semantics (consultation_minutes, v15 card lines,
 *                the price-difference upgrade copy)
 *   TESTS        the contract tests exist and assert the boundaries
 *
 * Exit 1 on any mismatch. `--no-api` skips the API section (prints SKIP, never PASS) for a host with no server.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const API = process.env.HG_API_URL ?? 'http://127.0.0.1:8001';
const NO_API = process.argv.includes('--no-api');
const results = [];
const ok = (area, msg) => results.push({ area, pass: true, msg });
const bad = (area, msg) => results.push({ area, pass: false, msg });
const check = (area, cond, msg) => (cond ? ok(area, msg) : bad(area, msg));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const M = await import(pathToFileURL(join(ROOT, 'packages/types/src/plans.ts')).href);
const by = Object.fromEntries(M.PLANS.map((p) => [p.code, p]));
const E = (c) => by[c].entitlements;
const C = ['BASIC', 'ALL_IN_ONE', 'PREMIUM'];
const col = (k) => C.map((c) => E(c)[k]);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ----------------------------------------------------------------------------- MANIFEST: the owner's table */
check('MANIFEST', M.SERVICE_CATALOG.version === '2026-10-30.v29', `catalogue version ${M.SERVICE_CATALOG.version}`);
check('MANIFEST', eq(C.map((c) => by[c].amount_minor), [17_900, 34_900, 59_900]) && C.every((c) => by[c].currency === 'USD'), 'prices $179 / $349 / $599 USD, one-time');
check('MANIFEST', eq(col('max_recommended_institutions'), [3, 5, 7]), 'recommended institutions 3 / 5 / 7');
check('MANIFEST', eq(col('max_managed_applications'), [0, 2, 3]), 'managed applications 0 / 2 / 3 (a separate field from recommendations)');
check('MANIFEST', eq(col('essay_review_rounds'), [0, 2, null]) && eq(col('essay_review_scope'), ['NONE', 'ROUNDS', 'CONTRACTED_DOCUMENTS']),
  'editing none / 2 rounds / not rationed within the contracted documents');
check('MANIFEST', eq(col('support_window_type'), ['DAYS', 'DAYS', 'CONTRACT_TERM']) && eq(col('support_window_days'), [1, 3, null]),
  'support window 1 day / 3 days / contracted term');
check('MANIFEST', eq(col('follow_up_level'), ['CONSULTATION', 'TEAM', 'PRIORITY']) && eq(col('follow_up_consultations'), [1, null, null]),
  'follow-up: 1 consultation / responsible team / priority');
check('MANIFEST', eq(col('document_review_level'), ['CHECKLIST', 'REVIEW_GUIDANCE', 'INTENSIVE']), 'documents checklist / review+guidance / intensive');
check('MANIFEST', eq(col('mock_interviews'), [0, 0, 1]), 'mock interview add-on / add-on / 1 included');
check('MANIFEST', eq(col('visa_support_level'), ['GUIDANCE', 'DOCUMENT_PREP', 'INTENSIVE']), 'visa guidance / documents / documents + schedule');
check('MANIFEST', eq(col('dormitory_support_level'), ['INFORMATION', 'SCHEDULE', 'APPLICATION']), 'dormitory information / schedule / application + alternatives');
check('MANIFEST', eq(col('settlement_support_level'), ['NONE', 'INFORMATION', 'FULL']) && eq(col('basic_living_information'), [false, true, true]),
  'arrival none / living information / settlement');
check('MANIFEST', eq(col('pre_arrival_support_days'), [0, 0, 30]) && eq(col('settlement_days'), [0, 0, 30]), 'Premium D-30 pre-arrival, 30-day settlement');
check('MANIFEST', eq(col('priority_response'), [false, false, true]) && eq(col('dedicated_support'), [false, false, true]), 'priority + dedicated: Premium only');
check('MANIFEST', M.PLANS.filter((p) => p.recommended).map((p) => p.code).join() === 'ALL_IN_ONE', 'All-in-One is the one recommended plan');
check('MANIFEST', C.every((c) => !('consultation_minutes' in E(c))), 'no minutes-based consultation semantics');
check('MANIFEST', M.UPGRADE_POLICY.status === 'OWNER_DECISION_REQUIRED' && C.every((a) => C.every((b) => {
  const o = M.upgradeOffer(a, b); return o === null || o.amount_minor === null;
})), 'upgrade pricing is not invented (OWNER_DECISION_REQUIRED, no amount)');

/* ----------------------------------------------------------------------------- GENERATED */
try {
  execFileSync('node', [join(ROOT, 'scripts/plans/sync.mjs'), '--check'], { stdio: 'pipe' });
  ok('GENERATED', 'shared/plans.json is a fresh regeneration of plans.ts; previous catalogue frozen');
} catch (e) { bad('GENERATED', String(e.stderr || e.message).trim()); }
const shared = JSON.parse(read('shared/plans.json'));
check('GENERATED', existsSync(join(ROOT, `shared/plan-catalog/${M.SERVICE_CATALOG.previous}.json`)), `frozen ${M.SERVICE_CATALOG.previous}`);

/* ----------------------------------------------------------------------------- API + DATABASE */
if (NO_API) {
  results.push({ area: 'API', pass: null, msg: 'SKIP (--no-api) — not a PASS' });
} else {
  try {
    const r = await fetch(`${API}/api/v1/public/plans`);
    const j = await r.json();
    check('API', r.ok, `GET /public/plans ${r.status}`);
    for (const c of C) {
      const p = j.plans.find((x) => x.code === c);
      check('DATABASE', p && eq(p.entitlements, E(c)), `${c}: seeded entitlements === manifest`);
      check('DATABASE', p && p.price && p.price.amount_minor === by[c].amount_minor && p.price.currency === 'USD', `${c}: seeded price`);
    }
    check('API', j.catalog?.version === M.SERVICE_CATALOG.version, `API catalogue ${j.catalog?.version}`);
    check('API', eq((j.add_ons ?? []).map((a) => [a.code, a.pricing]), M.ADD_ONS.map((a) => [a.code, a.pricing])), 'API add-on catalogue === manifest');
  } catch (e) {
    bad('API', `API not reachable at ${API} (${e.message}) — start it or pass --no-api`);
  }
}

/* ----------------------------------------------------------------------------- SURFACES */
const pricing = read('apps/marketing-web/src/pages/home/pricing.tsx');
const services = read('apps/student-web/src/pages/Services.tsx');
const nativeSvc = read('apps/student-mobile/app/services.tsx');
const agency = read('apps/agency-web/src/components/Plan.tsx');
check('SURFACES', /compareCell\(/.test(pricing) && /planText\(/.test(pricing), 'marketing renders cells and card lines from the manifest');
check('SURFACES', /compareCell\(/.test(services) && /planText\(/.test(services), 'student /services renders the same cells and lines');
check('SURFACES', /planText\(/.test(nativeSvc), 'student native renders the same card lines');
check('SURFACES', /AllowanceText/.test(agency) && /ADD_ONS/.test(agency) && !/consultation_minutes/.test(agency), 'agency panel reads API usage + the catalogue');
const hardNumbers = [['marketing', pricing], ['student', services], ['native', nativeSvc], ['agency', agency]]
  .filter(([, src]) => /(17_?900|34_?900|59_?900|\$1?79\b|\$349|\$599)/.test(src)).map(([n]) => n);
check('SURFACES', hardNumbers.length === 0, `no surface holds a plan price of its own${hardNumbers.length ? ` (${hardNumbers.join(', ')})` : ''}`);

/* ----------------------------------------------------------------------------- CHECKOUT */
const studentApi = read('server/app/api/v1/student.py');
check('CHECKOUT', /plan_snapshot=entitlements_svc\.snapshot\(/.test(studentApi) && /catalog_version=entitlements_svc\.catalog_version\(\)/.test(studentApi),
  'every plan order snapshots the catalogue');
check('CHECKOUT', /UPGRADE_POLICY_REQUIRED/.test(studentApi) && /PLAN_ALREADY_ACTIVE/.test(studentApi), 'no upgrade or repeat purchase charged without a rule');
check('CHECKOUT', read('server/app/services/entitlements.py').includes('eng.entitlements'), 'limits are read from the engagement snapshot, not the live catalogue');

/* ----------------------------------------------------------------------------- I18N */
const LOC = join(ROOT, 'packages/i18n/locales');
const JOBS = existsSync(join(ROOT, 'scripts/i18n/v28/jobs')) ? readdirSync(join(ROOT, 'scripts/i18n/v28/jobs')).map((f) => f.replace('.json', '')) : [];
const OFFERED = ['ko', 'en', ...JOBS];
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const digits = (s) => String(s).replace(/\p{Nd}/gu, (d) => {
  for (const base of [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xe50, 0x1040, 0xff10]) { const n = d.codePointAt(0) - base; if (n >= 0 && n <= 9) return String(n); }
  return d;
});
const planKeys = M.PLANS.flatMap((p) => ['name', 'position', ...p.highlights].map((h) => `v29.pricing.${p.slug}.${h}`));
const otherKeys = [
  ...M.COMPARE_ROWS.map((r) => `v29.pricing.compare.row.${r.key}`), ...M.COMPARE_GROUPS.map((g) => `v29.pricing.compare.group.${g}`),
  ...M.SERVICE_NOTES.map((k) => `v29.pricing.notes.${k}`), 'v29.pricing.notes.title', 'v29.pricing.compare.scopeNote',
  ...M.ADD_ONS.map((a) => `v29.addon.item.${a.slug}`), ...[...new Set(M.ADD_ONS.map((a) => a.unit))].map((u) => `v29.addon.unit.${u}`),
];
const cellKeys = [...new Set(M.PLANS.flatMap((p) => M.COMPARE_ROWS.map((r) => M.compareCell(r, p).key.replace('common:', ''))))];
let missing = 0; const missingBy = {}; const wrong = [];
for (const loc of OFFERED) {
  const f = join(LOC, loc, 'common.json');
  const d = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  for (const k of [...planKeys, ...otherKeys, ...cellKeys]) {
    const v = get(d, k) ?? get(d, `${k}_other`);
    if (typeof v !== 'string' || !v.trim()) { missing += 1; missingBy[loc] = (missingBy[loc] ?? 0) + 1; }
  }
  const aio = digits(get(d, 'v29.pricing.all_in_one.f3') ?? '');
  const pre = digits(get(d, 'v29.pricing.premium.f3') ?? '');
  // "two rounds" may be a grammatical dual rather than a digit (Arabic جولتين / جولتان).
  const TWO = { ar: /جولت(ين|ان)|مرت(ين|ان)/ };
  if (aio && !/2/.test(aio) && !(TWO[loc]?.test(aio))) wrong.push(`${loc}: All-in-One editing line has no "2"`);
  if (pre && /\b[1-9]\b/.test(pre)) wrong.push(`${loc}: Premium editing line carries a round count`);
}
check('I18N', missing === 0, `plan/notes/add-on keys in ${OFFERED.length} offered locales: ${missing} missing${missing ? ` ${JSON.stringify(missingBy)}` : ''}`);
check('I18N', wrong.length === 0, `contract numbers inside translations${wrong.length ? `: ${wrong.join('; ')}` : ''}`);

/* ----------------------------------------------------------------------------- STALE semantics */
const SCAN = ['apps', 'packages', 'server/app', 'server/scripts', 'scripts/plans'];
const SKIP = /node_modules|\/dist|\/android\/|\/ios\/|\.expo|locales\/|plan-catalog|alembic\/versions|\/tests?\/|\.test\.|__pycache__|\.venv/;
const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|py|mjs)$/.test(name)) {
      const s = readFileSync(p, 'utf8');
      if (/consultation_minutes/.test(s) && !/legacy|V15|retired|frozen/i.test(s.slice(Math.max(0, s.indexOf('consultation_minutes') - 300), s.indexOf('consultation_minutes') + 200))) hits.push(`${p.replace(ROOT + '/', '')}: consultation_minutes`);
      if (/v15\.pricing\.\$\{?[a-z_]*\}?\.f[1-5]|v15\.pricing\.(basic|all_in_one|premium)\.f[1-5]/.test(s)) hits.push(`${p.replace(ROOT + '/', '')}: V15 card line key`);
      if (/whyDefault/.test(s)) hits.push(`${p.replace(ROOT + '/', '')}: price-difference upgrade copy key`);
    }
  }
};
for (const d of SCAN) walk(join(ROOT, d));
check('STALE', hits.length === 0, `retired plan semantics in source: ${hits.length}${hits.length ? ` — ${hits.slice(0, 8).join('; ')}` : ''}`);
const staleStrings = [];
for (const loc of OFFERED) {
  const f = join(LOC, loc, 'marketing.json');
  if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, 'utf8'));
  for (const slug of ['basic', 'all_in_one', 'premium']) if (get(d, `v15.pricing.${slug}.f1`)) staleStrings.push(`${loc}:${slug}`);
}
check('STALE', staleStrings.length === 0, `V15 card lines left in locale bundles: ${staleStrings.length}`);

/* ----------------------------------------------------------------------------- TESTS */
const t = existsSync(join(ROOT, 'server/tests/test_v29_contract.py')) ? read('server/tests/test_v29_contract.py') : '';
for (const name of ['test_basic_cannot_have_an_application_managed', 'test_managed_applications_stop_at_the_contract_and_the_next_one_is_an_add_on',
  'test_all_in_one_includes_two_edit_rounds_and_the_third_is_an_add_on', 'test_premium_editing_has_no_round_limit_inside_the_contract',
  'test_premium_unlimited_never_reaches_a_new_document', 'test_premium_first_mock_interview_is_included_and_the_second_is_an_add_on',
  'test_a_purchase_snapshots_the_contract_and_a_catalogue_change_does_not_rewrite_it', 'test_a_legacy_contract_keeps_its_terms']) {
  check('TESTS', t.includes(`def ${name}(`), name);
}

/* ----------------------------------------------------------------------------- report */
let failed = 0;
for (const r of results) {
  const tag = r.pass === null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
  if (r.pass === false) failed += 1;
  console.log(`${tag.padEnd(4)}  ${r.area.padEnd(9)}  ${r.msg}`);
}
console.log(`\nqa:plans-v29 — ${results.filter((r) => r.pass).length} pass · ${failed} fail · ${results.filter((r) => r.pass === null).length} skip`);
process.exit(failed ? 1 : 0);
