# V28 English copy review (brief §33, §38, §44–§46)

The English bundle is the source for 33 translations, so this pass fixes the English first.
Patch: `scripts/i18n/v28/en-copy-patch.json`, in the format `{ ns: { "dotted.key": { "en": "…" } } }`.
The bundles in `packages/i18n/locales/en/*.json` were **not** edited. `node scripts/i18n/v23-set.mjs scripts/i18n/v28/en-copy-patch.json --dry` reports 96 string changes in 10 files.

## Scope

- **A set**: `docs/qa/v28/l10n/keys-A.txt`. These are the 1,740 customer-facing keys: the marketing site and the student web and mobile apps.
- **B set**: `docs/qa/v28/l10n/keys-B.txt`. These are the 851 keys in the agency and university consoles.
- **The V27 meaning issues** named in the brief. Six of the eight keys are outside both lists. They are patched because the brief names them.

## Method

1. Every in-scope string was dumped together with its Korean source and the surfaces it renders on (`docs/qa/v28/l10n/rendered-keys.json`). Each string was then read by hand.
2. A scan flagged British spellings: programme, enrol/enrolment, -ise/-isation, centre, labelled, counselling, ageing, harbours, neighbourhoods, "tick".
3. A second scan flagged these patterns:
   - "journey", "support", "unlock"
   - "It is possible", "You can check", "Please proceed"
   - generic marketing words
4. Strings that were already clear, native and short were left alone. Most of the bundle had been cleaned in V27, so this pass is deliberately small.
5. Validation was run over all 96 entries. Result: **0 errors**. The checks were:
   - every key exists in the en bundle and is a string
   - every key is in keys-A or keys-B, or is one of the named meaning fixes
   - `{{placeholders}}`, `$t(...)` and tags are identical as multisets
   - the newline count is unchanged
   - no `marketing` `v11.*` key, and no key path containing `privacy`, `terms` or `consent`
   - no new em dash
   - no entry is identical to its source
   - every `_one` / `_other` sibling set is patched together (no edit touches a plural key)

### Conventions applied

- **American spelling:**
  - program (not programme)
  - enroll, enrolls, enrollment
  - organization
  - counseling
  - aging
  - labeled
  - center
  - harbors, neighborhoods
  - "dormitories" for "halls of residence", "apartments" for "flats"
  - "Select" for "Tick"
- **Plain words for jargon:**
  - "file … as a group" and "is filing for me" become **apply**.
  - "papers" becomes **documents**.
  - "Proof of money" becomes **Proof of funds**.
  - "Confirmations" (확인 절차) becomes **Legalizations**.
- **"support" overuse:** the dormitory row and scope labels are now just **Dormitory**. Premium f5 reads "30 days of help settling in".
- **Empty states:**
  - `student:scholarships.empty` now says what to do.
  - `writing:queue.empty.first` uses the same term as its "Needs first review" filter.
- **Console copy:** idioms such as "gone quiet", "leaver" and "Deep data" become operational wording.

### Excluded or left unchanged on purpose

- **`marketing` `v11.*` (owner-gated):** these 49 in-scope keys keep "programmes", "counselling", "maximises" and "alien registration". The owner needs to change them.
- **Legal copy:** `privacy`, `terms` and `consent` keys keep their British spellings (notarised, pseudonymised, cancelling, counsellor). There are 236 such keys in A and 1 in B.
- **Unresolved keys:** 28 scope keys do not resolve to a string in their namespace. There are 15 in A and 13 in B. Examples are `common:compare.bestTag.year`, `common:v26.now.empty.*_support`, `common:v9.visa.caveat.*` and `common:waiting.reason.*`. The key recorder logged the default namespace, and the strings live in `student` or `agency`. They were not patched.
- **The `{{programmes}}` placeholder** in `common:uni27.intl.gks` is a variable name and stays as it is.
- **Proper names and official terms:** IEQAS, HiKorea, NHIS, KIIP, King Sejong Institute, "Mail-order business registration number" (the statutory term), and the staff-only "post" in `visaroute:staff.*`.
- **Plural keys where only `_other` is in scope:** for example `student:v9.funds.longer_other` and `success:block.title_other`. They were not touched, so that the singular and plural forms never drift apart.

## Counts per surface

"Strings" counts the keys that resolve to a string. "Excluded" counts the owner-gated `v11` keys and the legal keys. "Rewritten" counts the entries in the patch.

| Surface | Set | Namespaces | Strings | Excluded | Rewritten |
|---|---|---|---:|---:|---:|
| Marketing site | A | marketing | 438 | 252 | 19 |
| Student app (web + mobile) | A | common, concierge, dossier, student, success, visaroute, writing | 1,287 | 33 | 33 |
| Agency console | B | agency | 408 | 0 | 14 |
| University console | B | university | 271 | 1 | 18 |
| Console shared strings | B | common, concierge, dossier, visaroute, writing | 159 | 0 | 4 |
| **In-scope total** | | | **2,563** | **286** | **88** |
| Named V27 meaning fixes outside the lists | | marketing ×4, common, concierge, visaroute, mobile | | | 8 |
| **Patch total** | | | | | **96** |

The table below counts by rendered app, using `rendered-keys.json`. A key can render in more than one app.

| App | In-scope keys rendered | Rewritten keys rendered |
|---|---:|---:|
| marketing | 556 | 19 |
| student | 770 | 17 |
| student_visa | 407 | 16 |
| student_arrived | 202 | 4 |
| student_public | 131 | 0 |
| agency | 624 | 18 |
| university | 366 | 19 |

Rewrites per namespace:

| Set | Namespace | Rewritten |
|---|---|---:|
| A | marketing | 19 |
| A | student | 14 |
| A | visaroute | 13 |
| A | concierge | 4 |
| A | dossier | 2 |
| B | university | 18 |
| B | agency | 14 |
| B | writing | 2 |
| B | common | 1 |
| B | visaroute | 1 |

## Word count

Words are whitespace tokens with HTML tags removed, counted over every A string that resolves. Excluded keys are counted unchanged.

| Set | Before | After | Change |
|---|---:|---:|---:|
| A (customer-facing) | 10,887 | 10,891 | +4 (+0.04 %) |
| B (consoles) | 2,764 | 2,775 | +11 |

The only deliberate addition in A is the "what to do" sentence in `student:scholarships.empty` (+6). All the other A rewrites together come to −2 words.

## 40 representative rewrites

| # | Namespace · key | Problem | Before | After |
|---|---|---|---|---|
| 1 | `marketing` · `v10.services.housing.p2` | meaning: 'key money' (권리금) is a commercial-lease term; ko says 보증금·월세 | What a deposit, key money and monthly rent actually are | What a deposit and monthly rent actually mean |
| 2 | `common` · `task.visa.other_passport_record` | unclear document name (ko 여권 발급 기록) | Get your passport record | Get your passport issuance record |
| 3 | `visaroute` · `doc.other_passport_record.name` | unclear document name (ko 여권 발급 기록(외교부 발급)) | Record of passport (from the Ministry of Foreign Affairs) | Passport issuance record (from the Ministry of Foreign Affairs) |
| 4 | `concierge` · `pickup.handle` | ambiguous 'ID or number' (field follows the KakaoTalk/WhatsApp picker) | Your ID or number | Your username or phone number on that app |
| 5 | `marketing` · `journey.eyebrow` | 'journey' cliché | Student journey | Step by step |
| 6 | `marketing` · `v6.unis.title` | 'journey' cliché | Universities worth the journey. | Universities across Korea. |
| 7 | `marketing` · `v9.faq.languagesA` | 'journey' cliché | The website is available in many languages. The student app is offered in a language only when every screen of the student journey is translated and checked for leftover English. All translations except English are machine translations; some have had an automated review, none has yet been reviewed by a person. You can switch to English at any time. | The website is available in many languages. The student app is offered in a language only when every screen students use is translated and checked for leftover English. All translations except English are machine translations; some have had an automated review, none has yet been reviewed by a person. You can switch to English at any time. |
| 8 | `mobile` · `v3.uni.decisionNow` | all caps read as an acronym by MT | DECISION | Decision |
| 9 | `marketing` · `v20.uni.ctaBody` | British spelling (programme) | Sign in and Hangyul will show you which programmes here are open to you, what documents you need, and in what order. | Sign in and Hangyul will show you which programs here are open to you, what documents you need, and in what order. |
| 10 | `visaroute` · `form.field.program` | British spelling (programme) | Programme | Program |
| 11 | `student` · `v9.money.payee.EMBASSY` | British spelling (centre) | To the Korean embassy or visa centre | To the Korean embassy or visa center |
| 12 | `concierge` · `housing.honest` | British spelling (labelled); clumsy order | We only show dormitory facts with their source, and rooms a provider has actually given us, each labelled. We never invent listings. | We show only dormitory facts with a source, and only rooms a provider has actually offered, each labeled. We never invent listings. |
| 13 | `marketing` · `v20.city.Gyeongnam.line` | British spelling (harbours) | The industrial south coast: Changwon's factories and Tongyeong's harbours. | The industrial south coast: Changwon's factories and Tongyeong's harbors. |
| 14 | `agency` · `v11.manage.org` | British spelling (organisation) | Organisation | Organization |
| 15 | `agency` · `v27.stage.ADMIT` | British spelling (enrolment) | Offer & enrolment | Offer & enrollment |
| 16 | `agency` · `v8.ops.ageing.title` | British spelling (ageing) | Case ageing by stage | Case aging by stage |
| 17 | `university` · `v22.in.q.admit` | British spelling (enrols) | Who gets admitted and enrols? | Who gets admitted and enrolls? |
| 18 | `university` · `v22.stage.enrolment` | British spelling (enrolment) | Enrolment | Enrollment |
| 19 | `agency` · `review.verifyHint` | British idiom ('tick') | Tick the checks first, or confirm to verify without them | Select the checks first, or confirm to verify without them |
| 20 | `dossier` · `check.title` | two-sentence heading | We found this information. Please check it. | Check what we found |
| 21 | `dossier` · `reason.ESSAY_TO_WRITE` | 'Write it in Writing' reads as a typo | Write it in Writing first. | Write it in the Writing section first. |
| 22 | `concierge` · `residence.useGroup` | jargon ('filing') | My university is filing for me | My university is applying for me |
| 23 | `marketing` · `v20.uni.whyTitle` | literal Korean heading (어떤 학교인가요) | What this university is | What makes it different |
| 24 | `marketing` · `v20.uni.why.foundedBody` | sentence fragment ('Which makes…') | Which makes it one of the longer-established institutions on this register. | That makes it one of the older institutions on the register. |
| 25 | `marketing` · `v15.pricing.lede` | fragment list; 'how far we support you' | A diagnosis, the applications, or settling in after you arrive. Choose how far we support you. | Choose how much help you want: an initial assessment, your applications, or settling in after you arrive. |
| 26 | `marketing` · `v15.pricing.premium.f5` | dot-joined nouns; 'support' | Dormitory · arrival · 30 days of settling-in support | Dormitory, arrival and 30 days of help settling in |
| 27 | `student` · `scholarships.empty` | empty state does not say what to do | No scholarships to show yet. | No scholarships to show yet. Complete your profile to check which fit you. |
| 28 | `student` · `v16.pay.chooseSubtitle` | awkward ('do with you') | Choose the plan that fits what you want Hangyul to do with you. One payment, no subscription. | Choose the plan that matches how much help you want from Hangyul. One payment, no subscription. |
| 29 | `student` · `v9.announced.rule.STUDY_DEPOSIT_SCHEME` | ambiguous ('without Korean'); passive fragment | Students without Korean from some countries would deposit study money in a bank, released each semester. | Students from some countries without a Korean test result would deposit study funds in a bank, paid out each semester. |
| 30 | `student` · `v26.now.owner.STUDENT` | idiom ('On you') | On you | You |
| 31 | `visaroute` · `step.apply.why` | idiom ('hand in your pack') | Hand in your pack, then note the receipt number here. | Submit your documents, then enter the receipt number here. |
| 32 | `visaroute` · `step.slow_items.why` | unclear ('confirmations') | Confirmations, the TB test and police certificates take weeks. | Legalizations, the TB test and police certificates take weeks. |
| 33 | `visaroute` · `money.title` | nonstandard ('proof of money') | Proof of money | Proof of funds |
| 34 | `visaroute` · `form.source.missing` | reads as 'not inside Hangyul' | Not in Hangyul | Not on file |
| 35 | `agency` · `v25.today.student_silent` | idiom ('gone quiet') | students gone quiet | students not responding |
| 36 | `agency` · `v8.ops.deadlines.q` | ungrammatical ('still miss') | Applications due within {{count}} days that still miss required items. | Applications due within {{count}} days that are still missing required items. |
| 37 | `agency` · `v9.ops.unpaid.q` | awkward clause | Who paid for a service and has nobody owning their case? | Which students have paid for a service but have no case owner? |
| 38 | `university` · `v22.manage.teamManage` | British idiom ('leaver') | Hand over a leaver's applicants | Reassign a departing member's applicants |
| 39 | `university` · `v25.in.yield` | unclear ('Enrolled of offers') | Enrolled of offers | Offers that led to enrollment |
| 40 | `university` · `kpi.insufficientDetail` | cryptic shorthand | Based on {{n}} records; shown from {{min}} | Based on {{n}} records. Shown once there are {{min}}. |

## Decisions to confirm

1. **`marketing:v10.services.housing.p2`**: the Korean source is 보증금·월세 (deposit and monthly rent). It does not mention 관리비, so the line now reads "deposit and monthly rent". "Maintenance fee" was not added. If the maintenance fee should be mentioned, change the Korean source as well.
2. **`concierge:pickup.handle`**: this field appears after the "How to reach you on arrival day" picker (KakaoTalk, WhatsApp …) in `apps/student-web/src/pages/Arrival.tsx`. It now reads "Your username or phone number on that app". The Korean 아이디 또는 번호 has the same ambiguity and could be aligned, for example to 해당 앱의 아이디 또는 전화번호.
3. **`visaroute:doc.other_passport_record.name`**: "Passport issuance record (from the Ministry of Foreign Affairs)" is a literal reading of 여권 발급 기록(외교부 발급) for Thai applicants. Please check the embassy's own English name for this document.
4. **`visaroute:step.slow_items.why`**: I read 확인 절차 ("Confirmations") as legalizations or apostilles, which is how V27 names consular confirmation. **(rewritten, please confirm)**
5. **`marketing:v20.uni.why.ieqasBody`**: "assessed against relaxed visa criteria" now reads "face simpler visa screening". **(rewritten, please confirm)**
6. **`university:v22.stageHint.decision`**: the V27 wording "Your university still needs to decide" was odd inside the university's own console. It now reads "Waitlisted. A decision is still pending".
7. **The 28 unresolved scope keys** listed above should be re-recorded with their real namespace, so that a future pass can reach them.
8. **`marketing.v11.*` and the legal keys** still carry British spellings. Changing them needs the owner and legal sign-off.
