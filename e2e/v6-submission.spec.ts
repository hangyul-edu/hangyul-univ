/**
 * V6 authorised agency submission: student authorises → agency records reference + receipt → student sees Submitted.
 *
 * No real university allows agency submission, so this runs on the development fixture (seed extra_60_submission_v6:
 * an inactive "Authorised-submission fixture (development only)" program whose connector records the fixture basis,
 * plus a DEMO permission for Lotus Bridge). A fresh e2e-…@example.com student (purged in global teardown, together with
 * the application, authorisation, consent records, receipt, tasks and audit subjects) starts an application there via
 * the dev-only fixture endpoint — nothing is written on seeded rows.
 */
import { expect, test } from '@playwright/test';

import { activatePlan, API, apiLogin, pdf, registerStudent, uiLogin, URLS } from './helpers';

const email = `e2e-v6sub-${Date.now()}@example.com`;
const password = 'e2e-password-123';
const name = 'Lam Authorise E2E';
const MANAGER = 'manager@lotus.demo.hangyul.kr';
const DOCS = ['PASSPORT', 'PHOTO', 'GRADUATION_CERTIFICATE', 'TRANSCRIPT', 'BANK_STATEMENT', 'TOPIK', 'FAMILY_RELATION_CERTIFICATE', 'PERSONAL_STATEMENT', 'STUDY_PLAN'];

test('student authorises → agency records reference + receipt → student sees Submitted', async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  // --- set-up through the API: student, Lotus Bridge assignment, fixture application, documents, READY.
  const S = await registerStudent(request, { email, password, full_name: name, locale: 'en', nationality: 'VN' });
  await request.patch(`${API}/me/profile`, { headers: S, data: { residence_country: 'VN', date_of_birth: '2006-03-09', target_degree: 'BACHELOR', target_intake_year: 2027, target_intake_term: 'SPRING', onboarding_completed: true } });
  const bought = await activatePlan(request, S, 'PREMIUM');
  test.skip(!bought.paid, bought.paid ? '' : bought.reason);
  expect((bought.order as { assignment: { organization: string } }).assignment.organization).toContain('Lotus Bridge');
  const created = await request.post(`${API}/dev/submission-fixture/application`, { headers: S });
  expect(created.status(), await created.text()).toBe(201);
  const appId = (await created.json()).id as string;
  const M = await apiLogin(request, MANAGER, 'agency');
  // Documents issued in Korea (no legalization step) so the package can be complete; the agency verifies each.
  for (const category of DOCS) {
    const up = await request.post(`${API}/documents`, { headers: S, multipart: { category, issuing_country: 'KR', file: { name: `${category.toLowerCase()}.pdf`, mimeType: 'application/pdf', buffer: pdf(`${category} — ${name}`) } } });
    expect(up.ok(), await up.text()).toBeTruthy();
    const rv = await request.post(`${API}/documents/${(await up.json()).id}/review`, { headers: M, data: { decision: 'VERIFIED' } });
    expect(rv.ok(), await rv.text()).toBeTruthy();
  }
  const essays = (await (await request.get(`${API}/essays`, { headers: S })).json()).items as { id: string; application_id: string }[];
  for (const e of essays.filter((x) => x.application_id === appId)) {
    await request.put(`${API}/essays/${e.id}`, { headers: S, data: { body: 'I finished upper-secondary school in Da Nang in 2025 and want to study business administration in Busan, '
      + 'because my family exports seafood to Korean buyers. I plan to learn supply-chain management and return to grow the family company.' } });
    expect((await request.post(`${API}/essays/${e.id}/status`, { headers: S, data: { status: 'SUBMITTED' } })).ok()).toBeTruthy();
    const ap = await request.post(`${API}/essays/${e.id}/status`, { headers: M, data: { status: 'APPROVED' } });
    expect(ap.ok(), await ap.text()).toBeTruthy();
  }
  for (const to of ['DOCUMENT_PREPARATION', 'READY']) {
    const tr = await request.post(`${API}/applications/${appId}/transition`, { headers: M, data: { to } });
    expect(tr.ok(), await tr.text()).toBeTruthy();
  }
  // Before consent the agency cannot record anything.
  expect((await request.post(`${API}/applications/${appId}/submission/confirm`, { headers: M, data: { external_reference: 'E2E-X' } })).status()).toBe(409);

  // --- student: explicit consent screen.
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/applications/${appId}`);
  await page.getByRole('button', { name: 'Authorize submission' }).click();
  const dialog = page.getByRole('dialog', { name: /Authorize Lotus Bridge .* to submit your application/ });
  await expect(dialog.getByText('Where it goes')).toBeVisible();
  await expect(dialog.getByText(/not your Hangyul service fee or tuition/)).toBeVisible();
  await expect(dialog.getByText(/never asks for or stores portal passwords/)).toBeVisible();
  await expect(dialog.getByText(/withdraw this authorization any time before/)).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Authorize submission' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/I authorize Lotus Bridge/).check();
  await confirm.click();
  await expect(page.getByRole('heading', { name: /Authorized\. Lotus Bridge .* submits it next/ })).toBeVisible();

  // --- agency: Ready to submit → final review → record reference + receipt.
  const ref = `E2E-FX-${Date.now().toString().slice(-6)}`;
  const ctx = await browser.newContext();
  const agency = await ctx.newPage();
  try {
    await uiLogin(agency, 'agency', MANAGER);
    // V9 A7: the V6 "Ready to submit" queue became the Submissions pipeline — one queue for every connector method,
    // in seven states. An application the student authorised waits in the "Authorized" state; its row opens the same
    // V6 detail (final review → record), so the journey is unchanged.
    await agency.goto(`${URLS.agency}/submissions`);
    await expect(agency.getByRole('heading', { name: 'Submissions', level: 1 })).toBeVisible();
    await agency.getByRole('button', { name: /^Authorized\s*\d+$/ }).click();
    await agency.getByRole('row', { name: new RegExp(name) }).click();
    const drawer = agency.getByRole('dialog', { name: new RegExp(name) });
    await expect(drawer.getByText('Final review')).toBeVisible();
    await expect(drawer.getByText(/Student authorised/)).toBeVisible();
    await drawer.getByLabel('Application / reference number').fill(ref);
    await drawer.getByLabel(/Receipt/).setInputFiles({ name: 'e2e-receipt.pdf', mimeType: 'application/pdf', buffer: pdf('E2E receipt') });
    await expect(drawer.getByText('e2e-receipt.pdf')).toBeVisible();
    await drawer.getByRole('button', { name: 'Record and complete' }).click();
    await expect(agency.getByText('Recorded. The application is now Submitted.')).toBeVisible();
  } finally {
    await ctx.close();
  }

  // --- student: Submitted · reference · date · who · receipt.
  await page.reload();
  const evidence = page.getByTestId('submission-evidence');
  await expect(evidence).toContainText(`confirmation ${ref}`);
  await expect(evidence).toContainText(/Submitted by .*Lotus Bridge/);
  await expect(evidence.getByRole('link', { name: 'Receipt' })).toBeVisible();
  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: S })).json();
  expect(detail.status).toBe('SUBMITTED');
  const view = await (await request.get(`${API}/applications/${appId}/submission`, { headers: S })).json();
  expect(view.record.evidence_kind).toBe('CONFIRMATION_AND_RECEIPT');
  expect(view.authorization.status).toBe('USED');
});
