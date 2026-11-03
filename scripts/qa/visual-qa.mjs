// Visual QA: node scripts/qa/visual-qa.mjs [app] [widths]
// Logs in, visits routes at several widths, saves screenshots to qa-screenshots/, reports console errors & horizontal overflow.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const APPS = {
  // V11: six public routes (REPORT §75.1). Removed paths redirect and are asserted in e2e/v11-marketing.spec.ts.
  // V12: the directory replaces the programme search; a region selection and a directory-only university
  // (no application catalogue behind it) are both normal states and both get swept.
  // V14: `/credits` is retired (brief Part 3) and redirects, so it is no longer a route to sweep. Two
  // university pages are swept deliberately: one with a licensed photograph (the immersive header and the
  // gallery) and one without (the typographic header) — they are different compositions.
  marketing: { base: process.env.MARKETING ?? 'http://localhost:3100', routes: ['/', '/universities', '/universities?region=seoul', '/universities?region=jeju',
    '/universities/seoul-national-university', '/universities/pusan-national-university', '/universities/kyungsung-university',
    '/privacy', '/terms', '/nope'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', routes: ['/', '/explore', '/matches', '/universities/yonsei-university', '/saved', '/applications', '/documents', '/essays', '/tasks', '/messages', '/visa', '/housing', '/arrival', '/scholarships', '/services', '/profile', '/settings', '/support', '/more', '/onboarding', '/notifications', '/budget', '/compare', '/help'] },
  agency: { base: 'http://localhost:3102', login: 'manager@lotus.demo.hangyul.kr', routes: ['/', '/students', '/review', '/review?mode=writing', '/manage', '/pipeline', '/tasks', '/applications', '/consultations', '/messages', '/deadlines', '/universities', '/payments', '/performance', '/team', '/templates', '/audit', '/settings', '/students?view=attention', '/services', '/vendors', '/essays/insights', '/essays?view=overdue', '/submissions', '/hq', '/hq/manage', '/hq/sources'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/applicants', '/funnel', '/pipeline', '/programs', '/rules', '/documents', '/offers', '/scholarships', '/agencies', '/cohorts', '/lifecycle', '/analytics', '/messages', '/exports', '/partnership', '/settings', '/students', '/manage'] },
};
const only = process.argv[2];
const widths = (process.argv[3] ?? '390,768,1440').split(',').map(Number);
const out = 'qa-screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const report = [];
for (const [name, app] of Object.entries(APPS)) {
  if (only && only !== 'all' && only !== name) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  if (app.login) {
    await page.goto(`${app.base}/login`);
    await page.fill('#email', app.login);
    await page.fill('#password', 'Hangyul!2026');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => errors.push('login did not redirect'));
  }
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 });
    for (const r of app.routes) {
      errors.length = 0;
      await page.goto(`${app.base}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelectorAll('h1').length,
        text: document.body.innerText.slice(0, 20000),
      }));
      const rawKeys = (m.text.match(/\b[a-z]+(?:\.[a-zA-Z_]+){2,}\b/g) || []).filter((k) => !k.includes('hangyul.kr') && !/\.(com|kr|go|ac|org|net)\b/.test(k)).slice(0, 5);
      const file = `${out}/${name}${r.replace(/[/:]/g, '_') || '_root'}-${w}.png`;
      await page.screenshot({ path: file, fullPage: false });
      const issues = [];
      if (m.overflow > 1) issues.push(`overflow ${m.overflow}px`);
      if (m.h1 !== 1) issues.push(`h1=${m.h1}`);
      if (rawKeys.length) issues.push(`raw keys? ${rawKeys.join(' ')}`);
      if (/undefined|NaN|\{\{/.test(m.text)) issues.push('undefined/NaN/{{ in text');
      const errs = errors.filter((e) => !/favicon|DevTools/.test(e));
      if (errs.length) issues.push(`console: ${errs.slice(0, 2).join(' | ')}`);
      report.push({ app: name, route: r, width: w, issues });
      if (issues.length) console.log(`✖ ${name} ${r} @${w}: ${issues.join('; ')}`);
    }
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`checked ${report.length} views, ${report.filter((r) => r.issues.length).length} with issues`);
