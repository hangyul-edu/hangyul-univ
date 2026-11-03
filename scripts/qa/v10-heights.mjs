/**
 * Per-section height breakdown for a page, at one width. Total page height hides *which* section is long;
 * this prints each top-level <section> in screens, which is how the V10 mobile reductions were targeted.
 *
 *   node scripts/qa/v10-heights.mjs [url] [width] [height]
 */
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:3100/';
const w = Number(process.argv[3] || 390), h = Number(process.argv[4] || 844);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: w, height: h } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(() => new Promise(r => { let y=0; const t=setInterval(()=>{y+=600;scrollTo(0,y); if(y>document.body.scrollHeight){clearInterval(t);scrollTo(0,0);r()}},50)}));
await p.waitForTimeout(1200);
const rows = await p.evaluate((vh) => {
  const main = document.querySelector('main');
  const out = [];
  for (const el of main.querySelectorAll(':scope > div > section, :scope > section, :scope > div > div > section')) {
    const r = el.getBoundingClientRect();
    out.push({ id: el.id || el.className.split(' ').slice(0,2).join('.'), px: Math.round(r.height), screens: +(r.height / vh).toFixed(2) });
  }
  return { total: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(1), out };
}, h);
console.log(`${w}x${h}  total ${rows.total}px = ${rows.screens} screens`);
for (const r of rows.out) console.log(`  ${String(r.screens).padStart(5)}  ${String(r.px).padStart(6)}px  ${r.id}`);
await b.close();
