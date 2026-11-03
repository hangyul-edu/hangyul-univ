/**
 * Company footer gate (V14, brief Part 67).
 *
 * Asserts the exact customer-facing company information the owner supplied is on the production marketing
 * site, and that the things the brief rules out are not.
 *
 * The values are hard-coded here on purpose. A gate that reads them from the same module the page reads them
 * from proves only that two files agree; these five strings came from the owner in a brief, and this is the
 * place that remembers what they said.
 *
 *   node scripts/qa/v14-footer.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3100';

const MUST = [
  ['유재희', 'representative director'],
  ['남우준', 'business division'],
  ['support@talkhangyul.com', 'support email'],
  ['403-87-03380', 'business registration number'],
  ['제2026-서울도봉-0542호', 'mail-order business registration number'],
];
/** Nothing that offers a second audience a door, and nothing left over from the photo-credit era. */
const MUST_NOT = [
  'Partner sign-in', 'Partner sign in', '파트너 로그인',
  'University Console', '대학 콘솔', '대학교 콘솔',
  'Agency Console', '유학원 콘솔', '에이전시 콘솔',
  'Photo credits', '사진 출처', '사진 크레딧',
];

const problems = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const path of ['/?lang=ko', '/universities?lang=ko', '/privacy?lang=ko']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const footer = await page.locator('footer').innerText().catch(() => '');
  const body = await page.locator('body').innerText();

  for (const [needle, what] of MUST) {
    if (!footer.includes(needle)) problems.push(`${path}: footer is missing the ${what} (${needle})`);
  }
  for (const needle of MUST_NOT) {
    if (body.includes(needle)) problems.push(`${path}: page contains "${needle}", which the brief rules out`);
  }
  // The email must be actionable, not just printed.
  const mailto = await page.locator('footer a[href="mailto:support@talkhangyul.com"]').count();
  if (!mailto) problems.push(`${path}: the support email is not a mailto: link`);
  // And no link to the retired credits page.
  if (await page.locator('a[href*="/credits"]').count()) problems.push(`${path}: still links to /credits`);
}

// `/credits` itself must not render a page any more — it redirects.
await page.goto(`${BASE}/credits`, { waitUntil: 'networkidle' });
const landed = new URL(page.url()).pathname;
if (landed === '/credits') problems.push(`/credits still renders (expected a redirect, landed on ${landed})`);
else console.log(`/credits → ${landed}`);

await browser.close();

if (problems.length) {
  console.error(`\nCompany footer gate: ${problems.length} problem(s)\n`);
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`Company footer gate: OK — ${MUST.length} required fields present on 3 pages, ${MUST_NOT.length} forbidden strings absent, /credits retired.`);
