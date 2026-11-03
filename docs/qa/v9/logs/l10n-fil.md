# l10n-fil log (V9)

- 2026-10-10: translated the student journey into Filipino. Ten chunks plus one for the identical/brand values (`scripts/i18n/v9-data/fil-1.json` … `fil-11.json`). Each chunk was run with `v9-merge.mjs --check` and then merged. `v9-todo fil` → 0 missing for web (3,652 keys) and native (4,160 keys).
- Fixed the STATE_MAP drift in the existing strings: `common:tier.COMPETITIVE` ("Competitive na tugma" → "Posibleng tugma") and `common:tier.REACH` ("Reach" → "Hindi pa kwalipikado"). Checked `student:verdict.*`, `discover.verdict.*` and `start.tier.POSSIBLE` ("Isang hakbang na lang", not the Possible-match term).
- Review revisions in `fil-review.json`: notify word order, WITHDRAWN → "Binawi", matrikula → tuition.
- Synthetic review written in `docs/qa/v9/l10n/fil.md` (minimum score 4). Recorded with `v9-coverage.mjs --record-review=fil:4:2026-10-10 fil`.
- Leak check (step 4) left to the coordinator, as the brief says.
