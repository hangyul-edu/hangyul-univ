import { chromium } from '@playwright/test';
const [base, email, route, w] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 900 } });
await p.goto(base + '/login'); await p.fill('#email', email); await p.fill('#password', 'Hangyul!2026'); await p.click('button[type=submit]');
await p.waitForURL((u) => !u.pathname.startsWith('/login')); await p.goto(base + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
console.log(await p.evaluate(() => {
  const W = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && r.width > 0) { let a = el.parentElement, clipped = false; while (a) { const s = getComputedStyle(a); if (['auto','scroll','hidden','clip'].includes(s.overflowX)) { clipped = true; break; } a = a.parentElement; } if (!clipped) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)} w=${Math.round(r.width)}`); }
  }
  return out.slice(0, 8).join('\n');
}));
await b.close();
