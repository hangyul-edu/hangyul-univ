# Product-excellence pass — evidence (2026-11-22)

Summary: [`../../../REPORT.md`](../../../REPORT.md) §5 and §8. Task map and before/after task counts: [`TASKS.md`](TASKS.md).
Human translation queue: [`REVIEW_QUEUE.md`](REVIEW_QUEUE.md). Scripts (new in this pass): `scripts/qa/launch-final/`
`shots.mjs` (key screens), `wcag22.mjs` (WCAG 2.2 checks axe does not make), `vitals.mjs` (LCP element, CLS, scripted
interaction latency), `ops-scale.mjs` (Operations against a 1,000-student database); `e2e/failure-conditions.spec.ts`.

| Item | Where |
|---|---|
| Before / after screens (Student 13 screens, Operations 5, University 4, Marketing 3 · 390 and 1440 · full-page at 390) | [`screens/before/`](screens/before/), [`screens/after/`](screens/after/) |
| WCAG 2.2 results | [`results/wcag22.json`](results/wcag22.json) |
| Core Web Vitals (lab) | [`results/vitals.json`](results/vitals.json) |
| Operations scale | [`results/ops-scale.json`](results/ops-scale.json) |
| axe WCAG 2.0/2.1/2.2 A/AA (260 scans) | [`a11y/a11y.json`](a11y/a11y.json) |
| Responsive matrix (12 widths, 1,560 loads) | [`matrix/matrix.json`](matrix/matrix.json) |
| Overlays / body lock | [`results/overlays-student.json`](results/overlays-student.json), `-agency`, `-university` |
| Student scroll gate (130 checks) | [`results/student-scroll/`](results/student-scroll/scroll-results.json) |
| Design Preview isolation | [`preview/preview-isolation.json`](preview/preview-isolation.json) |

## Design scorecard (1–10, after this pass)

Scored by the author of the changes from the after-screens and the task walk-throughs — not by users. A score is a
claim to be challenged, so each row says what keeps it from 10.

| Screen | Clarity | Hierarchy | Ease | Trust | Polish | Mobile | A11y | Efficiency | What still costs it |
|---|---|---|---|---|---|---|---|---|---|
| Student Home | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | Programme names stay in English (official names; no Korean name exists in the data); Coming-up rows repeat "university · programme" |
| Student Match | 8 | 8 | 8 | 9 | 8 | 8 | 9 | 9 | Intro text and tabs take ≈470 px before the first university at 390; "partner" label in Preview fixtures |
| Student Application | 8 | 8 | 8 | 9 | 8 | 8 | 9 | 8 | One long page (lanes, improvements, details, history) rather than a sectioned workspace |
| Student Documents | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | Progress card + view switch + requests is three stacked controls at 390 |
| Student Messages | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Deep links exist only when the record carries a document or task |
| Operations Today | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | Ten-column table on desktop is dense; first load at 1,071 students waits ≈1.2 s for the ranking |
| Operations case | 8 | 8 | 8 | 9 | 8 | 8 | 9 | 8 | Many sections; first load at 1440 LCP 2.58 s (conversation loads after the workspace) |
| Operations review | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | — |
| University Home | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | — |
| University applicant review | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | Evidence table is long on a phone before the decision bar's actions |
| University Insights | 8 | 8 | 8 | 9 | 8 | 8 | 9 | 8 | Not redesigned in this pass |
| Marketing home / directory / university | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 8 | Client-rendered: lab LCP 2.1–2.5 s, home at 1440 2.46–2.90 s (over target in one of two runs) |

Rows below 9 were reviewed again; what remains is listed in the last column. None is a defect a code change in this
pass could remove without a larger redesign (Application workspace sections) or data the product does not have
(Korean programme names).

## Persona critique (after)

- **First-time international student (Vietnamese, phone).** Opens the app: "좋은 아침이에요 → 6단계 중 2단계 · 준비 → 다음
  할 일: 부산대학교 지원용 성적증명서 수정하기 · 12월 4일까지 → 고치는 방법 보기". Knows what to do in two seconds. Friction:
  "Business Administration (BBA)" in English inside a Korean/Vietnamese sentence; the document correction reason is the
  reviewer's text and may be in another language.
- **Busy Hangyul operator.** Today shows who to act on first, without parsing eleven stage counts; J/K/V/C in review with
  auto-advance; `?` lists the keys. Friction: the Students table and Today share a ten-column layout that is dense at
  1280; at 1,071 students the full page needs ≈5 s for every count to settle on the single-process QA API (first ranked
  row 1.2 s).
- **University admissions officer.** Home says "15 need a decision" and the first rows are on screen; the review page
  reads requirement → evidence → result with the decision on the right; a decision names who and what before it is sent.
  Friction: on a phone the evidence table is long before the decision.
- **Senior product designer.** Fewer things compete above the fold on every main screen; orange is used for the next
  action, the current stage and selection. Remaining: Student application is still one long scroll; Insights pages were
  not part of this pass.
