#!/usr/bin/env node
/**
 * Full-page screenshots of the public university detail page, plus a horizontal-overflow check.
 *
 *   BASE=http://localhost:3100 node scripts/qa/university-detail-shots.mjs <out-dir> [widths] [slugs] [lang]
 *
 * Defaults: widths 320,390,768,1440 · slugs ajou-university (rich), sejong-university (mid), inst-668 (sparse) · lang en.
 * SLICE=<px> additionally writes each page in slices of that height. Scrolls the page once before the capture so lazy images are loaded. Exits 1 when any page overflows horizontally
 * or throws a page error.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [out = 'university-detail-shots', widths = '320,390,768,1440', slugs = 'ajou-university,sejong-university,inst-668', lang = 'en'] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:3100';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--headless=new'] });
let failed = false;
for (const slug of slugs.split(',')) {
  for (const w of widths.split(',').map(Number)) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { failed = true; console.log('PAGEERROR', slug, w, e.message); });
    await p.goto(`${BASE}/universities/${slug}?lang=${lang}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.hg-uni, .hg-error, [role="alert"]', { timeout: 15000 }).catch(() => {});
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 600) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(60); }
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, h: document.documentElement.scrollHeight,
      h1: document.querySelectorAll('h1').length }));
    const overflow = m.sw > m.iw;
    if (overflow) failed = true;
    console.log(`${slug} @${w}${lang !== 'en' ? ` ${lang}` : ''}: height ${m.h}px, h1 ${m.h1}, ${overflow ? `OVERFLOW ${m.sw} > ${m.iw}` : 'no horizontal overflow'}`);
    const name = `${out}/${slug}${lang !== 'en' ? `-${lang}` : ''}-${w}`;
    await p.screenshot({ path: `${name}.png`, fullPage: true });
    // SLICE=<px>: also write the page in readable slices (<name>-s1.png …) for close inspection.
    const slice = Number(process.env.SLICE ?? 0);
    if (slice > 0) for (let y = 0, i = 1; y < m.h; y += slice, i += 1) {
      await p.screenshot({ path: `${name}-s${i}.png`, fullPage: true, clip: { x: 0, y, width: w, height: Math.min(slice, m.h - y) } });
    }
    await ctx.close();
  }
}
await b.close();
process.exit(failed ? 1 : 0);
