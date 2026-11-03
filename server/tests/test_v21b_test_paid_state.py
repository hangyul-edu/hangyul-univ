"""V21 b — the local paid-state activation (`POST /me/orders/dev-complete`, REPORT §243.2).

The feature is QA tooling, so every test here is about a *limit* rather than about a capability:

    guard          production answers 404, and the explicit flag cannot override that
    authentication unauthenticated is 401, like every other `/me` route
    isolation      activating a plan changes the caller's state and nobody else's
    the real model it is a real Order, a real PAID state and the real entitlements — not a flag
    no provider    `get_provider` / `get_toss` are replaced with a tripwire; nothing may call them
    no credential  no billing key, no card, no stored payment method, no provider-shaped reference
    no duplicates  twice on one plan is one PAID order; a lower plan is refused, not sold

The three plan cases the owner asked for (Basic, All-in-One, Premium) and the two upgrade steps between
them are asserted on one fresh account each, because the suite's database is shared for the session and a
test that bought a plan on a seeded persona would change what every other file sees.
"""
import uuid

import pytest
from sqlalchemy import select

from app.api.v1 import student as student_api
from app.core.config import get_settings
from app.models import Order, Payment, ServiceProduct, StudentPaymentMethod
from app.models.enums import OrderStatus
from tests.v22_helpers import register_student

API = "/api/v1"


def _register(client, name="Test Paid State") -> dict:
    reg = register_student(client, email=f"v21b.{uuid.uuid4().hex[:10]}@example.com", password="Hangyul!2026x", full_name=name, nationality="UZ")
    return {"email": reg["email"], "h": reg["h"]}


@pytest.fixture(autouse=True)
def no_provider(monkeypatch):
    """A tripwire where the payment provider would be.

    "It does not call Toss" is the requirement most easily broken by a later refactor that reuses the
    purchase path, so it is asserted structurally: any provider lookup inside this file fails the test.
    """
    def boom(*a, **kw):  # pragma: no cover - the point is that it is never reached
        raise AssertionError("the local paid-state activation must not reach a payment provider")

    monkeypatch.setattr(student_api, "get_provider", boom)
    monkeypatch.setattr(student_api, "get_toss", boom)


def _activate(client, headers, code: str):
    return client.post(f"{API}/me/orders/dev-complete", json={"product_code": code}, headers=headers)


# ------------------------------------------------------------------------------------ the three cases

@pytest.mark.parametrize("code", ["BASIC", "ALL_IN_ONE", "PREMIUM"])
def test_the_selected_plan_becomes_the_students_real_plan(client, db, code):
    me = _register(client)
    assert client.get(f"{API}/me/plan", headers=me["h"]).json() is None

    r = _activate(client, me["h"], code)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "PAID" and body["product_code"] == code
    assert body["already_paid"] is False
    assert body["plan"]["code"] == code
    # The amount is the server's, from the price list — not a number the caller sent or a zero.
    prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == code))
    price = next(p for p in prod.prices if p.country_code is None)
    assert (body["amount_minor"], body["currency"]) == (price.amount_minor, price.currency)

    # The API, not just the response: `/me/plan` and `/me/services` must now agree with it, which is the
    # difference between this and a front-end flag.
    assert client.get(f"{API}/me/plan", headers=me["h"]).json()["code"] == code
    svc = client.get(f"{API}/me/services", headers=me["h"]).json()
    assert svc["plan"]["code"] == code and code in svc["owned"]
    # The entitlements are the plan's own, carried through to the usage rows the product gates on.
    assert svc["plan"]["entitlements"] == (prod.entitlements or {})
    assert {u["key"] for u in svc["plan"]["usage"]}, "the plan must expose its allowances"


def test_it_is_a_real_order_and_not_a_provider_payment(client, db):
    me = _register(client)
    body = _activate(client, me["h"], "ALL_IN_ONE").json()
    order = db.get(Order, uuid.UUID(body["order_id"]))
    db.refresh(order)
    assert order.status == OrderStatus.PAID and order.paid_at is not None
    pay = db.scalar(select(Payment).where(Payment.order_id == order.id))
    # Nothing here may look like a provider transaction, and nothing may name a provider.
    assert pay.provider == "test-bypass"
    assert pay.provider_ref.startswith("testbypass_")
    assert "toss" not in pay.provider.lower() and "toss" not in (pay.provider_ref or "").lower()
    assert pay.raw["simulated_paid_state"] is True and pay.raw["payment_provider_called"] is False
    # No card was registered, so there must be no credential of any kind on the account.
    methods = db.scalars(select(StudentPaymentMethod).where(StudentPaymentMethod.user_id == order.user_id)).all()
    assert methods == []
    assert client.get(f"{API}/me/payment-methods", headers=me["h"]).json()["items"] == []


# ---------------------------------------------------------------------------- upgrades, and duplicates

def test_switching_up_supersedes_the_plan_without_duplicating_it(client):
    """Basic → All-in-One → Premium, which is the path the owner asked to be able to walk locally."""
    me = _register(client)
    for code in ("BASIC", "ALL_IN_ONE", "PREMIUM"):
        r = _activate(client, me["h"], code)
        assert r.status_code == 200, r.text
        assert r.json()["plan"]["code"] == code, "the newly activated plan must be the active one"
    svc = client.get(f"{API}/me/services", headers=me["h"]).json()
    assert svc["plan"]["code"] == "PREMIUM"
    assert sorted(svc["owned"]) == ["ALL_IN_ONE", "BASIC", "PREMIUM"]
    # One PAID order per plan, and exactly three of them: no plan was bought twice.
    paid = [r for r in svc["history"] if r["status"] == "PAID"]
    assert len(paid) == 3 and len({r["product_code"] for r in paid}) == 3


def test_activating_the_same_plan_twice_returns_the_first_order(client, db):
    me = _register(client)
    first = _activate(client, me["h"], "BASIC").json()
    second = _activate(client, me["h"], "BASIC")
    assert second.status_code == 200, second.text
    assert second.json()["already_paid"] is True
    assert second.json()["order_id"] == first["order_id"], "a second click must not create a second order"
    svc = client.get(f"{API}/me/services", headers=me["h"]).json()
    assert len([r for r in svc["history"] if r["status"] == "PAID"]) == 1


def test_a_lower_plan_is_refused_because_the_product_has_no_downgrade(client):
    me = _register(client)
    assert _activate(client, me["h"], "PREMIUM").status_code == 200
    r = _activate(client, me["h"], "BASIC")
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "NOT_AN_UPGRADE"
    assert client.get(f"{API}/me/plan", headers=me["h"]).json()["code"] == "PREMIUM"


def test_an_unknown_plan_is_a_404(client):
    me = _register(client)
    assert _activate(client, me["h"], "ENTERPRISE").status_code == 404


# --------------------------------------------------------------------------------------- the guards

def test_it_requires_authentication(client):
    r = client.post(f"{API}/me/orders/dev-complete", json={"product_code": "BASIC"})
    assert r.status_code == 401


def test_it_only_affects_the_caller(client):
    a, b = _register(client, "Student A"), _register(client, "Student B")
    assert _activate(client, a["h"], "PREMIUM").status_code == 200
    assert client.get(f"{API}/me/plan", headers=b["h"]).json() is None
    svc = client.get(f"{API}/me/services", headers=b["h"]).json()
    assert svc["plan"] is None and svc["owned"] == []


def test_production_answers_404_whatever_the_flag_says(client, monkeypatch):
    """The frontend hiding the button is not a guard. This is."""
    me = _register(client)
    s = get_settings()
    monkeypatch.setattr(s, "env", "production")
    monkeypatch.setattr(s, "test_payment_bypass", True)
    assert s.test_payment_bypass_enabled is False
    r = _activate(client, me["h"], "BASIC")
    assert r.status_code == 404, "a 403 would confirm the route exists"
    assert client.get(f"{API}/me/plan", headers=me["h"]).json() is None


def test_an_opt_in_flag_enables_it_outside_development(client, monkeypatch):
    me = _register(client)
    s = get_settings()
    monkeypatch.setattr(s, "env", "staging")
    monkeypatch.setattr(s, "test_payment_bypass", False)
    assert _activate(client, me["h"], "BASIC").status_code == 404
    monkeypatch.setattr(s, "test_payment_bypass", True)
    assert _activate(client, me["h"], "BASIC").status_code == 200


def test_the_payments_config_says_whether_the_server_will_honour_it(client, monkeypatch):
    me = _register(client)
    cfg = client.get(f"{API}/me/payments/config", headers=me["h"]).json()
    assert cfg["test_payment_bypass"] is True, "development must advertise it so the UI can show the button"
    s = get_settings()
    monkeypatch.setattr(s, "env", "production")
    cfg = client.get(f"{API}/me/payments/config", headers=me["h"]).json()
    assert cfg["test_payment_bypass"] is False
    # Nothing about the real payment configuration changed.
    assert cfg["foreign_card"]["used_by_plan_purchase"] is True and cfg["foreign_card"]["card_form"] == "hangyul"


def test_the_real_payment_path_is_untouched(client, monkeypatch):
    """The purchase route still prices an order through the provider, and still refuses without one.

    The tripwire fixture is what makes this meaningful: `POST /me/orders` reaches the provider lookup, so
    it raises here. A refactor that made the real purchase stop asking a provider would fail this test.
    """
    me = _register(client)
    with pytest.raises(AssertionError, match="must not reach a payment provider"):
        client.post(f"{API}/me/orders", json={"product_code": "BASIC"}, headers=me["h"])
