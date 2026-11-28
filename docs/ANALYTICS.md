# Analytics

Product analytics for Hangyul Univ: philosophy, the event catalogue, privacy rules and the metrics the dashboards show.

## Philosophy

- **Measure outcomes, not clicks.** The questions are: did the student get value before paying, is the purchased
  service delivered inside its contract, and does the application reach submission, decision, visa and arrival.
- **Server-side only.** Events are recorded with `app.core.audit.track()` into `analytics_events` (name, user,
  organization, university, application, nationality, JSON properties, timestamp), so ad blockers cannot skew funnels
  and no third-party tracker sees student data. `DailyMetric` rollups (`node scripts/api.mjs daily`) aggregate them.
- **No admission prediction.** Analytics never produces an admission probability, score or ranking for a student.
  Outcome metrics are reported in aggregate with denominators, and hidden when the sample is too small.

## Privacy and do-not-track rules

- Never store document contents, essay text, passport numbers, card data, free text or scope notes in an event.
  Properties carry codes and counts only.
- Anonymous events (public pages) carry no user id and no IP address.
- No third-party analytics, advertising or session-replay script is loaded in any product; no consent-requiring
  cookie exists, so no cookie banner is shown. The one third-party script is Channel Talk customer support, on the
  Marketing site only, booted anonymously (SECURITY.md › Privacy); it is not analytics.
- Not measured on purpose: time on page, scroll depth, plan-card clicks, comparison toggles, or anything used to
  optimise a dark pattern.
- **Design Preview mode emits no events** — it makes no calls to private APIs (see [SECURITY.md](SECURITY.md)).

## Dashboard metrics

| Surface | Metrics | Rule |
|---|---|---|
| Operations/Admin console — Today, Performance | open work by waiting-on party, overdue items, response time, review throughput, stage counts | every count opens exactly the rows it counts |
| University console — Home, Insights | applicants to decide, pipeline by stage, outcomes (admitted → visa → arrived → enrolled), source countries, monthly trend | denominators shown; small samples hidden with the reason; drafts excluded from outcomes |
| Hangyul HQ | funnel conversion, plan mix by catalogue version, add-on conversion, `service_limit_reached` reasons, readiness (`/hq/readiness`) | derived from the events below and from work records |

Naming note: `agency_*` in event names and `organization_id` refer to Hangyul's internal operations team (historical
naming — see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Funnel events: visitor → student

| Event | When | Key properties | Question it answers |
|---|---|---|---|
| `quick_eligibility_completed` | Retired 2026-11-19 with the anonymous check (no UI emits it); kept for historical rows. Was: anonymous 3-question check returns | nationality, degree, language kind, meets, possible | Do visitors get value before signing up? What share see 0 matches? |
| `student_registered` | Account created | locale, nationality | Quick-check → sign-up conversion |
| `profile_started` / `profile_completed` | Profile progress | — | Does progressive profiling finish? |
| `match_generated` | Matches computed | counts per tier | How many realistic options do students have? |
| `program_viewed` / `university_viewed` | Detail pages | program/university | Discovery depth |
| `university_saved` | Shortlist | university | Shortlist building |
| `comparison_created` | Compare | program count | Decision support usage |
| `budget_viewed` | Budget planner | programs, source (selected/shortlist), housing | Do students engage with cost before applying? |
| `service_checkout_started` / `service_purchased` | Services | product, provider | Service conversion (`provider` is `toss` on the billing-key rail; a `demo` provider exists only for automated tests) |

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

## Outcome events: application → arrival

| Event | When | Key properties | Question it answers |
|---|---|---|---|
| `agency_assigned` | A case is assigned to the Hangyul operations team/owner (historical event name) | score | Assignment speed |
| `application_started` | Application created | program | Shortlist → application |
| `document_uploaded` | Upload (by student or on behalf by staff: `organization_id` set) | category | Document completion; how often staff upload for students |
| `document_verified` | Review decision VERIFIED | category | Review throughput |
| `document_requested` | University asks for one more document | category | How often universities need more — application completeness |
| `document_request_fulfilled` | Student/Hangyul team fulfils it | hours_to_fulfil | Turnaround on university requests |
| `message_attachment_sent` | Message with files | files | Is chat moving off Kakao/WhatsApp/email? |
| `visa_started` / `visa_issued` | Visa case | — | Visa conversion |
| `student_arrived` | Arrival confirmed | — | Arrival conversion |

## Not yet measured (candidates)

Saved-view creation and use, template use, bulk review actions, SSO sign-ins, exports — add when the questions they
answer are agreed with the business (team response time and review throughput are already derivable from tasks,
reviews and messages).
