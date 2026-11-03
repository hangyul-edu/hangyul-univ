/**
 * V19 gate — the checks that would have caught what V19 found.
 *
 * Same rule as `v18-gate.mjs`: every check here exists because something was wrong in a way no existing
 * gate noticed. It does **not** re-test what v12–v18 already cover (secret leakage, locale coverage, the
 * native artifact, pricing sync); `npm run test:release` runs those alongside this one.
 *
 * What it guards, and the defect behind each:
 *
 *   1  page-top rhythm     `/start`'s `<h1>` rendered 14 px *behind* the floating header on every phone,
 *                          and `--mk-headclear` hardcoded the desktop pill's height so the directory's gap
 *                          shrank as the window grew.
 *   2  route scroll        react-router's `ScrollRestoration` keyed saved offsets on `location.key`, which
 *                          is `"default"` for the first entry of every document — so a full-document
 *                          navigation restored the previous page's scroll.
 *   3  motion              the hero armed and showed in one React batch, so the site's first animation
 *                          never played; the closing band had no entrance at all.
 *   4  disabled controls   a disabled primary was a 45 %-opacity tangerine with white text on it.
 *   5  entitlement         `PlanGate` treated a *failed* plan query as "unpaid" and sent paying students
 *                          to the pricing page whenever the API hiccuped.
 *   6  request deadline    `fetch` has no timeout, so a stalled request span skeletons forever.
 *   7  structure           404 pages rendered with no `<h1>` at all.
 *   8  rendering           every marketing and student route renders, with no console error, no raw i18n
 *                          key and no horizontal overflow, at 390 and 1440.
 *
 * Checks 1–3 and 8 need the dev stack; they FAIL loudly rather than skip if it is not up, because a
 * silently-skipped release check is the exact failure mode V17 and V18 were criticised for.
 *
 *   node scripts/qa/v19-gate.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** CSS/TS source with comments removed, so prose describing a defect is not mistaken for the defect. */
const bare = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');


let failed = 0; let passed = 0; let skipped = 0;
const head = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const ok = (s) => { passed++; console.log(`  \x1b[32m✓\x1b[0m ${s}`); };
const bad = (s) => { failed++; console.log(`  \x1b[31m✗ ${s}\x1b[0m`); };
const skip = (s) => { skipped++; console.log(`  \x1b[33m• SKIP ${s}\x1b[0m`); };

const M = process.env.HG_QA_MARKETING ?? 'http://localhost:3100';
const S = process.env.HG_QA_STUDENT ?? 'http://localhost:3101';

const up = async (url) => {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(4000) }); return r.ok; } catch { return false; }
};

/* ------------------------------------------------------------------ static: the source-level invariants */

head('A. Source invariants');
{
  const scss = read('packages/koreanasha-ui/src/scss/koreanasha.scss');
  // The pill's height and the clearance token must be derived together, or they drift apart again.
  if (!/--kn-header-space:\s*calc\(var\(--kn-header-top\)\s*\+\s*var\(--kn-header-h\)/.test(scss)) {
    bad('--kn-header-space is not derived from --kn-header-top + --kn-header-h');
  } else ok('--kn-header-space is derived from the variables that position the pill');

  if (!/--kn-page-top:\s*calc\(var\(--kn-header-space\)\s*\+\s*var\(--kn-page-breathe\)\)/.test(scss)) {
    bad('--kn-page-top is not derived from --kn-header-space + --kn-page-breathe');
  } else ok('--kn-page-top is derived from the header footprint plus the breathing room');

  // `--kn-header-h` must step with `.kn-header__inner`'s min-height at 1200 px.
  const innerLg = /@media \(min-width: 1200px\) \{ \.kn-header__inner \{ min-height: (\d+)px/.exec(scss);
  const varLg = /@media \(min-width: 1200px\)[\s\S]{0,400}?--kn-header-h:\s*(\d+)px/.exec(scss);
  if (!innerLg || !varLg) bad('could not read the 1200 px header height from both the rule and the token');
  else if (innerLg[1] !== varLg[1]) bad(`at 1200 px the pill is ${innerLg[1]}px but --kn-header-h says ${varLg[1]}px`);
  else ok(`--kn-header-h (${varLg[1]}px) agrees with .kn-header__inner at 1200 px`);

  // No page may reintroduce a hand-written clearance.
  const v12 = bare(read('apps/marketing-web/src/styles/directory.css'));
  if (/--mk-headclear\s*:/.test(v12)) bad('styles/directory.css (formerly v12.css) still defines --mk-headclear — the per-page clearance is back');
  else ok('no per-page header-clearance variable survives in styles/directory.css (formerly v12.css)');

  const layout = read('apps/marketing-web/src/components/SiteLayout.tsx');
  if (/<ScrollRestoration\s*\/>/.test(bare(layout))) bad("SiteLayout renders react-router's <ScrollRestoration />, whose 'default' key collides across documents");
  else if (!/<RouteScrollManager\s*\/>/.test(layout)) bad('SiteLayout renders no route-scroll manager at all');
  else ok('marketing uses the shared RouteScrollManager');

  const rs = read('packages/ui/src/route-scroll.tsx');
  if (!/behavior:\s*'instant'/.test(rs)) bad('the route-scroll manager does not scroll with behavior: instant');
  else ok("route transitions scroll with behavior: 'instant', never smooth");
  if (!/scrollRestoration/.test(rs)) bad('route-scroll.tsx does not document the history.scrollRestoration decision');
  else ok('cross-document restoration is left to the browser, and that is written down');
  if (/history\.scrollRestoration\s*=[^=]/.test(bare(rs))) bad("the manager sets history.scrollRestoration, which disables the browser's own cross-document restore");
  else ok('history.scrollRestoration is left at the browser default');

  // Every app must mount the one policy.
  const shells = read('packages/ui/src/shells.tsx');
  if (!/<RouteScrollManager \/>/.test(shells)) bad('StudentShell does not mount RouteScrollManager');
  else ok('StudentShell mounts RouteScrollManager');
  const ynex = read('packages/ynex-ui/src/components/Shell.tsx');
  if (!/<RouteScrollManager \/>/.test(ynex)) bad('YnexShell (agency + university) does not mount RouteScrollManager');
  else ok('YnexShell mounts RouteScrollManager — the consoles had no scroll policy at all before V19');
  if (/function ScrollToTop/.test(bare(read('apps/student-web/src/components/AppLayout.tsx')))) {
    bad("student-web still has its own ScrollToTop beside the shared policy");
  } else ok('the student app no longer carries a second, weaker scroll policy');

  // The hero must paint its hidden state before showing, or the entrance never runs.
  const reveal = read('packages/koreanasha-ui/src/components/layout.tsx');
  if (!/requestAnimationFrame\(\(\) => \{ raf2 = requestAnimationFrame/.test(reveal)) {
    bad('Reveal shows without letting the armed state paint — an in-viewport entrance will not animate');
  } else ok('Reveal paints its armed state before showing (the hero actually animates)');
  if (!/<Reveal variant="rise" className="kn-cta">/.test(layout)) bad('the closing CTA band has no entrance');
  else ok('the closing CTA band has an entrance like every other section');

  // A disabled control must be neutral, and must win on source order.
  const comp = read('packages/ui/src/styles/components.css');
  const disabledAt = comp.indexOf(".hg-btn[disabled], .hg-btn[aria-disabled='true'] {");
  const primaryAt = comp.indexOf('.hg-btn--primary {');
  if (disabledAt < 0) bad('no neutral disabled-button rule found');
  else if (disabledAt < primaryAt) bad('the disabled rule is written before .hg-btn--primary, so the variant wins on source order');
  else if (!/--btn-bg: var\(--hg-surface-sunken\); --btn-fg: var\(--hg-text-tertiary\)/.test(comp.slice(disabledAt, disabledAt + 400))) {
    bad('the disabled rule does not neutralise the fill and the text');
  } else ok('a disabled button is neutral, and its rule outranks every variant');
  if (/\.hg-btn\[disabled\][^{]*\{[^}]*opacity:\s*0\.45/.test(bare(comp))) bad('the 45 % opacity disabled state is back');
  else ok('no 45 %-opacity disabled state');
  const glue = read('packages/eduan-ui/src/scss/_hangyul-glue.scss');
  if (!/\.ed \.hg-btn--primary:not\(\[disabled\]\)/.test(glue)) bad('the Eduan primary override repaints disabled buttons');
  else ok('the Eduan primary override is guarded against disabled buttons');

  // An unknown entitlement is not "unpaid".
  const appLayout = read('apps/student-web/src/components/AppLayout.tsx');
  if (!/const known = !q\.isLoading && !q\.isError && q\.data !== undefined;/.test(appLayout)) {
    bad('PlanGate does not require a *definite* plan answer — a failed query will paywall a paying student');
  } else ok('PlanGate acts only on a definite answer; an API error never paywalls a paying student');

  // fetch must have a deadline.
  const api = read('packages/api-client/src/index.ts');
  if (!/const TIMEOUT_MS = /.test(api) || !/ApiError\(408/.test(api)) {
    bad('the API client has no request deadline — a stalled request spins forever');
  } else ok('the API client times out and surfaces 408, so a stalled request shows an error with retry');
  if (!/UPLOAD_TIMEOUT_MS/.test(api)) bad('uploads share the short deadline and will be cancelled mid-file');
  else ok('uploads get their own, much longer deadline');

  // Every 404 is a page, so it has a page heading.
  for (const [p, file] of [['student', 'apps/student-web/src/pages/NotFound.tsx'], ['agency', 'apps/agency-web/src/pages/NotFound.tsx']]) {
    if (!/headingLevel=\{1\}/.test(read(file))) bad(`${p} 404 renders no <h1>`);
    else ok(`${p} 404 renders a real <h1>`);
  }

  // The radiogroup must behave like one.
  const prim = read('packages/ui/src/primitives.tsx');
  if (!/tabIndex=\{multiple \|\| i === activeIndex \? 0 : -1\}/.test(prim)) bad('OptionCards has no roving tabindex — a radiogroup with one tab stop per option');
  else if (!/ArrowRight|ArrowDown/.test(prim)) bad('OptionCards does not handle the arrow keys');
  else ok('OptionCards is a real radiogroup: one tab stop, arrow keys, Home/End');
}

/* ------------------------------------------------------------------ live: the measured invariants */

const stackUp = (await up(`${M}/`)) && (await up(`${S}/`));
if (!stackUp) {
  head('B–D. Live checks');
  bad(`the dev stack is not up (${M}, ${S}) — these are release-critical and are failed, not skipped`);
} else {
  const browser = await chromium.launch();

  head('B. Page-top rhythm — the floating header never crowds the first heading');
  {
    // The owner's optical targets, measured from the pill's real bottom edge.
    const BANDS = [[320, 28, 40], [360, 28, 40], [390, 28, 40], [430, 28, 40],
      [768, 36, 52], [1024, 36, 52], [1280, 48, 72], [1440, 48, 72], [1728, 48, 72]];
    const PAGES = ['/start?lang=ko', '/start?lang=en', '/universities?lang=ko'];
    for (const path of PAGES) {
      for (const [w, lo, hi] of BANDS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await ctx.newPage();
        try {
          await page.goto(`${M}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(500);
          const gap = await page.evaluate(() => {
            const h = document.querySelector('.kn-header')?.getBoundingClientRect();
            const t = document.querySelector('#main h1, #main h2')?.getBoundingClientRect();
            return h && t ? Math.round(t.top - h.bottom) : null;
          });
          if (gap == null) bad(`${path} @${w}: no header or no heading to measure`);
          else if (gap < lo || gap > hi) bad(`${path} @${w}: ${gap}px clear after the pill, want ${lo}–${hi}px`);
          else ok(`${path} @${w}: ${gap}px`);
        } catch (e) { bad(`${path} @${w}: ${String(e).slice(0, 70)}`); }
        await ctx.close();
      }
    }
  }

  head('C. Route scroll');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const y = () => page.evaluate(() => Math.round(window.scrollY));
    try {
      await page.goto(`${M}/?lang=ko`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      const bottom = await y();
      if (bottom < 400) bad(`home did not scroll (scrollY ${bottom}) — the rest of this section is meaningless`);

      await page.locator('.kn-cta a[data-cta="primary"]').first().click();
      await page.waitForURL(/\/start/, { timeout: 15000 });
      await page.waitForTimeout(500);
      const arrived = await y();
      if (arrived > 2) bad(`PUSH: /start opened at ${arrived}px after leaving home at ${bottom}px`);
      else ok(`PUSH: /start opens at the top (home was at ${bottom}px)`);

      await page.goBack();
      await page.waitForTimeout(900);
      const back = await y();
      if (Math.abs(back - bottom) > 250) bad(`POP: home returned to ${back}px, left at ${bottom}px`);
      else ok(`POP: home returned to ${back}px (left at ${bottom}px)`);

      await page.goto(`${M}/?lang=ko#faq`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1300);
      const hashY = await y();
      if (hashY < 300) bad(`HASH: /#faq landed at ${hashY}px instead of the FAQ`);
      else ok(`HASH: /#faq lands on the section (${hashY}px)`);

      await page.goto(`${M}/universities`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(400);
      const beforeLang = await y();
      await page.evaluate(() => {
        window.history.pushState({}, '', '/universities?lang=en');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(700);
      const afterLang = await y();
      if (Math.abs(afterLang - beforeLang) > 120) bad(`?lang= jumped the reader from ${beforeLang}px to ${afterLang}px`);
      else ok(`?lang= keeps the reader in place (${beforeLang} → ${afterLang})`);
    } catch (e) { bad(`route scroll: ${String(e).slice(0, 90)}`); }
    await ctx.close();
  }

  head('D. Every public route renders clean');
  {
    const ROUTES = ['/', '/start', '/universities', '/privacy', '/terms', '/definitely-not-a-page'];
    for (const w of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      for (const r of ROUTES) {
        const errs = [];
        const onC = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); };
        const onP = (e) => errs.push(`UNCAUGHT ${String(e).slice(0, 120)}`);
        page.on('console', onC); page.on('pageerror', onP);
        try {
          await page.goto(`${M}${r}`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(700);
          const probe = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return {
              chars: text.trim().length,
              overflow: document.documentElement.scrollWidth > window.innerWidth + 2
                ? `${document.documentElement.scrollWidth}>${window.innerWidth}` : '',
              rawKeys: (text.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+){2,}\b/g) || [])
                .filter((k) => !/\.(com|kr|net|org|io|pdf|png|jpg|svg)$/.test(k)).slice(0, 3),
              deadCta: [...document.querySelectorAll('a[data-cta="primary"]')]
                .filter((a) => !a.getAttribute('href')).length,
            };
          });
          const f = [];
          if (probe.chars < 60) f.push('renders almost nothing');
          if (probe.overflow) f.push(`horizontal overflow ${probe.overflow}`);
          if (probe.rawKeys.length) f.push(`raw key(s) ${probe.rawKeys.join(',')}`);
          if (probe.deadCta) f.push(`${probe.deadCta} primary CTA(s) with no href`);
          if (errs.length) f.push(`console: ${errs[0]}`);
          if (f.length) bad(`${r} @${w}: ${f.join(' · ')}`);
          else ok(`${r} @${w}`);
        } catch (e) { bad(`${r} @${w}: ${String(e).slice(0, 70)}`); }
        page.off('console', onC); page.off('pageerror', onP);
      }
      await ctx.close();
    }
  }
  await browser.close();
}

/* ------------------------------------------------------------------ artifacts */

head('E. No localhost in a shippable asset');
{
  const dirs = ['dist-review'];
  let found = 0; let scanned = 0;
  const walk = (dir) => {
    if (!existsSync(join(ROOT, dir))) return;
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|css|html|json)$/.test(e.name)) {
        scanned++;
        const txt = readFileSync(join(ROOT, rel), 'utf8');
        if (/localhost:(3100|3101|3102|3103|8001)/.test(txt)) { found++; bad(`${rel} names a localhost dev origin`); }
      }
    }
  };
  for (const d of dirs) walk(d);
  if (!scanned) skip('dist-review is not built — run `npm run review:build`');
  else if (!found) ok(`${scanned} review-bundle files scanned, no localhost origin`);
}

head('F. The native artifacts match the source they were built from');
{
  /*
   * `qa:v18` verifies that each listed SHA256 matches the binary on disk and that BUILD_INFO is complete.
   * Both can be true of a binary built from code that no longer exists: V18 itself noted an Android
   * status-bar fix landing *after* the artifact was built, and V19 changed `packages/api-client` — which
   * the native app bundles — after these same artifacts were produced. Nothing in the suite could see it.
   *
   * So: compare the recorded build time against the newest source file the bundle actually includes. This
   * is expected to FAIL until the artifacts are rebuilt, and it should: a release check that goes green
   * while the shipped binary predates the code is the failure mode this whole pass is about.
   */
  const info = 'result/student-mobile/metadata/BUILD_INFO.json';
  if (!existsSync(join(ROOT, info))) {
    skip('no BUILD_INFO.json — nothing has been built');
  } else {
    const meta = JSON.parse(read(info));
    const builtAt = Date.parse(meta.builtAt);
    // Everything the native bundle compiles: the app itself, and the shared packages it imports.
    const ROOTS = [
      'apps/student-mobile/app', 'apps/student-mobile/src', 'apps/student-mobile/app.json',
      'packages/api-client/src', 'packages/types/src', 'packages/i18n/src', 'packages/i18n/locales',
      'packages/mobile-ui/src', 'packages/utils/src', 'packages/validation/src', 'packages/design-tokens/src',
    ];
    let newest = 0; let newestPath = '';
    const walk = (rel) => {
      const abs = join(ROOT, rel);
      if (!existsSync(abs)) return;
      const st = statSync(abs);
      if (st.isDirectory()) { for (const e of readdirSync(abs)) walk(`${rel}/${e}`); return; }
      if (!/\.(ts|tsx|js|jsx|json|mjs)$/.test(rel)) return;
      if (st.mtimeMs > newest) { newest = st.mtimeMs; newestPath = rel; }
    };
    for (const r of ROOTS) walk(r);
    if (!newest) bad('could not read any native source to compare against');
    else if (newest > builtAt) {
      const hrs = ((newest - builtAt) / 3_600_000).toFixed(1);
      bad(`the Android artifacts predate their source by ${hrs}h — newest change: ${newestPath}. `
        + `Rebuild and recompute the checksums (REPORT §194.3).`);
    } else ok(`the Android artifacts are newer than every source they bundle (newest: ${newestPath})`);
  }
}

console.log(`\n────────────────────────────────────────────────────────────────────────`);
console.log(`V19 gate: ${failed ? `\x1b[31m${passed} passed, ${failed} failed` : `\x1b[32m${passed} passed, 0 failed`}\x1b[0m, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
