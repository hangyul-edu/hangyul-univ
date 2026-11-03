# V22 Student UX — simplification pass (REPORT §248, §252)

Scope: `apps/student-web` (home, messages, secondary navigation), `packages/i18n/locales/{en,ko}/student.json`.
Spec: REPORT §248 S1–S4, §246 A3/A4 (team identity), §252.1 deletions. Register/Login/Services/PaymentReturn untouched.

## 1. Home (`pages/Dashboard.tsx`) — before / after

| | Before (V7–V21) | After (V22) |
|---|---|---|
| Header | Photo band (`HomeBand`, licensed campus/city photo) with greeting over it | Plain greeting + one season/stage line. White page, ink text. |
| Journey | Six photo tiles straddling the band (`sh-journey st7-tiles`), progress bar on phones, states implicit | `StageStrip` (packages/ui, journey mode, numbered, `lg`): **01 Explore · 02 Prepare · 03 Apply · 04 Admitted · 05 Visa · 06 Arrive** (ko: 탐색 · 준비 · 지원 · 합격 · 비자 · 입국). Done = ink check, current = tangerine, upcoming = neutral and not clickable. Exactly one `aria-current="step"`. Tapping a done/current stage shows that stage's summary ("Stage n of 6 · label · Done / You are here" + one sentence) inline beneath the strip. On phones the strip scrolls sideways and starts with the current stage in view. |
| Section order | Next action → Improve ("What you can do today") → Applications → After-admission → Recommended/Closest (main) · Coming up → Counselor (side) | Fixed DOM order: **strip → ONE next action → (refund, if owed) → [all tasks, when `?show=tasks`] → what the Hangyul team is doing → coming up (+ housing/arrival once real) → applications that need you → documents that need you → your Hangyul team (messages)**. Recommendations (and the V9 language-routes card) render only in stage 01 with no applications (`showsRecommendations`). On ≥1024 px "coming up" and the team card sit in a quiet side column via `grid-auto-flow: dense`; the DOM order is unchanged. |
| "What the Hangyul team is doing" | — (did not exist) | From data the home already has: applications in a team-owned status (`TEAM_STATUSES`: profile review, preparing submission, following up with the university, tracking the admission letter, tracking the visa), documents in review (`document_counts.NEEDS_REVIEW + PROCESSING`), and the team's open tasks (`GET /tasks`, owner ≠ me). Nothing available → one quiet sentence. |
| Applications | All applications, every status | Only those that need the student (`needsStudent`: student-owned status, an open missing document, or an open improvement for that application). None → one line "All n applications are with the universities — nothing needs you" + View all. |
| Documents | Buried inside Improve/Applications | Own section: `missing_documents` not ready (+ dossier nudges), linking into `/documents`. |
| Team card | "Your team — <staff name> · Counselor at <org>", initials avatar | "Your Hangyul team / 한귤 유니브 상담팀" with the brand-mark avatar, "with <agency>", next call, unread count (button goes primary when unread > 0). Never a staff name. |
| Removed | Photo band, "What you can do today" heading, named counselor, recommendations for students with applications, `/tasks` as a link target | — |

### Journey mapping rule (`lib/journey.ts`, tested in `lib/journey.test.ts`)

```
EXPLORE | PROFILE | MATCH → 01 discover (Explore / 탐색)
APPLY                    → 02 prepare  (Prepare / 준비)
DECISION                 → 03 apply    (Apply / 지원)
ENROLL                   → 04 admission (Admitted / 합격)
VISA                     → 05 visa     (Visa / 비자)
ARRIVAL | STUDENT_LIFE   → 06 arrival  (Arrive / 입국)
state: index < current → done · == → current · > → todo
```

Measured on the dev stack: `student@` (Lan) = 02 current, `student.offer@` (Hà) = 04, `student.visa@` (Bảo) = 05, `student.arrived@` (Vy) = 06. `student.new@` (Dilnoza) has no plan, so the pre-existing V17 paywall (`PlanGate`) sends `/` to `/services` before the home renders — her capture shows the plan page, not a V22 regression.

## 2. Team identity (REPORT §246 A3/A4)

* `lib/team.ts`: `isTeam(author)` (`kind === 'team' | 'staff'`, `id === 'team'`, or no author) and `displayName(t, author)` → `t('messages.team')`.
* `components/TeamAvatar.tsx`: brand mark (`brandAssets.symbol`) in a white disc with a hairline ring, used in Messages (bubbles and conversation list), the home team card and the "team is doing" rows.
* Messages: every non-student author renders as the brand mark + "Hangyul Univ team / 한귤 유니브 상담팀"; the upcoming-call host likewise. Verified: 5/5 staff bubbles in Lan's thread show the team avatar and a single author label.
* `ApplicationDetail` (`useCounselor`), `TaskList` (task owner), `success/Submission.tsx` (submitter, evidence "recorded by"), `success/Strategy.tsx` (plan reviewed by), `lib/writing.ts` `reviewerName()` (`display === 'team'` or name `Hangyul Univ Team` → localised team name, e.g. "한귤 유니브 상담팀 (Lotus Bridge Education)"; a Hangyul-side team reviewer is just the team name) — no screen passes a staff `full_name` to a student-facing string any more.
* Leak check after the pass: `counsel|상담사|담당 상담|전담` → 0 hits in `student.json` (en/ko, outside `register`/`login`) and 0 render-site hits in `apps/student-web/src` (only code comments/identifiers remain).

## 3. Secondary pages (REPORT §248 S4)

| Route | Before | After |
|---|---|---|
| `/tasks` | Page (Tasks.tsx) | `<Navigate to="/?show=tasks" replace>`; the home reveals the full task list (`components/TaskList.tsx`, grouped Now / This week / Later, with a Hide link). "n other tasks" and Coming up → View all point there. |
| `/notifications` | Page, not in nav | Unchanged page, still reachable; the bell is the entry point. Not in More (it never was). |
| `/budget` | Page (Budget.tsx) | `<Navigate>` to `/compare#budget` (`?programs=` carried over as `?ids=`, `lib/nav.ts › budgetRedirect`). `BudgetSection` renders as the `#budget` section at the bottom of `/compare` (compared programs, or the shortlist when fewer than two are compared). Compare's "See the full first-year budget" button is now an in-page anchor. Links in Saved and Explore go to `/compare#budget`. |
| `/essays` | More › Prepare › Essays | Route kept; entry removed from More. Documents has a "Writing" link (`/essays`) next to Upload. Essay editor breadcrumb still links `/essays`. |

### More menu — before / after

| Group | Before | After |
|---|---|---|
| Prepare | Documents · Essays · Scholarships · Budget · Family | Documents · Scholarships · Family |
| Going to Korea (admitted/arrival only) | Visa · Housing · Arrival · Help | unchanged |
| Account | Help & support (pre-admission) · Profile · Services · Settings | unchanged |

Rail / bottom tabs unchanged: Home · Universities · Applications · Messages (+ More tab on phones). Rendered `/more` for Lan: `/documents /scholarships /family /support /profile /services /settings`.

Redirects verified in Chromium: `/tasks → /?show=tasks`, `/budget?programs=x → /compare?ids=x#budget`, `/budget → /compare#budget`, `/notifications` and `/essays` still render (no 404).

## 4. Visual

`apps/student-web/src/v22.css` (imported after v16.css): white page, hairline rules between list rows and around the strip, tangerine only for the current stage number/eyebrow and the primary button; the next action is no longer a card. `v7.css`/`v16.css` `.st7-*` rules are now unused (the `st7-home` class is gone) and `components/HomeBand.tsx` is no longer imported; both left in place for the owner to delete.

## 5. Overflow results (`document.documentElement.scrollWidth <= innerWidth`, student@)

| Width | / | /messages | /applications | /documents | /more | /compare |
|---|---|---|---|---|---|---|
| 390 | OK | OK | OK | OK | OK | OK |
| 768 | OK | OK | OK | OK | OK | OK |
| 1024 | OK | OK | OK | OK | OK | OK |
| 1440 | OK | OK | OK | OK | OK | OK |
| 1728 | OK | OK | OK | OK | OK | OK |

Home at 390/1440 also OK for student.offer@, student.visa@, student.arrived@ (student.new@ lands on /services, OK at both). At 390 the strip scrolls (`scrollWidth > clientWidth`) and the current stage is fully visible; exactly one `aria-current` at every width; clicking a done stage changes the summary (`data-state="done"`). No page errors in any run.

## 6. Validation

* `tsc --noEmit` (apps/student-web): clean.
* `vitest run` (apps/student-web): 15 files, 101 tests, all green — new `lib/journey.test.ts` (mapping, single current, recommendations rule), `lib/nav.test.ts` (+redirect helpers), `lib/writing.test.ts` (+team reviewer name).
* Captures: `docs/qa/v22/shots/student-home-<persona>-{390,1440}.png` (+ `-full`) for student, student.new, student.offer, student.visa, student.arrived; `student-messages-{390,1440}.png` (inbox) and `student-messages-thread-{390,1440}.png` (thread with team identity).

## 7. Strings changed — `packages/i18n/locales/en/student.json` (134)

| key | before | after |
|---|---|---|
| `v22.home.teamNow` | — | What the Hangyul team is doing |
| `v22.home.teamNowEmpty` | — | Nothing is in progress on our side right now — your next step is above. |
| `v22.home.docsChecking_one` | — | {{count}} document is being checked |
| `v22.home.docsChecking_other` | — | {{count}} documents are being checked |
| `v22.home.appTeam.review` | — | Reviewing your profile for {{university}} |
| `v22.home.appTeam.submit` | — | Preparing your submission to {{university}} |
| `v22.home.appTeam.follow` | — | Following up with {{university}} |
| `v22.home.appTeam.letter` | — | Tracking your admission letter from {{university}} |
| `v22.home.appTeam.visa` | — | Tracking your visa application |
| `v22.home.appsNeedYou` | — | Applications that need you |
| `v22.home.appsQuiet_one` | — | Your application is with the university — nothing needs you right now. |
| `v22.home.appsQuiet_other` | — | All {{count}} applications are with the universities — nothing needs you right now. |
| `v22.home.withAgency` | — | with {{org}} |
| `v22.home.hideTasks` | — | Hide |
| `v22.home.writing` | — | Writing |
| `v22.journey.stageOf` | — | Stage {{n}} of {{total}} |
| `v22.compare.budget` | — | First-year budget |
| `v22.compare.budgetSub` | — | What each choice is likely to cost in the first year, who is paid and when. |
| `phase.discover.label` | Discover | Explore |
| `phase.admission.label` | Admission | Admitted |
| `phase.arrival.label` | Arrival | Arrive |
| `phase.prepare.text` | Gather documents, get them checked, and write your statement and study plan with your counselor. | Gather documents, get them checked, and write your statement and study plan with the Hangyul team. |
| `messages.team` | Your team | Hangyul Univ team |
| `messages.subtitle` | Talk with your counselor. Replies usually arrive within one business day. | Talk with the Hangyul team. Replies usually arrive within one business day. |
| `messages.visibility` | Visible to you and your support team | Visible to you and the Hangyul team |
| `messages.pickText` | Or start a new one with your team. | Or start a new one with the Hangyul team. |
| `messages.new.subtitle` | Your support team will reply here. | The Hangyul team will reply here. |
| `home.team` | Your team | Your Hangyul team |
| `home.counselorAt` | Counselor at {{org}} | with {{org}} |
| `dashboard.counselor.title` | Your counselor | Your Hangyul team |
| `dashboard.counselor.team` | Your study team | Hangyul Univ team |
| `dashboard.counselor.message` | Message your counselor | Message the team |
| `dashboard.counselor.noneTitle` | Want a counselor by your side? | Want the Hangyul team by your side? |
| `dashboard.counselor.noneText` | A partner agency counselor can review your documents, essays and strategy — in your language. | With a plan, the Hangyul team reviews your documents, essays and strategy — in your language. |
| `onboarding.steps.sponsor.subtitle` | Universities and visa officers ask about financial support. Your goal helps your counselor help you. | Universities and visa officers ask about financial support. Your goal helps the Hangyul team help you. |
| `onboarding.education.method` | How we compare grades: we convert your GPA to a 0–100% score using a simple linear scale (your GPA ÷ scale maximum). Universities may convert differently — your counselor can add a note if your school uses a special scale. | How we compare grades: we convert your GPA to a 0–100% score using a simple linear scale (your GPA ÷ scale maximum). Universities may convert differently — the Hangyul team can add a note if your school uses a special scale. |
| `dashboard.nextAction.TASK.text.ESSAY_WRITE` | Your counselor will review it with you. Start with a rough draft — it doesn't need to be perfect. | The Hangyul team will review it with you. Start with a rough draft — it doesn't need to be perfect. |
| `dashboard.nextAction.TASK.text.INTERVIEW` | Review the time and practise a few common questions with your counselor. | Review the time and practise a few common questions with the Hangyul team. |
| `dashboard.nextAction.FINISH_APPLICATION.text_one` | {{remaining}} item remains before it can be submitted. Your counselor submits it once everything is checked. | {{remaining}} item remains before it can be submitted. The Hangyul team submits it once everything is checked. |
| `dashboard.nextAction.FINISH_APPLICATION.text_other` | {{remaining}} items remain before it can be submitted. Your counselor submits it once everything is checked. | {{remaining}} items remain before it can be submitted. The Hangyul team submits it once everything is checked. |
| `dashboard.nextAction.FINISH_APPLICATION.text` | {{remaining}} items remain before it can be submitted. Your counselor submits it once everything is checked. | {{remaining}} items remain before it can be submitted. The Hangyul team submits it once everything is checked. |
| `dashboard.nextAction.APPLICATION_ITEM.REVISE_ESSAY.text` | Your counselor left comments. Your application can't be submitted until it's approved. | The Hangyul team left comments. Your application can't be submitted until it's approved. |
| `dashboard.nextAction.APPLICATION_ITEM.WRITE_ESSAY.text` | Your counselor will review it with you. Start with a rough draft — it doesn't need to be perfect. | The Hangyul team will review it with you. Start with a rough draft — it doesn't need to be perfect. |
| `university.housing.emptyText` | Your counselor can help you look at off-campus options near campus. | The Hangyul team can help you look at off-campus options near campus. |
| `university.partner.benefit.DEDICATED_COUNSELOR` | A dedicated counselor for this university | Dedicated Hangyul team support for this university |
| `university.interest.lede` | We haven't verified this university's admission requirements yet. Ask your counsellor and they will check the intakes and requirements and plan it with you. | We haven't verified this university's admission requirements yet. Ask the Hangyul team and they will check the intakes and requirements and plan it with you. |
| `university.interest.ask` | Ask your counsellor | Ask the Hangyul team |
| `matches.guarantee.noTerms` | Terms are set by the partner agreement — your counselor will confirm them with you. | Terms are set by the partner agreement — the Hangyul team will confirm them with you. |
| `applicationDetail.statusText.PROFILE_REVIEW` | Your counselor is reviewing your profile for this program. | The Hangyul team is reviewing your profile for this program. |
| `applicationDetail.statusText.DOCUMENT_PREPARATION` | Work through the checklist below. When everything is verified, your counselor marks it ready to submit. | Work through the checklist below. When everything is verified, the Hangyul team marks it ready to submit. |
| `applicationDetail.statusText.INTERVIEW` | You've been invited to an interview. Check the time and prepare with your counselor. | You've been invited to an interview. Check the time and prepare with the Hangyul team. |
| `applicationDetail.statusText.REJECTED` | The university didn't offer a place this time. Your counselor can help you plan next steps. | The university didn't offer a place this time. The Hangyul team can help you plan next steps. |
| `applicationDetail.actor.AGENCY` | Your counselor | Hangyul team |
| `applicationDetail.actions.readyHint` | Once all documents are verified, your counselor marks the application ready and you can submit. | Once all documents are verified, the Hangyul team marks the application ready and you can submit. |
| `applicationDetail.transition.PROFILE_REVIEW` | Ask my counselor to review | Ask the Hangyul team to review |
| `applicationDetail.agency.none` | You're applying on your own. You can add counselor support anytime. | You're applying on your own. You can add the Hangyul team's support anytime. |
| `applicationDetail.agency.message` | Message your counselor | Message the team |
| `documents.privacy.text` | Only you and your assigned counselor can open your documents. A university sees them only after you submit an application to it. Every view is logged, and download links expire after 5 minutes. | Only you and the Hangyul team can open your documents. A university sees them only after you submit an application to it. Every view is logged, and download links expire after 5 minutes. |
| `documents.privacy.short` | Stored encrypted. Only you and your counselor can open it until you submit an application. | Stored encrypted. Only you and the Hangyul team can open it until you submit an application. |
| `essays.subtitle` | Write in your own words. Your counselor reviews and comments — you decide what to change. | Write in your own words. The Hangyul team reviews and comments — you decide what to change. |
| `essay.precheck.subtitle` | A computer checks what the prompt asks for and how the draft is organised. It is not a person, it never rewrites or adds content, and your counselor reviews the substance. | A computer checks what the prompt asks for and how the draft is organised. It is not a person, it never rewrites or adds content, and the Hangyul team reviews the substance. |
| `housing.item.review_contract` | Review the contract (your counselor can help) | Review the contract (the Hangyul team can help) |
| `arrival.emergency.note` | In an emergency, call first — then message your counselor. | In an emergency, call first — then message the Hangyul team. |
| `services.feature.counselor_assignment` | Your own counselor | The Hangyul team at your side |
| `services.success.assignedText` | Your counselor will introduce themselves in Messages — usually within one business day. | The Hangyul team will say hello in Messages — usually within one business day. |
| `services.success.pending` | We're matching you with a counselor. You'll get a notification soon. | We're setting up your plan with the Hangyul team. You'll get a notification soon. |
| `support.new.subtitle` | Tell us what's going on. Your counselor (or the Hangyul team) will reply in Messages. | Tell us what's going on. The Hangyul team will reply in Messages. |
| `settings.account.preferredHint` | Shown in greetings and to your counselor. | Shown in greetings and to the Hangyul team. |
| `settings.privacy.purpose.SHARE_WITH_AGENCY.title` | Share my profile with my counselor's agency | Share my profile with the Hangyul team's partner agency |
| `settings.privacy.purpose.SHARE_WITH_AGENCY.text` | Needed for your counselor to review documents and essays. | Needed for the Hangyul team to review documents and essays. |
| `settings.privacy.who.agency` | Your counselor's agency: your profile, documents and essays — only after you're assigned. | The Hangyul team's partner agency: your profile, documents and essays — only after you have a plan. |
| `more.hint.services` | Counselor and review plans | Plans and reviews |
| `documentsV2.group.reviewSub` | Your counselor checks each document, usually within 2 working days. | The Hangyul team checks each document, usually within 2 working days. |
| `visaV2.askCounselor` | Ask your counselor | Ask the Hangyul team |
| `workspace.team` | Your counselor | Hangyul team |
| `workspace.who.team` | Hangyul & your counselor | The Hangyul team |
| `budget.note.insurance.DORM` | Required for international students. Your counselor confirms the current premium for your situation. | Required for international students. The Hangyul team confirms the current premium for your situation. |
| `budget.note.insurance.OFF_CAMPUS` | Required for international students. Your counselor confirms the current premium for your situation. | Required for international students. The Hangyul team confirms the current premium for your situation. |
| `servicesV3.subtitle` | You can do everything yourself for free. Paid plans add people: Hangyul's team checks your work, or a partner-agency counselor guides you from shortlist to arrival. | You can do everything yourself for free. Paid plans add people: the Hangyul team checks your work, or guides you from shortlist to arrival. |
| `servicesV3.who.counselor` | Your counselor | The Hangyul team |
| `servicesV3.promise.full` | A partner-agency counselor guides you end to end | The Hangyul team guides you end to end |
| `ws3.counselorAt` | Counselor: {{org}} | Hangyul team · {{org}} |
| `ws3.ready.counselor` | Your counselor's final check | The Hangyul team's final check |
| `ws3.ready.counselorOk` | Your counselor has done the final check | The Hangyul team has done the final check |
| `ws3.review.monitor` | Hangyul and your counselor are monitoring the application with the admissions office. | The Hangyul team is monitoring the application with the admissions office. |
| `ws3.offer.step2.text` | We let the university and your counselor know. | We let the university and the Hangyul team know. |
| `ws3.tuition.how` | Use the payment instructions in the university's offer letter (usually a virtual bank account in your name). Keep the receipt — you need it for your visa. Your counselor can check the instructions with you. | Use the payment instructions in the university's offer letter (usually a virtual bank account in your name). Keep the receipt — you need it for your visa. The Hangyul team can check the instructions with you. |
| `ws3.writingSub` | Your personal statement and study plan. Your counselor reviews them; the words stay yours. | Your personal statement and study plan. The Hangyul team reviews them; the words stay yours. |
| `ws3.messages.noneText` | Your counselor's messages about this application will appear here. | The Hangyul team's messages about this application will appear here. |
| `offers.note` | Estimated totals include living costs and use the budget planner's rules. Talk to your counselor before you decline an offer. | Estimated totals include living costs and use the budget planner's rules. Talk to the Hangyul team before you decline an offer. |
| `legalFlow.step.verify.why` | Your counselor checks it once, and it is reused for every application. | The Hangyul team checks it once, and it is reused for every application. |
| `legalFlow.note.UNVERIFIED` | We have not verified the legalization route for this country yet — your counselor will confirm. | We have not verified the legalization route for this country yet — the Hangyul team will confirm. |
| `housingV3.honest` | Hangyul doesn't list private rentals. Your counselor can review a lease with you before you sign. | Hangyul doesn't list private rentals. The Hangyul team can review a lease with you before you sign. |
| `writing.subtitle` | Your personal statements and study plans. Your counselor comments on structure and clarity — the ideas and the words stay yours. | Your personal statements and study plans. The Hangyul team comments on structure and clarity — the ideas and the words stay yours. |
| `writing.others` | With your counselor or done | With the Hangyul team or done |
| `writing.status.AGENCY_REVIEW` | Counselor reviewing | Hangyul team reviewing |
| `writing.status.FINAL_REVIEW` | Counselor reviewing | Hangyul team reviewing |
| `tasksV3.subtitle` | Everything that moves your applications forward — yours first, then what your counselor is handling. | Everything that moves your applications forward — yours first, then what the Hangyul team is handling. |
| `tasksV3.summary` | {{mine}} for you · {{theirs}} with your counselor | {{mine}} for you · {{theirs}} with the Hangyul team |
| `tasksV3.owner.counselor` | {{name}} (your counselor) | Hangyul team |
| `tasksV3.owner.team` | Your team | Hangyul team |
| `tasksV3.summaryMine_one` | {{count}} task for you. Nothing is waiting on your counselor right now. | {{count}} task for you. Nothing is waiting on the Hangyul team right now. |
| `tasksV3.summaryMine_other` | {{count}} tasks for you. Nothing is waiting on your counselor right now. | {{count}} tasks for you. Nothing is waiting on the Hangyul team right now. |
| `scholarshipsV3.note` | Amounts are what the provider publishes; your counselor confirms the current terms before you rely on them. | Amounts are what the provider publishes; the Hangyul team confirms the current terms before you rely on them. |
| `supportV3.askText` | Your counselor answers most questions within one working day. For visa, housing, money or health questions you can also open a ticket so nothing gets lost. | The Hangyul team answers most questions within one working day. For visa, housing, money or health questions you can also open a ticket so nothing gets lost. |
| `supportV3.message` | Message your counselor | Message the team |
| `v4.review.late` | Taking longer than usual — it's flagged as late for your counselor. You don't need to upload it again. | Taking longer than usual — it's flagged as late for the Hangyul team. You don't need to upload it again. |
| `v4.review.groupSub` | Your counselor checks each document before it's used. | The Hangyul team checks each document before it's used. |
| `v4.ws.yourCounselor` | your counselor | the Hangyul team |
| `v4.ws.who.team` | Hangyul & your counselor | The Hangyul team |
| `v4.ws.empty.team` | Nothing waiting on your counselor. | Nothing waiting on the Hangyul team. |
| `v4.ws.helpText` | {{name}} is your counselor for this application. | The Hangyul team is working on this application with you. |
| `v4.ws.helpTextNoName` | Your counselor's team is here to help with this application. | The Hangyul team is here to help with this application. |
| `v4.ws.message` | Message {{name}} | Message the team |
| `v4.ws.messageTeam` | Message your counselor | Message the team |
| `v4.essay.role.counselor` | Your counselor | Hangyul team |
| `v4.docs.essayWrite` | You write this in Writing — your counselor reads it before it's sent to {{university}}. | You write this in Writing — the Hangyul team reads it before it's sent to {{university}}. |
| `v4.docs.essayReading` | Your counselor is reading your draft — nothing to upload now. | The Hangyul team is reading your draft — nothing to upload now. |
| `v8.budget.fee.text.DUE` | {{name}} — due to Hangyul before your counselor starts. Not part of what you pay the university. | {{name}} — due to Hangyul before the team starts. Not part of what you pay the university. |
| `v8.budget.fee.text.NONE` | Optional. You can apply on your own with the free plan; paid plans add a counselor and reviews. | Optional. You can apply on your own with the free plan; paid plans add the Hangyul team and reviews. |
| `v9.money.note.VISA_FEE_UNKNOWN` | Not published for your route yet — your counselor confirms. | Not published for your route yet — the Hangyul team confirms. |
| `v9.money.note.VISA_FEE_NO_ROUTE` | We haven't checked your embassy yet — your counselor confirms. | We haven't checked your embassy yet — the Hangyul team confirms. |
| `v9.funds.kind.NOT_STATED` | The embassy states no minimum amount — plan for one year of tuition and living costs; your counselor confirms. | The embassy states no minimum amount — plan for one year of tuition and living costs; the Hangyul team confirms. |
| `v9.funds.whose.UNKNOWN` | Whose name: your counselor confirms with the embassy | Whose name: the Hangyul team confirms with the embassy |
| `v9.funds.waived` | Your university is in the top ('excellent') tier: the embassy may not ask for this — your counselor confirms. | Your university is in the top ('excellent') tier: the embassy may not ask for this — the Hangyul team confirms. |
| `v9.funds.status.NO_ROUTE` | We haven't checked the money rule for your embassy yet — your counselor confirms it. | We haven't checked the money rule for your embassy yet — the Hangyul team confirms it. |
| `v9.family.never` | Never shown: your messages, essays, notes from your counselor, or any document file. | Never shown: your messages, essays, notes from the Hangyul team, or any document file. |
| `v9.refund.ruleUnknown` | Your counselor confirms the university's refund rule and amount with you. | The Hangyul team confirms the university's refund rule and amount with you. |
| `v9.refund.cta` | Message your counselor | Message the team |
| `v9.visa.caveat.TB_POST_CONFLICT` | The Almaty consulate and the embassy describe the TB test differently — your counselor confirms which test Almaty accepts. | The Almaty consulate and the embassy describe the TB test differently — the Hangyul team confirms which test Almaty accepts. |
| `v15.services.allowance.unlimited` | Ongoing with your counselor | Ongoing with the Hangyul team |
| `v15.services.scope.priority_response` | Priority response from your counselor | Priority response from the Hangyul team |
| `v15.services.addOn.offered` | Your counselor has offered these extra services. | The Hangyul team has offered these extra services. |
| `v17.gate.what.messages` | your counsellor | the Hangyul team |

## 8. Strings changed — `packages/i18n/locales/ko/student.json` (128)

| key | before | after |
|---|---|---|
| `v22.home.teamNow` | — | 한귤 상담팀이 진행 중인 일 |
| `v22.home.teamNowEmpty` | — | 지금 상담팀 쪽에서 진행 중인 일은 없어요. 다음 할 일은 위에 있어요. |
| `v22.home.docsChecking_one` | — | 서류 {{count}}개를 확인하고 있어요 |
| `v22.home.docsChecking_other` | — | 서류 {{count}}개를 확인하고 있어요 |
| `v22.home.appTeam.review` | — | {{university}} 지원을 위해 프로필을 검토하고 있어요 |
| `v22.home.appTeam.submit` | — | {{university}} 제출을 준비하고 있어요 |
| `v22.home.appTeam.follow` | — | {{university}} 입학처와 진행 상황을 확인하고 있어요 |
| `v22.home.appTeam.letter` | — | {{university}} 표준입학허가서 발급을 확인하고 있어요 |
| `v22.home.appTeam.visa` | — | 비자 신청 진행 상황을 확인하고 있어요 |
| `v22.home.appsNeedYou` | — | 확인이 필요한 지원서 |
| `v22.home.appsQuiet_one` | — | 지원서가 대학에서 심사 중이에요. 지금 확인할 것은 없어요. |
| `v22.home.appsQuiet_other` | — | 지원서 {{count}}건이 모두 진행 중이에요. 지금 확인할 것은 없어요. |
| `v22.home.withAgency` | — | {{org}}와 함께 |
| `v22.home.hideTasks` | — | 접기 |
| `v22.home.writing` | — | 글쓰기 |
| `v22.journey.stageOf` | — | {{total}}단계 중 {{n}}단계 |
| `v22.compare.budget` | — | 첫해 예산 |
| `v22.compare.budgetSub` | — | 각 선택지의 첫해 예상 비용과 누구에게 언제 내는지 보여 드려요. |
| `phase.prepare.text` | 서류를 모아 검토받고, 상담사와 함께 자기소개서와 학업계획서를 작성합니다. | 서류를 모아 검토받고, 한귤 상담팀과 함께 자기소개서와 학업계획서를 작성합니다. |
| `messages.team` | 지원팀 | 한귤 유니브 상담팀 |
| `messages.subtitle` | 상담사와 대화하세요. 보통 영업일 기준 하루 안에 답장이 와요. | 한귤 상담팀과 대화하세요. 보통 영업일 기준 하루 안에 답장이 와요. |
| `messages.visibility` | 나와 지원팀만 볼 수 있어요 | 나와 한귤 상담팀만 볼 수 있어요 |
| `messages.pickText` | 또는 지원팀과 새 대화를 시작하세요. | 또는 한귤 상담팀과 새 대화를 시작하세요. |
| `messages.new.subtitle` | 지원팀이 여기로 답장해요. | 한귤 상담팀이 여기로 답장해요. |
| `home.team` | 담당 팀 | 한귤 유니브 상담팀 |
| `home.counselorAt` | {{org}} 상담사 | {{org}}와 함께 |
| `dashboard.counselor.title` | 나의 상담사 | 한귤 유니브 상담팀 |
| `dashboard.counselor.team` | 나의 유학 지원팀 | 한귤 유니브 상담팀 |
| `dashboard.counselor.message` | 상담사에게 메시지 보내기 | 상담팀에 메시지 보내기 |
| `dashboard.counselor.noneTitle` | 상담사의 도움이 필요하신가요? | 한귤 상담팀의 도움이 필요하신가요? |
| `dashboard.counselor.noneText` | 파트너 유학원 상담사가 서류, 에세이, 지원 전략을 내 언어로 검토해 드려요. | 플랜을 선택하면 한귤 상담팀이 서류, 에세이, 지원 전략을 내 언어로 검토해 드려요. |
| `onboarding.steps.sponsor.subtitle` | 대학과 비자 심사관은 재정 지원에 대해 물어봐요. 목표를 알려주시면 상담사가 더 잘 도와드릴 수 있어요. | 대학과 비자 심사관은 재정 지원에 대해 물어봐요. 목표를 알려주시면 한귤 상담팀이 더 잘 도와드릴 수 있어요. |
| `onboarding.education.method` | 성적 비교 방법: GPA를 단순 선형 방식(내 GPA ÷ 만점)으로 0~100% 점수로 환산해요. 대학마다 환산 방식이 다를 수 있으며, 학교가 특수한 척도를 쓰는 경우 상담사가 메모를 남길 수 있어요. | 성적 비교 방법: GPA를 단순 선형 방식(내 GPA ÷ 만점)으로 0~100% 점수로 환산해요. 대학마다 환산 방식이 다를 수 있으며, 학교가 특수한 척도를 쓰는 경우 한귤 상담팀이 메모를 남길 수 있어요. |
| `dashboard.nextAction.TASK.text.ESSAY_WRITE` | 상담사가 함께 검토해 드려요. 완벽하지 않아도 괜찮으니 초안부터 써 보세요. | 한귤 상담팀이 함께 검토해 드려요. 완벽하지 않아도 괜찮으니 초안부터 써 보세요. |
| `dashboard.nextAction.TASK.text.INTERVIEW` | 면접 시간을 확인하고 상담사와 자주 나오는 질문을 연습해 보세요. | 면접 시간을 확인하고 한귤 상담팀과 자주 나오는 질문을 연습해 보세요. |
| `dashboard.nextAction.FINISH_APPLICATION.text_one` | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 상담사가 제출해요. | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 한귤 상담팀이 제출해요. |
| `dashboard.nextAction.FINISH_APPLICATION.text_other` | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 상담사가 제출해요. | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 한귤 상담팀이 제출해요. |
| `dashboard.nextAction.FINISH_APPLICATION.text` | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 상담사가 제출해요. | 제출 전에 {{remaining}}개 항목이 남았어요. 모두 확인되면 한귤 상담팀이 제출해요. |
| `dashboard.nextAction.APPLICATION_ITEM.REVISE_ESSAY.text` | 상담사가 의견을 남겼어요. 승인되어야 지원서를 제출할 수 있어요. | 한귤 상담팀이 의견을 남겼어요. 승인되어야 지원서를 제출할 수 있어요. |
| `dashboard.nextAction.APPLICATION_ITEM.WRITE_ESSAY.text` | 상담사가 함께 검토해요. 완벽하지 않아도 괜찮으니 초안부터 시작하세요. | 한귤 상담팀이 함께 검토해요. 완벽하지 않아도 괜찮으니 초안부터 시작하세요. |
| `university.housing.emptyText` | 상담사가 캠퍼스 근처의 다른 주거 옵션을 함께 찾아 드릴 수 있어요. | 한귤 상담팀이 캠퍼스 근처의 다른 주거 옵션을 함께 찾아 드릴 수 있어요. |
| `university.partner.benefit.DEDICATED_COUNSELOR` | 이 대학 전담 상담사 | 이 대학에 특화된 한귤 상담팀 지원 |
| `university.interest.lede` | 아직 이 대학의 모집 요강 데이터를 확인하지 못했어요. 담당 상담사에게 요청하면 모집 시기와 지원 요건을 확인해 함께 계획을 세워 드려요. | 아직 이 대학의 모집 요강 데이터를 확인하지 못했어요. 한귤 상담팀에 요청하면 모집 시기와 지원 요건을 확인해 함께 계획을 세워 드려요. |
| `university.interest.ask` | 상담사에게 요청하기 | 한귤 상담팀에 요청하기 |
| `matches.guarantee.noTerms` | 조건은 파트너 협약에 따라 정해지며, 상담사가 함께 확인해 드려요. | 조건은 파트너 협약에 따라 정해지며, 한귤 상담팀이 함께 확인해 드려요. |
| `applicationDetail.statusText.PROFILE_REVIEW` | 상담사가 이 프로그램에 맞춰 프로필을 검토하고 있어요. | 한귤 상담팀이 이 프로그램에 맞춰 프로필을 검토하고 있어요. |
| `applicationDetail.statusText.DOCUMENT_PREPARATION` | 아래 체크리스트를 하나씩 완료하세요. 모든 서류가 인증되면 상담사가 제출 준비 완료로 표시해요. | 아래 체크리스트를 하나씩 완료하세요. 모든 서류가 인증되면 한귤 상담팀이 제출 준비 완료로 표시해요. |
| `applicationDetail.statusText.INTERVIEW` | 면접에 초대됐어요. 시간을 확인하고 상담사와 함께 준비하세요. | 면접에 초대됐어요. 시간을 확인하고 한귤 상담팀과 함께 준비하세요. |
| `applicationDetail.statusText.REJECTED` | 이번에는 합격하지 못했어요. 상담사가 다음 계획을 함께 세워 드릴게요. | 이번에는 합격하지 못했어요. 한귤 상담팀이 다음 계획을 함께 세워 드릴게요. |
| `applicationDetail.actor.AGENCY` | 상담사 | 한귤 상담팀 |
| `applicationDetail.actions.readyHint` | 모든 서류가 인증되면 상담사가 제출 준비 완료로 표시하고, 그때 제출할 수 있어요. | 모든 서류가 인증되면 한귤 상담팀이 제출 준비 완료로 표시하고, 그때 제출할 수 있어요. |
| `applicationDetail.transition.PROFILE_REVIEW` | 상담사에게 검토 요청 | 한귤 상담팀에 검토 요청 |
| `applicationDetail.agency.none` | 혼자 지원하고 있어요. 언제든 상담사 지원을 추가할 수 있어요. | 혼자 지원하고 있어요. 언제든 한귤 상담팀의 지원을 추가할 수 있어요. |
| `applicationDetail.agency.message` | 상담사에게 메시지 보내기 | 상담팀에 메시지 보내기 |
| `documents.privacy.text` | 서류는 나와 배정된 상담사만 열어볼 수 있어요. 대학은 내가 그 대학에 지원서를 제출한 뒤에만 볼 수 있어요. 모든 열람은 기록되며, 다운로드 링크는 5분 뒤 만료돼요. | 서류는 나와 한귤 상담팀만 열어볼 수 있어요. 대학은 내가 그 대학에 지원서를 제출한 뒤에만 볼 수 있어요. 모든 열람은 기록되며, 다운로드 링크는 5분 뒤 만료돼요. |
| `documents.privacy.short` | 암호화해 보관해요. 지원서를 제출하기 전까지는 나와 상담사만 열어볼 수 있어요. | 암호화해 보관해요. 지원서를 제출하기 전까지는 나와 한귤 상담팀만 열어볼 수 있어요. |
| `essays.subtitle` | 내 말로 직접 써요. 상담사가 검토하고 의견을 남기지만, 무엇을 바꿀지는 내가 정해요. | 내 말로 직접 써요. 한귤 상담팀이 검토하고 의견을 남기지만, 무엇을 바꿀지는 내가 정해요. |
| `essay.precheck.subtitle` | 컴퓨터가 질문에서 요구하는 내용과 글의 구성을 점검해요. 사람이 아니며, 내용을 고쳐 쓰거나 추가하지 않아요. 내용은 상담사가 검토해요. | 컴퓨터가 질문에서 요구하는 내용과 글의 구성을 점검해요. 사람이 아니며, 내용을 고쳐 쓰거나 추가하지 않아요. 내용은 한귤 상담팀이 검토해요. |
| `housing.item.review_contract` | 계약서 검토하기(상담사가 도와드려요) | 계약서 검토하기(한귤 상담팀이 도와드려요) |
| `arrival.emergency.note` | 긴급 상황에서는 먼저 전화하고, 그다음 상담사에게 메시지를 보내세요. | 긴급 상황에서는 먼저 전화하고, 그다음 한귤 상담팀에 메시지를 보내세요. |
| `services.feature.counselor_assignment` | 전담 상담사 배정 | 한귤 상담팀이 곁에서 함께 |
| `services.success.assignedText` | 상담사가 메시지로 인사를 드릴 거예요. 보통 영업일 기준 하루 안에 연락해요. | 한귤 상담팀이 메시지로 인사를 드릴 거예요. 보통 영업일 기준 하루 안에 연락해요. |
| `services.success.pending` | 상담사를 배정하고 있어요. 곧 알림을 보내드릴게요. | 한귤 상담팀과 플랜을 준비하고 있어요. 곧 알림을 보내드릴게요. |
| `support.new.subtitle` | 상황을 알려주세요. 상담사(또는 한귤 팀)가 메시지로 답해 드려요. | 상황을 알려주세요. 한귤 상담팀이 메시지로 답해 드려요. |
| `settings.account.preferredHint` | 인사말과 상담사에게 보여요. | 인사말과 한귤 상담팀에게 보여요. |
| `settings.privacy.purpose.SHARE_WITH_AGENCY.title` | 상담사 소속 유학원과 프로필 공유 | 한귤 상담팀의 파트너 유학원과 프로필 공유 |
| `settings.privacy.purpose.SHARE_WITH_AGENCY.text` | 상담사가 서류와 에세이를 검토하려면 필요해요. | 한귤 상담팀이 서류와 에세이를 검토하려면 필요해요. |
| `settings.privacy.who.agency` | 상담사 소속 유학원: 배정된 이후에만 프로필, 서류, 에세이 | 한귤 상담팀의 파트너 유학원: 플랜 시작 이후에만 프로필, 서류, 에세이 |
| `more.hint.services` | 상담사·검토 플랜 | 플랜과 검토 |
| `documentsV2.group.reviewSub` | 담당 상담사가 보통 2영업일 안에 서류를 확인합니다. | 한귤 상담팀이 보통 2영업일 안에 서류를 확인합니다. |
| `visaV2.askCounselor` | 상담사에게 문의하기 | 한귤 상담팀에 문의하기 |
| `workspace.team` | 담당 상담사 | 한귤 상담팀 |
| `workspace.who.team` | 한귤·담당 상담사 | 한귤 상담팀 |
| `budget.note.insurance.DORM` | 유학생은 가입이 필수입니다. 현재 보험료는 담당 상담사가 확인해 드립니다. | 유학생은 가입이 필수입니다. 현재 보험료는 한귤 상담팀이 확인해 드립니다. |
| `budget.note.insurance.OFF_CAMPUS` | 유학생은 가입이 필수입니다. 현재 보험료는 담당 상담사가 확인해 드립니다. | 유학생은 가입이 필수입니다. 현재 보험료는 한귤 상담팀이 확인해 드립니다. |
| `servicesV3.subtitle` | 모든 과정을 무료로 직접 진행할 수 있습니다. 유료 플랜은 사람의 도움을 더합니다. 한귤 팀이 검토하거나, 파트너 유학원 상담사가 대학 선택부터 입국까지 함께합니다. | 모든 과정을 무료로 직접 진행할 수 있습니다. 유료 플랜은 사람의 도움을 더합니다. 한귤 상담팀이 검토하거나, 대학 선택부터 입국까지 함께합니다. |
| `servicesV3.who.counselor` | 담당 상담사 | 한귤 상담팀 |
| `servicesV3.promise.full` | 파트너 유학원 상담사가 처음부터 끝까지 안내 | 한귤 상담팀이 처음부터 끝까지 안내 |
| `ws3.counselorAt` | 담당: {{org}} | 한귤 상담팀 · {{org}} |
| `ws3.ready.counselor` | 담당 상담사 최종 확인 | 한귤 상담팀 최종 확인 |
| `ws3.ready.counselorOk` | 담당 상담사 최종 확인 완료 | 한귤 상담팀 최종 확인 완료 |
| `ws3.review.monitor` | 한귤과 담당 상담사가 입학처와 함께 진행 상황을 확인하고 있습니다. | 한귤 상담팀이 입학처와 함께 진행 상황을 확인하고 있습니다. |
| `ws3.offer.step2.text` | 대학과 담당 상담사에게 알려 드립니다. | 대학과 한귤 상담팀에 알려 드립니다. |
| `ws3.tuition.how` | 대학 합격 안내에 있는 납부 방법(보통 본인 명의 가상계좌)을 이용하세요. 영수증은 비자 신청에 필요하니 꼭 보관하세요. 담당 상담사와 함께 확인할 수 있습니다. | 대학 합격 안내에 있는 납부 방법(보통 본인 명의 가상계좌)을 이용하세요. 영수증은 비자 신청에 필요하니 꼭 보관하세요. 한귤 상담팀과 함께 확인할 수 있습니다. |
| `ws3.writingSub` | 자기소개서와 학업계획서입니다. 담당 상담사가 검토하며, 글은 온전히 학생의 것입니다. | 자기소개서와 학업계획서입니다. 한귤 상담팀이 검토하며, 글은 온전히 학생의 것입니다. |
| `ws3.messages.noneText` | 이 지원에 대한 상담사 메시지가 여기에 표시됩니다. | 이 지원에 대한 한귤 상담팀 메시지가 여기에 표시됩니다. |
| `offers.note` | 예상 총비용은 생활비를 포함하며 예산 계획과 같은 기준을 사용합니다. 합격을 거절하기 전에 담당 상담사와 상의하세요. | 예상 총비용은 생활비를 포함하며 예산 계획과 같은 기준을 사용합니다. 합격을 거절하기 전에 한귤 상담팀과 상의하세요. |
| `legalFlow.step.verify.why` | 상담사가 한 번 확인하면 모든 지원에 재사용됩니다. | 한귤 상담팀이 한 번 확인하면 모든 지원에 재사용됩니다. |
| `legalFlow.note.UNVERIFIED` | 이 국가의 인증 절차는 아직 확인되지 않았습니다. 담당 상담사가 확인해 드립니다. | 이 국가의 인증 절차는 아직 확인되지 않았습니다. 한귤 상담팀이 확인해 드립니다. |
| `housingV3.honest` | 한귤은 개인 임대 매물을 소개하지 않습니다. 계약 전 담당 상담사가 계약서를 함께 검토할 수 있습니다. | 한귤은 개인 임대 매물을 소개하지 않습니다. 계약 전 한귤 상담팀이 계약서를 함께 검토할 수 있습니다. |
| `writing.subtitle` | 자기소개서와 학업계획서입니다. 담당 상담사가 구성과 명확성에 대해 의견을 드리며, 생각과 문장은 온전히 학생의 것입니다. | 자기소개서와 학업계획서입니다. 한귤 상담팀이 구성과 명확성에 대해 의견을 드리며, 생각과 문장은 온전히 학생의 것입니다. |
| `writing.others` | 검토 중이거나 완료 | 한귤 상담팀 검토 중이거나 완료 |
| `writing.status.AGENCY_REVIEW` | 상담사 검토 중 | 한귤 상담팀 검토 중 |
| `writing.status.FINAL_REVIEW` | 상담사 검토 중 | 한귤 상담팀 검토 중 |
| `tasksV3.subtitle` | 지원을 진행시키는 모든 일입니다. 내가 할 일을 먼저, 상담사가 처리 중인 일은 그다음에 보여 드립니다. | 지원을 진행시키는 모든 일입니다. 내가 할 일을 먼저, 한귤 상담팀이 처리 중인 일은 그다음에 보여 드립니다. |
| `tasksV3.summary` | 내 할 일 {{mine}}개 · 상담사 담당 {{theirs}}개 | 내 할 일 {{mine}}개 · 한귤 상담팀 담당 {{theirs}}개 |
| `tasksV3.owner.counselor` | {{name}} (담당 상담사) | 한귤 상담팀 |
| `tasksV3.owner.team` | 담당 팀 | 한귤 상담팀 |
| `tasksV3.summaryMine_one` | 내 할 일 {{count}}개. 지금 상담사 쪽에서 처리 중인 일은 없습니다. | 내 할 일 {{count}}개. 지금 한귤 상담팀 쪽에서 처리 중인 일은 없습니다. |
| `tasksV3.summaryMine_other` | 내 할 일 {{count}}개. 지금 상담사 쪽에서 처리 중인 일은 없습니다. | 내 할 일 {{count}}개. 지금 한귤 상담팀 쪽에서 처리 중인 일은 없습니다. |
| `scholarshipsV3.note` | 금액은 제공 기관이 공개한 기준입니다. 확정하기 전에 담당 상담사가 최신 조건을 확인해 드립니다. | 금액은 제공 기관이 공개한 기준입니다. 확정하기 전에 한귤 상담팀이 최신 조건을 확인해 드립니다. |
| `supportV3.askText` | 대부분의 질문은 담당 상담사가 1영업일 안에 답합니다. 비자, 주거, 비용, 건강 문제는 놓치지 않도록 문의 티켓을 남길 수도 있습니다. | 대부분의 질문은 한귤 상담팀이 1영업일 안에 답합니다. 비자, 주거, 비용, 건강 문제는 놓치지 않도록 문의 티켓을 남길 수도 있습니다. |
| `supportV3.message` | 상담사에게 메시지 보내기 | 상담팀에 메시지 보내기 |
| `v4.review.late` | 평소보다 오래 걸리고 있어요 — 상담사에게 지연으로 표시되었어요. 다시 올릴 필요는 없어요. | 평소보다 오래 걸리고 있어요 — 한귤 상담팀에 지연으로 표시되었어요. 다시 올릴 필요는 없어요. |
| `v4.review.groupSub` | 상담사가 사용하기 전에 각 서류를 확인해요. | 한귤 상담팀이 사용하기 전에 각 서류를 확인해요. |
| `v4.ws.yourCounselor` | 담당 상담사 | 한귤 상담팀 |
| `v4.ws.who.team` | 한귤 & 담당 상담사 | 한귤 상담팀 |
| `v4.ws.empty.team` | 상담사가 처리할 항목이 없어요. | 한귤 상담팀이 처리할 항목이 없어요. |
| `v4.ws.helpText` | {{name}}님이 이 지원서의 담당 상담사예요. | 한귤 상담팀이 이 지원서를 함께 진행하고 있어요. |
| `v4.ws.helpTextNoName` | 상담사 팀이 이 지원서를 도와드려요. | 한귤 상담팀이 이 지원서를 도와드려요. |
| `v4.ws.message` | {{name}}님에게 메시지 | 상담팀에 메시지 |
| `v4.ws.messageTeam` | 상담사에게 메시지 | 상담팀에 메시지 |
| `v4.essay.role.counselor` | 담당 상담사 | 한귤 상담팀 |
| `v4.docs.essayWrite` | 글쓰기에서 작성해요 — {{university}}에 보내기 전에 상담사가 읽어요. | 글쓰기에서 작성해요 — {{university}}에 보내기 전에 한귤 상담팀이 읽어요. |
| `v4.docs.essayReading` | 상담사가 초안을 읽고 있어요 — 지금 올릴 것은 없어요. | 한귤 상담팀이 초안을 읽고 있어요 — 지금 올릴 것은 없어요. |
| `v8.budget.fee.text.DUE` | {{name}} — 상담사 배정 전에 한귤에 결제해야 합니다. 대학에 내는 비용과는 별개입니다. | {{name}} — 한귤 상담팀이 시작하기 전에 한귤에 결제해야 합니다. 대학에 내는 비용과는 별개입니다. |
| `v8.budget.fee.text.NONE` | 선택 사항입니다. 무료 플랜으로 직접 지원할 수 있으며, 유료 플랜에는 상담사와 검토가 포함됩니다. | 선택 사항입니다. 무료 플랜으로 직접 지원할 수 있으며, 유료 플랜에는 한귤 상담팀의 지원과 검토가 포함됩니다. |
| `v9.money.note.VISA_FEE_UNKNOWN` | 해당 경로의 수수료가 아직 공개되지 않았어요 — 담당 상담사가 확인합니다. | 해당 경로의 수수료가 아직 공개되지 않았어요 — 한귤 상담팀이 확인합니다. |
| `v9.money.note.VISA_FEE_NO_ROUTE` | 해당 대사관을 아직 확인하지 않았어요 — 담당 상담사가 확인합니다. | 해당 대사관을 아직 확인하지 않았어요 — 한귤 상담팀이 확인합니다. |
| `v9.funds.kind.NOT_STATED` | 대사관이 최소 금액을 밝히지 않았어요 — 1년 등록금과 생활비를 기준으로 준비하고, 담당 상담사가 확인합니다. | 대사관이 최소 금액을 밝히지 않았어요 — 1년 등록금과 생활비를 기준으로 준비하고, 한귤 상담팀이 확인합니다. |
| `v9.funds.whose.UNKNOWN` | 명의: 담당 상담사가 대사관에 확인합니다 | 명의: 한귤 상담팀이 대사관에 확인합니다 |
| `v9.funds.waived` | 대학이 최상위('우수') 등급이라 대사관이 요구하지 않을 수 있어요 — 담당 상담사가 확인합니다. | 대학이 최상위('우수') 등급이라 대사관이 요구하지 않을 수 있어요 — 한귤 상담팀이 확인합니다. |
| `v9.funds.status.NO_ROUTE` | 해당 대사관의 재정 기준을 아직 확인하지 않았어요 — 담당 상담사가 확인합니다. | 해당 대사관의 재정 기준을 아직 확인하지 않았어요 — 한귤 상담팀이 확인합니다. |
| `v9.family.never` | 절대 보이지 않는 것: 메시지, 에세이, 상담사 메모, 서류 파일. | 절대 보이지 않는 것: 메시지, 에세이, 한귤 상담팀 메모, 서류 파일. |
| `v9.refund.ruleUnknown` | 담당 상담사가 대학의 환불 규정과 금액을 함께 확인합니다. | 한귤 상담팀이 대학의 환불 규정과 금액을 함께 확인합니다. |
| `v9.refund.cta` | 상담사에게 메시지 보내기 | 상담팀에 메시지 보내기 |
| `v9.visa.caveat.TB_POST_CONFLICT` | 알마티 총영사관과 대사관의 결핵 검사 안내가 다릅니다 — 알마티에서 어떤 검사를 인정하는지 담당 상담사가 확인합니다. | 알마티 총영사관과 대사관의 결핵 검사 안내가 다릅니다 — 알마티에서 어떤 검사를 인정하는지 한귤 상담팀이 확인합니다. |
| `v17.gate.what.messages` | 상담사 상담 | 한귤 상담팀과의 상담 |
