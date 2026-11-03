# V31 native-quality review — Greek (el)

Locale `el` (Greece, Cyprus). Job `scripts/i18n/v28/jobs-v31/el.json`, output `scripts/i18n/v28/tx-v31/el.json`,
glossary `docs/qa/v31/l10n/glossary/el.json`. Brief: `docs/qa/v31/l10n/BRIEF.md`.

## Counts

| | keys |
|---|---|
| Job keys reviewed (semantic, naturalness, product passes + back-check) | 1,729 (common 310 · concierge 181 · dossier 66 · marketing 384 · student 590 · success 33 · visaroute 164 · writing 1) |
| Kept verbatim | 1,078 (incl. 18 `v31` keys whose existing Greek already says what the new source says) |
| Rewritten | 651 |
| — new source (`v31`, incl. the 4 missing keys) | 235 |
| — naturalness (incl. register: informal «εσύ» → formal-polite «εσείς») | 375 |
| — terminology | 35 |
| — meaning (non-`v31` keys) | 3 |
| — quality (UI role / format) | 3 |
| Extra CLDR plural forms | 0 (Greek needs only `_one`/`_other`) |

Register. About 300 existing strings addressed the reader as «εσύ» (Ξέχασες τον κωδικό σου;, Ανέβασε, Δες…), mixed with
formal strings on the same screens. Every student, concierge, dossier, visa and marketing string now uses the formal-polite
web register («σας», «Ανεβάστε», «Δείτε»). Buttons stay as Greek UI nouns where that is the convention (Αποθήκευση,
Ανέβασμα, Συνέχεια).

Terminology decisions applied across all keys: «συμβουλευτική συνάντηση» for a consultation (not «συνεδρία», «κλήση»),
«έγκριση εισαγωγής» for an admission offer (not «προσφορά»), «επιστολή εισαγωγής» for the admission letter (one term, was
mixed with «επιστολή αποδοχής»), «επισημείωση Apostille» and «προξενική επικύρωση» (never bare «επικύρωση»),
«συμβολαιογραφική επικύρωση», «ινστιτούτο κορεατικής γλώσσας» (not «σχολή γλώσσας»), «κείμενο» for an essay (not
«δοκίμιο»), «προσωπική δήλωση» / «σχέδιο σπουδών», «γύρος διόρθωσης» for an editing round, «υπηκοότητα» (not «εθνικότητα»
/ «ιθαγένεια»), «μετεγγραφή», «King Sejong Institute» kept as the official name, «η ομάδα της Hangyul» wherever the source
says "the Hangyul team", «πακέτο» for a plan, plan names in Latin. Placeholders that are nouns of unknown gender
(«{{category}}», «{{label}}», «{{essay}}») are now introduced by a head noun («το έγγραφο «…»», «το κείμενο «…»») so the
article always agrees.

## Critical semantic issues found in `current`

| # | key | what it said | what it now says |
|---|---|---|---|
| 1 | `common:v29.pricing.compare.row.support` | «Περίοδος συμβουλευτικής» — support window read as a consultation period | «Περίοδος για ερωτήσεις μετά τη συνάντηση» |
| 2 | `common:v29.pricing.compare.scopeNote` | omitted that writing new documents, translation and notarization are not included | exclusion added in full |
| 3 | `common:v29.pricing.compare.value.visa.DOCUMENT_PREP` | «Προετοιμασία δικαιολογητικών» — as if Hangyul prepares the visa documents | «Βοήθεια στην προετοιμασία των δικαιολογητικών βίζας» |
| 4 | `common:v29.pricing.all_in_one.f5` | «Δικαιολογητικά βίζας έτοιμα» — promised finished visa documents | «Βοήθεια στην προετοιμασία των δικαιολογητικών βίζας · παρακολουθούμε τις προθεσμίες για την εστία» |
| 5 | `common:v29.pricing.premium.position` | application stage missing («έως τη βίζα…») | «από την αίτηση έως τη βίζα, την άφιξη και τις πρώτες εβδομάδες» |
| 6 | `common:v29.addon.item.airport_pickup` | «Οργάνωση παραλαβής» — no partner; reads as Hangyul transport | «Παραλαβή από το αεροδρόμιο μέσω συνεργάτη» |
| 7 | `common:v29.pricing.all_in_one.f1`, `premium.f1` | «έως 5/7 προτάσεις» — unclear what is recommended | «έως 5/7 προτεινόμενα πανεπιστήμια» |
| 8 | `common:essayStatus.AGENCY_REVIEW` | «Στον αξιολογητή σας» — an unnamed assessor | «Στην ομάδα της Hangyul» |
| 9 | `marketing:v11.services.s2.text` | «Έκδοση βίζας…» — as if Hangyul issues visas | «Σας βοηθάμε με την αίτηση για βίζα…» |
| 10 | `marketing:v11.services.s1.text` | «αναλαμβάνουμε όλη τη διαδικασία», «σχολές γλώσσας», «πραγματικά ταιριάζουν» | we suggest universities and Korean language institutes, then help you prepare documents and deal with the university |
| 11 | `marketing:v11.hero.lede` | «Κάνουμε το όνειρό σου πραγματικότητα» — an outcome promise, source content missing | find the right university and get every step done with a team beside you; start with what you want to study |
| 12 | `marketing:v11.why.s3.title` | «Το πιο λογικό κόστος, το καλύτερο αποτέλεσμα» — superlative and result claim | «Δίκαιη τιμή, χωρίς εκπλήξεις» |
| 13 | `marketing:v11.why.s1.*` | «ως την επιτυχία», «συνεργάτης στον δρόμο προς την επιτυχία» — implies a result | help at every stage, the same team from start to finish |
| 14 | `marketing:v11.why.s2.*` | «100% δική σου», «αξιοποιεί στο έπακρο» | plan built from grades, goals and budget so suggested universities are realistic |
| 15 | `marketing:v11.faq.q6.a` | «Κάθε πανεπιστήμιο προσφέρει υποτροφίες» | «Τα περισσότερα προσφέρουν…» |
| 16 | `marketing:v11.unis.title` | «…περιμένουν την εγγραφή σου» — implies admission | «…για να επιλέξετε» |
| 17 | `marketing:v11.services.s3.title` | not about a community of students who have been there | «Μια κοινότητα φοιτητών που έχουν περάσει τον ίδιο δρόμο» |
| 18 | `marketing:v11.faq.q4.q` | «Μπορώ να προετοιμαστώ χωρίς κορεατικά;» — asked about preparing, not applying | «Μπορώ να κάνω αίτηση αν δεν μιλάω κορεατικά;» |
| 19 | `marketing:v12.terms.universityInfo.p` | contained Hangul («대학알리미») and "what a member is entitled to" | «Academy Info», "what you are eligible for" |
| 20 | `marketing:v20.city.Gyeonggi.*` | "roomier" as «πιο πράσινη»; body lost that more students live in dormitories | «πιο ευρύχωρη»; conclusion restored |
| 21 | `marketing:v20.uni.intl.admissionsLine` | «…σε ξεχωριστή σελίδα από τις εγχώριες» — a separate page, not a separate admissions track | «Έχει ξεχωριστή διαδικασία εισαγωγής για διεθνείς φοιτητές.» |
| 22 | `marketing:v20.uni.why.ieqasBody` | «αξιολογούνται με χαλαρότερα κριτήρια βίζας» — looser criteria ≠ simpler screening | «ο έλεγχος για τη βίζα είναι απλούστερος» |
| 23 | `student:discover.verdict.reach`, `success:group.possible` | «Πιθανή αντιστοιχία» — lost "meets requirements, needs checking" | «Πληροί τις προϋποθέσεις, χρειάζεται έλεγχο» |
| 24 | `student:register.privacyNote` | omitted the partner agency that also receives data | «…στην ομάδα της Hangyul που σας υποστηρίζει (μαζί με το συνεργαζόμενο γραφείο της)…» |
| 25 | `student:phase.prepare.text` | «γράψε… με την ομάδα Hangyul Univ» — reads as co-writing (editing ≠ writing) | «γράψτε… με βάση τα σχόλια της ομάδας της Hangyul» |
| 26 | `student:v15.services.allowance.unlimited` | «Συνεχής επαφή» — unlimited without the service term | «…οποιαδήποτε στιγμή κατά τη διάρκεια της υπηρεσίας σας» |
| 27 | `student:v15.services.allowance.key.max_managed_applications` | «Αιτήσεις υπό διαχείριση» — passive count label (forbidden form) | «Αιτήσεις που διαχειριζόμαστε μαζί σας» |
| 28 | `student:v4.ws.team.final` | «…και μετά αποστολή της αίτησής σου» — reads as Hangyul submitting | «Τελικός έλεγχος πριν υποβάλετε εσείς την αίτηση…» |
| 29 | `student:compare.legalCount_*`, `profileV3.why.basics` | bare «επικύρωση» for consular legalization | «επισημείωση Apostille ή προξενική επικύρωση» |
| 30 | `student:dashboard.counselor.nextCall`, `messages.call` | «κλήση», «βιντεοκλήση» — not a consultation | «συμβουλευτική συνάντηση (μέσω βίντεο)» |
| 31 | `student:register.consent.PRIVACY.summary` | «κωδικός (κρυπτογραφημένος)» — a hash is not encryption | «κατακερματισμένος κωδικός πρόσβασης (hash)» |
| 32 | `concierge:arrived.confirmText` | «η κάρτα διαμονής πρέπει να εκδοθεί μέσα σε 90 ημέρες» — the student must apply, not get it issued | «Πρέπει να κάνετε αίτηση… μέσα σε 90 ημέρες» |
| 33 | `concierge:step.pickup.sub` | «Κάποιος σε περιμένει» — no partner | «Ο συνεργάτης για την παραλαβή σάς περιμένει στις αφίξεις» |
| 34 | `concierge:status.DORMITORY.ASSIGNED` | «Προσφέρθηκε δωμάτιο» — offered ≠ assigned | «Δόθηκε δωμάτιο» |
| 35 | `dossier:group.extraCount` | «… φυλάσσονται για αργότερα» — not a show control | «Εμφάνιση {{count}} ακόμη αποθηκευμένων εγγράφων» |
| 36 | `dossier:package.line`, `page.summary` | «απαιτήσεις», «έτοιμα για κάθε αίτηση» — wrong unit / added claim | «Απαιτούνται {{total}} έγγραφα · {{ready}} έτοιμα», «{{ready}} από {{total}} έτοιμα» |
| 37 | `visaroute:step.slow_items.why` | «Οι επικυρώσεις…» — apostille missing | «Η επισημείωση Apostille ή η προξενική επικύρωση…» |
| 38 | `visaroute:help.ask` | «Ρώτα έναν άνθρωπο» | «Ρωτήστε την ομάδα της Hangyul» |
| 39 | `common:appStatus.OFFERED`, `student:stage.OFFERED` | «Λήφθηκε προσφορά» | «Έγκριση εισαγωγής» |

## Marketing scorecard (after rewrite)

CLARITY / NATURALNESS / SPECIFICITY / TRUST / PERSUASION / BREVITY, each /5.

| Area | C | N | S | T | P | B | Total |
|---|---|---|---|---|---|---|---|
| Hero (`v11.hero.*`, `seo.home.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Why section (`v11.why.*`, `v29.why.*`) | 5 | 5 | 4 | 5 | 4 | 4 | 27 |
| Services rows (`v11.services.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Pricing: plan cards + comparison (`v29.pricing.*`, `v15.pricing.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| Add-ons and purchase notes (`v29.addon.*`, `v29/v31.pricing.notes.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |
| FAQ (`v11.faq.*`) | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| Closing CTA (`v11.cta.*`) | 5 | 5 | 4 | 5 | 4 | 5 | 28 |
| Directory / discovery (`v12.directory.*`, `v20/v21/v23/v24.dir.*`, `v20.uni.*`, `fit.*`) | 5 | 4 | 5 | 5 | 4 | 4 | 27 |

Before the rewrite the hero, why and services areas would have scored under 20 (TRUST and SPECIFICITY: dream/success
promises, superlatives, visa issuance). Every area is now 26/30 or higher. Internal review tool, not a measurement.

## Product scorecard (student app)

ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY, each /5.

| Area | A | S | N | C | B | Fixed |
|---|---|---|---|---|---|---|
| Home | 5 | 5 | 4 | 5 | 4 | formal register, document-count plural, «η ομάδα σας στη Hangyul», services-in-progress title |
| Applications | 5 | 5 | 4 | 5 | 4 | admission offer term, the student submits, "meets requirements, needs checking" tier, gender-safe task titles |
| Documents | 5 | 5 | 4 | 5 | 4 | stored-documents toggle, package line, automatic-check note, «Ανέβασμα» |
| Services | 5 | 5 | 4 | 5 | 4 | support window, scoped "unlimited", consultation term, managed applications, external costs |
| Visa / housing | 5 | 5 | 4 | 5 | 4 | apostille / consular legalization, sponsor financial documents, TB certificate, partner pickup, residence-card 90-day rule |

## Unresolved ambiguity / limits (listed, not guessed)

- Korean place names are transliterated slightly differently in `common:region.*` (e.g. «Πουσάν», «Νταεγκού») and in the
  marketing city/group copy («Μπουσάν», «Ντεγκού»); both spellings are in Greek use. Left as is to avoid churn; a single
  house spelling should be chosen.
- `marketing:v12.privacy.retention.advertising.record` ("Records of labeling and advertising", 표시·광고): rendered
  «Αρχεία σχετικά με επισημάνσεις και διαφημίσεις»; the exact Greek legal equivalent of the Korean 표시 category is unclear.
- `common:fit.level.ASSOCIATE` kept as «Διετές πτυχίο (associate)»; Greece has no associate degree.
- Greek `_one` with `{{count}}` placeholders: `student:v8.compare.budget_one` and `v9.discovery.scholarship_one` have no
  `{{count}}` in English, so the Greek has none either (fine for Greek, where `_one` is exactly 1).

## Status

`SYNTHETIC_NATIVE_REVIEWED_V31`
