# Hangyul Univ — Service blueprint (V9)

> **V9 snapshot (2026-10-14) — kept as a dated record, not maintained.** Several rows are stale by design: plans are now three paid one-time USD plans (no free tier), payments run on Toss in TEST mode, students see staff as the *Hangyul Univ team* and tenants have one role (V22). The current state of the product is **docs/REPORT.md §0**.

*Written 2026-10-10 before V9 implementation, from the running system (REPORT §55), the V9 operating-model research (`docs/research/v9-operating-model.md`) and the visa/arrival revalidation (`docs/research/v9-visa-revalidation.md`, `v9-arrival-revalidation.md`). Updated after implementation (REPORT §62–63): the **Status** column says what exists in code today.*

**How to read it.** One row per step of the student journey, "I want to study in Korea" → "I have arrived and settled". Columns:

- **Student** — what the student does. **Hangyul (visible)** — what the student sees Hangyul do. **Agency** — partner-agency staff action. **University** — university staff action.
- **Automation** — what the backend does without a person. **External** — the system outside Hangyul where the official action happens.
- **Data / documents** — what is needed (entered once, reused). **Error risk** — the typical failure. **SLA** — target time. **Escalation** — who is told when it slips. **Next state** — where the journey goes.
- **Status** — `LIVE` (in code and tested) · `V9` (built in this pass) · `GUIDED` (Hangyul prepares, the official action is outside, evidence comes back) · `EXTERNAL` (needs a provider/agreement; shown truthfully as not connected) · `MANUAL` (a person does it by design).

Waiting-on values (one meaning everywhere, STATE_MAP): **Student · Counselor · Agency · Hangyul · University · External · No one**.

## 1. Discover and qualify

| Step | Student | Hangyul (visible) | Agency | University | Automation | External | Data / documents | Error risk | SLA | Escalation | Next state | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Quick check | Nationality, degree, language (≤ 4 inputs), no account | Honest counts + **routes** (direct / language program first / English track) + smallest unlocking step; "not an offer" | — | — | Matching engine over published requirements; never stored | — | 3 answers | Missing data shown as "not eligible"; no route for no-TOPIK students | Instant | — | Account (answers carried) | LIVE · V9 routes |
| Account | Email + password, language | Answers prefilled; consent | — | — | Self-declared prior education recorded once | — | Email, locale | Re-typing answers | Instant | — | Discovery | LIVE |
| Profile (progressive) | Answers only what unlocks something ("Add your GPA → check 31 programs") | Says what each answer unlocks | Sees profile gaps | — | Unlock counts from the student's own matches | — | Education, grades, tests, budget, sponsor | Long form before value | — | — | Shortlist | LIVE |
| Discovery & shortlist | Browses For you / All / Saved | Each row: can apply · why · missing · first-year cost · deadline · language · scholarship · unlock | Sees the same fit per program (catalog) | Publishes requirements | Eligibility groups; "needs your grades" ≠ ineligible | — | Catalogue with source + verified date | Stale deadlines/costs | Catalogue freshness review per source interval | Hangyul ops (stale source) | Compare / budget | LIVE · V9 row content |
| Compare & budget | Compares 2–4; sees the money plan | Differences first; one money model with payee, timing, refundability, basis; **money to show for the visa** | — | — | Budget service; visa route funds | FX (indicative) | Program costs, visa route | Conflicting figures; surprise funds requirement at visa stage | Instant | — | Service choice / application | LIVE · V9 money plan |
| Service & assignment | Chooses a plan (free / support / premium) | Price with who receives it; refund terms | Receives a qualified, paid case | — | Assignment scoring (country, language, expertise, **weighted load**, availability) | Payment provider | Order, consent to share with agency | Wrong-language counselor; overloaded counselor | First response 24 h (agency setting) | Agency manager → Hangyul ops | Strategy | LIVE · EXTERNAL payments · V9 weighted load |
| Sponsor | Invites a parent/sponsor (read-only link, chosen scopes) | Sponsor page in the sponsor's language: money plan, family documents, dates, progress | — | — | Expiring, revocable token; audited views | — | Scopes chosen by the student | Over-sharing private content | — | — | (parallel to the journey) | V9 |

## 2. Prepare the application

| Step | Student | Hangyul (visible) | Agency | University | Automation | External | Data / documents | Error risk | SLA | Escalation | Next state | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Strategy & portfolio | Sees "Your plan": strong / possible / blocked, deadlines, fees | Observations, never a score | Reviews portfolio (6 questions), records decision | — | Portfolio observations; deadline concentration; budget spread | — | Shortlist, budget | Too few / too hard / same-day deadlines | Review within first week of assignment | Manager (portfolio stale) | Applications created | LIVE |
| Document collection | Uploads each document **once** | Applicability per application (and visa); "Keep / replace / add version"; who can see it | Uploads on behalf when sent elsewhere (audited) | — | Dossier reuse; expiry; legalization path by issuing country/date | — | Passport, photo, diploma, transcript, tests, bank, family | Re-upload; wrong version per application | — | — | Verification | LIVE · V9 privacy panel |
| Document QA | Fixes only what is flagged | Findings in plain words (blur, unreadable, name/date mismatch, expired, duplicate) — suggestions until verified | Reviews with checklist; correction templates in the student's language | — | Findings on upload; MRZ/text extraction as suggestions | OCR (not configured) | File versions | Silent alteration; fraud | 48 h review | Late-review flag → counselor, manager, Hangyul ops | Translation / legalization | LIVE · EXTERNAL OCR |
| Translation / notarization / apostille | Follows the country path (steps + source) | Exactly the student's country route (apostille vs consular, date-versioned) | Confirms, records progress | — | Legalization router (HCCH status by date) | Notary, MOFA, embassy, apostille office | Issuing country, document date | Wrong route (e.g. pre-accession date); unnecessary apostille | Route-dependent (days–weeks) | Counselor if blocking a deadline | Writing | GUIDED |
| Personal statement / study plan | Writes in the editor under the university's actual question | Reviewer, SLA, version, limit, deadline visible; suggestions accepted or declined by the student | Reviews: comment → request change / approve → next | — | Automatic checks (length, prompt coverage, wrong school/program name, repetition, fact consistency with profile); never writes | AI provider (off) | Prompt per university/program/intake | Wrong university name; invented facts; copied text | 48 h first/revision, 24 h final | Reviewer → manager escalation | Final check | LIVE |
| Recommendation letters / interview prep | Requests letters; practises | Item on the application plan when required | Interview prep session (meeting record) | Schedules interview | Strategy item `INTERVIEW_REQUIRED` | — | Referee details | Forgotten referee | — | Counselor | Ready | LIVE (letters manual) |
| Ready | Sees "Your application is ready" | Package: N files prepared, fee, official rail | Final review (checklist) | — | Package builder; readiness counts open requests | — | Package snapshot | Submitting with missing items | Before deadline − planning estimate | Counselor (deadline tight) | Submission | LIVE |

## 3. Submit and get a decision

| Step | Student | Hangyul (visible) | Agency | University | Automation | External | Data / documents | Error risk | SLA | Escalation | Next state | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Application fee | Pays the university/rail directly | Fee, payee, "payment locks the form" warning | — | — | — | UWAY / JinhakApply / Gradnet / university | Fee per connector | Paying before the form is final | — | — | Submission | GUIDED |
| Submission | Submits on the official rail (or authorises the agency where a legal basis exists) | "Continue to official application" with files and what to type; then "Did you submit?" | Submissions queue: ready · final review · authorized · submitted · confirmation missing · university received · issue | Receives on its rail | SUBMITTED only with evidence | Official rail (no public API) | Reference, date, receipt | False "submitted"; lost receipt | Same day as the official action | Counselor when confirmation missing > 2 days | University review | GUIDED · V9 queue |
| University review | Sees "{University} is reviewing" | — | Waiting on university | Review: requirement · evidence · status; review-and-advance | Shared verified documents; statements reader (audited) | — | Shared documents | Reviewer browses a profile instead of evidence | University-defined | — | Decision / request | LIVE · V9 advance |
| Additional document request | Sends an existing document or uploads a newer one — only what is missing | The university's exact note, as a task | Verifies, follows up | Requests (single or safe bulk) | Request → student task + counselor + ops notification; fulfilment shares and closes | — | Requested item | Request lost in email; duplicate upload | Student 3 days; agency 2 days | Ops ("university requests waiting") | Review continues | LIVE |
| Interview | Attends | Date and preparation | Prepares the student | Records outcome | Strategy item | Video / campus | — | Missed slot | — | Counselor | Decision | LIVE (scheduling manual) |
| Offer / scholarship | Compares offers; sees "You pay ₩X by {date}" | Offer comparison; scholarship arithmetic only when stated exactly | Discusses choice | Issues offer + scholarship | Offer model; quota/pool rules | — | Offer letter | Misread amount due | Offer deadline | Counselor | Accept / decline | LIVE |
| Tuition | Pays the university directly (own name) | Amount, payee, deadline; never collected by Hangyul | Reminds via template | Confirms payment | Tuition tasks from the offer | University virtual account | Invoice | Paying a third party; missing deadline | Tuition deadline | Counselor → ops | Admission certificate | GUIDED |
| Admission certificate | Waits | "{University} is preparing your admission letter" | — | Issues 표준입학허가서 | Visa case opens automatically | — | Certificate | Delay blocks visa | University-defined | Ops if waiting > 10 days | Visa | LIVE |

## 4. Visa

| Step | Student | Hangyul (visible) | Agency | University | Automation | External | Data / documents | Error risk | SLA | Escalation | Next state | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Route | Answers one jurisdiction question only if needed | Your route: post, channel, documents, funds to show, timing — with source and date | Confirms partial routes | — | Route resolver (nationality, residence, degree, tier, jurisdiction, sponsor) | Embassy / KVAC / visa portal | Nationality, residence, sponsor | One country's rule applied to another | — | Counselor confirms PARTIAL routes | Visa documents | LIVE · V9 revalidated data |
| Visa documents | Reuses dossier documents; gets only what is new (e.g. fresh bank certificate after a date) | What is ready / needed now / who provides each | Pack review | Provides admission documents | Reuse judged on the appointment date | Bank, hospital (TB), civil registry | Passport, admission certificate, funds proof, TB, family docs | Stale financial certificate; wrong holder | Before appointment | Counselor | Appointment / submission | LIVE |
| Appointment & submission | Books and submits at the official channel | Where and how; preparation form checked by the student | Supports | — | Hand-off recorded; submission only with receipt | Embassy / KVAC / e-visa | Receipt | False "submitted" | Appointment date | — | Decision | GUIDED |
| Extra documents / result | Responds; uploads the visa when issued | Embassy request → task; issued → arrival track | Visa support service case | — | ISSUED only with the visa uploaded | Embassy | Request, visa | Missed embassy request | Embassy-defined | Counselor → ops ("visa blocker") | Arrival | LIVE |

## 5. Arrival and settlement

| Step | Student | Hangyul (visible) | Agency | University | Automation | External | Data / documents | Error risk | SLA | Escalation | Next state | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Housing | Chooses dormitory / partner / off-campus / temporary | Rent, deposit, fees, contract length, distance, move-in, availability, verification — never invented inventory | Housing service case | Dormitory application | Per-type status tables | Dormitory office; landlords | Preferences, budget | Deposit scams; fake listings | Case-type SLA | Ops (late case) | Flight | LIVE · EXTERNAL inventory |
| Flight & pickup | Enters flight, passengers, luggage, destination, contact | Pickup status (requested → confirmed → driver → picked up → completed) | Assigns provider/driver, meeting point, proof | Shuttle info where published | Flight change after confirmation → re-confirm task; delay ≥ 30 min moves pickup | Airline (manual times), pickup provider | Flight no., arrival time | Missed pickup on delay | Confirm ≥ 48 h before landing | Ops (pickup unconfirmed < 48 h) | Arrival | LIVE · EXTERNAL flight data |
| SIM / bank / insurance / residence card | Follows the first-weeks list; residence card within 90 days | Each step with official source; deadline tasks | Help on request | Orientation, registration | 90-day task; NHIS timing | HiKorea, bank, carrier, NHIS | Passport, address, ARC | Missed 90-day registration | Legal deadlines | Counselor → ops | Settled | LIVE |
| Orientation & registration | Attends; registers courses | Dates from the university | — | Runs orientation | Enrollment record | University | — | — | — | — | Student life | LIVE |
| Support, complaints, refunds | Asks for help in one place | Help routed to agency or Hangyul; emergency numbers | Responds under SLA | — | Help → service case | 1345 / 112 / 119 / 1330 | — | Unanswered complaint | 24 h | Ops | Resolved | LIVE (refund rules NEEDS LEGAL) |
| Retention & graduation | — | — | — | Feeds terms / outcomes | Cohort retention/graduation (enrolment population) | SIS (not integrated) | Terms, outcomes | — | Per term | University | — | LIVE (manual feed) |

## 6. Where work is manual today → what Hangyul does instead

From the research (each line cites the operating-model study) and the product audit. "Removed" means the person no longer does it inside Hangyul; "Guided" means the official action stays outside but Hangyul prepares it and records the result.

| Manual work in a traditional agency | Where | Hangyul treatment | Status |
|---|---|---|---|
| Counselor copies student data from chat/forms into Excel and portal forms | Profile, application creation | One profile → package and "what to type" for the official form | LIVE (Guided) |
| Student re-uploads the same document per university / for the visa | Documents, visa | Dossier reuse with applicability per application and visa date | LIVE |
| Counselor sends manual reminders (KakaoTalk/WhatsApp) for deadlines and missing documents | Every step | Engine tasks with dated reminders; templates in the student's language; external delivery shown "Not connected" until configured | LIVE · EXTERNAL channels |
| Manager checks a master Excel for who is overloaded / what is late | Agency ops | Manager page: weighted load, SLA, ageing, deadlines at risk, unassigned paid cases | V9 |
| Staff switch to KakaoTalk / WhatsApp / Zalo to talk to students and parents | Communication | One conversation model per student with application link; sponsor link for parents | LIVE · V9 sponsor |
| Counselor searches university websites for requirements, fees, deadlines | Shortlist | Sourced catalogue with verified dates; freshness review | LIVE (catalogue figures are sample data — NEEDS BUSINESS DATA) |
| Someone forgets a deadline | Application, tuition, visa, residence card | Deadline tasks in KST; risk surfaced to the owner and the manager | LIVE |
| Agency and university hold conflicting state (submitted? received? missing?) | Submission, requests | One application state; SUBMITTED only with evidence; request loop with the exact note | LIVE · V9 submissions queue |
| Parent asks the student (or the agency) for money figures by chat | Money | Sponsor view of the money plan | V9 |
| Universities chase missing documents by email | Review | Request loop; complete-on-first-review metric | LIVE |
