"""Two-stage, fully explainable matching.

Stage 1 — hard eligibility: degree, prior education, nationality restrictions, language minimums, GPA minimum,
          open intake. A near-miss (small, closable gap) becomes REACH instead of being hidden.
Stage 2 — rank eligible options with weighted, named factors. Every point awarded is listed in `factors`.

No probability of admission is produced. Future predictive models must report sample size, model version,
confidence and data freshness (see docs/ARCHITECTURE.md#matching) before being surfaced.
"""
import json
from dataclasses import dataclass, field
from datetime import date

from app.models import Program, ProgramIntake, Scholarship, StudentProfile, University
from app.models.enums import DegreeLevel, LanguageTest
from app.services.facts import withheld

ENGINE_VERSION = "rules-2026.09"

EDU_RANK = {"HIGH_SCHOOL": 1, "ASSOCIATE": 2, "BACHELOR": 3, "MASTER": 4, "DOCTORATE": 5}
DEFAULT_PRIOR = {
    DegreeLevel.LANGUAGE: None,
    DegreeLevel.ASSOCIATE: "HIGH_SCHOOL",
    DegreeLevel.BACHELOR: "HIGH_SCHOOL",
    DegreeLevel.TRANSFER: "ASSOCIATE",
    DegreeLevel.MASTER: "BACHELOR",
    DegreeLevel.DOCTORATE: "MASTER",
    DegreeLevel.COMBINED: "BACHELOR",
}
WEIGHTS = {"academic": 20, "language": 20, "field": 20, "budget": 15, "scholarship": 10, "location": 5, "housing": 5, "deadline": 5}


@dataclass
class Reason:
    kind: str  # met | missing | warning | info
    code: str
    text: str
    params: dict = field(default_factory=dict)

    def dict(self):
        return {"kind": self.kind, "code": self.code, "text": self.text, "params": self.params}


@dataclass
class MatchResult:
    program_id: str
    intake_id: str | None
    eligible: bool
    tier: str  # STRONG | COMPETITIVE | REACH | NOT_ELIGIBLE
    score: int
    reasons: list[Reason]
    factors: list[dict]
    estimated_annual_cost_krw: int | None
    scholarship_ids: list[str]
    guarantee: dict | None = None

    def dict(self):
        return {
            "program_id": self.program_id,
            "intake_id": self.intake_id,
            "eligible": self.eligible,
            "tier": self.tier,
            "score": self.score,
            "reasons": [r.dict() for r in self.reasons],
            "factors": self.factors,
            "estimated_annual_cost_krw": self.estimated_annual_cost_krw,
            "scholarship_ids": self.scholarship_ids,
            "guarantee": self.guarantee,
            "engine_version": ENGINE_VERSION,
        }


def best_score(profile: StudentProfile, test: LanguageTest, include_planned: bool = False) -> float | None:
    scores = [l.score for l in profile.languages if l.test == test and (include_planned or not l.is_planned)]
    return max(scores) if scores else None


def best_gpa_percent(profile: StudentProfile) -> float | None:
    vals = [e.gpa_percent for e in profile.educations if e.gpa_percent is not None]
    return max(vals) if vals else None


def highest_education(profile: StudentProfile) -> tuple[str | None, bool]:
    """Returns (level, is_expected) — the highest completed or expected qualification."""
    best, expected = None, False
    for e in profile.educations:
        if EDU_RANK.get(e.level, 0) > EDU_RANK.get(best or "", 0):
            best, expected = e.level, e.graduation_status != "GRADUATED"
    return best, expected


def normalize_gpa(value: float, scale_min: float, scale_max: float) -> float:
    """Linear normalization to 0–100. Deliberately simple and auditable; reviewers may override with a note."""
    if scale_max <= scale_min:
        raise ValueError("GPA scale max must be greater than min")
    return round(max(0.0, min(100.0, (value - scale_min) / (scale_max - scale_min) * 100)), 1)


def estimated_annual_cost(program: Program, university: University) -> int | None:
    if program.tuition_per_semester_krw is None:
        return None
    living = (university.est_living_cost_monthly_krw or 0) * 12
    return program.tuition_per_semester_krw * 2 + living


def rule_passes(rule_field: str, op: str, raw_value: str, profile: StudentProfile, program: Program | None) -> bool | None:
    value = json.loads(raw_value)
    actual: object
    if rule_field == "topik_level":
        actual = best_score(profile, LanguageTest.TOPIK)
    elif rule_field == "ielts":
        actual = best_score(profile, LanguageTest.IELTS)
    elif rule_field == "gpa_percent":
        actual = best_gpa_percent(profile)
    elif rule_field == "nationality":
        actual = profile.nationality
    elif rule_field == "degree_level":
        actual = (program.degree_level.value if program else (profile.target_degree.value if profile.target_degree else None))
    elif rule_field == "field":
        actual = program.field if program else None
    else:
        return None
    if actual is None:
        return None
    if op == "gte":
        return actual >= value
    if op == "lte":
        return actual <= value
    if op == "eq":
        return actual == value
    if op == "in":
        return actual in value
    if op == "not_in":
        return actual not in value
    return None


def scholarship_eligibility(s: Scholarship, profile: StudentProfile, program: Program | None = None) -> dict:
    """Returns {status: ELIGIBLE|POSSIBLE|NOT_ELIGIBLE, checks:[...]}. Unknown inputs yield POSSIBLE, never a false yes."""
    checks = []
    status = "ELIGIBLE"
    # Degree level: the program's when known, otherwise the student's target degree (never skip the check).
    level = program.degree_level.value if program else (profile.target_degree.value if profile and profile.target_degree else None)
    if s.degree_levels and level and level not in s.degree_levels:
        return {"status": "NOT_ELIGIBLE", "checks": [{"ok": False, "text": "Not offered for this degree level", "field": "degree_level", "operator": None, "value": None}]}
    for r in s.rules:
        ok = rule_passes(r.field, r.operator, r.value, profile, program)
        # V9 l10n: field/operator/value let the student app show the rule in the reader's language; `text` stays the
        # catalogue wording (English), shown as the exact wording.
        try:
            rv = json.loads(r.value)
        except (TypeError, ValueError):
            rv = r.value
        checks.append({"ok": ok, "text": r.description, "field": r.field, "operator": r.operator, "value": rv})
        if ok is False:
            status = "NOT_ELIGIBLE"
        elif ok is None and status == "ELIGIBLE":
            status = "POSSIBLE"
    return {"status": status, "checks": checks}


def match_program(
    profile: StudentProfile,
    program: Program,
    university: University,
    intakes: list[ProgramIntake],
    scholarships: list[Scholarship],
    has_dorm: bool,
    today: date,
    guarantee_contract=None,
) -> MatchResult:
    reasons: list[Reason] = []
    blockers = 0
    near_miss = 0
    req = program.requirements[0] if program.requirements else None

    # ---------- Stage 1: hard eligibility ----------
    if profile.target_degree and profile.target_degree != program.degree_level:
        reasons.append(Reason("missing", "DEGREE_MISMATCH", f"This is a {program.degree_level.value.lower()} program; you are looking for {profile.target_degree.value.lower()}.",
                              {"program": program.degree_level.value, "target": profile.target_degree.value}))
        blockers += 1

    needed_prior = (req.min_prior_education if req and req.min_prior_education else DEFAULT_PRIOR.get(program.degree_level))
    have, expected = highest_education(profile)
    if needed_prior:
        if have is None:
            reasons.append(Reason("warning", "EDUCATION_UNKNOWN", "Add your education history to confirm academic eligibility."))
            near_miss += 1
        elif EDU_RANK.get(have, 0) >= EDU_RANK[needed_prior]:
            if expected:
                reasons.append(Reason("warning", "EDUCATION_EXPECTED", "Eligible if you graduate before the semester starts.", {"level": have}))
            else:
                reasons.append(Reason("met", "EDUCATION_MET", "Meets the academic entry requirement.", {"level": have}))
        else:
            reasons.append(Reason("missing", "EDUCATION_BELOW", f"Requires a completed {needed_prior.replace('_', ' ').lower()} qualification.", {"required": needed_prior}))
            blockers += 1

    if req and req.excluded_nationalities and profile.nationality in req.excluded_nationalities:
        reasons.append(Reason("missing", "NATIONALITY_RESTRICTED", "This program is not open to applicants of your nationality."))
        blockers += 1

    topik = best_score(profile, LanguageTest.TOPIK)
    ielts = best_score(profile, LanguageTest.IELTS)
    toefl = best_score(profile, LanguageTest.TOEFL_IBT)
    lang_points = 0.0
    if req:
        korean_ok = req.min_topik_level is None or (topik is not None and topik >= req.min_topik_level)
        english_req = req.min_ielts is not None or req.min_toefl_ibt is not None
        english_ok = (req.min_ielts is not None and ielts is not None and ielts >= req.min_ielts) or (
            req.min_toefl_ibt is not None and toefl is not None and toefl >= req.min_toefl_ibt
        )
        if req.min_topik_level is not None and english_req and req.language_alternative:
            lang_ok = korean_ok or english_ok
        elif req.min_topik_level is not None:
            lang_ok = korean_ok
        elif english_req:
            lang_ok = english_ok
        else:
            lang_ok = True
        if lang_ok:
            if req.min_topik_level is not None and topik is not None and topik >= req.min_topik_level:
                margin = topik - req.min_topik_level
                reasons.append(Reason("met", "TOPIK_MET" if margin == 0 else "TOPIK_EXCEEDS", f"TOPIK {int(topik)} {'meets' if margin == 0 else 'exceeds'} the minimum (level {req.min_topik_level}).",
                                      {"have": int(topik), "min": req.min_topik_level}))
                lang_points = min(1.0, 0.7 + 0.15 * margin)
            elif english_ok:
                reasons.append(Reason("met", "ENGLISH_MET", "Your English test score meets the requirement.",
                                      {"ielts": ielts, "toefl": toefl, "min_ielts": req.min_ielts, "min_toefl": req.min_toefl_ibt}))
                lang_points = 0.85
            else:
                lang_points = 1.0
        else:
            planned_topik = best_score(profile, LanguageTest.TOPIK, include_planned=True)
            gap_topik = (req.min_topik_level - (topik or 0)) if req.min_topik_level is not None else 99
            gap_ielts = (req.min_ielts - (ielts or 0)) if req.min_ielts is not None else 99
            if gap_topik <= 1 or gap_ielts <= 0.5 or (planned_topik and req.min_topik_level and planned_topik >= req.min_topik_level):
                reasons.append(Reason("missing", "LANGUAGE_GAP_SMALL", "Your language score is just below the minimum — a retake could qualify you.",
                                      {"min_topik": req.min_topik_level, "min_ielts": req.min_ielts, "have_topik": topik, "have_ielts": ielts}))
                near_miss += 1
            else:
                reasons.append(Reason("missing", "LANGUAGE_BELOW", "Language requirement not met yet.",
                                      {"min_topik": req.min_topik_level, "min_ielts": req.min_ielts, "min_toefl": req.min_toefl_ibt,
                                       "have_topik": topik, "have_ielts": ielts}))
                blockers += 1
    else:
        lang_points = 0.8
        reasons.append(Reason("info", "LANGUAGE_NOT_PUBLISHED", "No language minimum is published for this program — confirm with the university."))

    gpa = best_gpa_percent(profile)
    academic_points = 0.6
    if req and req.min_gpa_percent is not None:
        if gpa is None:
            reasons.append(Reason("warning", "GPA_UNKNOWN", "Add your GPA to check the academic minimum."))
        elif gpa >= req.min_gpa_percent:
            margin = gpa - req.min_gpa_percent
            academic_points = min(1.0, 0.7 + margin / 50)
            reasons.append(Reason("met", "GPA_MET", "Meets the academic requirement.", {"have": gpa, "min": req.min_gpa_percent}))
        elif req.min_gpa_percent - gpa <= 5:
            reasons.append(Reason("missing", "GPA_SLIGHTLY_BELOW", "Your GPA is slightly below the published minimum.", {"have": gpa, "min": req.min_gpa_percent}))
            near_miss += 1
            academic_points = 0.3
        else:
            reasons.append(Reason("missing", "GPA_BELOW", "GPA is below the published minimum.", {"have": gpa, "min": req.min_gpa_percent}))
            blockers += 1
    elif gpa is not None:
        academic_points = min(1.0, gpa / 100 + 0.1)

    open_intakes = sorted([i for i in intakes if i.is_open and i.application_deadline >= today], key=lambda i: i.application_deadline)
    if profile.target_intake_year and profile.target_intake_term:
        preferred = [i for i in open_intakes if i.year == profile.target_intake_year and i.term == profile.target_intake_term]
        open_intakes = preferred or open_intakes
    intake = open_intakes[0] if open_intakes else None
    deadline_points = 0.0
    if intake is None:
        reasons.append(Reason("missing", "NO_OPEN_INTAKE", "No open intake right now — save it to be notified when applications open."))
        blockers += 1
    else:
        days = (intake.application_deadline - today).days
        if days >= 45:
            deadline_points = 1.0
            reasons.append(Reason("met", "DEADLINE_FEASIBLE", "Enough time to complete your documents before the deadline.",
                                  {"deadline": intake.application_deadline.isoformat(), "days": days}))
        elif days >= 14:
            deadline_points = 0.5
            reasons.append(Reason("warning", "DEADLINE_SOON", f"Deadline in {days} days — start now.", {"deadline": intake.application_deadline.isoformat(), "days": days}))
        else:
            deadline_points = 0.1
            reasons.append(Reason("warning", "DEADLINE_VERY_SOON", f"Only {days} days left before the deadline.", {"deadline": intake.application_deadline.isoformat(), "days": days}))

    # ---------- Stage 2: preference fit ----------
    factors = []

    def add(key: str, ratio: float, note: str):
        pts = round(WEIGHTS[key] * max(0.0, min(1.0, ratio)), 1)
        factors.append({"factor": key, "weight": WEIGHTS[key], "points": pts, "note": note})

    add("academic", academic_points, "GPA margin over minimum")
    add("language", lang_points, "Language score margin")

    desired = set(profile.desired_fields or [])
    field_ratio = 1.0 if program.field in desired else (0.4 if not desired else 0.1)
    if program.field in desired:
        reasons.append(Reason("met", "FIELD_MATCH", "Matches the field you want to study.", {"field": program.field}))
    add("field", field_ratio, "Program field vs your interests")

    cost = estimated_annual_cost(program, university)
    budget_ratio = 0.5
    if cost and profile.annual_budget_krw:
        if cost <= profile.annual_budget_krw:
            budget_ratio = 1.0
            reasons.append(Reason("met", "WITHIN_BUDGET", "Estimated yearly cost is within your budget.", {"cost": cost, "budget": profile.annual_budget_krw}))
        elif cost <= profile.annual_budget_krw * 1.15:
            budget_ratio = 0.5
            reasons.append(Reason("warning", "SLIGHTLY_OVER_BUDGET", "Slightly above your budget — scholarships could close the gap.", {"cost": cost, "budget": profile.annual_budget_krw}))
        else:
            budget_ratio = 0.1
            reasons.append(Reason("warning", "OVER_BUDGET", "Estimated yearly cost is above your budget.", {"cost": cost, "budget": profile.annual_budget_krw}))
    add("budget", budget_ratio, "Estimated annual cost (tuition × 2 + living × 12) vs budget")

    eligible_sch = []
    for s in scholarships:
        res = scholarship_eligibility(s, profile, program)
        if res["status"] != "NOT_ELIGIBLE":
            eligible_sch.append(str(s.id))
    if eligible_sch:
        reasons.append(Reason("met", "SCHOLARSHIP_CANDIDATE", "You may qualify for a scholarship here.", {"count": len(eligible_sch)}))
    add("scholarship", 1.0 if eligible_sch else (0.0 if profile.needs_scholarship else 0.5), "Scholarship candidacy")

    regions = set(profile.preferred_regions or [])
    loc = 1.0 if university.region in regions else (0.5 if not regions else 0.0)
    if university.region in regions:
        reasons.append(Reason("met", "PREFERRED_REGION", "In your preferred region.", {"region": university.region}))
    add("location", loc, "Region preference")

    if profile.housing_preference == "DORM":
        add("housing", 1.0 if has_dorm else 0.0, "Dormitory availability")
        if has_dorm:
            reasons.append(Reason("met", "DORM_AVAILABLE", "On-campus dormitory available for international students."))
    else:
        add("housing", 0.6, "No housing preference")
    add("deadline", deadline_points, "Time left before deadline")

    score = int(round(sum(f["points"] for f in factors)))
    if blockers:
        tier = "NOT_ELIGIBLE"
    elif near_miss:
        tier = "REACH"
    elif score >= 72:
        tier = "STRONG"
    else:
        tier = "COMPETITIVE"

    guarantee = None
    if guarantee_contract is not None and tier in ("STRONG", "COMPETITIVE"):
        crit = guarantee_contract.guarantee_criteria or {}
        ok = True
        if crit.get("min_topik") is not None and (topik or 0) < crit["min_topik"]:
            ok = False
        if crit.get("min_gpa_percent") is not None and (gpa or 0) < crit["min_gpa_percent"]:
            ok = False
        if crit.get("degree_levels") and program.degree_level.value not in crit["degree_levels"]:
            ok = False
        quota_left = sum(q.seats - q.used for q in guarantee_contract.quotas if q.program_id in (None, program.id))
        if ok and quota_left > 0:
            guarantee = {"contract_id": str(guarantee_contract.id), "terms": guarantee_contract.guarantee_terms, "seats_left": quota_left}

    return MatchResult(
        program_id=str(program.id),
        intake_id=str(intake.id) if intake else None,
        eligible=blockers == 0,
        tier=tier,
        score=score,
        reasons=reasons,
        factors=factors,
        estimated_annual_cost_krw=cost,
        scholarship_ids=eligible_sch,
        guarantee=guarantee,
    )


# ================================================================================================ V9 S1: routes, not a dead end
def transient_profile(nationality: str, degree: DegreeLevel, lang_kind: str | None = None, level: float | None = None):
    """Duck-typed stand-in for StudentProfile (never attached to a session). Assumes the prior qualification the degree
    normally requires; GPA unknown (a warning, never a blocker)."""
    from types import SimpleNamespace

    test_of = {"TOPIK": LanguageTest.TOPIK, "IELTS": LanguageTest.IELTS, "TOEFL_IBT": LanguageTest.TOEFL_IBT}
    prior = DEFAULT_PRIOR.get(degree) or "HIGH_SCHOOL"
    languages = []
    if lang_kind in test_of and level is not None:
        languages.append(SimpleNamespace(test=test_of[lang_kind], score=float(level), is_planned=False))
    return SimpleNamespace(
        nationality=(nationality or "").upper(), target_degree=degree, target_intake_year=None, target_intake_term=None, languages=languages,
        educations=[SimpleNamespace(level=prior, graduation_status="GRADUATED", gpa_percent=None)],
        desired_fields=[], preferred_regions=[], annual_budget_krw=None, needs_scholarship=None, housing_preference=None,
    )


def _catalogue(db):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models import Dormitory, Scholarship

    programs = db.scalars(select(Program).where(Program.is_active.is_(True)).options(selectinload(Program.requirements), selectinload(Program.intakes))).all()
    unis = {u.id: u for u in db.scalars(select(University))}
    schol: dict = {}
    for s in db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))):
        schol.setdefault(s.university_id, []).append(s)
    dorms: dict = {}
    for d in db.scalars(select(Dormitory)):
        dorms.setdefault(d.university_id, []).append(d)
    return programs, unis, schol, dorms


def _open_ids(profile, programs, unis, schol, dorms, today: date) -> set:
    """Programs whose published basic requirements are met with an open intake (engine STRONG/COMPETITIVE)."""
    out = set()
    for p in programs:
        u = unis[p.university_id]
        m = match_program(profile, p, u, p.intakes, schol.get(u.id, []) + schol.get(None, []), u.id in dorms, today)
        if m.tier in ("STRONG", "COMPETITIVE"):
            out.add(p.id)
    return out


def _accepts_english(p: Program) -> tuple[float | None, int | None] | None:
    req = p.requirements[0] if p.requirements else None
    if not req or (req.min_ielts is None and req.min_toefl_ibt is None):
        return None
    if req.min_topik_level is not None and not req.language_alternative:
        return None
    return req.min_ielts, req.min_toefl_ibt


def language_routes(db, nationality: str, degree: DegreeLevel, *, kind: str | None = None, level: float | None = None,
                    today: date | None = None, catalogue=None) -> dict | None:
    """The realistic routes when language blocks the chosen degree (REPORT §58 S1). Counts come from the published
    requirements in the catalogue through the same engine; nothing here is an offer or a probability.

    Returns None when language is not what blocks the student (a language-program seeker, or a student whose test
    already opens programs at this degree).
    """
    from app.services.budget import first_year_range

    today = today or date.today()
    if degree is None or degree == DegreeLevel.LANGUAGE:
        return None
    programs, unis, schol, dorms = catalogue or _catalogue(db)
    target = [p for p in programs if p.degree_level == degree]
    if not target:
        return None
    me = transient_profile(nationality, degree, kind, level)
    open_now = _open_ids(me, target, unis, schol, dorms, today)
    # Programs at this degree blocked only by language (no other missing requirement).
    blocked = 0
    for p in target:
        if p.id in open_now:
            continue
        u = unis[p.university_id]
        m = match_program(me, p, u, p.intakes, [], False, today)
        missing = {r.code for r in m.reasons if r.kind == "missing"}
        if missing and missing <= {"LANGUAGE_BELOW", "LANGUAGE_GAP_SMALL"}:
            blocked += 1
    if blocked == 0 or open_now:
        # Language does not block a student who can already apply somewhere at this degree.
        return None

    # (c) the smallest test step that opens the most: TOPIK and IELTS ladders from the student's current level.
    def ladder(test: str) -> dict | None:
        if test == "TOPIK":
            start = int(level) + 1 if kind == "TOPIK" and level is not None else 1
            cands = [float(x) for x in range(start, 7)]
        else:
            start = (level or 0) + 0.5 if kind == "IELTS" else 4.0
            cands = [x / 2 for x in range(int(start * 2), 19)]
        for c in cands:
            extra = _open_ids(transient_profile(nationality, degree, test, c), target, unis, schol, dorms, today) - open_now
            if extra:
                return {"kind": test, "level": int(c) if test == "TOPIK" else c, "count": len(extra)}
        return None

    topik_step = ladder("TOPIK") if kind != "TOPIK" or (level or 0) < 6 else None
    ielts_step = ladder("IELTS")
    steps = [s for s in (topik_step, ielts_step) if s]
    best = max(steps, key=lambda s: s["count"]) if steps else None

    # (a) Korean language program first: language programs that accept the student today (no test needed).
    lang_progs = [p for p in programs if p.degree_level == DegreeLevel.LANGUAGE]
    lang_me = transient_profile(nationality, DegreeLevel.LANGUAGE, kind, level)
    lang_open = [p for p in lang_progs if p.id in _open_ids(lang_me, lang_progs, unis, schol, dorms, today)]
    korean = None
    if lang_open:
        ranges = [first_year_range(p, unis[p.university_id], dorms.get(p.university_id, [])) for p in lang_open]
        lows = [r["low"] for r in ranges if r["low"] is not None]
        highs = [r["high"] for r in ranges if r["high"] is not None]
        sems = sorted({p.duration_semesters for p in lang_open if p.duration_semesters})
        tuition = sorted(p.tuition_per_semester_krw for p in lang_open if p.tuition_per_semester_krw)
        sample = sorted(lang_open, key=lambda p: (p.tuition_per_semester_krw or 10**12))[:3]
        korean = {
            "count": len(lang_open),
            "term_semesters": sems[0] if len(sems) == 1 else None,
            "term_semesters_range": [sems[0], sems[-1]] if sems else None,
            "tuition_per_term_min": tuition[0] if tuition else None, "tuition_per_term_max": tuition[-1] if tuition else None,
            "year_cost_min": min(lows) if lows else None, "year_cost_max": max(highs) if highs else None,
            "year_cost_basis": "SAMPLE" if any(r["basis"] == "SAMPLE" for r in ranges) else "ESTIMATE",
            "visa_from": "D-4-1", "visa_to": "D-2",
            "opens_at": topik_step,  # degree programs that open at the smallest unlocking TOPIK level
            "programs": [{"program_id": str(p.id), "program_name": p.name_en, "university_name": unis[p.university_id].name_en,
                          "university_slug": unis[p.university_id].slug, "city": unis[p.university_id].city,
                          "tuition_per_term": None if withheld(p) else p.tuition_per_semester_krw} for p in sample],
        }

    # (b) English-taught: degree programs at this level that accept an English test, and the level they ask for.
    eng = [(p, _accepts_english(p)) for p in target]
    eng = [(p, e) for p, e in eng if e]
    english = None
    if eng:
        levels: dict = {}
        for _p, (ielts, toefl) in eng:
            k = (ielts, toefl)
            levels[k] = levels.get(k, 0) + 1
        by_level = sorted(({"ielts": k[0], "toefl_ibt": k[1], "count": v} for k, v in levels.items()), key=lambda x: (x["ielts"] or 99))
        english = {"count": len(eng), "ielts_from": min((e[0] for _p, e in eng if e[0] is not None), default=None),
                   "toefl_from": min((e[1] for _p, e in eng if e[1] is not None), default=None), "by_level": by_level}

    return {"blocked_count": blocked, "open_now": len(open_now), "korean_first": korean, "english": english,
            "smallest_step": best, "steps": steps, "degree": degree.value, "not_an_offer": True, "engine_version": ENGINE_VERSION}
