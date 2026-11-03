# V28 UX audit (written before any V28 change — 2026-10-29)

Method: the running product (dev stack, seeded data + V27 research), 181 BEFORE captures in `docs/qa/v28/before/`
(`scripts/qa/v28/capture.mjs before`: marketing 5 routes, student 7 + register, agency 5, university 4; widths 390 · 430 · 768 ·
1024 · 1280 · 1440, consoles also 1728; full page at 390 and 1280), read as contact sheets
(`scripts/qa/v28/sheet.py`). Each screen was judged by the five questions (most important thing · found in 2 s? · next
action · competing elements · what can go). Severity: S1 broken/misleading · S2 slows or confuses · S3 polish · S4 nit.
Native apps: not run for the BEFORE capture (Android emulator and Playwright are never run together on this host); their
audit is against source and the V27 emulator shots.

| # | Product · route | Viewport | Problem | Why it matters | Sev | Evidence | Root cause | Fix | Validation |
|---|---|---|---|---|---|---|---|---|---|
| MK-1 | Marketing `/start` (results) | all | After submit the page scrolls the results heading **under the fixed header**; the sort control is the first thing seen; then a group lede explaining the comparison | The answer (how many, which first) is not what the eye lands on | S2 | `marketing-start-1280.png`, `-390-full` | `scrollIntoView` without `scroll-margin`; result head ordered tools-first | Result summary first (count · strongest group · one line · improvement hint), sort after; `scroll-margin-top` | AFTER capture; visual gate "hidden primary" |
| MK-2 | `/start` | all | No "start here": 4 groups of equal weight; ~195 universities under "worth a closer look" for most bachelor profiles | Cognitive overload; the honest bucket reads as noise | S2 | `SIMULATIONS.md` (V27) | No curated first set; priority signals thin | "가장 먼저 살펴볼 대학" (top picks from verified groups), groups re-labelled per brief §11 with semantics unchanged, richer discovery priority (data depth, media, international support, scholarship), compact region filter after results | sim re-run; unit tests |
| MK-3 | University detail, no photo (`busan-national-university-of-education`) | all | Empty hero + faint watermark, then "어떤 학교인가요" — a 3-column grid of registry boilerplate (what a 국립대학 is) | Reads as a database record, not a place | S2 | `marketing-detail-nophoto-1280.png` | `whyPoints` built from registry type facts | Drop generic type explanations; identity hero with logo when licensed, else typographic; video poster hero when an international-student film exists (brief §16) | AFTER capture |
| MK-4 | Detail + quick fit | all | Scholarship names in English on Korean pages ("Challenge Scholarship C", "Korean Track new-student scholarship — TOPIK 3 / …") | Looks unfinished; undermines trust in a money fact | S2 | `marketing-start-1280.png` | V27 research stored English/composite names in `name` | `name_native` / `name_official_en` / `name_display_ko` from the official sources; locale-aware display | data gate: Korean UI shows no Latin-only scheme name where a native one exists |
| MK-5 | Detail | 1280 | Source / checked-date / count lines inside the reading flow of every section | Metadata interrupts the story | S3 | `marketing-detail-yonsei-1280-full.png` | each section prints its own provenance | one quiet "출처" disclosure per section; counts removed from headings | AFTER |
| MK-6 | Directory | all | Card = photo + name + region + type; nothing says why a student might care | Discovery feels like a registry | S3 | `marketing-directory-1280.png` | card content from V20 | add at most one verified signal line (e.g. "유학생 장학 확인됨 · 한국어 과정") — no requirements, no deadlines | AFTER |
| ST-1 | Student home, applications, upcoming | all | Programme names in English on a Korean screen ("Pusan National University · Business Administration (BBA)" ×4) | Mixed language on the most-read screen | S2 | `student-home-1280.png` | serializers/clients use `name_en` | locale-aware programme/university names (`name_ko` where present) | visual gate mixed-locale |
| ST-2 | Student documents | 390 | Status language is mostly action-led already; the legal/evidence detail sits on the first scan for some rows | Detail before action | S3 | `student-documents-390.png` | row renders treatment line inline | treatment line only when it is the action; evidence behind the row | AFTER |
| AG-1 | Agency workspace | **all** | Opens **scrolled into the middle** of the page (header cut off) | The two-second answer is literally off-screen | S1 | `agency-workspace-1440.png`, `-390.png` | an on-mount `scrollIntoView` for the default section | open at top unless a `focus=` / `tab=` asks otherwise | Playwright scroll position check |
| AG-2 | Agency workspace | all | V27 7-stage rail **and** the V9–V26 strip both state the stage/status | Same information twice | S2 | `agency-workspace-1440.png` | V27 added the rail above the strip | one head: stage + primary next action on top; waiting · deadline · owner in one line; full rail collapsed into a compact progress line | AFTER, timing note |
| AG-3 | Agency workspace / applications | 390–1440 | Requirement names in English on Korean UI ("Copies of parents' valid passports 필요") | Mixed language for operators | S2 | `agency-workspace-390.png` | blocker detail uses `label` | use guide `name_ko` for ko | visual gate |
| AG-4 | Agency Today | 1280–1728 | Greeting, 6 work-type chips, a stage strip and a filter row before the first row | Three control bands before work | S2 | `agency-today-1440.png` | V13 chips + V22 strip both kept | one band: stage strip with the urgent count as its first item; work types in the filter select | AFTER |
| UN-1 | University `/` | all | Home is the applicant table with 4 figures; no "what changed / where are delays / outcomes" | A table without insight | S2 | `university-home-1440.png` | V13–V26 decision-first list kept as home | Overview band on top: 오늘 결정할 일 · 파이프라인 · 이번 주 변화 · 결과 (each with its denominator, drilling to rows), table below | AFTER; unit test |
| UN-2 | University applicants / detail | all | Programme names English on Korean UI | Mixed language | S2 | `university-applicants-1440.png` | `name_en` | locale-aware names | visual gate |
| NA-1 | Agency / University native | — | Not rebuilt since V26: bundled strings predate V27's copy pass | Native lags web | S2 | REPORT §370 #12 | not rebuilt in V27 | rebuild all three after V28 | Android build + smoke |
| L-1 | All locales | — | Census (`docs/qa/v28/l10n/CENSUS.json`): customer keys A = 1,740, operational B = 851; every market misses 11–33 A and 193–235 B keys (English shows); **zh-Hant misses 472 A, ur 459, fa 1,076** (reachable through browser language) | English leaks in the flows that matter | S1 | CENSUS.json | V27 translated 727 keys only; zh-Hant/fa/ur never completed | fill + review A for every locale, B for markets; tiered review | `qa:v28-l10n` per-locale report |
| L-2 | de uk tr id fil kk ky cs | — | "consular confirmation" rendering in older strings | Wrong legal term | S2 | V27 l10n records | pre-V27 drafts | terminology fix + forbidden-term gate | gate |
| L-3 | pt | — | pt-BR and pt-PT mixed | Inconsistent voice | S3 | V27 pt.md | drafts from different sources | normalise to one variant | gate |
| L-4 | fa `tier.REACH`, pl plurals | — | "ambitious" for REACH; Polish `_few/_many` stale | Wrong meaning / grammar | S2 | V27 records | — | fix + plural gate | gate |
| C-1 | ko, ~40 strings | — | Hard-coded particle after a placeholder (`{{agency}}가`) | Wrong for half of all names | S2 | V27 COPY_REVIEW_KO §2 | strings predate the particle post-processor | pair form resolved by `particles.ts` + gate | gate |
| C-2 | en | — | "key money", ambiguous passport record / pickup handle, "journey" clichés, mixed spelling | Meaning / polish | S2–S3 | V27 COPY_REVIEW_EN | — | V28 English pass | review file |
| D-1 | Student explore / university page / native university screen | all | DEMO programme facts (tuition, intakes, minimums) render as facts beside verified V27 facts | Silent mix of demo and verified | S1 (production) | V27 §370 #3 | catalogue seeded as DEMO | a production rule: DEMO facts are never served as facts; gate | API gate test |

## Outcome (V28, after implementation — 2026-10-29)

| ID | Outcome | What changed | Validation actually run |
|---|---|---|---|
| MK-1 | Fixed | `scroll-margin-top` on the result; summary first | visual gate (hidden-primary) 0 findings |
| MK-2 | Fixed | summary sentence + "가장 먼저 살펴볼 대학" (≤4 from MEETS/ONE_STEP only) + tools after results; groups keep V27 semantics, 12 + 더 보기 | e2e `v3-student` quick fit (updated selectors), web unit tests |
| MK-3 | Fixed | "why" reasons: distinctive verified facts first, generic registry lines removed; hero: campus photo → reviewed film still (3 institutions) → identity composition | screenshots `docs/qa/v28/wip/hero-*.png`; visual gate marketing 50 pages 0 |
| MK-4 | Fixed | scholarship native / official English / Korean display names (alembic `v28sch0001`, 461 schemes) + `scholarshipName()` | `names28.test.ts` 3/3; visual gate mixed-locale 0 |
| MK-5 | **Not changed** | per-scheme source lines were already behind the "all scholarships" disclosure; each section keeps one quiet count/date line | — |
| MK-6 | Fixed | one verified signal line per directory card (scholarships → GKS → English degrees), API `signals` | `test_v28_directory_signals.py` 2/2; screenshots `wip/dir-*.png` |
| ST-1 | Fixed | `localName()` at 85 web + 22 native display sites | visual gate mixed-locale 0 (ko, 5 locales × 2 widths) |
| ST-2 | **Reviewed, not changed** | the one inline line per row is already the first actionable finding (e.g. the reviewer's correction reason, which is the action); informational notes and evidence are already in the drawer. The reviewer's own words are isolated as user content | BEFORE `student-documents-390.png` re-read |
| AG-1 | Fixed | thread scrolls its own list, never the page | e2e agency specs |
| AG-2 | Fixed | one quiet progress line; duplicate stage badge removed | buttons gate, e2e |
| AG-3 | Fixed | `detail_ko` for readiness blockers; Korean requirement names | visual gate |
| AG-4 | Fixed | Today in one band (urgent first in the filter strip) | visual gate, e2e |
| UN-1 | Fixed | pipeline line with denominators and small-sample note | `Kpi.test.tsx`, visual gate |
| UN-2 | Fixed | `localName()` | visual gate |
| NA-1 | See REPORT §377 | Android rebuild ×3 | Android build + emulator smoke |
| L-1 | Fixed (A/B scope) | every A and B key filled in 34 locales; consoles outside the census still English for Tier 3 | census (`CENSUS.json`) + `validate.mjs` per batch (there is no `qa:v28-l10n` script; the census and validator are the gate) |
| L-2 | Fixed | consular terminology in de uk tr id fil kk ky cs | validator FORBID list |
| L-3 | Fixed | pt-PT normalisation (136 strings) | validator pt-BR forms |
| L-4 | Fixed | fa REACH; pl/ru/uk/cs/ar plural forms | validator plural check |
| C-1 | Fixed | pair particles after placeholders | `npm run qa:v28-particles` |
| C-2 | Fixed | key money, journey clichés, etc. (`COPY_REVIEW_EN.md` rows 1–7…) | review file |
| D-1 | Fixed | DEMO facts withheld in production | `test_v28_demo_withheld.py` 3/3 |
| (new) | Fixed | console `.btn` had no keyboard focus ring (Bootstrap `outline: 0`) | buttons gate 26 pages: 0 focus missing |
