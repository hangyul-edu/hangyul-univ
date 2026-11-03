# Hangyul Univ — Service catalogue (V29)

**Source of truth.** The owner-approved V29 service/pricing document (2026-10-30). This page is its technical and product
translation; it is not legal policy. The machine-readable definition is
[`packages/types/src/plans.ts`](../packages/types/src/plans.ts) → generated [`shared/plans.json`](../shared/plans.json)
(`npm run plans:sync`). Catalogue version **`2026-10-30.v29`**, effective 2026-10-30. Previous version
`2026-10-19.v15` is frozen at [`shared/plan-catalog/2026-10-19.v15.json`](../shared/plan-catalog/2026-10-19.v15.json).
Gates: `npm run qa:plans-v29`, `npm run qa:addons-v29`.

## Plans — one-time USD purchases

| Service | Basic | All-in-One | Premium |
|---|---|---|---|
| Price | $179 | $349 | $599 |
| For | choosing a direction and suitable universities first | support through applications and admission documents | support through application, visa, arrival and early settlement |
| Diagnostic consultation | 1 | 1 | 1 |
| Consultation support | 1 day | 3 days | throughout the contracted service term |
| Follow-up | 1 follow-up consultation | responsible-team follow-up | priority response |
| Recommended universities / language institutes | up to 3 | up to 5 | up to 7 |
| Managed applications | none | up to 2 | up to 3 |
| Document review | basic checklist | review + correction guidance | intensive review + correction |
| Statement / study-plan editing | none | up to 2 rounds | no round limit **within the contracted application documents and schedule** |
| Mock interview | add-on | add-on | 1 included (more as add-on) |
| Visa | nationality-specific procedure guidance | application-document preparation support | documents + key-schedule intensive management |
| Dormitory | information | application-schedule management | application support + alternative accommodation guidance |
| Arrival / settlement | none | basic living information | pre-arrival support from D-30 + 30-day initial settlement support |
| Priority response + dedicated staff/team | no | no | yes (outwardly still "Hangyul Univ team") |

Recommended institutions and managed applications are **different fields** (`max_recommended_institutions`,
`max_managed_applications`) and are never shown as one number.

## Entitlement mapping (`PlanEntitlements`)

| Field | Basic | All-in-One | Premium | Usage derived from |
|---|---|---|---|---|
| `consultation_sessions` | 1 | 1 | 1 | first CONSULTATION appointment (scheduled/completed) |
| `support_window_type` / `support_window_days` | DAYS / 1 | DAYS / 3 | CONTRACT_TERM / null | engagement dates |
| `follow_up_level` / `follow_up_consultations` | CONSULTATION / 1 | TEAM / null | PRIORITY / null | later CONSULTATION appointments |
| `max_recommended_institutions` | 3 | 5 | 7 | saved universities with source HANGYUL |
| `max_managed_applications` | 0 | 2 | 3 | applications that left DRAFT (or withdrawn after work) |
| `document_review_level` | CHECKLIST | REVIEW_GUIDANCE | INTENSIVE | — |
| `essay_review_rounds` / `essay_review_scope` | 0 / NONE | 2 / ROUNDS | null / CONTRACTED_DOCUMENTS | deepest review round over in-scope essays |
| `mock_interviews` | 0 | 0 | 1 | INTERVIEW_PREP appointments (scheduled/completed) |
| `visa_support_level` | GUIDANCE | DOCUMENT_PREP | INTENSIVE | plan tasks |
| `dormitory_support_level` | INFORMATION | SCHEDULE | APPLICATION | plan tasks / DORMITORY case |
| `settlement_support_level`, `basic_living_information` | NONE, no | INFORMATION, yes | FULL, yes | — |
| `pre_arrival_support_days`, `settlement_days` | 0, 0 | 0, 0 | 30, 30 | engagement arrival dates |
| `priority_response`, `dedicated_support` | no, no | no, no | yes, yes | engagement `dedicated_owner_user_id` (internal) |

**`null` never means globally unlimited.** It is bounded by its scope field and by the engagement's term:
Premium editing applies to essays of type PERSONAL_STATEMENT / STUDY_PLAN, for an application inside the managed
allowance (or not tied to one), while the contracted term has not ended. A CV, a recommendation letter, a new
document, translation, notarization, or work after the term is out of scope (`OutOfScope.reason` =
`NEW_DOCUMENT` / `UNMANAGED_APPLICATION` / `SERVICE_PERIOD_ENDED`) and needs a paid add-on for that document.

## Service period (`ServiceEngagement`)

One row per purchased plan, created when the plan order is PAID, holding a **snapshot** of the contract.
`service_started_at` = the first consultation (derived) or set by staff; `support_window_ends_at` = start + 1/3 days
(Premium: the term end); `service_ends_at` = the contracted term — the owner's document fixes no Premium duration, so it
is an explicit field set when the service begins (until then the UI says "agreed when the service starts");
`arrival_at` → `pre_arrival_starts_at` (−30 d) and `settlement_ends_at` (+30 d). A single meeting's length is the
appointment's `duration_minutes`, never a plan property.

## Additional services

| Code | Service | Unit | Recommended price | Effect |
|---|---|---|---|---|
| `EXTRA_MANAGED_APPLICATION` | extra managed application | 1 university | $30–50 | `max_managed_applications` +1 per unit |
| `EXTRA_ESSAY_ROUND` | extra statement / study-plan edit | 1 round | $20–35 | +1 round (pooled, or for one out-of-scope essay); never sold for Premium in-scope editing |
| `MOCK_INTERVIEW` | mock interview | 1 session | $50–70 | `mock_interviews` +1; Premium's first is included and is not sold |
| `DORMITORY_APPLICATION` | dormitory application support | 1 application | $50–80 | opens a DORMITORY service case |
| `AIRPORT_PICKUP` | airport pickup arrangement | 1 arrangement | custom quote, scope required | opens an AIRPORT_PICKUP case — arranged through a partner provider (referral) |
| `SETTLEMENT_SUPPORT` | extra settlement support | agreed scope | custom quote, scope required | opens an ARRIVAL_SUPPORT case |

**A range is not a charge.** The operator offers one exact unit price inside the range (or a quote and its written
scope); the student sees service, scope, quantity and the exact USD amount. Lifecycle:
`OFFERED → (approve) AWAITING_PAYMENT + ADD_ON order → (paid) ACTIVE → COMPLETED` / `DECLINED` / `CANCELLED`. Nothing
is granted before payment; approving twice returns the same order; activation is idempotent; every step is audited and
tracked (`add_on_offered`, `add_on_approved`, `add_on_purchased`). Code: `server/app/services/addons.py`.

## Upgrades

`UPGRADE_POLICY.status = OWNER_DECISION_REQUIRED`. The V29 contract defines no upgrade price, so the server refuses an
upgrade order (`UPGRADE_POLICY_REQUIRED`) and the UI shows what would change plus "ask the team". Usage carries over
(it is read from work records). Non-production review builds can still demonstrate an upgrade with the paid-state test
action, which charges nothing.

## Service notes (이용 안내)

Keys `common:v29.pricing.notes.*`, one disclosure under the pricing section and in full in the checkout summary: USD
prices; card/FX fees may change the charged amount; third-party costs (application fees, tuition, visa fees,
translation/notarization, international delivery) are separate; required documents vary by nationality, education and
level; visa support is preparation help — the authority decides; detailed schedule, editing scope, response time and
scope may be set in the service agreement/order; Premium editing is limited to the contracted documents and schedule;
new documents, translation and notarization may cost extra.

## Versioning and migration

Every plan order stores `catalog_version`, `plan_snapshot` and `purchase_terms_version` (2026-10-30); its engagement
copies the snapshot. A catalogue change never alters a purchase. Alembic `v29svc0001` stamped every pre-V29 PAID order
with `2026-10-19.v15` and its V15 snapshot (V28 buyers keep the V28 contract). Moving engagements to V29 is the
explicit `python -m scripts.v29_migrate_contracts --migrate-demo` — demo/test accounts only, refused outside
development/test without `--i-have-owner-approval`; each move records `migrated_from_version` and an audit row.

## UI placement

Marketing `#pricing` (cards → comparison disclosure → 추가 서비스 list + 이용 안내 disclosure) ·
Student `/services` (current plan → service term → now → allowances → add-ons → catalogue → upgrade) and checkout ·
Student native services screen · Agency workspace plan panel (term, used/included, plan duties, add-ons, "추가 서비스 제안").
All render the comparison through `compareCell()` and the card copy through `planText()`; no surface holds plan numbers.

## Managed-application set

The 425-institution directory is the discovery set. "We can manage this application now" is shown only for intakes in
the managed-application set (`guides.managed_support`): a VERIFIED guide for this intake with checklist, deadline,
submission method, source URL and verification date. At V29: 8 universities, bachelor's, 2027 Spring. Everything else is
`ADMISSION_GUIDE_REVIEW_REQUIRED` and routed to Hangyul operations.
