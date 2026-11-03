"""Public-ish catalog: universities, programs, scholarships, countries, locales, content, sources."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import Page, freshness, iso, paginate, parse_uuid, ser_intake, ser_program, ser_university_card
from app.core.audit import track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_student
from app.models import (
    AdmissionRequirement,
    ContentArticle,
    Country,
    Dormitory,
    Locale,
    PartnerContract,
    Program,
    ProgramIntake,
    SavedUniversity,
    Scholarship,
    Source,
    StudentProfile,
    University,
)
from app.models.base import utcnow
from app.models.enums import ContentStatus, ContractStatus, InstructionLanguage
from app.services.budget import first_year_range
from app.services.matching import estimated_annual_cost, scholarship_eligibility
from app.services.readiness import requirements_for

router = APIRouter(tags=["catalog"])

FIELDS = [
    "business", "economics", "computer_science", "engineering", "electrical_engineering", "mechanical_engineering",
    "korean_studies", "korean_language", "international_studies", "media_communication", "design", "arts",
    "hospitality_tourism", "nursing_health", "biotechnology", "natural_sciences", "education", "law", "social_sciences",
    "data_science", "architecture", "music", "film", "sports",
]
REGIONS = ["Seoul", "Gyeonggi", "Incheon", "Busan", "Daegu", "Daejeon", "Gwangju", "Ulsan", "Sejong", "Gangwon", "Chungbuk",
           "Chungnam", "Jeonbuk", "Jeonnam", "Gyeongbuk", "Gyeongnam", "Jeju"]


@router.get("/meta/countries")
def countries(q: str | None = None, priority_only: bool = False, db: Session = Depends(get_db)):
    stmt = select(Country)
    if priority_only:
        stmt = stmt.where(Country.is_priority_market.is_(True))
    rows = db.scalars(stmt.order_by(Country.priority_rank.nulls_last(), Country.name_en)).all()
    if q:
        ql = q.lower().strip()
        rows = [c for c in rows if ql in c.name_en.lower() or ql in (c.name_native or "").lower() or ql in (c.name_ko or "")
                or ql == c.code.lower() or any(ql in a.lower() for a in (c.aliases or []))]
    return [
        {"code": c.code, "name_en": c.name_en, "name_native": c.name_native, "name_ko": c.name_ko, "region": c.region,
         "default_locale": c.default_locale, "currency": c.currency, "is_priority_market": c.is_priority_market,
         "priority_rank": c.priority_rank, "apostille_member": c.apostille_member,
         "apostille_effective_from": iso(c.apostille_effective_from), "apostille_verified_at": iso(c.apostille_verified_at),
         "apostille_source_url": c.apostille_source_url, "aliases": c.aliases or []}
        for c in rows
    ]


@router.get("/meta/locales")
def locales(db: Session = Depends(get_db)):
    return [
        {"code": l.code, "name_en": l.name_en, "name_native": l.name_native, "direction": l.direction, "translation_status": l.translation_status}
        for l in db.scalars(select(Locale).order_by(Locale.name_en))
    ]


@router.get("/meta/taxonomy")
def taxonomy():
    return {"fields": FIELDS, "regions": REGIONS}


def _program_filters(stmt, *, q, degree, field, region, city, institution_type, language, max_tuition, max_topik,
                     max_ielts, has_scholarship, has_dorm, partner_only, intake_term, open_only, deadline_before, today):
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Program.name_en.ilike(like), Program.name_ko.ilike(like), University.name_en.ilike(like),
                              University.name_ko.ilike(like), University.city.ilike(like)))
    if degree:
        stmt = stmt.where(Program.degree_level.in_(degree))
    if field:
        stmt = stmt.where(Program.field.in_(field))
    if region:
        stmt = stmt.where(University.region.in_(region))
    if city:
        stmt = stmt.where(University.city.ilike(city))
    if institution_type:
        stmt = stmt.where(University.institution_type.in_(institution_type))
    if language:
        stmt = stmt.where(Program.instruction_language.in_(language))
    if max_tuition:
        stmt = stmt.where(Program.tuition_per_semester_krw <= max_tuition)
    if max_topik is not None:
        stmt = stmt.where(~exists().where(AdmissionRequirement.program_id == Program.id, AdmissionRequirement.min_topik_level > max_topik))
    if max_ielts is not None:
        stmt = stmt.where(~exists().where(AdmissionRequirement.program_id == Program.id, AdmissionRequirement.min_ielts > max_ielts))
    if has_scholarship:
        stmt = stmt.where(exists().where(Scholarship.university_id == University.id))
    if has_dorm:
        stmt = stmt.where(exists().where(Dormitory.university_id == University.id))
    if partner_only:
        stmt = stmt.where(University.is_partner.is_(True))
    intake_cond = [ProgramIntake.program_id == Program.id]
    if open_only:
        intake_cond += [ProgramIntake.is_open.is_(True), ProgramIntake.application_deadline >= today]
    if intake_term:
        intake_cond.append(ProgramIntake.term == intake_term)
    if deadline_before:
        intake_cond.append(ProgramIntake.application_deadline <= deadline_before)
    if open_only or intake_term or deadline_before:
        stmt = stmt.where(exists().where(and_(*intake_cond)))
    return stmt


@router.get("/programs")
def search_programs(
    page: Page = Depends(),
    q: str | None = None,
    degree: list[str] | None = Query(None),
    field: list[str] | None = Query(None),
    region: list[str] | None = Query(None),
    city: str | None = None,
    institution_type: list[str] | None = Query(None),
    # V30 (REPORT §410): typed, so `language=ko` (a UI locale leaking into the filter) is a 422, never a 500.
    language: list[InstructionLanguage] | None = Query(None),
    max_tuition: int | None = None,
    max_topik: int | None = Query(None, ge=0, le=6),
    max_ielts: float | None = None,
    has_scholarship: bool = False,
    has_dorm: bool = False,
    partner_only: bool = False,
    intake_term: str | None = None,
    open_only: bool = False,
    deadline_before: date | None = None,
    sort: str = Query("relevance", pattern="^(relevance|tuition|deadline|name)$"),
    db: Session = Depends(get_db),
):
    today = utcnow().date()
    stmt = select(Program, University).join(University, University.id == Program.university_id).where(Program.is_active.is_(True))
    stmt = _program_filters(stmt, q=q, degree=degree, field=field, region=region, city=city, institution_type=institution_type,
                            language=language, max_tuition=max_tuition, max_topik=max_topik, max_ielts=max_ielts,
                            has_scholarship=has_scholarship, has_dorm=has_dorm, partner_only=partner_only,
                            intake_term=intake_term, open_only=open_only, deadline_before=deadline_before, today=today)
    next_deadline = (
        select(func.min(ProgramIntake.application_deadline))
        .where(ProgramIntake.program_id == Program.id, ProgramIntake.application_deadline >= today, ProgramIntake.is_open.is_(True))
        .scalar_subquery()
    )
    if sort == "tuition":
        stmt = stmt.order_by(Program.tuition_per_semester_krw.asc().nulls_last())
    elif sort == "deadline":
        stmt = stmt.order_by(next_deadline.asc().nulls_last())
    elif sort == "name":
        stmt = stmt.order_by(University.name_en, Program.name_en)
    else:
        stmt = stmt.order_by(University.is_partner.desc(), University.name_en, Program.name_en)
    stmt = stmt.options(selectinload(Program.requirements), selectinload(Program.intakes))
    dorms: dict = {}
    for dm in db.scalars(select(Dormitory)):
        dorms.setdefault(dm.university_id, []).append(dm)

    def ser(p: Program, u: University):
        d = ser_program(p, u)
        upcoming = sorted([i for i in p.intakes if i.is_open and i.application_deadline >= today], key=lambda i: i.application_deadline)
        d["next_intake"] = ser_intake(upcoming[0]) if upcoming else None
        d["estimated_annual_cost_krw"] = estimated_annual_cost(p, u)
        d["first_year_range_krw"] = first_year_range(p, u, dorms.get(u.id, []))
        return d

    return paginate(db, stmt, page, ser)


@router.get("/universities")
def list_universities(page: Page = Depends(), q: str | None = None, region: list[str] | None = Query(None),
                      institution_type: list[str] | None = Query(None), partner_only: bool = False, db: Session = Depends(get_db)):
    stmt = select(University)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(University.name_en.ilike(like), University.name_ko.ilike(like), University.city.ilike(like)))
    if region:
        stmt = stmt.where(University.region.in_(region))
    if institution_type:
        stmt = stmt.where(University.institution_type.in_(institution_type))
    if partner_only:
        stmt = stmt.where(University.is_partner.is_(True))
    stmt = stmt.order_by(University.is_partner.desc(), University.name_en)
    counts = dict(db.execute(select(Program.university_id, func.count()).group_by(Program.university_id)).all())

    def ser(u):
        d = ser_university_card(u)
        d["program_count"] = counts.get(u.id, 0)
        return d

    return paginate(db, stmt, page, ser)


@router.get("/universities/{slug}")
def university_detail(slug: str, db: Session = Depends(get_db)):
    u = db.scalar(select(University).where(University.slug == slug).options(
        selectinload(University.programs).selectinload(Program.intakes),
        selectinload(University.programs).selectinload(Program.requirements),
        selectinload(University.campuses), selectinload(University.dormitories),
        selectinload(University.scholarships).selectinload(Scholarship.rules),
    ))
    if not u:
        raise HTTPException(404, "University not found")
    track(db, "university_viewed", university_id=u.id)
    db.commit()
    today = utcnow().date()
    # V10: the public page must show only listed programmes. `/programs` (line ~144) already filters on
    # `is_active`, but this endpoint did not, so the inactive development-fixture programme seeded by
    # `seed/extra_60_submission_v6.py` was served to anonymous visitors — and, being first alphabetically,
    # became the default programme and the <h1> of the public university page.
    programs = [p for p in u.programs if p.is_active]
    contract = db.scalar(select(PartnerContract).where(PartnerContract.university_id == u.id, PartnerContract.status == ContractStatus.ACTIVE,
                                                       PartnerContract.start_date <= today, PartnerContract.end_date >= today))
    sample_program = programs[0] if programs else None
    docs = requirements_for(db, sample_program, None) if sample_program else []
    deadlines = sorted(
        [{"program_id": str(p.id), "program": p.name_en, "degree_level": p.degree_level.value, **ser_intake(i)}
         for p in programs for i in p.intakes if i.application_deadline >= today],
        key=lambda d: d["application_deadline"],
    )
    return {
        **ser_university_card(u),
        "website_url": u.website_url,
        "international_admissions_url": u.international_admissions_url,
        "founded_year": u.founded_year,
        "international_services": u.international_services or [],
        "certification_source_url": u.certification_source_url,
        "certification_verified_at": iso(u.certification_verified_at),
        "location": {"latitude": u.latitude, "longitude": u.longitude},
        "campuses": [{"id": str(c.id), "name": c.name, "city": c.city, "address": c.address, "is_main": c.is_main} for c in u.campuses],
        "programs": [{**ser_program(p, with_intakes=True), "first_year_range_krw": first_year_range(p, u, list(u.dormitories))}
                     for p in sorted(programs, key=lambda p: (p.degree_level.value, p.name_en))],
        "dormitories": [
            {"id": str(d.id), "name": d.name, "room_types": d.room_types or [], "capacity": d.capacity,
             "cost_per_semester_krw_min": d.cost_per_semester_krw_min, "cost_per_semester_krw_max": d.cost_per_semester_krw_max,
             "international_priority": d.international_priority, "meal_plan": d.meal_plan, "application_note": d.application_note, **freshness(d)}
            for d in u.dormitories
        ],
        "scholarships": [ser_scholarship(s) for s in u.scholarships],
        "required_documents": [
            {"category": r.category.value, "label": r.label, "required": r.is_required, "legalization_required": r.legalization_required,
             "translation_required": r.translation_required, "applies_to_nationalities": r.applies_to_nationalities, "notes": r.notes,
             "max_age_days": r.max_age_days, **freshness(r)}
            for r in docs
        ],
        "deadlines": deadlines[:20],
        "partner": {
            "active": contract is not None,
            "benefits": _partner_benefits(contract) if contract else [],
            "guarantee_available": bool(contract and contract.guarantee_enabled),
            "guarantee_terms": contract.guarantee_terms if contract and contract.guarantee_enabled else None,
            "is_demo": contract.is_demo if contract else None,
        },
        "outcomes": None,  # Only populated from verified, consented data with sufficient sample size.
    }


def _partner_benefits(c: PartnerContract) -> list[str]:
    out = ["PRIORITY_REVIEW_SUPPORT", "DEDICATED_COUNSELOR"]
    if c.pools:
        out.append("HANGYUL_PARTNER_SCHOLARSHIP")
    return out


def ser_scholarship(s: Scholarship, eligibility: dict | None = None) -> dict:
    return {
        "id": str(s.id),
        "university_id": str(s.university_id) if s.university_id else None,
        "kind": s.kind.value,
        "name": s.name,
        "provider": s.provider,
        "description": s.description,
        "coverage": s.coverage,
        "tuition_waiver_percent_min": s.tuition_waiver_percent_min,
        "tuition_waiver_percent_max": s.tuition_waiver_percent_max,
        "amount_krw": s.amount_krw,
        "degree_levels": s.degree_levels or [],
        "application_deadline": iso(s.application_deadline),
        "is_automatic": s.is_automatic,
        "rules": [{"field": r.field, "operator": r.operator, "value": r.value, "description": r.description} for r in s.rules],
        "eligibility": eligibility,
        **freshness(s),
    }


@router.get("/programs/{program_id}")
def program_detail(program_id: str, db: Session = Depends(get_db)):
    p = db.get(Program, parse_uuid(program_id))
    if not p:
        raise HTTPException(404, "Program not found")
    u = db.get(University, p.university_id)
    track(db, "program_viewed", university_id=u.id, properties={"program_id": str(p.id)})
    db.commit()
    d = ser_program(p, u, with_intakes=True)
    d["estimated_annual_cost_krw"] = estimated_annual_cost(p, u)
    d["first_year_range_krw"] = first_year_range(p, u, list(db.scalars(select(Dormitory).where(Dormitory.university_id == u.id))))
    d["required_documents"] = [{"category": r.category.value, "label": r.label, "required": r.is_required,
                                "legalization_required": r.legalization_required, "notes": r.notes} for r in requirements_for(db, p, None)]
    return d


@router.get("/scholarships")
def list_scholarships(kind: list[str] | None = Query(None), university_id: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Scholarship).options(selectinload(Scholarship.rules))
    if kind:
        stmt = stmt.where(Scholarship.kind.in_(kind))
    if university_id:
        stmt = stmt.where(Scholarship.university_id == parse_uuid(university_id))
    return [ser_scholarship(s) for s in db.scalars(stmt.order_by(Scholarship.kind, Scholarship.name))]


@router.get("/me/scholarships")
def my_scholarships(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == p.id))
    rows = db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))).all()
    out = []
    for s in rows:
        el = scholarship_eligibility(s, profile) if profile else {"status": "POSSIBLE", "checks": []}
        d = ser_scholarship(s, el)
        if s.university_id:
            u = db.get(University, s.university_id)
            d["university_name"] = u.name_en
        out.append(d)
    order = {"ELIGIBLE": 0, "POSSIBLE": 1, "NOT_ELIGIBLE": 2}
    return sorted(out, key=lambda d: (order[d["eligibility"]["status"]], d["kind"]))


# ---------- saved universities & comparison ----------

@router.get("/me/saved")
def saved(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    rows = db.execute(select(SavedUniversity, University).join(University, University.id == SavedUniversity.university_id)
                      .where(SavedUniversity.user_id == p.id).order_by(SavedUniversity.created_at.desc())).all()
    return [{**ser_university_card(u), "saved_at": iso(s.created_at), "program_id": str(s.program_id) if s.program_id else None, "note": s.note} for s, u in rows]


class SaveIn(BaseModel):
    program_id: str | None = None
    note: str | None = Field(default=None, max_length=300)


@router.put("/me/saved/{university_id}", status_code=204)
def save_university(university_id: str, body: SaveIn | None = None, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    uid = parse_uuid(university_id)
    if not db.get(University, uid):
        raise HTTPException(404, "University not found")
    existing = db.scalar(select(SavedUniversity).where(SavedUniversity.user_id == p.id, SavedUniversity.university_id == uid))
    if not existing:
        db.add(SavedUniversity(user_id=p.id, university_id=uid, program_id=parse_uuid(body.program_id) if body and body.program_id else None,
                               note=body.note if body else None, created_at=utcnow()))
        track(db, "university_saved", user_id=p.id, university_id=uid)
    db.commit()


@router.delete("/me/saved/{university_id}", status_code=204)
def unsave_university(university_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    s = db.scalar(select(SavedUniversity).where(SavedUniversity.user_id == p.id, SavedUniversity.university_id == parse_uuid(university_id)))
    if s:
        db.delete(s)
        db.commit()


class CompareIn(BaseModel):
    program_ids: list[str] = Field(min_length=2, max_length=4)


@router.post("/compare")
def compare(body: CompareIn, db: Session = Depends(get_db), p: Principal = Depends(get_principal)):
    from app.services.matching import match_program  # local import keeps catalog import graph light

    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == p.id))
    today = utcnow().date()
    out = []
    for pid in body.program_ids:
        prog = db.get(Program, parse_uuid(pid))
        if not prog:
            raise HTTPException(404, "Program not found")
        u = db.get(University, prog.university_id)
        req_docs = requirements_for(db, prog, profile.nationality if profile else None)
        scholarships = db.scalars(select(Scholarship).where(Scholarship.university_id == u.id)).all()
        has_dorm = bool(u.dormitories)
        m = match_program(profile, prog, u, prog.intakes, scholarships, has_dorm, today).dict() if profile else None
        upcoming = sorted([i for i in prog.intakes if i.is_open and i.application_deadline >= today], key=lambda i: i.application_deadline)
        out.append({
            "program": ser_program(prog, u),
            "match": m,
            "next_intake": ser_intake(upcoming[0]) if upcoming else None,
            "estimated_annual_cost_krw": estimated_annual_cost(prog, u),
            "first_year_range_krw": first_year_range(prog, u, list(u.dormitories)),
            "scholarships": [ser_scholarship(s) for s in scholarships],
            "dormitory": bool(u.dormitories),
            "document_count": len(req_docs),
            "legalization_documents": sum(1 for r in req_docs if r.legalization_required),
            "partner": u.is_partner,
        })
    track(db, "comparison_created", user_id=p.id, properties={"program_ids": body.program_ids})
    db.commit()
    return out


# ---------- content & sources ----------

@router.get("/content")
def list_content(locale: str = "en", content_type: str | None = None, country: str | None = None, db: Session = Depends(get_db)):
    stmt = select(ContentArticle).where(ContentArticle.status == ContentStatus.PUBLISHED)
    if content_type:
        stmt = stmt.where(ContentArticle.content_type == content_type)
    if country:
        stmt = stmt.where(ContentArticle.country_code == country)
    rows = db.scalars(stmt.order_by(ContentArticle.content_type, ContentArticle.title)).all()
    best: dict[str, ContentArticle] = {}
    for a in rows:  # locale fallback: requested locale → English
        if a.locale == locale or (a.locale == "en" and a.slug not in best):
            best[a.slug] = a
    return [_ser_article(a, include_body=False) for a in best.values()]


@router.get("/content/{slug}")
def get_content(slug: str, locale: str = "en", db: Session = Depends(get_db)):
    rows = db.scalars(select(ContentArticle).where(ContentArticle.slug == slug, ContentArticle.status == ContentStatus.PUBLISHED)).all()
    a = next((r for r in rows if r.locale == locale), None) or next((r for r in rows if r.locale == "en"), None)
    if not a:
        raise HTTPException(404, "Article not found")
    d = _ser_article(a, include_body=True)
    d["sources"] = [
        {"key": s.key, "name": s.name, "url": s.url, "source_type": s.source_type.value, "last_checked_at": iso(s.last_checked_at), "status": s.status.value}
        for s in db.scalars(select(Source).where(Source.key.in_(a.source_keys or [])))
    ]
    d["fallback_locale"] = a.locale if a.locale != locale else None
    return d


def _ser_article(a: ContentArticle, include_body: bool) -> dict:
    d = {"slug": a.slug, "locale": a.locale, "content_type": a.content_type.value, "title": a.title, "summary": a.summary,
         "seo_title": a.seo_title, "seo_description": a.seo_description, "country_code": a.country_code,
         "last_verified_at": iso(a.last_verified_at), "author_name": a.author_name, "reviewer_name": a.reviewer_name,
         "translation_status": a.translation_status}
    if include_body:
        d["body_md"] = a.body_md
    return d
