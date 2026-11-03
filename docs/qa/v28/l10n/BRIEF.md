# V28 localization brief — fill, correct, review (REPORT §374)

You translate and review Hangyul Univ strings for the locales assigned to you. Hangyul Univ helps international students
apply to Korean universities and helps agencies and universities run those applications. Readers: prospective students
(18–20), graduate applicants (24–30), parents/sponsors, agency counselors, university admissions staff. Brand: "Hangyul Univ"
(Latin script in every language; 한귤 only in Korean). The student-facing team is "the Hangyul team" — never "your counselor".

## Input — `scripts/i18n/v28/jobs/<locale>.json`

`{ ns: { key: { en, ko, current } } }`. `en` is the source (rewritten in V28 where meaning changed), `ko` the Korean original
(use it to resolve ambiguity), `current` the existing translation or null. Every key needs a translation: if `current` is
correct, natural and matches the **current** English meaning, you may keep it verbatim; otherwise rewrite it. Keys are a
mix of customer-critical (marketing, student app) and operational (agency, university consoles) strings.

## Output (per locale)

1. `scripts/i18n/v28/tx/<locale>.json` — `{ "<ns>": { "<dotted.key>": "<translation>" } }` for **every** job key.
2. `docs/qa/v28/l10n/records/<locale>.md` — the review record.

Then run `node scripts/i18n/v28/validate.mjs --only=<locale>` and fix every problem until it reports 0 problems.
**Do not edit `packages/i18n/locales/**` and do not run `--apply`.** Write files with a script (python/node) if easier, but
never print or touch anything outside these paths; do not run builds, browsers or Gradle.

## Rules

- Preserve every `{{placeholder}}` and `<tag>` exactly.
- Plurals: the job has i18next keys `x_one` / `x_other`. Translate both. For locales with more CLDR categories (pl, ru, uk,
  cs, sr, ar, …) ALSO add the extra forms the language needs (`x_few`, `x_many`, `x_two`, `x_zero`) — they are accepted when
  `x_other` exists. Polish must have `_one`, `_few`, `_many`, `_other` for each plural key in the job.
- Official names are never translated: universities as the university writes itself in that language if it does, else the
  official English name. TOPIK, TOEFL iBT, IELTS Academic, TEPS, TOEIC, Duolingo English Test, PTE Academic stay Latin.
  GKS = the established local name of the Global Korea Scholarship where one exists, else "Global Korea Scholarship (GKS)".
- Terms: 영사확인 = consular **legalization** (never "consular confirmation"); 아포스티유 = apostille; 재학증명서 = certificate
  of enrollment; 어학당 = Korean language institute; visas D-2 / D-4. The far quick-fit tier means "needs more preparation" —
  never "ambitious"/"reach"/a probability word. "Recommended" is a browsing order, never a ranking or chance.
- Portuguese (`pt`): European Portuguese throughout (tu/você avoided via impersonal or "o seu"; registo, telemóvel, ecrã,
  autocarro, candidatura). No Brazilian forms.
- Register: students — warm, plain, the polite-friendly register normal for an education service in that country;
  consoles — concise professional. CTA verbs as that country's websites write them. No calques, no English word order,
  no em dash chains. Labels/chips/buttons short; sentences ≤ ~2× English length.
- RTL (ar, fa, ur): keep test names and numbers in Latin inside the sentence; no Latin punctuation that flips badly.

## Review method (record in the `.md`)

Three personas for the locale (incl. a first-time visitor and a comparison shopper). Pass A meaning · Pass B native
naturalness · Pass C UI context, brevity, one term per concept · Final source↔target comparison. For **marketing** keys
(`marketing:` namespace) also score each section you touched on a 30-point card (clarity, trust, naturalness, brevity,
CTA strength, cultural fit; 5 each) and rewrite (transcreate, not translate) until ≥ 25.

The record contains: personas · a glossary table (≥ 20 terms) · per pass the number of strings changed + 5 before → after
examples · the marketing scorecard · strings you are unsure of · counts (job keys, kept verbatim, rewritten, newly
translated). End with `Status: SYNTHETIC_NATIVE_REVIEWED (model review — not reviewed by a human native speaker)`.
Never write HUMAN_REVIEWED.

## Second pass (jobs2) — leak families the crawl missed

The visual gate found English on non-English pages from keys the V28 crawl never recorded (conditional states: waiting
lines, blockers, ledes). `scripts/i18n/v28/jobs2/<locale>.json` lists every missing/English key in those key families
(customer families for every locale; console families too for Tier 1/2). Same rules, same review method. Output to
`scripts/i18n/v28/tx2/<locale>.json`; append a "Second pass" section (counts + 5 examples + unsure) to the existing
`docs/qa/v28/l10n/records/<locale>.md` (move the Status line to the end). Validate with
`JOBS=jobs2 TX=tx2 node scripts/i18n/v28/validate.mjs --only=<locale>` until 0 problems. Never `--apply`.
Keep terms identical to the first-pass glossary in the record. Use a per-agent scratch folder you create, never a shared one.
