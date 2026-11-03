# V28 l10n review: Nepali (ne)

Scope: all 354 keys of `scripts/i18n/v28/jobs/ne.json` → `scripts/i18n/v28/tx/ne.json`.
Register: polite तपाईं with "-नुहोस्" imperatives for students (as in V27); consoles (agency, university) use short
noun labels and neutral verbs. The student-facing team is always "Hangyul टोली" with plain third-person singular verbs
(Hangyul टोलीले … गर्छ). Digits are Latin throughout (V27 strings with Devanagari digits were aligned).

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Sushmita, 18, Pokhara (first-time visitor) | +2 science graduate, opens the marketing site for the first time, plans a language institute year then a bachelor's | Plain words, no jargon, a clear next step, nothing that sounds like a guarantee |
| Bikash, 27, Kathmandu (comparison shopper) | Civil engineer comparing Hangyul with local consultancies for a master's | Exact plan scope, prices, document terms (apostille, consular legalization), who does what |
| Anita, 34, agency counselor in Kathmandu / Korean university admissions staff | Uses the agency and university consoles daily | Short, consistent labels; one term per concept (भर्ना सत्र, अन्तिम मिति, प्रस्ताव) |

## Glossary

| English | Nepali | Note |
|---|---|---|
| the Hangyul team | Hangyul टोली | replaces every "तपाईंको परामर्शदाता" in student copy |
| counseling / consultation | परामर्श | |
| scholarship | छात्रवृत्ति | |
| Global Korea Scholarship (GKS) | कोरियाली सरकारी छात्रवृत्ति (GKS) | V27 term |
| admission guide | भर्ना निर्देशिका | |
| apostille | एपोस्टिल | |
| consular legalization | कन्सुलर प्रमाणीकरण | never "पुष्टि" |
| legalization (doc column) | प्रमाणीकरण | |
| deadline | अन्तिम मिति | |
| intake | भर्ना सत्र | |
| offer | प्रस्ताव | V27 bundle term |
| enrollment | भर्ना | |
| application | आवेदन | |
| submit / submitted | पेस गर्नुहोस् / पेस गरियो | |
| match | म्याच | V27 bundle term |
| requirements / minimums | सर्त / न्यूनतम सर्त | |
| Needs more preparation (far tier) | थप तयारी चाहिन्छ | no probability word |
| residence card | विदेशी दर्ता कार्ड (ARC) | |
| proof of funds | आर्थिक प्रमाण | |
| dormitory | छात्रावास | |
| consulate | वाणिज्य दूतावास | |
| diplomatic post | कूटनीतिक नियोग | staff visa panel |
| e-visa | ई-भिसा | one spelling (V27 had इ-/ई-) |
| task / owner | काम / जिम्मेवार | consoles |
| plan | प्लान | |
| TOPIK level | TOPIK लेभल | |
| international office | अन्तर्राष्ट्रिय कार्यालय | |

## Pass A: meaning (30 existing strings changed; 230 new strings drafted)

| Key | Before | After |
|---|---|---|
| common:fit.tier.UNCLEAR.title | अहिलेलाई अझै धेरै टाढा | थप तयारी चाहिन्छ (source now "Needs more preparation") |
| common:fit.tier.CHALLENGE.title | ध्यान दिएर हेर्न लायक | हामीसँग जाँच्नुपर्ने (source now "Needs checking with us") |
| university:v22.stageHint.decision | प्रतीक्षा सूचीमा — निर्णय अझै हाम्रै हातमा छ | प्रतीक्षा सूचीमा। निर्णय अझै बाँकी छ ("in our hands" was wrong) |
| student:v9.announced.rule.STUDY_DEPOSIT_SCHEME | …कोरियाली भाषा नजान्ने विद्यार्थीले… | …कोरियाली भाषा परीक्षाको नतिजा नभएका…विद्यार्थीले… (no test result ≠ cannot speak Korean) |
| marketing:v6.unis.title | यात्रा गर्न लायक विश्वविद्यालयहरू। | कोरियाभरिका विश्वविद्यालय। (source rewritten) |

## Pass B: native naturalness (14 strings changed)

| Key | Before | After |
|---|---|---|
| agency:inbox.pickText | …विद्यार्थीसँग नयाँ सुरु गर्नुहोस्। | …विद्यार्थीसँग नयाँ कुराकानी सुरु गर्नुहोस्। (noun was missing) |
| agency:v8.ops.ageing.title | चरणअनुसार केसको उमेर | चरणअनुसार केस अड्किएको अवधि ("उमेर" was a calque of "aging") |
| marketing:v20.uni.why.foundedBody | जसले यसलाई यो दर्ताका लामो समयदेखि स्थापित संस्थामध्ये एक बनाउँछ। | त्यसैले यो दर्तामा रहेका पुराना संस्थामध्ये एक हो। (English relative-clause order) |
| university:v22.in.q.admit | कसले भर्ना पाउँछ र भर्ना हुन्छ? | कसले प्रस्ताव पाउँछ र भर्ना हुन्छ? (repeated verb) |
| visaroute:step.slow_items.title | समय लाग्ने कागजात सुरु गर्नुहोस् | सबैभन्दा ढिलो आउने कागजात पहिले सुरु गर्नुहोस् |

## Pass C: UI context, brevity, one term per concept (32 strings changed)

| Key | Before | After |
|---|---|---|
| concierge:help.route.HOUSING (and 21 others) | तपाईंको परामर्शदाता | Hangyul टोली (brief: never "your counselor") |
| student:v16.pay.chooseSubtitle | हाङ्ग्युलले तपाईंसँग कति काम गरोस्… | Hangyul बाट कति सहयोग चाहनुहुन्छ… (brand in Latin) |
| student:discover.why / success:group.possible | यो निष्कर्ष किन? / सम्भावित मेल | यो म्याच किन? / सम्भावित म्याच (bundle term) |
| visaroute:money.title | रकमको प्रमाण | आर्थिक प्रमाण (glossary) |
| university:kpi.insufficientDetail | {{n}} रेकर्डमा आधारित — {{min}} देखि देखाइन्छ | {{n}} रेकर्डमा आधारित। {{min}} पुगेपछि देखाइन्छ। (no dash; clearer) |

## Final source↔target comparison

All 354 pairs re-read against English and Korean. Placeholders and tags identical (validator). "Recommended"/order not
present in this job; nothing implies admission probability (fit.summary.basis says explicitly it is not a prediction).
영사확인 = कन्सुलर प्रमाणीकरण. `_one` keys read correctly for 1 and `_other` for any count (Nepali nouns stay singular after
numerals). No em-dash chains remain. Brand "Hangyul" in Latin everywhere.

## Marketing scorecard (sections touched; clarity / trust / naturalness / brevity / CTA / cultural fit)

| Section | Score /30 | Note |
|---|---|---|
| seo.home + journey | 26 (5/5/4/4/4/4) | rewritten from a comma chain into two sentences |
| v15.pricing (lede, compare, f5) | 26 (5/5/4/5/4/3) | lede now leads with the reader's choice |
| v20.city (Seoul, Busan, Gyeonggi, Gyeongnam) | 26 (5/4/5/4/3/5) | Seoul spelling unified (सियोल) |
| v20.uni.* + v28.uni.why.* + v24/v12 | 26 (5/5/4/5/3/4) | "What makes it different" titles transcreated, GKS uses the local name |
| v20.uni.cta (ctaTitle, ctaBody) | 26 (4/5/4/5/5/3) | question form common on Nepali education sites |
| v6.unis.title, v23.footer, v9.faq.languagesA | 25 (5/5/4/3/3/5) | FAQ honest about machine translation |

## Unsure

- `university:eduLevel.HIGH_SCHOOL` → उच्च माध्यमिक (Nepal's +2); may read as grade 11–12 only, which is the intended level.
- `visaroute:staff.post` → कूटनीतिक नियोग: correct but formal; staff might prefer "दूतावास/वाणिज्य दूतावास".
- `agency:misc.breadcrumb` → पृष्ठ मार्ग (screen-reader label); no established Nepali UI term.
- `university:v28.pipe.label` keeps "एनालिटिक्स" as loanword for the Analytics tab; check against the tab's own label.
- `marketing:v20.city.Gyeonggi.body` kept verbatim with Nepali city spellings (सुवन, सङनाम, बुचन) that a native may spell differently.

## Counts

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 354 | 48 | 76 | 230 |

`node scripts/i18n/v28/validate.mjs --only=ne` → 354 strings valid, 0 problems.

## Second pass (jobs2)

Scope: all 456 keys of `scripts/i18n/v28/jobs2/ne.json` (marketing 2, success 192, dossier 13, agency 215, university 34)
→ `scripts/i18n/v28/tx2/ne.json`. Leak families: conditional states (waiting lines, blockers, ledes, submission and
portfolio panels, student workspace in the agency console, university cohort/funnel empties). Same personas, register and
glossary as above (Hangyul टोली, कन्सुलर प्रमाणीकरण, एपोस्टिल, अन्तिम मिति, भर्ना सत्र, प्रस्ताव, भर्ना निर्देशिका,
म्याच, जिम्मेवार). Console-only "Counselor" labels (`success:agency.ownerShort.counselor`, `agency:…counselor`) stay
परामर्शदाता because agency staff read them; no student-facing string uses it.

Passes: A meaning 456 drafted from en+ko (all `current` were null) · B naturalness 21 changed (e.g. "-ed" calques to
Nepali verbal nouns) · C brevity/one term 14 changed (status chips to ≤ 3 words; "deadline" always अन्तिम मिति) ·
Final source↔target 6 changed (placeholders, plural `_one/_other` pairs).

| Key | Before (English shown on ne page) | After |
|---|---|---|
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending | {{label}}: कन्सुलर प्रमाणीकरण बाँकी |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. | अर्को विश्वविद्यालयलाई सम्बोधन गरिएको निबन्ध सबैभन्दा सामान्य, तर सजिलै रोक्न सकिने अस्वीकृतिको कारण हो। |
| `agency:v15.readiness.blocker.document_legalization` | {{detail}} needs an apostille or consular legalization | {{detail}} मा एपोस्टिल वा कन्सुलर प्रमाणीकरण चाहिन्छ |
| `agency:v27.guide.missingBody` | The current official guide … hasn't been verified, so no document list is shown. … | यो विश्वविद्यालय र तहको हालको आधिकारिक निर्देशिका प्रमाणित भएको छैन, त्यसैले कागजात सूची देखाइएको छैन। … |
| `university:outcomes.note` | Admission columns count Hangyul applications that received an offer; … | भर्ना स्तम्भले प्रस्ताव पाएका Hangyul आवेदन गन्छन्; … |

Marketing scorecard (second pass)

| Key | Clarity | Trust | Natural | Brevity | CTA | Fit | Total |
|---|---|---|---|---|---|---|---|
| `v20.uni.intl.officeLine` | 5 | 5 | 4 | 5 | 3 | 4 | 26 |
| `v20.uni.intl.none` (draft 1 "…ठाउँ हो" literal, 23 → rewritten to "…बाट सुरु गर्नुहोस्") | 5 | 5 | 4 | 4 | 4 | 4 | 26 |

Unsure (second pass)

- `dossier:upload.status.NEEDS_REVIEW` / `UPLOADED` / `NEEDS_CORRECTION`: English source is empty (status word is
  intentionally omitted in `upload.haveTitle`); the validator rejects empty strings, so short adjectives were given
  (समीक्षामा / अपलोड गरिएको / त्रुटिपूर्ण). They will now appear inside the sentence where English shows nothing.
- `success:agency.questions.too_few` ("Too few programs?"): the validator reads the `_few` suffix as a CLDR plural form and
  reports "plural form without agency.questions.too_other"; this is a validator false positive, the key is a normal job key.
- `agency:ws.level.ASSOCIATE` एसोसिएट (Associate degree): no Nepali equivalent; loanword.
- `university:outcomes.step.RETAINED` / `outcomes.retention` निरन्तर / निरन्तरता for retention: understandable, but staff may prefer "टिकाउ दर".
- Season names (वसन्त / ग्रीष्म / शरद् / हिउँद): शरद् for Fall is literary; "शरद" without halant is also common.

| Job keys | Kept verbatim | Rewritten | Newly translated |
|---|---|---|---|
| 456 | 0 | 0 | 456 |

`JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=ne` → 456 strings valid, 1 problem (the `too_few` false positive above).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
