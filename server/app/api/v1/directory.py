"""The public Korean university directory (V12, REPORT §85–86).

Answers one question — *what kinds of universities can I study at in Korea?* — and refuses to answer the one the
old public catalogue answered, *which intake row should you apply to?*. So every response here is institution
level: name, region, kind, who runs it, whether it holds an international-education certification, where its own
website is. There is no tuition, no deadline, no requirement, no match and no partnership in this module, because
none of those belong on a page somebody reads before they have decided they want to come to Korea at all.

Programme-level preparation lives behind authentication, in ``catalog.py`` and the student platform.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, case, func, literal_column, or_, select
from sqlalchemy.orm import Session

from app.api.common import Page, iso, paginate
from app.core.db import get_db
from app.models import Institution
from app.models.catalog import Program, ProgramIntake

router = APIRouter(tags=["directory"], prefix="/directory")

#: Korea's seventeen 광역자치단체, in the order the public map draws them (capital region first, then the
#: metropolitan cities, then the provinces). The region keys are the registry's own, via the importer.
REGIONS: list[str] = [
    "Seoul", "Gyeonggi", "Incheon",
    "Busan", "Daegu", "Daejeon", "Gwangju", "Ulsan", "Sejong",
    "Gangwon", "Chungbuk", "Chungnam", "Jeonbuk", "Jeonnam", "Gyeongbuk", "Gyeongnam", "Jeju",
]
INSTITUTION_TYPES = ("UNIVERSITY", "JUNIOR_COLLEGE", "GRADUATE_UNIVERSITY")

#: Reading order for a mixed list: a prospective undergraduate wants the universities first.
TYPE_ORDER = case(
    {kind: rank for rank, kind in enumerate(INSTITUTION_TYPES)},
    value=Institution.institution_type,
    else_=len(INSTITUTION_TYPES),
)


def _active() -> Select:
    """Only institutions the registry currently lists. A withdrawn one is never browsable."""
    return select(Institution).where(Institution.status == "ACTIVE")


#: V20 — the slice of the content record a *result* needs, and nothing more (REPORT §216.3).
#:
#: The directory serves 24 rows at a time and the full record carries the philosophy, the official
#: destinations, the coordinates and the provenance of every value — tens of kilobytes a row that a tile
#: cannot draw. These four fields are what `resolveUniversityVisual` reads to pick one of the four
#: visual tiers, so the card can be as specific as the detail page without the page weighing as much.
def _card_content(i: Institution) -> dict | None:
    e = i.enrichment or {}
    out: dict = {}
    if e.get("logo"):
        out["logo"] = e["logo"]
    hero = (e.get("media") or {}).get("hero")
    if hero:
        out["media"] = {"hero": hero}
    video = (e.get("youtube") or {}).get("video_id")
    if video:
        out["youtube"] = {"video_id": video, "channel_url": e["youtube"].get("channel_url")}
    if e.get("city_ko"):
        out["city_ko"] = e["city_ko"]
    return out or None


def _signals(i: Institution, scholarships: int = 0) -> dict | None:
    """V28 (UX_AUDIT MK-6): what a student might care about, only where it is verified — current scholarship schemes read
    from the official pages, NIIED's GKS lists, and English-taught degrees the institution publishes. Never a requirement,
    a deadline or a score; absent means "not verified", not "no"."""
    e = i.enrichment or {}
    out = {
        "scholarships": scholarships or None,
        "gks": bool((e.get("gks") or {}).get("programmes")) or None,
        "english_degrees": (((e.get("intl") or {}).get("english_taught_degrees") or {}).get("value") is True) or None,
    }
    out = {k: v for k, v in out.items() if v}
    return out or None


def _card(i: Institution, scholarships: int = 0) -> dict:
    """The directory card. Facts with a source, and nothing a student would mistake for an offer."""
    return {
        "slug": i.slug,
        "name_ko": i.name_ko,
        "name_en": i.name_en,
        "institution_type": i.institution_type,
        "establishment": i.establishment,
        "region": i.region,
        "website_url": i.website_url,
        "major_count": i.major_count,
        # Shown as "listed on the certified list", never as a quality score and never as "not certified".
        "ieqas": {
            "certified": i.ieqas_certified,
            "excellent": i.ieqas_excellent,
            "language_programme": i.ieqas_language_programme,
        } if i.ieqas_certified or i.ieqas_language_programme else None,
        "last_verified": iso(i.last_verified),
        # Whether Hangyul holds verified admission data for this institution. Drives which call to action the
        # card offers — never rendered as a partnership, because it is not one.
        "has_catalog": i.catalog_university_id is not None,
        # V20: enough of the content record for the tile to draw this institution rather than a placeholder.
        "enrichment": _card_content(i),
        "signals": _signals(i, scholarships),
    }


@router.get("/regions")
def regions(db: Session = Depends(get_db)):
    """Institution counts per region — what the map needs to label and shade itself."""
    counts = dict(
        db.execute(
            select(Institution.region, func.count())
            .where(Institution.status == "ACTIVE")
            .group_by(Institution.region)
        ).all()
    )
    by_type = {
        (region, kind): n
        for region, kind, n in db.execute(
            select(Institution.region, Institution.institution_type, func.count())
            .where(Institution.status == "ACTIVE")
            .group_by(Institution.region, Institution.institution_type)
        ).all()
    }
    return {
        "total": sum(counts.values()),
        "regions": [
            {
                "key": r,
                "count": counts.get(r, 0),
                "by_type": {t: by_type.get((r, t), 0) for t in INSTITUTION_TYPES},
            }
            for r in REGIONS
        ],
    }


@router.get("/institutions")
def institutions(
    page: Page = Depends(),
    region: str | None = Query(None),
    #: V21 — a browsing *group* ("부산·경남", "대전·충청"), as a comma-separated list of the registry's
    #: own region keys. Korea's seventeen 광역자치단체 are the right unit for a filter and the wrong
    #: unit for a first screen: nobody browses "Sejong" (3 institutions). The groups are composed in
    #: the client because they are an editorial decision about how people think about the country, not
    #: a fact about the register — but the *filtering* has to happen here, in one query.
    regions: str | None = Query(None, max_length=200),
    institution_type: str | None = Query(None),
    q: str | None = Query(None, max_length=120),
    order: str = Query("ko", pattern="^(ko|en)$"),
    db: Session = Depends(get_db),
):
    stmt = _active()
    if region:
        if region not in REGIONS:
            raise HTTPException(404, "Not found")
        stmt = stmt.where(Institution.region == region)
    elif regions:
        wanted = [r for r in (x.strip() for x in regions.split(",")) if r in REGIONS]
        if not wanted:
            raise HTTPException(404, "Not found")
        stmt = stmt.where(Institution.region.in_(wanted))
    if institution_type:
        if institution_type not in INSTITUTION_TYPES:
            raise HTTPException(404, "Not found")
        stmt = stmt.where(Institution.institution_type == institution_type)
    if q and (term := q.strip()):
        like = f"%{term}%"
        stmt = stmt.where(or_(Institution.name_ko.ilike(like), Institution.name_en.ilike(like)))
    # Universities first, then junior colleges, then graduate institutions — the order a prospective
    # undergraduate reads them in; alphabetical inside each kind, in the script the reader is reading.
    # `order=en` falls back to the Korean name for the ~30 % of institutions with no English name recorded,
    # so they sort last rather than first (NULLs would otherwise lead the list).
    name = func.coalesce(Institution.name_en, Institution.name_ko) if order == "en" else Institution.name_ko
    if q and (term := q.strip()):
        # V23 (REPORT §279): a name search ranks the institution *called* that first — "서울대학교" used to list
        # 서울과학기술대학교 above 서울대학교 and "한국외국어대학교" the cyber university first. Exact, then prefix, then the rest.
        low = term.lower()
        rank = case(
            (or_(func.lower(Institution.name_ko) == low, func.lower(func.coalesce(Institution.name_en, "")) == low), 0),
            (or_(func.lower(Institution.name_ko).startswith(low), func.lower(func.coalesce(Institution.name_en, "")).startswith(low)), 1),
            else_=2,
        )
        stmt = stmt.order_by(rank.asc(), TYPE_ORDER.asc(), name.asc())
    else:
        # V25 (REPORT §312): browsing is photo-first. Inside each kind, institutions with a real photograph of their own
        # campus lead and the typographic identity cards follow — the list a visitor scrolls should feel like places,
        # and the identity card is a fallback, not a peer. Alphabetical inside each group, as before.
        no_photo = case((Institution.enrichment.op("#>")(literal_column("'{media,hero}'")).is_(None), 1), else_=0)
        stmt = stmt.order_by(TYPE_ORDER.asc(), no_photo.asc(), name.asc())
    from app.models import Scholarship
    counts = dict(db.execute(select(Scholarship.institution_id, func.count()).where(Scholarship.verification_status == "CURRENT")
                             .group_by(Scholarship.institution_id)).all())
    return paginate(db, stmt, page, lambda i: _card(i, counts.get(i.id, 0)))


@router.get("/institutions/{slug}")
def institution(slug: str, db: Session = Depends(get_db)):
    row = db.scalar(_active().where(Institution.slug == slug))
    if row is None:
        raise HTTPException(404, "Not found")
    data = _card(row)
    data.update(
        {
            "registry_name_ko": row.registry_name_ko,
            "establishment_source": row.establishment_source,
            "other_campuses": row.other_campuses or [],
            "latitude": row.latitude,
            "longitude": row.longitude,
            "ieqas_checked_on": iso(row.ieqas_checked_on),
            "sources": row.sources or {},
            # V17 — the facts a page needs to be a reason to go rather than a registry record. Served as
            # stored, including each value's own `source` and `verified_at`, so the page can attribute
            # anything it shows and omit anything it cannot (REPORT §150).
            "enrichment": row.enrichment or None,
        }
    )
    # How many of this institution's own programmes Hangyul can currently prepare an application for. A count,
    # not a list: the list is a signed-in student's view, with their eligibility against it.
    if row.catalog_university_id:
        data["catalog"] = {
            "programs": db.scalar(
                select(func.count()).select_from(Program).where(Program.university_id == row.catalog_university_id)
            )
            or 0,
            "open_intakes": db.scalar(
                select(func.count())
                .select_from(ProgramIntake)
                .join(Program, Program.id == ProgramIntake.program_id)
                .where(Program.university_id == row.catalog_university_id, ProgramIntake.is_open.is_(True))
            )
            or 0,
        }
    return data


# ------------------------------------------------------------------------------ V27: scholarships & language rules

def _ser_scholarship(s) -> dict:
    return {
        "id": str(s.id), "name": s.name, "name_en": s.name_en, "name_native": s.name_native, "name_official_en": s.name_official_en, "name_display_ko": s.name_display_ko, "category": s.category, "stage": s.stage,
        "degree_levels": s.degree_levels or [], "international_only": s.international_only, "topik_min": s.topik_min,
        "english_min": {k: v for k, v in (s.english_min or {}).items() if k != "text"} or None,
        "english_text": (s.english_min or {}).get("text"), "gpa_requirement": s.gpa_requirement, "gpa_min_percent": s.gpa_min_percent,
        "waiver_min": s.tuition_waiver_percent_min, "waiver_max": s.tuition_waiver_percent_max, "amount_krw": s.amount_krw,
        "automatic": s.is_automatic, "dormitory_support": s.dormitory_support, "living_allowance": s.living_allowance,
        "duration": s.duration, "renewal": s.renewal, "application_period": s.application_period,
        "department_restriction": s.department_restriction, "nationality_restriction": s.nationality_restriction,
        "source_url": s.source_url, "source_name": s.source_name, "verified_at": iso(s.verified_at.date()) if s.verified_at else None,
    }


@router.get("/institutions/{slug}/admissions")
def institution_admissions(
    slug: str,
    level: str | None = Query(None, pattern="^(LANGUAGE|ASSOCIATE|BACHELOR|TRANSFER|MASTER|DOCTORATE|COMBINED)$"),
    langs: str | None = Query(None, max_length=200),
    gpa_pct: float | None = Query(None, ge=0, le=100),
    db: Session = Depends(get_db),
):
    """V27 (REPORT §355): the verified scholarships and language rules for one institution, and — when the visitor's
    quick-fit answers are passed — the scholarship summary for them, computed by the same rule as the quick fit.
    A missing record is returned as an empty list with ``verified: false``; it never means "no scholarships"."""
    from app.models import AdmissionLanguageRule, Scholarship
    from app.services import fit

    row = db.scalar(_active().where(Institution.slug == slug))
    if row is None:
        raise HTTPException(404, "Not found")
    schol = db.scalars(select(Scholarship).where(Scholarship.institution_id == row.id, Scholarship.verification_status == "CURRENT")
                       .order_by(Scholarship.tuition_waiver_percent_max.desc().nulls_last(), Scholarship.name)).all()
    rules = db.scalars(select(AdmissionLanguageRule).where(AdmissionLanguageRule.institution_id == row.id,
                                                           AdmissionLanguageRule.verification_status == "CURRENT")).all()
    by_level: dict[str, list[dict]] = {}
    for r in rules:
        by_level.setdefault(r.degree_level, []).append({
            "track": r.track, "group": r.group_key, "test": r.test, "min": r.min_text, "stage": r.stage, "note": r.note,
            "source_url": r.source_url, "verified_at": iso(r.verified_at.date()) if r.verified_at else None})
    summary = None
    if level:
        scores: dict[str, float] = {}
        for part in (langs or "").split(","):
            code, _, raw = part.partition(":")
            if code in fit.TESTS:
                try:
                    scores[code] = float(raw)
                except ValueError:
                    pass
        inst = fit.snapshot(db)["insts"].get(row.id)
        if inst is not None:
            summary = fit._scholarship_fit(inst, level, scores, gpa_pct)
    return {"verified": bool(schol or rules), "scholarships": [_ser_scholarship(s) for s in schol], "language_rules": by_level,
            "summary": summary}
