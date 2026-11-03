# V28 l10n review: sr (Српски, ћирилица)

Scope: all 415 keys in `scripts/i18n/v28/jobs/sr.json`. Output: `scripts/i18n/v28/tx/sr.json` (415 job keys plus
11 `_few` plural forms). Script: **Cyrillic**, matching `packages/i18n/locales/sr/` and the V27 record. Variant: ekavian.
Brand, test names and acronyms stay Latin («Hangyul Univ», «тим Hangyul», «Hangyul-а», TOPIK, IELTS, TOEFL iBT, GKS,
IEQAS, NHIS, SLA, OCR, HiKorea). Register: formal «ви» for students; short nominal labels in the consoles.

## Personas

1. **Милица, 19, Нови Сад. First-time visitor.** Has never heard of Hangyul. Lands on a university page from search,
   reads on her phone, and wants to know what the university offers and whether she can apply.
2. **Стефан, 27, инжењер из Београда. Comparison shopper.** Has three tabs open: Hangyul, an agency, and the
   university's own site. Compares plan prices and wants exact visa terms (апостил, конзуларна легализација, е-виза).
3. **Јелена, 34, саветница у агенцији у Београду / администратор пријема на универзитету.** Uses the agency and
   university consoles every day. Wants short labels and one term per concept (предмет, фаза, рок, уписни рок).

## Glossary

| English | Korean | Serbian |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | тим Hangyul (never «ваш саветник» for students) |
| counselor (agency staff) | 상담사 | саветник |
| scholarship | 장학금 | стипендија |
| Global Korea Scholarship (GKS) | 정부초청장학(GKS) | Стипендија корејске владе (GKS) |
| admission guide | 모집요강 | правила уписа |
| admission rules (program) | 입학 규칙 | правила уписа |
| apostille | 아포스티유 | апостил |
| consular legalization | 영사확인 | конзуларна легализација |
| Korean language institute | 어학당 | језички центар при универзитету |
| residence card | 외국인등록증 | боравишна картица |
| proof of funds | 재정 증빙 | доказ о средствима |
| TB test | 결핵 검사 | тест на туберкулозу |
| police certificate | 범죄경력증명서 | уверење из казнене евиденције |
| e-visa | 전자비자 | е-виза |
| post (embassy/consulate) | 공관 | представништво |
| intake | 모집 회차 | уписни рок |
| deadline | 마감일 | рок |
| case / case stage | 케이스 / 단계 | предмет / фаза предмета |
| owner (case/task) | 담당자 | задужена особа |
| offer | 합격 | понуда |
| enrollment | 등록 | упис |
| cohort | 기수 | генерација |
| document vault | 서류 보관함 | сеф за документа |
| tuition / tuition waiver | 등록금 / 감면 | школарина / ослобођење од школарине |
| dormitory | 기숙사 | студентски дом |
| match / possible match | 매칭 | подударање / могуће подударање |
| GPA | 평점 | просек |
| plan (paid) | 플랜 | план |
| Writing (section) | 글쓰기 | Писање |
| pipeline | 파이프라인 | ток пријава |

## Pass A: meaning (34 strings changed)

20 strings still said «(ваш) саветник» where the English now says "the Hangyul team"; all now say «тим Hangyul».
The rest followed V28 source rewrites (fit tiers, pricing, plan features) or fixed meaning drift.

| Key | Before | After |
|---|---|---|
| concierge:emergency.note | …затим обавестите свог саветника. | …Затим обавестите тим Hangyul. |
| common:fit.tier.CHALLENGE.title | Вреди погледати | Треба проверити са нама (tier now means "not yet verified", no chance wording) |
| common:fit.tier.UNCLEAR.title | Засад је пут још дуг | Потребно је више припреме |
| marketing:v15.pricing.premium.f5 | Пријава за студентски дом, онлајн упутство пре поласка и 30 дана… | Студентски дом, долазак и 30 дана помоћи при сналажењу |
| university:v22.stageHint.decision | На листи чекања — одлука је још на нама | На листи чекања. Одлука још није донета (the university decides, not «нас») |

## Pass B: native naturalness (21 strings changed)

| Key | Before | After |
|---|---|---|
| dossier:check.title | Пронашли смо ове податке. Молимо проверите их. | Проверите шта смо пронашли |
| marketing:v20.uni.why.foundedBody | Што га чини једном од установа са дужом традицијом… | То га сврстава међу старије установе у регистру. (sentence fragment fixed) |
| agency:v9.ops.unpaid.q | Ко је платио услугу, а нико није задужен за његов предмет? | Који студенти су платили услугу, а немају задужену особу за предмет? |
| common:fit.summary.MEETS | (new) {{formatted}} од њих већ испуњава… | Код {{formatted}} од њих већ испуњавате објављене минималне услове. (the student meets, not the university) |
| visaroute:step.slow_items.why | Потврде, тест на туберкулозу… | Легализације, тест на туберкулозу… |

## Pass C: UI context, brevity, one term per concept (24 strings changed)

| Key | Before | After |
|---|---|---|
| student:v26.now.owner.STUDENT | На вама | Ви (owner column, parallel to «Тим Hangyul») |
| student:v15.services.scope.dormitory_support | Подршка за дом | Студентски дом (same term as pricing row) |
| agency:ws.visaIssued | (new) Издата | Датум издавања (date field label) |
| university:v25.in.yield | Уписани од примљених | Понуде које су довеле до уписа |
| agency:ws.docsHint | (new) …из студентовог трезора… | …из студентовог сефа за документа… (existing bundle term) |

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit)

| Section | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|
| SEO / home description | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| Pricing (lede, compare rows, premium f5) | 5 | 5 | 5 | 4 | 4 | 4 | 27 |
| City pages (Seoul, Busan, Gyeonggi, Gyeongnam) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |
| University page (why, CTA, office, philosophy, GKS, English degrees) | 5 | 5 | 4 | 5 | 5 | 4 | 28 |
| FAQ languages answer | 5 | 5 | 4 | 3 | 4 | 5 | 26 |
| Footer / journey eyebrow / universities title | 5 | 4 | 5 | 5 | 4 | 5 | 28 |

First drafts below 25 and transcreated: university CTA title («Спремни да се озбиљно позабавите овим?», 21) →
«Размишљате о пријави овде?»; why title («Какав је ово универзитет», 22) → «По чему се издваја».

## Strings I am unsure of

- `success:item.ESSAY_WRITE.title` «Напишите: {{labelLower}}» and `student:v4.ws.team.approvedEssay` «Одобрено:
  {{essay}}». A colon layout avoids case and gender agreement with the inserted essay label, but it reads a little stiff.
- `common:fit.summary.ONE_STEP` «Код {{formatted}} вам недостаје још само један услов.» says "one requirement" where
  the English says "one step". This follows the Korean (한 가지만 보완).
- `visaroute:staff.post` «Представништво» for the diplomatic post (공관). Embassy or consulate, but rare in UI.
- `agency:v8.ops.allN_other` «Прикажи свих {{count}}» / `_few` «сва {{count}}». The gender agrees only with neuter or
  masculine head nouns.
- `university:v7.pr.applicants_*` uses `{{n}}`, not `{{count}}`, in the source. If i18next selects the plural on
  `count`, the `_few` form may never show.

## Final comparison

I compared every source and target string. All `{{placeholders}}` survive, as do the numbers (1,500 → 1.500), the
arrows/÷ signs, and the Latin test names and acronyms. A mixed-script scan (Cyrillic words containing Latin letters)
returns 0. No student-facing string says «саветник». No admission guarantee or probability wording appears. «Препоручено»
is not used as a ranking.

## Counts

- Job keys: 415
- Kept verbatim: 35
- Rewritten: 79 (current existed but changed)
- Newly translated: 301 (current was null)
- Extra plural forms added: 11 `_few`
- Validator: `V28 l10n (1 locales): 426 strings valid, 0 problems`

## Second pass (jobs2)

Input: `scripts/i18n/v28/jobs2/sr.json` (630 keys: marketing 2, student 39, success 465, dossier 124; all `current` null).
Output: `scripts/i18n/v28/tx2/sr.json`. Same rules, personas and first-pass glossary (no new terms). Student-facing
"your counselor" → the Hangyul team throughout (success `item.*`, `submission.*`, dossier reasons/findings); `{{counselor}}`
placeholders and the agency console label `agency.ownerShort.counselor` keep the person/role. Gendered `{{label}}`
inserts are handled with "{{label}}: …" constructions so no adjective has to agree with an unknown noun. The optional
adjective slot `dossier:upload.status.*` (NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION) stays empty as in English;
`upload.haveTitle*` were rebuilt around a fixed noun ("{{status}} документ ({{doc}})") so the slot reads correctly empty or filled.

Counts: job keys 630 · kept verbatim 0 · rewritten 0 · newly translated 627 + 3 intentionally empty · extra `_few` forms 7 (one/few/other: документ/документа/докумената).
Passes: A meaning (630 compared with `en`/`ko`; 22 counselor→team fixes), B naturalness, C UI brevity/one term per concept;
final source↔target comparison clean. Marketing: only 2 informational lines (`v20.uni.intl.*`), not CTA copy; scored
26/30 as a section.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=sr` → 0 problems.

Examples (before = English source → after):
- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}}: још је потребна конзуларна легализација*
- `success:item.ESSAY_REVISE.why`: *Your counselor asked for changes.* → *Тим Hangyul је тражио измене.*
- `student:workspace.todoCount_few`: → *Још {{count}} документа чекају на вас.*
- `success:submission.guided.files_few` / `_other`: → *Припремили смо све {{count}} потребне датотеке* / *свих {{count}} потребних датотека*
- `dossier:reason.NEEDS_LEGALIZATION_APOSTILLE`: → *{{university}} га тражи са апостилом из државе: {{country}}.*

Unsure (second pass):
- University names are not declined; constructions like "портал ({{university}})" avoid case endings but read slightly formal.
- Gendered first-person options ("поднео/ла", "Платио/ла сам") use the slash form.
- "Такса за пријаву" for the application fee; "број предмета" for reference number.
- `queue.fixture` keeps "Fixture".

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
