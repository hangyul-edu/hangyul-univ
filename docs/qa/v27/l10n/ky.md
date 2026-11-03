# V27 localization review — Kyrgyz (ky, Cyrillic)

Output: `scripts/i18n/v27/tx/ky.json` (727/727 keys of the current `strings.json`). Validator: `node scripts/i18n/v27/validate.mjs --only=ky` → 727 valid, 0 problems.
Register: polite *Сиз*, imperative CTAs in -ңыз/-ңүз ("текшериңиз", "жүктөңүз"), verbal nouns on buttons ("Сактоо", "… көрсөтүү"), as on Kyrgyz university and gov.kg pages.
Placeholders: Kyrgyz suffixes follow vowel harmony, so case endings are not glued to `{{university}}` / `{{country}}`; sentences use apposition, "{{country}} аймагында", "{{university}} окуу жайына", colon lists or parentheses instead.

## Personas

1. **Айпери, 18, Бишкек** — finishing school, wants a bachelor's in Korea, TOPIK 2, uses her phone for everything.
2. **Нурлан, 26, Ош** — software developer, master's applicant, IELTS 6.5, checks every requirement.
3. **Айпери's father, Бакыт, 50, Каракол** — sponsor, pays tuition and provides the bank certificate; needs clear money and visa wording.

## Glossary

| English | Korean | Kyrgyz rendering |
|---|---|---|
| scholarship | 장학(금) | стипендия |
| Global Korea Scholarship (GKS) | 정부초청장학 | Корея өкмөтүнүн стипендиясы (GKS) |
| admission guide | 모집요강 | кабыл алуу эрежелери |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консулдук легалдаштыруу |
| Korean language institute | 어학당 | (университеттин алдындагы) корей тили борбору |
| admission letter | 표준입학허가서 | кабыл алуу каты |
| residence card | 외국인등록증 | резидент картасы (existing bundle term) |
| tuition | 등록금 | окуу акысы |
| counselor | 상담사 | кеңешчи |
| Hangyul team | 한귤 상담팀 | Hangyul командасы |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | каражат бар экенин тастыктаган документ / банктагы калдык тууралуу маалымкат |
| embassy / consulate | 대사관 / 영사관 | элчилик / консулдук |
| immigration office | 출입국관리사무소 | иммиграция кеңсеси |
| CCVI | 사증발급인정서 | виза берүүнү ырастоочу күбөлүк (CCVI) |
| e-visa | 전자비자 | электрондук виза |
| TB certificate | 결핵 진단서 | кургак учук маалымкаты |
| notarized | 공증 | нотариалдык күбөлөндүрүлгөн |
| Recommended (sort) | 추천순 | Сунушталган (browsing order, not a rating) |
| account | 계정 | аккаунт |
| KRW amount | 원 | {{amount}} вон |
| My progress | 내 여정 | Даярдык жүрүшү |

## Pass A — meaning (7 strings changed)

| key | before | after |
|---|---|---|
| common:nav.journey | Менин жолум ("my journey", old meaning) | Даярдык жүрүшү |
| mobile:student.home.journey | Сиздин жолуңуз | Даярдыгыңыздын жүрүшү |
| mobile:v3.docAction.TOO_OLD | Өтө эрте берилген ("issued too early") | Берилгенине көп болуп калды. Жаңысын алыңыз |
| visaroute:state.IN_KOREA | Сиз Кореядасыз. … ("already" lost) | Сиз мурунтан эле Кореядасыз. … |
| marketing:illus.yourJourney | Сиздин жолуңуз | Даярдыгыңыздын жүрүшү |

## Pass B — native naturalness (18 strings changed)

Includes 8 date strings: a bare `{{date}} баштап` / `{{date}} чейин` lacks the case ending, so they became `{{date}} күнүнөн тартып` / `{{date}} күнүнө чейин`.

| key | before | after |
|---|---|---|
| common:fit.gpa.outOfScale | Бул маани {{max}} ашпашы керек. | Бул маани {{max}} маанисинен ашпашы керек. |
| dossier:reason.NEAR_TOO_OLD | … {{until}} кийин өтө эски болуп калат. | … {{until}} күнүнөн кийин өтө эски болуп калат. |
| student:v4.docs.essayWrite | … Жөнөтүүдөн мурун ({{university}}) Hangyul командасы … | … {{university}} окуу жайына жөнөтүүдөн мурун Hangyul командасы … |
| student:settings.data.done.EXPORT | Экспорт суралды. {{date}} чейин даяр болот | Экспорт суралды. {{date}} күнүнө чейин даяр болот |
| marketing:v7.apply.text | Мүмкүнчүлүгүңүз тууралуу убада жок. Болгону … даярдоо иши. | Мүмкүнчүлүгүңүз тууралуу убада бербейбиз. Болгону … даярдоого жардам беребиз. |

## Pass C — UI context, brevity, consistency (7 strings changed)

| key | before | after |
|---|---|---|
| common:fit.tier.CHALLENGE.short | Карап көрүңүз (an imperative on a status chip) | Карап көрүүгө арзыйт |
| common:fit.tier.MEETS.short | Талаптарга жооп берет | Талаптарга ылайык |
| student:legalFlow.note.JOINED | {{country}} {{date}} күнүнөн тартып … кошулду | {{country}} {{date}} күнү … кошулду |
| mobile:student.home.subtitle | … канчалык алдыга жылганы. | Кореяда окууга даярдыгыңыздын жүрүшү. (matches the nav term) |
| student:essay.saveError | … Интернетти текшериңиз | … Байланышты текшериңиз |

## Source change during the review (13 strings synced, not a review pass)

While this review ran, `strings.json` dropped `common:uni27.schol.count_one` and `common:fit.unlock_one` (now 727 keys), and `validate.mjs` started forcing every `fit.test.*` key to the bare source name in Latin script, for every locale. The draft's workaround ("TOPIK тести" etc., added only to pass the old Cyrillic-script check) is gone: all 13 `fit.test.*` values now equal the English source, so `ky.json` matches what will ship.

## Final comparison

All 727 source ↔ target pairs re-read side by side after Pass C. Placeholders and `<em>` tags identical; no admission-chance or guarantee wording; "Сунушталган" explained as a browsing order; one term per concept (стипендия, кабыл алуу эрежелери, апостиль, консулдук легалдаштыруу, корей тили борбору, аккаунт). Plural `_one` keys use count-neutral forms. Result: no remaining meaning differences found.

## Strings I am unsure of / deviations

- **Test names**: resolved by the validator change above. Note that `fit.test.KIIP`, `fit.test.KING_SEJONG` and `fit.test.UNIV_KLI` are descriptions rather than brand names and are now shown in English.
- **Consular legalization**: the existing bundle uses "Консулдук ырастоо" (= consular confirmation, which the brief forbids). V27 uses "консулдук легалдаштыруу", the Kyrgyz MFA term; older bundle keys will differ until they are re-done.
- **Residence card**: kept the bundle's "резидент картасы" for consistency, though "чет элдиктин каттоо картасы" is more descriptive.
- `fit.level.ASSOCIATE` — "Кесиптик диплом (associate)": Kyrgyzstan has no equivalent degree.
- `v9.funds.*` government tiers «консалтинг» / «мыкты» — no official Kyrgyz names exist.
- Korean place names (Хыксок, Тхонъён, Тхэхва, Пуё) use the Russian-style Kontsevich spelling usual in Kyrgyzstan.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Арыз берүү үчүн тил сертификаты талап кылынбайт. Окууга кабыл алынгандан кийин {{tests}} же андан жогору керек болот.
- `fit.reason.far` → {{options}} же андан жогору керек — бул азыркы жыйынтыгыңыздан алда канча жогору.
- `fit.tier.UNCLEAR.title` → Азырынча али алыс
- `fit.tier.UNCLEAR.short` → Көбүрөөк даярдык
- `fit.tier.UNCLEAR.lede` → Азыркы жыйынтыгыңыз жарыяланган талаптан бир топ төмөн. Даярданууга көбүрөөк убакыт бөлүп, андан кийин кайра текшериңиз.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
