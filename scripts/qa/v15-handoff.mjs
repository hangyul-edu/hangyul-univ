/**
 * V15 plan-handoff gate — the plan, the language and the destination survive the auth boundary.
 *
 * The homepage CTA is the one place in the product where a visitor makes a decision *before* they have an
 * account. If that decision is lost at the login wall, the pricing section has sold something the platform
 * then asks them to choose again — which is both a conversion problem and, worse, a sign the two halves of
 * the product do not share a model.
 *
 * Walks the real chain at a real browser, in a non-English locale, for all three plans, and then checks
 * that the destination pre-selects the plan once signed in.
 *
 * **V17 changed the chain, and this gate follows it** (brief §23). V15's rule sent a plan CTA through the
 * quick check — `homepage → /start?plan=… → "create an account" → /register?next=/services?plan=…` — on
 * the V13 principle that a conversion action must not open a password field. That principle still holds
 * for the *undirected* CTA (내 유학 준비 → the free quick check, now a public marketing route), but it was
 * being applied to the wrong button: a visitor who has just **chosen a plan** has already decided, and
 * making them answer three questions to buy it is a step between intent and payment, not a step towards it.
 *
 *   undirected CTA   →  /start                      (public, free, no account — brief §19)
 *   plan CTA         →  /register?next=/services?plan=…&lang=…   (brief §23: plan → auth → checkout)
 *
 * What the gate still asserts is the thing that actually matters and has not changed: **the plan and the
 * language survive the auth boundary**, and the destination pre-selects that plan.
 *
 *   node scripts/qa/v15-handoff.mjs
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MARKETING = process.env.MARKETING ?? 'http://localhost:3100';
const STUDENT = process.env.STUDENT ?? 'http://localhost:3101';

const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { fail.push(m); console.log(`  ✖ ${m}`); };

const { PLANS } = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/plans.ts')).href);
const browser = await chromium.launch();

// ------------------------------------------------------- signed out: the whole chain, in Vietnamese
console.log('=== signed out · ?lang=vi · each plan ===');
for (const plan of PLANS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${MARKETING}/?lang=vi`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const cta = page.locator(`.kn-plan[data-plan="${plan.slug}"] .kn-plan__cta`);
  const href = await cta.getAttribute('href');
  if (!href) { bad(`${plan.slug}: no CTA`); await page.close(); continue; }
  const u = new URL(href);
  // V17: the plan CTA goes to auth, carrying where to come back to (brief §23). It must not open the
  // quick check — a visitor who picked a plan has decided — and it must not lose the plan or the language.
  if (u.pathname !== '/register') bad(`${plan.slug}: CTA goes to ${u.pathname}, not /register`);
  const next = u.searchParams.get('next');
  if (!next || !next.includes(`plan=${plan.slug}`)) bad(`${plan.slug}: CTA does not carry the plan — next=${next}`);
  if (!next || !next.startsWith('/services')) bad(`${plan.slug}: CTA returns to ${next}, expected the service page`);
  if (u.searchParams.get('lang') !== 'vi') bad(`${plan.slug}: CTA lang=${u.searchParams.get('lang')}`);

  // Follow it for real — the language and the return path must survive the navigation, not just the href.
  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const atReg = new URL(page.url());
  if (!atReg.pathname.startsWith('/register')) bad(`${plan.slug}: the CTA did not land on registration (${atReg.pathname})`);
  const landedNext = atReg.searchParams.get('next');
  if (!landedNext || !landedNext.includes(`plan=${plan.slug}`)) bad(`${plan.slug}: registration dropped the plan`);
  else if (atReg.searchParams.get('lang') !== 'vi') bad(`${plan.slug}: registration dropped the language`);
  else ok(`${plan.slug}: homepage → /register?next=${landedNext}, language and plan intact`);
  await page.close();
}

/*
 * The undirected CTA is the other half of brief §23 and is checked here because this gate owns the
 * question "where does the homepage send people": 내 유학 준비 opens the **public free quick check** on the
 * marketing site, not a password field and not the student app.
 */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${MARKETING}/?lang=vi`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const hero = await page.locator('.kn-hero__actions a').first().getAttribute('href').catch(() => null);
  if (!hero) bad('the hero has no primary action');
  else {
    const h = new URL(hero, MARKETING);
    if (h.origin !== new URL(MARKETING).origin) bad(`the undirected CTA leaves the marketing site: ${hero}`);
    else if (h.pathname !== '/start') bad(`the undirected CTA goes to ${h.pathname}, not the public quick check`);
    else if (h.searchParams.get('lang') !== 'vi') bad('the undirected CTA drops the language');
    else ok('내 유학 준비 → /start?lang=vi — public, free, on the marketing site');
  }
  await page.close();
}

// ------------------------------------------------------------------ signed in: the plan is pre-selected
console.log('\n=== signed in · /services?plan=… pre-selects that plan ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  // A student with no purchase, so the cards are in the choosing state rather than the owned state.
  // (student20 owns a plan; picking a purchaser here would have made this assertion vacuous.)
  await page.goto(`${STUDENT}/login?lang=ko`);
  await page.fill('#email', 'student02@demo.hangyul.kr');
  await page.fill('#password', 'Hangyul!2026');
  await page.click('button[type=submit]');
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 30000 });
  for (const plan of PLANS) {
    await page.goto(`${STUDENT}/services?plan=${plan.slug}&lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const owned = await page.locator('.sv15-current').count();
    const pre = await page.locator('.sv15-plan[data-preselected]').getAttribute('aria-labelledby').catch(() => null);
    if (owned) {
      // A student who already bought something is shown their plan; pre-selection is not the question.
      ok(`${plan.slug}: this student already owns a plan, so the current-plan view is shown (correct)`);
    } else if (pre !== `plan-${plan.code}`) {
      bad(`${plan.slug}: pre-selected card is ${pre}, expected plan-${plan.code}`);
    } else {
      ok(`${plan.slug}: arriving with ?plan=${plan.slug} pre-selects ${plan.code}`);
    }
  }
  // An invented plan must not select anything rather than throwing.
  await page.goto(`${STUDENT}/services?plan=not_a_plan&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const bogus = await page.locator('.sv15-plan[data-preselected]').count();
  if (bogus) bad('an invented ?plan= value selected a card');
  else ok('an invented ?plan= value selects nothing and does not break the page');
  await ctx.close();
}

await browser.close();
console.log();
if (fail.length) { console.error(`Plan-handoff gate: ${fail.length} failure(s).`); process.exit(1); }
console.log('Plan-handoff gate: OK — plan, language and return path survive registration, and arrive pre-selected.');
