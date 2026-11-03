# V31 locale review — Thai (th)

Status: `SYNTHETIC_NATIVE_REVIEWED_V31`

Job `scripts/i18n/v28/jobs-v31/th.json` → `scripts/i18n/v28/tx-v31/th.json`; glossary `docs/qa/v31/l10n/glossary/th.json`.
Register: neutral polite Thai UI (no ค่ะ/ครับ), warm and plain for students and parents; legal text neutral and exact.
Thai has only the CLDR `other` plural form, so no extra plural keys were added.

## Counts

| | keys |
|---|---|
| Reviewed | 1,729 (common 310 · marketing 384 · student 590 · concierge 181 · visaroute 164 · dossier 66 · success 33 · writing 1) |
| Kept verbatim | 1,421 (includes 35 v31-flagged keys that were re-translated from the new source and came out identical to `current`) |
| Rewritten | 308 |
| — new source (v31 / null) | 196 |
| — naturalness | 41 |
| — terminology | 35 |
| — meaning | 25 |
| — quality | 11 |

Validator: `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=th` → `1729 strings valid, 0 problems`.

## Terminology decisions (one concept = one term)

ทีม Hangyul (Hangyul team; "ทีม Hangyul Univ" only where the source says Hangyul Univ team) · ตรวจแก้ (editing; replaced "ขัดเกลา") ·
เรียงความแนะนำตนเอง / แผนการศึกษา (never "เรียงความส่วนตัว" / "แผนการเรียน") · การสมัครที่เราดูแลร่วมกับคุณ (managed application) ·
มหาวิทยาลัยที่แนะนำ (recommended) · ช่วงเวลาสอบถามหลังการปรึกษา (support window) · การรับรองเอกสารแบบ Apostille ·
การรับรองเอกสารโดยสถานกงสุล (consular legalization; never "ยืนยัน") · โนตารี · วันปิดรับสมัคร · ได้รับการตอบรับเข้าศึกษา (offer) ·
ตั้งหลักในเกาหลี (settlement; replaced "ตั้งถิ่นฐาน", which reads as emigrating) · รับที่สนามบิน ประสานงานผ่านพาร์ตเนอร์ ·
การรับรองคุณภาพด้านการรับนักศึกษาต่างชาติ (IEQAS).

## Critical semantic issues found in `current` (all fixed)

| key | said | now says |
|---|---|---|
| student `v4.ws.team.final` | Hangyul does the final check and sends the application to {{university}} | final check before you submit it to {{university}} yourself |
| common `v29.pricing.compare.scopeNote` | Premium editing unlimited within contract — exclusions (new documents, translation, notarization) dropped | keeps the contract scope and lists the exclusions |
| common `v29.pricing.compare.row.support` | ระยะเวลาให้คำปรึกษา (consultation period) | ช่วงเวลาสอบถามหลังการปรึกษา (support window) |
| student `v15.services.scope.consultation` | เวลาให้คำปรึกษา (consultation time — V15 minutes idea) | การปรึกษา |
| student `v15.services.allowance.unlimited` | contact the team any time (no scope) | ask the Hangyul team throughout your service term |
| student `v15.services.allowance.key.max_managed_applications` | applications handled for you | applications we manage with you |
| common `v29.pricing.notes.visaDecision` | "the relevant agency" decides; Hangyul "submits the petition" | we help you prepare and apply; the immigration authorities decide |
| common `v29.pricing.premium.f4` | only visa dates managed (documents dropped) | visa documents and key dates closely managed · dormitory application help |
| common `v29.pricing.premium.position` | application stage dropped | from application to visa, arrival and first weeks |
| common `v29.pricing.compare.value.documents.INTENSIVE` | "thorough check" only | in-depth review with notes on what to fix |
| common `v29.addon.item.airport_pickup` | "arrange a pickup car" (no partner) | airport pickup, arranged through a partner |
| common `uni27.schol.youMay` | broken fragment "you may meet the conditions of" | scholarships you may qualify for |
| marketing `v11.hero.lede` | "we will make your dreams come true" | find the right university and get every step done, with a team beside you |
| marketing `v11.why.s1.*`, `v11.why.s3.*` | partner "to success", "makes your student life smooth", "best results" (outcome promises) | stages we help with; fair price, scope visible before paying; no outcome promise |
| marketing `v11.services.s1.text` / `s2.text` | "we take care of the whole process" / "we handle everything" | we help you prepare and deal with the university / help through visa, residence card, registration |
| marketing `v11.faq.q6.a` | every university offers scholarships | most do |
| marketing `v20.uni.why.ieqasBody` | applicants "pass" visa screening more easily | the visa screening procedure is simpler |
| marketing `v20.city.Gyeonggi.line` / `.body` | "more green space"; dormitory sentence garbled | roomier; more students live in university dormitories |
| marketing `v12.privacy.collect.verification.purpose` | preventing *automated* sign-ups | preventing *fraudulent* sign-ups |
| marketing `v12.terms.universityInfo.p` | Hangul "대학알리미" left in Thai text | Academy Info (official disclosure data) |
| student `register.privacyNote` | data shared only with "advisers" | Hangyul team (incl. partner agency) and chosen universities |
| student `phase.prepare.text` | essays written "together with" the team | student writes; team gives feedback |
| student `profileV3.why.basics` | consular legalization lost ("document certification") | Apostille or consular legalization |
| student / success `discover.verdict.reach`, `group.possible` | "may suit you" | meets requirements, needs checking |
| student `register.consent.CROSS_BORDER_VERIFICATION.summary` | claimed details not in the source | only what the source says |
| dossier `page.summary`, `group.extraCount`, `package.line` | "for every application"; status instead of action; "requirements" | ready N of M; show N more; documents needed |
| concierge `status.DORMITORY.ASSIGNED` | room offered | room assigned |
| concierge `step.pickup.sub` | "someone waits for you" | the partner transport provider meets you in arrivals |
| concierge `arrived.confirmText`, `moveIn.item.address_report.text` | "get the card"; 15-day limit dropped | apply within 90 days; report within 15 days of moving |
| visaroute `step.slow_items.why`, `help.issue.NEEDS_ANSWER.needed`, `help.ask` | generic certification; embassy only; "ask staff" | Apostille + consular legalization; embassy or consulate; ask the Hangyul team |

## Marketing scorecard (after rewrite; CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY)

| section | C | N | S | T | P | B | /30 |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing (plan cards + comparison) | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| Add-ons and purchase notes | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 5 | 5 | 29 |
| Directory / discovery (`v12.directory`, `v20`–`v24`) | 5 | 4 | 4 | 5 | 4 | 5 | 27 |

No section below 26/30.

## Product scorecard (student app; ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY)

| area | AC | SA | N | C | B | /25 |
|---|---|---|---|---|---|---|
| Home / dashboard | 5 | 5 | 4 | 5 | 5 | 24 |
| Applications / workspace / compare | 5 | 5 | 4 | 5 | 4 | 23 |
| Documents (dossier, profile, family) | 5 | 5 | 4 | 5 | 5 | 24 |
| Services (allowances, add-ons, checkout) | 5 | 5 | 4 | 5 | 5 | 24 |
| Visa / housing (visaroute, concierge) | 5 | 5 | 4 | 5 | 4 | 23 |

Weak points fixed: who-submits wording, allowance labels, em-dash joins, slash-joined labels, "offer" calques.
Naturalness stays at 4 where long legal/how-it-works strings are kept deliberately exact.

## Unresolved source ambiguity (not guessed)

- visaroute `step.decision.why`: source says the *embassy* decides; glossary says the immigration authorities. Followed the source.
- visaroute `why.rule`: "where you live" (country vs. area) — kept the country reading.
- dossier `v9.who.counselor`: en "your contact" vs ko 상담사 (counselor) — followed ko.
- student `v9.funds.longer_other`: quoted "consulting" (Korean government oversight category) — kept the existing gloss.
- student `v9.discovery.scholarship_one`: no `{{count}}` in the source, so no number in Thai.
- marketing `v12.terms.universityInfo.p`, `v20.uni.why.breadthBody`: the English source embeds Hangul (대학알리미); rendered as "Academy Info" in Thai.
