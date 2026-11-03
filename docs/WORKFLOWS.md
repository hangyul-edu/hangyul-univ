# Workflows

## Student lifecycle

```
Explore → Profile → Eligibility → Matching → Consultation → Service purchase → Agency assignment
→ Document preparation → Application → Interview → Decision → Offer accepted → Tuition (paid by the student to the university)
→ Standard admission letter → Visa preparation → Visa issued → Pre-departure → Housing → Arrival
→ Residence card & insurance → Enrollment → Terms / retention → Graduation → Alumni / career
```

The student dashboard maps this onto 9 journey stages (`EXPLORE, PROFILE, MATCH, APPLY, DECISION, ENROLL, VISA, ARRIVAL, STUDENT_LIFE`) and always shows **one next best action**, chosen in order: finish profile → review matches → respond to an offer → the earliest student-visible task → arrival checklist.

## Progressive onboarding

7 short steps (origin → goals → education → language → budget & housing → passport & visa history → sponsor & career), autosaved with `PATCH /me/profile`. GPA is normalised transparently: `(value − scale_min) / (scale_max − scale_min) × 100`, stored with the original value and scale so reviewers can audit or override (`gpa_override_note`).

## Application state machine

| From | To | Who |
|---|---|---|
| DRAFT | PROFILE_REVIEW, DOCUMENT_PREPARATION, WITHDRAWN | student, agency |
| PROFILE_REVIEW | DOCUMENT_PREPARATION, DRAFT | agency |
| DOCUMENT_PREPARATION | READY | agency |
| READY | SUBMITTED | agency, student (blocked while required documents are missing) |
| SUBMITTED | UNIVERSITY_REVIEW | university |
| UNIVERSITY_REVIEW | ADDITIONAL_DOCUMENTS, INTERVIEW, OFFERED, WAITLISTED, REJECTED | university |
| ADDITIONAL_DOCUMENTS | UNIVERSITY_REVIEW | university, agency |
| INTERVIEW / WAITLISTED | OFFERED, WAITLISTED, REJECTED | university |
| OFFERED | OFFER_ACCEPTED | student, agency |
| OFFER_ACCEPTED | TUITION_PENDING | university, agency |
| TUITION_PENDING | TUITION_PAID | university |
| TUITION_PAID | ADMISSION_CERTIFICATE_PENDING / _ISSUED | university |
| ADMISSION_CERTIFICATE_ISSUED | VISA_PREPARATION | agency, student |
| VISA_PREPARATION | VISA_SUBMITTED | agency, student |
| VISA_SUBMITTED | VISA_ISSUED, VISA_PREPARATION | agency, student |
| VISA_ISSUED | ENROLLED | university |

Hangyul staff and system automation may perform any listed transition. Anything else returns **409**; a wrong actor returns **403**. Withdrawal is possible from every non-terminal state. Terminal: REJECTED, ENROLLED, WITHDRAWN.

Side effects: status history, audit, analytics event, student and counselor notifications, pipeline stage, task regeneration; on SUBMITTED the linked vault documents are shared with the university; on ADMISSION_CERTIFICATE_ISSUED a visa case opens automatically with the inferred visa type (D-4-1 for language institutes, D-2-x by degree); on ENROLLED a `StudentEnrollment` is created for cohort analytics.

## Document center

Statuses: `MISSING → UPLOADED → NEEDS_REVIEW → VERIFIED` or `NEEDS_CORRECTION` (reason required, shown as an action: *"This transcript needs an apostille before it can be used for Yonsei University's application."*) or `EXPIRED`.

Upload path: size ≤ 15 MB → MIME sniffed from magic bytes (PDF/PNG/JPEG/WEBP) → malware-scan hook → private storage under a random key → new immutable version → review task for the assigned agency → notification.

Checklists are generated per application from university/program `document_requirements` filtered by degree level and nationality; the best matching vault document is reused automatically. Additional checks: legalization status, expiry, maximum age (e.g. bank certificate within 30 days).

### Apostille / legalization

1. If issued in Korea → nothing needed.
2. Else the most specific `legalization_rules` row (country + category + university) supplies the route and steps.
3. Else derived from Hague membership **at today's date** (`apostille_member`, `apostille_effective_from`): APOSTILLE or CONSULAR_LEGALIZATION, with generic steps (original → notarise → apostille *or* MOFA authentication + Korean consular confirmation → certified translation → Hangyul verification) and transition notes.
4. Unknown membership → "route to be confirmed by your counselor" (never guessed).

## Essay / personal statement review

`DRAFT → SUBMITTED → (AI_PRECHECK) → AGENCY_REVIEW → CHANGES_REQUESTED → STUDENT_REVISION → SUBMITTED → FINAL_REVIEW → APPROVED`.

- On submission a deterministic pre-check runs (word limit, expected sections, prompt alignment, paragraphing, over-claiming). It never writes content or invents achievements.
- Reviewers comment on quoted spans and may propose replacement text; **only the student can accept a suggestion** (creating a new version). Internal notes are hidden from students.
- Every version is stored; any two versions can be diffed word-by-word.

## Agency assignment

On purchase of a plan (every plan includes Hangyul's counselling, V15), the engine scores partner agencies (country, language, university and degree expertise, workload/capacity, SLA history, preference), picks the top non-saturated agency and its lightest-loaded counselor, opens a support conversation and sets a first-response SLA deadline. Operations can override with a reason (audited).

## Task & deadline engine

Sources: application deadlines, missing/rejected/expired documents, legalization gaps, document reviews, essay writing and reviews, tuition, interviews, university requests, visa steps, first-contact SLA. Idempotent via `dedupe_key`; closes tasks whose trigger disappears, reopens if it returns. Priority from due date (<3 days URGENT, <10 HIGH). Reminder offsets are stored for delivery adapters (email/push/SMS — adapters not live).

## Visa center

Visa type inferred from the program's degree level; checklist from `visa_requirements` (generic + nationality-specific rows that add or replace steps, e.g. Vietnam proof-of-funds rule — marked REVIEW_DUE until re-verified). Each step shows dependencies, source and verified date. Statuses: `NOT_STARTED → ELIGIBILITY_CHECK → WAITING_FOR_ADMISSION → DOCUMENT_PREPARATION → READY_TO_APPLY → SUBMITTED → ADDITIONAL_DOCUMENTS → APPROVED → ISSUED | REJECTED`. The UI always states that visas are issued by the Korean government.

## Housing & arrival

Housing: dorm options from the university (seeded sample data, authenticated surfaces only), preferences, checklist; statuses `NOT_STARTED → RESEARCHING → DORM_APPLYING → DORM_CONFIRMED | OFF_CAMPUS_SEARCH → CONTRACT_REVIEW → CONFIRMED`. No fake listings.

Arrival: flight, pickup request, orientation, SIM/eSIM, transport card, bank account, residence card (due date = arrival + 90 days), health insurance, campus registration, emergency info. Marking arrival updates the pipeline and analytics.

## Post-admission lifecycle

`student_enrollments` (cohort, status ENROLLED / ON_LEAVE / WITHDRAWN / TRANSFERRED / GRADUATED, visa expiry) + `student_terms` (registration, GPA, attendance, standing — with `data_source` UNIVERSITY_FEED vs SELF_REPORTED) + `student_outcomes`. University consoles show retention, graduation and early-warning flags (low attendance, academic standing, visa expiring < 60 days, not registered) — transparent rules, not predictive scores.

## Partnership & Hangyul Partner Scholarship

Contracts define fees, incentives, target countries/programs, quotas and optionally a conditional guarantee (criteria + terms). A scholarship pool funds awards: PROPOSED → COMMITTED → PAID (or CANCELLED); the API rejects awards beyond the remaining budget or outside an active contract. Students see a Hangyul Partner Scholarship only while its pool and contract are active.

## Freshness

`python -m app.jobs.daily` (or `npm run` equivalent) marks sources past their review interval as REVIEW_DUE, flags sourced records older than the review window, closes past intakes, regenerates tasks and rebuilds analytics rollups. Reviewers resolve items as CONFIRMED / UPDATED / ARCHIVED in the Agency Console (Hangyul staff).

## V9 workflow changes

- **Language route.** Quick check / Discovery: when language blocks the chosen degree, show the routes the catalogue really offers (language program → D-4-1 → D-2 change after degree admission; English-taught; smallest test step). Counts only; "not an offer".
- **Money.** Every payment has payer → payee → when → refundable → basis. *Money to show* (visa funds) is not a payment and says so; funds must genuinely be held (temporary deposits are unlawful per MOJ/court findings). Tuition is paid to the university, in the student's own name, never through changers or agents. Announced reforms (TOPIK 4 exemption, deposit scheme) appear only as "announced, not in force" with a source.
- **Refund.** Visa refusal after tuition (or withdrawal after tuition) opens a REFUND service case (OPEN → ASKED_UNIVERSITY / WAITING_STUDENT → REFUNDED / CANCELLED) with the university's rule if recorded, else "your counselor confirms", and elapsed days.
- **Sponsor.** Student creates a link (scopes, expiry) → sponsor views without an account → every view audited → student revokes. Never shows messages, essays, notes or files.
- **Waiting-on.** One party per case; the row's next action is phrased for that party; the student sees "who is doing what" with the same meaning.
- **Counselor day.** Ranked queue (reasons, owner, deadline) with work-type chips → open → decide → next; meetings record notes + decisions + follow-up tasks + next appointment on the student timeline.
- **Member leaves (agency or university).** Deactivation lists open items, requires a target and a reason, moves everything in one audited transaction; nothing is orphaned.
- **Submissions.** Seven states across every method: Ready · Needs final review · Authorized · Submitted (handed off, awaiting evidence) · Confirmation missing (> 2 days) · University received · Issue. SUBMITTED still requires evidence.
- **University review.** Evidence table first; the decision panel highlights nothing until the evidence has been seen; "open the next applicant after deciding" also after a document request; bulk actions on "all N matching" with a server preview and per-item results; no bulk admit/reject.
- **Rule change.** A proposal shows its impact on currently matching prospective students only when every counted profile can be evaluated; otherwise "Not enough data to estimate (N of M profiles lack X)". Existing applications are not silently invalidated; the student/agency get a `REQUIREMENT_CHANGED` item.

## V10 workflow changes — public site → Student Platform

V10 removes the public application form and makes **Login** the public site's only account action
(REPORT §68.5). The handover now works like this:

```
public page ──┬── anonymous ──▶ /login?next=<student path> ──▶ sign in ──────────────▶ <student path>
              │                        │
              │                        └── "create an account" ──▶ /register?<same query> ──▶ <student path>
              └── has a student session ───────────────────────────────────────────────▶ <student path>
```

| Piece | Where | What it does |
|---|---|---|
| `GET /auth/session-hint?client=student` | `server/app/api/v1/auth.py` | Reads the existing `hg_rt_<client>` cookie and answers `{authenticated, name}`. **Issues no token and rotates nothing**, so a marketing page load cannot consume the session or trip `/auth/refresh`'s reuse detector. Per-client: an agency cookie never makes the student site look signed in. |
| `useStudentSession()` | `apps/marketing-web/src/lib/session.ts` | Caches the hint for 60 s; falls back to "anonymous" if the API is unreachable, so a public page always renders. |
| `studentAction(path, authenticated, locale)` | same file | Returns the destination, or `/login?next=<destination>` when anonymous. Used by the header, the hero, the four service rows, the university decision box and the closing band. |
| `safeNext(value, fallback)` | `packages/ui/src/app.tsx` | `next` comes from a URL, so only a same-app absolute path is accepted; `https://…`, `//host` and the backslash form fall back to the app's landing route. Used by both `LoginScreen` and `Register`. |
| `carryQuery(search)` | same file | The login's "create an account" link forwards its whole query (minus the dev-only `demo` param), so a visitor with no account keeps both the return path and any quick-check prefill. |
| Quick check `/start` | `apps/marketing-web/src/pages/Start.tsx` | Since V17 the three-question check **is the free product** and lives on the marketing site: results need no account and link to the public university pages (`/universities/:slug`) and to the plans; the former `lib/quick.ts` "save these results" hop into `/explore` is gone. |

**Header state:** `Sign in` (`로그인`) when anonymous · `Continue my journey` (`내 유학 준비`) when a student
session exists in the browser.

**What did not change (in V10):** the progressive profile and the state machine below it. The
public site stopped being a funnel into a form; it did not stop being a way in.

## V22 registration and V21 plan purchase (current)

**Registration (V22, REPORT §0.3a)** — four steps, one write. `POST /auth/signup/session` (Cloudflare Turnstile proof →
signed session, header `X-Signup-Session`) → `POST /auth/verification/send` + `/verify` for an **e-mail code (SendGrid)** and a
**mobile code (Twilio Messaging Service)** — HMAC-stored 6-digit codes, 5-minute TTL, 60-second resend, 5 attempts, Redis
rate limits → `POST /auth/register` with `email_proof`, `phone_proof`, `password_confirm` and the granular consents
(`TERMS`, `PRIVACY`, `CROSS_BORDER_VERIFICATION` required; `MARKETING` optional). **No account exists before the last
call.** Development reads codes through `GET /auth/verification/peek/{id}` (404 in production). The native student app
(`apps/student-mobile/src/signup/`) uses the same four endpoints. Provider credentials are environment variables and
are absent on this host, so the live smoke is BLOCKED.

**Plan purchase (V21, REPORT §0.4)** — one-time, USD. `POST /me/orders` (plan code; records a versioned `PURCHASE_TERMS`
consent) → Hangyul's **own card form** (no Toss popup) → `POST /me/orders/{id}/pay-with-card` → the server calls Toss's
key-in API on MID `bill_talkoab1` (foreign-card key-in, settles USD; `Idempotency-Key: hg-keyin-{order_id}`) and relays card
number and expiry **without storing them**; the card endpoint is limited to 8 attempts / 300 s per student and per IP. A
paid order opens the agency assignment above. Toss runs in **TEST mode**; live keys and the overseas-card/USD contracts are
owner actions, so `live_usd_checkout_enabled` is false and the student is told so rather than charged in another currency.
