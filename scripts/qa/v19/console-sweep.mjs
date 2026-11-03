/**
 * V19 — open every Agency and University console route as the people who work in them (REPORT §195, §196).
 *
 * V18 did not open either console at all and said so. This signs in with the seeded console accounts and
 * walks every route, recording the same defect classes as the student sweep plus the two that matter in a
 * workbench: a table that overflows its container, and a screen whose primary question has no answer on it.
 *
 *   node scripts/qa/v19/console-sweep.mjs agency|university [--widths 1280,1440] [--shots]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const APP = process.argv[2];
const ARG = process.argv.slice(3);
const flag = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const WIDTHS = flag('--widths', '1440').split(',').map(Number);
const SHOTS = ARG.includes('--shots');

const CFG = {
  agency: {
    base: 'http://localhost:3102',
    email: 'counselor@lotus.demo.hangyul.kr',
    routes: [
      ['overview', '/'], ['performance', '/performance'], ['students', '/students'],
      ['pipeline', '/pipeline'], ['tasks', '/tasks'], ['tasks-meetings', '/consultations'],
      ['tasks-deadlines', '/deadlines'], ['services', '/services'], ['vendors', '/vendors'],
      ['messages', '/messages'], ['review', '/review'], ['review-documents', '/documents'],
      ['review-writing', '/essays'], ['writing-insights', '/essays/insights'],
      ['applications', '/applications'], ['catalog', '/universities'], ['templates', '/templates'],
      ['team', '/team'], ['payments', '/payments'], ['audit', '/audit'],
      ['submissions', '/submissions'], ['manage', '/manage'], ['notfound', '/nope'],
    ],
    dynamic: [['student-workspace', '/students', 'a[href^="/students/"]']],
  },
  university: {
    base: 'http://localhost:3103',
    email: 'admissions@pusan.univ.demo.hangyul.kr',
    routes: [
      ['overview', '/'], ['applicants', '/applicants'], ['programs', '/programs'],
      ['rules', '/rules'], ['documents', '/documents'], ['offers', '/offers'],
      ['scholarships', '/scholarships'], ['agencies', '/agencies'], ['cohorts', '/cohorts'],
      ['lifecycle', '/lifecycle'], ['retention', '/retention'], ['graduation', '/graduation'],
      ['analytics', '/analytics'], ['messages', '/messages'], ['manage', '/manage'],
      ['notfound', '/nope'],
    ],
    dynamic: [['application-detail', '/applicants', 'a[href^="/applications/"]']],
  },
}[APP];

if (!CFG) { console.error('usage: console-sweep.mjs agency|university'); process.exit(2); }
const OUT = `docs/qa/v19/screenshots/${APP}`;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${CFG.base}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* ignore */ } });
  await page.fill('#email', CFG.email);
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForTimeout(1000);

  const routes = [...CFG.routes];
  for (const [name, listPath, sel] of CFG.dynamic) {
    await page.goto(`${CFG.base}${listPath}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);
    const href = await page.locator(sel).first().getAttribute('href').catch(() => null);
    if (href) routes.push([name, href]);
  }

  for (const [name, path] of routes) {
    const errs = [];
    const http5 = [];
    const onC = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); };
    const onP = (e) => errs.push(`UNCAUGHT ${String(e).slice(0, 180)}`);
    const onR = (r) => { if (r.status() >= 500) http5.push(`${r.status()} ${r.url().split('/api')[1]?.slice(0, 60) ?? ''}`); };
    page.on('console', onC); page.on('pageerror', onP); page.on('response', onR);

    let probe = {};
    try {
      await page.goto(`${CFG.base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(900);
      probe = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const rawKeys = (text.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+){2,}\b/g) || [])
          .filter((k) => !/\.(com|kr|net|org|io|pdf|png|jpg|svg)$/.test(k)).slice(0, 4);
        // A table wider than the box it lives in, with no scroller — the console-specific defect, where a
        // column the reader needs is simply unreachable.
        //
        // Visually-hidden tables are excluded. Every chart in these consoles ships an `.hg-sr-only` data
        // table as its text alternative; those are clipped to a 1 px box *by design*, and counting them
        // reported two defects on /retention and /graduation that did not exist.
        const clipped = [...document.querySelectorAll('table')].filter((t) => {
          const box = t.parentElement;
          if (!box || t.closest('.hg-sr-only, [aria-hidden="true"]')) return false;
          if (t.getBoundingClientRect().width < 40) return false;
          const ov = getComputedStyle(box).overflowX;
          return t.scrollWidth > box.clientWidth + 2 && ov !== 'auto' && ov !== 'scroll';
        }).length;
        return {
          h1: (document.querySelector('#main h1, h1, .hg-page__title')?.textContent || '').trim().slice(0, 40),
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 2
            ? `${document.documentElement.scrollWidth}>${window.innerWidth}` : '',
          rawKeys, clippedTables: clipped,
          blank: text.trim().length < 40,
          charts: document.querySelectorAll('svg.recharts-surface, .recharts-wrapper, canvas').length,
          tables: document.querySelectorAll('table').length,
        };
      });
    } catch (e) { probe = { error: String(e).slice(0, 110) }; }
    page.off('console', onC); page.off('pageerror', onP); page.off('response', onR);

    if (SHOTS) await page.screenshot({ path: `${OUT}/${name}@${width}.png` }).catch(() => {});
    results.push({ app: APP, width, name, path, ...probe, errs: errs.slice(0, 2), http5: http5.slice(0, 2) });
  }
  await ctx.close();
}
await browser.close();

writeFileSync(`docs/qa/v19/evidence/${APP}-sweep.json`, JSON.stringify(results, null, 2));
let bad = 0;
console.log('w     route                 h1                             tbl chart  flags');
for (const r of results) {
  const f = [];
  if (r.error) f.push(`LOAD:${r.error}`);
  if (r.blank) f.push('BLANK');
  if (r.overflowX) f.push(`PAGE-OVERFLOW ${r.overflowX}`);
  if (r.clippedTables) f.push(`CLIPPED-TABLE x${r.clippedTables}`);
  if (r.rawKeys?.length) f.push(`RAWKEY ${r.rawKeys.join(',')}`);
  if (r.errs?.length) f.push(`CONSOLE ${r.errs[0]}`);
  if (r.http5?.length) f.push(`HTTP ${r.http5.join(',')}`);
  if (!r.h1 && !r.error) f.push('NO-H1');
  if (f.length) bad++;
  console.log(String(r.width).padEnd(5), r.name.padEnd(21), (r.h1 || '—').padEnd(30),
    String(r.tables ?? '-').padStart(3), String(r.charts ?? '-').padStart(5), ' ', f.join(' | ') || 'ok');
}
console.log(`\n${results.length} screens, ${bad} with findings → docs/qa/v19/evidence/${APP}-sweep.json`);
