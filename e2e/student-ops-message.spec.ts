/**
 * Exhaustive pass (2026-11-21), brief item 68 — the real lifecycle of a first message, on the isolated stack:
 *
 *   a new student registers → buys a plan → the case is assigned to Hangyul Operations → the student writes from the
 *   Student UI → the assigned Operations user sees that exact message in the Operations UI → replies → the student sees
 *   the reply, signed by the team (never a staff name).
 *
 * Real API, real database (the e2e clone), real builds. Nothing here goes through Design Preview.
 * Run: node scripts/qa/e2e-run.mjs student-ops-message
 */
import { expect, test } from '@playwright/test';

import { activatePlan, API, apiLogin, registerStudent, uiLogin, URLS } from './helpers';

test.describe.configure({ mode: 'serial' });

const email = `e2e-msg-${Date.now()}@example.com`;
const password = 'e2e-password-123';
const body = `Hello team — can I use a one-day bank balance certificate? (${Date.now()})`;
const reply = `Yes, a one-day certificate issued within 30 days is fine. (${Date.now()})`;
let S: Record<string, string>;
let paid = false;
let reason = '';
let org = '';
let convId = '';

test('a new student registers and buys a plan; the case is assigned to Operations', async ({ request }) => {
  S = await registerStudent(request, { email, password, full_name: `Message Flow E2E ${Date.now()}`, locale: 'en', nationality: 'VN' });
  const r = await activatePlan(request, S, 'ALL_IN_ONE');
  if (!r.paid) { reason = r.reason; test.skip(true, reason); return; }
  paid = true;
  const assignment = (r.order as { assignment?: { organization?: string } }).assignment;
  org = assignment?.organization ?? '';
  expect(org).not.toBe('');
});

test('the student writes to the team from the Student UI', async ({ page }) => {
  test.skip(!paid, reason);
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/messages`);
  await page.getByRole('button', { name: /new message/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/subject/i).fill('Bank balance certificate');
  await dialog.getByRole('textbox').last().fill(body);
  await dialog.getByRole('button', { name: /^send$/i }).click();
  await expect(page.getByText(body).first()).toBeVisible();
});

test('the assigned Operations user sees exactly that message and replies; the student sees the team\'s reply', async ({ page, request }) => {
  test.skip(!paid, reason);
  const convs = await (await request.get(`${API}/conversations`, { headers: S })).json();
  const conv = convs.find((c: { subject: string }) => c.subject === 'Bank balance certificate');
  expect(conv).toBeTruthy();
  convId = conv.id;

  // The Operations user of the organisation the purchase assigned (fixture staff: manager@<org>.demo.hangyul.kr).
  const slug = org.toLowerCase().includes('lotus') ? 'lotus' : org.toLowerCase().includes('silk') ? 'silk' : 'lotus';
  const staff = `manager@${slug}.demo.hangyul.kr`;
  const M = await apiLogin(request, staff, 'agency');
  const staffConvs = await (await request.get(`${API}/conversations`, { headers: M })).json();
  expect(staffConvs.some((c: { id: string }) => c.id === convId)).toBeTruthy();

  await uiLogin(page, 'agency', staff);
  await page.goto(`${URLS.agency}/messages/${convId}`);
  await expect(page.getByText(body).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Message' }).first().fill(reply);
  await page.getByRole('button', { name: /^Send/ }).first().click();
  await expect(page.getByText(reply).first()).toBeVisible();

  // Student side: the reply is there, signed by the team identity — the staff member's own name is not shown.
  const ctx = await page.context().browser()!.newContext({ locale: 'en-US' });
  const sp = await ctx.newPage();
  try {
    await uiLogin(sp, 'student', email, password);
    await sp.goto(`${URLS.student}/messages/${convId}`);
    await expect(sp.getByText(reply).first()).toBeVisible();
    await expect(sp.locator('.st-msg__author').filter({ hasText: /Hangyul Univ team/i }).first()).toBeVisible();
    const me = await (await request.get(`${API}/auth/me`, { headers: M })).json();
    const staffName = (me.user ?? me).full_name as string;
    if (staffName) await expect(sp.locator('.st-thread__body')).not.toContainText(staffName);
  } finally {
    await ctx.close();
  }
});
