# V26 — Mobile parity matrix

Web = the four React apps; native = the three Expo apps (`apps/student-mobile`, `apps/agency-mobile`,
`apps/university-mobile`). "Intentional difference" means the phone deliberately does less or does it differently;
"actual gap" means the phone should have it and does not. Every row was checked against the code on 2026-10-27/28 and, for
the Android builds, on the emulator smoke (§346/§349).

| Workflow | Web | Student native | Agency native | University native | Intentional difference | Actual gap |
|---|---|---|---|---|---|---|
| Sign in / test sign-in (non-production) | ✓ | ✓ | ✓ | ✓ | — | — |
| Four-step verified sign-up | ✓ | ✓ (V22) | n/a | n/a | staff accounts are invited, never self-registered | — |
| Discover universities / programmes | ✓ photo-first directory + Explore | ✓ discovery, detail with campus photo | n/a | n/a | native has no region map | — |
| Explore grouped by university, fit facts first | ✓ (V26) | partial: list by match group | n/a | n/a | — | **gap**: native Explore still lists programmes one per row; grouping is web-only in V26 |
| Home: one next action with campus photo | ✓ | ✓ (V25) | n/a | n/a | — | — |
| Application command centre (stage, next, lanes, latest change) | ✓ (+ 최근 변경 V26) | ✓ stage, next action, lanes | n/a | n/a | — | **gap**: "최근 변경" line not on native application screen |
| Documents: requirement rows, reuse first, exact-requirement links | ✓ | ✓ upload, rows | n/a | n/a | — | task → requirement deep link lands on the Documents screen, not the row (native has no `?focus`) |
| Essay review | ✓ full editor | read + comments, no editing (V18 decision) | ✓ review | n/a | editing is web-only by design | — |
| Services: plan "now" view | ✓ (V26) | plan summary + checkout hand-off to web | n/a | n/a | checkout is web-only (Toss) | **gap**: the V26 "지금 진행 중" lines are web-only |
| Messages with team identity (한귤 유니브 상담팀) | ✓ | ✓ | ✓ real actors | ✓ | — | — |
| Notifications open the exact record | ✓ (V26) | opens the screen; record focus not supported | opens the screen | opens the screen | — | **gap**: `focus=` contract is web-only |
| Agency TODAY → exact work item | ✓ (V26) | n/a | counts open queues; rows open the student | n/a | — | **gap**: native rows do not open the request/thread/document |
| Agency workspace: reply as primary when owed | ✓ (V26) | n/a | student screen with message tab | n/a | phone is read-mostly | — |
| University headline (4 figures = rows) | ✓ (V25) | n/a | n/a | ✓ (V26) | — | — |
| University decision-first list | ✓ (V26 default) | n/a | n/a | ✓ "decide" view from headline | — | — |
| University analytics with drill-down | ✓ | n/a | n/a | pipeline funnel only | desktop analytics intentionally not on the phone (V23 §274) | — |
| Visa / arrival / housing | ✓ | ✓ visa; housing/arrival open the web page | n/a | n/a | by design (long forms) | — |
| Locale switch, 33 markets | ✓ | ✓ | ✓ | ✓ | — | — |
| Reduced motion | ✓ | system setting honoured by RN | ✓ | ✓ | — | — |

**Closed in V26:** university native headline (figures = rows, each opens its filtered list — the V25 §325 gap).

**Still open after V26 (recorded in §346):** the `focus=` exact-record contract, Explore grouping, the services "now"
view and the application "latest change" line are web-only. None of them regresses native; each is additive work for a
later pass and is listed in §352.
