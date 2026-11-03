# Admission success — strategy, portfolio, metrics (V5)

*Owner: success workstream. Code: `server/app/services/strategy.py`, `server/app/api/v1/success.py`, `server/app/models/v5_success.py`; seed `server/app/seed/extra_50_success.py`; tests `server/tests/test_v5_success.py`, `apps/student-web/src/lib/success.test.ts`, `e2e/v5-success.spec.ts`. Submission hub: see `docs/SUBMISSION_CONNECTORS.md`.*

## Principles

- **No score, no percentage, no probability.** Every application gets named items. Each item has a reason, an action and an owner.
- **Only real data:** published minimums, the profile, the vault and checklist, essays, university document requests, intake dates, the budget service and scholarship rules.
- **Historical outcomes** appear only for a defined cohort with n ≥ 5 real (non-demo) decided applications from earlier intakes (`historical_context`). In the demo dataset they are always withheld, and the UI shows nothing.
- **Sample data is labelled.** Recommended language levels are `LanguageRecommendation` rows with `basis=SAMPLE`. Every item built on them carries `sample: true`, and the UI shows "Sample data".
- **Decision support, never auto-choice.** The portfolio observes. It never picks or ranks a winner.

## A. Strategy per application

`application_strategy(db, app, profile?, today?, audience='student'|'agency')` → `{scope, state, items[], fit[], counts, blocked_by, history}`.

- `scope`: `prep` (DRAFT…READY), `review` (SUBMITTED…WAITLISTED), `closed` (decided or later: no items).
- `state`: `BLOCKED` if any blocker, else `IMPROVABLE` if any improvement, else `READY`. Info items never count.
- Item: `{code, severity: blocker|improve|info, owner: student|counselor|university, title, why, params, action{code,label,link}, sample}`. Items are ordered by severity, then by urgency. English `title`/`why` are fallbacks; clients translate `success:item.<code>.*` (agency: `success:agencyItem.<code>`).

| Check | Codes | Severity | Owner |
|---|---|---|---|
| University document request | `REQUEST_OPEN` (the university's note is the "why") | blocker | student |
| Documents (same merge as the workspace lanes) | `DOC_FIX`, `DOC_MISSING`, `DOC_UPLOAD_APPROVED`, `DOC_LEGALIZE` (apostille/consular), `DOC_RENEW`, `DOC_TOO_OLD` | blocker | student |
| Document review | `DOC_IN_REVIEW`, `DOC_REVIEW_LATE` | blocker | counselor |
| Essays (Essay.status; writing hook below) | `ESSAY_WRITE`, `ESSAY_REVISE` / `ESSAY_REVIEW` | blocker | student / counselor |
| Academic / language eligibility (matching engine stage 1) | `ELIG_EDUCATION`, `ELIG_NATIONALITY`, `ELIG_GPA`, `ELIG_LANGUAGE` | blocker | student / counselor |
| Profile gaps | `PROFILE_EDUCATION`, `PROFILE_GPA` | improve | student |
| Recommended level (SAMPLE) | `LANGUAGE_RECOMMENDED`: "TOPIK 3 meets the minimum; this program recommends 4+" | improve | student |
| Program fit | `FIELD_DIFFERENT`, `DEGREE_DIFFERENT`, `EDUCATION_EXPECTED`, `LANGUAGE_PLANNED`; met reasons → `fit[]` | info | student |
| Deadline feasibility | `DEADLINE_PASSED` (blocker, counselor); `DEADLINE_TIGHT` when days left < planning estimate (improve) | — | — |
| Budget (budget service first-year range vs profile budget) | `BUDGET_OVER` (improve), `BUDGET_TIGHT`, `BUDGET_UNKNOWN` (info) | — | student |
| Scholarship fit | `SCHOLARSHIP_APPLY` (improve: separate application with an open deadline), `SCHOLARSHIP_NONE` (info) | — | student |
| Interview | `INTERVIEW_REQUIRED` (info, pre-submission); `INTERVIEW_SCHEDULED` (improve, INTERVIEW status) | — | counselor / student |
| University-specific | `PORTFOLIO_REQUIRED` (improve), `UNIVERSITY_NOTE` (info, quoted) | — | counselor / university |
| Passport validity | `PASSPORT_EXPIRES` (improve): expires < semester start + 183 days | — | student |
| Completeness | `FINAL_CHECK` (improve, counselor): nothing blocks except the final check | — | counselor |
| Submission | `SUBMISSION_CONFIRM` (improve): handed off / unconfirmed without evidence | — | student |

**Deadline planning estimate** (a documented working rule, not a prediction). It adds up days per open item: legalization 14, renewal or too-old 7, essay to write 7, fix/upload/revise 3, then +2 for the counselor's final check. If the days left before the deadline are fewer than that total, the application gets `DEADLINE_TIGHT`.

**Writing hook.** `strategy.register_essay_hook(fn)` registers `fn(db, essay) -> list[item]`, so the writing workstream can add quality-gate items without editing this module. Hook failures are swallowed so they never break the page.

> **V13 correction.** This paragraph said "the writing workstream uses it" from V5 until V13, and for those eight passes **nothing registered a hook** — `_ESSAY_HOOKS` was empty and the only `register_essay_hook` reference in the server was its own definition. The existing test passed throughout because it clears the list and registers its own hook, proving the mechanism and never asking whether anything used it. `writing.application_quality_items` is registered now, and `server/tests/test_v13_quality.py::test_a_real_essay_hook_is_registered_in_the_running_app` imports `app.main` and asserts a real registration by name, so the documentation and the product cannot drift apart again in silence.

| Gate | Item code | Severity | Owner |
|---|---|---|---|
| `NAMES` | `ESSAY_WRONG_NAME` — the essay names the wrong university | blocker | student |
| `WORD_LIMIT` | `ESSAY_OVER_LIMIT` — over the university's published limit | blocker | student |
| `PROMPT_ANSWERED` | `ESSAY_PROMPT_GAP` — part of the prompt is unanswered | blocker | student |
| `PROFILE_CONSISTENCY` | `ESSAY_CONTRADICTS_PROFILE` — contradicts the documents | blocker | student |

Only `BLOCKER` gates become items. `WAITING` gates ("not assessed yet") are deliberately silent: an application page listing everything not yet checked is a reviewer's to-do list, not an applicant's quality check.

**Still not implemented (V13, brief Part 7):** document-to-document identity consistency (name, date of birth, school, GPA), translation requirements, recommendation requirements and application-fee state. `ExtractedField` and `DocumentFinding` hold the data for the first of those; nothing aggregates it into an application-level blocker.

### UI

- **Student application page.** A compact block sits under the three lanes. It reads "N things can still improve this application" or "Ready — nothing else affects this application". Items the lanes already show (documents, essays, requests, final check) are **not repeated**; the block says "N of them are in the checklist above". Below that come "Why it fits: …" and a collapsed "Good to know" for info items.
- **Student workspace lanes.** Small change in `lib/workspace.ts`: once READY, the "Final check, then sends your application" item is gone, because the hand-off hero says who submits.
- **Applications list.** One line per application: `Ready` / `N things to improve` / `Blocked by: {first blocker}`. It is silent after a decision.
- **Agency application drawer.** "What still affects it": single-line items with the owner (Student / Counselor / University).

### Hook for the coordinator (Home)

`strategy.today_for_student(db, user, today=None, limit=3) -> list[dict]` answers "What should I do today to improve my outcome?". It returns up to 3 student-owned items across the student's applications, each carrying `application_id`, `university` and `deadline`. Order:
1. Submission steps first: `SUBMISSION_HANDOFF`, then `SUBMISSION_CONFIRM` (from `submission.next_step`).
2. Blockers, then improvements, earliest deadline first.

The same document is counted once across applications. The API equivalent is `GET /me/strategy` → `today`.

## B. Portfolio

`portfolio(db, student_user_id)` → `{entries, groups, saved_groups, offers, admitted, deadline_cluster, budget, observations, questions, review}`.

- **Entries.** Active applications plus saved programs that have a program. Tiers use the V4 vocabulary: STRONG → Strong match, COMPETITIVE → Possible match, REACH / NOT_ELIGIBLE → Not eligible yet. Applications already with the university are `sent` (no fit estimate).
- **Deadline concentration.** At least 3 pre-submission deadlines within 7 days, or at least 2 on the same day.
- **Budget spread.** The min/max of the first-year ranges, plus a count over budget.
- **Observations** (plain sentences, `success:obs.*`): `FEW_OPTIONS`, `NO_APPLICATIONS`, `ALL_POSSIBLE`, `ALL_NOT_YET`, `SOME_NOT_YET`, `MANY_APPLICATIONS` (>6), `SAME_DAY_DEADLINES`, `DEADLINES_CONCENTRATED`, `NO_BUDGET`, `ALL_OVER_BUDGET`, `SOME_OVER_BUDGET`, `SAVED_STRONG_OPTION`, `COMPARE_OFFERS`, `ADMITTED` (once a place is accepted the questions no longer apply).
- **Agency questions:** too few programs? all too difficult? unnecessary applications? deadlines too concentrated? budget problem? needs another realistic option? Each is a yes/no with the observation behind it.
- **Counselor review** (`portfolio_reviews`) records `decision` (BALANCED | ADD_OPTION | DROP_OPTION | SPREAD_DEADLINES | BUDGET_TALK | DISCUSS), a staff-only `note`, `reviewed_by`, `reviewed_at`, and the observation codes at the time. `stale` = the observations have changed since the review. Students see only that, and when, their plan was reviewed, never the note.
- **UI.** Student: "Your plan" section on Applications. Agency: the **Portfolio** tab in the student workspace.
- **API.** `GET /me/portfolio`, `GET /agency/students/{id}/portfolio`, `POST /agency/students/{id}/portfolio/review` (owner / manager / counselor; other agencies get 404).

## D. Metrics hook

`strategy.success_metrics(db, org_id | None, cohort "YYYY-TERM" | None)` (API `GET /success/metrics`):

| Metric | Definition | n |
|---|---|---|
| `time_to_ready_days.median` | Days from application start to its first move to READY | apps that reached READY; withheld if n < 5 |
| `completeness_at_submission.mean` | Share of required checklist items ready when the submission was recorded (snapshot on the record) | confirmed records with a snapshot; withheld if n < 5 |
| `submissions_with_evidence` | Submitted applications with a confirmed submission record | submitted apps |
| `missed_deadlines.count` | Deadline passed while still in preparation, or recorded as submitted after the deadline | apps whose deadline passed |

`scope.includes_demo` says whether sample data is in the population.

## Seed

- **Connectors.** Built from research, with NEEDS_REVIEW placeholders for gaps.
- **Language recommendations.** SAMPLE rows: TOPIK 4 recommended for the Korean-taught BBA at Korea, Yonsei, Sogang and Seoul National.
- **Sample submission records.** Every seeded application already past SUBMITTED gets one: `DEMO-…` confirmation, recorded by the agency. Payable fees are set to CONFIRMED.
- **Portfolio review.** One sample review for Lan.
- **FLOW A persona.** The Nepal student fixture (created in `extra_15_v5_personas.py`, test databases only — V32): nothing is pre-recorded, so the hand-off starts clean.

## Known limitations

- The tiers in the portfolio reuse the matching engine per program; the list is not paginated (fine for tens of programs).
- Recommended language levels are sample data only. No university-published recommendation is stored yet.
- The strategy block on the application page is a separate request (`/applications/{id}/strategy`), not part of the application detail payload.
- Historical context is implemented, but it will not show until real, non-demo outcomes exist.

## V9 (2026-10-14)

- **Language routes** feed strategy and the early home: when language blocks the degree, `language_routes()` lists (a) Korean language programs that accept the student now (length, first-year cost, D-4-1 → D-2), (b) English-taught programs and their IELTS/TOEFL level, (c) the smallest test step and what it opens. Counts only, "not an offer"; nothing is ranked.
- **New strategy item `REQUIREMENT_CHANGED`**: when a university changes an admission rule after a student has applied, the application is not silently invalidated; the student and counselor see "{university} changed its admission rules … Your counselor checks whether the new rule applies" (en/ko + gated locales).
- **Portfolio, deadline planning and "no score, no percentage, no probability"** unchanged. Deadline risk is surfaced to the owner (`DEADLINE_PASSED` task `task.deadlinePassed`: student, university, program) and to the manager's Operations "Deadlines at risk".
- Process quality for agencies (correction loops, revision loops, completeness at submission, extra-document rate, missed deadlines, turnaround, response time, visa extra documents, arrival issues) is on the agency Process-quality tab, cohort + n, n < 5 withheld, no causal claims.
