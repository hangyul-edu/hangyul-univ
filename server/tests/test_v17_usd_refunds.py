"""V17 — USD pricing, the currency contract gate, and the refund path.

Three things are under test, and the boundary between them matters:

* **USD is the commercial model.** The manifest, the seed and the API agree on $179 / $349 / $599 in cents.
* **A currency the merchant cannot settle is refused, not substituted.** Toss holds one currency per MID
  (REPORT §152), so a USD price on a KRW MID is a contract that does not exist. The server answers 503 and
  creates nothing — it must never quietly open a won order for a dollar price.
* **Refunds work technically and decide nothing legally.** The amount is always the caller's; there is no
  default, no pro-rata and no policy in this code. `release:check` keeps failing on the policy until a
  person approves one.

The provider is stubbed throughout. §152 records what the *live* provider actually did with a USD request —
it opened a window and errored — and that is a provider result, not something a test should re-run on every
commit against a third party.
"""
import uuid

import pytest
from sqlalchemy import select

from app.api.v1 import student as student_api
from app.core.config import get_settings
from app.models import Order, Payment, ServiceProduct
from app.models.enums import OrderStatus
from app.services import entitlements
from app.services.payments import Approval, ProviderError

# ------------------------------------------------------------------------------------------- helpers

class _StubToss:
    def __init__(self, *, approval=None, error=None, cancel=None, cancel_error=None):
        self._approval, self._error = approval, error
        self._cancel, self._cancel_error = cancel, cancel_error
        self.confirms, self.cancels = [], []

    def confirm(self, *, payment_key, order_id, amount_minor):
        self.confirms.append({"payment_key": payment_key, "order_id": order_id, "amount_minor": amount_minor})
        if self._error:
            raise self._error
        return self._approval

    def cancel(self, *, payment_key, reason, amount_minor=None, idempotency_key=None):
        self.cancels.append({"payment_key": payment_key, "reason": reason,
                             "amount_minor": amount_minor, "idempotency_key": idempotency_key})
        if self._cancel_error:
            raise self._cancel_error
        return self._cancel

    def lookup(self, *, order_id):
        return None



@pytest.fixture
def student(client):  # V29: a plan-less student per test — a student who already holds a plan cannot buy another (REPORT §390)
    from tests.v22_helpers import register_student

    return register_student(client)["h"]

def _approval(amount: int, key: str = "tviva_v17", status: str = "PAID") -> Approval:
    return Approval(status=status, provider_ref=key, amount_minor=amount, method="해외카드",
                    approved_at="2026-10-20T18:00:00+09:00", receipt_url=None,
                    raw={"paymentKey": key, "status": "DONE", "method": "해외카드", "totalAmount": amount})


@pytest.fixture
def usd_contracted(monkeypatch):
    """Pretend the four contracts exist, so the USD path can be exercised at all.

    In reality every one is false (REPORT §152) and that is the *other* half of what these tests check —
    `test_usd_is_refused_when_the_contract_does_not_exist` runs without this fixture on purpose.
    """
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "toss")
    monkeypatch.setattr(s, "toss_env", "live")
    for flag in ("toss_foreign_card_contract_ready", "toss_card_review_ready",
                 "toss_usd_multicurrency_ready", "toss_live_keys_ready"):
        monkeypatch.setattr(s, flag, True)
    monkeypatch.setattr(s, "toss_normal_client_key", s.toss_normal_client_key or "test_ck_stub")
    monkeypatch.setattr(s, "toss_normal_secret_key", s.toss_normal_secret_key or "test_sk_stub")
    yield s


@pytest.fixture
def toss_only(monkeypatch):
    """The provider is Toss and **no route** can take USD.

    V21 added a second route to USD — the foreign-card key-in MID — so turning the four 결제창 contract
    flags off no longer describes a server that cannot take the currency. The fixture turns that route
    off too, because the condition this file is about is *neither route available*, and a fixture that
    describes a different world would quietly stop testing anything.
    """
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "toss")
    monkeypatch.setattr(s, "toss_env", "test")
    monkeypatch.setattr(type(s), "foreign_billing_enabled", property(lambda _: False))
    for flag in ("toss_foreign_card_contract_ready", "toss_card_review_ready",
                 "toss_usd_multicurrency_ready", "toss_live_keys_ready"):
        monkeypatch.setattr(s, flag, False)
    monkeypatch.setattr(s, "toss_normal_client_key", s.toss_normal_client_key or "test_ck_stub")
    monkeypatch.setattr(s, "toss_normal_secret_key", s.toss_normal_secret_key or "test_sk_stub")
    yield s


@pytest.fixture
def stub(monkeypatch):
    def install(**kw):
        s = _StubToss(**kw)
        monkeypatch.setattr(student_api, "get_toss", lambda: s)
        return s
    return install


def _user_id(db, email):
    from app.models import User
    return db.scalar(select(User).where(User.email == email)).id


def _login(client, email):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "Hangyul!2026", "client": "student"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ------------------------------------------------------------------------------------ the USD model

def test_every_plan_is_priced_in_usd_cents(client, db):
    """$179 / $349 / $599 — and `amount_minor` is **cents**, because USD has a minor unit."""
    want = {"BASIC": 17_900, "ALL_IN_ONE": 34_900, "PREMIUM": 59_900}
    for code, minor in want.items():
        prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == code))
        price = next(p for p in prod.prices if p.country_code is None)
        assert price.currency == "USD", f"{code} is priced in {price.currency}"
        assert price.amount_minor == minor, f"{code} is {price.amount_minor}, expected {minor}"
    # And no retired won figure survives as a price anywhere.
    for p in db.scalars(select(ServiceProduct)).all():
        for pr in p.prices:
            assert pr.amount_minor not in (249_000, 499_000, 849_000), f"{p.code} still carries a KRW plan price"


def test_the_api_serves_usd(client, student):
    body = client.get("/api/v1/me/services", headers=student).json()
    for prod in body["products"]:
        assert prod["price"]["currency"] == "USD"


# ------------------------------------------------------------- the contract gate, in both directions

def test_usd_is_accepted_once_the_foreign_card_route_exists(client, monkeypatch, stub):
    """V21 — the other direction, which had no test because until V21 there was no second route.

    `live_usd_checkout_enabled` is `toss_env == "live" and all four contract flags`, so with USD-priced
    plans it refused 100 % of purchases and refused them in test too: there was no path on which a USD
    order could be created at all (REPORT §230). The foreign-card MID is a different contract and a
    different endpoint, and the sandbox proves it settles USD — so an order is allowed when *either*
    route can take it, and this asserts the new half.
    """
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "toss")
    monkeypatch.setattr(s, "toss_env", "test")
    monkeypatch.setattr(type(s), "foreign_billing_enabled", property(lambda _: True))
    monkeypatch.setattr(s, "toss_normal_client_key", s.toss_normal_client_key or "test_ck_stub")
    monkeypatch.setattr(s, "toss_normal_secret_key", s.toss_normal_secret_key or "test_sk_stub")
    stub()
    from tests.v22_helpers import register_student

    headers = register_student(client)["h"]  # V29: plan-less — student29@ already holds a plan
    r = client.post("/api/v1/me/orders", json={"product_code": "ALL_IN_ONE"}, headers=headers)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body["currency"] == "USD", "the order must be in the currency the plan is priced in"
    assert body["status"] == "PENDING", "an order is not paid by being created"
    assert body["card_form"] is True, "the student must be offered the route that can take the money"

def test_usd_is_refused_when_the_contract_does_not_exist(client, toss_only, stub):
    """The state of the world today: a USD price, a KRW MID, and no order created.

    The failure this guards against is not an error — it is the *absence* of one. A server that silently
    created a won order at today's rate would look like it worked.
    """
    s = stub()
    headers = _login(client, "student28@demo.hangyul.kr")
    before = client.get("/api/v1/me/services", headers=headers).json()
    r = client.post("/api/v1/me/orders", json={"product_code": "ALL_IN_ONE"}, headers=headers)
    assert r.status_code == 503, r.text
    detail = r.json()["detail"]
    assert detail["code"] == "CURRENCY_NOT_CONTRACTED"
    assert detail["currency"] == "USD"
    assert "KRW" not in str(detail), "the refusal must not offer a fallback currency"
    assert s.confirms == [], "the provider must not be contacted for a currency it cannot take"
    # Nothing was created, and nothing is left pending — stated as a *change*, because the session database
    # is shared and another file's persona work is not this test's business.
    svc = client.get("/api/v1/me/services", headers=headers).json()
    assert svc["owned"] == before["owned"], "a refused checkout changed what the student owns"
    assert svc["payment"]["pending_order_id"] == before["payment"]["pending_order_id"], \
        "a refused checkout left a PENDING order behind"


def test_usd_opens_once_the_contracts_exist(client, usd_contracted, stub):
    stub()
    headers = _login(client, "student36@demo.hangyul.kr")
    r = client.post("/api/v1/me/orders", json={"product_code": "BASIC"}, headers=headers)
    assert r.status_code == 201, r.text
    co = r.json()["checkout"]
    assert co["amount"] == {"value": 17_900, "currency": "USD"}
    # Overseas cards only — the brief forbids rendering a method the merchant is not contracted for.
    assert co["card"]["useInternationalCardOnly"] is True
    assert co["methods"] == ["CARD"]
    assert "language" in co


def test_the_checkout_never_offers_a_korean_only_method(client, usd_contracted, stub):
    stub()
    headers = _login(client, "student39@demo.hangyul.kr")
    co = client.post("/api/v1/me/orders", json={"product_code": "BASIC"}, headers=headers).json()["checkout"]
    # Look at what is *offered*, not at the whole payload: the SDK's own URL is js.**tosspayments**.com and
    # a naive substring match over the object reports "TOSSPAY is exposed" because of it.
    offered = str({k: v for k, v in co.items() if k in ("methods", "card", "easyPay")}).upper()
    for method in ("TOSSPAY", "NAVERPAY", "KAKAOPAY", "PAYCO", "TRANSFER", "VIRTUAL_ACCOUNT", "EASYPAY"):
        assert method not in offered, f"{method} is offered to the browser"
    assert co["methods"] == ["CARD"]


def test_readiness_is_reported_by_name(client, student):
    cfg = client.get("/api/v1/me/payments/config", headers=student).json()
    assert cfg["currency"] == "USD"
    assert cfg["methods_offered"] == ["OVERSEAS_CARD"]
    assert set(cfg["usd_readiness"]) == {"foreign_card_contract", "card_review", "usd_multicurrency", "live_keys"}
    # No key of any kind reaches the browser from a config listing.
    assert "_sk_" not in str(cfg) and "_ck_" not in str(cfg)


# --------------------------------------------------------------------------------------- refunds

def _paid_usd_order(client, usd_contracted, stub, email):
    """Buy a plan for real through the state machine, so the refund has something true to act on.

    V29: a fresh plan-less student (``email`` is kept for readability) — a seeded persona already holds a plan.
    """
    from tests.v22_helpers import register_student

    headers = register_student(client)["h"]
    s = stub(approval=_approval(17_900, "tviva_refundable"))
    order = client.post("/api/v1/me/orders", json={"product_code": "BASIC"}, headers=headers).json()
    r = client.post("/api/v1/me/payments/toss/confirm", headers=headers,
                    json={"payment_key": "tviva_refundable", "order_id": order["order_id"], "amount": 17_900})
    assert r.status_code == 200, r.text
    return headers, order["order_id"], s


def test_a_full_refund_closes_the_order_and_switches_the_plan_off(client, usd_contracted, stub, db):
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student46@demo.hangyul.kr")
    s = stub(cancel=_approval(17_900, "tviva_cancelled", status="CANCELLED"))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers,
                    json={"amount_minor": 17_900, "reason": "test: full refund"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["fully_refunded"] is True
    assert body["status"] == "REFUNDED"
    assert s.cancels and s.cancels[0]["amount_minor"] == 17_900
    row = db.get(Order, uuid.UUID(order_id))
    db.refresh(row)
    assert row.status == OrderStatus.REFUNDED and row.refunded_at is not None
    pay = db.scalar(select(Payment).where(Payment.order_id == row.id).order_by(Payment.created_at.desc()))
    assert pay.refunded_amount_minor == 17_900 and pay.refund_ref


def test_a_partial_refund_leaves_the_plan_active(client, usd_contracted, stub, db):
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student48@demo.hangyul.kr")
    stub(cancel=_approval(5_000, "tviva_partial", status="PAID"))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers,
                    json={"amount_minor": 5_000, "reason": "test: partial"})
    assert r.status_code == 200, r.text
    assert r.json()["fully_refunded"] is False
    row = db.get(Order, uuid.UUID(order_id))
    db.refresh(row)
    # Still a purchase: the student keeps the service they are still paying for.
    assert row.status == OrderStatus.PAID
    assert row.refund_amount_minor == 5_000


def test_a_refund_cannot_exceed_what_is_left(client, usd_contracted, stub):
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student50@demo.hangyul.kr")
    s = stub(cancel=_approval(17_900))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers,
                    json={"amount_minor": 90_000, "reason": "test: too much"})
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "AMOUNT_EXCEEDS_REMAINING"
    assert s.cancels == [], "the provider must not be asked for a refund the order cannot support"


def test_the_server_never_invents_a_refund_amount(client, usd_contracted, stub):
    """No default, no pro-rata. Hangyul has no approved refund policy and a request handler is the worst
    possible place to invent one (REPORT §152)."""
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student54@demo.hangyul.kr")
    stub(cancel=_approval(1))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers, json={"reason": "test: no amount"})
    assert r.status_code == 422, "an omitted amount must be a validation failure, not a default"


def test_someone_elses_order_cannot_be_refunded(client, usd_contracted, stub, student):
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student55@demo.hangyul.kr")
    s = stub(cancel=_approval(17_900))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=student,
                    json={"amount_minor": 1_000, "reason": "test: not mine"})
    assert r.status_code == 404, "another student's order must be *not found*, not forbidden"
    assert s.cancels == []


def test_two_partial_refunds_get_different_idempotency_keys(client, usd_contracted, stub, db):
    """A retry must be a no-op; a genuine second partial refund must not be swallowed as one.

    An order-derived key would make these indistinguishable, which is why the key carries how much has
    already gone back.
    """
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student56@demo.hangyul.kr")
    s = stub(cancel=_approval(4_000))
    for _ in range(2):
        r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers,
                        json={"amount_minor": 4_000, "reason": "test: partial"})
        assert r.status_code == 200, r.text
    assert len(s.cancels) == 2
    assert s.cancels[0]["idempotency_key"] != s.cancels[1]["idempotency_key"]
    row = db.get(Order, uuid.UUID(order_id))
    db.refresh(row)
    assert row.refund_amount_minor == 8_000


def test_a_provider_refusal_leaves_the_order_paid(client, usd_contracted, stub, db):
    headers, order_id, _ = _paid_usd_order(client, usd_contracted, stub, "student58@demo.hangyul.kr")
    stub(cancel_error=ProviderError("NOT_CANCELABLE_PAYMENT", "이미 취소된 결제입니다."))
    r = client.post(f"/api/v1/me/orders/{order_id}/refund", headers=headers,
                    json={"amount_minor": 1_000, "reason": "test: refused"})
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "NOT_CANCELABLE_PAYMENT"
    row = db.get(Order, uuid.UUID(order_id))
    db.refresh(row)
    assert row.status == OrderStatus.PAID and row.refund_amount_minor is None


# ------------------------------------------------------------------- the allowance, and what it rations

def test_withdrawing_a_draft_is_not_rationed(client, db):
    """A plan rations the work Hangyul takes on. Giving a draft up is the opposite of asking for work.

    `applications.py` has rationed "an application leaving DRAFT" since V15, and `WITHDRAWN` also leaves
    DRAFT — so a student whose plan includes **no** managed applications could not withdraw their own
    draft, and after V17 wired the contextual upgrade sheet, the refusal they met offered them a paid plan
    *in order to delete something*. A boundary that traps someone is not a boundary.

    `student40@` holds Basic (`max_managed_applications: 0`), which is what makes them the right persona:
    every transition out of DRAFT is refused for them except this one.
    """
    headers = _login(client, "student40@demo.hangyul.kr")
    svc = client.get("/api/v1/me/services", headers=headers).json()
    assert svc["owned"] == ["BASIC"], f"this test needs a Basic student, not {svc['owned']}"

    programs = client.get("/api/v1/programs", params={"page": 1, "page_size": 20}, headers=headers).json()
    app = None
    for prog in programs["items"]:
        made = client.post("/api/v1/applications", json={"program_id": prog["id"]}, headers=headers)
        if made.status_code == 201:
            app = made.json()
            break
    assert app, "no program this student has not already applied to"

    # The forward transition is rationed, and says so with its own numbers.
    detail = client.get(f"/api/v1/applications/{app['id']}", headers=headers).json()
    forward = next(s for s in detail["allowed_transitions"] if s not in ("DRAFT", "WITHDRAWN"))
    refused = client.post(f"/api/v1/applications/{app['id']}/transition", json={"to": forward}, headers=headers)
    assert refused.status_code == 409
    assert refused.json()["detail"]["entitlement_key"] == "max_managed_applications"

    # Withdrawal is not.
    gone = client.post(f"/api/v1/applications/{app['id']}/transition", json={"to": "WITHDRAWN"}, headers=headers)
    assert gone.status_code == 200, gone.text
    assert gone.json()["status"] == "WITHDRAWN"


def test_a_draft_withdrawn_from_draft_does_not_spend_a_managed_slot(client, db):
    """The allowance measures work delivered, not applications once opened.

    `max_managed_applications` counted every application that was not DRAFT, and `WITHDRAWN` is not DRAFT —
    so a student who drafted, withdrew and started again had permanently burned a slot on work Hangyul
    never did. Before V17 that path did not exist for them to walk (withdrawal was itself refused), which
    is how it stayed hidden.

    One that was *managed* to a real stage and then withdrawn still counts: the work happened.
    """
    headers = _login(client, "student46@demo.hangyul.kr")
    before = entitlements._used(db, _user_id(db, "student46@demo.hangyul.kr"), "max_managed_applications")

    programs = client.get("/api/v1/programs", params={"page": 1, "page_size": 20}, headers=headers).json()
    app = None
    for prog in programs["items"]:
        made = client.post("/api/v1/applications", json={"program_id": prog["id"]}, headers=headers)
        if made.status_code == 201:
            app = made.json()
            break
    assert app, "no program this student has not already applied to"

    gone = client.post(f"/api/v1/applications/{app['id']}/transition", json={"to": "WITHDRAWN"}, headers=headers)
    assert gone.status_code == 200, gone.text
    db.expire_all()
    after = entitlements._used(db, _user_id(db, "student46@demo.hangyul.kr"), "max_managed_applications")
    assert after == before, f"a never-managed withdrawal spent a slot: {before} → {after}"
