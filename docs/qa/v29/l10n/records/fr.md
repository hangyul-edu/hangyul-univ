# V29 l10n record — fr (French)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/fr.json` → `scripts/i18n/v28/tx-v29/fr.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=fr` → 0 problems (161 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Camille, 18, first-time visitor from Lyon looking at Korean universities
- Yanis, 26, master's applicant comparing formulas and fine print
- A parent in Dakar paying by foreign card

## Register and conventions

vous throughout (matches existing). Plan = formule (existing v15.pricing.compare.*). Team = "l'équipe Hangyul Univ".

## Key term decisions

- No round limit within contracted documents: "Relecture de vos documents de candidature prévus au contrat, sans limite de passages"; cell "Sans limite de passages, dans le cadre du contrat". Never "illimité".
- Up to N managed applications: "Suivi de N candidatures maximum" / row "Candidatures suivies" vs "Universités recommandées".
- Custom quote: "Sur devis".
- Airport pickup arrangement: "Organisation de l'accueil à l'aéroport" (existing term accueil à l'aéroport); note "organisé via un transporteur partenaire".
- Editing = relecture; statement = lettre de motivation (existing); mock interview = entretien blanc; notarization = certification notariée (existing).

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | L'équipe Hangyul Univ vous propose un service complémentaire |
| Additional service / add-on | Services complémentaires |
| Add-on (compare cell) | En option |
| Custom quote (별도 견적) | Sur devis |
| Airport pickup arrangement (공항 픽업 연결) | Organisation de l'accueil à l'aéroport |
| Partner-provider pickup note | L'accueil à l'aéroport est organisé via un transporteur partenaire. |
| Mock interview | Entretien blanc |
| Diagnostic consultation | Entretien de diagnostic personnalisé + 1 suivi |
| Recommended universities (추천) | Universités recommandées |
| Managed applications (지원 관리) | Candidatures suivies |
| Up to N managed applications | Suivi de 2 candidatures maximum |
| Up to N rounds | Jusqu'à {{count}} relectures |
| Statement & study-plan editing | Relecture lettre et plan d'études |
| No round limit within contracted documents (card) | Relecture de vos documents de candidature prévus au contrat, sans limite de passages |
| No round limit within contract (cell) | Sans limite de passages, dans le cadre du contrat |
| Premium scope note | Avec Premium, les relectures sont sans limite de passages, dans le cadre des documents de candidature et du calendrier prévus au contrat. |
| No round limit (student app) | Sans limite de passages sur vos documents sous contrat |
| No limit (mobile chip) | Sans limite sur les documents sous contrat |
| Dormitory | Résidence universitaire |
| Settling in | Visa et installation |
| Visa decision disclaimer | L'aide au visa porte sur la préparation et la demande ; la décision revient aux autorités compétentes. |
| Consultation support period | Période de conseil |
| Contract term | Durée du contrat |
| Service period | Période de service |
| Priority response | Réponse prioritaire |
| Dedicated team | Équipe dédiée · priorité |
| Upgrade | Demander une mise à niveau à l'équipe |
| Notarization | La rédaction d'un nouveau document, la traduction et la certification notariée peuvent être facturées en plus. |
| One-time payment in USD | Tous les prix correspondent à un paiement unique en dollars américains (USD). |
| Agree and pay CTA | Accepter et payer {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 3 changed (extra_application 'accompagnée' → 'suivie' to keep one term for managed; ended message keeps 'durée du contrat'; visaDecision 'la décision revient aux autorités compétentes').
- Pass B (native marketer naturalness): 4 changed (e.g. 'Refuser ne change rien : votre formule continue comme prévu'; 'L'aide qu'il vous faut,<br>du début à la fin').
- Pass C (UI brevity, one term per concept): 3 changed ('Sur devis'; 'En option' for the add-on cell; 'Relecture lettre et plan d'études' row).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 26/30
- s3 (title + text): 26/30

## Unsure

- 'mise à niveau' for upgrade; some French sites keep 'upgrade'.
- supportLeft '{{count}} jours restants' is not plural-aware (job key has no plural forms); reads oddly only for 1 day.

## Counts

Job keys: 158 · extra plural forms: 3 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
