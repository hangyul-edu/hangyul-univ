/** V19 — LCP / CLS / INP-proxy and transferred bytes on the representative pages (REPORT §209). */
import { chromium } from '@playwright/test';
const PAGES = [
  ['marketing /', 'http://localhost:3100/?lang=ko', null],
  ['marketing /start', 'http://localhost:3100/start?lang=ko', null],
  ['marketing /universities', 'http://localhost:3100/universities?lang=ko', null],
  ['student /', 'http://localhost:3101/', 'login'],
  ['student /documents', 'http://localhost:3101/documents', 'login'],
];
const b = await chromium.launch();
console.log('page'.padEnd(26), 'LCP(ms)'.padStart(9), 'CLS'.padStart(7), 'TTFB'.padStart(7), 'DCL'.padStart(7), 'JS(KB)'.padStart(8), 'total(KB)'.padStart(10));
for (const [name, url, needsLogin] of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  if (needsLogin) {
    await p.goto('http://localhost:3101/login', { waitUntil: 'networkidle' });
    await p.fill('#email','student@demo.hangyul.kr'); await p.fill('#password','Hangyul!2026');
    await p.click('button[type=submit]'); await p.waitForURL(u=>!u.pathname.startsWith('/login'));
  }
  let js = 0, total = 0;
  p.on('response', async (r) => {
    try { const h = r.headers(); const len = Number(h['content-length'] ?? 0);
      total += len; if (/javascript/.test(h['content-type'] ?? '')) js += len; } catch {}
  });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(2500);
  const m = await p.evaluate(() => new Promise((res) => {
    let lcp = 0, cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      res({ lcp: Math.round(lcp), cls: +cls.toFixed(4), ttfb: Math.round(nav.responseStart ?? 0), dcl: Math.round(nav.domContentLoadedEventEnd ?? 0) });
    }, 900);
  }));
  console.log(name.padEnd(26), String(m.lcp).padStart(9), String(m.cls).padStart(7), String(m.ttfb).padStart(7), String(m.dcl).padStart(7), String(Math.round(js/1024)).padStart(8), String(Math.round(total/1024)).padStart(10));
  await ctx.close();
}
await b.close();
