#!/usr/bin/env node
// Deployment (2026-11) — renders apps/<app>-web/vercel.json from infra/csp.json, the same single source that
// gen-nginx.mjs renders the nginx config from. `--check` exits 1 if any committed file is stale.
//
// Each Vercel project's Root Directory is its app folder; the monorepo root is installed and the one workspace built,
// so the shared packages (design tokens, ui, i18n, types, plans…) resolve exactly as they do locally.
//
// Routing, in Vercel's order (filesystem first, then rewrites):
//   1. a real file in dist/ is served as is (hashed /assets/* are long-cached and immutable);
//   2. /api/* is proxied to the production API — the browser stays same-origin, so auth cookies remain first-party
//      and connect-src 'self' suffices, exactly as behind nginx;
//   3. every other path that is not under /assets/ or /data/ falls back to index.html (SPA deep links). A missing asset
//      or public data file is a 404, never an HTML page served as JavaScript or JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { APP_DIRS, headerFor, loadPolicy, problems, ROOT } from './csp.mjs';

/** Infrastructure hostname of the FastAPI service. Not a product domain; never shown to customers. */
/**
 * Where each Vercel app's same-origin `/api/*` is rewritten to.
 *
 * CURRENT REALITY (2026-11-18): the API is reachable only through an ngrok tunnel to a non-production host; the
 * dedicated origin `https://api.univ.talkhangyul.com` does not serve yet (TLS fails). The committed vercel.json files
 * were hand-pointed at the tunnel in 72cfca1c while this constant still named the dedicated origin, so regenerating
 * would have silently cut production off from the API. The constant now states what is deployed. When the durable
 * API host exists, change this one line back to the dedicated origin and regenerate (docs/DEPLOYMENT.md §9).
 */
export const API_ORIGIN = 'https://enclosure-cork-purifier.ngrok-free.dev';

const policy = loadPolicy();
const bad = problems(policy);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
const cspHeader = policy.report_only ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

const security = (app) => [
  { key: cspHeader, value: headerFor(policy, app) },
  { key: 'Strict-Transport-Security', value: policy.hsts },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
];

/**
 * Marketing only. The public catalogue is read live from the API through the same-origin `/api/*` rewrite below (owner
 * decision 2026-11-19: one authoritative DB catalogue); the build's DB snapshot in /data/public/ is the fallback. The
 * Quick Fit serverless function (`api/public-fit.py`, P0 2026-11-03) is retired with the anonymous `/start` journey:
 * 유학 준비 goes to the Student login, and `/start` — linked from old shares and bookmarks — redirects there too,
 * keeping the visitor's language. Redirects run before the filesystem and the rewrites.
 */
const STUDENT_ORIGIN = 'https://app.univ.talkhangyul.com';
const START_TARGET = `${STUDENT_ORIGIN}/login?next=%2Fmatch`;
const marketingExtras = {
  redirects: [
    { source: '/start', has: [{ type: 'query', key: 'lang', value: '(?<lang>[A-Za-z-]{2,8})' }], destination: `${START_TARGET}&lang=:lang`, permanent: false },
    { source: '/start', destination: START_TARGET, permanent: false },
  ],
};

/** The single deployment switch for Design Preview. `true` = owner review; `false` = public launch. */
const DESIGN_PREVIEW = true;

const configFor = (app, dir) => ({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  installCommand: 'cd ../.. && npm ci --no-audit --no-fund',
  buildCommand: `cd ../.. && npm run build -w @hangyul/${dir}`,
  outputDirectory: 'dist',
  // Design Preview (owner review; docs/SECURITY.md). ON while `DESIGN_PREVIEW` is true; set it to false and regenerate
  // before the public launch (`npm run release:preview-gate -- --launch --bundles off` then passes).
  ...(DESIGN_PREVIEW && app !== 'marketing' ? { build: { env: { VITE_ENABLE_DESIGN_PREVIEW: '1' } } } : {}),
  ...(app === 'marketing' ? { redirects: marketingExtras.redirects } : {}),
  rewrites: [
    { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
    { source: '/((?!assets/|data/).*)', destination: '/index.html' },
  ],
  headers: [
    { source: '/(.*)', headers: security(app) },
    // HTML and the build marker must never outlive a deployment; hashed assets may be cached forever.
    { source: '/((?!assets/).*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    { source: '/build-info.json', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
});

let stale = 0;
for (const [app, dir] of Object.entries(APP_DIRS)) {
  const target = resolve(ROOT, 'apps', dir, 'vercel.json');
  const out = `${JSON.stringify(configFor(app, dir), null, 2)}\n`;
  if (process.argv.includes('--check')) {
    let cur = '';
    try { cur = readFileSync(target, 'utf8'); } catch { /* missing */ }
    if (cur !== out) { console.error(`${target} is stale — run node scripts/ops/gen-vercel.mjs`); stale++; }
  } else {
    writeFileSync(target, out);
    console.log(`wrote ${target}`);
  }
}
if (stale) process.exit(1);
if (process.argv.includes('--check')) console.log('apps/*/vercel.json are up to date');
