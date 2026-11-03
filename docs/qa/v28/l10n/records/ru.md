# V28 l10n review: ru (Русский)

Scope: 354 job keys in `scripts/i18n/v28/jobs/ru.json` plus 20 added CLDR plural forms (`_few`, `_many` for every
`_other` key). Output: `scripts/i18n/v28/tx/ru.json`. Glossary and personas carried over from
`docs/qa/v27/l10n/ru.md`. Russian is also read by Uzbek, Kazakh and Kyrgyz users, so no Russia-specific references.

## Personas

1. **Алия, 18, Алматы** (first-time visitor). School leaver, opens the marketing site on her phone, then the student app.
2. **Дмитрий, 27, Новосибирск** (comparison shopper). Master's applicant comparing tariffs, universities and visa terms.
3. **Гульнара, 46, Ташкент** (parent/sponsor). Pays; reads Russian as a second language; distrusts promises.
4. Console users: agency counselor (Бишкек) and a university admissions officer reading Russian UI.

## Glossary

| English | Korean | Russian |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | команда Hangyul (replaces every «ваш консультант» on student screens) |
| consular legalization | 영사확인 | консульская легализация |
| apostille | 아포스티유 | апостиль |
| certificate of enrollment | 재학증명서 | справка об обучении |
| Korean language institute | 어학당 | языковой институт при университете |
| admission guide / rules | 모집요강 / 입학 요건 | правила приёма |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Стипендия правительства Кореи (GKS) |
| residence card | 외국인등록증 | ID-карта иностранца |
| plan (paid) | 플랜 | тариф |
| offer | 합격 | предложение (о зачислении) |
| enrollment | 등록/입학 | зачисление |
| intake | 모집 학기 | набор |
| deadline | 마감 | дедлайн / срок подачи |
| application | 지원서 | заявка |
| case | 건/케이스 | дело |
| owner (staff) | 담당자 | ответственный |
| task | 할 일/업무 | задача |
| proof of funds | 재정 증명 | подтверждение финансов |
| dormitory | 기숙사 | общежитие |
| international office | 국제교류처 | международный отдел |
| pipeline | 파이프라인 | воронка |
| Writing (section) | 글쓰기 | «Тексты» |
| Needs more preparation (far tier) | 준비가 더 필요한 대학 | Нужно больше подготовки |
| Recommended (sort) | 추천순 | Рекомендуемые (browsing order, not a ranking) |
| police certificate | 범죄경력 증명 | справка о несудимости |

Test names (TOPIK, TOEFL iBT, IELTS Academic, GPA, IEQAS, SLA, NHIS, HiKorea, OCR) stay Latin.

## Pass A: meaning (52 strings changed)

Mostly: student/visa screens re-sourced from "your counselor" to "the Hangyul team" (17 keys), fit tiers rewritten
in V28 English, and strings whose old Russian no longer matched the English.

| Key | Before | After |
|---|---|---|
| concierge:help.route.HOUSING (+4 routes) | Ваш консультант | Команда Hangyul |
| common:fit.tier.CHALLENGE.title | Стоит присмотреться | Нужно уточнить с нами |
| common:fit.tier.UNCLEAR.title | Пока путь ещё долгий | Нужно больше подготовки |
| university:v22.stageHint.decision | В листе ожидания — решение ещё за нами | В листе ожидания. Решение ещё не принято |
| student:scholarships.empty | Пока нет стипендий для показа. | …Заполните профиль, чтобы узнать, какие вам подходят. (second sentence was missing) |

## Pass B: native naturalness (21 strings changed)

| Key | Before | After |
|---|---|---|
| student:v16.pay.chooseSubtitle | Выберите план по тому, как далеко Hangyul идёт с вами. Один платёж, не подписка. | Выберите тариф по тому, сколько помощи вам нужно от Hangyul. Один платёж, без подписки. |
| agency:inbox.pickText | …с любым студентом, которого вы сопровождаете. | …с любым из ваших студентов. |
| student:profileV3.why.goals | Что и когда вы хотите изучать — так в списке останутся… | Зная, что и когда вы хотите изучать, мы оставим в списке… |
| agency:v8.ops.ageing.title | Длительность дел по этапам | Сколько дела стоят на каждом этапе |
| agency:v27.stage.recent (new) | draft «Последнее изменение: дней назад — {{count}}» | Последнее изменение {{count}} дн. назад (count-neutral, no plural key in job) |

## Pass C: UI context, brevity, one term per concept (14 strings changed)

| Key | Before | After |
|---|---|---|
| marketing:v15.pricing.compare.row.dormitory | Помощь с общежитием | Общежитие (row label, matches EN "Dormitory") |
| marketing:v15.pricing.premium.f5 | Заявка в общежитие, онлайн-ориентация до вылета и 30 дней поддержки… | Общежитие, приезд и 30 дней помощи с обустройством (no invented "online orientation") |
| visaroute:form.source.missing | Нет в Hangyul | Нет данных |
| visaroute:step.slow_items.why | Заверения, … справки из полиции | Легализация, … справки о несудимости (glossary term) |
| residence.groupUnknown | карты регистрации | ID-карты иностранца (one term with NHIS_D2) |

## Plurals

Every `_other` key also has `_few` and `_many` (10 keys → 20 forms). Count-label keys use a count-neutral layout
(«Просрочено: {{count}}»); noun-agreeing keys inflect (семестра / семестров, заявки / заявок, дня / дней). Keys that exist
only as `_one` (`inDays_one`, `deadline_one`, `task_one`) were written so they also read correctly for 21, 31 («через 21 день»).

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| seo.home / journey | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| v15.pricing (lede, compare, premium) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| v20.city (Busan, Gyeonggi, Seoul, Gyeongnam) | 5 | 5 | 5 | 4 | 4 | 4 | 27 |
| v20/v28 university page (why, cta, intl, office) | 5 | 5 | 4 | 4 | 5 | 4 | 27 |
| v9.faq.languagesA / v23 footer / v6.unis | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

First drafts below 25: v20.uni.ctaTitle literal «Думаете о подаче заявки в этот университет?» (22, long, weak CTA) →
«Думаете подать заявку сюда?»; seo.home.description one long sentence with a dash chain (23) → two sentences.

## Final source↔target comparison

Validator checked placeholders, tags, script, length, Hangul. I read every pair: no string implies admission
probability; the far tier says "needs more preparation"; "Recommended" not used as a rank; Hangyul in Latin everywhere.

## Unsure

- `agency:docs.uploadForName` «Загрузить за {{name}}»: Russian case of an interpolated name can't be inflected; reads as "on behalf of".
- `university:v25.in.yield` «Предложения, закончившиеся зачислением»: a KPI label; «Конверсия в зачисление» may suit analytics staff better.
- `marketing:v20.uni.why.ieqasExcellent` «IEQAS: «отличный» уровень»: official Russian name of the 우수 grade unknown.
- `visaroute:staff.route` «Вариант» vs «Маршрут» for the visa route concept (kept «вариант» to match student screens).
- `v7.pr.applicants_*` use `{{n}}`, not `{{count}}`; if the code passes only `n`, i18next will not select the plural and `_other` («заявки») shows for every number.

## Counts

Job keys 354 · kept verbatim 36 · rewritten 87 · newly translated 231 · extra plural forms 20 ·
validator: 374 strings valid, 0 problems.

## Second pass (jobs2)

Scope: `scripts/i18n/v28/jobs2/ru.json` → `scripts/i18n/v28/tx2/ru.json`, 521 job keys (agency 215, success 204, student 39,
university 34, dossier 27, marketing 2): conditional states the crawl never recorded (workspace waiting lines, readiness
blockers, v9 waiting reasons, submission queue, portfolio review, university outcomes and empty states). All 521 were missing
or English: newly translated 518, kept verbatim 0, rewritten 0, plus 3 empty-English `dossier:upload.status.*` keys left empty
as the validator requires. 20 extra plural forms added (`_few` + `_many` for every `_other`; `_other` uses the genitive
singular for fractional counts). Same personas; first-pass glossary unchanged (команда Hangyul, консульская легализация,
апостиль, правила приёма, набор, тариф, дело, ответственный, воронка). New: подача / записать подачу (submission / record),
согласие (authorization), портфель заявок (portfolio), операционная команда Hangyul (Hangyul operations), Fixture (Latin label).

- Pass A (meaning): 518 drafted from EN with KO for ambiguity; student "your counselor" in `dossier:page.privacy` rendered as
  команда Hangyul (team identity rule).
- Pass B (naturalness): 11 changed, e.g. counts moved to «Осталось дней: {{days}}» / «Файлов: {{ready}}/{{total}}» so numbers
  never need case agreement; «со слов» for "reported/self-reported".
- Pass C (UI/brevity): 8 shortened (queue columns, status chips, `v27.issue.*`), one term per concept (подача, срок, проверка).

| Key | Before | After |
|---|---|---|
| `agency:ws.block.review_few` | (missing form) | {{count}} документа ждут вашей проверки |
| `agency:v15.readiness.blocker.document_legalization` | English: {{detail}} needs an apostille or consular legalization | {{detail}}: нужен апостиль или консульская легализация |
| `student:workspace.owner.done.team` | English: Still here if you need help with student life. | Всегда поможет с вопросами студенческой жизни. |
| `success:queue.detail.mechanismText` | English: Open the official portal in your own browser… | Откройте официальный портал в своём браузере и подайте заявку там через собственный аккаунт агентства. Hangyul не хранит пароли от порталов и ничего не подаёт сам. |
| `university:v22.empty.enrolment` | English: Nobody is between offer and enrolment right now. | Сейчас никто не находится между предложением и зачислением. |

Marketing scorecard (`v20.uni.intl.*`, 2 keys): clarity 5 · trust 5 · naturalness 5 · brevity 5 · CTA 4 · cultural fit 5 = 29.

### Second pass: unsure

- `dossier:page.privacy`: EN "you, your counselor and Hangyul" → «вы и команда Hangyul»; confirm the product means the team.
- `agency:ws.level.ASSOCIATE` «Колледж (associate)»: no exact Russian equivalent of an associate degree.
- `agency:v27.stage.stalled` / `v27.evidence.ageDays` use «дн.» to avoid case agreement with `{{count}}` (no plural keys in the job).
- `success:feeStatus.PAID` «Оплачено (со слов)»: "reported" by the payer, not verified; a native reviewer may prefer «по данным студента».

Counts (second pass): job keys 521 · kept verbatim 0 · rewritten 0 · newly translated 518 (+3 empty-by-design) · extra plural forms 20.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ru` → **541 strings valid, 0 problems**.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
