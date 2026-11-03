# V28 localization review — Hindi (hi)

Scope: all 354 keys of `scripts/i18n/v28/jobs/hi.json` → `scripts/i18n/v28/tx/hi.json`. Every key was read against the current English (`en`) and the Korean (`ko`); `current` was kept only where it is correct, natural and matches the V28 English.
Register: आप with -ें imperatives; everyday English loans Indian students use (ऑफ़र, ड्राफ़्ट, इनटेक, टास्क) kept, as in V27. Latin digits.

## Personas

| Persona | Who | What they need |
|---|---|---|
| Ananya, 18, Lucknow (first-time visitor) | Class 12 pass-out, Hindi-medium | Short friendly Hindi, no heavy शुद्ध हिंदी |
| Rohit, 26, Pune (comparison shopper) | B.Tech, master's with IELTS, comparing agencies and plans | Precise document/visa terms and clear plan scope |
| Ananya's mother, 48 | Pays fees, alert to agent scams | Unambiguous money and trust wording |

## Glossary

Reused from `docs/qa/v27/l10n/hi.md` (unchanged rows), plus V28 additions at the end.

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
| the Hangyul team (V28) | Hangyul टीम | replaces "आपका काउंसलर" in student UI |
| Needs more preparation (far tier) | और तैयारी की ज़रूरत | not a distance/chance word |
| intake | इनटेक | |
| dormitory | हॉस्टल | one term across pricing and scope |
| task (console) | टास्क | |

## Known defects fixed

- `visaroute:step.slow_items.why`: "पुष्टि (सत्यापन)" (confirmation) → "कांसुलर सत्यापन", the V27 glossary term for 영사확인. `caveat.APOSTILLE_TRANSITION` already used कांसुलर सत्यापन (kept; only the counselor changed). `university:documents.legalization` newly translated as "कांसुलर सत्यापन". Hindi has no forbidden-term rule in the validator.
- 22 student-facing strings changed "आपका काउंसलर" → "Hangyul टीम".

## Pass A — meaning (34 strings changed)

The V28 English changed meaning in many keys (tier titles and ledes, the 'Hangyul team' identity, scholarships empty state, dormitory scope). Every student-facing `current` that said *your counselor* was rewritten to the Hangyul team (brief: never "your counselor"); agency-console strings about agency staff were left alone. Legalization wording was corrected to the glossary term. The far tier now says *needs more preparation*, never a distance/probability word. 'No Korean test result' replaced 'does not know Korean' in the deposit-scheme rule.

| key | before | after |
|---|---|---|
| `visaroute:step.slow_items.why` | पुष्टि (सत्यापन), टीबी जाँच और पुलिस प्रमाणपत्र में हफ़्तों लगते हैं। | कांसुलर सत्यापन, टीबी जाँच और पुलिस प्रमाणपत्र में हफ़्तों लगते हैं। |
| `visaroute:caveat.APOSTILLE_TRANSITION` | वियतनाम ने 11 सितंबर 2026 से एपोस्टिल जारी करना शुरू किया, लेकिन दूतावास की स्टूडेंट वीज़ा सूचियों में अब भी कांसुलर सत्यापन लिखा है। कौन-सा मान्य है, आपके काउंसलर पुष्टि करेंगे। | वियतनाम ने 11 सितंबर 2026 से एपोस्टिल जारी करना शुरू किया, लेकिन दूतावास की स्टूडेंट वीज़ा सूचियों में अब भी कांसुलर सत्यापन लिखा है। कौन-सा मान्य है, इसकी पुष्टि Hangyul टीम करेगी। |
| `common:fit.tier.UNCLEAR.title` | अभी लंबा रास्ता बाकी | और तैयारी की ज़रूरत |
| `common:fit.tier.CHALLENGE.lede` | हमारी जानकारी में आपको रोकने वाली कोई बात नहीं है। इस स्तर की मौजूदा शर्तें हमने अभी सत्यापित नहीं की हैं, इसलिए हम आपके साथ उन्हें जाँचेंगे। | Hangyul ने इस स्तर के लिए इन विश्वविद्यालयों की शर्तें अभी सत्यापित नहीं की हैं। हम आपके साथ इन्हें जाँचेंगे। |
| `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME` | कुछ देशों के बिना कोरियाई भाषा वाले छात्रों को पढ़ाई का पैसा बैंक में जमा करना होगा, जो हर सेमेस्टर जारी किया जाएगा। | कुछ देशों के जिन छात्रों के पास कोरियाई टेस्ट का स्कोर नहीं है, वे पढ़ाई का पैसा बैंक में जमा करेंगे, जो हर सेमेस्टर जारी होगा। |

## Pass B — native naturalness (18 strings changed)

Read as each persona. Long marketing bodies were re-flowed into native word order; em-dash chains from the old bundle were split into sentences; machine-literal phrasing in pricing and city pages was replaced.

| key | before | after |
|---|---|---|
| `marketing:seo.home.description` | सही कोरियाई विश्वविद्यालय खोजें, अपने दस्तावेज़ तैयार करें, और वीज़ा से आगमन तक सब कुछ एक ही जगह पूरा करें, सत्यापित जानकारी और मदद के लिए असली लोगों के साथ। | सही कोरियाई विश्वविद्यालय खोजें, दस्तावेज़ तैयार करें, और वीज़ा से आगमन तक सब कुछ एक ही जगह संभालें। सत्यापित जानकारी और मदद के लिए असली लोग। |
| `marketing:v20.uni.ctaTitle` | क्या आप इस पर गंभीरता से विचार करने के लिए तैयार हैं? | यहाँ आवेदन करने की सोच रहे हैं? |
| `marketing:v6.unis.title` | ऐसे विश्वविद्यालय, जिनके लिए यह सफ़र सार्थक है। | पूरे कोरिया के विश्वविद्यालय। |
| `concierge:housing.honest` | हम डॉर्मिटरी की जानकारी सिर्फ़ स्रोत के साथ दिखाते हैं, और सिर्फ़ वही कमरे जो किसी प्रदाता ने सच में हमें दिए हैं — हर एक पर लेबल के साथ। हम कभी नकली लिस्टिंग नहीं बनाते। | हम हॉस्टल की सिर्फ़ वही जानकारी दिखाते हैं जिसका स्रोत है, और सिर्फ़ वही कमरे जो किसी प्रदाता ने सच में ऑफ़र किए हैं, हर एक पर लेबल के साथ। हम कभी नकली लिस्टिंग नहीं बनाते। |
| `agency:inbox.pickText` | या जिस भी छात्र की आप सहायता करते हैं, उसके साथ नई बातचीत शुरू करें। | या अपने केसलोड के किसी भी छात्र के साथ नई बातचीत शुरू करें। |

## Pass C — UI context, brevity, one term per concept (25 strings changed)

Labels and chips shortened; one term per concept enforced (dormitory = one word across pricing/scope; programs, not majors; proof of funds per glossary; legalization per glossary). Semicolon/dash fragments in console footnotes became two short sentences.

| key | before | after |
|---|---|---|
| `marketing:v15.pricing.compare.row.dormitory` | छात्रावास सहायता | हॉस्टल |
| `dossier:check.title` | हमें यह जानकारी मिली है। कृपया इसे जाँचें। | हमें जो मिला, उसे जाँचें |
| `university:kpi.insufficientDetail` | {{n}} रिकॉर्ड पर आधारित — {{min}} से दिखाया जाता है | {{n}} रिकॉर्ड पर आधारित। {{min}} होने पर दिखाया जाएगा। |
| `marketing:v24.uni.academicTitle` | विषय और कैंपस | प्रोग्राम और कैंपस |
| `agency:v8.view.docs` | दस्तावेज़ में सुधार ज़रूरी | दस्तावेज़ों में सुधार ज़रूरी |

## Final — source ↔ target comparison (9 strings changed)

Whole set compared with `en` and `ko` for meaning, numbers, test names, placeholders and the no-guarantee / no-ranking rule. Corrected: waitlist hint no longer says 'we still have to decide'; 'Needed for a decision' no longer reads as 'a decision is needed'; passport *issuance* record (not 'passport data'); 'apply and record the receipt'.

| key | before | after |
|---|---|---|
| `university:v22.stageHint.decision` | प्रतीक्षा सूची में — निर्णय अभी हमें लेना है | प्रतीक्षा सूची में। निर्णय अभी बाकी है |
| `university:v8.aq.need` | निर्णय की ज़रूरत | निर्णय के लिए ज़रूरी |
| `student:v26.now.owner.STUDENT` | आपको करना है | आप |
| `visaroute:step.apply.title` | आवेदन करें और उसे दर्ज करें | आवेदन करें और रसीद दर्ज करें |
| `common:task.visa.other_passport_record` | अपना पासपोर्ट रिकॉर्ड लें | अपना पासपोर्ट जारी होने का रिकॉर्ड लें |

## Marketing scorecard (39 `marketing:` keys; 30-point card: clarity, trust, naturalness, brevity, CTA strength, cultural fit, 5 each)

| section | first draft | final | C | T | N | B | CTA | Fit |
|---|---|---|---|---|---|---|---|---|
| seo.home | 22 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |
| pricing (lede, compare, premium) | 20 | 26 | 5 | 4 | 4 | 5 | 4 | 4 |
| city pages (Seoul line; bodies kept) | 24 | 26 | 4 | 5 | 4 | 4 | 4 | 5 |
| university page (why/cta/intl/GKS/English) | 19 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |
| unis title, journey eyebrow | 18 | 25 | 4 | 4 | 4 | 5 | 4 | 4 |
| FAQ languages | 23 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |

Each section below 25 on the first draft was transcreated (not translated) and re-scored until ≥ 25.

## Unsure

- 영사확인 = "कांसुलर सत्यापन" (glossary). सत्यापन is also used for plain verification; "कांसुलर वैधीकरण" is the literal legalization but rarely used by Indian applicants. Kept for consistency; a native reviewer should confirm.
- `marketing:v20.city.Seoul.line` uses "रिसर्च यूनिवर्सिटी" (loan) rather than शोध विश्वविद्यालय.
- `staff.post` "मिशन" for a diplomatic post.
- `university:documents.legalization` uses the two-word term although the en label is one word.
- `v28.pipe.label` keeps "Analytics" in Latin as the section name.

## Counts

| job keys | kept verbatim | rewritten | newly translated |
|---|---|---|---|
| 354 | 37 | 86 | 231 |

Kept verbatim = `current` non-null and output identical; rewritten = `current` non-null and output changed; newly translated = `current` null.

Validator: `node scripts/i18n/v28/validate.mjs --only=hi` → 354 strings valid, 0 problems.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/hi.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: none. The three passes found nothing to change; `upload.status.*` stay empty as in en.

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | बाकी दस्तावेज़ अपलोड करें और अपने निबंध पूरे करें। |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | किसी दूसरी यूनिवर्सिटी को लिखा निबंध रिजेक्शन की सबसे आम वजह है, जिसे आसानी से टाला जा सकता है। |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: कांसुलर सत्यापन बाकी |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | सिर्फ़ कन्फ़र्मेशन नंबर या रसीद से कन्फ़र्म होता है। इससे आवेदन "जमा" में चला जाता है। |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | ये फ़ाइलें सिर्फ़ आप और Hangyul टीम देख सकते हैं। कोई यूनिवर्सिटी किसी दस्तावेज़ को तभी देखती है जब वह उसी यूनिवर्सिटी के आपके आवेदन के लिए भेजा जाए। |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | यहाँ अंतरराष्ट्रीय छात्रों का अलग ऑफ़िस है, जिससे सीधे संपर्क किया जा सकता है। / Hangyul को अभी तक इस यूनिवर्सिटी की अपनी वेबसाइट पर अंतरराष्ट्रीय छात्रों के लिए अलग पेज नहीं मिला है। शुरुआत नीचे दी गई आधिकारिक वेबसाइट से करें। | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko.
- `student:workspace.owner.done.team` *…हम अब भी यहीं हैं* is first person, though the row label is the team. It reads naturally but differs from the other team rows.
- `success:queue.term.*` seasons transliterated (स्प्रिंग/समर/फ़ॉल/विंटर), as Indian applicants see them on Korean sites; बसंत/शरद would be purer Hindi.
- `success:agency.colFit` *मैच* reuses the glossary term for match.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=hi` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
