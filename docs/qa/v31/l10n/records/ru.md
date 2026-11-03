# V31 native-quality review — Russian (ru)

Locale `ru` (Russia, Central Asia; also the fallback for uz/kk/ky/tg). Job `scripts/i18n/v28/jobs-v31/ru.json`,
output `scripts/i18n/v28/tx-v31/ru.json`, glossary `docs/qa/v31/l10n/glossary/ru.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,500 (incl. 72 `v31` keys whose existing Russian already says what the new source says) |
| Rewritten | 229 |
| — new source (`v31`) | 180 |
| — terminology | 36 |
| — naturalness | 8 |
| — meaning (non-`v31` keys) | 3 |
| — quality (UI role / format) | 2 |
| Extra CLDR plural forms added (`_few`/`_many`) | 80 |

The 180 "new source" rewrites include many that also fixed meaning; the critical ones are listed below. The 3 missing
keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`, `student:home.documentsSub_one`) were
translated.

Owner copy (Koreanasha) on the homepage: every `v11.*` key whose source changed in V31 was re-translated from the new
source. The owner Russian copy is kept where it is unchanged and accurate (`v11.faq.q*.q` questions, `v11.hero.explore`,
`v11.faq.title`, `v11.nav.*`, image alts). The owner answers and section copy had guarantees, "all universities", missing
content and "языковые школы"; those are rewritten.

Terminology decisions applied across all keys: «план обучения» (not «учебный план», which in Russian means a curriculum),
«мотивационное письмо», «круг правок», «редактура» for editing (≠ «проверка» for review), «апостиль», «консульская
легализация» (never bare «легализация»), «нотариальное заверение», «карта регистрации иностранца» (not «ID-карта» /
«карта резидента»), «языковые курсы при университете» (not «языковая школа» / «языковой институт»), «решение о
зачислении» for an admission offer (not «предложение»), «срок подачи» (not «дедлайн»), «тариф» for plan, plan names in
Latin, «команда Hangyul» wherever the source says "the Hangyul team".

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Период консультаций» — срок для вопросов подан как период консультаций (смешение support window и сессий) | «Срок для вопросов после консультации» |
| 2 | `common:v29.pricing.compare.scopeNote` | пропущено, что написание новых документов, перевод и нотариальное заверение не входят в Premium | добавлено исключение полностью |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Подготовка документов» — будто Hangyul сам готовит визовые документы | «Помощь в подготовке документов на визу» |
| 4 | `common:v29.pricing.premium.position` | пропущен этап подачи заявок («поддержка с визой, приездом и первыми неделями») | «от подачи заявок до визы, приезда и первых недель в Корее» |
| 5 | `common:v29.addon.item.airport_pickup` | «Организация встречи в аэропорту» — не сказано, что встречу обеспечивает партнёр, Hangyul сам перевозку не ведёт | «Встреча в аэропорту через партнёра» |
| 6 | `dossier:group.extraCount` | «Ещё отложено на потом: {{count}}» — не кнопка показа, а другой смысл (отложено ≠ хранится) | «Показать ещё сохранённые документы ({{count}})» |
| 7 | `marketing:v11.why.s3.text` | «гарантируем поступление без стресса», «поможем получить максимально возможную стипендию» — гарантия и обещание, которых нет в источнике | «Hangyul помогает внимательно и по делу за честную цену, а что входит в ваш тариф, вы видите ещё до оплаты» — без гарантий |
| 8 | `marketing:v11.services.s2.text` | «поддержка… включая выдачу виз» — будто Hangyul выдаёт визы | «Помогаем подать документы на визу…» — решение остаётся за миграционными органами |
| 9 | `marketing:v11.services.s1.text` | «отвечаем за весь процесс… до общения с университетами», «лучшие университеты… идеально соответствуют», «языковые школы» | подбираем подходящие университеты и языковые курсы при университетах, помогаем подготовить документы и наладить общение |
| 10 | `marketing:v11.faq.q6.a` | «Все университеты предоставляют стипендии» | «В большинстве университетов есть…» |
| 11 | `marketing:v11.why.s3.title` | «Лучшие цены на рынке!» — непроверяемое сравнительное утверждение | «Честная цена без сюрпризов» |
| 12 | `marketing:v11.why.s1.text` | «до успешного поступления в университет», «партнёр по достижению успеха» — подразумевает результат | помощь на каждом этапе, одна команда от начала до конца |
| 13 | `marketing:v11.services.s3.title` | заголовок не о сообществе: «Мы предоставим вам всё необходимое для успешного старта» | «Сообщество студентов, которые уже прошли этот путь» |
| 14 | `marketing:v11.faq.q10.a` | ответ без содержания («зависит от специальности»), пропущено главное | инженерные и бизнес-направления — проще, гуманитарные — сложнее |
| 15 | `marketing:v20.city.Gyeonggi.line` | «дешевле, зеленее» — roomier передано как «зеленее», а во втором абзаце body пропущен вывод о том, что студенты чаще живут в общежитиях | «дешевле, просторнее…»; «поэтому больше студентов живут в университетских общежитиях» |
| 16 | `student:discover.verdict.reach` | «Возможно, подходит» — для уровня «соответствует требованиям, нужна проверка»; читатель не узнаёт, что требования выполнены, но их надо подтвердить | «Соответствует требованиям, нужна проверка» |
| 17 | `student:register.privacyNote` | «передаются только команде Hangyul и выбранным университетам» — пропущено партнёрское агентство, которое тоже получает данные | «…команда Hangyul, которая вас сопровождает (включая её партнёрское агентство), и выбранные вами университеты» |
| 18 | `student:phase.prepare.text` | «вместе с командой Hangyul Univ напишите мотивационное письмо и учебный план» — читается как совместное написание (editing ≠ writing) | «напишите… с учётом замечаний команды Hangyul»; «план обучения» |
| 19 | `student:v15.services.allowance.unlimited` | «Без ограничений с командой Hangyul Univ» — «без ограничений» без рамки срока услуги | «Задавайте вопросы команде Hangyul в любое время в течение срока услуги» |
| 20 | `student:v15.services.scope.consultation` | «Длительность консультации» — устаревшая модель V15 (минуты), консультация не измеряется длительностью в тарифе | «Консультация» |
| 21 | `student:v15.services.allowance.key.max_managed_applications` | «Заявления в работе» — пассивный счётчик, не передаёт, что это заявки, которые Hangyul ведёт вместе со студентом (запрещённая формулировка) | «Заявки, которые мы ведём с вами» |
| 22 | `student:v4.ws.team.final` | «Финальная проверка, затем отправка заявки в {{university}}» — неясно, кто подаёт; читается так, будто заявку отправляет Hangyul | «…перед тем, как вы сами подадите заявку в {{university}}» |
| 23 | `success:group.possible` | «Возможно, подходит» — потеряно «соответствует требованиям» и «нужна проверка» | «Соответствует требованиям, нужна проверка» |
| 24 | `visaroute:step.slow_items.why` | «Легализация…» — апостиль пропущен, остаётся только «легализация», хотя для многих стран нужен именно апостиль | «Апостиль или консульская легализация…» |

Systemic issues fixed beyond the table: «учебный план» for study plan (12 keys), «ID-карта иностранца» / «карта
резидента» (4), «Команда Hangyul Univ» where the source is "the Hangyul team" (19), «Получено предложение» for an
admission offer (4), «легализация» without «консульская» (3), and `marketing:v15.pricing.compare.item`, whose English is
intentionally empty but held «Позиция».

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
| Directory / discovery (`v12.directory.*`, `v20/v21/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, the why, services and FAQ areas would have scored below 20 on TRUST and SPECIFICITY because of the
guarantees, superlatives and missing content listed above. Every area is now at 26/30 or higher. This is an internal
review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «команда Hangyul», service-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | offer and acceptance statuses, final check says the student submits, reach tier wording |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, "unlimited" now scoped to the service term, consultation is no longer a duration, managed applications, items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, TB certificate, pickup via a partner, residence-card term |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` plural forms: Russian `_one` also covers 21, 31… The job supplies `_one` only for a few keys. Where the English
  `_one` has no `{{count}}` (`student:v8.compare.budget_one`, `student:v9.discovery.scholarship_one`), the Russian also
  has none (the validator requires identical placeholders), so a count of 21 would show the singular sentence without
  the number. Needs a source change (add `{{count}}` to the `_one` string) to be fully correct.
- `_one` for keys that have only `_other` in the job (e.g. `marketing:v12.directory.count`,
  `v12.privacy.retention.months/years`, `dossier:home.checkDetails_more`): `_one` is not in the job and the validator does not
  accept it as an extra form, so it cannot be delivered through this pipeline. `_few`/`_many` were added for every `_other`.
- `marketing:v12.privacy.retention.advertising.record` ("Records of labeling and advertising", 표시·광고): kept as
  «Записи о маркировке и рекламе»; the exact Russian legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` ("Associate degree") is rendered «Колледж». Russia has no associate degree, so it is the
  closest local level, not an exact equivalent.
- `marketing:v11.faq.q1.a` (owner Korean) lists a passport copy for parents "if the parent has no foreign passport"; the
  English says "no passport". Translated from the English (copy of the ID card, translated and notarized).

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ru` → `V28 l10n (1 locales): 1809 strings valid, 0 problems`
