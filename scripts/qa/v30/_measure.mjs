// node _measure.mjs <base> <email|-> <path> <width> <selector>  — box + children geometry of the first match
import { chromium } from '@playwright/test';
const [base, email, path, w, sel] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 844 } })).newPage();
if (email !== '-') { await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {}); }
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate((s) => { const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  return { box: [r.x, r.y, r.width, r.height].map(Math.round), display: cs.display, align: cs.alignItems, pad: cs.padding, lh: cs.lineHeight,
    kids: [...el.querySelectorAll('*')].map((k) => { const q = k.getBoundingClientRect(); return [k.tagName, k.className?.baseVal ?? k.className, [q.x, q.y, q.width, q.height].map(Math.round), getComputedStyle(k).display]; }) }; }, sel)));
await b.close();
