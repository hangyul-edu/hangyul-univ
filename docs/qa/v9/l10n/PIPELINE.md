# V9 student-localization pipeline (for translator agents)

One translator agent = one locale. Do every step in order; never skip the leak check or the review record.
Definition (REPORT §58.4): a locale is **complete for students** when (1) every key of the student-journey manifest is
translated, (2) the leak scan finds no unexplained English, (3) a synthetic review scored ≥ 4/5 on every dimension for
the four reader profiles. The student app's language picker offers a locale only when (1) and (2) are recorded in
`packages/i18n/locales/_student_status.json` (`isStudentAppLocale()` in `packages/i18n/src/index.ts`); the public
website keeps every locale. **Never** set a locale's `status` to `HUMAN_REVIEWED` — an AI review is not a human review.

## 0. Rules

- Do not edit `en/*` or `ko/*` (feature agents own them). Do not edit other locales than yours.
- Do not hand-edit locale JSON. Everything goes through `v9-merge.mjs` (validation, source hashes, RTL marks).
- Brand: **Hangyul** stays in Latin script in every locale except Korean (한귤). Keep TOPIK, IELTS, D-2, D-4, KRW, NHIS… as is.
- STATE_MAP terminology (docs/STATE_MAP.md) must match the existing strings of your locale: *Strong match*, *Possible match*,
  *Not eligible yet* (incl. "one step away"), *Needs your grades*. Look up the existing translation first
  (`student:discover.verdict.*`, `student:verdict.*`) and reuse it. No admission-odds wording ("chance", "safe", "guaranteed").
- Honesty: never add promises the English does not make ("don't worry", "it's only temporary").
- Heavy commands (leak check) run inside `flock /tmp/claude-0/hg-build.lock …`.

## 1. To-do

```bash
node scripts/i18n/v9-manifest.mjs            # refresh the manifest (fast; static + server + cached runtime keys)
node scripts/i18n/v9-todo.mjs <loc>          # → scripts/i18n/v9-todo/<loc>.json
node scripts/i18n/v9-todo.mjs <loc> --native # optional: the native student app (adds the `mobile` namespace)
```

The file lists `todo: { ns: { key: English } }` = keys missing, identical to English (beyond allowed tokens) or **stale**
(English changed after your last merge), plus `plural_categories` (CLDR, from `Intl.PluralRules`). Plural families appear
once per category your locale needs (`x_one`, `x_few`, `x_many`, `x_other` …) — translate each form.

## 2. Translate

Copy the `todo` object to `scripts/i18n/v9-data/<loc>[-n].json` and replace each English value. Write for an 18–20-year-old
applicant and their parents: short sentences, everyday words, the polite register parents expect. Keep `{{placeholders}}`
exactly (you may move them) and keep `<0>…</0>` / `<strong>` tags. A value that must stay identical to English (a city name,
"Email" in your language) goes into `"_identical_ok": ["ns:key", …]` instead of being re-typed.

## 3. Merge

```bash
node scripts/i18n/v9-merge.mjs <loc> scripts/i18n/v9-data/<loc>.json --check   # validate only
node scripts/i18n/v9-merge.mjs <loc> scripts/i18n/v9-data/<loc>.json
```

All-or-nothing. Errors to fix: key not in English, placeholder or tag mismatch, plural category not used by the locale,
incomplete plural family, empty string, brand (Latin "Hangyul" missing, Hangul brand outside ko). Creating a namespace file
regenerates `packages/i18n/src/resources.ts`; RTL locales (ar fa ur he ps) get RLM marks automatically. Re-running is a no-op.
Repeat 1–3 until `v9-todo` shows 0.

## 4. Leak check (390 and 1440)

```bash
flock /tmp/claude-0/hg-build.lock node scripts/qa/leak-check-v9.mjs <loc> --widths=390,1440
```

Signs in as 10 personas (+ signed-out pages), forces the locale and scans `<main>` and dialogs on ~80 routes × 2 widths.
Flags English i18n fragments (≥ 2 words), English-like server/catalogue text, and (non-Latin scripts) any Latin word that
is not an allowed token. Skipped: `[data-user-content]`, `[data-source-quote]`, `<details>` `[lang=en]`, catalogue names,
people/organisation names and human-written text from the DB. A full run records `leak_check` in `_student_status.json`
and writes `docs/qa/v9/l10n/leaks/<loc>.json`. For each leak: missing translation → fix via steps 1–3; English from server
data with no key → report it to the owning workstream (do **not** hide it with `data-source-quote` unless it really is a
quoted official/catalogue text shown behind an "exact wording" disclosure). Re-run until 0.

## 5. Synthetic review (four reader profiles)

Read the translated core journey (todo keys + the screens of step 4; screenshots with `--shots=dir`) as four readers:

| Profile | Reads for |
|---|---|
| A. Student, 18–20, first time abroad | Can I act on this alone? Is it natural, not stiff? |
| B. Graduate applicant, 23–29 | Precise terms (degree, TOPIK, visa types), no talking down |
| C. Parent, 35–49, pays the tuition | Money, deadlines, who to pay, what is guaranteed and what is not |
| D. Parent, 50–65, low digital confidence | Plain words, no English, no slang, trust |

Score each profile 1–5 on **comprehension, naturalness, trust, action clarity, tone** (20 scores). Any score < 4 → revise the
strings, merge, re-check, re-score. Record in `docs/qa/v9/l10n/<loc>.md`:

- the line **"synthetic review by an AI model — not a human review"**;
- date, model, sample (keys and screens read), the 4 × 5 score table before and after revisions;
- issues found and fixed (key, before → after, why), terminology table (STATE_MAP terms in your locale);
- residual risks (what a native human reviewer should check first).

Then: `node scripts/i18n/v9-coverage.mjs --record-review=<loc>:<min score>:<YYYY-MM-DD> <loc>`.

## 6. Gate

```bash
node scripts/i18n/v9-coverage.mjs            # per locale: web %, native %, missing, leak check, review, offered
```

`offered = yes` only with web manifest 100 % and a leak check with 0 leaks. Other agents keep adding keys: re-run 1–4
before you hand in. Log what you did in `docs/qa/v9/logs/l10n-<loc>.md`.

## Files

| File | What |
|---|---|
| `scripts/i18n/v9-manifest.mjs` → `packages/i18n/locales/_student_manifest.json` | keys reachable from student surfaces (`web`, `native`), counts, exclusions |
| `scripts/i18n/v9-data/runtime-keys.json` | keys recorded at runtime (`--runtime`; dev recorder `installKeyRecorder`, `localStorage hg.recordKeys = '1'`) |
| `scripts/i18n/v9-todo.mjs` → `scripts/i18n/v9-todo/<loc>.json` | translator to-do |
| `scripts/i18n/v9-merge.mjs` | validated merge; `v9-data/source-hash/<loc>.json`, `v9-data/identical-ok.json` |
| `scripts/qa/leak-check-v9.mjs` | leak scan for any locale |
| `scripts/i18n/v9-coverage.mjs` → `packages/i18n/locales/_student_status.json` | gate records read by the picker |
| `scripts/i18n/v9-lib.mjs` | shared helpers (allowed tokens, plural expansion, audit) |
