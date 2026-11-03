import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--headless=new'] });
for (const pg of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:4100/' + pg + '.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 700) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(80); }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  await p.screenshot({ path: `/tmp/claude-0/q-${pg}.jpg`, type: 'jpeg', quality: 55, fullPage: true });
  console.log(pg, H);
  await p.close();
}
await b.close();
