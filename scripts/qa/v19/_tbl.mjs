import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:3103/login', { waitUntil: 'networkidle' });
await p.fill('#email','admissions@pusan.univ.demo.hangyul.kr'); await p.fill('#password','Hangyul!2026');
await p.click('button[type=submit]'); await p.waitForURL(u=>!u.pathname.startsWith('/login'));
for (const r of ['/retention','/graduation']) {
  await p.goto('http://localhost:3103'+r, { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
  console.log('\n==', r);
  console.log(await p.evaluate(() => [...document.querySelectorAll('table')].map(t => {
    const box = t.parentElement;
    const cs = getComputedStyle(box);
    return { tableW: t.scrollWidth, boxW: box.clientWidth, overflowX: cs.overflowX,
      boxClass: String(box.className).slice(0,60), tableClass: String(t.className).slice(0,50),
      cols: t.querySelectorAll('thead th').length };
  })));
}
await b.close();
