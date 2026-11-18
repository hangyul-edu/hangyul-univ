# Deployment

How Hangyul Univ is deployed today, how to verify it, and what a production launch still needs.
Detail: [`deployment/VERCEL_DEPLOYMENT.md`](deployment/VERCEL_DEPLOYMENT.md) (project ids, build settings, routing,
headers, public-data pipeline) and [`deployment/VERCEL_ENV_MATRIX.md`](deployment/VERCEL_ENV_MATRIX.md) (every
environment variable per app and for the API). Where those two files say the API is "not deployed" or "deferred",
this file is the current statement.

## 1. Current state (verified 2026-11-18)

| Surface | Domain | Source | Hosting | State |
|---|---|---|---|---|
| Marketing | `https://univ.talkhangyul.com` | `apps/marketing-web` | Vercel project `hangyul-univ` | Live. Discovery reads static public data; Quick Fit runs a Vercel Python function |
| Student | `https://app.univ.talkhangyul.com` | `apps/student-web` | Vercel project `hangyul-univ-student` | Live, API reachable |
| Operations/Admin (Hangyul internal) | `https://admin.univ.talkhangyul.com` | `apps/agency-web` | Vercel project `hangyul-univ-agency` | Live, API reachable |
| University console | `https://partner.univ.talkhangyul.com` | `apps/university-web` | Vercel project `hangyul-univ-university` | Live, API reachable |
| API (FastAPI, `/api/v1`, health `/healthz`) | same-origin `/api/*` on each domain | `server/` | **The owner's machine, behind an ngrok tunnel** | Connected, **not a production host** |
| Native apps | — | `apps/student-mobile`, `apps/agency-mobile` (Operations/Admin), `apps/university-mobile` | not in stores | Android must be rebuilt from current source; iOS not built |

All four web domains serve commit `fd2f4ba7` (`/build-info.json`).

**The truthful one-line status:** the API is connected through a tunnel to a non-production host; a durable production
API host and a seeded programme catalogue are open launch blockers. It is neither "API deferred/unavailable" nor
"production API fully live".

Verified responses through `https://app.univ.talkhangyul.com`:

| Request | Result |
|---|---|
| `GET /api/v1/auth/me` | 401 `{"detail":"Not authenticated"}` (API reached, auth enforced) |
| `GET /api/v1/public/plans` | 200 with plan data |
| `GET /api/v1/universities`, `GET /api/v1/programs` | 200, `total: 0` — the connected database's programme catalogue is **empty (unseeded)** |
| `https://api.univ.talkhangyul.com` | resolves to Vercel IPs, TLS fails — **no dedicated production API host exists** |

The `agency-*` names (`apps/agency-web`, `@hangyul/agency-web`, Vercel project `hangyul-univ-agency`, `/agency/...`
API prefix) are historical internal names for Hangyul's own Operations/Admin product. They are not being renamed.

## 2. Vercel projects

One GitHub repository, four Vercel projects, production branch `main` (every push builds all four; other branches get
Preview deployments). Each project's Root Directory is its app folder; build settings live in the committed
`apps/<app>/vercel.json`, **generated** from `infra/csp.json` by `node scripts/ops/gen-vercel.mjs` (`--check` fails
if stale — do not hand-edit).

| Setting | Value |
|---|---|
| Install | `cd ../.. && npm ci --no-audit --no-fund` |
| Build | `cd ../.. && npm run build -w @hangyul/<app>-web` (marketing adds `node scripts/public-data/stage-fit.mjs`) |
| Output | `dist` |

Routing order: a real file in `dist/` → `/api/:path*` rewrite → SPA fallback to `/index.html` (never for `/assets/*`
or `/data/*`). Headers: per-app CSP from `infra/csp.json`, HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy,
COOP, Permissions-Policy; HTML and `/build-info.json` are not cached, hashed assets are immutable. No service worker.

## 3. The `/api` rewrite and the ngrok tunnel

Each app's `vercel.json` rewrites same-origin `/api/:path*` to
`https://enclosure-cork-purifier.ngrok-free.dev/api/:path*` (commit `72cfca1c`). Because the browser stays
same-origin, the refresh cookie (`HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`) is first-party, CSP
`connect-src 'self'` suffices and no CORS is involved.

Running the tunnel (owner's machine, API on `:8001`; see commit `9a306bee` for the local stack fixes):

```bash
npm run dev:api
ngrok http 8001 --url https://enclosure-cork-purifier.ngrok-free.dev --traffic-policy-file infra/ngrok/dev-api-policy.yml
```

- `infra/ngrok/dev-api-policy.yml` forwards only `/api/*` and `/healthz`, and refuses the development OTP peek
  endpoint (including percent-encoded spellings). `/docs` and `/openapi.json` stay local.
- The API client and the marketing session hint send `ngrok-skip-browser-warning` (free ngrok answers browser-like
  requests with an HTML page, and Vercel rewrites cannot add request headers).
- Consequences: the API is only up while that machine and tunnel are up; it runs a development configuration, so the
  production fail-closed checks (real secrets, S3, ClamAV, staff MFA requirement) are **not** in force on it. When the
  tunnel is down the apps show the localized service-unavailable state with Retry.
- **To move to production:** stand up the API on a dedicated HTTPS origin, set the four `vercel.json` destinations
  (via `infra/csp.json` / `gen-vercel.mjs`) to it, and remove the ngrok header.

## 4. Marketing public data (no API needed)

Anonymous discovery does not depend on the API: `scripts/public-data/export.py` calls the API's own public endpoints
in-process over a seeded reference database and writes `apps/marketing-web/public/data/public/` (manifest, regions,
425 institution cards, detail and admissions records, countries, the fit snapshot). `apps/marketing-web/src/lib/publicData.ts`
answers from those files with the API's response shapes. Quick Fit and the scholarship summary run the unchanged
`server/app/services/fit.py` in the Vercel Python function `apps/marketing-web/api/public-fit.py`.

| Command | Purpose |
|---|---|
| `npm run public-data:export` / `public-data:check` | regenerate / detect a stale export |
| `npm run qa:marketing-serverless` | build marketing and verify it with the API offline (also `BASE=https://univ.talkhangyul.com`) |
| `scripts/qa/public-fit-parity.py` | function responses byte-identical to FastAPI |

This is why the public site shows 425 universities while the connected API's catalogue returns `total: 0`: they are
different data sets. Seeding the connected database (`npm run db:migrate && npm run db:seed`) is an open task.

## 5. Environment variables

Web (Vercel, per project; all public, no secrets):

| Variable | Value |
|---|---|
| `VITE_MARKETING_URL` | `https://univ.talkhangyul.com` |
| `VITE_STUDENT_APP_URL` | `https://app.univ.talkhangyul.com` |
| `VITE_AGENCY_APP_URL` | `https://admin.univ.talkhangyul.com` (Operations/Admin) |
| `VITE_UNIVERSITY_APP_URL` | `https://partner.univ.talkhangyul.com` |
| `VITE_ENABLE_DESIGN_PREVIEW` | **unset/off for public launch** (see §7) |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV` | system; written into `/build-info.json` |

API (server environment or `*_FILE` secret mounts; values never in git): `HG_ENV`, `HG_DATABASE_URL`, `HG_REDIS_URL`,
`HG_JWT_SECRET`, `HG_FILE_URL_SECRET`, `HG_MFA_ENCRYPTION_KEY`, `HG_PAYMENT_TOKEN_ENCRYPTION_KEY`, `HG_PUBLIC_ORIGIN`,
`HG_PUBLIC_API_ORIGIN`, `HG_CORS_ORIGINS`, storage (`HG_STORAGE_BACKEND`, `HG_S3_*`), scanning (`HG_MALWARE_SCANNER`,
`HG_CLAMD_*`), Turnstile, SendGrid, Twilio, payments (`HG_PAYMENT_PROVIDER`, `HG_TOSS_*`), SSO callback. Full matrix
with production/preview values: [`deployment/VERCEL_ENV_MATRIX.md`](deployment/VERCEL_ENV_MATRIX.md). `HG_ENV` defaults
to production and fails closed.

## 6. Build marker and smoke checks

Every web build emits `/build-info.json` (`buildInfo()` in `packages/config/vite.ts`):

```bash
for h in univ app.univ admin.univ partner.univ; do curl -s https://$h.talkhangyul.com/build-info.json; echo; done
curl -s -o /dev/null -w '%{http_code}\n' https://app.univ.talkhangyul.com/api/v1/auth/me      # 401 = API reachable
curl -s https://app.univ.talkhangyul.com/api/v1/public/plans | head -c 200                    # 200 with plans
BASE=https://univ.talkhangyul.com node scripts/qa/marketing-serverless.mjs
BASE=https://univ.talkhangyul.com npm run qa:brand
```

Deployment smoke results for the launch pass are recorded in `docs/qa/launch-final/`.

## 7. Design Preview flag

`VITE_ENABLE_DESIGN_PREVIEW=1` is the single build flag for Design Preview mode ("Preview without signing in" under
the Student / Operations / University logins; "Preview without paying" on the Student plan screen). Preview answers from
synthetic fixtures inside the browser, creates no auth session, refuses every write and makes no API request; a small
"Design Preview" indicator is always visible. Requirements and proof: [SECURITY.md](SECURITY.md).

**Current state: ON for owner review.** The flag is set in `build.env` of `apps/student-web/vercel.json`,
`apps/agency-web/vercel.json` and `apps/university-web/vercel.json` (the marketing site has no preview). The three files are generated: to turn
it off for the public launch set `DESIGN_PREVIEW = false` in `scripts/ops/gen-vercel.mjs`, run
`node scripts/ops/gen-vercel.mjs`, redeploy, and run `npm run release:preview-gate -- --launch --bundles off`.
The same generator holds the `/api` rewrite target (`API_ORIGIN`), which currently names the tunnel.

## 8. Release gates

| Gate | Command |
|---|---|
| Full local chain (leak, data-clean, i18n, typecheck, lint, API tests, web unit, build, marketing serverless, selects, crawl, a11y, critical E2E, teardown, native exports) | `npm run qa:v32` (`QA_V32_NATIVE=1` adds Expo exports) |
| Release verdict PASS / FAIL_LOCAL / BLOCKED_EXTERNAL | `npm run release:check` |
| Leak gate (no demo address, fixture password, test login, bypass) over source, current docs and bundles | `npm run qa:v32-leak` |
| Design Preview: one switch, no network code, fixture hygiene, deployment state (add `--launch --bundles off` before public launch) | `npm run release:preview-gate` |
| Design Preview isolation in a browser (zero `/api` requests; unpaid → paywall → paid; exit) | `npm run qa:launch-preview` |
| Responsive matrix: 12 viewports × every public and preview route, page-level overflow = FAIL | `npm run qa:launch-matrix` (after `npm run qa:launch-serve`) |
| Sign-up walk (identity API mocked at the network layer), all viewports | `npm run qa:launch-signup` |
| Accessibility sweep (axe WCAG 2.1 A/AA, public + preview routes, 390 and 1280) | `node scripts/qa/launch-final/a11y.mjs` |
| Generated config not stale | `node scripts/ops/gen-vercel.mjs --check`, `node scripts/ops/check-csp.mjs` |
| Docs root gates and links | `python3 scripts/docs/check-links.py` |
| Production readiness per control (API host) | `cd server && .venv/bin/python -m scripts.v29_prod_readiness` |

## 9. Production launch checklist (open)

1. Durable production API host on HTTPS (`api.univ.talkhangyul.com` or equivalent) with PostgreSQL, Redis, private S3
   storage, ClamAV, the worker (`infra/systemd/hangyul-worker.service`), nginx config from `node scripts/ops/gen-nginx.mjs`.
2. `HG_ENV=production` with real secrets; SendGrid / Twilio / Turnstile production credentials.
3. Migrate and seed reference data; verify `/api/v1/universities` is non-empty.
4. Point the four rewrites at the production host; remove the tunnel.
5. Scheduled off-host backups (`scripts/ops/backup.sh`, `restore-test.sh`).
6. `VITE_ENABLE_DESIGN_PREVIEW` off; rebuild; verify `/build-info.json` on all four domains.
7. Native: rebuild Android from current source with the Play upload key; build iOS (Apple/EAS credentials) —
   [`mobile/STORE_READINESS.md`](mobile/STORE_READINESS.md).

8. Payments (after 1–4, on the production host only): run migration `v33billing0001`; install the three live Toss
   billing merchants (`HG_TOSS_{DOMESTIC,FOREIGN,EASYPAY}_BILLING_{MID,CLIENT_KEY,SECRET_KEY,SECURITY_KEY,CURRENCY}`),
   `HG_PAYMENT_TOKEN_ENCRYPTION_KEY`, `HG_PAYMENT_PROVIDER=toss`, `HG_TOSS_ENV=live`,
   `HG_TOSS_RETURN_ORIGIN=https://app.univ.talkhangyul.com` into the host's secret store (never a Vercel variable, never
   a file in the tree); register `https://<api-origin>/api/v1/payments/webhooks/toss` in each Toss merchant console;
   `npm run payments:probe`; one controlled live transaction per method, then `HG_TOSS_CAPABILITY_<METHOD>=VERIFIED`;
   `HG_LIVE_PAYMENT_ENABLED=true`; `npm run release:payment-gate` must pass. Full procedure and current results:
   [`payments/BILLING.md`](payments/BILLING.md). **Do not put live payment secrets on the tunnelled development machine.**

Everything else that blocks launch (legal, human review) is in [ROADMAP.md](ROADMAP.md).
