# V31 native-quality review — Czech (cs)

Locale `cs` (Czech Republic). Job `scripts/i18n/v28/jobs-v31/cs.json`, output `scripts/i18n/v28/tx-v31/cs.json`,
glossary `docs/qa/v31/l10n/glossary/cs.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.
Register: vykání (2nd person plural, lower-case *vy/vaše* as on Czech university and Studyin.cz-type sites), buttons as
infinitives (*Uložit*, *Odeslat*), instructions as polite imperatives (*Nahrajte*, *Vyberte*).

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,473 (incl. 54 `v31` keys whose existing Czech already says what the new source says) |
| Rewritten | 256 |
| — new source (`v31`) | 199 |
| — terminology | 36 |
| — naturalness | 16 |
| — quality (UI role / format) | 3 |
| — meaning (non-`v31` keys) | 2 |
| Extra CLDR plural forms added (`_few`/`_many`) | 80 (every `_other` key; `_many` = decimal form with genitive singular) |

The 4 keys with `current: null` (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`, `student:v8.compare.budget_one`) were translated.

Terminology decisions applied across all keys: «plán studia» for study plan (not «studijní plán», which in Czech is a
programme curriculum), «motivační dopis» (not «osobní prohlášení»), «úpravy / kolo úprav» for editing (not «korektura»,
which in Czech is proofreading, and ≠ «kontrola» for review), «balíček» for plan everywhere (the 4 «tarif» uses removed),
«rozhodnutí o přijetí» for an admission offer (not «nabídka»), «superlegalizace» for consular legalization (MZV term),
«apostila», «notářské ověření», «výpis studijních výsledků», «doklad o ukončení studia», «průkaz pobytu» (not «průkaz o
pobytu» / «průkaz cizince»), «institut korejského jazyka» (never «jazyková škola»), «přihlášky, které s vámi vedeme»
(never the passive «spravované přihlášky»), «tým Hangyul» wherever the source says "the Hangyul team" (13 keys had
«Hangyul Univ»), Korean place names in revised romanization everywhere (Busan, Changwon, Sinchon… — the file mixed Czech
transcription «Pusan», «Čchangwon», «Hüksok»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `marketing:v12.terms.universityInfo.p` | contained Korean script «대학알리미» in the Czech sentence | «oficiální korejský portál pro zveřejňování údajů o univerzitách (Academy Info)» |
| 2 | `common:v29.pricing.compare.row.support` | «Období konzultací» — support window shown as a period of consultations | «Doba pro dotazy po konzultaci» |
| 3 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included in Premium | exclusion added in full |
| 4 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` / `all_in_one.f5` | «Příprava podkladů» / «Podklady k vízu připraveny» — reads as Hangyul preparing (and finishing) the visa documents | «Pomoc s přípravou dokumentů k vízu» |
| 5 | `common:v29.addon.item.airport_pickup` | «Zprostředkování vyzvednutí…» without the partner | «Vyzvednutí na letišti zajištěné přes partnera» |
| 6 | `common:v29.addon.item.extra_application`, `pricing.*.f2`, `compare.row.managed`, `student:v15.services.allowance.key.max_managed_applications` | «Spravované přihlášky / Správa přihlášek» — passive count label, implies Hangyul runs the application | «Přihlášky, které s vámi vedeme» |
| 7 | `common:v29.pricing.notes.visaDecision` | «o udělení rozhoduje příslušný úřad» (vague) | «O udělení víza rozhodují imigrační úřady.» |
| 8 | `marketing:v11.why.s3.text` | «stará se o to, aby váš studentský život proběhl hladce», «podpora na úplně jiné úrovni» — a promised outcome | careful help at a fair price, scope visible before payment; no outcome promise |
| 9 | `marketing:v11.why.s3.title` | «Nejrozumnější náklady, nejlepší výsledek» — unverifiable superlative and result claim | «Férová cena, žádná překvapení» |
| 10 | `marketing:v11.why.s1.text` / `.title` | «Přebíráme odpovědnost za každou fázi», «partner na cestě k úspěchu», «až k úspěchu» | help at every stage, same team from start to finish |
| 11 | `marketing:v11.services.s1.text` | «celý proces… bereme na sebe», «jazykové školy», «skutečně odpovídají» | we suggest universities and Korean language institutes, go through scholarships, help prepare documents and deal with the university |
| 12 | `marketing:v11.services.s2.text` | «Vyřízení víza… Vše potřebné zařídíme» — Hangyul obtains the visa | «Pomůžeme vám s žádostí o vízum…» |
| 13 | `marketing:v11.faq.q6.a` | «Stipendia nabízí každá univerzita» | «Většina ano…» |
| 14 | `marketing:v11.why.s2.text` | «sestavíme studijní plán», «z vašeho potenciálu vytěží maximum» | plan built from grades, goals and budget; universities you can realistically reach |
| 15 | `marketing:v11.services.s3.title` / `.text` | «komunita, která je silnější…», «po vašem boku v každém okamžiku» | community of admitted students, tips on housing and daily life |
| 16 | `marketing:v20.city.Gyeonggi.line` / `.body` | «zelenější» for roomier; body lost the point that more students live in dormitories | «prostornější»; «a proto víc studentů bydlí na univerzitních kolejích» |
| 17 | `student:discover.verdict.reach`, `success:group.possible` | «Možná shoda» — loses "meets requirements" and "needs checking" | «Splňuje požadavky, je třeba ověřit» |
| 18 | `student:register.privacyNote` | omitted the partner agency that also receives the data | «…s týmem Hangyul, který vás doprovází (včetně jeho partnerské agentury)…» |
| 19 | `student:phase.prepare.text` | «napište s týmem Hangyul Univ motivační dopis a studijní plán» — joint writing (editing ≠ writing) | the student writes; the team gives feedback |
| 20 | `student:v15.services.allowance.unlimited` | «Bez omezení s týmem Hangyul Univ» — "no limit" without the service-term scope | «…kdykoli během trvání služby» |
| 21 | `student:v4.ws.team.final` | «Závěrečná kontrola a odeslání vaší přihlášky» — Hangyul submits | «…předtím, než přihlášku na {{university}} sami podáte» |
| 22 | `student:register.consent.CROSS_BORDER_VERIFICATION.summary` | added items not in the source («Předávané údaje, lhůty») and said Cloudflare "blocks" sign-ups | matches the source: Cloudflare checks the sign-up is not automated |
| 23 | `student:register.consent.PRIVACY.summary` | «heslo (šifrované)» — a hash is not encryption | «hash hesla» |
| 24 | `student:stage.OFFERED`, `common:appStatus.OFFERED` (+ accepted) | «Obdržena nabídka» — in Czech reads as a commercial offer | «Rozhodnutí o přijetí obdrženo» / «Přijetí potvrzeno» |
| 25 | `dossier:group.extraCount` | «Dalších {{count}} uschovaných na později» — not a show button, "kept for later" | «Zobrazit další uložené dokumenty ({{count}})» |
| 26 | `marketing:v15.pricing.compare.item` | «Položka» where the English is intentionally empty | empty |

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

Before the rewrite the why, services and FAQ areas would have scored below 20 (TRUST, SPECIFICITY) because of the
outcome promises and superlatives above. Every area is now at 26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | «tým Hangyul», document-count plurals, consultation (not "call") |
| Applications | 5 | 5 | 4 | 5 | 4 | offer statuses, student submits, "meets requirements, needs checking" tier, application plan |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "no limit", managed applications, «balíček», items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille or superlegalization, sponsor financial documents, TB certificate, pickup via a partner, residence card wording |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` for keys that have only `_other` in the job (e.g. `marketing:v12.directory.count`, `concierge:profile.months`):
  not deliverable through this pipeline; `_few`/`_many` were added for every `_other`.
- Czech `_many` is the decimal category (1,5 dne). Those strings use the genitive singular; integers never reach it.
- `student:v8.compare.budget_one` and `v9.discovery.scholarship_one` have no `{{count}}` in English, so the Czech has none.
- `common:fit.level.ASSOCIATE` ("Associate degree") kept as «Vyšší odborné» — the closest Czech level, not an exact equivalent.
- `common:field.business` kept as «Podnikání»; the source does not say whether it means business administration or
  entrepreneurship.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고) kept as «Záznamy o označování a reklamě»; the Czech
  legal equivalent of the Korean 표시 category is unclear.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
