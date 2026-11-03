/**
 * V19 — the error matrix (REPORT §207; the brief's §18, and §44 of the V17 brief before it).
 *
 * V17 named this and V18 admitted it was never run. For every high-value Student page it forces each
 * failure the network can produce and asserts the product still behaves like a product.
 *
 * **Zero acceptance** — any of these is a failure, not a note:
 *   raw JSON on screen · a raw API error string · a blank page · an endless spinner · layout collapse ·
 *   an uncaught console exception · a toast hidden behind the mobile bottom navigation
 *
 * The condition is applied to the page's *own* data calls only. Auth and session endpoints are left alone,
 * because breaking those tests the login redirect rather than the screen under test — except in the `401`
 * row, where that redirect is exactly the behaviour being checked.
 *
 *   node scripts/qa/v19/error-matrix.mjs [--width 390] [--only documents]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const ARG = process.argv.slice(2);
const val = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const WIDTH = Number(val('--width', 1440));
const ONLY = val('--only', null);
const BASE = 'http://localhost:3101';

/** The screens a student actually loses money or time on if they break. */
const PAGES = [
  ['home', '/'],
  ['explore', '/explore'],
  ['applications', '/applications'],
  ['documents', '/documents'],
  ['essays', '/essays'],
  ['messages', '/messages'],
  ['visa', '/visa'],
  ['services', '/services'],
  ['notifications', '/notifications'],
  ['profile', '/profile'],
].filter(([n]) => !ONLY || n === ONLY);

/** Endpoints that carry the session; breaking them is a different test from breaking a page's data. */
const AUTH = /\/api\/v1\/(auth|me\/session)/;

const CONDITIONS = [
  ['loading', async (r) => { await new Promise((s) => setTimeout(s, 4000)); await r.abort('timedout'); }],
  ['empty', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, results: [], data: [] }) })],
  ['partial', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[{"id":null}],"total":1}' })],
  ['offline', async (r) => r.abort('internetdisconnected')],
  ['401', async (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Not authenticated"}' })],
  ['403', async (r) => r.fulfill({ status: 403, contentType: 'application/json', body: '{"detail":"Forbidden"}' })],
  ['404', async (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' })],
  ['409', async (r) => r.fulfill({ status: 409, contentType: 'application/json', body: '{"detail":"Conflict"}' })],
  ['422', async (r) => r.fulfill({ status: 422, contentType: 'application/json', body: '{"detail":[{"loc":["body","x"],"msg":"field required","type":"value_error.missing"}]}' })],
  ['429', async (r) => r.fulfill({ status: 429, contentType: 'application/json', body: '{"detail":"Too many requests"}' })],
  ['500', async (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal Server Error"}' })],
  // Held open past the client's own 20 s deadline, so what is measured is the product's timeout
  // handling rather than a spinner that is legitimately still waiting.
  ['timeout', async (r) => { await new Promise((s) => setTimeout(s, 30000)); await r.abort('timedout'); }],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: WIDTH < 700 ? 844 : 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.setItem('hg.locale', 'ko'); } catch { /* ignore */ } });
await page.fill('#email', 'student@demo.hangyul.kr');
await page.fill('#password', 'Hangyul!2026');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await page.waitForTimeout(800);

const rows = [];
mkdirSync('docs/qa/v19/screenshots/student/errors', { recursive: true });

for (const [pname, path] of PAGES) {
  for (const [cname, handler] of CONDITIONS) {
    const uncaught = [];
    const onErr = (e) => uncaught.push(String(e).slice(0, 160));
    page.on('pageerror', onErr);

    // Fresh caches each time, or react-query serves the previous (healthy) result and the row is a lie.
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.evaluate(() => { try { sessionStorage.clear(); } catch { /* ignore */ } });

    const route = async (r) => {
      const u = r.request().url();
      try {
        if (AUTH.test(u) && cname !== '401') return await r.fallback();
        return await handler(r);
      } catch {
        // The `loading` and `timeout` rows deliberately hold a request open for seconds; by the time they
        // resolve, the page may have navigated and Playwright has already disposed the route. That is the
        // condition working, not an error in the harness.
      }
    };
    await page.route('**/api/v1/**', route);

    let probe = {};
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'commit', timeout: 20000 });
      /*
       * Wait for the app to have *said something* — text, a skeleton, or a handled state — before starting
       * the settle clock, and only then wait the fixed period for retries and backoff to finish.
       *
       * A flat timeout makes this harness fail under load rather than on defects: running it beside the
       * rest of `test:release` once produced a single "profile/partial: LAYOUT-COLLAPSE | BLANK", which
       * two clean re-runs showed was the page simply not having rendered yet inside a 5 s budget on a
       * contended machine. An error matrix that reports a defect when the CPU is busy is not measuring the
       * product.
       */
      await page.waitForFunction(() => {
        const m = document.querySelector('#main') || document.body;
        return (m.innerText || '').trim().length > 0
          || document.querySelector('.hg-spinner, [class*="skeleton"], .hg-state') !== null;
      }, undefined, { timeout: 15000 }).catch(() => { /* a page that never says anything is the finding */ });
      // Long enough for a retry/backoff to settle, short enough that "endless spinner" means endless.
      await page.waitForTimeout(cname === 'timeout' ? 26000 : cname === 'loading' ? 9000 : 5000);
      probe = await page.evaluate(() => {
        const main = document.querySelector('#main') || document.body;
        const text = (main.innerText || '').trim();
        const spinners = document.querySelectorAll('.hg-spinner, [class*="skeleton"], [aria-busy="true"]').length;
        // Raw JSON or a raw server payload that reached the screen.
        const rawJson = /\{\s*"(detail|items|total|loc|msg|type)"\s*:/.test(text)
          || /^\s*[[{][\s\S]*[\]}]\s*$/.test(text)
          || /value_error\.|Traceback|Internal Server Error|Not authenticated\b/.test(text);
        const toasts = [...document.querySelectorAll('[class*="toast"], [role="status"], [role="alert"]')]
          .filter((e) => e.getBoundingClientRect().height > 0);
        // Only a bar that is actually on screen can hide anything. A `display: none` tab bar — which is
        // every desktop width — reports a zero rect at the top of the viewport, so measuring against it marked a
        // correctly-placed toast as hidden on every desktop row.
        const bars = [...document.querySelectorAll('.hg-stabs, [class*="tabbar"]')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 8 && r.bottom > 0 && r.top < window.innerHeight; });
        const barTop = bars.length ? Math.min(...bars.map((e) => e.getBoundingClientRect().top)) : null;
        const toastHidden = barTop != null && toasts.some((e) => {
          const r = e.getBoundingClientRect();
          return r.height > 0 && r.bottom > barTop + 2 && r.top < window.innerHeight;
        });
        return {
          chars: text.length,
          spinners,
          rawJson,
          toastHidden,
          // Layout collapse means *nothing usable is on screen*. The route error boundary deliberately
          // replaces the shell with a full-page "couldn't load this screen" and a Reload button; that is a
          // handled failure, not a collapse, so a page carrying a recognisable recovery action does not
          // count even though `.hg-sshell` is gone.
          handledBoundary: !!document.querySelector('.hg-state__title') && /button|a/i.test(
            document.querySelector('.hg-state')?.innerHTML ?? ''),
          collapsed: document.documentElement.scrollHeight < 120 || !document.querySelector('.hg-sshell'),
          redirectedToLogin: location.pathname.startsWith('/login'),
          sample: text.slice(0, 90).replace(/\s+/g, ' '),
        };
      });
    } catch (e) { probe = { loadError: String(e).slice(0, 90) }; }

    await page.unroute('**/api/v1/**', route);
    page.off('pageerror', onErr);

    const fails = [];
    if (probe.loadError) fails.push(`LOAD ${probe.loadError}`);
    if (probe.rawJson) fails.push('RAW-JSON/API-ERROR');
    if (probe.collapsed && !probe.redirectedToLogin && !probe.handledBoundary) fails.push('LAYOUT-COLLAPSE');
    // "Blank" means *nothing for the reader*: no words, no skeleton, no handled state. A loading screen
    // with six skeletons has no text and is not blank, and a Korean 404 ("페이지를 찾을 수 없습니다.") is
    // fifteen characters and is not blank either — a flat character count called both of those defects.
    if ((probe.chars ?? 0) < 25 && !probe.redirectedToLogin && !probe.handledBoundary && !(probe.spinners > 0)) {
      fails.push('BLANK');
    }
    if (probe.spinners > 0 && (cname !== 'loading')) fails.push(`ENDLESS-SPINNER x${probe.spinners}`);
    if (probe.toastHidden) fails.push('TOAST-BEHIND-NAV');
    if (uncaught.length) fails.push(`UNCAUGHT ${uncaught[0]}`);
    const notes = [];
    if (probe.handledBoundary && probe.collapsed) notes.push('full-page error boundary (shell replaced)');
    // 401 must land the reader on the sign-in page, not on a broken screen.
    if (cname === '401' && !probe.redirectedToLogin) fails.push('401-NO-REDIRECT');

    if (fails.length) {
      await page.screenshot({ path: `docs/qa/v19/screenshots/student/errors/${pname}-${cname}@${WIDTH}.png` }).catch(() => {});
    }
    rows.push({ page: pname, condition: cname, width: WIDTH, ...probe, uncaught: uncaught.slice(0, 1), fails, notes });
  }
}
await browser.close();

writeFileSync(`docs/qa/v19/evidence/error-matrix-${WIDTH}.json`, JSON.stringify(rows, null, 2));

const byPage = new Map();
for (const r of rows) {
  if (!byPage.has(r.page)) byPage.set(r.page, []);
  byPage.get(r.page).push(r);
}
console.log(`\nError matrix @ ${WIDTH}px — ${PAGES.length} pages × ${CONDITIONS.length} conditions\n`);
const head = CONDITIONS.map(([c]) => c.slice(0, 4).padStart(5)).join('');
console.log('page        '.padEnd(12) + head);
let total = 0;
for (const [p, rs] of byPage) {
  console.log(p.padEnd(12) + rs.map((r) => (r.fails.length ? '   ✗ ' : '   · ')).join(''));
  total += rs.filter((r) => r.fails.length).length;
}
console.log('\nFailures:');
for (const r of rows.filter((x) => x.fails.length)) {
  console.log(`  ✗ ${r.page}/${r.condition}: ${r.fails.join(' | ')}   «${r.sample ?? ''}»`);
}
console.log(`\n${rows.length} cells, ${total} failing.`);
process.exit(total ? 1 : 0);
