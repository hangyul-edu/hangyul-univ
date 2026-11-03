// RETIRED in V29 (2026-10-30): this gate asserts the V15 plan contract (30/60/90-minute consultations, 1/2 edit rounds),
// which the owner replaced. `npm run qa:pricing` / `qa:entitlements` now run scripts/qa/v29/plans.mjs. Kept as history; do not run.
/**
 * V15 pricing gate — the price is the same number everywhere, and the old model is gone.
 *
 * Before V15 three places held their own figures: the homepage, the student service page and the server's
 * seeded products. Nothing stopped them drifting. The manifest fixed that structurally; this gate exists to
 * prove it on every run rather than to assert it in a comment.
 *
 * Four sources must agree:
 *   1  packages/types/src/plans.ts   the manifest (the source of truth)
 *   2  shared/plans.json             what was generated from it, and what the Python seed reads
 *   3  GET /api/v1/public/plans      what the database actually holds
 *   4  the rendered homepage         what a visitor is told
 *
 * It also fails on any trace of the retired packages in shipped UI, because "we replaced the pricing model"
 * is only true if the old one cannot be reached.
 *
 *   node scripts/qa/v15-pricing.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MARKETING = process.env.MARKETING ?? 'http://localhost:3100';
const API = process.env.API ?? 'http://localhost:8001';

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fail.push(m); console.log(`  ✖ ${m}`); };

// ---------------------------------------------------------------------------------- 1 + 2: manifest ↔ json
const { PLANS, COMPARE_ROWS } = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/plans.ts')).href);
const shared = JSON.parse(readFileSync(resolve(ROOT, 'shared/plans.json'), 'utf8'));

/**
 * The business plan's own numbers, written out here so the gate does not read them from the thing it checks.
 *
 * **V17 repriced the product in USD** (owner decision, REPORT §152): $179 / $349 / $599, held in cents
 * because USD has a minor unit. These are *fixed list prices*, not a conversion of the won figures the
 * plan document originally carried — so the gate asserts the new numbers directly rather than deriving
 * them, which is the same reason it has ever written them out at all.
 *
 * The entitlements are unchanged: V17 changed what a plan costs, not what it is.
 */
const PLAN_DOC = {
  BASIC: { amount: 17_900, consult: 30, recommend: 3, managed: 0, essay: 0, mock: 0, arrival: 0 },
  ALL_IN_ONE: { amount: 34_900, consult: 60, recommend: 5, managed: 2, essay: 1, mock: 0, arrival: 0 },
  PREMIUM: { amount: 59_900, consult: 90, recommend: 7, managed: 3, essay: 2, mock: 1, arrival: 30 },
};
const CURRENCY = 'USD';
/** What a card should read. Cents are a storage unit; `$349` is the price (REPORT §155). */
const displayed = (minor) => String(Math.round(minor / 100));

console.log('=== the manifest against the business plan (한귤 UNIV_20261019 §3, 플랜별 비교표) ===');
for (const [code, want] of Object.entries(PLAN_DOC)) {
  const p = PLANS.find((x) => x.code === code);
  if (!p) { bad(`${code}: missing from the manifest`); continue; }
  const e = p.entitlements;
  const checks = [
    ['price', p.amount_minor, want.amount], ['currency', p.currency, CURRENCY],
    ['consultation_minutes', e.consultation_minutes, want.consult],
    ['max_recommended_institutions', e.max_recommended_institutions, want.recommend],
    ['max_managed_applications', e.max_managed_applications, want.managed],
    ['essay_review_rounds', e.essay_review_rounds, want.essay],
    ['mock_interviews', e.mock_interviews, want.mock],
    ['post_arrival_support_days', e.post_arrival_support_days, want.arrival],
  ];
  const wrong = checks.filter(([, got, exp]) => got !== exp);
  if (wrong.length) wrong.forEach(([k, got, exp]) => bad(`${code}.${k}: ${got}, expected ${exp}`));
  else ok(`${code}: ₩${want.amount.toLocaleString()} · ${want.consult} min · ${want.recommend} recommended · ${want.managed} managed · ${want.essay} review round(s) · ${want.mock} mock · ${want.arrival} day(s)`);
}
if (PLANS.filter((p) => p.recommended).length !== 1) bad('exactly one plan must be the recommended one (business plan §9: 주력 상품 = 올인원)');
else if (PLANS.find((p) => p.recommended).code !== 'ALL_IN_ONE') bad('the recommended plan must be ALL_IN_ONE');
else ok('ALL_IN_ONE is the one recommended plan');

console.log('\n=== shared/plans.json is in step with the manifest ===');
try {
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/plans/sync.mjs'), '--check'], { stdio: 'pipe' });
  ok('shared/plans.json regenerates byte-identically');
} catch (e) {
  bad(`shared/plans.json is stale — run \`npm run plans:sync\` (${String(e.stderr || '').trim().split('\n').pop()})`);
}
for (const p of PLANS) {
  const s = shared.plans.find((x) => x.code === p.code);
  if (!s || s.amount_minor !== p.amount_minor) bad(`${p.code}: shared/plans.json says ${s?.amount_minor}, manifest says ${p.amount_minor}`);
}

// ------------------------------------------------------------------------------------------ 3: the API
console.log('\n=== the API serves what the seed wrote ===');
let api = null;
try {
  const r = await fetch(`${API}/api/v1/public/plans`);
  api = (await r.json()).plans;
} catch (e) { bad(`GET /public/plans failed: ${e.message}`); }
if (api) {
  for (const p of PLANS) {
    const a = api.find((x) => x.code === p.code);
    if (!a) { bad(`${p.code}: not served by the API`); continue; }
    if (a.price?.amount_minor !== p.amount_minor) bad(`${p.code}: API ₩${a.price?.amount_minor}, manifest ₩${p.amount_minor}`);
    else if (a.price?.currency !== p.currency) bad(`${p.code}: API currency ${a.price?.currency}`);
    // The prices are approved business inputs now, which is what release:check's `approved_prices` reads.
    else if (a.price?.is_demo) bad(`${p.code}: still flagged as a sample price (is_demo)`);
    else ok(`${p.code}: API agrees — ₩${a.price.amount_minor.toLocaleString()}, approved`);
    for (const [k, v] of Object.entries(p.entitlements)) {
      if (JSON.stringify(a.entitlements?.[k]) !== JSON.stringify(v)) bad(`${p.code}.${k}: API ${JSON.stringify(a.entitlements?.[k])}, manifest ${JSON.stringify(v)}`);
    }
  }
  const extra = api.filter((a) => !PLANS.some((p) => p.code === a.code));
  if (extra.length) bad(`the API serves plans the manifest does not know: ${extra.map((x) => x.code).join(', ')}`);
}

// ------------------------------------------------------------------------- 4: what a visitor actually reads
console.log('\n=== the homepage shows those prices, in Korean and in English ===');
const browser = await chromium.launch();
for (const lang of ['ko', 'en']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${MARKETING}/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const shown = await page.locator('.kn-plan').evaluateAll((els) => els.map((e) => ({
    plan: e.dataset.plan,
    price: e.querySelector('.kn-plan__price strong')?.textContent ?? '',
    recommended: e.hasAttribute('data-recommended'),
    lines: e.querySelectorAll('.kn-plan__list li').length,
    cta: e.querySelector('.kn-plan__cta')?.getAttribute('href') ?? '',
  })));
  if (shown.length !== 3) bad(`${lang}: ${shown.length} pricing cards, expected 3`);
  for (const p of PLANS) {
    const card = shown.find((c) => c.plan === p.slug);
    if (!card) { bad(`${lang}: no card for ${p.slug}`); continue; }
    // Compare digits only: the currency symbol and separators are the locale's business, the number is not.
    const digits = card.price.replace(/\D/g, '');
    // The card shows dollars; the manifest stores cents. A card that printed `17900` would be the bug.
    if (digits !== displayed(p.amount_minor)) bad(`${lang}/${p.slug}: card reads "${card.price}" (${digits}), expected ${displayed(p.amount_minor)}`);
    if (card.lines !== 5) bad(`${lang}/${p.slug}: ${card.lines} feature lines, the brief allows exactly 5`);
    if (card.recommended !== p.recommended) bad(`${lang}/${p.slug}: recommended flag ${card.recommended}, expected ${p.recommended}`);
    // Decoded first: V17 sends a plan CTA to `/register?next=%2Fservices%3Fplan%3D…`, so the plan is
    // carried inside an encoded `next`. The requirement is that it survives the hand-off, not that it
    // appears literally in the query string.
    const cta = decodeURIComponent(card.cta);
    if (!cta.includes(`plan=${p.slug}`)) bad(`${lang}/${p.slug}: CTA does not carry the plan — ${card.cta}`);
    if (lang !== 'en' && !cta.includes(`lang=${lang}`)) bad(`${lang}/${p.slug}: CTA drops the language — ${card.cta}`);
  }
  if (!fail.length || lang === 'en') ok(`${lang}: three cards, correct prices, five lines each, CTA carries plan${lang === 'en' ? '' : ' + lang'}`);

  // The things the brief forbids a pricing section to contain.
  const text = await page.locator('#pricing').innerText();
  const banned = [/\bBEST\b/, /<s>|line-through/, /\b무조건\b/, /\b100%\s*성공/, /완벽\s*보장/, /\b혁신적/, /\b압도적/, /차원이\s*다른/];
  for (const re of banned) if (re.test(text)) bad(`${lang}: the pricing section contains forbidden sales copy matching ${re}`);
  // Guarantees: the business plan (§8) does not guarantee admission, scholarship or a visa.
  if (/보장/.test(text) || /\bguarantee/i.test(text)) bad(`${lang}: the pricing section uses guarantee language`);
  const strike = await page.locator('#pricing').evaluate((el) =>
    [...el.querySelectorAll('*')].some((n) => getComputedStyle(n).textDecorationLine.includes('line-through')));
  if (strike) bad(`${lang}: something in the pricing section is struck through`);
  /*
   * **The exclusion and external-cost paragraphs do not belong in this composition** (V15 b).
   *
   * They used to sit under the table, and the owner's verdict was that they destroy the homepage. They were
   * not deleted — the statement moved to where a buyer meets it before paying — so this half of the check
   * asserts the homepage is clear of them and the block below asserts the other surfaces still carry them.
   * One without the other would be either a regression or a compliance hole, which is why they are one
   * check in two places rather than two checks.
   */
  if (await page.locator('.kn-pricenote').count()) bad(`${lang}: the external-cost note is back in the homepage pricing section`);
  if (await page.locator('.kn-compare__excluded').count()) bad(`${lang}: Basic's exclusion paragraph is back in the homepage pricing section`);
  const openText = await page.locator('#pricing').evaluate(async (el) => {
    const d = el.querySelector('details.kn-compare');
    if (d) d.open = true;
    await new Promise((r) => setTimeout(r, 50));
    const t = el.innerText;
    if (d) d.open = false;
    return t;
  });
  const LEGALESE = lang === 'ko'
    ? [/대학 전형료/, /아포스티유/, /비자 신청 대행/, /관련 법령상/, /포함되지 않는 비용/]
    : [/application fees/i, /apostille/i, /visa application representation/i, /Korean law permits/i];
  for (const re of LEGALESE) {
    if (re.test(openText)) bad(`${lang}: exclusion / external-cost copy matching ${re} is still rendered in the pricing section`);
  }
  // The comparison must be one in-place disclosure, not a second page.
  const details = await page.locator('details.kn-compare').count();
  if (details !== 1) bad(`${lang}: expected exactly one in-place comparison disclosure, found ${details}`);
  /*
   * The matrix is read as three areas, not eleven flat rows, and every row the manifest defines is in one
   * of them. A grouping maintained by hand is exactly the thing that silently loses a row.
   */
  const matrix = await page.locator('#pricing').evaluate((el) => {
    const d = el.querySelector('details.kn-compare');
    if (d) d.open = true;
    const t = el.querySelector('table.kn-matrix');
    const out = {
      groups: [...el.querySelectorAll('.kn-matrix__grouprow')].length,
      rows: [...(t?.querySelectorAll('tbody tr:not(.kn-matrix__grouprow)') ?? [])].length,
      tabs: [...el.querySelectorAll('.kn-matrix-m__tabs [role=tab]')].map((b) => b.getAttribute('aria-selected')),
      tablist: !!el.querySelector('.kn-matrix-m [role=tablist]'),
      cellBorders: [...(t?.querySelectorAll('tbody td') ?? [])].some((c) => {
        const cs = getComputedStyle(c);
        return [cs.borderTopWidth, cs.borderBottomWidth, cs.borderLeftWidth, cs.borderRightWidth].some((w) => parseFloat(w) > 0);
      }),
    };
    if (d) d.open = false;
    return out;
  });
  if (matrix.groups !== 3) bad(`${lang}: the matrix has ${matrix.groups} area labels, expected 3`);
  if (matrix.rows !== COMPARE_ROWS.length) bad(`${lang}: the matrix shows ${matrix.rows} of the manifest's ${COMPARE_ROWS.length} rows`);
  // A bordered grid is the spreadsheet the brief removed; the rhythm is row height, not cell rules.
  if (matrix.cellBorders) bad(`${lang}: the comparison matrix has cell borders again`);
  if (!matrix.tablist) bad(`${lang}: the phone comparison has no tablist`);
  if (matrix.tabs.filter((s) => s === 'true').length !== 1) bad(`${lang}: the phone comparison does not have exactly one selected plan`);
  await page.close();
}
// --------------------------------------------------------------------------------- responsive layout
console.log('\n=== the layout at the nine widths the brief names ===');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${MARKETING}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  for (const w of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1728]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(350);
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.kn-plan')];
      const raw = cards.map((c) => { const r = c.getBoundingClientRect(); return { plan: c.dataset.plan, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) }; });
      const cols = new Set(raw.map((r) => r.left)).size;
      return {
        cols,
        order: [...raw].sort((a, b) => (cols > 1 ? a.left - b.left : a.top - b.top)).map((r) => r.plan),
        cardWidth: Math.min(...raw.map((r) => r.w)),
        cta: Math.min(...[...document.querySelectorAll('.kn-plan__cta')].map((e) => Math.round(e.getBoundingClientRect().height))),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        // `.hg-sr-only` is clipped on purpose; excluding it is the difference between a check and noise.
        clipped: [...document.querySelectorAll('#pricing *')].some((e) =>
          e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'hidden' && !e.classList.contains('hg-sr-only')),
      };
    });
    if (m.overflowX) bad(`${w}px: the page scrolls horizontally`);
    if (m.clipped) bad(`${w}px: something in the pricing section is clipped`);
    if (m.cta < 44) bad(`${w}px: a CTA is ${m.cta}px tall — below the 44px touch target`);
    // Three across is only allowed where each card still has room; the brief rules out squeezing.
    if (m.cols === 3 && m.cardWidth < 280) bad(`${w}px: three cards at ${m.cardWidth}px each — squeezed`);
    if (m.cols > 1 && m.cols !== 3) bad(`${w}px: ${m.cols} columns`);
    // Stacked → the recommended plan leads. In a row → ascending price.
    const want = m.cols === 1 ? ['all_in_one', 'basic', 'premium'] : ['basic', 'all_in_one', 'premium'];
    if (JSON.stringify(m.order) !== JSON.stringify(want)) bad(`${w}px: reading order ${m.order.join(' → ')}, expected ${want.join(' → ')}`);
    else ok(`${String(w).padStart(4)}px · ${m.cols === 1 ? 'stacked' : '3 across'} · ${m.order.join(' → ')} · card ${m.cardWidth}px · CTA ${m.cta}px`);
  }
  await page.close();
}

await browser.close();

/*
 * ------------------------------------------- cost transparency moved, it did not go away (V15 b)
 *
 * The business plan (§8 비용 투명성) requires the costs a Hangyul fee never covers to be stated. V15 b took
 * that statement off the homepage marketing composition, which is only legitimate because it is stated
 * where a buyer actually meets it: above the plan chooser on the student plan page, and as 제8조 of the
 * Terms. If either of those goes, this fails — removing the paragraph from the homepage would then have
 * removed it from the product.
 */
console.log('\n=== the external costs are still stated where the buying happens ===');
{
  const svc = readFileSync(resolve(ROOT, 'apps/student-web/src/pages/Services.tsx'), 'utf8');
  if (!/v15\.services\.external/.test(svc)) bad('the student plan page no longer states the external costs');
  else ok('student /services states them above the plan chooser');

  const koStudent = JSON.parse(readFileSync(resolve(ROOT, 'packages/i18n/locales/ko/student.json'), 'utf8'));
  const stated = koStudent.v15?.services?.external ?? '';
  const WANT = ['전형료', '등록금', '아포스티유', '비자 수수료', '숙소'];
  const absent = WANT.filter((w) => !stated.includes(w));
  if (absent.length) bad(`the student plan page's external-cost line no longer names: ${absent.join(', ')}`);
  else ok(`all five external costs named: ${WANT.join(' · ')}`);

  const terms = readFileSync(resolve(ROOT, 'apps/marketing-web/src/pages/legal/Terms.tsx'), 'utf8');
  if (!/v12\.terms\.fees\./.test(terms)) bad('the Terms no longer carry the fees article');
  else ok('Terms 제8조 (서비스 이용료와 결제) is intact');
}

// ------------------------------------------------------- the retired model must not be reachable in the UI
console.log('\n=== the old packages are gone from shipped code ===');
const DEAD = ['FREE_EXPLORER', 'APPLICATION_SUPPORT', 'PREMIUM_SUCCESS'];
// Source and locale bundles only. `dist/` holds stale build output from earlier passes and `node_modules`
// is not ours; neither is shipped from this tree, and grepping them turns a real check into noise.
const SRC = ['apps/*/src', 'packages/*/src', 'packages/i18n/locales', 'server/app', 'server/tests', 'e2e'];
const grepIn = (pattern, paths) => {
  try {
    return execFileSync('bash', ['-c', `grep -rIlE ${JSON.stringify(pattern)} ${paths.join(' ')} 2>/dev/null || true`],
      { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { return []; }
};
const out = grepIn(DEAD.join('|'), SRC)
  // `seed/run.py` names them once, in the docstring that explains what they were and why they went.
  .filter((f) => f !== 'server/app/seed/run.py');
if (out.length) bad(`the retired package codes still appear in: ${out.join(', ')}`);
else ok('no retired package code in apps, packages, server or tests');

// Old demo prices must not survive either.
// Word-bounded: a bare "290000" also occurs inside unrelated statistics fixtures, and matching those would
// make this check cry wolf until someone stopped reading it.
const PRICES = ['19900', '69900', '290000', '990000', '4900000', '16900000'];
const priceHits = grepIn(`(^|[^0-9])(${PRICES.join('|')})([^0-9]|$)`, ['apps/*/src', 'packages/*/src', 'server/app/seed', 'server/app/api']);
if (priceHits.length) bad(`a retired demo price still appears in: ${priceHits.join(', ')}`);
else ok('no retired demo price in shipped code');

console.log();
if (fail.length) { console.error(`Pricing gate: ${fail.length} failure(s).`); process.exit(1); }
console.log('Pricing gate: OK — manifest, shared/plans.json, the API and the homepage all state the same three prices.');
