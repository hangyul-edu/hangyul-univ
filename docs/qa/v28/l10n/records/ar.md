# V28 l10n review: ar (العربية)

Job `scripts/i18n/v28/jobs/ar.json` → `scripts/i18n/v28/tx/ar.json`. Register: Modern Standard Arabic, warm and
plain for students (second-person masculine singular as the bundle uses); concise professional Arabic in the consoles.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Omar, 18, Amman (first-time visitor) | Finishing Tawjihi, lands on a university page from search | plain wording, clear next step, no false promises |
| Dr. Layla, 27, Cairo (comparison shopper) | Pharmacist comparing English-taught master's programmes and service tiers | precise admissions/visa terms, apostille vs. consular legalization |
| Abu Omar, 50, Riyadh | Omar's father, sponsor | money wording, trust and safety copy |

## Glossary (reused from V27 ar, extended)

| English | Arabic | Note |
|---|---|---|
| the Hangyul team | فريق Hangyul | never «مستشارك»; brand stays Latin |
| consular legalization | التصديق القنصلي | never «تأكيد قنصلي» |
| legalization (generic) | التصديق | |
| apostille | الأبوستيل | |
| admission guide | دليل القبول | |
| Global Korea Scholarship (GKS) | منحة الحكومة الكورية (GKS) | |
| scholarship | منحة دراسية | |
| tuition | الرسوم الدراسية | |
| plan (paid) | باقة | |
| application | طلب | |
| intake | دورة القبول | |
| deadline | الموعد النهائي | |
| offer | عرض القبول | |
| enrollment | التسجيل | |
| residence card | بطاقة الإقامة | |
| proof of funds | إثبات القدرة المالية | |
| international office | مكتب الطلاب الدوليين | |
| dormitory | السكن الجامعي | |
| case / case owner | الحالة / المسؤول | |
| Writing section / essay | «الكتابة» / مقال | |
| interview | مقابلة | |
| diplomatic post | البعثة | |
| far quick-fit tier | تحتاج إلى مزيد من التحضير | |
| pipeline | مسار الطلبات | |

## RTL / bidi

- Test names (TOPIK, IELTS, TOEFL iBT), GKS, IEQAS, SLA, OCR, HiKorea, NHIS and the brand stay Latin inside RTL sentences.
- 27 strings (incl. plural forms) that start with a placeholder, digit, Latin word or `]` are prefixed with U+200F RLM (V27 convention).
- Arabic comma «،» and question mark «؟», «» quotes; ranges written in words («ما بين 40 و70 دقيقة») instead of an en dash.
- Ratios keep «÷»; chains use «←» so the arrow points in reading direction.

## Plurals

CLDR ar: zero / one / two / few / many / other. Every `_other` key in the job (10) got `_zero`, `_two`, `_few`, `_many`
(40 forms). Agreeing forms where the label is a count chip: برامج / برنامجًا / برنامج, فصول دراسية / فصلًا دراسيًا /
فصل دراسي, دقائق / دقيقة, طلبات / طلبًا / طلب. Labels where agreement adds nothing use a count-agnostic form
(«متأخرة: {{count}}», «أيام منذ آخر تقدّم: {{count}}»), as V27 did. The three `_one`-only job keys cannot take extra forms.

## Pass A: meaning (30 strings changed)

All 22 «مستشارك» strings now name فريق Hangyul; «هانغيول» in the pay subtitle is now the Latin brand.

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.title | ما زال الطريق طويلًا حاليًا | تحتاج إلى مزيد من التحضير |
| common:fit.tier.CHALLENGE.title | تستحق نظرة أقرب | تحتاج إلى تحقق معنا |
| student:v16.pay.chooseSubtitle | اختر الخطة… أن يقوم به هانغيول معك… | اختر الباقة التي تناسب مقدار المساعدة التي تريدها من Hangyul… |
| university:v22.stageHint.decision | على قائمة الانتظار — القرار لا يزال بيدنا | على قائمة الانتظار. لم يصدر القرار بعد |
| marketing:v15.pricing.premium.f5 | طلب السكن الجامعي، وتوجيه إلكتروني قبل السفر… | السكن الجامعي والوصول و30 يومًا من المساعدة على الاستقرار |

## Pass B: native naturalness (46 strings changed)

| Key | Before | After |
|---|---|---|
| marketing:v20.uni.ctaTitle | هل أنت مستعد للتفكير في هذا بجدية؟ | هل تفكر في التقديم إلى هذه الجامعة؟ |
| marketing:v20.uni.whyTitle | ما هذه الجامعة | ما الذي يميّزها |
| agency:v8.ops.ageing.title | تقادم الحالات حسب المرحلة | مدة توقف الحالات حسب المرحلة |
| student:v9.announced.rule.STUDY_DEPOSIT_SCHEME | …الذين لا يتحدثون الكورية… | …الذين ليست لديهم نتيجة في اختبار اللغة الكورية… |
| marketing:v20.city.Gyeonggi.body | تبعد … جميعها 40–70 دقيقة… | من سوون … إلى وسط سيول ما بين 40 و70 دقيقة… |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
|---|---|---|
| agency:docs.sc.checks | حدّد بند تحقق / اختر سببًا | حدّد بند تحقق أو اختر سببًا |
| visaroute:form.source.missing | غير موجود في Hangyul | غير مسجّل |
| visaroute:help.who | من يتصرف | من يتولى ذلك |
| university:kpi.insufficientDetail | بناءً على {{n}} سجل — يُعرَض ابتداءً من {{min}} | بناءً على {{n}} من السجلات. يُعرَض عند بلوغ {{min}}. |
| visaroute:step.slow_items.why | …وشهادات الشرطة… | …وشهادات حسن السيرة… |

«باقة» for plan (never «خطة», reserved for the visa plan); «دورة القبول» for intake; «فريق Hangyul» everywhere.

## Marketing scorecard (30 points)

| Section | Score | Notes |
|---|---|---|
| SEO / home description | 26 | «المناسبة لك» adds the personal note Arabic copy expects |
| Pricing | 26 | lede leads with the choice |
| City pages | 25 | Gyeonggi range in words, Seoul line new |
| University page | 26 | CTA as a direct question; GKS uses منحة الحكومة الكورية |
| Universities index + FAQ | 25 | «جامعات من أنحاء كوريا.» |

## Unsure

- Count forms for 1 and 2 with a digit («{{n}} طلب» for 2) follow common UI practice; strict grammar would drop the digit
  (طلبان), which the placeholder rule does not allow.
- `agency:v15.plan.PREMIUM` «بريميوم» transliterated; the bundle may prefer the Latin "Premium".
- `marketing:v20.uni.why.ieqasExcellent` «IEQAS بدرجة «متميزة»»: no official Arabic grade name.
- `writing:v6.queueKeys` keeps «]» and «?» key names in Latin, which can render mirrored in some fonts.

## Final source↔target comparison

Placeholders, numbers (1,500 وون), test names, GKS/IEQAS/SLA/OCR preserved; no admission probability words.
Validator: `394 strings valid, 0 problems` (354 job keys + 40 extra plural forms).

## Counts

Job keys 354 · kept verbatim 42 · rewritten 82 · newly translated 230 · extra plural forms 40.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/ar.json`, customer families only (marketing 2, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check. `student` is not in the ar job, so no CLDR plural forms were needed.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 233 | 0 | 0 | 230 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: A: 0. B: 0. C: 4 (`upload.status.NEEDS_CORRECTION` shortened, then all `upload.status.*` emptied to match en).

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | المقال الموجّه إلى جامعة أخرى هو أكثر أسباب الرفض شيوعًا، وأسهلها تجنبًا. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: التصديق القنصلي قيد الانتظار |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | لا يُؤكَّد إلا برقم تأكيد أو إيصال، وعندها ينتقل الطلب إلى «مُقدَّم». |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | لا يرى هذه الملفات إلا أنت وفريق Hangyul. ولا ترى الجامعة أي مستند إلا عند إرساله ضمن طلبك إليها. |
| `success:university.evidence` | Submission: {{method}} · Ref. {{ref}} · {{date}} (missing) | التقديم: {{method}} · المرجع {{ref}} · {{date}} |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | لديها مكتب للطلاب الدوليين بقناة تواصل خاصة به. / لم يعثر Hangyul بعد على صفحة مخصصة للطلاب الدوليين في موقع هذه الجامعة. ابدأ من موقعها الرسمي أدناه. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko. The existing ar `upload.haveTitle` wraps `({{status}})`, so an empty status shows “()”. That template should be checked.
- No plural keys in this job (`student` namespace not in the ar job). Count strings such as `success:agencyItem.DEADLINE_TIGHT` (*{{count}} بنود*), `queue.package.partial` and `dossier:agency.suggestions` use one fixed form, which is wrong for 1, 2 and 11+. Proper `_zero/_one/_two/_few/_many/_other` forms would need plural keys in the source.
- `success:agency.ownerShort.counselor` *المستشار* (generic masculine).

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ar` → 233 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
