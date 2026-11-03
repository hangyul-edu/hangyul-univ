/**
 * V13 before/after capture (brief Part 31).
 *
 * Captures the eleven screens the brief names, at 390 / 768 / 1024 / 1440 / 1728, as both a first-viewport
 * shot (what the visitor actually judges in two seconds) and a full-page shot. Dynamic ids are discovered from
 * the listing page rather than hard-coded, so the script keeps working after a reseed.
 *
 *   OUT=docs/qa/v13/before node scripts/qa/v13-capture.mjs [surface...]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v13/before';
const WIDTHS = (process.env.WIDTHS ?? '390,768,1024,1440,1728').split(',').map(Number);
const PW = 'Hangyul!2026';

/** `discover` runs once after login and turns a listing page into a concrete route. */
const SURFACES = {
  marketing: {
    base: 'http://localhost:3100', login: null,
    routes: [{ id: 'home', path: '/?lang=ko' }, { id: 'universities', path: '/universities?lang=ko' }],
  },
  student: {
    base: 'http://localhost:3101', login: 'student@demo.hangyul.kr',
    routes: [{ id: 'home', path: '/' }],
    discover: async (page, base) => {
      await page.goto(`${base}/applications`, { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/applications/"]').first().getAttribute('href').catch(() => null);
      return href ? [{ id: 'application', path: href }] : [];
    },
  },
  agency: {
    base: 'http://localhost:3102', login: 'manager@lotus.demo.hangyul.kr',
    routes: [{ id: 'today', path: '/' }, { id: 'review', path: '/review' }],
    discover: async (page, base) => {
      await page.goto(`${base}/students`, { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/students/"]').first().getAttribute('href').catch(() => null);
      return href ? [{ id: 'student', path: href }] : [];
    },
  },
  university: {
    base: 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr',
    routes: [{ id: 'overview', path: '/' }, { id: 'applicants', path: '/applicants' }, { id: 'analytics', path: '/analytics' }],
  },
};

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const browser = await chromium.launch();
let n = 0;
for (const [name, s] of Object.entries(SURFACES)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (s.login) {
    await page.goto(`${s.base}/login`);
    await page.fill('#email', s.login); await page.fill('#password', PW);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
      .catch(() => console.log(`! ${name}: login did not redirect`));
  }
  const routes = [...s.routes, ...(s.discover ? await s.discover(page, s.base) : [])];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 });
    for (const r of routes) {
      await page.goto(`${s.base}${r.path}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${name}-${r.id}-${w}.png`, fullPage: false });
      await page.screenshot({ path: `${OUT}/${name}-${r.id}-${w}-full.png`, fullPage: true });
      n += 2;
      console.log(`${OUT}/${name}-${r.id}-${w}.png`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${n} screenshots → ${OUT}`);
