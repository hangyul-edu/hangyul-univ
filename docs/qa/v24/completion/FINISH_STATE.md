# V24 completion state — visual & experience pass

Resume rule: continue from the first step not DONE. One heavy process at a time. Logs: `docs/qa/v24/completion/logs/`.

| # | step | state | evidence |
|---|---|---|---|
| 0 | Recover V23 state (§0, §268–§289) | DONE 2026-10-26 | stack up on 8001/3100–3103 |
| 1 | BEFORE screenshots (390/768/1440, 1728 dense) | DONE 2026-10-26 | docs/qa/v24/visual/before (105 files) |
| 2 | Competitive benchmark | DONE 2026-10-26 | docs/qa/v24/BENCHMARK.md |
| 3 | Audits §290–§298 | DONE 2026-10-26 | REPORT §290–§298 |
| 4 | Marketing CTA + pricing disclosure + button rules | DONE 2026-10-26 | v24.css; cta-contrast.mjs 7,940 readings 0 violations + self-test caught; native Button verified static; residue purge + seed key (§290 V24-1/2/3/4) |
| 5 | Media research (195 D/E + 151 photo quality) | DONE 2026-10-26 | coverage CSV 0 defects: photo 155 / film 76 / logo 2 / identity 192; 30 weak-but-truthful heroes remain |
| 6 | Directory + detail experience | DONE 2026-10-26 | card credit overlay, quiet play mark, v24.dir.title, detail story order, academic block w/o hero dupes, said-once facts, gallery nN layouts, NoClosingCta |
| 7 | Student / Agency / University visual pass | DONE 2026-10-26 | next title h2-role, 내 여정 tab (web+native), neutral in-progress chips (agency+univ), empty stages static, country folded under name (defaultHidden col) |
| 8 | Design-system tokens + CTA contrast gate | DONE 2026-10-26 | --hg-type-* roles generated; h1 student 30 / console 22 / sections 18; V24 CSS literal-free |
| 9 | Copy pass + translations | DONE 2026-10-26 | 5 keys × 33 markets; 3 explanatory lines removed |
| 10 | qa:v24 + visual review | pending | |
| 11 | Regression (V23 suites) + Android rebuild if native changed | PAUSED | student APK+AAB built; agency APK built, agency prebuild-prod done; agency AAB + university ×2 not built — build reaped for low memory 2026-10-26, waiting for the owner to allow a restart. Next: `scripts/release/v23-android.sh agency aab` (re-run until DONE), then university prebuild-preview/apk/prebuild-prod/aab, v23-collect, android-smoke |
| 12 | REPORT §299–§309 + §0 | pending | |
