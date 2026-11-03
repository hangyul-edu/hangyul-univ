# V31 native-quality review — European Portuguese (pt)

Locale `pt` (Portugal; strictly European Portuguese, post-AO90 spelling). Job `scripts/i18n/v28/jobs-v31/pt.json`,
output `scripts/i18n/v28/tx-v31/pt.json`, glossary `docs/qa/v31/l10n/glossary/pt.json`. Brief:
`docs/qa/v31/l10n/BRIEF.md`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,374 (incl. 28 `v31` keys whose existing Portuguese already says what the new source says) |
| Rewritten | 355 |
| — new source (`v31`) | 162 |
| — meaning | 44 (most on `v31` keys where the old Portuguese also misstated the contract) |
| — terminology | 63 (incl. 35 «equipa Hangyul (Univ)» → «equipa da Hangyul») |
| — naturalness (incl. Brazilian forms) | 71 |
| — quality (UI role / format / gender agreement) | 15 |
| Extra CLDR plural forms added (`_many`, copy of `_other`) | 40 |

Reason codes for the first three namespaces (common, concierge, dossier) were reconstructed after a host reboot from
the review notes; the texts themselves were preserved on disk. The four missing keys
(`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`, `student:home.documentsSub_one`,
`student:v8.compare.budget_one`) were translated. `marketing:v15.pricing.compare.item` is empty like the English (it held
«Item»). `marketing:v12.terms.universityInfo.p` contained Hangul (대학알리미); it now says Academy Info.
`marketing:v11.nav.faq` was too long; it is «Dúvidas frequentes».

Register: no `você` and no `tu`. The owner marketing copy (`v11.*`) had been written with `tu` («Cria uma conta e
mostramos-te…», «precisas», «começares connosco»); it is now in the impersonal / third-person form used by the rest of the
product («Crie», «o seu», «consigo»). Gendered forms that assumed a male reader («Foi admitido», «Bem-vindo», «guiá-lo
no resto», «ficar trancado», «Já instalado», «Novo no…») were made neutral where the sentence allows it.

Brazilian forms removed (the validator's list plus the ones it does not catch): «Senha» → «Palavra-passe», «Salvar» →
«Guardar», «Pular» → «Saltar», «Trilha de navegação» → «Caminho de navegação», «Carregando»/«Preparando» (gerund) →
«A carregar»/«A preparar», «Oferta aceita» → «aceite», «Mensalidade» → «Propinas», «Bacharelado» → «Licenciatura»,
«Comprovante» → «Certificado/Comprovativo», «Histórico escolar» → «Certificado de notas», «Mídia» → «Media»,
«acadêmico» → «académico», «Moradia» → «Alojamento», «Configurações» → «Definições», «Administração» (field) →
«Gestão», «redações» → «textos», «Próxima» → «Seguinte», «Não encontramos» → «Não encontrámos».

Terminology applied: «carta de motivação» and «plano de estudos» (the GKS document names); editing = «correção» /
«ronda de correção», distinct from review = «revisão» (the old copy used «revisão» for both, blurring two plan rows);
«indicações sobre o que corrigir»; «candidaturas que gerimos consigo» (not «geridas pela equipa», which reads as
Hangyul applying on the student's behalf); «apostila» and «legalização consular» (never bare «legalização»);
«certificação notarial» (not «autenticado por notário» / «reconhecimento notarial» mixed); «instituto de língua
coreana» (not «escola de línguas»); «oferta de admissão»; «transfer do aeroporto com um parceiro» (not «recolha», which
in Portugal reads as collecting goods); «simulação de entrevista»; «semestre de entrada» for intake (not «ingresso»);
«a equipa da Hangyul» everywhere the source says "the Hangyul team"; brand treated as feminine («a Hangyul»), as the
existing copy already did. Task strings with a category placeholder use «o documento {{category}}» / «o texto
{{essay}}» so the article no longer clashes with feminine document names («o seu Carta de motivação»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Período de consultas» — the support window read as a period of consultation sessions | «Período para colocar questões após a consulta» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that new documents, translation and notarization are not included in Premium | full exclusion added |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` / `all_in_one.f5` | «Preparação dos documentos» / «Documentos do visto preparados» — Hangyul appears to prepare them | «Apoio na preparação dos documentos do visto» |
| 4 | `common:v29.pricing.notes.visaDecision` | «a decisão cabe à autoridade competente» — vague | «A concessão do visto é decidida pelas autoridades de imigração» |
| 5 | `common:v29.addon.item.airport_pickup`, `concierge:step.pickup.*` | «Organização da recolha no aeroporto», «Alguém espera por si» — no partner; Hangyul appears to run transport | «Transfer do aeroporto com um parceiro»; «O parceiro do transfer espera por si nas chegadas» |
| 6 | `common:v29.addon.item.extra_application`, `premium.f2`, `compare.row.managed` | «Candidatura adicional gerida pela equipa», «Até 3 candidaturas geridas pela equipa» — reads as Hangyul applying for the student | «Mais uma candidatura que gerimos consigo»; «Gerimos consigo até 3 candidaturas» |
| 7 | `common:v29.pricing.premium.position` | dropped the application stage | «desde a candidatura até ao visto, à chegada e às primeiras semanas na Coreia» |
| 8 | `common:v29.pricing.all_in_one.f3`, `compare.row.essay`, `v15…essay_review_rounds`, `terms.*` | essay editing called «revisão» (same word as document review); `compare.row.essay` was only «Carta de motivação e plano de estudos» (no service named) | «correção» / «ronda de correção» |
| 9 | `marketing:v11.services.s1.text` | «assumimos todo o processo», «escolas de língua», «realmente correspondem» | we suggest institutes, go through scholarships, then help prepare documents and deal with the university |
| 10 | `marketing:v11.why.s3.text` / `.title` | «garante que a tua vida de estudante decorre com tranquilidade», «O custo mais razoável, o melhor resultado» — guarantee and outcome promise | fair price, careful help, see what the plan includes before paying; «Um preço justo, sem surpresas» |
| 11 | `marketing:v11.why.s1.text` | «Assumimos todas as etapas», «o parceiro que te leva até ao resultado» | «Ajudamos em cada etapa… Trabalha com a mesma equipa do início ao fim» |
| 12 | `marketing:v11.faq.q6.a` | «Todas as universidades oferecem bolsas» | «A maioria sim…» |
| 13 | `marketing:v11.faq.q2.a` | «precisas de um certificado» — stated as universal | «A maioria… pede»; some accept their own test instead |
| 14 | `marketing:v11.hero.lede` / `.title` | «Transformamos o teu sonho em realidade», «Estudar na Coreia é simples!» | find the right university and complete each step with a team beside you; «…mais fácil do que pensa» |
| 15 | `marketing:v11.services.s3.title` | «mais forte porque estão juntos» — not the source claim | «Uma comunidade de estudantes que já passaram por isto» |
| 16 | `marketing:v11.services.s2.text` / `.title` | «Tratamos juntos de tudo o que é preciso», «não há preocupações» — overclaims | help with visa application, residence card and course registration; «apoio até estar instalado» |
| 17 | `marketing:v11.faq.q1.a` | «autenticado por notário + apostila», «passaporte estrangeiro» | «com certificação notarial e apostila»; passport/ID wording per source |
| 18 | `marketing:v12.privacy.collect.profile.purpose` | «preparar um plano de estudos» — reads as the essay document | «planear os seus estudos no estrangeiro» |
| 19 | `marketing:v12.privacy.collect.verification.purpose` | «impedir registos automatizados» for fraudulent sign-ups | «impedir registos fraudulentos» |
| 20 | `marketing:v12.privacy.security.roles` | «vê apenas os seus próprios casos» — not "students assigned to them" | «só vê os estudantes que lhe foram atribuídos» |
| 21 | `marketing:v12.terms.services.documents` | «Preparação e revisão dos documentos» — Hangyul appears to prepare them | «Apoio na preparação dos documentos de candidatura e revisão de documentos» |
| 22 | `marketing:v20.city.Gyeonggi.line` / `.body` | «mais verde» for roomier; dropped that more students live in dormitories | «mais espaçosa»; «por isso mais estudantes vivem em residências universitárias» |
| 23 | `marketing:v20.uni.intl.admissionsLine` | «tratadas numa página separada» — a page, not an admissions track | «Tem um processo de admissão próprio para estudantes internacionais» |
| 24 | `marketing:v15.pricing.lede` | «uma avaliação inicial, as suas candidaturas ou a instalação» | «uma consulta de diagnóstico, apoio nas candidaturas ou acompanhamento até estar instalado» |
| 25 | `student:discover.verdict.reach`, `success:group.possible` | «Possivelmente compatível» / «Compatibilidade possível» — loses "meets requirements" | «Cumpre os requisitos, a confirmar» |
| 26 | `student:v4.ws.team.final` | «Verificação final e depois envio da sua candidatura» — Hangyul appears to submit | «Verificação final antes de enviar a sua candidatura a {{university}}» |
| 27 | `student:v15.services.allowance.unlimited` | «Contínuo com a equipa» — no scope | «Coloque questões à equipa da Hangyul quando quiser durante o período do serviço» |
| 28 | `student:register.privacyNote` | omitted the partner agency that also receives data | «…a equipa da Hangyul que o acompanha (incluindo a respetiva agência parceira)…» |
| 29 | `student:phase.prepare.text` | «escreva… com a equipa» — co-writing | «…com os comentários da equipa da Hangyul» |
| 30 | `student:compare.legalCount_*`, `profileV3.why.basics`, `visaroute:step.slow_items.why` | «legalização» without «consular»; apostille dropped in the slow-items step | «apostila ou legalização consular» |
| 31 | `student:budget.scholarshipAlternative` | «não se soma às outras» — wrong: it is not added twice | «É uma alternativa à bolsa contabilizada, por isso não é somada duas vezes» |
| 32 | `student:register.consent.CROSS_BORDER_VERIFICATION.summary` | listed details the source does not give and said Cloudflare "blocks" sign-ups | checks that sign-up is not automated; details incl. how to refuse are in the policy |
| 33 | `dossier:page.summary` | «prontos para todas as candidaturas» — added a claim | «{{ready}} de {{total}} prontos» |
| 34 | `dossier:group.extraCount` | «Mais {{count}} guardados para depois» — not a show-more control | «Ver mais {{count}} documentos guardados» |
| 35 | `visaroute:help.ask` | «Falar com uma pessoa» | «Perguntar à equipa da Hangyul» |
| 36 | `common:uni27.schol.youMay` | «Poderá cumprir as condições de» — a dangling fragment as a heading | «Bolsas a que pode ter direito» |
| 37 | `student:settings.privacy.who.hangyul` | «Equipa Hangyul» for Hangyul staff (internal access) | «Pessoal da Hangyul» |

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

Before the rewrite, the hero, why, services and FAQ areas would have scored below 20 (TRUST, SPECIFICITY and NATURALNESS:
guarantees, "all universities", `tu` register clashing with the rest of the site, Brazilian forms in common UI). Every
area is now at 26/30 or higher. This is an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «a sua equipa da Hangyul», services-in-progress title, gender-neutral greeting |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses (aceite), final check says the student submits, reach tier, propinas |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, article/gender agreement in task strings |
| Services | 5 | 5 | 5 | 5 | 4 | support window, scoped "unlimited", managed applications «que gerimos consigo», exclusions with notarization |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostila or legalização consular, sponsor financial documents, TB certificate, transfer via a partner, business registration certificate |

## Unresolved ambiguity / limits (listed, not guessed)

- «plano de estudos» is also the Portuguese name for a degree's curriculum. It is kept because it is the established
  name of the GKS document and always appears next to «carta de motivação»; a market test could prefer «plano de estudo
  pessoal».
- `fit.level.ASSOCIATE` «Curso técnico superior» (CTeSP) is the closest Portuguese level, not an exact equivalent.
- `_many` (CLDR `pt`: 1 000 000 and compact forms) added as a copy of `_other`; keys with only `_other` in the job
  cannot receive `_one` through this pipeline.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고) kept as «Registos de rotulagem e publicidade»; the
  Portuguese legal category for Korean 표시 is unclear.
- `visaroute:who.you`, `v26.now.owner.STUDENT`, `dossier:v9.who.you` render "You" as «Do seu lado» to avoid `você`;
  acceptable as a column/owner label, awkward if ever used inside a sentence.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
