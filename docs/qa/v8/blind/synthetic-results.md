# Synthetic blind test — results (AI judgement, not user evidence)

**Method.** One AI reviewer (Claude Sonnet) judged 17 V7/V8 pairs labelled only A/B. It had no access to the key or the code. A second, fresh reviewer judged the same 17 pairs with the sides swapped. A preference counts only when it survives the swap. Question: "Which version makes it easier for this user to understand where they stand and what to do next?"

**Result: inconclusive. Position bias dominates.**
- Round 1 picked the right-hand image in 13 of 14 decisions. Round 2 picked it in 12 of 14.
- Pairs 01–03 (marketing hero, trust hero): "no difference" both times. Correct: V8 changed those pages below the first 1800 px.
- Pairs 04–17:

| Outcome | Pairs |
|---|---|
| V8 preferred in both rounds | 2: marketing Universities @390 (compact result rows show city, deadline, language and cost in the first screen); agency Students @1024 (Next action and Deadline visible, V7 cut off before them) |
| V7 preferred in both rounds | 1: university Analytics @1024 (labelled sidebar vs V8's collapsed icon rail) |
| Split (each version won once) | 11 |

**What we take from it** (critique that held in either round, judged on content):
- **Icon rail below 1280 px.** It trades wayfinding for table width. Both rounds preferred the labelled sidebar when the content was otherwise equal. The rail stays the default because 0 sideways tables at 1024 was a hard requirement; the user can expand it, and the choice is remembered. Listed as an open trade-off.
- **Student budget.** One round read the Hangyul fee card at the top as pushing the university numbers down. Acted on: the fee row now follows the program budgets.
- **Discovery.** "For you" showed no count beside a listed group. Acted on: the tab now counts what it lists.
- **Agency Today.** The near-universal "Today" tier tag carries little signal, and the KPI strip with per-row action buttons was valued. Open issue.

No human has judged these pairs. See `README.md`.
