#!/usr/bin/env node
/**
 * `npm run qa:v32-leak` — zero test/demo residue (V32).
 *
 * 1. SOURCE: no demo sign-in, persona, test-login, paid-state bypass or fixture credential can reach a runtime bundle:
 *    apps/*, packages/* (not tests), the Expo apps, the current docs (README, docs/*.md top level, deployment docs).
 * 2. BUNDLES: the four production web builds (apps/*-web/dist) and, when present, the Expo production exports
 *    (docs/qa/v32/native/*-export) contain none of the strings either.
 * Historical REPORT sections are dated record and are excluded on purpose; the current-state section (§0) is not.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const PATTERNS = [
  /@demo\.hangyul\.kr/, /Hangyul!2026/, /테스트 계정으로 로그인/, /demo-login|demoLogin|DEMO_PERSONAS|TEST_ACCOUNTS\b/, /TestAccountSignIn|DevAccess|DemoAccess|useDemoParamLogin/,
  /VITE_DEMO_LOGINS|EXPO_PUBLIC_TEST_LOGIN|EXPO_PUBLIC_DEMO_LOGINS/, /dev-complete|devCompleteOrder|test_payment_bypass|TEST_PAYMENT_BYPASS/, /테스트: 선택한 플랜/,
  /Demo access|데모 접속|데모 로그인/, /\/__dev\b/, /demo\.hangyul\.kr/,
];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-e2e', 'dist-perf', 'android', 'ios', '.expo', '.vercel', 'test-results', 'playwright-report', 'coverage', 'result']);
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
const isTest = (p) => /\.test\.|\/tests?\/|\/e2e\/|\/fixtures\.py|\/seed\/|scripts\/qa\/|scripts\/i18n\/|scripts\/release\/|scripts\/review\//.test(p);
const hits = [];
// 1. source
for (const base of ['apps', 'packages', 'README.md', 'docs/deployment', 'docs/PRODUCT.md', 'docs/ARCHITECTURE.md', 'docs/I18N.md', 'docs/FRONTEND_CONVENTIONS.md', 'docs/SECURITY.md', 'docs/mobile']) {
  const full = path.join(ROOT, base);
  if (!fs.existsSync(full)) continue;
  const files = fs.statSync(full).isDirectory() ? [...walk(full)] : [full];
  for (const f of files) {
    if (!/\.(tsx?|mjs|js|json|md|py)$/.test(f) || isTest(f)) continue;
    if (/packages\/i18n\/locales/.test(f)) continue; // bundles are scanned through the builds
    const s = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.md')) {
      // Current docs may NAME a removed feature while saying it is gone; what they may never carry is a credential,
      // an address or an instruction that still works.
      for (const line of s.split('\n')) {
        if (/remov|no longer|gone|were deleted|V32/i.test(line)) continue;
        for (const re of PATTERNS) { const m = line.match(re); if (m) { hits.push(`${path.relative(ROOT, f)}: ${m[0]}`); break; } }
      }
      continue;
    }
    for (const re of PATTERNS) { const m = s.match(re); if (m) hits.push(`${path.relative(ROOT, f)}: ${m[0]}`); }
  }
}
// the REPORT's current-state section only
const report = fs.readFileSync(path.join(ROOT, 'docs/REPORT.md'), 'utf8');
const head = report.slice(0, report.indexOf('\n# 1.') > 0 ? report.indexOf('\n# 1.') : 60000);
for (const line of head.split('\n')) {
  if (/remov|no longer|gone|V32/i.test(line)) continue;
  for (const re of [/테스트 계정으로 로그인/, /Hangyul!2026/, /dev-complete/, /@demo\.hangyul\.kr/]) { const m = line.match(re); if (m) { hits.push(`docs/REPORT.md §0: ${m[0]}`); break; } }
}
// 2. bundles
const bundles = [];
for (const app of ['marketing', 'student', 'agency', 'university']) {
  const d = path.join(ROOT, 'apps', `${app}-web`, 'dist', 'assets');
  if (!fs.existsSync(d)) { console.log(`WARN  no production build for ${app} (apps/${app}-web/dist)`); continue; }
  for (const f of fs.readdirSync(d)) if (/\.(js|css)$/.test(f)) bundles.push(path.join(d, f));
}
const native = path.join(ROOT, 'docs/qa/v32/native');
if (fs.existsSync(native)) for (const f of walk(native)) if (/\.(js|hbc|bundle)$/.test(f)) bundles.push(f);
for (const f of bundles) {
  // Hermes bytecode keeps its string table as latin1 / UTF-16LE, so a .hbc is read in both encodings.
  const buf = fs.readFileSync(f);
  const views = f.endsWith('.hbc') ? [buf.toString('latin1'), buf.toString('utf16le')] : [buf.toString('utf8')];
  for (const s of views) for (const re of PATTERNS) { const m = s.match(re); if (m) { hits.push(`${path.relative(ROOT, f)}: ${m[0]}`); break; } }
}
console.log(`scanned ${bundles.length} bundle files`);
for (const h of hits) console.log('FAIL ', h);
console.log(hits.length ? `FAIL  qa:v32-leak (${hits.length})` : 'PASS  qa:v32-leak — no demo/test residue in source, current docs or production bundles');
process.exit(hits.length ? 1 : 0);
