# Uzbek (uz, Latin) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Dilnoza**, 19, from Samarkand. She has finished an academic lyceum, is preparing for TOPIK 3, and wants a bachelor's in Business. She reads Uzbek in Latin script, and her family pays from a fixed budget in so'm. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Repeated patterns were then checked in every locale (see "Cross-locale" below). |
| Sample | **416 / 416** strings after fixes (402 before; 14 English fallbacks in `v4.compare.*` were found and translated). |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `marketing:quick.meetsNone` | "— lekin bu vaqtinchalik" ("but this is temporary") promises more than English "— yet". | Clause removed ("hali" carries "yet"). |
| 2 | **Honesty** | `common:tier.STRONG` | "Kuchli imkoniyat" ("strong chance") sounds like admission odds. English "Strong match" only says the published requirements are met. | "Kuchli moslik" (the same as the student list). |
| 3 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | "Ehtimoliy moslik" (Possible match) for the quick-check group **One step away**. | "Bir qadam qoldi" (matches `quick.possible_*`). |
| 4 | Terminology | `common:tier.NOT_ELIGIBLE` | "Hozircha mos emas" vs "Hali talabga mos emas" in the student list. | Unified to "Hali talabga mos emas". |
| 5 | Naturalness | `student:discover.otherDegree_*` (V8 draft) | "Boshqa daraja darajasidagi" ("at another degree level level"). | "Boshqa taʼlim bosqichidagi". |
| 6 | Tone | `student:discover.subtitle` | "Real kira oladigan" is colloquial and reads like an ad. | "Haqiqatan kira olishingiz mumkin boʻlgan dasturlar". |
| 7 | Accuracy (English fallback) | `student:v4.compare.*` (14 keys) | The compare page showed English. | Translated. |

## Cross-locale (patterns first seen here, fixed everywhere)

`quick.meetsNone` carried the same invented promise in th, km, lo, zh-Hant, it and ar. `quick.tier.POSSIBLE` was "possible
match" in ar, mn, my and ne. "Strong match" read as "strong chance" in ru, mn, my and ne. These are logged in
`docs/qa/v8/logs/localization.md` and fixed in `scripts/i18n/v8-data/review-fixes.json`.

## Checked and kept

- `footer.noGuarantee`, `quick.disclaimer` ("qabul bashorati emas"), `budget.tuitionNote` ("Hangyul hech qachon oʻqish toʻlovini qabul qilmaydi") match English exactly.
- The needs-grades copy says clearly that missing grades are not a verdict ("siz mos emassiz degan gap yoʻq").
- Apostille terms (apostil / legalizatsiya) are correct. Uzbekistan joined the Apostille Convention in 2012, so the wording is right for this persona.
- Uzbek apostrophes use ʻ (U+02BB) consistently, not ASCII quotes.

## Residual risks

- Some status words come from Russian-influenced bureaucratic Uzbek ("Qayta ishlanmoqda", "legalizatsiya"). This is acceptable but stiff.
- "GPAʼingizni" (apostrophe before a suffix on a Latin acronym) is correct but looks unusual. A native reviewer may prefer "GPA koʻrsatkichingizni".
- Only the core-flow sample was reviewed. uz has no success/dossier/visaroute/concierge/writing files, so those pages fall back to English with the translation notice.
- **A human Uzbek reviewer is still needed.**
