/**
 * V13 — conversion-hierarchy and composition regressions (brief Parts 32, 33).
 *
 * These guard the two defects V13 opened with, and they deliberately test *semantics and relationships*
 * rather than pixels: a screenshot comparison would fail on every photograph retouch and pass on a hero whose
 * buttons are back under its description, which is exactly backwards.
 *
 *   1. the primary conversion action is "내 유학 준비", and it carries the primary style
 *   2. the directory is secondary, and does not
 *   3. the header and the hero agree about which action is primary
 *   4. headline / copy / action remain three separate composition groups, in the right order
 *   5. on a phone the primary action dominates and the two are not equally weighted
 *   6. the public count reads 200+, and never exposes the exact figure
 */
import { expect, test, type Page } from '@playwright/test';

import { URLS } from './helpers';

/** Korean is one of the two owner-canonical locales and the one the brief's copy is written in. */
async function openHome(page: Page, width?: number) {
  if (width) await page.setViewportSize({ width, height: 844 });
  await page.goto(`${URLS.marketing}/?lang=ko`);
  await page.locator('.kn-hero__actions .kn-btn').first().waitFor();
}

const TANGERINE = 'rgb(204, 78, 0)';

async function ctas(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('.kn-hero__actions .kn-btn')].map((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      text: (e as HTMLElement).innerText.trim(),
      href: e.getAttribute('href'),
      primary: e.classList.contains('kn-btn--primary'),
      bg: cs.backgroundColor,
      width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top),
    };
  }));
}

test('1–2. the hero advertises preparation as primary and the directory as secondary', async ({ page }) => {
  await openHome(page);
  const [first, second] = await ctas(page);

  // The conversion action comes first in the reading order and is the only filled tangerine control.
  expect(first.text).toBe('내 유학 준비');
  expect(first.primary).toBe(true);
  expect(first.bg).toBe(TANGERINE);

  expect(second.text).toBe('대학 둘러보기');
  expect(second.primary).toBe(false);
  expect(second.bg).not.toBe(TANGERINE);

  // The conversion action must open the public quick check, not a password field. A button that says
  // "내 유학 준비" and lands on /login has not started a preparation — it is the old "로그인" defect moved one
  // layer down, where a label change cannot reveal it (REPORT §104.2).
  const href = await page.locator('.kn-hero__actions .kn-btn').first().getAttribute('href');
  expect(href).toContain('/start');
  expect(href).not.toContain('/login');

  // Exactly one primary per decision area (brief Part 23).
  expect((await ctas(page)).filter((c) => c.primary)).toHaveLength(1);
});

test('3. the header and the hero sell the same primary action', async ({ page }) => {
  await openHome(page);
  const header = await page.evaluate(() => {
    const e = document.querySelector('.kn-header__right .kn-btn') as HTMLElement;
    return {
      text: e.innerText.trim(), bg: getComputedStyle(e).backgroundColor,
      primary: e.classList.contains('kn-btn--primary'), href: e.getAttribute('href'),
      cta: e.getAttribute('data-cta'), label: e.getAttribute('aria-label'),
    };
  });
  const [heroPrimary] = (await ctas(page)).filter((c) => c.primary);

  expect(header.primary).toBe(true);
  expect(header.bg).toBe(TANGERINE);
  expect(header.cta).toBe('primary');

  // One product, one conversion hierarchy: whatever the header sells in tangerine, the hero sells in
  // tangerine, and **both go to the same place**. The destination is the assertion, not the wording — V13's
  // own lesson was that a button relabelled 내 유학 준비 while still pointing at /login moves the defect one
  // layer down where a label check cannot see it.
  expect(header.href).toContain('/start');
  expect(heroPrimary.href).toContain('/start');

  // V14: the two labels are deliberately NOT identical. 내 유학 준비 is 7 characters and "Começar a minha
  // preparação" is 26, which broke the header pill at 390px; the header carries a short form and the hero
  // keeps the full phrase. What must hold is that the header's label is the shorter of the two and that its
  // accessible name is still the full one, so nothing is lost to a screen reader.
  expect(header.text.length).toBeLessThanOrEqual(heroPrimary.text.length);
  expect(header.label).toBe(heroPrimary.text);
});

test('4. headline, copy and action stay three composition groups, increasingly separated', async ({ page }) => {
  await openHome(page);
  const g = await page.evaluate(() => {
    const px = (s: string, p: 'marginBottom') => parseFloat(getComputedStyle(document.querySelector(s)!)[p]);
    const gap = (a: string, b: string) => {
      const x = document.querySelector(a)!.getBoundingClientRect(), y = document.querySelector(b)!.getBoundingClientRect();
      return Math.round(y.top - x.bottom);
    };
    return {
      headingToCopy: px('.kn-hero__lede', 'marginBottom') && gap('.kn-hero__title', '.kn-hero__lede'),
      copyToAction: gap('.kn-hero__lede', '.kn-hero__actions'),
      actionGap: parseFloat(getComputedStyle(document.querySelector('.kn-hero__actions')!).gap),
    };
  });

  // The state this replaces was headline→copy 15px and copy→action **0px** — the buttons touched the text.
  // The ranges are the V14 brief's: 24–30 for the small break, 34–40 for the large one, 14–18 between the
  // buttons. They were 28–36 for the large break in the first V14 pass, which shipped 30/36 — inside the old
  // range and still wrong, because a 20 % difference between two gaps separated by a line of text does not
  // read as a difference at all.
  expect(g.headingToCopy).toBeGreaterThanOrEqual(24);
  expect(g.headingToCopy).toBeLessThanOrEqual(30);
  expect(g.copyToAction).toBeGreaterThanOrEqual(34);
  expect(g.copyToAction).toBeLessThanOrEqual(40);
  expect(g.actionGap).toBeGreaterThanOrEqual(14);
  expect(g.actionGap).toBeLessThanOrEqual(18);

  // The relationship, not the numbers: the break before the action must be *visibly* the larger of the two,
  // or the three parts read as one block however generous each gap is on its own. 1.25x is the same floor
  // `scripts/qa/v14-surface.mjs` holds, so the gate and the test cannot disagree about what "separated"
  // means. `toBeGreaterThan` was what let 30/36 through.
  expect(g.copyToAction).toBeGreaterThanOrEqual(g.headingToCopy * 1.25);
});

test('5. on a phone the primary action dominates and the two are not equally weighted', async ({ page }) => {
  await openHome(page, 390);
  const [primary, secondary] = await ctas(page);

  expect(primary.text).toBe('내 유학 준비');
  // Full-measure: the hero content is 390 minus the container gutter.
  expect(primary.width).toBeGreaterThan(300);
  // Two equally weighted full-width buttons is two primaries — the thing the brief rules out by name.
  expect(secondary.width).toBeLessThan(primary.width * 0.75);
  expect(secondary.top).toBeGreaterThan(primary.top);
});

test('6. the public count is a marketing scale, not a database figure', async ({ page }) => {
  // The rule — unchanged since V13 — is that the figure is written in the **script of its own sentence**.
  //
  // What that means per market changed in V14. V13's defect was a Bengali numeral inside an English
  // fallback sentence ("২০০+ Korean universities"), because `bn` had no translated homepage. `bn` now has
  // one, so Bengali digits in a Bengali sentence are correct, and asserting the literal "200+" everywhere
  // would now assert the *old* defect's mirror image. The expectation is therefore computed from the locale.
  for (const lang of ['ko', 'en', 'bn', 'ar']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${URLS.marketing}/?lang=${lang}`);
    await page.locator('#unis-title').waitFor();
    const heading = await page.locator('#unis-title').innerText();
    const text = await page.locator('body').innerText();

    const expected = await page.evaluate((l) => new Intl.NumberFormat(l).format(200), lang);
    expect(heading, `${lang}: the scaled figure in this locale's own digits`).toContain(expected);

    // The register's exact totals are internal. Any of them appearing as the headline claim is the defect.
    expect(text).not.toMatch(/218\s*곳/);
    expect(text).not.toMatch(/\b218\b/);
    expect(text).not.toMatch(/\b425\b/);
  }
});
