#!/usr/bin/env node
/**
 * Production smoke for the four deployed products (real domains, real browser).
 *
 *   node scripts/qa/launch-final/smoke.mjs [--commit <sha>] [--out after]
 *
 * Per domain: build-info (app, commit, environment) · home/login renders with the Hangyul Univ brand ·
 * no page error · no failed same-origin request (CORS or otherwise) · no `localhost`/127.0.0.1 in any loaded
 * script · no page-level overflow at 390 and 1440 · API origin = same-origin `/api/v1` answering JSON
 * (`/auth/me` → 401 without a session, i.e. the private API is connected AND closed) · security headers.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const want = arg('commit', execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim());
const OUT = path.join(ROOT, 'docs', 'qa', 'launch-final', arg('out', 'after'));
fs.mkdirSync(path.join(OUT, 'production'), { recursive: true });
const SITES = [
  { app: 'marketing', origin: 'https://univ.talkhangyul.com', path: '/', preview: false },
  { app: 'student', origin: 'https://app.univ.talkhangyul.com', path: '/login', preview: true },
  { app: 'agency', origin: 'https://admin.univ.talkhangyul.com', path: '/login', preview: true },
  { app: 'university', origin: 'https://partner.univ.talkhangyul.com', path: '/login', preview: true },
];
const browser = await chromium.launch();
const report = { expectedCommit: want, sites: {}, failures: [] };
const fail = (m) => { report.failures.push(m); console.log(`FAIL ${m}`); };

for (const s of SITES) {
  const r = { };
  const bi = await fetch(`${s.origin}/build-info.json`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
  r.buildInfo = bi;
  if (!bi) fail(`${s.app}: no build-info.json`);
  else { if (bi.commit !== want) fail(`${s.app}: serves ${String(bi.commit).slice(0, 8)}, expected ${want.slice(0, 8)}`); if (bi.app !== s.app) fail(`${s.app}: build-info app=${bi.app}`); }
  const me = await fetch(`${s.origin}/api/v1/auth/me`).catch(() => null);
  r.api = me ? { status: me.status, type: me.headers.get('content-type'), body: (await me.text()).slice(0, 80) } : null;
  if (!me || me.status !== 401 || !/json/.test(r.api.type ?? '')) fail(`${s.app}: /api/v1/auth/me expected 401 JSON, got ${me ? me.status : 'no response'}`);
  for (const p of ['/api/v1/me/dashboard', '/api/v1/applications', '/api/v1/agency/students', '/api/v1/university/overview', '/api/v1/documents']) {
    const x = await fetch(s.origin + p).catch(() => null);
    if (!x || (x.status !== 401 && x.status !== 403)) fail(`${s.app}: ${p} is not closed to anonymous access (${x ? x.status : 'no response'})`);
  }
  const head = await fetch(s.origin + s.path);
  r.headers = Object.fromEntries(['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy'].map((h) => [h, (head.headers.get(h) ?? '').slice(0, 60)]));
  for (const [h, v] of Object.entries(r.headers)) if (!v) fail(`${s.app}: missing header ${h}`);

  r.views = {};
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; const failed = []; const scripts = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    page.on('requestfailed', (q) => { const u = q.url(); // ERR_ABORTED is the browser cancelling a request the page no longer needs (StrictMode double-mount of the session restore); it is not a failure.
      if (u.startsWith(s.origin) && q.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`${u.replace(s.origin, '')} ${q.failure()?.errorText}`); });
    page.on('console', (m) => { if (m.type() === 'error' && /CORS|blocked by|Content Security Policy/i.test(m.text())) errors.push(m.text().slice(0, 160)); });
    page.on('response', async (resp) => { const u = resp.url(); if (/\.js(\?|$)/.test(u) && u.startsWith(s.origin)) { const t = await resp.text().catch(() => ''); // A dev origin always carries a port; React Router's own `http://localhost` URL-parsing base does not.
      if (/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2):\d+/.test(t)) scripts.push(u.replace(s.origin, '')); } });
    await page.goto(s.origin + s.path, { waitUntil: 'networkidle', timeout: 60_000 }).catch((e) => errors.push(`goto: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, title: document.title, text: document.body.innerText.length, logo: !!document.querySelector('img[src*="logo"], .hg-logo, .kn-logo, svg[class*="logo"], img[alt*="Hangyul"], img[alt*="한귤"]'), preview: !!document.querySelector('[data-design-preview="login"]') }));
    r.views[width] = { ...m, errors, failed, localhostInScripts: scripts };
    if (m.sw > m.iw) fail(`${s.app} @${width}: page overflow ${m.sw}>${m.iw}`);
    if (!/Hangyul|한귤/.test(m.title)) fail(`${s.app}: title "${m.title}" lacks the brand`);
    if (m.text < 40) fail(`${s.app} @${width}: blank page`);
    if (errors.length) fail(`${s.app} @${width}: ${errors[0]}`);
    if (failed.length) fail(`${s.app} @${width}: failed request ${failed[0]}`);
    if (scripts.length) fail(`${s.app}: localhost URL in ${scripts[0]}`);
    await page.screenshot({ path: path.join(OUT, 'production', `${s.app}-${width}.png`) });
    await ctx.close();
  }
  r.previewEntry = r.views[1440].preview;
  report.sites[s.app] = r;
  console.log(`${s.app.padEnd(10)} commit ${String(bi?.commit).slice(0, 8)} · api ${r.api?.status} · preview entry ${s.preview ? r.previewEntry : 'n/a'}`);
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'production-smoke.json'), JSON.stringify(report, null, 1));
console.log(`\nproduction smoke: ${report.failures.length} failure(s)`);
process.exit(report.failures.length ? 1 : 0);
