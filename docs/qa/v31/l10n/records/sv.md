# V31 native-quality review — Swedish (sv)

Locale `sv` (Sweden, also read in Finland). Job `scripts/i18n/v28/jobs-v31/sv.json`, output `scripts/i18n/v28/tx-v31/sv.json`,
glossary `docs/qa/v31/l10n/glossary/sv.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Register

**du** throughout, as on Swedish university and study-abroad sites (studera.nu, antagning.se, university admissions pages).
The existing copy was already du; no ni/Ni was found. Marketing keeps the informal «plugga» where the existing copy used it
for 18–20-year-olds; product and legal copy use «studera».

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,428 (incl. 34 `v31` keys whose existing Swedish already says what the new source says) |
| Rewritten | 301 |
| — new source (`v31`) | 219 |
| — terminology | 54 |
| — naturalness | 24 |
| — meaning (non-`v31` keys) | 2 |
| — quality (UI role / format) | 2 |
| Extra CLDR plural forms | none needed (Swedish has only `one`/`other`) |

The 4 missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`, `student:v8.compare.budget_one`) were translated. `marketing:v15.pricing.compare.item` is
now empty like the English (it held «Post»). `marketing:v12.terms.universityInfo.p` contained Hangul (대학알리미) and now
says «Academy Info».

Terminology decisions applied across all keys: «rådgivningssamtal» for consultation (not «konsultation» / «samtal»
alone); «redigering / redigeringsomgång» for editing (not «bearbetning», which reads as reworking the text, and ≠
«granskning» for review); «apostille» and «legalisering» (the Swedish UD term; never «konsulär bekräftelse»);
«bestyrkande av notarius publicus»; «koreanskt språkinstitut» (never «språkskola»); «antagen» for an offer and
«antagningsbevis» for the admission letter (`current` used «erbjudande» for the offer and «antagningsbesked» for the
letter, which in Swedish is the admission decision itself); «ansökningar vi sköter tillsammans med dig» (not the passive
«hanterade ansökningar», and not «vi sköter» alone, which implies Hangyul applies); «hämtning på flygplatsen, ordnad via en
partner»; «medborgarskap» everywhere (`current` mixed «nationalitet»); «sista ansökningsdag» (not «deadline»);
«Hangyul-teamet» wherever the source says "the Hangyul team"; plan names in Latin with «paket».

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Rådgivningsperiod» — support window presented as a period of consultations | «Tid för frågor efter samtalet» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included in Premium | exclusions added in full |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` / `all_in_one.f5` («Visumhandlingar förberedda») / `student:v15.services.level.visa_support.DOCUMENT_PREP` | reads as Hangyul preparing the visa documents | «Hjälp att förbereda dina visumhandlingar» |
| 4 | `common:v29.pricing.premium.position` | application stage missing (visa, arrival, first weeks only) | «hela vägen från ansökan till visum, ankomst och de första veckorna i Korea» |
| 5 | `common:v29.addon.item.airport_pickup` | «Förmedling av hämtning på flygplatsen» — partner not named | «Hämtning på flygplatsen, ordnad via en partner» |
| 6 | `common:v29.pricing.all_in_one.f2`, `premium.f2`, `compare.row.managed`, `addon.item.extra_application`, `student:v15.services.allowance.key.max_managed_applications` | «ansökningar som vi sköter» / «Hanterade ansökningar» — Hangyul handles the application alone, or passive count label | «… vi sköter tillsammans med dig» |
| 7 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Noggrann granskning» — notes on what to fix missing | «Noggrann granskning, med kommentarer om vad som behöver rättas» |
| 8 | `common:v29.pricing.notes.visaDecision` | «beslutet fattas av myndigheten» — unspecified authority, "visa support" framed as a service promise | «Om visum beviljas avgör migrationsmyndigheterna» |
| 9 | `student:v15.services.allowance.unlimited` | «Löpande med Hangyul Univ-teamet» — unbounded, no service-term scope | «Fråga Hangyul-teamet när som helst under din tjänsteperiod» |
| 10 | `student:v4.ws.team.final` | «Slutkontroll, sedan skickas din ansökan till …» — passive, reads as Hangyul submitting | «Slutkontroll innan du skickar in din ansökan till …» |
| 11 | `student:register.privacyNote` | partner agency omitted from who receives the data | «Hangyul-teamet som hjälper dig (inklusive dess partnerbyrå) och … de universitet du väljer» |
| 12 | `student:phase.prepare.text` | «skriv … med Hangyul Univ-teamet» — co-writing (editing ≠ writing) | «skriv … med feedback från Hangyul-teamet» |
| 13 | `student:discover.verdict.reach` / `success:group.possible` | «Möjlig matchning» — loses "meets requirements" and "needs checking" | «Uppfyller kraven, behöver kontrolleras» |
| 14 | `dossier:group.extraCount` | «{{count}} till sparade till senare» — not a show-more control; "saved for later" ≠ stored | «Visa {{count}} sparade dokument till» |
| 15 | `dossier:package.line` / `page.summary` | «krav» instead of documents; summary added "for every application" | «{{total}} dokument behövs · {{ready}} klara»; «{{ready}} av {{total}} klara» |
| 16 | `concierge:step.documents_to_carry.title` / `.sub` | title and subtitle swapped (title said «Original i handbagaget») | title «Dokument att ta med», sub «Originalen i handbagaget» |
| 17 | `marketing:v11.why.s3.title` / `.text` | «Den rimligaste kostnaden, det bästa resultatet»; "ser till att din studietid flyter på lugnt", "en helt annan nivå" — superlatives and implied outcome | «Ett rimligt pris, inga överraskningar»; you see what the plan includes before paying |
| 18 | `marketing:v11.why.s1.text` | «Vi tar ansvar för varje del», «partnern som följer dig hela vägen fram» — responsibility for the outcome | help in every step, same team from start to finish |
| 19 | `marketing:v11.services.s1.text` | «hela processen … tar vi hand om», «språkskolor» | suggests universities and language institutes, helps prepare documents and handle contact with the university |
| 20 | `marketing:v11.faq.q6.a` | «Alla universitet erbjuder stipendier» | «De flesta gör det …» |
| 21 | `marketing:v11.faq.q4.q` | «Kan jag förbereda mig …» — source asks about applying without Korean | «Kan jag söka även om jag inte kan koreanska?» |
| 22 | `marketing:v12.terms.services.documents` | «Förberedelse och granskning av ansökningsdokument» — Hangyul prepares the documents | «Hjälp att förbereda ansökningsdokument samt granskning av dokument» |
| 23 | `marketing:v12.terms.support.coordination` | «kopplar samman och hanterar medlemmens förberedelser» — Hangyul runs the student's preparation | «samordnar … och håller koll på varje steg» |
| 24 | `marketing:v20.city.Gyeonggi.line` / `.body` | roomier → «grönare»; body lost "so more students live in dorms" | «billigare, rymligare»; «så fler studenter bor i universitetets studentboenden» |
| 25 | `marketing:v12.privacy.collect.verification.purpose` | «automatiserade registreringar» — source says fraudulent sign-ups | «förhindra bedrägliga registreringar» |
| 26 | `visaroute:step.slow_items.why` | «Legaliseringar …» — apostille not named | «Apostille eller legalisering, tbc-testet och utdrag ur belastningsregistret …» |
| 27 | `common:appStatus.OFFERED` / `student:stage.OFFERED` | «Erbjudande mottaget» — reads as a commercial offer | «Antagen» |
| 28 | `student:register.consent.CROSS_BORDER_VERIFICATION.summary` | added content not in the source (what is transferred, when, how long) and said Cloudflare "stops" sign-ups | follows the source: checks that sign-up is not automated; details incl. how to refuse are in the privacy policy |

Systemic issues fixed beyond the table: «Hangyul Univ-teamet» where the source is "the Hangyul team" (14 keys),
«konsultation» → «rådgivningssamtal» (8), «bearbetning» → «redigering» (6), «nationalitet» → «medborgarskap» (6), em-dash
connectors (≈14), possessive «din {{category}}» before placeholders whose gender varies (3).

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite the why, services and FAQ areas would have scored under 20 (superlatives, «det bästa resultatet»,
«alla universitet», responsibility for the outcome). Every area is now at 26/30 or higher. Internal review tool, not a
measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «Ditt Hangyul-team», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses («Antagen», «Platsen accepterad»), final check says the student submits, reach tier wording |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, swapped documents-to-carry labels |
| Services | 5 | 5 | 4 | 5 | 4 | support window, "unlimited" scoped to the service term, managed applications, editing vs review, exclusions list |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille / legalisering, sponsor's financial documents, TB certificate, pickup via a partner, off-campus studio |

## Unresolved ambiguity / limits (listed, not guessed)

- `common:fit.level.ASSOCIATE` → «Tvåårig högskoleexamen» and `marketing:v12.type.JUNIOR_COLLEGE` kept «Högskola»: Sweden has
  no junior-college tier; «högskola» in Sweden is a full higher-education institution, so the directory label is approximate.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): rendered «Uppgifter om märkning och marknadsföring»; the
  exact Swedish legal category for Korean 표시 is unclear.
- `marketing:v14.legal.brn`: «Organisationsnummer» kept; a Korean business registration number is the closest analogue, not
  an identical register.
- `v9.funds.longer_other` keeps the Korean government label «consulting» in quotes; there is no established Swedish name for
  that tier.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=sv` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
