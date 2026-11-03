#!/usr/bin/env node
// Copies the fit engine's modules into apps/marketing-web/api/_fit/ for the Vercel Python function (P0, 2026-11-03).
// A function bundle may not reference files outside its project root (`../../server/...` is rejected at deploy), so
// the build stages the exact, unchanged files the engine imports — never edited, never committed (gitignored).
// Layout mirrors the repo so fit.py's own `parents[3] / "shared" / "admissions.json"` resolves unchanged.
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const OUT = join(ROOT, 'apps/marketing-web/api/_fit');
const FILES = ['server/app/__init__.py', 'server/app/services/__init__.py', 'server/app/services/fit.py', 'shared/admissions.json'];
const DIRS = ['server/app/models'];

rmSync(OUT, { recursive: true, force: true });
const copy = (rel) => { mkdirSync(dirname(join(OUT, rel)), { recursive: true }); cpSync(join(ROOT, rel), join(OUT, rel)); };
FILES.forEach(copy);
const walk = (rel) => {
  for (const name of readdirSync(join(ROOT, rel))) {
    const r = `${rel}/${name}`;
    if (name === '__pycache__') continue;
    if (statSync(join(ROOT, r)).isDirectory()) walk(r); else if (name.endsWith('.py')) copy(r);
  }
};
DIRS.forEach(walk);
console.log(`staged the fit engine into ${OUT.replace(`${ROOT}/`, '')}`);
