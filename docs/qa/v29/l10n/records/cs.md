# V29 l10n record — cs (Czech)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/cs.json` → `scripts/i18n/v28/tx-v29/cs.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=cs` → 0 problems (164 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Tereza, 19, first-time visitor from Brno
- Jakub, 26, master's applicant comparing tariffs
- A parent checking card charges and third-party costs

## Register and conventions

vy (formal plural) as in existing cs strings. Plan = tarif (existing). Team = "tým Hangyul Univ".

## Key term decisions

- No round limit within contracted documents: "Korektury smluvně sjednaných přihláškových dokumentů bez omezení počtu kol"; never "neomezené".
- Up to N managed applications: "Správa až N přihlášek" / "Spravované přihlášky" vs "Doporučené univerzity".
- Custom quote: "Individuální nabídka".
- Airport pickup arrangement: "Zprostředkování vyzvednutí na letišti"; note "zprostředkujeme přes partnerského přepravce".
- Plurals: added _few/_many (den/dny/dne/dnů; kolo/kola/kol). supportLeft rewritten plural-neutral: 'zbývající dny: {{count}}'.

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | Tým Hangyul Univ vám navrhl doplňkovou službu |
| Additional service / add-on | Doplňkové služby |
| Add-on (compare cell) | Doplňková služba |
| Custom quote (별도 견적) | Individuální nabídka |
| Airport pickup arrangement (공항 픽업 연결) | Zprostředkování vyzvednutí na letišti |
| Partner-provider pickup note | Vyzvednutí na letišti zprostředkujeme přes partnerského přepravce. |
| Mock interview | Cvičný pohovor |
| Diagnostic consultation | Osobní diagnostická konzultace + 1 navazující |
| Recommended universities (추천) | Doporučené univerzity |
| Managed applications (지원 관리) | Spravované přihlášky |
| Up to N managed applications | Správa až 2 přihlášek na univerzity |
| Up to N rounds | Až {{count}} kol |
| Statement & study-plan editing | Korektura dopisu a studijního plánu |
| No round limit within contracted documents (card) | Korektury smluvně sjednaných přihláškových dokumentů bez omezení počtu kol |
| No round limit within contract (cell) | Bez omezení kol v rozsahu smlouvy |
| Premium scope note | Korektury v Premium nemají omezený počet kol v rámci smluvně sjednaných přihláškových dokumentů a harmonogramu. |
| No round limit (student app) | Bez omezení kol u smluvních dokumentů |
| No limit (mobile chip) | Bez omezení u smluvních dokumentů |
| Dormitory | Kolej |
| Settling in | Vízum a zabydlení |
| Visa decision disclaimer | Podpora s vízem znamená pomoc s přípravou a podáním žádosti; o udělení rozhoduje příslušný úřad. |
| Consultation support period | Období konzultací |
| Contract term | Doba trvání smlouvy |
| Service period | Období služby |
| Priority response | Přednostní odpovědi |
| Dedicated team | Vyhrazený tým · přednost |
| Upgrade | Zeptat se týmu na vyšší tarif |
| Notarization | Sepsání nového dokumentu, překlad a notářské ověření mohou být zpoplatněny zvlášť. |
| One-time payment in USD | Všechny ceny jsou jednorázové platby v amerických dolarech (USD). |
| Agree and pay CTA | Souhlasit a zaplatit {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'o udělení rozhoduje příslušný úřad'; upgrade.used 'se započítávají'; settlement task wording).
- Pass B (native marketer naturalness): 3 changed ('Férová cena,<br>jasný rozsah'; 'Odmítnutím se nic nemění'; 'Ne, děkuji').
- Pass C (UI brevity, one term per concept): 3 changed (supportLeft plural-neutral; '{{count}}× v ceně'; mobile chip shortened).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 26/30

## Unsure

- supportFromStart '{{count}} dnů' is correct for 5+ (expected values 30/60/90) but not plural-aware.
- 'Cvičný pohovor' vs 'Modelový pohovor'.

## Counts

Job keys: 158 · extra plural forms: 6 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
