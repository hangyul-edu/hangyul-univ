import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.goto('http://127.0.0.1:3101/login?demo=student%40demo.hangyul.kr&lang=ko', { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto('http://127.0.0.1:3101/scholarships?lang=ko', { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(1000);
const closed = await p.evaluate(() => document.documentElement.scrollWidth);
await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); await p.waitForTimeout(300);
const probe = await p.evaluate(() => { const ul = document.querySelector('.ssc-list'); const base = ul.scrollWidth; const res = [];
  for (const li of ul.children) { for (const el of [li, ...li.querySelectorAll('*')]) { const o = el.style.overflow; el.style.overflow = 'clip'; const sw = ul.scrollWidth; el.style.overflow = o; if (sw < base) { res.push(`${el.tagName}.${String(el.className).slice(0,40)} → ${sw} :: ${el.outerHTML.slice(0, 160)}`); break; } } if (res.length > 3) break; }
  const li = [...ul.children].find((l) => l.scrollWidth > l.clientWidth + 1); const ch = [...li.querySelectorAll('*')].map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}.${String(e.className).slice(0, 30)} L=${Math.round(r.left)} R=${Math.round(r.right)} sw=${e.scrollWidth} cw=${e.clientWidth} ws=${getComputedStyle(e).whiteSpace} txt=${(e.textContent || '').slice(0, 50)}`; }); return { base, liCols: getComputedStyle(li).gridTemplateColumns, ch: ch.slice(0, 14) }; });
console.log(JSON.stringify(probe, null, 1));
console.log(JSON.stringify({ closed, open: await p.evaluate(() => document.documentElement.scrollWidth), wide: await p.evaluate(() => [...document.querySelectorAll('.ssc-list *')].filter((e) => e.getBoundingClientRect().right > 375).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)} r=${Math.round(e.getBoundingClientRect().right)} ws=${getComputedStyle(e).whiteSpace} txt=${(e.innerText || '').slice(0, 60)}`).slice(0, 8)) }, null, 1));
await b.close();
