# V27 localization review — Mongolian (mn, Cyrillic)

Output: `scripts/i18n/v27/tx/mn.json` (727/727 keys of the current `strings.json`). Validator: `node scripts/i18n/v27/validate.mjs --only=mn` → 727 valid, 0 problems.
Register: polite *Та*, instructions in -на уу / -аарай ("шалгана уу", "эхлээрэй"), verbal nouns on buttons ("Хадгалах", "… харах"), as on Mongolian university and e-mongolia pages.
Placeholders: hyphenated case endings after placeholders ("{{date}}-нд", "{{university}}-ийн") follow the existing bundle's "{{product}}-д" convention; for country names, "{{country}} улсад / улсын" is used instead, because the ending changes with the name.

## Personas

1. **Номин, 18, Улаанбаатар** — 12th-grader, wants a bachelor's in Korea, TOPIK 2, reads everything on her phone.
2. **Тэмүүлэн, 27, Дархан** — engineer, master's applicant, IELTS 6.5, checks every requirement and visa detail.
3. **Номин's mother, Оюунчимэг, 47, Эрдэнэт** — sponsor, pays tuition and provides the bank statement; needs plain, trustworthy money wording.

## Glossary

| English | Korean | Mongolian rendering |
|---|---|---|
| scholarship | 장학(금) | тэтгэлэг |
| Global Korea Scholarship (GKS) | 정부초청장학 | Солонгосын Засгийн газрын тэтгэлэг (GKS) |
| admission guide | 모집요강 | элсэлтийн журам |
| apostille | 아포스티유 | апостиль |
| consular legalization | 영사확인 | консулын баталгаажуулалт (the Mongolian MFA term; existing bundle term) |
| Korean language institute | 어학당 | (их сургуулийн дэргэдэх) солонгос хэлний төв |
| Korean language program (level) | 어학연수 | солонгос хэлний бэлтгэл |
| admission letter | 표준입학허가서 | элсэлтийн зөвшөөрлийн бичиг |
| residence card | 외국인등록증 | гадаад иргэний бүртгэлийн үнэмлэх |
| tuition | 등록금 | сургалтын төлбөр |
| counselor | 상담사 | зөвлөх |
| Hangyul team | 한귤 상담팀 | Hangyul-ийн баг |
| plan (paid) | 플랜 | багц |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | санхүүгийн нотолгоо / банкны үлдэгдлийн тодорхойлолт |
| embassy / consulate | 대사관 / 영사관 | Элчин сайдын яам (ЭСЯ) / консулын газар |
| immigration office | 출입국관리사무소 | цагаачлалын алба |
| CCVI | 사증발급인정서 | виз олгохыг баталсан гэрчилгээ (CCVI) |
| e-visa | 전자비자 | цахим виз |
| TB certificate | 결핵 진단서 | сүрьеэгийн шинжилгээний бичиг |
| notarized | 공증 | нотариатаар баталгаажуулсан |
| Recommended (sort) | 추천순 | Санал болгосон (browsing order, explicitly "чансаа биш") |
| account | 계정 | бүртгэл |
| My progress | 내 여정 | Миний явц / Таны бэлтгэлийн явц |

## Pass A — meaning (6 strings changed)

Main risk found: "тэнцэх" (to pass/be admitted) was used for "eligible / qualify" in two places, which reads as an admission promise; it was replaced with "шаардлага хангах" (meets the requirements).

| key | before | after |
|---|---|---|
| marketing:home.show.match.p1 | Хөтөлбөр бүрт: тэнцэнэ, ойрхон эсвэл одоохондоо үгүй | Хөтөлбөр бүрт: шаардлага хангана, ойрхон эсвэл одоохондоо үгүй |
| marketing:v7.why.realistic.text | … яагаад тэнцэж байгааг … | … яагаад шаардлага хангаж байгааг … |
| common:uni27.schol.youMay | Таны тохирч магадгүй тэтгэлгийн нөхцөл | Та дараах тэтгэлгийн нөхцөлийг хангаж магадгүй |
| common:fit.lede | … Анхаарах ёстой бүх их сургуулийг … ("must consider") | … Анхаарч үзэх нь зүйтэй бүх их сургуулийг … ("worth considering") |
| mobile:v3.home.stageLine.admission | … Одоо байраа баталгаажуулж байна (reads as "your dorm") | … Одоо элсэлтээ баталгаажуулж байна |

## Pass B — native naturalness (19 strings changed)

| key | before | after |
|---|---|---|
| common:fit.order | … Hangyul эдгээр их сургуулиас {{verified}}-ийн элсэлтийн шаардлагыг шалгасан. | … Hangyul эдгээрээс {{verified}} их сургуулийн элсэлтийн шаардлагыг шалгасан. |
| common:fit.gpa.percent | 100-аас (хувь) | 100-гаас (хувиар) |
| visaroute:state.OTHER_RESIDENCE | Та {{country}}-д амьдардаг … | Та {{country}} улсад амьдардаг … |
| student:dashboard.arrival.title | … Ирэх төлөвлөгөөгөө гаргацгаая | … Ирэх бэлтгэлээ хамт төлөвлөе |
| student:matches.tierText.REACH | Та ойрхон байна. … | Та зорилгодоо ойрхон байна. … |

## Pass C — UI context, brevity, consistency (6 strings changed)

| key | before | after |
|---|---|---|
| common:fit.submit | Миний их сургуулиудыг харах | Их сургуулиудаа харах |
| common:fit.more | Цааш харах ({{count}}) | Дахиад харуулах ({{count}}) |
| student:support.created | … Танай баг энд хариулна | … Баг тань энд хариулна |
| visaroute:form.field.jurisdiction_area | Бүс нутаг (хаана мэдүүлэхийг тодорхойлно) | Бүс (мэдүүлэх газрыг тодорхойлно) |
| visaroute:staff.notVerified | … Жагсаалт болгон бүү ашигла | … Шалгах жагсаалт болгон бүү ашиглаарай |

## Source change during the review (13 strings synced, not a review pass)

While this review ran, `strings.json` dropped `common:uni27.schol.count_one` and `common:fit.unlock_one` (now 727 keys), and `validate.mjs` started forcing every `fit.test.*` key to the bare source name in Latin script, for every locale. The draft had "TOPIK шалгалт", "Сэжон хааны хүрээлэн (King Sejong)" and so on; all 13 `fit.test.*` values in `mn.json` now equal the English source, so the file matches what will ship.

## Final comparison

All 727 source ↔ target pairs re-read side by side after Pass C. Placeholders and `<em>` tags identical; "тэнцэх" now appears only where the English itself talks about getting in (or denies a chance of it), never as an implied promise; "Санал болгосон" explained as a browsing order; one term per concept (тэтгэлэг, элсэлтийн журам, апостиль, консулын баталгаажуулалт, солонгос хэлний төв, бүртгэл, багц). Result: no remaining meaning differences found.

## Strings I am unsure of

- **Test names**: the validator now forces `fit.test.KIIP`, `fit.test.KING_SEJONG` and `fit.test.UNIV_KLI` to English ("KIIP integration program", "King Sejong Institute", "University Korean course"). Those three are descriptions, not brand names, and a Mongolian student would read them better translated ("Сэжон хааны хүрээлэн", "Их сургуулийн солонгос хэлний сургалт").
- Hyphenated endings on placeholders (`{{university}}-ийн`, `{{date}}-нд`, `{{until}}-аас`) follow the bundle convention, but the correct ending depends on the inserted word; a native editor may prefer rewording them.
- `v9.funds.*` government tiers rendered «зөвлөгөө авах» (consulting) / «шилдэг» (excellent); there are no official Mongolian names.
- `fit.level.ASSOCIATE` — "Дипломын дээд (коллеж)" is the closest Mongolian level to the Korean 전문학사.
- Korean place names (Хыксок, Тунён, Тэхва, Гунжу, Пуё) follow common Mongolian spellings; usage varies.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Өргөдөл гаргахад хэлний оноо шаардахгүй. Элсэн орсны дараа {{tests}} ба түүнээс дээш оноотой байх шаардлагатай.
- `fit.reason.far` → {{options}} ба түүнээс дээш шаардлагатай. Энэ нь таны одоогийн онооноос нэлээд өндөр.
- `fit.tier.UNCLEAR.title` → Одоогоор хол байна
- `fit.tier.UNCLEAR.short` → Илүү бэлтгэл
- `fit.tier.UNCLEAR.lede` → Таны одоогийн оноо нийтэлсэн шаардлагаас нэлээд доогуур байна. Бэлтгэлдээ илүү хугацаа гаргаад дахин шалгана уу.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
