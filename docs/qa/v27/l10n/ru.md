# V27 l10n review: ru (Русский)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 new, 514 changed; changed strings were retranslated
from the new English, not patched). Output: `scripts/i18n/v27/tx/ru.json`. Russian is also the fallback for Uzbek,
Kazakh, Kyrgyz and Tajik readers, so the copy avoids Russia-specific references (no "вуз РФ", "ЕГЭ" or rouble amounts)
and uses neutral terms that CIS students know.

## Personas

1. **Алия, 18, Алматы.** Russian-speaking Kazakh school leaver applying for a bachelor's, starting at a language
   institute on a D-4-1 visa. Reads the app on her phone.
2. **Дмитрий, 27, инженер из Новосибирска.** Master's applicant. Compares programmes and costs, and wants precise
   visa and document terms.
3. **Гульнара, 46, мама Алии (Ташкент / Алматы).** Pays the tuition. Reads Russian as her second language, cares
   about money, refunds and safety, and distrusts promises.

## Glossary

| English | Korean | Russian |
|---|---|---|
| scholarship | 장학(금) | стипендия |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Стипендия правительства Кореи (GKS) |
| admission guide | 모집요강 | правила приёма |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консульская легализация |
| Korean language institute | 어학당 | языковой институт при университете |
| certificate of admission / admission letter | 표준입학허가서 | (стандартное) письмо о зачислении |
| CCVI | 사증발급인정서 | сертификат подтверждения выдачи визы (CCVI) |
| residence card | 외국인등록증 | ID-карта иностранца |
| immigration office | 출입국관리사무소 | иммиграционная служба |
| counselor | 상담사 | консультант |
| the Hangyul team | 한귤 상담팀 | команда Hangyul |
| plan (paid) | 플랜 | тариф |
| visa plan | 비자 준비 | план получения визы |
| matches | 매칭 | подбор (программ) |
| Recommended (sort) | 추천순 | Рекомендуемые (browsing order, explained as «не рейтинг») |
| offer | 합격 | предложение о зачислении / предложили место |
| deadline | 마감일 | дедлайн |
| proof of funds | 재정 증명 | подтверждение финансов |
| bank balance certificate | 잔고증명서 | справка о балансе / банковская справка |
| TB certificate | 결핵 진단서 | справка о туберкулёзе |
| tuition | 등록금 | плата за обучение |
| transcript | 성적표 | выписка оценок |
| Writing (section) | 글쓰기 | «Тексты» (existing nav term) |
| Messages (section) | 메시지 | «Сообщения» (existing nav term) |

Test names (TOPIK, TOEFL iBT, IELTS Academic, TEPS, New TEPS, TOEIC, Duolingo English Test, PTE Academic,
Cambridge English) stay in Latin script.

## Pass A: meaning (9 strings changed)

| Key | Before | After |
|---|---|---|
| common:fit.q.level | Куда вы хотите поступить? | На какую программу вы хотите поступить? (the options are study levels, not universities) |
| common:uni27.stage.ENROLLED | Студенты | Уже обучающиеся (contrast with «Поступающие» was lost) |
| common:matchReason.LANGUAGE_GAP_SMALL | …Пересдача может это исправить | …После пересдачи вы можете пройти по требованию |
| marketing:v8.work.writing.text | Каждое предложение вы принимаете… | Каждую правку вы принимаете… («предложение» also reads as "sentence") |
| student:…PROFILE_UNLOCK.gpa.text | Программ с минимальным баллом: {{count}} из {{total}}. | Минимальный балл указан у {{count}} из {{total}} ваших программ. |

## Pass B: native naturalness (24 strings changed; 2 of them, v15.pricing.lede and dossier:page.method, were caught while reviewing uk and fixed in ru as well)

| Key | Before | After |
|---|---|---|
| marketing:v10.account.continue | Продолжить с того места, где остановился | Продолжить подготовку (masculine verb form excluded female users) |
| marketing:agenciesPage.valueLede | Меньше напоминаний и погони за документами, больше консультаций. | Меньше рутины с напоминаниями, больше консультаций. |
| visaroute:route.processing | Срок рассмотрения — словами посольства | Срок рассмотрения (формулировка посольства) |
| student:v9.funds.longer_* | (оценка правительства «консалтинг») | (по государственной оценке — «консалтинг») |
| dossier:reason.NEAR_EXPIRY_DATE | Скоро получите обновлённый документ. | Оформите новый документ заранее. |

## Pass C: UI context & brevity (10 strings changed)

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.short | Сложно сказать | Сложно подтвердить (matches the title) |
| common:uni27.schol.all | Все стипендии | Смотреть все стипендии (link is an action) |
| common:fit.family.KOREAN / ENGLISH | По корейскому / По английскому | Корейский / Английский (chip labels) |
| common:uni27.link.kli | Языковой институт при университете | Языковой институт (link under the university's own page) |
| student:…ADMISSION_CERTIFICATE_ISSUED | Ваше письмо о зачислении готово. | Ваше стандартное письмо о зачислении готово. (same term as visaV2.whenText) |

## Final comparison

I compared every source and target string by script and by reading them. The script checked that all
`{{placeholders}}`, `<em>` tags, numbers, test names, GKS/CCVI/CHSI/D-2/D-4, the e-mail address and the emergency
numbers survive. It found no meaning gaps. The only hits were 9 false positives where the English word "Visa" is
correctly rendered as «виза». No string implies admission probability or a guarantee. «Рекомендуемые» is always
explained as a browsing order, not a ranking. Plural keys use a count-neutral layout («Нужен апостиль или
легализация: {{count}}»), so they read correctly for 1, 2–4, 5+ and 21. Validator: 719 valid. The 10 remaining
reports are `fit.test.*` names that the brief requires to stay in Latin script (see below).

## Unsure

- `fit.test.*` (10 keys: TOPIK, TOPIK IBT, TOEFL iBT, IELTS Academic, TEPS, New TEPS, TOEIC, Duolingo English Test,
  Cambridge English, PTE Academic) stay identical to English as the brief requires. `validate.mjs` reports them as
  "not in the locale's script". They are interpolated inline (`{{test}}` in fit.unlock, uni27.schol.unlockWith,
  uni27.intl.later…), so adding a Cyrillic word such as «экзамен TOPIK» would break those sentences. The script check
  needs an exemption for English-identical test names.
- `uni27.schol.count_one` / `fit.unlock_one` hard-code "1". Russian plural rules also select `_one` for 21, 31…, so
  those counts would show "1". The fix is in the source: put `{{count}}` in the `_one` strings.
- `uni27.service.COUNSELING` («Консультации и поддержка»): Korean 상담 지원 could mean psychological counselling or
  general advising.
- `v9.funds.longer_*`: the government tier name 컨설팅 is rendered as «консалтинг». The CIS student community has no
  settled term for it.
- `fit.levelValue.KING_SEJONG` («Учебник Sejong Korean {{level}}»): assumes the level refers to the Sejong Korean
  textbook series.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Для подачи документов языковой сертификат не нужен. После зачисления понадобится {{tests}} или выше.
- `fit.reason.far` → Нужен {{options}} или выше — это намного выше вашего текущего результата.
- `fit.tier.UNCLEAR.title` → Пока путь ещё долгий
- `fit.tier.UNCLEAR.short` → Нужна подготовка
- `fit.tier.UNCLEAR.lede` → Ваш текущий результат заметно ниже опубликованного требования. Заложите больше времени на подготовку и проверьте снова.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
