// Accessibility audit with axe-core (WCAG 2.1 A/AA rules): node scripts/qa/a11y.mjs <path-to-axe.min.js> [app]
// Logs in per app, visits key routes at 1280 and 390, prints violations grouped by rule.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const AXE = readFileSync(process.argv[2], 'utf8');
const only = process.argv[3];
const APPS = {
  // V11: the public site is six routes (REPORT §75.1); the rest redirect and are covered by the e2e spec.
  // V12: the directory (all-of-Korea and a selected region) and a directory-only university detail.
  // V14: `/credits` is retired; a university with a licensed photograph is added, because its header and
  // gallery are markup the other two pages do not have.
  // V17: `/start` is the free quick check, and it is the one public page with a form on it.
  marketing: { base: process.env.MARKETING ?? 'http://localhost:3100', routes: ['/', '/start', '/universities', '/universities?region=busan',
    '/universities/seoul-national-university', '/universities/pusan-national-university', '/universities/kyungsung-university',
    '/privacy', '/terms'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', routes: ['/', '/explore', '/universities/pusan-national-university', '/compare', '/budget', '/applications', '/documents', '/visa', '/messages', '/profile', '/applications/5ff850ed-0482-4165-9414-80be3014872c', '/essays', '/housing', '/arrival', '/help', '/more', '/services'] },
  agency: { base: 'http://localhost:3102', login: 'manager@lotus.demo.hangyul.kr', routes: ['/', '/students', '/review', '/review?mode=writing', '/manage', '/tasks', '/messages', '/performance', '/students/fdccd6a4-55a4-4e37-967b-324e49b1d9f5', '/students/fdccd6a4-55a4-4e37-967b-324e49b1d9f5?tab=application', '/students/fdccd6a4-55a4-4e37-967b-324e49b1d9f5?tab=communication', '/students/fdccd6a4-55a4-4e37-967b-324e49b1d9f5?tab=more', '/services', '/vendors', '/essays', '/essays/2ec9d833-cc46-419b-9e49-476d1813273e', '/submissions', '/audit', '/notifications', '/applications', '/settings'] },
  hq: { base: 'http://localhost:3102', login: 'ops@demo.hangyul.kr', routes: ['/hq', '/hq/manage', '/hq/sources', '/hq/agencies', '/hq/readiness', '/hq/assignments'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/applicants', '/analytics', '/programs', '/students', '/applications/7239ce74-08a1-4450-be50-f8f07a56cd41', '/partnership', '/exports', '/messages', '/offers', '/cohorts', '/manage'] },
};
const browser = await chromium.launch();
const all = [];
for (const [name, app] of Object.entries(APPS)) {
  if (only && only !== 'all' && only !== name) continue;
  // V29: reducedMotion — audit settled colours, not a frame of a fade-in.
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage();
  if (app.login) {
    await page.goto(`${app.base}/login`); await page.fill('#email', app.login); await page.fill('#password', 'Hangyul!2026');
    await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  }
  for (const w of [1280, 390]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 800 });
    for (const r of app.routes) {
      await page.goto(app.base + r, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const out = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
        return out.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) , count: v.nodes.length }));
      });
      for (const v of res) all.push({ app: name, route: r, width: w, ...v });
    }
  }
}
await browser.close();
writeFileSync(process.argv[4] ?? '/tmp/a11y.json', JSON.stringify(all, null, 2));
const byRule = {};
for (const v of all) { (byRule[`${v.app} ${v.id} (${v.impact})`] ??= []).push(`${v.route}@${v.width} ×${v.count}`); }
for (const [k, v] of Object.entries(byRule)) console.log(`${k}: ${v.slice(0, 6).join(', ')}${v.length > 6 ? ` … +${v.length - 6}` : ''}`);
console.log(`${all.length} violation groups`);
// V29: a gate that prints violations and exits 0 is not a gate.
process.exit(all.length ? 1 : 0);
