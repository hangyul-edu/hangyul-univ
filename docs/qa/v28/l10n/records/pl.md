# V28 l10n review: pl (Polski)

Job `scripts/i18n/v28/jobs/pl.json` → `scripts/i18n/v28/tx/pl.json`. Register: friendly «Ty» (capitalised in
student copy, as in the bundle) for students; concise professional Polish in the consoles, «Wasza uczelnia» for
university staff.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Zuzia, 19, Kraków** (first-time visitor) | po maturze, lands on a university page from Google | short buttons, a clear next step, no gendered forms that assume "he" |
| **Michał, 27, Wrocław** (comparison shopper) | compares English-taught magisterium options and pricing tiers | exact visa/document terms (apostille, legalizacja konsularna, dowód posiadania środków) |
| **Pani Ewa, 50, mama Zuzi** | pays czesne | clear money wording, nothing that sounds like a guaranteed place |

## Glossary (reused from V27 pl, extended)

| English | Korean | Polish |
| --- | --- | --- |
| the Hangyul team | 한귤 상담팀 | zespół Hangyul (never «Twój doradca») |
| consular legalization | 영사확인 | legalizacja konsularna |
| legalization (generic) | 공증·인증 | legalizacja |
| apostille | 아포스티유 | apostille (indeclinable) |
| admission guide | 모집요강 | zasady rekrutacji |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) |
| scholarship | 장학금 | stypendium |
| tuition | 등록금 | czesne |
| plan (paid) | 플랜 | plan |
| application | 지원서 | wniosek |
| intake | 모집 학기 | nabór |
| deadline | 마감 | termin |
| offer | 합격 | oferta |
| enrollment | 등록 | zapis (na studia) |
| residence card | 외국인등록증 | karta pobytu |
| proof of funds | 재정 증명 | dowód posiadania środków |
| international office | 국제교류처 | biuro ds. studentów zagranicznych |
| dormitory | 기숙사 | akademik |
| case owner | 담당자 | osoba odpowiedzialna / opiekun sprawy |
| Writing section / essay | 글쓰기 / 에세이 | Pisanie / esej |
| interview | 면접 | rozmowa kwalifikacyjna |
| diplomatic post | 공관 | placówka |
| far quick-fit tier | 준비가 더 필요한 대학 | Potrzebne jest więcej przygotowań |
| match | 매칭 | dopasowanie |
| pipeline | 파이프라인 | lejek |

## Plurals

CLDR pl: one / few / many / other. Every `_other` key in the job (10) now has `_few` and `_many` (20 forms); the one
pair in the job (`v7.pr.applicants`) has all four: wniosek / wnioski / wniosków / wniosku. Agreeing forms are used for
semesters (semestry / semestrów / semestru), programs and `lastMoved` (dni / dni / dnia); count labels use a colon where
agreement would make the label longer («Zaległe: {{count}}»). `_one` never hard-codes «1».
**Not possible in this job:** `agency:v8.ops.deadlines.inDays_one`, `agency:v9.waiting.reason.task_one`,
`agency:ws.block.deadline_one` have no `_other` in the job, so the validator rejects `_few`/`_many` for them. Only `_one`
was translated; their other forms must come from the existing bundle (flag for the next job).

## Pass A: meaning (28 strings changed)

All 20 «doradca» strings now name the Hangyul team; fit tiers follow the V28 English.

| Key | Before | After |
| --- | --- | --- |
| common:fit.tier.UNCLEAR.title | Na razie jeszcze daleka droga | Potrzebne jest więcej przygotowań |
| common:fit.tier.CHALLENGE.title | Warto przyjrzeć się bliżej | Do sprawdzenia razem z nami |
| visaroute:step.slow_items.why | Poświadczenia, badanie na gruźlicę… | Legalizacje, badanie na gruźlicę… |
| university:v22.stageHint.decision | Na liście rezerwowej — decyzja wciąż należy do nas | Na liście rezerwowej. Decyzja jeszcze nie zapadła |
| marketing:v15.pricing.premium.f5 | Wniosek o akademik, orientacja online przed wyjazdem… | Akademik, przyjazd i 30 dni pomocy w aklimatyzacji |

## Pass B: native naturalness (40 strings changed)

| Key | Before | After |
| --- | --- | --- |
| marketing:v20.uni.ctaTitle | Chcesz podejść do tego na poważnie? | Myślisz o studiach tutaj? |
| marketing:v20.uni.whyTitle | Czym jest ta uczelnia | Co ją wyróżnia |
| agency:v8.ops.ageing.title | Wiek spraw według etapu | Czas stania spraw według etapu |
| agency:v9.ops.unpaid.q | Kto zapłacił za usługę, a jego sprawy nikt nie prowadzi? | Którzy studenci zapłacili za usługę, ale nie mają opiekuna sprawy? |
| visaroute:caveat.APOSTILLE_TRANSITION | …od 11 wrz 2026… Twój doradca potwierdzi… | …od 11 września 2026 r.… Zespół Hangyul potwierdzi… |

## Pass C: UI context, brevity, one term per concept (6 strings changed)

| Key | Before | After |
| --- | --- | --- |
| agency:v27.stage.recent (draft) | Ostatnia zmiana: {{count}} dni temu | Dni od ostatniej zmiany: {{count}} (no wrong «1 dni») |
| writing:student.lateShort (draft) | trwa dłużej niż zwykle | trwa dłużej, niż oczekiwano |
| university:v8.aq.need | Potrzebna decyzja | Potrzebne do decyzji |
| visaroute:form.source.missing | Brak w Hangyul | Brak danych |
| agency:docs.sc.checks | Zaznacz kontrolę / wybierz powód | Zaznacz kontrolę lub wybierz powód |

«wniosek» replaces «aplikacja» for application (deadlines.q, byProgramFoot) so it never collides with the mobile app;
«plan» for plan; «akademik» for dormitory rows (not «wsparcie przy akademiku» where the English is just "Dormitory").

## Marketing scorecard (30 points)

| Section | Score | Notes |
| --- | --- | --- |
| SEO / home description | 26 | two sentences, verbs Polish sites use («załatw wizę») |
| Pricing | 26 | lede leads with the choice |
| City pages | 25 | Gyeonggi reworded around travel time; Seoul line new |
| University page | 26 | CTA title as a question; English/GKS/scholarship cards new |
| Universities index + FAQ | 25 | «Uczelnie z całej Korei.» |

## Unsure

- `marketing:v20.uni.why.ieqasExcellent` «IEQAS: poziom wyróżniający»: no official Polish grade name.
- `visaroute:caveat.EVISA_TIER_UNKNOWN` keeps «excellent» / «certified» in English quotes as the V27 bundle did.
- `agency:v8.ops.deadlines.q` «w ciągu {{count}} dni» is ungrammatical for exactly 1 («1 dni»); not a plural key.
- The three `_one`-only plural keys above.

## Final source↔target comparison

Placeholders, numbers (1500 wonów), test names, GKS/IEQAS/SLA/OCR, ÷ and → preserved. Validator:
`390 strings valid, 0 problems` (370 job keys + 20 extra plural forms).

## Counts

Job keys 370 · kept verbatim 42 · rewritten 74 · newly translated 254 · extra plural forms 20.

## Second pass (jobs2): leak families the crawl missed

Scope: `scripts/i18n/v28/jobs2/pl.json`: marketing 2 · student 39 · success 465 · dossier 124 = **630 job keys** + 14 extra plural forms (`_few`/`_many` for the 7 `_other` keys).
Output `scripts/i18n/v28/tx2/pl.json`. Same personas, glossary and method as above. The first-pass glossary terms are reused
unchanged: wniosek (application) · złożyć/złożenie (submit) · upoważnienie / upoważnić (authorization) · opłata rekrutacyjna · pokwitowanie (receipt) · esej · legalizacja konsularna · apostille · zespół Hangyul. Student-facing "your counselor" → the Hangyul team throughout; console `{{counselor}}` name placeholders
and the agency `ownerShort.counselor` column keep the role word.

Passes: A meaning (counselor → team, authorization ≠ calque, "Strong/Possible match" = first-pass `group.*` labels), B naturalness,
C UI brevity and placeholder-safe word order (count-first plurals turned into «label: {{count}}» where a bare fallback key exists).
Marketing (2 keys, `v20.uni.intl.*`): scored 26/30 (clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4) after one rewrite.

Examples (draft → final):
- `success:item.DOC_REVIEW_LATE.why`: *…Powiadomiliśmy Twojego doradcę.* → *Trwa to dłużej niż zwykle. Zespół Hangyul już o tym wie.*
- `success:obs.ADMITTED`: *Przyjęto Twoją akceptację miejsca…* → *Miejsce na {{university}} zaakceptowane. Twój plan jest gotowy.*
- `success:item.FIELD_DIFFERENT.why`: *…jeśli wybrałeś ją celowo.* → *To w porządku, jeśli wybór był celowy. …*
- `success:submission.selfRequired`: *…wymaga, abyś złożył wniosek samodzielnie…* → *{{university}} wymaga samodzielnego złożenia wniosku w {{portal}}. …*
- `dossier:upload.haveTitle_one`: *Masz już {{doc}} ({{status}}), używany…* → *Masz już {{doc}} {{status}} — w użyciu w {{count}} wniosku*

Unsure:
- `success:item.DOC_LEGALIZE_APOSTILLE.title` «wciąż potrzebna apostille»: apostille kept indeclinable (feminine agreement) per glossary.
- `success:submission.authorize.feeValue` «płaci: {{payer}}» where payer is «Ty» (capitalised Ty-form) — reads slightly formal.
- Gendered past forms avoided with impersonal «Zaznaczono…» / «Udzielono…»; `evidence.by` uses «Złożył(a)».
- `success:block.title_one`, `block.inChecklist_one`, `line.more_one`: `_one`-only keys with no `_other`, so no extra forms can be added; the English has a literal 1, kept as a word/digit.
- `dossier:upload.status.NEEDS_REVIEW` / `UPLOADED` / `NEEDS_CORRECTION` are intentionally empty (validator requires empty); `upload.haveTitle*` was built so the empty status slot reads cleanly.
- `page.needYou` and `check.matching` are bare fallback keys beside `_one`; written as «label: {{count}}» so they are grammatical for any count.

Counts: job keys 630 · kept verbatim 0 (no `current` values) · rewritten 0 · newly translated 630 · extra plural forms 14.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=pl` → `644 strings valid, 0 problems` (EXIT=0).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
