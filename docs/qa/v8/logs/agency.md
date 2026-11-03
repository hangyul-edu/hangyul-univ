# V8 log — Agency + Hangyul operations

*Workstream log (REPORT §47–50 mandate items 1–9). Resumed 2026-10-09 after an interrupted run; this file is updated as work lands.*

## Inventory at resume (what the interrupted run left)

| Area | State found |
|---|---|
| Router | `/deadlines` → `/tasks?view=deadlines`, `/consultations` → `/tasks?view=meetings` (query kept); `/hq/readiness` route added |
| Sidebar | Consultations removed; manager label "Operations"; HQ "Production readiness" |
| `pages/hq/Readiness.tsx`, `v8*.css` | Empty stubs |
| Server `services/agency_ops.py` | Complete Operations aggregation (backlog, ageing, load, SLA, deadlines, stages) — router was a stub |
| Server `services/channels.py` + `/channels` + message `channel` on send | Done, `tests/test_v8_channels.py` |
| Server `/audit` readable rows + `/audit/people` | Done, `tests/test_v8_audit.py` |
| Server `readiness.py` | Stub |
| i18n | only `v8.nav.*` |

## Mandate status (end of this run)

| # | Item | Status |
|---|---|---|
| 1 | Students column priority + 0 sideways agency tables; operational saved views with counts = rows | Done — 0 sideways tables on all 35 agency routes at 768/1024/1280/1440 (`_v8ag-capture.mjs`); 8 views, pytest |
| 2 | Today ranked "Who needs me now?" with reasons; explainable server order | Done — `/agency/today/queue`, rule stated on page, pytest; reasons visible in first screen @1440 and @1024 |
| 3 | Workspace top: why not moving → what happens next | Done — `/movement` + MovementPanel |
| 4 | Tasks absorbs Deadlines + Consultations; redirects; sidebar; workspace meetings | Done |
| 5 | Manager Operations with drill-downs + QUESTION/INSIGHT/ACTION | Done — see Charts |
| 6 | Messages channel model UI, external channels disabled honestly | Done |
| 7 | Secondary pages | Audit, Notifications, Applications, Payments (filter), Settings, Documents rebuilt/fixed; Catalog/Team/Templates/Services/Submissions verified only (open issue) |
| 8 | HQ failures list + per-agency table; agencies/assignments/sources; readiness | Done (Sources kept, linked by reason) |
| 9 | AuthCover in ynex-ui + agency Login | Done (university adopts) |

## Per screen — V7 problem → V8 change → measured result

| Screen | V7 problem | V8 change | Measured |
|---|---|---|---|
| Today `/` | Five stat cards + eleven equal-weight queues; nothing said *who* first or *why* (§47.4 #7) | First screen = **"Who needs you today"**: one ranked list of students, each with plain reasons ("Waiting for our reply for 10 days", "1 document waiting for review for 13 days (review time is 48 h)") and one action (Reply / Review / Open applications / Nudge…). Order is server-side (`services/priority.py`), stated on the page ("How this list is ordered" + students per level). Managers switch Team / Mine. Queues (`#attention`) stay below as "Work queues"; stat strip, caseload-by-phase and team workload removed (they moved to Operations). | 1440: top 8 students with reasons above the fold; 1024: top 7 with reasons in first screen. Height 1.9 screens @1440. |
| Students `/students` | Table scrolled sideways at 1024; views were parties/phases, not operational questions | Column priority: Student · Stage · Waiting on · Next action · Deadline always; target university, counselor, intake, activity fold into the row details below 1280. Tabs = All · My urgent cases · Needs attention · Deadline < 7 days · Waiting on student > 3 days · Waiting on university · Document correction required · Visa blocked · New paid students · Unassigned (count on every tab = rows, pytest); one-line definition under the active view. V4 views under "More views". | 0 sideways tables @1024/1440 |
| Workspace `/students/:id` | Top was a list of blockers + task list; no "why stuck" answer | Top of Overview = **"Why is this case not moving?"** (who must act, the same ranked reasons as Today, document-correction / university-request blockers, days since the case last moved, definition) then **"What happens next"** (open tasks incl. student to-dos, upcoming meetings, next deadlines — each a link). | — |
| Tasks `/tasks` | Deadlines and Consultations were separate modules repeating Tasks | Tabs gain **Deadlines** and **Meetings** (embedded views, own sub-filters `days` / `bucket` / `student`); `/deadlines` and `/consultations?view=x` redirect with their query (`view`→`bucket`). Sidebar already trimmed; Settings link updated. | — |
| Operations `/performance` (managers) | No screen answered backlog growth, stuck cases, overload, SLA failures, slow stages (§47.4 #10) | New Operations view (default for owners/managers/Hangyul; "Outcomes" switch keeps the V7 figures; counselors unchanged). Six sections, each with question, definition from the API and drill-down to exact records — see Charts. Jump chips at the top answer the < 60 s questions. | 3.0 screens @1440, API 0.2 s |
| Messages `/messages` | No channel model; every external conversation left Hangyul (§47.4 #11) | One timeline per conversation with the channel on every message ("In-app"); composer shows **Send via**: In-app (selected) and Email / WhatsApp / KakaoTalk / SMS disabled with "Not connected — needs provider credentials" (or "needs a provider agreement"), from `GET /channels`. Page note says nothing is sent externally. Server refuses unconnected channels with 409 and stores nothing (test). | — |
| Audit `/audit` | Raw JSON, action keys, record ids | Sentences by day ("Phạm Thu Trang opened Nguyễn Thị Lan's bank balance certificate"), names/targets resolved server-side, consecutive repeats collapsed ("· 3 times"), filters Who / Student / Kind, pager. No JSON, keys or ids. | 0 sideways tables (was 1 @1024) |
| Notifications (page + bell) | "moved an application to UNIVERSITY_REVIEW" | `notify.application.<STATUS>` (21) and `notify.documentRequest.{agency,student}` added to common en/ko, so the shared bell and the page render "Pusan National University: application status is now “Under university review”". | enum leak 0 in seeded notifications |
| Applications `/applications` | Readiness % bars; sideways @1024 | "N items remain · M in review" / "All items ready" / who it waits on after submission (new `GET /agency/applications/remaining`, same count the student sees); readiness sort removed; column priority; program cell clamps. | 0 sideways @768/1024/1280/1440 |
| Documents `/documents` | — | `?student=` narrows the queue (Today's "Review" action) with a visible "Only X — show everyone" chip. | — |
| Tasks → Deadlines / Meetings | separate modules | see Tasks row above; Meetings keeps the close-out flow, adds `?student=` | — |
| Payments | status filter not linkable | status filter in the URL (`/payments?status=FAILED` from HQ). Otherwise kept (demo-payment callout, totals, orders). | — |
| Settings | Deadlines link to a removed route | Link → Tasks › Deadlines; new "Message channels" row with the honest status. | — |
| Catalog, Team, Templates, Providers/Services, Submissions | Catalog/Submissions/Essays scrolled sideways @1024 in V7 | Column priority from the shared DataTable (coordinator) — verified 0 sideways at 768/1024/1280/1440. Pages reviewed by eye; not recomposed in this pass (see Open issues). | 0 sideways |
| HQ `/hq` | 7 equal-weight stat cards + 4 columns repeating the same counts (§47.4 #9) | **"Where is the ecosystem failing?"** — one severity-ordered list (critical → high → medium, then size), each a sentence with count, oldest example and an Open link to the exact list; "All clear: …" line for zero rows; then the per-agency table with a new Load column. Stat strip and board removed. | 1.4 screens @1440 (was 2.9) |
| HQ `/hq/agencies` | Three stat cards + capacity table, no health | Rows: agency + languages · load bar vs capacity (% with tone) · broken promises / overdue tasks / students waiting on the agency · Caseload / Operations actions. Sort "Fullest first" / "Most problems first" (`?sort=`). Footer names agencies with room. | — |
| HQ `/hq/assignments` | Picker started from arbitrary students | "Likely to need a new agency or counselor": students with a late first reply and unassigned students first; search below. | — |
| HQ `/hq/sources` | — | Kept (already a severity-ordered review queue); HQ failure rows deep-link with `?reason=`. | — |
| HQ `/hq/readiness` (new) | No production-readiness view | Verdict ("Not ready for production — 5 required items are not active"), counts by status, required vs optional integrations, each with status, fallback ("Until then: …"), what it needs (env names only) and a status legend. Statuses from real settings (`GET /admin/readiness`), never Active without configuration + implementation (test). | — |
| Login | Bare form | `AuthCover` (new, `packages/ynex-ui/src/components/AuthCover.tsx`, exported): YNEX sign-in-cover composition — shared LoginScreen form beside a cobalt cover (eyebrow, promise, four points, privacy line); below 1200 px the cover folds to a short band above the form. `tone="navy"` ready for the university console. e2e selectors (`#email`, `#password`, submit) unchanged. | — |

## Charts (Operations — `/performance` for managers/owners/Hangyul; counselors keep their own figures, "Outcomes" is one switch away)

| Chart | QUESTION | INSIGHT (seeded Lotus data, 2026-10-09) | ACTION / drill-down |
|---|---|---|---|
| Backlog trend (stacked columns, 8 weeks: team tasks · document reviews · essay reviews) | Is open work growing or shrinking? | +29 in 8 weeks, almost all team tasks in the last two weeks | Links under the chart open the current open tasks (`/tasks?view=team`), document queue, essay queue with the same counts as the last column |
| Case ageing by stage (phase × days-since-moved matrix) | Which cases stopped moving, and where? | Oldest: Trần Minh Khoa, 296 days in "Assigned"; 2 "Preparing" cases 30+ days | Every non-zero cell is a button listing exactly those students (each a workspace link); default list = longest without movement |
| Counselor load vs capacity (bars vs even share of agency capacity) | Who is overloaded? | Trương Mỹ Linh 12 of 20 with 4 overdue tasks; nobody over capacity | Each bar opens `/students?counselor=…`; unassigned count opens `/students?view=unassigned` |
| SLA failures (three lists) | Which promises are already broken? | 3 document reviews > 48 h (oldest 14 days), 6 essay reviews late | Each row opens the document / essay / student messages; group heading opens the queue |
| Deadlines at risk (list) | Which applications due ≤ 14 days still miss required items? | 1: Nguyễn Thị Lan, Pusan National University in 11 days, 5 items remain | Row opens the student's applications tab |
| Slow stages (median days per status; withheld below 5 stays) | Where do applications wait longest? | Offer received, median 5 days over 5 stays; 14 statuses too few to rate (folded) | Each bar opens `/applications?status=…` |

Top-of-page jump chips answer the manager's < 60 s questions directly: "SLA failures 9 · Deadlines at risk 1 · Oldest case 296 days · 0 over capacity · Slowest stage: Offer received".

## API changes

| Endpoint | Change |
|---|---|
| `GET /agency/students?view=` + `/agency/students/views` | New views `urgent`, `deadline7`, `student_silent`, `visa_blocked`, `new_paid`, `unassigned` (SQL predicates in `services/caseload.py`; `university`, `docs` reused). Definitions in `caseload.VIEW_DEFINITIONS`. |
| `GET /agency/today/queue?scope=mine|team&limit=` | New. Ranked students with reasons (`code`, `tier`, `at`, `params`), action link, `rank` {tier, reasons_at_tier, clock}, stated `rule`, `by_tier`. Counselors are always `mine`. |
| `GET /agency/students/{id}/movement` | New. waiting_on + reason, reasons (same as Today), days since last moved (`agency_ops.last_moved`), next tasks / meetings / deadlines. Tenant-scoped (404 outside). |
| `GET /agency/ops?agency_id=` | New router over the existing `services/agency_ops.overview` (managers/owners; Hangyul any agency). |
| `GET /agency/hq/overview` | Adds `failures` (severity-ordered: critical/high/medium, each with count + exact link + oldest) and `all_clear`; per-agency rows gain `capacity`, `load`. |
| `GET /agency/applications/remaining?ids=` | New. Items remaining / in review per application (tenant-scoped; null after submission). Replaces readiness % in the agency list without touching the university-owned applications API. |
| `GET /admin/readiness` | New (Hangyul only). Integration statuses from real settings: ACTIVE / DEVELOPMENT_ONLY / NEEDS_AGREEMENT / NOT_CONFIGURED; `required`, `blocking`, env names only (never values). |

## Tests

- `server/tests/test_v8_agency_ops.py` (13): every operational view count = rows (manager + counselor), view rows match definitions, Today order == stated rule (`priority.rank_key` sorted), counselor scope, movement reasons == Today reasons, movement tenant 404, Operations sums (backlog weeks, ageing phases = rows, load = assigned, SLA counts = items, deadlines all with items remaining), Operations manager-only, HQ failures severity order, readiness never ACTIVE without config (demo payments → DEVELOPMENT_ONLY; Stripe key alone → NEEDS_AGREEMENT; key value never returned), readiness Hangyul-only.
- `test_applications_remaining_replaces_percent`: items remaining for pre-submission applications, null after submission, other agency's ids left out.
- Existing from the interrupted run: `test_v8_channels.py` (4), `test_v8_audit.py` (4).
- Gates at the end: pytest 257 passed (whole suite), ruff clean, agency-web tsc + vitest 39 passed, university-web tsc clean (ynex-ui export), `npm run i18n:check` passes. E2E not run (instructions: no Playwright suite); selectors kept: Today heading "Who needs you today" + `#attention` rows/`.ag-attn__cta`, Students tab "Needs attention" + "More views" menu + "Save view", composer `.ag-composer` / textbox "Message" / "Send…" / list "Messages", login `#email`/`#password`/submit.

## Measurements (V7 → V8)

Method: click paths counted on the running dev stack (seeded Lotus manager/counselor, 2026-10-09); "load" = navigation-to-networkidle from `scripts/qa/_v8ag-capture.mjs` / `v8-capture.mjs` metrics (dev server, so absolute times are pessimistic). No stopwatch user test was run — times below are click counts + measured page loads, not observed task times.

| Task | V7 | V8 |
|---|---|---|
| Start day → top 10 urgent cases | Not possible as a list: 11 equal queues, each with one example; ≥ 4 queue opens (tasks, documents, replies, essays) + back, then merge by hand | **0 clicks**: ranked list with reasons is the first screen (top 8 visible @1440, top 7 @1024, 10 after one scroll; "Show all" 1 click). Load ≈ 2.9 s dev |
| Document review loop (Today → reviewed) | Today → Documents queue (1) → Verify (1) | Same 2 clicks; Today's "Review" opens the queue narrowed to that student |
| Essay review loop | Today → "Essay reviews" queue (1) → essay (1) → review | Today row "Review essay" opens the essay directly (1) |
| Find students waiting > 3 days | No such view (Waiting on student + reading the Activity column row by row) | Students → tab "Waiting on student > 3 days" (2 clicks; tab count = rows, pytest) |
| Manager: oldest blocked case | Not available (Pipeline/Students sorted by update, no "days since moved") | Operations (1 click) → chip "Oldest case 296 days" + ageing matrix; open the case (1) |
| Manager: overloaded counselor | Today workload bars without capacity | Operations → "0 over capacity" chip / load vs capacity bars (1 click) |
| Manager: SLA problems | Today SLA row (first reply only) + Performance tiles | Operations → "SLA failures 9" with every late item listed (1 click) |
| Manager: deadline risk | Deadlines page: every deadline, no "items missing" | Operations → "Deadlines at risk 1" (only applications due ≤ 14 days that still miss items, with items remaining) (1 click) |
| Manager: bottleneck | Not available | Operations → "Slowest stage: Offer received" (median, withheld below 5 stays) (1 click) |

All five manager questions are answered by one page load (Operations API 0.2–0.4 s, page ≈ 2 s warm) — under the 60 s bar with one click.

## Open issues

- **Shell header at 1024** (YnexShell, coordinator-owned): brand text overlaps the menu toggle when the rail is collapsed — visible on every agency screen at 1024.
- Dev data contains E2E residue in notification fallback texts / document-request labels (e.g. "Bank balance certificate 1790844281256"); not a product leak but visible in dev — needs a deterministic dev database (REPORT §49).
- `student_silent` uses the student's own messages, uploads and completed to-dos as "activity"; profile edits by the student are not counted (profile `updated_at` is also touched by staff).
- Visa blocked = visa phase + a document to correct or an overdue task; embassy-side blockers (visa route items) are not in the predicate yet.
- Catalog, Team, Templates, Providers/Services, Submissions were verified (no sideways tables, no enum leak by eye) but not recomposed in this pass.
- Backlog trend drill-down opens today's open work (past weeks cannot be listed as they were).
- Korean copy for V8 keys is hand-written (natural, reviewed by eye); other locales fall back to English for the new keys.
- Audit sentences cover the actions found in the dev database plus the known catalogue; unknown future actions fall back to their V3 label or "made a change" (never the raw key).
- Login cover copy reuses V3 claims ("understood in ten seconds", "drag-and-drop"); worth a copy review.
