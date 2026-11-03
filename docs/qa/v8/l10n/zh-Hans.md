# Chinese, Simplified (zh-Hans) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **王思雨 (Wang Siyu)**, 22, from Qingdao. She has finished a 本科 in Chinese and is considering a Korean master's in media. She has TOPIK 5 and compares tuition and scholarship numbers carefully; she distrusts agency marketing that implies guaranteed admission. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Term frequency counted across zh-Hans namespaces (专业 123× vs 项目 13× in student). |
| Sample | **416 / 416** strings in scope after the fixes (402 were translated before; the 14 English fallbacks found are now translated). |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `common:tier.STRONG` | **稳妥** ("safe bet") is how Chinese agencies describe a near-certain admission. English "Strong match" only says the published requirements are met. | → 高度匹配 (the same word the student list and quick check already use). Sibling fix in zh-Hant: 穩當 → 高度符合 (zh-Hant stays MACHINE_DRAFT). |
| 2 | **Honesty** | `marketing:quick.meetsNone` | "— 但这只是暂时的" ("but this is only temporary") promises more than English "— yet". | Clause removed; 暂时还不 already says "not yet". |
| 3 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | In the quick check this is **One step away**. It had been rendered 可能匹配 (Possible match), which is a different group in the app. | → 只差一步 (matches `quick.possible_*` "只差一步"). |
| 4 | Terminology | 9 student V8 keys (`confirmEducation.title_*`, `otherDegree_*`, `emptyVerdict.check`, `v8.compare.open/budget_other`, `v4.verdictText.check`, `more.hint.universities/compare`) | V8 drafts said 项目 while the student app says 专业 (123×). | → 专业 (in `scripts/i18n/v8-data/student-a.json`, re-merged). |
| 5 | Accuracy (English fallback) | `student:v4.compare.*` (14 keys) | The compare page showed English for its subtitle, missing-requirements row, scholarship row and saved-programs CTA. | Translated (`review-fixes.json`). |

## Checked and kept

- `footer.noGuarantee` (除非合作项目的书面条件另有规定，Hangyul 不保证录取), `quick.disclaimer` (不是录取预测), `budget.tuitionNote` (Hangyul 从不代收学费) match English exactly.
- Legalization terms are correct for mainland applicants: 海牙认证 (apostille) / 领事认证; hukou wording is in the visa task copy.
- The "needs grades" group (需要你的成绩) and its explanation say clearly that missing data is not a verdict.
- `validate-locale.mjs zh-Hans` passes.

## Residual risks

- Marketing copy uses both 专业 and 项目 (53 / 34). In marketing 项目 often means "programme" in the general sense, which reads naturally, so it was not changed.
- `tier.REACH` 冲刺 and `tier.COMPETITIVE` 有竞争力 remain on console surfaces. They are standard Chinese admissions jargon and not shown in the student discover flow.
- Other student namespaces outside the sample were not re-read (documents, applications, visa, dossier); zh-Hans has no success/visaroute/concierge files, so those pages fall back to English with the translation notice.
- **A human Chinese reviewer is still needed.**
