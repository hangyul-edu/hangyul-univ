# V5 log — success (admission strategy, portfolio, submission hub)

## Backend
- **Migration `d5a1c0e55ccd`** (down `c75a07df7958`), created and applied under hg-migrate.lock. Tables: `submission_connectors`, `language_recommendations`, `application_submissions`, `portfolio_reviews`.
- `server/app/models/v5_success.py`: SubmissionConnector, ApplicationSubmission, PortfolioReview, LanguageRecommendation. Recommended level is its own table, so admission_requirements is untouched.
- `server/app/services/strategy.py` (new):
  - `application_strategy`: what still affects each application. Returns READY / IMPROVABLE / BLOCKED plus an ordered list of items (code, severity, owner, why, action, sample flag). No score.
  - `today_for_student`, `portfolio`, `historical_context` (n≥5, non-demo only), `success_metrics`, and `register_essay_hook` for the writing workstream.
- `server/app/services/submission.py` (new):
  - Connector classes; `DirectApiConnector` and `PartnerApiConnector` raise `NotConfigured`. Most-specific connector resolution.
  - Hand-off, `record_confirmation` (evidence rules), fee status, and a student task "Add your confirmation" (dedupe `submission-confirm:{app}`, source SUCCESS).
  - Research loader for `docs/research/submission-methods.json` (per-level entries). NEEDS_REVIEW placeholders fill any gaps.
  - `on_submitted` and `require_evidence_for_student` hooks.
- `server/app/api/v1/success.py`: GET /me/strategy, GET /applications/{id}/strategy, GET /agency/students/{id}/strategy, GET /me/portfolio (counselor note hidden), GET/POST agency portfolio + review, GET /applications/{id}/submission, POST …/submission/handoff|confirm|fee, GET /submission/connectors, GET /success/metrics.
- **Shared edit, `server/app/api/v1/applications.py` transition (small):**
  - A STUDENT → SUBMITTED transition needs a confirmed submission record (409 otherwise).
  - On SUBMITTED, `submission.on_submitted` records an honest submission record.
  - `/submission/confirm` reuses the existing transition handler, so the state machine stays authoritative.
- **Seed `extra_50_success.py`:**
  - Connectors from research: all 10 universities are researched; LANGUAGE-level programs get a placeholder.
  - SAMPLE TOPIK-4 recommendations for the BBA at Korea, Yonsei, Sogang and SNU.
  - Sample confirmed records (DEMO-… refs) for applications already submitted.
  - One sample portfolio review for Lan.
  - No Nepal persona created: the coordinator's `student.nepal@` is used.
  - I also ran this seed on the dev DB, touching only my tables, for screenshots.

## Frontend
- **Student:**
  - New `components/success/{Strategy,Submission}.tsx` + `success.css`, `lib/success.ts` (+ test).
  - `ApplicationDetail.tsx` (small edits): the READY hero is now the hand-off; a StrategyBlock sits under the lanes; an evidence line appears after submission.
  - `Applications.tsx`: one strategy line per row, plus a "Your plan" portfolio section.
  - `lib/workspace.ts`: the "final check, then sends" lane item is no longer shown when READY, because the hand-off says who submits.
- **Agency:**
  - `components/success/{SuccessPanel,PortfolioTab}.tsx` + css, `lib/success.ts`.
  - `ApplicationPanel.tsx` gets 2 lines (strategy + submission sections).
  - `StudentWorkspace.tsx` gets a Portfolio tab.
  - One key added in agency.json en/ko: `ws.tab.portfolio`.
- **University:** `components/success/SubmissionEvidence.tsx`, plus one line in the ApplicationDetail header.
- **packages:** types (appended V5 success block), api-client (`success` namespace appended).
- **i18n `success`:** en + ko complete; `my` machine draft for the student-facing keys.

## Tests
- `server/tests/test_v5_success.py`: 11 tests pass. Full pytest: all pass (last run).
- vitest student `src/lib`: 39 pass, including 6 new tests in `success.test.ts`.
- Typecheck: agency-web and university-web are clean. student-web shows errors only in other workstreams' files (EssayEditor.tsx; components.test.tsx `MatchReason.points`). Ruff is clean on my files; failures are in other workstreams' files only.
- E2E `e2e/v5-success.spec.ts` (not run). It needs a db:reset; it skips if the Nepal persona is already submitted.

## Screenshots
`docs/qa/v5/success/`: student hand-off and list at 390/1440, agency portfolio and drawer, university applicant.

## Hooks for the coordinator
- `app.services.strategy.today_for_student(db, user, limit=3)`: the top 3 improvements for Home (submission hand-off first).
- `app.services.submission.next_step(db, app)`: the hand-off or confirm item for one application.
- `app.services.strategy.success_metrics(db, org_id|None, cohort)`: time to READY, completeness at submission, submissions with evidence, missed deadlines, each with a definition and n.
- `app.services.strategy.register_essay_hook(fn)`: for the writing quality gate.

## Not done / for the coordinator
- `common:task.submissionConfirm` key is missing (common.json isn't mine), so the task title shows the English fallback.
- The strategy is not in the agency Today view or the student Home. The hooks above are provided instead.
- Native apps are not updated.
