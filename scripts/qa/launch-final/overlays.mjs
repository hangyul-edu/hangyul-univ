#!/usr/bin/env node
/**
 * Overlay / body-scroll-lock stress test (exhaustive pass, 2026-11-21).
 *
 * For each route: open every visible popup trigger (`aria-haspopup`, collapsed `aria-expanded` buttons, dialog
 * openers) one after another, close it with Escape (or its close button), and after each round require:
 *   - no leaked lock: <html>/<body> are not left `overflow: hidden` / `position: fixed`, no stale inline `top`;
 *   - no orphaned dialog / listbox / overlay still on screen;
 *   - the page still scrolls (when it is taller than the window) and focus is back in the document.
 * Then navigate in-app, go Back and Forward, and check the same again. Also resizes the window while an overlay is
 * open (phone ↔ desktop) and checks the lock is released after closing.
 *
 * Usage: node scripts/qa/launch-final/overlays.mjs --app student --widths 390,1440 [--routes /,/explore] [--out file]
 */
import fs from 'node:fs';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY, ROUTES } from './routes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const APP = opt('app', 'student');
const WIDTHS = opt('widths', '390,1440').split(',').map(Number);
const ONLY = opt('routes', null)?.split(',');
const OUT = opt('out', null);
/** `--all-buttons`: also every button in <main> (dialog openers without aria-haspopup). Safe in Design Preview: writes are refused. */
const ALL = args.includes('--all-buttons');
const OFF = Number(opt('port-offset', '0')); // a second set of builds served on 4200–4203
const BASE = `http://127.0.0.1:${{ marketing: 4100, student: 4101, agency: 4102, university: 4103 }[APP] + OFF}`;
const spec = ROUTES[APP];
const routes = spec.preview.length ? spec.preview : spec.public;

const state = () => {
  const b = document.body; const h = document.documentElement; const bs = getComputedStyle(b); const hs = getComputedStyle(h);
  const open = [...document.querySelectorAll('[role=dialog], [role=listbox], [role=menu], .hg-overlay, .hg-drawer, .hg-sheet')].filter((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && !el.closest('[hidden]');
  }).map((el) => `${el.getAttribute('role') ?? ''}.${String(el.className).split(' ')[0]}`);
  return {
    locked: bs.overflow === 'hidden' || hs.overflow === 'hidden' || bs.position === 'fixed' || bs.overflowY === 'hidden' || hs.overflowY === 'hidden',
    inlineTop: b.style.top || null, open, scrollable: h.scrollHeight > innerHeight + 4,
  };
};

const browser = await chromium.launch();
const report = [];
let failures = 0;
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768 });
  if (spec.preview.length) await ctx.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, location.pathname.startsWith('/hq') ? 'hq' : v); } catch { /* */ } }, [PREVIEW_KEY, spec.previewVariant ?? 'paid']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  for (const r of routes.filter((x) => !ONLY || ONLY.includes(x))) {
    if (r.includes('?doc=') || r.includes('application=') || /\/applications\/[0-9a-f-]{36}$/.test(r) && APP === 'agency') continue; // routes that open a drawer by URL (checked by the drawer test)
    const problems = [];
    await page.goto(`${BASE}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const base = await page.evaluate(state);
    if (base.locked) problems.push('locked on load');
    // Lists that are part of the page (an always-visible picker listbox) are not overlays left open.
    const inPage = new Set(base.open);
    const opened_ = (s) => s.open.filter((x) => !inPage.has(x));
    // Triggers: popups and dialog openers inside the page and its chrome.
    const n = await page.evaluate((ALL) => {
      const sel = ALL
        ? 'main button:not([disabled]):not([type=submit]), [aria-haspopup]:not([disabled]):not([aria-disabled=true])'
        : '[aria-haspopup]:not([disabled]):not([aria-disabled=true]), button[aria-expanded="false"]:not([disabled])';
      const els = [...document.querySelectorAll(sel)]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[data-design-preview="badge"], [data-design-preview="paid"], .hg-preview-indicator, details'); });
      els.forEach((el, i) => el.setAttribute('data-ov-i', String(i)));
      return els.length;
    }, ALL);
    let opened = 0;
    for (let i = 0; i < Math.min(n, ALL ? 24 : 10); i += 1) {
      const el = page.locator(`[data-ov-i="${i}"]`).first();
      if (!(await el.isVisible().catch(() => false))) continue;
      const label = (await el.getAttribute('aria-label').catch(() => null)) ?? (await el.textContent().catch(() => ''))?.trim().slice(0, 30);
      const before = page.url();
      await el.scrollIntoViewIfNeeded().catch(() => undefined);
      await el.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      if (page.url() !== before) { await page.goBack().catch(() => undefined); await page.waitForTimeout(400); continue; }
      const during = await page.evaluate(state);
      if (opened_(during).length) opened += 1;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      let after = await page.evaluate(state);
      if (opened_(after).length) {
        // Escape did not close it: try the overlay's own close control.
        const close = page.locator('[role=dialog] button[aria-label], .hg-drawer button[aria-label], .hg-sheet button[aria-label]').filter({ hasText: '' }).first();
        await close.click({ timeout: 1500 }).catch(() => undefined);
        await page.waitForTimeout(350);
        after = await page.evaluate(state);
        if (opened_(after).length) problems.push(`"${label}": still open after Escape and close (${after.open.join(',')})`);
        else problems.push(`"${label}": Escape does not close it`);
      }
      if (after.locked && !opened_(after).length) problems.push(`"${label}": body lock leaked after close`);
      if (after.inlineTop) problems.push(`"${label}": stale body top ${after.inlineTop}`);
      if (after.scrollable && !opened_(after).length) {
        const moved = await page.evaluate(async () => { window.scrollTo({ top: 0, behavior: 'instant' }); window.scrollBy({ top: 200, behavior: 'instant' }); await new Promise((ok) => setTimeout(ok, 80)); const y = scrollY; window.scrollTo({ top: 0, behavior: 'instant' }); return y; });
        if (moved < 1) problems.push(`"${label}": page no longer scrolls after close`);
      }
    }
    // Resize while an overlay is open (phone ↔ desktop), then close.
    const first = page.locator('[data-ov-i="0"]').first();
    if (await first.isVisible().catch(() => false)) {
      await first.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      await page.setViewportSize({ width: width < 768 ? 1280 : 390, height: 844 });
      await page.waitForTimeout(300);
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const s = await page.evaluate(state);
      if (s.locked && !s.open.length) problems.push('lock leaked after resize while open');
    }
    // Back / forward after an in-app navigation.
    const link = page.locator('main a[href^="/"]:visible').first();
    if (await link.count()) {
      await link.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await page.goBack().catch(() => undefined); await page.waitForTimeout(500);
      let s = await page.evaluate(state);
      if (s.locked && !s.open.length) problems.push('locked after Back');
      await page.goForward().catch(() => undefined); await page.waitForTimeout(500);
      s = await page.evaluate(state);
      if (s.locked && !s.open.length) problems.push('locked after Forward');
    }
    if (errors.length) { problems.push(`errors: ${errors.join(' | ')}`); errors.length = 0; }
    if (problems.length) failures += 1;
    report.push({ app: APP, width, route: r, triggers: n, opened, problems });
    console.log(`${problems.length ? '✗' : '✓'} ${APP} ${width} ${r} (triggers ${n}, overlays ${opened})${problems.length ? ` — ${problems.join(' ; ')}` : ''}`);
  }
  await ctx.close();
}
await browser.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), failures, report }, null, 1));
console.log(`\n${report.length} route runs · ${failures} with problems`);
process.exit(failures ? 1 : 0);
