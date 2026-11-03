#!/usr/bin/env python3
"""Build the canonical Korean institution directory (V12, REPORT §85 / brief Part 20).

    python3 scripts/catalog/import_korean_universities.py            # fetch, merge, write
    python3 scripts/catalog/import_korean_universities.py --offline  # re-merge from the cached raw payloads
    python3 scripts/catalog/import_korean_universities.py --check    # verify the committed file is reproducible

Output: ``server/app/data/korean_institutions.json`` — the file the API seeds the public directory from.

The merge is deliberately boring and auditable. Every published field names the source that produced it, and a
field with no source is simply absent: there is no default, no inferred value and no placeholder. A card that
shows four facts shows four facts somebody can check, which is the whole point of a public directory whose
predecessor shipped invented tuition totals.

Merger / closure handling (brief's "the official dataset changes"): the registry is the arbiter of existence. Any
institution in the committed file that the current registry no longer lists is retained with
``status: "WITHDRAWN"`` and ``withdrawn_at`` set, never silently deleted and never shown as currently available;
anything the registry lists is ``ACTIVE``. The previous file is read before writing precisely so that this
difference can be computed, which also means the first run of a new year reports exactly what changed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sources import (  # noqa: E402
    ACADEMYINFO_HOME,
    ACADEMYINFO_LIST,
    ACADEMYINFO_REFERER,
    ESTABLISHMENT_BY_NAME,
    KIND_BY_DIVISION,
    MAIN_CAMPUS_CODE,
    REGION_BY_CODE,
    STUDYINKOREA_IEQAS,
    USER_AGENT,
    WIKIDATA_SPARQL,
)

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "server" / "app" / "data" / "raw"
OUT = ROOT / "server" / "app" / "data" / "korean_institutions.json"

# The disclosure year the registry is queried for. AcademyInfo keys its dataset by survey year, so this is the
# one number that has to move when the next year's data publishes.
SURVEY_YEAR = "2025"


# ---------------------------------------------------------------------------- fetch

def _get(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None, tries: int = 3) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
    last: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read()
        except Exception as exc:  # network flake, not a data problem
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GET {url} failed after {tries} tries: {last}")


def fetch_registry() -> list[dict[str, Any]]:
    """대학알리미 — every institution in the current public-disclosure dataset."""
    form = {
        "searchGbn": "0",          # 0 = find a school (1 = find a major)
        "searchValue": "",
        "svyYr": SURVEY_YEAR,
        "schPsbsDivCd": "",
        "schSchlDivCdArr": "",
        "schZnCdArr": "",
        "schEstbDivCdArr": "",
        "schMjrCharCdArr": "",
        "dgHtDivCdArr": "",
        "srsLclftCd": "",
        "srsMclftCd": "",
        "srsSclftCd": "",
        "tabIdx": "2",
        "pageIdx": "01",
    }
    body = _get(
        ACADEMYINFO_LIST,
        data=urllib.parse.urlencode(form).encode(),
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": ACADEMYINFO_REFERER,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    (RAW / "academyinfo_schools.json").write_bytes(body)
    rows = json.loads(body)["resultList"]
    # The payload repeats its own row count on every row; if the two disagree the response was truncated.
    declared = rows[0]["total_count"] if rows else 0
    if declared != len(rows):
        raise RuntimeError(f"registry truncated: {len(rows)} rows, payload declares {declared}")
    return rows


def fetch_ieqas() -> dict[str, dict[str, list[str]]]:
    """Study in Korea — the IEQAS certified-institution lists, with the page's own totals as the parse check."""
    html = _get(STUDYINKOREA_IEQAS).decode("utf-8", "replace")
    (RAW / "studyinkorea_ieqas.html").write_text(html, encoding="utf-8")
    body = html[html.find("<body"):]
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", body, flags=re.S)
    lines = [ln.strip() for ln in re.sub(r"<[^>]+>", "\n", text).split("\n") if ln.strip()]

    # The page is three list blocks in a fixed order: degree programmes, language programmes, then the
    # "excellent" subset. Each block is a `대학 수 N교` total followed by `<type>(n)` headers, and the comma
    # separated names sit on the line after their header.
    blocks: list[list[int]] = []
    for i, ln in enumerate(lines):
        if re.fullmatch(r"대학 수\s*\d+교", ln):
            blocks.append([j for j in range(i, min(i + 8, len(lines))) if re.fullmatch(r"(일반대학|전문대학|대학원\s*대학)\(\d+\)", lines[j])])
    if len(blocks) != 3:
        raise RuntimeError(f"IEQAS page shape changed: found {len(blocks)} list blocks, expected 3")

    out: dict[str, dict[str, list[str]]] = {}
    for name, header_idxs in zip(("DEGREE", "LANGUAGE", "EXCELLENT"), blocks, strict=True):
        group: dict[str, list[str]] = {}
        for idx in header_idxs:
            kind = re.sub(r"\s+", "", lines[idx].split("(")[0])
            declared = int(re.search(r"\((\d+)\)", lines[idx]).group(1))
            names = [n.strip() for n in lines[idx + 1].split(",") if n.strip()]
            if len(names) != declared:
                raise RuntimeError(f"IEQAS {name}/{kind}: parsed {len(names)} names, page declares {declared}")
            group[kind] = names
        out[name] = group

    checked = re.search(r"최종 수정일\s*:\s*([\d]{4}-[\d]{2}-[\d]{2})", " ".join(lines))
    out["_meta"] = {"last_modified": [checked.group(1)] if checked else []}
    return out


WIKIDATA_QUERY = """
SELECT ?item ?ko ?en ?website ?cityKo ?lat ?lon WHERE {
  ?item wdt:P31/wdt:P279* wd:Q3918 .
  ?item wdt:P17 wd:Q884 .
  OPTIONAL { ?item rdfs:label ?ko  FILTER(lang(?ko)="ko") }
  OPTIONAL { ?item rdfs:label ?en  FILTER(lang(?en)="en") }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P131 ?city . ?city rdfs:label ?cityKo FILTER(lang(?cityKo)="ko") }
  OPTIONAL { ?item p:P625/psv:P625 ?cv . ?cv wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon }
}
"""


def fetch_wikidata() -> list[dict[str, Any]]:
    """English names, official websites and coordinates. Secondary; never decides existence or region."""
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode({'query': WIKIDATA_QUERY})}"
    body = _get(url, headers={"Accept": "application/sparql-results+json"})
    (RAW / "wikidata_universities.json").write_bytes(body)
    return json.loads(body)["results"]["bindings"]


# ---------------------------------------------------------------------------- normalise

def strip_campus(name: str) -> str:
    """`가야대학교(김해)` → `가야대학교`. The parenthetical is the campus, not part of the institution name."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()


def match_key(name: str) -> str:
    """A comparison key for the same institution written two ways by two sources.

    National universities were renamed with a 국립 prefix in 2023–2025 (공주대학교 → 국립공주대학교) and Wikidata
    mostly still carries the older label, so the prefix is dropped for matching only — never from the published
    name, which stays exactly as the registry gives it.
    """
    key = unicodedata.normalize("NFC", strip_campus(name))
    key = re.sub(r"\s+", "", key)
    return re.sub(r"^(국립|공립)", "", key)


def slugify(name_en: str | None, name_ko: str, academyinfo_id: str) -> str:
    if name_en:
        slug = re.sub(r"[^a-z0-9]+", "-", name_en.lower()).strip("-")
        if slug:
            return slug
    # No romanisation to invent one from: a stable, opaque slug beats a transliteration we cannot verify.
    return f"inst-{academyinfo_id.lstrip('0') or academyinfo_id}"


def build_wikidata_index(bindings: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    idx: dict[str, dict[str, Any]] = {}
    for b in bindings:
        if "ko" not in b:
            continue
        rec = idx.setdefault(match_key(b["ko"]["value"]), {})
        if "en" in b:
            rec.setdefault("name_en", b["en"]["value"])
        if "website" in b:
            rec.setdefault("website_url", b["website"]["value"])
        if "cityKo" in b:
            rec.setdefault("city_ko", b["cityKo"]["value"])
        if "lat" in b and "lon" in b:
            rec.setdefault("latitude", round(float(b["lat"]["value"]), 5))
            rec.setdefault("longitude", round(float(b["lon"]["value"]), 5))
        rec.setdefault("wikidata_id", b["item"]["value"].rsplit("/", 1)[-1])
    return idx


def build_ieqas_index(ieqas: dict[str, dict[str, list[str]]]) -> dict[str, set[str]]:
    """match-key → the set of IEQAS flags it holds."""
    idx: dict[str, set[str]] = {}
    for flag in ("DEGREE", "LANGUAGE", "EXCELLENT"):
        for names in ieqas[flag].values():
            for n in names:
                idx.setdefault(match_key(n), set()).add(flag)
    return idx


def merge(registry: list[dict[str, Any]], wd: dict[str, dict[str, Any]], ieqas_idx: dict[str, set[str]],
          ieqas_checked: str | None) -> list[dict[str, Any]]:
    today = date.today().isoformat()
    out: list[dict[str, Any]] = []
    branches: dict[str, list[dict[str, str]]] = {}

    # Branch and second/third campuses, collected against their main campus so a campus is never its own entry.
    for row in registry:
        if row["schl_div_nm"] not in KIND_BY_DIVISION or row["psbs_div_cd"] == MAIN_CAMPUS_CODE:
            continue
        branches.setdefault(match_key(row["schl_full_nm"]), []).append(
            {"name_ko": row["schl_full_nm"], "role": row["psbs_div_nm"], "region": REGION_BY_CODE.get(row["zn_cd"], row["zn_nm"])}
        )

    seen: set[str] = set()
    for row in registry:
        kind = KIND_BY_DIVISION.get(row["schl_div_nm"])
        if kind is None or row["psbs_div_cd"] != MAIN_CAMPUS_CODE:
            continue
        region = REGION_BY_CODE.get(row["zn_cd"])
        if region is None:
            raise RuntimeError(f"unmapped region code {row['zn_cd']} ({row['zn_nm']}) on {row['schl_full_nm']}")
        key = match_key(row["schl_full_nm"])
        extra = wd.get(key, {})
        flags = ieqas_idx.get(key, set())

        name_ko = strip_campus(row["schl_full_nm"])
        slug = slugify(extra.get("name_en"), name_ko, row["schl_id"])
        if slug in seen:  # two institutions sharing a romanisation; keep both, disambiguate by registry id
            slug = f"{slug}-{row['schl_id'].lstrip('0')}"
        seen.add(slug)

        rec: dict[str, Any] = {
            "slug": slug,
            "academyinfo_id": row["schl_id"],
            "name_ko": name_ko,
            "institution_type": kind,
            "establishment": ESTABLISHMENT_BY_NAME.get(row["estb_div_nm"], "PRIVATE"),
            "establishment_source": row["estb_div_nm"],
            "region": region,
            "status": "ACTIVE",
            "major_count": row.get("mjr_count"),
            "sources": {"registry": {"name": "대학알리미", "url": ACADEMYINFO_HOME, "survey_year": SURVEY_YEAR, "checked": today}},
            "last_verified": today,
        }
        if row["schl_full_nm"] != name_ko:
            rec["registry_name_ko"] = row["schl_full_nm"]
        if branches.get(key):
            rec["other_campuses"] = sorted(branches[key], key=lambda c: c["name_ko"])

        # Enrichment — present only when a source actually supplied it.
        for field in ("name_en", "website_url", "latitude", "longitude", "wikidata_id"):
            if field in extra:
                rec[field] = extra[field]
        if {"name_en", "website_url", "latitude", "wikidata_id"} & extra.keys():
            rec["sources"]["reference"] = {"name": "Wikidata", "url": f"https://www.wikidata.org/wiki/{extra['wikidata_id']}", "checked": today}
        if flags:
            rec["ieqas"] = {
                "certified": "DEGREE" in flags,
                "excellent": "EXCELLENT" in flags,
                "language_programme": "LANGUAGE" in flags,
            }
            rec["sources"]["international"] = {
                "name": "Study in Korea", "url": STUDYINKOREA_IEQAS,
                "checked": ieqas_checked or today,
            }
        out.append(rec)
    return sorted(out, key=lambda r: (r["region"], r["name_ko"]))


def carry_withdrawn(fresh: list[dict[str, Any]], previous: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep anything the registry has stopped listing, marked withdrawn. Never present it as available."""
    live = {r["academyinfo_id"] for r in fresh}
    today = date.today().isoformat()
    for old in previous:
        if old["academyinfo_id"] in live:
            continue
        gone = dict(old)
        gone["status"] = "WITHDRAWN"
        gone.setdefault("withdrawn_at", today)
        fresh.append(gone)
    return sorted(fresh, key=lambda r: (r["status"] != "ACTIVE", r["region"], r["name_ko"]))


# ---------------------------------------------------------------------------- main

def load_cached() -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    reg = json.loads((RAW / "academyinfo_schools.json").read_text(encoding="utf-8"))["resultList"]
    wdb = json.loads((RAW / "wikidata_universities.json").read_text(encoding="utf-8"))["results"]["bindings"]
    html = (RAW / "studyinkorea_ieqas.html").read_text(encoding="utf-8")
    tmp = RAW / "studyinkorea_ieqas.html"
    tmp.write_text(html, encoding="utf-8")
    return reg, {}, wdb


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--offline", action="store_true", help="re-merge from cached raw payloads")
    ap.add_argument("--check", action="store_true", help="fail if the committed file is not what a merge produces")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)

    if args.offline:
        registry = json.loads((RAW / "academyinfo_schools.json").read_text(encoding="utf-8"))["resultList"]
        wd_bindings = json.loads((RAW / "wikidata_universities.json").read_text(encoding="utf-8"))["results"]["bindings"]
        saved = RAW / "studyinkorea_ieqas.html"
        html = saved.read_text(encoding="utf-8")
        global _get  # noqa: PLW0603 — the parser is shared; feed it the cached bytes
        _get = lambda *a, **k: html.encode()  # type: ignore[assignment]  # noqa: E731
        ieqas = fetch_ieqas()
    else:
        print("· 대학알리미 registry …", flush=True)
        registry = fetch_registry()
        print(f"  {len(registry)} disclosure rows", flush=True)
        print("· Study in Korea IEQAS …", flush=True)
        ieqas = fetch_ieqas()
        print("· Wikidata …", flush=True)
        wd_bindings = fetch_wikidata()
        print(f"  {len(wd_bindings)} bindings", flush=True)

    checked = (ieqas.get("_meta", {}).get("last_modified") or [None])[0]
    merged = merge(registry, build_wikidata_index(wd_bindings), build_ieqas_index(ieqas), checked)

    previous: list[dict[str, Any]] = []
    if OUT.exists():
        previous = json.loads(OUT.read_text(encoding="utf-8"))["institutions"]
    merged = carry_withdrawn(merged, previous)

    active = [r for r in merged if r["status"] == "ACTIVE"]
    doc = {
        "generated_by": "scripts/catalog/import_korean_universities.py",
        "survey_year": SURVEY_YEAR,
        "counts": {
            "active": len(active),
            "withdrawn": len(merged) - len(active),
            "by_type": {k: sum(1 for r in active if r["institution_type"] == k) for k in sorted(KIND_BY_DIVISION.values())},
            "with_name_en": sum(1 for r in active if r.get("name_en")),
            "with_website": sum(1 for r in active if r.get("website_url")),
            "ieqas_certified": sum(1 for r in active if r.get("ieqas", {}).get("certified")),
            "ieqas_excellent": sum(1 for r in active if r.get("ieqas", {}).get("excellent")),
            "ieqas_language": sum(1 for r in active if r.get("ieqas", {}).get("language_programme")),
        },
        "institutions": merged,
    }

    if args.check:
        if not OUT.exists():
            print("missing committed dataset", file=sys.stderr)
            return 1
        have = json.loads(OUT.read_text(encoding="utf-8"))
        if [dict(r, last_verified="", sources={}) for r in have["institutions"]] != [dict(r, last_verified="", sources={}) for r in doc["institutions"]]:
            print("committed dataset differs from a fresh merge", file=sys.stderr)
            return 1
        print("dataset reproducible")
        return 0

    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    c = doc["counts"]
    print(f"\n→ {OUT.relative_to(ROOT)}")
    print(f"  active {c['active']}  (withdrawn {c['withdrawn']})")
    print(f"  by type {c['by_type']}")
    print(f"  english name {c['with_name_en']} · website {c['with_website']}")
    print(f"  IEQAS certified {c['ieqas_certified']} · excellent {c['ieqas_excellent']} · language {c['ieqas_language']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
