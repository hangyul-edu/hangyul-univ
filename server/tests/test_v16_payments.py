"""V16 — the one-time Toss payment, asserted at the boundary the browser cannot be trusted across.

The browser supplies `paymentKey`, `orderId` and `amount` on a URL anyone can type, so every test here is a
statement about what the **server** does with those three values before it lets anything be paid:

    ownership      an order id is a UUID; a guessed one must not pay for, or read back, someone else's plan
    state          a PENDING order is payable once; a PAID one answers with itself; anything else is 409
    amount         the figure from the URL is compared with the figure stored before the window opened,
                   and the figure *sent to Toss* is always the stored one
    idempotency    two confirmations, a refresh, a second tab → one Payment row, one activation, one charge
    recovery       a payment approved at the provider while the browser was gone is found on the next load
    no card data   nothing sensitive survives into the row we keep

The provider is replaced with a stub (`_stub_toss`) rather than called. A test that needs the network to
pass is a test that fails for reasons that are not the code's; what the live credentials actually prove —
that the secret authenticates and that `/v1/payments/confirm` answers — is verified by `npm run qa:v16`
and recorded in REPORT §142.
"""
import uuid

import pytest
from sqlalchemy import select

from app.api.v1 import student as student_api
from app.core.config import get_settings
from app.models import Order, Payment, ServiceProduct
from app.models.enums import OrderStatus
from app.services.payments import Approval, ProviderError

# ------------------------------------------------------------------------------------------- helpers

class _StubToss:
    """A Toss that answers however the test needs, and records what it was asked."""

    def __init__(self, approval=None, error=None, lookup=None):
        self._approval = approval
        self._error = error
        self._lookup = lookup
        self.confirms = []
        self.lookups = []

    def confirm(self, *, payment_key, order_id, amount_minor):
        self.confirms.append({"payment_key": payment_key, "order_id": order_id, "amount_minor": amount_minor})
        if self._error:
            raise self._error
        return self._approval

    def lookup(self, *, order_id):
        self.lookups.append(order_id)
        return self._lookup



@pytest.fixture
def student(client):  # V29: a plan-less student per test — a student who already holds a plan cannot buy another (REPORT §390)
    from tests.v22_helpers import register_student

    return register_student(client)["h"]

def _approval(amount: int, payment_key: str = "tviva20260101_abc", status: str = "PAID") -> Approval:
    return Approval(
        status=status, provider_ref=payment_key, amount_minor=amount, method="카드",
        approved_at="2026-10-19T18:00:00+09:00", receipt_url="https://dashboard.tosspayments.com/receipt/x",
        raw={"paymentKey": payment_key, "status": "DONE", "method": "카드", "totalAmount": amount},
    )


@pytest.fixture(autouse=True)
def toss_provider(monkeypatch):
    """Run **this file** against the Toss provider.

    `conftest` pins the suite to the demo provider so no other test reaches a gateway. These tests are about
    the Toss path specifically, so they switch the cached settings over for their own duration — and give
    the adapter placeholder keys, because nothing here is allowed to leave the machine either.
    """
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "toss")
    monkeypatch.setattr(s, "toss_normal_client_key", s.toss_normal_client_key or "test_ck_stub")
    monkeypatch.setattr(s, "toss_normal_secret_key", s.toss_normal_secret_key or "test_sk_stub")
    monkeypatch.setattr(s, "toss_normal_mid", s.toss_normal_mid or "HANGYUL")
    # V17 priced the plans in USD, and the contract gate refuses a currency the merchant does not hold
    # (REPORT §155.8). That refusal is the subject of `test_v17_usd_refunds.py`; the subject *here* is what
    # the server does with the browser's three values once an order exists, so these tests declare the
    # contract present and go on asserting the state machine. The flags are false everywhere else.
    monkeypatch.setattr(s, "toss_env", "live")
    for flag in ("toss_foreign_card_contract_ready", "toss_card_review_ready",
                 "toss_usd_multicurrency_ready", "toss_live_keys_ready"):
        monkeypatch.setattr(s, flag, True)
    yield


@pytest.fixture
def stub(monkeypatch):
    """Install a stub Toss for the duration of one test, and hand it back so the test can inspect it."""

    def install(**kw):
        s = _StubToss(**kw)
        # Both the confirm endpoint and the recovery sweep resolve the provider through this name.
        monkeypatch.setattr(student_api, "get_toss", lambda: s)
        return s

    return install


def _new_order(client, headers, code="ALL_IN_ONE"):
    r = client.post("/api/v1/me/orders", json={"product_code": code}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _amount(o: dict) -> int:
    """The order's *own* amount, as the server stored it.

    A hardcoded figure here would be a test of the price list rather than of the state machine, and V17
    repricing the plans in USD cents is exactly how that goes wrong — every confirmation below suddenly
    looked like a forged amount.
    """
    return o["checkout"]["amount"]["value"]


@pytest.fixture
def buyer(client):
    """A student with nothing bought, signed in — freshly registered per test (V29: one plan per student)."""
    from tests.v22_helpers import register_student

    return register_student(client)["h"]


# --------------------------------------------------------------------------------- what an order is

def test_an_order_is_priced_by_the_server_and_carries_only_public_payment_values(client, buyer, db):
    body = _new_order(client, buyer)
    assert body["status"] == "PENDING", "nothing may be paid before the provider approves"
    co = body["checkout"]
    # The amount is the manifest's, not anything the caller sent.
    prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == "ALL_IN_ONE"))
    price = next(p for p in prod.prices if p.country_code is None)
    assert co["amount"] == {"value": price.amount_minor, "currency": price.currency}
    # Public values only. A secret key or a billing MID reaching a browser is the failure this guards.
    text = str(body)
    assert "test_sk_" not in text and "live_sk_" not in text
    assert "bill_" not in text
    assert co["client_key"].startswith(("test_ck_", "live_ck_"))
    # Toss's own orderId rule: 6–64 chars of [A-Za-z0-9-_=]. A UUID satisfies it by construction.
    assert 6 <= len(co["order_id"]) <= 64
    assert all(c.isalnum() or c in "-_=" for c in co["order_id"])
    assert co["success_url"].endswith("/services/payment/success")
    assert co["fail_url"].endswith("/services/payment/fail")


# ------------------------------------------------------------------------- what confirmation refuses

def test_confirming_someone_elses_order_is_a_404_not_a_403(client, buyer, student, stub):
    """A 403 would confirm the order exists. Another student's order simply is not found."""
    s = stub(approval=_approval(499_000))
    mine = _new_order(client, buyer)
    r = client.post("/api/v1/me/payments/toss/confirm", headers=student,
                    json={"payment_key": "pk_test", "order_id": mine["order_id"], "amount": 499_000})
    assert r.status_code == 404
    assert s.confirms == [], "the provider must not be called for an order that is not the caller's"


def test_a_forged_amount_is_refused_before_the_provider_is_called(client, buyer, stub):
    s = stub(approval=_approval(1_000))
    o = _new_order(client, buyer)
    r = client.post("/api/v1/me/payments/toss/confirm", headers=buyer,
                    json={"payment_key": "pk_test", "order_id": o["order_id"], "amount": 1_000})
    assert r.status_code == 409
    assert s.confirms == []
    mine = {x["id"]: x for x in client.get("/api/v1/me/orders", headers=buyer).json()}
    assert mine[o["order_id"]]["status"] == "PENDING", "a refused amount must leave the order untouched"


def test_the_amount_sent_to_the_provider_is_the_stored_one(client, buyer, stub):
    """Even when the URL's amount is right, the number that leaves this server comes from the order row."""
    o = _new_order(client, buyer)
    s = stub(approval=_approval(_amount(o)))
    r = client.post("/api/v1/me/payments/toss/confirm", headers=buyer,
                    json={"payment_key": "pk_ok", "order_id": o["order_id"], "amount": _amount(o)})
    assert r.status_code == 200, r.text
    assert s.confirms[0]["amount_minor"] == _amount(o)
    assert s.confirms[0]["order_id"] == o["order_id"]


def test_an_unknown_order_is_a_404(client, buyer, stub):
    stub(approval=_approval(499_000))
    r = client.post("/api/v1/me/payments/toss/confirm", headers=buyer,
                    json={"payment_key": "pk_test", "order_id": str(uuid.uuid4()), "amount": 499_000})
    assert r.status_code == 404


def test_a_provider_refusal_fails_the_order_and_names_the_code(client, buyer, stub):
    stub(error=ProviderError("REJECT_CARD_COMPANY", "카드사에서 승인을 거절했습니다."))
    o = _new_order(client, buyer)
    r = client.post("/api/v1/me/payments/toss/confirm", headers=buyer,
                    json={"payment_key": "pk_test", "order_id": o["order_id"], "amount": _amount(o)})
    assert r.status_code == 402
    # The code is what the UI maps to a human sentence; the raw message is only the fallback.
    assert r.json()["detail"]["code"] == "REJECT_CARD_COMPANY"
    # The order itself is the thing that must not survive as payable. (`owned` is no use here: the session
    # database is shared, so by this point the buyer may legitimately own a plan from an earlier test.)
    mine = {x["id"]: x for x in client.get("/api/v1/me/orders", headers=buyer).json()}
    assert mine[o["order_id"]]["status"] == "FAILED"


# ----------------------------------------------------------------------------- what it does once only

def test_confirming_twice_charges_once_and_activates_once(client, buyer, db, stub):
    """The refresh, the back button and the second tab all land here. Only the first may do anything."""
    o = _new_order(client, buyer)
    s = stub(approval=_approval(_amount(o), "tviva_idem"))
    body = {"payment_key": "tviva_idem", "order_id": o["order_id"], "amount": _amount(o)}
    first = client.post("/api/v1/me/payments/toss/confirm", headers=buyer, json=body)
    second = client.post("/api/v1/me/payments/toss/confirm", headers=buyer, json=body)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["status"] == second.json()["status"] == "PAID"
    assert len(s.confirms) == 1, "the provider was asked to approve the same order twice"
    oid = uuid.UUID(o["order_id"])
    assert len(db.scalars(select(Payment).where(Payment.order_id == oid)).all()) == 1
    paid = db.scalars(select(Order).where(Order.user_id == db.get(Order, oid).user_id,
                                          Order.status == OrderStatus.PAID)).all()
    assert len([x for x in paid if x.id == oid]) == 1
    # And the plan is on, exactly once.
    services = client.get("/api/v1/me/services", headers=buyer).json()
    assert services["owned"] == ["ALL_IN_ONE"]
    assert services["plan"]["code"] == "ALL_IN_ONE"


def test_a_paid_order_cannot_be_cancelled_back_into_being_unpaid(client, buyer, db):
    oid = db.scalar(select(Order.id).where(Order.status == OrderStatus.PAID).order_by(Order.paid_at.desc()))
    r = client.post(f"/api/v1/me/orders/{oid}/cancel", headers=buyer)
    # It is the buyer's own order, so it answers — with the order, still paid.
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        assert r.json()["status"] == "PAID"


def test_nothing_card_shaped_is_stored(client, db):
    """`sanitize()` drops the card object. A masked PAN is still cardholder data."""
    for pay in db.scalars(select(Payment).where(Payment.provider == "toss")).all():
        raw = pay.raw or {}
        assert "card" not in raw and "virtualAccount" not in raw
        assert not any(k.lower() in {"number", "cardnumber", "cvc"} for k in raw)


# -------------------------------------------------------------------------------------- the recovery

def test_a_payment_the_browser_never_came_back_from_is_found_on_the_next_load(client, db, stub, monkeypatch):
    """Brief Part 17: approved at the provider, PENDING here, browser gone. The next `/me/services` fixes it."""
    r = client.post("/api/v1/auth/login",
                    json={"email": "student02@demo.hangyul.kr", "password": "Hangyul!2026", "client": "student"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    before = client.get("/api/v1/me/services", headers=headers).json()
    if before["owned"]:
        pytest.skip("this persona already owns a plan in the seed")
    o = _new_order(client, headers, "BASIC")
    amount = o["checkout"]["amount"]["value"]
    s = stub(lookup=_approval(amount, "tviva_recovered"))
    # The provider used for the sweep is resolved the same way; point it at the stub too.
    monkeypatch.setattr(student_api, "get_toss", lambda: s)
    after = client.get("/api/v1/me/services", headers=headers).json()
    assert s.lookups == [o["order_id"]], "the pending order was not reconciled with the provider"
    assert after["owned"] == ["BASIC"], "an approved payment did not activate on the next load"
    assert after["payment"]["pending_order_id"] is None


def test_the_sweep_refuses_an_amount_the_provider_disagrees_about(client, db, stub, monkeypatch):
    """A provider total that is not the one we priced is a reconciliation problem for a person."""
    r = client.post("/api/v1/auth/login",
                    json={"email": "student03@demo.hangyul.kr", "password": "Hangyul!2026", "client": "student"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    if client.get("/api/v1/me/services", headers=headers).json()["owned"]:
        pytest.skip("this persona already owns a plan in the seed")
    o = _new_order(client, headers, "PREMIUM")
    s = stub(lookup=_approval(1, "tviva_wrong_total"))
    monkeypatch.setattr(student_api, "get_toss", lambda: s)
    after = client.get("/api/v1/me/services", headers=headers).json()
    assert after["owned"] == [], "a mismatched provider total activated a plan"
    assert after["payment"]["pending_order_id"] == o["order_id"]


# ------------------------------------------------------------------------- the merchant configuration

def test_exactly_one_merchant_configuration_is_wired_to_plan_purchase(client, buyer):
    """**Rewritten in V21.** Until V21 this asserted the opposite: that the 결제창 MID bought the plan
    and that no `bill_*` configuration ever could. That rule came from V16, when the only `bill_*` MIDs
    on the account were Korean 자동결제 products that had no business taking a plan payment.

    `bill_talkoab1` turned out not to be one of those. It is a foreign-card key-in MID that settles in
    USD, and it is the only configuration on this account that can charge an overseas card at all
    (REPORT §229.3) — so V21 wired it to plan purchase deliberately and the old assertion became a
    statement that the product must not work.

    What is actually worth guarding survives, and is what this now says: **one** configuration buys a
    plan, the listing agrees with itself about which, each MID is still labelled with the product it
    really is, and no key of any kind is served to a browser.
    """
    cfg = client.get("/api/v1/me/payments/config", headers=buyer).json()
    wired = ([cfg["one_time"]] if cfg["one_time"]["used_by_plan_purchase"] else []) \
        + [b for b in cfg["billing"] if b["used_by_plan_purchase"]]
    assert len(wired) == 1, f"plan purchase must have exactly one route, found {len(wired)}"
    assert wired[0]["configured"] is True, "the route that buys a plan must be configured"
    # The labels are still honest about what each MID is.
    assert not cfg["one_time"]["mid"].startswith("bill_")
    assert all(str(b["mid"] or "").startswith("bill_") for b in cfg["billing"] if b["mid"])
    text = str(cfg)
    assert "_sk_" not in text, "a secret key is served to the browser"
    assert "_ck_" not in text, "a client key belongs with an order, not with a config listing"
