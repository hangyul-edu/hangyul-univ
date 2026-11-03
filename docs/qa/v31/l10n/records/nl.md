# V31 native-quality review — Dutch (nl)

Locale `nl` (Netherlands, Flanders). Job `scripts/i18n/v28/jobs-v31/nl.json`, output `scripts/i18n/v28/tx-v31/nl.json`,
glossary `docs/qa/v31/l10n/glossary/nl.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Register decision

The existing Dutch copy uses **je/jij/jouw** consistently (≈1,270 `je` vs 5 `u` across `packages/i18n/locales/nl`), so
the review keeps **je-form** everywhere, as allowed by the instruction. No register churn; the few em-dash connectors
and stiff constructions were fixed instead.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,443 (incl. 37 `v31` keys whose Dutch already says what the new source says) |
| Rewritten | 286 |
| — new source (`v31`) | 216 |
| — terminology | 42 |
| — naturalness | 17 |
| — meaning (non-`v31` keys) | 6 |
| — quality (UI role / format) | 5 |
| Extra CLDR plural forms | 0 (Dutch needs only `_one`/`_other`) |

The 3 missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) and `student:v8.compare.budget_one` were translated.

Terminology applied across all keys: «studentenhuisvesting» for a university dormitory (was «studentenhuis», which in
Dutch means a shared student house), «aanmelding» for a university application («aanvraag» kept for visa, dormitory and
residence card), «aanmeldingen die we samen met je begeleiden» (not «Begeleide/Beheerde aanmeldingen»), «redactie /
redactieronde» for editing (≠ «controle/beoordeling» for review), «adviesgesprek» for consultation (was mixed «consult»,
«gesprek»), «apostille», «consulaire legalisatie» (never bare «legalisatie»), «notarieel gewaarmerkt / notariële
waarmerking» (was mixed «gelegaliseerd door een notaris», «notarieel bekrachtigd»), «junior college» for 전문대 (not
«mbo» or «hogeschool»), «pakket» for plan, «het Hangyul-team» where the source says "the Hangyul team", plan names in Latin.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Consultperiode» — support window shown as a consultation period | «Periode om na je gesprek vragen te stellen» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that new documents, translation and notarization are excluded | exclusions added |
| 3 | `common:v29.pricing.all_in_one.f5`, `compare.value.visa.DOCUMENT_PREP` | «Visumdocumenten voorbereid» / «Voorbereiding van documenten» — as if Hangyul prepares them | «Hulp bij het voorbereiden van je visumdocumenten» |
| 4 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Intensieve controle» — notes on what to fix missing | «Grondige controle, met uitleg over wat je moet verbeteren» |
| 5 | `common:v29.pricing.premium.position` | application stage omitted | «van aanmelding tot visum, aankomst en de eerste weken» |
| 6 | `common:v29.addon.item.airport_pickup` | «Ophalen van het vliegveld regelen» — partner not named | «…geregeld via een partner» |
| 7 | `common:v29.pricing.notes.visaDecision` | «de bevoegde instantie» (vague) | «Of je een visum krijgt, beslissen de immigratieautoriteiten» |
| 8 | `student:v15.services.allowance.key.max_managed_applications`, `common:…compare.row.managed` | «Beheerde / Begeleide aanmeldingen» — passive count label (forbidden) | «Aanmeldingen die we samen met je begeleiden» |
| 9 | `student:v15.services.allowance.unlimited` | «Doorlopend met het Hangyul Univ-team» — no term | «…zolang je dienstperiode loopt» |
| 10 | `student:v4.ws.team.final` | «daarna gaat je aanmelding naar {{university}}» — implies Hangyul submits | «Laatste controle voordat je je aanmelding zelf bij {{university}} indient» |
| 11 | `student:phase.prepare.text` | «schrijf je motivatiebrief en studieplan met het Hangyul Univ-team» — co-writing | «…met feedback van het Hangyul-team» |
| 12 | `student:register.privacyNote` | partner agency omitted | «…het Hangyul-team dat je begeleidt (inclusief het partnerbureau)…» |
| 13 | `student:discover.verdict.reach`, `success:group.possible` | «Mogelijke match» | «Voldoet aan de eisen, controle nodig» |
| 14 | `concierge:step.documents_to_carry.title` / `.sub` | title and subtitle swapped («Originelen in je handbagage» as title) | title «Mee te nemen documenten», sub «Originelen in je handbagage» |
| 15 | `dossier:group.extraCount` | «Nog {{count}} bewaard voor later» — status, not show-more button | «Nog {{count}} bewaarde documenten tonen» |
| 16 | `dossier:page.summary` | «… klaar voor elke aanvraag» — overstated | «{{ready}} van {{total}} klaar» |
| 17 | `marketing:v11.hero.lede` | «Wij maken jouw droom werkelijkheid» — promise | «Vind de juiste Koreaanse universiteit en zet elke stap, met een team naast je…» |
| 18 | `marketing:v11.why.s3.text` / `.title` | «zorgt dat je studententijd rustig verloopt», «het beste resultaat» | «eerlijke prijs … je ziet precies wat je pakket inhoudt»; «Een eerlijke prijs, zonder verrassingen» |
| 19 | `marketing:v11.why.s1.*` | «Wij nemen elke fase op ons», «tot het resultaat» | «We helpen je in elke fase…»; «van begin tot eind» |
| 20 | `marketing:v11.services.s1.text` | «het hele traject … nemen wij op ons», «taalscholen» | help with documents and contact; «taleninstituten» |
| 21 | `marketing:v11.services.s2.text` | «We regelen samen alles wat nodig is» (visa) | «helpen we je met je visumaanvraag, je verblijfskaart en het inschrijven voor vakken» |
| 22 | `marketing:v11.faq.q6.a` | «Elke universiteit biedt beurzen» | «De meeste wel…» |
| 23 | `marketing:v11.faq.q1.a`, `q8.a`, `q9.a` | junior college as «mbo» (Dutch secondary vocational) | «junior college» |
| 24 | `marketing:v12.terms.universityInfo.p` | contained Hangul «대학알리미» | «de officiële Koreaanse openbaarmakingsdienst voor universiteiten (Academy Info)» |
| 25 | `marketing:v12.privacy.collect.profile.purpose` | «een studieplan opstellen» — collides with the study-plan essay | «je studie in het buitenland plannen» |
| 26 | `marketing:v12.privacy.collect.verification.purpose` | «geautomatiseerde registraties» for fraudulent | «frauduleuze registraties» |
| 27 | `marketing:v20.city.Gyeonggi.*` | «groener» for roomier; body lost the dormitory conclusion | «ruimer»; «dus wonen meer studenten in studentenhuisvesting van de universiteit» |
| 28 | `visaroute:step.slow_items.why`, `student:compare.legalCount_*`, `profileV3.why.basics` | «Legalisaties» / «legalisatie» without apostille or "consulaire"; «duren weken» stated as certain | «Apostilles of consulaire legalisatie … kunnen weken duren» |
| 29 | `marketing:v12.type.JUNIOR_COLLEGE`, `v12.seo.directory.description` | «Hogeschool» (= university of applied sciences) | «Junior college» |
| 30 | `marketing:v15.pricing.compare.item` | «Onderdeel» where the English is intentionally empty | empty |
| 31 | `marketing:v20.uni.ctaTitle` | «Denk je erover hier te studeren?» — CTA is about applying | «Denk je erover je hier aan te melden?» |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, hero, why, services and FAQ would have scored below 20 on TRUST and SPECIFICITY. Every area is now
26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | «Jouw Hangyul-team», document-count plurals, «Aanmeldingen die op jou wachten» |
| Applications | 5 | 5 | 4 | 5 | 4 | final check says the student submits, "meets requirements, needs checking", «Voldoet nog niet aan de eisen» |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, swapped title/subtitle, consular legalization |
| Services | 5 | 5 | 4 | 5 | 4 | managed applications, "unlimited" scoped to the service term, «adviesgesprek», exclusions list |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | «studentenhuisvesting», sponsor financial documents, TB certificate, pickup via a partner, address report after moving |

## Unresolved ambiguity / limits (listed, not guessed)

- Non-job keys in `packages/i18n/locales/nl` still use «studentenhuis» and «Hangyul Univ-team» in places; the job keys are
  now consistent but the wider locale is not.
- `marketing:v12.privacy.*` uses «aanvraag» for a university application in several unchanged legal strings; left as is
  (readable, legally neutral) to avoid churn; product copy uses «aanmelding».
- `doc.business_registration.*` (사업자등록증): «bewijs van bedrijfsregistratie van de universiteit»; no exact Dutch
  equivalent for a university.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept «Gegevens over etikettering en reclame».
- `common:fit.level.ASSOCIATE`: «Associate degree» kept (the closest Dutch level, Associate degree / Ad, uses the same name).
- `marketing:v11.nav.faq`: «Veelgestelde vragen» exceeded the validator's length limit for "FAQ"; shortened to «FAQ»
  (common in Dutch); `v11.faq.title` keeps «Veelgestelde vragen».

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=nl` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
