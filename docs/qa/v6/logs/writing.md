# V6 writing review workstream — log (2026-10-01)

1. Audit (before captures `docs/qa/v6/writing/before/`, 1440×900 + 390×844, viewport + full page): REPORT §34.3 C6
   confirmed — the essay was a ~600px column between a metadata grid card and a comments rail, with a "Sample wording …
   not the university's official question" dev label, five tabs (Comments/Checks/Rubric/Gate/Versions), approve/next as
   page-header buttons, no queue memory, no "next after decision", suggestions only "Accept" or "Mark resolved" (no
   recorded decision; the reviewer never knew), no authorship statement. Kept: checks engine, fact checks, gate,
   matching, SLA/escalation, prompt versions, internal notes.
2. Server: models + migration `f6b7c8d9e0a1` (on head `e6a1b2c3d4f5`, applied in `hg-migrate.lock`); decision and
   attestation endpoints; queue next by view/position; two new checks; V6 rubric (+ `extra_62_writing_v6.py`, applied to
   the dev DB, idempotent — second run changes 0 rows). `test_v6_writing.py` 12 passed; `test_v5_writing*.py`,
   `test_flows.py`, `test_v4_purge_e2e.py` 28 passed.
3. Agency workspace rebuilt (manuscript-first, one rail / bottom sheet, annotations, inline diff, keyboard, decide → next),
   queue (memory, Open next essay, escalation in the SLA column), WritingInsights demo callout removed.
4. Student editor rebuilt (margin comments, accept / keep per suggestion, used-by line, authorship statement on submit).
5. i18n `writing`: en + ko (all new keys), vi / ne / my machine drafts of the student-facing keys (`student6`, `topic`,
   `finding.CROSS_APP_CONFLICT`).
6. Tests: vitest agency 6 / student 10 passed; Playwright `e2e/v6-writing.spec.ts` 4 passed (desktop). The E2E account
   and staff notifications about its "E2E" essay are purged (dry run after: none). `e2e/v5-writing.spec.ts` updated to
   the V6 UI (attestation dialog, `.wr-text`, gate in Checks) but **not run** (brief: run only the V6 spec).
7. After captures `docs/qa/v6/writing/after/` (+ `suggestion-*` = a pending suggestion, captured from a kept E2E state
   and purged afterwards). The VM rebooted twice mid-session; files and the migration survived.
