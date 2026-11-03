# V26 — Repository cleanup

Brief §86–§105. Cleanup happens **after** forensics and implementation (the historical evidence was read first; its
conclusions are in `ROOT_CAUSE_MATRIX.md`, `GATE_CHANGES.md` and REPORT §330–§331). The AFTER section is filled in when the
cleanup has run and the post-cleanup validation is green.

## BEFORE (measured 2026-10-27 06:47, before any V26 change)

| Measure | Value |
|---|--:|
| Repository size (incl. `node_modules`) | 17 GB |
| `node_modules` | 4.0 GB |
| Files, excluding `node_modules` | 129,626 |
| Tracked / untracked | not a git repository — no `git status`; the whole tree is "untracked" |
| `docs/qa` | 2.3 GB · 10,204 files · 9,570 PNG/JPG/WebP |
| `result/` | 1.1 GB · 41 files (20 APK/AAB: V17–V25 copies) |
| `apps/` | 8.1 GB (of which `apps/*/android` Gradle outputs and `apps/*/dist*`) |
| `apps/marketing-web/public/media` + `apps/student-web/public/media` | 594 MB + 581 MB — the same ~2,900 university-photo renditions stored twice |
| `dist-review/` | 745 MB · 5,479 files (reproducible review build) |
| `themeforest-ynex/` (vendor) | 468 MB · 59,842 files |
| `template-koreanasha/`, `themeforest-eduan/` (vendor) | 126 MB + 39 MB |
| `qa-screenshots/` | 82 MB · 591 files |
| `server/` | 394 MB (uploads in `server/var`, raw data caches) |
| Log files (`*.log`, `*.out`, `*.err`, excl. `node_modules`) | 214 |
| `scripts/qa/**/_*.mjs` one-off probe scripts | 93 |
| `docs/qa/v25/REPORT.before-v25.md` | a 17,148-line copy of REPORT.md |

Largest directories: `apps/*/android` build outputs, `docs/qa/v10` (516 MB), `docs/qa/v9` (385 MB), `docs/qa/v8` (243 MB),
`docs/qa/v6` (207 MB), `docs/qa/v25` (187 MB), `docs/qa/v14` (181 MB).

### Host event during the pass

On 2026-10-27 21:08–21:50 a host maintenance routine outside this repository (`/root/wsl-maintenance/`) deleted
`node_modules`, `dist-review/`, `playwright-report/`, `test-results/` and `~/.cache/ms-playwright` as regenerable;
`node_modules` and the browser were reinstalled from the lockfile (`completion/logs/npm-ci-restore.log`). The AFTER
figures below therefore start from a tree that no longer contains those four directories; they are counted as "removed by
the host, not by this pass".

## Classification rules

- **KEEP**: active source and packages, manifests and lockfiles, configuration, Alembic migrations, seed data, legal and
  compliance records, media provenance/licence metadata, source-of-truth docs, current tests and QA scripts, current
  images, branding, translation bundles, deployment files, environment templates, README/setup, third-party licence
  notices, purchased template sources still required by the build.
- **DELETE**: proven unreferenced (import graph + text search + routing + build + typecheck), superseded by V26 evidence
  (old QA captures, intermediate reports, old logs once summarised), reproducible outputs (`dist*`, coverage, Playwright
  output), duplicates by hash whose licence semantics are identical, old build copies once the V26 artifact exists and
  validates.
- **REVIEW**: anything a current document links to (replace the link with the V26 summary or keep the file), anything with
  licence meaning.

Never by age alone, never by filename alone.

## Analysis (2026-10-28, before deleting anything)

| Candidate | Evidence | Class | Plan |
|---|---|---|---|
| `apps/student-web/public/media` (581 MB, 2,894 files) | a strict subset of `apps/marketing-web/public/media` (2,966 files); 6 WebP renditions differ only because the student copy was re-encoded on 10-27 (newer, smaller) | DELETE (duplicate) | copy the 6 newer encodes into the marketing tree, then make the student directory a symlink to it; both dev servers and both builds keep serving `/media/…`; rights metadata lives in `university_content.json`, untouched |
| 16 pairs of byte-identical `…-1200` / `…-2400` renditions in the media tree | the source image was ≤ 1200 px, so the 2400 rendition is the same bytes | DELETE (duplicate) | delete the 2400 file and drop `2400` from that asset's `renditions` list so `srcset` and the rendition gate agree; licence semantics are per asset, not per rendition, so nothing merges |
| `docs/qa/v3 … v25` captures, traces, intermediate CSV/JSON, run logs (2.1 GB, ~10,000 files) | every finding that still matters is in `ROOT_CAUSE_MATRIX.md`, `GATE_CHANGES.md` and REPORT §330; current documents reference 177 `docs/qa/*` paths, of which 17 are already dangling prose patterns inside REPORT's dated sections (e.g. `docs/qa/v22/shots/agency-`), none a live link from a current-state doc | DELETE images/logs/traces; KEEP each pass's Markdown summaries (`README.md`, `SCORECARD.md`, `*.md`), `*.csv` registries that current docs cite (`UNIVERSITY_PHOTO_SEARCH.csv`, `UNIVERSITY_MEDIA_COVERAGE.csv`, `UNIVERSITY_VISUAL_COVERAGE.csv`), `MANUAL_MEDIA_ACQUISITION.md`, `IOS_BUILD_BLOCKER.md`, legal/compliance records | REPORT §350 states that historical sections cite evidence files removed in V26 and where their conclusions live |
| `docs/qa/v25/REPORT.before-v25.md` (17,148 lines) | a copy of REPORT.md that greps as a second source of truth | DELETE | — |
| `docs/qa/v26/_work/pix/` (3 × 54 PNG), `_work/*.md` drafts | V26's own intermediate material | DELETE after the drafts are in REPORT and the pixel verdict is in the log | — |
| 45 `scripts/qa/**/_*.mjs` probe scripts referenced by nothing (of 93) | import/text search over package.json, scripts, docs, e2e | DELETE | the 48 referenced ones stay |
| `qa-screenshots/` (82 MB, 591 files, 09-29 → 10-25) | output of V15/V21 capture scripts; referenced only by those scripts' default `OUT` paths and an ignore list | DELETE | the two scripts keep writing there if run again (gitignored output) |
| `apps/*/dist`, `apps/*/dist-perf` (1.2 GB + 0.7 GB) | reproducible; `dist-perf` exists only for the perf measurement | DELETE after the final production build produces `dist` again; `dist` itself is the deployment output and is **kept** from the final build |
| `server/var/uploads`: 15,488 of 15,963 files (9.4 MB) | no `document_versions.storage_key` or `message_attachments.storage_key` references them (test uploads whose rows were purged; e2e-database uploads sharing the directory) | DELETE (test residue) | `purge_e2e.py` now removes them and `--check` counts them (0 after) |
| `result/*/android/*-v23-*`, `result/student-mobile/archive-v22/`, `result/student-mobile/metadata/BUILD_INFO.json` (V23) | superseded once the V26 artifacts exist and validate | DELETE then | V26 `preview.apk` + `production.aab` + `BUILD_INFO.json` per app are kept; the V25 artifacts go **only after** the V26 ones pass their scan and smoke |
| `docs/media/retired-attribution-required/` (12 MB) | V14 retired CC BY marketing photos, kept with their attribution as a licence record | KEEP | legal meaning |
| `hangyul_univ_scale26`, `hangyul_univ_scale`, `hangyul_univ_bench`, `hangyul_univ_seedcheck` databases | V26 scale test / V9–V13 leftovers | DROP after the scale log is final | `hangyul_univ_e2e_tpl` / `_e2e` stay (the e2e runner needs them) |
| 127 `__pycache__` dirs, `server/.ruff_cache`, `.qa-logs`, `.expo-export-check`, `.expo` | regenerable caches | DELETE | — |
| `themeforest-*`, `template-koreanasha` (633 MB) | purchased template sources the build still imports from (`packages/eduan-ui`, `ynex-ui`, `koreanasha-ui` compile their SCSS) | KEEP | licence + build dependency |

## Procedure

The cleanup is a script, not a session of `rm`: `scripts/qa/v26/cleanup.py` (dry run by default; `--apply` deletes). It
reads this table's decisions, keeps every earlier-pass Markdown file, the cited CSV registries and any earlier-pass file a
kept script or a current-state document references by path, and appends every removed path with its size and category to
`FILE_CLEANUP_MANIFEST.txt`. **Stage A** runs before the post-cleanup validation (evidence of earlier passes, build output,
caches, scratch, unreferenced probes, the duplicate media tree → symlink, the 16 duplicate 2400 renditions + registry).
**Stage B** runs only after the post-cleanup validation and the Android builds (superseded native artifacts, non-final logs,
the scale/bench databases, the V26 scratch folder), because those are what the validation needs or produces.

## AFTER

### Stage A (applied 2026-10-28 01:40, before the post-cleanup validation)

`python3 scripts/qa/v26/cleanup.py a --apply` — **10,024 paths, 7,754 MB** (every path in `FILE_CLEANUP_MANIFEST.txt` with its
size and category):

| Category | Paths | Size |
|---|--:|--:|
| Reproducible build output (`apps/*/dist`, `dist-perf`, `dist-cssattr`, `dist-e2e`) | 13 | 4,598 MB |
| Earlier-pass evidence under `docs/qa/v3 … v25` (images, logs, traces, intermediate data) | 9,907 | 2,346 MB |
| Duplicate media tree `apps/student-web/public/media` → symlink to marketing (6 newer WebP copied over first) | 1 | 606 MB |
| V26 pixel-diff scratch (`_work/pix`) | 1 | 109 MB |
| `qa-screenshots/` (V15/V21 capture output) | 1 | 84 MB |
| Regenerable caches (`__pycache__`, `.ruff_cache`, `.expo`, `.qa-logs`, …) | 22 | 7 MB |
| Byte-identical 2400 renditions of ≤ 1200-px sources (+ the registry drops the width for those 8 assets, table reloaded) | 16 | 2 MB |
| `docs/qa/v25/REPORT.before-v25.md` | 1 | 1 MB |
| Unreferenced one-off probe scripts | 51 | < 1 MB |
| V26 drafts/patches already applied or appended, one-off chain | 11 | < 1 MB |

Kept on purpose: every earlier pass's Markdown (155 files), the cited CSV registries, 117 small JSON/CSS files that a kept
script or a current document references by name (e.g. `docs/qa/v10/css-baseline/*.css`, which `v10-removed-css-probe.mjs`
re-checks), `docs/media/retired-attribution-required/` (licence record), the three licensed template sources (build inputs),
`server/var/uploads` rows still referenced (orphans purged: 0 left), `docs/qa/v26` evidence in full.

| Measure | Before | After stage A |
|---|--:|--:|
| Repository excluding `node_modules` / `.venv` | ≈ 13 GB | **2.6 GB** |
| `docs/qa` | 2.3 GB · 10,204 files | **195 MB** · 296 files outside `v26` (155 `.md`) + `v26` 173 MB |
| University media | 594 MB + 581 MB (two trees) | **596 MB, one tree** (student is a symlink) |
| `apps/*/dist*` | 1.2 GB + 0.7 GB + … | 0 → `dist` recreated by the final production build (≈ 1.2 GB) |
| `qa-screenshots/` | 82 MB | gone |
| `scripts/qa/**/_*.mjs` probes | 93 | **41** (each referenced by a script, README or gate) |
| `result/` | 1.1 GB · 20 APK/AAB (V17–V25) | unchanged until stage B |

Post-cleanup validation (`FORCE=1 scripts/qa/v26/final.sh`, every step from the cleaned tree): REPORT §349.

### Stage B (applied 2026-10-28 07:00, after the post-cleanup validation and the Android builds)

`cleanup.py b --apply` — **72 paths, 2,421 MB**: the 18 superseded native artifacts (V17–V25 APK/AAB copies) and the V22
archive in `result/`, the stale V23 `BUILD_INFO.json`, every non-final log in `completion/logs/` (run logs, re-run logs,
perf build logs, capture logs), the V26 scratch folder, the e2e/perf/attribution build directories the validation had
recreated (production `dist` kept), and the one-off chain and re-run scripts. The four scale/bench databases
(`hangyul_univ_scale26`, `_scale`, `_bench`, `_seedcheck`) were dropped (the e2e template and run databases stay — the e2e
runner needs them).

### Stage C (applied 2026-10-28 07:08, after the Android phase)

`cleanup.py c --apply` — **16 paths, 5,774 MB**: the Gradle intermediates under `apps/*-mobile/android/app/{build,.cxx}`
that `expo prebuild` regenerates on every build (the six artifacts live in `result/`), the one-off `post-capture.sh`
whose patch files had been applied and removed, and the V23 emulator smoke and V25 Android scripts superseded by their V26
versions (they pointed at artifacts and log folders removed in stages A/B).

### Final state

| Measure | Before V26 | After stages A–C |
|---|--:|--:|
| Repository excluding `node_modules` / `.venv` | ≈ 13 GB | **3.2 GB** (production `dist` 4 apps ≈ 1.2 GB · media 596 MB · licensed templates 633 MB · `result/` 421 MB · `docs/qa` 193 MB) |
| `docs/qa` | 2.3 GB · 10,204 files | 193 MB · 155 Markdown summaries + cited registries for V3–V25, `v26/` in full |
| `result/` | 1.1 GB · 20 APK/AAB (V17–V25) | **421 MB · 6 V26 artifacts** (3 preview APK, 3 production AAB) + metadata |
| `completion/logs/` | mixed run logs | **16 `*-final.log`** (one per gate) + `chain-final.log` (the phase record) |
| Paths removed, total | — | **10,112 · 15.9 GB**, every one in `FILE_CLEANUP_MANIFEST.txt` with size and category |

Orphan references after the cleanup: scanned every current-state document, script and `package.json` for paths under the
removed trees. What remains are output paths scripts recreate themselves (`qa-screenshots/`, `docs/qa/v19/evidence/…`,
`dist-review`), the cleanup script's own record of the folders it removed, and `docs/qa/v27/USABILITY_RESULTS.md` — the
file the usability protocol says to write when it is run. REPORT §§1–329 cite earlier-pass images and logs that are gone;
those sections are dated records and were not rewritten (§350).
