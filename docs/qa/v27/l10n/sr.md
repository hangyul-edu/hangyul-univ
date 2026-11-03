# V27 l10n review: sr (Српски, ћирилица)

Scope: all 729 strings in `scripts/i18n/v27/strings.json` (215 new, 514 changed; changed strings were retranslated
from the new English, not patched). Output: `scripts/i18n/v27/tx/sr.json`. Script: **Cyrillic**, matching the existing
`packages/i18n/locales/sr/` bundle. Variant: ekavian standard Serbian. Brand and test names stay in Latin script,
as the existing bundle already does («Hangyul Univ», «Hangyul-а»).

## Personas

1. **Милица, 19, Нови Сад.** Applying for undergraduate studies (основне студије), probably starting with Korean at a
   university language centre. Reads on her phone.
2. **Стефан, 27, инжењер из Београда.** Applying for a master's in English. Wants exact visa and document terms
   (апостил, конзуларна легализација).
3. **Милицина мајка, 50.** Pays the tuition. Checks fees, refunds and who receives the money, and distrusts big
   promises.

## Glossary

| English | Korean | Serbian |
|---|---|---|
| scholarship | 장학(금) | стипендија |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Стипендија корејске владе (GKS) |
| admission guide | 모집요강 | правила уписа (existing nav term) |
| apostille | 아포스티유 | апостил (existing) |
| Apostille Convention | 아포스티유 협약 | Хашка конвенција о апостилу |
| consular legalization | 영사확인 | конзуларна легализација |
| Korean language institute | 어학당 | језички центар при универзитету (existing) |
| admission letter | 표준입학허가서 | (стандардно) писмо о пријему (existing) |
| CCVI | 사증발급인정서 | потврда о одобрењу издавања визе (CCVI) |
| residence card | 외국인등록증 | боравишна картица (existing) |
| immigration office | 출입국관리사무소 | имиграциона канцеларија |
| counselor | 상담사 | саветник (existing) |
| the Hangyul team | 한귤 상담팀 | тим Hangyul |
| plan (paid) | 플랜 | план (existing) |
| matches | 매칭 | подударања (existing: «Снажно подударање») |
| Recommended (sort) | 추천순 | Препоручено (explained as «није рангирање») |
| deadline | 마감일 | рок |
| tuition | 등록금 | школарина |
| proof of funds | 재정 증명 | доказ о средствима |
| bank balance certificate | 잔고증명서 | потврда банке о стању на рачуну |
| TB certificate | 결핵 진단서 | потврда о тесту на туберкулозу |
| transcript | 성적표 | препис оцена |
| Bachelor's / Master's / Doctorate | 학사 / 석사 / 박사 | основне / мастер / докторске студије |
| upload | 업로드 | отпремити (existing) |
| Writing / Messages (sections) | 글쓰기 / 메시지 | «Писање» / «Поруке» (existing nav terms) |

## Pass A: meaning (3 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| visaroute:reason.GET_LATER | …да би још важио {{appointment}}. | …да би још важио на дан {{appointment}}. (the date was dangling) |
| marketing:v20.uni.why.breadthBody | …за анкету {{year}}. | …у истраживању за {{year}}. годину. |
| common:fit.reason.unverifiedIeqas | Сертификован за међународно образовање. | Универзитет има сертификат за међународно образовање. (subject was unclear) |

## Pass B: native naturalness and orthography (13 strings changed)

| Key | Before | After |
|---|---|---|
| student:v27.doc.notarization (+3 more) | Потребна је оверa… | Потребна је овера… (a Latin «a» inside a Cyrillic word, found by a mixed-script scan; also «Свaки», «вашe», «оверe») |
| marketing:v7.why.arrive.text | …средјено пре него што слетите. | …сређено пре него што слетите. |
| marketing:hero.lede / home.hero.lede | припремите свако документо | припремите сва документа (wrong noun form) |
| common:uni27.cat.DEPARTMENT | Стипендије департмана | Стипендије одсека (term used by most Serbian universities) |
| mobile:v3.documents.legalize | Проверено, али је потребно још: {{path}}, да би га… | Проверено, али да би га корејски универзитет прихватио, потребно је још: {{path}} |

## Pass C: UI context & brevity (4 strings changed, all listed)

| Key | Before | After |
|---|---|---|
| marketing:home.show.match.p1 | Испуњава, близу или још не, за сваки програм | Испуњено, близу или још не, за сваки програм |
| visaroute:docStatus.NEAR_EXPIRY | Спремно, ускоро обновити | Спреман, ускоро обновите (gender agrees with «документ»; matches EXPIRED) |
| visaroute:reason.READY | Спремно. Користи се какав јесте. | Спреман. Користи се такав какав јесте. |
| common:fit.tier.CHALLENGE.short | Вреди погледати | Вреди видети (shorter chip, distinct from the title) |

## Final comparison

I compared every source and target string by script and by reading them. All placeholders, `<em>` tags, numbers
(1,500 → 1.500 in Serbian notation), test names, GKS/CCVI/CHSI/D-2/D-4, the e-mail address and the emergency
numbers survive. A mixed-script scan (Cyrillic words containing Latin letters) now returns 0. No admission guarantees
or probabilities were introduced. Plural keys use a count-neutral layout, so they read correctly for 1, 2–4, 5+ and
21. Validator: 719 valid. The 10 remaining reports are `fit.test.*` names kept in Latin script (see below).

## Unsure

- `fit.test.*` (10 keys) stay identical to English (Latin script) as the brief requires. `validate.mjs` reports them as
  "not in the locale's script". They are interpolated inline, so a Cyrillic prefix would break sentences. The
  validator needs an exemption.
- `uni27.schol.count_one` / `fit.unlock_one` hard-code "1". Serbian plural rules select `_one` for 21, 31…, so
  those counts would show "1". This needs a source fix.
- `fit.level.ASSOCIATE` = «Струковне студије» is the closest Serbian equivalent of a 2–3-year Korean 전문학사. It
  is not an exact match.
- The government tier names «консалтинг» / «одлична» are not established Serbian terms.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → За пријаву није потребан језички резултат. После уписа биће вам потребан {{tests}} или више.
- `fit.reason.far` → Потребан је {{options}} или више, што је знатно изнад вашег тренутног резултата.
- `fit.tier.UNCLEAR.title` → Засад је пут још дуг
- `fit.tier.UNCLEAR.short` → Више припреме
- `fit.tier.UNCLEAR.lede` → Ваш тренутни резултат је знатно испод објављеног услова. Одвојите више времена за припрему, па проверите поново.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
