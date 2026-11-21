#!/usr/bin/env node
/**
 * Exhaustive-pass audit (2026-11-21): one sweep over every route of the four web products at chosen widths, in Design
 * Preview for the signed-in screens. Per page it records what a person would notice and what the gates check:
 *
 *   hOverflow   page-level horizontal overflow (documentElement.scrollWidth − innerWidth)
 *   scroll      the page (or its one real scroller) can be scrolled from top → middle → bottom and the last meaningful
 *               element ends fully visible and uncovered (nothing fixed on top of it)
 *   tinyText    visible text under 12 px
 *   smallTaps   (≤ 767 px) interactive controls whose hit box is under 44 px tall (inline text links excluded)
 *   nativeSelect visible bare <select>
 *   clipped     text cut by overflow:hidden without an ellipsis
 *   tokens      raw enum names, `undefined`, `null`, `NaN`, `Invalid Date`, `[object`, `{{` in visible text
 *   bodyLock    body/html left with overflow hidden / position fixed after load
 *   errors      console errors and page errors (excluding the expected 503 of the static server's /api)
 *
 * Usage: node scripts/qa/launch-final/audit.mjs --out <dir> [--apps student,agency] [--widths 320,390,768,1440]
 *        [--shots all|top|none] [--lang ko] [--routes /,/explore]
 * Needs the four builds served by serve.mjs (4100–4103), Design Preview on for student/agency/university.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY, ROUTES } from './routes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', 'docs/qa/launch-final/exhaustive/audit'));
const APPS = opt('apps', 'marketing,student,agency,university').split(',');
const WIDTHS = opt('widths', '320,390,768,1440').split(',').map(Number);
const SHOTS = opt('shots', 'top');
const LANG = opt('lang', 'ko');
const ONLY = opt('routes', null)?.split(',');
const OFF = Number(opt('port-offset', '0')); // e.g. 100 → a second set of builds served on 4200–4203
const BASE = Object.fromEntries(Object.entries({ marketing: 4100, student: 4101, agency: 4102, university: 4103 }).map(([k, p]) => [k, `http://127.0.0.1:${p + OFF}`]));
const HEIGHT = (w) => (w <= 320 ? 568 : w < 768 ? 844 : w < 1280 ? 1024 : 900);

fs.mkdirSync(OUT, { recursive: true });
const slug = (s) => s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'home';

const browser = await chromium.launch();
const results = [];

for (const app of APPS) {
  const spec = ROUTES[app];
  const list = [...spec.public.map((r) => ({ r, preview: false })), ...spec.preview.map((r) => ({ r, preview: true }))]
    .filter((x) => !ONLY || ONLY.includes(x.r));
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: HEIGHT(width) }, deviceScaleFactor: 1, hasTouch: width < 768, isMobile: false });
    for (const { r, preview } of list) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
      if (preview) await page.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, location.pathname.startsWith('/hq') ? 'hq' : v); } catch { /* */ } }, [PREVIEW_KEY, spec.previewVariant ?? 'paid']);
      else await page.addInitScript(([k]) => { try { sessionStorage.removeItem(k); } catch { /* */ } }, [PREVIEW_KEY]);
      const url = `${BASE[app]}${r}${r.includes('?') ? '&' : '?'}lang=${LANG}`;
      let res;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);
        await page.waitForTimeout(700);
        res = await page.evaluate(measure, { width });
        // Scroll oracle: top → middle → bottom.
        res.scroll = await page.evaluate(async () => {
          const se = document.scrollingElement;
          const cands = [se, ...document.querySelectorAll('main, main *')].filter((el) => {
            if (el === se) return el.scrollHeight > innerHeight + 2;
            const cs = getComputedStyle(el);
            return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 120;
          });
          const nested = cands.filter((c) => c !== se).map((c) => `${c.tagName.toLowerCase()}.${String(c.className).split(' ')[0]}`);
          const target = cands.includes(se) ? se : cands[0];
          if (!target) return { needed: false, nested };
          const max = target.scrollHeight - target.clientHeight;
          const wait = () => new Promise((ok) => setTimeout(ok, 120));
          const go = (top) => (target === se ? window.scrollTo({ top, behavior: 'instant' }) : target.scrollTo({ top, behavior: 'instant' }));
          go(Math.round(max / 2)); await wait();
          const mid = target.scrollTop;
          go(max + 100); await wait(); await wait();
          const bottom = target.scrollTop;
          // Last meaningful element inside main.
          const main = document.querySelector('main') ?? document.body;
          const els = [...main.querySelectorAll('button, a, p, h1, h2, h3, li, input, textarea, td, [role=button]')].filter((el) => {
            const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
            if (!(b.width > 0 && b.height > 0 && cs.visibility !== 'hidden') || el.closest('[hidden], [aria-hidden=true], dialog:not([open]), [inert]')) return false;
            // Content of a closed <details> keeps a layout box in Chromium; only its <summary> is really there.
            const closed = el.closest('details:not([open])');
            if (closed && !el.closest('summary')) return false;
            // Fixed/sticky chrome (tab bar, headers, trays) is not page content.
            for (let e = el; e && e !== main; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return false; }
            return true;
          });
          let last = null; let lastBottom = -Infinity;
          for (const el of els) { const b = el.getBoundingClientRect(); if (b.bottom > lastBottom) { lastBottom = b.bottom; last = el; } }
          let covered = null; let visible = true;
          if (last) {
            const b = last.getBoundingClientRect();
            // Unreachable = still below the viewport at maximum scroll. (Content above it was scrolled past, e.g. when a
            // footer follows <main>.)
            visible = b.bottom <= innerHeight + 1;
            const x = Math.min(innerWidth - 2, Math.max(1, b.left + b.width / 2)); const y = Math.min(innerHeight - 2, Math.max(1, b.top + Math.min(b.height / 2, 10)));
            const hit = document.elementFromPoint(x, y);
            // Only something on top of the lower half matters (a sticky bottom bar over the final action); a fixed header over
            // content that was scrolled past is not.
            if (b.top >= 0 && b.top > innerHeight / 2 && hit && !last.contains(hit) && !hit.contains(last)) covered = `${hit.tagName.toLowerCase()}.${String(hit.className).split(' ')[0]}`;
          }
          // The page may change height while it scrolls (sticky bars settle, lazy sections): compare with the maximum now.
          const maxNow = target.scrollHeight - target.clientHeight;
          return { needed: true, max: maxNow, mid, bottom, moved: bottom > 0 && mid > 0, reached: bottom >= Math.min(max, maxNow) - 2, last: last ? `${last.tagName.toLowerCase()}:${(last.textContent || last.getAttribute('aria-label') || '').trim().slice(0, 40)}` : null, visible, covered, nested };
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(150);
        if (SHOTS !== 'none') {
          const dir = path.join(OUT, app, String(width)); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${slug(r)}.png`), fullPage: SHOTS === 'all' }).catch(() => undefined);
        }
      } catch (e) {
        res = { fatal: String(e.message).slice(0, 200) };
      }
      const s = res.scroll;
      const problems = [];
      if (res.fatal) problems.push(`fatal: ${res.fatal}`);
      if (res.hOverflow > 0) problems.push(`hOverflow ${res.hOverflow}px`);
      if (s?.needed && !(s.moved && s.reached)) problems.push(`scroll: moved=${s.moved} reached=${s.reached}`);
      if (s?.needed && s.covered) problems.push(`last covered by ${s.covered}`);
      if (s?.needed && !s.visible) problems.push(`last not visible (${s.last})`);
      if (s?.nested?.length) problems.push(`nested scroll: ${s.nested.join(', ')}`);
      if (res.tinyText?.length) problems.push(`tinyText ${res.tinyText.length}: ${res.tinyText.slice(0, 3).join(' | ')}`);
      if (res.smallTaps?.length) problems.push(`smallTaps ${res.smallTaps.length}: ${res.smallTaps.slice(0, 4).join(' | ')}`);
      if (res.nativeSelect) problems.push(`nativeSelect ${res.nativeSelect}`);
      if (res.clipped?.length) problems.push(`clipped ${res.clipped.length}: ${res.clipped.slice(0, 3).join(' | ')}`);
      if (res.tokens?.length) problems.push(`tokens: ${res.tokens.slice(0, 5).join(' | ')}`);
      if (res.bodyLock) problems.push(`bodyLock ${res.bodyLock}`);
      if (errors.length) problems.push(`errors: ${errors.slice(0, 2).join(' | ')}`);
      results.push({ app, route: r, width, problems, ...res });
      process.stdout.write(`${problems.length ? '✗' : '✓'} ${app} ${width} ${r}${problems.length ? `  — ${problems.join(' ; ')}` : ''}\n`);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
const fail = results.filter((x) => x.problems.length);
fs.writeFileSync(path.join(OUT, `audit-${APPS.join('_')}.json`), JSON.stringify({ at: new Date().toISOString(), lang: LANG, widths: WIDTHS, total: results.length, withProblems: fail.length, results: results.map(({ app, route, width, problems, scroll }) => ({ app, route, width, problems, scroll })) }, null, 1));
console.log(`\n${results.length} pages · ${fail.length} with problems`);

/** Runs in the page. */
function measure({ width }) {
  const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && !el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, .hg-sr-only'); };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''}"${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`;
  const out = { hOverflow: document.documentElement.scrollWidth - innerWidth };
  // Tiny text: elements with a direct text node.
  const tiny = new Set();
  const clipped = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!el.childNodes.length) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText || !vis(el)) continue;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.fontSize) < 12 && !el.closest('[data-design-preview="badge"], .hg-preview-indicator, svg')) tiny.add(`${label(el)}@${cs.fontSize}`);
    if ((cs.overflowX === 'hidden' || cs.overflow === 'hidden') && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && cs.whiteSpace !== 'normal') clipped.push(label(el));
  }
  out.tinyText = [...tiny].slice(0, 20);
  out.clipped = clipped.slice(0, 20);
  if (width < 768) {
    const small = [];
    const targets = [...document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=combobox], input:not([type=hidden]), summary, [role=checkbox], [role=radio], [role=switch]')];
    for (const el of targets) {
      if (!vis(el)) continue;
      const own = el.getBoundingClientRect();
      // A pseudo-element hit area (absolute ::after / ::before) counts as the target.
      const pseudoH = Math.max(...['::after', '::before'].map((ps) => { const c = getComputedStyle(el, ps); return c.position === 'absolute' && c.content !== 'none' ? parseFloat(c.height) || 0 : 0; }));
      const b = { width: own.width, height: Math.max(own.height, pseudoH) };
      // Inline text links within running text are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|SPAN|LI|SMALL|LABEL)$/.test(el.parentElement.tagName)) continue;
      if (el.closest('[data-design-preview="badge"], [data-design-preview="paid"], .hg-preview-indicator')) continue;
      if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
      // Effective hit area: own box or a ::before extension is not measurable; accept ≥ 24 px for in-text-ish small controls, flag < 44 height.
      // Controls (buttons, inputs, tabs, selects) need 44 px; a text link that is not drawn as a button needs ≥ 24 px
      // (WCAG 2.5.8, and the product rule for small inline targets).
      // A button drawn as text (no fill, no edge) is a tertiary text action and follows the text-link rule too.
      const ecs = getComputedStyle(el);
      const drawnAsText = el.tagName === 'BUTTON' && !el.matches('.hg-btn:not(.hg-btn--link), .btn') && /rgba\(0, 0, 0, 0\)|transparent/.test(ecs.backgroundColor) && parseFloat(ecs.borderTopWidth) === 0 && parseFloat(ecs.borderBottomWidth) === 0;
      const textLink = (el.tagName === 'A' && !el.matches('.hg-btn, .btn, [role=tab], [role=button]')) || drawnAsText;
      // WCAG 2.5.8 spacing exception: an undersized text link passes when a 24 px circle centred on it touches no other target.
      if (textLink && b.height < 23.5) {
        const cx = own.left + own.width / 2; const cy = own.top + own.height / 2;
        const near = targets.some((o) => o !== el && !o.contains(el) && !el.contains(o) && (() => { const r = o.getBoundingClientRect(); if (!r.width || !r.height) return false; const dx = Math.max(r.left - cx, 0, cx - r.right); const dy = Math.max(r.top - cy, 0, cy - r.bottom); return Math.hypot(dx, dy) < 12; })());
        if (!near) continue;
      }
      if (b.height < (textLink ? 24 : 44) - 0.5 && !(el.closest('label') && el.closest('label').getBoundingClientRect().height >= 44)) small.push(`${label(el)}${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    out.smallTaps = small.slice(0, 30);
  }
  out.nativeSelect = [...document.querySelectorAll('select')].filter(vis).length;
  const text = document.body.innerText;
  const tok = new Set();
  for (const re of [/\b[A-Z]{2,}_[A-Z_]{2,}\b/g, /\bundefined\b/g, /\bNaN\b/g, /Invalid Date/g, /\[object/g, /\{\{/g, /\bnull\b/g]) for (const m of text.matchAll(re)) tok.add(m[0]);
  out.tokens = [...tok];
  const b = getComputedStyle(document.body); const h = getComputedStyle(document.documentElement);
  out.bodyLock = (b.overflow === 'hidden' || h.overflow === 'hidden' || b.position === 'fixed') ? `${b.overflow}/${h.overflow}/${b.position}` : null;
  return out;
}
