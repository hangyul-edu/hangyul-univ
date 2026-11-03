# V9 coordinator log

## Console navigation at 1024 (§55 #17)
- `packages/ynex-ui/src/components/Shell.tsx`: removed V8's automatic icon rail below 1280 px. The sidebar is labelled unless the user collapses it; the choice is stored under a new key (`hg.<product>.sb.v9`) so V8's automatic value is ignored.
- `_hangyul-skin.scss`: at 992–1279 px a compact **labelled** sidebar (12.5 rem instead of 15 rem; smaller item padding, group labels kept). Content width at 1024 = ~800 px (icon rail gave ~920 px; tables already fold by column priority).
- Header org label ellipsis below 1280 px; its badge hidden there.
- Verified by eye: agency Today and university Applicants at 1024 (`/tmp` shots, re-captured in the after set).

## Marketing home: the check is the hero (§55 #26, §58 S1 entry point)
- New `apps/marketing-web/src/pages/home/v9.tsx` (`HeroCheck`) + `src/v9.css`: Seoul photo, headline, one-line promise and the three-question check on the photo (result replaces the form in place; the student workstream adds routes to the result). `id="check"` kept on the card so every `#check` link still lands on it.
- Removed from the home: V7 Eduan h6 banner with cap-icon subtitle, the index-7 coloured tile strip, the separate check section with its photo and "Study in Korea" outline ticker (`Hero`, `QuickCheck` in v7.tsx are no longer rendered by the home).
- Phone (390): headline + the whole first question + Next in the first viewport. Home length 8.6 → 7.5 phone screens; 8.1 → 6.8 at 1440 (`scripts/qa/_shot.mjs`, full page).
- Sitewide (`packages/eduan-ui/src/scss/_hangyul-glue.scss`): Eduan's bordered eyebrow pill → quiet label with the tangerine sun dot; outlined counter numerals → solid ink numbers.
- PENDING: the "46 languages" counter becomes the count of complete student-app locales once the localization gate exists.

## Honesty fixes (§55 #5)
- Marketing trust counter: hard-coded "46 languages supported" → `studentApp.locales.length` (locales that passed the student completeness gate) with the label "languages with the complete student app (human translation review still pending)".
- Marketing FAQ "Is the site available in my language?" claimed "English and Korean are reviewed" (Korean has only an AI review). New answer `v9.faq.languagesA` (en/ko) states the gate and that no language has had a human review; the old key's translations are no longer shown.
- Student Settings showed the raw key `settingsV3.translation.SYNTHETIC_REVIEWED` in every non-English language (V8 status names had no keys). Added SOURCE_APPROVED / HUMAN_REVIEWED / SYNTHETIC_REVIEWED wording (synthetic = "checked by an automated review, not yet by a person"), en/ko + vi/ne/my/zh-Hans.
- Program page: English-only catalogue summary is shown as quoted text (`lang="en"`, `data-source-quote`) with "published in English only" (key `student:v9.catalogue.englishOnly`).
- Visa: en/ko names for the 32 country-specific visa documents (`visaroute:doc.other_*.name`); ko brand drift "Hangyul 확인" → "한귤 확인".
- Mobile: agency waiting-on keys for counselor/agency/hangyul/external/none (en/ko).
- Leak scanner (`scripts/qa/leak-check-v9.mjs`): retries once when a late redirect destroys the page context; KIIP/MOJ/MOE/HCCH allowed as official acronyms.

## Match-tier vocabulary (STATE_MAP) — found during localization review
- English `common:tier` (rendered by the student tier badge and the native StatusBadge) still said "Competitive match" / "Reach" while every other screen says "Possible match" / "Not eligible yet". Fixed en; ko set to the reviewed terms.
- ko review had changed "Possible match" to 「가능성 있음」 ("there is a chance") — an admission-odds reading the honesty rules forbid. Now 「요건 충족·확인 필요」 (meets the requirements · needs a check) for `student:verdict.COMPETITIVE`, `discover.verdict.reach`, `common:tier.COMPETITIVE`; scholarship "may qualify" phrasing 「자격이 될 수 있음」 instead of 「가능성 있음」.
- zh-Hans `start.tier.POSSIBLE` / `mobile:v3.quick.tier.POSSIBLE` ("One step away") said 可能匹配 ("Possible match") → 只差一步.
- `scripts/i18n/v9-sync-tier.mjs <loc…>` copies each locale's reviewed `student:verdict` terms into `common:tier` through the merge validator (run for every finished locale).
- Translators found the same verdict bug (COMPETITIVE showing the "Strong" term, REACH the "Possible" term) in ne, my, zh-Hans, uz, mn, vi, zh-Hant — each fixed in its locale.

## Final verification (2026-10-14)
- Gates: typecheck 7/7, ruff clean, i18n exit 0, vitest 207, pytest 343, 4/4 builds, 0 demo emails in bundles.
- Captures: 442 views (before 436) — 0 sideways tables, 0 overflow, 0 h1 errors, 0 runtime errors.
- axe: 0 violations after fixing a nested-interactive row card in the shared DataTable (found by this run).
- Visual QA: 243 views, 0 issues. LCP: phone 2.01 s / desktop 1.36 s.
- Localization: all 20 offered locales at 100 % of the student manifest with a recorded 0-leak scan.
- Leak scanner corrections during the pass: wait for `<html lang>`; catalogue scholarships; brand/venue proper nouns; retry after a late redirect.
- Regression found by the before/after comparison and fixed: agency Applications gained two sideways tables at 768/1024 (two V9 columns were priority 1); now priority 2.
- Translation notice: it measured raw namespace coverage, so a locale that is 100 % complete for the student journey still showed "99 % of this app is translated" with a warning banner. `translationQuality(locale, ns, 'student')` now uses the V9 gate; a complete locale shows no notice (verified in Burmese).
