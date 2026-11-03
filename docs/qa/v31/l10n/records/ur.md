# V31 locale review: Urdu (ur)

Variety: Pakistani Urdu as education consultants and students write it, Nastaliq-friendly (no Arabic-only diacritics, no
Persian-style izafat chains where a plain construction reads better). **آپ** register throughout. The English loanwords
Pakistani students actually use stay as loanwords: ویزا، اپوسٹل، ٹرانسکرپٹ، اسٹڈی پلان، ہاسٹل، موک انٹرویو، فالو اپ،
پلان، ایجنسی، آفر. Brand stays "Hangyul" / "Hangyul Univ" in Latin; "the Hangyul team" = **Hangyul ٹیم**. Earlier
passes had replaced it with آپ کا کونسلر / آپ کی تعلیمی ٹیم / سپورٹ ٹیم; all aligned. Plan names stay in Latin.
Consultation = **مشاورت** (کاؤنسلنگ removed from product copy), consular legalization = **قونصلر تصدیق** (the
earlier قانونی تصدیق, "legal attestation", was too vague), notarization = **نوٹری تصدیق**, editing = **اصلاح**, fixing
= **درستی**. Study plan is now **اسٹڈی پلان** everywhere. The existing copy mixed it with تعلیمی منصوبہ, and Pakistani
applicants use the loanword. Terms: `glossary/ur.json`. Urdu CLDR plurals are `one`/`other` only, so no extra forms.

Strings that start with Latin text or a placeholder carry a leading U+200F (RLM) so the paragraph stays RTL. Nine
strings that lacked it were fixed.

Job: `scripts/i18n/v28/jobs-v31/ur.json` · output `scripts/i18n/v28/tx-v31/ur.json`.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (three passes plus the back-check) |
| Kept verbatim | 1,426 |
| Rewritten, total | 303 |
| · new source (`v31` keys, re-translated from the new en/ko; 3 had no `current`) | 253 (32 of them came out the same as `current`) |
| · meaning | 4 |
| · naturalness | 11 (em-dash connectors, slash-joined gender form, word order) |
| · terminology | 24 (Hangyul ٹیم instead of کونسلر / تعلیمی ٹیم, study plan, follow-up, review vs check) |
| · quality | 11 (RLM on Latin- or number-first strings, UI role, "free account" claim on a plain sign-up button) |

## Critical semantic issues found in `current`

| key | what it said | what it says now |
|---|---|---|
| student `v4.ws.team.final` | آخری جانچ، پھر آپ کی درخواست {{university}} کو **بھیجی جائے گی** (Hangyul sends it) | {{university}} کو **آپ کے خود** درخواست جمع کرانے سے پہلے آخری جانچ |
| common `v29.pricing.compare.row.support` | مشاورت کی مدت (support window as consultation length) | مشاورت کے بعد سوالات پوچھنے کی مدت |
| student `v15.services.scope.consultation` | مشاورت کا **دورانیہ** ("duration", the V15 minutes idea) | مشاورت |
| marketing `v11.services.s2.text` | ویزا کے **اجرا**… (Hangyul issues the visa) | ویزا کی درخواست، رہائشی کارڈ اور کورس رجسٹریشن میں ہم آپ کی مدد کرتے ہیں |
| marketing `v11.services.s1.text` | "عین مطابق"، …پورا عمل **سنبھالتے ہیں** | …دستاویزات کی تیاری اور یونیورسٹی سے رابطے میں آپ کی مدد کرتے ہیں |
| marketing `v11.hero.lede` / `.title` | آپ کا خواب، حقیقت کی طرف ("your dream, towards reality") | اپنے لیے صحیح کوریائی یونیورسٹی تلاش کریں اور ہر قدم مکمل کریں، ایک ٹیم آپ کے ساتھ ہے |
| marketing `v11.why.*` | "ہر مرحلے کی ذمہ داری ہم لیتے ہیں"، "کامیابی کا ساتھی"، "100 فیصد آپ کے مطابق"، "پریمیم سروس"، "بہترین نتیجہ" | V31 claims: same team throughout, plan from grades/goals/budget, fair price with scope shown before payment |
| marketing `v11.unis.title` | …آپ کے **داخلے کی منتظر** ہیں (universities are waiting to admit you) | …آپ کے انتخاب کے لیے |
| marketing `v11.faq.q6.a` | **ہر** یونیورسٹی وظائف دیتی ہے | **زیادہ تر** دیتی ہیں |
| common `v29.pricing.compare.scopeNote` | no round limit, **exclusions missing** | adds: نئی دستاویزات لکھنا، ترجمہ اور نوٹری تصدیق اس میں شامل نہیں |
| common `v29.pricing.compare.value.visa.DOCUMENT_PREP`, `all_in_one.f5` | دستاویزات کی تیاری (Hangyul prepares) | ویزا دستاویزات کی تیاری میں مدد |
| common `v29.pricing.notes.visaDecision` | فیصلہ متعلقہ ادارہ کرتا ہے (vague) | ویزا جاری ہوگا یا نہیں، یہ فیصلہ امیگریشن حکام کرتے ہیں |
| common `v29.pricing.compare.value.documents.*`, `all_in_one.f4` | تفصیلی جائزہ (no notes) / اصلاح کی رہنمائی | جائزہ، اور کیا درست کرنا ہے اس پر نوٹس |
| common `v29.pricing.compare.row.managed`, student `allowance.key.max_managed_applications` | زیرِ انتظام درخواستیں (passive count label, gate term) | وہ درخواستیں جو ہم آپ کے ساتھ سنبھالتے ہیں |
| common `all_in_one.f1`, `premium.f1`; student `allowance.key.max_recommended_institutions` | 5/7 **تجاویز** / تجویز کردہ **ادارے** | تجویز کردہ یونیورسٹیاں |
| common `v29.pricing.compare.value.dormitory.INFORMATION`, `.SCHEDULE` | معلومات (bare) / آخری تاریخوں کا **انتظام** (we manage them) | ہاسٹل کی معلومات / ہم درخواست کی تاریخوں پر نظر رکھتے ہیں |
| common `v29.pricing.premium.position` | application stage dropped | درخواست سے لے کر ویزا، آمد اور کوریا میں پہلے ہفتوں تک |
| common `v29.addon.item.airport_pickup` | ایئرپورٹ پک اپ کا انتظام (no partner) | ایئرپورٹ پک اپ، پارٹنر کے ذریعے انتظام |
| student `v15.services.allowance.unlimited` | ذمہ دار فرد سے **ہر وقت** رابطہ (no scope) | سروس کی مدت کے دوران کسی بھی وقت Hangyul ٹیم سے پوچھیں |
| student `phase.prepare.text` | اپنے **کونسلر کے ساتھ** اپنا بیان… لکھیں (co-writing) | Hangyul ٹیم کے **فیڈبیک** کے ساتھ… لکھیں |
| student `register.privacyNote` | صرف **اسی کونسلر** اور یونیورسٹیوں (partner agency left out) | Hangyul ٹیم (بشمول اس کی پارٹنر ایجنسی) اور آپ کی چنی ہوئی یونیورسٹیاں |
| student `settings.privacy.who.agency` | "صرف آپ کو سونپے جانے کے بعد" (after assignment, not after buying a plan) | صرف پلان لینے کے بعد |
| student `v4.ws.helpText`, `v4.ws.message` | added a `{{name}}` placeholder and "your counselor" that the source does not have | Hangyul ٹیم… / ٹیم کو پیغام بھیجیں |
| student `more.hint.services` | کونسلر اور جائزے کے پلان | پلانز اور جائزے |
| concierge `status.DORMITORY.ASSIGNED` | کمرے کی **پیشکش** ("room offered") | کمرہ الاٹ ہو گیا |
| concierge `moveIn.item.address_report.text` | "if you move" condition dropped | …اگر آپ گھر بدلیں تو منتقلی کے 15 دن کے اندر… |
| concierge `step.pickup.sub` | کوئی آپ سے ملے گا ("someone") | آپ کا پک اپ پارٹنر… |
| dossier `page.summary` | …**ہر درخواست کے لیے** تیار (claim not in source) | {{total}} میں سے {{ready}} تیار |
| dossier `package.line` | {{total}} **شرائط** ("requirements") | {{total}} دستاویزات درکار |
| visaroute `step.slow_items.why` | قانونی تصدیق (no apostille / consular named) | اپوسٹل یا قونصلر تصدیق… |
| visaroute `help.ask` | کسی انسان سے پوچھیں ("ask a human") | Hangyul ٹیم سے پوچھیں |
| student `compare.legalCount_*`, `profileV3.why.basics` | اپوسٹل یا **قانونی** تصدیق | اپوسٹل یا قونصلر تصدیق |
| marketing `v12.privacy.collect.verification.purpose` | **خودکار** سائن اپ | **دھوکا دہی پر مبنی** سائن اپ |
| marketing `v12.privacy.collect.profile.purpose` | اسٹڈی پلان کی تیاری (the essay document) | بیرونِ ملک تعلیم کی منصوبہ بندی |
| marketing `v20.city.Gyeonggi.line` / `.body` | زیادہ **سرسبز** ("greener"); "campuses have their own hostels" | زیادہ کشادہ; **more** students live in university hostels |
| marketing `v12.privacy.retention.contract.record` | رکنیت سے دستبرداری ("membership withdrawal") | آرڈر کی منسوخی |

**Three worst:** (1) `v4.ws.team.final`: the application appeared to be sent by Hangyul, which Korean law reserves to
the applicant. (2) `compare.row.support` / `scope.consultation`: the support window read as consultation time.
(3) `v11.services.s2.text` "ویزا کے اجرا": Hangyul presented as issuing the visa.

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
| Directory and discovery (`v12.directory.*`, `v12.map.*`, `v20.*`, `v21.*`, `v23.dir.*`, `v24.dir.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |

Total 221/240. Before the rewrite: hero, why section and services scored about 17–19/30 (TRUST 1–2: "dream to reality",
"we take responsibility for every stage", "visa issuance", "100%", "universities await your admission"). Pricing
comparison was about 20/30 (support window as consultation time, missing exclusions, "زیرِ انتظام"). All rewritten.

## Product scorecard (student app, after rewrite)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, out of 5.

| area | AC | SA | N | C | B | notes |
|---|---|---|---|---|---|---|
| Home (`home.*`, `v22.home.*`, `v26.now.*`, `dashboard.*`) | 5 | 5 | 5 | 5 | 5 | Fixed: Hangyul ٹیم naming, `documentsSub_one` added, RLM on count-first strings |
| Applications (`applications.*`, `v4.ws.*`, `stage.*`, success) | 5 | 5 | 4 | 5 | 4 | Fixed: "you submit yourself" in the final check, stray `{{name}}` removed |
| Documents (dossier, `docCategory.*`, `compare.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: summary claim, consular legalization named, study plan term unified |
| Services (`v15.services.*`, `v16.pay.*`) | 5 | 5 | 5 | 5 | 4 | Fixed: consultation ≠ duration, managed ≠ recommended, external costs list |
| Visa and housing (visaroute, concierge, `v9.*`) | 5 | 5 | 4 | 5 | 4 | Fixed: room assigned ≠ offered, pickup partner, slow-documents step |

## Unresolved ambiguity (source-level, not guessed)

- `marketing:v12.privacy.retention.advertising.record`: 표시·광고 is a Korean e-commerce statutory record category.
  Rendered literally as لیبلنگ اور اشتہارات سے متعلق ریکارڈ; legal should confirm.
- `student:register.consent.CROSS_BORDER_VERIFICATION.summary`: kept (with an RLM added); owner to confirm it matches
  the legal Korean.
- `visaroute:doc.business_registration.*` (사업자등록증): no Pakistani equivalent; rendered as کاروباری رجسٹریشن سرٹیفکیٹ.
- `marketing:v14.legal.representative` (대표이사): kept نمائندہ ڈائریکٹر; the company's own Urdu title, if any, should
  replace it.
- `common:uni27.service.COUNSELING`: the English does not say whether this is psychological counselling; kept کاؤنسلنگ
  (a university student service, not Hangyul's consultation).

## LTR-order notes (strings whose meaning depends on left-to-right order)

- **Ranges with an en dash**, where the bidi algorithm can swap the visible order of low and high:
  student `scholarships.waiverRange` (`{{min}}–{{max}}%`), success `portfolio.budgetSpread` and
  `portfolio.firstYear` (`{{low}}–{{high}}`). Check that the lower value still reads first, or switch to
  `{{min}} سے {{max}}`, which the rest of the job uses: common `uni27.house.costRange`, `uni27.schol.waiverRange`
  (… سے …), marketing `v20.city.Gyeonggi.body` (40 سے 70 منٹ). The add-on price ranges ($30–50, $20–35, $50–70,
  $50–80) are built by the price formatter, not by these strings. Check them on `/services` and `#pricing`. "$30–$50"
  shown inside an RTL line will render as "$50–$30" unless the formatter wraps it in an LTR isolate.
  `{{range}}` in `v4.budget.withScholarship` and `v4.program.firstYearMeta` comes from the same formatter.
- **Time spans with a direction**: common `v29.pricing.compare.value.settlement` and `v29.pricing.premium.f5`
  (from N days before arrival to N days after); `v9.money.note.*` ("first by the tuition deadline").
- **"x of y" and slash counters**, where Latin order is assumed: `table.pageOf`, `v22.journey.stageOf`,
  `v5.home.stepsDone`, visaroute `docs.progress`, `form.progress`, dossier `page.summary`, `summary.S_READY_ALL`,
  student `v15.services.allowance.used` (`{{used}} / {{limit}}`) and `essays.words` (`{{count}} / {{limit}}`). In RTL
  the slash pair can display reversed ("limit / used").
- **Units with a leading slash**: student `units.perMonth`, `units.perYear` (` / ماہ`, ` / سال`). They carry an RLM, but
  they are appended to a number by the component, so check the joined result.
- **Step order and numbered lists**: marketing `v11.faq.q1.a` (1.–7. inside `<br>`), visaroute `steps.title`
  ("آپ کے مراحل، ترتیب سے"), `page.subtitle` ("کس ترتیب سے"), the `rail.*` and `step.*` sequences, `v5.stepsShow`,
  concierge `page.beforeTitle` → `page.afterTitle`, student `phase.*` rail and `matches.method.stage1/2`.
- **Middle-dot separators** (segment order is meaningful): `v29.pricing.*.f1–f5` (Basic/All-in-One first, then the
  count), dossier `package.line`, student `v26.now.docCounts`, `v26.app.latest`, `home.season`,
  `settings.privacy.updated`, `messages.hint` (Enter · Shift + Enter, key names in Latin), visaroute
  `route.feeAmount`, `v9.announced.meta`, marketing `v21.dir.group.*`, `v12.map.regionLabel`.
- **Plus sign after a number**: marketing `v11.unis.title` (rendered as "{{count}} سے زائد"); student
  `explore.card.ielts`, `explore.card.topik` (`IELTS {{score}}+`). Check that the "+" stays after the score.
- **Arrows**: none appear in this job's strings. Directional chevrons in components need mirroring at component level.

## Validation

`JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ur` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
(not run with `--apply`).

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
