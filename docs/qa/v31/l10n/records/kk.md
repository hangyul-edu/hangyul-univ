# V31 native-quality review: Kazakh (kk)

Locale `kk` (Kazakhstan, Cyrillic). Job `scripts/i18n/v28/jobs-v31/kk.json`, output `scripts/i18n/v28/tx-v31/kk.json`,
glossary `docs/qa/v31/l10n/glossary/kk.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`. Polite «сіз» register throughout.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,428 (incl. 48 `v31` keys whose existing Kazakh already says what the new source says) |
| Rewritten | 301 |
| — new source (`v31`) | 205 |
| — terminology | 60 |
| — naturalness | 28 |
| — meaning (non-`v31` keys) | 5 |
| — quality (UI role / format) | 3 |
| Extra CLDR plural forms | 0 (Kazakh CLDR has only `one`/`other`) |

The 3 keys with no existing translation (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) were translated.

The terminology decisions below apply across all keys. Plan = «тариф», with plan names in Latin. Consultation = «кеңес», and
editing = «түзету», which is kept separate from review = «тексеру». Residence card = «шетелдіктің тіркеу картасы», never
«резидент картасы». Passport = «төлқұжат», never «паспорт». "The Hangyul team" = «Hangyul командасы», never «Hangyul Univ
тобы». Offer = «қабылдау туралы шешім», never «ұсыныс». Language institute = «университет жанындағы корей тілі курстары»,
never «тіл орталығы». Consular legalization is always «консулдық заңдастыру», never bare «заңдастыру». Notarization =
«нотариаттық куәландыру». Immigration authorities = «көші-қон органдары». Dedicated team = «бекітілген команда», not
«жеке команда», which reads as "private team". King Sejong Institute = «Седжон патша институты», not «Король…». Global Korea
Scholarship stays «Global Korea Scholarship (GKS)».

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Кеңес беру мерзімі», which presents the support window as a consultation period | «Кеңестен кейін сұрақ қоюға болатын мерзім» |
| 2 | `common:v29.pricing.compare.scopeNote` | did not say that writing new documents, translation and notarization are excluded | exclusion added in full |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Құжаттарды дайындау», as if Hangyul prepares the visa documents itself | «Виза құжаттарын дайындауға көмек» |
| 4 | `common:v29.pricing.premium.position` | application stage missing | «Өтінім беруден бастап виза, келу…» |
| 5 | `common:v29.pricing.premium.f4` | visa documents missing, only dates | «Виза құжаттары мен негізгі мерзімдер…» |
| 6 | `common:v29.addon.item.airport_pickup` | «…қарсы алуды ұйымдастыру», as if Hangyul organises the transport | «Серіктес арқылы әуежайдан қарсы алу» |
| 7 | `common:v29.pricing.compare.value.followUp.TEAM` | «Жауапты команда…» (stale "responsible team" wording) | «Командаңыздың сүйемелдеуі» |
| 8 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Мұқият тексеру», with the notes on what to fix missing | «Терең тексеру және нені түзету керегі туралы ескертпелер» |
| 9 | `dossier:group.extraCount` | «Тағы {{count}} құжат кейінге сақталды», a statement rather than the show-more action | «Тағы {{count}} сақталған құжатты көрсету» |
| 10 | `marketing:v11.services.s1.text` | «бүкіл үдерісті өз мойнымызға аламыз», «толық сай», «тіл орталықтары» | suggest, then help prepare and deal with the university, with no takeover and no superlatives |
| 11 | `marketing:v11.why.s1.text` | «әр кезеңіне біз жауап береміз», «жетістікке жеткізетін серіктес», which implies a result | help at every stage, one team from start to finish |
| 12 | `marketing:v11.why.s3.*` | «Ең тиімді баға, ең жақсы нәтиже», «студенттік өміріңіздің сәтті өтуіне» (superlatives and an implied outcome) | «Әділ баға, күтпеген шығынсыз»; scope shown before payment |
| 13 | `marketing:v11.faq.q6.a` | «Әр университет… стипендия ұсынады» (all universities) | «Көбі ұсынады…» |
| 14 | `marketing:v11.services.s3.title` | «Бірге болғандықтан күшті…», with no mention of students who have been there | «Бұл жолдан өткен студенттер қауымдастығы» |
| 15 | `marketing:v20.city.Gyeonggi.line/body` | "roomier" given as «жасылырақ» (greener); body said "street of shared flats" instead of students living in dormitories | «кеңірек»; «студенттердің көбі… университет жатақханаларында тұрады» |
| 16 | `marketing:v12.terms.services.documents` | «Өтінім құжаттарын дайындау және тексеру», as if Hangyul prepares the documents | «…дайындауға көмек және құжаттарды тексеру» |
| 17 | `marketing:v12.terms.services.writing` / `definitions.support.def` | editing given as «тексеру» (review) | «түзету» |
| 18 | `marketing:v12.terms.universityInfo.p` | contained Hangul («대학알리미») | «Academy Info» with a Kazakh description |
| 19 | `marketing:v12.privacy.collect.verification.purpose` | «автоматты тіркелулер» for fraudulent sign-ups | «алаяқтық тіркелулер» |
| 20 | `student:discover.verdict.reach`, `success:group.possible` | «Ықтимал сәйкестік»: the reader does not learn that the requirements are met but need checking | «Талаптарға сай, тексеру керек» |
| 21 | `student:register.privacyNote` | «тек сіз таңдаған кеңесшімен…», with the Hangyul team and its partner agency missing | «…Hangyul командасымен (оның серіктес агенттігін қоса)…» |
| 22 | `student:phase.prepare.text` | «Hangyul Univ тобымен бірге… жазыңыз», which reads as co-writing | «…командасының пікірлерін ескеріп… жазыңыз» |
| 23 | `student:v15.services.allowance.unlimited` | «тұрақты байланыс» (unscoped, unlimited contact) | «Қызмет мерзімі ішінде… кез келген уақытта сұрақ қоюға болады» |
| 24 | `student:v15.services.scope.consultation` | «Кеңес ұзақтығы» (V15 duration model) | «Кеңес» |
| 25 | `student:v15.services.allowance.key.max_managed_applications` | «Жүргізілетін өтінімдер» (passive count label) | «Сізбен бірге жүргізетін өтінімдер» |
| 26 | `student:v4.ws.team.final` | «…өтініміңізді {{university}} университетіне жібереді», as if Hangyul submits | «…өзіңіз тапсырар алдындағы соңғы тексеру» |
| 27 | `student:v9.family.consent` | «сілтемені жіберген адаммен» (the sender, not the recipient) | «сілтемені алған адаммен» |
| 28 | `student:v9.money.when.BEFORE_VISA` | «Виза алғанға дейін» (before getting the visa) | «Визаға өтінім бергенге дейін» |
| 29 | `visaroute:step.slow_items.why` | apostille missing, only consular legalization | «Апостиль не консулдық заңдастыру…» |
| 30 | `marketing:v15.pricing.compare.item` | «Бап», although the English is intentionally empty | empty |

Systemic issues fixed beyond the table:

| Issue | Keys fixed |
|---|---|
| «Резидент картасы» | 14 |
| «Hangyul Univ тобы» / «Топқа» | 15 |
| «Паспорт» | 9 |
| «Ұсыныс алынды/қабылданды» for offer | 4 |
| «тіл орталығы» | 3 |
| «жоспар» for plan | 3 |
| em-dash connectors | 15 |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 4 | 5 | 4 | 4 | 26 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, the why, services and FAQ areas would have scored below 20 because of the guarantees, superlatives
and missing content listed above. Every area is now at 26/30 or higher. This is an internal review tool, not a
measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «Hangyul командасы», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses, final check says the student submits, "meets requirements, needs checking" tier |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, needs-fixing wording |
| Services | 5 | 5 | 4 | 5 | 4 | support window, unlimited scoped to the service term, consultation no longer a duration, managed applications, exclusions |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, TB certificate, pickup via a partner, residence-card term |

## Unresolved ambiguity / limits (listed, not guessed)

- «оқу жоспары» for study plan: in Kazakh it can also mean a curriculum. It is the term Kazakh applicants use for GKS and
  university study plans, and it always appears next to «мотивациялық хат», so it is kept. A human reviewer may prefer
  «білім алу жоспары».
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept as «Таңбалау және жарнама жазбалары». The exact Kazakh
  legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` = «Қолданбалы бакалавр». This is the closest Kazakhstani level, not an exact equivalent.
- `_one` forms for keys that have only `_other` in the job cannot be delivered through this pipeline. Kazakh `other`
  is grammatically correct for every number, so nothing breaks.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=kk` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
