import { chromium } from '@playwright/test';
const b = await chromium.launch();
const SPEC = [
  ['student', 'http://localhost:3101', 'student@demo.hangyul.kr', ['/', '/applications', '/documents']],
  ['agency', 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr', ['/', '/students', '/performance']],
  ['university', 'http://localhost:3103', 'admin@pusan.univ.demo.hangyul.kr', ['/', '/analytics']],
  ['marketing', 'http://localhost:3100', null, ['/', '/universities/yonsei-university']],
];
for (const [app, base, login, routes] of SPEC) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  if (login) { await p.goto(`${base}/login?demo=${encodeURIComponent(login)}&lang=ko`, { waitUntil: 'networkidle' }); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}); }
  for (const r of routes) {
    await p.goto(base + r + '?lang=ko', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const o = await p.evaluate(() => ['h1', 'h2', 'h3'].map((h) => {
      const s = [...document.querySelectorAll(h)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const c = getComputedStyle(e); return `${c.fontSize}/${c.fontWeight}`; });
      return `${h}: ${[...new Set([...document.querySelectorAll(h)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.className + '=' + getComputedStyle(e).fontSize))].join(' ')}`;
    }).join(' | '));
    console.log(app, r, o);
  }
  await ctx.close();
}
await b.close();
