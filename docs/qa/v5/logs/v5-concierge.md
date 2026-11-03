# V5 — concierge workstream log

Owner: concierge. Date: 2026-09-29. Scope: post-admission services (service cases, vendors, pickup + flight, housing, arrival journey, help, service quality).

## Backend
- **Migration `e5c0c1e2a7b1`** (down_revision `d5a1c0e55ccd`; single head after upgrade). New tables `vendors`, `service_cases`, `service_case_events`, `housing_listings`, `university_arrival_info`; new columns `dormitories.{application_opens, application_closes, eligibility, meal_required, move_in_date, deposit_krw, required_documents, location}`, `housing_cases.{profile, move_in}`, `arrival_plans.flight_info`.
- `server/app/models/v5_concierge.py` — the five models (exported via `__all__`). Small additive edits to `models/catalog.py` (Dormitory) and `models/lifecycle.py` (HousingCase, ArrivalPlan) — sanctioned by the brief.
- `server/app/services/concierge.py` — state tables per type + `register_case_type()` for the visa workstream, case lifecycle + tasks, vendor labels, flight provider stub, arrival rule (`mark_arrived`/`on_arrival`), housing view, lease flags, help routing, research-file loader (arrival-official.json → post-arrival-official.json → Source row → NEEDS_REVIEW), journey, `home_stage`, `today_items`, `concierge_metrics`.
- `server/app/api/v1/concierge.py` — student + agency endpoints (see docs/ARRIVAL_SERVICES.md → Implementation). Note: the brief's `GET /me/services` already exists (V2 service catalogue), so the student list is **`GET /me/service-cases`**.
- `server/app/api/v1/student.py` — edited in place only: `GET /me/housing` (adds concierge housing view + full dorm facts), `PUT /me/arrival` (arrival goes through `mark_arrived()` → residence-card case/task; legacy `pickup_requested` boolean no longer written). Dashboard untouched.
- Seed `server/app/seed/extra_53_concierge.py` — DEMO vendors (no agreements), 2 DEMO listings (SKKU), SAMPLE dorm facts, Bảo's DORMITORY case (APPLIED), new personas `student.arrival@demo.hangyul.kr` (Phạm Gia Huy, Sogang Spring 2027, visa ISSUED, dorm CONFIRMED, flight VN408 20 Feb 2027, pickup REQUESTED) and `student.arrived@demo.hangyul.kr` (Lê Thảo Vy, Korea University Fall 2026, arrived 24 Aug 2026, pickup COMPLETED with proof + feedback, dorm MOVED_IN, enrolled, residence card PREPARING due 22 Nov 2026). Non-partner universities on purpose so partnership quotas (extra_40) stay consistent. Also applied once to the running dev DB (additive) for screenshots; `db:reset` reproduces it.

## Frontend
- Student (`apps/student-web`): `pages/Arrival.tsx` (rewritten: "Your first weeks in Korea"), `pages/Housing.tsx` (rewritten), new `pages/Help.tsx` ("Need help in Korea?"), new `components/ConciergeBits.tsx`, `lib/concierge.ts` (+ `concierge.test.ts`), `concierge.css`. Small edits: `router.tsx` (+`/help`), `components/AppLayout.tsx` (+More link "Need help in Korea?").
- Agency (`apps/agency-web`): new `pages/Services.tsx`, `pages/Vendors.tsx`, `components/ServiceCases.tsx`, `concierge.css`. Small edits: `router.tsx` (+`/services`, `/vendors`), `components/AppLayout.tsx` (Work → Services, Organization → Providers), `pages/StudentWorkspace.tsx` (+"Services" tab).
- Shared (append-only): `packages/types` (concierge types), `packages/api-client` (`api.concierge.*`), `packages/auth` DEMO_ACCOUNTS (+2 personas).
- i18n `concierge` namespace: en + ko complete (~700 keys); `my` machine draft for student-facing keys (needs coordinator verification).

## Hook functions (coordinator)
- `app.services.concierge.home_stage(db, student_user_id) -> dict | None` — `{stage: ADMITTED|READY_TO_COME|ARRIVED|SETTLED, title_key: "concierge:home.<stage>", next: {key, link, title_key: "concierge:step.<key>.title"} | None, done, total, residence_card_due}`; None before admission. ADMITTED returns `next=None` once housing is under way (visa stays the main track).
- `app.services.concierge.today_items(db, principal) -> list[dict]` — `{kind: "service_case", case_id, type, status, reason (overdue|urgent|flight_delayed|reconfirm|pickup_soon|needs_assignment), title_key: "concierge:today.<reason>", params {type, student}, student, due_at, overdue, priority, link: "/services?case=<id>"}`; preview at `GET /agency/service-today`.
- `app.services.concierge.concierge_metrics(db, org_id | None, start, end) -> dict` (definitions + n<5 withholding); `GET /agency/service-metrics?days=`.
- `app.services.concierge.register_case_type(case_type, table, initial, sla_hours=)` — for the visa workstream's VISA_SUPPORT statuses; `create_case(...)`, `transition(...)` for creating/moving cases.
- **common.json keys wanted** (not added — common is coordinator-owned). Task titles use `title_key`:
  - `task.concierge.handle` "{{type}}: {{student}}" (params type=case type enum, student) · `task.concierge.reconfirm` "Flight changed — re-confirm pickup: {{student}}"
  - `task.concierge.DORMITORY.PLANNING` "Apply for your dormitory" · `task.concierge.DORMITORY.ASSIGNED` "Confirm your dormitory room and pay the deposit" · `task.concierge.HOUSING_SEARCH.DEPOSIT` "Pay the housing deposit and upload the receipt" · `task.concierge.RESIDENCE_CARD.PREPARING` "Apply for your residence card" · `task.concierge.RESIDENCE_CARD.APPOINTMENT_BOOKED` "Go to your residence card appointment" · `task.concierge.RESIDENCE_CARD.READY` "Collect your residence card" · `task.concierge.AIRPORT_PICKUP.DRIVER_WAITING` "Your driver is waiting at the airport"
  - notification `notify.serviceCase` (params type, status) — fallback English "<Service>: status updated".

## Tests run
- `pytest tests/` (full, under lock): **169 passed** (includes 18 new in `tests/test_v5_concierge.py`).
- `vitest src/lib/concierge.test.ts`: 4 passed. `npm run typecheck` student-web + agency-web: clean.
- `ruff check .`: my files clean (2 pre-existing errors in the writing workstream's files).
- E2E `e2e/v5-arrival.spec.ts` (FLOW F) written, not run (coordinator runs it; needs a fresh seed — arrival is recorded once; the spec skips if the persona already arrived).

## Screenshots
`docs/qa/v5/concierge/` — arrival persona /arrival + /housing (390, 1440), arrived persona /arrival + /help, agency /services (completed view + case drawer), /vendors. Fixes after looking: step state label wrapping, demo dorm source labelled "Sample data (not verified)" instead of "Official source", non-urgent student buttons secondary, first queue view now also shows fresh requests that already have a default owner.

## Could not do / limitations
- No live flight/listing/SIM/bank/HiKorea integrations (interfaces + manual fallbacks only, by design).
- Official research text is shown in English (source wording); not localised.
- Task titles fall back to English until the common.json keys above are added.
- Native mobile Help entry not built ("mobile later").
- No reminder cadence for the residence-card deadline beyond the task due date.
