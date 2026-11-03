# V28 localization review — Bangla (bn)

Scope: all 354 keys of `scripts/i18n/v28/jobs/bn.json` → `scripts/i18n/v28/tx/bn.json`. Every key was read against the current English (`en`) and the Korean (`ko`); `current` was kept only where it is correct, natural and matches the V28 English.
Register: standard Bangladeshi চলিত, আপনি with -ুন imperatives; Bengali numerals in prose, Latin digits for test levels/GPA (as in V27).

## Personas

| Persona | Who | What they need |
|---|---|---|
| Nusrat, 19, Dhaka (first-time visitor) | HSC graduate | Warm, simple Bangla and clear next steps |
| Tanvir, 27, Chattogram (comparison shopper) | BSc engineer, master's with IELTS, comparing agencies | Exact terms and plan scope |
| Nusrat's father, 55 | Shows the bank balance, pays tuition | Unambiguous money and trust wording |

## Glossary

Reused from `docs/qa/v27/l10n/bn.md` (unchanged rows), plus V28 additions at the end.

| English | Bangla | Note |
|---|---|---|
| scholarship | বৃত্তি | bundle term |
| Global Korea Scholarship (GKS) | কোরিয়া সরকারের বৃত্তি (GKS) | the name Bangladeshi applicants use |
| admission guide (모집요강) | ভর্তি নির্দেশিকা | |
| apostille | অ্যাপোস্টিল | bundle term |
| consular legalization (영사확인) | কনস্যুলার সত্যায়ন | bundle term |
| Korean language institute | কোরীয় ভাষা ইনস্টিটিউট | |
| counselor | কাউন্সেলর | bundle term |
| the Hangyul team | Hangyul টিম | bundle term |
| tuition | টিউশন ফি | bundle term |
| deadline | সময়সীমা | bundle term |
| admission letter / certificate of admission | ভর্তিপত্র (Certificate of Admission) | bundle term |
| residence card | রেসিডেন্স কার্ড | bundle term |
| housing / dormitory | আবাসন / হোস্টেল | |
| embassy / consulate | দূতাবাস / কনস্যুলেট | |
| immigration office | ইমিগ্রেশন অফিস | |
| CCVI | ভিসা ইস্যুর নিশ্চয়তাপত্র (CCVI) | |
| proof of funds | আর্থিক সামর্থ্যের প্রমাণ | bundle wording |
| documents | নথি | bundle term (নথিপত্র) |
| match | ম্যাচ | bundle term |
| Recommended (sort) | প্রস্তাবিত ক্রম | not র‍্যাঙ্কিং |
| save | সংরক্ষণ করুন | bundle term |
| essay | প্রবন্ধ | |
| Korean won | ওন (KRW) | |
| the Hangyul team (V28) | Hangyul টিম | replaces "আপনার কাউন্সেলর" in student UI |
| Needs more preparation (far tier) | আরও প্রস্তুতি দরকার | not a distance/chance word |
| intake | ভর্তি সেশন | |
| dormitory | হোস্টেল | one term across pricing and scope |
| task (console) | টাস্ক | |

## Known defects fixed

- `visaroute:step.slow_items.why`: bare "সত্যায়ন" → "কনস্যুলার সত্যায়ন", the V27 glossary term for 영사확인. `caveat.APOSTILLE_TRANSITION` already used it (kept; only the counselor changed). `university:documents.legalization` newly translated as "কনস্যুলার সত্যায়ন". Bangla has no forbidden-term rule in the validator.
- 22 student-facing strings changed "আপনার কাউন্সেলর" → "Hangyul টিম".

## Pass A — meaning (34 strings changed)

The V28 English changed meaning in many keys (tier titles and ledes, the 'Hangyul team' identity, scholarships empty state, dormitory scope). Every student-facing `current` that said *your counselor* was rewritten to the Hangyul team (brief: never "your counselor"); agency-console strings about agency staff were left alone. Legalization wording was corrected to the glossary term. The far tier now says *needs more preparation*, never a distance/probability word. 'No Korean test result' replaced 'does not know Korean' in the deposit-scheme rule.

| key | before | after |
|---|---|---|
| `visaroute:step.slow_items.why` | সত্যায়ন, যক্ষ্মা পরীক্ষা ও পুলিশ ক্লিয়ারেন্সে কয়েক সপ্তাহ লাগে। | কনস্যুলার সত্যায়ন, যক্ষ্মা পরীক্ষা ও পুলিশ ক্লিয়ারেন্সে কয়েক সপ্তাহ লাগে। |
| `visaroute:caveat.APOSTILLE_TRANSITION` | ভিয়েতনাম ১১ সেপ্টেম্বর ২০২৬ থেকে অ্যাপোস্টিল দেওয়া শুরু করেছে, কিন্তু দূতাবাসের স্টুডেন্ট ভিসার তালিকায় এখনো কনস্যুলার সত্যায়ন লেখা আছে। কোনটি গ্রহণযোগ্য, আপনার কাউন্সেলর নিশ্চিত করবেন। | ভিয়েতনাম ১১ সেপ্টেম্বর ২০২৬ থেকে অ্যাপোস্টিল দেওয়া শুরু করেছে, কিন্তু দূতাবাসের স্টুডেন্ট ভিসার তালিকায় এখনো কনস্যুলার সত্যায়ন লেখা আছে। কোনটি গ্রহণযোগ্য, Hangyul টিম নিশ্চিত করবে। |
| `common:fit.tier.UNCLEAR.title` | এখনো অনেকটা পথ বাকি | আরও প্রস্তুতি দরকার |
| `common:fit.tier.CHALLENGE.lede` | আমাদের জানামতে আপনাকে আটকানোর মতো কিছু নেই। এই স্তরের বর্তমান শর্ত আমরা এখনো যাচাই করিনি, তাই আপনার সঙ্গে মিলিয়ে দেখব। | এই স্তরের জন্য এই বিশ্ববিদ্যালয়গুলোর শর্ত Hangyul এখনো যাচাই করেনি। আমরা আপনার সঙ্গে মিলিয়ে দেখব। |
| `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME` | কিছু দেশের কোরীয় ভাষা না জানা শিক্ষার্থীদের পড়াশোনার টাকা একটি ব্যাংকে জমা রাখতে হবে, যা প্রতি সেমিস্টারে ছাড়া হবে। | কিছু দেশের যেসব শিক্ষার্থীর কোরীয় ভাষা পরীক্ষার ফল নেই, তাঁরা পড়াশোনার টাকা ব্যাংকে জমা রাখবেন, যা প্রতি সেমিস্টারে ছাড়া হবে। |

## Pass B — native naturalness (20 strings changed)

Read as each persona. Long marketing bodies were re-flowed into native word order; em-dash chains from the old bundle were split into sentences; machine-literal phrasing in pricing and city pages was replaced.

| key | before | after |
|---|---|---|
| `marketing:seo.home.description` | সঠিক কোরীয় বিশ্ববিদ্যালয় খুঁজুন, নথি প্রস্তুত করুন, আর ভিসা থেকে আগমন পর্যন্ত সব এক জায়গায় সামলান, যাচাই করা তথ্য আর পাশে থাকা সত্যিকারের মানুষের সাহায্যে। | সঠিক কোরীয় বিশ্ববিদ্যালয় খুঁজুন, নথি প্রস্তুত করুন, আর ভিসা থেকে আগমন পর্যন্ত সব এক জায়গায় সামলান। যাচাই করা তথ্য, আর পাশে সত্যিকারের মানুষ। |
| `marketing:v20.city.Gyeonggi.body` | গিয়ংগি সিউলকে ঘিরে আছে, এবং রাজধানী ছাড়া অন্য যেকোনো অঞ্চলের চেয়ে এখানে বেশি বিশ্ববিদ্যালয়। সুওন, ইয়ংইন, সংনাম ও বুচন — সবই মেট্রো বা সরাসরি বাসে সিউলের কেন্দ্র থেকে ৪০–৭০ মিনিটের পথ, আর বাসাভাড়া সাধারণত এক-তৃতীয়াংশ কম। / এখানকার ক্যাম্পাসগুলো সাধারণত সিউলের চেয়ে বড় ও বেশি স্বয়ংসম্পূর্ণ, ভাগাভাগি করা ফ্ল্যাটের রাস্তার বদলে নিজস্ব ছাত্রাবাসসহ। | গিয়ংগি সিউলকে ঘিরে আছে, আর রাজধানী ছাড়া অন্য যেকোনো অঞ্চলের চেয়ে এখানে বেশি বিশ্ববিদ্যালয়। সুওন, ইয়ংইন, সংনাম ও বুচন, সবই মেট্রো বা সরাসরি বাসে সিউলের কেন্দ্র থেকে ৪০–৭০ মিনিটের পথ, আর বাসাভাড়া সাধারণত এক-তৃতীয়াংশ কম। / এখানকার ক্যাম্পাসগুলো সাধারণত সিউলের চেয়ে বড় ও বেশি স্বয়ংসম্পূর্ণ, ভাগাভাগি করা ফ্ল্যাটের রাস্তার বদলে নিজস্ব ছাত্রাবাসসহ। |
| `marketing:v20.uni.ctaTitle` | গুরুত্ব দিয়ে ভেবে দেখতে প্রস্তুত? | এখানে আবেদন করার কথা ভাবছেন? |
| `marketing:v6.unis.title` | যে বিশ্ববিদ্যালয়গুলোর জন্য এই যাত্রা সার্থক। | সারা কোরিয়ার বিশ্ববিদ্যালয়। |
| `concierge:housing.honest` | আমরা শুধু উৎসসহ ডরমিটরির তথ্য দেখাই, এবং সেই রুমগুলো যা কোনো সেবাদাতা সত্যিই আমাদের দিয়েছে — প্রতিটি চিহ্নিত করা। আমরা কখনো মনগড়া তালিকা দেখাই না। | আমরা শুধু উৎসসহ হোস্টেলের তথ্য দেখাই, আর শুধু সেই রুমগুলো যা কোনো সেবাদাতা সত্যিই অফার করেছে, প্রতিটি চিহ্নিত করে। আমরা কখনো মনগড়া তালিকা দেখাই না। |

## Pass C — UI context, brevity, one term per concept (26 strings changed)

Labels and chips shortened; one term per concept enforced (dormitory = one word across pricing/scope; programs, not majors; proof of funds per glossary; legalization per glossary). Semicolon/dash fragments in console footnotes became two short sentences.

| key | before | after |
|---|---|---|
| `marketing:v15.pricing.compare.row.dormitory` | হোস্টেল সহায়তা | হোস্টেল |
| `dossier:check.title` | আমরা এই তথ্যগুলো পেয়েছি। অনুগ্রহ করে মিলিয়ে দেখুন। | আমরা যা পেয়েছি, মিলিয়ে দেখুন |
| `university:kpi.insufficientDetail` | {{n}}টি রেকর্ডের ভিত্তিতে — {{min}}টি থেকে দেখানো হয় | {{n}}টি রেকর্ডের ভিত্তিতে। {{min}}টি হলে দেখানো হবে। |
| `marketing:v24.uni.academicTitle` | বিভাগ ও ক্যাম্পাস | প্রোগ্রাম ও ক্যাম্পাস |
| `agency:v8.view.docs` | নথি সংশোধন প্রয়োজন | নথি সংশোধন দরকার |

## Final — source ↔ target comparison (10 strings changed)

Whole set compared with `en` and `ko` for meaning, numbers, test names, placeholders and the no-guarantee / no-ranking rule. Corrected: waitlist hint no longer says 'we still have to decide'; 'Needed for a decision' no longer reads as 'a decision is needed'; passport *issuance* record (not 'passport data'); 'apply and record the receipt'.

| key | before | after |
|---|---|---|
| `university:v22.stageHint.decision` | অপেক্ষমাণ তালিকায় — সিদ্ধান্ত এখনো আমাদের হাতে | অপেক্ষমাণ তালিকায়। সিদ্ধান্ত এখনো বাকি |
| `university:v8.aq.need` | সিদ্ধান্তের প্রয়োজন | সিদ্ধান্তের জন্য যা লাগবে |
| `student:v26.now.owner.STUDENT` | আপনার কাজ | আপনি |
| `visaroute:step.apply.title` | আবেদন করুন ও রেকর্ড রাখুন | আবেদন করুন ও রসিদ লিখে রাখুন |
| `common:task.visa.other_passport_record` | পাসপোর্ট রেকর্ড সংগ্রহ করুন | পাসপোর্ট ইস্যুর রেকর্ড সংগ্রহ করুন |

## Marketing scorecard (39 `marketing:` keys; 30-point card: clarity, trust, naturalness, brevity, CTA strength, cultural fit, 5 each)

| section | first draft | final | C | T | N | B | CTA | Fit |
|---|---|---|---|---|---|---|---|---|
| seo.home | 22 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |
| pricing (lede, compare, premium) | 20 | 26 | 5 | 4 | 4 | 5 | 4 | 4 |
| city pages (Busan, Gyeonggi, Seoul line) | 23 | 26 | 4 | 5 | 4 | 4 | 4 | 5 |
| university page (why/cta/intl/GKS/English) | 19 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |
| unis title, journey eyebrow | 18 | 25 | 4 | 4 | 4 | 5 | 4 | 4 |
| FAQ languages | 23 | 26 | 5 | 5 | 4 | 4 | 4 | 4 |

Each section below 25 on the first draft was transcreated (not translated) and re-scored until ≥ 25.

## Unsure

- 영사확인 = "কনস্যুলার সত্যায়ন" (glossary). সত্যায়ন is also everyday "attestation"; Bangladeshi MoFA uses সত্যায়ন for attestation, so it was kept; a native reviewer should confirm.
- `agency:v25.today.student_silent` "জন শিক্ষার্থী সাড়া দিচ্ছেন না" assumes a count is rendered before it.
- `university:eduLevel.HIGH_SCHOOL` "উচ্চ মাধ্যমিক" (HSC level) vs "হাই স্কুল".
- `staff.post` "মিশন" for a diplomatic post.
- `v28.pipe.label` uses "অ্যানালিটিক্স" transliterated; the console nav may keep it in Latin.

## Counts

| job keys | kept verbatim | rewritten | newly translated |
|---|---|---|---|
| 354 | 33 | 90 | 231 |

Kept verbatim = `current` non-null and output identical; rewritten = `current` non-null and output changed; newly translated = `current` null.

Validator: `node scripts/i18n/v28/validate.mjs --only=bn` → 354 strings valid, 0 problems.

## Second pass (jobs2): leak families

Job `scripts/i18n/v28/jobs2/bn.json`, customer families only (marketing 2, student 39, success 204, dossier 27). Every key had `current: null` and was showing English fallback, so all of them are newly translated. Same personas and glossary as the first pass. Pass A (meaning against en + ko), Pass B (naturalness), Pass C (UI brevity, one term per concept). Then a final source↔target check.

| Job keys | Kept verbatim | Rewritten | Newly translated | Intentionally empty |
|---|---|---|---|---|
| 272 | 0 | 0 | 269 | 3 (`dossier:upload.status.*`, empty in en/ko) |

Every key was drafted once and then checked in passes A–C. Changes after the draft: none. The three passes found nothing to change; `upload.status.*` stay empty as in en.

Examples (before → after):

| Key | Before | After |
|---|---|---|
| `student:workspace.owner.prep.you` | Upload the missing documents and finish your essays. (missing → English fallback) | বাকি নথি আপলোড করুন এবং প্রবন্ধগুলো শেষ করুন। |
| `success:item.ESSAY_WRONG_NAME.why` | An essay addressed to another university is the most common avoidable rejection. (missing → English fallback) | অন্য বিশ্ববিদ্যালয়কে লেখা প্রবন্ধই সবচেয়ে সাধারণ, অথচ এড়ানো যায় এমন প্রত্যাখ্যানের কারণ। |
| `success:agencyItem.DOC_LEGALIZE` | {{label}} — consular legalization pending (missing → English fallback) | {{label}}: কনস্যুলার সত্যায়ন বাকি |
| `success:agency.evidenceRule` | Confirmed only with a confirmation number or receipt. Moves the application to Submitted. (missing → English fallback) | শুধু নিশ্চিতকরণ নম্বর বা রসিদ থাকলেই নিশ্চিত হয়। তখন আবেদনটি "জমা হয়েছে"-তে যায়। |
| `dossier:page.privacy` | Only you, your counselor and Hangyul can see these files. A university sees a document only when it is sent for your application to that university. (missing → English fallback) | এই ফাইলগুলো শুধু আপনি ও Hangyul টিম দেখতে পারেন। কোনো বিশ্ববিদ্যালয় একটি নথি তখনই দেখে, যখন সেটি ওই বিশ্ববিদ্যালয়ে আপনার আবেদনের জন্য পাঠানো হয়। |

Marketing scorecard (`marketing:v20.uni.intl.officeLine` / `.none`; clarity, trust, naturalness, brevity, CTA, cultural fit):

| Section | Text | Cl | Tr | Na | Br | CTA | Cu | Total |
|---|---|---|---|---|---|---|---|---|
| University page, international office lines | এখানে আন্তর্জাতিক শিক্ষার্থীদের জন্য আলাদা অফিস আছে, যার নিজস্ব যোগাযোগের পথ আছে। / Hangyul এখনো এই বিশ্ববিদ্যালয়ের নিজস্ব সাইটে আন্তর্জাতিক শিক্ষার্থীদের আলাদা পাতা খুঁজে পায়নি। নিচের অফিসিয়াল ওয়েবসাইট থেকে শুরু করুন। | 5 | 5 | 4 | 4 | 4 | 4 | **26** |

Terms are identical to the first-pass glossary above. The student-facing `dossier:page.privacy` says “the Hangyul team”, never “your counselor”. *Counselor* appears only in the agency console role label.

Unsure (second pass):

- `dossier:upload.status.*` left empty as in en/ko.
- `success:queue.col.intake` *ভর্তি সেশন*. The first-pass glossary has no intake row, so this sets one.
- `student:workspace.owner.done.team` has no subject (*এখনো পাশে আছে*), which relies on the row label.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=bn` → 272 strings valid, 0 problems.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
