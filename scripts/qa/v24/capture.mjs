// V24 — before/after screenshot capture of the key screens of all four products.
//   node scripts/qa/v24/capture.mjs <before|after> [marketing,student,agency,university] [widths]
// Full-page captures after scrolling (scroll-revealed sections render), signed in via the dev ?demo= path.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const [phase = 'before', appsArg = 'marketing,student,agency,university', widthsArg = '390,768,1440'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'docs/qa/v24/visual', phase);
const SPEC = {
  marketing: { base: 'http://localhost:3100', login: null, routes: ['/', '/start', '/universities', '/universities/yonsei-university', '/universities/inst-2640', '/terms'] },
  public: { base: 'http://localhost:3101', login: null, routes: ['/login', '/register'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', routes: ['/', '/explore', '/universities/pusan-national-university', '/services', '/applications', '/documents', '/essays', '/messages', '/settings'] },
  studentVisa: { base: 'http://localhost:3101', login: 'student.visa@demo.hangyul.kr', routes: ['/visa'] },
  agency: { base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr', routes: ['/', '/students', '/students/eeddf03a-f61c-4efc-9af1-501b63e546c7', '/review', '/messages', '/performance'], dense: true },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/messages', '/analytics', '/manage'], dense: true },
};
const want = appsArg.split(',');
const groups = Object.entries(SPEC).filter(([k]) => want.includes(k) || (k === 'public' && want.includes('student')) || (k === 'studentVisa' && want.includes('student')));
const browser = await chromium.launch();
for (const [name, s] of groups) {
  const ctx = await browser.newContext({ locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
  const p = await ctx.newPage();
  if (s.login) {
    await p.goto(`${s.base}/login?demo=${encodeURIComponent(s.login)}&lang=ko`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  }
  const widths = [...widthsArg.split(',').map(Number), ...(s.dense && widthsArg.includes('1440') ? [1728] : [])];
  for (const r of s.routes) {
    for (const w of widths) {
      await p.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
      await p.goto(`${s.base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      for (let y = 0; y < 14; y += 1) { await p.mouse.wheel(0, 700); await p.waitForTimeout(90); }
      await p.waitForTimeout(700);
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
      const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
      await p.screenshot({ path: path.join(dir, `${r.replace(/[/:?=&]/g, '_') || '_home'}-${w}.png`), fullPage: true });
    }
    process.stdout.write('.');
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${phase} captured → ${path.relative(ROOT, OUT)}`);
