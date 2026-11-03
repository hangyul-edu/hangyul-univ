# V8 100-point quality scorecard

*V8 scored 2026-10-09 from `docs/qa/v8/after/`, the gates in REPORT §53 and the workstream logs. **No human participated in any V8 test**: criteria that need user evidence are capped at what proxies (screens, clicks, sideways tables, load, AI review) show, and say so.*

*Scored from evidence, not opinion. Each category lists its criteria (each worth the points shown), the evidence used and the V7 baseline (measured 2026-10-09 before any V8 change, `docs/qa/v8/before/`). The V8 column is filled only after the V8 work is re-measured (REPORT §53). A criterion is awarded only when the evidence shows it; partial credit is stated.*

| # | Category | Max | V7 baseline | V8 |
|---|---|---|---|---|
| 1 | Marketing & first impression | 10 | 6 | 9 |
| 2 | Student usability | 20 | 13 | 18 |
| 3 | Student decision support | 10 | 6 | 9 |
| 4 | Agency operational UX | 15 | 10 | 13 |
| 5 | University admissions UX | 15 | 9 | 13 |
| 6 | Information architecture | 5 | 3 | 4 |
| 7 | Visual quality & consistency | 5 | 3 | 3 |
| 8 | Data visualization | 5 | 3 | 4.5 |
| 9 | Mobile & responsive quality | 5 | 2 | 4 |
| 10 | Localization | 3 | 1 | 2.5 |
| 11 | Accessibility | 2 | 2 | 2 |
| 12 | Performance | 2 | 1 | 2 |
| 13 | Reliability / error prevention | 2 | 1 | 2 |
| 14 | Trust / privacy / transparency | 1 | 1 | 1 |
| | **Total** | **100** | **61** | **87** |

## 1. Marketing & first impression (10)

| Criterion | Pts | V7 evidence | V7 |
|---|---|---|---|
| Within the first viewport a visitor sees place (Korea), promise and one action | 2 | Hero photo + "Your next chapter is in Korea." + one CTA at 390 and 1440 | 2 |
| Value before an account (eligibility result) reachable in ≤ 1 scroll on phones | 2 | Check is the second section (≈1 scroll); 3 selects + button | 1.5 |
| Shows the real product concretely (requirement gap, reused document, reviewer comment, visa document) | 2 | V7 home has no product moment — generic phrases only | 0 |
| Home length earns its place: ≤ 9 phone screens, no repeated explanation | 2 | 12.8 screens; process explained three times | 0 |
| Distinctly Hangyul (not "Eduan with new text"): brand device, own composition | 2 | Tangerine sun, Korea photography, Hangyul copy — but section anatomy is Eduan's one-to-one | 1 |
| **Subtotal** | 10 | | **4.5 → 6 rounded with secondary pages credible (trust/universities/program pages consistent)** |

*Rounding rule: category subtotals are rounded to the nearest whole point after adding a consistency credit (max 1.5) for secondary pages that share the same quality; V7 secondary marketing pages are consistent but long (trust 17.1 screens) → +1.5 → 6.*

## 2. Student usability (20)

| Criterion | Pts | V7 evidence | V7 |
|---|---|---|---|
| Home first viewport answers where / what now / when with the action visible at 390 | 4 | Next step text visible; action at the viewport edge (Lan), below it for others | 2.5 |
| Navigation follows the journey stage | 3 | Fixed tabs for every stage | 0 |
| Discovery useful in the first session (early student) | 4 | Dilnoza: 66 × "Not eligible yet" from missing data | 0.5 |
| Documents: upload once, reuse, legalization at point of need | 3 | Dossier + applicability per application (V5) | 3 |
| Application workspace: one named next item, who-does-what lanes | 3 | V4/V5 workspace, 2.8 screens | 3 |
| Visa / housing / arrival activate only when relevant | 3 | Home switches track from visa stage; nav does not | 2 |
| Writing: editor + reviewer loop clearly better than Word + chat | — | (scored under 3 and 4) | — |
| Rounding: sum 11 → secondary consistency +2 (support/help duplicate costs 1) | | | **13** |

## 3. Student decision support (10)

| Criterion | Pts | V7 evidence | V7 |
|---|---|---|---|
| Result card readable in ~3 s (university, program, eligibility words, first-year cost, deadline) | 3 | Grouped by university; cost + language + deadline on row; verdict words | 2.5 |
| Missing information never shown as ineligibility | 2 | Fails (Dilnoza) | 0 |
| Compare shows differences first, never a winner; has a next action | 2 | Differences highlighted; no primary action | 1.5 |
| One cost model everywhere incl. Hangyul fee and pre-arrival cash | 2 | First-year range everywhere (V4); Hangyul service fee not in the budget model | 1 |
| Offer decision mode (amount due, deadline, scholarship) | 1 | "You pay ₩X by …" (V4) | 1 |
| **Subtotal** | 10 | | **6** |

## 4. Agency operational UX (15)

| Criterion | Pts | V7 evidence | V7 |
|---|---|---|---|
| Today answers who / why / most urgent in 5 s with reasons | 3 | Five drill-down counts + queue; no priority reasons | 2 |
| Students table usable at 1024–1279 without sideways scroll; operational views | 3 | Sideways at 1024; 6 views | 1.5 |
| Workspace top answers "why is this case not moving" | 2 | Blocker card first (V7) | 1.5 |
| Review loops (document, essay) near-zero navigation | 2 | Keyboard loops, auto-advance (V4–V6) | 2 |
| Messages: one timeline, channel model visible | 2 | In-app only; no channel UI | 0.5 |
| Manager: backlog, ageing, overload, SLA, slow stages | 2 | Performance has stage durations + workload; no ageing/backlog | 1 |
| Secondary pages purpose-built (no duplicates, no raw data) | 1 | Deadlines ≈ Tasks; audit JSON; enum leak | 0 |
| Rounding: 8.5 + consistency 1.5 | | | **10** |

## 5. University admissions UX (15)

| Criterion | Pts | V7 evidence | V7 |
|---|---|---|---|
| Overview: decisions first, intake progress second | 2 | Yes (V7) | 2 |
| Applicants scannable at 1024–1440 without sideways scroll | 3 | Sideways at 1024 | 1 |
| Applicant review: requirement ↔ evidence side by side, ≤ 3 screens | 3 | Table exists; 5.1 screens; 0 h1 | 1.5 |
| Analytics drill down to exact records under filters; loads fast | 3 | Disabled under filters; 25.5 s | 1 |
| Safe bulk actions | 2 | None | 0 |
| Exports useful (presets/config) | 1 | Download buttons | 0.5 |
| Programs & rules: master-detail, preview, history | 1 | Master-detail + preview; opens on dev fixture; no history view | 0.5 |
| Rounding: 6.5 + consistency 2.5 | | | **9** |

## 6. Information architecture (5)
V7: duplicate pages (deadlines/tasks, pipeline/applicants, support/help, saved/explore, rules/programs), fixed student nav, HQ repeats counts → **3**.

## 7. Visual quality & consistency (5)
V7: template-level shells and marketing; secondary console pages only skinned; four generations of student CSS → **3**.

## 8. Data visualization (5)
V7: question-titled charts, n<5 honesty (+2), definitions (+1); drill-down broken under filters, slow analytics, HQ duplicate counts → **3**.

## 9. Mobile & responsive (5)
V7: no page overflow (+1), phones usable (+1); 21 sideways tables, 54 phone views without a primary action, 12.8/14.2/17.1-screen pages → **2**.

## 10. Localization (3)
V7: 46 locales, marketing 100 % (+1); student namespace in 12 locales only; no review taxonomy; leak checks only on Burmese/Nepali core flow → **1**.

## 11. Accessibility (2)
V7: axe 0 violations on all audited routes at 1280/390 → **2** (8 views with h1 ≠ 1 noted for V8).

## 12. Performance (2)
V7: marketing phone LCP 2.23 s (< 2.5) (+1); CSS +20 KB gzip, analytics 25.5 s → **1**.

## 13. Reliability / error prevention (2)
V7: duplicate-upload prevention, SUBMITTED only with evidence, state machine (+1); E2E nondeterministic (3 skips), E2E residue visible in dev data → **1**.

## 14. Trust / privacy / transparency (1)
V7: sources with dates, no invented proof, privacy statements → **1** (PRODUCT.md contradiction noted).

## V8 scoring evidence (2026-10-09)

| # | Category | V8 | Evidence | Not awarded because |
|---|---|---|---|---|
| 1 | Marketing | 9 | Product moments (2); home 8.6 / 8.1 screens, one explanation of the process (2); check progressive and remembered on phones (2); place, promise and action in the first viewport (2); trust 17.1 → 5.9, universities 11.4 → 5.4 | Distinctness 1/2: hero and most section anatomy are still Eduan's; the synthetic blind test saw "no difference" in the hero |
| 2 | Student usability | 18 | Primary action in the first viewport on every home persona (4); stage-aware navigation (3); documents (3); workspace (3); visa/housing/arrival in the navigation by stage (3); discovery 2/4 | Discovery not validated with a real early student; visa page still 5+ phone screens; no human round |
| 3 | Decision support | 9 | Missing data never shown as ineligibility, tested (2); compare shows differences first plus next action (2); one cost model including the Hangyul fee and pre-arrival cash (2); offer (1); result card 2/3 | Result card read-time not measured with users |
| 4 | Agency | 13 | Today ranked with reasons, 0 clicks to the top 10 (3); 0 sideways tables at 768–1440 plus 8 views with count = rows (3); "why isn't this moving" (2); review loops (2); channel model, external channels honest (2); manager page (1/2); secondary pages (0/1) | Five secondary pages not recomposed; Operations not validated with managers; Today tier tags fixed late |
| 5 | University | 13 | Overview (2); applicants without sideways scroll plus decision need (3); analytics exact drill-downs, < 2 s (3); review 2.4 screens, one h1 (2/3); safe bulk (1.5/2); exports (1); programs and history (1); rounded down | Evidence table below the fold at 1024; bulk selection limited to the page; analytics 7.1 screens |
| 6 | IA | 4 | Deadlines/consultations → tasks, pipeline → board, rules → programs, saved → discovery, one help entry by stage | Support and Help are still two pages behind the single entry; collapsed rail costs wayfinding (blind test) |
| 7 | Visual | 3 | CSS layers pruned (1,224 selectors), AuthCover, header fix | No visual preference shown in the blind test (inconclusive); student still carries several CSS generations |
| 8 | Dataviz | 4.5 | Question titles, n < 5 withheld, glossary from the API, drill-down equal to totals (pytest), single-hue bars, HQ failure list without duplicate counts | Analytics page length |
| 9 | Mobile | 4 | 0 page overflow (247 views plus 150 at 320/768/1728); sideways tables 21 → 3; longest phone page 17.1 → 9.0; Android smoke for 3 apps | 3 university tables at 390; 50/99 phone views without a primary action (many are lists, but not all) |
| 10 | Localization | 2.5 | 55 locales; taxonomy; 9 synthetic reviews with records; RTL ar/ur/fa/he 32 views clean; V8 copy in 43/12 locales | No human review; 10 new locales are `common` only; ar/ur/fa student partly English |
| 11 | Accessibility | 2 | axe: 0 violations on 57 routes × 1280/390; h1 ≠ 1: 8 → 0 | — |
| 12 | Performance | 2 | LCP 1.85–2.05 s phone (< 2.5); CSS gzip down in all 4 apps; JS within the V7 range; analytics 25.5 s → < 2 s | (desktop LCP ≈ 2.0 s, slower than V7's 1.66 s measurement) |
| 13 | Reliability | 2 | Deterministic E2E on an isolated, freshly cloned database: 47/47 twice, 0 skipped (V7: 44 + 3 skipped); pytest 257 | — |
| 14 | Trust | 1 | PRODUCT.md contradiction fixed; readiness never claims active; synthetic work labelled; no HUMAN_REVIEWED | — |

**Total V8: 87 / 100** (V7: 61). The largest unearned points need people: usability rounds, a human blind test and human translation review.
