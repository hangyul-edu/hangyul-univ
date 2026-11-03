# V31 locale review — Filipino (fil)

Job: `scripts/i18n/v28/jobs-v31/fil.json` · Output: `scripts/i18n/v28/tx-v31/fil.json` · Glossary: `glossary/fil.json`
Register: friendly **ka / mo / iyo** throughout (the existing register; no mixed *kayo / inyo* left), Taglish where English is
what Philippine study-abroad agencies actually write online (visa, apostille, consular legalization, transcript of records,
deadline, residence card, health insurance, flight, airport pickup, personal statement, study plan, mock interview,
plan names). Tagalog kept where it is the natural everyday word (konsultasyon, pagsusuri, dormitoryo, matrikula, tirahan).
Brand team = **Team Hangyul** (established in `current`); "Team Hangyul Univ" kept only where the source says "Hangyul Univ team".

## Counts

| | |
|---|---|
| Keys reviewed | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,395 (includes 30 `v31` keys whose re-translation from the new source came out identical to `current`) |
| Rewritten | 334 |
| — new source (`v31`) | 223 |
| — meaning | 8 |
| — terminology | 59 (37 × "Team Hangyul Univ" → "Team Hangyul" where the source says "the Hangyul team"; *kard ng paninirahan* → residence card; *segurong pangkalusugan* → health insurance; *lipad / sundo sa paliparan* → flight / airport pickup; *talaan* → checklist; *sanaysay* → essay; *plano ng pag-aaral* → study plan; *inyong plano* → plan mo; *pag-aangkop* → pag-settle in; *Ingles* → English) |
| — naturalness | 36 (em-dash connectors, slash-joined phrases, "Kailangan ka" → "Kailangan ng aksyon mo", *aparato / sesyon*, *Taglagas (Fall)*) |
| — quality | 8 (empty-string rule, `fit.or` spacing, nav/label length, Ho Chi Minh City left in English) |

All 253 `v31` keys were re-translated from the new source (223 changed, 30 identical). One key had no `current`
(`student home.documentsSub_one`) and two common task keys were new; all are now translated.

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| common `v29.pricing.compare.scopeNote` | Premium "no limit" note dropped the second sentence (new documents, translation, notarization NOT included) | full scope + exclusions restored |
| common `v29.pricing.compare.row.support` | "Panahon ng konsultasyon" (consultation period — support window read as sessions) | "Panahon ng pagtatanong pagkatapos ng konsultasyon" |
| common `v29.pricing.all_in_one.f5` | "Inihahanda ang dokumento ng visa" (Hangyul prepares the visa documents) | "Tulong sa paghahanda ng mga dokumento sa visa · binabantayan ang mga petsa ng aplikasyon sa dormitoryo" |
| common `v29.pricing.compare.value.visa.DOCUMENT_PREP` | "Paghahanda ng dokumento" (Hangyul prepares) | "Tulong sa paghahanda ng mga dokumento sa visa" |
| common `v29.pricing.premium.f4` | "Masusing pagbabantay sa iskedyul ng visa" (visa documents dropped) | documents and key dates closely managed · help with the dormitory application |
| common `v29.pricing.compare.value.documents.INTENSIVE` | "Masusing pagsusuri" (notes on what to fix lost) | "Masusing pagsusuri, may mga tala kung ano ang aayusin" |
| common `v29.pricing.notes.visaDecision` | "ang awtoridad ang magpapasya" (unnamed authority) | decision explicitly with *mga awtoridad sa imigrasyon* |
| common `v29.pricing.compare.value.dormitory.INFORMATION` / `.APPLICATION` | "Impormasyon" / "Tulong sa aplikasyon at alternatibo" (no object) | dormitory information / help applying, plus other housing options |
| common `uni27.schol.youMay` | "Baka pasok ka sa mga kondisyon ng" (broken fragment) | "Mga scholarship na posibleng pasok ka" |
| common `certification.UNKNOWN` | "Hindi pa na-verify ang sertipikasyon" (implies a certification exists) | "Hindi pa tiyak kung certified" |
| student `v4.ws.team.final` | "Huling pagsusuri, saka ipapadala ang iyong aplikasyon sa {{university}}" (Hangyul submits) | "Huling pagsusuri bago mo isumite sa {{university}}" |
| student `v15.services.allowance.unlimited` | "Palaging maaaring kausapin ang Team Hangyul Univ" (no scope) | "… anumang oras sa loob ng service term mo" |
| student `v15.services.scope.consultation` | "Haba ng konsultasyon" (V15 minutes wording) | "Konsultasyon" |
| student `v15.services.level.document_review.STANDARD` | "Pangunahing pagsusuri" (basic ≠ standard) | "Standard na pagsusuri" |
| student `phase.prepare.text` | write it "kasama ang Team Hangyul Univ" (co-writing) | write it yourself, with feedback from Team Hangyul |
| student `register.privacyNote` | shared with "tagapayo" only (team and partner agency omitted) | Team Hangyul incl. its partner agency + chosen universities |
| student `register.consent.PRIVACY.summary` | password "(naka-encrypt)" (hash ≠ encryption) | "password hash" |
| student `register.consent.CROSS_BORDER_VERIFICATION.*` | "pag-verify ng pagkakakilanlan" (identity) and an invented list of disclosures | verifies the email and mobile number; source content only |
| student `budget.beforeArrivalHint` | "unang termino sa dormitoryo at ang iyong unang buwan" (what of the first month?) | complete list incl. first month's living costs |
| student `discover.verdict.reach` · success `group.possible` | "Posibleng tugma" (possible match) | "Pasok sa requirements, kailangang suriin" |
| marketing `v11.services.s1.text` | "kami ang bahala sa buong proseso" (Hangyul handles everything) | suggest, go through scholarships, help prepare documents and deal with the university |
| marketing `v11.why.s1/s2/s3.*`, `v11.hero.*`, `v11.services.*` | "kapartner mo hanggang sa magtagumpay ka", "Pinapalaki ng Hangyul ang potensyal mo", "pinakamagandang resulta", "100% na plano" (outcome promises, old KO hype) | V31 source: same team start to finish; realistic universities; fair price, scope seen before paying |
| marketing `v11.faq.q6.a` | "May scholarship ang bawat unibersidad" (every university) | "Karamihan ay mayroon …" |
| marketing `v12.terms.services.writing`, `v12.terms.definitions.support.def`, `v12.terms.intro` | "pagsusuri" for 첨삭 (editing ≠ review) | "pag-edit" |
| marketing `v12.terms.services.documents` | "Paghahanda at pagsusuri ng mga dokumento" (Hangyul prepares) | help preparing + document review |
| marketing `v12.terms.universityInfo.p` | contained Hangul (대학알리미) | "Academy Info" |
| marketing `v12.privacy.collect.verification.purpose` | "automated na pag-sign up" for fraudulent sign-ups | "mapanlinlang na pag-sign up" |
| marketing `v12.privacy.retention.contract.record` | "pag-urong ng subscription" (there is no subscription) | "pagkansela ng order" |
| marketing `v20.uni.why.ieqasBody` | "Mas maluwag na pamantayan sa visa" (looser standards) | simpler visa screening |
| marketing `v20.city.Gyeonggi.line` | "mas luntian" (greener) for roomier | "mas maluwag" |
| marketing `v15.pricing.compare.item` | "Bagay" where the source is intentionally empty | "" |
| visaroute `step.slow_items.why` | "consular legalization" only (apostille dropped) | "apostille o consular legalization, ang TB test at ang police clearance" |
| concierge `step.pickup.title` | "Mag-book ng iyong sundo sa paliparan" (book with Hangyul) | "Ayusin ang airport pickup mo" (partner arranges) |
| concierge `status.DORMITORY.ASSIGNED` | "Inalok ng kuwarto" (offered a room) | "May nakatalagang kuwarto na" |
| concierge `arrived.confirmText` | "Dapat makakuha ka ng kard … sa loob ng 90 araw" (obtain) | must *apply* within 90 days |
| dossier `v9.who.withdrawSent` | "naipadala na rito" (sent here) | "naipadala na roon" (stays with that university) |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`, `v13/v14.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery copy (`v12/v20/v21/v23/v24.dir.*`, `v20.uni.*`) | 5 | 5 | 5 | 5 | 4 | 5 | 29 |

Pre-rewrite the hero, why and services rows scored 17–20/30 (old KO hype translated literally, outcome promises,
em-dash chains, "kami ang bahala sa buong proseso"); pricing scored 21/30 (support window as "consultation period",
Hangyul "preparing" visa documents, Premium scope note truncated). All rewritten.

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| Area | AC | SA | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 5 | 5 | 5 | Team Hangyul name, documents counter (+ missing `_one`), next-consultation label, "Kailangan ng aksyon mo" |
| Applications | 5 | 5 | 5 | 5 | 5 | final check no longer implies Hangyul submits; "Pasok sa requirements, kailangang suriin"; checklist term |
| Documents | 5 | 5 | 5 | 5 | 4 | dossier v31 strings, method note, stored group, "roon" fix |
| Services | 5 | 5 | 4 | 5 | 4 | allowance labels use glossary terms; service-term scope; standard ≠ basic; *inyong* → *mo* |
| Visa / housing | 5 | 5 | 5 | 5 | 4 | apostille vs consular legalization, sponsor financial documents, partner pickup, room assigned, residence card / health insurance terms |

## Unresolved ambiguity (listed, not guessed)

- `marketing v11.faq.q1.a` — "High school or junior college graduation certificate": for Filipino applicants a Korean university may want the Diploma, the Certificate of Graduation or the Form 137/138; the source does not say which, so the glossary term (*sertipiko ng pagtatapos*) is used.
- `visaroute step.slow_items.why` — "police certificates" rendered "police clearance" (the PH NBI/police term); the visaroute flows are currently Viet Nam-specific and the source does not distinguish.
- `common term.FALL / term.SPRING` — now "Fall / Spring" (how PH agencies name Korean intakes); the source gives no month-based alternative.
- `marketing v20.uni.why.foundedBody` — "one of the older institutions" has no threshold in the source.
- `common appStatus.OFFERED` — "alok" kept for admission offer; whether this status always means an admission offer (vs. a scholarship or dormitory offer) is not stated in the source.

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
