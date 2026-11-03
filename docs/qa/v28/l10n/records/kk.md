# V28 localization review — Kazakh (kk)

Scope: all 354 keys of `scripts/i18n/v28/jobs/kk.json` → `scripts/i18n/v28/tx/kk.json`. Every key was read against the current English (`en`) and the Korean (`ko`); `current` was kept only where it is correct, natural and matches the V28 English.
Register: polite *Сіз*, CTAs in -ңыз/-іңіз, verbal nouns on buttons (as in V27). Placeholders take no case ending (colon lists, «{{date}} күні», apposition).

## Personas

1. **Аружан, 18, Алматы** (first-time visitor) — 11th-grader, TOPIK 2, phone only; needs plain next steps.
2. **Ерлан, 27, Астана** (comparison shopper) — master's applicant, IELTS 6.5, compares Hangyul with local agencies and reads pricing closely.
3. **Гүлнар, 48, Шымкент** — Аружан's mother and sponsor; money, visa and trust wording.

## Glossary

Reused from `docs/qa/v27/l10n/kk.md` (unchanged rows), plus V28 additions at the end.

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
| the Hangyul team (V28) | 한귤 팀 | Hangyul командасы (replaces «кеңесшіңіз» in student UI) |
| Needs more preparation (far tier) | 준비가 더 필요해요 | Көбірек дайындық қажет |
| intake | 모집 시기 | қабылдау кезеңі |
| pipeline (console) | 파이프라인 | өтінімдер ағыны |
| Korean test result | 한국어 성적 | корей тілі сертификаты |

## Known defects fixed

- `visaroute:step.slow_items.why`: «Растаулар» (confirmations) → «Консулдық заңдастыру». The only job key where `current` used a confirmation word for 영사확인. `caveat.APOSTILLE_TRANSITION` already had «консулдық заңдастыру» (kept; only «кеңесшіңіз» changed). `university:documents.legalization` newly translated as «Заңдастыру». Grep of the output: no «консулдық растау»; remaining «раста-» forms mean genuine confirmation (verify, e-visa level not confirmed).
- 22 student-facing strings changed «кеңесшіңіз» → «Hangyul командасы».

## Pass A — meaning (34 strings changed)

The V28 English changed meaning in many keys (tier titles and ledes, the 'Hangyul team' identity, scholarships empty state, dormitory scope). Every student-facing `current` that said *your counselor* was rewritten to the Hangyul team (brief: never "your counselor"); agency-console strings about agency staff were left alone. Legalization wording was corrected to the glossary term. The far tier now says *needs more preparation*, never a distance/probability word. 'No Korean test result' replaced 'does not know Korean' in the deposit-scheme rule.

| key | before | after |
|---|---|---|
| `visaroute:step.slow_items.why` | Растаулар, туберкулез тексеруі және полиция анықтамалары бірнеше аптаға созылады. | Консулдық заңдастыру, туберкулез тексеруі және полиция анықтамалары бірнеше аптаға созылады. |
| `visaroute:caveat.APOSTILLE_TRANSITION` | Вьетнам 2026 жылғы 11 қыркүйектен бастап апостиль бере бастады, бірақ елшіліктің студенттік виза тізімдерінде әлі де консулдық заңдастыру жазылған. Қайсысы қабылданатынын кеңесшіңіз нақтылайды. | Вьетнам 2026 жылғы 11 қыркүйектен бастап апостиль бере бастады, бірақ елшіліктің студенттік виза тізімдерінде әлі де консулдық заңдастыру жазылған. Қайсысы қабылданатынын Hangyul командасы нақтылайды. |
| `common:fit.tier.UNCLEAR.title` | Әзірге әлі алыс | Көбірек дайындық қажет |
| `common:fit.tier.CHALLENGE.lede` | Біз білетін ақпарат бойынша сізге кедергі жоқ. Бұл деңгейдің қазіргі талаптарын әлі тексермедік, сондықтан оларды сізбен бірге нақтылаймыз. | Hangyul бұл деңгей бойынша осы университеттердің талаптарын әлі тексерген жоқ. Оларды сізбен бірге тексереміз. |
| `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME` | Кейбір елдерден корей тілін білмейтін студенттер оқу қаражатын банкке салады, ол әр семестр сайын босатылады. | Корей тілі сертификаты жоқ кейбір елдердің студенттері оқу қаражатын банкке салады, ол әр семестр сайын төленеді. |

## Pass B — native naturalness (14 strings changed)

Read as each persona. Long marketing bodies were re-flowed into native word order; em-dash chains from the old bundle were split into sentences; machine-literal phrasing in pricing and city pages was replaced.

| key | before | after |
|---|---|---|
| `marketing:seo.home.description` | Өзіңізге сай корей университетін табыңыз, құжаттарды дайындаңыз, виза мен келу кезеңінен бір жерде өтіңіз — тексерілген ақпарат пен көмектесетін нақты адамдармен. | Өзіңізге сай корей университетін табыңыз, құжаттарды дайындаңыз, виза мен келу мәселелерін бір жерде шешіңіз. Тексерілген ақпарат және көмектесетін нақты адамдар. |
| `marketing:v20.city.Gyeonggi.body` | Кёнгидо Сеулді қоршап жатыр және астананың өзінен басқа кез келген аймаққа қарағанда университеттері көп. Сувон, Ёнъин, Соннам және Пучхон Сеул орталығынан метромен немесе тікелей автобуспен 40–70 минуттық жерде, ал жалдау ақысы әдетте үштен бір есе арзан. / Мұндағы кампустар Сеулдегіден үлкенірек және дербес болады, ортақ пәтерлер көшесінің орнына өз жатақханалары бар. | Кёнгидо Сеулді қоршап жатыр, ал университеттер саны жағынан одан тек астананың өзі ғана озады. Сувон, Ёнъин, Соннам және Пучхон Сеул орталығынан метромен немесе тікелей автобуспен 40–70 минуттық жерде, ал жалдау ақысы әдетте үштен бірге арзан. / Мұндағы кампустар Сеулдегіден үлкенірек әрі дербес: ортақ пәтерлер көшесінің орнына өз жатақханалары бар. |
| `marketing:v20.uni.ctaTitle` | Мұны байыппен қарастыруға дайынсыз ба? | Осында оқуға түсуді ойлап жүрсіз бе? |
| `marketing:v6.unis.title` | Сапарға тұрарлық университеттер. | Корея бойынша университеттер. |
| `concierge:housing.honest` | Біз жатақхана туралы деректерді тек дереккөзімен және қызмет көрсетуші бізге шынымен берген бөлмелерді ғана көрсетеміз — әрқайсысы белгіленген. Ешқашан хабарландыруларды ойдан шығармаймыз. | Жатақхана туралы тек дереккөзі бар деректерді және қызмет көрсетуші шынымен ұсынған бөлмелерді ғана көрсетеміз, әрқайсысы белгіленеді. Хабарландыруларды ешқашан ойдан шығармаймыз. |

## Pass C — UI context, brevity, one term per concept (14 strings changed)

Labels and chips shortened; one term per concept enforced (dormitory = one word across pricing/scope; programs, not majors; proof of funds per glossary; legalization per glossary). Semicolon/dash fragments in console footnotes became two short sentences.

| key | before | after |
|---|---|---|
| `marketing:v15.pricing.compare.row.dormitory` | Жатақхана қолдауы | Жатақхана |
| `dossier:check.title` | Біз мына ақпаратты таптық. Тексеріп шығыңыз. | Тапқанымызды тексеріңіз |
| `university:kpi.insufficientDetail` | {{n}} жазба негізінде — {{min}} жазбадан бастап көрсетіледі | {{n}} жазба негізінде. {{min}} жазба жиналғанда көрсетіледі. |
| `marketing:v24.uni.academicTitle` | Мамандықтар мен кампустар | Бағдарламалар мен кампустар |
| `agency:v8.view.docs` | Құжатты түзету қажет | Құжаттарды түзету қажет |

## Final — source ↔ target comparison (9 strings changed)

Whole set compared with `en` and `ko` for meaning, numbers, test names, placeholders and the no-guarantee / no-ranking rule. Corrected: waitlist hint no longer says 'we still have to decide'; 'Needed for a decision' no longer reads as 'a decision is needed'; passport *issuance* record (not 'passport data'); 'apply and record the receipt'.

| key | before | after |
|---|---|---|
| `university:v22.stageHint.decision` | Күту тізімінде — шешімді әлі біз қабылдауымыз керек | Күту тізімінде. Шешім әлі шыққан жоқ |
| `university:v8.aq.need` | Шешімге не қажет | Шешім үшін қажет |
| `student:v26.now.owner.STUDENT` | Сізде | Сіз |
| `visaroute:step.apply.title` | Өтінім беріп, оны тіркеңіз | Өтінім беріп, түбіртекті тіркеңіз |
| `common:task.visa.other_passport_record` | Паспорт деректері туралы анықтаманы алыңыз | Паспорт берілгені туралы анықтаманы алыңыз |

## Marketing scorecard (39 `marketing:` keys; 30-point card: clarity, trust, naturalness, brevity, CTA strength, cultural fit, 5 each)

| section | first draft | final | C | T | N | B | CTA | Fit |
|---|---|---|---|---|---|---|---|---|
| seo.home | 21 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |
| pricing (lede, compare, premium) | 20 | 26 | 5 | 4 | 4 | 5 | 4 | 4 |
| city pages (Busan, Gyeonggi, Seoul line) | 22 | 26 | 4 | 5 | 4 | 4 | 4 | 5 |
| university page (why/cta/intl/GKS/English) | 19 | 27 | 5 | 5 | 4 | 4 | 5 | 4 |
| unis title, journey eyebrow | 18 | 25 | 4 | 4 | 4 | 5 | 4 | 4 |
| FAQ languages | 23 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |

Each section below 25 on the first draft was transcreated (not translated) and re-scored until ≥ 25.

## Unsure

- `fit.summary.MEETS` «Олардың {{formatted}} … сай келесіз»: grammatical only if {{formatted}} is a bare number; a «{{formatted}} университет» form would be safer if the UI renders "12 universities".
- `staff.post` «Өкілдік» for a diplomatic post: «консулдық мекеме» is more exact but longer.
- `v28.pipe.rate` «{{pct}}%»: Kazakh normally writes «%-ы» here; the suffix was left off to avoid gluing to a placeholder.
- `ieqasExcellent` «IEQAS: үздік деңгей» — the Kazakh rendering of the official 우수 grade is not standardised.
- «Hangyul командасы» vs «Hangyul тобы»: «команда» chosen as in V27.

## Counts

| job keys | kept verbatim | rewritten | newly translated |
|---|---|---|---|
| 354 | 52 | 71 | 231 |

Kept verbatim = `current` non-null and output identical; rewritten = `current` non-null and output changed; newly translated = `current` null.

Validator: `node scripts/i18n/v28/validate.mjs --only=kk` → 354 strings valid, 0 problems.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/kk.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: none. The three passes found nothing to change; `upload.status.*` stay empty as in en.

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | Жетіспейтін құжаттарды жүктеп, эсселеріңізді аяқтаңыз. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Басқа университетке жазылған эссе — бас тартудың ең жиі, әрі алдын алуға болатын себебі. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: консулдық заңдастыру күтілуде |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Тек растау нөмірі не түбіртек болса ғана расталады. Сонда өтінім «Жіберілді» күйіне өтеді. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Бұл файлдарды тек сіз және Hangyul командасы көре алады. Университет құжатты тек сол университетке берген өтініміңіз үшін жіберілгенде ғана көреді. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | Өз байланыс арнасы бар халықаралық бөлім бар. / Hangyul бұл университеттің өз сайтынан шетелдік студенттерге арналған бетті әлі таппады. Төмендегі ресми сайттан бастаңыз. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko.
- `student:workspace.todoCount_one/_other` are identical (Kazakh does not pluralise after numerals).
- `success:queue.fixture` *Тест*; `success:agency.colFit` *Сәйкестік*.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=kk` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
