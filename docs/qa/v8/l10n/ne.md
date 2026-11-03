# Nepali (ne) — V8 synthetic review record

> **Synthetic review by an AI model — not a human review.** No native-speaker or professional linguist has signed off on
> this locale. The status `SYNTHETIC_REVIEWED` means only what is written below.

| | |
|---|---|
| Date | 2026-10-09 |
| Reviewer | AI model (Claude), V8 localization workstream |
| Status after review | `SYNTHETIC_REVIEWED` |
| Persona | **Sujan**, 20, from Pokhara. He has finished +2 (NEB) in Management with a 3.1 GPA, studies Korean at a language institute in Kathmandu, and is preparing for TOPIK 2. His family will take a loan for the first year, so the budget and "cash before arrival" numbers matter most to him. |
| Method | Shared method in [README](README.md): the core-flow sample printed next to English and read in full against the six-point rubric. Honesty-critical strings re-read in full (the side-by-side dump truncates long lines). Term frequency checked for "saved" and "marks". |
| Sample | **416 / 416** strings in scope. |

## Issues found and fixed

| # | Rubric | Key | Problem | Fix |
|---|---|---|---|---|
| 1 | **Honesty** | `common:tier.STRONG` | "बलियो सम्भावना" ("strong possibility") reads as a chance of admission. | "राम्रो मिलान" (= `discover.verdict.eligible`). |
| 2 | Terminology (STATE_MAP) | `marketing:quick.tier.POSSIBLE` | "सम्भावित मिलान" (Possible match) for the quick-check group **One step away**. Sujan would read it as the student-app group with the same name. | "एक चरण मात्र बाँकी" (matches `quick.possible_*`). |
| 3 | Terminology | `common:tier.NOT_ELIGIBLE` | "अहिले योग्य छैन" vs "अझै योग्य छैन" in the student list and quick check. | "अझै योग्य छैन". |
| 4 | Terminology / accuracy | `student:discover.saved`, `budget.fromShortlist`, `budget.emptyText`, `v4.compare.fromSaved_*`, `v4.compare.savedCta_*` | "Saved" was सुरक्षित in some places — a word that also means *safe / secure*, so "सुरक्षित कार्यक्रम" can read as "safe programs" — and सेभ गरिएका in others (the tab). | सेभ गरिएका / सेभ गर्नुहोस् everywhere in the sample. |

## Checked and kept

- `footer.noGuarantee` ("…Hangyul ले भर्नाको ग्यारेन्टी गर्दैन"), `quick.disclaimer` ("भर्नाको भविष्यवाणी होइन") and `budget.tuitionNote` ("Hangyul ले कहिल्यै शिक्षण शुल्क उठाउँदैन") match English.
- `quick.meetsNone` ends "— अहिलेका लागि" (= "for now"). That carries English "— yet" without promising more.
- Marks: अंक (22×) is the everyday Nepali word, and the V8 "needs your grades" copy uses it. ग्रेड appears where English says "grade".
- The V8 keys and the needs-grades explanation say missing data is not a verdict.

## Residual risks

- सुरक्षित still appears 10 times in student.json outside the sample. Some of these legitimately mean "secure"; the rest should be checked by a native reviewer.
- Numerals: marketing uses Devanagari digits in places (३० सेकेन्ड) while interpolated numbers render as Latin digits. This is common on Nepali websites but inconsistent.
- ne has full student coverage and the V5 namespaces (success, dossier, visaroute, concierge, writing). Those were not re-read in this pass.
- **A human Nepali reviewer is still needed.**
