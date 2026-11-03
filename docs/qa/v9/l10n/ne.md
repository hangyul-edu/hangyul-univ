# Nepali (ne) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ne`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent — the coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/ne-1.json` (302 todo keys), `ne-2.json` (3 terminology fixes), `ne-3.json` (1 placeholder-only key),
  `ne-4.json` (8 revisions from this review).
- Result: `v9-todo ne` → web 3645 keys, 0 missing / identical / stale; `--native` → 4153 keys, 0 missing.
- Identical to English on purpose (`_identical_ok`): `common:degreeShort.COMBINED` (MS–PhD), `common:degreeShort.DOCTORATE` (PhD),
  `common:essayType.CV` (CV), `student:university.campus.google` (Google Maps).

## Sample read

All 307 todo keys, read in screen context:

- Family link (`student:v9.family.*`) and the page the sponsor sees (`student:v9.sponsor.*`): parents are the readers here.
- Money (`student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `concierge:status.REFUND.*`).
- Routes without a test (`student:v9.routes.*`), announced rule changes (`student:v9.announced.*`), visa caveats (`student:v9.visa.*`).
- Who can see documents (`dossier:v9.who.*`), application status notifications (`common:notify.application.*`).
- Existing verdict strings (`student:verdict.*`, `student:discover.verdict.*`), compared against docs/STATE_MAP.md.

No screenshots: browsers are off for translator agents. The coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 4 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 4 / 4 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 3 / 3 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Why the first scores were below 4: C and D's trust score was 3 because two existing verdicts were mislabelled (see below), and a "Possible
match" shown as "Strong match" misleads the person who pays. D's comprehension and naturalness were 3 because of a few literal
calques ("दृश्य" for "view", "सबैभन्दा सानो परीक्षा चरण", "एकरूप बनाइएको GPA", "{{when}} अवतरण").

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | राम्रो मिलान → सम्भावित मिलान | It used the *Strong match* wording for *Possible match*. This breaks STATE_MAP and overstates the result. |
| `student:verdict.REACH` | सम्भावित मिलान → अझै योग्य छैन | English is "Not eligible yet". The old string read as "possible match". |
| `student:scholarships.group.NOT_ELIGIBLE` | अहिले योग्य छैन → अझै योग्य छैन | Uses the same term as the other *Not eligible yet* strings. |
| `student:v9.family.nav`, `.title` | परिवारका लागि दृश्य → परिवारका लागि पृष्ठ | "दृश्य" (scene/view) reads oddly to older parents. "पृष्ठ" (page) is plain. |
| `student:v9.routes.step.title` | सबैभन्दा सानो परीक्षा चरण → सबैभन्दा नजिकको परीक्षा लक्ष्य | The literal "smallest step" made no sense. The new wording means "nearest test goal". |
| `student:v9.sponsor.landing` | {{when}} अवतरण → विमान अवतरण: {{when}} | The bare word "अवतरण" was unclear without "flight". |
| `student:v9.money.when.BEFORE_VISA` | भिसाअघि → भिसा लिनुअघि | Natural phrasing. |
| `student:v9.refund.status.WAITING_STUDENT`, `concierge:status.REFUND.WAITING_STUDENT` | तपाईंको जवाफ पर्खिँदै → तपाईंलाई पर्खिँदै | The old string added "your reply", which the English doesn't say. The student may need to act, not only reply. |
| `common:v9.l10n.rule.gpa_percent_gte` | एकरूप बनाइएको GPA → प्रतिशतमा बदलिएको GPA | "Normalized" given as "converted to a percentage", which is what the number shows. |

## Terminology (reused from existing ne strings)

| English | Nepali |
|---|---|
| Strong match | राम्रो मिलान |
| Possible match | सम्भावित मिलान |
| Not eligible yet (incl. one step away) | अझै योग्य छैन |
| Needs your grades | तपाईंको अंक चाहिन्छ |
| Your counselor | तपाईंको परामर्शदाता (honorific verbs: गर्नुहुन्छ) |
| Tuition | शिक्षण शुल्क |
| Admission letter / certificate | भर्ना पत्र |
| Residence card | विदेशी दर्ता कार्ड |
| Immigration office | अध्यागमन कार्यालय |
| Embassy | दूतावास |
| Family relationship certificate | पारिवारिक नाता प्रमाणपत्र |
| Bank statement | बैंक विवरण |
| TB certificate / test | क्षयरोग प्रमाणपत्र / जाँच |
| Dormitory | छात्रावास |
| Sponsor | प्रायोजक |
| Refund | फिर्ता (पैसा फिर्ता) |
| Application statuses | identical to `common:appStatus.*` |

Kept in Latin script: Hangyul, TOPIK, KIIP, IELTS, TOEFL iBT, GPA, NHIS, D-2/D-4 (placeholders), VFS Global, Korea Visa Application
Center, visa.go.kr, e-Form, SOP (in brackets).

## Money / visa / legal precision checks

- "Money you must show (not pay)": translated as "देखाउनुपर्ने पैसा (तिर्ने होइन)". `v9.funds.sub` says plainly that the money is
  not paid to anyone and must really belong to the student or family.
- `v9.funds.genuine`: depositing money only to get a certificate is translated as "गैरकानुनी" (against the law). The wording is not softened.
- `v9.guard.text` and `v9.refund.*`: pay only to the university, in the student's name. Refunds go only to the student's own account.
  The warning about money changers and agents is kept in full.
- `v9.announced.*` and `v9.visa.caveat.SCHEDULED_CHANGE`: every string says the change is "not in force yet" (अझै लागू छैन). Each
  rule uses the conditional form (हुनेछ / पर्नेछैन), so nothing reads as already in force.
- `v9.routes.notOffer`: "not an offer and not a prediction — universities decide" is kept word for word. No reassurance was added.

## Residual risks (for a native human reviewer)

1. `v9.funds.longer_*` / `v9.funds.waived`: the Korean university tiers "consulting" and "excellent" are given as ('परामर्श') and
   ('उत्कृष्ट'). A parent could confuse "परामर्श" with the counselor (परामर्शदाता). Check whether to name the tier
   differently or add the Korean term.
2. Plural "one" forms usually match "other" because Nepali nouns don't change after a number. Check that "{{count}} दिन" reads well when
   the count is 1.
3. `v9.routes.korean.count_*` has no number in the string (the UI shows it next to the text). Check how it reads on screen.
4. Older strings this pass did not change still mix "बैंक विवरण" and "बैंक स्टेटमेन्ट" for the bank statement.
   Pick one term.
5. Dates come from the UI formatter. Check that numbers are in Devanagari and the month names are Nepali on the family/sponsor pages.
6. The leak check and screen-level reading have not run yet (coordinator step 4).
