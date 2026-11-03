# V29 service-contract l10n record — ur (Urdu)

Job: `scripts/i18n/v28/jobs-v29/ur.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/ur.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ur` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: Lahore intermediate student (18), mobile
- Comparison shopper: والدین comparing plan scope and extra costs
- MS applicant (26) needing documents and visa only

## Key term decisions

- No round limit within contracted documents: “معاہدے کی دستاویزات میں مرحلوں کی کوئی حد نہیں”; long form “بشرطیکہ کام معاہدے میں شامل درخواستی دستاویزات اور شیڈول کے اندر ہو”. Never “لامحدود”.
- Up to N managed applications: “زیادہ سے زیادہ N درخواستوں کا انتظام” (row “زیرِ انتظام درخواستیں”) vs “تجویز کردہ یونیورسٹیاں”.
- Custom quote: “علیحدہ قیمت بتائی جائے گی”.
- Airport pickup arrangement: “ایئرپورٹ پک اپ کا انتظام” via a partner transport company.
- Plan = پلان; 첨삭 = اصلاح; round = مرحلہ. RLM (U+200F) prefixed where a string starts with Latin (Premium/Basic/Hangyul), as in existing ur strings; Urdu ۔ and ، used.

## Glossary

| Concept | Korean (canonical) | ur |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | معاہدے کی دستاویزات میں مرحلوں کی کوئی حد نہیں |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | ‏Premium میں اصلاح کے مرحلوں کی کوئی حد نہیں، بشرطیکہ کام معاہدے میں شامل درخواستی دستاویزات اور شیڈول کے اندر ہو۔ |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | معاہدے میں شامل درخواستی دستاویزات کی اصلاح، مرحلوں کی کوئی حد نہیں |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | زیادہ سے زیادہ 2 یونیورسٹی درخواستوں کا انتظام |
| Applications managed (row) | 대학 지원 관리 | زیرِ انتظام درخواستیں |
| Universities recommended (row) | 추천 대학·어학당 | تجویز کردہ یونیورسٹیاں |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | زیادہ سے زیادہ 3 یونیورسٹیوں یا کورین زبان کے اداروں کی تجویز |
| Custom quote | 별도 견적 | علیحدہ قیمت بتائی جائے گی |
| Airport pickup arrangement | 공항 픽업 연결 | ایئرپورٹ پک اپ کا انتظام |
| Pickup note | 제휴 운송 업체를 연결 | ایئرپورٹ پک اپ کا انتظام ہماری شراکت دار ٹرانسپورٹ کمپنی کے ذریعے کیا جاتا ہے۔ |
| Visa decision | 발급 여부는 해당 기관이 결정 | ویزا سپورٹ کا مطلب تیاری اور درخواست میں مدد ہے؛ فیصلہ متعلقہ ادارہ کرتا ہے۔ |
| Additional service | 추가 서비스 | اضافی سروسز |
| Mock interview | 모의 면접 | فرضی انٹرویو |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | ذاتی بیان اور تعلیمی منصوبے کی اصلاح |
| Editing round | 1회 (첨삭) | 1 مرحلہ |
| Dormitory | 기숙사 | ہاسٹل |
| Settling in | 정착 지원 | بسنے میں اضافی مدد |
| Consultation support period | 상담 지원 기간 | مشاورت کی مدت |
| Contract term | 계약 기간 | معاہدے کی مدت |
| Priority response | 우선 응대 | ترجیحی جواب |
| Dedicated team | 전담 팀 | مخصوص ٹیم · ترجیح |
| Responsible team follow-up | 담당 팀 후속 지원 | ذمہ دار ٹیم کا فالو اپ |
| Agreed scope | 협의한 범위 | طے شدہ دائرہ کار |
| Before you buy | 이용 안내 | خریدنے سے پہلے |
| Decline add-on | 괜찮아요 | نہیں، شکریہ |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “لامحدود اصلاح” → “مرحلوں کی کوئی حد نہیں” + contracted-documents scope
- Draft “3 یونیورسٹیوں میں داخلہ” → “3 درخواستوں کا انتظام”
- Draft “ایئرپورٹ سے لے جانا” → “ایئرپورٹ پک اپ کا انتظام”
- Draft visa wording → “فیصلہ متعلقہ ادارہ کرتا ہے”
- Draft “آپ کا کونسلر” → “آپ کی ٹیم”

**Pass B — native naturalness** — 3 strings changed during the pass.

- “نہیں کہنا کچھ نہیں بدلتا” → “انکار سے کچھ نہیں بدلتا”
- “منصفانہ قیمت” → “مناسب قیمت”
- “شکریہ متفق ہونے کا” → “رضامندی کا شکریہ”
- “بسنا” in status heading → “آمد اور بسنا” (matches existing settlement term)
- “ٹائم” → “وقت/شیڈول”

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile CONTRACTED_DOCUMENTS long → “معاہدے کی دستاویزات میں مرحلوں کی حد نہیں”
- mobile TEAM → “ٹیم کا فالو اپ”
- تجاویز/سفارشات mixed → تجویز throughout for recommendations
- status APPROVED “منظور شدہ” → “فعال”
- row.dedicated → “مخصوص ٹیم · ترجیح”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| why.s3 | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

## Unsure

- Mixed Latin/Arabic bidi in “{{from}} سے {{to}} پر” depends on plan names rendering; RLM not added before placeholders.
- “مرحلہ” for editing round may read as ‘stage’; alternative “بار”.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
