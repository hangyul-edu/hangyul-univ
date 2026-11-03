# V15 — university at scale

*Brief Part 26. Measured on the isolated scale stack: **1,264 submitted applications** at Pusan National
University across five intakes, console on :4703 against the scale API on :8091.*

The same caveat as the agency document: the data is real in a real database rendered by the real console;
its *shape* is synthetic. The mechanics are findings, the mix is not evidence about a real university.

## The Overview across dataset sizes

The intake selector gives five genuinely different populations without inventing any — from a single
application to a thousand.

| Dataset | Population | Height | Queue rows | Market bars | Largest drop named |
|---|--:|--:|--:|--:|---|
| 2025 Fall | **1** | 1.56 screens | 7 | 1 | — (withheld) |
| 2026 Winter | **36** | 1.56 screens | 7 | 6 | yes |
| 2026 Spring | **288** | 1.56 screens | 7 | 6 | yes |
| 2026 Fall | **288** | 1.56 screens | 7 | 5 | yes |
| 2027 Spring (current) | **398** | 1.56 screens | 7 | 6 | yes |
| All intakes | **1,011** | 1.56 screens | 7 | 6 | yes |

No horizontal overflow at any size. No empty state on a populated intake and no broken chart on the
single-application one — at population 1 every conversion is below the minimum sample, so the funnel prints
"표본 부족" on every row and names **no** largest drop, which is the correct answer rather than a 100 %.

**A true zero dataset does not exist in the scale set.** The code path is there (`d.total === 0` renders an
empty state rather than a funnel) and it is exercised on the development dataset; it is not exercised here,
and saying so is more useful than claiming a sweep that included it.

## Height

| | |
|---|--:|
| V14 Overview, development dataset | 1.96 screens |
| V15 Overview, development dataset | **1.51 screens** |
| V15 Overview, 1,011 applications | **1.56 screens** |

Target was 1.0–1.5. The development figure is inside it and the full-volume figure is 0.06 screens outside
it, which is stated rather than rounded away. The page grew by 0.05 screens for roughly two hundred times
the data, and it did that while gaining three sections it did not have.

Where the height goes at 1,011 applications: decision queue 419 px · funnel 526 px · source market 526 px
(matched to the funnel) · post-admission 168 px · header and notes ~130 px.

## What the Overview actually says at volume

This is the part worth reading, because it is where the design either earns its place or does not:

    결정이 필요한 지원서 — 입학팀의 결정을 기다리는 건 641건 · 모든 모집 시기
      심사 대기     513     제출되었으나 아직 결정 전
      면접           84     면접 예정 또는 일정 조율 필요
      발행할 등록금 고지서  51
      플래그         46
      예비 합격      43
      추가 서류 제출됨  1
      지원자 조치 대기 3종 — 231

    지원자 출신 국가
      우즈베키스탄  ███████████████  313   등록 1
      베트남       ████████████     263   등록 0
      네팔         ██████████       226   등록 0
      중국         ████████         189   등록 1
      몽골         ▌                 16   등록 0
      방글라데시    ▏                  1   등록 1

Four markets producing between 189 and 313 applications and **between zero and one enrolled student** is
exactly the finding the brief wanted this section to make visible, and it is visible in one glance because
applications and enrolments are on the same row rather than in two charts.

## Reconciliation at volume

The funnel's first step reads **1,011 submitted**; the applicant list it opens shows **1,011**. Every row of
the decision queue and every country bar was followed through to its records by `npm run qa:university` on
the development dataset, and the funnel was followed through here.

## What this did not test

- **Concurrency.** One reader, one session.
- **A real recruitment cycle.** Every intake in this set was generated at once; nothing here says how the
  Overview behaves as a deadline approaches over weeks.
- **Whether 0.6 s to first paint holds on a cold server**, over a slow link, or on a laptop rather than this
  machine.
