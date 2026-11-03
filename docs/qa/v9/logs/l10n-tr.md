# l10n-tr log (V9)

- 2026-10-10: translated the student journey into Turkish. Twenty chunks (`scripts/i18n/v9-data/tr-1.json` … `tr-20.json`, about 3,750 values), each merged with `v9-merge.mjs`. New namespace files: student, dossier, success, writing, visaroute, concierge, mobile. Then `tr-ident.json` added 10 correct "identical to English" values (Program, Terminal). `v9-todo tr` → 0 missing / 0 identical / 0 stale for web (3,652 keys) and native (4,160 keys).
- Fixed the STATE_MAP drift in the existing strings (in `tr-1.json`): `common:tier.COMPETITIVE` "Rekabetçi eşleşme" → "Olası eşleşme", `common:tier.REACH` "Zorlayıcı" → "Henüz uygun değil". Checked `student:verdict.*`, `common:tier.*`, `start.tier.POSSIBLE` = "Bir adım kaldı", `mobile:v3.quick.tier.*`.
- Plan names translated: Ücretsiz Keşif / Başvuru Desteği / Premium Başarı.
- Review passes (`tr-review.json`, `tr-review2.json`, `tr-review3.json`, 19 values): payee and recipient phrasing ("{{university}} kurumuna"), "olasılık" removed from scholarship labels, plain wording for the not-found title and refund trigger.
- Synthetic review written in `docs/qa/v9/l10n/tr.md` (minimum score 4). Recorded with `v9-coverage.mjs --record-review=tr:4:2026-10-10 tr`.
- Not changed: `tr/marketing.json` still has the "rekabetçi / zorlayıcı" tier wording (outside the student manifest). Flagged as a residual risk.
- Leak check (step 4) left to the coordinator, as the brief says.
