#!/usr/bin/env python3
"""
Build the canonical homepage logo → university map (brief Part 8).

Every crest in the homepage band must open that university's detail page, and the mapping must live in one
manifest rather than being inferred in JSX. This script joins the owner's crest assets to the Korean
institution registry (`server/app/data/korean_institutions.json`, imported by
`scripts/catalog/import_korean_universities.py`) and writes
`apps/marketing-web/src/media/universities.json`.

The join is on the official Korean name. Two crests carry a university's **colloquial** name, which the registry
— correctly — does not use, so those two are aliased explicitly here and nowhere else:

    카이스트  → 한국과학기술원   (KAIST)
    유니스트  → 울산과학기술원   (UNIST)

Nothing is invented: a crest whose university is not on the national register is reported and left without a
slug rather than pointed at a plausible-looking page.

Each row also carries an optical `scale`. The crests are drawn at one CSS height, but a wide wordmark carries
far more ink than a compact seal at that height and reads heavier, which is what made the V13 band look like a
set of unrelated images. `scale` nudges each crest toward the set's median ink mass; it is clamped tightly, so
no official proportion changes — only the box the crest is drawn in.

  python3 scripts/media/build_marquee_manifest.py [--check]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize_crests import RECTANGLE_FILL, SHIPPED, TILE_EXCEPTIONS, measure, optical_scale, render  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "server/app/data/korean_institutions.json"
MANIFEST = ROOT / "apps/marketing-web/src/media/universities.json"

#: Crest name → the official Korean name the national register uses.
ALIASES = {"카이스트": "한국과학기술원", "유니스트": "울산과학기술원"}

#: Crests whose own artwork is a full-bleed rectangle and are drawn as a deliberate tile. The list, and the
#: reason for each entry, live in normalize_crests.py so the audit and the manifest cannot disagree.
TILES = set(TILE_EXCEPTIONS)

#: Row and order are the owner's layout, preserved from the template.
ROWS: list[tuple[int, list[str]]] = [
    (1, ["u-1-1", "u-1-2", "u-1-3", "u-1-4", "u-1-5", "u-1-6", "u-1-7", "u-1-9"]),
    (2, ["u-2-1", "u-2-2", "u-2-3", "u-2-4", "u-2-6", "u-2-7", "u-2-10", "u-2-11"]),
    (3, ["u-3-1", "u-3-3", "u-3-4", "u-3-7", "u-3-8", "u-3-9", "u-1-10"]),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="write nothing; exit 1 if the manifest is out of date")
    args = ap.parse_args()

    existing = {c["file"].rsplit(".", 1)[0]: c for c in json.loads(MANIFEST.read_text())}
    registry = {r["name_ko"]: r for r in json.loads(REGISTRY.read_text())["institutions"]}

    # One pass over the rendered crests gives both the optical mass and the shipped filename/ratio.
    rendered: dict[str, dict] = {}
    for stem in (s for _, row in ROWS for s in row):
        path = next((SHIPPED / f"{stem}{ext}" for ext in (".svg", ".png") if (SHIPPED / f"{stem}{ext}").exists()), None)
        if path is None:
            print(f"! {stem}: no asset in {SHIPPED.relative_to(ROOT)}")
            return 1
        rendered[stem] = {"path": path, **measure(render(path))}

    masses = sorted(r["mass"] for r in rendered.values())
    median = masses[len(masses) // 2]

    out = []
    unmapped = []
    for row, stems in ROWS:
        for stem in stems:
            prev = existing.get(stem)
            if prev is None:
                print(f"! {stem}: not in the current manifest — a crest cannot be named from its filename")
                return 1
            r = rendered[stem]
            name_ko = prev["name_ko"]
            inst = registry.get(ALIASES.get(name_ko, name_ko))
            if inst is None:
                unmapped.append(f"{name_ko} ({prev['name_en']})")
            scale = optical_scale(r["mass"], median)
            # cairosvg reports the rendered box; store the intrinsic ratio so the row never reflows while loading.
            out.append({
                "file": r["path"].name,
                "name_ko": name_ko,
                "name_en": (inst or {}).get("name_en") or prev["name_en"],
                "slug": (inst or {}).get("slug"),
                "registry_id": (inst or {}).get("academyinfo_id"),
                "width": round(100 * r["aspect"]),
                "height": 100,
                "scale": scale,
                "row": row,
                **({"tile": True} if r["path"].name in TILES else {}),
            })

    if unmapped:
        print(f"! {len(unmapped)} crest(s) are not on the national register: {', '.join(unmapped)}")
        print("  Add the institution via scripts/catalog/import_korean_universities.py — never by hand.")
        return 1

    body = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if MANIFEST.read_text() != body:
            print("! universities.json is out of date — run python3 scripts/media/build_marquee_manifest.py")
            return 1
        print(f"manifest up to date ({len(out)} crests, {sum(1 for c in out if c['slug'])} mapped)")
        return 0

    MANIFEST.write_text(body)
    rect = [c["file"] for c in out if rendered[c["file"].rsplit(".", 1)[0]]["fill"] >= RECTANGLE_FILL]
    print(f"{len(out)} crests → {MANIFEST.relative_to(ROOT)}")
    print(f"  mapped to a university page: {sum(1 for c in out if c['slug'])}/{len(out)}")
    print(f"  drawn as a tile: {', '.join(sorted(TILES)) or 'none'}")
    print(f"  rectangular artwork: {', '.join(rect) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
