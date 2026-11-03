// node _widths.mjs <base> <email> <path> <width> <selector...> — box widths + scroll widths of each selector and its ancestors
import { chromium } from '@playwright/test';
const [base, email, path, w, ...sels] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 900 } })).newPage();
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate((sels) => sels.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const out = []; for (let x = e; x && out.length < 8; x = x.parentElement) { const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); out.push(`${x.tagName}.${String(x.className).split(' ')[0]} w=${Math.round(r.width)} sw=${x.scrollWidth} disp=${cs.display} ov=${cs.overflowX} minw=${cs.minWidth}`); } return [s, out]; }), sels), null, 1));
await b.close();
