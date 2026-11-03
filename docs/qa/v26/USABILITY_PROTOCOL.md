# V26 — Human usability protocol (prepared, **not run**)

No usability session with real people has taken place in any pass, V1–V26. This document is the protocol for the first
one. It is written so that a facilitator can run it without the engineering team present. Nothing in REPORT.md claims
it happened; the first session's results go into a new section when it has.

## Participants

| Group | Count | Who | Recruited how |
|---|---|---|---|
| Students | 5 | 18–30, intending to study in Korea within 18 months; at least 2 who have never applied anywhere abroad; locales: 2 Vietnamese, 1 Nepali/Burmese, 1 Uzbek/Russian, 1 Chinese/Japanese | partner agencies' enquiry lists (consent form in their language) |
| Agency staff | 3 | counsellors who manage ≥ 30 active students today, using another tool or spreadsheets | the two partner agencies |
| University staff | 3 | international-admissions officers who review applicant files | PNU / SKKU / one 전문대학 contact |

Each session: 45 minutes, remote (screen share) or in person, in the participant's language with an interpreter where
needed. Participants are paid. They use the **demo environment with demo data**, signed in with a persona matching their
role; no real personal data is shown or entered.

## Setup (facilitator)

1. `npm run dev` on the demo machine; sign the persona in before the session (student: `student@demo`, agency:
   `counselor@lotus`, university: `admin@pusan`).
2. Open the session recorder (screen + audio). Start the clock at the first task sentence.
3. Do not explain the product. Read each task sentence once; answer only "what would you do?" to questions.

## Tasks

**Students** (think-aloud; language set to the participant's)
1. "You've just logged in. What is the one thing you should do today?" — success: names the next action within 10 s.
2. "Find a bachelor's programme taught in English that you could apply to, and say what it costs for the first year."
3. "The university returned your transcript. Fix it." — success: reaches the transcript row/drawer from home in ≤ 2 clicks.
4. "Which of your applications use your plan's allowance, and what is the team doing for you right now?"
5. "Yonsei asked for a bank certificate. Send it without uploading a new file if you can."
6. (phone, 390 px) "Repeat task 1 on your phone."

**Agency staff**
1. "It is 9 a.m. Who needs you first, and why?" — success: uses TODAY; names the reason without opening a row.
2. "A university asked one of your students for a document. Open that request."
3. "Answer the student who has been waiting longest for a reply." — success: reaches the composer in ≤ 2 clicks.
4. "Find all Vietnamese students in document preparation and export them."
5. "Review the oldest document in the queue and send it back with a reason."

**University staff**
1. "How many applicants need a decision today? Open them."
2. "Decide on the first applicant and move to the next one without going back to the list."
3. "What changed this week?"
4. "How many offers became enrolments this term, and which agency sends you the most applicants? Show me the records."

## What is recorded, per task

| Measure | How |
|---|---|
| Completion | done / done with help / not done |
| Time | first task word → participant says "done" |
| Misclicks | clicks on anything that was not on the success path |
| Questions asked | count + verbatim |
| Confusion | moments the participant pauses > 5 s or says "hmm / where …" (timestamps) |
| Feedback | verbatim at the end: "what felt unclear, what felt unnecessary, what would you want" |
| SUS | the 10-item System Usability Scale, in the participant's language |

## Analysis

- Per task: median time, completion rate, misclick count, the two most common confusions.
- Any task with completion < 4/5 (students) or < 2/3 (staff) is a V27 defect, with the recording timestamp as evidence.
- Translation problems noted by participants are logged per locale and string key.
- Results are written to `docs/qa/v27/USABILITY_RESULTS.md` and summarised in REPORT.md; the locale status of any
  locale a native speaker reviewed in the session may move from `SYNTHETIC_NATIVE_REVIEWED` to `HUMAN_REVIEWED` **only
  for the strings they actually read**, recorded by key.

## Blockers

Participants, an interpreter and a facilitator are external to this repository. Until they exist, every usability
statement in the reports is an engineer's walkthrough and says so.
