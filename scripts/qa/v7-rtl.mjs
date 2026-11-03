// RTL check (Arabic): node scripts/qa/v7-rtl.mjs — marketing home/program + student home, overflow + dir report
import { chromium } from '@playwright/test';
const out = 'docs/qa/v7/rtl';
const b = await chromium.launch();
const shots = [['mk-home', 'http://localhost:3100/?lang=ar'], ['mk-program', 'http://localhost:3100/universities/kyung-hee-university?lang=ar']];
for (const [name, url] of shots) for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 800 } });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const m = await p.evaluate(() => ({ dir: document.documentElement.dir, ovf: document.documentElement.scrollWidth - innerWidth }));
  await p.screenshot({ path: `${out}/${name}-${w}.png` });
  console.log(name, w, m);
  await p.close();
}
await b.close();
