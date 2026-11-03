"""What a student's plan promises, what has been delivered, and what is left (REPORT §117, V29 §380–§390).

The Agency Console cannot operate the plans without this: a counselor has to know what the student bought before
promising a review round or a third managed application.

Decisions that make it trustworthy:

* **The contract is the purchase snapshot, not the catalogue.** Limits come from the student's active
  ``ServiceEngagement`` — a copy of the plan as sold, with its catalogue version. Editing ``plans.ts`` changes what
  the *next* buyer gets; it never rewrites an existing purchase (V29 §7).
* **Usage is derived, never counted into a column.** ``used`` comes from the records that prove the work happened.
* **``limit = None`` means "not rationed within the contracted scope", never globally unlimited.** Premium's
  editing is bounded by document type (statement / study plan), by application (the contracted, managed ones) and by
  the service term. Anything outside is out of scope and needs a paid extra (``OutOfScope.reason``).
* **Add-ons raise a limit only once paid.** An ``ACTIVE``/``COMPLETED`` ``ServiceAddOn`` is a delta on one key; an
  ``OFFERED`` or ``AWAITING_PAYMENT`` one grants nothing.
* **No plan, no paid work.** Managed applications, editing rounds and mock interviews are paid services; a student
  without a plan may explore, save and draft, but staff cannot spend those services on them.
"""
from __future__ import annotations

import json
from datetime import timedelta
from functools import lru_cache
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AddOnStatus,
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Appointment,
    Essay,
    EssayReview,
    Order,
    SavedUniversity,
    ServiceAddOn,
    ServiceEngagement,
    ServiceProduct,
)
from app.models.base import utcnow

_ROOT = Path(__file__).resolve().parents[3] / "shared"
_SHARED = _ROOT / "plans.json"

#: Statuses of an add-on that has been paid for and therefore counts.
GRANTING = (AddOnStatus.ACTIVE, AddOnStatus.COMPLETED)

#: The mock-interview appointment kind the console books ("모의 면접" in the agency UI).
MOCK_KIND = "INTERVIEW_PREP"


@lru_cache(maxsize=1)
def manifest() -> dict:
    """``shared/plans.json``, generated from packages/types/src/plans.ts. The seed's only source of numbers."""
    return json.loads(_SHARED.read_text())


@lru_cache(maxsize=8)
def catalog(version: str) -> dict:
    """A catalogue by version: the current one, or a frozen one under ``shared/plan-catalog/``."""
    if version == manifest()["catalog"]["version"]:
        return manifest()
    return json.loads((_ROOT / "plan-catalog" / f"{version}.json").read_text())


def catalog_version() -> str:
    return manifest()["catalog"]["version"]


def plan_defs() -> list[dict]:
    return sorted(manifest()["plans"], key=lambda p: p["sort_order"])


def plan_def(code: str, version: str | None = None) -> dict | None:
    return next((p for p in catalog(version or catalog_version())["plans"] if p["code"] == code), None)


def counted_keys() -> tuple[str, ...]:
    return tuple(manifest()["counted_entitlements"])


def contracted_essay_types() -> frozenset[str]:
    return frozenset(manifest()["contracted_essay_types"])


#: Keys for which a counselor may offer an add-on — derived from the catalogue, never listed twice.
def add_on_keys() -> frozenset[str]:
    return frozenset(a["effect"]["key"] for a in manifest()["add_ons"] if a["effect"]["kind"] == "ENTITLEMENT")


def add_on_for_key(key: str) -> dict | None:
    return next((a for a in manifest()["add_ons"] if a["effect"]["kind"] == "ENTITLEMENT" and a["effect"]["key"] == key), None)


def snapshot(plan: dict, *, amount_minor: int, currency: str) -> dict:
    """What an order freezes: the plan exactly as sold, at the price actually charged."""
    return {"catalog_version": catalog_version(), "code": plan["code"], "name_ko": plan["name_ko"], "name_en": plan["name_en"],
            "amount_minor": amount_minor, "currency": currency, "entitlements": dict(plan["entitlements"]),
            "cells": plan.get("cells")}


# ------------------------------------------------------------------------------------------------ engagement

def active_engagement(db: Session, user_id) -> ServiceEngagement | None:
    """The plan instance this student is served under — the ACTIVE engagement, highest plan first."""
    rows = db.scalars(select(ServiceEngagement).where(ServiceEngagement.user_id == user_id, ServiceEngagement.status == "ACTIVE")
                      .order_by(ServiceEngagement.created_at.desc())).all()
    if not rows:
        return None
    order = {p["code"]: p["sort_order"] for p in plan_defs()}
    return max(rows, key=lambda e: (order.get(e.product_code, -1), e.created_at))


def start_engagement(db: Session, order: Order, prod: ServiceProduct) -> ServiceEngagement:
    """Create the service instance a PAID plan order buys, superseding any lower one. Idempotent per order."""
    existing = db.scalar(select(ServiceEngagement).where(ServiceEngagement.order_id == order.id))
    if existing is not None:
        return existing
    snap = order.plan_snapshot or snapshot(plan_def(prod.code) or {"code": prod.code, "name_ko": prod.name_ko, "name_en": prod.name_en,
                                                                   "entitlements": prod.entitlements or {}},
                                           amount_minor=order.amount_minor, currency=order.currency)
    if order.plan_snapshot is None:
        order.plan_snapshot, order.catalog_version = snap, snap["catalog_version"]
    now = utcnow()
    eng = ServiceEngagement(user_id=order.user_id, order_id=order.id, product_code=prod.code,
                            catalog_version=snap["catalog_version"], entitlements=dict(snap["entitlements"]), plan_snapshot=snap,
                            purchase_terms_version=order.purchase_terms_version, status="ACTIVE", created_at=now, updated_at=now)
    db.add(eng)
    db.flush()
    for prev in db.scalars(select(ServiceEngagement).where(ServiceEngagement.user_id == order.user_id, ServiceEngagement.status == "ACTIVE",
                                                           ServiceEngagement.id != eng.id)):
        prev.status, prev.superseded_by_id = "SUPERSEDED", eng.id
        # An upgrade continues the same service: its dates carry over rather than restarting the clock.
        for f in ("service_started_at", "service_ends_at", "arrival_at"):
            if getattr(eng, f) is None and getattr(prev, f) is not None:
                setattr(eng, f, getattr(prev, f))
        eng.dedicated_owner_user_id = eng.dedicated_owner_user_id or prev.dedicated_owner_user_id
    recompute_dates(eng)
    return eng


def recompute_dates(eng: ServiceEngagement) -> None:
    """Derived dates — the support window and the Premium arrival window — from the explicit ones."""
    e = eng.entitlements or {}
    if e.get("support_window_type") == "DAYS" and eng.service_started_at and e.get("support_window_days"):
        eng.support_window_ends_at = eng.service_started_at + timedelta(days=int(e["support_window_days"]))
    elif e.get("support_window_type") == "CONTRACT_TERM":
        eng.support_window_ends_at = eng.service_ends_at
    else:
        eng.support_window_ends_at = None
    if eng.arrival_at and int(e.get("pre_arrival_support_days") or 0) > 0:
        eng.pre_arrival_starts_at = eng.arrival_at - timedelta(days=int(e["pre_arrival_support_days"]))
    else:
        eng.pre_arrival_starts_at = None
    if eng.arrival_at and int(e.get("settlement_days") or 0) > 0:
        eng.settlement_ends_at = eng.arrival_at + timedelta(days=int(e["settlement_days"]))
    else:
        eng.settlement_ends_at = None


def term_ended(eng: ServiceEngagement | None, now=None) -> bool:
    return bool(eng and eng.service_ends_at and (now or utcnow()) > eng.service_ends_at)


def purchased_product(db: Session, user_id) -> ServiceProduct | None:
    """The catalogue row of the plan this student is served under (for names and prices — never for limits)."""
    eng = active_engagement(db, user_id)
    if eng is None:
        return None
    return db.scalar(select(ServiceProduct).where(ServiceProduct.code == eng.product_code))


def entitlements_of(db: Session, user_id) -> dict | None:
    eng = active_engagement(db, user_id)
    return dict(eng.entitlements or {}) if eng else None


def add_on_grants(db: Session, user_id, *, targeted: bool = False) -> dict[str, int]:
    """Paid add-on quantities per entitlement key. ``targeted`` selects grants bought for one record."""
    q = (select(ServiceAddOn.entitlement_key, func.sum(ServiceAddOn.quantity))
         .where(ServiceAddOn.user_id == user_id, ServiceAddOn.status.in_(GRANTING), ServiceAddOn.entitlement_key.is_not(None)))
    q = q.where(ServiceAddOn.subject_id.is_not(None) if targeted else ServiceAddOn.subject_id.is_(None))
    return {k: int(n or 0) for k, n in db.execute(q.group_by(ServiceAddOn.entitlement_key)).all()}


def _targeted_grant(db: Session, user_id, key: str, subject_id) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(ServiceAddOn.quantity), 0)).where(
        ServiceAddOn.user_id == user_id, ServiceAddOn.status.in_(GRANTING), ServiceAddOn.entitlement_key == key,
        ServiceAddOn.subject_id == subject_id)) or 0)


# ------------------------------------------------------------------------------------------------ usage

#: An application counts against 지원 학교 관리 once Hangyul is actually managing it.
_MANAGED_STATUSES = tuple(s for s in ApplicationStatus if s is not ApplicationStatus.DRAFT)


def managed_application_ids(db: Session, user_id) -> set:
    """Applications that consumed a managed slot: left DRAFT, or withdrawn after real work (V17)."""
    live = set(db.scalars(select(Application.id).where(
        Application.student_user_id == user_id, Application.status.in_(_MANAGED_STATUSES),
        Application.status != ApplicationStatus.WITHDRAWN)))
    worked = set(db.scalars(select(Application.id).where(
        Application.student_user_id == user_id, Application.status == ApplicationStatus.WITHDRAWN,
        select(func.count()).select_from(ApplicationStatusHistory)
        .where(ApplicationStatusHistory.application_id == Application.id,
               ApplicationStatusHistory.to_status.not_in((ApplicationStatus.DRAFT, ApplicationStatus.WITHDRAWN)))
        .scalar_subquery() > 0)))
    return live | worked


def essay_scope(db: Session, essay: Essay, ent: dict | None, eng: ServiceEngagement | None = None) -> str | None:
    """``None`` when this essay is inside the plan's contracted editing scope, else the reason it is not.

    NOT_INCLUDED   the plan includes no editing (Basic) or there is no plan
    NEW_DOCUMENT   not a personal statement / study plan (CV, recommendation …) — never part of any plan
    UNMANAGED_APPLICATION  written for an application outside the managed allowance
    SERVICE_PERIOD_ENDED   the contracted term is over
    """
    if not ent or ent.get("essay_review_scope", "ROUNDS" if (ent.get("essay_review_rounds") or 0) > 0 else "NONE") == "NONE":
        return "NOT_INCLUDED"
    if essay.essay_type.value not in contracted_essay_types():
        return "NEW_DOCUMENT"
    if term_ended(eng):
        return "SERVICE_PERIOD_ENDED"
    if essay.application_id is not None:
        app = db.get(Application, essay.application_id)
        managed = managed_application_ids(db, essay.owner_user_id)
        if app is None or app.status == ApplicationStatus.WITHDRAWN and app.id not in managed:
            return "UNMANAGED_APPLICATION"
        if app.id not in managed:
            # A draft is contracted only while a managed slot is still free for it.
            limit = int(ent.get("max_managed_applications") or 0) + add_on_grants(db, essay.owner_user_id).get("max_managed_applications", 0)
            if len(managed) >= limit:
                return "UNMANAGED_APPLICATION"
    return None


def _in_scope_rounds(db: Session, user_id, ent: dict | None, eng) -> int:
    """The deepest review round any in-scope essay has reached — a round is a pass over the writing (V15)."""
    rows = db.execute(select(Essay, func.coalesce(func.max(EssayReview.review_round), 0)).join(EssayReview, EssayReview.essay_id == Essay.id)
                      .where(Essay.owner_user_id == user_id).group_by(Essay.id)).all()
    return max((int(r) for e, r in rows if essay_scope(db, e, ent, eng) is None), default=0)


def _used(db: Session, user_id, key: str, ent: dict | None = None, eng=None) -> int:
    """How much of one allowance has actually been delivered, read from the record that proves it."""
    if key == "max_managed_applications":
        return len(managed_application_ids(db, user_id))
    if key == "essay_review_rounds":
        return _in_scope_rounds(db, user_id, ent, eng)
    if key == "mock_interviews":
        # Booked counts: a scheduled mock interview is committed work, so a second cannot be booked on one included.
        return db.scalar(select(func.count()).select_from(Appointment).where(
            Appointment.student_user_id == user_id, Appointment.kind == MOCK_KIND,
            Appointment.status.in_(("SCHEDULED", "COMPLETED")))) or 0
    if key in ("consultation_sessions", "follow_up_consultations"):
        # The first consultation is the diagnostic one; every later one is a follow-up.
        n = db.scalar(select(func.count()).select_from(Appointment).where(
            Appointment.student_user_id == user_id, Appointment.kind == "CONSULTATION",
            Appointment.status.in_(("SCHEDULED", "COMPLETED")))) or 0
        return min(n, 1) if key == "consultation_sessions" else max(0, n - 1)
    if key == "max_recommended_institutions":
        return db.scalar(select(func.count()).select_from(SavedUniversity).where(
            SavedUniversity.user_id == user_id, SavedUniversity.source == "HANGYUL")) or 0
    return 0


def usage(db: Session, user_id, eng: ServiceEngagement | None) -> list[dict]:
    """``[{key, limit, used, remaining, from_add_ons, scope}]`` for every counted allowance in the contract."""
    if eng is None:
        return []
    ent = eng.entitlements or {}
    grants = add_on_grants(db, user_id)
    out = []
    for key in counted_keys():
        if key not in ent:  # a legacy contract that did not sell this allowance
            continue
        base = ent.get(key)
        extra = grants.get(key, 0)
        limit = None if base is None else int(base) + extra
        used = _used(db, user_id, key, ent, eng)
        out.append({"key": key, "limit": limit, "used": used, "remaining": None if limit is None else max(0, limit - used),
                    "from_add_ons": extra,
                    "scope": ent.get("essay_review_scope") if key == "essay_review_rounds" else
                    ent.get("follow_up_level") if key == "follow_up_consultations" else None})
    return out


def _iso(d):
    return d.isoformat() if d else None


def engagement_payload(eng: ServiceEngagement, now=None) -> dict:
    now = now or utcnow()
    days_left = None
    if eng.support_window_ends_at and eng.support_window_ends_at > now:
        days_left = max(0, (eng.support_window_ends_at - now).days + (1 if (eng.support_window_ends_at - now).seconds else 0))
    phase = None
    if eng.arrival_at and eng.pre_arrival_starts_at:
        phase = ("BEFORE_PRE_ARRIVAL" if now < eng.pre_arrival_starts_at else "PRE_ARRIVAL" if now < eng.arrival_at
                 else "SETTLEMENT" if eng.settlement_ends_at and now <= eng.settlement_ends_at else "SETTLEMENT_ENDED")
    return {
        "id": str(eng.id), "status": eng.status, "catalog_version": eng.catalog_version, "product_code": eng.product_code,
        "purchase_terms_version": eng.purchase_terms_version,
        "service_started_at": _iso(eng.service_started_at), "support_window_ends_at": _iso(eng.support_window_ends_at),
        "service_ends_at": _iso(eng.service_ends_at), "support_days_left": days_left,
        "term_ended": term_ended(eng, now),
        "arrival_at": _iso(eng.arrival_at), "pre_arrival_starts_at": _iso(eng.pre_arrival_starts_at),
        "settlement_ends_at": _iso(eng.settlement_ends_at), "arrival_phase": phase,
        "is_current_catalog": eng.catalog_version == catalog_version(),
    }


def add_on_payload(a: ServiceAddOn) -> dict:
    return {"id": str(a.id), "code": a.code, "entitlement_key": a.entitlement_key, "quantity": a.quantity,
            "status": a.status.value, "amount_minor": a.amount_minor, "unit_amount_minor": a.unit_amount_minor,
            "currency": a.currency, "scope": a.scope, "note": a.note, "subject_type": a.subject_type,
            "subject_id": str(a.subject_id) if a.subject_id else None, "order_id": str(a.order_id) if a.order_id else None,
            "case_id": str(a.case_id) if a.case_id else None, "catalog_version": a.catalog_version,
            "created_at": a.created_at.isoformat(), "paid_at": _iso(a.paid_at), "activated_at": _iso(a.activated_at),
            "completed_at": _iso(a.completed_at)}


def student_plan(db: Session, user_id, *, staff: bool = False) -> dict | None:
    """The student's commercial state, as both the student app and the agency console read it."""
    eng = active_engagement(db, user_id)
    if eng is None:
        return None
    snap = eng.plan_snapshot or {}
    order = db.get(Order, eng.order_id) if eng.order_id else None
    add_ons = db.scalars(select(ServiceAddOn).where(ServiceAddOn.user_id == user_id).order_by(ServiceAddOn.created_at.desc())).all()
    out = {
        "code": eng.product_code,
        "name_ko": snap.get("name_ko") or eng.product_code,
        "name_en": snap.get("name_en") or eng.product_code,
        "amount_minor": snap.get("amount_minor", order.amount_minor if order else 0),
        "currency": snap.get("currency", order.currency if order else "USD"),
        "purchased_at": _iso(order.paid_at) if order else None,
        "catalog_version": eng.catalog_version,
        "entitlements": eng.entitlements or {},
        "engagement": engagement_payload(eng),
        "usage": usage(db, user_id, eng),
        "add_ons": [add_on_payload(a) for a in add_ons],
    }
    if staff:
        out["dedicated_owner_user_id"] = str(eng.dedicated_owner_user_id) if eng.dedicated_owner_user_id else None
    return out


# ------------------------------------------------------------------------------------------------ guards

def _limit_reached(user_id, key: str, reason: str) -> None:
    """``service_limit_reached`` — written in its own session, because the refusal rolls the request's session back."""
    try:
        from app.core.audit import track
        from app.core.db import SessionLocal

        with SessionLocal() as s:
            track(s, "service_limit_reached", user_id=user_id, properties={"key": key, "reason": reason})
            s.commit()
    except Exception:  # analytics must never turn a clear refusal into a 500
        pass


class OutOfScope(Exception):
    """The action is outside the purchased contract.

    Carries what the UI needs to say *why* and offer the one legitimate next step (an add-on, or a conversation):
    never silently block, never an internal error.
    """

    def __init__(self, key: str, limit: int | None, used: int, add_on_available: bool, reason: str = "LIMIT_REACHED"):
        super().__init__(f"{key}: {used}/{limit} ({reason})")
        self.key, self.limit, self.used, self.add_on_available, self.reason = key, limit, used, add_on_available, reason

    def record(self, user_id) -> OutOfScope:
        _limit_reached(user_id, self.key, self.reason)
        return self

    def as_detail(self) -> dict:
        a = add_on_for_key(self.key)
        return {"error": "entitlement_exceeded", "entitlement_key": self.key, "limit": self.limit, "used": self.used,
                "reason": self.reason, "add_on_available": self.add_on_available, "add_on_code": a["code"] if a and self.add_on_available else None}


def check(db: Session, user_id, key: str, *, additional: int = 1, prospective: int | None = None) -> None:
    """Raise :class:`OutOfScope` if this action would take ``key`` past the effective limit.

    ``prospective`` is the value the allowance would reach **after** the action, for keys whose usage is not a running
    total (editing rounds — the deepest round, see ``_in_scope_rounds``).
    """
    eng = active_engagement(db, user_id)
    avail = key in add_on_keys()
    if eng is None:
        raise OutOfScope(key, 0, 0, False, "NO_PLAN").record(user_id)
    if term_ended(eng):
        raise OutOfScope(key, None, _used(db, user_id, key, eng.entitlements, eng), False, "SERVICE_PERIOD_ENDED").record(user_id)
    ent = eng.entitlements or {}
    base = ent.get(key, 0)
    if base is None:
        return  # not rationed within the contract (scope is checked by the caller, e.g. check_essay)
    limit = int(base) + add_on_grants(db, user_id).get(key, 0)
    used = _used(db, user_id, key, ent, eng)
    after = prospective if prospective is not None else used + additional
    if after > limit:
        raise OutOfScope(key, limit, used, avail, "LIMIT_REACHED" if int(base) > 0 or limit > 0 else "NOT_INCLUDED").record(user_id)


def check_essay(db: Session, essay: Essay) -> None:
    """Guard one more review round on this essay — the contract's editing scope, then its count.

    In scope (statement / study plan, contracted application, inside the term): All-in-One counts rounds against
    2 + paid extras; Premium is not rationed. Out of scope: every round needs a paid extra **for this essay**, on
    any plan — Premium's "unlimited" never reaches an unrelated or new document.
    """
    eng = active_engagement(db, essay.owner_user_id)
    ent = eng.entitlements if eng else None
    reason = essay_scope(db, essay, ent, eng)
    mine = int(db.scalar(select(func.coalesce(EssayReview.review_round, 0)).where(EssayReview.essay_id == essay.id)) or 0)
    if reason is None:
        check(db, essay.owner_user_id, "essay_review_rounds", prospective=essay_round_after(db, essay.id, ent, eng))
        return
    if eng is None:
        raise OutOfScope("essay_review_rounds", 0, 0, False, "NO_PLAN").record(essay.owner_user_id)
    if reason == "SERVICE_PERIOD_ENDED":
        raise OutOfScope("essay_review_rounds", None, mine, False, reason).record(essay.owner_user_id)
    paid = _targeted_grant(db, essay.owner_user_id, "essay_review_rounds", essay.id)
    if reason == "NOT_INCLUDED":
        # Basic: every round is an extra, pooled (untargeted) or bought for this essay.
        paid += add_on_grants(db, essay.owner_user_id).get("essay_review_rounds", 0)
    if mine + 1 > paid:
        raise OutOfScope("essay_review_rounds", paid, mine, True, reason).record(essay.owner_user_id)


def essay_round_after(db: Session, essay_id, ent: dict | None = None, eng=None) -> int:
    """What the in-scope ``essay_review_rounds`` usage becomes if this essay is submitted once more."""
    essay = db.get(Essay, essay_id)
    if ent is None and essay is not None:
        eng = active_engagement(db, essay.owner_user_id)
        ent = eng.entitlements if eng else None
    current = _in_scope_rounds(db, essay.owner_user_id, ent, eng) if essay else 0
    mine = db.scalar(select(func.coalesce(EssayReview.review_round, 0)).where(EssayReview.essay_id == essay_id)) or 0
    return max(int(current), int(mine) + 1)
