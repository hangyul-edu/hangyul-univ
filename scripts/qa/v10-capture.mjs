/**
 * V10 route capture — the critical screen set from the V10 brief, at the five V10 review widths.
 *
 *   node scripts/qa/v10-capture.mjs <before|after> [appFilter]
 *
 * Marketing routes are captured anonymously. Console/student routes sign in through Demo access
 * (`?demo=<email>` — development builds only), the same mechanism scripts/qa/v9-capture.mjs uses.
 * Writes PNGs plus metrics.json (height in screens, page overflow, sideways tables, h1 count,
 * primary action in the first viewport, console errors) into docs/qa/v10/<phase>/<app>/.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const PHASE = process.argv[2] ?? 'before';
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;

const WIDTHS = [[1440, 900], [1024, 768], [768, 1024], [430, 932], [390, 844]];
const BASE = { marketing: 'http://localhost:3100', student: 'http://localhost:3101', agency: 'http://localhost:3102', university: 'http://localhost:3103' };

const PERSONA = {
  student: 'student@demo.hangyul.kr',
  agency: 'counselor@lotus.demo.hangyul.kr',
  university: 'admissions@pusan.univ.demo.hangyul.kr',
};

/** The V10 brief's critical screen set. */
const ROUTES = {
  marketing: ['/', '/universities', '/universities/pusan-national-university', '/students', '/guides', '/how-it-works', '/trust'],
  student: ['/', '/explore', '/compare', '/budget', '/applications', '/documents', '/essays', '/visa', '/housing', '/arrival'],
  agency: ['/', '/students', '/documents', '/essays', '/applications', '/submissions', '/messages', '/performance', '/team', '/hq'],
  university: ['/', '/applicants', '/documents', '/analytics', '/programs', '/cohorts', '/partnership'],
};

const slug = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '_'));
const metrics = [];

/**
 * Scroll the page once and wait for every image to decode.
 *
 * A `fullPage` screenshot renders content far below the viewport, but `loading="lazy"` images there have not
 * necessarily been fetched or decoded, so they come out blank — a capture artifact that looks exactly like a
 * broken layout. Scrolling triggers the loads; `decode()` waits for the pixels.
 */
async function settleImages(page) {
  await page.evaluate(async () => {
    // Programmatic `scrollTo` jumps do not reliably trip Chromium's lazy-loading heuristics in headless, so a
    // below-the-fold image can still be unfetched when the shot is taken — which looks exactly like a broken
    // layout. Opting every image out of lazy loading for the capture is the only dependable fix; the product
    // keeps `loading="lazy"`.
    for (const im of document.images) if (im.loading === 'lazy') im.loading = 'eager';
    await new Promise((resolve) => {
      let y = 0;
      const step = setInterval(() => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y > document.body.scrollHeight) { clearInterval(step); window.scrollTo(0, 0); resolve(); }
      }, 60);
    });
    await Promise.all([...document.images].filter((im) => !im.complete).map((im) => Promise.race([
      new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }),
      new Promise((r) => setTimeout(r, 5000)),
    ])));
    // `decode()` never settles for an image the browser has not fetched, so every wait is bounded. Without the
    // race a single off-screen lazy image hangs the whole capture.
    const bounded = (im) => Promise.race([
      im.decode ? im.decode().catch(() => {}) : Promise.resolve(),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await Promise.all([...document.images].map(bounded));
  });
  await page.waitForTimeout(400);
}

// A note for whoever tries to pixel-diff two runs of this script and finds a third of the console images
// "changed": Chromium's full-page screenshot is not horizontally stable here. Measured on one page, loaded
// eight times with no code change between: `h1.getBoundingClientRect().x` read 220 every single time, while
// the PNG put that same heading at 206 or 221 depending on the run. The DOM is identical; the rasterisation
// is not. `--hide-scrollbars` reduces it (one run in eight instead of five) but does not remove it, and it
// changes the layout width, so it is not used here.
//
// What this does and does not affect: every number this script records — height, overflow, h1 count, sideways
// tables, console errors — is read from the DOM, and two runs produce byte-identical `metrics.json` (verified
// across 85 views). So the measurements are sound and the screenshots are sound as pictures; only pixel
// comparison between runs is unreliable, and only horizontally. Do not add waits to "fix" it — two attempts
// at that (geometry stability, stylesheet readiness) changed nothing, because nothing is unsettled.

const browser = await chromium.launch();
for (const [app, routes] of Object.entries(ROUTES)) {
  if (FILTER && !FILTER.test(app)) continue;
  const outDir = `docs/qa/v10/${PHASE}/${app}`;
  mkdirSync(outDir, { recursive: true });
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    if (PERSONA[app]) {
      // Demo access signs the persona in once per context; `?demo=` is only read by the login page.
      await page.goto(`${BASE[app]}/login?demo=${encodeURIComponent(PERSONA[app])}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
      await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(2500);
    }
    for (const route of routes) {
      const name = `${slug(route)}-${w}`;
      try {
        await page.goto(`${BASE[app]}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
      } catch {
        try { await page.goto(`${BASE[app]}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 }); } catch { /* recorded as an error below */ }
      }
      await page.waitForTimeout(1600);
      await settleImages(page);
      await page.screenshot({ path: `${outDir}/${name}.png` });
      await page.screenshot({ path: `${outDir}/${name}-full.png`, fullPage: true });
      const m = await page.evaluate(() => {
        const sideways = [...document.querySelectorAll('table')].filter((t) => {
          const box = t.closest('div, section') ?? t.parentElement;
          return box ? t.scrollWidth > box.clientWidth + 2 : false;
        }).length;
        const firstView = [...document.querySelectorAll('a[href], button')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 60 && r.height > 28;
        }).length;
        return {
          height: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          h1: document.querySelectorAll('h1').length,
          sideways,
          firstView,
          rawKeys: /\b[a-z0-9]+\.[a-z0-9]+\.[a-zA-Z0-9]+\b/.test(document.body.innerText) ? 1 : 0,
        };
      });
      metrics.push({ app, route, width: w, screens: +(m.height / h).toFixed(1), ...m, errors: errors.length });
      console.log(`${app}${route} @${w}  ${m.height}px (${(m.height / h).toFixed(1)} screens) overflow=${m.overflow} h1=${m.h1} sideways=${m.sideways} err=${errors.length}`);
      errors.length = 0;
    }
    await ctx.close();
  }
}
await browser.close();
mkdirSync(`docs/qa/v10/${PHASE}`, { recursive: true });
writeFileSync(`docs/qa/v10/${PHASE}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log(`\n${metrics.length} views → docs/qa/v10/${PHASE}/metrics.json`);
