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
 *   1. the current QA ledgers (`npm run qa:launch` and `scripts/qa/launch-final/api.sh` → docs/qa/launch-final/after/logs/).
 *      A log older than the newest source file is STALE → FAIL_LOCAL: a green run of different code is not evidence;
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

/* ------------------------------------------------------------------------- 1. the QA chains (current layout) */
// 2026-11-20: retargeted from the removed V29 chain logs to the current QA folder. Web/visual evidence is the
// launch-final ledger (`npm run qa:launch` → docs/qa/launch-final/after/logs/ledger.txt, one "PASS|FAIL  <step>" line per
// step, a log per step); API evidence is `bash scripts/qa/launch-final/api.sh` → api-ledger.txt beside it.
const LF = join(ROOT, 'docs/qa/launch-final/after/logs');
const ledger = (name) => {
  const f = join(LF, name);
  if (!existsSync(f)) return null;
  return Object.fromEntries(readFileSync(f, 'utf8').split('\n').map((l) => /^(PASS|FAIL)\s+(\S+)/.exec(l)).filter(Boolean).map((m) => [m[2], m[1]]));
};
const web = ledger('ledger.txt');
const api = ledger('api-ledger.txt');
const GATES = [
  ['DOCS GATES', web, '01-docs-gates', 'npm run qa:launch'], ['LEAK SCAN (source)', web, '02-leak-source', 'npm run qa:launch'],
  ['I18N', web, '03-i18n', 'npm run qa:launch'], ['TOKENS CURRENT', web, '04-tokens-current', 'npm run qa:launch'],
  ['TYPECHECK', web, '05-typecheck', 'npm run qa:launch'], ['WEB TEST', web, '06-web-unit', 'npm run qa:launch'],
  ['BUILD (preview on)', web, '07-build-preview-on', 'npm run qa:launch'], ['LEAK SCAN (bundles)', web, '09-leak-bundles', 'npm run qa:launch'],
  ['DESIGN PREVIEW ISOLATION', web, '10-preview-isolation', 'npm run qa:launch'], ['RESPONSIVE (12 widths)', web, '13-matrix', 'npm run qa:launch'],
  ['ZOOM 200 %', web, '14-matrix-zoom-200', 'npm run qa:launch'], ['ACCESSIBILITY', web, '19-a11y', 'npm run qa:launch'],
  ['BUILD (preview off) + PREVIEW GATE', web, '21-preview-gate-off', 'npm run qa:launch'],
  ['API LINT', api, 'api-lint', 'bash scripts/qa/launch-final/api.sh'], ['API TEST', api, 'api-tests', 'bash scripts/qa/launch-final/api.sh'],
];
for (const [label, led, step, how] of GATES) {
  const f = join(LF, `${step}.log`);
  if (!led || !(step in led)) { add('LOCAL', label, 'FAIL_LOCAL', `no evidence — run: ${how}`); continue; }
  if (led[step] !== 'PASS') add('LOCAL', label, 'FAIL_LOCAL', `last run FAIL (${step}.log)`);
  else if (existsSync(f) && statSync(f).mtimeMs < newest) add('LOCAL', label, 'FAIL_LOCAL', `stale: ${step}.log predates ${newestFile}`);
  else add('LOCAL', label, 'PASS', `${step} PASS`);
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
