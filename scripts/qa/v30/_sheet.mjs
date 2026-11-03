import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const w of [320, 390]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 760 } })).newPage();
  await p.goto('http://localhost:3100/universities?lang=ko', { waitUntil: 'networkidle' });
  await p.click('.mk-dir__filterbtn'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${process.argv[2]}/sheet-${w}.png` });
}
await b.close();
