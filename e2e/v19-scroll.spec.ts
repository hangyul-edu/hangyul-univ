/**
 * V19 — the route-scroll policy, asserted (REPORT §191, §206).
 *
 * The defect these guard: react-router's `<ScrollRestoration />` keys its saved offsets on `location.key`,
 * which is the string `"default"` for the first history entry of *every* document. The site's conversion
 * action was a plain `<a href="/start">`, so a reader who scrolled to the bottom of Home and clicked it got
 * a new document whose first entry was also `"default"` — and arrived at the bottom of `/start`.
 *
 * Every case below is one row of the policy table in `@hangyul/ui › route-scroll`. They assert *behaviour*
 * at the viewport, not that a particular function was called, so a future rewrite of the manager is free as
 * long as the product still behaves.
 */
import { expect, test, type Page } from '@playwright/test';

import { URLS } from './helpers';

const M = URLS.marketing;

/** The marketing app is client-rendered; nothing is measurable until the chrome exists. */
async function open(page: Page, path = '/') {
  await page.goto(`${M}${path}`);
  await page.locator('.kn-header').waitFor({ state: 'attached' });
  await page.waitForTimeout(400);
}

const y = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

async function toBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const at = await y(page);
  expect(at, 'the page must actually be scrollable for this test to mean anything').toBeGreaterThan(400);
  return at;
}

test.describe('V19 route scroll', () => {
  test('A. push navigation from the bottom of Home starts /start at the top', async ({ page }) => {
    await open(page, '/?lang=ko');
    const bottom = await toBottom(page);

    // The closing band's copy of the product's one conversion action — the control in the owner's report.
    await page.locator('.kn-cta a[data-cta="primary"]').first().click();
    await page.waitForURL(/\/start/);
    await page.waitForTimeout(500);

    expect(await y(page), `arrived at ${bottom} on Home; /start must start at the top`).toBeLessThanOrEqual(2);
  });

  test('B. Back restores the position Home was left at', async ({ page }) => {
    await open(page, '/?lang=ko');
    const bottom = await toBottom(page);

    await page.locator('.kn-cta a[data-cta="primary"]').first().click();
    await page.waitForURL(/\/start/);
    await page.waitForTimeout(400);

    await page.goBack();
    await page.waitForURL((u) => !u.pathname.includes('/start'));
    await page.waitForTimeout(700);

    // Not exact: the reveal animations settle and the document can differ by a few pixels. "Near where I
    // was" is the product requirement; "identical to the pixel" is not.
    const back = await y(page);
    expect(Math.abs(back - bottom), `left Home at ${bottom}, returned to ${back}`).toBeLessThan(250);
  });

  test('C. a hash target is honoured and not reset to the top', async ({ page }) => {
    await open(page, '/?lang=ko');
    await page.goto(`${M}/?lang=ko#faq`);
    await page.waitForTimeout(1200);
    const at = await y(page);
    expect(at, '#faq must scroll to the FAQ, not to the top').toBeGreaterThan(300);

    const box = await page.locator('#faq').boundingBox();
    expect(box, '#faq must exist').not.toBeNull();
    // The section is in view rather than far above or below it.
    expect(Math.abs(box!.y)).toBeLessThan(400);
  });

  test('D. changing ?lang= keeps the reader where they were', async ({ page }) => {
    await open(page, '/universities');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(400);
    const before = await y(page);
    expect(before).toBeGreaterThan(400);

    // The same page in another language: a query-only change, so the reader must not be thrown to the top.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/universities?lang=en');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(600);
    const after = await y(page);
    expect(Math.abs(after - before), `was at ${before}, now at ${after}`).toBeLessThan(120);
  });

  test('E. Home → Universities starts at the top', async ({ page }) => {
    await open(page, '/?lang=ko');
    await toBottom(page);
    await page.locator('.kn-header a[href*="/universities"]').first().click();
    await page.waitForURL(/\/universities/);
    await page.waitForTimeout(500);
    expect(await y(page)).toBeLessThanOrEqual(2);
  });

  test('F. a university detail opened from the directory starts at the top, and Back returns', async ({ page }) => {
    await open(page, '/universities');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(400);
    const listY = await y(page);
    expect(listY).toBeGreaterThan(600);

    // A card that is *already on screen* at this offset. Clicking `.first()` makes Playwright scroll the
    // page up to reach it, which moves the very thing this test is measuring — the first version of this
    // spec failed for exactly that reason and the product was innocent.
    const card = page.locator('a[href*="/universities/"]').filter({ hasNot: page.locator('nav') });
    const n = await card.count();
    let target = -1;
    for (let i = 0; i < n; i++) {
      const box = await card.nth(i).boundingBox();
      if (box && box.y > 80 && box.y + box.height < 860) { target = i; break; }
    }
    expect(target, 'no university card is visible at this scroll offset').toBeGreaterThanOrEqual(0);
    await card.nth(target).click();
    await page.waitForURL(/\/universities\/[^/]+/);
    await page.waitForTimeout(600);
    expect(await y(page), 'a university detail must open at its own top').toBeLessThanOrEqual(2);

    await page.goBack();
    await page.waitForTimeout(800);
    const back = await y(page);
    expect(Math.abs(back - listY), `left the directory at ${listY}, returned to ${back}`).toBeLessThan(300);
  });

  test('G. the quick check and its results stay below the floating header', async ({ page }) => {
    await open(page, '/start?lang=ko');
    const gap = await page.evaluate(() => {
      const h = document.querySelector('.kn-header')!.getBoundingClientRect();
      const t = document.querySelector('#main h1')!.getBoundingClientRect();
      return Math.round(t.top - h.bottom);
    });
    // The owner's optical target at desktop width is 48–72 px of clear space after the pill.
    expect(gap, 'the heading must never sit under the header pill').toBeGreaterThanOrEqual(28);
    expect(gap).toBeLessThanOrEqual(80);
  });
});
