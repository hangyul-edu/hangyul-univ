// Prints visible elements that stick out of the viewport (text, rect, clipping ancestor). Usage: node scripts/qa/_offender.mjs <url> [width]
import { chromium } from '@playwright/test';
const [url, w = '390'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 844 } });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
console.log(await p.evaluate(() => [...document.body.querySelectorAll('a')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); })
  .map((el) => ({ text: el.innerText.slice(0, 60), rect: el.getBoundingClientRect().toJSON(), cls: el.className, html: getComputedStyle(document.documentElement).overflowX, body: getComputedStyle(document.body).overflowX, parent: el.parentElement.className }))));
await b.close();
