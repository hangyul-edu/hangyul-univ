/**
 * V13 — composition-spacing gate (brief Parts 21, 22, 32).
 *
 * The defect this exists to prevent is invisible to every other gate in this repository. Nothing overflowed,
 * no console error fired, axe was clean and the visual sweep reported zero issues — while **eight of the
 * thirteen** composition-spacing rules on the public site were being silently discarded, because `rtlcss`
 * rewrites the Eduan template's element rules into `[dir] p` and `[dir] :where(.ed) :is(h1,…)`, which at
 * specificity (0,1,1) outrank any single-class rule at (0,1,0). The hero's description and its buttons ended
 * up flush against each other with an authored 32 px that resolved to 0.
 *
 * So this gate reads **computed** values off real pages and compares them to the design's stated intent. A
 * stylesheet that merely contains the right declaration does not pass.
 *
 *   node scripts/qa/v13-composition.mjs            # against the dev stack
 *   BASE=http://localhost:4600 node scripts/qa/v13-composition.mjs
 *
 * `range` is inclusive and expressed in px at the width being measured, because every composition token is
 * fluid; a single expected number would only ever be right at one viewport.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = (process.env.WIDTHS ?? '320,390,768,1024,1440,1728').split(',').map(Number);

/**
 * Brief Part 1's stated ranges are the outer bounds for the hero; the rest are this design system's own
 * decisions, recorded here so that changing one is a visible edit rather than a side effect.
 */
const RULES = [
  // V14 final pass: the two hero gaps were 30/36 — inside the old ranges and still reading as one block,
  // because a 20 % difference between two gaps separated by a line of text is not visible. The ratio is
  // what carries the hierarchy, so the ranges now sit apart rather than overlapping: 22–26 and 30–40.
  { route: '/', cls: 'kn-hero__title',      prop: 'marginBottom', range: [22, 26], why: 'headline → supporting copy (the small break)' },
  { route: '/', cls: 'kn-hero__lede',       prop: 'marginBottom', range: [30, 40], why: 'supporting copy → the actions that act on it (the large break)' },
  { route: '/', cls: 'kn-head__lede',       prop: 'marginTop',    range: [16, 16], why: 'section heading → its lede' },
  { route: '/', cls: 'kn-card__title',      prop: 'marginBottom', range: [12, 12], why: 'card heading → card copy' },
  { route: '/', cls: 'kn-mediarow__title',  prop: 'marginBottom', range: [16, 16], why: 'media-row heading → its copy' },
  { route: '/', cls: 'kn-cta__title',       prop: 'marginBottom', range: [12, 12], why: 'closing-band heading → its copy' },
  { route: '/', cls: 'kn-card__text',       prop: 'marginBottom', range: [0, 0],   why: 'copy that ends its group carries no trailing margin' },
  { route: '/', cls: 'kn-mediarow__text',   prop: 'marginBottom', range: [0, 0],   why: 'copy that ends its group carries no trailing margin' },
  { route: '/', cls: 'kn-cta__text',        prop: 'marginBottom', range: [0, 0],   why: 'copy that ends its group carries no trailing margin' },
  { route: '/', cls: 'kn-footer__statement',prop: 'marginBottom', range: [0, 0],   why: 'copy that ends its group carries no trailing margin' },
  { route: '/universities', cls: 'kn-head__title', prop: 'marginBottom', range: [0, 0], why: 'the lede owns the gap, from its own side' },
];

/**
 * The three parts of the hero must stay *ordered*: the break before the actions is always larger than the
 * break before the copy, or the group reads as one undifferentiated block however generous the numbers are.
 * This is the assertion that would have caught the original defect on its own.
 */
const ORDERING = { route: '/', a: 'kn-hero__title', b: 'kn-hero__lede' };

const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
let checked = 0;

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
  for (const route of [...new Set(RULES.map((r) => r.route))]) {
    await page.goto(`${BASE}${route}?lang=ko`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    for (const r of RULES.filter((x) => x.route === route)) {
      const v = await page.evaluate(([cls, prop]) => {
        const el = document.querySelector('.' + cls);
        return el ? parseFloat(getComputedStyle(el)[prop]) : null;
      }, [r.cls, r.prop]);
      if (v === null) continue;            // not rendered at this width — not a failure
      checked++;
      if (v < r.range[0] - 0.5 || v > r.range[1] + 0.5) {
        failures.push(`@${w} .${r.cls} ${r.prop} = ${v}px, expected ${r.range[0]}–${r.range[1]}px (${r.why})`);
      }
    }
  }
  await page.goto(`${BASE}${ORDERING.route}?lang=ko`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const [a, b] = await page.evaluate(([x, y]) => [x, y].map((c) => {
    const el = document.querySelector('.' + c);
    return el ? parseFloat(getComputedStyle(el).marginBottom) : null;
  }), [ORDERING.a, ORDERING.b]);
  if (a !== null && b !== null) {
    checked++;
    // V14: `b > a` is not enough. 30 > 24 satisfies it and still looks like one block — which is what the
    // owner reported after V14's first pass. The second pause must be *visibly* the larger one, so it has to
    // beat the first by a quarter rather than by a pixel.
    if (!(b >= a * 1.25)) {
      failures.push(`@${w} hero groups too close: copy→action ${b}px is not at least 1.25x headline→copy ${a}px`);
    }
  }
}

await browser.close();
if (failures.length) {
  console.error(`composition gate FAILED — ${failures.length} of ${checked} assertions\n`);
  for (const f of failures) console.error('  ✖ ' + f);
  process.exit(1);
}
console.log(`composition gate: OK — ${checked} computed-spacing assertions across ${WIDTHS.length} widths (${WIDTHS.join(', ')}px)`);
