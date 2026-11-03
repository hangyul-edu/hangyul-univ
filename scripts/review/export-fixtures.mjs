/**
 * Capture the API responses a server-free review build needs (V17, REPORT §153).
 *
 * Runs against a **live dev stack** and records what the API actually returned for each persona, so the
 * preview shows the real product with real shapes. Hand-written mocks were rejected for one reason: they
 * drift from the server, and a review build that lies about shapes is worse than no review build.
 *
 *     npm run review:fixtures          # against localhost
 *     API=http://… npm run review:fixtures
 *
 * Output: `packages/api-client/fixtures/<app>.json`, one bundle per app, each with the session of the
 * persona a reviewer should see. The bundles are plain JSON and are imported only by code behind
 * `VITE_REVIEW_MODE`, so a production build drops them.
 *
 * **Why a list of paths rather than a crawler.** A crawler would capture whatever today's UI happened to
 * request, including the requests that only fire on a hover. This list is the contract: if a route is not
 * here the preview answers `REVIEW_MISS` and the app's existing error state renders — visible, and fixable
 * by adding a line, rather than silently producing an empty screen.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = (process.env.API ?? 'http://localhost:8001') + '/api/v1';
const OUT = join(ROOT, 'packages', 'api-client', 'fixtures');
const PW = 'Hangyul!2026';

/** Public routes every app's shell touches, whoever is looking. */
const PUBLIC = [
  '/meta/countries?priority_only=true',
  '/meta/countries',
  '/meta/locales',
  '/meta/taxonomy',
  '/directory/regions',
  '/directory/institutions?page=1&page_size=24',
  '/directory/institutions?page=1&page_size=24&region=Seoul',
  '/directory/institutions?page=1&page_size=24&region=Busan',
];

/** The ten universities a reviewer is most likely to open, plus every one the quick check can return. */
const UNI_SLUGS = [
  'seoul-national-university', 'yonsei-university', 'korea-university', 'kaist',
  'pusan-national-university', 'kyung-hee-university', 'hanyang-university',
  'sungkyunkwan-university', 'ewha-womans-university', 'kyungpook-national-university',
];

const APPS = {
  marketing: { login: null, paths: [...PUBLIC, ...UNI_SLUGS.map((s) => `/directory/institutions/${s}`)] },
  student: {
    login: { email: 'student@demo.hangyul.kr', client: 'student' },
    paths: [
      ...PUBLIC, ...UNI_SLUGS.map((s) => `/directory/institutions/${s}`),
      '/me/dashboard', '/me/profile', '/me/services', '/me/plan', '/me/orders', '/me/add-ons',
      '/applications', '/documents?page_size=100', '/essays', '/tasks', '/me/matches',
      '/me/saved', '/conversations', '/notifications', '/me/visa-route', '/me/housing', '/me/arrival',
      '/me/appointments', '/me/assignment', '/me/scholarships', '/me/offers', '/me/budget',
      '/me/profile/unlocks', '/me/payments/config',
    ],
  },
  agency: {
    login: { email: 'counselor@lotus.demo.hangyul.kr', client: 'agency' },
    paths: [
      '/meta/countries', '/meta/taxonomy',
      '/agency/today', '/agency/students?page=1&page_size=25', '/tasks', '/applications',
      '/documents/review-queue', '/conversations', '/agency/orders', '/agency/performance',
      '/agency/team', '/agency/appointments', '/notifications',
    ],
  },
  university: {
    login: { email: 'admin@pusan.univ.demo.hangyul.kr', client: 'university' },
    paths: [
      '/meta/countries', '/meta/taxonomy',
      '/university/overview', '/applications?page=1&page_size=25', '/university/programs',
      '/university/analytics', '/university/admissions-funnel', '/university/cohorts',
      '/university/partnership', '/university/team', '/conversations', '/notifications',
    ],
  },
};

const key = (method, path) => {
  const [p, q] = path.split('?');
  const params = q ? [...new URLSearchParams(q).entries()].filter(([, v]) => v !== '').sort() : [];
  const qs = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
  return `${method} /api/v1${p}${qs}`;
};

async function run() {
  mkdirSync(OUT, { recursive: true });
  let total = 0;
  let missing = 0;
  for (const [app, spec] of Object.entries(APPS)) {
    const headers = { 'Content-Type': 'application/json' };
    let session = null;
    if (spec.login) {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST', headers, body: JSON.stringify({ ...spec.login, password: PW }),
      });
      if (!r.ok) { console.error(`! ${app}: sign-in failed (${r.status})`); process.exitCode = 1; continue; }
      const tr = await r.json();
      headers.Authorization = `Bearer ${tr.access_token}`;
      // The **whole token response**, because that is what `auth.restore()` consumes: it POSTs
      // `/auth/refresh` and passes the result to `setSession`, which wants `access_token` alongside the
      // user. Storing only the session shape booted the preview to a login screen — which is exactly what
      // the first review build did.
      // **Tokens are stripped.** The capture signs in for real, but the bundle is a *shared static
      // artefact* and a seeded account's refresh token has no business travelling in one. The review
      // transport never authenticates anything — it answers from this file — so a placeholder is all
      // `setSession` needs to consider the preview signed in.
      session = { ...tr, access_token: 'review-preview', refresh_token: null };
    }
    const routes = {};
    for (const path of spec.paths) {
      const res = await fetch(`${API}${path}`, { headers });
      const body = await res.json().catch(() => null);
      routes[key('GET', path)] = { status: res.status, body };
      total += 1;
      if (!res.ok) { missing += 1; console.warn(`  · ${app} ${path} → ${res.status}`); }
    }
    writeFileSync(join(OUT, `${app}.json`), JSON.stringify({
      generated_at: new Date().toISOString(), session, routes,
    }, null, 1));
    console.log(`${app.padEnd(11)} ${Object.keys(routes).length} routes${session ? ' · signed in' : ''}`);
  }
  console.log(`\n${total} responses captured${missing ? `, ${missing} non-2xx (recorded as-is)` : ''} → packages/api-client/fixtures/`);
}

await run();
