# NP.svg — Flag of Nepal

| | |
|---|---|
| Source | Wikimedia Commons, `File:Flag_of_Nepal.svg` (`upload.wikimedia.org/wikipedia/commons/9/9b/Flag_of_Nepal.svg`) |
| Licence | **Public domain** (`LicenseShortName: Public domain`, `License: pd`), verified via the Commons API |
| Authority | Drawn to the official construction in *Constitution of the Kingdom of Nepal, Article 5, Schedule 1* (1990) |
| Retrieved | 2026-10-20 |
| Geometry | `viewBox="-17.582 -4.664 71.571 87.246"`, intrinsic 726 × 885 — **taller than wide**, ratio ≈ 0.82 |
| Commons note | `Restrictions: insignia` — the standard marker on national symbols. It is a caution about implying state endorsement, not a copyright restriction; rendering a national flag beside its language in a picker is the ordinary use |

**Why this file is not like the other thirty-one.** Every other asset in this folder is a rectangle at
roughly 3:2. Nepal's is the only non-quadrilateral national flag in the world — two stacked pennons — and
it is *portrait*. It must not be cropped to a rectangle, stretched to one, or masked into a circle
(V17 brief §14). `packages/i18n/src/markets.ts` therefore carries a `flagRatio` per market and
`<Flag>` sizes every flag by **height**, letting the width follow; Nepal is then simply a narrow flag
rather than a special case.
