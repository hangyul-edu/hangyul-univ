/**
 * The redesigned core screens, driven through the UI:
 *  student  — home answers "what now", Universities shows a verdict on every row, compare leads with the decision,
 *             documents are grouped by what they need, visa shows the real checklist before admission
 *  agency   — Today leads with the attention list, saved views filter the caseload, the review queue opens the oldest document
 *  university — Overview leads with decisions, quick views filter applicants, the decision box offers "Request documents"
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

test('student: home, discovery with verdicts, compare, documents and visa', async ({ page }) => {
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  await expect(page.getByRole('heading', { name: 'Your next step', exact: false }).or(page.getByText('Your next step'))).toBeVisible();
  await expect(page.getByRole('list', { name: /journey|progress/i })).toBeVisible();

  await page.getByRole('link', { name: 'Universities' }).first().click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.getByText(/You meet every published requirement, and it fits your budget/)).toBeVisible();
  const rows = page.locator('.v4-row');
  await expect(rows.first()).toBeVisible();
  await expect(page.getByText(/Strong match|Possible match/).first()).toBeVisible();

  // Disclose the reasons on two rows and add both to the comparison.
  for (const i of [0, 1]) {
    await rows.nth(i).getByRole('button', { name: /why this match/i }).click();
    await rows.nth(i).getByRole('button', { name: /compare/i }).click();
  }
  await page.getByRole('link', { name: /compare/i }).last().click();
  await expect(page).toHaveURL(/\/compare/);
  await expect(page.getByText('Lowest first-year cost').locator('visible=true').first()).toBeVisible();

  await page.goto(`${URLS.student}/documents`);
  await expect(page.getByText(/^\d+ of \d+ ready$/)).toBeVisible();   // V31 wording
  await expect(page.getByRole('heading', { name: 'Needs you' })).toBeVisible();

  await page.goto(`${URLS.student}/visa`);
  // V9 S6: the visa plan is folded — before admission the checklist is the row "Your visa documents · N of M ready",
  // which opens in place (the V8 "What you will need" section title became this fold's title + progress).
  const visaDocs = page.locator('details.v9-fold').filter({ hasText: 'Your visa documents' });
  await expect(visaDocs).toContainText(/\d+ of \d+ ready/);
  await visaDocs.locator('.v9-fold__t').click(); // the fold's own summary (doc rows carry their own "Details" summaries)
  await expect(visaDocs.getByText(/For your nationality/).first()).toBeVisible();
});

test('agency: Today, saved views and the review queue', async ({ page }) => {
  await uiLogin(page, 'agency', 'manager@lotus.demo.hangyul.kr');
  // V22/V31: Today is the pipeline rail + work table; a stage click filters the table and the counts agree.
  await expect(page.locator('.hg-pipe__rail')).toBeVisible();
  await expect(page.locator('[data-work-total]')).toBeVisible();
  await page.getByRole('link', { name: 'Students', exact: true }).first().click();
  // The former view tabs are one toolbar select; `?view=attention` is still the URL contract.
  await page.getByRole('combobox', { name: 'View' }).selectOption('attention');
  await expect(page).toHaveURL(/view=attention/);
  await page.goto(`${URLS.agency}/documents`);
  await expect(page.getByRole('button', { name: /^Verify/ })).toBeVisible();
});

test('university: decisions first, quick views and request documents', async ({ page, request }) => {
  const h = await apiLogin(request, 'admin@pusan.univ.demo.hangyul.kr', 'university');
  const list = await (await request.get(`${API}/applications?status=UNIVERSITY_REVIEW&page_size=5`, { headers: h })).json();
  test.skip(!list.items?.length, 'no application under review in this dataset');

  await uiLogin(page, 'university', 'admin@pusan.univ.demo.hangyul.kr');
  // V22: the home is the workflow strip + applicant table; "in review" is a clickable stage whose count equals the rows.
  const stage = page.locator('li[data-stage="in_review"]');
  await expect(stage).toBeVisible();
  const count = Number((await stage.locator('.hg-pipe__count').textContent())?.replace(/\D/g, '') || 0);   // V31 rail
  expect(count).toBeGreaterThan(0);
  await stage.locator('button').click();
  await expect(page.locator('[data-work-stage="in_review"]')).toBeVisible();
  await expect(page.locator('[data-work-total]')).toHaveAttribute('data-work-total', String(count));

  await page.goto(`${URLS.university}/applications/${list.items[0].id}`);
  await page.getByRole('button', { name: 'Request documents' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
