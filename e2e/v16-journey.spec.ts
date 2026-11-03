/**
 * V16 — the purchase journey, end to end, as a prospective student walks it (brief Parts 14 and 34).
 *
 * The claim being tested is not "the API works" — `server/tests/test_v16_payments.py` does that. It is the
 * owner's standard: **a student should never have to ask "do I need to pay now?", "where do I pay?",
 * "did it work?" or "what do I do next?"**. So each step here asserts the *words on the screen* as well as
 * the state behind them, and counts the clicks it took to get there.
 *
 * The one thing it cannot do is complete the payment: Toss's test 결제창 hands off to the card issuer's own
 * 3-D Secure page (`vbv.shinhancard.com`) or to a real Toss Pay login, neither of which can be driven
 * without real credentials. So the journey is asserted up to the moment the provider's window is open with
 * the right order on it, and the server legs on either side of that window — confirmation, idempotency,
 * recovery, cancellation — are asserted directly.
 *
 * ---------------------------------------------------------------------------------------------------------
 * **V17 changed two things about this journey and neither is a correction of V16.**
 *
 *   1. The plan CTA goes straight to `/register?next=/services?plan=…` (brief §23). V13's rule — that a
 *      conversion action must not open a password field — still holds for the *undirected* CTA, which opens
 *      the free quick check; applying it to the plan button made a visitor who had already chosen answer
 *      three questions in order to buy. The quick check also moved to the marketing site (§155.4).
 *   2. The plans are priced in **USD** and the merchant holds KRW, so the server refuses to open an order at
 *      all (`503 CURRENCY_NOT_CONTRACTED`, §161). The payment-window legs therefore cannot run, and they
 *      **skip with the reason named** rather than being deleted — the moment the contract lands they run
 *      again untouched. What still runs, and is the more important half, is that the refusal is a sentence
 *      rather than an error and that nothing is created by it.
 */
import { expect, test } from '@playwright/test';

import { API, PASSWORD, qaTestCard, registerViaUi, uiLogin, URLS } from './helpers';

const unique = () => `e2e-v16-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;

test.describe('V16 — marketing → auth → plan → payment', () => {
  test('a new student reaches the point of payment in three clicks, and is never unsure whether payment is due', async ({ page, request }) => {
    const clicks: string[] = [];
    const click = async (what: string, locator: ReturnType<typeof page.locator>) => {
      clicks.push(what);
      await locator.click();
    };

    // ---- 1. the homepage, and the plan the owner recommends
    await page.goto(`${URLS.marketing}/?lang=ko`);
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const recommended = page.locator('.kn-plan[data-recommended] .kn-plan__cta');
    await expect(recommended).toBeVisible();
    // The price says, on the homepage, that this is a single payment. That sentence has to exist before the
    // student commits to anything, or 결제하고 시작하기 later is a surprise.
    await expect(page.locator('.kn-plan[data-recommended] .kn-plan__once')).toContainText('1회');
    await click('올인원으로 시작', recommended);

    // ---- 2. registration, with the plan and the language intact
    //
    // V17 (brief §23): the plan button goes to the account, not through the quick check. A visitor who has
    // already chosen a plan should not have to answer three questions to buy it; the quick check is for the
    // visitor who has *not* chosen, and it is the undirected CTA that opens it.
    await page.waitForURL((u) => u.href.startsWith(URLS.student), { timeout: 30_000 });
    await expect(page).toHaveURL(/\/register/);
    // The plan rides in `?next=`, percent-encoded, so decode before asserting rather than matching the
    // encoding — which is a detail of how a URL is written, not of where the student is going.
    expect(decodeURIComponent(page.url())).toContain('/services?plan=all_in_one');
    await expect(page).toHaveURL(/lang=ko/);
    const email = unique();
    // V22: the four-step verified sign-up (email code · SMS code · granular consent) replaces the one-form
    // register; the plan still rides in `?next=` and the student lands on the plan screen afterwards.
    await registerViaUi(page, request, { email, password: PASSWORD, full_name: 'V16 Journey', nationality: 'VN', phone_country: 'VN' });

    // ---- 3. the plan screen, which must answer "do I pay now?" without being asked
    await page.waitForURL(/\/services/, { timeout: 60_000 });
    const order = page.locator('.sv16-order');
    await expect(order).toBeVisible();
    await expect(order).toContainText('올인원');
    /*
     * **The price is `$349`, not `US$349`.** V17 asserted Intl's default Korean form, `US$349`; V20
     * replaced it with `currencyDisplay: 'narrowSymbol'` because the owner asked for `$179`, not
     * `US$179`. This assertion was never updated, so it had been encoding the retired rule — it now
     * asserts the current one in both directions. The won figure stays retired.
     */
    await expect(order).toContainText('$349');
    await expect(order).not.toContainText('US$');
    await expect(order).not.toContainText('499,000');
    await expect(order).toContainText('1회 결제');
    // The primary action names the act. "선택하기" is what V15 said and is what made this the hole it was.
    const pay = order.locator('.sv21-card__pay, .sv16-order__pay');
    await expect(pay.first()).toContainText('결제');
    /*
     * **V21 — the student is told what kind of card works, not where they are about to go.** There is
     * no longer anywhere to go: the card form is Hangyul's own and the charge happens in place, so
     * "you will be taken to Toss" would be false. What matters to a student in Hanoi is that a
     * non-Korean card is the expected instrument (REPORT §239.3).
     */
    await expect(order.locator('.sv21-card__accepts, .sv16-order__after').first())
      .toContainText(/해외|overseas|국제/);
    // No modal maze: one surface, and it is this page.
    await expect(page.locator('.hg-modal, [role=dialog]')).toHaveCount(0);

    /*
     * ---- 4. paying
     *
     * **V21 rewrote this step, because V21 rewrote the act.** Until V21 "pressing pay" opened Toss's
     * own window, and this asserted the two outcomes a contract could produce: the window, or a
     * refusal that created nothing. There is no window now — the card form is Hangyul's own and the
     * charge happens in place (REPORT §236) — so the honest version of this step is to pay, and to
     * check that the plan is on afterwards and was not on before.
     *
     * The card number is not written here; it is in the untracked env (REPORT §237.1).
     */
    const cfgToken = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD, client: 'student' } })
      .then((r) => r.json()).then((j) => j.access_token as string);
    const auth = { Authorization: `Bearer ${cfgToken}` };
    const cfg = await request.get(`${API}/me/payments/config`, { headers: auth }).then((r) => r.json());

    if (!cfg.foreign_card?.enabled && !cfg.live_usd_checkout_enabled) {
      // Neither route can take the money: a sentence, not a red wall, and nothing created.
      await click('결제하고 시작하기', pay.first());
      await expect(order).toContainText(/USD|해외카드/, { timeout: 20_000 });
      const svc0 = await request.get(`${API}/me/services`, { headers: auth }).then((r) => r.json());
      expect(svc0.owned, 'a refused checkout must not grant a plan').toEqual([]);
      expect(svc0.payment?.pending_order_id ?? null, 'a refused checkout must not open an order').toBeNull();
      expect(clicks.length, `clicks: ${clicks.join(' → ')}`).toBeLessThanOrEqual(3);
      test.skip(true, `no route can take ${cfg.currency} on this merchant`);
      return;
    }

    const pan = qaTestCard();
    test.skip(!pan, 'HG_QA_TEST_CARD is not set, so the card form cannot be completed here');

    /*
     * **Three clicks and zero modals** from 올인원으로 시작 to the point of payment, across three pages
     * (homepage → /register → /services). V15 took six and ended in a modal whose first element was a
     * warning that the payment was not real; V16 removed the modal and took five; V17 removed the
     * quick check from this path. The card form *is* the point of payment and is already on screen,
     * so the count is taken here, before anything is typed.
     */
    expect(clicks.length, `clicks: ${clicks.join(' → ')}`).toBeLessThanOrEqual(3);

    /*
     * Nothing is bought, and — unlike V16 — nothing is even *created* yet. Pressing pay used to open
     * a provider window, so an order had to exist before the student saw it; the card form creates
     * the order when the card is submitted, so simply reaching this screen leaves no PENDING row
     * behind for every visitor who looked at a price and changed their mind.
     */
    const before = await request.get(`${API}/me/services`, { headers: auth }).then((r) => r.json());
    expect(before.owned, 'reaching the card form must not grant a plan').toEqual([]);
    expect(before.payment?.pending_order_id ?? null, 'reaching the card form must not open an order').toBeNull();

    await page.fill('input[autocomplete="cc-number"]', pan as string);
    await page.fill('input[autocomplete="cc-exp"]', '12/30');
    await page.fill('input[autocomplete="cc-name"]', 'E2E JOURNEY');
    await expect(pay.first()).toBeEnabled();
    await click('이 카드로 결제하기', pay.first());

    // The plan is on, in place, with no provider window at any point.
    await expect(page.locator('iframe[src*="tosspayments"]')).toHaveCount(0);
    await expect
      .poll(async () => (await request.get(`${API}/me/services`, { headers: auth }).then((r) => r.json())).owned,
        { timeout: 60_000, message: 'the plan should be active once the card is charged' })
      .toContain('ALL_IN_ONE');

    /*
     * ---- 5. abandoning a payment is a notice, not an error
     *
     * This used to cancel the order the window had been opened for. The journey above now pays that
     * order, so abandoning is exercised on a fresh one — the student has their plan and is looking at
     * an upgrade they then walk away from, which is the same surface and a situation that actually
     * occurs.
     */
    // V29: a student who holds a plan cannot open a second plan order — upgrade pricing is an owner decision not yet
    // taken, so the server refuses rather than charging an unapproved amount (REPORT §401). No order is left behind.
    const second = await request.post(`${API}/me/orders`, { headers: auth, data: { product_code: 'PREMIUM' } });
    expect(second.status()).toBe(409);
    expect((await second.json()).detail.code).toBe('UPGRADE_POLICY_REQUIRED');
    await page.goto(`${URLS.student}/services?plan=premium&payment=cancelled&lang=ko`);
    await expect(page.locator('.hg-callout')).toContainText('취소');
    // No red wall.
    await expect(page.locator('.hg-callout[data-tone=danger], .hg-callout--danger')).toHaveCount(0);

    // ---- 6. a forged confirmation cannot buy anything, and does not disturb what was bought honestly.
    const forged = await request.post(`${API}/me/payments/toss/confirm`, {
      headers: auth,
      data: { payment_key: 'tviva_forged_0001', order_id: crypto.randomUUID(), amount: 1000 }, // V29: no second order exists to forge against
      failOnStatusCode: false,
    });
    expect([404, 409]).toContain(forged.status());
    const after = await request.get(`${API}/me/services`, { headers: auth }).then((r) => r.json());
    expect(after.owned, 'a forged confirmation must not add a plan').toEqual(['ALL_IN_ONE']);
  });

  test('the success screen says what was bought and offers exactly one way forward', async ({ page }) => {
    // Rendered against a known paid order rather than a live approval, because what is under test here is
    // the screen's answer to "did it work and what now", not the provider.
    await uiLogin(page, 'student', 'student@demo.hangyul.kr', PASSWORD, 'ko');
    await page.goto(`${URLS.student}/services?lang=ko`);
    // A student who already owns a plan is not sold to again (brief Part 21).
    await expect(page.locator('.sv15-current')).toBeVisible();
    await expect(page.locator('.sv16-order')).toHaveCount(0);
    // The purchase history lives here and nowhere else — no new top-level destination (brief Part 24).
    await expect(page.locator('.sv16-history')).toBeVisible();
    await expect(page.locator('.hg-snav__link', { hasText: /결제|Payment/ })).toHaveCount(0);
  });

  test('a cancelled payment never loses the plan the student picked on the homepage', async ({ page }) => {
    await uiLogin(page, 'student', 'student.new@demo.hangyul.kr', PASSWORD, 'ko');
    await page.goto(`${URLS.student}/services?plan=premium&payment=cancelled&lang=ko`);
    await expect(page.locator('.sv16-order')).toContainText('프리미엄');
    await expect(page.locator('.sv15-plan[data-selected]')).toHaveAttribute('aria-labelledby', 'plan-PREMIUM');
  });
});
