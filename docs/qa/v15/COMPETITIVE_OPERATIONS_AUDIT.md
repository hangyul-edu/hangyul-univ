# V15 Competitive operations benchmark

A fresh look at the products Hangyul's counselors and partner universities would otherwise be using, done
**before** the Agency and University changes in this pass rather than to justify them afterwards (brief
Part 25).

## How to read this

Everything below comes from vendor marketing, vendor help centres, partner success stories and trade press,
reviewed 19 Oct 2026. **None of it is a product trial.** No login was obtained for any of these systems, no
screenshot was reproduced, and nothing here was measured. Where a vendor states a number it is written as
*their claim*, because that is what it is — a "95 % success rate" on a homepage is a marketing figure, and a
"75 % reduction in attrition" in a partner story is a figure the partner agreed to publish.

That matters for honesty about what this benchmark can and cannot support. It can tell us **what jobs these
products think they are doing** and **which of those jobs they present as the first screen**. It cannot tell
us whether their UI is actually fast, and no claim in this document should be read as evidence that ours is
better.

The five products the brief named are here. A sixth block covers the admissions-analytics practice
literature, because the University Console's job in this pass is closer to that than to any agent portal.

---

## 1 · ApplyBoard — agent/counselor platform, application-centric

**TASK** — a counselor prepares and submits a student's application to a foreign institution, and the
platform screens it before it reaches the school.

**WHAT THEY DO WELL**

- **Pre-submission screening is the product.** ApplyBoard states that it reviews every application for
  accuracy and completeness — prerequisites, document validity, study gaps — before it reaches a partner
  institution, and claims 24 % of applications are filtered out at that step. Whether or not the number is
  right, *the shape of the claim is the right shape*: the vendor's differentiator is the quality of what
  arrives, not the volume of what is sent.
- **Requirements as a first-class tab.** The redesigned Application page leads with an "Applicant
  Requirements" tab built to spot missing or expired documents at a glance, with progress tracking. It is
  the one part of the redesign that shipped to everyone first, which is a signal about what their users
  actually needed.
- **Source verification where a source exists.** For English test scores they check against the issuing
  body rather than eyeballing a PDF.
- **Accessibility stated as a target.** The redesign claims WCAG AA, keyboard navigation and screen-reader
  support. Rare enough in this category to note.

**WHAT FEELS COMPLEX**

- The 2026 redesign is announced as five separate concurrent changes (requirement tab, sidebar, enhanced
  ATS, responsive design, accessibility) with several more — self-service functions, a page header, a notes
  tab — still "planned". A user is being asked to relearn the page in instalments.
- "Stage timeline projections" and "task prioritisation" sit in the same tracking widget as raw status. Those
  are three different confidence levels (fact, estimate, opinion) presented as one surface.
- The advisor-monitoring layer ("we continuously assess application quality, document integrity, student
  outcomes") is scoring the counselor, not helping them. It is a marketplace's quality-control need wearing
  the clothes of a feature.

**WHAT HANGYUL SHOULD LEARN**

1. **Make "is this ready to submit?" the loudest thing on an application.** Their requirement tab exists
   because that is the question. Ours should answer it as a sentence, not as a tab the counselor opens.
2. **Verify against a source when a source exists; say so when it does not.** This is directly applicable
   to TOPIK certificates and transcripts.
3. **Completeness-before-submission is a legitimate commercial promise** and belongs in the plan scope, which
   is exactly what the new business plan does with 서류 검토 at three levels.

**WHAT HANGYUL SHOULD NOT COPY**

- The marketplace scoring of counselors. Hangyul's counselors are staff delivering a plan the student bought,
  not suppliers being ranked.
- A single headline success rate. "95 %" over an unstated population is the kind of number
  `docs/qa/v13` and `MIN_N` exist to prevent, and the business plan explicitly forbids guaranteeing admission.
- Shipping an IA change in five concurrent instalments.

---

## 2 · IDP FastLane / Client Portal — institution-side offers, agent-mediated

**TASK** — an institution publishes offer criteria; a counselor gets a fast conditional "offer in principle"
for a student who matches; the student tracks it.

**WHAT THEY DO WELL**

- **Criteria live with the institution, not in a counselor's head.** The Client Portal is where a university
  enters and amends its own offer criteria, and the offers issued against them are visible in real time.
  That is the correct owner for that data.
- **Consent gates visibility.** Institutions can only see personal details of students who accepted a
  proposal *and* consented to disclosure. A privacy default that is structural rather than a policy page.
- **Status as the student's own object.** The IDP Live app gives the student a real-time progress tracker,
  one document upload reused across applications.

**WHAT FEELS COMPLEX**

- Three products (FastLane, Propose, Client Portal, plus Navi) to describe one flow; which surface answers
  "where is my offer?" depends on who is asking.
- "Offer in principle" is a genuinely useful object that is hard to explain, and the marketing does not
  distinguish it clearly from an offer.

**WHAT HANGYUL SHOULD LEARN**

1. **Consent-gated applicant visibility is the right default** for the University Console, and we should keep
   checking ours behaves that way.
2. **Upload once, reuse across applications** is the single highest-leverage thing in a document product.
3. The institution should own its own admission criteria — which is what `AdmissionRules` already does.

**WHAT HANGYUL SHOULD NOT COPY**

- A separate branded product per step. Hangyul's whole V11–V14 direction has been fewer surfaces.
- Conditional-offer language anywhere near the student marketing copy; the business plan does not guarantee
  admission and §8 of the plan says so explicitly.

---

## 3 · Enroly (CAS Shield / Apply) — post-offer compliance, UK

**TASK** — between an accepted offer and the student actually arriving, get every compliance artefact in
place without a human chasing by email.

**WHAT THEY DO WELL**

- **They chose the unglamorous half of the journey.** Offer → CAS → visa → arrival is where UK universities
  were losing students, and Greenwich's published figure (75 % reduction in enrolment attrition after moving
  off spreadsheets and email) is the kind of outcome claim that at least names the before-state.
- **Configurability as the unit of work.** Coventry is described as running 17 bespoke automated workflow
  configurations and per-agent automated document requests. The product's shape is "rules you set", not
  "screens we built".
- **Smart prioritisation at peak.** They name volume spikes as the design constraint, which is honest about
  what admissions actually feels like in August.
- **Self-service for students and agents** on the same record the university works from.

**WHAT FEELS COMPLEX**

- "Enrolment confidence score" and "automatic risk detection" on customisable "risk regions" is a scoring
  model applied to people, with nationality-shaped inputs. The compliance need is real; the ethical surface
  is large and the marketing page does not describe how a score is explained or appealed.
- Seventeen configurations is also a number about *how much setup a university had to do*.

**WHAT HANGYUL SHOULD LEARN**

1. **Post-admission is a product, not an epilogue.** This is the direct benchmark for University Overview
   §5 and for Premium's 30-day settlement entitlement: Offer → Visa → Arrival → Enrollment is where the
   information most recruiters lack actually lives.
2. **Design for the peak, not the demo.** Our own V13/V15 scale simulations exist for this reason.
3. **The agent and the university should work the same record**, which our application object already is.

**WHAT HANGYUL SHOULD NOT COPY**

- A confidence/risk score on an applicant. V15 keeps the explicit `DO NOT USE FAKE SCORES` rule: we surface
  *named blockers* ("TOPIK 증빙 필요"), never "87 % likely".
- Risk configured by region. That is nationality profiling with a settings page.

---

## 4 · Cialfo — K-12 counseling caseloads

**TASK** — one counselor holds a caseload of hundreds of students across several cohorts and has to keep
every one of them moving against external deadlines.

**WHAT THEY DO WELL**

- **The caseload is the primary object.** Students group into advisor groups whose progress is tracked
  together. This is the closest existing product to our 200-students-per-counselor problem.
- **Bulk is a first-class verb.** Bulk-assign tasks to a grade or group, bulk document upload, shared
  calendars, automated reminders. At caseload scale, per-student actions do not survive.
- **cDocs**: one place where "what this application needs" and "what we have" are the same list.
- **Direct Apply**: one pre-filled form out to participating universities, with the counselor tracking
  progress centrally — the structural equivalent of our submission connectors.

**WHAT FEELS COMPLEX**

- Feature names as nouns the user must learn (cDocs, Resources, Direct Apply, Tasks) — four vocabulary items
  for what is, from the counselor's side, one job.
- Reporting for "counsellors and leaders" in one dashboard tends to mean the manager's metrics are on the
  practitioner's screen.

**WHAT HANGYUL SHOULD LEARN**

1. **Bulk and grouping are the scale answer**, and our Today queue's state chips are a weaker version of the
   same idea. Confirmed by this pass's 200-case simulation.
2. **Deadlines are external and shared**; a deadline shared by ten programs is one row, which is what
   `upcomingDates()` already does on the University side and what Agency should match.

**WHAT HANGYUL SHOULD NOT COPY**

- A product vocabulary. V11 removed ours deliberately.
- Manager metrics on the counselor's home screen. That is exactly the "KPI tiles above the work" the brief
  forbids in Part 8, and is why plan-utilization analytics in this pass goes to Insights and **not** Today.

---

## 5 · Leverage Edu — student-side aggregator

**TASK** — a student in India picks a destination, a course and a loan, through one app.

**WHAT THEY DO WELL**

- **One dashboard for the whole journey** on the *student* side, with add-ons (education loans via NBFCs,
  remittance, accommodation, visa) attached at the point they become relevant rather than sold up front.

**WHAT FEELS COMPLEX / WHAT THE RESEARCH COULD NOT ESTABLISH**

- **No counselor-facing product documentation is publicly available.** Searches returned funding coverage,
  city landing pages and student-side marketing. Their B2B work for universities exists but is not described.
  This benchmark therefore has *nothing substantive to say about Leverage Edu's operations UX*, and saying so
  is more useful than padding the section.

**WHAT HANGYUL SHOULD LEARN**

1. **Contextual add-ons beat an add-on catalogue.** This is the single most transferable idea in this
   document for Part 3 (optional paid services) and it is exactly what V15 implements: an add-on is offered
   inside an active case when the purchased plan's allowance is exhausted, and is invisible otherwise.

**WHAT HANGYUL SHOULD NOT COPY**

- Financial-product attachment (loans, remittance). Out of scope, separately regulated, and not in the
  business plan.

---

## 6 · Admissions analytics practice (not a product)

Reviewed because University Overview and Analytics are the part of this pass with the weakest product
precedent. Sources are vendor blogs and practitioner guides; the indicative conversion ranges in them are
**not benchmarks** and none is reproduced as a target in our UI.

**WHAT IS WORTH TAKING**

- **Slice by programme, cohort and intake, because the aggregate hides everything.** Our funnel already
  carries an intake selector and a stated population; Overview §3 (source market) adds the second slice.
- **The steepest drop is the finding.** Practitioner guidance is unanimous that the useful output of a funnel
  is *where the biggest meaningful fall is*, not the list of stage counts. V15 makes the largest drop an
  explicit, named element of the funnel rather than something the reader derives.
- **Connect the funnel to what happens after.** One source makes the point that application tracking that
  stops at "admitted" cannot tell an institution whether the right students were admitted. This is the
  argument for Overview §5.
- **Market demand needs applications *and* enrollments side by side.** Volume by country is a vanity metric
  alone; the director's question is which markets produce *enrolled* students.

**WHAT NOT TO TAKE**

- Cost-per-lead / cost-per-application dashboards. Hangyul is not running the university's paid acquisition.
- Any published conversion band as a comparison line in our UI. We do not know the population behind them.
- "Speed to lead in five minutes" as a design driver. The cited research is vendor-sourced and the claim is
  about enquiry marketing, not admissions operations.

---

## What this benchmark actually changed in V15

Stated plainly, so this document is not decoration:

| Change in this pass | Benchmark behind it |
|---|---|
| Application readiness as **named blockers**, never a score | ApplyBoard's requirement tab (take) + Enroly's confidence score (reject) |
| Readiness sentence on the application row rather than a tab | ApplyBoard — right question, wrong placement |
| Plan entitlement visible on the Today row and the case strip | Cialfo caseload grouping, at 200-case scale |
| Add-ons offered only inside a case with an exhausted allowance | Leverage Edu contextual add-ons |
| University Overview §5 post-admission (Offer → Visa → Arrival → Enrolled) | Enroly's entire product thesis |
| Funnel names its own largest drop | Admissions analytics practice |
| Source market shows applications **and** enrollments | Admissions analytics practice |
| Manager plan-utilization in Insights, never on Today | Cialfo (what to avoid) |
| No risk/confidence score anywhere | Enroly (what to avoid) |

## What this benchmark did not resolve

- Nobody's **writing-review** workflow is publicly documented. §12 of the brief is being designed without
  precedent, from the business plan's own 첨삭 definition.
- No competitor publishes an **entitlement model**. The plan-limit mechanism in V15 has no benchmark and is
  derived entirely from the owner's 플랜별 비교표.
- Whether any of these products is fast in the hand. Not knowable from the outside.
