#!/usr/bin/env python3
"""
University-crest asset audit and repair (brief Parts 6 and 7).

Two jobs, both reproducible from the owner's original drop in `template-koreanasha/assets/img/university`:

  audit    render every crest that ships in `apps/marketing-web/public/media/universities`, measure it, and
           report the ones that are not what a crest should be;
  yonsei   rebuild the Yonsei mark as a transparent asset from the owner's 1907×2268 original;
  chungang drop the stray export marker from the Chung-Ang mark.

The audit's useful measure is **bbox fill**: the share of a crest's own ink bounding box that is not
transparent. A seal, a shield or a wordmark covers 20–87 % of its box. A crest that covers ~100 % is not a
crest — it is a rectangle, i.e. artwork that still carries the background it was cut out of. That single number
separates the two defects from the twenty-one good assets without anyone having to eyeball them, and it is what
`scripts/qa/v14-crests.mjs` asserts on every run.

Yonsei's original is a JPEG of the mark on white. The repair floods in from the border over near-white pixels,
so only the **surrounding** rectangle is removed: the white inside the mark — the symbol in the shield, the
lettering around the ring, the "1885" — is enclosed by navy and is never reached by the flood. The one-pixel
antialiased frontier is then unpremultiplied against white instead of being cut off square, which is what keeps
the circle's edge smooth rather than stair-stepped.

The audit's second measure is **stray geometry**. A Figma export can carry a marker that was never part of the
mark — Chung-Ang's shipped as a hollow red square sitting over the "u" and the ring text. One rule separates
those from real artwork without anyone eyeballing 23 files: a path that is an axis-aligned box, *and* is the
only path in the file with its fill colour, *and* runs flush to the artboard edge. Across the 23 crests that
matches exactly two paths — UNIST's navy field, which is the mark and is excused by name below, and the
Chung-Ang marker, which is not. Every other boxy path shares its colour with dozens of siblings and sits
inside the artboard, which is what a letter or a device in a seal looks like.

  python3 scripts/media/normalize_crests.py audit
  python3 scripts/media/normalize_crests.py yonsei [--write]
  python3 scripts/media/normalize_crests.py chungang [--write]
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHIPPED = ROOT / "apps/marketing-web/public/media/universities"
ORIGINALS = ROOT / "template-koreanasha/assets/img/university"
MANIFEST = ROOT / "apps/marketing-web/src/media/universities.json"

#: A crest whose ink fills this much of its own bounding box is a rectangle, not a crest.
RECTANGLE_FILL = 0.97

#: The one allowed exception. UNIST's official signature is white and cyan on a navy field: the navy IS the
#: mark. Knocking it out would delete the wordmark and recolouring it would alter a trademark, so it ships as a
#: deliberate rounded tile instead and is excused from the rectangle rule. Kept here rather than in the strict
#: check so that adding an exception means writing down which mark and why.
TILE_EXCEPTIONS = {"u-1-9.svg": "UNIST — official white/cyan-on-navy signature; the field is the mark"}

#: Optical sizing: exponent well under 1 so the correction is partial, clamped so no artwork is resized enough
#: to change how the trademark reads. Shared with build_marquee_manifest.py so the audit and the manifest can
#: never disagree about what scale a crest should have.
SCALE_EXP = 0.42
SCALE_MIN, SCALE_MAX = 0.88, 1.10


def optical_scale(mass: float, median: float) -> float:
    if not mass:
        return 1.0
    return round(min(SCALE_MAX, max(SCALE_MIN, (median / mass) ** SCALE_EXP)), 3)
#: Alpha below this is treated as transparent when measuring.
INK = 8


def render(path: Path, height: int = 400) -> np.ndarray:
    """Render a crest (SVG or PNG) to an RGBA array of the given height."""
    if path.suffix == ".svg":
        png = cairosvg.svg2png(url=str(path), output_height=height)
        im = Image.open(io.BytesIO(png))
    else:
        im = Image.open(path)
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    return np.asarray(im.convert("RGBA"))


def measure(a: np.ndarray) -> dict:
    """Ink bounding box, how much of it is filled, and whether the corners are opaque."""
    al = a[..., 3]
    ys, xs = np.nonzero(al > INK)
    if not len(xs):
        return {"empty": True, "fill": 0.0, "aspect": 1.0, "mass": 0.0, "corners": 0}
    l, t, r, b = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    box = al[t : b + 1, l : r + 1]
    return {
        "empty": False,
        "fill": float((box > INK).mean()),
        "aspect": (r - l + 1) / (b - t + 1),
        # Alpha-weighted ink area, normalised by the render height squared: the crest's optical weight.
        "mass": float(box.sum() / 255.0) / (a.shape[0] ** 2),
        "corners": int(min(al[0, 0], al[0, -1], al[-1, 0], al[-1, -1])),
    }


#: Chung-Ang's export marker: the one path the stray-geometry rule finds that is not a mark.
CHUNGANG = "u-2-2.svg"

#: Points are clustered at this share of the artboard before a path is called a box, because the marker's own
#: corners disagree by hundredths of a unit — exactly the sloppiness that says a human drew it over the export.
BOX_TOL = 0.02


def _path_points(subpath: str) -> list[tuple[float, float]] | None:
    """Every point a straight-line subpath visits, or None if it curves (so it is lettering, not a box)."""
    if re.search(r"[CcSsQqTtAa]", subpath):
        return None
    x = y = 0.0
    out: list[tuple[float, float]] = []
    for cmd, nums in re.findall(r"([MLHVZmlhvz])([^A-Za-z]*)", subpath):
        n = [float(v) for v in re.findall(r"-?\d*\.?\d+", nums)]
        if cmd in "ML":
            if len(n) < 2:
                return None
            x, y = n[0], n[1]
        elif cmd == "H":
            x = n[0]
        elif cmd == "V":
            y = n[0]
        elif cmd in "Zz":
            continue
        else:
            return None
        out.append((x, y))
    return out


def _is_box(points: list[tuple[float, float]], tol: float) -> bool:
    """True when the points fall on two x values and two y values — i.e. they outline a rectangle."""
    for axis in (0, 1):
        vals = sorted(p[axis] for p in points)
        groups = 1
        for a, b in zip(vals, vals[1:]):
            if b - a > tol:
                groups += 1
        if groups != 2:
            return False
    return True


def stray_overlays(svg: Path) -> list[str]:
    """Path ids in `svg` that look like an export marker rather than part of the mark. See the module note."""
    return stray_overlays_text(svg.read_text())


def stray_overlays_text(s: str) -> list[str]:
    """`stray_overlays` on markup that has not been written to disk yet, so a repair can check its own output."""
    vb = re.search(r'viewBox="([\d.\s-]+)"', s)
    if not vb:
        return []
    x0, y0, w, h = (float(v) for v in vb.group(1).split())
    tol = max(w, h) * BOX_TOL
    found = []
    for m in re.finditer(r"<path([^>]*)\sd=\"([^\"]+)\"([^>]*)/>", s):
        attrs, d = m.group(1) + m.group(3), m.group(2)
        fill = re.search(r'fill="([^"]*)"', attrs)
        if not fill or len(re.findall(r'fill="%s"' % re.escape(fill.group(1)), s)) != 1:
            continue  # a colour the rest of the artwork also uses belongs to the artwork
        subs = [_path_points(sp) for sp in re.split(r"(?=[Mm])", d) if sp.strip()]
        if not subs or any(sp is None for sp in subs):
            continue
        pts = [p for sp in subs for p in sp]
        if not _is_box(pts, tol):
            continue
        l, t = min(p[0] for p in pts), min(p[1] for p in pts)
        r, b = max(p[0] for p in pts), max(p[1] for p in pts)
        if l <= x0 + tol or t <= y0 + tol or r >= x0 + w - tol or b >= y0 + h - tol:
            pid = re.search(r'id="([^"]*)"', attrs)
            found.append(f"{pid.group(1) if pid else '?'} {fill.group(1)}")
    return found


def crests() -> list[dict]:
    return json.loads(MANIFEST.read_text())


def cmd_audit(args) -> int:
    rows = []
    strays: list[tuple[str, list[str]]] = []
    for c in crests():
        path = SHIPPED / c["file"]
        a = render(path)
        m = measure(a)
        rows.append((c, m))
        if path.suffix == ".svg" and c["file"] not in TILE_EXCEPTIONS:
            found = stray_overlays(path)
            if found:
                strays.append((c["file"], found))

    masses = sorted(m["mass"] for _, m in rows if not m["empty"])
    median = masses[len(masses) // 2]

    print(f"{'file':12s} {'university':32s} {'fill':>6s} {'aspect':>7s} {'mass':>6s} {'scale':>6s}  note")
    bad = 0
    for c, m in rows:
        scale = optical_scale(m["mass"], median)
        note = ""
        if m["fill"] >= RECTANGLE_FILL:
            if c["file"] in TILE_EXCEPTIONS:
                note = f"tile (allowed): {TILE_EXCEPTIONS[c['file']]}"
            else:
                note = "RECTANGULAR BACKGROUND"
                bad += 1
        print(f"{c['file']:12s} {c['name_en'][:31]:32s} {m['fill'] * 100:5.1f}% {m['aspect']:7.2f} {m['mass']:6.3f} {scale:6.3f}  {note}")

    if args.emit_scales:
        out = {c["file"]: optical_scale(m["mass"], median) for c, m in rows}
        print("\nscales:", json.dumps(out))
    for f, found in strays:
        print(f"\n! {f}: stray geometry that is not part of the mark — {', '.join(found)}")
        if f == CHUNGANG:
            print("  repair: python3 scripts/media/normalize_crests.py chungang --write")

    print(f"\n{len(rows)} crests, {bad} with an unexpected rectangular background, "
          f"{len(strays)} with stray geometry, {len(TILE_EXCEPTIONS)} allowed tile(s)")
    return 1 if (bad or strays) and args.strict else 0


def extract_raster(svg: Path) -> Image.Image:
    """Pull the one embedded raster out of a Figma-exported SVG wrapper."""
    s = svg.read_text(errors="ignore")
    m = re.search(r'xlink:href="data:image/(\w+);base64,([^"]+)"', s)
    if not m:
        raise SystemExit(f"{svg}: no embedded raster")
    return Image.open(io.BytesIO(base64.b64decode(m.group(2))))


def strip_outer_white(im: Image.Image, *, flood_at: int = 250, frontier: int = 2) -> Image.Image:
    """
    Remove the rectangle of white *around* a mark, and nothing else.

    `flood_at` is the min-channel value at which a pixel counts as background; the flood starts from the border,
    so an enclosed white area — the inside of the Yonsei shield — is never part of the region even though it is
    the same colour. `frontier` pixels around that region are unpremultiplied against white rather than cut, so
    the antialiased edge survives as partial alpha.
    """
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    mn = rgb.min(axis=2)

    background = mn >= flood_at
    # Label the connected near-white regions and keep only those touching the border.
    labels, n = ndimage.label(background)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    border.discard(0)
    outer = np.isin(labels, list(border))

    grown = ndimage.binary_dilation(outer, np.ones((3, 3), bool), iterations=frontier)
    edge = grown & ~outer

    alpha = np.full(mn.shape, 255.0, np.float32)
    alpha[outer] = 0.0
    # On the frontier: a pixel is coverage `a` of ink over white, so a = (255 - min channel) / 255 for ink whose
    # darkest channel is 0 — which Yonsei's navy (#003777) is.
    alpha[edge] = np.clip(255.0 - mn[edge], 0, 255)

    a = alpha / 255.0
    out = rgb.copy()
    with np.errstate(invalid="ignore", divide="ignore"):
        un = (rgb - 255.0 * (1.0 - a[..., None])) / np.maximum(a[..., None], 1e-3)
    sel = edge & (a > 0.02)
    out[sel] = np.clip(un[sel], 0, 255)[...]

    rgba = np.dstack([out, alpha]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def autocrop(im: Image.Image, pad: int = 0) -> Image.Image:
    al = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(al > INK)
    l, t, r, b = xs.min(), ys.min(), xs.max(), ys.max()
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(im.width - 1, r + pad), min(im.height - 1, b + pad)
    return im.crop((int(l), int(t), int(r) + 1, int(b) + 1))


def cmd_yonsei(args) -> int:
    src = ORIGINALS / "u-1-2.svg"
    raw = extract_raster(src)
    print(f"source  {src.relative_to(ROOT)} → {raw.size[0]}×{raw.size[1]} {raw.mode}")

    cut = autocrop(strip_outer_white(raw))
    print(f"cropped {cut.size[0]}×{cut.size[1]}")

    # The crest is drawn at most 100 CSS px tall (v11.css `--kn-crest-h`), so 300 px covers a 3× display with
    # no upscaling of the 1,200-px original.
    target = 300
    out = cut.resize((round(cut.width * target / cut.height), target), Image.LANCZOS)

    m = measure(np.asarray(out))
    print(f"result  {out.size[0]}×{out.size[1]}  fill {m['fill'] * 100:.1f}%  corners alpha {m['corners']}")
    if m["fill"] >= RECTANGLE_FILL:
        print("! still rectangular — not written")
        return 1

    # The mark is one navy and white, so almost all of a truecolour PNG's weight is the antialiased ramp.
    # 64 indexed colours hold that ramp exactly and cost 10 KB instead of 65 KB.
    out = out.quantize(colors=64, method=Image.FASTOCTREE)

    dest = SHIPPED / "u-1-2.png"
    if args.write:
        out.save(dest, optimize=True)
        (SHIPPED / "u-1-2.svg").unlink(missing_ok=True)
        print(f"wrote   {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB), removed the SVG wrapper")
        print("  remember: set `file` to u-1-2.png and width/height to the new ratio in universities.json")
    else:
        prev = ROOT / "docs/qa/v14/yonsei-preview.png"
        prev.parent.mkdir(parents=True, exist_ok=True)
        out.save(prev)
        print(f"preview {prev.relative_to(ROOT)} (pass --write to ship it)")
    return 0


def cmd_chungang(args) -> int:
    """
    Remove the export marker from the Chung-Ang mark, reproducibly from the owner's original.

    Nothing is recoloured, rescaled or redrawn: one path is deleted and the other 28 — the grey ring reading
    "1916 · CHUNG-ANG · UNIVERSITY" and the blue brush "CAU" — are written through byte for byte, so the
    trademark that ships is the owner's artwork with an overlay taken off it rather than a redrawing of it.
    """
    src = ORIGINALS / CHUNGANG
    dest = SHIPPED / CHUNGANG
    s = src.read_text()

    strays = stray_overlays(src)
    if not strays:
        print(f"{src.relative_to(ROOT)}: nothing stray to remove")
        return 0
    print(f"source  {src.relative_to(ROOT)}")
    for f in strays:
        print(f"  stray  {f}")

    ids = [f.split()[0] for f in strays]
    out = s
    for pid in ids:
        pat = re.compile(r'<path id="%s"[^>]*/>' % re.escape(pid))
        if len(pat.findall(out)) != 1:
            print(f"! {pid} does not match exactly one path — not written")
            return 1
        out = pat.sub("", out)

    left = stray_overlays_text(out)
    if left:
        print(f"! still stray after the removal: {left} — not written")
        return 1

    m = measure(np.asarray(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=out.encode(), output_height=400)))
                           .convert("RGBA")))
    print(f"result  fill {m['fill'] * 100:.1f}%  aspect {m['aspect']:.2f}  "
          f"paths {out.count('<path')} (was {s.count('<path')})")

    if args.write:
        dest.write_text(out)
        print(f"wrote   {dest.relative_to(ROOT)}")
    else:
        print(f"preview only — pass --write to ship it to {dest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("audit"); a.add_argument("--strict", action="store_true"); a.add_argument("--emit-scales", action="store_true"); a.set_defaults(fn=cmd_audit)
    y = sub.add_parser("yonsei"); y.add_argument("--write", action="store_true"); y.set_defaults(fn=cmd_yonsei)
    g = sub.add_parser("chungang"); g.add_argument("--write", action="store_true"); g.set_defaults(fn=cmd_chungang)
    args = p.parse_args()
    sys.exit(args.fn(args))
