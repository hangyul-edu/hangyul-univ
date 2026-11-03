# Thai (th) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below — and for Thai that is the **common and
> marketing** namespaces only.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` (common + marketing; see the scope limit below) |
| Persona | **Ploy (พลอย)**, 18, from Chiang Mai, in Mathayom 6. A K-culture fan with TOPIK 3, she wants a Korean language program and then a media bachelor's. She first meets Hangyul on the marketing site and in the quick check, on her phone. |
| Method | Shared method in [README](README.md): the sample printed next to English and read in full against the six-point rubric. |
| Sample | **218 / 218** strings in scope after fixes: common core-flow keys and marketing hero / quick check / `v8`. |

## Scope limit — important

**th has no `student.json`.** Every student-app screen (discover, budget, compare, nav) shows English with the
translation notice. Those 198 sampled student strings were not reviewed because they do not exist in Thai. The
`SYNTHETIC_REVIEWED` status must not be read as "the Thai student app is reviewed". Creating a Thai student namespace is
listed as a gap in `docs/I18N.md`.

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `marketing:quick.meetsNone` | "— แต่ยังไม่ใช่ตอนจบ" ("— but it's not the end") adds a promise that English "— yet" does not make. Found in the cross-locale sweep. | Clause removed ("ยังไม่ผ่าน" already says "not yet"). |
| 2 | **Honesty** | `common:i18n.machine/partial/useEnglish` | The machine-translation notice was in English, so a Thai reader would not see the warning that most of the app is English. | Translated. |
| 3 | Honesty (minor) | `common:matchReason.SCHOLARSHIP_CANDIDATE` | "มีโอกาสได้รับทุน" ("has a chance to get the scholarship") leans towards a promise. | "อยู่ในข่ายพิจารณาทุน" ("within the scholarship's consideration range"). |

## Checked and kept

- `footer.noGuarantee` ("…Hangyul ไม่รับประกันการรับเข้า เว้นแต่…") and `quick.disclaimer` ("ไม่ใช่การทำนายผลการรับเข้า") match English.
- The quick-check tiers follow STATE_MAP: เหมาะสมมาก / อีกเพียงก้าวเดียว / ยังไม่มีคุณสมบัติ. `tier.NOT_ELIGIBLE` matches `quick.tier.NOT_YET`.
- The V8 marketing example uses the **Vietnamese** apostille case. That is correct as an example: Thailand's apostille accession takes effect only on 2027-02-28, and the example does not claim it applies to Thai documents.
- The 3 other untranslated keys are `_one` plural forms that Thai never uses.

## Residual risks

- **The student app is English for Thai users** (see the scope limit).
- common is 84 % translated. Missing keys are mostly console and notification strings outside the student core flow.
- **A human Thai reviewer is still needed.**
