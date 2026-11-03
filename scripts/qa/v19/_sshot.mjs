import { chromium } from '@playwright/test';
const [tag, path, ...ws] = process.argv.slice(2);
const b = await chromium.launch();
for (const w of ws.map(Number)) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3101/login', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.setItem('hg.locale','ko'); } catch {} });
  await p.fill('#email','student@demo.hangyul.kr'); await p.fill('#password','Hangyul!2026');
  await p.click('button[type=submit]'); await p.waitForURL(u => !u.pathname.startsWith('/login'));
  await p.goto('http://localhost:3101' + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);
  const f = `docs/qa/v19/screenshots/student/${tag}@${w}.png`;
  await p.screenshot({ path: f });
  console.log(f);
  await ctx.close();
}
await b.close();
