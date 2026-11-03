# V29 l10n record — ne (Nepali)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/ne.json` → `scripts/i18n/v28/tx-v29/ne.json`). Korean is canonical, English second reference. Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=ne` → 0 problems.

## Personas

- काठमाडौंका +2 सकेका 18 वर्षे विद्यार्थी जो पहिलो पटक कोरियामा पढ्ने सोच्दैछन्
- तीन योजना तुलना गर्दै लुकेका खर्च खोज्ने अभिभावक
- कति चरण सम्पादन पाइन्छ भनेर ठ्याक्कै जान्न चाहने मास्टर्स आवेदक (26)

## Key term decisions

- **No round limit within the contracted documents**: "सम्झौताका कागजातभित्र चरणको सीमा छैन"; नोट: "सम्झौतामा तोकिएका आवेदन कागजात र तालिकाभित्र सम्पादनको चरणको सीमा हुँदैन"। "असीमित" प्रयोग गरिएको छैन।
- **Up to N managed applications**: "बढीमा N विश्वविद्यालय आवेदनको व्यवस्थापन" (पङ्क्ति: "व्यवस्थापन गरिने आवेदन") — "सिफारिस गरिएका विश्वविद्यालय" भन्दा छुट्टै।
- **Custom quote**: "छुट्टै मूल्य प्रस्ताव"।
- **Airport pickup arrangement**: "एयरपोर्ट पिकअपको व्यवस्था मिलाउने"; नोट: "साझेदार यातायात कम्पनीमार्फत मिलाइन्छ"।
- **Digits**: अङ्क ल्याटिनमा (placeholder मानसँग मिलाउन)।
- **Register**: तपाईं-सम्मानार्थी; योजना नाम Basic / All-in-One / Premium अनुवाद गरिएको छैन; "अपग्रेड" बन्डलअनुसार।

## Glossary

| Concept | EN | ne |
|---|---|---|
| Plan names | Everything in Basic · up to 5 recommendations | Basic का सबै सेवा · बढीमा 5 सिफारिस |
| No round limit within contracted documents | No round limit within your contracted documents | सम्झौताका कागजातभित्र चरणको सीमा छैन |
| Premium editing scope note | Premium editing has no round limit within your contracted application documents and schedule. | Premium मा सम्झौतामा तोकिएका आवेदन कागजात र तालिकाभित्र सम्पादनको चरणको सीमा हुँदैन। |
| Up to N managed applications | Up to 2 university applications managed | बढीमा 2 विश्वविद्यालय आवेदनको व्यवस्थापन |
| Applications managed (row) | Applications managed | व्यवस्थापन गरिने आवेदन |
| Universities recommended (row) | Universities recommended | सिफारिस गरिएका विश्वविद्यालय |
| Custom quote | Custom quote | छुट्टै मूल्य प्रस्ताव |
| Airport pickup arrangement | Airport pickup arrangement | एयरपोर्ट पिकअपको व्यवस्था मिलाउने |
| Pickup note | Airport pickup is arranged through a partner transport provider. | एयरपोर्ट पिकअप साझेदार यातायात कम्पनीमार्फत मिलाइन्छ। |
| Diagnostic consultation | Schedule the diagnostic consultation | अध्ययन मूल्याङ्कन परामर्शको समय तय गर्नुहोस् |
| Follow-up consultation | {{count}} follow-up consultation | {{count}} थप परामर्श |
| Statement & study-plan editing | Statement & study-plan editing | व्यक्तिगत विवरण र अध्ययन योजना सम्पादन |
| Editing round | 1 round | 1 चरण |
| Mock interview | Mock interview | अभ्यास अन्तर्वार्ता |
| Dormitory | Dormitory | छात्रावास |
| Settling in | Arrival & settling in | आगमन र बसोबास |
| Additional service (add-on) | Additional services | थप सेवाहरू |
| Agreed scope | Agreed scope | सहमति भएको दायरा |
| Dedicated team · priority | Dedicated team · priority | समर्पित टोली · प्राथमिकता |
| Priority response | Priority response | प्राथमिकतामा जवाफ |
| Contract term | Contract term | सम्झौता अवधि |
| Service period | Service period | सेवा अवधि |
| Visa decision disclaimer | Visa support means help preparing and applying; the decision is the authority's. | भिसा सहयोग भनेको तयारी र आवेदनमा मद्दत हो; भिसा दिने निर्णय सम्बन्धित निकायले गर्छ। |
| Upgrade | Ask the team about upgrading | अपग्रेडबारे टोलीलाई सोध्नुहोस् |
| Not included / Included | Not included | समावेश छैन |
| Notarization | Writing a new document, translation and notarization may cost extra. | नयाँ कागजात लेखन, अनुवाद र नोटरी प्रमाणीकरणमा थप शुल्क लाग्न सक्छ। |

## Review passes

### Pass A — meaning vs Korean — 3 strings changed

- "असीमित सम्पादन" → "चरणको सीमा बिना" + "सम्झौतामा तोकिएका"
- "2 विश्वविद्यालयमा आवेदन" → "बढीमा 2 विश्वविद्यालय आवेदनको व्यवस्थापन"
- "एयरपोर्ट पिकअप" → "एयरपोर्ट पिकअपको व्यवस्था मिलाउने"
- "भिसा हामी दिलाउँछौं" → "भिसा दिने निर्णय सम्बन्धित निकायले गर्छ"
- "विशेष मूल्य" → "छुट्टै मूल्य प्रस्ताव"

### Pass B — native naturalness — 3 strings changed

- "धन्यवाद छैन" → "धन्यवाद, अहिले होइन" (बन्डलअनुसार)
- "निष्पक्ष मूल्य" → "उचित मूल्य"
- "असफल भयो" → "प्रक्रिया पूरा भएन"
- "स्थापना सहयोग" → "बसोबास मिलाउने सहयोग"
- "नोटरीकरण" → "नोटरी प्रमाणीकरण"

### Pass C — UI brevity / one term per concept — 2 strings changed

- "व्यक्तिगत विवरण र अध्ययन योजनाको सम्पादन सेवा" → पङ्क्ति: "व्यक्तिगत विवरण र अध्ययन योजना सम्पादन"
- "अतिरिक्त सेवा" / "थप सेवा" → "थप सेवा" सबैतिर
- "सेवा सुरु गर्दा सँगै तय गरिन्छ" → मोबाइल: "सुरु गर्दा सँगै तय गरिन्छ"
- "जिम्मेवार टोलीबाट थप सहयोग" → मोबाइल: "टोलीबाट सहयोग"
- "अन्तर्वार्ता अभ्यास" → "अभ्यास अन्तर्वार्ता" (बन्डलअनुसार)

## Final source↔target comparison

Every key re-read against Korean: no "unlimited" rendering, managed applications never phrased as a guarantee or as "apply to any N", recommended vs managed kept as two different nouns, visa decision attributed to the authority, airport pickup phrased as arranged through a partner, no currency amount translated; all {{placeholders}} and <br> kept.

## Marketing scorecard (marketing:v29.why.*)

| Section | Clarity | Trust | Naturalness | Brevity | CTA | Cultural fit | Total |
|---|---|---|---|---|---|---|---|
| v29.why.s1 (title + text) | 5 | 4 | 5 | 4 | 4 | 4 | 26/30 |
| v29.why.s3 (title + text) | 5 | 5 | 4 | 4 | 4 | 4 | 26/30 |

## Unsure

- "1 पटक व्यवस्था" एकाइ।
- "अध्ययन मूल्याङ्कन परामर्श" — 진단 상담 का लागि "निदान" भन्दा स्वाभाविक ठानिएको।
- {{count}} दिन वाक्यहरू नेपालीमा एकवचन/बहुवचन उस्तै भएकाले तटस्थ छन्।

## Counts

- Job keys: 158 (all had `current: null`)
- Kept verbatim: 0
- Rewritten: 0
- Newly translated: 158
- Extra CLDR plural forms added: 0

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
