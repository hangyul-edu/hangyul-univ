# V9 100-point engineering/product proxy scorecard

*Categories and weights are set by the V9 brief. Every category was re-measured in this pass (axe, visual QA, LCP, E2E and the 442-view capture included). Criteria were written on 2026-10-10 **before** any V9 change. "Before" is scored from `docs/qa/v9/before/` and the API/DB checks in REPORT §55; "After" only from re-measured evidence (REPORT §63). A criterion earns points only when the evidence shows it; partial credit is stated. **No human participated in any test**: criteria that need real users are capped at what proxies (clicks, screens, scripted timings, AI review) can show, and this score is a proxy, never a claim that the service is "objectively 100/100".*

| # | Category | Max | Before (V8 state, V9 rubric) | After |
|---|---|---|---|---|
| 1 | Student value & simplicity | 20 | 12 | 18 |
| 2 | Agency operational efficiency | 15 | 8.5 | 13.5 |
| 3 | University admissions efficiency | 15 | 9.5 | 13.5 |
| 4 | Application quality / success support | 10 | 8.5 | 9 |
| 5 | Documents / submission | 8 | 6 | 7 |
| 6 | Visa / arrival | 8 | 6.5 | 7.5 |
| 7 | Visual design | 6 | 3 | 4 |
| 8 | Information architecture | 4 | 2.5 | 3.5 |
| 9 | Data visualization | 4 | 3.5 | 3.5 |
| 10 | Localization | 3 | 1.25 | 2 |
| 11 | Mobile | 2 | 1 | 1 |
| 12 | Performance | 2 | 1 | 2 |
| 13 | Accessibility | 1 | 1 | 1 |
| 14 | Reliability | 1 | 0.5 | 1 |
| 15 | Trust | 1 | 0.5 | 1 |
| | **Total** | **100** | **65** | **87.5** |

## Criteria

### 1. Student value & simplicity (20)
| Criterion | Pts |
|---|---|
| A zero-knowledge visitor gets a useful, honest answer (incl. a realistic *route* when the target degree is blocked) before any account, ≤ 4 inputs | 4 |
| One journey: home names one next action at every stage (exploring → settled), action visible in the first phone viewport | 3 |
| Discovery rows answer can-I-apply / why / missing / cost / deadline / language / scholarship / unlock without expanding; missing data never shown as ineligibility | 3 |
| One money model: every payment line has payee, timing, refundability and basis; money-to-show (visa funds) is separate and present before the visa stage | 3 |
| Parent / sponsor can understand cost, dates and progress without the student forwarding screenshots — and without seeing private content | 2 |
| Progressive profile: each question says what it unlocks; no long form before value | 2 |
| Navigation follows the stage; no page answers two unrelated questions | 2 |
| Measured task cost (clicks/screens) for the Nepal flow lower than before | 1 |

### 2. Agency operational efficiency (15)
| Criterion | Pts |
|---|---|
| One ranked work queue with explainable reasons and work-type filters; top 10 urgent in 0 clicks | 3 |
| One waiting-on model (student/counselor/agency/Hangyul/university/external/no one) used identically across products | 2 |
| Workspace header answers why-not-moving / next action / waiting on / deadline / owner | 2 |
| Review loops (document, essay) open → decide → next with ≤ 1 navigation | 2 |
| Team: expertise, availability, transparent weighted capacity; reassignment when someone leaves | 2 |
| Secondary pages purpose-built (catalog, templates w/ scopes+language, providers, submissions queue) | 2 |
| Manager: six questions answerable in ≤ 60 s, each drilling to exact records; process-quality metrics with n | 2 |

### 3. University admissions efficiency (15)
| Criterion | Pts |
|---|---|
| Home: what needs a decision first, intake progress second | 2 |
| Requirement · evidence · status first on review, visible at 1024 without scrolling | 3 |
| Review-and-advance without returning to the list | 2 |
| Safe bulk actions incl. select-all-matching with preview; no careless bulk decisions | 2 |
| Analytics by question, ≤ 3 screens per tab, metric → records → record with matching totals | 3 |
| Programs & rules: student preview, history, reliable impact preview | 2 |
| Partnership value with cohort and denominator on every number | 1 |

### 4. Application quality / success support (10)
| Criterion | Pts |
|---|---|
| Strategy per application: named items, owner, reason; no score | 2 |
| Portfolio (strong/possible/blocked, deadlines, fees, budget and language risk) for student and counselor | 2 |
| Writing review: prompt/limit/deadline/reviewer/SLA/version visible; rubric; AI never invents; human authoritative | 3 |
| Deadline compliance: risk surfaced before it is missed, to the right owner | 2 |
| Language route planning (what unlocks which programs) | 1 |

### 5. Documents / submission (8)
| Criterion | Pts |
|---|---|
| Upload once, reuse with applicability per application (incl. visa) | 2 |
| Document QA findings with suggestions only until verified | 2 |
| Privacy at the point of upload: who sees it, where used, retention, what can be withdrawn | 1 |
| Submission: connector type truthful per university; guided hand-off; evidence captured; one queue across methods | 3 |

### 6. Visa / arrival (8)
| Criterion | Pts |
|---|---|
| Route resolved per nationality/jurisdiction from researched playbooks, revalidated with sources | 3 |
| Visa view shows only route / ready / needed now / who provides / where / next; ≤ 3 phone screens | 2 |
| Reuse of dossier documents for visa | 1 |
| Post-admission services activate progressively (housing types, pickup with flight, settlement) with honest provider states | 2 |

### 7. Visual design (6)
| Criterion | Pts |
|---|---|
| Hangyul-native composition (not recognisably Eduan / YNEX) on marketing hero and console shells | 2 |
| Consistent component language across the four products; brand moments only where earned | 2 |
| No visual defects in captured views at the 10 widths (overlaps, clipping, broken scripts) | 2 |

### 8. Information architecture (4)
| Criterion | Pts |
|---|---|
| One question per screen (written and checked) | 2 |
| No duplicate destinations; labelled navigation at 1024 | 2 |

### 9. Data visualization (4)
| Criterion | Pts |
|---|---|
| Question-titled, definitions, n < 5 withheld | 2 |
| Drill-down contract with matching totals (tested) | 2 |

### 10. Localization (3)
| Criterion | Pts |
|---|---|
| Every offered student locale complete by the manifest + leak scan | 1.5 |
| Synthetic review ≥ 4/5 across four reader profiles for every offered locale; honest status taxonomy | 1 |
| RTL correct | 0.5 |

### 11. Mobile (2) — 0 page overflow and 0 core sideways tables at 320–820 (1); phone primary action and native Android smoke for 3 apps (1).
### 12. Performance (2) — marketing phone LCP ≤ 2.5 s hard / ≤ 1.8 s aspirational (1); desktop LCP ≤ 1.8 s and initial JS not increased (1).
### 13. Accessibility (1) — axe 0 violations on every audited route at 1280/390.
### 14. Reliability (1) — deterministic E2E 0 skipped; adversarial recovery suite passes.
### 15. Trust (1) — no overclaims anywhere (language counts, partners, rates); privacy and source dates visible.


## After scoring (2026-10-14) — what each category earned and why points were withheld

| # | Category | After | Earned | Withheld |
|---|---|---|---|---|
| 1 | Student value & simplicity | 18 / 20 | routes before an account (4); one next action per stage (3); discovery rows answer without expanding and missing data is never ineligibility (3); one money model with payee/timing/refund + money-to-show (3); sponsor view (2); progressive profile (2); stage navigation and one question per screen (2) | measured task cost (1) is scripted, not observed; result-card read time unverified with users (1) |
| 2 | Agency operational efficiency | 13.5 / 15 | one ranked queue with reasons and work-type filters (3); one waiting-on model used identically everywhere (2); workspace header (2); review loops (2); team expertise/availability/weighted capacity/reassignment (2); secondary pages rebuilt (2); manager six questions + process quality (2) | 1.5 withheld: the agency native app still shows the old waiting values and no V9 queue; external channels unconnected, so some conversation still happens outside |
| 3 | University admissions efficiency | 13.5 / 15 | decisions first (2); evidence first at 1024 (3); review-and-advance (2); safe bulk incl. select-all-matching with preview (2); analytics by question with matching drill-down (3); programs/rules with preview, history, impact (1.5) | 1.5: impact preview often answers "not enough data" on real-world-sparse data (intended, but less useful); partnership value mostly withheld at n < 5 in the demo |
| 4 | Application quality / success support | 9 / 10 | strategy items (2); portfolio (2); writing workspace, rubric, no fabrication, human authoritative (3); deadline risk to the right owner (2) | language-route planning counted under category 1; writing not re-validated with reviewers |
| 5 | Documents / submission | 7 / 8 | upload once with per-application and visa applicability (2); QA findings as suggestions (2); privacy at the point of upload (1); connector truth + guided hand-off + evidence + one queue across methods (2 of 3) | 1: no rail integration exists, so "submitted" still depends on the student reporting back |
| 6 | Visa / arrival | 7.5 / 8 | routes revalidated against current official sources with dated effective rules (3); visa view ≤ 3 phone screens (2); dossier reuse (1); progressive post-admission services with honest provider states (1.5 of 2) | 0.5: housing inventory, flight data and providers are all external |
| 7 | Visual design | 4 / 6 | Hangyul-native hero and labelled console shell (2); consistent component language (1); 0 defects in 436 captured views (1) | 2: the inner marketing pages and console pages still use Eduan/YNEX anatomy; no human blind test has confirmed any preference |
| 8 | Information architecture | 3.5 / 4 | one question per screen written and checked (2); no duplicate destinations, labelled navigation at 1024 (1.5 of 2) | 0.5: Support/Help remain two destinations behind one entry |
| 9 | Data visualization | 3.5 / 4 | question titles, definitions, n < 5 withheld (2); drill-down contract with matching totals, tested (1.5 of 2) | 0.5: a few drill-downs land on a filtered list that shows short ids for off-page rows |
| 10 | Localization | 2 / 3 | 20 locales complete by manifest + leak scan (1.5); synthetic review ≥ 4 for every offered locale with an honest taxonomy (0.5 of 1) | 1: no human review exists for any locale; RTL not re-measured in V9 |
| 11 | Mobile | 1 / 2 | 0 page overflow and 0 sideways core tables at 320–820 across 436 views (1) | 1: Android smoke not re-run in V9; native apps lack the V9 agency queue |
| 12 | Performance | 2 / 2 | initial JS down ~25 % versus V8 and below the V8 figure for every app; two N+1 fixes bring every measured endpoint under 1 s p95 at scale | — (LCP phone 2.01 s / desktop 1.36 s: hard target met, desktop back under the aspiration) |
| 13 | Accessibility | 1 / 1 | axe-core re-run in V9: 0 violations on the audited routes of all four apps at 1280 + 390, after fixing one nested-interactive violation this run found (shared DataTable phone row card) | — |
| 14 | Reliability | 1 / 1 | 18/18 adversarial recovery scenarios pass with 0 xfail, 10 real bugs fixed; deterministic E2E database | — |
| 15 | Trust | 1 / 1 | overclaims removed (language count, "Korean is reviewed", seeded provider English, odds-style tier words); sources and dates visible; no locale marked human-reviewed | — |

**Total: 87.5 / 100.** The target in the brief was ≥ 95; V9 does not reach it, and the gap is almost entirely the things that need people: user research, human translation review, a human visual test, and real business/legal/provider data. Those cannot be bought with more engineering, and inventing them would be exactly the dishonesty the brief forbids.
