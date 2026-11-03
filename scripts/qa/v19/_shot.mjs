/**
 * V19 screenshot instrument. `node scripts/qa/v19/_shot.mjs <outDir> <tag> <url> [widths...] [--full]`
 *
 * Writes `<outDir>/<tag>@<width>.png`. Waits for network idle and the reveal animations to settle, so a
 * capture is of the page at rest rather than mid-entrance.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, tag, url, ...rest] = process.argv.slice(2);
const full = rest.includes('--full');
const widths = rest.filter((a) => !a.startsWith('--')).map(Number);
if (!outDir || !tag || !url || !widths.length) {
  console.error('usage: _shot.mjs <outDir> <tag> <url> <w...> [--full]');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: full ? 1200 : 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1800);
  const p = join(outDir, `${tag}@${w}.png`);
  await page.screenshot({ path: p, fullPage: full });
  console.log(`${p}${errs.length ? `  CONSOLE: ${errs.slice(0, 3).join(' | ').slice(0, 300)}` : ''}`);
  await ctx.close();
}
await browser.close();
