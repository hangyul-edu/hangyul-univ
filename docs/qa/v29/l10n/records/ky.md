# V29 service contract: Kyrgyz (ky) review record

Job: `scripts/i18n/v28/jobs-v29/ky.json` (158 keys: common 99, marketing 4, student 42, mobile 13). Output: `scripts/i18n/v28/tx-v29/ky.json`.
Counts: 158 newly translated, 0 kept verbatim, 0 extra plural forms (Kyrgyz has only one/other in CLDR).
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ky` gives 0 problems.

## Personas
- Aizada, 18, Osh (first-time visitor): reads on her phone and needs short, plain lines with «Сиз».
- Bekzat, 26, Bishkek (comparison shopper): a master's applicant who checks exactly what each plan covers.
- A parent sponsor: reads the USD, exchange-rate and visa-decision notes.

## Key term decisions
| Concept | Kyrgyz | Note |
|---|---|---|
| no round limit within the contracted documents | келишимдеги документтердин чегинде жолу чектелбейт | the scope comes first and «чексиз» (unlimited) is never used. Mobile: «Келишимдеги документтерде жолу чектелбейт» |
| up to N managed applications | N университетке чейин арызды жүргүзөбүз / Жүргүзүлгөн арыздар | «жүргүзүү» means Hangyul handles it. It is not a guarantee and not "apply to N" |
| recommended universities | сунушталган университеттер | kept separate from «жүргүзүү» |
| custom quote | Баасы өзүнчө эсептелет | |
| airport pickup arrangement | Аэропорттон тосуп алууну уюштуруу | the note names the partner transport company (өнөктөш транспорт компаниясы) |
| plan | план | as in v15 |
| application | арыз | V28 bundle term |
| editing | оңдоо | |
| statement / study plan | мотивациялык кат / окуу планы | |
| diagnostic consultation | (жеке) баалоо кеңеши | follows v15 «алгачкы баалоо» |
| settling in | жайгашуу | |
| dormitory | жатакана | |
| mock interview | сынамык маек | |
| priority response | биринчи кезекте жооп | |
| dedicated team | жеке команда | |
| the Hangyul Univ team | Hangyul Univ командасы | |
| upgrade | жогорку планга өтүү | |
| add-on | кошумча кызмат | |
| up to {{count}} | Эң көп {{count}} | no fixed dative suffix after a placeholder |
| visa decision | чечимди ыйгарым укуктуу орган кабыл алат | |

## Passes
- Pass A (meaning): 1 change. The upgrade wording was made consistent («жогорку планга өтүү» everywhere).
- Pass B (naturalness): 3 changes. `{{count}} чейин` became «Эң көп {{count}}» in places and rounds. `arrivalWindow` dropped «баштап».
- Pass C (UI brevity): mobile labels shortened («Башталганда макулдашылат», «Команданын жардамы»).

## Marketing scorecard (out of 30)
- why.s1: 26. why.s3: 26.

## Unsure
- `{{date}} чейин` / `{{date}} бүттү` depend on how the date is formatted.
- «Сынамык маек» compared with «сыноо интервьюсу»: we chose the more native-sounding form.

Status: SYNTHETIC_NATIVE_REVIEWED (model review, not reviewed by a human native speaker)
