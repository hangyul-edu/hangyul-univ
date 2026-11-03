# l10n-kk log (V9)

- 2026-10-10: translated the student journey into Kazakh (Cyrillic). Thirteen chunks (`scripts/i18n/v9-data/kk-1.json` … `kk-13.json`, 3,740 values), each run with `v9-merge.mjs --check` and then merged. New namespace files: student, dossier, success, writing, visaroute, concierge, mobile. `v9-todo kk` → 0 missing / 0 identical / 0 stale for web (3,652 keys) and native (4,160 keys).
- Fixed the STATE_MAP drift in the existing strings (`kk-tier.json`): `common:tier.COMPETITIVE` «Бәсекеге қабілетті» → «Ықтимал сәйкестік», `common:tier.REACH` «Қиындау мақсат» → «Әзірге сәйкес емес». Checked `student:verdict.*`, `common:tier.*` and `start.tier.POSSIBLE` = «Бір қадам қалды».
- Review pass (`kk-review.json`, 37 values): Kazakh accusative/partitive fixes around placeholders. `v9.routes.korean.count_*` changed from admission wording to eligibility wording.
- Synthetic review written in `docs/qa/v9/l10n/kk.md` (minimum score 4). Recorded with `v9-coverage.mjs --record-review=kk:4:2026-10-10 kk`.
- Not changed: `kk/marketing.json` still has "competitive / reach" wording, because the English marketing source has it too. Flagged as a residual risk.
- Leak check (step 4) left to the coordinator, as the brief says.
