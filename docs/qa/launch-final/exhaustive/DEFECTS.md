# Exhaustive pass — defect inventory (2026-11-21)

Every defect found in this pass (29 product, 3 harness), how it was found, the root cause and the fix. Found = from the rendered product
(Design Preview builds, synthetic fixtures; real builds for public pages), at the widths named. P1 = blocks or misleads a
task, P2 = wrong/inconsistent information or a broken interaction, P3 = polish that a user notices.

## Product defects (all fixed)

| # | Sev | Product | Defect (as a user sees it) | Root cause | Fix |
|---|---|---|---|---|---|
| 1 | P2 | Student home | University names mixed languages on one screen ("Pusan National University" in the next step, Coming up and document rows; "부산대학교" in the list) | The server sends flat English labels (`params.university`, `application_label`, `university`) | Home re-reads every application name from its own `{name_en, name_ko}` (`appOf` / `appLabel`); unit test added |
| 2 | P3 | Student home | Next-step title packed university + programme + task into three lines | Title template received the joined "university · programme" label | Title names the university and task; programme · intake on its own context line |
| 3 | P2 | Student home (web + native) | Team card said "한귤 유니브 상담팀" three times and rendered the internal organisation name ("with {org}") | Legacy agency line `withAgency` | Line replaced by "with you since {date}"; native line removed; test asserts no organisation name |
| 4 | P3 | Student home | "이름 생년월일 외 9개" — list without commas | `Intl.ListFormat` `unit` style joins Korean with spaces | Locale list comma when a remainder follows |
| 5 | P1 | Student (all) | "Your counselor / 상담사 / カウンセラー / консультант" in 86 student-facing strings, against the one-identity rule; zh-Hant team name read "你的團隊" | Copy predates the V22 team-identity rule | 86 keys rewritten in en, ko and the 19 other Student locales (AI-drafted like the rest of each bundle); zh-Hant team name fixed |
| 6 | P2 | Student messages | A failed send showed a toast on top of the composer, said twice; **attachments were dropped**; on a phone the thread opened at the oldest message | `onMutate` cleared files and `onError` restored only text; list-only auto-scroll | Text and attachments restored, inline "Not sent. Your message is still here." + reason under the composer (21 locales); thread opens at the newest message on phones |
| 7 | P2 | Student messages (desktop) | Composer below the fold at 1440×900: page and thread pane both scrolled | Pane `max-height` larger than the space under the page title | Pane sized to the window (`clamp(440px, 100dvh − 290px, 960px)`) |
| 8 | P2 | All three signed-in apps | "Mark all as read" / opening a notification / deleting a saved view threw an unhandled error on failure and said nothing | Awaited API calls without a catch | Mutations with a localized error toast; per-row read failures ignored quietly |
| 9 | P2 | Operations + University | 75 error toasts and messages showed the server's raw `detail` (English, sometimes technical) | `(e as Error).message` instead of the localized `errorText(e)` | All 75 call sites in 35 files use `errorText` |
| 10 | P2 | Marketing university page | "수용 인원 약 NaN명" (Seoul National University dormitory) | Research data stores capacity as a sentence; UI formatted it as a number | `capacityOf()` reads the first number, shows nothing when there is none |
| 11 | P2 | University review | Evidence documents named in English on a Korean screen ("Academic transcript", "TOPIK score report") | Raw requirement `label` | `docLabel()` (university-written request labels stay as written); same fix in the Operations catalogue |
| 12 | P2 | Operations visa panel; Student visa | Raw `NOT_STARTED` on screen | Fixture value the server never sends + no fallback | Fixture corrected; both renderers fall back to "준비 중" |
| 13 | P2 | Student essay editor | Title, breadcrumb and meta in English ("학업계획서 — Pusan National University") | Generated English title; context carried only `name` | `essayTitle()` localizes the university part; server adds `context.university.name_ko` (additive) |
| 14 | P2 | Operations message thread | Linked application named in English | Delivery endpoint sent `name_en` only | Server adds `university_ko`; client `uniName()`; API test asserts it |
| 15 | P2 | Operations templates | Variables shown as English tokens ("student name") on a Korean console | Token text built from the variable name | `templates.var.*` labels (ko/en) |
| 16 | P2 | Student (machine-drafted locales, e.g. ar) | Notice said the language "covers 100% … so some text may be in English" | One sentence for full and partial coverage | `i18n.machineFull` (56 locales) when coverage is 100 % |
| 17 | P2 | Student / service unavailable (ko) | "지금은 Hangyul에 연결할 수 없습니다" | Latin brand in Korean copy | "한귤 유니브" |
| 18 | P3 | Student profile (320) and every phone status | "추가 / 됨" — a two-syllable status split across lines | `.hg-status` used `overflow-wrap: anywhere`, whose min-content is one character | `break-word`, Korean-only `keep-all`; profile heading row wraps |
| 19 | P3 | Student documents (ar, ru, my at 390) | Completeness heading squeezed beside "Add document type" into three lines | Two-column grid on a phone | Text → bar → action stack |
| 20 | P3 | Student essay | Version diff in a 320 px inner scroller | `max-height` on `.st-diff` | Grows with content under the page scroll |
| 21 | P3 | Student essay | Empty comments shown twice, as a centred heading-like block | `EmptyState` + head count | One quiet sentence |
| 22 | P3 | Student messages | Each consultation row repeated "· 한귤 유니브 상담팀" | Host name appended | Removed (the host is always the team) |
| 23 | P3 | Student, consoles, marketing | Text under the 12 px floor: tab labels 11.5 px (10.5 px in my/km/si/lo), count bubbles 10–11 px, step numbers, photo credits, university group labels | Literal sizes | `--hg-text-xs` (12 px) |
| 24 | P3 | Phones, all apps | Controls under the touch target: password toggle 32 px, switches 24 px, task checkbox 20 px, journey steps 28 px, disclosure summaries 21–34 px, attachment buttons 31 px, document step marks 28 px, Operations queue checkboxes 16 px, owner buttons / filter chips / template language buttons / matrix cells 24–34 px, Marketing source links 16–28 px | Drawn size = hit size | Touch-only hit areas (pseudo-elements or min-height), drawings unchanged; text links ≥ 24 px (WCAG 2.5.8) |
| 25 | P3 | Phones (in-app browsers, WebViews) | A focused field could stay behind the keyboard | Relied on the browser alone | `installKeyboardFocusKeeper()` in `bootWebApp`: when the visual viewport shrinks, the focused field is brought into view |
| 27 | P3 | All products, Korean | Korean body text broke mid-word at narrow widths ("프로 / 그램", "체 / 크리스트") | Default `word-break: normal` breaks between syllables | `:lang(ko) body { word-break: keep-all; overflow-wrap: break-word }` (Korean only; overflow re-verified at 12 widths) |
| 28 | P3 | Student messages | The composer stayed one line tall: a longer message was cut and scrolled inside the box | `rows={1}` textarea with no growth | Grows with the text up to its 160 px maximum, shrinks after sending |
| 29 | P2 | University overview and analytics | The page jumped after first paint: CLS **0.65** (overview) and **0.48** (analytics) at 390 px, 0.12 on analytics at 1440 | The summary columns, the header meta line and the KPI band rendered empty or partial and grew as five queries returned | Summary and KPI band hold a skeleton of final geometry until their data is complete; the meta line draws once; CLS now 0 / 0.018 (390) and 0.036 / 0.065 (1440) |
| 26 | P3 | Design Preview fixtures | English university names in Operations/University previews where the current API sends Korean names | Fixtures predate `name_ko` / `university_ko` | Fixtures enriched from the catalogue's own names (no new data invented) |

## QA-harness defects (fixed — they hid product defects)

| # | Defect | Effect | Fix |
|---|---|---|---|
| H1 | Route inventory lacked `/match`, saved universities, the purchase gate, `/review?mode=documents` and all seven HQ routes | Owner requirement 1's own screen was never in a gate | Added; HQ routes open in the `hq` preview variant in every script |
| H2 | The new audit's tiny-text and touch-target checks excluded `[data-design-preview]`, which is on `<html>` | Every signed-in screen passed those checks vacuously | Exclude only the badge |
| H3 | Scroll oracle counted content inside closed `<details>`, fixed chrome and content above a footer; smooth scrolling hid the final position | False "unreachable" reports | Oracle skips closed disclosures and fixed/sticky chrome, scrolls instantly, flags only content still below the viewport at maximum scroll |

## Regressions introduced in this pass and caught by its own gates (fixed before release)

| Change | What the gate found | Fix |
|---|---|---|
| #18 status wrapping (`break-word`) | `matrix.mjs`: University team roster overflowed at 320–393 px and at 768 @ 200 % — a one-word "Inactive" could no longer shrink below its word | The roster's name gives way (ellipsis) and the status keeps its width (`flex: none`); re-run 0 overflow |
| #3 team card "with you since {date}" | `lang-leak.mjs`: English in bn, hi, th, ur (and, outside the gate's Latin rule, fil, id, kk, ky, tr) — the key existed only in some locales | `dashboard.counselor.since` written for the 9 missing Student locales |
| #6 thread opens at the newest message | `student-scroll.spec.ts` (phones): "End + wheel did not scroll" — the page already sat at its end | Behaviour kept (it is the fix); the spec now starts every page at the top |

## Reviewed and kept (not defects)

- Chat history scrolls inside its pane (Student desktop thread, Operations workspace "recent conversation", University thread): a chat
  opens at the newest message and the composer stays visible; this is the one place a nested scroll is the right pattern.
- `/hq/assignments` student picker: an always-visible listbox, not a popup.
- `/hq/readiness` shows environment-variable names (`HG_SMS_API_KEY`, …): an HQ engineering readiness page; the names are the
  instructions.
- Headline prices are symbol-only ("$349"); the currency is stated in words next to the pay action ("미국 달러(USD) 기준 1회 결제").
- Programmes with a passed deadline inside "For you" in Design Preview: fixture dates are static; the server excludes closed intakes
  (`matching.py`, `NO_OPEN_INTAKE`).
