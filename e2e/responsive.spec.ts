import { expect, test } from '@playwright/test';

import { uiLogin, URLS } from './helpers';

const noOverflow = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

test('marketing home has no horizontal overflow and a visible primary CTA', async ({ page }) => {
  await page.goto(URLS.marketing);
  await noOverflow(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('student dashboard is usable on a phone', async ({ page }) => {
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  await noOverflow(page);
  await expect(page.getByRole('navigation', { name: /primary/i }).last()).toBeVisible();
  for (const path of ['/explore', '/applications', '/documents', '/visa']) {
    await page.goto(`${URLS.student}${path}`);
    await noOverflow(page);
  }
});

test('consoles work on a phone', async ({ page }) => {
  await uiLogin(page, 'agency', 'manager@lotus.demo.hangyul.kr');
  for (const path of ['/', '/students', '/pipeline']) { await page.goto(`${URLS.agency}${path}`); await noOverflow(page); }
  await uiLogin(page, 'university', 'admin@pusan.univ.demo.hangyul.kr');
  for (const path of ['/', '/applicants', '/cohorts']) { await page.goto(`${URLS.university}${path}`); await noOverflow(page); }
});
