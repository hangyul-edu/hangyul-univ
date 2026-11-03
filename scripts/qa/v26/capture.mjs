// V26 — before/after screenshot capture of the key screens of all four products.
//   node scripts/qa/v25/capture.mjs <before|after> [groups] [widths]
//   groups: comma list of marketing,public,student,agency,university (default all)
//   widths: default 390,430,768,1024,1440 (+1728 for dense consoles)
// Full-page captures after a scroll sweep (scroll-revealed sections render), signed in via the dev ?demo= path.
// One Chromium, sequential — this machine has 5 GB of RAM.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const [phase = 'before', appsArg = 'marketing,public,student,agency,university', widthsArg = '390,430,768,1024,1440'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'docs/qa/v26/visual', phase);
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa/v26/ids.json'), 'utf8'));
const SPEC = {
  marketing: {
    base: 'http://localhost:3100', login: null,
    routes: ['/', '/start', '/universities', '/universities/yonsei-university', '/universities/kaya-university',
      '/universities/inst-2640', '/universities/seoul-national-university'],
  },
  public: { base: 'http://localhost:3101', login: null, routes: ['/login', '/register'] },
  student: {
    base: 'http://localhost:3101', login: 'student@demo.hangyul.kr',
    routes: ['/', '/explore', '/universities/pusan-national-university', '/services', '/applications',
      `/applications/${IDS.studentApplication}`, '/documents', '/essays', `/essays/${IDS.studentEssay}`, '/messages', '/more', '/notifications', '/tasks', '/saved', '/compare', '/visa'],
  },
  agency: {
    base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr', dense: true,
    routes: ['/', '/students', `/students/${IDS.agencyStudent}`, '/review', '/messages', '/performance', '/settings'],
  },
  university: {
    base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', dense: true,
    routes: ['/', `/applications/${IDS.universityApplication}`, '/analytics', '/cohorts', '/agencies', '/messages', '/settings'],
  },
};
const want = appsArg.split(',');
const only = process.env.ROUTE ? new RegExp(process.env.ROUTE) : null;
const browser = await chromium.launch();
for (const [name, s] of Object.entries(SPEC).filter(([k]) => want.includes(k))) {
  const ctx = await browser.newContext({ locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* */ } });
  const p = await ctx.newPage();
  if (s.login) {
    await p.goto(`${s.base}/login?demo=${encodeURIComponent(s.login)}&lang=ko`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {});
  }
  const widths = [...widthsArg.split(',').map(Number), ...(s.dense && widthsArg.includes('1440') ? [1728] : [])];
  for (const r of s.routes) {
    if (only && !only.test(r)) continue;
    for (const w of widths) {
      { const slug0 = r.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, 'id').replace(/[/:?=&]/g, '_') || '_home';
        if (fs.existsSync(path.join(OUT, name, `${slug0}-${w}.png`)) && !process.env.RESHOOT) continue; }
      await p.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
      await p.goto(`${s.base}${r}${r.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'networkidle' }).catch(() => {});
      for (let y = 0; y < 16; y += 1) { await p.mouse.wheel(0, 700); await p.waitForTimeout(80); }
      await p.waitForTimeout(600);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(300);
      const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
      const slug = r.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, 'id').replace(/[/:?=&]/g, '_') || '_home';
      const file = path.join(dir, `${slug}-${w}.png`);
      // Resumable (V26: this VM restarts under memory pressure): a shot that exists is kept unless RESHOOT=1.
      if (fs.existsSync(file) && !process.env.RESHOOT) continue;
      await p.screenshot({ path: file, fullPage: true });
    }
    process.stdout.write('.');
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${phase} captured → ${path.relative(ROOT, OUT)}`);
