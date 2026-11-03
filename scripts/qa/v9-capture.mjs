// V9 route-complete capture (from v8-capture): KEY routes at all 10 widths, the rest at 390/1024/1440 (consoles + 768): every router route, as the right persona, first viewport + full page, with metrics.
// Usage: OUT=docs/qa/v9/before node scripts/qa/v9-capture.mjs [app-filter] [name-filter]
// Writes <OUT>/<app>/<name>-<w>.png, <OUT>/<app>/full/<name>-<w>.png and <OUT>/metrics.json (merged).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v9/before';
const ALL10 = [320, 360, 390, 430, 768, 820, 1024, 1280, 1440, 1728];
const KEY = new Set(['marketing/home', 'student/home-lan', 'student/home-nepal', 'student/explore-new', 'agency/today', 'agency/students', 'university/overview', 'university/applicants', 'university/applicant']);
const FULL = new Set([390, 1024, 1440]);
const [appFilter, nameFilter] = process.argv.slice(2);
const ids = JSON.parse(fs.readFileSync(new URL('./v6-ids.json', import.meta.url)));
const ESSAY = '2ec9d833-cc46-419b-9e49-476d1813273e';
const H = { 320: 640, 360: 740, 390: 844, 430: 932, 768: 1024, 820: 1180, 1024: 768, 1280: 800, 1440: 900, 1728: 1117 };

const PHONE_DESK = [390, 1024, 1440];
const CONSOLE = [390, 768, 1024, 1440];
const APPS = {
  marketing: { base: 'http://localhost:3100', widths: PHONE_DESK, routes: [
    ['home', '/'], ['universities', '/universities'], ['program', `/universities/${ids.uniSlug}`], ['how', '/how-it-works'],
    ['services', '/students'], ['agencies', '/agencies'], ['uni-partners', '/universities-partners'], ['guides', '/guides'],
    ['guide', '/guides/cost-of-studying-in-korea'], ['country', '/guides/country/NP'], ['trust', '/trust'], ['credits', '/credits'],
    ['privacy', '/privacy'], ['terms', '/terms'], ['404', '/no-such-page'],
  ] },
  student: { base: 'http://localhost:3101', widths: PHONE_DESK, routes: [
    ['login', '/login', null], ['register', '/register', null], ['start', '/start', null],
    ['home-lan', '/', 'student@demo.hangyul.kr'], ['home-new', '/', 'student.new@demo.hangyul.kr'], ['home-offer', '/', 'student.offer@demo.hangyul.kr'],
    ['home-visa', '/', 'student.visa@demo.hangyul.kr'], ['home-arrived', '/', 'student.arrived@demo.hangyul.kr'],
    ['explore', '/explore', 'student@demo.hangyul.kr'], ['explore-all', '/explore?tab=all', 'student@demo.hangyul.kr'],
    ['explore-new', '/explore', 'student.new@demo.hangyul.kr'],
    ['university', `/universities/${ids.uniSlug}`, 'student@demo.hangyul.kr'], ['saved', '/saved', 'student@demo.hangyul.kr'],
    ['compare', '/compare', 'student@demo.hangyul.kr'], ['budget', '/budget', 'student@demo.hangyul.kr'],
    ['applications', '/applications', 'student@demo.hangyul.kr'], ['application', `/applications/${ids.lanApp}`, 'student@demo.hangyul.kr'],
    ['applications-offer', '/applications', 'student.offer@demo.hangyul.kr'], ['offer', `/applications/${ids.offerApp}`, 'student.offer@demo.hangyul.kr'],
    ['documents', '/documents', 'student@demo.hangyul.kr'], ['essays', '/essays', 'student@demo.hangyul.kr'],
    ['tasks', '/tasks', 'student@demo.hangyul.kr'], ['messages', '/messages', 'student@demo.hangyul.kr'],
    ['notifications', '/notifications', 'student@demo.hangyul.kr'], ['visa', '/visa', 'student.visa@demo.hangyul.kr'],
    ['visa-lan', '/visa', 'student@demo.hangyul.kr'], ['housing', '/housing', 'student.visa@demo.hangyul.kr'],
    ['arrival', '/arrival', 'student.arrived@demo.hangyul.kr'], ['help', '/help', 'student.arrived@demo.hangyul.kr'],
    ['scholarships', '/scholarships', 'student@demo.hangyul.kr'], ['services', '/services', 'student@demo.hangyul.kr'],
    ['support', '/support', 'student@demo.hangyul.kr'], ['profile', '/profile', 'student@demo.hangyul.kr'],
    ['settings', '/settings', 'student@demo.hangyul.kr'], ['more', '/more', 'student@demo.hangyul.kr'],
    ['family', '/family', 'student.myanmar@demo.hangyul.kr'], ['money', '/budget', 'student.myanmar@demo.hangyul.kr'],
    ['home-nepal', '/', 'student.nepal@demo.hangyul.kr'], ['documents-nepal', '/documents', 'student.nepal@demo.hangyul.kr'],
    ['applications-nepal', '/applications', 'student.nepal@demo.hangyul.kr'], ['visa-nepal', '/visa', 'student.nepal@demo.hangyul.kr'],
    ['home-myanmar', '/', 'student.myanmar@demo.hangyul.kr'], ['visa-myanmar', '/visa', 'student.myanmar@demo.hangyul.kr'],
    ['documents-dossier', '/documents', 'student.dossier@demo.hangyul.kr'], ['home-arrival', '/', 'student.arrival@demo.hangyul.kr'],
  ] },
  agency: { base: 'http://localhost:3102', widths: CONSOLE, routes: [
    ['login', '/login', null],
    ['today', '/', 'counselor@lotus.demo.hangyul.kr'], ['today-manager', '/', 'manager@lotus.demo.hangyul.kr'],
    ['students', '/students', 'counselor@lotus.demo.hangyul.kr'], ['workspace', `/students/${ids.agStudent}`, 'manager@lotus.demo.hangyul.kr'],
    ['pipeline', '/pipeline', 'manager@lotus.demo.hangyul.kr'], ['tasks', '/tasks', 'counselor@lotus.demo.hangyul.kr'],
    ['deadlines', '/deadlines', 'counselor@lotus.demo.hangyul.kr'], ['applications', '/applications', 'manager@lotus.demo.hangyul.kr'],
    ['submissions', '/submissions', 'manager@lotus.demo.hangyul.kr'], ['documents', '/documents', 'reviewer@lotus.demo.hangyul.kr'],
    ['essays', '/essays', 'manager@lotus.demo.hangyul.kr'], ['essay', `/essays/${ESSAY}`, 'manager@lotus.demo.hangyul.kr'],
    ['essay-insights', '/essays/insights', 'manager@lotus.demo.hangyul.kr'], ['messages', '/messages', 'counselor@lotus.demo.hangyul.kr'],
    ['consultations', '/consultations', 'counselor@lotus.demo.hangyul.kr'], ['services', '/services', 'manager@lotus.demo.hangyul.kr'],
    ['vendors', '/vendors', 'manager@lotus.demo.hangyul.kr'], ['universities', '/universities', 'counselor@lotus.demo.hangyul.kr'],
    ['university', `/universities/${ids.uniSlug}`, 'counselor@lotus.demo.hangyul.kr'], ['performance', '/performance', 'manager@lotus.demo.hangyul.kr'],
    ['team', '/team', 'manager@lotus.demo.hangyul.kr'], ['templates', '/templates', 'manager@lotus.demo.hangyul.kr'],
    ['payments', '/payments', 'manager@lotus.demo.hangyul.kr'], ['audit', '/audit', 'manager@lotus.demo.hangyul.kr'],
    ['notifications', '/notifications', 'counselor@lotus.demo.hangyul.kr'], ['settings', '/settings', 'manager@lotus.demo.hangyul.kr'],
    ['hq', '/hq', 'ops@demo.hangyul.kr'], ['hq-agencies', '/hq/agencies', 'ops@demo.hangyul.kr'],
    ['hq-assignments', '/hq/assignments', 'ops@demo.hangyul.kr'], ['hq-sources', '/hq/sources', 'ops@demo.hangyul.kr'],
    ['hq-readiness', '/hq/readiness', 'ops@demo.hangyul.kr'], ['essays-writer', '/essays', 'writing@demo.hangyul.kr'],
  ] },
  university: { base: 'http://localhost:3103', widths: CONSOLE, routes: [
    ['login', '/login', null],
    ['overview', '/', 'admissions@pusan.univ.demo.hangyul.kr'], ['applicants', '/applicants', 'admissions@pusan.univ.demo.hangyul.kr'],
    ['applicant', `/applications/${ids.uniApp}`, 'admissions@pusan.univ.demo.hangyul.kr'], ['pipeline', '/pipeline', 'admissions@pusan.univ.demo.hangyul.kr'],
    ['offers', '/offers', 'admissions@pusan.univ.demo.hangyul.kr'], ['documents', '/documents', 'admissions@pusan.univ.demo.hangyul.kr'],
    ['messages', '/messages', 'admissions@pusan.univ.demo.hangyul.kr'], ['analytics', '/analytics', 'analyst@pusan.univ.demo.hangyul.kr'],
    ['cohorts', '/cohorts', 'admin@pusan.univ.demo.hangyul.kr'], ['programs', '/programs', 'admin@pusan.univ.demo.hangyul.kr'],
    ['rules', '/rules', 'admin@pusan.univ.demo.hangyul.kr'], ['scholarships', '/scholarships', 'admin@pusan.univ.demo.hangyul.kr'],
    ['agencies', '/agencies', 'admin@pusan.univ.demo.hangyul.kr'], ['partnership', '/partnership', 'admin@pusan.univ.demo.hangyul.kr'],
    ['exports', '/exports', 'admin@pusan.univ.demo.hangyul.kr'], ['settings', '/settings', 'admin@pusan.univ.demo.hangyul.kr'],
    ['notifications', '/notifications', 'admissions@pusan.univ.demo.hangyul.kr'],
  ] },
};

const metrics = fs.existsSync(`${OUT}/metrics.json`) ? JSON.parse(fs.readFileSync(`${OUT}/metrics.json`, 'utf8')) : {};
const browser = await chromium.launch({ args: ['--headless=new'] });
for (const [app, conf] of Object.entries(APPS)) {
  if (appFilter && appFilter !== 'all' && appFilter !== app) continue;
  fs.mkdirSync(`${OUT}/${app}/full`, { recursive: true });
  const byAccount = new Map();
  for (const r of conf.routes) { const k = r[2] ?? '__anon'; if (!byAccount.has(k)) byAccount.set(k, []); byAccount.get(k).push(r); }
  for (const [account, routes] of byAccount) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    if (account !== '__anon') {
      await page.goto(`${conf.base}/login?demo=${encodeURIComponent(account)}`);
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }).catch(() => errors.push('login failed'));
    }
    for (const [name, path] of routes) {
      if (nameFilter && !new RegExp(nameFilter).test(name)) continue;
      for (const w of (process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : KEY.has(`${app}/${name}`) ? ALL10 : conf.widths)) {
        await page.setViewportSize({ width: w, height: H[w] ?? 900 });
        const t0 = Date.now();
        await page.goto(conf.base + path, { waitUntil: 'networkidle' }).catch(() => errors.push(`nav ${path}`));
        await page.waitForTimeout(500);
        const ms = Date.now() - t0;
        const m = await page.evaluate(() => {
          const vh = innerHeight;
          const pageOverflow = document.documentElement.scrollWidth - innerWidth;
          const sideScroll = [...document.querySelectorAll('*')].filter((el) => {
            const cs = getComputedStyle(el);
            return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 240 && el.querySelector('table, [role=table], [role=grid]');
          }).length;
          const prim = [...document.querySelectorAll('.hg-btn--primary, .btn-primary, .theme-btn-6, .h6_cta-btn')].filter((b) => { const r = b.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.width > 0; }).length;
          const text = [...document.querySelectorAll('body *')].filter((e) => e.childElementCount === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0).length;
          return { screens: +(document.documentElement.scrollHeight / vh).toFixed(1), pageOverflow, sideScrollTables: sideScroll, primaryInView: prim, textNodes: text, h1: document.querySelectorAll('h1').length };
        });
        metrics[`${app}/${name}@${w}`] = { ...m, ms, errors: errors.splice(0) };
        await page.screenshot({ path: `${OUT}/${app}/${name}-${w}.png` });
        if (FULL.has(w)) await page.screenshot({ path: `${OUT}/${app}/full/${name}-${w}.png`, fullPage: true }).catch(() => {});
        console.log(app, name, w, JSON.stringify(m), ms);
      }
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
