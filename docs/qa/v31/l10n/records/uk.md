# V31 native-quality review — Ukrainian (uk)

Locale `uk` (Ukraine). Job `scripts/i18n/v28/jobs-v31/uk.json`, output `scripts/i18n/v28/tx-v31/uk.json`, glossary
`docs/qa/v31/l10n/glossary/uk.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`. Register: polite «ви» throughout; written as
standard Ukrainian, not adapted from the Russian copy (checked for Russianisms: «дедлайн», «пропозиція» for an offer,
«мовний інститут», «навчальний план» for the essay were all replaced).

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,445 (incl. 41 `v31` keys whose existing Ukrainian already says what the new source says) |
| Rewritten | 284 |
| — new source (`v31`) | 189 |
| — terminology | 39 |
| — meaning (non-`v31` keys) | 26 |
| — naturalness | 22 |
| — quality (UI role / format) | 8 |
| Extra CLDR plural forms added (`_few` / `_many`) | 80 |

The 3 keys with no existing translation (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) were translated.

Plurals: Ukrainian CLDR is `one / few / many / other` (`other` = fractions). Every `_other` key now has `_few`
(2–4: «2 документи», «3 місяці», «4 роки») and `_many` (5+: «5 документів», «днів», «стипендій»). Before this, i18next fell
back to `_other` for every integer, so the old copy showed «Потрібно 5 документа», «Залишилося 7 дня», «12 закладу».
Where the old `_other` was even wrong for fractions («Показано {{count}} збережену програму») it was rewritten as a
count-in-parentheses form valid for every number.

Terminology decisions applied across all keys: «тариф» for a plan (already consistent), «план навчання» for the study-plan
essay (never «навчальний план», which is a curriculum), «мотиваційний лист», «раунд редагування» (editing ≠ «перевірка»
for review), «консультація», «пробна співбесіда», «апостиль», «консульська легалізація» (never bare «легалізація»),
«нотаріальне засвідчення», «виписка з оцінками» for a transcript (not «академічна довідка», which in Ukraine is a
certificate of incomplete studies), «мовний центр університету» (not «мовний інститут»), «рішення про зарахування» /
«згоду на зарахування надано» for offer / offer accepted (not «пропозиція»), «строк подання» (not «дедлайн»),
«зустріч в аеропорту через партнера», «облаштування» for settling in, «команда Hangyul» wherever the source says "the
Hangyul team" (17 keys had «Hangyul Univ»), «імміграційні органи» decide on the visa, plan names in Latin.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Період консультацій» — support window as a period of consultations | «Строк для запитань після консультації» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that new documents, translation and notarization are not included | exclusion added; scope kept beside "no limit" |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Підготовка документів» — as if Hangyul prepares them | «Допомога з підготовкою візових документів» |
| 4 | `common:v29.pricing.notes.visaDecision` | «рішення ухвалює відповідний орган» — vague, visa issuance not named | «Рішення про видачу візи ухвалюють імміграційні органи» |
| 5 | `common:v29.pricing.premium.position` | started at the visa, dropped the application stage | «від подання заявок до візи, приїзду й перших тижнів у Кореї» |
| 6 | `common:v29.addon.item.airport_pickup` | «Організація зустрічі в аеропорту» — no partner, reads as Hangyul transport | «Зустріч в аеропорту через партнера» |
| 7 | `common:docCategory.TRANSCRIPT` | «Академічна довідка» — in Ukraine a certificate for incomplete studies | «Виписка з оцінками» |
| 8 | `common:appStatus.OFFERED` / `OFFER_ACCEPTED` (+ `student:stage.*`) | «Отримано пропозицію» / «Пропозицію прийнято» — calque, reads as a commercial offer | «Отримано рішення про зарахування» / «Згоду на зарахування надано» |
| 9 | `dossier:group.extraCount` | «Ще {{count}} збережено на потім» — a status line, not the "show more stored documents" toggle | «Показати ще збережені документи ({{count}})» |
| 10 | `marketing:v11.services.s1.text` | «беремо на себе весь процес… від підготовки документів до листування» — Hangyul takes over everything | we suggest, go through scholarships, help prepare documents and deal with the university |
| 11 | `marketing:v11.why.s1.text` | «Ми відповідаємо за кожен етап… партнер на шляху до успіху» — implied outcome | help at every stage, the same team start to finish |
| 12 | `marketing:v11.why.s3.title` / `.text` | «Найрозумніша вартість, найкращий результат», «підтримка зовсім іншого рівня» | «Чесна ціна, без сюрпризів»; you see what the plan includes before paying |
| 13 | `marketing:v11.faq.q6.a` | «Стипендії… пропонує кожен університет» | «Більшість пропонує…» |
| 14 | `marketing:v11.faq.q2.a` | a language certificate is always required | «Більшість… просить…; деякі натомість приймають власний іспит» |
| 15 | `marketing:v11.faq.q4.q` | «Чи можна готуватися…» — the question is about applying | «Чи можна вступати, не знаючи корейської?» |
| 16 | `marketing:v11.hero.lede` | «Допоможемо втілити вашу мрію в життя» — none of the source content | find the right university, every step with a team; start with what you want to study |
| 17 | `marketing:v11.services.s3.title` | «Студентська спільнота, сильніша тим, що ви разом» | «Спільнота студентів, які вже пройшли цей шлях» |
| 18 | `marketing:v12.terms.universityInfo.p` | contained Korean «대학알리미» inside the Ukrainian sentence | «офіційний корейський сервіс розкриття інформації про університети (Academy Info)» |
| 19 | `marketing:v12.privacy.retention.contract.record` | «відкликання підписки» — subscription cancellation, not order cancellation | «Записи про договори та скасування замовлень» |
| 20 | `marketing:v20.city.Gyeonggi.line` / `.body` | roomier as «зеленіше»; body lost "so more students live in dormitories" | «просторіше»; conclusion restored |
| 21 | `marketing:v15.pricing.compare.item` | «Позиція» where the source is intentionally empty | empty |
| 22 | `student:discover.verdict.reach`, `success:group.possible` | «Можлива відповідність» — loses "meets requirements" and "needs checking" | «Відповідає вимогам, потрібна перевірка» |
| 23 | `student:register.privacyNote` | partner agency omitted from who receives the data | «…команді Hangyul, яка вас супроводжує (зокрема її партнерській агенції)…» |
| 24 | `student:register.consent.CROSS_BORDER_VERIFICATION.label` | «для підтвердження особи» — identity verification; the source verifies the email and number | «…обробляються за кордоном для їх підтвердження» |
| 25 | `student:phase.prepare.text` | «разом із командою… напишіть мотиваційний лист і навчальний план» — co-writing; curriculum term | «напишіть… з урахуванням коментарів команди Hangyul»; «план навчання» |
| 26 | `student:v15.services.allowance.unlimited` | «Без обмежень із командою Hangyul Univ» — unlimited without the service-term scope | «Звертайтеся до команди Hangyul будь-коли протягом строку надання послуг» |
| 27 | `student:v15.services.allowance.key.max_managed_applications` | «Заявок у супроводі» — passive count label | «Заявки, які ми ведемо з вами» |
| 28 | `student:v4.ws.team.final` | «потім надсилання заявки до {{university}}» — reads as Hangyul submitting | «…перед тим, як ви самі подасте заявку до університету {{university}}» |
| 29 | `student:v25.lane.you` | «Що роблю я» (first person) | «Що робите ви» |
| 30 | `concierge:status.DORMITORY.ASSIGNED` | «Запропоновано кімнату» — offered, not assigned | «Кімнату призначено» |
| 31 | `visaroute:step.slow_items.why` | «Легалізація…» — apostille missing, bare legalization | «Апостиль або консульська легалізація, тест на туберкульоз і довідки про несудимість…» |
| 32 | `visaroute:caveat.EVISA_TIER_UNKNOWN` | «університет може оформити електронну візу» — reads as the university issuing the visa | «…може замість вас подати заяву на електронну візу» |

Systemic issues fixed beyond the table: «Hangyul Univ» for "the Hangyul team" (17 keys), «дедлайн» (8 keys),
«навчальний план» for the essay (5), «пропозиція» for an offer (5), bare «легалізація» (3), «мовний інститут» (2),
integer plurals (80 forms), em-dash connectors in hero/help/rights/security lists, «ознайомлений(а)» and «(-ла)»
gendered slashes rewritten neutrally, English left in a sentence («Korea Consumer Agency» now has the Ukrainian name).

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

Before the rewrite the hero, why, services and FAQ areas would have scored below 20 (TRUST, SPECIFICITY) because of the
dream/success slogans, superlatives, "every university" and missing source content. All areas are now ≥ 26/30. This is
an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | integer plurals, «команда Hangyul», services-in-progress title, next consultation |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses, final check says the student submits, reach tier, "you" lane, «строк подання» |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, "unlimited" scoped to the service term, managed applications, items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, TB certificate, pickup via a partner, room assigned, e-visa wording |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` exists in the job only for a few keys. Ukrainian `_one` also covers 21, 31…; where the English `_one` has no
  `{{count}}` (`student:v8.compare.budget_one`, `student:v9.discovery.scholarship_one`) the Ukrainian has none either
  (placeholders must match), so 21 would show the singular sentence without the number. Needs a source change.
- Keys with only `_other` in the job (e.g. `marketing:v12.directory.count`, `v12.privacy.retention.*`,
  `dossier:check.matching`) have no `_one`; 1/21/31 fall back to `_other` («1 закладу»). Needs `_one` in the job.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept «Записи щодо маркування та реклами»; the exact
  Ukrainian legal counterpart of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` = «Коледж» (fahovyi molodshyi bakalavr level): closest local level, not an exact equivalent.
- `visaroute:doc.business_registration.name` (사업자등록증) kept as «Свідоцтво про реєстрацію університету»; Ukraine has no
  single equivalent of a Korean business registration certificate.
- `student:v9.funds.longer` keeps the government rating name in quotes («консалтинг»); no established Ukrainian rendering.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
