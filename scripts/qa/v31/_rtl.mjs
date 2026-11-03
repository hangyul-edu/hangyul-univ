import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const loc of ['ar','ur']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`http://127.0.0.1:3100/?lang=${loc}`, { waitUntil: 'networkidle', timeout: 120000 });
  const r = await p.evaluate(() => ({ addons: [...document.querySelectorAll('.kn-addons__price')].map(e => e.innerText),
     plans: [...document.querySelectorAll('.kn-plans [class*=price]')].slice(0,6).map(e => e.innerText.replace(/\s+/g,' ')) }));
  console.log(loc, JSON.stringify(r));
  await p.locator('.kn-addons__grid').screenshot({ path: `docs/qa/v31/pricing/addons-${loc}-1440.png` });
  await p.locator('.kn-plans').screenshot({ path: `docs/qa/v31/pricing/plans-${loc}-1440.png` });
  await p.close();
}
await b.close();
