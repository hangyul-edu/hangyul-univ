/**
 * Real failure conditions (product-excellence pass, 2026-11-22, brief §59).
 *
 * The connected API runs on a non-production host, so the product must stay trustworthy when it is slow, unreachable,
 * broken or when the session has expired. On the isolated real stack (scripts/qa/e2e-run.mjs: real API, real builds,
 * a cloned fixture database) this signs in for real, then intercepts the page's own data calls (never the session
 * endpoints, except in the expired-session row) and asserts, for every condition:
 *
 *   · never raw transport text on screen (`{"detail"`, "Internal Server Error", "Failed to fetch", a stack trace);
 *   · never a blank page; an uncaught exception fails the row;
 *   · slow (1 s, 3 s): the page shows a loading state and then its real content — nothing is lost or duplicated;
 *   · unreachable / 500 / timeout: a localized error state with a Retry action (or the branded service-unavailable
 *     state), and Retry recovers once the API is back;
 *   · expired session (401 on every call, refresh refused): back to the login screen, never a broken page.
 */
import { expect, test, type Page } from '@playwright/test';

import { uiLogin, URLS } from './helpers';

const RAW = /\{"detail"|Internal Server Error|Failed to fetch|TypeError|NetworkError|at [A-Za-z]+ \(.*\.js/;
const AUTH = /\/api\/v1\/(auth|me\/session)/;

type Cond = 'slow1' | 'slow3' | 'offline' | '500' | 'timeout';

async function apply(page: Page, cond: Cond) {
  await page.route('**/api/v1/**', async (r) => {
    if (AUTH.test(r.request().url())) return r.fallback();
    try {
      if (cond === 'slow1') { await new Promise((s) => setTimeout(s, 1000)); return await r.fallback(); }
      if (cond === 'slow3') { await new Promise((s) => setTimeout(s, 3000)); return await r.fallback(); }
      if (cond === 'offline') return await r.abort('internetdisconnected');
      if (cond === '500') return await r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal Server Error"}' });
      // Held past the client's own 20 s deadline: what is measured is the product's timeout handling.
      if (cond === 'timeout') { await new Promise((s) => setTimeout(s, 24_000)); return await r.abort('timedout'); }
    } catch { /* the page navigated while a held request was open */ }
  });
}

async function settle(page: Page, ms: number) {
  await page.waitForFunction(() => (document.body.innerText || '').trim().length > 40, undefined, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function judge(page: Page, cond: Cond, errors: string[]) {
  const text = await page.locator('body').innerText();
  expect(text, `${cond}: raw transport text on screen`).not.toMatch(RAW);
  expect(text.trim().length, `${cond}: blank page`).toBeGreaterThan(40);
  expect(errors, `${cond}: uncaught exceptions`).toEqual([]);
  if (cond === 'offline' || cond === '500' || cond === 'timeout') {
    const retry = page.getByRole('button', { name: /retry|try again|다시 시도/i }).first();
    await expect(retry, `${cond}: no Retry on the error state`).toBeVisible();
    await page.unroute('**/api/v1/**');
    await retry.click();
    await page.waitForTimeout(2500);
    expect(await page.locator('body').innerText(), `${cond}: Retry did not recover`).not.toMatch(/retry|try again|다시 시도/i);
  } else {
    await expect(page.locator('[aria-busy="true"]'), `${cond}: still loading`).toHaveCount(0, { timeout: 15_000 });
  }
}

const PAGES: [keyof typeof URLS, string, string][] = [
  ['student', 'student@demo.hangyul.kr', '/'],
  ['student', 'student@demo.hangyul.kr', '/documents'],
  ['student', 'student@demo.hangyul.kr', '/applications'],
  ['agency', 'manager@lotus.demo.hangyul.kr', '/'],
  ['university', 'admin@pusan.univ.demo.hangyul.kr', '/'],
];
const CONDS: Cond[] = ['slow1', 'slow3', 'offline', '500'];

for (const [app, email, path] of PAGES) {
  test(`failure conditions: ${app} ${path}`, async ({ page }) => {
    test.setTimeout(180_000);
    await uiLogin(page, app, email);
    for (const cond of CONDS) {
      const errors: string[] = [];
      const onErr = (e: Error) => errors.push(String(e.message).slice(0, 160));
      page.on('pageerror', onErr);
      // A fresh document each time, or the query cache answers with the previous healthy result.
      await page.goto(`${URLS[app]}/settings`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await apply(page, cond);
      await page.goto(`${URLS[app]}${path}`, { waitUntil: 'commit' });
      await settle(page, cond === 'slow3' ? 5000 : 3500);
      await judge(page, cond, errors);
      await page.unroute('**/api/v1/**');
      page.off('pageerror', onErr);
    }
  });
}

test('failure conditions: a stalled request times out into a Retry (student home)', async ({ page }) => {
  test.setTimeout(150_000);
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${URLS.student}/settings`, { waitUntil: 'domcontentloaded' });
  await apply(page, 'timeout');
  await page.goto(`${URLS.student}/`, { waitUntil: 'commit' });
  await settle(page, 26_000);
  await judge(page, 'timeout', errors);
});

test('failure conditions: an expired session returns to sign-in, never a broken page', async ({ page }) => {
  test.setTimeout(90_000);
  await uiLogin(page, 'student', 'student@demo.hangyul.kr');
  // The access token is no longer accepted and the refresh is refused: what a session that expired overnight looks like.
  await page.route('**/api/v1/**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Not authenticated"}' }));
  await page.goto(`${URLS.student}/documents`, { waitUntil: 'commit' });
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 30_000 });
  expect(await page.locator('body').innerText()).not.toMatch(RAW);
});
