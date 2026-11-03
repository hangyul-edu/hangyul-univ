// Computed background/border of the console shell layers: node _surfaces.mjs <base> <email> <path>
import { chromium } from '@playwright/test';
const [base, email, path] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${base}/login?demo=${encodeURIComponent(email)}&lang=ko`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
await p.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 }); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const at = (x, y) => { let e = document.elementFromPoint(x, y); const chain = []; while (e && chain.length < 12) { const cs = getComputedStyle(e); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { chain.push(`${e.tagName}.${String(e.className).split(' ').slice(0, 2).join('.')} bg=${cs.backgroundColor}`); break; } e = e.parentElement; } return chain[0]; };
  return { body: getComputedStyle(document.body).backgroundColor, canvas: at(800, 880), sidebar: at(120, 600), topbar: at(1000, 30), table: at(800, 500) };
}), null, 1));
await b.close();
