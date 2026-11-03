# Hangyul Univ — Product

> Everything you need to study in Korea, from your first question to graduation.

## The shift

Traditional flow: **Student → study-abroad agency → university**. Information is fragmented across university sites, portals and agencies; agencies qualify leads by hand; universities see applicants only up to admission.

Hangyul Univ flow: **Student → Hangyul Univ → partner agency → partner university.** Hangyul is the operating system and data layer that connects all parties:

| Party | What they get |
|---|---|
| Student | One profile, honest eligibility, explained matches, a single document vault reused everywhere, deadlines and next steps, expert help, visa and arrival guidance, post-arrival support |
| Partner agency | Qualified, paid, well-documented cases matched to their expertise; a CRM that automates checklists, reminders, SLA tracking and reviews |
| Partner university | A pipeline of prepared applicants, triage tools, recruitment funnel and — uniquely — enrollment, visa, arrival, retention and graduation outcomes by cohort, agency and country |
| Hangyul | A marketplace + data network: partnership economics, scholarship pools, freshness-verified information that compounds |

## Principles

1. **Honesty over hype.** No invented acceptance rates, rankings or outcomes. Match tiers (Strong / Competitive / Reach / Not eligible yet) with reasons, never an admission probability. "Guaranteed" only when a configured partner contract with criteria and quota backs it (see `PartnerContract.guarantee_*`).
2. **Freshness is a feature.** Every time-sensitive fact carries `source_url`, `verified_at`, `verification_status` (and `effective_from/to` where relevant). Stale items enter a review queue.
3. **One primary action.** Students always see the single most useful next step.
4. **Automate the repetitive, keep humans for judgment.** Checklists, reminders, task generation, first-pass essay structure checks, legalization routing, assignment scoring are automated; decisions (document verification, essay approval, admission) stay human.
5. **Tenant isolation is non-negotiable** and enforced server-side.

## Four web products

| App | Port | Personality | Core jobs |
|---|---|---|---|
| Marketing | 3100 | Editorial, aspirational, trustworthy | Make someone want Korea, show them where they could study (the national institution directory), publish what we are legally obliged to publish, sign in |
| Student | 3101 | Calm, guided, low cognitive load | Onboarding, matches, search, compare, applications, document vault, essays, visa, housing, arrival, scholarships, services, messages |
| Agency Console | 3102 | Dense but organized CRM | Pipeline kanban, student workspace, review queues, essay reviews, tasks & SLA, messaging with internal notes, analytics; Hangyul ops tools (assignment override, sources & freshness, audit) |
| University Console | 3103 | Executive analytics + admissions ops | Applicant triage and decisions, funnel, admission rules, scholarship pools, partner agencies, cohorts/retention/graduation, exports, partnership |

Native apps (Expo, not WebViews): Student, Agency, University — focused on the most frequent mobile workflows.

## Service plans

*V29 (2026-10-30): the owner-approved V29 service contract. Full definition, add-ons, service-period semantics,
versioning and UI placement: [`SERVICE_CATALOG_V29.md`](SERVICE_CATALOG_V29.md). Catalogue `2026-10-19.v15` (V15–V28:
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

The business plan's optional paid services (§6-2) are `ServiceAddOn` rows: a counsellor offers one inside a
case when an allowance is spent, the **student** approves it, and approval raises exactly one entitlement by
the agreed quantity. They are never a homepage card and never a navigation area.

Payments run on **Toss Payments in TEST mode** (`HG_PAYMENT_PROVIDER=toss`, `HG_TOSS_ENV=test`; V21, REPORT §0.4).
A plan is bought by **foreign-card key-in on MID `bill_talkoab1`** through Hangyul's **own card form** (no Toss
popup): `POST /me/orders` → the card form → `POST /me/orders/{id}/pay-with-card`; the server relays the card number
and expiry to Toss's key-in API and **stores neither**. Approved prices do not make checkout production-ready:
live keys and the overseas-card/USD contracts are owner actions (`docs/payments/TOSS_FOREIGN_CARD_REVIEW.md`), and
`release:check` still blocks on them and on the commercial refund schedule (`OWNER_POLICY_REQUIRED`,
`shared/refund-policy.json`). A `demo` provider exists for development and tests only.

## Tuition and money flows

Research (MOE guideline, rev. 2025-03-14) found tuition must be paid in the student's own name, normally to a personal virtual account, with refunds to the student. **Hangyul does not collect tuition**; the product links students to the university's payment channel and only charges for Hangyul services. Partnership economics (recruitment fees, incentives, scholarship pools) are modelled as configurable contracts, and Hangyul Partner Scholarships activate only while an active contract and funded pool exist.

## Template foundations (ThemeForest, licensed)

*Updated V10 (2026-10-16). The V1–V6 text here said no template CSS, JS or photos were used; that stopped being
true in V7 (REPORT §40–46). V10 changes the marketing foundation again: `template-koreanasha` — a site Hangyul
owns, authorised in writing for this project, and the same build served at univ.talkhangyul.com — replaces Eduan
as the **primary** visual and structural foundation of the public site. Koreanasha is itself a customised Eduan
build (REPORT §65.1), so this is not a second design language: `packages/koreanasha-ui` carries only Koreanasha's
own ~500-line layer (floating pill header, full-viewport three-crop hero, band rhythm, card / media-row /
marquee / FAQ anatomy), re-themed to Hangyul and layered over the shared Eduan chassis. The current state:*

| Template | Role | What is used | What is not used |
|---|---|---|---|
| `template-koreanasha` (owner-supplied) | **Primary foundation of the marketing site since V10** | Its customisation layer, re-authored as SCSS in `packages/koreanasha-ui` and re-themed to the Hangyul palette; its hero technique (one hand-made crop per breakpoint); three of its photographs (`s1_c`, `s2_c`, `s3_c`), recorded as owner-supplied in `credits.json` | Its jQuery + 14 plugins, Font Awesome Pro, AOS/odometer, `lang.js`, the public application modal, all Koreanasha branding and metadata, and every image associated with a named Koreanasha person (`docs/MEDIA_LICENSE_AUDIT.md`, "Images deliberately not used"); its 23 university crests are `OWNER_AUTHORISED` and used as university marks since V20 |
| `themeforest-eduan` | **Demoted in V10** to the shared chassis under Koreanasha, plus a component and asset source | Its SCSS (verbatim, re-scoped under `:where(.ed)`, RTL-processed, purged per build) through `packages/eduan-ui`; section compositions ported to React; no template photographs since V14 (the `/credits` page was retired; general marketing photographs are Hangyul-owned or CC0 only, `docs/MEDIA_LICENSE_AUDIT.md`) | jQuery plugins (replaced by React), FontAwesome Pro, the template as a standalone download, any template branding or demo text |
| `themeforest-ynex` (Spruko) | Implementation foundation of the Agency, University and Hangyul-operations consoles | Its SCSS (Bootstrap 5.3.3 subset + layout/menu styles) through `packages/ynex-ui`; the vertical layout ported to React (`YnexShell`) | Bootstrap/jQuery runtime, the template's JS plugins and chart libraries (Recharts instead), its icon fonts (Lucide instead) |

ThemeForest use is under the purchased licences for one end product (Hangyul Univ); `template-koreanasha` is
Hangyul's own work, authorised by the owner for this project. No original template package is redistributed: only
derived, compiled CSS ships, and the template folders stay outside the deployable apps. Hangyul's own BI
(tangerine #FF5000/#FF6700, Hangyul Black, soft green, mint; Pretendard) sits on top, and since V10 the **brand
lockup is the BI-kit asset** (`logo-combined.png` + an @2x and a light-ink variant), not the typeset
"Hangyul Univ" string V1–V9 drew in CSS. Inventories: `docs/TEMPLATE_KOREANASHA_INVENTORY.md`,
`docs/TEMPLATE_EDUAN_INVENTORY.md`, `docs/TEMPLATE_YNEX_INVENTORY.md`; photography and brand assets:
`docs/MEDIA_LICENSE_AUDIT.md` (which absorbed `MARKETING_ASSETS.md` in V26).

## Demo data

The seed creates realistic but **fictional** people, agencies, partnerships (`is_demo`) and numbers
(`verification_status = DEMO`). Program lists, tuition, fees, dates and dorm costs are sample data.

**V12 changed how that is handled, not whether it is true.** V10 and V11 labelled every unverified figure
"Sample data" in the UI. The rule now is the brief's sharper one: *a public surface does not render a value it
cannot verify at all.* So no cost, deadline, requirement or match reaches a public page — not labelled, not
dimmed, not footnoted — and the labels themselves are gone from ordinary product chrome, because a product
covered in "DEMO" badges reads as a development build whatever the badges say. Seeded figures still exist on the
authenticated surfaces that need them, and `/__dev` (development builds only) says plainly which data is which.

The **public institution directory is the exception that proves it**: 425 institutions from 대학알리미, Study in
Korea and Wikidata, every field carrying the source that produced it, and every field with no source simply
absent. It needs no label because there is nothing on it to disclaim.

## V9 — what the product is now (2026-10-14)

**The promise** (internal, never a public claim): *the easiest and most reliable way to prepare for studying in Korea* — one profile, one document dossier, one journey, one source of application state, one communication history, one operating system for the agency, one structured pipeline for the university. No "highest acceptance rate", "best in Korea" or "guaranteed" appears anywhere; the product instead maximises application completeness, realistic selection, deadline compliance, document correctness, writing quality and visa preparedness.

What V9 changed in the shape of the product (details: REPORT §58–63, `docs/SERVICE_BLUEPRINT.md`):

| Audience | Job | V9 answer |
|---|---|---|
| Student with no TOPIK | "Can I realistically study in Korea?" | The check returns *routes* (Korean language program first / English-taught / smallest test step) with counts from published requirements — "not an offer" |
| Student + parent | "How much, to whom, when?" | One money plan: payee, timing, refundability, basis; money to *show* for the visa is separate and present before the visa stage; payment-route guard; refund path |
| Parent | "What does my family need to pay, show and know?" | Student-created, read-only, expiring, revocable sponsor link — never messages, essays, notes or files |
| Student | "Who sees my passport?" | "Who can see this" on every document |
| Counselor | "Who needs me now?" | One ranked work queue with reasons and work-type filters; seven-value waiting-on model |
| Manager | "Where is my operation failing?" | Six questions at the top of Operations; weighted team load with editable weights; process quality metrics |
| University reviewer | "Can I decide this applicant?" | Requirement · evidence · status first; review-and-advance; safe bulk with "select all matching" |
| University manager | "Is Hangyul better than email + agents?" | Questions-first analytics, partnership value with cohort + denominator, rule impact preview |
| Hangyul operations | "Where is the ecosystem failing?" | Severity-ordered failure list, partner-agency process quality, launch-readiness classification |

Honest boundaries (unchanged): Hangyul never collects tuition; official submission happens on the university's rail (guided hand-off + evidence); no integration is shown as live unless configured (`/hq/readiness`); legal text, live Toss keys and the overseas-card/USD contracts (prices are set — US$179 / 349 / 599), verified catalogue data, human translation review and user research are external dependencies (`docs/LEGAL_DEPENDENCIES.md`, REPORT §0.6).
