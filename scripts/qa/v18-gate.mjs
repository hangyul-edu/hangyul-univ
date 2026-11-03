/**
 * V18 gate — the checks that would have caught what V18 found.
 *
 * Every check here exists because something in this pass was wrong in a way no existing gate noticed:
 * a port the brief and the code disagreed about, a coverage file that reported 100 % while 22 markets fell
 * back to English, a market count hardcoded in the gate that guards it, a dark band that three passes
 * "fixed" by resizing, a release that would silently become debug-signed, and an offline cache that could
 * quietly start persisting a payment result.
 *
 * It is deliberately static plus artifact inspection: it runs without a browser, without the dev stack and
 * without a device, so it cannot be skipped for want of an environment. Checks that genuinely need an
 * artifact SKIP with a reason when it is absent and FAIL when it is present and wrong — they never pass
 * silently.
 *
 *   node scripts/qa/v18-gate.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (p) => existsSync(join(ROOT, p));

let failed = 0;
let skipped = 0;
let passed = 0;
const head = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const ok = (s) => { passed++; console.log(`  \x1b[32m✓\x1b[0m ${s}`); };
const bad = (s) => { failed++; console.log(`  \x1b[31m✗ ${s}\x1b[0m`); };
const skip = (s) => { skipped++; console.log(`  \x1b[33m• SKIP ${s}\x1b[0m`); };

/* ------------------------------------------------------------------ 1. motion: editorial vs interface */
head('1. Homepage motion tokens');
{
  const src = read('packages/design-tokens/src/index.ts');
  const block = src.slice(src.indexOf('export const motion = {'), src.indexOf('} as const;', src.indexOf('export const motion = {')));
  const num = (k) => {
    const m = block.match(new RegExp(`${k}:\\s*'(\\d+)ms'`));
    return m ? Number(m[1]) : NaN;
  };
  // Editorial entrances: the V18 owner target, with room to tune by eye either side.
  const RANGES = { small: [810, 900], copy: [920, 1010], reveal: [980, 1080], media: [1140, 1240], hero: [1400, 1520], stagger: [130, 160] };
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = num(k);
    if (Number.isNaN(v)) bad(`motion.${k} not found`);
    else if (v < lo || v > hi) bad(`motion.${k} = ${v}ms, outside the V18 range ${lo}–${hi}ms`);
    else ok(`motion.${k} = ${v}ms`);
  }
  // Interface motion must NOT drift: "make the homepage feel slower" has to stay out of the interface.
  const UI = { fast: 120, base: 180, slow: 260 };
  for (const [k, want] of Object.entries(UI)) {
    const v = num(k);
    if (v !== want) bad(`motion.${k} = ${v}ms, must stay ${want}ms (interface motion is not editorial motion)`);
    else ok(`motion.${k} = ${v}ms (unchanged)`);
  }
  // The generated CSS must agree with the source, or the web apps ship the old numbers.
  const css = read('packages/design-tokens/tokens.css');
  for (const k of Object.keys(RANGES)) {
    const v = num(k);
    if (!css.includes(`--hg-motion-${k}: ${v}ms;`)) bad(`tokens.css is stale for --hg-motion-${k} — run npm run tokens:build`);
  }
  if (Object.keys(RANGES).every((k) => css.includes(`--hg-motion-${k}: ${num(k)}ms;`))) ok('tokens.css matches the source');
}

/* ------------------------------------------------------------------ 2. markets + locales */
head('2. Markets and locale coverage');
{
  const table = read('packages/i18n/src/markets.ts');
  const block = table.slice(table.indexOf('export const MARKETS'), table.indexOf('\n];', table.indexOf('export const MARKETS')));
  const rows = [...block.matchAll(/code:\s*'(\w+)',\s*asset:\s*'(\w+)',\s*locale:\s*'([\w-]+)'/g)];
  if (rows.length !== 33) bad(`markets.ts has ${rows.length} rows, expected 33`);
  else ok('33 canonical markets');
  for (const code of ['NP', 'MM']) {
    if (!rows.some((r) => r[1] === code)) bad(`${code} missing from the market table`);
  }
  if (rows.some((r) => r[1] === 'MM')) ok('Myanmar is a market (V18)');

  // every market's flag asset exists in the owner's drop and is published to every web app
  let flagsOk = true;
  for (const [, , asset] of rows) if (!has(`apps/flags/${asset}.svg`)) { bad(`flag asset ${asset}.svg missing`); flagsOk = false; }
  for (const app of ['marketing-web', 'student-web', 'agency-web', 'university-web']) {
    for (const [, code] of rows.map((r) => [r[1], r[1]])) void code;
    const dir = `apps/${app}/public/flags`;
    const n = has(dir) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.svg')).length : 0;
    if (n < rows.length) { bad(`${app}/public/flags has ${n}, expected ${rows.length} — run scripts/media/sync-flags.mjs`); flagsOk = false; }
  }
  if (flagsOk) ok(`every market has a flag asset, published to 4 apps`);

  // the Myanmar flag must be a real, safe asset — it is served to browsers
  if (has('apps/flags/MM.svg')) {
    const svg = read('apps/flags/MM.svg');
    if (/<script|javascript:|onload=|<foreignObject/i.test(svg)) bad('MM.svg contains script or foreignObject');
    else ok('MM.svg is script-free');
    if (!has('apps/flags/MM.PROVENANCE.md')) bad('MM.svg has no provenance file');
    else ok('MM.svg provenance recorded');
  }

  // delegate the real coverage measurement
  try {
    const out = execFileSync('node', [join(ROOT, 'scripts/qa/v18-locale-coverage.mjs')], { encoding: 'utf8' });
    const m = out.match(/V18 CORE complete:\s+(\d+)\/(\d+)/);
    if (!m) bad('locale coverage produced no result');
    else if (m[1] !== m[2]) bad(`V18 core surface complete in only ${m[1]}/${m[2]} markets`);
    else ok(`V18 core conversion surface complete in ${m[1]}/${m[2]} markets (no English fallback)`);
    const g = out.match(/FULL core gap:\s+(\d+)/);
    if (g) console.log(`      (full-surface gap, reported not gated: ${Number(g[1]).toLocaleString()} strings — REPORT §172)`);
  } catch (e) {
    bad(`locale coverage gate failed:\n${String(e.stdout ?? e.message).split('\n').slice(-12).join('\n')}`);
  }
}

/* ------------------------------------------------------------------ 3. the student page-head band */
head('3. Student web: the page-head band is gone');
{
  const v7 = read('apps/student-web/src/styles/app.css'); // V26: v7.css + v16.css were merged into styles/app.css
  const headBlock = v7.slice(v7.indexOf('Page headers on every student screen'));
  const scoped = headBlock.slice(0, headBlock.indexOf('/* V8 RTL QA') > 0 ? headBlock.indexOf('/* V8 RTL QA') : 4000);
  if (/background:\s*var\(--st7-night\)/.test(scoped)) bad('the page head still paints the night band');
  else ok('no night band on the student page head');
  if (/\.st-intro\)?::after\s*\{[^}]*radial-gradient/.test(scoped)) bad('the radial tangerine disc is still on the page head');
  else ok('no radial decoration on the student page head');
  const v16 = read('apps/student-web/src/styles/app.css');
  if (/\.hg-page-head[^\n]*\{[^}]*border-radius/.test(v16)) bad('v16.css still tunes the removed band');
  else ok('v16.css band rules removed, not left overriding nothing');
}

/* ------------------------------------------------------------------ 4. native offline cache safety */
head('4. Native offline cache');
{
  if (!has('packages/mobile-ui/src/bootstrap/offline.ts')) bad('no offline module');
  else {
    const src = read('packages/mobile-ui/src/bootstrap/offline.ts');
    if (!/OFFLINE_CACHEABLE_QUERIES/.test(src)) bad('no allowlist');
    else ok('offline cache is an allowlist');
    for (const forbidden of ['payment', 'checkout', 'order', 'document-file', 'upload', 'session', 'auth']) {
      if (!src.includes(`'${forbidden}'`)) bad(`'${forbidden}' is not explicitly refused by the offline cache`);
    }
    ok('payment, checkout, order, document bodies, uploads and credentials are refused');
    if (!/clearOfflineCache/.test(read('packages/mobile-ui/src/bootstrap/Providers.tsx'))) {
      bad('sign-out does not clear the disk cache');
    } else ok('sign-out clears the disk cache');
    if (!/onlineManager/.test(src)) bad('onlineManager is not wired — the app still assumes it is online');
    else ok('connectivity drives React Query');
  }
}

/* ------------------------------------------------------------------ 5. no stale :8000 in current code/docs */
head('5. The API port is 8001 everywhere current');
{
  // Historical audit logs keep their own record; current source and current docs must not.
  const roots = ['scripts', 'packages', 'apps', 'e2e', 'server/app'];
  const exts = /\.(ts|tsx|mjs|js|json|py)$/;
  const skipDir = /node_modules|dist|build|\.expo|public\/flags|locales|v9-data|v9-todo|v8-data|v10-data|android|ios|qa-screenshots/;
  const hits = [];
  const walk = (d) => {
    let entries = [];
    try { entries = readdirSync(join(ROOT, d), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = `${d}/${e.name}`;
      if (skipDir.test(rel)) continue;
      if (e.isDirectory()) walk(rel);
      else if (exts.test(e.name)) {
        const body = readFileSync(join(ROOT, rel), 'utf8');
        for (const line of body.split('\n')) {
          if (/(localhost|127\.0\.0\.1|10\.0\.2\.2):8000\b/.test(line) && !/v18-gate|v18-locale/.test(rel)) hits.push(`${rel}: ${line.trim().slice(0, 100)}`);
        }
      }
    }
  };
  roots.forEach(walk);
  if (hits.length) { bad(`${hits.length} live reference(s) to the API on :8000`); hits.slice(0, 6).forEach((h) => console.log(`      ${h}`)); }
  else ok('no source reference to the Hangyul API on :8000');

  for (const doc of ['docs/ARCHITECTURE.md', 'docs/FRONTEND_CONVENTIONS.md']) {
    if (/:8000\b/.test(read(doc))) bad(`${doc} still documents :8000`);
  }
  const report = read('docs/REPORT.md');
  const current = report.slice(0, report.indexOf('## Table of contents'));
  if (!/8001/.test(current)) bad('REPORT.md §0 does not state the current API port');
  else ok('REPORT.md §0 states :8001');
  if (!/# 0\. Current state/.test(report)) bad('REPORT.md has no current-state section');
  else ok('REPORT.md carries a current-state section above the historical audits');
}

/* ------------------------------------------------------------------ 6. reproducible release signing */
head('6. Release signing is reproducible');
{
  if (!has('apps/student-mobile/plugins/withReleaseSigning.js')) bad('signing is not a config plugin — the next prebuild will erase it');
  else {
    ok('release signing is an expo config plugin');
    const app = JSON.parse(read('apps/student-mobile/app.json'));
    const names = app.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    if (!names.includes('./plugins/withReleaseSigning')) bad('the signing plugin is not registered in app.json');
    else ok('signing plugin registered');
    if (!names.includes('expo-status-bar')) bad('expo-status-bar plugin not configured — status bar style is a no-op under edge-to-edge');
    else ok('status bar configured at theme level (edge-to-edge safe)');
    if (app.expo.androidStatusBar) bad('androidStatusBar is deprecated in SDK 57 and has no effect');
    if (!app.expo.android?.versionCode) bad('android.versionCode is not set');
    else ok(`version ${app.expo.version} / versionCode ${app.expo.android.versionCode} / buildNumber ${app.expo.ios?.buildNumber}`);
  }
  if (!has('apps/student-mobile/eas.json')) bad('no eas.json');
  else {
    const eas = JSON.parse(read('apps/student-mobile/eas.json'));
    for (const p of ['development', 'preview', 'production', 'android-apk', 'ios-simulator']) {
      if (!eas.build[p]) bad(`eas.json is missing the ${p} profile`);
    }
    if (eas.build.production?.android?.buildType !== 'app-bundle') bad('the production profile does not build an AAB');
    else ok('production → app-bundle, preview/android-apk → apk, ios-simulator → simulator');
  }
}

/* ------------------------------------------------------------------ 7. artifacts */
head('7. Release artifacts');
{
  const dir = 'result/student-mobile';
  if (!has(dir)) skip('result/student-mobile does not exist yet — run scripts/release/v18-collect.mjs');
  else {
    const apk = `${dir}/android/hangyul-univ-preview.apk`;
    const aab = `${dir}/android/hangyul-univ-production.aab`;
    for (const [label, p] of [['APK', apk], ['AAB', aab]]) {
      if (!has(p)) bad(`${label} missing at ${p}`);
      else {
        const size = statSync(join(ROOT, p)).size;
        if (size < 1024 * 1024) bad(`${label} is ${size} bytes — that is not a real binary`);
        else ok(`${label} present, ${(size / 1024 / 1024).toFixed(1)} MB`);
      }
    }
    const sums = `${dir}/metadata/SHA256SUMS.txt`;
    if (!has(sums)) bad('SHA256SUMS.txt missing');
    else {
      let allMatch = true;
      for (const line of read(sums).trim().split('\n')) {
        const [want, name] = line.trim().split(/\s+/);
        const p = join(ROOT, dir, 'android', name.replace(/^\*/, ''));
        if (!existsSync(p)) { bad(`SHA256SUMS lists ${name} which does not exist`); allMatch = false; continue; }
        const got = createHash('sha256').update(readFileSync(p)).digest('hex');
        if (got !== want) { bad(`checksum mismatch for ${name}`); allMatch = false; }
      }
      if (allMatch) ok('every listed checksum matches its binary');
    }
    if (!has(`${dir}/metadata/BUILD_INFO.json`)) bad('BUILD_INFO.json missing');
    else {
      const info = JSON.parse(read(`${dir}/metadata/BUILD_INFO.json`));
      for (const k of ['product', 'version', 'versionCode', 'expoSdk', 'reactNative', 'node', 'buildMethod', 'artifacts']) {
        if (info[k] === undefined) bad(`BUILD_INFO.json has no ${k}`);
      }
      const blob = JSON.stringify(info);
      if (/test_sk_|live_sk_|-----BEGIN|hangyulrelease/.test(blob)) bad('BUILD_INFO.json contains a secret');
      else ok('BUILD_INFO.json is complete and secret-free');
    }
    if (!has(`${dir}/metadata/BUILD_REPORT.md`)) bad('BUILD_REPORT.md missing');
    else {
      const r = read(`${dir}/metadata/BUILD_REPORT.md`);
      if (/build successful/i.test(r) && !/gradle/i.test(r)) bad('BUILD_REPORT.md says "build successful" without naming what built it');
      else ok('BUILD_REPORT.md present');
    }
    // never ship a placeholder IPA
    if (has(`${dir}/ios/hangyul-univ.ipa`)) {
      const size = statSync(join(ROOT, dir, 'ios/hangyul-univ.ipa')).size;
      if (size < 1024 * 1024) bad('a placeholder .ipa exists — the brief forbids this');
    } else ok('no placeholder iOS artifact');
  }
}

/* ------------------------------------------------------------------ 8. programme verification */
head('8. Programme verification');
{
  const csv = 'docs/qa/v18/PROGRAM_VERIFICATION.csv';
  if (!has(csv)) bad(`${csv} missing`);
  else {
    const lines = read(csv).trim().split('\n');
    const rows = lines.slice(1).filter(Boolean);
    const verified = rows.filter((r) => /,VERIFIED,/.test(r)).length;
    ok(`${rows.length} programmes tracked, ${verified} verified against an official source`);
    if (rows.length < 66) bad(`only ${rows.length} of the 66 active programmes are tracked`);
  }
}

/* ------------------------------------------------------------------ summary */
console.log(`\n${'─'.repeat(72)}`);
console.log(`V18 gate: \x1b[32m${passed} passed\x1b[0m, ${failed ? `\x1b[31m${failed} failed\x1b[0m` : '0 failed'}, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
