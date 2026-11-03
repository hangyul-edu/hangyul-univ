// V27 screenshot helper: node scripts/qa/v27/shot.mjs <url> <out.png> [width] [clickSelector]
import { chromium } from 'playwright';
const [url, out, width = '1280', click] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle' });
// sweep so reveal-on-scroll content is drawn (V14 trap: instant, not smooth)
const h = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 600) { await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y); await p.waitForTimeout(60); }
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
if (click) { await p.locator(click).first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1200); }
await p.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ errors }));
await b.close();
