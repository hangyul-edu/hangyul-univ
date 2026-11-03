/** V19 — measure the left/right edges of the Student Home composition, to find the mismatched axes. */
import { chromium } from '@playwright/test';
const W = Number(process.argv[2] || 1440);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: W, height: 900 } })).newPage();
await p.goto('http://localhost:3101/login', { waitUntil: 'networkidle' });
await p.fill('#email', 'student@demo.hangyul.kr'); await p.fill('#password', 'Hangyul!2026');
await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/login'));
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => {
  const sel = ['.sh-home .hg-band, .st7-home .sh-head, .sh-home > :first-child', '.st7-journey', '.st7-tiles', '.st7-phase-text', '.sh-grid', '.sh-main', '.sh-next'];
  return sel.map(s => {
    const el = document.querySelector(s);
    if (!el) return `${s.padEnd(34)} (absent)`;
    const r = el.getBoundingClientRect();
    return `${s.padEnd(34)} left=${Math.round(r.left)}  right=${Math.round(innerWidth - r.right)}  w=${Math.round(r.width)}`;
  }).join('\n');
}));
console.log('\n--- tiles overflow ---');
console.log(await p.evaluate(() => {
  const ol = document.querySelector('.st7-tiles');
  return ol ? `scrollWidth=${ol.scrollWidth} clientWidth=${ol.clientWidth} overflow=${ol.scrollWidth - ol.clientWidth}` : 'none';
}));
await b.close();
