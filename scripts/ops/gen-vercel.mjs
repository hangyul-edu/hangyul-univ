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
export const API_ORIGIN = 'https://api.univ.talkhangyul.com';

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
 * Marketing only (P0, 2026-11-03): anonymous Quick Fit and the visitor-specific scholarship summary run the fit engine
 * (server/app/services/fit.py, unchanged) in a Python function over the exported public snapshot — no FastAPI, no DB.
 * The rewrites keep the API's own paths, so the page calls the same URLs in development (Vite proxy → FastAPI).
 */
const MARKETING_FUNCTION = 'api/public-fit.py';
const marketingExtras = {
  rewrites: [
    { source: '/api/v1/public/fit', destination: '/api/public-fit' },
    { source: '/api/v1/directory/institutions/:slug/admissions', destination: '/api/public-fit?admissions=:slug' },
  ],
  functions: {
    [MARKETING_FUNCTION]: {
      includeFiles: '{api/_fit/**,public/data/public/fit-snapshot.json,public/data/public/admissions/**}',
      excludeFiles: '{dist/**,dist-*/**,public/media/**,public/flags/**,public/og/**,node_modules/**,src/**,.vercel/**,*.png,*.ico}',
      maxDuration: 10,
    },
  },
};

const configFor = (app, dir) => ({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'vite',
  installCommand: 'cd ../.. && npm ci --no-audit --no-fund',
  buildCommand: `cd ../.. && npm run build -w @hangyul/${dir}${app === 'marketing' ? ' && node scripts/public-data/stage-fit.mjs' : ''}`,
  outputDirectory: 'dist',
  ...(app === 'marketing' ? { functions: marketingExtras.functions } : {}),
  rewrites: [
    ...(app === 'marketing' ? marketingExtras.rewrites : []),
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
