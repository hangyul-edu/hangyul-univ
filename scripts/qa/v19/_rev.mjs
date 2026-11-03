import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900}, reducedMotion:'no-preference' })).newPage();
await p.goto('http://localhost:3100/?lang=ko', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.kn-reveal').forEach((el, i) => {
    const cs = getComputedStyle(el);
    out.push({ i, cls: el.className.replace('kn-reveal',''), dr: el.getAttribute('data-reveal'),
      op: cs.opacity, tp: cs.transitionProperty.slice(0,40), td: cs.transitionDuration, tf: cs.transform.slice(0,30) });
  });
  return out.slice(0, 8);
}));
await b.close();
