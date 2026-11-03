import uuid
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException, Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.core.security import mask
from app.models import (
    Application,
    Document,
    DocumentVersion,
    Program,
    ProgramIntake,
    StudentProfile,
    University,
    User,
)
from app.services.facts import withheld
from app.services.state_machine import AGENCY, HANGYUL, STUDENT, UNIVERSITY


class Page:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200)):
        self.page = page
        self.page_size = page_size


def paginate(db: Session, stmt: Select, page: Page, serialize) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.limit(page.page_size).offset((page.page - 1) * page.page_size)).all()
    items = [serialize(*r) if len(r) > 1 else serialize(r[0]) for r in rows]
    return {"items": items, "total": total, "page": page.page, "page_size": page.page_size}


def parse_uuid(v: str) -> uuid.UUID:
    try:
        return uuid.UUID(v)
    except (ValueError, TypeError):
        raise HTTPException(404, "Not found")


def actor_kind(p: Principal) -> str:
    if p.is_hangyul:
        return HANGYUL
    if p.is_agency:
        return AGENCY
    if p.is_university:
        return UNIVERSITY
    return STUDENT


def iso(v: date | datetime | None) -> str | None:
    return v.isoformat() if v else None


def freshness(obj) -> dict:
    return {
        "source_url": getattr(obj, "source_url", None),
        "verified_at": iso(getattr(obj, "verified_at", None)),
        "verification_status": getattr(obj, "verification_status", None),
        "effective_from": iso(getattr(obj, "effective_from", None)),
        "effective_to": iso(getattr(obj, "effective_to", None)),
    }


def ser_user(u: User | None) -> dict | None:
    if u is None:
        return None
    return {"id": str(u.id), "full_name": u.full_name, "preferred_name": u.preferred_name, "email": u.email, "locale": u.locale}


def ser_user_public(u: User | None) -> dict | None:
    if u is None:
        return None
    return {"id": str(u.id), "full_name": u.full_name}


# V25 (REPORT §313 S3, P2): the student app represented every university as a coloured letter tile even when the public
# directory holds a licensed photograph of that campus. Every catalogue-university serializer now carries the linked
# institution's hero as a small `photo` object, so the student app can show the place, not a letter. Cached per process
# for five minutes: the mapping changes only when the directory is reloaded.
_PHOTO_CACHE: dict[str, object] = {"at": 0.0, "map": {}}


def university_photo(u: University) -> dict | None:
    import time

    from sqlalchemy import select as _select
    from sqlalchemy.orm import object_session

    from app.models import Institution

    now = time.monotonic()
    if now - float(_PHOTO_CACHE["at"]) > 300:  # type: ignore[arg-type]
        db = object_session(u)
        if db is None:
            return None
        rows = db.execute(_select(Institution.catalog_university_id, Institution.slug, Institution.enrichment)
                          .where(Institution.catalog_university_id.is_not(None))).all()
        m: dict[str, dict] = {}
        for uid, slug, enr in rows:
            hero = ((enr or {}).get("media") or {}).get("hero")
            if hero and hero.get("local_path"):
                m[str(uid)] = {
                    "institution_slug": slug,
                    "local_path": hero["local_path"],
                    "focal_x": hero.get("focal_x", 50), "focal_y": hero.get("focal_y", 50),
                    "focal_mobile_x": hero.get("focal_mobile_x"), "focal_mobile_y": hero.get("focal_mobile_y"),
                    "formats": hero.get("formats") or ["jpg"], "width": hero.get("width"), "height": hero.get("height"),
                    # V26 (REPORT §348): the widths on file, so a 36–72 px tile can load the 240-px rendition, not the 640.
                    "renditions": hero.get("renditions") or [640, 1200, 2400],
                    "attribution": hero.get("attribution_requirement"),
                }
        _PHOTO_CACHE.update(at=now, map=m)
    return _PHOTO_CACHE["map"].get(str(u.id))  # type: ignore[union-attr]


def ser_university_card(u: University) -> dict:
    return {
        "id": str(u.id),
        "slug": u.slug,
        "name_en": u.name_en,
        "name_ko": u.name_ko,
        "institution_type": u.institution_type.value,
        "region": u.region,
        "city": u.city,
        "is_partner": u.is_partner,
        "brand_color": u.brand_color,
        "photo": university_photo(u),
        "certification_status": u.certification_status,
        "est_living_cost_monthly_krw": u.est_living_cost_monthly_krw,
        "summary": u.summary,
        **freshness(u),
    }


_INTAKE_FACTS = ("application_opens", "application_deadline", "document_deadline", "interview_window", "decision_date",
                 "tuition_deadline", "semester_start", "seats_international")
_PROGRAM_FACTS = ("tuition_per_semester_krw", "application_fee_krw", "duration_semesters", "description")
_REQ_FACTS = ("min_prior_education", "min_gpa_percent", "min_topik_level", "min_ielts", "min_toefl_ibt",
              "language_alternative", "requires_interview", "requires_portfolio", "notes")


def ser_intake(i: ProgramIntake) -> dict:
    d = _ser_intake(i)
    if withheld(i):
        d.update({k: None for k in _INTAKE_FACTS}, withheld=True)
    return d


def _ser_intake(i: ProgramIntake) -> dict:
    return {
        "id": str(i.id),
        "year": i.year,
        "term": i.term.value,
        "round": i.round,
        "application_opens": iso(i.application_opens),
        "application_deadline": iso(i.application_deadline),
        "document_deadline": iso(i.document_deadline),
        "interview_window": i.interview_window,
        "decision_date": iso(i.decision_date),
        "tuition_deadline": iso(i.tuition_deadline),
        "semester_start": iso(i.semester_start),
        "seats_international": i.seats_international,
        "is_open": i.is_open,
        **freshness(i),
    }


def ser_program(p: Program, university: University | None = None, *, with_intakes: bool = False) -> dict:
    req = p.requirements[0] if p.requirements else None
    d = {
        "id": str(p.id),
        "university_id": str(p.university_id),
        "name_en": p.name_en,
        "name_ko": p.name_ko,
        "degree_level": p.degree_level.value,
        "field": p.field,
        "instruction_language": p.instruction_language.value,
        "duration_semesters": p.duration_semesters,
        "tuition_per_semester_krw": p.tuition_per_semester_krw,
        "application_fee_krw": p.application_fee_krw,
        "description": p.description,
        "requirements": {
            "min_prior_education": req.min_prior_education,
            "min_gpa_percent": req.min_gpa_percent,
            "min_topik_level": req.min_topik_level,
            "min_ielts": req.min_ielts,
            "min_toefl_ibt": req.min_toefl_ibt,
            "language_alternative": req.language_alternative,
            "requires_interview": req.requires_interview,
            "requires_portfolio": req.requires_portfolio,
            "notes": req.notes,
            **freshness(req),
        }
        if req
        else None,
        **freshness(p),
    }
    if withheld(p):
        d.update({k: None for k in _PROGRAM_FACTS}, withheld=True)
    if d["requirements"] is not None and withheld(req):
        d["requirements"].update({k: None for k in _REQ_FACTS}, withheld=True)
    if university is not None:
        d["university"] = ser_university_card(university)
    if with_intakes:
        d["intakes"] = [ser_intake(i) for i in sorted(p.intakes, key=lambda i: i.application_deadline)]
    return d


def ser_document(d: Document, *, viewer: Principal | None = None) -> dict:
    latest: DocumentVersion | None = d.versions[-1] if d.versions else None
    return {
        "id": str(d.id),
        "owner_user_id": str(d.owner_user_id),
        "category": d.category.value,
        "title": d.title,
        "issuing_country": d.issuing_country,
        "issue_date": iso(d.issue_date),
        "expires_on": iso(d.expires_on),
        "language": d.language,
        "translation_required": d.translation_required,
        "legalization_path": d.legalization_path.value,
        "legalization_status": d.legalization_status.value,
        "legalization_progress": d.legalization_progress or [],
        "status": d.status.value,
        "reviewer_user_id": str(d.reviewer_user_id) if d.reviewer_user_id else None,
        "rejection_reason": d.rejection_reason,
        "reusable": d.reusable,
        "current_version": d.current_version,
        "latest_file": {
            "filename": latest.original_filename,
            "mime_type": latest.mime_type,
            "size_bytes": latest.size_bytes,
            "scan_status": latest.scan_status,
            "uploaded_at": iso(latest.created_at),
        }
        if latest
        else None,
        "versions": [{"version": v.version, "filename": v.original_filename, "uploaded_at": iso(v.created_at), "size_bytes": v.size_bytes} for v in d.versions],
        "updated_at": iso(d.updated_at),
        "is_demo": d.is_demo,
    }


def ser_profile(p: StudentProfile | None) -> dict | None:
    if p is None:
        return None
    return {
        "id": str(p.id),
        "nationality": p.nationality,
        "residence_country": p.residence_country,
        "date_of_birth": iso(p.date_of_birth),
        "gender": p.gender,
        "has_passport": p.has_passport,
        "passport_number_masked": p.passport_number_masked,
        "passport_expiry": iso(p.passport_expiry),
        "target_degree": p.target_degree.value if p.target_degree else None,
        "target_intake_year": p.target_intake_year,
        "target_intake_term": p.target_intake_term.value if p.target_intake_term else None,
        "desired_fields": p.desired_fields or [],
        "preferred_regions": p.preferred_regions or [],
        "preferred_university_ids": p.preferred_university_ids or [],
        "annual_budget_krw": p.annual_budget_krw,
        "needs_scholarship": p.needs_scholarship,
        "housing_preference": p.housing_preference,
        "korean_self_level": p.korean_self_level,
        "english_self_level": p.english_self_level,
        "previous_korean_visa": p.previous_korean_visa,
        "current_korean_visa": p.current_korean_visa,
        "in_korea_now": p.in_korea_now,
        "financial_sponsor": p.financial_sponsor,
        "academic_priorities": p.academic_priorities or [],
        "career_goal": p.career_goal,
        "onboarding_step": p.onboarding_step,
        "onboarding_completed": p.onboarding_completed_at is not None,
        "pipeline_stage": p.pipeline_stage.value,
        "educations": [
            {
                "id": str(e.id),
                "level": e.level,
                "institution": e.institution,
                "country": e.country,
                "major": e.major,
                "start_year": e.start_year,
                "graduation_year": e.graduation_year,
                "graduation_status": e.graduation_status,
                "gpa_value": e.gpa_value,
                "gpa_scale_min": e.gpa_scale_min,
                "gpa_scale_max": e.gpa_scale_max,
                "gpa_percent": e.gpa_percent,
                "gpa_override_note": e.gpa_override_note,
            }
            for e in p.educations
        ],
        "languages": [
            {
                "id": str(l.id),
                "test": l.test.value,
                "score": l.score,
                "test_date": iso(l.test_date),
                "expires_on": iso(l.expires_on),
                "is_planned": l.is_planned,
                "verified": l.verified,
            }
            for l in p.languages
        ],
        "is_demo": p.is_demo,
    }


def ser_application(a: Application, db: Session, *, include_student: bool = True) -> dict:
    program = db.get(Program, a.program_id)
    uni = db.get(University, a.university_id)
    intake = db.get(ProgramIntake, a.intake_id)
    student = db.get(User, a.student_user_id) if include_student else None
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == a.student_user_id)) if include_student else None
    return {
        "id": str(a.id),
        "status": a.status.value,
        "readiness_percent": a.readiness_percent,
        "submitted_at": iso(a.submitted_at),
        "decided_at": iso(a.decided_at),
        "external_reference": a.external_reference,
        "flagged": a.flagged,
        "university_reviewer_id": str(a.university_reviewer_id) if a.university_reviewer_id else None,
        "flag_reason": a.flag_reason,
        "interview_at": iso(a.interview_at),
        "offer_scholarship_note": a.offer_scholarship_note,
        "tuition_amount_krw": a.tuition_amount_krw,
        "tuition_due": iso(a.tuition_due),
        "program": {"id": str(program.id), "name_en": program.name_en, "name_ko": program.name_ko, "degree_level": program.degree_level.value, "field": program.field, "instruction_language": program.instruction_language.value},
        "university": {"id": str(uni.id), "name_en": uni.name_en, "name_ko": uni.name_ko, "slug": uni.slug, "city": uni.city, "brand_color": uni.brand_color, "photo": university_photo(uni)},
        "intake": {"id": str(intake.id), "year": intake.year, "term": intake.term.value, "application_deadline": iso(intake.application_deadline), "semester_start": iso(intake.semester_start)},
        "agency_org_id": str(a.agency_org_id) if a.agency_org_id else None,
        "student": {"id": str(student.id), "full_name": student.full_name, "nationality": profile.nationality if profile else None} if student else None,
        "updated_at": iso(a.updated_at),
        "created_at": iso(a.created_at),
        "is_demo": a.is_demo,
    }


def masked_passport(v: str | None) -> str | None:
    return mask(v, 3)


def clean(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


def real_partner(db, university) -> bool:
    """True only for a partnership somebody could be shown the paperwork for.

    `University.is_partner` is a cached flag the seed sets from fictional `PartnerContract` rows
    (`is_demo=True`). V6 forbade a partner label on public pages without a verified, non-synthetic agreement;
    V12 extends that to console chrome, because a badge nobody can substantiate is a partnership claim wherever
    it is rendered. No real agreement exists yet, so this returns False everywhere today — which is the point.
    """
    from app.models import PartnerContract
    from app.models.enums import ContractStatus

    if not university.is_partner:
        return False
    return db.scalar(
        select(func.count())
        .select_from(PartnerContract)
        .where(
            PartnerContract.university_id == university.id,
            PartnerContract.status == ContractStatus.ACTIVE,
            PartnerContract.is_demo.is_(False),
        )
    ) > 0
