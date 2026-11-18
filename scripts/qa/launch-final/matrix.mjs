#!/usr/bin/env node
/**
 * Launch-final responsive matrix: page-level overflow gate + screenshots.
 *
 *   node scripts/qa/launch-final/matrix.mjs --tag after \
 *     --marketing http://localhost:4100 --student http://localhost:4101 \
 *     --agency http://localhost:4102 --university http://localhost:4103 [--preview] [--only student] [--shots all]
 *
 * For every app × route × viewport it loads the page and asserts
 *     document.documentElement.scrollWidth <= window.innerWidth
 * (page-level horizontal overflow = FAIL). Deliberately horizontal controls scroll inside their own box and
 * do not widen the document, so they need no exclusion list. Screenshots are written for the viewports in
 * SHOT_WIDTHS (all viewports with `--shots all`).
 *
 * `--preview` enters Design Preview mode (synthetic fixtures, no API) before visiting the signed-in routes.
 * Without it only the public routes are visited. Output: docs/qa/launch-final/<tag>/.
 */
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { PREVIEW_KEY, ROUTES, VIEWPORTS } from './routes.mjs';

const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(`--${name}`);

const tag = opt('tag', 'after');
const only = opt('only', null);
const apps = opt('apps', null)?.split(',') ?? null;
const widths = opt('widths', null)?.split(',').map(Number) ?? null;
const locale = opt('lang', null);
const zoom = Number(opt('zoom', '1'));
const shots = opt('shots', 'key');
const outName = opt('out', tag);
const SHOT_WIDTHS = new Set([320, 390, 768, 1440]);
const OUT = path.join(ROOT, 'docs', 'qa', 'launch-final', outName);
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

const bases = Object.fromEntries(['marketing', 'student', 'agency', 'university'].map((a) => [a, opt(a, null)]).filter(([, v]) => v));
if (!Object.keys(bases).length) { console.error('No app base URL given.'); process.exit(2); }

const browser = await chromium.launch();
const results = [];
let failures = 0;

for (const [app, base] of Object.entries(bases)) {
  if ((only && only !== app) || (apps && !apps.includes(app))) continue;
  const spec = ROUTES[app];
  const routes = [
    ...spec.public.map((r) => ({ route: r, preview: false })),
    ...(flag('preview') ? spec.preview.map((r) => ({ route: r, preview: true })) : []),
  ];
  for (const vp of VIEWPORTS.filter((v) => !widths || widths.includes(v.width))) {
    // 200% zoom on a W-wide window is, for layout purposes, a W/2-wide viewport (CSS px) — which is how browsers reflow.
    const width = Math.round(vp.width / zoom);
    const height = Math.round(vp.height / zoom);
    for (const mode of [false, true]) {
      const set = routes.filter((r) => r.preview === mode);
      if (!set.length) continue;
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: flag('dark') ? 'dark' : 'light' });
      if (mode) await ctx.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }, [PREVIEW_KEY, spec.previewVariant ?? 'paid']);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
      for (const { route } of set) {
        const url = base.replace(/\/$/, '') + route + (locale ? `${route.includes('?') ? '&' : '?'}lang=${locale}` : '');
        errors.length = 0;
        let status = 'ok';
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
          await page.waitForTimeout(350);
        } catch (e) { status = `load-failed: ${String(e.message).slice(0, 120)}`; }
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const offenders = [];
          if (de.scrollWidth > window.innerWidth) {
            for (const el of document.querySelectorAll('body *')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.right > window.innerWidth + 1) {
                offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')} right=${Math.round(r.right)}`);
                if (offenders.length >= 4) break;
              }
            }
          }
          return { scrollWidth: de.scrollWidth, innerWidth: window.innerWidth, offenders, title: document.title, textLength: document.body.innerText.length, dir: de.dir, scheme: getComputedStyle(de).colorScheme, bg: getComputedStyle(document.body).backgroundColor };
        }).catch(() => ({ scrollWidth: -1, innerWidth: width, offenders: [], title: '', textLength: 0 }));
        const overflow = m.scrollWidth > m.innerWidth;
        // RTL must be structural (dir on <html>), and a dark device must not repaint the light-only product.
        const rtlWrong = !!locale && ['ar', 'he', 'fa', 'ur', 'ps'].includes(locale) && m.dir !== 'rtl' && app !== 'agency' && app !== 'university';
        const darkened = flag('dark') && !/light/.test(m.scheme ?? '');
        if (rtlWrong) errors.push(`dir=${m.dir} for ${locale}`);
        if (darkened) errors.push(`color-scheme=${m.scheme}`);
        const blank = m.textLength < 20;
        const row = { app, route, viewport: `${vp.width}x${vp.height}`, zoom, preview: mode, lang: locale ?? 'default', scrollWidth: m.scrollWidth, innerWidth: m.innerWidth, overflow, blank, status, pageErrors: [...errors], offenders: m.offenders };
        results.push(row);
        if (overflow || blank || status !== 'ok' || errors.length) {
          failures += 1;
          console.log(`FAIL ${app} ${route} @${vp.width}${zoom !== 1 ? `×${zoom}` : ''} ${overflow ? `overflow ${m.scrollWidth}>${m.innerWidth} [${m.offenders.join(' | ')}]` : ''}${blank ? ' blank' : ''}${status !== 'ok' ? ` ${status}` : ''}${errors.length ? ` errors: ${errors.join(' ; ')}` : ''}`);
        }
        if (shots === 'all' || (shots === 'key' && SHOT_WIDTHS.has(vp.width))) {
          const name = `${app}__${(route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home')}${mode ? '__preview' : ''}__${vp.width}${locale ? `__${locale}` : ''}${zoom !== 1 ? `__z${Math.round(zoom * 100)}` : ''}.png`;
          await page.screenshot({ path: path.join(OUT, 'screens', name), fullPage: true }).catch(() => {});
        }
      }
      await ctx.close();
    }
  }
}
await browser.close();

const suffix = `${only ? `-${only}` : ''}${locale ? `-${locale}` : ''}${zoom !== 1 ? `-z${Math.round(zoom * 100)}` : ''}${flag('dark') ? '-dark' : ''}`;
fs.writeFileSync(path.join(OUT, `matrix${suffix}.json`), JSON.stringify({ tag, zoom, locale, bases, total: results.length, failures, results }, null, 1));
const overflowCount = results.filter((r) => r.overflow).length;
console.log(`\n${results.length} page loads · ${overflowCount} page-level overflow · ${failures} failing rows → ${path.relative(ROOT, OUT)}/matrix${suffix}.json`);
process.exit(failures ? 1 : 0);
