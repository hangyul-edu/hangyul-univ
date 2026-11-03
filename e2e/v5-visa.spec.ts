/**
 * FLOW E (V5 visa concierge): admission received → route resolved → existing documents reused → missing visa document →
 * student adds it → ready to apply → official hand-off → submission recorded (with a receipt number).
 * Persona: student.visaroute@demo.hangyul.kr (Mongolia, Kyungpook BBA, seeded by server/app/seed/extra_54_visa.py).
 * Needs a fresh seed (npm run db:reset): the submission can be recorded once.
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, pdf, uiLogin, URLS } from './helpers';

const STUDENT = 'student.visaroute@demo.hangyul.kr';
const COUNSELOR = 'counselor@silk.demo.hangyul.kr';

test('FLOW E — from admission to a recorded visa submission', async ({ page, request }) => {
  const sh = await apiLogin(request, STUDENT, 'student');
  const start = await (await request.get(`${API}/me/visa-route`, { headers: sh })).json();
  test.skip(!start.case || !['DOCUMENT_PREPARATION', 'READY_TO_APPLY'].includes(start.case.status), 'persona already submitted — run after npm run db:reset');

  // Admission received → the route is resolved from the Mongolia playbook.
  expect(start.route.country).toBe('MN');
  expect(start.post.city).toBe('Ulaanbaatar');
  await uiLogin(page, 'student', STUDENT);
  await page.goto(`${URLS.student}/visa`);
  await expect(page.getByText('Your D-2-2 visa plan')).toBeVisible();
  await expect(page.getByText(/Korean Embassy in Ulaanbaatar · at the visa application centre/)).toBeVisible();
  await page.getByText('Why this route?').click();
  await expect(page.getByText(/Official sources/)).toBeVisible();

  // Existing documents are reused (passport, graduation certificate… "From your documents").
  // V9 S6: the document list is one fold ("Your visa documents · N of M ready") that opens in place.
  const docsFold = page.locator('details.v9-fold').filter({ hasText: 'Your visa documents' });
  await expect(docsFold).toContainText(/\d+ of \d+ ready/);
  await docsFold.locator('.v9-fold__t').click(); // the fold's own summary (doc rows carry their own "Details" summaries)
  await docsFold.getByRole('button', { name: /ready, .* reused from your documents/ }).click();
  await expect(page.getByText('From your documents').first()).toBeVisible();

  // The missing visa document is what needs the student now.
  const now = page.locator('.sv-now');
  await expect(now.getByText('What needs you now')).toBeVisible();
  await expect(now.getByRole('heading', { name: 'TB certificate' })).toBeVisible();
  await expect(now.getByText(/Provided by: an official office or clinic/)).toBeVisible();
  await now.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // The student adds the TB certificate and the criminal record (upload + link — the modal itself is covered by the dossier
  // spec); the counselor checks both.
  const ah = await apiLogin(request, COUNSELOR, 'agency');
  for (const [key, title] of [['tb_test', 'TB certificate'], ['criminal_record', 'Criminal record certificate']]) {
    const up = await request.post(`${API}/documents`, { headers: sh, multipart: { file: { name: `${key}.pdf`, mimeType: 'application/pdf', buffer: pdf(title) }, category: 'OTHER', title, issuing_country: 'MN' } });
    expect(up.ok(), await up.text()).toBeTruthy();
    const doc = await up.json();
    expect((await request.post(`${API}/me/visa-route/items/${key}`, { headers: sh, data: { document_id: doc.id } })).ok()).toBeTruthy();
    expect((await request.post(`${API}/documents/${doc.id}/review`, { headers: ah, data: { decision: 'VERIFIED' } })).ok()).toBeTruthy();
  }

  // The student checks the preparation form (never submitted or declared by Hangyul).
  await page.reload();
  await expect(page.getByText(/For your preparation only/)).toBeVisible();
  for (let i = 0; i < 6; i += 1) {
    const btn = page.getByRole('button', { name: 'These details are right' }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText('6 of 6 sections checked')).toBeVisible();

  // Ready to apply → book the date on the official system (hand-off), note it here.
  await expect(page.getByText('Ready to apply').first()).toBeVisible();
  const date = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  await page.fill('#vr-appt', date);
  await page.selectOption('#vr-appt-st', 'BOOKED');
  await page.getByRole('button', { name: 'Save date' }).click();
  await expect(page.getByText(/Booked for/)).toBeVisible();
  const handoff = page.getByRole('link', { name: 'Open the official page' });
  await expect(handoff).toHaveAttribute('href', /overseas\.mofa\.go\.kr/);
  const [popup] = await Promise.all([page.waitForEvent('popup'), handoff.click()]);
  await popup.close();

  // Submission recorded — only with evidence (the button stays disabled without a receipt number).
  const record = page.getByRole('button', { name: 'Record submission' });
  await expect(record).toBeDisabled();
  await page.fill('#vr-sub-ref', 'KVAC-E2E-4411');
  await record.click();
  await expect(page.getByText(/Applied on .* · receipt KVAC-E2E-4411/)).toBeVisible();
  await expect(page.getByText('Submitted').first()).toBeVisible();

  const after = await (await request.get(`${API}/me/visa-route`, { headers: sh })).json();
  expect(after.case.status).toBe('SUBMITTED');
  expect(after.case.handoff_opened_at).toBeTruthy();
});
