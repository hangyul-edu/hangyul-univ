# V31 locale review brief (REPORT §426)

You review and correct Hangyul Univ for the locale(s) assigned to you. Hangyul Univ helps international students apply
to Korean universities. Readers: prospective undergraduates (18–20), graduate applicants (24–30), parents/sponsors, and
people comparing Korea with other study destinations. Brand: "Hangyul" / "Hangyul Univ" in Latin script in every
language. The student-facing team is "the Hangyul team".

Work in /root/hangyul-univ. Do not run builds, browsers, dev servers or Gradle. Do not edit `packages/i18n/locales/**`
and never run the validator with `--apply`.

## Read first

- `docs/qa/v31/l10n/GLOSSARY.md` — canonical concepts and the distinctions that must survive translation.
- `docs/SERVICE_CATALOG_V29.md` — what each plan and add-on actually includes.

## Input — `scripts/i18n/v28/jobs-v31/<locale>.json`

`{ ns: { key: { en, ko, current, v31? } } }`. `en` and `ko` are the corrected V31 sources (meaning = ko + contract;
en = the clearest statement of it). `current` is the existing translation or null. `v31` marks a key whose source
changed (or is new) in V31: it MUST be re-translated from the new source. ~1,730 keys: marketing site, student app,
shared vocabulary (plans, add-ons, purchase notes, documents, visa).

## Three passes per key, then a back-check

1. **Semantic accuracy** — does `current` say exactly what the source says? Watch the glossary distinctions:
   recommended ≠ managed application; support window ≠ consultation session; document review ≠ preparing documents;
   editing ≠ writing for the student; visa help ≠ visa decision (the immigration authorities decide); dormitory help ≠
   guaranteed room; airport pickup is arranged with a partner (Hangyul does not run transport); a price range is not a
   charge; Premium's "no limit" always keeps its scope (contracted documents and schedule). No guarantees.
2. **Native naturalness** — would a fluent native speaker write it this way? Remove literal translation artifacts,
   source word order, noun stacks, em-dash connectors, "seamless/comprehensive/optimal/perfect", slash-joined phrases.
3. **Product/marketing quality** — fits its UI role (button = short verb; label = noun; heading = sentence case of
   your language); marketing headlines and CTAs are TRANSCREATED (meaning and truthfulness kept, locally persuasive,
   no exaggeration); student copy simple and reassuring; legal/notes neutral and exact; errors specific.
4. **Back-check** — read your text alone and ask: would someone reading only this understand the same thing as the
   Korean? If not, fix it.

If `current` passes all of this, keep it verbatim (no churn). Otherwise rewrite.

## Fixed rules

- Preserve every `{{placeholder}}` and `<tag>` exactly. Plurals: `x_one`/`x_other` given; add the CLDR forms your
  language needs (`x_few`, `x_many`, `x_two`, `x_zero`) where `x_other` exists.
- Official names never translated creatively: universities (the name the university itself uses in your language if
  it has one, else the official English), scholarships (Global Korea Scholarship = the established local name, else
  "Global Korea Scholarship (GKS)"), visa types D-2 / D-4, TOPIK / TOEFL iBT / IELTS. Use official local terms for
  apostille, consular legalization (영사확인 — never "consular confirmation"), notarization, transcript, certificates.
- Plan names Basic / All-in-One / Premium stay in Latin unless your market copy already localizes them consistently.
- European Portuguese for `pt` (no Brazilian forms). Script must match the locale (Cyrillic for kk/ky/ru/uk/sr…).
- Korean particles never appear. No English left in a sentence unless it is a name/brand/test name.

## Output (per locale)

1. `scripts/i18n/v28/tx-v31/<locale>.json` — `{ "<ns>": { "<dotted.key>": "<text>" } }` for EVERY job key.
2. `docs/qa/v31/l10n/glossary/<locale>.json` — `{ "<glossary id>": "<your term>" }` for every row of GLOSSARY.md, and
   use those terms consistently across all keys.
3. `docs/qa/v31/l10n/records/<locale>.md` — the review record:
   - counts: keys reviewed, kept, rewritten (by reason: meaning / naturalness / quality / terminology / new source);
   - **critical semantic issues found** in `current` (key, what it said, what it now says) — list every one;
   - **marketing scorecard** for: hero, why section, services rows, pricing (plan cards + comparison), add-ons and
     purchase notes, FAQ, closing CTA, directory/discovery copy — each scored CLARITY / NATURALNESS / SPECIFICITY /
     TRUST / PERSUASION / BREVITY out of 5 (total /30) AFTER your rewrite; anything below 26/30 must be rewritten until it
     is not. This is an internal review tool, not a measurement;
   - **product scorecard** (student app): ACTION CLARITY / SEMANTIC ACCURACY / NATURALNESS / CONSISTENCY / BREVITY per
     area (home, applications, documents, services, visa/housing), weak ones fixed;
   - unresolved ambiguity (keys where the source itself is unclear — listed, not guessed);
   - status line: `SYNTHETIC_NATIVE_REVIEWED_V31` — **never `HUMAN_REVIEWED`**.
4. Run `JOBS=jobs-v31 TX=tx-v31 node scripts/i18n/v28/validate.mjs --only=<locale>` and fix every problem until it
   reports 0. Save tx progress to disk as you go (rewrite the whole file after each namespace) — the host can reboot.
