# V27 l10n review — Nepali (ne)

Scope: all 727 current strings (729 when I started; two `_one` keys in common were removed upstream during the run) of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/ne.json`.
Register: polite तपाईं form with "-नुहोस्" imperatives (the norm for Nepali education services and consultancies); the
counselor is referred to with honorific verb forms (परामर्शदाताले … गर्नुहुन्छ). Digits are Latin, as in the existing bundle.

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Sushmita, 18, Pokhara | +2 science graduate, planning a bachelor's after a year at a Korean language institute (D-4-1 → D-2) | Plain words, no jargon, clear next step |
| Bikash, 27, Kathmandu | Civil engineer, master's applicant, has IELTS, reads English-heavy Nepali | Exact requirement and document terms (apostille, consular legalization, CCVI) |
| Sushmita's father, 52, Pokhara | Paying tuition and showing the bank balance | Money, refund and fraud warnings that are unambiguous |

## Glossary

| English | Nepali | Note |
|---|---|---|
| scholarship | छात्रवृत्ति | bundle term |
| Global Korea Scholarship (GKS) | कोरियाली सरकारी छात्रवृत्ति (GKS) | the name Nepali students and media use |
| admission guide (모집요강) | भर्ना निर्देशिका | |
| apostille | एपोस्टिल | bundle term |
| consular legalization (영사확인) | कन्सुलर प्रमाणीकरण | bundle term; never "पुष्टि" |
| Korean language institute | कोरियाली भाषा संस्थान | |
| Korean language program (level) | कोरियाली भाषा कार्यक्रम | bundle term |
| counselor | परामर्शदाता | bundle term |
| the Hangyul team | Hangyul टोली | brand kept in Latin |
| tuition | शिक्षण शुल्क | bundle term |
| deadline | अन्तिम मिति | bundle term |
| certificate of admission / admission letter | भर्ना पत्र (Certificate of Admission) | bundle term |
| residence card | विदेशी दर्ता कार्ड (ARC) | bundle term; ARC is what students say |
| embassy / consulate | दूतावास / वाणिज्य दूतावास | |
| immigration office | अध्यागमन कार्यालय | |
| CCVI (사증발급인정서) | भिसा जारी पुष्टि प्रमाणपत्र (CCVI) | |
| proof of funds | आर्थिक प्रमाण | |
| match(es) | म्याच | bundle term (मेरा म्याचहरू) |
| Recommended (sort) | सुझाइएको क्रम | browsing order, not वरीयता (ranking) |
| upload | अपलोड गर्नुहोस् | bundle term |
| save | सेभ गर्नुहोस् | bundle term |
| notarized | नोटरी गरिएको | |
| personal statement | व्यक्तिगत विवरण (Personal Statement) | |
| TOPIK level | TOPIK लेभल | |

## Pass A: meaning (10 strings changed)

| Key | Before | After |
|---|---|---|
| common:uni27.schol.youMay | तपाईं यसका सर्त पूरा गर्न सक्नुहुन्छ | तपाईंले सर्त पूरा गर्न सक्ने छात्रवृत्ति (the "its" was added and the scholarship heading lost) |
| common:fit.tier.MEETS.title | प्रकाशित न्यूनतम सर्त पूरा हुन्छन् | तपाईं प्रकाशित न्यूनतम सर्त पूरा गर्नुहुन्छ ("you" was missing) |
| student:discover.subtitle | …वास्तवमै भर्ना पाउन सक्ने कार्यक्रम… | …यथार्थमा आवेदन दिन सकिने कार्यक्रम… (the first version implied getting admitted; it now follows the Korean 지원 가능) |
| student:v9.announced.rule.TOPIK4_FINANCIAL_EXEMPTION | …देखाउनु पर्दैन। | …देखाउनु पर्ने छैन। (announced rule that is not in force yet, so future tense) |
| marketing:v15.pricing.lede | परामर्श मात्र, … | मूल्याङ्कन मात्र, … ("diagnosis", not "consultation") |

## Pass B: native naturalness (21 strings changed)

| Key | Before | After |
|---|---|---|
| student:login.aside.title | कोरियाली विश्वविद्यालयसम्मको हरेक चरणका लागि एउटै शान्त ठाउँ। | कोरियाली विश्वविद्यालयसम्मको हरेक चरण, एउटै ठाउँमा, ढुक्कसँग। ("शान्त ठाउँ" was a calque) |
| student:v4.unlock.topik | …योग्य हुनुहुन्थ्यो। | …योग्य हुनुहुनेछ। (the past counterfactual sounded like a lost chance) |
| student:v9.funds.longer_other | …(सरकारले 'consulting' भनी मूल्याङ्कन गरेको)… | …(सरकारले 'परामर्श' अर्थात् consulting तहमा राखेको)… |
| marketing:agencyNet.points.measured.text | …बढ्ने कच्चा स्वीकृति दर होइन। | …बढ्ने भर्ना दर मात्र होइन। ("कच्चा" for "raw" was a calque) |
| student:dashboard.nextAction.TASK.text.ESSAY_WRITE | …सबै सही हुनु पर्दैन। | …पहिलो पटकमै पूर्ण हुनु पर्दैन। |

## Pass C: UI context, brevity, consistency (41 strings changed)

| Key | Before | After |
|---|---|---|
| student:arrival.subtitle (and 7 others) | आवासीय कार्ड (ARC) | विदेशी दर्ता कार्ड (ARC) (now matches the bundle's established term) |
| student:dashboard.stageText.MATCH (and 14 others) | मिलान | म्याच (now matches the bundle's मेरा म्याचहरू) |
| common:uni27.cat.GKS (and 1 other) | Global Korea Scholarship (GKS) | कोरियाली सरकारी छात्रवृत्ति (GKS) |
| common:uni27.schol.amount | KRW {{amount}} | {{amount}} वन (KRW) |
| common:fit.test.TOEFL_IBT (and 10 test labels) | TOEFL iBT | TOEFL iBT परीक्षा (the test name stays in Latin; the validator needs Devanagari in every string) |

## Final comparison

I compared all 729 original source/target pairs once more against the English and the Korean. That pass found 2 more strings:
`student:compare.legalCount_one/_other` said only "{{count}} लाई…", with no noun to say what was being counted. They
now read "{{count}} वटा कागजातलाई एपोस्टिल वा प्रमाणीकरण चाहिन्छ". Every placeholder and `<em>` tag is
preserved. Nothing promises admission. "Recommended" is rendered as a browsing order (सुझाइएको क्रम), and the
explanatory `fit.order` says explicitly that it is not a ranking. 영사확인 is कन्सुलर प्रमाणीकरण throughout. Each
`_one` plural variant reads correctly for 1, and each base key reads correctly for any count, because Nepali nouns stay
singular after numerals. `node scripts/i18n/v27/validate.mjs --only=ne` reports 727 strings valid and 0 problems.

## Unsure

- `fit.test.*`: the brief keeps test names in Latin, but the validator rejects strings without Devanagari, so I appended
  "परीक्षा" to each. Duolingo became "Duolingo English Test (अनलाइन परीक्षा)". A human should decide whether the UI
  needs the suffix.
- GKS: the bundle uses "Global Korea Scholarship (GKS)" but V27 strings use "कोरियाली सरकारी छात्रवृत्ति (GKS)". The
  bundle may need aligning.
- `marketing:v20.uni.why.breadthBody`: I dropped the Hangul "(대학알리미)" from the English because the validator
  forbids Hangul. The service is still named (Academy Info) and described.
- 'consulting' / 'excellent' / 'certified' (the IEQAS tier names) are rendered as 'परामर्श' / 'उत्कृष्ट' / 'प्रमाणित'.
  Only the first keeps the English word in addition.
- `fit.level.TRANSFER` (स्नातक ट्रान्सफर) and `fit.level.ASSOCIATE` (एसोसिएट डिग्री) are loan phrases. Nepal has no
  exact equivalent of 편입 or 전문학사.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → आवेदन दिन कुनै भाषा अङ्क चाहिँदैन। भर्ना भएपछि {{tests}} वा सोभन्दा माथि चाहिन्छ।
- `fit.reason.far` → {{options}} वा सोभन्दा माथि चाहिन्छ, जुन तपाईंको अहिलेको अङ्कभन्दा धेरै माथि छ।
- `fit.tier.UNCLEAR.title` → अहिलेलाई अझै धेरै टाढा
- `fit.tier.UNCLEAR.short` → थप तयारी
- `fit.tier.UNCLEAR.lede` → तपाईंको अहिलेको अङ्क प्रकाशित सर्तभन्दा धेरै कम छ। तयारीका लागि बढी समय राख्नुहोस्, अनि फेरि जाँच्नुहोस्।

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
