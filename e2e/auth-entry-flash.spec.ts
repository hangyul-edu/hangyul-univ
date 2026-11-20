/**
 * 261119 owner requirement 2 — "Login must never render Sign-up first (and vice versa) — not even one frame."
 *
 * The defect: /login and /register rendered their form immediately and redirected an authenticated visitor from a
 * `useEffect` after the commit, and the student shell's plan gate did the same with the gated page. On a slow device
 * the wrong screen was visible for a moment before the right one. The fix (`AuthEntryGate` in `@hangyul/ui`, the
 * render-time `PlanGate` in `AppLayout`) decides before the first committed frame.
 *
 * This spec watches **every animation frame** — an init script samples the DOM in `requestAnimationFrame`, i.e. what
 * the browser is about to paint — and fails if a frame shows an auth form that does not belong to the route:
 *
 *   - `data-auth-form="login|register|forgot"` marks each screen (stable, locale-independent);
 *   - each frame records pathname, h1 text, the number of form fields, the auth form(s) present and whether a loader is up;
 *   - an SPA navigation may keep the *previous* screen on screen until the next one is ready (that is the router
 *     finishing a transition, not a flash); once the requested screen has appeared, nothing else may.
 *
 * The API is mocked with `page.route`, so it runs against any build of the student app — the isolated e2e stack
 * (`scripts/qa/e2e-run.mjs`) or a `vite preview` of a production build:
 *
 *   HG_E2E_STUDENT=http://localhost:4711 npx playwright test -c e2e/standalone.config.ts auth-entry-flash
 *
 * `HG_AUTH_FLASH_OUT=<dir>` writes every case's frame log there as evidence.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { URLS } from './helpers';

const S = URLS.student;
const OUT = process.env.HG_AUTH_FLASH_OUT;

type Frame = { t: number; path: string; search: string; forms: string; h1: string | null; fields: number; loader: boolean; page: string; n?: number };
type Mock = { authed: boolean; paid: boolean; restoreDelay: number };

const TOKEN = {
  access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900,
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'e2e-flash@example.com', full_name: 'Flash Test', preferred_name: 'Flash', locale: 'en', timezone: 'Asia/Seoul', is_demo: false },
  roles: ['STUDENT'], memberships: [], active_org: null, verified: { email: true, phone: true },
};
const SIGNUP_CONFIG = {
  captcha: { required: false, provider: null, site_key: null },
  otp: { ttl_seconds: 600, resend_cooldown_seconds: 60, max_attempts: 5, delivery_mode: 'console' },
  password: { min_length: 10 },
  consents: { items: [], purchase: { key: 'purchase', required: true, version: '1', document: null, basis: 'contract' }, policy_effective_on: null, canonical_locale: 'ko' },
};
const PLAN = { code: 'ALL_IN_ONE', name_en: 'All-in-one', entitlements: {}, usage: [], purchased_at: '2026-11-01T00:00:00Z' };

/** Every `/api/` call answered in-process. `restoreDelay` keeps the session restore pending long enough to be seen. */
async function mockApi(page: Page, m: Mock) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1/, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/refresh') {
      await new Promise((r) => setTimeout(r, m.restoreDelay));
      return m.authed ? json(TOKEN) : json({ detail: { code: 'NOT_AUTHENTICATED' } }, 401);
    }
    if (path === '/auth/login') { m.authed = true; return json(TOKEN); }
    if (path === '/auth/logout') { m.authed = false; return route.fulfill({ status: 204 }); }
    if (path === '/auth/signup/config') return json(SIGNUP_CONFIG);
    if (path.startsWith('/meta/countries')) return json([]);
    if (path === '/me/services') return json({ plan: m.paid ? PLAN : null, products: [], owned: m.paid ? ['ALL_IN_ONE'] : [], history: [], now: [] });
    if (path.startsWith('/me/matches')) return json({ items: [], profile_percent: 100, engine_version: 'e2e', routes: null });
    if (path.startsWith('/programs')) return json({ items: [], total: 0, page: 1, page_size: 12, catalog: { state: 'READY', programs_total: 10, universities_total: 3 } });
    // Anything else is "not here": screens show their own empty/error states, which is all this spec needs.
    return json({ detail: { code: 'NOT_FOUND' } }, 404);
  });
}

/** Samples the page in every animation frame and streams changes to the test (survives reloads and navigations). */
async function recordFrames(page: Page): Promise<Frame[]> {
  const frames: Frame[] = [];
  await page.exposeFunction('__hgFrame', (f: Frame) => {
    const last = frames[frames.length - 1];
    if (last && last.path === f.path && last.forms === f.forms && last.h1 === f.h1 && last.fields === f.fields && last.loader === f.loader && last.page === f.page) last.n = (last.n ?? 1) + 1;
    else frames.push(f);
  });
  await page.addInitScript(() => {
    const send = (window as unknown as { __hgFrame: (f: unknown) => void }).__hgFrame;
    const t0 = performance.timeOrigin;
    const sample = () => {
      const forms = [...document.querySelectorAll('[data-auth-form]')].map((e) => e.getAttribute('data-auth-form')).join(',');
      const h1 = document.querySelector('h1')?.textContent?.trim().slice(0, 80) ?? null;
      const fields = document.querySelectorAll('input:not([type=hidden]), select, textarea').length;
      const loader = !!document.querySelector('[aria-busy="true"]');
      const pageEl = document.querySelector('main .st-page, main [class*="sp-"]');
      send({ t: Math.round(t0 + performance.now()), path: location.pathname, search: location.search, forms, h1, fields, loader, page: pageEl?.className ?? '' });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return frames;
}

const expected = (path: string) => (path === '/login' ? 'login' : path === '/register' ? 'register' : path === '/forgot' ? 'forgot' : '');

/**
 * A frame is wrong when it shows an auth form that is not the requested route's — except the screen that was up when
 * an in-app navigation began, which may stay until its successor appears.
 */
function wrongFrames(frames: Frame[], opts: { noFormsAtAll?: boolean } = {}): Frame[] {
  const bad: Frame[] = [];
  let carry = '';           // the screen shown when the path last changed
  let arrived = false;      // has the requested screen appeared since?
  let prevPath = '';
  let lastForms = '';
  for (const f of frames) {
    if (f.path !== prevPath) { carry = lastForms; arrived = false; prevPath = f.path; }
    const want = expected(f.path);
    const shown = f.forms ? f.forms.split(',') : [];
    if (opts.noFormsAtAll && shown.length) { bad.push(f); continue; }
    if (want && shown.includes(want)) arrived = true;
    for (const s of shown) {
      if (s === want) continue;
      if (!arrived && s === carry) continue;
      bad.push(f);
      break;
    }
    lastForms = f.forms;
  }
  return bad;
}

function save(name: string, frames: Frame[], extra: Record<string, unknown> = {}) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ name, frames, wrong: wrongFrames(frames, extra.noFormsAtAll ? { noFormsAtAll: true } : {}), ...extra }, null, 2));
}

async function settle(page: Page, form: 'login' | 'register' | 'forgot', timeout = 90_000) {
  await page.locator(`[data-auth-form="${form}"]`).waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(250);
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // DevTools "Slow 3G": 400 ms RTT × 5, ~500 kbit/s.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: (500 * 1024) / 8 * 0.8, uploadThroughput: (500 * 1024) / 8 * 0.8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
}

test.describe('auth entry: the right screen from the first frame', () => {
  test.describe.configure({ timeout: 1_200_000 });

  for (const [name, path, form] of [['cold-login', '/login', 'login'], ['cold-register', '/register', 'register'], ['cold-forgot', '/forgot', 'forgot']] as const) {
    test(`${name}: a cold load of ${path} never shows another form`, async ({ page }) => {
      const m: Mock = { authed: false, paid: false, restoreDelay: 400 };
      await mockApi(page, m);
      const frames = await recordFrames(page);
      await page.goto(`${S}${path}?lang=en`);
      await settle(page, form);
      // A hard reload is a second cold load of the same document.
      await page.reload();
      await settle(page, form);
      save(name, frames);
      expect(frames.some((f) => f.loader && !f.forms), 'the session restore shows the neutral loader, not a form').toBe(true);
      expect(wrongFrames(frames), JSON.stringify(wrongFrames(frames).slice(0, 3))).toEqual([]);
    });
  }

  test('spa: login → register → login through the links, then back and forward', async ({ page }) => {
    const m: Mock = { authed: false, paid: false, restoreDelay: 200 };
    await mockApi(page, m);
    const frames = await recordFrames(page);
    await page.goto(`${S}/login?lang=en&next=%2Fmatch`);
    await settle(page, 'login');
    // `?next=` travels with the visitor between the two screens.
    const toRegister = page.locator('[data-auth-form="login"] a[href*="/register"]').first();
    expect(await toRegister.getAttribute('href')).toContain('next=%2Fmatch');
    await toRegister.click();
    await settle(page, 'register');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/match');
    const toLogin = page.locator('[data-auth-form="register"] a[href*="/login"]').first();
    expect(await toLogin.getAttribute('href')).toContain('next=%2Fmatch');
    await toLogin.click();
    await settle(page, 'login');
    await page.goBack();
    await settle(page, 'register');
    await page.goBack();
    await settle(page, 'login');
    await page.goForward();
    await settle(page, 'register');
    save('spa-back-forward', frames);
    expect(wrongFrames(frames), JSON.stringify(wrongFrames(frames).slice(0, 3))).toEqual([]);
  });

  test('mobile 390: cold loads and the link between the screens', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'ko-KR' });
    const page = await ctx.newPage();
    await mockApi(page, { authed: false, paid: false, restoreDelay: 400 });
    const frames = await recordFrames(page);
    await page.goto(`${S}/register?lang=ko`);
    await settle(page, 'register');
    await page.goto(`${S}/login?lang=ko`);
    await settle(page, 'login');
    await page.locator('[data-auth-form="login"] a[href*="/register"]').first().tap();
    await settle(page, 'register');
    save('mobile-390', frames);
    expect(wrongFrames(frames), JSON.stringify(wrongFrames(frames).slice(0, 3))).toEqual([]);
    await ctx.close();
  });

  test('slow 3G + 6× CPU: cold /login and /register', async ({ page }) => {
    await mockApi(page, { authed: false, paid: false, restoreDelay: 800 });
    const frames = await recordFrames(page);
    await throttle(page);
    try {
      // Slow 3G moves the whole bundle at ~50 kB/s: minutes, not seconds, on a loaded machine.
      await page.goto(`${S}/login?lang=en`, { timeout: 480_000 });
      await settle(page, 'login', 480_000);
      await page.goto(`${S}/register?lang=en`, { timeout: 480_000 });
      await settle(page, 'register', 480_000);
    } finally {
      save('throttled-anonymous', frames);
    }
    expect(wrongFrames(frames), JSON.stringify(wrongFrames(frames).slice(0, 3))).toEqual([]);
  });

  for (const path of ['/login', '/register', '/forgot'] as const) {
    test(`signed in: ${path}?next= goes straight on with zero form frames`, async ({ page }) => {
      await mockApi(page, { authed: true, paid: true, restoreDelay: 400 });
      const frames = await recordFrames(page);
      await page.goto(`${S}${path}?lang=en&next=%2Fsettings`);
      await page.waitForURL((u) => u.pathname === '/settings', { timeout: 30_000 });
      await page.waitForTimeout(500);
      save(`authenticated${path.replace('/', '-')}`, frames, { noFormsAtAll: true });
      expect(frames.filter((f) => f.forms), 'no frame may show any auth form').toEqual([]);
    });
  }

  test('signed in + slow 3G + 6× CPU: /login and /register go straight on', async ({ page }) => {
    await mockApi(page, { authed: true, paid: true, restoreDelay: 800 });
    const frames = await recordFrames(page);
    await throttle(page);
    await page.goto(`${S}/login?lang=en&next=%2Fsettings`, { timeout: 120_000 });
    await page.waitForURL((u) => u.pathname === '/settings', { timeout: 120_000 });
    await page.goto(`${S}/register?lang=en&next=%2Fsettings`, { timeout: 120_000 });
    await page.waitForURL((u) => u.pathname === '/settings', { timeout: 120_000 });
    await page.waitForTimeout(500);
    save('throttled-authenticated', frames, { noFormsAtAll: true });
    expect(frames.filter((f) => f.forms)).toEqual([]);
  });

  test('unsafe ?next= is refused; a self-referencing next does not loop', async ({ page }) => {
    await mockApi(page, { authed: true, paid: true, restoreDelay: 100 });
    const frames = await recordFrames(page);
    for (const next of ['//evil.example/x', 'https://evil.example/x', '/\\evil.example', '/login?next=/login', '/register']) {
      await page.goto(`${S}/login?lang=en&next=${encodeURIComponent(next)}`);
      await page.waitForURL((u) => u.origin === new URL(S).origin && u.pathname === '/', { timeout: 30_000 });
    }
    await page.waitForTimeout(300);
    save('unsafe-next', frames, { noFormsAtAll: true });
    expect(frames.filter((f) => f.forms)).toEqual([]);
  });

  test('sign-in honours ?next=: the marketing CTA path /login?next=/match lands on /match', async ({ page }) => {
    const m: Mock = { authed: false, paid: true, restoreDelay: 100 };
    await mockApi(page, m);
    const frames = await recordFrames(page);
    await page.goto(`${S}/login?lang=en&next=%2Fmatch`);
    await settle(page, 'login');
    await page.fill('#email', 'e2e-flash@example.com');
    await page.fill('#password', 'Hangyul!2026');
    await page.click('[data-auth-form="login"] button[type=submit]');
    await page.waitForURL((u) => u.pathname === '/match', { timeout: 30_000 });
    await page.waitForTimeout(400);
    save('login-next-match', frames);
    expect(wrongFrames(frames)).toEqual([]);
  });

  test('plan gate: an unpaid student opening Home or /match goes to the plan with no frame of the gated page', async ({ page }) => {
    await mockApi(page, { authed: true, paid: false, restoreDelay: 300 });
    const frames = await recordFrames(page);
    await page.goto(`${S}/?lang=en`);
    await page.waitForURL((u) => u.pathname === '/services', { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('gate')).toBe('home');
    await page.goto(`${S}/match?lang=en`);
    await page.waitForURL((u) => u.pathname === '/services', { timeout: 30_000 });
    const sp = new URL(page.url()).searchParams;
    expect(sp.get('gate')).toBe('match');
    expect(new URL(sp.get('from') ?? '', 'http://x').pathname).toBe('/match');
    await page.waitForTimeout(300);
    save('plan-gate-unpaid', frames);
    const flashes = frames.filter((f) => (f.path === '/' && /sp-home/.test(f.page)) || (f.path === '/match' && /sp-explore/.test(f.page)));
    expect(flashes, 'the gated page must never be painted for an unpaid student').toEqual([]);
  });
});
