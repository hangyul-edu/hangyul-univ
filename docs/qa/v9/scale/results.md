# V9 scale validation (reliability workstream, Part B)

Database: separate `hangyul_univ_scale` (alembic head + `app.seed.run` + `server/scripts/v9_scale_seed.py`), API on :8091 (no --reload, stopped after the run). Dev DB untouched.
Data: 1 Lotus counselor with 200 active students (varied stages, tasks, documents in review, essays, messages, deadlines); 1,011 submitted Pusan National University applicants across programs, intakes and 4 agencies; ~1,300 students total.
Method: 20 sequential calls per endpoint, p50/p95 in ms, `results.json` (after) / `results-before.json` (first run, before fixes).

| Endpoint | p50 before | p95 before | p50 after | p95 after | Limit 1 s |
|---|---|---|---|---|---|
| agency: today queue (counselor) (`/agency/today/queue`) | 1006.3 | 1129.7 | 322.5 | 407.7 | ok |
| agency: students default (`/agency/students?page=1&page_size=20`) | 47.8 | 81.0 | 51.6 | 58.7 | ok |
| agency: students view=mine (`/agency/students?page=1&page_size=20&view=mine`) | 47.9 | 52.4 | 52.6 | 55.5 | ok |
| agency: students view=urgent (`/agency/students?page=1&page_size=20&view=urgent`) | 65.9 | 87.7 | 63.4 | 83.2 | ok |
| agency: students view=docs sort=deadline (`/agency/students?page=1&page_size=20&view=docs&sort=deadline`) | 55.2 | 76.5 | 63.1 | 89.9 | ok |
| agency: students view counts (`/agency/students/views`) | 235.5 | 329.2 | 273.2 | 381.7 | ok |
| agency: ops (manager) (`/agency/ops`) | 462.1 | 529.9 | 518.5 | 649.6 | ok |
| university: applicants default (`/applications?page=1&page_size=20&sort=submitted`) | 142.1 | 228.9 | 217.7 | 242.4 | ok |
| university: applicants filtered (`/applications?page=1&page_size=20&sort=submitted&status=UNIVERSITY_REVIEW&nationality=VN&intake=2027-SPRING`) | 151.3 | 232.4 | 186.5 | 219.6 | ok |
| university: analytics/questions (`/university/analytics/questions`) | 149.9 | 250.1 | 125.8 | 253.6 | ok |
| university: bulk-filter preview (967 of 1,011) (`/university/bulk-filter/export/preview`) | 33.1 | 47.4 | 35.2 | 150.6 | ok |
| university: applicant detail (`/applications/62d47a51-fa33-47d3-b1fd-fb1b22971d32`) | 24.7 | 27.9 | 31.7 | 33.7 | ok |
| hq: overview (`/agency/hq/overview`) | 1641.1 | 2063.3 | 603.0 | 724.8 | ok |

Over 1 s on the first run: `/agency/today/queue` (p95 1130 ms) and `/agency/hq/overview` (p95 2063 ms).

Fixes (query-shape only; no index or migration was needed, so no v9_perf_* revision):
- `services/submission.py` (agency queue): per-application readiness checklist was an N+1 (~10 ms each). Applications whose student has no VERIFIED document for a required category are skipped (they can never be ready); catalog rows (program/intake/university) preloaded into the identity map; connector resolution cached per combination. Same results.
- `api/v1/hq_ops.py` (HQ overview): one query for all attributed students' names instead of one `db.get` per row (411 queries).

Result: every measured endpoint p95 < 1 s (max: HQ overview 725 ms, ops 650 ms). Note the bulk-filter preview p95 differs between runs (47 vs 151 ms) from a single outlier; p50 is stable (~35 ms).
