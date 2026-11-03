# V29 service-contract l10n record — uk (Ukrainian)

Job: `scripts/i18n/v28/jobs-v29/uk.json` (158 keys, all `current: null`) → `scripts/i18n/v28/tx-v29/uk.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=uk` → 164 strings valid, 0 problems (EXIT=0). Not applied.

## Personas

- First-time visitor: випускник школи з Києва (18), mobile
- Comparison shopper: батьки, які порівнюють тарифи й додаткові витрати
- Магістрант (25), якому потрібні лише документи та віза

## Key term decisions

- No round limit within contracted documents: “Без обмеження раундів у межах документів за договором”; long form adds “і графіка подання, визначених договором”. Never “необмежене редагування”.
- Up to N managed applications: “Супровід до N заявок” (row “Заявки під нашим супроводом”) vs “Рекомендовані університети”/“до N рекомендацій”.
- Custom quote: “Індивідуальний розрахунок”.
- Airport pickup arrangement: “Організація зустрічі в аеропорту”; note: organised by a partner carrier.
- Plan = тариф (v15.pricing); 첨삭 = редагування; personal statement = мотиваційний лист. Plural extras added: supportDays/followUpOnce/rounds _few and _many (base key = one form).

## Glossary

| Concept | Korean (canonical) | uk |
|---|---|---|
| Contracted-docs no round limit (card) | 계약 서류 안에서 횟수 제한 없음 | Без обмеження раундів у межах документів за договором |
| Premium scope note | 계약한 지원 서류와 지원 일정 안에서 횟수 제한 없이 | Редагування в Premium не обмежене кількістю раундів у межах документів і графіка подання, визначених договором. |
| Premium feature f3 | 계약한 지원 서류 첨삭 · 횟수 제한 없음 | Редагування документів за договором без обмеження раундів |
| Up to N managed applications | 대학 지원 최대 2곳 관리 | Супровід до 2 заявок до університетів |
| Applications managed (row) | 대학 지원 관리 | Заявки під нашим супроводом |
| Universities recommended (row) | 추천 대학·어학당 | Рекомендовані університети |
| Recommend up to 3 | 대학·어학당 최대 3곳 추천 | До 3 рекомендованих університетів чи мовних інститутів |
| Custom quote | 별도 견적 | Індивідуальний розрахунок |
| Airport pickup arrangement | 공항 픽업 연결 | Організація зустрічі в аеропорту |
| Pickup note | 제휴 운송 업체를 연결 | Зустріч в аеропорту організовує наш партнерський транспортний перевізник. |
| Visa decision | 발급 여부는 해당 기관이 결정 | Візова підтримка — це допомога з підготовкою та поданням; рішення ухвалює відповідний орган. |
| Additional service | 추가 서비스 | Додаткові послуги |
| Mock interview | 모의 면접 | Пробна співбесіда |
| Statement & study-plan editing | 자기소개서·학업계획서 첨삭 | Редагування мотиваційного листа й плану навчання |
| Editing round | 1회 (첨삭) | 1 раунд |
| Dormitory | 기숙사 | Гуртожиток |
| Settling in | 정착 지원 | Додаткова допомога з облаштуванням |
| Consultation support period | 상담 지원 기간 | Період консультацій |
| Contract term | 계약 기간 | Строк договору |
| Priority response | 우선 응대 | Пріоритетна відповідь |
| Dedicated team | 전담 팀 | Окрема команда · пріоритет |
| Responsible team follow-up | 담당 팀 후속 지원 | Супровід відповідальної команди |
| Agreed scope | 협의한 범위 | Погоджений обсяг |
| Before you buy | 이용 안내 | Перед покупкою |
| Decline add-on | 괜찮아요 | Ні, дякую |

Plan names stay Latin (Basic, All-in-One, Premium) as in `common.json v29.pricing.<slug>.name`; brand is “Hangyul Univ” / “Hangyul” in Latin.

## Passes

**Pass A — meaning vs Korean** — 4 strings changed during the pass.

- Draft “Необмежене редагування” → “Редагування документів за договором без обмеження раундів”
- Draft “Подання до 3 університетів” → “Супровід до 3 заявок”
- Draft “Трансфер з аеропорту” → “Організація зустрічі в аеропорту”
- Draft “Отримання візи” → “рішення ухвалює відповідний орган”
- mobile “Без ліміту в межах договору” → “Без ліміту раундів за договором”

**Pass B — native naturalness** — 3 strings changed during the pass.

- “Сказати ні нічого не змінює” → “Відмова нічого не змінює”
- “1 організація” (unit) → “1 раз”
- “Справедлива ціна” → “Чесна ціна”
- “залишилось {{count}} днів” (plural risk) → “залишилося днів: {{count}}” (number-agnostic)
- “Апгрейд” → “перехід” (на інший тариф)

**Pass C — UI brevity, one term per concept** — 2 strings changed during the pass.

- mobile termToAgree long → “Погодимо на старті”
- mobile TEAM → “Супровід команди”
- settlement value “днів … днів” → “Від {{before}} дн. до приїзду до {{count}} дн. після” (abbrev. avoids plural mismatch)
- mixed заявка/заява → заявка = university application; заява = dormitory form/unit
- compare.value.yes “Включено” → “Входить”

## Marketing scorecard (30-point: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| why.s1 | 5 | 4 | 4 | 4 | 4 | 5 | 26 |
| why.s3 | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

## Unsure

- “Раунд” for editing round is understood but slightly anglicised; alternative “етап правок”.
- “До {{count}} раунду” for count=1 and _other (fractional) uses genitive singular — grammatical but rare.
- Strings with {{count}} but no plural key use “днів: {{count}}” / “дн.” to stay correct for every number.

## Counts

- Job keys: 158; strings written: 164 (incl. 6 extra CLDR plural forms)
- Kept verbatim from `current`: 0 (none existed)
- Rewritten: 0
- Newly translated: 158

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
