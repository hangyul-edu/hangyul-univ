"""Official GKS participation (NIIED guidelines) → institutions, by deterministic Korean-name expansion only.

The guidelines print short names ("고려대", "덕성여대", "고려대 세종캠퍼스"). A name is matched when one of these
expansions equals a registry name exactly; anything else is reported unmatched and never guessed (REPORT §361).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REF = Path(__file__).resolve().parents[1] / "data" / "research" / "v27" / "reference.json"


#: Official short forms whose expansion is not mechanical, each checked by hand against the registry name (2026-10-29).
#: KDI국제정책대학원 and 한국학중앙연구원 are not in the 대학알리미 register at all, so they stay unmatched.
ALIASES = {
    "부경대": "국립부경대학교", "부산과기대": "부산과학기술대학교", "부산외대": "부산외국어대학교", "서울과기대": "서울과학기술대학교",
    "순천대": "국립순천대학교", "울산과기원": "울산과학기술원", "포항공대": "포항공과대학교", "한국외대": "한국외국어대학교",
    "국립암센터국제암대학원": "국립암센터국제암대학원대학교", "한양대 ERICA": "한양대학교",
}


def _expansions(n: str) -> list[str]:
    if n in ALIASES:
        return [ALIASES[n]]
    base = re.sub(r"\s*\(.*?\)\s*", "", n).strip()
    m = re.match(r"^(.*?)\s+(\S+캠퍼스)$", base)
    if m:
        base = m.group(1)  # a campus suffix maps to the main institution (registry lists campuses under it)
    out = [base]
    if base.endswith("여대"):
        out.append(base[:-2] + "여자대학교")
    if base.endswith("여자대"):
        out.append(base + "학교")
    if base.endswith("대"):
        out += [base + "학교", base + "학"]
    if base.endswith("대학"):
        out.append(base + "교")
    return out


def gks_by_name(names: set[str]) -> tuple[dict[str, list[dict]], list[str]]:
    if not REF.exists():
        return {}, []
    ref = json.loads(REF.read_text(encoding="utf-8"))
    hits: dict[str, list[dict]] = {}
    unmatched: set[str] = set()
    for p in (ref.get("gks") or {}).get("programmes") or []:
        for raw in p.get("universities_ko") or []:
            name = next((x for x in _expansions(raw) if x in names), None)
            if name is None:
                unmatched.add(raw)
                continue
            entry = {"programme": p.get("name"), "notice_url": p.get("notice_url"), "notice_date": p.get("notice_date"),
                     "listed_as": raw}
            if entry not in hits.setdefault(name, []):
                hits[name].append(entry)
    return hits, sorted(unmatched)
