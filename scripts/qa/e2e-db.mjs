// V8 deterministic E2E database: a pristine, freshly migrated + seeded template, cloned for every E2E run.
//   node scripts/qa/e2e-db.mjs template   — (re)build hangyul_univ_e2e_tpl (migrate + fixtures); slow, run after schema/seed changes
//   node scripts/qa/e2e-db.mjs fresh      — drop and clone hangyul_univ_e2e from the template (seconds)
// Then run the stack against it:  HG_DATABASE_URL=postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_e2e npm run dev
// The development database (hangyul_univ) is never touched.
import { execFileSync } from 'node:child_process';

const PG = { host: 'localhost', user: 'hangyul', password: 'hangyul_dev' };
const TPL = 'hangyul_univ_e2e_tpl';
const DB = process.argv[3] ?? 'hangyul_univ_e2e'; // V32: `fresh <name>` clones the template under another name (the QA stack)
const url = (db) => `postgresql+psycopg://${PG.user}:${PG.password}@${PG.host}:5432/${db}`;
const psql = (sql) => execFileSync('psql', ['-h', PG.host, '-U', PG.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tAc', sql], { env: { ...process.env, PGPASSWORD: PG.password }, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const py = (args, db) => execFileSync('.venv/bin/python', args, { cwd: 'server', env: { ...process.env, HG_DATABASE_URL: url(db) }, stdio: 'inherit' });
const drop = (db) => {
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid()`);
  psql(`DROP DATABASE IF EXISTS ${db}`);
};

const cmd = process.argv[2];
if (cmd === 'template') {
  drop(TPL);
  psql(`CREATE DATABASE ${TPL} OWNER ${PG.user}`);
  py(['-m', 'alembic', 'upgrade', 'head'], TPL);
  py(['-m', 'app.seed.fixtures'], TPL); // V32: reference data + the synthetic test layer (refuses a non-test database)
  // V27: checklists come only from verified guides; the e2e flows exercise the checklist machinery on the seeded sample
  // requirements, wrapped in labelled TEST FIXTURE guides (refused outside test/e2e databases).
  py(['-m', 'scripts.v27_test_fixture_guides'], TPL);
  console.log(`template ${TPL} ready`);
} else if (cmd === 'fresh') {
  drop(DB);
  psql(`CREATE DATABASE ${DB} TEMPLATE ${TPL} OWNER ${PG.user}`);
  console.log(`${DB} cloned from ${TPL}\nHG_DATABASE_URL=${url(DB)}`);
} else if (cmd === 'drop') {
  drop(DB);
  console.log(`${DB} dropped`);
} else {
  console.error('usage: node scripts/qa/e2e-db.mjs template|fresh [name]|drop [name]');
  process.exit(1);
}
