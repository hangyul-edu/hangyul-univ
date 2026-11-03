# V9 reliability + scale workstream log (2026-10-10)

Scope: an adversarial recovery suite (what happens when things go wrong) and a scale check of the agency and university
consoles. Rules applied: WORKSTREAM_RULES 2–4, 6, 9, 11–12. Bugs found by a scenario were fixed minimally in place
(no redesign); each fix is listed below with the scenario that exposed it.

## Part A — adversarial recovery suite

File: `server/tests/test_v9_adversarial.py` (18 tests, one per scenario). Isolation: fresh `e2e-adv-…@example.com`
students and a throwaway program at Chung-Ang University ("Adversarial Reliability Program (V9 test)", five intakes with
unique year/term/round, one WINTER `DIRECT_API` connector row) that no other test uses. The module teardown deactivates
the program/intakes and purges the e2e accounts with `scripts/purge_e2e.py`; seeded rows a scenario touches (Pusan
applicants' reviewer, the program rule) are restored in `finally`.

| # | Scenario | Asserted recovery | Result |
|---|---|---|---|
| 1 | Wrong document | WRONG_TYPE finding → counselor NEEDS_CORRECTION (student notified, FIX task owned by student) → new version of the same document → finding auto-resolves, FIX task closes, review task to the agency → VERIFIED closes it | pass |
| 2 | Interrupted / corrupt upload | cut-off PDF as new version → 422 "upload may have been interrupted", version stays 1, no file stored; cut PNG 422, empty 400, renamed .exe 415; retry with the full file → v2 | pass after fix F2 |
| 3 | Duplicate application (same program + intake) | 409 "You already started an application for this intake."; one application, essays/tasks not doubled | pass (no change needed) |
| 4 | Deadline passes before submission | DEADLINE_PASSED blocker owned by counselor; hand-off/authorise refused (409 `DEADLINE_PASSED`); no submit CTA on home/improve; student's submit/upload/essay tasks closed; counselor task `deadline-passed:{app}`; status stays READY, `submitted_at` null | pass after fix F1 |
| 5 | Passport expires mid-journey | dossier PASSPORT: READY → NEAR_EXPIRY (NEAR_EXPIRY_DATE) → EXPIRED (row "todo"); RENEW task for the student; checklist RENEW; visa applicability hook EXPIRED; visa pack not ready | pass |
| 6 | Financial certificate stale before the visa | bank certificate fine today, too old on the appointment day → GET_LATER with the date (appointment − validity) and timing; at that date → NEW_FOR_VISA; pack never "all ready" | pass |
| 7 | University changes a requirement after students applied | statuses unchanged (DRAFT / SUBMITTED); new strategy item REQUIREMENT_CHANGED (owner counselor, fields + date) for student and agency; submitted application not re-judged; a later applicant sees only the current rule | pass after fix F3 |
| 8 | Intake closes | new applicant 409 "not accepting applications"; program page no longer offers it; existing applicant unchanged (no DEADLINE_PASSED/NO_OPEN_INTAKE, deadline task kept) | pass (no change needed) |
| 9 | Essay names the wrong school | OTHER_UNIVERSITY BLOCKER finding; approval 409 QUALITY_GATE, status stays AGENCY_REVIEW; changes requested → fixed text → finding cleared | pass (no change needed) |
| 10 | Student changes nationality | visa route VN → NP (Kathmandu), stale Hanoi post/answer dropped, no "choose post" step, legalization CONSULAR for the new route; VN-only FAMILY_RELATION task closed immediately | pass after fixes F4, F5 |
| 11 | Student changes target intake | new application for the fall intake, old one withdrawn → written essays move to the live application (both orders), only empty workspaces stay behind; no open student/staff task for the withdrawn application | pass after fixes F6, F7 |
| 12 | Agency member leaves | open items (student, document review, essay review, task, service case) all moved by `deactivate`; after the task/concierge engines re-run nothing open is owned by the leaver; student has an active counselor | pass (no change needed) |
| 13 | University reviewer removed (U8) | deactivate refused while applicants would be orphaned (422 with count); with `reassign_to` all moved + audited; none in orphaned-assignments | pass (no change needed) |
| 14 | External connector unavailable | DIRECT_API: AWAITING_PROVIDER, 409 on api-submit (audited), record stays empty, status READY, no student submit CTA, student can't record; SUBMITTED only after the counselor records the real portal reference | pass (no change needed) |
| 15 | Payment callback delayed | order PENDING, no assignment until the provider confirms; forged/misrouted callback 404; late PAID callback activates once; retries are no-ops (1 assignment, 1 notification, 1 welcome message) | pass after fix F8 |
| 16 | Message provider fails | WhatsApp with credentials but no agreement → 409 "Nothing was sent", nothing stored; in-app message is SENT (not "delivered") until the student opens it → READ | pass (no change needed) |
| 17 | Housing provider cancels | HOUSING_SEARCH CONFIRMED → INTERESTED: team task to the agency, student DEPOSIT task closed, student sees the status + note, notified, housing no longer "confirmed"; dormitory CONFIRMED → NOT_ASSIGNED likewise | pass after fix F9 |
| 18 | Airport pickup, flight delayed | student's flight change moves the pickup (`due_at`) and opens a re-confirm task for the team; recording the new arrival closes it; a later 90-minute delay → FLIGHT_DELAYED, never "live" | pass after fix F10 |

xfail: none.

## Bugs fixed (each found by the scenario above)

| Fix | Problem (before) | Change | Files |
|---|---|---|---|
| F1 | A READY application whose deadline had passed still showed "Submit on the portal" (hand-off allowed, home CTA, `SUBMISSION_HANDOFF` improve item) and the strategy only raised DEADLINE_PASSED for non-READY applications; the student kept "Submit …"/upload/essay tasks for it and nobody else owned the next step. | `strategy.deadline_passed()` / `submitted_before_deadline()` (a hand-off on or before the deadline still counts). DEADLINE_PASSED raised for READY too. Submission view: `can_handoff`/`can_authorize`/consent preview off, new additive field `deadline_passed`; `handoff()`/`authorize()` → 409 `DEADLINE_PASSED: …`; `next_step()` returns nothing. Tasks engine: no student tasks for such an application; counselor task `deadline-passed:{app}` (`task.deadlinePassed`, en+ko). | `services/strategy.py`, `services/submission.py`, `services/tasks_engine.py`, `locales/{en,ko}/common.json` |
| F2 | An interrupted upload (cut-off PDF/PNG) was accepted as a new version, replacing a good file with a broken one. | `validate_upload` → `looks_truncated()`: PDF needs `%%EOF` in its last 2 KB, PNG its `IEND` chunk; 422 before anything is stored. JPEG/WEBP not checked (no reliable end marker). | `core/storage.py` |
| F3 | A published rule change (proposal or direct edit) silently re-judged applications in preparation (a new ELIG_* blocker appeared with no explanation) and said nothing to applicants already in review. | Strategy item `REQUIREMENT_CHANGED` (improve, owner counselor, params `university`, `fields`, `changed_on`) for applications started before the change, from published `RequirementChange` rows and `requirements.update` audit rows. Statuses are never changed. en+ko `success:item.REQUIREMENT_CHANGED` + `agencyItem`. | `services/strategy.py`, `locales/{en,ko}/success.json` |
| F4 | Visa route: after a nationality change the old country's post answer (e.g. Hanoi) stayed in `answer`, produced a done "choose post" step, and `VisaCaseTrack.post_key`/`route_id` kept the old route when the new one had none. | `resolve()` ignores a stored post answer that is not a post of the current route (kept on record); `build_plan()` sets `route_id`/`post_key` from the current resolution only. | `services/visa_routes.py` |
| F5 | Nationality-dependent tasks (e.g. VN/CN-only family-relation certificate) stayed open until some later event. | `PATCH /me/profile` regenerates tasks when nationality, residence, passport expiry or in-Korea fields change. | `api/v1/student.py` |
| F6 | Changing intake = new application + withdraw old: the written essays stayed on the withdrawn application (the new one got empty workspaces). | `applications.move_essays()`: on WITHDRAWN, written essays move to the student's live application for the same program (an empty workspace swaps back); on create, essays from a withdrawn application to the same program are carried over. Nothing is deleted. | `api/v1/applications.py` |
| F7 | Essays of withdrawn/rejected applications kept producing "Write/Revise" student tasks and "Review essay" staff tasks, and stayed in the writing queue / SLA sweep. | Tasks engine skips essays of inactive applications; writing queue/today/SLA sweep exclude essays of WITHDRAWN/REJECTED applications. | `services/tasks_engine.py`, `services/writing.py` |
| F8 | No way to receive a late provider confirmation: a PENDING order could never be activated. | `activate_paid_order()` (the checkout's activation, extracted unchanged, idempotent) + `POST /api/v1/payments/callback/{provider}`: re-verifies with the configured provider (body never trusted), activates once, duplicates are no-ops, unknown ref/provider 404, unconfigured provider 503, FAILED/CANCELLED marks a pending order. | `api/v1/student.py`, `main.py` |
| F9 | A housing provider cancelling after the deposit/confirmation could only be recorded as CANCELLED, which closed the student's housing case. | State tables: HOUSING_SEARCH DEPOSIT/CONFIRMED → INTERESTED; DORMITORY ASSIGNED/CONFIRMED → NOT_ASSIGNED; TEMPORARY_HOUSING BOOKED → PLANNING (all back to the team). | `services/concierge.py` |
| F10 | After a student's flight change on a confirmed pickup, the "Flight changed — re-confirm pickup" task could never be closed (recording the flight didn't clear `reconfirm`, and only a status change did). | `record_flight_change()` (the staff "Record flight" action) clears `reconfirm`. | `services/concierge.py` |

API changes (all additive): `POST /api/v1/payments/callback/{provider}`; submission view field `deadline_passed`;
strategy item code `REQUIREMENT_CHANGED`; task key `deadline-passed:{app}` / `task.deadlinePassed`; 409 detail prefix
`DEADLINE_PASSED:` on hand-off/authorise after the deadline; 422 on truncated uploads.

Not done / notes:
- Localization: only en + ko keys were added (`success:item.REQUIREMENT_CHANGED`, `success:agencyItem.REQUIREMENT_CHANGED`,
  `common:task.deadlinePassed`); the student key manifest (`_student_manifest.json`, `scripts/i18n/v9-manifest.mjs`)
  should be regenerated by the localization workstream.
- The payment callback verifies with the provider adapter; Stripe/Toss adapters still raise NotConfigured (503) — signature
  verification will come with a real merchant agreement.
- A provider-cancelled case is not yet listed as an "issue" on the agency Providers page (ISSUE_STATUSES are
  NO_SHOW/CANCELLED/NOT_ASSIGNED; INTERESTED after CONFIRMED is not detected).
- The university list's eligibility summary still judges submitted applicants against the current published minimum.

## Part B — scale validation (2026-10-10)

Separate DB `hangyul_univ_scale`; `server/scripts/v9_scale_seed.py` (refuses any DB whose name lacks "scale"; idempotent) adds 200 students
to the Lotus counselor and 1,011 submitted Pusan National University applicants. Second API on :8091 (no --reload), stopped by PID afterwards.
Results: `docs/qa/v9/scale/results.md` + `results.json` (+ `results-before.json`). All 13 measured endpoints p95 < 1 s after two query-shape
fixes: agency queue N+1 in `services/submission.py` (p95 1130 -> 408 ms) and HQ overview per-row student lookups in `api/v1/hq_ops.py`
(p95 2063 -> 725 ms). No index/migration needed. Scale DB dropped after results were recorded.
