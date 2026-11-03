# V7 workstream log — Agency console + Hangyul operations (YNEX)

*2026-10-09. Scope: `apps/agency-web/**`, `packages/i18n/locales/{en,ko}/agency.json`. Originals snapshotted to
`/root/hangyul-univ-snapshots/v7-agency/` (same relative paths; helper scripts `snap.sh`, `i18n_add.py`, key files `k-*.json`).*

## Files

| File | Change |
|---|---|
| `src/ynex-agency.css` (new, imported in `main.tsx` after `styles.css`) | All V7 agency compositions (stat strips, queue rows, crm-contacts table, workspace header, file-manager panes, kanban cards, side stats, mail/chat, team cards, HQ board) + AA overrides for YNEX soft badges + two shell work-arounds (see requests). Logical properties only. |
| `src/components/ynex.tsx` (new) | `yxTone()` (Hangyul status tone → YNEX soft tone), `YAvatar` (YNEX initials avatar, decorative), `StageSoft` (pipeline stage soft badge). |
| `src/pages/Dashboard.tsx` | Rewritten on YNEX (Today). |
| `src/pages/Students.tsx` | YNEX card + tabs + columns; logic untouched. |
| `src/pages/StudentWorkspace.tsx` | Header card, overview, timeline, YTabs; tab contents kept. |
| `src/components/DocumentReviewPanel.tsx`, `src/pages/DocumentQueue.tsx` | Three-pane file-manager layout; review logic untouched. `toolbar` prop added to the panel. |
| `src/pages/EssayEditor.tsx`, `src/pages/writing.css` | Chrome only (card classes, avatar, rail tabs). Manuscript/mechanics untouched. |
| `src/pages/Pipeline.tsx`, `Tasks.tsx`, `Messages.tsx`, `Performance.tsx`, `Team.tsx`, `components/OutcomeMetrics.tsx` | YNEX ports (below). |
| `src/pages/hq/Operations.tsx` | HRM stat strip + YNEX cards + crm-companies table. |
| `agency.json` en/ko | New `v7.*` subtree (today, students, ws, tasks, perf, team, hq) + `teamPage.spec.LANGUAGE/DOCUMENT` (missing before: the page printed raw `LANGUAGE`/`DOCUMENT`). Korean written by hand. |

## Screens

### 1. Agency Today (`/`) — "Who needs me now?"
- **YNEX source:** `index-8.html` (HRM `hrm-main-card` stat cards, "Applicants Summary" icon stats, "Upcoming Events" `timeline-widget`), `index.html` (CRM page header with buttons, "Top Deals" avatar list, "Deals Status" `progress-stacked` + `crm-deals-status`), `index-10.html` (inline progress). Components: `PageHeader`, `StatCard`, `YCard`, `DateTimeline`, `ProgressRow`, `Row/Col`, `SoftBadge`.
- **Ported:** greeting + date header with Tasks / Students buttons; 5 HRM stat cards — Overdue (`overdue_tasks` → its `queue`), Needs review (`documents_waiting` → queue; a danger soft badge when items are past the 48 h target), Student waiting (`student_replies` → queue), University request (`university_requests` → queue), Deadline risk (`closing_soon.students` → queue). All values and links are the existing `/agency/today` fields and queues (same as the V6 rows); no new counts.
- **Work queue** (`#attention`, heading "Who needs you today") keeps every V6 row, the `ag-attn__row` / `ag-attn__cta` classes, link names and j/k/Enter; each row now has a tone icon avatar, count and a `btn-primary-light` CTA (hidden < 768).
- **Next 14 days** → `DateTimeline` (danger date when ≤ 3 days); student/owner meta (owner only when different from the student).
- **Caseload by phase** → Deals-status card: total, stacked bar, phase list; each phase links to `/students?stage=…` (unchanged rule).
- **Cases waiting on** → Applicants-summary icon stats, each to its `view=` list (unchanged).
- **Team workload** (managers) → `ProgressRow`s (active students; open / overdue as text, overdue in red text), each to `/students?counselor=`.
- **Removed:** nothing functional. Before: single-column list + small phase bars + table. After: HRM/CRM composition, same data.

### 2. Students (`/students`)
- **YNEX source:** `crm-contacts.html` (card title + count badge, primary action, table head tint, avatar + 2-line name cell, soft tag badges), `navs_tabs.html` (tab-style-2).
- Card header: title + total badge, "More views" menu (saved views, built-in views, delete), primary "Save view". Primary views as underline tabs inside the card (`role=tab` kept for e2e). Filter bar, column config, CSV export, bulk actions, sorting, pagination, `/` and j keyboard — all unchanged (DataTable).
- Columns: Student (avatar + name + SLA badge, flag · country · email), Intake, Target (2-line clamp), Stage (soft badge), Waiting on (party + reason on 2 lines), Next action (2-line clamp, red when overdue), Deadline (date + "Nd" badge, amber ≤ 7 d), Counselor (avatar + name), Activity. Table gets `min-width:1100px` between 768–1399 px (scrolls inside the card, never the page). Phone cards: avatar, name, country, stage badge, waiting, next action.

### 3. Student workspace (`/students/:id`)
- **YNEX source:** `job-candidate-details.html` (header card), `profile.html` (tabs strip, activity timeline), `timeline.html`, `projects-overview.html` (meta facts).
- Header card: XL avatar, name (h1) + stage soft badge + SLA badge, nationality / degree · intake / email / phone with icons, facts (counselor avatar, waiting on + reason, services as badges, profile % progress), Message (primary), Task (light), "…" menu (consultation, stage select, assigned-since, "why this assignment"). `YTabs` strip at the bottom of the card (all 10 tabs, counts, documents count as alert).
- Overview: "What's stopping this student" card (icon avatar by tone + text badge Urgent/Soon), Next steps (TaskRow list), Applications list, **Recent activity** timeline (audit log, 6 items → History); right column Profile card with icon-headed sections (education, languages, preferences, identity). History tab uses the same YNEX timeline.
- Kept: every tab component (Applications drawer, Portfolio, Documents + upload on behalf + dossier, Writing, Visa route + visa case cards, Services, Tasks, Messages, History).

### 4. Document review (`/documents`)
- **YNEX source:** `file-manager.html` three panes.
- Left: queue card (title + count, All/Mine/Unassigned as a button group, category select, bulk bar, items with avatar, wait badge red past SLA, reviewer). Centre: preview card (doc icon, category, student link, status, "n of N", back on < 1024). Right: checks / decision / details card. One-key actions (1–6, V, C, J/K, Ctrl+Enter, Esc) and review logic unchanged; `toolbar` prop is the only API change. The same panel inside the workspace drawer now also uses the two cards.

### 5. Writing review (`/essays/:id`)
- Manuscript-first layout and every mechanic unchanged (selection → comment, suggestions, rubric, checks/gate, versions/compare, shortcuts, approve/changes, next essay). Selectors used by `e2e/v5|v6-writing.spec.ts` untouched (`.wr-text`, `.wr-cmt`, `.sw-cmt`, `.wr-float`, `.wr-gatebox__head`, `#c-body`, `#c-sugg`, all button/tab names).
- Chrome: header is a sticky `card custom-card` with student avatar and a dashed meta row; university question as a soft primary callout; length bar and rail are YNEX cards; rail tabs in tab-style-2 underline with count badges. Essay text stays the dominant column (68 ch serif paper).
- Fixed: Bootstrap `.card { position: relative }` would have turned the sticky header/rail offsets into a 72 px shift — explicit `position: sticky` on the card variants.

### 6. Pipeline / Tasks / Messages / Performance / Team
- **Pipeline** — `task-kanban-board.html`: toolbar card; column head label + count badge; cards = `card custom-card task-card` with stage-tone top rule, intake + next deadline ("Nd", red ≤ 7), degree / overdue / SLA badges, name link, country · top university, footer with open tasks, counselor avatar, "Move to…" menu. Drag & drop, keyboard move menu, collapse-empty, optimistic update unchanged.
- **Tasks** — `task-list-view.html`: table card (tabs, filters, rows with soft priority badges and avatars) + side HRM stat cards (Overdue / Today / This week / Waiting — the same `inView` counts as the tabs; click switches view) + "Open work by priority" progress rows (click filters by priority).
- **Messages** — `mail.html` list (card header + unread badge, search, All / Needs reply / Unread button group, avatar rows, active rule) + `chat.html` bubbles (own messages cobalt; internal notes stay amber dashed and are never cobalt).
- **Performance** — HRM stat cards for the rates (value only when the sample is big enough, always "n of N"), cohort funnel card, stage duration card, outcome-quality card, nationality progress list, counselor workload table, revenue, definitions. Period control moved to the page header (it governs the ops figures).
- **Team** — `team.html` member cards (avatar, role, status, students / open / overdue, languages, email, "Open caseload" → `/students?counselor=`), capacity / SLA / languages as stat cards, specialties card.

#### Chart register (Performance + Today)

| Chart | QUESTION | DATA | DECISION | Kept? |
|---|---|---|---|---|
| Today · Caseload by phase (stacked bar + list) | Where is my caseload sitting? | `/agency/stage-counts` grouped into 6 phases | Open a phase's students to move them on | Kept |
| Today · Team workload (progress rows) | Who is overloaded / behind? | `/agency/analytics?days=30` workload | Rebalance: open that counselor's caseload | Kept |
| Today · Next 14 days (date timeline) | What is due soon? | `/agency/deadlines?days=14` | Open the task / student before it is late | Kept |
| Performance · Cohort funnel (table bars) | Where do this intake's applications stop? | `cohort.funnel` + from-previous rates | Open applications at that status and unblock | Kept |
| Performance · Rate cards (enrolment, SLA, correction, unanswered) | Are we fast and accurate enough? | `cohort.enrollment_conversion`, `operations.*` | Open the SLA / document lists behind each | Kept |
| Performance · Stage duration (table) | Which stage is slowest? | `cohort.processing` medians | Put staff time on the slowest stage | Kept |
| Performance · Outcome quality (table) | Is our work changing results? | `/agency/outcome-metrics` | Fix the weakest practice (documents, essays, services) | Kept |
| Performance · Cohort by nationality (progress rows) | Who is in this cohort? | `cohort.by_nationality` | **Click filters the whole page to that nationality** (made actionable) | Kept |
| Performance · Cohort by program (bars) | Which programs are in the cohort? | `cohort.by_program` | No action reachable from it (no program filter, no list) | **Removed** |
| Performance · Counselor workload (table + load meter) | Is caseload fair vs. capacity? | `workload`, org capacity | Reassign / open the caseload | Kept |
| Tasks · Open work by priority | What mix of urgency is in this view? | open tasks in the current view | Click filters the list to that priority | Kept |
| HQ · Agency caseload bar | Which agency carries the most students? | `agencies[].students` (relative to the largest; capacity stays on /hq/agencies — stated under the table) | Open that agency's students | Kept |

### 7. Hangyul operations (`/hq`)
- **YNEX source:** `index-8.html` stat cards, `index-5.html` risk lists, `crm-companies.html` table.
- Stat strip (7, all from `GET /agency/hq/overview`): first responses missed → `sla.first_response.queue`; authorised submissions waiting → `submissions.authorised_queue`; visa support past its time → `/services?view=overdue&type=VISA_SUPPORT` (the link the V6 services table already used for that group); students a university is waiting on → `university_requests.queue`; agencies with SLA breaches → scrolls to the agency table, which marks those rows (no list with that rule exists, so no fake link); source checks open (`freshness.open` = sum of groups, verified in `hq_ops.py`) → `/hq/sources`; service cases past their time → `/services?view=overdue`. Zero values are not links.
- Risk board: four YNEX cards (Response times, Services after admission, Universities, Data freshness) with the V6 metric rows (count chip by risk tone, detail, link only when a same-rule list exists).
- Agency table: avatar + name + breakdown, caseload bar + count link, SLA breaches, overdue, waiting on agency, ready, university waiting (links unchanged).
- Services by type and Source freshness by risk as YNEX cards (links unchanged).
- `/hq/sources`, `/hq/agencies`, `/hq/assignments`: quick pass under the skin — no glaring issues; not rebuilt.

### 8. Remaining agency pages
Applications, Submissions, Consultations, Services, Providers, Deadlines, Essays queue, Writing insights, Universities, Templates, Payments, Audit, Notifications, Settings checked at 1440 under the YNEX skin: consistent cards/tables/badges, no overflow. Not rebuilt.

## Accessibility / honesty notes
- YNEX soft badges use template text colours (≈3:1 on the tint) → darker text shades in `ynex-agency.css` (same tints): primary #1e4fc2, success #11795e, warning #8a5a00, danger #b5321d, info #0b6aa2, purple #6b3fbf, orange #9a4a0c, teal #0f6e6e, secondary #0d6e8c.
- Every status is text + colour; avatars and icons are decorative (`aria-hidden`), names always printed. Tabs keep `role=tab` + `aria-selected`; YTabs adds roving arrows. Stat cards are links or buttons (`aria-pressed` for view switches).
- No new counts were invented; no demo labels added.

## Tests
- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx vitest run` (apps/agency-web) — 3 files, 39 tests passed.
- `gen-resources.mjs` + `check.mjs` — pass (ko "missing _one" lines are pre-existing; Korean has no plural forms).
- Playwright not run (coordinator). Selectors checked by reading `e2e/*.spec.ts`: `#attention`, link names, `.ag-attn__cta`, heading "Who needs you today", Students tab "Needs attention", "Save view"/"More views"/menu, `/documents` "Verify", writing selectors, `.ag-composer`, `?tab=documents` upload button.

## Screenshots
`docs/qa/v7/hangyul/agency/` — today (1440/1024/390), students (1440/1024/390), student-workspace, document-review, writing-review, pipeline, tasks, messages, performance, team, hq-operations (1440/390; `-full` variants too). Compared against `docs/qa/v7/template-ynex/` index-8, index, crm-contacts, job-candidate-details/profile, file-manager, task-kanban-board, task-list-view, mail/chat, team.

## Requests to the coordinator (shared files I did not edit)
1. **`.page { justify-content: center }`** (YNEX `custom/_custom.scss`) vertically centres short pages (documents at 390 started ~100 px down). Worked around in `ynex-agency.css` (`html[data-nav-layout='vertical'] .page { justify-content: flex-start }`); should move to `_hangyul-skin.scss` for all consoles.
2. **Breadcrumb:** `bootstrap/scss/breadcrumb` is not in the `ynex.scss` subset, so `PageHeader crumbs` renders an ordered list. Minimal styling added under `.ag7` here; please import Bootstrap's breadcrumb module.
3. **`PageHeader` with both `crumbs` and `actions`** stacks them in the end column, pushing the title down; consider crumbs above the title or actions beside crumbs.
4. **Badge AA colours** (list above) belong in `_hangyul.scss` so university/HQ pages get them too.
5. **`.card` + sticky:** any shared component using `card` with `position: sticky` needs the explicit override (Bootstrap sets `relative`).
6. **YNEX `hrm-main-card` / `crm-deals-status`** only ship primary/secondary/warning/danger (+ info/success for deals); extra tones (info, purple, orange, teal, success) are defined in `ynex-agency.css` — could move next to `StatCard`.
7. Sidebar background ends at 100vh in full-page screenshots (fixed sidebar; real browsing is fine) and the header toggle icon renders very small — Shell owner to check.

## Open issues
- HQ stat strip is 7 cards → 4 + 3 at 1440 (one empty slot).
- Students table scrolls horizontally inside its card between 768 and 1399 px (by design, never the page).
- Tasks rows on phones hide priority and waiting (pre-existing row layout).
- `/hq/sources`, `/hq/agencies`, `/hq/assignments` and the other secondary pages are skinned, not rebuilt.
