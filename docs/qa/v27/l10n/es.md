# V27 localization review: es (Spanish, Spain)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched).
Output: `scripts/i18n/v27/tx/es.json`.
Variant: Spain Spanish (es-ES), the same variant as the existing bundle `packages/i18n/locales/es/`. It uses *visado*, *móvil* and *tú* everywhere for students. Established bundle terms kept: *asesor*, *equipo de Hangyul*, *Mensajes*, *Escritos* (the Writing section), *ensayos*, *coincidencias*, *apostilla*, *legalización consular*, *carta de admisión*, *tarjeta de residencia*, *visado electrónico*.

## Personas

1. **Lucía, 18, Valencia.** Just finished bachillerato and wants to do a *grado* in Seoul after a year at a Korean language institute. She reads everything on her phone.
2. **Javier, 27, Madrid.** Industrial engineer applying for a *máster* taught in English. He wants exact requirements, deadlines and visa paperwork.
3. **Carmen, 52, Lucía's mother.** She pays the tuition and the deposit for the visa's proof of funds. She worries about money transfers, refunds and whether the service promises too much.

## Glossary

| English | Korean | es rendering |
|---|---|---|
| scholarship | 장학(금) | beca |
| Global Korea Scholarship (GKS) | 정부초청장학 | Beca del Gobierno de Corea (GKS) for the category label; *Global Korea Scholarship (GKS)* in running text, matching the bundle |
| admission guide | 모집요강 | convocatoria de admisión |
| apostille | 아포스티유 | apostilla; Apostille Convention = Convenio de la Apostilla |
| consular legalization | 영사확인 | legalización consular |
| Korean language institute | 어학당 | instituto de lengua coreana |
| Korean language program | 어학연수 | programa / curso de lengua coreana |
| certificate of admission / admission letter | 표준입학허가서 | carta de admisión (estándar) |
| CCVI | 사증발급인정서 | Certificado de Confirmación de Emisión de Visado (CCVI) |
| e-visa | 전자비자 | visado electrónico |
| D-2 / D-4 visa | D-2 / D-4 | visado D-2 / D-4 |
| residence card | 외국인등록증 | tarjeta de residencia |
| immigration office | 출입국관리사무소 | oficina de inmigración |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | prueba de fondos / certificado de saldo bancario |
| tuition | 등록금 | matrícula |
| application fee | 전형료 | tasa de solicitud |
| counselor | 상담사 | asesor |
| Hangyul team | 한귤 상담팀 | el equipo de Hangyul |
| match(es) | 매칭 | coincidencia(s) |
| essay | 에세이 | ensayo |
| Recommended (sort) | 추천순 | Recomendadas (explained as a browsing order, not a ranking) |
| notarized | 공증 | con certificación notarial |
| GPA | 평균 성적 | nota media |
| checklist | 체크리스트 | lista de comprobación |

## Pass A: meaning (19 strings changed)

Each string was checked against the English, with the Korean used where the English was ambiguous.

- `marketing:matching.p1`: *aún sin requisitos* → *aún no cumples los requisitos*. The draft said "still without requirements", which is the wrong meaning for "not eligible yet".
- `student:v9.money.note.VISA_FEE_AS_PUBLISHED`: *publica esta tasa por escrito, sin cifra* → *indica esta tasa con palabras, no con una cifra*. Fixes the meaning of "fee published in words".
- `student:dashboard.stageText.VISA`: *Te han admitido* → *Has completado la admisión*. Follows the Korean 입학 절차를 마쳤어요 (admission steps are done), not just "an offer was received".
- `common:uni27.schol.youMay` (and the 3 `fit.schol.*` strings): *requisitos* → *condiciones*. Keeps scholarship conditions separate from admission requirements.
- `student:budget.scholarshipAlternative`: *Alternativa, no se suma a lo anterior* → *Es una alternativa: no se suma a las demás*.

## Pass B: native naturalness (31 strings changed)

Each string was read as Lucía, Javier and Carmen, and anything that sounded translated was rewritten.

- `student:v27.doc.notarization`: *Debe estar notarizado* → *Tiene que llevar certificación notarial*. *Notarizar* is a calque that Spain does not use.
- `common:task.doc.RENEW`: *Tu {{category}} ha caducado* → *Tu documento ({{category}}) ha caducado*. Avoids a gender clash with feminine document names.
- `student:essays.emptyText` and related strings: *redacciones* → *ensayos*, to match the bundle's *Ensayos* section.
- `common:fit.tier.CHALLENGE.title`: *Merece la pena mirarlas* → *Vale la pena echarles un vistazo*. Pass C shortened it again.
- `mobile:agency.login.tagline`: *Tus estudiantes* → *Tu cartera de estudiantes*, which is the natural term for a caseload.

## Pass C: UI context and brevity (14 strings changed)

- `common:fit.reason.needed_track`: *Los programas {{track}} exigen…* → *{{track}}: se exige…*. The `{{track}}` value is a label, so it reads better in front of a colon.
- `common:fit.tier.CHALLENGE.short`: *Echa un vistazo* → *Merece un vistazo*. A tier chip should describe the tier, not give an order.
- `common:fit.gpa.placeholder`: *p. ej., 3,6* → *p. ej., 3.6*. Keeps the decimal format that the numeric input is likely to parse (see "Unsure").
- `student:visa.subtitle` (and 4 more strings): *lista del visado / lista* → *lista de comprobación*, so "checklist" has one term throughout.
- `mobile:v3.quick.open`: *Consulta tus opciones. Sin cuenta* → *Consulta tus opciones sin cuenta*, one short CTA.

## Final: source ↔ target comparison

The whole set (729 strings) was compared with the English and Korean for meaning, placeholders and tags, register and the "no guarantee / no ranking" rule. Three more strings changed:

- `fit.track.KOREAN` / `fit.track.ENGLISH` → *Docencia en coreano / en inglés*. These read correctly both as chips and inside `fit.reason.*_track`.
- `uni27.service.COUNSELING`: *Apoyo psicológico* → *Asesoramiento personal*. The draft narrowed 상담 지원 to psychological support.

No string implies admission probability or a guarantee. *Recomendadas* is always explained as a browsing order. Every placeholder and `<em>` tag is preserved. The Hangul in the English `v20.uni.why.breadthBody` (대학알리미) was dropped and only the official English name *Academy Info* kept, because Hangul is not allowed outside ko.
Validator: `node scripts/i18n/v27/validate.mjs --only=es` reports 729 strings valid, 0 problems.

## Unsure

- `fit.level.ASSOCIATE` *Grado asociado*: Spain has no equivalent of 전문학사. This Latin American term is understandable, but a Spain reader might prefer *Título de técnico superior*, which is not an exact equivalent.
- `fit.gpa.placeholder`: the Spanish decimal separator is a comma. The dot was kept on purpose until it is confirmed whether the GPA field accepts commas.
- `uni27.service.BUDDY` *Programa buddy*: universities in Spain use both *programa buddy* and *programa de mentores*.
- `v9.funds.longer_*`: the government tier is rendered «de consultoría», a literal rendering of the official Korean category 컨설팅.
- `{{country}}` strings (`legalFlow.note.*`, `legal.*`, `state.*`): *en {{country}}* and *{{country}} se adhiere* are grammatical for almost every country name in Spanish. A few names normally take an article (*la India*, *el Reino Unido*), and a bare name still reads acceptably there.
- `caveat.APOSTILLE_WORDING_POSTS`: *Bombay* follows the Fundéu recommendation. Some readers expect *Mumbai*.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → No se exige ningún resultado de idioma para solicitar. Después de la admisión necesitarás {{tests}} o más.
- `fit.reason.far` → Exige {{options}} o más, muy por encima de tu resultado actual.
- `fit.tier.UNCLEAR.title` → Aún queda mucho camino
- `fit.tier.UNCLEAR.short` → Más preparación
- `fit.tier.UNCLEAR.lede` → Tu resultado actual está muy por debajo del requisito publicado. Date más tiempo para prepararte y vuelve a comprobarlo.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
