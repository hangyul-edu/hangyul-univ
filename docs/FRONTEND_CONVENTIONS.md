# Frontend conventions

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
- `@hangyul/api-client` — `createApiClient()`; every endpoint is typed. Web uses same-origin `/api` (Vite proxy → :8001).
- `@hangyul/auth` — `AuthProvider`, `useAuth()`, `useApi()`, `DEMO_ACCOUNTS` (dev only).
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
5. **Honesty rules**: never show invented statistics as fact. Since V12 a **public** surface never renders a value it cannot verify (no cost, deadline, requirement or match on the marketing site, labelled or not); seeded figures appear only on authenticated surfaces, and there are no "Sample data" badges in product chrome. Never write "guaranteed admission"; use match tiers (Strong / Competitive / Reach), readiness and eligibility. Show a guarantee only when the API returns `guarantee` (backed by a partner contract), with its terms.
6. **Tenant boundaries are enforced by the API.** Since V22 a tenant has one role (`AGENCY_ADMIN` / `UNIVERSITY_ADMIN`), so inside a tenant everyone sees the same actions; the UI still hides Hangyul-only operations from tenant users, shows staff to students only as the *Hangyul Univ team* (never a staff name), and must never render `internal` messages/comments in student-facing apps.
7. **Responsive**: works at 375/390/430/768/1024/1280/1440. Tables become cards under 768px (built into `DataTable`), filters move into a `Drawer` (bottom sheet on mobile), primary actions stay visible.
8. **Accessibility (WCAG 2.1 AA)**: labelled inputs (`Field`), keyboard-operable controls, visible focus, `aria-*` on custom widgets, charts include a screen-reader summary (built in), don't rely on color alone (status badges carry text).
9. **Performance**: route-level code splitting (`lazy`), charts lazy-loaded, query caching with sensible `staleTime`, paginate server lists.

## Query keys

`['dashboard']`, `['profile']`, `['matches', params]`, `['applications', params]`, `['application', id]`, `['documents', params]`, `['document', id]`, `['essays', params]`, `['essay', id]`, `['tasks', params]`, `['conversations']`, `['thread', id]`, `['notifications']`, `['visa']`, `['agency', 'students', params]`, `['agency', 'analytics', params]`, `['university', 'analytics', params]`. Invalidate the narrowest key that changed.

## Product personalities (one brand, four jobs) — design system v2

Read `docs/REPORT.md` §14 and §16 first. Common rules: neutral-first surfaces, tangerine only for the primary action / "you are here" / focus, hierarchy through type and hairlines (use `Section`, `ListRow` in an `hg-panel`, `StatusText`, `Metrics`) — use `Card` only for genuinely self-contained objects, never KPI-tile grids.

- **Marketing** — editorial and restrained: short copy, one CTA, product previews built from real UI, sourced facts (nothing unverifiable on a public page, V12). No decorative motifs.
- **Student** — a guided service, not a dashboard: every screen answers one question; one dominant next action; verdicts (Strong fit / Eligible / Reach / Not eligible yet) wherever a program appears; documents described as requirements.
- **Agency** — dense but quiet: attention lists that link to filtered views, saved views on the caseload, single-line tables, keyboard-friendly review. KPIs live on Performance only.
- **University** — executive credibility: decisions first, one consistent funnel population with definitions and n<5 honesty, light sidebar, validated chart palette.

## V7 — template-first

- **Marketing** is **Koreanasha over the Eduan chassis** (since V10): `@hangyul/koreanasha-ui` (header, hero, bands, cards, FAQ — inventory `docs/TEMPLATE_KOREANASHA_INVENTORY.md`) is imported after `@hangyul/eduan-ui` and wins wherever they overlap; Eduan remains the shared chassis and component source (inventory: `docs/TEMPLATE_EDUAN_INVENTORY.md`). Start from the Koreanasha/Eduan section that fits, keep its markup classes, swap content. Hangyul-specific glue lives in `packages/eduan-ui/src/scss/_hangyul-glue.scss` (`ed-*` classes). Every inner page starts with `PageHero` (Eduan breadcrumb band); page CTAs go through `CtaBand`, which feeds the layout's single closing band.
- **Consoles** (agency, university, Hangyul operations) are built on YNEX (`@hangyul/ynex-ui`): `YnexShell`, `PageHeader`, `YCard`, `StatCard` (every number links to exactly its records), `DateTimeline`, `ProgressRow`, `YTabs`, `SplitPane`, plus YNEX/Bootstrap classes. Shared `hg-*` components are skinned to YNEX by `_hangyul-skin.scss`.
- **Student** stays a consumer product: Eduan language via `apps/student-web/src/styles/app.css` (the V26 merge of the former `v7.css` … `v25.css` layers), never YNEX admin chrome.
- Before inventing a component, ask: does the template already have a better one? If yes, port it. Custom UI only for Hangyul-only workflows, styled natively to the template.
- Template text transforms (`capitalize`, `uppercase`) are disabled — they break sentence case and many languages. Template colours that fail AA on tints are overridden centrally, never per page.

## Stylesheets (V26)

The per-pass version layers (`v6.css` … `v25.css`) are gone. Each app owns purpose-named files under `apps/<app>/src/styles/`:
marketing `base.css` · `site.css` · `home.css` · `start.css` · `directory.css` · `university.css` (route files are imported by
their route component and load with its chunk); student `app.css`; agency and university `base.css` + `screens.css`
(with `@hangyul/ui/console-v22.css` between them). Add to the file that owns the surface; do not start a new version layer.

## V25 — one action shape, four roles (REPORT §317, §326)

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

## V32 — one selection control, no browser menus (REPORT §436)

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
