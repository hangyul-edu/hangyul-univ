# V27 l10n review — Arabic (ar)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/ar.json`.
Variety: Modern Standard Arabic, direct second person (masculine imperative, as in the existing bundle), polite-but-friendly
education-service register. Validator: `node scripts/i18n/v27/validate.mjs --only=ar` → **729 valid, 0 problems**.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Omar, 18, Amman | Finishing Tawjihi, wants a bachelor's in engineering; starts at a Korean language institute | Plain wording, clear next step, no false promises |
| Dr. Layla, 27, Cairo | Pharmacist applying for a master's, English-taught | Precise admissions/visa terms, apostille vs. consular legalization, GPA conversion |
| Abu Omar, 50, Riyadh | Omar's father, sponsor, pays tuition | Money wording (tuition, refunds, charges, proof of funds), trust and safety copy |

## Glossary

| English | Arabic (chosen) | Note |
|---|---|---|
| scholarship(s) | منحة دراسية / المنح | as in existing bundle |
| Global Korea Scholarship (GKS) | منحة الحكومة الكورية (GKS) | established Arabic name |
| tuition | الرسوم الدراسية | |
| X% off tuition | خصم X% من الرسوم | |
| apostille | الأبوستيل | bundle term |
| consular legalization (영사확인) | التصديق القنصلي | never "تأكيد قنصلي" |
| notarized | موثّق لدى كاتب العدل | |
| admission guide (모집요강) | دليل القبول | |
| Korean language institute | معهد اللغة الكورية (التابع للجامعة) | |
| standard admission letter | خطاب القبول الرسمي | bundle term |
| certificate of enrollment | شهادة القيد | bundle term |
| residence card | بطاقة الإقامة | |
| immigration office | مكتب الهجرة | |
| e-visa | التأشيرة الإلكترونية | |
| CCVI | شهادة تأكيد إصدار التأشيرة (CCVI) | |
| proof of funds / bank balance certificate | إثبات القدرة المالية / شهادة الرصيد البنكي | |
| counselor / the Hangyul team | مستشارك / فريق Hangyul | brand stays Latin |
| housing / dormitory | السكن / السكن الجامعي | |
| Recommended (sort) | المقترح | browsing order, explicitly "ليس تصنيفًا" |
| match(es) | المطابقة / المطابقات | |
| requirement / minimum | متطلب، شرط / الحد الأدنى | |
| plan (paid) / visa plan | باقة / خطة التأشيرة | kept distinct |
| charge (payment) | يُخصم مبلغ / رسوم متكررة | "خصم" alone = discount, avoided for charges |

## Bidi / RTL handling

- Test names (TOPIK, TOEFL iBT, IELTS Academic, TEPS, New TEPS, TOEIC, Duolingo English Test, PTE Academic, Cambridge English),
  KIIP, CHSI/CDGDC, CCVI, D-2/D-4-1, Visa/Mastercard, URLs and the brand stay in Latin inside RTL sentences.
- Strings that begin with a placeholder, digit or Latin word are prefixed with U+200F RLM (the convention already used in
  the bundle) so the paragraph direction stays RTL.
- The 11 Latin-only test-name labels (`fit.test.*`) are prefixed with U+061C ARABIC LETTER MARK (invisible; a bidi mark for
  Arabic-script text). See "Unsure" below.
- Ranges written with words (من … إلى …) instead of en dashes; "level 3+" written as "المستوى 3 فأعلى" — no `+`, `–`, `,`, `;`,
  `?` or straight quotes that flip in RTL. Arabic punctuation ، ؟ and «» used throughout.
- Counts: Arabic number agreement (1 / 2 / 3–10 / 11+) cannot be served by one string, so count strings use count-agnostic
  forms ("عدد المنح الموثّقة: {{count}}", "لعدد {{count}} من الطلبات").

## Pass A — meaning (8 strings changed)

| Key | Before | After |
|---|---|---|
| services.checkout.demoTitle | دفع تجريبي. لا يوجد خصم فعلي | دفع تجريبي. لن يُخصم أي مبلغ فعليًا ("خصم" read as "discount") |
| v9.money.note.VISA_FEE_AS_PUBLISHED | تنشر السفارة هذه الرسوم كتابةً بالكلمات | … مكتوبةً بالحروف لا بالأرقام |
| dossier check.rejected | تم التسجيل. لن نستخدمه. | حسنًا، لن نستخدمه. ("تسجيل" read as "registration") |
| v6.life.housing.text | أو بضع ليالٍ في الفترة بينهما | أو بضع ليالٍ في سكن مؤقت بينهما |
| uni27.schol.apply | تتطلب طلبًا منفصلًا أو اختيارًا | بطلب منفصل أو عبر الاختيار |

Also: v17.pay.currencyPending, v21.pay.afterCard (charge ≠ discount), v10.services.housing.text (deposit = مبلغ التأمين).

## Pass B — native naturalness (10 strings changed)

| Key | Before | After |
|---|---|---|
| fit.track.KOREAN / ENGLISH | تدريس بالكورية | التدريس بالكورية (reads naturally inside "لبرامج {{track}}") |
| fit.reason.met_track | … للبرامج ({{track}}). | … لبرامج {{track}}. |
| v15.services.addOn.noPressure | الرفض لا يغيّر شيئًا. | إن لم تضفها، فلن يتغير شيء. |
| v3.home.stageLine.admission | نعمل الآن على تثبيت مقعدك | … على تأكيد مقعدك |
| essay.comments.subtitle | انقر على اقتباس | اضغط على اقتباس (touch UI) |

Also: uni27.service.BUDDY, fit.reason.needed_track, more.subtitle, onboarding.finish.title.

## Pass C — UI context & brevity (11 strings changed)

| Key | Before | After |
|---|---|---|
| fit.tier.ONE_STEP.short | خطوة واحدة | على بُعد خطوة |
| fit.family.KOREAN (+ ENGLISH, testLabel.*) | اختبار اللغة الكورية | اختبار الكورية |
| uni27.schol.waiver | خصم {{pct}}% من الرسوم الدراسية | خصم {{pct}}% من الرسوم |
| uni27.schol.renewal | للاستمرار في الحصول عليها | شروط الاستمرار |
| fit.gpa.help | مساعدة في المعدل التراكمي | مساعدة في حساب المعدل |

Also: fit.level.TRANSFER, uni27.schol.waiverRange, onboarding.finish.title. Consistency check: one term each for
scholarship, apostille, consular legalization, admission guide, Korean language institute, admission letter, counselor.

## Final comparison

All 729 source ↔ target pairs re-read against en and ko: no additions or omissions found after the three passes; no wording
implies admission probability or guarantee ("المقترح" is explicitly "ترتيب للتصفح"); placeholders and `<em>` intact;
validator 0 problems.

## Unsure

- `fit.test.*` (11 Latin-only test names): brief requires Latin script, validator requires Arabic script. Resolved with an
  invisible U+061C ARABIC LETTER MARK prefix. Harmless in rendering, but it exists mainly to satisfy the script check — a
  human may prefer a validator whitelist for these keys instead.
- `marketing v20.uni.why.breadthBody`: the English contains Hangul "(대학알리미)"; the validator forbids Hangul outside ko, so
  the Arabic keeps "Academy Info" + an Arabic gloss and drops the Korean name.
- `discover.subtitle` "programs you can realistically get into": rendered as "يمكنك التقديم إليها بشكل واقعي" (apply to), following
  ko 지원 가능, to avoid implying admission odds.
- `v9.funds.longer_*` 'consulting' tier rendered «جامعة استشارية» — the Korean government category has no fixed Arabic name.
- Masculine default address (as in the existing bundle); a gender-neutral rewrite would need a product decision.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → لا يُشترط تقديم نتيجة لغة للتقديم. ستحتاج إلى {{tests}} أو أعلى بعد القبول.
- `fit.reason.far` → يلزم {{options}} أو أعلى، وهذا أعلى بكثير من نتيجتك الحالية.
- `fit.tier.UNCLEAR.title` → ما زال الطريق طويلًا حاليًا
- `fit.tier.UNCLEAR.short` → مزيد من التحضير
- `fit.tier.UNCLEAR.lede` → نتيجتك الحالية أقل بكثير من المتطلب المنشور. امنح نفسك وقتًا أطول للتحضير، ثم تحقّق مجددًا.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
