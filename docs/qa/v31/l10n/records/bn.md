# V31 locale review — Bangla (bn)

Job `scripts/i18n/v28/jobs-v31/bn.json` → `scripts/i18n/v28/tx-v31/bn.json`; glossary `docs/qa/v31/l10n/glossary/bn.json`.
Register: আপনি, standard Bangla as Dhaka study-abroad consultancies write it, with the loanwords Bangladeshi students
actually use (কাউন্সেলিং, পার্সোনাল স্টেটমেন্ট, স্টাডি প্ল্যান, এডিটিং, মক ইন্টারভিউ, ডরমিটরি, এয়ারপোর্ট পিকআপ,
অ্যাপোস্টিল, কনস্যুলার লিগ্যালাইজেশন, ট্রান্সক্রিপ্ট, প্ল্যান, ফল/স্প্রিং). Brand always Latin "Hangyul" / "Hangyul Univ";
student-facing team = "Hangyul টিম" ("Hangyul Univ টিম" only where the source says "Hangyul Univ team"). Plan names Latin.
Bangladeshi education terms: high school = উচ্চ মাধ্যমিক (never মাধ্যমিক, which is SSC), humanities = মানবিক, large numbers in লাখ.

## Counts

| | keys |
|---|---|
| Reviewed (three passes + back-check) | 1,729 (common 310, concierge 181, dossier 66, marketing 384, student 590, success 33, visaroute 164, writing 1) |
| Kept verbatim | 1,434 (incl. 54 `v31` keys whose existing Bangla already said exactly what the new source says) |
| Rewritten | 295 |
| — new source (`v31`, re-translated) | 160 |
| — terminology (glossary consistency) | 69 |
| — meaning | 41 |
| — naturalness | 22 |
| — product quality / UI role | 3 |

Terminology sweep: পরামর্শ (service) → কাউন্সেলিং; ব্যক্তিগত বিবৃতি → পার্সোনাল স্টেটমেন্ট; অধ্যয়ন পরিকল্পনা / পাঠপরিকল্পনা →
স্টাডি প্ল্যান; সম্পাদনা / পর্যালোচনা (essay editing) → এডিটিং; প্যাকেজ (product) → প্ল্যান; হোস্টেল / ছাত্রাবাস → ডরমিটরি;
বিমানবন্দর পিকআপ → এয়ারপোর্ট পিকআপ; সত্যায়ন → কনস্যুলার লিগ্যালাইজেশন; স্থায়ী হওয়া (permanent settling) → থিতু হওয়া;
সময়সীমা (deadline) → শেষ তারিখ (সময়সীমা is reserved for the support window); শরৎ/বসন্ত → ফল/স্প্রিং; কিয়ংগি/কিয়ংসাং →
গিয়ংগি/গিয়ংসাং (one spelling); ইমেল → ইমেইল; "Hangyul Univ টিম" → "Hangyul টিম"; em-dash connectors and slash-joined phrases removed.

## Critical semantic issues found in `current`

| Key | Said | Now says |
|---|---|---|
| common:v29.pricing.compare.row.support | "পরামর্শের মেয়াদ" (consultation term, reads as sessions/contract) | কাউন্সেলিংয়ের পর প্রশ্ন করার সময়সীমা (support window) |
| common:v29.pricing.compare.scopeNote | Premium no-limit only; **dropped** "new documents, translation and notarization not included" | full scope + exclusions restored |
| common:v29.pricing.compare.row.managed, student:v15.services.allowance.key.max_managed_applications | "পরিচালিত আবেদন" (passive count label, forbidden) | যেসব আবেদন আমরা আপনার সঙ্গে ম্যানেজ করি |
| common:v29.pricing.all_in_one.f5, compare.value.visa.DOCUMENT_PREP, student:v15.services.level.visa_support.DOCUMENT_PREP | "ভিসার কাগজপত্র প্রস্তুত" (Hangyul prepares the visa documents) | ভিসার নথি প্রস্তুতে সহায়তা |
| common:v29.pricing.premium.f4 | only "visa schedule" — documents dropped | ভিসার নথি ও গুরুত্বপূর্ণ তারিখের নিবিড় তত্ত্বাবধান · ডরমিটরি আবেদনে সহায়তা |
| common:v29.pricing.compare.value.documents.INTENSIVE | "নিবিড় পর্যালোচনা" — correction notes dropped | গভীর পর্যালোচনা, কী ঠিক করতে হবে তার নির্দেশনাসহ |
| common:v29.addon.item.airport_pickup | "এয়ারপোর্ট পিকআপের ব্যবস্থা" (no partner — implies Hangyul runs transport) | এয়ারপোর্ট পিকআপ, পার্টনারের মাধ্যমে ব্যবস্থা |
| concierge:step.pickup.sub | "someone will come to collect you" | আপনার পিকআপ পার্টনার অ্যারাইভাল হলে আপনার অপেক্ষায় থাকবেন |
| student:compare.legalCount_one/_other, student:profileV3.why.basics, visaroute:caveat.APOSTILLE_TRANSITION, visaroute:step.slow_items.why | "সত্যায়ন" / "কনস্যুলার সত্যায়ন" (≈ attestation/confirmation); slow_items also dropped apostille | অ্যাপোস্টিল বা কনস্যুলার লিগ্যালাইজেশন |
| student:register.privacyNote | shared "only with the counselor you choose" — Hangyul team and partner agency missing | Hangyul টিম (এর অংশীদার এজেন্সিসহ) ও আপনার বেছে নেওয়া বিশ্ববিদ্যালয় |
| student:discover.verdict.reach, success:group.possible | "সম্ভাব্য ম্যাচ" (possible match) | শর্ত পূরণ, তবে যাচাই দরকার |
| student:v15.services.scope.consultation | "পরামর্শের সময়" (consultation *time* — V15 minutes wording) | কাউন্সেলিং |
| student:v15.services.allowance.unlimited | "সবসময় যোগাযোগ" (always, no scope) | সেবার মেয়াদে যেকোনো সময় Hangyul টিমকে প্রশ্ন করুন |
| student:v15.services.allowance.key.essay_review_rounds, marketing:v12.terms.services.writing, v12.terms.definitions.support.def, v12.terms.intro | essay *editing* rendered as "review"/"correction" | পার্সোনাল স্টেটমেন্ট ও স্টাডি প্ল্যান এডিটিং |
| marketing:v12.terms.services.documents | "preparation and review of application documents" (Hangyul prepares) | আবেদনের নথি প্রস্তুতে সহায়তা, এবং নথি পর্যালোচনা |
| marketing:v11.services.s1.text | "we handle the whole process … preparing documents" (Hangyul prepares/takes responsibility) | নথি প্রস্তুতে আর বিশ্ববিদ্যালয়ের সঙ্গে যোগাযোগে সাহায্য করি |
| marketing:v11.why.s1.text, v11.why.s2.*, v11.why.s3.*, v11.hero.*, v11.services.title/lede | "সাফল্যের সঙ্গী", "১০০% নিজস্ব", "সবচেয়ে ভালো ফল", "স্বপ্নকে সত্যি করে তুলব" (overclaims from old ko) | truthful V31 source copy, transcreated |
| marketing:v11.faq.q1.a, q8.a, q9.a | "মাধ্যমিক" for high school (in Bangladesh = SSC, one level too low) | উচ্চ মাধ্যমিক |
| marketing:v11.faq.q6.a | "every university offers scholarships" | বেশির ভাগ বিশ্ববিদ্যালয়ই দেয় |
| marketing:v15.pricing.title | "হানগিউল কোরিয়া-শিক্ষা সেবার মূল্য" (brand in Bangla script) | Hangyul-এর সেবার মূল্য |
| marketing:v12.terms.universityInfo.p | contained Hangul (대학알리미) | Academy Info |
| marketing:v12.privacy.collect.profile.purpose | "স্টাডি প্ল্যান প্রস্তুত করা" (study-plan *essay*) | বিদেশে পড়ার প্রস্তুতির পরিকল্পনা |
| marketing:v12.privacy.collect.verification.purpose | "fraudulent" rendered "automated" | প্রতারণামূলক সাইন-আপ প্রতিরোধ |
| marketing:v12.privacy.retention.contract.record | "subscription withdrawal" | চুক্তি ও অর্ডার বাতিলের রেকর্ড |
| marketing:v12.privacy.sharing.agency.when | "or accept an appointment" | বা কোনো এজেন্সির দায়িত্বে থাকতে সম্মতি দেন |
| marketing:v12.privacy.collect.noCard, processors.tosspayments.items | "মেয়াদোত্তীর্ণের তারিখ" (date it *expired*) | মেয়াদ শেষের তারিখ (expiry date) |
| marketing:v20.city.Gyeonggi.body | dorm sentence inverted ("with their own hostels instead of shared-flat streets") | more students live in university dormitories instead of off-campus studios |
| dossier:package.line | "{{total}} requirements" | {{total}}টি নথি লাগবে |
| common:fit.or | "বা" without surrounding spaces (glued text) | " বা " |
| marketing:v15.pricing.compare.item | non-empty where English is intentionally empty | empty |
| common:task.universityRequestItem, task.sendStudyPlanFeedback, student:home.documentsSub_one | missing (null) | translated |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (v11.hero.*, seo.home.*) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
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
| Home | 5 | 5 | 4 | 5 | 4 | team name unified, `_one` form added, deadline = শেষ তারিখ |
| Applications | 5 | 5 | 4 | 5 | 4 | verdict "meets, needs checking"; student submits (waitingDetail, team.final) |
| Documents | 5 | 5 | 4 | 5 | 5 | apostille / consular legalization exact; "needs fixing" unified as ঠিক করতে হবে |
| Services | 5 | 5 | 4 | 5 | 4 | managed ≠ recommended; support window; প্যাকেজ → প্ল্যান; scope kept on "any time" |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | partner pickup; ডরমিটরি unified; immigration authorities decide |

## Unresolved ambiguity (listed, not guessed)

- marketing:v11.faq.q1.a — ko "올림픽 참가 증명서" (Olympics) vs en "olympiad"; followed en (অলিম্পিয়াড).
- marketing:v11.faq.q1.a / q8.a / q9.a — "junior college" has no Bangladeshi equivalent; rendered ডিপ্লোমা (polytechnic diploma), the closest local credential.
- student:v25.lane.you — ko "내가 할 일" (first person) vs en "What you do"; followed en (আপনি যা করবেন).
- student:v15.services.allowance.unlimited — key name says "unlimited", source says "ask any time during your service term"; translated the source (scope kept).
- "Essay" in the student app stays প্রবন্ধ: the loanword "এসে" collides with the Bangla verb form এসে ("having come").
- common:fit.test.* (except KIIP / KING_SEJONG / UNIV_KLI) — passed through as official test names by the validator.

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=bn` → `V28 l10n (1 locales): 1729 strings valid, 0 problems`
