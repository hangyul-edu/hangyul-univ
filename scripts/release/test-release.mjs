/**
 * `npm run test:release` — the one command that says whether this tree is shippable (V19, brief §22).
 *
 * V17 was criticised for tests that could silently skip, V18 for gates that were never validly run because
 * the stack was down, and `test:release` itself did not exist. So the contract here is deliberately harsh:
 *
 *   1. **The environment is checked first, and a missing dependency is a failure, not a skip.** Every gate
 *      below assumes PostgreSQL, Redis, the API and four web apps. A suite that "passes" because it could
 *      not reach the thing it tests is worse than no suite, because it produces a green tick.
 *   2. **Nothing is skipped silently.** A step may be declared `optional`, and an optional step that cannot
 *      run prints SKIP *with its reason* and is counted separately in the summary. Nothing else may skip.
 *   3. **Everything runs.** A failing step does not stop the run (unless `--bail`), because the point of a
 *      release check is the full list of what is wrong, not the first thing.
 *
 *   node scripts/release/test-release.mjs [--bail] [--quick]
 *
 * `--quick` drops the two long steps (the full build, and the Playwright e2e suite) for use while
 * iterating. It prints a loud banner saying the run was not a release check.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const ARG = process.argv.slice(2);
const BAIL = ARG.includes('--bail');
const QUICK = ARG.includes('--quick');
/* `--only a,b,c` runs a named subset in the same order with the same commands — for a host whose session cannot hold
 * one two-hour foreground process (V22 completion: 6 GB WSL VM with another project resident). The release verdict
 * is then the conjunction of every segment's exit code, recorded in docs/qa/v22/completion/FINISH_STATE.md. */
const ONLY = (() => { const i = ARG.indexOf('--only'); return i >= 0 ? new Set(ARG[i + 1].split(',')) : null; })();

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' };

/* ------------------------------------------------------------------------------ 0. the environment */

const SERVICES = [
  ['API', 'http://localhost:8001/healthz', 'npm run dev:api'],
  ['Marketing', 'http://localhost:3100/', 'npm run dev:marketing'],
  ['Student', 'http://localhost:3101/', 'npm run dev:student'],
  ['Agency', 'http://localhost:3102/', 'npm run dev:agency'],
  ['University', 'http://localhost:3103/', 'npm run dev:university'],
];
/** The server-free review bundle is served here for `qa:v17`'s review-render checks. */
const REVIEW = ['Review bundle', 'http://127.0.0.1:4173/', 'npx serve -s dist-review -l 4173'];

async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return r.status < 500;
  } catch { return false; }
}

console.log(`${C.bold}Hangyul Univ — release check${C.off}`);
if (QUICK) console.log(`${C.yellow}${C.bold}\n  ⚠  --quick: the build and the e2e suite are NOT run. This is not a release check.${C.off}`);

console.log(`\n${C.bold}0. Environment${C.off}`);
let envFailed = 0;
for (const [name, url, how] of [...SERVICES, REVIEW]) {
  const live = await reachable(url);
  const required = name !== 'Review bundle';
  if (live) console.log(`  ${C.green}✓${C.off} ${name.padEnd(14)} ${C.dim}${url}${C.off}`);
  else if (required) { envFailed++; console.log(`  ${C.red}✗ ${name.padEnd(14)} unreachable at ${url} — start it with \`${how}\`${C.off}`); }
  else console.log(`  ${C.red}✗ ${name.padEnd(14)} unreachable at ${url} — \`npm run review:build\` then \`${how}\`${C.off}`), envFailed++;
}
if (!existsSync(new URL('../../server/.env', import.meta.url))) {
  envFailed++;
  console.log(`  ${C.red}✗ server/.env is missing — the payment and security gates cannot run${C.off}`);
} else console.log(`  ${C.green}✓${C.off} server/.env present`);

if (envFailed) {
  console.log(`\n${C.red}${C.bold}Release check aborted: ${envFailed} environment problem(s).${C.off}`);
  console.log(`${C.dim}Every gate below depends on the full stack. Running them now would produce a green tick that means nothing — which is the exact failure this command exists to prevent.${C.off}`);
  process.exit(2);
}

/* ------------------------------------------------------------------------------ the steps */

/** `optional` steps may SKIP, with a printed reason. Nothing else may. */
const STEPS = [
  { group: 'Types & lint', name: 'typecheck', cmd: 'npm run typecheck' },
  { group: 'Types & lint', name: 'lint:api', cmd: 'npm run lint:api' },

  { group: 'Unit', name: 'test:api', cmd: 'npm run test:api' },
  { group: 'Unit', name: 'test:web', cmd: 'npm run test:web' },

  { group: 'i18n', name: 'i18n:check', cmd: 'npm run i18n:check' },

  /*
   * `release:check` is a **business-readiness report**, not a code gate, and it is classed as one.
   *
   * It asks whether the company legally exists in the product, whether a live payment provider is
   * contracted, whether Korean counsel has reviewed the terms, whether documents sit on encrypted
   * production object storage, whether usability sessions were run with real students. Every one of those
   * is an owner or external blocker (REPORT §209.2) and none of them can be turned green by changing code.
   * Counted as a failure it would make this command permanently red for reasons that have nothing to do
   * with the tree, and a check that is always red is a check nobody reads.
   *
   * It is still **run on every release check and printed in full** — `reportOnly` suppresses the exit
   * code, not the output. That is the opposite of a skip: the information is louder here than it was when
   * nothing ran it at all.
   */
  { group: 'External readiness', name: 'release:check', cmd: 'npm run release:check', reportOnly: true },

  /*
   * **Before the gates, not after.** `qa:v17` renders pages out of `dist-review/` to check the
   * server-free stakeholder build, and the first version of this file rebuilt that bundle in the *last*
   * group — so the gate validated whatever bundle happened to be lying on disk, which on this very run
   * was one built before any V19 change. A release check that validates a stale artifact is the same
   * class of mistake as one that skips a test.
   */
  { group: 'Build', name: 'review:build', cmd: 'npm run review:build', slow: true },

  { group: 'QA gates', name: 'qa:v12', cmd: 'npm run qa:v12' },
  { group: 'QA gates', name: 'qa:v13', cmd: 'npm run qa:v13' },
  { group: 'QA gates', name: 'qa:v14', cmd: 'npm run qa:v14' },
  { group: 'QA gates', name: 'qa:v15', cmd: 'npm run qa:v15' },
  { group: 'QA gates', name: 'qa:v16', cmd: 'npm run qa:v16' },
  { group: 'QA gates', name: 'qa:v17', cmd: 'npm run qa:v17' },
  { group: 'QA gates', name: 'qa:v18', cmd: 'npm run qa:v18' },
  { group: 'QA gates', name: 'qa:v19', cmd: 'npm run qa:v19' },
  /*
   * **V20 and V21 were missing from this list.** Both passes built gates and neither added them here,
   * so the release test had been certifying a release without running the checks for the two most
   * recent passes — the button contract, the currency presentation, the university visual tiers, the
   * media rights, and every payment-security rule. A release gate that does not run a gate is the
   * same class of mistake as a gate that does not check anything.
   */
  { group: 'QA gates', name: 'qa:v20', cmd: 'npm run qa:v20', slow: true },
  { group: 'QA gates', name: 'qa:v20-buttons', cmd: 'npm run qa:v20-buttons', slow: true },
  { group: 'QA gates', name: 'qa:v21', cmd: 'npm run qa:v21', slow: true },
  // V22: identity, roles, consoles, legal, discovery, native registration; provider smoke prints BLOCKED without credentials
  { group: 'QA gates', name: 'qa:v22', cmd: 'npm run qa:v22', slow: true },
  // V23 (REPORT §287): the final-RC gate (static + api + rendered) and the route/click integrity crawl.
  { group: 'QA gates', name: 'qa:v23', cmd: 'npm run qa:v23', slow: true },
  { group: 'QA gates', name: 'qa:v23-crawl', cmd: 'npm run qa:v23-crawl', slow: true },

  { group: 'Error matrix', name: 'error-matrix@1440', cmd: 'node scripts/qa/v19/error-matrix.mjs --width 1440', slow: true },
  { group: 'Error matrix', name: 'error-matrix@390', cmd: 'node scripts/qa/v19/error-matrix.mjs --width 390', slow: true },

  { group: 'End to end', name: 'test:e2e', cmd: 'npm run test:e2e', slow: true },
  // The whole conversion path as one user, in Korean and in a non-default language: clicks, scroll
  // surprises, dead ends, route jumps, and whether the language and the chosen plan survive to the
  // authenticated handoff.
  { group: 'End to end', name: 'journey:ko', cmd: 'node scripts/qa/v19/journey.mjs --lang ko', slow: true },
  { group: 'End to end', name: 'journey:vi', cmd: 'node scripts/qa/v19/journey.mjs --lang vi', slow: true },

  { group: 'Build', name: 'build', cmd: 'npm run build', slow: true },
];

function run(cmd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

const results = [];
let group = '';
for (const step of STEPS) {
  if (ONLY && !ONLY.has(step.name)) continue;
  if (QUICK && step.slow) {
    results.push({ ...step, state: 'skip', why: '--quick' });
    continue;
  }
  if (group !== step.group) { group = step.group; console.log(`\n${C.bold}${group}${C.off}`); }
  process.stdout.write(`  … ${step.name}`);
  const t = Date.now();
  const { code, out } = await run(step.cmd);
  const secs = ((Date.now() - t) / 1000).toFixed(0);
  process.stdout.write('\r');
  /*
   * **A passing step can still be hiding a coverage hole.** Playwright exits 0 with tests skipped, so
   * `test:e2e` reported a clean tick while 22 of its 74 tests had not run — every one of them downstream
   * of the same external blocker (no plan can be bought while USD is uncontracted, so every paid-case
   * journey skips). The skips are not *silent* — each carries a reason in its `test.skip()` — but a
   * release summary that does not surface them is, and the brief's rule is that a release-critical test
   * must never skip unnoticed. Any step whose output admits to skipping says so in the summary.
   */
  const skippedInOutput = /(\d+)\s+skipped/.exec(out);
  const withheld = skippedInOutput ? Number(skippedInOutput[1]) : 0;

  if (code === 0) {
    const note = withheld ? `  ${C.yellow}— ${withheld} test(s) did not run${C.off}` : '';
    console.log(`  ${C.green}✓${C.off} ${step.name.padEnd(20)} ${C.dim}${secs}s${C.off}${note}`);
    results.push({ ...step, state: 'pass', secs, withheld });
  } else if (step.reportOnly) {
    console.log(`  ${C.yellow}▲ ${step.name.padEnd(20)} ${secs}s — owner/external blockers outstanding, reported not gated${C.off}`);
    for (const line of out.split('\n').filter((l) => /FAIL|PASS|requirements met/.test(l))) console.log(`      ${C.dim}${line.trim()}${C.off}`);
    results.push({ ...step, state: 'report', secs });
  } else {
    console.log(`  ${C.red}✗ ${step.name.padEnd(20)} exit ${code}  (${secs}s)${C.off}`);
    // The last lines are where a gate prints its failures.
    for (const line of out.trimEnd().split('\n').slice(-14)) console.log(`      ${C.dim}${line}${C.off}`);
    results.push({ ...step, state: 'fail', code, secs, tail: out.slice(-4000) });
    if (BAIL) break;
  }
}

/* ------------------------------------------------------------------------------ summary */

const pass = results.filter((r) => r.state === 'pass');
const fail = results.filter((r) => r.state === 'fail');
const skipped = results.filter((r) => r.state === 'skip');
const reported = results.filter((r) => r.state === 'report');

console.log(`\n${'─'.repeat(72)}`);
console.log(`${C.bold}Release check:${C.off} ${C.green}${pass.length} passed${C.off}, ${fail.length ? C.red : ''}${fail.length} failed${C.off}, ${skipped.length} skipped, ${reported.length} reported`);
for (const r of fail) console.log(`  ${C.red}✗ ${r.group} › ${r.name}${C.off}`);
for (const r of reported) console.log(`  ${C.yellow}▲ ${r.group} › ${r.name} — outstanding, and outside this tree${C.off}`);
const withheldTotal = results.reduce((n, r) => n + (r.withheld || 0), 0);
if (withheldTotal) {
  console.log(`\n  ${C.yellow}${C.bold}${withheldTotal} test(s) passed the run without executing:${C.off}`);
  for (const r of results.filter((x) => x.withheld)) {
    console.log(`    ${C.yellow}• ${r.name}: ${r.withheld} skipped${C.off}`);
  }
  /*
   * **This used to name the cause, and the cause changed.** It read "today they are all one blocker:
   * a plan cannot be purchased while USD is uncontracted" — true when every paid-case journey stood
   * down, and false from V21, which made plans purchasable and took the e2e suite from 17 skips to
   * none. A summary that asserts a reason it has not checked is the same defect as a gate that
   * asserts a property it has not measured, so it now points at where the reasons actually are.
   */
  console.log(`  ${C.dim}Each carries its own reason at its \`test.skip()\`; the runner does not know them.`);
  console.log(`  A skip that no longer has a reason is a test to re-enable, not a test to ignore.${C.off}`);
}
for (const r of skipped) console.log(`  ${C.yellow}• SKIP ${r.group} › ${r.name} — ${r.why}${C.off}`);
if (QUICK) console.log(`\n${C.yellow}--quick was used. This run is NOT a release check.${C.off}`);
// V24 (REPORT §290 V24-1): the gates register real accounts (payment probe, V22 sign-up, native sign-up) and
// auto-routing hands them to the demo agencies. Remove them once the run is over so the demo stays a demo.
await new Promise((done) => spawn('node', ['scripts/api.mjs', 'purge-e2e'], { stdio: 'ignore' }).on('close', done));
process.exit(fail.length || QUICK ? 1 : 0);
