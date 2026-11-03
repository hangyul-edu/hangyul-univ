# V22 University Console — workflow home, four-question Insights, four-item navigation

Measured on the running dev stack (API :8001, console :3103) as `admin@pusan.univ.demo.hangyul.kr`, locale `ko`,
2026-10-23. Screenshots: `docs/qa/v22/shots/university-*.png` (home at 390 / 768 / 1024 / 1440 / 1728; Insights and the
application page at 390 / 1440; the Settings hub at 390 / 1440).

## 1. Navigation — before / after

| | V11–V21 (6 items) | V22 (4 items) |
|---|---|---|
| 1 | 개요 Overview `/` — ranked decision queue, funnel card, markets, quality, post-admission | **지원자 Applicants** `/` — stage strip + toolbar + applicant table (`/applicants` renders the same screen) |
| 2 | 지원자 Applicants `/applicants` — view tabs + list/board toggle | — (merged into 1) |
| 3 | 전공·지원 요건 Programs & rules `/programs` | — (under 설정) |
| 4 | 메시지 Messages | **메시지 Messages** `/messages` |
| 5 | 분석 Analytics — four tabs of cards | **통계 Insights** `/analytics` — four question sections |
| 6 | 관리 Manage — Rules · Scholarships · Partnership · Exports · Settings | **설정 Settings** `/manage` — Programs & rules · Admission rules · Scholarships · Partnership · Agencies · Export presets · Notifications · Settings · read-only team roster |

Rendered sidebar (ko): `지원자 · 메시지 · 통계 · 설정`; every link opens without a 404 (checked by clicking each
`a.side-menu__item`). No `<select>` of universities is rendered for a university member (`session.memberships` has one
university): the only selects on `/` are the intake / country / programme filters, sort and page size. Hangyul staff keep
the partner picker; a member with more than one university membership gets a switcher of *their own* memberships
(`switchOrg`), nothing else.

Routes kept or redirected: `/offers` → `/?stage=admitted` (checked: lands on `http://localhost:3103/?stage=admitted`);
`/pipeline` (and any `view=board` link) → `/` with its filters; `/documents`, `/scholarships`, `/cohorts*`, `/retention`,
`/graduation`, `/exports`, `/partnership`, `/agencies`, `/programs`, `/rules`, `/settings`, `/notifications` keep their
routes and are linked from `/manage`.

## 2. Status grouping (one module: `apps/university-web/src/lib/workflow.ts`)

| stage (ko · en) | `GET /applications` filter | needs us |
|---|---|---|
| 접수 · Received | `status=SUBMITTED&admin_check=done` | yes |
| 서류 확인 · Document check | `status=SUBMITTED&admin_check=pending` | yes |
| 심사 중 · In review | `status=UNIVERSITY_REVIEW,INTERVIEW` | yes |
| 보완 요청 · Documents requested | `status=ADDITIONAL_DOCUMENTS` | no (waiting on the applicant) |
| 결정 대기 · Decision pending | `status=WAITLISTED` | yes |
| 합격 · Admitted | `status=OFFERED,OFFER_ACCEPTED` | no |
| 등록 · Enrolment | `status=TUITION_PENDING,TUITION_PAID,ADMISSION_CERTIFICATE_PENDING,ADMISSION_CERTIFICATE_ISSUED,VISA_PREPARATION,VISA_SUBMITTED,VISA_ISSUED` | no |
| 입학 · Enrolled | `status=ENROLLED` | no |
| (closed, toolbar meta only) | `status=REJECTED,WITHDRAWN` | — |

The `admin_check` list filter exists (`/applications?admin_check=done|pending`, V8), so the brief's "Document check =
SUBMITTED with the administrative check not done" is implemented as written, and Received is the disjoint complement
(SUBMITTED with the check done) so that no application is counted in two stages. `workflow.test.ts` asserts that every
status in `VISIBLE_STATUSES` appears in exactly one stage or in the closed count. The "needs us" mark is a tangerine dot
on the stage label (`.uv22-stage--needs-us`) on Received, Document check, In review and Decision pending when the count
is above zero — the former ranked "Needs your decision" list has no other trace.

Selecting a stage writes `?stage=<key>` and the table runs `withStage(params)` — the stage's statuses (and
administrative-check filter) replace any `status=` in the URL. An old `?status=` link whose set equals a stage selects
that stage (`/applicants?status=UNIVERSITY_REVIEW&status=INTERVIEW` → `data-work-stage="in_review"`, checked).

## 3. Strip count == table total (read from the DOM)

Clicked every stage, then read `li[data-stage] .hg-strip__count`, `[data-work-total]` (the API `total` for the table's
current filter) and the rendered `tbody tr` count. All intake / country / programme filters off.

| stage | strip count | `data-work-total` | rows rendered | URL |
|---|--:|--:|--:|---|
| received | 0 | 0 | 0 | `?stage=received` |
| documents_check | 0 | 0 | 0 | `?stage=documents_check` |
| in_review | 3 | 3 | 3 | `?stage=in_review` |
| documents | 2 | 2 | 2 | `?stage=documents` |
| decision | 1 | 1 | 1 | `?stage=decision` |
| admitted | 1 | 1 | 1 | `?stage=admitted` |
| enrolment | 1 | 1 | 1 | `?stage=enrolment` |
| enrolled | 3 | 3 | 3 | `?stage=enrolled` |
| all | 11 | 11 | 11 | `/` |

Stage counts sum to 11 = the unfiltered total (0 closed). The same `GET /applications?…&page_size=1` filter produces
the strip number and the table (`useApplicationCount` / `useApplications` share `useApplicantQuery`), so the two cannot
drift; the QA hook is `data-work-total` / `data-work-stage` on `.uv22-table`.

Not measured against the 1,011-applicant scale database: it needs its own API on :8091 and its own Vite servers
(`scripts/qa/v13-scale-qa.mjs` expects :4702/:4703); neither is running and starting them alongside the dev stack would
not fit the 5 GB VM shared with two other agents.

## 4. Insights — four questions

| section (`data-question`) | heading (ko / en) | charts | drill-down |
|---|---|---|---|
| `origin` | 지원자는 어디에서 오나요? / Where do applicants come from? | horizontal bars by country (top 8) and by agency (top 8); largest bar tangerine | `/applicants?nationality=…`, `/applicants?agency_id=…` |
| `dropoff` | 어디에서 이탈하나요? / Where do we lose them? | funnel bars (8 steps, submitted → enrolled); the step with the largest rated drop is tangerine and named in a callout ("심사 → 합격 통보 · 11명 중 6명(55%)") | `/applicants?reached=<step>`; closed count → `status=REJECTED,WITHDRAWN` |
| `admit` | 어떤 학생이 합격하고 입학하나요? / Who gets admitted and enrols? | offer → acceptance → enrolment bars with rates against offers; offer rate by programme (withheld as `n < 5` text, no bar) | `/applicants?reached=…`, `/applicants?program_id=…&reached=OFFERED` |
| `settle` | 입학 후 잘 정착하고 있나요? / Do they settle in after enrolment? | paired bars per entry cohort (retention ink · graduation grey, with legend); totals in the header | cohort rows → `/cohorts/list`; totals → `/cohorts/retention`, `/cohorts/graduation` (enrolment records are not applications, so these open the cohort list rather than the applicant table) |

Rendered check at 1440: four `section[data-question]` present; bars 11 / 8 / 8 / 6, every `li[data-bar]` contains an
`a[href]` (11 / 8 / 8 / 6). Palette: `--hg-chart-1` ink for every series, `--hg-chart-highlight` for the one highlighted
bar per chart, `--hg-chart-5` grey as the second series of the one two-series chart (legend shown), values and labels in
text tokens. Removed from Analytics: the tab bar, the status-distribution card, the agency quality table, the monthly
submissions column chart (Recharts), the countries/programmes tables, the outcomes table and the "students / agencies /
exports" header buttons (agencies is linked from the by-agency chart; cohorts from section 4; exports from 설정).

## 5. Visual / overflow

`document.documentElement.scrollWidth === innerWidth` on `/`, `/applications/<id>`, `/messages`, `/analytics`, `/manage`
at 390, 768, 1024, 1440 and 1728 (25 checks, 0 failures). Table header row sits at the top of the table at every width
(the V22 table wrapper is not a scroll container; below 992 px `--hg-table-sticky-top` is 0).

## 6. Permissions

`permissionsFor()` returns `FULL_PERMISSIONS` for any `UNIVERSITY_*` role; the capability lists are gone. Hangyul staff
keep their rules (operations decide/publish, finance awards, counselors read and export). Removed: the "What you can do"
capability list and the role line on Settings, role text in reviewer pickers (detail page, bulk actions, team hand-over),
the `UNIVERSITY_ANALYST` reviewer filter, `handoverTargets` role filter, SSO's "default role" row.

## 7. Known / not done

- `/applications/<id>` logs one React duplicate-key warning (`key=""`) that predates this pass (not touched).
- The read-only roster on 설정 shows name · title · active; the team endpoint does not return e-mail addresses, so that
  column is not shown (server not in scope).
- `e2e/redesign.spec.ts` "university: decisions first, quick views and request documents" asserts the removed UI:
  `getByRole('heading', { name: 'Needs your decision' })` (line 63) and `getByRole('tab', { name: /Needs review/ })`
  (line 65). Replace with the strip (`li[data-stage="in_review"] .hg-strip__count`) and `[data-work-stage]`.
