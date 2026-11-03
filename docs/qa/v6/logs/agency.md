# V6 — Agency console + Hangyul operations (workstream log)

Screens: before `docs/qa/v6/agency/before/`, after `docs/qa/v6/agency/after/` (1440 and 390, full page; file = `<persona>_<route>-<width>.png`).
Capture: `OUT=<dir> node scripts/qa/v6-agency-shots.mjs <email> 1440,390 <routes…>` (demo-login, one Chromium).

## Hangyul operations overview (/hq) — new
- API `GET /api/v1/agency/hq/overview` (`server/app/api/v1/hq_ops.py`, registered in `app/main.py`). Hangyul roles only; agency/university/student → 404 (access.forbidden), anonymous → 401.
- Reuses the existing rules: caseload.REVIEW_DOCS/REVIEW_SLA_HOURS (documents), writing.today_items (essay SLA, swept), assignment first-response SLA, collab.team_task_scope (tasks), concierge.in_view/is_overdue (services), READY applications (submissions waiting on agency), caseload.pred_university_requested (university requests), open FreshnessReview by reason × kind.
- UI `pages/hq/Operations.tsx`: navy "Hangyul operations" context line; one risk board (response times · services · universities · data freshness) with linked counts; agencies table sorted most-at-risk first (SLA breakdown under the name); services by type; source freshness by risk → `/hq/sources?reason=…&kind=…`. Numbers without an exact list (per-agency SLA breaches, overdue tasks, ready to submit) are not links.
- `/students?agency=<id>` (Hangyul): new `agency_id` filter on `/agency/students` and `/agency/students/views` + agency select in the filter bar. Tenant scope still applies (another agency's id → 0 rows).
- Tests: `server/tests/test_v6_hq_ops.py` (tenant isolation; shape/order; counts equal the linked lists; per-agency filter).

## /hq/sources — recomposed
- Review queue grouped by risk (Conflict → Changed → Review due), then by kind (source type or record type), oldest first; no pill per row; count toggles filter by risk; URL filters `reason`, `kind`, `resolved=1`. Registry status = quiet status text. Removed the stray "Note" footnote (it printed a field label). API: freshness review items now carry `source_type` (additive, admin.py).

## Agency screens
- Today: denser queue rows (18px counts, red only for breaches), j/k walk the queue + Enter opens, key hint; fixed service-case detail showing "— —" (API sends `student.full_name`).
- Students: next action no longer shows raw `AIRPORT_PICKUP: Huy` (taskTitle translates concierge types; vitest added).
- Selection/active states moved from black to cobalt (document queue, inbox, candidates, verify checkboxes, quick reasons, today's date, unread notifications).
- Providers: column header row, compact kind filter, footnote rewritten (no "demo providers are always labelled").
- Per-row development labels removed: "Sample" on service cases (list + drawer), "(Demo provider)" in the vendor picker, "Demo provider" status on Providers, "Partner (demo)" on university detail, "Sample data" chip on success items, per-row "Demo" on Payments (page callout kept: no real money moves), "Includes demo data" (outcome foot) and "Demo payments" caption on Performance.
- Not changed (judged fine / owned elsewhere): Writing pages, Submissions, seed names "(Demo)"/"(sample)" (seed workstream).
