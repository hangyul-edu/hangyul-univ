# V9 agency + Hangyul operations workstream log

Scope: REPORT §59 (A1–A12) and §61 (H1–H3). Rules: docs/qa/v9/WORKSTREAM_RULES.md. Started 2026-10-10.

## Re-verification of §55 before changing anything (2026-10-10)

- §55 #8 confirmed in code: `caseload.build_rows` returned `next_task` = earliest open task of any kind, so a row waiting on "us"
  could show a student-side task ("Apply for your residence card"). `waiting_on` values were `us/student/university/external`.
- §55 #9 confirmed: Today rendered `NowList` (ranked) **and** `Attention` (eleven category counts) + a waiting summary.
- §55 #10 confirmed: `/agency/team` returned name/role/title/languages/active; ops `load` = agency capacity ÷ holders.
- §55 #11 confirmed: `message_templates` has no group key; templates API only permits PERSONAL/TEAM/ORG by role of owner.
- §55 #12 confirmed: `submission.agency_queue` only lists AUTHORIZED_AGENCY connectors; dev DB has 0 HANDED_OFF records.
- §55 #23 confirmed: `/admin/readiness` statuses are ACTIVE/DEVELOPMENT_ONLY/NEEDS_AGREEMENT/NOT_CONFIGURED only.

## Changes

### Backend (server)

| Item | Why | Files / API | Test |
|---|---|---|---|
| A1 waiting model | §55 #8, §59.1 "Us hides who" | NEW `services/waiting.py` (7 parties, 25 reason codes, ordered SQL rules; `pred`, `evaluate`, `application_waiting`, `next_action`, `owner`); `caseload.py` rows now carry `waiting_on` (new values), `waiting_reason`, `waiting_owner`, `next_action`, `waiting_on_legacy`; views `waiting_counselor/agency/hangyul`; `waiting_on=` accepts the 7 parties + legacy `us`; `/agency/today.waiting_on` has all 7 (+`us`); workspace + `/agency/applications/remaining` give per-application party + reason (submission records, authorisations) | `test_waiting_parties_counts_equal_rows`, `test_next_action_is_the_waiting_partys_action`, `test_application_waiting_uses_the_same_vocabulary`, `test_handed_off_waits_on_student_and_unconfirmed_on_external` |
| A2 one queue | §55 #9 | `priority.py`: 11 new reasons (submission issue / confirmation missing / authorised submit / ready / final review, visa overdue/action, service late/action, essay due, document check), `WORK_TYPES` + `TYPE_OF`, `ranked(work_type=)` → `by_type`, per row `types`, `owner`, `deadline`; `GET /agency/today/queue?type=` | `test_today_queue_types_filter_the_same_list`, `test_every_reason_has_a_type_tier_and_action` |
| A3 header | §59 A3 | `/agency/students/{id}/movement` adds `owner`, `next_action`, `deadline`, `counselor`, `agency_identity` | `test_workspace_header_answers_the_five_questions` |
| A4 team | §55 #10 | migration `v9a1agencyops` (member countries/university_ids/degrees/majors/capacity_points/on_leave_until/leave_note/left_at/left_reason; org load_weights); `agency_ops.member_loads` (weighted load, capacity, SLA risk); `GET /agency/team` (+weights, load); `PATCH /agency/team/members/{id}`, `PUT /agency/team/weights`, `GET …/open-items`, `POST …/deactivate` (moves students/reviews/essays/tasks/services, audited per item), `POST …/reactivate`; `assignment.pick_counselor` uses availability + weighted load + expertise fit | `test_team_*`, `test_member_leaves_*`, `test_assignment_engine_skips_people_on_leave` |
| A5 templates | §55 #11 | kinds + PAYMENT/ARRIVAL/HOUSING; TEAM creatable by any staff (edit: author or managers), ORG only owners/managers; `group_key` language variants, one per locale (409 on duplicates); `can_publish_org` | `test_template_kinds_variants_and_scopes`; **changed on purpose**: `test_v3_agency.test_templates_scopes_and_permissions` (counselor TEAM now 201, ORG 403) |
| A6 providers | §55 #27 | `GET /agency/providers` (agreement status first: ACTIVE/INACTIVE/NONE, service types, open/late cases, last issue) | `test_providers_agreement_first_and_never_partner_without_one` |
| A7 submissions | §55 #12 | `submission.submission_pipeline` (new function; `agency_queue` untouched): issue · confirmation_missing (>2 days) · authorized · ready · needs_final_review · submitted · received across every method; `GET /agency/submissions/pipeline?state=` | `test_submissions_pipeline_states_counts_and_tenancy` |
| A8 meetings | §55 #13 | appointments `decisions`, `follow_up_task_ids`, `next_appointment_id`, `closed_at/by`; close endpoint accepts decisions + follow-ups (staff or student-side) + next meeting; `POST/GET /agency/students/{id}/meetings` | `test_meeting_record_is_one_record_on_the_timeline` |
| A9 manager | §55 #14 | `/agency/ops` adds `questions` (six), `blocked` (waits on someone, not moved > 14 days), `unassigned_paid`; `load` = weighted | `test_manager_questions_at_the_top` |
| A10 quality | §55 #15 | `agency_performance.process_quality` (12 metrics, cohort, num/den/n, n<5 withheld, drill-down); `GET /agency/quality` | `test_process_quality_has_cohorts_and_withholds_small_n` |
| A11 messages | §55 #16 | `channels.delivery_states` (SENT/READ from MessageRead; FAILED only from a provider); Zalo registered (not connected); `GET /agency/conversations/{id}/delivery`, `PATCH …/application` | `test_message_delivery_and_thread_link`; **changed on purpose**: `test_v8_channels` registry now includes ZALO |
| A12 identity | §56.1 MOJ draft | org `legal_name`, `registration_status` (NOT_RECORDED default; seed `license_number` placeholders never count), `registration_number/authority/checked_on`; assignment `sub_agent_name`; `agency_ops.agency_identity(db, student_id, application=None)` helper; `GET/PATCH /agency/identity` (owner; self-recorded = RECORDED, only Hangyul could make VERIFIED), `PATCH /agency/students/{id}/sub-agent`; workspace + movement payloads | `test_identity_owner_records_registration_and_sub_agent` |
| H1 failures | §55 #23 | `/agency/hq/overview.failures` adds application_blocked, submission_issue, confirmation_missing, arrival_failed, integrations; every failure has `items` (≤20 exact records) | `test_hq_failures_carry_exact_records` |
| H2 partner quality | §55 #23 | `GET /agency/hq/agencies/quality` (8 process metrics per agency, listed by name, no admission rates) | `test_partner_quality_is_process_only` |
| H3 readiness | §55 #23 | `GET /agency/hq/readiness` classifies integrations (from `readiness.integrations`) + 14 launch items into the seven categories from real settings/records | `test_launch_readiness_is_classified_from_real_settings` |

Other tests changed on purpose: `test_v4_agency` (WAITING tuple → 7 parties; `us` asserted as counselor+agency), `test_v3_agency` (row waiting values), `test_v8_agency_ops` (movement waiting values).

Migration: `server/alembic/versions/v9_agency_ops.py` revision **v9a1agencyops** (down: v9s1sponsor01), applied to the dev DB.
Seed: `server/app/seed/extra_90_agency_v9.py` + live script `server/scripts/v9_agency_data.py` (run twice: idempotent). Also corrects 한결 → 한귤 in Korean template text.

### Frontend (apps/agency-web) — each page carries its PRIMARY QUESTION comment

| Item | Page / component | What changed |
|---|---|---|
| A1 | `components/bits.tsx` (`useWaitingText`, `WaitingOn`, `WAITING_PARTIES`), Students, Applications, workspace | Seven parties + reasons; Students "Next action" = `next_action` in the waiting party's voice (§55 #8); filter has the 7 parties + legacy `us`; views `waiting_counselor/agency/hangyul` under More views; zero-count view tabs hidden (still in More views); Applications get a "Waiting on" column from `/agency/applications/remaining` |
| A2 | `pages/Dashboard.tsx` (rewritten) | One ranked list + work-type chips (zero chips hidden, URL `?type=`), rows = reason · action · deadline · owner, ordering rule behind "How is this ordered?"; the V5–V8 category-count block (`Attention`) and the order card are gone; right column: Waiting on (non-empty parties → views) + next 14 days. Top 10 rows visible at 1440×900 |
| A3 | `components/Movement.tsx` `CaseStrip` | Workspace header strip before the tabs: why not moving · next action · waiting on · deadline · owner; duplicate lead line removed from the reasons card |
| A4 | `pages/Team.tsx` (rebuilt) | People list with availability, expertise, weighted load vs capacity (+ breakdown), SLA risk; edit person modal; editable weight table; "Member leaves" modal (open items per kind → engine / colleague / team queue, reason, audited); reactivate |
| A5 | `pages/Templates.tsx`, `lib/templates.ts` (+ `templates.test.ts`), MessageThread, DocumentReviewPanel | One card per template with language pills, "Add a language", scopes Personal/Team/(Org for managers); inserting picks the student's language (thread: `student_locale` from the delivery endpoint; document review: nationality → language) |
| A6 | `pages/Vendors.tsx`, `pages/Services.tsx` | Agreement status first column ("No agreement recorded"), service types, open, late, last issue; Services opens on the first non-empty view (overdue first) |
| A7 | `pages/Submissions.tsx` (rewritten), AppLayout | Seven-state queue across all methods, first non-empty state opens, definition line, authorised rows open the V6 detail, others the application; nav item renamed "Submissions", badge = issue + confirmation missing + authorised |
| A8 | `components/Meetings.tsx`, workspace | "Record a meeting" (header ⋯ menu) and "Record outcome" on past scheduled meetings; meeting records on Overview and History |
| A9 | `pages/Operations.tsx` | Six-question strip at the top, Blocked cases and Unassigned paid cases cards, Load card in weighted points |
| A10 | `components/ProcessQuality.tsx`, Performance tab "Process quality" | Metric rows with definition, cohort, num/den or n, withheld < 5, records drill-down |
| A11 | `components/MessageThread.tsx` | Sent/Read per outbound message, "Link to an application" in the thread header, Zalo listed (not connected) |
| A12 | `components/AgencyIdentity.tsx` | "Responsible agency" card on the workspace: legal/trading name, registration (Not recorded), counselor, sub-agent (editable) |
| H1 | `pages/hq/Operations.tsx` | New failure codes; every row expands to its exact records |
| H2 | `pages/hq/Agencies.tsx` | Partner quality section (8 process metrics per agency, by name, no admission rates) |
| H3 | `pages/hq/Readiness.tsx` (rewritten) | Seven launch categories, blocking first, legend |

i18n: 430 keys under `agency.v9` (en + ko together), source `scripts/i18n/v9-agency.py` (re-runnable merge; asserts en/ko key parity); plus `templatesPage.kinds.{PAYMENT,ARRIVAL,HOUSING}` and `v8.channel.ZALO`.
Shared files touched (small, additive): `packages/types` (V9 waiting/identity types, `group_key`, new view keys), `packages/utils` (`applicationWaitingOn(status, ctx?)`, `WAITING_PARTIES`, `WAITING_ALIASES`, `normalizeWaiting`, `waitingMatches`; status-only answers unchanged), models (`identity.py`, `workflow.py`, `ops.py`, `student.py`).
STATE_MAP: "Waiting on" bullet and the "Waiting vocabulary across products" table rewritten for the seven parties.

### Verification

- pytest: `tests/test_v9_agency.py` 23 passed; agency/HQ/channels/submission/concierge/security/seed suites 125 passed; full suite (without v9 file) passed, 0 failures.
- vitest agency-web 47 passed (new: `templates.test.ts` 4, `waiting.test.ts` 4). `tsc --noEmit` agency-web clean.
- Screenshots (looked at): `docs/qa/v9/agency/` — today (manager/counselor 390/1024/1440), workspace, students, applications, team, templates, providers, services, submissions, operations, quality, messages, hq, hq-agencies, hq-readiness. Fixed during review: Today rows too tall (truncate to one reason line + "+n"), Team column alignment, Services crash on first load (`isPending`), services waiting/owner overlap, missing Zalo label, delivery text contrast in own bubbles, identity card title wrap.

### Not done / known gaps

- `apps/agency-mobile` still reads `waiting_on` with `v3.agency.waitingOn.<value>` (mobile namespace, not mine): new values `counselor/agency/hangyul` have no mobile keys → coordinator: switch the mobile list to `waiting_on_legacy` or add the keys.
- The Tasks "Meetings" close modal still sends notes + one follow-up only (endpoint accepts the full record; the rich form is in the workspace).
- No seeded failed submission ("Issue" = 0) — only the authorised fixture could carry one, and turning it into a failure would remove the only "Authorized" example.
- 1024 icon-rail (§55 #17) is a shell (packages/ui) issue — not changed here.
- University display of `agency_identity` belongs to the university workstream (helper `services/agency_ops.agency_identity(db, student_id, application=None)`; already used there per coordinator).
