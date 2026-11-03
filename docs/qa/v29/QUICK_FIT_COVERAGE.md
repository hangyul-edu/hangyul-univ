# V29 Quick Fit — verified admission-rule coverage (brief §31)

Profile: bachelor's, GPA 3.3/4.0 (82.5 %). Measured with `app.services.fit.run` on the dev database, 2026-10-30.

| | Before (V28) | After (V29) |
|---|---|---|
| Institutions with verified official language rules | 24 | **43** (+19) |
| "Needs checking with us" (CHALLENGE), any language input | 195 / 218 | **176 / 218** |
| Meets the confirmed basic conditions — TOPIK 4 | — | 41 |
| Meets — TOPIK 3 | — | 39 |

How: two research batches (30 institutions: the only marquee university not yet researched, then the top of the Quick Fit
recommended order) under `docs/qa/v27/research/BRIEF.md` — official sources only, exact-quote evidence, nulls + gaps
otherwise. 24 files produced rules; 5 were robots-blocked and record only gaps; **5 were quarantined** rather than loaded
(`server/app/data/research/v27/quarantine/README.md`: Sejong robots disallow, Inha robots unverifiable, Chungnam 2025 guide,
Duksung 2024 page, Konyang undated page). Nothing was inferred to shrink the bucket; the remaining 176 need official data
that is either not published in a reachable allowed form or not yet researched — EXTERNAL_DATA for the blocked ones.
