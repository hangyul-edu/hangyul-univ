# Pre/post-prune CSS baselines (REPORT §69.12)

The compiled marketing and agency stylesheets as they were **before** the V10 dead-CSS removal and as they are
**after** it. They are kept here because this repository has no version control: without them the removal
cannot be re-checked, and the check matters more than the removal.

`before` files were recovered from the last pre-prune production build (`apps/*/dist-e2e/`), which is why they
are compiled output rather than source — that is also what the user actually receives, so it is the better
thing to test.

Re-run the check with:

```
node scripts/qa/v10-removed-css-probe.mjs \
  docs/qa/v10/css-baseline/marketing.before.css docs/qa/v10/css-baseline/marketing.after.css \
  docs/qa/v10/css-baseline/agency.before.css    docs/qa/v10/css-baseline/agency.after.css
```

It computes the selectors the prune removed and tests every one against the running development stack. The
expected result is `0 still match an element`. A non-zero result names the selector and the route, which is how
the one real mistake in this pass was found (a `:is()` list of four alternatives, three dead and one live).

Regenerate `after` after any further prune: `npm run build -w @hangyul/marketing-web` then copy
`apps/marketing-web/dist/assets/index-*.css` over `marketing.after.css`. Leave `before` alone.
