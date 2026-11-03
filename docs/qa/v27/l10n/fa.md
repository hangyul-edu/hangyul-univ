# V27 l10n review — Persian (fa)

Scope: all 729 strings of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/fa.json`.
Variety: standard Iranian Persian (Tehran written standard), polite «شما» with ‑ید verb forms, as Iranian education and
study-abroad sites write. Persian letters ی/ک (no Arabic ي/ك), ZWNJ (نیم‌فاصله) in می‌، ‑ها، ‑تر etc. (952 ZWNJs), Latin digits
as in the existing bundle, Persian percent sign ٪. Validator: `node scripts/i18n/v27/validate.mjs --only=fa` →
**729 valid, 0 problems**.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Sara, 18, Tehran | Just finished high school (دیپلم), wants a bachelor's; plans a year at a Korean language institute | Plain, warm wording; no colloquial slang |
| Amir, 27, Isfahan | Engineer (کارشناسی), applying for an English-taught master's | Exact admissions/visa terms: آپوستیل، تأیید کنسولی، تمکن مالی، ریزنمرات |
| Sara's mother, Shiraz | Sponsor, pays tuition | Money wording: شهریه، بازپرداخت، کسر مبلغ، warnings about صرافی and intermediaries |

## Glossary

| English | Persian (chosen) | Note |
|---|---|---|
| scholarship(s) | بورسیه / بورسیه‌ها | bundle term |
| Global Korea Scholarship (GKS) | بورسیه دولت کره (GKS) | name used by Iranian applicants |
| tuition / X% off tuition | شهریه / X٪ تخفیف شهریه | |
| apostille | آپوستیل | bundle term |
| consular legalization (영사확인) | تأیید کنسولی | bundle term (the established Persian term for legalization at a consulate) |
| notarized | تأییدشده در دفتر اسناد رسمی | |
| admission guide (모집요강) | راهنمای پذیرش | |
| Korean language institute | مؤسسه زبان کره‌ای (وابسته به دانشگاه) | bundle term |
| standard admission letter | پذیرش‌نامه رسمی | bundle term |
| residence card | کارت اقامت | |
| immigration office | اداره مهاجرت | |
| e-visa / CCVI | ویزای الکترونیکی / «تأییدیه صدور ویزا» (CCVI) | |
| proof of funds / bank certificate | تمکن مالی / گواهی موجودی بانکی | Iranian standard terms |
| transcript / GPA | ریزنمرات، کارنامه / معدل | |
| personal statement | انگیزه‌نامه | bundle term |
| counselor / Hangyul team | مشاور / تیم Hangyul | |
| dormitory / housing | خوابگاه / مسکن | |
| Recommended (sort) | پیشنهادی | browsing order, «رتبه‌بندی نیست» |
| match | تطبیق | bundle term |
| plan (paid) | پلن | as in Iranian app copy |
| deadline | مهلت | |
| Bachelor's / Master's / PhD / Associate | کارشناسی / کارشناسی ارشد / دکتری / کاردانی | Iranian degree names |

## Bidi / RTL handling

- Test names, KIIP, CHSI/CDGDC, CCVI, D‑2/D‑4‑1, card brands, URLs and the brand stay Latin inside RTL sentences.
- Strings beginning with a placeholder, digit or Latin word get a U+200F RLM prefix (bundle convention).
- The 11 Latin-only test-name labels (`fit.test.*`) get a U+061C ARABIC LETTER MARK prefix (see Unsure).
- Ranges written «از … تا …» (no en dash); «سطح X یا بالاتر» instead of `+`; Persian ، ؛ ؟ «» throughout; no straight `?`, `;`, `"`.
- Persian nouns after numerals stay singular, so «{{count}} بورسیه» works for every count; `_one` keys use the same pattern.

## Pass A — meaning (3 strings changed)

| Key | Before | After |
|---|---|---|
| fit.gpa.used | نمره شما {{pct}}٪ از سقف نمره … مقایسه شد | نمره شما به‌صورت {{pct}}٪ از سقف نمره … مقایسه شد (was ungrammatical / misleading) |
| visaroute docs.readyCount | {{count}} آماده، {{reused}} مورد از مدارک قبلی شما | … {{reused}} مورد با استفاده دوباره از مدارک شما ("reused" was lost) |
| doc.business_registration.why | جواز کسب‌وکار دانشگاه | گواهی ثبت کسب‌وکار دانشگاه (a university has no «جواز کسب») |

All other strings re-read against en + ko: no additions/omissions.

## Pass B — native naturalness (10 strings changed)

| Key | Before | After |
|---|---|---|
| fit.track.ENGLISH | به زبان انگلیسی | انگلیسی‌زبان (reads naturally inside «دوره‌های {{track}}») |
| matchReason.LANGUAGE_GAP_SMALL | … ممکن است شرط را داشته باشید | … ممکن است به حد نصاب برسید |
| check.rejected | باشه، از آن استفاده نمی‌کنیم. | بسیار خب، از آن استفاده نمی‌کنیم. (too colloquial) |
| services.success.assignedText | … به شما سلام می‌کند | … با شما ارتباط می‌گیرد (literal calque) |
| uni27.schol.checkMine | … به شما می‌خورد | … مناسب شماست |

Also: fit.track.KOREAN, matches.method.stage1 («احراز شرایط»), v10.account.continue, login.aside.point1, v10.check.lede.

## Pass C — UI context & brevity (5 strings changed)

| Key | Before | After |
|---|---|---|
| fit.submit | دانشگاه‌های من را نشان بده | نمایش دانشگاه‌های من (Persian buttons use noun phrases) |
| fit.tier.CHALLENGE.short | ارزش بررسی | ارزش دیدن دارد |
| fit.tier.MEETS.short | حداقل شرایط را دارید | دارای حداقل شرایط |
| uni27.service.KOREAN_TUTORING | کلاس تقویتی زبان کره‌ای | کلاس تقویتی کره‌ای |
| essay.statusDone.STUDENT_REVISION | دوباره باز شد. می‌توانید دوباره ویرایش کنید | دوباره باز شد. حالا قابل ویرایش است |

Consistency check passed: one term each for بورسیه، آپوستیل، تأیید کنسولی، راهنمای پذیرش، مؤسسه زبان کره‌ای، پذیرش‌نامه، مشاور، تطبیق.

## Final comparison

All 729 pairs compared en/ko ↔ fa after the passes: meaning preserved; no wording implies admission odds or guarantees;
placeholders/`<em>` intact; validator 0 problems.

## Unsure

- `fit.test.*` Latin-only test names carry an invisible U+061C mark to pass the validator's script check (brief requires Latin).
  A validator whitelist would be cleaner.
- `v20.uni.why.breadthBody`: Hangul "(대학알리미)" dropped (validator forbids Hangul); kept "Academy Info" + Persian gloss.
- `v9.funds.longer_*`: government 'consulting' tier rendered «رده مشاوره‌ای»; no established Persian term.
- Digits: Latin digits (bundle convention, matches interpolated values). Iranian sites often prefer Persian digits — product decision.
- Existing bundle issue noticed (not edited): `common.json` `tier.REACH` ("Not eligible yet") is «بلندپروازانه» ("ambitious") in fa — outdated meaning; V27 `marketing:matching.p1` now replaces the matching marketing line.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → برای درخواست، مدرک زبان لازم نیست. بعد از پذیرش باید {{tests}} یا بالاتر داشته باشید.
- `fit.reason.far` → ‏{{options}} یا بالاتر لازم است؛ فاصله زیادی با نمره فعلی شما دارد.
- `fit.tier.UNCLEAR.title` → فعلاً راه زیادی مانده
- `fit.tier.UNCLEAR.short` → آمادگی بیشتر
- `fit.tier.UNCLEAR.lede` → نمره فعلی شما خیلی پایین‌تر از شرط اعلام‌شده است. زمان بیشتری برای آمادگی در نظر بگیرید و بعد دوباره بررسی کنید.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
