# Mongolian (mn, Cyrillic) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Temuulen (Тэмүүлэн)**, 21, from Ulaanbaatar. In his third year of an engineering bachelor at a Mongolian university, he is looking at a Korean transfer or language program. He has TOPIK 2, uses the app on an Android phone, and compares costs in tögrög. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. |
| Sample | **416 / 416** strings after fixes (399 before; 17 English fallbacks found and translated). |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `common:tier.STRONG` | "Өндөр боломжтой" ("high chance") reads as admission odds. | "Сайн тохирол" (= `discover.verdict.eligible`). |
| 2 | **Honesty / accuracy** | `student:discover.emptyVerdict.reach` | "Хүрэхэд арай дутуу хөтөлбөр алга — сайн мэдээ" ("no programs slightly out of reach — good news") changes the meaning and adds cheerleading that English does not have ("Nothing here needs extra attention."). | "Энд нэмэлт анхаарал шаардах хөтөлбөр алга." |
| 3 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | "Боломжит тохирол" (Possible match) for the quick-check group **One step away**. | "Нэг алхам дутуу" (matches `quick.possible_*`). |
| 4 | Terminology | `common:tier.NOT_ELIGIBLE` | "Одоогоор…" vs "Хараахан шаардлага хангахгүй" in the student list. | Unified to the student-list wording. |
| 5 | Terminology | `student:compare.tuitionLine` | "улирал" while the compare row says "семестр". | "семестр". |
| 6 | Accuracy (English fallback) | `student:v4.verdictText.eligible/reach/notyet`, `v4.compare.*` (17 keys) | The verdict explanations under each discover group, and the compare page, were in English. | Translated. |

## Checked and kept

- `footer.noGuarantee`, `quick.disclaimer` ("элсэлтийн таамаг биш") and `budget.tuitionNote` ("Hangyul хэзээ ч сургалтын төлбөр хураадаггүй") match English.
- `quick.meetsNone` says "хараахан" (not yet) without adding a promise.
- The needs-grades group (Таны дүн хэрэгтэй) and `confirmEducation.text` say plainly that missing grades are not a verdict.
- `validate-locale.mjs mn` passes.

## Residual risks

- "Улирал" and "семестр" are both used for *semester* across budget and compare. Both are understood in Mongolia; a native reviewer should pick one.
- `tier.COMPETITIVE` (Өрсөлдөхүйц) and `tier.REACH` (Сорилттой) remain on console surfaces only.
- Strings outside the sample were not re-read. mn has no success/dossier/visaroute/concierge/writing files, so those pages show English with the translation notice.
- **A human Mongolian reviewer is still needed.**
