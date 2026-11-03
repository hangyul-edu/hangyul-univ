# V31 English copy audit: customer-critical strings

Input: `en-job.json` (1,668 keys). Patch: `source-patch-en-critical.json` (English only; Korean untouched).
Meaning checked against the Korean, `GLOSSARY.md` and `docs/SERVICE_CATALOG_V29.md`.
Validation: `node scripts/i18n/v31/apply-source-patch.mjs docs/qa/v31/l10n/source-patch-en-critical.json --dry` gives
`161 changed, 0 refused (dry)`. The patch has not been applied.

## Counts

| | |
|---|---|
| Strings reviewed | 1,668 (36 of them were marked V31 and already re-authored) |
| Strings changed | 157 job keys, plus 4 `_one` plural partners outside the job (161 patch entries) |
| V31 keys touched | 3. The only change is "programme" → "program" (`marketing:v11.cta.text`, `faq.q4.a`, `faq.q5.a`) |
| Left unchanged | 1,511 |

By reason (one primary reason per entry):

| why | n | what it covers |
|---|---|---|
| consistency | 47 | glossary terms (consular legalization, editing, recommended universities, "the Hangyul team" rather than counselor), US spelling (counselling, notarised, personalising, behavioural, authorisation), plural pairs |
| calque | 34 | Korean word order, fragments, noun stacks |
| meaning | 32 | the English said something different from the Korean or from the contract (see the meaning section below) |
| AI-tic | 28 | em dashes used as connectors (mostly the legal list items "Access — …"), slash-joined phrases, "partner in success" |
| ambiguous | 11 | e.g. "Your plan" vs the service plan, "Fits", "Stored" |
| vague | 9 | e.g. "Information provided", "Sponsor document" |

Most of the product copy was already good (status labels, form labels, money and visa screens, the writing promise), so I left it as it was. The weak copy was concentrated in older marketing (`v11.why.*`), the legal pages (dashes and British spelling), the plan and allowance labels (`v15.services.*`), and the dossier and workspace UI.

## Most important before → after

| key | before | after |
|---|---|---|
| `student:v4.ws.team.final` | Final check, then sends your application to {{university}} | Final check before you submit to {{university}} |
| `marketing:v11.why.s3.text` | …provides a premium service at a reasonable price and guarantees a successful life as a student abroad. Experience study-abroad support on a different level, at the best value for money. | …gives careful, hands-on help at a fair price, and you see exactly what your plan includes before you pay. |
| `marketing:v11.why.s3.title` | The most reasonable cost,<br>the best result | A fair price,<br>no surprises |
| `marketing:v11.why.s1.title` | Complete support,<br>from the first step to success | Help at every stage,<br>from start to finish |
| `marketing:v11.why.s1.text` | We take responsibility for every stage… — we are beside you… we are your partner in success. | We help at every stage of studying in Korea: choosing a program, preparing your documents and getting ready to enter the country. You work with the same team from start to finish. |
| `student:v15.services.level.visa_support.DOCUMENT_PREP` | Document preparation | Help preparing your documents |
| `student:v15.services.allowance.unlimited` | Ongoing with the Hangyul team | Ask the Hangyul team any time during your service term |
| `student:v15.services.allowance.key.max_managed_applications` | Applications managed | Applications we manage with you |
| `student:v15.services.level.dormitory_support.SCHEDULE` | Application scheduling | Application dates tracked |
| `student:phase.prepare.text` | …write your statement and study plan with the Hangyul team. | …write your personal statement and study plan with feedback from the Hangyul team. |
| `marketing:v12.terms.services.documents` | Preparation and review of application documents | Help preparing application documents, and document review |
| `marketing:v12.terms.definitions.support.def` | The paid services a member chooses — counselling, document review, personal-statement and study-plan review, and application management. | The paid services a member chooses, such as consultations, document review, editing of personal statements and study plans, and application management. |
| `student:discover.verdict.reach` / `success:group.possible` | Possible match | Meets requirements, needs checking |
| `student:scholarshipsV3.group.ELIGIBLE` | You qualify | Scholarships you're eligible for |
| `concierge:arrived.confirmText` | …Your residence card is due within 90 days. | …You need to apply for your residence card within 90 days. |
| `concierge:step.pickup.sub` | Someone meets you at arrivals | Your pickup partner meets you at arrivals |
| `marketing:v12.privacy.collect.profile.purpose` | …preparing a study plan | …planning your study abroad |
| `dossier:v9.who.counselor` | Your counselor {{name}} at {{org}} | {{name}}, your contact at {{org}} |
| `dossier:page.method` | Automatic check. It reads the text in PDFs, but not photos… | Automatic checks read the text inside PDFs, not photos or scanned images. Your profile changes only when you confirm. |
| `student:v4.review.late` | Taking longer than usual. The Hangyul team has been told it is late. | This is taking longer than usual, so we've flagged the delay to the Hangyul team. |
| `marketing:v12.privacy.rights.*` (5 keys) | Access — see what information we hold about you | Access: see what information we hold about you |
| `marketing:v11.faq.q1.a` | …certified by a notary + apostille … notarised … | Rewritten as a plain list: "translated into English, notarized and apostilled", etc. |
| `marketing:seo.home.title` | Hangyul Univ — Your simplest path to studying in Korea | Hangyul Univ \| The simplest way to study in Korea |

## Meaning problems found and fixed

These are the places where the old English said something different from the Korean, from the glossary or from the V29 contract.

1. **Hangyul does not submit applications.** `student:v4.ws.team.final` put "sends your application to {{university}}" in Hangyul's lane. It now reads "Final check before you submit to {{university}}". `student:v4.ws.uni.waitingDetail` ("after it's sent") now reads "after you submit it".
2. **Outcome guarantee.** `marketing:v11.why.s3.text` said Hangyul "guarantees a successful life as a student abroad". That is a forbidden term and an outcome promise. Removed.
3. **Outcome promises in the headings.** `marketing:v11.why.s3.title` ("the best result") and `marketing:v11.why.s1.title` ("from the first step to success") are now about scope rather than outcome.
4. **Visa help described as Hangyul preparing the documents.** `student:v15.services.level.visa_support.DOCUMENT_PREP` said "Document preparation". It now says "Help preparing your documents", which is the contract's preparation support.
5. **"No limit" without its scope.** `student:v15.services.allowance.unlimited` said "Ongoing with the Hangyul team", with no boundary. It now reads "…any time during your service term".
6. **Passive count label.** `max_managed_applications` used "Applications managed", which the glossary forbids. It now reads "Applications we manage with you". `max_recommended_institutions` is now "Recommended universities", so the two counts are clearly different.
7. **Dormitory schedule.** "Application scheduling" could read as booking. The contract says Hangyul tracks the dates, so it now reads "Application dates tracked".
8. **Editing described as co-writing.** `student:phase.prepare.text` said "write … with the Hangyul team". It now says "with feedback from". In the terms, `services.documents` ("Preparation … of application documents") becomes "Help preparing…", and the support definition says "editing" and "such as" instead of a closed list.
9. **Airport pickup.** `concierge:step.pickup.sub` now says a partner meets the student, because Hangyul does not run transport.
10. **Eligibility overstated.** "Possible match" dropped the "needs checking" half of the Korean (`discover.verdict.reach`, `success:group.possible`). "You qualify" (`scholarshipsV3.group.ELIGIBLE`, `summaryOnly`) overstated what was checked. It now reads "eligible" or "meet the conditions…, based on what we can check".
11. **Residence card.** The old English said the card is "due" within 90 days. The Korean says you must *apply* within 90 days (`concierge:arrived.confirmText`).
12. **Room status.** `concierge:status.DORMITORY.ASSIGNED` said "Room offered"; the Korean 방 배정 means "Room assigned".
13. **Readiness.** `dossier:page.summary` added "ready for every application", which is not in the Korean. `student:applications.subtitle` said "documents you've verified", but the team checks them, not the student.
14. **Glossary collision.** `marketing:v12.privacy.collect.profile.purpose` said "preparing a study plan", which is the essay type. The Korean means a study-abroad plan.
15. **Smaller meaning fixes.**
    - `common:fit.test.UNIV_KLI` lost "completed". It now reads "Completed a university Korean course".
    - `common:certification.UNKNOWN` said "not verified" for 미확인. It now reads "status unknown".
    - `concierge:help.sideText` said "money" where the Korean says payments.
    - `marketing:v20.uni.intl.admissionsLine` described a separate page. The Korean means a separate admissions track.
    - `marketing:v20.city.Gyeonggi.line` added "greener" where the Korean says roomier.
    - `marketing:v20.city.Gyeonggi.body` missed the point that more students live in dormitories.
    - `marketing:v12.privacy.retention.contract.record` said "withdrawal of subscription". 청약철회 means order cancellation.
    - `marketing:v12.privacy.collect.verification.purpose` said "automated" for 부정 가입. The Korean means fraudulent sign-ups.
    - `visaroute:step.slow_items.title` lost "first".
    - `common:notify.empty` dropped its second sentence.

## Korean source that is itself unclear or risky (not changed)

| key | issue |
|---|---|
| `marketing:v11.why.s3.text` | 성공적인 유학생활을 보장합니다 is a guarantee of outcome, which the V31 forbidden-terms list does not allow. 최고의 가성비 is an unbacked superlative. |
| `marketing:v11.why.s3.title`, `v11.why.s1.title` | 최고의 결과 and 시작부터 성공까지 are outcome promises. |
| `marketing:v11.why.s1.text` | 모든 과정을 책임집니다 is broader than any single plan (Basic has no applications or arrival help). |
| `student:v4.ws.team.final` | 최종 확인 후 {{university}}에 지원서 제출 sits in the team lane, so it says Hangyul submits. The glossary says students submit personally. |
| `student:phase.prepare.text` | 한귤 상담팀과 함께 … 작성합니다 reads as co-writing. Editing is not writing, and Basic has no editing. |
| `marketing:v12.terms.services.documents` | 지원 서류 준비 reads as Hangyul preparing the documents. The glossary says document review, not document preparation. |
| `student:v15.services.allowance.unlimited` | 담당자 상시 문의 gives no scope or term. It should be bounded by the service term or the contracted documents. |
| `student:register.privacyNote` | Says data is shared only with the Hangyul team and the universities you choose. The privacy policy also lists the assigned partner agency and sponsor links. |
| `marketing:v20.city.Gyeonggi.body` | 수도권을 빼면 대학이 가장 많은 지역 does not make sense, because Gyeonggi is part of 수도권. The English keeps "except the capital itself". |
| `student:settingsV3.translation.SOURCE_APPROVED` | 원문은 영어예요 says English is the source language. In this pipeline Korean is the source. |
| `marketing:v11.faq.q1.a` | Item 4 is a run-on sentence. "(30일 기한)" could mean either valid for 30 days or issued within 30 days. The apostille is listed with no consular-legalization route for countries outside the Hague Convention. |
| `common:fit.tier.CHALLENGE.short` | 도전 가능 ("can challenge") does not match its own lede, which says the requirements are not yet verified. The English stays neutral: "Worth a look". |
