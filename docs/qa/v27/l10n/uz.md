# V27 localization review — Uzbek (uz, Latin script)

Output: `scripts/i18n/v27/tx/uz.json` (727/727 keys of the current `strings.json`). Validator: `node scripts/i18n/v27/validate.mjs --only=uz` → 727 valid, 0 problems.
Orthography: official Latin alphabet with ʻ (U+02BB) in oʻ/gʻ and ʼ (U+02BC) for the tutuq belgisi, matching the existing bundle.
Register: polite *siz*, imperative CTAs ("tekshiring", "yuklang"), verbal nouns on buttons ("Saqlash", "… koʻrsatish"), as on Uzbek university and service websites.

## Personas

1. **Dilnoza, 18, Toshkent** — finishing school (11-sinf), wants a bachelor's in Korea, TOPIK 2, reads everything on her phone.
2. **Jasur, 26, Samarqand** — IT engineer applying for a master's, IELTS 6.5, cares about exact requirements and visa paperwork.
3. **Dilnoza's father, Rustam aka, 49, Namangan** — sponsor, pays tuition and shows the bank balance; wants plain, trustworthy wording about money.

## Glossary

| English | Korean | Uzbek rendering |
|---|---|---|
| scholarship | 장학(금) | stipendiya |
| Global Korea Scholarship (GKS) | 정부초청장학 | Koreya hukumati stipendiyasi (GKS) |
| admission guide | 모집요강 | qabul yoʻriqnomasi |
| apostille | 아포스티유 | apostil |
| consular legalization | 영사확인 | konsullik legalizatsiyasi |
| Korean language institute | 어학당 | (universitet qoshidagi) koreys tili markazi |
| certificate of admission / admission letter | 표준입학허가서 | qabul xati |
| residence card | 외국인등록증 | chet ellik roʻyxat kartasi |
| tuition | 등록금 | oʻqish toʻlovi |
| counselor | 상담사 | maslahatchi |
| Hangyul team | 한귤 상담팀 | Hangyul jamoasi |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | mablagʻ mavjudligini tasdiqlovchi hujjat / bank hisobidagi qoldiq haqida maʼlumotnoma |
| embassy / consulate | 대사관 / 영사관 | elchixona / konsullik |
| immigration office | 출입국관리사무소 | immigratsiya idorasi |
| CCVI | 사증발급인정서 | viza berishni tasdiqlovchi sertifikat (CCVI) |
| e-visa | 전자비자 | elektron viza |
| TB certificate | 결핵 진단서 | sil (TB) maʼlumotnomasi |
| notarized | 공증 | notarial tasdiqlangan |
| Recommended (sort) | 추천순 | Tavsiya etilgan (browsing order, never "reyting") |
| requirement / meets | 요건 / 충족 | talab / talablarga javob beradi |
| KRW amount | 원 | {{amount}} von |
| My progress | 내 여정 | Tayyorgarligim / Tayyorgarligingiz |

## Pass A — meaning (22 strings changed)

Checked every string against EN and KO. Main fixes: "My progress" had been rendered as "my journey" (old KO meaning); COMBINED degree lost "integrated"; COUNSELING narrowed to "psychological"; a Hangul leak (대학알리미) removed.

| key | before | after |
|---|---|---|
| common:nav.journey | Mening yoʻlim | Tayyorgarligim |
| common:fit.level.COMBINED | Magistratura + PhD | Magistratura va PhD (integratsiyalashgan) |
| common:uni27.service.COUNSELING | Psixologik maslahat | Maslahat xizmati |
| student:discover.confirmEducation.text | Bu yerda sizni nomuvofiq deyilmagan. … | Bu talablarga javob bermaysiz degani emas. … |
| marketing:v20.uni.why.breadthBody | … Academy Info (대학알리미) ga taqdim etilgan … | … Academy Info rasmiy universitet maʼlumotlari xizmatiga taqdim etilgan … |

## Pass B — native naturalness (56 strings changed)

Read as each persona. Most changes: case suffixes attached to name placeholders the way Uzbek writes them ("{{university}}ga", "{{country}}dagi" instead of a detached "{{university}} ga"), dates given as "{{date}} kuni"; calques rewritten.

| key | before | after |
|---|---|---|
| student:login.aside.title | … bitta xotirjam joyda. | Koreya universitetiga yoʻlning barcha bosqichlari — bir joyda, shoshilmasdan. |
| student:matches.tierText.REACH | Siz yaqinsiz. … | Maqsadga yaqinsiz. Bir-ikkita talab hali bajarilmagan. |
| common:fit.q.nationality | Fuqaroligingiz qaysi davlat? | Qaysi davlat fuqarosisiz? |
| visaroute:why.POST_FOR_COUNTRY | {{country}} da yashovchi … {{city}} dagi … | {{country}}da yashovchi … {{city}}dagi … |
| common:uni27.checkedOn | {{date}} da tekshirilgan | {{date}} kuni tekshirilgan |

## Pass C — UI context, brevity, consistency (15 strings changed)

One phrase for "no account needed" (hisob ochish shart emas), full "konsullik legalizatsiyasi" everywhere it is the document step, "chet ellik roʻyxat kartasi" for the residence card, short labels kept short, genitive added where a university name owns the noun.

| key | before | after |
|---|---|---|
| marketing:v7.cta.text | … hisob shart emas. | … hisob ochish shart emas. |
| student:compare.legalCount_other | … apostil yoki legalizatsiya kerak | … apostil yoki konsullik legalizatsiyasi kerak |
| common:fit.gpa.value | Sizning GPA | GPA |
| visaroute:caveat.CCVI_TIER_UNKNOWN | {{university}} sertifikat darajasiga … | {{university}}ning sertifikat darajasiga … |
| marketing:home.show.match.p1 | … mos, yaqin yoki hozircha emas | … mos, bir qadam qoldi yoki hozircha emas |

## Source change during the review (3 strings synced, not a review pass)

While this review ran, `strings.json` dropped `common:uni27.schol.count_one` and `common:fit.unlock_one` (now 727 keys), and `validate.mjs` started forcing every `fit.test.*` key to the bare source name in Latin script. The Uzbek draft already kept the brand names in Latin; the three descriptive ones (`fit.test.KIIP` "KIIP integratsiya dasturi", `fit.test.KING_SEJONG` "King Sejong instituti", `fit.test.UNIV_KLI` "Universitet koreys tili kursi") now equal the English source, so `uz.json` matches what will ship.

## Final comparison

All 727 source ↔ target pairs re-read side by side after Pass C. No added promises or admission-probability wording ("Tavsiya etilgan" is described as a browsing order, not a ranking); every `{{placeholder}}` and `<em>` tag preserved; test names (TOPIK, TOEFL iBT, IELTS Academic, TEPS, New TEPS, TOEIC, Duolingo English Test, PTE Academic, Cambridge English) left in Latin; plural `_one` keys translated with a count-neutral form ("{{count}} ta …"). Result: no remaining meaning differences found.

## Strings I am unsure of

- `fit.test.KIIP`, `fit.test.KING_SEJONG`, `fit.test.UNIV_KLI` are now forced to English by the validator although they are descriptions, not brand names; Uzbek students would read the translated forms more easily.

- `nav.journey` / `*.journey` — "Tayyorgarligim" (my preparation) is a natural nav label but slightly reframes "progress"; "Jarayonim" is the literal alternative.
- `fit.level.ASSOCIATE` — "Kichik bakalavr" for the Korean 2–3-year associate degree; Uzbek has no exact equivalent (alternative: "Kollej diplomi (associate)").
- `uni27.service.BUDDY` — "Buddy dasturi" kept as the loanword used by Uzbek students in Korea.
- `v9.funds.longer_*` / `v9.funds.waived` — the government tiers rendered as «konsalting» / «aʼlo»; official Uzbek names for these Korean IEQAS tiers do not exist.
- City-name transliterations (Xikseok, Chxonan, Txexva, Pekche, Puyo) follow common Uzbek Cyrillic-to-Latin habits for Korean names; a native editor may prefer the Latin romanization (Heukseok, Cheonan, Taehwa, Baekje, Buyeo).
- The existing bundle's "Konsullik legalizatsiyasi" is kept; it matches the brief.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Ariza berish uchun til sertifikati talab qilinmaydi. Oʻqishga qabul qilingandan keyin {{tests}} va undan yuqori kerak boʻladi.
- `fit.reason.far` → {{options}} va undan yuqori kerak — bu hozirgi natijangizdan ancha yuqori.
- `fit.tier.UNCLEAR.title` → Hozircha hali ancha yoʻl bor
- `fit.tier.UNCLEAR.short` → Koʻproq tayyorgarlik
- `fit.tier.UNCLEAR.lede` → Hozirgi natijangiz eʼlon qilingan talabdan ancha past. Tayyorgarlikka koʻproq vaqt ajrating, soʻng qayta tekshiring.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
