# V28 l10n review — Dutch (nl)

Scope: every key of `scripts/i18n/v28/jobs/nl.json` (370 keys: 254 with no translation, 116 with an existing `current`). Output: `scripts/i18n/v28/tx/nl.json`.
Register: informal **je/jij** for students and consoles, matching the bundle and V27 (*opleiding*, *aanmelding*, *pakket*, *het Hangyul-team*, *Schrijven* for the Writing section).

Method: each `current` was compared with the **current** English (Korean consulted where the English is terse) and kept verbatim only when it was correct, natural and still matched; everything else was rewritten. All null keys were translated fresh. Glossary carried over from `docs/qa/v27/l10n/nl.md`.

## Personas

| Persona | Who | Reads for |
| --- | --- | --- |
| **Noor, 18, Utrecht** | vwo-leerling, first-time visitor, wants a Korean-taught bachelor after a language year | friendly je copy, short buttons |
| **Daan, 26, Eindhoven** | engineer comparing English-taught master options across services (comparison shopper) | correct visa terms: apostille, consulaire legalisatie |
| **Marieke, 50, Noors moeder** | pays collegegeld | clear money wording, no admission promises |

## Glossary

| English | Korean | Dutch | Note |
| --- | --- | --- | --- |
| scholarship | 장학금 | beurs |  |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS) |  |
| admission guide | 모집요강 | toelatingsgids |  |
| apostille | 아포스티유 | apostille |  |
| consular legalization | 영사확인 | consulaire legalisatie | never *bevestiging* |
| certificate of enrollment | 재학증명서 | inschrijvingsbewijs |  |
| Korean language institute | 어학당 | (Koreaans) taleninstituut |  |
| D-2 / D-4 visa | D-2 / D-4 | visum D-2 / D-4 |  |
| e-visa | 전자비자 | e-visum |  |
| residence card | 외국인등록증 | verblijfskaart |  |
| proof of funds | 재정 증빙 | bewijs van financiële middelen |  |
| tuition | 등록금 | collegegeld |  |
| application fee | 전형료 | aanmeldkosten |  |
| application | 지원 | aanmelding |  |
| intake | 모집 시기 | instroommoment |  |
| program(me) | 과정 | opleiding |  |
| the Hangyul team | 한귤 상담팀 | het Hangyul-team | replaces every *je adviseur* |
| plan (paid) | 플랜 | pakket |  |
| match | 매칭 | match |  |
| Recommended (sort) | 추천순 | Aanbevolen |  |
| Needs more preparation (far tier) | 준비가 더 필요 | Meer voorbereiding nodig |  |
| Needs checking with us (unverified tier) | 추가 확인 필요 | Samen met ons na te gaan |  |
| dormitory | 기숙사 | studentenhuisvesting |  |
| enrollment | 등록 | inschrijving |  |
| consular post | 공관 | post |  |
| upload | 업로드 | uploaden |  |

## Pass A — meaning (58 strings changed)

Every *je adviseur* → *het Hangyul-team*; fit tiers re-cut to the V28 English; `step.slow_items.why` *Bevestigingen* (confirmations) → *Legalisaties*.

| Key | Before | After |
| --- | --- | --- |
| `visaroute:step.slow_items.why` | Bevestigingen, de tbc-test en verklaringen omtrent gedrag duren weken. | Legalisaties, de tbc-test en verklaringen omtrent het gedrag duren weken. |
| `common:docCategory.EMPLOYMENT_INCOME_PROOF` | Bewijs van werk / inkomen | Bewijs van werk of inkomen |
| `concierge:help.route.HOUSING` | Je adviseur | Het Hangyul-team |
| `common:fit.tier.UNCLEAR.title` | Voorlopig nog een lange weg | Meer voorbereiding nodig |
| `common:fit.tier.CHALLENGE.title` | Het bekijken waard | Samen met ons na te gaan |

## Pass B — native naturalness (12 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `agency:inbox.pickText` | Of begin een nieuw gesprek met een student die je begeleidt. | Of begin een nieuw gesprek met een van de studenten die je begeleidt. |
| `agency:v25.today.student_silent` | studenten zonder reactie | studenten die niet reageren |
| `agency:v8.view.docs` | Documentcorrectie vereist | Documenten moeten worden gecorrigeerd |
| `concierge:housing.honest` | We tonen alleen gegevens over studentenhuizen met hun bron, en kamers die een aanbieder ons echt heeft gegeven — elk met een label. We verzinnen nooit aanbiedingen. | We tonen alleen gegevens over studentenhuisvesting met een bron, en alleen kamers die een aanbieder echt heeft aangeboden, elk met een label. We verzinnen nooit aanbiedingen. |
| `marketing:v15.pricing.compare.value.dormitory_support.APPLICATION` | Hulp bij de aanvraag en alternatieven | Hulp bij de aanvraag, plus alternatieven |

## Pass C — UI context, brevity, one term per concept (8 strings changed)

| Key | Before | After |
| --- | --- | --- |
| `marketing:v20.city.Seoul.line` | Hier liggen de helft van Korea's onderzoeksuniversiteiten … (draft) | Hier ligt de helft van de Koreaanse onderzoeksuniversiteiten … |
| `marketing:v20.uni.whyTitle` | Wat haar anders maakt (draft) | Wat deze universiteit anders maakt |
| `agency:docs.sc.checks` | Vink een controle aan / kies een reden | Kies een controle of een reden |
| `agency:review.verifyHint` | Vink eerst de controles aan, of bevestig om zonder controles te verifiëren | Kies eerst de controles, of bevestig om zonder controles te verifiëren |
| `concierge:residence.useGroup` | Mijn universiteit vraagt hem voor mij aan | Mijn universiteit vraagt hem voor me aan |

(2 of these are corrections to this review's own first draft of new strings; the rest change an existing `current`.)

## Final source ↔ target comparison

All keys re-read against `en`/`ko`; placeholders identical; no Hangul; *consulaire legalisatie* for 영사확인; no *adviseur* left.

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

39 `marketing:` keys in the job. Sections touched, scored after the last rewrite (first-draft score in brackets where a rewrite was needed):

| Section | Keys | Clar. | Trust | Nat. | Brev. | CTA | Fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEO / home description | seo.home.description | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| Pricing (v15.pricing.*) | lede, premium.f5, compare rows | 5 | 5 | 4 | 4 | 5 | 4 | **27** |
| City pages (v20.city.*) | Busan, Gyeonggi, Gyeongnam, Seoul | 4 | 5 | 5 | 4 | 4 | 5 | **27** |
| University page (v20.uni.*, v24, v28.uni.why.*, v12) | ctaTitle/Body, intlTitle, whyTitle, why.* | 5 | 5 | 4 | 4 | 4 | 4 | **26** (22: *Klaar om dit serieus te bekijken?* → *Denk je erover hier te studeren?*) |
| FAQ languages (v9.faq.languagesA) | languagesA | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| Journey / universities strip, services, footer | journey.eyebrow, v6.unis.title, v10 housing.p2, v23 footer | 5 | 4 | 4 | 5 | 4 | 4 | **26** |

All touched sections ≥ 25 after rewrite.

## Strings I am unsure of

- `university:v28.pipe.label` — *Pijplijn* is understood but slightly technical for admissions staff.
- `visaroute:staff.post` — *Post* (diplomatic post) is correct Dutch officialese but may be read as "mail".
- `common:task.visa.other_passport_record` — *paspoortafgifteregistratie* is a long compound; no standard Dutch name for this foreign record exists.
- `marketing:v20.uni.link.office` — *International office* kept in English, as Dutch universities write it.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 370 | 40 | 76 | 254 |

Validator: `node scripts/i18n/v28/validate.mjs --only=nl` → `370 strings valid, 0 problems`.

## Second pass (jobs2): leak families the crawl missed

Input `scripts/i18n/v28/jobs2/nl.json` → output `scripts/i18n/v28/tx2/nl.json`. Same personas, glossary and method as the first pass. Every student-facing *your counselor* → *het Hangyul-team* (18 strings); the console label `agency.ownerShort.counselor` keeps the console term. Placeholders `{{counselor}}`/`{{name}}` stay the person's name.

| Job keys | Kept verbatim | Rewritten | Newly translated |
| --- | --- | --- | --- |
| 630 (marketing 2 · student 39 · success 465 · dossier 124) | 0 | 0 | 630 (all `current` were null; 3 keys whose English is empty stay empty) |

- Pass A (meaning): 18 strings changed (*your counselor* → team; consular legalization and apostille kept apart: `item.DOC_LEGALIZE*` vs `item.DOC_LEGALIZE_APOSTILLE*`, `dossier:path.*`).
- Pass B (naturalness): 3 (`obs.SOME_OVER_BUDGET_*` re-cut from the literal *begint boven je budget*; `page.privacy` 담당 상담사 → *je vaste begeleiders*; *gesprek* instead of *interview* for 면접).
- Pass C (UI context, one term per concept): 9 (`{{doc}}`/`{{category}}` strings restructured to "Label: {{x}}"; status chips *(geverifieerd)*/*(verlopen)*; *machtiging/machtigen* for 위임 everywhere; *indienen/indiening* for submit; *ontvangstbewijs* for receipt).
- Final comparison: every key checked against en and ko. The three keys whose English is empty (`dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`) stay empty.

### 5 examples (English shown on the page before → after)

- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}} heeft nog consulaire legalisatie nodig*
- `success:item.INTERVIEW_REQUIRED.why`: *Your counselor can run a practice interview with you before it.* → *Het Hangyul-team kan vooraf een oefengesprek met je doen.*
- `success:submission.authorize.check`: *I authorize {{agency}} to submit this application to {{university}} on my behalf.* → *Ik machtig {{agency}} om deze aanmelding namens mij in te dienen bij {{university}}.*
- `success:queue.detail.mechanismText`: *Open the official portal in your own browser …* → *Open het officiële portaal in je eigen browser en dien daar in met het eigen account van je bureau. …*
- `success:obs.SOME_OVER_BUDGET_other`: *{{count}} of your applications start above your budget.* → *Bij {{count}} van je aanmeldingen liggen de laagste kosten al boven je budget.*

### Marketing scorecard (2 keys)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v20.uni.intl (officeLine, none) | 5 | 5 | 4 | 4 | 4 | 5 | 27 |

### Unsure

- `dossier:page.privacy`: *je vaste begeleiders* for 담당 상담사 (could be agency or Hangyul staff).
- *gesprek* vs *interview* for 면접 — I used *gesprek* (Dutch admissions usage); some Dutch universities say *selectiegesprek*.
- `dossier:upload.haveTitle*`: *Je hebt al: {{doc}} {{status}}, …* with status in brackets; natural only if `{{doc}}` is a bare label.
- `success:queue.fixture` *Testdata* (tautological note, as in the English).
- Console *bureau* for agency (matches the existing *partnerbureau*).

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=nl` → `630 strings valid, 0 problems`.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
