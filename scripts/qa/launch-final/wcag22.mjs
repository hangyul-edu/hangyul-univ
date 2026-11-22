#!/usr/bin/env node
/**
 * WCAG 2.2 AA checks that axe does not make (product-excellence pass, 2026-11-22). Design Preview builds served by
 * serve.mjs (marketing :4100 · student :4101 · agency :4102 · university :4103).
 *
 *   2.4.11 Focus Not Obscured (Minimum) — real keyboard: from the top of each key screen, press Tab (and, from the end,
 *          Shift+Tab) up to N times; after every press the focused element must not be ENTIRELY hidden behind
 *          author-created content (sticky/fixed headers, tab bars, composers, sticky action bars). We sample the focused
 *          element's box at 9 points with elementsFromPoint and fail only when every visible point is covered by a
 *          fixed/sticky element that is not the focused element or its ancestor/descendant (the "minimum" criterion).
 *   3.3.8  Accessible Authentication (Minimum) — every login / sign-up / reset form: the identifier carries
 *          autocomplete=username|email, the password autocomplete=current-password|new-password, one-time codes
 *          autocomplete=one-time-code; no paste/copy blockers (an onpaste handler that prevents default fails);
 *          no cognitive-function test (no CAPTCHA puzzle element rendered — Turnstile managed mode is not a puzzle).
 *   2.5.7  Dragging Movements — every drag-and-drop file zone has a picker button alternative (static, per FileDrop);
 *          no draggable sortable lists without buttons.
 *   3.2.6  Consistent Help — the help entry (Support / Help / Messages) is in the same place on every Student route.
 *
 *   node scripts/qa/launch-final/wcag22.mjs [--out docs/qa/launch-final/excellence/results/wcag22.json] [--tabs 40]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY } from './routes.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', 'docs/qa/launch-final/excellence/results/wcag22.json'));
const TABS = Number(arg('--tabs', 40));
const off = Number(arg('--port-offset', 0));
const B = { marketing: 4100 + off, student: 4101 + off, agency: 4102 + off, university: 4103 + off };

const SCREENS = {
  student: ['/', '/match', '/applications/d96eabba-e018-4807-9de8-ea89c5aa8d56', '/documents', '/messages/0b312dca-149b-40e0-94f7-f67e002cca7d', '/profile', '/universities/pusan-national-university', '/more', '/essays/b180b72a-e7b9-4ac3-a91a-6df3eac7bf35'],
  agency: ['/', '/students', '/review?mode=documents', '/students/5e2ed4ec-c7a0-4c60-b0da-4905983e030e?tab=application', '/messages/84a80fb9-97f6-4d60-b78f-1e13baf3021a'],
  university: ['/', '/applications/8a3d287f-9d03-4198-8e72-7bfa14a2a3a8', '/analytics', '/messages'],
  marketing: ['/', '/universities', '/universities/pusan-national-university'],
};
const AUTH = { student: ['/login', '/register', '/forgot'], agency: ['/login'], university: ['/login'] };
const WIDTHS = [390, 1440];

/** In the page: is the focused element entirely covered by fixed/sticky author content? */
function obscured() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const vw = innerWidth; const vh = innerHeight;
  const pts = [];
  for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.15, 0.5, 0.85]) {
    const x = r.left + r.width * fx; const y = r.top + r.height * fy;
    if (x >= 0 && y >= 0 && x < vw && y < vh) pts.push([x, y]);
  }
  if (!pts.length) return { offscreen: true, tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 40) };
  const pinned = (n) => { for (let e = n; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const elPinned = pinned(el);
  let covered = 0; let by = null;
  for (const [x, y] of pts) {
    const top = document.elementFromPoint(x, y);
    if (!top || top === el || el.contains(top) || top.contains(el)) continue;
    const pin = pinned(top);
    if (pin && pin !== elPinned && !pin.contains(el)) { covered++; by = by ?? (pin.className?.toString?.() || pin.tagName).slice(0, 60); }
  }
  return covered === pts.length ? { tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), by, rect: [Math.round(r.top), Math.round(r.bottom)], scrollY: Math.round(scrollY) } : null;
}

const browser = await chromium.launch();
const report = { generated: new Date().toISOString(), focus: { runs: 0, presses: 0, failures: [] }, auth: [], dragging: [], help: [], failures: 0 };

for (const [app, routes] of Object.entries(SCREENS)) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, locale: 'ko-KR' });
    if (app !== 'marketing') await ctx.addInitScript(([k]) => { try { sessionStorage.setItem(k, location.pathname.startsWith('/hq') ? 'hq' : 'paid'); } catch { /* */ } }, [PREVIEW_KEY]);
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(`http://127.0.0.1:${B[app]}${route}${route.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(500);
      report.focus.runs++;
      for (const dir of ['Tab', 'Shift+Tab']) {
        if (dir === 'Shift+Tab') { await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); (document.activeElement)?.blur?.(); }); await page.keyboard.press('End').catch(() => {}); }
        else await page.evaluate(() => window.scrollTo(0, 0));
        for (let i = 0; i < TABS; i++) {
          await page.keyboard.press(dir);
          report.focus.presses++;
          // One frame for the page's own focus handling (scroll-into-view, the focus keeper) — what a person sees.
          await page.waitForTimeout(80);
          let bad = await page.evaluate(obscured);
          // A smooth scroll (marketing) or the focus keeper may still be moving the page: judge the settled state.
          if (bad) { await page.waitForTimeout(450); bad = await page.evaluate(obscured); }
          if (bad && !bad.offscreen) {
            report.focus.failures.push({ app, route, width, dir, press: i + 1, ...bad });
            break;
          }
        }
      }
    }
    // 3.2.6 Consistent Help: where the help entry sits on each Student route (same relative order in the shell).
    if (app === 'student') {
      for (const route of routes) {
        await page.goto(`http://127.0.0.1:${B[app]}${route}?lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
        const where = await page.evaluate(() => {
          const nav = [...document.querySelectorAll('nav a[href], .hg-sshell a[href]')].map((a) => a.getAttribute('href'));
          return { messagesInNav: nav.includes('/messages'), moreInNav: nav.includes('/more'), order: nav.filter((h) => ['/', '/explore', '/applications', '/messages', '/more'].includes(h)).slice(0, 5).join(' ') };
        });
        report.help.push({ route, width, ...where });
      }
    }
    await ctx.close();
  }
}

// 3.3.8 — authentication forms.
for (const [app, routes] of Object.entries(AUTH)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:${B[app]}${route}?lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')].filter((i) => i.offsetParent !== null);
      const id = inputs.find((i) => i.type === 'email' || /email|username/.test(i.autocomplete));
      const pw = inputs.filter((i) => i.type === 'password' || i.id.includes('password'));
      const otp = inputs.filter((i) => /otp|code/.test(i.className + i.id + i.name));
      const pasteBlocked = inputs.some((i) => i.onpaste !== null || i.getAttribute('onpaste'));
      const puzzle = !!document.querySelector('[class*="captcha" i]:not([data-managed]), iframe[src*="recaptcha"]');
      return {
        identifier: id ? id.autocomplete : null,
        passwords: pw.map((p) => p.autocomplete),
        otp: otp.map((o) => o.autocomplete),
        pasteBlocked, puzzle,
      };
    });
    const ok = (r.identifier === null || /^(username|email)$/.test(r.identifier)) && r.passwords.every((a) => /^(current-password|new-password)$/.test(a)) && r.otp.every((a) => a === 'one-time-code') && !r.pasteBlocked && !r.puzzle;
    report.auth.push({ app, route, ok, ...r });
    if (!ok) report.failures++;
  }
  await ctx.close();
}

// 2.5.7 — static: every FileDrop renders a picker button, sortable lists have button alternatives.
const src = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const fileDrop = src('packages/ui/src/filedrop.tsx');
report.dragging.push({ check: 'FileDrop offers a picker button (open())', ok: /open\s*[:(]/.test(fileDrop) && /type="button"/.test(fileDrop) });
report.dragging.push({ check: 'No HTML5 draggable sortable lists in the apps', ok: !['apps/student-web/src', 'apps/agency-web/src', 'apps/university-web/src'].some((d) => fs.readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith('.tsx')).some((f) => /draggable(=\{true\}|\s|>)/.test(src(path.join(d, String(f)))))) });
report.dragging.forEach((d) => { if (!d.ok) report.failures++; });
const orders = new Set(report.help.filter((h) => h.width === 390).map((h) => h.order));
report.help.consistent = orders.size <= 1;
if (!report.help.consistent) report.failures++;

report.failures += report.focus.failures.length;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`focus-not-obscured: ${report.focus.runs} screens, ${report.focus.presses} key presses, ${report.focus.failures.length} obscured`);
report.focus.failures.slice(0, 20).forEach((f) => console.log(`  ${f.app} ${f.route} @${f.width} ${f.dir}#${f.press}: <${f.tag}> "${f.text}" under ${f.by}`));
console.log(`auth: ${report.auth.filter((a) => a.ok).length}/${report.auth.length} forms ok`); report.auth.filter((a) => !a.ok).forEach((a) => console.log('  ', JSON.stringify(a)));
console.log(`dragging: ${report.dragging.filter((d) => d.ok).length}/${report.dragging.length} · consistent help: ${report.help.consistent}`);
console.log(`${report.failures} failures`);
await browser.close();
process.exit(report.failures ? 1 : 0);
