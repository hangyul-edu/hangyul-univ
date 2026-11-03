/**
 * V14 before/after capture (brief Part 1).
 *
 * The public site is what the brief is judging, so it is captured at all nine widths the brief names; the
 * authenticated consoles, where the question is hierarchy rather than art direction, are captured at the five
 * that actually change their layout. Marketing routes are discovered from the live directory so the five
 * "representative university details" are real slugs rather than a hard-coded list that rots on reseed.
 *
 *   OUT=docs/qa/v14/before node scripts/qa/v14-capture.mjs [surface...]
 *
 * Each surface's base URL can be overridden (MARKETING / STUDENT / AGENCY / UNIVERSITY), which is how a run
 * targets a freshly-started instance rather than whichever dev server happens to be on the default port.
 *
 * `HOME_SECTIONS=1` additionally slices the homepage into the six named bands (top, marquee, services,
 * value, faq, footer), because a 12,000 px full-page PNG is not something a person can judge.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/qa/v14/before';
const PUBLIC_WIDTHS = (process.env.PUBLIC_WIDTHS ?? '320,360,390,430,768,1024,1280,1440,1728').split(',').map(Number);
const APP_WIDTHS = (process.env.APP_WIDTHS ?? '320,390,768,1024,1440').split(',').map(Number);
const PW = 'Hangyul!2026';

/** The homepage bands the brief asks to see on their own, by the selector that anchors each one. */
const HOME_SECTIONS = [
  ['top', '.kn-hero'],
  ['marquee', '.kn-crests'],
  ['services', '#services'],
  ['value', '#why'],
  ['faq', '#faq'],
  ['footer', 'footer'],
];

const SURFACES = {
  marketing: {
    base: process.env.MARKETING ?? 'http://localhost:3100', login: null, widths: PUBLIC_WIDTHS,
    routes: [
      { id: 'home', path: '/?lang=ko' },
      { id: 'universities', path: '/universities?lang=ko' },
      { id: 'privacy', path: '/privacy?lang=ko' },
      { id: 'terms', path: '/terms?lang=ko' },
    ],
    /** Five representative detail pages: the directory's own first five, whatever they are today. */
    discover: async (page, base) => {
      await page.goto(`${base}/universities?lang=ko`, { waitUntil: 'networkidle' });
      const hrefs = await page.locator('a[href^="/universities/"]').evaluateAll(
        (as) => [...new Set(as.map((a) => a.getAttribute('href')))].slice(0, 5));
      return hrefs.map((h, i) => ({ id: `detail${i + 1}`, path: h.includes('?') ? h : `${h}?lang=ko` }));
    },
  },
  student: {
    base: process.env.STUDENT ?? 'http://localhost:3101', login: 'student@demo.hangyul.kr', widths: APP_WIDTHS,
    routes: [
      { id: 'home', path: '/' }, { id: 'universities', path: '/universities' },
      { id: 'messages', path: '/messages' }, { id: 'visa', path: '/visa' }, { id: 'documents', path: '/documents' },
      { id: 'profile', path: '/profile' },
    ],
    discover: async (page, base) => {
      await page.goto(`${base}/applications`, { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/applications/"]').first().getAttribute('href').catch(() => null);
      return href ? [{ id: 'application', path: href }] : [];
    },
  },
  agency: {
    base: process.env.AGENCY ?? 'http://localhost:3102', login: 'manager@lotus.demo.hangyul.kr', widths: APP_WIDTHS,
    routes: [{ id: 'today', path: '/' }, { id: 'review', path: '/review' }, { id: 'messages', path: '/messages' }],
    discover: async (page, base) => {
      await page.goto(`${base}/students`, { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/students/"]').first().getAttribute('href').catch(() => null);
      return href ? [{ id: 'student', path: href }] : [];
    },
  },
  university: {
    base: process.env.UNIVERSITY ?? 'http://localhost:3103', login: 'admin@pusan.univ.demo.hangyul.kr', widths: APP_WIDTHS,
    routes: [{ id: 'overview', path: '/' }, { id: 'applicants', path: '/applicants' }, { id: 'analytics', path: '/analytics' }],
    discover: async (page, base) => {
      await page.goto(`${base}/applicants`, { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/applicants/"]').first().getAttribute('href').catch(() => null);
      return href ? [{ id: 'review', path: href }] : [];
    },
  },
};

/**
 * Scroll the page through once, then return to the top.
 *
 * Reveal-on-scroll is driven by `IntersectionObserver`, and Playwright's `fullPage` screenshot captures beyond
 * the viewport **without** scrolling — so a section that has never been on screen is still at `opacity: 0`
 * when the shot is taken, and the PNG shows a blank band that no real visitor would ever see. Sweeping first
 * puts the page in the state a reader reaches by scrolling, which is the state these screenshots are supposed
 * to be evidence of.
 */
async function sweep(page) {
  await page.evaluate(async () => {
    // `behavior: 'instant'`, not the default. Bootstrap sets `html { scroll-behavior: smooth }` on this site,
    // so a bare `scrollTo` animates — and a loop of them restarts the animation every step, leaving the page
    // a few hundred pixels from the top no matter how many steps you ask for. The symptom is a full-page
    // screenshot where every revealed section is still blank, which looks exactly like a broken reveal.
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 180));
  });
  // One reveal is 560 ms; give the longest (the 760 ms media wipe) time to finish.
  await page.waitForTimeout(900);
}

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
  for (const w of s.widths) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : w < 1000 ? 1024 : 900 });
    for (const r of routes) {
      await page.goto(`${s.base}${r.path}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(700);
      await sweep(page);
      await page.screenshot({ path: `${OUT}/${name}-${r.id}-${w}.png`, fullPage: false });
      n += 1;
      // One full-page shot per route at the two widths where the whole composition is the question.
      if (w === 390 || w === 1440) {
        await page.screenshot({ path: `${OUT}/${name}-${r.id}-${w}-full.png`, fullPage: true });
        n += 1;
      }
      if (name === 'marketing' && r.id === 'home' && (w === 390 || w === 1440)) {
        for (const [id, sel] of HOME_SECTIONS) {
          const el = page.locator(sel).first();
          if (await el.count() === 0) { console.log(`  ~ no ${sel}`); continue; }
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(250);
          await el.screenshot({ path: `${OUT}/${name}-home-${id}-${w}.png` }).catch((e) => console.log(`  ~ ${id}: ${e.message.split('\n')[0]}`));
          n += 1;
        }
      }
    }
  }
  await ctx.close();
  console.log(`${name}: ${routes.length} routes × ${s.widths.length} widths`);
}
await browser.close();
console.log(`${n} shots → ${OUT}`);
