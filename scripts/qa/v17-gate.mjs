/**
 * V17 gate — the commercial model, the access model, the canonical markets, and the server-free bundle.
 *
 * Shaped like every gate before it: each check is either **a measurement of something rendered** or **a
 * fact about shipped bytes**, never "the component exists". V16 learned that the expensive way — a
 * test-login block passed three assertions while shipping with no stylesheet at all — and V17 adds two more
 * of the same family: a price that is right in the manifest and wrong on the card, and a currency the code
 * sends that the merchant cannot settle.
 *
 *   npm run qa:v17
 *   SKIP_BUILD=1 npm run qa:v17      # skip the review-bundle section (~4 min of vite builds)
 */
import { apiToken } from './auth.mjs';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = process.env.MARKETING ?? 'http://localhost:3100';
const S = process.env.STUDENT ?? 'http://localhost:3101';
const API = process.env.API ?? 'http://localhost:8001';
const PW = 'Hangyul!2026';

const problems = [];
const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => { problems.push(s); console.log(`  ✗ ${s}`); };
const head = (s) => console.log(`\n=== ${s} ===`);

const { PLANS, upgradeOffer, UPGRADE_POLICY } = await import(pathToFileURL(resolve(ROOT, 'packages/types/src/plans.ts')).href);
const browser = await chromium.launch();

async function signIn(page, base, email) {
  await page.goto(`${base}/login?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', PW);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
}
const token = (email, client) => apiToken(`${API}/api/v1`, email, client);

/* ------------------------------------------------------------------------------ 1. USD, end to end */
head('USD is the product currency, in the manifest, the API and the page');
{
  const WANT = { BASIC: 17_900, ALL_IN_ONE: 34_900, PREMIUM: 59_900 };
  for (const [code, minor] of Object.entries(WANT)) {
    const p = PLANS.find((x) => x.code === code);
    if (!p) { bad(`${code} is missing from the manifest`); continue; }
    if (p.currency !== 'USD') bad(`${code}.currency is ${p.currency}, expected USD`);
    if (p.amount_minor !== minor) bad(`${code}.amount_minor is ${p.amount_minor}, expected ${minor}`);
  }
  const shared = JSON.parse(readFileSync(join(ROOT, 'shared/plans.json'), 'utf8')).plans;
  for (const p of shared) {
    if (p.currency !== 'USD' || p.amount_minor !== WANT[p.code]) {
      bad(`shared/plans.json disagrees for ${p.code}: ${p.currency} ${p.amount_minor}`);
    }
  }

  const t = await token('student.new@demo.hangyul.kr', 'student');
  const svc = await fetch(`${API}/api/v1/me/services`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json());
  for (const prod of svc.products) {
    if (prod.price?.currency !== 'USD' || prod.price?.amount_minor !== WANT[prod.code]) {
      bad(`the API serves ${prod.code} as ${prod.price?.currency} ${prod.price?.amount_minor}`);
    }
  }
  ok('manifest · shared/plans.json · API all state USD 17900 / 34900 / 59900');

  // The rendered card. Cents are storage; "$349" is the price, and "$349.00" or "$34,900" would be the bug.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const lang of ['ko', 'en', 'vi']) {
    await page.goto(`${M}/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const prices = await page.$$eval('.kn-plan__price strong', (e) => e.map((x) => x.textContent.trim()));
    if (prices.length !== 3) { bad(`${lang}: ${prices.length} prices on the homepage`); continue; }
    const digits = prices.map((p) => p.replace(/\D/g, ''));
    if (JSON.stringify(digits) !== JSON.stringify(['179', '349', '599'])) {
      bad(`${lang}: homepage reads ${prices.join(' / ')} — expected 179 / 349 / 599`);
    } else if (prices.some((p) => /\.\d\d/.test(p))) {
      bad(`${lang}: a price shows cents (${prices.join(' / ')})`);
    } else if (!prices.every((p) => /\$/.test(p))) {
      bad(`${lang}: a price has no dollar sign (${prices.join(' / ')})`);
    } else {
      ok(`${lang}: ${prices.join(' · ')}`);
    }
  }

  // No stale KRW plan price anywhere a customer can see one.
  for (const [lang, path] of [['ko', '/'], ['en', '/']]) {
    await page.goto(`${M}${path}?lang=${lang}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const stale = await page.evaluate(() => /249,?000|499,?000|849,?000/.test(document.body.innerText));
    if (stale) bad(`${lang}: a retired KRW plan price is still rendered on the homepage`);
  }
  ok('no retired KRW plan price (249,000 / 499,000 / 849,000) renders on the homepage');
  await page.close();
}

/* --------------------------------------------------------------- 2. upgrade policy is configurable */
head('upgrade pricing is a stated policy, not numbers in a component');
{
  const cases = [['BASIC', 'ALL_IN_ONE', 17_000], ['ALL_IN_ONE', 'PREMIUM', 25_000], ['BASIC', 'PREMIUM', 42_000]];
  for (const [from, to, want] of cases) {
    const o = upgradeOffer(from, to);
    if (!o) { bad(`no upgrade offer ${from} → ${to}`); continue; }
    if (o.amount_minor !== want) bad(`${from} → ${to} is ${o.amount_minor}, expected ${want}`);
    if (o.currency !== 'USD') bad(`${from} → ${to} is priced in ${o.currency}`);
  }
  if (upgradeOffer('PREMIUM', 'BASIC')) bad('a downgrade is offered as an upgrade');
  if (upgradeOffer('BASIC', 'BASIC')) bad('the same plan is offered as an upgrade');
  if (UPGRADE_POLICY.status !== 'PENDING_APPROVAL') {
    bad(`UPGRADE_POLICY.status is ${UPGRADE_POLICY.status} — it must say it is unapproved until it is`);
  }
  if (!problems.length) ok('price-difference policy: $170 / $250 / $420, declared PENDING_APPROVAL');
  else ok('upgrade offers computed from the manifest');
}

/* ------------------------------------------------------------- 3. the canonical markets, each with a flag */
// V18: this used to hardcode 32 and broke the moment the owner added Myanmar as the 33rd market. The count
// now comes from the canonical table, and the gate asserts what actually matters instead — that the list has
// not silently shrunk, and that every row can be rendered. EXPECTED_MARKETS is the business-approved number
// and is the one line to change when the owner opens or closes a market.
const EXPECTED_MARKETS = 33;
head(`${EXPECTED_MARKETS} markets, every one with a flag that renders`);
{
  const table = readFileSync(join(ROOT, 'packages/i18n/src/markets.ts'), 'utf8');
  const rows = [...table.matchAll(/^ {2}\{ code: '(\w+)',\s*asset: '(\w+)',\s*locale: '([\w-]+)'/gm)];
  if (rows.length !== EXPECTED_MARKETS) bad(`markets.ts has ${rows.length} rows, expected ${EXPECTED_MARKETS}`);
  else ok(`markets.ts: ${rows.length} rows`);
  for (const [country, code] of [['Nepal', 'NP'], ['Myanmar', 'MM']]) {
    if (!rows.some((r) => r[1] === code)) bad(`${country} (${code}) is not in the market manifest`);
    else ok(`${country} is a market`);
  }
  for (const [, , asset] of rows) {
    if (!existsSync(join(ROOT, 'apps/flags', `${asset}.svg`))) bad(`flag asset ${asset}.svg is missing`);
  }
  for (const app of ['marketing-web', 'student-web']) {
    const dir = join(ROOT, 'apps', app, 'public/flags');
    const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.svg')).length : 0;
    if (have < rows.length) bad(`${app}/public/flags has ${have} flags, expected ${rows.length} — run scripts/media/sync-flags.mjs`);
  }
  ok('every market asset exists and is published to the web apps');

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const w of [390, 1440]) {
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 1000 });
    await page.goto(`${M}/?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    for (const t of await page.$$('button[aria-haspopup]')) { if (await t.isVisible()) { await t.click(); break; } }
    await page.waitForTimeout(1400);
    const m = await page.evaluate(() => {
      const root = document.querySelector('.hg-locale__sheet') || document.querySelector('.hg-locale');
      if (!root) return null;
      const sc = root.querySelector('.hg-locale__scroll');
      const imgs = [...root.querySelectorAll('img.hg-flag')];
      const np = imgs.find((i) => /NP\.svg/.test(i.getAttribute('src') || ''));
      const r = np?.getBoundingClientRect();
      return {
        rows: root.querySelectorAll('.hg-locale__row').length,
        placeholders: root.querySelectorAll('.hg-flag--none').length,
        loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        total: imgs.length,
        scrollable: sc ? sc.scrollHeight > sc.clientHeight + 2 : false,
        fitsViewport: root.getBoundingClientRect().bottom <= window.innerHeight + 2,
        nepal: r ? { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null,
      };
    });
    if (!m) { bad(`${w}px: the language selector did not open`); continue; }
    if (m.rows !== EXPECTED_MARKETS) bad(`${w}px: the selector offers ${m.rows} languages, expected exactly ${EXPECTED_MARKETS}`);
    if (m.placeholders) bad(`${w}px: ${m.placeholders} row(s) show the empty-flag placeholder`);
    if (m.loaded !== m.total) bad(`${w}px: ${m.total - m.loaded} flag image(s) failed to load`);
    if (!m.scrollable) bad(`${w}px: the language list does not scroll — the whole set is unreachable`);
    if (!m.fitsViewport) bad(`${w}px: the language sheet extends past the bottom of the viewport`);
    // Nepal is the one non-rectangular national flag; cropping it to 3:2 is the defect the brief names.
    if (!m.nepal) bad(`${w}px: Nepal's flag is not rendered`);
    else if (m.nepal.w >= m.nepal.h) bad(`${w}px: Nepal's flag renders ${m.nepal.w}×${m.nepal.h} — it has been cropped to a rectangle`);
    else ok(`${String(w).padStart(4)}px · ${m.rows} languages · ${m.loaded}/${m.total} flags · scrolls · Nepal ${m.nepal.w}×${m.nepal.h} (portrait)`);
    await page.keyboard.press('Escape');
  }
  await page.close();
}

/* --------------------------------------------------------- 4. the free product, and where it leads */
head('the free quick check is public, and its results lead to public university pages');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  // Anonymous. No account, no redirect to one.
  await page.goto(`${M}/start?lang=ko`, { waitUntil: 'domcontentloaded' });
  const form = await page.waitForSelector('.mk-qs__form', { timeout: 20_000 }).catch(() => null);
  if (!form) { bad('the public quick check does not render for an anonymous visitor'); }
  else {
    const groups = await page.$$('.mk-qs__group');
    const questions = groups.length + (await page.$$('.mk-qs__form .hg-select')).length;
    if (questions > 3) bad(`the quick check asks ${questions} questions — the brief caps it at three`);
    else ok(`${questions} questions, anonymous, on the marketing site`);

    // Answer the three questions the way a person would. The country control is a searchable custom
    // listbox, so the option is clicked rather than typed-and-entered — a keyboard-only path leaves the
    // control unset and the submit button disabled, which is a harness failure dressed as a product one.
    await page.click('.hg-select'); await page.waitForTimeout(600);
    await page.fill('.hg-popover input', '네팔'); await page.waitForTimeout(900);
    const option = page.locator('.hg-popover [role=option], .hg-popover button').filter({ hasText: '네팔' }).first();
    if (await option.count()) await option.click();
    else { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await (await groups[0].$$('.hg-option'))[1].click(); await page.waitForTimeout(400);
    await (await groups[1].$$('.hg-option'))[0].click(); await page.waitForTimeout(600);
    await page.selectOption('#qs-level', '4').catch(() => undefined);
    await page.waitForTimeout(500);
    const submit = page.locator('.mk-qs__go-row button');
    if (await submit.isDisabled()) { bad('the quick check could not be completed — the submit button stayed disabled'); }
    else { await submit.click(); await page.waitForTimeout(5000); }

    const rows = await page.$$eval('.mk-qs__row', (r) => r.map((x) => ({
      href: x.getAttribute('href'), fit: x.querySelector('.mk-qs__fit')?.textContent?.trim(),
    })));
    if (!rows.length) bad('the quick check returned no recommendations');
    else {
      const offsite = rows.filter((r) => !/^\/universities\//.test(r.href || ''));
      if (offsite.length) bad(`${offsite.length} recommendation(s) do not link to a public university page`);
      const noLang = rows.filter((r) => !/lang=/.test(r.href || ''));
      if (noLang.length) bad(`${noLang.length} recommendation link(s) drop the language`);
      const noCtx = rows.filter((r) => !/from=recommendation/.test(r.href || ''));
      if (noCtx.length) bad(`${noCtx.length} recommendation link(s) drop the recommendation context`);
      ok(`${rows.length} recommendations → public university pages, language and context preserved`);
    }
    // No percentage, no promise. A fit is a word (brief §20, §32).
    const text = await page.evaluate(() => document.body.innerText);
    if (/\d{1,3}\s?%/.test(text)) bad('the results show a percentage — the brief forbids an admission probability');
    if (/합격\s*보장|guarantee/i.test(text)) bad('the results promise admission');
    else ok('no probability, no admission promise');
  }
  await page.close();
}

/* --------------------------------------------------------------------- 5. public vs paid, enforced */
head('an account is not a purchase');
{
  const GATED = ['/applications', '/documents', '/essays', '/visa', '/housing', '/arrival', '/messages', '/tasks'];
  // Both halves, because a paywall that also closes the student's own information is a different bug, not
  // a stricter version of the same one. `/compare` and `/budget` are here on purpose: a budget built from
  // published tuition is a public fact, and a plan buys Hangyul's labour rather than access to facts.
  const OPEN = ['/services', '/profile', '/settings', '/more', '/explore', '/compare', '/budget', '/scholarships', '/help'];
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(page, S, 'student.new@demo.hangyul.kr');
  /*
   * Waited for, not slept for — and this one was a hair's breadth from red on an idle machine. The
   * redirect takes 1810–1930 ms here and the sleep was **1800**, so it passed on luck and failed the
   * moment `test:release` ran anything beside it. It then cascaded: the page had not settled, so the
   * paywall-explains-itself check below failed too and the gate reported two defects that were one
   * stopwatch.
   */
  const landed = await page.waitForURL(/\/services/, { timeout: 20_000 }).then(() => true).catch(() => false);
  if (!landed) bad(`an unpaid student lands on ${new URL(page.url()).pathname}, not the plan screen`);
  else ok('unpaid sign-in lands on /services with a reason');

  /*
   * **Wait for the redirect, do not sleep for it.** A fixed 1300 ms is a guess about how long the
   * paywall takes to decide, and under load — three browser gates and a dev server on one machine —
   * it is the wrong guess: this reported `/documents`, `/arrival`, `/messages` and `/tasks` as
   * reachable by an unpaid student when all four were redirecting correctly, just not within the
   * sleep. A timing flake on a security check is worse than no check, because the day it is real it
   * reads the same as the days it was not.
   */
  for (const r of GATED) {
    await page.goto(`${S}${r}?lang=ko`, { waitUntil: 'domcontentloaded' });
    const redirected = await page.waitForURL(/\/services/, { timeout: 15_000 }).then(() => true).catch(() => false);
    if (!redirected) bad(`an unpaid student reaches ${r} (still on ${new URL(page.url()).pathname} after 15s)`);
  }
  ok(`${GATED.length} managed-service routes are closed to an unpaid account`);
  for (const r of OPEN) {
    await page.goto(`${S}${r}?lang=ko`, { waitUntil: 'domcontentloaded' });
    // The opposite assertion, so the opposite wait: give any redirect 1.5 s to happen, then insist
    // none did. There is nothing to wait *for* when the correct behaviour is to stay put.
    await page.waitForTimeout(1500);
    // V22 folded the budget page into Compare (`/budget` → `/compare#budget`, apps/student-web/src/lib/nav.ts); the
    // route still belongs to the account — what this check guards is that it is not the paywall that answers.
    const landed = r === '/budget' ? /\/compare(\?|#|$)/ : new RegExp(`${r}(\\?|$)`);
    if (!landed.test(page.url())) bad(`an unpaid student is locked out of ${r}, which belongs to their account`);
  }
  ok(`${OPEN.length} account and discovery routes stay open without a purchase`);
  // The two aliases of /explore. Gating an alias of an open page would mean a paywall at one URL and the
  // page itself at another — which is how the e2e lifecycle spec found this.
  for (const [alias, dest] of [['/matches', '/explore'], ['/saved', '/explore']]) {
    await page.goto(`${S}${alias}?lang=ko`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname === dest, { timeout: 15_000 }).catch(() => {});
    const where = new URL(page.url()).pathname;
    if (where !== dest) bad(`${alias} sent an unpaid student to ${where}, not to ${dest}`);
  }
  ok('/matches and /saved reach /explore rather than the paywall');

  // And the gate explains itself. Waited for, not slept for — the callout renders after the redirect
  // and after the plan query resolves, which under load is comfortably past any fixed guess.
  await page.goto(`${S}/applications?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/services/, { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('.hg-callout', { timeout: 15_000 }).catch(() => {});
  const notice = await page.$eval('.hg-callout', (e) => e.textContent.trim()).catch(() => '');
  if (!notice) bad('the paywall redirects without saying why');
  else if (/\(.\)/.test(notice)) bad(`the gate notice has an unresolved placeholder: ${notice}`);
  else ok(`the gate explains itself: "${notice.slice(0, 48)}…"`);

  // A paid student is untouched.
  const paid = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await signIn(paid, S, 'student@demo.hangyul.kr');
  /*
   * The mirror of the check above, and the sleeps here were wrong in both directions. Asserting that
   * a paid student is **not** redirected is a negative, so too short a sleep makes it pass by
   * default and a real redirect taking 1600 ms would go unseen; asserting they **can** reach a route
   * is a positive, so too short a sleep fails on a busy machine. Both now settle on the network.
   */
  await paid.waitForLoadState('networkidle').catch(() => {});
  await paid.waitForTimeout(2500);   // a redirect, if one is coming, has had every chance by now
  if (/\/services/.test(paid.url())) bad('a paid student is redirected to the plan screen');
  for (const r of ['/applications', '/documents']) {
    await paid.goto(`${S}${r}?lang=ko`, { waitUntil: 'domcontentloaded' });
    const stayed = await paid.waitForURL((u) => u.pathname.startsWith(r), { timeout: 20_000 })
      .then(() => true).catch(() => false);
    if (!stayed) bad(`a paid student cannot reach ${r} (ended on ${new URL(paid.url()).pathname})`);
  }
  ok('a paid student reaches the managed service unchanged');
  await paid.close();
  await page.close();
}

/* ----------------------------------------------------------- 6. mobile: More is in the bottom bar */
head('on a phone, 더보기 is a bottom tab');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signIn(page, S, 'student@demo.hangyul.kr');
  await page.goto(`${S}/?lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const m = await page.evaluate(() => {
    const bar = document.querySelector('.hg-tabbar');
    const top = document.querySelector('.hg-snav__inner');
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    return {
      tabs: bar ? [...bar.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() })) : [],
      topVisible: top ? [...top.children].filter(visible).length : 0,
      topHasMore: top ? [...top.querySelectorAll('a,button')].filter(visible).some((e) => /more|더보기/i.test(e.textContent || '')) : false,
    };
  });
  if (m.tabs.length !== 5) bad(`the bottom bar has ${m.tabs.length} tabs, expected 5`);
  if (!m.tabs.some((t) => t.href === '/more')) bad('더보기 is not one of the bottom tabs');
  if (m.topHasMore) bad('더보기 is still a visible control in the top bar at 390px');
  if (m.tabs.length === 5 && !m.topHasMore) ok(`bottom bar: ${m.tabs.map((t) => t.text).join(' · ')} — and the top bar has ${m.topVisible} controls`);
  await page.close();
}

/* -------------------------------------------------- 7. overseas card only, and no silent KRW order */
head('payment: overseas card only, USD, and no fallback currency');
{
  const t = await token('student.new@demo.hangyul.kr', 'student');
  const auth = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  const cfg = await fetch(`${API}/api/v1/me/payments/config`, { headers: auth }).then((r) => r.json());
  if (cfg.currency !== 'USD') bad(`the payment config advertises ${cfg.currency}`);
  if (JSON.stringify(cfg.methods_offered) !== JSON.stringify(['OVERSEAS_CARD'])) {
    bad(`methods offered are ${JSON.stringify(cfg.methods_offered)} — only OVERSEAS_CARD may be exposed`);
  }
  for (const k of ['foreign_card_contract', 'card_review', 'usd_multicurrency', 'live_keys']) {
    if (!(k in (cfg.usd_readiness || {}))) bad(`the readiness report is missing "${k}"`);
  }
  ok(`config: USD · OVERSEAS_CARD only · four readiness flags · live USD ${cfg.live_usd_checkout_enabled ? 'enabled' : 'disabled'}`);

  // The contract gate. With USD not contracted, an order must be refused — never downgraded to KRW.
  // Measured as a *change*, not as an absolute: this account survives between runs, and an earlier run of
  // this gate against a broken build is exactly how a stale PENDING row gets there. What must be true is
  // that this refusal opened nothing — not that the table was empty before it.
  const before = await fetch(`${API}/api/v1/me/services`, { headers: auth }).then((x) => x.json());
  const r = await fetch(`${API}/api/v1/me/orders`, { method: 'POST', headers: auth, body: JSON.stringify({ product_code: 'ALL_IN_ONE' }) });
  const body = await r.json();
  // **V21 — there are two routes to USD now.** Until V21 the only question was
  // `live_usd_checkout_enabled`, which is `toss_env === "live" && all four 결제창 contract flags`; the
  // foreign-card key-in MID is a different contract on a different endpoint and the sandbox proves it
  // settles USD (REPORT §229.3). An order is refused only when **neither** route can take the money,
  // so that is what this gate asks. Asking the old question would now assert that the product must
  // not work.
  const cardRoute = cfg.foreign_card?.enabled === true;
  if (cardRoute) {
    if (!r.ok) bad(`the foreign-card route is enabled but an order was refused: ${JSON.stringify(body).slice(0, 160)}`);
    else if (body.currency !== 'USD') bad(`a USD plan opened an order in ${body.currency}`);
    else if (body.status !== 'PENDING') bad(`a new order is already ${body.status} — it is not paid by being created`);
    else if (body.card_form !== true) bad('the route that can take the money is not offered to the student');
    else ok('foreign-card route enabled → a PENDING USD order with Hangyul\'s card form');
    if (cfg.foreign_card.reusable_credential === true && cfg.foreign_card.mid === 'bill_talkoab1') {
      bad('bill_talkoab1 claims a reusable credential; the sandbox issues none (REPORT §229.2)');
    } else ok(`the config is honest about reusable credentials (${cfg.foreign_card.reusable_credential})`);
  } else if (cfg.live_usd_checkout_enabled) {
    if (!r.ok) bad(`USD is contracted but an order was refused: ${JSON.stringify(body).slice(0, 160)}`);
    else if (body.checkout?.amount?.currency !== 'USD') bad(`a contracted USD checkout opened in ${body.checkout?.amount?.currency}`);
    else ok('live USD checkout opens in USD');
  } else {
    if (r.status !== 503 || body.detail?.code !== 'CURRENCY_NOT_CONTRACTED') {
      bad(`USD is not contracted but POST /me/orders answered ${r.status} ${JSON.stringify(body).slice(0, 120)}`);
    } else if (JSON.stringify(body).includes('KRW')) {
      bad('the refusal mentions KRW — there must be no fallback currency');
    } else {
      ok('USD not contracted → 503 CURRENCY_NOT_CONTRACTED, no order opened, no KRW fallback');
    }
    const after = await fetch(`${API}/api/v1/me/services`, { headers: auth }).then((x) => x.json());
    if (JSON.stringify(after.owned ?? []) !== JSON.stringify(before.owned ?? [])) {
      bad('a refused checkout changed what the student owns');
    }
    const was = before.payment?.pending_order_id ?? null;
    const now = after.payment?.pending_order_id ?? null;
    if (now && now !== was) bad(`a PENDING order (${now}) was opened by a refused checkout`);
    else ok(`a refused checkout opens no order${was ? ' (a PENDING row from an earlier run is unchanged)' : ''}`);
  }

  /*
   * The student screen says which card is accepted, in words.
   *
   * It used to say it inside the "해외카드 USD 결제가 아직 활성화되지 않았어요" blocker, which V21
   * removed — and because this read one named element and treated a missing one as an empty string,
   * the requirement silently stopped being met while the gate stayed able to fail only on wording.
   * It now reads **either** place and fails when neither says it, so removing a surface cannot quietly
   * remove the sentence again.
   */
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await signIn(page, S, 'student.new@demo.hangyul.kr');
  await page.goto(`${S}/services?plan=all_in_one&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sv16-order', { timeout: 20_000 });
  const after = await page.evaluate(() => ['.sv21-card__accepts', '.sv16-order__after']
    .map((sel) => document.querySelector(sel)?.textContent?.trim() ?? '')
    .filter(Boolean).join(' | '));
  if (!after) bad('neither the card form nor the checkout line says anything about which card is accepted');
  else if (!/해외|overseas|국제|outside Korea/i.test(after)) bad(`the checkout does not say which card is accepted: "${after}"`);
  else ok('the purchase screen names the overseas card');
  // No Korean-only method may be offered by Hangyul's own layer.
  const forbidden = await page.evaluate(() => {
    const t2 = document.body.innerText;
    // `토스페이(?!먼츠)` — the provider is **토스페이먼츠** (Toss Payments) and naming it is correct and
    // necessary; 토스페이 is the Korean easy-pay wallet and must not be offered. A plain substring match
    // cannot tell them apart and reports the sentence that says "you will be taken to Toss Payments".
    const banned = [/국내\s?카드/, /토스페이(?!먼츠)/, /네이버페이/, /카카오페이/, /\bPAYCO\b/, /계좌이체/, /가상계좌/];
    return banned.filter((re) => re.test(t2)).map((re) => re.source);
  });
  if (forbidden.length) bad(`the checkout layer offers Korean-only methods: ${forbidden.join(', ')}`);
  else ok('no domestic-card or Korean easy-pay option in Hangyul\'s checkout layer');
  await page.close();
}

/* --------------------------------------- 7b. a refusal the student can actually reach becomes an offer */
head('asking for something the plan does not include offers the plan that does');
{
  // This is the one V17 surface that cannot be asserted from source: the upgrade sheet only appears when
  // the *server* refuses, so the gate has to produce a real refusal. A Basic plan sells 지원 학교 최대 0곳,
  // so moving a draft application forward is refused with `entitlement_exceeded` — which is exactly the
  // moment the brief says to show the next plan.
  const t = await token('student40@demo.hangyul.kr', 'student');
  const auth = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  const svc = await fetch(`${API}/api/v1/me/services`, { headers: auth }).then((r) => r.json());
  if (!(svc.owned || []).includes('BASIC')) {
    bad(`student40 is expected to hold BASIC (owns ${JSON.stringify(svc.owned)}) — the refusal cannot be produced`);
  } else {
    const page1 = await fetch(`${API}/api/v1/programs?page=1&page_size=20`, { headers: auth }).then((r) => r.json());
    const programs = page1.items ?? [];
    if (!programs.length) bad('no program to draft an application against');
    else {
      // Reuse a draft if the gate has run before; a second one would be a second row for no reason. And
      // when there is none, try programmes in turn: one intake per student, so a programme this account
      // has already applied to — or withdrawn from — answers 409 and is not an error, just the wrong one.
      const mine = await fetch(`${API}/api/v1/applications?page=1&page_size=50`, { headers: auth }).then((r) => r.json());
      let app = (mine.items ?? []).find((a) => a.status === 'DRAFT');
      let lastRefusal = '';
      for (const prog of programs) {
        if (app) break;
        const made = await fetch(`${API}/api/v1/applications`, {
          method: 'POST', headers: auth, body: JSON.stringify({ program_id: prog.id }),
        });
        if (made.status === 201) app = await made.json();
        else lastRefusal = `${made.status} ${(await made.text()).slice(0, 120)}`;
      }
      if (!app) bad(`could not create a draft application on any of ${programs.length} programmes: ${lastRefusal}`);
      if (app) {
        // First: the server really does refuse, and says why in the shape the client reads.
        const transitions = await fetch(`${API}/api/v1/applications/${app.id}`, { headers: auth }).then((r) => r.json());
        const forward = (transitions.allowed_transitions ?? []).find((x) => x !== 'DRAFT' && x !== 'WITHDRAWN');
        const refusal = await fetch(`${API}/api/v1/applications/${app.id}/transition`, {
          method: 'POST', headers: auth, body: JSON.stringify({ to: forward }),
        });
        const detail = (await refusal.json()).detail;
        if (refusal.status !== 409 || detail?.error !== 'entitlement_exceeded') {
          bad(`moving a Basic student's draft forward answered ${refusal.status} ${JSON.stringify(detail).slice(0, 120)} — expected a 409 entitlement_exceeded`);
        } else if (detail.entitlement_key !== 'max_managed_applications') {
          bad(`the refusal names ${detail.entitlement_key}, expected max_managed_applications`);
        } else {
          ok(`the server refuses with its own numbers: ${detail.entitlement_key} ${detail.used}/${detail.limit}`);
        }

        // (Withdrawing a draft must not be rationed either — that is a server rule and it is asserted where
        // server rules belong, in `server/tests/test_v17_usd_refunds.py`. Driving it here would leave a
        // withdrawn application behind on every run, and a gate that accumulates rows is a gate that
        // eventually fails for reasons that are not the product's.)

        // Then: the student sees the next plan, not an error toast.
        //
        // Driven through the **essay** rather than the application, because that is the refusal a student
        // can actually reach from a screen: an application's forward action is not offered while its
        // checklist is unfinished, whereas 보내기 on a personal statement is one click and spends an
        // `essay_review_rounds` allowance that Basic sells none of.
        const essays = await fetch(`${API}/api/v1/essays`, { headers: auth }).then((x) => x.json());
        const essay = (essays.items ?? [])[0];
        if (!essay) bad('no essay to submit for review — the upgrade sheet has no reachable trigger');
        else {
          // A draft long enough for the editor to allow sending. Saved through the same endpoint the
          // editor uses, so the essay is in exactly the state a student's own typing would leave it in.
          const draft = '이 글은 게이트가 심사 요청을 실제로 거절당하게 만들기 위해 쓴 초안입니다. '.repeat(12);
          const saved = await fetch(`${API}/api/v1/essays/${essay.id}`, {
            method: 'PUT', headers: auth, body: JSON.stringify({ body: draft, new_version: true }),
          });
          if (!saved.ok) bad(`could not save an essay draft: ${saved.status} ${(await saved.text()).slice(0, 120)}`);
          const page = await browser.newPage();
          await signIn(page, S, 'student40@demo.hangyul.kr');
          await page.goto(`${S}/essays/${essay.id}?lang=ko`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2500);
          const send = page.locator('button', { hasText: /검토 요청|Submit for review/ }).first();
          await send.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
          if (!(await send.count())) bad('the essay editor offers no way to send a draft for review');
          else {
          await send.click();
          // The editor confirms first, and its send button stays disabled until the student ticks the
          // authorship statement — which is a V6 rule worth keeping, so the gate ticks it rather than
          // reaching past it.
          const attest = page.locator('.sw-attest input[type=checkbox]').first();
          await attest.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
          if (!(await attest.count())) bad('the submit dialog offers no authorship statement to confirm');
          else await attest.check();
          const confirmBtn = page.locator('.hg-modal button.hg-btn--primary').first();
          await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
          if (await confirmBtn.count()) await confirmBtn.click();
          const sheet = page.locator('.sv17-up');
          const appeared = await sheet.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
          if (!appeared) bad('a refused action showed no upgrade sheet — the student met a generic error instead of the next plan');
          else {
            const m = await page.evaluate(() => {
              const el = document.querySelector('.sv17-up');
              return {
                heading: el.querySelector('h2')?.textContent?.trim() ?? '',
                cta: el.querySelector('a')?.getAttribute('href') ?? '',
                amount: el.querySelector('.sv17-up__facts strong')?.textContent?.trim() ?? '',
                tables: el.querySelectorAll('table').length,
                ctas: el.querySelectorAll('a').length,
                toast: document.querySelectorAll('.hg-toast--error').length,
              };
            });
            if (/essay_review_rounds|max_managed_applications|undefined/.test(m.heading)) bad(`the sheet prints a database column: "${m.heading}"`);
            if (!m.cta.includes('upgrade=')) bad(`the sheet's CTA does not carry the plan: ${m.cta}`);
            if (!/\$/.test(m.amount)) bad(`the sheet's amount is not a USD figure: "${m.amount}"`);
            if (m.tables) bad('the sheet shows a comparison table — the brief rules one out by name');
            if (m.ctas !== 1) bad(`the sheet offers ${m.ctas} links; it must offer exactly one`);
            if (m.toast) bad('an error toast appeared alongside the sheet — one refusal, one explanation');
            ok(`the sheet says "${m.heading}" → ${m.cta} at ${m.amount}, one CTA, no table`);
          }
          }
          await page.close();
        }
      }
    }
  }
}

/* ------------------------------------------------------------- 8. refunds exist, technically */
head('a paid order can be refunded');
{
  const t = await token('student@demo.hangyul.kr', 'student');
  const auth = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  const orders = await fetch(`${API}/api/v1/me/orders`, { headers: auth }).then((r) => r.json());
  const paidOrder = (orders || []).find((o) => o.status === 'PAID');
  if (!paidOrder) { bad('the seeded student has no paid order to test a refund against'); }
  else {
    // Refusals first: they must not need a provider, and must not need a policy.
    const over = await fetch(`${API}/api/v1/me/orders/${paidOrder.id}/refund`, {
      method: 'POST', headers: auth, body: JSON.stringify({ amount_minor: paidOrder.amount_minor * 10, reason: 'gate: over-refund' }),
    });
    if (over.status !== 409) bad(`refunding more than was paid answered ${over.status}, expected 409`);
    else ok('a refund larger than the payment is refused with 409');
    const missing = await fetch(`${API}/api/v1/me/orders/${paidOrder.id}/refund`, {
      method: 'POST', headers: auth, body: JSON.stringify({ reason: 'gate: no amount' }),
    });
    if (missing.status !== 422) bad(`a refund with no amount answered ${missing.status}, expected 422 — the amount must never default`);
    else ok('a refund with no amount is refused — the server does not invent one');
  }
}

/* -------------------------------------------------------------- 9. university enrichment is honest */
head('university content: real coverage, real provenance');
{
  const file = join(ROOT, 'server/app/data/university_enrichment.json');
  if (!existsSync(file)) bad('no enrichment file — run scripts/catalog/enrich_universities.py');
  else {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const recs = Object.values(doc.records);
    if (doc.institutions !== 425) bad(`the enrichment run covered ${doc.institutions} institutions, expected 425`);
    // Every stored media item must carry a licence we checked, and it must be a reusable one.
    const BAD_LICENCE = recs.flatMap((r) => [r.logo, r.hero].filter(Boolean))
      .filter((m) => !m.licence || !/public domain|^pd$|^cc0|cc[- ]by/i.test(m.licence));
    if (BAD_LICENCE.length) bad(`${BAD_LICENCE.length} stored media item(s) have no verified reusable licence`);
    else ok(`${recs.filter((r) => r.logo).length} logos + ${recs.filter((r) => r.hero).length} hero images, every one licence-checked`);
    const noProv = recs.filter((r) => !r.source_url || !r.verified_at);
    if (noProv.length) bad(`${noProv.length} enrichment record(s) have no source or verification date`);
    else ok(`${recs.length} records, all with a source URL and a verified date`);
    // An official channel must come from the institution's own item, not from a search.
    const badYt = recs.filter((r) => r.youtube && r.youtube.source !== 'wikidata:P2397');
    if (badYt.length) bad(`${badYt.length} YouTube channel(s) are not from the institution's own record`);
    else ok(`${recs.filter((r) => r.youtube).length} official channels, all from the institution's own record`);
  }
  const csv = join(ROOT, 'docs/qa/v17/UNIVERSITY_ENRICHMENT.csv');
  if (!existsSync(csv)) bad('docs/qa/v17/UNIVERSITY_ENRICHMENT.csv is missing');
  else {
    const lines = readFileSync(csv, 'utf8').trim().split('\n');
    if (lines.length !== 426) bad(`the coverage CSV has ${lines.length - 1} rows, expected 425`);
    else ok('coverage CSV: 425 rows, one per institution');
  }

  // The page leads with the institution, not with the registry table.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  for (const slug of ['kaist', 'seoul-national-university']) {
    await page.goto(`${M}/universities/${slug}?lang=ko&from=recommendation`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const order = await page.$$eval('h1, h2', (hs) => hs.map((h) => h.textContent.trim()));
    const table = order.findIndex((h) => /학교 개요/.test(h));
    if (table === 1) bad(`${slug}: 학교 개요 is still the first content section`);
    // V20 renamed both elements when the detail page moved to the shared university presentation:
    // `.mk-uni__from` → `.hg-uni-hero__from`, `.mk-uni__head` → `.hg-uni-hero`. Both assertions are
    // unchanged — the recommendation context is still carried onto the page, and the first viewport
    // still must not lead with a deadline.
    const ctx = await page.$$eval('.hg-uni-hero__from', (e) => e.length);
    if (!ctx) bad(`${slug}: the recommendation context is not carried onto the page`);
    const deadlineFirst = await page.evaluate(() => {
      const first = document.querySelector('.hg-uni-hero');
      return first ? /마감|deadline/i.test(first.innerText) : false;
    });
    if (deadlineFirst) bad(`${slug}: the first viewport leads with a deadline`);
  }
  ok('university pages lead with the institution; the registry table follows');
  await page.close();
}

/* ------------------------------------------------------- 10. the server-free review bundle */
if (process.env.SKIP_BUILD === '1') {
  head('server-free review bundle — SKIP_BUILD=1, not run');
} else {
  head('the review bundle runs with no server');
  const OUT = join(ROOT, 'dist-review');
  if (!existsSync(OUT)) bad('dist-review/ is missing — run npm run review:build');
  else {
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    const files = walk(OUT);
    const leaks = files.filter((f) => /\.(js|css|html|json)$/.test(f))
      .filter((f) => /localhost:(8000|8001|310\d)|127\.0\.0\.1:(8000|8001|310\d)/.test(readFileSync(f, 'utf8')));
    if (leaks.length) bad(`${leaks.length} emitted file(s) reference a localhost origin`);
    else ok(`${files.length} files, ${(files.reduce((s, f) => s + statSync(f).size, 0) / 1e6).toFixed(0)} MB, no localhost reference`);

    // And it must actually render with nothing behind it. Served over file:// equivalent — a plain static
    // host — with every API origin blocked at the browser.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await ctx.route('**://localhost:800{0,1}/**', (r) => r.abort());
    await ctx.route('**://127.0.0.1:800{0,1}/**', (r) => r.abort());
    const page = await ctx.newPage();
    const calls = [];
    page.on('request', (r) => { if (/:(8000|8001)\//.test(r.url())) calls.push(r.url()); });
    const BASE = process.env.REVIEW_BASE ?? 'http://127.0.0.1:4173';
    for (const [name, path] of [['marketing', '/marketing/'], ['student', '/student/'], ['agency', '/agency/'], ['university', '/university/']]) {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!res) { bad(`review ${name}: could not be served from ${BASE}${path} (is the static server running?)`); continue; }
      await page.waitForTimeout(2800);
      const text = await page.evaluate(() => document.body.innerText);
      if (/We couldn't find that page|404/.test(text.slice(0, 200))) bad(`review ${name}: renders a 404 at its own root`);
      else if (/error|오류/i.test(text.slice(0, 80))) bad(`review ${name}: opens with an error — "${text.slice(0, 80)}"`);
      else ok(`review ${name}: renders`);
      // The preview must look like the product, not like a test site (brief §43).
      const leak = /\b(DEMO|FIXTURE|MOCK DATA|DEV MODE)\b/.exec(text);
      if (leak) bad(`review ${name}: shows "${leak[0]}" in the UI`);
    }
    // Every link the bundle's own index offers, because a tour nobody walked is a tour with three 404s on
    // it — which is exactly what the first published index had (REPORT §162.2). The four roots above are
    // the shells; these are the pages a stakeholder actually clicks.
    const TOUR = [
      ['marketing', ['start', 'universities', 'universities/kaist']],
      ['student', ['explore', 'applications', 'services', 'more']],
      ['agency', ['students', 'tasks']],
      ['university', ['applicants', 'programs']],
    ];
    let broken = 0;
    for (const [app, paths] of TOUR) {
      for (const path of paths) {
        const page = await ctx.newPage();
        await page.goto(`${BASE}/${app}/${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(2200);
        const text = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
        if (/We couldn't find that page|Page not found|찾을 수 없/.test(text)) { bad(`review ${app}/${path}: renders a 404 page`); broken += 1; }
        else if (text.length < 200) { bad(`review ${app}/${path}: renders only ${text.length} characters`); broken += 1; }
        await page.close();
      }
    }
    if (!broken) ok(`${TOUR.reduce((n, [, p2]) => n + p2.length, 0)} tour links render real content`);

    if (calls.length) bad(`${calls.length} request(s) to an API origin in the review build`);
    else ok('zero requests to any API origin');
    await ctx.close();
  }
}

/* ------------------------------- 11. the native student app, and the one rule it must not break */
head('the native app is a product, and it still has no payment of its own');
{
  const M_ROOT = resolve(ROOT, 'apps/student-mobile');
  const read = (rel) => { try { return readFileSync(resolve(M_ROOT, rel), 'utf8'); } catch { return null; } };

  // The bottom bar: five tabs, and 더보기 is one of them (brief §36).
  const tabs = read('app/(tabs)/_layout.tsx') ?? '';
  const names = [...tabs.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
  if (names.length !== 5) bad(`the native tab bar declares ${names.length} tabs, expected 5 (${names.join(', ')})`);
  else if (!names.includes('more')) bad(`더보기 is not a native tab (${names.join(', ')})`);
  else if (names.includes('profile')) bad('프로필 is still a tab — V17 moves it inside 더보기');
  else ok(`native tabs: ${names.join(' · ')}`);

  // The screens the brief asks the app to have. Each is a file, so this fails if one is deleted.
  const WANT = {
    home: 'app/(tabs)/index.tsx', universities: 'app/(tabs)/explore.tsx', applications: 'app/(tabs)/applications.tsx',
    messages: 'app/(tabs)/messages.tsx', more: 'app/(tabs)/more.tsx',
    'university detail': 'app/universities/[slug].tsx', 'application detail': 'app/applications/[id].tsx',
    documents: 'app/documents/index.tsx', 'document detail': 'app/documents/[id].tsx', thread: 'app/messages/[id].tsx',
    notifications: 'app/notifications.tsx', visa: 'app/visa.tsx', tasks: 'app/tasks.tsx', saved: 'app/saved.tsx',
    plan: 'app/services.tsx', profile: 'app/profile.tsx', settings: 'app/settings.tsx',
  };
  const missing = Object.entries(WANT).filter(([, f]) => read(f) === null).map(([k]) => k);
  if (missing.length) bad(`the native app is missing ${missing.length} screen(s): ${missing.join(', ')}`);
  else ok(`${Object.keys(WANT).length} native screens, including plan · profile · settings`);

  // **One backend state machine.** The native app may not open a payment window, confirm a payment, or
  // carry a provider key. If any of this ever appears here, there are two sources of truth about whether
  // a student has paid — which is how one gets charged twice.
  /** Code only. `src/plan.ts` names the web endpoints it deliberately does *not* call, and a scan that
   *  reads prose reports that explanation as the very thing it is explaining. */
  const decomment = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const sources = [];
  const walkDir = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = resolve(dir, e.name);
      if (e.isDirectory()) walkDir(full);
      else if (/\.(ts|tsx|json)$/.test(e.name)) sources.push([full.replace(`${M_ROOT}/`, ''), decomment(readFileSync(full, 'utf8'))]);
    }
  };
  walkDir(resolve(M_ROOT, 'app'));
  walkDir(resolve(M_ROOT, 'src'));
  sources.push(['app.json', read('app.json') ?? '']);  // JSON has no comments; `webUrlNotes` is prose, and
  // it names no endpoint, so it is scanned as written.
  const BANNED = [
    [/tosspayments/i, 'the Toss SDK'],
    [/requestPayment/, 'a payment window call'],
    [/confirmToss|payments\/toss\/confirm/, 'a payment confirmation'],
    [/payment_key|paymentKey/, 'a provider payment key'],
    [/test_ck_|live_ck_|test_sk_|live_sk_/, 'a provider key'],
    [/me\.createOrder|\/me\/orders/, 'order creation'],
  ];
  const found = [];
  for (const [file, text] of sources) {
    for (const [re, what] of BANNED) if (re.test(text)) found.push(`${what} in ${file}`);
  }
  if (found.length) bad(`the native app implements payment itself: ${[...new Set(found)].join('; ')}`);
  else ok('no payment window, no confirmation, no order creation and no provider key in the native app');

  // What it does instead: open the web checkout and come back by deep link.
  const plan = read('src/plan.ts') ?? '';
  if (!/getWebAppUrl\(\)/.test(plan) || !/\/services/.test(plan)) bad('src/plan.ts does not open the web checkout');
  else if (!/Linking\.createURL|Linking\.openURL/.test(plan)) bad('src/plan.ts does not hand off through the system browser');
  else if (!/\breturn=\$\{encodeURIComponent\(back\)\}/.test(plan)) bad('the handoff passes no deep link back to the app');
  else ok('checkout opens the web /services in the system browser, with a deep link back');

  // The generated flag module must match `apps/flags/` — a stale one is a set of flags that are quietly wrong.
  //
  // V19: this said `!== 32` and so failed the moment the owner opened Myanmar as the 33rd market — the same
  // literal V18 corrected at `EXPECTED_MARKETS` and missed in three other places in this file. The count is
  // taken from the canonical market list now, so opening or closing a market moves one number and this gate
  // keeps testing what it is for: that the generated module is **in step with `apps/flags`**, not that it
  // holds any particular number.
  try {
    execFileSync('node', [resolve(ROOT, 'scripts/i18n/generate-flag-module.mjs'), '--check'], { stdio: 'pipe' });
    const mod = readFileSync(resolve(ROOT, 'packages/mobile-ui/src/flags.generated.ts'), 'utf8');
    const n = (mod.match(/^ {2}"[^"]+": "/gm) ?? []).length;
    if (n !== EXPECTED_MARKETS) bad(`the native flag module holds ${n} flags, expected ${EXPECTED_MARKETS}`);
    else ok(`${n} flags inlined for the native bundle, in step with apps/flags`);
  } catch (e) {
    bad(`the native flag module is out of date or unreadable: ${String(e.message ?? e).slice(0, 120)}`);
  }

  const scheme = JSON.parse(read('app.json') ?? '{}')?.expo?.scheme;
  if (!scheme) bad('the native app declares no URL scheme, so the deep link back cannot resolve');
  else ok(`the app answers on ${scheme}://`);

  // And the web side will not forward a student to anything else. The allowlist is asserted by
  // `apps/student-web/src/lib/v17.test.ts`; what the gate checks is that it is *used*.
  const handoff = readFileSync(resolve(ROOT, 'apps/student-web/src/lib/apphandoff.ts'), 'utf8');
  const ret = readFileSync(resolve(ROOT, 'apps/student-web/src/pages/PaymentReturn.tsx'), 'utf8');
  // Backslashes stripped so the source's `/^hangyul-student:\/\//i` reads as the scheme it anchors on.
  if (!handoff.replace(/\\/g, '').includes(`^${scheme}:`)) bad(`the return-link allowlist does not name ${scheme}`);
  else if (!/appReturn\(\)/.test(ret)) bad('the payment confirmation does not offer the way back to the app');
  else if (/window\.location\s*=|location\.replace\(/.test(ret)) bad('the confirmation navigates itself to the app scheme — it must be a link the student taps');
  else ok('the way back is validated against the app scheme and offered as a link, not followed');
}

await browser.close();
console.log('');
if (problems.length) {
  console.log(`V17 gate: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('V17 gate: OK');
