# V31 native-quality review — Spanish (es)

Locale `es` (neutral international Spanish for Latin America and Spain, consumer `tú` throughout). Job
`scripts/i18n/v28/jobs-v31/es.json`, output `scripts/i18n/v28/tx-v31/es.json`, glossary
`docs/qa/v31/l10n/glossary/es.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,426 (incl. 35 `v31` keys whose existing Spanish already says what the new source says) |
| Rewritten | 303 |
| — new source (`v31`) | 164 |
| — meaning | 42 (most on `v31` keys where the old Spanish also misstated the contract) |
| — terminology | 39 |
| — naturalness | 54 |
| — quality (UI role / format) | 4 |
| Extra CLDR plural forms added (`_many`, copy of `_other`) | 40 |

The three missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) were translated. `marketing:v15.pricing.compare.item` is empty like the English
(it held «Concepto»). `marketing:v12.terms.universityInfo.p` contained Hangul (대학알리미); it now says Academy Info.

Register and neutrality decisions applied across all keys: `tú` everywhere (the services screen had slipped into
`usted`: «Su plan», «Consulte…», «cuánto ha usado»); no `vosotros` («estáis juntos» removed); Spain-only words replaced
by forms understood on both sides of the Atlantic: «depósito» (not «fianza»), «costo/costos» (not «coste»), «piso»
for a dormitory floor, «documento de identidad» (not «DNI»), «plan de telefonía», «¿Olvidaste tu contraseña?»,
«¡Felicidades!» (not «enhorabuena»); LatAm-only «postular» replaced by «solicitar / presentarse»; gendered
«Bienvenido», «¿Eres nuevo…?», «Ya instalado» made neutral. «Visado» kept (it was used in 76 keys and is understood
throughout Latin America); degree labels made bilingual where it matters: «Grado (licenciatura)», «Máster (maestría)».

Terminology applied: «declaración personal» and «plan de estudios» (the established Spanish names in GKS calls) —
the pricing copy had «carta de motivación», now one term; editing = «corrección» / «ronda de corrección», kept
distinct from review = «revisión» (the old copy called essay editing «revisión», blurring the two plan rows);
«indicaciones sobre qué corregir»; «solicitudes que gestionamos contigo»; «legalización consular» (never bare
«legalización»); «certificación notarial» (the old FAQ and privacy list said «legalizado por notario» /
«legalizaciones», which reads as consular legalization); «instituto de lengua coreana» (not «escuela de idiomas»);
«oferta de admisión»; «el equipo de Hangyul» wherever the source says "the Hangyul team" (17 keys said «equipo
Hangyul Univ»); «instituto técnico superior» for junior college (not Spain's «escuela universitaria»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Periodo de asesoría» — the support window read as a period of advisory sessions | «Plazo para hacer preguntas después de la consulta» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included in Premium | full exclusion added |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` / `all_in_one.f5` | «Preparación de documentos» / «Documentos del visado preparados» — as if Hangyul prepares the visa documents | «Ayuda para preparar los documentos del visado» |
| 4 | `common:v29.pricing.notes.visaDecision` | «la decisión corresponde a la autoridad competente» — vague | «La concesión del visado la deciden las autoridades de inmigración» |
| 5 | `common:v29.addon.item.airport_pickup` | «Gestión de recogida en el aeropuerto» — no partner, reads as Hangyul running the pickup | «Recogida en el aeropuerto con una empresa colaboradora»; `concierge:step.pickup.sub` likewise names the partner |
| 6 | `common:v29.pricing.premium.position` | dropped the application stage («apoyo hasta el visado…») | «desde la solicitud hasta el visado, la llegada y sus primeras semanas en Corea» |
| 7 | `common:v29.pricing.all_in_one.f3`, `compare.row.essay`, `v15…essay_review_rounds`, `terms.*` | essay editing called «revisión» — same word as document review | «corrección» / «ronda de corrección» |
| 8 | `marketing:v11.services.s1.text` | «asumimos todo el proceso … hasta comunicarnos con la universidad», «escuelas de idioma», «realmente encajan» | we suggest institutes, go through scholarships, then help you prepare documents and deal with the university |
| 9 | `marketing:v11.why.s3.text` / `.title` | «cuida de que tu vida de estudiante transcurra con tranquilidad», «El coste más razonable, el mejor resultado» — implied outcome promise | fair price, careful help, you see what the plan includes before paying; «Un precio justo, sin sorpresas» |
| 10 | `marketing:v11.why.s1.text` | «Nos hacemos cargo de cada etapa», «el socio que te lleva hasta la meta» — implies Hangyul does it all and delivers the result | «Te ayudamos en cada etapa… Trabajas con el mismo equipo de principio a fin» |
| 11 | `marketing:v11.faq.q6.a` | «Todas las universidades ofrecen becas» | «La mayoría sí…» |
| 12 | `marketing:v11.faq.q2.a` | «necesitas un certificado» — stated as universal | «La mayoría… piden»; some accept their own test instead |
| 13 | `marketing:v11.services.s2.text` | «Visado… te ayudamos con cuidado en cada paso… Resolvemos juntos todo lo necesario» — overclaims | help with visa application, residence card and course registration |
| 14 | `marketing:v11.services.s3.title` | «más fuerte porque estáis juntos» — `vosotros` and not the source claim | «Una comunidad de estudiantes que ya pasaron por esto» |
| 15 | `marketing:v11.hero.lede` / `.title` | «Convertimos tu sueño en realidad», «¡Estudiar en Corea es fácil!» | find the right university and complete each step with a team beside you; «…más fácil de lo que crees» |
| 16 | `marketing:v11.faq.q1.a` | «legalizado por notario + apostilla» (notarization worded as legalization); «pasaporte extranjero» | «con certificación notarial y apostilla»; passport/ID wording per source |
| 17 | `marketing:v12.privacy.collect.documents.items` | «legalizaciones» for notarizations | «certificaciones notariales» |
| 18 | `marketing:v12.privacy.collect.profile.purpose` | «preparar un plan de estudios» — reads as the essay document | «planificar tus estudios en el extranjero» |
| 19 | `marketing:v12.privacy.collect.verification.purpose` | «evitar registros automatizados» for fraudulent sign-ups | «evitar registros fraudulentos» |
| 20 | `marketing:v12.terms.services.documents` | «Preparación y revisión de documentos» — as if Hangyul prepares them | «Ayuda para preparar documentos de solicitud y revisión de documentos» |
| 21 | `marketing:v20.city.Gyeonggi.line` / `.body` | «más verde» for roomier; dropped that more students live in dormitories | «más espaciosa»; «por eso más estudiantes viven en residencias universitarias» |
| 22 | `marketing:v20.uni.intl.admissionsLine` | «se gestiona en una página distinta» — a separate page, not a separate admissions track | «Tiene un proceso de admisión propio para estudiantes internacionales» |
| 23 | `marketing:v15.pricing.lede` | «una valoración inicial, tus solicitudes o tu adaptación» | «una consulta de diagnóstico, ayuda con tus solicitudes o acompañamiento hasta que te instales» |
| 24 | `student:discover.verdict.reach`, `success:group.possible` | «Posiblemente compatible» / «Posible coincidencia» — loses "meets requirements" | «Cumple los requisitos, hay que comprobarlo» |
| 25 | `student:v4.ws.team.final` | «Revisión final y envío de tu solicitud a {{university}}» — Hangyul appears to submit | «Revisión final antes de que presentes tu solicitud a {{university}}» |
| 26 | `student:v15.services.allowance.unlimited` | «Continuo con el equipo» — no scope | «Pregunta al equipo de Hangyul cuando quieras durante el periodo de tu servicio» |
| 27 | `student:v15.services.scope.consultation` | «Duración de la consulta» — V15 minutes model | «Consulta» |
| 28 | `student:register.privacyNote` | omitted the partner agency that also receives data | «…el equipo de Hangyul que te acompaña (incluida su agencia asociada)…» |
| 29 | `student:phase.prepare.text` | «escribe tu declaración personal… con el equipo» — co-writing | «…con los comentarios del equipo de Hangyul» |
| 30 | `student:compare.legalCount_*`, `profileV3.why.basics` | «legalización» without «consular» | «apostilla o legalización consular» |
| 31 | `student:budget.scholarshipAlternative` | «no se suma a las demás» — wrong: it is not added twice | «Es una alternativa a la beca contabilizada, así que no se suma dos veces» |
| 32 | `dossier:page.summary` | «listos para todas las solicitudes» — added a claim | «{{ready}} de {{total}} listos» |
| 33 | `dossier:group.extraCount` | «{{count}} más guardados para después» — not a show-more control | «Ver {{count}} documentos guardados más» |
| 34 | `visaroute:step.slow_items.why` | «Las legalizaciones…» — apostille dropped | «La apostilla o la legalización consular…» |
| 35 | `visaroute:help.ask` | «Preguntar a una persona» | «Preguntar al equipo de Hangyul» |
| 36 | `concierge:status.DORMITORY.ASSIGNED` | «Habitación ofrecida» — offered ≠ assigned | «Habitación asignada» |
| 37 | `common:uni27.schol.youMay` | «Podrías cumplir las condiciones de» — a dangling fragment as a heading | «Becas a las que podrías optar» |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, the hero, why, services and FAQ areas would have scored below 20 (TRUST and SPECIFICITY) because of
the dream/success promises, "all universities", Hangyul "taking over" the process and `vosotros`. Every area is now at
26/30 or higher. This is an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «tu equipo de Hangyul», services-in-progress title, offer wording |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses, final check says the student submits, reach tier, «Solicita antes del» |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, summary no longer over-claims |
| Services | 5 | 5 | 5 | 5 | 4 | `tú` restored, support window, scoped "unlimited", consultation not a duration, managed applications, exclusions with notarization |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, TB certificate, pickup via a partner, deposit/floor wording neutral |

## Unresolved ambiguity / limits (listed, not guessed)

- `visado` vs `visa`: kept «visado» (Spain/RAE standard, understood in Latin America). A LatAm-first market split
  (es-419) would switch to «visa».
- `fit.level.ASSOCIATE` «Grado asociado»: only Puerto Rico uses the term; there is no exact Hispanic equivalent of an
  associate degree.
- `_one` forms where the English `_one` has no `{{count}}` (`student:v8.compare.budget_one`,
  `student:v9.discovery.scholarship_one`): Spanish `_one` is only 1, so this is correct for Spanish.
- `_many` (CLDR `es`: 1 000 000 and compact forms) was added as a copy of `_other` for every `_other` key. Keys with
  only `_other` in the job (e.g. `marketing:v12.directory.count`) cannot receive `_one` through this pipeline.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고) kept as «Registros de etiquetado y publicidad»; the
  exact Spanish legal category for Korean 표시 is unclear.
- `marketing:v11.faq.q1.a`: "junior college" rendered «estudios técnicos superiores»; national equivalents differ
  (Spain FP de grado superior, Mexico TSU, Argentina terciario).

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
