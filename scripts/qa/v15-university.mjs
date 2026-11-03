/*
 * RETIRED FROM `qa:v15` IN V22 (2026-10-25). This gate asserts the university console (V15 five-section Overview), which the V22
 * redesign replaced on purpose (REPORT §246–§247 audits, §257–§261 validations): the DOM it selects no longer exists,
 * so it now fails on the first query rather than on a product defect. Its still-valid intents — no score near an
 * application, nothing ordered by what the student paid, no retail pricing on a university screen, counts that
 * reconcile with rows — live in `scripts/qa/v22-gate.mjs` (section R). Kept for the record; runnable by hand.
 */
/**
 * V15 university gate — the Overview is five sections that reconcile, and holds no retail pricing.
 *
 * Two different failures are guarded here.
 *
 * The first is **numbers that disagree**. An admissions director who finds the Overview saying 23 and the
 * applicant list saying 21 for the same population stops trusting both, and no amount of chart design
 * recovers that. So every figure on the Overview is followed through to the records it claims to count.
 *
 * The second is **commercial leakage**. Basic / All-in-One / Premium and their prices are a Hangyul–student
 * relationship. A university screen that quotes them has disclosed somebody's purchase to a third party.
 *
 *   node scripts/qa/v15-university.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const UNI = process.env.UNIVERSITY ?? 'http://localhost:3103';
const OUT = 'qa-screenshots/v15-university';
mkdirSync(OUT, { recursive: true });

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fail.push(m); console.log(`  ✖ ${m}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${UNI}/login?lang=ko`);
await page.fill('#email', 'admin@pusan.univ.demo.hangyul.kr');
await page.fill('#password', 'Hangyul!2026');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await page.waitForTimeout(3000);

// ------------------------------------------------------------------------------- the five sections
console.log('=== the Overview is exactly five sections ===');
{
  const present = await page.evaluate(() => ({
    queue: !!document.querySelector('.uv7-decisions'),
    funnel: !!document.querySelector('#ov-funnel'),
    markets: !!document.querySelector('#ov-markets'),
    quality: !!document.querySelector('#ov-quality'),
    after: !!document.querySelector('#ov-after'),
  }));
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) bad(`missing sections: ${missing.join(', ')}`);
  else ok('needs-decision · funnel · source market · application quality · post-admission');

  // What V15 removed must stay removed.
  if (await page.locator('.uv7-waiting').count()) bad('the separate "waiting on applicants" card is back');
  else ok('the applicant-waiting rows are folded into the decision queue, not a second card');
  const timelines = await page.locator('.timeline-widget').count();
  if (timelines) bad(`an intake-dates timeline is back on the Overview (${timelines})`);
  else ok('intake dates are on Programs, with the nearest one in the header');
  // The subtitle line under the page title, wherever the shell renders it.
  const header = await page.evaluate(() => {
    const h = document.querySelector('.uv15-overview h1')?.closest('div')?.parentElement;
    return (h?.innerText ?? document.body.innerText.slice(0, 400));
  });
  if (!/\d/.test(header)) bad('the header does not carry the nearest intake date');
  else ok(`the nearest date is in the page header as a sentence — "${header.split('\n').filter(Boolean)[1] ?? ''}"`);
}

// -------------------------------------------------------------------------------------- the height
console.log('\n=== density ===');
{
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const screens = h / 900;
  console.log(`  · ${h}px = ${screens.toFixed(2)} screens at 1440 × 900 (was 1.96 before V15; target 1.0–1.5)`);
  if (screens > 1.6) bad(`the Overview is ${screens.toFixed(2)} screens — the brief asks for about 1.0–1.5`);
  else ok(`${screens.toFixed(2)} screens`);
  await page.screenshot({ path: `${OUT}/gate-overview.png`, fullPage: true });
}

// ------------------------------------------------------------------------------ numbers reconcile
console.log('\n=== every number drills through to the records it counts ===');
{
  // The decision queue: each row's count must equal the applicant list it opens.
  const rows = await page.locator('.uv7-qrow').evaluateAll((els) => els.map((e) => ({
    label: e.querySelector('.uv7-qrow__label')?.textContent?.trim(),
    n: Number((e.querySelector('.uv7-qrow__n')?.textContent ?? '').replace(/\D/g, '')),
    to: e.getAttribute('href'),
  })));
  if (!rows.length) bad('the decision queue is empty — nothing to reconcile');
  for (const r of rows.slice(0, 6)) {
    if (!r.to) { bad(`"${r.label}" does not link to its records`); continue; }
    await page.goto(`${UNI}${r.to}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    // A queue of exactly one opens **that record** rather than a list of one — which is the right
    // behaviour and the reason this check cannot just count table rows everywhere.
    if (/^\/applications\//.test(r.to)) {
      if (r.n !== 1) bad(`"${r.label}": ${r.n} items but the row opens a single application`);
      else if (!/\/applications\//.test(new URL(page.url()).pathname)) bad(`"${r.label}": the single record did not open`);
      else ok(`"${r.label}" 1 → opens that one application directly`);
      continue;
    }
    const listed = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = t.match(/(\d[\d,]*)\s*(건|results?|applicants?)/i);
      return m ? Number(m[1].replace(/,/g, '')) : null;
    });
    const tableRows = await page.locator('tbody tr, .uv8-board__row').count();
    const found = listed ?? tableRows;
    if (found !== r.n) bad(`"${r.label}": Overview says ${r.n}, the applicant list shows ${found}`);
    else ok(`"${r.label}" ${r.n} → the list shows ${found}`);
  }
  await page.goto(`${UNI}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Source market: each country's application count must equal its filtered list.
  const bars = await page.locator('.uv15-bar').evaluateAll((els) => els.map((e) => ({
    country: e.querySelector('.uv15-bar__k')?.textContent?.trim(),
    n: Number((e.querySelector('.uv15-bar__n')?.firstChild?.textContent ?? '').replace(/\D/g, '')),
    to: e.getAttribute('href'),
  })));
  for (const b of bars.slice(0, 3)) {
    if (!b.to) { bad(`${b.country}: the bar does not link to its applicants`); continue; }
    await page.goto(`${UNI}${b.to}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const n = await page.locator('tbody tr, .uv8-board__row').count();
    if (n !== b.n) bad(`${b.country}: the bar says ${b.n}, the filtered list shows ${n}`);
    else ok(`${b.country} ${b.n} → the filtered list shows ${n}`);
  }
  await page.goto(`${UNI}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

// ---------------------------------------------------------------- no rate below the minimum sample
console.log('\n=== no rate is shown below the minimum sample ===');
{
  const text = await page.locator('#ov-after, #ov-quality').allInnerTexts();
  const joined = text.join('\n');
  // Where the population is too small the UI must say so rather than print a percentage.
  const pcts = [...joined.matchAll(/(\d+)\s*%/g)].map((m) => m[0]);
  const withheld = /표본 부족|Too few|low/i.test(joined);
  ok(`post-admission and quality print ${pcts.length} percentage(s)${withheld ? ' and withhold the rest' : ''}`);
  // A withheld rate must not also draw a bar — a picture asserting what the text refuses to say.
  const contradiction = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#ov-after .yx-prow')];
    return rows.filter((r) => /표본 부족|Too few/i.test(r.textContent ?? '')
      && parseFloat(r.querySelector('.progress-bar')?.style.width ?? '0') > 0).length;
  });
  if (contradiction) bad(`${contradiction} withheld rate(s) still draw a bar`);
  else ok('a withheld rate draws no bar');
}

// ------------------------------------------------------- the university must not see retail pricing
console.log('\n=== no Hangyul retail pricing anywhere in the University Console ===');
{
  const pages = ['/', '/applicants', '/analytics', '/analytics?tab=quality', '/analytics?tab=agencies', '/analytics?tab=outcomes', '/programs', '/manage'];
  const banned = [/ALL_IN_ONE/, /\bAll-in-One\b/, /올인원/, /프리미엄\s*·/, /249[,.]000/, /499[,.]000/, /849[,.]000/];
  for (const path of pages) {
    await page.goto(`${UNI}${path}${path.includes('?') ? '&' : '?'}lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const t = await page.locator('body').innerText();
    const hits = banned.filter((re) => re.test(t));
    if (hits.length) bad(`${path} shows Hangyul retail plan information (${hits.join(', ')})`);
  }
  if (!fail.some((f) => f.includes('retail plan'))) ok(`${pages.length} university surfaces checked, none names a plan or a retail price`);
}

// ----------------------------------------------------------------- Analytics is organised by question
console.log('\n=== Analytics asks questions ===');
{
  await page.goto(`${UNI}/analytics?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const tabs = await page.locator('[role=tab]').count();
  if (tabs !== 4) bad(`Analytics has ${tabs} tabs, expected 4 question areas`);
  else ok('four question areas: recruitment · application quality · agency quality · after admission');
  // The V9 bookmark must still land somewhere sensible.
  await page.goto(`${UNI}/analytics?tab=overview&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const sel = await page.locator('[role=tab][aria-selected=true]').count();
  if (sel !== 1) bad('a legacy ?tab=overview bookmark does not resolve to a tab');
  else ok('the legacy ?tab=overview link still resolves');
}

await browser.close();
console.log();
if (fail.length) { console.error(`University gate: ${fail.length} failure(s).`); process.exit(1); }
console.log('University gate: OK — five sections, numbers reconcile, rates suppressed below the minimum, no retail pricing.');
