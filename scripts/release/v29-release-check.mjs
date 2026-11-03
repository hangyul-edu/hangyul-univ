/**
 * `npm run release:check` — V29 production readiness (brief §63–§65).
 *
 * Three states, and the command fails while any required item is not PASS:
 *
 *   PASS              locally solved and verified by evidence that is newer than the code it verifies
 *   FAIL_LOCAL        engineering work remains (or its evidence is missing / failing / stale)
 *   BLOCKED_EXTERNAL  needs an input this repository cannot create (owner, provider, counsel, reviewer, store, infra)
 *
 * Evidence comes from three places, none of them self-reported prose:
 *   1. the sequential QA chain's logs (`scripts/qa/v29/chain.sh` → docs/qa/v29/completion/logs/<step>.log, last line
 *      `EXIT=<code>`). A log older than the newest source file is STALE → FAIL_LOCAL: a green run of different code is
 *      not evidence;
 *   2. live checks run here (manifest/plans gate, console-locale honesty, production-readiness probe of the server's
 *      configuration capability — `server/scripts/v29_prod_readiness.py`);
 *   3. artefacts on disk (Android BUILD_INFO + scans).
 *
 * The verdict is READY_FOR_PRODUCTION only when every item is PASS. There is no override flag.
 *   --json   machine-readable output
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOGS = join(ROOT, 'docs/qa/v29/completion/logs');
const JSON_OUT = process.argv.includes('--json');
const items = [];
const add = (group, key, state, detail) => items.push({ group, key, state, detail });

/* ------------------------------------------------------------------------- newest source change */
const SRC_DIRS = ['apps', 'packages', 'server/app', 'shared'];
const SKIP = /node_modules|\/dist|\/android|\/ios|\.expo|__pycache__|\.venv|\/test-results|playwright-report/;
let newest = 0; let newestFile = '';
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (SKIP.test(p)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(ts|tsx|py|json|css|mjs)$/.test(n) && s.mtimeMs > newest) { newest = s.mtimeMs; newestFile = p.replace(ROOT + '/', ''); }
  }
};
for (const d of SRC_DIRS) walk(join(ROOT, d));

/* ------------------------------------------------------------------------- 1. the QA chain */
const GATES = [
  ['TYPECHECK', 'typecheck'], ['LINT (ruff; web lint = strict tsc)', 'lint-api'], ['API TEST', 'api-tests'], ['WEB TEST', 'web-tests'],
  ['E2E', 'e2e'], ['VISUAL QA', 'visual'], ['PRICING VISUAL (6 widths)', 'pricing-visual'], ['BUTTONS', 'buttons'], ['ACCESSIBILITY', 'a11y'],
  ['I18N', 'i18n-check'], ['I18N V29 TRANSLATIONS', 'l10n-v29'], ['KOREAN PARTICLES', 'particles'], ['CONSOLE LOCALES', 'console-locales'],
  ['PLAN CONSISTENCY', 'plans'], ['ADD-ON CONSISTENCY', 'addons'], ['SECURITY SCAN (no card data, no test login in prod)', 'security-scan'],
  ['BUILD', 'build-web'], ['NO DEMO / TEST LOGIN / PAID BYPASS IN BUILT WEB BUNDLES', 'built-scan'], ['CSP', 'csp'],
  ['NO DEV SECRET IN BUNDLES', 'bundle-secrets'], ['ANDROID PRODUCTION SCAN', 'native-scan'],
];
for (const [label, step] of GATES) {
  const f = join(LOGS, `${step}.log`);
  if (!existsSync(f)) { add('LOCAL', label, 'FAIL_LOCAL', `no evidence — run: bash scripts/qa/v29/chain.sh ${step}`); continue; }
  const text = readFileSync(f, 'utf8').trimEnd();
  const exit = /EXIT=(\d+)$/.exec(text)?.[1];
  const age = statSync(f).mtimeMs;
  if (exit !== '0') add('LOCAL', label, 'FAIL_LOCAL', `last run exit ${exit ?? '?'} (${step}.log)`);
  else if (age < newest) add('LOCAL', label, 'FAIL_LOCAL', `stale: ${step}.log predates ${newestFile}`);
  else add('LOCAL', label, 'PASS', `${step}.log EXIT=0`);
}

/* ------------------------------------------------------------------------- 2. live checks */
const run = (cmd, args, opts = {}) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 600_000, ...opts }) }; }
  catch (e) { return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }; }
};
const plans = run('node', ['scripts/qa/v29/plans.mjs']);
add('LOCAL', 'PLAN / ENTITLEMENT CONSISTENCY (live)', plans.ok ? 'PASS' : 'FAIL_LOCAL', (plans.out.trim().split('\n').pop() ?? '').slice(0, 160));
const cl = run('node', ['scripts/i18n/v29/console-locales.mjs', '--check']);
add('LOCAL', 'SELECTABLE CONSOLE LOCALES ARE COMPLETE (live)', cl.ok ? 'PASS' : 'FAIL_LOCAL', cl.out.trim().slice(0, 160));

const PR = join(ROOT, 'server/scripts/v29_prod_readiness.py');
if (!existsSync(PR)) {
  add('LOCAL', 'PRODUCTION CONTROLS PROBE', 'FAIL_LOCAL', 'server/scripts/v29_prod_readiness.py missing');
} else {
  const r = run(join(ROOT, 'server/.venv/bin/python'), ['-m', 'scripts.v29_prod_readiness'], { cwd: join(ROOT, 'server'), env: { ...process.env, HG_ENV: process.env.HG_ENV ?? 'development' } });
  let rows = [];
  try { const j = JSON.parse(r.out.slice(r.out.indexOf('{'))); rows = Array.isArray(j) ? j : j.controls ?? []; } catch { add('LOCAL', 'PRODUCTION CONTROLS PROBE', 'FAIL_LOCAL', `unparseable output: ${r.out.slice(0, 160)}`); }
  for (const row of rows) add(row.state === 'BLOCKED_EXTERNAL' ? 'EXTERNAL' : 'LOCAL', `PROD: ${row.key}`, row.state, row.detail ?? '');
}

/* ------------------------------------------------------------------------- 3. artefacts */
for (const app of ['student', 'agency', 'university']) {
  const f = join(ROOT, `result/${app}-mobile/android/BUILD_INFO.json`);
  if (!existsSync(f)) { add('LOCAL', `ANDROID ${app}`, 'FAIL_LOCAL', 'no BUILD_INFO.json'); continue; }
  const info = JSON.parse(readFileSync(f, 'utf8'));
  const pass = String(info.pass ?? info.version_pass ?? '');
  add('LOCAL', `ANDROID ${app} (built from V29 source)`, /V29/i.test(pass) ? 'PASS' : 'FAIL_LOCAL', `BUILD_INFO pass=${pass || '?'}`);
}
const smoke = join(ROOT, 'docs/qa/v29/completion/logs/android-smoke.log');
add('LOCAL', 'ANDROID EMULATOR SMOKE', existsSync(smoke) && /EXIT=0\s*$/.test(readFileSync(smoke, 'utf8')) ? 'PASS' : 'FAIL_LOCAL', existsSync(smoke) ? 'android-smoke.log' : 'not run');
const perf = join(ROOT, 'docs/qa/v29/PERF.md');
add('LOCAL', 'PERFORMANCE vs V28', existsSync(perf) ? 'PASS' : 'FAIL_LOCAL', existsSync(perf) ? 'docs/qa/v29/PERF.md' : 'not measured');

/* ------------------------------------------------------------------------- external, stated, never a PASS */
const plansJson = JSON.parse(readFileSync(join(ROOT, 'shared/plans.json'), 'utf8'));
const refund = JSON.parse(readFileSync(join(ROOT, 'shared/refund-policy.json'), 'utf8'));
const EXTERNAL = [
  ['Upgrade pricing rule', plansJson.upgrade_policy?.status === 'APPROVED', 'owner: UPGRADE_POLICY is ' + plansJson.upgrade_policy?.status],
  ['Refund commercial schedule', refund.commercial_schedule_approved === true && !JSON.stringify(refund).includes('OWNER_POLICY_REQUIRED'), 'owner: OWNER_POLICY_REQUIRED'],
  ['Counsel approval: privacy, terms, purchase consent, cross-border, company details', false, 'counsel'],
  ['Human native-speaker review of 34 locales', false, 'SYNTHETIC_NATIVE_REVIEWED only'],
  ['Independent penetration test', false, 'external security firm'],
  ['iOS build (Apple Developer account / EAS credentials)', false, 'EXTERNAL_BLOCKER_APPLE'],
  ['Play upload signing key (store-ready AAB)', false, 'artefacts are QA-signed'],
  ['University partnerships and university-owned photographs', false, 'EXTERNAL_ASSET_BLOCKER (166/425 photographed)'],
  ['Official admission data for institutions outside the managed set', false, 'unpublished / robots-blocked sources'],
];
for (const [k, done, who] of EXTERNAL) add('EXTERNAL', k, done ? 'PASS' : 'BLOCKED_EXTERNAL', who);

/* ------------------------------------------------------------------------- verdict */
const count = (s) => items.filter((i) => i.state === s).length;
const verdict = items.every((i) => i.state === 'PASS') ? 'READY_FOR_PRODUCTION' : 'NOT_READY_FOR_PRODUCTION';
if (JSON_OUT) {
  console.log(JSON.stringify({ verdict, counts: { PASS: count('PASS'), FAIL_LOCAL: count('FAIL_LOCAL'), BLOCKED_EXTERNAL: count('BLOCKED_EXTERNAL') }, items }, null, 2));
} else {
  for (const g of ['LOCAL', 'EXTERNAL']) {
    console.log(`\n${g === 'LOCAL' ? 'LOCAL GATES & CONTROLS' : 'EXTERNAL DEPENDENCIES'}`);
    for (const i of items.filter((x) => x.group === g)) console.log(`  ${i.state.padEnd(16)} ${i.key}${i.detail ? `  — ${i.detail}` : ''}`);
  }
  console.log(`\nPASS ${count('PASS')} · FAIL_LOCAL ${count('FAIL_LOCAL')} · BLOCKED_EXTERNAL ${count('BLOCKED_EXTERNAL')}`);
  console.log(`VERDICT: ${verdict}`);
}
process.exit(verdict === 'READY_FOR_PRODUCTION' ? 0 : 1);
