# Vercel deployment

One GitHub repository, four Vercel projects (one per web app), production branch `main`.
No secrets in this file: names and structure only.

## Source

| | |
|---|---|
| Repository | `hangyul-edu/hangyul-univ` (`git@github.com:hangyul-edu/hangyul-univ.git`) |
| Production branch | `main`. Every push to `main` builds all four projects. Other branches and PRs get Preview deployments on `*.vercel.app` only. |
| Vercel team | `talkhangyul` (slug `myung2-loves-projects`, id `team_autIuGJVLkp1ICdECbzoW1Kd`), Hobby plan |
| DNS | `talkhangyul.com` uses Vercel nameservers, so each subdomain is configured and verified automatically when it is attached to a project |

## Monorepo (as found in source)

- npm workspaces (`packages/*`, `apps/*`), one root `package-lock.json`, Node ≥ 20. No Turborepo.
- The four web apps are Vite + React SPAs sharing one config, `packages/config/vite.ts` (`hangyulViteConfig(port)`).
- The shared packages (`@hangyul/design-tokens`, `ui`, `ynex-ui`, `eduan-ui`, `koreanasha-ui`, `i18n`, `types`,
  `utils`, `auth`, `api-client`, `icons`, `config`) are TypeScript **source** packages. They have no build step and
  are compiled inside each app's Vite build, so an app build needs the whole monorepo checked out and installed at the root.
- API: FastAPI in `server/` (Python ≥ 3.11, SQLAlchemy + Alembic, Postgres, Redis, S3, ClamAV, background worker
  `python -m app.worker`). Local dev runs on `:8001`, and each Vite dev server proxies `/api` to it.

| Product | Workspace | Folder | Local port | Vercel project | Domain |
|---|---|---|---|---|---|
| Marketing | `@hangyul/marketing-web` | `apps/marketing-web` | 3100 | `hangyul-univ` (`prj_h1ujC0FdCNMdEAAfJjq4UgwnM5qP`) | `univ.talkhangyul.com` |
| Student | `@hangyul/student-web` | `apps/student-web` | 3101 | `hangyul-univ-student` (`prj_4HrF4G9ao7IOPS7Wr3i0txZMIY3f`) | `app.univ.talkhangyul.com` |
| Agency | `@hangyul/agency-web` | `apps/agency-web` | 3102 | `hangyul-univ-agency` (`prj_ZonZa7TDChJwkiFHNFOY2taI7r3L`) | `admin.univ.talkhangyul.com` |
| University | `@hangyul/university-web` | `apps/university-web` | 3103 | `hangyul-univ-university` (`prj_20Vo2ilX5jRJCduazH19JjUFR1xz`) | `partner.univ.talkhangyul.com` |
| API | `hangyul-univ-api` (Python) | `server/` | 8001 | **not yet deployed** (see "API" below) | `api.univ.talkhangyul.com` (infrastructure only) |

`apps/student-web/public/media` is a symlink to `apps/marketing-web/public/media`, so the student build ships the same
university photography as marketing.

## Per-project build settings

Each project's **Root Directory** is its app folder, with "Include source files outside the Root Directory" on (the
default). The build settings live in the committed `apps/<app>/vercel.json`, which is **generated** from
`infra/csp.json` by `node scripts/ops/gen-vercel.mjs` (`--check` fails if stale). This is the same single source
`scripts/ops/gen-nginx.mjs` uses, so the Vercel and nginx deployments send the same CSP.

| Setting | Value |
|---|---|
| Framework | Vite |
| Install Command | `cd ../.. && npm ci --no-audit --no-fund` (monorepo root, from the lockfile) |
| Build Command | `cd ../.. && npm run build -w @hangyul/<app>-web` |
| Output Directory | `dist` |

Routing (Vercel checks the filesystem first, then rewrites):

1. A real file in `dist/` is served as is.
2. `/api/:path*` is proxied to `https://api.univ.talkhangyul.com/api/:path*`. The browser stays same-origin, so the
   refresh cookie (host-only, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/v1/auth`) stays first-party, CSP
   `connect-src 'self'` suffices, and no CORS is involved.
3. Anything else outside `/assets/` falls back to `/index.html` (SPA deep links such as `/login` and `/universities/<slug>`).
   A missing `/assets/*` file returns a 404, never an HTML page served as JavaScript.

Headers: CSP from `infra/csp.json` (per-app features: YouTube and Turnstile on marketing; YouTube, Turnstile and Toss
on student), HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, COOP and Permissions-Policy. HTML and
`/build-info.json` use `max-age=0, must-revalidate` or `no-store`. Hashed `/assets/*` files use `max-age=31536000, immutable`.

No service worker or PWA exists in any app, so no client-side cache can pin users to an old build.

## Build marker

Every web build emits `/build-info.json` (`buildInfo()` plugin in `packages/config/vite.ts`):

```json
{ "app": "marketing", "commit": "<VERCEL_GIT_COMMIT_SHA>", "builtAt": "<ISO time>", "environment": "production" }
```

To check what a domain is serving: `curl -s https://univ.talkhangyul.com/build-info.json`.

## Environment variables

See [VERCEL_ENV_MATRIX.md](VERCEL_ENV_MATRIX.md). The web apps need only the four public cross-app URLs, which are
inlined at build time. Changing them requires a redeploy.

## How deployment works from now on

- Push to `main` → the Vercel GitHub integration builds all four projects → each is promoted to its domain once its build succeeds.
- A failed build **does not** change what the domain serves. The previous successful production deployment stays
  live. This is exactly how the stale-site problem below happened, so check `build-info.json` after every release.
- Manual redeploy: `vercel redeploy <deployment-url> --target production --scope myung2-loves-projects`, or Dashboard →
  Project → Deployments → ⋯ → Redeploy.

## Rollback

Dashboard → Project → Deployments → pick the last good production deployment → **Instant Rollback**, or
`vercel rollback <deployment-url-or-id> --scope myung2-loves-projects`. Each project rolls back independently.
After a rollback, Vercel stops auto-promoting new `main` builds for that project until you promote one again
(`vercel promote`).

## Why `univ.talkhangyul.com` served the old site (diagnosed 2026-11-03)

- The `hangyul-univ` project had been created on 2026-10-15 with Framework "Other", Root Directory `.` and no
  build or output settings, while the repository then held a static template (commit `bf7bfd6`). That static
  deployment (`dpl_D6JYJ7qLU1RVwiT5KeFimE65gn7Y`, the "Koreanasha Education" page) was the last one that succeeded.
- After the current monorepo was pushed (`1c7c624`), Vercel built it with the root `npm run build`, which builds
  all four apps, and then failed with `STATIC_BUILD_NO_OUT_DIR`: no `public/` directory at the root
  (`dpl_TUWYq8cwPLdHapFFt7uhuBDjzBe8`, state ERROR).
- A failed production build leaves the previous deployment on the domain, so the old static template kept being served.
- What was not the cause: the Git link (correct repository, `main`), domain ownership (attached to this project),
  DNS (Vercel nameservers), a service worker (none exists) and browser cache.
- Fix: Root Directory `apps/marketing-web`, Framework Vite, the committed `vercel.json`, and three more projects for the other apps.

## API

The FastAPI service is **not** deployed yet. Its production start-up is fail-closed (`server/app/core/config.py`,
`v29_production_violations` and `get_settings`) and refuses to run without all of the following:

- managed Postgres (`HG_DATABASE_URL`) with Alembic migrations applied
- Redis (`HG_REDIS_URL`) for OTP, rate limits and signup sessions
- S3 private storage with SSE (`HG_STORAGE_BACKEND=s3`, `HG_S3_*`); the Vercel filesystem is ephemeral
- a ClamAV daemon (`HG_MALWARE_SCANNER=clamd`, `HG_CLAMD_HOST`). This cannot run inside a Vercel function and needs a separate host.
- Turnstile, SendGrid and Twilio credentials
- `HG_MFA_ENCRYPTION_KEY`, distinct ≥ 32-character `HG_JWT_SECRET` and `HG_FILE_URL_SECRET`, `HG_PUBLIC_ORIGIN`
  and `HG_CORS_ORIGINS` (https only)

Until it is live, the web apps serve their full UI, but `/api/*` (sign-in, registration and live data) fails.

Other considerations for a Vercel Python deployment of `server/`:

- Client IP. Rate limits and audit use `request.client.host`. Behind Vercel's proxy that is the proxy, not the
  user, unless forwarded headers are trusted (`uvicorn --proxy-headers` or equivalent middleware with Vercel's
  `X-Forwarded-For`). Without this, every user shares one rate-limit bucket.
- Background jobs (`python -m app.worker`: daily reminders and deadlines, rescans, retention) are a long-running
  loop. On Vercel they must be split into Cron Jobs calling `--job NAME`-equivalent endpoints, or run on the
  same host as ClamAV.
