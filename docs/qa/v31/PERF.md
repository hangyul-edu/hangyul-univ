# V31 performance vs V29 (brief Part 63)

Method unchanged (V26/V28/V29): `node scripts/qa/v26/perf.mjs build` then `measure v31` — vite preview against the dev
API, median of 3 cold loads per route, 1440×900, Korean, no throttling. Raw: `docs/qa/v26/perf-v31.json` (baseline
`perf-v29.json`; V30 measured only the marketing home). Measured 2026-11-01 13:30–13:55.

| Product | Route | LCP ms | CLS | JS KB | CSS KB | Requests | API (dup) |
|---|---|---|---|---|---|---|---|
| marketing | `/` | 356 → 452 | 0 → 0 | 1174 → 1177 | 271 → 281 | 61 → 61 | 3 (0) |
| marketing | `/universities` | 400 → 556 | 0.065 → 0.076 | 1227 → 1228 | 274 → 283 | 70 → 70 | 4 (0) |
| marketing | `/universities/yonsei-university` | 444 → 640 | 0 → 0 | 1191 → 1192 | 274 → 283 | 44 → 43 | 4 (0) |
| student | `/` | 676 → 1096 | 0 → 0 | 0 → 0 | 0 → 0 | 55 → 55 | 8 (0) |
| student | `/explore` | 156 → 200 | 0 → 0 | 36 → 36 | 0 → 0 | 63 → 63 | 9 (0) |
| student | `/applications/c62c31ff-5e45-4b21-bca` | 352 → 520 | 0.01 → 0.01 | 169 → 169 | 11 → 11 | 65 → 65 | 10 (0) |
| student | `/services` | 140 → 176 | 0 → 0 | 35 → 35 | 0 → 0 | 51 → 51 | 8 (0) |
| agency | `/` | 984 → 1224 | 0.025 → 0.027 | 0 → 0 | 0 → 0 | 66 → 62 | 14 (0) |
| agency | `/students/622ab424-afbe-49ac-bd69-a2` | 540 → 844 | 0.02 → 0.02 | 166 → 166 | 8 → 8 | 80 → 80 | 20 (2) |
| university | `/` | 156 → 236 | 0.034 → 0.041 | 0 → 0 | 0 → 0 | 74 → 74 | 23 (0) |
| university | `/analytics` | 300 → 332 | 0.091 → 0.078 | 26 → 26 | 0 → 0 | 54 → 54 | 9 (0) |

**Payload: flat.** JS +1–3 KB, request counts unchanged (agency Today 66 → 62), API calls and duplicates unchanged.
Marketing CSS +9–10 KB: the pricing-tail panel/disclosure rules and the warm ramp tokens.

**CLS: unchanged** within ±0.011 (the largest, `/universities` 0.065 → 0.076, is the V30 directory, not V31 code).

**LCP: slower on every route, including routes V31 did not touch** (`/explore`, `/services`, `/analytics`, the
university home), by a similar 20–60 %. During the measurement another project on this host was encoding video
(ffmpeg at ~500 % CPU, load average 7–8). The timing comparison is therefore **not attributable** in either direction;
it is recorded, not claimed. A re-measurement on a quiet host is needed for a real LCP statement — V29 §PERF already
recorded API-bound routes as host-sensitive (agency Today issues 14 parallel API calls served by one Python process).
