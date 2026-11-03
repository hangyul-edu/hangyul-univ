# Bengali (bn, Bangladesh usage) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `bn`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent (coordinator runs it).

## Scope

- Merged: `scripts/i18n/v9-data/bn-1.json` … `bn-20.json` (3,742 todo keys, ~150–230 keys per chunk), `bn-21.json`
  (13 values intentionally identical to English), `bn-tier.json` (fix of two pre-existing wrong `common:tier.*` strings),
  `bn-22.json` (10 revisions from this review).
- Result: `v9-todo bn` → web 3,652 keys, 0 missing / identical / stale. `--native` → 4,160 keys, 0 missing.
- Namespaces created: `student`, `dossier`, `success`, `writing`, `visaroute`, `concierge`, `mobile` (bn previously had only `common`, `marketing`).
- Identical to English on purpose (`_identical_ok`): brand (`Hangyul`, `Hangyul Univ`), test names (IELTS, TOEFL iBT, TOPIK), PhD, MS–PhD, CV,
  `{{min}}–{{max}}`, `—`.

## Register and terminology choices

Standard written Bangladeshi Bengali (চলিত ভাষা), polite আপনি form throughout. Loanwords that Bangladeshi students and parents already use
in Bengali script were kept as loanwords (কাউন্সেলর, ভিসা, টিউশন ফি, ডরমিটরি, অফার, প্রোফাইল, আপলোড, অ্যাপোস্টিল, রেসিডেন্স কার্ড);
formal Bengali for official/legal notions (দূতাবাস, ভর্তিপত্র, সত্যায়ন, প্রত্যয়িত অনুবাদ, জামানত, বৃত্তি, উত্তীর্ণ সনদ). All of these reuse the
existing `bn/common.json` and `bn/marketing.json` terms (appStatus.*, docCategory.*, legalization.*). Counts use the classifier টি.
Messenger and plan names were transliterated (হোয়াটসঅ্যাপ, ফ্রি এক্সপ্লোরার …) so no Latin words show in running text; official proper
nouns (TOPIK, D-2, HiKorea, NHIS, VFS Global, visa.go.kr) stay as is.

## Sample read

All keys were read in context while translating (chunked by namespace). A second focused pass covered:

- Verdicts on every surface: `student:verdict.*`, `student:discover.verdict.*`, `student:start.tier.*`, `common:tier.*`, `success:group.*`,
  `mobile:v3.match.*`, `mobile:v3.quick.tier.*`, `student:universityV2.verdictLine.*`, `student:v4.verdictText.*`, `mobile:v3.discover.explain.*` — against docs/STATE_MAP.md.
- Money: `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `student:budget.*`, `v4.offer.*`, `ws3.tuition.*`, `success:submission.fee.*`, `concierge:lease.*`.
- Parent-facing: `student:v9.family.*`, `student:v9.sponsor.*`.
- Visa: `visaroute:*`, `student:legalFlow.*`, `student:v9.visa.*` (incl. the Dhaka VFS note), `student:v9.announced.*`.
- Privacy / authorization: `dossier:v9.who.*`, `success:submission.authorize.*`, `student:settings.privacy.*`.

No screenshots (browsers are off for translator agents); the coordinator's leak-check run is the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 5 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 5 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 3 / 4 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Before revisions, D-naturalness was 3: the pre-existing `common:tier.*` showed “প্রতিযোগিতামূলক ম্যাচ / চ্যালেঞ্জিং” next to the new
“সম্ভাব্য ম্যাচ / এখনো যোগ্য নন”, a counter label started with a dangling classifier (“টি ভাষা প্রোগ্রাম…”), and visa to-dos for
documents the student writes said “সংগ্রহ করুন” (collect) instead of “প্রস্তুত করুন” (prepare).

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | প্রতিযোগিতামূলক ম্যাচ → সম্ভাব্য ম্যাচ | STATE_MAP: COMPETITIVE = *Possible match* (English source says so). Pre-existing bn string was a literal “competitive”. |
| `common:tier.REACH` | চ্যালেঞ্জিং → এখনো যোগ্য নন | STATE_MAP: REACH = *Not eligible yet* (one step away). “Challenging” implied admission odds. |
| `student:verdict.COMPETITIVE` / `REACH` | written as সম্ভাব্য ম্যাচ / এখনো যোগ্য নন (checked) | The common bug (COMPETITIVE→“competitive”, REACH→“possible/reach”) avoided. |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | written as এক ধাপ দূরে (checked) | English is “One step away”, not “Possible”; matches marketing.json. |
| `student:v9.routes.korean.count_*` | “টি ভাষা প্রোগ্রাম এখনই আপনাকে নেয়” → “ভাষা প্রোগ্রামে এখনই ভর্তি হতে পারেন” | The number is rendered separately before the string; a leading classifier read broken. |
| `common:task.visa.other_cover_letter/self_intro/self_intro_study_plan/study_plan/training_plan` | …সংগ্রহ করুন → …প্রস্তুত করুন | The student writes these; “collect” was wrong. |
| `common:task.visa.other_declaration_form/applicant_questionnaire` | …সংগ্রহ করুন → …পূরণ করুন | Forms are filled in. |
| `student:home.season` | আবেদনের মৌসুম → আবেদনের সময় | Plainer for parents. |
| `student:services.*.name`, `concierge:contact.*` | kept in Bengali script (ফ্রি এক্সপ্লোরার, হোয়াটসঅ্যাপ…) | Avoid Latin in running text for profile D. |

## Terminology (STATE_MAP and key terms in bn)

| English | Bengali |
|---|---|
| Strong match | শক্তিশালী ম্যাচ |
| Possible match | সম্ভাব্য ম্যাচ |
| Not eligible yet | এখনো যোগ্য নন |
| One step away | এক ধাপ দূরে |
| Needs your grades | আপনার গ্রেড প্রয়োজন |
| Offer received / accepted | অফার পাওয়া গেছে / অফার গৃহীত |
| Tuition due / paid | টিউশন ফি বাকি / টিউশন ফি পরিশোধিত |
| Admission letter | ভর্তিপত্র |
| Apostille / consular legalization | অ্যাপোস্টিল / কনস্যুলার সত্যায়ন |
| Certified translation | প্রত্যয়িত অনুবাদ |
| Bank balance certificate | ব্যাংক ব্যালেন্স সার্টিফিকেট |
| Proof of money (show, not pay) | যে টাকা দেখাতে হবে (পরিশোধ নয়) |
| Deposit (housing) | জামানত |
| Embassy / post | দূতাবাস / মিশন |
| Residence card | রেসিডেন্স কার্ড |
| Counselor | কাউন্সেলর |

## Residual risks (what a native human reviewer should check first)

1. Money/visa precision: `student:v9.funds.*` (tier words 'উৎকৃষ্ট' / 'পরামর্শমূলক' for the 'excellent' / 'consulting' university tiers),
   `student:v9.guard.text` (“মানি চেঞ্জার, দালাল” for money changers/agents), `student:v9.visa.methodNote.VISA_CENTRE_DHAKA`.
2. “মিশন” is used for the English “post” (embassy/consulate) in `visaroute:*` — confirm Bangladeshi parents read it naturally.
3. Loanwords vs Bengali: ম্যাচ, কাউন্সেলর, পোর্টাল, কনফার্মেশন remain English loans in Bengali script; a reviewer may prefer more native words for profile D.
4. Mixed numerals: prose uses Bengali digits (৯০ দিন, ২০২৬), while interpolated numbers come from the formatter and emergency numbers (112/119) stay Latin.
5. City and airport transliterations in `visaroute:city.*` and `concierge:airport.*` (e.g. গুয়াংজৌ, শিআন, ছংজু).
6. Plural `_one`/`_other` are identical in Bengali for most keys; CLDR `one` in bn covers 0 and 1 — strings were written with `{{count}}` so both read correctly.
7. Keyboard hint `student:messages.hint` keeps “Enter / Shift” in Latin (key caps).
8. `student:onboarding.education.institutionPh` and `sponsor.goalPh` examples were localized to Bangladesh (ঢাকা কলেজ, বাংলাদেশি কোম্পানি).
