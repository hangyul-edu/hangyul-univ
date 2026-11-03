# V6 — direct university application / submission workstream log

*2026-10-01. Design and the honest status table: `docs/SUBMISSION_CONNECTORS.md` → "V6".*

## Course correction (coordinator, mid-task)
Research (`docs/COMPETITOR_BENCHMARK.md`, "Submission reality (2026-10)") found that UWAY / JinhakApply / Gradnet require the applicant to apply personally. So `AUTHORIZED_AGENCY` needs a recorded legal basis on the connector (`agency_submission_basis`) plus a per-agency permission; no real university gets it. The default stays guided self-submission. The flow is shown only through a development fixture (inactive program, `is_demo`, never seeded in production).

## Built
- Migration `e6a1b2c3d4f5` (one hand-written revision on `f5e1a2b3c454`, applied inside `hg-migrate.lock`). It adds connector columns, `submission_agency_permissions`, `submission_authorizations`, failure columns, and rewrites the data from AGENCY_ASSISTED to AUTHORIZED_AGENCY.
- Service and API:
  - consent: authorize / revoke
  - agency failure report
  - API-submit endpoint (always 409 AWAITING_PROVIDER)
  - agency queue
  - dev-only fixture application endpoint
  - idempotent record
  - final review
  - guided details: steps, files, what to enter, counselor review, time estimate
- Seed `extra_60_submission_v6.py`, applied to the running dev DB with `python -m app.seed.extra_60_submission_v6` (idempotent). The new connector columns were back-filled in place.
- Student: guided plan, consent modal, withdrawal, failure/changed notices, evidence line (who submitted + receipt).
- Agency:
  - "Ready to submit" page with tabs, table and drawer
  - nav badge
  - drawer: final review, portal link, snapshot, record (ref required + receipt), failed-attempt report
  - application drawer shows the authorisation state
- University: legacy method label normalised.
- i18n: `success` en/ko complete. `my` machine draft for the student-facing keys (vi/ne have no `success` file). `agency:sidebar.submissions` added in en/ko.

## Tests
- `server/tests/test_v6_submission.py`: 5 passed. Together with `test_v5_success.py` (11), 16 passed. `test_agency_assisted_submission` was updated to PARTNER_API for the rename.
- Regression subset: test_v3_student_home, test_v4_coherence, test_flows, test_v6_hq_ops and test_agency_views all pass.
- `e2e/v6-submission.spec.ts`: 1 passed (8.6 s). Purge dry-run afterwards: "No e2e accounts found / E2E rows on seeded data: none". The fixture program is still inactive.
- `tsc --noEmit` is clean for the changed files in student, agency and university web. The remaining errors belong to other files: Services.tsx and mobile-ui Settings.tsx.

## Screenshots (`docs/qa/v6/submission/`, `node scripts/qa/_v6sub-shots.mjs`)
- `student-authorize-ready-{390,1440}`: READY, agency submission available.
- `student-authorize-consent-{390,1440}`: consent screen (button disabled until the checkbox is ticked).
- `student-guided-{390,1440}`: Kyungpook via UWAY. Shows what Hangyul completed, the steps, the files and what to enter.
- `agency-queue-1440`, `agency-queue-awaiting-1440`, `agency-detail-1440`: queue and drawer (cobalt console).

## Known limitations
- The fixture program belongs to Pusan National University, because a program needs a university. The page header therefore reads "Pusan National University". The program name, the "Fixture" tag and the basis line disclose it.
- The home hero only promotes SUBMISSION_HANDOFF/CONFIRM (student.py / Dashboard.tsx are not owned here). SUBMISSION_AUTHORIZE appears in "What you can do today" with its own strings. The mobile journey also does not special-case it.
- The new personas are not in the Demo access picker (`packages/auth` DEMO_PERSONAS, other workstream).
- Time estimates are Hangyul's per-step guesses and are labelled as such.
