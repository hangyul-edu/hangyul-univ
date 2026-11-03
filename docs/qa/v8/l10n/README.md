# V8 localization review records

One file per reviewed locale. Every review here is a **synthetic review by an AI model — not a human review.**
A locale may be `SYNTHETIC_REVIEWED` only if it has a record here. `HUMAN_REVIEWED` needs a named human reviewer and
evidence; no locale has that.

## Shared method

- Sample: the student core flow (`node scripts/i18n/v8-data/_review-sample.mjs <loc>` prints it next to English):
  common (actions, states, nav, degree, tier, eligibility, matchReason, docStatus, time, i18n banner, no-guarantee footer),
  student discover / budget / compare / nav / V8 keys, marketing hero / quick check / `v8`. Every string in the sample is read.
- Persona: a student from the locale's main recruitment country, at the point of choosing programs (plus a Korean
  admissions officer for ko).
- Rubric: (1) accuracy, (2) naturalness, (3) terminology consistency — eligibility words per `docs/STATE_MAP.md`
  "Eligibility vocabulary", (4) tone, (5) truncation risk, (6) honesty — no stronger claim than English.
- Fixes: `scripts/i18n/v8-data/review-fixes.json` (applied by `scripts/i18n/v8-review-fixes.mjs`) or, for V8 keys, the
  data under `scripts/i18n/v8-data/` (applied by `scripts/i18n/v8-translate.mjs`). ko fixes went into the ko JSON and the ko
  generator scripts directly.

| Locale | Record | Strings read |
|---|---|---|
| ko | [ko.md](ko.md) | 416 / 416 (+ brand sweep of all 11 namespaces) |
| vi | [vi.md](vi.md) | 414 / 416 |
| zh-Hans | [zh-Hans.md](zh-Hans.md) | 416 / 416 |
| uz | [uz.md](uz.md) | 416 / 416 |
| mn | [mn.md](mn.md) | 416 / 416 |
| ne | [ne.md](ne.md) | 416 / 416 |
| my | [my.md](my.md) | 414 / 416 |
| ja | [ja.md](ja.md) | 416 / 416 (309 before fixes) |
| th | [th.md](th.md) | 218 / 218 — common + marketing only; **no student.json** |

Counts are strings in the sample that exist in the locale after the fixes. The few not counted are `_one` plural keys that
the language never uses.
