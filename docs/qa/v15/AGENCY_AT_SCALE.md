# V15 — agency at scale

*Brief Part 26. Measured on an isolated scale stack: **274 active students for one Lotus Bridge counsellor**,
1,264 submitted applications, scale API on :8091 and the console on :4702. None of it is the development
stack and none of it appears in a development screenshot.*

## What is real here and what is not

The caseload is real data in a real database being rendered by the real console. What is synthetic is its
*shape* — stages, deadlines, silences and, new in V15, the plan mix come from distributions an author chose.

So the **mechanics** below are findings: whether a number agrees with the rows it opens, how many clicks an
action takes, whether the console can say what was promised. The **mix** is not evidence about any real
agency, and no conclusion about Hangyul's actual business should be drawn from it.

    HG_DATABASE_URL=…/hangyul_univ_scale server/.venv/bin/python scripts/v15_scale_plans.py
    node scripts/qa/v15-scale.mjs

## The caseload

| | |
|---|--:|
| Active students for one counsellor | **274** |
| All-in-One | 168 |
| Premium | 85 |
| Basic | 21 |
| Cases with **no** purchased plan | **0** |
| Cases **at** an allowance limit | **86** |
| Cases **past** an allowance limit | 0 |

Eighty-six cases at a limit is the number that matters. It is roughly a third of the caseload, and before
V15 every one of them was invisible: a counsellor could promise a third managed application or a second
editing round on any of them without the console having an opinion.

## The five measurements the brief asks for

### 1 · Time to identify an urgent case

**2.6 s** from submitting the sign-in form to the top-ranked case being on screen and readable.

What is on that row, at 274 cases:

> **Cao Ngọc Minh** · 올인원 · *첫 답변이 177일 늦었습니다* · next: 답장 · due 4월 25일

Student, plan, why, next action and deadline — the four questions, minus "is it ready to submit", which is a
property of an application rather than of a case and lives one click away on it.

### 2 · Clicks to open the next action

**One.** The action is a link on the row it belongs to; there is no intermediate case screen to pass
through. `j`/`k` walk the rows and `↵` opens the action, so the keyboard path is also one.

### 3 · Scope / entitlement confusion

The question V15 exists to answer. At this caseload:

- every row carries the purchased plan as a token, so what may be promised is visible before the case opens;
- the case strip's first cell is **PLAN**, so it is also visible after;
- a case at its limit opens in **1.0 s** and states, without being asked:

      프리미엄 · ₩849,000
      지원 관리    3 / 3곳
      자소서 첨삭   0 / 2 사용
      모의 면접    0 / 1 사용
      후속 상담    상시 문의
      추천 대학    0 / 7곳
      상담        90분 제공
      추가 서비스   없음

      현재 플랜에 포함되지 않은 지원입니다.
      지원 관리: 3 / 3 사용 — 플랜 범위를 넘습니다.      [ 추가 서비스 요청 ]

  One out-of-scope notice, carrying the one legitimate next step. Not a disabled control, not an error.

### 4 · Missed deadlines

149 overdue items in the next 30 days across the caseload; the **긴급** chip reads 28, which is the number
of *students* with an urgent reason rather than the number of items — a counsellor works students, not rows
in a deadline table, and 149 on a chip would be a number nobody could act on.

The queue's total (225 with an open reason) and the chip breakdown (긴급 28 · 우리 작업 200 · 학생 대기 25)
do not sum, and are not meant to: urgency is a severity cut *across* the other three. That was V13's
decision and it still holds at this volume.

### 5 · Unnecessary navigation

- **7** rail destinations: `/` `/students` `/review` `/applications` `/messages` `/performance` `/manage`.
  Unchanged from V11; V15 added none.
- **0** buttons in Today's page header. Nothing on the screen invites the counsellor to leave it.
- The filter row is **47 px** at 274 cases — one line, as V13 designed it to be.

## What this did not test

- **Two counsellors at once.** Nothing here measures contention, assignment hand-over or a manager
  rebalancing a caseload.
- **The add-on conversation.** 0 open offers in the scale set, because the scale reconciliation covers
  overages with approved add-ons rather than pending ones. The offer→approve→limit-rises path is covered by
  `npm run qa:entitlements` on the development dataset instead, end to end.
- **Whether 2.6 s feels fast.** It is a measurement, not a usability finding. No counsellor has used this.
