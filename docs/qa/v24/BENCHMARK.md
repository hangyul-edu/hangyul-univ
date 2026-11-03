# V24 Competitive UX Benchmark: Hangyul Univ

Read on 2026-10-26 with WebFetch/curl against live public pages and help-center articles. I only opened public pages, so there are no logged-in screenshots. Where a page blocked fetching (403: Niche, QS TopUniversities, ApplyBoard help-center HTML), that is stated, and nothing about those pages is inferred. The extraction returned text only, so button colour and weight could not be checked. "Primary" below means the CTA a page repeats and links to sign-up, not a visual measurement.

## 1. Observations

### Common App (commonapp.org, /explore, quickstart PDF)
- **Navigation:** the top row splits by audience ("For counselors and teachers", "For colleges and universities"). Students get one Menu built around the task sequence: Find Colleges, Plan, Apply, Pay. https://www.commonapp.org
- **Hero:** one emotional line ("College is for anyone") and **one** CTA, "Start your application". The same CTA comes back as step 4 of a **"Where to start" 4-step strip** (Explore → Plan → Pay → Apply). Step 4 also says why to fill in the profile: GPA "may unlock scholarship matches or direct admissions offers".
- **Discovery:** "1177 colleges found", a left filter panel (keyword, accepts first-year/transfer toggles, location, campus setting, financial aid, size…), "Sort by college name", and a Grid/Map toggle. The filters are about **eligibility to apply**, not prestige. https://www.commonapp.org/explore
- **Progress model:** the quickstart has 3 steps: Add colleges → Stay organized (requirements grid per college) → Complete & submit. The shared "My Common Application" profile is filled once, and each college then adds its own tasks (questions, recommenders, supplements). https://www.commonapp.org/static/b96ac19f1b082d294afc77aa6a386e01/Resource_FY_HowFYWorks_ENG_2025.10.24.pdf
- **Pricing:** none. The product is free, and fees belong to each college.

### ApplyBoard (applyboard.com + assist.applyboard.com via Zendesk API)
- **Marketing:** the hero is "Your Future Goes Beyond Borders" with the repeated primary "Register as a Student". Partners and Institutions sit in one nav dropdown. https://www.applyboard.com
- **Partner portal** (Quick Start Guide, https://assist.applyboard.com/hc/en-us/articles/6478309161485):
  - **First-run:** three named first actions: Add first student → Search programs → Create application. Features that are not approved yet are locked, and the page explains what you can do while you wait.
  - **Left navigation in two groups:** "Core tools — use these every day" (Home, Programs & Schools, Students, Applications, My Tasks, Payments) and "More features" (Wish Lists, 360 Solutions, Invite Students, owner-only).
  - **Home:** "what needs your attention today without having to dig into individual applications".
  - **Students:** shows each student's journey stage "from new lead through to enrolled".
  - **My Tasks:** collects every outstanding requirement across all students: "Check it daily".
  - **Application creation** (https://assist.applyboard.com/hc/en-us/articles/14334416108173):
    - The system checks eligibility first. If it fails, a warning names the missing profile data and links to "Update profile data".
    - A pre-submit screen of what to expect sets expectations before the user commits.
    - An unpaid application shows a top banner saying it "will not be processed until payment is received".
- **Requirements model** (https://assist.applyboard.com/hc/en-us/articles/36101872707341, …/44797287089421):
  - There are 4 statuses, and each comes with an *action level*: Pending = High, In Review = None, Rejected = **Urgent** (with a "Revise" button and the reviewer's note), Approved = None.
  - Timing labels say when an item is due: blank = needed now, "Before Payment", "Optional", "Required Later" (visa/enrolment).
  - A Task Manager widget shows progress counters plus the top tasks for up to 3 applications. Clicking a task jumps to that exact step, and the widget clears itself when everything is done.
  - Unpaid applications are framed "like items in a shopping cart".
  - A complete profile is a gate: "finish it to view all mandatory requirements".

### Studyportals / Mastersportal
- **Corporate site:** the hero is split by audience ("I'm a student / Start course search" vs "I'm an institution / Promote your courses"), with scale stats. There is no search form. Students are sent to separate degree-level portals. https://www.studyportals.com
- **Search results:**
  - Tabs for Programmes / Universities / Scholarships, currency-localised sort (KRW), and filters for field, location, tuition, duration, format, attendance, degree type.
  - Each card has a logo, rating with review count, a rank badge ("Top 3% Worldwide"), city, title, mode tags, duration, and tuition in ₩. The card has one action, "View Programme Information". https://www.mastersportal.com/search/master/computer-science/south-korea
- **University profile** (the sampled page turned out to be Polytechnic Institute of Coimbra, not a Korean university):
  - Hero image, then a key-facts strip (programmes, scholarships, rating, rank), then an anchor tab bar (Overview, Key statistics, Ranking, Scholarships, Careers, Location, Reviews).
  - It still shows "0 Master's programmes" and "Not ranked", and mixes in promotional CTAs ("Get your student insurance now", "Take a Free Practice Test!"). https://www.mastersportal.com/universities/1137/

### Study in Korea (studyinkorea.go.kr, NIIED)
- **Navigation:** about 30 languages and 7 top menus with dozens of items (Why Korea, Plan, Life, Work, Fair, Community, Notice).
- **Homepage:** a promo carousel, then search split by category (university / department / scholarship / content), then a strong **"Plan your studies with Korea in 5 steps"** strip: info → choose school → apply → Certificate of Admission → visa & depart. Each step links to a guide. https://www.studyinkorea.go.kr
- **Certified-university page:** names only, as comma-separated plain text with no links or attributes (184 degree-programme, 126 language, 43 excellence-certified). The logo row is empty. https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do

### UCAS (ucas.com)
- **Hero:** "Choose your future" plus a universal search and 10 category chips.
- **Navigation:** the mega-menu has about 110 links. Applying and International each have about 30.
- **Tracking page:** describes stages but avoids naming dates, and reassures ("don't worry if you hear nothing for a while"). https://www.ucas.com, https://www.ucas.com/applying/after-you-apply/tracking-your-ucas-application

### IDP (idp.com/find-a-university, Korean locale)
- **Results:** "1385 Universities", sort by popularity, and a country filter with explicit Cancel/Apply. Cards show logo, name, country, international-student count, an "English courses" flag, "View all courses" and "View details".
- **Primary CTA:** in both header and filter area it is **counselling** ("유학 상담 신청"), backed by a callback widget and a Kakao channel.
- **Fastlane:** a 5-step pre-screen that returns a school decision "in minutes". https://www.idp.com/find-a-university/

### Leverage Edu (leverageedu.com)
- **CTAs:** a single repeated CTA, "BOOK FREE CONSULTATION", plus WhatsApp chat.
- **Pricing:** no service prices are shown.
- **Guarantee:** a "Leverage 111 Guarantee" (submit in 1 day / offer in 1 week / payout in 1 month) is the only concrete promise.

### Not observable
- Niche and QS profiles returned 403.
- Studyportals and ApplyBoard institution analytics are marketing pages only ("real-time predictive demand data"). They show no visible dashboards.
- Mobile layout could only be inferred: ApplyBoard ships duplicated mobile menu variants, and Common App puts its student nav behind "Menu" even on desktop.

## 2. Transferable principles

1. **One verb above the fold, and everything else is a path to it.**
   - *Why:* a visitor deciding whether to trust you can only commit to one next step. Repeating that step lowers the decision cost.
   - *Seen in:* Common App, ApplyBoard, Leverage Edu.
   - *Apply to the marketing home:* "유학 준비" is the only filled button. "Browse universities" and "Pricing" are text or outline links, and every lower section ends by pointing back to 유학 준비.

2. **Show the whole journey as a numbered strip before asking for anything.**
   - *Why:* anxiety in international admissions comes from not knowing the sequence. A map makes a commitment feel bounded.
   - *Seen in:* Common App "Where to start", Study in Korea's 5 steps.
   - *Apply to the marketing home and student home:* the 6 Hangyul stages (explore → arrive) as one strip. On the home page it explains. In the app the same strip shows the current position.

3. **Say what entering data unlocks.**
   - *Why:* people fill in forms when they can see the payoff.
   - *Seen in:* Common App ("may unlock scholarship matches"), ApplyBoard ("finish profile to view all mandatory requirements").
   - *Apply to student onboarding and documents:* "Add your GPA and TOPIK → see which of 425 universities you're eligible for".

4. **Give every status an action level, not just a state.**
   - *Why:* "In Review" and "Rejected" are both just labels, but one needs nothing and the other is urgent. Pairing state with *who acts next* removes guesswork.
   - *Seen in:* ApplyBoard (Pending = High, Rejected = Urgent, In Review = None).
   - *Apply to documents and the agency review:* each document row shows "You", "Counselor" or "Done". Rejected items carry the reviewer's note and a single "Revise" button.

5. **Use timing labels to separate "needed now" from "needed later".**
   - *Why:* a 30-item checklist paralyses. Telling people what can wait shrinks the visible work.
   - *Seen in:* ApplyBoard (blank / Before Payment / Optional / Required Later).
   - *Apply to the application workspace:* group requirements as "Before submitting", "After admission (visa)" and "Before arrival", which map to the journey stages.

6. **Make one cross-entity queue the home screen for people who process many cases.**
   - *Why:* counselors think "what do I do now", not "which student shall I open". A queue that collects work across records removes the hunt.
   - *Seen in:* ApplyBoard Home and My Tasks ("check it daily").
   - *Apply to the agency today queue:* one list of every blocking item across students (doc to review, essay to comment on, deadline in 3 days). Each item names the student and university and deep-links to the exact step (ApplyBoard Task Manager: "click any task to go directly to that exact step"), not to an overview.

7. **Validate before submit, and name the fix.**
   - *Why:* failing late is expensive and demoralising. An early warning that names the missing field turns a rejection into a to-do.
   - *Seen in:* ApplyBoard's eligibility check with "Update profile data" and its pre-submission audits.
   - *Apply to the application workspace:* on "Add university", check the language and score requirements against the profile, and show "Missing: TOPIK 4 — add score" with a link.

8. **Split navigation into daily core and occasional extras.**
   - *Why:* staff learn tools by frequency. A short core list keeps the daily loop fast.
   - *Seen in:* ApplyBoard ("Core tools — use these every day" vs "More features"). Counter-example: UCAS's mega-menu of about 110 links.
   - *Apply to the agency console and university console:* 4–5 core items (Today, Students, Applications, Messages). Settings, team and billing go under a secondary group.

9. **Show each record's journey stage in the list itself.**
    - *Why:* managers triage by stage. Opening each record to learn its stage wastes their attention.
    - *Seen in:* ApplyBoard Students ("new lead through to enrolled").
    - *Apply to the agency student list and university applicant queue:* a stage column using the same 6-stage vocabulary as the student app, filterable and countable.

10. **Filter by what makes the student eligible, not only by what impresses them.**
    - *Why:* a student's real question is "can I get in and afford it".
    - *Seen in:* Common App filters (accepts first-year, financial aid), ApplyBoard eligibility filters, Mastersportal's localized tuition.
    - *Apply to the university directory:* filters for degree level, Korean or English track, tuition band in the viewer's currency, intake and region. Show the result count live ("312 universities").

11. **Cards answer the first three questions and offer one action.**
    - *Why:* a scannable, fixed set of facts lets students compare without opening each card. A single action avoids choice paralysis.
    - *Seen in:* Mastersportal (city, duration, tuition, rating, one link) and IDP (international-student count, English flag).
    - *Apply to directory cards:* a photo, name and city, then exactly three facts (tuition/yr, international students, English-taught availability), one "View" link and a save icon.

12. **Profile pages lead with feeling, then switch to facts.**
    - *Why:* a campus image builds desire, and the facts that follow justify the choice. A sticky tab bar lets fact-seekers skip ahead.
    - *Seen in:* Mastersportal profile (hero, key-facts strip, anchor tabs).
    - *Apply to the university detail page:* hero photo and one-line identity, then a 4-fact strip, then anchored sections (Programs, Admission & deadlines, Costs & scholarships, Life & housing, Location). The single primary action is "Prepare to apply here", which hands off into 유학 준비. Omit any fact the record lacks: Mastersportal's "0 Master's programmes" and "Not ranked" read as negative judgments, not missing data.

13. **Treat payment state as a clear gate with a banner, not a hidden flag.**
    - *Why:* people tolerate a paywall they understand. They distrust silent non-progress.
    - *Seen in:* ApplyBoard ("will not be processed until payment is received", "like a shopping cart").
    - *Apply to the student home and pricing:* before purchase, the journey is visible and stage 1 works. Locked items say "Included in All-in-One" in place of disappearing.

14. **Show prices openly against a "free consultation" market.**
    - *Why:* every observed competitor hides price behind a consultation (Leverage Edu, IDP, Korea consultancies). A visible one-time price is itself a trust signal.
    - *Apply to pricing comparison disclosure:* show three columns with the price and "one-time" on the card. Show the 5–6 differentiating rows by default and put the full matrix behind "Compare all features". Mark one recommended plan, and don't style all three buttons as primary. Add a bounded service promise (counselor reply or document-review turnaround), the way Leverage's "111 Guarantee" and IDP Fastlane's "in minutes" do, in place of scale claims.

15. **Give the first run a three-action checklist that clears itself.**
    - *Why:* an empty console teaches nothing. Three named first actions convert a blank state into a path, and auto-clearing rewards progress.
    - *Seen in:* ApplyBoard ("Your First Three Actions", and a widget that "automatically clears").
    - *Apply to the agency and university empty states:* "Invite a counselor / Add first student / Connect a university" (agency) and "Publish admission requirements / Set intake / Invite reviewer" (university).

16. **Analytics should follow the same journey stages as operations.**
    - *Why:* staff reading a funnel need to act on it. Shared stage names let them click from a drop-off bar into the queue of those applicants.
    - *Seen in:* Studyportals (country and city demand) and ApplyBoard's journey tracker. Inferred, since no dashboards are public.
    - *Apply to university analytics:* applicants by country, then a 6-stage funnel with drop-off percentages. Each bar links to the filtered applicant queue.

## 3. Anti-patterns to avoid
- **Navigation overload:** UCAS has about 110 links in its mega-menu, and Study in Korea has 7 dense menus. Hangyul's student navigation should stay at 5 items or fewer.
- **Lists with no affordance:** Study in Korea's certified-university page is plain, unlinked text. Every Hangyul university mention should link to its detail page.
- **Promotional CTAs competing with the job:** Mastersportal's profile pushes insurance and a practice test next to "Find More Masters". Hangyul's detail page should have one primary action, and cross-sells belong after admission.
- **Inconsistent or unverifiable numbers:** ApplyBoard's "1.5M+" vs "1 Million+". Hangyul should show one source-of-truth count ("425 universities") everywhere.
- **Pricing hidden behind "book a free consultation":** Leverage Edu and IDP do this. Hangyul's published one-time plans are an advantage, so don't bury them under a lead form.
