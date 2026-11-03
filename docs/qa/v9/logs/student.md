# V9 student workstream log

Scope: REPORT §58 S1–S6, S8 (S7 = localization workstream) and §55 problems #1–3, #6, #7, #24, #25.
Persona designed for: Aarati-like — 19, Nepal, budget Android (360–390 px), limited English, no TOPIK, parents pay.

## Re-verification before changes (2026-10-10)
- §55 #1: `POST /public/quick-eligibility` NP · BACHELOR · NONE → `meets_count 0`, `not_yet 31`, `unlock TOPIK 3 → 21`; same request with degree LANGUAGE → `meets_count 10`. Confirmed: the 10 accepting language programs are never mentioned.
- §55 #2: `/me/budget` lines carry amount + basis only; `insurance` and `visa_fee` are `UNKNOWN` although `arrival-official.json` has residence card KRW 35,000 (VERIFIED, KIS notice) and NHIS ≈ KRW 79,320/month (PARTIAL, university notices), and `visa_routes.fees` has USD 60 (NP/MM/MN, structured). Funds-to-show only on `/me/visa-route` → `financial.amount_en` (English research text).
- §55 #3: no sponsor surface. §55 #6: `before/student/home-myanmar-390.png` — tab labels wrap to two lines and clip; photo credit (absolute, top 10px) overlaps the band title.
- §55 #7: dossier rows have `applications[].sent`, consents exist; no "who can see" anywhere.
- §55 #24/#25: see Visa / Discovery sections below.

## Changes → why → files/API → test

**S1 Routes, not a dead end (§55 #1).** `services/matching.py` (additive): `transient_profile`, `language_routes()` — when language blocks the target degree and nothing at that degree is open, returns (a) Korean language program first: programs that accept the student now (same engine), published length (`duration_semesters`), first-year cost range from `budget.first_year_range`, D-4-1 → D-2, and what opens at the smallest unlocking TOPIK level; (b) English-taught count + lowest IELTS/TOEFL; (c) smallest test step that opens the most. `not_an_offer: true`, no probability. API (additive `routes` field): `POST /public/quick-eligibility`, `GET /me/matches`, `GET /me/dashboard` (early home only, no applications). UI: `components/Routes.tsx` (RoutesCard) on `/start`, Discovery "For you", early home; marketing `QuickSentence` RoutesList (`lib/quick.ts` types + `languageRoutePath`). NP·BACHELOR·NONE → 10 language programs, IELTS 6.0/TOEFL 80 → 5, TOPIK 3 → 21. Tests: `test_quick_check_nepal_no_test_shows_language_route`, `test_routes_absent_when_language_does_not_block`, `test_signed_in_discovery_and_early_home_show_routes` (fresh Nepal persona via register flow).

**S2 One money plan (§55 #2).** NEW `services/money.py`: lines with payer → payee (UNIVERSITY / APPLICATION_RAIL / HANGYUL / EMBASSY / IMMIGRATION / INSURER / LANDLORD / DORMITORY / EVERYDAY), when (APPLICATION · OFFER · TUITION_DEADLINE · BEFORE_VISA · BEFORE_ARRIVAL · ON_ARRIVAL · MONTHLY — BEFORE_ARRIVAL added for the first dormitory semester), refundable, basis + source + date. Researched figures replace "no reliable figure": residence card KRW 35,000 OFFICIAL (KIS notice; fee re-verified 2026-10-10 in v9-arrival-revalidation §2.1), NHIS ≈ KRW 79,320/month ESTIMATE (university notices, "not stated by NHIS"; D-4 note: 6 months after entry), visa fee from the route (`fees.amount` → OFFICIAL if route VERIFIED else ESTIMATE; text-only fees shown "as published"; USD never summed into KRW). "Money you must show (not pay)" = `parse_funds/funds_to_show` (amount for the program's region, held/history period, lower-tier period, whose name, certificate age, excellent-tier waiver) + genuine-funds note (대법원 2024도14827). Announced-only rules (TOPIK 4 exemption, deposit scheme, refund-to-own-account) in `ANNOUNCED`, never in current rules. Payment-route guard on tuition. API: NEW `GET /me/money-plan`; additive `items[].plan`, `funds_to_show`, `guard`, `announced` on `/me/budget`; `items[].money` on `/me/offers`; `funds` on `/me/visa-route`. UI: `components/MoneyPlan.tsx` (MoneyTimeline, FundsToShowBlock, PaymentGuard, AnnouncedRules) on Budget, program page (fold), offer (ApplicationDetail PayLine), visa, sponsor. Tests: `test_money_plan_lines_have_payee_when_refund_basis`, `test_funds_to_show_before_visa_uses_region`, `test_offers_carry_money_lines`.

**S3 Sponsor view (§55 #3).** NEW `models/v9_sponsor.py` (SponsorLink, SponsorLinkView), migration `v9_student_sponsor.py` (rev `v9s1sponsor01`, down `a8u1b2c3d4e5`, applied to dev DB), NEW `api/v1/sponsor.py` mounted on routers I own (journey: `/me/sponsor-links` POST/GET, `/me/sponsor-links/{id}/revoke`; public: `GET /public/sponsor/{token}`) — main.py untouched. Token SHA-256 only, shown once; default 30 days (1–90); scopes money / family_documents / dates / progress / arrival; ConsentRecord `SPONSOR_VIEW` on create (granted) and revoke (withdrawn); every view → SponsorLinkView + AuditLog; unknown/revoked/expired → same 404; payload never has messages, essays, notes, files, contact data; Hangyul's own fee line removed. UI: `/family` (create, copy once, last opened, revoke; linked from More, Budget, Settings privacy) and public `/sponsor/:token` (language picker; first visit uses the language the student chose). Tests: scopes enforced, revoked/expired/unknown → 404, consent recorded, hashed token, other student can't revoke, staff can't create, private-field scan.

**S4 Who can see this (§55 #7).** `api/v1/dossier.py` `/me/dossier` adds `visibility` (you · counselor + agency with SHARE_WITH_AGENCY consent date · Hangyul reviewers · universities only what was sent · retention "while active; deletion on request except legal records; policy pending approval" · withdraw: agency sharing yes, files sent to a university no) and `rows[].sent_to` (university + submitted date). UI: row line "Sent to …", drawer section `WhoCanSee` (replaces the generic privacy callout), Documents page fold; Settings privacy section got `id="privacy"`. Test: `test_dossier_says_who_can_see`.

**S5 Discovery (§55 #25).** Zero-count verdict groups no longer offered (the open one stays); row shows "Scholarship possible" from `scholarship_ids` without expanding; gap + unlock line already on the row; RoutesCard on top when language blocks.

**S6 Visa ≤ 3 phone screens (§55 #24).** Visa page: route line (where the official action happens) · status · Now card (needed now + who provides) · "Then:" line · everything else as one-line folds (caveats, documents with ready count, proof of money, form, track, steps, help). The current step's own section (form/track) stays open so its buttons work. Money = `FundsToShowBlock` from `plan.funds` (keys + params), embassy English only under "As published". Measured 390: Bảo 2.9, Hnin 2.1, Lan 2.9 screens (were 5.3–5.7).

**S8 Refund path.** `money.py` registers service-case type `REFUND` (OPEN → ASKED_UNIVERSITY / WAITING_STUDENT → REFUNDED / CANCELLED); `ensure_refund_case` (idempotent per application) on visa `REJECTED` after tuition, or application WITHDRAWN after TUITION_PAID (status history); hooked in `visa_routes.record_decision` (REFUSED) and the dashboard. `refund_summary`: rule (unknown → "your counselor confirms"), own-account rule, elapsed days; on `/me/dashboard.refund`, money plan and sponsor money. UI `components/RefundCard.tsx` first on home. concierge.json `type.REFUND` + `status.REFUND.*` (code-addressed `status_key`, so outside the v9 subtree on purpose). Test: `test_visa_refusal_after_tuition_opens_refund_case` (cleans up).

**§55 #6 Burmese phone.** `v9.css`: tab labels may wrap to two lines (line-clamp 2, taller line-height for my/km/si/lo, auto height) instead of clipping; photo credit moved into the band's flow (column layout) so it can't overlap the title. Verified `home-myanmar-390.png`.

**Coordinator follow-ups (visa-data hand-off), `services/visa_routes.py`.** (1) BD method note → `VISA_CENTRE_DHAKA` (KVAC Dhaka by appointment since 2026-09-02). (2) `KNOWN_CONFLICTS` is filtered by the route's `v9_revalidation.changes` (resolved/settled/newly confirmed on the matching field) → MM legalization, PK fee/time, TH fee exemption, KG amounts, PH post split drop out; BD legalization, KG TB validity, PH stale list, UZ fees stay; new `TB_POST_CONFLICT` for KZ Almaty only. (3) Legalization is data-driven: explicit `NONE` (Myanmar) wins; the MOJ default applies only when unknown. (4) Fee-free routes (`*_nationals: FREE`, Thai) → `method.fee_free` and a real 0 line "No fee". (5) `research_extra()` reads `scheduled_changes` from the research JSON (mtime cache): `effective_financial()` applies `financial.*` changes on/after `effective_from`; before, `plan.scheduled` + caveat `SCHEDULED_CHANGE` and funds block show "announced, not in force". Tests: `test_kyrgyz_2027_rule_is_date_aware_in_the_resolver`, `test_thai_nationals_visa_fee_is_zero_not_unknown`, `test_settled_conflicts_drop_and_myanmar_legalization_is_data_driven`. New strings went to `student:v9.visa.*` (Visa page falls back to them) because `test_v5_visa::test_visaroute_keys_are_translated[my]` requires every visaroute key in Burmese and other locales belong to the localization workstream — **hand-off: translate `student:v9.*` for my/ne/vi.**

## Existing tests changed on purpose
- `tests/test_v5_visa.py::test_myanmar_resolves…`: now asserts `LEGALIZATION_UNCLEAR` is NOT raised (settled by the 2026-10-10 revalidation).

## i18n
`scripts/i18n/v9-student.py` merges en+ko: student `v9.*` (routes, money, funds, guard, announced, family, sponsor, refund, discovery, visa), dossier `v9.who.*`, concierge REFUND, marketing `v9.routes.*`. Korean brand 한귤.

## Test results
- pytest (student area, 17 files incl. new `test_v9_student.py` 17 tests): 132 passed.
- vitest student-web: 71 passed (new `lib/v9.test.ts`, 6). `tsc --noEmit` student-web and marketing-web: clean.
- Screenshots: `docs/qa/v9/student/*-{360,390,1440}.png` (+ `-full`), script `scripts/qa/v9-student-shots.mjs`; no horizontal overflow on any captured view.

## Not done / known gaps
- Routes "typical length": catalogue only has `duration_semesters` per enrolment (1); no published "terms until TOPIK 3" figure, so none is invented.
- Refund: no university refund rule data exists → always "your counselor confirms"; no demo persona with a refused visa (scenario covered by the test only).
- Scheduled changes: only `financial.*` paths are applied at request time; document notes/language thresholds of the KG 2027 rule still need `scripts/v9_visa_data.py` re-run on/after 2027-01-01 (they live in DB rows).
- New caveat/method codes appear as raw codes in agency consoles if those render visaroute caveats (not my files).
- Discovery for early students is still long (8–9 phone screens: 31–45 "not yet" rows); routes now lead, rows not paginated.
- Other locales (my/ne/vi …) for all new keys: localization workstream.

## Coordinator review fix (budget summary vs money plan)
- Problem: Budget's per-program summary still said "Not included: health insurance, visa fee — no reliable figure yet" (budget `unknown_keys`) while the money plan on the same page showed the visa fee (USD 60) and NHIS (₩79,320/month).
- Fix: `lib/money.ts` `planCoverage()` + `components/MoneyPlan.tsx` `PlanCoverage`. Both are built from the SAME plan lines:
  - included in the first-year range: tuition, application fee, dormitory, living;
  - paid separately, with amount and currency: visa fee, residence card, NHIS;
  - "no reliable figure yet" appears only for lines the plan itself has no figure for.
- Where it is used: Budget summary and the program page cost note (previously `v4.cost.excludes`). The old keys remain only as a fallback when no plan is returned.
- Grep of `notIncluded`, `plusUnknown`, `v4.cost.excludes`, `excludes`: compare, offers and home don't use these strings, so they need no change.
- Keys: `student v9.money.coverage.{included,separate,noFigure}`, en + ko.
- Results: re-shot `budget-myanmar-{390,1440}`, typecheck clean, vitest 71/71 passed, `test_v9_student` + `test_v5_visa` passed.
