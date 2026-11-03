/**
 * `npm run qa:v20` — the V20 gate (brief §59).
 *
 * Two halves, and both are needed:
 *
 *   **Static** — the data the product is built from: the registry count, the content record, the media
 *   manifest, the rights of every asset a page can render, and the design-system source. These run with
 *   no server and no browser, so they answer the same way in CI as on a laptop.
 *
 *   **Rendered** — the things only a browser knows: the computed foreground of a solid-tangerine control
 *   at rest, hover, focus and active; the headline price as the locale actually prints it; the detail
 *   page's section structure; lazy-loading attributes; horizontal overflow; console errors. §39 is
 *   explicit that source inspection alone is not evidence, and the V20 button defect is the reason —
 *   every declaration in the stylesheet was correct and the rendered button was still black-on-orange.
 *
 *   node scripts/qa/v20-gate.mjs [--static] [--no-browser]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const ARG = process.argv.slice(2);
const STATIC_ONLY = ARG.includes('--static') || ARG.includes('--no-browser');
/* `--part sweep|pages` and `--widths 390,1440` split the browser half so each run fits a bounded foreground window
 * (V22 completion, 6 GB host shared with another project). Without flags the gate runs exactly as before. */
const PART = (() => { const i = ARG.indexOf('--part'); return i >= 0 ? ARG[i + 1] : 'all'; })();
const WIDTHS = (() => { const i = ARG.indexOf('--widths'); return i >= 0 ? ARG[i + 1].split(',').map(Number) : [390, 1440]; })();

const fails = [];
const passes = [];
const check = (name, ok, detail = '') => { (ok ? passes : fails).push(`${name}${detail ? ` — ${detail}` : ''}`); };

/* ============================================================================== static: the content */

const registry = json('server/app/data/korean_institutions.json');
const institutions = registry.institutions;
const content = existsSync(join(ROOT, 'server/app/data/university_content.json'))
  ? json('server/app/data/university_content.json').records : {};
const credits = json('apps/marketing-web/src/media/credits.json');
const creditBySlug = new Map(credits.map((c) => [c.slug, c]));
// `ATTRIBUTION_SUPPORTED` joined this set in V21 (§15): a credited photograph is servable provided the
// credit is rendered beside it. `ATTRIBUTION_REQUIRED` deliberately stays out — it marks an asset whose
// credit Hangyul has not actually built a place for.
const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION',
  'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);

check('registry holds the canonical 425 institutions', institutions.length === 425, `${institutions.length}`);
check('every institution has a unique slug', new Set(institutions.map((i) => i.slug)).size === institutions.length);
check('every content record belongs to a registry institution',
  Object.keys(content).every((s) => institutions.some((i) => i.slug === s)),
  Object.keys(content).filter((s) => !institutions.some((i) => i.slug === s)).slice(0, 3).join(', '));

// §8 — the hard rule. One asset, one institution, and never a region photograph on an institution.
const owner = new Map();
let crossAssigned = 0;
let regionOnInstitution = 0;
for (const [slug, rec] of Object.entries(content)) {
  const shots = [rec.media?.hero, ...(rec.media?.gallery ?? [])].filter(Boolean);
  for (const m of shots) {
    if (m.kind === 'CITY' || m.kind === 'REGION_FALLBACK') regionOnInstitution += 1;
    if (m.university_id && m.university_id !== slug) crossAssigned += 1;
    const prior = owner.get(m.asset);
    if (prior && prior !== slug) crossAssigned += 1;
    owner.set(m.asset, slug);
  }
}
check('§8 no photograph is assigned to two institutions', crossAssigned === 0, `${crossAssigned} cross-assignment(s)`);
check('§8 no city/region photograph is attached to an institution', regionOnInstitution === 0, `${regionOnInstitution}`);

// §19 — a generic photograph must not be presented as a specific campus.
const regionAssets = new Set();
for (const m of read('packages/utils/src/university.ts').matchAll(/city\('([a-z0-9-]+)'/g)) regionAssets.add(m[1]);
check('§19 no region asset is used as an institution hero',
  [...owner.keys()].every((a) => !regionAssets.has(a)),
  [...owner.keys()].filter((a) => regionAssets.has(a)).join(', '));

// §7, §42 — rights, on every asset a page can render.
let unservableShot = 0;
let missingProvenance = 0;
for (const [slug, rec] of Object.entries(content)) {
  for (const m of [rec.media?.hero, ...(rec.media?.gallery ?? [])].filter(Boolean)) {
    const credit = creditBySlug.get(m.asset);
    if (!credit || !SERVABLE.has(credit.rights_status)) { unservableShot += 1; continue; }
    for (const f of ['media_source', 'license_or_permission', 'local_path']) if (!m[f]) missingProvenance += 1;
    // **Superseded by V21 §15.** V20 refused any photograph that needed a credit, which is why hero
    // coverage was 2 of 425: 676 of 718 Commons refusals were on licence alone (REPORT §234.1). A
    // credited photograph is now servable *on the condition that the credit renders*, so what is
    // checked here is that the credit is complete; that it reaches the page is `qa:v21`'s rendered
    // check, which reads the DOM rather than the record.
    const a = m.attribution_requirement;
    if (a && !(a.author && a.license && a.license_url && a.source_url)) unservableShot += 1;
    if (typeof m.focal_x !== 'number' || typeof m.focal_y !== 'number') missingProvenance += 1;
    void slug;
  }
  const logo = rec.logo;
  if (logo) {
    if (!SERVABLE.has(logo.rights_status)) unservableShot += 1;
    for (const f of ['media_source', 'license_or_permission', 'source', 'verified_at']) if (!logo[f]) missingProvenance += 1;
    // §213.2 — a logo must be Hangyul's own file, not a hot-link to someone else's origin.
    if (!logo.local_path || /^https?:/i.test(logo.url)) unservableShot += 1;
  }
}
check('§7 every rendered photograph is under a licence Hangyul may serve, with its credit complete',
  unservableShot === 0, `${unservableShot} asset(s) refused`);
check('§42 every rendered asset carries its provenance', missingProvenance === 0, `${missingProvenance} field(s) missing`);

// §9 — a logo keeps its own geometry, and its file is actually on disk.
let logoFileMissing = 0;
let logoGeometryMissing = 0;
for (const rec of Object.values(content)) {
  if (!rec.logo) continue;
  if (!rec.logo.width || !rec.logo.height) logoGeometryMissing += 1;
  for (const app of ['apps/marketing-web/public', 'apps/student-web/public']) {
    if (!existsSync(join(ROOT, app, rec.logo.local_path ?? ''))) { logoFileMissing += 1; break; }
  }
}
check('§9 every logo records its real proportions', logoGeometryMissing === 0, `${logoGeometryMissing}`);
check('§9 every logo file is present in both apps', logoFileMissing === 0, `${logoFileMissing} missing`);

// §16 — a channel is official or it is not stored.
let unverifiedChannel = 0;
let videoWithoutChannel = 0;
for (const rec of Object.values(content)) {
  const yt = rec.youtube;
  if (!yt) continue;
  // V23: `own-site-rendered` is the same own-site rule read from the rendered homepage (REPORT §279).
  if (!['own-site', 'own-site-rendered', 'wikidata:P2397'].includes(yt.verified_via)) unverifiedChannel += 1;
  if (yt.video_id && !yt.channel_id) videoWithoutChannel += 1;
}
check('§16 every stored channel records how ownership was verified', unverifiedChannel === 0, `${unverifiedChannel}`);
check('§16 no video is stored without its channel', videoWithoutChannel === 0, `${videoWithoutChannel}`);

// §25 — only a reviewed reading is allowed to render as prose.
const capturedRendered = Object.values(content).filter(
  (r) => r.education_philosophy?.summary_ko && r.education_philosophy.verification_status !== 'HANGYUL_REVIEWED',
).length;
check('§25 no unreviewed statement carries a Hangyul paraphrase', capturedRendered === 0, `${capturedRendered}`);

// §43 — internal QA metadata never reaches a customer surface.
const SURFACES = ['apps/marketing-web/src/pages/UniversityDetail.tsx', 'apps/marketing-web/src/pages/Universities.tsx', 'packages/ui/src/university.tsx'];
const LEAKS = /(["'>])\s*(Source URL|Verified at|verification_status|SOURCE_CAPTURED|Scraped from|Fixture|Sample data)\s*[:<]/i;
check('§43 no internal provenance label in the customer UI', SURFACES.every((f) => !LEAKS.test(read(f))));

/* ========================================================== static: the design system and the price */

const components = read('packages/ui/src/styles/components.css');
const koreanasha = read('packages/koreanasha-ui/src/scss/koreanasha.scss');
const eduanCommon = read('packages/eduan-ui/src/scss/eduan/abstracts/_common.scss');

check('§32 the Eduan anchor reset is scoped to the template',
  !/^\s*a:(focus|hover)\s*,?\s*$/m.test(eduanCommon.replace(/:where\(\.ed\) a:(focus|hover)/g, 'SCOPED')),
  'an unscoped a:hover/a:focus is back in _common.scss');
for (const state of ['link', 'visited', 'hover', 'focus', 'focus-visible', 'active']) {
  check(`§33 .kn-btn--primary declares its foreground on :${state}`, koreanasha.includes(`.kn-btn--primary:${state}`));
  check(`§33 .hg-btn--primary declares its foreground on :${state}`, components.includes(`.hg-btn--primary:${state}`));
}
check('§33 the primary icon follows currentColor', koreanasha.includes('.kn-btn--primary svg { color: currentColor; }')
  && components.includes('.hg-btn--primary svg { color: currentColor; }'));
check('§35 only the solid variant takes the light foreground',
  !/\.(kn|hg)-btn--(outline|ghost|soft|onphoto|link)[^{]*\{[^}]*color:\s*(#fff|white|var\(--hg-text-on-primary\))/i.test(`${components}${koreanasha}`));

// §34 — contrast, computed rather than asserted.
const hex = (s) => { const m = /#([0-9a-f]{6})/i.exec(s); return m ? m[1] : null; };
const tokens = read('packages/design-tokens/tokens.css');
const lum = (h) => {
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
for (const name of ['--hg-primary', '--hg-primary-hover', '--hg-primary-pressed']) {
  const value = hex(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)?.[1] ?? '');
  const ratio = value ? 1.05 / (lum(value) + 0.05) : 0;
  check(`§34 white on ${name} clears 4.5:1`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
}

// §38 — native.
const nativeButton = read('packages/mobile-ui/src/components/Button.tsx');
check('§38 native primary uses the light foreground token', nativeButton.includes('fg: theme.color.textOnPrimary'));
check('§38 native icons take the button foreground', (nativeButton.match(/color=\{p\.fg\}/g) ?? []).length >= 2);
check('§38 native disabled is a neutral surface, not faded brand',
  nativeButton.includes('const DISABLED') && nativeButton.includes('theme.color.surfaceSunken'));

// §2 / §58 — presentation only; the money model stays USD.
const utils = read('packages/utils/src/index.ts');
check('§2 formatMoney has a symbol-only headline mode', utils.includes('symbolOnly') && utils.includes("currencyDisplay: opts.symbolOnly ? 'narrowSymbol' : 'symbol'"));
check('§2 the marketing price card uses it', read('apps/marketing-web/src/pages/home/pricing.tsx').includes('symbolOnly: true'));
const plans = read('packages/types/src/plans.ts');
check('§2 the plan model is still explicitly USD', /currency:\s*'USD'/.test(plans) && (plans.match(/currency: 'USD'/g) ?? []).length >= 3);
check('§2 checkout and payment history keep the currency code',
  !/sv16-order__amount[\s\S]{0,400}symbolOnly/.test(read('apps/student-web/src/pages/Services.tsx')));

/* ================================================================================ rendered: browser */

const BASE = 'http://localhost:3100';
const STUDENT = 'http://localhost:3101';

if (!STATIC_ONLY) {
  const { chromium } = await import('@playwright/test');
  const ORANGE = [[204, 78, 0], [179, 68, 0], [158, 60, 0], [255, 103, 0]];
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[,/]/).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const near = (a, b, t = 30) => a.every((v, i) => Math.abs(v - b[i]) <= t);
  const isOrange = (c) => ORANGE.some((o) => near(c, o));
  const light = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) > 0.6;
  };

  const browser = await chromium.launch();
  const reachable = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (!reachable) {
    fails.push(`the marketing app is not answering on ${BASE} — run \`npm run dev\` first`);
  } else {
    /* ---- §31–§37, §57: the primary-button contract, in four states, in four products ---- */
    const SWEEPS = [
      ['marketing', BASE, null, ['/', '/universities', '/universities/kyung-hee-university', '/start']],
      ['student', STUDENT, 'student@demo.hangyul.kr', ['/', '/explore', '/services', '/documents', '/profile', '/settings']],
      ['agency', 'http://localhost:3102', 'counselor@lotus.demo.hangyul.kr', ['/', '/students', '/universities']],
      ['university', 'http://localhost:3103', 'admissions@pusan.univ.demo.hangyul.kr', ['/', '/applicants']],
    ];
    let badOrange = 0;
    const badDetail = [];
    for (const [app, base, email, routes] of PART === 'pages' ? [] : SWEEPS) {
      if (!(await fetch(base).then((r) => r.ok).catch(() => false))) { fails.push(`${app} is not answering on ${base}`); continue; }
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 } });
        const page = await ctx.newPage();
        if (email) {
          await page.goto(`${base}/login`, { waitUntil: 'networkidle' }).catch(() => {});
          await page.fill('#email', email).catch(() => {});
          await page.fill('#password', 'Hangyul!2026').catch(() => {});
          await page.click('button[type=submit]').catch(() => {});
          await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {});
        }
        for (const route of routes) {
          await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(500);
          /**
           * Which controls get the four-state probe.
           *
           * Everything visible is measured at **rest**; the hover/focus/active probe — which costs a
           * real pointer move per element per state — runs on the controls that can plausibly be
           * tangerine: anything already tangerine, and anything carrying a button or CTA class. A
           * control with neither cannot acquire a brand background from a hover rule that does not
           * exist, and probing all ~70 controls on every route in four products at two widths took
           * the gate past half an hour. The unfiltered sweep lives in `scripts/qa/v20/_orange-probe.mjs`
           * for when the question is "has something new started turning orange".
           */
          for (const h of await page.$$('a,button,[role="button"]')) {
            let box;
            try { box = await h.boundingBox(); } catch { continue; }
            if (!box || box.width < 4 || box.height < 4) continue;
            let candidate = false;
            try {
              candidate = await h.evaluate((el) => {
                const cs = getComputedStyle(el);
                const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cs.backgroundColor);
                const rgb = m ? [+m[1], +m[2], +m[3]] : null;
                const orange = rgb && [[204, 78, 0], [179, 68, 0], [158, 60, 0], [255, 103, 0]]
                  .some((o) => rgb.every((v, i) => Math.abs(v - o[i]) <= 30));
                return !!orange || /\b(btn|cta|action|primary)\b|btn--|__cta/i.test(String(el.className));
              });
            } catch { continue; }
            for (const state of candidate ? ['rest', 'hover', 'focus', 'active'] : ['rest']) {
              try {
                if (state === 'hover') await h.hover({ timeout: 1500 });
                else if (state === 'focus') { await page.mouse.move(0, 0); await h.focus({ timeout: 1500 }); }
                else if (state === 'active') { await page.mouse.move(0, 0); await h.hover({ timeout: 1500 }); await page.mouse.down(); }
                const got = await h.evaluate((el) => {
                  const cs = getComputedStyle(el); const svg = el.querySelector('svg');
                  return { bg: cs.backgroundColor, fg: cs.color, svg: svg ? getComputedStyle(svg).color : null, cls: String(el.className).slice(0, 70), text: (el.textContent || '').trim().slice(0, 30) };
                });
                if (state === 'active') await page.mouse.up();
                const bg = parse(got.bg); const fg = parse(got.fg);
                if (!bg || !fg || bg.a < 0.9 || !isOrange(bg.rgb)) continue;
                if (!light(fg.rgb)) { badOrange += 1; badDetail.push(`${app} ${width} ${route} ${state} "${got.text}" ${got.fg}`); }
                const sv = got.svg ? parse(got.svg) : null;
                if (sv && !light(sv.rgb)) { badOrange += 1; badDetail.push(`${app} ${width} ${route} ${state}:icon "${got.text}" ${got.svg}`); }
              } catch { /* detached between states */ }
            }
          }
        }
        await ctx.close();
      }
    }
    if (PART !== 'pages') check(`§57 zero solid-orange controls with a dark label or icon, at rest/hover/focus/active (widths ${WIDTHS.join('/')})`,
      badOrange === 0, badDetail.slice(0, 6).join(' | '));

    /* ---- §58: the headline price, as every locale actually prints it ---- */
    const LOCALES = PART === 'sweep' ? [] : readdirSync(join(ROOT, 'packages/i18n/locales')).filter((d) => !d.startsWith('_'));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    const badPrice = [];
    for (const lang of LOCALES) {
      await page.goto(`${BASE}/?lang=${lang}#pricing`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(250);
      const prices = await page.$$eval('.kn-plan__price .hg-num', (els) => els.map((e) => e.textContent.trim()));
      if (prices.length !== 3) { badPrice.push(`${lang}: ${prices.length} prices`); continue; }
      for (const p of prices) if (/US\s?\$|USD|\$\s?US/i.test(p)) badPrice.push(`${lang}: ${p}`);
    }
    check(`§58 no "US$"/"USD" beside a headline price in any of ${LOCALES.length} locales`, badPrice.length === 0, badPrice.slice(0, 6).join(', '));

    /* ---- §12, §48, §53: the university detail page, rendered ---- */
    /*
     * One institution per tier, **derived from the content record** rather than named.
     *
     * These used to be three hardcoded slugs, and both of them went stale in V21: `kyungsung-university`
     * gained a real photograph and so resolves A rather than B — an improvement the gate reported as a
     * failure — and `D_TYPOGRAPHIC` was renamed `D_IDENTITY` when the monogram was deleted. A fixture
     * that names the institution asserts the fixture; what is worth asserting is that **each tier still
     * resolves**, so the representative is chosen from the data in the resolver's own precedence order.
     */
    const tierOf = (rec) => (rec?.media?.hero ? 'A_LICENSED_PHOTO'
      : rec?.youtube?.video_id ? 'B_OFFICIAL_VIDEO'
        : rec?.logo ? 'C_LOGO' : 'D_IDENTITY');
    const pick = (tier) => Object.keys(content).sort().find((slug) => tierOf(content[slug]) === tier);
    const CASES = ['A_LICENSED_PHOTO', 'B_OFFICIAL_VIDEO', 'C_LOGO', 'D_IDENTITY']
      .map((tier) => [pick(tier), tier])
      .filter(([slug]) => !!slug);
    check('§19 every visual tier has at least one institution to check', CASES.length === 4,
      `${CASES.length} of 4 tiers represented`);
    for (const [slug, expectTier] of PART === 'sweep' ? [] : CASES) {
      await page.goto(`${BASE}/universities/${slug}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(600);
      const got = await page.evaluate(() => {
        const hero = document.querySelector('.hg-uni-hero');
        const imgs = [...document.querySelectorAll('img')];
        return {
          tier: hero?.dataset.tier ?? null,
          h1: document.querySelectorAll('h1').length,
          sections: [...document.querySelectorAll('section[aria-labelledby]')].length,
          eagerBelowFold: imgs.filter((i) => i.loading !== 'lazy' && i.getBoundingClientRect().top > window.innerHeight).length,
          iframes: document.querySelectorAll('iframe').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          altMissing: imgs.filter((i) => i.alt === undefined || i.alt === null).length,
          cta: !!document.querySelector('.hg-uni-hero .kn-btn--primary'),
        };
      });
      check(`§19 ${slug} resolves to ${expectTier}`, got.tier === expectTier, `got ${got.tier}`);
      check(`§53 ${slug} has exactly one h1`, got.h1 === 1, `${got.h1}`);
      check(`§12 ${slug} composes named sections`, got.sections >= 3, `${got.sections}`);
      check(`§48 ${slug} loads nothing below the fold eagerly`, got.eagerBelowFold === 0, `${got.eagerBelowFold}`);
      check(`§17 ${slug} embeds no YouTube iframe before the click`, got.iframes === 0, `${got.iframes}`);
      check(`§47 ${slug} has no horizontal overflow at 1440`, got.overflow <= 1, `${got.overflow}px`);
      check(`§10 ${slug} offers one call to action above the fold`, got.cta);
    }

    /* ---- mobile: the same pages at 390, plus console errors ---- */
    const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await mob.newPage();
    const consoleErrors = [];
    mp.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    mp.on('pageerror', (e) => consoleErrors.push(`UNCAUGHT ${String(e).slice(0, 160)}`));
    for (const route of PART === 'sweep' ? [] : ['/universities', '/universities/kyung-hee-university', '/universities/anyang-university']) {
      await mp.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await mp.waitForTimeout(500);
      const o = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`§47 ${route} has no horizontal overflow at 390`, o <= 1, `${o}px`);
    }
    check('§59 no console error on the university surfaces', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    await mob.close();
    await ctx.close();
  }
  await browser.close();
}

/* ======================================================================================== the verdict */

console.log(`\nV20 gate — ${passes.length} passed, ${fails.length} failed\n`);
for (const f of fails) console.log(`  ✖ ${f}`);
if (!fails.length) console.log('  all checks passed');
console.log('');
process.exit(fails.length ? 1 : 0);
