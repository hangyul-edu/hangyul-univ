/**
 * Page-surface and hero-structure gate (V14 final pass, brief Part 12 of the continuation).
 *
 * Two things this asserts that no other gate does, and one it deliberately does not.
 *
 * **The page is white.** V14's first pass put the whole site on a warm off-white (#FDFAF7) and the owner's
 * verdict was that a page-wide pale orange reads as a weak tinted rectangle. The page is now `#FFFFFF`, with
 * warmth surviving only as a short atmospheric bridge below the hero. That is easy to undo by accident — one
 * `background` on one band brings the cream/white rhythm back a section at a time — so every major content
 * surface is measured, in paint, at several points down the page.
 *
 * **The hero is three groups, not one block.** The owner's report was that the supporting copy and the
 * buttons read as one compressed block. Spacing is checked numerically by `v13-composition.mjs`; what is
 * checked here is the structure that spacing depends on — that the copy and the actions are still separate
 * elements with the right labels, so a future refactor cannot merge them and quietly satisfy a margin rule.
 *
 * **What it does not do** is score beauty. There is no assertion here about whether the page looks good; that
 * judgement is in the screenshots `scripts/qa/v14-compose-shots.mjs` produces, and it belongs to a person.
 *
 *   node scripts/qa/v14-surface.mjs
 *   BASE=http://localhost:4720 node scripts/qa/v14-surface.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = (process.env.WIDTHS ?? '390,1440').split(',').map(Number);

/** Classes that painted a tint in V13 / V14-a. None may appear on the homepage again. */
const RETIRED_SURFACE_CLASSES = ['kn-band--tint', 'kn-band--glow', 'kn-card'];

const problems = [];
const ok = (s) => console.log(`  ✓ ${s}`);

/** "#fdfaf7" / "rgb(253, 250, 247)" → [253,250,247]; transparent → null. */
function rgb(value) {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
  if (a === 0) return null;
  return [r, g, b];
}

const browser = await chromium.launch();

for (const width of WIDTHS) {
  console.log(`\n=== ${width}px ===`);
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(700);

  // ---- hero structure
  const hero = await page.evaluate(() => {
    const lede = document.querySelector('.kn-hero__lede');
    const actions = document.querySelector('.kn-hero__actions');
    const title = document.querySelector('.kn-hero__title');
    const btns = [...document.querySelectorAll('.kn-hero__actions .kn-btn')];
    return {
      hasTitle: !!title, hasLede: !!lede, hasActions: !!actions,
      // The copy must not *contain* the actions: that is the "one compressed block" failure in DOM form.
      ledeContainsActions: !!(lede && actions && lede.contains(actions)),
      sameNode: lede === actions,
      actionsTopGap: lede && actions ? Math.round(actions.getBoundingClientRect().top - lede.getBoundingClientRect().bottom) : null,
      titleGap: title && lede ? Math.round(lede.getBoundingClientRect().top - title.getBoundingClientRect().bottom) : null,
      labels: btns.map((b) => b.innerText.trim()),
      primaryIsFirst: btns[0]?.classList.contains('kn-btn--primary') ?? false,
      actionGap: actions ? parseFloat(getComputedStyle(actions).gap) : null,
    };
  });

  for (const [k, what] of [['hasTitle', 'headline'], ['hasLede', 'supporting copy'], ['hasActions', 'CTA group']]) {
    if (!hero[k]) problems.push(`${width}: the hero has no ${what}`);
  }
  if (hero.ledeContainsActions || hero.sameNode) {
    problems.push(`${width}: the supporting copy and the CTA group are not separate elements — spacing between them cannot exist`);
  } else ok('copy and CTA group are separate DOM groups');

  // "Meaningful" = the brief's floor for the large break, and visibly larger than the small break above it.
  if (hero.actionsTopGap === null || hero.actionsTopGap < 28) {
    problems.push(`${width}: copy → CTA gap is ${hero.actionsTopGap}px, expected at least 28px`);
  } else if (hero.titleGap !== null && hero.actionsTopGap < hero.titleGap * 1.25) {
    problems.push(`${width}: copy → CTA ${hero.actionsTopGap}px is not visibly larger than headline → copy ${hero.titleGap}px (needs 1.25x)`);
  } else ok(`hero rhythm: headline → copy ${hero.titleGap}px, copy → CTA ${hero.actionsTopGap}px`);

  if (hero.actionGap === null || hero.actionGap < 12 || hero.actionGap > 20) {
    problems.push(`${width}: the two hero buttons sit ${hero.actionGap}px apart, expected 12–20px so they read as one group`);
  } else ok(`button gap ${hero.actionGap}px`);

  if (hero.labels[0] !== '내 유학 준비') problems.push(`${width}: the hero's primary action reads "${hero.labels[0]}", expected "내 유학 준비"`);
  if (hero.labels[1] !== '대학 둘러보기') problems.push(`${width}: the hero's secondary action reads "${hero.labels[1]}", expected "대학 둘러보기"`);
  if (!hero.primaryIsFirst) problems.push(`${width}: the first hero action is not the primary one`);
  if (hero.labels[0] === '내 유학 준비' && hero.labels[1] === '대학 둘러보기') ok('hero actions: 내 유학 준비 (primary) · 대학 둘러보기');

  // ---- surfaces
  const surfaces = await page.evaluate((retired) => {
    const paintedBg = (el) => {
      // Walk up until something actually paints: a transparent band sits on whatever is behind it.
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) {
          return { color: cs.backgroundColor, from: e.className.toString().slice(0, 40) || e.tagName };
        }
      }
      return { color: 'none', from: 'none' };
    };
    const out = { bands: {}, retiredFound: [] };
    for (const [id, sel] of [['page', '.kn'], ['marquee', '.kn-band--canvas'], ['value', '#why'],
      ['services', '#services'], ['faq', '#faq'], ['footer', '.kn-footer']]) {
      const el = document.querySelector(sel);
      out.bands[id] = el ? paintedBg(el) : null;
    }
    for (const cls of retired) if (document.querySelector(`.${cls}`)) out.retiredFound.push(cls);
    // The warm bridge must exist, and only on the first band below the hero.
    out.bridges = [...document.querySelectorAll('.kn-band--afterhero')].length;
    const first = document.querySelector('.kn-hero')?.nextElementSibling;
    out.bridgeIsFirstAfterHero = !!first?.classList?.contains('kn-band--afterhero');
    return out;
  }, RETIRED_SURFACE_CLASSES);

  for (const [id, s] of Object.entries(surfaces.bands)) {
    if (!s) { problems.push(`${width}: no ${id} surface found`); continue; }
    const c = rgb(s.color);
    if (!c) { problems.push(`${width}: ${id} paints nothing at all`); continue; }
    const white = c[0] === 255 && c[1] === 255 && c[2] === 255;
    if (!white) {
      problems.push(`${width}: the ${id} surface is ${s.color} (painted by .${s.from}), expected #FFFFFF — the page is white and orange is an accent, not a fill`);
    }
  }
  if (!problems.some((p) => p.startsWith(`${width}: the `) && p.includes('surface is'))) {
    ok(`every major surface paints #FFFFFF (page, marquee, value, services, FAQ, footer)`);
  }

  if (surfaces.retiredFound.length) {
    problems.push(`${width}: retired tint class(es) back on the homepage: ${surfaces.retiredFound.map((c) => `.${c}`).join(', ')}`);
  } else ok(`no retired tint classes (${RETIRED_SURFACE_CLASSES.map((c) => `.${c}`).join(', ')})`);

  if (surfaces.bridges !== 1) problems.push(`${width}: ${surfaces.bridges} warm bridges, expected exactly 1`);
  else if (!surfaces.bridgeIsFirstAfterHero) problems.push(`${width}: the warm bridge is not on the first band below the hero`);
  else ok('one warm bridge, on the first band below the hero');

  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.error(`\nSurface & hero gate: ${problems.length} problem(s)\n`);
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nSurface & hero gate: OK — the page is white, one warm bridge below the hero, hero copy and actions are separate groups with a visibly larger second pause.');
