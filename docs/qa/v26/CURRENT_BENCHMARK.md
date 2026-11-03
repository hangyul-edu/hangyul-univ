# V26 — Current competitive benchmark (2026-10-27)

Sources were official help centres, documentation, release notes and vendor pages, fetched without signing in on 2026-10-27.
The comparison is about **interaction concepts**, not visual style.

Two markers are used below:
- **[search-index]** — ApplyBoard's help centre answered HTTP 403, so these claims come from search-engine extracts of its
  official articles.
- **[unverified]** — no official source was found for the claim.

This replaces nothing in `docs/COMPETITOR_BENCHMARK.md`. That file is the V5 record; this file is the V26 snapshot.

## Per product

| Product | What it does better | Why it works | Applies to Hangyul? | Deliberately NOT copied |
|---|---|---|---|---|
| **Cialfo** (counsellor platform) | Dashboard cards a counsellor chooses, with one cohort filter. Each funnel segment opens a side list of the students in it, and each name opens that student's application. Actions can be taken from the card ([help.cialfo.co/…/6095027](https://help.cialfo.co/en/articles/6095027-counselor-dashboard), updated 2026-09-03). Tasks can be bulk-assigned by grade. Notes visible to the student are kept separate from counsellor-only notes and flags. | Every number on the dashboard leads to the people behind it. The student never sees counsellor-only data. | **Yes.** Agency TODAY → rows → the exact item. Hangyul already has this: its workspace keeps student-visible messages separate from internal notes. | The "Likelihood" field, Likely/Target/Reach labels, QS ranking data, AI-drafted letters (Saige). |
| **ApplyBoard** | A requirements tab where each item has its own state: Pending, In Review, Rejected (with feedback, back to the student) or Approved. Reviewers are notified only after the student presses Submit [search-index]. A recruiter Tasks list covers every application and sorts by intake, due date and assignee [search-index]. In search, filters and results update together, with results on the left and details on the right ([blog, 2023-11-28](https://www.applyboard.com/blog/new-student-search)). | "What is blocking me" always has an answer. | **Yes.** Student documents, agency document review, the TODAY list. | "Overall Success Chance: High/Medium/Low", Success Analysis, a "best match" sort weighted by prediction or commercial factors, the "95 % acceptance" claim. |
| **Studyportals** | The journey is named in four steps: Search → Evaluate → Shortlist/compare → Apply. Quick-filter chips sit next to the full filter set. The site says plainly that the university handles the application itself ([mastersportal.com/about-us](https://www.mastersportal.com/about-us)). | Students always know which step they are on, and the handoff to the university is announced in advance. | **Partly.** Student Explore and Compare, and the external-portal handoff. | Ranking filters and tables, unexplained match %, an AI advisor whose logic is not published. Whether listings are sponsored is [unverified]. |
| **Common App** | The core application is filled in once and sent to every college. Each college's own requirements are shown separately ("My Colleges", Requirements Grid). Conditional sections appear only when they apply. The counsellor side can preview a student's application with the student's permission (Counselor Convo deck, Feb 2026). | Nothing is entered twice, and per-college differences are kept apart from the shared answers. | **Yes.** Hangyul's universal dossier, document reuse ("Use existing document"), requirements per university. | The rule of *not* notifying applicants about missing items. |
| **Slate** (Technolutions) | Reader shows the pipeline as bins with counts, and a personal Queue that is separate from those bins. Submitting a review and moving the record are one action ("Review Form / Send to Bin"). A record cannot move until its required form is done, and only to allowed next bins ([docs/workflows](https://knowledge.technolutions.net/docs/workflows), 2026-10-20). Checklist items carry dates (Received / Awaiting / Waived). | The pipeline is visible at a glance, the reviewer's own work is separate from where a record sits, and records cannot be moved by accident. | **Yes.** University decision queue: a decision moves the applicant and opens the next one (Hangyul's "open next" exists since V13). | Query-builder complexity for everyday users. Release-decision details are [unverified] (secondary sources only). |
| **Element451** | A three-state checklist: missing → **Received** → accepted ([release notes May 2026](https://help.element451.io/en/articles/14963032-release-notes-may-2026)). Checklist items can continue after admission. In Insights, clicking a value filters the whole report ([Insights overview, 2026-07-07](https://help.element451.io/en/articles/6666068-insights-overview)). | Uploading something is not treated as being done, and charts lead into the data behind them. | **Yes.** Document states (`UPLOADED`/`NEEDS_REVIEW` ≠ `VERIFIED` — Hangyul already keeps these apart), visa/arrival after the offer, university drill-down (Hangyul: a metric opens its rows). | AI voice/chat agents as the student's first point of contact, silent changes to decisions after release. Whether drill-down reaches a list of named students is [unverified]. |
| **Liaison CAS** | Status in three layers: overall → per programme → per material. "Undelivered" means returned for correction. A transcript sent once is shared with every programme. | Each layer answers a different question. | **Yes.** The student application command centre (overall → per university → per requirement). | The rule that the applicant must check for missing items themselves. |
| **IDP FastLane** | An "Offer in Principle" in about 30 minutes from a short profile ([idp.com blog, 2026-06](https://www.idp.com/blog/get-your-university-application-processed-with-idp-fastlane/)). | It is fast. | **Only as an eligibility check against published minimums** — Hangyul's `/start` already does this and never calls it an offer. | A quick algorithmic "offer" that blurs eligibility and admission. |
| Leverage Edu / Unibuddy | Dream/realistic/safe tiers (marketing material); moderated peer chat with a stated reply time (seen on university pages only). | — | Peer chat: possibly later. | The tiers. |

## What Hangyul already does that the benchmark confirms

- Eligibility is stated as "meets / does not meet the published minimum". No probability is shown. This is already stricter
  than ApplyBoard, Cialfo and Leverage.
- Each document requirement has its own state, and the counsellor's correction note is shown on the student's side.
- In the university console every count is the number of rows behind it (V22–V25).

## What V26 takes from it (ranked by fit)

| # | Pattern | Evidence | Hangyul screen | V26 action |
|---|---|---|---|---|
| 1 | A notification or queue item opens the **exact requirement or thread**, not just the right page | Liaison/Common App (as the counter-example), ApplyBoard | Agency TODAY rows, student tasks/notifications, university requests | **Planned** — `focus=` deep links (§341) |
| 2 | **Cross-caseload work list** where each row opens the exact item | ApplyBoard Tasks, Cialfo | Agency TODAY | **Planned** — server `targets` per row |
| 3 | **Three-layer status**: overall → per application → per requirement | Liaison CAS, Common App | Student application command centre | **Planned** — application header summary |
| 4 | **Enter once, reuse** — show the existing verified document before offering a new upload | Common App, BusinessCAS | Student documents/upload | **Planned** — "Use existing document" first |
| 5 | **Dashboard numbers click through to filtered rows** | Cialfo, Element451 | University native home | **Planned** — native headline figures |
| 6 | **Explicit handoff before leaving** for an external portal | Studyportals | Student submission handoff | Exists since V5/V15 — re-reviewed |
| 7 | Quick chips plus full filters, with results always in view | ApplyBoard, Studyportals | Student Explore | **Planned** — fit-first Explore |
| 8 | Personal queue plus one-step "evaluate & move" | Slate | University decision panel | Exists ("open next"); not changed |
| 9 | Staged batch decision release | Slate (secondary source) | University | **Not adopted** — owner decision on the admission process |
| 10 | Counsellor previews the student's view, with consent | Common App | Agency workspace | **Not adopted** in V26 — needs a consent design |

## Deliberately not copied (Hangyul's honesty rules)

1. Admission-chance %, High/Medium/Low success chance, Likely/Target/Reach, dream/realistic/safe.
2. A "best match" sort that uses hidden or commercial factors. Hangyul's sort options are relevance (the filters the student
   set), deadline, tuition and name.
3. Rankings or ranking-derived data.
4. AI drafting of essays or letters, and AI agents as the student's first point of contact.
5. A quick algorithmic "offer".
6. Leaving applicants to discover missing items themselves.
