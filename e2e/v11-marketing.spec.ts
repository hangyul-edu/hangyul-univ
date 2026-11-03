/**
 * V11 marketing regressions — the ten assertions the brief names (Part 30), each one guarding a defect this
 * pass fixed rather than a feature it added.
 *
 * The header one matters most: V10's morph only appeared *after* scrolling, so every first-viewport check
 * passed while the defect shipped. These scroll the page and measure the real geometry.
 */
import { expect, test } from '@playwright/test';

import { API, URLS } from './helpers';

/** The marketing app is client-rendered, so every test waits for the chrome before it measures anything. */
async function openHome(page: import('@playwright/test').Page, path = '') {
  await page.goto(`${URLS.marketing}${path}`);
  await page.locator('.kn-header').waitFor({ state: 'attached' });
}

/** The pill's measured geometry at the current scroll position. */
async function headerBox(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.kn-header')!;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      left: Math.round(r.left), right: Math.round(innerWidth - r.right), top: Math.round(r.top),
      width: Math.round(r.width), height: Math.round(r.height),
      radius: parseFloat(cs.borderTopLeftRadius), position: cs.position, viewport: innerWidth,
    };
  });
}

test('1–2. the header never becomes a full-width bar: insets and pill radius survive scrolling', async ({ page }) => {
  await openHome(page);
  const top = await headerBox(page);
  expect(top.position).toBe('fixed');
  expect(top.left).toBeGreaterThan(8);
  expect(top.right).toBeGreaterThan(8);
  expect(top.width).toBeLessThan(top.viewport);
  expect(top.radius).toBeGreaterThanOrEqual(top.height / 2 - 1);

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const fraction of [0.25, 0.5, 0.75]) {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), fraction);
    await page.waitForTimeout(350);
    const box = await headerBox(page);
    expect(box.position, `position at ${fraction * 100}%`).toBe('fixed');
    expect(box.left, `left inset at ${fraction * 100}%`).toBe(top.left);
    expect(box.right, `right inset at ${fraction * 100}%`).toBe(top.right);
    expect(box.width, `width at ${fraction * 100}%`).toBe(top.width);
    expect(box.radius, `radius at ${fraction * 100}%`).toBe(top.radius);
    expect(box.width).toBeLessThan(box.viewport);
  }
  expect(height).toBeGreaterThan(0);
});

test('3–4. the universities section is three rows of real crest IMAGES, not text chips', async ({ page }) => {
  await openHome(page);
  const band = page.locator('.kn-crests');
  await band.scrollIntoViewIfNeeded();

  // Exactly three moving rows, as in the Koreanasha original.
  await expect(band.locator('.kn-marquee')).toHaveCount(3);

  // Every row carries images, and no row is empty.
  for (let row = 0; row < 3; row++) {
    const images = band.locator('.kn-marquee').nth(row).locator('img.kn-crest__img');
    expect(await images.count()).toBeGreaterThan(0);
  }

  // The V10 substitute was a text chip per university; none may remain in this section.
  await expect(band.locator('.kn-chip')).toHaveCount(0);

  // Every crest actually decoded — a broken SVG renders at zero width and would be invisible on the page.
  const broken = await band.locator('img.kn-crest__img').evaluateAll(
    (nodes) => nodes.filter((n) => !(n as HTMLImageElement).complete || (n as HTMLImageElement).naturalWidth === 0).length,
  );
  expect(broken, 'crests that failed to load').toBe(0);

  // Crests are contained, never stretched.
  const fits = await band.locator('img.kn-crest__img').first().evaluate((n) => getComputedStyle(n).objectFit);
  expect(fits).toBe('contain');
});

test('3b. reduced motion turns the three rows into a static grid showing each crest once', async ({ browser }) => {
  // A real defect lived here that every other gate passed: the duplicated half-track carried an inline
  // `display: contents`, which outranked the rule that hides duplicates, so the static fallback repeated every
  // logo four times. Nothing but a reduced-motion render would have caught it.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(URLS.marketing);
  await page.locator('.kn-crests').waitFor();
  await page.locator('.kn-crests').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const rows = page.locator('.kn-crests .kn-marquee');
  await expect(rows).toHaveCount(3);

  const state = await page.evaluate(() => {
    const tracks = [...document.querySelectorAll('.kn-crests .kn-marquee__track')];
    return tracks.map((t) => {
      const visible = [...t.querySelectorAll('img.kn-crest__img')]
        .filter((i) => i.getClientRects().length > 0)
        .map((i) => (i as HTMLImageElement).getAttribute('src'));
      return { animation: getComputedStyle(t).animationName, visible, unique: new Set(visible).size };
    });
  });
  for (const row of state) {
    expect(row.animation, 'the track must not animate under reduced motion').toBe('none');
    expect(row.visible.length, 'every visible crest appears exactly once').toBe(row.unique);
    expect(row.unique).toBeGreaterThan(4);
  }
  await ctx.close();
});

test('5. no public B2B surface at all — not in the navigation and not in the footer', async ({ page }) => {
  await openHome(page);
  const nav = page.locator('.kn-nav a');
  await expect(nav).toHaveText(['Universities', 'Services', 'FAQ']);
  await expect(page.locator('.kn-nav a', { hasText: /agenc|partner|universit(y|ies) console/i })).toHaveCount(0);
  // V12 (brief Part 11): V11 kept one discreet "Partner sign-in" line under the copyright with links to both
  // consoles. It is gone, and it is not replaced by "Partner portal", "B2B login" or "For institutions" — the
  // consoles are separate products on separate URLs and a prospective student has no use for knowing they exist.
  await expect(page.locator('.kn-footer__partner')).toHaveCount(0);
  await expect(page.locator('.kn-footer a', { hasText: /console|partner|portal|b2b|institution/i })).toHaveCount(0);
});

test('6–7. no public application form; the conversion action opens the public quick check', async ({ page }) => {
  await openHome(page);
  // Nothing on the public home collects an application. (Unchanged since V11 — this is the claim the test
  // was written for and it still holds.)
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /apply now/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /apply|신청/i })).toHaveCount(0);

  // V13 changed where the action goes, on purpose. V11/V12 sent a stranger to `/login`, so the product's one
  // conversion action opened a password field — the mechanism, not the goal. It opens the public
  // three-question check, which needs no account (REPORT §104.2).
  //
  // V17 moved that check from the student app to **this site** (REPORT §155.4). The rule is unchanged and is
  // the reason for the move: the free product belongs where a visitor with no account already is, so the
  // conversion action no longer crosses an origin to reach it.
  const account = page.locator('.kn-header__right a.kn-btn').first();
  await expect(account).toHaveAttribute('href', /^\/start(\?|$)/);

  // The journey continues, and it continues without a sign-in wall.
  await account.click();
  await page.waitForURL(/\/start/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});

test('8. every removed marketing route redirects instead of 404ing', async ({ page }) => {
  const cases: [string, RegExp][] = [
    ['/how-it-works', /\/#services$/],
    ['/students', /\/#services$/],
    // V14: `/credits` is retired (brief Part 3), so `/trust` — which V11 pointed at it — lands on the home
    // page like the other removed routes. No redirect may target a retired route.
    ['/trust', /localhost:\d+\/$/],
    ['/credits', /localhost:\d+\/$/],
    ['/guides', /\/#faq$/],
    ['/guides/cost-of-studying-in-korea', /\/#faq$/],
    ['/guides/country/VN', /\/#faq$/],
    ['/agencies', /localhost:\d+\/$/],
    ['/universities-partners', /localhost:\d+\/$/],
  ];
  for (const [from, to] of cases) {
    await openHome(page, from);
    await page.waitForTimeout(250);
    expect(page.url(), `${from} should redirect`).toMatch(to);
    // A redirect must land on real content, never on the not-found page.
    await expect(page.getByText(/page not found/i)).toHaveCount(0);
  }
});

test('9. the Korean home ships the Koreanasha copy verbatim', async ({ page }) => {
  await openHome(page, '/?lang=ko');
  await page.waitForTimeout(600);
  // Hero and FAQ, exactly as the owner's template words them (docs/qa/v11/koreanasha-copy.json).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('한국 유학 쉽습니다!');
  await expect(page.locator('#faq-title')).toHaveText('자주 묻는 질문');
  await expect(page.locator('.kn-faq__q').first()).toContainText('입학에 필요한 서류가 무엇인가요?');
  // The old brand must be gone, and no Koreanasha staff member may be named as ours.
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/Koreanasha|코리아나샤|김예찬/);
  // The catalogue figure is our own, not the template's "50+".
  await expect(page.locator('#unis-title')).not.toContainText('50+');
});

test('10. the public endpoint still refuses to predict admission', async ({ request }) => {
  const r = await request.post(`${API}/public/quick-eligibility`, { data: { nationality: 'NP', degree: 'LANGUAGE', language: { kind: 'PREPARING' } } });
  expect(r.status()).toBe(200);
  const d = await r.json();
  expect(JSON.stringify(d)).not.toMatch(/probability|chance/i);
  expect(d.data_quality.status).toBe('SAMPLE');
});
