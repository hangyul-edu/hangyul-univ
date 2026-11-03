# V29 l10n record — bn (Bengali)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/bn.json` → `scripts/i18n/v28/tx-v29/bn.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=bn` → 0 problems (158 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Nusrat, 18, first-time visitor from Dhaka
- Rahim, 26, master's applicant comparing packages
- A parent reading fees and card-charge notes

## Register and conventions

আপনি throughout (existing). Plan = প্যাকেজ (existing v15.pricing.compare.caption). Team = "Hangyul Univ টিম". Bengali digits for literal numbers (existing convention); placeholders untouched.

## Key term decisions

- No round limit within contracted documents: "চুক্তিভুক্ত আবেদনপত্রের সম্পাদনা, রাউন্ডের কোনো সীমা নেই"; never সীমাহীন/অসীম.
- Up to N managed applications: "সর্বোচ্চ Nটি আবেদন পরিচালনা" / "পরিচালিত আবেদন" vs "সুপারিশকৃত বিশ্ববিদ্যালয়".
- Custom quote: "আলাদা কোটেশন".
- Airport pickup arrangement: "এয়ারপোর্ট পিকআপের ব্যবস্থা" (existing 'এয়ারপোর্ট পিকআপ'); note "অংশীদার পরিবহন প্রতিষ্ঠানের মাধ্যমে ব্যবস্থা করা হয়".
- Personal statement = ব্যক্তিগত বিবৃতি, study plan = অধ্যয়ন পরিকল্পনা, notarization = নোটারাইজেশন (all existing).

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | Hangyul Univ টিম একটি অতিরিক্ত সেবার প্রস্তাব দিয়েছে |
| Additional service / add-on | অতিরিক্ত সেবা |
| Add-on (compare cell) | অতিরিক্ত সেবা |
| Custom quote (별도 견적) | আলাদা কোটেশন |
| Airport pickup arrangement (공항 픽업 연결) | এয়ারপোর্ট পিকআপের ব্যবস্থা |
| Partner-provider pickup note | এয়ারপোর্ট পিকআপ একটি অংশীদার পরিবহন প্রতিষ্ঠানের মাধ্যমে ব্যবস্থা করা হয়। |
| Mock interview | মক ইন্টারভিউ |
| Diagnostic consultation | ব্যক্তিগত ডায়াগনস্টিক পরামর্শ + ১টি ফলো-আপ |
| Recommended universities (추천) | সুপারিশকৃত বিশ্ববিদ্যালয় |
| Managed applications (지원 관리) | পরিচালিত আবেদন |
| Up to N managed applications | সর্বোচ্চ ২টি বিশ্ববিদ্যালয় আবেদন পরিচালনা |
| Up to N rounds | সর্বোচ্চ {{count}} রাউন্ড |
| Statement & study-plan editing | বিবৃতি ও অধ্যয়ন পরিকল্পনা সম্পাদনা |
| No round limit within contracted documents (card) | চুক্তিভুক্ত আবেদনপত্রের সম্পাদনা, রাউন্ডের কোনো সীমা নেই |
| No round limit within contract (cell) | চুক্তির মধ্যে রাউন্ডের সীমা নেই |
| Premium scope note | Premium-এ চুক্তিভুক্ত আবেদনপত্র ও সময়সূচির মধ্যে সম্পাদনার রাউন্ডের কোনো সীমা নেই। |
| No round limit (student app) | চুক্তিভুক্ত কাগজপত্রে রাউন্ডের সীমা নেই |
| No limit (mobile chip) | চুক্তিভুক্ত কাগজপত্রে সীমা নেই |
| Dormitory | ডরমিটরি |
| Settling in | ভিসা ও থিতু হওয়া |
| Visa decision disclaimer | ভিসা সহায়তা মানে প্রস্তুতি ও আবেদনে সাহায্য; সিদ্ধান্ত নেয় সংশ্লিষ্ট কর্তৃপক্ষ। |
| Consultation support period | পরামর্শের মেয়াদ |
| Contract term | চুক্তির মেয়াদ |
| Service period | সেবার মেয়াদ |
| Priority response | অগ্রাধিকার উত্তর |
| Dedicated team | নির্দিষ্ট টিম · অগ্রাধিকার |
| Upgrade | আপগ্রেড নিয়ে টিমকে জিজ্ঞাসা করুন |
| Notarization | নতুন কাগজ লেখা, অনুবাদ ও নোটারাইজেশনে আলাদা খরচ লাগতে পারে। |
| One-time payment in USD | সব মূল্য মার্কিন ডলারে (USD) এককালীন পরিশোধ। |
| Agree and pay CTA | সম্মতি দিয়ে {{amount}} পরিশোধ করুন |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'সিদ্ধান্ত নেয় সংশ্লিষ্ট কর্তৃপক্ষ'; addons.lede; upgrade.used).
- Pass B (native marketer naturalness): 3 changed ('না বললেও কিছু বদলাবে না'; 'ন্যায্য মূল্য,<br>স্পষ্ট পরিসর').
- Pass C (UI brevity, one term per concept): 2 changed (mobile chips).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 25/30

## Unsure

- 'মক ইন্টারভিউ' transliteration vs 'অনুশীলন সাক্ষাৎকার'.
- 'থিতু হওয়া' for settling in follows existing marketing copy.

## Counts

Job keys: 158 · extra plural forms: 0 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
