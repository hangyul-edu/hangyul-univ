# V6 i18n wave 2: Nepali, Vietnamese, Burmese gaps (2026-10-01)

All strings are machine drafts. The locale `status` stays `MACHINE_DRAFT`. `writing` and `marketing` were not touched, and neither were `en` and `ko`.

## Scope
- `common`, `student`, `mobile`: every missing key is now filled for ne, vi and my. Plural forms follow CLDR: ne gets `_one` and `_other`, vi and my get `_other` only.
- `success`, `concierge`, `dossier`, `visaroute`: new `ne/*.json` and `vi/*.json` files. They contain the key set that `my/*.json` has, translated from the current English.
- Burmese additions: `success.status.*` (5 keys), the missing `success.method.*` keys (3) and `success.queue.failed` (1). Student-web uses the last one, in Submission.tsx.
- The other Burmese gaps are staff-only, so they stay English. I checked usage in apps/student-web, apps/student-mobile and packages/mobile-ui:
  - success: `agencyItem`, `agency`, `university`, `queue`, `feeStatus`
  - concierge: `nav`, `ws`, `today`, `waiting`, `view`, `staffStatus`, `staff`, `metrics`, `vendors`, `lease.field`, `lease.staffDisclaimer`
  - dossier: `agency`
  - visaroute: `staff`, `today`
- Seven English values are empty on purpose (`concierge step.{orientation,health_insurance,transport_card,campus_registration}.text` and `dossier upload.status.{NEEDS_REVIEW,UPLOADED,NEEDS_CORRECTION}`). validate-locale reports them as "empty value" errors. They are left out of ne and vi and removed from my, so the fallback is the same empty English string.
- `gen-resources.mjs` was re-run. The loader map now includes ne and vi for success, concierge, dossier and visaroute.

## Coverage (validate-locale, before → after)
| ns | ne | vi | my |
|---|---|---|---|
| common | 495 → 552 (100%) | 495 → 552 (100%) | 552 (100%) |
| student | 1872 → 2080 | 1872 → 2070 (100% of vi forms) | 2070 |
| mobile | 986 → 1053 | 986 → 1050 | 1040 → 1050 |
| success | 0 → 307 | 0 → 300 | 291 → 300 |
| concierge | 0 → 473 | 0 → 465 | 469 → 465 (−4 empty) |
| dossier | 0 → 178 | 0 → 171 | 174 → 171 (−3 empty) |
| visaroute | 0 → 495 | 0 → 494 | 495 |

## Terminology choices
- **Nepali.** Residence card is "विदेशी दर्ता कार्ड (외국인등록증)" and NHIS is "राष्ट्रिय स्वास्थ्य बीमा (국민건강보험)". The Korean term in brackets is what the student shows at the counter, and it is not Latin script. Apostille is "एपोस्टिल". GPA is "जीपीए". Embassy cities are in Devanagari.
- **Vietnamese.** The app keeps the established terms: "visa du học", "hợp pháp hóa lãnh sự", "Thẻ cư trú người nước ngoài (ARC)" and "Giấy xác nhận nhập học". Chinese embassy cities use their Vietnamese names (Bắc Kinh, Thượng Hải and others).

## Leak check (core workflow, 390 px, 8 personas)
- my: **1**. A scholarship name from seed data.
- ne: **32**. 29 come from essay screens, which use the `writing` namespace (out of scope). 2 come from the essay list status (also `writing`). 1 is the same scholarship name.
- vi: **24**. 23 come from `writing` and 1 is the scholarship name. Vietnamese is written in Latin script, so `scripts/qa/leak-check.mjs` would flag every word. I ran a copy with Latin-aware detection instead. It flags a word only when the word appears in the en catalogs and not in the vi catalogs. The copy is `leak-check-latin.mjs` in the session scratchpad. The repo script was not changed.
- Extra pass outside the core list (messages, explore, matches, saved, compare, budget, profile, settings, services, scholarships, university page): every remaining leak there is server or catalogue data, plus the service plan names (see below).

## Remaining leaks (not copy-fixable here)
- Seed data:
  - Scholarship names and eligibility reasons ("Freshman merit scholarship…", "TOPIK level 4 or higher", "Strong academic record (normalized GPA ≥ 80)", "Airfare, full tuition…", "NIIED (Government of Korea)", "(partnership-funded)"). Source: server/app/seed/run.py, extra_10_personas.py.
  - University description "Kyung Hee University is a private university in Seoul."
  - Message thread subjects and team name ("Application strategy & scholarship plan", "Your study-in-Korea team").
- `writing` namespace for ne and vi: essay workspace and review status. Owned by another workstream.
- Settings language aria-label shows the English language name ("भाषा: Nepali"). This is component code that uses the English name.
- Service plan names "Free Explorer", "Application Support" and "Premium Success" are kept as product names, as Burmese does.

## Wave 3: student-facing `writing` keys for ne, vi, my (2026-10-01)
- Key set comes from grepping `writing:` in Essays.tsx, EssayEditor.tsx and lib/writing.ts, with the dynamic keys expanded from en. apps/student-mobile and packages/mobile-ui use no `writing` keys. The set is `student.*`, `student6.*`, `sl.*`, `level.*`, `topic.*`, `finding.*`, `auto.{label,studentNote}`, `gate.studentItem.*`, `gate.studentState.*` and the student `prompt.*` keys (`words`, `chars`, `*Student`), for 121 en keys in total. Excluded: `finding.SIMILAR_TEXT`, which the server sends only to staff (`staff_only`), and `finding.PROMPT_PART_MISSING_*`, which is reviewer wording. The server finding has no `count`, so the student sees the server text. Staff subtrees were not changed.
- Added: ne 85 and vi 83, translated from the current en. vi and my have `_other` only, so the `_one` forms were removed from vi and my `writing.json`. my got 2 keys (`finding.OTHER_PROGRAM`, `prompt.unconfirmedStudent`). The stale `finding.PROMPT_PART_MISSING` key was removed from my because en now has only plural forms. ne `topic.GPA` is now "जीपीए", matching the wave-2 terminology. Everything is still a machine draft.
- validate-locale writing: ne 36 → 121, vi 36 → 119, my 120 → 120 with 0 errors (it had 1 unknown-key error before). gen-resources and check.mjs both pass.
- Leak check (core workflow, 390 px): ne 32 → 1, vi 24 → 1 (scratchpad `leak-check-latin.mjs`), my 1 → 1. The one leak left in each locale is the seeded scholarship name ("Freshman merit scholarship…", server/app/seed).
