# V28 l10n review: el (Ελληνικά)

Scope: all 370 keys in `scripts/i18n/v28/jobs/el.json`. Output: `scripts/i18n/v28/tx/el.json`. Register as in the
bundle: marketing, quick-fit and consoles use polite plural (εσείς); the student app, visa route and concierge use εσύ.
Brand "Hangyul Univ" / "Hangyul" stays Latin ("η Hangyul"). The team is "η ομάδα της Hangyul" (never "ο σύμβουλός σου").
V27 glossary (`docs/qa/v27/l10n/el.md`) reused.

## Personas

1. **Ελένη, 18, Θεσσαλονίκη: first-time visitor.** Third year of Λύκειο, TOPIK 2; arrives on a university page and the
   quick fit. Needs plain words and the far tier phrased as preparation, never as odds.
2. **Νίκος, 27, Πάτρα: comparison shopper.** Compares English-taught master's programmes and the plans; reads every
   condition literally and expects the same term in the compare table and the cards.
3. **Μαρία, 52, Ελένη's mother (payer), plus agency/university staff.** Wants to know who receives money and when;
   staff want short console labels.

## Glossary

| English | Korean | Greek (chosen) |
|---|---|---|
| the Hangyul team | 한귤 상담팀 | η ομάδα της Hangyul |
| scholarship | 장학금 | υποτροφία |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); short label "GKS" |
| admission guide | 모집요강 | οδηγός εισαγωγής |
| apostille | 아포스티유 | επισημείωση (Apostille) |
| consular legalization | 영사확인 | προξενική επικύρωση |
| Korean language institute | 어학당 | ινστιτούτο κορεατικής γλώσσας |
| offer | 합격 | προσφορά |
| enrollment | 등록 | εγγραφή |
| intake | 모집 학기 | περίοδος εισαγωγής |
| program | 과정 | πρόγραμμα |
| plan (paid) | 플랜 | πακέτο |
| tuition | 등록금 | δίδακτρα |
| dormitory | 기숙사 | εστία |
| residence card | 외국인등록증 | κάρτα διαμονής |
| proof of funds | 재정 증명 | αποδεικτικό οικονομικής επάρκειας |
| e-visa | 전자비자 | ηλεκτρονική βίζα |
| essay | 에세이 | δοκίμιο |
| case / case owner | 케이스 / 담당자 | υπόθεση / υπεύθυνος |
| match | 매칭 | αντιστοιχία |
| Needs more preparation (far tier) | 준비가 더 필요한 대학 | Χρειάζεται περισσότερη προετοιμασία |
| deadline | 마감 | προθεσμία |
| receipt number | 접수번호 | αριθμός απόδειξης |
| post (embassy/consulate) | 공관 | αρμόδια αρχή |

## Pass A: meaning (45 strings changed)

All 20 "ο σύμβουλός σου" strings now name the team; the 7 quick-fit tier strings follow the V28 English; dormitory
labels follow "Dormitory".

- `visaroute:v5.helpAsk`: *Ρώτα τον σύμβουλό σου για τη βίζα σου* → *Ρώτα την ομάδα της Hangyul για τη βίζα σου*
- `common:fit.tier.UNCLEAR.title`: *Υπάρχει ακόμη αρκετός δρόμος* → *Χρειάζεται περισσότερη προετοιμασία*
- `student:v9.announced.rule.STUDY_DEPOSIT_SCHEME`: *Φοιτητές χωρίς κορεατικά…* → *Φοιτητές … χωρίς αποτέλεσμα σε εξέταση κορεατικών…*
- `university:v22.stageHint.decision`: *…η απόφαση είναι ακόμη δική μας* → *Σε λίστα αναμονής. Η απόφαση εκκρεμεί ακόμη*
- `marketing:v20.uni.why.foundedBody`: *…στα πιο παλιά ιδρύματα…* → *…στα παλαιότερα ιδρύματα του μητρώου.* ("one of the older", not "the oldest")

## Pass B: native naturalness (13 strings changed)

- `concierge:emergency.note`: em dash removed → *Σε έκτακτη ανάγκη, τηλεφώνησε πρώτα. Μετά ενημέρωσε την ομάδα της Hangyul.*
- `marketing:v20.city.Busan.body`: *ένα καλοκαίρι για το οποίο ταξιδεύει η υπόλοιπη Κορέα* → *ένα καλοκαίρι που προσελκύει επισκέπτες από όλη την Κορέα*
- `marketing:seo.home.description`: *διεκπεραιώστε … πραγματικούς ανθρώπους να βοηθούν* → *τακτοποιήστε … πραγματικούς ανθρώπους στο πλευρό σας*
- `student:v16.pay.chooseSubtitle`: *…με όσα θέλεις να κάνει η Hangyul μαζί σου* → *…ανάλογα με το πόση βοήθεια θέλεις από τη Hangyul*
- `university:v25.in.yield`: *Εγγραφές από αποδεκτούς* → *Προσφορές που κατέληξαν σε εγγραφή*

## Pass C: UI context, brevity, one term per concept (11 strings changed)

- `agency:v8.ops.ageing.title`: *Παλαίωση υποθέσεων ανά στάδιο* → *Χρόνος παραμονής υποθέσεων ανά στάδιο*
- `agency:v25.today.student_silent`: *φοιτητές χωρίς απόκριση* → *φοιτητές δεν απαντούν*
- `student:v26.now.owner.STUDENT`: *Εξαρτάται από σένα* → *Εσύ* (owner column label)
- `visaroute:money.title`: *Απόδειξη οικονομικών μέσων* → *Αποδεικτικό οικονομικής επάρκειας* (glossary)
- `university:kpi.insufficientDetail`: *Βάσει {{n}} εγγραφών — εμφανίζεται από {{min}}* → *Βάσει {{n}} εγγραφών. Εμφανίζεται όταν υπάρξουν {{min}}.*

## Final source ↔ target comparison

All 370 compared against `en` and `ko`; placeholders identical (validator); Greek script in every non-trivial string.
영사확인 is always *προξενική επικύρωση*.

## Marketing scorecard (clarity / trust / naturalness / brevity / CTA / cultural fit, 5 each)

| Section | Draft | Final | Change after draft |
|---|---|---|---|
| SEO home description | 24 | 26 | rewrite above |
| Journey eyebrow | 22 | 26 | *Η διαδρομή του φοιτητή* → *Βήμα βήμα* |
| Pricing (lede, compare rows, Premium f5) | 23 | 26 | lede leads with *Επιλέξτε πόση βοήθεια θέλετε* |
| City pages (Busan, Gyeonggi, Seoul line) | 23 | 26 | idiomatic rewrites |
| University page (why-cards, CTA, GKS/English cards) | 23 | 26 | CTA *Σκέφτεστε να κάνετε αίτηση εδώ;*; whyTitle *Τι το κάνει να ξεχωρίζει* |
| Universities list title | 25 | 26 | — |
| FAQ languages answer | 25 | 26 | — |

## Unsure

- Register split (εσείς on marketing/quick fit, εσύ in the app) follows the existing bundle; the fit strings in `common`
  stay εσείς as the V27 currents did.
- `university:v28.pipe.*` *Ροή* for "pipeline"; `visaroute:staff.post` *Αρμόδια αρχή*.
- `student:v4.ws.team.approvedEssay` *Ενέκρινε: {{essay}}* and `success:item.ESSAY_WRITE.title` *Γράψε: {{labelLower}}* use a colon to avoid case agreement.
- `marketing:v28.uni.why.gks` *Συμμετέχει στο GKS* (neuter, "το πρόγραμμα GKS").

## Counts

Job keys 370 · kept verbatim 47 · rewritten 69 · newly translated 254 · extra plural forms 0 (Greek: one/other).
Validator: `V28 l10n (1 locales): 370 strings valid, 0 problems`.

## Second pass (jobs2)

Input: `scripts/i18n/v28/jobs2/el.json` (630 keys: marketing 2, student 39, success 465, dossier 124; all `current` null).
Output: `scripts/i18n/v28/tx2/el.json`. Same rules, personas and first-pass glossary (no new terms). Student-facing
"your counselor" → the Hangyul team throughout (success `item.*`, `submission.*`, dossier reasons/findings); `{{counselor}}`
placeholders and the agency console label `agency.ownerShort.counselor` keep the person/role. Gendered `{{label}}`
inserts are handled with "{{label}}: …" constructions so no adjective has to agree with an unknown noun. The optional
adjective slot `dossier:upload.status.*` (NEEDS_REVIEW / UPLOADED / NEEDS_CORRECTION) stays empty as in English;
`upload.haveTitle*` were rebuilt around a fixed noun ("{{status}} έγγραφο ({{doc}})") so the slot reads correctly empty or filled.

Counts: job keys 630 · kept verbatim 0 · rewritten 0 · newly translated 627 + 3 intentionally empty · extra plural forms 0 (Greek one/other).
Passes: A meaning (630 compared with `en`/`ko`; 22 counselor→team fixes), B naturalness, C UI brevity/one term per concept;
final source↔target comparison clean. Marketing: only 2 informational lines (`v20.uni.intl.*`), not CTA copy; scored
26/30 as a section.
Validator: `JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=el` → 0 problems.

Examples (before = English source → after):
- `success:item.DOC_LEGALIZE.title`: *{{label}} still needs consular legalization* → *{{label}}: χρειάζεται ακόμη προξενική επικύρωση*
- `success:item.INTERVIEW_REQUIRED.why`: *Your counselor can run a practice interview…* → *Η ομάδα της Hangyul μπορεί να κάνει μαζί σου μια δοκιμαστική συνέντευξη πριν.*
- `success:submission.fee.separate`: → *Αυτό είναι το παράβολο αίτησης του πανεπιστημίου. Δεν είναι η χρέωση υπηρεσίας της Hangyul ούτε τα δίδακτρα.*
- `success:obs.ALL_POSSIBLE`: → *Όλες οι αιτήσεις σου είναι Πιθανές αντιστοιχίες. Σκέψου να προσθέσεις μία Ισχυρή αντιστοιχία.*
- `dossier:upload.haveTitle_other`: → *Έχεις ήδη {{status}} έγγραφο ({{doc}}) που χρησιμοποιείται σε {{count}} αιτήσεις*

Unsure (second pass):
- "Το {{university}}" / "το {{agency}}" assume neuter articles (πανεπιστήμιο / γραφείο); names read as such.
- "ο/η {{counselor}}" slash article for unknown gender.
- "Παράβολο αίτησης" for the application fee; agency = "γραφείο" as in the bundle.
- "portfolio" left in Latin (common in Greek admissions); `queue.fixture` keeps "Fixture".

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
