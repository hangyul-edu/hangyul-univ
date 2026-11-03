/**
 * V10 reference shooter — captures any URL at the five V10 review widths.
 *
 *   node scripts/qa/v10-shots.mjs <url> <outDir> <name> [--locale ko-KR] [--no-full]
 *
 * Used for the Koreanasha original (local + live), the V-Education benchmark and
 * any single page that needs a quick before/after look. Route-set captures of our
 * own apps go through scripts/qa/v10-capture.mjs instead.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const VIEWPORTS = [
  ['1440x900', 1440, 900],
  ['1024x768', 1024, 768],
  ['768x1024', 768, 1024],
  ['430x932', 430, 932],
  ['390x844', 390, 844],
];

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const localeIdx = args.indexOf('--locale');
const locale = localeIdx > -1 ? args[localeIdx + 1] : 'ko-KR';
const [url, outDir, name = 'page'] = positional.filter((a) => a !== locale);

if (!url || !outDir) {
  console.error('usage: node scripts/qa/v10-shots.mjs <url> <outDir> <name> [--locale ko-KR] [--no-full]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

/** Scroll the whole page once so lazy images and scroll-reveal animations have run before the shot. */
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    let y = 0;
    const step = setInterval(() => {
      y += window.innerHeight;
      window.scrollTo(0, y);
      if (y > document.body.scrollHeight) { clearInterval(step); window.scrollTo(0, 0); resolve(); }
    }, 120);
  }));
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
for (const [label, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  } catch {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }); } catch { /* reported below */ }
  }
  await page.waitForTimeout(2000);
  await settle(page);
  await page.screenshot({ path: `${outDir}/${name}-${label}.png` });
  if (!flags.has('--no-full')) await page.screenshot({ path: `${outDir}/${name}-${label}-full.png`, fullPage: true });
  const m = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    title: document.title,
  }));
  console.log(`${name} ${label}  ${m.h}px (${(m.h / height).toFixed(1)} screens)  overflow=${m.overflow}  errors=${errors.length}  "${m.title}"`);
  await ctx.close();
}
await browser.close();
