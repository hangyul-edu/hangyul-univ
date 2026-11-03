// Pricing tail with the notes disclosure OPEN: node _notes-open.mjs <width> <out> [lang]
import { chromium } from '@playwright/test';
const [w, out, lang = 'ko'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: +w < 600 ? 844 : 900 } })).newPage();
await p.goto(`http://127.0.0.1:3100/?lang=${lang}`, { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } });
await p.locator('#plan-notes summary').click(); await p.waitForTimeout(400);
const r = await p.locator('.kn-pricing__more').boundingBox(); const y = await p.evaluate(() => scrollY);
await p.screenshot({ path: out, fullPage: true, clip: { x: 0, y: y + r.y - 30, width: +w, height: r.height + 60 } });
await b.close();
