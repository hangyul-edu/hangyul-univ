/**
 * V6 writing review loop: the reviewer comments on a selection with a suggested wording and requests changes (R) →
 * the next essay of the same queue view opens → the student accepts the suggestion in the margin and resubmits with
 * the authorship statement → the reviewer sees "Accepted by the student", approves (A) → the next essay opens.
 * Uses an E2E account (e2e-…@example.com, purged in global teardown); the essay title carries "E2E" so staff
 * notifications about it are purged too. Seeded essays are only viewed, never changed.
 */
import { expect, test, type Page } from '@playwright/test';

import { activatePlan, API, apiLogin, registerStudent, uiLogin, URLS } from './helpers';

test.describe.configure({ mode: 'serial' });

const email = `e2e-writing6-${Date.now()}@example.com`;
const password = 'e2e-password-123';
const QUOTE = 'I helped in my aunt\'s shop.';
const SUGGESTION = 'I kept the accounts of my aunt\'s tailoring shop every weekend.';
// Sentences of its own: the "own words" check compares against every other essay in Hangyul, including the V5 spec's.
const TEXT = 'Kyungpook National University is where I want to study Business Administration, because small family firms fascinate me. '
  + `${QUOTE} My favourite course so far was microeconomics, especially how small shops set their prices. At Kyungpook I want to combine marketing with data analysis. `
  + 'Later I hope to join a Korean retailer in Da Nang and teach local family businesses to read their own sales numbers.';
let S: Record<string, string>;
let A: Record<string, string>;
let reviewerEmail = '';
let essayId = '';
/** Why the paid case could not be set up, if it could not — see `activatePlan`. */
let skipReason = '';

async function selectInText(page: Page, quote: string) {
  await page.locator('.wr-text').evaluate((el, q) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    while (walker.nextNode()) { if ((walker.currentNode as Text).data.includes(q)) { node = walker.currentNode as Text; break; } }
    const start = node!.data.indexOf(q);
    const range = document.createRange();
    range.setStart(node!, start);
    range.setEnd(node!, start + q.length);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, quote);
}

test('W1 the student writes and submits with the authorship statement', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  S = await registerStudent(request, { email, password, full_name: 'Mai E2E Writing', locale: 'en', nationality: 'VN' });
  await request.patch(`${API}/me/profile`, { headers: S, data: { residence_country: 'VN', date_of_birth: '2007-03-01', target_degree: 'BACHELOR', target_intake_year: 2027, target_intake_term: 'SPRING', desired_fields: ['business'] } });
  const bought = await activatePlan(request, S, 'PREMIUM');
  if (!bought.paid) skipReason = bought.reason;
  test.skip(!bought.paid, skipReason);
  expect((bought.order as { assignment: { organization: string } }).assignment.organization).toContain('Lotus');
  const progs = await (await request.get(`${API}/programs?q=Business&page_size=200`, { headers: S })).json();
  const programId = (progs.items ?? []).find((p: { university?: { slug?: string }; name_en: string }) => p.university?.slug === 'kyungpook-national-university' && p.name_en.startsWith('Business'))?.id;
  const app = await request.post(`${API}/applications`, { headers: S, data: { program_id: programId } });
  expect(app.status()).toBe(201);
  const created = await request.post(`${API}/essays`, { headers: S, data: { essay_type: 'PERSONAL_STATEMENT', title: 'E2E personal statement', application_id: (await app.json()).id, body: TEXT } });
  expect(created.status()).toBe(201);
  essayId = (await created.json()).id;

  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  await expect(page.getByRole('textbox', { name: 'Essay text' })).toHaveValue(TEXT);
  await page.getByRole('button', { name: 'Submit for review' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Send for review' })).toBeDisabled();
  await dialog.getByText('These are my own words and facts').click();
  await dialog.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText(/Assigned to .* expected by/)).toBeVisible();
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.status).toBe('AGENCY_REVIEW');
  expect(Object.keys(e.writing.attestations)).toEqual([String(e.current_version)]);
});

test('W2 the reviewer comments on a selection with a suggestion, requests changes (R) and lands on the next essay', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  for (const who of ['reviewer@lotus.demo.hangyul.kr', 'counselor@lotus.demo.hangyul.kr', 'counselor2@lotus.demo.hangyul.kr', 'manager@lotus.demo.hangyul.kr']) {
    const h = await apiLogin(request, who, 'agency');
    const me = await (await request.get(`${API}/auth/me`, { headers: h })).json();
    if (me.user?.id === e.reviewer.id || who.startsWith('manager')) { A = h; reviewerEmail = who; if (me.user?.id === e.reviewer.id) break; }
  }
  await uiLogin(page, 'agency', reviewerEmail);
  await page.goto(`${URLS.agency}/essays?view=team`); // the queue view the reviewer works in (remembered)
  await expect(page.getByRole('button', { name: 'Open next essay' })).toBeVisible();
  await page.goto(`${URLS.agency}/essays/${essayId}`);
  await expect(page.getByText('University question', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Sample wording')).toHaveCount(0);

  await selectInText(page, QUOTE);
  await expect(page.locator('.wr-float')).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.getByText(/will see this/)).toBeVisible();
  await page.locator('#c-body').fill('E2E: what exactly did you do there? One concrete detail.');
  await page.locator('#c-sugg').fill(SUGGESTION);
  await page.getByRole('button', { name: 'Send to student' }).click();
  await expect(page.locator('.wr-cmt').filter({ hasText: 'One concrete detail' }).getByText('Waiting for the student')).toBeVisible();

  await page.locator('.wr-text').click();
  await page.keyboard.press('r');
  await page.getByRole('dialog').getByRole('button', { name: 'Send and open next' }).click();
  await expect(page).not.toHaveURL(new RegExp(`/essays/${essayId}$`));
  const after = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(after.status).toBe('CHANGES_REQUESTED');
});

test('W3 the student accepts the suggestion in the margin and resubmits', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  const card = page.locator('.sw-cmt').filter({ hasText: 'One concrete detail' });
  await expect(card.getByText(SUGGESTION)).toBeVisible();
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card.getByText(/You accepted this/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Essay text' })).toHaveValue(TEXT.replace(QUOTE, SUGGESTION));
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('dialog').getByText('These are my own words and facts').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText(/Assigned to/)).toBeVisible();
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.writing.review.round).toBe(2);
  expect(e.writing.attestations[String(e.current_version)]).toBeTruthy();
});

test('W4 the reviewer sees the decision, approves (A) and the next essay opens', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  const ae = await (await request.get(`${API}/essays/${essayId}`, { headers: A })).json();
  for (const d of ae.writing.rubric.dimensions as { key: string }[]) {
    expect((await request.put(`${API}/writing/essays/${essayId}/rubric/${d.key}`, { headers: A, data: { rating: 'MEETS' } })).ok()).toBeTruthy();
  }
  await uiLogin(page, 'agency', reviewerEmail);
  await page.goto(`${URLS.agency}/essays?view=team`);
  await page.goto(`${URLS.agency}/essays/${essayId}`);
  await expect(page.locator('.wr-cmt').filter({ hasText: 'One concrete detail' })).toHaveCount(0); // resolved → hidden by default
  await page.getByRole('button', { name: /Show resolved/ }).click();
  await expect(page.locator('.wr-cmt').filter({ hasText: 'One concrete detail' }).getByText(/Accepted by the student/)).toBeVisible();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.getByText(/Authorship confirmed by the student/).first()).toBeVisible();

  await page.locator('.wr-text').click();
  await page.keyboard.press('a');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve and open next' }).click();
  await expect(page).not.toHaveURL(new RegExp(`/essays/${essayId}$`));
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.status).toBe('APPROVED');
  expect(e.body).toContain(SUGGESTION);
});
