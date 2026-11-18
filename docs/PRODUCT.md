# Hangyul Univ — Product

> Hangyul Univ helps an international student prepare a stronger application to the Korean university they want,
> and looks after the whole process — from the first question to arrival.

## What it is

**Student → Hangyul Univ → Korean university.**

| Party | Role |
|---|---|
| **Student** | Prepares and applies. Wants to get into the university they chose and not make a mistake on the way. |
| **Hangyul Univ** | **Directly operates** the service: consultation, university recommendation, application preparation, document review, application management, essay review, visa-document preparation, arrival and settlement support. One team, seen by the student as "한귤 유니브 상담팀 / Hangyul Univ team". |
| **Korean university** | Reviews applicants and **makes the admission decision**. Uses the University console to review applications shared with it. |

There is **no external study-abroad agency** between the student and Hangyul, and no external operating partner.
`apps/agency-web`, `apps/agency-mobile`, `@hangyul/agency-web`, `AGENCY_*` models and roles and the `/agency/...` API
prefix are historical internal names for **Hangyul's internal Operations/Admin product**; they are not being renamed.

## What the student buys

One of three **one-time plans in USD** (never a subscription): Basic $179, All-in-One $349 (core product), Premium
$599 — plus optional additional services the team proposes for that student at an exact price. Searching the
directory, saving universities and Quick Fit are free and need no purchase. Full contract: [SERVICE_CATALOG.md](SERVICE_CATALOG.md).

## How Hangyul improves the chance of admission

By raising the quality of the application, not by predicting the result: a realistic choice of universities, a
strategy per application, requirements read from the official guide, documents checked and correctly legalized,
essays reviewed by people, deadlines kept, and university requests answered quickly. Hangyul never says "guaranteed
admission" and never shows a probability, percentage or fake score. Detail: [ADMISSIONS.md](ADMISSIONS.md).

## Principles

1. **Honesty over hype.** No invented acceptance rates, rankings or outcomes; fit groups with reasons, never odds.
2. **Freshness is a feature.** Every time-sensitive fact carries `source_url`, `verified_at` and a verification status; unverified facts are left blank.
3. **Next action before internal stage.** The student sees the one thing to do now — or that nothing is needed — not the internal pipeline. Detailed stages belong to the Operations console.
4. **Automate the repetitive, keep people for judgment.** Checklists, reminders, legalization routing and first-pass checks are automated; document acceptance, essay approval and admission stay human.
5. **Tenant isolation is non-negotiable** and enforced server-side.
6. **Hangyul never collects tuition.** It is paid by the student, in their own name, to the university (MOE guidance).

## Products

| Product | Domain | Code | For | Core jobs |
|---|---|---|---|---|
| Marketing | `univ.talkhangyul.com` | `apps/marketing-web` | Prospective students | Directory of 425 Korean institutions, university pages, Quick Fit, plans, legal pages, sign in |
| Student | `app.univ.talkhangyul.com` | `apps/student-web`, `apps/student-mobile` | Students | Next action, matches, applications, document dossier, essays, visa, housing, arrival, services, messages |
| Operations/Admin (Hangyul internal) | `admin.univ.talkhangyul.com` | `apps/agency-web`, `apps/agency-mobile` | Hangyul operations team | Today queue, student workspace, document and essay review, application management, add-on offers, performance; HQ tools |
| University console | `partner.univ.talkhangyul.com` | `apps/university-web`, `apps/university-mobile` | University admissions staff | Applicants to decide, requests for documents, pipeline, outcomes and insights |

One FastAPI API (`server/`, `/api/v1`) serves all of them. Deployment state: [DEPLOYMENT.md](DEPLOYMENT.md).

## The student journey (service blueprint)

| Stage | Student sees | Hangyul team does | University does |
|---|---|---|---|
| 1. Find a university | Directory, university pages, Quick Fit groups, saved list | Publishes verified facts with sources | — |
| 2. Prepare | One next action; requirements for the chosen universities; document dossier; essay drafts | Consultation, recommendation, strategy, document review, legalization guidance, essay review | Publishes the admission guide |
| 3. Apply | Pre-submission check; guided submission on the university's own rail; proof of submission | Checks completeness and deadlines; records evidence | Receives the application |
| 4. Wait for the result | "The university is reviewing — nothing to do" or "one more document by <date>" | Tracks requests and results; answers the university | Reviews, requests documents, **decides** |
| 5. After admission | Enrollment, visa documents, dormitory, arrival checklist, first month | Visa-document preparation, schedule management, arrival support (by plan) | Issues the admission letter; enrolls |

Student-facing states are few (준비 중 · 지원 완료 · 대학 검토 중 · 추가 요청 있음 · 결과 발표); the nine internal stages
live in the Operations console ([WORKFLOWS.md](WORKFLOWS.md), [STATE_MAP.md](STATE_MAP.md)). Designer-oriented summary:
[한귤유니브_서비스기획서.md](한귤유니브_서비스기획서.md).

## Service plans

*V29 (2026-10-30): the owner-approved V29 service contract. Full definition, add-ons, service-period semantics,
versioning and UI placement: [`SERVICE_CATALOG.md`](SERVICE_CATALOG.md). Catalogue `2026-10-19.v15` (V15–V28:
30/60/90-minute consultations, All-in-One 1 edit round, Premium 2) is frozen for the buyers who bought under it.*

| | 베이직 Basic | 올인원 All-in-One | 프리미엄 Premium |
|---|--:|--:|--:|
| Price (one-time, USD) | **$179** | **$349** | **$599** |
| Consultation support | 1 day | 3 days | contracted service term |
| Follow-up | 1 consultation | responsible team | priority response |
| Universities recommended | up to 3 | up to 5 | up to 7 |
| Applications **managed** | — | up to 2 | up to 3 |
| Document review | checklist | review + correction guidance | intensive |
| Statement / study-plan editing | — | up to 2 rounds | no round limit within the contracted documents and schedule |
| Mock interview | add-on | add-on | 1 included |
| Visa | procedure guidance | document preparation | documents + key-date management |
| Dormitory | information | application schedule | application support + alternatives |
| After arrival | — | basic living information | D-30 pre-arrival + 30-day settlement |
| Dedicated team + priority | — | — | yes |

Additional services (offered by the team at an exact price inside a recommended range, paid before anything starts):
extra managed application $30–50 · extra edit round $20–35 · mock interview $50–70 · dormitory application support
$50–80 · airport pickup arrangement (quote) · extra settlement support (quote).

**All-in-One is the core product** (business plan §9, 주력 상품). There is no free tier: searching the
directory, saving universities and the public eligibility check at `/start` stay free *and unpurchased*.

The numbers live in exactly one place — `packages/types/src/plans.ts` — which generates `shared/plans.json`
for the Python seed. The marketing site renders from the manifest (a public page must paint when the API is
down); the student app reads the API; `npm run qa:plans-v29` fails if any surface, the API, the seed or a translation disagrees.

Scope is **machine-readable**, not marketing strings: `ServiceProduct.entitlements` holds counted allowances
(`max_managed_applications`, `essay_review_rounds`, `mock_interviews`, `follow_up_consultations`,
`max_recommended_institutions`, `consultation_sessions`) and graded levels (`document_review_level`, `visa_support_level`,
`dormitory_support_level`, `settlement_support_level`), held per purchase in a `ServiceEngagement` snapshot (V29). Usage is **derived from the records that prove the work happened**, never counted into
a column; `null` means *not rationed* and is not the same as `0`.

The business plan's optional paid services (§6-2) are `ServiceAddOn` rows: the Hangyul team offers one inside a
case when an allowance is spent, the **student** approves it, and approval raises exactly one entitlement by
the agreed quantity. They are never a homepage card and never a navigation area.

Every purchase is a **one-time** payment taken on the **Toss Payments billing-key rail** (owner decision): `POST /me/orders` (server-priced) → the student chooses a saved payment method or registers one on Toss's hosted page (`POST /me/payment-methods/registrations` → `…/complete`, which issues and AES-256-GCM-seals the billing key and charges nothing) → the student confirms the one-time amount → `POST /me/orders/{id}/pay` charges that key **once**. There is no subscription, no renewal and no ordinary-payment fallback (no `/v1/payments/confirm`, no 결제창 payment, no card form — card data never reaches Hangyul).
Methods: Korean card (`bill_talko18s0`), international card (`bill_talkoab1`), Toss Pay / Naver Pay (`bill_talkspm0`); a
method is offered only when its merchant is configured, settles the order's currency and — in live mode — has a
verified capability and `HG_LIVE_PAYMENT_ENABLED`. **No live method is verified yet** and no production payment host
exists, so real customers cannot be charged today ([`payments/BILLING.md`](payments/BILLING.md)). Upgrades stay refused
until an upgrade price rule is approved; refunds are executed by Operations for an amount a person decides, because the
commercial refund schedule is still `OWNER_POLICY_REQUIRED` (`shared/refund-policy.json`). A `demo` provider exists
for local development and automated tests only and is refused in production.

## Money flows

Hangyul charges only for its own services. Tuition, application fees, visa fees, translation and notarization costs
are separate and paid to their own payees; the money plan shows payee, timing and refundability per line. Refund
schedule and upgrade pricing are open owner decisions ([LEGAL.md](LEGAL.md), [ROADMAP.md](ROADMAP.md)).

## Data in a runtime database

A development or production database holds **reference data and nothing else**: the 425-institution directory from
대학알리미, Study in Korea and Wikidata (every field carrying its source, every unsourced field absent), the verified
scholarships, language rules and admission guides, legalization and visa rules, the visa playbooks, the three approved
plans and the editorial articles. There are **no demo people, organisations, partnerships, programmes, prices, deadlines or
dorm costs** in a runtime database, no `is_demo` or `verification_status = DEMO` rows, and no test accounts: sign-in is
the real registration flow everywhere; the V16–V31 shortcuts ("테스트 계정으로 로그인" and "테스트: 선택한 플랜으로 시작") were removed
from the product in V32.

Synthetic data still exists where automated tests need it — `server/app/seed/fixtures.py`, loaded only into databases
whose name contains `test` or `e2e` and dropped with the run (`npm run qa:v32-data-clean` and the teardown check prove
the runtime database stayed clean). The public rule from V12 is unchanged and now trivially true: a public surface
renders only what it can verify, because nothing else exists to render. Authenticated products with no real members
show their real first-user states (empty applications, empty documents, a clear next step), never fabricated cases; when
the private API itself cannot be reached they show the branded service-unavailable state with Retry.

**Connected environment today:** the API reachable from the deployed apps has an **empty programme catalogue**
(`/api/v1/universities` and `/programs` return `total: 0`); the public site's 425 universities come from the static
public export. See [DEPLOYMENT.md](DEPLOYMENT.md) and [REPORT.md](REPORT.md).

## Template foundations (ThemeForest, licensed)

*Updated V10 (2026-10-16). The V1–V6 text here said no template CSS, JS or photos were used; that stopped being
true in V7 . V10 changes the marketing foundation again: `template-koreanasha` — a site Hangyul
owns, authorised in writing for this project, and the same build served at univ.talkhangyul.com — replaces Eduan
as the **primary** visual and structural foundation of the public site. Koreanasha is itself a customised Eduan
build, so this is not a second design language: `packages/koreanasha-ui` carries only Koreanasha's
own ~500-line layer (floating pill header, full-viewport three-crop hero, band rhythm, card / media-row /
marquee / FAQ anatomy), re-themed to Hangyul and layered over the shared Eduan chassis. The current state:*

| Template | Role | What is used | What is not used |
|---|---|---|---|
| `template-koreanasha` (owner-supplied) | **Primary foundation of the marketing site since V10** | Its customisation layer, re-authored as SCSS in `packages/koreanasha-ui` and re-themed to the Hangyul palette; its hero technique (one hand-made crop per breakpoint); three of its photographs (`s1_c`, `s2_c`, `s3_c`), recorded as owner-supplied in `credits.json` | Its jQuery + 14 plugins, Font Awesome Pro, AOS/odometer, `lang.js`, the public application modal, all Koreanasha branding and metadata, and every image associated with a named Koreanasha person (`docs/media/LICENSE_AUDIT.md`, "Images deliberately not used"); its 23 university crests are `OWNER_AUTHORISED` and used as university marks since V20 |
| `themeforest-eduan` | **Demoted in V10** to the shared chassis under Koreanasha, plus a component and asset source | Its SCSS (verbatim, re-scoped under `:where(.ed)`, RTL-processed, purged per build) through `packages/eduan-ui`; section compositions ported to React; no template photographs since V14 (the `/credits` page was retired; general marketing photographs are Hangyul-owned or CC0 only, `docs/media/LICENSE_AUDIT.md`) | jQuery plugins (replaced by React), FontAwesome Pro, the template as a standalone download, any template branding or demo text |
| `themeforest-ynex` (Spruko) | Implementation foundation of the Operations/Admin and University consoles | Its SCSS (Bootstrap 5.3.3 subset + layout/menu styles) through `packages/ynex-ui`; the vertical layout ported to React (`YnexShell`) | Bootstrap/jQuery runtime, the template's JS plugins and chart libraries (Recharts instead), its icon fonts (Lucide instead) |

ThemeForest use is under the purchased licences for one end product (Hangyul Univ); `template-koreanasha` is
Hangyul's own work, authorised by the owner for this project. No original template package is redistributed: only
derived, compiled CSS ships, and the template folders stay outside the deployable apps. Hangyul's own BI
(tangerine #FF5000/#FF6700, Hangyul Black, soft green, mint; Pretendard) sits on top, and since V10 the **brand
lockup is the BI-kit asset** (`logo-combined.png` + an @2x and a light-ink variant), not the typeset
"Hangyul Univ" string V1–V9 drew in CSS. Template usage rules: [FRONTEND_CONVENTIONS.md](FRONTEND_CONVENTIONS.md); photography and brand assets:
[BRAND_AND_MEDIA.md](BRAND_AND_MEDIA.md).

