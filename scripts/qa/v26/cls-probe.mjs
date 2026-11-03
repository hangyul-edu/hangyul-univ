// V26 — which elements cause layout shift on a route (REPORT §348). node scripts/qa/v26/cls-probe.mjs <url> [width] [demo-login-email]
import { chromium } from '@playwright/test';
const [url, w = '1440', login] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: Number(w), height: 900 } });
await ctx.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: Math.round(e.startTime),
    src: (e.sources ?? []).map((s) => { const n = s.node; return n ? `${n.nodeName.toLowerCase()}.${(n.className && typeof n.className === 'string' ? n.className : '').split(' ').slice(0, 2).join('.')} ${JSON.stringify(s.previousRect?.y)}→${JSON.stringify(s.currentRect?.y)} h${Math.round(s.previousRect?.height)}→${Math.round(s.currentRect?.height)}` : '?'; }) }); }).observe({ type: 'layout-shift', buffered: true });
});
const p = await ctx.newPage();
if (login) { const u = new URL(url); await p.goto(`${u.origin}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((x) => !x.pathname.startsWith('/login')); await p.evaluate(() => { window.__shifts = []; }); }
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
const s = await p.evaluate(() => window.__shifts);
console.log('CLS', s.reduce((a, x) => a + x.v, 0).toFixed(3)); for (const x of s) console.log(x.v.toFixed(3), x.t, x.src.join(' | '));
await b.close();
