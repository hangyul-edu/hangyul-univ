# Burmese (my) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Thiri (သီရိ)**, 18, from Mandalay. She passed matriculation with distinctions, has studied Korean for a year (TOPIK 2), and wants a Korean language program followed by a bachelor's. She reads Burmese in Unicode on a mid-range Android phone, and her parents need to understand the costs and the no-guarantee wording. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Honesty-critical strings re-read in full. Earlier rendering QA for my (V5 `scripts/qa/leak-check.mjs`, 0 leaks) is relied on for font and Unicode rendering. |
| Sample | **414 / 416** strings (the 2 untranslated are `_one` plural keys that Burmese never uses — i18next reads only `_other` for my). |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `common:tier.STRONG` | "အခွင့်အလမ်းကောင်း" ("good opportunity / good chance") reads as admission odds. | "အလွန် ကိုက်ညီ" (= `discover.verdict.eligible`). |
| 2 | **Honesty** | `marketing:quick.meetsNone` | "— ယခုအချိန်တွင်သာ" ("— *only* at this time") implies it will change, which is more than English "— yet". | Ends with "မကိုက်ညီသေးပါ" (သေး = yet). |
| 3 | **Honesty / accuracy** | `student:discover.emptyVerdict.reach` | "…မရှိပါ — သတင်းကောင်းပါ" ("none slightly short — good news") changes the meaning and adds cheerleading. | "ထပ်မံ ဂရုစိုက်ရန် လိုသည့် ပရိုဂရမ် မရှိပါ။" (= "Nothing here needs extra attention."). |
| 4 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | "ကိုက်ညီနိုင်" (Possible match) for the quick-check group **One step away**. | "တစ်ဆင့်သာ လိုတော့သည်" (matches `quick.possible_*`). |
| 5 | Terminology | `marketing:v8.work.match.l3` (V8 draft) | "Apostille" in Latin script, while the app writes အပိုစတီးလ်. | "ဘွဲ့လက်မှတ်တွင် အပိုစတီးလ်". |

## Checked and kept

- `footer.noGuarantee` ("…Hangyul သည် ဝင်ခွင့်ကို အာမမခံပါ"), `quick.disclaimer` ("ဝင်ခွင့် ခန့်မှန်းချက် မဟုတ်ပါ") and `budget.tuitionNote` ("Hangyul သည် ကျူရှင်ခကို ဘယ်တော့မှ မကောက်ခံပါ") match English.
- The needs-grades group and `confirmEducation.text` ("သင် အရည်အချင်းမပြည့်မီဟု မဆိုလိုပါ") say clearly that missing data is not a verdict.
- `validate-locale.mjs my` passes.

## Residual risks

- **Truncation:** Burmese strings are long, often 1.5–2× English. Compare tray labels, verdict chips and budget column heads were judged acceptable as text, but a 390 px screenshot pass in my is recommended. That is not part of this review; the V8 RTL pass covers only ar/ur/fa/he.
- "Semester" is rendered as စာသင်နှစ်ဝက် (half academic year). This is accurate, but a native reviewer may prefer စာသင်ကာလ.
- my has full student coverage plus V5 namespaces, which were not re-read here.
- **A human Burmese reviewer is still needed.**
