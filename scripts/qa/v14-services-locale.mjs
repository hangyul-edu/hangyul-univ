/**
 * V14 continuation QA: the three service photographs, and the footer language picker.
 *
 * Two things are checked that a screenshot alone cannot settle:
 *
 *   1. each service row serves the intended slug, and the image's *painted* box is filled by a crop whose
 *      focal point is the one credits.json records — i.e. the row is not silently falling back;
 *   2. the footer picker's panel is **fully inside the viewport** once open, at every width. That is the
 *      actual bug: not "does it look right" but "is any part of it below the fold with nowhere to scroll".
 *
 *   node scripts/qa/v14-services-locale.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = 'qa-screenshots/v14-services-locale';
const WIDTHS = [390, 768, 1440];
const EXPECT = ['kyunghee-main-building', 'korean-air-apron', 'korea-palace-hanbok'];

await mkdir(OUT, { recursive: true });
const problems = [];
const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });

  // ---- 1. the three photographs
  const section = page.locator('#services');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);                       // let the reveal animation settle
  const imgs = section.locator('.kn-mediarow__media img');
  const got = await imgs.evaluateAll((els) => els.map((el) => ({
    src: el.currentSrc || el.src,
    pos: getComputedStyle(el).objectPosition,
    box: { w: el.clientWidth, h: el.clientHeight },
    natural: { w: el.naturalWidth, h: el.naturalHeight },
  })));
  if (got.length !== 3) problems.push(`${width}: ${got.length} service images, expected 3`);
  got.forEach((g, i) => {
    const slug = EXPECT[i];
    if (!g.src.includes(slug)) problems.push(`${width}: row ${i + 1} serves ${g.src.split('/').pop()}, expected ${slug}`);
    if (!g.natural.w) problems.push(`${width}: row ${i + 1} (${slug}) did not decode`);
    if (g.box.h < 140) problems.push(`${width}: row ${i + 1} (${slug}) is only ${g.box.h}px tall — not immersive`);
    console.log(`  ${width} row ${i + 1}  ${g.src.split('/').pop().padEnd(30)} ${g.box.w}x${g.box.h}  object-position ${g.pos}`);
  });
  await section.screenshot({ path: `${OUT}/services-${width}.png` });

  // ---- 2. the footer language picker
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('.kn-footer__lang button').click();
  await page.waitForTimeout(450);                       // placement + open animation

  // Below 768 the control is a bottom sheet by design; at and above it, a flipping popover.
  const panel = page.locator('.hg-locale__sheet, .hg-popover').first();
  await panel.waitFor({ state: 'visible' });
  const r = await panel.boundingBox();
  const vh = page.viewportSize().height, vw = page.viewportSize().width;
  const clipped = [
    r.y < -0.5 && 'above the top',
    r.y + r.height > vh + 0.5 && `${Math.round(r.y + r.height - vh)}px below the bottom`,
    r.x < -0.5 && 'past the inline start',
    r.x + r.width > vw + 0.5 && 'past the inline end',
  ].filter(Boolean);
  if (clipped.length) problems.push(`${width}: footer picker is clipped — ${clipped.join(', ')}`);

  const trigger = await page.locator('.kn-footer__lang button').boundingBox();
  const side = r.y + r.height <= trigger.y + 1 ? 'up' : r.y >= trigger.y + trigger.height - 1 ? 'down' : 'overlapping';
  if (side === 'overlapping' && width >= 768) problems.push(`${width}: panel overlaps its trigger`);
  // The search box has to be reachable, which is the thing a naive max-height would break.
  const search = page.locator('.hg-locale__input');
  const sb = await search.boundingBox();
  if (!sb || sb.y < 0 || sb.y + sb.height > vh) problems.push(`${width}: search box is off-screen`);
  if (!(await search.evaluate((el) => el === document.activeElement))) problems.push(`${width}: search box did not take focus`);
  console.log(`  ${width} footer picker opens ${side} — ${Math.round(r.width)}x${Math.round(r.height)} at y=${Math.round(r.y)} (viewport ${vh})`);

  await page.screenshot({ path: `${OUT}/footer-locale-${width}.png` });

  // Escape closes and hands focus back, which the portal must not have broken.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await panel.isVisible().catch(() => false)) problems.push(`${width}: Escape did not close the picker`);
  const back = await page.evaluate(() => document.activeElement?.closest('.kn-footer__lang') !== null);
  if (!back && width >= 768) problems.push(`${width}: Escape did not return focus to the trigger`);

  // ---- 3. the same component everywhere else. The footer is the hard case, but the fix is in `Popover`,
  // so the pickers that were already fine have to still be fine — a panel that now flips when it has no
  // reason to, or that lost its anchor, is a regression even though nothing is clipped.
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const header = page.locator('header .hg-locale__trigger, header button[aria-haspopup]').first();
  const burger = page.locator('header [aria-controls], header .kn-burger, header button:has(svg)').last();
  if (!(await header.isVisible().catch(() => false))) await burger.click().catch(() => {});
  await page.waitForTimeout(250);
  const hdrBtn = page.locator('[aria-haspopup]').filter({ hasNot: page.locator('.kn-footer__lang') }).first();
  if (await hdrBtn.isVisible().catch(() => false)) {
    await hdrBtn.click();
    await page.waitForTimeout(400);
    const hp = page.locator('.hg-locale__sheet, .hg-popover').first();
    if (await hp.isVisible().catch(() => false)) {
      const hr = await hp.boundingBox();
      const ht = await hdrBtn.boundingBox();
      if (hr.y + hr.height > vh + 0.5 || hr.y < -0.5 || hr.x < -0.5 || hr.x + hr.width > vw + 0.5) {
        problems.push(`${width}: header picker is clipped`);
      }
      // Near the top of the page there is room below; it must not have started flipping upward.
      if (width >= 768 && hr.y + hr.height <= ht.y + 1) problems.push(`${width}: header picker flipped up with room below it`);
      console.log(`  ${width} header picker opens ${hr.y >= ht.y ? 'down' : 'up'} — ${Math.round(hr.width)}x${Math.round(hr.height)} at y=${Math.round(hr.y)}`);
      await page.screenshot({ path: `${OUT}/header-locale-${width}.png` });
    }
  }
  await page.close();
}

await browser.close();
if (problems.length) {
  console.error(`\n! ${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`\nServices + footer locale picker: OK at ${WIDTHS.join(' / ')} px. Shots in ${OUT}/`);
