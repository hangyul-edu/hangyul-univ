# V27 l10n review — Hindi (hi)

Scope: all 727 current strings (729 when I started; two `_one` keys in common were removed upstream during the run) of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/hi.json`.
Register: आप with "-ें" imperatives (सहेजें, अपलोड करें), the register Indian ed-tech and study-abroad sites use. The
everyday English loans that Indian students actually use (ऑफ़र, ड्राफ़्ट, अपलोड, एक्सपायर, रिन्यू, स्कोर) are kept
where a Sanskritised word would sound like a government form. Digits are Latin, as in the bundle.

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Ananya, 18, Lucknow | Class 12 pass-out, Hindi-medium, wants a bachelor's after a Korean language institute | Short, friendly Hindi with no heavy शुद्ध हिंदी |
| Rohit, 26, Pune | B.Tech, master's applicant with IELTS | Precise document and visa terms (एपोस्टिल, कांसुलर सत्यापन, CCVI) |
| Ananya's mother, 48, Lucknow | Paying the fees, worried about agents and money | Unambiguous payment, refund and fraud wording |

## Glossary

| English | Hindi | Note |
|---|---|---|
| scholarship | छात्रवृत्ति | bundle term |
| Global Korea Scholarship (GKS) | कोरियाई सरकार छात्रवृत्ति (GKS) | the name used by Indian applicants and media |
| admission guide (모집요강) | प्रवेश गाइड | |
| apostille | एपोस्टिल | bundle term |
| consular legalization (영사확인) | कांसुलर सत्यापन | bundle term |
| Korean language institute | कोरियाई भाषा संस्थान | |
| counselor | काउंसलर | bundle term |
| the Hangyul team | Hangyul टीम | bundle term |
| tuition | ट्यूशन फ़ीस | bundle term |
| deadline | समय-सीमा | bundle term |
| admission letter / certificate of admission | प्रवेश पत्र (Certificate of Admission) | bundle term |
| residence card | रेज़िडेंस कार्ड | bundle term |
| housing / dormitory | आवास / हॉस्टल | आवास for the section, हॉस्टल for the dorm itself |
| embassy / consulate | दूतावास / वाणिज्य दूतावास | |
| immigration office | इमिग्रेशन ऑफ़िस | |
| CCVI | वीज़ा जारी करने की पुष्टि का प्रमाणपत्र (CCVI) | |
| proof of funds | फ़ंड का प्रमाण | |
| match | मैच | bundle term |
| Recommended (sort) | सुझाया गया क्रम | not रैंकिंग |
| save | सहेजें | bundle term |
| transcript | मार्कशीट | what Indian students call it |
| personal statement | पर्सनल स्टेटमेंट | |

## Pass A: meaning (4 strings changed)

| Key | Before | After |
|---|---|---|
| common:uni27.schol.youMay | आप इन शर्तों को पूरा कर सकते हैं | वे छात्रवृत्तियाँ जिनकी शर्तें आप पूरी कर सकते हैं (it is the heading of a scholarship list) |
| student:compare.legalCount_one | {{count}} के लिए एपोस्टिल या सत्यापन ज़रूरी | {{count}} दस्तावेज़ को एपोस्टिल या सत्यापन चाहिए (the noun being counted was missing) |
| student:compare.legalCount_other | {{count}} के लिए एपोस्टिल या सत्यापन ज़रूरी | {{count}} दस्तावेज़ों को एपोस्टिल या सत्यापन चाहिए |
| marketing:flow.university.text | पूरा और सत्यापित आवेदन पाता है, … | विश्वविद्यालय: पूरा और सत्यापित आवेदन पाता है, … (the subject was lost, because the English relies on a card heading) |

I tried a fifth change, to `v9.announced.rule.TOPIK4_FINANCIAL_EXEMPTION`, which added "when this rule takes effect". I
reverted it because it added meaning. The future tense (ज़रूरत नहीं होगी) already carries "announced, not yet in force".

## Pass B: native naturalness (14 strings changed)

| Key | Before | After |
|---|---|---|
| student:login.aside.title | …एक ही जगह, बिना घबराहट के। | …एक ही जगह, सुकून से। |
| student:visa.checklist.subtitle | धूसर चरण… | ग्रे दिख रहे चरण… (nobody says धूसर in UI copy) |
| student:matches.method.stage2 | …नामित, भारित कारकों के आधार पर… | …तय नाम और वज़न वाले कारकों से… (translated jargon) |
| dossier:home.checkDetails_more | {{fields}} और {{more}} और विवरण… | {{fields}} और {{more}} अन्य विवरण… (the repeated "और" read badly) |
| common:uni27.house.title | विश्वविद्यालय हॉस्टल | विश्वविद्यालय आवास (the section covers housing in general) |

## Pass C: UI context, brevity, consistency (6 strings changed)

| Key | Before | After |
|---|---|---|
| dossier:home.checkDetails | …{{fields}} कन्फ़र्म करें | …{{fields}} की पुष्टि करें (one verb for "confirm" everywhere) |
| marketing:v10.check.lede | …हम कुछ भी सेव नहीं करते। | …हम कुछ भी सहेजते नहीं। (matches the bundle's सहेजें) |
| common:task.concierge.reconfirm | पिकअप दोबारा कन्फ़र्म करें | पिकअप की दोबारा पुष्टि करें |
| common:uni27.schol.dorm | आवास सहायता | हॉस्टल सहायता (the benefit is a dorm benefit, 기숙사 지원) |
| student:budget.monthlyHint.DORM | …किराया हॉस्टल वाली पंक्ति में है | …किराया आवास (हॉस्टल) वाली पंक्ति में है (now matches the line label) |

## Final comparison

I compared all 729 original pairs against the English and the Korean and found no further meaning changes. Placeholders, `<em>`
tags, the email address and URLs are intact. Nothing promises admission. The guarantee and "chance" sentences all deny
them (गारंटी कभी नहीं, संभावना कभी गढ़ते नहीं). 영사확인 is कांसुलर सत्यापन throughout. The `_one`/`_other` pairs agree
in number (करता/करते, महीना/महीने). `node scripts/i18n/v27/validate.mjs --only=hi` reports 727 strings valid and 0
problems.

## Unsure

- `fit.test.*`: as in ne, the Latin test names carry the suffix "परीक्षा" to satisfy the Devanagari check, and Duolingo
  reads "Duolingo English Test (ऑनलाइन परीक्षा)". Without the suffix they would look cleaner in a dropdown.
- GKS: "कोरियाई सरकार छात्रवृत्ति (GKS)" differs from the bundle's "Global Korea Scholarship (GKS)".
- The Hinglish loans (परफ़ेक्ट, ड्राफ़्ट, एक्सपायर, रिन्यू) are deliberate for an 18–30 audience. A reviewer who prefers
  formal Hindi might want पूर्ण, मसौदा, समाप्त, नवीनीकरण.
- Korean place-name transliterations (छनान, थोंगयॉन्ग, ह्युकसॉक) follow Korean pronunciation. Indian media spell them
  inconsistently.
- `v20.uni.why.breadthBody` drops the Hangul "(대학알리미)" (the validator forbids Hangul).

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → आवेदन के लिए कोई भाषा स्कोर ज़रूरी नहीं। प्रवेश के बाद आपको {{tests}} या उससे अधिक चाहिए होगा।
- `fit.reason.far` → {{options}} या उससे अधिक ज़रूरी है, जो आपके मौजूदा स्कोर से काफ़ी ऊपर है।
- `fit.tier.UNCLEAR.title` → अभी लंबा रास्ता बाकी
- `fit.tier.UNCLEAR.short` → और तैयारी
- `fit.tier.UNCLEAR.lede` → आपका मौजूदा स्कोर प्रकाशित शर्त से काफ़ी कम है। तैयारी के लिए ज़्यादा समय रखें, फिर दोबारा जाँचें।

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
