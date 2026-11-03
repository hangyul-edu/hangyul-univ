/** V21 — ad-hoc captures of a signed-in Student screen. Instrument, not a gate. */
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.env.W ?? 1440), height: 1000 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await p.goto('http://localhost:3101/login', { waitUntil: 'networkidle' });
await p.fill('#email', process.env.EMAIL ?? 'student@demo.hangyul.kr');
await p.fill('#password', 'Hangyul!2026');
await p.click('button[type=submit]');
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
for (const spec of process.argv.slice(2)) {
  const [path, name] = spec.split('|');
  await p.goto(`http://localhost:3101${path}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/tmp/claude-0/-root-hangyul-univ/6b3f8464-bc53-46e2-8bff-ec4c93a17486/scratchpad/v21/${name}.png`, fullPage: true });
  console.log('shot', name);
}
console.log('console errors:', errs.slice(0, 4));
await b.close();
