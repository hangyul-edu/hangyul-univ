# V27 localization review: pt (Portuguese, Portugal)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 `new`, 514 `changed`; `changed` strings were translated again from the V27 English, not patched).
Output: `scripts/i18n/v27/tx/pt.json`.

Variant: European Portuguese (pt-PT), spelled to the 1990 Orthographic Agreement. The existing bundle `packages/i18n/locales/pt/` is mostly pt-PT: *equipa* 126×, *telemóvel* 24×, *registo* 46×, *verificámos*. A few older pt-BR strings remain there (*Nova York*, *moradia*, *seu visto*). V27 follows the majority variant: *equipa*, *telemóvel*, *propinas*, *carregar*, *ficheiro*, *ecrã*, *comboio*, *está a + infinitive*. Students are addressed in the polite third person (*o seu / a sua*, imperative *Escolha*, *Carregue*), and *você* is never written out.

Established bundle terms kept: *consultor*, *equipa Hangyul*, *Mensagens*, *secção Escrita*, *redações*, *compatibilidades*, *apostila*, *legalização consular*, *carta de admissão*, *cartão de residência*, *visto eletrónico*, *taxa de candidatura*.

## Personas

1. **Inês, 18, Porto.** Finishing secondary school (12.º ano). She wants a *licenciatura* in Seoul after a year at a Korean language institute.
2. **Tiago, 26, Lisboa.** Software engineer applying for a *mestrado* taught in English. He reads every visa and document detail.
3. **Paula, 49, Inês's mother.** She pays the *propinas* and the bank balance for the visa. She is wary of agents, transfers and promises.

## Glossary

| English | Korean | pt-PT rendering |
|---|---|---|
| scholarship | 장학(금) | bolsa |
| Global Korea Scholarship (GKS) | 정부초청장학 | Bolsa do Governo da Coreia (GKS) for the label; *Global Korea Scholarship (GKS)* in running text, as in the bundle |
| admission guide | 모집요강 | guia de candidatura |
| apostille / Apostille Convention | 아포스티유 | apostila / Convenção da Apostila |
| consular legalization | 영사확인 | legalização consular |
| Korean language institute | 어학당 | instituto de língua coreana |
| admission letter | 표준입학허가서 | carta de admissão (normalizada) |
| CCVI | 사증발급인정서 | Certificado de Confirmação de Emissão de Visto (CCVI) |
| e-visa | 전자비자 | visto eletrónico |
| D-2 / D-4 visa | D-2 / D-4 | visto D-2 / D-4 |
| residence card | 외국인등록증 | cartão de residência |
| immigration office | 출입국관리사무소 | serviço de imigração |
| proof of funds / bank certificate | 재정 증빙 / 잔고증명서 | comprovativo de meios financeiros / declaração de saldo bancário |
| tuition | 등록금 | propinas |
| application / to apply | 지원 | candidatura / candidatar-se (for the visa: *pedido de visto / fazer o pedido*) |
| upload | 업로드 | carregar |
| counselor | 상담사 | consultor |
| Hangyul team | 한귤 상담팀 | a equipa Hangyul |
| essay | 에세이 | redação |
| Recommended (sort) | 추천순 | Recomendadas (a browsing order, never a ranking) |
| notarized | 공증 | certificado por notário |
| checklist | 체크리스트 | lista de verificação (application checklist: lista de tarefas) |

## Pass A: meaning (14 strings changed)

- `common:uni27.schol.youMay` and the 4 `fit.schol.*` / `budget.possible_*` strings: *Pode cumprir* → *Poderá cumprir*. *Pode* also reads as "you are allowed to", which overstated "you may meet the conditions".
- `student:matches.tierText.REACH`: *Ainda falta cumprir um ou dois requisitos* → *Ainda não cumpre um ou dois requisitos*. Matches "not met yet" exactly.
- `common:uni27.intl.kli_named`: *no {{name}}* → *em {{name}}*. The article assumed a masculine institute name.
- `marketing:v7.why.realistic.text`: *porque é elegível* → *porque cumpre os requisitos*. "Eligible" was implying more than "meets the published requirements".
- `student:dashboard.nextAction.PROFILE_UNLOCK.gpa.text`: *a quais não pode candidatar-se* → *em quais não cumpre os requisitos*. Matches "which ones you don't qualify for".

## Pass B: native naturalness (18 strings changed)

- `student:essays.subtitle`: *é o próprio que decide* → *a decisão sobre o que mudar é sua*. The draft wording was stiff, and this avoids writing *você*.
- `student:v17.upgrade.whyDefault`: *Ao fazer o upgrade* → *Ao mudar para um plano superior*. Removes the anglicism.
- `marketing:v20.city.Incheon.body`: *a Chinatown* → *o bairro chinês*.
- `marketing:trust.principles.demo.text`: *di-lo claramente* → *está assinalado como tal*.
- `visaroute:reason.WAITING_UNIVERSITY`: *A {{university}} envia-o. Nada a fazer…* → *É a {{university}} que o envia. Não há nada a fazer…*

## Pass C: UI context and brevity (8 strings changed)

- `common:fit.gpa.scale`: *Em* → *Escala máxima*. A bare "Em" did not work as a field label. The Final pass shortened it to *Escala*.
- `common:fit.tier.CHALLENGE.short`: *Vale a pena ver* → *Merece um olhar*. The title was aligned to match.
- `marketing:home.show.match.p1`: *elegível, quase ou ainda não* → *elegível, quase lá ou ainda não*.
- `student:dashboard.nextAction.ARRIVAL_CHECKLIST.text`: shortened, and keeps "lista de verificação" as the single checklist term.
- `marketing:hero.searchHint`: *Grátis e sem conta* → *Grátis, sem conta*.

## Final: source ↔ target comparison

The whole set was compared with the English and Korean for meaning, placeholders and tags, register and the "no guarantee / no ranking" rule. Ten more strings changed:

- `fit.gpa.scale` → *Escala*.
- **`{{country}}` grammar (9 strings).** Portuguese needs a contracted article that depends on the country (*no Japão / na Índia / em Portugal / o Japão adere*), so *em {{country}}* and *{{country}} adere* are wrong for many countries. Example: `legalFlow.note.JOINS` *{{country}} adere à Convenção…* → *País: {{country}}. Adere à Convenção…*. All 9 strings now use *País: …* or *({{country}})*, matching the pattern used in the bundle's French and Spanish strings.

A scan of all 729 strings found none of these pt-BR markers: *você*, *celular*, *equipe*, *tela*, *arquivo*, *registro*, *trem*, *Nova York*, *está + gerúndio*. No string promises admission or implies a ranking. Every placeholder and `<em>` tag is preserved. The Hangul in the English `v20.uni.why.breadthBody` (대학알리미) was dropped and only *Academy Info* kept.

Validator: `node scripts/i18n/v27/validate.mjs --only=pt` reports 729 strings valid, 0 problems.

## Unsure

- **Variant inconsistency in the bundle.** Some existing pt bundle strings are pt-BR, such as *Edital GKS 2026* and *Conheça seu visto*. V27 is pt-PT throughout, so older and newer screens may mix variants until the bundle is harmonised.
- `fit.level.ASSOCIATE` *Curso técnico superior*: the closest Portuguese equivalent of 전문학사 (the 2-year CTeSP). It is not an exact match.
- `uni27.service.BUDDY` *Programa buddy*: an anglicism, but it is what Portuguese universities use.
- `fit.gpa.placeholder` *p. ex., 3.6*: Portuguese uses a decimal comma. The dot was kept until it is confirmed whether the field accepts commas.
- Feminine article before `{{university}}` (*a {{university}}*): this is natural when the name begins with "Universidade". A few institutions (KAIST, POSTECH) would normally take *o*.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Não é exigido nenhum resultado de língua para se candidatar. Depois da admissão, vai precisar de {{tests}} ou mais.
- `fit.reason.far` → Exige {{options}} ou mais, muito acima do seu resultado atual.
- `fit.tier.UNCLEAR.title` → Ainda há um longo caminho
- `fit.tier.UNCLEAR.short` → Mais preparação
- `fit.tier.UNCLEAR.lede` → O seu resultado atual está muito abaixo do requisito publicado. Reserve mais tempo para se preparar e volte a verificar.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
