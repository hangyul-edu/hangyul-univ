// `npm run dev` — launches the API and the four web apps with labelled, colour-coded logs.
import concurrently from 'concurrently';

import { c, hasVenv, PY, SERVER } from './lib.mjs';

if (!hasVenv()) {
  console.error(c.red('Python environment not found. Run `npm run setup` first.'));
  process.exit(1);
}

const all = [
  // V22: the dev API scales its Redis rate limits (×1000, same as the API test suite) unless HG_RATELIMIT_SCALE is set,
  // because every local QA gate, Playwright run and emulator walk registers from 127.0.0.1 against this one limiter
  // (10 sign-ups/h/IP in production units). Production ignores this: the scale is read from the server environment.
  { name: 'api', prefixColor: 'magenta', cwd: SERVER, env: { HG_ENV: process.env.HG_ENV ?? 'development', HG_RATELIMIT_SCALE: process.env.HG_RATELIMIT_SCALE ?? '1000' }, command: `"${PY}" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app` },
  { name: 'marketing', prefixColor: 'yellow', command: 'npm run dev -w @hangyul/marketing-web' },
  { name: 'student', prefixColor: 'green', command: 'npm run dev -w @hangyul/student-web' },
  { name: 'agency', prefixColor: 'cyan', command: 'npm run dev -w @hangyul/agency-web' },
  { name: 'university', prefixColor: 'blue', command: 'npm run dev -w @hangyul/university-web' },
];
// HG_APPS=api,student,agency runs a subset (low-memory machines: every Vite dev server costs ~250 MB).
const only = (process.env.HG_APPS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const procs = only.length ? all.filter((p) => only.includes(p.name)) : all;

console.log(`
${c.orange(c.bold('  Hangyul Univ — development'))}
  Marketing   ${c.bold('http://localhost:3100')}
  Student     ${c.bold('http://localhost:3101')}
  Agency      ${c.bold('http://localhost:3102')}
  University  ${c.bold('http://localhost:3103')}
  API         ${c.bold('http://localhost:8001')}   docs ${c.bold('http://localhost:8001/docs')}
  ${c.dim('Demo password for every demo account: Hangyul!2026 · Ctrl+C stops everything')}
`);

const { result } = concurrently(procs, { prefix: '{name}', padPrefix: true, killOthersOn: ['failure'], restartTries: 0 });
result.catch(() => process.exit(1));
