# V26 — Visual-debt inventory

Two kinds of evidence back this inventory:
- **Measured from computed output**: the tangerine census (`scripts/qa/v26/census.mjs`, which walks every visible element on
  the core routes of the four products at 1440 px) and the cascade metrics (`scripts/qa/v26/css-metrics.mjs`).
- **Read from the BEFORE captures**: `docs/qa/v26/visual/before/`.

Status: **fixed** = changed and re-measured; **kept** = reviewed and judged right; **open** = recorded, not changed (reason
given).

## 1. Colour: tangerine used as decoration

The rule (FRONTEND_CONVENTIONS "V25", REPORT §317): tangerine is for **the** primary action, the current or selected item,
and focus. Count badges, tints, progress bars, info callouts and secondary buttons are ink or neutral. Semantic colours
(success, warning, danger) stay semantic.

| Element | Where | Before | After | Root |
|---|---|---|---|---|
| Notification / nav / queue counts (`hg-bell__count`, `hg-snav__count`, `yx-navbadge.bg-primary-transparent`, `ag-revhub__count`) | all four products | tangerine fill or tint | ink fill, white text | shared `layout.css` + the YNEX skin, at the source (not per page) |
| `progress-bar.bg-primary` | agency settings/performance, university agencies | tangerine | ink | YNEX skin (console scope) |
| `.hg-callout` in the consoles | university agencies, all console callouts | tangerine 6 % tint (`_hangyul-skin.scss:130`) | warm neutral | the skin rule itself |
| `avatar.bg-primary-transparent` | workspace section icons, university application, programmes | peach | neutral sunken | skin (console scope) |
| Workspace "할 일" (`btn-primary-light`) | agency workspace header | peach: read as a second primary | neutral secondary (`btn-light`) | the button class |
| Review scope segmented control (전체 · 내 담당 · 미배정) | agency 지원·서류 | filled tangerine (`btn-primary`) | white + ink, like the review mode switch | `DocumentQueue.tsx` + one segmented rule |
| Inbox filter chips | agency 메시지 | filled tangerine selected chip + tinted count | ink outline selected, neutral count | `Messages.tsx` |
| Selected queue row | agency review queue | peach fill + edge | white-hover + the tangerine edge only | `styles/base.css` |

**Census** (stray tangerine fills, comparable classification): **51 → 0**. The first classifier counted 59. Eight of those
are legitimate under the rule and are now classified so:
- the journey's current node (`aria-current="step"`)
- the one highlighted analytics bar (`is-highlight`)
- the recommended plan on the pricing section
- the warning scale of the agency heatmap

Dark text on a solid tangerine fill: **0** before and after.
Raw data: `census-before.json`, `census-after.json`.

## 2. CSS archaeology (RC-03)

| App | Version-named files | Files loaded | Declarations | `!important` | Shadowed declarations (dead) |
|---|--:|--:|--:|--:|--:|
| marketing-web | 9 → **0** | 19 → 15 | 5,961 → **4,849** | 31 → 26 | **82 → 17** |
| student-web | 9 → **0** | 24 → 15 | 7,990 → 7,845 | 60 → 58 | **151 → 56** |
| agency-web | 8 → **0** | 24 → 16 | 7,501 → 7,402 | 69 → 69 | **126 → 27** |
| university-web | 5 → **0** | 17 → 12 | 5,519 → 5,426 | 80 → 80 | **114 → 21** |

How the consolidation worked (`scripts/qa/v26/css-consolidate.mjs`):
- The version layers were merged into purpose-named files under `src/styles/`, in their original order, so the cascade did
  not change.
- 91 declarations were removed because a later rule in the same file, with the same selector and context, always overrode
  them.
- In the shared package, 38 more were removed from `university.css`. Another 50 came out of the V6 `console.css`: it only
  applies under `html[data-product]`, and in that case `console-v22.css` always loads after it.

Proof that nothing visible changed: pixel diffs on 54 full-page shots (27 routes × 1440/390) before and after. 51 are
identical. The other 3 differ by ≤ 94 px. Those 3 are measured noise: two of them also differ between two runs with no code
change in between, and one is ±1 RGB at four panel corners (`completion/logs/css-consolidation-pixel.log`).

The remaining shadowed declarations sit in the shared package files (`components.css` → `identity.css`) and in files that
load lazily. Removing those is not provably safe for every app that loads them, so they were left in place.

**RC-29 (found while attributing the bundle).** The marketing production entry stylesheet *grew* 249 → 276 KB during V26
although every authored count fell. The cause was not CSS at all: since V7 the shared Vite config had been purging the two
oldest marketing files **by path regex** at build time, and the consolidation's rename switched that purge off. Dev had
served the unpurged files all along (368 rules in dev, 53 in production). V26 removed the dead rules at source with the
build's own PurgeCSS options (`scripts/qa/v26/prune-marketing-base.mjs`; 368 → 56 rules, 46 → 13 KB; the one false
negative — PurgeCSS treats `:where(p, h1, …)` as a conjunction — kept on purpose), deleted the path rule, and proved with
a DOM probe that none of the 301 removed selectors matches anything on 15 marketing routes at 1440 and 390. Production
entry: **246 KB**, under V25. Guarded in `qa:v26` VISUAL (G-CSS-5).

## 3. Composition and controls (from the BEFORE captures)

| Item | Finding | Status |
|---|---|---|
| Student plan cards' "변경" buttons | white outlined; V25's secondary is filled warm-neutral | fixed by moving the other plans behind "다른 플랜 보기" for owners (the order block keeps the primary) — see §343 |
| Student Explore list | one university × 7 rows, a thumbnail per row, the same degree sentence ×5 | fixed: grouped under one university header, the sentence said once |
| Agency workspace | two filled-looking buttons; "처리 필요" contradicting the case strip | fixed: one primary (the next action), the panel reads the server's reason |
| Agency case strip | "담당 · <student name>" when the student is the one who acts | fixed: the owner cell only names someone in the team |
| Marketing directory pagination | small "이전 / 18페이지 중 1 / 다음" at the bottom | see §342 |
| Console page titles | "지원자" sits close under the top bar | kept: consistent with every console page, 24 px gap measured |
| Vendored YNEX literal font sizes on untouched console pages | 165 / 142 literal font sizes in agency/university CSS (mostly in the base files ported from YNEX) | open: changing them changes visible layout on ~30 console pages, so it needs its own visual pass. Recorded in §352 |
| Generic-template feel | YNEX cards with title bars around every console block | open (as above) |

- **University analytics trend chart at 390 px** — the month labels were drawn in SVG viewBox units and shrank to ≈ 5 px on a phone (AFTER capture, 2026-10-28 00:03). Fixed: the SVG is drawn at the container's pixel width (ResizeObserver, re-keyed on the loading state), labels every third month under 420 px; reshot capture `visual/after/university/_analytics-390.png` shows 12-px labels.

## 4. Typography, spacing, radius, shadow

- One control shape everywhere since V25 (`--hg-control-radius` 10 px). The census checks the colour, and `qa:v26` VISUAL
  checks the shape on all four products.
- Literal font sizes: marketing 89, student 120, agency 165, university 142, most of them in the oldest layers. `qa:v26`
  requires that these counts **do not grow**. New V26 CSS uses only the `--hg-type-*` roles.
