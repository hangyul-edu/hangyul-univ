# V31 native-quality review — German (de)

Locale `de` (Germany, Austria, Switzerland). Job `scripts/i18n/v28/jobs-v31/de.json`, output
`scripts/i18n/v28/tx-v31/de.json`, glossary `docs/qa/v31/l10n/glossary/de.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Register decision (read first)

**du was kept for consistency.** The existing German product addresses the reader as du (≈930 strings in
`packages/i18n/locales/de`, including ≈780 outside this job: marketing, student, success, the native app, agency,
university). A first pass converted the job keys to Sie on an instruction that has since been withdrawn by the
coordinator: a du/Sie mix on one screen is worse than either. The final output is **du throughout** (du/dein/dich, du
imperatives). Every other V31 fix (meaning, terminology, naturalness, new source) was kept and re-rendered in du; the
pure du→Sie rewrites were reverted to the existing text verbatim.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,413 (incl. 36 `v31` keys whose German already says what the new source says) |
| Rewritten | 316 |
| — new source (`v31`) | 217 |
| — naturalness (em/en-dash connectors, stiff wording, «Wartet auf dich» for "needs you") | 50 |
| — terminology («das Hangyul-Team», «Paket», «Sponsor», «Visum-Checkliste», «Texte», «Hochschule») | 39 |
| — meaning (non-`v31` keys) | 5 |
| — quality (UI role / format) | 5 |
| — register | 0 (du kept) |

The split of the 99 non-`v31` rewrites by reason is a reconstruction (the per-key reason files were lost in a host
reboot); the totals are exact.
| Extra CLDR plural forms | 0 (German needs only `_one`/`_other`) |

The 3 missing keys (`common:task.universityRequestItem`, `common:task.sendStudyPlanFeedback`,
`student:home.documentsSub_one`) and `student:v8.compare.budget_one` were translated.

Terminology applied across all keys: «Paket» for plan (was mixed «Paket» / «Tarif» / «Plan» / «Servicepläne»),
«Motivationsschreiben», «Studienplan», «Korrekturrunde» / «Korrektur» for editing (≠ «Prüfung» for review),
«Bewerbungen, die wir mit dir betreuen» for managed applications (not the passive count «Betreute Bewerbungen»),
«Apostille», «konsularische Legalisation» (never bare «Legalisation»), «Beglaubigung» / «beglaubigt», «Aufenthaltskarte»
(not «Ausländerausweis»), «Sprachinstitut» (not «Sprachschule»), «Junior College» for 전문대 (not «Fachhochschule»),
«Sekundarschule» for high school, «Finanzierungsnachweise des Sponsors», «das Hangyul-Team» wherever the source says
"the Hangyul team", plan names in Latin.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Beratungszeitraum» — support window shown as a consultation period | «Zeitraum für Rückfragen nach der Beratung» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are excluded from Premium | exclusions added in full |
| 3 | `common:v29.pricing.all_in_one.f5` / `compare.value.visa.DOCUMENT_PREP` | «Visumsunterlagen vorbereitet» / «Vorbereitung der Unterlagen» — reads as if Hangyul prepares the visa documents | «Hilfe bei der Vorbereitung deiner Visumsunterlagen» |
| 4 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Intensive Prüfung» — notes on what to fix missing | «Intensive Prüfung mit Hinweisen, was zu verbessern ist» |
| 5 | `common:v29.pricing.premium.position` | application stage omitted («Begleitung bis zu Visum…») | «von der Bewerbung bis zu Visum, Ankunft und den ersten Wochen» |
| 6 | `common:v29.addon.item.airport_pickup` | «Vermittlung einer Flughafenabholung» — partner not named | «Flughafenabholung über einen Partner» |
| 7 | `common:v29.pricing.compare.row.managed`, `student:v15.services.allowance.key.max_managed_applications` | «Betreute Bewerbungen» — passive count label (forbidden) | «Bewerbungen, die wir mit dir betreuen» |
| 8 | `student:v15.services.allowance.unlimited` | «Laufend mit dem Hangyul Univ-Team» — open-ended, no term | «Frag das Hangyul-Team jederzeit während deiner Leistungslaufzeit» |
| 9 | `student:v4.ws.team.final` | «Abschlussprüfung, dann Versand deiner Bewerbung an {{university}}» — implies Hangyul submits | «…bevor du die Bewerbung selbst bei {{university}} einreichst» |
| 10 | `student:phase.prepare.text` | «schreib dein Motivationsschreiben … mit dem Hangyul Univ-Team» — co-writing (editing ≠ writing) | «Dann schreibst du … mit Feedback vom Hangyul-Team» |
| 11 | `student:register.privacyNote` | partner agency omitted from who receives data | «…dem Hangyul-Team, das dich betreut (einschließlich seiner Partneragentur)…» |
| 12 | `student:discover.verdict.reach`, `success:group.possible` | «Möglicher Treffer» — loses "meets requirements" and "needs checking" | «Voraussetzungen erfüllt, Prüfung nötig» |
| 13 | `dossier:group.extraCount` | «{{count}} weitere für später aufbewahrt» — a status, not the show-more button | «{{count}} weitere aufbewahrte Dokumente anzeigen» |
| 14 | `dossier:page.summary` | «… für jede Bewerbung bereit» — overstated | «{{ready}} von {{total}} bereit» |
| 15 | `marketing:v11.hero.lede` | «Wir machen deinen Traum wahr» — promise | «Finde die passende koreanische Hochschule und erledige jeden Schritt mit einem Team an deiner Seite…» |
| 16 | `marketing:v11.why.s3.text` / `.title` | «sorgt dafür, dass deine Studienzeit ruhig verläuft», «Die vernünftigsten Kosten, das beste Ergebnis» — guarantee and superlative | «fairer Preis … du siehst genau, was dein Paket enthält, bevor du zahlst»; «Ein fairer Preis, ohne Überraschungen» |
| 17 | `marketing:v11.why.s1.text` / `.title` | «Wir übernehmen jede Phase», «bis zum Erfolg» — implies outcome and doing it for the student | «Wir helfen in jeder Phase…»; «Hilfe in jeder Phase, von Anfang bis Ende» |
| 18 | `marketing:v11.services.s1.text` | «den gesamten Ablauf … übernehmen wir», «Sprachschulen» | suggest, go through scholarships, then help with documents and contact; «Sprachinstitute» |
| 19 | `marketing:v11.services.s2.text` | «Wir regeln gemeinsam alles Nötige» (Visa as if handled by Hangyul), «Ausländerausweis» | «begleiten wir dich bei Visumantrag, Aufenthaltskarte und Kursanmeldung» |
| 20 | `marketing:v11.faq.q6.a` | «Jede Hochschule bietet Stipendien» | «Die meisten ja…» |
| 21 | `marketing:v11.faq.q1.a` | high school / junior college rendered «Oberschule / Fachhochschule» (FH is a university of applied sciences); parent ID only "if no foreign passport" | «Sekundarschule oder Junior College»; follows the corrected English |
| 22 | `marketing:v12.terms.universityInfo.p` | contained Hangul «대학알리미» in the German sentence | «offizielles koreanisches Offenlegungsportal der Hochschulen (Academy Info)» |
| 23 | `marketing:v12.privacy.collect.profile.purpose` | «Erstellung eines Studienplans» — collides with the study-plan essay | «Planung deines Auslandsstudiums» |
| 24 | `marketing:v20.city.Gyeonggi.line` / `.body` | «grüner» for roomier; body lost the conclusion that more students live in dormitories | «geräumiger»; «deshalb wohnen mehr Studierende in Wohnheimen…» |
| 25 | `visaroute:step.slow_items.why`, `student:compare.legalCount_*`, `student:profileV3.why.basics` | «Legalisationen» / «Legalisation» without apostille or "konsularische" | «Apostillen oder konsularische Legalisation» |
| 26 | `marketing:v15.pricing.compare.item` | «Position» where the English is intentionally empty | empty |
| 27 | `common:fit.level.TRANSFER` | «Quereinstieg» (career change) | «Hochschulwechsel» |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite, hero, why, services and FAQ would have scored below 20 on TRUST and SPECIFICITY (promises,
superlatives, "we take over everything"). Every area is now 26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | «Dein Hangyul-Team», document-count plurals, «Wartet auf dich» for "needs you" |
| Applications | 5 | 5 | 4 | 5 | 4 | final check says the student submits, "meets requirements, needs checking" tier, «Voraussetzungen noch nicht erfüllt» |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, apostille / consular legalization |
| Services | 5 | 5 | 4 | 5 | 4 | «Paket» everywhere, managed applications, "unlimited" scoped to the service term, exclusions list |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | sponsor financial documents, TB certificate, pickup via a partner, address report after moving, studio vs dormitory |

du is used throughout, matching the rest of the German product.

## Unresolved ambiguity / limits (listed, not guessed)

- «Universität» and «Hochschule» are both used (Hochschule in most product copy, Universität in some directory/SEO
  and legal strings and in `{{university}}`-adjacent text). Both are correct German; not normalised to avoid churn.
- `doc.business_registration.*` (사업자등록증): rendered «Gewerbe-Registrierungsbescheinigung der Hochschule»; there is
  no exact German equivalent for a university's business registration certificate.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept «Aufzeichnungen über Kennzeichnung und Werbung»;
  the precise German legal category is unclear.
- `common:fit.level.ASSOCIATE`: «Associate Degree» kept; Germany has no equivalent level.
- `success:item.ESSAY_WRITE.title` uses `{{labelLower}}`; German nouns are capitalised, so a lower-cased label will look
  wrong. Rendered «Text schreiben: {{labelLower}}»; a source change (pass the capitalised label for de) would fix it.
- `enrollment_certificate` (재학증명서): «Immatrikulationsbescheinigung» fits university students; for school pupils
  «Schulbescheinigung» would be correct. No job key currently uses it.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=de` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
