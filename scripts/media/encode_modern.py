#!/usr/bin/env python3
"""
Re-encode a served photograph to WebP and AVIF beside its JPEG (V14 continuation, Task 2).

`Photo` ships `/media/<slug>-<w>.jpg` at 640 / 1200 / 2400. A JPEG is the floor, not the target: the same
picture in AVIF is roughly half the bytes at the same quality, and WebP covers the browsers that predate it.
This writes both next to the JPEG and records `formats` on the slug in `credits.json`, which is what makes
`Photo` emit the `<source>` elements. A slug without `formats` keeps shipping plain JPEG, so adding a format
is opt-in per asset and nothing else in the product changes.

Quality is chosen per format rather than shared: AVIF at 50 is visually equivalent to WebP at 80 here, and
using one number for both either wastes bytes or softens the AVIF.

  python3 scripts/media/encode_modern.py snu-law-library seoul-songpa-sunset
  python3 scripts/media/encode_modern.py --check          # every slug that claims formats has the files
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / "apps/marketing-web/public/media"
CREDITS = ROOT / "apps/marketing-web/src/media/credits.json"
WIDTHS = (640, 1200, 2400)
#: (extension, PIL format, save kwargs). Ordered best-first — `Photo` emits the sources in this order.
TARGETS = (
    ("avif", "AVIF", {"quality": 50}),
    ("webp", "WEBP", {"quality": 80, "method": 6}),
)


def encode(slug: str) -> list[str]:
    made = []
    for w in WIDTHS:
        src = MEDIA / f"{slug}-{w}.jpg"
        if not src.exists():
            print(f"  ! {src.name} missing — skipped")
            continue
        im = Image.open(src).convert("RGB")
        for ext, fmt, kw in TARGETS:
            dest = MEDIA / f"{slug}-{w}.{ext}"
            im.save(dest, fmt, **kw)
            made.append(dest.name)
            print(f"  {dest.name:44s} {src.stat().st_size // 1024:4d} KB → {dest.stat().st_size // 1024:4d} KB")
    return made


def cmd(args) -> int:
    credits = json.loads(CREDITS.read_text())
    by_slug = {c["slug"]: c for c in credits}

    if args.check:
        missing = []
        for c in credits:
            for ext in c.get("formats", []):
                for w in WIDTHS:
                    if not (MEDIA / f"{c['slug']}-{w}.{ext}").exists():
                        missing.append(f"{c['slug']}-{w}.{ext}")
        if missing:
            print(f"! {len(missing)} declared file(s) not on disk: {', '.join(missing[:6])}")
            return 1
        n = sum(1 for c in credits if c.get("formats"))
        print(f"modern formats up to date ({n} slug(s) × {len(WIDTHS)} widths)")
        return 0

    for slug in args.slugs:
        if slug not in by_slug:
            print(f"! {slug} is not in credits.json")
            return 1
        print(slug)
        encode(slug)
        by_slug[slug]["formats"] = [ext for ext, _, _ in TARGETS]

    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n")
    print(f"\nrecorded `formats` on {len(args.slugs)} slug(s) in {CREDITS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("slugs", nargs="*")
    p.add_argument("--check", action="store_true")
    a = p.parse_args()
    if not a.slugs and not a.check:
        p.error("name at least one slug, or pass --check")
    sys.exit(cmd(a))
