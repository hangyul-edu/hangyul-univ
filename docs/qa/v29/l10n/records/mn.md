# V29 service contract: Mongolian (mn) review record

Job: `scripts/i18n/v28/jobs-v29/mn.json` (158 keys: common 99, marketing 4, student 42, mobile 13). Output: `scripts/i18n/v28/tx-v29/mn.json`.
Counts: 158 newly translated, 0 kept verbatim, 0 extra plural forms (Mongolian has only one/other in CLDR). The script is Cyrillic.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=mn` gives 0 problems.

## Personas
- Nomin, 18, Ulaanbaatar (first-time visitor): reads in the polite «та» register and wants short lines.
- Temuulen, 25, Darkhan (comparison shopper): compares the plans with local agencies line by line.
- A parent sponsor: reads the USD, exchange-rate and visa-decision notes.

## Key term decisions
| Concept | Mongolian | Note |
|---|---|---|
| no round limit within the contracted documents | гэрээнд заасан баримтын хүрээнд удаагийн хязгааргүй | "no limit on the number of times within the scope of the contracted documents". The scope always comes first. The full note reads «…өргөдлийн баримт, хуваарийн хүрээнд удаагийн хязгаар байхгүй». Never a bare «хязгааргүй» |
| up to N managed applications | N хүртэл өргөдлийг хариуцан хөтөлнө / Хариуцан хөтлөх өргөдөл | "takes charge of and handles". It is not a guarantee |
| recommended universities | санал болгох их сургууль / N хүртэл санал | kept separate from «хариуцан хөтлөх» |
| custom quote | Үнийг тусад нь тооцно | |
| airport pickup arrangement | Нисэх буудлаас тосох үйлчилгээ зуучлах | «зуучлах» (to broker or connect) matches 연결 and makes clear that Hangyul does not drive. The note names the partner (хамтрагч тээврийн компани) |
| plan | багц | V28 glossary |
| application | өргөдөл | |
| editing | засвар / засах | |
| statement / study plan | танилцуулга эссэ / суралцах төлөвлөгөө | |
| diagnostic consultation | (хувийн) үнэлгээний зөвлөгөө | follows v15 «анхан шатны үнэлгээ» and avoids the medical «оношилгоо» |
| settling in | дасан зохицох | |
| dormitory | дотуур байр | |
| mock interview | туршилтын ярилцлага | |
| priority response | нэн тэргүүнд хариу | |
| dedicated team | тусгай баг | |
| the Hangyul Univ team | Hangyul Univ-ийн баг | |
| upgrade | дээд багц руу шилжих | |
| add-on | нэмэлт үйлчилгээ | |
| visa decision | шийдвэрийг эрх бүхий байгууллага гаргана | |
| consultation | зөвлөгөө | V28 glossary |

## Passes
- Pass A (meaning): 1 change. A stray comparison was removed from all_in_one.f1.
- Pass B (naturalness): 2 changes. `{{date}}-нд дууссан` became «Дууссан: {{date}}», and the `arrivalWindow` case suffixes after placeholders were removed, because vowel harmony cannot be predicted.
- Pass C (UI brevity): mobile labels shortened («Эхлэхэд тохиролцоно», «Багийн дэмжлэг»).

## Marketing scorecard (out of 30)
- why.s1: 26. why.s3: 26.

## Unsure
- «тусгай баг» for "dedicated team" (the alternative is «хариуцсан баг», which is already used for "responsible team").

Status: SYNTHETIC_NATIVE_REVIEWED (model review, not reviewed by a human native speaker)
