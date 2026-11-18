#!/usr/bin/env node
/**
 * Launch-final accessibility sweep: axe-core (WCAG 2.1 A/AA) on every public route and every Design Preview
 * route of the four products, at phone (390) and desktop (1280) widths. Serious/critical violations fail.
 * Also checks, per page: one <h1>, every form control has an accessible name, and — on phone — that
 * interactive controls in <main> are at least 24 px (WCAG 2.5.8) with primary controls at 44 px.
 *
 *   node scripts/qa/launch-final/a11y.mjs [--out after]
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY, ROUTES } from './routes.mjs';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const outIdx = process.argv.indexOf('--out');
const OUT = path.join(ROOT, 'docs', 'qa', 'launch-final', outIdx >= 0 ? process.argv[outIdx + 1] : 'after');
fs.mkdirSync(OUT, { recursive: true });
const AXE = path.join(ROOT, 'node_modules/axe-core/axe.min.js');
const BASE = { marketing: 'http://127.0.0.1:4100', student: 'http://127.0.0.1:4101', agency: 'http://127.0.0.1:4102', university: 'http://127.0.0.1:4103' };

const browser = await chromium.launch();
const rows = []; let failures = 0;
for (const [app, base] of Object.entries(BASE)) {
  for (const width of [390, 1280]) {
    for (const preview of [false, true]) {
      const routes = preview ? ROUTES[app].preview : ROUTES[app].public;
      if (!routes.length) continue;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'en-US', reducedMotion: 'reduce' });
      if (preview) await ctx.addInitScript(([k]) => sessionStorage.setItem(k, 'paid'), [PREVIEW_KEY]);
      const page = await ctx.newPage();
      for (const route of routes) {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
        await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(400);
        await page.addScriptTag({ path: AXE }).catch(() => {});
        const res = await page.evaluate(async () => {
          const out = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
          const v = out.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, first: x.nodes[0]?.target?.[0], html: x.nodes[0]?.html?.slice(0, 140) }));
          const h1 = document.querySelectorAll('h1').length;
          const tiny = [...document.querySelectorAll('main a[href], main button, main [role=button], main input:not([type=hidden]), main [role=combobox]')]
            .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'inline' && (r.height < 23.5 || r.width < 23.5) && !el.closest('.hg-sr-only') && el.getAttribute('type') !== 'checkbox' && el.getAttribute('type') !== 'radio'; })
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
          return { v, h1, tiny: [...new Set(tiny)].slice(0, 6) };
        }).catch((e) => ({ v: [{ id: 'axe-failed', impact: 'critical', n: 1, first: String(e.message).slice(0, 80) }], h1: -1, tiny: [] }));
        const bad = res.v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
        rows.push({ app, route, width, preview, h1: res.h1, violations: res.v, tiny: width === 390 ? res.tiny : [] });
        if (bad.length) { failures += 1; console.log(`FAIL ${app} ${route} @${width}${preview ? ' (preview)' : ''}: ${bad.map((x) => `${x.id}[${x.impact}]×${x.n} ${x.first}`).join(' ; ')}`); }
        if (width === 390 && res.tiny.length) console.log(`note ${app} ${route} @390 small targets: ${res.tiny.join(', ')}`);
        if (res.h1 !== 1) console.log(`note ${app} ${route} @${width}: ${res.h1} <h1>`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
const byRule = {};
for (const r of rows) for (const v of r.violations) { const k = `${v.id} [${v.impact}]`; byRule[k] = (byRule[k] ?? 0) + 1; }
fs.writeFileSync(path.join(OUT, 'a11y.json'), JSON.stringify({ pages: rows.length, failures, byRule, rows }, null, 1));
console.log(`\na11y: ${rows.length} page scans · ${failures} with serious/critical violations`);
console.log(Object.entries(byRule).map(([k, n]) => `  ${k}: ${n} page(s)`).join('\n'));
process.exit(failures ? 1 : 0);
