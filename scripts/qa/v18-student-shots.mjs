import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const OUT = '/root/hangyul-univ/result/screenshots/student-web';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.split('\n')[0]));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });

await p.goto('http://localhost:3101/login?demo=' + encodeURIComponent('student@demo.hangyul.kr'), { waitUntil: 'domcontentloaded' });
try { await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }); console.log('signed in →', p.url()); }
catch { console.log('DEMO LOGIN FAILED, still at', p.url()); }

const pages = [['documents','/documents'],['applications','/applications'],['visa','/visa'],['services','/services'],['messages','/messages']];
for (const [w, h] of [[390, 844], [1440, 1000]]) {
  await p.setViewportSize({ width: w, height: h });
  for (const [name, path] of pages) {
    await p.goto('http://localhost:3101' + path, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(1100);
    await p.screenshot({ path: `${OUT}/${name}-${w}.png` });
    // measure the header band: is anything dark still opening the page?
    const probe = await p.evaluate(() => {
      const el = document.querySelector('.st-intro, .hg-page-head');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      const h1 = el.querySelector('h1');
      return { bg: cs.backgroundColor, height: Math.round(r.height), top: Math.round(r.top),
               afterContent: after.content, titleColor: h1 ? getComputedStyle(h1).color : null,
               firstContentTop: Math.round((document.querySelector('main *:not(.st-intro):not(.st-intro *)')?.getBoundingClientRect().top) || 0) };
    });
    console.log(`${name} @${w}`, JSON.stringify(probe));
  }
}
console.log('\nerrors:', errs.length ? errs.slice(0, 8) : 'none');
await b.close();
