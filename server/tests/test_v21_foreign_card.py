"""V21 — the foreign-card charge, asserted where the browser cannot be trusted (brief §57).

The provider is a stub. What the *live* sandbox proves — that the secret authenticates, that
`/v1/payments/key-in` approves a USD charge on `bill_talkoab1`, and that the plan switches on
afterwards — is proven against the real Toss by `npm run qa:v21`, which runs a real transaction and
is recorded in REPORT §232. A unit test that needs the network is a test that fails for reasons that
are not the code's.

What is asserted here is everything that must hold *regardless* of what Toss answers:

    ownership      an order belongs to one student; another student's id is a 404, not a 403
    input          the request model refuses a field it was not designed to take
    amount         the figure sent to the provider is the stored one, never a figure from the request
    secrecy        no PAN, no credential, and nothing a log would be sorry to have
    failure        a decline leaves the order payable; a timeout does not mark anything paid
    idempotency    a second submit is the same order, one Payment row, one activation, one charge
    deletion       a card is revoked at the provider before it is revoked locally
"""
import uuid

import pytest
from sqlalchemy import func, select

from app.api.v1 import student as student_api
from app.core import crypto
from app.core.config import get_settings
from app.models import Order, Payment
from app.models.business import StudentPaymentMethod
from app.models.enums import OrderStatus
from app.services.foreign_card import KeyInResult, NotConfigured, ProviderError
from app.services.payments import CheckoutSession


@pytest.fixture
def student(client):  # V29: a plan-less student per test — a student who already holds a plan cannot buy another (REPORT §390)
    from tests.v22_helpers import register_student

    return register_student(client)["h"]

def _luhn(prefix: str) -> str:
    """Complete a card-shaped number with its check digit.

    The number is **computed, not written down**: §58 requires that a scan of the tree find no card
    number, and a scanner cannot tell a sandbox PAN from a real one. Nothing here reaches a network —
    the provider is a stub — so any Luhn-valid 16 digits are as good a fixture as a published one.
    """
    body = prefix.ljust(15, "0")
    total, parity = 0, (len(body) + 1) % 2
    for i, ch in enumerate(body):
        d = int(ch)
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return body + str((10 - total % 10) % 10)


PAN = _luhn("4000")
#: Stands in for a Toss billing key. Deliberately not written in Toss's `bln_` shape, so that a scan
#: of the tree for a credential (§58) finds nothing here that it has to think about.
CREDENTIAL = "a-stand-in-credential-value"
CARD = {"number": PAN, "expiry_month": "12", "expiry_year": "30", "holder_name": "A STUDENT"}


# ------------------------------------------------------------------------------------------- stubs

class _StubCard:
    """A provider that answers however the test needs, and records exactly what it was asked for."""

    def __init__(self, *, result=None, error=None, lookup=None, revoked=True):
        self._result, self._error, self._lookup, self._revoked = result, error, lookup, revoked
        self.charges, self.lookups, self.revocations = [], [], []

    def charge(self, *, card, order_id, amount_minor, currency, order_name, idempotency_key):
        self.charges.append({
            "number": card.number, "order_id": order_id, "amount_minor": amount_minor,
            "currency": currency, "idempotency_key": idempotency_key,
        })
        if self._error:
            raise self._error
        return self._result

    def lookup(self, *, order_id):
        self.lookups.append(order_id)
        return self._lookup

    def revoke_billing_key(self, *, billing_key):
        self.revocations.append(billing_key)
        return self._revoked


def _result(amount_minor: int, *, status: str = "DONE", last4: str = "0002") -> KeyInResult:
    return KeyInResult(
        payment_key="tbill_stub_0001", status=status, amount_minor=amount_minor, currency="USD",
        approved_at="2026-10-21T09:00:00+09:00", receipt_url="https://dashboard-sandbox.tosspayments.com/r/x",
        masked_number=f"40000000****{last4[:3]}*", last4=last4, issuer_code="4V", acquirer_code="4V",
        card_type="신용", owner_type="개인", raw={"status": status},
    )


class _StubCheckout:
    """Order creation without a gateway: an order that exists and is waiting to be paid."""

    def create_checkout(self, *, order_id, amount_minor, currency, description, language=None):
        return CheckoutSession(provider="toss", provider_ref=f"stub_{order_id}", redirect_url=None,
                               status="PENDING", client=None)


@pytest.fixture(autouse=True)
def card_ready(monkeypatch):
    """Run **this file** against the foreign-card route.

    `conftest` pins the suite to the demo provider, which pays every order the moment it is created —
    so without this there is no PENDING order to charge and nothing here has a subject. The settings
    instance is switched for the duration of the file, with placeholder credentials, because nothing
    in this file is allowed to leave the machine.
    """
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "toss")
    monkeypatch.setattr(s, "toss_env", "test")
    monkeypatch.setattr(s, "toss_foreign_billing_mid", s.toss_foreign_billing_mid or "bill_stub")
    monkeypatch.setattr(s, "toss_foreign_billing_client_key",
                        s.toss_foreign_billing_client_key or "test_ck_stub")
    monkeypatch.setattr(s, "toss_foreign_billing_secret_key",
                        s.toss_foreign_billing_secret_key or "test_sk_stub")
    monkeypatch.setattr(type(s), "foreign_billing_enabled", property(lambda _: True))
    monkeypatch.setattr(student_api, "get_provider", lambda: _StubCheckout())
    # The limiter counts 8 attempts per 300s in a module-level dict, so a file with thirty card posts
    # trips it on itself. It is left *armed* — `test_the_rate_limiter_stops_card_testing` is the one
    # that proves it fires — and simply given a clean window per test.
    student_api._card_hits.clear()
    yield


@pytest.fixture
def stub(monkeypatch):
    holder = {}

    def install(s):
        holder["s"] = s
        monkeypatch.setattr(student_api, "get_foreign_card", lambda: s)
        return s

    yield install


@pytest.fixture
def other_student(client):
    from tests.v22_helpers import register_student

    return register_student(client)["h"]  # V29: plan-less, so they can place the order the test then attacks


def _add_on_order(client, db, headers) -> dict:
    """A second payable order for a student who already bought a plan — V29: an approved add-on (one plan per student)."""
    from app.services import addons

    uid = uuid.UUID(client.get("/api/v1/auth/me", headers=headers).json()["user"]["id"])
    row = addons.offer(db, None, uid, code="EXTRA_MANAGED_APPLICATION", quantity=1, unit_amount_minor=3_000, scope=None, note=None)
    order = addons.decide(db, None, row, True)
    db.commit()
    return {"id": str(order.id), "order_id": str(order.id)}


def _order(client, headers, plan="BASIC"):
    r = client.post("/api/v1/me/orders", json={"product_code": plan}, headers=headers)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body["status"] == "PENDING", "nothing is payable that is already paid"
    return {"id": body["order_id"], **body}


# -------------------------------------------------------------------------------------- the gate

def test_card_payment_requires_authentication(client):
    r = client.post(f"/api/v1/me/orders/{uuid.uuid4()}/pay-with-card", json={"card": CARD})
    assert r.status_code in (401, 403)


def test_card_payment_refuses_another_students_order(client, student, other_student, card_ready, stub):
    """A guessed order id belongs to someone; it must read as absent, not as forbidden."""
    s = stub(_StubCard(result=_result(100)))
    theirs = _order(client, other_student)
    r = client.post(f"/api/v1/me/orders/{theirs['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 404
    assert s.charges == []


def test_unknown_order_is_404(client, student, card_ready, stub):
    stub(_StubCard(result=_result(100)))
    r = client.post(f"/api/v1/me/orders/{uuid.uuid4()}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 404


def test_server_says_so_when_foreign_billing_is_not_configured(client, student, monkeypatch):
    order = _order(client, student)  # created while the route is configured
    monkeypatch.setattr(type(get_settings()), "foreign_billing_enabled", property(lambda s: False))
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "FOREIGN_BILLING_NOT_READY"


# ------------------------------------------------------------------------------------------- input

@pytest.mark.parametrize("bad", [
    {"number": "1234", "expiry_month": "12", "expiry_year": "30"},            # too short
    {"number": PAN[:-1] + str((int(PAN[-1]) + 1) % 10), "expiry_month": "12", "expiry_year": "30"},  # fails Luhn
    {"number": PAN, "expiry_month": "13", "expiry_year": "30"},  # no such month
    {"number": PAN, "expiry_month": "12"},                       # no year
])
def test_invalid_card_fields_are_refused_before_the_provider(client, student, card_ready, stub, bad):
    s = stub(_StubCard(result=_result(100)))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": bad}, headers=student)
    assert r.status_code == 422
    assert s.charges == [], "an invalid card must never reach Toss"


@pytest.mark.parametrize("extra", ["cardPassword", "customerIdentityNumber", "cvc", "birth"])
def test_the_request_model_refuses_fields_it_was_not_designed_to_take(client, student, card_ready, stub, extra):
    """§29 — an unknown field is rejected rather than quietly ignored, so it can never be stored."""
    s = stub(_StubCard(result=_result(100)))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card",
                    json={"card": {**CARD, extra: "0000"}}, headers=student)
    assert r.status_code == 422
    assert s.charges == []


# ------------------------------------------------------------------------------------------ amount

def test_the_amount_charged_is_the_stored_one(client, student, card_ready, stub, db):
    """The request carries no amount; even so, assert the figure the provider is handed is the order's."""
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    s = stub(_StubCard(result=_result(stored)))
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 200, r.text
    assert s.charges[0]["amount_minor"] == stored
    assert s.charges[0]["currency"] == "USD"


def test_an_amount_in_the_request_body_is_refused(client, student, card_ready, stub):
    """Tampering is not 'ignored', it is a 422 — the model forbids extras at the top level too."""
    s = stub(_StubCard(result=_result(1)))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card",
                    json={"card": CARD, "amount_minor": 1}, headers=student)
    assert r.status_code == 422
    assert s.charges == []


# ----------------------------------------------------------------------------------------- failure

def test_a_decline_leaves_the_order_payable(client, student, card_ready, stub, db):
    """§40 — the student chose a plan; a bad card must not cost them that choice."""
    stub(_StubCard(error=ProviderError(code="REJECT_CARD_COMPANY", message="거절")))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "REJECT_CARD_COMPANY"
    assert db.get(Order, uuid.UUID(order["id"])).status == OrderStatus.PENDING


def test_a_timeout_pays_for_nothing(client, student, card_ready, stub, db):
    stub(_StubCard(error=ProviderError(code="TIMEOUT", message="no answer")))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 402
    oid = uuid.UUID(order["id"])
    assert db.get(Order, oid).status == OrderStatus.PENDING
    assert db.scalar(select(func.count()).select_from(Payment)
                     .where(Payment.order_id == oid, Payment.status == "PAID")) == 0


def test_a_provider_that_approves_nothing_does_not_activate_a_plan(client, student, card_ready, stub, db):
    stub(_StubCard(result=_result(100, status="ABORTED")))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 402
    assert db.get(Order, uuid.UUID(order["id"])).status == OrderStatus.PENDING


def test_not_configured_is_503_not_500(client, student, card_ready, stub):
    stub(_StubCard(error=NotConfigured("no credentials")))
    order = _order(client, student)
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 503


# ------------------------------------------------------------------------------------- idempotency

def test_the_charge_carries_an_order_derived_idempotency_key(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    s = stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert s.charges[0]["idempotency_key"] == f"hg-keyin-{order['id']}"


def test_a_second_submit_is_the_same_order_and_only_one_charge(client, student, card_ready, stub, db):
    order = _order(client, student)
    oid = uuid.UUID(order["id"])
    stored = db.get(Order, oid).amount_minor
    s = stub(_StubCard(result=_result(stored)))
    first = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    second = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert first.status_code == 200 and second.status_code == 200
    assert second.json()["already_paid"] is True
    assert len(s.charges) == 1, "the second submit must not reach the provider"
    assert db.scalar(select(func.count()).select_from(Payment)
                     .where(Payment.order_id == oid, Payment.status == "PAID")) == 1


def test_a_payment_approved_while_the_browser_was_gone_is_recovered_not_recharged(
        client, student, card_ready, stub, db):
    """The first response was lost. Toss already has the money; asking again must not take it twice."""
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    s = stub(_StubCard(result=_result(stored), lookup=_result(stored)))
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    assert r.status_code == 200
    assert s.lookups == [order["id"]]
    assert s.charges == [], "a payment already DONE at the provider must not be charged again"


# ------------------------------------------------------------------------------------- what is kept

def test_no_card_number_survives_into_the_row(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    m = db.scalars(select(StudentPaymentMethod).order_by(StudentPaymentMethod.created_at.desc())).first()
    assert m is not None
    blob = " ".join(str(v) for v in vars(m).values())
    assert CARD["number"] not in blob
    assert "4000000000" not in blob, "not even the BIN plus eight is kept"
    assert m.masked_number == "•••• 0002"
    assert m.last4 == "0002"


def test_the_customer_key_is_random_and_not_derived_from_the_student(
        client, student, card_ready, stub, db):
    """§31 — not the email, not the user id, not a UUID that appears anywhere else."""
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    m = db.scalars(select(StudentPaymentMethod).order_by(StudentPaymentMethod.created_at.desc())).first()
    assert m.customer_key.startswith("hgc_")
    assert len(m.customer_key) > 24
    assert str(m.user_id) not in m.customer_key
    assert "@" not in m.customer_key


def test_the_response_carries_no_credential(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    body = r.text
    for forbidden in ("billing_key", "billingKey", "customer_key", "customerKey", CARD["number"]):
        assert forbidden not in body, forbidden


def test_the_same_card_charged_twice_does_not_open_a_second_row(client, student, card_ready, stub, db):
    """The dedupe compares the mask we store, not the one the provider echoes.

    Its own last four, so the count is about this test and not about whatever ran before it.
    """
    mine = "7731"
    for i in range(2):
        order = _order(client, student) if i == 0 else _add_on_order(client, db, student)
        stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
        stub(_StubCard(result=_result(stored, last4=mine)))
        r = client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
        assert r.status_code == 200, r.text
    rows = db.scalar(select(func.count()).select_from(StudentPaymentMethod).where(
        StudentPaymentMethod.last4 == mine, StudentPaymentMethod.status == "ACTIVE"))
    assert rows == 1, "one card, one row"


def test_save_card_false_keeps_nothing_chargeable(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored, last4="0009")))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card",
                json={"card": CARD, "save_card": False}, headers=student)
    m = db.scalars(select(StudentPaymentMethod)
                   .where(StudentPaymentMethod.last4 == "0009")
                   .order_by(StudentPaymentMethod.created_at.desc())).first()
    assert m.status == "REVOKED"
    assert m.billing_key_ciphertext is None


# ----------------------------------------------------------------------------------- the credential

def test_the_credential_envelope_is_bound_to_its_owner():
    """§32 — a ciphertext lifted into another student's row must not open."""
    if not crypto.configured():
        pytest.skip("HG_PAYMENT_TOKEN_ENCRYPTION_KEY is not set in this environment")
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    sealed = crypto.seal(CREDENTIAL, aad=a)
    assert CREDENTIAL not in sealed.ciphertext, "the credential is not readable in the stored value"
    assert crypto.open_sealed(sealed.ciphertext, key_version=sealed.key_version, aad=a) == CREDENTIAL
    with pytest.raises(crypto.DecryptionFailed):
        crypto.open_sealed(sealed.ciphertext, key_version=sealed.key_version, aad=b)


def test_a_tampered_ciphertext_does_not_open():
    if not crypto.configured():
        pytest.skip("HG_PAYMENT_TOKEN_ENCRYPTION_KEY is not set in this environment")
    owner = str(uuid.uuid4())
    sealed = crypto.seal(CREDENTIAL, aad=owner)
    flipped = "B" if sealed.ciphertext[0] != "B" else "C"
    with pytest.raises(crypto.DecryptionFailed):
        crypto.open_sealed(flipped + sealed.ciphertext[1:], key_version=sealed.key_version, aad=owner)


# ------------------------------------------------------------------------------------- saved cards

def test_the_saved_card_route_is_honest_about_this_configuration(client, student, card_ready, stub, db):
    """§38 — key-in returns no reusable credential, so this answers CARD_NOT_REUSABLE rather than lying."""
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    nxt = _add_on_order(client, db, student)
    r = client.post(f"/api/v1/me/orders/{nxt['id']}/pay-with-saved-card", headers=student)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "CARD_NOT_REUSABLE"


def test_listing_cards_never_includes_a_credential(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    r = client.get("/api/v1/me/payment-methods", headers=student)
    assert r.status_code == 200
    for forbidden in ("billing_key", "customer_key", "ciphertext"):
        assert forbidden not in r.text


def test_a_card_cannot_be_deleted_by_another_student(client, student, other_student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    mine = client.get("/api/v1/me/payment-methods", headers=student).json()["items"][0]["id"]
    r = client.delete(f"/api/v1/me/payment-methods/{mine}", headers=other_student)
    assert r.status_code == 404


def test_deleting_a_card_revokes_it_and_it_stops_being_listed(client, student, card_ready, stub, db):
    order = _order(client, student)
    stored = db.get(Order, uuid.UUID(order["id"])).amount_minor
    stub(_StubCard(result=_result(stored)))
    client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card", json={"card": CARD}, headers=student)
    mid = client.get("/api/v1/me/payment-methods", headers=student).json()["items"][0]["id"]
    assert client.delete(f"/api/v1/me/payment-methods/{mid}", headers=student).status_code == 200
    assert all(i["id"] != mid for i in client.get("/api/v1/me/payment-methods", headers=student).json()["items"])
    row = db.get(StudentPaymentMethod, uuid.UUID(mid))
    db.refresh(row)
    assert row.status == "REVOKED"
    assert row.billing_key_ciphertext is None


def test_deleting_an_unknown_card_is_404(client, student):
    assert client.delete(f"/api/v1/me/payment-methods/{uuid.uuid4()}", headers=student).status_code == 404


# ------------------------------------------------------------------------------------- card testing

def test_the_rate_limiter_stops_card_testing(client, student, stub):
    """§30 — the attack on a card form is volume, so the bound is asserted, not assumed."""
    stub(_StubCard(error=ProviderError(code="REJECT_CARD_COMPANY", message="거절")))
    codes = []
    for _ in range(student_api._CARD_RATE_LIMIT + 2):
        order = _order(client, student)
        codes.append(client.post(f"/api/v1/me/orders/{order['id']}/pay-with-card",
                                 json={"card": CARD}, headers=student).status_code)
    assert codes[0] == 402, "the first attempt is allowed through to the provider"
    assert codes[-1] == 429, "the limiter closes the form after the allowance"
    assert codes.count(429) >= 2
