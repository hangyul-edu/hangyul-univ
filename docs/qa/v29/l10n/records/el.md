# V29 l10n record — el (Greek)

Scope: V29 service-contract strings (`scripts/i18n/v28/jobs-v29/el.json` → `scripts/i18n/v28/tx-v29/el.json`). Brief: docs/qa/v29/l10n/BRIEF.md + docs/qa/v28/l10n/BRIEF.md. Korean used as canonical meaning.

Validator: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=el` → 0 problems (158 strings). Not applied (`--apply` left to the merge owner).

## Personas

- Μαρία, 18, first-time visitor from Thessaloniki
- Νίκος, 27, postgraduate applicant comparing packages
- A parent paying by card

## Register and conventions

Formal plural (εσείς) for pricing/marketing (as in existing marketing v15.pricing), informal singular in student/mobile app (as in existing student.json). Plan = πακέτο (existing). Team = "η ομάδα Hangyul Univ".

## Key term decisions

- No round limit within contracted documents: "Διόρθωση των συμβατικών δικαιολογητικών αίτησης χωρίς όριο γύρων"; never "απεριόριστη".
- Up to N managed applications: "Διαχείριση έως N αιτήσεων" / "Αιτήσεις με διαχείριση" vs "Προτεινόμενα πανεπιστήμια".
- Custom quote: "Εξατομικευμένη προσφορά".
- Airport pickup arrangement: "Οργάνωση παραλαβής από το αεροδρόμιο" (existing 'Παραλαβή από το αεροδρόμιο'); note "μέσω συνεργαζόμενης εταιρείας μεταφορών".
- Notarization = συμβολαιογραφική επικύρωση (existing); dormitory = φοιτητική εστία; Greek semicolon (·) used in visaDecision.

## Glossary (as written in the output)

| Concept | Rendering |
|---|---|
| Hangyul Univ team | Η ομάδα Hangyul Univ σάς πρότεινε μια πρόσθετη υπηρεσία |
| Additional service / add-on | Πρόσθετες υπηρεσίες |
| Add-on (compare cell) | Πρόσθετη υπηρεσία |
| Custom quote (별도 견적) | Εξατομικευμένη προσφορά |
| Airport pickup arrangement (공항 픽업 연결) | Οργάνωση παραλαβής από το αεροδρόμιο |
| Partner-provider pickup note | Την παραλαβή από το αεροδρόμιο την κανονίζουμε μέσω συνεργαζόμενης εταιρείας μεταφορών. |
| Mock interview | Δοκιμαστική συνέντευξη |
| Diagnostic consultation | Εξατομικευμένη διαγνωστική συμβουλευτική + 1 συνεδρία παρακολούθησης |
| Recommended universities (추천) | Προτεινόμενα πανεπιστήμια |
| Managed applications (지원 관리) | Αιτήσεις με διαχείριση |
| Up to N managed applications | Διαχείριση έως 2 αιτήσεων σε πανεπιστήμια |
| Up to N rounds | Έως {{count}} γύροι |
| Statement & study-plan editing | Διόρθωση δήλωσης και σχεδίου σπουδών |
| No round limit within contracted documents (card) | Διόρθωση των συμβατικών δικαιολογητικών αίτησης χωρίς όριο γύρων |
| No round limit within contract (cell) | Χωρίς όριο γύρων εντός σύμβασης |
| Premium scope note | Στο Premium η διόρθωση δεν έχει όριο γύρων, εντός των δικαιολογητικών αίτησης και του χρονοδιαγράμματος της σύμβασης. |
| No round limit (student app) | Χωρίς όριο γύρων για τα συμβατικά σου έγγραφα |
| No limit (mobile chip) | Χωρίς όριο στα συμβατικά έγγραφα |
| Dormitory | Φοιτητική εστία |
| Settling in | Βίζα και εγκατάσταση |
| Visa decision disclaimer | Η υποστήριξη για τη βίζα αφορά την προετοιμασία και την υποβολή· την απόφαση την παίρνει η αρμόδια αρχή. |
| Consultation support period | Περίοδος συμβουλευτικής |
| Contract term | Διάρκεια σύμβασης |
| Service period | Περίοδος υπηρεσίας |
| Priority response | Απάντηση κατά προτεραιότητα |
| Dedicated team | Αποκλειστική ομάδα · προτεραιότητα |
| Upgrade | Ρώτα την ομάδα για αναβάθμιση |
| Notarization | Η σύνταξη νέου εγγράφου, η μετάφραση και η συμβολαιογραφική επικύρωση μπορεί να χρεωθούν επιπλέον. |
| One-time payment in USD | Όλες οι τιμές είναι εφάπαξ πληρωμές σε δολάρια ΗΠΑ (USD). |
| Agree and pay CTA | Συμφωνώ και πληρώνω {{amount}} |

## Review passes

- Pass A (meaning vs Korean): 3 changed (visaDecision 'την απόφαση την παίρνει η αρμόδια αρχή'; supportLeft made plural-neutral; upgrade.used).
- Pass B (native marketer naturalness): 4 changed ('Αν πεις όχι, δεν αλλάζει τίποτα'; 'Δίκαιη τιμή,<br>σαφές εύρος'; 'Όχι, ευχαριστώ').
- Pass C (UI brevity, one term per concept): 2 changed (mobile chips shortened).
- Final check: no wording implies unlimited editing/documents/translation/time, guaranteed admission or a visa issued by Hangyul; recommended vs managed kept distinct; amounts left as placeholders; plan names Basic / All-in-One / Premium kept in Latin as in existing v29.pricing.<slug>.name.

## Marketing scorecard (marketing:v29.why.*; clarity, trust, naturalness, brevity, CTA strength, cultural fit; 5 each)

- s1 (title + text): 25/30
- s3 (title + text): 25/30

## Unsure

- Mixed register between pricing (formal) and app (informal) follows existing files but is visible if both render together.
- '{{count}} περιλαμβάνεται' (mockIncluded) is fine for 1, awkward for larger counts.

## Counts

Job keys: 158 · extra plural forms: 0 · kept verbatim: 0 (no `current` values) · rewritten: 0 · newly translated: 158.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
