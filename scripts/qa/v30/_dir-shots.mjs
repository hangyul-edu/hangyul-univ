// /universities first-viewport capture + toolbar geometry (used for BEFORE and AFTER at identical viewports).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:3100';
const OUT = process.env.OUT ?? 'docs/qa/v30/before/directory';
fs.mkdirSync(OUT, { recursive: true });
const widths = (process.env.WIDTHS ?? '320,360,390,430,768,1024,1280,1440,1728').split(',').map(Number);
const locales = (process.env.LOCALES ?? 'ko').split(',');
const b = await chromium.launch();
const out = {};
for (const loc of locales) for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 768 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/universities?lang=${loc}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const q = (s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: (e.innerText || e.value || '').trim().slice(0, 40) }; };
    const sel = [...document.querySelectorAll('.mk-dir__bar select, .mk-dir__bar [data-control="select"]')].find((x) => x.getClientRects().length);
    let selText = null;
    if (sel && sel.tagName === 'SELECT') { const cs = getComputedStyle(sel); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; selText = { label: sel.selectedOptions[0]?.text, textW: Math.round(c.measureText(sel.selectedOptions[0]?.text ?? '').width), padL: cs.paddingLeft, padR: cs.paddingRight, bgPos: cs.backgroundPosition }; }
    const firstCard = q('.mk-dir__grid > *, .mk-dir__results li, [data-institution]');
    return { search: q('.mk-dir__find'), type: q('.mk-dir__bar select, .mk-dir__bar [data-control="select"]'), selText, map: q('.mk-dir__maptoggle'), filters: q('.mk-dir__filterbtn'),
      chips: [...document.querySelectorAll('.mk-dir__top .mk-dir__group')].filter((x) => x.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height), on: e.getAttribute('aria-pressed') }; }),
      firstResultTop: firstCard?.y ?? null, docW: document.documentElement.scrollWidth };
  });
  out[`${loc}@${w}`] = m;
  await p.screenshot({ path: `${OUT}/dir-${loc}-${w}.png` });
  await ctx.close();
}
fs.writeFileSync(`${OUT}/geometry.json`, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify({ search: v.search && [v.search.w, v.search.h], type: v.type && [v.type.w, v.type.h], sel: v.selText, map: v.map && [v.map.w, v.map.h], filt: v.filters && [v.filters.w, v.filters.h], chipsH: [...new Set(v.chips.map((c) => c.h))], first: v.firstResultTop, docW: v.docW }));
await b.close();
