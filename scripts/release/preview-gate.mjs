#!/usr/bin/env node
/**
 * `npm run release:preview-gate` — the Design Preview release gate.
 *
 * Design Preview (owner review of signed-in/paid screens from synthetic fixtures) is controlled by ONE build
 * flag, `VITE_ENABLE_DESIGN_PREVIEW`. This gate checks:
 *
 *   1. ONE SWITCH   the flag is read in exactly one source file (packages/ui/src/design-preview.tsx);
 *   2. NO NETWORK   the preview transport contains no `fetch(` call of its own and the fixtures carry no
 *                   credential, token or real-looking address;
 *   3. STATE        which deployments enable it (apps/*-web/vercel.json → build.env);
 *   4. BUNDLES      `--bundles off|on` — the built dist/ folders match that state: with the flag off, no
 *                   preview entry, indicator, transport or fixture reaches a bundle.
 *
 * `--launch` makes 3 a hard failure: before the public launch the flag must be off everywhere.
 * Without `--launch`, an enabled flag is reported as "OWNER REVIEW" and does not fail.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const launch = args.includes('--launch');
const bundles = args.includes('--bundles') ? args[args.indexOf('--bundles') + 1] : null;
const FLAG = 'VITE_ENABLE_DESIGN_PREVIEW';
const fails = []; const notes = [];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.vercel', 'android', 'ios'].includes(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

// 1. one switch
const readers = [];
for (const base of ['apps', 'packages']) {
  for (const f of walk(path.join(ROOT, base))) {
    if (!/\.(tsx?|mjs|js)$/.test(f) || /\.d\.ts$/.test(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (new RegExp(`import\\.meta\\.env\\.${FLAG}|process\\.env\\.${FLAG}`).test(s)) readers.push(path.relative(ROOT, f));
  }
}
if (readers.length !== 1 || readers[0] !== 'packages/ui/src/design-preview.tsx') fails.push(`flag must be read in exactly one file; found: ${readers.join(', ') || 'none'}`);

// 2. transport + fixtures
const dir = path.join(ROOT, 'packages/api-client/src/preview');
const transport = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(transport)) fails.push('preview transport performs network I/O');
const SECRET = [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, /(test|live)_[sc]k_[A-Za-z0-9]{10,}/, /"refresh_token":\s*"[^"]+"/, /@(?!preview\.invalid|[a-z.]*preview\.invalid|example\.(com|org))[a-z0-9-]+\.(com|kr|net|org|edu)"/i, /demo\.hangyul\.kr|Hangyul!2026/];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const re of SECRET) { const m = s.match(re); if (m) fails.push(`fixture ${f} contains a credential/real-looking address: ${m[0].slice(0, 60)}`); }
}

// 3. deployment state
const enabled = [];
for (const app of ['marketing', 'student', 'agency', 'university']) {
  const p = path.join(ROOT, 'apps', `${app}-web`, 'vercel.json');
  if (!fs.existsSync(p)) continue;
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (v.build?.env?.[FLAG] === '1') enabled.push(app);
}
if (enabled.length) (launch ? fails : notes).push(`${FLAG}=1 in vercel.json of: ${enabled.join(', ')} — ${launch ? 'must be removed before public launch' : 'OWNER REVIEW state (public-launch blocker)'}`);

// 4. bundles
if (bundles) {
  for (const app of ['marketing', 'student', 'agency', 'university']) {
    const assets = path.join(ROOT, 'apps', `${app}-web`, 'dist', 'assets');
    if (!fs.existsSync(assets)) { notes.push(`${app}: no dist`); continue; }
    const hit = fs.readdirSync(assets).filter((n) => n.endsWith('.js')).some((n) => /hg\.designPreview|DESIGN_PREVIEW|data-design-preview/.test(fs.readFileSync(path.join(assets, n), 'utf8')));
    const expect = bundles === 'on' && app !== 'marketing';
    if (hit !== expect) fails.push(`${app} bundle: preview code ${hit ? 'present' : 'absent'}, expected ${expect ? 'present' : 'absent'} (--bundles ${bundles})`);
  }
}

for (const n of notes) console.log(`NOTE  ${n}`);
for (const f of fails) console.log(`FAIL  ${f}`);
console.log(fails.length ? `\npreview gate: FAIL (${fails.length})` : `\npreview gate: PASS${enabled.length ? ' — preview ENABLED for owner review; run with --launch before public launch' : ' — preview disabled everywhere'}`);
process.exit(fails.length ? 1 : 0);
