# V27 localization review: it (Italian)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched).
Output: `scripts/i18n/v27/tx/it.json`.

Variant and register: standard Italian, informal *tu* for students, as in the existing bundle `packages/i18n/locales/it/` (*puoi* 53×, *Lei* 0×).

Established bundle terms kept: *consulente*, *team Hangyul*, *Messaggi*, *sezione Scrittura*, *elaborati*, *abbinamenti*, *apostille*, *legalizzazione consolare*, *lettera di ammissione*, *carta di soggiorno*, *e-visa*, *quota di candidatura*, *bando* (the bundle's "Bando GKS 2026"), *carica* (upload).

## Personas

1. **Giulia, 19, Bologna.** Just finished the *maturità*. She wants a *laurea triennale* in Seoul after a year at a university Korean language institute.
2. **Marco, 27, Milano.** Mechanical engineer applying for a *laurea magistrale* taught in English. He wants exact requirements, deadlines and visa steps.
3. **Anna, 52, Giulia's mother.** She pays the fees and the bank balance for the visa. She is wary of intermediaries and promises.

## Glossary

| English | Korean | it rendering |
|---|---|---|
| scholarship | 장학(금) | borsa di studio |
| Global Korea Scholarship (GKS) | 정부초청장학 | Borsa di studio del governo coreano (GKS) for the label; *Global Korea Scholarship (GKS)* in running text, as in the bundle |
| admission guide | 모집요강 | bando di ammissione |
| apostille / Apostille Convention | 아포스티유 | apostille / Convenzione dell'Apostille |
| consular legalization | 영사확인 | legalizzazione consolare |
| Korean language institute | 어학당 | istituto di lingua coreana |
| admission letter | 표준입학허가서 | lettera di ammissione (standard) |
| CCVI | 사증발급인정서 | Certificato di conferma del rilascio del visto (CCVI) |
| e-visa | 전자비자 | e-visa |
| D-2 / D-4 visa | D-2 / D-4 | visto D-2 / D-4 |
| residence card | 외국인등록증 | carta di soggiorno |
| immigration office | 출입국관리사무소 | ufficio immigrazione |
| proof of funds / bank certificate | 재정 증빙 / 잔고증명서 | prova dei mezzi finanziari / certificato di saldo bancario |
| tuition | 등록금 | tasse universitarie |
| bachelor's / master's | 학사 / 석사 | laurea triennale / laurea magistrale |
| counselor | 상담사 | consulente |
| Hangyul team | 한귤 상담팀 | il team Hangyul |
| essay | 에세이 | elaborato |
| Recommended (sort) | 추천순 | Consigliate (a browsing order, never a ranking) |
| notarized | 공증 | autenticato da un notaio |
| scholarship conditions | 장학 조건 | condizioni (kept distinct from admission *requisiti*) |

## Pass A: meaning (7 strings changed)

- `marketing:v10.account.continue`: *Riprendi da dove avevo lasciato* → *Riprendi da dove hai lasciato*. The draft mixed tu-imperative with first person.
- `marketing:v15.pricing.lede`: *Scegli fin dove accompagnarti* → *Scegli fin dove vuoi che ti accompagniamo*. The draft was ambiguous about who accompanies whom.
- `common:uni27.schol.conditions`: *Requisiti* → *Condizioni*. Keeps scholarship conditions apart from admission requirements.
- `mobile:v3.home.stageLine.admission`: *Ora conferma il tuo posto* → *Ora assicurati il posto*. The source describes securing the place, not confirming it.
- `marketing:v7.why.realistic.text`: *perché hai i requisiti* → *perché soddisfi i requisiti*. Matches the wording of the published requirements.

## Pass B: native naturalness (13 strings changed)

- `student:support.emptyText`: *Nessuna domanda è troppo piccola* (a calque) → *Non esistono domande stupide.*
- `common:task.visa.financial_proof_vn`: *ad Hanoi* → *a Hanoi*.
- `marketing:v10.services.documents.title`: *Sappi quali documenti…* → *Scopri quali documenti ti servono e caricali una volta sola*.
- `marketing:howPage.lede`: *così niente sfugge* → *perché nulla vada perso*.
- `marketing:trust.lede`: *manteniamo accurato ciò che leggi* → *garantiamo l'accuratezza di ciò che leggi*.

## Pass C: UI context and brevity (9 strings changed)

- `common:fit.gpa.scale`: *Su* → *Scala*. A one-word preposition did not work as a field label.
- `common:fit.order`: "Consigliate" → «Consigliate». Uses Italian quotation marks. The same change was made in 3 more strings with quoted tier names.
- `student:dashboard.nextAction.ARRIVAL_CHECKLIST.text`: *checklist per l'arrivo* → *checklist dell'arrivo*.
- `mobile:v3.quick.open`: *Scopri le tue opzioni, senza account* → *Scopri le tue opzioni senza account*.
- `marketing:hero.searchHint`: *Gratis, senza account* → *Gratis e senza account*.

## Final: source ↔ target comparison

The whole set was compared with the English and Korean for meaning, placeholders and tags, register and the "no guarantee / no ranking" rule. Two more strings changed:

- `v22.home.appsQuiet_*`: *è all'università* → *è all'esame dell'università*. Clearer that the application is under review.

The `{{country}}` strings were written from the start with *Paese: {{country}}* or *({{country}})*. Italian needs articles and prepositions that depend on the country (*il Giappone*, *nelle Filippine*), and this pattern avoids that. Cities use *a {{city}}*.

No string promises admission or chances. *Consigliate* is always explained as a browsing order. Every placeholder and `<em>` tag is preserved. The Hangul in the English `v20.uni.why.breadthBody` (대학알리미) was dropped and only *Academy Info* kept.

Validator: `node scripts/i18n/v27/validate.mjs --only=it` reports 729 strings valid, 0 problems.

## Unsure

- `fit.level.ASSOCIATE` *Diploma biennale*: Italy has no direct equivalent of 전문학사. The closest are ITS diplomas, which are not identical.
- `fit.level.TRANSFER` *Trasferimento in laurea triennale*: understandable, but Italian universities more often say *trasferimento da altro ateneo*.
- `v9.funds.longer_*`: the lower government tier (컨설팅) is left as «consulting». No official Italian name exists.
- `fit.gpa.placeholder` *es. 3.6*: Italian uses a decimal comma. The dot was kept until it is confirmed whether the field accepts commas.
- `fit.track.*` *Corsi in coreano / in inglese*: these also appear inside `fit.reason.met_track` in parentheses, where the capital letter is slightly unusual.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Per candidarti non è richiesto alcun punteggio linguistico. Dopo l'ammissione ti servirà {{tests}} o più.
- `fit.reason.far` → Richiede {{options}} o più, molto al di sopra del tuo punteggio attuale.
- `fit.tier.UNCLEAR.title` → Per ora la strada è ancora lunga
- `fit.tier.UNCLEAR.short` → Più preparazione
- `fit.tier.UNCLEAR.lede` → Il tuo punteggio attuale è molto al di sotto del requisito pubblicato. Concediti più tempo per prepararti, poi ricontrolla.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
