#!/usr/bin/env python3
"""Build every runtime Hangyul Univ brand asset from the owner's masters.

Masters (never edited): packages/icons/assets/brand/hangyul-univ/master/
Derivatives (generated): packages/icons/assets/brand/hangyul-univ/
Published copies:        apps/*-web/public (favicons, manifest), apps/marketing-web/public/og,
                         apps/*-mobile/assets (icon, adaptive foreground, splash),
                         packages/mobile-ui/assets/brand (in-app logo)

The only operations are: crop transparent outer padding, resize (premultiplied-alpha Lanczos), and
composite onto a flat background where a format needs an opaque canvas. The artwork is never
recoloured or redrawn. Run: `npm run brand:build` (idempotent). `--check` verifies outputs are current.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "packages/icons/assets/brand/hangyul-univ"
MASTER = BRAND / "master"
COLORS = ("black", "ivory", "orange")

IVORY = (245, 245, 230)       # the brand ivory used by the logo art and the OG card
SPLASH_BG = (255, 253, 248)   # #FFFDF8 — app canvas, matches app.json splash backgroundColor

# Horizontal lockup: the symbol occupies the first run of opaque columns; the wordmark starts after a
# clear transparent gutter (measured on the masters: symbol ends x≈1640, "u" starts x=1897).
SYMBOL_SPLIT_X = 1768

CHECK = "--check" in sys.argv
outputs: dict[Path, bytes] = {}


def master(name: str) -> Image.Image:
    return Image.open(MASTER / name).convert("RGBA")


def trim(im: Image.Image) -> Image.Image:
    return im.crop(im.getchannel("A").getbbox())


def resize(im: Image.Image, *, height: int | None = None, width: int | None = None) -> Image.Image:
    """Premultiplied-alpha Lanczos so transparent pixels never bleed colour into the edges."""
    if height is not None:
        size = (round(im.width * height / im.height), height)
    else:
        assert width is not None
        size = (width, round(im.height * width / im.width))
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def on_canvas(im: Image.Image, size: tuple[int, int], bg: tuple[int, int, int] | None, *, fit: float, dy: float = 0.0) -> Image.Image:
    """Centre `im` on a canvas, scaled so it fits inside `fit` × the canvas' shorter side."""
    box = fit * min(size)
    scale = min(box / im.width, box / im.height)
    art = im.convert("RGBa").resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS).convert("RGBA")
    canvas = Image.new("RGBA", size, (*bg, 255) if bg else (0, 0, 0, 0))
    canvas.alpha_composite(art, ((size[0] - art.width) // 2, round((size[1] - art.height) / 2 + dy * size[1])))
    return canvas.convert("RGB") if bg else canvas


def emit(path: Path, im: Image.Image, fmt: str = "PNG", **kw) -> None:
    buf = io.BytesIO()
    if fmt == "PNG":
        im.save(buf, "PNG", optimize=True)
    else:
        im.save(buf, fmt, **kw)
    outputs[path] = buf.getvalue()


def emit_bytes(path: Path, data: bytes) -> None:
    outputs[path] = data


# ------------------------------------------------------------------ logos
dims: dict[str, dict[str, int]] = {}
symbols: dict[str, Image.Image] = {}
verticals: dict[str, Image.Image] = {}
for c in COLORS:
    h = trim(master(f"hangyul-univ-logo-horizontal-{c}.png"))
    v = trim(master(f"hangyul-univ-logo-vertical-{c}.png"))
    full = master(f"hangyul-univ-logo-horizontal-{c}.png")
    s = trim(full.crop((0, 0, SYMBOL_SPLIT_X, full.height)))
    symbols[c], verticals[c] = s, v
    for name, art, base in (("logo-horizontal", h, 48), ("logo-vertical", v, 160), ("symbol", s, 48)):
        one, two = resize(art, height=base), resize(art, height=base * 2)
        emit(BRAND / f"hangyul-univ-{name}-{c}.png", one)
        emit(BRAND / f"hangyul-univ-{name}-{c}@2x.png", two)
        dims[name] = {"width": one.width, "height": one.height}

# ------------------------------------------------------------------ social
og = Image.open(MASTER / "hangyul-univ-og-3600x1890.jpg").convert("RGB")
assert abs(og.width / og.height - 1200 / 630) < 0.002, "OG master is not 1.905:1"
emit(BRAND / "hangyul-univ-og-v1.jpg", og.resize((1200, 630), Image.LANCZOS), "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
banner = Image.open(MASTER / "hangyul-univ-banner-3072x1500.jpg").convert("RGB")
assert abs(banner.width / banner.height - 1024 / 500) < 0.002, "banner master is not 1024:500"
emit(BRAND / "hangyul-univ-banner-1024x500.jpg", banner.resize((1024, 500), Image.LANCZOS), "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)

# ------------------------------------------------------------------ favicon / app mark (symbol only)
sym = symbols["orange"]
fav = {n: on_canvas(sym, (n, n), None, fit=0.94) for n in (16, 32, 48)}
emit(BRAND / "favicon-32.png", fav[32])
emit(BRAND / "favicon-48.png", fav[48])
ico = io.BytesIO()
fav[48].save(ico, "ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[fav[16], fav[32]])
emit_bytes(BRAND / "favicon.ico", ico.getvalue())
emit(BRAND / "apple-touch-icon.png", on_canvas(sym, (180, 180), IVORY, fit=0.62))
emit(BRAND / "icon-192.png", on_canvas(sym, (192, 192), IVORY, fit=0.60))   # inside the maskable safe zone
emit(BRAND / "icon-512.png", on_canvas(sym, (512, 512), IVORY, fit=0.60))

# ------------------------------------------------------------------ native
emit(BRAND / "native/app-icon-1024.png", on_canvas(sym, (1024, 1024), IVORY, fit=0.60))
emit(BRAND / "native/adaptive-foreground-1024.png", on_canvas(sym, (1024, 1024), None, fit=0.46))  # 66 % safe circle
emit(BRAND / "native/splash.png", on_canvas(verticals["orange"], (1284, 2778), SPLASH_BG, fit=0.36))

# ------------------------------------------------------------------ manifest of sizes (read by @hangyul/icons)
emit_bytes(BRAND / "dimensions.json", (json.dumps(dims, indent=2) + "\n").encode())

# ------------------------------------------------------------------ published copies
WEB = {"marketing-web": ("Hangyul Univ", "#FFFDF8"), "student-web": ("Hangyul Univ", "#FFFDF8"),
       "agency-web": ("Hangyul Univ Admin", "#F5F7FB"), "university-web": ("Hangyul Univ Partner", "#F5F7FB")}
for app, (name, theme) in WEB.items():
    pub = ROOT / "apps" / app / "public"
    for f in ("favicon.ico", "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"):
        emit_bytes(pub / f, outputs[BRAND / f])
    manifest = {
        "name": name, "short_name": "Hangyul Univ", "start_url": "/", "display": "browser",
        "background_color": "#FFFFFF", "theme_color": theme,
        "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                  {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}],
    }
    emit_bytes(pub / "site.webmanifest", (json.dumps(manifest, indent=2) + "\n").encode())
mk = ROOT / "apps/marketing-web/public"
emit_bytes(mk / "og/hangyul-univ-og-v1.jpg", outputs[BRAND / "hangyul-univ-og-v1.jpg"])
# A stable public logo URL (structured data, e-mail, partners) — never hashed by the bundler.
emit_bytes(mk / "brand/hangyul-univ-logo-horizontal-black.png", outputs[BRAND / "hangyul-univ-logo-horizontal-black@2x.png"])
for app in ("student-mobile", "agency-mobile", "university-mobile"):
    for f in ("app-icon-1024.png", "adaptive-foreground-1024.png", "splash.png"):
        emit_bytes(ROOT / "apps" / app / "assets" / f, outputs[BRAND / "native" / f])
emit_bytes(ROOT / "packages/mobile-ui/assets/brand/hangyul-univ-logo-vertical-orange.png", outputs[BRAND / "hangyul-univ-logo-vertical-orange@2x.png"])

# ------------------------------------------------------------------ write / check
stale = []
for path, data in sorted(outputs.items()):
    current = path.read_bytes() if path.exists() else None
    if current == data:
        continue
    if CHECK:
        stale.append(str(path.relative_to(ROOT)))
        continue
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"wrote {path.relative_to(ROOT)} ({len(data):,} B, sha {hashlib.sha256(data).hexdigest()[:8]})")
if CHECK and stale:
    print("stale brand derivatives (run `npm run brand:build`):\n  " + "\n  ".join(stale))
    sys.exit(1)
print(f"brand assets: {len(outputs)} outputs {'verified' if CHECK else 'up to date'}")
