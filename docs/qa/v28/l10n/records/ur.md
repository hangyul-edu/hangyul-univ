# V28 l10n review — Urdu (ur)

Scope: all 927 keys of `scripts/i18n/v28/jobs/ur.json` → `scripts/i18n/v28/tx/ur.json` (agency 403, marketing 411,
university 27, visaroute 25, common 23, student 14, concierge 11, dossier 6, success 4, writing 2, mobile 1).
Variety: standard Pakistani Urdu, polite «آپ» with ‑یں imperatives, the lightly English-mixed register of Pakistani
education sites (اپ لوڈ، کنفرم، پروفائل، ٹیوشن فیس), as in V27. Consoles (agency, university) concise professional; student
and marketing warm and plain. Urdu ی/ک/ہ, Urdu punctuation ۔ ، ؟, Latin digits, «فیصد» instead of `%` in running text.
Validator: `node scripts/i18n/v28/validate.mjs --only=ur` → **927 strings valid, 0 problems**.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Ayesha, 18, Lahore (first-time visitor) | FSc done, lands on the home page, wants a bachelor's after a Korean language institute | Plain warm copy, clear CTA, no heavy Persianised Urdu |
| Hamza, 27, Islamabad (comparison shopper) | Engineer comparing Basic / All-in-One / Premium and agencies for an English-taught master's | Exact plan contents, prices "one-time", visa terms: اپوسٹل، قونصلر تصدیق، مالی وسائل کا ثبوت |
| Sana, 31, Karachi agency counselor | Uses the Agency Console daily | Short, consistent console labels; plural counts; SLA/ops vocabulary |

## Glossary (reused from V27, extended)

| English | Urdu | Note |
|---|---|---|
| the Hangyul team | Hangyul ٹیم | replaces every old «آپ کا کونسلر» in student copy |
| counselor (agency staff, consoles) | کونسلر | console-only |
| scholarship(s) | وظیفہ / وظائف | |
| Global Korea Scholarship (GKS) | گلوبل کوریا اسکالرشپ (GKS) | V27 name; also for "Korean Government Scholarship Program" |
| apostille | اپوسٹل | |
| consular legalization (영사확인) | قونصلر تصدیق | never "confirmation" |
| legalization (generic) | قانونی تصدیق | |
| certified translation | مصدقہ ترجمہ | |
| admission guide | داخلہ گائیڈ | |
| Korean language institute | لینگویج انسٹی ٹیوٹ | |
| residence card | رہائشی کارڈ | |
| proof of funds | مالی وسائل کا ثبوت | |
| sponsor | کفیل | |
| dormitory | ہاسٹل | |
| deadline | آخری تاریخ | |
| intake | سیشن | Pakistani usage |
| offer (admission) | آفر | consoles |
| enrollment | داخلہ | |
| waitlisted | ویٹ لسٹ میں | |
| Recommended | تجویز کردہ | browsing order only |
| match | میچ | |
| plan | پلان | Basic / All-in-One / Premium kept Latin |
| Needs more preparation (far tier) | مزید تیاری درکار ہے | never ambitious/reach |
| Needs checking with us | ہمارے ساتھ چیک کرنا ضروری | |
| task (console) | ٹاسک | |
| queue | قطار | |
| verify (document) | تصدیق کریں | |
| backlog | زیرِ التوا کام | |
| median | میڈین | |
| member (terms) | رکن / اراکین | |
| withdrawal (consumer law) | دستبرداری | |
| Personal Information Protection Act | ذاتی معلومات کے تحفظ کا قانون | |

## Bidi / RTL

Test names, brand, plan names, GKS/IEQAS/SLA/TLS/IP, emails and digits stay Latin inside RTL sentences. Strings that start
with a placeholder, digit, `]` or a Latin word get U+200F RLM (bundle convention). Ranges written «X سے Y»; arrows in
`v22.in.chain` use «←» so they point in reading direction; quoted labels use «».

## Pass A — meaning (14 strings changed)

| Key | Before | After |
|---|---|---|
| fit.tier.UNCLEAR.title | فی الحال منزل ابھی دور ہے | مزید تیاری درکار ہے (exact "needs more preparation") |
| fit.tier.CHALLENGE.title | قریب سے دیکھنے کے لائق | ہمارے ساتھ چیک کرنا ضروری (new EN meaning) |
| fit.tier.MEETS.lede | …یہ داخلے کا فیصلہ نہیں ہے۔ | ہر یونیورسٹی کی موجودہ شائع کردہ شرائط سے موازنہ کیا گیا۔ (EN shortened) |
| scholarships.empty | ابھی دکھانے کے لیے کوئی وظیفہ نہیں۔ | + «اپنا پروفائل مکمل کریں…» (second sentence was missing) |
| v9.announced.rule.STUDY_DEPOSIT_SCHEME | …جو کوریائی زبان نہیں جانتے… | …جن کے پاس کوریائی زبان کا اسکور نہیں… (it is about a test result) |

Also: task.visa.other_passport_record / doc.other_passport_record.name (issuance record), v9.money.note.NHIS_D2,
RESIDENCE_CARD_90_DAYS, step.slow_items.title (documents, not "tasks"), form.source.missing, help.who, v6.unis.title,
v15.pricing.lede, journey.eyebrow.

## Pass B — native naturalness (11 strings changed)

| Key | Before | After |
|---|---|---|
| inbox.audienceStudent | {{name}} اسے دیکھ سکے گا | {{name}} اسے دیکھ سکیں گے (gender-neutral respectful plural) |
| v11.faq.q4.q | …کیا میں تیاری کر سکتا ہوں؟ | …کیا تب بھی تیاری ممکن ہے؟ (no masculine-only form) |
| v11.hero.title | (calque "is easy!") | کوریا میں تعلیم، اب آسان! |
| check.title | ہمیں یہ معلومات ملی ہیں۔ براہِ کرم انہیں چیک کریں۔ | ہمیں جو ملا، اسے چیک کریں |
| v10.services.housing.p2 | ضمانت اور ماہانہ کرایہ… | سیکیورٹی ڈپازٹ اور ماہانہ کرایہ… (what Pakistani renters say) |

Also: residence.groupUnknown («اپائنٹمنٹ بک کریں»), residence.useGroup («درخواست دے رہی ہے»), v25.today.student_silent,
v25.in.yield, step.apply.title, v4.compare.scholarshipHint.

## Pass C — UI context, brevity, one term per concept (39 strings changed)

| Key | Before | After |
|---|---|---|
| help.route.* / help.contact / owner.counselor (×8) | آپ کا کونسلر | Hangyul ٹیم |
| dossier reason.IN_REVIEW | آپ کا کونسلر اسے جانچ رہا ہے۔ | Hangyul ٹیم اسے چیک کر رہی ہے۔ |
| v28.pipe.rate | پچھلے مرحلے کا {{pct}}% | پچھلے مرحلے کا {{pct}} فیصد |
| ws.profileComplete | پروفائل {{pct}}% مکمل | پروفائل {{pct}} فیصد مکمل |
| v15.services.scope.dormitory_support | ہاسٹل کی معاونت | ہاسٹل (chip) |

Also every visaroute/dossier/concierge/success caveat that named «آپ کا کونسلر» (team identity, 20 more strings), v26.now.owner.STUDENT
(«آپ»), v8.ops.* «زیرِ التوا کام» unified, «سیشن» for intake everywhere.

## Final comparison

All 927 pairs re-read en/ko ↔ ur: placeholders and tags (`<br>`, `<span class>`, `<h2>`, `<settings>`, `<privacy>`) intact,
`\n` paragraph breaks kept in city bodies, no probability or "ambitious" wording on the fit tiers, "Recommended" only as
«تجویز کردہ», no Hangul (대학알리미 → «Academy Info» with gloss), validator 0 problems.

## Marketing scorecard (30-point: clarity · trust · naturalness · brevity · CTA · cultural fit)

| Section | Score | Note |
|---|---|---|
| v11 home (hero, services, why, CTA) | 26 (5·4·4·4·5·4) | transcreated; "guarantees a successful life" softened to «کامیاب شروعات میں بھرپور ساتھ» for trust |
| v11 FAQ | 26 (5·5·4·4·4·4) | document list kept structured, gender-neutral questions |
| v12 privacy & terms | 25 (5·5·4·3·4·4) | legal accuracy first; article numbers kept Latin |
| v15 pricing | 27 (5·5·4·5·4·4) | plan names Latin, «ایک بار ادائیگی», CTAs «… سے شروع کریں» |
| v20/v24/v28 university & city pages | 26 (5·4·5·4·4·4) | city names transliterated, facts unchanged |
| v12 directory/map, footer, SEO | 26 (5·4·4·5·4·4) | |

## Unsure

- `v11.why.s3.text`: EN "guarantees a successful life as a student abroad" deliberately not rendered as a guarantee; a
  reviewer may want it closer to the source.
- `v11.faq.q7.a` keeps the source's "better chances of admission" wording (FAQ about grades, not a fit tier).
- `v14.legal.ecommerce`: «آن لائن تجارت (میل آرڈر) رجسٹریشن نمبر» is descriptive; Pakistan has no equivalent registration.
- `v15.pricing.compare.item` has an empty EN source; translated from ko 구분 as «تفصیل».
- Korean place names (Sinchon, Anam, Gamcheon, Tongyeong…) transliterated by ear.
- `v22.in.chain` arrow direction «←» assumes RTL rendering of the whole string.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 927 | 15 | 64 | 848 |

## Second pass (jobs2)

Scope: `scripts/i18n/v28/jobs2/ur.json` → `scripts/i18n/v28/tx2/ur.json`, 279 job keys (success 204, student 41, dossier 32,
marketing 2): student workspace owner lines, essay/success items, agency submission queue and portfolio review, dossier facts.
All 279 were missing or English: newly translated 276, kept verbatim 0, rewritten 0, plus 3 empty-English
`dossier:upload.status.*` keys left empty as the validator requires. Same personas; first-pass glossary unchanged (Hangyul ٹیم،
قونصلر تصدیق، اپوسٹل، داخلہ لیٹر، سیشن، آخری تاریخ، وظیفہ، آفر، تجویز کردہ). New: جمع کرانا / درج کریں (submit / record),
اجازت / رضامندی (authorization / consent), پورٹ فولیو, حوالہ نمبر, Fixture (Latin label). Strings starting with a placeholder or
Latin word get U+200F (first-pass convention); quoted labels use «».

- Pass A (meaning): 276 drafted from EN with KO; student-side team lines use feminine verb agreement with ٹیم (کرتی ہے).
- Pass B (naturalness): 9 changed (e.g. «بمقابلہ» for "vs", «ادا کنندہ:» for "paid by", «زیرِ جائزہ» chips).
- Pass C (UI/brevity): 7 shortened (queue columns, fee/status chips).

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.team` | English: Checks every document and essay, then prepares the submission. | ہر دستاویز اور مضمون چیک کرتی ہے، پھر جمع کرانے کی تیاری کرتی ہے۔ |
| `success:agencyItem.DOC_LEGALIZE` | English: {{label}} — consular legalization pending | ‏{{label}}: قونصلر تصدیق باقی |
| `success:item.ESSAY_WRONG_NAME.why` | English: An essay addressed to another university is the most common avoidable rejection. | کسی دوسری یونیورسٹی کے نام لکھا مضمون مسترد ہونے کی سب سے عام قابلِ گریز وجہ ہے۔ |
| `success:queue.detail.revoked` | English: The student withdrew consent on {{date}}. Do not submit. | طالب علم نے {{date}} کو رضامندی واپس لے لی۔ جمع نہ کرائیں۔ |
| `dossier:facts.sponsor` | English: Who pays | اخراجات کون ادا کرتا ہے |

Marketing scorecard (`v20.uni.intl.*`, 2 keys): clarity 5 · trust 5 · naturalness 4 · brevity 4 · CTA 4 · cultural fit 5 = 27.

### Second pass: unsure

- `dossier:page.privacy`: EN "you, your counselor and Hangyul" → «آپ اور Hangyul ٹیم»; confirm the product means the team.
- `success:queue.term.*` بہار / گرما / خزاں / سرما: Pakistani universities usually say "Spring/Fall semester" in English; kept Urdu seasons.
- `success:agencyItem.ESSAY_REVISE` «طالب علم کے پاس نظرِ ثانی کے لیے»: slightly long for a chip.
- `success:agency.colFit` «میچ» (glossary term) for "Fit".

Counts (second pass): job keys 279 · kept verbatim 0 · rewritten 0 · newly translated 276 (+3 empty-by-design).
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ur` → **279 strings valid, 0 problems**.

## Third pass (jobs3)

Scope: `scripts/i18n/v28/jobs3/ur.json` → `scripts/i18n/v28/tx3/ur.json`, 336 job keys (university 239, student 35,
marketing 21, writing 20, visaroute 16, agency 2, concierge 2, common 1): remaining customer-critical keys (sign-up, consent,
password reset, student home, directory filters, privacy retention) and operational keys (University Console applicants,
programs and rules, cohorts, insights, messages; essay review queue; visa staff panel). All 336 had no current translation:
newly translated 336, kept verbatim 0, rewritten 0; no empty-English keys in this job. Same personas; glossary unchanged
(Hangyul ٹیم، آفر، داخلہ، سیشن، آخری تاریخ، قانونی تصدیق، وظائف، ویٹ لسٹ میں، بیچ، درخواست دہندہ، ایجنسی، ایکسپورٹ).
New console terms: برقراری کی شرح (retention), زیرِ تعلیم (enrolled = currently studying, 재학) vs داخلہ لیا (enrolled stage),
تعلیمی رخصت (on leave), سفارتی مشن (visa post, 공관), انتباہات (flags/early warnings). U+200F before strings that start with a
placeholder or Latin word; quoted UI labels in «».

- Pass A (meaning): 336 drafted from EN with KO; `enrollment.*` statuses follow KO (재학/휴학/자퇴/전출), `v4.req.gpa` uses «فیصد».
- Pass B (naturalness): 6 changed (e.g. «آگے نہیں بڑھتے» for "do not continue", «ہم کیسے گنتے ہیں», consent label with
  «کرتا/کرتی» for gender-neutral first person).
- Pass C (UI/brevity/RTL): 5 changed (e.g. `messages.pickText` "on the left" → «فہرست سے» since the list sits on the right in RTL;
  queue chips shortened to «مدت گزر گئی», «میرے ذمے»).

| Key | Before | After |
|---|---|---|
| `student:register.consent.CROSS_BORDER_VERIFICATION.label` | English: I acknowledge that my email and mobile number are processed abroad to verify them | میں تسلیم کرتا/کرتی ہوں کہ میری ای میل اور موبائل نمبر کی تصدیق کے لیے ان پر بیرونِ ملک کارروائی ہوتی ہے |
| `student:register.passwordHint` | English: At least 10 characters. A sentence you will remember works best. | کم از کم 10 حروف۔ کوئی ایسا جملہ بہترین ہے جو آپ کو یاد رہے۔ |
| `university:v22.manage.teamNote` | English: Every member of your university is an administrator… | آپ کی یونیورسٹی کا ہر رکن ایڈمنسٹریٹر ہے۔ کوئی کردار تفویض نہیں کرنا۔ افراد شامل کرنے یا ہٹانے کے لیے Hangyul سے کہیں۔ |
| `university:messages.pickText` | English: Choose a thread on the left to read and reply. | پڑھنے اور جواب دینے کے لیے فہرست سے کوئی گفتگو منتخب کریں۔ |
| `visaroute:staff.needsAnswer` | English: Student must choose the area (post not resolved) | طالب علم کو علاقہ منتخب کرنا ہے (سفارتی مشن طے نہیں ہوا) |

Marketing scorecard (21 keys: v21/v23/v24 directory and campus labels, v23 privacy retention, footer): clarity 5 · trust 5 ·
naturalness 4 · brevity 5 · CTA 4 · cultural fit 4 = 27. Region names transliterated (گیونگی، چھونگچھونگ، گیونگبک).

### Third pass: unsure

- `university:settings.noTeam`: EN has one sentence; KO adds "ask Hangyul to add members". Followed EN only.
- `university:messages.pickText`: "on the left" replaced by «فہرست سے»; confirm the RTL layout really mirrors the thread list.
- `university:enrollment.TRANSFERRED` «منتقل ہو گئے» (KO 전출 = transferred out) and `WITHDRAWN` «تعلیم چھوڑ دی» (KO 자퇴).
- `marketing:v23.privacy.retention.sendgrid` «فرضی شناخت والا» for "pseudonymised": a legal reviewer may prefer «تخلص شدہ».
- `visaroute:staff.post` «سفارتی مشن» for embassy/consulate "post"; `staff.appointment` follows EN (KO 신청일 = application date).
- Korean region transliterations (Gyeongbuk, Chungcheong, Jeolla) by ear.

Counts (third pass): job keys 336 · kept verbatim 0 · rewritten 0 · newly translated 336.
Validator: `JOBS=jobs3 TX=tx3 node scripts/i18n/v28/validate.mjs --only=ur` → **336 strings valid, 0 problems**.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
