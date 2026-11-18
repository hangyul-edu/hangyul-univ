# Visual defect matrix — launch-final pass (2026-11-18)

Every defect found in this pass, where it was fixed, and how it is now checked. "Shared" means the fix is in a design
token or a shared primitive, so every screen that uses it is fixed, not only the one where it was seen.

| # | Surface | Defect (as found) | Root cause | Fix | Scope | Check |
|---|---|---|---|---|---|---|
| 1 | Student sign-up · verification, 320–393 px | Page 404 px wide; OTP field and Verify squeezed into one row | Card grid had an implicit `auto` column that grew to the unwrapped destination line | Card = `minmax(0, 1fr)`; code field then full-width Verify below 480 px; destination wraps | Page | `qa:launch-signup` (ko, ar) |
| 2 | Student sign-up · verification | "Change" / "Resend" rendered as grey browser buttons | `.hg-link` had no reset when used on `<button>` | `button.hg-link` = tertiary action (reset, focus ring, calm disabled, 44 px on touch) | Shared | matrix + a11y |
| 3 | All apps | Disabled primary = large warm-grey slab | Disabled state neutralised the fill entirely | Disabled primary = pale tangerine wash; neutral controls warm-white with muted text; inputs match | Shared | screenshots |
| 4 | Student sign-up | Four numbered circles took a row on phones | Rail designed for desktop | Phone: one line "2/4 · Verify" over four thin segments (web and native) | Shared | `qa:launch-signup` |
| 5 | Marketing footer | Language picker indented ~11 px; social icons pulled left by negative margins that differed by width | Ghost button and 40 px icon targets had invisible padding; compensated per breakpoint | One rail: equal 44 px bordered icon boxes and a bordered language control start on the column edge; no negative margins | Component | matrix (all widths, 6 languages) |
| 6 | All apps | Page gutter differed per shell (16 / 20 / 12 + 8 / 24 / 28 / 32) | Each shell restated its own numbers | `--hg-gutter` token (16 → ~20 → ~22 → 24 → 32) read by marketing, student and both consoles; `--hg-container-*` widths | Shared (tokens) | rail probe, matrix |
| 7 | Consoles, phone | Stage strip first cell clipped at the left edge | Full-bleed scroller hard-coded −16 px against a 20 px gutter | Scroller uses the gutter token for margin, padding and scroll-padding | Shared | matrix |
| 8 | Student home, 320–390 px | Journey labels collided ("Prepare Apply", "AdmittedVisa"); first label clipped | Six `nowrap` labels in 52 px columns with sideways scroll | Six equal columns that always fit; caption-size labels with ellipsis; current stage shown in full | Component | matrix |
| 9 | Student, 320 px | Tab-bar labels wrapped mid-word ("Universitie/s") | No single-line rule | Labels stay on one line (ellipsis as last resort), one size down below 375 px | Shared | matrix |
| 10 | Any app, phone | Long status sentence widened the page (Operations Submissions 652 px at 412; Student applications in Russian) | `.hg-status` is `nowrap` | Status wraps on phones (dot on first line); stays one line in dense tables | Shared | matrix (ru) |
| 11 | Any app | Select trigger wider than its row (essay editor, workspace, filters; worse in ja/vi/ru) | Trigger was `flex: none` | Trigger may shrink; label and value ellipsise | Shared | matrix (6 languages) |
| 12 | Operations · Universities, 1024–1152 px | Table 134 px wider than the page | Table wrapper turned `overflow: visible` from 992 px | Wrapper scrolls inside its own box until 1536 px; the sticky-header offset is zero while it does (the first version of this fix pushed the header over the first rows at 1440 px — caught in screenshot review, not by a gate) | Shared | matrix, zoom 125 %, screenshots |
| 13 | Operations · Performance, 320 px | Filter row and delivery table wider than the page | Flex children without `min-width: 0`; table had no scroll box | Filters shrink/wrap; segmented control scrolls inside itself; table in a scroll box | Component + shared (`.hg-seg`) | matrix |
| 14 | Operations · student workspace, 320–360 px | 10 px overflow on the communication tab | Button in a `space-between` row shrank below its label | `.hg-row.hg-between` wraps; buttons keep their size | Shared | matrix |
| 15 | University · applicant cards, phone | Lone "—" line on decided applications | Empty "needs" cell rendered as a dash | Line omitted when nothing is needed | Page | screenshots |
| 16 | University · application detail, 1280 px | Side-card values broke one character per line | Label column was `max-content` | Label column capped at 45 % | Component | matrix |
| 17 | Marketing home, Japanese, 320 px | Page 35 px too wide in pricing notes | `word-break: keep-all` (a Korean rule) applied to a script with no spaces | `keep-all` switched off once for ja/zh/th/lo/km/my | Shared (marketing) | matrix (ja, zh-Hans) |
| 18 | Marketing + Student, Russian, 320 px | Legal title, university hero, CTA button, day counters, money ranges and scholarship badges overflowed | `nowrap` on text that is short only in English/Korean | Headings break inside long words; phone buttons wrap; counters, amounts and statuses wrap; badges ellipsise | Shared | matrix (ru) |
| 19 | Student · Services | "Your card" title sat on the panel border | Panel had no padding | Padding added | Component | screenshots |
| 20 | Operations workspace | `aria-required-children` (critical) on the details tab list | A "Hide" button lived inside `role="tablist"` | Button moved outside the tab list | Page | `a11y.mjs` |
| 21 | Student essay diff, university tables; University messages; sign-up stepper | `scrollable-region-focusable` (serious) | Scroll regions not reachable by keyboard | Regions focusable with a role and label; stepper's hidden labels contained | Page | `a11y.mjs` |
| 22 | Student family links, University team | `color-contrast` (serious) on inactive rows | Muted with `opacity` | Muted with colour tokens | Component | `a11y.mjs` |
| 23 | Student, Operations, University | Device/browser auto-dark could repaint a light-only product | No `color-scheme` on three apps | `color-scheme: only light` in tokens + `<meta>`; console theme-colour set to white | Shared | matrix `--dark` |
| 24 | Operations console | Browser title "Agency Console"; app name "Hangyul Agency"; console label "에이전시 콘솔"; student copy "협력 유학원 포함" | Pre-pivot wording | Titles, native app name and 1,820 strings in 53 locales rewritten to the direct-operation model; dead partner-agency marketing keys deleted | Copy (all locales) | leak/i18n gates; review |
| 25 | Operations console | Sidebar label "Applications & documents" cut at the rail edge | `nowrap` label | Label wraps to a second line | Shared (console shell) | screenshots |

Not changed, on purpose: the marketing hero, logo marquee, directory, pricing and FAQ sections (reviewed at 390 and
1440 and judged strong); the canonical custom select; brand lockups and OG/social metadata; payment code paths.

Left open (needs a person, not a stylesheet): flag emoji in the phone-country picker do not render on Windows (shows
the two-letter code) — replace with the SVG flag set used by the language picker; 138 single-column `display: grid`
rules still rely on an implicit `auto` column (the cause of #1) and should move to `minmax(0, 1fr)` as they are touched.
