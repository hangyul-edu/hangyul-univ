/**
 * V5 FLOW G — one operational Today. The agency manager sees application work, essay reviews and service cases
 * (visa support, airport pickup, housing, residence card) in the same queue, and every number opens exactly the list
 * it counts (same predicate on both sides).
 */
import { expect, test } from '@playwright/test';

import { API, apiLogin, uiLogin, URLS } from './helpers';

const MANAGER = 'manager@lotus.demo.hangyul.kr';

test('Today carries application, writing and service work in one queue; counts match their lists', async ({ page, request }) => {
  const A = await apiLogin(request, MANAGER, 'agency');
  const today = await (await request.get(`${API}/agency/today`, { headers: A })).json();
  for (const k of ['overdue_tasks', 'documents_waiting', 'writing_reviews', 'service_cases', 'document_checks']) expect(today, k).toHaveProperty(k);

  // Writing: the count equals the queue view the row links to.
  const wView = new URL(today.writing_reviews.queue, URLS.agency).searchParams.get('view');
  const wq = await (await request.get(`${API}/writing/queue?view=${wView}`, { headers: A })).json();
  const wItems = (wq.items ?? wq) as unknown[];
  expect(wItems.length).toBe(today.writing_reviews.count);

  // Services: the count equals the Services view the row links to.
  if (today.service_cases.view) {
    const sq = await (await request.get(`${API}/agency/service-cases?view=${today.service_cases.view}`, { headers: A })).json();
    expect(sq.counts[today.service_cases.view]).toBe(today.service_cases.count);
  }

  // V9 A2: Today is ONE ranked queue — the V5–V8 block of category rows ("Essay reviews", "Service cases"…)
  // became filters over the same list. **The claim under test has not changed in four passes: every number
  // opens exactly the list it counts.** What changed in V13 is which control carries which narrowing.
  //
  // Measured at 200 students per counsellor (docs/qa/v13/AGENCY_AT_SCALE.md), five of the nine work types are
  // double digits, so a chip row of them is a second KPI row — V12's own hostile review predicted exactly
  // that. The chips are now four operational states (urgent / ours / waiting on student / waiting on
  // university), which do not multiply with caseload size, and the nine work types moved into one Filter
  // select. Both still filter the one queue with the same predicate the counts use.
  const queue = await (await request.get(`${API}/agency/today/queue?scope=team&limit=100`, { headers: A })).json();
  for (const k of ['by_type', 'by_state', 'all_total', 'items']) expect(queue, k).toHaveProperty(k);

  await uiLogin(page, 'agency', MANAGER);
  await page.goto(URLS.agency);
  // V22: Today is the process strip + ONE work table. Every stage count equals the rows the table shows when that
  // stage is selected (REPORT §249 G1, §260) — checked here for every stage with a non-zero count.
  const strip = page.locator('.hg-pipe__rail');   // V31: views (전체/긴급/종료) sit outside the rail; stages only
  await expect(strip).toBeVisible();
  const table = page.locator('[data-work-total]');
  await expect(table).toBeVisible();
  // the attribute is 0 until the first page of rows lands; wait for the real total rather than reading it on arrival
  await expect.poll(async () => Number(await table.getAttribute('data-work-total')), { timeout: 15_000 }).toBeGreaterThan(0);
  let checked = 0;
  for (const li of await strip.locator('li[data-stage]').all()) {
    const n = Number(((await li.locator('.hg-pipe__count').textContent().catch(() => '0')) ?? '0').replace(/\D/g, '') || 0);
    if (!n) continue;
    await li.locator('button').click();
    const key = await li.getAttribute('data-stage');
    await expect(page.locator(`[data-work-stage="${key}"]`)).toBeVisible();
    await expect(page.locator('[data-work-total]')).toHaveAttribute('data-work-total', String(n));
    await li.locator('button').click();
    checked += 1;
  }
  expect(checked).toBeGreaterThan(0);
  // Every row carries a next action — nothing on Today is a KPI tile.
  expect(await page.locator('[data-work-total] tbody tr').count()).toBeGreaterThan(0);
});
