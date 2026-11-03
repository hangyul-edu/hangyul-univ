# Urdu (ur) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `ur`
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.
- Register: Pakistani standard Urdu, polite «آپ» throughout, imperative «…کریں» for buttons. English loanwords that Pakistani
  students and parents use every day are kept in Urdu script (کونسلر، آفر، اپ لوڈ، ٹیوشن فیس، ڈپازٹ، پک اپ، والٹ). Nastaliq/RTL:
  RLM marks were added by `v9-merge.mjs` (rtl-mark).
- Plurals: CLDR `one`/`other`. Where Urdu does not inflect the noun after a number (e.g. «{{count}} پروگرام», «{{count}} دن»), both forms
  are the same on purpose; verbs and nouns that do inflect (پیغام/پیغامات، دستاویز/دستاویزات، کھلتا/کھلتے ہیں) differ.

## Scope

- Merged: `scripts/i18n/v9-data/ur-1.json` … `ur-12.json` (3,742 todo keys: common 97, student 1,661, dossier 187, success 297,
  writing 120, visaroute 484, concierge 468, mobile 428) and `ur-13.json` (2 STATE_MAP fixes in existing strings + 11 revisions
  from this review).
- New namespace files: `ur/student.json`, `dossier.json`, `success.json`, `writing.json`, `visaroute.json`, `concierge.json`,
  `mobile.json` (ur had no student namespace before this run).
- Result: `v9-todo ur` → web 3,652 keys, 0 missing, 0 identical, 0 stale. `--native` → 4,160 keys, 0 missing.
- Latin text left in values is limited to allowed tokens: placeholders, `$t()` nesting, the brand (Hangyul, Hangyul Univ), tests
  (TOPIK, IELTS, TOEFL iBT, KIIP), GPA, NHIS, HiKorea, T-money, Naver, Google, visa.go.kr, g4k.go.kr, VFS Global, CHSI/CDGDC, NRC,
  NOC, OECD, CCVI, e-Form, eSIM/SIM, file types (PDF, JPG, PNG, WEBP, MB), airport codes, visa codes (D-2, D-4, D-4-1, C-3, E-7, F),
  app names (KakaoTalk, LINE, WhatsApp, Telegram, Zalo), keyboard keys (Enter, Shift) and developer-only strings (API, LAN IP,
  Android emulator URL). No `_identical_ok` entries.
- City and airport names are written in Urdu script (اسلام آباد، کراچی، ڈھاکہ، انچیون…), the way Pakistani media writes them.

## STATE_MAP check

| Key | English | ur | Note |
|---|---|---|---|
| `student:verdict.STRONG`, `discover.verdict.eligible`, `start.tier.STRONG`, `success:group.strong`, `mobile:v3.match.strong`, `v3.quick.tier.STRONG` | Strong match | مضبوط میچ | reuses existing `common:tier.STRONG` |
| `student:verdict.COMPETITIVE`, `discover.verdict.reach`, `success:group.possible`, `mobile:v3.match.possible` | Possible match | ممکنہ میچ | new |
| `student:verdict.REACH`, `verdict.NOT_ELIGIBLE`, `discover.verdict.notyet`, `start.tier.NOT_YET`, `success:group.not_yet`, `mobile:v3.match.notYet`, `v3.quick.tier.NOT_YET` | Not eligible yet | ابھی اہل نہیں | reuses existing `common:tier.NOT_ELIGIBLE` |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE`, `v3.quick.possible_*` | One step away | بس ایک قدم دور | "just one step away" — no promise |
| `mobile:v3.match.close` | Not eligible yet — close | ابھی اہل نہیں — بس ایک قدم دور | STATE_MAP REACH wording |
| `student:discover.verdict.check` | Needs your grades | آپ کے گریڈز درکار ہیں | "your grades are needed"; not a verdict |

**Existing strings fixed (STATE_MAP bug):**

| Key | English | Before | After |
|---|---|---|---|
| `common:tier.COMPETITIVE` | Possible match | مسابقتی میچ (= "competitive match") | ممکنہ میچ |
| `common:tier.REACH` | Not eligible yet | مشکل ہدف (= "difficult target") | ابھی اہل نہیں |

«مشکل ہدف» told a REACH student the programme was a hard but open target, while STATE_MAP says a published requirement is not met
yet. No admission-odds wording (امکان، یقینی، ضمانت) is used for verdicts. «ضمانت» appears only where English says "guarantee"
(the conditional partner guarantee, "not an admission guarantee").

## Sample read

I read every todo key against its English, with its screen in mind. I spent the most time on:

- Money: `student:v9.money.*`, `v9.funds.*` (money you show vs. money you pay, whose name, how long it is held, "against the law"),
  `v9.guard.*`, `v9.refund.*`, `budget.*`, `v4.offer.*`, `success:submission.fee.*`, `services.checkout.*` (demo payment).
- Family link and sponsor page: `student:v9.family.*`, `v9.sponsor.*` (parents read these).
- Visa route (`visaroute:*`): caveats, method notes (dates, windows), document names (پولیس کریکٹر سرٹیفکیٹ، عدم اعتراض نامہ (NOC)،
  پولیو ویکسینیشن سرٹیفکیٹ for the Karachi office), posts and `why.*`.
- Legalization: `student:legalFlow.*`, `dossier:*` (اپوسٹل vs. قونصلر قانونی تصدیق، نوٹری تصدیق، مصدقہ ترجمہ).
- Submission authorization: `success:submission.authorize.*` (who submits, withdrawal, never sharing a portal password).
- Arrival: `concierge:*` (residence card 90-day rule, 15-day address report, NHIS start, lease-check disclaimer, 119/112).
- Verdict strings listed above, checked against docs/STATE_MAP.md.

No screenshots: browsers are off for translator agents. The coordinator's leak-check run is the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 3 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 3 / 3 / 5 | 5 / 4 / 5 / 4 / 5 |
| D. Parent 50–65, low digital confidence | 4 / 4 / 4 / 3 / 4 | 4 / 4 / 4 / 4 / 4 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- B and C, trust 3: `common:tier.COMPETITIVE` («مسابقتی میچ») and `common:tier.REACH` («مشکل ہدف») did not match STATE_MAP and
  disagreed with the new `student:verdict.*` strings, so the same programme could carry two different labels.
- C, action clarity 3: `student:v4.offer.pay` read «آپ … ادا کریں گے» ("you will pay"), which sounds like a forecast, not an
  obligation with a deadline. Now «آپ کو {{date}} تک … ادا کرنے ہیں» ("you have to pay … by {{date}}").
- D, action clarity 3: Latin official names (Korea Visa Application Center, Naver Map) appeared on visa/document
  screens; the Dhaka centre and the map link are now in Urdu script. «سیٹنگز» vs. the existing «ترتیبات» was inconsistent.

## Issues found and fixed (`ur-13.json`)

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | مسابقتی میچ → ممکنہ میچ | STATE_MAP: Possible match |
| `common:tier.REACH` | مشکل ہدف → ابھی اہل نہیں | STATE_MAP: Not eligible yet |
| `student:v4.offer.pay`, `v4.offer.payNoDate` | آپ … ادا کریں گے → آپ کو … ادا کرنے ہیں | Obligation, not a forecast (money + deadline) |
| `student:profileV3.unlock.language_*` | «جو ابھی ”ابھی اہل نہیں“ ہے» → «جس پر اس وقت ”ابھی اہل نہیں“ لکھا ہے» | Double «ابھی» read as a typo |
| `student:settings.title`, `dossier:v9.who.manage` | سیٹنگز → ترتیبات | Match the existing `common:nav.settings` |
| `student:home.comingUp` | آنے والا → جلد آنے والے | A bare adjective with no noun |
| `visaroute:post.centre`, `student:v9.visa.methodNote.VISA_CENTRE_DHAKA` | Korea Visa Application Center → کوریا ویزا ایپلیکیشن سینٹر | Latin text on an Urdu screen |
| `student:university.campus.naver` | Naver Map میں کھولیں → Naver نقشے میں کھولیں | Same |
| `student:onboarding.education.institutionPh` | Hanoi National University → ہنوئی نیشنل یونیورسٹی | Same (example placeholder) |

## Terminology

| English | ur |
|---|---|
| Strong match / Possible match | مضبوط میچ / ممکنہ میچ |
| Not eligible yet (one step away) | ابھی اہل نہیں (بس ایک قدم دور) |
| Needs your grades | آپ کے گریڈز درکار ہیں |
| Your counselor | آپ کا کونسلر |
| Offer / accept the offer | آفر / آفر قبول کریں |
| (Standard) admission letter / certificate of admission | (معیاری) داخلہ لیٹر |
| Tuition / application fee | ٹیوشن فیس / درخواست فیس |
| Apostille / consular legalization | اپوسٹل / قونصلر قانونی تصدیق |
| Notarization / certified translation | نوٹری تصدیق / مصدقہ ترجمہ |
| Bank balance certificate / bank statement | بینک بیلنس سرٹیفکیٹ / بینک اسٹیٹمنٹ |
| Family relationship certificate | خاندانی تعلق کا سرٹیفکیٹ |
| Criminal record certificate | کریمنل ریکارڈ (پولیس کریکٹر) سرٹیفکیٹ |
| Residence card | رہائشی کارڈ |
| Immigration office | امیگریشن دفتر |
| Visa issuance certificate (CCVI) | ویزا اجرا کا سرٹیفکیٹ (CCVI) |
| e-visa | ای ویزا |
| Sponsor | کفیل |
| Post (embassy/consulate) | دفتر (سفارت خانہ / قونصل خانہ) |
| Personal statement / study plan | ذاتی بیان / تعلیمی منصوبہ |
| Essay / reviewer | مضمون / جائزہ کار |
| Document vault | دستاویزات کا والٹ |
| Waitlisted | انتظار کی فہرست میں |
| Deposit (housing) | ڈپازٹ |
| Dormitory | ہاسٹل |
| Deadline / due by {{date}} | آخری تاریخ / {{date}} تک |

## Residual risks (what a native human reviewer should check first)

1. **«ہاسٹل» for dormitory.** It is the existing ur term and what Pakistani students say, but a parent may picture a private
   hostel rather than university housing. «یونیورسٹی ہاسٹل» is used where the distinction matters (`housingOpt.DORM`, `housing.opt.DORM`).
2. **Korean administrative terms**: the certification tiers «ایکسیلنٹ» / «سرٹیفائیڈ» / «کنسلٹنگ» (kept as transliterations in
   quotes), «یونیورسٹی کی کاروباری رجسٹریشن», group residence-card filing. Check against the Urdu pages of the Korean Embassy in
   Islamabad, if any.
3. **Money sentences**: `v9.funds.*`, `v9.money.note.NHIS_*`, `v9.guard.text`, `v9.refund.*`, `v4.offer.*`. Each was checked against
   the English; a parent reviewer should confirm «دکھانی ہے (ادا نہیں کرنی)» is unmistakable.
4. **Gender**: first-person buttons use «گیا/گئی», «رہا/رہی», «دیتا/دیتی» slash forms; the counselor is masculine generic
   («کونسلر … کر رہا ہے»), universities and agencies are feminine («یونیورسٹی … کرے گی»). Correct only when the placeholder is a
   university/agency name.
5. **Loanwords vs. pure Urdu**: کونسلر، آفر، اپ لوڈ، ڈپازٹ، پک اپ are kept because the existing ur strings use them and students
   expect them. A 50–65 parent with little English may prefer «مشیر»، «پیشکش». Check with a real reader.
6. **Website-only strings outside the todo**: `marketing:matching.p1` and one other marketing line still say «مضبوط، مسابقتی یا مشکل
   ہدف». They mirror the English marketing copy ("strong, competitive or reach"), so they were left alone; the website team should
   align them with STATE_MAP.
