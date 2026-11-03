# Application state map (V4)

One application has **one meaning** in every product. The wording differs by audience; the meaning, the responsible party and the next state do not. Backend enum names (`ApplicationStatus` in `server/app/models/enums.py`, transitions in `server/app/services/state_machine.py`) never appear in the UI.

- **Waiting on** (V9, REPORT §59 A1) is the operational answer to "why isn't this moving, and who has to act?". One model for every product: `server/app/services/waiting.py`. Seven values, each with one reason code:
  `counselor` (a named agency person owns the next action: first contact, a reply owed, their review, their task, a final check / submission, their service case) · `agency` (the agency team owns it but nobody is assigned: unassigned case, review, essay, task or service case) · `hangyul` (Hangyul operations owns it: paid with no agency, payment issue, staff work on a student with no agency) · `student` · `university` · `external` (embassy decision, official-rail confirmation, a service provider) · `none`.
  The party is the FIRST matching rule in a fixed order (Hangyul money/assignment problems → work the agency owes, named before unassigned → the student → the university → outside parties); the caseload row and the list filter use the same SQL rules, so a view's count equals its rows. The legacy value `us` (V4–V8) stays accepted in filters and saved views and means `counselor` OR `agency`; rows also carry `waiting_on_legacy` for old clients.
  Every row also carries `waiting_owner` (the named person / team / outside party) and `next_action` — the action **of the party it waits on**: staff voice for staff parties ("Reply to the student", "Final check and hand-off"), "Student: <their task>" for the student, "Embassy: visa decision" for outside parties. A student to-do is never shown as the next action of a row that waits on the team.
  Per application: `applicationWaitingOn(status, ctx?)` in `packages/utils/src/index.ts` (status-only call keeps the V4 answers; with `ctx` it names counselor / agency / hangyul and follows the submission record: handed off → `student`, reported submitted without evidence → `external`). The server equivalent is `waiting.application_waiting()`.
- **Tone** for agency/university: student 15–16 px warm sentences; agency short operational phrases; university formal and precise. **Student-facing copy never names a counselor or agency person** (V22 team identity): wherever this table once said "your counselor" / "your agency team", the student sees *the Hangyul Univ team* (한귤 유니브 상담팀). `counselor` / `agency` remain internal waiting-on parties for staff views.
- **Notification** column: who receives an in-app notification (and push when enabled) when the application *enters* the state.

| Status (enum) | Student sees | Agency sees | University sees | Primary action (who) | Secondary action | Waiting on | Expected next | Notification on entry |
|---|---|---|---|---|---|---|---|---|
| DRAFT | Getting started | Draft | — (not visible) | Student adds documents / counselor starts profile check | Withdraw | student | PROFILE_REVIEW or DOCUMENT_PREPARATION | — |
| PROFILE_REVIEW | Hangyul is checking your profile for this program | Profile check | — | Counselor confirms profile fits the program | Return to draft | agency | DOCUMENT_PREPARATION | Student ("The Hangyul Univ team is checking…") |
| DOCUMENT_PREPARATION | Preparing documents — *N* items left | Preparing documents · *N* missing | — | Student uploads / fixes; agency reviews | — | student (or agency when items await review) | READY | Student (checklist created) |
| READY | Ready to submit — the Hangyul Univ team is doing a final check | Ready to submit | — | Agency submits (or student, where allowed) | Back to preparation | agency | SUBMITTED | Student, counselor |
| SUBMITTED | Sent to {university} — they usually reply within a few weeks | Submitted — awaiting university | New application | University opens review | — | university | UNIVERSITY_REVIEW | University team, student |
| UNIVERSITY_REVIEW | {University} is reviewing your application | Under university review | In review | University decides / requests / interviews | Assign reviewer, flag | university | OFFERED · INTERVIEW · ADDITIONAL_DOCUMENTS · WAITLISTED · REJECTED | Student (quiet), counselor |
| ADDITIONAL_DOCUMENTS | {University} asked for one more document: {label} | University requested a document — waiting on student | Waiting for requested documents | Student uploads the exact item; agency verifies | Cancel request (university) | student | UNIVERSITY_REVIEW (item returned) | Student + counselor + Hangyul ops, with the university's exact note |
| INTERVIEW | Interview with {university} | Interview stage | Interview — outcome pending | University records the outcome | — | university (student if a slot must be booked) | OFFERED · WAITLISTED · REJECTED | Student, counselor |
| WAITLISTED | You're on the waiting list — nothing to do now | Waitlisted | Waitlisted | University decides when seats open | — | university | OFFERED · REJECTED | Student, counselor |
| REJECTED | {University} did not offer you a place this time | Not admitted | Not admitted | Counselor discusses alternatives | — | none | — (final) | Student, counselor |
| OFFERED | You've received an offer from {university} | Offer received — waiting on student | Offer made — awaiting reply | Student accepts or declines (compare if ≥2 offers) | — | student | OFFER_ACCEPTED | Student (prominent), counselor |
| OFFER_ACCEPTED | You accepted — pay tuition by {date} | Offer accepted — tuition next | Offer accepted | University issues tuition invoice | — | university | TUITION_PENDING | University, counselor |
| TUITION_PENDING | Pay ₩{amount} to {university} by {date} | Tuition due {date} | Tuition pending | Student pays the university directly | — | student | TUITION_PAID | Student (reminders), counselor |
| TUITION_PAID | Tuition received — your admission letter comes next | Tuition paid | Tuition received | University issues admission letter | — | university | ADMISSION_CERTIFICATE_* | Student |
| ADMISSION_CERTIFICATE_PENDING | {University} is preparing your admission letter | Admission letter pending | Issue admission letter | University issues | — | university | ADMISSION_CERTIFICATE_ISSUED | — |
| ADMISSION_CERTIFICATE_ISSUED | Your admission letter is ready — start your visa | Admission letter issued | Admission letter issued | Student/agency start visa | — | student | VISA_PREPARATION | Student (prominent) |
| VISA_PREPARATION | Preparing your visa documents | Visa documents | Visa in preparation | Student gathers visa documents | — | student | VISA_SUBMITTED | Student |
| VISA_SUBMITTED | Visa applied — waiting for the embassy | Visa submitted | Visa applied | Embassy decides | — | external | VISA_ISSUED | Student, counselor |
| VISA_ISSUED | Visa issued — plan your arrival | Visa issued — arrival next | Visa issued | Student books flight; housing | — | student | ENROLLED | Student, university |
| ENROLLED | Enrolled at {university} | Enrolled | Enrolled | — | — | none | — (final) | Student, counselor |
| WITHDRAWN | You withdrew this application | Withdrawn | Withdrawn by applicant | — | — | none | — (final) | Counselor, university (if submitted) |

## Document states (requirement-centric)

| Document state | Student | Agency | University |
|---|---|---|---|
| Not uploaded | Upload your {requirement} — needed for {university} | Missing | (not shown until submission) |
| UPLOADED / NEEDS_REVIEW, within target | Being checked — usually within 2 working days | Awaiting review · age | — |
| UPLOADED / NEEDS_REVIEW, past target (48 h) | Taking longer than usual — it's flagged as late for your counselor. You don't need to upload it again. | Overdue review · age in red | — |
| NEEDS_CORRECTION | This document needs one change: {reason} | Correction requested | — |
| VERIFIED | Ready — reused for every application that needs it | Verified | Verified (shared) |
| Legalization pending | Needs apostille (or consular confirmation) — see the steps for {country} | Legalization pending | — |

## Eligibility vocabulary (V8)

One program/student pair has one eligibility meaning. **Missing information is never shown as ineligibility.** V8 implements it with one shared rule, `eligibilityGroup` in `@hangyul/utils`. Student Discovery uses it (unit-tested). So does the agency program catalogue: the fit column, the program drawer and the "meets requirements" filter show "Needs grades to check" instead of an engine tier.

| Engine result (`matching.py`) | Student sees (group) | Agency sees | Meaning |
|---|---|---|---|
| STRONG, nothing unknown | Strong match | Strong match | Meets every published requirement and fits the student's preferences |
| COMPETITIVE, nothing unknown | Possible match | Possible match | Meets the requirements; something needs attention (budget, close deadline) |
| any tier with `GPA_UNKNOWN` / `EDUCATION_UNKNOWN` and no `missing` reason | **Needs your grades** — "we need your grades to check" | Needs grades to check | We cannot check the academic minimum yet. This is not a verdict |
| REACH with a `missing` reason (e.g. `LANGUAGE_GAP_SMALL`, `GPA_SLIGHTLY_BELOW`) | Not eligible yet — one step away (listed first) | Not eligible yet (one step away) | A published requirement is short by a closable gap |
| NOT_ELIGIBLE | Not eligible yet | Not eligible | A published requirement is not met, or no intake is open |
| `DEGREE_MISMATCH` | not listed under "For you"; counted as "N programs at other degree levels" | Other degree level | Not the degree the student is looking for. This is a preference, not a verdict |

## "Waiting" vocabulary across products (V9)

| Waiting on | Reason codes (server `waiting.REASONS`) | Student | Agency (Today / Students / workspace header) | University | Hangyul operations |
|---|---|---|---|---|---|
| counselor | first_contact · reply_owed · review · essay_review · task · submit · profile_check · final_check · service | "The Hangyul Univ team is on it" (+ late flag after the review target) | Counselor · <reason>; next action in staff voice; owner = the named person; view `waiting_counselor` | — | SLA breach when past target |
| agency | unassigned_case · review_unassigned · essay_unassigned · task_unassigned · service_unassigned | "The Hangyul Univ team is on it" | Agency team · <reason> · "no reviewer / no owner"; view `waiting_agency` | — | counted in the agency's backlog |
| hangyul | paid_no_agency · payment_issue · (staff reasons for a student with no agency) | "Hangyul is on it" | Hangyul · <reason>; view `waiting_hangyul` | — | Unassigned paid cases; payment failures |
| student | university_request · fix · submit_on_portal · app (status) · student_task | "Your turn: {item}" | Student: <their task>; views `waiting_student`, `student_silent` | Waiting for applicant | counted in the agency's backlog |
| university | app_university (status) | "{University} is reviewing" | University: <status>; view `university` | Needs a decision | "University requests waiting" |
| external | rail_confirmation · visa_decision · provider | "Waiting for the embassy" / "confirmation number not recorded yet" | Official portal / Embassy / Provider; view `waiting_external` | — | "Confirmation missing", "Visa blockers" |
| none | — | nothing to do | — | — | — |

Legacy filter value `us` = counselor + agency (view `waiting_us`). Today's "Waiting on" card lists the six non-empty parties, each opening its view.

## Eligibility vocabulary — V9 addendum

- **Student tier labels are one set everywhere** (web, native, `common:tier`, quick check): *Strong match* · *Possible match* · *Not eligible yet* (incl. the quick check's "One step away") · *Needs your grades*. Legacy English "Competitive match" and "Reach" are retired from `common:tier`.
- **Language routes** are not a verdict: a student whose chosen degree is blocked by language sees routes (language program first / English-taught / smallest test step), each "not an offer".
- **Korean wording** must not read as odds: "Possible match" = 요건 충족·확인 필요 (meets the requirements · needs a check), not "가능성 있음".
- **Match tier terms across 20 offered locales** were checked against this table (docs/qa/v9/l10n/<loc>.md).


## V25 — the student's application lanes (REPORT §313 S4)

The student application page groups every requirement by who acts, and since V25 names the work, not only the party:
**내가 할 일 / What I do** (waiting-on = student) · **한귤이 하는 일 / What Hangyul does** (counselor, agency, hangyul) ·
**대학이 확인하는 일 / What the university checks** (university). Same waiting-on model (`services/waiting.py`); no staff name is shown
in a student-facing lane (team identity, V22).

Agency **TODAY** (V25) reads the same server views as the caseload filter: `urgent`, `deadline7`, `waiting_counselor`,
`student_silent`, `university` — a TODAY count is always the number of rows it opens. University headline figures (V25) are the
totals of `GET /applications` with `status ∈ {SUBMITTED, UNIVERSITY_REVIEW, ADDITIONAL_DOCUMENTS, INTERVIEW, WAITLISTED}`,
`requests=open`, `submitted_within_days=7`, `updated_within_days=7`.

## Admission-guide state (V27, REPORT §357)

Not an application status — a property of the application's university × level, computed by `services/guides.state_for`.

| State | Student sees | Agency sees | Hangyul HQ | Effect |
|---|---|---|---|---|
| CURRENT | the checklist, from the official guide of this intake | checklist with 근거 보기 (guide quote, page, verified date) | — | normal |
| PREVIOUS_ROUND | the checklist + "지난 모집 회차의 공식 요강 기준… 새 요강이 나오면 다시 확인해요" | "이전 모집 회차 요강 기준. 새 요강 확인 중" | — | checklist usable; guide re-check due |
| ADMISSION_GUIDE_REVIEW_REQUIRED | "대학 모집요강을 확인하고 있어요" — no checklist | "모집요강 확인 필요" instead of an item count | queue item (by students waiting) | no checklist; readiness never complete; READY refused (409) |

Quick-fit groups (public, no account): 확인된 기본 조건 충족 (MEETS) · 도전해 볼 만한 (CHALLENGE) · 한 가지만 보완 (ONE_STEP) ·
지금 성적으로는 거리가 먼 (UNCLEAR). Never a probability, never "합격 가능".
