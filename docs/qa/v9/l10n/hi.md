# Hindi (hi) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `hi`
- Status: NOT human-reviewed. `status` must not be set to `HUMAN_REVIEWED` on the basis of this record.
- Leak check (step 4): not run by this agent. The coordinator runs it.

## Scope

- Merged: `scripts/i18n/v9-data/hi-1.json` … `hi-10.json` (3,739 todo keys in 400-key chunks), `hi-11.json` (35 keys: 3 keys added
  to the manifest during the run, plus values kept identical to English), `hi-12.json` (13 revisions from this review).
- Result: `v9-todo hi` → web 3,652 keys, 0 missing / identical / stale. `--native` → 4,160 keys, 0 missing.
- Namespaces created: `student`, `dossier`, `success`, `writing`, `visaroute`, `concierge`, `mobile` (before this run hi had only `common` and `marketing`).
- Identical to English on purpose (`_identical_ok`): brand (`Hangyul`, `Hangyul Univ`), test names (IELTS, TOEFL iBT, TOPIK), GPA, PhD, MS–PhD, CV,
  messenger names (KakaoTalk, LINE, Telegram, WhatsApp, Zalo), Google Maps, and placeholder-only values (`{{status}}`, `{{amount}}`, `{{reason}}`,
  `{{min}}–{{max}}`, `{{post}} · {{method}}`, `{{name}} ({{org}})`, `—`).

## Register and terminology choices

The register is plain, polite Hindi with the आप form throughout. Where educated Indian speakers normally use an English loanword, we used the
loanword in Devanagari rather than a Sanskritised coinage: वीज़ा, काउंसलर, ट्यूशन फ़ीस, डॉर्मिटरी, डिपॉज़िट, ऑफ़र, प्रोफ़ाइल, अपलोड, ड्राफ़्ट,
इंटरव्यू, एपोस्टिल, रेज़िडेंस कार्ड. These terms were already used in `hi/common.json` and `hi/marketing.json`, and we reused them as they stand.
Formal Hindi was kept where parents expect it in official contexts: दूतावास, प्रवेश पत्र, प्रमाणपत्र, छात्रवृत्ति, सत्यापन, पात्र.

## Sample read

All translated keys were read in context while writing, in 400-key chunks ordered by namespace. A second, focused pass covered the following:

- Verdicts in every surface: `student:verdict.*`, `student:discover.verdict.*`, `student:start.tier.*`, `success:group.*`, `mobile:v3.match.*`,
  `mobile:v3.quick.tier.*`, `student:universityV2.verdictLine.*`, `student:v4.verdictText.*`, `mobile:v3.discover.explain.*`. Each was checked against docs/STATE_MAP.md.
- Money: `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `student:budget.*`, `v4.offer.*`, `ws3.tuition.*`, `success:submission.fee.*`, `concierge:lease.*`.
- Parent-facing pages: `student:v9.family.*` and `student:v9.sponsor.*`.
- Visa: `visaroute:*` (caveats, document reasons, method notes, timing), `student:legalFlow.*`, `student:v9.visa.*`, `student:v9.announced.*`.
- Who can see documents: `dossier:v9.who.*`. Submission authorization: `success:submission.authorize.*`.

No screenshots were taken because browsers are off for translator agents. The coordinator's leak-check screenshots are the screen-level check.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 5 / 5 / 5 | 5 / 4 / 5 / 5 / 5 |
| B. Graduate applicant 23–29 | 5 / 4 / 5 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| C. Parent 35–49, pays tuition | 4 / 4 / 4 / 4 / 5 | 5 / 4 / 5 / 5 / 5 |
| D. Parent 50–65, low digital confidence | 3 / 4 / 3 / 4 / 4 | 4 / 4 / 4 / 4 / 5 |

**Minimum after revisions: 4.**

Profile D scored 3 on comprehension and trust before revisions, for three reasons:
- Plan names were still in English (Latin script).
- “इनटेक” appeared bare in filter labels.
- One sentence carried a Latin acronym (CCVI) that was not in the English.

A further problem was that “विमान उतरेगा” read as a promise of a future landing, even on pages where the landing may already be past.

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `student:verdict.COMPETITIVE` | written as संभावित मैच (checked) | STATE_MAP: COMPETITIVE = *Possible match*. It was not mapped to *Strong match*, which is the common bug. |
| `student:verdict.REACH` | written as अभी पात्र नहीं (checked) | The English is “Not eligible yet”. It was not rendered as “possible”. |
| `visaroute:caveat.CCVI_TIER_UNKNOWN` | …प्रमाणपत्र (CCVI) दाखिल… → …प्रमाणपत्र दाखिल… | The acronym was not in the English, and it would have shown as a Latin leak. |
| `visaroute:cond.EXCELLENT_WAIVER`, `caveat.EVISA_TIER_UNKNOWN`, `student:v9.funds.waived/longer_*` | ‘excellent’/‘consulting’ → ‘उत्कृष्ट’/‘परामर्श’ वाली | No English words in the running text. |
| `student:services.*.name` | Free Explorer / Application Support / Premium Success → मुफ़्त एक्सप्लोरर / एप्लिकेशन सपोर्ट / प्रीमियम सक्सेस | The names are now in Devanagari, so older parents can read them. Other locales also localise these names. |
| `student:explore.filters.intake`, `start.intake`, `programV3.intake`, `university.deadlines.intake`, `mobile:v3.university.intake` | इनटेक → प्रवेश सत्र (इनटेक) | Gives a plain meaning first. The loanword is kept because students meet it on university sites. |
| `student:v9.sponsor.landing`, `dashboard.arrival.landing` | विमान उतरेगा → विमान उतरने का समय/की तारीख | Neutral about tense, and does not read as a guarantee. |
| `student:home.season` | आवेदन का मौसम → आवेदन का समय | “मौसम” (weather or season) reads as a calque. |
| `student:matches.reasonKind.met` | पूरी → पूरी हुई | The bare adjective was ambiguous. |
| `student:v9.family.days` | कितने दिन चले → कितने दिन चलेगा | Grammar. |
| `visaroute:question.hukou`, `concierge:pickup.handle` | hukou / ID → हुकोउ / आईडी | Removes Latin words that were not needed. |

## Terminology (STATE_MAP and key terms in hi)

| English | Hindi |
|---|---|
| Strong match | मज़बूत मैच |
| Possible match | संभावित मैच |
| Not eligible yet | अभी पात्र नहीं |
| Not eligible yet — one step away / One step away | अभी पात्र नहीं — बस एक कदम दूर / बस एक कदम दूर |
| Needs your grades | आपके ग्रेड चाहिए |
| Your counselor | आपका काउंसलर |
| Tuition | ट्यूशन फ़ीस |
| Admission letter / certificate | प्रवेश पत्र / प्रवेश प्रमाणपत्र |
| Residence card | रेज़िडेंस कार्ड |
| Immigration office | इमिग्रेशन कार्यालय |
| Embassy / consulate / post | दूतावास / कांसुलेट / कार्यालय |
| Apostille / consular legalization | एपोस्टिल / कांसुलर सत्यापन |
| Family relationship certificate | पारिवारिक संबंध प्रमाणपत्र |
| Bank balance certificate / statement | बैंक बैलेंस प्रमाणपत्र / बैंक स्टेटमेंट |
| TB certificate | TB (टीबी) प्रमाणपत्र |
| Dormitory | डॉर्मिटरी |
| Sponsor | प्रायोजक |
| Refund | रिफ़ंड / पैसा वापस |
| Proof of money (show, not pay) | दिखाने वाली रकम (चुकानी नहीं है) |
| Application statuses | identical to `common:appStatus.*` |

## Residual risks (what a native reviewer should check first)

1. **Shared `common:tier.*` strings.** `common:tier.COMPETITIVE` = प्रतिस्पर्धी मैच and `REACH` = चुनौतीपूर्ण follow the English “Competitive match” / “Reach”,
   not the STATE_MAP wording. These keys were done before this run and are not in the manifest todo. If a student surface renders them, they
   conflict with संभावित मैच / अभी पात्र नहीं.
2. **Gendered first-person verbs.** Options such as “मैं पहुँच गया/गई हूँ” and “करता/करती हूँ” use slash forms. They are acceptable, but a reviewer
   may prefer gender-neutral rewrites.
3. **Tone of loanwords.** A Hindi-belt reviewer should confirm the mix suits parents aged 50–65 and say where a pure-Hindi gloss helps. The terms
   to check are रेज़िडेंस कार्ड, डिपॉज़िट, इनटेक, एपोस्टिल and कांसुलर सत्यापन.
4. **Money and visa wording.** The following sentences need a careful legal-precision read: the warning about putting in money only to get a
   certificate (`v9.funds.genuine`), refunds going only to the student's account, the 90-day residence-card rule, and the NHIS start dates.
5. **City names.** Chinese, Mongolian and Central Asian city names are transliterated from common Hindi usage. A reviewer should confirm
   उलानबातर, शीआन and चिंगदाओ.
6. **Leak check not yet run.** Expected Latin tokens are the brand, test names, NHIS, HiKorea, visa.go.kr, VFS Global, “Korea Visa Application
   Center” (official name), T-money and eSIM. Plan names and filter labels are no longer in Latin script.
