// quick first-viewport captures of YNEX pages: node scripts/qa/_qy.mjs width page...
import { chromium } from '@playwright/test';
const [w, ...pages] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--headless=new'] });
for (const pg of pages) {
  const p = await b.newPage({ viewport: { width: +w, height: 900 } });
  await p.goto('http://localhost:4200/html/' + pg + '.html', { waitUntil: 'load' }).catch(() => {});
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `/tmp/claude-0/y-${pg}-${w}.jpg`, type: 'jpeg', quality: 70 });
  console.log(pg);
  await p.close();
}
await b.close();
