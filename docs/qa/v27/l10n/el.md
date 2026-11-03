# V27 l10n review — Greek (el)

Output: `scripts/i18n/v27/tx/el.json`, 729 of 729 keys (common 205, student 212, mobile 58, dossier 32, visaroute 88, marketing 134).
Register: this follows the existing `packages/i18n/locales/el` bundle, which differs by namespace. `common` and `marketing` use the polite plural *εσείς* (σας). `student`, `mobile`, `dossier` and `visaroute` use the friendly *εσύ* (σου).
Brand: "Hangyul Univ" / "Hangyul" stays in Latin script. The company takes the feminine article ("η Hangyul", "στη Hangyul") and the product the neuter ("το Hangyul Univ"), as in the bundle. The team is "η ομάδα Hangyul".
Script: every string contains Greek letters, so the validator's script check passes. Test names stay in Latin script (TOPIK, IELTS Academic, TOEFL iBT …) inside Greek sentences.

## Personas

- **Ελένη, 18, Θεσσαλονίκη**: in the third year of Λύκειο. She is applying for a bachelor's in Korea, has TOPIK 2 and is anxious about paperwork.
- **Νίκος, 27, Πάτρα**: a civil engineer. He is looking at an English-taught master's, holds IELTS Academic 7.0 and reads every condition literally.
- **Μαρία, 52, Ελένη's mother**: she pays the tuition. She wants to know who receives money, when, and how to avoid intermediaries.

## Glossary

| English | Korean | Greek (chosen) |
|---|---|---|
| scholarship | 장학 | υποτροφία |
| Global Korea Scholarship (GKS) | 정부초청장학 | Global Korea Scholarship (GKS); label "Υποτροφία Global Korea Scholarship (GKS)" |
| admission guide | 모집요강 | οδηγός εισαγωγής |
| apostille | 아포스티유 | επισημείωση (Apostille) |
| consular legalization | 영사확인 | προξενική επικύρωση |
| Apostille Convention | 아포스티유 협약 | Σύμβαση της Χάγης για την επισημείωση |
| Korean language institute | 한국어학당 | ινστιτούτο κορεατικής γλώσσας (πανεπιστημίου) |
| admission letter | 표준입학허가서 | επιστολή αποδοχής |
| offer | 합격 | προσφορά (θέσης) |
| counselor | 담당자 | σύμβουλος |
| plan (paid) | 플랜 | πακέτο; visa plan = πλάνο |
| tuition | 등록금 | δίδακτρα |
| dormitory | 기숙사 | (πανεπιστημιακή) εστία |
| residence card | 외국인등록증 | κάρτα διαμονής |
| proof of funds / bank balance certificate | 재정 증빙 / 잔고증명서 | αποδεικτικό οικονομικής επάρκειας / βεβαίωση τραπεζικού υπολοίπου |
| CCVI | 사증발급인정서 | πιστοποιητικό έγκρισης έκδοσης βίζας (CCVI) |
| visa / e-visa | 비자 / 전자비자 | βίζα / ηλεκτρονική βίζα |
| TB certificate | 결핵 진단서 | πιστοποιητικό φυματίωσης |
| immigration office | 출입국관리사무소 | γραφείο μετανάστευσης |
| match / strong / possible | 매칭 | αντιστοιχία / ισχυρή / πιθανή αντιστοιχία |
| Recommended (sort) | 추천순 | Προτεινόμενα (σειρά περιήγησης, όχι κατάταξη) |
| Integrated master's and PhD | 석박사 통합 | ενιαίο μεταπτυχιακό και διδακτορικό |
| personal statement / essay | 자기소개서 / 에세이 | προσωπική δήλωση / δοκίμιο |
| KRW amounts | 원 | "{{amount}} γουόν" |

## Pass A: meaning (3 strings changed)

1. `student:matches.method.stage2` "…με ονομαστικούς, σταθμισμένους παράγοντες…" → "…με συγκεκριμένους, σταθμισμένους παράγοντες…". *Ονομαστικός* means "nominal", but the source means "named, explicit" factors.
2. `marketing:v15.pricing.lede` "Επιλέξτε πόσο σας στηρίζουμε." → "Επιλέξτε μέχρι πού θα σας στηρίξουμε." The source is about the extent of support (diagnosis, applications or settling in), not an amount.
3. `marketing:flow.university.text` "…και μετά σας βοηθά να εγκατασταθείτε." → "…και μετά βοηθά τον φοιτητή να εγκατασταθεί." The card describes the university's role to every reader, so it now names the student instead of addressing the reader.

## Pass B: native naturalness (15 strings changed)

1. `student:onboarding.finish.title` "Είσαι έτοιμος/η!" → "Όλα έτοιμα!". Slash gender forms read as machine output, so every one was rewritten gender-neutrally. The others are `dashboard.stageText.VISA` ("Η αποδοχή σου ήρθε…"), `APPLICATION_SUBMIT`, `v4.unlock.topik` and `v4.unlock.ielts` ("θα πληρούσες τα κριτήρια"), `essays.emptyText` and `mobile:v3.home.stageLine.admission` ("Σε δέχτηκαν…").
2. `student:legalFlow.note.JOINS` "Χώρα {{country}}: προσχωρεί…" → "Στις {{date}} η χώρα {{country}} προσχωρεί…". This is natural word order, and "η χώρα {{country}}" avoids gendering the country name. `JOINED` got the same fix.
3. `common:task.writeEssay` "Γράψτε: {{essayType}} για {{university}}" → "Γράψτε: {{essayType}} – {{university}}". Greek "για" needs an article whose gender depends on the university name. The same fix went into `reviewEssay` and `reviseEssay`.
4. `student:matches.tierText.COMPETITIVE` "…το κάνουν λιγότερο βέβαιο." → "…αφήνουν περιθώριο αβεβαιότητας." The draft was a calque.
5. `mobile:university.cohorts.riskHint` "…τα συστήματά σας…" → "…τα συστήματα του πανεπιστημίου…". The university screens in `mobile` use *εσύ*, so the plural address was removed.

Also changed in this pass: `dossier:reason.NEAR_TOO_OLD` (colloquial "εκδομένο" → "αν έχει εκδοθεί τις τελευταίες {{days}} ημέρες").

## Pass C: UI context & brevity (5 strings changed)

1. `common:fit.reason.met_track` "…για τα προγράμματα: {{track}}." → "…({{track}})."
2. `common:fit.reason.needed_track` "Τα προγράμματα ({{track}}) απαιτούν…" → "{{track}}: απαιτείται…"
3. `common:docCategory.PORTFOLIO` "Χαρτοφυλάκιο (portfolio)" → "Χαρτοφυλάκιο εργασιών". This is a document-type label in one language.
4. `common:fit.save` "Αποθήκευση: {{name}}" → "Αποθήκευση {{name}}". This is an aria/button label without a colon.
5. `common:fit.saved` "Αφαίρεση από τα αποθηκευμένα: {{name}}" → "Αφαίρεση {{name}} από τα αποθηκευμένα"

Consistency check: there is one term each for scholarship (υποτροφία), apostille (επισημείωση, glossed "(Apostille)" on first use per screen), consular legalization (προξενική επικύρωση), admission letter (επιστολή αποδοχής) and counselor (σύμβουλος). The register was checked namespace by namespace: no σας remains in student-facing `student`, `mobile`, `dossier` or `visaroute` strings, and no σου remains in `common` or `marketing`.

## Final source ↔ target comparison

All 729 strings were re-read against `en`, with `ko` used for 건, 등급 and 컨설팅. All placeholders and `<em>` are intact, and nothing implies an admission probability or guarantee. Greek plurals are one/other, so `_one` keys are singular and `_other` and base keys use the plural. The Hangul in `v20.uni.why.breadthBody` was replaced by a Greek description of Academy Info. Korean place names are transliterated into Greek (Σεούλ, Πουσάν, Ίντσεον, Τσεονάν…), as the bundle does. Validator: `node scripts/i18n/v27/validate.mjs --only=el` reports 729 valid, 0 problems.

## Unsure

- **`fit.test.*` labels such as "TOPIK (κορεατικά)" and "TOEFL iBT (αγγλικά)".** The validator rejects a string with no Greek letters, so each test name got a short Greek language tag. The test names themselves stay in Latin script, as the brief requires. A human reviewer may prefer the bare names, which would need a validator exception.
- **`uni27.schol.amount` "{{amount}} γουόν".** KRW is written as "γουόν" for the same reason. The bundle elsewhere uses "κορεατικά γουόν (KRW)".
- **`v9.funds.longer_*` «consulting».** The government tier name is kept in quotes as a foreign term.
- **`fit.level.ASSOCIATE` "Διετές πτυχίο (associate)".** Greece has no direct equivalent of 전문학사.
- **Πουσάν vs Μπουσάν.** The bundle is split 5/5. I used Πουσάν.
- **`fit.gpa.placeholder` "π.χ. 3.6".** It keeps the decimal point for input compatibility.

## Follow-up (5 keys)

Added after the main pass (two new reasons; the UNCLEAR tier re-sourced as "far above current result"). Meaning, naturalness and brevity passes applied; no wording implies admission probability.

- `fit.reason.noneRequiredLater` → Δεν απαιτείται γλωσσικό αποτέλεσμα για την αίτηση. Μετά την εισαγωγή θα χρειαστείτε {{tests}} ή υψηλότερα.
- `fit.reason.far` → Απαιτείται {{options}} ή υψηλότερα, πολύ πάνω από το τωρινό σας αποτέλεσμα.
- `fit.tier.UNCLEAR.title` → Υπάρχει ακόμη αρκετός δρόμος
- `fit.tier.UNCLEAR.short` → Θέλει προετοιμασία
- `fit.tier.UNCLEAR.lede` → Το τωρινό σας αποτέλεσμα είναι αρκετά χαμηλότερο από τη δημοσιευμένη απαίτηση. Δώστε στον εαυτό σας περισσότερο χρόνο για προετοιμασία και ελέγξτε ξανά.

Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)
