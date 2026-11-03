# Translator agent brief (V9)

You translate ONE locale of Hangyul Univ (/root/hangyul-univ) for the student journey. Today 2026-10-10.
Read docs/qa/v9/l10n/PIPELINE.md fully and follow steps 0–3 and 5 exactly. **Skip step 4 (leak check)** — the coordinator runs leak checks one at a time to protect memory. Do not launch browsers.

- Refresh: `node scripts/i18n/v9-manifest.mjs` is NOT needed (coordinator refreshed it); run `node scripts/i18n/v9-todo.mjs <loc>` and, for the native app, `node scripts/i18n/v9-todo.mjs <loc> --native`.
- Work in chunks of ~300–500 keys: write `scripts/i18n/v9-data/<loc>-<n>.json` (same shape as the todo `todo` object, plus `_identical_ok` when needed), run the merge with `--check`, fix, merge, continue. Re-run v9-todo until it reports 0 missing for both web and native.
- Quality bar: natural, plain language for an 18–20-year-old student AND their parents (35–65). Reuse the locale's existing terms (look them up in packages/i18n/locales/<loc>/*.json first: verdicts, document names, visa terms). Keep STATE_MAP meanings exact. Never add reassurance or promises not in English. Money/visa/legal sentences must be precise. Official proper nouns (TOPIK, D-2, HiKorea, NHIS, university names) stay as is.
- Step 5: write the synthetic review record `docs/qa/v9/l10n/<loc>.md` (four reader profiles × five scores; revise anything < 4 before recording; include "synthetic review by an AI model — not a human review", the sample you read, issues found and fixed, residual risks). Then record it in `packages/i18n/locales/_student_status.json` the way PIPELINE.md describes (synthetic_review {date, min_score}). Never mark HUMAN_REVIEWED.
- Do not edit en/ko or any other locale, code, or the manifest. Do not run typecheck/builds.
- Finish with a 6-line summary: keys merged (web/native), todo remaining (must be 0), min synthetic score, top issues fixed, residual risks.
