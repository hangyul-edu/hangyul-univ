# V29 l10n record — fil (Filipino)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/fil.json` → `scripts/i18n/v28/tx-v29/fil.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=fil` → 0 problems (158 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Angel, 18, first-time visitor from Quezon City
- Mark, 25, grad applicant comparing plans on mobile
- A parent working abroad paying by card

## Register and conventions

Conversational Taglish with 'mo/ka' as in existing student.json; plan = plano; team = "Team Hangyul Univ" (existing). English loan terms kept where Filipino web copy uses them (mock interview, personal statement, study plan, round, follow-up).

## Key term decisions

- No round limit within contracted documents: "Pag-edit ng mga dokumento sa aplikasyon na nasa kontrata, walang limit sa round"; never "walang hanggan"/unlimited.
- Up to N managed applications: "Hanggang N aplikasyong hahawakan namin" / "Aplikasyong hinahawakan" vs "Inirerekomendang unibersidad".
- Custom quote: "Custom na quotation".
- Airport pickup arrangement: "Pag-aayos ng sundo sa airport" (existing 'Sundo sa airport'); note "inaayos sa pamamagitan ng partner na transport provider".
- Dedicated team = "nakatalagang team" (validator rejected an all-English row).

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | May iminungkahing karagdagang serbisyo ang Team Hangyul Univ |
| Additional service / add-on | Mga karagdagang serbisyo |
| Add-on (compare cell) | Add-on |
| Custom quote (별도 견적) | Custom na quotation |
| Airport pickup arrangement (공항 픽업 연결) | Pag-aayos ng sundo sa airport |
| Partner-provider pickup note | Ang sundo sa airport ay inaayos sa pamamagitan ng partner na transport provider. |
| Mock interview | Mock interview |
| Diagnostic consultation | Personal na diagnostic consultation + 1 follow-up |
| Recommended universities (추천) | Inirerekomendang unibersidad |
| Managed applications (지원 관리) | Aplikasyong hinahawakan |
| Up to N managed applications | Hanggang 2 aplikasyon sa unibersidad na hahawakan namin |
| Up to N rounds | Hanggang {{count}} round |
| Statement & study-plan editing | Pag-edit ng statement at study plan |
| No round limit within contracted documents (card) | Pag-edit ng mga dokumento sa aplikasyon na nasa kontrata, walang limit sa round |
| No round limit within contract (cell) | Walang limit sa round, sakop ng kontrata |
| Premium scope note | Sa Premium, walang limit sa round ng pag-edit sa loob ng mga dokumento sa aplikasyon at iskedyul na nasa kontrata. |
| No round limit (student app) | Walang limit sa round para sa mga dokumentong nasa kontrata |
| No limit (mobile chip) | Walang limit sa dokumentong nasa kontrata |
| Dormitory | Dormitoryo |
| Settling in | Visa at pag-settle |
| Visa decision disclaimer | Ang suporta sa visa ay tulong sa paghahanda at pag-apply; ang awtoridad ang magpapasya. |
| Consultation support period | Panahon ng konsultasyon |
| Contract term | Tagal ng kontrata |
| Service period | Panahon ng serbisyo |
| Priority response | Priority na sagot |
| Dedicated team | Nakatalagang team · priority |
| Upgrade | Magtanong sa team tungkol sa upgrade |
| Notarization | Maaaring may dagdag na bayad ang pagsulat ng bagong dokumento, pagsasalin at notaryo. |
| One-time payment in USD | Lahat ng presyo ay isang beses na bayad sa US dollar (USD). |
| Agree and pay CTA | Pumayag at magbayad ng {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'ang awtoridad ang magpapasya'; addons.lede; upgrade.used).
- Pass B (native marketer naturalness): 4 changed ('Walang magbabago kung tatanggi ka'; 'Hindi na, salamat'; 'Patas na presyo').
- Pass C (UI brevity, one term per concept): 3 changed ('Nakatalagang team · priority'; mobile chips).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 25/30

## Unsure

- Degree of Taglish (e.g. 'priority na sagot') is a judgment call; matches existing fil files.
- 'Custom na quotation' vs 'Hiwalay na presyo'.

## Counts

Job keys: 158 · extra plural forms: 0 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
