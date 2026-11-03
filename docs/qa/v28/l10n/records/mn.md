# V28 localization review — Mongolian (mn, Cyrillic)

Output: `scripts/i18n/v28/tx/mn.json` (354/354 job keys). Validator: `node scripts/i18n/v28/validate.mjs --only=mn` → 354 valid, 0 problems.
Register (unchanged from V27): polite *Та*, instructions in -на уу / -аарай, verbal nouns on buttons ("Товлох", "Хадгалах"). Consoles: concise noun labels.
Placeholders: where a case ending would depend on the inserted word, the sentence is rephrased with a colon ("Элсэлтүүд: {{program}}", "хаагдах: {{date}}", "Оюутны өмнөөс байршуулах: {{name}}") instead of a hyphenated ending.
Mongolian CLDR has only `one`/`other`; no extra plural forms were added.

## Personas

1. **Номин, 18, Улаанбаатар** — first-time visitor; 12th-grader, TOPIK 2, reads on her phone, lands from a search result.
2. **Тэмүүлэн, 27, Дархан** — comparison shopper; master's applicant, IELTS 6.5, compares plans and university pages side by side with agency sites.
3. **Оюунчимэг, 47, Эрдэнэт** — Номин's mother and sponsor; needs plain, trustworthy money and document wording.
4. **Болормаа, 31** — agency counselor in Ulaanbaatar using the agency console daily (operational keys).

## Glossary (V27 terms reused; V28 additions marked +)

| English | Korean | Mongolian |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | Hangyul-ийн баг (never "зөвлөх тань") |
| scholarship | 장학금 | тэтгэлэг |
| GKS | 정부초청장학 | Солонгосын Засгийн газрын тэтгэлэг (GKS) |
| admission guide | 모집요강 | элсэлтийн журам |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консулын баталгаажуулалт |
| Korean language institute | 어학당 | солонгос хэлний төв |
| residence card | 외국인등록증 | (гадаад иргэний) бүртгэлийн үнэмлэх |
| tuition | 등록금 | сургалтын төлбөр |
| plan | 플랜 | багц |
| proof of funds | 재정 증명 | санхүүгийн нотолгоо |
| embassy / consulate | 대사관 / 영사관 | Элчин сайдын яам (ЭСЯ) / консулын газар |
| post (diplomatic) + | 공관 | төлөөлөгчийн газар |
| e-visa | 전자비자 | цахим виз |
| visa (genitive) + | 비자 | визийн (corrected from "визний") |
| program | 과정 / 모집 단위 | хөтөлбөр (one term; "мэргэжил" removed) |
| intake + | 모집 학기 | элсэлт |
| deadline + | 마감 | эцсийн хугацаа |
| offer (admission) + | 합격 | (элсэлтийн) санал |
| enrollment | 등록 / 입학 | элсэлт / элсэлтийн бүртгэл |
| case + | 케이스 | хэрэг |
| task + | 업무 / 할 일 | даалгавар |
| owner + | 담당자 | хариуцагч |
| consultation + | 상담 | зөвлөгөө |
| Writing (section) + | 글쓰기 | Бичвэр |
| dormitory | 기숙사 | дотуур байр |
| international office + | 국제교류처 | олон улсын харилцааны алба |
| Recommended (sort) | 추천순 | Санал болгосон (browsing order, not a ranking) |
| needs more preparation (far tier) | 준비가 더 필요 | Илүү бэлтгэл шаардлагатай |

## Pass A — meaning (22 strings changed)

Main issues: 13 strings still said "зөвлөх тань" (your counselor) → "Hangyul-ийн баг"; several `current` values no longer matched the rewritten English.

| key | before | after |
|---|---|---|
| concierge:help.route.HOUSING (+12 similar) | Таны зөвлөх | Hangyul-ийн баг |
| common:fit.tier.UNCLEAR.title | Одоогоор хол байна | Илүү бэлтгэл шаардлагатай |
| university:v22.stageHint.decision | Хүлээлгийн жагсаалтад — шийдвэр бидэнд үлдсэн | Хүлээлгийн жагсаалтад. Шийдвэр хараахан гараагүй |
| student:v9.announced.rule.STUDY_DEPOSIT_SCHEME | … солонгос хэлний мэдлэггүй оюутнууд … гаргаж авна. | Солонгос хэлний шалгалтын оноогүй … авахаар төлөвлөгдөж байна. |
| marketing:v20.uni.ctaTitle | Үүнийг нухацтай судлахад бэлэн үү? | Энд элсэх талаар бодож байна уу? |

## Pass B — native naturalness (18 strings changed)

| key | before | after |
|---|---|---|
| marketing:v20.uni.why.foundedBody | Энэ нь түүнийг … нэг болгодог. (calque) | Тиймээс энэ бүртгэлд буй харьцангуй эртний сургуулиудын нэг юм. |
| marketing:v15.pricing.lede | Зөвхөн оношилгоо, … ("diagnosis", medical) | Хэр их тусламж авахаа сонгоорой: анхан шатны үнэлгээ, … |
| student:settings.language.note | Зарим хэл машин орчуулга бөгөөд … | Зарим хэлийг машинаар орчуулсан бөгөөд хянаж байна. |
| visaroute:doc.other_passport_record.name | … (Гадаад хэргийн яамнаас) | … (Гадаад харилцааны яамнаас) |
| agency:review.verifyHint | … тэмдэглэ, … зөвшөөр (bare imperative) | … тэмдэглэнэ үү, … баталгаажуулна уу |

## Pass C — UI context, brevity, one term per concept (14 strings changed)

| key | before | after |
|---|---|---|
| mobile:v3.uni.decisionNow | ШИЙДВЭР | Шийдвэр |
| marketing:v24.uni.academicTitle | Мэргэжил ба кампус | Хөтөлбөр ба кампус |
| visaroute:form.source.missing | Hangyul-д алга | Бүртгэлд алга |
| marketing:seo.home.description | … давна — баталгаатай … (em dash) | … нэг дороос шийдээрэй. Баталгаатай мэдээлэл … |
| common:fit.tier.MEETS.lede | 2 sentences (old English) | Их сургууль бүрийн одоо нийтэлсэн шаардлагатай харьцуулсан. |

Also: all "визний" → "визийн"; new hyphenated endings on placeholders avoided by colon phrasing.

## Marketing scorecard (sections touched; clarity · trust · naturalness · brevity · CTA · cultural fit, 5 each)

| section | first draft | final | note |
|---|---|---|---|
| seo.home | 22 | 26 | em dash removed, ends on a benefit |
| v15.pricing (lede, f5, compare) | 21 | 26 | "оношилгоо" replaced, list made parallel |
| v20.city (Busan, Seoul line) | 24 | 26 | "амрахаар ирдэг", natural rhythm |
| v20.uni (cta, why.*, philosophy, office) | 22 | 25 | ctaTitle transcreated as a question; foundedBody de-calqued |
| v28.uni.why (english, gks, scholarships) | 24 | 26 | GKS glossary name, short headlines |
| v6.unis / journey / v9.faq / v23 / v10 / v12 | 24 | 25 | v6 title follows new neutral English |

## Strings I am unsure of

- `agency:ws.tab.essays` / `dossier:reason.ESSAY_TO_WRITE` — "Бичвэр" for the Writing section; the shipped student bundle may still label it "Эссэ", which would then need aligning.
- `university:v28.pipe.step.ACCEPTED` "Саналыг хүлээн авсан" vs `v22.in.chain` "хүлээн авах" — same concept, slightly different forms; acceptable but could be unified.
- `visaroute:staff.post` "Төлөөлөгчийн газар" — generic for embassy/consulate; staff may prefer "ЭСЯ / консул".
- `marketing:v20.uni.why.ieqasExcellent` "IEQAS: шилдэг" — no official Mongolian name for the grading.
- `agency:v27.stage.ARRIVAL` "Ирэлт" — short and correct, but slightly bureaucratic.

## Counts

- Job keys: 354
- Kept verbatim: 55
- Rewritten: 69
- Newly translated: 230

## Final comparison

All 354 source ↔ target pairs re-read side by side after Pass C. Placeholders identical (validator confirms); no "зөвлөх тань" left; far tier wording is "needs more preparation", no probability words; "тэнцэх" only where the English is about admission itself (`v22.in.q.admit`).

## Second pass (jobs2)

Scope: all 482 keys in `scripts/i18n/v28/jobs2/mn.json` (marketing 2, success 204, dossier 27, agency 215, university 34): conditional states the V28 crawl never recorded (waiting lines, blockers, ledes, empty states, the submission queue, the student workspace in the agency console, university outcomes). Output: `scripts/i18n/v28/tx2/mn.json`. Same personas (Номин, Тэмүүлэн, Оюунчимэг, Болормаа) and glossary as above; no new term choices. Every job key had `current: null`, so nothing was kept or rewritten.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=mn` → 482 valid, 1 problem: `success:agency.questions.too_few` is reported as "plural form without too_other". That is a validator false positive (the key name ends in `_few` but is a real job key, not a plural form); it is translated. validate.mjs is shared and was not edited.

Passes: A meaning (9 strings changed: e.g. `dossier:page.privacy` "your counselor" → "Hangyul-ийн баг" per the brief; consular legalization always "консулын баталгаажуулалт"); B naturalness (12: case endings that depended on a placeholder moved to the colon pattern); C UI brevity / one term (14: "журам" for guide everywhere, "эцсийн хугацаа" for deadline, "хураамж" for the application fee vs "төлбөр" for tuition/service fee); Final source ↔ target read-through (3).

| key | before (draft) | after |
|---|---|---|
| dossier:page.privacy | Зөвхөн та, таны зөвлөх болон Hangyul… | Эдгээр файлыг зөвхөн та болон Hangyul-ийн баг харна… |
| success:agencyItem.DOC_MISSING | {{label}} дутуу байна | {{label}}: дутуу |
| success:queue.detail.title | {{student}}-ийн өргөдлийг илгээх | Өргөдөл илгээх: {{student}} |
| agency:v27.guide.source | Албан ёсны гарын авлага | Албан ёсны журам |
| dossier:upload.status.NEEDS_CORRECTION | засвар шаардлагатай | засах (English is empty; must fit "{{status}} {{doc}}" and the 12-character limit) |

Marketing scorecard (clarity, trust, naturalness, brevity, CTA, cultural fit):

| key | score | note |
|---|---|---|
| v20.uni.intl.officeLine "Гадаад оюутнуудад зориулсан олон улсын харилцааны алба, тусдаа холбоо барих сувагтай." | 5·5·4·4·4·5 = 27 | factual card line; no CTA needed |
| v20.uni.intl.none "…Hangyul одоогоор олоогүй байна. Доорх албан ёсны сайтаас эхлээрэй." | 5·5·4·4·5·4 = 27 | honest "not yet found", clear next step |

Unsure (second pass):

- `dossier:upload.status.*` (English empty): "хянагдаж буй" / "байршуулсан" / "засах". Mongolian now shows a status word where English shows none; they could also be dropped if the empty English is intentional.
- `agency:ws.level.ASSOCIATE` "Дипломын" for an associate degree; Mongolia has no exact equivalent (коллежийн диплом).
- `university:outcomes.step.RETAINED` "Үргэлжлүүлж буй" / `outcomes.retention` "Үргэлжлүүлэлт": no settled Mongolian term for student retention.
- `success:queue.fixture` "Туршилтын" for "Fixture" (test data); staff may prefer "Тест".
- `success:agencyItem.BUDGET_OVER` "Эхний жил {{low}}-аас > төсөв {{budget}}": the suffix after a currency placeholder depends on the formatted amount.

Counts (second pass):

- Job keys: 482
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 482

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
