# V10 evidence (REPORT §65–72)

| Directory | What it is |
|---|---|
| `before/` | The 170-view capture taken **before any V10 change** (17 routes × 5 widths, right persona per surface). |
| `after/` | The same capture when V10 was finished. The pair behind the height figures in §70.2. |
| `after2/`, `after3/` | Two further full captures taken after the dead-CSS removal. They exist as a **control**: they were produced by identical code, so the differences between them measure the capture's own noise, not the product's. See §69.12. |
| `dcheckA/`–`dcheckD/` | Two pairs of console-only captures (agency + university), used to find out what that noise is. 33 and 43 of 170 images differ within a pair, while the pair's `metrics.json` files are byte-identical: the numbers are deterministic, the full-page rasterisation is not. Two harness waits were tried against it and removed again (§70, §69.12). |
| `comparisons/` | Before/after pairs side by side, built by `scripts/qa/v10-comparisons.py`. |
| `css-baseline/` | Compiled stylesheets either side of the dead-CSS removal, so the removal stays checkable. Has its own README with the command. |
| `koreanasha-original/`, `koreanasha-live/` | The Koreanasha template as it ships locally and as served at univ.talkhangyul.com, verified byte-identical. |
| `benchmark/` | V-Education screens, used only as a competitive benchmark — nothing was copied from them. |
| `COMPETITIVE_UI_AUDIT.md` | The written benchmark. |

A full-page PNG is exactly as tall as the page was, so `scripts/qa/v10-metrics-from-shots.py <phase>` recovers
per-view heights from any of these directories without re-running the capture.
