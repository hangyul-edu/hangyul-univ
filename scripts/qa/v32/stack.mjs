#!/usr/bin/env node
/**
 * V32 — a persistent QA stack on the ISOLATED e2e database, for screenshots and manual inspection while iterating.
 *
 *   node scripts/qa/v32/stack.mjs start   → clones hangyul_univ_e2e from the template, API on :8091, Vite DEV servers on
 *                                           4610 (marketing) 4611 (student) 4612 (agency) 4613 (university); writes
 *                                           docs/qa/v32/.stack.json with the pids
 *   node scripts/qa/v32/stack.mjs stop    → stops exactly what it started
 *
 * The development database (hangyul_univ) and the development ports (3100–3103, 8001) are never touched. Dev servers,
 * not production builds, so a CSS change is visible on reload; `qa:v32-selects` and the crawl use production builds
 * through scripts/qa/e2e-run.mjs.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const DB_URL = 'postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_qa';
const PORTS = { marketing: 4610, student: 4611, agency: 4612, university: 4613 };
const API_PORT = 8091;
const STATE = 'docs/qa/v32/.stack.json';
const STORAGE = './var/uploads-qa';
const cmd = process.argv[2];

const wait = async (url, ms = 120_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error(`timeout waiting for ${url}`);
};

if (cmd === 'start') {
  if (existsSync(STATE)) { console.error(`${STATE} exists — run stop first`); process.exit(2); }
  for (const port of [API_PORT, ...Object.values(PORTS)]) {
    if (await fetch(`http://localhost:${port}/`).then(() => true, () => false)) { console.error(`port ${port} busy`); process.exit(2); }
  }
  execFileSync('node', ['scripts/qa/e2e-db.mjs', 'fresh', 'hangyul_univ_qa'], { stdio: 'inherit' });
  rmSync(`server/${STORAGE}`, { recursive: true, force: true }); mkdirSync(`server/${STORAGE}`, { recursive: true });
  const pids = [];
  const log = (name) => openSync(`docs/qa/v32/.stack-${name}.log`, 'w');
  const api = spawn('.venv/bin/python', ['-m', 'uvicorn', 'app.main:app', '--port', String(API_PORT)], {
    cwd: 'server', detached: true, stdio: ['ignore', log('api'), log('api-err')],
    env: { ...process.env, HG_ENV: 'development', HG_DATABASE_URL: DB_URL, HG_STORAGE_DIR: STORAGE, HG_RATELIMIT_SCALE: '1000',
      HG_CORS_ORIGINS: Object.values(PORTS).map((p) => `http://localhost:${p}`).join(',') },
  });
  pids.push(api.pid);
  const env = {
    ...process.env, HG_API_URL: `http://127.0.0.1:${API_PORT}`,
    VITE_MARKETING_URL: `http://localhost:${PORTS.marketing}`, VITE_STUDENT_APP_URL: `http://localhost:${PORTS.student}`,
    VITE_AGENCY_APP_URL: `http://localhost:${PORTS.agency}`, VITE_UNIVERSITY_APP_URL: `http://localhost:${PORTS.university}`,
  };
  for (const [app, port] of Object.entries(PORTS)) {
    const p = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: `apps/${app}-web`, env, detached: true, stdio: ['ignore', log(app), log(`${app}-err`)] });
    pids.push(p.pid);
  }
  mkdirSync('docs/qa/v32', { recursive: true });
  writeFileSync(STATE, JSON.stringify({ pids, api: API_PORT, ports: PORTS, db: DB_URL, started: new Date().toISOString() }, null, 1));
  await wait(`http://localhost:${API_PORT}/healthz`);
  for (const port of Object.values(PORTS)) await wait(`http://localhost:${port}/`);
  console.log(`stack up: api :${API_PORT}, ${Object.entries(PORTS).map(([a, p]) => `${a} :${p}`).join(', ')}`);
} else if (cmd === 'stop') {
  if (!existsSync(STATE)) { console.log('nothing to stop'); process.exit(0); }
  const { pids } = JSON.parse(readFileSync(STATE, 'utf8'));
  for (const pid of pids) { try { process.kill(-pid, 'SIGTERM'); } catch { /* gone */ } }
  rmSync(STATE); rmSync(`server/${STORAGE}`, { recursive: true, force: true });
  console.log('stack stopped');
} else {
  console.error('usage: node scripts/qa/v32/stack.mjs start|stop'); process.exit(1);
}
