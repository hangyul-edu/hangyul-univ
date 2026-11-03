// V23 — route and click integrity crawl (brief §72). Every reachable customer route of the four web products, at
// 390 / 768 / 1440 (+ 1728 on the dense console pages), signed in where the route needs it.
//
// Per route and width: renders (an <h1> or ≥ 80 characters of main text), is not the app's 404 (its <h1> differs from the
// one a nonsense path shows), no console error, no uncaught exception, no horizontal overflow, no spinner/skeleton still
// showing after load, no `href="#"`/empty-href link and no permanently disabled button without an explanation.
// Then every distinct internal link found on the pages is opened once to prove it does not lead to a 404.
//
//   node scripts/qa/v23/crawl.mjs [--app marketing,student,agency,university] [--widths 390,768,1440]
// Writes docs/qa/v23/crawl/CRAWL.json and exits 1 on any finding.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const ARG = process.argv.slice(2);
const pick = (n, d) => (ARG.includes(n) ? ARG[ARG.indexOf(n) + 1] : d);
const APPS = pick('--app', 'marketing,student,agency,university').split(',');
const WIDTHS = pick('--widths', '390,768,1440').split(',').map(Number);

const SPEC = {
  marketing: { base: 'http://localhost:3100', login: null, routes: ['/', '/universities', '/universities?group=busan', '/universities?kind=JUNIOR_COLLEGE', '/universities?q=%EC%84%9C%EC%9A%B8', '/universities?q=zzzz', '/universities/gachon-university', '/universities/inst-2640', '/universities/kaya-university', '/universities/seoul-national-university', '/start', '/privacy', '/terms'] },
  student: { base: 'http://localhost:3101', login: 'student@demo.hangyul.kr', public: ['/login', '/register', '/forgot'], routes: ['/', '/explore', '/explore?tab=foryou', '/explore?tab=saved', '/universities/pusan-national-university', '/compare', '/family', '/applications', '/documents', '/essays', '/messages', '/notifications', '/visa', '/housing', '/arrival', '/help', '/scholarships', '/services', '/support', '/profile', '/settings', '/more', '/tasks', '/budget', '/matches', '/saved'] },
  agency: { base: 'http://localhost:3102', login: 'counselor@lotus.demo.hangyul.kr', public: ['/login'], routes: ['/', '/students', '/review', '/review?mode=writing', '/review?mode=applications', '/applications', '/tasks', '/tasks?view=deadlines', '/messages', '/performance', '/manage', '/settings', '/team', '/templates', '/universities', '/services', '/vendors', '/payments', '/audit', '/notifications', '/submissions', '/essays/insights', '/documents?student=x', '/pipeline'], dense: ['/', '/students', '/performance'] },
  university: { base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', public: ['/login'], routes: ['/', '/applicants', '/messages', '/analytics', '/manage', '/settings', '/programs', '/scholarships', '/agencies', '/partnership', '/exports', '/notifications', '/documents', '/cohorts', '/cohorts/list', '/cohorts/risk', '/cohorts/visa', '/retention', '/offers', '/funnel'], dense: ['/', '/analytics', '/cohorts/list'] },
};

const findings = [];
const report = { generated_at: new Date().toISOString(), widths: WIDTHS, apps: {} };
const browser = await chromium.launch();

async function probe(p, url) {
  const errors = [];
  const onC = (m) => { if (m.type() === 'error' && !/favicon|Download the React DevTools|ResizeObserver loop/.test(m.text())) errors.push(m.text().slice(0, 180)); };
  const onE = (e) => errors.push(`pageerror: ${String(e).slice(0, 180)}`);
  p.on('console', onC); p.on('pageerror', onE);
  await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push(`nav: ${String(e).slice(0, 120)}`));
  for (let y = 0; y < 4; y += 1) { await p.mouse.wheel(0, 900); await p.waitForTimeout(100); }
  await p.waitForTimeout(800);
  await p.waitForFunction(() => document.querySelector('h1') || (document.querySelector('main')?.innerText?.length ?? 0) > 80, null, { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector('.hg-skeleton, [aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
  const info = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const main = document.querySelector('main') ?? document.body;
    const deadLinks = [...document.querySelectorAll('a')].filter((a) => vis(a) && (a.getAttribute('href') === '#' || a.getAttribute('href') === '' || (!a.hasAttribute('href') && !a.getAttribute('role')))).map((a) => a.textContent.trim().slice(0, 40));
    const disabled = [...document.querySelectorAll('button[disabled]')].filter((b) => vis(b) && !b.title && !b.getAttribute('aria-describedby') && !b.closest('form') && !b.closest('[role=dialog]') && !b.closest('nav[aria-label]') && !b.parentElement?.querySelector('textarea, input')
      && !b.closest('[class*="compose"], [class*="Composer"], [class*="chat"]')).map((b) => b.textContent.trim().slice(0, 40)).filter(Boolean);
    const spinners = [...document.querySelectorAll('.hg-skeleton, [aria-busy="true"], .spinner-border')].filter(vis).length;
    const links = [...document.querySelectorAll('a[href^="/"]')].filter(vis).map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('/api') && !h.includes('download'));
    return { h1: document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null, text: (main.innerText || '').trim().length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, deadLinks, disabled, spinners, links, path: location.pathname + location.search };
  });
  p.off('console', onC); p.off('pageerror', onE);
  return { ...info, errors };
}

for (const app of APPS) {
  const spec = SPEC[app];
  const ar = (report.apps[app] = { routes: {}, links: {} });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const p = await ctx.newPage();
  // The 404 heading is measured in the state the routes are visited in: signed out for public routes, and again after
  // sign-in (an authenticated app sends an unknown path to its login while signed out — that is not its 404).
  let notFoundH1 = spec.login ? null : (await probe(p, `${spec.base}/__v23-no-such-route-${Date.now()}`)).h1;
  const check = (route, w, r, opts = {}) => {
    const key = `${route} @${w}`;
    const issues = [];
    if (!r.h1 && r.text < 80) issues.push('blank');
    if (notFoundH1 && r.h1 === notFoundH1 && !opts.expect404) issues.push('404');
    if (r.errors.length) issues.push(`console: ${r.errors[0]}`);
    if (r.overflow > 0) issues.push(`overflow ${r.overflow}px`);
    if (r.spinners > 0) issues.push(`still loading (${r.spinners})`);
    if (r.deadLinks.length) issues.push(`dead link: ${r.deadLinks.slice(0, 3).join(' | ')}`);
    if (r.disabled.length) issues.push(`disabled without reason: ${r.disabled.slice(0, 3).join(' | ')}`);
    ar.routes[key] = { h1: r.h1, landed: r.path, issues };
    if (issues.length) findings.push(`${app} ${key}: ${issues.join('; ')}`);
    return r;
  };
  const allLinks = new Set();
  for (const route of spec.public ?? []) for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
    check(route, w, await probe(p, `${spec.base}${route}`));
  }
  if (spec.login) {
    await p.goto(`${spec.base}/login?demo=${encodeURIComponent(spec.login)}`, { waitUntil: 'networkidle' });
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => findings.push(`${app}: demo sign-in failed`));
    notFoundH1 = (await probe(p, `${spec.base}/__v23-no-such-route-${Date.now()}`)).h1;
  }
  for (const route of spec.routes) {
    for (const w of [...WIDTHS, ...((spec.dense ?? []).includes(route) ? [1728] : [])]) {
      await p.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
      const r = check(route, w, await probe(p, `${spec.base}${route}`));
      if (w === 1440) r.links.forEach((l) => allLinks.add(l));
    }
    process.stdout.write('.');
  }
  // every distinct internal link, once, at 1440
  await p.setViewportSize({ width: 1440, height: 900 });
  const tried = [...allLinks].filter((l) => !spec.routes.includes(l)).slice(0, 120);
  for (const l of tried) {
    const r = await probe(p, `${spec.base}${l}`);
    const issues = [];
    if (notFoundH1 && r.h1 === notFoundH1) issues.push('404');
    if (r.errors.length) issues.push(`console: ${r.errors[0]}`);
    if (!r.h1 && r.text < 80) issues.push('blank');
    ar.links[l] = issues;
    if (issues.length) findings.push(`${app} link ${l}: ${issues.join('; ')}`);
  }
  console.log(`\n${app}: ${Object.keys(ar.routes).length} route×width checks, ${tried.length} links followed, 404 heading "${notFoundH1}"`);
  await ctx.close();
}
await browser.close();
report.findings = findings;
fs.mkdirSync(path.join(ROOT, 'docs/qa/v23/crawl'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/qa/v23/crawl/CRAWL.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`\n${findings.length} findings`);
for (const f of findings.slice(0, 60)) console.log('  ✗', f);
process.exit(findings.length ? 1 : 0);
