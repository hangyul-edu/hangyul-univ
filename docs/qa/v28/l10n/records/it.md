# V28 l10n review: it (italiano)

Scope: all 370 keys in `scripts/i18n/v28/jobs/it.json`. Output: `scripts/i18n/v28/tx/it.json`. Register: students and
agency console `tu`; university console `voi`. Brand "Hangyul Univ" / "Hangyul" stays Latin. The student-facing team is
"il team Hangyul" (never "il tuo consulente"). V27 glossary (`docs/qa/v27/l10n/it.md`) reused.

## Personas

1. **Giulia, 19, Bologna: first-time visitor.** Just finished the *maturità*; arrives on a city page and a university
   page from a search. Needs warm, plain Italian, no bureaucratic English loanwords.
2. **Marco, 27, Milano: comparison shopper.** Compares English-taught *lauree magistrali* and the three plans side by
   side; wants identical terms in the compare table, the cards and the visa route.
3. **Anna, 52, Giulia's mother (payer), plus agency/university staff.** Wary of intermediaries; staff want short console
   labels.

## Glossary

| English | Korean | Italian (chosen) |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | il team Hangyul |
| scholarship | 장학금 | borsa di studio |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); short label "GKS" |
| admission guide | 모집요강 | bando di ammissione |
| apostille | 아포스티유 | apostille |
| consular legalization | 영사확인 | legalizzazione consolare |
| Korean language institute | 어학당 | istituto di lingua coreana |
| offer | 합격 | offerta |
| enrollment | 등록 | iscrizione |
| intake | 모집 학기 | sessione (di ammissione) |
| program | 과정 | programma |
| plan (paid) | 플랜 | piano |
| tuition | 등록금 | tasse universitarie |
| dormitory | 기숙사 | residenza universitaria |
| residence card | 외국인등록증 | carta di soggiorno |
| proof of funds | 재정 증명 | prova dei mezzi finanziari |
| e-visa | 전자비자 | e-visa |
| essay | 에세이 | elaborato |
| case / case owner | 케이스 / 담당자 | pratica / responsabile |
| match | 매칭 | corrispondenza |
| Needs more preparation (far tier) | 준비가 더 필요한 대학 | Serve più preparazione |
| conditions (scholarship) | 장학 조건 | condizioni (distinct from admission *requisiti*) |
| deadline | 마감 | scadenza |
| receipt number | 접수번호 | numero di ricevuta |
| post (embassy/consulate) | 공관 | sede |

## Pass A: meaning (44 strings changed)

All 20 "il tuo consulente" strings now name the team; the 7 quick-fit tier strings follow the V28 English; dormitory
labels follow "Dormitory".

- `visaroute:question.unsure`: *Non sei sicuro? Chiedi al tuo consulente.* → *Non sei sicuro? Chiedi al team Hangyul.*
- `common:fit.tier.UNCLEAR.title`: *Per ora la strada è ancora lunga* → *Serve più preparazione*
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *Gli studenti senza conoscenza del coreano…* → *Gli studenti di alcuni Paesi senza un risultato in un test di coreano…*
- `university:v22.stageHint.decision`: *…la decisione spetta ancora a noi* → *In lista d'attesa. La decisione è ancora in sospeso*
- `concierge:profile.sub`: *Solo ciò che cambia la scelta.* → *Solo ciò che incide sulle tue opzioni.*

## Pass B: native naturalness (12 strings changed)

- `concierge:emergency.note` / `housing.honest`: em dashes removed; *chiama prima — poi…* → *chiama prima i soccorsi. Poi avvisa il team Hangyul.*
- `marketing:v20.city.Busan.body`: *un'estate verso cui viaggia il resto della Corea* → *un'estate che attira turisti da tutta la Corea*
- `marketing:v20.city.Gyeonggi.body`: *ha più università di qualsiasi altra regione, esclusa la capitale stessa* → *capitale a parte, è la regione con più università*
- `student:v16.pay.chooseSubtitle`: *Scegli il piano adatto a ciò che vuoi fare con Hangyul.* → *Scegli il piano in base a quanto aiuto vuoi da Hangyul.*
- `university:v25.in.yield`: *Iscritti tra gli ammessi* → *Offerte concluse con l'iscrizione*

## Pass C: UI context, brevity, one term per concept (12 strings changed)

- `agency:docs.sc.checks`: *Spunta un controllo / scegli un motivo* → *Seleziona un controllo o un motivo* (same verb as `review.verifyHint`)
- `student:v4.compare.scholarshipHint`: *…ne soddisfi le regole* → *…ne soddisfi le condizioni* (glossary)
- `marketing:v24.uni.academicTitle`: *Corsi e campus* → *Programmi e campus* (one term: programma)
- `visaroute:money.title`: *Prova dei mezzi economici* → *Prova dei mezzi finanziari* (glossary)
- `university:kpi.insufficientDetail`: *Basato su {{n}} record — mostrato da {{min}}* → *Basato su {{n}} record. Mostrato quando se ne raggiungono {{min}}.*

## Final source ↔ target comparison

All 370 compared against `en` and `ko`. Placeholders identical (validator). 영사확인 is always *legalizzazione consolare*.
Fixed in the final read: `success:item.DEADLINE_PASSED.why` had the loanword "intake" (now *turno o sessione di ammissione
successivi*); `agency:v9.meet.staffTasks` *Seguiti* → *Azioni successive per il team*; `student:v4.ws.team.approvedEssay`
→ *Approvato: {{essay}}* (avoids gender agreement with the inserted label).

## Marketing scorecard (clarity / trust / naturalness / brevity / CTA / cultural fit, 5 each)

| Section | Draft | Final | Change after draft |
|---|---|---|---|
| SEO home description | 25 | 26 | *affronta* → *gestisci* |
| Journey eyebrow | 22 | 26 | *Il percorso dello studente* → *Passo dopo passo* |
| Pricing (lede, compare rows, Premium f5) | 23 | 26 | lede leads with *Scegli quanto aiuto vuoi* |
| City pages (Busan, Gyeonggi, Seoul line) | 23 | 27 | idiomatic rewrites above |
| University page (why-cards, CTA, GKS/English cards) | 24 | 26 | CTA *Stai pensando di candidarti qui?* |
| Universities list title | 25 | 26 | — |
| FAQ languages answer | 25 | 26 | — |

## Unsure

- `university:v28.pipe.*` keeps *Pipeline* (common in Italian admissions dashboards; *Percorso* would clash with visa route).
- `visaroute:staff.post` *Sede* for the embassy/consulate post.
- `marketing:v28.uni.why.gks` *Aderisce alla GKS* (feminine, following *la* Global Korea Scholarship).
- `agency:v7.today.overdueN_other` *{{count}} scadute* assumes feminine (attività/scadenze).

## Counts

Job keys 370 · kept verbatim 48 · rewritten 68 · newly translated 254 · extra plural forms 0 (Italian one/many/other;
`_many` not needed for these counts).
Validator: `V28 l10n (1 locales): 370 strings valid, 0 problems`.

## Second pass (jobs2)

Input: `scripts/i18n/v28/jobs2/it.json` (630 keys: marketing 2, student 39, success 465, dossier 124; all `current` null).
Output: `scripts/i18n/v28/tx2/it.json`. Same rules, personas and first-pass glossary (no new terms). Student-facing
"your counselor" → the Hangyul team throughout (success `item.*`, `submission.*`, dossier reasons/findings); `{{counselor}}`
placeholders and the agency console label `agency.ownerShort.counselor` keep the person/role. Gendered `{{label}}`
inserts are handled with "{{label}}: …" constructions so no adjective has to agree with an unknown noun. The optional
adjective slot `dossier:upload.status.*` (NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION) stays empty as in English;
`upload.haveTitle*` were rebuilt around a fixed noun ("un documento {{status}} ({{doc}})") so the slot reads correctly empty or filled.

Counts: job keys 630 · kept verbatim 0 · rewritten 0 · newly translated 627 + 3 intentionally empty · extra `_many` forms 7 (mirroring `_other`, as the bundle does).
Passes: A meaning (630 compared with `en`/`ko`; 22 counselor→team fixes), B naturalness, C UI brevity/one term per concept;
final source↔target comparison clean. Marketing: only 2 informational lines (`v20.uni.intl.*`), not CTA copy; scored
26/30 as a section.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=it` → 0 problems.

Examples (before = English source → after):
- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}}: serve ancora la legalizzazione consolare*
- `success:item.ESSAY_REVIEW.why`: *Nothing to do. Your counselor is reading it.* → *Non devi fare nulla. Il team Hangyul lo sta leggendo.*
- `success:submission.safety`: *Never share your portal password…* → *Non condividere mai la password del portale. Hangyul non te la chiederà mai.*
- `success:obs.FEW_OPTIONS`: → *Ti stai candidando a un solo programma. Una seconda opzione realistica ti tutela se non vieni ammesso.*
- `dossier:upload.haveTitle_other`: → *Hai già un documento {{status}} ({{doc}}) usato in {{count}} candidature*

Unsure (second pass):
- "Contributo di candidatura" for the university application fee (vs *tassa di iscrizione al concorso*); kept distinct from *tasse universitarie* and the Hangyul *tariffa del servizio*.
- `dossier:page.privacy` names only "tu e il team Hangyul" (Korean also lists the assigned counselor; an agency sees files only with consent).
- `queue.fixture` keeps "Fixture" (internal test-data badge).
- `submission.awayText` "Sei passato al portale ufficiale {{date}}" depends on {{date}} being a relative phrase; masculine default.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
