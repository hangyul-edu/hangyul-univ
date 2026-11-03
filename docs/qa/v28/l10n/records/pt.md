# V28 l10n review — European Portuguese (pt)

Scope: every key of `scripts/i18n/v28/jobs/pt.json` (370 keys: 254 with no translation, 116 with an existing `current`). Output: `scripts/i18n/v28/tx/pt.json`.
Variant and register: **European Portuguese** (pt-PT, AO90 spelling). Students and console users are addressed in the polite third person (*o seu / a sua*, *Escolha*, *Peça*); *você* is never written. Terms: *equipa Hangyul*, *candidatura*, *telemóvel*, *registo*, *ecrã*, *carregar*, *aplicação*, *cofre de documentos*, *secção Escrita*, *redação*, *compatibilidade*, *propinas*.

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/pt.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Inês, 18, Porto** | 12.º ano, first-time visitor, wants a licenciatura in Seoul after a Korean language year | plain, polite EP copy; no Brazilian forms |
| **Tiago, 26, Lisboa** | software engineer comparing English-taught mestrados across services (comparison shopper) | visa and document detail, honest claims |
| **Paula, 49, mãe da Inês** | pays propinas and the bank balance | who is paid, refunds, no promises |

## Glossary

| English | Korean | European Portuguese | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | bolsa |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Bolsa do Governo da Coreia (GKS) |  |
| admission guide | 모집요강 | guia de candidatura |  |
| apostille | 아포스티유 | apostila |  |
| consular legalization | 영사확인 | legalização consular |  |
| certificate of enrollment | 재학증명서 | certificado de matrícula |  |
| Korean language institute | 어학당 | instituto de língua coreana |  |
| D-2 / D-4 visa | D-2 / D-4 | visto D-2 / D-4 |  |
| e-visa | 전자비자 | visto eletrónico |  |
| residence card | 외국인등록증 | cartão de residência |  |
| proof of funds | 재정 증빙 | comprovativo de meios financeiros |  |
| tuition | 등록금 | propinas |  |
| application fee | 전형료 | taxa de candidatura |  |
| application | 지원 | candidatura | never *cadastro/inscrição* for 지원 |
| intake | 모집 시기 | ingresso |  |
| program(me) | 과정 | programa |  |
| the Hangyul team | 한귤 상담팀 | a equipa Hangyul | *equipa*, never *equipe*; replaces every *o seu consultor* |
| plan (paid) | 플랜 | plano |  |
| match | 매칭 | compatibilidade |  |
| Recommended (sort) | 추천순 | Recomendadas |  |
| Needs more preparation (far tier) | 준비가 더 필요 | Precisa de mais preparação |  |
| Needs checking with us (unverified tier) | 추가 확인 필요 | A verificar connosco |  |
| dormitory | 기숙사 | residência universitária |  |
| enrollment | 등록 | matrícula |  |
| consular post | 공관 | posto consular |  |
| upload | 업로드 | carregar | never *baixar/subir* |

## Pass A — meaning (60 strings changed)

Every *o seu consultor* → *a equipa Hangyul*; fit tiers re-cut to the V28 English; `step.slow_items.why` *Confirmações* → *Legalizações*; `docCategory.EMPLOYMENT_INCOME_PROOF` *Comprovante … renda* (pt-BR) → *Comprovativo de emprego ou rendimentos*.

| Key | Before | After |
| --- | --- | --- |
| `visaroute:step.slow_items.why` | Confirmações, o teste de tuberculose e os certificados de registo criminal demoram semanas. | Legalizações, o teste de tuberculose e os certificados de registo criminal demoram semanas. |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Comprovante de emprego / renda | Comprovativo de emprego ou rendimentos |
| `concierge:help.route.HOUSING` | O seu consultor | A equipa Hangyul |
| `common:fit.tier.UNCLEAR.title` | Ainda há um longo caminho | Precisa de mais preparação |
| `common:fit.tier.CHALLENGE.title` | Merecem um olhar atento | A verificar connosco |

## Pass B — native naturalness (14 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `visaroute:form.notice` | Apenas para a sua preparação. Será você a preencher e assinar o formulário oficial (ou a sua universidade pede o visto eletrónico). A Hangyul nunca envia nem declara nada por si. | Apenas para a sua preparação. O formulário oficial é preenchido e assinado por si (ou a universidade pede o visto eletrónico). A Hangyul nunca envia nem declara nada em seu nome. |
| `agency:inbox.pickText` | Ou inicie uma nova com qualquer estudante que acompanha. | Ou inicie uma nova com qualquer estudante que acompanhe. |
| `agency:v8.view.docs` | Correção de documentos necessária | Documentos a corrigir |
| `concierge:housing.honest` | Só mostramos informações das residências com a respetiva fonte, e quartos que um fornecedor nos tenha realmente disponibilizado — cada um identificado. Nunca inventamos anúncios. | Só mostramos informações das residências com a respetiva fonte, e só quartos que um fornecedor tenha realmente oferecido, cada um identificado. Nunca inventamos anúncios. |
| `marketing:v15.pricing.compare.value.dormitory_support.APPLICATION` | Apoio na candidatura e alternativas | Ajuda na candidatura, e alternativas |

## Pass C — UI context, brevity, one term per concept (13 strings changed)

BR→EP normalisation: two existing strings carried Brazilian forms (`visaroute:form.notice` *Será você a preencher*, `common:docCategory.EMPLOYMENT_INCOME_PROOF` *Comprovante / renda*); both rewritten. All 254 new strings were written in EP and the full output was grepped with Unicode-aware word boundaries for *você(s), cadastr-, celular, ônibus, tela(s), equipe, usuário, arquivo, contato, registro, fato, baixar, Vietnã*, *estar + gerúndio*: 0 hits.

| Key | Before | After |
| --- | --- | --- |
| `agency:ws.docsHint` | … do arquivo do estudante … (draft) | … do cofre de documentos do estudante … (bundle term; *arquivo* reads pt-BR for a file store) |
| `agency:tasksPage.forStudent` | (fica visível na app dele) (draft) | (fica visível na aplicação dele) |
| `marketing:v9.faq.languagesA` | A app para estudantes … (draft) | A aplicação para estudantes … |
| `success:item.ESSAY_WRITE.title` | Escreva a sua {{labelLower}} (draft) | Escrever: {{labelLower}} (avoids gender agreement with an unknown noun) |
| `student:v4.ws.team.approvedEssay` | Aprovou a sua {{essay}} (draft) | Aprovou o seu texto: {{essay}} |

(5 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

All keys re-read against `en`/`ko`; placeholders identical; no Hangul; *legalização consular* for 영사확인; no *consultor* left; validator FORBID list (você/cadastro/celular/ônibus/tela) passes, and an independent Unicode-aware scan (the validator's `\bvocê\b` cannot match *você* before a space or punctuation, because *ê* is not a `\w` character) also finds 0.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 5 | 4 | **27** (22: draft kept "Um diagnóstico, as candidaturas…"; now *Escolha quanta ajuda quer: …*) |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 5 | 4 | 4 | 5 | **27** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (22: *Pronto para levar isto a sério?* (also masculine-only) → *Está a pensar candidatar-se aqui?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `dossier:agency.title` — *Dossiê* — valid in EP dictionaries, but some EP UIs keep *Dossier*.
- `university:v28.pipe.label` — *Funil* for "pipeline" — common in EP CRM tools, may read as sales jargon.
- `agency:tasksPage.forStudent` — *na aplicação dele* assumes a male student; the bundle has no neutral pattern for this.
- `marketing:v20.uni.philosophySource` — *da {{name}}* assumes a feminine university name (*a Universidade …*); wrong for names like *KAIST*.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 370 | 34 | 82 | 254 |

BR→EP fixes in existing strings: 2. Brazilian forms found in new strings after drafting: 0 (the draft-stage *app*/*arquivo* choices above were bundle-consistency changes, not pt-BR forms).

Validator: `node scripts/i18n/v28/validate.mjs --only=pt` → `370 strings valid, 0 problems`.


## V28 pt-PT normalisation

Follow-up run on the existing `packages/i18n/locales/pt/` strings outside the V28 job. These are the 136 strings my scan flagged: *você/vocês*, *estar + gerúndio*, *equipe*, *registro*, *contato*, *tela*, *Vietnã*, *arquivo*, *celular*, *baixar*, *fato*. The scan uses Unicode-aware word boundaries. The patch, in v23-set format, is in `scripts/i18n/v28/source-pt-pt.json`. I did not apply it myself.

| Namespace | Strings patched |
| --- | --- |
| marketing | 108 |
| common | 18 |
| student | 5 |
| visaroute | 3 |
| dossier | 1 |
| success | 1 |
| **Total** | **136** |

- **Placeholders and tags:** identical in all 136 strings (checked by script).
- **Re-scan:** with the patch overlaid on the bundle, the scan finds **0** remaining strings.
- **Marketing:** whole strings were transcreated, not word-swapped. Some pt-BR forms the scan does not look for were fixed in passing: *mensalidade* → *propinas*, *checklist* → *lista de tarefas / lista de verificação*, *moradia* → *alojamento*, *chip de celular* → *cartão SIM*, *salvamos* → *guardamos*, *em um relance* → *num relance*, *carteira de residente* → *cartão de residência*, *Ótimo* → *Muito bem*.
- **Student-facing team:** the 5 strings that said *seu consultor* now say *a equipa Hangyul*.
- **Brand article:** the 6 strings that said *o Hangyul* now say *a Hangyul*.
- **Labels that said *Você*:** student-app ownership labels became *Do seu lado*, matching `v26.now.owner.STUDENT`. Marketing diagram labels became *O estudante*.

Uncertain:
- *Do seu lado* and *O estudante* as replacements for the *Você* labels.
- `common:states.offline`: *Está sem ligação à internet*.
- `marketing:v8.work.writing.comment`: *mídia* became *comunicação social*.
- `marketing:agenciesPage.valueEyebrow`: *O que a sua agência recebe*.
- The masculine *o* in *mencionou-o* and *o levou*.

## Second pass (jobs2): leak families the crawl missed

Input `scripts/i18n/v28/jobs2/pt.json` → output `scripts/i18n/v28/tx2/pt.json`. Same personas, glossary and method as the first pass. Every student-facing *your counselor* → *a equipa Hangyul* (18 strings); the console label `agency.ownerShort.counselor` keeps the console term. Placeholders `{{counselor}}`/`{{name}}` stay the person's name.

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 630 (marketing 2 · student 39 · success 465 · dossier 124) | 0 | 0 | 630 (all `current` were null; 3 keys whose English is empty stay empty) |

- Pass A (meaning): 18 strings changed (*your counselor* → team; consular legalization and apostille kept apart: `item.DOC_LEGALIZE*` vs `item.DOC_LEGALIZE_APOSTILLE*`, `dossier:path.*`).
- Pass B (naturalness): 4 (`page.privacy` from a stiff *Só o próprio* to a passive with *por si*; `workspace.nothingNeeded` word order; `obs.SOME_OVER_BUDGET_*` made explicit about cost).
- Pass C (UI context, one term per concept): 15 (EP vocabulary throughout: *carregar*, *transferir*, *ficheiro*, *palavra-passe*, *comprovativo*, *iniciar sessão*, *equipa*, *submeter/submissão*, *portefólio*, *caducar*; no *você/tu*: imperatives in the 3rd person plus *o seu/si*; status chips *(verificação concluída)*/*(fora de validade)* so they do not agree in gender with `{{doc}}`).
- Final comparison: every key checked against en and ko. The three keys whose English is empty (`dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`) stay empty.

### 5 examples (English shown on the page before → after)

- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}} ainda precisa de legalização consular*
- `success:item.SCHOLARSHIP_NONE.why`: *You said you need one. Ask your counselor about other options.* → *Indicou que precisa de uma. Pergunte à equipa Hangyul por outras opções.*
- `success:submission.safety`: *Never share your portal password. Hangyul will never ask for it.* → *Nunca partilhe a palavra-passe do portal. A Hangyul nunca a vai pedir.*
- `dossier:page.privacy`: *Only you, your counselor and Hangyul can see these files. …* → *Estes ficheiros só podem ser vistos por si, por quem acompanha a sua candidatura e pela Hangyul. …*
- `success:obs.SOME_OVER_BUDGET_other`: *{{count}} of your applications start above your budget.* → *O custo de {{count}} das suas candidaturas começa acima do seu orçamento.*

### Marketing scorecard (2 keys)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v20.uni.intl (officeLine, none) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

### Unsure

- *ensaio* for essay. The bundle mixes *ensaio* (student copy) and *redação* (agency console); I used *ensaio* everywhere.
- Masculine generics: *Fique atento*, *protege-o se não for admitido*, *quando estiver pronto*.
- `dossier:page.privacy`: *quem acompanha a sua candidatura* for 담당 상담사.
- `submission.guided.enterHint` *ocultado* for "masked"; *média* for GPA.
- `success:queue.fixture` *Dados de teste* (tautological note, as in the English).

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=pt` → `630 strings valid, 0 problems`.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
