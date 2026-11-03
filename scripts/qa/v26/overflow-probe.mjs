// V26 — which elements stick out past the viewport (REPORT §348). node scripts/qa/v26/overflow-probe.mjs <url> [width]
import { chromium } from '@playwright/test';
const [url, w = '390'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: Number(w), height: 844 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })).newPage();
await p.goto(url, { waitUntil: 'networkidle' });
console.log(await p.evaluate(() => {
  const W = document.documentElement.clientWidth; const out = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0) {
    let clipped = false; for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') { clipped = true; break; } }
    if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)}`); } }
  return { scroll: document.documentElement.scrollWidth - W, offenders: out.slice(0, 8) };
}));
await b.close();
