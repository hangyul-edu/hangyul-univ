# Exhaustive product-quality pass — QA evidence (2026-11-21)

Summary and verdict: [`../../../REPORT.md`](../../../REPORT.md) §5 and §8. Scripts: `scripts/qa/launch-final/`
(`audit.mjs` and `overlays.mjs` are new in this pass; `routes.mjs` is the route list every gate reads).

| Item | Where |
|---|---|
| Route inventory (code-derived, 3 routers + Marketing + native) | [`ROUTES.md`](ROUTES.md) |
| Defect inventory (29 product defects + 3 harness defects, root cause and fix each) | [`DEFECTS.md`](DEFECTS.md) |
| Gate results (JSON) | [`results/`](results/) |
| Before / after screens (representative) | [`screens/`](screens/) |

## Results (final builds)

| Gate | Result | File |
|---|---|---|
| Rendered audit — Student 156 / consoles 255 / Marketing 24 pages | 0 overflow · 0 unreachable bottoms · 0 native selects · 0 page errors (reviewed exceptions in DEFECTS.md) | (logs not committed; re-run `audit.mjs`) |
| Student scroll gate | 130/130 | `results/student-scroll.json` |
| Overlays / body-lock | Student 140 runs · Operations 104 · University 54 — 0 problems | `results/overlays-*.json` |
| URL-opened drawers | 12/12 (scroll to last item, close visible, Escape, unlock) | — |
| Responsive 12 widths | all apps 1,560 loads (roster row failing → fixed) · consoles re-run 1,020 loads **0 overflow** | `results/matrix-all-apps.json`, `results/matrix-consoles-final.json` |
| Zoom 125 / 150 / 200 % | 0 / 0 / 1 (roster) → consoles re-run at 200 %: 255 loads, 0 | `results/matrix-z1*.json`, `results/matrix-z200-*.json` |
| Languages ko · vi · ja · zh-Hans · ru · ar | 135 loads each, 0 overflow, `dir=rtl` for ar | `results/matrix-<lang>.json` |
| Dark device | 260 loads (roster) → consoles re-run 170 loads, 0; `color-scheme` light everywhere | `results/matrix-dark-*.json` |
| Accessibility (axe WCAG 2.1 A/AA) | see `a11y.json` (REPORT §8) | `results/a11y.json` |
| Design Preview isolation | 3 apps, 0 failures (0 `/api` requests, no fixture miss incl. HQ) | `results/preview-isolation.json` |
| Language leak | 0 leaks on 415 pages | `../l10n/lang-leak.json` |
| End-to-end (isolated real stack) | critical 30/30 · journeys 22/22 | REPORT §8 |

## How the pass was run

- **Rendered, not assumed.** Four production builds served locally (`serve.mjs`, :4100–4103). Signed-in screens in Design
  Preview (synthetic fixtures; no API, no session). Screenshots were opened and read before and after each fix.
- **Real stack for journeys.** `scripts/qa/e2e-run.mjs`: a cloned test database (`hangyul_univ_e2e`, dropped afterwards),
  the real API on :8090, production builds on 4600–4603.
- **Machine.** WSL2, 4 cores, 7.8 GB; user-space PostgreSQL 14 + Redis 6; Chromium headless 1243. No KVM, no Android SDK,
  no Xcode — native apps could not be run (see REPORT §8).

## Native

Not run on a device or emulator (no KVM / Android SDK / Xcode here). Done at source level: three apps typecheck, Student
native 23 unit tests pass; the native home no longer shows the internal organisation; the reworded `mobile` strings were
applied in 21 locales. Device-only aspects (fonts, safe areas, keyboard avoidance, pickers, tab-label fit) remain
unverified.

## Marketing and native routes

- **Marketing (public, 6 in the gates):** `/`, `/universities`, `/universities/:slug` (425 prerendered; SNU audited, others
  share the template), `/privacy`, `/terms`, 404. `/start` redirects to the Student login (`next=/match`).
- **Student native (expo-router):** tabs `index`, `explore`, `applications`, `messages`, `more`; `applications/[id]`,
  `documents/index`, `documents/[id]`, `login`, `register`, `match`, `matches`, `messages/[id]`, `notifications`, `profile`,
  `saved`, `services`, `settings`, `tasks`, `universities/[slug]`, `visa`.
- **Operations native:** tabs `index`, `students`, `tasks`, `reviews`, `messages`, `settings`; `deadlines`, `students/[id]`,
  `reviews/[id]`, `messages/[id]`.
- **University native:** tabs `index`, `applicants`, `pipeline`, `cohorts`, `inbox`, `settings`; `applicants/[id]`,
  `messages/[id]`.

Native routes were reviewed at source level only (see "Native" above).
