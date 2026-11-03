# V29 l10n record — sr (Serbian (Cyrillic))

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/sr.json` → `scripts/i18n/v28/tx-v29/sr.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=sr` → 0 problems.

## Personas

- Матурант (19) из Новог Сада који први пут истражује студије у Кореји
- Родитељ који пореди три пакета и тражи шта није укључено
- Кандидаткиња за мастер (25) која жели да зна колико кругова исправки добија

## Key term decisions

- **No round limit within the contracted documents**: "Без ограничења кругова за уговорена документа"; напомена: "у оквиру уговорених докумената за пријаву и распореда". Без "неограничено".
- **Up to N managed applications**: "Водимо до N пријава на универзитете" (ред: "Пријаве које водимо") — одвојено од "Препоручени универзитети".
- **Custom quote**: "Понуда по мери".
- **Airport pickup arrangement**: "Организовање дочека на аеродрому"; напомена: "преко партнерске превозничке фирме".
- **Plurals**: `_one` (основни кључ), `_few`, `_other` (дан/дана/дана; круга/круга/кругова исправки; накнадна/-е/-их консултација).
- **Day counts**: "Дана од прве консултације: {{count}}" — support_window_days is 1 or 3 (packages/types/src/plans.ts) and the job has no plural pair for these keys.

## Glossary

| Concept | EN | sr |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Све из Basic · до 5 препорука |
| No round limit within contracted documents | No round limit within your contracted documents | Без ограничења кругова за уговорена документа |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | У пакету Premium исправке немају ограничење броја кругова, у оквиру уговорених докумената за пријаву и распореда. |
| Up to N managed applications | Up to 2 university applications managed | Водимо до 2 пријаве на универзитете |
| Applications managed (row) | Applications managed | Пријаве које водимо |
| Universities recommended (row) | Universities recommended | Препоручени универзитети |
| Custom quote | Custom quote | Понуда по мери |
| Airport pickup arrangement | Airport pickup arrangement | Организовање дочека на аеродрому |
| Pickup note | Airport pickup is arranged through a partner transport provider. | Дочек на аеродрому организујемо преко партнерске превозничке фирме. |
| Diagnostic consultation | Schedule the diagnostic consultation | Заказати дијагностичку консултацију |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} накнадна консултација |
| Statement & study-plan editing | Statement & study-plan editing | Мотивационо писмо и план студија |
| Editing round | 1 round | 1 круг |
| Mock interview | Mock interview | Пробни разговор |
| Dormitory | Dormitory | Студентски дом |
| Settling in | Arrival & settling in | Долазак и сналажење |
| Additional service (add-on) | Additional services | Додатне услуге |
| Agreed scope | Agreed scope | Договорени обим |
| Dedicated team · priority | Dedicated team · priority | Ваш тим · приоритет |
| Priority response | Priority response | Приоритетни одговори |
| Contract term | Contract term | Трајање уговора |
| Service period | Service period | Период услуге |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | Подршка за визу значи помоћ у припреми и подношењу захтева; одлуку доноси надлежни орган. |
| Upgrade | Ask the team about upgrading | Питајте тим о промени плана |
| Not included / Included | Not included | Није укључено |
| Notarization | Writing a new document, translation and notarization may cost extra. | Писање новог документа, превод и овера код јавног бележника могу се додатно наплатити. |

## Review passes

### Pass A — meaning vs Korean — 4 strings changed

- "{{count}} дана од прве консултације" → "Дана од прве консултације: {{count}}"
- "Неограничене исправке" → "…без ограничења броја кругова"
- "Пријава на 2 универзитета" → "Водимо до 2 пријаве на универзитете"
- "Дочек на аеродрому" → "Организовање дочека на аеродрому"
- "одлуку доноси орган" → "одлуку доноси надлежни орган"

### Pass B — native naturalness — 3 strings changed

- "Фер цена" → "Поштена цена"
- "нотаризација" → "овера код јавног бележника"
- "Не хвала" → "Не, хвала"
- "Износ наплаћен са картице" → "Износ који се скида са картице"
- "оверa" (латинично a) → "овера" (исправљено писмо)

### Pass C — UI brevity / one term per concept — 2 strings changed

- "Уређивање мотивационог писма и плана студија" → ред: "Мотивационо писмо и план студија"
- "{{count}} укључено" → "Укључено: {{count}}"
- "Договарамо заједно на почетку услуге" → мобилно: "Договара се на почетку"
- "Подршка задуженог тима" → мобилно: "Подршка тима"
- "Дом" / "Студентски дом" → "Студентски дом" у редовима, "дом" у кратким картицама

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "исправке" за 첨삭 (постојећи бундл користи "уређивање").
- "сналажење" за 정착.
- "Језички центар" (постојећи термин) за 어학당 — на картици: "језичка центра".

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 3 (_few)

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
