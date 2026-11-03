import { expect, test } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

/**
 * V3 university console: the document-request loop.
 * An admissions admin requests one document from the applicant review screen; the applicant's task must carry the exact
 * note, the application's checklist must lead with the request, and cancelling closes the task again.
 * Uses an existing Pusan National University application (prefers one already waiting for documents, so no status changes);
 * the request is labelled "E2E" and cancelled in afterAll.
 */
test.describe.configure({ mode: 'serial' });

const UNI_ADMIN = 'admin@pusan.univ.demo.hangyul.kr';
const HANGYUL = 'admin@demo.hangyul.kr';
const stamp = Date.now();
const label = `E2E bank certificate ${stamp}`;
const note = `E2E ${stamp}: please upload a bank certificate issued within the last 30 days, with an English translation.`;
let appId = '';
let studentId = '';
let requestId = '';

test.beforeAll(async ({ request }) => {
  const U = await apiLogin(request, UNI_ADMIN, 'university');
  const rows = (await (await request.get(`${API}/applications?limit=100`, { headers: U })).json()).items as { id: string; status: string }[];
  const pick = rows.find((a) => a.status === 'ADDITIONAL_DOCUMENTS') ?? rows.find((a) => ['UNDER_REVIEW', 'SUBMITTED'].includes(a.status));
  expect(pick, 'a PNU application that can receive a document request').toBeTruthy();
  appId = pick!.id;
});

test.afterAll(async ({ request }) => {
  if (!requestId) return;
  const U = await apiLogin(request, UNI_ADMIN, 'university');
  await request.post(`${API}/document-requests/${requestId}/cancel`, { headers: U });
});

test('university requests one document; the student task carries the exact note', async ({ page, request }) => {
  await uiLogin(page, 'university', UNI_ADMIN);
  await page.goto(`${URLS.university}/applications/${appId}`);
  // V9 review-and-advance: sending a request opens the NEXT applicant (the applicant acts next). Switch it off so the
  // reviewer stays on this applicant and can read the request back on the evidence card.
  const openNext = page.getByRole('checkbox', { name: /Open the next applicant/ });
  await expect(openNext).toBeVisible();
  await openNext.uncheck();
  await expect(openNext).not.toBeChecked();
  await page.getByRole('button', { name: 'Request documents' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Request a document' });
  await dialog.locator('#rq-cat').selectOption('BANK_STATEMENT');
  await dialog.locator('#rq-label').fill(label);
  await dialog.locator('#rq-note').fill(note);
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.uc-requests')).toContainText(label);
  await expect(page.locator('.uc-requests')).toContainText(note);

  // The application: request is OPEN and leads the checklist as a UNIVERSITY_REQUEST item.
  const U = await apiLogin(request, UNI_ADMIN, 'university');
  const app = await (await request.get(`${API}/applications/${appId}`, { headers: U })).json();
  studentId = app.student.id;
  const req = app.document_requests.find((r: { label: string }) => r.label === label);
  expect(req.status).toBe('OPEN');
  expect(req.note).toBe(note);
  requestId = req.id;
  expect(app.status).toBe('ADDITIONAL_DOCUMENTS');
  expect(app.checklist[0]).toMatchObject({ request_id: requestId, action_code: 'UNIVERSITY_REQUEST', action: note });

  // The student's task (visible to the student) has the university's words, unedited.
  const H = await apiLogin(request, HANGYUL, 'university');
  const tasks = (await (await request.get(`${API}/tasks?scope=team&student_id=${studentId}&limit=100`, { headers: H })).json()).items as
    { title: string; description: string; task_type: string; application_id: string; visible_to_student: boolean }[];
  const task = tasks.find((t) => t.description === note);
  expect(task, 'student task with the exact note').toBeTruthy();
  expect(task).toMatchObject({ task_type: 'UNIVERSITY_REQUEST', application_id: appId, visible_to_student: true });
  expect(task!.title).toContain(label);
});

test('cancelling the request closes the student task', async ({ request }) => {
  const U = await apiLogin(request, UNI_ADMIN, 'university');
  const r = await request.post(`${API}/document-requests/${requestId}/cancel`, { headers: U });
  expect(r.ok(), await r.text()).toBeTruthy();
  const H = await apiLogin(request, HANGYUL, 'university');
  const tasks = (await (await request.get(`${API}/tasks?scope=team&student_id=${studentId}&limit=100`, { headers: H })).json()).items as { description: string }[];
  expect(tasks.find((t) => t.description === note)).toBeUndefined();
  requestId = '';
});
