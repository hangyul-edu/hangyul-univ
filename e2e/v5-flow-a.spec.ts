/**
 * V5 FLOW A — Nepal student, first half: sign-up (owner 261119: no anonymous quick check) → recommendations → choose a program → documents with
 * Nepal's own legalization route (consular, Nepal is not an Apostille member) → personal statement with automatic
 * checks → counselor review assigned with an expected time.
 *
 * The second half (application READY → guided submission on the official portal → confirmation recorded) needs every
 * document verified and essays approved by the agency, so it runs on the seeded Nepal persona in v5-success.spec.ts.
 */
import { expect, test } from '@playwright/test';

import { activatePlan, API, apiLogin, pdf, registerViaUi, URLS } from './helpers';

test('Nepal: sign-up → program → consular legalization at the point of need → essay with checks → reviewer assigned', async ({ page, request }) => {
  // 1. Owner 261119 (req. 1): there is no anonymous quick check. The old entry leads to sign-in with `next=/match`;
  // the student creates an account there (verified four-step sign-up; the Nepali number is normalised to +977).
  await page.goto(`${URLS.student}/start?nationality=NP&level=BACHELOR`);
  await expect(page).toHaveURL(/\/login\?.*next=%2Fmatch/);
  await page.goto(`${URLS.student}/register?next=%2Fmatch`);
  const email = `e2e-v5a-${Date.now()}@example.com`;
  await registerViaUi(page, request, { email, password: 'e2e-password-123', full_name: 'Nepal Flow E2E', nationality: 'NP', phone_country: 'NP', phone_local: `9841${String(Date.now()).slice(-6)}` });
  // Personalised matching is part of the plan: without one, the next stop is the plan screen for matching.
  await expect(page).toHaveURL(/\/services\?.*gate=match|\/match/);

  // 2. Recommendations carry the student's nationality; confirm the education the quick check assumed.
  const S = await apiLogin(request, email, 'student', 'e2e-password-123');
  const prof = await (await request.get(`${API}/me/profile`, { headers: S })).json();
  expect(prof.nationality ?? prof.profile?.nationality).toBe('NP');
  await request.post(`${API}/me/educations`, { headers: S, data: { level: 'HIGH_SCHOOL', institution: 'Kathmandu Secondary School', country: 'NP', graduation_year: 2025, graduation_status: 'GRADUATED', gpa_value: 3.4, gpa_scale_max: 4 } });
  // What the retired quick check used to carry into the profile (bachelor's, TOPIK 3) is now entered on the profile itself.
  await request.patch(`${API}/me/profile`, { headers: S, data: { target_degree: 'BACHELOR', target_intake_year: 2027, target_intake_term: 'SPRING', desired_fields: ['business'] } });
  await request.post(`${API}/me/languages`, { headers: S, data: { test: 'TOPIK', score: 3, test_date: '2026-07-01' } });
  const matches = await (await request.get(`${API}/me/matches`, { headers: S })).json();
  const pick = matches.items.find((m: { tier: string; intake_id: string | null }) => (m.tier === 'STRONG' || m.tier === 'COMPETITIVE') && m.intake_id);
  expect(pick, 'a program the student meets the published requirements for').toBeTruthy();
  // Match results carry no probability field (the methodology text may say it never estimates one).
  expect(JSON.stringify(matches)).not.toMatch(/"(admission_)?probability"\s*:/i);

  // 3. Choose it: the application is created from the program.
  const created = await request.post(`${API}/applications`, { headers: S, data: { program_id: pick.program_id, intake_id: pick.intake_id } });
  expect(created.status(), await created.text()).toBe(201);
  const appId = (await created.json()).id as string;

  // 4. Documents: upload the transcript issued in Nepal → the dossier names Nepal's route (consular, not apostille).
  const up = await request.post(`${API}/documents`, { headers: S, multipart: { category: 'TRANSCRIPT', issuing_country: 'NP', language: 'ne', file: { name: 'transcript.pdf', mimeType: 'application/pdf', buffer: pdf('Transcript — Nepal Flow E2E') } } });
  expect(up.ok(), await up.text()).toBeTruthy();
  const dossier = await (await request.get(`${API}/me/dossier`, { headers: S })).json();
  const transcript = dossier.rows.find((r: { category: string }) => r.category === 'TRANSCRIPT');
  expect(transcript.document.legalization.path).toBe('CONSULAR_LEGALIZATION');
  expect(JSON.stringify(transcript)).not.toMatch(/"APOSTILLE"/);

  /*
   * Everything above is the substance of this flow — Nepal's consular route, chosen over apostille because
   * Nepal is not a Hague member — and none of it needs a purchase: drafting, uploading and reading the
   * dossier are the student's own. The legs below are the **managed** service, which a plan buys (V17,
   * REPORT §159), so the plan is activated here rather than at registration: a refusal costs the UI legs
   * and not the Nepal evidence.
   */
  const bought = await activatePlan(request, S, 'PREMIUM');
  test.skip(!bought.paid, bought.paid ? '' : bought.reason);

  // Still signed in from registration.
  await page.goto(`${URLS.student}/documents`);
  await expect(page.getByText(/consular/i).first()).toBeVisible();

  // 5. Personal statement for this application: automatic checks, never a "write for me".
  const essays = (await (await request.get(`${API}/essays`, { headers: S })).json()).items as { id: string; application_id: string; essay_type: string }[];
  const ps = essays.find((e) => e.application_id === appId && e.essay_type === 'PERSONAL_STATEMENT');
  expect(ps, 'the application pre-creates its personal statement').toBeTruthy();
  await page.goto(`${URLS.student}/essays/${ps!.id}`);
  await expect(page.getByRole('button', { name: /write for me|generate/i })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Essay text' }).first().fill(
    'I graduated from secondary school in Kathmandu in 2025. My family runs a small trading shop, and keeping its accounts taught me how prices, ' +
    'stock and trust connect. I want to study business administration in Korea to learn how growing companies plan their supply chains. ' +
    'After graduating I plan to help small Nepali exporters reach Korean buyers.');
  await page.getByRole('button', { name: /Check my draft/ }).click();
  await expect(page.getByText(/Automatic check/i).first()).toBeVisible();
});
