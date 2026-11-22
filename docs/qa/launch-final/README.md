# Launch-final QA

The one current QA folder. It holds the results of the final launch-readiness pass; nothing from earlier passes
belongs here. Summary and verdict: the `LAUNCH-QA` section of [`../../REPORT.md`](../../REPORT.md).
Scripts: `scripts/qa/launch-final/`.

## Contents

| Item | Where |
|---|---|
| **Product-excellence pass (2026-11-22)** — task map and task counts, WCAG 2.2 checks, Core Web Vitals, Operations at 1,071 students, failure conditions, before/after key screens, scorecard, human translation queue | [`excellence/`](excellence/README.md) |
| **Exhaustive product-quality pass (2026-11-21)** — route inventory, defect inventory, scroll/overlay/responsive/a11y/language results, E2E, before/after screens | [`exhaustive/`](exhaustive/README.md) |
| Route inventory | [`ROUTE_INVENTORY.md`](ROUTE_INVENTORY.md) |
| Visual defect matrix | [`VISUAL_DEFECT_MATRIX.md`](VISUAL_DEFECT_MATRIX.md) |
| Responsive / overflow results (12 viewports; zoom; six languages incl. RTL; dark device) | `after/matrix*.json` |
| Accessibility results | `after/a11y.json` |
| Preview isolation test | `after/preview-isolation.json` |
| Sign-up walk results and screens | `after/signup/` |
| Deployment smoke | `before/production-smoke.json` (start of pass), `after/production-smoke.json` + `after/production/` (after deploy) |
| Screenshots | `before/screens/` (production at the start of the pass, public routes), `after/screens/` (final, curated: key routes of each product at 320 / 390 / 768 / 1440, plus language samples) |
| Gate ledger and logs | `after/logs/ledger.txt`, `after/logs/*.log` |

Re-create everything with `npm run qa:launch` (writes the full screenshot set; only the curated subset is committed).

## Rules

- Only results of this pass. Do not copy older `docs/qa/vNN` output here.
- No secrets, tokens, real personal data or real student documents in screenshots or logs.
- Keep logs to the final run; intermediate failed runs are not evidence.
