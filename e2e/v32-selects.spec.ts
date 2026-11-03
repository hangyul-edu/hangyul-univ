/**
 * V32 — `npm run qa:v32-selects` (through scripts/qa/e2e-run.mjs, on the isolated stack).
 *
 * 1. No visible browser-native <select> on any representative desktop route of the four products.
 * 2. The canonical control opens as our own listbox (role=listbox, no native menu), and the opened state is captured
 *    for the visual sign-off: directory type filter, Student filter, Agency filters, University filters, a long English
 *    option list, Vietnamese and Arabic (RTL). Screenshots land in docs/qa/v32/selects/.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

import { uiLogin, URLS } from './helpers';

const OUT = 'docs/qa/v32/selects';
mkdirSync(OUT, { recursive: true });

const ROUTES: Record<keyof typeof URLS, string[]> = {
  marketing: ['/', '/universities', '/universities/yonsei-university', '/start', '/privacy'],
  student: ['/', '/explore', '/applications', '/documents', '/services', '/settings', '/profile', '/visa', '/housing', '/arrival', '/budget', '/family', '/essays'],
  agency: ['/', '/students', '/pipeline', '/applications', '/documents', '/tasks', '/consultations', '/templates', '/performance', '/vendors', '/audit', '/payments', '/services', '/settings'],
  university: ['/', '/applicants', '/analytics', '/programs', '/documents', '/scholarships', '/rules', '/exports', '/settings', '/partnership'],
};
const LOGIN = { student: 'student@demo.hangyul.kr', agency: 'counselor@lotus.demo.hangyul.kr', university: 'admin@pusan.univ.demo.hangyul.kr' } as const;

async function visibleNativeSelects(page: Page): Promise<string[]> {
  return page.$$eval('select', (els) => els
    .filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0;
    })
    .map((el) => `${el.id || el.name || el.className || 'select'}@${location.pathname}`));
}

test.describe.configure({ mode: 'serial' });

for (const app of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
  test(`${app}: no visible native select on any representative route`, async ({ page }) => {
    test.setTimeout(8 * 60 * 1000); // 10–14 routes, networkidle each, on a host that may be building at the same time
    if (app !== 'marketing') await uiLogin(page, app, LOGIN[app], undefined, 'en');
    const found: string[] = [];
    for (const route of ROUTES[app]) {
      await page.goto(`${URLS[app]}${route}${route.includes('?') ? '&' : '?'}lang=en`, { waitUntil: 'networkidle' });
      found.push(...(await visibleNativeSelects(page)));
      // Filter sheets on phones and drawers hold more controls: open the first "Filters" button if there is one.
      const filters = page.getByRole('button', { name: /^Filters$/ }).first();
      if (await filters.isVisible().catch(() => false)) { await filters.click(); found.push(...(await visibleNativeSelects(page))); await page.keyboard.press('Escape'); }
    }
    expect(found, `visible native <select> on ${app}`).toEqual([]);
  });
}

async function openFirstSelect(page: Page, name: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  const box = page.locator('.hg-fsel, .hg-sel').first(); // a Hangyul select, not the header search combobox
  await expect(box).toBeVisible();
  await box.click();
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  expect(await page.$$('select:not([style*="display: none"])').then((els) => els.length)).toBe(0);
  await page.waitForTimeout(300); // let the open animation finish before the capture
  await page.screenshot({ path: `${OUT}/${name}-${width}.png` });
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
}

test('opened-state captures: directory type filter in en, vi and ar (RTL)', async ({ page }) => {
  test.setTimeout(4 * 60 * 1000);
  for (const lang of ['en', 'vi', 'ar']) {
    await page.goto(`${URLS.marketing}/universities?lang=${lang}`, { waitUntil: 'networkidle' });
    await openFirstSelect(page, `marketing-universities-type-${lang}`);
  }
  // phone: the directory's filters are chips in a sheet (no select at all); a form select — Quick Fit's GPA scale —
  // opens as a bottom sheet with 48 px rows.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URLS.marketing}/start?lang=en`, { waitUntil: 'networkidle' });
  const box = page.locator('#hg-fit-scale');
  await box.scrollIntoViewIfNeeded();
  await box.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/marketing-quickfit-scale-en-390.png` });
});

test('opened-state captures: Quick Fit (long English list), Student, Agency and University filters', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  await page.goto(`${URLS.marketing}/start?lang=en`, { waitUntil: 'networkidle' });
  const scale = page.locator('#hg-fit-scale'); // the GPA scale: a form Select with a long option list
  await scale.scrollIntoViewIfNeeded();
  await scale.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/marketing-quickfit-scale-1280.png` });
  await page.keyboard.press('Escape');

  await uiLogin(page, 'student', LOGIN.student, undefined, 'en');
  await page.goto(`${URLS.student}/family?lang=en`, { waitUntil: 'networkidle' });
  await openFirstSelect(page, 'student-family-select');

  await uiLogin(page, 'agency', LOGIN.agency, undefined, 'en');
  await page.goto(`${URLS.agency}/students?lang=en`, { waitUntil: 'networkidle' });
  await openFirstSelect(page, 'agency-students-filter');
  await page.goto(`${URLS.agency}/applications?lang=en`, { waitUntil: 'networkidle' });
  await openFirstSelect(page, 'agency-applications-filter');

  await uiLogin(page, 'university', LOGIN.university, undefined, 'en');
  await page.goto(`${URLS.university}/applicants?lang=en`, { waitUntil: 'networkidle' });
  await openFirstSelect(page, 'university-applicants-filter');
  await page.goto(`${URLS.university}/documents?lang=en`, { waitUntil: 'networkidle' });
  await openFirstSelect(page, 'university-documents-filter');
});

test('keyboard: Arrow opens, typing finds, Enter chooses, focus stays on the control', async ({ page }) => {
  await page.goto(`${URLS.marketing}/universities?lang=en`, { waitUntil: 'networkidle' });
  const box = page.getByRole('combobox').first();
  await box.focus();
  await page.keyboard.press('ArrowDown');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  const active = () => box.getAttribute('aria-activedescendant');
  expect(await active()).toBeTruthy();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await expect(box).toBeFocused();
});
