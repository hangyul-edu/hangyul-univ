# V28 l10n review: Persian (fa)

Scope: all 923 job keys of `scripts/i18n/v28/jobs/fa.json` → `scripts/i18n/v28/tx/fa.json` (agency 402, marketing 185,
concierge 182, dossier 58, university 27, visaroute 25, common 23, student 14, success 4, writing 2, mobile 1).
Variety: standard Iranian Persian (Tehran written standard), polite «شما» with ‑ید verb forms for students; noun-phrase
labels and concise professional wording for the agency/university consoles. Persian ی/ک only (0 Arabic ي/ك), ZWNJ in
می‌، ‑ها، ‑تر، ‑شده (646 ZWNJs), Latin digits (bundle convention), Persian ٪ «» ، ؟.
Validator: `node scripts/i18n/v28/validate.mjs --only=fa` → **923 strings valid, 0 problems**.

## Personas

| Persona | Profile | What they check |
|---|---|---|
| Sara, 18, Tehran (first-time visitor) | Just finished دیپلم, lands on the marketing home page, knows nothing about Korean admissions | Warm, plain wording; CTAs that read like Iranian sites; no promises |
| Amir, 27, Isfahan (comparison shopper) | Engineer comparing Hangyul with local اعزام دانشجو agencies for an English-taught master's | Exact terms (آپوستیل، تأیید کنسولی، تمکن مالی، ریزنمرات)، pricing/plan clarity, privacy page credibility |
| Neda, 34, agency counselor (Tehran) | Uses the Agency Console daily | Short, consistent console labels; one term per concept (پرونده، مهلت، درخواست، مسئول) |

## Glossary (V27 glossary reused; V28 additions marked +)

| English | Persian (chosen) | Note |
|---|---|---|
| scholarship(s) | بورسیه / بورسیه‌ها | V27 |
| Global Korea Scholarship (GKS) | بورسیه دولت کره (GKS) | V27 |
| tuition | شهریه | V27 |
| apostille | آپوستیل | V27 |
| consular legalization (영사확인) | تأیید کنسولی | V27 bundle term; see Unsure |
| notarized | تأییدشده در دفتر اسناد رسمی | V27 |
| admission guide | راهنمای پذیرش | V27 |
| Korean language institute | مؤسسه زبان کره‌ای | V27 |
| admission letter | پذیرش‌نامه | V27 |
| residence card | کارت اقامت | V27 |
| immigration office | اداره مهاجرت | V27 |
| e-visa | ویزای الکترونیکی | V27 |
| proof of funds / bank certificate | تمکن مالی / گواهی موجودی بانکی | V27 |
| transcript / GPA | ریزنمرات / معدل | V27 |
| personal statement | انگیزه‌نامه | V27 |
| the Hangyul team | تیم Hangyul | never «مشاورتان» for the Hangyul team (3 V27 strings fixed) |
| counselor (agency staff) | مشاور | only for real agency staff |
| dormitory / housing | خوابگاه / مسکن | V27 |
| deadline | مهلت | V27 |
| plan | پلن | V27 |
| + needs more preparation (far tier) | نیاز به آمادگی بیشتر | never جاه‌طلبانه / بلندپروازانه |
| + agency | مؤسسه اعزام (دانشجو) | Iranian term for study-abroad agencies |
| + case / caseload | پرونده / پرونده‌های شما | |
| + owner (of a case/task) | مسئول | |
| + review / reviewer | بررسی / بررسی‌کننده | |
| + verify (document) | تأیید | |
| + request changes | درخواست اصلاح | |
| + document vault | گاوصندوق مدارک | |
| + airport pickup | استقبال فرودگاهی | |
| + move-in | اسکان | |
| + offer / accepted offer / enrolled | پذیرش / قبول پذیرش / ثبت‌نام‌شده | |
| + intake | ترم ورود | |
| + view (saved filter) | نما | |
| + SLA breach | نقض SLA | |
| + Recommended (sort) | پیشنهادی | browsing order, not ranking (V27) |

## Bidi / RTL

- Test names, NHIS, HiKorea, T-money, eSIM, SLA, PDF/PNG, brand and card/processor names stay Latin inside sentences.
- Strings starting with a placeholder or Latin token get a U+200F RLM prefix (bundle convention); ranges are «0 تا 7 روز»,
  never an en dash; «بیش از 30 روز» instead of `30+`; arrows in the funnel point left (←) for RTL flow.
- No straight `?`/`;`/`"` except the literal `?` key in `writing:v6.queueKeys` (it is the shortcut key itself).

## Pass A: meaning (21 strings changed vs `current`, plus 2 in my own draft)

| Key | Before | After |
|---|---|---|
| common fit.tier.UNCLEAR.title | فعلاً راه زیادی مانده | نیاز به آمادگی بیشتر (now states the tier's meaning) |
| common fit.tier.CHALLENGE.title | ارزش بررسی بیشتر دارد | نیاز به بررسی با ما (V28 EN: "Needs checking with us") |
| common fit.tier.CHALLENGE.lede | مانعی که ما بدانیم وجود ندارد… | Hangyul هنوز شرایط این دانشگاه‌ها را برای این مقطع تأیید نکرده است… (V28 meaning) |
| visaroute cond.OTHER / help.askHint / caveat.* | …مشاورتان تأیید می‌کند | …تیم Hangyul تأیید می‌کند ("never your counselor") |
| marketing v28.uni.why.english (draft) | مدارک تحصیلی به زبان انگلیسی ("certificates in English") | دوره‌های مدرک‌دار انگلیسی‌زبان |

Also: fit.tier.MEETS.title/lede, ONE_STEP.lede, UNCLEAR.lede (shortened to the V28 English), scholarships.empty (second
sentence was missing), v6.unis.title, journey.eyebrow, v15.pricing.lede, profileV3.why.goals, docCategory.EMPLOYMENT_INCOME_PROOF.
`marketing:v11.why.s3.text` "guarantees a successful life" rendered «برای زندگی دانشجویی موفق کنارتان است» (no guarantee).

## Pass B: native naturalness (5 strings changed)

| Key | Before | After |
|---|---|---|
| university v22.in.q.settle | آیا پس از ثبت‌نام جا می‌افتند؟ | آیا پس از ثبت‌نام با محیط سازگار می‌شوند؟ (console register) |
| marketing v11.why.s2.text | Hangyul توانایی‌های شما را به بیشترین حد می‌رساند | Hangyul کمک می‌کند توانایی‌هایتان شکوفا شود (calque of "maximises") |
| marketing v12.footer.explore | گشت‌وگذار | کاوش (gasht reads as tourism) |
| agency v8.ops.ageing.oldest | {{name}} {{count}} روز است که پیش نرفته | {{name}}، {{count}} روز بدون پیشرفت |
| student profileV3.why.goals | اینکه چه چیزی و از کی می‌خواهید بخوانید، فهرست شما را … محدود می‌کند | وقتی بدانیم چه رشته‌ای و از چه زمانی…، فقط دوره‌هایی را نشان می‌دهیم که… جورند |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
|---|---|---|
| agency v8.ops.openNow | باز در حال حاضر | کارهای باز فعلی |
| visaroute help.who | انجام‌دهنده | مسئول (same term as console "owner") |
| concierge stepState.todo | انجام‌نشده | برای انجام |
| marketing v11.hero.explore | دیدن دانشگاه‌ها | مشاهده دانشگاه‌ها (Iranian CTA style) |
| marketing v11.unis.all | دیدن همه دانشگاه‌ها | مشاهده همه دانشگاه‌ها |
| visaroute reason.READY (draft) | آماده است. … | kept bundle wording «آماده. …» verbatim |

Consistency: one term each for تیم Hangyul، مؤسسه اعزام، پرونده، مهلت، درخواست، تأیید، بررسی، گاوصندوق مدارک، ثبت‌نام.

## Final source↔target comparison

All 923 pairs compared en/ko ↔ fa: placeholders and `<br>`, `<span>`, `<h2>`, `<settings>` intact; no wording implies
admission odds or guarantees; far tier means "needs more preparation" everywhere; validator 0 problems.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| Hero (v11.hero.*, v11.cta.*) | 5 | 4 | 5 | 5 | 5 | 4 | 28 |
| Services (v11.services.*) | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| Why Hangyul (v11.why.*) | 4 | 4 | 4 | 4 | 4 | 5 | 25 (after softening "guarantees"/"maximises") |
| FAQ (v11.faq.*) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| Universities / directory / map (v11.unis, v12.directory, v12.map, v6) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| University page (v20.uni.*, v24, v28.uni.*) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| City pages (v20.city.*) | 5 | 5 | 4 | 4 | 3 | 5 | 26 |
| Pricing (v15.pricing.*) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Privacy policy (v12.privacy.*) | 5 | 5 | 4 | 4 | 3 | 5 | 26 |
| SEO / footer / FAQ languages | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

First-pass Why section scored 22 (literal "guarantees", "maximises your potential"); rewritten to 25.

## Unsure

- 영사확인: kept the V27 bundle term «تأیید کنسولی». It is the term Iranian applicants use, but it literally back-translates as
  "consular confirmation/approval", which the brief forbids in other languages. A human reviewer should confirm; the
  alternative «قانونی‌سازی کنسولی» is accurate but rare in Iranian usage.
- `v12.privacy.processors.intro`: Korea's «قانون حمایت از اطلاعات شخصی» is a descriptive rendering; no official Persian title.
- `v11.faq.q1.a` "family relation certificate" → «گواهی روابط خانوادگی» (Korean-specific document; Iranians use شناسنامه).
- "agency" as «مؤسسه اعزام»: standard in Iran but slightly formal; «آژانس» is the colloquial alternative.
- Existing bundle issue (not editable here): `common.json` `tier.REACH` was «بلندپروازانه» in V27; not in this job.

## Counts

| | |
|---|---|
| Job keys | 923 |
| Kept verbatim (`current` correct for V28 English) | 7 |
| Rewritten (`current` existed but changed) | 20 |
| Newly translated (`current` null) | 896 |

## Second pass (jobs2)

Scope: `scripts/i18n/v28/jobs2/fa.json`, which has 677 job keys (success 498, dossier 131, student 44, marketing 4), written to
`scripts/i18n/v28/tx2/fa.json`. These keys come from the leak families the crawl missed: student workspace ownership lines,
success blockers/checklist items, submission hand-off and authorization flow, the agency "Ready to submit" queue, and dossier
findings/upload prompts. Every key was English or missing, so there are 677 newly translated, 0 kept verbatim and 0 rewritten.
The terms are the first-pass glossary above (تأیید کنسولی، آپوستیل، تیم Hangyul، مؤسسه اعزام، پرونده، مهلت، پذیرش‌نامه، ترم ورود).
New terms in this pass: authorize/authorization = صدور مجوز / مجوز, withdraw authorization = پس گرفتن مجوز, portal = پورتال,
confirmation (number) = تأییدیه / شماره تأییدیه, reference number = شماره پیگیری, receipt = رسید, portfolio (of programs) =
سبد برنامه‌ها, portfolio (art) = نمونه‌کار, Strong/Possible match = تطابق قوی / تطابق ممکن.
100 strings that start with a placeholder, digit or Latin word carry U+200F (the first-pass convention). Persian ی/ک only.

- Pass A (meaning): 677 strings changed (all new). Every student-facing "your counselor" in the English source (essay review,
  interview practice, final check, fee amount, name mismatch, requirement change, 18 of 19 strings) is rendered as «تیم Hangyul» per
  the brief's team identity. The `{{counselor}}` placeholder and agency-console «مشاور» stay as they are.
- Pass B (naturalness): restructured English-order titles into Persian verb-final clauses, e.g. "{{count}} items left and
  {{days}} days to the deadline" became a nominal Persian list. CTAs use the infinitive/noun form common on Iranian sites
  (بارگذاری، دیدن مراحل، صدور مجوز ارسال).
- Pass C (UI/brevity): console chips are kept as noun phrases (مهلت گذشته، نمونه‌کار الزامی، در انتظار آپوستیل). The three
  empty-English upload status keys are left empty, as the updated validator requires.

| Key | Before | After |
|---|---|---|
| success:item.DOC_LEGALIZE.title | {{label}} still needs consular legalization (English shown) | {{label}} هنوز تأیید کنسولی لازم دارد |
| student:workspace.owner.enrol.you | Pay tuition directly to the university, in your own name. (English shown) | شهریه را مستقیماً و به نام خودتان به دانشگاه بپردازید. |
| success:submission.safety | Never share your portal password. Hangyul will never ask for it. (English shown) | رمز پورتال خود را هرگز به کسی ندهید. Hangyul هرگز آن را از شما نمی‌خواهد. |
| success:item.ESSAY_REVIEW.why | Nothing to do. Your counselor is reading it. (English shown) | کاری لازم نیست. تیم Hangyul در حال خواندن آن است. |
| dossier:finding.NAME_MISMATCH | The name on this document ({{found}}) … (English shown) | نام روی این مدرک ({{found}}) با پروفایل شما ({{profile}}) فرق دارد. تیم Hangyul آن را بررسی می‌کند. |

Marketing scorecard (v20.uni.intl.*, 4 strings: university international-office facts):
clarity 5, trust 5, naturalness 4, brevity 4, CTA strength 4, cultural fit 5, for a total of 27/30 (≥ 25, no further rewrite).

Unsure (second pass):
- `dossier:upload.status.NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION`: EN/KO are intentionally empty (no adjective in `upload.haveTitle`); the updated validator requires an empty value, so they are left empty.
- `success:submission.authorize.payer.UNKNOWN`: "your counselor confirms who pays" sits in the agency-authorization flow, so it
  is rendered as «مشاور مؤسسه» (agency counselor), not «تیم Hangyul». Please confirm which party is meant.
- `dossier:page.privacy`: "you, your counselor and Hangyul" is collapsed to «شما و تیم Hangyul». It does not mention agency
  staff, who see files only with consent (v9.who.noConsent).
- `success:queue.fixture` stays Latin «Fixture» (a test-data label that the fixtureNote quotes).

Counts (second pass): job keys 677 · kept verbatim 0 · rewritten 0 · newly translated 677.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=fa` gives **677 strings valid, 0 problems** (after
the validator fix for job keys ending in `_few` and empty-English keys).

## Third pass (jobs3)

Scope: `scripts/i18n/v28/jobs3/fa.json` → `scripts/i18n/v28/tx3/fa.json`, 701 job keys (university 253, marketing 246,
student 154, writing 20, visaroute 17, agency 8, concierge 2, common 1): the remaining customer-critical keys (sign-up and
consent, password reset, student workspace/home, university page tabs, pricing and plan comparison, terms of service,
privacy transfer section, directory) and operational keys (University Console applicants/programs/cohorts/insights,
writing review queue, visa staff panel, agency visa tab). Every key had `current` = null, so 700 newly translated, 0 kept
verbatim, 0 rewritten; `marketing:v15.pricing.compare.item` has empty English and stays empty.
Glossary unchanged (تیم Hangyul، مؤسسه اعزام، تأیید کنسولی، پذیرش / قبول پذیرش / ثبت‌نام‌شده، ترم ورود، دوره، متقاضی،
پرونده، مهلت، انگیزه‌نامه، پلن، پیشنهادی). New terms: cohort = ورودی, retention = ماندگاری, intake seats = ظرفیت بین‌المللی,
post (consular) = نمایندگی کنسولی, member (terms) = عضو, withdrawal (statutory) = انصراف, processor = پردازشگر,
mock interview = مصاحبه آزمایشی, junior college = کالج کاردانی. Plan names Basic / All-in-One / Premium stay Latin (bundle).
Korean statute citations: ماده (article) › بند (항) › جزء (호). U+200F prefix on strings that start with a placeholder.

- Pass A (meaning): 700 drafted from EN with KO for ambiguity. "Ongoing with your counselor" (pricing) → «پیگیری مستمر با
  تیم Hangyul» (team identity). 대학알리미 rendered «سامانه Daehak Alimi» (no Hangul allowed).
- Pass B (naturalness): 11 changed, e.g. statute references reordered to Persian legal order (5 strings), «کجا از دستشان
  می‌دهیم؟» for "Where do we lose them?", «آنچه کم دارید» for "What you're missing".
- Pass C (UI/brevity): 8 changed; console chips as noun phrases (دیرکرد، در انتظار تصمیم، فقط علامت‌دار), CTAs as
  «شروع با …» / «باز کردن …», `v25.head.*` fragments written to follow a number (درخواست جدید در این هفته).

| Key | Before | After |
|---|---|---|
| `student:register.consent.CROSS_BORDER_VERIFICATION.label` | (missing) I acknowledge that my email and mobile number are processed abroad… | آگاهم که ایمیل و شماره موبایلم برای تأیید، در خارج از کشور پردازش می‌شود |
| `student:v4.ws.consequence.prep` | (missing) Your application can't be submitted until this is done. | تا این کار انجام نشود، درخواست شما ارسال نمی‌شود. |
| `marketing:v12.terms.refunds.withdrawal` | (missing) You may withdraw within 7 days… (Art. 17(1)) | می‌توانید ظرف 7 روز از دریافت تأییدیه سفارش … انصراف دهید. … (قانون حمایت از مصرف‌کننده در تجارت الکترونیکی، بند 1 ماده 17) |
| `university:documents.sharingRule` | (missing) Students share documents with you when they submit… | دانشجویان هنگام ارسال درخواست، مدارک را با شما به اشتراک می‌گذارند. … هر بار مشاهده ثبت می‌شود. |
| `visaroute:staff.needsAnswer` | (missing) Student must choose the area (post not resolved) | دانشجو باید منطقه را انتخاب کند (نمایندگی کنسولی مشخص نشده) |

Marketing scorecard (third pass):

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| Pricing / plan comparison (v15.pricing.*) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Terms of service (v12.terms.*) | 5 | 5 | 4 | 4 | 3 | 5 | 26 |
| Privacy transfers / sharing (v12.privacy.*, v23.privacy.*) | 5 | 5 | 4 | 4 | 3 | 5 | 26 |
| University page and directory (v12.uni, v20.uni, v21, v23, v24, v17) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| City lines, SEO, legal footer (v20.city, v12.seo, v14) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

Unsure (third pass):
- `marketing:v15.pricing.compare.value.unlimited` "Ongoing with your counselor": rendered with تیم Hangyul; if the Premium
  plan really means the assigned agency counselor, it should read «پیگیری مستمر با مشاور مؤسسه».
- `marketing:v12.terms.*` / `v12.privacy.transfer.intro`: legal renderings (انصراف، خسارت تأخیر قانونی، ماده/بند/جزء) are
  descriptive; no official Persian text of the Korean acts exists. Needs legal review before relying on it.
- `marketing:v12.terms.universityInfo.p`: 대학알리미 → «سامانه Daehak Alimi»; `v12.type.JUNIOR_COLLEGE` → «کالج کاردانی».
- `marketing:v14.legal.ecommerce` «شماره ثبت کسب‌وکار فروش از راه دور» (Korean 통신판매업 신고번호) is descriptive.
- `university:v25.head.*` and `v22.in.lowN` («n < {{min}}» kept Latin) assume a number is rendered before them.
- `student:v25.lane.you` "What I do" kept first person «آنچه من انجام می‌دهم» as in the English.

Counts (third pass): job keys 701 · kept verbatim 0 · rewritten 0 · newly translated 700 · empty-English kept empty 1.
Validator: `JOBS=jobs3 TX=tx3 node scripts/i18n/v28/validate.mjs --only=fa` gives **701 strings valid, 0 problems**.

## Fourth pass (jobs4)

Scope: `scripts/i18n/v28/jobs4/fa.json` → `scripts/i18n/v28/tx4/fa.json`, 198 job keys (visaroute 123, student 74, writing 1):
student family-sharing view (scopes, link list), money plan (lines, payees, timing, refund), proof-of-funds rules, visa-route
form fields/sections/sources, visa documents and steps, writing status/promise. Every key had `current` = null, so 198
newly translated, 0 kept verbatim, 0 rewritten; no key has empty English. Glossary unchanged (تیم Hangyul، پذیرش‌نامه،
کارت اقامت، اداره مهاجرت، گواهی موجودی بانکی، تمکن مالی، خوابگاه، شهریه، استقبال فرودگاهی، بررسی‌کننده، تطابق قوی).
New terms: family link = پیوند خانوادگی (as in tx3 v9.family.*), family view = نمای خانواده, read-only = فقط‌خواندنی,
sponsor = حامی مالی, passport = گذرنامه, national ID card = کارت ملی, business registration = گواهی ثبت کسب‌وکار,
TB certificate = گواهی آزمایش سل, NHIS = بیمه ملی سلامت (NHIS). 5 strings start with a placeholder or «Hangyul» and carry U+200F.

- Pass A (meaning): 198 drafted from EN with KO for ambiguity (e.g. `v9.funds.title` keeps the "show, not pay" contrast;
  `verdict.NOT_ELIGIBLE` «هنوز واجد شرایط نیستید» keeps "yet").
- Pass B (naturalness): status chips as Persian noun/participle phrases (در انتظار دانشگاه، صادرشده، پیش‌نویس); step titles
  as polite imperatives (نوبت درخواست خود را بگیرید).
- Pass C (UI/brevity): `docs.needsYou` and `writing.needYou` share «نیازمند اقدام شما»; `rail.decision` / `step.decision.title`
  share «نتیجه»; all "Source" labels «منبع».

| Key | Before | After |
|---|---|---|
| `student:v9.funds.genuine` | (missing) The money must really be held… | پول باید واقعاً در حساب باشد. واریز پول فقط برای گرفتن گواهی و برداشت دوباره آن، در کره غیرقانونی است. |
| `student:v9.family.never` | (missing) Never shown: your messages, essays… | هرگز نمایش داده نمی‌شود: پیام‌ها، مقاله‌ها، یادداشت‌های تیم Hangyul و هیچ فایل مدرکی. |
| `visaroute:reason.NEW_FOR_VISA` | (missing) The embassy needs one issued within {{days}} days… | سفارت مدرکی می‌خواهد که حداکثر {{days}} روز پیش از درخواست صادر شده باشد. |
| `visaroute:step.choose_post.why` | (missing) It decides which embassy or consulate… | مشخص می‌کند کدام سفارت یا کنسولگری درخواست شما را می‌پذیرد. |
| `writing:student.lateShort` | (missing) taking longer than expected | بیش از حد انتظار طول کشیده |

Unsure (fourth pass):
- `student:writing.title` "Writing" (KO 에세이) → «مقاله‌ها», matching the essay term used elsewhere; «نگارش» is the alternative.
- `visaroute:doc.business_registration.name` «گواهی ثبت کسب‌وکار دانشگاه» is a descriptive rendering of 사업자등록증.
- `visaroute:who.authority` "clinic" → «درمانگاه»; KO means a designated hospital (지정 병원), which the English does not say.
- City names (هانوی، هوشی‌مین، دانانگ) in the usual Persian spellings; `student:v9.funds.amount.CAPITAL` «گیونگی» for Gyeonggi.

Counts (fourth pass): job keys 198 · kept verbatim 0 · rewritten 0 · newly translated 198.
Validator: `JOBS=jobs4 TX=tx4 node scripts/i18n/v28/validate.mjs --only=fa` gives **198 strings valid, 0 problems**.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
