// `npm run setup` — first-time setup. Idempotent: safe to re-run.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { c, hasVenv, PY, ROOT, run, SERVER, VENV_BIN, which } from './lib.mjs';

const step = (s) => console.log(`\n${c.orange('●')} ${c.bold(s)}`);
const ok = (s) => console.log(`  ${c.green('✔')} ${s}`);
const warn = (s) => console.log(`  ${c.yellow('!')} ${s}`);

step('Checking prerequisites');
const [maj] = process.versions.node.split('.').map(Number);
if (maj < 20) { console.error(c.red('Node.js 20+ is required.')); process.exit(1); }
ok(`Node ${process.versions.node}`);
const python = ['python3', 'python'].find(which);
if (!python) { console.error(c.red('Python 3.11+ is required.')); process.exit(1); }
ok(`Python (${python})`);

step('Backend environment');
if (!existsSync(join(SERVER, '.env'))) { copyFileSync(join(SERVER, '.env.example'), join(SERVER, '.env')); ok('server/.env created from .env.example'); }
else ok('server/.env exists');
if (!hasVenv()) run(python, ['-m', 'venv', join(SERVER, '.venv')]);
run(join(VENV_BIN, 'pip'), ['install', '-q', '--upgrade', 'pip']);
run(join(VENV_BIN, 'pip'), ['install', '-q', '-e', `${SERVER}[dev]`, 'ruff']);
ok('Python dependencies installed');

step('PostgreSQL & Redis');
const pgReady = spawnSync(PY, ['-c', 'from app.core.db import engine; engine.connect().close()'], { cwd: SERVER, stdio: 'ignore' }).status === 0;
if (pgReady) ok('PostgreSQL reachable with HG_DATABASE_URL');
else if (which('docker')) {
  warn('PostgreSQL not reachable — starting docker compose services (postgres, redis, minio)');
  run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);
  spawnSync('sleep', ['5']);
} else {
  warn('PostgreSQL not reachable. Trying to create the role/databases with the local postgres superuser…');
  const sql = "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='hangyul') THEN CREATE ROLE hangyul LOGIN PASSWORD 'hangyul_dev' CREATEDB; END IF; END $$;";
  const asPg = (args) => spawnSync('sudo', ['-n', '-u', 'postgres', ...args], { stdio: 'inherit' }).status === 0 || spawnSync('su', ['postgres', '-c', args.map((a) => `'${a}'`).join(' ')], { stdio: 'inherit' }).status === 0;
  asPg(['psql', '-c', sql]);
  asPg(['createdb', '-O', 'hangyul', 'hangyul_univ']);
  asPg(['createdb', '-O', 'hangyul', 'hangyul_univ_test']);
}
if (which('redis-cli') && spawnSync('redis-cli', ['ping'], { stdio: 'ignore' }).status === 0) ok('Redis reachable (optional)');
else warn('Redis not reachable — optional in development (used for future background jobs)');

step('Database schema & demo data');
run(PY, ['-m', 'alembic', 'upgrade', 'head'], { cwd: SERVER });
run(PY, ['-m', 'app.seed.run'], { cwd: SERVER, allowFail: true });

step('Frontend assets');
run('node', ['packages/design-tokens/scripts/build-css.mjs']);
run('node', ['packages/i18n/scripts/gen-resources.mjs']);
if (!existsSync(join(ROOT, 'node_modules'))) run('npm', ['install']);
ok('tokens.css and i18n loaders generated');

console.log(`\n${c.green(c.bold('Setup complete.'))} Start everything with ${c.bold('npm run dev')}\n`);
