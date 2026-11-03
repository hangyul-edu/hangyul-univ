# Submission connectors

<!-- Engineers: add the implementation design (connector interface, deep links, status sync) in your own sections. The research section below is maintained by the research workstream. -->

## Submission methods — research findings

Researched 2026-09-29 from each university's official international-admissions notices and application guides (2027 Spring/Fall cycle). Data: `docs/research/submission-methods.json` (15 entries: 10 undergraduate, 5 graduate). Each entry has `sources[]` with URLs, dates and quotes.

**Headline:**
- **None of the 10 universities has a public application API**, so `DIRECT_API` is never used.
- **All of them use a commercial application provider**, either UWAY (uwayapply.com), JinhakApply (jinhakapply.com), or Gradnet (Yonsei graduate). Every entry is `APPLICATION_PROVIDER`.
- **A connector can only be "guided":** deep-link to the provider notice, show a checklist, then record the application number the student reports.
- **Paying the fee always creates the application number.** Most universities also require paper documents by post, and these must *arrive* by the deadline.

| University | Level | Provider | Fee (base) | Docs at application | Originals by post | Status |
|---|---|---|---|---|---|---|
| Seoul National | UG | UWAY | KRW 70,000 | Upload | After preliminary admission | VERIFIED |
| Seoul National | Grad | UWAY | KRW 90,000 | Upload | Later (post or in person) | VERIFIED |
| Yonsei | UG | JinhakApply | KRW 200,000 (Medicine/Dentistry/Pharmacy KRW 230,000) | Mail (full set) | Yes | VERIFIED |
| Yonsei | Grad | Gradnet (APEXSOFT) | KRW 130,000 / USD 130 PayPal | Upload | Not stated | VERIFIED |
| Korea | UG | UWAY | KRW 150,000 (Art & Design KRW 200,000) | Upload + mail | Yes | VERIFIED |
| Sungkyunkwan | UG | JinhakApply | KRW 150,000 | Mail or in person | Yes | VERIFIED |
| Sungkyunkwan | Grad | JinhakApply | KRW 100,000 | Upload (PDF) | After admission | VERIFIED |
| Hanyang | UG | JinhakApply | KRW 142,000 (+27,000 second choice) | Mail | Yes | VERIFIED* |
| Hanyang | Grad | JinhakApply | not verified | not verified | not verified | PARTIAL |
| Kyung Hee | UG | UWAY | KRW 180,000 (arts KRW 250,000); card or bank transfer | Mail only | Yes | VERIFIED |
| Kyung Hee | Grad | UWAY | not verified | Mail | Yes | PARTIAL |
| Pusan National | UG | JinhakApply | KRW 144,000 | Mail (must arrive by deadline) | Yes | VERIFIED |
| Kyungpook National | UG | UWAY | KRW 80,000; overseas credit card | Upload | After preliminary admission | VERIFIED* |
| Chung-Ang | UG | UWAY | KRW 150,000; Alipay, card or bank transfer | Mail or in person | Yes | VERIFIED |
| Sogang | UG | JinhakApply (entry via oisa-admission.sogang.ac.kr) | KRW 150,000 | Mail, courier or in person | Yes | VERIFIED* |

\* The guide PDF is image-only and was read visually. Re-check the fee before showing it.

### What a student gets back

| Proof | Where |
|---|---|
| Application number, issued on payment | All 10 universities |
| Printable application form, test slip or cover page | Korea, Yonsei, Hanyang, Kyung Hee, Pusan, Chung-Ang, Sogang |
| Document-arrival check page | Korea, Yonsei, Chung-Ang (UWAY/Jinhak) |

**SKKU explicitly does not provide arrival information.** The student has to track the parcel with the postal company.

### Implications for connectors (research view, not a design)

- **Supported actions** come from the `supported_actions[]` field of each entry, e.g. `open_portal`, `pay_fee`, `get_application_number`, `upload_documents`, `mail_documents`, `check_document_arrival`, `check_result`. Hangyul can *guide* these steps. It cannot perform them on the student's behalf through an API.
- **Portal URLs change every cycle** (the year is in the UWAY path, and Jinhak uses notice IDs). Several universities' home pages still pointed to the 2026 links on 2026-09-29.
- **Specific link problems:**
  - Kyungpook has two different UWAY links.
  - Pusan and Sogang give no direct Jinhak notice URL.
- **Refresh rule:** re-verify `portal_url` before each intake and do not hard-code it.
- **Fees differ** by college, second choice and reapplication. Store the base fee plus the variant text in `fee.method`, and show the variant text too.
- **Bank balance certificates** are asked for only after admission at Chung-Ang and Sogang (Chung-Ang: at least KRW 20,000,000, issued within 30 days). Other universities differ. The visa bank certificate is a separate document with its own 30-day or embassy-specific validity (see `docs/VISA_ROUTES.md`).

## Implementation (success workstream)

*Code: `server/app/services/submission.py`, `server/app/models/v5_success.py`, `server/app/api/v1/success.py`. UI: student `apps/student-web/src/components/success/Submission.tsx`, agency `apps/agency-web/src/components/success/SuccessPanel.tsx`, university `apps/university-web/src/components/success/SubmissionEvidence.tsx`. Migration `d5a1c0e55ccd`.*

### Connector model

`submission_connectors` — one row per university, optionally narrowed by `program_id`, `degree_level`, `intake_term`. Most specific match wins (program 8 > degree level 4 > intake term 2 > university 0). Columns: `method`, `provider`, `portal_url`, `supported_actions`, `login_requirements` (described only), `fee_amount` / `fee_currency` / `fee_payment_method` / `fee_payee`, `documents_accepted` (ONLINE | MAIL | BOTH | UNKNOWN), `confirmation_method`, `instructions`, `source_url`, `last_verified`, `verification_status` (VERIFIED | PARTIAL | NEEDS_REVIEW | SAMPLE), `notes`.

| Method | Meaning | Who acts | Hangyul does |
|---|---|---|---|
| `DIRECT_API` | University API | — | `DirectApiConnector.submit()` raises `NotConfigured`. No university offers one; research text saying "DIRECT_API" is mapped to GUIDED_EXTERNAL. |
| `PARTNER_API` | Partner platform API | — | `NotConfigured` (none contracted). Falls back to counselor-assisted wording. |
| `APPLICATION_PROVIDER` | UWAY / JinhakApply / Gradnet… | Student | Guided hand-off to `portal_url` (all 10 catalogued universities today). |
| `GUIDED_EXTERNAL` | University's own portal | Student | Guided hand-off. Also the placeholder method (admissions page) when unverified. |
| `AGENCY_ASSISTED` | Counselor submits | Counselor | Counselor records the confirmation; the student cannot. |
| `MANUAL` | Post / e-mail / in person | Student | Hand-off without URL ("I'm sending it now"), then record. |

**Seeding.** `sync_connectors()` (run by `app/seed/extra_50_success.py`) reads `docs/research/submission-methods.json` — one entry per university **and level**. `UNDERGRADUATE` → BACHELOR, TRANSFER, ASSOCIATE rows; `GRADUATE` → MASTER, DOCTORATE, COMBINED. `fee.method` → payment method; `documents_upload` → documents_accepted; `confirmation` → confirmation_method; `sources[0].url` / `verified_at` → provenance. PARTIAL stays PARTIAL, and the UI says "Partly verified — your counselor confirms the details". Degrees the research does not cover (e.g. the language institute) get a university-wide `NEEDS_REVIEW` placeholder: the admissions page URL, with the note "Submission method not yet verified — your counselor confirms it". Without the file, every university gets that placeholder. Re-running the sync is idempotent: it replaces the university-level rows only.

### Submission record and evidence

`application_submissions` (one per application): `status` NOT_STARTED | READY_FOR_HANDOFF (derived when the app is READY) | HANDED_OFF | SUBMITTED_CONFIRMED | SUBMITTED_UNCONFIRMED; `handed_off_at/by`; `submitted_on`; `external_reference`; `receipt_document_id` (a vault document uploaded with the normal upload, category OTHER); `evidence_kind` NONE | CONFIRMATION_ID | RECEIPT | CONFIRMATION_AND_RECEIPT; `recorded_by_user_id/role`; `fee_status` NOT_REQUIRED | UNPAID | PAID | CONFIRMED | UNKNOWN with amount, currency, payee, paid_on; `completeness_at_submission` (share of required checklist items ready when confirmed).

Rules (tested in `server/tests/test_v5_success.py`):
1. **SUBMITTED_CONFIRMED only with evidence** — a confirmation/application number or a receipt. Otherwise SUBMITTED_UNCONFIRMED ("You told us you submitted — add your confirmation to finish"), and the application does not move.
2. **The state machine stays authoritative.** With evidence and status READY, `/submission/confirm` calls the existing `POST /applications/{id}/transition` handler (`to=SUBMITTED`). That call keeps the same actor permissions, the history, document sharing with the university, notifications and analytics.
3. **A student can never use the generic transition to SUBMITTED** unless a confirmed record exists (`require_evidence_for_student`, a 409 guard added to `applications.py`). A counselor's legacy direct transition leaves an honest record (`on_submitted`): confirmed if they typed a reference, unconfirmed otherwise.
4. **Fees.** The student may report PAID / UNPAID / NOT_REQUIRED. Only a counselor or Hangyul sets CONFIRMED. The university application fee is always labelled apart from the Hangyul service fee and tuition.
5. **AGENCY_ASSISTED:** only staff — any agency administrator (one role per tenant since V22) or Hangyul staff — record the submission.
6. **Task.** A hand-off opens a student task, "Add your {university} confirmation number or receipt" (dedupe `submission-confirm:{app}`, source `SUCCESS`). The task closes when evidence arrives.

### Guided hand-off (student)

When the application is READY and nothing else needs the student, the hero is replaced by the hand-off:
- It explains the next step: "Your Hangyul application is ready. Next: submit it on {provider}, the application service {university} uses".
- It shows the pre-leave checklist: documents N of N verified, essays approved, the application fee and who is paid (kept apart from the Hangyul fee and tuition), and the line "Never share your portal password".
- **Continue to official submission** opens `portal_url` in a new tab (`noopener`) and records HANDED_OFF.
- On return, the page shows "Submitted on {university}'s portal?" with a form: confirmation number, date (no future dates), fee, and receipt upload.

"I already submitted it" opens the same form without a hand-off.

### Surfaces

| Audience | Where | What |
|---|---|---|
| Student | Application page | Hand-off hero (READY) · after submission, one line "Submitted {date} · confirmation {ref}", or the unconfirmed callout with the form |
| Agency | Application drawer → Submission | Method + provider + verification, portal link, fee (amount · status → payee), evidence, **Record submission** form |
| University | Applicant header | "Submission: {method} · Ref. {ref} · {date}" (method, reference, date and evidence kind only — no fee, no notes) |

### API

`GET /applications/{id}/submission` (student, agency, Hangyul; a university sees evidence only, and only after submission); `POST …/submission/handoff` (student); `POST …/submission/confirm`; `POST …/submission/fee`; `GET /submission/connectors` (staff). Tenant isolation goes through `get_application_for`: other tenants get 404.

### Security

- No portal credentials are stored or requested anywhere.
- No scraping and no automatic submission. `portal_url` is opened in the student's own browser.
- The receipt must be one of the student's own vault documents.
- Every record, hand-off and fee change is audited (`submission.*`).

### Known limitations

- Portal URLs change every intake. The research refresh rule applies, and nothing re-checks them automatically.
- Per-program fee variants (second choice, reapplication) are shown as text only, not modelled.
- A receipt upload goes through the normal document upload, so it appears in the vault as "Other".
- The task title uses the key `task.submissionConfirm`. That key is not yet in `common.json` (coordinator), so the task falls back to English.

## V6 — connector completion, authorised agency submission, connector-unavailable design

*2026-10-01. Code: `server/app/services/submission.py`, `server/app/models/v5_success.py` (`SubmissionAgencyPermission`, `SubmissionAuthorization`), `server/app/api/v1/success.py`, seed `server/app/seed/extra_60_submission_v6.py`. UI: student `apps/student-web/src/components/success/Submission.tsx`, agency `apps/agency-web/src/pages/Submissions.tsx` + `components/success/SubmissionQueue.tsx`, `SuccessPanel.tsx`, university `SubmissionEvidence.tsx`. Migration `e6a1b2c3d4f5` (on `f5e1a2b3c454`). Tests `server/tests/test_v6_submission.py`, `e2e/v6-submission.spec.ts`.*

### The plain answer: what works, what is guided, what needs an agreement

| | Status today |
|---|---|
| **Guided self-submission with evidence** (student applies personally on UWAY / JinhakApply / Gradnet / the university portal; Hangyul prepares, explains, keeps state, records the result) | **Works end to end** for every catalogued university. |
| **Counselor final review** (the agency's move to READY) shown to the student as "Your counselor checked your package on {date}" | **Works.** |
| **Agency-recorded evidence** (counselor records the application number / receipt the student shares; fee confirmed by staff) | **Works.** |
| **Authorised agency submission** (agency submits for the student under consent) | **Architecture complete and tested, but no real university or provider allows it.** UWAY, JinhakApply and Gradnet require the applicant to apply personally (Korea University guide; Jinhak terms forbid third-party ID use — `docs/COMPETITOR_BENCHMARK.md`, "Submission reality (2026-10)"). It needs a written university/provider agreement that does not exist. Only a **development fixture** uses it. |
| **DIRECT_API / PARTNER_API** | **Requires a provider integration that does not exist.** `submit()` raises `NotConfigured`; the API answers 409 `AWAITING_PROVIDER`; the UI says "Awaiting provider integration" and shows no button. |
| **Status sync** | `NONE` or `MANUAL` everywhere (a person checks the portal). No webhook or polling exists. |

### Methods

| Method | Who submits | Requirements in code | UI |
|---|---|---|---|
| `DIRECT_API` | — | Integration (none) | "Awaiting provider integration"; the counselor records evidence of the real submission |
| `PARTNER_API` | — | Partner contract + integration (none) | Same as DIRECT_API |
| `AUTHORIZED_AGENCY` (alias: `AGENCY_ASSISTED`) | Assigned agency staff, in their own browser | Connector `agency_submission_basis` **and** an active `SubmissionAgencyPermission` for the application's agency **and** an ACTIVE student `SubmissionAuthorization`. Missing basis/permission → the application falls back to `GUIDED_EXTERNAL` (`agency_submission.unavailable_reason` NO_BASIS / AGENCY_NOT_AUTHORISED / NO_AGENCY) | Student consent screen; agency "Ready to submit" queue |
| `APPLICATION_PROVIDER` | Student, personally | — | Guided hand-off ("{University} requires you to submit the application yourself on {portal}…") |
| `GUIDED_EXTERNAL` | Student | — (also the fallback and the unverified placeholder) | Guided hand-off |
| `MANUAL` | Student (post / e-mail / in person) | — | Hand-off without URL |

The migration rewrote stored `AGENCY_ASSISTED` values to `AUTHORIZED_AGENCY`; `normalize_method()` still reads the old value. Research text is never mapped to `AUTHORIZED_AGENCY` or an API method.

### Connector fields (V6 additions)

`portal_name` (e.g. "UWAY"), `official_url` (the university's notice/guide), `fee_payer` (STUDENT | AGENCY | UNKNOWN; payee stays in `fee_payee`), `originals_by_mail`, `receipt_method` (from the research actions: test slip, printable form, arrival check), `status_sync` (NONE | MANUAL | WEBHOOK | POLLING), `verified_source` (title of the checked source; date in `last_verified`, URL in `source_url`), `agency_submission_basis` / `_url` / `_verified`. The credentials requirement is **described only** in `login_requirements` ("The applicant creates their own UWAY account… Hangyul never asks for, sees or stores this password"). Existing rows were back-filled in place on the development database; `sync_connectors()` fills them on reseed.

### Authorised agency flow

1. **Student — consent.** On a READY application with agency submission available, the hero offers **Authorize submission**. The consent screen (`consent_preview`) lists where it goes (university · program · intake · deadline), the application-form summary from the profile (passport masked), the documents (by name), approved essays, the **university application fee** with payer and payee (separately labelled from the Hangyul fee and tuition), who submits (counselor + agency, on the official portal in their own browser), the basis on record, "Hangyul never asks for or stores portal passwords" and "you can withdraw any time before they submit". The button stays disabled until the explicit checkbox is ticked. `POST /applications/{id}/submission/authorize {accept: true, consent_version}` stores a `SubmissionAuthorization` (ACTIVE, timestamp, `snapshot` of all of the above incl. document ids + versions) and a `ConsentRecord` (purpose `SUBMISSION_AUTHORIZATION`, scope = agency), opens the agency task `submission-agency:{app}`, audits `submission.authorize`. Idempotent; a stale consent version → 409.
2. **Withdraw.** `POST …/submission/authorization/revoke` → REVOKED + a `ConsentRecord(granted=false)`, task cancelled, audit `submission.revoke`. Idempotent; refused (409) once submitted.
3. **Agency — Ready to submit** (`/submissions`, nav badge = authorised and not yet recorded; `GET /agency/submissions?view=ready|awaiting|submitted|all`). Rows: student, university/program, intake, deadline, authorised at, package status, fee status, failure/reference. Detail drawer: final review (consent, documents, essays, package unchanged since consent, deadline, fee and payer), the official mechanism with **Open {portal}** (staff's own browser), the authorised snapshot, then **Record submission** — reference **required**, date, receipt (uploaded on the student's behalf into their vault), **Record and complete** — or **Report a failed attempt**. Scope: owner/manager/counselor of the assigned agency (counselors only their own students); document reviewers read-only (403 on writes); Hangyul staff read-only for this method; other agencies 404.
4. **Student — result.** "Submitted {date} · confirmation {ref}" + "Submitted by {counselor} · {agency}" + **Receipt** link. The university applicant header shows "Submission: Authorised agency · Ref. … · date" (no fee, no notes).

### Connector-unavailable (guided) design

For every method without an API, the READY hero shows: method and status; **What Hangyul has completed** ("We've prepared all N required files", essays approved, "Your counselor checked your package on {date}", fee); **What you do on {portal}** — the exact ordered steps from the connector's `supported_actions` (open portal, create your own account, fill the form, upload, pay, note the application number, print the slip, post documents, check the result); **Files to upload** (links to the vault copies); **What to enter** (profile values, passport masked with an instruction to type it from the passport); a Hangyul *estimate* of the time ("about N minutes", labelled as Hangyul's estimate); **Continue to official submission** (new tab, records HANDED_OFF); back on the page **Did you submit?** → confirmation number / date / fee / receipt. Evidence rules are unchanged (SUBMITTED only with a confirmation number or receipt).

### Edge states

| Case | Behaviour |
|---|---|
| Submission failed on the portal | `POST …/submission/failure {reason}` (agency) → shown to the student ("couldn't submit yet: …"); authorisation stays ACTIVE; cleared when confirmed |
| Duplicate action | Authorise / revoke idempotent; recording the same reference again changes nothing (no second audit, no second transition); a different reference → 409 |
| Connector unavailable | No basis / no permission → guided self-submission; API methods → "Awaiting provider integration" |
| Consent withdrawn | Agency record / failure → 409 "The student withdrew consent — nothing may be submitted." |
| Session expiry | 401 after the refresh attempt → "Your session expired — sign in again. Nothing was saved/authorized/recorded." (form state kept) |
| Production | `HG_ENV=production`: the fixture seed is skipped, demo permissions/connectors never authorise, the dev fixture endpoint returns 404 |

### Development fixture (honesty limitation)

`extra_60_submission_v6.py` (a test fixture: loaded only into test/e2e databases since V32) creates an **inactive** program "Authorised-submission fixture (development only)" (never listed in the catalogue, matches or public pages) with one intake copied from PNU BBA dates, a program-level connector with `agency_submission_basis` = "Development fixture — no real agreement…" (`SAMPLE`, `is_demo`), a DEMO permission for Lotus Bridge, and two Lotus personas: `student.authorize@demo.hangyul.kr` (not yet authorised) and `student.authorized@demo.hangyul.kr` (authorised; appears in the queue). **Limitation:** a program must belong to a university, so the fixture hangs off Pusan National University and the header reads "Pusan National University"; the program name, the "Fixture" tag in the queue, the queue note and the basis line make clear it is not a real arrangement. E2E starts applications on it through the dev-only `POST /dev/submission-fixture/application`.

### Security

No portal passwords are requested or stored (described only); no scraping; no MFA/CAPTCHA circumvention; nothing is submitted by Hangyul. Every authorisation, revocation, failure, record and API attempt is audited (`submission.authorize | revoke | failure | record | api_not_configured`).

## V9 (2026-10-14)

- **Research re-check (2026-10-10):** still no public API, agency account, batch upload or status callback on UWAY, JinhakApply, Gradnet or Study in Korea; KU requires personal application; JinhakApply terms forbid third-party ID use; NIIED plans one-stop application/payment on Study in Korea (watch). Connector types are unchanged; every catalogued university remains GUIDED_EXTERNAL/APPLICATION_PROVIDER.
- **Submissions pipeline (agency, `GET /agency/submissions/pipeline`)** across *all* methods with seven states: Ready · Needs final review · Authorized · Submitted (handed off, awaiting evidence) · Confirmation missing (> 2 days) · University received · Issue. SUBMITTED still requires evidence; `agency_queue` (authorised-agency queue) is unchanged. Counselors no longer need a parallel spreadsheet of "who submitted / who has a receipt".
- **HQ:** "submission blocker" and "confirmation missing" are rows of the severity-ordered failure list.
- `AUTHORIZED_AGENCY` still has no real legal basis anywhere (`docs/LEGAL_DEPENDENCIES.md` L4).
