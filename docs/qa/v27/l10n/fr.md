# V27 localization review: fr (French, France)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched).
Output: `scripts/i18n/v27/tx/fr.json`.

Variant and register: metropolitan French, *vous* throughout, as in the existing bundle `packages/i18n/locales/fr/`.

Established bundle terms kept: *conseiller*, *l'équipe Hangyul*, *Messages*, *Rédaction* (the Writing section), *essais*, *correspondances*, *apostille*, *Convention Apostille*, *légalisation consulaire*, *lettre d'admission*, *carte de résident*, *e-visa*, *frais de scolarité*, *frais de candidature*, *téléverser* (the bundle's verb for upload, 80+ uses).

French typography applies throughout: a no-break space before `: ; ? ! %` and inside « », and a no-break thousands separator (1 500 wons).

## Personas

1. **Chloé, 18, Lyon.** Terminale student who wants a *licence* in Seoul after a year in a university Korean language institute.
2. **Karim, 27, Paris.** Data engineer applying for an English-taught *master*. He wants precise criteria, deadlines and visa steps.
3. **Sylvie, 50, Chloé's mother.** She pays the fees and the bank balance for the visa. She is wary of intermediaries and of anything that sounds like a promise.

## Glossary

| English | Korean | fr rendering |
|---|---|---|
| scholarship | 장학(금) | bourse |
| Global Korea Scholarship (GKS) | 정부초청장학 | Bourse du gouvernement coréen (GKS) for the label; *Global Korea Scholarship (GKS)* in running text, as in the bundle |
| admission guide | 모집요강 | guide d'admission |
| apostille / Apostille Convention | 아포스티유 | apostille / Convention Apostille |
| consular legalization | 영사확인 | légalisation consulaire |
| Korean language institute | 어학당 | institut de langue coréenne |
| admission letter | 표준입학허가서 | lettre d'admission (standard) |
| CCVI | 사증발급인정서 | certificat de confirmation de délivrance de visa (CCVI) |
| e-visa | 전자비자 | e-visa |
| D-2 / D-4 visa | D-2 / D-4 | visa D-2 / D-4 |
| residence card | 외국인등록증 | carte de résident |
| immigration office | 출입국관리사무소 | bureau de l'immigration |
| proof of funds / bank certificate | 재정 증빙 / 잔고증명서 | justificatif de ressources / attestation de solde bancaire |
| tuition | 등록금 | frais de scolarité |
| requirement | 요건 | critère |
| upload | 업로드 | téléverser |
| counselor | 상담사 | conseiller |
| Hangyul team | 한귤 상담팀 | l'équipe Hangyul |
| essay | 에세이 | essai |
| Recommended (sort) | 추천순 | Recommandées (a browsing order, explicitly not a ranking) |
| notarized | 공증 | certifié par un notaire |
| checklist | 체크리스트 | liste de vérification (application checklist: liste de tâches) |
| plan (paid) | 플랜 | formule |

## Pass A: meaning (12 strings changed)

- **`{{country}}` grammar (8 strings).** `legalFlow.note.JOINS` changed from *{{country}} adhère…* to *Pays concerné : {{country}}, qui adhère…*. French needs an article or preposition that depends on the country (*le Japon / au Japon / aux Philippines / en Inde*), and a bare `{{country}}` produces wrong grammar for many countries. All 8 strings with this placeholder now use the pattern the bundle already uses (*Pays concerné : …*, or *({{country}})*).
- `marketing:legal.upcoming`: *{{country}} adhère à la Convention Apostille* → *Changement le {{date}} ({{country}}) : adhésion à la Convention Apostille*.
- `student:v9.money.note.VISA_FEE_AS_PUBLISHED`: *indique ce montant en toutes lettres* → *décrit ces frais par un texte, sans montant chiffré*. *En toutes lettres* means a spelled-out number, which is not what the source says.
- `student:dashboard.stageText.VISA`: *Votre admission est finalisée* → *Vos démarches d'admission sont terminées*. Follows the Korean 입학 절차를 마쳤어요.
- `visaroute:state.OTHER_RESIDENCE`: *Vous résidez en {{country}}* → *Votre pays de résidence est {{country}}*.

## Pass B: native naturalness (16 strings changed)

- `student:support.emptyText`: *Aucune question n'est trop petite* (a calque) → *Il n'y a pas de question bête.*
- `student:v9.money.payee.EVERYDAY`: *payés au fil de l'eau* → *réglés au quotidien*.
- `common:fit.level.ASSOCIATE`: *Diplôme de premier cycle court* → *Diplôme court (bac+2)*.
- `marketing:trust.lede`: *nous gardons ce que vous lisez exact* → *nous veillons à l'exactitude de ce que vous lisez*.
- `marketing:hero.lede` (and two related strings): *passez le cap du visa* → *franchissez les étapes du visa*.

## Pass C: UI context and brevity (104 strings changed)

Most of these changes are typographic. 100 strings got no-break spaces before `: ; ? ! %`, inside « », and in 1 500 wons, so a line never breaks before a colon or a percent sign. Four more strings changed:

- `common:fit.tier.MEETS.short`: *Minimums remplis* → *Critères remplis*, matching the term used in the tier title and lede.
- `student:dashboard.nextAction.TASK.text.APPLICATION_SUBMIT`: *quand vous vous sentez prêt* → *quand vous le souhaitez*. Gender-neutral.
- `student:login.subtitle`: *là où vous vous étiez arrêté* → *là où vous en étiez*. Gender-neutral.
- `marketing:v20.city.Seoul.body`: *vous n'êtes donc pas obligé* → *rien ne vous oblige donc*. Gender-neutral.
- `common:fit.q.nationality`: *nationalité ?* → *nationalité ?*, with a no-break space before the question mark (typography only).

## Final: source ↔ target comparison

The whole set was compared with the English and Korean for meaning, placeholders and tags, register, gender neutrality and the "no guarantee / no ranking" rule. One more string changed: `mobile:v3.home.stageLine.admission` *Admis.* → *Admission obtenue.*, which is gender-neutral.

No string promises admission or chances. *Recommandées* is always explained as an order for browsing. Every placeholder and `<em>` tag is preserved. The Hangul in the English `v20.uni.why.breadthBody` (대학알리미) was dropped and only *Academy Info* kept.

Validator: `node scripts/i18n/v27/validate.mjs --only=fr` reports 729 strings valid, 0 problems.

## Unsure

- `v9.funds.longer_*`: the lower government tier (컨설팅) is left as « consulting ». No official French name exists, and a translation might not match what the embassy writes.
- `fit.level.TRANSFER` *Admission parallèle en licence*: this is the French-system concept closest to 편입. Belgian and Swiss readers may know other terms.
- `fit.gpa.placeholder` *ex. : 3.6*: French uses a decimal comma. The dot was kept until it is confirmed whether the field accepts commas.
- `v4.docs.essayWrite` *Vous la rédigez*: the pronoun follows the bundle and assumes a feminine document (*lettre*). An *essai* would take *le*.
- `uni27.service.BUDDY` *Programme de parrainage*: the most common French name. Some universities say *programme buddy*.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Aucun score de langue n'est exigé pour postuler. Après l'admission, il vous faudra {{tests}} ou plus.
- `fit.reason.far` → Exige {{options}} ou plus, bien au-dessus de votre score actuel.
- `fit.tier.UNCLEAR.title` → Encore du chemin à faire
- `fit.tier.UNCLEAR.short` → Plus de préparation
- `fit.tier.UNCLEAR.lede` → Votre score actuel est bien en dessous du critère publié. Prévoyez plus de temps pour vous préparer, puis revenez vérifier.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
