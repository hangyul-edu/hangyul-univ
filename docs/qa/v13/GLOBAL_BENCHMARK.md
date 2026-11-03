# V13 — Global competitive benchmark

*Brief Part 16. Researched 2026-10-17 against the vendors' current public product and help-centre pages, not
against `docs/COMPETITOR_BENCHMARK.md`, which is a V9 document and is superseded for these seven products.*

## How this was done, and what it is worth

Seven products were researched from what they publish now: product pages, help-centre articles written for
their own users, and trade press. **None of these platforms was used as a logged-in customer.** Every
operator platform here (Enroly, ApplyBoard's agent side, Adventus, Cialfo's counsellor console) is behind a
contract, so what follows is an informed reading of published behaviour — strong evidence for *what task a
product thinks it is doing*, weak evidence for how well it does it.

Vendor efficiency claims are quoted as claims and never used as a target. Enroly's "80% less admin time" and
Cialfo's "2-day offer turnarounds" are marketing numbers with no published method.

**The benchmark is of task quality, not branding** (brief's instruction). Nothing below is about anyone's
colour palette.

---

## 1. IDP FastLane

**TASK** — Tell a student *before* they invest in an application whether a university would take them.

**BEST IDEA** — The in-principle offer. A student builds an academic profile with **no documents**, is matched
only against courses whose published entry rules they satisfy, and receives a conditional decision — IDP's
own careers page claims within 30 minutes in some cases. The institution's entry requirements are encoded as
rules, and IDP says it now generates those rules from requirement text with AI.

**WEAKNESS** — Coverage is the product. It works for a limited set of institutions in the UK, Australia,
Canada and New Zealand; outside that set the student gets nothing and cannot tell in advance. The published
institution counts disagree between IDP's own press releases (27 in one, 32 in another), which is itself a
sign of how narrow the covered set is.

**WHAT HANGYUL SHOULD LEARN** — Usefulness before completeness. The valuable thing is not the offer, it is
that a student finds out *early*, from a thin profile, which doors are open. Hangyul already has the engine
for this: `matching` evaluates published minimums and returns tiers with reasons.

**WHAT HANGYUL SHOULD NOT COPY** — The in-principle offer itself. Korean universities decide admission; a
"you are likely in" from us would be the acceptance-probability theatre the brief forbids in Part 6, and
would be a claim we have no authority and no data to make.

**HANGYUL CURRENT STATE** — `/start` asks a short profile and returns tiers with named reasons
("TOPIK 3 required — you have TOPIK 2"). Correct in kind.

**V13 CHANGE** — None to the engine. The change is upstream, in the homepage: the primary action is now
*내 유학 준비* rather than *로그인*, so the path to that early answer is what the site advertises.

---

## 2. ApplyBoard

**TASK** — Make missing and incorrect documentation impossible to misunderstand.

**BEST IDEA** — **Requirements are personalised per application and carry their own state.** ApplyBoard's
help article for students describes a Requirements tab where each task (English proficiency, bank statement,
passport copy) has an *Answer* button and a status — Pending, Approved, Rejected, In Review — and says
plainly that two applications can show two different lists, "because the system updates requirements based on
the school's policy, your destination country, and your profile". The requirement is the unit of work, not
the document.

**WEAKNESS** — The requirement list is a to-do list. From the published material there is no evidence it
checks a *document against another document* — that the name on the passport matches the name on the
transcript, that the graduation date agrees with the degree certificate. The destination guides push that
work onto the student in prose ("certified translations for non-English documents").

**WHAT HANGYUL SHOULD LEARN** — Requirement-centric upload is right, and Hangyul already does it. The gap
worth closing is the one ApplyBoard leaves open: **consistency between documents**, which is a far more
common cause of a Korean university returning a file than a missing one.

**WHAT HANGYUL SHOULD NOT COPY** — Nothing specific. The model is sound.

**HANGYUL CURRENT STATE** — Requirement-centric (`application_readiness` → checklist → lanes), with
per-country legalization resolved from `LegalizationRule`. Document findings (name mismatch, wrong type, poor
scan, duplicate) and extracted fields exist in `services/dossier.py` — and were **not** reaching the
application's quality check.

**V13 CHANGE** — Identity and essay checks now reach the application (§97). The student-facing count that
said *"We found 11 details in your documents"* now names what kind of thing it found.

---

## 3. Enroly Apply

**TASK** — Give the university, the agent and the student one shared workflow from application to offer.

**BEST IDEA** — **One record, three audiences, no re-keying.** Enroly positions Apply as sitting alongside
the university's own systems (it names Tribal SITS, Ellucian, UNIT-e, Salesforce) rather than replacing them,
and gives agents their own user type with user groups scoped to the students they are allowed to see.

**WEAKNESS** — It is an integration product. Its value depends on a university having a student record system
worth integrating with, and on the agent relationship being contractual and pre-existing.

**WHAT HANGYUL SHOULD LEARN** — The absence of handoffs is the feature. Enroly's pitch is that nothing is
re-entered between stages.

**WHAT HANGYUL SHOULD NOT COPY** — The agent *portal* as a separate product surface. Hangyul's agency console
is the same record, not a window onto someone else's.

**HANGYUL CURRENT STATE** — Already one record end to end: one `Application`, one document vault, one waiting
model across student, agency and university, and V12's directory/catalogue split keeps a directory-only
university a *state* rather than a 404.

**V13 CHANGE** — None needed. This is the dimension on which Hangyul was already strongest.

---

## 4. Enroly CAS Shield

**TASK** — Carry an admitted student from offer to arrival, and prioritise a peak-season queue.

**BEST IDEA** — **Smart prioritisation of large applicant numbers during peak periods**, with automated
document collection and configurable risk regions. The design assumption is that volume, not complexity, is
what breaks an admissions team.

**WEAKNESS, and the one Hangyul must not repeat** — CAS Shield publishes an **"enrolment confidence score"**
and automatic risk detection. A single number that predicts whether a human being will enrol, computed from
features that correlate with nationality and region, is precisely the artefact the V13 brief rules out in
Part 6 — and in a compliance product it carries a discrimination risk that a marketing score does not.

**WHAT HANGYUL SHOULD LEARN** — Prioritisation under volume. The agency Today queue already ranks; V13's
change is to make the *filters* survive volume too.

**WHAT HANGYUL SHOULD NOT COPY** — The confidence score. Named here because it is the most attractive bad
idea in this benchmark: it looks like intelligence and it is a correlation with a passport.

**HANGYUL CURRENT STATE** — `services/priority.py` ranks by most-urgent reason, then reason count, then
clock, and publishes the rule in the UI ("How is this ordered?"). No score anywhere.

**V13 CHANGE** — Today's filter row is four operational states instead of nine work types, because at 200
students per counsellor nine work-type counts are all double digits (§99). The ranking rule is unchanged.

---

## 5. Cialfo / Direct Apply

**TASK** — One application experience for the student, with the counsellor able to see and gate it.

**BEST IDEA** — **The pre-filled single form**, plus optional pre-submission counsellor review, plus a
student dashboard that shows counsellor-assigned tasks, meetings, deadlines and application status in one
place. Cialfo also gives Direct Apply its own mail inbox and uses AI to detect offers inside incoming email.

**WEAKNESS** — The mail inbox is a workaround for universities that answer by email, and it introduces a
second place where the truth about an application lives. Counsellor visibility into it is a school-level
setting, so a counsellor may be looking at a case whose latest news they cannot see.

**WHAT HANGYUL SHOULD LEARN** — The *offer detection* instinct is right: a decision that arrives out of band
must still land on the record.

**WHAT HANGYUL SHOULD NOT COPY** — A parallel inbox. Hangyul's equivalent risk is the submission hand-off,
where a student submits personally on a university portal (which Korean practice requires) and the
confirmation number has to come back by hand.

**HANGYUL CURRENT STATE** — One coherent record; the hand-off gap is explicit and queued
(`confirmation_missing` → "Chase confirmation") rather than hidden.

**V13 CHANGE** — None. Recorded as a confirmed strength.

---

## 6. Leverage Edu

**TASK** — End-to-end: profile → shortlist → application → offer → visa → pre-departure → housing → arrival.

**BEST IDEA** — The **stages are named and sold as one path**, including the unglamorous end: forex,
insurance, air tickets, accommodation booking, pre-departure orientation. A separate housing product (Fly
Homes) sits underneath.

**WEAKNESS** — Breadth bought with an advisor. Almost every stage resolves to a coach, a paid tier
(accommodation booking and orientation are "Leverage One" only), or a separate product. Published material is
marketing throughout; a 2026 Morocco announcement describes an AI system "covering every stage", which is a
claim, not a feature list.

**WHAT HANGYUL SHOULD LEARN** — Students judge the whole journey. Dropping them at the offer is the single
biggest gap a study-abroad product can have, and Hangyul's arrival and visa coverage is a real differentiator.

**WHAT HANGYUL SHOULD NOT COPY** — Paywalling the end of the journey, and breadth as a feature count. The
brief's question is the opposite one: equivalent coverage with a *simpler* interface.

**HANGYUL CURRENT STATE** — Visa routes (41 routes, 14 countries), housing, arrival and concierge all exist
and all sit inside the student's five destinations.

**V13 CHANGE** — None added. V13's contribution here is subtraction, not coverage.

---

## 7. Studyportals

**TASK** — Discovery at the top of the funnel.

**BEST IDEA** — Scale and neutrality: 270K+ programmes, 3,700+ institutions, split across audience-specific
portals (Bachelorsportal, Mastersportal, Scholarshipportal), with a conversational AI advisor ("Sophia") over
the catalogue. Its revenue comes from universities, so the student side stays free and unqualified.

**WEAKNESS** — It ends at discovery. There is no application, no document, no decision.

**WHAT HANGYUL SHOULD LEARN** — Discovery should be generous, free of qualification, and free of anything
that only means something once you have a profile. This is exactly the judgement V12 made for `/universities`
and it is confirmed here.

**WHAT HANGYUL SHOULD NOT COPY** — Letting the directory become the product. The brief's Part 4 says it in
one line: directory = inspiration, platform = admission.

**HANGYUL CURRENT STATE** — 425 institutions, a map, regions, no scores, no tuition, no TOPIK filters, no
deadlines. Correct.

**V13 CHANGE** — The homepage count is a marketing scale ("200+") rather than a database figure ("218곳"), and
the directory remains the *supporting* action on every surface rather than the primary one.

---

## Others found during this research

| Product | Why it is here | Lesson |
|---|---|---|
| **Adventus.io** | B2B agent platform, 1,500+ institutions, "one form, many institutions". Reported acquired by Global Edmissions in late 2025 (single source — unverified). | Multi-institution single-form lodgement is the agent-side commodity. Hangyul cannot copy it: Korean practice requires the applicant to submit personally, which is why `AUTHORIZED_AGENCY` needs a recorded legal basis. |
| **Korean Ministry of Justice / 교육부** | Not a competitor — the regulator. The 2026-02-12 release records **181 certified (교육국제화역량 인증) universities**, up 23, with certification running 2026-03 → 2030-02, 16 universities under 비자 정밀심사, and sanctions of up to three years for poor management. FIMS is being extended with a university-facing menu. | The strongest "trust signal" available to a Korean study product is **IEQAS certification**, which Hangyul already imports and dates. Worth re-reading each year: the certified list moves, and `SURVEY_YEAR` in the importer is a constant someone must change. |
| **studyinkorea.go.kr (한국유학종합시스템)** | The government's own application system for GKS. Download a form, fill it, upload evidence. | This is the baseline experience a Korean-bound applicant is comparing us with. It is a file-transfer system, not a workflow. The bar for "better" is low and the bar for "trusted" is high. |

---

## The four questions the brief asked, answered

**IDP — how quickly can a new student get a useful answer before completing a huge profile?**
Today: `/start` returns tiers from a short profile. The problem was never the engine, it was that the
homepage sold *로그인* and *대학 둘러보기* instead of that answer. Fixed in V13.

**ApplyBoard — can Hangyul make missing or incorrect documentation even easier to understand?**
Yes, and V13 did: an essay that names the wrong university, is over the published limit, leaves part of the
prompt unanswered or contradicts the documents is now a named item on the application rather than a finding
buried in the editor (§97). This is the check ApplyBoard's published model does not appear to perform.

**Enroly — can Hangyul eliminate handoffs and duplicate records as well?**
Already does, with one honest exception that is a legal constraint rather than a design failure: the
applicant submits personally on the university's own portal, so the confirmation number returns by hand. That
gap is visible in the queue, not hidden.

**Cialfo — does Hangyul preserve one coherent student record across the entire journey?**
Yes. One `Application`, one vault, one waiting model, from the first question to enrolment.

**Leverage Edu — equivalent end-to-end support with a much simpler interface?**
Coverage: equivalent. Simplicity: five student destinations against Leverage's coach-mediated, tiered set.
V13 removed rather than added.

## Sources

- IDP FastLane: [idp.com](https://www.idp.com/fastlane-instant-course-offer/), [careers.idp.com](https://careers.idp.com/news/fastlane-service), [partners.idp.com](https://partners.idp.com/apac/solutions/international-student-recruitment/integrated)
- ApplyBoard: [Navigating Your Pending Application Requirements](https://assist.applyboard.com/hc/en-us/articles/44797287089421-Students-Navigating-Your-Pending-Application-Requirements-on-ApplyBoard), [UK financial requirements](https://assist.applyboard.com/hc/en-us/articles/42914159816845-UK-Student-Visa-Financial-Requirements-2026-2027-Guide)
- Enroly: [Apply](https://www.enroly.com/platform/apply), [CAS Shield](https://www.enroly.com/platform/cas-shield), [platform](https://www.enroly.com/platform), [The PIE News](https://thepienews.com/the-invisible-support-helping-university-admissions-teams/)
- Cialfo: [Direct Apply](https://www.cialfo.co/direct-apply), [Direct Apply FAQs](https://help.cialfo.co/en/articles/5495819-direct-apply-frequently-asked-questions-faqs), [Direct Apply Mail](https://help.cialfo.co/en/articles/12339417-direct-apply-mail)
- Leverage Edu: [Study Global](https://leverageedu.com/study-global/), [app listing](https://play.google.com/store/apps/details?id=com.leverageedu.leverageedu)
- Studyportals: [studyportals.com](https://studyportals.com/), [AI Student Advisor](https://studyportals.com/meet-ai-student-advisor/)
- Adventus: [recruiter platform](https://info.adventus.io/recruiter-platform)
- Korea: [법무부 보도자료 2026-02-12](https://www.immigration.go.kr/bbs/moj/182/490757/download.do), [교육부 표준업무처리요령](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=350&boardSeq=102851&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=0309&opType=N), [2026 GKS-G 모집요강](https://uakoreaedu.org/doc/2026%20GKS-G%20Application%20Guidelines%20(Korean).pdf)
