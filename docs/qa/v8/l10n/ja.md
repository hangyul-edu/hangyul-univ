# Japanese (ja) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Sato Haruka (佐藤遥)**, 23, from Fukuoka. She finished a Japanese university degree and wants a Korean master's in Korean studies. She has TOPIK 4, reads every cost and condition carefully, and expects polite ですます copy with no hype. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Term frequency counted across ja student strings (プログラム 62× vs 学科 7×). |
| Sample | **416 / 416** strings after fixes. **Before the review, only 309 / 416 were translated.** The budget page, half of discover, the compare superlatives and the machine-translation notice itself showed English. |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `common:i18n.machine/partial/useEnglish` | The notice that tells a user "this is a machine draft, partly English" was itself in English, so a Japanese reader would not understand the warning. | Translated. |
| 2 | **Honesty** | `common:tier.STRONG`, `student:discover.verdict.eligible` | **有力** is the word Japanese juku and agencies use for a *likely* admission (有力校). English "Strong match" only says the published requirements are met. | → **高い適合** (already used by the quick check). |
| 3 | Terminology (STATE_MAP) | `student:discover.verdict.notyet`, `marketing:quick.tier.NOT_YET` | "Not eligible yet" was rendered three ways: まだ条件不足 / まだ対象外 / まだ出願資格なし. | Unified to **まだ出願資格なし** (`common:tier.NOT_ELIGIBLE`). |
| 4 | Terminology | V8 student keys (`confirmEducation`, `emptyVerdict.check`, `v8.compare.open`, `v4.verdictText.check`, `more.hint.universities`) | My V8 drafts said 学科 (a university department) while the app says プログラム. | → プログラム. |
| 5 | Accuracy (English fallback) | `student:budget.*` (54 keys), `discover.*` (17), `compare.best.*`/`bestTag.*`/`tuitionLine`/`same` (13), `v4.compare.*` (14) | English on the core screens. | Translated, using the same terms as the rest of the app: 学費, 出願料, 寮費, 概算, 出典, 渡航前に必要な資金. |
| 6 | Accuracy (bug, outside sample) | `mobile:student.nextAction.COMPLETE_PROFILE` | Still had `{{percent}}` after English dropped it (`validate-locale` error). Same bug in ru and zh-Hant. | Placeholder removed in all three. |

## Checked and kept

- `footer.noGuarantee` ("…Hangyul は合格を保証しません"), `quick.disclaimer` ("合否の予測ではありません") and the new `budget.tuitionNote` ("Hangyul が学費を受け取ることはありません") match English, with no stronger claim.
- `quick.meetsNone` says "まだ満たしていません" and adds no promise.
- The needs-grades copy ("出願資格がないという意味ではありません") keeps missing data separate from a verdict.
- `validate-locale.mjs ja` passes (it reported the mobile error before fix #6).

## Residual risks

- ja is still only partly translated outside the sample: common 85 %, student 71 %, mobile 40 %, and no success / dossier / visaroute / concierge / writing files. Those screens show English with the (now Japanese) translation notice.
- Register: most copy is ですます, but some labels are plain form (〜を削除, 〜を比較). That is normal in Japanese UI.
- **A human Japanese reviewer is still needed.**
