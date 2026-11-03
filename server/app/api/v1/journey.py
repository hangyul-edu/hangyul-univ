"""Student-journey helpers added in V3: first-year budget, indicative FX, and "what completing your profile unlocks"."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.student import compute_matches, get_profile
from app.core.audit import track
from app.core.db import get_db
from app.core.deps import Principal, require_student
from app.models import Application, Dormitory, Order, Program, SavedUniversity, Scholarship, ServicePrice, ServiceProduct, University
from app.models.base import utcnow
from app.models.enums import ApplicationStatus, OrderStatus
from app.services import money as money_svc
from app.services.budget import FX_AS_OF, FX_KRW_PER_UNIT, _round_down, _round_up, as_dict, first_year_range, offer_payment, program_budget

router = APIRouter(tags=["journey"])

MAX_PROGRAMS = 6


def _shortlist_ids(db: Session, user_id) -> list[uuid.UUID]:
    """Default budget set: programs the student applied to, then saved programs (most recent first)."""
    ids: list[uuid.UUID] = []
    for a in db.scalars(select(Application).where(Application.student_user_id == user_id).order_by(Application.created_at.desc())):
        if a.program_id not in ids:
            ids.append(a.program_id)
    for s in db.scalars(select(SavedUniversity).where(SavedUniversity.user_id == user_id).order_by(SavedUniversity.created_at.desc())):
        if s.program_id and s.program_id not in ids:
            ids.append(s.program_id)
    return ids[:MAX_PROGRAMS]


def hangyul_fee(db: Session, user_id, nationality: str | None) -> dict:
    """V8: Hangyul's own fee in the same budget as the university's costs — what the student paid or owes, never hidden.

    PAID / DUE come from the student's own order (stored amount and currency, never re-priced). Without an order the
    service is optional (NONE) and the lowest active plan price for the student's country (else the default price) is
    shown as "from". `is_demo` prices are flagged so the UI can label them like other sample figures.
    """
    order = db.scalars(select(Order).where(Order.user_id == user_id, Order.status.in_([OrderStatus.PAID, OrderStatus.PENDING]))
                       .order_by(Order.created_at.desc())).first()
    if order:
        prod = db.get(ServiceProduct, order.product_id)
        price = db.get(ServicePrice, order.price_id) if order.price_id else None
        return {"status": "PAID" if order.status == OrderStatus.PAID else "DUE", "product_code": prod.code if prod else None,
                "product_name_key": prod.name_key if prod else None, "product_name_en": prod.name_en if prod else None,
                "currency": order.currency, "amount_minor": order.amount_minor, "paid_at": order.paid_at.isoformat() if order.paid_at else None,
                "is_demo": bool(price.is_demo) if price else False}
    prices = db.execute(select(ServicePrice, ServiceProduct).join(ServiceProduct, ServicePrice.product_id == ServiceProduct.id)
                        .where(ServiceProduct.is_active.is_(True))).all()
    own = [(pr, pd) for pr, pd in prices if nationality and pr.country_code == nationality]
    pool = own or [(pr, pd) for pr, pd in prices if pr.country_code is None]
    if not pool:
        return {"status": "NONE", "currency": None, "amount_minor": None, "is_demo": False}
    # Compare within one currency only: the currency of the first candidate (KRW preferred).
    cur = "KRW" if any(pr.currency == "KRW" for pr, _ in pool) else pool[0][0].currency
    pr, pd = min(((pr, pd) for pr, pd in pool if pr.currency == cur), key=lambda x: x[0].amount_minor)
    return {"status": "NONE", "product_code": pd.code, "product_name_key": pd.name_key, "product_name_en": pd.name_en,
            "currency": pr.currency, "amount_minor": pr.amount_minor, "paid_at": None, "is_demo": bool(pr.is_demo)}


@router.get("/me/budget")
def my_budget(program_ids: list[str] | None = Query(None), housing: str | None = Query(None, pattern="^(DORM|OFF_CAMPUS)$"),
              p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    prof = get_profile(db, p.id)
    ids: list[uuid.UUID] = []
    for raw in program_ids or []:
        for part in raw.split(","):
            try:
                ids.append(uuid.UUID(part.strip()))
            except ValueError:
                continue
    source = "selected" if ids else "shortlist"
    ids = ids[:MAX_PROGRAMS] or _shortlist_ids(db, p.id)
    programs = db.scalars(select(Program).where(Program.id.in_(ids))).all() if ids else []
    by_id = {pr.id: pr for pr in programs}
    uni_ids = {pr.university_id for pr in programs}
    unis = {u.id: u for u in db.scalars(select(University).where(University.id.in_(uni_ids)))} if uni_ids else {}
    dorms: dict = {}
    for d in db.scalars(select(Dormitory).where(Dormitory.university_id.in_(uni_ids))) if uni_ids else []:
        dorms.setdefault(d.university_id, []).append(d)
    schol: dict = {}
    for s in db.scalars(select(Scholarship).options(selectinload(Scholarship.rules))):
        schol.setdefault(s.university_id, []).append(s)
    items = []
    for pid in ids:
        pr = by_id.get(pid)
        if not pr:
            continue
        u = unis[pr.university_id]
        items.append(as_dict(program_budget(pr, u, dorms.get(u.id, []), schol.get(u.id, []) + schol.get(None, []), prof, housing, utcnow().date())))
    fee = hangyul_fee(db, p.id, prof.nationality if prof else None)
    # V9 S2: the same items as one money plan — payee, when, refundable and basis per line (additive field).
    for it in items:
        pr = by_id.get(uuid.UUID(it["program_id"]))
        it["plan"] = money_svc.program_plan(db, p.id, pr, housing=housing) if pr else None
    first = by_id.get(ids[0]) if ids else None
    u0 = unis.get(first.university_id) if first else None
    funds = money_svc.funds_to_show(db, p.id, level=first.degree_level if first else None, region=u0.region if u0 else None,
                                    tier=(u0.visa_certification or "UNKNOWN") if u0 else None)
    track(db, "budget_viewed", user_id=p.id, properties={"programs": len(items), "source": source, "housing": housing})
    db.commit()
    return {
        "source": source,
        "items": items,
        "hangyul_fee": fee,
        "funds_to_show": funds,
        "guard": money_svc.PAYMENT_GUARD,
        "announced": money_svc.ANNOUNCED,
        "currency": "KRW",
        "basis_legend": {
            "OFFICIAL": "Published by the university or government and verified by Hangyul",
            "SAMPLE": "Sample data in this demo environment",
            "ESTIMATE": "Hangyul estimate from published typical costs",
            "UNKNOWN": "Applies to most students; no reliable figure yet",
            "ANNOUNCED": "Announced by the government, not yet in force",
        },
    }


OFFER_STATES = (ApplicationStatus.OFFERED, ApplicationStatus.OFFER_ACCEPTED, ApplicationStatus.TUITION_PENDING, ApplicationStatus.TUITION_PAID)


@router.get("/me/offers")
def my_offers(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """V4: each offer with what the student actually pays now (tuition invoice − the offer's scholarship) and the
    first-year range — the facts that differ between offers. Never a recommendation."""
    apps = db.scalars(select(Application).where(Application.student_user_id == p.id, Application.status.in_(OFFER_STATES))
                      .order_by(Application.tuition_due.asc().nulls_last())).all()
    out = []
    for a in apps:
        pr = db.get(Program, a.program_id)
        u = db.get(University, a.university_id)
        dorms = list(db.scalars(select(Dormitory).where(Dormitory.university_id == u.id)))
        tuition = a.tuition_amount_krw if a.tuition_amount_krw is not None else pr.tuition_per_semester_krw
        pay = offer_payment(tuition, a.offer_scholarship_note)
        fy = first_year_range(pr, u, dorms)
        after = None
        if fy["low"] is not None and pay["scholarship"] is not None:
            after = {"low": _round_down(max(0, fy["low"] - pay["scholarship"])), "high": _round_up(max(0, fy["high"] - pay["scholarship"]))}
        out.append({
            "application_id": str(a.id), "status": a.status.value, "university": u.name_en, "university_id": str(u.id), "university_slug": u.slug, "city": u.city,
            "program": pr.name_en, "tuition_due": a.tuition_due.isoformat() if a.tuition_due else None,
            "tuition_is_invoice": a.tuition_amount_krw is not None, "payment": pay,
            "first_year_range_krw": fy, "first_year_after_scholarship_krw": after, "dormitory": bool(dorms),
            # V9 S2: who is paid, when, and what is refundable — with the payment-route guard on tuition.
            "money": money_svc.program_plan(db, p.id, pr)["lines"],
        })
    return {"items": out}


@router.get("/me/money-plan")
def money_plan(program_id: str | None = Query(None), housing: str | None = Query(None, pattern="^(DORM|OFF_CAMPUS)$"),
               p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """V9 S2: one money plan for the student's target program (or ``program_id``): every line with payer → payee, when,
    refundable and basis; the visa "money you must show (not pay)"; the payment-route guard; announced-only rule changes;
    and an open refund case (S8)."""
    prof = get_profile(db, p.id)
    program = None
    if program_id:
        try:
            program = db.get(Program, uuid.UUID(program_id))
        except ValueError:
            program = None
    fee = hangyul_fee(db, p.id, prof.nationality if prof else None)
    out = money_svc.money_plan(db, p.id, program=program, housing=housing, hangyul_fee=fee)
    track(db, "money_plan_viewed", user_id=p.id, properties={"program": bool(out["program"])})
    db.commit()
    return out


@router.get("/meta/fx")
def fx():
    return {"base": "KRW", "as_of": FX_AS_OF, "basis": "SAMPLE", "indicative": True,
            "note": "Indicative sample rates for display only. Your bank's rate on the day you pay will differ.",
            "krw_per_unit": FX_KRW_PER_UNIT}


# ---------------- profile unlocks ----------------

def _count(matches: list[dict], code: str) -> int:
    return sum(1 for m in matches if any(r["code"] == code for r in m["reasons"]))


@router.get("/me/profile/unlocks")
def profile_unlocks(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """What each missing part of the profile would change, computed from the student's own match results."""
    prof = get_profile(db, p.id)
    matches = compute_matches(db, prof, utcnow().date())
    total = len(matches)
    has_lang = any(not lang.is_planned for lang in prof.languages)
    has_gpa = any(e.gpa_percent is not None for e in prof.educations)
    lang_blocked = [m for m in matches if any(r["code"] in ("LANGUAGE_BELOW", "LANGUAGE_GAP_SMALL") for r in m["reasons"])]
    only_lang = [m for m in lang_blocked if all(r["code"] in ("LANGUAGE_BELOW", "LANGUAGE_GAP_SMALL") for r in m["reasons"] if r["kind"] == "missing")]
    topik = max((lng.score for lng in prof.languages if lng.test.value == "TOPIK" and not lng.is_planned), default=None)
    next_level = int(topik) + 1 if topik is not None and topik < 6 else (3 if topik is None else None)
    unlock_next = 0
    if next_level:
        for m in only_lang:
            req = (m["program"].get("requirements") or {})
            need = req.get("min_topik_level")
            if need is not None and need <= next_level:
                unlock_next += 1
    sections = [
        {"key": "basics", "complete": bool(prof.nationality and prof.residence_country),
         "effect": {"kind": "DOCUMENT_ROUTE"}, "count": None},
        {"key": "education", "complete": bool(prof.educations),
         "effect": {"kind": "CONFIRM"}, "count": _count(matches, "EDUCATION_UNKNOWN")},
        {"key": "gpa", "complete": has_gpa, "effect": {"kind": "CONFIRM"}, "count": _count(matches, "GPA_UNKNOWN")},
        {"key": "language", "complete": has_lang,
         "effect": {"kind": "UNBLOCK" if not has_lang else "NEXT_LEVEL", "level": next_level}, "count": len(lang_blocked) if not has_lang else unlock_next},
        {"key": "goals", "complete": bool(prof.target_degree and prof.target_intake_year),
         "effect": {"kind": "FOCUS"}, "count": sum(1 for m in matches if any(r["code"] == "DEGREE_MISMATCH" for r in m["reasons"])) or None},
        {"key": "budget", "complete": prof.annual_budget_krw is not None, "effect": {"kind": "BUDGET_FIT"},
         "count": sum(1 for m in matches if m["eligible"]) if prof.annual_budget_krw is None else None},
        {"key": "documents", "complete": bool(prof.has_passport), "effect": {"kind": "CHECKLIST"}, "count": None},
        {"key": "sponsor", "complete": bool(prof.financial_sponsor), "effect": {"kind": "VISA_FUNDS"}, "count": None},
    ]
    return {"total_programs": total, "sections": sections}


# V9 S3: the student's sponsor-link endpoints live in app/api/v1/sponsor.py and are mounted here (this router is already
# registered by app.main), so no shared module had to change.
from app.api.v1 import sponsor as _sponsor  # noqa: E402

router.include_router(_sponsor.me_router)
