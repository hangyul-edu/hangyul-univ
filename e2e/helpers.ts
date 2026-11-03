import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'Hangyul!2026';
// V8: overridable so the suite can run against an isolated stack (scripts/qa/e2e-run.mjs) without touching the dev stack.
const E = process.env;

/**
 * The Toss sandbox card number, for the one spec that pays.
 *
 * It is **not** written down in this repository: §58 requires that a scan of the tree find no card
 * number, and a scanner cannot tell a published sandbox PAN from a real one. It lives in the
 * untracked `server/.env` beside the Toss keys, which the e2e process does not otherwise load.
 */
export function qaTestCard(): string | null {
  if (E.HG_QA_TEST_CARD) return E.HG_QA_TEST_CARD;
  try {
    // `join(__dirname, …)` rather than `import.meta.url`: Playwright transpiles these specs to CJS.
    const body = readFileSync(join(__dirname, '..', 'server', '.env'), 'utf8');
    const line = body.split('\n').find((l) => l.startsWith('HG_QA_TEST_CARD='));
    return line ? line.slice('HG_QA_TEST_CARD='.length).trim().replace(/^["']|["']$/g, '') : null;
  } catch { return null; }
}
export const API_ORIGIN = E.HG_E2E_API ?? 'http://localhost:8001';
export const API = `${API_ORIGIN}/api/v1`;
export const URLS = {
  marketing: E.HG_E2E_MARKETING ?? 'http://localhost:3100',
  student: E.HG_E2E_STUDENT ?? 'http://localhost:3101',
  agency: E.HG_E2E_AGENCY ?? 'http://localhost:3102',
  university: E.HG_E2E_UNIVERSITY ?? 'http://localhost:3103',
};

export async function uiLogin(page: Page, app: keyof typeof URLS, email: string, password = PASSWORD, locale = 'en') {
  await page.goto(`${URLS[app]}/login`);
  // The student app opens in the account's saved language unless one was chosen on this device; tests choose explicitly.
  await page.evaluate((l) => { try { localStorage.setItem('hg.locale', l); } catch { /* ignore */ } }, locale);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

export async function apiLogin(request: APIRequestContext, email: string, client: 'student' | 'agency' | 'university', password = PASSWORD) {
  const r = await request.post(`${API}/auth/login`, { data: { email, password, client } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const token = (await r.json()).access_token as string;
  return { Authorization: `Bearer ${token}` };
}

/**
 * V22 — create a student through the real four-step flow (signup session → email code → SMS code → register).
 * The codes are read through the development-only peek route, which does not exist in production.
 */
export async function registerStudent(
  request: APIRequestContext,
  opts: { email: string; password: string; full_name: string; locale?: string; nationality?: string; phone?: string; phone_country?: string },
): Promise<Record<string, string>> {
  const sess = await request.post(`${API}/auth/signup/session`, { data: { captcha_token: null, locale: opts.locale ?? 'en' } });
  expect(sess.ok(), await sess.text()).toBeTruthy();
  const H = { 'X-Signup-Session': (await sess.json()).signup_session as string };
  const country = opts.phone_country ?? opts.nationality ?? 'VN';
  const phone = opts.phone ?? `0912${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  const prove = async (channel: 'EMAIL' | 'SMS', target: string) => {
    const s = await request.post(`${API}/auth/verification/send`, { headers: H, data: { channel, target, phone_country: country, purpose: 'SIGNUP', locale: opts.locale ?? 'en' } });
    expect(s.ok(), await s.text()).toBeTruthy();
    const cid = (await s.json()).challenge_id as string;
    const code = (await (await request.get(`${API}/auth/verification/peek/${cid}`)).json()).code as string;
    const v = await request.post(`${API}/auth/verification/verify`, { data: { challenge_id: cid, code } });
    expect(v.ok(), await v.text()).toBeTruthy();
    return (await v.json()).proof as string;
  };
  const email_proof = await prove('EMAIL', opts.email);
  const phone_proof = await prove('SMS', phone);
  const r = await request.post(`${API}/auth/register`, { headers: H, data: {
    email: opts.email, email_proof, phone, phone_country: country, phone_proof, password: opts.password, password_confirm: opts.password,
    full_name: opts.full_name, locale: opts.locale ?? 'en', nationality: opts.nationality ?? 'VN',
    consents: { TERMS: true, PRIVACY: true, CROSS_BORDER_VERIFICATION: true, MARKETING: false },
  } });
  expect(r.status(), await r.text()).toBe(201);
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

/**
 * V22 — complete the four-step sign-up **through the UI** on a page that is already at `/register…`:
 * fills the account step (phone country + local number, nationality via the shared picker, password + confirm),
 * reads the two codes through the development-only peek route, verifies both, ticks the required consents and
 * submits. Returns once the "Complete" step shows. The optional `nationality` is the ISO code to pick.
 */
export async function registerViaUi(
  page: Page,
  request: APIRequestContext,
  opts: { email: string; password: string; full_name: string; nationality?: string; phone_country?: string; phone_local?: string },
): Promise<void> {
  const country = opts.phone_country ?? opts.nationality ?? 'VN';
  const local = opts.phone_local ?? `0912${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  await page.fill('#full_name', opts.full_name);
  await page.fill('#email', opts.email);
  await page.locator('.hg-phone__country').click();
  await page.locator('.hg-phone__search input').fill(country);
  await page.locator('.hg-phone__opt').first().click();
  await page.fill('#phone_local', local);
  if (opts.nationality) {
    const picker = page.locator('button.hg-select').first();
    if (await picker.count()) {
      await picker.click();
      await page.locator('[role=listbox]').locator('xpath=..').locator('input').fill(opts.nationality);
      await page.locator('[role=listbox] [role=option]').first().click();
    }
  }
  await page.fill('#password', opts.password);
  await page.fill('#password_confirm', opts.password);
  const sends: Array<{ channel: string; challenge_id: string }> = [];
  page.on('response', async (r) => {
    if (r.url().includes('/auth/verification/send') && r.ok()) { try { sends.push(await r.json()); } catch { /* ignore */ } }
  });
  await page.locator('form button[type=submit]').first().click();
  await page.waitForSelector('.st-reg__chan', { timeout: 20_000 });
  await expect.poll(() => sends.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const code = async (cid: string) => ((await (await request.get(`${API}/auth/verification/peek/${cid}`)).json()) as { code: string }).code;
  const emailSend = sends.find((x) => x.channel === 'EMAIL')!;
  const smsSend = sends.find((x) => x.channel === 'SMS')!;
  await page.fill('#otp-email', await code(emailSend.challenge_id));
  await page.locator('section:has(#otp-email) button.hg-btn--primary').click();
  await page.waitForSelector('section[data-verified="true"]', { timeout: 15_000 });
  await page.fill('#otp-sms', await code(smsSend.challenge_id));
  await page.locator('section:has(#otp-sms) button.hg-btn--primary').click();
  await page.waitForFunction(() => document.querySelectorAll('section[data-verified="true"]').length === 2, null, { timeout: 15_000 });
  await page.locator('button.hg-btn--primary.hg-btn--lg:not([disabled])').last().click();
  await page.waitForSelector('.hg-consents', { timeout: 15_000 });
  for (const box of await page.locator('.hg-consents__list input[type=checkbox]').all()) {
    if (await box.evaluate((el) => !!el.closest('li')?.querySelector('.is-required'))) await box.check();
  }
  await page.locator('.hg-row button.hg-btn--primary').click();
  await page.waitForSelector('.st-reg__done', { timeout: 30_000 });
  await page.locator('.st-reg__done ~ button, button.hg-btn--primary.hg-btn--lg').last().click();
}

/** Minimal valid PDF for uploads. */
export function pdf(label: string): Buffer {
  const body = `BT /F1 12 Tf 72 720 Td (${label}) Tj ET`;
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length ${body.length}>>stream\n${body}\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF`);
}

/**
 * Buy a plan, or say why it could not be bought (V17).
 *
 * The managed service is what a plan buys, so most of these specs start by activating one. V17 priced the
 * plans in USD and the merchant holds KRW, so a server configured for Toss answers
 * `503 CURRENCY_NOT_CONTRACTED` and creates nothing — correct behaviour, and the end of any journey that
 * needs a paid case (REPORT §161).
 *
 * Returning the reason rather than throwing lets each spec `test.skip(!paid, reason)`, which keeps the
 * suite honest in both directions: nothing is deleted, nothing is faked, and the moment the contract lands
 * — or the stack runs the demo provider — every one of them runs again untouched.
 */
export async function activatePlan(
  request: APIRequestContext,
  headers: Record<string, string>,
  product_code: 'BASIC' | 'ALL_IN_ONE' | 'PREMIUM' = 'PREMIUM',
): Promise<{ paid: true; order: Record<string, unknown> } | { paid: false; reason: string }> {
  const res = await request.post(`${API}/me/orders`, { headers, data: { product_code }, failOnStatusCode: false });
  const body = await res.json();
  if (res.status() === 201 && body.status === 'PAID') return { paid: true, order: body };

  /*
   * **V21 — the third outcome, and the one that happens now.** This helper knew two: the demo
   * provider pays instantly, or Toss refuses the currency. The foreign-card route adds a real
   * purchase — the order is created `PENDING` and a card pays it — and because the helper did not
   * know it, `activatePlan` returned `{ paid: false }` and **17 tests across six specs skipped**:
   * every v5 and v6 writing, visa, arrival, submission and agency-document journey. They were not
   * failing and nothing was red; they simply stopped running, which is worse.
   *
   * The sandbox card number is not written here; it is in the untracked env (REPORT §237.1).
   */
  if (res.status() === 201 && body.status === 'PENDING' && body.card_form) {
    const pan = qaTestCard();
    if (!pan) return { paid: false, reason: 'HG_QA_TEST_CARD is not set, so the card route cannot be exercised' };
    /*
     * The card endpoint allows 8 attempts per 300 s per user *and* per IP, and a full suite run now
     * makes roughly that many from one address. Tripping Hangyul's own limiter is the control
     * working, not the payment path failing, so the helper waits the window out rather than turning
     * a security feature into a flaky test. The limiter is not relaxed for the suite.
     */
    for (let attempt = 0; ; attempt += 1) {
      const payment = await request.post(`${API}/me/orders/${body.order_id}/pay-with-card`, {
        headers,
        data: { card: { number: pan, expiry_month: '12', expiry_year: '30', holder_name: 'E2E HELPER' } },
        failOnStatusCode: false,
      });
      const paidBody = await payment.json();
      if (payment.status() === 200 && paidBody.status === 'PAID') return { paid: true, order: paidBody };
      const limited = payment.status() === 429 && paidBody?.detail?.code === 'TOO_MANY_CARD_ATTEMPTS';
      if (!limited || attempt >= 6) {
        return { paid: false, reason: `the card was not accepted: ${payment.status()} ${JSON.stringify(paidBody).slice(0, 160)}` };
      }
      await new Promise((r) => { setTimeout(r, 50_000); });
    }
  }

  const code = body?.detail?.code;
  if (res.status() === 503 && code === 'CURRENCY_NOT_CONTRACTED') {
    return { paid: false, reason: `the server cannot take ${body.detail.currency} on this merchant (REPORT §161) — nothing was charged and nothing was created` };
  }
  return { paid: false, reason: `POST /me/orders answered ${res.status()} ${JSON.stringify(body).slice(0, 160)}` };
}
