# V31 native-quality review — Romanian (ro)

Locale `ro` (Romania, Moldova). Job `scripts/i18n/v28/jobs-v31/ro.json`, output `scripts/i18n/v28/tx-v31/ro.json`,
glossary `docs/qa/v31/l10n/glossary/ro.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Counts

| | keys |
|---|---|
| Job keys reviewed (semantic, naturalness, product passes + back-check) | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 922 (incl. 18 `v31` keys whose existing Romanian already says what the new source says) |
| Rewritten | 807 |
| — new source (`v31`, incl. the 4 missing keys) | 235 |
| — naturalness (incl. register: «tu» → formal-polite «dumneavoastră») | 501 |
| — terminology | 52 |
| — quality (UI role / format / validator length) | 12 |
| — meaning (non-`v31` keys) | 7 |
| Extra CLDR plural forms added (`_few`) | 40 (every `_other` key) |

Register. About 250 existing strings used «tu» (Ți-ai uitat parola?, Încarcă, Vezi…), mixed with neutral ones. All
student, concierge, dossier, visa and marketing copy now uses the formal-polite web register («dumneavoastră», «vă»,
«Încărcați», «Vedeți»); buttons use the plural imperative (Salvați, Anulați, Continuați).

Plurals. Romanian `_one` / `_few` (0, 2–19, …) / `_other` (20+, with «de»). Every `_other` now has «{{count}} de …» and a
new `_few` without «de» («{{count}} documente»). Non-plural strings with a free count were restructured so they read
correctly for any number («instituții: {{count}}», «{{eligible}} dintre burse»).

Diacritics. All text uses comma-below ș ț (no cedilla ş ţ; checked by script: 0 cedilla characters).

Terminology decisions applied across all keys: «sesiune de consultanță» (not «consultație», which reads as medical, nor
«discuție», «apel»), «Admis» / «Loc confirmat» for an admission offer and its acceptance (not «Ofertă primită»),
«permis de ședere» for the residence card (was mixed with «card de rezident»), «apostilă» and «supralegalizare consulară»
(never bare «legalizare»), «legalizare notarială», «institut de limba coreeană» (not «școală de limbă»), «text» for an
essay (not «eseu»), «scrisoare de intenție» / «plan de studiu», «rundă de editare», «pachet» for a plan (was mixed with
«plan»), «a candida / a depune cererea» (not the calque «a aplica»), «King Sejong Institute» kept as the official name,
«echipa Hangyul» wherever the source says "the Hangyul team". Placeholders that are nouns («{{category}}», «{{label}}»,
«{{essay}}») are introduced by a head noun («documentul „…”», «textul „…”»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Perioada de consultanță» — support window read as a consultation period | «Perioada pentru întrebări după sesiunea de consultanță» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that new documents, translation and notarization are not included | exclusion added |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Pregătirea documentelor» — as if Hangyul prepares them | «Ajutor la pregătirea documentelor pentru viză» |
| 4 | `common:v29.pricing.all_in_one.f5` | «Documente de viză pregătite» — promised finished visa documents | «Ajutor la pregătirea documentelor pentru viză · urmărim termenele pentru cămin» |
| 5 | `common:v29.pricing.premium.position` | application stage missing | «de la candidatură până la viză, sosire și primele săptămâni» |
| 6 | `common:v29.addon.item.airport_pickup` | «Organizarea preluării» — no partner | «Preluare de la aeroport, prin intermediul unui partener» |
| 7 | `common:v29.pricing.all_in_one.f1`, `premium.f1` | «până la 5/7 recomandări» — what is recommended unclear | «… universități recomandate» |
| 8 | `common:v29.pricing.compare.row.managed`, `student:v15.services.allowance.key.max_managed_applications` | «Candidaturi gestionate» — passive count label (forbidden form) | «Candidaturi pe care le gestionăm împreună cu dumneavoastră» |
| 9 | `common:essayStatus.AGENCY_REVIEW` | «La evaluatorul tău» | «La echipa Hangyul» |
| 10 | `marketing:v11.services.s2.text` | «Obținerea vizei…» — as if Hangyul obtains the visa | «Vă ajutăm cu cererea de viză…» |
| 11 | `marketing:v11.services.s1.text` | «întregul proces… îl luăm asupra noastră», «școli de limbă», «cu adevărat» | we suggest universities and Korean language institutes, then help you prepare documents and deal with the university |
| 12 | `marketing:v11.hero.lede` | «Îți transformăm visul în realitate» — outcome promise, source content missing | find the right university, every step with a team beside you; start with what you want to study |
| 13 | `marketing:v11.why.s3.title` | «Cel mai rezonabil cost, cel mai bun rezultat» | «Un preț corect, fără surprize» |
| 14 | `marketing:v11.why.s1.*` | «până la reușită», «partener pe drumul spre reușită» | help at every stage, same team start to finish |
| 15 | `marketing:v11.why.s2.*` | «100% a ta», «îți valorifică potențialul la maximum» | plan from grades, goals and budget; realistic universities |
| 16 | `marketing:v11.faq.q6.a` | «Fiecare universitate oferă burse» | «Majoritatea oferă…» |
| 17 | `marketing:v11.unis.title` | «…îți așteaptă înscrierea» — implies admission | «…dintre care puteți alege» |
| 18 | `marketing:v11.services.s3.title` | not about students who have been there | «O comunitate de studenți care au trecut deja prin asta» |
| 19 | `marketing:v11.faq.q4.q`, `q2.q` | «Mă pot pregăti…» (preparing ≠ applying); «Trebuie neapărat să depun TOPIK?» | «Pot candida dacă nu vorbesc coreeană?»; «Am nevoie de un rezultat la TOPIK?» |
| 20 | `marketing:v12.terms.universityInfo.p` | contained Hangul («대학알리미») | «Academy Info» |
| 21 | `marketing:v20.city.Gyeonggi.*` | "roomier" as «mai verde»; body lost the dormitory conclusion | «mai spațioasă»; conclusion restored |
| 22 | `marketing:v20.uni.intl.admissionsLine` | «…pe o pagină separată» | «Are o procedură de admitere separată pentru studenții internaționali.» |
| 23 | `marketing:v12.privacy.collect.security.items` | «hașurate (hash)» — «hașurat» means hatched (drawing) | «sub formă de hash» |
| 24 | `student:discover.verdict.reach`, `success:group.possible` | «Potrivire posibilă» | «Îndeplinește condițiile, necesită verificare» |
| 25 | `student:register.privacyNote` | partner agency missing | «…echipa Hangyul care vă sprijină (inclusiv agenția sa parteneră)…» |
| 26 | `student:phase.prepare.text` | «scrie… împreună cu echipa» — co-writing (editing ≠ writing) | «scrieți… ținând cont de observațiile echipei Hangyul» |
| 27 | `student:v15.services.allowance.unlimited` | «Continuu» — unlimited without the service term | «Întrebați echipa Hangyul oricând pe durata serviciului» |
| 28 | `student:v4.ws.team.final` | «…apoi trimite candidatura ta» — reads as Hangyul submitting | «Verificare finală înainte să depuneți candidatura…» |
| 29 | `student:v4.ws.helpText`, `v22.home.appsNeedYou` | «aplicație» — means a software app, not an application | «candidatură» |
| 30 | `student:profileV3.why.basics`, `compare.legalCount_*` | bare «legalizare»/«supralegalizare» | «apostilă sau supralegalizare consulară» |
| 31 | `student:register.consent.PRIVACY.summary` | «parolă (criptată)» — a hash is not encryption | «hash-ul parolei» |
| 32 | `student:dashboard.counselor.nextCall`, `messages.call` | «discuție», «apel video» | «sesiune de consultanță (video)» |
| 33 | `concierge:status.DORMITORY.ASSIGNED` | «Cameră oferită» — offered ≠ assigned | «Cameră repartizată» |
| 34 | `concierge:step.pickup.sub` | «Cineva te așteaptă» — no partner | «Partenerul pentru preluare vă așteaptă la sosiri» |
| 35 | `dossier:group.extraCount` | «Încă {{count}} păstrate pentru mai târziu» — not a show control | «Afișați încă {{count}} documente păstrate» |
| 36 | `dossier:package.line`, `page.summary` | «cerințe», «gata pentru fiecare candidatură» | «{{total}} documente necesare · {{ready}} gata», «{{ready}} din {{total}} gata» |
| 37 | `visaroute:step.slow_items.why` | «Supralegalizările…» — apostille missing | «Apostila sau supralegalizarea consulară…» |
| 38 | `visaroute:help.ask` | «Întreabă o persoană» | «Întrebați echipa Hangyul» |
| 39 | `visaroute:doc.bank_balance_certificate.name`, `common:docCategory.BANK_STATEMENT` | «Extras de cont / de sold» — a statement, not a balance certificate | «Certificat de sold bancar» |
| 40 | `common:appStatus.OFFERED`, `student:stage.OFFERED` | «Ofertă primită» | «Admis» |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite the hero, why and services areas would have scored under 20 (dream/success promises, superlatives,
visa obtained for the student). Every area is now 26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | formal register, `_one/_few/_other` document counts, «candidatură» not «aplicație» |
| Applications | 5 | 5 | 4 | 5 | 4 | Admis / Loc confirmat, the student submits, "meets requirements, needs checking" tier, task titles |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, package line, automatic-check note, plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "unlimited", sesiune de consultanță, managed applications, «pachet» |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostilă / supralegalizare consulară, permis de ședere, sponsor financial documents, TB certificate, partner pickup |

## Unresolved ambiguity / limits (listed, not guessed)

- `marketing:v11.nav.faq`: «Întrebări frecvente» (19 chars) exceeds the validator's length limit for a 3-letter source;
  shipped as «Întrebări». A source or validator exception would allow the fuller label.
- `marketing:v12.privacy.retention.advertising.record` ("Records of labeling and advertising", 표시·광고): kept as «Evidențe
  privind etichetarea și publicitatea»; the exact Romanian legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` kept as «Studii de scurtă durată»; Romania has no associate degree.
- `common:v29.pricing.compare.value.settlement` uses «{{before}} de zile … {{count}} de zile»; correct for the
  contracted 30 days, but would read wrongly if the numbers were ever under 20 (not a plural key).
- `_one` for keys with only `_other` in the job (e.g. `marketing:v12.directory.count`, `dossier:home.checkDetails_more`) cannot
  be delivered through this pipeline; `_few` was added for every `_other`.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
