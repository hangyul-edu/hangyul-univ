# V27 localization review — Kazakh (kk, Cyrillic)

Output: `scripts/i18n/v27/tx/kk.json` (727/727 keys of the current `strings.json`). Validator: `node scripts/i18n/v27/validate.mjs --only=kk` → 727 valid, 0 problems.
Register: polite *Сіз*, imperative CTAs in -ңыз/-іңіз ("тексеріңіз", "жүктеңіз"), verbal nouns on buttons ("Сақтау", "… көрсету"), as Kazakh university and e-gov sites write them.
Placeholders: Kazakh suffixes follow vowel harmony, so a suffix glued to `{{university}}` / `{{country}}` would be wrong for half the names. Sentences were built so placeholders take no case ending (apposition, "{{country}} аумағындағы", colon lists, parentheses).

## Personas

1. **Аружан, 18, Алматы** — 11th-grader, wants a bachelor's in Korea, TOPIK 2, mostly on her phone.
2. **Ерлан, 27, Астана** — data engineer, master's applicant, IELTS 6.5, reads every condition carefully.
3. **Аружан's mother, Гүлнар, 48, Шымкент** — sponsor, pays tuition and provides the bank certificate; wants clear money and visa wording.

## Glossary

| English | Korean | Kazakh rendering |
|---|---|---|
| scholarship | 장학(금) | стипендия |
| Global Korea Scholarship (GKS) | 정부초청장학 | Корея үкіметінің стипендиясы (GKS) |
| admission guide | 모집요강 | қабылдау нұсқаулығы |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консулдық заңдастыру |
| Korean language institute | 어학당 | (университет жанындағы) корей тілі орталығы |
| admission letter | 표준입학허가서 | қабылдау хаты |
| residence card | 외국인등록증 | шетелдіктің тіркеу картасы |
| tuition | 등록금 | оқу ақысы |
| counselor | 상담사 | кеңесші |
| Hangyul team | 한귤 상담팀 | Hangyul командасы |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | қаржылық қамтамасыз ету дәлелі / банктегі қалдық туралы анықтама |
| embassy / consulate | 대사관 / 영사관 | елшілік / консулдық |
| immigration office | 출입국관리사무소 | көші-қон кеңсесі |
| CCVI | 사증발급인정서 | виза беруді растау сертификаты (CCVI) |
| e-visa | 전자비자 | электрондық виза |
| TB certificate | 결핵 진단서 | туберкулез анықтамасы |
| notarized | 공증 | нотариалды куәландырылған |
| Recommended (sort) | 추천순 | Ұсынылатын (browsing order, not a rating) |
| account | 계정 | тіркелгі |
| KRW amount | 원 | {{amount}} вон |
| My progress | 내 여정 | Дайындық барысы |

## Pass A — meaning (13 strings changed)

| key | before | after |
|---|---|---|
| student:dashboard.nextAction.PROFILE_UNLOCK.gpa.text | {{total}} бағдарламаңыздың {{count}} бағаға ең төменгі талап жариялаған. … | {{total}} бағдарламаңыздың {{count}} бағдарламасы баға бойынша ең төменгі талапты жариялаған. … |
| common:nav.journey | Менің барысым | Дайындық барысы |
| common:uni27.service.ORIENTATION | Бағдарлау апталығы (added "week") | Бейімдеу (ориентация) |
| common:fit.gpa.value | GPA (failed script check, lost "your") | Сіздің GPA |
| student:matches.method.stage1 | 1-кезең: сәйкестік шарттары. … | 1-кезең: талапқа сай болу. … (Eligibility, distinct from stage 2 "fit") |

## Pass B — native naturalness (33 strings changed)

Includes 8 date strings: a bare `{{date}} бастап` / `{{date}} дейін` lacks the case ending Kazakh needs, so they became `{{date}} күнінен бастап` / `{{date}} күніне дейін`, and "joins/joined on {{date}}" became `{{date}} күні`.

| key | before | after |
|---|---|---|
| common:fit.tier.CHALLENGE.lede | Бізге белгілі ештеңе сізге кедергі келтірмейді. … | Біз білетін ақпарат бойынша сізге кедергі жоқ. … |
| dossier:reason.NEAR_TOO_OLD | … {{until}} кейін тым ескі болады. | … {{until}} күнінен кейін тым ескі болады. |
| student:legalFlow.step.consular.title | Корея елшілігінде … ({{country}}) | {{country}} аумағындағы Корея елшілігінде … |
| student:essay.precheck.code.OVERCLAIM | Кесімді тұжырымдардан аулақ болыңыз. … | Асыра айтудан сақ болыңыз. … |
| marketing:agenciesPage.valueLede | Қуып жүру азаяды, … | Студенттің соңынан қуу азаяды, кеңес беру көбейеді. |
| student:legalFlow.note.JOINED | {{country}} {{date}} бастап Апостиль конвенциясына қосылды. … | {{country}} {{date}} күні Апостиль конвенциясына қосылды. … |

## Pass C — UI context, brevity, consistency (7 strings changed)

| key | before | after |
|---|---|---|
| marketing:home.steps.items.prepare.text | … апостиль немесе консулдық тәртіп … | … апостиль немесе консулдық заңдастыру тәртібі … |
| student:dashboard.stageText.PROFILE | Жеке сәйкестіктеріңізді көру үшін … | Сізге сай бағдарламаларды көру үшін … |
| student:profile.saved | … Сәйкестіктер қайта есептелді | … Сізге сай бағдарламалар жаңартылды |
| mobile:student.nextAction.FINISH_APPLICATION | Өтінімді аяқтаңыз: {{university}}. … | Өтінімді аяқтаңыз ({{university}}). … |
| common:fit.reason.several | Тағы {{count}} тіл талабын орындау керек. | Тағы {{count}} тіл талабы орындалуы керек. |

## Source change during the review (13 strings synced, not a review pass)

While this review ran, `strings.json` dropped `common:uni27.schol.count_one` and `common:fit.unlock_one` (now 727 keys), and `validate.mjs` started forcing every `fit.test.*` key to the bare source name in Latin script, for every locale. The draft's workaround ("TOPIK тесті" etc., added only to pass the old Cyrillic-script check) is gone: all 13 `fit.test.*` values now equal the English source, so `kk.json` matches what will ship.

## Final comparison

All 727 source ↔ target pairs re-read side by side after Pass C. Placeholders and `<em>` tags identical; no admission-chance or guarantee wording introduced; "Ұсынылатын" explained as a browsing order; one term per concept (стипендия, қабылдау нұсқаулығы, апостиль, консулдық заңдастыру, корей тілі орталығы, тіркелгі). Plural `_one` keys use count-neutral forms (Kazakh nouns stay singular after numerals). Result: no remaining meaning differences found.

## Strings I am unsure of / deviations

- **Test names**: resolved by the validator change above. Note that `fit.test.KIIP`, `fit.test.KING_SEJONG` and `fit.test.UNIV_KLI` are descriptions rather than brand names and are now shown in English.
- **Consular legalization**: the existing bundle uses "Консулдық растау" (= consular confirmation), which the brief forbids; V27 strings use "консулдық заңдастыру" (the Kazakh MFA term). The older bundle keys will differ until they are re-done.
- `fit.level.ASSOCIATE` — "Қолданбалы бакалавр" is the closest Kazakh degree name; it is not identical to a Korean 전문학사.
- `v9.funds.*` government tiers rendered «консалтинг» / «үздік»; no official Kazakh names exist.
- Korean place names (Хыксок, Тхонъён, Тхэхва, Пуё) use the Kontsevich-style Cyrillic common in Kazakhstan; spelling may vary.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Өтінім беру үшін тіл сертификаты талап етілмейді. Оқуға қабылданғаннан кейін {{tests}} не одан жоғары қажет болады.
- `fit.reason.far` → {{options}} не одан жоғары қажет — бұл қазіргі нәтижеңізден әлдеқайда жоғары.
- `fit.tier.UNCLEAR.title` → Әзірге әлі алыс
- `fit.tier.UNCLEAR.short` → Көбірек дайындық
- `fit.tier.UNCLEAR.lede` → Қазіргі нәтижеңіз жарияланған талаптан едәуір төмен. Дайындалуға көбірек уақыт бөліп, кейін қайта тексеріңіз.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
