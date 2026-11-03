# V31 locale review — Nepali (ne)

Job `scripts/i18n/v28/jobs-v31/ne.json` → `scripts/i18n/v28/tx-v31/ne.json`; glossary `docs/qa/v31/l10n/glossary/ne.json`.
Register: तपाईं, the plain Nepali that Kathmandu education consultancies use with students and parents, with the loanwords
students actually use (काउन्सेलिङ, पर्सनल स्टेटमेन्ट, स्टडी प्लान, एडिटिङ राउन्ड, मक इन्टरभ्यु, अपोस्टिल, कन्सुलर लिगलाइजेसन,
ट्रान्सक्रिप्ट, ग्र्याजुएसन सर्टिफिकेट, भर्ना अफर, प्लान, पार्टनर, ओरिएन्टेसन, स्पोन्सर, GPA). Standard Nepali stays where it is
what students say (कागजात, छात्रावास, भिसा, राहदानी, विदेशी दर्ता कार्ड). Brand always Latin "Hangyul" / "Hangyul Univ"; the
student-facing team is "Hangyul टोली". Plan names stay Latin. Latin digits throughout.

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310, concierge 181, dossier 66, marketing 384, student 590, success 33, visaroute 164, writing 1) |
| Kept verbatim | 1,363 (incl. 33 of 253 `v31` keys whose existing Nepali already said exactly what the new source says) |
| Rewritten | 366 |
| — new source (`v31`, re-translated) | 218 (2 more `v31` keys were rewritten for terminology, counted there) |
| — terminology (glossary consistency) | 91 |
| — naturalness | 30 |
| — product quality / UI role | 21 |
| — meaning (non-`v31` key) | 6 |

Terminology sweep: परामर्श → काउन्सेलिङ; व्यक्तिगत विवरण → पर्सनल स्टेटमेन्ट; अध्ययन योजना → स्टडी प्लान; product योजना/प्याकेज
→ प्लान (study-plan and visa-plan senses keep योजना); एपोस्टिल → अपोस्टिल; कन्सुलर प्रमाणीकरण / bare प्रमाणीकरण for 영사확인 →
कन्सुलर लिगलाइजेसन; प्रस्ताव (offer) → भर्ना अफर; शैक्षिक प्रतिलिपि → ट्रान्सक्रिप्ट; दीक्षान्त/उत्तीर्ण → ग्र्याजुएसन सर्टिफिकेट;
university आवास → छात्रावास; साझेदार → पार्टनर; प्रायोजक → स्पोन्सर; अभिमुखीकरण → ओरिएन्टेसन; जीपीए → GPA; सुरक्षित (saved) → सेभ;
"Hangyul Univ टोली" → "Hangyul टोली" wherever the source says "the Hangyul team" (kept where EN says "Hangyul Univ team");
Devanagari digits → Latin; em-dash connectors and slash-joined phrases removed; every Hangul leak removed.

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| student:v4.ws.team.final | "after the final check your application will be sent to {{university}}" (Hangyul submits) | final check before you submit it yourself to {{university}} |
| common:v29.pricing.compare.row.support | परामर्श अवधि (consultation period; reads as session length) | काउन्सेलिङपछि प्रश्न सोध्न मिल्ने अवधि (support window) |
| common:v29.pricing.compare.scopeNote | Premium no-limit within contract; **dropped** "writing new documents, translation and notarization not included" | full scope + exclusions |
| common:v29.pricing.compare.row.managed, student:v15.services.allowance.key.max_managed_applications | व्यवस्थापन गरिने/गरिएका आवेदन (passive count label, forbidden) | हामीले तपाईंसँगै व्यवस्थापन गर्ने आवेदन |
| student:v15.services.allowance.unlimited | "always contact the team" (no bound) | सेवा अवधिभर जुनसुकै बेला Hangyul टोलीलाई सोध्नुहोस् |
| student:v15.services.scope.consultation | परामर्शको अवधि (consultation duration — V15 minutes wording) | काउन्सेलिङ |
| common:v29.pricing.all_in_one.f5, compare.value.visa.DOCUMENT_PREP | भिसा कागजात तयारी / कागजात तयारी (Hangyul prepares) | भिसा कागजात तयार गर्न सहयोग |
| common:v29.pricing.premium.f4 | only visa *schedule* managed (documents dropped) | भिसा कागजात र मुख्य मितिहरूको नजिकबाट व्यवस्थापन · छात्रावास आवेदनमा सहयोग |
| common:v29.pricing.compare.value.dormitory.SCHEDULE, all_in_one.f5 | छात्रावासको समयसीमा व्यवस्थापन (reads as handling the dorm application) | छात्रावास आवेदनका मितिमा हामी नजर राख्छौँ |
| common:v29.pricing.compare.value.documents.INTENSIVE | गहन समीक्षा (notes on what to fix dropped) | गहन समीक्षा, के सुधार्ने भन्ने सुझावसहित |
| common:v29.pricing.premium.position | visa, arrival, first weeks (application dropped) | आवेदनदेखि भिसा, आगमन र पहिला हप्तासम्म |
| common:v29.pricing.all_in_one.f1 / premium.f1 | बढीमा 5/7 सिफारिस (number with no object) | बढीमा 5/7 सिफारिस गरिएका विश्वविद्यालय |
| student:v15.services.allowance.key.max_recommended_institutions | सिफारिस गरिएका संस्था (vague) | सिफारिस गरिएका विश्वविद्यालय |
| common:v29.addon.item.airport_pickup | एयरपोर्ट पिकअपको व्यवस्था मिलाउने (no partner — implies Hangyul runs transport) | पार्टनरमार्फत मिलाइने एयरपोर्ट पिकअप |
| concierge:step.pickup.sub | "someone comes to meet you" | तपाईंको पिकअप पार्टनरले आगमन हलमा तपाईंलाई भेट्छ |
| marketing:v11.services.s1.text | "we handle the whole process, from preparing documents to contacting the university" | we help prepare documents and deal with the university |
| marketing:v11.services.s2.text | visa *issuance* offered as a Hangyul service | भिसा आवेदन, विदेशी दर्ता कार्ड र कोर्स दर्तामा हामी सहयोग गर्छौं |
| marketing:v12.terms.services.documents | आवेदन कागजातको तयारी र समीक्षा (Hangyul prepares) | आवेदन कागजात तयार गर्न सहयोग, र कागजात समीक्षा |
| marketing:v12.privacy.collect.documents.purpose | भिसा तयारीमा सहयोग (not tied to documents) | भिसा कागजात तयार गर्न सहयोग |
| marketing:v11.why.s3.text | "guarantees a successful student life" | fair price; you see what your प्लान includes before paying |
| marketing:v11.hero.lede, why.s1.*, why.s2.*, services.title, services.s2.title, why.s3.title | "we make your dream reality", "100% strategy", "your success partner", "no worries, full support", "best results" (overclaims) | truthful V31 source copy, transcreated |
| marketing:v11.faq.q6.a | every university offers scholarships | धेरैजसोले दिन्छन् (most do) |
| marketing:v11.faq.q3.q | "which language tests are held?" | कुन-कुन भाषा परीक्षा मान्य हुन्छन्? |
| marketing:v11.faq.q1.a | "if a parent has no *foreign* passport"; transcript as लब्धाङ्कपत्र | आमा वा बुबासँग राहदानी छैन भने…; ट्रान्सक्रिप्ट, अपोस्टिल |
| marketing:v20.city.Gyeonggi.line / .body | "cheaper, green"; every campus "has its own dormitories" | सस्तो, फराकिलो; more students live in university dorms |
| marketing:v12.privacy.collect.verification.purpose | "fraudulent" rendered "automated" sign-ups | धोखाधडीपूर्ण दर्ता रोकथाम |
| marketing:v12.privacy.retention.contract.record | "subscription withdrawal" | सम्झौता र अर्डर रद्दका रेकर्ड |
| marketing:v12.privacy.sharing.agency.when | "when you accept responsibility" | when you agree to be assigned an agency |
| marketing:v12.terms.definitions.support.def, terms.services.writing, terms.intro | essay *editing* rendered "review" / "writing review" | पर्सनल स्टेटमेन्ट र स्टडी प्लानको एडिटिङ |
| marketing:v12.privacy.collect.counselling.purpose / .items | invented "writing review"; editing comments as "review comments" | कागजात समीक्षा; एडिटिङ टिप्पणी |
| visaroute:step.slow_items.why | प्रमाणीकरण… (apostille dropped; consular legalization reduced to "verification") | अपोस्टिल वा कन्सुलर लिगलाइजेसन, क्षयरोग (TB) जाँच र प्रहरी प्रमाणपत्रमा हप्तौँ लाग्न सक्छ |
| visaroute:caveat.APOSTILLE_TRANSITION | कन्सुलर प्रमाणीकरण (≈ consular confirmation) | कन्सुलर लिगलाइजेसन |
| student:compare.legalCount_one/_other, profileV3.why.basics | एपोस्टिल वा प्रमाणीकरण | अपोस्टिल वा कन्सुलर लिगलाइजेसन |
| student:register.privacyNote | shared only with "the counselor you chose" (Hangyul team and partner agency missing) | Hangyul टोली (यसको पार्टनर एजेन्सीसमेत) र तपाईंले छानेका विश्वविद्यालय |
| student:discover.verdict.reach, success:group.possible | सम्भावित मिलान / म्याच (possible match) | सर्त पूरा, जाँच आवश्यक |
| concierge:arrived.confirmText | card must be *issued* within 90 days | 90 दिनभित्र विदेशी दर्ता कार्डका लागि आवेदन दिनुपर्छ |
| student:compare.yes / no | हो / होइन (is / is not) for whether a facility exists | छ / छैन |
| student:onboarding.education.levels.HIGH_SCHOOL | माध्यमिक विद्यालय (in Nepal = grade-10 school) | हाइस्कुल (+2) |
| visaroute:form.section.school | विद्यालय (school, K-12) | कोरियामा तपाईंको विश्वविद्यालय |
| student:dashboard.counselor.nextCall, messages.call | कल (a phone call, not the consultation) | काउन्सेलिङ / भिडियो काउन्सेलिङ |
| visaroute:help.ask | मान्छेसँग सोध्नुहोस् ("ask a human") | Hangyul टोलीलाई सोध्नुहोस् |
| dossier:page.summary | added "ready for all applications" | {{total}} मध्ये {{ready}} तयार |
| dossier:group.extraCount | no "show" action; "kept for later" | राखिएका थप {{count}} कागजात देखाउनुहोस् |
| visaroute:doc.other_id_copy.name, doc.other_applicant_questionnaire.name | "copy, front and back" and "embassy / study visa" dropped | full names |
| student:writing.status.DRAFT | added an instruction not in the source | मस्यौदा |
| student:v9.funds.longer_other | English "consulting" inside the sentence | ('कन्सल्टिङ') तह |
| common:docCategory.RESIDENCE_CARD, concierge:emergency.nhis_foreigners, step.health_insurance.title, housing.settledText, moveIn.item.address_report.text, marketing:v12.terms.universityInfo.p | Hangul left in Nepali text (외국인등록증, 국민건강보험, 대학알리미) | Hangul removed (विदेशी दर्ता कार्ड, NHIS, Academy Info) |
| common:fit.or | "वा" without surrounding spaces (glued text) | " वा " |
| marketing:v15.pricing.compare.item | non-empty where English is intentionally empty | empty |
| common:task.universityRequestItem, task.sendStudyPlanFeedback | missing (null) | translated |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (v11.hero.*, seo.home.*) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (v11.why.*, v29.why.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (v11.services.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing (plan cards + comparison, common:v29.pricing.*, v15.pricing.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (v29.addon.*, v29/v31.pricing.notes.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (v11.faq.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (v11.cta.*, v20.uni.cta*, v13/v14.cta) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
| Directory / discovery (v12/v20/v21/v23/v24 dir + uni + city) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| Area | AC | SA | N | CO | B | Notes / fixes |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 5 | team name unified; consultation no longer "call" |
| Applications | 5 | 5 | 4 | 5 | 4 | final check no longer implies Hangyul submits; verdict "meets, needs checking"; offer = भर्ना अफर |
| Documents | 5 | 5 | 4 | 5 | 5 | apostille / consular legalization exact; dossier counts exact; Hangul removed |
| Services | 5 | 5 | 4 | 5 | 4 | managed ≠ recommended; support window bounded by term; plan = प्लान |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | pickup via partner; embassy/immigration decides; dorm dates tracked, not applied; residence card = apply within 90 days |

## Unresolved ambiguity (listed, not guessed)

- `marketing:v11.faq.q1.a` — the source lists apostille for every document, but Nepal is not a party to the Apostille
  Convention: Nepali documents normally go through MOFA attestation and Korean-embassy consular legalization. Translated as
  the source says; Nepal is a priority market, so the source owner should consider a per-nationality note.
- `marketing:v20.uni.why.dormitoryBody` — EN/KO ("the simplest way to arrive with somewhere to live") read close to an
  assured room; kept as written, owner may want "if you get a place".
- `marketing:v12.terms.refunds.stage.ESSAY_REVIEW_DELIVERED` — source says "review" (검토) while the product sells essay
  editing (첨삭); translated as समीक्षा per the source.

## Validator

`JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=ne` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
(never run with `--apply`).

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`
