# V31 native-quality review — Hungarian (hu)

Locale `hu` (Hungary). Job `scripts/i18n/v28/jobs-v31/hu.json`, output `scripts/i18n/v28/tx-v31/hu.json`, glossary
`docs/qa/v31/l10n/glossary/hu.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Register

Informal **te** (tegeződés) throughout. Hungarian higher-education recruitment copy aimed at 18–25-year-olds (university
"Jelentkezz!" pages, student portals) uses te, and the existing Hungarian copy was already ~95% te. The 11 strings in
`current` that used Ön (all in the privacy policy / terms and the card-payment note) were converted to te so the whole
product speaks with one voice. Legal text stays neutral where it refers to "a tag" (the member) in the third person.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,409 (incl. 44 `v31` keys whose existing Hungarian already says what the new source says) |
| Rewritten | 320 |
| — new source (`v31`) | 209 |
| — terminology | 41 |
| — naturalness | 35 |
| — quality (UI role / register / format) | 35 |
| — meaning (non-`v31` keys) | 0 (meaning fixes all fell on `v31` keys; listed below) |
| Extra CLDR plural forms | none needed (Hungarian has only `one`/`other`) |

The 4 missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`, `student:v8.compare.budget_one`) were translated. `marketing:v15.pricing.compare.item`
is empty like the English (it held «Tétel»). `marketing:v12.terms.universityInfo.p` contained Hangul (대학알리미) and now
says «Academy Info».

Terminology decisions applied across all keys: «lektorálás / lektorálási kör» for editing (≠ «átnézés» for review —
`current` used «ellenőrzés» for both); «motivációs levél», «tanulmányi terv»; «apostille» (lower case, as a common noun)
and «konzuli felülhitelesítés» (never bare «felülhitelesítés» / «hitelesítések»); «közjegyzői hitelesítés»; «egyetemi
koreai nyelvi intézet» (never «nyelviskola»); «felvétel / felvételt nyertél» for an admission offer (not «ajánlat»);
«jelentkezések, amelyeket veled együtt kezelünk» (not the passive «kezelt jelentkezések»); «reptéri fogadás» via a partner
(not «reptéri fuvar»); «támogató» for sponsor (not «szponzor»); «a Hangyul csapata» wherever the source says "the Hangyul
team" (not «Hangyul Univ csapat»); plan names in Latin with «csomag».

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Konzultációs időszak» — support window presented as a period of consultations | «Kérdezési időszak a konzultáció után» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included in Premium | exclusions added in full |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` / `all_in_one.f5` / `student:v15.services.level.visa_support.DOCUMENT_PREP` | «(Vízum)dokumentumok előkészítése» — reads as Hangyul preparing the visa documents | «Segítség a (vízum)dokumentumok előkészítésében» |
| 4 | `common:v29.pricing.premium.position` | application stage missing (visa, arrival, first weeks only) | «a jelentkezéstől a vízumon és az érkezésen át az első koreai hetekig» |
| 5 | `common:v29.addon.item.airport_pickup` | «Reptéri transzfer megszervezése» — no partner, implies Hangyul runs transport | «Reptéri fogadás, partnerünkön keresztül megszervezve» |
| 6 | `common:v29.pricing.compare.row.managed` / `student:v15.services.allowance.key.max_managed_applications` | «Kezelt jelentkezések» — forbidden passive count label | «Jelentkezések, amelyeket veled együtt kezelünk» |
| 7 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Alapos átnézés» — notes on what to fix missing | «Alapos átnézés, javítási javaslatokkal» |
| 8 | `common:v29.pricing.compare.value.followUp.TEAM` | «Követés a felelős csapattól» — stale "responsible team" | «Nyomon követés a csapatodtól» |
| 9 | `student:v15.services.allowance.unlimited` | «Folyamatos a Hangyul Univ csapattal» — unbounded, no service-term scope | «Kérdezd a Hangyul csapatát bármikor a szolgáltatási időszak alatt» |
| 10 | `student:v4.ws.team.final` | «Végső ellenőrzés, majd a jelentkezésed elküldése…» — reads as Hangyul submitting | «Végső ellenőrzés, mielőtt beadod a jelentkezésedet…» |
| 11 | `student:register.privacyNote` | partner agency omitted from who receives the data | «a téged segítő Hangyul csapat (és partnerügynöksége), valamint az általad választott egyetemek» |
| 12 | `student:phase.prepare.text` | «írd meg … a Hangyul Univ csapattal» — co-writing (editing ≠ writing) | «írd meg … a Hangyul csapatának visszajelzései alapján» |
| 13 | `student:discover.verdict.reach` / `success:group.possible` | «Lehetséges egyezés» — loses "meets requirements" and "needs checking" | «Megfelel a követelményeknek, ellenőrzést igényel» |
| 14 | `dossier:group.extraCount` | «További {{count}} későbbre elmentve» — not a show-more control; "saved for later" ≠ stored | «További {{count}} megőrzött dokumentum mutatása» |
| 15 | `dossier:package.line` / `page.summary` | «követelmény» instead of documents; summary added "for every application" | «{{total}} szükséges dokumentum · {{ready}} kész»; «{{total}} dokumentumból {{ready}} kész» |
| 16 | `marketing:v11.why.s3.title` / `.text` | «A legésszerűbb költség, a legjobb eredmény»; "diákéveid nyugodtan teljenek", "teljesen más szintű" — superlatives and implied outcome guarantee | «Korrekt ár, meglepetések nélkül»; fair price, you see what the plan includes before paying |
| 17 | `marketing:v11.why.s1.text` | «minden szakaszáért felelősséget vállalunk», «partner a sikerhez» — responsibility for outcome | help at every stage, same team from start to finish |
| 18 | `marketing:v11.services.s1.text` | «a teljes folyamatot … magunkra vállaljuk», «nyelviskolák» | suggests universities and language institutes, helps prepare documents and deal with the university |
| 19 | `marketing:v11.faq.q6.a` | «minden egyetem kínál ösztöndíjat» | «A legtöbb igen…» |
| 20 | `marketing:v11.faq.q4.q` | «Felkészülhetek…» — asks about preparing, source asks about applying without Korean | «Jelentkezhetek akkor is, ha nem beszélek koreaiul?» |
| 21 | `marketing:v12.terms.services.documents` | «Jelentkezési dokumentumok előkészítése és ellenőrzése» — Hangyul prepares the documents | «Segítség a … előkészítésében, és a dokumentumok átnézése» |
| 22 | `marketing:v12.terms.support.coordination` | «összefogja és irányítja» — Hangyul directs the student's preparation | «összehangolja … és nyomon követi az egyes lépéseket» |
| 23 | `marketing:v20.city.Gyeonggi.line` / `.body` | roomier → «zöldebb»; body said campuses have their own dorms instead of a street of shared rentals, losing "so more students live in dorms" | «olcsóbb, tágasabb»; «ezért több diák lakik egyetemi kollégiumban» |
| 24 | `marketing:v12.privacy.collect.verification.purpose` | «automatizált regisztrációk» — source says fraudulent sign-ups | «csalárd regisztrációk megelőzése» |
| 25 | `visaroute:step.slow_items.why` | «A hitelesítések…» — apostille / consular legalization not named | «Az apostille vagy a konzuli felülhitelesítés, a TBC-vizsgálat és az erkölcsi bizonyítvány…» |
| 26 | `student:compare.legalCount_*`, `profileV3.why.basics` | «Apostille vagy felülhitelesítés» — "consular" missing | «apostille vagy konzuli felülhitelesítés» |
| 27 | `common:appStatus.OFFERED` / `student:stage.OFFERED` | «Ajánlat érkezett» — reads as a commercial offer | «Felvételt nyertél» |

Systemic issues fixed beyond the table: «Hangyul Univ csapat» where the source is "the Hangyul team" (16 keys), Ön-register
in privacy/terms (≈30 keys), «ellenőrzés» used for editing (7), em-dash connectors in UI copy (≈12), suffixes glued to
placeholders (`{{ready}}-hoz`, `{{total}}-ból`, `{{amount}}-tól`) that break vowel harmony for some values (4).

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 4 | 5 | 4 | 4 | 26 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite the why, services and FAQ areas would have scored under 20 (superlatives, «a legjobb eredmény»,
«minden egyetem», responsibility for the outcome). Every area is now at 26/30 or higher. Internal review tool, not a
measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | document-count plurals, «A Hangyul csapatod», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses, final check says the student submits, reach tier wording, task labels without dash |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, summary suffixes |
| Services | 5 | 5 | 4 | 5 | 4 | support window, "unlimited" scoped to the service term, managed applications, editing vs review, exclusions list |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille / konzuli felülhitelesítés, sponsor documents, TB certificate, pickup via a partner, off-campus studio |

## Unresolved ambiguity / limits (listed, not guessed)

- `marketing:v12.type.JUNIOR_COLLEGE` and `common:fit.level.ASSOCIATE`: kept «Főiskola» / «Felsőfokú szakképzés». Hungary
  has no exact two/three-year junior-college equivalent; «főiskola» today usually means a bachelor-level college.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): rendered «A jelölésekkel és reklámokkal kapcsolatos
  nyilvántartás»; the exact Hungarian legal category for Korean 표시 is unclear.
- `marketing:v14.legal.brn`: «Cégjegyzékszám» kept; a Korean business registration number is closer to a tax/business ID
  than to a Hungarian company-register number.
- `common:intakeLabel` `{{year}} {{term}}` gives «2027 Tavasz»; a capitalised season mid-label is acceptable in UI but a
  lower-case form («2027 tavasz») would need a separate term key.
- `fit.gpa.placeholder` keeps «3.6» with a decimal point because the input may not accept a comma.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=hu` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
