// Screenshot an app route as a demo persona (dev-only demo login). Usage: node scripts/qa/_demoshot.mjs <app-port> <email> <out-prefix> <widths> <path>
import { chromium } from '@playwright/test';
const [port, email, out, widths = '1440,390', path = '/'] = process.argv.slice(2);
const H = { 390: 844, 430: 932, 768: 1024, 1024: 768, 1280: 800, 1440: 900 };
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://localhost:${port}/login?demo=${encodeURIComponent(email)}`);
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
for (const w of widths.split(',').map(Number)) {
  await p.setViewportSize({ width: w, height: H[w] ?? 900 });
  await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}-${w}.png` });
  await p.screenshot({ path: `${out}-${w}-full.png`, fullPage: true });
}
await b.close();
