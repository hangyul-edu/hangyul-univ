# V27 English copy review (brief §6, §34: "fix the source meaning first")

The English bundle is the source for every machine translation, so this pass fixes the English first.
Patch: `scripts/i18n/v27/en-copy-patch.json`, in the format `{ ns: { "dotted.key": { "en": "…" } } }`.
The bundles in `packages/i18n/locales/en/*.json` were **not** edited.

## Method

1. A python3 scan read all 13,447 English strings in 11 namespaces and flagged candidates using these heuristics:
   - em or en dashes
   - "Label: text" colons
   - slash-joined words
   - parentheticals
   - marketing words (journey, unlock, seamless, comprehensive …)
   - developer words (records, entity, API, ALL_CAPS enums …)
   - idioms and phrasal verbs (all set, caught up, on the go, chase, nudge, sort out …)
   - Korean admin terms (consular confirmation, visa issuance certificate, alien registration, untranslated Hangul)
   - strings over 170 characters
2. Every flagged string was read and rewritten by hand, or deliberately left alone. A second sweep looked for "journey", "unlock" and "all caught up" phrasing and for stray enum names in strings the first scan missed.
3. Validation:
   - every key exists in the en bundle and is a string
   - `{{placeholders}}`, `$t(...)` and tags (`<em>`, `<b>`, `<1>…</1>`) are identical as multisets
   - newline count is unchanged
   - no `marketing` `v11.*` key, and no key containing `privacy`, `terms` or `consent`
   - no new em dash was introduced
   - every plural sibling (`_one` / `_other` / base) is patched together
   - no entry is identical to its source
   Result: **OK**, 0 errors.

### Excluded from editing

- **Owner-gated copy:** `marketing.v11.*`.
- **Legal copy:** every key whose path contains `privacy`, `terms` or `consent`. This covers the `marketing.v12.privacy|terms` and `v23.privacy` policy text, the sign-up consent labels and the privacy settings. It is broader than strictly needed, to stay on the safe side.
- **Left as they are on purpose:**
  - Terse list separators in the agency and university consoles, such as `Oldest: {{title}} — {{student}}`, `{{label}} — review overdue` and email subject lines. Here the dash separates fields; it does not glue sentences together.
  - SEO `<title>` brand separators.
  - Sample essay text inside marketing illustrations.
  - City guide prose, apart from four dash-glued sentences.
  - Hangyul-internal readiness and dev screens (`agency.v8.ready.*`, `v9.ready.*`, `*.devNote`, `*.consoleHint`).
  - Statistical shorthand (`n = 5`, `÷`) in the analytical consoles.

### Conventions applied

- Em-dash sentence glue is split into two short sentences, or joined with a comma or colon.
- "Consular confirmation" becomes **consular legalization**.
- "Visa issuance certificate" becomes **Certificate of Confirmation of Visa Issuance (CCVI)**.
- "Alien registration" becomes **register as a foreign resident**.
- "Language school" becomes **Korean language institute**.
- GKS gets its full name: **Global Korea Scholarship (GKS)**.
- "TOPIK 4" becomes **TOPIK level 4**.
- 대학알리미 becomes **Academy Info (대학알리미)**.
- The diplomatic word "post" becomes **embassy or consulate** in student copy. Staff strings keep "post".
- In student copy, "journey" becomes **progress** or **plan**, and "unlock" becomes **available**, **see** or **be eligible**.
- Enum names and developer words ("fixture", "API", "assignment engine", "rules engine", "tenant-isolated", "scheduled-jobs worker") are replaced with plain operational wording.

## Counts per namespace

"Examined" counts every string outside the exclusions; the scan read all of them. "Flagged" counts the strings at least one heuristic marked for manual review. "Rewritten" counts the entries in the patch.

| Namespace | Strings | Examined | Flagged | Rewritten |
|---|---:|---:|---:|---:|
| agency | 2,547 | 2,545 | 289 | 69 |
| common | 789 | 778 | 85 | 24 |
| concierge | 701 | 701 | 89 | 44 |
| dossier | 221 | 218 | 51 | 32 |
| marketing | 1,842 | 1,573 | 266 | 134 |
| mobile | 1,198 | 1,184 | 113 | 46 |
| student | 2,645 | 2,606 | 337 | 190 |
| success | 502 | 500 | 133 | 66 |
| university | 1,750 | 1,741 | 220 | 65 |
| visaroute | 550 | 548 | 137 | 88 |
| writing | 502 | 502 | 104 | 57 |
| **Total** | **13,447** | **12,896** | **1,824** | **815** |

Many flagged strings were left unchanged because the flag was a false positive: ranges such as `{{min}}–{{max}}`, accepted acronyms, field labels and list separators.

## 40 representative rewrites

| # | Namespace · key | Problem | Before | After |
|---|---|---|---|---|
| 1 | `common` · `legalization.CONSULAR_LEGALIZATION` | Korean admin term | Consular confirmation | Consular legalization |
| 2 | `common` · `matchReason.SLIGHTLY_OVER_BUDGET` | em dash; idiom | Slightly above budget — scholarships could close the gap | Slightly above your budget. Scholarships could cover the difference |
| 3 | `common` · `task.reviewEssay` | em dash as separator | Review {{essayType}} — {{university}} | Review {{essayType}} for {{university}} |
| 4 | `common` · `i18n.machine` | ambiguous percentage | This language is a machine-drafted translation ({{percent}}% of this app) that has not been reviewed yet. Some text may be imperfect or in English. | This translation was made by machine and has not been reviewed yet. It covers {{percent}}% of the app, so some text may be inaccurate or in English. |
| 5 | `common` · `nav.journey` | 'journey' overuse | My journey | My progress |
| 6 | `dossier` · `group.readyCount_other` | em dash; unclear action | {{count}} documents ready for every application — show them | Show {{count}} documents ready for every application |
| 7 | `dossier` · `check.noTarget` | ambiguous; 'records' as verb | Confirming only records that it's right. | Confirming only marks this as correct. |
| 8 | `dossier` · `home.checkDetails` | em dash; ambiguous | Confirm your {{fields}} — read from your documents | Confirm the {{fields}} we read from your documents |
| 9 | `visaroute` · `route.processing` | parenthetical | How long it takes (embassy's own wording) | Processing time, in the embassy's own words |
| 10 | `visaroute` · `why.CCVI_POSSIBLE` | Korean admin term (CCVI) | Your university may also file a visa issuance certificate for you — your counselor tells you if it will. | Your university may also apply for a Certificate of Confirmation of Visa Issuance (CCVI) for you. Your counselor tells you if it will. |
| 11 | `visaroute` · `reason.TB_AT_REGISTRATION` | dated Korean term ('alien registration') | With the e-visa you give the TB certificate at alien registration in Korea instead. | With the e-visa, you submit the TB certificate when you register as a foreign resident in Korea. |
| 12 | `visaroute` · `caveat.LEGALIZATION_UNCLEAR` | em dash; 'consular confirmation'; 'vs.' | The embassy's list and the national visa manual differ on how your school documents must be confirmed (translated copy vs. consular confirmation) — your counselor confirms which one you need. | The embassy's list and the national visa manual differ on how your school documents must be authenticated: a translated copy or consular legalization. Your counselor confirms which one you need. |
| 13 | `visaroute` · `why.POST_FOR_COUNTRY` | diplomatic jargon ('post') | Students living in {{country}} apply at the Korean post in {{city}}. | Students living in {{country}} apply at the Korean embassy or consulate in {{city}}. |
| 14 | `visaroute` · `home.waiting` | ambiguous ('with others') | Your visa documents are with others — nothing to do right now | Your visa documents are being handled. Nothing to do right now |
| 15 | `visaroute` · `track.issuedText` | phrasal verb ('takes over') | Upload your visa (or the e-visa grant notice). Then your arrival plan takes over. | Upload your visa (or the e-visa grant notice). Then you can start your arrival plan. |
| 16 | `visaroute` · `money.never` | em dash; long | Never use borrowed or agency-lent money for the certificate — the embassy screens for it and it can lead to refusal. | Never use borrowed money, or money lent by an agency, for the bank balance certificate. The embassy checks for this, and it can lead to refusal. |
| 17 | `writing` · `auto.studentNote` | fragment; em dash | Rules, not a person. It points at sentences to check — it never changes or writes your text. | An automatic check that follows rules, not a person. It points out sentences to check and never changes or writes your text. |
| 18 | `writing` · `finding.NAME_MISSPELLED` | em dash; quoted fragment | “{{found}}” — did you mean “{{expected}}”? Names must be exactly right. | Did you mean “{{expected}}” instead of “{{found}}”? Names must be exactly right. |
| 19 | `writing` · `sl.LATE` | idiom ('has it') | Taking longer than expected — {{name}} has it. | Taking longer than expected. {{name}} is working on it. |
| 20 | `success` · `queue.fixtureNote` | developer language | No university or application provider allows agency submission today. Rows marked “Fixture” come from a development fixture. | No university or application provider allows agency submission today. Items marked “Fixture” are test data. |
| 21 | `success` · `method.DIRECT_API` | developer language | University API (awaiting provider integration) | Direct link to the university (not yet connected) |
| 22 | `success` · `obs.FEW_OPTIONS` | phrasal verb ('work out') | You're applying to one program — a second realistic option protects you if it doesn't work out. | You're applying to one program. A second realistic option protects you if you are not admitted. |
| 23 | `success` · `submission.fee.separate` | em dash | This is the university's application fee — not your Hangyul service fee and not tuition. | This is the university's application fee. It is not your Hangyul service fee or tuition. |
| 24 | `concierge` · `residence.groupYes` | jargon ('files as a group') | Your university files residence cards as a group — you can choose that instead of booking your own visit. | Your university applies for residence cards as a group. You can choose that instead of booking your own visit. |
| 25 | `concierge` · `help.subtitle` | idiom ('straight away'); em dash | Tell us what happened — the right person on your team gets it straight away. | Tell us what happened. The right person on your team gets it immediately. |
| 26 | `mobile` · `student.login.tagline` | idiom ('in your pocket') | Everything you need to study in Korea — in your pocket. | Everything you need to study in Korea, on your phone. |
| 27 | `mobile` · `v3.profile.unlock.language` | gamified 'unlock' | Unlocks programs that need TOPIK, IELTS or TOEFL | Lets us match you with programs that need TOPIK, IELTS or TOEFL |
| 28 | `university` · `def.applicants` | enum name visible (SUBMITTED) | Hangyul applications that reached SUBMITTED (drafts and preparation stay private to the student). | Hangyul applications that reached “Submitted”. Drafts and preparation stay private to the student. |
| 29 | `university` · `v8.ex.scheduleOff` | developer language | Scheduled exports are not available yet: they need a scheduled-jobs worker, which this installation does not run. Every export is run by hand. | Scheduled exports are not available yet. Run each export manually. |
| 30 | `university` · `v22.stageHint.decision` | ambiguous voice ('ours') | Waitlisted — a decision is still ours to make | Waitlisted. Your university still needs to decide |
| 31 | `agency` · `login.asideFoot` | developer language ('tenant-isolated') | Tenant-isolated and audited. Students never see internal notes. | Each organization's data is kept separate and every access is logged. Students never see internal notes. |
| 32 | `agency` · `v9.action.nudge` | idiom ('Nudge') | Nudge | Send reminder |
| 33 | `agency` · `templates.message.docsReminder.body` | idiom ('on track'); filler | Friendly reminder: a few required documents are still missing from your checklist. Uploading them this week keeps you on track for the deadline. | A few required documents are still missing from your checklist. Please upload them this week so you can meet the deadline. |
| 34 | `student` · `onboarding.preferences.budgetHint` | idiom ('stretch your budget') | A rough range is fine — we use it to flag programs that may stretch your budget. | A rough range is fine. We use it to mark programs that may cost more than your budget. |
| 35 | `student` · `matches.breakdown.engine` | jargon/idiom ('rules engine', 'black box') | Rules engine {{version}} · no black box: these are all the factors used. | Matching rules version {{version}}. These are all the factors used. |
| 36 | `student` · `ws3.tuition.how` | Korean-only concept ('virtual bank account') | Use the payment instructions in the university's offer letter (usually a virtual bank account in your name). Keep the receipt — you need it for your visa. The Hangyul team can check the instructions with you. | Use the payment instructions in the university's offer letter (usually a bank account number created just for you, in your name). Keep the receipt, because you need it for your visa. The Hangyul team can check the instructions with you. |
| 37 | `student` · `v9.funds.longer_other` | Korean-only term ('consulting' tier) | {{count}} months if your university is in the lower ('consulting') tier | {{count}} months if your university is in the lower tier (rated 'consulting' by the government) |
| 38 | `marketing` · `v20.uni.why.breadthBody` | untranslated Korean name (대학알리미) | Disclosed to 대학알리미 for the {{year}} survey — a measure of how wide the choice is once you are here. | Disclosed to Academy Info (대학알리미), the official university disclosure service, for the {{year}} survey. It shows how wide the choice is once you are here. |
| 39 | `marketing` · `agenciesPage.assignTitle` | idiom ('not the loudest') | Students are matched to the right agency — not the loudest. | Students are matched to the best-fit agency, not the one that advertises most. |
| 40 | `marketing` · `howPage.lede` | idiom ('fall between the cracks') | Hangyul Univ brings students, vetted partner agencies and universities onto one shared path — so nothing falls between the cracks. | Hangyul Univ brings students, vetted partner agencies and universities onto one shared path, so nothing gets missed. |

## Possible meaning problems (listed, not silently changed)

These need a product or content owner to decide. Where a rewrite above depends on my reading of the meaning, that is marked **(rewritten, please confirm)**.

1. **`success.submission.authorize.payer.UNKNOWN`** is "— your counselor confirms who pays". It is inserted into `authorize.feeValue` ("{{amount}}, paid by {{payer}} …"), so the screen shows "paid by — your counselor confirms who pays". This is a composition bug. The code should use a separate string for the unknown-payer case. Unchanged.
2. **`dossier.v9.who.reviewersWhy`, `sentOn`, `sent`** are fragments that start with "—" and are appended to a name in code. Machine translation of fragments is unreliable. It would be better to have whole sentences with a `{{name}}` placeholder. Unchanged.
3. **`dossier.home.checkDetails_more` / `_more_other`** have no `_one` form. The `_more_other` suffix only resolves if the code passes `count`. Please check that the singular "{{more}} more detail" is actually reachable. Wording is rewritten; the key structure is unchanged.
4. **`student.matches.tierText.COMPETITIVE`**: "other factors (grades, budget, timing) are closer" has no clear meaning. I read it as "make it less certain". **(rewritten, please confirm)**
5. **`common.i18n.machine`**: "({{percent}}% of this app)" was ambiguous. `packages/ui/src/brand.tsx` passes `coverage`, so it now reads "It covers {{percent}}% of the app". **(rewritten; confirmed from code)** The same parenthetical in `student.settingsV3.translation.REVIEWED|HUMAN_REVIEWED` is still ambiguous. The two strings I touched (`MACHINE_DRAFT`, `SYNTHETIC_REVIEWED`) keep the original parenthetical.
6. **`visaroute.caveat.APOSTILLE_TRANSITION`**: "Viet Nam's apostille started on 11 Sep 2026" now reads "Viet Nam started issuing apostilles on 11 Sep 2026". Please check that this is the Convention's entry-into-force date for Viet Nam and not an announcement date. **(rewritten, please confirm)**
7. **`student.v9.funds.longer_one|_other`**: the "lower ('consulting') tier" is a Korea-only IEQAS/immigration category. It now says "rated 'consulting' by the government". The exact official English name of this category should be checked against the Ministry of Justice/IEQAS notice. **(rewritten, please confirm)**
8. **`marketing.v10.services.housing.p2`**: "key money" (권리금) is a commercial-lease premium and is not normally part of student housing. It was probably meant to be *jeonse* (a large lump-sum deposit) or the maintenance fee (관리비). Unchanged.
9. **`common.task.visa.other_passport_record` / `visaroute.doc.other_passport_record.name`**: "passport record (from the Ministry of Foreign Affairs)" does not say what document this is. It may be a passport issuance certificate or a travel-history record. Unchanged.
10. **`concierge.pickup.handle`**: "Your ID or number" is ambiguous. It could be a messenger ID, a phone number or a passport number. Unchanged.
11. **`writing.sl.LATE`**: "{{name}} has it" now reads "{{name}} is working on it". This assumes it means "is assigned". **(rewritten, please confirm)**
12. **`success.obs.FEW_OPTIONS`**: "if it doesn't work out" now reads "if you are not admitted". **(rewritten, please confirm)**
13. **`university.v22.stageHint.decision`**: "a decision is still ours to make" was written in the university's voice. It now reads "Your university still needs to decide". **(rewritten, please confirm)**
14. **`success.method.DIRECT_API|PARTNER_API`, `agency.v9.sub.methods.*`**: "awaiting provider integration" now reads "not yet connected". Please check that these labels are never shown for a method that *is* live.
15. **`mobile.v3.uni.decisionNow`**: the source is all caps ("DECISION"). Machine translation may treat it as an acronym. Casing should come from CSS. Unchanged.
16. **`marketing.journey.eyebrow`, `v6.unis.title`, `v9.faq.languagesA`** still use "journey" in marketing headlines. These were left for the marketing owner.
17. **Spelling is mixed across the bundle**: program/programme, enrollment/enrolment, authorize/authorise, catalog/catalogue. Machine translation handles both spellings, but the source should pick one. This pass did not change spelling.
