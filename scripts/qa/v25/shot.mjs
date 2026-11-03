// V25 — quick viewport shots for design iteration.
//   node scripts/qa/v25/shot.mjs <url> <width> <out.png> [selector-to-scroll-to|full] [login-email]
import { chromium } from '@playwright/test';
const [url, w, out, target, login] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'ko-KR', viewport: { width: Number(w), height: Number(w) < 600 ? 844 : 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
if (login) {
  const u = new URL(url);
  await p.goto(`${u.origin}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' });
  await p.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
}
await p.goto(url, { waitUntil: 'networkidle' });
for (let y = 0; y < 14; y += 1) { await p.mouse.wheel(0, 700); await p.waitForTimeout(70); }
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await p.waitForTimeout(400);
if (target && target !== 'full' && target !== 'top') {
  await p.locator(target).first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' })).catch(() => {});
  await p.evaluate(() => window.scrollBy(0, -90));
  await p.waitForTimeout(1300);
}
await p.screenshot({ path: out, fullPage: target === 'full' });
if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 3));
await b.close();
