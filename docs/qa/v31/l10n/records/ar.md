# V31 locale review: Arabic (ar)

Variety: Modern Standard Arabic as written by Gulf and Levant education services. Second person singular, masculine
default (as in the existing UI). Arabic punctuation (، ؛ ؟) and «» quotes. Brand stays in Latin script ("Hangyul",
"Hangyul Univ"), treated as feminine (تقدّم Hangyul / لا تستطيع Hangyul) everywhere; masculine agreement left over from
earlier passes was aligned. Plan names stay in Latin (Basic / All-in-One / Premium). Terms: see `glossary/ar.json`.

Job: `scripts/i18n/v28/jobs-v31/ar.json` · output `scripts/i18n/v28/tx-v31/ar.json`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (all three passes plus the back-check) |
| Kept verbatim | 1,401 |
| Rewritten, total | 328 |
| · new source (`v31` keys, re-translated from the new en/ko) | 252 (20 of them came out the same as `current`) |
| · meaning | 4 (plus the meaning fixes inside the new-source keys, listed below) |
| · naturalness | 40 (30 wording plus 10 `_other` plural strings rebuilt so number and noun agree) |
| · terminology | 26 (Hangyul team naming, region spellings, apostille terms, plan = باقة) |
| · quality | 6 (UI role, the empty `v15.pricing.compare.item`, length) |
| Extra CLDR plural forms added (`_zero/_one/_two/_few/_many`) | 194 strings across 40 plural bases |

Plural approach: if a noun follows the number, `_few` (3–10) uses the plural (أيام، مستندات، برامج), `_many` (11–99) uses
the singular in the accusative (يومًا، مستندًا، برنامجًا), and `_zero/_one/_two/_other` use the singular. Every form keeps
`{{count}}`. If the noun would be awkward, the count follows a colon ("مستندات مطلوبة: {{count}}").

## Critical semantic issues found in `current`

| key | what it said | what it says now |
|---|---|---|
| common `v29.pricing.compare.row.support` | فترة الاستشارة ("the consultation period": treated the support window as consultation time) | فترة الاستفسار بعد الاستشارة |
| student `v4.ws.team.final` | تحقق نهائي، ثم يُرسَل طلبك إلى … (implied Hangyul sends the application) | تحقق نهائي قبل أن تقدّم طلبك بنفسك إلى {{university}} |
| common `v29.addon.item.extra_application` | طلب تقديم إضافي نديره **عنك** ("we manage on your behalf") | طلب تقديم إضافي نديره **معك** |
| marketing `v11.services.s2.text` | استخراج التأشيرة… ("we obtain the visa", plus a bare claim of total support) | نساعدك في طلب التأشيرة وبطاقة الإقامة والتسجيل في المقررات… |
| student `register.privacyNote` | shared only with "the counselor" and universities (partner agency left out) | فريق Hangyul الذي يتابعك (بما في ذلك الوكالة الشريكة له) والجامعات التي تختارها |
| common `v29.pricing.compare.scopeNote` | no limit within the contract, **but the exclusions were missing** | adds: لا يشمل ذلك كتابة مستندات جديدة ولا الترجمة ولا التوثيق لدى كاتب العدل |
| common `v29.pricing.notes.visaDecision` | قرار المنح يعود إلى الجهة المختصة (vague: "granting", "the competent body") | قرار إصدار التأشيرة تتخذه سلطات الهجرة |
| common `v29.pricing.compare.value.visa.DOCUMENT_PREP`, `all_in_one.f5` | تجهيز المستندات / تجهيز مستندات التأشيرة (Hangyul prepares the documents) | المساعدة في تجهيز مستندات التأشيرة |
| common `v29.pricing.compare.value.documents.INTENSIVE` / `.REVIEW_GUIDANCE` / `all_in_one.f4` | مراجعة مكثفة (no notes) / إرشادات للاستكمال ("guidance to complete") | مراجعة معمّقة / مراجعة **مع ملاحظات بما يلزم تصحيحه** |
| common `v29.pricing.compare.value.dormitory.INFORMATION` | معلومات (bare "information") | معلومات عن السكن الجامعي |
| marketing `v11.hero.lede` | نحوّل حلمك إلى حقيقة ("we turn your dream into reality") | اعثر على الجامعة الكورية المناسبة لك وأنجز كل خطوة، وفريقنا إلى جانبك.<br>ابدأ بما تريد دراسته. |
| marketing `v11.services.s1.text` | نتولّى العملية كاملة… ("we take over the whole process", best-fit claim) | …ثم نساعدك في تجهيز مستنداتك والتواصل مع الجامعة |
| marketing `v11.why.s1/s2/s3.*`, `v11.why.title`, `v11.services.*.title` | overclaims: "a partner until you succeed", "100% tailored, for you alone", "brings out your full potential", "a different level of support worth every cent" | the V31 claims: same team throughout, plan built on grades and budget, fair price with the scope shown before payment |
| marketing `v11.faq.q6.a` | تقدّم **كل** جامعة منحًا ("every university offers scholarships") | **معظمها** يقدّم منحًا… |
| marketing `v15.pricing.title` | brand in Arabic script (هانغيول) and a different title | تكلفة خدمات Hangyul |
| student `v15.services.scope.consultation` | مدة الاستشارة (consultation **duration**, the V15 "minutes" idea) | الاستشارة |
| student `v15.services.allowance.key.essay_review_rounds` | تدقيق **خطاب التعريف** (wrong essay type) | تنقيح البيان الشخصي وخطة الدراسة |
| student `phase.prepare.text` | write your statement and study plan **with** the Hangyul team (reads as co-writing) | …مع **ملاحظات** فريق Hangyul |
| student `messages.visibility` | adds فقط ("only"), which the source does not claim | مرئية لك ولفريق Hangyul |
| student `dashboard.counselor.unread_one`, `v4.ws.history_one` | `{{count}}` dropped (hard-coded "one") | `{{count}}` kept |
| concierge `status.DORMITORY.ASSIGNED` | عُرضت غرفة ("a room was offered") | تم تخصيص غرفة |
| concierge `moveIn.checkIn` | كيفية تسجيل الدخول ("how to log in") | طريقة تسجيل الوصول |
| visaroute `help.ask` | اسأل شخصًا ("ask someone") | اسأل فريق Hangyul |
| visaroute `step.slow_items.why` | التصديقات ("certifications", no apostille or consular named) | التصديق بالأبوستيل أو التصديق القنصلي… |
| marketing `v12.privacy.collect.verification.purpose` | منع التسجيلات **الآلية** ("automated") | منع التسجيلات **الاحتيالية** ("fraudulent") |
| marketing `v20.city.Gyeonggi.line` / `.body` | أكثر خضرة ("greener"); says campuses *have* dormitories instead of "more students live in them" | أكثر رحابة; more students live in university dormitories |
| marketing `v12.terms.universityInfo.p` | contained Hangul (대학알리미) | Academy Info |
| marketing `v15.pricing.compare.item` | البند (the English is intentionally empty) | empty |
| student `settings.privacy.who.agency` | "after you have a **خطة**" (study plan, not the service plan) | بعد اشتراكك في باقة |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each out of 5. This is an internal review tool, not a
measurement.

| area | C | N | S | T | P | B | total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards and comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29.pricing.notes.*`, `v31.pricing.notes.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`, `v13/v14.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory and discovery (`v12.directory.*`, `v12.map.*`, `v20.*`, `v21.*`, `v23.dir.*`, `v24.dir.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite: hero, why section and services rows scored about 18–20/30, with TRUST at 1–2 because of
"dream into reality", "we take over everything" and "visa issuance". Pricing comparison was about 21/30: support window
as "consultation period", missing exclusions, "we prepare". All of these were rewritten.

## Product scorecard (student app, after rewrite)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, out of 5.

| area | AC | SA | N | C | B | notes |
|---|---|---|---|---|---|---|
| Home (`home.*`, `v22.home.*`, `v26.now.*`, `dashboard.*`) | 5 | 5 | 4 | 5 | 5 | Fixed: team naming (فريقك في Hangyul), plural agreement, `{{count}}` restored |
| Applications (`applications.*`, `v4.ws.*`, `stage.*`, `success`) | 5 | 5 | 4 | 5 | 4 | Fixed: "you submit yourself" in the final check, fix/upload task wording per application |
| Documents (`dossier`, `docCategory.*`, `compare.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: "needs fixing" wording made consistent, plural agreement rebuilt, apostille terms |
| Services (`v15.services.*`, `v16.pay.*`) | 5 | 5 | 5 | 5 | 4 | Fixed: consultation ≠ duration, managed ≠ recommended, the editing term, external costs list |
| Visa and housing (`visaroute`, `concierge`, `v9.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: check-in ≠ login, room assigned ≠ offered, pickup by a partner, slow-documents step |

## Unresolved ambiguity (source-level, not guessed)

- `marketing:v12.privacy.retention.advertising.record`: 표시·광고 is a Korean e-commerce statutory record category
  ("labeling and advertising"). Rendered literally as سجلات العرض والإعلان. Legal should confirm the official Arabic.
- `student:register.consent.CROSS_BORDER_VERIFICATION.summary`: the existing Arabic lists "items, time, retention"
  where the English says only "details, including how to refuse". It was kept because it matches the legal Korean.
  Owner to confirm.
- `visaroute:doc.business_registration.*` (사업자등록증): there is no Arabic equivalent for a Korean business registration
  certificate. Used شهادة تسجيل الأعمال الخاصة بالجامعة, not "commercial register".

## RTL layout notes (strings whose meaning depends on order)

- **Ranges with an en dash** (check the bidi rendering of the dash between numbers): common `uni27.house.costRange`
  (rendered as من {{min}} إلى {{max}}), `uni27.schol.waiverRange` (من…إلى); student `scholarships.waiverRange`
  ({{min}}% إلى {{max}}%); success `portfolio.budgetSpread`, `portfolio.firstYear` (kept `{{low}}–{{high}}`: check the
  low and high values do not swap visually); student `v4.budget.withScholarship`, `v4.program.firstYearMeta`
  (`{{range}}` comes from the formatter). Add-on price ranges ($30–50 and so on) are built by the price formatter, not
  by these strings: check them on `/services` and `#pricing`.
- **Time spans**: common `v29.pricing.compare.value.settlement`, `v29.pricing.premium.f5` (before arrival → after
  arrival); marketing `v20.city.Gyeonggi.body` ("من 40 إلى 70 دقيقة").
- **"x of y" counters**: `table.pageOf`, `v22.journey.stageOf`, `v5.home.stepsDone`, visaroute `docs.progress`,
  `form.progress`, dossier `page.summary`, `summary.S_READY_ALL`, student `v15.services.allowance.used`,
  `essays.words` (`{{count}} / {{limit}}`, where the slash order flips visually in RTL).
- **Step order and numbered lists**: marketing `v11.faq.q1.a` (1.–7. list inside `<br>`), visaroute `steps.title`,
  `page.subtitle` ("in what order"), the `rail.*` and `step.*` sequences, `v5.stepsShow`; concierge step list
  (`page.beforeTitle` → `page.afterTitle`); student `phase.*` rail.
- **Middle-dot separators** (order of segments): `v29.pricing.*.f1–f5`, dossier `package.line`, student
  `v26.now.docCounts`, `v26.app.latest`, `home.season`, `settings.privacy.updated`, `messages.hint`
  (Enter · Shift + Enter), visaroute `route.feeAmount`, marketing `v21.dir.group.*` (بوسان · غيونغنام), `v12.map.regionLabel`.
- **Plus signs after numbers**: marketing `v11.unis.title` (rendered as أكثر من {{count}}); student `explore.card.ielts`,
  `explore.card.topik` (`IELTS {{score}}+`: check the "+" stays after the score).
- **Strings that start with Latin text or a number** carry a leading U+200F (RLM) so the paragraph direction stays RTL,
  for example `seo.home.title`, `v12.seo.university.title` (`Hangyul Univ | …`, `{{name}} | …`), `residence.bookText`,
  `units.perMonth` / `units.perYear` (leading slash) and the count-first plural strings.
- No arrow glyphs (→ ← ›) appear in this job's strings. Directional chevrons in components need mirroring at the
  component level.

## Validation

`JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ar` → `V28 l10n (1 locales): 1889 strings valid, 0 problems`
(not run with `--apply`).

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
