# V6 — Demo-data presentation log

Principle (REPORT §36.3): product UI looks like production; the development environment is disclosed **once** by the
DevAccess chip (web) / DevIndicator (native). Data honesty stays in the data: `is_demo`, `verification_status = 'DEMO'`,
prompt `SAMPLE`, cost basis `SAMPLE` and vendor label `DEMO` are unchanged in the database and API. Seeded data never
exists in production.

## 1. Seed renames (server/app/seed) — old → new

| Where | Old | New |
|---|---|---|
| catalog_data.AGENCIES | Lotus Bridge Education (Demo) | Lotus Bridge Education |
| | Silk Road Study Partners (Demo) | Silk Road Study Partners |
| | Himalaya Korea Pathways (Demo) | Himalaya Korea Pathways |
| | Seoul Gateway Admissions (Demo) | Seoul Gateway Admissions |
| run.py agencies `license_number` | DEMO-0000 | `{country}-AG-000n` (VN-AG-0001 …) |
| run.py University.summary | "… university in {city}. Program lists, costs and dates shown here are development sample data." | "{name} is a {type} university in {city}." |
| run.py Program.description | "Sample {degree} program record for development. Confirm details …" | "Confirm the current curriculum, fees and dates on the university's official admissions site before you apply." |
| run.py Scholarship.description | "Sample scholarship record for development. Check …" | "Check the university's current scholarship rules before you apply." |
| run.py PartnerContract.title | "{uni} × Hangyul recruitment partnership (demo)" | "{uni} × Hangyul recruitment partnership" |
| run.py PartnerContract.guarantee_terms | "… seats remain. Demo terms." | "… seats remain." |
| run.py PartnerContract.notes | "FICTIONAL DEMO CONTRACT — not an actual agreement with this university." | "Recruitment partnership for the 2027 intakes; quotas and incentives reviewed each semester." (`is_demo=True` kept) |
| run.py partner Scholarship.coverage | "… tuition credit (demo)" | "… tuition credit" |
| run.py / extra_10 StudentEducation.institution | "Hai Phong Specialized High School (sample)", "Sample institution", "Sample upper-secondary school" | "Hai Phong Specialized High School", "Public upper-secondary school" |
| run.py / extra_10 offer_scholarship_note | "… first-semester tuition (sample)" | "… first-semester tuition" |
| run.py / extra_40 ScholarshipAward.note | Demo award | Partner scholarship award |
| run.py tiny_pdf text | "Hangyul Univ demo file: …" | "Hangyul Univ document: …" |
| run.py essays (non-main) | "Draft in progress." | composed personal statement / study plan (new `seed/essay_text.py`) |
| extra_10 persona essays | "First draft." / "Final version approved by the counselor." | composed draft (2 paragraphs) / full essay; the approval sentence moved to the version note |
| extra_50 LanguageRecommendation.note | "Sample data: illustrates a program recommending …" | "The department recommends a level above its published minimum." |
| extra_50 PortfolioReview.note | "Sample: agreed to finish …" | "Agreed to finish …" |
| extra_50 ApplicationSubmission.external_reference | DEMO-{8 hex} | provider-style `{UNI}-{yyyy}-{mmdd}-{4 hex}` (e.g. SOG-2027-0412-3F9A), `provider_reference()` |
| extra_51 dossier PDFs | "… PASSPORT (demo sample)", "ACADEMIC TRANSCRIPT (demo sample)", "… BALANCE CERTIFICATE (demo sample)", school "(sample)" | "… - SPECIMEN" (see honesty decisions), school without suffix |
| extra_52 WritingPrompt.note | "Sample prompt written by Hangyul for the demo — not the university's official wording. …" | "Drafted by Hangyul — not the university's official wording. …" (status SAMPLE kept) |
| extra_53 Vendor | Demo Airport Transfer (sample) | Seoul Arrival Transfers (kakao `demo-transfer` → `seoul-arrival`; notes → "Airport pickups from ICN and GMP; fares confirmed per booking.") |
| | Demo Housing Provider (sample) | Campus Nest Housing (notes → "Studios and shared rooms near campuses in Jongno-gu and Seongbuk-gu.") |
| extra_53 driver | Demo driver (sample) | Kim Min-seok |
| extra_53 all other text | "… (sample)" (listings, dorm eligibility/location, move-in, pickup, notes, contact desks, price model, availability) | suffix removed |
| content_data cost article | "Figures marked **Sample data** in the development environment are placeholders, not verified prices." | "Figures not yet checked against an official source are marked **Not yet verified**." |

Random sequence: unchanged (essays use a SHA-256 of `email|university slug|essay type`, never the seed `rng`).

### Live dev DB (`server/scripts/v6_rename_demo_labels.py`, idempotent; second run → "nothing to change")

Sweeps every string/JSON column of every table (except `sources`, `alembic_version`) with the same substitutions, then
license numbers, DEMO- references and placeholder essay bodies. Applied 2026-10-01 to `hangyul_univ`:
application_submissions.external_reference 68, essay_versions.body 372, student_educations.institution 74,
writing_prompts.note 78, programs.description 66, scholarships.description 20, universities.summary 10,
dormitories eligibility/location 10+10, writing_events.detail 10, scholarship_awards.note 6, language_recommendations.note 4,
organizations name/license 4+4, partner_contracts title/notes/guarantee 3+3+1, scholarships.coverage 3,
applications.offer_scholarship_note 3, service_case_events.body 3, vendors (name/notes/contact/price_model/availability) 2 each,
housing_listings title/area/utilities 2 each, housing_cases.move_in 2, service_cases.details 2, content_articles.body_md 1,
extracted_fields.value 1, portfolio_reviews.note 1, submission_authorizations.snapshot 1. Seeded PDF files were not rewritten.

## 2. Labels removed — student web + shared packages

| Where | Removed |
|---|---|
| packages/ui `FreshnessBadge` | DEMO → flask icon + "Sample data". Now renders nothing (compact / no source) or a plain "Source ↗" link (provenance). |
| packages/ui `DemoBanner`, `DemoBadge` | deleted (no users; shells use DevAccess); `.hg-demo-banner` CSS deleted |
| student-web ApplicationDetail | `FreshnessBadge DEMO` under the details list |
| student-web Compare, ProgramRow, ProgramCard, University (partner tab), bits `PartnerBadge` | "Partner (demo)" → "Hangyul partner"; DEMO tooltip removed |
| student-web DocumentDrawer | "Demo" badge on documents |
| student-web ConciergeBits `ProviderLine` | "Demo provider" chip (+ `.cg-tag--demo` CSS) |
| student-web Housing | "Sample data (not verified)" source link → plain "Source" for DEMO dorm facts |
| student-web Services | "Demo price" badge on plan prices |
| student-web EssayEditor | warning-styled "Sample question — …" chip → plain "Not yet confirmed against the university's official wording — your counselor confirms the real question." (`.st-wr-sample` CSS deleted) |
| student-web Budget / University cost note / FirstYearCost / Strategy | SAMPLE basis "Sample" / "sample figures" / "Sample data" → "Not yet verified" (`common:freshness.unverified`); SAMPLE row removed from the budget legend; strategy items flagged `sample` no longer carry a chip |
| student-web Login | `demoAccounts={DEMO_ACCOUNTS.student}` removed (LoginScreen already shows DevAccess inline) |
| packages/auth | `DEMO_PASSWORD` export removed (no users); `DEMO_ACCOUNTS` kept, marked deprecated, only because agency-web Login still passes it |

## 3. Native apps

* Per-screen `DemoBanner` removed: student home, university detail, document detail, application detail; agency home,
  student detail; university home, applicant detail. `DemoBanner` deleted from packages/mobile-ui.
* Other per-row labels removed: student match card "Demo" badge, Settings account card "Demo" badge, visa step meta
  "Sample data" (→ "Source" when a link exists), university cost caption "Sample figures for this demo …" (→ "Not yet
  verified"), quick check "Programs in this preview use sample data." (→ "Some program details here are not yet verified — confirm them on the university's official site.").
* New `packages/mobile-ui/src/components/DevAccess.tsx`: `demoAccessEnabled()` (`__DEV__` or `EXPO_PUBLIC_DEMO_LOGINS==='true'`),
  `DemoAccessSheet` (personas of this app's product from `DEMO_PERSONAS`, grouped by role; POST /auth/demo-login via
  `useAuth().demoLogin`; signs out first when switching), `DevAccessChip`, `DevIndicator` (one floating chip in each
  app's root `_layout.tsx`, only once signed in).
* Login: the demo-account list with the clear-text password and quick-login (`DEMO_ACCOUNTS`/`DEMO_PASSWORD`) replaced by an inline "DEV · Demo access" chip opening the persona sheet.

## 4. i18n

Added (en + ko): `mobile:devAccess.*`, `mobile:v3.quick.dataUnverified`, `writing:prompt.unconfirmedStudent`.
Removed from every locale (no code references): `common:demo.{banner,partnerDemo,accounts,password,useAccount}`,
`common:freshness.demo`, `concierge:provider.demo`, `concierge:official.sampleSource`, `writing:prompt.sampleStudent`,
`student:services.demoPrice`, `student:v4.cost.sample`, `student:budget.basis.SAMPLE`, `student:budget.basisText.SAMPLE`,
`student:housing.demoCost`, `success:block.sample`, `mobile:v3.university.sampleCosts`, `mobile:v3.quick.dataSample`.
Kept because agency-web still uses them: `common:demo.badge`, `common:freshness.demoTooltip`, `writing:prompt.sampleStaff`.

## 5. Honesty decisions

1. **Flags stay, words go.** No `is_demo` / `DEMO` / `SAMPLE` value was changed; only visible text. The API still reports `vendor.label = 'DEMO'`, `verification_status = 'DEMO'`, cost basis `SAMPLE`.
2. **Unverified stays unverified.** Seeded cost figures and essay prompts are shown with the product's real-uncertainty copy ("Not yet verified", "Not yet confirmed against the university's official wording") — never as official.
3. **Demo payment consequence kept.** The student checkout callout "Demo payment — no real charge" and the post-payment note stay: they describe what pressing the button does (no money moves), not the environment. Only the per-row "Demo price" badge was removed.
4. **Fabricated identity documents keep a marker.** Seeded passport / transcript / bank-certificate PDFs now read "- SPECIMEN" (industry convention for non-genuine documents) instead of "(demo sample)".
5. **Provenance source kept.** The `sources` row "Hangyul Univ development sample data" is not renamed; it is reachable from a DEMO record's "Source" link.
6. **Fictional partnerships with real universities** keep `is_demo=True`; their notes no longer shout, but marketing must keep hiding DEMO partnerships (marketing-web `catalog.tsx` already does).
7. `extra_60_submission_v6.py` connector instructions ("Development fixture … No real university allows it today.") left as is — owned by the submission workstream and it is a factual claim about real universities.
8. Composed essays use only the profile (nationality, prior education, program, university/city, TOPIK/IELTS, career goal); no awards or results are invented.
