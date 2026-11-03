"""Anonymous, no-account endpoints used by the marketing site and the first screens of the student apps.

Quick eligibility answers "which listed programs could I realistically apply to?" from three answers
(nationality, target degree, language qualification). It runs the same explainable rules engine as signed-in
matching on a transient, in-memory profile: nothing is stored and no personal data is kept.
"""
import time
from collections import defaultdict, deque
from datetime import date
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.audit import track
from app.core.db import get_db
from app.models import Dormitory, Program, Scholarship, ServiceProduct, University
from app.models.enums import DegreeLevel, LanguageTest
from app.services.matching import DEFAULT_PRIOR, ENGINE_VERSION, _catalogue, estimated_annual_cost, language_routes, match_program

router = APIRouter(prefix="/public", tags=["public"])

# Anonymous checks carry no preferences (budget, field, region), so the engine's STRONG/COMPETITIVE split — which is
# driven by preference fit — is meaningless here. Student-facing meaning:
#   STRONG   = meets every published basic requirement and an intake is open
#   POSSIBLE = one closable gap (e.g. one TOPIK level short)  — engine REACH
#   NOT_YET  = a published requirement is not met / no open intake
TIER_MAP = {"STRONG": "STRONG", "COMPETITIVE": "STRONG", "REACH": "POSSIBLE", "NOT_ELIGIBLE": "NOT_YET"}
DEGREES = [DegreeLevel.LANGUAGE, DegreeLevel.ASSOCIATE, DegreeLevel.BACHELOR, DegreeLevel.TRANSFER, DegreeLevel.MASTER, DegreeLevel.DOCTORATE]
TEST_OF = {"TOPIK": LanguageTest.TOPIK, "IELTS": LanguageTest.IELTS, "TOEFL_IBT": LanguageTest.TOEFL_IBT}
LIMITS = {"TOPIK": (1, 6), "IELTS": (1, 9), "TOEFL_IBT": (0, 120)}

# ---------- light, per-process rate limit (anonymous endpoint) ----------
RATE_LIMIT = 30  # requests
RATE_WINDOW = 60.0  # seconds
_hits: dict[str, deque] = defaultdict(deque)


def rate_limited(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(429, "Too many checks in a short time. Please wait a minute and try again.")
    q.append(now)


class LanguageIn(BaseModel):
    kind: str = Field(pattern="^(TOPIK|IELTS|TOEFL_IBT|NONE|PREPARING)$")
    level: float | None = None

    @field_validator("level")
    @classmethod
    def _non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("level must be positive")
        return v


class QuickIn(BaseModel):
    nationality: str = Field(min_length=2, max_length=2)
    degree: DegreeLevel
    language: LanguageIn


def transient_profile(nationality: str, degree: DegreeLevel, lang_kind: str, level: float | None) -> SimpleNamespace:
    """Duck-typed stand-in for StudentProfile. Never attached to a DB session.

    We assume the applicant will hold the prior qualification the degree normally requires (stated in the UI);
    GPA is unknown, which the engine reports as a warning rather than a blocker.
    """
    prior = DEFAULT_PRIOR.get(degree) or "HIGH_SCHOOL"
    languages = []
    if lang_kind in TEST_OF and level is not None:
        languages.append(SimpleNamespace(test=TEST_OF[lang_kind], score=float(level), is_planned=False))
    return SimpleNamespace(
        nationality=nationality.upper(), target_degree=degree, target_intake_year=None, target_intake_term=None,
        languages=languages,
        educations=[SimpleNamespace(level=prior, graduation_status="GRADUATED", gpa_percent=None)],
        desired_fields=[], preferred_regions=[], annual_budget_krw=None, needs_scholarship=None, housing_preference=None,
    )


def _load(db: Session, degree: DegreeLevel):
    programs = db.scalars(select(Program).where(Program.is_active.is_(True), Program.degree_level == degree).options(
        selectinload(Program.requirements), selectinload(Program.intakes))).all()
    unis = {u.id: u for u in db.scalars(select(University))}
    schol: dict = {}
    for s in db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))):
        schol.setdefault(s.university_id, []).append(s)
    dorm_unis = set(db.scalars(select(Dormitory.university_id)))
    return programs, unis, schol, dorm_unis


def _run(profile, programs, unis, schol, dorm_unis, today: date) -> list[dict]:
    out = []
    for prog in programs:
        u = unis[prog.university_id]
        m = match_program(profile, prog, u, prog.intakes, schol.get(u.id, []) + schol.get(None, []), u.id in dorm_unis, today)
        out.append({"m": m, "prog": prog, "uni": u})
    return out


def _passing(rows: list[dict]) -> set:
    return {r["prog"].id for r in rows if TIER_MAP[r["m"].tier] == "STRONG"}


def _headline_reason(m) -> tuple[str, str]:
    order = {"missing": 0, "warning": 1, "met": 2, "info": 3}
    if m.tier in ("REACH", "NOT_ELIGIBLE"):
        r = next((r for r in m.reasons if r.kind == "missing"), None)
    else:
        r = next((r for code in ("TOPIK_MET", "TOPIK_EXCEEDS", "ENGLISH_MET", "EDUCATION_MET") for r in m.reasons if r.code == code), None)
    r = r or sorted(m.reasons, key=lambda x: order.get(x.kind, 9))[0] if m.reasons else None
    return (r.text, r.code) if r else ("", "")


@router.get("/quick-eligibility/options")
def quick_options():
    return {
        "degrees": [d.value for d in DEGREES],
        "language_kinds": ["TOPIK", "IELTS", "TOEFL_IBT", "NONE", "PREPARING"],
        "limits": {k: {"min": a, "max": b} for k, (a, b) in LIMITS.items()},
    }


@router.post("/quick-eligibility", dependencies=[Depends(rate_limited)])
def quick_eligibility(body: QuickIn, db: Session = Depends(get_db)):
    kind, level = body.language.kind, body.language.level
    if kind in LIMITS:
        lo, hi = LIMITS[kind]
        if level is None or not (lo <= level <= hi):
            raise HTTPException(422, f"{kind} level must be between {lo} and {hi}.")
    today = date.today()
    programs, unis, schol, dorm_unis = _load(db, body.degree)
    rows = _run(transient_profile(body.nationality, body.degree, kind, level), programs, unis, schol, dorm_unis, today)

    tiers = [TIER_MAP[r["m"].tier] for r in rows]
    open_ids = {r["prog"].id for r in rows if r["m"].intake_id}
    base = _passing(rows)

    # What would a better score unlock? Smallest next level that adds programs (TOPIK by default; IELTS for English-test takers).
    unlock = None
    test = "IELTS" if kind in ("IELTS", "TOEFL_IBT") else "TOPIK"
    if test == "TOPIK":
        start = int(level) + 1 if kind == "TOPIK" and level is not None else 1
        candidates = [float(x) for x in range(start, 7)]
    else:
        start = (level or 0) + 0.5 if kind == "IELTS" else 5.0
        candidates = [x / 2 for x in range(int(start * 2), 19)]
    for cand in candidates:
        extra = _passing(_run(transient_profile(body.nationality, body.degree, test, cand), programs, unis, schol, dorm_unis, today)) - base
        if extra:
            unlock = {"kind": test, "level": int(cand) if test == "TOPIK" else cand, "additional_count": len(extra)}
            break

    rank = {"STRONG": 0, "POSSIBLE": 1, "NOT_YET": 2}
    ordered = sorted(rows, key=lambda r: (rank[TIER_MAP[r["m"].tier]], -r["m"].score))
    # Best first, one program per university before repeating a university (a more useful preview).
    picked, seen = [], set()
    for r in ordered:
        if r["uni"].id not in seen:
            picked.append(r)
            seen.add(r["uni"].id)
        if len(picked) == 6:
            break
    for r in ordered:
        if len(picked) == 6:
            break
        if r not in picked:
            picked.append(r)
    picked.sort(key=lambda r: (rank[TIER_MAP[r["m"].tier]], -r["m"].score))
    sample = []
    for r in picked:
        m, prog, u = r["m"], r["prog"], r["uni"]
        intake = next((i for i in prog.intakes if str(i.id) == m.intake_id), None)
        text, code = _headline_reason(m)
        sample.append({
            "program_id": str(prog.id), "program_name": prog.name_en, "university_name": u.name_en, "university_slug": u.slug,
            "city": u.city, "degree_level": prog.degree_level.value, "tier": TIER_MAP[m.tier],
            "yearly_cost_krw": estimated_annual_cost(prog, u), "deadline": intake.application_deadline.isoformat() if intake else None,
            "reason": text, "reason_code": code,
        })

    statuses = {getattr(r["prog"], "verification_status", "DEMO") for r in rows}
    if statuses <= {"DEMO"}:
        dq = {"status": "SAMPLE", "note": "Program requirements, costs and dates in this preview are sample data, not verified university information."}
    elif "DEMO" in statuses:
        dq = {"status": "MIXED", "note": "Some programs use sample data; verified entries show their source and date on the program page."}
    else:
        dq = {"status": "VERIFIED", "note": "Every program shown is checked against the university's published requirements, with a verification date."}

    # V9 S1: when language blocks the chosen degree, the realistic routes from the catalogue (never a dead end).
    routes = language_routes(db, body.nationality, body.degree, kind=kind, level=level, today=today, catalogue=_catalogue(db))

    # Conversion analytics: anonymous (no user, no IP); only the answers' categories and the outcome.
    track(db, "quick_eligibility_completed", nationality=body.nationality,
          properties={"degree": body.degree.value if hasattr(body.degree, "value") else body.degree, "language": body.language.kind,
                      "meets": tiers.count("STRONG"), "possible": tiers.count("POSSIBLE")})
    db.commit()
    return {
        "engine_version": ENGINE_VERSION,
        "total_open": len(open_ids),
        "meets_count": tiers.count("STRONG"),
        "possible_count": tiers.count("POSSIBLE"),
        "not_yet_count": tiers.count("NOT_YET"),
        "unlock": unlock,
        "sample": sample,
        "data_quality": dq,
        "routes": routes,
    }


# V9 S3: the public sponsor view (no login) is mounted on the public router: GET /public/sponsor/{token}.
from app.api.v1 import sponsor as _sponsor  # noqa: E402

router.include_router(_sponsor.public_router)


# ------------------------------------------------------------------------------ the public plan catalogue

@router.get("/plans")
def plans(db: Session = Depends(get_db)):
    """The three retail plans, for anyone — no account, no personal data, nothing tracked.

    The marketing site renders its pricing section from the shared manifest rather than from this endpoint,
    because a public page has to paint when the API is down (the same rule the directory follows). This
    exists so that the price a signed-out visitor could fetch, the price the student app shows after login
    and the price the seed wrote are provably the same number — which is what ``npm run qa:pricing`` checks.

    Deliberately **not** here: anything about who is asking. There is no regional pricing to resolve and no
    reason for an anonymous request to carry a country.
    """
    out = []
    for prod in db.scalars(
        select(ServiceProduct).where(ServiceProduct.is_active.is_(True)).order_by(ServiceProduct.sort_order)
        .options(selectinload(ServiceProduct.prices))
    ):
        price = next((p for p in prod.prices if p.country_code is None), None)
        out.append({
            "code": prod.code,
            "name_ko": prod.name_ko or prod.name_en,
            "name_en": prod.name_en,
            "features": prod.features,
            "entitlements": prod.entitlements or {},
            "recommended": prod.is_recommended,
            "sort_order": prod.sort_order,
            "price": {"currency": price.currency, "amount_minor": price.amount_minor, "is_demo": price.is_demo} if price else None,
        })
    # V29: the catalogue version and the add-on catalogue travel with the plans, so `qa:plans-v29` / `qa:addons-v29` can
    # prove the API sells exactly what the manifest says. Ranges are recommendations, never a charge.
    from app.services import addons as addons_svc
    from app.services import entitlements as ent_svc

    return {"plans": out, "catalog": ent_svc.manifest()["catalog"], "add_ons": addons_svc.catalogue()}


# ------------------------------------------------------------------------------ V27: the quick fit over the directory

from app.services import fit as _fit  # noqa: E402

_LEVEL_PATTERN = "^(" + "|".join(_fit.LEVELS) + ")$"


class FitLanguageIn(BaseModel):
    test: str = Field(max_length=24)
    score: float

    @field_validator("test")
    @classmethod
    def _known(cls, v):
        if v not in _fit.TESTS:
            raise ValueError("unknown test")
        return v


class FitGpaIn(BaseModel):
    value: float = Field(ge=0)
    scale_max: float = Field(gt=0, le=1000)


class FitIn(BaseModel):
    nationality: str = Field(min_length=2, max_length=2)
    level: str = Field(pattern=_LEVEL_PATTERN)
    gpa: FitGpaIn | None = None
    #: Empty = "I don't have one yet". At most one entry per test.
    languages: list[FitLanguageIn] = Field(default_factory=list, max_length=6)
    sort: str = Field("recommended", pattern="^(recommended|scholarship|region|name)$")
    tier: str | None = Field(None, pattern="^(MEETS|ONE_STEP|CHALLENGE|UNCLEAR)$")
    region: str | None = Field(None, max_length=32)
    offset: int = Field(0, ge=0, le=1000)
    limit: int = Field(12, ge=1, le=48)


_fit_hits: dict[str, deque] = defaultdict(deque)
FIT_RATE_LIMIT = 90  # a person paging "더 보기" through ~260 rows and re-sorting stays well inside this


def fit_rate_limited(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _fit_hits[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= FIT_RATE_LIMIT:
        raise HTTPException(429, {"code": "FIT_RATE_LIMITED", "retry_after": int(RATE_WINDOW)})
    q.append(now)


@router.post("/fit", dependencies=[Depends(fit_rate_limited)])
def quick_fit(body: FitIn, db: Session = Depends(get_db)):
    """Every relevant institution in four honest groups (V27, REPORT §356). No probability, no ranking."""
    for x in body.languages:
        d = _fit.TESTS[x.test]
        if not (d["min"] <= x.score <= d["max"]):
            raise HTTPException(422, {"code": "SCORE_OUT_OF_RANGE", "test": x.test, "min": d["min"], "max": d["max"]})
    gpa = None
    if body.gpa is not None:
        gpa = _fit.normalise_gpa(body.gpa.value, body.gpa.scale_max)
        if gpa is None:
            raise HTTPException(422, {"code": "GPA_OUT_OF_RANGE", "max": body.gpa.scale_max})
    out = _fit.run(db, level=body.level, languages=[x.model_dump() for x in body.languages], gpa=gpa, sort=body.sort,
                   tier=body.tier, region=body.region, offset=body.offset, limit=body.limit)
    if body.offset == 0 and body.tier is None:
        track(db, "quick_fit_completed", nationality=body.nationality.upper(),
              properties={"level": body.level, "tests": sorted(x.test for x in body.languages), "gpa": gpa is not None,
                          "counts": out["counts"]})
        db.commit()
    return out
