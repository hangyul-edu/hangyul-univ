# V27 localization brief — native-quality synthetic review (REPORT §359, brief §33–§40)

You translate and review Hangyul Univ's student-facing strings for the locales assigned to you. Hangyul Univ helps
international students apply to Korean universities; its users are prospective students (18–20), graduate applicants
(24–30) and parents/sponsors. Brand: "Hangyul Univ" (Latin script in every language except Korean, where it is 한귤).

## Input

`scripts/i18n/v27/strings.json` — `{ ns: { key: { en, ko, kind, ctx } } }`, 729 strings.
- `en` is the source. `ko` is the Korean original (use it to resolve ambiguity in the English).
- `kind`: `new` (never translated) or `changed` (the English was rewritten for clarity in V27; the existing translation in
  `packages/i18n/locales/<locale>/<ns>.json` was made from the OLD English and must be redone, not patched).
- `ctx`: where it appears.

## Output (per locale)

1. `scripts/i18n/v27/tx/<locale>.json` — `{ "<ns>": { "<dotted.key>": "<translation>" } }` covering **every** key in
   strings.json.
2. `docs/qa/v27/l10n/<locale>.md` — the review record (format below).

Then run `node scripts/i18n/v27/validate.mjs --only=<locale>` and fix every problem it reports until it prints 0 problems.
**Do not edit the locale bundles yourself and do not run `--apply`.**

## Rules

- Preserve every `{{placeholder}}` and `<tag>` exactly. Plural keys (`_one`) only exist in English; translate the base key
  in a form that works for any count (i18next falls back to it), or with the number placed so grammar holds.
- Official names stay official: university names as the university itself writes them in that language if it does, else the
  official English name (never a literal translation of 대학교 names). TOPIK, TOEFL iBT, IELTS Academic, TEPS, New TEPS,
  TOEIC, Duolingo English Test, PTE Academic, Cambridge English stay in Latin script. GKS = the established local name of the
  Global Korea Scholarship if one exists (e.g. vi "Học bổng Chính phủ Hàn Quốc (GKS)"), else "Global Korea Scholarship (GKS)".
- Korean administrative terms with no direct equivalent: use the term the target-language Korea-study community actually
  uses (apostille / consular legalization / certificate of enrollment / Korean language institute / D-2 / D-4 visa).
  Never produce literal nonsense. Keep 영사확인 = consular legalization (not "consular confirmation").
- Register: student copy warm and plain, the polite-but-friendly register normal for an education service in that country;
  CTA verbs as that country's websites write them. No machine-translation calques, no English word order.
- Brevity: UI labels (`fit.level.*`, `fit.sort.*`, `fit.tier.*.short`, chips, buttons) must be short. Sentences may be up to
  ~2× the English length.
- "추천순 / Recommended" is a browsing order, never a ranking. Never introduce words implying admission probability or
  guarantees.
- RTL locales (ar, fa, ur): no Latin punctuation that flips badly; keep test names in Latin inside the RTL sentence.

## Review method — three passes, then a comparison (record each in the `.md`)

Define 3 personas for the locale first (e.g. vi: "Linh, 18, Hà Nội, applying for a bachelor's", "Minh, 27, engineer,
master's applicant", "Linh's mother, paying"). Then:

- **Pass A — meaning**: each translation says exactly what the English (and Korean) says; nothing added or lost.
- **Pass B — native naturalness**: read as each persona; rewrite anything that sounds translated (vocabulary, word order,
  formality, finance/admissions/visa/document/scholarship terms).
- **Pass C — UI context & brevity**: labels short, buttons are verbs, consistent terms across keys (one word for "scholarship",
  one for "admission guide", one for "apostille" …).
- **Final**: source ↔ target semantic comparison of the whole set.

`docs/qa/v27/l10n/<locale>.md` contains: personas · a glossary table (≥ 15 key terms with the chosen rendering) · per pass
the number of strings changed and 5 representative before → after examples · the final comparison result · strings you are
unsure of. End with the line `Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)`.
Never write HUMAN_REVIEWED.
