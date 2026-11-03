# V31 English copy edit: agency and university consoles

Patch: `docs/qa/v31/l10n/source-patch-en-consoles.json`. It changes English only. Every entry leaves out `ko`, so the applier keeps the Korean as it is.
Dry run: `node scripts/i18n/v31/apply-source-patch.mjs docs/qa/v31/l10n/source-patch-en-consoles.json --dry` → `143 changed, 0 refused (dry)`.
Sources checked: `GLOSSARY.md` (V31), `docs/STATE_MAP.md`, and the Korean files `packages/i18n/locales/ko/{agency,university}.json`, which share the same key paths.

## Counts

| Console | Keys reviewed | Changed | calque | vague | ambiguous | length | consistency | AI-tic | meaning |
|---|---|---|---|---|---|---|---|---|---|
| Agency (`agency`) | 2,745 | 95 | 9 | 5 | 2 | 0 | 37 | 37 | 5 |
| University (`university`) | 1,816 | 48 | 1 | 4 | 3 | 0 | 34 | 6 | 0 |
| **Total** | **4,561** | **143** | 10 | 9 | 5 | 0 | 71 | 43 | 5 |

No change was needed for length. Labels, buttons and column headers were already short. Two edits replaced slash-joined headers with a joined form: "University / program" became "University & program", and "Tuition / semester" became "Tuition per semester".

What each change type covered:
- **Consistency.** UK spellings were changed to US spelling: enrolment, catalogue, organisation, licence, authorised, "By post" and "E-mail". Glossary terms were brought into line: add-on instead of "extra", priority replies, managed applications, recommended universities and dedicated team. Two forbidden terms were removed: "Responsible-team" and "Applications managed". The same concept now has the same name across the console, for example SLA breaches, Sample data, Data freshness, and Offer rate instead of "Acceptance rate".
- **AI-tic.** Every em-dash connector in both consoles was replaced. Most were data separators in Today and Operations rows, which now use `·` or `:`. Readiness legends and security prompts were split into separate sentences. Slash-joined phrases were rewritten.
- **Not changed.** Row text and the meaning of each stage or status. Every application status label still maps to exactly one state in STATE_MAP. All `{{placeholders}}` and `<tags>` are kept exactly, and every `_one`/`_other` pair was edited together.

## Before → after examples (20)

| Key | Before | After | Why |
|---|---|---|---|
| agency:kpi.sla_met_rate | SLA met rate | SLA compliance | calque |
| agency:students.col.university | Top university | Main university | ambiguous ("top" reads as a ranking; ko 주요 지원 대학) |
| agency:apps.col.program | University / program | University & program | consistency with "Universities & programs" nav |
| agency:today.overdueDetail | Oldest: {{title}} — {{student}}, due {{when}} | Oldest: {{title}} · {{student}}, due {{when}} | AI-tic (same fix on 13 Today/HQ detail lines) |
| agency:review.scanStatus.INFECTED | Threat found — do not open | Threat found. Do not open | AI-tic |
| agency:perf.load | Share of fair caseload | Caseload vs. target | calque (적정 업무량 대비) |
| agency:v8.agencies.breaches_other | {{count}} broken promises | {{count}} SLA breaches | consistency with hq.ag.sla, v7.hq.agencyRisk |
| agency:v15.scope.key.max_managed_applications | Applications managed | Managed applications | glossary: forbidden passive count label |
| agency:v29.plan.unrationed.TEAM | Responsible-team follow-up | Team follow-up | glossary: forbidden "Responsible-team" |
| agency:v29.plan.unrationed.PRIORITY | Priority response | Priority replies | glossary `priority` |
| agency:v15.scope.key.addOns | Extras | Add-ons | glossary `add_on` (5 "extra" strings aligned) |
| agency:v29.plan.duty.docs.REVIEW_GUIDANCE | Documents: review + correction | Documents: review and notes on what to fix | meaning: Hangyul reviews, it does not correct documents for the student |
| agency:v29.plan.duty.dorm.APPLICATION | Dorm: run application + alternatives | Dorm: application help and other housing options | meaning: glossary says Hangyul helps and does not apply for the student |
| agency:v27.evidence.open | Why and source | Show evidence | vague button (근거 보기) |
| agency:v22.today.sub | …Pick a step; the table underneath is that step. | …Pick a step to show its students in the table below. | calque |
| agency:v9.hq.f.application_blocked.line_other | …still miss required items | …are still missing required items | calque |
| university:agencies.qualityTitle | Acceptance rate alone isn't a quality measure | Offer rate alone is not a measure of quality | ambiguous: the metric shown is "Offer rate" |
| university:offers.acceptRate | Acceptance rate | Offer acceptance rate | ambiguous ("acceptance rate" means admit rate in admissions) |
| university:decision.action.ADMISSION_CERTIFICATE_PENDING | Admission letter pending | Mark admission letter pending | vague: a button that read like a status |
| university:nav.offersEnrolment | Offers & enrolment | Offers & enrollment | consistency (US spelling; about 25 university strings) |

## English that did not match the Korean (fixed in this patch)

- `agency:v29.plan.duty.docs.REVIEW_GUIDANCE`: "review + correction" suggested Hangyul edits the documents. The Korean 검토·보완 가이드 means review plus guidance on what to fix, which matches the glossary terms `document_review` and `correction_notes`.
- `agency:v29.plan.duty.visa.DOCUMENT_PREP`: "Visa: prepare documents" dropped 지원 ("help"). It is now "help preparing documents", which matches glossary `visa_support`.
- `agency:v29.plan.duty.dorm.APPLICATION`: "run application" claimed Hangyul applies for the student. **The Korean 신청 대행 says the same thing and conflicts with glossary `dormitory_application`.** The English now follows the glossary. The owner should decide whether to change the Korean to 신청 지원.
- `agency:v29.plan.unrationed.CONTRACTED_DOCUMENTS`: "No limit within contracted documents" left out part of the glossary scope `premium_scope` ("documents and schedule in your contract"). The English now carries the full scope. The Korean 계약 서류 내 무제한 names only documents and should be checked against the glossary.
- `agency:v8.docs.oneStudent`: "Only {{name}} — show everyone" read like a filter option. The Korean ({{name}} 님만 보는 중 · 전체 보기) is a status ("showing only") followed by a link. The English now says "Showing only {{name}} · Show everyone".
- `agency:v29.plan.duty.dedicated`: the Korean 전담 담당 means a dedicated person, but glossary `dedicated_team` (Premium) says "dedicated team". The English follows the glossary, so the Korean should be checked.

## Unclear or risky source keys (listed, not changed)

- `agency:catalog.guaranteeTerms` (보장 조건), `university:partnership.guarantee` (조건부 입학 보장), `university:partnership.guaranteeOn`/`guaranteeOff`/`guaranteeNote` and `university:partnership.minimum` (최저 보장액). These are contract terms between partners, but "admission guarantee" is close to the forbidden "guarantee(d) admission". Someone needs to decide whether the product really offers a contractual conditional admission guarantee. The copy should not be reworded until that is settled.
- `agency:v15.scope.minutes` ({{count}}분 제공). This is legacy V15 wording in minutes, which the glossary forbids for plans. It is left in place for V15-era purchases. Confirm whether it is still rendered.
- `agency:waiting.on.external` (대사관 대기, "Waiting on embassy"). This is narrower than the `external` party in STATE_MAP, which also covers the official portal and providers. `students.view.waiting_external` says "embassy or another party". The Korean and English agree, so the key is listed for the owner rather than changed.
- `agency:students.view.waiting_us`, `students.waiting.us`, `waiting.us`, `waiting.on.us` (우리). The legacy `us` value is kept on purpose (STATE_MAP V9), and the wording is left alone.
- `university:v8.ov.moved`. This is a sentence fragment that ends with a link ("…are in"). The Korean ends with a colon. The wording depends on the link that follows it, so it was not changed.
- "Cancelled" (about 12 keys across both consoles) is a valid US spelling. It was left as is to avoid churn.
