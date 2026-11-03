import { expect, test, type APIRequestContext } from '@playwright/test';

import { API, apiLogin, pdf, uiLogin, URLS } from './helpers';

/**
 * V5 FLOW B — universal dossier: a Vietnam student with an active application (seed persona Trần Minh Thư,
 * server/app/seed/extra_51_dossier.py: Pusan National University application under review, Kyungpook in preparation).
 *  1. Pusan asks for a document the dossier already has (TOPIK certificate) → "Send your existing …" → request fulfilled.
 *  2. Pusan asks for a bank certificate issued within the last 30 days; hers is 50 days old → the upload replaces it
 *     (new version of the same document, no duplicate) → request fulfilled → Pusan re-reviews the application.
 * Re-runnable: beforeAll closes leftover requests and resets the bank certificate's issue date to 50 days ago.
 */
test.describe.configure({ mode: 'serial' });

const STUDENT = 'student.dossier@demo.hangyul.kr';
const UNI = 'admin@pusan.univ.demo.hangyul.kr';
const stamp = Date.now();
let appId = '';
let bankId = '';

async function dossier(request: APIRequestContext, H: Record<string, string>) {
  return (await request.get(`${API}/me/dossier`, { headers: H })).json();
}

test.beforeAll(async ({ request }) => {
  const S = await apiLogin(request, STUDENT, 'student');
  const U = await apiLogin(request, UNI, 'university');
  const apps = (await (await request.get(`${API}/applications?limit=50`, { headers: S })).json()).items as { id: string; status: string; university: { slug: string } }[];
  const pnu = apps.find((a) => a.university.slug === 'pusan-national-university');
  expect(pnu, 'the persona has a Pusan application').toBeTruthy();
  appId = pnu!.id;
  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: U })).json();
  for (const r of detail.document_requests as { id: string; status: string }[]) {
    if (r.status === 'OPEN') await request.post(`${API}/document-requests/${r.id}/cancel`, { headers: U });
  }
  if (detail.status === 'ADDITIONAL_DOCUMENTS') await request.post(`${API}/applications/${appId}/transition`, { headers: U, data: { to: 'UNIVERSITY_REVIEW' } });
  const d = await dossier(request, S);
  bankId = d.rows.find((r: { category: string }) => r.category === 'BANK_STATEMENT').document.id;
  const old = new Date(Date.now() - 50 * 86_400_000).toISOString().slice(0, 10);
  expect((await request.patch(`${API}/documents/${bankId}`, { headers: S, data: { issue_date: old } })).ok()).toBeTruthy();
});

test('a request the dossier can answer: "Send your existing …" fulfils it', async ({ page, request }) => {
  const U = await apiLogin(request, UNI, 'university');
  const r = await request.post(`${API}/applications/${appId}/document-requests`, { headers: U,
    data: { label: `TOPIK certificate ${stamp}`, note: 'Please send your TOPIK score report.', category: 'TOPIK' } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const reqId = (await r.json()).id;

  await uiLogin(page, 'student', STUDENT);
  await page.goto(`${URLS.student}/applications/${appId}`);
  // Package line: the university's request is counted.
  await expect(page.locator('.dz-pkgline')).toContainText('asked for by the university');
  await page.getByRole('button', { name: /Upload and send/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('is already in your documents');
  await dialog.getByRole('button', { name: /Send your existing TOPIK certificate/ }).click();
  await expect(dialog).toBeHidden();

  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: U })).json();
  const req = detail.document_requests.find((x: { id: string }) => x.id === reqId);
  expect(req.status).toBe('FULFILLED');
  expect(req.document.category).toBe('TOPIK');
});

test('a request that needs a newer copy: the upload replaces it and fulfils the request', async ({ page, request }) => {
  const U = await apiLogin(request, UNI, 'university');
  const S = await apiLogin(request, STUDENT, 'student');
  const r = await request.post(`${API}/applications/${appId}/document-requests`, { headers: U,
    data: { label: `Bank balance certificate ${stamp}`, note: 'Please upload a bank certificate issued within the last 30 days.', category: 'BANK_STATEMENT' } });
  const reqId = (await r.json()).id;
  const before = (await (await request.get(`${API}/documents/${bankId}`, { headers: S })).json()).current_version as number;

  await uiLogin(page, 'student', STUDENT);
  await page.goto(`${URLS.student}/documents`);
  const row = page.locator('.dz-row--request', { hasText: `Bank balance certificate ${stamp}` });
  await expect(row).toContainText('within the last 30 days');
  await row.getByRole('button', { name: /Upload a newer bank balance certificate/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This replaces');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'bank-new.pdf', mimeType: 'application/pdf', buffer: pdf('Bank certificate E2E') });
  await dialog.locator('input[type=date]').first().fill(new Date().toISOString().slice(0, 10));
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(async () => {
    const d = await (await request.get(`${API}/applications/${appId}`, { headers: U })).json();
    return d.document_requests.find((x: { id: string }) => x.id === reqId).status;
  }).toBe('FULFILLED');
  const after = await (await request.get(`${API}/documents/${bankId}`, { headers: S })).json();
  expect(after.current_version).toBe(before + 1); // replaced in place — no duplicate document
  expect(after.issue_date).toBe(new Date().toISOString().slice(0, 10));

  // Every request answered → the university takes the application back into review.
  const t = await request.post(`${API}/applications/${appId}/transition`, { headers: U, data: { to: 'UNIVERSITY_REVIEW' } });
  expect(t.ok(), await t.text()).toBeTruthy();
  expect((await t.json()).status).toBe('UNIVERSITY_REVIEW');
  // The dossier no longer says Kyungpook needs a newer bank certificate.
  const d = await dossier(request, S);
  const bank = d.rows.find((x: { category: string }) => x.category === 'BANK_STATEMENT');
  expect(bank.applications.find((u: { university: string }) => u.university === 'Kyungpook National University').status).not.toBe('NEEDS_NEW_VERSION');
});
