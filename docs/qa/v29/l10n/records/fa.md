# V29 l10n record — fa (Persian)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/fa.json` → `scripts/i18n/v28/tx-v29/fa.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=fa` → 0 problems (158 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Sara, 19, first-time visitor from Tehran
- Ali, 27, master's applicant comparing plans
- A parent paying via a foreign card

## Register and conventions

Formal شما. Plan = پلن (existing). Team = "تیم Hangyul Univ" — the existing fa 'مشاورتان' (your counselor) pattern was NOT followed because the brief forbids 'counselor'. Latin digits for literal numbers (existing fa convention), ZWNJ used in compounds.

## Key term decisions

- No round limit within contracted documents: "ویرایش مدارک درخواستِ قراردادی، بدون محدودیت نوبت"; never نامحدود.
- Up to N managed applications: "مدیریت حداکثر N درخواست" / "درخواست‌های مدیریت‌شده" vs "دانشگاه‌های پیشنهادی".
- Custom quote: "قیمت با استعلام".
- Airport pickup arrangement: "هماهنگی استقبال از فرودگاه" (existing 'استقبال از فرودگاه'); note "از طریق یک شرکت حمل‌ونقل همکار هماهنگ می‌شود".
- Statement = انگیزه‌نامه, study plan = برنامه تحصیلی, notarization = تأیید دفتر اسناد رسمی (existing).

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | تیم Hangyul Univ یک خدمت اضافی به شما پیشنهاد داده است |
| Additional service / add-on | خدمات اضافی |
| Add-on (compare cell) | خدمت اضافی |
| Custom quote (별도 견적) | قیمت با استعلام |
| Airport pickup arrangement (공항 픽업 연결) | هماهنگی استقبال از فرودگاه |
| Partner-provider pickup note | استقبال از فرودگاه از طریق یک شرکت حمل‌ونقل همکار هماهنگ می‌شود. |
| Mock interview | مصاحبه آزمایشی |
| Diagnostic consultation | مشاوره ارزیابی شخصی + 1 جلسه پیگیری |
| Recommended universities (추천) | دانشگاه‌های پیشنهادی |
| Managed applications (지원 관리) | درخواست‌های مدیریت‌شده |
| Up to N managed applications | مدیریت حداکثر 2 درخواست دانشگاهی |
| Up to N rounds | حداکثر {{count}} نوبت |
| Statement & study-plan editing | ویرایش انگیزه‌نامه و برنامه تحصیلی |
| No round limit within contracted documents (card) | ویرایش مدارک درخواستِ قراردادی، بدون محدودیت نوبت |
| No round limit within contract (cell) | بدون محدودیت نوبت در چارچوب قرارداد |
| Premium scope note | ویرایش در Premium در چارچوب مدارک درخواست و زمان‌بندی قرارداد، محدودیت نوبت ندارد. |
| No round limit (student app) | بدون محدودیت نوبت برای مدارک قراردادی شما |
| No limit (mobile chip) | بدون محدودیت برای مدارک قراردادی |
| Dormitory | خوابگاه |
| Settling in | ویزا و جاافتادن |
| Visa decision disclaimer | پشتیبانی ویزا یعنی کمک در آماده‌سازی و درخواست؛ تصمیم صدور با مرجع ذی‌صلاح است. |
| Consultation support period | دوره مشاوره |
| Contract term | مدت قرارداد |
| Service period | دوره خدمات |
| Priority response | پاسخ در اولویت |
| Dedicated team | تیم اختصاصی · اولویت |
| Upgrade | درباره ارتقا از تیم بپرسید |
| Notarization | نوشتن مدرک جدید، ترجمه و تأیید دفتر اسناد رسمی ممکن است هزینه جداگانه داشته باشد. |
| One-time payment in USD | همه قیمت‌ها پرداخت یک‌باره به دلار آمریکا (USD) است. |
| Agree and pay CTA | موافقم و {{amount}} را پرداخت می‌کنم |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'تصمیم صدور با مرجع ذی‌صلاح است'; quote 'قیمت‌گذاری جداگانه' → 'قیمت با استعلام'; upgrade.used).
- Pass B (native marketer naturalness): 3 changed ('هزینه منصفانه،<br>دامنه روشن'; 'نه، متشکرم').
- Pass C (UI brevity, one term per concept): 2 changed (mobile chips).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 25/30

## Unsure

- Existing fa student strings still say 'مشاورتان' (counselor) elsewhere; V29 strings use 'تیم'.
- 'جاافتادن' for settling in is colloquial; matches existing v15.pricing.lede.

## Counts

Job keys: 158 · extra plural forms: 0 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
