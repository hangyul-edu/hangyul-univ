# V31 locale review: Burmese (my)

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Job `scripts/i18n/v28/jobs-v31/my.json` → `scripts/i18n/v28/tx-v31/my.json`; glossary `docs/qa/v31/l10n/glossary/my.json`.
Script: Unicode Myanmar only (no Zawgyi code points; scanned for U+1060–U+109F and leading U+1031).
Burmese has only the CLDR `other` plural form, so no extra plural keys were added.

Register: Two registers are used, chosen by where the text appears.
- **Spoken polite (…ပါတယ်/…ပါမယ်):** the marketing narrative (hero, why, services, FAQ, closing CTA). This is how Yangon study-abroad services write.
- **Literary polite (…ပါသည်/…ပါမည်):** everything else, including the student app, pricing cards and notes, legal pages, and errors.

Numbers use Latin digits in every key that was rewritten. A few legal and prose keys that were otherwise kept still use Burmese digits, and were left unchanged to avoid churn.

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310 · marketing 384 · student 590 · concierge 181 · visaroute 164 · dossier 66 · success 33 · writing 1) |
| Kept verbatim | 1,376 (includes 20 v31-flagged keys re-translated from the new source that came out identical to `current`) |
| Rewritten | 353 (marketing 106 · student 98 · common 83 · visaroute 24 · concierge 21 · success 11 · dossier 10) |
| — new source (v31 / null) | 233 |
| — terminology | 56 |
| — naturalness | 39 |
| — quality | 19 |
| — meaning | 6 (non-v31 keys; most meaning errors were in v31 keys and are counted under new source, listed below) |

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=my` → `1729 strings valid, 0 problems`.

## Terminology decisions (one concept = one term)

These terms are in `glossary/my.json` and are applied across all keys:

| Concept | Burmese term | Note |
|---|---|---|
| Hangyul team | Hangyul အဖွဲ့ | "Hangyul Univ အဖွဲ့" only where the source says "Hangyul Univ team". 17 keys that wrongly said "Hangyul Univ" were fixed. |
| Consultation | အကြံပေး ဆွေးနွေးမှု | Replaced "တိုင်ပင်မှု" and the V15 idea of "consultation time". |
| Support window | ဆွေးနွေးပြီးနောက် မေးမြန်းနိုင်သည့် ကာလ | |
| Managed application | သင်နှင့်အတူ ကျွန်ုပ်တို့ စီမံပေးသည့် လျှောက်လွှာ | Never "managed for you". |
| Recommended | အကြံပြုသော … | |
| Personal statement | ကိုယ်ရေးမိတ်ဆက်စာ | Replaced the calque "ကိုယ်ရေးထုတ်ဖော်ချက်". |
| Study plan | ပညာသင် အစီအစဉ်စာ | Replaced "လေ့လာမှု အစီအစဉ်", which reads as "learning plan". |
| Editing | စာပြင်ပေးခြင်း | Replaced "တည်းဖြတ်မှု". Never implies writing for the student. |
| Document review | စာရွက်စာတမ်း စိစစ်ပေးခြင်း | |
| Entry requirement | လိုအပ်ချက် | စည်းကမ်းချက် is kept only for scholarship conditions. |
| Offer | ဝင်ခွင့်ရရှိ | Replaced the calque "ကမ်းလှမ်းချက်". |
| Apostille | Apostille အတည်ပြုချက် | Replaced "အပိုစတီးလ်". |
| Consular legalization | သံရုံး တရားဝင်အတည်ပြုချက် | Never a bare "confirmation". |
| Notarization | နိုတာရီ အတည်ပြုချက် | |
| Korean language institute | ကိုရီးယားဘာသာ သင်တန်းဌာန | Not "သင်တန်းကျောင်း" (school). |
| Dormitory | ကျောင်းအဆောင် | |
| Settling in | နေသားကျအောင် ကူညီမှု | Replaced "အခြေချ", which reads as emigrating. |
| Residence card | နိုင်ငံခြားသားကတ် | |
| Airport pickup | လေဆိပ်ကြို (မိတ်ဖက်မှတစ်ဆင့် စီစဉ်ပေး) | Arranged through a partner. |
| Immigration authorities | လူဝင်မှုကြီးကြပ်ရေး အာဏာပိုင်များ | |
| National (university) | နိုင်ငံပိုင် | Replaced "အမျိုးသား", which also reads as "male". |

Names that stay in Latin script:
- King Sejong Institute
- Global Korea Scholarship (GKS)
- NHIS
- KIIP
- Academy Info
- Plan names: Basic, All-in-One, Premium

## Critical semantic issues found in `current` (all fixed)

| key | said | now says |
|---|---|---|
| student `v4.ws.team.final` | Hangyul does the final check and sends your application to {{university}} | final check before you submit to {{university}} yourself |
| marketing `v11.why.s3.text` / `.title` | Hangyul "guarantees a successful student life", "best value", "best results" | fair price, careful hands-on help, you see exactly what the plan includes before paying |
| marketing `v11.hero.lede` / `v11.hero.title` | "we will make your dream come true" | find the right university and get every step done with a team beside you; studying in Korea is easier than you think |
| marketing `v11.why.s1.*`, `v11.why.s2.*` | "partner in your success", "best path to your dream", "maximise your potential", "100% strategy" | stages we help with, same team start to finish; a plan built from grades, goals and budget, universities you can realistically apply to |
| marketing `v11.services.s1.text` | "we take responsibility for the whole process" | we suggest institutions and explain scholarships, then help you prepare documents and deal with the university |
| marketing `v11.services.s2.text` / `.title` | "visa issuance" listed as a Hangyul service; "complete support, no worries" | help through visa application, residence card and course registration |
| common `v29.pricing.compare.scopeNote` | Premium "no round limit" with the exclusions (new documents, translation, notarization) dropped | keeps the contract scope and lists the exclusions |
| common `v29.pricing.premium.f4` / `premium.position` | only visa *dates* managed; application stage dropped | visa documents and key dates closely managed · dormitory application help; from application to visa, arrival and first weeks |
| common `v29.pricing.compare.row.support` | "consultation assistance period" | support window: the period after the consultation in which you can ask questions |
| common `compare.row.managed`, `all_in_one.f2`, `premium.f2`, `addon.item.extra_application`; student `v15…max_managed_applications` | applications "managed for you" | applications we manage *with* you |
| common `v29.pricing.compare.value.documents.INTENSIVE` | "detailed check" only | in-depth review with notes on what to fix |
| common `v29.addon.item.airport_pickup` | "airport welcome arrangement" (no partner) | airport pickup arranged through a partner |
| common `v29.pricing.notes.visaDecision` | "the relevant authority" decides | the immigration authorities decide; we help you prepare and apply |
| student `v15.services.scope.consultation` | "consultation time" (V15 minutes idea) | consultation |
| student `v15.services.allowance.unlimited` | contact the team any time (no scope) | ask the Hangyul team any time during your service term |
| student `register.privacyNote` | shared with "the counselor you choose" (Hangyul team and partner agency missing) | shared only with the Hangyul team supporting you (incl. its partner agency) and the universities you choose |
| student `phase.prepare.text` | write your essays "together with the Hangyul team" | write them with feedback from the Hangyul team |
| student `compare.legalCount_*`, `profileV3.why.basics` | consular legalization rendered as a generic "confirmation"; misspelt "အပိုစတီးလ်" | Apostille အတည်ပြုချက် or သံရုံး တရားဝင်အတည်ပြုချက် |
| student `budget.beforeArrivalHint` | broken fragment ("first dormitory period and first month") | first-semester tuition, application fee, first-semester dormitory fees and first month's living costs |
| student `register.consent.CROSS_BORDER_VERIFICATION.summary` | added items not in the source (transferred items, timing, retention period) | exactly the source: who delivers, who checks, details incl. how to refuse in the policy |
| common `notify.empty` | second sentence dropped | no new notifications; we'll let you know here when there's news |
| common `institution.NATIONAL` | အမျိုးသား (also reads "male") | နိုင်ငံပိုင် |
| marketing `v11.faq.q6.a` | "every university offers scholarships" | most do; amounts and conditions differ |
| marketing `v11.faq.q3.q` | "which tests must I take?" | which tests are accepted? |
| marketing `v11.faq.q10.a` | engineering/business vs "social sciences" | vs humanities |
| marketing `v12.terms.services.documents` | "preparing application documents" (Hangyul prepares) | help preparing application documents, and document review |
| marketing `v12.terms.universityInfo.p` | Korean "대학알리미" left in the Burmese text | Korea's official university disclosure service (Academy Info) |
| marketing `v12.privacy.retention.contract.record` | "registration withdrawals" | contracts and order cancellations |
| marketing `v12.privacy.collect.verification.purpose` | "automated sign-ups" | fraudulent sign-ups |
| marketing `v20.uni.why.ieqasBody` | applicants judged by "relaxed visa standards" | visa screening is simpler |
| marketing `v20.city.Gyeonggi.line` / `.body` | "greener"; "universities have their own dormitories" | roomier; more students live in university dormitories than off-campus studios |
| marketing `v15.pricing.compare.item` | "Category" (source is intentionally empty) | empty |
| concierge `hero.arrived` | "welcome *from* Korea" | welcome to Korea |
| visaroute `doc.other_id_copy.name`, `who.sponsor` | "national ID card" (copy, both sides dropped); sponsor as "guarantor" | copy of national ID card (front and back); person funding your studies |
| student `v9.family.consent` | share with "the person who will send the link" | with the person who receives it |
| dossier `v9.who.consent` | "because you agreed on {{date}}" | (you agreed on {{date}}) |
| student `writing.status.DRAFT` | "Draft — write when ready" (added text) | Draft |

## Marketing scorecard (after rewrite; internal review tool, not a measurement)

| area | CLARITY | NATURALNESS | SPECIFICITY | TRUST | PERSUASION | BREVITY | total /30 |
|---|---|---|---|---|---|---|---|
| hero | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| why section | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| services rows | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| pricing (plan cards + comparison) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| add-ons and purchase notes | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| closing CTA | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| directory / discovery | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Every area scored below 26 before the rewrite:
- **hero, why section and services rows:** these had outcome promises.
- **pricing:** it carried calques, the managed-for-you wording and dropped scope.

All areas are now at 27 or above.

## Product scorecard (student app)

| area | ACTION CLARITY | SEMANTIC ACCURACY | NATURALNESS | CONSISTENCY | BREVITY | fixes |
|---|---|---|---|---|---|---|
| home | 5 | 5 | 4 | 5 | 5 | team naming; "documents need your attention"; consultation term |
| applications | 5 | 5 | 4 | 5 | 4 | student submits personally; university sees file only after submission; slashes removed |
| documents | 5 | 5 | 4 | 5 | 5 | Apostille / consular legalization terms; "needs fixing" labels; auto-check method note |
| services | 5 | 5 | 4 | 5 | 4 | consultation, managed-with-you, scoped "any time", fee exclusions with official terms |
| visa / housing | 5 | 5 | 4 | 5 | 4 | embassy questions, slow documents first, residence-card term, partner pickup, NHIS |

## Unresolved ambiguity (source unclear; listed, not guessed)

- **common `fit.tier.CHALLENGE.short`:** The English "Worth a look" and the Korean 도전 가능 ("you could try") differ. A neutral "ကြည့်ထိုက်" was kept, with no "reach" wording.
- **marketing `v11.hero.lede`, `v11.why.*`, `v11.services.*`:** The Korean source still contains the old promise copy (꿈을 현실로, 성공적인 유학생활을 보장, 모든 과정을 책임). I followed the English and the contract, which forbid outcome promises. The Korean source should be aligned.
- **marketing `v11.services.s3.text`:** The Korean source describes a broader community service (housing search, networking "all in one place") than the English. I followed the English.
- **marketing `v11.faq.q5.a`:** The Korean says "start with us"; the English says "start". I followed the English.
