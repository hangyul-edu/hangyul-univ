# Vietnamese (vi) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Lan**, 18, from Hải Phòng. She has finished high school with TOPIK 3, is comparing Business programs in Busan and Daegu on her phone, and her parents read the budget page with her. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Term frequency checked across vi namespaces. |
| Sample | **414 / 416** strings in scope (the 2 not translated are `_one` plural keys that Vietnamese never uses — i18next only reads `_other` for vi). |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `marketing:quick.meetsNone` | "…— nhưng đó chỉ là tạm thời" ("but that is only temporary") promises more than English "— yet". | Dropped the clause; "Hiện bạn chưa đáp ứng…" already carries "not yet". |
| 2 | **Honesty / accuracy** | `common:matchReason.NATIONALITY_RESTRICTED` | "Chưa mở cho…" ("not open *yet*") suggests the program will open to her nationality. English says it is not open. | "Không dành cho ứng viên mang quốc tịch của bạn". |
| 3 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | In the quick check this tier means **One step away**. It had been rendered "Có thể phù hợp" (Possible match), which is a different group in the app. | "Chỉ còn một bước". |
| 4 | Terminology | `common:tier.STRONG` vs `student:discover.verdict.eligible` | "Phù hợp cao" vs "Rất phù hợp" for the same group. | Both "Rất phù hợp". |
| 5 | Accuracy (ambiguity) | `student:discover.oneGap`, `discover.summary` | "điểm" ("point") next to grades and scores reads as "missing one score point". | "Thiếu một yêu cầu" / "bổ sung một yêu cầu còn thiếu". |
| 6 | Terminology | `student:compare.row.fee` | "Phí nộp hồ sơ" vs "Phí xét tuyển" in budget. | "Phí xét tuyển" (the term on Vietnamese admission notices). |
| 7 | Terminology | `student:v8.budget.fee.text.DUE/NONE` | "tư vấn viên" while everything else (role names, budget notes, marketing) says "chuyên viên tư vấn". | "chuyên viên tư vấn". |
| 8 | Naturalness | `student:v8.compare.noWinner` | "không chọn ra người thắng" ("no *person* wins") is odd for programs. | "không chọn chương trình “thắng cuộc”". |
| 9 | Naturalness | `marketing:v8.work.visa.title` | Calqued sentence structure. | "Visa của bạn: danh sách việc cần làm theo cơ quan lãnh sự của bạn". |

## Checked and kept

- The "needs grades" copy (`discover.verdict.check`, `confirmEducation.text`, `v4.verdictText.check`) says plainly that missing grades are not a verdict.
- `footer.noGuarantee`, `quick.disclaimer` ("không phải dự đoán khả năng trúng tuyển"), `budget.tuitionNote` ("Hangyul không bao giờ thu học phí") match English exactly.
- Apostille and "hợp pháp hóa" are used correctly; Vietnam's apostille accession (in force 2026-09-11) makes "Apostille cho bằng tốt nghiệp" accurate.
- Placeholders and plurals: `validate-locale.mjs vi` passes.

## Residual risks

- "Hồ sơ" covers *application* (hồ sơ ứng tuyển), *profile* (hồ sơ cá nhân) and *dossier*. This is normal Vietnamese, but on screens that show more than one of them a native reviewer should check that the meaning stays clear.
- `common:tier.COMPETITIVE` ("Cạnh tranh") and `tier.REACH` ("Thử thách") are still used by the consoles. Student surfaces use the STATE_MAP words.
- Only the core-flow sample was reviewed; documents, visa route, concierge and writing were not re-read in this pass.
- **A human Vietnamese reviewer is still needed** before this locale could ever be called human-reviewed.
