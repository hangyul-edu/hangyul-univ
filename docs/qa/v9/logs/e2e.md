# V9 E2E gate — failures, causes, fixes

Runner: `flock /tmp/claude-0/hg-build.lock node scripts/qa/e2e-run.mjs [playwright args]` — isolated stack
(`hangyul_univ_e2e` cloned from `hangyul_univ_e2e_tpl`, API :8090, production previews 4600–4603). The dev stack
(:8000, 3100–3103) was never stopped or touched; only read-only GETs were made against it while diagnosing.

Start point: **38 passed, 8 failed, 1 did not run** (`docs/qa/v9/gates/e2e.log`).

Method per failure: reproduce on the isolated stack → read the failure's `test-results/…/error-context.md` page
snapshot → read the owning component and decide honestly: V9 deliberately changed the UI (stale assertion → update the
spec to the new UI, same user journey) or the product regressed (fix the product, keep the spec).
No assertion was removed, nothing was skipped, no timeout was loosened.

## One row per failure

| # | Spec › test | Cause | Verdict | Fix |
|---|---|---|---|---|
| 1 | `redesign.spec.ts` › student: home, discovery…, documents and visa | `heading "What you will need"` not found on `/visa`. V9 S6 folded the visa plan: the pre-admission checklist is no longer a section with the title `docs.previewTitle`, it is the fold `Your visa documents · N of M ready` (`Visa.tsx:142`, always `docs.title`), and the per-row `For your nationality` tag sits inside it. | stale spec | Assert the fold + its progress, open it (`summary` click) and assert a row tagged *For your nationality* — the same "the real checklist before admission" journey, one disclosure step later. |
| 2 | `v3-marketing.spec.ts` › quick eligibility on the home page | Timed out clicking the hero link `See where I can apply`. V9 S1 made the check *be* the hero (`pages/home/v9.tsx`, `Home.tsx:25`): the three questions are on the first screen, so the link that scrolled to a separate `#check` section was deleted ("one fewer scroll, one fewer action"). | stale spec | Dropped the scroll click; the spec now takes the check where it is (`#top #check .mk-qs`, still asserted in viewport) and answers it. Counts, honesty note and prefilled `/register?…` link unchanged. |
| 3 | `v3-student.spec.ts` › quick eligibility … answers carry into the profile | `Strong match\|Possible match` not found for a brand-new account. V9 S5 collapses zero-count verdict groups (`Explore.tsx:170`), so a student with no grades is offered only the groups she is in — `Needs your grades 21` / `Not eligible yet 10`; V8 still rendered `Strong match 0` / `Possible match 0` chips, which is what the regex used to match. | stale spec | Assert the verdict group she is really in and that it is the one open: `button "Needs your grades N"` with `pressed: true`. Keeps the point of the test (unknown education is never shown as ineligibility) and drops an assertion that only passed on a zero-count chip. |
| 4 | `v3-student.spec.ts` › compare leads to a first-year budget | `Not included: health insurance` not found on `/budget`. V9 S4 replaced the single `notIncluded` line ("… — no reliable figure yet") with the coverage trio `included` / `separate` / `noFigure`: health insurance, visa fee and residence card are now named **with their amounts** as *Paid separately*. | stale spec | Assert `Paid separately: … Health insurance` — the same guarantee (costs outside the range are named, never folded in) against the more honest wording. |
| 5 | `v3-university.spec.ts` › university requests one document… | `.uc-requests` not found after sending. V9 review-and-advance (`ApplicationDetail.tsx:796-798`, `onSent={advance}`) opens the **next** applicant after a document request, with the behaviour disclosed and user-controlled by the checkbox "Open the next applicant after deciding or requesting documents" (on by default). The request was created correctly; the reviewer had simply moved on. | stale spec (deliberate feature) | Switch the checkbox off before requesting, so the reviewer stays on the applicant and the request block is still asserted live (label + exact note). The API-level assertions (OPEN request, checklist lead, student task with the exact words) are untouched. |
| 6 | `v5-flow-g.spec.ts` › Today carries application, writing and service work… | `#attention` not found. V9 A2 replaced the category-count block with ONE ranked queue plus work-type chips (`Dashboard.tsx:110-176`): there is no longer an "Essay reviews"/"Service cases" aggregate row to click. | stale spec | UI half rewritten against the new queue: region *Who needs you today*, then for each of Applications / Writing / Services with a non-zero count, press its chip and assert the list has exactly that many rows (`by_type[t]` is the same predicate the chip counts, `priority.ranked`), the writing row's action links to `/essays/<id>` and opens it, and every row carries its own action (no KPI tiles). The API half (today's five keys, writing count = `/writing/queue?view=…`, services count = its Services view) is unchanged. |
| 7 | `v5-visa.spec.ts` › FLOW E — from admission to a recorded visa submission | Timed out on `button /ready — … reused from your documents/`. Same V9 S6 fold as #1: the ready/reused toggle now lives inside the `Your visa documents` fold. | stale spec | Open the fold first, then click the ready/reused toggle inside it and assert *From your documents*. The rest of FLOW E (what needs you now → form sections → appointment → hand-off → recorded submission) is unchanged. |
| 8 | `v6-submission.spec.ts` › student authorises → agency records… | `heading "Ready to submit"` (h1) not found. V9 A7 replaced the V6 "Ready to submit" page with the Submissions pipeline (`Submissions.tsx`): h1 *Submissions*, seven states as chips, landing on the most pressing non-empty state (Issue → Confirmation missing → …). An authorised application waits under the `Authorized` chip and opens the very same V6 detail drawer. | stale spec | Assert h1 *Submissions*, press the `Authorized` chip, open the student's row; the drawer is now titled `<student> · <university>` so it is matched by the student's name. Final review → reference → receipt → "Recorded — the application is now Submitted." unchanged. |

## Runs

1. **Reproduction + first fixes** — `e2e-run.mjs e2e/redesign e2e/v3-marketing e2e/v3-student e2e/v3-university
   e2e/v5-flow-g e2e/v5-visa e2e/v6-submission`: **12 passed, 4 failed, 1 did not run**. Fixed by this run:
   `v3-marketing` (1), `v3-student` (2), `v6-submission` (1). The four that still failed were my own locator mistakes,
   not new product findings:
   - `redesign` + `v5-visa`: `details.v9-fold … .locator('summary')` is strict-mode ambiguous — every document row
     inside the fold has its own `<summary>Details</summary>` (12 resp. 5 matches). Now clicks the fold's own
     `.v9-fold__t`.
   - `v3-university`: the `if (await openNext.count() …)` guard ran before the decision card had rendered, so the
     checkbox was never unchecked and review-and-advance still moved on. Now waits for the checkbox, unchecks it and
     asserts it is off before requesting.
   - `v5-flow-g`: pressing a chip that is already active *clears* the filter (`setType(type === w ? null : w)`), so
     re-pressing "Writing" after the loop put the unfiltered list back and the first row's action was a submissions
     row. Each chip is now pressed from the unfiltered queue, and the essay-link check happens inside the writing
     iteration after `toHaveCount` has settled the list.
2. **Second iteration** — `e2e-run.mjs e2e/redesign e2e/v3-university e2e/v5-flow-g e2e/v5-visa`
   (`HG_E2E_SKIP_BUILD=1`: only specs had changed since the build): **7 passed, 0 failed** — including
   `v3-university › cancelling the request closes the student task`, the test that "did not run" in the gate log
   because its serial predecessor failed.
3. **Full suite** — `flock /tmp/claude-0/hg-build.lock node scripts/qa/e2e-run.mjs` → `docs/qa/v9/gates/e2e.log`:
   **47 passed (1.7 m), 0 failed, 0 skipped, 0 "did not run"**, runner exit 0 — the suite's full 47 tests
   (38 passed + 8 failed + 1 did not run before).

## What I did not do, and why

* **No product code was changed.** The only files touched are the seven specs above and this log — nothing under
  `apps/`, `packages/` or `server/`. No unit test is affected (nothing imports `e2e/*.spec.ts`), so `npm run test:web`
  and `pytest` were not re-run for a change that does not exist. The server guarantees behind the rewritten
  assertions already carry V9 unit tests: `test_today_queue_types_filter_the_same_list` (chip count = the rows the
  chip filters, A2) and `test_submissions_pipeline_states_counts_and_tenancy` (A7).
* **Nothing was weakened**: no assertion removed, no `test.skip`, no timeout raised. Three replacements are stronger
  than what they replace — `pressed: true` on the verdict group, `not.toBeChecked()` on review-and-advance, and
  chip count = row count (the V8 spec never checked that in the UI).
* The **service-cases** branch of FLOW G is kept but stays dormant on this dataset: `/agency/today` reports
  `service_cases.count = 0` for `manager@lotus` (checked read-only against the dev stack), so neither the V8 spec nor
  this one exercises it. Not a V9 gap — Today has a `services` chip and `priority.py` draws service reasons from the
  same `concierge.today_items` the counter uses.
* `docs/qa/v9/gates/e2e.log` was overwritten by run 3 (it is the gate artefact for the latest run); the starting
  numbers and every failure it contained are recorded above.


## Summary (≤25 lines)

* **8 of 8 failures were stale specs. 0 were product bugs.** Every one traced to a V9 change that is documented in
  the workstream logs and in a comment in the owning component, and in each case I checked the product still does the
  honest thing before touching the spec:
  1. `redesign` + `v5-visa` — S6 folded the visa plan (`Visa.tsx`); the checklist is the fold *Your visa documents ·
     N of M ready*. The reuse ("From your documents") and the per-row *For your nationality* tag are still there,
     one disclosure step in.
  2. `v3-marketing` — S1 made the check the hero (`home/v9.tsx`); the hero link that scrolled to a separate `#check`
     section is gone because the section is gone. Counts, "not an admission prediction" and the prefilled
     `/register?…` link are unchanged.
  3. `v3-student` (discovery) — S5 collapses zero-count verdict groups, so "Strong match 0 / Possible match 0" no
     longer exist for a student without grades; she gets *Needs your grades*, which is the honest verdict.
  4. `v3-student` (budget) — S2's money plan replaced "Not included: … no reliable figure yet" with
     *Included in this range: … / Paid separately: visa fee · residence card · health insurance (NHIS) …* — strictly
     more honest, with the amounts and their basis.
  5. `v3-university` — U2 review-and-advance opens the next applicant after a document request; the request itself
     is created, the status moves to ADDITIONAL_DOCUMENTS and the student's task carries the exact note (all still
     asserted). The spec now switches the disclosed checkbox off and reads the request back on the evidence card.
  6. `v5-flow-g` — A2 replaced the category-count block with one ranked queue + work-type chips; the UI half is
     rewritten against the chips (chip count = rows it lists; a writing row opens its essay; every row is an action).
  7. `v6-submission` — A7 replaced "Ready to submit" with the Submissions pipeline; the authorised application waits
     under the *Authorized* chip and opens the same V6 record drawer.
* **Final: 47 passed, 0 failed, 0 skipped, 0 "did not run"** (`docs/qa/v9/gates/e2e.log`, runner exit 0).
* **Nothing still failing.** No product file was changed, so no unit test needed re-running (see above).
