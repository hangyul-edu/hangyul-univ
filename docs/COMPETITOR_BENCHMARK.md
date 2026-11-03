# V10 benchmark (2026-10-16)

**Research date:** 2026-10-16. **Builds on:** the V9 operating-model research (`docs/research/v9-operating-model.md`)
and the V8/V6/V5 sections below, all kept unchanged.
**Focus of this pass:** *visual and conversion* benchmarking of two references the owner named, in a real browser
at five widths, rather than the task-level and workflow benchmarking of V8–V9. Full scoring, evidence and the
"what we deliberately did not copy" list: **`docs/qa/v10/COMPETITIVE_UI_AUDIT.md`**. Screenshots:
`docs/qa/v10/koreanasha-original/`, `koreanasha-live/`, `benchmark/`.

## References

| Ref | What | Evidence |
|---|---|---|
| **Koreanasha** | `template-koreanasha/` (owner-supplied) and <https://univ.talkhangyul.com/> — **verified to be the same build**: identical page height at all five widths, identical title and markup | 5 widths each, plus a second pass with scroll-reveal forced on, because AOS leaves every section at `opacity: 0` until a CDN answers |
| **V-Education** | <https://www.v-education.com/kr> — a Korea-focused study-abroad agency serving the CIS market | 5 widths + full text extraction of the Korean page |

## The measurement that matters

| Home | Koreanasha | V-Education | Hangyul V9 |
|---|---|---|---|
| Height @1440 / @390 | 9.9 / 15.2 screens | 13.6 / **24.9** | **6.7 / 7.4** |
| `<h1>` | **0** | 1 | 1 |
| Loaded CSS+JS | ≈1.5 MB | heavy (Instagram embeds, video) | 143 KB JS gzip |
| Languages | 2 | 3 | 55 |

Hangyul already won every measurable. It lost on what the numbers do not measure: **the first two seconds**, and
**naming what you actually get**.

## What each does better, and the problem underneath

| They communicate better | The real problem | How V10 answers it |
|---|---|---|
| **Koreanasha: the page opens as a photograph** — full viewport, three hand-made crops, chrome floating as a white pill | The decision to care is made in two seconds and it is emotional | The technique is adopted wholesale (REPORT §65, §69.1) with a Korean campus at golden hour |
| **V-Education: services are nouns** — 공항 픽업, 숙소 지원, 자기소개서 작성, 통번역 | "Complete support" carries no information; V9's home never named a service | Four photographed service rows written to the brief's rule ("See exactly which visa documents your consulate asks for", not "visa assistance") |
| **V-Education: a FREE-vs-PREMIUM comparison table, 14 rows** | "What do I get and what does it cost" is the second question every student asks | The pattern is kept on the Services page; our prices stay `is_demo`-flagged with no invented discount |
| **V-Education: a numbered six-step process** | "What happens after I contact you?" | The journey section is kept and moved up |
| **Both: human presence** (team photos, named curators, Instagram) | Nobody hands a passport to a logo | Hangyul has no staff photography and **will not invent an employee**, so this is answered with evidence of a human (the reviewer comment, "a person checks your work") and left open as a business dependency |
| **V-Education: company identity in the footer** (business ID, address, two phones) | Korean buyers check 사업자등록번호 | The footer shape exists and is **empty** until Hangyul supplies real details |

## Explicitly not copied

V-Education's four unsourced success claims (98 % 합격, 1,000명 이상, 8년 경력, 높은 합격률) · its six testimonials ·
"자기소개서 작성" (writing the statement *for* the student — directly against our authorship rule) · partner-logo and
university-crest walls · Koreanasha's invented urgency ("42 % OFF", "최대 할인", "BEST" over struck-through prices) ·
the 20-field public application modal · Instagram Reels embeds. Reasons per item:
`docs/qa/v10/COMPETITIVE_UI_AUDIT.md` §5.

## One-line verdict

Koreanasha wins the first two seconds. V-Education wins the next thirty. Hangyul wins everything after that and
is the only honest one of the three — but a student had to get past a dark photograph and a form card to find
out. V10 = Koreanasha's opening, V-Education's concreteness, Hangyul's substance.

---

# V8 benchmark (2026-10-09)

**Research date:** 2026-10-09. All sources were accessed on this date unless marked. **Builds on:** V6 (2026-10-01) and V5 (2026-09-29), both kept unchanged below.
**Focus of this pass:** task-level evaluation. For each reference we asked "what does a real user do here, and how well does it go?". We also added the categories V6 did not cover: admissions CRMs and agency CRMs (reviewer workflows, saved views, bulk actions), visa and relocation services, and interaction-principle benchmarks from fintech, travel and professional SaaS.

## Method

- **Fresh web research only:** WebSearch and WebFetch, plus `pdftotext` for one university guide. No logged-in flows were used, so every evaluation covers the public pages only and says so. No browsers or dev servers were run.
- **Source tags:** `[Tn]` refers to the V8 sources list at the end of this section. V6 tags `[Sx]` are used only where we re-checked a V6 source.
- **Evidence labels:**
  - *Excerpt*: taken from a search-result excerpt, because the page itself could not be read.
  - *Vendor claim*: a number or capability stated by the provider and not verified by us.
  - *Inaccessible*: the fetch failed (404, 403, JS-only or DNS error).
- **Fields for each entry:**
  - **URL**
  - **Task evaluated**: the concrete job we tried to complete with public material.
  - **Does well / Does poorly**
  - **Learn**: what Hangyul should learn.
  - **Don't copy**: what Hangyul should not copy.

  Dark patterns are flagged with ⚠.
- **Limits:**
  - We used no user reviews or forums, so nothing here measures satisfaction.
  - Logged-in UIs (ApplyBoard partner portal, Slate, Element451, Agentcis, IDP Live) are known only from public documentation.

## Key findings (what changed since V6)

1. **The government portal went "always on" but still stops at information.** Study in Korea now has a permanent online hub (announced 2026-04-14) with language, English-track, vocational and local-government sections, replacing the ~10-day fairs [T2].
   - The portal has university, program and scholarship search with a "language of instruction" filter [T1].
   - It still has no eligibility checker and no per-student state. The "find a major or university" card on *Plan your studies* is a placeholder link [T3].
2. **Official cost facts are stale and internally inconsistent.**
   - Study in Korea's cost page was last updated 2024-09-24. It gives a monthly total of KRW 750k–1M, but its own line items (housing 500–700k, food 200–300k, transport 50–100k, other 100–200k) add up to 850k–1.3M (*excerpt* [T4]).
   - A third-party blog lists Yonsei's international fee as KRW 200,000. Yonsei's own Fall 2026 guide says KRW 150,000 [T5][T6].
   - The bar is a dated, sourced, arithmetically consistent cost model.
3. **The Yonsei undergraduate path runs on JinhakApply, not UWAY, and payment still locks the application** [T5]. The guide's steps:
   - Apply online at `apply.jinhakapply.com`.
   - Pay the fee "to receive an application number". After this, the application "cannot be modified or canceled".
   - Print the form and post the documents.

   The refund carve-out excludes "the admission agent's service fee", meaning the rail operator's fee [T5]. This confirms V6's "pre-payment preflight" principle on a second rail.
4. **"No TOPIK" has a real, documented path, but the condition comes later.** Yonsei's Global Leadership / Global Basic Education Division accepts English proof at entry [T5]. It then requires:
   - TOPIK 3 before declaring a major.
   - TOPIK 4 before graduation.
   - Separate division tuition in the meantime.

   No discovery tool we tested shows this downstream condition on the program card [T1][T10][T15].
5. **Spring 2027 windows are short, staggered and partly closed already.** Examples: Yonsei Sept 1–17, Ewha Sept 2–Oct 8, KAIST Sept 22–Oct 22, KNU Oct 12–30, Kyung Hee round 2 Oct 26–Nov 6 [T7]. The same news article gives conflicting result dates for Chung-Ang and HUFS in its table and its text [T7]. Deadline data needs a source and a `verified_at` per row, not a news roundup.
6. **The new Korea-specific entrants are content, AI matching or peer marketing, not end-to-end.**
   - Korea Times *K-universities* (2026-06-30): rankings, news and guidance, with no search or application [T8].
   - *GoStudy AI* app: AI matching, "estimated scholarship rates" and a "non-binding" pre-application to four partner universities. Third-party listing only (*excerpt* [T10]).
   - *UpperClass* (2026-09-26): student-ambassador creator networks sold to universities [T11].
   - Welko is still JS-only and unreadable [T12].

   Nobody publishes student-visible case status across visa and arrival.
7. **The global marketplaces moved into chat assistants.**
   - ApplyBoard integrated with ChatGPT (2026-06-10), with no stated guardrails [T13].
   - Edvoy shows an "Edvoy on ChatGPT" link [T16].

   ⚠ ApplyBoard's homepage headlines an unexplained **"95% success rate"**, and its counts are inconsistent across sections (150,000+ vs 140,000+ programs; 1.5M+ vs 1M+ students) [T12a].
8. **AI authorship is now a mainstream marketplace feature, and it conflicts with Korean rules.** ApplyBoard's partner tools include an "SoP Letter Generator" that "generate[s] statements that target program requirements" [T14]. Korean guides require applicant-only authorship (V6 [S5][S9]). Hangyul must not follow this.
9. **The eligibility pattern to beat is IDP FastLane.** The student enters a short profile with no documents, sees matched courses, and gets an "Offer in Principle", reportedly within 30 minutes. The OIP:
   - is explicitly non-binding;
   - expires after 30 days without verification;
   - is cancelled if the real documents don't match the profile (*excerpt* of IDP pages and partner terms [T17]).

   The public FastLane page itself omits the non-binding disclaimer and says "Higher chances of acceptance" [T17a].
10. **Reviewer tooling in university CRMs follows the same model everywhere.** Slate Reader has:
    - Bins for stages; an application sits in exactly one bin.
    - Queues as personal to-do lists; an application can be in many queues.
    - Review forms that move the record to the next bin [T19].
    - Bin settings for checkout mode, blind read (hide previous reviewers) and anonymous read (hide names) (*excerpt* [T20]).

    Salesforce lists an "Admissions Console", "Actionable Lists", "Application Scoring" and a "Document Checklist" [T22].
11. **AI first-pass scoring and fraud flags are shipping in admissions CRMs.**
    - Element451's Bolt "App Reader" scores applications against institution criteria.
    - Its Fraud Detector labels applications Low, Medium or High risk "with detailed reasoning".
    - A Socure-backed fraud product was announced 2026-09-29, with the final decision "remain[ing] with staff" (*excerpt / vendor* [T21]).

    The useful bar is "a flag with reasons and a human decision", not auto-reject.
12. **Agency CRMs are commodity pipelines.**
    - Agentcis: application stages, a partner (university) register, a client portal "to check application status", quotations, and dashboards in beta [T23].
    - Meritto: lead scoring, WhatsApp follow-ups, dashboards. ⚠ Unsourced "#1" and "1 billion engagements" claims [T24].
    - ApplyBoard partners: "Commission Visibility" per application, comparison of up to 24 programs, and status with "estimated processing times" [T14].

    None of them models Korean rules: applicant-only submission, apostille, the visa CoA, or the MOE standard agreement.
13. **Visa and stay administration became a priced, productised service in Korea.** HigherVisa (Higher Diversity) handles residence-card and stay filings and is adopted by ~100 universities (*vendor*, 2025 [T25]). JBNU's notice (modified 2026-09-01) shows exactly what the student pays [T26]:
    - KRW 65,000 through HigherVisa vs KRW 50,000 directly on HiKorea.
    - 5 UI languages, document review, "real-time status updates via email".
    - But the same notice's Chinese version disagrees with the English and Korean versions on eligibility dates, and the Korean version gives a different deadline (14 days vs 7) [T26].
14. **Global visa and housing benchmarks show the fee-display bar and the dark patterns.**
    - VisaHQ splits every price into "embassy" plus "service" fee (e.g. ETA $9 + $59). It lists no D-2 service [T27].
    - ⚠ Boundless advertises a "99.7% success rate" and "guaranteed success" next to a "past results do not guarantee" disclaimer [T28].
    - University Living has a "No Visa No Pay" refund [T29]. Amber has a "Lowest Price Guarantee" and "From £429/week" price units [T30].
    - Neither covers Korea [T29][T30].
15. **Arrival transport is bookable but fragmented.**
    - Trazy sells an Incheon→university private van for 10 named Seoul universities. It requires a flight number, refunds in full only up to 2 days before, and is non-refundable after. Its two waiting-fee rules contradict each other (20,000 KRW per 30 min vs 15,000 KRW per hour), and the page has a single review [T31].
    - KU runs free-or-unstated shuttles only for summer and winter programs [T32].

## Per-category entries

### 1. Korean inbound: portal, universities, rails, Korea-focused platforms

**1.1 Study in Korea (NIIED) – search and planning**
- **URL:** https://www.studyinkorea.go.kr/en/main.do [T1]; https://www.studyinkorea.go.kr/en/plan/main.do [T3]
- **Task evaluated:** find a bachelor's program as a Nepali student with no TOPIK, then estimate the cost.
- **Does well:**
  - About 30 UI languages.
  - Search in four categories: university, program, scholarship, content.
  - University filters: level, location, type. Program filters: name, field, **language of instruction**.
  - Degree counters on the homepage.
  - The Kori chatbot has separate ratings for the AI and the human consultant [T1].
- **Does poorly:**
  - No eligibility checker; it only says to "review entry requirements" [T1].
  - On *Plan your studies*, the "find a major or university" card and the guidebook are placeholder links [T3].
  - The cost section gives no figures on the hub [T3]. The cost page is dated 2024-09-24 and its total does not match its own breakdown (*excerpt* [T4]).
- **Learn:** language-of-instruction as a first-class filter; separate feedback on AI vs human help; per-university fact downloads (contact, scholarship, language, dorm) [T1].
- **Don't copy:** undated cost ranges whose parts don't add up; dead cards on the planning hub.

**1.2 Study in Korea permanent online hub (announced 2026-04-14)**
- **URL:** https://asianews.network/south-korea-rolls-out-one-stop-site-for-study-visas-and-jobs/ [T2]
- **Task evaluated:** can a student go from information to application status in one place?
- **Does well:** year-round content in four sections, incl. "region-specific visa schemes" and post-graduation settlement [T2].
- **Does poorly:** no mention of application submission or status tracking. We could not confirm a go-live date [T2].
- **Learn:** regional visa and settlement schemes are now part of the official discovery narrative. Hangyul's discovery should show them for regional universities.
- **Don't copy:** an "end-to-end" framing without per-student state.

**1.3 Yonsei University – Fall 2026 international undergraduate guide (most recent official guide found)**
- **URL:** https://www2.yonsei.ac.kr/entrance/2026/intl/2026_9_docu/Fall%202026%20Application%20Guide%20for%20International%20Students(Eng).pdf [T5]. The admissions portal URL we tried returned 404.
- **Task evaluated:**
  - Can a student without TOPIK apply?
  - What locks at payment?
  - Which documents need an apostille?
- **Does well:**
  - Clear 6-step flow: link → read guide → fill in → pay for an application number → print and post → check results.
  - Apostille vs consular legalisation explained, with a member list "as of 2025.3.30".
  - China-specific CHSI and vocational-school verification table.
  - Language proof may be "Korean or English", "Choose ONE" [T5].
- **Does poorly:**
  - Payment is irreversible ("cannot be modified or canceled"); there is a refund only for institutional failure, excluding the agent's service fee.
  - The Personal Statement must be typed into the rail and cannot change after the deadline.
  - Paper copies are still posted.
  - The downstream TOPIK 3 / TOPIK 4 conditions sit in a later section (§Global Basic Education Division notes) [T5].
- **Learn:**
  - Show "conditions after admission" (TOPIK 3 to declare a major, TOPIK 4 to graduate, division tuition) **on the program card**, not just entry requirements.
  - Model the per-country document matrix as data.
- **Don't copy:** burying post-admission conditions; a refund clause in legal prose.

**1.4 Spring 2027 cycle roundup (Korea JoongAng Daily, 2026-09-07)**
- **URL:** https://www.koreajoongangdaily.com/korea/korean-universities-open-spring-2027-admissions-for-international-students/12863631 [T7]
- **Task evaluated:** "Which universities can I still apply to for Spring 2027?" (as of 2026-10-09).
- **Does well:** one table across 12 universities and tracks, with interview and test dates; Ewha's conditional TOPIK 4 admission explained [T7].
- **Does poorly:**
  - Table and text disagree: Chung-Ang result Oct 30 vs Dec 18; HUFS round 2 Dec 19 vs Jan 4 [T7].
  - No fees, no links to official guides.
- **Learn:** an "open now / closes in N days / closed" deadline view across universities is valuable, *if* every row cites the official guide.
- **Don't copy:** unsourced aggregate tables.

**1.5 SKKU international admissions**
- **URL:** https://admission-global.skku.edu/ [T5a]
- **Task evaluated:** find the Spring 2027 undergraduate guide.
- **Result:** *Inaccessible.* The page returned empty content. Search excerpts point to an annual "Admission Guide for International Students" and a ≥20% freshman tuition waiver, but the department pages carrying these are dated 2020 (*excerpt* [T5a]).
- **Learn:** many university pages fail for non-browser clients and show old fees. Hangyul's fact store must record `source_url`, `fetched_at` and `cycle`.
- **Don't copy:** publishing scholarship percentages without the cycle year.

**1.6 Welko (re-check)**
- **URL:** https://www.welko.kr/?lang=en [T12]
- **Task evaluated:** discovery → submit → track.
- **Result:** still JS-only. Only the title "Korean University Admission Platform for International Students" is readable [T12]. No change from V6, and the submission mechanics remain unverifiable.
- **Learn / Don't copy:** server-render public discovery pages so they can be read without JavaScript, which helps SEO and low-bandwidth users in Nepal and Myanmar.

**1.7 GoStudy AI (app)**
- **URL:** https://chrome-stats.com/d/com.gostudy.ai (403; *excerpt only* [T10])
- **Task evaluated:** match to programs with TOPIK/IELTS scores and estimate a scholarship.
- **Does well (claimed):**
  - Matching on "language scores (TOPIK, TOEFL, IELTS)" across "100+ Korean universities".
  - Explains why each school fits.
  - Chat in EN/KO/ID/VI/ZH.
  - Document storage.
  - A pre-application to Sungshin, Dankook, Kookmin and Ajou [T10].
- **Does poorly:**
  - "Estimated scholarship rates" with no method.
  - The "non-binding expression of interest" is not tied to the official rail.
  - Developer identity not confirmed [T10].
- **Learn:** "why this fits" explanations; multilingual chat including Indonesian and Vietnamese.
- ⚠ **Don't copy:** scholarship estimates with no stated basis; "pre-apply" wording that a student may mistake for an application.

**1.8 Korea Times K-universities (2026-06-30)**
- **URL:** https://www.koreatimes.co.kr/southkorea/society/20260630/the-korea-times-launches-k-universities-global-platform-for-korean-higher-education [T8]
- **Task evaluated:** compare universities.
- **Does well:** ranking methodology published; rankings include international enrolment, employment rate and scholarship opportunities [T8].
- **Does poorly:** no search, eligibility or application; profiles are only "planned" [T8].
- **Learn:** if Hangyul shows any ranking, show the methodology and the indicators it uses.
- **Don't copy:** a ranking as the primary discovery axis.

**1.9 UpperClass (2026-09-26) and Sejong ISF (2026-03)**
- **URL:** https://www.koreatimes.co.kr/southkorea/globalcommunity/20260926/upperclass-bets-on-peer-trust-to-reshape-international-student-recruitment [T11]; https://biz.newdaily.co.kr/site/data/html/2026/03/10/2026031000409.html [T11a]
- **Task evaluated:** how universities reach students, from the university-console angle.
- **Does well:**
  - UpperClass: campaign briefs, brand guidelines and lead tracking; it rewards student creators with points that can become tuition discounts. "Gen Z prospective students can smell an ad coming from a mile away" [T11].
  - Sejong ISF links recruitment to jobs and settlement [T11a].
- **Does poorly:**
  - UpperClass is piloting in Canada, with Korea not yet live.
  - Paid peer promotion risks undisclosed advertising [T11].
- **Learn:** peer and alumni voices build trust. Hangyul could show verified current-student Q&A per university.
- ⚠ **Don't copy:** incentivised student posts without a clear "sponsored" label (also relevant to MOE's ban on exaggerated advertising [T33]).

### 2. International education marketplaces

**2.1 ApplyBoard – student homepage**
- **URL:** https://www.applyboard.com/ [T12a]
- **Task evaluated:** find a program and understand my odds.
- **Does well:** a single account for multiple applications; "360 Solutions" (test vouchers, payments, loans) [T12a].
- **Does poorly:**
  - ⚠ "95% success rate" with no definition.
  - Inconsistent counts on the same page.
  - No visible eligibility or tracking explanation for students.
  - No Korea [T12a].
- **Learn:** one account across many applications, with ancillary services attached at the moment they are needed.
- **Don't copy:** headline success rates; inconsistent vanity numbers.

**2.2 ApplyBoard – "What's new" (partner features)**
- **URL:** https://www.applyboard.com/whats-new [T14]
- **Task evaluated:** track 50 applications as an agency counsellor.
- **Does well:**
  - Redesigned Application Tracking with "status at a glance" and **"estimated processing times"** (all partners since April 2025).
  - An application page header and sidebar that holds the key actions ("Manage application").
  - Compare up to 24 programs.
  - Mobile requirement review.
  - Per-application commission, payment history and instalments [T14].
- **Does poorly:**
  - No bulk actions are described.
  - ⚠ "SoP Letter Generator" for AI authorship.
  - AI interview practice [T14].
- **Learn:**
  - Expected-duration hints per status.
  - A record header with the primary actions in one place.
  - Large side-by-side comparison.
  - Agency money visibility per case.
- **Don't copy:** AI-drafted statements of purpose; "Instant Offer" same-day conversion pressure.

**2.3 ApplyBoard × ChatGPT (2026-06-10)**
- **URL:** https://www.einpresswire.com/article/918700740 [T13]
- **Task evaluated:** discover programs via a chat assistant.
- **Does well:** meets students where they already are; cites student AI use for university selection rising "from 4% in 2023 to 23% in 2025" (Carnegie, via release) [T13].
- **Does poorly:** no data-handling or accuracy guardrails described [T13].
- **Learn:** expose Hangyul's public, sourced facts in a machine-readable way so third-party assistants quote correct deadlines and fees.
- **Don't copy:** shipping chat discovery without stating which facts are authoritative.

**2.4 IDP FastLane**
- **URL:** https://www.idp.com/fastlane-instant-course-offer/ [T17a]; how-it-works blog and partner terms (*excerpt* [T17])
- **Task evaluated:** "Am I eligible?" without uploading documents.
- **Does well:**
  - 4 steps: register (no documents) → browse matches → choose → eligibility decision. "Check if you are eligible to apply within minutes" [T17a].
  - The OIP is non-binding and expires in 30 days without verification; it is cancelled on mismatch; the counsellor is alerted automatically (*excerpt* [T17]).
- **Does poorly:**
  - The public page says "Higher chances of acceptance" and does not show the non-binding caveat [T17a].
  - Speed claims ("six times faster") are IDP's own [T17].
  - Covers AU/UK/CA/US/NZ/IE only.
- **Learn:** a document-free self-check that returns a *labelled* result ("likely eligible – not an offer"), plus automatic counsellor hand-off.
- **Don't copy:** hiding the caveat from the landing page; "higher chances" copy.

**2.5 Studyportals / Bachelorsportal (Korea search)**
- **URL:** https://www.bachelorsportal.com/search/bachelor/south-korea [T15]; https://www.studyportals.com/ [T15a]
- **Task evaluated:** list English-taught bachelor's programs in Korea with cost.
- **Does well:**
  - 245 results (13 pages).
  - Cards show university, rating, ranking badge, degree and attendance, duration, and **tuition per year in KRW** (e.g. "₩2,998,000/yr").
  - Filters for tuition, duration, format, etc. [T15].
- **Does poorly:**
  - No language-requirement or IELTS/TOPIK filter; no deadlines on cards [T15].
  - Search excerpts show USD fees that may be years old (*excerpt*).
- **Learn:** the card density standard (cost unit plus duration on the card), and currency on the sort control.
- **Don't copy:** ranking badges ("Top 1% in Worldwide") as a trust signal; cards without deadlines or language conditions.

**2.6 Edvoy**
- **URL:** https://www.edvoy.com/ [T16]
- **Task evaluated:** find courses and see student costs.
- **Does well:** loans with "Zero service charge" and an interest rate stated "from 9.25%" [T16].
- **Does poorly:**
  - No Korea.
  - The search box has no visible filters.
  - Unverified "Rated 4.7" and "100K+ students counselled" [T16].
- **Learn:** state the money terms (rate, fee) on the first screen.
- **Don't copy:** unsourced ratings.

**2.7 Leverage Edu (re-check)**
- **URL:** https://leverageedu.com/ [T18]
- **Task evaluated:** check eligibility and understand fees.
- **Does well:** a named AI stack: Program Finder, Document Intelligence, Coach [T18].
- **Does poorly:**
  - ⚠ Urgency framing: "One-Day Application Submission, One-Week Offer, One-Month Payout".
  - "Trending" tags.
  - "Smart Assessment (Interviewer): AI credibility scoring".
  - No fees disclosed, only "Book Free Consultation".
  - No Korea [T18].
- **Learn:** document validation before submission.
- **Don't copy:** speed guarantees, AI credibility scoring of students, hidden service fees.

**2.8 Uni2Study**
- **URL:** https://www.uni2study.com/ [T18a]
- **Task evaluated:** browse Korean universities.
- **Does well:** favourites, recently viewed and compare in a dashboard; score calculators [T18a].
- **Does poorly:** generic country browsing; no named legal entity [T18a]; its Korea visa articles conflict with other sources (*excerpt*).
- **Learn:** compare and favourites as standard discovery affordances.
- **Don't copy:** anonymous operator.

### 3. Admissions CRMs and agency CRMs

**3.1 Slate (Technolutions) – Reader**
- **URL:** https://knowledge.technolutions.net/docs/reader-overview.md [T19]; legacy bins (*excerpt*) https://knowledge.technolutions.net/docs/reader-bins-legacy [T20]; university tutorials (*excerpt*) [T20a]
- **Task evaluated:** a university reviewer clears a queue of 40 applications.
- **Does well:**
  - Left menu: Home, Browse, Search, Queue, Recent, Classify.
  - Bins = stages ("New/Unreviewed … Ready for Decision … Completed"); Browse shows record counts per bin.
  - Queues = personal assignments.
  - "Review Form / Send to Bin" submits the evaluation and advances the record in one action.
  - "+5 / −5" pulls random records into the queue.
  - "Build Query" sends filtered results to batch tools [T19].
  - Bin settings: checkout mode, blind read, anonymous read (*excerpt* [T20]).
- **Does poorly:**
  - The marketing page is vague [T19a].
  - Institutional tutorials show heavy configuration and role confusion; e.g. a "program reader" can view a bin but cannot submit a review (*excerpt* [T20a]).
- **Learn:**
  - Separate *stage* (one per application) from *assignment* (many).
  - "Submit review and move to next stage" as one action.
  - Optional blind and anonymous read for fairness.
  - Counts per stage as the home view.
- **Don't copy:** configuration-heavy setup that needs a consultant; roles a reviewer can't understand.

**3.2 Element451 – Bolt agents**
- **URL:** https://element451.com/ [T21a]; help articles (*excerpt*) https://help.element451.io/en/articles/11101486-using-bolt-ai-to-support-decisions [T21]
- **Task evaluated:** triage applications for fraud and completeness.
- **Does well:**
  - Fraud flags Low/Medium/High with "detailed reasoning".
  - Separate permissions to view vs change fraud status.
  - The Transcript Evaluation agent links back to the "original document for transparency".
  - Staff keep the final decision [T21].
- **Does poorly:**
  - App Reader "scoring" with no published validation.
  - Premium usage billing.
  - The decision-support article omits override and audit details [T21].
- **Learn:** every automated flag carries reasons and a link to the source document; permissions to view vs change a flag; the human decides.
- **Don't copy:** opaque AI scoring of applicants.

**3.3 Salesforce Education Cloud (FY27 Q2 datasheet)**
- **URL:** https://www.salesforce.com/en-us/wp-content/uploads/sites/4/migrated-forms/industries/education/FY27-Q2-Education-Cloud-for-Recruitment-Admissions-Datasheet.pdf [T22]
- **Task evaluated:** what does a university admissions home screen offer?
- **Does well:** a named capability list:
  - "Admissions Console … one, actionable homepage"
  - "Actionable Lists"
  - "Alert Framework"
  - "Application View, Edit & Submit" ("view and edit their application at any stage")
  - "Application Scoring"
  - "Document Checklist"
  - "Dynamic Applications … see where applicants are getting stuck" [T22]
- **Does poorly:**
  - ⚠ "86% Faster Decision Making" attributed only to "Salesforce Customer Success Metrics".
  - Some features marked "coming soon" (*excerpt*) [T22].
- **Learn:** "where applicants get stuck" analytics (step drop-off) as a university-console drill-down; a document checklist per applicant.
- **Don't copy:** unattributed percentage claims.

**3.4 Agentcis (agency CRM)**
- **URL:** https://www.agentcis.com/ [T23]
- **Task evaluated:** manage a caseload of hundreds of students across universities.
- **Does well:**
  - Contact journey tracking and application stages.
  - Partner (university) management.
  - A client portal to check application status, plus a mobile app.
  - Quotations by selected services.
  - Business summary e-mails [T23].
- **Does poorly:**
  - Custom dashboard is still beta.
  - No public pricing.
  - Thin third-party evidence (Capterra 3.0/5 from 2 users, *excerpt*) [T23].
- **Learn:** quotes generated from the services chosen (a transparent agency fee); a client status portal as table stakes.
- **Don't copy:** opaque pricing.

**3.5 Meritto (agency CRM)**
- **URL:** https://www.meritto.com/blog/heres-the-1-study-abroad-software-for-agents-consultancies/ (2025-09-03) [T24]
- **Task evaluated:** follow up with leads and track documents.
- **Does well:** WhatsApp, SMS and e-mail follow-ups; document verification status notifications; dashboards by agent [T24].
- **Does poorly:**
  - ⚠ "#1" title with no source.
  - "1 billion student engagements" unsourced.
  - No pipelines or bulk actions described [T24].
- **Learn:** messaging hand-offs (WhatsApp, Zalo, Kakao) that write back to the record.
- **Don't copy:** unsourced superlatives.

### 4. Visa support and relocation

**4.1 HigherVisa (하이어비자) – stay administration in Korea**
- **URL:** https://www.mt.co.kr/future/2025/04/05/2025040415324526851 [T25]; JBNU notice (modified 2026-09-01) https://ioffice.jbnu.ac.kr/bbs/ioffice/3549/381576/artclView.do [T26]
- **Task evaluated:** extend a D-2 stay as a student who doesn't read Korean.
- **Does well:**
  - The university notice shows the fee next to the do-it-yourself price (KRW 65,000 vs 50,000 on HiKorea).
  - 5 languages; document review; "Real-time status updates via email"; mobile photo upload [T26].
  - Vendor claims: ~80 services, ~100 partner universities, residence-card issuance cut from ~8 to ~4 weeks (*vendor*, 2025 [T25]).
- **Does poorly:**
  - The notice's language versions disagree on the eligibility date and the deadline (7 vs 14 days) [T26].
  - "80% of foreign students in Seoul use it" is a vendor claim [T25].
- **Learn:**
  - Always show "do it yourself for X, or with help for Y" side by side.
  - Status by e-mail plus in-app.
  - Keep one source text and generate the translations from it.
- **Don't copy:** translations that drift from the source.

**4.2 VisaHQ – South Korea**
- **URL:** https://www.visahq.com/south-korea/ [T27]
- **Task evaluated:** see what a D-2 student visa costs through a service.
- **Does well:** every option splits "embassy fee" and "service fee", with processing days [T27].
- **Does poorly:**
  - No D-2 service.
  - ⚠ Sells the K-ETA (a government e-service) with a $59–$89 service fee on top of $9.
  - The visa-free text may be stale [T27].
- **Learn:** the two-part fee display.
- **Don't copy:** reselling a simple government e-form at a large markup without saying the student can file directly.

**4.3 Boundless (US immigration)**
- **URL:** https://www.boundless.com/ [T28]
- **Task evaluated:** understand the price and what is reviewed.
- **Does well:** describes QA as "four different reviews" incl. a Document Review Specialist; separate paper vs online filing prices [T28].
- **Does poorly:**
  - ⚠ "99.7% Success rate" with no definition.
  - ⚠ "guaranteed success" contradicting its own disclaimer.
  - Unclear whether government fees are included [T28].
- **Learn:** name the review steps a document goes through.
- **Don't copy:** success rates or guarantees on visa outcomes (also barred in spirit by MOE advertising rules [T33]).

**4.4 University Living / Amber (global student housing)**
- **URL:** https://www.universityliving.com/ [T29]; https://amberstudent.com/ [T30]
- **Task evaluated:** book housing before the visa, with refund protection.
- **Does well:**
  - University Living: "No Visa No Pay" ("rejected or delayed, then your money will be refunded by us"); compare list; advice to book 3–6 months ahead [T29].
  - Amber: price with unit and currency ("From £429/week"); "Lowest Price Guarantee"; "Verified Properties" [T30].
- **Does poorly:**
  - No Korea on either.
  - University Living gives no deposit amount or cancellation window.
  - "100% verified" is undefined [T29][T30].
- **Learn:** a visa-refusal refund promise as a headline term; price unit always visible.
- **Don't copy:** "100% verified" without saying what was verified.

**4.5 Enkostay (re-check)**
- **URL:** https://stay.enko.kr/blog/en/koreas-traditional-rental-market-vs-foreigner-friendly-housing-platforms-whats-the-difference/ (2026-06-30) [T34]
- **Task evaluated:** find out fees, escrow and visa-refusal terms.
- **Does well:**
  - The process is fully in English.
  - Escrow until move-in; minimum stay 14 days (*excerpt*) [T34].
- **Does poorly:**
  - The fetched article states no fees, cancellation or visa-refusal terms.
  - "Verified Seoul housing" appears only as an image caption [T34].
- **Learn / Don't copy:** unchanged from V6. Show the terms before any hand-off.

**4.6 Trazy – Incheon → university private van**
- **URL:** https://www.trazy.com/experience/detail/incheon-airport-transfer-university-seoul [T31]
- **Task evaluated:** book a pickup on arrival day.
- **Does well:**
  - 10 named universities; meet-and-greet with a name sign.
  - Luggage limits stated ("4 passengers / 10 bags max").
  - Flight number required for tracking.
  - Explicit cutoff (4pm KST the day before).
  - Practical tip: "meet your driver first before you pick up a sim card" [T31].
- **Does poorly:**
  - Price fields blank in the fetched page.
  - Contradictory waiting fees.
  - Non-refundable within 1 day.
  - Changes by e-mail only; 1 review [T31].
- **Learn:** capture the flight number once and reuse it for pickup, housing check-in and orientation; state luggage limits.
- **Don't copy:** e-mail-only changes; inconsistent fee rules.

**4.7 Korea University ISC shuttle (summer 2026)**
- **URL:** https://isc.korea.ac.kr/noticecontacts/notice-view.php?id=16 (*excerpt* [T32])
- **Task evaluated:** is there a university pickup?
- **Does well:** a fixed route T1 → dorm, hourly 11:00–19:00, first-come [T32].
- **Does poorly:** only on check-in day; fee unstated; summer and winter programs only [T32].
- **Learn:** show university shuttles as time-boxed options with a fallback (AREX, limousine 6102).
- **Don't copy:** —

**4.8 MOE standard agreement (re-check via ICEF)**
- **URL:** https://monitor.icef.com/2026/09/korean-government-introduces-new-quality-controls-for-universities-and-agents/ [T33]
- **Task evaluated:** what must an agency show a student?
- **What's new vs V6:**
  - Language proficiency thresholds in IEQAS rise from 40% to 60% by 2030.
  - Mandatory indicators from the 5th cycle (2029–2032).
  - Institutions doing poorly "will lose visa issuance rights".
  - Agencies must provide information universities request; universities must monitor agents [T33].
- **Learn:**
  - Make "accurate information about programs, work rights, post-study options" and "tuition refund process and amount" visible per case.
  - Make agent data exportable to the university.
- **Don't copy:** —

### 5. Interaction-principle benchmarks

**5.1 Wise – pricing and transfer tracker**
- **URL:** https://wise.com/us/pricing/ [T35]; https://wise.com/help/articles/2977947/how-do-i-track-my-transfer (*excerpt* [T36])
- **Task evaluated:** what will this cost, and where is my money now?
- **Does well:**
  - "Fees at a glance" lists each fee with its basis ("From 0.23%", "Fixed fee per payment").
  - "We only use the mid-market rate — the one you can check on Google" [T35].
  - The tracker gives a "step-by-step view of where your money is" with an "up-to-date estimate". Delays are explained (weekends, verification requests).
  - The API docs warn that "payment sent" ≠ arrived (*excerpt* [T36]).
- **Does poorly:** nothing material for this use.
- **Learn:**
  - Every money line names its basis and payee.
  - Status steps carry an ETA, and say honestly that "sent" is not "received".
  - Point to an external check the user can verify.
- **Don't copy:** —

**5.2 Airbnb – total price display (global since 2025-04)**
- **URL:** https://news.airbnb.com/total-price-display-is-now-standard-globally [T37]
- **Task evaluated:** compare stays by real cost.
- **Does well:**
  - The total including all fees before taxes is shown in search results by default in all markets.
  - Taxes are always shown before checkout.
  - It had been regulatory in Korea since 2019 [T37].
- **Does poorly:** taxes are still excluded from the search total in many markets [T37].
- **Learn:** discovery cards show the **all-in first-year cost** (tuition + fees + dorm + insurance), not tuition alone.
- **Don't copy:** —

**5.3 Linear – custom views**
- **URL:** https://linear.app/docs/custom-views [T38]
- **Task evaluated:** save and reuse a filtered caseload.
- **Does well:**
  - Save any filtered list (Alt+V).
  - Workspace vs team views.
  - Favourites appear in the sidebar and can be set as the default page.
  - `O` then `V` opens views [T38].
- **Does poorly:** "Sharing a link does not automatically give anyone access to a view" — a small friction [T38].
- **Learn:** saved views as first-class, favouritable, and settable as home; keyboard openers.
- **Don't copy:** —

**5.4 Attio – filter and sort views**
- **URL:** https://attio.com/help/reference/managing-your-data/views/filter-and-sort-views [T39]
- **Task evaluated:** build a team view of "my students due this week".
- **Does well:**
  - And/Or filter groups.
  - A **"Current user"** value so one view works for everyone.
  - Multi-sort.
  - Changes are temporary until "Save for everyone" [T39].
- **Does poorly:** anyone with access can change a shared view's filters [T39].
- **Learn:** "Current user" in saved filters ("My caseload"); an explicit save-for-team step.
- **Don't copy:** letting any member silently change a shared view.

**5.5 Stripe Dashboard**
- **URL:** https://docs.stripe.com/dashboard/basics [T40]
- **Task evaluated:** drill down from a metric to the records behind it.
- **Does well:**
  - Customisable Home widgets.
  - Lists with filters and export.
  - Click a customer for subscriptions, payments and invoices.
  - Pinned and recent "Shortcuts".
  - `?` for the keyboard shortcut list.
  - Role-scoped team access.
  - Sandboxes for testing [T40].
- **Does poorly:** product sprawl ("More" menu) [T40].
- **Learn:** chart → filtered list → record, with export at every level; `?` for help; pinned and recent items.
- **Don't copy:** the sprawl.

## What Hangyul must beat, task by task

| Core task | Best current reference | Bar Hangyul must exceed |
|---|---|---|
| **Discovery and eligibility** | IDP FastLane (document-free self-check → labelled OIP, counsellor auto-alert) [T17]. Study in Korea language-of-instruction filter [T1]. | A document-free profile check that returns "likely eligible / not eligible / needs X", **labelled as not an offer**. Each program card also shows the language path *including post-admission conditions* (e.g. Yonsei GLD: English at entry → TOPIK 3 for a major → TOPIK 4 to graduate [T5]), the deadline status and a source link with `verified_at`. |
| **Cost clarity** | Wise "Fees at a glance" [T35]; Airbnb total price [T37]; Bachelorsportal KRW/yr on cards [T15] | An all-in first-year cost on every card (tuition, application fee, dorm, insurance, visa and stay fees), each line with payee, basis, refund rule and source date. Line items must add up to the total (unlike the official page [T4]). Show the DIY vs assisted price for any service (HigherVisa 65k vs HiKorea 50k [T26]). |
| **Documents (apostille)** | Yonsei per-country apostille / CHSI matrix [T5]; ApplyBoard requirement review on mobile [T14] | A per-country, per-document checklist generated from the target university's rules, with status per document (missing → uploaded → checked → apostilled → posted) and the reason for each requirement. |
| **Writing review** | V6 UCAS / Crimson (no new better reference) | Rubric feedback, version history and an authorship attestation. Explicitly **no** generation (ApplyBoard's SoP generator is the anti-pattern [T14]). A reminder that rails such as Jinhak/Yonsei lock the PS at the deadline [T5]. |
| **Application status** | ApplyBoard tracking with "estimated processing times" [T14]; Wise tracker [T36] | Status steps with **evidence** (application number, receipt), an ETA per step, a "payment locks this" warning before the rail, and honest wording ("submitted" ≠ "received by university"). |
| **Visa** | HigherVisa (multilingual, document review, e-mail status) [T26]; VisaHQ fee split [T27] | The CoA → embassy/KVAC or e-visa → arrival chain per country, with an official fee vs service fee split, single-source translations, and **no** approval-rate claims [T28][T33]. |
| **Arrival** | Trazy van (flight number, luggage, cutoffs) [T31]; University Living "No Visa No Pay" [T29] | One arrival record (flight, pickup, first-night housing, SIM, residence card, bank) that reuses the flight number. Every booking shows refund and visa-refusal terms; university shuttles appear as dated options with fallbacks [T32]. |
| **Agency caseload** | Agentcis (stages, client portal, quotes) [T23]; ApplyBoard (commission, compare 24) [T14]; Linear/Attio saved views [T38][T39] | Saved views with "Current user", bulk actions with preview and undo, a per-case fee quote the student sees, MOE standard-agreement disclosures per case [T33], and a client portal with the same status the counsellor sees. |
| **University review** | Slate Reader bins + queues + review-and-advance, blind/anonymous read [T19][T20] | Stage ≠ assignment; "score and advance" in one keystroke; a document viewer beside the form; optional blind read; flags with reasons and source links, never an auto-decision (Element451 lesson [T21]). |
| **Analytics drill-down** | Stripe chart → list → record with export [T40]; Salesforce "where applicants get stuck" [T22] | Every number in the agency and university consoles links to its filtered list and then the record, with export and a stated definition. Funnel drop-off by step and by country. No unattributed percentages. |

## Do not copy

1. ⚠ **Unverifiable success or visa rates:** ApplyBoard "95% success rate" [T12a], Boundless "99.7%" and "guaranteed success" [T28], V6 ACES 98% / KVN 99%.
2. ⚠ **Urgency guarantees:** Leverage "One-Day Submission / One-Week Offer" [T18]; "Trending" tags [T18]; "Instant Offer" same-day conversion pressure [T14].
3. ⚠ **Hidden or bundled fees:** no fee disclosure (Leverage [T18]); the K-ETA resold at a 6–10× service fee without saying the student can file directly [T27].
4. **AI authorship** (ApplyBoard SoP generator [T14]) and **AI credibility scoring of students** (Leverage [T18]).
5. **"Pre-apply" or OIP results without a visible "not an offer / not the official application" label** [T10][T17a].
6. **Unsourced aggregate deadline or cost tables,** and tables that contradict their own text [T7][T4].
7. **Multilingual notices that drift from the source text** [T26].
8. **"100% verified" or "Verified" badges with no stated method** [T29][T30][T34].
9. **Incentivised peer content without a sponsored label** [T11].
10. **Vanity counters that disagree across sections of the same page** [T12a].
11. **JS-only public pages** that can't be read on low bandwidth or by crawlers [T12].
12. **Opaque AI applicant scoring** without reasons, override or audit [T21].

## Sources (V8; accessed 2026-10-09 unless noted)

- [T1] Study in Korea home (search categories, filters, Kori): https://www.studyinkorea.go.kr/en/main.do
- [T2] Asia News Network, "South Korea rolls out one-stop site for study, visas and jobs" (2026-04-14): https://asianews.network/south-korea-rolls-out-one-stop-site-for-study-visas-and-jobs/
- [T3] Study in Korea, Plan your studies: https://www.studyinkorea.go.kr/en/plan/main.do
- [T4] Study in Korea study-cost / living-expense pages (*excerpt*; pages 404 or DNS failure on fetch; updated 2024-09-24 per excerpt): https://studyinkorea.go.kr/cn/study/AboardExpense.do ; https://recovery.studyinkorea.go.kr/ko/life/livingExpense.do
- [T5] Yonsei University, Fall 2026 Application Guide for International Students (ENG), JinhakApply link, fee KRW 150,000, payment lock, Global Basic Education Division TOPIK rules, apostille matrix: https://www2.yonsei.ac.kr/entrance/2026/intl/2026_9_docu/Fall%202026%20Application%20Guide%20for%20International%20Students(Eng).pdf
- [T5a] SKKU admission site (empty response) and department pages (*excerpt*): https://admission-global.skku.edu/ ; https://cscience.skku.edu/eng_cscience/international/undergraduate.do
- [T6] Third-party Yonsei fee claim (KRW 200,000, *excerpt*): https://www.scholarshipscentral.com/blog/yonsei-scholarship
- [T7] Korea JoongAng Daily, "Korean universities open spring 2027 admissions for international students" (2026-09-07): https://www.koreajoongangdaily.com/korea/korean-universities-open-spring-2027-admissions-for-international-students/12863631
- [T8] Korea Times, K-universities launch (2026-06-30): https://www.koreatimes.co.kr/southkorea/society/20260630/the-korea-times-launches-k-universities-global-platform-for-korean-higher-education
- [T10] GoStudy AI app listing (403 on fetch; *excerpt*): https://chrome-stats.com/d/com.gostudy.ai
- [T11] Korea Times, UpperClass (2026-09-26): https://www.koreatimes.co.kr/southkorea/globalcommunity/20260926/upperclass-bets-on-peer-trust-to-reshape-international-student-recruitment
- [T11a] NewDaily, Sejong ISF Spring 2026 (2026-03-10): https://biz.newdaily.co.kr/site/data/html/2026/03/10/2026031000409.html
- [T12] Welko (JS-only): https://www.welko.kr/?lang=en
- [T12a] ApplyBoard home: https://www.applyboard.com/
- [T13] ApplyBoard × ChatGPT release (2026-06-10): https://www.einpresswire.com/article/918700740
- [T14] ApplyBoard, What's new / Product Features 2025: https://www.applyboard.com/whats-new
- [T15] Bachelorsportal, Bachelor's degrees in South Korea: https://www.bachelorsportal.com/search/bachelor/south-korea
- [T15a] Studyportals home: https://www.studyportals.com/
- [T16] Edvoy home: https://www.edvoy.com/
- [T17] IDP FastLane blog and partner OIP terms (*excerpt*): https://www.idp.com/blog/get-your-university-application-processed-with-idp-fastlane/ ; https://portal.partners.idp.com/cmint/oip-and-propose-terms-conditions.html
- [T17a] IDP FastLane landing: https://www.idp.com/fastlane-instant-course-offer/
- [T18] Leverage Edu home: https://leverageedu.com/
- [T18a] Uni2Study home: https://www.uni2study.com/
- [T19] Slate Knowledge Base, Reader overview: https://knowledge.technolutions.net/docs/reader-overview.md
- [T19a] Technolutions home: https://technolutions.com/
- [T20] Slate, Reader Bins (Legacy) (*excerpt*): https://knowledge.technolutions.net/docs/reader-bins-legacy
- [T20a] Tennessee Tech / UGA / Memphis Slate reader tutorials (*excerpt*): https://ouweb.tntech.edu/graduatestudies/pdf/SlateReaderTutorial.pdf ; https://grad.uga.edu/?p=1693 ; https://classic.memphis.edu/gradschool/resources/slate_reader_instructions.pdf
- [T21] Element451 help, Bolt AI decisions and fraud detection (*excerpt* for fraud tiers and 2026-09-29 Socure announcement): https://help.element451.io/en/articles/11101486-using-bolt-ai-to-support-decisions ; https://element451.com/ai-app-fraud-detection-agent
- [T21a] Element451 home: https://element451.com/
- [T22] Salesforce, Education Cloud for Recruitment & Admissions datasheet (FY27 Q2): https://www.salesforce.com/en-us/wp-content/uploads/sites/4/migrated-forms/industries/education/FY27-Q2-Education-Cloud-for-Recruitment-Admissions-Datasheet.pdf
- [T23] Agentcis home; Capterra (*excerpt*): https://www.agentcis.com/ ; https://www.capterra.com/p/181884/Agentcis/alternatives/
- [T24] Meritto blog (2025-09-03): https://www.meritto.com/blog/heres-the-1-study-abroad-software-for-agents-consultancies/
- [T25] Money Today, HigherVisa Series A (2025-04-05): https://www.mt.co.kr/future/2025/04/05/2025040415324526851
- [T26] Jeonbuk National Univ. (JBNU) notice on HigherVisa stay extension (created 2026-02-19, modified 2026-09-01): https://ioffice.jbnu.ac.kr/bbs/ioffice/3549/381576/artclView.do
- [T27] VisaHQ South Korea: https://www.visahq.com/south-korea/
- [T28] Boundless home: https://www.boundless.com/
- [T29] University Living home: https://www.universityliving.com/
- [T30] Amber home: https://amberstudent.com/
- [T31] Trazy, Private Van Transfer for International Students: https://www.trazy.com/experience/detail/incheon-airport-transfer-university-seoul
- [T32] Korea University ISC shuttle notice (*excerpt*): https://isc.korea.ac.kr/noticecontacts/notice-view.php?id=16
- [T33] ICEF Monitor, Korean quality controls for universities and agents (2026-09): https://monitor.icef.com/2026/09/korean-government-introduces-new-quality-controls-for-universities-and-agents/
- [T34] Enkostay blog (2026-06-30) and search excerpts: https://stay.enko.kr/blog/en/koreas-traditional-rental-market-vs-foreigner-friendly-housing-platforms-whats-the-difference/
- [T35] Wise pricing: https://wise.com/us/pricing/
- [T36] Wise help, tracking a transfer; Wise Platform transfer statuses (*excerpt*): https://wise.com/help/articles/2977947/how-do-i-track-my-transfer ; https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses
- [T37] Airbnb, "Total price display is now standard for guests worldwide" (2025-04): https://news.airbnb.com/total-price-display-is-now-standard-globally
- [T38] Linear docs, Custom views: https://linear.app/docs/custom-views
- [T39] Attio help, Filter and sort views: https://attio.com/help/reference/managing-your-data/views/filter-and-sort-views
- [T40] Stripe docs, Web Dashboard basics: https://docs.stripe.com/dashboard/basics

**V8 limitations**
- **Inaccessible pages:** SKKU admissions (empty), the Yonsei and KU admissions portals (404), Welko (JS-only), the GoStudy AI listing (403), the Study in Korea cost pages (404/DNS) and Agentcis' alternate domain (500). We evaluated only public pages; logged-in flows were not tested.
- **Not re-researched:** UWAY returned garbled encoding, so V6's UWAY entry stands. The Nepal embassy and KVAC sites had no 2026 notices in search results.
- **Not covered:** Revolut, Booking.com and Kaplan/QS tools were not benchmarked in this pass. Prodeo could not be identified as an education agency CRM.
- **No independent outcome data:** all vendor numbers are self-reported.

---

# V6 benchmark (2026-10-01)

**Research date:** 2026-10-01 (all sources below accessed on this date unless marked). **Builds on:** V5 (2026-09-29, kept unchanged below). V5 rows not re-checked today are marked *(V5)*.
**Focus of this pass:** how applications are really submitted (and whether agencies can submit), essay-review practice, arrival/housing/visa services, and what the best competitors do for trust and design.

**Method notes**
- Primary sources first: university application guides (PDFs read with `pdftotext`), provider terms, government pages. News and consultancy blogs are used only where marked.
- `[Sx]` refers to the sources list at the end of this section. *Excerpt* = from a search-result excerpt, not a page we could read. *Unverified* = we found no primary source.
- "Students like" is inferred from each service's own value proposition. We used no reviews or forums, so it is **not** measured satisfaction.
- No numbers below are ours; each figure is the source's own and is self-reported unless stated.

## Key findings

1. **No agency or API submission path exists on the application rails.** Study in Korea, UWAY, JinhakApply and Gradnet are applicant-account systems. We found no public agency account, batch upload or API on any of them [S1–S8].
2. **Applicant-only submission is written into the rules.**
   - Korea University's Fall 2026 guide: "Online applications must be made personally by each applicant", with penalties up to admission cancellation [S5].
   - The common Korean application form says it may be written only by the applicant, or admission may be void [S9].
   - JinhakApply's terms forbid letting third parties use an ID [S7].
   - Yonsei GSIS asks applicants not to give the agency's contact details [S10].
3. **Recommendations and essays must be authentic too.**
   - KU GSIS collects recommender details to confirm the letter was "not written by the applicant, agency, or counterfeited" [S11].
   - KU undergraduate may request evidence on suspected plagiarism or ghostwriting, and can revoke admission "at any time" [S5].
   - Gradnet (Yonsei graduate) has recommenders submit through their own link [S8].
4. **Payment creates the record; paper still matters.**
   - The fee is paid inside the provider. After payment the application cannot be changed or refunded [S6][S8][S12].
   - Many universities still need the printed form and originals by post (V5; KU Fall 2026 asks for a mailing label [S5]).
   - Overseas payment ranges from Flywire (UWAY partnership) to a wire transfer plus e-mailing the receipt (Inha guide) [S6][S13].
5. **Authorized intermediaries exist on the visa side, not the application side.**
   - Certified universities can use e-visas: master's/PhD at certified universities, and any D-2 at "excellent certified" ones [S14][S15].
   - Licensed administrative agents (행정사) can file stay permits for students [S16].
   - Nepal consultancies report an embassy batch-submission channel for registered consultancies (*consultancy-reported; not on the embassy site* [S17][S18]).
6. **Regulation is tightening around agencies right now.**
   - MOE's 2026-09-08 plan introduces a university–agency standard agreement (from October). It requires direct tuition refund to the student's own account on visa refusal, bans false or exaggerated advertising, and standardises credential checks. Legislation is to follow [S19][S20].
   - 20 universities lost visa issuance for one year from Fall 2026 [S21].
7. **Essay practice is moving to "your own words, verified".**
   - UCAS screens every personal statement for similarity (Copycatch) and advises against AI writing or writing services [S22][S23].
   - Common App's fraud policy reportedly names "substantive" AI output (*third-party report; official page not machine-readable* [S24]).
   - The market's answer is feedback, not authorship: CollegeVine peer and expert review [S25][S26], Crimson multi-reviewer review [S27].
8. **The global platforms win on verifiable evidence and status, not on "AI".**
   - ApplyBoard's ApplyProof makes letters of acceptance, Flywire receipts and test scores verifiable. Pre-submission checks include document forensics [S28].
   - IDP Live sells a "real-time application progress tracker" [S29].
   - None of these platforms serves Korea (V5).
9. **Korea-focused competitors are still offline-first.**
   - Vietnam: ACES advertises "98% visa approval" and VND 35–80M+ packages [S30].
   - Uzbekistan: Bright Future claims "No.1" (*excerpt* [S31]).
   - Mongolia: AUSA and MGM run Facebook/phone-led sites [S32][S33].
   - Welko claims "289 universities … submit applications online", but its site is JS-only and its submission mechanics cannot be verified [S34].
   - None publishes a student-visible case status or a parent view.
10. **Housing for foreigners went mainstream in September 2026.**
    - Dabang launched a foreigner section (2026-09-08): listings and broker messages machine-translated into 30+ languages [S35].
    - Enkostay offers deposit-free monthly rentals bookable before the residence card, with university partners [S36].
    - Goshiwon booking sites in English are common, but run on WhatsApp [S37].
11. **Banking has a partial digital path once the residence card exists.**
    - The mobile residence card works for banking from 2025-03-21: in person at 6 banks, non-face-to-face only at Jeonbuk Bank [S38].
    - Before the card, the V5 restricted-account rules still apply.
12. **Stale facts are everywhere.** A guide updated 2026-04-20 still lists the residence card fee as KRW 30,000; the official fee has been 35,000 since 2025-01-01 (V5) [S39]. UWAY guides on university sites are often from earlier cycles; the Inha guide we read is for 2023 [S13].

## Per-competitor entries

Fields:
- **Like**: what students like (value proposition)
- **Auto**: what is automated
- **Manual**: what stays in spreadsheets, chats or by hand
- **Docs/Essay**
- **Submit**
- **Visa/Arrival**
- **Parents**
- **Trust**: what reads as trustworthy
- **Dated**: what is outdated
- **Hangyul**: what Hangyul can do better

### A. Official portal and application rails

**Study in Korea (NIIED)**
- **Like:** 28 languages, including Nepali, Mongolian, Uzbek and Vietnamese; a year-round online fair; the "Kori" AI chatbot [S1].
- **Auto:** program search with "accepting / opening soon" status; a five-step online application for participating institutions [S2].
- **Manual:** universities maintain their own data.
- **Docs/Essay:** the application form includes a personal statement and study plan; documents are attached online [S2].
- **Submit:** by the applicant. We saw no representative option [S2]. Payment and number issuance could not be verified.
- **Visa/Arrival:** information only.
- **Parents:** none.
- **Trust:** government operator.
- **Dated:** none observed.
- **Hangyul:** link to it as the canonical source; add the personal state, document vault and evidence it lacks.

**UWAY (uwayapply.com)**
- **Like:** one site for many universities; English flow; per-university notice pages [S3][S12].
- **Auto:** form, payment and "접수완료확인" (confirmation of application) printouts.
- **Manual:**
  - Universities post per-cycle links that change.
  - Wire-transfer payers must e-mail the receipt to the university [S13].
- **Docs:** upload or post, depending on the university (KU: print the form and mailing label [S5]).
- **Submit:**
  - The applicant's own account (sign-up even without a residence card) [S13].
  - The fee is non-refundable and cannot be edited after payment [S12].
  - There is a Flywire tie-up for international payment [S6].
- **Visa/Arrival:** –.
- **Parents:** –.
- **Trust:** used by most Korean universities (Flywire: 300+ institutions [S6]).
- **Dated:** the 2023 Inha guide shows several software "설치" (install) steps [S13]. Current behaviour is unverified.
- **Hangyul:** pre-flight checklist and evidence capture. Never take credentials.

**JinhakApply**
- **Like:** single membership across Jinhak and UWAY common-application universities (*excerpt* [S4]).
- **Auto:** form, JinhakCash, bank or card payment; the application number is issued on completion (Pusan graduate guide, *excerpt* [S40]).
- **Manual:** overseas transaction surcharges (*excerpt* [S40]).
- **Submit:** applicant only. The terms say members "shall not allow third parties to use their ID or password" (Art. 16(2)) and ban using another member's ID (Art. 26(1)(4)) [S7].
- **Visa/Arrival / Parents:** –.
- **Trust:** large domestic operator.
- **Hangyul:** same guided hand-off as UWAY.

**Gradnet (Yonsei graduate school, gradnet.co.kr)**
- **Auto:**
  - All documents uploaded as PDFs; essays of up to 30,000 characters.
  - Recommendation-request links e-mailed to recommenders, at most twice [S8].
  - Card, virtual account and real-time transfer payment; PayPal via a modern browser (*excerpt* [S8]).
- **Manual:** grading-scale explanations must be added as extra PDFs.
- **Submit:** applicant only. No changes, cancellation or refund after payment [S8].
- **Parents / Visa:** –.
- **Trust:** clear FAQ.
- **Hangyul:**
  - Preflight PDF checks before the student pays.
  - The recommender flow stays with the recommender. Hangyul only tracks "requested / submitted".

### B. Korea-focused agencies and platforms

**Welko (welko.kr)**
- **Like:** "Explore 289 universities, submit applications online, … progress tracking" (*excerpt* [S34]).
- **Unknown:** the page is JS-only. Whether "submit" means its own form, a hand-off or proxy submission is **unverifiable**.
- **Hangyul:** the closest positioning. Differentiate on evidence-based status, the agency workspace and the parent view, which Welko does not show publicly.

**ACES (Vietnam)**
- **Like:** "Study first, pay later"; an 8-step path from consultation to support in Korea; 70+ partner logos [S30].
- **Auto:** none visible.
- **Manual:** counsellor-run.
- **Docs/Essay:** document preparation and interview practice; essay role unknown.
- **Submit:** by the agency on the student's behalf (implied, not stated).
- **Visa/Arrival:** D-4-1 to D-2-6 visas; housing and post-arrival support.
- **Parents:** unknown.
- **Trust:** "100% transparent pricing", 35–80M+ VND [S30].
- **Dated:** the unverifiable "98% visa approval rate" claim (now in tension with MOE advertising rules [S19]).
- **Hangyul:** price breakdown and outcomes with cohort context only.

**KVN Group (Vietnam)** *(V5)*
- **Like:** full-stack offline package plus a Seoul office.
- **Dated:** the "99% visa" claim.
- **Hangyul:** as in V5.

**Nepal consultancies (SAS *(V5)*, KIEC, NEPCOMS)**
- **Like:** they navigate embassy document verification and "Consular Services 24" appointments [S17][S41].
- **Auto:** –.
- **Manual:**
  - Token and appointment hunting.
  - Batch embassy submissions (*consultancy-reported*: "only once per semester"; students beyond a 50-student batch book individually [S18]).
- **Visa:** core business.
- **Trust:** embassy-linked process knowledge.
- **Hangyul:** show official appointment status with "last checked". Model "batch via registered consultancy" as an agency-side visa step, and only where it is confirmed.

**Bright Future (Uzbekistan)**
- **Like:** language centres in Tashkent, Andijan and Asaka (*excerpt* [S31]).
- **Unknown:** everything else; the site is JS-only.
- **Hangyul:** Uzbek-language student and parent summaries are an open space. Study in Korea already offers Uzbek [S1].

**Mongolia: AUSA, MGM Education, HiKorea Mongolia**
- **Like:**
  - AUSA's Mongolian page explains the TOPIK level 3 expectation and the intake windows (spring intake: documents Sep–Nov; fall: May–Jun) [S32].
  - MGM promotes GKS [S33].
- **Manual:** contact is by phone, Gmail and Facebook. HiKorea Mongolia's site returned no content [S42].
- **Hangyul:** Mongolian UI and structured deadlines per university.

**Chinese agencies (EIC 启德, 新通 igo.cn)**
- Large multi-destination agencies with Korea pages (*excerpt* [S43]). EIC's page failed to load, so the details are **unverified**.

**HAH Seoul (landing agency)**
- **Like:** admission, visa and landing in one place; airport pickup, housing, SIM/T-money, residence card and hospital referral.
- **Parents:** "We're happy to answer questions or give updates with your permission."
- **Trust:**
  - Published refund rule: full refund more than 5 business days before arrival, 70% after.
  - Six channels: e-mail, phone, KakaoTalk, WhatsApp, web, Instagram [S44].
- **Manual:** pricing is on request.
- **Hangyul:** productise the bundle and copy the consent-gated family updates.

**Go! Go! Hanguk**
- **Like:** "same fees as if you applied … on your own", in seven languages.
- **What it does:** intermediary for documents and school coordination; pickup, SIM and housing [S45].
- **Parents:** none stated.
- **Hangyul:** fee transparency (who pays whom) as a first-class UI element.

### C. Global platforms (none serve Korea; V5)

**ApplyBoard**
- **Auto:**
  - "Instant Submission" AI feedback on each uploaded document [S46].
  - ApplyProof verification of LOAs (600,000+), Flywire receipts and test scores.
  - Document forensics and AI credibility interviews before submission. "130 suspected bad-actor files" were caught in 6 months [S28] (self-reported).
- **Essay:** helps with SOP writing (PIE report) [S46].
- **Trust:** a public blocklist of rogue agents [S47].
- **Hangyul:** quality gates and verifiable evidence before hand-off. Skip "credibility interview" surveillance (eye tracking), which is disproportionate for Hangyul.

**Leverage Edu**
- **Auto:** "Document Intelligence" eligibility checks; an AI adviser ("VASU"); a "Smart Assessment Interviewer".
- **Other services:** loans, UK housing (Fly Homes) and visa services. Claims a "One-Day Application Submission" [S48].
- **Essay:** SOP editing in its app [S49].
- **Hangyul:** use AI only for checks and explanations, never for authorship or credibility scoring.

**IDP / IDP Live**
- **Like:** a profile, a shortlist, FastLane in-principle offers and a real-time progress tracker [S29].
- **Other:** essentials (housing, banking, insurance) sit outside the app page.
- **Hangyul:** the tracker is the model, but Hangyul must also cover visa and arrival.

**Studyportals**
- Discovery only. "Studyportals Apply" no longer accepts new students [S50].
- **Lesson:** an application layer without the university rails failed to stick.

**Common App**
- **Like:** one application with role-separated access [S51]:
  - Recommenders submit their own forms.
  - Counselors see only their sections.
  - Parent/guardian signatures are only for Early Decision agreements.
- **Essay:** the fraud policy covers substantive AI content (*third-party report* [S24]).
- **Hangyul:** role-scoped access with recommender self-submission.

**UCAS**
- **Like:** "nominated access" lets a parent, guardian or adviser *speak to UCAS* on the student's behalf, never log in. Schools link through a "buzzword" [S52].
- **Essay:** every statement goes through Copycatch similarity screening. Statements at ≥10% are reviewed and applicants and universities are told together, per UCAS's applicant guide (third-party sites cite 30%; *threshold date unverified*) [S22]. UCAS also gives AI guidance [S23].
- **Trust:** WCAG commitment, level unstated [S53].
- **Hangyul:** copy nominated access for parents: a consented, read-only view with no login sharing.

**Crimson Education**
- **Essay:** one essay adviser, then a senior strategist review, with an optional former-admissions-officer review at extra cost.
- **Parents:** session notes and summaries go to parents (*Crimson blog / third-party review* [S27]).
- **Hangyul:** multi-step review with a named reviewer, at agency-level price points.

**CollegeVine / Scribbr**
- **CollegeVine:** free peer review ("less than 6 hours" on its page; 40 h in a Q&A *excerpt*), and paid expert review at USD 20/60 (*excerpt*) [S25][S26].
- **Scribbr:** the page returned HTTP 403; **unverified**.
- **Hangyul:** structured feedback rubrics; return-time SLAs only where staffed.

### D. Housing, arrival and money

**Enkostay**
- **Like:** "no deposit, monthly payment"; booking "without an RC document" (residence card); English support; partners include SNU, KU and Hongik; iOS/Android apps [S36].
- **Not stated:** fees, cancellation, visa-refusal terms.
- **Hangyul:** show those terms before any hand-off (V5 principle).

**Dabang 외국인전용관 (2026-09-08)**
- **Auto:** 30+ languages; deposit, rent and maintenance fees translated; broker e-mail auto-translated both ways.
- **Not stated:** any safety verification [S35].
- **Zigbang:** no foreigner service found (*unverified*).
- **Hangyul:** link out, plus a lease-safety checklist (deposit protection, registry check) in the student's language.

**Goshiwon platforms (goshiwons.com, GoshiwonSeoul, Goshipages)**
- **Like:** English booking and zero deposit, from about KRW 200,000/month (*excerpt*); WhatsApp support [S37].
- **Trust:** varies; not verified.
- **Hangyul:** label as neutral options, never as partners without an agreement.

**Amber, Ziptoss, Trazy** *(V5)*. **WOWPASS** *(V5)*.

**Banks**
- Mobile-residence-card banking from 2025-03-21 [S38]:
  - In person: Shinhan, Hana, iM Bank, Busan, Jeonbuk, Jeju.
  - Non-face-to-face: Jeonbuk only.
- Other "app opening" claims (KB, Toss) come from blogs only (*unverified*).
- **Hangyul:** a dependency chain with bank-specific flags.

**SIM**
- No new primary source. V5 Incheon facts stand. Third-party guides claim 24-hour booths in both terminals (*unverified for T2*).

### E. Visa services (D-2/D-4)

- **University-led (authorised):**
  - Certified-university e-visa: D-2-3/D-2-4 at certified universities; any D-2 at excellent-certified ones. 181 certified universities for 2026–2030 [S14][S15].
  - Yonsei, by contrast, gives the Certificate of Admission and the student applies at the embassy [S54].
- **행정사 / immigration-agent proxies:** they can file extension, change of status and residence card pickup for a fee [S16]. HiKorea e-applications get a 20% fee discount (*excerpt* [S16]).
- **Country channels:**
  - Vietnam: KVAC appointment booking [S55]. The "authorised agency only" rule for D-4 is **unverified**.
  - Nepal: batch submission through consultancies (*consultancy-reported* [S18]).

## Submission reality (2026-10)

| Rail | How the student applies | Upload | Pay | Proof returned | Agency account / batch / proxy | API |
|---|---|---|---|---|---|---|
| Study in Korea online application | Own account; 5 steps incl. statement and study plan [S2] | Attachments online [S2] | Not verified | Not verified | No representative option seen [S2] | None public |
| UWAY | Own ID (foreigners without a residence card allowed); per-university notice [S13] | Per university; often print, label and post [S5] | Card / U-cash / wire (wire: e-mail receipt to the university) [S13]; Flywire [S6] | Application number on payment; "접수완료확인" printout [S13] | **None found.** KU: "must be made personally by each applicant" [S5] | None public |
| JinhakApply | Own membership | Per university | JinhakCash, transfer, card [S7][S40] | Application number (7 digits at Pusan grad, *excerpt*) [S40] | **Not allowed:** no third-party use of an ID (Terms 16(2), 26(1)(4)) [S7]. Group/agency account not found (*unverified*) | None public |
| Gradnet (Yonsei grad) | Own account | All PDFs [S8] | Card, virtual account, transfer, PayPal [S8] | E-mailed receipt (*excerpt*) | **None found.** Recommenders submit their own letters [S8]. Yonsei GSIS: don't list agency contacts [S10] | None public |
| Visa (for contrast) | Embassy / KVAC / e-visa | — | — | — | **Yes, via authorised channels:** certified-university e-visa [S14], 행정사 for stay permits [S16], Nepal consultancy batch (*reported*) [S18] | — |

**What this means for Hangyul (research view)**
- **"Authorized agency submission" on UWAY, Jinhak or Gradnet is not feasible today.**
  - Nothing in their public material offers it.
  - KU's guide and the common form actively prohibit non-applicant completion.
  - Jinhak's terms forbid ID sharing.
  - A counselor logging in as the student would breach these rules and could cost the student the admission [S5][S7][S9].
- **What agencies may legitimately do:** advise, check documents, translate and notarise, explain the form, and verify evidence afterwards. Recommenders submit their own letters.
- **Implication for `AGENCY_ASSISTED` (`docs/SUBMISSION_CONNECTORS.md`):** keep it only for universities whose own guide permits submission by an agency or counsellor, recorded per university with a source. Otherwise the counselor *records* evidence and does not *submit*. We found no such university in this pass (*open question*).
- **The only route to a real API** is a bilateral contract with a university (e.g. a partner university's own intake), not the rails. The MOE standard agreement (from October 2026) governs agency recruitment conduct, not portal access [S19][S20].
- **Re-check every intake.** Rules sit in per-cycle PDFs, and several are image-only or old (Inha 2023 [S13]).

## What Hangyul must do better

1. **The student is always the submitter on the rails.** Hangyul and agencies prepare, check and record; they never log in for the student, store a password or auto-fill a portal. Say this in the UI as a protection, not a limitation.
2. **Evidence over claims.**
   - A step is done only with an application number, receipt or document. This is the ApplyProof lesson [S28].
   - Export a verifiable summary (number, date, fee, university) the student can show a parent or embassy.
3. **Pre-payment preflight.** Because payment locks the application [S8][S12], block "Continue to official submission" until documents are verified, PDFs are legible and fee variants are confirmed.
4. **Essay feedback with provenance.** Keep:
   - Version history and reviewer comments.
   - A student authorship attestation, matching KU's plagiarism and ghostwriting clause [S5].
   - An optional similarity self-check before submission (the UCAS model [S22]).

   No generated paragraphs. Recommenders submit their own letters.
5. **Consented parent view, modelled on UCAS nominated access [S52]:** read-only, translated, revocable, and never a shared login. It shows stage, next step and money due. It is still absent from every Korea competitor.
6. **Money with refund rules up front.** Show:
   - The provider's non-refundable fee [S12].
   - The visa-refusal tuition refund to the student's own account, under MOE's standard agreement [S19].
   - Housing deposits and the agency fee, each with its payee and refund rule (HAH-style published terms [S44]).
7. **Official facts versioned and dated.** Every fee, deadline and portal URL carries a source and `verified_at`. Surface staleness. The KRW 30k vs 35k residence card fee is the cautionary example [S39].
8. **No unverifiable success rates. Outcomes only with cohort context.** "98%/99% visa" claims [S30] are exactly what MOE's advertising rules target [S19]. Verify agencies (the ApplyBoard blocklist lesson [S47]).
9. **Arrival as a dependency chain with real providers.** Residence card → bank (mobile-card banking at the named banks [S38]) → postpaid SIM. Housing options with deposit and visa-refusal terms (Enkostay, Dabang, goshiwon). A pickup the student books once. All are neutral options unless a partnership agreement is stored.
10. **Design for trust and reach, as the best competitors do:**
    - Ship in the source-market languages Study in Korea already covers (vi, ne, uz, mn, zh …) [S1].
    - Follow the KRDS / WCAG 2.1 AA practices Korean government services use [S56][S53].
    - Show a status tracker as clear as IDP's [S29].
    - Offer KakaoTalk/WhatsApp/Zalo-style hand-offs for humans (HAH's six channels [S44]), while the record of truth stays in Hangyul.
    - Name the operator, show the refund policy and give a contact on every page.

## Sources (V6; accessed 2026-10-01 unless noted)

- [S1] Study in Korea home (languages, Kori chatbot, online exhibition): https://www.studyinkorea.go.kr/en/main.do
- [S2] Study in Korea online application: https://www.studyinkorea.go.kr/in/receipt/OnlineReceipt11.do
- [S3] UWAY Apply: https://www.uwayapply.com/apply/
- [S4] JinhakApply: https://www.jinhakapply.com/ (search excerpt on common membership: https://namu.wiki/w/유웨이어플라이, *excerpt only*)
- [S5] Korea University, Fall 2026 Freshman Application Guide (ENG), §C.2 "Online applications must be made personally by each applicant"; plagiarism/ghostwriting clause; portfolio "AI-Assisted" label: https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf
- [S6] Flywire–Uway partnership ("more than 300 institutions"; updated 2024-05-07): https://www.flywire.com/resources/strategic-partnership-with-korean-software-leader-uway-delivers-faster-more-secure-and-transparent-payments-for-international-students
- [S7] JinhakApply Terms of Use (EN), Arts. 16(2), 18(1), 19, 26: https://enter.jinhakapply.com/Policy/Agreement_en
- [S8] Yonsei Graduate School Gradnet FAQ (PDF upload, no change after payment, recommender links): https://gradnet.co.kr/yonsei/faq/FAQ_2025-2_KR.pdf ; system: https://gradnet.co.kr/yonsei/
- [S9] U1 University 2025 foreigner admission guide, common application form: "이 원서는 지원자 본인만 작성하여 지원할 수 있습니다": https://www.u1.ac.kr/global/community/notice.do?mode=download&articleNo=73150&attachNo=48464
- [S10] Yonsei GSIS Admissions Guideline Fall 2026 ("Please do not provide the information of the application agency"): https://gsis.yonsei.ac.kr/gsis/community/boards1_01.do?mode=download&articleNo=465861&attachNo=206805
- [S11] KU GSIS Fall 2026 guidelines (recommendation "not written by the applicant, agency"): https://int.korea.edu/_res/kuis/etc/Online_Application_Guidelines_International_Applicants_Fall_2026.pdf
- [S12] Seoul Tech on UWAY, Fall 2026 international notice (fee KRW 120,000; non-refundable): https://apply.uwayapply.com/e/810833qa455455/
- [S13] Inha University UWAY guideline for international students (2023 cycle; sign-up, U-cash, overseas wire + e-mail receipt, "접수완료확인", post only): https://ipsi1.uwayapply.com/foreign/inha/etc_file/etc_fileN3.pdf
- [S14] Korea Times, "20 universities slapped with visa curbs…" (2026-02-12, updated 2026-06-30; 181 certified): https://www.koreatimes.co.kr/southkorea/globalcommunity/20260212/20-universities-slapped-with-visa-curbs-over-poor-oversight-of-international-students
- [S15] MOJ press release 2026-02-12 (certification results): https://www.immigration.go.kr/bbs/moj/182/490757/download.do ; e-visa scope per search excerpt and https://seoulstart.com/guides/d-2-visa-guide (*third-party*)
- [S16] 행정사 / HiKorea proxy filing (search excerpts): https://yoonhjs.com/living_in_korea/highkorea-%EC%A0%84%EC%9E%90%EB%AF%BC%EC%9B%90/ ; https://justsolution.co.kr/ (*commercial, excerpt*); official service page: https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000097
- [S17] Embassy of Korea in Nepal, Consular Services 24 notice (2024-01-31): https://npl.mofa.go.kr/np-en/brd/m_25533/view.do?seq=65
- [S18] NEPCOMS, "Korea Student Visa from Nepal" (2026-05-30; batch-submission rules, consultancy-reported): https://nepcoms.com/korea-student-visa-from-nepal/
- [S19] 교수신문, MOE international-student quality plan (2026-09-08): https://www.kyosu.net/news/articleView.html?idxno=209967
- [S20] ICEF Monitor (2026-09-08): https://monitor.icef.com/2026/09/korean-government-introduces-new-quality-controls-for-universities-and-agents/
- [S21] = [S14]
- [S22] UCAS Similarity Detection Service – guidance for applicants (PDF, undated): https://www.ucas.com/sites/default/files/similarity-detection-applicant-guide.pdf
- [S23] UCAS, "A guide to using AI and ChatGPT with your personal statement" (*search excerpt*): https://www.ucas.com/applying/applying-to-university/writing-your-personal-statement/a-guide-to-using-ai-and-chatgpt-with-your-personal-statement
- [S24] GradPilot, "Common App AI fraud policy decoded" (*third-party*): https://gradpilot.com/news/common-app-ai-fraud-policy-decoded ; official page (not machine-readable): https://www.commonapp.org/fraud-policy/
- [S25] CollegeVine essay help: https://www.collegevine.com/apply/essay-editing
- [S26] CollegeVine Q&A on peer vs paid review (*excerpt*): https://www.collegevine.com/questions/20232/free-peer-essay-review-has-been-upgraded-and-replaced-with-pay-for-essay-review
- [S27] Crimson app blog: https://www.crimsoneducation.org/us/blog/enhancing-the-crimson-app-with-AI ; YourTeen review (*third-party*): https://yourteenmag.com/teens-college/admissions/is-crimson-education-legit
- [S28] ApplyBoard, "How ApplyBoard enables document verification" (2026-07-11): https://www.applyboard.com/applyinsights-article/how-applyboard-enables-document-verification
- [S29] IDP Live app: https://www.idp.com/india/idp-live-app/
- [S30] ACES (Vietnam): https://duhocaces.com/
- [S31] Bright Future (Uzbekistan; JS-only, *excerpt*): https://bf-korea.uz/?lang=en
- [S32] AUSA Education (Mongolia): http://ausa.mn/korea
- [S33] MGM Education Mongolia: https://mgmedu.mn/scholarships/korean
- [S34] Welko (JS-only; *excerpt*): https://www.welko.kr/?lang=en
- [S35] 서울경제, Dabang 외국인전용관 (2026-09-08): https://www.sedaily.com/article/20088421
- [S36] Enkostay blog (2026-06-30): https://stay.enko.kr/blog/en/no-deposit-student-housing-in-seoul-a-complete-guide-for-international-students/ ; app: https://apps.apple.com/us/app/enkostay-deposit-free-rentals/id6737757796
- [S37] Goshiwon platforms (*excerpts*): https://goshiwons.com/en ; https://goshiwonseoul.com/
- [S38] korea.kr, mobile residence card for banking (from 2025-03-21): https://www.korea.kr/multi/visualNewsView.do?newsId=148940883
- [S39] study-abroad.org Korea visa & arrival (updated 2026-04-20; lists KRW 30,000): https://www.study-abroad.org/study-in-south-korea/visa-and-arrival/
- [S40] Pusan National Univ. GSIS online admission how-to (*excerpt*): https://graduate.pusan.ac.kr/bbs/gsis/12664/753468/download.do
- [S41] KIEC Nepal, Korea visa checklist: https://kiec.edu.np/south-korea/document-requirement-for-korea-visa/
- [S42] HiKorea Mongolia (no content returned): http://www.hikorea.mn
- [S43] EIC Korea page (failed to load): https://www.eic.org.cn/country/kr ; 新通: https://www.igo.cn/country/kr/ (*excerpt*)
- [S44] HAH Seoul: https://www.hahseoul.kr/
- [S45] Go! Go! Hanguk: https://gogohanguk.com/en/
- [S46] The PIE News, ApplyBoard "Instant Submission" (2025-04-24): https://thepienews.com/applyboard-launches-new-ai-feature-for-student-applications/
- [S47] The PIE News, ApplyBoard blocklist of rogue agents (*title only*): https://thepienews.com/applyboard-publish-blocklist-of-rogue-agents/
- [S48] Leverage Edu: https://leverageedu.com/
- [S49] Leverage app listing (*excerpt*): https://apps.apple.com/us/app/study-abroad-with-leverage/id1590845967
- [S50] Studyportals Apply closing page (*excerpt*): https://www.studyportalsapply.com/closing.php
- [S51] Common App recommender system / member terms (*excerpts*): https://www.commonapp.org/counselors-and-recommenders/recommender-system/
- [S52] UCAS, filling in your application (nominated access, buzzword): https://www.ucas.com/applying/applying-to-university/filling-in-your-ucas-application
- [S53] UCAS accessibility: https://www.ucas.com/about-us/policies/accessibility
- [S54] Yonsei Global One-Stop Service Center, visa: https://gosc.yonsei.ac.kr/gosc/visa/applying.do
- [S55] KVAC booking (Vietnam, via search excerpt): https://www.visaforkorea-vt.com/ ; https://www.visaforkorea-hc.com/
- [S56] KRDS (Korea Design System): https://www.krds.go.kr/html/eng/index.html ; 디자인 나침반 (2025-01-22): https://designcompass.org/2025/01/22/krds-start/

**V6 limitations**
- JS-only sites remain unread: Welko, Bright Future, HiKorea Mongolia, Gradnet home.
- Scribbr returned 403. EIC failed to load. Common App's policy text was not machine-readable.
- No Chinese-agency page was benchmarked in depth.
- Group or agency accounts on UWAY and Jinhak could exist privately (B2B with universities). We found no public evidence; confirm by asking the providers (UWAY customer line 1588-8988, *excerpt*) before any product decision.

---

# Competitor benchmark: Korea study journey (V5)

**Research date:** 2026-09-29. **Scope:** services that help an international student go from choosing a university to settling in Korea (D-2/D-4).
**Companion files:** `docs/RESEARCH.md` §8 (V1 competitor list, 2026-09-27), `docs/ARRIVAL_SERVICES.md`, `docs/research/arrival-official.json`.

## Method

1. **Fresh web pass on 2026-09-29.** We did not reuse the V1 list as-is. We searched in English, Korean and Vietnamese, plus Nepal-specific queries.
2. **Sources.**
   - Each capability claim comes from the company's own public page wherever possible.
   - Some pages are JS-rendered or blocked. For those we mark the claim *from search excerpt*, or leave it `unknown`.
3. **No inferred features.**
   - `–` means the feature is not evident on the public site.
   - `unknown` means the site could not be read well enough to judge.
4. **Pain points** come from news reports, regulator statements and university guidance. They are **signals, not measurements**.
   - Forum and Reddit threads were not used as evidence. Most blocked automated fetch, and they cannot be verified.
5. **Uzbekistan and Mongolia agencies.** Searches found no Korea-focused agency whose public site could be read well enough to benchmark. This is a gap (see Limitations).

**Legend:**
- `✓` = offered, per the public site
- `partial` = information only, limited scope, or via a third party
- `–` = not evident on the public site
- `unknown` = site not readable

**Korea?** = whether Korea is actually a served destination.

## Comparison matrix

| # | Competitor (type) | Korea? | Match | Apply | Essay | Docs | Visa | Pickup | Housing | SIM | Bank | Insur. | Res. card | Orient. | Post-arr. | Student comms | Parent comms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Study in Korea / NIIED (official portal)[^sik] | ✓ | partial | partial | – | – | partial | – | partial | – | – | – | partial | – | partial | partial | – |
| 2 | UwayApply (application SaaS)[^uway] | ✓ | – | ✓ | – | unknown | – | – | – | – | – | – | – | – | – | unknown | – |
| 3 | JinhakApply (application SaaS)[^jinhak] | ✓ | – | ✓ | – | unknown | – | – | – | – | – | – | – | – | – | unknown | – |
| 4 | KVN Group (Vietnam agency)[^kvn] | ✓ | ✓ | ✓ | unknown | unknown | ✓ | unknown | ✓ | ✓ | ✓ | unknown | ✓ | unknown | ✓ | unknown | unknown |
| 5 | SAS Education Consultancy (Nepal agency)[^sas] | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | partial | – | – | – | partial | partial | partial | unknown | – |
| 6 | HAH Seoul (Seoul landing agency)[^hah] | ✓ | partial | ✓ | unknown | ✓ | partial | ✓ | ✓ | ✓ | ✓ | – | ✓ | partial | ✓ | ✓ | partial |
| 7 | Go! Go! Hanguk (language-school placement)[^ggh] | ✓ (mainly D-4) | ✓ | ✓ | unknown | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | partial | ✓ | unknown | – |
| 8 | ApplyBoard (recruitment marketplace)[^ab] | ✗ | ✓ | ✓ | – | unknown | partial | – | unknown | – | partial | unknown | – | – | partial | unknown | – |
| 9 | Leap Scholar (student platform, South Asia)[^leap] | – | ✓ | ✓ | ✓ | ✓ | ✓ | – | unknown | – | partial | – | – | – | partial | unknown | – |
| 10 | IDP Education / IDP Live[^idp] | ✗ | ✓ | ✓ | – | unknown | ✓ | – | ✓ | – | ✓ | ✓ | – | – | partial | ✓ | – |
| 11 | Edvoy (AI + counsellor platform)[^edvoy] | – | ✓ | ✓ | partial | ✓ | ✓ | – | ✓ | – | – | – | – | – | – | unknown | – |
| 12 | Studyportals / Bachelorsportal (discovery)[^sp] | ✓ (listings) | partial | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| 13 | Amber (student housing marketplace)[^amber] | ✓ (Seoul listings) | – | – | – | – | – | – | ✓ | partial | – | – | – | – | partial | ✓ | – |
| 14 | Ziptoss (Seoul realtor for foreigners)[^zip] | ✓ | – | – | – | – | – | – | ✓ | – | – | – | – | – | – | ✓ | – |
| 15 | Trazy – student airport transfer[^trazy] | ✓ | – | – | – | – | – | ✓ | – | unknown | – | – | – | – | – | ✓ | – |

**Considered but not in the matrix:**

- **Global players with no Korea destination on their public pages:**
  - Crizac (B2B agent portal; UK/CA/IE/AU/NZ)[^crizac]
  - INTO[^into] and Kaplan International Pathways[^kaplan] (UK/US/AU/CA/NZ pathways)
  - Shorelight (US)
  - University Living (Korea page returned 404)
  - HousingAnywhere (Seoul search returned HTTP 410)
- **Other Korea players, still relevant from V1:**
  - Welko (JS-rendered; only its "Korean University Admission Platform" headline was readable)
  - Shinhwa Education (403 in V1)
  - DreamWay to Korea
  - K-universities (media)
  - WOWPASS: a prepaid payment card with T-money built in, sold at airport kiosks[^wow]. It is an arrival utility, not a journey competitor.

## Per-competitor notes

Each note covers: what they do well, where staff do the work by hand, what frustrates students (signals only), and what Hangyul can simplify.

**1. Study in Korea (NIIED).**
- *Strengths:*
  - Authoritative source, about 12M visits a year.
  - Since April 2026 it runs a permanent virtual fair in four sections: language institutes, English-track degrees, vocational colleges and regional programmes[^sikherald].
  - Covers scholarships (GKS), visa and stay information, and job listings.
  - Has an online application service for participating institutions (language, bachelor's, graduate, associate)[^sik].
- *Manual work:* universities publish their own data unevenly.
- *Student friction:* it is an information hub. There is no personal checklist, document tracking or case status, and applications outside the listed institutions go elsewhere.
- *Hangyul:* treat it as the canonical official source and link to it; do not duplicate it. Hangyul's value is the personal state machine around it.

**2–3. UwayApply / JinhakApply.**
- *Strengths:* the actual application rails. More than 300 Korean institutions use Uway, and its Flywire tie-up covers tuition payment[^uway]. Jinhak lists 외국인특별전형 (the foreigner admission track)[^jinhak].
- *Manual work:* students or agents re-type the same profile per university and per round.
- *Student friction:* multiple accounts and formats; no eligibility matching; no visa or arrival coverage.
- *Hangyul:* keep one reusable profile and document vault and hand off to the rail with pre-filled guidance. Record the submission only with evidence (receipt or number). Never store portal passwords or scrape.

**4. KVN Group (Vietnam).**
- *Strengths:*
  - Full-stack offline package: D-4-1 to D-2-3 placement across "50+" universities, TOPIK training, and 1:1 visa interview mocks.
  - After arrival: dorm, SIM, bank, residence card and part-time job support.
  - Offices in three regions plus a Seoul office[^kvn].
- *Manual work:* counsellors run everything.
- *Student friction:* marketing claims such as "99% visa rate" are unverifiable. Vietnamese packages commonly cost VND 25–35M (search excerpt, not KVN's own price).
- *Hangyul:* give agencies structured case files and a student-visible status, so work stays in a system, not in chats. No success-rate claims.

**5. SAS Education Consultancy (Nepal).**
- *Strengths:* covers course matching, SOP/LOR help, translation, notarization, embassy verification, "submission tracking", financial-document prep, D-2 interview prep, and pre-departure and post-arrival guidance[^sas].
- *Manual work:* counsellor-driven.
- *Student friction:* Nepal has consular appointment bottlenecks (authentication appointments "fully booked"), and unofficial "token open" rumours circulate. Students are warned to verify before paying[^accel].
- *Hangyul:* show official-source status for embassy steps, with "last checked" dates. Never relay unverified appointment rumours.

**6. HAH Seoul.**
- *Strengths:*
  - Clearest published landing package: pickup (ICN/GMP), SIM and T-money setup, housing with virtual tours and contract review, residence card guidance, bank support, hospital intro and tours.
  - Six contact channels, family contact "with permission", and a published refund rule (full refund 5+ days before)[^hah].
- *Manual work:* entirely concierge.
- *Student friction:* PayPal or wire payment; no self-serve tracking evident.
- *Hangyul:* the closest benchmark for the arrival bundle. Productise the checklist and keep humans for exceptions. Copy their consent-based parent contact, not their UI.

**7. Go! Go! Hanguk.**
- *Strengths:* free to students ("same fees as if you applied … on your own"). Covers language-school selection, documents, D-4 visa, housing, pickup, SIM, residence card, and meetups after arrival[^ggh].
- *Manual work:* staff act as intermediaries with the schools.
- *Student friction:* mostly D-4 language programmes; it depends on its partner schools.
- *Hangyul:* be transparent about who pays (commission vs service fee), in line with MOE's new standard agent agreement[^icef].

**8. ApplyBoard.**
- *Strengths:* over 150k programmes, multi-program applications, and "360 Solutions" (test vouchers, financial services, loans)[^ab]. Visa help runs through partners (search excerpt)[^absearch].
- *Korea:* not among its destinations (AU, CA, IE, DE, UK, US, ES, MT, AE, MY)[^ab].
- *Hangyul:* the marketplace model's lesson is that one profile feeds many applications with quality checks before submission.

**9. Leap Scholar.**
- *Strengths:* one team from shortlist to landing; expert-reviewed SOPs and LORs; test prep; loans (Leap Finance)[^leap].
- *Korea:* not evident.
- *Hangyul:* shows students expect "no handoffs". But Hangyul must not write essays; it can only give feedback (V5 rule).

**10. IDP / IDP Live.**
- *Strengths:* course matching, FastLane quick decisions, visa support, and "student essentials" (health cover, accommodation, banking) plus "Arrive & Thrive" in a single app[^idp].
- *Korea:* its destinations are AU/CA/IE/NZ/UK/US.
- *Hangyul:* the best example of one app carrying the student past arrival.

**11. Edvoy.**
- *Strengths:* AI course matching plus human advisers; SOP/LOR guidance; loans, visa and accommodation[^edvoy].
- *Korea:* not evident.
- *Note:* its site footer says a moratorium is in force for Edvoy Educational Services Limited[^edvoy]. This is a reminder that marketplace continuity is a real risk for students.

**12. Studyportals.**
- *Strengths:* strong discovery (Bachelorsportal lists 245 bachelor's programmes in South Korea) and scholarship lists[^sp].
- *Limits:* sends students to each university's own system to apply.
- *Hangyul:* discovery is table stakes. What sets Hangyul apart is the eligibility explanation and what happens after.

**13. Amber.**
- *Strengths:*
  - Lists Seoul student housing (e.g. Dwell Dongdaemun, from KRW 420,000/month).
  - Requires a booking deposit of 1 month (non-refundable) plus a security deposit of 1 month.
  - Allows visa-refusal cancellation with evidence, and offers move-in help (SIM, bedding) and 24/7 support[^amber].
- *Student friction:* "no cooling-off period" on contracts; bookings are reviewed by a sales team, not instant.
- *Hangyul:* show deposit, refund and visa-refusal terms before any housing handoff.

**14. Ziptoss.**
- *Strengths:* English and Chinese service; remote online lease signing before arrival; guides on deposit protection[^zip].
- *Student friction:* the down payment (1–2 months) is typically non-refundable (Ziptoss guide)[^zipguide].
- *Hangyul:* housing is the riskiest money step. Explain deposits and the Housing Lease Protection Act steps in the student's language.

**15. Trazy student transfer.**
- *Strengths:* private van to 10 Seoul universities; arrival-hall greeting; flight-number tracking; 90 minutes' free waiting.
- *Terms:* surcharges for late nights and extra waiting; cancellation at least 2 days before[^trazy].
- *Hangyul:* collect the flight number, luggage count and arrival time once and reuse them. Do not imply live flight status unless there is an integration.

## Cross-cutting pain points (signals)

1. **No one carries the student across the whole journey, especially in Korea.** Global platforms that do this well (IDP, Leap, ApplyBoard) do not serve Korea. Korea-specific options are either official information (Study in Korea), application rails (Uway, Jinhak) or manual agencies.
2. **Parent communication is missing.** Only HAH Seoul mentions family contact, and only with the student's permission[^hah]. In the main source markets (Vietnam, Nepal, Uzbekistan) parents often fund the study, yet no competitor shows a structured parent view.
3. **Agency trust.**
   - MOE's September 2026 measures introduce standard agent–university agreements, truthful-advertising duties, refund information, and a tuition refund if the visa is denied[^icef].
   - Korean reporting describes study-abroad brokerage as essentially unregulated: anyone can open one with a business registration[^joongang]. That article is about outbound Korean students, but it shows the regulatory gap.
   - Unverifiable success rates ("98%", "99%") are common[^kvn][^sas].
4. **Post-arrival admin is sequential and fragile.** You need the residence card before a full bank account, a postpaid phone plan and NHIS cover. Limited accounts cap transfers at KRW 1M a day online. The residence card takes about 2–8 weeks, and students should not leave Korea meanwhile (see `ARRIVAL_SERVICES.md`). Today agencies explain this in chats.
5. **Official information is scattered and changes.**
   - The residence card fee went from KRW 30k to 35k in 2025, yet many pages still show 30k.
   - NHIS start timing is worded differently across universities.
   - Embassy appointment rumours circulate (Nepal).
6. **Visa-status risk after arrival.** 34,267 of about 264k students were in visa violation at the end of 2024 (study cited by Korea Herald)[^kh]. Students need reminders for extension, address changes and part-time work permits, not just help to arrive.

## Implications for Hangyul (product principles)

Principles, not UI to copy.

1. **One journey record, many rails.** Keep a single profile and document vault that feeds matching, application hand-offs (Uway, Jinhak, university portals, Study in Korea), visa, and arrival. Every external step works the same way: explain before, preserve state during, record evidence after.
2. **Official facts as versioned data.** Store fees, deadlines and rules with source URL, `verified_at` and `verification_status` (see `docs/research/arrival-official.json`). Show "last checked" and link the official page. Anything below VERIFIED gets softer wording.
3. **Sequence the arrival admin explicitly.** Model the dependency chain: residence card → NHIS → full bank account → postpaid SIM. Also offer interim steps: prepaid SIM, restricted account, private insurance bridge. Each step says what the student can do now and what unlocks next.
4. **University-specific facts are flags that universities set.** Examples: group residence card application, pickup shuttle, arrival report, orientation date, course-registration window. Never generalise from one university.
5. **Parent view with consent.** A read-only, translated summary (stage, next step, money due and to whom) that the student switches on. This is the clearest open gap in the market.
6. **Money transparency everywhere.** Separate Hangyul service fee, application fee, tuition, housing deposit (with its refundability) and third-party costs. Show who is paid and the refund rule before any hand-off. This matches the MOE agent-agreement direction[^icef].
7. **Providers are not partners by default.** Carriers, banks, housing sites and transfer companies may appear as neutral options. They are labelled "partner" only with a stored agreement. No invented listings or reviews.
8. **Agency work lives in the system.** Agencies do most of the manual work; give them structured cases, templates and student-visible status instead of messenger threads. No success-rate claims; outcomes only with cohort context (V5 rule).
9. **Honest automation.** No live flight or transit data without an integration. No remote bank-account promises: Hana's pre-registration still needs a branch visit[^hanakh]. No essay writing, only feedback.
10. **Status after arrival, not just arrival.** Reminders for the residence card deadline, address change (14 days), NHIS payment (due on the 25th), visa extension and part-time work permission. These help both students and university compliance.

## Limitations

- Several sites are JS-rendered or blocked (Welko, UwayApply home, SKT roaming, LG U+ documents page, HousingAnywhere). Their cells rely on search excerpts or are `unknown`.
- Fetch summaries were produced by a reader model and may paraphrase. The quotes in `arrival-official.json` should be spot-checked before legal-facing use.
- No Uzbekistan- or Mongolia-focused agency was benchmarked.
- Review sites and forums were not used as evidence.
- Agency claims (rates, partner counts) are self-reported.

---

[^sik]: https://www.studyinkorea.go.kr/en/main.do ; online application: https://www.studyinkorea.go.kr/ko/receipt/OnlineReceipt11.do
[^sikherald]: https://www.koreaherald.com/article/10716764 (2026-04-27)
[^uway]: https://www.flywire.com/resources/strategic-partnership-with-korean-software-leader-uway-delivers-faster-more-secure-and-transparent-payments-for-international-students ("More than 300 institutions in South Korea"; updated 2024-05-07)
[^jinhak]: https://www.jinhakapply.com/ (lists 외국인특별전형)
[^kvn]: https://duhockvn.vn/
[^sas]: https://saseducationconsultancy.com/blog/career-tips/best-consultancy-in-nepal-for-south-korea (the company's own blog; self-ranking)
[^accel]: http://accel.edu.np/south-korea-study-visa-update-2026-focused-token-system-and-d-2-d-4-visa-process-for-students/ (Nepal consultancy, relaying an embassy notice)
[^hah]: https://www.hahseoul.kr/
[^ggh]: https://gogohanguk.com/en/
[^ab]: https://www.applyboard.com/
[^absearch]: ApplyBoard Assist / search excerpt: "partnered with trusted services such as VFS Global and BorderPass" (https://assist.applyboard.com/hc/en-us)
[^leap]: https://leapscholar.com/lp/about-leap
[^idp]: https://www.idp.com/india/idp-live-app/ ; https://www.idp.com/
[^edvoy]: https://edvoy.com/faqs/what-is-edvoy/
[^sp]: https://www.bachelorsportal.com/search/bachelor/south-korea
[^amber]: https://amberstudent.com/places/dwell-dongdaemun-1911045170405 ; https://amberstudent.com/places/search/south-korea-1910249251117
[^zip]: https://global.ziptoss.com/en/
[^zipguide]: https://global.ziptoss.com/en/how-to-rent-a-house-in-korea-as-a-foreign-student/
[^trazy]: https://www.trazy.com/experience/detail/incheon-airport-taxi-transfer-international-students
[^wow]: https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140663 ; https://www.wowpass.io/en
[^crizac]: https://thepienews.com/crizac-expands-reach-in-latin-america/ (third-party trade press; crizac.com rendered no content)
[^into]: https://www.intostudy.com/en/where-to-study
[^kaplan]: https://www.kaplanpathways.com/where-to-study/
[^icef]: https://monitor.icef.com/2026/09/korean-government-introduces-new-quality-controls-for-universities-and-agents/ (2026-09-08)
[^joongang]: https://www.koreajoongangdaily.com/korea/calls-grow-for-oversight-of-study-abroad-agencies-as-mishandling-of-cases-leads-to-no-visas-wasted-money/12526330
[^kh]: https://www.koreaherald.com/article/10656313 (2026-01-15)
[^hanakh]: https://www.koreaherald.com/article/10527854 (2025-07-09)

# V9 benchmark (2026-10-10) — summary

The V9 pass researched **workflows** rather than features: 80 sources (51 read in full, 9 excerpts, 16 vendor claims, 4 inaccessible) in `docs/research/v9-operating-model.md` and `v9-sources.json`; visa/arrival revalidation in `v9-visa-revalidation.md`, `v9-arrival-revalidation.md`, `v9-visa-sources.json`. Headlines (REPORT §56): agencies become identifiable on the Certificate of Admission and universities will be scored on visa refusals (MOJ draft, 2026-10-07); proof of funds is splitting by Korean ability; the MOE standard agreement text is not public; no rail (UWAY, JinhakApply, Gradnet, Study in Korea) has any public agency/API/batch/status path; agency CRMs sell pipelines but not assignment/SLA/ageing; parent visibility is almost absent everywhere; fraud is industrial (forged degrees, TOPIK proxy ring, forged leases, temporary deposits). "Do not copy" list: ApplyBoard "95 %", Leverage one-day/one-week/one-month promises, IDP "instant offer" without the non-binding label, undisclosed fees, language versions that disagree, AI-written statements and credibility scores.
