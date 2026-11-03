// V30 homepage performance probe (brief §52) — production build. node perf-home.mjs [base]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = process.argv[2] ?? 'http://127.0.0.1:4630';
const b = await chromium.launch(); const out = {};
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, deviceScaleFactor: mobile ? 3 : 1 });
    const p = await ctx.newPage(); let js = 0;
    p.on('response', async (r) => { if (r.url().endsWith('.js')) { try { js += (await r.body()).length; } catch {} } });
    await p.addInitScript(() => { window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await p.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
    await p.locator('.kn-crests').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    // Marquee smoothness: frame intervals over 2 s while the belt runs; long tasks.
    const frames = await p.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(); const end = last + 2000;
      const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); }));
    const m = await p.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4), dom: document.getElementsByTagName('*').length,
      crestLinks: document.querySelectorAll('.kn-crests a.kn-crest').length, onclickAttrs: document.querySelectorAll('.kn-crests [onclick]').length }));
    const sorted = [...frames].sort((a, c) => a - c);
    runs.push({ ...m, jsKB: Math.round(js / 1024), frameP50: +sorted[Math.floor(sorted.length / 2)].toFixed(1), frameP95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), framesOver50ms: frames.filter((x) => x > 50).length });
    await ctx.close();
  }
  out[name] = runs;
}
await b.close();
fs.writeFileSync('docs/qa/v30/perf-home.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), load: fs.readFileSync('/proc/loadavg', 'utf8').trim(), ...out }, null, 1));
console.log(JSON.stringify(out, null, 1));
