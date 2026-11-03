/**
 * V29 — the owner's service contract, walked through the real UI (brief §56).
 *
 *   1. a visitor reads the V29 plans, the comparison, the additional services and the 이용 안내 on the homepage;
 *   2. a new student starts All-in-One (non-production paid-state action — the same state transition a payment
 *      performs), sees the contract on /services, and is shown what an upgrade would change without a price;
 *   3. the Hangyul team proposes an extra managed application from the agency console at an exact price inside the
 *      range, the student approves it, pays (paid-state action), and the allowance rises — nothing before payment.
 *
 * The entitlement boundaries (Basic / All-in-One / Premium, rounds, mock interviews, Premium scope, term end) are
 * asserted against the API in server/tests/test_v29_contract.py; this spec is about what people see and click.
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, registerStudent, uiLogin, URLS } from './helpers';

test.describe.configure({ mode: 'serial' });

test('the homepage sells exactly the V29 contract', async ({ page }) => {
  await page.goto(`${URLS.marketing}/?lang=en#pricing`);
  const pricing = page.locator('#pricing');
  for (const price of ['$179', '$349', '$599']) await expect(pricing.getByText(price, { exact: true })).toBeVisible();
  await expect(pricing).toContainText('Up to 2 rounds of statement and study-plan editing');
  await expect(pricing).not.toContainText(/minute/i);
  await pricing.locator('#plan-compare > summary').click();
  const matrix = pricing.locator('table.kn-matrix');
  await expect(matrix).toContainText('No round limit within your contract');
  await expect(matrix).toContainText('Throughout your contract');
  await expect(pricing.locator('.kn-addons__table tbody tr')).toHaveCount(6);
  await expect(pricing.locator('.kn-addons__price[data-pricing="QUOTE"]')).toHaveCount(2);
  await pricing.locator('#plan-notes > summary').click();
  await expect(pricing.locator('.kn-notes__list li')).toHaveCount(8);
  await expect(pricing.locator('.kn-notes__list')).toContainText('the decision is the authority');
});

let student: { email: string; id: string } | null = null;

test('a new student starts All-in-One and reads the contract on /services', async ({ page, request }) => {
  const email = `e2e-v29-${Date.now()}@example.com`;
  const password = 'Hangyul!2026x';
  await registerStudent(request, { email, password, full_name: 'V29 Walkthrough', nationality: 'VN' });
  await uiLogin(page, 'student', email, password, 'en');
  await page.goto(`${URLS.student}/services?plan=all_in_one&lang=en`);
  // Before buying: the order block carries the 이용 안내 in full.
  await expect(page.locator('.sv29-notes li')).toHaveCount(7); // premiumScope only for Premium
  // The paid state, through the server's non-production paid-state action (the isolated e2e build ships no test button).
  const h0 = await apiLogin(request, email, 'student', password);
  expect((await request.post(`${API}/me/orders/dev-complete`, { headers: h0, data: { product_code: 'ALL_IN_ONE' } })).ok()).toBeTruthy();
  await page.goto(`${URLS.student}/services?lang=en`);
  const current = page.locator('.sv15-current');
  await expect(current).toContainText('All-in-One');
  await expect(current.locator('.sv29-term')).toContainText('Consultation support');
  await current.getByText('Everything this plan includes').click();
  await expect(current.locator('.sv15-scope')).toContainText('Up to 2 rounds');
  await expect(current.locator('.sv15-scope')).toContainText('Application deadlines managed');
  // Upgrade: what changes, and no invented price.
  await page.getByText('See the other plans').click();
  await page.getByRole('button', { name: /Change to Premium/ }).click();
  const up = page.locator('.sv29-upgrade');
  await expect(up).toContainText('No round limit within your contract');
  await expect(up).toContainText("Upgrade pricing hasn't been set yet");
  await expect(up).not.toContainText('$250');
  const h = await apiLogin(request, email, 'student', password);
  const me = await (await request.get(`${API}/auth/me`, { headers: h })).json();
  student = { email, id: me.user.id };
});

test('an add-on is proposed at an exact price, approved, paid — and only then counted', async ({ browser, request }) => {
  test.skip(!student, 'needs the student from the previous test');
  const agency = await browser.newPage();
  await uiLogin(agency, 'agency', 'ops@demo.hangyul.kr', undefined, 'en');
  await agency.goto(`${URLS.agency}/students/${student!.id}?lang=en`);
  await agency.getByRole('button', { name: 'Propose an additional service' }).click();
  await agency.locator('#ag29-offer-code').selectOption('EXTRA_MANAGED_APPLICATION');
  await agency.locator('#ag29-offer-price').fill('60');
  await expect(agency.getByRole('button', { name: 'Propose to student' })).toBeDisabled(); // $60 is outside $30–50
  await agency.locator('#ag29-offer-price').fill('45');
  await agency.getByRole('button', { name: 'Propose to student' }).click();
  await expect(agency.getByText('Proposed').first()).toBeVisible();

  const page = await browser.newPage();
  await uiLogin(page, 'student', student!.email, 'Hangyul!2026x', 'en');
  await page.goto(`${URLS.student}/services?lang=en`);
  const addOns = page.locator('#addons');
  await expect(addOns).toContainText('Extra managed application');
  await expect(addOns).toContainText('$45');
  const before = await (await request.get(`${API}/me/plan`, { headers: await apiLogin(request, student!.email, 'student', 'Hangyul!2026x') })).json();
  const limit = (p: { usage: { key: string; limit: number | null }[] }) => p.usage.find((u) => u.key === 'max_managed_applications')!.limit;
  await addOns.getByRole('button', { name: /Agree and pay/ }).click();
  await expect(addOns).toContainText('We start as soon as the payment is through');
  const approved = await (await request.get(`${API}/me/plan`, { headers: await apiLogin(request, student!.email, 'student', 'Hangyul!2026x') })).json();
  expect(limit(approved)).toBe(limit(before)); // approval grants nothing
  const hs = await apiLogin(request, student!.email, 'student', 'Hangyul!2026x');
  const offer = (await (await request.get(`${API}/me/add-ons`, { headers: hs })).json()).find((x: { status: string }) => x.status === 'AWAITING_PAYMENT');
  expect((await request.post(`${API}/me/orders/${offer.order_id}/dev-complete`, { headers: hs })).ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator('#addons')).toContainText('Paid · in progress');
  const paid = await (await request.get(`${API}/me/plan`, { headers: await apiLogin(request, student!.email, 'student', 'Hangyul!2026x') })).json();
  expect(limit(paid)).toBe((limit(before) ?? 0) + 1);
});
