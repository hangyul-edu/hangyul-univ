# Filipino (fil) — V9 student localization review

**synthetic review by an AI model — not a human review**

- Date: 2026-10-10; updated 2026-10-14 after the leak check
- Model: Claude Opus 5.5 (claude-opus-5-5[1m]), translator agent for `fil` (PIPELINE.md steps 0–3 and 5; step 4 leak check left to the coordinator)
- Status: NOT human-reviewed. Do not set `status` to `HUMAN_REVIEWED` on the basis of this record.
- Result: `v9-todo fil` → web 3,652 / 3,652 (0 missing, 0 identical, 0 stale); `v9-todo fil --native` → 4,160 / 4,160 (0 / 0 / 0).
- Data files: `scripts/i18n/v9-data/fil-1.json` … `fil-11.json` (translation), `fil-review.json` (revisions below). About 230 values are recorded as `_identical_ok`. These are city and airport names, test names (TOPIK, IELTS, TOEFL iBT), plan names (Free Explorer, Application Support, Premium Success), messenger names, Korean region names, and English terms that Filipinos normally use in school and government papers: Visa, Interview, Intake, Budget, Application fee, Tuition, Residence card, Admission letter, Bachelor's/Master's degree, Doctorate, Health insurance (NHIS), Transcript of records, Passport photo, TB certificate.
- Register: polite but direct "ka / mo / iyong". This matches the existing `fil/common.json`. The student app never uses the B2B "kayo / ninyo" register that `marketing.json` uses for universities and agencies. Taglish appears only where Philippine schools, DFA, embassies and banks use the English term: tuition, deadline, counselor, scholarship, apostille, visa, upload, bank certificate, money changer, application fee. Everything else is in Filipino: aplikasyon, alok, dokumento, pasaporte, tirahan, dormitoryo, deposito, sanaysay, borador, kinakailangan, nakalathala.

## Sample read

- This agent wrote all 3,819 to-do strings in key order (10 chunks of about 300–440 keys) and read each one against the English while writing it. The namespaces were common, student, dossier, success, writing, visaroute, concierge and mobile.
- Second pass, read as the four profiles:
  - STATE_MAP strings: `student:start.*`, `discover.*`, `verdict.*`, `universityV2.verdictLine.*`, `v4.verdictText.*`, `success:group.*`, `success:obs.*`, `mobile:v3.match.*`, `v3.quick.*`.
  - Money: all of `student:v9.money.*`, `v9.funds.*`, `v9.guard.*`, `v9.refund.*`, `budget.*`, `v4.offer*`, `ws3.tuition.*`, `services*`, `success:submission.fee.*` and `submission.authorize.*`.
  - Family and sponsor: `v9.family.*`, `v9.sponsor.*`.
  - Visa: `visaroute:caveat.*`, `cond.*`, `methodNote.*`, `reason.*`.
  - Housing and arrival: `concierge:residence.*`, `lease.*`, `pickup.*`.
  - Application status: `common:notify.application.*`.
  - In total about 700 strings.
- Automated checks over the whole locale:
  - Admission-odds and reassurance words ("tsansa", "garantiya", "sigurado", "huwag mag-alala"). Every hit mirrors the English (`noProbability`, `notGuarantee`, `guaranteeTitle`, "Hindi sigurado?" = "Not sure?").
  - Register drift ("po", "kayo", "ninyo"). None in student namespaces.
  - Leftover English function words. Only official names remain (Ministry of Foreign Affairs, Test of Proficiency in Korean, Transcript of records).
  - Leftover "family link". None.
  - "matrikula" vs "tuition" drift. Fixed, see below.
- Screens: none. This agent did not run a browser (brief: no browsers; the coordinator runs the leak check).

## STATE_MAP check

These are checked against the existing fil strings. Before this pass, `common:tier.COMPETITIVE` = "Competitive na tugma" and `common:tier.REACH` = "Reach". Both broke STATE_MAP and are now fixed.

| Key | English | fil | STATE_MAP group |
|---|---|---|---|
| `student:verdict.STRONG`, `common:tier.STRONG` | Strong match | Malakas na tugma | Strong match (kept from existing fil) |
| `student:verdict.COMPETITIVE`, `common:tier.COMPETITIVE` | Possible match | Posibleng tugma | Possible match (was "Competitive na tugma") |
| `student:verdict.REACH`, `common:tier.REACH` | Not eligible yet | Hindi pa kwalipikado | Not eligible yet (one step away), not "reach" (was "Reach") |
| `student:verdict.NOT_ELIGIBLE`, `common:tier.NOT_ELIGIBLE` | Not eligible yet | Hindi pa kwalipikado | Not eligible yet (kept from existing fil) |
| `student:discover.verdict.eligible / reach / notyet / check` | Strong / Possible / Not eligible yet / Needs your grades | Malakas na tugma / Posibleng tugma / Hindi pa kwalipikado / Kailangan ang iyong grades | same |
| `student:start.tier.POSSIBLE`, `mobile:v3.quick.tier.POSSIBLE` | One step away | Isang hakbang na lang | Not eligible yet (one step away). Does not reuse the *Possible match* term |
| `mobile:v3.match.close` | Not eligible yet — close | Hindi pa kwalipikado — malapit na | same |
| `success:group.strong / possible / not_yet` | Strong / Possible match / Not eligible yet | Malakas na tugma / Posibleng tugma / Hindi pa kwalipikado | same |

`common:eligibility.POSSIBLE` ("Possibly eligible" → "Posibleng kwalipikado") is the scholarship eligibility scale, not the match tier. It was left as is.

## Scores (1–5): comprehension / naturalness / trust / action clarity / tone

| Profile | Before revisions | After revisions |
|---|---|---|
| A. Student 18–20, first time abroad | 5 / 4 / 4 / 5 / 4 | 5 / 4 / 4 / 5 / 4 |
| B. Graduate applicant 23–29 | 4 / 4 / 4 / 4 / 4 | 5 / 4 / 4 / 4 / 4 |
| C. Parent 35–49, pays tuition | 3 / 3 / 4 / 4 / 4 | 4 / 4 / 5 / 4 / 4 |
| D. Parent 50–65, low digital confidence | 3 / 3 / 4 / 4 / 4 | 4 / 4 / 4 / 4 / 4 |

**Minimum after revisions: 4.**

Scores below 4 before revisions:
- **C and D, comprehension 3.** Two words were used for the same money. Existing `common:task.payTuition` / `task.visa.tuition_receipt` said "matrikula", while every money screen says "tuition". Also, the STATE_MAP tiers inherited from the existing locale ("Competitive na tugma", "Reach") read as admission-odds wording and contradicted the student verdict labels.
- **C and D, naturalness 3.** All 21 `common:notify.application.*` messages had a stiff, word-for-word order ("ang status ng aplikasyon ay “…” na"). The application status WITHDRAWN said "Umatras" ("retreated"), but the student screens say "Binawi". "Family view" and "Family link" were left in English on the page that parents themselves open.

## Issues found and fixed

| Key | Before → After | Why |
|---|---|---|
| `common:tier.COMPETITIVE` | Competitive na tugma → Posibleng tugma | STATE_MAP: *Possible match*, never "competitive". |
| `common:tier.REACH` | Reach → Hindi pa kwalipikado | STATE_MAP: *Not eligible yet*. English left in a label, and "reach" suggests odds. |
| `common:notify.application.*` (21 keys) | "{{university}}: ang status ng aplikasyon ay “X” na" → "{{university}}: “X” na ang status ng aplikasyon" | Natural Filipino word order. |
| `common:appStatus.WITHDRAWN`, `notify.application.WITHDRAWN` | Umatras → Binawi | Now matches `student:stage.WITHDRAWN` and the "Bawiin ang aplikasyon" button. |
| `common:task.payTuition`, `common:task.visa.tuition_receipt` | matrikula → tuition | One word for one payment across the app. |
| `student:v9.family.*` (nav, title, link labels and texts) | Family view / family link → Pahina para sa pamilya / link para sa pamilya | Parents read this page. No English in its name. |
| `concierge:housing.*` partner housing | Partner housing → Tirahan mula sa partner | Plain words. |
| `concierge:pickup.meeting` (+2 texts) | Meeting point → Tagpuan | Plain words for an arrival-day instruction. |
| `common:task.visa.criminal_record` | (draft added "hal. NBI clearance") → "Kumuha ng sertipiko ng criminal record" | The draft added a document name that the English does not state. Visa sentences must not add requirements. |
| `student:dashboard.nextAction.COMPARE_OFFERS.text` | reworded | The draft turned "accepting one offer is a decision to tell the others" into a stronger obligation. |
| `common:task.visa.tb_test` | (English source "tB certificate") → TB certificate | Fixed the casing slip; no claim added (not "TB-free"). |

## Terminology (fil)

| English (STATE_MAP / core) | fil |
|---|---|
| Strong match | Malakas na tugma |
| Possible match | Posibleng tugma |
| Not eligible yet (one step away) | Hindi pa kwalipikado (Isang hakbang na lang) |
| Needs your grades | Kailangan ang iyong grades |
| Counselor / reviewer | counselor / reviewer (tagasuri) |
| Application / apply | Aplikasyon / mag-apply |
| Offer / offer received / offer accepted | Alok / Nakatanggap ng alok / Tinanggap ang alok |
| Withdraw / withdrawn | Bawiin / Binawi |
| Standard admission letter | Standard na admission letter |
| Tuition / application fee | Tuition / application fee |
| Money you must show (not pay) | Perang dapat mong ipakita (hindi babayaran) |
| Bank balance certificate / bank statement | Bank certificate ng balanse / bank statement |
| Apostille / consular legalization / certified translation | apostille / consular legalization / sertipikadong salin |
| Residence card | residence card |
| Deposit (housing) | deposito |
| Document vault | document vault |
| Essay / draft | sanaysay / borador |
| Deadline | deadline |
| Published requirement | nakalathalang kinakailangan |

## Residual risks (what a native reviewer should check first)

1. **Taglish balance.** "Tuition", "deadline", "counselor", "scholarship", "upload" and "application fee" stay in English, as in Philippine school and DFA usage. A reviewer should confirm that a 50–65-year-old parent outside Metro Manila reads them easily, and decide whether "matrikula" is preferred after all. If so, apply it everywhere, not in a few keys.
2. **"Kailangan ang iyong grades"** (Needs your grades). "Grades" is Taglish; "marka" is the Tagalog alternative. Pick one and keep it consistent with `PROFILE_UNLOCK.gpa.*`.
3. **Visa wording.** "Hindi pa kwalipikado" for REACH/NOT_ELIGIBLE should be checked against how embassies phrase "not eligible". The same goes for "consular legalization" / "consular confirmation", which are left in English, and "sertipiko ng ugnayang pampamilya" for the Korean 가족관계증명서.
4. **Example placeholders.** `onboarding.education.institutionPh` uses "University of the Philippines", and `onboarding.sponsor.goalPh` says "Korean at Pilipino". Both were localized examples, not translations; confirm this is wanted.
5. **Long sentences in `visaroute:caveat.*` and `v9.funds.*`.** They are precise but dense. A human should check them on a phone at 390 px (leak check and screenshots are pending, run by the coordinator).
6. **Existing pre-V9 fil strings** (`common.json`, `marketing.json`) were not re-reviewed apart from the STATE_MAP tiers, notify, WITHDRAWN and tuition keys listed above.

## Update 2026-10-14: English leak cleanup

The coordinator's leak check on fil found 178 English text nodes (71 unique), because many values had deliberately stayed in English. The V9 rule allows English only for official proper nouns, so 672 values in common, student, dossier, success, writing, visaroute, concierge and mobile were translated through `v9-merge` (`fil-12.json`, `fil-13.json`). `{{placeholders}}` and `$t()` references were left untouched. `v9-todo` is still 0 for web and native, and the STATE_MAP terms are unchanged.

Terms that changed from English to Filipino: kard ng paninirahan (residence card), Segurong pangkalusugan / Pambansang Segurong Pangkalusugan (NHIS) (health insurance), liham ng pagtanggap (admission letter), visa ng estudyante, aplikasyon sa visa, porma ng aplikasyon, talaan (checklist), tagapayo (counselor), tagasuri ng dokumento (document reviewer), taguan ng dokumento (document vault), embahada / konsulado, legalisasyon / kumpirmasyon ng konsulado, numero ng resibo / kumpirmasyon, sundo sa paliparan, numero ng lipad, Pumasok / Lumabas (sign in / out), panayam (interview), mga marka (grades), marka (score), matrikula (tuition), bayad sa aplikasyon, account sa bangko. "TOPIK", "IELTS", "NHIS", "HiKorea", "D-2", "Hangyul Partner Scholarship" and university names stay as they are.

This reverses two earlier choices: "tuition" is now "matrikula", and "grades" is now "mga marka". These were open risks 1 and 2 below; both are now decided in favour of Filipino.

Residual risks added by this pass:
- Mechanical, term-based replacement can leave a stiff phrase. Examples: "Pumasok"/"Lumabas" for sign in/out (some Filipinos would say "mag-log in"), "numero ng lipad" for flight number, "sundo sa paliparan" for airport pickup. A native reviewer should read the sign-in, arrival and visa screens first.
- Words still in English on purpose: scholarship, deadline, upload, apostille, visa, e-visa, intake, password, dashboard, profile, and the brand name "Hangyul Partner Scholarship".
- `marketing.json` (public website) was not touched.
