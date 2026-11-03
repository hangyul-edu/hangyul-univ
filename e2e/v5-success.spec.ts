/**
 * V5 admission success — the "guided submission" end of FLOW A.
 *
 * Persona: student.nepal@demo.hangyul.kr (Aarati, Nepal; extra_15_v5_personas) — one Kyungpook application in READY,
 * every document verified, essays approved. The spec:
 *   strategy line on Applications ("Ready") → application page shows the hand-off (not a "Submit" button) with the
 *   pre-leave checklist and the university fee kept apart from Hangyul's fee → "Continue to official submission" opens
 *   the official portal in a new tab and records the hand-off → back on the page: record the confirmation number →
 *   the application shows Submitted with the evidence; the counselor sees the same evidence.
 * It changes the persona's state (READY → SUBMITTED): run after `npm run db:reset`; it skips if already submitted.
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

const NEPAL = 'student.nepal@demo.hangyul.kr';

test('guided submission: hand-off to the official portal, then record the confirmation', async ({ page, context, request }) => {
  const S = await apiLogin(request, NEPAL, 'student');
  const apps = (await (await request.get(`${API}/applications?page_size=20`, { headers: S })).json()).items as { id: string; status: string }[];
  const ready = apps.find((a) => a.status === 'READY');
  test.skip(!ready, 'The Nepal persona has no READY application in this database (already submitted) — reset the demo data to re-run.');
  const appId = ready!.id;

  // Strategy: ready, nothing blocking; the first thing to do today is the hand-off. No score anywhere.
  const strategy = await (await request.get(`${API}/me/strategy`, { headers: S })).json();
  expect(strategy.today[0].code).toBe('SUBMISSION_HANDOFF');
  expect(JSON.stringify(strategy)).not.toMatch(/"(score|probability|percent)"/);
  // The generic transition cannot claim "submitted" without evidence.
  expect((await request.post(`${API}/applications/${appId}/transition`, { headers: S, data: { to: 'SUBMITTED' } })).status()).toBe(409);

  await uiLogin(page, 'student', NEPAL);
  await page.goto(`${URLS.student}/applications`);
  await expect(page.locator('.sx-line[data-kind="ready"]').first()).toBeVisible();

  await page.goto(`${URLS.student}/applications/${appId}`);
  await expect(page.getByRole('heading', { name: 'Your Hangyul application is ready' })).toBeVisible();
  await expect(page.getByText(/We've prepared all \d+ required files/)).toBeVisible(); // V6 wording
  await expect(page.getByText(/not your Hangyul service fee or tuition/)).toBeVisible();
  await expect(page.getByText(/Hangyul will never ask for it/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Submit/ })).toHaveCount(0);

  // Leave for the official portal: a new tab opens; the page records the hand-off and waits for the result.
  const [portal] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: /Continue to official submission|I'm sending it now/ }).click(),
  ]);
  await portal.close();
  await expect(page.getByRole('heading', { name: /Submitted on .*portal\?/ })).toBeVisible();
  const view = await (await request.get(`${API}/applications/${appId}/submission`, { headers: S })).json();
  expect(view.status).toBe('HANDED_OFF');

  // Back from the portal: the confirmation number is the evidence.
  await page.getByLabel('Confirmation or application number').fill('KNU-E2E-2027-0042');
  await page.getByLabel('Application fee').selectOption('PAID');
  await page.getByRole('button', { name: 'Save confirmation' }).click();
  await expect(page.getByText('Confirmed. Your application is marked as submitted.')).toBeVisible();
  await expect(page.getByText(/confirmation KNU-E2E-2027-0042/)).toBeVisible();

  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: S })).json();
  expect(detail.status).toBe('SUBMITTED');
  expect(detail.external_reference).toBe('KNU-E2E-2027-0042');
  const after = await (await request.get(`${API}/applications/${appId}/submission`, { headers: S })).json();
  expect(after.status).toBe('SUBMITTED_CONFIRMED');
  expect(after.record.evidence_kind).toBe('CONFIRMATION_ID');

  // The counselor sees the same evidence.
  const A = await apiLogin(request, 'counselor@himalaya.demo.hangyul.kr', 'agency');
  const agencyView = await (await request.get(`${API}/applications/${appId}/submission`, { headers: A })).json();
  expect(agencyView.record.external_reference).toBe('KNU-E2E-2027-0042');
  expect(agencyView.record.recorded_by_role).toBe('STUDENT');
});
