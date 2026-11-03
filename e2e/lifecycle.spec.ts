/**
 * The core cross-product journey:
 *  1 student signs in · 2 completes profile · 3 receives matches · 4 saves a university · 5 activates a service (card payment)
 *  6 gets an agency assignment · 7 uploads documents · 8 agency reviews them · 9 submits an essay · 10 agency comments/approves
 *  11 application progresses · 12 university sees it · 13 university changes its state · 14 student sees the update · 15 visa workflow starts
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, pdf, qaTestCard, registerStudent, uiLogin, URLS } from './helpers';

test.describe.configure({ mode: 'serial' });

const email = `e2e-${Date.now()}@example.com`;
const password = 'e2e-password-123';
let S: Record<string, string>;
let appId = '';
let universityName = '';
/**
 * Whether the purchase in step 5 actually happened.
 *
 * V17 priced the plans in USD and the merchant holds KRW, so a server configured for Toss answers
 * `503 CURRENCY_NOT_CONTRACTED` and creates nothing (REPORT §161). That is the correct behaviour and it is
 * also the end of this journey: steps 7–15 are the *managed* service, which a plan buys. Rather than fail
 * six tests over a contract nobody in this repository can sign, they skip with the reason named — and the
 * moment the contract lands, or the stack runs the demo provider, they run again untouched.
 */
let paid = false;
let notPaidReason = '';

test('1–2 student registers, signs in and completes a progressive profile', async ({ page, request }) => {
  S = await registerStudent(request, { email, password, full_name: 'Minh Anh E2E', locale: 'en', nationality: 'VN' });
  const profile = await request.patch(`${API}/me/profile`, {
    headers: S,
    data: { residence_country: 'VN', date_of_birth: '2006-04-02', target_degree: 'LANGUAGE', target_intake_year: 2027, target_intake_term: 'SPRING',
      desired_fields: ['korean_language'], annual_budget_krw: 16000000, housing_preference: 'DORM', has_passport: true, passport_expiry: '2031-01-01',
      financial_sponsor: 'PARENTS', preferred_regions: ['Busan'], onboarding_completed: true },
  });
  expect(profile.ok()).toBeTruthy();
  await request.post(`${API}/me/educations`, { headers: S, data: { level: 'HIGH_SCHOOL', institution: 'Hanoi High School', country: 'VN', gpa_value: 8.2, gpa_scale_max: 10 } });
  await request.post(`${API}/me/languages`, { headers: S, data: { test: 'TOPIK', score: 2, test_date: '2026-07-01' } });

  // V17: an account is not a purchase. This student has registered and has not paid, so signing in lands
  // on the plan screen *with the reason carried in the URL* — not on a dashboard of managed work that is
  // empty because nothing has been bought (REPORT §159). The greeting is asserted after step 5.
  await uiLogin(page, 'student', email, password);
  await expect(page).toHaveURL(/\/services\?.*gate=home/);
  await expect(page.locator('.hg-callout').first()).toBeVisible();
});

test('3–4 matches explain themselves and a university can be saved', async ({ page, request }) => {
  const m = await (await request.get(`${API}/me/matches?degree=LANGUAGE`, { headers: S })).json();
  expect(m.items.length).toBeGreaterThan(0);
  expect(m.items.every((i: { reasons: unknown[] }) => i.reasons.length > 0)).toBeTruthy();
  const pnu = m.items.find((i: { program: { university: { slug: string } } }) => i.program.university.slug === 'pusan-national-university');
  expect(pnu.guarantee).not.toBeNull();
  universityName = pnu.program.university.name_en;
  expect((await request.put(`${API}/me/saved/${pnu.program.university_id}`, { headers: S })).status()).toBe(204);

  await uiLogin(page, 'student', email, password);
  // Matches live in Universities › For you; /matches redirects there.
  await page.goto(`${URLS.student}/matches`);
  await expect(page).toHaveURL(/\/explore\?tab=foryou/);
  await expect(page.getByText(/Strong match|Possible match/).first()).toBeVisible();
  await page.goto(`${URLS.student}/saved`);
  await expect(page.getByText(universityName).first()).toBeVisible();

  const app = await request.post(`${API}/applications`, { headers: S, data: { program_id: pnu.program_id } });
  expect(app.status()).toBe(201);
  appId = (await app.json()).id;
});

test('5–6 a card purchase assigns a partner agency by expertise, and opens the managed service', async ({ page, request }) => {
  const res = await request.post(`${API}/me/orders`, { headers: S, data: { product_code: 'PREMIUM' } });
  const o = await res.json();
  if (res.status() === 503 && o.detail?.code === 'CURRENCY_NOT_CONTRACTED') {
    notPaidReason = `the server cannot take ${o.detail.currency} on this merchant (REPORT §161) — nothing was charged and nothing was created`;
    // Assert the refusal is a proper one rather than treating it as a pass: no plan, no pending order.
    const svc = await (await request.get(`${API}/me/services`, { headers: S })).json();
    expect(svc.owned).toEqual([]);
    expect(svc.payment?.pending_order_id ?? null).toBeNull();
    test.skip(true, notPaidReason);
    return;
  }
  /*
   * **V21 — a third outcome.** Until V21 an order was either paid instantly by the demo provider or
   * refused with `CURRENCY_NOT_CONTRACTED`; the foreign-card route adds the real one, where the order
   * is created `PENDING` and a card pays it. Treating that as a failure would have been treating the
   * product working as a regression, and skipping it would have given up the agency-assignment
   * coverage that steps 6–15 depend on — so this pays, through the same endpoint the card form posts
   * to. The sandbox card number is not written here; it lives in the untracked env (REPORT §237.1).
   */
  let order = o;
  if (order.status === 'PENDING' && order.card_form) {
    const pan = qaTestCard();
    if (!pan) {
      notPaidReason = 'HG_QA_TEST_CARD is not set, so the card route cannot be exercised here';
      test.skip(true, notPaidReason);
      return;
    }
    const payment = await request.post(`${API}/me/orders/${order.order_id}/pay-with-card`, {
      headers: S,
      data: { card: { number: pan, expiry_month: '12', expiry_year: '30', holder_name: 'E2E LIFECYCLE' } },
    });
    expect(payment.status(), await payment.text()).toBe(200);
    order = await payment.json();
  }
  expect(order.status).toBe('PAID');
  expect(order.assignment.organization).toContain('Lotus Bridge');
  paid = true;

  // V17: the other half of the paywall. The same sign-in that landed on the plan screen in step 1 now
  // lands on the student's own home, and the greeting that used to be asserted there is asserted here.
  await uiLogin(page, 'student', email, password);
  await expect(page).toHaveURL(new RegExp(`^${URLS.student}/(\\?|$)`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Minh');
});

test('7–10 documents are uploaded and reviewed; essay is reviewed with a suggestion and approved', async ({ page, request }) => {
  test.skip(!paid, notPaidReason || 'the plan was not purchased in step 5');
  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: S })).json();
  for (const item of detail.checklist.filter((i: { required: boolean }) => i.required)) {
    const r = await request.post(`${API}/documents`, {
      headers: S,
      multipart: { category: item.category, issuing_country: 'VN', language: 'vi', file: { name: `${item.category}.pdf`, mimeType: 'application/pdf', buffer: pdf(item.label) } },
    });
    expect(r.status(), await r.text()).toBe(201);
  }
  // The agency console shows the new student to the right tenant (the counselor assigned by the engine).
  const team = ['counselor@lotus.demo.hangyul.kr', 'counselor2@lotus.demo.hangyul.kr', 'manager@lotus.demo.hangyul.kr'];
  let A: Record<string, string> | null = null;
  for (const who of team) {
    const h = await apiLogin(request, who, 'agency');
    const students = await (await request.get(`${API}/agency/students?q=Minh%20Anh`, { headers: h })).json();
    if (students.items.length) { A = h; break; }
  }
  expect(A).not.toBeNull();
  const queue = await (await request.get(`${API}/documents?student_id=${detail.student?.id ?? ''}&page_size=50`, { headers: S })).json();
  for (const d of queue.items) {
    expect((await request.post(`${API}/documents/${d.id}/review`, { headers: A!, data: { decision: 'VERIFIED' } })).ok()).toBeTruthy();
  }
  const essays = await (await request.get(`${API}/essays`, { headers: S })).json();
  const essay = essays.items.find((e: { application_id: string }) => e.application_id === appId);
  await request.put(`${API}/essays/${essay.id}`, { headers: S, data: { body: 'I want to study Korean in Busan. I studied hard for TOPIK.' } });
  expect((await (await request.post(`${API}/essays/${essay.id}/status`, { headers: S, data: { status: 'SUBMITTED' } })).json()).status).toBe('AGENCY_REVIEW');
  const c = await request.post(`${API}/essays/${essay.id}/comments`, { headers: A!, data: { body: 'Be specific', quote: 'I studied hard for TOPIK.', suggestion: 'I completed 200 hours of TOPIK preparation.' } });
  await request.post(`${API}/essays/${essay.id}/status`, { headers: A!, data: { status: 'CHANGES_REQUESTED' } });
  const accepted = await (await request.post(`${API}/essays/${essay.id}/comments/${(await c.json()).id}/resolve?apply_suggestion=true`, { headers: S })).json();
  expect(accepted.body).toContain('200 hours');
  await request.post(`${API}/essays/${essay.id}/status`, { headers: S, data: { status: 'SUBMITTED' } });
  expect((await (await request.post(`${API}/essays/${essay.id}/status`, { headers: A!, data: { status: 'APPROVED' } })).json()).status).toBe('APPROVED');

  // 11 the agency moves the application forward; nonsense transitions are refused
  expect((await request.post(`${API}/applications/${appId}/transition`, { headers: A!, data: { to: 'OFFERED' } })).status()).toBe(409);
  for (const to of ['DOCUMENT_PREPARATION', 'READY', 'SUBMITTED']) {
    const r = await request.post(`${API}/applications/${appId}/transition`, { headers: A!, data: { to } });
    expect(r.ok(), `${to}: ${r.status()} ${await r.text()}`).toBeTruthy();
  }

  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/documents`);
  // V5 dossier: verified documents are summarised as ready for every application.
  await expect(page.getByText(/ready for every application/).first()).toBeVisible();
});

test('12–13 the university sees the application in its console and decides', async ({ page, request }) => {
  test.skip(!paid, notPaidReason || 'the plan was not purchased in step 5');
  await uiLogin(page, 'university', 'admin@pusan.univ.demo.hangyul.kr');
  await page.goto(`${URLS.university}/applications/${appId}`);
  await expect(page.getByText('Minh Anh E2E').first()).toBeVisible();
  const U = await apiLogin(request, 'admin@pusan.univ.demo.hangyul.kr', 'university');
  for (const to of ['UNIVERSITY_REVIEW', 'OFFERED']) {
    expect((await request.post(`${API}/applications/${appId}/transition`, { headers: U, data: { to } })).ok()).toBeTruthy();
  }
});

test('14–15 the student sees the offer; admission letter opens the visa workflow automatically', async ({ page, request }) => {
  test.skip(!paid, notPaidReason || 'the plan was not purchased in step 5');
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/applications/${appId}`);
  await expect(page.getByText(/Offer received/).first()).toBeVisible();
  expect((await request.post(`${API}/applications/${appId}/transition`, { headers: S, data: { to: 'OFFER_ACCEPTED' } })).ok()).toBeTruthy();
  const U = await apiLogin(request, 'admin@pusan.univ.demo.hangyul.kr', 'university');
  for (const to of ['TUITION_PENDING', 'TUITION_PAID', 'ADMISSION_CERTIFICATE_ISSUED']) {
    expect((await request.post(`${API}/applications/${appId}/transition`, { headers: U, data: { to } })).ok()).toBeTruthy();
  }
  const visa = await (await request.get(`${API}/visa`, { headers: S })).json();
  expect(visa.items[0].visa_type).toBe('D-4-1');
  await page.goto(`${URLS.student}/visa`);
  await expect(page.getByText('D-4-1').first()).toBeVisible();
  // V12 (brief Part 5): the "Hangyul does not issue visas" block is gone. What the screen must still do is
  // show where the student actually applies, which is the authority context that replaced it.
  await expect(page.getByText(/does not issue visas/i)).toHaveCount(0);
  // Matched against the page's visible text rather than a locator: at this point in the journey the student
  // has not yet chosen their consular area, so the resolved post sits inside a collapsed section and the
  // first DOM match is legitimately hidden. What must be true is that the screen talks about where they
  // apply at all.
  await expect
    .poll(() => page.evaluate(() => document.body.innerText))
    .toMatch(/embassy|consulate|대사관|총영사관/i);
});
