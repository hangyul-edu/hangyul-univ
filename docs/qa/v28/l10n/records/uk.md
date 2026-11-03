# V28 l10n review: uk (Українська)

Job `scripts/i18n/v28/jobs/uk.json` → `scripts/i18n/v28/tx/uk.json`. Register: «ви», friendly and modern for students;
concise professional wording in the agency and university consoles.

## Personas

1. **Олена, 18, Київ (first-time visitor).** Opens a university page from search on her phone. Wants to see in seconds
   whether she can apply and what the next step is.
2. **Андрій, 26, Львів (comparison shopper).** Compares English-taught master's programmes and service tiers. Checks
   visa and document terms precisely.
3. **Наталія, 48, мама Олени.** Pays the tuition. Worries about scams and hidden fees; wants calm, exact wording.

## Glossary (reused from V27 uk, extended)

| English | Korean | Ukrainian |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | команда Hangyul (never «ваш консультант») |
| consular legalization | 영사확인 | консульська легалізація |
| legalization (generic) | 공증·인증 | легалізація |
| apostille | 아포스티유 | апостиль |
| admission guide | 모집요강 | правила прийому |
| Global Korea Scholarship (GKS) | 정부초청장학 | Стипендія уряду Кореї (GKS) |
| scholarship | 장학금 | стипендія |
| tuition | 등록금 | плата за навчання / вартість навчання |
| plan (paid) | 플랜 | тариф |
| intake | 모집 학기 | набір |
| deadline | 마감 | дедлайн / термін |
| offer | 합격 | пропозиція |
| enrollment | 등록 | зарахування |
| residence card | 외국인등록증 | посвідка на проживання |
| proof of funds | 재정 증명 | підтвердження фінансів |
| international office | 국제교류처 | міжнародний відділ |
| dormitory | 기숙사 | гуртожиток |
| case / case owner | 건 / 담당자 | справа / відповідальний |
| Writing section / essay | 글쓰기 / 에세이 | «Написання» / есе |
| interview | 면접 | співбесіда |
| diplomatic post | 공관 | установа |
| far quick-fit tier | 준비가 더 필요한 대학 | Потрібна додаткова підготовка |
| pipeline | 파이프라인 | воронка |
| minimum | 최저 | мінімальний |

## Plurals

CLDR uk: one / few / many / other. For each of the 10 `_other` job keys `_few` and `_many` were added (20 forms). Count
labels that read better without agreement use a colon («Неперевірених документів: {{count}}»). Agreeing forms:
`programs.semesters` (семестр/семестри/семестрів, `_other` = семестру for fractions), `ov.dates.programs`,
`v7.pr.applicants` (заявка/заявки/заявок), `v8.move.lastMoved` (дня/дні/днів). `_one` strings never hard-code «1» because
uk `_one` also serves 21, 31… The three `_one`-only job keys cannot take extra forms here (the validator rejects them
without `_other`); they rely on forms already in the bundle.

## Pass A: meaning (28 strings changed)

All 20 «консультант» strings now name the Hangyul team; fit tiers follow the V28 English.

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.title | Поки що шлях іще довгий | Потрібна додаткова підготовка |
| common:fit.tier.CHALLENGE.lede | Нам невідомо нічого… Чинні вимоги… ми ще не перевірили… | Hangyul ще не перевірив вимоги цих університетів для цього рівня. Ми перевіримо їх разом з вами. |
| visaroute:step.slow_items.why | Підтвердження, тест на туберкульоз… | Легалізація, тест на туберкульоз… (removes the "confirmation" reading of 영사확인) |
| university:v22.stageHint.decision | У списку очікування — рішення ще за нами | У списку очікування. Рішення ще не ухвалено |
| marketing:v15.pricing.premium.f5 | Заявка в гуртожиток, онлайн-орієнтація до вильоту… | Гуртожиток, приїзд і 30 днів допомоги з облаштуванням |

## Pass B: native naturalness (36 strings changed)

| Key | Before | After |
|---|---|---|
| marketing:v20.uni.ctaTitle | Готові поставитися до цього серйозно? | Думаєте вступати сюди? |
| marketing:v20.uni.whyTitle | Що це за університет | Чим він вирізняється |
| agency:v8.ops.ageing.title | Старіння справ за етапами | Тривалість простою справ за етапами |
| agency:v9.ops.unpaid.q | Хто оплатив послугу, але його справу ніхто не веде? | Хто зі студентів оплатив послугу, але не має відповідального? |
| student:v9.announced.rule.STUDY_DEPOSIT_SCHEME | Студенти без знання корейської… які вивільнятимуться щосеместру. | Студенти з деяких країн без результату тесту з корейської… а виплачуватимуть їх щосеместру. |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
|---|---|---|
| agency:docs.uploadForName (draft) | Завантажити за {{name}} | Завантажити від імені {{name}} |
| university:v8.aq.need | Потреба в рішенні | Потрібно для рішення |
| visaroute:help.who | Хто діє | Хто це робить |
| visaroute:form.source.missing | Немає в Hangyul | Немає в даних |
| agency:docs.sc.checks | Позначити перевірку / обрати причину | Позначте перевірку або оберіть причину |

«тариф» for plan everywhere (pay subtitle, workspace tab, plan title), «набір» for intake, «легалізація» for 영사확인/
legalization.

## Marketing scorecard (30 points)

| Section | Score | Notes |
|---|---|---|
| SEO / home description | 26 | split into two short sentences, no dash chain |
| Pricing | 26 | lede starts with the choice; f5 matches the English scope |
| City pages | 25 | Gyeonggi rewritten to name the direction of travel; Seoul line new |
| University page | 26 | CTA as a direct question; GKS uses the established «Стипендія уряду Кореї» |
| Universities index + FAQ | 25 | «Університети по всій Кореї.» |

## Unsure

- `marketing:v20.uni.why.ieqasExcellent` «IEQAS: відмінний рівень»: no official Ukrainian grade name.
- `agency:v27.stage.recent` «Остання зміна {{count}} дн. тому» uses the abbreviation to avoid agreement (not a plural key).
- `university:eduLevel.HIGH_SCHOOL` «Старша школа» vs «Середня школа»: chosen to match the Korean 고등학교 level.
- `student:start.result.create` «Зберегти й побачити всі мої варіанти»: "matches" rendered as «варіанти» here, while the
  V27 glossary uses «підбір». Kept for a natural CTA.

## Final source↔target comparison

All placeholders, numbers (1500 вон), test names, IEQAS/GKS/SLA/OCR, ÷ and → preserved; no admission probability words.
Validator: `390 strings valid, 0 problems` (370 job keys + 20 extra plural forms).

## Counts

Job keys 370 · kept verbatim 46 · rewritten 70 · newly translated 254 · extra plural forms 20.

## Second pass (jobs2): leak families the crawl missed

Scope: `scripts/i18n/v28/jobs2/uk.json`: marketing 2 · student 39 · success 465 · dossier 124 = **630 job keys** + 14 extra plural forms (`_few`/`_many` for the 7 `_other` keys).
Output `scripts/i18n/v28/tx2/uk.json`. Same personas, glossary and method as above. The first-pass glossary terms are reused
unchanged: заявка (application) · подати/подання (submit) · дозвіл / надати дозвіл (authorization) · реєстраційний збір (application fee) · квитанція (receipt) · есе · консульська легалізація · апостиль · команда Hangyul. Student-facing "your counselor" → the Hangyul team throughout; console `{{counselor}}` name placeholders
and the agency `ownerShort.counselor` column keep the role word.

Passes: A meaning (counselor → team, authorization ≠ calque, "Strong/Possible match" = first-pass `group.*` labels), B naturalness,
C UI brevity and placeholder-safe word order (count-first plurals turned into «label: {{count}}» where a bare fallback key exists).
Marketing (2 keys, `v20.uni.intl.*`): scored 26/30 (clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4) after one rewrite.

Examples (draft → final):
- `success:item.ESSAY_REVISE.why`: *Ваш консультант попросив внести зміни.* → *Команда Hangyul попросила внести зміни.*
- `success:item.SUBMISSION_AUTHORIZE.title`: *Авторизуйте {{agency}} подати…* → *Дозвольте {{agency}} подати вашу заявку до {{university}}*
- `success:obs.DEADLINES_CONCENTRATED`: *{{count}} дедлайнів протягом {{days}} днів.* → *Дедлайнів протягом {{days}} дн.: {{count}}.*
- `dossier:upload.haveTitle_one`: *У вас уже є {{status}} {{doc}}…* → *У вас уже є {{doc}} {{status}} — використовується в {{count}} заявці*
- `dossier:page.privacy`: *…лише ви, команда Hangyul і Hangyul…* → *Ці файли бачите лише ви та команда Hangyul. …*

Unsure:
- `success:line.improve_one` «1 пункт для покращення»: CLDR `one` in uk also covers 21, 31…; the English has a literal 1 (no {{count}}), so 21 would read «1».
- `dossier:upload.status.VERIFIED` «(перевірено)» / `EXPIRED` «(термін дії минув)» are parenthesised so they need no gender agreement with {{doc}}.
- `submission.alreadySubmitted` «Я вже подав(-ла) заявку» uses the (-ла) gender slash.
- `success:block.title_one`, `block.inChecklist_one`, `line.more_one`: `_one`-only keys with no `_other`, so no extra forms can be added; the English has a literal 1, kept as a word/digit.
- `dossier:upload.status.NEEDS_REVIEW` / `UPLOADED` / `NEEDS_CORRECTION` are intentionally empty (validator requires empty); `upload.haveTitle*` was built so the empty status slot reads cleanly.
- `page.needYou` and `check.matching` are bare fallback keys beside `_one`; written as «label: {{count}}» so they are grammatical for any count.

Counts: job keys 630 · kept verbatim 0 (no `current` values) · rewritten 0 · newly translated 630 · extra plural forms 14.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=uk` → `644 strings valid, 0 problems` (EXIT=0).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
