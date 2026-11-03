// V23 — which translation keys do the priority customer routes actually render?
// Visits each route with the dev-only key recorder on (localStorage hg.recordKeys=1, see packages/i18n installKeyRecorder),
// scrolls the page (scroll-revealed sections render their copy late), and writes the union per app to
// docs/qa/v23/l10n/priority-keys.json. Requires the dev stack (npm run dev).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'docs/qa/v23/l10n/priority-keys.json');

export const PRIORITY = {
  marketing: { base: 'http://localhost:3100', login: null, routes: ['/', '/universities', '/universities/gachon-university', '/universities/inst-2640', '/universities/kaya-university', '/start', '/privacy', '/terms', '/no-such-page'] },
  student_public: { base: 'http://localhost:3101', login: null, routes: ['/login', '/register', '/forgot'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', routes: ['/', '/explore', '/explore?tab=foryou', '/explore?tab=saved', '/universities/pusan-national-university', '/applications', '/documents', '/essays', '/messages', '/notifications', '/services', '/profile', '/settings', '/more', '/compare', '/scholarships', '/help', '/family'] },
  student_visa: { base: 'http://localhost:3101', login: 'student.visa@demo.hangyul.kr', routes: ['/', '/visa', '/housing', '/arrival', '/applications'] },
  student_arrived: { base: 'http://localhost:3101', login: 'student.arrived@demo.hangyul.kr', routes: ['/', '/arrival', '/housing'] },
  agency: { base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr', routes: ['/', '/students', '/review', '/review?mode=writing', '/review?mode=applications', '/messages', '/performance', '/manage'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', routes: ['/', '/messages', '/analytics', '/manage', '/cohorts/list'] },
};

async function crawl(name, cfg, browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  await ctx.addInitScript(() => { try { localStorage.setItem('hg.recordKeys', '1'); localStorage.setItem('hg.locale', 'en'); } catch { /* */ } });
  const p = await ctx.newPage();
  if (cfg.login) {
    await p.goto(`${cfg.base}/login?demo=${encodeURIComponent(cfg.login)}&lang=en`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  }
  const keys = new Set();
  // detail routes discovered from the first list page (an application, a conversation, a student)
  const extra = [];
  for (const r of cfg.routes) {
    const sep = r.includes('?') ? '&' : '?';
    await p.goto(`${cfg.base}${r}${sep}lang=en`, { waitUntil: 'networkidle' }).catch(() => {});
    for (let y = 0; y < 8; y += 1) { await p.mouse.wheel(0, 900); await p.waitForTimeout(120); }
    await p.waitForTimeout(400);
    if (name.startsWith('student') && r === '/applications') {
      const href = await p.$$eval('a[href^="/applications/"]', (as) => as.map((a) => a.getAttribute('href'))[0]).catch(() => null);
      if (href) extra.push(href);
    }
    if (r === '/messages') {
      const href = await p.$$eval('a[href^="/messages/"]', (as) => as.map((a) => a.getAttribute('href'))[0]).catch(() => null);
      if (href) extra.push(href);
    }
    if (name === 'agency' && r === '/students') {
      const href = await p.$$eval('a[href^="/students/"]', (as) => as.map((a) => a.getAttribute('href'))[0]).catch(() => null);
      if (href) extra.push(href);
    }
    if (name === 'university' && r === '/') {
      const href = await p.$$eval('a[href^="/applications/"]', (as) => as.map((a) => a.getAttribute('href'))[0]).catch(() => null);
      if (href) extra.push(href);
    }
    (await p.evaluate(() => Object.keys(window.__hgKeys ?? {}))).forEach((k) => keys.add(k));
  }
  for (const r of extra) {
    await p.goto(`${cfg.base}${r}`, { waitUntil: 'networkidle' }).catch(() => {});
    for (let y = 0; y < 6; y += 1) { await p.mouse.wheel(0, 900); await p.waitForTimeout(120); }
    (await p.evaluate(() => Object.keys(window.__hgKeys ?? {}))).forEach((k) => keys.add(k));
  }
  await ctx.close();
  return { routes: [...cfg.routes, ...extra], keys: [...keys].sort() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2]?.split(',');
  const browser = await chromium.launch();
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { apps: {} };
  for (const [name, cfg] of Object.entries(PRIORITY)) {
    if (only && !only.includes(name)) continue;
    prev.apps[name] = await crawl(name, cfg, browser);
    console.log(name, prev.apps[name].routes.length, 'routes', prev.apps[name].keys.length, 'keys');
  }
  await browser.close();
  prev.generated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(prev, null, 1) + '\n');
}
