// Does a locale with no v11.* strings fall back to English on the home page, or leak raw keys?
import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const lang of ['vi', 'ru', 'ar']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`http://localhost:3100/?lang=${lang}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const txt = await p.locator('body').innerText();
  const rawKeys = [...txt.matchAll(/\bv11\.[a-zA-Z0-9_.]+/g)].map((m) => m[0]);
  const h1 = await p.locator('h1').first().innerText().catch(() => '(none)');
  console.log(`${lang}: h1=${JSON.stringify(h1)} rawKeys=${rawKeys.length}${rawKeys.length ? ' → ' + rawKeys.slice(0, 4).join(', ') : ''}`);
  await p.close();
}
await b.close();
