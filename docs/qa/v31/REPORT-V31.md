
# V31 — VISUAL DESIGN, UX CLARITY & GLOBAL LANGUAGE QUALITY (2026-11-01)

> V31 starts from the owner's second visual review: technically correct screens that still read as mediocre — the
> homepage pricing tail and the agency pipeline first. Nothing in V29's contract, prices, entitlements, states, payment
> or security semantics changed. Two server changes alter presentation only (names resolved for the reader; keyed task
> titles). The VM rebooted three times during the pass; every long job was resumable and none was lost.

## BEFORE IMPLEMENTATION

# 418. V31 Full historical defect analysis

`docs/qa/v31/DEFECT_MATRIX.md` — 13 recurring families from V3–V30 (template debt, weak CTA hierarchy, mixed status
dimensions, translation fallback, English server prose, gates green while visuals weak, inert/partial interactions,
native lagging, data-because-it-exists, card proliferation, surface inconsistency, outcome promises, hand-edited
generated files), each with first/last occurrence, root cause, V31 status and the protection that now exists.

# 419. V31 Marketing visual audit

Reproduced (`docs/qa/v31/before/mk-pricing-tail-{1440,390}.png`): after the plan comparison, a 3fr/2fr grid — add-ons
table left, ONE `이용 안내` accordion right, ~400 px of empty column under it; the accordion looked like a leftover FAQ
row; four separate ideas (cards, compare, add-ons, notes) without one composition. Whole homepage reviewed at 1440
(`before/mk-home-full-1440.png`): hero, crest band, triptych, photo rows, pricing, FAQ and closing band hold their
rhythm — the pricing tail was the one section that broke it. Korean homepage copy contains promotional superlatives
(완벽, 최고, 보장) but is the owner's verbatim Koreanasha copy (V11 fidelity gate) — flagged, not rewritten.

# 420. V31 Agency visual audit

Reproduced (`before/ag-today-1440.png`, V30 baseline `docs/qa/v30/visual/gate/shots/agency-root-ko-1280.png`):
- the console surface was three hairline-separated white slabs (top bar, sidebar, table card) on an off-white body —
  the template look; the canonical neutral ramp was **cool blue-grey** (`#E7E8EA`, `#555A62`, `#8A9099`);
- the pipeline was text + 14-px chevrons; `전체 19` drawn as the first stage; counts glued to labels; the selected
  stage a thin outline; `7 긴급` alone on a row; `종료 0명` stranded at the right — three dimensions (attention, view,
  journey) presented as one row of look-alike chips;
- language: university column and task titles in English for a Korean reader (V30 open item).

# 421. V31 Student visual audit

Student surfaces share the token ramp (cool hairlines on warm surfaces). Next action dominates (V30). Native home
showed English university/programme names and an English checklist label after switching to Korean (found on the
emulator — §431).

# 422. V31 University visual audit

Same shell and token problems as Agency; the applicant stage strip shares `StageStrip` (same defect). V30 filters
already content-sized.

# 423. V31 Language & translation audit

- Korean source: several strings contradicted the contract or Korean law (team "submits" the application; 신청 대행 =
  applying on the student's behalf; 무제한 without scope; 함께 작성 = co-writing; privacy note omitting the partner agency).
- English: literal translations of Korean promotional and product copy; **meaning errors** that broaden entitlements
  ("Visa documents prepared", "Intensive visa scheduling", "Consultation support" for the support window,
  "Applications managed" next to "recommendations").
- Translations (V28/V29 machine-reviewed): every locale carried the same meaning errors plus locale-specific ones
  (e.g. consular legalization as "confirmation", Brazilian forms in pt, wrong plural forms in uk, Hangul inside
  translations from an English source that itself contained Hangul).
- Gate gap: nothing checked stale/forbidden terminology, placeholder/plural integrity across all 56 bundles, or
  Hangul leaks.

# 424. V31 Native audit

V30 audited native statically only. V31 runs current source through Metro in Expo Go on the `hg35` emulator.

# 425. V31 Implementation plan

1 tokens + shell (root cause of the grey) → 2 `StageStrip` → pipeline rail (views/attention/journey) → 3 pricing tail
as one composition → 4 server-name leaks (keys + middleware) → 5 ko/en source + glossary → 6 32-locale review jobs
(3 passes + back-check, validator) → 7 gates (`qa:v31-l10n`, stage, pricing) → 8 native run → 9 regression + sign-offs.

## AFTER IMPLEMENTATION

# 426. V31 Design-system results

**Warm neutral ramp in the token SOURCE** (`packages/design-tokens/src/index.ts` → generated `tokens.css`; console
copy in `console-v22.css`; native `console.ts`). Every step keeps or improves its WCAG role:

| Token | Before | After | Contrast on white |
|---|---|---|---|
| text-secondary | #555A62 | #56524B | 7.77:1 |
| text-tertiary | #686D76 | #6A655D | 5.20 → **5.78:1** |
| border-control / secondary edge | #8A9099 | #8C867C | 3.22 → **3.61:1** |
| border / subtle / strong | #E7E8EA / #EEEFF1 / #D5D7DB | #E8E4DD / #F0ECE6 / #D6D0C6 | hairlines |
| surface-warm / sunken / hover | #F6F6F3 / #EFEFEC / #F8F8F6 | #F6F3EE / #EFEBE4 / #F9F7F3 | |

**Generated file trap found:** `tokens.css` carried V27's secondary-button values and `--hg-touch-min: 44px` that were
NOT in its source; regenerating would have silently reverted both. Both now live in the source/generator.

**Console shell:** white working canvas; the navigation is the one warm-paper panel (`--hg-bg-paper #FBFAF7`) behind
one hairline; top bar = the canvas white; table headers paper; last V6 cobalt/navy (phone drawer selection, bell count)
re-pointed to tangerine/ink.

**Pipeline rail** (`StageStrip` work mode → `PipelineRail` + `StageView`, packages/ui): views (전체, 종료) and the
attention view (긴급, alert-toned count) are bordered toggles OUTSIDE the stage list; each stage is ONE button —
label · count (22 px, tabular, data) · a segment of one continuous track whose fill is the stage's share of the
largest stage (overload visible at a glance); selected = tint + tangerine segment + ink label + tangerine count; a
selection greys the other fills; zero = quiet but ≥ 4.5:1, not a dead filter; the rail scrolls inside the band
(the pipe takes exactly its container's width — a measured 982-in-784 px overflow fixed at the primitive); 44-px
targets on phones; reduced motion respected. Used by Agency Today/Students and the University applicant strip.

**Query refresh on language change** (web `packages/ui/src/app.tsx`, native `mobile-ui/bootstrap/Providers.tsx`).

# 427. V31 Marketing results

Pricing tail recomposed as ONE panel (`pricing.tsx` AddOns + ServiceNotes, `home.css .kn-pricing__more`): add-ons as
aligned rows (name/unit, price at the inline end) in two columns ≥ 900 px; the notes became a full-width disclosure
inside the panel ("구매 전에 확인해 주세요" + summary line) with four labelled groups (payment, costs outside the plan,
scope, visas). Anchors clear the floating header (`scroll-margin-top`). `qa:v31-pricing`: ko/en/vi/ar × 1440/1024/768/390
— one composition, alignment, columns, groups, blank regions, anchor. RTL: the gate first failed all Arabic rows
because it measured the physical right edge; it now measures the inline end. An LTR isolate on price ranges was tried
and reverted — Intl's Arabic output carries RLM marks and reads correctly right-to-left without it.

# 428. V31 Agency results

Today: white canvas, paper navigation; `PipelineRail` with 긴급/전체 views before and 종료 after the nine stages.
`qa:v31-stage` (1440/1280/1024/768/390): views outside the rail, count == table records for every non-empty stage,
one pressed stage, tangerine fill, keyboard select/clear, label+count+segment one hit target, zero stage readable and
inert, no raw enums, no page overflow. The final run caught the last stage cut through at 1280 — the stage minimum
went 84 → 72 px (all nine fit at desktop widths) and a scrolling rail now fades on the side that has more stages
(`data-more`, logical in RTL); the gate requires both.

# 429. V31 University & Student results

University: same shell and rail; the cumulative conversion strip renamed "지금까지의 누적 결과 / Outcomes to date"
(it sat above the current-stage rail: "5 합격 통보" vs "합격 1"). Student: Upcoming panel fully Korean —
`application_label` (plain university or "University · Programme") resolved by the middleware with the
both-parts-must-match rule; grouped lines name each document/essay (`itemName`) instead of cutting the university out
of a translated sentence (which left "지원용 …" in Korean and "cho …"/"для …" elsewhere).

# 430. V31 Localization results

`LANGUAGE_SIGNOFF.md`: 32 market locales × 1,729 critical keys = 55,287 reviews, 10,394 strings changed, every locale
`SYNTHETIC_NATIVE_REVIEWED_V31` (none HUMAN_REVIEWED). ~310 ko/en source strings + 143 console English strings
revised (`source-audit.json`). **Owner-approved plan copy restored** after `plan-content.test.ts` failed in the final
regression: V31 had edited 18 pinned lines; ko/en restored verbatim, translations re-aligned (133 strings).
`qa:v31-l10n` over 56 bundles: 0 open findings (2 reasoned Korean placeholder exceptions; 4 owner-verbatim strings
flagged; 454 warnings, mostly RTL marks). Stale non-market bundles (fa, tg, zh-Hant) had orphan plural/placeholder keys
removed. Korean official names glossed in parentheses (외국인등록증) are allowed by the gate.

# 431. V31 Native results

Current source run through Metro (`expo start`, CI mode) in Expo Go on the `hg35` emulator (API 35, 1.5 GB guest),
one app at a time; evidence in `docs/qa/v31/native/`.

**Student (ko).** Found on the device: the home next-action read "Pusan National University · Business Administration
(BBA) 지원용 high school transcripts by year (3 years) 수정하기". Two root causes: (1) the dashboard sends the
application as one composite string "University · Programme", which the name middleware could not match; (2) native
composed the checklist label from the API's English guide wording, while the web uses `docLabel` (category name for
non-English readers). Fixes: `localnames.localize` resolves a composite only when BOTH parts match a known
university and a known programme of that university (test added: an unknown programme is left untouched); native
`journey.ts` uses `docLabel`/`essayLabel`. Re-verified on the device: "부산대학교 · 경영학과 지원용 성적증명서 수정하기",
upcoming list fully Korean (`student-home-ko-after.png`).

**Agency (en → ko).** Sign-in with the test account, Today, Settings → 한국어, Today again. Korean: task titles keyed,
university names resolved ("Đặng Ngọc Mai 님의 부산대학교 지원서 제출하기(위임 제출)"), no English left on Today. Copy defect
found on the device: the overdue line repeated the student — "Oldest: Overdue essay review: personal statement for
Đặng Thảo Vy (Đặng Thảo Vy)". Fixed with `v3.agency.att.oldestSelf` (all 36 mobile bundles; the student is appended
only when the title does not already name them).
Re-verified after a fresh bundle (Metro in CI mode does not watch files — restart it after an edit):
"가장 오래된 일: 에세이 검토 기한 초과: Đặng Thảo Vy 님의 자기소개서" (`agency-home-ko.png`).

**University (ko).** Signed in with the test account (Pusan National University). Home: decision count, document
requests, interviews, offers awaiting the student; review list with Korean programme/term/country lines; no English
(`university-home-ko.png`).

**Host limits recorded:** Expo Go was killed or went unresponsive (ANR) five times while another project on this host
rendered video (6 ffmpeg workers, load 26). Each app was eventually run to its home screen; deeper flows (upload,
messaging, decisions) were NOT driven on the device in V31.

# 432. V31 QA ledger (final runs, 2026-11-01 — logs `docs/qa/v31/logs/`, `docs/qa/v31/logs-*.txt`)

| Gate | Command | Result |
|---|---|---|
| Typecheck (7 workspaces) | `npm run typecheck` | PASS |
| API lint | `npm run lint:api` (ruff) | PASS (2 import-order findings in the V31 middleware edit fixed) |
| API tests | `cd server && pytest -q` | PASS (full suite) incl. `test_v31_localnames.py` (5) |
| Web unit tests | `npm run test:web` | PASS — 50 + 39 (22 skipped) + 15 + 113. Found: approved plan copy edited (restored, §430); one expectation updated to the V31 match-reason wording |
| Translation gate | `npm run qa:v31-l10n` | PASS — 56 bundles, 0 open; 4 owner-verbatim flagged; 454 warnings |
| Korean particles | `npm run qa:v28-particles` | PASS (0) |
| Owner copy fidelity | `node scripts/qa/v11-copy-fidelity.mjs` | PASS 82/82 (ko + ru) |
| Pipeline rail | `npm run qa:v31-stage` | PASS — 5 widths (failed once in the final run: 1280 clip → fixed, §428) |
| Pricing tail | `npm run qa:v31-pricing` | PASS — 16 measurements (ko/en/vi/ar × 4 widths) |
| Visual crawl ko 390+1280 | `qa:v31` step `crawl` (V30 tool) | PASS — 198 pages, 0 open (first run: 24 off-centre view labels → content centred; 1 transient blank page) |
| Visual crawl en/vi/zh-Hans/ar | `qa:v31` step `crawl-locales` | PASS |
| V30 marquee + directory | `qa:v31` step `v30` | PASS |
| Native bundles | `qa:v31` step `native` (`expo export` ×3) | PASS — student, agency, university |
| Critical E2E (e2e database) | `playwright test lifecycle tenancy redesign v5-flow-g --project=desktop` | PASS 13/13. First run was wrongly against the DEV database (no TEST FIXTURE guides → READY refused, `ADMISSION_GUIDE_REVIEW_REQUIRED`); 3 specs selected the old `.hg-strip` / old wording and were updated |
| Native on device | Expo Go, `hg35` | student / agency / university home screens in ko (§431) |

# 433. V31 Remaining items and owner decisions

Owner decisions (not changed by V31):
1. **Owner-verbatim homepage copy (ko + ru Koreanasha strings, V11 gate)** still contains guarantee/superlative wording
   (완벽, 최고, 보장 / гарантируем). The translations of the same ideas were made outcome-neutral.
2. **Approved plan copy**: Basic f4 reads "checklist of the documents you need" in most locales where Korean says a *basic
   admission* document checklist; partnership "guarantee" keys; Polish register (Ty vs impersonal).
3. `_one` plural strings whose English has no `{{count}}` (3 keys) need a source change to read correctly in fr/ru/uk/sr.
4. FAQ nav label length in ro/nl ("FAQ"); Italian gendered forms.

Known, not fixed:
- `task.writingOverdue` titles read "기한 지난: 에세이 검토 기한 초과" (the escalation task's own deadline also passed) — copy
  for all 56 bundles.
- University native home: the 2×2 count grid weights two "this week" zeros like the 6 that need a decision.
- Native flows beyond the home screens (upload, messaging, decisions) were not driven on the device; the host repeatedly
  starved the emulator (§431).
- No human native review of any locale (all `SYNTHETIC_NATIVE_REVIEWED_V31`).

External blockers (unchanged from V29 §406; V31 changes none of them): production payment keys/merchant contracts,
identity/SMS provider credentials, store accounts and signing, human translation review, the owner's legal review.

# 434. V31 Performance and designer self-critique

**Performance** (`docs/qa/v31/PERF.md`): payload flat (marketing CSS +10 KB), CLS unchanged, LCP slower on every route
including untouched ones while another project saturated the host — recorded, not attributable.

**Self-critique — what a hostile reviewer would still say:**
- The fixes that mattered most were found late and by gates or the device, not by my own first screenshots: the 1280
  rail clip (`qa:v31-stage`), the native Korean leaks (emulator), the approved plan copy (`plan-content.test.ts`), the
  Upcoming panel's English (final AFTER capture). The visual review is necessary but was not sufficient on its own.
- I mis-judged one copy item as an entitlement error ("Visa documents prepared") without checking it against the
  approved Korean; the pinned test caught it. Contract copy must be read against the owner's source first.
- The university page stacks a KPI row, a cumulative strip and the stage rail before the table; it is now legible,
  not yet calm.
- The pricing tail is one composition, but the space between the compare toggle and the panel is generous.
- No locale has had a human native reviewer; the Arabic/Urdu range convention in particular should be confirmed.
