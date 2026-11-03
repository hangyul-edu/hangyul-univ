import { expect, test } from '@playwright/test';

import { API, registerViaUi, URLS } from './helpers';

/**
 * V12 — the public Korean university directory and the legal documents (REPORT §§85–86, §90).
 *
 * These assert the rules the pass exists to hold, not the pixels: that public discovery is institution-level and
 * carries no money or deadline, that a region can be chosen by map *and* by list and survives the back button,
 * that a university with no application catalogue behind it is a state and not a 404, and that a legal page
 * never renders a placeholder.
 */

const open = async (page: import('@playwright/test').Page, path: string) => {
  await page.goto(`${URLS.marketing}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
};

test('1. the directory is institution-level: no cost, no deadline, no match, no partnership', async ({ page }) => {
  await open(page, '/universities');
  const text = await page.evaluate(() => document.body.innerText);

  // Part 10: no monetary figure on public discovery, in any notation the old page used.
  expect(text).not.toMatch(/₩|\bKRW\b|\b\d+(\.\d+)?M\b/);
  // Part 6: no application deadline and no language requirement per entry.
  expect(text).not.toMatch(/Apply by|Closes [A-Z]|TOPIK \d|IELTS \d/);
  // Part 6: no match tier, readiness or probability.
  expect(text).not.toMatch(/Strong match|match score|\d+% match|readiness/i);
  // Part 6: no partnership claim anywhere on the directory.
  expect(text).not.toMatch(/partner/i);
  // Part 1: and nothing that says this is a development build.
  expect(text).not.toMatch(/\bdemo\b|\bsample data\b|\bfixture\b|개발용|샘플 데이터/i);
});

test('2. every entry is a real institution with a checkable source', async ({ page, request }) => {
  const res = await request.get(`${API}/directory/institutions?page_size=5`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  // The brief's threshold for the homepage's "50+" claim; the registry holds hundreds.
  expect(body.total).toBeGreaterThanOrEqual(50);
  for (const i of body.items) {
    expect(i.name_ko.length).toBeGreaterThan(1);
    expect(['UNIVERSITY', 'JUNIOR_COLLEGE', 'GRADUATE_UNIVERSITY']).toContain(i.institution_type);
    expect(['NATIONAL', 'PUBLIC', 'PRIVATE']).toContain(i.establishment);
    // No price, no deadline, no requirement may ever be served by this endpoint.
    for (const forbidden of ['tuition_per_semester_krw', 'application_fee_krw', 'deadline', 'requirements', 'is_partner']) {
      expect(i).not.toHaveProperty(forbidden);
    }
  }
});

test('3. a region can be chosen from the map and from the list, and the back button undoes it', async ({ page }) => {
  await open(page, '/universities');

  /*
   * **V21 — the map and its chips are behind a disclosure.** They used to own the left column at every
   * width, which pushed the universities themselves below the fold and made an aspirational product
   * read as a data explorer (REPORT §226.2, §232.3). They are still real, still keyboard-operable and
   * still the second way in; they are now opened rather than always on screen. So the test opens them,
   * which is also the first thing a reader who wants a region does.
   */
  const mapToggle = page.locator('.mk-dir__maptoggle');
  await expect(mapToggle).toBeVisible();
  await mapToggle.click();
  await expect(page.locator('.mk-dir__picker[data-open]')).toHaveCount(1);

  // The list control — the one a phone gets, and the one that must always exist (Part 23).
  const busan = page.locator('.mk-regions__chip', { hasText: /Busan|부산/ }).first();
  await busan.click();
  await expect(page).toHaveURL(/[?&]region=busan/);
  await expect(page.locator('.mk-map__region.is-selected')).toHaveCount(1);

  // Back returns to all of Korea rather than leaving the choice stuck in the URL.
  await page.goBack();
  await expect(page).not.toHaveURL(/region=/);
  await expect(page.locator('.mk-map__region.is-selected')).toHaveCount(0);

  // The map is a radio group and is reachable and operable from the keyboard.
  const roving = page.locator('.mk-map__region[tabindex="0"]');
  await expect(roving).toHaveCount(1);
  await roving.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/[?&]region=/);
});

test('4. a university with no application catalogue is a state, not a 404', async ({ page, request }) => {
  // Kyungsung is in the national register and not in Hangyul's catalogue — the ordinary case (415 of 425).
  const directory = await request.get(`${API}/directory/institutions/kyungsung-university`);
  expect(directory.ok()).toBeTruthy();
  expect((await directory.json()).has_catalog).toBe(false);
  expect((await request.get(`${API}/universities/kyungsung-university`)).status()).toBe(404);

  await open(page, '/universities/kyungsung-university');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Kyungsung|경성/);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/₩|couldn't find|went wrong/i);
  // The official source and the date it was checked are both on the page.
  // V20 renamed the element (`.mk-uni__checked` → `.hg-uni-checked`) when the detail page moved to the
  // shared university presentation. The assertion is unchanged: the check date is still rendered.
  await expect(page.locator('.hg-uni-checked')).toBeVisible();
});

test('5. the legal pages are finished documents, not drafts', async ({ page }) => {
  for (const [path, minSections] of [['/privacy', 9], ['/terms', 12]] as const) {
    await open(page, path);

    // No hero photograph, no draft badge, no marketing band (brief Part 2).
    await expect(page.locator('.ed-hero, .kn-hero, [class*="PageHero"]')).toHaveCount(0);
    await expect(page.locator('.kn-cta')).toHaveCount(0);

    const sections = page.locator('.mk-legal__section');
    expect(await sections.count()).toBeGreaterThanOrEqual(minSections);

    const text = await page.evaluate(() => document.body.innerText);
    // Part 25: never a placeholder, in any of its forms.
    expect(text).not.toMatch(/\[[^\]]{1,24}\]|\bTBD\b|추후 입력|lorem ipsum|to be (confirmed|provided)/i);
    expect(text).not.toMatch(/\bdraft\b|초안 —|not legal advice|legal counsel/i);

    // The title and the body share one left edge — V11's header was centred independently of the content.
    const edges = await page.evaluate(() => {
      const left = (s: string) => {
        const el = document.querySelector(s);
        return el ? Math.round(el.getBoundingClientRect().left) : null;
      };
      return { title: left('.mk-legal__title'), body: left('.mk-legal__prose h2') };
    });
    expect(edges.title).toBe(edges.body);
  }
});

test('6. the privacy policy says what the code actually does', async ({ page }) => {
  await open(page, '/privacy');
  const text = await page.evaluate(() => document.body.innerText);

  // Verified in §84.2 against the schema and a repository-wide scan; each of these is a claim the page makes.
  // V23 (REPORT §268 P3): card number + expiry go through Hangyul's server to Toss Payments and are not stored.
  expect(text).toMatch(/Toss Payments/);
  expect(text).toMatch(/Hangyul does not store them/i);
  expect(text).toMatch(/does not ask for the card PIN/i);
  expect(text).toMatch(/masked/i);
  // V22: three processors are contracted for identity verification and named with their transfer items.
  expect(text).toMatch(/Twilio Programmable Messaging/);
  expect(text).toMatch(/Twilio SendGrid/);
  expect(text).toMatch(/Cloudflare Turnstile/);
  expect(text).toMatch(/Article 28-8\(1\)3|제28조의8/);
  expect(text).toMatch(/privacy@twilio\.com/);
  expect(text).toMatch(/no cookie that needs your consent/i);
  // And there is no cookie banner to go with it. Scoped twice over: the policy's own `#cookies` section is
  // supposed to be here (an earlier version of this assertion matched it), and the mobile menu is a
  // permanently-mounted `role="dialog"` that is hidden (the version after that matched that). What is actually
  // forbidden is a *visible* consent prompt.
  await expect(page.locator('[class*="consent" i]:visible, [class*="cookie-banner" i]:visible, [class*="cookiebanner" i]:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /accept (all )?cookies|쿠키 동의|consent/i })).toHaveCount(0);
});
