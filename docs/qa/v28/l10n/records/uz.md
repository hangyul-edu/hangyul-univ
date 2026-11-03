# V28 localization review — Uzbek (uz, Latin script)

Output: `scripts/i18n/v28/tx/uz.json` (354/354 job keys). Validator: `node scripts/i18n/v28/validate.mjs --only=uz` → 354 valid, 0 problems.
Orthography: official Latin alphabet, ʻ (U+02BB) in oʻ/gʻ and ʼ (U+02BC) for the tutuq belgisi. Two inherited strings used ‘ or ' (`marketing:v24.uni.academicTitle`, `student:v16.pay.chooseSubtitle`) and were normalised.
Register: polite *siz*; imperative CTAs ("tekshiring", "soʻrang"); verbal nouns on console buttons ("Vazifa yaratish", "Qoidalarni tahrirlash"). Glossary reused from `docs/qa/v27/l10n/uz.md`.

## Personas

1. **Dilnoza, 18, Toshkent** — first-time visitor finishing 11-sinf, TOPIK 2, reads on her phone; wants to know where to start.
2. **Jasur, 26, Samarqand** — comparison shopper for a master's, IELTS 6.5, compares Hangyul with local agencies, checks pricing and visa wording closely.
3. **Rustam aka, 49, Namangan** — sponsor (Dilnoza's father); plain wording about money and proof of funds.
4. **Nodira, 31, agency counselor in Toshkent** and **a Korean university international-office officer reading the Uzbek console** — console readers; want short, unambiguous labels.

## Glossary

| English | Korean | Uzbek |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | Hangyul jamoasi (never "maslahatchingiz") |
| consultation | 상담 | maslahat |
| interview | 면접 | suhbat |
| application | 지원(서) | ariza |
| admission guide | 모집요강 | qabul yoʻriqnomasi |
| offer | 합격 | taklif |
| acceptance (of offer) | 수락 | rozilik / taklifni qabul qildi |
| enrollment | 등록·입학 | oʻqishga kirish |
| intake | 모집 학기 | qabul davri |
| deadline | 마감 | muddat |
| program | 과정·학과 | dastur |
| requirement / meets | 요건 / 충족 | talab / talablarga javob beradi |
| apostille | 아포스티유 | apostil |
| consular legalization | 영사확인 | konsullik legalizatsiyasi |
| certificate of enrollment | 재학증명서 | oʻqish joyidan maʼlumotnoma |
| Korean language institute | 어학당 | koreys tili markazi |
| GKS | 정부초청장학 | Koreya hukumati stipendiyasi (GKS) |
| scholarship | 장학금 | stipendiya |
| residence card | 외국인등록증 | chet ellik roʻyxat kartasi |
| proof of funds | 재정 증명 | mablagʻ mavjudligini tasdiqlash |
| dormitory | 기숙사 | yotoqxona |
| embassy / consulate / post | 대사관 / 영사관 / 공관 | elchixona / konsullik / vakolatxona |
| e-visa | 전자비자 | elektron viza |
| task / owner | 업무 / 담당자 | vazifa / masʼul |
| plan (purchase) | 플랜 | tarif |
| Writing (section) | 글쓰기 | Yozma ishlar |
| Recommended (sort) | 추천순 | Tavsiya etilgan (browsing order, not a ranking) |
| far tier | 준비가 더 필요한 대학 | Koʻproq tayyorgarlik kerak |

## Pass A — meaning (31 strings changed)

Every string checked against the current EN and KO. Main fixes: all "your counselor" (maslahatchingiz) routes replaced with "Hangyul jamoasi" per the V28 English; fit-tier ledes shortened to the new, narrower English; enrollment no longer rendered as admission (qabul).

| key | before | after |
|---|---|---|
| concierge:help.route.HOUSING | Maslahatchingiz | Hangyul jamoasi |
| common:fit.tier.CHALLENGE.title | Yaqinroq koʻrib chiqishga arziydi | Biz bilan aniqlash kerak |
| university:v22.stage.enrolment | Oʻqishga qabul | Oʻqishga kirish |
| university:v22.stageHint.decision | Kutish roʻyxatida — qaror hali bizning qoʻlimizda | Kutish roʻyxatida. Qaror hali chiqmagan |
| concierge:residence.groupUnknown | …guruh boʻlib topshirishlarini soʻrang… ("ask them to") | …guruh boʻlib ariza berishadimi, soʻrang… ("ask whether") |

## Pass B — native naturalness (22 strings changed)

Read as each persona; calques removed, case suffixes attached to placeholders ("{{uni}}ga", "{{name}}ning"), dashes replaced by full stops.

| key | before | after |
|---|---|---|
| common:fit.summary.UNCLEAR | (draft) …Til balli boshlanish nuqtasi. | …Ishni til sertifikatidan boshlang. |
| marketing:v20.city.Busan.body | Pusan — Koreyaning ikkinchi shahri va u… | Pusan Koreyaning ikkinchi yirik shahri, lekin u… |
| marketing:v20.uni.why.foundedBody | Bu uni … biriga aylantiradi. | Demak, u reestrdagi nisbatan qadimiy muassasalardan biri. |
| agency:v25.today.student_silent | talaba javob bermayapti | javob bermayotgan talabalar |
| concierge:emergency.note | …qoʻngʻiroq qiling — keyin… | …qoʻngʻiroq qiling. Keyin Hangyul jamoasiga xabar bering. |

## Pass C — UI context, brevity, one term per concept (14 strings changed)

| key | before | after |
|---|---|---|
| mobile:v3.uni.decisionNow | QAROR | Qaror (casing left to CSS) |
| marketing:v15.pricing.compare.row.dormitory | Yotoqxona yordami | Yotoqxona |
| dossier:reason.ESSAY_TO_WRITE | …“Esselar” boʻlimida… | …«Yozma ishlar» boʻlimida… (matches `ws.tab.essays`) |
| visaroute:step.slow_items.why | Tasdiqlashlar, … | Legalizatsiya, … (one term for 영사확인) |
| university:v22.in.byProgram | …taklif darajasi | …taklif ulushi (rate, not level) |

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA, cultural fit)

| section | first draft | final | notes |
|---|---|---|---|
| seo.home | 23 | 26 | split the long dash sentence; "masalalarini hal qiling" |
| v15.pricing (lede, f5, compare) | 22 | 26 | "Diagnostika" → "dastlabki baholash"; shorter compare row |
| v20.city (Busan, Gyeonggi, Seoul.line) | 24 | 26 | "ikkinchi yirik shahri"; Gyeonggi rent comparison made idiomatic |
| v20.uni (cta, why.*, intl, philosophy) | 23 | 27 | CTA "Shu yerga ariza berishni oʻylayapsizmi?"; "Uning oʻziga xosligi" |
| v28.uni.why (english, gks, scholarships) | 24 | 26 | GKS local name + abbreviation; "kerak emas" instead of "talab qilinmaydi" |
| v6.unis / journey / v9.faq / footer | 24 | 26 | plain, honest machine-translation disclosure kept intact |

## Final comparison

All 354 source ↔ target pairs re-read side by side. Placeholders and tags identical (validator confirms); test names in Latin; no probability or ranking words for fit tiers; "Hangyul jamoasi" for every student-facing team mention; plural `_one`/`_other` keys use the count-neutral "{{count}} ta …" (Uzbek CLDR has only one/other).

## Strings I am unsure of

- `visaroute:staff.appointment` — "Navbat sanasi" (embassy appointment slot); KO says 신청일 (application date), EN says Appointment. Followed EN.
- `visaroute:staff.post` — "Vakolatxona" for a diplomatic post; "Konsullik" is narrower but more familiar.
- `university:v8.pr.inactive` — "Hozir oʻqitilmaydi" avoids "taklif" (reserved for admission offer); a console admin might expect "Faol emas".
- `marketing:v20.city.Seoul.body` kept verbatim with V27 transliterations (Xikseok, Gvanak); see V27 note on Latin romanization.
- `agency:misc.breadcrumb` — "Navigatsiya yoʻli" (screen-reader label); no settled Uzbek UI term.

## Counts

- Job keys: 354
- Kept verbatim: 29
- Rewritten (had a current translation): 95
- Newly translated: 230

## Second pass (jobs2)

Input `scripts/i18n/v28/jobs2/uz.json` (leak families the crawl missed: blockers, waiting lines, empty states, submission queue, outcomes). Output `scripts/i18n/v28/tx2/uz.json`. Same personas, glossary and passes as above; terms kept identical (ariza, muddat, apostil, konsullik legalizatsiyasi, Hangyul jamoasi, masʼul, yotoqxona, qabul davri, esse in console, Yozma ishlar in the student app). Orthography: ʻ (U+02BB) / ʼ (U+02BC) only; checked no ' ‘ ’ remain.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=uz` → 482 valid, 1 problem: `success:agency.questions.too_few` reported as "plural form without agency.questions.too_other". This is a validator false positive (the key ends in `_few` but is not a plural form); the key is translated and valid otherwise. validate.mjs was not edited (shared).

### Counts

- Job keys: 482 (marketing 2, success 204, dossier 27, agency 215, university 34)
- Kept verbatim: 0 (every `current` was null)
- Rewritten: 0
- Newly translated: 482
- Passes: A meaning 9 changed · B naturalness 7 · C UI/brevity/one term 6 · Final 3

### Examples (English leak → uz)

| Key | Before (EN shown on uz page) | After |
|---|---|---|
| `agency:v15.readiness.blocker.document_legalization` | {{detail}} needs an apostille or consular legalization | {{detail}} uchun apostil yoki konsullik legalizatsiyasi kerak |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. | Boshqa universitetga yozilgan esse rad etilishning eng koʻp uchraydigan va eng oson oldini olsa boʻladigan sababidir. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. … | Bu fayllarni faqat siz va Hangyul jamoasi koʻra oladi. … (student-facing: "your counselor" → Hangyul jamoasi per brief) |
| `success:queue.detail.mechanismText` | Open the official portal in your own browser … | Rasmiy portalni oʻz brauzeringizda oching va agentligingizning oʻz akkaunti bilan oʻsha yerda topshiring. … |
| `university:v22.empty.enrolment` | Nobody is between offer and enrolment right now. | Hozir taklif va oʻqishga kirish orasida hech kim yoʻq. |

### Marketing scorecard (2 keys, `v20.uni.intl.*`)

| Key | Clarity | Trust | Natural | Brevity | CTA | Fit | Total |
|---|---|---|---|---|---|---|---|
| officeLine — *Xalqaro boʻlim bor va u bilan alohida bogʻlanish mumkin.* | 5 | 5 | 4 | 5 | 3 | 5 | 27 |
| none — *Hangyul bu universitet saytida xorijiy talabalar uchun alohida sahifani hali topmadi. Quyidagi rasmiy saytdan boshlang.* | 5 | 5 | 4 | 4 | 5 | 4 | 27 |

First drafts ("…oʻz aloqa yoʻli bor", 22) were calques and were rewritten.

### Unsure

- `dossier:upload.status.NEEDS_REVIEW` *koʻrikdagi* / `UPLOADED` *yuklangan* / `NEEDS_CORRECTION` *qaytarilgan*: EN/KO are empty (no adjective shown); the validator requires a non-empty value ≤ 12 chars, so short adjectives that fit `upload.haveTitle` were used. This adds a word EN does not show.
- `agency:ws.level.ASSOCIATE` *Kichik bakalavr (kollej)*: Uzbekistan has no exact associate degree.
- `success:queue.fixture` kept *Fixture* (test-data marker, Latin).
- `agency:ws.by.OPERATIONS_OVERRIDE` *Hangyul operatsiyalari (qoʻlda oʻzgartirish)*: "override" has no short native term.
- `university:outcomes.retention` *Saqlanish*: understandable to admissions staff but literal; *Oʻqishda qolish* is an alternative.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
