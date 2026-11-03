# V31 native-quality review: Kyrgyz (ky)

Locale `ky` (Kyrgyzstan, Cyrillic). Job `scripts/i18n/v28/jobs-v31/ky.json`, output `scripts/i18n/v28/tx-v31/ky.json`,
glossary `docs/qa/v31/l10n/glossary/ky.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`. Polite «сиз» register throughout.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,431 (incl. 43 `v31` keys whose existing Kyrgyz already says what the new source says) |
| Rewritten | 298 |
| — new source (`v31`) | 210 |
| — terminology | 51 |
| — naturalness | 28 |
| — meaning (non-`v31` keys) | 5 |
| — quality (UI role / format) | 4 |
| Extra CLDR plural forms | 0 (Kyrgyz CLDR has only `one`/`other`) |

The 3 keys with no existing translation (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) were translated.

The terminology decisions below apply across all keys:

- Plan = «тариф», with plan names in Latin. «план» is kept only for non-product senses (study plan, visa plan, money plan).
- Application = «арыз».
- Consultation = «кеңеш». The mixed «консультация» in the refund terms was unified.
- Editing = «оңдоо», which is kept separate from review = «текшерүү».
- Residence card = «чет элдиктин каттоо картасы», never «резидент картасы».
- "The Hangyul team" = «Hangyul командасы», never «Hangyul Univ командасы» unless the source itself says "Hangyul Univ team".
- Offer = «кабыл алуу чечими», never «сунуш».
- Language institute = «университеттин алдындагы корей тили курстары», never «тил борбору».
- Consular legalization = «консулдук легалдаштыруу», never bare «легализация». The forbidden «консулдук ырастоо» is not used.
- Personal statement = «мотивациялык кат», never «өзү тууралуу баяндама».
- Immigration authorities = «миграциялык органдар».
- Dedicated team = «бекитилген команда», not «жеке команда».
- King Sejong Institute = «Седжон падыша институту».
- Global Korea Scholarship stays «Global Korea Scholarship (GKS)».
- Passport stays «паспорт», which is the standard Kyrgyz term.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Кеңеш берүү мөөнөтү» (support window shown as a consultation period) | «Кеңештен кийин суроо берүүгө боло турган мөөнөт» |
| 2 | `common:v29.pricing.compare.scopeNote` | the exclusion of new documents, translation and notarization was missing | exclusion added in full |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Документтерди даярдоо», as if Hangyul prepares the visa documents | «Виза документтерин даярдоого жардам» |
| 4 | `common:v29.pricing.premium.position` | the application stage was missing | «Арыз берүүдөн тартып виза, келүү…» |
| 5 | `common:v29.pricing.premium.f4` | visa documents were missing, only dates | «Виза документтери жана негизги мөөнөттөр…» |
| 6 | `common:v29.addon.item.airport_pickup` | «…тосуп алууну уюштуруу» (Hangyul organises the transport) | «Өнөктөш аркылуу аэропорттон тосуп алуу» |
| 7 | `common:v29.pricing.compare.value.followUp.TEAM` | «Жооптуу команданын жардамы» (stale "responsible team" wording) | «Командаңыздын коштоосу» |
| 8 | `common:v29.pricing.compare.row.managed` / `student:v15…max_managed_applications` | «Жүргүзүлгөн/Жүргүзүлүүчү арыздар» (passive count label) | «Сиз менен бирге жүргүзгөн арыздар» |
| 9 | `common:v29.pricing.compare.row.dedicated` | «Жеке команда · артыкчылык» (reads as a private team) | «Бекитилген команда жана биринчи кезекте жооп» |
| 10 | `dossier:group.extraCount` | «…кийин үчүн сакталды» (a statement instead of the show-more action) | «Дагы {{count}} сакталган документти көрсөтүү» |
| 11 | `marketing:v11.services.s1.text` | «толук туура келген», «бүт процессти өз мойнубузга алабыз», «тил борборлору» | suggest, then help prepare and deal with the university |
| 12 | `marketing:v11.why.s1.text` | «ар бир этабына биз жооп беребиз», «ийгиликке жеткирүүчү өнөктөш» | help at every stage, one team start to finish |
| 13 | `marketing:v11.why.s3.*` | «Эң ылайыктуу баада, эң жакшы натыйжа», «ийгиликтүү өтүшүнө» | «Адилет баа, күтүлбөгөн чыгымсыз»; scope seen before payment |
| 14 | `marketing:v11.faq.q6.a` | «Ар бир университет… сунуштайт» (all universities) | «Көбү сунуштайт…» |
| 15 | `marketing:v11.services.s3.title` | «Чогуу болгондуктан күчтүү…» (the students who have been there were missing) | «Бул жолдон өткөн студенттердин жамааты» |
| 16 | `marketing:v20.city.Gyeonggi.line/body` | "roomier" given as «жашылыраак»; the body did not say that students live in dormitories | «кеңирээк»; «студенттердин көбү… жатаканаларында жашайт» |
| 17 | `marketing:v12.terms.services.documents` | «Арыз документтерин даярдоо жана текшерүү» (Hangyul prepares the documents) | «…даярдоого жардам жана документтерди текшерүү» |
| 18 | `marketing:v12.terms.services.writing` / `definitions.support.def` | editing given as «текшерүү» and statements as «өзү тууралуу баяндама» | «мотивациялык катты… оңдоо» |
| 19 | `marketing:v12.terms.universityInfo.p` | contained Hangul («대학알리미») | «Academy Info» with a Kyrgyz description |
| 20 | `marketing:v12.privacy.collect.verification.purpose` | «автоматташтырылган каттоолор» used for fraudulent sign-ups | «алдамчы каттоолор» |
| 21 | `student:discover.verdict.reach`, `success:group.possible` | «Мүмкүн болгон дал келүү» / «Ылайык келиши мүмкүн» | «Талаптарга жооп берет, текшерүү керек» |
| 22 | `student:register.privacyNote` | «сиз тандаган кеңешчи…» (the Hangyul team and its partner agency were missing) | «…Hangyul командасы (анын өнөктөш агенттигин кошо)…» |
| 23 | `student:phase.prepare.text` | «Hangyul Univ командасы менен… жазыңыз» (reads as co-writing) | «…командасынын пикирлерин эске алып… жазыңыз» |
| 24 | `student:v15.services.allowance.unlimited` | «дайыма байланыш» (unscoped, unlimited contact) | «Кызмат мөөнөтүнүн ичинде… каалаган убакта суроо берсеңиз болот» |
| 25 | `student:v15.services.scope.consultation` | «Кеңештин узактыгы» (V15 duration model) | «Кеңеш» |
| 26 | `student:v4.ws.team.final` | «…андан кийин арызыңыз жөнөтүлөт» (implies Hangyul submits) | «…өзүңүз тапшыраардан мурунку акыркы текшерүү» |
| 27 | `student:v9.family.consent` | «шилтеме жөнөткөн адам» (the sender, not the recipient) | «шилтемени алган адам» |
| 28 | `student:v9.money.when.BEFORE_VISA` | «Визага чейин» (ambiguous: before getting the visa) | «Визага арыз бергенге чейин» |
| 29 | `visaroute:step.slow_items.why` | apostille missing, only consular legalization | «Апостиль же консулдук легалдаштыруу…» |
| 30 | `common:fit.level.ASSOCIATE` | «Кесиптик диплом (associate)», with English in the sentence | «Колледж диплому» |
| 31 | `marketing:v15.pricing.compare.item` | «Көрсөткүч», although the English is intentionally empty | empty |

Systemic issues fixed beyond the table:

| Issue | Keys fixed |
|---|---|
| «Резидент картасы» | 14 |
| «Hangyul Univ командасы» where the source is "the Hangyul team" | 15 |
| «Сунуш алынды/кабыл алынды» for offer | 4 |
| «план» for the product plan | 4 |
| «тил борбору» | 2 |
| em-dash connectors | 14 |

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

- «окуу планы» for study plan can also mean a curriculum in Kyrgyz. It is the term Kyrgyz applicants use and it always
  appears next to «мотивациялык кат», so it is kept.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept as «Белгилөө жана жарнама жазуулары». The exact
  Kyrgyz legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` = «Колледж диплому». Kyrgyzstan has no associate degree, so this is the closest local
  level, not an exact equivalent.
- «аккаунт» is kept as the UI term for account, because it is standard in Kyrgyz interfaces. «каттоо эсеби» appears once in
  older copy and was replaced in the CTA for consistency.
- `_one` forms for keys that have only `_other` in the job cannot be delivered through this pipeline. Kyrgyz `other`
  is grammatically correct for every number.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ky` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
