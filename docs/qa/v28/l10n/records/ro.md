# V28 l10n review: Romanian (ro)

Input: `scripts/i18n/v28/jobs/ro.json` (370 keys). Output: `scripts/i18n/v28/tx/ro.json` (370 job keys + 10 `_few` forms = 380 strings).
Register: informal *tu* on student and agency surfaces, as in the existing bundle; university console keeps the existing *voastră / Ați* form.
Orthography: ș/ț with comma below, „…” quotes. Brand: "Hangyul Univ" / "Hangyul", undeclined ("echipa Hangyul", "studenții Hangyul").

## Personas

- **Ioana, 18, Cluj-Napoca (first-time visitor).** In her last year of liceu, TOPIK 2, lands on a university page from a search and wants to know quickly if it is for her and who will help.
- **Andrei, 27, Iași (comparison shopper).** Compares English-taught master's programs and the Hangyul packages against agencies; reads every condition and distrusts vague promises.
- **Mihaela, 50, Ioana's mother.** Pays the tuition; wants to know what the money covers and who to call in an emergency.
- Console readers: an agency case manager (fast labels) and a university admissions officer (formal, precise).

## Glossary

| English | Korean | Romanian (chosen) |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | echipa Hangyul (replaces every former "consilierul tău") |
| scholarship | 장학 | bursă |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS), "bursa guvernului coreean" in prose |
| admission guide | 모집요강 | ghidul de admitere |
| apostille | 아포스티유 | apostilă |
| consular legalization | 영사확인 | supralegalizare consulară |
| legalization (doc column) | 인증 | legalizare |
| application (to a university) | 지원서 | candidatură (never "aplicație") |
| to apply (visa) | 신청하다 | a depune cererea |
| offer | 합격 | ofertă |
| enrollment | 등록 | înmatriculare |
| intake | 모집 회차 | sesiune de admitere |
| cohort | 기수 | promoție |
| plan (paid) | 플랜 | pachet |
| tuition | 등록금 | taxa de școlarizare |
| dormitory | 기숙사 | cămin |
| residence card | 외국인등록증 | permis de ședere |
| proof of funds | 재정 증빙 | dovada fondurilor |
| e-visa | 전자비자 | viză electronică |
| TB test | 결핵 검사 | testul TBC |
| deadline | 마감일 | termen |
| owner (case/task) | 담당자 | responsabil |
| task | 할 일 | sarcină |
| match | 매칭 | potrivire |
| Needs more preparation (far tier) | 준비 필요 | Mai e nevoie de pregătire |
| Recommended (sort) | 추천순 | Recomandate (ordine de navigare) |
| pipeline | 파이프라인 | parcurs |
| post (embassy/consulate) | 공관 | misiune (diplomatică) |

## Pass A: meaning (24 strings changed)

1. `concierge:help.route.*`, `dossier:reason.IN_REVIEW`, `visaroute:*` (17 strings) "Consilierul tău…" → "Echipa Hangyul…". The English now names the team, not a personal counselor.
2. `common:fit.tier.CHALLENGE.lede` "Nimic din ce știm nu te exclude. Nu am verificat încă cerințele actuale…" → "Hangyul nu a verificat încă cerințele acestor universități pentru acest nivel. Le verificăm împreună cu tine." (source rewritten in V28).
3. `university:v22.stageHint.decision` "Pe lista de așteptare — decizia ne aparține încă" → "Pe lista de așteptare. Decizia este încă în curs". The draft said "the decision is still ours".
4. `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME` "Studenții fără cunoștințe de coreeană…" → "Studenții din unele țări fără un rezultat la un test de coreeană…". No test result ≠ no knowledge.
5. `visaroute:step.slow_items.why` "Confirmările, testul TBC…" → "Supralegalizările, testul TBC…". Legalization, never "confirmation".

Others: `university:v8.aq.need` ("Ce trebuie decis" → "Necesar pentru decizie"), `v22.manage.teamManage`, `marketing:v20.uni.why.foundedBody` (overstated "cea mai lungă tradiție"), `v20.uni.why.ieqasBody` ("criterii mai flexibile" → "verificare de viză mai simplă").

## Pass B: native naturalness (22 strings changed)

1. `marketing:v20.uni.ctaTitle` "Ești gata să iei asta în serios?" → "Te gândești să candidezi aici?"
2. `marketing:v15.pricing.lede` "O evaluare, candidaturile sau acomodarea după sosire. Alege cât de departe te sprijinim." → "Alege cât ajutor vrei: o evaluare inițială, candidaturile sau acomodarea după sosire."
3. `agency:v9.ops.unpaid.q` "Cine a plătit pentru un serviciu și nu are pe nimeni responsabil de caz?" → "Ce studenți au plătit un serviciu, dar nu au un responsabil de caz?"
4. `marketing:seo.home.description` "…și treci prin viză și sosire…" → "…și rezolvă viza și sosirea…"
5. `concierge:emergency.note` "…sună mai întâi — apoi anunță-ți consilierul." → "În caz de urgență, sună mai întâi. Apoi anunță echipa Hangyul." (no dash chains)

Others: `housing.honest` (dash removed), `residence.groupUnknown` ("cardul de rezident" → "permisul de ședere", glossary), `v9.money.note.*`, `university:kpi.insufficientDetail`, `v22.in.byProgramFoot`, `v25.in.*`, `form.source.missing`, `step.apply.title`, `step.slow_items.title`.

## Pass C: UI context, brevity, one term per concept (22 strings changed)

1. `marketing:v15.pricing.compare.row.dormitory` / `student:v15.services.scope.dormitory_support` "Sprijin pentru cămin" → "Cămin" (source is now the bare noun).
2. `student:v16.pay.chooseSubtitle` "Alege planul…" → "Alege pachetul…" (plan = pachet everywhere).
3. `student:v26.now.owner.STUDENT` "Ține de tine" → "Tu" (owner column label).
4. `dossier:check.title` "Am găsit aceste informații. Te rugăm să le verifici." → "Verifică ce am găsit" (it is a heading).
5. `marketing:v24.uni.academicTitle` "Specializări și campusuri" → "Programe și campusuri" (program = program everywhere).

Others: `discover.why` ("verdict" → "potrivire"), `agency:docs.sc.checks` (slash removed), `v8.view.docs`, `fit.tier.*.title/lede`, `v6.unis.title`, `v20.uni.whyTitle`, `v20.uni.intlTitle`.
Plurals: Romanian `_few` (0, 2–19) added for all 10 `_other` keys; `_other` (20+) takes "de" ("{{count}} de semestre"), `_few` does not.

## Final source ↔ target comparison

All 380 strings re-read against `en` and `ko` (담당자, 공관, 기수). Placeholders and arrows intact; no wording implies admission probability; far tier = "Mai e nevoie de pregătire"; GKS keeps the official English name. Validator: `node scripts/i18n/v28/validate.mjs --only=ro` → 380 valid, 0 problems.

## Marketing scorecard (clarity / trust / naturalness / brevity / CTA / cultural fit, 5 each)

| Section | Before | After |
|---|---|---|
| Pricing (`v15.pricing.*`) | 20 (4/4/3/3/3/3) | 27 (5/5/4/4/5/4) |
| University page CTA & why (`v20.uni.*`, `v28.uni.why.*`) | 21 (4/3/3/4/3/4) | 27 (5/5/4/4/4/5) |
| City pages (`v20.city.*`) | 26 (kept) | 26 (5/4/4/4/4/5) |
| Home/SEO, journey, unis title, FAQ | 22 (4/4/3/4/3/4) | 26 (5/5/4/4/4/4) |

## Unsure

- `agency:v8.ops.deadlines.q` / `v27.stage.recent`: "{{count}} zile" without "de" for 20+; kept the administrative form.
- `ws.block.deadline_one` / `v8.ops.deadlines.inDays_one`: "în {{count}} zi" (placeholder required) rather than the more natural "într-o zi".
- `visaroute:staff.post` "Misiune" for the embassy/consulate post; a reviewer may prefer "Ambasadă/consulat".
- `university:v28.pipe.*` "Parcurs" for pipeline; "Pâlnie" is the marketing term but reads oddly here.
- `v20.uni.why.ieqasExcellent` "IEQAS: excelentă": official Romanian rendering of the grade unknown.

## Counts

Job keys 370 · kept verbatim 48 · rewritten 68 · newly translated 254 · extra `_few` forms 10.

## Second pass (jobs2)

Input: `scripts/i18n/v28/jobs2/ro.json` (630 keys: marketing 2, student 39, success 465, dossier 124; all `current` null).
Output: `scripts/i18n/v28/tx2/ro.json`. Same rules, personas and first-pass glossary (no new terms). Student-facing
"your counselor" → the Hangyul team throughout (success `item.*`, `submission.*`, dossier reasons/findings); `{{counselor}}`
placeholders and the agency console label `agency.ownerShort.counselor` keep the person/role. Gendered `{{label}}`
inserts are handled with "{{label}}: …" constructions so no adjective has to agree with an unknown noun. The optional
adjective slot `dossier:upload.status.*` (NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION) stays empty as in English;
`upload.haveTitle*` were rebuilt around a fixed noun ("un document {{status}} ({{doc}})") so the slot reads correctly empty or filled.

Counts: job keys 630 · kept verbatim 0 · rewritten 0 · newly translated 627 + 3 intentionally empty · extra `_few` forms 7 (`_other` uses "de" for 20+).
Passes: A meaning (630 compared with `en`/`ko`; 22 counselor→team fixes), B naturalness, C UI brevity/one term per concept;
final source↔target comparison clean. Marketing: only 2 informational lines (`v20.uni.intl.*`), not CTA copy; scored
26/30 as a section.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ro` → 0 problems.

Examples (before = English source → after):
- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}}: mai e nevoie de supralegalizare consulară*
- `success:item.FINAL_CHECK.why`: *Your counselor checks the whole application once…* → *Echipa Hangyul verifică o dată întreaga candidatură, apoi poate fi depusă.*
- `student:workspace.todoCount_other` / `_few`: → *Mai e nevoie de tine pentru {{count}} de documente.* / *… {{count}} documente.*
- `success:submission.authorize.check`: → *Autorizez {{agency}} să depună această candidatură la {{university}} în numele meu.*
- `dossier:reason.NEEDS_TRANSLATION`: → *{{university}} cere o traducere autorizată în coreeană sau engleză.*

Unsure (second pass):
- "al {{university}}" (portal of) assumes the name works with the masculine genitive article; feminine names would need "a".
- "Taxă de candidatură" for the application fee, kept separate from *taxa de școlarizare*.
- Count-first base keys (`page.needYou`, `finding.more`, `check.matching`) use "Label: {{count}}" to avoid de/no-de agreement.
- `queue.fixture` keeps "Fixture".

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
