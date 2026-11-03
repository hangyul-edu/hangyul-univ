# V29 l10n record — es (Spanish)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/es.json` → `scripts/i18n/v28/tx-v29/es.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=es` → 0 problems (161 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Lucía, 18, first-time visitor from Madrid
- Mateo, 25, graduate applicant from Bogotá comparing plans
- A parent paying by card who checks fees and exchange rates

## Register and conventions

tú throughout (matches existing student and marketing). Neutral Spanish, avoiding strongly regional verbs (replaced 'agendar', 'brindar'). Plan = plan. Team = "el equipo Hangyul Univ".

## Key term decisions

- No round limit within contracted documents: "Revisión de tus documentos de solicitud contratados, sin límite de rondas"; note "dentro de los documentos de solicitud y el calendario contratados". Never "ilimitado".
- Up to N managed applications: "Gestión de hasta N solicitudes" / row "Solicitudes gestionadas" vs "Universidades recomendadas".
- Custom quote: "Presupuesto a medida".
- Airport pickup arrangement: "Gestión de recogida en el aeropuerto" (existing 'Recogida en el aeropuerto'); note "a través de una empresa de transporte asociada".
- Visado (existing usage), residencia, simulacro de entrevista, legalización notarial (existing notarization term).

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | El equipo Hangyul Univ te ha propuesto un servicio adicional |
| Additional service / add-on | Servicios adicionales |
| Add-on (compare cell) | Adicional |
| Custom quote (별도 견적) | Presupuesto a medida |
| Airport pickup arrangement (공항 픽업 연결) | Gestión de recogida en el aeropuerto |
| Partner-provider pickup note | La recogida en el aeropuerto se gestiona a través de una empresa de transporte asociada. |
| Mock interview | Simulacro de entrevista |
| Diagnostic consultation | Consulta de diagnóstico personalizada + 1 seguimiento |
| Recommended universities (추천) | Universidades recomendadas |
| Managed applications (지원 관리) | Solicitudes gestionadas |
| Up to N managed applications | Gestión de hasta 2 solicitudes a universidades |
| Up to N rounds | Hasta {{count}} revisiones |
| Statement & study-plan editing | Revisión de carta y plan de estudios |
| No round limit within contracted documents (card) | Revisión de tus documentos de solicitud contratados, sin límite de rondas |
| No round limit within contract (cell) | Sin límite de rondas dentro del contrato |
| Premium scope note | En Premium, la revisión no tiene límite de rondas dentro de los documentos de solicitud y el calendario contratados. |
| No round limit (student app) | Sin límite de rondas en tus documentos contratados |
| No limit (mobile chip) | Sin límite en documentos contratados |
| Dormitory | Residencia |
| Settling in | Visado e instalación |
| Visa decision disclaimer | El apoyo con el visado consiste en ayudarte a prepararlo y solicitarlo; la decisión corresponde a la autoridad competente. |
| Consultation support period | Periodo de asesoría |
| Contract term | Duración del contrato |
| Service period | Periodo de servicio |
| Priority response | Respuesta prioritaria |
| Dedicated team | Equipo dedicado · prioridad |
| Upgrade | Consultar al equipo el cambio de plan |
| Notarization | Redactar un documento nuevo, la traducción y la legalización notarial pueden tener un coste adicional. |
| One-time payment in USD | Todos los precios son pagos únicos en dólares estadounidenses (USD). |
| Agree and pay CTA | Aceptar y pagar {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'la decisión corresponde a la autoridad competente'; upgrade.used keeps 'se siguen contando'; addons.lede 'solo pagas cuando estés de acuerdo').
- Pass B (native marketer naturalness): 4 changed ('Agendar' → 'Programar', 'Brindar' → 'Ofrecer', 'Decir que no no cambia nada: tu plan sigue igual', 'Toda la ayuda que necesites').
- Pass C (UI brevity, one term per concept): 2 changed ('Adicional' cell; mobile 'Sin límite en documentos contratados').
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 26/30
- s3 (title + text): 26/30

## Unsure

- 'cambio de plan' used for upgrade rather than the anglicism 'upgrade'.
- 'Decir que no no cambia nada' has a double 'no' that is grammatical but may read as a typo; alternative 'Si lo rechazas, nada cambia'.

## Counts

Job keys: 158 · extra plural forms: 3 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
