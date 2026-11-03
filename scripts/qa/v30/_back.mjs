// Back-navigation scroll repro: node _back.mjs <base> <query> <scrollTo>
import { chromium } from '@playwright/test';
const [base, q, y] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto(`${base}/universities?${q}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
await p.evaluate((t) => scrollTo({ top: +t, behavior: 'instant' }), y); await p.waitForTimeout(800);
const before = await p.evaluate(() => [scrollY, document.documentElement.scrollHeight, getComputedStyle(document.documentElement).scrollBehavior]);
const link = p.locator('.mk-dir__body a[href*="/universities/"]').filter({ visible: true });
// the first card fully in view
const n = await link.count(); let i = 0; for (; i < n; i++) { const bb = await link.nth(i).boundingBox(); if (bb && bb.y > 80 && bb.y + bb.height < 880) break; }
await link.nth(i).click(); await p.waitForURL((u) => u.pathname !== '/universities'); await p.waitForLoadState('networkidle');
await p.goBack(); await p.waitForURL((u) => u.pathname === '/universities');
const trace = []; for (let k = 0; k < 12; k++) { trace.push(await p.evaluate(() => [Math.round(scrollY), document.documentElement.scrollHeight])); await p.waitForTimeout(250); }
console.log(JSON.stringify({ before, card: i, trace }));
await b.close();
