#!/usr/bin/env python3
"""Enrich the 425-institution registry with verifiable facts (V17, REPORT §150).

**What this is, and what it refuses to be.** The brief asks every Korean institution to have a credible,
aspirational page. That is a data problem before it is a design problem: the registry carries a Korean name,
a type, a region and a major count, and nothing a prospective student would call a reason to go. This script
is the repeatable pipeline that closes the gap — and the rules it follows are what keep it honest:

1. **Facts come from authoritative, machine-checkable sources, or they do not come.** Wikidata is CC0 and
   carries, per institution: the official website (P856), inception (P571), the logo file (P154), the motto
   or mission (P1451), student count (P2196), coordinates, and — the one the brief singles out — the
   **official YouTube channel ID (P2397)**. Every value lands with the Q-id it came from and the date it was
   read, so any claim on a page can be traced back.

2. **A media file being *hosted* is not a licence to redistribute it.** Commons logos for Korean
   universities are very often non-free (trademark, fair-use-only). So every image candidate's licence is
   read from the Commons API and anything not in ``REUSABLE`` is **dropped**, not downgraded to a warning.
   §29's instruction is explicit and this is where it is enforced.

3. **An official channel is a channel the institution owns.** P2397 on the institution's own Wikidata item
   is that; a search result is not. No video is attached from anywhere else (§30).

4. **Nothing is invented.** A field with no source stays empty and the page composes around its absence.
   ``docs/qa/v17/UNIVERSITY_ENRICHMENT.csv`` reports the true per-field coverage, including the zeros.

Output: ``server/app/data/university_enrichment.json``, read at seed time. Enrichment is offline/admin work
by design (§46) — no public request path ever touches the network.

    python3 scripts/catalog/enrich_universities.py            # full run
    python3 scripts/catalog/enrich_universities.py --limit 40 # a sample, for iteration
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "server/app/data/korean_institutions.json"
OUT = ROOT / "server/app/data/university_enrichment.json"
RAW = ROOT / "server/app/data/raw/wikidata_enrichment.json"

UA = "HangyulUniv/1.0 (study-abroad product; contact myung@talkhangyul.com)"
SPARQL = "https://query.wikidata.org/sparql"
COMMONS = "https://commons.wikimedia.org/w/api.php"

#: Licences whose terms permit Hangyul to serve a copy. Anything else — "fair use", "non-free logo",
#: "copyrighted, used with permission" — is dropped. Attribution-bearing licences are allowed here only
#: because the university page credits media in its own source list; the marketing *photography* policy
#: (V14, attribution-free only) is a different and stricter rule that applies to hero imagery.
REUSABLE = {
    "cc0", "pd", "pd-self", "publicdomain", "public domain",
    "cc-by-4.0", "cc-by-3.0", "cc-by-2.5", "cc-by-2.0",
    "cc-by-sa-4.0", "cc-by-sa-3.0", "cc-by-sa-2.5", "cc-by-sa-2.0",
}


def _get(url: str, *, params: dict | None = None, accept: str = "application/json", post: bool = False) -> dict:
    """GET, or POST the parameters as a form body.

    `post` exists because a batch of Commons titles is long: Korean university filenames are percent-encoded
    Hangul, so fifty of them in a query string ran past the server's URI limit and silently lost a batch
    (`HTTP 414`). Form-encoding the same parameters has no such limit.
    """
    data = None
    if params and post:
        data = urllib.parse.urlencode(params).encode("utf-8")
    elif params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_wikidata() -> list[dict]:
    """Every Korean higher-education institution Wikidata knows, with the fields a page can use.

    One query rather than 425: the endpoint is a shared public resource and hammering it with per-item
    lookups would be both slower and rude. ``OPTIONAL`` throughout, because an institution missing a logo
    must still come back with its website.
    """
    query = """
    SELECT ?item ?ko ?en ?website ?inception ?logo ?image ?motto ?mottoEn ?students ?youtube ?cityKo ?lat ?lon WHERE {
      ?item wdt:P31/wdt:P279* ?type .
      VALUES ?type { wd:Q3918 wd:Q189004 wd:Q875538 wd:Q1371037 wd:Q62078547 }
      ?item wdt:P17 wd:Q884 .
      OPTIONAL { ?item rdfs:label ?ko  FILTER(lang(?ko)  = "ko") }
      OPTIONAL { ?item rdfs:label ?en  FILTER(lang(?en)  = "en") }
      OPTIONAL { ?item wdt:P856  ?website }
      OPTIONAL { ?item wdt:P571  ?inception }
      OPTIONAL { ?item wdt:P154  ?logo }
      OPTIONAL { ?item wdt:P18   ?image }
      OPTIONAL { ?item wdt:P1451 ?motto   FILTER(lang(?motto)   = "ko") }
      OPTIONAL { ?item wdt:P1451 ?mottoEn FILTER(lang(?mottoEn) = "en") }
      OPTIONAL { ?item wdt:P2196 ?students }
      OPTIONAL { ?item wdt:P2397 ?youtube }
      OPTIONAL { ?item wdt:P131/rdfs:label ?cityKo FILTER(lang(?cityKo) = "ko") }
      OPTIONAL { ?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] }
    }
    """
    data = _get(SPARQL, params={"query": query, "format": "json"},
                accept="application/sparql-results+json")
    return data["results"]["bindings"]


def commons_licences(files: list[str]) -> dict[str, dict]:
    """Read each Commons file's licence. 50 titles per call is the API's limit for ``extmetadata``."""
    out: dict[str, dict] = {}
    titles = [f for f in files if f]
    for i in range(0, len(titles), 25):
        chunk = titles[i:i + 25]
        try:
            d = _get(COMMONS, post=True, params={
                "action": "query", "format": "json", "prop": "imageinfo",
                "iiprop": "extmetadata|url|size", "titles": "|".join(chunk),
            })
        except Exception as exc:  # pragma: no cover - network
            print(f"  ! commons batch failed: {exc}", file=sys.stderr)
            continue
        for page in (d.get("query", {}).get("pages") or {}).values():
            if "missing" in page or "invalid" in page:
                continue
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata") or {}
            short = (meta.get("LicenseShortName", {}).get("value") or "").strip()
            lic = (meta.get("License", {}).get("value") or "").strip().lower()
            # MediaWiki normalises underscores to spaces in the titles it echoes back, and Wikidata's P154
            # values use underscores. Keying on the raw value would miss every multi-word filename — which
            # is most of them, and is why the first run of this script reported zero reusable logos while
            # KAIST's was plainly public domain on Commons.
            out[_title_key(page.get("title", ""))] = {
                "licence": short or lic,
                "licence_code": lic,
                "url": info.get("url"),
                "width": info.get("width"),
                "height": info.get("height"),
                "reusable": lic in REUSABLE or short.lower() in REUSABLE,
            }
        time.sleep(0.2)
    return out


def _title_key(t: str) -> str:
    """One spelling for a Commons title: `File:` prefix, spaces not underscores, case-folded.

    Wikidata's P154/P18 do not hold a filename — they hold a `Special:FilePath` **URL** with the name
    percent-encoded (`…/Special:FilePath/Postech%20Logotype.svg`). Taking the raw value as a title is why
    the first two runs of this script reported zero reusable media while KAIST's logo was plainly public
    domain: every lookup was for a page that does not exist.
    """
    t = (t or "").strip()
    if "Special:FilePath/" in t:
        t = urllib.parse.unquote(t.rsplit("Special:FilePath/", 1)[-1])
    t = t.replace("_", " ").strip()
    if not t.lower().startswith("file:"):
        t = f"File:{t}"
    return t.lower()


def _norm(s: str) -> str:
    """Korean institution names differ by spacing and by the 학교법인 prefix; compare without them."""
    s = re.sub(r"\(.*?\)", "", s or "")
    s = re.sub(r"(학교법인|재단법인)", "", s)
    return re.sub(r"[\s·\-–—]", "", s).strip().lower()


def _val(row: dict, key: str):
    return (row.get(key) or {}).get("value")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only enrich the first N institutions (iteration)")
    ap.add_argument("--offline", action="store_true", help="reuse the cached SPARQL result")
    args = ap.parse_args()

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))["institutions"]
    if args.limit:
        registry = registry[: args.limit]

    if args.offline and RAW.exists():
        rows = json.loads(RAW.read_text(encoding="utf-8"))
        print(f"wikidata: {len(rows)} cached rows")
    else:
        print("wikidata: querying …")
        rows = fetch_wikidata()
        RAW.parent.mkdir(parents=True, exist_ok=True)
        RAW.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        print(f"wikidata: {len(rows)} rows")

    # Fold the per-value rows into one record per Q-id (SPARQL returns a cross product of the optionals).
    by_q: dict[str, dict] = {}
    for r in rows:
        q = _val(r, "item").rsplit("/", 1)[-1]
        rec = by_q.setdefault(q, {"qid": q})
        for key in ("ko", "en", "website", "inception", "logo", "image", "motto", "mottoEn",
                    "students", "youtube", "cityKo", "lat", "lon"):
            v = _val(r, key)
            if v and not rec.get(key):
                rec[key] = v

    by_name: dict[str, dict] = {}
    for rec in by_q.values():
        for key in (rec.get("ko"), rec.get("en")):
            if key:
                by_name.setdefault(_norm(key), rec)

    # ---- match, then collect the media candidates in one pass so Commons is called once
    matched: dict[str, dict] = {}
    for inst in registry:
        rec = None
        if inst.get("wikidata_id"):
            rec = by_q.get(inst["wikidata_id"])
        if rec is None:
            rec = by_name.get(_norm(inst["name_ko"])) or (by_name.get(_norm(inst.get("name_en") or "")) if inst.get("name_en") else None)
        if rec:
            matched[inst["slug"]] = rec

    files = {_title_key(rec[k]) for rec in matched.values() for k in ("logo", "image") if rec.get(k)}
    print(f"matched {len(matched)}/{len(registry)} · {len(files)} media candidates")
    lic = commons_licences(sorted(files)) if files else {}
    reusable = sum(1 for v in lic.values() if v["reusable"])
    print(f"commons: {len(lic)} files checked, {reusable} reusable")

    today = date.today().isoformat()
    out: dict[str, dict] = {}
    for inst in registry:
        rec = matched.get(inst["slug"])
        if not rec:
            continue
        e: dict = {"wikidata_id": rec["qid"], "verified_at": today,
                   "source_url": f"https://www.wikidata.org/wiki/{rec['qid']}"}
        if rec.get("en") and not inst.get("name_en"):
            e["name_en"] = rec["en"]
        if rec.get("website"):
            e["website_url"] = rec["website"]
        if rec.get("inception"):
            e["founded_year"] = int(rec["inception"][:4]) if rec["inception"][:4].isdigit() else None
        if rec.get("students"):
            try:
                e["student_count"] = int(float(rec["students"]))
            except ValueError:
                pass
        if rec.get("cityKo"):
            e["city_ko"] = rec["cityKo"]
        if rec.get("lat") and rec.get("lon"):
            e["lat"], e["lon"] = float(rec["lat"]), float(rec["lon"])
        # The mission/philosophy (교육 이념). Stored as the source string with its provenance; the page
        # paraphrases rather than reproducing long passages (§28).
        if rec.get("motto") or rec.get("mottoEn"):
            e["motto"] = {"ko": rec.get("motto"), "en": rec.get("mottoEn"),
                          "source": "wikidata:P1451", "verified_at": today}
        # Only media we may actually serve.
        for key, slot in (("logo", "logo"), ("image", "hero")):
            name = rec.get(key)
            info = lic.get(_title_key(name)) if name else None
            if info and info["reusable"] and info.get("url"):
                e[slot] = {"url": info["url"], "licence": info["licence"], "file": _title_key(name),
                           "width": info.get("width"), "height": info.get("height"),
                           "source": "wikimedia-commons", "verified_at": today}
            elif info:
                # Recorded as a refusal, so the coverage report can say *why* a page has no logo.
                e.setdefault("media_blocked", []).append({"slot": slot, "file": _title_key(name), "licence": info["licence"] or "unknown"})
        if rec.get("youtube"):
            e["youtube"] = {"channel_id": rec["youtube"],
                            "channel_url": f"https://www.youtube.com/channel/{rec['youtube']}",
                            "source": "wikidata:P2397", "verified_at": today}
        out[inst["slug"]] = e

    OUT.write_text(json.dumps({
        "_generated_by": "scripts/catalog/enrich_universities.py",
        "generated_at": today,
        "institutions": len(registry),
        "enriched": len(out),
        "records": out,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    def n(field: str) -> int:
        return sum(1 for v in out.values() if v.get(field))
    print(f"\nwrote {OUT.relative_to(ROOT)} — {len(out)}/{len(registry)} enriched")
    for f in ("website_url", "founded_year", "student_count", "motto", "logo", "hero", "youtube"):
        print(f"  {f:14} {n(f):4}/{len(registry)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
