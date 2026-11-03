# V8 University workstream log

*Resumed 2026-10-09 after an interrupted run (no log had been written). Snapshots: `/root/hangyul-univ-snapshots/v8-university/` (taken by the first run before its edits; `snap.sh` copies once).*

## 0. Inventory of the interrupted run (diffed against the snapshots)

| Area | State found |
|---|---|
| `models/v8_university.py` + migration `a8u1b2c3d4e5` | Done: `application_admin_checks` (one audited row per application, never a decision), `export_presets` (saved configuration, `schedule` MANUAL). Applied; head. |
| `services/access.py` | Done: `university_visible()` — the one university population (reached submission; pre-submission withdrawals excluded), used by tenancy and every breakdown. |
| `services/metrics.py` | Done: `GLOSSARY` (numerator, denominator, population, intake, date range, small-sample rule per metric); `_context`/`_compute` split; `pipeline_by(dim)` one-pass grouping; `reached_ids(step)` for funnel drill-down. |
| `services/analytics.py` | Done: `intake_clause` (YYYY-TERM or intake id); `university_breakdown` (counts with the filter value that reproduces them); per-agency figures from one pass (was one metrics call per agency → 25.5 s). |
| `GET /applications` | Done: `intake`, `degree`, `reviewer`, `admin_check`, `reached`, `ids` filters; `admin_check` on list items and detail; reviewer must be an active non-analyst member. |
| `api/v1/university.py` | Done: `GET /university/glossary`; `POST /university/bulk/{assign-reviewer,document-request,admin-check}` with per-item results; `DELETE …/admin-check`; export presets (`GET/POST/DELETE /university/export-presets`, `GET /university/export/preset/{kind}.csv`); filtered/selected `export/applications.csv`; `GET /university/programs/{id}/rule-history`. |
| Tests | **Not started** (no V8 university test file). |
| Frontend (`apps/university-web`), i18n, types | **Not started** (no file differs from the snapshot). |

## 1. Mandate status (REPORT §47–50)

| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 1 | `GET /applications` `intake` (id or YYYY-TERM) + `degree` (+ reviewer, admin_check, reached, ids), tenancy-safe; pytest breakdown = list total | **Done** | `tests/test_v8_university.py` (13 tests): every Overview/Analytics breakdown and funnel step equals the filtered list, unfiltered and under intake / degree / both; cross-tenant ids/programs return 0. Found and fixed a falsy-zero bug (`reached=SUBMITTED` dropped applications sitting exactly at SUBMITTED) and aligned the funnel population with `university_visible()`. |
| 2 | Analytics drill-down, chips + total, < 2 s, glossary, Q/I/A, no donuts/rainbow | **Done** | Every bar/row → Applicants with the same filters; chips + "N applicants match". API 0.07–0.36 s (was one metrics call per agency); page to content 1.3–1.4 s at 1024 (dev, cold), 0.28 s in-app (was 25.5 s). Glossary served by `GET /university/glossary`, "How we count" drawer (en/ko). Register §4. Agencies page 3-colour series removed. |
| 3 | Applicants column priority, 0 sideways tables 768–1440, board replaces /pipeline, safe bulk actions with per-item results + tenancy tests | **Done** | Probe + capture: `sideScrollTables` 0 on every university route at 768/1024/1280/1440. `/pipeline` → `/applicants?view=board` (filters kept). Bulk: assign reviewer, standard document request (same service call + audit + task regeneration as the single action), export selected, admin check (audited, undoable) — no admit/reject (404). |
| 4 | Applicant review "Can I make a decision now?" ≤ 3 screens at 1440, one h1 | **Done** | 5.1 → 2.4 screens (capture persona) / 1.4 (walk persona) at 1440; h1 2 → 1. Requirement \| evidence \| status table first, statements one click (drawer), decision panel with "open the next applicant after deciding". |
| 5 | Overview: decisions → this intake's progress; lifecycle to Analytics; numbers link | **Done** | 4.8 → 2.6 screens at 1024; every count links (stat cards → lists, funnel → `reached=` for the intake). |
| 6 | Exports presets, contents, personal-data warning, last run, saved configuration, schedule disabled | **Done** | 5 presets; saved configurations (DB `export_presets`); Schedule disabled "needs a scheduled-jobs worker". |
| 7 | Messages tied to applications; real empty state | **Done** | Rows show applicant + application + status; tabs; empty state explains how a conversation starts. |
| 8 | Programs & rules: no fixture default, `/rules` merged, change history, effective intake, preview kept | **Done** | Inactive/fixture sorted last + "Not offered"; history API + card; "In effect from the X intake". |
| 9 | Secondary pages; branded login (`AuthCover`) | **Done / partial** | Agencies rebuilt (single hue, drill links, no readiness %); Offers honours intake/degree + priorities + drill links; Partnership/Cohorts/Scholarships tables wrap instead of scrolling (768+). Login uses `AuthCover` (navy) with en/ko copy, SSO option kept. Partial: Cohorts/Partnership/Analytics still scroll one table sideways **at 390** (outside the 768–1440 mandate); Documents/Settings/Notifications unchanged beyond the shared fixes. |

## 2. Server (this run)

- `tests/test_v8_university.py` (13 tests, green): every Analytics breakdown (status, intake, degree, program, nationality, agency) equals `GET /applications` total with the same filter — unfiltered and under intake, degree, intake+degree; every funnel step equals `reached=STEP`; intake key/id accepted, garbage 422; ids/program filters cannot widen across tenants; analytics < 2 s; glossary completeness; bulk: write roles only, no decision actions (404), per-item results incl. other-tenant ids and garbage ids (`not_found`), admin check idempotent + audited + never changes status, undo tenant-safe; reviewer must be an active non-analyst member of the caller's org; bulk document request = single request (OPEN, same category), decided applications reported `not_requestable`; export presets shape, last run, saved configuration (column/filter whitelist), cross-tenant run/delete 404, analyst 403; export of selected ids only; rule history tenant-scoped.
- Glossary gained language-neutral `codes` (population / intake / date range / small-sample) so the console renders it in Korean; English stays the reference.

## 3. Console changes (this run)

| Area | Change |
|---|---|
| Applicants | Column priority (`meta.priority/minWidth`): Applicant(1) · Program(2) · Country(3) · Status(2) · Documents(3) · **Decision need**(2) · Updated(4) · Submitted(5) · Agency(6); avatar hidden < 1280. Decision need = one answer per row (waiting for N documents / returned — review again / below: X / check: X / N unverified / interview / ready to decide). Removable filter chips + "N applicants match" for intake, degree, program, country, agency, reached, reviewer, admin check, flag, requests. Filters drawer gains intake, degree, reviewer, admin check, funnel step. List ↔ Board toggle (board = old Pipeline, no readiness %). Safe bulk bar (DataTable `bulkActions`): assign reviewer, request a standard document, mark admin check, export selected — result dialog per item. "Export this list" exports the current filters. |
| `/pipeline` | Redirects to `/applicants?view=board` keeping filters; page deleted (sidebar never had it in V7). |
| Analytics | Drill-downs always exact (intake + degree passed through; V7 disabled them under filters). Funnel counts → `reached=STEP`; status, country, program (by id, not name), intake, degree, agency (applications / offers / enrolled), after-admission rates, comparison cells → Applicants. Agency table from one API pass (no per-agency `useQueries`); no sideways scroll (container-query column folding). New "Which intakes and degrees carry the demand?" card. "How we count" drawer = API glossary, translated. Colours: single-hue bars (primary) — no rainbow; no donut. |
| Applicant review | One h1 (student name; PageHeader replaced by breadcrumb). "Can a decision be made now?" first: verdict line + one table requirement \| evidence \| status, required documents as rows (open in place), requests below, optional documents folded. Statements one click away (drawer from the header). Education record and history folded (`<details>`). Decision panel: calm, sticky ≥ 1200, primary + secondary, **"Open the next applicant after deciding"** (remembered per browser), only after a real decision. Admin check visible and toggleable (audited). |
| Overview | Needs your decision → **This intake's progress** (funnel; every count links to `reached=` for that intake) + waiting on applicants + coming up. Rankings, after-admission and preparation evidence moved out (Analytics / Cohorts / Partnership). |
| Exports | Five job presets (current intake applicants, admitted, visa status, enrolment, cohort outcomes) with contents, personal-data warning, last run; saved configurations (columns + filters, shared with the team, run/delete); Schedule button disabled with "needs a scheduled-jobs worker"; old reports folded under "Other reports"; history labels presets. |
| Programs & rules | Never opens on an inactive program / development fixture (active first, "Not offered" badge); change history (proposals with proposer/reviewer, direct publications, before → after); "In effect from the X intake"; intakes table folds optional columns instead of scrolling; preview as student kept. `/rules` already redirected. |
| Messages | Real empty state (how conversations start, link to Applicants / the application); list rows show applicant + application + status; tabs All / About an application / Unread. |

## 4. Analytics chart register (QUESTION / INSIGHT / ACTION) — dev data, Pusan National University, all intakes

Every row drills down to Applicants with the same filters; the count on the Applicants chip line equals the bar (pytest `test_breakdowns_*`). Population for all pipeline charts: 11 submitted applications (4 more are in preparation — one aggregate number, never a list). No donuts; bars are single-hue (primary); the only two-series chart (markets that enrol: enrolled vs retained) uses two neutral categorical tokens.

| Chart | QUESTION | INSIGHT (dev data) | ACTION it supports | Drill-down |
|---|---|---|---|---|
| Admissions funnel | Where do submitted applications stop? | 11 submitted → 11 reviewed → 5 offered → 4 accepted → 4 paid → 3 visas → 3 arrived → 3 enrolled; conversions below n=5 withheld | Chase the step with the largest rated drop (here offer → decision mix) | each count → `reached=STEP` |
| Where are applications now? | What is in each status today? | 3 enrolled, 2 waiting for documents, 2 in review, 1 interview, 1 offer, 1 visa, 1 waitlisted | Clear review/documents first; nudge the open offer | each status → `status=` |
| Countries | Which markets apply? | CN 3, VN 3; five markets with 1 | Target recruitment / agency briefings at CN and VN | `nationality=` |
| Programs | Which programs attract demand? | BBA 4; Economics transfer, Korean Language, Media 2 each; M.A. 1 | Add seats / reviewers where demand is | `program_id=` (by id) |
| Intakes and degrees (new) | Which intakes and degrees carry the demand? | Spring 2027 5 (current), Spring 2026 3, Winter 2026 2, Fall 2025 1; Bachelor 6 | Staff the current intake; see degree mix at a glance | `intake=`, `degree=` |
| Agencies | Which agencies send applications we can decide on? | 4 agencies, 1–4 applications each → every rate withheld (n<5) — the table says so instead of a noisy %. | Watch volume until rates are rateable; drill to the files | applications / offers / enrolled → `agency_id` (+ `reached`) |
| After admission | How many admitted get visas, arrive, enrol? | accepted 4/5, visa 3/4, arrival 3/3, enrol 3/3 — all withheld below n=5 | Nothing to act on yet (honest) | numerators → `reached=` |
| Markets that enrol | Which markets enrol and stay? | enrolment records by nationality (cohort population, separate) | Partnership planning | → Cohorts |
| Funnel comparison | Does one segment convert worse? | up to 4 segments side by side; cells link | Compare agencies/countries before acting | cell → segment + `reached=` |
| Submissions per month | When do applications arrive? | 2 in Aug, 5 in Sep 2026 | Reviewer capacity planning | (aggregate; hidden below n=5) |


## 5. Measurements V7 → V8

Capture: `OUT=docs/qa/v8/after node scripts/qa/v8-capture.mjs university` (before: `docs/qa/v8/before/university/`). Dev stack, shared machine (another workstream ran Chromium concurrently — 41 processes during the final capture), so capture `ms` (networkidle + 500 ms) is noisy; time-to-content was measured separately with one browser.

| Measure | V7 | V8 |
|---|---|---|
| Analytics load @1024 | 25.5 s (capture) | API 0.07–0.36 s; page to content 1.3–1.4 s cold, 0.28 s in-app; capture 2.4–3.6 s under contention |
| The two 12 s outliers of the first after-capture (offers@1024, analytics@1440) | — | re-measured: offers 2.5 s capture / 0.55 s to content; analytics 1.3–1.4 s to content → contention, not the app |
| Applicant review height @1440 / @1024 / @390 | 5.1 / 6.2 / 9.2 screens | 2.4 / 3.9 / 5.3 |
| Applicant review h1 | 2 | 1 |
| Overview height @1024 / @1440 | 4.8 / 2.2 | 2.6 / 1.4 |
| Sideways tables, university, all captured views | 14 | 0 at 1024/1440 (and 0 at 768/1280 by probe); 3 remain at 390 |
| Page overflow | 0 | 0 |

**Admissions task** (scripted, read-only: dialogs opened and cancelled; `pending → eligibility → document → statement → request → returned → decision → analytics drill-down`):

| | V8 @1440 | V8 @1024 |
|---|---|---|
| Clicks (incl. 3 cancels/closes and 1 intake select) | 14 | 14 |
| Wall time (dev, includes page loads) | 49 s | 47 s |
| Scroll to see the full evidence table | 0 px (table 420–952 px in a 900 px viewport: last row just below the fold) | 709 px (header and decision panel stack above it) |
| Decision button in first viewport | yes | yes |
| Dead ends | 0 | 0 |
| Drill-down exact | bar 1 = list 1 (Spring 2027, reached Offered), 2 chips | same |

V7 comparison (from the before capture and the V7 code, not a scripted V7 run — the V7 UI no longer exists): the statement was a section ~3 screens down the review page (scroll, no click); documents were a separate section below eligibility; the analytics drill-down was **disabled whenever an intake or degree filter was on** (a dead end for this task); Overview had no per-intake links. So V7 had ≥ 1 dead end and ~4 screens of scrolling on the review page at 1440 for the same path.

## 6. Open issues

- Phones (390): Analytics (outcomes table inside the folded "Life after admission" disclosure), Cohorts and Partnership still scroll one table sideways inside its card. Analytics is 6.8–7.7 phone screens (V7 measured 1 screen at 390 because it had not finished loading).
- Analytics @1024 is 7.1 screens (V7 6.2): it now also holds what left Overview (rankings, after admission) and the new intake/degree card; the outcomes table is folded.
- Applicant review @1024: the header card + decision panel push the evidence table to 853 px (below a 768 px viewport). A compact header at < 1200 px would bring it into the first view.
- Bulk actions work on the current page selection only (DataTable selection is per page); no "select all N matching".
- Saved export configurations run by hand; scheduling needs a jobs worker (shown disabled).
- `useFilterOptions` still loads the full analytics payload for the country list (fast now, but one request more than needed).
- Glossary definitions: client-translated by key; any new server metric falls back to the English text until a key is added.
- DataTable: no changes (bug-fix-only rule respected).
- Agency workstream's `AuthCover` adopted as-is; no ynex-ui changes from this workstream.

## 7. Gates at hand-off

pytest green (full suite after the fix; coordinator reports 257), ruff clean, university typecheck clean, vitest 60 passed (incl. `src/lib/v8.test.ts`, 8 tests), `npm run i18n:check` OK (en/ko `university.v8` 0-key diff; pre-existing ko `_one` plural gaps unchanged). E2E selectors kept: "Needs your decision" heading, "Needs review" tab, "Request documents" button + dialog ids (`#rq-cat`, `#rq-label`, `#rq-note`), `.uc-requests`.
