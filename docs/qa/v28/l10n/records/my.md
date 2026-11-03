# V28 l10n review — Burmese (my)

Scope: the 354 keys of `scripts/i18n/v28/jobs/my.json` → `scripts/i18n/v28/tx/my.json`. Unicode only: a Zawgyi scan
(ေ at the start of a word, U+1060–U+1097, U+1033/U+1034) has 0 hits. The register and glossary are the V27 ones
(`docs/qa/v27/l10n/my.md`): polite written Burmese with "-ပါ" requests and "-သည်" statements, the reader addressed as
သင်, Burmese numerals in prose and Latin digits for test levels and percentages. The job has no `fit.test.*` keys.
Burmese has only the CLDR `other` category, so each plural key gets one form with the classifier ခု.

## Personas

| Persona | Who | What they need from the copy |
|---|---|---|
| Hnin Wai, 18, Yangon (first-time visitor) | Matriculation passed, reading the home page and a university page for the first time | Plain, kind Burmese and a clear first step |
| Kyaw Zin, 26, Mandalay (comparison shopper) | Master's applicant comparing Hangyul with local agents and other universities | Exact visa and document terms, honest pricing, no promises of admission |
| Daw Moe, 38, Yangon agency counselor | Uses the agency console every day | Short, consistent console labels: တာဝန်ခံ, နောက်ဆုံးရက်, ရက်လွန် |

## Glossary (V27 terms reused, V28 additions marked +)

| English | Burmese | Note |
|---|---|---|
| the Hangyul team | Hangyul အဖွဲ့ | replaces every "your counselor" (အတိုင်ပင်ခံ / အကြံပေး) in student copy |
| scholarship | ပညာသင်ဆု | |
| GKS | ကိုရီးယား အစိုးရ ပညာသင်ဆု (GKS) | |
| admission guide | ဝင်ခွင့် လမ်းညွှန် | |
| apostille | အပိုစတီးလ် | |
| consular legalization | သံရုံး အတည်ပြုခြင်း | also "Legalizations" in slow_items.why |
| residence card | နိုင်ငံခြားသား မှတ်ပုံတင်ကတ် | |
| embassy / consulate | သံရုံး / ကောင်စစ်ဝန်ရုံး | console "Post" = သံရုံး |
| e-visa | e-visa | Latin, as on official sites (form.notice aligned) |
| deadline | နောက်ဆုံးရက် | |
| overdue + | ရက်လွန် | |
| owner (case/task) + | တာဝန်ခံ | |
| task + | လုပ်ငန်း | |
| consultation / counseling | အကြံပေးဆွေးနွေးမှု | one term for 상담 |
| program + | ပရိုဂရမ် | form.field.program changed from သင်တန်း |
| intake + | ဝင်ခွင့်ကာလ | |
| semester | စာသင်နှစ်ဝက် | |
| offer / acceptance / enrollment | ကမ်းလှမ်းချက် / လက်ခံမှု / ကျောင်းအပ်နှံမှု | |
| dormitory | အဆောင် | |
| international office | နိုင်ငံတကာရုံး | |
| receipt (visa) + | လက်ခံဖြတ်ပိုင်း | was ပြေစာ (a sales receipt) |
| police certificate + | ပြစ်မှုကင်းရှင်းကြောင်း ထောက်ခံစာ | |
| plan (pricing) + | အစီအစဉ် | |
| Needs more preparation (far tier) | ပြင်ဆင်ရန် ပိုလိုသည် | no "reach", no chance word |
| Recommended | အကြံပြု အစီအစဉ် | browsing order |

## Pass A — meaning (31 strings changed)

| Key | Before | After |
|---|---|---|
| common:fit.tier.CHALLENGE.lede | ကျွန်ုပ်တို့ သိသလောက် သင့်ကို တားဆီးမည့်အရာ မရှိပါ။ … | Hangyul သည် ဤအဆင့်အတွက် ဤတက္ကသိုလ်များ၏ စည်းကမ်းချက်များကို မစစ်ဆေးရသေးပါ။ … (the English now says "not verified yet") |
| common:fit.tier.UNCLEAR.title | ယခုအတွက် အလှမ်းဝေးသေးသည် | ပြင်ဆင်ရန် ပိုလိုသည် ("out of reach" → "needs more preparation") |
| student:v9.announced.rule.STUDY_DEPOSIT_SCHEME | ကိုရီးယားဘာသာ မတတ်သေးသော… | ကိုရီးယားဘာသာ စာမေးပွဲ ရလဒ် မရှိသော… ("cannot speak Korean" → "no Korean test result") |
| concierge:residence.groupUnknown | အုပ်စုလိုက် လျှောက်ပေးခြင်း ရှိမရှိ… | နိုင်ငံခြားသား မှတ်ပုံတင်ကတ်ကို အုပ်စုလိုက် လျှောက်ပေးခြင်း ရှိမရှိ… (the object was missing) |
| marketing:v6.unis.title | ခရီးနှင်ရကျိုးနပ်သည့် တက္ကသိုလ်များ။ | ကိုရီးယားတစ်ဝှမ်းရှိ တက္ကသိုလ်များ။ (new English) |

Also: 22 "your counselor" strings → Hangyul အဖွဲ့; fit.tier.MEETS/ONE_STEP ledes and titles; scholarships.empty (added the
"complete your profile" half); pickup.handle ("on that app").

## Pass B — native naturalness (14 strings changed)

| Key | Before | After |
|---|---|---|
| agency:review.verifyHint | …၎င်းတို့မပါဘဲ အတည်ပြုရန် အတည်ပြုပါ | …သို့မဟုတ် မရွေးဘဲ အတည်ပြုပါ (doubled verb removed) |
| agency:v8.ops.deadlines.q | …နောက်ဆုံးထားရမည့် လိုအပ်သော… | …နောက်ဆုံးရက် ကျမည်ဖြစ်ပြီး လိုအပ်သော အရာများ မပြည့်စုံသေးသည့်… |
| student:profileV3.why.goals | …အဆင့်နှင့် အသုတ်ရှိ ပရိုဂရမ်များသာ ဖြစ်စေသည်။ | …အဆင့်နှင့် စတင်ရက်ရှိ ပရိုဂရမ်များအထိ ကျဉ်းစေသည်။ |
| marketing:v20.city.Busan.body | …ဒုတိယ မြို့… ကုန်းမြေပေါ်တွင် အပျော့ပျောင်းဆုံး | …ဒုတိယ အကြီးဆုံးမြို့… ပြည်မတွင် အနွေးထွေးဆုံး |
| university:kpi.insufficientDetail | …အခြေခံသည် — {{min}} ခုမှစ၍ ပြသည် | …အခြေခံသည်။ {{min}} ခု ရှိမှ ပြပါမည်။ (no dash) |

## Pass C — UI context, brevity, one term (12 strings changed)

| Key | Before | After |
|---|---|---|
| visaroute:form.field.program | သင်တန်း | ပရိုဂရမ် |
| visaroute:form.notice | …အီး-ဗီဇာ… | …e-visa… |
| visaroute:step.apply.why | …ပြေစာနံပါတ်… | …လက်ခံဖြတ်ပိုင်း နံပါတ်… |
| marketing:v15.pricing.compare.row.dormitory | အဆောင် အကူအညီ | အဆောင် |
| university:v22.stageHint.decision | စောင့်ဆိုင်းစာရင်း — ဆုံးဖြတ်ချက်ကို ကျွန်ုပ်တို့ ချရန် ကျန်သေးသည် | စောင့်ဆိုင်းစာရင်းတွင် ရှိသည်။ ဆုံးဖြတ်ချက် ကျန်သေးသည် |

## Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit)

| Section | Score | Note |
|---|---|---|
| seo.home.description | 26 (5/5/4/3/4/5) | split into two sentences; ends on "real people to help" |
| v15.pricing (lede, f5, compare rows) | 26 (5/5/4/4/4/4) | three choices listed after a colon, no "subscription" calque |
| v20.city.* (Busan, Seoul line) | 26 (5/4/5/3/4/5) | long prose, kept factual |
| v20.uni.* / v28.uni.why.* | 27 (5/5/4/5/4/4) | ctaTitle now a direct question "လျှောက်ရန် စဉ်းစားနေပါသလား" |
| v9.faq.languagesA | 25 (5/5/4/3/3/5) | honest about machine translation; long by nature |
| v6.unis.title, journey.eyebrow | 27 (5/4/5/5/3/5) | short headings |

## Final source ↔ target comparison

I compared all 354 pairs against the English and the Korean. Placeholders are intact (the validator checks this), and each
placeholder has a space before the Burmese particle. No string promises admission or a chance, and "your counselor" no
longer appears in student copy. `node scripts/i18n/v28/validate.mjs --only=my` → 354 strings valid, 0 problems. The
Zawgyi scan has 0 hits.

## Unsure

- `agency:misc.breadcrumb` = လမ်းကြောင်းပြ. This is a screen-reader label, and Burmese has no standard UI term for it.
- `marketing:v20.uni.philosophyEyebrow` = ပညာရေး ဒဿနိက. It is formal; ပညာရေး အယူအဆ is the plainer option.
- `university:v28.pipe.label`. "Analytics" is rendered as ခွဲခြမ်းစိတ်ဖြာမှု and may not match the nav label used in the bundle.
- `visaroute:staff.post` = သံရုံး. It also covers consulates. The longer form would be သံရုံး/ကောင်စစ်ဝန်ရုံး.
- `university:v7.pr.applicants_one/_other` are identical, which is correct for Burmese.

## Counts

- Job keys: 354
- Kept verbatim: 49
- Rewritten (current existed, changed): 75
- Newly translated (current was null): 230

## Second pass (jobs2)

Scope: the 467 keys of `scripts/i18n/v28/jobs2/my.json` → `scripts/i18n/v28/tx2/my.json` (marketing 2, success 199,
dossier 17, agency 215, university 34). Leak families: agency workspace (`ws.*`), readiness blockers and waiting reasons,
V27 guide/evidence labels, the success submission queue, university outcomes and V22 empty states. Same register and
glossary as above (တာဝန်ခံ, ရက်လွန်, နောက်ဆုံးရက်, သံရုံး အတည်ပြုခြင်း, အပိုစတီးလ်, လက်ခံဖြတ်ပိုင်း, ပရိုဂရမ်, ဝင်ခွင့်ကာလ).
Burmese has only CLDR `other`, so `_one` keys take the same classifier ခု form; `_one` keys whose English has a literal
"1" use the Burmese numeral ၁. Zawgyi scan: 0 hits. Personas as in the first pass; Daw Moe (agency console) drove Pass C.

Passes: A meaning 9 strings changed (e.g. DOC_TOO_OLD "too old" = issued too long ago, not "worn"); B naturalness 12
(dash labels kept as "{{label}} - …" with a short ASCII hyphen, no em dash chains; questions end with ။); C UI brevity /
one term 14 (Counselor in consoles = အကြံပေး; Package = ဖိုင်အစုံ throughout queue and review lines).

| Key | Before | After |
|---|---|---|
| success:agencyItem.DOC_LEGALIZE | (English) {{label}} — consular legalization pending | {{label}} - သံရုံး အတည်ပြုခြင်း ကျန်သေးသည် |
| success:queue.detail.mechanismText | (English) Open the official portal in your own browser… | တရားဝင် ပေါ်တယ်ကို သင့်ဘရောက်ဇာတွင် ဖွင့်ပြီး… Hangyul သည် ပေါ်တယ် စကားဝှက်ကို ဘယ်တော့မှ မသိမ်းဘဲ… |
| agency:v27.issue.CONSULAR | (English) Consular legalization needed | သံရုံး အတည်ပြုခြင်း လိုသည် |
| agency:ws.weightsNote | (English) Points earned per factor… not a quality rating. | …ရမှတ်များသည် ရွေးချယ်မှုကို ရှင်းပြခြင်းသာ ဖြစ်ပြီး အရည်အသွေး အဆင့်သတ်မှတ်ချက် မဟုတ်ပါ။ |
| university:v22.empty.decision | (English) No one is on the waitlist. | စောင့်ဆိုင်းစာရင်းတွင် မည်သူမျှ မရှိပါ။ |

Marketing scorecard (30 points: clarity, trust, naturalness, brevity, CTA, cultural fit):

| Key | Score | Note |
|---|---|---|
| v20.uni.intl.officeLine | 26 (5/5/4/4/3/5) | "office for international students, contact route open" |
| v20.uni.intl.none | 26 (5/5/4/3/4/5) | honest "not found yet"; ends on a clear first step (အောက်ပါ တရားဝင် ဝက်ဘ်ဆိုက်မှ စတင်ပါ) |

Unsure (second pass):

- `dossier:upload.status.NEEDS_REVIEW/UPLOADED/NEEDS_CORRECTION`: English and Korean are intentionally empty (the status
  word drops out of `upload.haveTitle`). The validator requires a non-empty value, so short adjectives were used
  (စစ်ဆေးဆဲ / တင်ထားပြီး / ပြင်ရန်လို); they add a status word Burmese readers will see where English shows none.
- `agency:ws.level.ASSOCIATE` = ဒီပလိုမာ (Associate): Myanmar has no exact associate degree.
- `agency:ws.level.BACHELOR` = ဘွဲ့ကြို (undergraduate); ဘွဲ့ is the alternative.
- `success:queue.fixture` kept as Latin "Fixture" (internal test-data marker, quoted in fixtureNote).
- `agency:ws.sla` keeps "SLA" in Latin, as console staff use it.

Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=my` → 467 strings valid, 1 problem: the known
false positive `success:agency.questions.too_few` ("plural form without agency.questions.too_other"; the EXTRA regex reads
`_few` as a plural suffix; the key is translated and the validator was not edited).

Counts (second pass): job keys 467 · kept verbatim 0 · rewritten 0 · newly translated 467 (every `current` was null).

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
