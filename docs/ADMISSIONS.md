# Admissions

How Hangyul Univ helps a student prepare a stronger application — from fit to arrival — and what the product will
and will not claim. This is the summary; implementation detail, research tables and per-country data live in
[`admissions/`](admissions/) and [`research/`](research/).

## 0. The rule that governs everything here

- **Goal:** maximise the student's chance of admission through better strategy and better preparation.
- **The university makes the final admission decision. The immigration authority decides the visa.** Hangyul is
  responsible for strategy, completeness, document accuracy, deadlines and responding to university requests.
- **Never:** "guaranteed admission", an admission probability, a percentage, a score, a ranking of likelihood, or
  an invented success story. Fit groups are a browsing order, not a prediction.
- **Only real data:** published requirements, the student's own profile and documents, official guides, dated
  sources. Missing data reads as "not confirmed yet", never as "none". Historical outcomes are shown only for a
  defined cohort with n ≥ 5 real decided applications.
- **Who does the work:** the Hangyul Univ operations team, directly. There is no external agency. (Code names such as
  `agency`, `AGENCY_ADMIN`, `AUTHORIZED_AGENCY` in the detail files refer to Hangyul's internal operations team.)

## 1. Matching and fit

**Quick Fit** (`/start`, web and native; `POST /public/fit`, on the public site served by the Vercel function over the
exported snapshot): nationality · study level (7 levels) · GPA on the student's own scale · language test (13-test
registry, `packages/types/src/admissions.ts` → `shared/admissions.json`). It returns every relevant institution in
four groups:

| Group (KO) | Meaning |
|---|---|
| 지금 검토해볼 대학 | The published basic requirements are met now |
| 하나만 보완하면 도전해볼 대학 | One named requirement is missing |
| 기준 확인이 더 필요한 대학 | Hangyul has not verified the rule yet; reviewed in consultation |
| 준비 후 다시 볼 대학 | The gap to the published requirement is large |

The order inside a group is editorial ("추천순" is stated to be a browsing order). Results carry a next-action sentence
("IELTS 6.0 opens 12 more universities"). Wording for every state: [STATE_MAP.md](STATE_MAP.md). Engine:
`server/app/services/fit.py` (engine id `v27-fit-1`); parity gate `scripts/qa/public-fit-parity.py`.

Signed-in matching uses the same rules against the verified language rules and admission guides, and explains each
verdict with reasons.

## 2. Strategy

Per application the team and the student see **named items**, each with a reason, an action and an owner — never a
score. Inputs: published minimums, profile, document dossier, essays, university requests, intake dates, budget and
scholarship rules. The portfolio view observes across applications (spread, deadline collisions, shared documents); it
never picks a winner. Recommended-but-unverified levels are labelled as such.
Detail: [`admissions/admission-success.md`](admissions/admission-success.md) (`server/app/services/strategy.py`).

Plan limits (how many universities are recommended and how many applications are managed) are in
[SERVICE_CATALOG.md](SERVICE_CATALOG.md); recommended ≠ managed and the UI never merges the two numbers.

## 3. Application preparation

- A checklist exists **only when the university's official guide for that intake has been verified**. Otherwise the
  application is `ADMISSION_GUIDE_REVIEW_REQUIRED`: no checklist is shown ("대학 모집요강을 확인하고 있어요"), READY is
  refused, and the case enters the Hangyul review queue.
- Managed-application set today: **8 universities, bachelor's, 2027 Spring** with verified guides.
- Every requirement carries its source and verified date; deadlines are the university's published dates.
- The student always sees one next action and who is waiting on whom; internal stages stay in the Operations console
  ([WORKFLOWS.md](WORKFLOWS.md)).

## 4. Documents

One dossier: the student prepares each fact and document once; Hangyul works out where it can be reused, what is wrong
with it and what each application still needs.

- Upload → malware scan → team review → accepted or returned with one issue label and the basis ("근거 보기").
- **Legalization route is decided on the server** per issuing country and date: apostille / consular legalization /
  CHSI (China), plus translation, notarization, age-of-document, form and the guide's own quote.
- Extraction assists; a person verifies. Nothing is auto-approved.
- "Who can see this" on every document; a university sees only documents shared for a submitted application.
- Detail, rules and limitations: [`admissions/document-automation.md`](admissions/document-automation.md);
  security: [SECURITY.md](SECURITY.md).

## 5. Essay review

Personal statements and study plans are reviewed **by people** on the Hangyul team, with deterministic automatic
checks alongside (length, prompt coverage, structure, language). **Nothing writes, rewrites or invents content for a
student.** Rounds are a plan entitlement (All-in-One 2 rounds; Premium no round limit within the contracted documents
and schedule; extra rounds are a paid add-on). Reviews use a rubric, comments anchored to the text, approved versions
and an integrity policy the student accepts. Full essay editing is web-only.
Detail: [`admissions/writing-review.md`](admissions/writing-review.md).

## 6. Submission

Research (2026-09-29, 15 entries across 10 universities): **no university has a public application API; all use a
commercial application provider** (UWAY, JinhakApply, Gradnet), whose terms require the applicant to submit
personally. So submission is **guided**: deep link to the official notice, a pre-submission check by the team, the
student submits on the university's rail and records the application number and evidence. Hangyul never stores portal
passwords and never bypasses CAPTCHA/MFA. Staff submission on a student's behalf is possible only where a written
basis is recorded — no real university has one ([LEGAL.md](LEGAL.md) L4). After submission the team tracks university
requests and results and tells the student only when there is something to do.
Detail: [`admissions/submission-connectors.md`](admissions/submission-connectors.md); data
[`research/submission-methods.json`](research/submission-methods.json).

## 7. Visa

41 researched routes for 14 countries × visa type (D-2-x, D-4-1): jurisdiction, method, documents, finance, fees,
processing time — each with official sources and a verification status; nothing is inferred from one country to
another. The product shows the easiest **valid** route, the documents and the money to *show* (separate from money to
pay), and never presents a shortcut. Copy says "visa document preparation", never "visa support"; the authority
decides. Hangyul never collects tuition — it is paid by the student, in their own name, to the university.
Detail: [`admissions/visa-routes.md`](admissions/visa-routes.md); data
[`research/visa-playbooks.json`](research/visa-playbooks.json), [`research/post-arrival-official.json`](research/post-arrival-official.json).

## 8. Arrival and settlement

From the visa stage through the first months: getting to the city, SIM, transport card, residence card, health
insurance (NHIS), bank account, orientation and course registration, modelled as a dependency chain with official
deadlines. Dormitory: information (Basic), application schedule (All-in-One), application support and alternatives
(Premium). Premium covers D-30 pre-arrival to 30 days after arrival. Airport pickup and extra settlement support are
quoted add-ons. Facts are loaded from the research file, not copied into code.
Detail: [`admissions/arrival-services.md`](admissions/arrival-services.md); data
[`research/arrival-official.json`](research/arrival-official.json).

## 9. Verified data today

| Data | State |
|---|---|
| Institutions in the directory | 425 (대학알리미, Study in Korea, Wikidata; every field sourced) |
| Verified admission guides → checklists | 8 universities (bachelor's, 2027 Spring) |
| Institutions with verified language rules | 43; 176 still "needs checking" |
| Scholarships | 461 schemes, one per row, for 24 universities, as published |
| Language rules | 963 rows (per level/track) |
| GKS participation | 98 institutions (NIIED lists) |
| Visa routes | 41 routes, 14 countries |
| Programme catalogue | **Empty in the connected database** (unseeded); no demo programmes exist anywhere |

Open data work is in [ROADMAP.md](ROADMAP.md); current coverage numbers are restated in [REPORT.md](REPORT.md).
