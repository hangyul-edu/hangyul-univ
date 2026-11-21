# Route inventory — exhaustive pass (2026-11-21)

Generated from the three `router.tsx` files and checked against `scripts/qa/launch-final/routes.mjs`, the list every
launch-final gate reads (`audit.mjs`, `overlays.mjs`, `matrix.mjs`, `a11y.mjs`, `preview.mjs`). Signed-in routes are visited
in Design Preview (synthetic fixtures, no API, no session); the end-to-end suite covers the same journeys on a real API.

Added to the gate list in this pass: Student `/match` (owner requirement 1's own screen), `/explore?tab=saved`, the
purchase gate `/services?gate=match`; Operations `/review?mode=documents` and all seven HQ routes (opened in the `hq`
preview variant).

Not in the gate list on purpose:

- `/sponsor/:token` (public family view): needs a real token. Its invalid/expired-link state was rendered and reviewed
  ("이 링크는 사용할 수 없어요" + what to do).
- `/services/payment-methods/return`: Toss's return URL; without its query it falls back to the plan page (reviewed).
- University `/lifecycle`, `/retention`, `/graduation`: aliases that render the Cohorts page (`/cohorts/:tab` is audited).

Marketing (6 public routes) and the three native apps' file routes are listed in `README.md`.

### Student — 37 router paths

| Path | In the audit |
|---|---|
| `/login` | yes (1) |
| `/register` | yes (1) |
| `/forgot` | yes (1) |
| `/start` | redirect (target audited) |
| `/sponsor/:token` | covered as described above |
| `/eligibility` | redirect (target audited) |
| `/matches` | redirect (target audited) |
| `/onboarding` | redirect (target audited) |
| `/explore` | yes (2 variants) |
| `/universities/:slug` | yes (5 variants) |
| `/match` | yes (1) |
| `/saved` | redirect (target audited) |
| `/writing` | redirect (target audited) |
| `/compare` | yes (1) |
| `/budget` | yes (1) |
| `/family` | yes (1) |
| `/applications` | yes (1) |
| `/applications/:id` | yes (3 variants) |
| `/documents` | yes (2 variants) |
| `/essays` | yes (1) |
| `/essays/:id` | yes (2 variants) |
| `/tasks` | yes (1) |
| `/messages` | yes (1) |
| `/messages/:id` | yes (1) |
| `/notifications` | yes (1) |
| `/visa` | yes (1) |
| `/housing` | yes (1) |
| `/arrival` | yes (1) |
| `/help` | yes (1) |
| `/scholarships` | yes (1) |
| `/services` | yes (2 variants) |
| `/services/payment-methods/return` | covered as described above |
| `/support` | yes (1) |
| `/profile` | yes (1) |
| `/settings` | yes (1) |
| `/more` | yes (1) |
| `/*` | yes (39 variants) |

### Operations/Admin (agency-web) — 44 router paths

| Path | In the audit |
|---|---|
| `/login` | yes (1) |
| `/performance` | yes (3 variants) |
| `/students` | yes (1) |
| `/students/:id` | yes (10 variants) |
| `/pipeline` | redirect (target audited) |
| `/writing` | redirect (target audited) |
| `/arrival` | redirect (target audited) |
| `/housing` | redirect (target audited) |
| `/visa` | redirect (target audited) |
| `/profile` | redirect (target audited) |
| `/scholarships` | redirect (target audited) |
| `/matches` | redirect (target audited) |
| `/consultations` | redirect (target audited) |
| `/tasks` | yes (3 variants) |
| `/services` | yes (2 variants) |
| `/vendors` | yes (1) |
| `/deadlines` | redirect (target audited) |
| `/messages` | yes (1) |
| `/messages/:id` | yes (2 variants) |
| `/review` | yes (5 variants) |
| `/manage` | yes (1) |
| `/documents` | redirect (target audited) |
| `/essays` | redirect (target audited) |
| `/essays/insights` | yes (1) |
| `/essays/:id` | yes (3 variants) |
| `/applications` | yes (1) |
| `/applications/:id` | yes (3 variants) |
| `/universities` | yes (2 variants) |
| `/universities/:slug` | yes (2 variants) |
| `/templates` | yes (1) |
| `/team` | yes (1) |
| `/payments` | yes (1) |
| `/audit` | yes (1) |
| `/submissions` | yes (2 variants) |
| `/hq` | yes (1) |
| `/hq/agencies` | yes (1) |
| `/hq/manage` | yes (1) |
| `/hq/accounts` | yes (1) |
| `/hq/assignments` | yes (1) |
| `/hq/sources` | yes (1) |
| `/hq/readiness` | yes (1) |
| `/notifications` | yes (1) |
| `/settings` | yes (1) |
| `/*` | yes (57 variants) |

### University — 27 router paths

| Path | In the audit |
|---|---|
| `/login` | yes (1) |
| `/applicants` | yes (2 variants) |
| `/applications/:id` | yes (6 variants) |
| `/applications` | redirect (target audited) |
| `/pipeline` | redirect (target audited) |
| `/offers` | redirect (target audited) |
| `/funnel` | redirect (target audited) |
| `/students` | redirect (target audited) |
| `/programs` | yes (1) |
| `/rules` | yes (1) |
| `/documents` | yes (1) |
| `/scholarships` | yes (1) |
| `/agencies` | yes (1) |
| `/cohorts` | yes (1) |
| `/cohorts/:tab` | yes (3 variants) |
| `/lifecycle` | covered as described above |
| `/retention` | covered as described above |
| `/graduation` | covered as described above |
| `/analytics` | yes (1) |
| `/messages` | yes (1) |
| `/messages/:id` | yes (2 variants) |
| `/exports` | yes (1) |
| `/partnership` | yes (1) |
| `/manage` | yes (1) |
| `/settings` | yes (1) |
| `/notifications` | yes (1) |
| `/*` | yes (28 variants) |
