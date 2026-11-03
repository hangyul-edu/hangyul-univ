# V28 l10n review: hu (magyar)

Scope: all 370 keys in `scripts/i18n/v28/jobs/hu.json`. Output: `scripts/i18n/v28/tx/hu.json`. Register: students `te`
(as in the bundle), agency and university consoles `Ön`/`Önök`. Brand "Hangyul Univ" / "Hangyul" stays Latin. The
student-facing team is "a Hangyul csapata" (never "a tanácsadód"). V27 glossary (`docs/qa/v27/l10n/hu.md`) reused.

## Personas

1. **Lili, 18, Debrecen: first-time visitor.** Final gimnázium year, TOPIK 2, lands on the home page and a university page
   with no idea what an IEQAS or a D-2 is. Needs plain, warm wording and no unexplained terms.
2. **Bence, 27, Győr: comparison shopper.** Compares three universities and two pricing plans side by side for an
   English-taught master's. Reads every condition literally; wants identical terms in the compare table and the cards.
3. **Katalin, 50, Lili's mother (payer), plus agency/university staff reading the consoles.** Wants to know who is paid
   and when; staff want short, unambiguous labels in `Ön` register.

## Glossary

| English | Korean | Hungarian (chosen) |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | a Hangyul csapata |
| scholarship | 장학금 | ösztöndíj |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); short label "GKS" |
| admission guide | 모집요강 | felvételi tájékoztató |
| apostille | 아포스티유 | Apostille |
| consular legalization | 영사확인 | konzuli felülhitelesítés |
| legalization (document column) | 공증·인증 | hitelesítés |
| Korean language institute | 어학당 | koreai nyelvi intézet |
| offer | 합격 | felvételi ajánlat / ajánlat |
| enrollment | 등록 | beiratkozás |
| intake | 모집 학기 | felvételi időszak |
| program | 과정 | képzés |
| plan (paid) | 플랜 | csomag |
| tuition | 등록금 | tandíj |
| dormitory | 기숙사 | kollégium |
| residence card | 외국인등록증 | tartózkodási kártya |
| proof of funds | 재정 증명 | anyagi fedezet igazolása |
| e-visa | 전자비자 | e-vízum |
| TB test | 결핵 검사 | TBC-vizsgálat |
| case / case owner | 케이스 / 담당자 | ügy / felelős |
| match | 매칭 | egyezés |
| Needs more preparation (far tier) | 준비가 더 필요한 대학 | Több felkészülést igényel |
| deadline | 마감 | határidő |
| receipt number | 접수번호 | átvételi szám |
| post (embassy/consulate) | 공관 | képviselet |

## Pass A: meaning (44 strings changed)

All 20 strings that said "a tanácsadód" (your counselor) now name the Hangyul team; the 7 quick-fit tier strings follow the
V28 English (the far tier is "needs more preparation", not a distance metaphor); dormitory labels follow "Dormitory".

- `concierge:help.route.HOUSING`: *A tanácsadód* → *A Hangyul csapata*
- `common:fit.tier.UNCLEAR.title`: *Egyelőre még hosszú az út* → *Több felkészülést igényel*
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *…koreaiul nem beszélő hallgatóknak…* → *…koreai nyelvvizsga nélküli hallgatóknak…* (English says "without a Korean test result")
- `university:v22.stageHint.decision`: *Várólistán – a döntés még a miénk* → *Várólistán. A döntés még függőben van.*
- `marketing:v6.unis.title`: *Egyetemek, amelyekért megéri útra kelni.* → *Egyetemek szerte Koreában.*

## Pass B: native naturalness (8 strings changed)

- `marketing:v20.city.Busan.body`: *…és egy nyár, amelyre egész Korea ideutazik.* → *…nyáron pedig egész Korea ide utazik.*
- `marketing:v20.city.Gyeonggi.body`: *…saját kollégiummal közös albérletek utcája helyett.* → *…és saját kollégiumuk van, nem egy utcányi közös albérlet.*
- `student:v16.pay.chooseSubtitle`: *…amely illik ahhoz, amiben a Hangyul segítségét kéred.* → *…amely annyi segítséget ad, amennyit a Hangyultól szeretnél.*
- `visaroute:step.slow_items.why`: *…hetekig tart.* → *…hetekig tartanak.* (plural subject)
- `university:v25.in.visaToEnrol`: *Beiratkozott vízum után* → *Vízumkiadás után beiratkozott*

## Pass C: UI context, brevity, one term per concept (4 strings changed; new strings drafted to the glossary)

- `agency:v25.today.student_silent`: *diák nem válaszol* → *hallgató nem válaszol* (one term: hallgató)
- `student:v26.now.owner.STUDENT`: *Rajtad* → *Te* (owner column label, parallel to "A Hangyul csapata")
- `university:kpi.insufficientDetail`: *{{n}} rekord alapján – {{min}}-tól jelenik meg* → *{{n}} rekord alapján. Legalább {{min}} rekordtól jelenik meg.* (no suffix glued to a placeholder)
- `visaroute:step.slow_items.title`: *Kezdd a lassú tételekkel* → *Kezdd a leglassabban beszerezhető iratokkal*
- New: `student:settings.data.due` drafted as *határidő: {{date}}* instead of *{{date}}-ig* (suffix depends on the date's last digit).

## Final source ↔ target comparison

All 370 compared against `en` (and `ko` where the English was terse: `consult.channelLabel` = Mód, `v15.readiness.READY` =
Beadható). Placeholders/tags identical (validator). No "konzuli megerősítés"; 영사확인 is always *konzuli felülhitelesítés*.

## Marketing scorecard (clarity / trust / naturalness / brevity / CTA / cultural fit, 5 each)

| Section | Draft | Final | Change after draft |
|---|---|---|---|
| SEO home description (kept) | 26 | 26 | — |
| Journey eyebrow | 22 | 26 | *Hallgatói út* → *Lépésről lépésre* |
| Pricing (lede, compare rows, Premium f5) | 23 | 26 | lede transcreated, leads with "Te döntöd el" |
| City pages (Busan, Gyeonggi, Seoul line) | 24 | 27 | idiomatic second paragraphs |
| University page (why-cards, CTA, GKS/English cards) | 23 | 26 | CTA title *Ide jelentkeznél?* (draft "Gondolkodsz azon, hogy…" too long) |
| Universities list title | 25 | 26 | — |
| FAQ languages answer | 25 | 26 | "ember még egyiket sem lektorálta" |

## Unsure

- `marketing:v28.uni.why.gks` *Részt vesz a GKS-ben*: label keeps the acronym only; the body spells out Global Korea Scholarship (GKS).
- `agency:v15.plan.PREMIUM` *Prémium*: if the plan name must match a Latin "Premium" elsewhere, revert.
- `visaroute:staff.post` *Képviselet* for the embassy/consulate post.
- `agency:v28.stage.of` *{{n}}/{{total}}. szakasz* (reads "stage n/total"); `a(z) {{university}}` article hedges.
- `success:item.ESSAY_WRITE.title` *Írd meg: {{labelLower}}* and `student:v4.ws.team.approvedEssay` *Jóváhagyta: {{essay}}* use a colon to avoid case agreement with the inserted label.

## Counts

Job keys 370 · kept verbatim 60 · rewritten 56 · newly translated 254 · extra plural forms 0 (Hungarian: one/other).
Validator: `V28 l10n (1 locales): 370 strings valid, 0 problems`.

## Second pass (jobs2): leak families the crawl missed

Scope: `scripts/i18n/v28/jobs2/hu.json`: marketing 2 · student 39 · success 465 · dossier 124 = **630 job keys** (Hungarian: one/other only).
Output `scripts/i18n/v28/tx2/hu.json`. Same personas, glossary and method as above. The first-pass glossary terms are reused
unchanged: jelentkezés (application) · benyújt/bead (submit) · meghatalmazás (authorization) · jelentkezési díj · igazolás (receipt) · esszé · konzuli felülhitelesítés · Apostille · a Hangyul csapata. Student-facing "your counselor" → the Hangyul team throughout; console `{{counselor}}` name placeholders
and the agency `ownerShort.counselor` column keep the role word.

Passes: A meaning (counselor → team, authorization ≠ calque, "Strong/Possible match" = first-pass `group.*` labels), B naturalness,
C UI brevity and placeholder-safe word order (count-first plurals turned into «label: {{count}}» where a bare fallback key exists).
Marketing (2 keys, `v20.uni.intl.*`): scored 26/30 (clarity 5, trust 5, naturalness 4, brevity 4, CTA 4, cultural fit 4) after one rewrite.

Examples (draft → final):
- `success:submission.docs`: *Dokumentumok: {{total}}/{{ready}} ellenőrizve* → *Dokumentumok: {{ready}}/{{total}} ellenőrizve (order fixed in 5 strings)*
- `success:workspace.owner.review.university`: *…A döntés általában 3–6 hét.* → *…A döntés általában 3–6 hétig tart.*
- `success:item.ELIG_EDUCATION.title`: *…amely még nincs meg* → *A képzéshez olyan végzettség kell, amellyel még nem rendelkezel*
- `success:item.DOC_REVIEW_LATE.why`: *…Szóltunk a tanácsadódnak.* → *A szokásosnál tovább tart. A Hangyul csapata már tud róla.*
- `success:item.INTERVIEW_SCHEDULED.title`: *Készülj fel a(z) {{university}} interjúra* → *Készülj fel az interjúra ({{university}}) (no suffix/article on placeholders)*

Unsure:
- Placeholders that would need Hungarian case suffixes or a/az ({{university}}, {{portal}}, {{agency}}) are placed after a colon or in parentheses («ide: {{university}}»); correct but less fluent than inflected text.
- `success:item.EDUCATION_EXPECTED.title` «Az érettségi vagy diploma után leszel jogosult» covers both school and degree graduation.
- `dossier:upload.haveTitle*` relies on the status words being plain adjectives (ellenőrzött / lejárt) or empty.
- `success:block.title_one`, `block.inChecklist_one`, `line.more_one`: `_one`-only keys with no `_other`, so no extra forms can be added; the English has a literal 1, kept as a word/digit.
- `dossier:upload.status.NEEDS_REVIEW` / `UPLOADED` / `NEEDS_CORRECTION` are intentionally empty (validator requires empty); `upload.haveTitle*` was built so the empty status slot reads cleanly.
- `page.needYou` and `check.matching` are bare fallback keys beside `_one`; written as «label: {{count}}» so they are grammatical for any count.

Counts: job keys 630 · kept verbatim 0 (no `current` values) · rewritten 0 · newly translated 630 · extra plural forms 0.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=hu` → `630 strings valid, 0 problems` (EXIT=0).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
