"""V17 — USD pricing, and what a plan's allowance rations.

* **USD is the commercial model.** The manifest, the seed and the API agree on $179 / $349 / $599 in cents.
* **The allowance measures work delivered**, not applications once opened.

The currency gate, the charge and the refund path moved to the billing-key rail and are asserted in
`tests/test_v33_billing.py`.
"""
import pytest
from sqlalchemy import select

from app.models import ServiceProduct
from app.services import entitlements


@pytest.fixture
def student(client):  # V29: a plan-less student per test — a student who already holds a plan cannot buy another (REPORT §390)
    from tests.v22_helpers import register_student

    return register_student(client)["h"]


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
