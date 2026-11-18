# Hangyul Univ documentation

Canonical documents live in this folder (19 Markdown files, nothing else at the root). Detail, data and evidence live
in subfolders. Check links and root gates with `python3 scripts/docs/check-links.py`.

## Read first, in this order

| # | Document | What it is for |
|---|---|---|
| 1 | [PRODUCT.md](PRODUCT.md) | What Hangyul Univ is, who operates it, what the student buys, products, principles, the student journey |
| 2 | [SERVICE_CATALOG.md](SERVICE_CATALOG.md) | The plan contract: prices, entitlements, additional services, versioning |
| 3 | [한귤유니브_서비스기획서.md](한귤유니브_서비스기획서.md) | Designer-oriented service summary in Korean (PDF: [`media/한귤유니브_서비스기획서.pdf`](media/한귤유니브_서비스기획서.pdf)) |
| 4 | [REPORT.md](REPORT.md) | Current launch report: state, data coverage, security, localization, launch QA, blockers, changelog |
| 5 | [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, production topology, why the code says "agency" |
| 6 | [ADMISSIONS.md](ADMISSIONS.md) | Fit, strategy, preparation, documents, essay review, submission, visa, arrival |
| 7 | [LOCALIZATION.md](LOCALIZATION.md) | Languages actually selectable, review status, quality rules, RTL, glossary |
| 8 | [BRAND_AND_MEDIA.md](BRAND_AND_MEDIA.md) | Logos, OG/social metadata, icons, image-licence policy |
| 9 | [SECURITY.md](SECURITY.md) | Controls, launch-blocking requirements, Design Preview rules, SSO |
| 10 | [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel projects, `/api` rewrite and tunnel, env vars, build marker, release gates |

## Reference

| Document | What it is for |
|---|---|
| [DATA_MODEL.md](DATA_MODEL.md) | Generated table reference (`server/scripts/gen_data_model_doc.py`) |
| [FRONTEND_CONVENTIONS.md](FRONTEND_CONVENTIONS.md) | Stack, rules, design system, templates, Design Preview conventions |
| [WORKFLOWS.md](WORKFLOWS.md) | Lifecycle, state transitions, upload, review, assignment, handover flows |
| [STATE_MAP.md](STATE_MAP.md) | What each application state means and says in each product |
| [LEGAL.md](LEGAL.md) | Product-facing legal and owner decisions still open |
| [RESEARCH.md](RESEARCH.md) | Decision-relevant benchmark findings and the Korea study-abroad domain research with sources |
| [ANALYTICS.md](ANALYTICS.md) | Event philosophy, catalogue, privacy and do-not-track rules, dashboard metrics |
| [ROADMAP.md](ROADMAP.md) | Open work only: launch blockers, external dependencies, next priorities |

## Subfolders

| Folder | Contents |
|---|---|
| [`admissions/`](admissions/) | Implementation and research detail behind ADMISSIONS.md (strategy, dossier, writing review, submission connectors, visa routes, arrival) |
| [`research/`](research/) | Source lists (`sources.json`, `v9-*.json`), visa/arrival/submission data, full competitor benchmark, validation protocols, `archive/` |
| [`media/`](media/) | Licence audit (`LICENSE_AUDIT.md`), retired attribution-required originals, service-plan screenshots and PDF |
| [`legal/`](legal/) | Statute texts, vendor facts and source URLs |
| [`deployment/`](deployment/) | Vercel project detail and the environment matrix |
| [`mobile/`](mobile/) | Store readiness for the three native apps |
| [`payments/`](payments/) | [`BILLING.md`](payments/BILLING.md) — billing-key payment rail, gates, live capability results; `TOSS_FOREIGN_CARD_REVIEW.md` is a superseded historical record |
| [`qa/launch-final/`](qa/launch-final/) | **The current QA folder** — launch-pass results |
| `qa/v9` … `qa/v32` | Only the retained baselines and evidence that code, data or gates read by path (see [`qa/README.md`](qa/README.md)); all other historical QA output was removed and is in git history |
