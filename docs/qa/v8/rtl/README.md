# V8 RTL QA — ar, ur, fa, he (2026-10-09)

Script: `node scripts/qa/v8-rtl.mjs ar,ur,fa,he` (one Chromium; dev stack on :3100/:3101/:8000; demo student
`student.offer@`). Views: marketing home (`/`), student home (`/`), explore (`/explore`) and budget (`/budget`), each with
`?lang=<loc>` at **390** and **1440**, giving **32 views**. Full-page screenshots: `<loc>-<view>-<width>.png`. Metrics:
`report.json`. Pre-fix shots and metrics: `before/`.

## Results (after fixes)

| Check | Result |
|---|---|
| `<html dir>` = rtl | **32 / 32** |
| Horizontal overflow (`scrollWidth ≤ innerWidth + 1`) | **0 / 32** overflowing |
| Mirrored layout (brand in the right half, `h1` text-align `start`) | **32 / 32** |
| Text blocks with a physical `text-align: left` | **0** |
| Elements outside the viewport | Only deliberate off-screen items: Eduan slider thumbs, course carousel cards and the closed off-canvas menu (ur 390: 1 slider item). They are not overflow, and the page does not scroll sideways. |

Visible English words in `<main>` (390 / 1440). These are untranslated fallbacks; university names and city names are
included in the counts, since catalogue data is English:

| Locale | Marketing home | Student home | Explore | Budget | Why |
|---|---|---|---|---|---|
| ar | 59 / 64 | 23 / 23 | 87 / 87 | 31 / 31 | Mostly catalogue names. The first run showed explore 205 and budget 91 because the whole ar `student:v4.*` block was missing. The 57 keys visible on these screens were translated (`review-fixes.json`, ar stays MACHINE_DRAFT). |
| ur | 59 / 64 | 79 / 95 | 263 / 287 | 264 / 264 | ur has no student.json, so the student app is English. |
| fa | 59 / 64 | 79 / 95 | 263 / 286 | 264 / 264 | fa has no student.json. |
| he | 624 / 776 | 79 / 95 | 263 / 286 | 264 / 264 | he has only common.json, so marketing and student are English. |

## Issues found and fixed

| # | Issue | Fix |
|---|---|---|
| 1 | **English fallback text was reordered by the RTL bidi algorithm**: "Korea." → ".Korea", "Korea?" → "?Korea", "30 seconds · no account · nothing saved" → "seconds · no account · nothing saved 30" (the number moves to the end of the sentence). Seen on every untranslated namespace (he marketing; ur/fa/he student). | `apps/marketing-web/src/v6.css` and `apps/student-web/src/v7.css`: `[dir='rtl'] :where(p, h1–h6, li, dt, dd, label, figcaption, blockquote, td, th, small) { unicode-bidi: plaintext; }`. Each paragraph now takes its direction from its own first strong character. Alignment is `start`, so it stays logical. |
| 2 | With fix 1, translated RTL strings that begin with a Latin word or placeholder ("Hangyul أثناء العمل", "{{university}}: …") would turn LTR. | `scripts/i18n/rtl-mark.mjs` prefixes an invisible RLM (U+200F) to such strings in ar/fa/ur/he/ps (**524 strings**). The V8 merge and fix scripts re-run it automatically. Arabic screenshots re-checked: still right-to-left. |
| 3 | The machine-translation notice itself was English in ur and fa (and in 32 other locales). In RTL its full stop also jumped to the start of the line. | `common:i18n.machine/partial/useEnglish` translated for all 34 locales that lacked them. |
| 4 | ar explore and budget showed English sentences ("Change your goal in your profile to see it.", "with the scholarship you're eligible for", "first year"). | 57 ar `student:v4.*` keys translated (discover subtitle, cost, gap, unlock, budget, verdict text, compare, program, row, with all 6 Arabic plural forms). |

No layout CSS needed changing: the student and marketing apps already use logical properties, and Eduan's physical
rules are mirrored by postcss-rtlcss.

## Not done / residual

- Pages beyond the four views (program detail, applications, documents, visa) were not captured in this pass. The V6/V7 Arabic checks covered `/applications` and a program page.
- With fix 1, an English fallback paragraph is left-aligned inside a mirrored layout. That is correct for LTR text, but mixed pages look uneven until ur/fa/he get student translations.
- Numbers inside English templates with Persian digits (fa budget "۱۵٫۱ میلیون ₩ … with the scholarship you're eligible for") are readable but awkward until fa student exists.
- Full-page screenshots show fixed elements (sticky "Get started" bar, DEV chip) at mid-page. That is a capture artifact, not a layout bug.
