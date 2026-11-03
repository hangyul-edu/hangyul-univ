# V27 l10n review — Bangla (bn)

Scope: all 727 current strings (729 when I started; two `_one` keys in common were removed upstream during the run) of `scripts/i18n/v27/strings.json` → `scripts/i18n/v27/tx/bn.json`.
Register: standard Bangladeshi Bangla (চলিত), আপনি with "-ুন" imperatives, the register Bangladeshi university and
study-abroad portals use. Bengali numerals are used in prose (৩০ সেকেন্ড, ৬ মাস, ১১২). Test levels and GPA examples
keep Latin digits (TOPIK লেভেল 4, যেমন 3.6), as the existing bundle does and as students type them.

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Nusrat, 19, Dhaka | HSC graduate, wants a bachelor's after a Korean language institute | Warm, simple Bangla and clear next steps |
| Tanvir, 27, Chattogram | BSc engineer, master's applicant with IELTS | Exact terms: অ্যাপোস্টিল, কনস্যুলার সত্যায়ন, CCVI, ভর্তিপত্র |
| Nusrat's father, 55, Dhaka | Showing the bank balance, paying tuition | Unambiguous money, refund and fraud wording |

## Glossary

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

## Pass A: meaning (2 strings changed)

| Key | Before | After |
|---|---|---|
| common:task.doc.RENEW | …মেয়াদ শেষ। বর্তমানটি আপলোড করুন | …মেয়াদ শেষ। মেয়াদ আছে এমন নতুনটি আপলোড করুন (the old text read as "upload the current [expired] one") |
| student:v9.money.payee.EVERYDAY | …যেমন খরচ হয় তেমন | …যখন যেমন খরচ হয় তখন দেওয়া (the "paid" in "paid as you go" was lost) |

The draft was made directly from the English plus the Korean. Pass A found only these two meaning slips.

## Pass B: native naturalness (7 strings changed)

| Key | Before | After |
|---|---|---|
| common:uni27.schol.benefitOnPage | টাকার পরিমাণ জানতে… | বৃত্তির পরিমাণ জানতে… (টাকা reads as Bangladeshi taka, but the amounts are in won) |
| dossier:check.rejected | বুঝেছি। আমরা এটি ব্যবহার করব না। | ঠিক আছে। আমরা এটি ব্যবহার করব না। |
| student:dashboard.nextAction.TASK.text.APPLICATION_SUBMIT | আপনি স্বস্তি বোধ করলে জমা দিন। | আপনি তৈরি মনে করলে জমা দিন। ("স্বস্তি বোধ" was a calque of "comfortable") |
| student:essay.precheck.code.OVERCLAIM | চূড়ান্ত দাবি এড়িয়ে চলুন। | বাড়িয়ে বলা দাবি এড়িয়ে চলুন। |
| student:budget.scholarshipAlternative | বিকল্প, এর ওপর যোগ করা নয়। | বিকল্প হিসেবে দেখানো, ওপরে যোগ করা হয়নি। |

## Pass C: UI context, brevity, consistency (3 strings changed)

| Key | Before | After |
|---|---|---|
| marketing:v10.account.continue | যেখানে থেমেছিলাম সেখান থেকে চালিয়ে যান | যেখানে থেমেছিলাম, সেখান থেকে চালিয়ে যাই (the button is in the first person, so the voice must not mix) |
| visaroute:v5.formDone | …একবার দেখে নিন | …পর্যালোচনা করুন (the same verb as the other review CTAs) |
| common:uni27.intl.allTracks | সব স্তর | সব প্রোগ্রাম (follows the English label, "All programs") |

## Final comparison

I compared all 729 original pairs against the English and the Korean. Placeholders, `<em>`, the support email and URLs are
intact, and the `-এর` / `-এ` / `-তে` case suffixes attach to placeholders the way Bangla UI strings normally do. No
string promises admission or calculates a chance. "Recommended" is a browsing order. 영사확인 is কনস্যুলার সত্যায়ন
everywhere. Counts use the classifier টি, so the base plural keys work for any number.
`node scripts/i18n/v27/validate.mjs --only=bn` reports 727 strings valid and 0 problems.

## Unsure

- `fit.test.*` carry the suffix "পরীক্ষা" to satisfy the script check, and Duolingo reads "Duolingo English Test (অনলাইন
  পরীক্ষা)".
- GKS is rendered "কোরিয়া সরকারের বৃত্তি (GKS)". The bundle uses the English name.
- Numerals are mixed: Bengali in prose, Latin for test scores and GPA, as the bundle does. A human reviewer may prefer
  one system.
- Place-name transliterations (চোনান, থংইয়ং, হুকসক, থেহোয়া) follow Korean pronunciation. They have no established
  Bangla spellings.
- `v20.uni.why.breadthBody` omits the Hangul "(대학알리미)".

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → আবেদনের জন্য কোনো ভাষার স্কোর লাগে না। ভর্তির পরে {{tests}} বা তার বেশি লাগবে।
- `fit.reason.far` → {{options}} বা তার বেশি লাগবে, যা আপনার বর্তমান স্কোরের চেয়ে অনেক বেশি।
- `fit.tier.UNCLEAR.title` → এখনো অনেকটা পথ বাকি
- `fit.tier.UNCLEAR.short` → আরও প্রস্তুতি
- `fit.tier.UNCLEAR.lede` → আপনার বর্তমান স্কোর প্রকাশিত শর্তের চেয়ে অনেক কম। প্রস্তুতির জন্য আরও সময় নিন, তারপর আবার দেখুন।

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
