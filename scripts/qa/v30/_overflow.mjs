// Finds the elements that push a page wider than the viewport. node _overflow.mjs <base> <email|-> <path> <width>
import { chromium } from '@playwright/test';
const [base, email, path, w] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 844 } })).newPage();
if (email !== '-') { await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {}); }
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForTimeout(800);
await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 80)); } });
console.log(JSON.stringify(await p.evaluate(() => {
  const W = innerWidth; const out = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0) { const par = el.parentElement.getBoundingClientRect(); if (par.right <= W + 1 || el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).position === 'absolute' || getComputedStyle(el).position === 'fixed') out.push({ el: el.tagName + '.' + String(el.className).slice(0, 60), right: Math.round(r.right), w: Math.round(r.width), top: Math.round(r.top + scrollY), text: (el.innerText || '').slice(0, 60), pos: getComputedStyle(el).position, sw: el.scrollWidth }); } }
  return { docW: document.documentElement.scrollWidth, out: out.slice(0, 12) };
}), null, 1));
await b.close();
