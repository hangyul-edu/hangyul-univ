import { expect, test, type APIRequestContext } from '@playwright/test';

import { activatePlan, API, API_ORIGIN, apiLogin, pdf, registerStudent, registerViaUi, uiLogin, URLS } from './helpers';

/**
 * V3 agency operations: upload on behalf of a student, a manager's shared (team) saved view, and message attachments.
 * Uses a fresh e2e-…@example.com student assigned to Lotus Bridge through the demo purchase; teardown purges it.
 */
test.describe.configure({ mode: 'serial' });

const email = `e2e-agency-${Date.now()}@example.com`;
const password = 'e2e-password-123';
const name = 'Thu Ha E2E';
const MANAGER = 'manager@lotus.demo.hangyul.kr';
const COUNSELOR = 'counselor@lotus.demo.hangyul.kr';
let S: Record<string, string>;
let studentId = '';
/** Why the paid case could not be set up, if it could not — see `activatePlan`. */
let skipReason = '';

async function lotusManager(request: APIRequestContext) {
  return apiLogin(request, MANAGER, 'agency');
}

test.beforeAll(async ({ request }) => {
  S = await registerStudent(request, { email, password, full_name: name, locale: 'en', nationality: 'VN' });
  await request.patch(`${API}/me/profile`, { headers: S, data: { residence_country: 'VN', target_degree: 'LANGUAGE', target_intake_year: 2027, target_intake_term: 'SPRING', desired_fields: ['korean_language'], onboarding_completed: true } });
  const bought = await activatePlan(request, S, 'PREMIUM');
  if (!bought.paid) { skipReason = bought.reason; return; }
  expect((bought.order as { assignment: { organization: string } }).assignment.organization).toContain('Lotus Bridge');
  const M = await lotusManager(request);
  const rows = (await (await request.get(`${API}/agency/students?q=${encodeURIComponent(name)}`, { headers: M })).json()).items;
  expect(rows.length).toBe(1);
  studentId = rows[0].id;
});

test('staff upload a document on the student’s behalf; it lands in the student’s vault for review', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  await uiLogin(page, 'agency', MANAGER);
  await page.goto(`${URLS.agency}/students/${studentId}?tab=documents`);
  await page.getByRole('button', { name: `Upload for ${name}` }).first().click();
  const dialog = page.getByRole('dialog', { name: `Upload for ${name}` });
  await dialog.locator('#ob-cat').selectOption('PHOTO');
  await dialog.locator('#ob-file').setInputFiles({ name: 'photo-from-email.pdf', mimeType: 'application/pdf', buffer: pdf('Photo') });
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(dialog).toBeHidden();
  // The new file opens straight in the review drawer.
  await expect(page.locator('.hg-drawer')).toBeVisible();

  const mine = (await (await request.get(`${API}/documents?page_size=50`, { headers: S })).json()).items;
  const doc = mine.find((d: { category: string }) => d.category === 'PHOTO');
  expect(doc, 'uploaded document is in the student vault').toBeTruthy();
  expect(doc.status).toBe('NEEDS_REVIEW');
  const M = await lotusManager(request);
  const audit = (await (await request.get(`${API}/audit?subject_id=${studentId}&page_size=50`, { headers: M })).json()).items;
  expect(audit.some((a: { action: string }) => a.action === 'document.upload_on_behalf')).toBeTruthy();
  // Another agency cannot upload for this student.
  const silk = await apiLogin(request, 'manager@silk.demo.hangyul.kr', 'agency');
  const denied = await request.post(`${API}/documents`, { headers: silk, multipart: { category: 'PHOTO', student_user_id: studentId, file: { name: 'x.pdf', mimeType: 'application/pdf', buffer: pdf('x') } } });
  expect(denied.status()).toBe(404);
});

test('a manager saves a team view and a counselor opens it from “More views”', async ({ page, browser, request }) => {
  test.skip(!!skipReason, skipReason);
  const viewName = `E2E Vietnam ${Date.now()}`;
  await uiLogin(page, 'agency', MANAGER);
  await page.goto(`${URLS.agency}/students?nationality=VN&missing=1`);
  await page.getByRole('button', { name: 'Save view' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Save this view' });
  await dialog.locator('#sv-name').fill(viewName);
  await dialog.getByRole('button', { name: 'Whole team' }).click();
  await dialog.getByRole('button', { name: 'Save view' }).click();
  await expect(dialog).toBeHidden();

  const ctx = await browser.newContext();
  const counselor = await ctx.newPage();
  try {
    await uiLogin(counselor, 'agency', COUNSELOR);
    await counselor.goto(`${URLS.agency}/students`);
    // V22: saved views are options of the toolbar "View" select, grouped under "Team views"; every admin may use them.
    const view = counselor.getByRole('combobox', { name: 'View' });
    const option = view.locator('optgroup[label="Team views"] option', { hasText: viewName });
    await expect(option).toHaveCount(1);
    await view.selectOption({ label: viewName });
    await expect(counselor).toHaveURL(/saved=/);
  } finally {
    await ctx.close();
  }
  const M = await lotusManager(request);
  const views = await (await request.get(`${API}/agency/saved-views`, { headers: M })).json();
  const v = views.find((x: { name: string }) => x.name === viewName);
  expect(v.scope).toBe('TEAM');
  expect(v.filters).toMatchObject({ nationality: ['VN'], missing_documents: true });
  expect((await request.delete(`${API}/agency/saved-views/${v.id}`, { headers: M })).status()).toBe(204);
});

test('a counselor sends a message with an attachment the student can download', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  await uiLogin(page, 'agency', MANAGER);
  await page.goto(`${URLS.agency}/students/${studentId}?tab=messages`);
  await page.locator('.ag-composer input[type=file]').first().setInputFiles({ name: 'visa-checklist.pdf', mimeType: 'application/pdf', buffer: pdf('Checklist') });
  await expect(page.getByRole('button', { name: 'Remove visa-checklist.pdf' })).toBeVisible();
  // V22: the workspace shows the conversation in place and again under Details → Communication; use the first composer.
  await page.getByRole('textbox', { name: 'Message' }).first().fill('Here is the visa checklist we discussed.');
  await page.getByRole('button', { name: /^Send/ }).first().click();
  await expect(page.getByRole('list', { name: 'Messages' }).getByText('visa-checklist.pdf').first()).toBeVisible();

  const conv = (await (await request.get(`${API}/conversations`, { headers: S })).json())[0];
  const msgs = (await (await request.get(`${API}/conversations/${conv.id}/messages`, { headers: S })).json()).messages;
  const att = msgs.flatMap((m: { attachments: { id: string; filename: string }[] }) => m.attachments).find((a: { filename: string }) => a.filename === 'visa-checklist.pdf');
  expect(att).toBeTruthy();
  const link = await (await request.post(`${API}/attachments/${att.id}/download-url`, { headers: S })).json();
  expect(link.expires_in).toBeGreaterThan(0);
  expect((await (await request.get(link.url.startsWith('http') ? link.url : `${API_ORIGIN}${link.url}`)).body()).subarray(0, 4).toString()).toBe('%PDF');
});
