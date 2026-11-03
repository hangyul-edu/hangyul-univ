// Backend helper: npm run db:migrate | db:seed | db:reset | db:fixtures | test:api | lint:api
import { run, hasVenv, PY, SERVER, c } from './lib.mjs';

const cmd = process.argv[2];
// V23: the server's own default is production (fail closed, REPORT §268 P1); every local command is development.
process.env.HG_ENV ??= 'development';
if (!hasVenv()) { console.error(c.red('Run `npm run setup` first.')); process.exit(1); }
const py = (...args) => run(PY, args, { cwd: SERVER });
switch (cmd) {
  case 'migrate': py('-m', 'alembic', 'upgrade', 'head'); break;
  case 'seed': py('-m', 'app.seed.run'); break;
  case 'reset': py('-m', 'app.seed.run', '--reset'); break;
  // V32: synthetic test fixtures — refused by the module itself unless the database name contains test/e2e.
  case 'fixtures': py('-m', 'app.seed.fixtures'); break;
  case 'test': py('-m', 'pytest', '-q', '-p', 'no:warnings'); break;
  case 'lint': py('-m', 'ruff', 'check', 'app', 'tests', 'scripts', 'alembic'); break; // V26: the whole server tree, not a subset (REPORT §349, RC-23)
  case 'daily': py('-m', 'app.jobs.daily'); break;
  case 'purge-e2e': py('scripts/purge_e2e.py', ...process.argv.slice(3)); break;
  default: py('-m', 'uvicorn', 'app.main:app', '--port', '8001', '--reload', '--reload-dir', 'app');
}
