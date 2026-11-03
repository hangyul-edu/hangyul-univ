# V5 log — writing (workstream "writing")

Doc: `docs/WRITING_REVIEW.md` (rules, sources, integration, fallbacks, security, limitations).

## Migration
- `server/alembic/versions/a5e7c1d2b901_v5_writing.py` — revision **a5e7c1d2b901** (down_revision e5c0c1e2a7b1), created and applied inside the migrate lock. 9 tables: writing_prompts, review_rubrics, rubric_scores, essay_reviews, writing_findings, reviewer_profiles, writing_policies, writing_events, writing_outcomes. The Essay table itself is unchanged (review state lives in `essay_reviews`, 1:1).

## Changes (file — what — why for users)
- `server/app/models/v5_writing.py` — 9 models (see doc). Prompts versioned by intake with SAMPLE/COUNSELOR_ENTERED/VERIFIED status.
- `server/app/services/writing_checks.py` (new) — deterministic checks: limit/language, prompt clause coverage, repetition, generic phrases, "could be sent anywhere", other-university mention, name misspellings, cross-student similarity (staff-only, never reveals the other text), fact verification vs profile (grad year, degree level, GPA, TOPIK/IELTS, nationality, school, age). Never rewrites text.
- `server/app/services/ai_provider.py` (new) — `HG_AI_PROVIDER` abstraction, default none; anthropic not implemented (falls back, says so). claude-api skill not loaded (no adapter built).
- `server/app/services/writing.py` (new) — prompt resolution/versioning, check orchestration + finding reconciliation, rubric, quality gate + manager override, authorship, reviewer matching + audited override, SLA policy/sweep/escalation, queue, Today rows, approved versions → checklist, outcomes, metrics.
- `server/app/api/v1/writing.py` — `/writing/queue`, `/writing/today`, `/writing/essays/{id}/next|checks|findings/{fid}/dismiss|rubric/{dim}|candidates|reviewer|prompt`, `/writing/prompts` (GET/POST), `/writing/applications/{id}/approved`, `/writing/policy`, `/writing/reviewers`, `/writing/insights`.
- `server/app/api/v1/collab.py` (essay section only, in place) — `ser_essay` adds a `writing` block; GET essay runs the SLA sweep for that essay (truthful "flagged"); list commits lazily created records; `EssayStatusIn.override_reason`; APPROVED goes through the quality gate; SUBMITTED calls `on_submitted` (round, SLA, checks, reviewer matching; status AGENCY_REVIEW when a reviewer exists); staff transitions call `on_staff_transition`.
- `server/app/services/readiness.py` — one call at the end of `checklist()`: `apply_essay_versions()` → essay-backed requirement is ready with the approved version (student no longer uploads the approved essay separately; tasks engine no longer asks for it).
- `server/app/seed/extra_52_writing.py` (new) — rubric, policy, Hangyul writing specialist `writing@demo.hangyul.kr` (HANGYUL_COUNSELOR, password Hangyul!2026), reviewer profiles, SAMPLE prompts (PNU BBA PS v1→v2 versioning; PNU Media PS deliberately unknown), review state/events for every essay, Lan's KNU PS (due < 48 h, rubric partly rated, Hangyul second-read comment, real FACT_DEGREE finding), Lotus overdue case (student06, escalated), revised round 2 (student09 PS), final review (student09 SP), historic events + outcomes. Removes the core seed's unsourced generic `essay.prompt` sentence. Also applied once to the dev DB (guarded one-off) for screenshots.
- `packages/types/src/index.ts` — additive: `EssaySummary.writing?`, Writing* types (`ReviewerMatchReason` named to avoid merging with the existing `MatchReason`).
- `packages/api-client/src/index.ts` — appended `writing` group.
- `packages/i18n/locales/{en,ko}/writing.json` — full; `my/writing.json` — machine draft of student-facing keys.
- Agency: `pages/Essays.tsx` (queue: 7 views with counts, columns student / university+program / essay / version / deadline / waiting+time left / reviewer / next action, j/k/Enter, "Start with the oldest", manager link to insights), `pages/EssayEditor.tsx` (context header: student, university, program+intake, essay+version, deadline, review status, reviewer with authorship + reassign, review due/late/escalated; prompt with SAMPLE/source/version or "attach/enter"; inline comment + finding highlights; explicit two-mode composer "Comment to student / Internal note" like V4 messages; tabs Comments · Checks · Rubric · Gate · Versions; approve through gate / manager override modal; reassign modal with match reasons; keys n / c / 1–5), `pages/WritingInsights.tsx` (new, `/essays/insights`), `lib/writing.ts`, `pages/writing.css`, `router.tsx` (+1 route).
- Student: `pages/Essays.tsx` (university name, "expected by"/"taking longer" in rows; prompt field reworded as "paste it if you have it"), `pages/EssayEditor.tsx` (university question card with SAMPLE/unknown honesty, truthful status sentence, "Please check these sentences" fact card, Automatic check card with "Check my draft", comment authorship by type, gate in final review, "application still uses version N"), `lib/writing.ts` + `writing.test.ts`, `pages/writing.css`. No "write for me" anywhere.
- `e2e/v5-writing.spec.ts` (new, not run) — FLOW D.

## Tests
- `pytest tests/test_v5_writing.py tests/test_v5_writing_checks.py` — 23 passed. Full suite `pytest tests/` — all passed (exit 0).
- vitest `apps/student-web/src/lib/writing.test.ts` — 6 passed.
- typecheck agency-web, student-web, university-web — clean. ruff — clean.
- Screenshots: `docs/qa/v5/writing/` (queue, workspace, insights, final review; student list + editor) at 1440 and 390, looked at; fixed queue column truncation and the approve button (secondary with blocker count when blocked).

## Hook functions for the coordinator (`app.services.writing`)
- `today_items(db, principal) -> list[dict]` — kinds WRITING_OVERDUE / WRITING_DUE_SOON / WRITING_REVISED, tenant-scoped, sweeps SLA first. Same rows at `GET /writing/today`.
- `student_status(db, essay) -> dict` — codes DRAFT / WAITING_REVIEWER / REVIEWING / LATE / LATE_FLAGGED / CHANGES / FINAL / READY.
- `writing_metrics(db, org_id=None, period_days=90)` — median turnaround h, median revision rounds, SLA breaches.
- `sla_sweep(db)` and `record_outcomes(db)` — idempotent; please call from `app/jobs/daily.py` (not edited by me) and optionally `record_outcomes(db, [app.id])` in the decision transition hook.
- `approved_essays_for_application(db, application_id)` — for the dossier/package builder.
- Please add to `common.json`: `task.writingOverdue` ("Overdue essay review: {{essayType}} — {{student}}"), `task.writingEscalation`, `notify.writingOverdue`, `notify.writingEscalation` (English fallbacks are used until then).

## Could not do / notes
- E2E not run (coordinator). Existing lifecycle/flows essay paths still pass (approval without blockers is unchanged).
- Anthropic adapter not built (no key; off by default by design).
- Agency Today page and daily job not edited (coordinator-owned).
- Burmese = machine draft.
