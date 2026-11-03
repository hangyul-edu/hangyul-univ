// Inspect a console table's folding: node scripts/qa/_tbl.mjs <port> <email> <path> <width>
import { chromium } from '@playwright/test';
const [port, email, path, w = '1024'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--headless=new'] });
const p = await b.newPage({ viewport: { width: +w, height: 800 } });
await p.goto(`http://localhost:${port}/login?demo=${encodeURIComponent(email)}`);
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 });
await p.goto(`http://localhost:${port}${path}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 240 && el.querySelector('table')) {
      const t = el.querySelector('table');
      out.push({ cls: el.className, client: el.clientWidth, scroll: el.scrollWidth, tableW: t.getBoundingClientRect().width,
        cols: [...t.querySelectorAll('thead th')].map((th) => [th.textContent.trim().slice(0, 18), Math.round(th.getBoundingClientRect().width)]) });
    }
  }
  return out;
}), null, 1));
await b.close();
