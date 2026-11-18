# Hangyul Univ — Launch Report

> **Current as of 2026-11-18 (launch pass on top of commit `fd2f4ba7`).** This is the current-state launch report. It replaces the
> 20,000-line version-by-version record (V1–V32), which remains in git history
> (`git log -- docs/REPORT.md`; last full version at commit `fd2f4ba7`). Everything in this file is meant to be true
> today; when something changes, edit the statement instead of appending a dated section.
> Document map: [README.md](README.md).

## 1. Current product state

**What it is.** Hangyul Univ helps an international student prepare a stronger application to the Korean university
they want and looks after the whole process, from the first question to arrival.

**Service model.** Student → Hangyul Univ → Korean university. Hangyul Univ **directly operates** consultation,
university recommendation, application preparation, document review, application management, essay review,
visa-document preparation and arrival/settlement support. There is no external study-abroad agency in the service.
The **university makes the final admission decision**; the immigration authority decides the visa.

**One-paragraph verdict.** The four web products are deployed and reachable, the API answers through a tunnel to a
non-production host, and the product code is release-candidate quality (V32 gate chain green on 2026-11-04, brand and
copy work since). It is **not ready for a public launch**: there is no durable production API host, the connected
database has no programme catalogue, payments are in test mode, legal identity fields and counsel review are open, no
language has been reviewed by a human, and iOS is not built. See §9.

| Product | Domain | Code | State |
|---|---|---|---|
| Marketing | `https://univ.talkhangyul.com` | `apps/marketing-web` | Live; discovery works without the API |
| Student | `https://app.univ.talkhangyul.com` | `apps/student-web` | Live; API reachable |
| Hangyul internal Operations/Admin | `https://admin.univ.talkhangyul.com` | `apps/agency-web` | Live; API reachable |
| University console | `https://partner.univ.talkhangyul.com` | `apps/university-web` | Live; API reachable |
| Student native | — | `apps/student-mobile` | Android to be rebuilt from current source; iOS not built |
| Operations/Admin native | — | `apps/agency-mobile` | same |
| University native | — | `apps/university-mobile` | same |
| API | same-origin `/api/v1` on each domain; health `/healthz` | `server/` (FastAPI) | Connected through a tunnel to a non-production host |

`agency-*` names in code (`apps/agency-web`, `@hangyul/agency-web`, `AGENCY_*` roles and models, `/agency/...` API
prefix) are historical internal names for the Operations/Admin product and are not being renamed
([ARCHITECTURE.md](ARCHITECTURE.md)).

## 2. Production architecture

```
Browser ─▶ Vercel (4 projects, one per web app; static dist, CSP/HSTS, /build-info.json)
             │ same-origin /api/:path*  (rewrite in apps/<app>/vercel.json)
             ▼
        ngrok tunnel https://enclosure-cork-purifier.ngrok-free.dev  (policy: only /api/* and /healthz)
             ▼
        FastAPI on the owner's machine ─▶ PostgreSQL 16 · Redis · local storage

Marketing discovery: static /data/public/*.json + Vercel Python function /api/public-fit (no API dependency)
```

Verified live on 2026-11-18:

| Check | Result |
|---|---|
| `/build-info.json` on all four domains | commit `fd2f4ba7` |
| `GET https://app.univ.talkhangyul.com/api/v1/auth/me` | 401 `{"detail":"Not authenticated"}` — API reached, auth enforced |
| `GET /api/v1/public/plans` | 200 with plan data |
| `GET /api/v1/universities`, `/programs` | 200, `total: 0` — catalogue empty in the connected database |
| `https://api.univ.talkhangyul.com` | resolves to Vercel IPs; TLS fails — no dedicated production API host |

**Truthful status of the API:** connected through a tunnel to a non-production host; a durable production API host
and a seeded catalogue are open launch blockers. It is not "unavailable" and not "fully live in production".

Stack: React 19 + Vite 7 (web), Expo SDK 57 / React Native 0.86 / expo-router (native), FastAPI + SQLAlchemy 2 +
Alembic on PostgreSQL 16, Redis, npm workspaces. Per-app `vercel.json` is generated from `infra/csp.json`
(`scripts/ops/gen-vercel.mjs`). The intended production stack (HTTPS origin, private S3 with SSE, ClamAV, worker,
secret files, backups) is implemented and tested in code but not provisioned. Operations: [DEPLOYMENT.md](DEPLOYMENT.md).

When the API cannot be reached, the three signed-in apps and the native apps show the localized
service-unavailable state with Retry — never fabricated data or a transport error.

## 3. Current service model

**Plans** (one-time, USD, never a subscription; catalogue `2026-10-30.v29`; source of truth
`packages/types/src/plans.ts` → `shared/plans.json`; contract in [SERVICE_CATALOG.md](SERVICE_CATALOG.md)):

| | Basic $179 | All-in-One $349 (core) | Premium $599 |
|---|---|---|---|
| Consultation support window | 1 day | 3 days | contracted term |
| Universities recommended | up to 3 | up to 5 | up to 7 |
| Applications managed | — | up to 2 | up to 3 |
| Document review | checklist | review + correction guidance | intensive |
| Essay editing | — | 2 rounds | no round limit within the contracted documents and schedule |
| Visa | procedure guidance | document preparation | documents + key dates |
| Arrival | — | basic living information | D-30 pre-arrival to 30 days after arrival |

- Free without purchase: directory search, saved universities, Quick Fit.
- Additional services (extra managed application, extra edit round, mock interview, dormitory application support,
  airport pickup, extra settlement support) are proposed by the team at an exact price, approved by the student and
  **paid before anything is granted**. Upgrades are refused until the owner sets a pricing rule.
- Every purchase snapshots its catalogue into a `ServiceEngagement`; usage is derived from work records; "no limit"
  is always scoped by document type, managed application and term.
- **Admission language:** the goal is to maximise the student's chance through stronger strategy and preparation.
  The product never promises admission and shows no probabilities, percentages or scores. Fit results are four
  groups with reasons ([ADMISSIONS.md](ADMISSIONS.md)).
- **Hangyul never collects tuition** — the student pays the university in their own name.
- Students see one identity, "한귤 유니브 상담팀 / Hangyul Univ team"; the real author stays on every row for audit.
- Student UX rule: the next action comes before the internal stage.

**Payments.** Toss Payments in **test mode**. A plan is bought through Hangyul's own card form: order → card number
and expiry → server relays to Toss key-in on the foreign-card merchant `bill_talkoab1` (USD), with an order-derived
idempotency key and attempt limits. Card data is not stored (only issuer and masked number if the student saves the
card). Live USD checkout is off (`live_usd_checkout_enabled: false`); a student who reaches the pay button is told
so and is never charged in another currency. Native apps hand checkout to the web. Open: live keys, the
overseas-card/USD contract, the refund schedule, the upgrade rule.

## 4. Current data coverage

| Data | Verified / present | Incomplete |
|---|---|---|
| Institution directory | **425** institutions (대학알리미, Study in Korea, Wikidata), every field sourced; 425 public detail pages | — |
| Admission guides → checklists | **8** universities (bachelor's, 2027 Spring), from official guides | All other universities show "guide under review" and no checklist |
| Language rules | 963 rule rows; **43** institutions with verified rules | **176** institutions "needs checking" |
| Scholarships | **461** schemes for 24 universities, as published | Other universities: not researched, shown as unknown (never "none") |
| GKS participation | 98 institutions (NIIED lists) | — |
| Visa routes | 41 routes, 14 countries × visa type, sourced | Per-route open items for a human reviewer |
| University photographs | **166 / 425** with an own campus photograph (462 photos, full rights metadata) | **259** use a designed identity composition |
| Official films | 158 verified | — |
| Programme catalogue (programmes, fees, deadlines) | **None.** No sample rows exist anywhere | Empty in the connected database (`total: 0`) |
| Members | 0 users in the reference seed; synthetic fixtures only in test/e2e databases | — |

Two different data sets are live: the **public site** reads a static export of the reference data (so it shows 425
universities and Quick Fit works); the **connected API database** is unseeded for the catalogue endpoints.
Seeding it is an open task. Public rule: a public surface renders only what can be verified; unverified fields are blank.

## 5. Current UI/UX state

- **Marketing:** Koreanasha-derived layout on the Eduan chassis; orange horizontal logo on the light header; photo-first
  directory with search, region and type filters and a map; university pages lead with verified facts; Quick Fit in four
  groups; pricing with comparison and the purchase notes; compact mobile header and hero (post-V32 polish).
- **Student:** warm guided surface; journey line; one photo-led next action; lanes "내가 할 일 · 한귤이 하는 일 · 대학이
  확인하는 일"; documents as rows; services shows what is active and who acts next before the plan matrix.
- **Operations/Admin:** white canvas, warm-paper navigation; Today (count = rows) with a pipeline rail; student
  workspace with one progress line and the plan panel; one issue label per document; every count opens its rows.
- **University:** home leads with applicants to decide, then pipeline, then outcomes; insights answer named
  questions with denominators and a small-sample rule.
- **Shared system:** one warm neutral ramp; tangerine only for the primary action, current item and focus; one
  action shape and four button roles; one canonical select (own listbox, popover on desktop, bottom sheet on phones —
  no native `<select>`); 44 px phone targets; visible focus everywhere.
- **Brand:** marketing light header = orange horizontal logo; dark surfaces = ivory; product shells on light = black
  horizontal; app icons and favicons = orange symbol on ivory; OG card `hangyul-univ-og-v1.jpg` in static HTML
  ([BRAND_AND_MEDIA.md](BRAND_AND_MEDIA.md)).
- **Design Preview mode (added in this pass):** build flag `VITE_ENABLE_DESIGN_PREVIEW`; "Preview without signing
  in" under the Student / Operations / University logins and "Preview without paying" under paywalls; synthetic
  fixtures only, read-only, no auth session, no private API calls, a small "Design Preview" indicator. Must be off
  before public launch; a release gate checks it.
- **Native:** all three apps share the web model; emulator runs covered sign-in and home screens in Korean, English
  and Thai; deeper native flows were not driven. Full essay editing is web-only.
- **Not done:** usability sessions with real students; a human screen-reader walk-through.

Last measured lab figures (V26–V31, on a saturated host, not re-measured since): consoles LCP 112–552 ms, marketing
492–680 ms, CLS ≤ 0.08; Operations Today at 1,071 students 0.3–0.6 s.

## 6. Current security

Implemented and tested in the repository ([SECURITY.md](SECURITY.md)):

- Argon2id passwords; 15-minute in-memory access tokens; hashed, rotating refresh tokens with family revocation on
  reuse; httpOnly first-party cookie via the same-origin `/api` rewrite.
- Four-step verified registration (e-mail code + SMS code + Turnstile + granular consents); Redis rate limits;
  progressive login throttling.
- One role per tenant (`AGENCY_ADMIN` = Hangyul operations, `UNIVERSITY_ADMIN`); server-side tenant isolation with a
  404 policy; universities see only applications submitted to them and documents shared for those.
- Uploads: MIME sniffing, size limit, clamd scan before review, private storage, signed 5-minute URLs, audit on
  every access. Staff TOTP MFA. Secrets via `*_FILE`. CSP/HSTS generated from one source. Retention engine,
  backup/restore drill, monitoring events.
- `HG_ENV` defaults to production and fails closed.
- Test sign-in and the paid-state bypass were removed in V32 (commit `dd552834`): no test sign-in, persona picker,
  bypass endpoint or build switch exists; the leak gate scans source, current docs and production bundles.
- Design Preview is client-side only and has no server counterpart.

Not true of the currently connected environment: the API behind the tunnel runs a **development configuration on a
personal machine**, so production-only enforcement (real secrets, S3, ClamAV, mandatory staff MFA, TLS at the API
origin) is not in force there. Open: production host, independent penetration test, retention periods from counsel,
off-host backups. Internal threat model and evidence: `docs/qa/v29/security/`.

## 7. Current localization

Detail and glossary: [LOCALIZATION.md](LOCALIZATION.md).

| Question | Answer |
|---|---|
| Bundles in the repository | 56 |
| Selectable on Marketing | the 33 market locales |
| Selectable in the Student app (web and native) | English + 20: ar, bn, fil, hi, id, ja, kk, ko, ky, mn, my, ne, ru, th, tr, ur, uz, vi, zh-Hans, zh-Hant |
| Selectable in the Operations/Admin and University consoles | ko, en (per the committed `console-locales.ts`) |
| Machine / synthetic review | every market locale: machine translation plus a synthetic (AI-model) native-level review, V32 status `SYNTHETIC_NATIVE_REVIEWED_V32` |
| Human native review | **none, for any locale** |

V32 measured 9,126 active keys of 13,556; 3,668 customer-critical; 48,606 strings changed in 34 locales. Record:
`docs/qa/v32/l10n/LANGUAGE_SIGNOFF.md`. Unverified: whether regenerating `console-locales.ts` after the V32 console
translations would admit more console languages.

## 8. Final launch QA

<!-- LAUNCH-QA:START -->

Launch-readiness pass of 2026-11-18. Gate chain: `npm run qa:launch` (`scripts/qa/launch-final/chain.sh`); ledger and
logs in `docs/qa/launch-final/after/logs/`. Everything below ran against the four production builds served locally;
the signed-in screens ran in Design Preview (synthetic fixtures), sign-up with the identity API mocked at the network
layer. **What this pass did not run is listed under the table and is not covered by any PASS here.**

| Area | Result | Evidence |
|---|---|---|
| Route inventory | 120 routes (12 public + 108 signed-in) across the four web products | [`ROUTE_INVENTORY.md`](qa/launch-final/ROUTE_INVENTORY.md) |
| Visual defects | 25 found, 25 fixed (most in shared tokens/primitives); 2 left open for a person | [`VISUAL_DEFECT_MATRIX.md`](qa/launch-final/VISUAL_DEFECT_MATRIX.md) |
| Responsive, 12 viewports 320–1920 | PASS — 1,440 page loads, 0 page-level horizontal overflow | `after/matrix.json` |
| Zoom 125 / 150 / 200 % | PASS — 360 loads each, 0 overflow | `after/matrix-z125.json`, `-z150`, `-z200` |
| Languages ko · vi · ja · zh-Hans · ru · ar (Marketing + Student, 320 / 390 / 1440) | PASS — 129 loads each, 0 overflow; Arabic renders `dir="rtl"` | `after/matrix-<lang>.json` |
| Dark-mode device | PASS — 240 loads; `color-scheme` stays light on every page | `after/matrix-dark.json` |
| Accessibility (axe WCAG 2.1 A/AA, 390 and 1280) | PASS — 240 page scans, 0 serious or critical violations | `after/a11y.json` |
| Sign-up walk (account → verification pending / wrong code / verified → consent), 12 viewports, ko and ar | PASS — no overflow; code field and Verify stack on phones; controls ≥ 44 px | `after/signup/` |
| Design Preview isolation | PASS — Student, Operations, University: 0 network requests to `/api` on any of 108 preview screens; unpaid → paywall → "preview without paying" → entitled; Exit clears state | `after/preview-isolation.json` |
| Design Preview release gate | PASS — one switch, no network code in the transport, fixture hygiene; bundles built with the flag off contain no preview code | `after/logs/08-…`, `21-…` |
| Static gates | PASS — docs gates and links, leak scan (source and bundles), i18n, tokens current, typecheck (7 workspaces), 332 web/package unit tests, four production builds | `after/logs/ledger.txt` |
| Production smoke (4 domains) | see `after/production-smoke.json` — build-info commit, `/api` closed to anonymous access, headers, no overflow, preview entry present | `after/production-smoke.json` |

**Not run in this pass (no PASS is claimed for these):**

- **API test suite, API lint and seeded end-to-end tests** (`npm run qa:v32` steps 05, 06, 10–14): the QA machine had no
  Python ≥ 3.11, PostgreSQL or Docker. The last recorded full run is the V32 one below.
- **Real-account journeys against the connected API** (student login → application → documents → messages; staff and
  university logins): no credentials were available, and a real sign-up sends live e-mail and SMS codes. The connected
  API was verified only from outside: it answers, and it refuses anonymous access to private endpoints.
- **Native apps**: no Android/iOS toolchain. The shared changes that reach them (sign-up progress indicator, app name
  "Hangyul Operations", translated strings) typecheck and pass the student-mobile unit tests; nothing was built or run
  on a device.
- **Human review**: no native-speaker review of the 1,820 strings rewritten in 53 locales (machine-translated, like
  the rest of each bundle); no human screen-reader walk-through.

<!-- LAUNCH-QA:END -->

Last full gate run on record (V32, 2026-11-04, `QA_V32_NATIVE=1 npm run qa:v32`): all 17 steps PASS — leak (source
and bundles), data-clean, i18n over 56 bundles, typecheck (7 workspaces), API lint, 619 API tests, web unit suites,
four production builds, marketing serverless 23/23, selects 7/7, crawl of every route at 1440 and 390 with 0
findings, axe WCAG 2.1 AA with 0 serious/critical, critical E2E 9/9, native sign-up against the e2e API, teardown,
three Expo production exports. `npm run release:check` (2026-10-31): PASS 38 · FAIL_LOCAL 0 · BLOCKED_EXTERNAL 18 →
NOT_READY_FOR_PRODUCTION. Neither has been re-run on the current tree for this report.

## 9. Current known blockers

Full list with owners: [ROADMAP.md](ROADMAP.md).

| # | Blocker | Type |
|---|---|---|
| 1 | No durable production API host (tunnel to a personal machine; `api.` subdomain fails TLS) | Infrastructure |
| 2 | Connected database not seeded; no real programme catalogue | Data |
| 3 | Design Preview flag is ON for owner review (`build.env` in three `vercel.json`); must be removed before public launch (`npm run release:preview-gate -- --launch --bundles off`) | Release |
| 4 | Payments in Toss test mode; refund schedule and upgrade rule undecided | Owner / Toss |
| 5 | Production SendGrid / Twilio / Turnstile credentials and live delivery check | Owner |
| 6 | Legal: ten company identity fields, counsel review, retention periods | Owner / counsel |
| 7 | Independent penetration test | Owner |
| 8 | iOS not built; Android to be rebuilt with the Play upload key | Owner |
| 9 | No human native-speaker review of any language; no usability sessions | People |
| 11 | Privacy policy and terms still describe a "partner agency" receiving data (10 keys under `marketing.v12.privacy.*` / `v12.terms.*`, all locales) — legal text was not edited; needs counsel sign-off to match the direct-operation model | Owner / counsel |
| 12 | API tests, seeded E2E, real-account journeys and native builds were not run in the launch pass (see §8) | Engineering |
| 10 | 176 institutions without verified rules; 259 without an own photograph; no recorded university agreement | Data / partnerships |

Could not be verified from this workspace: whether SendGrid/Twilio credentials are now configured on the connected
host (the last two commits add production message copy and the Twilio SDK; the last recorded live check was BLOCKED);
current Toss configuration on the connected host; current Android build state.

## 10. Changelog summary

One line per pass; detail is in git history (`git log`, and earlier versions of this file).

| Version | Date | Summary |
|---|---|---|
| V1–V2 | 2026-09-28 | First audit of all web products; redesign strategy and design system v2 |
| V3 | 2026-09-29 | Independent audit; university SSO (OIDC); stakeholder review |
| V4 | 2026-09-29 | Product excellence pass; one application state map for all products |
| V5 | 2026-09-29 | Admission success: strategy, dossier, writing review, submission, visa routes, arrival |
| V6 | 2026-10-01 | Visual and product pass; connector completion; wider locale set |
| V7 | 2026-10 | Template-first rebuild: Eduan (marketing), YNEX (consoles) |
| V8 | 2026-10-09 | Simplification; translation status taxonomy; RTL QA |
| V9 | 2026-10-14 | Service operating system: waiting-on model, student-app locale gate, visa/arrival revalidation |
| V10 | 2026-10-16 | Koreanasha-based marketing site; public site student-only, Login as the account action |
| V11 | 2026-10 | Complexity reduction; owner copy fidelity pinned |
| V12 | 2026-10-17 | Production-likeness: generated legal pages, 425-institution directory, nothing unverifiable on public pages |
| V13 | 2026-10 | Visual hierarchy; country simulations; scale simulations |
| V14 | 2026-10-18 | Media licence audit (two-tier rule, `/credits` retired); 32-market localization; language URLs |
| V15 | 2026-10-19 | Commercial model with one source of truth; entitlements; pricing UX |
| V16–V17 | 2026-10 | Student journey gates; plans priced in USD; university enrichment |
| V18 | 2026-10 | Local API port moved to 8001; Myanmar market; honest locale coverage measurement |
| V19 | 2026-10-20 | Navigation correctness and zero-defect pass; error matrix, click map |
| V20 | 2026-10 | Region photography; button matrix; university content audit |
| V21 | 2026-10-21 | Toss foreign-card key-in checkout on Hangyul's own card form |
| V22 | 2026-10-23 | Verified four-step registration; one role per tenant; white consoles; legal research |
| V23 | 2026-10 | Server fails closed; social footer; 425/425 intentional directory visuals; priority-surface localization |
| V24 | 2026-10 | University media coverage and photo review |
| V25 | 2026-10-27 | Photo-first directory (166/425 own photographs); one action shape; Android builds for three apps |
| V26 | 2026-10-28 | Forensic root-cause pass (29 causes, each gated); deep links; scale and performance; repository cleanup |
| V27 | 2026-10-29 | Quick Fit in four honest groups; verified scholarships and language rules; checklists only from verified guides |
| V28 | 2026-10-29 | Polish; names follow the reader's language; A/B keys complete in all offered locales |
| V29 | 2026-10-30 | Owner service contract ($179 / $349 / $599), engagements, add-ons; MFA, clamd, S3, retention, backups; `release:check` |
| V30 | 2026-11-01 | Visual integrity: marquee hitboxes, `FilterSelect`, route-inventory crawl |
| V31 | 2026-11-01 | Design-system neutral ramp, pipeline rail, pricing tail, language quality pass |
| P0 hotfix | 2026-11-03 | Public discovery without the API: static export + Vercel fit function (`78d61c8b`, `df215089`, `b6f3c834`) |
| V32 | 2026-11-04 | Release candidate: test access removed, seed split, one select, service-unavailable state, every locale re-reviewed (`dd552834`) |
| post-V32 | 2026-11-04 | Mobile hero and header polish (`65989b12`, `18a49ee8`, `0925764c`) |
| post-V32 | 2026-11-09 | English marketing copy and FAQ (`61259db6`) |
| post-V32 | 2026-11-17 | Final Hangyul Univ branding and social metadata; orange branding on web and Android (`bc6be153`, `50e4f14c`) |
| post-V32 | 2026-11-18 | Local stack reachable through ngrok; Vercel `/api` routed to the tunnel (`9a306bee`, `72cfca1c`) |
| post-V32 | 2026-11-18 | Twilio SDK declared; production copy for verification e-mail and SMS (`47c8fec5`, `fd2f4ba7`) |
| Launch pass | 2026-11-18 | Design Preview mode; docs consolidated to 19 root files; historical QA output removed; this report rewritten |
