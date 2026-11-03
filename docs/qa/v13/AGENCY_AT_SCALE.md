# V13 — agency at scale

*Brief Part 18. Measured against an isolated scale database: **200 active students for one Lotus Bridge
counsellor**, 1,011 submitted applications, seeded by `server/scripts/v9_scale_seed.py`.*

## How this was measured, and what is synthetic about it

The caseload is real data in a real database being rendered by the real console. What is synthetic is the
*shape* of that caseload: the seed draws stages, deadlines and silences from distributions an author chose,
not from a working agency. So the **mechanics** below (counts agreeing with rows, a filter row staying one
line, a label contradicting a heading) are findings; the **mix** is not evidence about any real agency.

QA-only by construction: the seed script refuses any database whose name does not contain `scale`, the API
runs on :8091 and the consoles on :4702/:4703. None of it touches the development stack and none of it
appears in a development screenshot.

    HG_DATABASE_URL=…/hangyul_univ_scale server/.venv/bin/python scripts/v9_scale_seed.py
    node scripts/qa/v13-scale-qa.mjs

## The V12 prediction, tested

V12's own hostile review (§94.3) kept Today's eight work-type chips and recorded a doubt: *"a counsellor with
200 students will have eight chips whose counts are all double digits, and at that point they stop being a
filter and become a second KPI row by another name. Worth re-measuring at scale rather than at seed size."*

Measured at exactly that caseload:

| Work type | Count |
|---|---|
| documents | **165** |
| messages | **94** |
| tasks | **88** |
| applications | **54** |
| deadlines | **18** |
| writing | 1 |
| university requests | 1 |
| visa | 0 |
| services | 0 |

**Seven chips would render and five of them are double digits or more.** The doubt was correct. A row of
165 / 94 / 88 / 54 / 18 above a list is a dashboard, and none of those numbers tells a counsellor what to do
first — the one with 165 is simply the kind of work there is most of, which is true every single morning.

## What V13 changed

The default row is now four **operational states** — properties of a case rather than kinds of work, so they
do not multiply with caseload size:

| Chip | Count at 200 students | What it answers |
|---|---|---|
| All | 220 | — |
| Urgent | 20 | drop what you are doing |
| Our work | 198 | mine to do |
| Waiting on student | 22 | chase, do not work |
| Waiting on university | 0 | hidden; a chip with nothing in it is not a filter |

The nine work types are unchanged, filter the same list by the same rule, and moved into one `Filter` control
beside the chips. `urgent` deliberately overlaps the party states — it is a severity cut across them, not a
fifth bucket — so the counts do not sum to 220 and the UI never implies they do.

**Measured at 1440px: four chips, one line, a 47px filter block, and the page is 1.1 screens.** At 390px the
block is 121px because the chips wrap and the select goes full width, which is correct for a phone.

Every state chip's count equals the rows it shows, verified through the API rather than asserted:

    state=urgent             → total 20   (by_state.urgent 20)
    state=our_work           → total 198  (by_state.our_work 198)
    state=waiting_student    → total 22   (by_state.waiting_student 22)
    state=waiting_university → total 0    (by_state.waiting_university 0)

## Defects this found that seed size could not

**1. The queue heading and its own button disagreed.** The heading read **220**; the button read **"Show all
100"**, because the queue is fetched with a limit of 100. Two numbers for the same list and one of them
untrue — invisible at seed size, where there were never more than 16 items and the limit never bound. It now
reads **"Show 100 of 220"**, and says "Show all N" only when the limit is genuinely not binding.

**2. One reason type can monopolise the ranking.** All ten top rows read *"First reply is N days late"* with
the same *Reply* action. The ranking rule is working exactly as published — tier 1, then reason count, then
clock — and the result is a block of ten identical-looking rows that a counsellor cannot triage *within*.

This one is reported with its caveat attached: the seed creates an unusually uniform population of
never-contacted students, so the monotony is probably an artefact of the fixture rather than of a real
caseload. **It is not fixed in V13**, because the honest fix depends on knowing whether the distribution is
real, and the two obvious fixes are both worse than the problem — capping consecutive same-reason rows makes
the order stop meaning what the "How is this ordered?" popover says it means, and a bulk-reply affordance is
new product in a pass whose first instruction is not to add any.

## The four daily questions, at 200 students

| Question | Answer at scale |
|---|---|
| 누가 지금 내 도움이 필요한가? | Top of a ranked list; *Urgent 20* is one click. |
| 왜 이 학생이 멈춰 있는가? | The reason is on the row, with the wait in days. |
| 이 지원서를 제출해도 되는가? | Still the application's own quality check — now including the essay gates (§97). |
| 다음으로 무엇을 해야 하는가? | One action per row, no navigation. |

## What still forces a tool switch

Unchanged by V13 and recorded rather than claimed closed: the submission hand-off. Korean practice requires
the applicant to submit personally on the university's portal, so the confirmation number comes back by hand
— in practice over KakaoTalk or Zalo. The product makes the gap visible (`confirmation_missing` → *Chase
confirmation*, 1 case at this scale) instead of pretending the hand-off is an integration.
