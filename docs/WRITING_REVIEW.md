# Writing review (V5)

Personal statements, study plans and statements of purpose are reviewed by people — an agency reviewer or a Hangyul
reviewer — with deterministic **automatic checks** alongside. Nothing in this system writes, rewrites or invents
content for a student.

## 1. Current implementation

| Part | Where |
|---|---|
| Models (9 tables) | `server/app/models/v5_writing.py` — WritingPrompt, ReviewRubric, RubricScore, EssayReview, WritingFinding, ReviewerProfile, WritingPolicy, WritingEvent, WritingOutcome. Migration `a5e7c1d2b901_v5_writing.py` |
| Workflow service | `server/app/services/writing.py` (prompts, checks orchestration, rubric, gate, matching, SLA, queue, approved versions, outcomes, metrics) |
| Automatic checks | `server/app/services/writing_checks.py` (pure functions) |
| AI provider abstraction | `server/app/services/ai_provider.py` (`HG_AI_PROVIDER=none` default; `anthropic` not implemented → falls back and says so) |
| API | `server/app/api/v1/writing.py` (`/writing/*`); essay endpoints in `server/app/api/v1/collab.py` (essay section) now carry a `writing` block and call the service on submit / review / approval |
| Checklist | `services/readiness.checklist()` calls `writing.apply_essay_versions()` — an essay-backed requirement is fulfilled by the essay's **approved version** |
| Agency UI | `apps/agency-web/src/pages/Essays.tsx` (queue), `EssayEditor.tsx` (review workspace), `WritingInsights.tsx` (`/essays/insights`, managers), `lib/writing.ts`, `pages/writing.css` |
| Student UI | `apps/student-web/src/pages/Essays.tsx`, `EssayEditor.tsx`, `lib/writing.ts` (+ `writing.test.ts`), `pages/writing.css` |
| i18n | namespace `writing` (en, ko; my = machine draft of student-facing keys) |
| Seed | `server/app/seed/extra_52_writing.py` |
| Tests | `server/tests/test_v5_writing.py`, `test_v5_writing_checks.py`; `e2e/v5-writing.spec.ts` (FLOW D) |

## 2. Rules

### University question (prompts)
- A prompt belongs to a university, optionally a program, an essay type, and either one intake (`intake_year/term`) or
  an intake onwards (`effective_from_year/term`). A new wording is a new **version**; the old one gets `superseded_by`
  (for later intakes). Resolution for an essay: program-specific beats university-wide, exact intake beats
  effective-from, latest effective-from not after the essay's intake wins.
- `verification_status`: **SAMPLE** (demo wording written by Hangyul — never shown as official, "Sample question" label
  everywhere), **COUNSELOR_ENTERED** (typed by a reviewer, not checked), **VERIFIED** (only Hangyul, only with a
  `source_url`; `verified_at` recorded).
- An essay links to the version used (`essay_reviews.prompt_id`). No prompt known → student: "We don't have this
  university's exact question yet — your counselor confirms it"; reviewer: "Attach or enter the question".
- The core seed's generic sentence copied into every essay's `prompt` field was removed (it was unsourced).

### Automatic checks ("Automatic check" — never "AI")
Run on submit, on "Check my draft" (student), on "Run checks again" / prompt attach (reviewer). Each finding quotes the
student's own sentence; nothing is rewritten; findings never propose content.
- Limit: words / characters (OVER = blocker, well under = hint); required language.
- Prompt coverage: the prompt is split into clauses ("Describe your motivation…", "your academic background", "your
  study and career plans"); each clause's keywords/concepts must appear. Heuristic → a reviewer rating
  "Answers the question = Meets" overrides it.
- Repetition (repeated sentences, 5-word phrases ×3, sentence openers ×3), generic phrases (list, en + ko), "could be
  sent to any university" (neither university nor program named), overclaims, long sentences, paragraphs.
- Other university mentioned (catalogue names, short forms, Korean names ≠ target) — blocker.
- Target university / program name misspelled (fuzzy near-miss, e.g. "Kyunghee University") — blocker / warning.
- Similar to another document: 8-word shingles against other students' current versions; ≥5 matching shingles and
  ≥60 words → **staff-only** blocker "N passage(s) identical to another document" — the other text and its owner are
  never shown.
- **Fact verification** against the structured profile (blocker until the text changes or a reviewer dismisses it with
  a recorded note): graduation year (past/expected tense), degree level claimed vs highest education, GPA, TOPIK / IELTS
  (future goals like "preparing for TOPIK 5" ignored), nationality / home country, school name, age. Output:
  quote + "Your profile says expected graduation 2027. Please check." The essay and the profile are never changed.
- Re-runs reconcile by fingerprint: dismissals stay dismissed; findings no longer in the text are resolved
  automatically ("No longer in the text").

### Rubric
Hangyul default (org-level rubric supported): 16 dimensions (answers the question, motivation, background→program,
future plan, evidence, structure, repetition, generic, unsupported claims, sounds like the student, limit, names,
contradicts profile, other university, template language, factual consistency). Rating per dimension: Meets / Needs
work / Not assessed + note. **No total, no percentage.** Rubric notes are team-only.

### Quality gate (before approval)
Items: Prompt answered · Program-specific motivation · Future study plan · Word limit · Profile consistency ·
University & program names · Own words (staff only) · Other rubric points · Comments resolved · Reviewer approval.
States: Clear / Blocker / Waiting. Blockers: a mapped rubric dimension rated Needs work; open over-limit, fact,
other-university, name, similarity findings; open prompt-coverage findings unless the reviewer rated "Answers the
question" Meets; unresolved student-visible comments. Approval with a blocker → `409 QUALITY_GATE` unless any agency
administrator (`AGENCY_ADMIN` — one role per tenant since V22) or Hangyul ops/admin gives an override reason (≥10 chars), stored on the review and in the audit
log (`essay.approve_override`, with the blocker list). Students see the gate (without "Own words") in final review.

### Reviewer matching
Candidates: any administrator of the student's agency (one role per tenant since V22 — the assigned counselor is still
preferred by the points below) + Hangyul staff when the student has an agency or a paid service including essay review. Points
(ordering only; the UI shows reasons, never a number): shared language +3, can't read the essay language −3, degree
+2, field +2, target university +2, student's country +2, own counselor +2, reviewed earlier versions +2, −1 per 3 open
reviews, −1 per late review in 30 days (max −3), outside the student's agency −3; at capacity → last. Auto-assigned on
the first submission (kept across rounds). Override: any agency administrator or Hangyul staff, reason required, audited
(`essay.reviewer_override`), open review tasks move to the new reviewer.

### Writing SLA
Policy (Hangyul default, per-organisation override via `PUT /writing/policy`): first review 48 h, revision 48 h,
final review 24 h. On submit: new round, `expected_review_by`. Student status is truthful:
"Assigned to {name} · submitted {time} · expected by {time}"; when late and escalated: "Taking longer than expected —
flagged to the {agency} manager". `sla_sweep()` (runs on queue, Today, essay reads; callable from the daily job) flags
each late round once: notification + URGENT task for the reviewer (`writing-overdue:*`), notification + task for the
agency manager/owner — never the late reviewer themself — or Hangyul operations (`writing-escalate:*`). Tasks close
when the reviewer responds. Task `source = "WRITING"` so the engine never auto-closes them.

### Approved version → application
Approval records `approved_version`. `readiness.checklist()` marks an essay-backed requirement (personal statement,
study plan, CV, recommendation) **ready** with `source: "APPROVED_ESSAY"` and `essay_approved_version` — the student no
longer has to upload the approved essay as a separate file. `GET /writing/applications/{id}/approved` returns the exact
approved text (universities: only submitted applications). If the student reopens and edits, the application keeps the
approved version (`newer_draft: true`) until a new approval.

### Outcome feedback (internal)
`record_outcomes()` links each decided application's approved essays to the decision (OFFERED / REJECTED /
WAITLISTED) with rounds, first turnaround, SLA breaches, rubric counts, override used. `/essays/insights` (managers):
review turnaround median, revision rounds median, late reviews; patterns per group with n, groups n<5 withheld, counts
not rates, explicit "no causal claims", population and intakes stated, sample-data label.

## 3. Sources
No external sources. Prompt wording in the demo is **SAMPLE** (written by Hangyul, `source_url` empty). Real prompts
must be entered with their source and verified by Hangyul operations.

## 4. Integration capability
- `HG_AI_PROVIDER=none|anthropic` (default none). The Anthropic adapter is not implemented in this build; requesting it
  falls back to rule-based checks and `ai_provider.status()` says so. A future adapter may only add anchored
  clarity/structure observations (kind CLARITY) — no replacement content.
- Coordinator hooks: `today_items(db, principal)`, `student_status(db, essay)`, `writing_metrics(db, org_id, period_days)`,
  `sla_sweep(db)`, `record_outcomes(db)`, `approved_essays_for_application(db, application_id)`.

## 5. Manual fallbacks
- Unknown prompt → reviewer enters it (COUNSELOR_ENTERED) with the source link; students can paste the question they have.
- A wrong finding → reviewer dismisses it with a note (recorded).
- A blocker that must be overridden (e.g. deadline) → manager approves with a recorded reason.
- A reviewer unavailable → manager reassigns with a reason.

## 6. Security considerations
- Every essay endpoint uses the existing tenant rule (`ensure_student_access`); universities never see drafts;
  other agencies get 404.
- Agency-entered prompts are visible only to that agency and Hangyul.
- Internal notes, rubric, assignment reasons, override reasons and staff-only findings are never serialized to students.
- Similarity findings never reveal the other document or its owner.
- Audit log: prompt created/attached, finding dismissed, reviewer assigned/overridden, approval override, policy and
  reviewer-profile changes.

## 7. Known limitations
- Checks are heuristics (English-first; Korean covered for limits, generic phrases, graduation year, TOPIK, degree).
  Prompt coverage can miss paraphrases — the reviewer's rating decides.
- Similarity compares only current versions inside Hangyul; no internet plagiarism search.
- New task/notification keys (`common:task.writingOverdue`, `task.writingEscalation`, `notify.writingOverdue`,
  `notify.writingEscalation`) are not in `common.json` (owned by the coordinator) → English fallback until added.
- Agency Today integration is via `today_items()`; the Today page itself is the coordinator's.
- Burmese strings are a machine draft.

# V6 (2026-10-01) — manuscript-first review, student decisions, authorship

Log and screenshots: `docs/qa/v6/logs/writing.md`, `docs/qa/v6/writing/{before,after}/` (`scripts/qa/v6-writing-shots.mjs`).

## Reviewer workspace (`apps/agency-web/src/pages/EssayEditor.tsx`, `writing.css`, `lib/writing.ts`)
- **Layout**: compact sticky context header (student · university · program · intake / type · version · round · status ·
  deadline · reviewer + reassign · review due with late time and "Escalated to …"), actions on the right (Request
  changes, Approve — cobalt, "Approve — n blockers" when the gate is not clear). The university question sits above the
  text (collapsible; staff-only quiet line "Question not yet verified against the official guide" when not VERIFIED —
  the V5 "Sample wording … not the university's official question" label is gone). Live words / characters vs limit.
  Manuscript on white paper, 68ch, serif reading stack (Iowan / Charter / Source Serif / Noto Serif …), 18px / 1.75.
- **One rail**: Comments · Checks · Rubric · Versions (the quality gate moved to the top of Checks and into the approve
  dialog). Under 1100px the rail becomes a bottom dock + sheet (`Drawer sheet`).
- **Comments**: select text → floating "Comment" (or C). Two explicit modes: *Visible to the student* (cobalt card,
  cobalt highlight) vs *Internal note · team only* (amber dashed card + dashed underline). Suggested wording shows its
  state: Waiting for the student / Accepted by the student (date, version) / Declined (with the student's note) /
  Resolved without a decision. Resolved comments are hidden behind "Show resolved (n)". Comments are listed in text
  order; N / P walk them.
- **Checks as annotations**: open findings with a location are wavy-underlined in the text, coloured by severity
  (blocker red, check amber, tip grey); clicking opens the finding in Checks.
- **Versions**: history with author (student vs reviewer), "accepted a suggestion", approved tag, "Authorship confirmed
  by the student · date" per version, which application uses which version; inline diff in the manuscript (default
  previous → current, any pair; D toggles).
- **Rubric (V6 default)**: Quality — Answers the question, Specificity, Authenticity, Structure, Logic, University fit,
  Major fit, Future plan, Evidence, Clarity; Accuracy — Length limit, Names, No other university, Facts match profile and
  other essays. Each has a reviewer question ("Could this only have been written for this program?"). No total. V5 keys
  kept (GENERIC = specificity, VOICE = authenticity, MOTIVATION = university fit, PROGRAM_CONNECTION = major fit); new
  keys LOGIC, CLARITY. `extra_62_writing_v6.py` upgrades an untouched V5 default rubric in place (idempotent).
- **Speed**: Approve (A) / Request changes (R) open a small dialog (Ctrl+Enter confirms) and then the **next essay of
  the same queue view** opens (`GET /writing/essays/{id}/next?view=&pos=` — `pos` = the decided essay's former
  position). `]` next essay, `[` previous (remembered order), `?` shortcut sheet; shortcuts never fire in inputs or
  dialogs. Queue: view + order + current essay remembered per user in `localStorage` (`hg.writing.queue.<userId>`);
  "Open next essay" continues after the last essay opened; SLA column shows late/left and the escalation.
- **AI**: `writing.ai` is `null` unless `HG_AI_PROVIDER` is configured and implemented → nothing AI-related renders.
  If a provider is ever enabled, its findings carry `source: "AI_SUGGESTION"` and show an "AI suggestion" label;
  they stay advisory (no rewriting).

## Student (`apps/student-web/src/pages/EssayEditor.tsx`, `writing.css`, `lib/writing.ts`)
- Calm sheet with serif writing type; the question above (non-official prompts: "Check the exact wording in the
  university's application guide too."); comments in a margin in text order; each suggestion is decided one by one
  (**Accept** = applied as a new version authored by the student; **Keep mine**), allowed only while the essay is with
  the student; decided suggestions stay visible with their state until the next submission.
- Which version is approved and which application uses it (green line on top; "approved — used by your application"
  in history).
- **Submit** (tangerine, the only tangerine action) opens "Send to your reviewer" with the authorship statement
  checkbox "These are my own words and facts" (required in the web client).

## Server
- Models `app/models/v6_writing.py`: `EssaySuggestionDecision` (comment, ACCEPTED/REJECTED, by, at, note, version
  created) and `EssayAttestation` (essay, version, user, statement code `OWN_WORDS_AND_FACTS_V1` + English text, locale,
  SHA-256 of the exact text, time; unique per version). Migration `f6b7c8d9e0a1_v6_writing`.
- `POST /writing/essays/{id}/suggestions/{comment_id}/decision {decision: ACCEPT|REJECT, note?}` (student only; 409
  while in review/approved or when already decided; ACCEPT 409 if the quote changed; CHANGES_REQUESTED → STUDENT_REVISION).
  The legacy `/essays/{id}/comments/{cid}/resolve?apply_suggestion=` records the same decision and is now refused while
  the reviewer has the text.
- `POST /essays/{id}/status {status: SUBMITTED, attest: true, locale}` records the statement with the submitted version;
  `POST /writing/essays/{id}/attest {confirm: true}` for clients that submit without it (mobile today). Not yet
  *enforced* server-side, so older clients keep working; staff see "No authorship statement for this version".
- Comments now carry `suggestion_state`, `decided_at`, `decision_note`, `decision_version`, `resolved_at`; the writing
  block carries `attestations`, `used_by`, `ai`; rubric dimensions carry `group`; queue items carry `escalated`,
  `escalated_to`.
- **New automatic checks** (`writing_checks.py`):
  - `check_other_program` (kind PROGRAM, code OTHER_PROGRAM, "Check"): the text names another program of the target
    university (degree prefixes stripped, single-word and language-institute names ignored, silent when the target
    program is named in the same sentence). Not a gate blocker.
  - `check_cross_application` (kind CONSISTENCY, code CROSS_APP_CONFLICT, gate Profile consistency): conflicting facts
    between this essay and the same student's other essays — graduation year per school level, GPA (same scale), TOPIK,
    IELTS, age (±1 tolerated), home country; future goals are not claims. Visible to the student (their own essays).
- Tests: `server/tests/test_v6_writing.py` (12), vitest `apps/agency-web/src/lib/writing.test.ts`,
  `apps/student-web/src/lib/writing.test.ts`, Playwright `e2e/v6-writing.spec.ts`.

## Known limitations / requests
- Shared packages were not edited: the V6 fields and the two endpoints are typed/called from the apps' `lib/writing.ts`
  (`writingV6`). Request: move them into `@hangyul/types` / `@hangyul/api-client`; register `vi/writing.json` and
  `ne/writing.json` in `packages/i18n/src/resources.ts` (files exist; until then vi/ne fall back to English).
- Authorship statement is enforced by the web client only; enforce on the server once the mobile app sends it.
- The sticky rail offset assumes a two-line header; a very long university/program name wrapping to three lines makes
  the rail start slightly lower (no overlap).

## V9 (2026-10-14)

No new writing features were added in V9 (the V6 manuscript-first workspace already meets the brief). V9 verified, by test, the failure modes: an essay naming the wrong school blocks approval; cross-application consistency blocks approval until fixed or dismissed; the reviewer leaving moves open reviews to a named person (agency team deactivate); the writing queue counts equal list rows. The writing work queue (Needs first review · Student revised · Final review · Due soon · Overdue · Assigned to me · Team) is also a work-type chip of the agency's one ranked queue. The student-facing writing status strings are complete in the offered locales (`writing` namespace, 504 keys in the manifest). AI remains off (`HG_AI_PROVIDER` unset); AI may flag, never invent, and the human reviewer is authoritative.
