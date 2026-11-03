# Arrival services

## Overview

Hangyul supports D-2 and D-4 students from the visa stage through their first months in Korea: getting to the city, SIM, transport card, residence card, health insurance, bank account, orientation and course registration.

The facts below are research: official or university sources, checked on **2026-09-29**. The machine-readable version is `docs/research/arrival-official.json`. Each entry there carries `sources[]` (url, title, `verified_at`, quote) and a `verification_status` (VERIFIED, PARTIAL or NEEDS_REVIEW). Engineering should load that file, not copy numbers into code.

The competitive context is in `docs/COMPETITOR_BENCHMARK.md`.

**Dependency chain the product must model:**

```
arrive ─► prepaid SIM / eSIM, T-money, private insurance (bridge)
   └─► residence card application (≤ 90 days; HiKorea reservation)
          ├─► NHIS cover starts (D-2: entry date, or registration date if later; D-4 general: after 6 months)
          ├─► full bank account (before this: a restricted account)
          └─► postpaid phone plan (needs review)
   then: report changes within 14 days · NHIS premium by the 25th · extension before expiry
```

## Official facts (research)

Status in brackets. Full quotes and URLs are in the JSON, under each key.

### 1. Residence card (alien registration): `residence_card_registration` [VERIFIED]

- **Who:** anyone staying more than 90 days.
- **When:** within **90 days of entry**.
- **Where:** the immigration office for your address, **booked on HiKorea** first. Offices generally do not accept walk-ins. Some universities send all their students to one office; KU GSIS students must use the Sejongno office.
- **Documents:**
  - Integrated application form
  - Passport
  - One photo, 3.5 × 4.5 cm
  - Certificate of enrollment
  - Proof of residence
  - TB certificate for nationals of designated countries
- **Fee:** **KRW 35,000 since 2025-01-01** (was 30,000; the change is due to the IC chip). Source: MOJ/KIS notice of 2024-12-13.
- **Processing:** about 1–2 weeks (KHU) to about 6–8 weeks (Mason Korea / Incheon office). Card collected in person or by mail.
- **Do not leave Korea** before the card is issued unless immigration confirms you can (KU GSIS guidance).
- **Group application:** some universities collect and submit applications for their students and hand out the cards themselves. Example: George Mason University Korea → Incheon Immigration Office. Key `residence_card_group_application` [PARTIAL]. This is a per-university fact, never a default.
- **After registering:** report changes within 14 days — address, passport, lost card; fines apply otherwise. Key `residence_report_changes` [PARTIAL].
- **Mobile residence card:** issued since 2025-01-10. Key `mobile_residence_card` [NEEDS_REVIEW].

### 2. National Health Insurance (NHIS): `nhis_enrollment_timing` [VERIFIED], `nhis_student_premium` [PARTIAL], `private_insurance_bridge` [PARTIAL]

- **Enrollment is automatic** as a regional member.
  - D-2 and D-4-3: from the **date of entry, or the date of alien registration if that is later** (NHIS policy page).
  - Other D-4, such as language trainees: **6 months after entry**.
  - The first bill usually arrives about 1–2 months after registration.
- **Premium:**
  - D-2 and D-4 get a **50% reduction** (since March 2023) on the foreigner regional premium. That premium is at least the previous year's national average (NHIS).
  - 2026 student premium: **about KRW 79,320/month** (Sungshin Women's University notice, 2026-03-06; university source, not NHIS).
  - **Due by the 25th** for the following month.
  - **Unpaid premiums can block visa extension** and other stay permits (Soongsil University).
- **Bridge cover:** universities strongly recommend arriving with private insurance that covers Korea, because NHIS may not apply right away (KU GSIS).
- **Help lines:** NHIS 1577-1000; English line 033-811-2000.

### 3. Bank account: `bank_account_opening` [VERIFIED]

Source: Invest KOREA (KOTRA) guide, Aug 2024.

- **With a residence card:** residence card, passport, plus a document proving why you need the account. Students usually use a certificate of enrollment.
- **Before the residence card:** passport plus proof of a Korean address. Examples: utility bill, hotel voucher, employer certificate. Whether a dorm or lease confirmation is accepted is up to the branch.
- **Restricted account:** if purpose documents are missing, you get a restricted account.
  - Daily limits: **KRW 3M at a branch, 1M at ATMs, 1M online**.
  - Limits are lifted once you prove the purpose.
- **Bank-specific extras:** some banks ask for more. Konkuk's guide lists passport, certificate of enrollment and tax ID, and there is an on-campus Shinhan branch.
- **Pre-registration is not remote opening.** Hana Bank lets you pre-register before arrival, but the account is still opened at a branch after you arrive (Korea Herald, 2025-07-09).

### 4. SIM / eSIM: `sim_esim_arrival` [PARTIAL]

- **Counters:** SK Telecom, KT and LG U+ have roaming centres in the **Incheon T1 arrivals hall**.
  - Near Arrival Hall A: 06:00–22:00.
  - Near Arrival Hall F: **24 hours** (all three carriers).
  - Source: airport.kr facility list. T2 not yet checked.
- **Prepaid:** prepaid SIMs and eSIMs are sold with a passport.
  - SKT's foreigner LTE eSIM is aimed at stays **within 90 days** (search excerpt from skroaming.com), so it is a bridge only.
- **Postpaid:** **postpaid needs a residence card and a Korean payment method.** This comes from commercial guides only → NEEDS_REVIEW against a carrier's official page.

### 5. Transport: `transport_card_tmoney` [VERIFIED], `airport_to_city` [PARTIAL], `university_airport_pickup` [PARTIAL]

- **T-money / EZL cards** (VISITKOREA):
  - Cost KRW 3,000–5,000 at convenience stores (GS25, CU, 7-ELEVEN) or Seoul subway information centres.
  - Top up at subway machines (up to KRW 500,000) or at stores.
  - Work on all public transport.
- **Other cards:**
  - WOWPASS (KRW 5,000; app or kiosks) combines a prepaid payment card with T-money.
  - The Climate Card can only be bought or topped up with cash or a Korean-issued card.
- **AREX:** the all-stop train from T2 to Seoul Station takes about 67 minutes and costs **KRW 5,350** (adult). The express fare and time were not verified. AREX hotline: 1599-7788.
- **Limousine buses:** no reservation needed. Pay at the ticket booth, or with a transport or credit card (airport.kr FAQ excerpt).
- **University pickup:** only on announced dates. Example: KU's 2026 International Summer Campus ran hourly shuttles from T1 Gate F to its dorm, 11:00–19:00, on check-in day only.

### 6. Orientation, arrival report, course registration: `orientation_course_registration` [PARTIAL]

- **Orientation:** usually mandatory. It covers visa and stay rules, the residence card, NHIS, part-time work permission and academic rules.
- **Arrival report:** KU GSIS, Spring 2026, required an **Arrival Report plus proof of residence card application within 5 days of arrival**.
- **Course registration** runs in fixed portal windows. Example: Korea University, Fall 2026, 24 Aug 10:00 – 25 Aug 12:00 on sugang.korea.ac.kr.
- **Student ID** issuance differs by university and is not verified.

### 7. Emergency numbers and help lines: `emergency_and_helplines` [PARTIAL]

- **112 (police):** 24/7 interpretation in English and Chinese since March 2024 (Korea.net).
- **119:** fire and ambulance. Its interpretation languages were not verified on an official page.
- **1345 (Immigration Contact Center):** weekdays 09:00–22:00; after 18:00 only Korean, English and Chinese. From abroad: +82-1345.
- **1330 (KTO travel helpline):** +82-2-1330 from overseas; also chat, KakaoTalk and LINE.
- **NHIS:** 033-811-2000 (English).

## Service design principles

1. **Never present a provider as a partner without a stored agreement.**
   - Carriers, banks, insurers, housing platforms and transfer companies are shown as neutral options with the official link, or not at all.
   - "Partner", "recommended" and discounts require a PartnerContract record.
2. **Never pretend flight or transit data is live without an integration.**
   - The student enters their flight number and arrival time; we show them back as *entered by you*.
   - No "on time / delayed" status, and no live AREX or bus times, unless a real data feed is integrated and labelled.
3. **Do not promise remote bank accounts.**
   - Opening needs a branch visit in Korea.
   - Pre-registration schemes (e.g. Hana) only speed up that visit.
   - Warn that accounts opened before the residence card are usually restricted.
4. **Official facts are data with provenance.**
   - Load them from `arrival-official.json` or its DB successor, with `verified_at` and a source link visible to staff and students.
   - PARTIAL and NEEDS_REVIEW facts use softer wording ("usually", "check with your university") and are never shown as rules.
5. **University-specific facts are set by the university or agency, per intake.** Examples: group residence card application, pickup shuttle, orientation, arrival report, course-registration window. Never generalise from one example.
6. **Sequence, don't list.** Show the dependency chain: what the student can do today, and what unlocks next. Show the 90-day residence card and 25th-of-month NHIS deadlines as dated tasks.
7. **Separate costs.** Official fees (residence card KRW 35,000), third-party costs (SIM, transport, insurance) and any Hangyul service fee are always shown separately. Official amounts carry their source and date.
8. **The student leaves Hangyul only for real external actions** (HiKorea reservation, bank branch, carrier counter). For each: explain before, keep state during, and record the result after (e.g. the reservation receipt uploaded as proof). Never claim the step happened without evidence.
9. **Parents see a consented, read-only summary**, never documents or messages, unless the student grants it.

10. **One fulfilment model, not five dashboards** (engineering). Every post-admission service — visa support, pickup, dormitory, housing search, temporary stay, residence card, SIM, bank, help — is a `ServiceCase` with a per-type status table. Each status says who the case waits on (team / student / provider / outside office / nobody), so the agency queue, the student view and the metrics read the same record.

## Implementation

*Concierge workstream, 2026-09-29. Migration `e5c0c1e2a7b1` (on top of `d5a1c0e55ccd`).*

**Data model** (`server/app/models/v5_concierge.py`, plus columns on existing tables)
- `ServiceCase` — student, application, agency, owner, `routed_to` (AGENCY | HANGYUL_OPS), `case_type`, `status`, priority, `due_at` (when the service happens), `sla_due_at` (when the team must act), vendor, cost `{amount, currency, payer: student|hangyul|university|included}`, type-specific `details` JSON (pickup form, driver, lease terms, help message…), internal notes, help category, feedback (yes/no + comment), `is_demo`.
- `ServiceCaseEvent` — history: CREATED, STATUS, OWNER, VENDOR, NOTE, FLIGHT_CHANGE, PROOF, NO_SHOW, FEEDBACK, ATTACHMENT, UPDATE; `visibility` INTERNAL | STUDENT; attachments reuse the document vault (`attachment_document_id`, must belong to the case's student).
- `Vendor` — kind, area, languages, price model, availability, SLA, contact, quality (NEW/GOOD/WATCH/SUSPENDED), `agreement {active, since, until, reference}`. `organization_id` NULL = Hangyul network (managed by Hangyul only).
- `HousingListing` — vendor rooms with rent, deposit, maintenance fee, minimum contract, commute, furnished, utilities, available from, `verification_status`. No listing feed is connected (`listing_feed: NOT_CONNECTED`).
- `UniversityArrivalInfo` — per-university flags (group residence-card filing, orientation note). Unknown = null → the student is told to ask the international office.
- `Dormitory` + application period, eligibility, meal requirement, move-in date, deposit, required documents, location. `HousingCase` + `profile`, `move_in`. `ArrivalPlan` + `flight_info` (FlightInfo: number, scheduled/estimated arrival, terminal, source MANUAL | PROVIDER, updated_at/by).

**Rules** (`server/app/services/concierge.py`)
- *State tables* (`TABLES`): AIRPORT_PICKUP (Requested → Confirmed → Driver assigned → [Flight delayed / Driver waiting] → Picked up → Completed; No-show; Cancelled), DORMITORY, HOUSING_SEARCH (Interested → Viewing → Contract review → Deposit → Confirmed → Moved in), TEMPORARY_HOUSING, RESIDENCE_CARD (Preparing → Appointment booked / University group filing → Submitted → Ready → Collected); everything else uses the generic table. `register_case_type()` lets the visa workstream plug in its VISA_SUPPORT table.
- *Honesty checks in transitions*: a driver can't be "assigned" without a provider; a pickup can't be "completed" without proof (note or photo). Students may only record their own external steps (applied on the dorm portal, paid the deposit, booked HiKorea, submitted, collected) — everything else is staff-only (409).
- *Partner label*: `student_vendor_label()` → DEMO (always, for sample providers), PARTNER (agreement active and within dates, reference required), otherwise PROVIDER (name only). "Partner housing" lists only PARTNER vendors.
- *Flight*: `FlightDataProvider` interface; only `NotConfiguredFlightProvider` exists (`HG_FLIGHT_PROVIDER` ignored until a licensed adapter is added). Flight times are MANUAL, `live` is true only for provider data; the UI says "entered by you or your counselor — not live". A counselor-recorded estimated arrival moves the pickup time; ≥ 30 min late moves Confirmed/Driver assigned to Flight delayed (and back). A student flight change on a confirmed pickup raises a "re-confirm pickup" team task.
- *Arrival*: `mark_arrived()` is the single rule (student "I've arrived", or pickup Picked up/Completed): sets the arrival date, residence-card due date (+90 days), pipeline ARRIVED, and opens the RESIDENCE_CARD case with a student task due on that date.
- *Tasks*: `sync_tasks()` keeps at most one open team task (owner org = agency, or the Hangyul org for ops-routed cases) and one student task per case; `source=CONCIERGE`, `dedupe_key=svc:<case>:…`, English `title` + `title_key task.concierge.*`. The tasks engine never touches them.
- *Help routing* (`HELP_ROUTING`): Housing, University, Payment, Other → agency counselor (24 h SLA); Medical → agency, URGENT, 4 h, emergency numbers returned; Visa/residence (VISA_SUPPORT) and Lost documents → Hangyul operations (8 h). No active assignment → Hangyul operations.
- *Journey*: `arrival_journey()` — stage QUIET (before admission) → ADMITTED (housing only; other steps locked) → READY_TO_COME (housing, flight, pickup, documents to carry, SIM/eSIM, orientation, first 90 days) → ARRIVED (residence card, health insurance, bank, SIM if not done, transport card, campus registration, emergency numbers). Each step carries `official_facts()` from `docs/research/arrival-official.json` (then `post-arrival-official.json`, then a `Source` row marked NEEDS_REVIEW) — read at request time, cached by file mtime, so a research update needs no deploy.
- *Views* (agency queue): New · needs owner (no owner, or nobody has acted yet), Waiting on student, Waiting on provider/outside office, Scheduled, Today (Seoul date), Overdue (SLA passed while waiting on the team), Completed.
- *Metrics* (`concierge_metrics(db, org_id, start, end)`): population = cases created in the period; completion = completed ÷ non-cancelled; SLA breach = acted late (or not yet and past SLA) ÷ cases whose SLA came due; arrival-support completion = completed pickups ÷ pickups whose arrival time has passed; plus pickups completed, no-shows, help requests, housing confirmed, median time to resolution and "went well" share — every rate and median withheld below n = 5.

**API** (`server/app/api/v1/concierge.py`)
- Student: `GET/POST /me/service-cases` (the brief's `/me/services` is taken by the V2 service catalogue), `POST /me/service-cases/{id}/step|cancel|feedback`, `GET /me/arrival-journey`, `PUT /me/arrival-journey/items`, `PUT /me/flight`, `POST /me/pickup`, `PUT /me/housing-plan`, `POST /me/housing/dorm-application`, `POST /me/housing/listings/{id}/interest`, `POST /me/housing/lease-review`, `GET/POST /me/help`. `GET /me/housing` (student.py) now also returns options, profile, dorm facts, listings, cases, move-in; `PUT /me/arrival {arrived}` uses `mark_arrived()`; the old `pickup_requested` boolean is no longer written.
- Agency / Hangyul: `GET /agency/service-cases?view&type&owner&student_id`, `GET|PATCH /agency/service-cases/{id}`, `POST /agency/service-cases`, `POST /agency/service-cases/{id}/events` (NOTE, FLIGHT_CHANGE, PROOF, NO_SHOW), `GET|POST|PATCH /agency/vendors`, `GET /agency/service-metrics?days`, `GET /agency/service-today`.
- Tenant isolation: students see their own cases; agency members see cases of students actively assigned to them (counselors: their own students); Hangyul sees all; universities get 403/404.

**Screens**
- Student: `/arrival` "Your first weeks in Korea" (one NEXT step, numbered steps with official source + last checked, flight form in Korea time, pickup request and status, residence-card flow with a guided HiKorea hand-off), `/housing` (five options, verified dorm facts + application tracking, labelled provider rooms, contract check, temporary stay, housing profile, move-in checklist), `/help` "Need help in Korea?" (in More → Going to Korea).
- Agency: `/services` queue (sidebar Work → Services) with case drawer (status moves, owner, provider, flight change, driver, no-show, proof photo, cost + payer, internal notes, student-visible updates, history), `/vendors` (sidebar Organization → Providers), student workspace tab "Services".

**Hooks for the coordinator**: `today_items(db, principal)` (overdue SLA, urgent help, flight delayed, re-confirm, pickup today/tomorrow, new request — each with `title_key concierge:today.*`, link `/services?case=`), `home_stage(db, student_user_id)` (stage + one next action with `concierge:step.*` keys; None before admission).

**Manual fallbacks**: every external step is recorded by a person — flight times, delays, provider confirmations, HiKorea bookings, dorm results. No portal access, no stored portal passwords, no scraping.

**Security**: server-side tenant scope on every case read/write (404 for other tenants); internal notes and INTERNAL events never serialised for students; attachments must belong to the case's student; vendor contacts only in staff payloads; all create/update actions audited (`service_case.*`, `vendor.*`); Hangyul network vendors editable only by Hangyul.

**Tests**: `server/tests/test_v5_concierge.py` (state tables, isolation, partner label, flight never live, lease flags, pickup lifecycle with delay and proof, residence-card activation, help routing, vendor rules, metrics withholding, seed coherence); `apps/student-web/src/lib/concierge.test.ts`; E2E `e2e/v5-arrival.spec.ts` (FLOW F).

**Demo data** (`server/app/seed/extra_53_concierge.py`): two DEMO network vendors without agreements, two DEMO listings near Sungkyunkwan, SAMPLE dorm facts; personas `student.visa@` (dorm application APPLIED), `student.arrival@` (Sogang, visa issued, dorm confirmed, VN408 on 20 Feb 2027, pickup requested), `student.arrived@` (Korea University, arrived 24 Aug 2026 with a completed pickup, enrolled, residence card due 22 Nov 2026).

## Limitations

- **Freshness:** research is dated 2026-09-29. Fees, NHIS amounts and carrier products change, and the 2026 NHIS premium comes from a university notice, not NHIS.
- **Unverified items:**
  - Carrier official pages did not render, so the postpaid/residence-card requirement is NEEDS_REVIEW.
  - AREX express fare, limousine payment wording and T2 counters were not verified directly.
  - 119 language support is unverified.
  - Mobile residence card eligibility is unverified.
- **Single examples:** university examples (KU, KU GSIS, GMU Korea, Konkuk, Sungshin, Soongsil, KHU) are single cases, not national rules.
- **Bank differences:** bank requirements differ by bank and branch, as KOTRA itself says.
- **Model summaries:** quotes were captured through a page-reading model. Spot-check them against the live page before using them in legal-facing copy.
- **Engineering (concierge):**
  - No live flight data, listing feed, SIM, bank or HiKorea integration — all interfaces are manual by design until a licensed provider exists.
  - Official facts are shown in the research file's English wording; they are not yet translated per locale.
  - Engine task titles use `title_key task.concierge.*`, which lives outside the `common` namespace — clients fall back to the English title until the keys are added to `common.json`.
  - No automatic reminders (e.g. 14/7/2 days before the residence-card deadline) beyond the task due date; no parent summary; no push for provider changes beyond the in-app notification.
  - Vendor quality has no automatic scoring; "quality_status" is set by staff.
  - Service metrics are shown on the Services page, not on Performance.

## V6 update (2026-10-01)

**New research (sources and dates in `docs/COMPETITOR_BENCHMARK.md`, V6 section):**
- Housing marketplaces now court foreign students directly: Dabang opened a foreigner section on 2026-09-08 (listings and broker chat machine-translated into 30+ languages) [S35]; Enkostay rents deposit-free and bookable *before* the residence card exists [S36]. Neither publishes cancellation-on-visa-refusal or safety terms — Hangyul must show those terms (or say they are unknown) before a student commits.
- Since 2025-03-21 the mobile residence card works for banking in person at six banks; only one bank allows remote opening [S38]. The arrival chain keeps "full bank account after the residence card", with the interim restricted-account step.
- Stale public facts are common (a guide updated in April 2026 still quoted the residence-card fee as KRW 30,000 rather than 35,000) — every arrival fact keeps its source and check date.
- The best Korea-focused operators publish a landing package (pickup ICN/GMP, SIM + T-money, housing with contract review, residence-card guidance, bank, hospital introduction), but run it by phone and chat with no status the student can see.

**What V6 changed in the product (presentation only — the V5 ServiceCase model, statuses and honesty rules are unchanged):**
- Provider names are realistic seed names ("Seoul Arrival Transfers", "Campus Nest Housing") instead of "Demo provider"; providers are still shown as *partners* only with an active agreement, and the development environment is disclosed once by the DEV chip, not per row.
- The marketing site tells the arrival promise ("We don't disappear after your admission": pickup, a room before you land, first weeks in order, help in your language) with licensed photography of Incheon arrivals.
- The student home opens on a destination photograph and, after the visa, leads with the arrival checklist ("Your visa is ready — let's get you there · Landing Feb 20, 2:35 PM").
- Agency: service cases appear in Today and in Hangyul operations (per type: open / late / without owner), so a late pickup is visible across all agencies.

**Still not integrated (by design, needs agreements):** live flight status, housing inventory feeds, carrier/eSIM APIs, bank onboarding, HiKorea. Flight times stay "entered manually, not live".

## V9 revalidation (2026-10-10)

Research: `docs/research/v9-arrival-revalidation.md` (31 official facts re-checked: 17 SAME, 3 CHANGED, 2 NEWLY CONFIRMED, 9 STILL UNCONFIRMED). Sources are `V9V-S118`–`S167` in `docs/research/v9-visa-sources.json`. Applied by `server/scripts/v9_visa_research_apply.py`, with the baseline archived in `docs/research/archive/`. Each topic in `arrival-official.json` now carries `v9_revalidation` (`changes[]`, `unconfirmed[]`, `verified_at`), and the cited sources are appended with their ids. The product reads these files directly (`concierge.official_facts`, cache keyed on file mtime), so the corrections are live without a DB step. This was checked through `/me/arrival-journey` for `student.arrival`.

**The 10 corrections:**

| # | Topic | Change |
|---|---|---|
| A1 | `residence_report_changes` | Address change: **15 days** (Immigration Act Art. 36, via a district office). The old "14 days" is the 외국국적동포 rule. Deadlines for a passport change and a lost card were not re-confirmed, so the topic says "promptly — check with 1345". Stays PARTIAL. |
| A2 | post-arrival `address_change_report` | Now VERIFIED (S166). |
| A3 | `transport_card_tmoney` | Climate Card: the 30-day pass ended on 2026-10-01. The card works only within Seoul. Short-term passes continue; the replacement benefit is for Seoul citizens only. |
| A4 | `sim_esim_arrival` | ICN T2 counters: 24-hour KT and LG U+ near Exit 4, SKT near Exit 7 (1F). |
| A5 | `university_airport_pickup` | Removed "free or low-cost". KU's notice states no price. Added KU's winter shuttle as an example. |
| A6 | `nhis_student_premium` | About KRW 79,320 a month (2026), from Sungshin, SeoulTech and Sogang. Still labelled "not stated by NHIS". |
| A7 | `bank_account_opening` | Restricted-account limits (3M / 1M / 1M) now cited to the FSC. |
| A8 | `residence_card_registration` | Whether you must book is set by each office (Sejongno suspended walk-ins from 2026-03-13 to 04-03). "Cash only" is flagged as unconfirmed. **Status VERIFIED → PARTIAL**, because payment method and processing time are unconfirmed. |
| A9 | `private_insurance_bridge` | No immigration rule requires private insurance for D-2/D-4. Some D-4 language institutes require 6-month group insurance. |
| A10 | `emergency_and_helplines` | 1330 is also reachable by chat (KakaoTalk, Line, WhatsApp, Facebook) and by free online call. |

**Still unconfirmed — needs a human call or email:**
1. The NHIS 2026 student premium, from NHIS itself (033-811-2000).
2. Whether the residence-card fee can be paid by card at the offices Hangyul targets.
3. Processing time for the residence card. There is no official MOJ figure.
4. Deadlines for reporting a passport change and a lost card, from the Immigration Act text.
5. Carrier tourist eSIM/SIM prices and whether a phone number is included. Also whether a postpaid plan needs the residence card.
6. The AREX all-stop fare on the official AREX site.
7. Whether 119 offers interpretation, and in which languages.
8. Topics not re-checked in V9: `mobile_residence_card`, `orientation_course_registration`, `residence_card_group_application`.
9. For any provider (Trazy van, Enkostay, Borderless, Woozoo, Klook/KKday): the named operator and licence, price lists and affiliate terms, in writing. **No provider is a partner**, so §4 of the research is a checklist for an agreement, not a description of one.
