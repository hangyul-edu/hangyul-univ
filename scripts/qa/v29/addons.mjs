/**
 * `npm run qa:addons-v29` — the additional-services catalogue and its paid lifecycle (brief §78).
 *
 *   CATALOGUE   the six services, units, recommended ranges and quote-only items, literally as the owner set them
 *   NO DEFAULT  no range end / midpoint is ever a charge: the server requires an explicit unit price inside the range
 *   LIFECYCLE   offer → approve (order, nothing granted) → pay → ACTIVE (allowance or real service case) → COMPLETED,
 *               double approval = same order, double payment = one activation, decline is final, audit rows exist
 *   API         the public catalogue the API serves is the manifest's
 *
 * The lifecycle section runs the behavioural tests in server/tests/test_v29_contract.py (under the build lock — one
 * heavy process at a time on this host) and fails if any of them fails or is missing.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const API = process.env.HG_API_URL ?? 'http://127.0.0.1:8001';
const out = [];
const check = (area, cond, msg) => out.push({ area, pass: !!cond, msg });
const M = await import(pathToFileURL(join(ROOT, 'packages/types/src/plans.ts')).href);
const A = M.ADD_ON_BY_CODE;

const range = (c) => [A[c].pricing.min_minor, A[c].pricing.max_minor];
check('CATALOGUE', M.ADD_ONS.length === 6, 'six additional services');
check('CATALOGUE', JSON.stringify(range('EXTRA_MANAGED_APPLICATION')) === '[3000,5000]' && A.EXTRA_MANAGED_APPLICATION.unit === 'UNIVERSITY', 'extra managed application: per university, $30–50');
check('CATALOGUE', JSON.stringify(range('EXTRA_ESSAY_ROUND')) === '[2000,3500]' && A.EXTRA_ESSAY_ROUND.unit === 'EDIT_ROUND', 'extra edit: per round, $20–35');
check('CATALOGUE', JSON.stringify(range('MOCK_INTERVIEW')) === '[5000,7000]' && A.MOCK_INTERVIEW.unit === 'SESSION', 'mock interview: per session, $50–70');
check('CATALOGUE', JSON.stringify(range('DORMITORY_APPLICATION')) === '[5000,8000]' && A.DORMITORY_APPLICATION.effect.kind === 'SERVICE_CASE', 'dormitory: per application, $50–80, opens a service case');
check('CATALOGUE', A.AIRPORT_PICKUP.pricing.kind === 'QUOTE' && A.AIRPORT_PICKUP.referral && A.AIRPORT_PICKUP.requires_scope, 'airport pickup: quote, referral arrangement, scope required');
check('CATALOGUE', A.SETTLEMENT_SUPPORT.pricing.kind === 'QUOTE' && A.SETTLEMENT_SUPPORT.requires_scope, 'extra settlement support: quote, agreed scope required');
check('CATALOGUE', M.ADD_ONS.filter((a) => a.effect.kind === 'ENTITLEMENT').map((a) => a.effect.key).sort().join() === 'essay_review_rounds,max_managed_applications,mock_interviews', 'allowance effects: applications, edit rounds, mock interviews');

const d = A.EXTRA_MANAGED_APPLICATION;
check('NO DEFAULT', !M.addOnPriceAllowed(d, 0) && !M.addOnPriceAllowed(d, 2999) && !M.addOnPriceAllowed(d, 5001) && M.addOnPriceAllowed(d, 4000), 'client rule: inside the range only, never zero');
check('NO DEFAULT', !M.addOnPriceAllowed(A.AIRPORT_PICKUP, 0) && M.addOnPriceAllowed(A.AIRPORT_PICKUP, 12_345), 'a quote needs an explicit positive price');
const svc = readFileSync(join(ROOT, 'server/app/services/addons.py'), 'utf8');
check('NO DEFAULT', /ADD_ON_PRICE_OUT_OF_RANGE/.test(svc) && !/min_minor\s*\+\s*max_minor|\/\s*2\b/.test(svc), 'server: explicit unit price required; no midpoint arithmetic');
check('NO DEFAULT', /GRANTING = \(AddOnStatus\.ACTIVE, AddOnStatus\.COMPLETED\)/.test(readFileSync(join(ROOT, 'server/app/services/entitlements.py'), 'utf8')), 'only paid (ACTIVE/COMPLETED) add-ons raise a limit');

try {
  const j = await (await fetch(`${API}/api/v1/public/plans`)).json();
  check('API', JSON.stringify((j.add_ons ?? []).map((a) => [a.code, a.unit, a.pricing, a.effect])) === JSON.stringify(M.ADD_ONS.map((a) => [a.code, a.unit, a.pricing, a.effect])), 'API add-on catalogue === manifest');
} catch (e) { check('API', false, `API not reachable at ${API}: ${e.message}`); }

const TESTS = ['test_add_on_catalogue_is_ranges_and_quotes_never_a_default_price', 'test_add_on_prices_must_sit_inside_the_range_and_quotes_need_a_scope',
  'test_managed_applications_stop_at_the_contract_and_the_next_one_is_an_add_on', 'test_a_service_case_add_on_opens_real_work_once_paid_and_completes_with_it',
  'test_declining_grants_nothing_and_cannot_be_reopened', 'test_premium_unlimited_never_reaches_a_new_document',
  'test_premium_first_mock_interview_is_included_and_the_second_is_an_add_on'];
try {
  const res = execFileSync('flock', ['/tmp/claude-0/hg-build.lock', '.venv/bin/python', '-m', 'pytest', '-q', '-p', 'no:warnings', 'tests/test_v29_contract.py', '-k', TESTS.join(' or ')], {
    cwd: join(ROOT, 'server'), env: { ...process.env, HG_ENV: 'development', HG_REDIS_URL: 'redis://localhost:6379/9' }, encoding: 'utf8', stdio: 'pipe', timeout: 1_200_000,
  });
  // This repo's pytest config is quiet enough to print no summary; exit 0 + the progress dots are the result.
  const passed = (res.match(/^[.sxFE]+(?=\s+\[)/gm) ?? []).join('').split('').filter((c) => c === '.').length;
  check('LIFECYCLE', passed >= TESTS.length, `${passed}/${TESTS.length} lifecycle tests passed (offer · approve · pay · activate · complete · idempotency · audit)`);
} catch (e) {
  check('LIFECYCLE', false, `lifecycle tests failed:\n${String(e.stdout ?? '').split('\n').filter((l) => /FAILED|Error/.test(l)).slice(0, 8).join('\n')}`);
}

let failed = 0;
for (const r of out) { if (!r.pass) failed += 1; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.area.padEnd(10)}  ${r.msg}`); }
console.log(`\nqa:addons-v29 — ${out.length - failed} pass · ${failed} fail`);
process.exit(failed ? 1 : 0);
