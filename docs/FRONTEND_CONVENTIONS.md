# Frontend conventions

> Naming: the `agency` app, namespace and `AGENCY_ADMIN` role are historical internal names for Hangyul's own
> Operations/Admin console. There is no external agency product.

How the four web apps and three native apps are built. Read this before adding a screen.

## Stack

| Concern | Web | Mobile |
|---|---|---|
| UI runtime | React 19.2 + Vite 7 | React Native 0.86 + Expo SDK 57 (expo-router) |
| Routing | React Router 7 (`createBrowserRouter`, route-level `lazy`) | expo-router file routes |
| Server state | TanStack Query 5 | TanStack Query 5 |
| Forms | React Hook Form + Zod (`@hangyul/validation`) | same |
| Tables | `DataTable` (TanStack Table 8) from `@hangyul/ui` | FlatList |
| Charts | `@hangyul/ui/charts` (Recharts), always behind `React.lazy` | lightweight RN views (bars/rings) |
| i18n | `@hangyul/i18n` (i18next) | same |

## Shared packages

- `@hangyul/design-tokens` — colors, spacing, radius, typography, shadows, breakpoints, status and chart palettes (from the Hangyul BI). Web consumes CSS variables (`--hg-*`); RN imports the TS object.
- `@hangyul/types` — domain types mirroring the FastAPI serializers.
- `@hangyul/api-client` — `createApiClient()`; every endpoint is typed. Web uses same-origin `/api` (development: Vite proxy to the local API on port 8001; production: the Vercel rewrite — see `docs/DEPLOYMENT.md`).
- `@hangyul/auth` — `AuthProvider`, `useAuth()`, `useApi()`. There is no demo account list, test sign-in or persona picker (removed in V32).
- `@hangyul/i18n` — `LOCALES` (56; 33 of them are market locales in `markets.ts`), `useLocale(ns)`, `changeLocale()`, RTL detection. Strings live in `packages/i18n/locales/<locale>/<namespace>.json`.
- `@hangyul/ui` — web components + shells (see `packages/ui/src/index.ts`). Charts: `@hangyul/ui/charts`.
- `@hangyul/utils` — `formatMoney/Date/Number/Percent/Relative`, `countryName`, `flagEmoji`, status→tone maps, `toCsv`, `cx`.
- `@hangyul/validation` — Zod schemas and upload checks shared by web and mobile.
- `@hangyul/icons` — Lucide icons + official Hangyul brand marks.

## Rules

1. **No hard-coded UI strings.** Every visible string goes through `t()`. Each app owns one namespace (`marketing`, `student`, `agency`, `university`, `mobile`); shared vocabulary (statuses, degrees, document categories, match reasons, actions) is in `common`. Add English and Korean for every key; other locales fall back to English and are filled by the translation pipeline.
2. **Locale-aware formatting only**: `formatDate(x, locale)`, `formatMoney(x, currency, locale)` — pass the record's own currency (plans are USD since V17, tuition and Korean fees are KRW; never hard-code one), `countryName(code, locale)`. Never `toLocaleString()` without the active locale.
3. **RTL-safe CSS**: use logical properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`, `text-align: start`). Directional icons get `className="hg-flip-rtl"`.
4. **Every data screen handles** loading (skeleton), error (`ErrorState` with retry), empty (`EmptyState` with a next action), partial data, and permission denied (API 403/404 → `ErrorState` shows the right message). `QueryState` does this for you.
5. **Honesty rules**: never show invented statistics as fact. Since V12 a **public** surface never renders a value it cannot verify (no cost, deadline, requirement or match on the marketing site, labelled or not); seeded figures appear only on authenticated surfaces, and there are no "Sample data" badges in product chrome. Never write "guaranteed admission"; use the matching groups (적합도 높음 · 요건 충족 · 주의할 점 있음 · 아직 지원 불가 · 성적 필요 — ADMISSIONS.md), readiness and eligibility. Show a guarantee only when the API returns `guarantee` (backed by a partner contract), with its terms.
6. **Tenant boundaries are enforced by the API.** Since V22 a tenant has one role (`AGENCY_ADMIN` / `UNIVERSITY_ADMIN`), so inside a tenant everyone sees the same actions; the UI still hides Hangyul-only operations from tenant users, shows staff to students only as the *Hangyul Univ team* (never a staff name), and must never render `internal` messages/comments in student-facing apps.
7. **Responsive**: works at 375/390/430/768/1024/1280/1440. Tables become cards under 768px (built into `DataTable`), filters move into a `Drawer` (bottom sheet on mobile), primary actions stay visible.
8. **Accessibility (WCAG 2.1 AA)**: labelled inputs (`Field`), keyboard-operable controls, visible focus, `aria-*` on custom widgets, charts include a screen-reader summary (built in), don't rely on color alone (status badges carry text).
9. **Performance**: route-level code splitting (`lazy`), charts lazy-loaded, query caching with sensible `staleTime`, paginate server lists.

## Query keys

`['dashboard']`, `['profile']`, `['matches', params]`, `['applications', params]`, `['application', id]`, `['documents', params]`, `['document', id]`, `['essays', params]`, `['essay', id]`, `['tasks', params]`, `['conversations']`, `['thread', id]`, `['notifications']`, `['visa']`, `['agency', 'students', params]`, `['agency', 'analytics', params]`, `['university', 'analytics', params]`. Invalidate the narrowest key that changed.

## Product personalities (one brand, four jobs) — design system v2

Common rules: neutral-first surfaces, tangerine only for the primary action / "you are here" / focus, hierarchy through type and hairlines (use `Section`, `ListRow` in an `hg-panel`, `StatusText`, `Metrics`) — use `Card` only for genuinely self-contained objects, never KPI-tile grids.

- **Marketing** — editorial and restrained: short copy, one CTA, product previews built from real UI, sourced facts (nothing unverifiable on a public page, V12). No decorative motifs.
- **Student** — a guided service, not a dashboard: every screen answers one question; one dominant next action; verdicts (Strong match / Meets requirements · see what needs attention / Not eligible yet / Needs your grades) wherever a program appears; documents described as requirements.
- **Operations/Admin** (`apps/agency-web`, Hangyul internal) — dense but quiet: attention lists that link to filtered views, saved views on the caseload, single-line tables, keyboard-friendly review. KPIs live on Performance only.
- **University** — executive credibility: decisions first, one consistent funnel population with definitions and n<5 honesty, light sidebar, validated chart palette.

## Template-first

- **Marketing** is **Koreanasha over the Eduan chassis** (since V10): `@hangyul/koreanasha-ui` (header, hero, bands, cards, FAQ) is imported after `@hangyul/eduan-ui` and wins wherever they overlap; Eduan remains the shared chassis and component source (inventory: `docs/FRONTEND_CONVENTIONS.md`). Start from the Koreanasha/Eduan section that fits, keep its markup classes, swap content. Hangyul-specific glue lives in `packages/eduan-ui/src/scss/_hangyul-glue.scss` (`ed-*` classes). Every inner page starts with `PageHero` (Eduan breadcrumb band); page CTAs go through `CtaBand`, which feeds the layout's single closing band.
- **Consoles** (Operations/Admin = `apps/agency-web`, and University) are built on YNEX (`@hangyul/ynex-ui`): `YnexShell`, `PageHeader`, `YCard`, `StatCard` (every number links to exactly its records), `DateTimeline`, `ProgressRow`, `YTabs`, `SplitPane`, plus YNEX/Bootstrap classes. Shared `hg-*` components are skinned to YNEX by `_hangyul-skin.scss`.
- **Student** stays a consumer product: Eduan language via `apps/student-web/src/styles/app.css` (the V26 merge of the former `v7.css` … `v25.css` layers), never YNEX admin chrome.
- Before inventing a component, ask: does the template already have a better one? If yes, port it. Custom UI only for Hangyul-only workflows, styled natively to the template.
- Template text transforms (`capitalize`, `uppercase`) are disabled — they break sentence case and many languages. Template colours that fail AA on tints are overridden centrally, never per page.

## Stylesheets

The per-pass version layers (`v6.css` … `v25.css`) are gone. Each app owns purpose-named files under `apps/<app>/src/styles/`:
marketing `base.css` · `site.css` · `home.css` · `start.css` · `directory.css` · `university.css` (route files are imported by
their route component and load with its chunk); student `app.css`; agency and university `base.css` + `screens.css`
(with `@hangyul/ui/console-v22.css` between them). Add to the file that owns the surface; do not start a new version layer.

## One action shape, four roles

- **Shape.** Every product draws buttons from `--hg-control-*` (`packages/design-tokens` `control`): 10 px radius, 40/48/56 px
  heights. Pills (999 px) are for chips, selectors and stage markers only — never for an action. Native `Button` reads the same
  values.
- **Four roles only.** PRIMARY = tangerine fill, white label and icon in every state, one per decision area. SECONDARY = the
  warm-neutral filled surface `--hg-control-secondary-bg` with ink text (on photographs: translucent dark + white hairline).
  TERTIARY = text with a directional mark (`.kn-textlink`). DISCLOSURE = native `<details>` whose summary looks like a control.
- **Arrows.** → in-product forward, ↗ (`ArrowUpRight`) external official destination, ← back, chevrons only for disclosure.
- **University photographs** go through `UniversityPhoto` (`<picture>`, WebP first, `srcset`, per-asset focal point as
  `--fp-d` / `--fp-m` CSS variables, lazy unless it is the hero). Catalogue universities carry `photo` from their directory
  institution; show it (`UniMark photo=…`) instead of a letter tile.
- **Gate.** `npm run qa:v25` (static · api · rendered). V25 stylesheets set no literal font size.

## One selection control, no browser menus

- `Select` (form field) and `FilterSelect` (toolbar) in `packages/ui/src/select.tsx` are the only selection controls.
  Both are a `button[role="combobox"]` with our own portalled listbox: a popover on desktop (placed by the same
  flip-and-clamp as `Popover`), a bottom sheet on phones. Never render a bare `<select>`, a Bootstrap `form-select`
  or a styled face over a native select — `npm run qa:v32-selects` fails on any visible native `<select>`.
- Same props as before: `value`, `onChange` (reads `e.target.value`), `<option>` / `<optgroup>` children, `id` for a
  `<label htmlFor>`, `name` for a plain form post. Keyboard: arrows, Home/End, PageUp/Down, Enter/Space, Escape, Tab,
  type-ahead; `aria-activedescendant` keeps focus on the control while the list is open.
- `CountrySelect` keeps its searchable popover but its closed face is the same `.hg-sel` as every other select.
- The service-unavailable state (`ServiceUnavailable` in `packages/ui/src/app.tsx`, `AuthStatus 'unavailable'`) is the
  only thing an authenticated app shows when the API cannot be reached: never a raw transport message, never stale or
  synthetic data. `ApiError.unreachable` marks the failure; `ErrorState` prefers that wording too.

## Layout, controls and states (launch-final)

- **One gutter, one rail.** `--hg-gutter` (design-tokens `layout`) is the only page gutter: 16 px at 320, ~18–20 px at
  360–390, ~21–22 px at 412–430, 24 px on tablets, 32 px on desktop. Shells write `padding-inline: var(--hg-gutter)`
  once; pages never add their own side padding or media queries for it. Full-bleed scrollers use
  `margin-inline: calc(var(--hg-gutter) * -1)` with matching `padding-inline` and `scroll-padding-inline`.
- **Content widths** are named tokens: `--hg-container-editorial` (marketing), `--hg-container-task` (student),
  `--hg-container-workspace` (Operations/Admin and University), `--hg-container-reading`.
- **Buttons.** Primary = solid tangerine, white label. Secondary (the default `.hg-btn`) = white with a visible edge.
  Tertiary = `button.hg-link` / `.hg-btn--link` (text with underline affordance — never a raw browser button).
  Danger only for destructive actions. Heights come from `--hg-control-height-*`; every button is ≥ 44 px below
  1024 px or on a coarse pointer.
- **Disabled** is visibly inactive without a grey slab: neutral controls go warm-white with muted text; a disabled
  primary keeps a pale tangerine wash. Inputs use the same warm-white.
- **Errors** sit next to their control (`.hg-error`, `role="alert"`, `aria-describedby`), in the restrained semantic
  red, and must not move the layout by more than a line.
- **Phones get their own composition.** No two-column desktop form squeezed into a narrow screen: e.g. the sign-up
  verification card stacks code field → full-width Verify below 480 px; the registration stepper is one line
  ("2/4 · Verify") over four segments; operational tables render as priority-field cards (`DataTable renderCard`).
- **Light only.** `color-scheme: only light` (tokens + `<meta name="color-scheme">`) stops device auto-dark from
  repainting the product.
- **Gates:** `npm run qa:launch-matrix` fails on any page-level horizontal overflow
  (`documentElement.scrollWidth > innerWidth`) across 320–1920 px.

## Design foundation (2026-11) — white canvas, warm separation, orange for "current"

One visual language for Student, Operations/Admin and University, set in the shared layer (tokens, `packages/ui`
styles, the console surface). Page CSS composes these; it does not restate colours, radii or control sizes.

- **Surfaces.** The working canvas is white (`--hg-bg`) in all three apps, including top bars. `--hg-bg-paper`
  (`#FBFAF7`) is the one warm surface: the console navigation panel, a quiet aside (`Card warm`), a `hg-well` inside a
  card, a disabled field. Never a full-page grey, a grey content well or a grey card. `--hg-surface-warm` is for hover
  and small marks; `--hg-surface-sunken` only for data tracks (progress, heat cells).
- **Section vs card.** Default grouping is `Section` (heading + content, no box; `ruled` for a hairline between
  groups). `Card` / `hg-panel` / YNEX `card custom-card` only for a self-contained object or a table/list container:
  white, one hairline, 14 px radius, no shadow, no ruled header, no accent bar. Never a card inside a card.
- **Selected / current is orange.** `--hg-selected-bg|fg|border` (pale tangerine wash, `#B84600` text, `#CC4E00`
  edge) for navigation items, tabs (underline), chips, segmented options, option cards, filters with a value, selected
  rows, switches and checkboxes. Ink is no longer a selection colour. Counts stay ink.
- **Buttons.** One primary (solid tangerine) per decision area. Secondary = default `Button` / `btn-light`
  (white + 3:1 edge). `soft` / `ghost` for tool actions, `link` for inline actions, `danger` for destructive only.
  Heights 36 (`sm`, dense desktop) / 40 / 48, all ≥ 44 px on phones; radius 10 px (`--hg-control-radius`).
- **Inputs.** `Field` + `Input` / `Select` / `Textarea`: 44 px, 10 px radius, 3:1 edge, tangerine focus ring; invalid =
  red edge + `hg-error` under the control; disabled / read-only = warm paper with a hairline.
- **Type.** Page title = `--hg-type-h1` (consoles clamp 22–28 px), section title 18 px, card title 16 px, body 14 px in
  consoles and 15–16 px in the student app, supporting text 13 px, nothing under 12 px. One family (Pretendard).
- **Radii.** 6 badges · 8 menu items and small buttons · 10 controls · 14 cards, panels, callouts, popovers · 20 modals
  and bottom sheets.
- **Tables.** `DataTable` / `hg-table` / YNEX `.table`: white header, 13 px semibold labels, 56 px rows (`dense` 44),
  hairline rows, warm hover, tangerine-wash selection. Cards under 768 px.
- **States.** Loading = `Skeleton` (warm shimmer, static under reduced motion); empty / waiting = `EmptyState` (warm
  disc, title, one sentence, at most one action); error = `ErrorState` (red disc, retry); inline notices = `Callout`
  (info is warm paper; warning / danger / success carry their semantic wash). Status in lists = `StatusText`
  (dot + words); `Badge` for a compact tag. Tones: `success | info | warning | danger | neutral | brand | teal`.
- **Motion.** Interface durations only (`--hg-motion-fast|base|slow`): tab underline, bottom sheet, popover, accordion.
  `prefers-reduced-motion` collapses all of it (base.css).

## Owner pass 261119 primitives

- **`AuthEntryGate`** (`@hangyul/ui`): every login / sign-up / forgot screen decides during render (restoring → loader;
  signed in on entry → `<Navigate>`; anonymous → the form). Never redirect an auth screen from an effect.
- **`FileDrop`** (`@hangyul/ui`): the only web file input — picker + drag & drop, one validation path
  (`@hangyul/validation` `checkUpload` / `checkUploads` / `checkDragItems`), localized reasons, `aria-live` status, compact
  variant for chat. Native uses pickers (`UploadSheet`) with the same validation and no drag text.
- **Document groups** (`@hangyul/utils` `docGroups`): category → group, summaries, completion, required protection; web
  `DocSections` and native documents screen render the same model.
- **Scrolling:** one counted body-scroll lock (`useBodyScrollLock`); scroll containers inside flex/grid need
  `min-height: 0`; editors grow with content instead of scrolling inside a fixed box; the student shell pads for the tab
  bar + `env(safe-area-inset-bottom)`. `e2e/student-scroll.spec.ts` guards every Student route.
- **Language:** `uniName()` / `university_ko`, `orgName()`, `docTitle()`, `errorText()`; never show a server's English
  `detail` to a non-English reader. `npm run qa:lang-leak` must stay at 0.

## Exhaustive-pass rules (2026-11-21)

- **Errors are words, never transport text.** Every catch, `onError` and toast uses `errorText(e)` from `@hangyul/i18n`
  (status/code → localized sentence). `(e as Error).message` shows the server's raw `detail` and is not used in any app.
  A failed write never throws at the page: mutations have an `onError`, fire-and-forget calls a `.catch`.
- **A failed send keeps the work.** Composers restore the text *and* the attachments on failure and say it under the
  composer ("Not sent. Your message is still here." + the reason), not in a toast over the text box.
- **Names follow the reader's language everywhere.** When the server sends a flat English label (`params.university`,
  `application_label`, a document `label`), re-read the name from the record that carries `{ name_en, name_ko }`
  (`localName`, `uniName`, `docLabel`, `essayTitle`). Labels a person typed (a university's request label, message text)
  stay as written and carry `data-user-content`.
- **One team, no person.** Student copy says "the Hangyul team" / "한귤 상담팀"; "your counselor" is never written for a
  student, and the internal organisation behind the team is never shown to one.
- **Type floor and touch targets.** No text under `--hg-text-xs` (12 px), counts and tab labels included. On phones and
  coarse pointers every control is a 44 px target and every text link a ≥ 24 px target; when the drawing must stay small,
  grow the hit area with a pseudo-element (pick the one the control does not already use) or `min-block-size`.
- **Wrapping.** Korean wraps between words everywhere: `:lang(ko) body { word-break: keep-all; overflow-wrap: break-word }`
  in `packages/ui` base. Never set `keep-all` for other languages (ja/zh/th/my have no spaces). Statuses and short labels
  use `overflow-wrap: break-word`, never `anywhere` on a flex item (its min-content becomes one character: "추가 / 됨").
- **Mobile keyboard.** `bootWebApp` installs `installKeyboardFocusKeeper()`: when the visual viewport shrinks, the focused
  field is brought into view. Do not add per-page keyboard hacks.
- **Nested scroll** is allowed only for chat history (it opens at the newest message) and for modal/drawer bodies. A
  long document, diff or list grows with the page.
- **Gates.** `scripts/qa/launch-final/audit.mjs` (scroll oracle, overflow, 12 px floor, touch targets with the WCAG 2.5.8
  spacing exception, native selects, leaked enum tokens, page errors) and `scripts/qa/launch-final/overlays.mjs`
  (open → Escape → body lock released, resize while open, Back/Forward) over every route in `routes.mjs`.

## Product-excellence rules (2026-11-22)

- **Reduce before adding.** A new block must answer the screen's primary question or move behind disclosure. Outcome
  statistics belong on Insights, never above a work queue; a stage matrix is a view a person opens ("단계별 보기"), not
  the first thing they parse. Task map and benchmark: `docs/qa/launch-final/excellence/TASKS.md`.
- **One next action above the fold.** Student Home: greeting → one-line journey (six segments + "전체 여정 보기") → the
  next action. Nothing decorative sits between the greeting and the action.
- **Open on what is left.** A list that mixes done and to-do (Documents) opens on its to-do view with counts on the
  switch (`@hangyul/utils` `viewOf` / `viewCounts` / `filterGroups`); a deep link to one item opens "all".
- **Say a fact once.** No status repeated as "latest change: <same status>", no team name twice in one card, no "나"
  owner label under a sentence already addressed to the student, no row for a value we do not have ("설립 —").
- **Unknown facts on customer pages (canonical rule, 2026-11-28).** Internal data keeps unknown as *unknown*: never
  converted to false, none or zero, and `source_url` / `verified_at` / verification status / provenance stay in the
  database and in Operations. A **customer** surface (Marketing, Student) never shows a research state: no "아직 확인되지
  않음", "미확인", "Not yet verified", "needs checking", "Hangyul hasn't verified…". Per topic, in this order: (1) the
  verified fact; (2) the university's own page for that topic under a plain label (`UniversityOfficialLink`:
  "등록금·전형료 안내 보기", "학교 장학금 안내 보기", the dormitory, international office or admissions page) — a homepage
  is not a topic page; (3) nothing. Provenance stays quiet: a checked date and the source link, not a status per block.
  Where a personalised result genuinely cannot be assessed, say what the team will do ("상담에서 확인해드릴 대학 — 최신
  모집요강을 확인한 뒤 지원 가능 여부를 안내해드려요"), never what Hangyul has not done, and never imply eligibility.
  `FreshnessBadge` defaults to `audience="customer"`; Operations and the University console pass `audience="staff"`.
  Enforced by `npm run qa:customer-copy` (locale source, plus rendered pages with `--base`).
- **Why on the row.** A match row shows up to three published requirements met (✓) and one thing to check (△) without a
  click; never a probability.
- **Conversation rhythm.** Messages: a date line where the day changes, consecutive messages from one side within ten
  minutes form a run (mark and name once), clock time on each bubble, quiet warm-paper bubbles for the team, links to the
  document / task a message carries (`attachment_document_id`, `created_task_id`) and to its application.
- **Decision safety.** A university decision modal names the applicant, programme and intake, warns when required
  evidence is unverified (offer / rejection), labels the button with the decision ("합격 통보"), and ignores a second
  submit.
- **Keyboard work.** Repeated-work screens show "키보드 단축키 ?"; `?` opens the list anywhere in the console. Only keys
  that exist are listed; no shortcut for rare or destructive actions.
- **WCAG 2.2 AA.** `installFocusNotObscured()` (in `bootWebApp`) scrolls a keyboard-focused control out from under sticky
  or fixed bars; the skip link is fixed above every layer when focused; login identifiers use `autocomplete="username"`,
  passwords `current-password` / `new-password` with a show/hide toggle, codes `one-time-code`; paste is never blocked;
  every drop zone has a picker button. Gate: `scripts/qa/launch-final/wcag22.mjs` (real Tab / Shift+Tab presses).
- **Newest answer wins.** A mutation that returns the whole object and swaps it into the cache applies only the newest
  request's answer; an older answer arriving late triggers a refetch instead (Student visa plan). A query that a parent
  already failed is not re-fetched just because a child mounted it when that costs a second timeout (`retryOnMount: false`
  on the Student dashboard); a page's Retry refetches every query that failed with it (University home).
- **Performance.** Start the first route's chunk while i18n boots (Marketing `main.tsx`); the first row of photo cards
  loads eagerly at high priority, everything below lazily; skeletons hold final geometry (a loading meta line is one
  line if the final line is one). Gate: `scripts/qa/launch-final/vitals.mjs` (LCP element, CLS, scripted interactions).

## Design Preview mode

A design-review aid behind one build flag, `VITE_ENABLE_DESIGN_PREVIEW` (requirements in `docs/SECURITY.md`).

- Entry points: "Preview without signing in" under the Student / Operations / University login forms, and "Preview
  without paying" under paywalls. Render them only when the flag is on; with the flag off the code path must be
  tree-shaken out of the bundle.
- Data comes from synthetic fixtures (`packages/api-client/src/preview/`), never from a private API. The seam is the
  API client's `fetchImpl`: no page, hook or component knows preview exists, so do not add `if (preview)` branches.
  Writes are refused in-process, no auth session is created, no payment is started.
- The flag is read only in `packages/ui/src/design-preview.tsx`. New entry points use `DesignPreviewLoginEntry` /
  `DesignPreviewPaidEntry` from `@hangyul/ui`; never read the env var anywhere else (`npm run release:preview-gate`).
- A new endpoint used by a signed-in screen needs a synthetic response in `<app>.extra.json`, or
  `npm run qa:launch-preview` fails on the miss.
- Always show the small "Design Preview" indicator (`packages/ui/src/design-preview.tsx`) while preview is active.
- Fixtures must look like plausible real states (including empty, waiting and action-needed states) but contain no
  real person, university decision or invented statistic presented as fact — and never a probability or
  "guaranteed admission".
- The flag is off for public launch; a release gate checks the production bundles.

## Templates: what is used, what was changed on purpose

Three templates are foundations, not dependencies: only derived, compiled CSS ships, and the template folders
(`template-koreanasha/`, `themeforest-eduan/`, `themeforest-ynex/`) stay outside the deployable apps. Licence and
role per template: `docs/PRODUCT.md`.

| Template | Used for | Kept | Changed on purpose |
|---|---|---|---|
| **Koreanasha** (owner-supplied; itself a customised Eduan build with a ~500-line customisation layer) → `packages/koreanasha-ui` | Marketing site since V10 | Floating pill header, full-viewport photographic hero with one hand-made crop per breakpoint, band alternation, centred eyebrow / two-tone headline / lead, 20 px white cards, alternating photo rows, pill CTA; ported to React: sticky header, offcanvas, logo marquee, FAQ accordion, "why" row, service rows | Removed: every Koreanasha brand artefact and person image, the public application modal, invented discounts and "BEST" badges, testimonials, flag language picker, jQuery + 14 plugins, Font Awesome, AOS, odometer, `lang.js` |
| **Eduan** → `packages/eduan-ui` | Shared chassis under Koreanasha; Student app visual language | SCSS re-scoped under `:where(.ed)`, only the partials Hangyul renders, purged per build | Primary colour → action tangerine `#CC4E00` (AA); Roboto → Pretendard; visible focus ring restored; motion respects `prefers-reduced-motion`, no autoplay carousels; physical properties mirrored by `postcss-rtlcss`; all jQuery plugins replaced by React; no template photographs ship |
| **YNEX** → `packages/ynex-ui` | Operations/Admin and University consoles | Bootstrap 5.3.3 subset + layout/menu partials; vertical layout ported as `YnexShell` | Muted text darkened to `#5F6B80` (AA); Inter → Pretendard; icon fonts (168 MB) → Lucide; template JS (SimpleBar, Choices, DataTables, ApexCharts, FullCalendar…) → React components and Recharts; status is always text + colour; since V22 consoles are white/hairline with tangerine only for the current step and the primary action |

Defects in the original templates that must not be reintroduced: `<html lang="zxx">`; no `<h1>`; content hidden at
`opacity: 0` until a CDN script answers; missing or placeholder `alt`; duplicate ids; megabytes of CSS/JS for a few
glyphs; sliders initialised for pages that do not exist; unoptimised hero images; a marquee animation that never
stops (off-screen, background tab, reduced motion); a hidden duplicate CTA creating an invisible tab stop;
translations written with `innerHTML`; anchors instead of routes (no per-page SEO).
