import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
p.on('console', m => { if (m.text().startsWith('RS:')) console.log('  ', m.text()); });
await p.goto('http://localhost:3100/universities', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.evaluate(() => window.scrollTo(0, 1400));
await p.waitForTimeout(600);
console.log('directory scrollY =', await p.evaluate(() => Math.round(scrollY)), 'docH =', await p.evaluate(() => document.documentElement.scrollHeight));
await p.locator('a[href*="/universities/"]').first().click();
await p.waitForURL(/\/universities\/[^/]+/);
await p.waitForTimeout(900);
console.log('detail scrollY =', await p.evaluate(() => Math.round(scrollY)));
console.log('store after push =', await p.evaluate(() => sessionStorage.getItem('hg:route-scroll')));
await p.goBack();
for (const ms of [200, 600, 1200, 2500]) {
  await p.waitForTimeout(ms === 200 ? 200 : ms - 200);
  console.log(`  t=${ms}ms  scrollY=${await p.evaluate(() => Math.round(scrollY))}  docH=${await p.evaluate(() => document.documentElement.scrollHeight)}`);
}
console.log('store after back =', await p.evaluate(() => sessionStorage.getItem('hg:route-scroll')));
await b.close();
