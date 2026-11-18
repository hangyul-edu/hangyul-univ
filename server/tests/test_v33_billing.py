"""Billing-key payments — everything that must hold regardless of what Toss answers.

The provider is a fake that records exactly what it was asked. What only the *live* provider can prove —
that each owner MID really issues a billing key and approves a charge — is proven by a controlled live
transaction and recorded in docs/payments/BILLING.md; a unit test that needs the network fails for
reasons that are not the code's.

    rail           there is one: registration → billing key → one charge. No confirm, no key-in.
    one-time       a billing key is not a payment; nothing activates before a successful charge
    ownership      another student's order, method or registration is a 404
    amount         the figure charged is the stored one; a stale echo is refused before the provider
    secrecy        no billing key, secret key or security key in any response; ciphertext at rest
    idempotency    double submit, retry, timeout and reload converge on one charge and one entitlement
    capability     a merchant that cannot do billing makes that method unavailable — never another rail
    mode           live never falls back to test, and live keys alone do not charge
"""
import base64
import hashlib
import hmac
import json
import os
import uuid

import pytest
from sqlalchemy import func, select

from app.api.v1 import billing as billing_api
from app.core import crypto
from app.core.config import get_settings
from app.models import Order, Payment, ServiceEngagement, User
from app.models.business import PaymentCustomer, PaymentWebhookEvent, StudentPaymentMethod
from app.models.enums import OrderStatus
from app.services import billing as billing_svc
from app.services.payments import ProviderError

API = "/api/v1"
#: Key-shaped stand-ins are assembled at runtime so no file in the tree contains a string shaped like a real key.
TK, SK = "test_" + "ck_", "test_" + "sk_"
#: Stands in for a Toss billing key. Not written in Toss's own shape, so a credential scan of the tree
#: finds nothing here it has to think about.
CREDENTIAL = "stand-in-credential-"
BASIC_MINOR = 17_900


# ------------------------------------------------------------------------------------------- the fake

class FakeToss:
    """One provider for every merchant. Answers however the test needs and records what it was asked."""

    def __init__(self):
        self.issues, self.charges, self.revocations, self.cancels, self.lookups = [], [], [], [], []
        self.issue_error = None
        self.charge_error = None
        self.charge_status = "DONE"
        self.charge_amount = None          # override the amount Toss reports
        self.payments: dict[str, billing_svc.Charge] = {}   # provider_order_id → what Toss "recorded"
        self.record_on_error = False       # a timeout where Toss did take the payment
        self.cancel_error = None
        self.n = 0

    def client(self, merchant, **_):
        return _FakeClient(self, merchant)

    def charge_of(self, *, provider_order_id, amount_minor, currency, status="DONE", balance=None, mid=None):
        self.n += 1
        return billing_svc.Charge(
            payment_key=f"pay_{self.n:04d}", provider_order_id=provider_order_id, status=status,
            amount_minor=amount_minor, balance_minor=amount_minor if balance is None else balance, currency=currency,
            method="카드", approved_at="2026-11-18T10:00:00+09:00", receipt_url="https://example.invalid/receipt",
            failure_code=None, raw={"status": status, "method": "카드", "receiptUrl": "https://example.invalid/receipt", "mId": mid})


class _FakeClient:
    def __init__(self, fake: FakeToss, merchant):
        if not merchant.configured:
            from app.services.payments import NotConfigured
            raise NotConfigured("not configured")
        self.f, self.merchant = fake, merchant

    def issue(self, *, auth_key, customer_key):
        self.f.issues.append({"auth_key": auth_key, "customer_key": customer_key, "mid": self.merchant.mid})
        if self.f.issue_error:
            raise self.f.issue_error
        n = len(self.f.issues)
        return billing_svc.IssuedKey(billing_key=f"{CREDENTIAL}{n}", mid=self.merchant.mid, method="카드", last4=f"{4240 + n}",
                                     brand="Visa", issuer_code="4V", acquirer_code="4V", card_type="신용", owner_type="개인",
                                     easy_pay_provider=None)

    def charge(self, *, billing_key, customer_key, provider_order_id, amount_minor, currency, order_name, idempotency_key,
               customer_email=None, customer_name=None):
        self.f.charges.append({"billing_key": billing_key, "customer_key": customer_key, "provider_order_id": provider_order_id,
                               "amount_minor": amount_minor, "currency": currency, "idempotency_key": idempotency_key,
                               "mid": self.merchant.mid})
        if currency != self.merchant.currency:
            raise ProviderError("CURRENCY_MISMATCH", "currency")
        result = self.f.charge_of(provider_order_id=provider_order_id, amount_minor=self.f.charge_amount or amount_minor,
                                  currency=currency, status=self.f.charge_status, mid=self.merchant.mid)
        if self.f.charge_error:
            if self.f.record_on_error:
                self.f.payments[provider_order_id] = result
            raise self.f.charge_error
        if result.paid:
            self.f.payments[provider_order_id] = result
        return result

    def lookup_order(self, *, provider_order_id):
        self.f.lookups.append(provider_order_id)
        return self.f.payments.get(provider_order_id)

    def revoke(self, *, billing_key):
        self.f.revocations.append(billing_key)
        return True

    def cancel(self, *, payment_key, reason, amount_minor, currency, idempotency_key):
        self.f.cancels.append({"payment_key": payment_key, "amount_minor": amount_minor, "idempotency_key": idempotency_key})
        if self.f.cancel_error:
            raise self.f.cancel_error
        return self.f.charge_of(provider_order_id=None, amount_minor=0, currency=currency, status="CANCELED")


# ------------------------------------------------------------------------------------------- fixtures

@pytest.fixture
def toss(monkeypatch):
    """Toss is the provider, in **test** mode, with the foreign (USD) and domestic (KRW) merchants configured."""
    monkeypatch.setenv(crypto.ENV_KEY, base64.urlsafe_b64encode(os.urandom(32)).decode())
    s = get_settings()
    for k, v in {
        "payment_provider": "toss", "toss_env": "test", "live_payment_enabled": False, "student_self_refund_enabled": False,
        "toss_foreign_billing_mid": "bill_talkoab1", "toss_foreign_billing_client_key": TK + "foreignstub",
        "toss_foreign_billing_secret_key": SK + "foreignstub", "toss_foreign_billing_security_key": "sec-foreign-stub",
        "toss_foreign_billing_currency": "USD",
        "toss_domestic_billing_mid": "bill_talko18s0", "toss_domestic_billing_client_key": TK + "domesticstub",
        "toss_domestic_billing_secret_key": SK + "domesticstub", "toss_domestic_billing_security_key": "sec-domestic-stub",
        "toss_domestic_billing_currency": "KRW",
        "toss_easypay_billing_mid": "bill_talkspm0", "toss_easypay_billing_client_key": TK + "easystub",
        "toss_easypay_billing_secret_key": SK + "easystub", "toss_easypay_billing_security_key": None,
        "toss_easypay_billing_currency": "KRW",
        "toss_capability_domestic_card": "UNVERIFIED", "toss_capability_foreign_card": "UNVERIFIED",
        "toss_capability_toss_pay": "UNVERIFIED", "toss_capability_naver_pay": "UNVERIFIED",
        "toss_return_origin": "https://app.example.invalid",
    }.items():
        monkeypatch.setattr(s, k, v)
    fake = FakeToss()
    monkeypatch.setattr(billing_svc, "BillingClient", fake.client)
    billing_api._hits.clear()
    yield fake
    billing_api._hits.clear()


@pytest.fixture
def student(client):
    from tests.v22_helpers import register_student

    return register_student(client)


def _uid(db, email):
    return db.scalar(select(User).where(User.email == email)).id


def _order(client, h, code="BASIC"):
    r = client.post(f"{API}/me/orders", json={"product_code": code}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def _register(client, h, *, kind="FOREIGN_CARD", order_id=None, auth_key="auth-one-time"):
    start = client.post(f"{API}/me/payment-methods/registrations", json={"kind": kind, "order_id": order_id}, headers=h)
    assert start.status_code == 201, start.text
    s = start.json()
    done = client.post(f"{API}/me/payment-methods/registrations/{s['registration_id']}/complete",
                       json={"auth_key": auth_key, "customer_key": s["customer_key"]}, headers=h)
    return s, done


def _pay(client, h, order, **over):
    body = {"amount_minor": order["amount_minor"], "currency": order["currency"], "one_time_confirmed": True, **over}
    return client.post(f"{API}/me/orders/{order['order_id']}/pay", json=body, headers=h)


def _engagements(db, user_id) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(ServiceEngagement).where(ServiceEngagement.user_id == user_id))


# ============================================================================================ the rail

def test_there_is_exactly_one_payment_rail_and_it_is_not_an_ordinary_payment(client):
    paths = set(client.get("/openapi.json").json()["paths"]) if client.get("/openapi.json").status_code == 200 else set()
    from app.main import app

    paths = paths or set(app.openapi()["paths"])
    assert f"{API}/me/orders/{{order_id}}/pay" in paths
    for gone in ("/me/payments/toss/confirm", "/me/orders/{order_id}/pay-with-card", "/me/orders/{order_id}/pay-with-saved-card"):
        assert f"{API}{gone}" not in paths
    # …and nothing in the server can reach an ordinary-payment or raw-card endpoint at Toss.
    import pathlib

    tree = pathlib.Path(billing_svc.__file__).resolve().parents[1]
    source = "\n".join(p.read_text() for p in tree.rglob("*.py"))
    for needle in ('"/v1/payments/confirm"', "/v1/payments/key-in", "/v1/billing/authorizations/card", "cardNumber\":"):
        assert needle not in source, needle


def test_the_commercial_model_is_one_time_and_says_so(client, toss, student):
    body = client.get(f"{API}/me/payments/options", headers=student["h"]).json()
    assert body["one_time"] is True and body["recurring"] is False and body["rail"] == "BILLING_KEY"
    # No schedule exists to find: no model, column or job speaks of renewing or repeating a charge.
    from app.models import Base

    payment_tables = ("orders", "payments", "student_payment_methods", "payment_customers", "payment_method_registrations",
                      "payment_webhook_events", "service_products", "service_prices", "service_engagements")
    names = " ".join(f"{t.name} {' '.join(c.name for c in t.columns)}" for t in Base.metadata.tables.values()
                     if t.name in payment_tables).lower()
    for word in ("renew", "subscription", "recurr", "next_charge", "billing_cycle"):
        assert word not in names, word


def test_an_order_is_priced_by_the_server_and_carries_nothing_that_can_start_a_payment(client, toss, student, db):
    order = _order(client, student["h"])
    assert order["amount_minor"] == BASIC_MINOR and order["currency"] == "USD" and order["status"] == "PENDING"
    assert order["payment_state"] == "PAYMENT_METHOD_REQUIRED" and order["one_time"] is True
    text = json.dumps(order)
    for secret in (SK, TK, "sec-foreign-stub", "client_key", "customer_key"):
        assert secret not in text
    # Not charged, so no charge attempt exists.
    assert db.scalar(select(func.count()).select_from(Payment).where(Payment.order_id == uuid.UUID(order["order_id"]))) == 0


def test_an_order_no_method_could_pay_is_refused_and_not_created(client, toss, student, db, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "toss_foreign_billing_secret_key", None)  # the only USD merchant is gone
    before = db.scalar(select(func.count()).select_from(Order))
    r = client.post(f"{API}/me/orders", json={"product_code": "BASIC"}, headers=student["h"])
    assert r.status_code == 503 and r.json()["detail"]["code"] == "PAYMENT_UNAVAILABLE"
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Order)) == before


def test_options_name_each_method_and_why_it_is_unavailable(client, toss, student):
    order = _order(client, student["h"])
    body = client.get(f"{API}/me/payments/options", params={"order_id": order["order_id"]}, headers=student["h"]).json()
    by = {m["kind"]: m for m in body["methods"]}
    assert by["FOREIGN_CARD"]["available"] is True
    assert by["DOMESTIC_CARD"] == {"kind": "DOMESTIC_CARD", "available": False, "reason": "CURRENCY_MISMATCH", "currency": "KRW"}
    # Toss documents no registration method for easy-pay billing; it is unavailable, not improvised.
    assert by["TOSS_PAY"]["reason"] == "PROVIDER_SPEC_REQUIRED" and by["NAVER_PAY"]["reason"] == "PROVIDER_SPEC_REQUIRED"
    assert "_sk_" not in json.dumps(body) and "_ck_" not in json.dumps(body)


# ============================================================================================ registration

def test_registration_hands_the_browser_a_client_key_and_an_opaque_customer_key_only(client, toss, student, db):
    r = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "FOREIGN_CARD"}, headers=student["h"])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["client_key"] == TK + "foreignstub" and body["method"] == "CARD"
    assert body["success_url"].startswith("https://app.example.invalid/services/payment-methods/return?registration=")
    text = json.dumps(body)
    assert SK not in text and "sec-foreign-stub" not in text
    ck = body["customer_key"]
    uid = _uid(db, student["email"])
    assert 22 <= len(ck) <= 50 and student["email"] not in ck and str(uid) not in ck and uid.hex not in ck
    assert student["phone"] not in ck
    # Stable: the same student always registers under the same key.
    again = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "FOREIGN_CARD"}, headers=student["h"]).json()
    assert again["customer_key"] == ck
    assert db.scalar(select(func.count()).select_from(PaymentCustomer).where(PaymentCustomer.user_id == uid)) == 1


def test_a_billing_key_is_sealed_at_rest_and_is_not_a_payment(client, toss, student, db):
    order = _order(client, student["h"])
    _, done = _register(client, student["h"], order_id=order["order_id"])
    assert done.status_code == 200, done.text
    body = done.json()
    assert CREDENTIAL not in json.dumps(body) and "billing_key" not in json.dumps(body)
    assert body["payment_method"]["kind"] == "FOREIGN_CARD" and body["payment_method"]["last4"] == "4241"
    uid = _uid(db, student["email"])
    m = db.scalar(select(StudentPaymentMethod).where(StudentPaymentMethod.user_id == uid))
    assert m.reusable and m.billing_key_ciphertext and CREDENTIAL not in m.billing_key_ciphertext
    assert crypto.open_sealed(m.billing_key_ciphertext, key_version=m.billing_key_version, aad=str(uid)) == f"{CREDENTIAL}1"
    with pytest.raises(crypto.DecryptionFailed):  # bound to its owner: moved to another row, it does not open
        crypto.open_sealed(m.billing_key_ciphertext, key_version=m.billing_key_version, aad=str(uuid.uuid4()))
    assert m.masked_number == "•••• 4241"
    # The key was issued. Nothing was charged and nothing switched on.
    row = db.get(Order, uuid.UUID(order["order_id"]))
    assert row.status == OrderStatus.PENDING and row.payment_state == "BILLING_KEY_READY"
    assert toss.charges == [] and _engagements(db, uid) == 0
    assert client.get(f"{API}/me/plan", headers=student["h"]).json() in (None, {}) or \
        not (client.get(f"{API}/me/plan", headers=student["h"]).json() or {}).get("code")
    # …and the list endpoint never carries the credential either.
    assert CREDENTIAL not in client.get(f"{API}/me/payment-methods", headers=student["h"]).text


def test_a_return_with_someone_elses_customer_key_issues_nothing(client, toss, student):
    start = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "FOREIGN_CARD"}, headers=student["h"]).json()
    r = client.post(f"{API}/me/payment-methods/registrations/{start['registration_id']}/complete",
                    json={"auth_key": "auth-x", "customer_key": "hgc_" + "x" * 40}, headers=student["h"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "KEY_ISSUE_FAILED"
    assert toss.issues == []


def test_a_registration_belongs_to_one_student(client, toss, student):
    from tests.v22_helpers import register_student

    other = register_student(client)
    start = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "FOREIGN_CARD"}, headers=student["h"]).json()
    r = client.post(f"{API}/me/payment-methods/registrations/{start['registration_id']}/complete",
                    json={"auth_key": "auth-x", "customer_key": start["customer_key"]}, headers=other["h"])
    assert r.status_code == 404 and toss.issues == []


def test_reloading_the_return_url_issues_one_key(client, toss, student):
    s, done = _register(client, student["h"])
    assert done.status_code == 200
    again = client.post(f"{API}/me/payment-methods/registrations/{s['registration_id']}/complete",
                        json={"auth_key": "auth-one-time", "customer_key": s["customer_key"]}, headers=student["h"])
    assert again.status_code == 200 and again.json()["already_completed"] is True
    assert again.json()["payment_method"]["id"] == done.json()["payment_method"]["id"]
    assert len(toss.issues) == 1


def test_a_merchant_that_cannot_issue_a_key_makes_the_method_fail_and_nothing_else_is_tried(client, toss, student, db):
    toss.issue_error = ProviderError("NOT_SUPPORTED_METHOD", "지원되지 않는 결제수단입니다.")
    order = _order(client, student["h"])
    _, done = _register(client, student["h"], order_id=order["order_id"])
    assert done.status_code == 402 and done.json()["detail"]["code"] == "METHOD_UNAVAILABLE"
    assert "지원" not in done.text  # the provider's own words stay in the audit log
    uid = _uid(db, student["email"])
    assert db.scalar(select(func.count()).select_from(StudentPaymentMethod).where(StudentPaymentMethod.user_id == uid)) == 0
    assert toss.charges == []  # no fallback to any other rail
    row = db.get(Order, uuid.UUID(order["order_id"]))
    assert row.status == OrderStatus.PENDING and row.payment_state == "PAYMENT_METHOD_REQUIRED"


def test_the_student_closing_the_window_is_a_cancellation_not_an_error(client, toss, student, db):
    order = _order(client, student["h"])
    start = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "FOREIGN_CARD", "order_id": order["order_id"]},
                        headers=student["h"]).json()
    assert db.get(Order, uuid.UUID(order["order_id"])).payment_state == "BILLING_AUTH_PENDING"
    r = client.post(f"{API}/me/payment-methods/registrations/{start['registration_id']}/fail",
                    json={"code": "PAY_PROCESS_CANCELED"}, headers=student["h"])
    assert r.status_code == 200 and r.json() == {"status": "CANCELLED", "code": "AUTH_CANCELLED", "order_id": order["order_id"]}
    db.expire_all()
    assert db.get(Order, uuid.UUID(order["order_id"])).payment_state == "PAYMENT_METHOD_REQUIRED"


def test_easy_pay_registration_is_refused_by_name(client, toss, student):
    r = client.post(f"{API}/me/payment-methods/registrations", json={"kind": "TOSS_PAY"}, headers=student["h"])
    assert r.status_code == 503
    assert r.json()["detail"] | {"message": ""} == {"code": "METHOD_UNAVAILABLE", "reason": "PROVIDER_SPEC_REQUIRED", "message": ""}


# ============================================================================================ the one charge

def test_paying_charges_the_stored_amount_once_and_activates_once(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    uid = _uid(db, student["email"])
    r = _pay(client, student["h"], order)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "PAID" and body["payment_state"] == "PAID" and body["one_time"] is True
    assert body["receipt_url"] and CREDENTIAL not in r.text
    assert len(toss.charges) == 1
    c = toss.charges[0]
    assert c["amount_minor"] == BASIC_MINOR and c["currency"] == "USD" and c["mid"] == "bill_talkoab1"
    assert c["billing_key"] == f"{CREDENTIAL}1"
    assert c["idempotency_key"] == f"hg-charge-{order['order_id']}-1"
    assert c["provider_order_id"] == f"{uuid.UUID(order['order_id']).hex}-01"
    pay = db.scalar(select(Payment).where(Payment.order_id == uuid.UUID(order["order_id"])))
    assert pay.status == "PAID" and pay.provider_mid == "bill_talkoab1" and pay.attempt == 1 and pay.provider_ref
    assert _engagements(db, uid) == 1
    # A second press, a reload, a retry: the same order, no second charge, no second entitlement.
    again = _pay(client, student["h"], order)
    assert again.status_code == 200 and again.json()["already_paid"] is True
    assert len(toss.charges) == 1 and _engagements(db, uid) == 1
    assert db.scalar(select(func.count()).select_from(Payment).where(Payment.order_id == uuid.UUID(order["order_id"]))) == 1


def test_a_saved_method_pays_the_next_order_without_registering_again(client, toss, student, db, monkeypatch):
    _register(client, student["h"])
    order = _order(client, student["h"])
    assert order["payment_state"] == "BILLING_KEY_READY"
    r = _pay(client, student["h"], order)
    assert r.status_code == 200 and r.json()["status"] == "PAID"
    assert len(toss.issues) == 1 and len(toss.charges) == 1


def test_the_student_must_confirm_the_one_time_payment_and_the_amount_they_saw(client, toss, student):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    r = _pay(client, student["h"], order, one_time_confirmed=False)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "CONSENT_REQUIRED"
    r = _pay(client, student["h"], order, amount_minor=100)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "AMOUNT_MISMATCH"
    r = _pay(client, student["h"], order, currency="KRW")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "AMOUNT_MISMATCH"
    assert toss.charges == []  # refused before the provider was asked


def test_orders_and_methods_belong_to_one_student(client, toss, student):
    from tests.v22_helpers import register_student

    other = register_student(client)
    order = _order(client, student["h"])
    _, done = _register(client, student["h"], order_id=order["order_id"])
    mine = done.json()["payment_method"]["id"]
    # Someone else's order is a 404, not a 403.
    assert _pay(client, other["h"], order).status_code == 404
    assert client.get(f"{API}/me/orders/{order['order_id']}", headers=other["h"]).status_code == 404
    assert client.get(f"{API}/me/payments/options", params={"order_id": order["order_id"]}, headers=other["h"]).status_code == 404
    # Someone else's saved method cannot pay my order, be made default, or be removed.
    theirs = _order(client, other["h"])
    assert _pay(client, other["h"], theirs, payment_method_id=mine).status_code == 404
    assert client.post(f"{API}/me/payment-methods/{mine}/default", headers=other["h"]).status_code == 404
    assert client.delete(f"{API}/me/payment-methods/{mine}", headers=other["h"]).status_code == 404
    assert toss.charges == [] and toss.revocations == []
    assert client.get(f"{API}/me/payment-methods", headers=other["h"]).json()["items"] == []


def test_a_decline_keeps_the_order_payable_and_a_retry_is_a_new_attempt(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    uid = _uid(db, student["email"])
    toss.charge_error = ProviderError("REJECT_CARD_COMPANY", "카드사에서 승인을 거절했습니다.")
    r = _pay(client, student["h"], order)
    assert r.status_code == 402 and r.json()["detail"]["code"] == "CARD_DECLINED"
    assert "카드사" not in r.text
    row = db.get(Order, uuid.UUID(order["order_id"]))
    assert row.status == OrderStatus.PENDING and row.payment_state == "FAILED" and _engagements(db, uid) == 0
    toss.charge_error = None
    r = _pay(client, student["h"], order)
    assert r.status_code == 200 and r.json()["status"] == "PAID"
    # A fresh idempotency key and provider order id — otherwise Toss would replay the cached decline.
    assert [c["idempotency_key"] for c in toss.charges] == [f"hg-charge-{order['order_id']}-1", f"hg-charge-{order['order_id']}-2"]
    assert toss.charges[0]["provider_order_id"] != toss.charges[1]["provider_order_id"]
    assert _engagements(db, uid) == 1
    statuses = [p.status for p in db.scalars(select(Payment).where(Payment.order_id == row.id).order_by(Payment.attempt))]
    assert statuses == ["FAILED", "PAID"]


@pytest.mark.parametrize("code,category", [
    ("REJECT_ACCOUNT_PAYMENT", "INSUFFICIENT_FUNDS"), ("INVALID_CARD_EXPIRATION", "EXPIRED_CARD"),
    ("INVALID_STOPPED_CARD", "SUSPENDED_CARD"), ("FAILED_CARD_COMPANY_RESPONSE", "PROVIDER_TEMPORARY"),
    ("EXCEED_MAX_AMOUNT", "LIMIT_EXCEEDED"), ("SOMETHING_NEW", "PAYMENT_FAILED"),
])
def test_provider_refusals_become_sentences_a_student_can_act_on(client, toss, student, code, category):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    toss.charge_error = ProviderError(code, "provider words")
    r = _pay(client, student["h"], order)
    assert r.status_code == 402 and r.json()["detail"]["code"] == category and code not in r.text


def test_a_timeout_marks_nothing_and_the_truth_is_asked_of_the_provider(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    uid = _uid(db, student["email"])
    # The response was lost — but Toss did take the payment.
    toss.charge_error, toss.record_on_error = ProviderError("NETWORK", "timeout"), True
    r = _pay(client, student["h"], order)
    assert r.status_code == 202 and r.json()["code"] == "PAYMENT_PENDING_CONFIRMATION" and r.json()["status"] == "PENDING"
    row = db.get(Order, uuid.UUID(order["order_id"]))
    assert row.payment_state == "CHARGING" and _engagements(db, uid) == 0
    # A charge may be in flight: the order cannot be cancelled out from under it.
    assert client.post(f"{API}/me/orders/{order['order_id']}/cancel", headers=student["h"]).status_code == 409
    toss.charge_error = None
    # The student presses pay again. The server asks Toss first, finds the payment, and does not charge twice.
    r = _pay(client, student["h"], order)
    assert r.status_code == 200 and r.json()["status"] == "PAID" and r.json()["already_paid"] is True
    assert len(toss.charges) == 1 and _engagements(db, uid) == 1


def test_an_unknown_outcome_blocks_a_second_charge_until_it_is_known(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    toss.charge_error = ProviderError("NETWORK", "timeout")  # and Toss has no record yet
    assert _pay(client, student["h"], order).status_code == 202
    toss.charge_error = None
    r = _pay(client, student["h"], order)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PAYMENT_IN_PROGRESS"
    assert len(toss.charges) == 1
    # Once the attempt is older than any charge can be in flight and Toss still has nothing, it did not happen.
    pay = db.scalar(select(Payment).where(Payment.order_id == uuid.UUID(order["order_id"])))
    from datetime import timedelta

    pay.created_at = pay.created_at - timedelta(seconds=billing_api.IN_FLIGHT_SECONDS + 5)
    db.commit()
    r = _pay(client, student["h"], order)
    assert r.status_code == 200 and r.json()["status"] == "PAID" and len(toss.charges) == 2


def test_the_receipt_poll_and_the_sweep_recover_a_payment_the_browser_never_saw(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    uid = _uid(db, student["email"])
    toss.charge_error, toss.record_on_error = ProviderError("NETWORK", "timeout"), True
    assert _pay(client, student["h"], order).status_code == 202
    r = client.get(f"{API}/me/orders/{order['order_id']}", headers=student["h"])
    assert r.status_code == 200 and r.json()["status"] == "PAID"
    assert len(toss.charges) == 1 and _engagements(db, uid) == 1
    assert client.get(f"{API}/me/services", headers=student["h"]).json()["owned"] == ["BASIC"]


def test_a_provider_amount_that_is_not_the_orders_activates_nothing(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    toss.charge_amount = 100
    r = _pay(client, student["h"], order)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "AMOUNT_MISMATCH"
    row = db.get(Order, uuid.UUID(order["order_id"]))
    assert row.status == OrderStatus.PENDING and _engagements(db, _uid(db, student["email"])) == 0
    assert db.scalar(select(Payment).where(Payment.order_id == row.id)).status == "REVIEW"


def test_a_method_on_a_merchant_that_settles_another_currency_cannot_pay(client, toss, student):
    _, done = _register(client, student["h"], kind="DOMESTIC_CARD")
    assert done.status_code == 200
    krw_method = done.json()["payment_method"]["id"]
    order = _order(client, student["h"])
    assert order["payment_state"] == "PAYMENT_METHOD_REQUIRED"  # a KRW method is not a way to pay a USD order
    r = _pay(client, student["h"], order, payment_method_id=krw_method)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "CURRENCY_MISMATCH"
    r = _pay(client, student["h"], order)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PAYMENT_METHOD_REQUIRED"
    assert toss.charges == []


# ============================================================================================ saved methods

def test_removing_a_method_deletes_it_at_the_provider_and_it_can_never_be_charged(client, toss, student, db):
    _, done = _register(client, student["h"])
    mid = done.json()["payment_method"]["id"]
    r = client.delete(f"{API}/me/payment-methods/{mid}", headers=student["h"])
    assert r.status_code == 200 and r.json() == {"deleted": True, "remote": "revoked"}
    assert toss.revocations == [f"{CREDENTIAL}1"]
    m = db.get(StudentPaymentMethod, uuid.UUID(mid))
    assert m.status == "REVOKED" and m.billing_key_ciphertext is None and m.billing_key_fingerprint is None and not m.reusable
    assert client.get(f"{API}/me/payment-methods", headers=student["h"]).json()["items"] == []
    order = _order(client, student["h"])
    assert _pay(client, student["h"], order, payment_method_id=mid).status_code == 404
    assert _pay(client, student["h"], order).json()["detail"]["code"] == "PAYMENT_METHOD_REQUIRED"
    assert toss.charges == []
    assert client.delete(f"{API}/me/payment-methods/{mid}", headers=student["h"]).status_code == 404


def test_default_and_replacement(client, toss, student):
    _, a = _register(client, student["h"], auth_key="auth-a")
    _, b = _register(client, student["h"], auth_key="auth-b")
    a_id, b_id = a.json()["payment_method"]["id"], b.json()["payment_method"]["id"]
    items = client.get(f"{API}/me/payment-methods", headers=student["h"]).json()["items"]
    assert {i["id"]: i["is_default"] for i in items} == {a_id: True, b_id: False}
    items = client.post(f"{API}/me/payment-methods/{b_id}/default", headers=student["h"]).json()["items"]
    assert {i["id"]: i["is_default"] for i in items} == {a_id: False, b_id: True}
    # Removing the default promotes the one that is left.
    client.delete(f"{API}/me/payment-methods/{b_id}", headers=student["h"])
    items = client.get(f"{API}/me/payment-methods", headers=student["h"]).json()["items"]
    assert [(i["id"], i["is_default"]) for i in items] == [(a_id, True)]


# ============================================================================================ mode & capability

def test_live_never_falls_back_to_test_and_live_keys_alone_do_not_charge(toss, monkeypatch):
    s = get_settings()
    av = lambda **kw: billing_svc.availability("FOREIGN_CARD", **kw)  # noqa: E731
    assert av().available and av().mode == "test"
    monkeypatch.setattr(s, "toss_env", "live")
    assert av().reason == "MODE_MISMATCH"                     # test keys under live: refused, not used
    monkeypatch.setattr(s, "toss_foreign_billing_client_key", "live_" + "ck_stub")
    monkeypatch.setattr(s, "toss_foreign_billing_secret_key", "live_" + "sk_stub")
    assert av().reason == "LIVE_PAYMENT_DISABLED"             # live keys are not permission to charge
    monkeypatch.setattr(s, "live_payment_enabled", True)
    assert av().reason == "CAPABILITY_UNVERIFIED"             # …and neither is the switch, without evidence
    monkeypatch.setattr(s, "toss_capability_foreign_card", "BLOCKED")
    assert av().reason == "PROVIDER_CAPABILITY_BLOCKED"
    monkeypatch.setattr(s, "toss_capability_foreign_card", "VERIFIED")
    assert av().available and av().mode == "live"
    assert av(currency="KRW").reason == "CURRENCY_MISMATCH"
    monkeypatch.setattr(s, "toss_env", "test")
    assert av().reason == "MODE_MISMATCH"                     # live keys under test: a sandbox must not charge


def test_production_refuses_to_start_on_anything_but_the_contracted_live_merchants(toss, monkeypatch):
    s = get_settings()
    problems = billing_svc.production_violations(s)
    assert any("HG_TOSS_ENV must be live" in p for p in problems)
    assert any("not a live key" in p for p in problems)
    monkeypatch.setattr(s, "toss_env", "live")
    for m in ("domestic", "foreign", "easypay"):
        monkeypatch.setattr(s, f"toss_{m}_billing_client_key", "live_" + "ck_stub")
        monkeypatch.setattr(s, f"toss_{m}_billing_secret_key", "live_" + "sk_stub")
        monkeypatch.setattr(s, f"toss_{m}_billing_security_key", "sec-stub")
    assert billing_svc.production_violations(s) == []
    monkeypatch.setattr(s, "toss_foreign_billing_mid", "bill_someoneelse")
    assert any("not the contracted live MID" in p for p in billing_svc.production_violations(s))


# ============================================================================================ refunds

def _paid(client, toss, student):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    assert _pay(client, student["h"], order).status_code == 200
    return order


def test_a_student_cannot_name_their_own_refund(client, toss, student):
    order = _paid(client, toss, student)
    r = client.post(f"{API}/me/orders/{order['order_id']}/refund", json={"amount_minor": BASIC_MINOR, "reason": "changed my mind"},
                    headers=student["h"])
    assert r.status_code == 403 and r.json()["detail"]["code"] == "REFUND_BY_TEAM" and toss.cancels == []


def test_refunds_go_back_through_the_merchant_that_charged(client, toss, student, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "student_self_refund_enabled", True)  # the mechanics, not the policy
    order = _paid(client, toss, student)
    uid = _uid(db, student["email"])
    url = f"{API}/me/orders/{order['order_id']}/refund"
    # No amount is ever invented.
    assert client.post(url, json={"reason": "no amount"}, headers=student["h"]).status_code == 422
    assert client.post(url, json={"amount_minor": BASIC_MINOR + 1, "reason": "too much"}, headers=student["h"]).status_code == 409
    r = client.post(url, json={"amount_minor": 5_000, "reason": "partial one"}, headers=student["h"])
    assert r.status_code == 200 and r.json()["fully_refunded"] is False and r.json()["payment_state"] == "PARTIALLY_REFUNDED"
    assert r.json()["status"] == "PAID"  # a partial refund leaves the service active
    db.expire_all()
    assert db.scalar(select(ServiceEngagement).where(ServiceEngagement.user_id == uid)).status != "REFUNDED"
    r = client.post(url, json={"amount_minor": BASIC_MINOR - 5_000, "reason": "the rest"}, headers=student["h"])
    assert r.status_code == 200 and r.json()["fully_refunded"] is True and r.json()["status"] == "REFUNDED"
    db.expire_all()
    assert db.scalar(select(ServiceEngagement).where(ServiceEngagement.user_id == uid)).status == "REFUNDED"
    # Two genuine partial refunds, two idempotency keys, both against the billing charge's own payment key.
    keys = [c["idempotency_key"] for c in toss.cancels]
    assert len(set(keys)) == 2 and all(k.startswith(f"hg-refund-{order['order_id']}-") for k in keys)
    pay = db.scalar(select(Payment).where(Payment.order_id == uuid.UUID(order["order_id"]), Payment.attempt == 1))
    assert pay.refunded_amount_minor == BASIC_MINOR and {c["payment_key"] for c in toss.cancels} == {"pay_0001"}
    assert client.post(url, json={"amount_minor": 1, "reason": "again"}, headers=student["h"]).status_code == 409


def test_a_refused_refund_leaves_the_order_paid(client, toss, student, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "student_self_refund_enabled", True)
    order = _paid(client, toss, student)
    toss.cancel_error = ProviderError("ALREADY_CANCELED_PAYMENT", "이미 취소된 결제입니다.")
    r = client.post(f"{API}/me/orders/{order['order_id']}/refund", json={"amount_minor": BASIC_MINOR, "reason": "full"},
                    headers=student["h"])
    assert r.status_code == 402
    db.expire_all()
    assert db.get(Order, uuid.UUID(order["order_id"])).status == OrderStatus.PAID


def test_staff_refund_is_scoped_to_their_students(client, toss, student):
    order = _paid(client, toss, student)
    r = client.post(f"{API}/agency/orders/{order['order_id']}/refund", json={"amount_minor": 1, "reason": "x y z"}, headers=student["h"])
    assert r.status_code in (401, 403)  # a student is not staff
    assert toss.cancels == []


# ============================================================================================ webhook

def _hook(client, payload: dict, headers: dict | None = None):
    return client.post(f"{API}/payments/webhooks/toss", content=json.dumps(payload), headers={"Content-Type": "application/json", **(headers or {})})


def test_a_webhook_is_a_prompt_to_ask_toss_never_a_fact(client, toss, student, db):
    order = _order(client, student["h"])
    _register(client, student["h"], order_id=order["order_id"])
    uid = _uid(db, student["email"])
    toss.charge_error = ProviderError("NETWORK", "timeout")  # CHARGING, and Toss has no record
    assert _pay(client, student["h"], order).status_code == 202
    poid = toss.charges[0]["provider_order_id"]
    forged = {"eventType": "PAYMENT_STATUS_CHANGED", "createdAt": "2026-11-18T10:00:00", "data": {"orderId": poid, "status": "DONE", "totalAmount": 179}}
    assert _hook(client, forged).status_code == 200
    assert _engagements(db, uid) == 0  # the body said DONE; Toss did not, so nothing happened
    # Now Toss really has it. A (different) delivery makes the server look, and the lookup is what activates.
    toss.payments[poid] = toss.charge_of(provider_order_id=poid, amount_minor=BASIC_MINOR, currency="USD")
    real = {**forged, "createdAt": "2026-11-18T10:00:05"}
    assert _hook(client, real).json() == {"ok": True, "duplicate": False}
    assert _engagements(db, uid) == 1
    assert db.get(Order, uuid.UUID(order["order_id"])).status == OrderStatus.PAID
    # The same delivery again is acknowledged and does nothing.
    assert _hook(client, real).json() == {"ok": True, "duplicate": True}
    assert _engagements(db, uid) == 1 and len(toss.charges) == 1


def test_a_webhook_for_a_payment_nobody_started_is_recorded_as_unknown(client, toss, db):
    poid = f"{uuid.uuid4().hex}-01"
    r = _hook(client, {"eventType": "PAYMENT_STATUS_CHANGED", "createdAt": "x", "data": {"orderId": poid, "status": "DONE"}})
    assert r.status_code == 200
    ev = db.scalar(select(PaymentWebhookEvent).where(PaymentWebhookEvent.provider_order_id == poid))
    assert ev.outcome == "UNKNOWN_PAYMENT"


def test_a_signed_webhook_must_verify(client, toss):
    payload = json.dumps({"eventType": "BILLING_DELETED", "createdAt": "x", "data": {"billingKey": "nope"}})
    t = "2026-11-18T10:00:00+09:00"
    bad = client.post(f"{API}/payments/webhooks/toss", content=payload,
                      headers={"tosspayments-webhook-signature": "v1:" + base64.b64encode(b"x" * 32).decode(),
                               "tosspayments-webhook-transmission-time": t})
    assert bad.status_code == 401
    good_sig = base64.b64encode(hmac.new(b"sec-foreign-stub", payload.encode() + b":" + t.encode(), hashlib.sha256).digest()).decode()
    good = client.post(f"{API}/payments/webhooks/toss", content=payload,
                       headers={"tosspayments-webhook-signature": f"v1:{good_sig}", "tosspayments-webhook-transmission-time": t})
    assert good.status_code == 200


def test_a_key_deleted_at_the_provider_closes_the_saved_method(client, toss, student, db):
    _, done = _register(client, student["h"])
    mid = done.json()["payment_method"]["id"]
    r = _hook(client, {"eventType": "BILLING_DELETED", "createdAt": "2026-11-18T11:00:00", "data": {"billingKey": f"{CREDENTIAL}1", "reason": None}})
    assert r.status_code == 200
    db.expire_all()
    m = db.get(StudentPaymentMethod, uuid.UUID(mid))
    assert m.status == "REVOKED" and m.billing_key_ciphertext is None
    assert client.get(f"{API}/me/payment-methods", headers=student["h"]).json()["items"] == []


# ============================================================================================ secrecy

def test_logs_cannot_carry_a_credential():
    from app.core.logs import redact

    line = ('HTTP Request: POST https://api.tosspayments.com/v1/billing/abcDEF123456xyz "HTTP/1.1 200 OK" '
            'authKey=one-time-auth billingKey: "abcDEF123456xyz" Authorization: Basic dGVzdF9za19hYmNkZWY6 '
            + "live" + "_sk_" + "A1b2C3d4E5f6G7h8")
    out = redact(line, secrets=[])
    for leaked in ("abcDEF123456xyz", "one-time-auth", "dGVzdF9za19hYmNkZWY6", "A1b2C3d4E5f6G7h8"):
        assert leaked not in out, out
    # The registration endpoint's path is not a credential and stays readable.
    assert "/v1/billing/authorizations/issue" in redact("POST /v1/billing/authorizations/issue", secrets=[])


def test_customer_keys_are_random_and_valid_for_toss():
    keys = {billing_svc.new_customer_key() for _ in range(200)}
    assert len(keys) == 200
    assert all(22 <= len(k) <= 50 and k.startswith("hgc_") for k in keys)


def test_objects_that_hold_a_credential_do_not_print_it():
    issued = billing_svc.IssuedKey(billing_key=f"{CREDENTIAL}9", mid="m", method="카드", last4="4242", brand="Visa", issuer_code=None,
                                   acquirer_code=None, card_type=None, owner_type=None, easy_pay_provider=None)
    assert CREDENTIAL not in repr(issued) and CREDENTIAL not in str(issued)
    m = billing_svc.Merchant(key="foreign", mid="bill_x", client_key="test_ck_a", secret_key="test_sk_b", security_key="sec", currency="USD")
    assert "test_sk_b" not in repr(m) and "sec" not in repr(m).replace("security", "")
