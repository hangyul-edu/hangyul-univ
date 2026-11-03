/**
 * V21 — the visual QA sheet (brief §53).
 *
 * Discovery at four widths, and the detail page for the representative set §53 names: the fourteen
 * best-known institutions, ten chosen at random from the rest of the register, and **ten** with no
 * licensed imagery at all. The last group is the point of the exercise — the design has to hold for
 * the 304 institutions that are not famous and have no photograph, and the only way to know is to
 * look at them.
 *
 * V21 adds the region disclosure open, because the map moved behind it and a sheet that never opens
 * it never shows the thing that changed.
 *
 *   node scripts/qa/v21/capture.mjs [--widths 390,1440]
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = join(ROOT, 'docs/qa/v21/screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3100';

const ARG = process.argv.slice(2);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };

/** §53's named set. */
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
  .sort((a, b) => hash(`x${a.slug}`) - hash(`x${b.slug}`)).slice(0, 10).map((i) => i.slug);

/**
 * A full-page screenshot resizes the viewport, which releases every lazy image at once; without
 * waiting for them to decode the sheet records grey boxes the product never shows. Wrapped in a
 * try/catch because a page that is still settling a client-side navigation destroys the execution
 * context mid-evaluate, and a capture run must not die 40 screenshots in because of a race.
 */
/**
 * Un-arm the scroll reveals before capturing.
 *
 * Anything below the fold carries `data-reveal` and starts at `opacity: 0` until an
 * IntersectionObserver fires. A full-page screenshot resizes the viewport rather than scrolling, so
 * the observer never fires and the sheet records a **blank band** where the content is — the V21
 * discovery shots showed 370 px of white where the site's call to action is, and it is on the page
 * for every real visitor. A QA sheet that under-reports what shipped is worse than no sheet, so the
 * reveals are completed before the shutter rather than waited on.
 */
async function settleReveals(page) {
  try {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-reveal], .kn-reveal')) el.classList.add('is-in');
      // Lazy images below the fold have the same problem for the same reason: a full-page screenshot
      // resizes the viewport instead of scrolling, so the loader never fires and the sheet records a
      // grey box where a photograph is. Seoul National's law library read as an empty panel next to
      // its own gallery. Switching them to eager before the shutter is what makes the sheet honest.
      for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
    });
  } catch { /* context replaced mid-navigation */ }
}

async function decodeAll(page) {
  try {
    // Raced against a deadline. `HTMLImageElement.decode()` has no timeout of its own, so a single
    // image that never finishes — a slow host, a redirect, a file the decoder dislikes — hangs the
    // whole sheet on one page with no output and no error. V21 added 42 photographs and that is
    // exactly what happened. A late image is worth losing; the run is not.
    await Promise.race([
      page.evaluate(() => Promise.all([...document.images]
        .map((i) => (i.complete ? null : i.decode().catch(() => null))))),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
  } catch { /* context replaced — the waitForTimeout below is the fallback */ }
}

const WIDTHS = flag('--widths', '390,768,1440,1728').split(',').map(Number);
const browser = await chromium.launch();

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/universities`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await settleReveals(page);
  await decodeAll(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/discovery-${width}.png`, fullPage: true });
  console.log(`  discovery-${width}`);
  await ctx.close();
}

for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/universities`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  const toggle = page.locator('.mk-dir__maptoggle').first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(1200);
    await settleReveals(page);
  await decodeAll(page);
    await page.screenshot({ path: `${OUT}/discovery-regions-open-${width}.png`, fullPage: true });
    console.log(`  discovery-regions-open-${width}`);
  } else {
    console.log(`  discovery-regions-open-${width}: no disclosure found — check the selector`);
  }
  await ctx.close();
}

for (const [group, slugs] of [['flagship', FLAGSHIP], ['smaller', smaller], ['nomedia', noMedia]]) {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
    const page = await ctx.newPage();
    for (const slug of slugs) {
      await page.goto(`${BASE}/universities/${slug}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await settleReveals(page);
  await decodeAll(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${group}-${slug}-${width}.png`, fullPage: true });
    }
    console.log(`  ${group} × ${slugs.length} @ ${width}`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\n  → docs/qa/v21/screenshots (${WIDTHS.length} discovery + ${(FLAGSHIP.length + smaller.length + noMedia.length) * 2} detail)`);
console.log(`  smaller institutions: ${smaller.join(', ')}`);
console.log(`  no licensed media:    ${noMedia.join(', ')}`);
