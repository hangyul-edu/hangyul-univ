/**
 * V20 — the visual QA sheet (brief §46, §61).
 *
 * Discovery at four widths, and the detail page for the representative set §46 names: the fourteen
 * best-known institutions, ten chosen at random from the rest of the register, and five with no
 * licensed imagery at all. The last group is the point of the exercise — the design has to hold for
 * the 368 institutions that are not famous and have no photograph, and the only way to know is to
 * look at them.
 *
 *   node scripts/qa/v20/capture.mjs [--widths 390,1440]
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = join(ROOT, 'docs/qa/v20/screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3100';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };

/** §46's named set. */
const FLAGSHIP = [
  'seoul-national-university', 'yonsei-university', 'korea-university', 'sungkyunkwan-university',
  'hanyang-university', 'kyung-hee-university', 'ewha-womans-university', 'sogang-university',
  'chung-ang-university', 'pusan-national-university', 'kyungpook-national-university', 'kaist',
  'pohang-university-of-science-and-technology', 'ulsan-national-institute-of-science-and-technology',
];

const registry = JSON.parse(readFileSync(join(ROOT, 'server/app/data/korean_institutions.json'), 'utf8')).institutions;
const content = existsSync(join(ROOT, 'server/app/data/university_content.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'server/app/data/university_content.json'), 'utf8')).records : {};

/** Deterministic "random": the same ten every run, so two passes are comparable. */
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const smaller = registry
  .filter((i) => !FLAGSHIP.includes(i.slug) && i.institution_type !== 'UNIVERSITY')
  .sort((a, b) => hash(a.slug) - hash(b.slug)).slice(0, 10).map((i) => i.slug);
const noMedia = registry
  .filter((i) => { const c = content[i.slug] ?? {}; return !c.media?.hero && !c.logo && !c.youtube?.video_id; })
  .sort((a, b) => hash(`x${a.slug}`) - hash(`x${b.slug}`)).slice(0, 5).map((i) => i.slug);

/**
 * A full-page screenshot resizes the viewport, which releases every lazy image at once; without
 * waiting for them to decode the sheet records grey boxes the product never shows. Wrapped in a
 * try/catch because a page that is still settling a client-side navigation destroys the execution
 * context mid-evaluate, and a capture run must not die 40 screenshots in because of a race.
 */
async function decodeAll(page) {
  try {
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))));
  } catch { /* context replaced — the waitForTimeout below is the fallback */ }
}

const WIDTHS = flag('--widths', '390,768,1440,1728').split(',').map(Number);
const browser = await chromium.launch();

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/universities`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await decodeAll(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/discovery-${width}.png`, fullPage: true });
  console.log(`  discovery-${width}`);
  await ctx.close();
}

for (const [group, slugs] of [['flagship', FLAGSHIP], ['smaller', smaller], ['nomedia', noMedia]]) {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
    const page = await ctx.newPage();
    for (const slug of slugs) {
      await page.goto(`${BASE}/universities/${slug}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await decodeAll(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${group}-${slug}-${width}.png`, fullPage: true });
    }
    console.log(`  ${group} × ${slugs.length} @ ${width}`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\n  → docs/qa/v20/screenshots (${WIDTHS.length} discovery + ${(FLAGSHIP.length + smaller.length + noMedia.length) * 2} detail)`);
console.log(`  smaller institutions: ${smaller.join(', ')}`);
console.log(`  no licensed media:    ${noMedia.join(', ')}`);
