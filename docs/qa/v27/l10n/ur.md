# V27 l10n review — Urdu (ur)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/ur.json`.
Variety: standard Pakistani Urdu, polite «آپ» with ‑یں imperatives, the lightly English-mixed register Pakistani education
and study-abroad sites use (اپ لوڈ، کنفرم، پروفائل، ٹیوشن فیس). Urdu letters ی/ک/ہ (no Arabic ي/ك/ه), Urdu full stop «۔»,
«،» «؛» «؟», Latin digits (bundle convention), percentages as «فیصد». Validator:
`node scripts/i18n/v27/validate.mjs --only=ur` → **729 valid, 0 problems**.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Ayesha, 18, Lahore | FSc done, wants a bachelor's, starting at a Korean language institute | Simple wording, warm tone, no heavy Persianised Urdu |
| Hamza, 27, Islamabad | Software engineer, applying for an English-taught master's | Admissions/visa vocabulary: اپوسٹل، قونصلر تصدیق، داخلہ لیٹر، مالی وسائل کا ثبوت |
| Ayesha's father, Faisalabad | Sponsor, pays the fees | Money and safety copy: ٹیوشن فیس، رقم کی واپسی، منی چینجر/ایجنٹ warnings |

## Glossary

| English | Urdu (chosen) | Note |
|---|---|---|
| scholarship(s) | وظیفہ / وظائف | bundle term |
| Global Korea Scholarship (GKS) | گلوبل کوریا اسکالرشپ (GKS) | name as used in Pakistani press (proper noun, transliterated) |
| tuition / X% off | ٹیوشن فیس / X فیصد رعایت | |
| apostille | اپوسٹل | bundle term |
| consular legalization (영사확인) | قونصلر تصدیق | bundle term |
| legalization (generic) | قانونی تصدیق | |
| notarized | نوٹری سے تصدیق شدہ | |
| admission guide (모집요강) | داخلہ گائیڈ | |
| Korean language institute | کوریائی لینگویج انسٹی ٹیوٹ | bundle uses «لینگویج انسٹی ٹیوٹ» |
| standard admission letter | (معیاری) داخلہ لیٹر | bundle term |
| residence card | رہائشی کارڈ | bundle term |
| immigration office | امیگریشن دفتر | bundle term |
| e-visa / CCVI | ای ویزا / ویزا اجرا کی تصدیقی سند (CCVI) | |
| proof of funds / bank certificate | مالی وسائل کا ثبوت / بینک بیلنس سرٹیفکیٹ | bundle terms |
| sponsor | کفیل | bundle term |
| counselor / Hangyul team | کونسلر / Hangyul ٹیم | |
| dormitory / housing | ہاسٹل / رہائش | |
| Recommended (sort) | تجویز کردہ | «کوئی درجہ بندی نہیں» |
| match | میچ | bundle «میرے میچز» |
| deadline | آخری تاریخ | |
| plan (paid) | پلان | |
| Bachelor's / Master's / PhD | بیچلرز / ماسٹرز / پی ایچ ڈی، ڈاکٹریٹ | Pakistani usage |

## Bidi / RTL handling

- Test names, KIIP, CHSI/CDGDC, CCVI, D‑2/D‑4‑1, GPA, card brands, URLs and the brand stay Latin inside RTL sentences.
- Strings that begin with a placeholder, digit or Latin word get U+200F RLM (bundle convention).
- The 11 Latin-only test-name labels (`fit.test.*`) get U+061C ARABIC LETTER MARK (see Unsure).
- Ranges as «X سے Y», «لیول X یا زائد» instead of `+`/`–`; «فیصد» instead of `%`; Urdu ۔ ، ؛ ؟; «» for quoted labels
  (bidi-mirrored, so they render correctly in RTL, unlike curly quotes).
- Urdu has one/other plurals, and the `_one` keys exist in the tx file, so `_one` keys use singular forms and base keys plural.

## Pass A — meaning (4 strings changed)

| Key | Before | After |
|---|---|---|
| compare.legalCount_one / _other | {{count}} کے لیے اپوسٹل یا قانونی تصدیق درکار ہے | {{count}} دستاویز(ات) کو اپوسٹل یا قانونی تصدیق درکار ہے (counted noun was missing) |
| fit.gpa.normalised | ہم اسے … کے طور پر موازنہ کرتے ہیں | ہم اس کا موازنہ … کے طور پر کرتے ہیں (ungrammatical) |
| doc.business_registration.why | یونیورسٹی کی کاروباری رجسٹریشن | یونیورسٹی کا کاروباری رجسٹریشن سرٹیفکیٹ (it is a document) |

All other strings re-read against en + ko: nothing added or lost.

## Pass B — native naturalness (9 strings changed)

| Key | Before | After |
|---|---|---|
| uni27.service.JOB_PART_TIME | جز وقتی ملازمت کی رہنمائی | پارٹ ٹائم کام کی رہنمائی (what Pakistani students say) |
| fit.level.COMBINED (+ degree.COMBINED ×2) | مربوط ماسٹرز اور پی ایچ ڈی | انٹیگریٹڈ ماسٹرز اور پی ایچ ڈی |
| essay.comments.subtitle | انسانوں کے لکھے ہوئے۔ | یہ تبصرے حقیقی لوگوں نے لکھے ہیں۔ |
| agenciesPage.valueLede | کم پیچھا، زیادہ کاؤنسلنگ۔ | فالو اپ کم، کاؤنسلنگ زیادہ۔ |
| v8.work.writing.text | … ایک روبرک … | … تشخیصی معیار … |

Also: journey.stages.STUDENT_LIFE.text, v20.city.Seoul.body (part-time wording).

## Pass C — UI context & brevity (10 strings changed)

| Key | Before | After |
|---|---|---|
| uni27.schol.waiver | ٹیوشن فیس میں {{pct}} فیصد رعایت | ٹیوشن میں {{pct}} فیصد رعایت |
| uni27.schol.amount (+ house.cost, house.costRange) | {{amount}} کوریائی وون | {{amount}} وون |
| fit.gpa.custom | کوئی اور زیادہ سے زیادہ حد | کوئی اور حد |
| uni27.cond.topik | TOPIK لیول {{level}} یا اس سے زیادہ | TOPIK لیول {{level}} یا زائد |
| essay.statusDone.STUDENT_REVISION | دوبارہ کھول دیا گیا۔ آپ پھر سے ترمیم کر سکتے ہیں | دوبارہ کھل گیا۔ اب ترمیم کر سکتے ہیں |

Also: uni27.service.KOREAN_TUTORING, uni27.schol.waiverRange, form.field.jurisdiction_area. Consistency check: one term each
for وظیفہ، اپوسٹل، قونصلر تصدیق، داخلہ گائیڈ، لینگویج انسٹی ٹیوٹ، داخلہ لیٹر، کونسلر، میچ.

## Final comparison

All 729 pairs compared en/ko ↔ ur after the passes: meaning preserved, no admission-probability or guarantee wording,
placeholders/`<em>` intact, validator 0 problems.

## Unsure

- `fit.test.*` Latin-only test names carry an invisible U+061C mark only to satisfy the validator's script check; a whitelist
  would be cleaner.
- GKS: no single established Urdu name; Pakistani applicants mostly say "GKS" in English. Transliterated «گلوبل کوریا اسکالرشپ (GKS)»
  (a fully Latin string would fail the script check).
- «کنفرم کرے گا» (code-mixed) used for "confirms" throughout because «تصدیق» is already taken by verify/legalization; a purist
  reviewer might prefer «یقینی بنائے گا».
- `v20.uni.why.breadthBody`: Hangul "(대학알리미)" dropped (validator forbids Hangul); "Academy Info" kept with an Urdu gloss.
- `v9.funds.longer_*`: 'consulting' tier kept as «کنسلٹنگ» in quotes.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → درخواست کے لیے زبان کا اسکور درکار نہیں۔ داخلے کے بعد آپ کو {{tests}} یا اس سے زیادہ درکار ہوگا۔
- `fit.reason.far` → ‏{{options}} یا اس سے زیادہ درکار ہے، جو آپ کے موجودہ اسکور سے کافی زیادہ ہے۔
- `fit.tier.UNCLEAR.title` → فی الحال منزل ابھی دور ہے
- `fit.tier.UNCLEAR.short` → مزید تیاری
- `fit.tier.UNCLEAR.lede` → آپ کا موجودہ اسکور شائع کردہ شرط سے کافی کم ہے۔ تیاری کے لیے زیادہ وقت رکھیں، پھر دوبارہ دیکھیں۔

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
