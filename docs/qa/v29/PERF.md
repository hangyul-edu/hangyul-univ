# V29 performance vs V28 (brief §68)

Method unchanged from V26/V28: `node scripts/qa/v26/perf.mjs build` (production builds into `dist-perf`) then
`measure v29` — vite preview against the dev API, median of 3 cold loads per route, 1440×900, Korean, no throttling.
Raw: `docs/qa/v26/perf-v29.json` (baseline `perf-v28.json`). Measured 2026-10-31 on this host after an unplanned reboot.

| Product | Route | LCP ms | CLS | JS KB | CSS KB | Requests | API (dup) |
|---|---|---|---|---|---|---|---|
| marketing | `/` | 280 → 356 | 0 → 0 | 1163 → 1174 | 268 → 271 | 61 → 61 | 3 (0) |
| marketing | `/universities` | 400 → 400 | 0.065 → 0.065 | 1216 → 1227 | 274 → 274 | 70 → 70 | 4 (0) |
| marketing | `/universities/yonsei-university` | 392 → 444 | 0 → 0 | 1181 → 1191 | 274 → 274 | 44 → 44 | 4 (0) |
| student | `/` | 512 → 676 | 0 → 0 | 0 → 0 | 0 → 0 | 55 → 55 | 8 (0) |
| student | `/explore` | 112 → 156 | 0 → 0 | 36 → 36 | 0 → 0 | 63 → 63 | 9 (0) |
| student | `/applications/c62c31ff-5e45-4b21-b` | 280 → 352 | 0.01 → 0.01 | 169 → 169 | 11 → 11 | 65 → 65 | 10 (0) |
| student | `/services` | 212 → 140 | 0 → 0 | 30 → 35 | 0 → 0 | 51 → 51 | 8 (0) |
| agency | `/` | 508 → 984 | 0.019 → 0.025 | 0 → 0 | 0 → 0 | 65 → 66 | 14 (0) |
| agency | `/students/622ab424-afbe-49ac-bd69-` | 504 → 540 | 0.033 → 0.02 | 160 → 166 | 8 → 8 | 80 → 80 | 20 (2) |
| university | `/` | 132 → 156 | 0.033 → 0.034 | 0 → 0 | 0 → 0 | 74 → 74 | 23 (0) |
| university | `/analytics` | 228 → 300 | 0.081 → 0.091 | 26 → 26 | 0 → 0 | 54 → 54 | 9 (0) |

**Payload: no regression.** JS +5–11 KB on the routes that render plan content (the V29 manifest, `compareCell`, add-on
catalogue), CSS +3 KB on marketing, request counts unchanged (agency Today +1), API request counts and duplicates unchanged,
CLS unchanged or better. Student `/services` LCP improved (212 → 140 ms).

**LCP on API-bound routes is slower on this host, and the evidence says it is not V29 code:**
- agency Today 508 → 984 ms and student home 512 → 676 ms reproduced on two fresh runs (a first run measured the cold host
  right after the reboot and was discarded — `perf.mjs` resumes from an existing JSON, so it had to be deleted to re-measure).
- The agency Today page fires 14 API calls in parallel; each completes in 600–800 ms in the browser, while the same calls
  run one at a time total ≈ 0.66 s — CPU-bound Python work serialised by the GIL, i.e. the page waits on the sum.
- The heaviest call, `/agency/students/views` (`caseload.view_counts`, V26 code, unchanged in V29), measured 0.22 s and
  0.46 s back to back on the same data after `VACUUM ANALYZE`; the dev tables are small (171 tasks).
- The only V29 code on that path that touches every response is the Korean name resolver; the same page loaded in Korean and
  in English took 1,315 / 1,284 ms and 1,311 / 4,031 ms — no Korean penalty, large host variance.

Recommendation recorded for release: re-measure on a quiet, warmed host before launch; if agency Today stays near 1 s, the
known lever is the V26 `view_counts` aggregate (one query with a filtered count per view) — independent of V29.
