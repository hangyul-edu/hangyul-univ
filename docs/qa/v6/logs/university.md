# V6 — University Console workstream log

Captures: `OUT=<dir> node scripts/qa/v6-university.mjs [widths] [filter]` (demo-login, 14 routes × 1440/1280/390, full page; prints OVERFLOW if the page scrolls horizontally). Phone task check: `node scripts/qa/_v6uni-mobile.mjs`.

- Before: `docs/qa/v6/university/before/un-<route>-<width>.png` (42 files)
- After: `docs/qa/v6/university/after/un-<route>-<width>.png` (42 files) + `un-phone-request-390.png`, `un-phone-decision-390.png`
- Horizontal overflow after: none at 1440/1280/390.

## Changes per screen
| Screen | Change | Why |
|---|---|---|
| Login | `demoAccounts` prop removed; SSO option kept | Demo access (dev chip) replaces the account list |
| Overview | "Complete on first review" footnote → "How Hangyul applications arrive" panel: complete on first review, shared documents verified, median days to first decision, median days to answer document requests — each with n; withheld < 5. Demo sentence removed from the footer note | The adoption case visible on the first screen, measured, never asserted |
| Applicant detail | Queue navigation (n of N awaiting decision · Prev / Next); section jump links; **Statements reader** (approved statement text in a 68ch reading column, tabs per statement, words vs limit, version, approval date; audited); "Academic record" section; quieter View buttons; Demo badge and "Sample data" freshness removed (real freshness still shown) | Reader-first, fast review loop; essays used to be status-only |
| Applicants | Phone cards use the short status so the name is never truncated; export button desk-only on phones | 390 px: "Rizky Pra…" |
| Partnership | New "What the partnership delivers" panel (preparation facts + after-admission facts: visa after tuition, arrival after visa, retention, graduation, each with population and n); performance moved above the agreement and rendered as facts ("0 of 65 contracted seats"); incentive tiers labelled; demo contract badge + fictional-contract sentence removed | "Why would a university adopt Hangyul?" answered with its own numbers |
| Analytics | Breakdown bars now actually render (fill was an inline span); segment chips selected in console blue, not near-black; comparison table row headers share the body hairline; series colours = console palette tokens | Broken bars; heavy chips; misaligned lines |
| Programs, Scholarships, Documents, Students | Per-row "Sample data"/"Demo" badges, "sample contract" suffix, demo footnotes removed (`Provenance` shows real freshness only) | Environment disclosed once by the dev indicator |

## Backend (additive)
- `server/app/services/university_value.py` (new): `preparation()` and `statements()`.
- `server/app/api/v1/university.py` (appended): `GET /university/preparation`, `GET /university/applications/{id}/statements` (tenant-scoped via `get_application_for`, approved essays only, never before submission, audited `application.statements_view`).
- `server/tests/test_v6_university.py`: 5 tests incl. tenant isolation (other university gets 403/404; `university_id` override ignored for university principals) and student denial.

## Results
- `tsc --noEmit -p apps/university-web`: clean for university-web (one unrelated error in packages/mobile-ui from another workstream).
- vitest university-web: 52 passed (new `components/v6.test.tsx`, 4 tests).
- pytest `test_v6_university.py` + `test_v4_university.py`: 12 passed.
