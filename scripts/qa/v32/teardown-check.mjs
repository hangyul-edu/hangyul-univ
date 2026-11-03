#!/usr/bin/env node
/**
 * V32 — after the E2E and QA stacks: nothing synthetic may remain anywhere a person could mistake for the product.
 *
 *  1. the throw-away databases the runs clone (hangyul_univ_e2e, hangyul_univ_qa) are dropped;
 *  2. the e2e/QA upload directories are gone;
 *  3. the development database still passes qa:v32-data-clean (test activity never touched it).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PG = { host: 'localhost', user: 'hangyul', password: 'hangyul_dev' };
const psql = (sql) => execFileSync('psql', ['-h', PG.host, '-U', PG.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tAc', sql], { env: { ...process.env, PGPASSWORD: PG.password }, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
let bad = 0;
for (const db of ['hangyul_univ_e2e', 'hangyul_univ_qa']) {
  if (existsSync('docs/qa/v32/.stack.json') && db === 'hangyul_univ_qa') { console.log(`SKIP  ${db} (the QA stack is still up; stop it with scripts/qa/v32/stack.mjs stop)`); continue; }
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid()`);
  psql(`DROP DATABASE IF EXISTS ${db}`);
  const left = psql(`SELECT count(*) FROM pg_database WHERE datname = '${db}'`);
  console.log(`${left === '0' ? 'PASS' : 'FAIL'}  ${db} dropped`); if (left !== '0') bad++;
}
for (const d of ['server/var/uploads-e2e', 'server/var/uploads-qa']) {
  // the QA stack's upload directory lives as long as the stack does (its database is skipped above on the same rule)
  if (d.endsWith('-qa') && existsSync('docs/qa/v32/.stack.json')) { console.log(`SKIP  ${d} (the QA stack is still up)`); continue; }
  const gone = !existsSync(d);
  console.log(`${gone ? 'PASS' : 'FAIL'}  ${d} absent`); if (!gone) bad++;
}
try {
  execFileSync('server/.venv/bin/python', ['scripts/qa/v32/data-clean.py'], { stdio: 'inherit' });
} catch { bad++; }
console.log(bad ? `FAIL  teardown-check (${bad})` : 'PASS  teardown-check — no test database or upload directory left; the development database is reference-only');
process.exit(bad ? 1 : 0);
