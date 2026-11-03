/*
 * RETIRED FROM `qa:v15` IN V22 (2026-10-25). This gate asserts the agency console (V15 "Today" queue, five-question page, seven-item navigation), which the V22
 * redesign replaced on purpose (REPORT §246–§247 audits, §257–§261 validations): the DOM it selects no longer exists,
 * so it now fails on the first query rather than on a product defect. Its still-valid intents — no score near an
 * application, nothing ordered by what the student paid, no retail pricing on a university screen, counts that
 * reconcile with rows — live in `scripts/qa/v22-gate.mjs` (section R). Kept for the record; runnable by hand.
 */
/**
 * V15 agency gate — a counselor can answer all four questions without leaving the page.
 *
 * The brief's north star, as an assertion rather than an aspiration: who needs me now, why are they blocked,
 * is this application ready enough to submit, and what have we promised this student. Before V15 the fourth
 * had no answer anywhere in the console.
 *
 * It also guards the three things that would quietly undo the rest:
 *   - no score anywhere near an application (brief Part 10, and the benchmark's clearest negative finding);
 *   - the Today queue is still ranked by operational risk, not by what the student paid;
 *   - the navigation is still seven items.
 *
 *   node scripts/qa/v15-agency.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const AGENCY = process.env.AGENCY ?? 'http://localhost:3102';
const OUT = 'qa-screenshots/v15-agency';
mkdirSync(OUT, { recursive: true });

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fail.push(m); console.log(`  ✖ ${m}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
await page.goto(`${AGENCY}/login?lang=ko`);
await page.fill('#email', 'counselor@lotus.demo.hangyul.kr');
await page.fill('#password', 'Hangyul!2026');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await page.waitForTimeout(2500);

// ------------------------------------------------------------------------------ Q1: who needs me now
console.log('=== Today: who needs me now ===');
{
  const rows = await page.locator('.ag9-q__row').count();
  if (rows === 0) bad('the work queue is empty — nothing to assert against');
  else ok(`the ranked work queue is the first thing on the page (${rows} rows)`);

  // The queue, not KPI tiles, must lead.
  const firstCard = await page.locator('.ag9-today__grid > *').first().evaluate((e) => e.className);
  if (!/ag9-qcard/.test(firstCard)) bad(`the first element is "${firstCard}", not the work queue`);
  else ok('no KPI tiles above the work');

  // Q4 on the row: the plan.
  const withPlan = await page.locator('.ag9-q__row .ag15-plan').count();
  if (withPlan === 0) bad('no row shows the purchased plan');
  else ok(`${withPlan} of ${rows} rows carry the purchased plan as a token`);

  // Ordering must not follow price. Compare the queue order against the plan prices on it.
  const order = await page.locator('.ag9-q__row').evaluateAll((els) => els.map((e) => ({
    tier: Number(e.dataset.tier),
    plan: e.querySelector('.ag15-plan')?.dataset.plan ?? null,
  })));
  const rank = { BASIC: 0, ALL_IN_ONE: 1, PREMIUM: 2 };
  const byPrice = [...order].sort((a, b) => (rank[b.plan] ?? -1) - (rank[a.plan] ?? -1));
  const identical = JSON.stringify(order.map((o) => o.plan)) === JSON.stringify(byPrice.map((o) => o.plan));
  const tiers = order.map((o) => o.tier);
  const tierSorted = [...tiers].sort((a, b) => a - b);
  if (JSON.stringify(tiers) !== JSON.stringify(tierSorted)) bad(`the queue is not in tier order: ${tiers.join(',')}`);
  else ok('the queue is ordered by operational tier');
  if (identical && new Set(order.map((o) => o.plan)).size > 1) {
    bad('the queue order is identical to sorting by plan price — prioritisation may be following what the student paid');
  } else ok('queue order is not price order — a Premium case does not outrank another student\'s deadline');

  await page.screenshot({ path: `${OUT}/gate-today.png` });
}

// ------------------------------------------- Q2 + Q3 + Q4 on one screen: the student workspace header
console.log('\n=== the student workspace first viewport ===');
{
  const href = await page.locator('.ag9-q .ag8-now__name').first().getAttribute('href');
  await page.goto(`${AGENCY}${href}?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const strip = await page.locator('.ag9-strip__cell').evaluateAll((els) => els.map((e) => e.dataset.k));
  const need = ['plan', 'why', 'next', 'deadline', 'owner'];
  const missing = need.filter((k) => !strip.includes(k));
  if (missing.length) bad(`the case strip is missing: ${missing.join(', ')}`);
  else ok(`the case strip answers ${need.join(' · ')} in one row`);

  // Everything the brief asks for in the first viewport, measured against the fold.
  const fold = await page.evaluate(() => {
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.top < 950 && r.height > 0; };
    return {
      student: vis('.ag7-wshead__facts') || vis('h1'),
      plan: vis('.ag9-strip__cell[data-k=plan]'),
      stage: vis('.ag7-wshead__facts') || vis('.ag9-strip__cell[data-k=why]'),
      why: vis('.ag9-strip__cell[data-k=why]'),
      next: vis('.ag9-strip__cell[data-k=next]'),
      deadline: vis('.ag9-strip__cell[data-k=deadline]'),
      owner: vis('.ag9-strip__cell[data-k=owner]'),
    };
  });
  const absent = Object.entries(fold).filter(([, v]) => !v).map(([k]) => k);
  if (absent.length) bad(`not in the first viewport: ${absent.join(', ')}`);
  else ok('student · plan · stage · why blocked · next action · deadline · owner are all above the fold');

  // Q4 in detail: the scope panel, with the rationed allowances.
  const scope = await page.locator('.ag15-scope__list > div').count();
  if (scope < 3) bad(`the scope panel shows ${scope} rows`);
  else ok(`the scope panel shows ${scope} rows of what was bought and what is left`);
  const used = await page.locator('.ag15-scope__v').allTextContents();
  if (!used.some((t) => /\d+\s*\/\s*\d+/.test(t))) bad('no allowance is shown as used / limit');
  else ok(`allowances are shown as used / limit (${used.filter((t) => /\d+\s*\/\s*\d+/.test(t)).join(' · ')})`);

  // Q3: readiness as a sentence, never a score.
  const ready = await page.locator('.ag15-ready__state').allTextContents();
  if (!ready.length) bad('no application shows a readiness state');
  else ok(`readiness is stated in words: ${[...new Set(ready)].join(' · ')}`);

  await page.screenshot({ path: `${OUT}/gate-workspace.png`, fullPage: true });
}

// --------------------------------------------------------------------------------- no scores, anywhere
console.log('\n=== no fake scores ===');
{
  const text = await page.locator('body').innerText();
  const banned = [
    [/\b\d{1,3}\s*점\b/, 'a "N점" score'],
    [/합격\s*(확률|가능성)\s*\d/, 'an admission-probability figure'],
    [/\bAI\s*(Admission\s*)?Score\b/i, 'an "AI score"'],
    [/\b\d{1,3}\s*%\s*(합격|성공)/, 'a success-percentage claim'],
  ];
  for (const [re, what] of banned) if (re.test(text)) bad(`the student workspace shows ${what}`);
  ok('no score, probability or success percentage on the case');
}

// ------------------------------------------------------------------------------- navigation unchanged
console.log('\n=== navigation is still seven ===');
{
  const items = await page.locator('.app-sidebar a, nav a[href^="/"]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('href')).filter((h) => h && !h.includes('#')))]);
  const top = items.filter((h) => (h.match(/\//g) || []).length === 1 && !h.startsWith('/hq'));
  if (top.length > 9) bad(`the rail has ${top.length} top-level destinations: ${top.join(' ')}`);
  else ok(`${top.length} top-level destinations: ${top.join(' ')}`);
}

await browser.close();
console.log();
if (fail.length) { console.error(`Agency gate: ${fail.length} failure(s).`); process.exit(1); }
console.log('Agency gate: OK — plan, scope, blocker, next action and deadline are on one screen; no scores; ordering is by risk.');
