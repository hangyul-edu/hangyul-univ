/**
 * FLOW D — writing review (V5).
 * A student writes and submits a personal statement → automatic checks run (a fact check against the profile) →
 * the matched agency reviewer comments inline in the review workspace → the student revises → final human approval
 * through the quality gate → the application uses the approved version.
 * Uses an E2E account (e2e-…@example.com, purged in global teardown).
 */
import { expect, test } from '@playwright/test';

import { activatePlan, API, apiLogin, registerStudent, registerViaUi, uiLogin, URLS } from './helpers';

test.describe.configure({ mode: 'serial' });

const email = `e2e-writing-${Date.now()}@example.com`;
const password = 'e2e-password-123';
const DRAFT = 'I graduated in 2024 from high school in Hanoi. I chose Business Administration at Kyungpook National University because I want to learn how family companies grow. '
  + 'In economics classes I studied how markets work, and I helped my aunt keep the accounts of her tailoring shop. During my studies I plan to take marketing and data courses. '
  + 'After graduation my career plan is to work for a Korean company in Vietnam and later help family businesses use data.';
const REVISED = DRAFT.replace('I graduated in 2024 from high school in Hanoi.', 'I will graduate from high school in Hanoi in 2027.')
  .replace('I helped my aunt keep the accounts of her tailoring shop.', 'I helped my aunt keep the accounts of her tailoring shop and noticed her best customers came from word of mouth.');
let S: Record<string, string>;
let A: Record<string, string>;
let reviewerEmail = '';
let appId = '';
let essayId = '';
/** Why the paid case could not be set up, if it could not — see `activatePlan`. */
let skipReason = '';

test('D1 a student with a paid service applies; the personal statement shows the university question honestly', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  S = await registerStudent(request, { email, password, full_name: 'Thu E2E Writing', locale: 'en', nationality: 'VN' });
  await request.patch(`${API}/me/profile`, { headers: S, data: { residence_country: 'VN', date_of_birth: '2008-03-01', target_degree: 'BACHELOR', target_intake_year: 2027, target_intake_term: 'SPRING', desired_fields: ['business'] } });
  await request.post(`${API}/me/educations`, { headers: S, data: { level: 'HIGH_SCHOOL', institution: 'Hanoi High School', country: 'VN', graduation_year: 2027, graduation_status: 'EXPECTED', gpa_value: 8.1, gpa_scale_max: 10 } });
  const bought = await activatePlan(request, S, 'PREMIUM');
  if (!bought.paid) skipReason = bought.reason;
  test.skip(!bought.paid, skipReason);
  expect((bought.order as { assignment: { organization: string } }).assignment.organization).toContain('Lotus');
  const progs = await (await request.get(`${API}/programs?q=Business&page_size=200`, { headers: S })).json().catch(() => ({ items: [] }));
  const programId = (progs.items ?? []).find((p: { university?: { slug?: string }; name_en: string }) => p.university?.slug === 'kyungpook-national-university' && p.name_en.startsWith('Business'))?.id;
  expect(programId, 'Kyungpook BBA program').toBeTruthy();
  const app = await request.post(`${API}/applications`, { headers: S, data: { program_id: programId } });
  expect(app.status(), await app.text()).toBe(201);
  appId = (await app.json()).id;
  const essays = await (await request.get(`${API}/essays`, { headers: S })).json();
  essayId = essays.items.find((e: { application_id: string; essay_type: string }) => e.application_id === appId && e.essay_type === 'PERSONAL_STATEMENT').id;

  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  await expect(page.getByText("The university's question").first()).toBeVisible();
  await expect(page.getByText(/Check the exact wording in the university's application guide/)).toBeVisible(); // V6 wording
  await expect(page.getByRole('button', { name: /write for me|AI/i })).toHaveCount(0);
});

test('D2 the student writes and submits; the automatic check asks her to check one sentence and changes nothing', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  await page.getByRole('textbox', { name: 'Essay text' }).first().fill(DRAFT);
  await page.getByRole('button', { name: /Check my draft/ }).click();
  await expect(page.getByText('Please check these sentences')).toBeVisible();
  await expect(page.getByText(/expected graduation 2027/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('dialog').getByText('These are my own words and facts').click(); // V6 authorship statement
  await page.getByRole('dialog').getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText(/Assigned to .* expected by/)).toBeVisible();
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.body).toBe(DRAFT);
  expect(e.status).toBe('AGENCY_REVIEW');
  expect(e.writing.review.round).toBe(1);
  expect(e.writing.findings.some((f: { code: string; status: string }) => f.code === 'FACT_GRAD_YEAR' && f.status === 'OPEN')).toBeTruthy();
});

test('D3 the matched reviewer comments inline; approval is blocked by the quality gate', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  const reviewerId = e.reviewer.id as string;
  const lotus = ['reviewer@lotus.demo.hangyul.kr', 'counselor@lotus.demo.hangyul.kr', 'counselor2@lotus.demo.hangyul.kr'];
  for (const who of lotus) {
    const h = await apiLogin(request, who, 'agency');
    const me = await (await request.get(`${API}/auth/me`, { headers: h })).json();
    if (me.user?.id === reviewerId) { A = h; reviewerEmail = who; break; }
  }
  if (!A) { reviewerEmail = 'manager@lotus.demo.hangyul.kr'; A = await apiLogin(request, reviewerEmail, 'agency'); }

  await uiLogin(page, 'agency', reviewerEmail);
  await page.goto(`${URLS.agency}/essays/${essayId}`);
  await expect(page.getByText('University question')).toBeVisible();
  await expect(page.getByText('Review due')).toBeVisible();
  // Inline comment on a selected passage (student-visible mode is explicit).
  const text = page.locator('.wr-text');
  await text.evaluate((el) => {
    const node = [...el.querySelectorAll('span, mark')].map((n) => n.firstChild).find((n) => n?.textContent?.includes('I helped my aunt')) as Text;
    const start = node.textContent!.indexOf('I helped my aunt');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 'I helped my aunt keep the accounts of her tailoring shop.'.length);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('button', { name: /Comment on selection/i }).click();
  await expect(page.getByText(/will see this/)).toBeVisible();
  await page.locator('#c-body').fill('What did you notice in those accounts? One concrete observation would make this real.');
  await page.getByRole('button', { name: 'Send to student' }).click();
  await expect(page.getByText('What did you notice in those accounts?')).toBeVisible();
  // The gate blocks approval while the fact finding is open.
  const blocked = await request.post(`${API}/essays/${essayId}/status`, { headers: A, data: { status: 'APPROVED' } });
  expect(blocked.status()).toBe(409);
  expect((await request.post(`${API}/essays/${essayId}/status`, { headers: A, data: { status: 'CHANGES_REQUESTED' } })).ok()).toBeTruthy();
});

test('D4 the student sees the comment by author type, revises and resubmits', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  await expect(page.getByText('What did you notice in those accounts?')).toBeVisible();
  // V22: the student sees the Hangyul team identity, never a named reviewer.
  await expect(page.getByText(/Hangyul Univ team/).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Essay text' }).first().fill(REVISED);
  await page.getByRole('button', { name: /Save version/ }).click();
  const e0 = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  for (const c of e0.comments) if (!c.resolved) await request.post(`${API}/essays/${essayId}/comments/${c.id}/resolve`, { headers: S });
  await page.reload();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('dialog').getByText('These are my own words and facts').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText(/Assigned to/)).toBeVisible();
  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.writing.review.round).toBe(2);
  expect(e.writing.findings.filter((f: { kind: string; status: string }) => f.kind === 'FACT' && f.status === 'OPEN')).toHaveLength(0);
});

test('D5 final human approval through the quality gate; the application uses the approved version', async ({ page, request }) => {
  test.skip(!!skipReason, skipReason);
  for (const d of ['ANSWERS_PROMPT', 'MOTIVATION', 'PROGRAM_CONNECTION', 'FUTURE_PLAN']) {
    expect((await request.put(`${API}/writing/essays/${essayId}/rubric/${d}`, { headers: A, data: { rating: 'MEETS' } })).ok()).toBeTruthy();
  }
  expect((await request.post(`${API}/essays/${essayId}/status`, { headers: A, data: { status: 'FINAL_REVIEW' } })).ok()).toBeTruthy();

  await uiLogin(page, 'agency', reviewerEmail);
  await page.goto(`${URLS.agency}/essays/${essayId}`);
  await expect(page.getByText('University question')).toBeVisible(); // loaded before using the panel
  await page.getByRole('tab', { name: /Checks/ }).click(); // V6: the gate lives at the top of Checks
  await page.locator('.wr-gatebox__head').click(); // V6: the gate summary at the top of Checks
  await expect(page.getByText('Profile consistency')).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve and open next' }).click();
  await expect(page.getByText(/Approved\. The application now uses this version/)).toBeVisible();

  const e = await (await request.get(`${API}/essays/${essayId}`, { headers: S })).json();
  expect(e.status).toBe('APPROVED');
  const detail = await (await request.get(`${API}/applications/${appId}`, { headers: S })).json();
  const ps = detail.checklist.find((i: { category: string }) => i.category === 'PERSONAL_STATEMENT');
  expect(ps.ready).toBeTruthy();
  expect(ps.essay_approved_version).toBe(e.current_version);
  const pkg = await (await request.get(`${API}/writing/applications/${appId}/approved`, { headers: S })).json();
  expect(pkg.items[0].body).toBe(REVISED);

  await uiLogin(page, 'student', email, password);
  await page.goto(`${URLS.student}/essays/${essayId}`);
  await expect(page.getByText(new RegExp(`[Vv]ersion ${e.current_version} is approved\\. Your .* application uses it`))).toBeVisible();
});
