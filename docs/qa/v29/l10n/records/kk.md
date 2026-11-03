# V29 service contract: Kazakh (kk) review record

Job: `scripts/i18n/v28/jobs-v29/kk.json` (158 keys: common 99, marketing 4, student 42, mobile 13). Output: `scripts/i18n/v28/tx-v29/kk.json`.
Counts: 158 newly translated, 0 kept verbatim (no `current`), 0 extra plural forms (Kazakh has only one/other in CLDR; `_one`/`_other` identical).
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=kk` gives 0 problems.

## Personas
- Aruzhan, 18, Shymkent (first-time visitor): reads the pricing cards on her phone and needs short, plain lines with the polite «Сіз».
- Daniyar, 25, Almaty (comparison shopper): compares the three plans line by line with local agencies and checks what "managed" and "no limit" really cover.
- Aruzhan's father: pays in USD by card and reads the exchange-rate, third-party-cost and visa notes.

## Key term decisions
| Concept | Kazakh | Note |
|---|---|---|
| no round limit within the contracted documents | келісімшарттағы құжаттар аясында рет саны шектелмейді | "the number of rounds is not limited within the contract's documents". The scope comes first, and «шексіз» (unlimited) is avoided. Mobile: «Шарттағы құжаттарда рет саны шектелмейді» |
| up to N managed applications | N университетке дейін өтінімді жүргіземіз / Жүргізілетін өтінімдер | «жүргізу» means Hangyul handles the application. It is never "apply to N" and never a guarantee |
| recommended universities | ұсынылатын университеттер / N-ке дейін ұсыныс | kept separate from «жүргізу» |
| custom quote | Бағасы жеке есептеледі | "priced individually" |
| airport pickup arrangement | Әуежайдан қарсы алуды ұйымдастыру | the note says it is arranged through a partner transport company (серіктес көлік компаниясы) |
| plan | жоспар | as in v15 |
| application | өтінім | as in the V28 bundle |
| editing (첨삭) | түзету | |
| statement / study plan | мотивациялық хат / оқу жоспары | |
| diagnostic consultation | (жеке) бағалау кеңесі | follows v15 lede «алғашқы бағалау» and avoids a medical "diagnosis" |
| settling in | орнығу | |
| dormitory | жатақхана | |
| mock interview | сынақ сұхбат | |
| priority response | басым жауап | |
| dedicated team | жеке команда | |
| the Hangyul Univ team | Hangyul Univ командасы | V28 team term |
| upgrade | жоғары жоспарға ауысу | |
| add-on | қосымша қызмет | |
| up to {{count}} | Ең көбі {{count}} | avoids a fixed dative suffix after a number placeholder |
| visa decision | шешімді уәкілетті орган қабылдайды | Hangyul does not issue visas |

## Passes
- Pass A (meaning against Korean): 2 changes. Mobile «шексіз рет» became «рет саны шектелмейді». Upgrade «жоспарды ауыстыру» ("change plan") became «жоғары жоспарға ауысу».
- Pass B (naturalness): 3 changes. `{{count}}-ке дейін` became «Ең көбі {{count}}» in places and rounds, because the suffix cannot agree with an unknown number. `arrivalWindow` dropped «бастап», which needs an ablative suffix on the date.
- Pass C (UI brevity): card lines kept near the English length. Mobile labels shortened («Басталғанда келісіледі», «Команда көмегі»).

## Marketing scorecard (out of 30)
- why.s1: 26. why.s3: 26 («нәтижеге уәде бергеннен гөрі» keeps the no-promise stance).

## Unsure
- `{{date}} дейін` / `{{date}} аяқталды`: they read naturally only if the formatted date ends in a form that takes «дейін» without a suffix.

Status: SYNTHETIC_NATIVE_REVIEWED (model review, not reviewed by a human native speaker)
