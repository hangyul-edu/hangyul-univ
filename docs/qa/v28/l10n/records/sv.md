# V28 l10n review — Swedish (sv)

Scope: every key of `scripts/i18n/v28/jobs/sv.json` (370 keys: 254 with no translation, 116 with an existing `current`). Output: `scripts/i18n/v28/tx/sv.json`.
Register: **du** for students and consoles, matching the bundle and V27 (*utbildning*, *ansökan*, *paket*, *Hangyul-teamet*, *Skrivande* for the Writing section, *sista dag* for deadline).

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/sv.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Elsa, 19, Göteborg** | just finished gymnasiet, first-time visitor, wants a language year then a kandidatprogram | friendly du copy, short buttons |
| **Ahmed, 28, Stockholm** | civilingenjör comparing English-taught master options across services (comparison shopper) | precise terms: apostille, konsulär legalisering |
| **Karin, 51, Elsas mamma** | pays studieavgift | clear money wording, no admission promises |

## Glossary

| English | Korean | Swedish | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | stipendium |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) |  |
| admission guide | 모집요강 | antagningsinformation |  |
| apostille | 아포스티유 | apostille |  |
| consular legalization | 영사확인 | konsulär legalisering | never *bekräftelse* |
| certificate of enrollment | 재학증명서 | intyg om inskrivning |  |
| Korean language institute | 어학당 | språkinstitut (för koreanska) |  |
| D-2 / D-4 visa | D-2 / D-4 | visum D-2 / D-4 |  |
| e-visa | 전자비자 | e-visum |  |
| residence card | 외국인등록증 | uppehållskort |  |
| proof of funds | 재정 증빙 | bevis på ekonomiska medel |  |
| tuition | 등록금 | studieavgift |  |
| application fee | 전형료 | ansökningsavgift |  |
| application | 지원 | ansökan |  |
| intake | 모집 시기 | antagningsomgång |  |
| program(me) | 과정 | utbildning |  |
| the Hangyul team | 한귤 상담팀 | Hangyul-teamet | replaces every *din rådgivare* |
| plan (paid) | 플랜 | paket |  |
| match | 매칭 | matchning |  |
| Recommended (sort) | 추천순 | Rekommenderas |  |
| Needs more preparation (far tier) | 준비가 더 필요 | Kräver mer förberedelse |  |
| Needs checking with us (unverified tier) | 추가 확인 필요 | Behöver kollas med oss |  |
| dormitory | 기숙사 | studentboende |  |
| enrollment | 등록 | inskrivning |  |
| consular post | 공관 | beskickning |  |
| upload | 업로드 | ladda upp |  |

## Pass A — meaning (58 strings changed)

Every *din rådgivare* → *Hangyul-teamet*; fit tiers re-cut to the V28 English; `step.slow_items.why` *Bekräftelser* → *Legaliseringar*.

| Key | Before | After |
| --- | --- | --- |
| `visaroute:step.slow_items.why` | Bekräftelser, tuberkulostestet och utdrag ur belastningsregistret tar veckor. | Legaliseringar, tbc-testet och utdrag ur belastningsregistret tar veckor. |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Intyg om anställning / inkomst | Intyg om anställning eller inkomst |
| `concierge:help.route.HOUSING` | Din rådgivare | Hangyul-teamet |
| `common:fit.tier.UNCLEAR.title` | Långt kvar just nu | Kräver mer förberedelse |
| `common:fit.tier.CHALLENGE.title` | Värt en närmare titt | Behöver kollas med oss |

## Pass B — native naturalness (11 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:inbox.pickText` | Eller starta ett nytt med en student du stöttar. | Eller starta ett nytt med någon av studenterna du ansvarar för. |
| `agency:v8.view.docs` | Dokumenträttelse krävs | Dokument behöver rättas |
| `concierge:housing.honest` | Vi visar bara uppgifter om studentboenden med källa, och rum som en leverantör faktiskt har gett oss — alla märkta. Vi hittar aldrig på annonser. | Vi visar bara uppgifter om studentboenden med källa, och bara rum som en leverantör faktiskt har erbjudit, alla märkta. Vi hittar aldrig på annonser. |
| `marketing:v15.pricing.compare.value.dormitory_support.APPLICATION` | Stöd med ansökan och alternativ | Hjälp med ansökan, plus alternativ |
| `marketing:v20.city.Busan.body` | Busan är Koreas andra stad och känns inte som ett mindre Seoul. Universiteten ligger mellan stränder och berg, tunnelbanan når de flesta av dem och hyrorna ligger klart under huvudstadens. / Staden har landets största hamn, en etablerad filmfestival och en sommar som resten av Korea reser till. Vintrarna är de mildaste på fastlandet. | Busan är Koreas näst största stad och känns inte som ett mindre Seoul. Universiteten ligger mellan stränder och berg, tunnelbanan når de flesta av dem och hyrorna ligger klart under huvudstadens. / Staden har landets största hamn, en etablerad filmfestival och en sommar som resten av Korea reser till. Vintrarna är de mildaste på fastlandet. |

## Pass C — UI context, brevity, one term per concept (10 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `university:documents.sharingRule` | Studenter delar dokument med er … (draft) | … med dig … (du, as the university bundle) |
| `student:v4.ws.team.approvedEssay` | Godkände din {{essay}} (draft) | Godkände din text: {{essay}} (din/ditt depends on the essay noun) |
| `success:item.ESSAY_WRITE.title` | Skriv din {{labelLower}} (draft) | Skriv din text: {{labelLower}} |
| `agency:docs.sc.checks` | Kryssa i en kontroll / välj ett skäl | Välj en kontroll eller ett skäl |
| `agency:review.verifyHint` | Kryssa i kontrollerna först, eller bekräfta för att verifiera utan dem | Välj kontrollerna först, eller bekräfta för att verifiera utan dem |

(3 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

All keys re-read against `en`/`ko`; placeholders identical; no Hangul; *konsulär legalisering* for 영사확인; no *rådgivare* left.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 5 | 4 | **27** |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 5 | 4 | 4 | 5 | **27** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (22: *Redo att titta på det här på allvar?* → *Funderar du på att söka hit?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `student:v4.ws.team.approvedEssay / success:item.ESSAY_WRITE.title` — colon pattern avoids din/ditt agreement with an unknown noun; slightly stiff.
- `university:v28.pipe.label` — *Flöde och utfall* for "Pipeline and outcomes" — idiomatic but not a fixed term.
- `visaroute:staff.post` — *Beskickning* (embassy or consulate) is correct but formal.
- `marketing:v20.uni.philosophySource` — *{{name}}s* genitive: wrong if a university name already ends in -s.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 370 | 40 | 76 | 254 |

Validator: `node scripts/i18n/v28/validate.mjs --only=sv` → `370 strings valid, 0 problems`.

## Second pass (jobs2): leak families the crawl missed

Input `scripts/i18n/v28/jobs2/sv.json` → output `scripts/i18n/v28/tx2/sv.json`. Same personas, glossary and method as the first pass. Every student-facing *your counselor* → *Hangyul-teamet* (18 strings); the console label `agency.ownerShort.counselor` keeps the console term. Placeholders `{{counselor}}`/`{{name}}` stay the person's name.

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 630 (marketing 2 · student 39 · success 465 · dossier 124) | 0 | 0 | 630 (all `current` were null; 3 keys whose English is empty stay empty) |

- Pass A (meaning): 18 strings changed (*your counselor* → team; consular legalization and apostille kept apart: `item.DOC_LEGALIZE*` vs `item.DOC_LEGALIZE_APOSTILLE*`, `dossier:path.*`).
- Pass B (naturalness): 3 (`obs.SOME_OVER_BUDGET_*` made explicit about cost; `page.privacy` 담당 상담사 → *dina handläggare*; *tacka ja till en plats* for "accepted a place").
- Pass C (UI context, one term per concept): 12 (10 strings *essä* → *uppsats* to match the existing bundle; status chips as verb phrases *(har verifierats)*/*(har gått ut)* so they need no en/ett agreement with `{{doc}}`; *fullmakt* for 위임, *lämna in/inlämning* for submit).
- Final comparison: every key checked against en and ko. The three keys whose English is empty (`dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`) stay empty.

### 5 examples (English shown on the page before → after)

- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}} behöver fortfarande konsulär legalisering*
- `success:item.FINAL_CHECK.why`: *Your counselor checks the whole application once …* → *Hangyul-teamet går igenom hela ansökan en gång, sedan är den klar att lämna in.*
- `success:submission.authorize.check`: *I authorize {{agency}} to submit this application to {{university}} on my behalf.* → *Jag ger {{agency}} fullmakt att lämna in den här ansökan till {{university}} för min räkning.*
- `student:workspace.tabs.essays`: *Essays* → *Uppsatser*
- `success:obs.SOME_OVER_BUDGET_other`: *{{count}} of your applications start above your budget.* → *Kostnaden för {{count}} av dina ansökningar börjar över din budget.*

### Marketing scorecard (2 keys)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v20.uni.intl (officeLine, none) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

### Unsure

- *uppsats* vs *essä*: the bundle mixes both (uppsats ×30, essä ×8); I standardised on *uppsats*.
- `dossier:page.privacy`: *dina handläggare* for 담당 상담사.
- `dossier:upload.haveTitle*` with status *(har verifierats)*; natural only if `{{doc}}` is a bare label.
- `{{university}}s` genitive (`item.SUBMISSION_HANDOFF.title`, `submission.reopen`, `awayTitle`): wrong for names ending in s/x/z.
- `success:queue.fixture` *Testdata* (tautological note, as in the English).

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=sv` → `630 strings valid, 0 problems`.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
