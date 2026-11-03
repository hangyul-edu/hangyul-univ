# Product analytics events

Server-side events recorded with `app.core.audit.track()` into `analytics_events` (name, user, organization, university,
application, nationality, JSON properties, timestamp). Recorded on the server so ad blockers cannot skew funnels and no
third-party tracker sees student data. `DailyMetric` rollups (`node scripts/api.mjs daily`) aggregate them.

Principles: measure outcomes, not clicks; never store document contents, passport numbers or free text; anonymous events
carry no user id and no IP address. No dark patterns are measured or optimised (e.g. no "time on page").

## Visitor → student conversion

| Event | When | Key properties | Question it answers |
|---|---|---|---|
| `quick_eligibility_completed` | Anonymous 3-question check returns (marketing hero or `/start`) | nationality, degree, language kind, meets, possible | Do visitors get value before signing up? What share see 0 matches? |
| `student_registered` | Account created | locale, nationality | Quick-check → sign-up conversion |
| `profile_started` / `profile_completed` | Profile progress | — | Does progressive profiling finish? |
| `match_generated` | Matches computed | counts per tier | How many realistic options do students have? |
| `program_viewed` / `university_viewed` | Detail pages | program/university | Discovery depth |
| `university_saved` | Shortlist | university | Shortlist building |
| `comparison_created` | Compare | program count | Decision support usage |
| `budget_viewed` | Budget planner | programs, source (selected/shortlist), housing | Do students engage with cost before applying? |
| `service_checkout_started` / `service_purchased` | Services | product, provider | Service conversion (`provider` is `toss` — Toss TEST mode, foreign-card key-in; `demo` appears only in development and tests) |

## Service contract (V29)

All server-side; properties carry codes only — never document text, essay content, scope notes or card data.

| Event | When | Key properties | Question it answers |
|---|---|---|---|
| `checkout_started` | Plan order created | plan, catalog_version | Which plan do buyers reach checkout with? |
| `plan_purchased` | Plan order PAID (engagement starts) | plan, catalog_version, kind | Plan mix by catalogue version |
| `upgrade_started` | A plan holder asks for a higher plan (refused until the owner sets upgrade pricing) | from, to, priced=false | How much upgrade demand is waiting on the pricing decision? |
| `add_on_offered` / `add_on_approved` / `add_on_purchased` | Add-on lifecycle (offer → approve → paid) | code, quantity, plan | Which extras are needed, and how many offers convert? |
| `service_limit_reached` | A request hits the contract (recorded even though the request is refused) | key, reason (LIMIT_REACHED · NOT_INCLUDED · NEW_DOCUMENT · UNMANAGED_APPLICATION · SERVICE_PERIOD_ENDED · NO_PLAN) | Where do plans run out, and is it the count or the scope? |
| `managed_application_started` | An application leaves DRAFT (a managed slot is used) | — | Managed-application usage per plan |
| `essay_review_completed` | Team returns or approves a review round | essay_type, outcome | Editing throughput |
| `mock_interview_completed` | A mock-interview meeting is closed as completed | — | Mock-interview delivery |
| `pre_arrival_support_started` / `settlement_support_started` / `settlement_support_completed` | Premium arrival window milestones (first time only) | plan | Is the Premium arrival journey delivered on time? |

Not tracked on purpose: plan-card clicks, comparison toggles, scroll depth (vanity interaction). `service_checkout_started` /
`service_purchased` remain for continuity with V16–V28 funnels.

## Application → arrival

| Event | When | Key properties | Question it answers |
|---|---|---|---|
| `agency_assigned` | Engine/override assigns an agency | score | Assignment speed and fit |
| `application_started` | Application created | program | Shortlist → application |
| `document_uploaded` | Upload (by student or on behalf by staff: `organization_id` set) | category | Document completion; how often agencies upload for students |
| `document_verified` | Review decision VERIFIED | category | Review throughput |
| `document_requested` | University asks for one more document | category | How often universities need more — application completeness |
| `document_request_fulfilled` | Student/agency fulfils it | hours_to_fulfil | Turnaround on university requests |
| `message_attachment_sent` | Message with files | files | Is chat moving off Kakao/WhatsApp/email? |
| `visa_started` / `visa_issued` | Visa case | — | Visa conversion |
| `student_arrived` | Arrival confirmed | — | Arrival conversion |

## Not yet measured (candidates)

Saved-view creation and use, template use, bulk review actions, SSO sign-ins, exports — add when the questions they
answer are agreed with the business (agency response time and review throughput are already derivable from tasks,
reviews and messages).
