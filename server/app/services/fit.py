"""V27 quick fit — every relevant Korean institution, in four honest groups (REPORT §356).

The V17–V26 quick check ran the programme engine over the ten-university application catalogue and returned six
sample rows. This answers a different, more useful question from the 425-institution directory:

    "Of every institution that offers what I want to study, where do I stand against what each one has
     officially published?"

Rules, all deliberate:

* **Universe** = every ACTIVE directory institution that offers the chosen study level (by institution type; the
  Korean-language route needs a listed language programme). Nothing is dropped for being famous, selective or
  unverified — an institution without verified rules is shown in CHALLENGE, never hidden.
* **Tiers** (no probability, ever):
    MEETS      a verified current rule for this level is satisfied on some track and route (or asks for no result to apply)
    CHALLENGE  no known disqualification: the rule is not verified yet, or the open route is one only the university judges
    ONE_STEP   one known requirement is missing on the nearest route (a test to take, or a level/score to raise)
    UNCLEAR    the student holds an accepted result but is far below the nearest route (≥ 3 levels / ≥ 25 % of the scale)
  Rule groups within a track are alternative routes (department-specific minimums); tests within a group are alternatives.
* **Acceptance is per rule**: a test counts only where the institution's rule names it. TOPIK IBT is not TOPIK,
  TOEIC is not TOEFL, unless the rule says so.
* **Order** inside a group is a *discovery priority* from verified, non-ranking facts (owner-curated featured list,
  IEQAS 우수/인증, scholarship fit, verified data depth, a real campus photograph), then the Korean name. It is
  never presented as a ranking and never implies admission likelihood.
"""

from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdmissionLanguageRule, Institution, Scholarship
from app.models.v27_admissions import KOREAN_TESTS

ENGINE = "v27-fit-1"
_SHARED = json.loads((Path(__file__).resolve().parents[3] / "shared" / "admissions.json").read_text(encoding="utf-8"))
TESTS = {t["code"]: t for t in _SHARED["language_tests"]}
LEVELS = tuple(_SHARED["study_levels"])
GPA_METHOD = _SHARED["gpa_method"]
#: Ordered by *known* disqualifications: none confirmed (MEETS) · none known (CHALLENGE) · one known (ONE_STEP) · more
#: (UNCLEAR). Monotone in the student's scores — a better result can only move a university up.
TIER_ORDER = {"MEETS": 0, "CHALLENGE": 1, "ONE_STEP": 2, "UNCLEAR": 3}
#: Owner-curated featured institutions (the homepage crest rows) — an editorial choice, recorded as one.
_DISCOVERY = Path(__file__).resolve().parents[1] / "data" / "research" / "v27" / "discovery.json"

_TYPES_FOR = {
    "ASSOCIATE": {"JUNIOR_COLLEGE"},
    "BACHELOR": {"UNIVERSITY"},
    "TRANSFER": {"UNIVERSITY"},
    "MASTER": {"UNIVERSITY", "GRADUATE_UNIVERSITY"},
    "DOCTORATE": {"UNIVERSITY", "GRADUATE_UNIVERSITY"},
    "COMBINED": {"UNIVERSITY", "GRADUATE_UNIVERSITY"},
}


def normalise_gpa(value: float | None, scale_max: float | None) -> dict | None:
    """Raw value, its scale and a linear percentage — and the name of the method, which the page shows."""
    if value is None or not scale_max or scale_max <= 0 or value < 0 or value > scale_max:
        return None
    return {"raw_value": value, "scale_max": scale_max, "normalized_percent": round(value / scale_max * 100, 1),
            "normalization_method": GPA_METHOD}


# ----------------------------------------------------------------------------------------------- the snapshot

@dataclass
class Inst:
    id: object
    slug: str
    name_ko: str
    name_en: str | None
    type: str
    region: str
    ieqas: str | None
    language_programme: bool
    card: dict | None
    has_photo: bool
    rules: dict = field(default_factory=lambda: defaultdict(list))  # level -> [rule dict]
    scholarships: list = field(default_factory=list)
    tracks_known: dict = field(default_factory=dict)  # level -> sorted tracks with a verified rule
    english_taught: bool = False


_cache: dict = {"at": 0.0, "data": None}
TTL = 300.0


def invalidate() -> None:
    _cache["at"], _cache["data"] = 0.0, None


def snapshot(db: Session) -> dict:
    """Every active institution with its verified rules and scholarships — a few hundred rows, read in three
    queries and cached for five minutes, so the public endpoint does no per-request scan of the register."""
    now = time.monotonic()
    if _cache["data"] is not None and now - _cache["at"] < TTL:
        return _cache["data"]
    from app.api.v1.directory import _card_content  # the tile's own media slice — one media policy

    insts: dict = {}
    for i in db.scalars(select(Institution).where(Institution.status == "ACTIVE")):
        e = i.enrichment or {}
        intl = e.get("intl") or {}
        insts[i.id] = Inst(
            id=i.id, slug=i.slug, name_ko=i.name_ko, name_en=i.name_en, type=i.institution_type, region=i.region,
            ieqas="EXCELLENT" if i.ieqas_excellent else ("CERTIFIED" if i.ieqas_certified else None),
            language_programme=bool(i.ieqas_language_programme or ((intl.get("korean_language_program") or {}).get("value") is True)),
            card=_card_content(i), has_photo=bool((e.get("media") or {}).get("hero")),
            english_taught=(intl.get("english_taught_degrees") or {}).get("value") is True,
        )
    for r in db.scalars(select(AdmissionLanguageRule).where(AdmissionLanguageRule.verification_status == "CURRENT")):
        inst = insts.get(r.institution_id)
        if inst is None:
            continue
        inst.rules[r.degree_level].append({"track": r.track, "group": r.group_key, "test": r.test, "min": r.min_value,
                                           "min_text": r.min_text, "stage": r.stage, "note": r.note})
    for inst in insts.values():
        inst.tracks_known = {lvl: sorted({x["track"] for x in rs}) for lvl, rs in inst.rules.items()}
    for s in db.scalars(select(Scholarship).where(Scholarship.institution_id.is_not(None), Scholarship.verification_status == "CURRENT")):
        inst = insts.get(s.institution_id)
        if inst is not None:
            inst.scholarships.append({
                "id": str(s.id), "name": s.name, "name_en": s.name_en, "name_native": s.name_native, "name_official_en": s.name_official_en, "name_display_ko": s.name_display_ko, "category": s.category, "stage": s.stage,
                "levels": s.degree_levels or [], "topik_min": s.topik_min, "english_min": s.english_min or {},
                "gpa_min_percent": s.gpa_min_percent, "gpa_text": s.gpa_requirement,
                "waiver_min": s.tuition_waiver_percent_min, "waiver_max": s.tuition_waiver_percent_max,
                "amount_krw": s.amount_krw, "automatic": s.is_automatic,
            })
    featured: list[str] = []
    if _DISCOVERY.exists():
        featured = json.loads(_DISCOVERY.read_text(encoding="utf-8")).get("featured") or []
    data = {"insts": insts, "featured": {slug: n for n, slug in enumerate(featured)}}
    _cache["at"], _cache["data"] = now, data
    return data


# ----------------------------------------------------------------------------------------------- evaluation

def _as_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def relevant(inst: Inst, level: str) -> bool:
    if level == "LANGUAGE":
        return inst.language_programme
    return inst.type in _TYPES_FOR.get(level, set())


def _satisfies(rule: dict, scores: dict[str, float]) -> bool:
    have = scores.get(rule["test"])
    if have is None:
        return False
    return rule["min"] is None or have >= rule["min"]


def _gap(members: list[dict], scores: dict[str, float]) -> float:
    """How far the student is from a route: 0 for a held test short by a little, larger for a test not held at all."""
    best = 99.0
    for r in members:
        if r["test"] not in TESTS:
            continue
        have = scores.get(r["test"])
        need = r["min"] or 0
        span = (TESTS[r["test"]]["max"] - TESTS[r["test"]]["min"]) or 1
        best = min(best, 1.0 + (need / span) if have is None else max(0.0, (need - have) / span))
    return best


def evaluate_rules(rules: list[dict], scores: dict[str, float]) -> dict:
    """Best track for this student (REPORT §361).

    Within one track, rule *groups* are alternative routes — the research records department-specific minimums as
    separate groups ("디자인학부 only", "default for departments not listed", "Department-specific"), and the quick fit
    deliberately asks no major, so the university is open when **any** route is. Inside a group, tests are alternatives.
    A track whose rules all sit at a later stage (ENROLLMENT / GRADUATION) needs no language result to apply."""
    if not rules:
        return {"verified": False}
    tracks = sorted({r["track"] for r in rules})
    named = [t for t in tracks if t != "ANY"] or ["ANY"]
    held = {"KOREAN": any(t in KOREAN_TESTS for t in scores), "ENGLISH": any(t not in KOREAN_TESTS for t in scores)}
    best = None
    for track in named:
        mine = [r for r in rules if r["track"] in (track, "ANY")]
        app = [r for r in mine if r["stage"] == "APPLICATION"]
        later = [r for r in mine if r["stage"] != "APPLICATION" and r["test"] not in ("OTHER", "NONE_REQUIRED")]
        groups: dict[str, list[dict]] = defaultdict(list)
        for r in app:
            groups[r["group"]].append(r)
        state, hit, nearest = "UNMET", None, None
        if not groups:
            state, hit = "NONE_TO_APPLY", None
        else:
            uncheckable = False
            for _g, members in sorted(groups.items()):
                if any(r["test"] == "NONE_REQUIRED" for r in members):
                    state, hit = "NONE_TO_APPLY", None
                    break
                h = next((r for r in members if _satisfies(r, scores)), None)
                if h:
                    state, hit = "MET", h
                    break
                if all(r["test"] == "OTHER" for r in members):
                    uncheckable = True
                elif nearest is None or _gap(members, scores) < _gap(nearest, scores):
                    nearest = members
            if state == "UNMET" and uncheckable:
                state = "UNCHECKABLE"
        rank = {"MET": 0, "NONE_TO_APPLY": 0, "UNCHECKABLE": 1, "UNMET": 2}[state]
        cand = {"verified": True, "track": track, "state": state, "hit": hit, "nearest": nearest, "later": later,
                "_key": (rank, 0 if held.get(track) else 1, 0 if track == "KOREAN" else 1)}
        if best is None or cand["_key"] < best["_key"]:
            best = cand
    return best


def _scholarship_fit(inst: Inst, level: str, scores: dict[str, float], gpa_pct: float | None) -> dict | None:
    """The strongest new-student scheme the known conditions say the student meets, and the best one a single
    language step would open. A condition Hangyul cannot check (free-text GPA rule) never counts as met."""
    rows = [s for s in inst.scholarships if (not s["levels"] or level in s["levels"]) and s["stage"] in (None, "NEW", "BOTH")]
    if not rows:
        return None

    def gaps(s: dict) -> list[dict] | None:
        out = []
        if s["topik_min"] is not None and (scores.get("TOPIK") or 0) < s["topik_min"]:
            out.append({"test": "TOPIK", "min": s["topik_min"]})
        eng = {t: m for t, m in (s["english_min"] or {}).items() if t != "text"}
        if s["english_min"] and not eng:
            return None  # a condition stated in words Hangyul could not parse — unknown, never met
        if eng and not any((scores.get(t) or -1) >= m for t, m in eng.items()):
            out.append({"test": next(iter(eng)), "min": next(iter(eng.values()))})
        if s["gpa_min_percent"] is not None and (gpa_pct is None or gpa_pct < s["gpa_min_percent"]):
            out.append({"gpa_percent": s["gpa_min_percent"]})
        if s["gpa_text"] and s["gpa_min_percent"] is None:
            return None  # unknown — neither met nor a known single gap
        return out

    value = lambda s: (s["waiver_max"] or 0, s["amount_krw"] or 0)  # noqa: E731
    # GKS and foundation awards are competitive selections — a student never "meets" them by holding a score.
    checkable = lambda s: s["category"] not in ("GKS", "FOUNDATION") and bool(s["automatic"] or s["topik_min"] is not None or s["english_min"] or s["gpa_min_percent"] is not None)  # noqa: E731
    # "May qualify" needs a condition Hangyul can actually check (or an automatic award). A scheme whose only
    # condition is a committee's judgement is listed, never offered as something this student meets.
    met = [s for s in rows if checkable(s) and gaps(s) == []]
    one = [(s, g[0]) for s in rows if (g := gaps(s)) is not None and len(g) == 1 and "test" in g[0]]
    best = max(met, key=value) if met else None
    unlock = max(one, key=lambda x: value(x[0])) if one else None
    if unlock and best and value(unlock[0]) <= value(best):
        unlock = None
    pick = lambda s: {"name": s["name"], "name_en": s["name_en"], "name_display_ko": s.get("name_display_ko"), "name_official_en": s.get("name_official_en"), "category": s["category"], "waiver_min": s["waiver_min"],  # noqa: E731
                      "waiver_max": s["waiver_max"], "amount_krw": s["amount_krw"], "automatic": s["automatic"]}
    return {"count": len(rows), "best": pick(best) if best else None,
            "unlock": {**pick(unlock[0]), "needs": unlock[1]} if unlock else None}


def assess(inst: Inst, level: str, scores: dict[str, float], gpa_pct: float | None) -> dict:
    ev = evaluate_rules(inst.rules.get(level, []), scores)
    if not ev["verified"]:
        # A listed Korean-language programme is a different fact from "admission rule not yet verified".
        code = "LANGUAGE_PROGRAMME_LISTED" if level == "LANGUAGE" else "RULES_UNVERIFIED"
        return _finish(inst, level, scores, gpa_pct, ev, "CHALLENGE", {"code": code, "params": {"ieqas": inst.ieqas}})
    later = [{"test": r["test"], "min": r["min_text"] or r["min"]} for r in ev["later"]][:2]
    if ev["state"] == "NONE_TO_APPLY":
        return _finish(inst, level, scores, gpa_pct, ev, "MEETS", {"code": "NO_LANGUAGE_REQUIRED", "params": {"track": ev["track"], "later": later}})
    if ev["state"] == "MET":
        h = ev["hit"]
        return _finish(inst, level, scores, gpa_pct, ev, "MEETS", {"code": "LANGUAGE_MET", "params": {
            "track": ev["track"], "test": h["test"], "need": h["min_text"] or h["min"], "have": scores.get(h["test"])}})
    if ev["state"] == "UNCHECKABLE":
        return _finish(inst, level, scores, gpa_pct, ev, "CHALLENGE", {"code": "LANGUAGE_UNCHECKABLE", "params": {"track": ev["track"]}})
    first = ev["nearest"] or []
    options = [{"test": r["test"], "min": r["min_text"] or r["min"]} for r in first if r["test"] != "OTHER"]
    tier = "UNCLEAR" if _far(first, scores) else "ONE_STEP"
    return _finish(inst, level, scores, gpa_pct, ev, tier, {"code": "LANGUAGE_FAR" if tier == "UNCLEAR" else "LANGUAGE_NEEDED",
                                                           "params": {"track": ev["track"], "options": options}})


def _far(members: list[dict], scores: dict[str, float]) -> bool:
    """UNCLEAR's one meaning (REPORT §361): the student holds a result this route accepts but is far below it — three or
    more levels on a level test (TOPIK, KIIP…), or a quarter or more of the scale on a score test. Holding no result yet
    is one step (one test to take), not "far"."""
    gaps = []
    for r in members:
        d = TESTS.get(r["test"])
        if d is None or r["test"] not in scores or r["min"] is None:
            continue
        short = r["min"] - scores[r["test"]]
        gaps.append(short >= 3 if d["kind"] == "LEVEL" else short >= 0.25 * (d["max"] - d["min"]))
    return bool(gaps) and all(gaps)


def _finish(inst: Inst, level: str, scores: dict, gpa_pct: float | None, ev: dict, tier: str, reason: dict) -> dict:
    schol = _scholarship_fit(inst, level, scores, gpa_pct)
    tracks = [t for t in inst.tracks_known.get(level, []) if t != "ANY"]
    if inst.english_taught and "ENGLISH" not in tracks:
        tracks.append("ENGLISH")
    return {"tier": tier, "reason": reason, "scholarship": schol, "tracks": sorted(tracks), "verified": ev["verified"]}


def priority(inst: Inst, a: dict, featured: dict) -> int:
    """Discovery priority — editorial, from verified facts; deliberately not called a ranking anywhere."""
    p = 0
    if inst.slug in featured:
        p += 40 - min(featured[inst.slug], 30) // 3
    p += 20 if inst.ieqas == "EXCELLENT" else 10 if inst.ieqas == "CERTIFIED" else 0
    if a["verified"] or inst.scholarships:
        p += 10
    if a["scholarship"] and a["scholarship"]["best"]:
        p += 8
    if inst.has_photo:
        p += 5
    return p


def run(db: Session, *, level: str, languages: list[dict], gpa: dict | None, sort: str = "recommended",
        tier: str | None = None, region: str | None = None, offset: int = 0, limit: int = 12) -> dict:
    snap = snapshot(db)
    scores: dict[str, float] = {}
    for x in languages:
        if x["test"] in TESTS and x.get("score") is not None:
            scores[x["test"]] = max(float(x["score"]), scores.get(x["test"], float("-inf")))
    gpa_pct = gpa["normalized_percent"] if gpa else None

    rows = []
    for inst in snap["insts"].values():
        if not relevant(inst, level):
            continue
        a = assess(inst, level, scores, gpa_pct)
        rows.append((inst, a, priority(inst, a, snap["featured"])))
    counts = Counter(a["tier"] for _i, a, _p in rows)
    regions = Counter(i.region for i, _a, _p in rows)
    if region:
        rows = [r for r in rows if r[0].region == region]

    def key(r):
        inst, a, p = r
        if sort == "name":
            return (inst.name_ko,)
        if sort == "region":
            return (inst.region, TIER_ORDER[a["tier"]], -p, inst.name_ko)
        if sort == "scholarship":
            s = a["scholarship"]
            best = (s["best"] or {}).get("waiver_max") or 0 if s else -1
            return (0 if s and s["best"] else 1 if s else 2, -best, TIER_ORDER[a["tier"]], -p, inst.name_ko)
        return (TIER_ORDER[a["tier"]], -p, inst.name_ko)

    rows.sort(key=key)
    item = lambda r: {  # noqa: E731
        "slug": r[0].slug, "name_ko": r[0].name_ko, "name_en": r[0].name_en, "region": r[0].region,
        "institution_type": r[0].type, "ieqas": r[0].ieqas, "featured": r[0].slug in snap["featured"],
        "tier": r[1]["tier"], "reason": r[1]["reason"], "scholarship": r[1]["scholarship"], "tracks": r[1]["tracks"],
        "verified_rules": r[1]["verified"], "enrichment": r[0].card,
    }
    out: dict = {"engine": ENGINE, "level": level, "sort": sort, "gpa": gpa,
                 "languages": [{"test": t, "score": s} for t, s in scores.items()],
                 "counts": {t: counts.get(t, 0) for t in TIER_ORDER}, "total": sum(counts.values()),
                 "regions": dict(regions), "verified_rule_institutions": sum(1 for _i, a, _p in rows if a["verified"])}
    if sort == "recommended" and tier is None:
        out["sections"] = [{"tier": t, "total": sum(1 for r in rows if r[1]["tier"] == t),
                            "items": [item(r) for r in rows if r[1]["tier"] == t][:limit]} for t in TIER_ORDER]
    else:
        pool = [r for r in rows if tier is None or r[1]["tier"] == tier]
        out["items"] = [item(r) for r in pool[offset: offset + limit]]
        out["page_total"] = len(pool)
        out["offset"] = offset
    # The single most useful next step: per test, the score that opens the most ONE_STEP institutions (a higher
    # score opens every lower minimum too). A test the student already holds is preferred — improving it is the
    # nearer step than starting a new one.
    mins: dict[str, list[float]] = defaultdict(list)
    for _i, a, _p in rows:
        if a["tier"] != "ONE_STEP":
            continue
        best_for: dict[str, float] = {}
        for o in a["reason"]["params"]["options"]:
            v = _as_float(o["min"])
            if o["test"] in TESTS and v is not None:
                best_for[o["test"]] = min(v, best_for.get(o["test"], v))
        for t, v in best_for.items():
            mins[t].append(v)
    if mins:
        cands = []
        for t, vals in mins.items():
            if t in scores and max(vals) <= scores[t]:
                continue
            target = max(vals)
            cands.append((t in scores, len(vals), TESTS[t]["common"], -target, t, target))
        if cands:
            _held, n, _common, _neg, t, target = max(cands)
            out["unlock"] = {"test": t, "min": int(target) if float(target).is_integer() else target, "count": n}
    return out
