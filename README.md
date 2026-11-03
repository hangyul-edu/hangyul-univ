# Hangyul Univ

> Everything you need to study in Korea — from your first question to graduation.

Hangyul Univ is the operating system that connects **students → Hangyul → partner study-abroad agencies → partner Korean universities**. It combines honest eligibility and matching, a reusable secure document vault, a document legalization (apostille / consular confirmation) router, collaborative essay review, visa, housing and arrival guidance, an agency CRM, and university recruitment and outcome analytics. Every time-sensitive fact carries its source and the date it was verified.

| Product | URL | Stack |
|---|---|---|
| Marketing website | http://localhost:3100 | React 19 · Vite 7 |
| Student platform | http://localhost:3101 | React 19 · Vite 7 · TanStack Query |
| Agency console | http://localhost:3102 | React 19 · Vite 7 · TanStack Table · Recharts |
| University console | http://localhost:3103 | React 19 · Vite 7 · Recharts |
| API | http://localhost:8001 · docs http://localhost:8001/docs | FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 |
| Native apps | Expo Go / simulators | React Native 0.86 · Expo SDK 57 · expo-router |

Docs: [PRODUCT](docs/PRODUCT.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATA_MODEL](docs/DATA_MODEL.md) · [WORKFLOWS](docs/WORKFLOWS.md) · [I18N](docs/I18N.md) · [SECURITY](docs/SECURITY.md) · [RESEARCH](docs/RESEARCH.md) · [ROADMAP](docs/ROADMAP.md) · [FRONTEND_CONVENTIONS](docs/FRONTEND_CONVENTIONS.md)

## Prerequisites

- Node.js ≥ 20 (tested with 24) and npm ≥ 10
- Python ≥ 3.11 (tested with 3.12) with `venv`
- PostgreSQL 16 as a native service (default `postgresql://hangyul:hangyul_dev@localhost:5432/hangyul_univ`). Docker is optional: `docker compose up -d postgres redis` works if you have it, but the development host runs PostgreSQL and Redis natively, not in Docker
- Redis — optional in development
- For native apps: Expo Go on a phone, or Android Studio / Xcode simulators

## Setup (first time)

```bash
cd /root/hangyul-univ
npm install
npm run setup
```

`npm run setup` is idempotent. It checks prerequisites, creates `server/.env` from `server/.env.example`, creates the Python virtualenv and installs the backend, makes sure PostgreSQL is reachable (it starts Docker services if Docker is available, otherwise it tries to create the `hangyul` role and the `hangyul_univ` / `hangyul_univ_test` databases with the local `postgres` superuser), runs the Alembic migrations, loads the demo dataset, and generates design-token CSS and i18n loaders.

If PostgreSQL is managed by you, create the role and databases once:

```sql
CREATE ROLE hangyul LOGIN PASSWORD 'hangyul_dev' CREATEDB;
CREATE DATABASE hangyul_univ OWNER hangyul;
CREATE DATABASE hangyul_univ_test OWNER hangyul;
```

## Run everything

```bash
npm run dev
```

This starts the API (with auto-reload) and the four web apps in one terminal, with labelled, colour-coded logs (`api`, `marketing`, `student`, `agency`, `university`). Ports are fixed (3100–3103, API 8001) and `--strictPort` fails loudly instead of silently moving. The web apps proxy `/api` to the API, so sign-in cookies are first-party and no CORS setup is needed.

Individual processes: `npm run dev:api`, `npm run dev:marketing`, `npm run dev:student`, `npm run dev:agency`, `npm run dev:university`.

## Accounts and data

There are **no test accounts**. `npm run setup` / `npm run db:seed` load reference data only — the 425-institution
directory, verified scholarships and admission rules, legalization and visa rules, the approved plans — and **zero
members**. Sign in is the real registration flow in every environment; there is no demo sign-in, no persona picker and
no "activate without paying" action (all removed in V32, REPORT §436).

Automated tests get their synthetic people and cases from `server/app/seed/fixtures.py`, which **refuses any database
whose name lacks `test`/`e2e`**: `npm run test:api` builds `hangyul_univ_test`, `scripts/qa/e2e-db.mjs` builds the e2e
template, and `npm run db:fixtures` is for a throw-away test database only. The fixture password is defined once in that
module and documented nowhere else.

## Environment variables (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `HG_ENV` | `production` | **Fails closed (V23):** unset, empty or unknown values are treated as `production`, which refuses dev secrets, enables secure cookies and disables test sign-in. Local runners (`npm run dev`, `scripts/api.mjs`, e2e, pytest) set `development` explicitly |
| `HG_DATABASE_URL` | `postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ` | main DB |
| `HG_TEST_DATABASE_URL` | `…/hangyul_univ_test` | pytest DB (rebuilt on every run) |
| `HG_REDIS_URL` | `redis://localhost:6379/5` | optional cache / jobs |
| `HG_JWT_SECRET`, `HG_FILE_URL_SECRET` | dev-only values | **change for any shared environment** |
| `HG_ACCESS_TOKEN_MINUTES` / `HG_REFRESH_TOKEN_DAYS` | 15 / 14 | session lifetimes |
| `HG_CORS_ORIGINS` | the four localhost ports | allowed browser origins |
| `HG_STORAGE_BACKEND` / `HG_STORAGE_DIR` | `local` / `./var/uploads` | private document storage (`s3` adapter stub for MinIO/S3) |
| `HG_MAX_UPLOAD_MB` | 15 | upload limit |
| `HG_PAYMENT_PROVIDER` | `demo` | `demo` (development/tests only) or `toss`. The product runs **Toss Payments in TEST mode** (`HG_TOSS_ENV=test`): plans (Basic US$179 / All-in-One US$349 / Premium US$599, one-time) are bought by foreign-card key-in on MID `bill_talkoab1` through Hangyul's own card form; the server relays card number and expiry to Toss and stores neither (REPORT §0.4, `docs/payments/`) |
| `HG_MALWARE_SCANNER` | `noop` | scanner hook |

Web apps: `HG_API_URL` (Vite proxy target, default `http://127.0.0.1:8001`), `VITE_STUDENT_APP_URL` (marketing CTAs). Mobile: `EXPO_PUBLIC_API_URL`.

## Backend commands

```bash
npm run db:migrate     # alembic upgrade head
npm run db:seed        # load reference data (no-op if present); zero members
npm run db:reset       # drop schema, migrate, reload reference data
npm run db:fixtures    # synthetic test data — refused unless the database name contains test/e2e
npm run test:api       # pytest (uses hangyul_univ_test)
npm run lint:api       # ruff
node scripts/api.mjs daily   # freshness scan + task engine + analytics rollup (schedule daily in production)

# directly
cd server && .venv/bin/alembic revision --autogenerate -m "describe change"
cd server && .venv/bin/python scripts/gen_data_model_doc.py   # refresh docs/DATA_MODEL.md
```

## Mobile apps

```bash
npm run dev:mobile:student      # Expo dev server for the student app
npm run dev:mobile:agency
npm run dev:mobile:university
```

Scan the QR code with Expo Go, or press `a` / `i` for an emulator/simulator. The apps call `EXPO_PUBLIC_API_URL` (default `http://localhost:8001`): use `http://10.0.2.2:8001` on the Android emulator and `http://<your-LAN-IP>:8001` on a physical phone (run the API with `--host 0.0.0.0`, which `npm run dev` already does).

## Tests

```bash
npm run test:api     # backend: auth, RBAC, tenant isolation, full lifecycle, matching, legalization, state machine
npm run test:web     # Vitest + Testing Library in each web app
npm run typecheck    # TypeScript for every workspace (sequential)
npm run build        # production builds (sequential)
npm run test:e2e     # Playwright against the running stack (npm run dev)
npm run i18n:check   # translation coverage report
```

## Troubleshooting

- **`Port 310x is already in use`** — another process holds the port (`ss -ltnp | grep 310`); stop it. Ports are strict by design.
- **API fails to start: database connection refused** — start PostgreSQL (`sudo service postgresql start`; or `docker compose up -d postgres` if you chose the optional Docker setup) and check `HG_DATABASE_URL`.
- **`relation … does not exist`** — run `npm run db:migrate` (or `npm run db:reset` for a fresh database).
- **Signed in but immediately signed out** — the refresh cookie is scoped to `/api/v1/auth` on the app's own origin; always open apps via `localhost` (not mixing `127.0.0.1` and `localhost`).
- **Mobile app can't reach the API** — see the `EXPO_PUBLIC_API_URL` notes above.
- **Low-memory machines** — root `typecheck`, `build` and `test:web` run workspaces one at a time; Playwright uses one worker.
