# V9 university workstream log (2026-10-10)

Scope: REPORT §60 U1–U8 and the university items of §55 (#18–22). Reason to care (research `v9-operating-model.md` §2 #1–4, §5): MOJ plans to put the agency on the CoA and to score universities on visa refusal — agency quality and post-admission outcomes become the university's own problem.

Screens: `docs/qa/v9/university/after/` (route capture via `scripts/qa/v9-capture.mjs`, metrics in `after/metrics.json`), interactive states in `after/tabs/` (`scripts/qa/_v9uni-interact.mjs`). Before: `docs/qa/v9/before/`.

## Measured (before → after, `metrics.json`)

| View | screens before → after | sideways tables before → after |
|---|---|---|
| applicant @1024 | 3.9 → 2.9 (evidence table is the first content after a one-line header) | 0 → 0 |
| applicant @1440 | 2.4 → 1.5 | 0 → 0 |
| applicant @360 / @390 | 6.2 → 4.3 / 5.3 → 3.7 | **1 → 0** / 0 → 0 |
| analytics @1024 (Overview tab) | 7.1 → 2.0; Recruitment 2.2, Quality 1.6, Outcomes 2.4 | 0 → 0 |
| analytics @390 | 7.7 → 2.0 (Outcomes tab 2.2) | **1 → 0** |
| cohorts @390 | 1.9 → 1.7 | **1 → 0** |
| partnership @390 | 4.8 → 3.9 | **1 → 0** |
| overview @1024/@1440 | 2.6 → 2.7 / 1.4 → 1.8 (things moved below the funnel on purpose) | 0 |

All university routes at 320–1728: 0 sideways tables, 0 page overflow, 0 page errors.

## Changes

| Item | Why | Files / API | Test |
|---|---|---|---|
| U1 Overview | §55 #18 context; "nothing else above the fold" | `pages/Dashboard.tsx`: decisions → intake progress (full width) → "Also today" (waiting on applicants, coming up) below the fold; the "enrolled students with a warning" row (lifecycle) removed — lifecycle stays in Analytics ("Post-admission outcomes" tab). Decision cards fit 4 across at 1024. | screenshots |
| U2 Applicant review | §55 #18 decision before evidence | `pages/ApplicationDetail.tsx`: one-line header (name · status · country · program · intake · agency; icon actions). Evidence table first. Decision panel in a side column ≥1280, after the evidence <1280 (rendered once, `useNarrow('(min-width:1280px)')`). `decisionPlanV9`: no primary until the evidence sentinel (end of the table) has been on screen; then the natural step given the evidence — start review; in review: *Make offer* only when every requirement is met and documents verified, *Request documents* when items are open, **no** dominant action when a minimum is not met. Review-and-advance also after a document request ("Open the next applicant after deciding or requesting documents", queue position kept). Document request history: open + 2 latest answered, rest behind a toggle (dev DB had 10 E2E leftovers pushing the evidence down). Statements reader, documents, history kept. Phones: evidence rows stack (requirement / evidence + status) — fixes the 360 px sideways table. | vitest `lib/v9.test.ts` (decision plan) |
| Agency identity | §59 A12 / research #1 | `GET /university/applications/{id}/agency` uses the agency workstream's `services/agency_ops.agency_identity` (legal name, registration — `NOT_RECORDED` until real, responsible counselor, sub-agent); falls back to the application's own agency if the student changed agency. Shown in Application details: Agency · Legal name · Registration (Korean mission) "Not recorded" · Responsible counselor. | `test_agency_identity_not_recorded_and_tenant` |
| U3 Select all matching | §55 #22 | `POST /university/bulk-filter/{assign-reviewer|document-request|admin-check|export}/preview` (count, eligible, skipped by reason, first 8 rows) and `POST /university/bulk-filter/{action}` (per-item results; `expected_total` → 409 if the set changed since the preview; cap 1000). Reuses the V8 per-item logic (`_bulk_params`, `_bulk_one`, `_bulk_finish` — V8 `/bulk/{action}` now calls them, same behaviour). Filter clauses mirror `GET /applications` (`_list_stmt`); parity guarded by a test over 8 filter sets. No decision action exists (404). UI: `components/v8/BulkActions.tsx` — "Select all N matching" appears when the whole page is selected and more rows match; every action modal shows the server preview first. | 6 tests in `test_v9_university.py` |
| U4 Phones | §55 #19 | `components/v9/SummaryList.tsx` (summary row + `<details>` evidence) used by: Analytics agency/countries/programs tables, Outcomes table, Cohorts summary table + student term table, Partnership quotas, pools, visa-by-agency. `useNarrow()` (<576 px). | metrics above |
| U5 Analytics by question | §55 #20 | `pages/Analytics.tsx`: tabs Overview · Recruitment · Admissions quality · Post-admission outcomes (`?tab=`). Blocks titled by question: *Where are applicants dropping?*, *Where are applications now?*, *Which countries convert to enrollment?*, *Which programs attract qualified demand?*, *When do applications arrive?*, *Which partner agencies send complete applications?*, *How prepared do applications arrive?*, *How many admitted students receive visas, arrive and remain enrolled?*, *Which groups stay after admission?*. Removed (noise for these questions): ranked nationality/program bars (replaced by conversion tables), intake/degree card (filters cover it), "markets enrol" chart (duplicate of countries), funnel comparison. New `GET /university/analytics/questions` (`services/analytics.university_questions`). Drill-down: every count → Applicants with the same filters (+ `reached` / new `eligibility`) → record. **Additive to the shared applications API:** `GET /applications?eligibility=MEETS|BELOW|TO_CHECK|UNKNOWN` (university/Hangyul only; same check as the row summary). | `test_question_rows_equal_drilldowns` (countries: submitted/offered/enrolled; programs: submitted/qualified/offered — under no filter and a degree filter) |
| U6 Rule impact | §55 #21 | `services/university_value.requirement_impact` + `POST /university/programs/{id}/impact-preview`; pending proposals carry `impact` in `GET /university/requirement-proposals`. Population = saved this program ∪ active non-submitted application ∪ latest match snapshot STRONG/COMPETITIVE, minus students who already submitted. Three-valued evaluation per changed dimension (GPA, prior education, language incl. "either test"); a number is shown **only** when every counted profile is determinable, otherwise "Not enough data to estimate (N of M profiles lack X)". UI: live in the rules form (`components/v9/ImpactNote.tsx`, debounced) and in the pending-proposal diff; student preview + change history kept. Additive: `min_prior_education` accepted by the requirement patch/proposal and editable in the form. | `test_impact_logic_three_valued`, `test_impact_preview_counts_and_insufficient_data`, tenant/role test |
| U7 Partnership value | research #2 (visa-refusal scoring) | `GET /university/partnership-value?intake=` (`services/university_value.partnership_value` / `visa_outcomes`): complete on first review, extra-document rate, median review time, offer rate (decided), acceptance, tuition paid, visa issued, arrival, enrollment, retention, graduation — each with value, numerator, denominator, cohort label, definition; n<5 withheld. Visa outcome per agency (applications that reached tuition paid): issued / refused (only when recorded on the visa case) / no decision recorded, refusal rate withheld below 5. UI: `pages/Partnership.tsx` value panel with intake selector. | 2 tests |
| U8 Reviewer leaves | §55 #29 (staff leaving) | `GET /university/team` (+`is_active`, `open_assignments`, additive), `GET /university/team/{user}/assignments`, `POST /university/team/{user}/deactivate {reassign_to, note}` (admin only; refuses without a valid active non-analyst target when open applicants exist; self → 409; last admin → 409; reassignment + deactivation in one transaction, each audited), `POST …/reactivate`, `GET /university/orphaned-assignments` (reviewer lost access elsewhere). UI: `components/v9/TeamManager.tsx` on Settings & team (remove-access modal lists the applicants and the hand-over target; orphan callout with one-step reassignment). | `test_reviewer_deactivation_reassigns_open_applicants`, `test_orphans_are_listed_when_access_removed_elsewhere` |

## Data

* Seed `server/app/seed/extra_91_university.py` + live script `server/scripts/v9_university_data.py` (applied: 525 snapshots, 2 assignments): the matching engine's own output persisted as match snapshots for Pusan National's programs (same call as `POST /student/matches/snapshot`), and the faculty reviewer holds the two oldest open applicants awaiting decision (hand-over demo). No migration needed.
* i18n: 122 keys under `university.v9` in en + ko, generated by `scripts/i18n/v9-university.py` (parity asserted by the script).

## Tests

* `server/tests/test_v9_university.py`: 16 tests (tenant isolation for every new endpoint; student/analyst/reviewer role checks). University suites + flows/security/seed/rules: 80 passed.
* Updated existing test (on purpose): `tests/test_v3_university.py::_app_under_review` now picks deterministically by status preference — it took the first row in physical order, which changes once other tests update applications (and could return an INTERVIEW application, which cannot move to "additional documents").
* vitest university-web: 68 passed (new `lib/v9.test.ts`; `lib/forms.test.ts` updated for `min_prior_education` in the rules payload). `tsc` clean, `vite build` ok.

## Not done / known gaps

* "Waiting for applicant" wording: `services/waiting.py` (agency workstream) classifies agency caseload rows in SQL; the university queue already splits university vs applicant with the same meaning (offer awaiting reply / documents requested / tuition invoice), so it was not wired in.
* Bulk result modal names rows outside the current page by id prefix (names only for the visible page).
* Impact preview: the dev DB has no students who *saved a specific program* (saves are university-level), so "saved" counts are 0; strictness means adding a brand-new minimum (e.g. IELTS on a TOPIK-only program) usually yields "Not enough data" — intended.
* Dev data is small (11 Pusan applications): most rates are withheld (n<5) — shown as "Too few to rate · n of N".
* Not verified on a device; Korean screens not eyeballed (keys present, parity checked).
