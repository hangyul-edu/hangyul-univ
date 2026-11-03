# V29 l10n record — hi (Hindi)

Job: `scripts/i18n/v28/jobs-v29/hi.json` (158 keys, 0 with an existing translation) → `scripts/i18n/v28/tx-v29/hi.json`.
Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=hi` → 158 valid, 0 problems. Not applied.

## Personas
| Persona | Who | Reads for |
|---|---|---|
| Ananya, 18, Lucknow (first-time visitor) | Class 12, Hindi-medium | short friendly Hindi, everyday English loanwords (यूनिवर्सिटी, हॉस्टल, फ़ॉलो-अप) |
| Rohit, 26, Pune (comparison shopper) | comparing agency plans for a master's | exact plan scope, what "no limit" really covers, what costs extra |
| Ananya's mother, 48 (payer) | alert to agent scams | no visa/admission promise, clear one-time USD payment |

## Glossary (V29 additions, consistent with the V28 hi glossary)
| English | Hindi | Note |
|---|---|---|
| Basic / All-in-One / Premium | Basic / All-in-One / Premium | Latin, as in v29.pricing.*.name |
| the Hangyul Univ team | Hangyul Univ टीम | V28 team term |
| your team | आपकी टीम | |
| consultation | परामर्श | |
| diagnostic consultation | डायग्नोस्टिक परामर्श | |
| follow-up | फ़ॉलो-अप | |
| recommended universities | सुझाई गई यूनिवर्सिटी / सुझाव | research & suggest |
| managed application | आवेदन का प्रबंधन / प्रबंधित आवेदन | Hangyul handles it; distinct from सुझाव |
| up to N | अधिकतम N | never "गारंटी" |
| editing (첨삭) | संपादन | |
| round | राउंड | |
| no round limit within contracted documents | अनुबंध वाले दस्तावेज़ों में राउंड की कोई सीमा नहीं | never "असीमित" |
| statement / study plan | (पर्सनल) स्टेटमेंट / स्टडी प्लान | |
| mock interview | मॉक इंटरव्यू | |
| dormitory | हॉस्टल | V28 term |
| alternative accommodation | वैकल्पिक आवास | |
| airport pickup arrangement | एयरपोर्ट पिकअप की व्यवस्था | "arranged through partner", Hangyul does not drive |
| custom quote | अलग कोटेशन | |
| additional service / add-on | अतिरिक्त सेवा | |
| settling in | सेटल होना | natural spoken Hindi |
| contract / contract term | अनुबंध / अनुबंध अवधि | |
| service period | सेवा अवधि | |
| priority response | प्राथमिकता से जवाब | |
| dedicated team | समर्पित टीम | |
| authority (visa) | संबंधित प्राधिकरण | decides issuance |
| tuition | ट्यूशन फ़ीस | V28 term |

## Pass A — meaning vs Korean (6 changed)
- premium.f3: draft "असीमित संपादन" → "अनुबंध में तय आवेदन दस्तावेज़ों का संपादन, राउंड की कोई सीमा नहीं" (scope first, never "unlimited").
- all_in_one.f2: "2 यूनिवर्सिटी में आवेदन" → "अधिकतम 2 यूनिवर्सिटी आवेदनों का प्रबंधन" (management, not a promise to apply/admit).
- addon.item.airport_pickup: "एयरपोर्ट पिकअप" → "एयरपोर्ट पिकअप की व्यवस्था" (연결 = arrangement).
- notes.visaDecision: added "वीज़ा देने का फ़ैसला संबंधित प्राधिकरण का होता है" (explicit decision owner).
- task.dormSchedule: "हॉस्टल आवेदन ट्रैक करें" → "हॉस्टल आवेदन की तारीखें देखें और बताएँ" (확인·안내).
- compare.row.recommended kept separate from compare.row.managed (सुझाई गई vs प्रबंधित).

## Pass B — native naturalness (5 changed)
- addOn.decline: "नहीं धन्यवाद" → "नहीं, धन्यवाद".
- addOn.noPressure: "ना कहने से कुछ नहीं बदलता —" → "मना करने से कुछ नहीं बदलता, आपका प्लान पहले की तरह चलता रहेगा।" (no dash).
- why.s1.title: "आपको जितनी मदद चाहिए" → "जितनी ज़रूरत, उतना साथ" (marketing cadence).
- task.settlement: "प्रारंभिक बसावट सहायता" → "शुरुआती सेटल होने में सहायता" (no heavy शुद्ध हिंदी).
- notes.exchange: "प्रभारित राशि" → "आपके कार्ड से कटने वाली राशि".

## Pass C — UI brevity, one term per concept (4 changed)
- compare.value.none/yes: "शामिल नहीं है" → "शामिल नहीं" / "शामिल".
- mobile termToAgree: "सेवा शुरू होने पर तय होगी" → "शुरू होने पर तय होगी".
- "छात्रावास" unified to "हॉस्टल" everywhere (V28 term).
- "कोटेशन/उद्धरण" unified to "अलग कोटेशन".

## Marketing scorecard (clarity, trust, naturalness, brevity, CTA, cultural fit)
| Section | Score |
|---|---|
| v29.why.s1 | 5+5+4+4+4+5 = 27 |
| v29.why.s3 | 5+5+4+4+4+5 = 27 |

## Unsure
- "सेटल होना" (Hinglish) vs "बसना"; chose the Hinglish form students actually use.
- "स्टडी डायग्नोस्टिक परामर्श" may read as jargon; acceptable for a task label.

## Counts
Job keys 158 · kept verbatim 0 · rewritten 0 · newly translated 158 · extra plural forms 0 (hi CLDR one/other).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
