# V19 evidence — final experience, navigation correctness and zero-defect pass

Everything here was produced on **2026-10-20** against the running stack (API :8001, Marketing :3100,
Student :3101, Agency :3102, University :3103, review bundle :4173), all six verified by HTTP first.
Narrative and conclusions: `docs/REPORT.md` §§190–210.

## Re-running any of it

| command | what it proves |
|---|---|
| `npm run qa:v19` | 66 checks: the page-top rhythm at 9 widths, the route-scroll policy live, every public route clean, and the source invariants behind each V19 fix |
| `npm run qa:v19-errors -- --width 1440` | the error matrix — 10 Student pages × 12 failure conditions |
| `npm run qa:v19-clickmap` | every visible control on 20 routes, bucketed; no silent coverage holes |
| `npm run qa:v19-student` | all 30 Student routes signed in, at 390 and 1440 |
| `npm run qa:v19-consoles` | Agency (23 routes) and University (16 routes), signed in |
| `npm run qa:v19-locales` | `/start` and `/universities` in all 33 market locales at 390 and 1440 |
| `npm run qa:v19-journey` | the whole Marketing → Student path as one user: clicks, scroll surprises, dead ends, lost context |
| `npm run test:release` | the environment, then every suite and gate above — a missing dependency **fails** the run, it does not skip a test |

The review bundle must be served for `qa:v17`: `npm run review:build && npm run review:serve`.

## Instruments written for this pass

Following the convention already used in `scripts/qa/`, a leading underscore marks a **one-off probe**
written to answer a single question, and an unprefixed name marks a **durable instrument** wired to an
`npm run` script.

*Durable* — `error-matrix.mjs`, `click-map.mjs`, `student-sweep.mjs`, `console-sweep.mjs`,
`locale-shots.mjs`, `journey.mjs`, plus the gate `scripts/qa/v19-gate.mjs` and
`scripts/release/test-release.mjs`.

*Probes* — `_measure-top.mjs` (header clearance at nine widths), `_scroll-probe.mjs` (reproduces the
scroll defect and prints the sessionStorage map that causes it), `_motion-trace.mjs` (frame-accurate
entrance traces) and `_hero-film.mjs`, `_align.mjs` (element axes on Student Home), `_perf.mjs`
(LCP/CLS/TTFB), `_ovf.mjs` / `_ovf2.mjs` (the Japanese overflow), `_tbl.mjs` (the university "clipped
tables"), `_403.mjs` and `_inert.mjs` / `_pay.mjs` (the agency 403 and the dead upgrade button),
`_shot.mjs` / `_sshot.mjs` (screenshots), `_unidetail.mjs` (the photo-backed university head),
`_pop-probe.mjs`, `_rev.mjs`, `_rm.mjs`.

Each probe is kept rather than deleted because the report cites its output, and a cited number whose
instrument no longer exists cannot be checked.

## Directories

| path | contents |
|---|---|
| `evidence/` | machine-readable results: `student-sweep.json`, `agency-sweep.json`, `university-sweep.json`, `error-matrix-{1440,390}.json`, `click-map-1440.json` |
| `screenshots/marketing/` | `before-*` / `after-*` pairs for `/start` and `/universities`, plus `motion/` frame strips |
| `screenshots/student/` | all 30 routes at 390 and 1440, `before-`/`after-` Home and Documents, and `errors/` for any failing matrix cell |
| `screenshots/agency/` | 23 routes + the 403 state |
| `screenshots/university/` | 16 routes |
| `screenshots/locales/` | 132 — `/start` and `/universities` × 33 market locales × 390/1440 |
| `screenshots/native/` | **empty on purpose** — see its README and REPORT §194 |

## A note on the instruments

Several of these found defects in themselves before they found defects in the product: the error matrix
produced four false positives on its first run, the console sweep reported two "clipped tables" that were
screen-reader alternatives behind charts, the click-map filed eleven collapsed footer links as "broken",
and an e2e case failed twice because Playwright's own auto-scroll moved the offset it was measuring. Each
is recorded in the report next to the real findings rather than quietly removed. An instrument that never
catches itself is not being run honestly.
