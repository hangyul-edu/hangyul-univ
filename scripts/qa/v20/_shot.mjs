/**
 * V20 instrument — ad-hoc full-page captures. `capture.mjs` is the sheet; this is for looking at one
 * thing. Waits for every image to decode first, because a full-page capture releases the lazy ones all
 * at once and records grey boxes otherwise.
 *
 *   node scripts/qa/v20/_shot.mjs <out-dir> "<url>|<width>|<name>" …
 */
import { chromium } from '@playwright/test';
const [out, ...urls] = process.argv.slice(2);
const b = await chromium.launch();
for (const spec of urls) {
  const [url, w, name] = spec.split('|');
  const p = await b.newPage({ viewport: { width: Number(w), height: 1000 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await p.close();
  console.log('shot', name);
}
await b.close();
