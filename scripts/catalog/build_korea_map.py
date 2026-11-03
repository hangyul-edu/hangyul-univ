#!/usr/bin/env python3
"""Turn the official province boundaries into the SVG the public directory map draws (V12, brief Part 7).

    python3 scripts/catalog/build_korea_map.py

Source: KOSTAT's census administrative-division boundaries (센서스용 행정구역경계), the 2013 simplified province
set redistributed by github.com/southkorea/southkorea-maps. That repository states the KOSTAT material is
"free to share or remix"; the GADM material in the same repository is non-commercial and is **not** used, and
nothing here touches it. The attribution is carried on /credits with everything else we publish under licence.

Output: ``apps/marketing-web/src/media/korea-regions.ts`` — one path per region, keyed by the same region key the
institution registry uses, so the map and the directory cannot disagree about what a region is.

Projection: equirectangular with the longitude scaled by cos(mid-latitude). Over Korea's five degrees of latitude
that is visually indistinguishable from a conic projection, and it keeps the transform to two multiplications —
which matters, because the only thing worse than a slightly-wrong map is one nobody can check.
"""

from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "server" / "app" / "data" / "raw" / "kostat_provinces_2013.json"
OUT = ROOT / "apps" / "marketing-web" / "src" / "media" / "korea-regions.ts"
SOURCE_URL = (
    "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/"
    "kostat/2013/json/skorea_provinces_geo_simple.json"
)

#: KOSTAT province name → the region key used by 대학알리미 via the institution importer. The two datasets are
#: independent, so this mapping is the single place they are joined, and it is by full official name rather than
#: by code because the two sources number the provinces differently.
REGION_BY_PROVINCE: dict[str, str] = {
    "서울특별시": "Seoul",
    "부산광역시": "Busan",
    "대구광역시": "Daegu",
    "인천광역시": "Incheon",
    "광주광역시": "Gwangju",
    "대전광역시": "Daejeon",
    "울산광역시": "Ulsan",
    "세종특별자치시": "Sejong",
    "경기도": "Gyeonggi",
    "강원도": "Gangwon",
    "충청북도": "Chungbuk",
    "충청남도": "Chungnam",
    "전라북도": "Jeonbuk",
    "전라남도": "Jeonnam",
    "경상북도": "Gyeongbuk",
    "경상남도": "Gyeongnam",
    "제주특별자치도": "Jeju",
}

WIDTH = 820.0   # user units; the rendered size is set in CSS
PAD = 8.0


def rings(geometry: dict[str, Any]) -> list[list[list[float]]]:
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    return [ring for polygon in geometry["coordinates"] for ring in polygon]


def ring_area(ring: list[list[float]]) -> float:
    """Shoelace, in degrees². Only ever compared against other rings, so the unit does not matter."""
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=True):
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def main() -> int:
    if RAW.exists():
        geo = json.loads(RAW.read_text(encoding="utf-8"))
    else:
        RAW.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(SOURCE_URL, timeout=90) as resp:
            body = resp.read()
        RAW.write_bytes(body)
        geo = json.loads(body)

    features = {f["properties"]["name"]: f for f in geo["features"]}
    missing = set(REGION_BY_PROVINCE) - set(features)
    if missing:
        raise SystemExit(f"province boundaries missing for: {sorted(missing)}")

    pts = [p for f in features.values() for r in rings(f["geometry"]) for p in r]
    lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts)
    lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
    kx = math.cos(math.radians((lat0 + lat1) / 2))
    scale = (WIDTH - 2 * PAD) / ((lon1 - lon0) * kx)
    height = (lat1 - lat0) * scale + 2 * PAD

    def project(lon: float, lat: float) -> tuple[float, float]:
        return (
            PAD + (lon - lon0) * kx * scale,
            PAD + (lat1 - lat) * scale,   # SVG y grows downward
        )

    regions: list[dict[str, Any]] = []
    for province, key in REGION_BY_PROVINCE.items():
        feature = features[province]
        parts: list[str] = []
        for ring in rings(feature["geometry"]):
            d = []
            for i, (lon, lat) in enumerate(ring):
                x, y = project(lon, lat)
                d.append(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}")
            parts.append("".join(d) + "Z")
        # The label belongs on the largest landmass, not on the average of a province and its islands:
        # Jeollanam-do's 63 rings would otherwise put its name in the Yellow Sea.
        biggest = max(rings(feature["geometry"]), key=ring_area)
        cx = sum(p[0] for p in biggest) / len(biggest)
        cy = sum(p[1] for p in biggest) / len(biggest)
        lx, ly = project(cx, cy)
        regions.append({
            "key": key,
            "name_ko": province,
            "d": "".join(parts),
            "label": [round(lx, 1), round(ly, 1)],
        })

    body = ",\n".join(
        "  { key: '%s', nameKo: '%s', label: [%s, %s], d: '%s' }"
        % (r["key"], r["name_ko"], r["label"][0], r["label"][1], r["d"])
        for r in regions
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "/".join(["/*"]) + f"""*
 * Generated by scripts/catalog/build_korea_map.py — do not edit by hand.
 *
 * Province boundaries: KOSTAT 센서스용 행정구역경계 (2013 simplified province set), redistributed by
 * github.com/southkorea/southkorea-maps, whose KOSTAT material is "free to share or remix". The GADM data in
 * that repository is non-commercial and is not used here.
 *
 * `d` is in the viewBox below. `label` is the centroid of each region's largest landmass, which is where its
 * name can be written without landing in the sea.
 */
export const KOREA_VIEWBOX = '0 0 {WIDTH:.0f} {height:.0f}';

export type KoreaRegion = {{ key: string; nameKo: string; label: [number, number]; d: string }};

export const KOREA_REGIONS: readonly KoreaRegion[] = [
{body},
] as const;
""",
        encoding="utf-8",
    )
    print(f"→ {OUT.relative_to(ROOT)}")
    print(f"  viewBox 0 0 {WIDTH:.0f} {height:.0f} · {len(regions)} regions · {OUT.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
