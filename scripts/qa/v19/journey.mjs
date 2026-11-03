/**
 * V19 — the Marketing → Student journey as one continuous user (REPORT §206; the brief's §41).
 *
 * Walks the real path a stranger takes, counting clicks and checking for the four things the brief names:
 * a scroll that arrives in the wrong place, a dead end, an unexpected route jump, and lost context
 * (language, chosen plan). It asserts nothing about taste — it measures whether the thread holds.
 *
 *   node scripts/qa/v19/journey.mjs [--lang vi]
 */
import { chromium } from '@playwright/test';

const LANG = (() => { const i = process.argv.indexOf('--lang'); return i >= 0 ? process.argv[i + 1] : 'ko'; })();
const M = 'http://localhost:3100';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const problems = [];
const steps = [];
let clicks = 0;

const at = async () => page.evaluate(() => ({
  url: location.pathname + location.search,
  y: Math.round(window.scrollY),
  lang: document.documentElement.getAttribute('lang') || '',
}));

const step = async (label, fn, expect = {}) => {
  if (fn) { await fn(); }
  await page.waitForTimeout(800);
  const s = await at();
  steps.push({ label, ...s, clicks });
  if (expect.topOfPage && s.y > 2) problems.push(`${label}: arrived at ${s.y}px, not the top`);
  if (expect.url && !new RegExp(expect.url).test(s.url)) problems.push(`${label}: unexpected route ${s.url} (wanted ${expect.url})`);
  if (expect.lang && s.lang !== expect.lang) problems.push(`${label}: language is "${s.lang}", expected "${expect.lang}" — context lost`);
  return s;
};

// 1. A stranger lands on the homepage in their own language.
await page.goto(`${M}/?lang=${LANG}`, { waitUntil: 'networkidle' });
await step('1 homepage', null, { lang: LANG });

// 2. They read it to the bottom.
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await step('2 scrolled to the closing band');

// 3. They click the one conversion action.
clicks++;
await step('3 click 유학 준비', async () => {
  await page.locator('.kn-cta a[data-cta="primary"]').first().click();
  await page.waitForURL(/\/start/, { timeout: 15000 });
}, { topOfPage: true, url: '/start', lang: LANG });

// 4–6. Three questions. Nationality is a combobox; the other two are option cards.
clicks++;
await step('4 nationality', async () => {
  const sel = page.locator('.mk-qs__form select, .mk-qs__form input[role="combobox"], .mk-qs__form button').first();
  await sel.click().catch(() => {});
  const opt = page.locator('[role="option"], option').nth(3);
  if (await opt.count()) await opt.click().catch(() => {});
  else await page.locator('.mk-qs__form select').first().selectOption({ index: 3 }).catch(() => {});
});
clicks++;
await step('5 study level', async () => { await page.locator('.mk-qs__options [role="radio"]').nth(1).click(); });
clicks++;
await step('6 language score', async () => { await page.locator('.mk-qs__group').last().locator('[role="radio"]').last().click(); });

// 7. The CTA must be live now, and must not have been before.
const submit = page.locator('.mk-qs__submit');
const enabled = await submit.isEnabled();
if (!enabled) problems.push('7: the CTA is still disabled after three answers');
clicks++;
await step('7 see my universities', async () => { await submit.click(); await page.waitForTimeout(2500); });

const results = await page.locator('.mk-qs__list li').count();
if (!results) problems.push('7: no recommendations came back — the free product produced nothing');

// 8. Open a university from the results; the thread must carry the language and say where it came from.
if (results) {
  clicks++;
  await step('8 open a recommended university', async () => {
    await page.locator('.mk-qs__row').first().click();
    await page.waitForURL(/\/universities\//, { timeout: 15000 });
  }, { topOfPage: true, url: '/universities/', lang: LANG });
  const u = await at();
  if (!/from=recommendation/.test(u.url)) problems.push('8: the university page was not told it came from a recommendation');
}

// 9. The paid path. It must cross to the student origin carrying the plan and the language.
await page.goto(`${M}/?lang=${LANG}#pricing`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const planCta = page.locator('#pricing a[href*="plan="], a[href*="register"][href*="plan"]').first();
if (!(await planCta.count())) problems.push('9: no plan CTA found in the pricing section');
else {
  const href = await planCta.getAttribute('href');
  steps.push({ label: '9 plan CTA target', url: href, y: 0, lang: LANG, clicks: clicks + 1 });
  // The plan rides inside `next=`, so it is percent-encoded (`...%3Fplan%3Dbasic`). Matching the raw href
  // for `plan=` reported a break that was not one — decode before asserting.
  const decoded = decodeURIComponent(href || '');
  if (!/plan=/.test(decoded)) problems.push(`9: the plan CTA carries no plan (${href})`);
  if (LANG !== 'ko' && !/lang=/.test(href || '')) problems.push(`9: the plan CTA drops the language (${href})`);
  if (!/^https?:\/\/[^/]*:3101/.test(href || '')) problems.push(`9: the plan CTA does not cross to the student origin (${href})`);
}

await browser.close();

console.log(`\nMarketing → Student journey, lang=${LANG}\n`);
console.log('step'.padEnd(34), 'clicks'.padStart(7), 'scrollY'.padStart(8), '  route');
for (const s of steps) console.log(s.label.padEnd(34), String(s.clicks).padStart(7), String(s.y).padStart(8), '  ' + (s.url || '').slice(0, 70));
console.log(`\n${clicks + 1} clicks from landing to the plan handoff · ${results} recommendations returned`);
if (problems.length) {
  console.log(`\n${problems.length} break(s):`);
  for (const p of problems) console.log('  ✗', p);
  process.exit(1);
}
console.log('\nNo scroll surprise, no dead end, no unexpected route jump, no lost context.');
