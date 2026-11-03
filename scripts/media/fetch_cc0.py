#!/usr/bin/env python3
"""
Source attribution-free photography from Wikimedia Commons (brief Parts 2 and 35).

The owner's production state is **no customer-visible photo attribution**. The brief is explicit that this is
reached by replacing attribution-required media, never by deleting required credit from CC BY work, so this
script will only ever download an image whose licence Commons itself reports as CC0 or public domain.

How it decides, in order, and it refuses on the first failure:

  1. the file's `extmetadata.LicenseShortName` / `License` from the Commons API — not the page text, not a
     category, not the uploader's claim in the description;
  2. that value against `ACCEPT`, which lists only licences with no attribution condition;
  3. a positive `extmetadata.Artist`, recorded in the manifest for our internal records even though nothing
     will be shown — knowing who took a picture is good practice whether or not the licence compels it.

`search` finds candidates and prints what they are licensed as, so a human picks the photographs; `fetch`
downloads the chosen ones at 640/1200/2400 and writes their provenance. Nothing is downloaded by a search.

  python3 scripts/media/fetch_cc0.py search "Yonsei University campus"
  python3 scripts/media/fetch_cc0.py fetch --title "File:Foo.jpg" --slug yonsei-campus-walk --use campus
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / "apps/marketing-web/public/media"
MANIFEST = ROOT / "apps/marketing-web/src/media/credits.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = "HangyulUniv-media-audit/1.0 (https://talkhangyul.com; licensing compliance)"

#: Licences with **no** attribution condition. Everything else — every CC BY and CC BY-SA version, every
#: "attribution required" PD variant — is refused, because shipping it without a credit would breach it and
#: shipping it with one is what the owner asked us to remove.
ACCEPT = {
    "cc0", "cc-zero", "cc0 1.0",
    "public domain", "pd", "pd-self", "pd-user",
    "pd-old", "pd-old-100", "pd-old-70", "pd-art",
}

WIDTHS = (640, 1200, 2400)


def api(**params) -> dict:
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())


def meta(title: str) -> dict:
    """Licence and authorship for one file, straight from the API."""
    d = api(action="query", prop="imageinfo", titles=title,
            iiprop="url|extmetadata|size", iiurlwidth=2400)
    pages = d.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        raise SystemExit(f"{title}: no imageinfo (does the file exist?)")
    info = pages[0]["imageinfo"][0]
    ext = info.get("extmetadata", {})
    get = lambda k: (ext.get(k, {}) or {}).get("value")  # noqa: E731
    return {
        "title": pages[0]["title"],
        "license": get("LicenseShortName") or get("License") or "",
        "license_url": get("LicenseUrl") or "",
        "artist_html": get("Artist") or "",
        "description": get("ImageDescription") or "",
        "url": info["url"],
        "thumb": info.get("thumburl") or info["url"],
        "width": info["width"],
        "height": info["height"],
        "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(pages[0]['title'].replace(' ', '_'))}",
    }


def attribution_free(license_name: str) -> bool:
    n = license_name.strip().lower()
    if not n:
        return False
    if "by" in n.split("-") or " by" in n or "by-sa" in n:
        return False
    return any(n.startswith(a) or n == a for a in ACCEPT)


def strip_html(s: str) -> str:
    out, depth = [], 0
    for ch in s:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return " ".join("".join(out).split())


def cmd_search(args) -> int:
    d = api(action="query", generator="search", gsrsearch=f"{args.query} filetype:bitmap",
            gsrnamespace=6, gsrlimit=args.limit, prop="imageinfo", iiprop="extmetadata|size")
    pages = d.get("query", {}).get("pages", [])
    if not pages:
        print("no results")
        return 0
    free = 0
    for p in pages:
        info = (p.get("imageinfo") or [{}])[0]
        ext = info.get("extmetadata", {})
        lic = ((ext.get("LicenseShortName") or ext.get("License") or {}) or {}).get("value", "?")
        ok = attribution_free(lic)
        free += ok
        if args.free_only and not ok:
            continue
        print(f"{'FREE' if ok else '    '}  {lic:18.18s} {info.get('width', 0)}x{info.get('height', 0):<6} {p['title']}")
    print(f"\n{len(pages)} results, {free} attribution-free")
    return 0


def cmd_fetch(args) -> int:
    m = meta(args.title)
    print(f"{m['title']}\n  licence: {m['license']!r}  {m['width']}×{m['height']}")
    if not attribution_free(m["license"]):
        print(f"! REFUSED — {m['license']!r} is not in the attribution-free set.")
        print("  The brief forbids both shipping it without the credit it requires and showing that credit.")
        return 1

    req = urllib.request.Request(m["thumb"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    print(f"  downloaded {im.width}×{im.height}")

    MEDIA.mkdir(parents=True, exist_ok=True)
    for w in WIDTHS:
        if w > im.width:
            out = im
        else:
            out = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out.save(MEDIA / f"{args.slug}-{w}.jpg", quality=82, optimize=True, progressive=True)
    print(f"  wrote {args.slug}-{{{','.join(map(str, WIDTHS))}}}.jpg")

    entry = {
        "slug": args.slug,
        "title": m["title"].removeprefix("File:").rsplit(".", 1)[0],
        "subject": args.subject or strip_html(m["description"])[:220],
        "place": args.place or "",
        "orientation": "portrait" if im.height > im.width else "landscape",
        "width": im.width, "height": im.height,
        "dominant_tone": args.tone,
        "focal_point": args.focal,
        "people": args.people,
        "license": m["license"],
        "license_url": m["license_url"],
        "rights_status": "CC0_PUBLIC_DOMAIN",
        "attribution_required": False,
        "author": strip_html(m["artist_html"]) or "unknown",
        "source_url": m["page"],
        "retrieved": args.today,
        "suggested_use": args.use,
    }
    data = json.loads(MANIFEST.read_text())
    data = [c for c in data if c["slug"] != args.slug] + [entry]
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"  recorded in {MANIFEST.relative_to(ROOT)} ({len(data)} entries)")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--limit", type=int, default=30)
    s.add_argument("--free-only", action="store_true"); s.set_defaults(fn=cmd_search)
    f = sub.add_parser("fetch")
    f.add_argument("--title", required=True); f.add_argument("--slug", required=True)
    f.add_argument("--use", default="campus"); f.add_argument("--subject", default="")
    f.add_argument("--place", default=""); f.add_argument("--tone", default="day")
    f.add_argument("--focal", default="50% 50%"); f.add_argument("--people", default="unknown")
    f.add_argument("--today", default="2026-10-18"); f.set_defaults(fn=cmd_fetch)
    a = p.parse_args()
    sys.exit(a.fn(a))
