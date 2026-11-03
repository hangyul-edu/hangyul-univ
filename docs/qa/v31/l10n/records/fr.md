# V31 native-quality review — French (fr)

Locale `fr` (France, Belgium, Switzerland, francophone Africa and Canada). Job `scripts/i18n/v28/jobs-v31/fr.json`,
output `scripts/i18n/v28/tx-v31/fr.json`, glossary `docs/qa/v31/l10n/glossary/fr.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

Every job key went through the three passes (semantic accuracy, native naturalness, product/marketing quality) and the
back-check. Keys that passed all four are kept verbatim.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,420 (including 35 `v31` keys whose existing French already says what the new source says) |
| Rewritten | 309 |
| — new source (`v31`) | 208 |
| — typography only (espace insécable before `: ; ? !`, inside « », before `%`; ’ → ') | 60 |
| — terminology | 28 |
| — quality (UI role, register, empty-English key, length) | 8 |
| — naturalness | 3 |
| — meaning (non-`v31` keys) | 2 |
| Extra CLDR plural forms added (`_many`) | 40 |

The 208 "new source" rewrites include many that also fixed meaning; the critical ones are listed below. The 3 missing
keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`, `student:home.documentsSub_one`) were
translated.

Conventions applied across all keys:
- **vous** everywhere. The owner homepage copy (`v11.*`, `footer.statement`) used *tu*. It is now in *vous*, like the rest of the product.
- French typography: espace insécable (U+00A0) before `:` `;` `?` `!` and `%`, and inside « ». Before this pass the copy mixed
  plain spaces (92 strings) and espaces insécables (77 strings). It is now consistent.
- Terminology: «projet d'études» for the study-plan document. «plan d'études» means a curriculum in French and was used in 8 keys.
  Other terms: «lettre de motivation», «relecture» for editing, «vérification des documents» for review (the two are no longer both
  «relecture»), «apostille», «légalisation consulaire» (never bare «légalisation»), «certification par un notaire», «carte de
  séjour» (not «carte de résident», which is a specific French permit), «institut de langue coréenne» (not «école de langue»),
  «formule» for plan (plan names in Latin), «consultation» for 상담, «entretien blanc» for mock interview, «l'équipe Hangyul» where
  the source says "the Hangyul team" (18 keys said «équipe Hangyul Univ»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Période de conseil». This presented the support window as a consultation period. | «Période pour poser vos questions après la consultation» |
| 2 | `common:v29.pricing.compare.scopeNote` | Left out that writing new documents, translation and notarization are not included in Premium | Exclusion added in full; "no limit" stays tied to the contracted documents and schedule |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Préparation du dossier». This read as if Hangyul prepares the visa file. | «Aide à préparer vos documents de visa» |
| 4 | `common:v29.pricing.all_in_one.f5` | «Dossier de visa préparé» (done for the student) | «Aide à préparer vos documents de visa · suivi des dates de demande de résidence universitaire» |
| 5 | `common:v29.pricing.premium.f4` | «Suivi rapproché du calendrier visa». This dropped the visa documents. | «Documents de visa et dates clés suivis de près · aide à la demande de résidence universitaire» |
| 6 | `common:v29.pricing.premium.position` | Left out the application stage | «…de la candidature au visa, à l'arrivée et aux premières semaines en Corée» |
| 7 | `common:v29.addon.item.airport_pickup` | «Organisation de l'accueil à l'aéroport». It did not say a partner does the pickup. | «Accueil à l'aéroport, organisé avec un partenaire» |
| 8 | `concierge:step.pickup.sub` | «Quelqu'un vous attend aux arrivées» (no partner) | «Le partenaire chargé de l'accueil vous attend dans le hall des arrivées» |
| 9 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Vérification approfondie» (the notes on what to fix were missing) | «Vérification approfondie, avec indications sur ce qu'il faut corriger» |
| 10 | `dossier:group.extraCount` | «{{count}} de plus gardés pour plus tard». This was a status, not the "show stored documents" toggle. | «Afficher {{count}} autres documents conservés» |
| 11 | `dossier:page.summary` | Added «pour toutes les candidatures», which is not in the source | «{{ready}} sur {{total}} prêts» |
| 12 | `student:discover.verdict.reach`, `success:group.possible` | «Correspondance possible». The reader does not learn that the requirements are met but must be checked. | «Conditions remplies, à vérifier» |
| 13 | `student:register.privacyNote` | Left out the partner agency that also receives the data | «…l'équipe Hangyul qui vous accompagne (y compris son agence partenaire)…» |
| 14 | `student:phase.prepare.text` | «rédigez votre lettre… avec l'équipe Hangyul Univ». This read as co-writing (editing ≠ writing). | «…rédigez… avec les commentaires de l'équipe Hangyul» |
| 15 | `student:v15.services.allowance.unlimited` | «En continu avec l'équipe Hangyul Univ». The "unlimited" had no term scope. | «Posez vos questions à l'équipe Hangyul à tout moment pendant la durée de votre service» |
| 16 | `student:v15.services.scope.consultation` | «Durée de la consultation». This was the V15 minutes model. | «Consultation» |
| 17 | `student:v15.services.allowance.key.max_managed_applications`, `common:…compare.row.managed` | «Candidatures suivies». This was a passive count. | «Candidatures que nous gérons avec vous» |
| 18 | `student:v4.ws.team.final` | «Vérification finale, puis envoi de votre candidature». This implied Hangyul submits. | «Vérification finale avant que vous n'envoyiez vous-même votre candidature à {{university}}» |
| 19 | `student:budget.beforeArrivalHint` | «premier trimestre en résidence» (trimester ≠ semester) and «votre premier mois» (living costs missing) | «…premier semestre de résidence universitaire et frais de vie du premier mois» |
| 20 | `student:register.consent.PRIVACY.summary` | «mot de passe (chiffré)». A hash is not encryption. | «empreinte (hachage) du mot de passe» |
| 21 | `concierge:status.DORMITORY.ASSIGNED` | «Chambre proposée» (offered ≠ assigned) | «Chambre attribuée» |
| 22 | `visaroute:step.slow_items.why` | «Les légalisations…». The apostille was missing. | «L'apostille ou la légalisation consulaire…» |
| 23 | `student:compare.legalCount_*`, `student:profileV3.why.basics` | «légalisation» without «consulaire» | «apostille ou légalisation consulaire» |
| 24 | `marketing:v11.hero.lede` | «Nous transformons ton rêve en réalité» (a promise and a slogan, not the source) | «Trouvez la bonne université coréenne et franchissez chaque étape, avec une équipe à vos côtés.<br>Commencez par ce que vous voulez étudier.» |
| 25 | `marketing:v11.why.s1.title` / `.text` | «jusqu'à la réussite», «le partenaire qui t'accompagne jusqu'au bout», «nous prenons en charge chaque étape». These implied a result and doing the work for the student. | «Une aide à chaque étape, du début à la fin»; the same team from start to finish |
| 26 | `marketing:v11.why.s3.title` | «Le coût le plus raisonnable, le meilleur résultat» (superlative and an outcome promise) | «Un prix juste, sans surprise» |
| 27 | `marketing:v11.why.s3.text` | «veille à ce que ta vie étudiante se déroule sereinement», «d'un tout autre niveau» | Careful, hands-on help at a fair price. You see what the plan includes before paying. |
| 28 | `marketing:v11.services.s1.text` | «nous prenons en charge tout le parcours», «écoles de langue» | We suggest universities and Korean language institutes, then help you prepare documents and deal with the university |
| 29 | `marketing:v11.services.s2.text` / `.title` | «Obtention du visa…» (Hangyul obtains the visa), «aucune inquiétude» | «Nous vous aidons pour la demande de visa, la carte de séjour…» / «Après l'admission : de l'aide jusqu'à votre installation» |
| 30 | `marketing:v11.faq.q6.a` | «Chaque université propose des bourses» | «La plupart, oui, mais les montants et les conditions varient…» |
| 31 | `marketing:v11.unis.title` | «…universités coréennes t'attendent» (implies admission) | «…parmi lesquelles choisir» |
| 32 | `marketing:v20.city.Gyeonggi.line` | «plus verte» (the source says roomier) | «plus spacieuse» |
| 33 | `marketing:v20.city.Gyeonggi.body` | Left out the conclusion that more students live in dormitories | Conclusion added |
| 34 | `marketing:v20.uni.intl.admissionsLine` | «présentées sur une page distincte» (the source means a separate admissions track) | «Propose une procédure d'admission distincte pour les étudiants internationaux.» |
| 35 | `marketing:v12.privacy.collect.verification.purpose` | «inscriptions automatisées» (the source says fraudulent sign-ups) | «inscriptions frauduleuses» |
| 36 | `marketing:v12.terms.universityInfo.p` | Contained Hangul («대학알리미») | «le service officiel coréen de publication des données universitaires (Academy Info)» |
| 37 | `marketing:v12.terms.services.documents` | «Préparation et relecture des documents» (Hangyul prepares them) | «Aide à la préparation des documents de candidature, et vérification des documents» |
| 38 | `marketing:v12.privacy.collect.profile.purpose` | «préparer un plan d'études». This could be confused with the curriculum or study-plan document. | «planifier vos études à l'étranger» |
| 39 | `marketing:v15.pricing.compare.item` | «Poste». The English is intentionally empty. | empty |

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

Total: 219/240. Before this pass, the why, services, hero and FAQ areas had guarantees, superlatives, *tu* register and missing
content. Their TRUST and SPECIFICITY scores would have been at or below 2/5. Every area is now at 26/30 or above. This is an
internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each scored out of 5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «l'équipe Hangyul», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | the student submits (final check), the reach verdict, offer wording in the "later" states |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, summary, automatic-check note, needs-fixing reason |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "unlimited", consultation no longer a duration, managed applications, items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, partner pickup, carte de séjour, room assigned |

## Unresolved ambiguity / limits (listed, not guessed)

- French puts **0 in the `one` category**. `student:v8.compare.budget_one`, `student:v9.discovery.scholarship_one` and
  `student:v22.home.appsQuiet_one` have no `{{count}}` in English, so the validator does not allow one in French. With
  count = 0 they show the singular sentence. This needs a source change (add `{{count}}` to the `_one` strings).
- Keys that have only `_other` in the job (for example `marketing:v12.directory.count`) cannot get a `_one` through this pipeline.
  `_many` (1,000,000 and above) was added for every `_other`.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept as «Registres relatifs à l'affichage et à la publicité». The exact
  French legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` is «Diplôme court (bac+2)». This is the closest French level, not an exact equivalent.
- `common:fit.gpa.placeholder` keeps «3.6» with a decimal point, because the input parser may not accept «3,6».
- `marketing:v11.faq.q1.a`: the owner Korean says "if the parent has no *foreign* passport"; the English says "no passport". Translated from the English.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=fr` → `V28 l10n (1 locales): 1769 strings valid, 0 problems`
