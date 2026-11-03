# V27 l10n review: uk (Українська)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 new, 514 changed; changed strings were retranslated
from the new English, not patched). Output: `scripts/i18n/v27/tx/uk.json`. I translated directly into Ukrainian and
did not adapt the Russian. Russianisms were avoided (e.g. «строк дії», not «термін дії» in the sense of validity;
«агенція», «посвідка на проживання», «застосунок»).

## Personas

1. **Олена, 18, Київ.** Applying for a bachelor's, probably via a language institute and a D-4-1 visa. Uses her
   phone and expects modern, friendly Ukrainian.
2. **Андрій, 26, інженер зі Львова.** Applying for a master's in English. Checks visa and document terms precisely.
3. **Наталія, 48, мама Олени.** Pays the tuition. Worries about scams, refunds and hidden fees, and wants
   plain, calm wording.

## Glossary

| English | Korean | Ukrainian |
|---|---|---|
| scholarship | 장학(금) | стипендія |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Стипендія уряду Кореї (GKS) |
| admission guide | 모집요강 | правила прийому |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консульська легалізація |
| Korean language institute | 어학당 | мовний інститут при університеті |
| admission letter / certificate of admission | 표준입학허가서 | (стандартний) лист про зарахування |
| CCVI | 사증발급인정서 | сертифікат підтвердження видачі візи (CCVI) |
| residence card | 외국인등록증 | посвідка на проживання (existing bundle term) |
| immigration office | 출입국관리사무소 | імміграційна служба |
| counselor | 상담사 | консультант |
| the Hangyul team | 한귤 상담팀 | команда Hangyul |
| plan (paid) | 플랜 | тариф |
| visa plan | 비자 준비 | план отримання візи |
| matches | 매칭 | підбір (програм) |
| Recommended (sort) | 추천순 | Рекомендовані (explained as «не рейтинг») |
| deadline | 마감일 | дедлайн (existing nav term) |
| proof of funds | 재정 증명 | підтвердження фінансів |
| bank balance certificate | 잔고증명서 | банківська довідка / довідка про залишок |
| TB certificate | 결핵 진단서 | довідка про туберкульоз |
| tuition | 등록금 | плата за навчання |
| validity / expired | 유효기간 / 만료 | строк дії / строк минув |
| agency | 유학원 | агенція |
| Writing (section) | 글쓰기 | «Написання» (existing nav term) |
| Messages (section) | 메시지 | «Повідомлення» |

Test names stay in Latin script.

**Deviation from the existing bundle:** `legalization.CONSULAR_LEGALIZATION` was «Консульське засвідчення». It is now
«Консульська легалізація», the term Ukraine's Ministry of Foreign Affairs uses. «засвідчення» is closer to "consular
confirmation", which the brief rules out.

## Pass A: meaning (4 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| marketing:agencyNet.points.measured.text | …просто відсоток вступників… | …просто відсоток зарахованих… («вступники» = applicants, not admitted students) |
| marketing:agenciesPage.notAcceptance | …за відсотком вступників… | …за відсотком зарахованих… |
| mobile:student.nextAction.FINISH_APPLICATION | Завершіть заявку до {{university}}. | Завершіть заявку в {{university}}. («до» could be read as "before") |
| visaroute:caveat.LEGALIZATION_UNCLEAR | …перекладом чи консульською легалізацією… | …перекладеною копією чи консульською легалізацією… |

## Pass B: native naturalness (9 strings changed)

| Key | Before | After |
|---|---|---|
| common:matchReason.LANGUAGE_GAP_SMALL | …ви можете пройти за вимогою | …ви можете відповідати вимозі |
| marketing:v15.pricing.lede | Виберіть, наскільки далеко ми вас супроводжуємо. | Виберіть, до якого етапу ми вас супроводжуватимемо. |
| dossier:page.method | …фото й скани-зображення… | …фото й скановані зображення… |
| mobile:student.profile.editOnWeb | Профіль редагується у вебверсії. | Редагувати профіль можна у вебверсії. |
| marketing:v7.why.text | Вступати з-за кордону — означає розбиратися з… | Вступ з-за кордону — це вимоги, апостилі, есе… |

## Pass C: UI context & brevity (4 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| visaroute:docs.readyCount | Готово: {{count}}, з них із ваших документів: {{reused}} | Готово: {{count}} (повторно з ваших документів: {{reused}}) |
| common:fit.tier.CHALLENGE.short | Придивитися | Варто глянути (chip reads as a state, not an order) |
| common:uni27.service.INTL_STUDENT_LOUNGE | Кімната іноземних студентів | Лаунж для іноземних студентів (the word Ukrainian universities use) |
| mobile:v3.tasks.empty.overdue | Прострочених немає. Чудово | Прострочених завдань немає. Чудово |

## Final comparison

I compared every source and target string by script and by reading them. All placeholders, `<em>` tags, numbers,
test names, GKS/CCVI/CHSI/D-2/D-4, the e-mail address and the emergency numbers survive. There are no additions or
omissions. No wording implies admission chances or guarantees. Plural keys use a count-neutral layout, so they read
correctly for 1, 2–4, 5+ and 21. Validator: 719 valid. The 10 remaining reports are `fit.test.*` names kept in Latin
script (see below).

## Unsure

- `fit.test.*` (10 keys) stay identical to English as the brief requires. `validate.mjs` reports them as "not in the
  locale's script". They are interpolated inline in other sentences, so a Cyrillic prefix would break the grammar.
  The validator needs an exemption.
- `uni27.schol.count_one` / `fit.unlock_one` hard-code "1". Ukrainian plural rules select `_one` for 21, 31…, so
  those counts would show "1". This needs a source fix (`{{count}}` in `_one`).
- `uni27.service.COUNSELING` («Консультації та підтримка»): the Korean is ambiguous between psychological
  counselling and advising.
- The government tier name 컨설팅 is rendered as «консалтинг», which is not an established Ukrainian term.
- The changed consular-legalization term (see above) should be applied consistently if the old bundle's other
  strings are touched later.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Для подання документів мовний сертифікат не потрібен. Після зарахування знадобиться {{tests}} або вище.
- `fit.reason.far` → Потрібен {{options}} або вище — це значно вище за ваш поточний результат.
- `fit.tier.UNCLEAR.title` → Поки що шлях іще довгий
- `fit.tier.UNCLEAR.short` → Потрібна підготовка
- `fit.tier.UNCLEAR.lede` → Ваш поточний результат значно нижчий за опубліковану вимогу. Закладіть більше часу на підготовку й перевірте знову.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
