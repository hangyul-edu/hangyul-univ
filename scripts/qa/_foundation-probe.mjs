// node scripts/qa/_foundation-probe.mjs <app> <route> <width> <selector...>
import { chromium } from '@playwright/test';
const [app, route, width, ...sels] = process.argv.slice(2);
const BASE = { marketing: 4100, student: 4101, agency: 4102, university: 4103 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +width, height: 900 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem('hg.designPreview', 'paid'); } catch {} });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${BASE[app]}${route}${route.includes('?') ? '&' : '?'}lang=en`, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(600);
const out = await p.evaluate((sels) => sels.map((s) => {
  const el = document.querySelector(s); if (!el) return `${s}: —`;
  const c = getComputedStyle(el); const r = el.getBoundingClientRect();
  return `${s} <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 90)}"> ${Math.round(r.width)}x${Math.round(r.height)} | font ${c.fontSize}/${c.lineHeight} ${c.fontWeight} ls ${c.letterSpacing} ${c.fontFamily.slice(0, 28)} | color ${c.color} bg ${c.backgroundColor} | border ${c.borderTopWidth} ${c.borderTopColor} r ${c.borderRadius} | pad ${c.padding} | shadow ${c.boxShadow.slice(0, 60)}`;
}), sels);
console.log(out.join('\n'));
await b.close();
