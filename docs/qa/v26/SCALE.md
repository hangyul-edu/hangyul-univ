# V26 — Agency console at 1,000 students

Brief §29. Run on 2026-10-27/28 against an **isolated** stack that never touched the development database:

- database `hangyul_univ_scale26`, cloned from the e2e template and seeded by `server/scripts/v9_scale_seed.py` with
  `HG_SCALE_STUDENTS=1000` → **1,071 students** for `counselor@lotus` (1,000 scale students + the 71 demo ones), 2,159
  applications, 1,011 submitted PNU applications;
- API on :8091 (`HG_DATABASE_URL` → that database), agency console on :4702 (`HG_API_URL` → :8091);
- `scripts/qa/v26/scale.mjs` (API: median / p95 of 7 cold calls per endpoint; rendered: one Chromium at 1440 and 390).
- Log: `completion/logs/scale-1000.log`; raw numbers: `scale-1000.json`. The database is dropped in the cleanup phase (§350).

## What it found (first run) and what changed

| Endpoint / check | First run | After | Fix |
|---|--:|--:|---|
| `GET /agency/students/views` (the TODAY figures + Filter counts) | **11,655 ms** median · 17,625 p95 | **246 ms** · 463 p95 | `waiting.first_rule`: "the first true rule" as one SQL `CASE` — each rule predicate once instead of `rule_i AND NOT(rule_1 … rule_{i-1})` (57 KB of SQL per party). Identical answers proven by `test_waiting_case_predicate_matches_the_legacy_form` against the kept `pred_legacy`. |
| `GET /agency/today/queue?limit=100` (ranked queue) | **2,878 ms** · 3,364 p95 | **803 ms** · 814 p95 | per-call memo in `application_readiness` + `readiness.warm_memo` (five bulk queries before the loop; 204 per-application readiness computations had cost 2.4 s). Identical answers proven by `test_readiness_memo_changes_no_answer`. |
| `GET /agency/students?…&stage=PROFILE_REVIEW` (an application status sent where a pipeline stage belongs) | **HTTP 500** | HTTP 422, field named | typed enum query parameters (`stage`, `degree`) |
| students page 1 / page 10 (50 rows) | 185 / 173 ms | 185 / 173 ms | — |
| students search / view / nationality + stage | 26 / 225 / 141 ms | same | — |
| `stage-counts`, `today` | 13 / 389 ms | same | — |

## Outcomes at 1,071 students (after)

- **Every TODAY figure equals the rows it filters to**: 긴급 982 · 7일 안에 마감 201 · 우리 답변을 기다리는 중 432 · 학생 응답 없음 20 ·
  대학 요청 56 (and the Filter's 대학 응답 대기 8).
- **The exact-action contract holds on all 1,071 rows**: every row whose reason names a record carries that record's id (0 gaps).
- First paint of the complete Today table (1,071 rows loaded, top 10 shown): **1.1–1.2 s** at 1440 and 390.
- Students: page size 50; paging to page 2 changes the rows and the URL; search and a nationality filter give a table total equal to
  the API total and recompute the strip; selecting three rows shows the bulk bar; the header cells stay visible after
  scrolling 1,400 px (sticky under the app header); row height 44 px at 1440; one card per student at 390 (no table), no
  horizontal overflow at either width, no page errors.
- Saved views: the scale seed creates none under the counsellor's account, so applying one is covered by the e2e suite rather
  than here (noted in the log as INFO).

## Where the data shape is unrealistic (and therefore not a product finding)

- 긴급 = 982 of 1,071: the scale seed gives nearly every student a near deadline or an overdue item. At a real agency the
  urgent set is a small fraction; the ranking still works, the figure is the data's.
- 1,071 students under one counsellor is a stress shape, not an operating one (V9 measured 200 per counsellor as the realistic
  upper bound).

## What this changes for later passes

`scripts/qa/v26/scale.mjs` is part of the regression list (§349). A later pass that adds a caseload predicate or a per-row
computation runs it; the bar is p95 < 1 s per endpoint and figure = rows for every TODAY view (RC-27).

**Gate budget (G-SCALE-1, 2026-10-28 02:15).** The latency rows assert median < 1 s and p95 < 2.5 s over nine calls; the earlier p95 < 1 s bound failed on host jitter three times with no code change (details in `GATE_CHANGES.md`). Idle values on this VM: figures 250–590 ms, ranked queue 600–900 ms.
