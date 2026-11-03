# V29 localization brief — the new service contract (addendum to docs/qa/v28/l10n/BRIEF.md)

Follow docs/qa/v28/l10n/BRIEF.md (format, placeholders, plural forms, script, tone, forbidden terms, the
three-pass persona review and the per-locale record). This addendum covers what is specific to V29.

- **Job**: `scripts/i18n/v28/jobs-v29/<loc>.json` → write `scripts/i18n/v28/tx-v29/<loc>.json`
  (`{ ns: { key: "translation" } }`). Validate: `JOBS=jobs-v29 TX=tx-v29 node scripts/i18n/v28/validate.mjs --only=<loc>`;
  merge with `--apply` only after it reports 0 problems. Record: `docs/qa/v29/l10n/records/<loc>.md`.
- Korean is the canonical meaning; English is the second reference. These strings sell a paid service and describe a
  contract — **accuracy first, then natural marketing quality, then brevity** (card lines must stay short: ≈ the English
  length). Transcreate; do not translate word by word.
- **"Unlimited" is never unlimited.** Premium editing is "no round limit *within the contracted application documents
  and schedule*". Never render it as unlimited editing of anything, unlimited documents, unlimited translation, or
  unlimited time.
- **"Up to N managed applications" is not a guarantee** of applying to / being admitted by N universities. Use
  "manage/support up to N applications", never "apply to any N" or "guaranteed".
- **Visa support** is help preparing and applying; the decision belongs to the authority. Never imply Hangyul issues
  or guarantees a visa. **Airport pickup** is *arranged* through a partner provider — Hangyul does not drive.
- "Recommended universities" (research and suggest) and "managed applications" (Hangyul handles the application) are
  different things — keep them distinguishable in every language.
- Prices: never translate, convert or localise a currency amount; placeholders like `{{amount}}`, `{{min}}`, `{{max}}`
  are filled by the app.
- Status: `SYNTHETIC_NATIVE_REVIEWED` (never HUMAN_REVIEWED).
