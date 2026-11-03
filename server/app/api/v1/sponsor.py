"""V9 sponsor view (REPORT §58 S3) — what the family needs to pay, show and know.

Student endpoints (mounted on the journey router, prefix /me):
  POST /me/sponsor-links            create a read-only link with chosen scopes (default 30 days) — records consent
  GET  /me/sponsor-links            the student's links: scopes, expiry, last opened, views (never the token)
  POST /me/sponsor-links/{id}/revoke

Public endpoint (mounted on the public router, prefix /public):
  GET  /public/sponsor/{token}      no login. 404 when unknown, revoked or expired. Every view is recorded.

Never in the payload: messages, essays, counselor notes, document files, contact details, passport data.
"""
from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, require_student
from app.models import Application, ArrivalPlan, ConsentRecord, HousingCase, Program, ProgramIntake, University, User, VisaCase
from app.models.enums import ApplicationStatus as S
from app.models.v9_sponsor import SPONSOR_SCOPES, SponsorLink, SponsorLinkView
from app.services import money as money_svc
from app.services.state_machine import TERMINAL, reached

me_router = APIRouter(prefix="/me", tags=["sponsor"])
public_router = APIRouter(tags=["sponsor"])  # mounted under the /public router

CONSENT_PURPOSE = "SPONSOR_VIEW"
CONSENT_VERSION = "v9-2026-10"
DEFAULT_DAYS = 30
MAX_DAYS = 90
MAX_ACTIVE = 5
LOCALE_RE = r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$"
FAMILY_CATEGORIES = {"BANK_STATEMENT", "FAMILY_RELATION_CERTIFICATE", "SPONSOR_DOCUMENT", "EMPLOYMENT_INCOME_PROOF", "BIRTH_CERTIFICATE"}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(v) -> str | None:
    return v.isoformat() if v else None


def link_state(link: SponsorLink, now: datetime | None = None) -> str:
    now = now or _now()
    if link.revoked_at:
        return "REVOKED"
    if link.expires_at <= now:
        return "EXPIRED"
    return "ACTIVE"


def ser_link(link: SponsorLink) -> dict:
    return {"id": str(link.id), "label": link.label, "scopes": list(link.scopes or []), "locale": link.locale, "state": link_state(link),
            "created_at": _iso(link.created_at), "expires_at": _iso(link.expires_at), "revoked_at": _iso(link.revoked_at),
            "last_viewed_at": _iso(link.last_viewed_at), "view_count": link.view_count or 0}


class LinkIn(BaseModel):
    scopes: list[str] = Field(min_length=1, max_length=len(SPONSOR_SCOPES))
    label: str | None = Field(None, max_length=80)
    days: int = Field(DEFAULT_DAYS, ge=1, le=MAX_DAYS)
    locale: str | None = Field(None, pattern=LOCALE_RE)

    @field_validator("scopes")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        bad = [s for s in v if s not in SPONSOR_SCOPES]
        if bad:
            raise ValueError(f"Unknown scope: {', '.join(bad)}")
        return list(dict.fromkeys(v))


@me_router.post("/sponsor-links", status_code=201)
def create_link(body: LinkIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    now = _now()
    active = [lk for lk in db.scalars(select(SponsorLink).where(SponsorLink.student_user_id == p.id)) if link_state(lk, now) == "ACTIVE"]
    if len(active) >= MAX_ACTIVE:
        raise HTTPException(409, f"You already have {MAX_ACTIVE} active family links. Turn one off first.")
    token = secrets.token_urlsafe(24)
    link = SponsorLink(student_user_id=p.id, token_hash=_hash(token), label=(body.label or "").strip() or None, scopes=body.scopes,
                       locale=body.locale or p.user.locale or "en", expires_at=now + timedelta(days=body.days), created_at=now, updated_at=now)
    db.add(link)
    db.flush()
    # Consent: the student chose to share these parts with a person outside Hangyul.
    db.add(ConsentRecord(user_id=p.id, purpose=CONSENT_PURPOSE, version=CONSENT_VERSION, granted=True, scope_org_id=None, created_at=now))
    audit(db, action="sponsor_link.create", entity_type="sponsor_link", entity_id=link.id, actor=p, subject_user_id=p.id,
          detail={"scopes": body.scopes, "days": body.days})
    track(db, "sponsor_link_created", user_id=p.id, properties={"scopes": len(body.scopes), "days": body.days})
    db.commit()
    return {**ser_link(link), "token": token, "path": f"/sponsor/{token}"}


@me_router.get("/sponsor-links")
def list_links(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    links = db.scalars(select(SponsorLink).where(SponsorLink.student_user_id == p.id).order_by(SponsorLink.created_at.desc())).all()
    return {"items": [ser_link(lk) for lk in links], "scopes": list(SPONSOR_SCOPES), "default_days": DEFAULT_DAYS, "max_days": MAX_DAYS}


@me_router.post("/sponsor-links/{link_id}/revoke")
def revoke_link(link_id: str, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    try:
        lid = uuid.UUID(link_id)
    except ValueError:
        raise HTTPException(404, "Link not found.") from None
    link = db.get(SponsorLink, lid)
    if link is None or link.student_user_id != p.id:
        raise HTTPException(404, "Link not found.")
    if link.revoked_at is None:
        link.revoked_at = _now()
        db.add(ConsentRecord(user_id=p.id, purpose=CONSENT_PURPOSE, version=CONSENT_VERSION, granted=False, scope_org_id=None, created_at=link.revoked_at))
        audit(db, action="sponsor_link.revoke", entity_type="sponsor_link", entity_id=link.id, actor=p, subject_user_id=p.id)
    db.commit()
    return ser_link(link)


# ------------------------------------------------------------------------------------------------ public view
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limited(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 60:
        raise HTTPException(429, "Too many requests. Please wait a minute.")
    q.append(now)


def _money(db: Session, sid) -> dict:
    plan = money_svc.money_plan(db, sid)
    # The sponsor sees the plan, never Hangyul's internal order details.
    if plan.get("program"):
        plan["program"]["lines"] = [ln for ln in plan["program"]["lines"] if ln["key"] != "hangyul_fee"]
    return plan


def _family_documents(db: Session, sid) -> dict:
    from app.services import visa_routes

    try:
        plan = visa_routes.resolve(db, sid)
    except Exception:  # noqa: BLE001 — a sponsor page must never fail on the visa resolver
        plan = {"status": "UNAVAILABLE", "documents": []}
    items = []
    for d in plan.get("documents") or []:
        if d.get("applies") == "no":
            continue
        if d.get("provided_by") in ("sponsor", "bank") or (d.get("category") in FAMILY_CATEGORIES):
            ready = d.get("status") in ("READY", "NEAR_EXPIRY")
            items.append({"key": d["key"], "category": d.get("category"), "who": d.get("who"), "applies": d.get("applies"),
                          "ready": ready, "status": d.get("status"), "validity_days": d.get("validity_days")})
    return {"status": plan.get("status"), "visa_type": (plan.get("inputs") or {}).get("visa_type"), "items": items}


def _dates(db: Session, sid, today: date) -> list[dict]:
    out = []
    for a in db.scalars(select(Application).where(Application.student_user_id == sid)):
        if a.status in TERMINAL:
            continue
        u = db.get(University, a.university_id)
        intake = db.get(ProgramIntake, a.intake_id)
        if intake and not reached(a.status, S.SUBMITTED) and intake.application_deadline and intake.application_deadline >= today:
            out.append({"kind": "APPLICATION_DEADLINE", "date": intake.application_deadline.isoformat(), "university": u.name_en, "university_id": str(u.id)})
        due = a.tuition_due or (intake.tuition_deadline if intake else None)
        if a.status in (S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING) and due:
            out.append({"kind": "TUITION_DUE", "date": due.isoformat(), "university": u.name_en, "university_id": str(u.id)})
        if intake and intake.semester_start and intake.semester_start >= today and reached(a.status, S.OFFER_ACCEPTED):
            out.append({"kind": "SEMESTER_START", "date": intake.semester_start.isoformat(), "university": u.name_en, "university_id": str(u.id)})
    from app.models.v5_visa_routes import VisaCaseTrack

    visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid).order_by(VisaCase.created_at.desc()))
    track_ = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == visa.id)) if visa else None
    if track_ and track_.appointment_on and track_.appointment_on >= today:
        out.append({"kind": "VISA_APPOINTMENT", "date": track_.appointment_on.isoformat(), "university": None})
    plan = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == sid))
    if plan and plan.arrival_at and plan.arrival_at.date() >= today:
        out.append({"kind": "ARRIVAL", "date": plan.arrival_at.date().isoformat(), "university": None})
    out.sort(key=lambda x: x["date"])
    return out[:10]


def _progress(db: Session, sid) -> dict:
    from app.services import visa_routes

    apps = []
    for a in db.scalars(select(Application).where(Application.student_user_id == sid).order_by(Application.updated_at.desc())):
        u = db.get(University, a.university_id)
        pr = db.get(Program, a.program_id)
        apps.append({"university": u.name_en, "university_id": str(u.id), "program": pr.name_en if pr else None, "status": a.status.value})
    visa = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid).order_by(VisaCase.created_at.desc()))
    return {"applications": apps[:6], "visa": {"status": visa_routes.DISPLAY.get(visa.status, "PREPARING"), "visa_type": visa.visa_type.value} if visa else None}


def _arrival(db: Session, sid) -> dict:
    plan = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == sid))
    housing = db.scalar(select(HousingCase).where(HousingCase.student_user_id == sid))
    return {"arrival_at": _iso(plan.arrival_at) if plan else None, "arrived": bool(plan and plan.arrived_at),
            "pickup": plan.pickup_status if plan else None, "housing": housing.status.value if housing else None,
            "residence_card_due": _iso(plan.residence_card_due) if plan else None}


def sponsor_payload(db: Session, link: SponsorLink, *, today: date | None = None) -> dict:
    today = today or date.today()
    sid = link.student_user_id
    user = db.get(User, sid)
    scopes = set(link.scopes or [])
    out: dict = {
        "student": {"first_name": (user.preferred_name or (user.full_name or "").split(" ")[0]) if user else None},
        "scopes": [s for s in SPONSOR_SCOPES if s in scopes], "locale": link.locale, "expires_at": _iso(link.expires_at), "as_of": today.isoformat(),
    }
    if "money" in scopes:
        out["money"] = _money(db, sid)
    if "family_documents" in scopes:
        out["family_documents"] = _family_documents(db, sid)
    if "dates" in scopes:
        out["dates"] = _dates(db, sid, today)
    if "progress" in scopes:
        out["progress"] = _progress(db, sid)
    if "arrival" in scopes:
        out["arrival"] = _arrival(db, sid)
    return out


@public_router.get("/sponsor/{token}", dependencies=[Depends(_rate_limited)])
def sponsor_view(token: str, request: Request, lang: str | None = Query(None, pattern=LOCALE_RE), db: Session = Depends(get_db)):
    if not token or len(token) > 128:
        raise HTTPException(404, "This link is not valid.")
    link = db.scalar(select(SponsorLink).where(SponsorLink.token_hash == _hash(token)))
    now = _now()
    if link is None or link_state(link, now) != "ACTIVE":
        # Unknown, revoked and expired links look the same from outside.
        raise HTTPException(404, "This link is not valid.")
    payload = sponsor_payload(db, link)
    link.last_viewed_at = now
    link.view_count = (link.view_count or 0) + 1
    db.add(SponsorLinkView(link_id=link.id, viewed_at=now, locale=lang or link.locale,
                           user_agent=(request.headers.get("user-agent") or "")[:120] or None))
    audit(db, action="sponsor_link.view", entity_type="sponsor_link", entity_id=link.id, actor=None, subject_user_id=link.student_user_id,
          detail={"locale": lang or link.locale})
    db.commit()
    return payload
