# V26 — evidence folder

Everything the V26 pass measured, decided and ran. REPORT.md §330–§352 is the narrative; this folder is the evidence it
cites. Dated passes before V26 keep only their Markdown summaries and the data registries current documents cite (see
`FILE_CLEANUP.md` for what was removed and why).

## Documents (authoritative)

| File | What it is |
|---|---|
| `ROOT_CAUSE_MATRIX.md` | RC-01 … RC-28: recurring issues across V1–V26 with evidence, root cause, why QA missed it, the V26 fix and its regression protection; verdicts on the brief's hypotheses A–R |
| `USER_FRICTION_MAP.md` | the major workflows step by step, clicks before → after, confusion and dead-end risks, measured on the running stack |
| `CURRENT_BENCHMARK.md` | Cialfo · ApplyBoard · Studyportals · Common App · Slate · Element451 · Liaison CAS · IDP, read from official material on 2026-10-27; what applies, what Hangyul deliberately does not copy |
| `VISUAL_DEBT.md` | computed-output inventory: the tangerine census (51 → 0 stray fills), the cascade metrics (version files 9/9/8/5 → 0, dead declarations 82/151/126/114 → 26/56/27/21), composition items and what was left open |
| `GATE_CHANGES.md` | every gate, test or skip V26 changed, with old intent, where it is protected now, positive/negative controls; the skip inventory |
| `SCALE.md` | the agency console at 1,071 students: what the scale test found (11.7 s → 0.25 s; 2.9 s → 0.8 s; a 500 → 422), the outcomes, what in the data shape is unrealistic |
| `MOBILE_PARITY.md` | workflow × web / student native / agency native / university native, intentional differences vs actual gaps |
| `USABILITY_PROTOCOL.md` | the human usability protocol (5 students, 3 agency, 3 university) — **prepared, not run** |
| `FILE_CLEANUP.md` (+ `FILE_CLEANUP_MANIFEST.txt`) | repository inventory before/after, classification rules, the analysis table, the deletion categories |

## Measurements (machine-readable)

| File | Produced by |
|---|---|
| `css-metrics-before.json` · `css-metrics-consolidated.json` · `css-metrics-after.json` | `scripts/qa/v26/css-metrics.mjs` |
| `census-before.json` · `census-after.json` | `scripts/qa/v26/census.mjs` |
| `perf-before.json` · `perf-after.json` | `scripts/qa/v26/perf.mjs` (compare: `perf-compare.mjs`) |
| `scale-1000.json` | `scripts/qa/v26/scale.mjs` |
| `zoom.json` | `scripts/qa/v26/zoom.mjs` |
| `css-entry-composition.json` | the marketing production stylesheet split into its layers and minified one by one (RC-29) |
| `evidence/` | `base.before-prune.css` + `base.pruned-selectors.txt` (the 312 rules removed at source, RC-29), `perf-compare.md`, `doc-drift-actions.md`, `unreferenced-probes.txt`, `media-dups.txt`, `media-student-newer.txt` |
| `FILE_CLEANUP_MANIFEST.txt` | every path the cleanup removed, with size and category (stage A, stage B) |
| `visual/before/` · `visual/after/` | `scripts/qa/v26/capture.mjs` — 209 full-page captures each, 390 / 430 / 768 / 1024 / 1440 (+1728 consoles), Korean |
| `visual/zoom/` | 200 % and 320-px reflow captures of the core routes |
| `shots/android/` | emulator smoke screenshots per app |

## Final logs

`completion/logs/` holds only the latest authoritative log per gate, named `<gate>-final.log`, each ending in `EXIT=<code>`
(REPORT §349's table is generated from them by `scripts/qa/v26/ledger.py`), plus `chain-final.log`, the timeline of the
validation → cleanup → Android phases. Intermediate and re-run logs were removed in the cleanup (stage B); `ios-blocker-final.log`
records the external blocker (EXIT=2).

## Re-running

```
npm run qa:v26                       # the V26 gate (static · api · rendered); needs the dev stack (npm run dev)
npm run qa:v26-census                # tangerine census over the core routes
npm run qa:v26-css                   # cascade metrics per app
npm run qa:v26-scale                 # needs the isolated scale stack — see SCALE.md
node scripts/qa/v26/zoom.mjs         # zoom / reflow review
node scripts/qa/v26/capture.mjs after # route captures (resumable; RESHOOT=1 to redo)
scripts/qa/v26/final.sh              # the whole sequential regression, one process at a time, resumable
scripts/qa/v26/android-phase.sh all  # 3 × (preview APK + production AAB) sequentially, AAB scan, emulator smoke
node scripts/qa/v26/prune-marketing-base.mjs            # dry run of the RC-29 source prune (the gate runs this; expects 0)
python3 scripts/qa/v26/cleanup.py a                       # dry run of the repository cleanup (manifest preview)
```
