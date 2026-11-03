# V5 — visaroute (visa concierge) workstream log

Date 2026-09-29. Doc: `docs/VISA_ROUTES.md` §8 Implementation (research sections untouched).
Migration **`f5e1a2b3c454`** (down_revision `f5d055e1a001`), applied to dev DB, single head.

## Changes (file — what — why)
Backend
- `server/app/models/v5_visa_routes.py` — VisaRoute, VisaRouteDocument (versioned researched playbooks), VisaRouteAnswer (one jurisdiction answer + sponsor), VisaCaseTrack (form, linked docs, appointment, hand-off, submission evidence, decision, visa doc, pack review, support case), VisaEmbassyRequest.
- `server/app/models/catalog.py` (small edit) — `University.visa_certification` (EXCELLENT|CERTIFIED|GENERAL|UNKNOWN) + `visa_certification_verified_at`.
- `server/app/services/visa_routes.py` (new) — loader, resolver (route/post/method/documents with dossier reuse status/timing/caveats/steps), prefilled preparation form, tracking with evidence, embassy request → task + VISA_SUPPORT case, refusal escalation, help block, `home_step`, `today_items`, legacy bridge `route_view`. Registers VISA_SUPPORT status table via `concierge.register_case_type` (OPEN/IN_PROGRESS/WAITING_STUDENT/WAITING_EMBASSY/RESOLVED/CANCELLED — kept "OPEN" as entry so the concierge test + existing help cases stay valid).
- `server/app/api/v1/visa_routes.py` — student `/me/visa-route…`, staff `/visa-route/students/{id}…`, `/agency/visa-today`, Hangyul-only tier endpoint.
- `server/app/services/visa.py` — `visa_checklist(..., use_routes=True)` returns the route checklist when a route resolves (engine visa task, mobile).
- `server/app/api/v1/collab.py` (visa section only) — `ser_visa` uses the route checklist + adds `route` summary.
- `server/app/seed/extra_54_visa.py` — loads 41 playbooks (research status as-is), tiers UNKNOWN, Myanmar persona (parents sponsor, planned embassy date +25 d → bank certificate "new one required"), new FLOW E persona **student.visaroute@demo.hangyul.kr** (Enkhjin Batbayar, MN, Kyungpook BBA — non-partner university so extra_40 quotas stay consistent; TB certificate + criminal record missing). Applied additively to the dev DB (together with extra_15 personas, which were missing there).
- Tests: `server/tests/test_v5_visa.py` (22), `server/tests/test_v5_visa_flow.py` (3).

Frontend
- `apps/student-web/src/pages/Visa.tsx` (rewritten) + `src/visaroute.css` + `src/lib/visaroute.ts` (+ `visaroute.test.ts`, 5 vitest): rail Admission → Admission documents → Visa documents → Visa application → Decision; one-line route (post · method) with "Why this route?" (why, method note, fee as embassy fee, sources + dates, exact English wording in a nested disclosure); "What needs you now" (name, why, status, who provides, timing, source + verified date, action); caveats; documents grouped Needs you / Waiting for others / Ready (reused, folded) / Only in some cases / Not needed; proof of money (amounts verbatim, never-borrow warning); preparation form (student confirms each section; only the first unconfirmed button is tangerine); apply & track (date, official hand-off, submission with evidence, embassy requests, decision, visa upload); steps rail; help (what/needed/who/when/source/counselor + ask a person). `visaTimeline` export kept for components.test.
- `apps/student-web/src/components/ConciergeBits.tsx` (1-line edit) — VISA_SUPPORT status label from `visaroute:support.status.*` (Help page).
- `apps/agency-web/src/components/VisaRoutePanel.tsx` (new) — route, post, method, tier, status, pack (missing list), appointment, submission, decision, caveats, embassy requests; "Mark pack reviewed", "Record embassy request".
- `apps/agency-web/src/components/ServiceCases.tsx` (small edits) — VISA_SUPPORT status labels from visaroute; VisaRoutePanel in the case drawer.
- `apps/agency-web/src/pages/StudentWorkspace.tsx` (small edit) — VisaRoutePanel at the top of the Visa tab.
- `apps/student-mobile/app/visa.tsx` (small edits) — route line (post · method), translated route document names + status, toggles only for university paper.
- `packages/types` (append + optional fields on VisaChecklistItem/VisaCase), `packages/api-client` (`api.visaRoute.*`).
- i18n `visaroute` en/ko (538 keys) + my machine draft for every student-facing key (staff.*/today.* en/ko only). Generator: `docs/qa/v5/visaroute/i18n_visaroute.gen.py`.

E2E (written, not run): `e2e/v5-visa.spec.ts` (FLOW E, needs fresh seed), `e2e/v5-myanmar.spec.ts` (FLOW C with `latinLeaks()` helper; visa screen hard assertion, other screens soft).

## Hook functions (coordinator)
- `app.services.visa_routes.home_step(db, student_user_id) -> dict | None` — None before a visa case exists or once ISSUED (concierge takes over). Else `{key, title_key: "visaroute:home.<key>", params, who, link: "/visa", status_key: "visaroute:status.<PREPARING|READY|SUBMITTED|EMBASSY_REQUEST|APPROVED|ISSUED|NEEDS_ATTENTION>"}`. keys: choose_post, document, form, waiting, get_later, book, go_to_appointment, university_files_evisa, wait_decision, embassy_request, upload_visa, refused, counselor_confirms (params may hold `date` ISO → format it).
- `app.services.visa_routes.today_items(db, principal) -> list[dict]` — agency/Hangyul only: `{kind: "visa", case_id, reason: "appointment_soon"|"request_due"|"pack_ready", title_key: "visaroute:today.<reason>", params: {student, date?}, student: {id, full_name}, due_at, overdue, link: "/students/<id>?tab=visa"}`; sorted overdue first; max 50. Preview: `GET /agency/visa-today`.
- Wanted in `common.json` (coordinator-owned): `task.visa.<route doc key>` for route-based engine visa tasks and `task.visaroute.embassyRequest` — proposal en/ko/my in `docs/qa/v5/visaroute/common-task-keys.json` (merge only MISSING keys; existing task.visa.passport etc. stay). Until then the engine task shows a clean English name (e.g. "TB certificate").

## Tests run
- `pytest tests/` full suite (under lock): all passed (incl. 25 visa tests). ruff: clean.
- vitest `src/lib/visaroute.test.ts`: 5 passed. typecheck student-web, agency-web, student-mobile: clean.

## Screenshots (docs/qa/v5/visaroute/)
mm/my_visa-390 (Burmese), mm/stu_visa-390 (English, before fixes), mn/en_visa-1440 + 390, agency/ workspace Visa tab 1440. Fixes after looking: "get it after" only while that date is ahead (else "any copy issued from today is valid on …"), duplicate "Not added yet" reason hidden, "Not needed" toggle styled as a quiet toggle, only one tangerine confirm button, "Why this route?" styled as a link.

## FLOW C leak scan (Burmese, 390, `docs/qa/v5/visaroute/shot.mjs`)
- /visa: only proper names (student name, university, programme) and D-2-2 → clean.
- / (home): "TB diagnosis certificate from an embassy-designated hospital original" = engine visa task title (fixed to a clean name; needs the common `task.visa.*` keys above to be Burmese); counselor/agency names (proper names) and "Demo" label → coordinator.
- /applications: university/programme names only (allowed). /documents: "PDF" → dossier workstream.
- Locale note for coordinator: the user's stored `locale` ("my") is not applied at login; the web app reads `localStorage['hg.locale']`. FLOW C spec sets it explicitly.

## Could not do / limitations
- University visa tiers are UNKNOWN (not verified) → the e-visa is never offered in the demo (tested with a temporary tier).
- Conditions not evaluable from data stay "maybe — counselor confirms". Research wording stays English inside disclosures.
- Upload in FLOW E is done through the API + link (the upload modal is exercised by the dossier spec); E2E not run (coordinator).
- No reminder cadence beyond the task due date; no embassy system integration (manual hand-off by design).
