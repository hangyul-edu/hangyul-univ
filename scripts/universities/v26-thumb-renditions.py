"""V26 — a 240-px rendition for every university hero (REPORT §348, brief §50).

The student app's `UniMark` (a 36–72 px campus tile beside a university name) requested the smallest rendition on file,
640 px — ~50 KB per tile, 337 KB on Explore's first paint. This writes `<stem>-240.{jpg,webp}` beside the existing
renditions for every asset that is a hero, from the 640 source, into both media trees, and records `240` in that asset's
`renditions` so `srcset` and the rendition gate (every recorded rendition exists in both apps) agree.

Usage:  python3 scripts/universities/v26-thumb-renditions.py [--apply]     (without --apply: counts only)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "server/app/data/university_content.json"
TREES = [ROOT / "apps/marketing-web/public", ROOT / "apps/student-web/public"]
W = 240
APPLY = "--apply" in sys.argv

data = json.loads(CONTENT.read_text())
made = skipped = assets = 0
for slug, rec in data["records"].items():
    hero = (rec.get("media") or {}).get("hero")
    if not hero or not hero.get("local_path"):
        continue
    assets += 1
    stem = hero["local_path"]  # e.g. media/<slug>--<name>
    rend = list(hero.get("renditions") or [640, 1200, 2400])
    fmts = list(hero.get("formats") or ["jpg"])
    for tree in TREES:
        src = tree / f"{stem}-640.jpg"
        if not src.exists():
            skipped += 1
            continue
        for ext in fmts:
            dst = tree / f"{stem}-{W}.{ext}"
            if dst.exists():
                continue
            if APPLY:
                im = Image.open(src).convert("RGB")
                ratio = W / im.width
                im = im.resize((W, max(1, round(im.height * ratio))), Image.LANCZOS)
                if ext == "webp":
                    im.save(dst, "WEBP", quality=82, method=6)
                else:
                    im.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
            made += 1
    if APPLY and W not in rend:
        hero["renditions"] = sorted({*rend, W})
if APPLY:
    CONTENT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"hero assets {assets}; files {'written' if APPLY else 'to write'} {made}; sources missing {skipped}")
