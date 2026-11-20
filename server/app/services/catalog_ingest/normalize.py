"""Parse → validate → normalise: turn the committed reference and research files into catalogue payloads.

Pure functions of the input files (no database), so the same inputs always stage the same payloads and the payload
hash is a faithful change detector. Every payload carries its own provenance (``source_url``, ``verified_at``,
``status``); a value the source does not state is left out (null), never defaulted.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from app.seed import institutions as inst_seed
from app.seed import v27_research

DATA = Path(__file__).resolve().parents[2] / "data"
V33_PROGRAMMES = DATA / "research" / "v33" / "programmes"

#: The catalogue's field taxonomy (`/meta/taxonomy`). A unit outside it keeps ``field = null``.
FIELDS = frozenset({
    "business", "economics", "computer_science", "engineering", "electrical_engineering", "mechanical_engineering",
    "korean_studies", "korean_language", "international_studies", "media_communication", "design", "arts",
    "hospitality_tourism", "nursing_health", "biotechnology", "natural_sciences", "education", "law", "social_sciences",
    "data_science", "architecture", "music", "film", "sports",
})
DEGREES = frozenset({"LANGUAGE", "ASSOCIATE", "BACHELOR", "TRANSFER", "MASTER", "DOCTORATE", "COMBINED"})
TERMS = frozenset({"SPRING", "SUMMER", "FALL", "WINTER"})
LANGS = frozenset({"KOREAN", "ENGLISH", "BILINGUAL"})
REGISTRY_URL = "https://www.academyinfo.go.kr"


def payload_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def files_hash(paths: list[Path]) -> str:
    h = hashlib.sha256()
    for p in sorted(paths):
        if p.exists() and p.is_file():
            h.update(p.name.encode())
            h.update(p.read_bytes())
    return h.hexdigest()


def reference_files() -> list[Path]:
    return [inst_seed.DATA, inst_seed.ENRICHMENT, inst_seed.CONTENT]


def research_files() -> list[Path]:
    return sorted(v27_research.FACTS.glob("*.json")) + sorted(v27_research.GUIDES.glob("*.json"))


def programme_files() -> list[Path]:
    return sorted(p for p in V33_PROGRAMMES.glob("*.json") if not p.name.startswith("_")) if V33_PROGRAMMES.exists() else []


def _d(v: Any) -> str | None:
    if not v:
        return None
    try:
        return date.fromisoformat(str(v)[:10]).isoformat()
    except ValueError:
        return None


def _url(v: Any) -> str | None:
    if isinstance(v, dict):
        v = v.get("url")
    return v if isinstance(v, str) and v.startswith(("http://", "https://")) else None


# ------------------------------------------------------------------------------------------------ universities

def university_payloads() -> tuple[list[dict], list[str]]:
    """One payload per ACTIVE directory institution. Returns (payloads, problems)."""
    doc = inst_seed.load_dataset()
    enrichment = inst_seed.load_enrichment()
    out, problems = [], []
    for rec in doc["institutions"]:
        if rec.get("status") != "ACTIVE":
            continue
        slug = rec.get("slug")
        if not slug or not rec.get("name_ko") or not rec.get("region") or not rec.get("establishment"):
            problems.append(f"institution {rec.get('academyinfo_id')}: missing slug/name/region/establishment")
            continue
        e = enrichment.get(slug) or {}
        intl = e.get("intl") or {}
        links = intl.get("links") or {}
        registry = (rec.get("sources") or {}).get("registry") or {}
        international = (rec.get("sources") or {}).get("international") or {}
        ieqas = rec.get("ieqas") or {}
        name_en = rec.get("name_en") or e.get("name_en")
        cert = "EXCELLENT" if ieqas.get("excellent") else ("CERTIFIED" if ieqas.get("certified") else None)
        intl_adm = _url(e.get("international_admissions_url")) or _url(links.get("international_admissions"))
        intl_office = _url(e.get("international_office_url")) or _url(links.get("international_office"))
        payload = {
            "slug": slug,
            "academyinfo_id": rec.get("academyinfo_id"),
            "name_ko": rec["name_ko"],
            "name_en": name_en,
            "institution_type": rec["establishment"],  # NATIONAL | PUBLIC | PRIVATE
            "institution_kind": rec.get("institution_type"),
            "region": rec["region"],
            "city": e.get("city_ko") or None,
            "website_url": _url(rec.get("website_url")) or _url(e.get("website_url")),
            "international_admissions_url": intl_adm,
            "has_international_office": True if (intl_office or intl_adm) else None,
            "founded_year": e.get("founded_year") if isinstance(e.get("founded_year"), int) else None,
            "latitude": rec.get("latitude") if rec.get("latitude") is not None else e.get("lat"),
            "longitude": rec.get("longitude") if rec.get("longitude") is not None else e.get("lon"),
            "certification_status": cert,
            "certification_source_url": _url(international.get("url")) if cert else None,
            "certification_verified_at": _d(international.get("checked")) if cert else None,
            "source_url": _url(registry.get("url")) or REGISTRY_URL,
            "verified_at": _d(rec.get("last_verified") or registry.get("checked")),
        }
        out.append(payload)
    return out, problems


# ------------------------------------------------------------------------------------------------ programmes

def _round_no(v: Any, default: int) -> int:
    m = re.search(r"\d+", str(v or ""))
    return int(m.group()) if m else default


def _intakes(guide: dict) -> list[dict]:
    rounds = guide.get("rounds") or []
    out = []
    if rounds:
        for n, r in enumerate(rounds, 1):
            closes = _d(r.get("application_closes"))
            if not closes:
                continue
            out.append({"round": _round_no(r.get("round"), n), "application_opens": _d(r.get("application_opens")),
                        "application_deadline": closes, "document_deadline": _d(r.get("document_deadline")),
                        "source_page": (str(r.get("source_page"))[:60] if r.get("source_page") else None),
                        "evidence": r.get("evidence")})
    elif _d(guide.get("application_closes")):
        out.append({"round": 1, "application_opens": _d(guide.get("application_opens")),
                    "application_deadline": _d(guide.get("application_closes")), "document_deadline": _d(guide.get("document_deadline")),
                    "source_page": None, "evidence": None})
    seen, uniq = set(), []
    for i in out:
        if i["round"] in seen:
            continue
        seen.add(i["round"])
        uniq.append(i)
    return uniq


ENGLISH_TESTS = {"IELTS_ACADEMIC": "min_ielts", "IELTS": "min_ielts", "TOEFL_IBT": "min_toefl_ibt", "TOEFL": "min_toefl_ibt"}


def _numeric(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*", str(v))
    return float(m.group(1)) if m else None


def language_requirement(guide: dict) -> dict | None:
    """Only numeric TOPIK / IELTS / TOEFL iBT minimums the guide states (at application, not before graduation)."""
    found: dict[str, tuple[float, str]] = {}
    korean_groups, english_groups = set(), set()
    evidence = []
    for r in guide.get("language_rules") or []:
        test = str(r.get("test") or "").upper()
        if (r.get("stage") or "APPLICATION") == "GRADUATION":
            continue
        val = _numeric(r.get("min"))
        group = str(r.get("group") or "A")
        if test == "TOPIK":
            korean_groups.add(group)
            if val is not None and 1 <= val <= 6 and "min_topik_level" not in found:
                found["min_topik_level"] = (val, group)
                evidence.append(r.get("evidence"))
        elif test in ENGLISH_TESTS:
            english_groups.add(group)
            col = ENGLISH_TESTS[test]
            ok = val is not None and ((col == "min_ielts" and 0 < val <= 9) or (col == "min_toefl_ibt" and 0 < val <= 120))
            if ok and col not in found:
                found[col] = (val, group)
                evidence.append(r.get("evidence"))
    if not found:
        return None
    alternative = not (korean_groups and english_groups) or bool(korean_groups & english_groups)
    return {
        "min_topik_level": int(found["min_topik_level"][0]) if "min_topik_level" in found else None,
        "min_ielts": found["min_ielts"][0] if "min_ielts" in found else None,
        "min_toefl_ibt": int(found["min_toefl_ibt"][0]) if "min_toefl_ibt" in found else None,
        "language_alternative": alternative,
        "evidence": " · ".join(e for e in evidence if e)[:2000] or None,
    }


def _guide_status(g: dict) -> str:
    s = g.get("status")
    return s if s in ("VERIFIED", "STALE", "REVIEW_REQUIRED", "CONFLICT") else "REVIEW_REQUIRED"


def _pick_guide(guides: list[dict], *, year: Any, term: Any, degree: str, language: str) -> dict | None:
    cands = [g for g in guides if g.get("degree_level") == degree
             and (not year or str(g.get("intake_year")) == str(year))
             and (not term or str(g.get("term") or "").upper() == str(term).upper())]
    if not cands:
        return None
    want = "ENGLISH" if language == "ENGLISH" else "KOREAN"
    for track in (want, "ANY", None):
        for g in cands:
            if (g.get("track") or None) == track:
                return g
    return cands[0]


def _norm_college(v: Any) -> str:
    return re.sub(r"\s+", "", str(v or "")).removesuffix("대학")


def _as_list(v: Any) -> list[str]:
    if v is None:
        return []
    return [str(x) for x in v] if isinstance(v, (list, tuple)) else [str(v)]


def _name_core(name: str) -> str:
    core = re.sub(r"\(.*?\)", "", name).strip()
    for suffix in ("학과", "학부", "전공", "과"):
        if core.endswith(suffix) and len(core) > len(suffix) + 1:
            return core[: -len(suffix)]
    return core


def _tuition(entries: list[dict], unit: dict) -> tuple[int | None, dict | None, bool]:
    """The tuition row printed for this unit: matched by name (``name_ko`` list or the scope text), then by the guide's
    tuition group (``tuition_group``), then by college. Ambiguity (two different amounts) → unknown, never a guess.
    Returns (amount, row, period_stated)."""
    vals = [t for t in entries or [] if isinstance(t.get("per_semester_krw"), (int, float)) and t["per_semester_krw"] > 0]
    name = unit.get("name_ko") or ""
    campus = unit.get("campus")
    vals = [t for t in vals if not (t.get("campus") and campus and t["campus"] != campus)]

    def pick(rows: list[dict]):
        if rows and len({t["per_semester_krw"] for t in rows}) == 1:
            return int(rows[0]["per_semester_krw"]), rows[0], rows[0].get("period_stated_in_guide") is not False
        return None

    by_name = [t for t in vals if name in _as_list(t.get("name_ko"))]
    if by_name:
        return pick(by_name) or (None, None, False)
    core = _name_core(name)
    by_text = [t for t in vals if core and len(core) >= 2 and core in str(t.get("scope") or "")]
    if by_text and (hit := pick(by_text)):
        return hit
    if unit.get("tuition_group"):
        return pick([t for t in vals if t.get("tuition_group") == unit["tuition_group"]]) or (None, None, False)
    college = _norm_college(unit.get("college_ko"))
    if college:
        rows = [t for t in vals if college in {_norm_college(c) for c in _as_list(t.get("college_ko"))}]
        if rows:
            return pick(rows) or (None, None, False)
    general = [t for t in vals if not t.get("college_ko") and not t.get("tuition_group") and not t.get("name_ko")]
    return pick(general) or (None, None, False)


def _fee(fee: Any, unit: dict) -> int | None:
    """The application fee printed for this unit's scope; the guide's base amount when no special scope names it."""
    if not isinstance(fee, dict) or not isinstance(fee.get("value"), (int, float)) or fee["value"] <= 0:
        return None
    scopes = [s for s in fee.get("by_scope") or [] if isinstance(s.get("value"), (int, float))
              and not re.search(r"재지원|re-?appl", str(s.get("scope") or ""), re.I)]
    if not scopes:
        return int(fee["value"])
    college = _norm_college(unit.get("college_ko"))
    core = _name_core(unit.get("name_ko") or "")
    hits = [s for s in scopes if college and college in {_norm_college(c) for c in _as_list(s.get("college_ko"))}]
    hits += [s for s in scopes if core and len(core) >= 2 and core in str(s.get("scope") or "") and s not in hits]
    values = {int(s["value"]) for s in hits}
    if len(values) == 1:
        return values.pop()
    if len(values) > 1:
        return None
    return int(fee["value"])


def programme_key(slug: str, degree: str, language: str, college: str | None, name_ko: str) -> str:
    raw = f"{slug}:{degree}:{language}:{college or ''}:{name_ko}"
    if len(raw) <= 300:
        return raw
    return f"{slug}:{degree}:{language}:{hashlib.sha256(raw.encode()).hexdigest()[:32]}"


def programme_payloads(v27_guides: dict[str, dict] | None = None, files: list[Path] | None = None) -> tuple[list[dict], list[str]]:
    """One payload per 모집단위 read from an official guide (V33 unit lists), joined to the V27 guide's dates, rounds and
    language rules. A guide without a unit list yields nothing — never a generic placeholder programme."""
    guides_by_slug = v27_guides if v27_guides is not None else v27_research.read_all("guides")
    out, problems = [], []
    for path in files if files is not None else programme_files():
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            problems.append(f"{path.name}: unreadable ({exc})")
            continue
        slug = doc.get("slug") or path.stem
        units = doc.get("units") or []
        if not units:
            continue
        degree = str(doc.get("degree_level") or "").upper()
        source_url = _url(doc.get("guide_source_url"))
        if degree not in DEGREES or not source_url:
            problems.append(f"{path.name}: missing degree_level or guide_source_url")
            continue
        year, term = doc.get("intake_year"), str(doc.get("term") or "").upper() or None
        guides = (guides_by_slug.get(slug) or {}).get("guides") or []
        researched = _d((guides_by_slug.get(slug) or {}).get("researched_at"))
        verified_at = _d(doc.get("extracted_at")) or researched
        fee = doc.get("application_fee_krw") or None
        for u in units:
            if u.get("excluded"):
                continue
            name_ko = (u.get("name_ko") or "").strip()
            if not name_ko:
                problems.append(f"{path.name}: unit without name_ko")
                continue
            # A unit printed once per major (한국어학과 · 한국어학전공 / 한국콘텐츠학전공) is one programme per major.
            major = u.get("major_ko") if isinstance(u.get("major_ko"), str) and u.get("major_ko").strip() else None
            if major:
                name_ko = f"{name_ko} · {major.strip()}"
            lang = str(u.get("instruction_language") or doc.get("track") or "KOREAN").upper()
            lang = lang if lang in LANGS else "KOREAN"
            college = (u.get("college_ko") or "").strip() or None
            guide = _pick_guide(guides, year=year, term=term, degree=degree, language=lang)
            status = _guide_status(guide) if guide else (doc.get("status") if doc.get("status") in ("VERIFIED", "STALE") else "REVIEW_REQUIRED")
            tuition, tuition_src, period_stated = _tuition(doc.get("tuition") or [], u)
            fee_value = _fee(fee, u)
            tuition_note = None
            if tuition is not None and not period_stated:
                # The guide prints the amount without saying per what period: kept as evidence, never as a per-semester fact.
                tuition_note = {"amount_krw": tuition, "basis": tuition_src.get("basis") or tuition_src.get("basis_year"),
                                "period_stated_in_guide": False, "source_page": tuition_src.get("source_page")}
                tuition = None
            intake_year = int(guide["intake_year"]) if guide and guide.get("intake_year") else (int(year) if str(year or "").isdigit() else None)
            intake_term = str((guide or {}).get("term") or term or "").upper() or None
            field = u.get("field") if u.get("field") in FIELDS else None
            out.append({
                "key": programme_key(slug, degree, lang, college, name_ko),
                "slug": slug,
                "name_ko": name_ko[:200],
                "name_en": (u.get("name_en") or "").strip()[:200] or None,
                "college_ko": college[:200] if college else None,
                "campus_name": (str(u["campus"])[:120] if u.get("campus") else None),
                "degree_level": degree,
                "field": field,
                "instruction_language": lang,
                "tuition_per_semester_krw": tuition,
                "tuition_evidence": ({"source_page": tuition_src.get("source_page"), "evidence": tuition_src.get("evidence"),
                                      "basis": tuition_src.get("basis") or tuition_src.get("basis_year")} if tuition_src and tuition else None),
                "tuition_unverified_period": tuition_note,
                "application_fee_krw": fee_value,
                # The document the unit list was actually read from; a changed official URL supersedes the V27 one.
                "source_url": source_url,
                "superseded_guide_url": ((guide or {}).get("source_url") if guide and guide.get("source_url") != source_url else None),
                "source_page": (str(u["source_page"])[:60] if u.get("source_page") else None),
                "evidence": u.get("evidence"),
                "guide_title": (guide or {}).get("title") or doc.get("guide_title"),
                "verified_at": verified_at,
                "status": status,
                "intake": ({"year": intake_year, "term": intake_term, "rounds": _intakes(guide)}
                           if guide and intake_year and intake_term in TERMS else None),
                "requirement": language_requirement(guide) if guide else None,
            })
    return out, problems
