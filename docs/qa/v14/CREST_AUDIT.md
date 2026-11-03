# V14 University crest audit

Every mark in the homepage band, measured rather than eyeballed. Reproduce with:

```
python3 scripts/media/normalize_crests.py audit        # the table below
python3 scripts/media/build_marquee_manifest.py        # the manifest the page reads
npm run qa:crests                                      # both, as a gate
```

---

## The measurement that matters: ink fill

**Ink fill** is the share of a crest's own ink bounding box that is not transparent. It is the number that
separates a crest from a rectangle without anyone having to look:

- a seal, a shield or a wordmark covers **18–87 %** of its own box;
- artwork that still carries the background it was cut out of covers **~100 %**.

Two of the twenty-three measured 100 % in V13. One was a defect; the other is the mark itself.

### Yonsei University — fixed

`u-1-2.svg` was an SVG wrapper around an embedded WebP: a 202 × 240 raster of the Yonsei seal **on a white
rectangle**, which is why it was the one crest on the page that looked pasted on. Ink fill 100 %, opaque
corners.

The repair works from the owner's original drop (`template-koreanasha/assets/img/university/u-1-2.svg`, a
1907 × 2268 JPEG — the shipped file had been downsampled at some earlier optimisation pass, so the higher
resolution was already in the repository). `scripts/media/normalize_crests.py yonsei`:

1. floods in from the **border** over near-white pixels, so only the *surrounding* rectangle is removed. The
   white inside the mark — the shield, the lettering around the ring, the "1885" — is enclosed by navy and the
   flood never reaches it;
2. unpremultiplies the one-pixel antialiased frontier against white instead of cutting it square, which is
   what keeps the circle's edge smooth rather than stair-stepped;
3. autocrops to the mark and resamples to 300 px — the crest is drawn at most 100 CSS px tall, so this is
   sharp at 3×;
4. quantises to 64 indexed colours. The mark is one navy (#003777) and white, so almost all of a truecolour
   PNG's weight was the antialiased ramp: **65 KB → 10 KB**, with no visible difference.

Result: ink fill **79 %**, corner alpha **0**, 21,710 fully-opaque white pixels preserved inside the mark. The
blue circle, the white symbol, the Korean text, the English text and the internal negative space are all
untouched — which is what the brief asked for by name.

`scripts/qa/v14-marquee-details.mjs` measures this from the live DOM on every run, so the opaque asset cannot
come back.

### UNIST — not a defect, and deliberately not "fixed"

`u-1-9.svg` also measures 100 %, and it is left alone. UNIST's official signature is a white-and-cyan wordmark
**on a navy field**: the navy is the mark, not a background someone failed to remove. Knocking it out would
delete the wordmark (white on white); recolouring it to navy-on-transparent would alter a trademark we have no
permission to alter.

So it ships as the mark is, drawn as a deliberate rounded tile (`.kn-crest--tile`, 12 px radius) and held
slightly inside the common box by its optical scale, so it reads as one intentional dark crest among
twenty-two line-art seals rather than as a broken one. The exception is recorded by name in
`normalize_crests.py` (`TILE_EXCEPTIONS`) and in the integrity gate, so adding another one means writing down
which mark and why.

## Optical scale

Every crest is drawn in the same box and `--c-scale` sizes the artwork inside it. A wide wordmark carries far
more ink than a compact seal at the same CSS height and reads heavier — that is most of why the V13 band
looked like a set of unrelated images rather than one row.

`scale = clamp(0.88, (median_mass / mass) ** 0.42, 1.10)`. The exponent is well under 1 so the correction is
partial, and the clamp is tight: this is a nudge of at most ±10 %, not a resize, and **no official proportion
changes** — only the box the crest is drawn in. The values are computed from the rendered artwork, not chosen
by hand, and regenerating the manifest recomputes them.

## Other quality checks

| Check | Result |
|---|---|
| Unexpected rectangular background | **0** (1 documented tile exception) |
| JPEG artefacts in a shipped crest | 0 — the one embedded raster left is Ewha's, a PNG with its own alpha |
| Embedded raster inside an SVG wrapper | 1 (Ewha, `u-1-10.svg`); was 2 |
| Uneven transparent padding | 0 — every crest's ink box is ≥ 94 % of its canvas |
| Aspect ratios | 0.74 (Korea University) – 1.35 (Catholic) — intrinsic to the marks, handled by equal height + optical scale |
| Blur at 3× | none — all but one are vector; the one raster is 300 px for a 100 px box |
| Crests mapped to a university page | **23 / 23** |

---

## The marks

| Crest | University | Slug | Registry id | Ink fill | Aspect | Optical scale | Note |
|---|---|---|---|--:|--:|--:|---|
| `u-1-1.svg` | Seoul National University | `seoul-national-university` | 0000019 | 51.6% | 0.97 | 0.912 |  |
| `u-1-2.png` | Yonsei University | `yonsei-university` | 0000149 | 79.1% | 1.00 | 0.880 |  |
| `u-1-3.svg` | Korea University | `korea-university` | 0000069 | 87.2% | 0.74 | 0.880 |  |
| `u-1-4.svg` | KAIST | `kaist` | 0000374 | 18.0% | 1.00 | 1.100 |  |
| `u-1-5.svg` | Pohang University of Science and Technology | `pohang-university-of-science-and-technology` | 0000188 | 29.7% | 1.00 | 1.100 |  |
| `u-1-6.svg` | Sungkyunkwan University | `sungkyunkwan-university` | 0000133 | 31.5% | 0.99 | 1.100 |  |
| `u-1-7.svg` | Sogang University | `sogang-university` | 0000120 | 40.7% | 1.00 | 1.000 |  |
| `u-1-9.svg` | Ulsan National Institute of Science and Technology | `ulsan-national-institute-of-science-and-technology` | 0000250 | 100.0% | 1.00 | 0.880 | tile (allowed) — official white/cyan-on-navy signature |
| `u-2-1.svg` | University of Seoul | `university-of-seoul` | 0000040 | 78.9% | 1.00 | 0.880 |  |
| `u-2-2.svg` | Chung-Ang University | `chung-ang-university` | 0000175 | 19.0% | 1.06 | 1.100 |  |
| `u-2-3.svg` | Kyung Hee University | `kyung-hee-university` | 0000066 | 52.5% | 1.30 | 0.880 |  |
| `u-2-4.svg` | Hankuk University of Foreign Studies | `hankuk-university-of-foreign-studies` | 0000192 | 61.2% | 1.00 | 0.880 |  |
| `u-2-6.svg` | Dongguk University | `dongguk-university` | 0000100 | 25.0% | 1.00 | 1.100 |  |
| `u-2-7.svg` | Hongik University | `hongik-university` | 0000212 | 24.2% | 1.00 | 1.100 |  |
| `u-2-10.svg` | Pusan National University | `pusan-national-university` | 0000014 | 22.7% | 1.00 | 1.100 |  |
| `u-2-11.svg` | Kookmin University | `kookmin-university` | 0000078 | 26.1% | 1.00 | 1.100 |  |
| `u-3-1.svg` | Sejong University | `sejong-university` | 0000138 | 33.4% | 1.00 | 1.092 |  |
| `u-3-3.svg` | Ajou University | `ajou-university` | 0000146 | 45.3% | 1.00 | 0.915 |  |
| `u-3-4.svg` | Dankook University | `dankook-university` | 0000082 | 27.4% | 1.33 | 1.031 |  |
| `u-3-7.svg` | Catholic University of Korea | `catholic-university-of-korea` | 0000046 | 59.5% | 1.35 | 0.880 |  |
| `u-3-8.svg` | Gachon University | `gachon-university` | 0000063 | 60.7% | 1.00 | 0.880 |  |
| `u-3-9.svg` | Korea Aerospace University | `korea-aerospace-university` | 0000194 | 54.0% | 1.00 | 0.880 |  |
| `u-1-10.svg` | Ewha Womans University | `ewha-womans-university` | 0000163 | 63.4% | 1.01 | 1.100 |  |

---

## Trademark position — unchanged, and not shown to the customer

The visible line *"각 로고는 해당 대학의 상표입니다. 한귤과의 제휴 관계를 나타내지 않습니다."* is removed from the
page (brief Part 4), and it is **not** replaced with another disclaimer.

Removing the sentence changes nothing about the underlying position. University mark permission remains
**unresolved**, it remains a launch blocker in `npm run release:check`, and it remains recorded in REPORT and
in `docs/LEGAL_DEPENDENCIES.md`. No university is labelled Partner, 제휴 대학 or Hangyul Partner anywhere in the
product, because no verified agreement exists. What changed is who is asked to read our legal position: a
visitor looking at a wall of university crests is not.
