# V29 service-contract l10n record — tr (Turkish)

Job: `scripts/i18n/v28/jobs-v29/tr.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/tr.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=tr` → 158 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: İstanbul lise son sınıf öğrencisi (18) on mobile
- Comparison shopper: veli comparing package scope against local danışmanlık firms
- Yüksek lisans adayı (25) needing only documents and visa

## Key term decisions

- No round limit within contracted documents: “Sözleşmedeki belgelerde tur sınırı yok”; long form “sözleşmedeki başvuru belgeleri ve takvim kapsamında tur sınırı olmadan”. Never “sınırsız”.
- Up to N managed applications: “En fazla N (üniversite) başvurusunun yönetimi” vs recommendations “en fazla N öneri”.
- Custom quote: “Size özel fiyat teklifi”.
- Airport pickup arrangement: “Havalimanı karşılama ayarlaması” + note “anlaşmalı bir ulaşım firması aracılığıyla ayarlanır”.
- Plan = paket (v15.pricing); 첨삭 = düzeltme; personal statement = niyet mektubu; placeholders with suffixes avoided (“{{from}} paketinden {{to}} paketine”, “{{date}} tarihine kadar”).

## Glossary

| Concept | Korean (canonical) | tr |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | Sözleşmedeki belgelerde tur sınırı yok |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Premium'da düzeltme, sözleşmedeki başvuru belgeleri ve takvim kapsamında tur sınırı olmadan yapılır. |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | Sözleşmedeki başvuru belgelerinde tur sınırı olmadan düzeltme |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | En fazla 2 üniversite başvurusunun yönetimi |
| Applications managed (row) | 대학 지원 관리 | Yönetilen başvurular |
| Universities recommended (row) | 추천 대학·어학당 | Önerilen üniversiteler |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | En fazla 3 üniversite veya Korece dil enstitüsü önerisi |
| Custom quote | 별도 견적 | Size özel fiyat teklifi |
| Airport pickup arrangement | 공항 픽업 연결 | Havalimanı karşılama ayarlaması |
| Pickup note | 제휴 운송 업체를 연결 | Havalimanı karşılaması, anlaşmalı bir ulaşım firması aracılığıyla ayarlanır. |
| Visa decision | 발급 여부는 해당 기관이 결정 | Vize desteği, hazırlık ve başvuruda yardım demektir; karar yetkili makama aittir. |
| Additional service | 추가 서비스 | Ek hizmetler |
| Mock interview | 모의 면접 | Deneme mülakatı |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | Niyet mektubu ve çalışma planı düzeltmesi |
| Editing round | 1회 (첨삭) | 1 tur |
| Dormitory | 기숙사 | Yurt |
| Settling in | 정착 지원 | Ek uyum desteği |
| Consultation support period | 상담 지원 기간 | Danışmanlık süresi |
| Contract term | 계약 기간 | Sözleşme süresi |
| Priority response | 우선 응대 | Öncelikli yanıt |
| Dedicated team | 전담 팀 | Özel ekip · öncelik |
| Responsible team follow-up | 담당 팀 후속 지원 | Sorumlu ekip takibi |
| Agreed scope | 협의한 범위 | Kararlaştırılan kapsam |
| Before you buy | 이용 안내 | Satın almadan önce |
| Decline add-on | 괜찮아요 | Hayır, teşekkürler |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “sınırsız düzeltme” → “tur sınırı olmadan düzeltme”
- Draft “3 üniversiteye başvuru” → “En fazla 3 başvurunun yönetimi”
- Draft “havalimanı transferi” → “Havalimanı karşılama ayarlaması”
- Draft “vize desteği garantisi” tone → “karar yetkili makama aittir”
- mobile CONTRACTED_DOCUMENTS “sınır yok” → “tur sınırı yok”

**Pass B — native naturalness** — 3 strings changed during the pass.

- “Hayır demek hiçbir şey değiştirmez” → “Hayır demeniz hiçbir şeyi değiştirmez”
- “Adil fiyat” → “Makul fiyat”
- “Ödeme geçer geçmez” → “Ödeme tamamlanır tamamlanmaz”
- “{{from}}'dan {{to}}'ya” → “{{from}} paketinden {{to}} paketine”
- “Sorumlu takım” → “Sorumlu ekip” (matches Hangyul Univ ekibi)

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile TEAM “Sorumlu ekip takibi” → “Ekip takibi”
- mobile termToAgree long → “Hizmet başlarken belirlenir”
- mixed “mülakat/görüşme” for interview → mülakat = interview, görüşme = consultation
- row.dedicated → “Özel ekip · öncelik”
- compare.value.yes “Dahildir” → “Dahil”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 5 | 4 | 4 | 5 | 27 |
| why.s3 | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

## Unsure

- “Niyet mektubu” for 자기소개서 follows existing docCategory; some Turkish sites say “kişisel beyan”.
- “ayarlama” as the ARRANGEMENT unit (“1 ayarlama”) is a little technical.

## Counts

- Job keys: 158; strings written: 158
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
