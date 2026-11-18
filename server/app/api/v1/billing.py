"""Payments on the billing-key rail — the only rail (owner decision, final product pass).

    choose plan → order (server-priced) → payment method (saved, or registered in Toss's hosted window)
    → the student confirms the one-time amount → ONE server-side billing charge → PAID → entitlement

What every endpoint here holds to:

* **One-time.** There is no schedule, no renewal date and no subscription state anywhere in this file. A
  saved payment method is charged only when its owner presses pay on a specific order.
* **A billing key is not a payment.** Registering a method never moves an order past BILLING_KEY_READY.
  Only a charge Toss reports as DONE, for exactly the stored amount and currency, makes an order PAID.
* **The browser is never the authority.** It never sends an amount that is *used*; the amount it echoes is
  compared with the order and discarded. It never receives a billing key, a secret key or a security key.
  The return from Toss's window is a prompt to issue a key server-side, not evidence of anything.
* **Exactly once.** A row lock on the order, a durable CHARGING state written before the network call, one
  provider order id and one idempotency key per attempt, and a provider lookup before any new attempt.
* **No other rail.** A method whose merchant cannot do billing is refused by name. Nothing here calls
  `/v1/payments/confirm`, opens a 결제창 payment, or accepts card data.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from collections import defaultdict, deque
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.common import iso
from app.core import crypto
from app.core.audit import audit, track
from app.core.config import get_settings
from app.core.db import SessionLocal, get_db
from app.core.deps import Principal, require_agency_or_hangyul, require_student
from app.models import Order, Payment, ServiceAddOn, ServiceEngagement, ServiceProduct, User
from app.models.base import utcnow
from app.models.business import PaymentCustomer, PaymentMethodRegistration, PaymentWebhookEvent, StudentPaymentMethod
from app.models.enums import AddOnStatus, OrderStatus
from app.services import billing as billing_svc
from app.services import monitoring
from app.services.payments import NotConfigured, ProviderError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["payments"])
webhook_router = APIRouter(prefix="/payments", tags=["payments"])
ops_router = APIRouter(prefix="/agency", tags=["payments"])

#: A charge whose outcome is unknown is "in flight" for this long (the approval timeout plus slack); after
#: that, an attempt Toss has no record of did not happen.
IN_FLIGHT_SECONDS = billing_svc.APPROVAL_TIMEOUT + 25
MAX_ATTEMPTS_PER_ORDER = 10

_RATE_LIMIT = 10        # registrations + charges
_RATE_WINDOW = 300.0    # seconds
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limited(request: Request, p: Principal = Depends(require_student)) -> None:
    """Per student **and** per IP. Card testing is the attack; the student id is the cheap bound on it."""
    now = time.monotonic()
    ip = request.client.host if request.client else "unknown"
    buckets = (f"u:{p.id}", f"ip:{ip}")
    for bucket in buckets:
        q = _hits[bucket]
        while q and now - q[0] > _RATE_WINDOW:
            q.popleft()
        if len(q) >= _RATE_LIMIT:
            raise HTTPException(429, detail={"code": "TOO_MANY_PAYMENT_ATTEMPTS",
                                             "message": "Too many payment attempts. Please wait a few minutes and try again."})
    for bucket in buckets:
        _hits[bucket].append(now)


def _refuse(status_code: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code, detail={"code": code, "message": message, **extra})


# ============================================================================================ helpers

def customer_key(db: Session, user_id) -> str:
    """The user's opaque Toss customer key, created once and never changed."""
    row = db.scalar(select(PaymentCustomer).where(PaymentCustomer.user_id == user_id))
    if row is not None:
        return row.customer_key
    try:
        with db.begin_nested():
            row = PaymentCustomer(user_id=user_id, customer_key=billing_svc.new_customer_key())
            db.add(row)
            db.flush()
    except IntegrityError:  # a concurrent request created it first
        row = db.scalar(select(PaymentCustomer).where(PaymentCustomer.user_id == user_id))
    return row.customer_key


def _chargeable(m: StudentPaymentMethod) -> bool:
    return m.status == "ACTIVE" and bool(m.reusable) and bool(m.billing_key_ciphertext)


def method_payload(m: StudentPaymentMethod, *, currency: str | None = None) -> dict:
    """What a browser may know about a saved payment method. The credential is not in this dict by construction."""
    av = billing_svc.availability(m.kind, currency=currency)
    return {
        "id": str(m.id),
        "kind": m.kind,
        "brand": m.card_brand,
        "last4": m.last4,
        "masked_number": m.masked_number,
        "issuer_code": m.issuer_code,
        "card_type": m.card_type,
        "is_default": m.is_default,
        "status": m.status,
        "created_at": iso(m.created_at),
        #: May this method pay (an order in ``currency``) right now, and if not, why.
        "usable": _chargeable(m) and av.available,
        "unavailable_reason": None if (_chargeable(m) and av.available) else (av.reason or "NOT_REUSABLE"),
    }


def _saved_methods(db: Session, user_id) -> list[StudentPaymentMethod]:
    rows = db.scalars(
        select(StudentPaymentMethod)
        .where(StudentPaymentMethod.user_id == user_id, StudentPaymentMethod.status == "ACTIVE")
        .order_by(StudentPaymentMethod.is_default.desc(), StudentPaymentMethod.created_at.desc())
    ).all()
    # Rows written by the retired key-in route hold no credential and can never be charged; they are history.
    return [m for m in rows if _chargeable(m)]


def _usable_methods(db: Session, user_id, currency: str) -> list[StudentPaymentMethod]:
    return [m for m in _saved_methods(db, user_id) if billing_svc.availability(m.kind, currency=currency).available]


def settle_initial_state(db: Session, order: Order) -> None:
    """Where a freshly created order stands: ready to charge a saved method, or needing one first."""
    order.payment_state = "BILLING_KEY_READY" if _usable_methods(db, order.user_id, order.currency) else "PAYMENT_METHOD_REQUIRED"


def _order_out(db: Session, order: Order) -> dict:
    from app.api.v1.student import _order_payload

    return _order_payload(db, order, db.get(ServiceProduct, order.product_id))


def _locked_order(db: Session, order_id, user_id=None) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None or (user_id is not None and order.user_id != user_id):
        raise HTTPException(404, "Order not found.")
    return order


# ============================================================================================ options

@router.get("/payments/options")
def payment_options(order_id: uuid.UUID | None = None, currency: str | None = None,
                    p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Which payment methods can be used, and the student's saved ones. Contains no key of any kind.

    ``order_id`` (or, before an order exists, ``currency``) narrows the answer to what can pay that amount.
    """
    s = get_settings()
    currency = currency.upper()[:3] if currency else None
    order_out = None
    if order_id is not None:
        order = db.get(Order, order_id)
        if order is None or order.user_id != p.id:
            raise HTTPException(404, "Order not found.")
        currency = order.currency
        order_out = _order_out(db, order)
    methods = []
    for kind in billing_svc.METHOD_KINDS:
        av = billing_svc.availability(kind, currency=currency)
        methods.append({"kind": kind, "available": av.available, "reason": av.reason, "currency": av.currency})
    return {
        "provider": s.payment_provider,
        "mode": "live" if s.toss_env == "live" else "test",
        "live_payment_enabled": bool(s.toss_env == "live" and s.live_payment_enabled),
        # The commercial model, stated by the server so no client can drift from it.
        "one_time": True,
        "recurring": False,
        "rail": "BILLING_KEY",
        "methods": methods,
        "saved": [method_payload(m, currency=currency) for m in _saved_methods(db, p.id)],
        "order": order_out,
    }


@router.get("/payment-methods")
def my_payment_methods(p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The saved payment methods. The credential is not in this response and has no endpoint that returns it."""
    return {"items": [method_payload(m) for m in _saved_methods(db, p.id)]}


# ============================================================================================ registration

class RegistrationIn(BaseModel):
    model_config = {"extra": "forbid"}
    kind: Literal["DOMESTIC_CARD", "FOREIGN_CARD", "TOSS_PAY", "NAVER_PAY"]
    #: The order the student is paying, when they add a method from checkout.
    order_id: uuid.UUID | None = None
    #: `app` when the student native app opened the secure web flow and wants to be sent back.
    return_to: Literal["web", "app"] = "web"


@router.post("/payment-methods/registrations", status_code=201, dependencies=[Depends(_rate_limited)])
def start_registration(body: RegistrationIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Open a payment-method registration in Toss's hosted window.

    Returns what the browser needs to open that window — the SDK URL, this merchant's **client** key, the
    customer key and the two return URLs — and nothing else. No card field exists on Hangyul's side.
    """
    s = get_settings()
    order = None
    if body.order_id is not None:
        order = _locked_order(db, body.order_id, p.id)
        if order.status != OrderStatus.PENDING:
            raise _refuse(409, "ORDER_NOT_PAYABLE", "This order can no longer be paid.")
    av = billing_svc.availability(body.kind, currency=order.currency if order else None)
    if not av.available:
        audit(db, action="payment_method.registration_refused", entity_type="user", entity_id=p.id, actor=p,
              subject_user_id=p.id, detail={"kind": body.kind, "reason": av.reason})
        db.commit()
        code = "CURRENCY_MISMATCH" if av.reason == "CURRENCY_MISMATCH" else "METHOD_UNAVAILABLE"
        raise _refuse(409 if code == "CURRENCY_MISMATCH" else 503, code,
                      "This payment method is not available.", reason=av.reason)
    m = billing_svc.merchant_for_kind(body.kind)
    ck = customer_key(db, p.id)
    reg = PaymentMethodRegistration(user_id=p.id, kind=body.kind, provider_mid=m.mid, order_id=order.id if order else None,
                                    status="PENDING", expires_at=utcnow() + timedelta(seconds=billing_svc.REGISTRATION_TTL_SECONDS))
    db.add(reg)
    db.flush()
    if order is not None and order.payment_state != "CHARGING":
        order.payment_state = "BILLING_AUTH_PENDING"
    audit(db, action="payment_method.registration_started", entity_type="payment_method_registration", entity_id=reg.id,
          actor=p, subject_user_id=p.id, detail={"kind": body.kind, "mid": m.mid, "order_id": str(order.id) if order else None})
    db.commit()
    base = f"{s.toss_return_origin.rstrip('/')}/services/payment-methods/return?registration={reg.id}"
    if body.return_to == "app":
        base += "&return_to=app"
    return {
        "registration_id": str(reg.id),
        "kind": body.kind,
        "order_id": str(order.id) if order else None,
        "sdk": billing_svc.SDK_URL,
        "client_key": m.client_key,
        "customer_key": ck,
        "method": billing_svc._BILLING_AUTH_METHOD[body.kind],  # noqa: SLF001
        "success_url": base + "&result=success",
        "fail_url": base + "&result=fail",
        "customer_name": (p.user.full_name or "")[:100] or None,
        "customer_email": (p.user.email or "")[:100] or None,
        "mode": av.mode,
    }


class RegistrationCompleteIn(BaseModel):
    model_config = {"extra": "forbid"}
    #: Exactly what Toss puts on the success URL. One-time; exchanged server-side and never stored.
    auth_key: str = Field(min_length=3, max_length=300)
    customer_key: str = Field(min_length=22, max_length=64)

    def __repr__(self) -> str:  # noqa: D105 - never let a validation error print the authorisation
        return "<RegistrationCompleteIn redacted>"

    __str__ = __repr__


def _registration(db: Session, registration_id: uuid.UUID, user_id) -> PaymentMethodRegistration:
    reg = db.scalar(select(PaymentMethodRegistration).where(PaymentMethodRegistration.id == registration_id).with_for_update())
    if reg is None or reg.user_id != user_id:
        raise HTTPException(404, "Registration not found.")
    return reg


def _close_registration(db: Session, reg: PaymentMethodRegistration, status_: str, code: str | None) -> None:
    reg.status, reg.failure_code, reg.completed_at = status_, (code or None) and code[:64], utcnow()
    if reg.order_id:
        order = db.scalar(select(Order).where(Order.id == reg.order_id).with_for_update())
        if order is not None and order.status == OrderStatus.PENDING and order.payment_state == "BILLING_AUTH_PENDING":
            settle_initial_state(db, order)


@router.post("/payment-methods/registrations/{registration_id}/complete", dependencies=[Depends(_rate_limited)])
def complete_registration(registration_id: uuid.UUID, body: RegistrationCompleteIn,
                          p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student came back from Toss's window: issue the billing key, seal it, save the method.

    **This charges nothing and activates nothing.** The order (if any) moves to BILLING_KEY_READY and waits
    for the student to confirm the one-time amount.
    """
    reg = _registration(db, registration_id, p.id)
    if reg.status == "COMPLETED" and reg.payment_method_id:
        # A reload of the return URL: the answer is the method that was saved, not a second issuance.
        m = db.get(StudentPaymentMethod, reg.payment_method_id)
        db.commit()
        return {"payment_method": method_payload(m) if m else None, "order_id": str(reg.order_id) if reg.order_id else None,
                "already_completed": True}
    if reg.status != "PENDING":
        raise _refuse(409, "REGISTRATION_CLOSED", "This registration is no longer open. Please start again.")
    if reg.expires_at < utcnow():
        _close_registration(db, reg, "EXPIRED", "REGISTRATION_EXPIRED")
        db.commit()
        raise _refuse(409, "AUTH_FAILED", "The registration took too long. Please start again.")
    ck = customer_key(db, p.id)
    if body.customer_key != ck:
        # The return URL carries a customer key that is not this student's: someone else's registration.
        _close_registration(db, reg, "FAILED", "NOT_MATCHES_CUSTOMER_KEY")
        audit(db, action="payment_method.registration_failed", entity_type="payment_method_registration", entity_id=reg.id,
              actor=p, subject_user_id=p.id, detail={"code": "NOT_MATCHES_CUSTOMER_KEY"})
        db.commit()
        raise _refuse(409, "KEY_ISSUE_FAILED", "The payment method could not be registered.")
    av = billing_svc.availability(reg.kind)
    if not av.available:
        _close_registration(db, reg, "FAILED", av.reason)
        db.commit()
        raise _refuse(503, "METHOD_UNAVAILABLE", "This payment method is not available.", reason=av.reason)
    merchant = billing_svc.merchant_for_kind(reg.kind)
    try:
        issued = billing_svc.BillingClient(merchant).issue(auth_key=body.auth_key, customer_key=ck)
    except NotConfigured:
        _close_registration(db, reg, "FAILED", "NOT_CONFIGURED")
        db.commit()
        raise _refuse(503, "METHOD_UNAVAILABLE", "This payment method is not available.") from None
    except ProviderError as exc:
        _close_registration(db, reg, "FAILED", exc.code)
        audit(db, action="payment_method.registration_failed", entity_type="payment_method_registration", entity_id=reg.id,
              actor=p, subject_user_id=p.id, detail={"kind": reg.kind, "mid": merchant.mid, "code": exc.code,
                                                    "http_status": getattr(exc, "http_status", None)})
        if exc.code in billing_svc.CAPABILITY_CODES:
            monitoring.record("PAYMENT_ERROR", "payments.billing", f"billing-key issuance refused on {merchant.key}: {exc.code}",
                              detail={"merchant": merchant.key, "mid": merchant.mid, "provider_code": exc.code,
                                      "http_status": getattr(exc, "http_status", None)})
        db.commit()
        category = billing_svc.failure_category(exc.code)
        raise _refuse(402, category if category != "PAYMENT_FAILED" else "KEY_ISSUE_FAILED",
                      "The payment method could not be registered.") from None

    try:
        sealed = crypto.seal(issued.billing_key, aad=str(p.id))
        fp = billing_svc.fingerprint(issued.billing_key)
    except crypto.EncryptionNotConfigured:
        # Never keep a credential that cannot be sealed: give it back to Toss and say so.
        try:
            billing_svc.BillingClient(merchant).revoke(billing_key=issued.billing_key)
        except (ProviderError, NotConfigured):
            pass
        _close_registration(db, reg, "FAILED", "ENCRYPTION_NOT_CONFIGURED")
        db.commit()
        raise _refuse(503, "METHOD_UNAVAILABLE", "This payment method is not available.") from None

    method = db.scalar(select(StudentPaymentMethod).where(
        StudentPaymentMethod.user_id == p.id, StudentPaymentMethod.status == "ACTIVE",
        StudentPaymentMethod.billing_key_fingerprint == fp))
    if method is None:
        # The same card registered again replaces the old credential (this is also how an expired card is
        # replaced): the older key is deleted at Toss and can never be charged from here.
        label = issued.easy_pay_provider or issued.brand
        if issued.last4:
            for old in db.scalars(select(StudentPaymentMethod).where(
                    StudentPaymentMethod.user_id == p.id, StudentPaymentMethod.status == "ACTIVE",
                    StudentPaymentMethod.kind == reg.kind, StudentPaymentMethod.last4 == issued.last4,
                    StudentPaymentMethod.issuer_code == issued.issuer_code)):
                _revoke(db, old, actor=p, reason="replaced")
        has_default = db.scalar(select(func.count()).select_from(StudentPaymentMethod).where(
            StudentPaymentMethod.user_id == p.id, StudentPaymentMethod.status == "ACTIVE",
            StudentPaymentMethod.reusable.is_(True), StudentPaymentMethod.is_default.is_(True))) or 0
        method = StudentPaymentMethod(
            user_id=p.id, provider="TOSS", provider_mid=merchant.mid, customer_key=ck, kind=reg.kind,
            billing_key_ciphertext=sealed.ciphertext, billing_key_version=sealed.key_version,
            billing_key_fingerprint=fp, reusable=True,
            card_brand=label, issuer_code=issued.issuer_code, acquirer_code=issued.acquirer_code,
            # **Our** mask, not the provider's: the last four identify the card to its owner; Toss's echo
            # carries the BIN and more, which nothing here has a use for.
            masked_number=f"•••• {issued.last4}" if issued.last4 else None, last4=issued.last4,
            card_type=issued.card_type, owner_type=issued.owner_type,
            is_default=not has_default, status="ACTIVE",
        )
        db.add(method)
        db.flush()
    reg.status, reg.completed_at, reg.payment_method_id = "COMPLETED", utcnow(), method.id
    order_id = None
    if reg.order_id:
        order = db.scalar(select(Order).where(Order.id == reg.order_id).with_for_update())
        if order is not None and order.status == OrderStatus.PENDING and order.payment_state != "CHARGING":
            # A key was issued. That is all that happened: nothing is charged and nothing is switched on.
            order.payment_state, order.payment_method_id = "BILLING_KEY_READY", method.id
            order_id = str(order.id)
    audit(db, action="payment_method.registered", entity_type="payment_method", entity_id=method.id, actor=p,
          subject_user_id=p.id, detail={"kind": reg.kind, "mid": merchant.mid, "registration_id": str(reg.id)})
    track(db, "payment_method_added", user_id=p.id, properties={"kind": reg.kind})
    db.commit()
    return {"payment_method": method_payload(method), "order_id": order_id, "already_completed": False}


class RegistrationFailIn(BaseModel):
    model_config = {"extra": "forbid"}
    code: str | None = Field(default=None, max_length=64)


@router.post("/payment-methods/registrations/{registration_id}/fail")
def fail_registration(registration_id: uuid.UUID, body: RegistrationFailIn,
                      p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """The student closed Toss's window, or it reported a failure. Nothing was registered or charged."""
    reg = _registration(db, registration_id, p.id)
    category = billing_svc.failure_category(body.code)
    if reg.status == "PENDING":
        _close_registration(db, reg, "CANCELLED" if category == "AUTH_CANCELLED" else "FAILED", body.code)
        audit(db, action="payment_method.registration_failed", entity_type="payment_method_registration", entity_id=reg.id,
              actor=p, subject_user_id=p.id, detail={"kind": reg.kind, "code": (body.code or "")[:64]})
    db.commit()
    return {"status": reg.status, "code": category if category != "PAYMENT_FAILED" else "AUTH_FAILED",
            "order_id": str(reg.order_id) if reg.order_id else None}


# ============================================================================================ manage methods

def _revoke(db: Session, m: StudentPaymentMethod, *, actor, reason: str) -> str:
    """Delete the credential at Toss, then locally. Returns what happened at the provider."""
    remote = "not_applicable"
    if m.billing_key_ciphertext:
        billing_key = ""
        try:
            billing_key = crypto.open_sealed(m.billing_key_ciphertext, key_version=m.billing_key_version or 1, aad=str(m.user_id))
            remote = "revoked" if billing_svc.client_for_mid(m.provider_mid).revoke(billing_key=billing_key) else "already_gone"
        except (crypto.DecryptionFailed, crypto.EncryptionNotConfigured, ProviderError, NotConfigured):
            # A provider that is unreachable does not keep the method alive here: the row is revoked and can
            # never be charged from this server either way. Operations sees the audit row and retries.
            remote = "unreachable"
        finally:
            billing_key = ""  # noqa: F841
    m.status, m.revoked_at, m.is_default = "REVOKED", utcnow(), False
    m.billing_key_ciphertext, m.billing_key_version, m.billing_key_fingerprint, m.reusable = None, None, None, False
    audit(db, action="payment_method.revoked", entity_type="payment_method", entity_id=m.id, actor=actor,
          subject_user_id=m.user_id, detail={"remote": remote, "reason": reason, "kind": m.kind})
    return remote


def _own_method(db: Session, method_id: uuid.UUID, user_id) -> StudentPaymentMethod:
    m = db.scalar(select(StudentPaymentMethod).where(StudentPaymentMethod.id == method_id).with_for_update())
    if m is None or m.user_id != user_id or m.status != "ACTIVE":
        raise HTTPException(404, "Payment method not found.")
    return m


@router.delete("/payment-methods/{method_id}")
def delete_payment_method(method_id: uuid.UUID, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Remove a saved payment method. After this it cannot be charged — here or at Toss."""
    m = _own_method(db, method_id, p.id)
    was_default = m.is_default
    remote = _revoke(db, m, actor=p, reason="removed_by_student")
    if was_default:
        nxt = next(iter(_saved_methods(db, p.id)), None)
        if nxt is not None:
            nxt.is_default = True
    db.commit()
    return {"deleted": True, "remote": remote}


@router.post("/payment-methods/{method_id}/default")
def set_default_payment_method(method_id: uuid.UUID, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    m = _own_method(db, method_id, p.id)
    if not _chargeable(m):
        raise HTTPException(404, "Payment method not found.")
    db.execute(update(StudentPaymentMethod).where(StudentPaymentMethod.user_id == p.id).values(is_default=False))
    m.is_default = True
    audit(db, action="payment_method.default_set", entity_type="payment_method", entity_id=m.id, actor=p, subject_user_id=p.id)
    db.commit()
    return {"items": [method_payload(x) for x in _saved_methods(db, p.id)]}


# ============================================================================================ the one charge

def _finish_paid(db: Session, order: Order, pay: Payment, charge: billing_svc.Charge) -> None:
    """A charge Toss reports as DONE for the stored amount: mark it, switch the purchase on — exactly once."""
    from app.api.v1.student import activate_paid_order, get_profile

    pay.status, pay.provider_ref, pay.raw, pay.failure_code = "PAID", charge.payment_key, charge.raw, None
    already = order.status == OrderStatus.PAID
    prod = db.get(ServiceProduct, order.product_id)
    user = db.get(User, order.user_id)
    activate_paid_order(db, order, prod, get_profile(db, user.id), user, provider="toss")  # no-op if already PAID
    order.payment_state = "PAID"
    if not already:
        audit(db, action="order.paid", entity_type="order", entity_id=order.id, actor=None, subject_user_id=user.id,
              detail={"provider": "toss", "rail": "BILLING_KEY", "mid": pay.provider_mid, "attempt": pay.attempt,
                      "provider_order_id": pay.provider_order_id, "amount_minor": order.amount_minor, "currency": order.currency})


def _matches(order: Order, pay: Payment, charge: billing_svc.Charge) -> bool:
    return (charge.amount_minor == order.amount_minor and charge.currency == order.currency
            and (charge.provider_order_id in (None, pay.provider_order_id)))


def _mismatch(db: Session, order: Order, pay: Payment, charge: billing_svc.Charge) -> None:
    """Toss holds a payment for this attempt that is not the order's amount/currency. A person must look."""
    pay.status, pay.provider_ref, pay.raw, pay.failure_code = "REVIEW", charge.payment_key, charge.raw, "AMOUNT_MISMATCH"
    order.payment_state = "FAILED"
    audit(db, action="order.amount_mismatch", entity_type="order", entity_id=order.id, actor=None, subject_user_id=order.user_id,
          detail={"expected_minor": order.amount_minor, "expected_currency": order.currency,
                  "provider_minor": charge.amount_minor, "provider_currency": charge.currency,
                  "provider_order_id": pay.provider_order_id})
    monitoring.record("PAYMENT_ERROR", "payments.billing", "provider payment does not match the order amount",
                      detail={"order_id": str(order.id), "provider_order_id": pay.provider_order_id})


def _resolve_open_attempts(db: Session, order: Order) -> str | None:
    """Settle every attempt whose outcome is unknown by asking Toss. The order must be row-locked.

    Returns ``"PAID"`` when an attempt turned out to have succeeded (the order is now paid),
    ``"IN_PROGRESS"`` when one may still be in flight or Toss could not be asked, otherwise ``None``.
    """
    open_ = db.scalars(select(Payment).where(Payment.order_id == order.id, Payment.status == "CHARGING")
                       .order_by(Payment.created_at)).all()
    for pay in open_:
        try:
            charge = billing_svc.client_for_mid(pay.provider_mid).lookup_order(provider_order_id=pay.provider_order_id)
        except (ProviderError, NotConfigured) as exc:
            log.warning("payment attempt %s could not be reconciled: %s", pay.id, type(exc).__name__)
            return "IN_PROGRESS"
        if charge is None:
            if (utcnow() - pay.created_at).total_seconds() < IN_FLIGHT_SECONDS:
                return "IN_PROGRESS"
            pay.status, pay.failure_code = "FAILED", "NO_PROVIDER_RECORD"
            continue
        if charge.paid or charge.status in ("CANCELED", "PARTIAL_CANCELED"):
            if not _matches(order, pay, charge):
                _mismatch(db, order, pay, charge)
                continue
            _finish_paid(db, order, pay, charge)
            if charge.status != "DONE":
                _sync_refund(db, order, pay, charge, reason="Cancelled at the provider")
            return "PAID"
        if charge.status in ("ABORTED", "EXPIRED"):
            pay.status, pay.failure_code, pay.raw = "FAILED", charge.failure_code or charge.status, charge.raw
        elif (utcnow() - pay.created_at).total_seconds() < IN_FLIGHT_SECONDS:
            return "IN_PROGRESS"
        else:
            pay.status, pay.failure_code = "FAILED", charge.status
    if open_ and order.status == OrderStatus.PENDING and order.payment_state == "CHARGING":
        order.payment_state = "FAILED"
    return None


class PayIn(BaseModel):
    model_config = {"extra": "forbid"}
    #: Omitted = the student's default saved method.
    payment_method_id: uuid.UUID | None = None
    #: The amount and currency the student was shown and agreed to. Compared with the order, then discarded:
    #: the figure charged is always the server's own.
    amount_minor: int = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)
    #: The student saw "one-time payment" with the service, amount, method and refund terms, and pressed pay.
    one_time_confirmed: bool = False


@router.post("/orders/{order_id}/pay", dependencies=[Depends(_rate_limited)])
def pay_order(order_id: uuid.UUID, body: PayIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """Charge the order amount **once** to a saved payment method.

    Order of business: ownership → still payable → consent → the echoed amount equals the stored one → no
    earlier attempt is unresolved → the method is the caller's and can pay this currency → write CHARGING
    durably → ask Toss → believe only a DONE for exactly the stored amount.
    """
    if get_settings().payment_provider != "toss":
        raise _refuse(409, "PAYMENT_UNAVAILABLE", "Payment is not available on this server.")
    order = _locked_order(db, order_id, p.id)
    if order.status == OrderStatus.PAID:
        db.commit()
        return {**_order_out(db, order), "already_paid": True}
    if order.status != OrderStatus.PENDING:
        raise _refuse(409, "ORDER_NOT_PAYABLE", "This order can no longer be paid.")
    if not body.one_time_confirmed:
        raise _refuse(422, "CONSENT_REQUIRED", "Confirm the one-time payment to continue.")
    if body.amount_minor != order.amount_minor or body.currency.upper() != order.currency:
        audit(db, action="order.amount_mismatch", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
              detail={"expected_minor": order.amount_minor, "expected_currency": order.currency,
                      "shown_minor": body.amount_minor, "shown_currency": body.currency.upper()})
        db.commit()
        raise _refuse(409, "AMOUNT_MISMATCH", "The amount shown is out of date. Reload and try again.")

    settled = _resolve_open_attempts(db, order)
    if settled == "PAID":
        db.commit()
        return {**_order_out(db, order), "already_paid": True}
    if settled == "IN_PROGRESS":
        db.commit()
        raise _refuse(409, "PAYMENT_IN_PROGRESS", "A payment for this order is already being processed.")

    if body.payment_method_id is not None:
        method = db.scalar(select(StudentPaymentMethod).where(StudentPaymentMethod.id == body.payment_method_id))
        if method is None or method.user_id != p.id or not _chargeable(method):
            db.commit()
            raise HTTPException(404, "Payment method not found.")
    else:
        method = next(iter(_usable_methods(db, p.id, order.currency)), None)
        if method is None:
            order.payment_state = "PAYMENT_METHOD_REQUIRED"
            db.commit()
            raise _refuse(409, "PAYMENT_METHOD_REQUIRED", "Add a payment method to continue.")
    av = billing_svc.availability(method.kind, currency=order.currency)
    if not av.available:
        db.commit()
        code = "CURRENCY_MISMATCH" if av.reason == "CURRENCY_MISMATCH" else "METHOD_UNAVAILABLE"
        raise _refuse(409, code, "This payment method cannot pay for this order.", reason=av.reason)

    attempt = (db.scalar(select(func.count()).select_from(Payment).where(Payment.order_id == order.id, Payment.provider == "toss")) or 0) + 1
    if attempt > MAX_ATTEMPTS_PER_ORDER:
        db.commit()
        raise _refuse(429, "TOO_MANY_PAYMENT_ATTEMPTS", "Too many attempts for this order. Please contact the Hangyul Univ team.")
    prod = db.get(ServiceProduct, order.product_id)
    pay = Payment(order_id=order.id, provider="toss", status="CHARGING", amount_minor=order.amount_minor, currency=order.currency,
                  provider_mid=method.provider_mid, provider_order_id=f"{order.id.hex}-{attempt:02d}", attempt=attempt,
                  payment_method_id=method.id)
    db.add(pay)
    db.flush()
    order.payment_state, order.payment_method_id = "CHARGING", method.id
    audit(db, action="order.charge_started", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
          detail={"attempt": attempt, "kind": method.kind, "mid": method.provider_mid, "one_time_confirmed": True})
    pay_id, provider_order_id = pay.id, pay.provider_order_id
    order_name = (prod.name_en if prod else "Hangyul Univ service")
    amount_minor, currency = order.amount_minor, order.currency
    # Durable **before** the network call: if this process dies mid-charge, the next request (or the
    # reconciler) finds CHARGING and asks Toss instead of charging again.
    db.commit()

    billing_key = ""
    failure: ProviderError | None = None
    charge: billing_svc.Charge | None = None
    try:
        billing_key = crypto.open_sealed(method.billing_key_ciphertext, key_version=method.billing_key_version or 1,
                                         aad=str(method.user_id))
        charge = billing_svc.client_for_mid(method.provider_mid).charge(
            billing_key=billing_key, customer_key=method.customer_key, provider_order_id=provider_order_id,
            amount_minor=amount_minor, currency=currency, order_name=order_name,
            idempotency_key=f"hg-charge-{order_id}-{attempt}",
            customer_email=p.user.email, customer_name=p.user.full_name)
    except (crypto.DecryptionFailed, crypto.EncryptionNotConfigured):
        failure = ProviderError("METHOD_UNUSABLE", "This payment method can no longer be used.")
    except NotConfigured:
        failure = ProviderError("NOT_AVAILABLE_PAYMENT", "This payment method is not available.")
    except ProviderError as exc:
        failure = exc
    finally:
        billing_key = ""  # noqa: F841 - the plaintext credential does not outlive the call

    order = _locked_order(db, order_id, p.id)
    pay = db.get(Payment, pay_id)
    if order.status == OrderStatus.PAID:  # a concurrent request or the reconciler already finished it
        db.commit()
        return {**_order_out(db, order), "already_paid": True}

    if failure is not None:
        if failure.code in billing_svc.INDETERMINATE_CODES:
            # It is not known whether money moved. Nothing is marked failed and nothing is retried here.
            audit(db, action="order.charge_unconfirmed", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
                  detail={"attempt": attempt, "code": failure.code})
            db.commit()
            return JSONResponse(status_code=202, content={**_order_out(db, order), "code": "PAYMENT_PENDING_CONFIRMATION"})
        pay.status, pay.failure_code = "FAILED", failure.code[:64]
        order.payment_state = "FAILED"  # the order stays PENDING: the student may try another method
        audit(db, action="order.charge_failed", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
              detail={"attempt": attempt, "code": failure.code, "mid": method.provider_mid,
                      "http_status": getattr(failure, "http_status", None)})
        if failure.code in billing_svc.CAPABILITY_CODES:
            monitoring.record("PAYMENT_ERROR", "payments.billing", f"billing charge refused on {method.provider_mid}: {failure.code}",
                              detail={"mid": method.provider_mid, "provider_code": failure.code,
                                      "http_status": getattr(failure, "http_status", None)})
        db.commit()
        raise _refuse(402, billing_svc.failure_category(failure.code), "The payment was not approved. You have not been charged.")

    if not charge.paid:
        pay.status, pay.failure_code, pay.raw = "FAILED", (charge.failure_code or charge.status)[:64], charge.raw
        order.payment_state = "FAILED"
        audit(db, action="order.charge_failed", entity_type="order", entity_id=order.id, actor=p, subject_user_id=p.id,
              detail={"attempt": attempt, "code": charge.failure_code or charge.status})
        db.commit()
        raise _refuse(402, billing_svc.failure_category(charge.failure_code), "The payment was not approved. You have not been charged.")
    if not _matches(order, pay, charge):
        _mismatch(db, order, pay, charge)
        db.commit()
        raise _refuse(409, "AMOUNT_MISMATCH", "The payment could not be verified. The Hangyul Univ team has been notified.")
    _finish_paid(db, order, pay, charge)
    db.commit()
    return {**_order_out(db, order), "already_paid": False, "payment_method": method_payload(method)}


@router.get("/orders/{order_id}")
def my_order(order_id: uuid.UUID, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """One order, after asking Toss about any attempt whose outcome is unknown. The receipt screen polls this."""
    order = _locked_order(db, order_id, p.id)
    if order.status == OrderStatus.PENDING and order.payment_state == "CHARGING":
        _resolve_open_attempts(db, order)
    db.commit()
    return _order_out(db, order)


def reconcile_user_orders(db: Session, user_id) -> bool:
    """Payment recovery: settle a student's orders that are still CHARGING. Never raises."""
    if get_settings().payment_provider != "toss":
        return False
    ids = db.scalars(select(Order.id).where(Order.user_id == user_id, Order.status == OrderStatus.PENDING,
                                            Order.payment_state == "CHARGING")).all()
    return _reconcile(db, ids)


def reconcile_all(db: Session, *, limit: int = 200) -> int:
    """The worker's sweep: every order left CHARGING for longer than a charge can take. Returns how many it settled."""
    cutoff = utcnow() - timedelta(seconds=IN_FLIGHT_SECONDS)
    ids = db.scalars(select(Order.id).where(Order.status == OrderStatus.PENDING, Order.payment_state == "CHARGING",
                                            Order.updated_at <= cutoff).limit(limit)).all()
    before = len(ids)
    _reconcile(db, ids)
    left = db.scalar(select(func.count()).select_from(Order).where(Order.id.in_(ids), Order.payment_state == "CHARGING")) if ids else 0
    return before - (left or 0)


def _reconcile(db: Session, order_ids) -> bool:
    changed = False
    for oid in order_ids:
        try:
            order = db.scalar(select(Order).where(Order.id == oid).with_for_update())
            if order is None or order.status != OrderStatus.PENDING or order.payment_state != "CHARGING":
                db.commit()
                continue
            outcome = _resolve_open_attempts(db, order)
            db.commit()
            changed = changed or outcome == "PAID"
        except Exception as exc:  # noqa: BLE001 - recovery is a convenience; it must never take a page down
            db.rollback()
            log.warning("order reconciliation skipped for %s: %s", oid, type(exc).__name__)
    return changed


# ============================================================================================ refunds

class RefundIn(BaseModel):
    """What a refund needs, and what it deliberately does not compute.

    ``amount_minor`` is **required**. There is no default and no pro-rata rule: Hangyul has no approved
    refund schedule, and a server that invents one would be making a legal decision in a request handler.
    A person decides the amount; this records and executes it against the payment the billing charge made.
    """
    model_config = {"extra": "forbid"}
    amount_minor: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=200)


def _apply_refund(db: Session, order: Order, pay: Payment, *, total_refunded: int, reason: str, actor, provider_ref: str | None) -> bool:
    """Record that ``total_refunded`` of this order has gone back. Returns whether the order is now fully refunded."""
    now = utcnow()
    pay.refunded_amount_minor, pay.refunded_at = total_refunded, now
    pay.refund_ref = provider_ref or pay.refund_ref
    order.refund_amount_minor, order.refund_reason, order.refunded_at = total_refunded, reason[:200], now
    full = total_refunded >= order.amount_minor
    if full:
        # A fully refunded order is no longer a purchase, so what it bought stops being active. A partial
        # refund does not: the student keeps the service they are still paying for.
        order.status, order.payment_state = OrderStatus.REFUNDED, "REFUNDED"
        for eng in db.scalars(select(ServiceEngagement).where(ServiceEngagement.order_id == order.id)):
            eng.status = "REFUNDED"
        if order.kind == "ADD_ON":
            for row in db.scalars(select(ServiceAddOn).where(ServiceAddOn.order_id == order.id)):
                row.status = AddOnStatus.CANCELLED
    else:
        order.payment_state = "PARTIALLY_REFUNDED"
    audit(db, action="order.refunded", entity_type="order", entity_id=order.id, actor=actor, subject_user_id=order.user_id,
          detail={"total_refunded_minor": total_refunded, "full": full, "provider_ref": provider_ref, "reason": reason[:200]})
    return full


def _sync_refund(db: Session, order: Order, pay: Payment, charge: billing_svc.Charge, *, reason: str) -> bool:
    """The provider says some or all of this payment was cancelled (a webhook, or a refund made in Toss's console)."""
    if charge.balance_minor is None:
        return False
    total = max(0, order.amount_minor - charge.balance_minor)
    if total <= (order.refund_amount_minor or 0):
        return False
    pay.raw = charge.raw or pay.raw
    _apply_refund(db, order, pay, total_refunded=total, reason=reason, actor=None, provider_ref=charge.payment_key)
    return True


def _refund(db: Session, order: Order, body: RefundIn, actor) -> dict:
    if order.status != OrderStatus.PAID:
        raise HTTPException(409, "Only a paid order can be refunded.")
    pay = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.status == "PAID").order_by(Payment.created_at.desc()))
    if pay is None or not pay.provider_ref:
        raise HTTPException(409, "This order has no provider payment to refund.")
    already = pay.refunded_amount_minor or 0
    remaining = order.amount_minor - already
    if body.amount_minor > remaining:
        raise HTTPException(409, detail={"code": "AMOUNT_EXCEEDS_REMAINING", "remaining_minor": remaining})
    provider_ref = pay.provider_ref
    if pay.provider == "toss":
        # The key identifies *this* refund: order + how much has already gone back + how much now. A retry
        # is a no-op at Toss; a genuine second partial refund is not swallowed as a duplicate of the first.
        key = f"hg-refund-{order.id}-{already}-{body.amount_minor}"
        full_now = already == 0 and body.amount_minor == order.amount_minor
        try:
            result = billing_svc.client_for_mid(pay.provider_mid).cancel(
                payment_key=pay.provider_ref, reason=body.reason, amount_minor=None if full_now else body.amount_minor,
                currency=order.currency, idempotency_key=key)
        except NotConfigured as exc:
            raise HTTPException(503, str(exc)) from None
        except ProviderError as exc:
            audit(db, action="order.refund_failed", entity_type="order", entity_id=order.id, actor=actor,
                  subject_user_id=order.user_id, detail={"code": exc.code, "amount_minor": body.amount_minor})
            db.commit()
            raise HTTPException(402, detail={"code": exc.code, "message": exc.message}) from None
        pay.raw = result.raw or pay.raw
        provider_ref = result.payment_key or provider_ref
    elif get_settings().is_production:
        raise HTTPException(409, "This order was not paid through the payment provider.")
    full = _apply_refund(db, order, pay, total_refunded=already + body.amount_minor, reason=body.reason, actor=actor,
                         provider_ref=provider_ref)
    track(db, "service_refunded", user_id=order.user_id, properties={"full": full, "amount_minor": body.amount_minor})
    db.commit()
    out = _order_out(db, order)
    out["refunded_amount_minor"] = order.refund_amount_minor
    out["fully_refunded"] = full
    return out


@router.post("/orders/{order_id}/refund")
def refund_own_order(order_id: uuid.UUID, body: RefundIn, p: Principal = Depends(require_student), db: Session = Depends(get_db)):
    """A student refunding their own order. **Closed by default** (``HG_STUDENT_SELF_REFUND_ENABLED``).

    There is no approved refund schedule, so how much a student is owed is decided by a person at Hangyul
    and executed from Operations (`POST /agency/orders/{id}/refund`). A route that lets a student name their
    own refund amount is a refund policy of "anything, any time", which nobody approved.
    """
    if not get_settings().student_self_refund_enabled:
        raise _refuse(403, "REFUND_BY_TEAM", "Refunds are arranged with the Hangyul Univ team.")
    return _refund(db, _locked_order(db, order_id, p.id), body, p)


@ops_router.post("/orders/{order_id}/refund")
def refund_order_by_staff(order_id: uuid.UUID, body: RefundIn, p: Principal = Depends(require_agency_or_hangyul),
                          db: Session = Depends(get_db)):
    """Operations executes a refund a person has decided — in whole or in part — through Toss's cancel API."""
    from app.api.v1.agency import _student_scope

    order = _locked_order(db, order_id)
    in_scope = db.scalar(select(func.count()).select_from(User).where(User.id == order.user_id, User.id.in_(_student_scope(p))))
    if not in_scope:
        raise HTTPException(404, "Order not found.")
    return _refund(db, order, body, p)


# ============================================================================================ webhook

@webhook_router.post("/webhooks/toss")
async def toss_webhook(request: Request):
    """Toss's payment and billing webhooks.

    Nothing in the body is believed. A delivery is deduplicated, its signature is checked when Toss sends
    one, and then it is used only as a reason to **ask Toss** — with the merchant's secret key — what the
    state of that payment is. A forged delivery can therefore cause, at most, a lookup.
    """
    raw = await request.body()
    if len(raw) > 64 * 1024:
        raise HTTPException(413, "Payload too large.")
    headers = {k.lower(): v for k, v in request.headers.items()}
    return await run_in_threadpool(_handle_webhook, raw, headers)


def _handle_webhook(raw: bytes, headers: dict) -> dict:
    sig = billing_svc.verify_webhook_signature(
        body=raw, signature_header=headers.get("tosspayments-webhook-signature"),
        transmission_time=headers.get("tosspayments-webhook-transmission-time"))
    if sig is False:
        raise HTTPException(401, "Invalid signature.")
    try:
        event = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid payload.") from None
    if not isinstance(event, dict):
        raise HTTPException(400, "Invalid payload.")
    event_type = str(event.get("eventType") or ("DEPOSIT_CALLBACK" if "transactionKey" in event else "UNKNOWN"))[:48]
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    dedupe = hashlib.sha256(raw).hexdigest()
    with SessionLocal() as db:
        if db.scalar(select(PaymentWebhookEvent.id).where(PaymentWebhookEvent.dedupe_key == dedupe)) is not None:
            return {"ok": True, "duplicate": True}
        provider_order_id = (str(data.get("orderId"))[:64] if data.get("orderId") else None)
        try:
            if event_type in ("PAYMENT_STATUS_CHANGED", "CANCEL_STATUS_CHANGED"):
                outcome = _webhook_payment(db, provider_order_id)
            elif event_type == "BILLING_DELETED":
                outcome = _webhook_billing_deleted(db, data.get("billingKey"))
            else:
                outcome = "IGNORED"
        except Exception as exc:  # noqa: BLE001 - answer 5xx so Toss retries; record nothing half-done
            db.rollback()
            log.warning("payment webhook %s failed: %s", event_type, type(exc).__name__)
            raise HTTPException(503, "Try again.") from None
        try:
            db.add(PaymentWebhookEvent(dedupe_key=dedupe, event_type=event_type, provider_order_id=provider_order_id,
                                       outcome=outcome, signature_valid=sig))
            db.commit()
        except IntegrityError:  # the same delivery, concurrently
            db.rollback()
            return {"ok": True, "duplicate": True}
    return {"ok": True, "duplicate": False}


def _webhook_payment(db: Session, provider_order_id: str | None) -> str:
    if not provider_order_id:
        return "IGNORED"
    pay = db.scalar(select(Payment).where(Payment.provider == "toss", Payment.provider_order_id == provider_order_id))
    if pay is None:
        # Toss says a payment exists that this server never started. That is exactly the thing to be told about.
        monitoring.record("PAYMENT_ERROR", "payments.webhook", "webhook for a payment this server did not create",
                          detail={"provider_order_id": provider_order_id})
        return "UNKNOWN_PAYMENT"
    order = db.scalar(select(Order).where(Order.id == pay.order_id).with_for_update())
    try:
        charge = billing_svc.client_for_mid(pay.provider_mid).lookup_order(provider_order_id=provider_order_id)
    except (ProviderError, NotConfigured):
        raise RuntimeError("provider lookup failed") from None
    if charge is None:
        return "NO_CHANGE"
    if charge.paid and order.status == OrderStatus.PENDING:
        if not _matches(order, pay, charge):
            _mismatch(db, order, pay, charge)
            return "AMOUNT_MISMATCH"
        _finish_paid(db, order, pay, charge)
        return "APPLIED"
    if charge.status in ("CANCELED", "PARTIAL_CANCELED") and order.status == OrderStatus.PAID and pay.status == "PAID":
        return "APPLIED" if _sync_refund(db, order, pay, charge, reason="Cancelled at the provider") else "NO_CHANGE"
    return "NO_CHANGE"


def _webhook_billing_deleted(db: Session, billing_key) -> str:
    if not isinstance(billing_key, str) or not billing_key:
        return "IGNORED"
    try:
        fp = billing_svc.fingerprint(billing_key)
    except crypto.EncryptionNotConfigured:
        return "IGNORED"
    m = db.scalar(select(StudentPaymentMethod).where(StudentPaymentMethod.billing_key_fingerprint == fp,
                                                     StudentPaymentMethod.status == "ACTIVE").with_for_update())
    if m is None:
        return "NO_CHANGE"
    # The key is already gone at Toss; only the local row is left to close.
    m.status, m.revoked_at, m.is_default = "REVOKED", utcnow(), False
    m.billing_key_ciphertext, m.billing_key_version, m.billing_key_fingerprint, m.reusable = None, None, None, False
    audit(db, action="payment_method.revoked", entity_type="payment_method", entity_id=m.id, actor=None,
          subject_user_id=m.user_id, detail={"remote": "deleted_at_provider", "reason": "provider_webhook", "kind": m.kind})
    return "APPLIED"
