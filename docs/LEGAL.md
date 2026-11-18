# Legal dependencies

Product-facing dependencies on legal and owner decisions. This file contains **no legal policy and no legal advice**:
every text shown to users (terms, privacy notice, consent wording, retention periods, refund terms) remains subject to
approval by qualified counsel. "Product today" states what the code does so counsel can see exactly what is being
approved. Statute texts, vendor facts and source URLs: [`legal/V22_LEGAL_RESEARCH.md`](legal/V22_LEGAL_RESEARCH.md).
Regulatory research and provenance: [RESEARCH.md](RESEARCH.md), [`research/v9-operating-model.md`](research/v9-operating-model.md).
Privacy data map (generated from code by `npm run qa:data-map`): [`qa/v12/PRIVACY_DATA_MAP.md`](qa/v12/PRIVACY_DATA_MAP.md).

**Operating model that the legal text must describe:** Hangyul Univ itself provides the consultation, application
preparation, document review, essay review, visa-document preparation and arrival support to the student. There is no
external study-abroad agency between the student and Hangyul. The university makes the admission decision; the
immigration authority decides the visa. Hangyul never collects tuition.

Status legend: `OPEN` (no decision exists) · `CONFIG` (text exists and is accurate; owner values missing) ·
`ANNOUNCED` (a regulator announced a rule; text or effective date not final).

| # | Area | Product today | Needs decision (owner: counsel unless stated) | Status |
|---|---|---|---|---|
| L1 | **Hangyul's legal role toward universities** | Hangyul operates directly; no university agreement is recorded; a "partner" label can appear only for a verified, recorded agreement. `PartnerContract` exists as a data model only. | Whether Hangyul needs an agreement with each university to prepare/submit on a student's behalf; applicability of the **MOE standard university–agency agreement** announced 2026-09-08 (no false advertising, advance disclosure of refund rules, tuition refunded to the student's own account after visa denial; text not yet public) to Hangyul as the operator | ANNOUNCED |
| L2 | **Operator identity on admission paperwork** | Hangyul's identity is the responsible party on every case. | MOJ draft (2026-10-07): recruiting-operator details mandatory on the Certificate of Admission (H2-2026 target) and an overseas registration with Korean missions (H2-2027 target) — drafts, not law. Which identifiers Hangyul must provide | ANNOUNCED |
| L3 | **Student consent** | Append-only `ConsentRecord` with version, locale, hashed IP, user agent, source. Sign-up records [필수] 이용약관 · [필수] 개인정보 수집·이용 · [필수] 본인확인 국외 처리 고지 · [선택] 소식 수신; checkout records a versioned `PURCHASE_TERMS` consent; sharing an application with a university records `SHARE_WITH_UNIVERSITY`. | Exact wording per purpose and language; lawful basis per processing; minors and guardian consent | OPEN |
| L4 | **Submission authority** | Korean application rails require the applicant to submit personally. Product default is **guided self-submission** with evidence; staff submission on a student's behalf works only where a recorded written basis exists — no real university has one. Hangyul never stores portal passwords and never bypasses CAPTCHA/MFA. Detail: [`admissions/submission-connectors.md`](admissions/submission-connectors.md). | Whether Hangyul staff may ever submit for a student, under what written authority from the student and the university/rail | OPEN |
| L5 | **Fees, payments and refunds of Hangyul's own fee** | One-time USD plans (Basic $179 / All-in-One $349 / Premium $599) plus team-offered add-ons. Toss Payments **test mode**, foreign-card key-in on MID `bill_talkoab1`; card number and expiry are relayed to Toss and not stored. `/terms` 제9조 renders the statutory refund rights; the commercial refund schedule is `OWNER_POLICY_REQUIRED` (`shared/refund-policy.json`); upgrades are refused until an owner pricing rule exists. | Refund schedule (owner); upgrade pricing rule (owner); live Toss keys and the overseas-card/USD contract (owner/Toss — [`payments/TOSS_FOREIGN_CARD_REVIEW.md`](payments/TOSS_FOREIGN_CARD_REVIEW.md)); consumer-protection terms; 통신판매업 신고 | OPEN |
| L6 | **Privacy (PIPA)** | Documents private with signed-URL access and audited reads; passport numbers masked; deletion/export requests recorded (processing manual). `/privacy` is generated from the code's data map. | Counsel review of the notice; controller/processor roles (Hangyul / university); DPO; breach procedure; data-subject request deadlines | CONFIG |
| L7 | **Cross-border transfer** | `/privacy` publishes three processors — Twilio Programmable Messaging, Twilio SendGrid, Cloudflare Turnstile (all United States) — with the 개인정보 보호법 제28조의8② items (`apps/marketing-web/src/lib/legal/data-map.ts`); sign-up records a `CROSS_BORDER_VERIFICATION` consent. | Processor list once production storage/hosting vendors and regions are chosen; transfer mechanism for sharing with universities | OPEN |
| L8 | **Retention** | Retention engine implemented; every period is `OWNER_COUNSEL_REQUIRED`, so nothing is deleted automatically. | Retention schedule per record type, triggers, legal holds | OPEN |
| L9 | **Parent / sponsor access** | Student-initiated, read-only, expiring, revocable link; never shows messages, essays, notes or files; every view audited. | Whether the sponsor needs their own notice/consent; minors | OPEN |
| L10 | **University refund rules** | A visa refusal after tuition opens a refund service case pointing to the university's rule and the own-account rule; no university refund ladder is stored. | How university refund rules are recorded and sourced | OPEN |
| L11 | **Marketing claims** | No admission probability, percentage, ranking or "guaranteed admission"; copy says what Hangyul does. "Verified" means read from the official source on a stated date. | Review of public claims against advertising rules | OPEN |
| L12 | **Legal pages and company identity** | `/privacy` (10 sections) and `/terms` (14 articles) are derived from the code. A section whose company fields are unset is omitted, never rendered with a placeholder. | The ten fields in `apps/marketing-web/src/lib/legal/entity.ts`: legal name with corporate form, 대표자, 사업자등록번호, address, privacy officer name and email, 공고일, 시행일, governing law, jurisdiction. Until set, the legal pages **may not be declared production-ready** (`npm run qa:legal` reports the gap). | CONFIG |
| L13 | **Image and data licences** | Two-tier media rule ([BRAND_AND_MEDIA.md](BRAND_AND_MEDIA.md), record in [`media/LICENSE_AUDIT.md`](media/LICENSE_AUDIT.md)). University crests are owner-authorised. | Permission to publish university marks; commissioned or university-supplied photography for the 259 institutions without an own photograph | OPEN |
| L14 | **Malware-scanning claim** | Privacy §8 says uploads are scanned before review. Code: upload → PENDING → clamd scan; production refuses to start with the no-op scanner. | A ClamAV host in the production deployment so the published sentence is true of the deployment | OPEN (infrastructure) |
| L15 | **Directory source licensing** | The public directory is built from 대학알리미 public-disclosure data, Study in Korea IEQAS lists, Wikidata and KOSTAT boundaries ("free to share or remix"). GADM (non-commercial) is not used. | Confirm terms for bulk commercial reuse of 대학알리미 and Study in Korea content | OPEN |
| L16 | **Design Preview mode** | A build-flagged, synthetic-fixture, read-only preview (see [SECURITY.md](SECURITY.md)). It shows no real personal data and takes no payment. | None, provided the flag is off in public production builds (release gate) | — |

**What engineering will not do without these decisions:** publish a university as a partner, take live payments, state
retention periods, present a consent as final, submit on a student's behalf, or label any translation human-reviewed.

## Historical naming note

Earlier versions of this file (L1–L4 as of V9–V29) described a partner study-abroad agency as a separate legal party
(`SHARE_WITH_AGENCY` consent, `AGENCY_*` roles, "agency submission authority"). That operating model is retired. The
identifiers remain in code as internal names for Hangyul's own operations team; see [ARCHITECTURE.md](ARCHITECTURE.md).
