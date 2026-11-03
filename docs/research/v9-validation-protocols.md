# V9 validation protocols — real users, real language reviewers

> **Status: protocols only — NOT RUN.** No real student, parent, counselor, manager or admissions officer has used V9.
> Every V9 number in REPORT §63 is a scripted walkthrough, a measured load, an automated check or an AI review. Nothing
> here may be reported as "validated with users" until sessions have run and results are written to
> `docs/research/v9-results/<group>.md` with participant codes only. This is a launch-validation dependency (REPORT §64).

These protocols extend the V8 protocols `v8-student.md`, `v8-agency.md`, `v8-university.md` and `v8-parent.md` — also NOT RUN, superseded by this file and moved to `docs/research/archive/` in V26 (kept as the base). V9 adds the
tasks for what V9 changed: language routes, the money plan, the sponsor view, document privacy, the one work queue, the
seven-value waiting-on model, the team/weights page, the submissions queue, review-and-advance, bulk "select all matching",
rule impact preview, and the localised student journey.

## 0. Common rules

- **Recruit independent of Hangyul.** No staff, no relatives of staff, no one whose pay depends on Hangyul. Fixed incentive
  regardless of feedback. Pre-agreed stop rule: a participant can stop at any time.
- **Consent** in the participant's language (screen + voice recording, 12-month storage on Hangyul-owned storage, withdrawal).
- **Synthetic data only.** Test accounts with fictional people; nobody enters a real passport, bank certificate or grades.
- **Think-aloud, 45–60 min,** moderator does not help; after 90 s stuck the moderator gives a neutral prompt and the task is "success with help".
- **Measures per task:** success (complete / with help / fail), time, clicks, scrolls (screens), backtracks, dead ends, SEQ (1–7).
  SUS at the end. Critical-incident log: any moment the participant believes something false.
- **Analysis:** severity (0–4) × frequency; ≥ 3 fixed before the next round; changes logged in REPORT with the evidence.
- **Instrumentation:** the same measures V9 recorded by script (the `docs/qa/v9/measure/` directory this once pointed at no longer exists; the V9 numbers live in REPORT §63 and `docs/qa/v9/SCORECARD.md`) are taken from screen recordings so
  "before/after" can later be compared with real people. Where only V8 exists, V8 is the baseline.

## 1. Students — 5–8 participants (two rounds of 3–4)

**Recruitment criteria** (all must hold unless stated): aged 17–29; considering study in Korea within 18 months; **not** enrolled in Hangyul; ≥ 3 on a budget Android phone only; limited English (self-rated ≤ B1) for ≥ 4; **no TOPIK** for ≥ 4; ≥ 1 each from Nepal, Myanmar, Vietnam, Uzbekistan, Mongolia; ≥ 2 use the UI in a non-English language; ≥ 2 first-time (never used an agency), ≥ 2 have talked to an agency.

| # | Task | Success | What it proves |
|---|---|---|---|
| S1 | "You are from Nepal, finishing 12th grade, no TOPIK. Can you study in Korea? What would you do first?" (public quick check, phone) | Names the Korean-language route and says what it costs for the first year; does not conclude "I cannot go" | Language routes (§58 S1) |
| S2 | "Your parents will pay. How much must they have, to whom do they pay, and when?" | Names tuition payee and date, the money to *show* for the visa (amount, holding period, whose name) | Money plan (S2) |
| S3 | "Show your parents what they need to know, without showing them your messages." | Creates a sponsor link, chooses scopes, can say what the parent will *not* see; revokes it | Sponsor view (S3) |
| S4 | Upload a (fake) passport. "Who can see it? Can you stop your agency seeing it later?" | Correct answers from the "Who can see this" panel | Privacy (S4) |
| S5 | "Which programs can you apply to? Why is this one not available? What would unlock it?" | Reads the unlock line; never reads "needs your grades" as rejection | Discovery (S5, V8 rule) |
| S6 | "What do you need to do next for your visa, and where?" | Names the next document and the official place | Visa view (S6) |
| S7 | Phone, Burmese or Nepali UI: complete S1–S3 | No unexplained English noticed; count English fragments the participant points at | Localisation |
| S8 | "Your visa was refused after you paid tuition. What happens to your money?" | Finds the refund case, understands "your counselor confirms" and the own-account rule | Refund path (S8) |

Rounds: after round 1 fix severity ≥ 3; round 2 re-tests failed tasks. Target (not a pass bar): ≥ 80 % complete S1, S2, S6 unaided.

## 2. Parents / sponsors — 3–5 participants

Criteria: parent or relative who would pay for a student's study in Korea within 18 months; ≥ 1 aged 50–65; ≥ 2 low digital confidence (self-rated); ≥ 2 do **not** read English; interviewed in their own language by a native speaker with an interpreter present only if unavoidable.

Tasks: open a sponsor link on their own phone (no account) → "How much must you pay, to whom, by when?" → "What must you show the bank/embassy?" → "What can you *not* see here and does that worry you?" → "Would you trust this with your money? What would make you trust it more?" Measures: comprehension of each money line (payee/timing/refund), trust (1–7 + reason), misreadings of "Estimate / Sample / Official".

## 3. Agency counselors — 5

Criteria: currently carry ≥ 30 active students; ≥ 2 work in Vietnamese, ≥ 1 each Nepali, Uzbek, Burmese or Mongolian if available; currently use Excel/Sheets + KakaoTalk/WhatsApp/Zalo; ≥ 2 do essay or document review; none is a Hangyul partner employee.

Setup: a seeded environment with 200 students for the counselor (`server/scripts/v9_scale_seed.py` pattern). Tasks (60 min): C1 "It is 9 AM: who needs you first, and why? List your top 10." · C2 review 10 documents (decide verify / correct, send correction in the student's language from a template) · C3 review 3 essays (comment, request change/approve, next) · C4 reply to a student and link the thread to an application · C5 find the university request and answer it · C6 find the visa blocker · C7 handle a guided submission (record evidence) · C8 record a meeting with a decision and a follow-up. Measures: time to top urgent case, per-document decision time, per-essay decision time, number of tools opened outside Hangyul (the key V9 metric), "what would you still keep in Excel?" (free text, coded).

## 4. Agency managers — 3

Criteria: manage ≥ 3 counselors; keep a master Excel/Sheet today. Tasks (30 min): M1 within 60 s: oldest blocked case, overloaded counselor, SLA breach, deadline risk, slowest stage, unassigned paid case. · M2 change a load weight and see who becomes overloaded. · M3 a counselor leaves: reassign their work. · M4 "which process step creates the most rework?" (process quality). Measures: time per question, correctness against the known seeded answers, "could you retire the master Excel?" (yes/no + reason).

## 5. University admissions staff — 5

Criteria: Korean university international admissions office; ≥ 2 review ≥ 300 international applications per cycle; use email + Excel + UWAY/Jinhak admin today; ≥ 1 handles agency relationships. Setup: 1,000-applicant environment (Pusan scale seed). Tasks: U1 find what needs a decision · U2 decide on an applicant (time to first decision; did they find the requirement ↔ evidence table without scrolling at 1024 px) · U3 request a missing document · U4 advance to the next applicant · U5 receive the returned document and decide · U6 assign 40 applicants to a reviewer with "select all matching" and read the preview · U7 explain which partner agency sends complete applications. Measures: time per applicant, "did you ever want to open a profile?" count, errors in bulk preview reading.

## 6. University managers — 3

Criteria: director/deputy of an international office. Tasks: current intake funnel · market mix · program demand · agency quality incl. visa outcomes (with denominators) · "what happens if we raise TOPIK 3 → 4?" (impact preview, including the "not enough data" case) · "which numbers would you refuse to show your president, and why?" Measures: correct reading of denominators/cohorts (quiz), trust (1–7), missing questions.

## 7. Human translation review (separate from usability)

For each offered student locale (`_student_status.json`): two native reviewers (one aged 18–29, one parent-age 40+) read the core journey screens, score comprehension/naturalness/trust/action clarity/tone 1–5, mark every wrong or odd string, and sign the record `docs/qa/v9/l10n/<loc>-human.md` with name, date and method. Only then may `status` become `HUMAN_REVIEWED` for that locale. **Priority order:** vi, ne, my, uz, mn, zh-Hans, ja, th, id, hi, bn, ur, ar, ru, zh-Hant, kk, ky, tr, ko. The residual-risk lists in each `docs/qa/v9/l10n/<loc>.md` are the reviewers' starting points (certification tier names, Korean administrative terms, parent-facing money sentences).

## 8. Blind visual test (replaces the inconclusive V8 synthetic round)

17 V8 → V9 pairs (`docs/qa/v9/comparisons/`), side positions randomised per viewer, 20 designers/PMs not involved in the project, forced choice + reason. Report the preference with a confidence interval; "no clear winner" is a valid result.

## 9. What this study does not do

It does not measure admission success (Hangyul has none to measure), conversion, retention or revenue, and it does not replace legal review, provider contracts or the MOE standard agreement.
