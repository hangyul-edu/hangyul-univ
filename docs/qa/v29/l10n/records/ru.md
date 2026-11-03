# V29 l10n record — ru (Russian)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/ru.json` → `scripts/i18n/v28/tx-v29/ru.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ru` → 0 problems.

## Personas

- Выпускник школы (18) из Казани, впервые изучающий учёбу в Корее
- Родитель, сравнивающий три тарифа и ищущий скрытые расходы
- Абитуриент магистратуры (26), которому важно, сколько кругов правок входит

## Key term decisions

- **No round limit within the contracted documents**: "Без ограничения кругов для документов по договору"; примечание: "число кругов правок не ограничено в пределах документов и графика подачи, указанных в договоре". Слово "безлимитно" не используется.
- **Up to N managed applications**: "Сопровождаем до N заявок в вузы" (строка: "Заявки с сопровождением") — отдельно от "Рекомендуем до N вузов" / "Рекомендуемые вузы".
- **Custom quote**: "Индивидуальный расчёт".
- **Airport pickup arrangement**: "Организация встречи в аэропорту"; примечание: "организует наш партнёр-перевозчик".
- **Plurals**: `_one` (базовый ключ), `_few`, `_many`, `_other` (день/дня/дней/дня; круга/кругов/кругов/круга правок).
- **Day counts**: "Дней с первой консультации: {{count}}", "осталось дней: {{count}}" — support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.

## Glossary

| Concept | EN | ru |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Всё, что в Basic · до 5 рекомендаций |
| No round limit within contracted documents | No round limit within your contracted documents | Без ограничения кругов для документов по договору |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | В Premium число кругов правок не ограничено в пределах документов и графика подачи, указанных в договоре. |
| Up to N managed applications | Up to 2 university applications managed | Сопровождаем до 2 заявок в вузы |
| Applications managed (row) | Applications managed | Заявки с сопровождением |
| Universities recommended (row) | Universities recommended | Рекомендуемые вузы |
| Custom quote | Custom quote | Индивидуальный расчёт |
| Airport pickup arrangement | Airport pickup arrangement | Организация встречи в аэропорту |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Встречу в аэропорту организует наш партнёр-перевозчик. |
| Diagnostic consultation | Schedule the diagnostic consultation | Назначить диагностическую консультацию |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} повторная консультация |
| Statement & study-plan editing | Statement & study-plan editing | Мотивационное письмо и учебный план |
| Editing round | 1 round | 1 круг правок |
| Mock interview | Mock interview | Пробное интервью |
| Dormitory | Dormitory | Общежитие |
| Settling in | Arrival & settling in | Приезд и обустройство |
| Additional service (add-on) | Additional services | Дополнительные услуги |
| Agreed scope | Agreed scope | По договорённости |
| Dedicated team · priority | Dedicated team · priority | Своя команда · приоритет |
| Priority response | Priority response | Приоритетные ответы |
| Contract term | Contract term | Срок договора |
| Service period | Service period | Срок услуги |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Визовая поддержка — это помощь с подготовкой и подачей; решение о визе принимает уполномоченный орган. |
| Upgrade | Ask the team about upgrading | Спросить команду о переходе |
| Not included / Included | Not included | Не входит |
| Notarization | Writing a new document, translation and notarization may cost extra. | Написание нового документа, перевод и нотариальное заверение могут оплачиваться отдельно. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "{{count}} дней с первой консультации" → "Дней с первой консультации: {{count}}"
- "Неограниченная правка" → "…без ограничения числа кругов"
- "Подача в 2 вуза" → "Сопровождаем до 2 заявок в вузы"
- "Без ограничений для документов" → "Без лимита кругов для документов по договору"
- "решение принимает орган" → "решение о визе принимает уполномоченный орган"

### Pass B — native naturalness — 3 strings changed

- "До 2 раундов редактирования" → "До 2 кругов правок"
- "Справедливая цена" → "Честная цена"
- "Нет спасибо" → "Нет, спасибо"
- "Сделать подготовку ясной и управляемой" → "…понятной и посильной"
- "Сумма, которую списывают с карты" → "Сумма списания с карты"

### Pass C — UI brevity / one term per concept — 3 strings changed

- "Дополнительные услуги" (кнопка) → "Посмотреть доп. услуги"
- "Дополнительная услуга" в ячейке → "Доп. услуга"
- "{{count}} включено" → "Включено: {{count}}"
- "Согласуем вместе при старте услуги" → моб.: "Согласуем при старте"
- "Пробное собеседование" → "Пробное интервью" (существующий термин)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "1 встреча" как единица встречи в аэропорту.
- "Обустройство" (существующий термин) для 정착.
- Названия тарифов латиницей без кавычек внутри фраз ("Всё, что в Basic").

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 6 (_few, _many)

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
