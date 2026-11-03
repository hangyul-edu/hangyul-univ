# V31 native-quality review — Mongolian (mn, Cyrillic)

Locale `mn` (Mongolia; priority market). Job `scripts/i18n/v28/jobs-v31/mn.json`, output
`scripts/i18n/v28/tx-v31/mn.json`, glossary `docs/qa/v31/l10n/glossary/mn.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.
Register: polite «та», modern Ulaanbaatar study-abroad agency usage.

## Counts

| | keys |
|---|---|
| Job keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,412 (incl. 47 `v31` keys whose existing Mongolian already says what the new source says) |
| Rewritten | 317 |
| — new source (`v31`) | 206 |
| — naturalness | 47 |
| — terminology | 43 |
| — quality (UI role / format) | 11 |
| — meaning (non-`v31` keys) | 10 |
| Extra CLDR plural forms | 0 (Mongolian CLDR has only `one`/`other`) |

Every key went through the semantic, naturalness and product passes and a back-check; all 253 `v31` keys were
re-read against the new en/ko. The 2 missing keys (`common:task.universityRequestItem`,
`common:task.sendStudyPlanFeedback`) were translated.

Terminology decisions applied across all keys: «өөрийн танилцуулга» for the personal statement (was «хувийн эссэ» /
«танилцуулга эссэ»), «суралцах төлөвлөгөө» (never «сургалтын төлөвлөгөө», which reads as a curriculum), «тантай хамт
хөтлөх өргөдөл» for managed applications (was «хариуцан хөтлөх», which says Hangyul takes the application over),
«консулын легализаци» (never «консулын баталгаажуулалт»), «нотариатын гэрчлэлт / нотариатаар гэрчлүүлэх», «элсэлтийн
зөвшөөрлийн бичиг» for the admission letter, «элсэлтэд тэнцсэн шийдвэр» for an offer (was «санал» = proposal),
«тусгайлан хуваарилсан баг» (was «тусгай баг» = special team), «ярилцлагын дадлага», «их сургуулийн солонгос хэлний
төв», «санхүүгийн батлан даагч» for the visa financial sponsor, «санхүүжүүлэгч» for a family sponsor, «багц» for plan,
plan names in Latin, brand in Latin, «Hangyul-ийн баг» wherever the source says "the Hangyul team", «визийн» (typo
«визний» removed).

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `student:v4.ws.team.final` | "after the final check we will submit your application to {{university}}" | the final check before *you* submit to {{university}} |
| 2 | `common:v29.pricing.compare.scopeNote` | Premium no-limit within contract scope, but the exclusions (new documents, translation, notarization) were dropped | full sentence with the exclusions |
| 3 | `common:v29.pricing.compare.row.support` | «Зөвлөгөөний хугацаа» (consultation period) | «Зөвлөгөөний дараа асуулт асуух хугацаа» (support window) |
| 4 | `student:v15.services.scope.consultation` | «Зөвлөгөөний хугацаа» (a duration) | «Зөвлөгөө» |
| 5 | `student:register.privacyNote` | shared only with "the counselor you chose" — partner agency / Hangyul team missing | shared only with the Hangyul team (incl. its partner agency) and the universities you choose |
| 6 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Бичиг баримт бэлтгэх» (we prepare the documents) | «Визийн бичиг баримт бэлтгэхэд туслана» |
| 7 | `common:v29.pricing.compare.value.documents.INTENSIVE` | «Нарийвчилсан шалгалт» ("detailed exam"); notes on what to fix missing | in-depth review with notes on what to fix |
| 8 | `common:v29.pricing.premium.f4` | only "visa dates managed" — documents missing | visa documents and key dates closely managed |
| 9 | `common:v29.pricing.compare.row.managed`, `all_in_one.f2`, `premium.f2`, `v29.addon.item.extra_application`, `student:v15.services.allowance.key.max_managed_applications` | «хариуцан хөтлөх» / «Хөтлөх элсэлт» (we take it over) | «тантай хамт хөтлөх өргөдөл» |
| 10 | `common:v29.pricing.compare.row.dedicated`, `premium.f5` | «Тусгай баг» (special team) | «Тусгайлан хуваарилсан баг» |
| 11 | `common:v29.pricing.all_in_one.f1`, `premium.f1` | "up to 5/7 suggestions" (of what unclear) | up to 5/7 recommended universities |
| 12 | `common:v29.pricing.premium.position` | started at visa; "from application" missing | from application to visa, arrival and first weeks |
| 13 | `common:v29.pricing.notes.agreement` | added "service scope" not in source | schedule, editing scope, reply times |
| 14 | `common:appStatus.OFFERED`, `student:stage.OFFERED`, `OFFER_ACCEPTED`, `student:v26.now.empty.LATER`, `v26.now.state.LATER` | «Санал ирсэн» / «санал авмагц» (a proposal) | admission offer: «Элсэлтэд тэнцсэн шийдвэр ирсэн», «Элсэхээ баталгаажуулсан» |
| 15 | `common:certification.UNKNOWN` | "accreditation not verified" (reads as not certified) | certification status unknown |
| 16 | `concierge:status.DORMITORY.ASSIGNED` | «Өрөө санал болгосон» (room suggested) | «Өрөө хуваарилсан» |
| 17 | `concierge:arrived.confirmText`, `moveIn.item.address_report.text` | "get" the card; "move" condition dropped | apply within 90 days; report a new address within 15 days *if you move* |
| 18 | `student:settings.privacy.purpose.MARKETING.text` | "you can cancel your account any time" | you can unsubscribe any time |
| 19 | `marketing:v11.services.s1.text` | "perfectly fits", "we take responsibility for the whole process" | suggests institutions that fit; helps you prepare and deal with the university |
| 20 | `marketing:v11.why.s3.title/text`, `v11.why.s1.text`, `v11.why.s2.title` | "best results", "successful study life", "partner to success", "100% strategy" | fair price, no surprises; scope visible before paying; no promises |
| 21 | `marketing:v11.hero.title/lede`, `v11.services.s2.text/title` | "makes your dream reality"; "get the visa"; "perfect support" | transcreated from corrected source; visa *application* help |
| 22 | `marketing:v11.faq.q6.a` | every university has scholarships | most do; amounts and conditions differ |
| 23 | `marketing:v11.faq.q3.q`, `q4.q`, `q2.q` | "which tests are taken" etc. | which tests are accepted; can I apply without Korean |
| 24 | `marketing:v12.terms.universityInfo.p` | contained Hangul «대학알리미» | Academy Info, described in Mongolian |
| 25 | `marketing:v15.pricing.title` | brand in Cyrillic «Хангюл» | «Hangyul-ийн үйлчилгээний үнэ» |
| 26 | `marketing:v15.pricing.compare.item` | «Үзүүлэлт» where the source is intentionally empty | empty |
| 27 | `marketing:v20.city.Gyeonggi.line` | "greener" | roomier |
| 28 | `marketing:v12.privacy.collect.verification.purpose` | "automated sign-ups" | fraudulent sign-ups |
| 29 | `visaroute:step.slow_items.why`, `caveat.APOSTILLE_TRANSITION`, `student:compare.legalCount_*`, `profileV3.why.basics` | «консулын баталгаажуулалт» / bare «баталгаажуулалт»; apostille dropped | «апостиль эсвэл консулын легализаци» |
| 30 | `visaroute:help.ask` | «Хүнээс асуух» (ask a person) | ask the Hangyul team |

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
| Directory / discovery (`v12.directory.*`, `v20/v21/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| **Sum** | | | | | | | **217 / 240** |

Before the rewrite the why, services, pricing and FAQ areas fell well below 26 (TRUST and SPECIFICITY) because of the
guarantees, superlatives, the Cyrillic brand and the missing scope text above. Every area is now 26/30 or higher.
Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | «Hangyul-ийн баг», document counts, services-in-progress title, next consultation |
| Applications | 5 | 5 | 4 | 5 | 4 | offer/acceptance statuses, withdraw, student submits, "meets requirements, needs checking" tier |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, `package.line`, automatic-check note, notarized translation term |
| Services | 5 | 5 | 4 | 5 | 4 | consultation not a duration, managed vs recommended, "ask any time" scoped to the service term, not-included list |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille / consular legalization, sponsor financial documents, TB certificate, partner pickup, room assigned |

## Unresolved ambiguity / limits (listed, not guessed)

- `_one` without `{{count}}` (`student:v8.compare.budget_one`, `v9.discovery.scholarship_one`): Mongolian `one` is only
  n=1, so no issue; listed for parity with other locales.
- `marketing:v12.privacy.retention.advertising.record` (표시·광고): kept «Шошголт ба зар сурталчилгааны бүртгэл»; the exact
  Mongolian legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` kept «Дипломын дээд (коллеж)»: closest Mongolian level, not an exact equivalent.
- `common:intakeLabel` stays «{{year}} {{term}}»: the term values are capitalised labels («Хавар»), so «{{year}} оны
  {{term}}» would show a mid-phrase capital; needs a source/format change to be fully natural.
- Placeholder suffixes (`{{name}}-ийн`, `{{university}}-д`): Mongolian vowel harmony depends on the inserted name;
  rephrased where cheap (e.g. `task.universityRequestItem`, `dashboard…FIX.title`), others left as the established
  convention.
- `marketing:v11.faq.q1.a`: owner Korean says parents' passport copy "if no foreign passport"; English says "no
  passport". Translated from the English.
- `student:v9.funds.longer_other` 'consulting' tier rendered «зөвлөгөө авах» (government term 컨설팅 대학); no official
  Mongolian equivalent found.

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
