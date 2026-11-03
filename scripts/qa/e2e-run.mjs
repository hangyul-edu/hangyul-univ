// V8 deterministic E2E on an ISOLATED stack — the development stack (3100–3103, 8001) and database are never touched.
//   node scripts/qa/e2e-run.mjs [playwright args…]
// 1. clones hangyul_univ_e2e from the pristine template (scripts/qa/e2e-db.mjs; build it once with `template`)
// 2. API on :8090 against that database (no reload)
// 3. production builds of the four apps into dist-e2e (cross-app links → 460x), `vite preview` on 4600–4603
// 4. Playwright with HG_E2E_* pointing at the isolated stack; then stops only what it started.
import { execFileSync, spawn } from 'node:child_process';

const DB_URL = 'postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_e2e';
// Ports other sessions on this machine do not use (8010 / 4100 belong to another project). Refuses to start on a busy port.
const PORTS = { marketing: 4600, student: 4601, agency: 4602, university: 4603 };
const API_PORT = 8090;
const started = [];
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const wait = async (url, ms = 90_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error(`timeout waiting for ${url}`);
};
const E2E_STORAGE = './var/uploads-e2e';
import { rmSync, mkdirSync } from 'node:fs';
rmSync(`server/${E2E_STORAGE}`, { recursive: true, force: true }); mkdirSync(`server/${E2E_STORAGE}`, { recursive: true });
const stop = () => {
  for (const p of started) { try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ } }
  try { rmSync(`server/${E2E_STORAGE}`, { recursive: true, force: true }); } catch { /* fine */ }
  // V32: the cloned database is dropped with the stack, so no synthetic data outlives the run (teardown-check verifies).
  try { execFileSync('node', ['scripts/qa/e2e-db.mjs', 'drop'], { stdio: 'ignore' }); } catch { /* the template stays */ }
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

for (const port of [API_PORT, ...Object.values(PORTS)]) {
  const busy = await fetch(`http://localhost:${port}/`).then(() => true, () => false);
  if (busy) { console.error(`port ${port} is in use — refusing to start (never touches other workloads)`); process.exit(2); }
}
sh('node', ['scripts/qa/e2e-db.mjs', 'fresh']);
const env = {
  ...process.env,
  VITE_MARKETING_URL: `http://localhost:${PORTS.marketing}`,
  VITE_STUDENT_APP_URL: `http://localhost:${PORTS.student}`,
  VITE_AGENCY_APP_URL: `http://localhost:${PORTS.agency}`,
  VITE_UNIVERSITY_APP_URL: `http://localhost:${PORTS.university}`,
  HG_API_URL: `http://127.0.0.1:${API_PORT}`,
};
if (!process.env.HG_E2E_SKIP_BUILD) {
  for (const app of Object.keys(PORTS)) sh('npx', ['vite', 'build', '--outDir', 'dist-e2e', '--emptyOutDir'], { cwd: `apps/${app}-web`, env });
}
const api = spawn('.venv/bin/python', ['-m', 'uvicorn', 'app.main:app', '--port', String(API_PORT)], {
  cwd: 'server', detached: true, stdio: 'ignore',
  // The host Redis is shared by every run: without scaling, the per-IP registration limit (10/h) trips after a few
  // spec groups registered from 127.0.0.1 within the hour (V22 completion run: REGISTER_LIMITED on v6-writing). The
  // API tests use the same scale (`server/tests/conftest.py`); limiter semantics are covered by the API suite.
  // V26 (G-HYG-3): the e2e API writes uploads to its own directory, created here and removed at exit — the development
  // upload directory is never touched, so the hygiene gate's orphan-file count stays at zero after an e2e run.
  env: { ...process.env, HG_ENV: process.env.HG_ENV ?? 'development', HG_DATABASE_URL: DB_URL, HG_STORAGE_DIR: E2E_STORAGE, HG_RATELIMIT_SCALE: process.env.HG_RATELIMIT_SCALE ?? '1000', HG_CORS_ORIGINS: Object.values(PORTS).map((p) => `http://localhost:${p}`).join(',') },
});
started.push(api);
for (const [app, port] of Object.entries(PORTS)) {
  started.push(spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(port), '--strictPort'], { cwd: `apps/${app}-web`, env, detached: true, stdio: 'ignore' }));
}
await wait(`http://localhost:${API_PORT}/healthz`);
for (const port of Object.values(PORTS)) await wait(`http://localhost:${port}/`);
let code = 0;
try {
  // `--vitest <dir>`: an API-integration vitest suite (e.g. apps/student-mobile) against this stack instead of Playwright
  const vitest = process.argv[2] === '--vitest' ? process.argv[3] : null;
  sh('npx', vitest ? ['vitest', 'run', '--root', vitest, 'integration'] : ['playwright', 'test', ...process.argv.slice(2)], {
    env: {
      ...process.env,
      HG_E2E_API: `http://localhost:${API_PORT}`,
      HG_E2E_MARKETING: `http://localhost:${PORTS.marketing}`,
      HG_E2E_STUDENT: `http://localhost:${PORTS.student}`,
      HG_E2E_AGENCY: `http://localhost:${PORTS.agency}`,
      HG_E2E_UNIVERSITY: `http://localhost:${PORTS.university}`,
      HG_E2E_DB_URL: DB_URL, // for the fixture helpers a spec runs against the e2e database (scripts/fixture_pay.py)
      HG_E2E_KEEP: '1', // the database is thrown away after the run; no purge needed
      HG_QA_API: `http://localhost:${API_PORT}/api/v1`,
    },
  });
} catch (e) { code = e.status ?? 1; }
stop();
process.exit(code);
