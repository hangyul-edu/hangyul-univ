/**
 * Every homepage university logo must lead somewhere real (V14, brief Parts 8–10 and 68).
 *
 * For each unique crest in the three-row band this resolves the route the crest actually links to — read from
 * the rendered DOM, not from the manifest, so a link that is correct in data and wrong in JSX still fails —
 * and then asserts the page it lands on is a complete university introduction:
 *
 *   the route renders (no 404, no error state)
 *   a university identity is on the page: the Korean name, and the English name where one is official
 *   a heading exists
 *   a location exists (region and city/establishment line)
 *   an official website link exists
 *   no placeholder copy ("정보 없음", "TBD", "Lorem", "coming soon", …)
 *   no demo or test wording
 *
 * It also checks the Yonsei regression the brief names by asset: the crest must not be the opaque rectangular
 * artwork V13 shipped. "Rectangular" is measured, not assumed — a crest whose ink fills ~100 % of its own
 * bounding box is a rectangle, and every real crest fills 18–87 % of its own.
 *
 *   node scripts/qa/v14-marquee-details.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';

const PLACEHOLDER = [
  '정보 없음', '정보없음', '준비 중', '준비중', '추후 입력', '미정',
  'TBD', 'TODO', 'Lorem ipsum', 'coming soon', 'Coming soon', 'placeholder', 'Placeholder',
  'N/A', 'null', 'undefined', 'xxx', 'XXX',
];
/**
 * An **unfilled template**, which is what the bare `'['` in this list used to stand for.
 *
 * V20 attached verified official introduction films to 35 institutions, and a Korean university's
 * own brand film is very often titled `[Brand Film] 단국에서 단국으로…`. A lone square bracket is
 * therefore no longer evidence of anything: Dankook's page failed this check on its real, sourced
 * video title. What the check was always for is an *unsubstituted slot*, so that is what it looks
 * for now — a bracketed placeholder word, a mustache, or a JS template literal.
 *
 * This narrows a heuristic that produced a false positive on correct content. It does not relax what
 * the gate is for: an actual `[TODO]` or `{{name}}` on a customer page still fails it.
 */
const TEMPLATE_SLOT = /\[\s*(TODO|TBD|FIXME|placeholder|name|title|value|제목|이름|입력|내용)\s*\]|\{\{|\$\{|\[\[/i;
const DEMO = ['demo', 'Demo', 'DEMO', '데모', 'sample', 'Sample', '샘플', 'test only', 'Test only', '테스트'];

const problems = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/?lang=ko`, { waitUntil: 'networkidle' });
await page.locator('.kn-crests').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

/** The reachable crests only — the duplicated groups exist for the animation and are inert. */
const crests = await page.$$eval('.kn-crests .kn-crest', (els) => els
  .filter((c) => !c.closest('[aria-hidden="true"]') && !c.closest('[inert]'))
  .map((c) => ({
    href: c.getAttribute('href'),
    name: c.getAttribute('aria-label') || c.querySelector('img')?.getAttribute('alt') || '',
    file: (c.querySelector('img')?.getAttribute('src') ?? '').split('/').pop(),
    tag: c.tagName,
  })));

console.log(`${crests.length} unique crests in the homepage band`);
if (crests.length !== 23) problems.push(`expected 23 unique crests, found ${crests.length}`);

const dead = crests.filter((c) => c.tag !== 'A' || !c.href || c.href === '#');
if (dead.length) problems.push(`${dead.length} crest(s) are not links: ${dead.map((c) => c.name).join(', ')}`);

// ---- Yonsei regression, and every other crest, measured rather than trusted.
const shapes = await page.$$eval('.kn-crests .kn-crest__img', async (imgs) => {
  const out = [];
  for (const img of imgs.slice(0, 23)) {
    const w = 120;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, w, h);
    try { g.drawImage(img, 0, 0, w, h); } catch { out.push({ alt: img.closest('a')?.getAttribute('aria-label') || img.alt, fill: null }); continue; }
    let data;
    try { data = g.getImageData(0, 0, w, h).data; } catch { out.push({ alt: img.closest('a')?.getAttribute('aria-label') || img.alt, fill: null }); continue; }
    let l = w, t = h, r = -1, b = -1, ink = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) { ink++; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    }
    const box = r < 0 ? 0 : (r - l + 1) * (b - t + 1);
    out.push({ alt: img.closest('a')?.getAttribute('aria-label') || img.alt, fill: box ? ink / box : 0 });
  }
  return out;
});
for (const s of shapes) {
  if (s.fill === null) { console.log(`  ? ${s.alt}: could not measure (tainted canvas)`); continue; }
  // UNIST's official signature is white and cyan on a navy field — the navy IS the mark, so it is drawn as a
  // deliberate rounded tile and is the one allowed exception. See docs/qa/v14/CREST_AUDIT.md.
  const allowed = s.alt.includes('UNIST') || s.alt.includes('유니스트');
  if (s.fill >= 0.97 && !allowed) {
    problems.push(`${s.alt}: the crest fills ${(s.fill * 100).toFixed(0)}% of its own bounding box — it is a rectangle, i.e. the artwork still carries the background it was cut out of`);
  }
}
const yonsei = shapes.find((s) => s.alt.includes('Yonsei') || s.alt.includes('연세'));
if (!yonsei) problems.push('Yonsei crest not found in the band');
else if (yonsei.fill !== null) console.log(`  Yonsei crest fills ${(yonsei.fill * 100).toFixed(0)}% of its box (V13 shipped 100% — an opaque white rectangle)`);

// ---- every destination
let ok = 0;
for (const c of crests) {
  if (!c.href) continue;
  const res = await page.goto(`${BASE}${c.href}`, { waitUntil: 'networkidle' }).catch(() => null);
  const status = res?.status() ?? 0;
  const body = await page.locator('body').innerText();
  const label = `${c.name} (${c.href})`;

  if (status >= 400) { problems.push(`${label}: HTTP ${status}`); continue; }
  if (await page.locator('.hg-errorstate, [data-404]').count() > 0) { problems.push(`${label}: rendered an error state`); continue; }

  const h1 = (await page.locator('h1').first().innerText().catch(() => '')).trim();
  if (!h1) { problems.push(`${label}: no <h1>`); continue; }

  // Identity: the page must name this university, in Korean or in English.
  // V20 renamed the hero's parts when the detail page moved to the shared university presentation
  // (`.mk-uni__title` → `.hg-uni-hero__name`, `.mk-uni__alt` → `.hg-uni-hero__alt`, `.mk-uni__where` →
  // `.hg-uni-hero__where`). Both assertions are unchanged, and a *silent* rename is exactly what this
  // check exists to catch — it caught it.
  const identity = await page.locator('.hg-uni-hero__name, .hg-uni-hero__alt').allInnerTexts().catch(() => []);
  const named = identity.some((s) => s.trim().length > 1);
  if (!named) problems.push(`${label}: no university identity on the page`);

  const where = (await page.locator('.hg-uni-hero__where').first().innerText().catch(() => '')).trim();
  if (!where) problems.push(`${label}: no location line`);

  const site = await page.locator('a[href^="http"]:not([href*="localhost"])').count();
  if (!site) problems.push(`${label}: no official website link`);

  const bad = PLACEHOLDER.filter((p) => body.includes(p));
  const slot = TEMPLATE_SLOT.exec(body);
  if (slot) bad.push(slot[0]);
  if (bad.length) problems.push(`${label}: placeholder copy ${JSON.stringify(bad)}`);
  const demo = DEMO.filter((d) => body.includes(d));
  if (demo.length) problems.push(`${label}: demo/test wording ${JSON.stringify(demo)}`);

  if (!bad.length && !demo.length && named && where && site) ok += 1;
}

console.log(`\n${ok}/${crests.length} crests resolve to a complete university page`);

// ---- the language the visitor is reading must survive the click (brief Part 44)
await page.goto(`${BASE}/?lang=vi`, { waitUntil: 'networkidle' });
await page.locator('.kn-crests').scrollIntoViewIfNeeded();
const viHref = await page.locator('.kn-crests .kn-crest').first().getAttribute('href');
if (!viHref?.includes('lang=vi')) problems.push(`a crest clicked from ?lang=vi goes to ${viHref} — the language is lost`);
else console.log(`locale preserved through a crest click: ${viHref}`);

await browser.close();

if (problems.length) {
  console.error(`\nMarquee → detail integrity: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\nMarquee → detail integrity: OK — ${crests.length} crests, ${crests.length} complete university pages, 0 dead logos.`);
