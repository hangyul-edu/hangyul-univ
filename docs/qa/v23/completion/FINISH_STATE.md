# V23 completion state

Resume rule: continue from the first step that is not DONE. Do not rerun a DONE gate unless the source it covers changed.
Heavy work is serialized (one browser suite, one Gradle build, one emulator at a time). Logs: `docs/qa/v23/completion/logs/`.

| # | step | state | evidence |
|---|---|---|---|
| 0 | Recover state (§0, §244–§267, memory) | DONE 2026-10-25 | — |
| 0a | Environment: 5 GB VM shared with another project (~2.3 GB python); EAS `whoami` → Not logged in; no EXPO_TOKEN | DONE | — |
| 1 | Audits §268–§276 appended to REPORT | DONE | REPORT §268–§276 |
| 1a | P1 fail-closed HG_ENV (config + runners + test_v23_environment.py 27 pass with v21b) | DONE | pytest |
| 2 | Social footer (source + live verified) | DONE | footer 1440/390 screenshots, 5×40px, 0 console errors; social.json snapshot |
| 3 | Copy cleanup (free account, directory subtitle) | DONE | 3 rendered keys ×33 rewritten, 5 dead keys deleted, subtitle+source deleted (all locales) |
| 4 | Discovery redesign + tier E identity + coverage CSV | DONE | +30 films (158), posters probed, CSV 425 rows dated; qa:v23 DISCOVERY green |
| 5 | Test login (web ×3) | DONE | student+agency+university one-click → home, 0 page errors; white login covers |
| 6 | Paid-state bypass verified | DONE | qa:v23 api (pytest v21b + v23_environment) |
| 7 | Test-looking UI removal | DONE | P3 Toss processor + true card text (verified vs PayWithCardIn/key-in body), P4 retention ko/en, P5 housing ×19, P6 appt status, prompt label, CSV, campus role; S3 Settings errors; S5 HG- ref; raw err.message fallback |
| 8 | Console fixes (agency/university) | DONE | agency A1–A6; university U1–U8 (+422 on unknown status), test_v23_university.py 11 pass, vitest uni 72 + agency 50; funnel label overlap fixed |
| 9 | Native parity + test login | DONE (emulator smoke done in step 13: 12/12) | visible test login (Metro-folded require), prod export: 0 personas/0 test-login strings, QA export positive control 9/1/1; V22 tangerine console tokens; agency tabs 오늘·학생·지원·서류·메시지·설정, role gate removed; university tabs 지원자·메시지·현황·설정, read-only branch removed; student team identity ×33, housing/arrival links; eas.json ×3, signing+QA-cleartext plugins |
| 10 | qa:v23 gate | DONE (static 51/0, rendered 22/0, api 7/1→CSV fixed, rerun in final sweep) | logs/qa-v23-*.log |
| 11 | Feature matrix CSV | DONE (56: 51 COMPLETE, 4 BLOCKED_EXTERNAL, 1 N/A — every COMPLETE row's evidence green) | docs/qa/v23/FEATURE_COMPLETENESS.csv |
| 12 | Serialized release suites | DONE (see R1–R7 + final rows) | test-release --only segments, logs/release-*.log |
| 13 | Android builds (3 apps) + smoke | DONE — 6 artifacts rebuilt after the last source change; smoke 12/12 | result/*-mobile/android, logs/android-smoke-final*.log |
| 14 | iOS blocker doc | DONE (EXTERNAL) | docs/qa/v23/IOS_BUILD_BLOCKER.md |
| 15 | REPORT §277–§289 + §0 | DONE | docs/REPORT.md |

| L | Localization: priority keys 33/33 (machine, SYNTHETIC) + plan names + 38 cognate fixes | DONE | scripts/i18n/v23/tx/*, qa:v23 LOCALIZATION |
| C | Full crawl 390/768/1440(+1728): 270 route×width checks, 304 links; 3 dead links found → fixed (seed /writing → /essays; student /writing, agency student-path redirects) | DONE (re-run in final sweep) | logs/crawl-full-1.log |
| R1 | typecheck · lint:api | DONE 0/0 | logs/release-seg1.log |
| R2 | test:api 503 passed | DONE | logs/release-seg2.log |
| R3 | test:web 276 passed / 22 skipped (env-gated live smoke); native integration test fixed (one phone number per run) | DONE | logs/test-web.log |
| R4 | e2e 71 passed / 3 skipped / 0 failed (after fixing 2 test defects: privacy text assertion, Nepali number generator; v13-hierarchy #4 flake passes alone) | DONE | logs/release-e2e-2.log |
| R5 | qa:v12–v18 pass; qa:v19 1 fail = Android artifacts older than source (expected until step 13) | PARTIAL | logs/release-qa12-19.log |
| R6 | qa:v20 73/0 (pages), v20-buttons pass, v21 126/0 + security 0, v22 fixed (processor check scoped to overseas block; Toss basis 제26조) | DONE (v22 rerun in final sweep) | logs/release-qa20-22.log |
| R7 | error-matrix@1440, @390, journey:ko, journey:vi | DONE 4/4 | logs/release-errm-journey.log |
| A1 | student APK (preview, test login ON, QA cleartext) + AAB (production, test login OFF, cleartext false) built from V23 source, QA-signed | DONE | result/student-mobile/android, logs/android-student-* |
| A2 | agency APK + AAB (V23 source; APK has test login, AAB 0 hits) | DONE | result/agency-mobile/android |
| F | Final: qa:v19 67/0 · qa:v22 174/0 (2 skips = provider credentials) · qa:v23 static 51/0 (+ api/rendered 30/0 earlier, built 4/0, native 3/0) · crawl 0 findings | DONE | logs/final-* |
