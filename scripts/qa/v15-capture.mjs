/**
 * V15 visual capture (brief Part 34) — every surface this pass touched, at five widths.
 *
 * `OUT=docs/qa/v15/after node scripts/qa/v15-capture.mjs`
 *
 * Only surfaces V15 changed are here. Capturing untouched screens would pad the evidence without
 * supporting anything; what the brief asks for is a before/after on what moved, and the "before" set is the
 * V14 capture that already exists for the pages that existed then.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v15/after';
const WIDTHS = (process.env.WIDTHS ?? '390,768,1024,1440,1728').split(',').map(Number);
const M = process.env.MARKETING ?? 'http://localhost:3100';
const S = process.env.STUDENT ?? 'http://localhost:3101';
const A = process.env.AGENCY ?? 'http://localhost:3102';
const U = process.env.UNIVERSITY ?? 'http://localhost:3103';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function login(page, base, email) {
  await page.goto(`${base}/login?lang=ko`);
  await page.fill('#email', email);
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
}

/** Each entry: a name, the base, a path, an optional sign-in, and what to wait for before shooting. */
const SHOTS = [
  { name: 'marketing-pricing', base: M, path: '/?lang=ko', wait: '#pricing', scrollTo: '#pricing' },
  { name: 'marketing-pricing-open', base: M, path: '/?lang=ko', wait: '#pricing', scrollTo: '#pricing', click: '.kn-compare__toggle' },
  { name: 'student-services', base: S, path: '/services?lang=ko', login: 'student@demo.hangyul.kr', wait: '.st-page' },
  { name: 'student-services-choose', base: S, path: '/services?plan=all_in_one&lang=ko', login: 'student02@demo.hangyul.kr', wait: '.sv15-plans' },
  { name: 'agency-today', base: A, path: '/?lang=ko', login: 'counselor@lotus.demo.hangyul.kr', wait: '.ag9-q__row' },
  // Resolved at run time from the top of the counsellor's own queue: a seeded UUID is reinvented by every
  // `db:reset`, and a capture script that silently shoots a 404 page is worse than one that fails.
  { name: 'agency-workspace', base: A, path: ':firstStudent', login: 'counselor@lotus.demo.hangyul.kr', wait: '.ag15-scope' },
  { name: 'agency-review', base: A, path: '/review?lang=ko', login: 'counselor@lotus.demo.hangyul.kr', wait: 'main' },
  { name: 'agency-insights', base: A, path: '/performance?lang=ko', login: 'manager@lotus.demo.hangyul.kr', wait: 'main' },
  { name: 'agency-insights-quality', base: A, path: '/performance?tab=quality&lang=ko', login: 'manager@lotus.demo.hangyul.kr', wait: '.ag15-delivery' },
  { name: 'university-overview', base: U, path: '/?lang=ko', login: 'admin@pusan.univ.demo.hangyul.kr', wait: '#ov-funnel' },
  { name: 'university-applicants', base: U, path: '/applicants?lang=ko', login: 'admin@pusan.univ.demo.hangyul.kr', wait: 'main' },
  { name: 'university-analytics', base: U, path: '/analytics?lang=ko', login: 'admin@pusan.univ.demo.hangyul.kr', wait: '[role=tab]' },
  { name: 'university-programs', base: U, path: '/programs?lang=ko', login: 'admin@pusan.univ.demo.hangyul.kr', wait: 'main' },
];

const sessions = new Map();
let shot = 0;
for (const s of SHOTS) {
  const key = `${s.base}|${s.login ?? ''}`;
  if (!sessions.has(key)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    if (s.login) await login(page, s.base, s.login);
    sessions.set(key, { ctx, page });
  }
  const { page } = sessions.get(key);
  let path = s.path;
  if (path === ':firstStudent') {
    await page.goto(`${s.base}/?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ag9-q .ag8-now__name', { timeout: 30_000 });
    path = `${await page.locator('.ag9-q .ag8-now__name').first().getAttribute('href')}?lang=ko`;
  }
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 950 });
    await page.goto(`${s.base}${path}`, { waitUntil: 'domcontentloaded' });
    try { await page.waitForSelector(s.wait, { timeout: 30_000 }); } catch { /* capture what there is */ }
    await page.waitForTimeout(1600);
    if (s.scrollTo) { await page.locator(s.scrollTo).scrollIntoViewIfNeeded(); await page.waitForTimeout(700); }
    if (s.click) { await page.locator(s.click).click().catch(() => {}); await page.waitForTimeout(600); }
    await page.screenshot({ path: `${OUT}/${s.name}-${w}.png`, fullPage: !s.scrollTo });
    shot++;
  }
  console.log(`  · ${s.name} — ${WIDTHS.join(', ')}`);
}
for (const { ctx } of sessions.values()) await ctx.close();
await browser.close();
console.log(`\n${shot} screenshots → ${OUT}`);
