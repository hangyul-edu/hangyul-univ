# V10 marketing translations

Source files for the 69 `marketing:v10.*` keys the V10 rebuild added (REPORT §69.11). One file per locale, in
the shape `v9-merge.mjs` accepts:

```json
{ "marketing": { "v10": { "hero": { "title": "…" } } } }
```

Apply with the normal pipeline, which validates placeholders, `<em>` tags, plural families and the brand name,
and runs `rtl-mark` for RTL locales:

```bash
node scripts/i18n/v9-merge.mjs vi scripts/i18n/v10-data/vi.json --check   # dry run
node scripts/i18n/v9-merge.mjs vi scripts/i18n/v10-data/vi.json
```

Then verify how it actually renders — this is the check that matters, not the coverage percentage:

```bash
node scripts/qa/v10-locale-check.mjs            # all locales, home at 1440 + 390
```

It reports raw i18n keys, page overflow (long-language expansion), and wrong `lang` / `dir`.

**Why these files are not produced by `v9-todo.mjs`:** that tool reports against the *student-journey manifest*,
which the `marketing` namespace is not part of — it showed `vi` at 100 % while all 69 of these keys were
missing. Marketing-only work feeds `v9-merge.mjs` directly.

**Covered here:** every locale that passes the V9 student gate except `ko`, which is maintained alongside `en`
by the feature workstream. **Not covered:** the 24 marketing-only locales with no student journey; they keep
the English fallback and the in-app notice.

**No locale is HUMAN_REVIEWED.** These are translations, not reviewed translations; see REPORT §72.
