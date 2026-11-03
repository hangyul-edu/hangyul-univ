# V31 locale review — Hindi (hi)

Job `scripts/i18n/v28/jobs-v31/hi.json` → `scripts/i18n/v28/tx-v31/hi.json`; glossary `docs/qa/v31/l10n/glossary/hi.json`.
Register: आप, everyday Indian study-abroad Hindi (not Sanskritised), with the loanwords students actually use
(वीज़ा, अपॉस्टिल, ट्रांसक्रिप्ट, काउंसलिंग, पर्सनल स्टेटमेंट, स्टडी प्लान, मॉक इंटरव्यू, डॉर्मिटरी, प्लान, फ़ॉल/स्प्रिंग इनटेक).
Brand always Latin "Hangyul" / "Hangyul Univ"; student-facing team = "Hangyul टीम". Plan names stay Latin.

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (8 namespaces: common 310, concierge 181, dossier 66, marketing 384, student 590, success 33, visaroute 164, writing 1) |
| Kept verbatim | 1,411 (incl. 30 `v31` keys whose existing Hindi already said exactly what the new source says) |
| Rewritten | 318 |
| — new source (`v31`, re-translated) | 218 |
| — terminology (glossary consistency) | 66 |
| — naturalness | 22 |
| — product quality / UI role | 7 |
| — meaning (non-`v31` key) | 5 |

Terminology sweep: "Hangyul Univ टीम" → "Hangyul टीम" wherever the source says "the Hangyul team"; अकाउंट → खाता;
हॉस्टल → डॉर्मिटरी; एपोस्टिल/अपोस्टिल → अपॉस्टिल; परामर्श → काउंसलिंग; व्यक्तिगत वक्तव्य/विवरण → पर्सनल स्टेटमेंट;
अध्ययन योजना → स्टडी प्लान; योजना (product plan) → प्लान; वाणिज्य दूतावास/कांसुलेट → कॉन्सुलेट; परिसर → कैंपस;
शरद/वसंत → फ़ॉल/स्प्रिंग; em-dash connectors and slash-joined phrases removed.

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| common:v29.pricing.compare.row.support | "परामर्श सहायता" (consultation support — reads as sessions) | काउंसलिंग के बाद सवाल पूछने की अवधि (support window) |
| common:v29.pricing.compare.scopeNote | Premium no-limit within contract only; **dropped** "new documents, translation and notarization not included" | full scope + exclusions restored |
| student:v4.ws.team.final | "final check, then your application will be sent to {{university}}" (Hangyul submits) | आपके {{university}} में जमा करने से पहले आख़िरी जाँच (student submits) |
| visaroute:step.slow_items.why | "कांसुलर सत्यापन…" — apostille dropped; consular legalization as "verification" | अपॉस्टिल या कॉन्सुलर लीगलाइज़ेशन, टीबी जाँच और पुलिस सर्टिफ़िकेट में कई हफ़्ते लग सकते हैं |
| visaroute:caveat.APOSTILLE_TRANSITION | "कांसुलर सत्यापन" (≈ consular confirmation) | कॉन्सुलर लीगलाइज़ेशन |
| student:compare.legalCount_one/_other, profileV3.why.basics | "एपोस्टिल या सत्यापन" (legalization reduced to "verification") | अपॉस्टिल या कॉन्सुलर लीगलाइज़ेशन |
| student:register.privacyNote | shared "only with that counselor" — Hangyul team and partner agency missing | Hangyul टीम (उसकी पार्टनर एजेंसी समेत) और आपके चुने हुए विश्वविद्यालय |
| common:v29.addon.item.airport_pickup | "एयरपोर्ट पिकअप की व्यवस्था" (no partner — implies Hangyul runs transport) | एयरपोर्ट पिकअप, पार्टनर के ज़रिए व्यवस्था |
| concierge:step.pickup.sub | "someone will meet you" | आपका पिकअप पार्टनर आगमन हॉल में आपसे मिलेगा |
| common:v29.pricing.all_in_one.f5, compare.value.visa.DOCUMENT_PREP | "वीज़ा दस्तावेज़ों की तैयारी" / "दस्तावेज़ तैयारी" (Hangyul prepares) | वीज़ा दस्तावेज़ तैयार करने में मदद |
| marketing:v12.terms.services.documents | "preparation and review of application documents" (Hangyul prepares) | आवेदन दस्तावेज़ तैयार करने में मदद, और दस्तावेज़ों की समीक्षा |
| common:v29.pricing.premium.f4 | only "visa dates" — documents dropped | वीज़ा दस्तावेज़ों और मुख्य तारीख़ों का बारीकी से प्रबंधन · डॉर्मिटरी आवेदन में मदद |
| common:v29.pricing.compare.row.managed, student:v15.services.allowance.key.max_managed_applications | "प्रबंधित आवेदन" (passive count label, forbidden) | आवेदन जिन्हें हम आपके साथ मैनेज करते हैं |
| student:discover.verdict.reach, success:group.possible | "संभावित मैच" (possible match) | शर्तें पूरी, जाँच ज़रूरी |
| marketing:v15.pricing.title | "हांग्युल की कोरिया अध्ययन सेवा का शुल्क" (brand in Devanagari) | Hangyul की सेवाओं का शुल्क |
| marketing:v11.why.s3.text | "…आपकी पूरी पढ़ाई को सँभालता है" (guarantee of the whole study) | fair price, scope visible before payment |
| marketing:v11.why.s1.text, v11.why.s2.title, v11.services.title, v11.hero.lede | "कामयाबी तक का साथी", "100% रणनीति", "हर पल साथ", "सपने को हक़ीक़त" (overclaims from old ko) | truthful V31 source copy |
| marketing:v11.faq.q6.a | "every university offers scholarships" | ज़्यादातर विश्वविद्यालय देते हैं |
| marketing:v12.terms.definitions.support.def | essay *editing* rendered as "review" | पर्सनल स्टेटमेंट और स्टडी प्लान की एडिटिंग |
| marketing:v12.privacy.collect.verification.purpose | "fraudulent" rendered "automated" | धोखाधड़ी वाले साइन-अप रोकना |
| marketing:v12.privacy.retention.contract.record | "subscription withdrawal" | ऑर्डर रद्द करने के रिकॉर्ड |
| marketing:v12.terms.universityInfo.p | contained Hangul (대학알리미) | Academy Info |
| common:fit.or | "या" without the surrounding spaces (glued text) | " या " |
| marketing:v15.pricing.compare.item | non-empty where English is intentionally empty | empty |
| common:task.universityRequestItem, task.sendStudyPlanFeedback, student:home.documentsSub_one | missing (null) | translated |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (v11.hero.*, seo.home.*) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (v11.why.*, v29.why.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (v11.services.*) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing (plan cards + comparison) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (v11.faq.*) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (v11.cta.*, v20.uni.cta*) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
| Directory / discovery (v12/v20/v21/v24 dir + uni) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| Area | AC | SA | N | CO | B | Notes / fixes |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | team name unified, `_one` form added |
| Applications | 5 | 5 | 4 | 5 | 4 | final-check line no longer implies Hangyul submits; verdict "meets, needs checking" |
| Documents | 5 | 5 | 4 | 5 | 5 | apostille / consular legalization exact; counts reworded |
| Services | 5 | 5 | 4 | 5 | 4 | managed ≠ recommended; support window; plan term = प्लान |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | partner pickup; dormitory ≠ guaranteed room; immigration decides |

## Unresolved ambiguity (listed, not guessed)

- marketing:v11.faq.q1.a — ko "올림픽 참가 증명서" (Olympics) vs en "olympiad"; followed en (ओलंपियाड).
- concierge:arrived.confirm — Hindi first-person past needs gender; kept the conventional "पहुँच गया/गई हूँ" because no neutral form reads naturally on a button.
- student:v15.services.allowance.unlimited — key name says "unlimited", source says "ask any time during your service term"; translated the source (scope kept).
- common:fit.test.* (except KIIP / KING_SEJONG / UNIV_KLI) — passed through as official test names by the validator.

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=hi` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
