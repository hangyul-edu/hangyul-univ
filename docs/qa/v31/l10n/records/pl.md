# V31 native-quality review — Polish (pl)

Locale `pl` (Poland). Job `scripts/i18n/v28/jobs-v31/pl.json`, output `scripts/i18n/v28/tx-v31/pl.json`, glossary
`docs/qa/v31/l10n/glossary/pl.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

Register: Pan/Pani is avoided. 2nd-person plural for a single reader is not normal Polish web copy, so the courteous
register used by gov.pl, mObywatel and university candidate portals is kept: imperatives for actions (*Prześlij*,
*Zapisz*), impersonal forms in legal and policy copy (*Należy…*, *użytkownik*), and direct address with the capitalised
courtesy pronouns *Ty / Twój / Ci / Cię* (checked: no lower-case forms remain). Gendered past forms in 2nd person
(*złożyłeś/-aś*) are avoided by rewording.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,445 (incl. 49 `v31` keys whose existing Polish already says what the new source says) |
| Rewritten | 284 |
| — new source (`v31`) | 204 |
| — terminology | 46 |
| — naturalness | 23 |
| — meaning (non-`v31` keys) | 7 |
| — quality (UI role / format / length) | 4 |
| Extra CLDR plural forms added (`_few`/`_many`) | 80 (every `_other` key; `_few` = 2–4 nominative plural, `_many` = 5+ genitive plural; the existing `_other` keeps the fractional genitive-singular form) |

The 4 keys with `current: null` were translated.

Terminology decisions applied across all keys: «plan nauki» for study plan (not «plan studiów», which in Polish
higher-education law is the curriculum), «list motywacyjny», «redakcja / runda redakcji» for editing (≠ «weryfikacja»
for review), «pakiet» for plan everywhere (2 uses of «plan» for the product removed), «aplikacja» for a university
application (the 9 places that used «wniosek» for it unified; «wniosek» kept for visa, residence-card and dormitory
applications, where it is the official term), «decyzja o przyjęciu» for an admission offer (not «oferta»),
«legalizacja konsularna» (never bare «legalizacja»), «apostille», «poświadczenie notarialne», «instytut języka
koreańskiego» (never «szkoła językowa»), «Instytut Króla Sejonga», «zespół Hangyul» wherever the source says "the Hangyul
team" (16 keys had «Hangyul Univ»), place names in revised romanization (Busan, Incheon — the file mixed «Pusan»,
«Inczon»).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `marketing:v12.terms.universityInfo.p` | contained Korean script «대학알리미» in the Polish sentence | «oficjalny koreański serwis jawności danych uczelni (Academy Info)» |
| 2 | `common:v29.pricing.compare.row.support` | «Okres konsultacji» — support window shown as a period of consultations | «Czas na pytania po konsultacji» |
| 3 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included | exclusion added in full |
| 4 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP`, `all_in_one.f5` | «Przygotowanie dokumentów (wizowych)» — Hangyul prepares the visa documents | «Pomoc w przygotowaniu dokumentów wizowych» |
| 5 | `common:v29.pricing.notes.visaDecision` | «decyzję podejmuje właściwy urząd» (vague) | «O wydaniu wizy decydują organy imigracyjne.» |
| 6 | `common:v29.addon.item.airport_pickup` | «Organizacja odbioru z lotniska» — no partner, reads as Hangyul transport | «Odbiór z lotniska organizowany przez partnera» |
| 7 | `common:v29.addon.item.extra_application`, `pricing.*.f2`, `compare.row.managed`, `student:…max_managed_applications` | «rekrutacja prowadzona przez nas / Prowadzone rekrutacje» — Hangyul runs the recruitment | «aplikacje, które prowadzimy razem z Tobą» |
| 8 | `common:v29.pricing.premium.position` | omitted the application stage | «od aplikacji przez wizę i przyjazd aż po pierwsze tygodnie» |
| 9 | `marketing:v11.why.s3.text` / `.title` | «dba o to, żeby Twoje studenckie życie przebiegło spokojnie», «najlepszy rezultat», «warte każdej złotówki» | fair price, scope visible before payment; «Uczciwa cena, bez niespodzianek» |
| 10 | `marketing:v11.why.s1.text` / `.title` | «Bierzemy na siebie każdy etap», «partner, który doprowadzi Cię do celu», «po sukces» | help at every stage, same team from start to finish |
| 11 | `marketing:v11.services.s1.text` / `.title` | «cały proces… bierzemy na siebie», «szkoły językowe» | we suggest universities and Korean language institutes and help prepare documents |
| 12 | `marketing:v11.services.s2.text` | «Wiza… wspólnie załatwiamy wszystko» — Hangyul obtains the visa | «Pomagamy przy wniosku wizowym…» |
| 13 | `marketing:v11.faq.q6.a` | «Stypendia… oferuje każda uczelnia» | «Większość tak…» |
| 14 | `marketing:v11.why.s2.text` | «układamy plan studiów», «wydobywa z Ciebie maksimum» | plan built from grades, goals and budget; realistically reachable universities |
| 15 | `marketing:v20.city.Gyeonggi.line` / `.body` | «zieleniej» for roomier; body lost the point that more students live in dormitories | «przestronniej»; «dlatego więcej studentów mieszka w akademikach» |
| 16 | `student:discover.verdict.reach`, `success:group.possible` | «Możliwe dopasowanie» | «Spełnia wymagania, do sprawdzenia» |
| 17 | `student:register.privacyNote` | omitted the partner agency | «…zespołowi Hangyul, który Cię wspiera (w tym jego agencji partnerskiej)…» |
| 18 | `student:phase.prepare.text` | «napisz list motywacyjny oraz plan studiów z zespołem» — joint writing; also the typo «Zebierz» | the student writes; the team gives feedback |
| 19 | `student:v15.services.allowance.unlimited` | «Bez limitu z zespołem Hangyul Univ» — no-limit without the service-term scope | «Pytania do zespołu Hangyul w dowolnym momencie trwania usługi» |
| 20 | `student:v4.ws.team.final` | «Końcowa weryfikacja, a potem wysłanie aplikacji» — Hangyul submits | «…przed samodzielnym złożeniem aplikacji do {{university}}» |
| 21 | `student:register.consent.CROSS_BORDER_VERIFICATION.summary` | added items not in the source; Cloudflare «blokuje» sign-ups | matches the source |
| 22 | `student:register.consent.PRIVACY.summary` | «hasło (zaszyfrowane)» — a hash is not encryption | «hash hasła» |
| 23 | `student:budget.tuitionNote`, `v9.money.guardShort`, `marketing:v12.terms.fees.tuition` | «we własnym imieniu / w imieniu studenta» — means "on behalf of", not "in the student's name" | «na własne nazwisko / na nazwisko studenta» |
| 24 | `marketing:v12.privacy.retention.contract.record` | «odstąpienia od subskrypcji» — there is no subscription | «odstąpienia od zamówień» |
| 25 | `marketing:v12.terms.refunds.stage.SETTLEMENT_STARTED` | «zakwaterowania» for settlement | «zadomowienia się» |
| 26 | `stage.OFFERED` / `appStatus.OFFERED` (+ accepted, `v26.now.*.LATER`) | «Otrzymano ofertę» — a commercial offer | «Otrzymano decyzję o przyjęciu» |
| 27 | `dossier:group.extraCount` | «{{count}} więcej zachowano na później» — not a show button | «Pokaż więcej zapisanych dokumentów ({{count}})» |
| 28 | `marketing:v15.pricing.compare.item` | «Pozycja» where the English is intentionally empty | empty |

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

Before the rewrite the why, services and FAQ areas would have scored below 20 (TRUST, SPECIFICITY). Every area is now at
26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | «zespół Hangyul», plurals, consultation (not "rozmowa") |
| Applications | 5 | 5 | 4 | 5 | 4 | «aplikacja» unified, admission-decision statuses, student submits, application plan |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, plurals |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "no limit", managed applications, «pakiet», items not included |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | consular legalization, sponsor financial documents, TB certificate, pickup via a partner, IEQAS grade names |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` for keys that have only `_other` in the job: not deliverable through this pipeline; `_few`/`_many` added for every `_other`.
- `student:v8.compare.budget_one` and `v9.discovery.scholarship_one` have no `{{count}}` in English, so the Polish has none.
- `register.consent.CROSS_BORDER_VERIFICATION.label` keeps «Zapoznałem(-am) się» — a first-person consent statement
  cannot be made gender-neutral without changing its legal form.
- `marketing:v11.nav.faq` is «Pytania»: «Najczęstsze pytania» exceeds the validator's length limit for the 3-letter source.
- `common:fit.level.ASSOCIATE` kept as «Studia krótkiego cyklu» — the closest Polish level, not an exact equivalent.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고) kept as «Zapisy dotyczące oznakowania i reklamy»; the
  Polish legal equivalent of the Korean 표시 category is unclear.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
