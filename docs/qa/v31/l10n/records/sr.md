# V31 native-quality review — Serbian (sr, Cyrillic)

Locale `sr` (Serbia; Cyrillic script, ijekavian not used — ekavian standard). Job `scripts/i18n/v28/jobs-v31/sr.json`,
output `scripts/i18n/v28/tx-v31/sr.json`, glossary `docs/qa/v31/l10n/glossary/sr.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.
Register: polite «ви» throughout (buttons in the short imperative form already used by the product: «Сачувај», «Отпреми»).

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,421 (incl. 30 `v31` keys whose existing Serbian already says what the new source says) |
| Rewritten | 308 |
| — new source (`v31`) | 201 |
| — terminology | 45 |
| — naturalness | 32 |
| — meaning (non-`v31` keys) | 23 |
| — quality (UI role / format) | 7 |
| Extra CLDR plural forms added (`_few`, plus `_many` = `_other`) | 80 |

The 4 keys with no existing translation (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`, `student:v8.compare.budget_one`) were translated. Many of the 201 "new source" rewrites
also fixed meaning; the critical ones are listed below.

Plurals: Serbian CLDR has `one / few / other` (no `many`). `_few` was written with the correct paucal form (2–4:
«2 документа», «3 месеца», «4 године», «2 непрочитане поруке»); `_many` was added identical to `_other` so the pipeline
has every form; it is never selected by `Intl.PluralRules('sr')` and is harmless.

Terminology decisions applied across all keys: «пакет» for a plan (marketing already used it; student-app «план» changed
to match), «план студирања» for the study-plan essay (not «план студија», which in Serbian means a curriculum),
«мотивационо писмо», «круг исправки» for an editing round (≠ «провера» for review), «консултација» (not «саветовање»,
which stays only for a university's counselling service), «пробни интервју», «апостил», «конзуларна легализација» (never
bare «легализација»), «овера код јавног бележника», «језички центар универзитета» (not «школа језика»), «одлука о
пријему» for an admission offer (not the anglicism «понуда»), «дочек на аеродрому, у сарадњи са партнером» (not
«превоз»), «сналажење» for settling in, «тим Hangyul» wherever the source says "the Hangyul team" (17 keys had «Hangyul
Univ»), «имејл» (not mixed with «е-пошта»), plan names in Latin. Brand never takes a Cyrillic case ending («Hangyul-у»
removed: «компанији Hangyul», «тиму Hangyul»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Период консултација» — support window presented as a period of consultations | «Период за питања после консултације» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included in Premium | exclusion added in full, scope kept beside "no limit" |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Припрема докумената» — as if Hangyul prepares the visa documents | «Помоћ у припреми документације за визу» |
| 4 | `common:v29.pricing.premium.position` | started at the visa, dropped the application stage | «од пријаве до визе, доласка и првих недеља у Кореји» |
| 5 | `common:v29.addon.item.airport_pickup` | «Организовање дочека на аеродрому» — no partner, reads as Hangyul transport | «Дочек на аеродрому, у сарадњи са партнером» |
| 6 | `common:v29.pricing.compare.value.dormitory.INFORMATION` / `.SCHEDULE` | bare «Информације»; schedule not stated as tracking | «Информације о студентском дому» / «Пратимо рокове за пријаву» |
| 7 | `dossier:group.extraCount` | «Још {{count}} сачувано за касније» — a status line, not the "show more stored documents" toggle | «Прикажи још сачуваних докумената ({{count}})» |
| 8 | `marketing:v11.services.s1.text` | «цео процес… преузимамо на себе», «школе језика» — Hangyul takes over the whole process | we suggest universities and language centres, go through scholarships, help prepare documents and deal with the university |
| 9 | `marketing:v11.why.s1.text` | «Преузимамо одговорност за сваку фазу… партнер на путу до успеха» — implied outcome | help at every stage, the same team from start to finish |
| 10 | `marketing:v11.why.s3.title` / `.text` | «Најразумнији трошак, најбољи резултат», «подршка сасвим другог нивоа, вредна сваког динара» — unverifiable superlatives | «Поштена цена, без изненађења»; you see what the plan includes before paying |
| 11 | `marketing:v11.faq.q6.a` | «Стипендије нуди сваки универзитет» | «Већина их нуди…» |
| 12 | `marketing:v11.faq.q2.a` | a TOPIK/TOEFL/IELTS certificate is required for admission (always) | «Већина… тражи…; неки уместо тога прихватају и сопствени испит» |
| 13 | `marketing:v11.faq.q4.q` | «Могу ли да се припремам…» — the question is whether you can apply | «Могу ли да се пријавим ако не знам корејски?» |
| 14 | `marketing:v11.hero.lede` | «Помажемо да ваш сан постане стварност» — none of the source content | find the right university, every step with a team; start with what you want to study |
| 15 | `marketing:v11.services.s3.title` | «Студентска заједница јача зато што сте заједно» — not about students who have been there | «Заједница студената који су већ прошли тај пут» |
| 16 | `marketing:v12.terms.universityInfo.p` | contained Korean text «대학알리미» inside the Serbian sentence | «званични корејски сервис за објављивање података о универзитетима (Academy Info)» |
| 17 | `marketing:v20.city.Gyeonggi.line` / `.body` | roomier rendered as «зеленија»; body lost "so more students live in dormitories" | «пространија»; conclusion restored |
| 18 | `marketing:v14.legal.representative` | «Законски заступник» (legal representative) for 대표이사 | «Генерални директор» |
| 19 | `marketing:v15.pricing.compare.item` | «Ставка» where the source is intentionally empty | empty |
| 20 | `student:discover.verdict.reach`, `success:group.possible` | «Могуће подударање» — loses "meets requirements" and "needs checking" | «Испуњава услове, потребна провера» |
| 21 | `student:register.privacyNote` | data shared «само са тимом Hangyul и универзитетима» — partner agency omitted | «…са тимом Hangyul који вам помаже (укључујући његову партнерску агенцију)…» |
| 22 | `student:phase.prepare.text` | «напишите мотивационо писмо и план студија са тимом» — co-writing (editing ≠ writing); curriculum term | «напишите… уз напомене тима Hangyul»; «план студирања» |
| 23 | `student:v15.services.allowance.unlimited` | «Непрекидно са тимом Hangyul Univ» — unlimited without the service-term scope | «Питајте тим Hangyul било када током трајања услуге» |
| 24 | `student:v15.services.allowance.key.max_managed_applications` | «Вођене пријаве» — passive count label (forbidden form) | «Пријаве које водимо са вама» |
| 25 | `student:v4.ws.team.final` | «…затим слање ваше пријаве на {{university}}» — reads as Hangyul submitting | «…пре него што сами поднесете пријаву универзитету {{university}}» |
| 26 | `student:v25.lane.you` | «Шта ја радим» (first person) | «Шта ви радите» |
| 27 | `student:programV3.costNote` | «Распони, не понуде» — "offers" instead of "quotes" | «Распони, а не коначне цене» |
| 28 | `concierge:status.DORMITORY.ASSIGNED` | «Соба понуђена» — offered, not assigned | «Соба додељена» |
| 29 | `concierge:arrived.confirmText` | «Боравишну картицу треба да поднесете» — submit the card itself | «Захтев за боравишну картицу треба да поднесете у року од 90 дана» |
| 30 | `visaroute:step.slow_items.why` | «Легализације…» — apostille missing, bare legalization | «Апостил или конзуларна легализација, тест на туберкулозу и уверења о некажњавању…» |

Systemic issues fixed beyond the table: «Тим Hangyul Univ» for "the Hangyul team" (17 keys), «план студија» (6 keys),
«понуда» for an admission offer (6 keys), bare «легализација» (3), student-app «план» → «пакет» (8), «превоз са
аеродрома» → «дочек на аеродрому» (5), em-dash connectors replaced by sentences or colons (≈20 keys, incl. privacy rights
and security lists), slash-gendered forms «стигао/ла», «сигуран/на», «Сагласан/на», «прегледао/ла», «Упознат/а» rewritten
neutrally, informal «Региструј се» → «Региструјте се», calque «За урадити» → «Треба урадити».

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

Before the rewrite the hero, why, services and FAQ areas would have scored below 20 (TRUST and SPECIFICITY) because of
the dream/success slogans, superlatives, "every university" and missing source content. All areas are now ≥ 26/30.
This is an internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | documents-needing-attention plurals, «тим Hangyul», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses («одлука о пријему»), final check says the student submits, reach tier, "you" lane |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, needs-fixing labels, paucal plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, "unlimited" scoped to the service term, managed applications, «пакет», items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or consular legalization, sponsor financial documents, TB certificate, pickup via a partner, room assigned, residence-card application |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` forms exist in the job only for a few keys. Serbian `_one` also covers 21, 31…; where the English `_one` has no
  `{{count}}` (`student:v8.compare.budget_one`, `student:v9.discovery.scholarship_one`) the Serbian also has none
  (placeholders must match), so 21 would show the singular sentence without the number. Needs a source change.
- `_one` for keys that have only `_other` in the job (e.g. `marketing:v12.directory.count`, `v12.privacy.retention.*`,
  `dossier:check.matching`) cannot be delivered through this pipeline; for those, 1/21/31 fall back to `_other`
  («1 установа» is correct by luck; «1 месеци» is not). Needs `_one` added to the job.
- Count-in-parentheses forms («Чека вас: {{count}}», «Преостало: {{count}}») were kept deliberately: they read correctly
  for every number.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept «Евиденција о означавању и оглашавању»; the exact
  Serbian legal counterpart of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` = «Струковне студије»: the closest Serbian level, not an exact equivalent of an associate degree.
- `student:v9.funds.longer` keeps the government rating name in quotes («консалтинг»); the official Serbian rendering of
  컨설팅 대학 is not established.
- University names inside `{{university}}` are not declined; sentences were restructured («универзитету {{university}}»,
  «Напомена универзитета {{university}}») so the nominative name always fits.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
