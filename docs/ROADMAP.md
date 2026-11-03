# Roadmap

> **How to read this file (V26, maintained in V29).** The "Current backlog" section is the only maintained list; it names what is
> genuinely open and points at `docs/REPORT.md` §0.6 (launch readiness) for the measured state. Everything below it is a
> **dated snapshot** of an earlier pass (V3, V9, V10, V12, V14, V15), kept as a record; items those snapshots listed that
> have since shipped were removed in V26, and their numbers (endpoint, table, test counts) are of their time.

## Current backlog (V29 — 2026-10-30; measured state: `npm run release:check`, REPORT §0)

Everything below is **external** — locally solvable V29 work is done or tracked by `release:check` as FAIL_LOCAL.
In the order they block launch:

- **Payments go live.** Toss TEST mode; plans and add-ons are bought by foreign-card key-in on `bill_talkoab1`. Open: live keys, the overseas-card / USD contract and card review; the **refund schedule** (`OWNER_POLICY_REQUIRED`) and the **upgrade pricing rule** (`UPGRADE_POLICY = OWNER_DECISION_REQUIRED` — upgrades are refused until it exists).
- **Identity delivery.** SendGrid / Twilio / Turnstile credentials are not on this host; `npm run qa:identity-live` stays BLOCKED.
- **Production infrastructure.** An HTTPS origin and TLS (HSTS/CSP config is ready: `infra/nginx/hangyul.conf`), a private S3-compatible bucket with SSE (adapter ready and verified against an S3 emulator), a secret manager (`*_FILE` injection ready), off-site backups (restore drill: RTO ≈ 12 s on the dev DB), a ClamAV host (verified with EICAR), the worker service (`infra/systemd/hangyul-worker.service`).
- **Counsel.** Privacy / terms / purchase consent / cross-border text, company identity fields, and the **retention periods** (engine ready, every period `OWNER_COUNSEL_REQUIRED`).
- **Independent penetration test** (internal threat model: `docs/qa/v29/security/THREAT_MODEL.md`).
- **Native stores.** iOS not built (Apple/EAS credentials); Android artifacts QA-signed — the Play upload key is an owner input.
- **People.** Human native-speaker review of 34 locales (`SYNTHETIC_NATIVE_REVIEWED` only); usability rounds.
- **University data and media.** Managed-application set = 8 universities (bachelor's, 2027 Spring); 43 institutions with verified language rules; 176 still "needs checking" because their official rules are unpublished in an allowed form or not yet researched; 259 / 425 without an own campus photograph (`OWNER_AUTHORISED` photography only).

---

## V3 snapshot (2026-09-29) — "Implemented now" as recorded then

*Dated. Counts (94 endpoints, 69 tables, 24/93/12 tests, 46 locales) are V3 figures; today: 117 tables, 33 markets / 56 bundles.*


**Platform**
- npm-workspaces monorepo; one-command `npm run setup` and `npm run dev` (API + four web apps on fixed ports, labelled logs).
- FastAPI (94 endpoints, `/api/v1`), SQLAlchemy 2, Alembic, PostgreSQL 16; 69 tables; seeded demo dataset (215 users, 10 universities, 66 programs, 86 applications, 379 private documents, cohorts back to 2021).
- Auth: Argon2, 15-min JWT, rotating refresh tokens with reuse detection (20 s grace for page-reload races), per-console role gating, org switching.
- Tenant isolation enforced in the API for agencies (and per-counselor caseloads) and universities (submitted-only, shared-document-only); audited cross-tenant access for Hangyul staff.
- Private document storage: magic-byte MIME validation, size limits, malware-scan hook, 5-minute HMAC-signed download URLs, access audit.
- Source registry (50 research-backed sources), freshness review queue, daily job (freshness scan, intake closing, task regeneration, analytics rollups).

**Student**
- Progressive 7-step onboarding with autosave and transparent GPA normalization.
- Two-stage explainable matching (hard eligibility + named weighted factors; no probabilities), comparison, saved universities.
- Program/university search with filters, university detail with sources and freshness, partner benefits and conditional guarantee only when contract-backed.
- Applications with state machine, readiness %, generated document checklists with document reuse; document vault with time-versioned apostille/consular routing; collaborative essay review with suggestions, versions and diffs.
- Tasks & deadlines engine, messaging, notifications (i18n keys), visa center (D-2/D-4 rules incl. nationality-specific), housing, arrival checklist, scholarships by kind, services with demo checkout → automatic agency assignment, support tickets, privacy (consents, export/deletion requests).

**Agency console**
- Dashboard + performance analytics with definitions and small-sample honesty, students table with bulk actions, 21-stage kanban pipeline, student workspace, task queues, document review queue with shortcuts, essay review editor, consultations, messaging with internal notes/mentions/task creation, deadlines, catalog, payments, team, templates, audit; Hangyul ops tools (agencies, assignment override with explainable scores, sources & freshness).

**University console**
- Executive dashboard with URL-persisted filters, 10-stage lifecycle funnel, applicants & application decisions, pipeline, offers/yield, programs & intakes, admission-rules editor (first-party verified), shared documents, Hangyul Partner Scholarship pools & awards, partner agencies, cohorts/retention/graduation/early warnings, analytics explorer, exports, partnership economics (demo), team.

**Marketing** — editorial site, public search and university pages, guides from the content API (Markdown, sources, translation status), country guides with live legalization routes, trust & freshness page.

**Mobile** — three Expo (SDK 57) native apps sharing `@hangyul/mobile-ui`, API client, auth, i18n and tokens; all bundle for Android.

**Quality** — 24 backend tests (security, tenancy, full lifecycle, rules), 93 web unit tests, 12 Playwright E2E tests (15-step journey, tenancy, phone layouts), visual QA at 390/768/1440 px (0 overflow issues across 204 views), RTL and dark-mode checks.

**i18n** — *(historical V3 line; today: 56 bundles, 33 markets, REPORT §0.5)* 46 locales; en (source) + ko (reviewed) complete across all apps; vi, zh-Hans, zh-Hant, ja, uz, mn, ru, ne, my complete for all student-facing namespaces (machine draft); 35 more locales have shared vocabulary and the marketing site (machine draft); everything else falls back to English.

### Next (V3 list, pruned in V26)

- **Legal & operational verification** (see RESEARCH.md): agency licensing, the MOE university–agency standard agreement, recruitment-fee/commission legality, PIPA cross-border consent, data-retention schedule, terms/privacy text.
- **Data**: replace DEMO catalog values with verified figures via university partners (the admission-rules editor already stamps first-party data) and official public data; re-verify all apostille rows against the HCCH status table; import MOE certification tiers.
- **Integrations**: Toss **live** keys and contracts (test-mode checkout shipped in V21); S3/MinIO storage with SSE; ClamAV scanning; email/push/SMS notification adapters (Expo push, Kakao); calendar/video links for consultations; UwayApply/JinhakApply application export formats.
- **Translation QA**: professional review of machine-drafted locales starting with vi, zh-Hans, uz, mn, ne, my; translate consoles for partner-agency languages; localize remaining server-generated texts (checklist action sentences, essay pre-check lines).
- **Security hardening**: MFA for staff, CSP for web apps, secrets management, pen test (rate limiting and sign-up CAPTCHA shipped in V22).
- **Mobile**: store builds with an https API origin and the owner's upload key; iOS build (document upload, offline caching and local Android builds shipped — V18/V23/V25).
- **Background jobs**: move daily job and notification delivery to a Redis-backed queue with scheduling.

### Candidates from V8 (dated — evidence needed first)

*The sponsor link and bulk "select all matching" shipped in V9 and were removed from this list.*

- **External messaging channels** (WhatsApp, Zalo, KakaoTalk, email/SMS). The channel model exists; each needs provider credentials and an agreement, as shown on `/hq/readiness`.
- **Scheduled exports** (university): needs a scheduled-jobs worker; the button is shown disabled.
- **Human translation review**, starting with the synthetic-reviewed critical locales. No locale is HUMAN_REVIEWED yet.
- **Human usability rounds** per `docs/research/v9-validation-protocols.md` (the V8 protocols moved to `docs/research/archive/`). None have run.

### Later (V3 list)

- AI-assisted essay feedback (suggestion-only, voice-preserving) behind the existing pre-check interface, with model/version disclosure.
- Predictive admission likelihood **only** once Hangyul has enough genuine outcomes — every estimate must show sample size, model version, confidence and data freshness (`match_snapshots` already store the training trail).
- University SIS integrations for attendance, standing and retention feeds; alumni/career outcome tracking.
- Partner marketplace economics: automated commission/guarantee reconciliation, quota forecasting, scholarship-pool optimization.
- Agency workload balancing across regions and SLA-based routing; agency quality scores built on audited student outcomes.
- Public API for universities and data-sharing agreements.

## V9 snapshot (2026-10-14) — implemented and what was still needed

**Implemented in V9:** language routes, one money plan + refund path, sponsor view, document visibility, one work queue + seven-value waiting-on, team weights/availability/leave, templates with scopes and language groups, submissions pipeline, meetings record, process quality, HQ failure list + partner quality + launch-readiness classification, university review-and-advance, bulk "select all matching", questions-first analytics, rule impact preview, partnership value, member-leaves reassignment, visa/arrival data revalidated, localisation gate with 20 locales translated (see REPORT §63), initial JS −25 %, labelled console sidebar, adversarial recovery suite and a scale check.

**Next (needs the outside world, REPORT §64):** human usability rounds and human translation review (`docs/research/v9-validation-protocols.md`); legal approvals (`docs/LEGAL_DEPENDENCIES.md`); real prices and payment provider; S3 + malware scan + retention job; email/SMS/WhatsApp/Zalo/Kakao providers; OCR; flight data; housing inventory; verified catalogue data from universities; university/rail agreements (and watching NIIED one-stop, FIMS, MOE standard agreement, MOJ H2-2026 agency fields).

**Engineering candidates:** a re-run job for dated visa rule changes (Kyrgyzstan 2027-01-01 documents/language thresholds still need the loader run); translating the remaining ~35 locales through the same pipeline; scheduled exports worker; per-language marketing copy review; agency mobile parity for the V9 queue.

## V10 snapshot (2026-10-16) — implemented and what was still needed

**Implemented in V10:** `template-koreanasha` became the marketing site's visual and structural foundation
through a new `packages/koreanasha-ui` (floating pill header; full-viewport hero with one hand-made crop per
breakpoint; band rhythm; card / media-row / marquee / FAQ anatomy — all re-themed to Hangyul and layered over the
shared Eduan chassis, because Koreanasha *is* a customised Eduan build). The home page was recomposed into nine
movements and gained a university band, four photographed student services and eight answered student questions.
The **BI-kit lockup replaced the CSS-typeset wordmark in all four products**, with a derived light-ink variant for
dark sidebars. The public site became student-only: no B2B in the navigation or the footer columns, no public
application form, no "Apply now", and **Login** as the primary account action — backed by a new non-rotating
`GET /auth/session-hint`, `studentAction()` return paths, `safeNext()` against open redirects, and `carryQuery()`
so the create-an-account hop keeps both the destination and the quick-check prefill. Phones and tablets get the
service rows as a horizontal swipe instead of a stack. Evidence: REPORT §65–72, `docs/qa/v10/`.

**Found and fixed in V10 beyond the brief:** the public university endpoint served the inactive
development-fixture programme to anonymous visitors (it sorted first and became the page's `<h1>`) — fixed with a
regression test; nine heading-outline defects across the public pages; the floating DEV chip covering content; a
counselor's deadline panel written in the student's voice; two RTL defects in the new layer.

**Next, carried forward unchanged from V9 (REPORT §64, §72):** human usability rounds; human translation review;
legal approvals; real prices and a payment provider; S3 + malware scanning + retention; messaging providers;
OCR; flight data; housing inventory; verified catalogue data; university and rail agreements.

**Also done in V10 (console pass, Parts 11–16):** the operating models were re-examined against the brief's
questions and kept; the detail layer was repaired — the YNEX `outline: 0 !important` that removed the keyboard
focus indicator from **every link and button in all three consoles**, sticky table headers that were declared
but trapped in a scroll container, an audience toggle whose selected state never rendered (`aria-checked`
markup styled as `aria-pressed`), a crushed Essays column at ~992 px, two badges overflowing fixed columns, a
funnel table scrolling sideways at 390, and four heading-outline jumps. Plus a pre-existing non-determinism in
`caseload.build_rows` that let the caseload list and the student workspace name different universities for the
same next action.

**Also done in V10 (localization, Part 34):** the 69 new marketing strings translated into all 21 locales that
pass the V9 student gate — including the five the brief names (vi, ne, my, uz, ar) — verified at 0 raw keys,
0 overflow, correct `lang`/`dir`.

**New in V10's own backlog** *(the 24-locale item was superseded by the 33-market model, REPORT §0.5; the console re-measure happened in V15 and V25)*:
- **Hangyul's own photography.** Every licensed image in the library is `people: none`/`people: distant`; both
  competitors lead with faces and we lead with a place. Needs commissioned photography and student releases.
- **Company identity in the footer.** The Korean trust-signal block (registration number, address, phone) is
  built and deliberately empty until real details are supplied.

## V12 snapshot (2026-10-17) — what it left

V12 rebuilt public discovery on real data and made the legal documents real. What it leaves, in the order it
would pay off:

- **Set the ten legal fields.** `apps/marketing-web/src/lib/legal/entity.ts`. Nothing else blocks `/privacy` and
  `/terms` from being production-ready; the omitted sections render themselves once the values exist, and
  `npm run qa:legal` says which are still missing. This is the single highest-value item in this document.
- **Approve a retention schedule and a refund matrix.** Both are published-shaped and unpublishable: the policy
  states the rule it follows and the four statutory commerce periods, and the terms state the refund routes the
  product implements. Neither invents a number (REPORT §92.1).
- **Configure a real malware scanner.** Privacy §8 claims uploads are scanned; production runs a no-op
  (`LEGAL_DEPENDENCIES` L15). The claim should be made true rather than softened.
- **Licensed photography for the universities applicants actually consider.** *(166 / 425 after V25.)* The directory showed 425
  institutions and no images. "Elegant restraint" and "we had no pictures" look identical from outside
  (REPORT §94.1); fifty licensed campus photographs would change how the directory feels more than any code.
- **Dormitory, English-taught and scholarship availability per institution.** Named in the brief as enrichment,
  absent because no consulted source publishes them verifiably. The field shapes exist; the data does not.
- **Translate the directory and the legal documents.** 212 keys each in ko and en; the other 52 locales fall back
  to English, the same state the homepage has been in since V11.
- **Widen the leak scan's route list.** It covers 72 routes and the product has considerably more. The only real
  leak this product ever had arrived through a stored row on a signed-in queue, and the route list is what
  stands between the next one and a customer (REPORT §94.6).

## V14 snapshot (2026-10-18) — artefacts

| Document | What it answers |
|---|---|
| `REPORT.md` §§105–116 | the pass itself: continuity, media, localization, URL locale, photography, mobile, motion, marquee, log, validation, readiness, hostile audit |
| `MEDIA_LICENSE_AUDIT.md` | every photograph classified; why 13 were retired; what commissioned photography would unblock |
| `qa/v14/CREST_AUDIT.md` | all 23 university marks measured; the Yonsei rebuild; the UNIST exception |
| `qa/v14/LOCALE_MATRIX.md` | the 31 markets, the missing 32nd, the three mislabelled flag files, coverage per namespace |
| `qa/v14/MOTION_AUDIT.md` | every piece of motion, its purpose, trigger, duration and reduced-motion behaviour |
| `qa/v14/locales/<locale>.md` | per-market synthetic review (31 files) — `SYNTHETIC_REVIEWED`, never human |
| `qa/v14/{before,after}/` | 111 shots each, nine widths |
| `qa/v14/locales/shots/` | 124 per-market screenshots |
| `qa/v14/batches/` | every translation batch merged, replayable through `scripts/i18n/v14-merge.mjs` |

New gates: **`npm run qa:v14`** runs all eight — media · flags · crests · marquee · marquee-details · footer ·
locale-url · locales. Each is also individually invocable (`npm run qa:marquee`, `npm run qa:locales`, …).

The browser-driven ones take a `BASE` (or `MARKETING` / `STUDENT` / …) environment variable, which is how a
run targets a freshly-started instance or a `vite preview` of the production build rather than whichever dev
server happens to be on the default port. `qa:marquee` samples past a full animation cycle, so it takes about
a minute per width by design.

## V15 snapshot (2026-10-19) — artefacts

The pass that gave the product a commercial model and made the consoles able to operate it.

| Document | What it answers |
|---|---|
| `REPORT.md` §§117–122 | written **before** implementation: the business-model conflicts, the pricing strategy, the agency and university audits, the benchmark, and what would deliberately not be added |
| `REPORT.md` §§123–128 | the pass itself: implementation log, agency and university at scale, commercial validation, launch readiness, hostile audit |
| `qa/v15/COMPETITIVE_OPERATIONS_AUDIT.md` | ApplyBoard · IDP · Enroly · Cialfo · Leverage Edu · admissions-analytics practice — what to learn, what not to copy, and the nine decisions it actually changed |
| `qa/v15/AGENCY_AT_SCALE.md` | 274 cases for one counsellor: time to the urgent case, clicks to the action, scope pressure, deadlines, navigation |
| `qa/v15/UNIVERSITY_AT_SCALE.md` | 1,264 applications across five intakes: the Overview at every dataset size, and the height budget |
| `qa/v15/scale/v15-scale.json` | the raw measurements both documents are written from |
| `qa/v15/after/` | 65 screenshots, 13 surfaces × five widths (390 · 768 · 1024 · 1440 · 1728) |
| `qa/v15/batches/` | 18 translation batches, replayable through `scripts/i18n/v14-merge.mjs` |

New gates: **`npm run qa:v15`** runs all five — pricing · entitlements · handoff · agency · university.
`npm run plans:sync` regenerates `shared/plans.json`; `qa:pricing` fails if it is stale.

### What V15 deliberately left for later (dated)

- **Entitlement coverage.** Scope is enforced on two actions (an application leaving DRAFT, an essay review
  round). 추천 대학, 상담 시간 and 모의 면접 are counted and displayed but not refused — a counsellor can still
  over-deliver on three of the five counted keys.
- **Interview and settlement workflows.** The allowances exist and are visible to both sides; the progressive
  activation by journey stage that brief Parts 13–14 describe was not built.
- **Insights is still more than four visuals.** The four the brief names are all present; the manager's
  Outcomes tab carries a cohort funnel, nationality cohort and revenue besides.
- **English metric definitions on a Korean console.** `agency_performance` and the V5 outcome metrics return
  their `definition` strings in English only. Pre-existing (V5/V9), visible on every non-English Insights
  page, and not introduced by this pass — the one panel V15 added reads its definition from i18n instead.
- **A refund policy.** The business plan lists it as work still to do; `release:check` still blocks on it.
