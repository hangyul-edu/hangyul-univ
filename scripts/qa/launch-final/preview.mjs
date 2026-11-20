#!/usr/bin/env node
/**
 * Design Preview gate (builds made with VITE_ENABLE_DESIGN_PREVIEW=1, served by serve.mjs).
 *
 * For Student, Operations/Admin and University it proves, in a real browser:
 *   1. the login page offers the preview entry, and clicking it lands on the signed-in product with the
 *      "Design Preview" indicator — without a credential;
 *   2. ISOLATION: from that click on, the page makes ZERO requests to `/api/` (or to any payment/SMS/mail host).
 *      The preview transport answers in-process, so a single network request to the API is a failure;
 *   3. every preview route renders (no page error, no blank page) and asks for no data the bundle lacks
 *      (misses are listed; `--strict` makes them fail);
 *   4. Student: preview starts unpaid → gated routes show the paywall → "Preview without paying" shows the
 *      entitled product, and no order/payment request is ever attempted;
 *   5. Exit returns to the real login with the preview state cleared.
 *
 *   node scripts/qa/launch-final/preview.mjs [--strict] [--out after]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY, ROUTES } from './routes.mjs';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const strict = process.argv.includes('--strict');
const outIdx = process.argv.indexOf('--out');
const OUT = path.join(ROOT, 'docs', 'qa', 'launch-final', outIdx >= 0 ? process.argv[outIdx + 1] : 'after');
fs.mkdirSync(OUT, { recursive: true });
const BASE = { student: 'http://127.0.0.1:4101', agency: 'http://127.0.0.1:4102', university: 'http://127.0.0.1:4103' };
const FORBIDDEN_HOST = /tosspayments|twilio|sendgrid|amazonaws|ngrok/i;

const browser = await chromium.launch();
const report = { apps: {}, failures: [] };
const fail = (m) => { report.failures.push(m); console.log(`FAIL ${m}`); };

for (const [app, base] of Object.entries(BASE)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const apiCalls = []; const foreign = []; const pageErrors = [];
  let armed = false;
  page.on('request', (r) => {
    if (!armed) return;
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/')) apiCalls.push(`${r.method()} ${u.pathname}`);
    if (FORBIDDEN_HOST.test(u.host)) foreign.push(u.host);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)));

  await page.goto(`${base}/login?lang=ko`, { waitUntil: 'networkidle' });
  const entry = page.locator('[data-design-preview="login"]');
  if (!(await entry.count())) { fail(`${app}: no preview entry on /login`); await ctx.close(); continue; }
  const entryText = (await entry.innerText()).trim();
  armed = true;
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), entry.click()]);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
  if (!(await page.locator('[data-design-preview="badge"]').count())) fail(`${app}: no Design Preview indicator after entering`);

  let paidFlow = null;
  if (app === 'student') {
    // Unpaid first: a gated route must land on the paywall, which must offer the paid preview.
    await page.goto(`${base}/applications`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const atPaywall = new URL(page.url()).pathname === '/services';
    const paid = page.locator('[data-design-preview="paid"]');
    paidFlow = { atPaywall, paidEntry: await paid.count() > 0, paidText: await paid.count() ? (await paid.innerText()).trim() : null };
    if (!atPaywall) fail('student: unpaid preview did not gate /applications to the paywall');
    if (!paidFlow.paidEntry) fail('student: paywall has no "preview without paying" entry');
    else {
      await page.screenshot({ path: path.join(OUT, 'preview-student-paywall.png'), fullPage: true });
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), paid.click()]);
      await page.waitForLoadState('networkidle').catch(() => {});
      paidFlow.variantAfter = await page.evaluate((k) => sessionStorage.getItem(k), PREVIEW_KEY);
      if (paidFlow.variantAfter !== 'paid') fail('student: paid preview did not switch the variant');
    }
  }

  const routes = [];
  for (const route of ROUTES[app].preview) {
    pageErrors.length = 0;
    await page.evaluate(() => { globalThis.__hgPreviewMisses = []; }).catch(() => {});
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({
      path: location.pathname + location.search, misses: [...new Set(globalThis.__hgPreviewMisses ?? [])],
      text: document.body.innerText.length, badge: !!document.querySelector('[data-design-preview="badge"]'),
      errorState: !!document.querySelector('.hg-error-state, [data-state="error"]'),
    }));
    routes.push({ route, ...info, pageErrors: [...pageErrors] });
    if (pageErrors.length) fail(`${app} ${route}: page error — ${pageErrors[0]}`);
    if (info.text < 40) fail(`${app} ${route}: blank`);
    if (!info.badge) fail(`${app} ${route}: indicator missing`);
    if (info.misses.length) { const m = `${app} ${route}: ${info.misses.length} fixture miss(es): ${info.misses.slice(0, 6).join(', ')}`; if (strict) fail(m); else console.log(`miss ${m}`); }
  }

  // A real credential typed while in preview must go nowhere, and a write must be refused in-process.
  const writes = await page.evaluate(() => globalThis.__hgPreviewWrites ?? []);
  if (apiCalls.length) fail(`${app}: ${apiCalls.length} network request(s) to /api during preview — ${[...new Set(apiCalls)].slice(0, 5).join(', ')}`);
  if (foreign.length) fail(`${app}: request(s) to ${[...new Set(foreign)].join(', ')} during preview`);

  // Exit.
  // The badge is a tab (expands) plus an explicit exit button; open the tab first when the exit is folded away.
  const exitBtn = page.locator('[data-design-preview="badge"] .hg-preview-badge__exit');
  if (!(await exitBtn.isVisible())) await page.locator('[data-design-preview="badge"] .hg-preview-badge__tab').click();
  await exitBtn.click();
  await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
  const after = await page.evaluate((k) => ({ key: sessionStorage.getItem(k), path: location.pathname }), PREVIEW_KEY);
  if (after.key !== null || after.path !== '/login') fail(`${app}: exit did not clear preview (${JSON.stringify(after)})`);

  report.apps[app] = { entryText, apiRequestsDuringPreview: apiCalls.length, forbiddenHostRequests: foreign.length, refusedWritesObserved: writes, paidFlow, routes };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'preview-isolation.json'), JSON.stringify(report, null, 1));
console.log(`\npreview: ${Object.keys(report.apps).length} apps · ${report.failures.length} failure(s) → ${path.relative(ROOT, OUT)}/preview-isolation.json`);
process.exit(report.failures.length ? 1 : 0);
