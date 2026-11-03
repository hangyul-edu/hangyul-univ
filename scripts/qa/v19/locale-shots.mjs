/**
 * V19 — locale evidence for the critical conversion screens (REPORT §197, §205).
 *
 * `qa:locales` already *asserts* that all 33 markets render without clipping, overflow, English leakage or
 * mixed script. This captures the pictures behind that assertion, so the claim can be checked by eye rather
 * than taken on the gate's word — which is the specific thing V18 was criticised for not doing.
 *
 *   node scripts/qa/v19/locale-shots.mjs [--widths 390,1440] [--pages start,universities]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const { MARKETS } = await import(pathToFileURL(resolve(ROOT, 'packages/i18n/src/markets.ts')).href);

const ARG = process.argv.slice(2);
const val = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const WIDTHS = val('--widths', '390,1440').split(',').map(Number);
const PAGES = val('--pages', 'start,home,universities').split(',');

const PATHS = {
  home: '/',
  start: '/start',
  universities: '/universities',
};

const OUT = 'docs/qa/v19/screenshots/locales';
mkdirSync(OUT, { recursive: true });

const locales = [...new Set(MARKETS.map((m) => m.locale))];
console.log(`${locales.length} market locales × ${PAGES.length} pages × ${WIDTHS.length} widths`);

const browser = await chromium.launch();
let shot = 0;
const problems = [];

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 1000 } });
  const page = await ctx.newPage();
  for (const loc of locales) {
    for (const name of PAGES) {
      const url = `http://localhost:3100${PATHS[name]}?lang=${encodeURIComponent(loc)}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(900);
        // A quick structural check alongside the picture, so the evidence is not only visual.
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const clipped = [...document.querySelectorAll('button, .kn-btn, .hg-btn, h1, h2')]
            .filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').length;
          return {
            dir: de.getAttribute('dir') || 'ltr',
            lang: de.getAttribute('lang') || '',
            overflow: de.scrollWidth > window.innerWidth + 2 ? `${de.scrollWidth}>${window.innerWidth}` : '',
            clipped,
          };
        });
        if (m.overflow || m.clipped) problems.push(`${loc} ${name}@${w}: overflow=${m.overflow || '-'} clipped=${m.clipped}`);
        await page.screenshot({ path: `${OUT}/${name}-${loc}@${w}.png` });
        shot++;
      } catch (e) {
        problems.push(`${loc} ${name}@${w}: ${String(e).slice(0, 70)}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`\n${shot} screenshots → ${OUT}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗', p);
  process.exit(1);
}
console.log('No overflow and no clipped control on any market locale.');
