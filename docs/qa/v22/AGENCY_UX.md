# V22 Agency console — workflow UX (REPORT §249, §252; brief §51–§56)

Measured 2026-10-23 against the running dev stack (API :8001, agency console :3102) as
`manager@lotus.demo.hangyul.kr` (Lotus Bridge, 23 students) and `admin@demo.hangyul.kr` (Hangyul HQ, 116 students).

## 1. Navigation

| before (V11) | after (V22) |
|---|---|
| Today · Students · Review · Applications · Messages · Operations/Performance · Manage (+ HQ: Operations · Agencies · Manage) | **오늘 / Today** (`/`) · **학생 관리 / Students** (`/students`) · **지원·서류 / Applications & documents** (`/review`; modes Documents · Writing · Applications, `/applications` still routes and opens the same mode) · **메시지 / Messages** (`/messages`) · **통계 / Insights** (`/performance`; Operations · Quality · Outcomes are sections, no manager gate) · **설정 / Settings** (`/manage`: 관리자 계정, Providers, Services, Templates, Universities, Settings, Payments, Audit) |
| `/pipeline` kanban in the rail | `/pipeline` → redirect to `/`; `pages/Pipeline.tsx` deleted; the process strip replaces it |
| HQ: Operations · Agencies · Manage | HQ: Operations · Agencies · **대학 계정 / University accounts** (`/hq/accounts`) · Tools |

Rail item count for an agency administrator: **6** (`a.side-menu__item`, each resolves to a page with an `h1`, no 404 — see §5).

## 2. Process strip — one grouping (`apps/agency-web/src/lib/stages.ts`)

| step | ko | en | `PipelineStage` values |
|---|---|---|---|
| 1 | 신규 | New | NEW_LEAD, PROFILE_INCOMPLETE, QUALIFIED |
| 2 | 상담 | Counselling | SERVICE_PURCHASED, ASSIGNED |
| 3 | 서류 준비 | Documents | DOCUMENT_PREPARATION |
| 4 | 지원 준비 | Ready | READY_TO_APPLY |
| 5 | 제출 | Submitted | APPLIED |
| 6 | 대학 심사 | University review | INTERVIEW, WAITLISTED |
| 7 | 합격 | Admitted | OFFERED, TUITION_PENDING, ENROLLED |
| 8 | 비자 | Visa | VISA_PREPARATION, VISA_ISSUED |
| 9 | 입국·완료 | Arrived | ARRIVAL_PREPARATION, ARRIVED, ACTIVE_STUDENT, GRADUATED |
| — | 종료 (quiet trailing count) | Closed | REJECTED, WITHDRAWN |

`src/lib/stages.test.ts` asserts the ten lists cover every `PIPELINE_STAGES` value exactly once.

A selected step sends its stages as the repeatable `stage=` filter of `GET /agency/students`; the strip count is
that query's `total`. With no toolbar filter the counts come from `GET /agency/stage-counts` (same tenant scope);
with any toolbar filter (search, country, waiting-on, intake, view, agency) each step is a `page_size=1` count query
with the same filters, so the number on the step is always the number of rows under it.

## 3. Count == rows evidence (DOM, 1440 × 900)

Read with `scripts/qa/v22-agency-gate.mjs` (scratch): `li[data-stage=<k>] .hg-strip__count` vs
`.ag22-table[data-work-total]` / `[data-work-stage]` and `tbody tr` count after clicking the step.

| user | page | step | strip | `data-work-total` | rows shown | `data-work-stage` |
|---|---|---|---|---|---|---|
| manager@lotus | `/` | All | 23 | 23 | 10 (top 10, "Show all 23") | all |
| manager@lotus | `/` | documents | 2 | 2 | 2 | documents |
| manager@lotus | `/` | admitted | 2 | 2 | 2 | admitted |
| manager@lotus | `/` | visa | 1 | 1 | 1 | visa |
| manager@lotus | `/` | new | 0 | 0 | 0 | new |
| manager@lotus | `/students` | All | 23 | 23 | 23 | all |
| manager@lotus | `/students` | documents | 2 | 2 | 2 | documents |
| manager@lotus | `/students` | admitted | 2 | 2 | 2 | admitted |
| manager@lotus | `/students` | visa | 1 | 1 | 1 | visa |
| admin@demo (HQ) | `/` | All | 116 | 116 | 10 | all |
| admin@demo (HQ) | `/` | documents | 7 | 7 | 7 | documents |
| admin@demo (HQ) | `/` | admitted | 8 | 8 | 8 | admitted |
| admin@demo (HQ) | `/` | review | 3 | 3 | 3 | review |
| admin@demo (HQ) | `/students` | documents / admitted / review | 7 / 8 / 3 | 7 / 8 / 3 | 7 / 8 / 3 | ✓ |

Every pair matched; the URL after a click is `?stage=<key>` and the step reads `aria-pressed="true"`.

## 4. Today layout (1440 × 900)

Strip (y≈155–190) → toolbar (y≈235–270) → table header (y≈290) → 10 rows of 40 px → footer "Most urgent first ·
Showing 10 of 23 / Show all 23" at y≈760. All eight columns (Student · Country · Current stage · Next action ·
Waiting on · Due · University · Last activity) are visible at 1440 and 1728; at 1024 the shared DataTable folds
University and Last activity into the row-details toggle (no horizontal scroll). The V9 "Waiting on" panel and the
14-day timeline did not fit beside an eight-column table without pushing it below the fold, so they are folded into
the toolbar: the waiting-on filter carries the party counts (`GET /agency/today`), and the toolbar meta reads
"15 deadlines in 14 days" (link to `/tasks?view=deadlines`). No KPI cards; the ranked queue's position orders the
rows when no step is selected and its reasons are the Next action / Waiting on columns.

## 5. Overflow and navigation gate

`document.documentElement.scrollWidth <= innerWidth` at 390 / 768 / 1024 / 1440 / 1728 for `/`, `/students`,
`/students/<id>`, `/review`, `/messages`, `/manage`, `/team`, `/performance` (manager) and `/hq/accounts`, `/`,
`/students` (HQ admin): **0 failures** (one initial failure, `/review` at 390 from the three-mode switcher, fixed by
letting it wrap). Zero `pageerror` / console errors. Every `a.side-menu__item` (6 agency, 10 HQ) resolved to a page
with its own `h1`; none rendered the 404 page.

## 6. Captures (`docs/qa/v22/shots/`)

`agency-today-{390,768,1024,1440,1728}.png`, `agency-students-{1440,390}.png`, `agency-workspace-{1440,390}.png`,
`agency-review-{1440,390}.png`, `agency-messages-{1440,390}.png`, `agency-manage-{1440,390}.png`,
`agency-accounts-{1440,390}.png` (`/team`, 관리자 계정), `agency-hq-accounts-{1440,390}.png` (HQ admin). Each also has
a `-full.png` full-page variant.

## 7. Roles removed from the console

`usePerms()` now exposes only `isHangyul`, `ops`, `userId`, `orgName`. Deleted gates: `manager`, `reviewerOnly`,
`canAssignCounselor`, `canTransitionApps`, `canReviewDocs`, `canSeeAudit` (EssayEditor gate-override, Essays insights
link, DocumentQueue/DocumentReviewPanel decisions, ApplicationPanel/SuccessPanel/PortfolioTab transitions,
AgencyIdentity edit, StudentWorkspace stage/visa edits, Settings audit link, Manage payments/audit, Today team scope,
Performance operations). Strings "owners and managers…", "Managers can…", "Only managers…" in `agency.json` (en/ko)
rewritten; the org badge reads `role.AGENCY_ADMIN` (Administrator / 관리자). `counselor_user_id` stays as the internal
담당자 / Owner field (bulk "Set owner…", workspace header "Owner").

## 8. e2e specs that encode removed UI (not edited)

| spec | selector | why |
|---|---|---|
| `e2e/redesign.spec.ts:48` | `getByRole('heading', { name: 'Who needs you today' })` | Today's heading is now the greeting; the queue is the work table |
| `e2e/redesign.spec.ts:51` | `getByRole('tab', { name: /Needs attention/ })` | views are a toolbar `<select>` (`aria-label="View"`), not tabs; `?view=attention` still works via the select |
| `e2e/v3-agency.spec.ts:68–72` | `getByRole('button', { name: 'Save view' })`, dialog `Save this view`, `Whole team` | still resolve (toolbar "Save view" → modal → "Whole team" segment); listed only because the flow continues into the removed menu below |
| `e2e/v3-agency.spec.ts:80–88` | `getByRole('button'/'menu', { name: 'More views' })`, `getByText('Team views')`, `getByText('Team view · shared with everyone in your agency')`, `getByRole('button', { name: viewName })` | the "More views" menu is gone; saved views are `<optgroup label="Team views">` options in the View select; the page subtitle no longer names the view |
| `e2e/responsive.spec.ts:26` | `/pipeline` | still passes (redirects to `/`), but no longer exercises a distinct page |
