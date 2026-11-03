# V7 workstream log — University console (YNEX)

*2026-10-09. Scope: `apps/university-web/**`, `packages/i18n/locales/{en,ko}/university.json` (new `v7.*` subtree). Originals snapshotted to
`/root/hangyul-univ-snapshots/v7-university/` (whole `apps/university-web/src` + both university.json; helpers `snap.sh`, `i18n_add.py`, key files `k-*.json`).
Nothing in `packages/ynex-ui`, `packages/ui`, other apps or `server/` was edited.*

## Files

| File | Change |
|---|---|
| `src/ynex-university.css` (new, imported in `main.tsx` after `styles.css`) | All V7 university compositions under `.uv7` (decision strip, funnel table, ranked lists, lifecycle icon stats, review header/sticky decision, programs master-detail + settings rows, analytics chart cards, Panel-as-card). Logical properties only. |
| `src/components/ynex.tsx` (new) | `yxTone()`, `YAvatar`, `useStatusLabel()`, `StatusSoft` (university wording from STATE_MAP as a soft badge), `CardLink`, `RateText` (value + "n of N", withheld below 5). |
| `src/components/Panel.tsx` | Now renders YNEX card anatomy (`card custom-card` · accent `card-title` · body · dashed footer) — upgrades every page that uses Panel (Offers, Partnership, Cohorts, FunnelComparison…). |
| `src/components/AdmissionsFunnel.tsx` | YNEX table + inline progress (index-10), phase colours (review / offer / arrival), **"Largest drop"** marked in text on the lowest *rated* conversion (`largestDrop()`), phone layout = two-line rows (no clipped column). |
| `src/components/Preparation.tsx` | `Fact` takes an optional icon/tone (YNEX "Applicants summary" icon stat); label stays in `<dt>`. |
| `src/pages/Dashboard.tsx` | Rewritten (Overview). Exports kept: `queueItems`, `upcomingDates` (now also returns program ids), `funnelRate`, `PopulationNote`, `PopulationLine`, `useOverviewIntake`. |
| `src/pages/Applicants.tsx` | YNEX crm-contacts card; logic, URL params, views, filters, sort, server CSV export, pagination unchanged. |
| `src/pages/ApplicationDetail.tsx` | Layout rebuilt (job-candidate-details/profile); every dialog, mutation and `eligibilityRows` / `decisionPlan` unchanged. |
| `src/pages/Programs.tsx` | Master-detail rebuilt; `RulesForm`, proposals, StudentPreview drawer unchanged. `AdmissionRules.tsx` untouched (redirect). |
| `src/pages/Analytics.tsx` | Rewritten around questions (register below). `Outcomes.tsx`: placeholder fade → `aria-busy`. |
| `src/pages/Cohorts.tsx` | Outcomes tab wrapped in two cards. |
| Agencies, Documents, Exports, Pipeline, Partnership, Offers, Settings, Notifications, Scholarships, Messages | YNEX `PageHeader`, `.uv7` frame. |

## Screens

### 1. Overview (`/`)
- **YNEX source:** `index-8.html` (HRM `hrm-main-card` strip, "Upcoming Events" `timeline-widget`, "Applicants Summary" icon stats), `index-10.html` (inline progress table), `index-6.html` (traffic-source ranked rows), `index.html` page header with two buttons.
- **Hierarchy:** page header (university · date; Analytics / Applicants buttons) → **Needs your decision** (h2 kept for e2e) = HRM stat strip: Awaiting review, Documents returned, Interviews, Waitlisted always; Tuition invoices to issue, Admission letters to issue, Flagged only when non-zero. Each card uses the existing `queueItems()` link (single returned application opens directly). Zero = grey value, not a link. "Open all awaiting decision" → `PENDING_DECISION` list. → **Admissions funnel** for the current intake (intake select in the card header, summary "5 submitted · 1 offered · 0 enrolled", population line, YNEX funnel table, population/foot note) beside **Coming up** (`DateTimeline`; badge red ≤ 7 days, amber ≤ 21; one program → `/programs?program=id`). → **Waiting on applicants** (applicant-side queue items + enrolled students with warnings → `/cohorts/risk`), **Where applicants come from**, **Which programs attract demand** (ProgressRow, % share, all intakes, each row → applicants filtered by nationality / program). → **After admission** (Admitted → Visa issued → Arrived → Enrolled for Hangyul applications, "x% of previous" only when previous ≥ 5; then retention / graduation from enrolment records, separately labelled) beside **How Hangyul applications arrive** (V6 facts as YNEX icon stats, n always shown, withheld < 5).
- **Removed:** nothing functional. The V6 "decision list" sentences became stat cards; the applicant-side rows moved to their own card.
- Origins/demand use **all intakes** on purpose: the applicant list cannot filter by intake, so only an all-intake breakdown can drill down exactly (stated in each card footer).

### 2. Applicants (`/applicants`)
- **YNEX source:** `crm-contacts.html` (card title + count badge, `btn-success-light` "Export as CSV", tinted table head, avatar + 2-line name cell, soft badges), `navs_tabs.html` tab-style-2.
- Card "Submitted applications (n)", export (desktop only, `canExport`). View tabs inside the card with count pills — Needs review · Documents requested · Interview · Offers & waitlist · Admitted · Visa & arrival · All (`role=tab`, arrow keys move/select; "Needs review" pill highlighted when non-zero). Toolbar (search, program, nationality, more filters drawer, sort) unchanged.
- Columns: Applicant (avatar, name, flag icon, flag-emoji + country), Program (name + intake), Agency, Eligibility, Documents, **Status (soft badge, short university wording)**, Submitted, Updated. Nationality/intake merged into two-line cells so the table fits 1440 without scrolling; 768–1279 the table scrolls inside the card (min-width 1020), never the page. Phone cards: avatar, name, status badge, program · intake, country · documents.

### 3. Applicant review (`/applications/:id`)
- **YNEX source:** `job-candidate-details.html` (header card with XL avatar, verified badge → status, meta with icons, CTAs), `profile.html` (tab strip at the bottom of the header card → section jump links; activity timeline → status history), `projects-overview.html` (meta strip → facts row).
- Top bar: breadcrumb (Applicants › name) + **n of N awaiting decision · ‹ / Next ›** (YNEX btn-group). Header card: avatar, name (h1), status soft badge, flagged badge, country / program · degree / intake / via agency / submitted, submission evidence; Message (primary-light) + Flag; facts row (checklist verified, document requests, statements, deadline); jump links.
- Main column cards: Requirements vs applicant (table, verdict soft badges), Document checklist (requests list keeps `.uc-requests`; "Request documents" in the card header), Statements (reader-first column kept: tabs, word count vs limit, version, approval date, audit note), Academic record, Flags, Status history (dotted timeline, current state filled).
- **Decision**: side card with a cobalt top rule — state sentence, one full-width primary action, quiet outline secondaries, Reject last in outline-danger. Desktop: sticky side column (decision + application details incl. reviewer / reference editors + conversations link). Below 1200 px the side column uses `display: contents`: **decision card moves above Requirements**, details follow the main column (as before). All modals (decision, request `#rq-*`, flag, message) unchanged.

### 4. Programs & rules (`/programs`, `/rules` → redirect)
- **YNEX source:** `file-manager.html`/`mail.html` list pane (left list card with filters, active item rule), `job-candidate-details.html` header, `form_layout.html` (settings rows: label column / value column in a bordered group).
- Left: "Programs (n)" card — search, degree select, items (name, degree · closes date · n applications, "pending" badge); sticky ≥ 1024; phones use the existing select. Right: program header card (icon, names, degree · language · field, open/no-open badge, provenance, "n applications" → applicants, **Preview as student**) with a facts strip (tuition/semester + year, application fee, duration, next deadline + days left); **Admission rules** card: pending proposals (diff table, publish/discard), read view as settings rows + **"Students will see"** panel (the same `requirementLines()` sentences the student reads) with a **Public page ↗** link to the marketing program page (`VITE_MARKETING_URL` or, in dev only, `http://localhost:3100` + `/universities/<slug>?program=<id>`; hidden when the address is unknown) and the existing preview drawer; edit/propose opens the unchanged `RulesForm`. Unpublished rules show an honest empty state instead of "No minimum" rows. Intakes table card.

### 5. Analytics (`/analytics`) and Students (`/cohorts`)
- **YNEX source:** `index-6.html` (chart cards with header tools, traffic table with inline progress), `index-10.html`, `apex-bar-charts.html` / `apex-column-charts.html` (legend top/bottom, light grid, rounded bars — on Recharts, still lazy).
- Filter bar in a card; then the cards in the register below. Drill-downs only when exact: the applicant list filters by nationality / program / agency, **not intake or degree**, so with those filters on, rows are not links and a footnote says why (previously links ignored the intake).
- `/cohorts`: tabs unchanged; outcomes tab now two cards (After admission summary, Student outcomes table).

#### Chart register

| Card | QUESTION | DATA | DECISION | Drill-down | Kept? |
|---|---|---|---|---|---|
| Overview · Needs your decision (stat strip) | What is waiting on my team? | `/university/attention` | Open that queue and decide | Each card → exact list (`queueItems`) | Kept |
| Overview / Analytics · Admissions funnel (table + bars) | Where are applications dropping? | `/university/admissions-funnel` (one population: submitted; intake filter) | Act on the step marked "Largest drop" (e.g. review backlog, offer policy) | No exact list per *reached* step (closed applications leave current-status lists) → "Where are applications now?" provides the lists | Kept |
| Analytics · Where are applications now? (progress rows) | Which current states hold applications? | `analytics.status_distribution` (pre-submission aggregated, not listed) | Clear the stuck state | Each status → applicants?status= | **New** (replaces the "Status" dimension of the old segmented breakdown) |
| Overview / Analytics · Which countries apply (ranked) | Which markets send applicants? | `by_nationality` (submitted) | Focus recruitment/agency effort | → applicants?nationality= | Kept |
| Overview / Analytics · Which programs attract demand (ranked) | Which programs attract demand? | `by_program` (submitted) | Seats/marketing per program | → applicants?program_id= | Kept |
| Analytics · Which agencies submit complete applications (table + bar) | Which partners send complete files? | Per agency: `metrics?agency_id=` → `complete_on_first_review` (withheld < 5), `avg_readiness_at_submission`, offers, offer rate, enrolled | Raise quality issues with weak partners / prefer strong ones | Agency name → applicants?agency_id= | Rebuilt (was a dimension of the breakdown; now the actual "complete" metric) |
| Analytics · What happens after admission (progress rows) | How many admitted accept, get visas, arrive, enrol; how many stay / graduate? | `metrics.pipeline.metrics` (acceptance, visa_conversion, arrival_rate, enrollment_rate; filters apply) + `metrics.cohorts.total` (retention, graduation) | Flag visa / arrival risk to Hangyul; retention follow-up | Retention → /retention, Graduation → /graduation | Kept (was a fact panel) |
| Analytics · Which markets enrol and stay (horizontal bars) | Which countries produce enrolled, retained students? | `/university/outcomes?by=nationality` (enrolment records, all cohorts) | Prioritise markets that enrol *and* stay | None — no student list filters by nationality (stated) | **New** |
| Analytics · Which segments produce enrolled students (comparison table) | Do specific countries/programs/agencies/intakes convert differently? | Admissions funnel per segment (same population) | Compare partners/markets side by side | — | Kept (card restyle) |
| Analytics · Student outcomes table | Same people over time, by cohort/country/program/agency | `/university/outcomes` | Retention/graduation follow-up | Cohorts tabs | Kept |
| Analytics · When do applications arrive (columns) | When will review workload peak? | `series.submitted_monthly` (hidden < 5) | Staff reviewers ahead of peaks | — (no per-month list) | Kept |
| Analytics · Degree dimension (bars) | Which degree levels have demand? | `by_degree` | None reachable (no list filters by degree; programs card already answers demand) | — | **Removed** |
| Cohorts · status mix / rates / risk / visa | (unchanged V6 content) | | | | Kept, restyled |

### 6. Remaining pages
Offers, Documents, Messages, Agencies, Partnership, Scholarships, Exports, Settings, Notifications, Pipeline: YNEX `PageHeader`; every `Panel` is now a YNEX card. Checked at 1440 (contact sheets) and 768/390 (overflow): consistent, no overflow. Not rebuilt. Login untouched (DevAccess flow; not rebuilt).

## Accessibility / honesty
- Status = text + colour everywhere (soft badges with the university wording); avatars/icons decorative; icon-only Prev button named; tabs `role=tab` + roving arrows; scrollable tables are focusable regions with names; review section ids kept for jump links; `dl` groups contain only `dt`/`dd`.
- Rates withheld below 5 with the count always printed ("Too few to rate · 1 of 1"); "Largest drop" only among rated conversions; populations stated on every card; no new numbers invented; no per-row demo labels.
- Transient opacity fades replaced by `aria-busy` (coordinator note).
- axe (`scripts/qa/a11y.mjs … university`): **0 violation groups** after fixing two (export button text on `btn-success-light`, intakes table scroll region).

## Tests
- `npx tsc --noEmit -p tsconfig.json` — clean. `npx vitest run` — 9 files, 52 tests pass.
- `gen-resources.mjs` + `check.mjs` — pass (ko `_one` gaps pre-existing; Korean has no plural forms). 48 new keys en + ko under `university.v7`.
- e2e selectors kept (read, not run): heading "Needs your decision"; tab "Needs review"; button "Request documents" (`.first()`), dialog "Request a document" with `#rq-cat/#rq-label/#rq-note`, "Send request", `.uc-requests` containing label + note, "Cancel"; applicant name visible on the review page; no page overflow on `/`, `/applicants`, `/cohorts` (checked 390/768/1024/1440 — none on any route).

## Screenshots
`docs/qa/v7/hangyul/university/`: overview (1440/1024/390), applicants (1440/1024/390), applicant-review, programs, analytics, cohorts (1440/390), offers, partnership (1440); `-full` variants; `before/overview-1440*.png`. Compared with template index-8, index-6, index-10, crm-contacts, job-candidate-details, profile, form_layout.

## Requests for shared files / server
1. **API:** `GET /applications` has no `intake` (or degree) filter, so intake-filtered charts cannot drill down exactly. Add `intake=YYYY-TERM` (and `degree`) to `list_applications`; then Overview origins/demand can follow the intake selector and Analytics links can stay on with every filter.
2. **API:** `by_agency` rows carry `agency_id` but `UniversityAnalytics` type omits it (read defensively in Analytics) — add to `@hangyul/types`.
3. **API (nice to have):** `complete_on_first_review` per agency inside `/university/analytics` would replace N per-agency metric calls.
4. **ynex-ui `PageHeader`:** crumbs render on the end side next to actions; on the review page a breadcrumb + queue nav share a row via a local wrapper (`.uv7-rvtop`). A `crumbs`-above-title option would help all consoles.
5. **ynex-ui `StatCard`:** a "zero / not a link" visual state (muted value) is done locally (`.uv7-stats .yx-stat:not(.yx-stat--link)`); could live in the skin.
6. **Shell:** sidebar background ends at 100 vh in full-page screenshots (same as the agency note).
7. **Seed:** the dev fixture "Authorised-submission fixture (development only)" sorts first in Programs and is selected by default for admins.

## Open issues
- Statement reader keeps the V6 `uc-reader` typography (only chrome restyled).
- Applicants table scrolls inside the card between 768 and 1279 px.
- Overview "Waiting on applicants" card is short next to the ranked lists at 1440 (equal-height card with white space).
- Pipeline, Login, Notifications, Messages are skinned, not rebuilt; Messages empty state is sparse for an account with no threads.
