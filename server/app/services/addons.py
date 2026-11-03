"""Additional paid services — the V29 add-on catalogue as a state machine (REPORT §390, brief §4–§5, §19).

    staff offers (catalogue code, quantity, an exact unit price inside the range, or a quote with a scope)
      → OFFERED            the student sees service, scope, quantity and the actual USD amount; nothing granted
      → AWAITING_PAYMENT   the student approved; an ADD_ON order exists; still nothing granted
      → ACTIVE             the order is PAID: the allowance is raised, or a real service case is opened
      → COMPLETED          the service case it opened is done
    DECLINED / CANCELLED are terminal and blameless.

**A range is never a charge.** The catalogue states a recommended minimum and maximum; an offer carries one exact
unit price the operator chose inside it, and `amount_minor = unit × quantity` is the only number the student is
ever asked to pay. A quote-based service has no default price at all.

The catalogue lives in ``packages/types/src/plans.ts`` (``ADD_ONS``) → ``shared/plans.json``. This module never
lists a code, a range or an effect of its own.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit, track
from app.models import AddOnStatus, Essay, Order, OrderStatus, ServiceAddOn, ServiceProduct
from app.models.base import utcnow
from app.services import entitlements as ent_svc


def catalogue() -> list[dict]:
    return sorted(ent_svc.manifest()["add_ons"], key=lambda a: a["sort_order"])


def definition(code: str) -> dict | None:
    return next((a for a in catalogue() if a["code"] == code), None)


def price_allowed(defn: dict, unit_minor: int | None) -> bool:
    """The server's copy of ``addOnPriceAllowed`` — inside the range, or any positive quote."""
    if not isinstance(unit_minor, int) or unit_minor <= 0:
        return False
    p = defn["pricing"]
    return p["kind"] == "QUOTE" or p["min_minor"] <= unit_minor <= p["max_minor"]


def _refuse(code: str, message: str, status: int = 422, **extra) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message, **extra})


def offer(db: Session, actor, student_id, *, code: str, quantity: int, unit_amount_minor: int | None, scope: str | None,
          note: str | None, subject_type: str | None = None, subject_id=None) -> ServiceAddOn:
    defn = definition(code)
    if defn is None:
        raise _refuse("ADD_ON_UNKNOWN", "This is not a service in the current catalogue.")
    eng = ent_svc.active_engagement(db, student_id)
    if eng is None:
        raise _refuse("ADD_ON_NO_PLAN", "Additional services extend a purchased plan; this student has none.", 409)
    if not 1 <= quantity <= int(defn["max_quantity"]):
        raise _refuse("ADD_ON_QUANTITY", f"Quantity must be between 1 and {defn['max_quantity']}.")
    if not price_allowed(defn, unit_amount_minor):
        p = defn["pricing"]
        raise _refuse("ADD_ON_PRICE_OUT_OF_RANGE",
                      "Set the price inside the recommended range." if p["kind"] == "RANGE" else "A quoted service needs a price.",
                      range={"min_minor": p.get("min_minor"), "max_minor": p.get("max_minor"), "kind": p["kind"]})
    if defn["requires_scope"] and not (scope and scope.strip()):
        raise _refuse("ADD_ON_SCOPE_REQUIRED", "A quoted service needs its agreed scope written out.")
    effect = defn["effect"]
    ent = eng.entitlements or {}
    if effect["kind"] == "ENTITLEMENT":
        key = effect["key"]
        if key == "essay_review_rounds":
            essay = db.get(Essay, subject_id) if subject_type == "essay" and subject_id else None
            if subject_type == "essay" and (essay is None or essay.owner_user_id != student_id):
                raise _refuse("ADD_ON_SUBJECT", "That essay does not belong to this student.", 404)
            in_scope = essay is not None and ent_svc.essay_scope(db, essay, ent, eng) is None
            # Premium's in-scope editing is already included: selling a round for it would charge for the contract.
            if ent.get(key, 0) is None and (essay is None or in_scope):
                raise _refuse("ADD_ON_INCLUDED", "Editing inside the contracted documents and schedule is already included in this plan.")
        if key == "mock_interviews":
            used = ent_svc._used(db, student_id, key, ent, eng)
            if used < int(ent.get(key) or 0):
                raise _refuse("ADD_ON_INCLUDED", "The plan's included mock interview has not been used yet.")
    row = ServiceAddOn(user_id=student_id, code=code, entitlement_key=effect.get("key"), quantity=quantity,
                       status=AddOnStatus.OFFERED, unit_amount_minor=unit_amount_minor, amount_minor=unit_amount_minor * quantity,
                       currency=defn["pricing"]["currency"], scope=(scope or "").strip() or None, note=note,
                       subject_type=subject_type, subject_id=subject_id, offered_by_user_id=getattr(actor, "id", None),
                       catalog_version=ent_svc.catalog_version())
    db.add(row)
    db.flush()
    audit(db, action="addon.offer", entity_type="service_add_on", entity_id=row.id, actor=actor, subject_user_id=student_id,
          detail={"code": code, "quantity": quantity, "amount_minor": row.amount_minor, "currency": row.currency})
    track(db, "add_on_offered", user_id=student_id, properties={"code": code, "quantity": quantity, "plan": eng.product_code})
    from app.services.notify import notify

    notify(db, student_id, "ADDON_OFFERED", "notify.v29.addonOffered", "The Hangyul Univ team has proposed an additional service.",
           params={"code": code, "quantity": quantity}, link="/services#addons")
    return row


def decide(db: Session, actor, row: ServiceAddOn, approve: bool) -> Order | None:
    """The student answers an offer. Approving creates the order to pay; it grants nothing yet."""
    if row.status == AddOnStatus.AWAITING_PAYMENT and approve and row.order_id:
        return db.get(Order, row.order_id)  # a double click: the same order, never a second one
    if row.status != AddOnStatus.OFFERED:
        raise _refuse("ADD_ON_ANSWERED", "This offer has already been answered.", 409)
    row.decided_at = utcnow()
    if not approve:
        row.status = AddOnStatus.DECLINED
        audit(db, action="addon.decline", entity_type="service_add_on", entity_id=row.id, actor=actor, subject_user_id=row.user_id,
              detail={"code": row.code})
        return None
    eng = ent_svc.active_engagement(db, row.user_id)
    prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == eng.product_code)) if eng else None
    if prod is None:
        raise _refuse("ADD_ON_NO_PLAN", "Additional services extend a purchased plan.", 409)
    defn = definition(row.code) or {}
    order = Order(user_id=row.user_id, product_id=prod.id, price_id=None, currency=row.currency or "USD",
                  amount_minor=int(row.amount_minor or 0), kind="ADD_ON", catalog_version=row.catalog_version,
                  plan_snapshot={"kind": "ADD_ON", "code": row.code, "quantity": row.quantity, "unit_amount_minor": row.unit_amount_minor,
                                 "amount_minor": row.amount_minor, "currency": row.currency, "scope": row.scope,
                                 "effect": defn.get("effect"), "unit": defn.get("unit"), "plan": eng.product_code,
                                 "catalog_version": row.catalog_version})
    db.add(order)
    db.flush()
    row.order_id, row.status = order.id, AddOnStatus.AWAITING_PAYMENT
    audit(db, action="addon.approve", entity_type="service_add_on", entity_id=row.id, actor=actor, subject_user_id=row.user_id,
          detail={"code": row.code, "order_id": str(order.id), "amount_minor": order.amount_minor})
    track(db, "add_on_approved", user_id=row.user_id, properties={"code": row.code})
    return order


def activate(db: Session, order: Order) -> ServiceAddOn | None:
    """Switch on what a PAID add-on order bought — exactly once."""
    row = db.scalar(select(ServiceAddOn).where(ServiceAddOn.order_id == order.id).with_for_update())
    if row is None or row.status in (AddOnStatus.ACTIVE, AddOnStatus.COMPLETED):
        return row
    if row.status != AddOnStatus.AWAITING_PAYMENT:
        raise _refuse("ADD_ON_NOT_PAYABLE", "This add-on is no longer awaiting payment.", 409)
    now = utcnow()
    row.status, row.paid_at, row.activated_at = AddOnStatus.ACTIVE, now, now
    defn = definition(row.code) or {}
    effect = defn.get("effect") or {}
    if effect.get("kind") == "SERVICE_CASE":
        from app.services import concierge

        case = concierge.create_case(db, row.user_id, effect["case_type"], details={
            "add_on_id": str(row.id), "add_on_code": row.code, "scope": row.scope, "quantity": row.quantity,
            "referral": bool(defn.get("referral")), "source": "ADD_ON"}, note=None)
        case.cost_amount, case.cost_currency, case.cost_payer = row.amount_minor, row.currency, "student"
        row.case_id = case.id
    audit(db, action="addon.activate", entity_type="service_add_on", entity_id=row.id, actor=None, subject_user_id=row.user_id,
          detail={"code": row.code, "order_id": str(order.id), "case_id": str(row.case_id) if row.case_id else None})
    track(db, "add_on_purchased", user_id=row.user_id, properties={"code": row.code, "quantity": row.quantity})
    return row


def cancel(db: Session, actor, row: ServiceAddOn) -> None:
    """Withdraw an offer before it is paid. A pending order goes with it."""
    if row.status not in (AddOnStatus.OFFERED, AddOnStatus.AWAITING_PAYMENT):
        raise _refuse("ADD_ON_NOT_CANCELLABLE", "Only an unpaid offer can be withdrawn.", 409)
    if row.order_id:
        order = db.get(Order, row.order_id)
        if order is not None and order.status == OrderStatus.PAID:
            raise _refuse("ADD_ON_NOT_CANCELLABLE", "This add-on has been paid; use a refund instead.", 409)
        if order is not None and order.status == OrderStatus.PENDING:
            order.status = OrderStatus.CANCELLED
    row.status, row.decided_at = AddOnStatus.CANCELLED, utcnow()
    audit(db, action="addon.withdraw", entity_type="service_add_on", entity_id=row.id, actor=actor, subject_user_id=row.user_id)


def on_case_closed(db: Session, case) -> None:
    """A service case an add-on opened has finished → the add-on is COMPLETED."""
    row = db.scalar(select(ServiceAddOn).where(ServiceAddOn.case_id == case.id))
    if row is not None and row.status == AddOnStatus.ACTIVE and case.status in ("COMPLETED", "MOVED_IN", "COLLECTED"):
        row.status, row.completed_at = AddOnStatus.COMPLETED, utcnow()
        audit(db, action="addon.complete", entity_type="service_add_on", entity_id=row.id, subject_user_id=row.user_id,
              detail={"case_id": str(case.id)})
