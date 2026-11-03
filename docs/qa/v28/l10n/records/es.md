# V28 l10n review — Spanish (es)

Scope: every key of `scripts/i18n/v28/jobs/es.json` (356 keys: 237 with no translation, 119 with an existing `current`). Output: `scripts/i18n/v28/tx/es.json`.
Variant and register: Spain Spanish (es-ES) with **tú** for students and console users, as in the bundle and V27 (*visado*, *móvil*, *el equipo de Hangyul*, *Escritos* for the Writing section, *Subir* for upload).

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/es.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Lucía, 18, Valencia** | finishing bachillerato; wants a grado in Seoul after a year at a Korean language institute; first-time visitor on her phone | plain tú copy, short buttons, no jargon |
| **Javier, 27, Madrid** | engineer comparing English-taught máster programmes across several services (comparison shopper) | exact requirements, deadlines, visa terms, honest claims |
| **Carmen, 52, Lucía's mother** | pays tuition and the proof-of-funds deposit | money wording, who does what, no admission promises |

## Glossary

| English | Korean | Spanish | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | beca |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Beca del Gobierno de Corea (GKS) |  |
| admission guide | 모집요강 | convocatoria de admisión |  |
| apostille | 아포스티유 | apostilla |  |
| consular legalization | 영사확인 | legalización consular |  |
| certificate of enrollment | 재학증명서 | certificado de matrícula |  |
| Korean language institute | 어학당 | instituto de lengua coreana |  |
| D-2 / D-4 visa | D-2 / D-4 | visado D-2 / D-4 |  |
| e-visa | 전자비자 | visado electrónico |  |
| residence card | 외국인등록증 | tarjeta de residencia |  |
| proof of funds | 재정 증빙 | prueba de fondos |  |
| tuition | 등록금 | matrícula |  |
| application fee | 전형료 | tasa de solicitud |  |
| application | 지원 | solicitud |  |
| intake | 모집 시기 | convocatoria |  |
| program(me) | 과정 | programa |  |
| the Hangyul team | 한귤 상담팀 | el equipo de Hangyul | replaces every *tu asesor* |
| plan (paid) | 플랜 | plan |  |
| match | 매칭 | coincidencia |  |
| Recommended (sort) | 추천순 | Recomendadas | browsing order, never a ranking |
| Needs more preparation (far tier) | 준비가 더 필요 | Hace falta más preparación | no probability wording |
| Needs checking with us (unverified tier) | 추가 확인 필요 | Por revisar con nosotros |  |
| dormitory | 기숙사 | residencia universitaria |  |
| enrollment | 등록 | matrícula |  |
| consular post | 공관 | oficina consular |  |
| upload | 업로드 | subir |  |

## Pass A — meaning (62 strings changed)

Most rewrites follow the V28 English: every student-facing *tu asesor* became *el equipo de Hangyul* (23 strings), the fit tiers were re-cut to the new English (CHALLENGE = unverified, UNCLEAR = needs more preparation), and the dormitory/pricing labels lost the "support" wording the English dropped.

| Key | Before | After |
| --- | --- | --- |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Justificante de empleo / ingresos | Justificante de empleo o de ingresos |
| `concierge:help.route.HOUSING` | Tu asesor | El equipo de Hangyul |
| `common:fit.tier.UNCLEAR.title` | Aún queda mucho camino | Hace falta más preparación |
| `common:fit.tier.CHALLENGE.title` | Merecen un vistazo | Por revisar con nosotros |
| `visaroute:caveat.APOSTILLE_TRANSITION` | Vietnam empezó a emitir apostillas el 11 de septiembre de 2026, pero las listas de visado de estudiante de la embajada aún describen la legalización consular. Tu asesor confirma cuál se acepta. | Vietnam empezó a emitir apostillas el 11 de septiembre de 2026, pero las listas de visado de estudiante de la embajada aún describen la legalización consular. El equipo de Hangyul confirma cuál se acepta. |

## Pass B — native naturalness (5 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:v8.view.docs` | Requiere corrección de documentos | Documentos por corregir |
| `student:profileV3.why.goals` | Qué y cuándo quieres estudiar mantiene tu lista con programas del nivel y la convocatoria correctos. | Lo que quieres estudiar y cuándo limita tu lista a programas del nivel y la fecha de inicio adecuados. |
| `student:v4.compare.scholarshipHint` | Solo si cumples sus reglas | Solo si cumples sus condiciones |
| `university:af.stepDef.ENROLLED` | Confirmaste la matrícula. | Has confirmado la matrícula. |
| `visaroute:step.apply.title` | Presenta la solicitud y regístrala | Presenta la solicitud y anota el resguardo |

## Pass C — UI context, brevity, one term per concept (3 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `marketing (all %)` | {{pct}} % | {{pct}} % (plain space, as the es bundle writes it) |
| `marketing:v24.uni.academicTitle` | Carreras y campus | Programas y campus |
| `university:v22.in.byProgramFoot` | Ofertas ÷ solicitudes resueltas por programa; solo se muestra con {{min}} o más resoluciones. | Ofertas ÷ solicitudes resueltas de cada programa. Solo se muestra con {{min}} resoluciones o más. |

(1 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

Every key re-read against `en` and `ko`: placeholders identical, plurals `_one`/`_other` translated where present, no Hangul, no English left except Premium, IEQAS, SLA, TOPIK/TOEFL iBT/IELTS. *Legalización consular* is used for 영사확인 everywhere; *apostilla* for 아포스티유. No string says *asesor* for the student-facing team.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 5 | 4 | **27** (22: draft kept the old order "Un diagnóstico, las solicitudes…"; rewritten to lead with *Elige cuánta ayuda quieres*) |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 4 | 4 | 4 | 5 | **26** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (23: *¿Listo para tomártelo en serio?* no longer matched; now *¿Te planteas estudiar aquí?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `agency:today.evening` — *Buenas tardes* chosen for "Good evening"; in Spain *Buenas noches* is used after ~21:00. A time-of-day split would need a new key.
- `university:eduLevel.HIGH_SCHOOL` — *Secundaria* rather than *Bachillerato*, because applicants come from many systems.
- `university:v28.pipe.label` — *Embudo* for "pipeline": common in Spanish CRM UIs, but some admissions offices say *proceso*.
- `visaroute:staff.post` — *Oficina consular* for 공관 (embassy or consulate); slightly long for a column label.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 356 | 50 | 69 | 237 |

Validator: `node scripts/i18n/v28/validate.mjs --only=es` → `356 strings valid, 0 problems`.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/es.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: A: 1 (`dossier:page.privacy`: the draft had “el equipo de Hangyul y Hangyul”; now just “tú y el equipo de Hangyul”). B: 0. C: 3 (`upload.status.*`: draft adjectives, emptied to match en).

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | Sube los documentos que faltan y termina tus ensayos. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Un ensayo dirigido a otra universidad es el motivo de rechazo evitable más frecuente. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: legalización consular pendiente |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Solo se confirma con un número de confirmación o un recibo. La solicitud pasa a Enviada. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Solo tú y el equipo de Hangyul podéis ver estos archivos. Una universidad solo ve un documento cuando se envía para tu solicitud a esa universidad. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | Tiene una oficina internacional con su propio canal de contacto. / Hangyul aún no ha encontrado una página para estudiantes internacionales en la web de esta universidad. Empieza por su web oficial, más abajo. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.{NEEDS_REVIEW,UPLOADED,NEEDS_CORRECTION}` left empty, as in en/ko (optional adjective slot in `upload.haveTitle`); the validator now requires empty.
- `student:workspace.tabs.timeline` *Cronología* vs *Historial*; `success:agency.colFit` *Encaje* (no settled console term).
- `student:workspace.owner.review.you` *Atento a…* is masculine; a neutral rewrite would be longer.
- `success:queue.fixture` rendered *Prueba* (test data marker) rather than a literal of “Fixture”.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=es` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
