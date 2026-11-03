# V8 localization workstream — log

Owner: localization agent (AI). Started 2026-10-09.

## Plan (priority order)
1. tk + ka common.json (MACHINE_DRAFT, register → 55 locales)
2. marketing `v8.*` + student V8 keys into every locale that has those files (reusable merge script)
3. Synthetic persona reviews: ko, vi, zh-Hans, uz, mn, ne, my, ja, th → docs/qa/v8/l10n/<loc>.md
4. RTL QA ar/ur/fa/he at 390/1440 → docs/qa/v8/rtl/
5. docs/I18N.md V8 section

## Progress
- 2026-10-09 start: inventory — 53 registered; tk/ka directories absent; student.json exists for 13 locales (ar ja ko mn my ne ru tg uk uz vi zh-Hans zh-Hant), marketing.json for 45.
- Task 1 DONE: `tk/common.json` (Turkmen, Latin script) and `ka/common.json` (Georgian, Mkhedruli) written by hand-drafting — 578/578 keys each, `validate-locale.mjs` OK (placeholders, `_one/_other` = CLDR categories for both). Registered in LOCALES as MACHINE_DRAFT → **55 locales**. `npm run i18n:check` exit 0.
  - Not done (out of scope, logged as gap): `server/app/seed/reference_data.py` locale table (already lacks the V8 he/ps/… additions too); Intl fallback for browsers with reduced ICU — checked in task 4.
- Task 2 DONE: `scripts/i18n/v8-translate.mjs` + data in `scripts/i18n/v8-data/{marketing-a..d,student-a,b}.json`.
  - Marketing `v8.*` (48 keys) → all **43** non-source locales that have marketing.json (am ar az bn cs de el es fa fil fr hi hu id it ja kk km ky lo mn ms my ne nl pl pt ro ru si sv sw ta te tg th tr uk ur uz vi zh-Hans zh-Hant).
  - Student V8 keys → all **12** non-source locales with student.json (ar ja mn my ne ru tg uk uz vi zh-Hans zh-Hant): 29 keys (+ CLDR plural forms: ru/uk 35, ar 41); legacy `more.*` keys filled only where missing (tg/uk 19, ja/ru/zh-Hant 3).
  - Script validates key set, `{{placeholders}}`, tags and CLDR plural categories; refuses en/ko; never creates namespace files. Verified against a pre-merge snapshot: **0 out-of-scope key changes**; re-run is idempotent.
  - Register aligned with each locale's existing marketing copy (de du, fr vous, el formal σας, pl capitalised Twój/Ci, id/ms Anda, fil ikaw). Typos caught by `scripts/i18n/v8-data/_mixcheck.mjs` (mixed-script words) were fixed before merge (hi, tg, uz).
  - Noted: `marketing.v6.life.alt` is intentionally empty in en (decorative photo), so its absence elsewhere is correct (validate-locale flags ko's empty value — false positive). vi/ja/my lack some `_one` keys — harmless, those languages only use `_other`.
- Task 3 ko DONE (record docs/qa/v8/l10n/ko.md, 416/416 strings): **brand split fixed — 226 strings 한결 → 한귤** in all 11 ko namespaces + v7/v8 generator scripts (canonical per Hangyul's own ko copy). ⚠ Agency/university workstreams: your ko strings now say 한귤 — please don't reintroduce 한결. Also fixed: verdict.reach 확인 필요→가능성 있음, Strong match unified 적합도 높음, 과정→프로그램 in V8 student keys, 지원비→전형료.
- Cross-locale honesty sweep (found during the uz review): `marketing:quick.meetsNone` had an added promise ("but it's only temporary / not the end / not forever") in th, km, lo, uz, zh-Hant, it, ar → removed (English says only "— yet"). `quick.tier.POSSIBLE` (= "One step away") was "possible match" in ar, mn, my, ne, uz → fixed. `common:tier.STRONG` said "strong chance" (admission odds) in ru, uz, mn, my, ne → "match" wording (ru fixed here, others in their reviews). zh-Hans/zh-Hant 稳妥/穩當 ("safe bet") fixed in the zh-Hans review.
- Task 3 DONE: records for ko, vi, zh-Hans, uz, mn, ne, my, ja, th in docs/qa/v8/l10n/ (+ README with the shared method). Status set to SYNTHETIC_REVIEWED for all 9 (ko kept, now with a record). Fixes: `scripts/i18n/v8-data/review-fixes.json` via `scripts/i18n/v8-review-fixes.mjs` (idempotent). Biggest gaps closed: ja 107 English fallbacks on discover/budget/compare + i18n notice; th/ja i18n notice was English; zh-Hans/uz/mn 14–17 compare/verdict fallbacks. Stale `{{percent}}` in mobile COMPLETE_PROFILE fixed for ja/ru/zh-Hant (validate-locale errors).
  - th: SYNTHETIC_REVIEWED covers common + marketing only; th has no student.json (student app = English + notice). Stated in th.md.
- Task 4 DONE (docs/qa/v8/rtl/README.md, 32 views, scripts/qa/v8-rtl.mjs): dir=rtl 32/32, overflow 0, mirrored 32/32, physical-left text 0. Fixed: (1) bidi reordering of English fallbacks ("?Korea", "seconds … 30") → `unicode-bidi: plaintext` on text blocks under [dir=rtl] in marketing v6.css + student v7.css; (2) 524 RTL strings that start with Latin/placeholder get an RLM (scripts/i18n/rtl-mark.mjs, auto-run by v8-translate/v8-review-fixes); (3) machine-draft notice translated for 34 locales that showed it in English; (4) ar student v4 block: 57 visible keys translated. No layout CSS needed (logical properties already).
- Task 5 DONE: docs/I18N.md — "Locales (55)" heading + V8 taxonomy table; "V8 (2026-10-09)" section (rules, coverage of the 10 V8-added locales, scripts, synthetic reviews, RTL results, honest gaps incl. Chromium ICU for tk/ka/ps/hy/ha/yo/ig/so and server reference_data).
- Final gates: `npm run i18n:check` exit 0; tsc --noEmit 0 for marketing/student/agency/university web; validate-locale clean for all locales on common/marketing/student/mobile; v8-review-fixes and rtl-mark: 0 changes on re-run; v8-translate rewrites the marketing `v8` subtree from data and rtl-mark re-adds 13 RLMs → identical end state.
