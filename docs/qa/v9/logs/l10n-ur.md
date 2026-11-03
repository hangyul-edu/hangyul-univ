# l10n-ur log (V9)

- 2026-10-10: translated the student journey into Urdu (Pakistan). Twelve chunks (`scripts/i18n/v9-data/ur-1.json` … `ur-12.json`, 3,742 keys), each validated by `v9-merge.mjs` and merged. New namespace files: student, dossier, success, writing, visaroute, concierge, mobile. `v9-todo ur` → 0 missing for web (3,652 keys) and native (4,160 keys).
- Fixed the STATE_MAP drift in existing strings: `common:tier.COMPETITIVE` (مسابقتی میچ → ممکنہ میچ) and `common:tier.REACH` (مشکل ہدف → ابھی اہل نہیں). Checked `student:verdict.COMPETITIVE` = «ممکنہ میچ», `student:verdict.REACH` = «ابھی اہل نہیں», `student:start.tier.POSSIBLE` = «بس ایک قدم دور».
- Review revisions in `ur-13.json` (13 keys).
- Synthetic review written in `docs/qa/v9/l10n/ur.md` (minimum score 4). Recorded with `v9-coverage.mjs --record-review=ur:4:2026-10-10 ur`.
- Leak check (step 4) left to the coordinator, as the brief says.
