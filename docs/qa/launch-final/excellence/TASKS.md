# Task map and task-efficiency benchmark (product-excellence pass, 2026-11-22)

The question of this pass was not "does every route work?" but "should the user need to see this route, concept,
control or status at all?". This file maps every screen to the job it serves, records what was merged, folded or
hidden, and counts the work a representative task takes before and after.

**How the counts were taken.** Screens = distinct pages the person must look at; clicks = taps/clicks/key presses
from the starting screen to the end state (typing is counted as one action per field); fields = inputs the person must
fill. Walked by hand on the Design Preview builds (Student `paid`, Operations, University) at 390 px and 1440 px,
before (commit `94641a8d`) and after (this pass). Scrolling is not counted as a click but is noted when it decides
whether the target is visible. No usability session was run; these are analytic counts, not observed behaviour.

## Student — the ten jobs

| # | Job | Where it is done | Screens that serve it |
|---|---|---|---|
| S1 | Know what to do now | Home (next action) | `/` |
| S2 | Find universities that fit and see why | Match / Universities | `/match`, `/explore`, `/universities/:slug` |
| S3 | Decide between options | Saved + Compare | `/explore?tab=saved`, `/compare` (`/budget` is a section of Compare) |
| S4 | Follow one application | Application workspace | `/applications`, `/applications/:id` |
| S5 | Prepare and fix documents | Documents | `/documents` (drawer per document; `?doc=`) |
| S6 | Write and revise essays | Writing | `/essays`, `/essays/:id` (reached from Documents › Writing) |
| S7 | Talk to the Hangyul team | Messages | `/messages`, `/messages/:id` |
| S8 | Pay for / understand the plan | Services | `/services` (+ payment return) |
| S9 | Visa, housing, arrival (after admission only) | More › Korea group | `/visa`, `/housing`, `/arrival` (shown only from the admitted stage) |
| S10 | Keep my profile and account | Profile, Settings | `/profile`, `/settings` |

Primary navigation stays four destinations + 더보기 (Home · Universities · Applications · Messages · More): every job
above lands on one of them, and S9 appears only when it can be acted on. Secondary routes that exist for history
(`/tasks`, `/budget`, `/writing`, `/saved`, `/matches`, `/eligibility`, `/start`, `/onboarding`) redirect.

## Operations — the ten most frequent jobs

| # | Job | Screen |
|---|---|---|
| O1 | See what must be done now | Today (`/`) — lanes: act now · our turn · waiting on student · waiting on university · upcoming deadlines |
| O2 | Reply to a student | Messages (`/messages/:id`) or the case's conversation |
| O3 | Review a document | Work › Documents (`/review?mode=documents`) — split view, J/K/V/C, auto-advance after a decision |
| O4 | Review an essay | Work › Writing (`/review?mode=writing`, `/essays/:id`) — `]` next |
| O5 | Open a student's case | Students → case (`/students/:id`) — persistent case header |
| O6 | Prepare / hand off a submission | Work › Submissions (`/review?mode=submissions`) |
| O7 | Chase deadlines | Today › "14일 내 마감" → `/tasks?view=deadlines` |
| O8 | Find a student | Global search (top bar) or `/` in a list |
| O9 | Offer an add-on / handle a payment | Case › service panel; `/services`, `/payments` |
| O10 | Watch team performance | Insights (`/performance`) |

Primary navigation: 오늘 · 학생 관리 · 지원·서류 · 메시지 · 통계 · 설정 (HQ tools under their own section for HQ only).

## University — the eight jobs

| # | Job | Screen |
|---|---|---|
| U1 | See what needs us now | Home review inbox (`/`) |
| U2 | Review an applicant | `/applications/:id` — evidence table, decision panel, previous/next |
| U3 | Decide | Decision panel → confirmation modal |
| U4 | Ask for missing information | Decision panel › 서류 요청 |
| U5 | Monitor the pipeline | Stage rail over the applicant table (`/`, `/applicants`) |
| U6 | Talk to Hangyul | Messages |
| U7 | Read outcomes and trends | Insights (`/analytics`) |
| U8 | Administer programmes, team, exports | Settings hub (`/manage`) |

## What changed in the information architecture

| Product | Before | After |
|---|---|---|
| Student primary nav | 홈 · 대학 · 지원 현황 · 메시지 + 5th tab **"내 여정"** (desktop: "더보기") — two names for one menu | 홈 · 대학 · 지원 현황 · 메시지 · **더보기** on every width (one name, WCAG 3.2.4) |
| Student journey | Six-stage strip + summary **above** the next action (≈150 px of a phone's first screen) | One line (six segments · "6단계 중 2단계 · 준비") with "전체 여정 보기"; the next action is the first block |
| Student profile | Seven sections in one list | Three chapters — 지원 준비 · 유학 목표 · 나에 대해 — same seven sections, still saved one at a time |
| Student documents | Every group open, complete ones included | Opens on **해야 할 일 N**; 검토 중 · 완료 · 전체 one tap away |
| Operations Today | Lanes + an 11-cell stage matrix above the queue | Lanes + upcoming deadlines + "단계별 보기" (rail folded, remembered per browser) |
| University home | Four columns of outcome rates + two charts above the work table | Review inbox (결정 필요 · 보완 서류 · 새로 접수 · 다가오는 일정); rates and charts live on 통계 |

Routes removed from primary navigation in this pass: 0 (the four-destination model was already in place); screens
whose secondary content was folded or moved: 6 (Student home journey, Student documents, Student profile, Operations
Today stage matrix, University home outcome band, University home charts — the last two moved to `/analytics`).

## Task-efficiency benchmark

| Task | Before | After | What changed |
|---|---|---|---|
| Find the next thing to do (Student, 390) | 1 screen, 0 clicks; the next-action panel started at y≈340 px under a ≈130 px journey strip, its button ended at y≈572 | 1 screen, 0 clicks; panel at y=243, button ends at y=474 (journey line 44 px); home 2,550 → 2,293 px | Journey folded |
| Understand why a programme is a match | Match → 1 click on "why" per row | Match, 0 clicks: met requirements (✓) and the one thing to check (△) on the row | Inline checks |
| Find a correction request (Student) | Documents → scroll past complete groups (3,493 px page at 390) | Documents opens on "해야 할 일 5" (2,590 px), the correction is the second block | View filter |
| Upload a missing document | Home → 처리할 서류 row → Documents → Upload (3 clicks) | Same (3 clicks); the home row now groups "아직 올리지 않은 서류 3개" | — |
| Go from a team message about a document to the document | Messages → thread → 더보기/Documents → find row (≥ 3 clicks) | Thread → "서류 보기" under the message (1 click) when the message carries the document | Message deep links |
| Reply to Hangyul | Messages → thread → type → send (2 clicks + 1 field) | Same | — |
| Understand application status | Application → status + "최근 변경: <same status>" | Application → status once (+ what changed only when different) | Duplicate removed |
| Operations: reply to an urgent student | Today → row → Reply (2 clicks) | Same (2 clicks); first row visible without the stage matrix | Rail folded |
| Operations: review the next document | Review → decide (V/C) → auto-advance (1 key per document) | Same; shortcut list one key away (`?`) instead of only on Settings | Shortcut discovery |
| University: open the first applicant needing a decision | Home → "결정 필요 15" (1 click) → row (1 click); table started below the fold at 1440 | Same clicks; the first applicant rows are above the fold at 1440 | Inbox replaces KPI band |
| University: confirm an offer | Decision → modal → "확인" | Decision → modal naming applicant + programme + intake (and unverified required documents) → "합격 통보" | Decision safety |

Input fields required for a first-time student before matching works: unchanged (registration collects name, email,
phone, nationality; the profile reuses nationality for residence and never asks for name or e-mail again — WCAG 3.3.7,
see `results/wcag22.json`).
