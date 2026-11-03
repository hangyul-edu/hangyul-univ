/**
 * FLOW F (V5 concierge): visa issued → housing chosen → flight entered → airport pickup requested → agency confirms +
 * assigns a provider → pickup completed → arrival recorded → residence-card task becomes active.
 * Uses the seeded persona student.arrival@ (visa ISSUED). Needs a fresh seed (npm run db:reset): arrival can only be recorded once.
 */
import { expect, test } from '@playwright/test';

import { API, URLS, apiLogin, uiLogin } from './helpers';

const STUDENT = 'student.arrival@demo.hangyul.kr';
const COUNSELOR = 'counselor@lotus.demo.hangyul.kr';

test('FLOW F — from visa issued to an active residence-card task', async ({ page, request }) => {
  const sh = await apiLogin(request, STUDENT, 'student');
  const start = await (await request.get(`${API}/me/arrival-journey`, { headers: sh })).json();
  test.skip(start.stage === 'ARRIVED', 'persona already arrived — run after npm run db:reset');
  expect(start.stage).toBe('READY_TO_COME');

  // A clean pickup state: cancel a seeded open request so the student can book it through the UI.
  if (start.pickup && !start.pickup.closed) {
    expect((await request.post(`${API}/me/service-cases/${start.pickup.id}/cancel`, { headers: sh })).ok()).toBeTruthy();
  }

  await uiLogin(page, 'student', STUDENT);

  // Housing chosen: the dormitory (already confirmed for this persona) is the selected option.
  await page.goto(`${URLS.student}/housing`);
  await page.getByRole('radio', { name: /University dormitory/ }).click();
  await expect(page.getByRole('heading', { name: /Dormitories at/ })).toBeVisible();

  // Flight entered (manual, clearly not live).
  await page.goto(`${URLS.student}/arrival#flight`);
  await expect(page.getByRole('heading', { name: "You're ready to come to Korea." }).or(page.getByText("You're ready to come to Korea."))).toBeVisible();
  const flightStep = page.getByRole('button', { name: /Add your flight/ });
  if ((await flightStep.getAttribute('aria-expanded')) !== 'true') await flightStep.click();
  const change = page.getByRole('button', { name: 'Change flight' });
  if (await change.isVisible()) await change.click();
  await page.fill('#cg-flight', 'VN408');
  await page.fill('#cg-at', '2027-02-20T14:35');
  await page.getByRole('button', { name: 'Save flight' }).click();
  await expect(page.getByText('not live airline data').first()).toBeVisible();

  // Airport pickup requested.
  const pickupStep = page.getByRole('button', { name: /Book your airport pickup/ });
  if ((await pickupStep.getAttribute('aria-expanded')) !== 'true') await pickupStep.click();
  await page.selectOption('#cg-contact', 'KAKAOTALK');
  await page.getByRole('button', { name: 'Request pickup' }).click();
  await expect(page.getByText('Requested').first()).toBeVisible();

  // Agency confirms and assigns a provider + driver (API — the drawer UI is covered by screenshots).
  const ah = await apiLogin(request, COUNSELOR, 'agency');
  const journey = await (await request.get(`${API}/me/arrival-journey`, { headers: sh })).json();
  const cid = journey.pickup.id as string;
  const queue = await (await request.get(`${API}/agency/service-cases?view=needs_assignment`, { headers: ah })).json();
  expect(queue.items.some((c: { id: string }) => c.id === cid)).toBeTruthy();
  let r = await request.patch(`${API}/agency/service-cases/${cid}`, { headers: ah, data: { status: 'CONFIRMED' } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const vendors = await (await request.get(`${API}/agency/vendors?kind=airport_transport`, { headers: ah })).json();
  r = await request.patch(`${API}/agency/service-cases/${cid}`, { headers: ah, data: { vendor_id: vendors.items[0].id, details: { driver: { name: 'E2E driver', phone: '010-0000-0000' } }, status: 'DRIVER_ASSIGNED' } });
  expect(r.ok(), await r.text()).toBeTruthy();

  // The student sees the driver and who provides the service (V6: no per-row "Demo provider" label — is_demo stays in the API).
  await page.reload();
  const pickupStep2 = page.getByRole('button', { name: /Book your airport pickup/ });
  if ((await pickupStep2.getAttribute('aria-expanded')) !== 'true') await pickupStep2.click();
  await expect(page.getByText('Driver assigned').first()).toBeVisible();
  await expect(page.getByText(/Provided by /).first()).toBeVisible();
  await expect(page.getByText('Demo provider')).toHaveCount(0);

  // Pickup completed (with proof) → arrival recorded.
  r = await request.patch(`${API}/agency/service-cases/${cid}`, { headers: ah, data: { status: 'PICKED_UP' } });
  expect(r.ok(), await r.text()).toBeTruthy();
  r = await request.patch(`${API}/agency/service-cases/${cid}`, { headers: ah, data: { status: 'COMPLETED', note: 'Met at arrivals, dropped at the dormitory' } });
  expect(r.ok(), await r.text()).toBeTruthy();

  // Residence-card step is now the next action, with its task open for the student.
  await page.goto(`${URLS.student}/arrival`);
  await expect(page.getByText(/Welcome to Korea! You arrived on/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Apply for your residence card' })).toBeVisible();
  const tasks = await (await request.get(`${API}/tasks?page_size=100`, { headers: sh })).json();
  expect(tasks.items.some((t: { title: string; status: string }) => t.title === 'Apply for your residence card' && t.status === 'OPEN')).toBeTruthy();
});
