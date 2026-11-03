// Debug one page as a demo persona: console errors, failed requests, h1. node scripts/qa/_dbg.mjs <port> <email> <path> [w] [out]
import { chromium } from '@playwright/test';
const [port, email, path, w = '1024', out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--headless=new'] }); const p = await b.newPage({ viewport: { width: +w, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
await p.goto(`http://localhost:${port}/login?demo=${encodeURIComponent(email)}`);
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 });
await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
console.log('H1', await p.locator('h1').allTextContents());
if (out) await p.screenshot({ path: out });
await b.close();
