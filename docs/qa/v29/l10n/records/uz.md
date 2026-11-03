# V29 service-contract l10n record — uz (Uzbek (Latin))

Job: `scripts/i18n/v28/jobs-v29/uz.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/uz.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=uz` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: Toshkent litsey bitiruvchisi (18), mobile
- Comparison shopper: ota-ona comparing tarif scope and third-party costs
- Magistratura nomzodi (24) needing documents and visa

## Key term decisions

- No round limit within contracted documents: “Shartnomadagi hujjatlarda bosqichlar cheklanmagan”; long form “shartnomadagi ariza hujjatlari va jadval doirasida cheklanmagan”. Never “cheksiz tahrir”.
- Up to N managed applications: “N tagacha (universitet) arizasini boshqarish” (row “Biz boshqaradigan arizalar”) vs “N tagacha tavsiya”.
- Custom quote: “Alohida narx taklifi”.
- Airport pickup arrangement: “Aeroportda kutib olishni tashkil qilish” through a partner transport company.
- Plan = tarif (v15.pricing); 첨삭 = tahrirlash; round = bosqich; apostrophes U+02BB (oʻ, gʻ) and U+02BC (maʼlumot) as in existing uz strings.

## Glossary

| Concept | Korean (canonical) | uz |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | Shartnomadagi hujjatlarda bosqichlar cheklanmagan |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Premium tarifida tahrirlash bosqichlari shartnomadagi ariza hujjatlari va jadval doirasida cheklanmagan. |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | Shartnomadagi ariza hujjatlarini tahrirlash, bosqichlar soni cheklanmagan |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | 2 tagacha universitet arizasini boshqarish |
| Applications managed (row) | 대학 지원 관리 | Biz boshqaradigan arizalar |
| Universities recommended (row) | 추천 대학·어학당 | Tavsiya etilgan universitetlar |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | 3 tagacha universitet yoki koreys tili instituti tavsiyasi |
| Custom quote | 별도 견적 | Alohida narx taklifi |
| Airport pickup arrangement | 공항 픽업 연결 | Aeroportda kutib olishni tashkil qilish |
| Pickup note | 제휴 운송 업체를 연결 | Aeroportda kutib olish hamkor transport kompaniyasi orqali tashkil qilinadi. |
| Visa decision | 발급 여부는 해당 기관이 결정 | Viza yordami — tayyorlash va ariza topshirishda koʻmak; qarorni vakolatli organ qabul qiladi. |
| Additional service | 추가 서비스 | Qoʻshimcha xizmatlar |
| Mock interview | 모의 면접 | Sinov suhbati |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | Shaxsiy bayonot va oʻquv rejasini tahrirlash |
| Editing round | 1회 (첨삭) | 1 bosqich |
| Dormitory | 기숙사 | Yotoqxona |
| Settling in | 정착 지원 | Joylashib olishda qoʻshimcha yordam |
| Consultation support period | 상담 지원 기간 | Maslahat davri |
| Contract term | 계약 기간 | Shartnoma muddati |
| Priority response | 우선 응대 | Ustuvor javob |
| Dedicated team | 전담 팀 | Alohida jamoa · ustuvorlik |
| Responsible team follow-up | 담당 팀 후속 지원 | Masʼul jamoa kuzatuvi |
| Agreed scope | 협의한 범위 | Kelishilgan hajm |
| Before you buy | 이용 안내 | Xarid qilishdan oldin |
| Decline add-on | 괜찮아요 | Yoʻq, rahmat |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “cheksiz tahrir” → “bosqichlar soni cheklanmagan” within contracted documents
- Draft “3 ta universitetga topshirish” → “3 tagacha arizani boshqarish”
- Draft “aeroportdan olib ketish” → “kutib olishni tashkil qilish”
- Draft visa wording → “qarorni vakolatli organ qabul qiladi”
- task.v29.studentPreArrival → “Koreyaga kelishga tayyorlaning”

**Pass B — native naturalness** — 3 strings changed during the pass.

- “{{date}} da tugagan” → “{{date}} kuni tugagan”
- “Yoʻq deyish hech narsani…” → “Rad etsangiz hech narsa oʻzgarmaydi”
- “Upgreyd” → “Tarifni oshirish”
- “Halol narx” → “Adolatli narx”
- “{{from}} dan {{to}} ga” → “{{from}} → {{to}}: nimalar oʻzgaradi” (no suffix on placeholder)

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS long → “Shartnoma hujjatlarida bosqich cheklanmagan”
- mobile TEAM → “Jamoa kuzatuvi”
- maslahat/konsultatsiya mixed → maslahat throughout
- status APPROVED “Tasdiqlangan” → “Faol”
- compare.value.yes → “Kiradi”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| why.s3 | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

## Unsure

- “{{date}} gacha” keeps a space between placeholder and suffix; native would attach it to the date.
- “Shaxsiy bayonot” vs “motivatsion xat” both exist in the app; used shaxsiy bayonot (docCategory).

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
