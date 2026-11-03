# Architecture

```
/root/hangyul-univ
├── apps/
│   ├── marketing-web      React + Vite  :3100   public site, SEO guides, public search
│   ├── student-web        React + Vite  :3101   student platform
│   ├── agency-web         React + Vite  :3102   agency / Hangyul operations console
│   ├── university-web     React + Vite  :3103   university console
│   ├── student-mobile     Expo (expo-router)    native student app
│   ├── agency-mobile      Expo                  native agency app
│   └── university-mobile  Expo                  native university app
├── packages/
│   ├── design-tokens   TS tokens → tokens.css (CSS variables) + RN objects
│   ├── types           domain types mirroring API serializers
│   ├── api-client      typed fetch client, token refresh, tokenStore abstraction
│   ├── auth            AuthProvider/useAuth (React DOM + RN)
│   ├── i18n            i18next setup, 56 locale bundles (33 market locales), lazy JSON namespaces, RTL
│   ├── validation      Zod schemas shared by web + mobile
│   ├── utils           Intl formatters, status→tone maps, CSV
│   ├── icons           Lucide + official Hangyul brand assets
│   ├── ui              web components, shells, DataTable, charts (lazy)
│   ├── mobile-ui       React Native components & bootstrap
│   ├── koreanasha-ui   V10: Koreanasha adapter — the marketing foundation (layers over eduan-ui)
│   ├── eduan-ui        V7: licensed Eduan template adapter (shared chassis + component/asset source)
│   ├── ynex-ui         V7: licensed YNEX template adapter (console foundation)
│   └── config          tsconfig base + shared Vite config (proxy, chunking, SCSS, template-CSS RTL/purge)
├── server/             FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
├── scripts/            setup / dev / api helpers
├── infra/              docker-compose init SQL
└── docs/
```

## Runtime

```
Browser (3100–3103) ──/api proxy──▶ FastAPI :8001 ──▶ PostgreSQL 16
                                          │           Redis (optional: cache/jobs)
Expo apps ──── https://<host>:8001/api ───┘           Private object storage (local dir → S3/MinIO)
```

- Web apps call same-origin `/api/v1/*`; Vite proxies to FastAPI in development, so the refresh cookie is first-party (`hg_rt_<client>`, httpOnly, `SameSite=Lax`, path `/api/v1/auth`). In production put the apps and API behind one domain (or subdomains with an API gateway).
- Mobile apps keep the refresh token in the OS keychain (`expo-secure-store`) and send it in the refresh body.

## Backend modules (`server/app`)

| Layer | Contents |
|---|---|
| `core/` | settings, DB session, security (argon2, JWT, refresh rotation, signed file URLs), principal & tenant resolution (`deps.py`), audit/event helpers, storage + upload validation |
| `models/` | 117 tables (`Base.metadata`, 2026-10-27; `docs/DATA_MODEL.md` is generated from them) across identity, reference (countries, locales, sources, freshness, legalization rules), catalog, student, workflow (applications, documents, essays, tasks, messaging, notifications), business (services, orders, payments, partner contracts, quotas, scholarship pools/awards), lifecycle (visa, housing, arrival, enrollment, terms, outcomes, support, content, analytics, audit) |
| `services/` | `access` (tenant isolation), `state_machine`, `matching`, `readiness` (checklists, legalization routing, readiness %), `visa`, `assignment`, `tasks_engine`, `essays` (pre-check, diff), `analytics` (+ rollup), `freshness`, `payments`, `notify` |
| `api/v1/` | `auth`, `catalog`, `directory` (V12: the public Korean institution directory — institution-level facts only, no price/deadline/requirement/match), `student` (`/me/*`), `documents`, `applications`, `collab` (essays, tasks, messages, notifications, visa), `agency`, `university`, `admin` (sources, freshness, audit) |
| `jobs/daily.py` | freshness scan, intake closing, task regeneration, analytics rollup |
| `seed/` | reference data, research-backed sources, demo catalog/tenants/students, and `institutions.py` — the **real** institution directory loaded from `app/data/korean_institutions.json` (not demo data; built by `scripts/catalog/import_korean_universities.py`) |

API docs: http://localhost:8001/docs (OpenAPI 3).

## Key flows as code

- **Matching** (`services/matching.py`): Stage 1 hard eligibility (degree, prior education, nationality restriction, language minimums with `language_alternative`, GPA minimum, open intake; near-misses become REACH). Stage 2 weighted factors (academic 20, language 20, field 20, budget 15, scholarship 10, location 5, housing 5, deadline 5). Every point is returned as `factors[]`; every judgement as `reasons[]` with i18n `code` + `params`. `MatchSnapshot` stores results with `engine_version` for future model training. Future probabilities must carry sample size, model version, confidence and data freshness.
- **State machine** (`services/state_machine.py`): explicit transitions with allowed actor kinds (STUDENT / AGENCY / UNIVERSITY / HANGYUL / SYSTEM). Every change writes `ApplicationStatusHistory`, an audit log row, an analytics event, notifications, pipeline stage updates, and triggers automation (e.g. `ADMISSION_CERTIFICATE_ISSUED` opens a visa case; `ENROLLED` creates a `StudentEnrollment`).
- **Task engine** (`services/tasks_engine.py`): idempotent generation with `dedupe_key` from deadlines, missing/rejected/expired documents, legalization gaps, document reviews, essays, tuition, university requests, interviews, visa steps and agency first-response SLA; auto-closes tasks whose trigger disappears.
- **Assignment** (`services/assignment.py`): scores partner agencies by country expertise, language, university and degree expertise, workload vs capacity, SLA history and student preference — not raw acceptance rate. Picks the lightest-loaded counselor. Operations can override (audited, with reason).
- **Legalization routing** (`services/readiness.py::legalization_for`): most specific `LegalizationRule` wins (country + category + university); otherwise derived from the time-versioned Hague membership (`Country.apostille_member` + `apostille_effective_from`), producing a human-readable step list and transition notes (e.g. Vietnam since 2026-09-11, Thailand from 2027-02-28).

## Analytics

Events (`analytics_events`): `student_registered, profile_started, profile_completed, university_viewed, program_viewed, university_saved, comparison_created, match_generated, service_checkout_started, service_purchased, agency_assigned, document_uploaded, document_verified, application_started, application_submitted, offer_received, offer_accepted, tuition_paid, visa_started, visa_issued, student_arrived, student_enrolled, student_retained, student_graduated`.

Dashboards read the `daily_metrics` rollup (rebuilt by `jobs/daily.py`, idempotent) for time series and compute funnels from status history. Rates with denominators below 5 are returned as `insufficient_data` instead of noisy percentages. Every metric has a definition returned by the API.

## Identity, roles and payments (current — pointers)

- **Identity (V22, REPORT §0.3a).** Registration is a four-step verified flow (`POST /auth/signup/session` with a Turnstile proof → `/auth/verification/send` + `/verify` for e-mail and SMS one-time codes → `/auth/register`); no account exists before the last call. **One role per tenant:** every partner-agency member is `AGENCY_ADMIN`, every university member `UNIVERSITY_ADMIN` (`server/app/models/enums.py`, legacy values survive only as aliases). Students see staff as one identity, *Hangyul Univ team* (`services/display_identity.py`). SendGrid / Twilio / Turnstile are read from environment variables and are **absent on this host**.
- **Payments (V21, REPORT §0.4).** Plans are one-time USD purchases (Basic US$179 / All-in-One US$349 / Premium US$599; `packages/types/src/plans.ts` → `shared/plans.json`). Toss Payments runs in **TEST mode**: `POST /me/orders` → Hangyul's own card form → `POST /me/orders/{id}/pay-with-card` → the server relays card number and expiry to Toss's key-in API on MID `bill_talkoab1` and stores neither. Live keys and the overseas-card/USD contracts are owner actions (`docs/payments/TOSS_FOREIGN_CARD_REVIEW.md`).
- **Environment.** `HG_ENV` defaults to `production` and fails closed (unset or unknown = production); local runners set `development` explicitly.

## Frontend

See [FRONTEND_CONVENTIONS.md](FRONTEND_CONVENTIONS.md). Route-level code splitting, charts in a separate chunk, locale JSON loaded lazily per language/namespace, TanStack Query caching.

### Stylesheets (current — V26)

The per-pass version layers (`v6.css` … `v25.css`) were merged in V26 into purpose-named files under `apps/*/src/styles/`:

| App | Files | Import order |
|---|---|---|
| marketing-web | `base.css`, `site.css`, `home.css`, `start.css`, `directory.css`, `university.css` | `main.tsx`: `@hangyul/eduan-ui/styles.scss` → `@hangyul/ui/styles.css` → `styles/base.css` → `@hangyul/eduan-ui/site.scss` → `@hangyul/koreanasha-ui/styles.scss` (Koreanasha last, so its header/hero/bands win). `site.css` is imported by `apps/marketing-web/src/components/SiteLayout.tsx`; `home.css`, `start.css`, `directory.css` + `university.css` are imported by their route components and load with the route chunk |
| student-web | `app.css` | `@hangyul/ui/styles.css` → `styles/app.css` |
| agency-web, university-web | `base.css`, `screens.css` | `@hangyul/ui/styles.css` → `styles/base.css` → `@hangyul/ui/console-v22.css` → `styles/screens.css` |

## Performance and memory notes

The development machine has ~5 GB RAM; root scripts run builds/tests sequentially (`scripts/run-seq.mjs`) and Playwright uses one worker.

## Sticky table headers and scroll containers (V10)

`position: sticky` resolves against the nearest **scroll container**, and CSS makes one more easily than it
looks: `overflow-x: auto` alone forces the other axis away from `visible` (and `clip` paired with `auto`
computes to `hidden`), so a horizontally scrollable wrapper silently traps a sticky `<th>` in a box that never
scrolls vertically. That is why every console table's header used to scroll away despite being declared sticky.

The rules now:
- `.hg-table-wrap` keeps `overflow-x: auto` only below 992 px; above it the wrapper is transparent to sticky.
  This is safe because V8/V9's responsive column priority already yields 0 sideways tables.
- A card that must clip its rounded corners around a table uses **`overflow: clip`**, not `hidden` — identical
  visually, but it creates no scroll container.
- `--hg-table-sticky-top` carries the height of the fixed chrome above the table (4.75 rem in the consoles),
  so the header stops below the app header instead of behind it.

`scripts/qa/v10-design-errors.mjs` guards the trade: it fails if anything starts overflowing its parent again.

## Template foundations (V7, revised V10)

**V10.** `template-koreanasha/` is a site Hangyul owns (the same build served at univ.talkhangyul.com) and has
authorised for this project. It is a **customised Eduan build** — its compiled `main.css` carries Eduan's banner
and class vocabulary with ~500 hand-written lines prepended (REPORT §65.1). `packages/koreanasha-ui` therefore
carries only that layer, re-authored as SCSS and re-themed to the Hangyul palette, and is imported **after**
`@hangyul/eduan-ui` in `apps/marketing-web/src/main.tsx`, so Koreanasha's header, hero, bands and cards win
wherever the two overlap. React ports in the package: `Hero` (a `<picture>` with one hand-made crop per
breakpoint), `Band`, `SectionHead`, `Card(s)`, `MediaRow`, `Marquee` (CSS animation, not Koreanasha's endless
rAF loop), `Faq` (native `<details>`, not Bootstrap collapse), `Cta`, `Reveal`; `Offcanvas` and
`useStickyHeader` are re-exported from `eduan-ui` rather than written twice. The template folder itself is not
served at runtime. Inventory: `docs/TEMPLATE_KOREANASHA_INVENTORY.md`.


`themeforest-eduan/` and `themeforest-ynex/` are purchased ThemeForest templates the owner authorised for full use inside Hangyul Univ. They are **implementation sources**, not runtime folders: their SCSS is copied verbatim into `packages/eduan-ui/src/scss/eduan` and `packages/ynex-ui/src/scss/ynex` (licence headers intact; the only edits are documented in place), compiled with a Bootstrap 5 subset, themed through the templates' own CSS variables, and rendered by React ports of their markup. jQuery and template plugins (Swiper, WOW, MeanMenu, bxSlider, Odometer, SimpleBar, defaultmenu.js, DataTables, ApexCharts…) are not shipped. Build pipeline (`packages/config/vite.ts`): Eduan CSS gets automatic `[dir=rtl]` mirroring (postcss-rtlcss); production builds purge template selectors not used in any Hangyul source (PurgeCSS, runtime class patterns safelisted). Inventories: `docs/TEMPLATE_EDUAN_INVENTORY.md`, `docs/TEMPLATE_YNEX_INVENTORY.md`; mapping and decisions: REPORT §40–41.

## V8 additions (2026-10-09)

- **Shared rules in packages.**
  - `@hangyul/utils` `eligibilityGroup` / `isOtherDegree`: one eligibility vocabulary for student Discovery and the agency catalogue (STATE_MAP).
  - `@hangyul/ui` `DataTable` responsive column priority (`meta.priority`, `meta.minWidth`, measured folding into a details row).
  - `@hangyul/ynex-ui` `AuthCover` (branded console login) and the collapsed icon rail below 1280 px.
- **Agency / Hangyul operations (server).**
  - `services/agency_ops.py`: operational saved views (count = rows), explainable Today ranking (`priority.rank_key`), case movement ("why isn't this moving"), manager Operations (backlog, ageing, load vs capacity, SLA, deadlines at risk, slow stages; each with drill-down filters).
  - `services/channels.py` + `/channels`: message channel model. In-app is active; external channels report "not connected" until a provider is configured, and nothing is ever sent through them.
  - `GET /admin/readiness`: integration readiness from real settings (ACTIVE / DEVELOPMENT_ONLY / NEEDS_AGREEMENT / NOT_CONFIGURED; env names only).
  - The audit API returns readable sentences.
- **University (server).**
  - `services/access.university_visible()`: the one university population, used by tenancy and every breakdown.
  - `services/metrics.GLOSSARY` (`GET /university/glossary`).
  - One-pass per-agency analytics (25.5 s → < 0.4 s API).
  - `GET /applications` filters `intake`, `degree`, `reviewer`, `admin_check`, `reached`, `ids`.
  - Safe bulk endpoints `POST /university/bulk/{assign-reviewer,document-request,admin-check}` with per-item results (no bulk decisions).
  - Export presets and saved configurations (`export_presets`), administrative checks (`application_admin_checks`, migration `a8u1b2c3d4e5`), program rule history.
- **Student (server).** `GET /me/budget` carries `hangyul_fee` (PAID / DUE from the student's own order, NONE = optional with the lowest active plan price).
- **Student (web).** Stage-aware navigation (`apps/student-web/src/lib/nav.ts`).
- **QA tooling.**
  - `scripts/qa/v8-capture.mjs`: route-complete captures with metrics (`WIDTHS` override, regex name filter).
  - `scripts/qa/prune-css.mjs`: dead-selector removal.
  - `scripts/qa/e2e-db.mjs`: pristine template database cloned to `hangyul_univ_e2e` per E2E run. Run the stack with `HG_DATABASE_URL` pointing to it; the dev database is never touched.

## V9 additions (2026-10-14)

- **Waiting-on (one model).** `services/waiting.py`: `STUDENT · COUNSELOR · AGENCY · HANGYUL · UNIVERSITY · EXTERNAL · NONE`, 25 reason codes, ordered SQL rules shared by row values, view counts and list filters (count = rows by construction). Legacy `us` stays as a filter alias. `applicationWaitingOn(status, ctx?)` in `@hangyul/utils` mirrors it for the UI.
- **Money.** `services/money.py` builds the one money plan (lines with payer → payee, timing, refundable, basis + source + date; "money you must show" from the visa route; announced-not-in-force rule changes; payment-route guard; refund summary). `GET /me/money-plan`; additive fields on `/me/budget`, `/me/offers`, `/me/visa-route`. Service-case type `REFUND` opens on visa refusal after tuition or withdrawal after tuition.
- **Language routes.** `matching.language_routes()` (additive field `routes` on the public quick check, `/me/matches`, early home).
- **Sponsor view.** `models/v9_sponsor.py` (+ migration `v9_student_sponsor`), `api/v1/sponsor.py`: hashed tokens, scopes, expiry, revocation, audited views; public `GET /public/sponsor/{token}`.
- **Agency.** Team weights/availability/leave and reassignment, templates with scopes and language groups, submissions pipeline across all connector methods (`submission.submission_pipeline`), meetings as one record, process-quality and HQ partner-quality endpoints, agency identity per case (`agency_ops.agency_identity`), message delivery state + application link, readiness classified into seven launch categories. Migration `v9a1agencyops`.
- **University.** Filter-based bulk preview/execute (`/university/bulk-filter/...`, safe actions only, `expected_total` guard), `analytics/questions`, `partnership-value`, `requirement_impact` (three-valued, "not enough data" instead of a guess), team deactivate/reassign. No migration; additive `eligibility` filter on `GET /applications`.
- **Visa/arrival data.** Research JSON rebuilt from untouched baselines by `server/scripts/v9_visa_research_apply.py`; routes carry `v9_revalidation` (`changes`, `confirmed`, `unconfirmed`, `watch_items`) and dated `scheduled_changes` applied by date (`seed/extra_95_visa_data.py`, `server/scripts/v9_visa_data.py`).
- **i18n gate.** `packages/i18n`: `isStudentAppLocale()` (manifest 100 % **and** a recorded leak check with 0 leaks), `studentApp.locales`, per-locale files `_student_manifest.json` / `_student_status.json`; `registerLocalePreloader()` loads CLDR fallback data per locale as its own chunk (`packages/utils/src/intl-fallback/<loc>.ts`); the student web and native pickers offer only gated locales.
- **Performance.** Initial JS per app 143–152 KB gzip: zod left the entry chunk (login form uses plain checks with the same messages) and CLDR fallback data (126 KB source) is now per-locale chunks. Console shell: labelled sidebar (12.5 rem at 992–1279 px), the V8 automatic icon rail is gone.
- **QA tooling.** `scripts/qa/v9-capture.mjs` (all routes, key screens at 10 widths), `leak-check-v9.mjs`, `scripts/i18n/v9-{manifest,todo,merge,coverage,sync-tier}.mjs`, `initial-js.py`, `_dbg.mjs`, `_shot.mjs`.

## V10 additions (2026-10-16)

*Dated record. The stylesheet layout described in the first bullet was consolidated in V26 — see "Stylesheets (current — V26)" above.*

- **Marketing CSS layer order** (`apps/marketing-web/src/main.tsx`, top to bottom): the shared Eduan/Bootstrap
  chassis → `@hangyul/ui` base → the app's `styles.css` and `v6.css` → `eduan-ui/site.scss` (the glue) → the
  **Koreanasha layer last**, so its header, hero, bands and cards win wherever the two overlap. `v10.css` is
  imported by `pages/Home.tsx`, not by the shell, because only the home page uses it.
- **The superseded layer was deleted, not left in place.** `pages/home/v9.tsx` and `src/v9.css` are gone
  (`v9.css` was still shipping on every home page load), four of `home/v7.tsx`'s seven exports are gone, and
  with them 281 now-unreachable CSS selectors — 253 of them in `_hangyul-glue.scss`, which lost a third of its
  size because Koreanasha's chrome replaced Eduan's. Marketing CSS: 273.7 → 255.1 KB (56.3 → 53.0 KB gzip).
  REPORT §69.12 records what went and why. **Dead CSS hides behind dead TSX**: `prune-css.mjs` tests whether a
  class name appears in any source file, so a superseded-but-still-present component keeps its stylesheet
  alive. Delete the component first, then prune.
- **QA tooling.**
  - `scripts/qa/prune-css.mjs` now accepts `.scss`: it parses a copy with `//` comments and `@use` blanked out
    line for line, then applies the edits to the original by line range, so comments survive. It honours the
    `base--` rule — `ed-section--ink`, `hg-btn--lg` and `mk-qs--result` are composed at runtime from a prop and
    appear in no source file literally, so a naive class-name grep calls them dead.
  - `scripts/qa/css-conflicts.mjs`: a property declared twice for one selector where the first can never apply.
    Reports rather than rewrites — most hits are a later generation's deliberate re-tuning block.
  - `scripts/qa/v10-dead-css.mjs`: the same question asked of the DOM. Kept for inspection, **not** used as the
    instrument: an unvisited route and a hover state look identical to dead from outside the browser.
  - `scripts/qa/v10-removed-css-probe.mjs`: takes the before/after pair of a stylesheet, derives the selectors
    the prune removed and asks the live DOM whether any of them still matches — and, where one does, whether
    the declarations it carried still reach the element. This is what proved the removal safe, and what caught
    the `:is()` mistake. Baselines live in `docs/qa/v10/css-baseline/`.
  - `scripts/qa/v10-pixdiff.py`: pixel comparison of two capture phases. Use it on marketing, not on the
    consoles: Chromium's full-page rasterisation jitters ~15 px horizontally between runs there while the DOM
    stays identical, so a third of console images "differ" with no code change. The capture's `metrics.json`
    is byte-identical across runs; the numbers are safe, the pixels are not.
  - `scripts/qa/v10-design-errors.mjs` gained a tenth check: a control clipped out of its container with
    nothing scrollable beneath it to reach it. Reachability is per axis and stops at the first ancestor that
    scrolls on that axis, or a tab strip with `overflow-x: auto` reads as broken.

## The directory and the catalogue (V12)

Two tables that look alike and are not — the distinction brief Part 21 asks for, and the reason the public site
can carry real data while the application flow still runs on seeded figures:

| | `institutions` | `universities` |
|---|---|---|
| Why a row exists | the institution exists, per 대학알리미 | Hangyul holds verified admission data for it |
| Rows today | **425** | 10 |
| Carries | name (ko/en), kind, establishment, region, website, IEQAS certification, campuses, provenance | programmes, intakes, requirements, costs, dormitories, scholarships, partner contracts |
| Surface | public (`/universities`, `/universities/:slug`) | authenticated (Student Platform, consoles) |
| Source | real, per-field, with a check date | seeded sample data |
| Link | `institutions.catalog_university_id` — **nullable, and null for 415 of 425** | — |

A directory entry with no catalogue entry is the ordinary case. The public page offers "prepare to study here"
for it anyway, and the Student Platform answers with the institution's verified facts and a counsellor rather
than with invented programme data (`DirectoryOnlyUniversity`, REPORT §90.5).

Maintenance: `scripts/catalog/import_korean_universities.py` (registry → merge → `app/data/korean_institutions.json`,
with `--offline` and `--check`), `scripts/catalog/build_korea_map.py` (KOSTAT boundaries → the region SVG), and
`server/scripts/v12_load_institutions.py` to refresh a populated database without touching anything else. The
disclosure year is one constant in the importer; anything the registry stops listing becomes `WITHDRAWN` and is
never served.

## V15 — the commercial model has one source of truth

*2026-10-19. REPORT §117.*

Before V15 the price of a plan existed in three places that could drift: the homepage, the student service
page, and a seed function on the server. Nothing structural stopped them disagreeing.

```
packages/types/src/plans.ts          the manifest — codes, USD amounts in cents (`amount_minor` 17900 / 34900 / 59900), entitlements, comparison rows
        │
        ├─ scripts/plans/sync.mjs ──► shared/plans.json         (generated; --check fails if stale)
        │                                     │
        │                                     └─► server/app/seed/run.py  seed_products()
        │                                                 │
        │                                                 └─► service_products / service_prices
        │                                                            │
        │                                     GET /api/v1/public/plans ◄┘   (anonymous, no tracking)
        │                                     GET /api/v1/me/services       (student)
        │                                     GET /api/v1/agency/students/{id}/plan
        │
        └─► apps/marketing-web  renders the manifest directly
```

Marketing reads the **manifest**, not the endpoint, because a public page has to paint when the API is down —
the same rule the institution directory follows. The endpoint exists so the gate can prove the database
agrees with the file. `npm run qa:pricing` compares all four (manifest, generated JSON, API, rendered page)
and fails on any difference.

### Entitlements

`ServiceProduct.entitlements` is one JSON column holding the shape in `PlanEntitlements`. Three rules make it
trustworthy:

1. **Usage is derived**, from the records that prove the work happened — managed applications from
   `Application`, review rounds from `EssayReview.review_round`, mock interviews and follow-ups from
   `Appointment`, recommendations from `SavedUniversity.source = 'HANGYUL'`. No counter to drift.
2. **`null` means *not rationed*** and is never reported as `0`.
3. **An add-on is a delta on one key.** `ServiceAddOn` is OFFERED by staff, APPROVED by the student, and only
   APPROVED rows raise an effective limit.

`app.services.entitlements.check()` raises `OutOfScope`, which serializes to a typed 409 the UI can explain
rather than a generic error. It takes a `prospective` value for keys whose usage is not a running total —
`essay_review_rounds` is the deepest round any one essay has reached, because the plan sells *a pass over the
writing*, not a review per document.

## V29 infrastructure (Phase E, 2026-10-30)

Security policy and evidence are in `docs/SECURITY.md` and `docs/qa/v29/security/`. Release-gate state comes from `server/scripts/v29_prod_readiness.py`, which prints JSON with one entry per control: PASS, FAIL_LOCAL or BLOCKED_EXTERNAL. Migration `v29sec0001` adds the `staff_mfa`, `mfa_recovery_codes`, `job_runs`, `ops_events` and `legal_holds` tables.

```
 browser ─TLS─► nginx (infra/nginx/hangyul.conf, generated from infra/csp.json: HSTS, per-app CSP, HTTP→HTTPS)
                 ├─ /            static Vite dist (marketing | student | agency | university)
                 └─ /api/ ─────► FastAPI ──► Postgres (data, job_runs, ops_events, advisory locks)
                                   │   ├──► Redis (rate limits, alert de-dup)
                                   │   ├──► clamd (INSTREAM over unix socket / TCP)
                                   │   └──► S3 / S3-compatible (private bucket, SSE, no public URLs)
                 python -m app.worker ──► same Postgres / clamd / S3 (systemd: infra/systemd/hangyul-worker.service)
```

**Worker** (`server/app/worker.py`) is a single-process scheduler loop backed by Postgres; no queue system is added.

- **Jobs:** `daily` (`app/jobs/daily.run`: freshness scan, task/deadline regeneration, rollups, writing SLA), `scan_retry` (5 min), `retention` (daily), `cleanup` (hourly: expired OTP challenges, stale pending MFA enrolments, export scratch files) and `notifications` (backlog report; in-app notifications are written inline and there is no push queue).
- **Windows and locking:** the window is `floor(now / interval)`. `job_runs` is unique per (job, window), and a session advisory lock per job means replicas never overlap.
- **Retries:** delivery is at-least-once and every job is idempotent. A failed run is retried with backoff up to `max_attempts`. Each failure is stored on the row and raised as a `JOB_FAILED` ops event.
- **CLI:** `--once` and `--job NAME` (forces the current window) for ops; `--list` lists the jobs.

**Object storage** (`app/core/storage.py`). The `Storage` protocol has two backends: `LocalStorage`, for development only (refused in production), and `S3Storage` (boto3, S3/MinIO).

- **Keys:** random object keys under `students/<id>/` or `attachments/<conv>/`, with an optional `HG_S3_KEY_PREFIX`.
- **Writes:** every PUT carries SSE (`AES256` or `aws:kms` + key id) and `Cache-Control: private, no-store`, with an octet-stream type and attachment disposition.
- **Reads:** the browser never gets an object URL. `/api/v1/files/{hmac-token}` authorises, then streams the bytes, so the V3 signed-URL model is unchanged.
- **Least privilege:** the IAM policy grants Put/Get/DeleteObject on `bucket/prefix*` only. The bucket policy template (deny insecure transport, deny unencrypted PUT, deny ACL changes) is `scripts/ops/s3-bucket-policy.json`. Turn on Block Public Access and versioning on the bucket.

**Scanner.** `ClamdScanner` implements the INSTREAM framing directly over sockets, with no dependency. The selection and the upload → scan → review state machine are described in SECURITY.md. `scan_bytes` converts a scanner failure into `ERROR` plus a `SCAN_ERROR` ops event, so an upload never fails because clamd is down. The file is simply not servable until it is scanned.

**Backups.** `scripts/ops/backup.sh` runs `pg_dump -Fc` and writes a sha256 and a JSON manifest. The manifest holds object-storage configuration metadata, never secrets. `scripts/ops/restore-test.sh` restores into `hangyul_restore_test_<ts>`, compares the alembic revision and key row counts with the manifest, reports the elapsed time and drops the database. Object bytes are covered by bucket versioning and replication, not by the dump.

**Monitoring.** `services/monitoring.record()` writes `ops_events` in its own session and never raises. It is hooked into:

- the API's unhandled-exception handler (5xx);
- worker failures;
- Toss transport/shape errors (`OPERATIONAL_ERROR_CODES` only; card refusals are not alerts);
- verification delivery failures;
- scan errors and detections;
- storage quarantine failures.

The optional webhook is rate-limited and sends a sanitised payload. `GET /api/v1/hq/ops/health` summarises failures, last job runs and the scan backlog. `app/core/logs.py` provides JSON logs in production and a redaction filter on every handler.

**Secret injection.** `config.SECRET_FIELDS` lists every credential setting. `FileSecretsSource` reads `<VAR>_FILE`, which takes priority over a plain variable and fails closed on a missing or empty file. `config.v29_production_violations` enforces the following at start-up:

- non-placeholder secrets;
- an https origin;
- s3 storage with SSE;
- the clamd scanner;
- an MFA key.

The same list drives the redaction filter and the bundle scan.

**CSP.** `infra/csp.json` holds common directives plus three features:

- `youtube`: frames from youtube-nocookie.com and youtube.com, images from i.ytimg.com (marketing, student);
- `turnstile`: challenges.cloudflare.com (marketing, student);
- `toss`: js/api/`*.tosspayments.com` (student only).

The consoles get only `'self'`. The API is same-origin under `/api`, so `connect-src 'self'` is enough; set `api_origin` if it moves. Fonts (Pretendard) are bundled, so no Google Fonts are needed. University photos are served from `/media` on the same origin.

**Retention** (`services/retention.py`). The policy file `app/data/retention_policy.json` has 10 record types, and every period is null until counsel sets it. `run(dry_run)` reports in-scope, eligible, held and affected counts per policy. Enforcement runs through the worker and skips null periods. Storage objects are deleted before their rows. Legal holds (USER or DOCUMENT) block deletion, and every run writes a `retention.run` audit row.

`anonymize_account` implements the DELETE data request:

- documents and objects deleted;
- sessions, MFA and OTP rows removed;
- PII replaced;
- the request marked COMPLETED.

It is exposed as `POST /hq/data-requests/{id}/complete-deletion`, which needs a super admin and an MFA step-up.
