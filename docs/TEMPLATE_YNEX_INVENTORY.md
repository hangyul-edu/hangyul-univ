# YNEX template inventory (V7)

*Audited 2026-10-09 from `themeforest-ynex/` (licensed ThemeForest purchase, Spruko, v4.1 — authorised by the project owner for use inside Hangyul Univ). Screenshots: `docs/qa/v7/template-ynex/` (`scripts/qa/v7-template-capture.mjs ynex`).*

## 1. What the package is

| Item | Finding |
|---|---|
| Location | `Html/src` (sources: `html/` with gulp-file-include `partials/`, `assets/scss`, `assets/js`), `Html/dist` (built pages + `assets/libs` copied from npm), `Documentation/`, `Change-logs/` (v1 → v4.1, 2024-03-18: Bootstrap 5.3.2 → 5.3.3) |
| Technology | Static HTML · **Bootstrap 5.3.3** (CSS from npm) · SCSS (`styles.scss`, legacy `@import`, all values as CSS custom properties) · vanilla JS (`main.js`, `defaultmenu.js`, `custom.js`, `sticky.js`, per-page JS) · Gulp 4 build |
| Pages | 175 HTML pages: 12 dashboards (`index` CRM, `index-1` Ecommerce, `-2` Crypto, `-3` Jobs, `-4` NFT, `-5` Sales, `-6` Analytics, `-7` Projects, `-8` HRM, `-9` Stocks, `-10` Courses, `-11` Personal); apps (full calendar, gallery, sweet alerts, projects list/overview/create, jobs ×7, NFT ×5, CRM contacts/companies/deals/leads, crypto ×5, file manager, mail + mail settings, chat, task kanban/list/details, invoices ×3, to-do, ecommerce ×9); pages (about, blog ×3, contacts, empty, FAQ, landing ×2, notifications, pricing, profile, reviews, team, terms, timeline); 22 auth pages (sign-in/up, reset, lock screen, 2-step — basic + cover); 3 error pages; ~40 UI-element / form / table / chart / map / icon demo pages |
| SCSS architecture | `_variables.scss` (`:root` custom properties: `--primary-rgb` 132,90,223, secondary 35,183,229, success 38,191,148, warning 245,184,73, danger 230,83,60, info, orange, pink, teal, purple; body `#f0f1f7`, text `#333335`, muted `#8c9097`, border `#f3f3f3`, menu/header vars; dark-mode block), `_switcher.scss` (theme / menu / header colour attributes on `<html>`), `bootstrap/` (19 overrides of Bootstrap components), `custom/` (auth, custom, dashboard styles, error, header, image, plugins, widgets), `menu-styles/` (11: vertical, horizontal, closed, detached, double, icon-click, icon-hover, icon-overlay, icon-text, menu-click, menu-hover), `pages/` (chat, ecommerce, file-manager, landing, mail, task), `util/` (avatars, background, border, opacity, typography) — compiled `styles.css` 774 KB |
| Layout attributes | `<html data-nav-layout="vertical|horizontal" data-theme-mode="light|dark" data-header-styles="light|dark|color|gradient|transparent" data-menu-styles="light|dark|color|gradient|transparent" data-vertical-style="overlay|closed|icontext|detached|doublemenu" data-toggled="close|icon-overlay-close|…" data-page-style="regular|classic|modern" data-width="fullwidth|boxed" data-menu-position / data-header-position="fixed|scrollable" dir="ltr|rtl">` |
| JS libraries (`dist/assets/libs`, 29 MB) | Popper, Bootstrap bundle, ApexCharts, Chart.js, ECharts, Choices.js, Cleave, DataTables (BS5), Grid.js, Tabulator, Dragula, Dropzone, FilePond (+9 plugins), Flatpickr, FullCalendar 5, GLightbox, gmaps, jsVectorMap, Leaflet, Masonry, Moment, Node-Waves, noUiSlider, particles.js, Prism, Quill, rater-js, SimpleBar, Slick, SweetAlert2, Swiper, wNumb, Pickr |
| Fonts / icons | Inter 300–700 + Montserrat 500/600 (Google Fonts); icon fonts 168 MB: Boxicons, Remix, Feather, Tabler, Bootstrap Icons, Line Awesome |
| Images | 7.3 MB: brand logos, faces (Unsplash per credits), company logos, crypto/NFT/ecommerce, menu backgrounds, auth illustrations |
| RTL | Supported (`dir="rtl"` rules in SCSS + `bootstrap.rtl.min.css`) |
| Accessibility (as shipped) | Icon-only buttons without names (`aria-label="anchor"` placeholders), `javascript:void(0)` links, hover-only submenus in some styles, colour-only status in places, muted text #8c9097 on white 3.3:1 (**fails AA** for body text), card titles 15 px semibold pass. **Fixed in the port**: muted text mapped to Hangyul console tertiary #5F6B80 (5.4:1); every icon button named; real links/buttons; status always has text. |

## 2. Layout variants evaluated

| Variant | Look | Verdict for Hangyul |
|---|---|---|
| Vertical · dark menu (`data-menu-styles="dark"`, menu `#111c43` navy) · light header — **YNEX default** | Deep navy sidebar, Montserrat labels, uppercase category captions, light active pill; white 60 px header; `#f0f1f7` canvas | **University console** — institutional weight, the strongest YNEX look; also **Hangyul operations** (navy + its own context bar) |
| Vertical · light menu · light header | White sidebar with hairline, same structure | **Agency console** — a light workbench for an 8-hour day with 200 students; distinct from the university |
| Vertical · color / gradient menu | Primary-coloured sidebar | Rejected — too loud for operations |
| Vertical · closed / icon-text / icon-overlay | Collapsed rail (icons; overlay on hover) | **Collapse state** of both shells (`data-toggled="icon-overlay-close"`) |
| Detached | Floating rounded sidebar | Rejected — wastes width on dense tables |
| Double menu | Icon rail + second column | Rejected — Hangyul nav is flat (≤ 14 items) |
| Horizontal | Top menu bar | Rejected — sections would not fit; poor at 1024 |
| Boxed / classic / modern page styles | Card borders vs shadows | **Regular** (default soft shadow cards) kept |
| Dark theme | Full dark | Not used (consoles are light-only since V3 — never QA'd to standard) |

## 3. Component inventory

Reuse: **DIRECT** · **PORT_TO_REACT** · **ADAPT** · **DO_NOT_USE** (definitions as in the Eduan inventory).

### 3.1 Shell

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| `partials/sidebar.html` + `menu-styles/_vertical.scss` | `app-sidebar` 15 rem: logo header, `slide__category` captions, `side-menu__item` with icon + label + badge, active state, child menus | Console sidebar for Agency / University / HQ | PORT_TO_REACT (NavLink active state; `defaultmenu.js` replaced; badges from live counts) |
| `menu-styles/_icon_overlay.scss` / closed | Collapsed icon rail, expands on hover | Sidebar collapse (persisted per user) | PORT_TO_REACT |
| `partials/header.html` + `custom/_header.scss` | `app-header`: toggle, search, language flag, theme, cart, notifications, apps grid, fullscreen, profile, switcher cog | Console header: toggle, global search, language, notifications, profile/org menu | ADAPT (no cart, apps grid, fullscreen, theme switcher) |
| `partials/headersearch_modal.html` | Search modal | Mobile search | ADAPT |
| `partials/page-header.html` (`page-header-breadcrumb`) | Page title left, breadcrumb right | Every console page header (title + context + actions) | PORT_TO_REACT |
| `partials/switcher.html` | Live theme customiser | — | DO_NOT_USE |
| `partials/footer.html` | Copyright footer | — (wastes height in a tool) | DO_NOT_USE |
| `partials/loader.html` | Full-page loader | — | DO_NOT_USE (skeletons instead) |
| Mobile (`data-toggled="close"`) | Sidebar off-canvas with backdrop | Phone/tablet navigation | PORT_TO_REACT (focus trap, Esc) |

### 3.2 Dashboards

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| index (CRM) | Highlight card (primary fill + radial progress), 4 stat cards with icon avatar + sparkline + trend, Top deals avatar list, Revenue analytics area/line chart, Leads by source donut, Deals status segmented bar, Deals statistics table | **Agency Today** (attention cards, work queue list, pipeline bar), **Agency Performance** | ADAPT |
| index-3 (Jobs) | 6 compact stat cards (icon + number + trend + caption), Recent jobs list with badges, Candidates donut, Recent recruiter cards | **University Overview** decision strip; applicant lists | ADAPT |
| index-5 (Sales) | 4 stat cards with "show full stats ›", Recent transactions list with coloured icons, stacked bar "Sales overview", Activities timeline, Task list tabs | **HQ overview** (activity timeline, risk lists), **Tasks** | ADAPT |
| index-6 (Analytics) | KPI tiles with sparkline, audience mixed bar/line chart, radial mini-gauges, sessions donut, traffic table with progress bars | **University Analytics** (bar + line), traffic-style table with inline progress for countries/programs | ADAPT (no donut spam) |
| index-7 (Projects) | Project stat cards, team list with sparklines, daily tasks cards, project analysis mixed chart, main tasks checklist with status badges, recent transactions | **Agency Team workload** (members + load), task checklist | ADAPT |
| index-8 (HRM) | Stat cards with coloured **top border**, "Applicants summary" (3 icon stats), Performance by category stacked bars + 1W/1M/6M/1Y button group, Jobs summary donut, **Upcoming events dated timeline**, Clients table with status dropdown | **University Overview** (needs decision summary, deadlines timeline, intake funnel stacked bars, period button group) | ADAPT |
| index-10 (Courses) | Top categories icon tiles, earnings stat cards, earnings grouped bars with 1M/6M/1Y/All, "My courses" table with inline progress bars + type badges | **University Programs demand** (programs table with progress bars) | ADAPT |
| index-11 (Personal), -1, -2, -4, -9 | Personal finance, ecommerce, crypto, NFT, stocks | — | DO_NOT_USE |

### 3.3 Apps and pages

| Template page / file | Visual pattern | Potential Hangyul use | Reuse |
|---|---|---|---|
| crm-contacts.html | Card with title + count badge, primary "Create" button, light-success "Export as CSV", "Sort by" dropdown; table: checkbox, avatar + name + date, score, email/phone with icons, company with logo, source, stacked tag badges; pagination | **Agency Students** caseload table; **University Applicants** | PORT_TO_REACT (TanStack Table keeps sorting, saved views, column config, keyboard) |
| crm-deals.html | Kanban columns of deal cards by stage with totals | **Agency Pipeline** | ADAPT |
| crm-leads.html / crm-companies.html | Tables with status dropdowns and offcanvas detail | Agencies list (HQ), partner agencies (university) | ADAPT |
| data-tables.html / grid-tables.html / tables.html | DataTables (jQuery) / Grid.js; table variants (striped, hover, bordered, head colours) | Table styles only | ADAPT (styles; no jQuery DataTables, no Grid.js) |
| task-kanban-board.html (`pages/_task.scss`) | Column headers "NEW - 04" + Add task, cards with created date, days left, tags, title, text, likes/comments, avatars; "View more" light button | **Pipeline** columns and **Tasks** board | ADAPT |
| task-list-view.html | Total tasks table with checkboxes, ID, dates, status + priority badges, assignee avatars; side stat cards + stacked bar | **Agency Tasks / Deadlines** | ADAPT |
| task-details.html | Task header, description, sub-tasks, comments, attachments | Service case / task detail | ADAPT |
| file-manager.html (`pages/_file-manager.scss`) | Three panes: folder nav + storage meter · folder/file tiles + recents table · file detail panel | **Document review** (queue · large preview · requirement / checks / decision) | ADAPT (split view) |
| mail.html (`pages/_mail.scss`) | Three panes: mailbox nav · message list with avatars, labels, stars · reading pane with attachments + reply editor | **Messages** (agency, university, student threads) | ADAPT |
| chat.html (`pages/_chat.scss`) | Chat list with tabs · conversation bubbles · contact info panel with shared files | Student ↔ counselor conversation | ADAPT |
| full-calendar.html | Event category list + FullCalendar month/week/day/list + activity timeline | **Consultations** calendar | ADAPT (no FullCalendar plugin — CSS month/week grid in React) |
| profile.html | Primary-fill profile header (avatar, name, role, stats), bio, contact, skills; tabbed activity timeline | **Agency student detail** header + **University applicant** header | ADAPT |
| job-candidate-details.html | Candidate header card (avatar, verified, meta, CTA, icon actions), "profile information" sections with icon headings, side cards (skills, languages) | **University applicant review** layout | ADAPT |
| projects-overview.html | Details card (description, key tasks, skills, meta strip: manager / dates / assigned / status / priority), team table, goals checklist, discussions timeline | **Student workspace** overview + history | ADAPT |
| timeline.html | Centred dated timeline with avatars and inline badges | Application / case **History** | ADAPT |
| notifications.html | Notification list with avatars and actions | Notifications page | ADAPT |
| team.html | Member cards with stats | **Agency Team** | ADAPT |
| invoice-list.html / invoice-details.html | Invoice table, status badges, summary cards | **Payments** (HQ finance) | ADAPT |
| to-do-list.html | Checklist with priorities | — (tasks cover it) | DO_NOT_USE |
| form_layout.html, form_inputs, floating labels, form_check_radios, form_select (Choices) | Vertical/horizontal forms, input groups with icons, switches | **Programs & rules**, Settings, request dialogs | ADAPT (native inputs + YNEX styling; no Choices.js) |
| quill_editor.html | Rich text editor | — (writing review keeps its own manuscript editor) | DO_NOT_USE |
| navs_tabs.html | Tabs (line, pills, solid, vertical) | Student detail / applicant tabs | DIRECT (styles) |
| modals_closes.html / offcanvas.html | Modal + offcanvas styles | Dialogs, filter drawers | ADAPT (Hangyul overlay components keep focus management) |
| alerts / badges / buttons / dropdowns / progress / avatars / list-group / cards | Component styles (soft "-transparent" variants, `btn-wave`, avatar sizes) | Everywhere in consoles | DIRECT (styles) |
| apex-*-charts.html | ApexCharts styling: smooth lines, gradient areas, rounded column bars, legends top, light grid | Chart look | ADAPT (Hangyul keeps Recharts; YNEX's chart styling — fonts, grid, radius, legend, palette discipline — reproduced, no ApexCharts runtime ~140 KB gzip) |
| apex-heatmap-charts.html | Heatmap | Deadline/load concentration (HQ) | ADAPT (CSS grid heatmap) |
| echarts / chartjs / maps / gallery / sweet alerts / crypto / NFT / ecommerce / landing / pricing / auth illustrations | — | — | DO_NOT_USE |
| sign-in-cover.html | Split auth with illustration | Console login | ADAPT (Hangyul brand panel instead of illustration) |
| empty.html, error pages | Empty states | Empty / 404 states | ADAPT |

## 4. What the port changes on purpose

| Area | Change | Why |
|---|---|---|
| Primary colour | `--primary-rgb` → Hangyul console cobalt **34, 87, 214** (#2257D6; YNEX supports primary switching through the same variable) | V6 console system; AA (white on cobalt 6.2:1) |
| Muted text | `--text-muted` #8c9097 → #5F6B80 | AA (3.3:1 → 5.4:1) |
| Fonts | Inter → Pretendard Variable (Inter-derived Latin + Korean); Montserrat 500/600 kept for sidebar labels (self-hosted, Latin subset; other scripts fall back to Pretendard) | BI + 56 locale bundles (33 markets) |
| Icons | Boxicons / Remix / Feather icon fonts (168 MB) → Lucide (tree-shaken SVG) | Performance; same stroke style |
| JS | `main.js`, `defaultmenu.js`, `custom.js`, SimpleBar, Node-Waves, Choices, DataTables, ApexCharts, FullCalendar, Dragula → React components | DOM ownership, bundle size |
| CSS | Bootstrap 5.3.3 + YNEX partials compiled from source inside `packages/ynex-ui`, only used partials, unused selectors purged at build | Performance |
| Status | Always text + colour (YNEX soft badges) | WCAG 1.4.1 |
