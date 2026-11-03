// Anonymous screenshot: node scripts/qa/_shot.mjs <url> <out-prefix> <widths> [--full]
import { chromium } from '@playwright/test';
const [url, out, widths = '1440,390', full] = process.argv.slice(2);
const H = { 320: 640, 360: 740, 390: 844, 430: 932, 768: 1024, 820: 1180, 1024: 768, 1280: 800, 1440: 900, 1728: 1117 };
const b = await chromium.launch({ args: ['--headless=new'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
for (const w of widths.split(',').map(Number)) {
  await p.setViewportSize({ width: w, height: H[w] ?? 900 });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}-${w}.png`, fullPage: full === '--full' });
}
await b.close();
