/**
 * V3 student journey, driven through the UI:
 *  quick eligibility (no account) → register with answers carried over → personalized matches
 *  compare → first-year budget planner
 *  requirement-centric documents
 *  university document request → the student sees the exact note on the application
 *  admission → visa (persona "student.visa@" when the V3 personas are seeded)
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, PASSWORD, uiLogin, URLS } from './helpers';

test('the retired quick check leads to sign-in, then to personalised matching (owner 261119)', async ({ page }) => {
  // Owner 261119 (req. 1): there is no anonymous Quick Fit any more. Every old entry point — the homepage CTA's
  // `/start` and its URL answers — leads to the Student sign-in with `next=/match`; nothing is computed before an account.
  await page.goto(`${URLS.student}/start?nationality=VN&level=BACHELOR&gpa=8.2&gpa_scale=10&langs=TOPIK:3`);
  await expect(page).toHaveURL(/\/login\?.*next=%2Fmatch/);
  await expect(page.locator('[data-auth-form]')).toBeVisible();
  // Never a probability or a ranking on the way in.
  await expect(page.getByText(/chance|probability|ranked/i)).toHaveCount(0);
});

test('compare leads to a first-year budget with labelled figures', async ({ page }) => {
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  await page.goto(`${URLS.student}/explore?tab=foryou`);
  const rows = page.locator('.v4-row');
  for (const i of [0, 1, 2]) {
    await rows.nth(i).getByRole('button', { name: /why this match/i }).click();
    await rows.nth(i).getByRole('button', { name: /compare/i }).click();
  }
  await page.getByRole('link', { name: /compare/i }).last().click();
  // Desktop shows the table; narrow screens show one card per program with the same labels.
  await expect(page.getByRole('rowheader', { name: 'Estimated first-year cost' })).toBeVisible();
  await expect(page.getByText('Lowest first-year cost').locator('visible=true').first()).toBeVisible();

  await page.goto(`${URLS.student}/budget`);
  await expect(page.getByRole('heading', { name: /first-year budget/i })).toBeVisible();
  await expect(page.getByText('Cash needed before arrival').first()).toBeVisible();
  // V9 S4: every figure says whether it is inside the range or paid separately (health insurance, visa fee, residence
  // card are named with their own amounts instead of the V8 "Not included: …" line) — nothing is folded in silently.
  await expect(page.getByText(/Paid separately:.*Health insurance/).first()).toBeVisible();
  // The money plan — who is paid, when, and where each figure comes from — is a disclosure once the student
  // has more than one programme to compare, so it is opened rather than assumed open. This used to pass by
  // accident on a seed with a single programme, which is a property of the seed and not of the product.
  await page.locator('details.bd-more').first().locator('summary').click();
  await expect(page.getByText(/Not yet verified|Official|Estimate/).locator('visible=true').first()).toBeVisible();
});

test('documents are shown as requirements with a next step', async ({ page }) => {
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  await page.goto(`${URLS.student}/documents`);
  // Owner 261119 (req. 6): the Saramin-model manager — completeness, then category bands with required/optional.
  await expect(page.getByText(/^Documents \d+% complete$/).locator('visible=true').first()).toBeVisible();
  await expect(page.getByText(/^\d+ of \d+ required documents complete$/).locator('visible=true').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Academic records' })).toBeVisible();
});

test('a university document request reaches the student with the exact note', async ({ page, request }) => {
  const uni = await apiLogin(request, 'admin@pusan.univ.demo.hangyul.kr', 'university');
  const list = await (await request.get(`${API}/applications?status=UNIVERSITY_REVIEW&status=ADDITIONAL_DOCUMENTS&status=SUBMITTED&page_size=20`, { headers: uni })).json();
  test.skip(!list.items?.length, 'no application under university review in this dataset');
  const app = list.items[0];
  const hq = await apiLogin(request, 'admin@demo.hangyul.kr', 'agency');
  const found = await (await request.get(`${API}/agency/students?q=${encodeURIComponent(app.student.full_name)}&page_size=5`, { headers: hq })).json();
  const email = found.items?.[0]?.email as string | undefined;
  test.skip(!email || !email.endsWith('@demo.hangyul.kr'), 'student account for this application is not a demo login');

  // "E2E" marker: this runs as a seeded university on a seeded application — the teardown purge finds it by the marker.
  const note = `E2E ${Date.now()}: please upload a bank certificate issued within the last 30 days.`;
  const r = await request.post(`${API}/applications/${app.id}/document-requests`, { headers: uni, data: { label: 'E2E recent bank certificate', note, category: 'BANK_STATEMENT' } });
  expect(r.status(), await r.text()).toBeLessThan(300);

  await uiLogin(page, 'student', email!, PASSWORD);
  await page.goto(`${URLS.student}/applications/${app.id}`);
  await expect(page.getByText(note).locator('visible=true').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Upload and send/ }).first()).toBeVisible();
});

test('after admission the visa centre shows what needs the student now', async ({ page, request }) => {
  const probe = await request.post(`${API}/auth/login`, { data: { email: 'student.visa@demo.hangyul.kr', password: PASSWORD, client: 'student' } });
  test.skip(!probe.ok(), 'V3 personas are not seeded in this database (run npm run db:reset)');
  await uiLogin(page, 'student', 'student.visa@demo.hangyul.kr');
  await page.goto(`${URLS.student}/visa`);
  await expect(page.getByText(/visa (journey|plan)/)).toBeVisible();
  await expect(page.getByText('What needs you now')).toBeVisible();
  await expect(page.getByText(/Provided by:/).first()).toBeVisible();
});

test('an early student sees one concrete unlock, and it is not behind the paywall', async ({ page }) => {
  // V17: this persona has an account and no plan, so signing in lands on the plan screen with the reason
  // in the URL — home is the managed service (REPORT §159). What V3 was really asserting, that the product
  // names *one concrete thing* to add rather than a completion percentage, is a property of the profile,
  // which stays open without a purchase precisely because it is the student's own.
  await uiLogin(page, 'student', 'student.new@demo.hangyul.kr');
  await expect(page).toHaveURL(/\/services\?.*gate=home/);

  await page.goto(`${URLS.student}/profile`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // A concrete unlock, with a number attached to it — never "60 % done".
  await expect(page.getByText(/would open \d+ more programs|confirms \d+ programs/).first()).toBeVisible();
  await expect(page.getByText(/% done/i)).toHaveCount(0);
  // The control is named for what it does to which section — "Add education", not a bare "Add" that a
  // screen reader hears out of context.
  await expect(page.getByRole('button', { name: /^Add .+/ }).first()).toBeVisible();

  // And discovery is open too: an account must never give a student *less* than an anonymous visitor.
  await page.goto(`${URLS.student}/explore`);
  await expect(page).toHaveURL(/\/explore/);
  const closest = page.getByRole('heading', { name: 'Closest to your profile' });
  if (await closest.count()) await expect(page.getByText(/required[;.—]+ ?(you have|add your score)/i).first()).toBeVisible();
});

test('two offers: home points to the comparison, and it stays readable on a phone', async ({ page }) => {
  await uiLogin(page, 'student', 'student.offer@demo.hangyul.kr');
  await expect(page.getByText(/Compare your 2 offers/)).toBeVisible();
  await expect(page.getByText(/Pay tuition for/).first()).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${URLS.student}/applications`);
    // Table on desktop, one card per offer on phones — the tuition deadline must be visible either way.
    await expect(page.getByText('Tuition deadline').locator('visible=true').first()).toBeVisible();
  }
});
