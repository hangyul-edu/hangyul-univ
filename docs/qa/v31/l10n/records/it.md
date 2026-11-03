# V31 native-quality review — Italian (it)

Locale `it` (Italy, Switzerland). Job `scripts/i18n/v28/jobs-v31/it.json`, output `scripts/i18n/v28/tx-v31/it.json`,
glossary `docs/qa/v31/l10n/glossary/it.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

Every job key went through the three passes (semantic accuracy, native naturalness, product/marketing quality) and the
back-check. Keys that passed all four are kept verbatim.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,445 (including 32 `v31` keys whose existing Italian already says what the new source says) |
| Rewritten | 284 |
| — new source (`v31`) | 221 |
| — terminology | 24 |
| — naturalness | 22 |
| — quality (UI role, grammar with placeholders, empty-English key) | 14 |
| — meaning (non-`v31` keys) | 2 |
| — typography only (’ → ') | 1 |
| Extra CLDR plural forms added (`_many`) | 40 |

The 4 missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`, `student:v8.compare.budget_one`) were translated.

Conventions applied across all keys:
- **tu** form. The existing Italian copy uses *tu* consistently (207 strings, no *Lei*), so the review keeps *tu* everywhere.
- Em-dash connectors were removed: they were in 10 kept strings and in many `v31` strings. Colons or full stops are used instead.
- «Richiede te» / «In attesa di te» (a calque of "Needs you") is now «Tocca a te» or «richiedono un tuo intervento». This applies to 9 keys.
- Placeholder grammar: «Correggi il tuo {{label}}» produced «il tuo Lettera…». These strings now use «il documento «{{label}}»» or «Scrivi «{{essay}}»». This applies to 11 keys.
- Terminology:
  - «progetto di studio» for the study-plan document. «piano di studi» means the exam plan of a degree in Italian, and was used in 9 keys.
  - «lettera di motivazione» (it also appeared as «lettera motivazionale» and «lettera di presentazione»).
  - «verifica dei documenti» for review and «revisione» for editing. Before this pass, both were «revisione».
  - «apostille», «legalizzazione consolare» (never bare «legalizzazione»), «autenticazione notarile».
  - «istituto di lingua coreana» (not «scuola di lingua»).
  - «elaborati» for essays (not «saggi»).
  - «il team Hangyul» where the source says "the Hangyul team".
  - «piano» for plan; plan names stay in Latin.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Periodo di consulenza». This presented the support window as a consultation period. | «Periodo per fare domande dopo la consulenza» |
| 2 | `common:v29.pricing.compare.scopeNote` | Left out that writing new documents, translation and notarization are not included | Exclusion added; "no limit" stays tied to the contracted documents and schedule |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Preparazione dei documenti». This read as if Hangyul prepares the visa documents. | «Aiuto per preparare i documenti del visto» |
| 4 | `common:v29.pricing.all_in_one.f5` | «Documenti per il visto · scadenze della residenza seguite». The help was missing. | «Aiuto per preparare i documenti del visto · seguiamo le date della domanda di residenza» |
| 5 | `common:v29.pricing.premium.f4` | «Date del visto seguite da vicino · supporto per la residenza». The documents were dropped. | «Documenti e date chiave del visto seguiti da vicino · aiuto con la domanda di residenza» |
| 6 | `common:v29.pricing.premium.position` | Left out the application stage | «…dalla candidatura al visto, all'arrivo e alle prime settimane in Corea» |
| 7 | `common:v29.addon.item.airport_pickup` | «Organizzazione del transfer dall'aeroporto». This read as if Hangyul runs the transport. | «Accoglienza in aeroporto, organizzata con un partner» |
| 8 | `concierge:step.pickup.sub` | «Qualcuno ti accoglie agli arrivi» (no partner) | «Il partner dell'accoglienza ti aspetta agli arrivi» |
| 9 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Verifica approfondita» (the notes on what to fix were missing) | «Verifica approfondita, con indicazioni su cosa correggere» |
| 10 | `common:docCategory.GRADUATION_CERTIFICATE` | «Diploma di laurea». This is a university degree only, but most applicants submit a high-school diploma. | «Certificato di diploma o di laurea» |
| 11 | `dossier:group.extraCount` | «Altri {{count}} conservati per dopo». This was not the "show stored documents" toggle. | «Mostra altri {{count}} documenti conservati» |
| 12 | `dossier:page.summary` | Added «per ogni candidatura», which is not in the source | «{{ready}} su {{total}} pronti» |
| 13 | `dossier:package.line` | «{{total}} requisiti» (requirements ≠ documents) | «{{total}} documenti richiesti · {{ready}} pronti» |
| 14 | `student:discover.verdict.reach`, `success:group.possible` | «Possibile corrispondenza». The reader does not learn that the requirements are met but need checking. | «Requisiti soddisfatti, da verificare» |
| 15 | `student:register.privacyNote` | Left out the partner agency that also receives the data | «…con il team Hangyul che ti segue (compresa la sua agenzia partner)…» |
| 16 | `student:phase.prepare.text` | «scrivi la lettera… con il team Hangyul Univ». This read as co-writing (editing ≠ writing). | «…scrivi… con il feedback del team Hangyul» |
| 17 | `student:v15.services.allowance.unlimited` | «Continuo con il team Hangyul Univ». The "unlimited" had no term scope. | «Fai domande al team Hangyul in qualsiasi momento durante il periodo del servizio» |
| 18 | `student:v15.services.allowance.key.max_managed_applications`, `common:…compare.row.managed` | «Candidature gestite». This was a passive count. | «Candidature che gestiamo con te» |
| 19 | `student:v4.ws.team.final` | «Controllo finale, poi invio della tua candidatura». This implied Hangyul submits. | «Controllo finale prima che tu invii personalmente la candidatura a {{university}}» |
| 20 | `student:v15.services.level.dormitory_support.SCHEDULE` | «Pianificazione della domanda» (planning ≠ tracking the dates) | «Date della domanda seguite» |
| 21 | `student:budget.beforeArrivalHint` | «primo periodo in residenza e il tuo primo mese». The semester and living costs were lost. | «…primo semestre di residenza e spese di vita del primo mese» |
| 22 | `student:v8.compare.budget_other` | «…per questi {{count}}» (the noun was missing) | «…per questi {{count}} programmi» |
| 23 | `student:register.consent.PRIVACY.summary` | «password (cifrata)». A hash is not encryption. | «hash della password» |
| 24 | `concierge:status.DORMITORY.ASSIGNED` | «Stanza offerta» (offered ≠ assigned) | «Stanza assegnata» |
| 25 | `visaroute:step.slow_items.why` | «Legalizzazioni…». The apostille was missing. | «Apostille o legalizzazione consolare…» |
| 26 | `student:compare.legalCount_*`, `student:profileV3.why.basics` | «legalizzazione» without «consolare» | «apostille o legalizzazione consolare» |
| 27 | `marketing:v11.hero.lede` | «Trasformiamo il tuo sogno in realtà» (a promise, not the source) | «Trova l'università coreana giusta e completa ogni passaggio, con un team al tuo fianco.<br>Inizia da cosa vuoi studiare.» |
| 28 | `marketing:v11.why.s1.title` / `.text` | «dal primo passo al traguardo», «il partner che ti accompagna fino al risultato», «Ci occupiamo di ogni fase». These implied an outcome and doing the work for the student. | «Supporto in ogni fase, dall'inizio alla fine»; the same team throughout |
| 29 | `marketing:v11.why.s3.title` | «Il costo più ragionevole, il risultato migliore» (superlative and an outcome promise) | «Un prezzo giusto, senza sorprese» |
| 30 | `marketing:v11.why.s3.text` | «fa in modo che la tua vita da studente proceda serena», «di tutt'altro livello» | Careful, concrete help at a fair price. You see what the plan includes before paying. |
| 31 | `marketing:v11.services.s1.text` | «ci occupiamo dell'intero percorso», «scuole di lingua» | We suggest universities and Korean language institutes, then help you prepare documents and talk to the university |
| 32 | `marketing:v11.services.s2.text` / `.title` | «Visto, richiesta del permesso…» (implies obtaining the visa), «Nessun pensiero» | «Ti aiutiamo con la domanda di visto…» / «Dopo l'ammissione: supporto finché non ti sei sistemato» |
| 33 | `marketing:v11.faq.q6.a` | «Ogni ateneo offre borse di studio» | «La maggior parte sì, ma importi e condizioni variano…» |
| 34 | `marketing:v11.unis.title` | «…aspettano la tua iscrizione» (implies admission) | «…tra cui scegliere» |
| 35 | `marketing:v20.city.Gyeonggi.line` | «più verde» (the source says roomier) | «più spaziosa» |
| 36 | `marketing:v20.city.Gyeonggi.body` | Left out the conclusion that more students live in dormitories | Conclusion added |
| 37 | `marketing:v20.uni.intl.admissionsLine` | «gestite in una pagina separata» (the source means a separate admissions track) | «Prevede un percorso di ammissione separato…» |
| 38 | `marketing:v12.privacy.collect.verification.purpose` | «registrazioni automatizzate» (the source says fraudulent) | «registrazioni fraudolente» |
| 39 | `marketing:v12.terms.universityInfo.p` | Contained Hangul («대학알리미») | «il servizio ufficiale di trasparenza delle università coreane (Academy Info)» |
| 40 | `marketing:v12.terms.services.documents` | «Preparazione e revisione dei documenti» (Hangyul prepares them) | «Aiuto nella preparazione dei documenti di candidatura e verifica dei documenti» |
| 41 | `marketing:v12.privacy.collect.profile.purpose` | «preparare un piano di studi» (curriculum confusion) | «pianificare lo studio all'estero» |
| 42 | `marketing:v15.pricing.compare.item` | «Voce». The English is intentionally empty. | empty |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each scored out of 5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Total: 219/240. Every area is at 26/30 or above. Before this pass, the hero, why, services and FAQ areas would have scored about
2/5 on TRUST and SPECIFICITY because of promises, superlatives and missing content. This is an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each scored out of 5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «il team Hangyul», «Tocca a te», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | the student submits (final check), the reach verdict, placeholder grammar in task titles |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, package line, automatic-check note, «Tocca a te» |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "unlimited", managed applications, dormitory date tracking, items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, partner pickup, room assigned, em-dashes removed |

## Unresolved ambiguity / limits (listed, not guessed)

- Masculine generic forms remain in the existing copy, for example «Sei stato ammesso», «Benvenuto», «Bentornato» and «Non sei sicuro?».
  This is standard Italian UI practice. A gender-neutral rewrite would need a product decision.
- Keys that have only `_other` in the job (for example `marketing:v12.directory.count`) cannot get a `_one` through this pipeline.
  `_many` (1,000,000 and above) was added for every `_other`.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept as «Registri di etichettatura e pubblicità». The exact Italian
  legal equivalent of the Korean 표시 category is unclear.
- `visaroute:doc.business_registration.name` (사업자등록증): kept as «Certificato di registrazione dell'università». Italy has no exact equivalent.
- `common:fit.level.ASSOCIATE` is «Diploma biennale». This is the closest Italian level, not an exact equivalent.
- `marketing:v11.faq.q1.a`: the owner Korean says "if the parent has no *foreign* passport"; the English says "no passport". Translated from the English.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=it` → `V28 l10n (1 locales): 1769 strings valid, 0 problems`
