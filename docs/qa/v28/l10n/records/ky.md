# V28 localization review — Kyrgyz (ky)

Scope: all 354 keys of `scripts/i18n/v28/jobs/ky.json` → `scripts/i18n/v28/tx/ky.json`. Every key was read against the current English (`en`) and the Korean (`ko`); `current` was kept only where it is correct, natural and matches the V28 English.
Register: polite *Сиз*, CTAs in -ңыз/-ңүз, verbal nouns on buttons (as in V27). Placeholders take no case ending.

## Personas

1. **Айпери, 18, Бишкек** (first-time visitor) — finishing school, TOPIK 2, phone only.
2. **Нурлан, 26, Ош** (comparison shopper) — master's applicant, IELTS 6.5, compares plans and agencies line by line.
3. **Бакыт, 50, Каракол** — Айпери's father and sponsor; money, visa and trust wording.

## Glossary

Reused from `docs/qa/v27/l10n/ky.md` (unchanged rows), plus V28 additions at the end.

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
| the Hangyul team (V28) | 한귤 팀 | Hangyul командасы (replaces «кеңешчиңиз» in student UI) |
| Needs more preparation (far tier) | 준비가 더 필요해요 | Көбүрөөк даярдык керек |
| intake | 모집 시기 | кабыл алуу мезгили |
| pipeline (console) | 파이프라인 | арыздардын агымы |
| application | 지원 | арыз (bundle term) |

## Known defects fixed

- `visaroute:step.slow_items.why`: «Ырастоолор» (confirmations) → «Консулдук легалдаштыруу». The only job key where `current` used a confirmation word for 영사확인. `caveat.APOSTILLE_TRANSITION` already had «консулдук легалдаштыруу» (kept; only «кеңешчиңиз» changed). `university:documents.legalization` newly translated as «Легалдаштыруу». Grep of the output: no «ырастоо» left at all («ырастай элекпиз» in EVISA_TIER_UNKNOWN became «так биле элекпиз»).
- 22 student-facing strings changed «кеңешчиңиз» → «Hangyul командасы».

## Pass A — meaning (34 strings changed)

The V28 English changed meaning in many keys (tier titles and ledes, the 'Hangyul team' identity, scholarships empty state, dormitory scope). Every student-facing `current` that said *your counselor* was rewritten to the Hangyul team (brief: never "your counselor"); agency-console strings about agency staff were left alone. Legalization wording was corrected to the glossary term. The far tier now says *needs more preparation*, never a distance/probability word. 'No Korean test result' replaced 'does not know Korean' in the deposit-scheme rule.

| key | before | after |
|---|---|---|
| `visaroute:step.slow_items.why` | Ырастоолор, кургак учук тести жана милициядан маалымкаттар бир нече жумага созулат. | Консулдук легалдаштыруу, кургак учук тести жана милициядан маалымкаттар бир нече жумага созулат. |
| `visaroute:caveat.APOSTILLE_TRANSITION` | Вьетнам 2026-жылдын 11-сентябрынан тартып апостиль бере баштады, бирок элчиликтин студенттик виза тизмелеринде дагы эле консулдук легалдаштыруу жазылган. Кайсынысы кабыл алынарын кеңешчиңиз тактайт. | Вьетнам 2026-жылдын 11-сентябрынан тартып апостиль бере баштады, бирок элчиликтин студенттик виза тизмелеринде дагы эле консулдук легалдаштыруу жазылган. Кайсынысы кабыл алынарын Hangyul командасы тактайт. |
| `common:fit.tier.UNCLEAR.title` | Азырынча али алыс | Көбүрөөк даярдык керек |
| `common:fit.tier.CHALLENGE.lede` | Бизге белгилүү маалымат боюнча сизге тоскоол жок. Бул деңгээлдин учурдагы талаптарын азырынча текшере элекпиз, ошондуктан аларды сиз менен бирге тактайбыз. | Hangyul бул деңгээл боюнча бул университеттердин талаптарын азырынча текшере элек. Аларды сиз менен бирге текшеребиз. |
| `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME` | Айрым өлкөлөрдөн корей тилин билбеген студенттер окуу акчасын банкка депозитке салышмак, ал ар бир семестрде бөлүп берилмек. | Корей тили боюнча жыйынтыгы жок айрым өлкөлөрдүн студенттери окуу каражатын банкка салышат, ал ар бир семестрде бөлүп төлөнөт. |

## Pass B — native naturalness (19 strings changed)

Read as each persona. Long marketing bodies were re-flowed into native word order; em-dash chains from the old bundle were split into sentences; machine-literal phrasing in pricing and city pages was replaced.

| key | before | after |
|---|---|---|
| `marketing:seo.home.description` | Өзүңүзгө ылайык корей университетин табыңыз, документтерди даярдаңыз, виза жана келүү этабынан бир жерде өтүңүз — текшерилген маалымат жана жардам берген чыныгы адамдар менен. | Өзүңүзгө ылайык корей университетин табыңыз, документтерди даярдаңыз, виза жана келүү маселелерин бир жерден чечиңиз. Текшерилген маалымат жана жардам берген чыныгы адамдар. |
| `marketing:v20.city.Gyeonggi.body` | Кёнги Сеулду курчап турат жана борбордун өзүнөн башка бардык аймактарга караганда университеттери көп. Сувон, Ёнъин, Соннам жана Бучхон Сеулдун борборунан метро же түз автобус менен 40–70 мүнөттүк аралыкта, ижара акысы адатта үчтөн бирге арзан. / Бул жердеги кампустар Сеулдагыдан чоңураак жана өзүнчө турат, бөлүшүлгөн батирлер көчөсүнүн ордуна өз жатаканалары бар. | Кёнги Сеулду курчап турат, университеттердин саны боюнча андан борбордун өзү гана ашат. Сувон, Ёнъин, Соннам жана Бучхон Сеулдун борборунан метро же түз автобус менен 40–70 мүнөттүк аралыкта, ижара акысы адатта үчтөн бирге арзан. / Бул жердеги кампустар Сеулдагыдан чоңураак жана өзүнчө турат: бөлүшүлгөн батирлер көчөсүнүн ордуна өз жатаканалары бар. |
| `marketing:v20.uni.ctaTitle` | Муну олуттуу карап чыгууга даярсызбы? | Бул жерге арыз берүүнү ойлоп жүрөсүзбү? |
| `marketing:v6.unis.title` | Жолго татыктуу университеттер. | Кореянын ар кайсы аймагындагы университеттер. |
| `concierge:housing.honest` | Биз жатакана тууралуу фактыларды булагы менен гана көрсөтөбүз, ал эми бөлмөлөрдү кызмат көрсөтүүчү чындап бергенде гана — ар бири белгиленген. Жарнамаларды эч качан ойлоп чыгарбайбыз. | Жатакана тууралуу булагы бар фактыларды жана кызмат көрсөтүүчү чындап сунуштаган бөлмөлөрдү гана көрсөтөбүз, ар бири белгиленет. Жарнамаларды эч качан ойлоп чыгарбайбыз. |

## Pass C — UI context, brevity, one term per concept (21 strings changed)

Labels and chips shortened; one term per concept enforced (dormitory = one word across pricing/scope; programs, not majors; proof of funds per glossary; legalization per glossary). Semicolon/dash fragments in console footnotes became two short sentences.

| key | before | after |
|---|---|---|
| `marketing:v15.pricing.compare.row.dormitory` | Жатакана колдоосу | Жатакана |
| `dossier:check.title` | Бул маалыматты таптык. Сураныч, текшериңиз. | Тапканыбызды текшериңиз |
| `university:kpi.insufficientDetail` | {{n}} жазууга негизделген — {{min}} баштап көрсөтүлөт | {{n}} жазууга негизделген. {{min}} жазуу чогулганда көрсөтүлөт. |
| `marketing:v24.uni.academicTitle` | Адистиктер жана кампустар | Программалар жана кампустар |
| `agency:v8.view.docs` | Документти оңдоо талап кылынат | Документтерди оңдоо керек |

## Final — source ↔ target comparison (9 strings changed)

Whole set compared with `en` and `ko` for meaning, numbers, test names, placeholders and the no-guarantee / no-ranking rule. Corrected: waitlist hint no longer says 'we still have to decide'; 'Needed for a decision' no longer reads as 'a decision is needed'; passport *issuance* record (not 'passport data'); 'apply and record the receipt'.

| key | before | after |
|---|---|---|
| `university:v22.stageHint.decision` | Күтүү тизмесинде — чечим дагы эле бизде | Күтүү тизмесинде. Чечим азырынча чыга элек |
| `university:v8.aq.need` | Чечим үчүн эмне керек | Чечим үчүн керек |
| `student:v26.now.owner.STUDENT` | Сизде | Сиз |
| `visaroute:step.apply.title` | Арыз берип, аны каттаңыз | Арыз берип, квитанцияны каттаңыз |
| `common:task.visa.other_passport_record` | Паспорт боюнча маалымат (жазуу) алыңыз | Паспорт берилгени тууралуу маалымкат алыңыз |

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

- `fit.summary.MEETS` «Алардын {{formatted}} …»: correct only if {{formatted}} is a bare number.
- `staff.post` «Өкүлчүлүк» for a diplomatic post.
- «резидент картасы» kept from the bundle; the official Kyrgyz term for 외국인등록증 is not settled.
- `ieqasExcellent` «IEQAS: мыкты деңгээл» — rendering of the 우수 grade not standardised.
- `consult.kind.INTERVIEW` «Маек» (conversation/interview) vs «Интервью»: «Маек» chosen as more native.

## Counts

| job keys | kept verbatim | rewritten | newly translated |
|---|---|---|---|
| 354 | 40 | 83 | 231 |

Kept verbatim = `current` non-null and output identical; rewritten = `current` non-null and output changed; newly translated = `current` null.

Validator: `node scripts/i18n/v28/validate.mjs --only=ky` → 354 strings valid, 0 problems.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/ky.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: none. The three passes found nothing to change; `upload.status.*` stay empty as in en.

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | Жетишпеген документтерди жүктөп, эсселериңизди бүтүрүңүз. |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | Башка университетке жазылган эссе баш тартуунун эң көп кездешкен жана алдын алса боло турган себеби. |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: консулдук легалдаштыруу күтүлүүдө |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | Ырастоо номери же дүмүрчөк болгондо гана ырасталат. Ошондо арыз «Жөнөтүлдү» абалына өтөт. |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | Бул файлдарды сиз жана Hangyul командасы гана көрө алат. Университет документти ошол университетке берген арызыңыз үчүн жөнөтүлгөндө гана көрөт. |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | Өзүнүн байланыш каналы бар эл аралык бөлүм бар. / Hangyul бул университеттин өз сайтынан чет элдик студенттерге арналган баракты азырынча таба элек. Төмөндөгү расмий сайттан баштаңыз. | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko.
- `success:queue.term.SPRING` *Жаз* vs `SUMMER` *Жай* are correct Kyrgyz but easy to confuse; a native check would be good.
- Interview = *маек* (bundle usage); some universities write *интервью*.
- The glossary term *консулдук легалдаштыруу* is used, though older bundle strings say *консулдук легализация*.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ky` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
