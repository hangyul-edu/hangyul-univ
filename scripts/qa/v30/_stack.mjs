// node _stack.mjs <base> <email> <path> <w> <x> <y> — the element stack at a point, with z-index and stacking context
import { chromium } from '@playwright/test';
const [base, email, path, w, x, y] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: +w, height: 844 } })).newPage();
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(([x, y]) => document.elementsFromPoint(x, y).slice(0, 8).map((e) => { let z = e; const chain = []; for (; z && z !== document.body; z = z.parentElement) { const cs = getComputedStyle(z); if (cs.zIndex !== 'auto' || cs.position === 'fixed') chain.push(`${z.tagName}.${String(z.className).split(' ')[0]} z=${cs.zIndex} ${cs.position}`); } return `${e.tagName}.${String(e.className?.baseVal ?? e.className).slice(0, 40)}  <- ${chain.slice(0, 3).join(' | ')}`; }), [+x, +y]), null, 1));
await b.close();
