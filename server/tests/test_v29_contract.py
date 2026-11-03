"""V29 — the owner's service contract, enforced (REPORT §380–§390, brief §57 · §58 · §78).

Each test buys a plan for a fresh student through the real order → engagement path (the non-production paid-state
action, which performs exactly the transition a payment performs) and then asks the API for work the contract does or
does not include.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import AddOnStatus, Application, Order, ServiceAddOn, ServiceCase, ServiceEngagement, ServiceProduct
from app.services import entitlements as ent_svc
from tests.conftest import login
from tests.v22_helpers import register_student

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def ops(client):
    return login(client, "ops@demo.hangyul.kr", "agency")


def _buy(client, code: str) -> dict:
    # Uzbekistan, like test_v21b: twenty paid Vietnamese students here would shift the load-balanced agency assignment
    # that test_v9_adversarial asserts for the next Vietnamese Premium student.
    reg = register_student(client, nationality="UZ")
    uid = client.get(f"{API}/auth/me", headers=reg["h"]).json()["user"]["id"]
    _grant(uid, code)  # the fixture activation: the same transition a payment performs, no provider (V32)
    return {"h": reg["h"], "id": uid}


def _grant(user_id: str, code: str) -> None:
    import uuid

    from app.core.db import SessionLocal
    from app.models import User
    from app.seed.fixtures import grant_plan

    with SessionLocal() as db:
        grant_plan(db, db.get(User, uuid.UUID(user_id)), code)
        db.commit()


def _pay(order_id: str) -> None:
    import uuid

    from app.core.db import SessionLocal
    from app.models import Order
    from app.seed.fixtures import pay_order

    with SessionLocal() as db:
        pay_order(db, db.get(Order, uuid.UUID(order_id)))
        db.commit()


def _draft(client, h) -> dict:
    progs = client.get(f"{API}/programs", params={"page": 1, "page_size": 40}, headers=h).json()["items"]
    for prog in progs:
        made = client.post(f"{API}/applications", json={"program_id": prog["id"]}, headers=h)
        if made.status_code == 201:
            return made.json()
    raise AssertionError("no program to apply to")


def _advance(client, h, app_id):
    detail = client.get(f"{API}/applications/{app_id}", headers=h).json()
    forward = next(s for s in detail["allowed_transitions"] if s not in ("DRAFT", "WITHDRAWN"))
    return client.post(f"{API}/applications/{app_id}/transition", json={"to": forward}, headers=h)


def _essay(client, h, *, kind="PERSONAL_STATEMENT", app_id=None) -> str:
    r = client.post(f"{API}/essays", headers=h, json={"essay_type": kind, "title": f"{kind} {uuid.uuid4().hex[:4]}",
                                                       "body": "My study plan in Korea. " * 40, "application_id": app_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _submit(client, h, essay_id):
    return client.post(f"{API}/essays/{essay_id}/status", headers=h, json={"status": "SUBMITTED", "attest": True})


def _send_back(client, ops, essay_id):
    with SessionLocal() as s:
        from app.models import Essay
        from app.models.enums import EssayStatus

        e = s.get(Essay, uuid.UUID(essay_id))
        e.status = EssayStatus.AGENCY_REVIEW
        s.commit()
    r = client.post(f"{API}/essays/{essay_id}/status", headers=ops, json={"status": "CHANGES_REQUESTED"})
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------------------- the contract itself

def test_manifest_is_the_v29_contract():
    m = ent_svc.manifest()
    assert m["catalog"]["version"] == "2026-10-30.v29"
    p = {x["code"]: x for x in m["plans"]}
    assert [p[c]["amount_minor"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [17_900, 34_900, 59_900]
    e = {c: p[c]["entitlements"] for c in p}
    assert [e[c]["max_recommended_institutions"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [3, 5, 7]
    assert [e[c]["max_managed_applications"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [0, 2, 3]
    assert [e[c]["essay_review_rounds"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [0, 2, None]
    assert e["PREMIUM"]["essay_review_scope"] == "CONTRACTED_DOCUMENTS"
    assert [e[c]["support_window_days"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [1, 3, None]
    assert e["PREMIUM"]["support_window_type"] == "CONTRACT_TERM"
    assert [e[c]["mock_interviews"] for c in ("BASIC", "ALL_IN_ONE", "PREMIUM")] == [0, 0, 1]
    assert (e["PREMIUM"]["pre_arrival_support_days"], e["PREMIUM"]["settlement_days"]) == (30, 30)
    assert e["PREMIUM"]["dedicated_support"] and not e["ALL_IN_ONE"]["dedicated_support"]
    assert all("consultation_minutes" not in x for x in e.values()), "the 30/60/90-minute semantics are gone"


def test_add_on_catalogue_is_ranges_and_quotes_never_a_default_price():
    a = {x["code"]: x for x in ent_svc.manifest()["add_ons"]}
    assert set(a) == {"EXTRA_MANAGED_APPLICATION", "EXTRA_ESSAY_ROUND", "MOCK_INTERVIEW", "DORMITORY_APPLICATION",
                      "AIRPORT_PICKUP", "SETTLEMENT_SUPPORT"}
    ranges = {c: (x["pricing"].get("min_minor"), x["pricing"].get("max_minor")) for c, x in a.items()}
    assert ranges["EXTRA_MANAGED_APPLICATION"] == (3000, 5000)
    assert ranges["EXTRA_ESSAY_ROUND"] == (2000, 3500)
    assert ranges["MOCK_INTERVIEW"] == (5000, 7000)
    assert ranges["DORMITORY_APPLICATION"] == (5000, 8000)
    assert a["AIRPORT_PICKUP"]["pricing"]["kind"] == a["SETTLEMENT_SUPPORT"]["pricing"]["kind"] == "QUOTE"
    assert a["AIRPORT_PICKUP"]["referral"] is True
    assert all("default" not in str(x["pricing"]).lower() for x in a.values())


# ---------------------------------------------------------------------------------------- entitlement boundaries

def test_basic_cannot_have_an_application_managed(client):
    s = _buy(client, "BASIC")
    app = _draft(client, s["h"])
    r = _advance(client, s["h"], app["id"])
    assert r.status_code == 409
    d = r.json()["detail"]
    assert d["entitlement_key"] == "max_managed_applications" and d["limit"] == 0 and d["add_on_code"] == "EXTRA_MANAGED_APPLICATION"


def test_a_student_without_a_plan_gets_no_managed_application(client):
    reg = register_student(client)
    app = _draft(client, reg["h"])
    r = _advance(client, reg["h"], app["id"])
    assert r.status_code == 409 and r.json()["detail"]["reason"] == "NO_PLAN"


@pytest.mark.parametrize("code,included", [("ALL_IN_ONE", 2), ("PREMIUM", 3)])
def test_managed_applications_stop_at_the_contract_and_the_next_one_is_an_add_on(client, ops, code, included):
    s = _buy(client, code)
    for _ in range(included):
        assert _advance(client, s["h"], _draft(client, s["h"])["id"]).status_code == 200
    extra = _draft(client, s["h"])
    r = _advance(client, s["h"], extra["id"])
    assert r.status_code == 409
    assert r.json()["detail"]["add_on_code"] == "EXTRA_MANAGED_APPLICATION"
    # offer → approve → pay → the slot exists
    offer = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops,
                        json={"code": "EXTRA_MANAGED_APPLICATION", "quantity": 1, "unit_amount_minor": 4000})
    assert offer.status_code == 201, offer.text
    assert _advance(client, s["h"], extra["id"]).status_code == 409, "an offer grants nothing"
    dec = client.post(f"{API}/me/add-ons/{offer.json()['id']}", headers=s["h"], json={"approve": True}).json()
    assert dec["status"] == "AWAITING_PAYMENT" and dec["order"]["amount_minor"] == 4000
    assert _advance(client, s["h"], extra["id"]).status_code == 409, "approval without payment grants nothing"
    _pay(dec["order"]["order_id"])
    assert _advance(client, s["h"], extra["id"]).status_code == 200


def test_all_in_one_includes_two_edit_rounds_and_the_third_is_an_add_on(client, ops):
    s = _buy(client, "ALL_IN_ONE")
    eid = _essay(client, s["h"])
    assert _submit(client, s["h"], eid).status_code == 200  # round 1
    _send_back(client, ops, eid)
    assert _submit(client, s["h"], eid).status_code == 200  # round 2 — V28 refused this
    _send_back(client, ops, eid)
    r = _submit(client, s["h"], eid)
    assert r.status_code == 409
    d = r.json()["detail"]
    assert (d["entitlement_key"], d["limit"], d["reason"], d["add_on_code"]) == ("essay_review_rounds", 2, "LIMIT_REACHED", "EXTRA_ESSAY_ROUND")


def test_premium_editing_has_no_round_limit_inside_the_contract(client, ops):
    s = _buy(client, "PREMIUM")
    eid = _essay(client, s["h"], kind="STUDY_PLAN")
    for _ in range(4):  # V28 stopped Premium at 2
        assert _submit(client, s["h"], eid).status_code == 200
        _send_back(client, ops, eid)
    plan = client.get(f"{API}/me/plan", headers=s["h"]).json()
    u = next(x for x in plan["usage"] if x["key"] == "essay_review_rounds")
    assert u["limit"] is None and u["scope"] == "CONTRACTED_DOCUMENTS" and u["used"] == 4


def test_premium_unlimited_never_reaches_a_new_document(client, ops):
    s = _buy(client, "PREMIUM")
    cv = _essay(client, s["h"], kind="CV")
    r = _submit(client, s["h"], cv)
    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "NEW_DOCUMENT" and r.json()["detail"]["add_on_available"] is True
    # Selling an extra round for an in-scope statement would charge for the contract — refused.
    ps = _essay(client, s["h"])
    inc = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops,
                      json={"code": "EXTRA_ESSAY_ROUND", "unit_amount_minor": 2500, "subject_type": "essay", "subject_id": ps})
    assert inc.status_code == 422 and inc.json()["detail"]["code"] == "ADD_ON_INCLUDED"
    # A paid extra for the CV does cover that document.
    o = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops,
                    json={"code": "EXTRA_ESSAY_ROUND", "unit_amount_minor": 2500, "subject_type": "essay", "subject_id": cv})
    assert o.status_code == 201, o.text
    dec = client.post(f"{API}/me/add-ons/{o.json()['id']}", headers=s["h"], json={"approve": True}).json()
    _pay(dec["order"]["order_id"])
    assert _submit(client, s["h"], cv).status_code == 200
    _send_back(client, ops, cv)
    assert _submit(client, s["h"], cv).status_code == 409, "one paid round, one round"


def test_premium_editing_ends_with_the_contracted_term(client, ops):
    s = _buy(client, "PREMIUM")
    eid = _essay(client, s["h"])
    t = client.patch(f"{API}/agency/students/{s['id']}/service-term", headers=ops,
                     json={"service_started_at": "2026-01-01T00:00:00+00:00", "service_ends_at": "2026-02-01T00:00:00+00:00"})
    assert t.status_code == 200, t.text
    assert t.json()["engagement"]["term_ended"] is True
    r = _submit(client, s["h"], eid)
    assert r.status_code == 409 and r.json()["detail"]["reason"] == "SERVICE_PERIOD_ENDED"


def test_premium_first_mock_interview_is_included_and_the_second_is_an_add_on(client, ops):
    s = _buy(client, "PREMIUM")
    body = {"student_id": s["id"], "kind": "INTERVIEW_PREP", "starts_at": "2027-01-10T10:00:00+00:00"}
    early = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops, json={"code": "MOCK_INTERVIEW", "unit_amount_minor": 6000})
    assert early.status_code == 422 and early.json()["detail"]["code"] == "ADD_ON_INCLUDED"
    assert client.post(f"{API}/agency/appointments", headers=ops, json=body).status_code == 201
    r = client.post(f"{API}/agency/appointments", headers=ops, json=body)
    assert r.status_code == 409 and r.json()["detail"]["add_on_code"] == "MOCK_INTERVIEW"
    assert client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops,
                       json={"code": "MOCK_INTERVIEW", "unit_amount_minor": 6000}).status_code == 201


def test_basic_has_one_follow_up_consultation(client, ops):
    s = _buy(client, "BASIC")
    body = {"student_id": s["id"], "kind": "CONSULTATION", "starts_at": "2027-01-10T10:00:00+00:00"}
    assert client.post(f"{API}/agency/appointments", headers=ops, json=body).status_code == 201  # diagnostic
    assert client.post(f"{API}/agency/appointments", headers=ops, json=body).status_code == 201  # follow-up 1
    r = client.post(f"{API}/agency/appointments", headers=ops, json=body)
    assert r.status_code == 409 and r.json()["detail"]["entitlement_key"] == "follow_up_consultations"
    # The support window starts at the first consultation — derived from the record by the task engine.
    with SessionLocal() as db:
        from app.services.tasks_engine import generate_for_student

        generate_for_student(db, uuid.UUID(s["id"]))
        db.commit()
    plan = client.get(f"{API}/me/plan", headers=s["h"]).json()
    assert plan["engagement"]["service_started_at"].startswith("2027-01-10")
    assert plan["engagement"]["support_window_ends_at"].startswith("2027-01-11"), "Basic: a 1-day support window"


# ---------------------------------------------------------------------------------------- add-on lifecycle

def test_add_on_prices_must_sit_inside_the_range_and_quotes_need_a_scope(client, ops):
    s = _buy(client, "ALL_IN_ONE")
    url = f"{API}/agency/students/{s['id']}/add-ons"
    for unit in (2999, 5001, 0):
        r = client.post(url, headers=ops, json={"code": "EXTRA_MANAGED_APPLICATION", "unit_amount_minor": unit})
        assert r.status_code == 422, unit
    assert client.post(url, headers=ops, json={"code": "EXTRA_MANAGED_APPLICATION"}).status_code == 422, "no default price"
    assert client.post(url, headers=ops, json={"code": "AIRPORT_PICKUP", "unit_amount_minor": 9000}).json()["detail"]["code"] == "ADD_ON_SCOPE_REQUIRED"
    assert client.post(url, headers=ops, json={"code": "NOT_A_SERVICE", "unit_amount_minor": 9000}).status_code == 422
    assert client.post(url, headers=ops, json={"code": "MOCK_INTERVIEW", "unit_amount_minor": 6000, "currency": "KRW"}).status_code == 422
    ok = client.post(url, headers=ops, json={"code": "EXTRA_MANAGED_APPLICATION", "quantity": 2, "unit_amount_minor": 3500})
    assert ok.status_code == 201 and ok.json()["amount_minor"] == 7000


def test_a_service_case_add_on_opens_real_work_once_paid_and_completes_with_it(client, ops):
    s = _buy(client, "ALL_IN_ONE")
    o = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops,
                    json={"code": "AIRPORT_PICKUP", "unit_amount_minor": 8500, "scope": "Incheon T1 → campus, 1 passenger, 2 bags"})
    assert o.status_code == 201, o.text
    aid = o.json()["id"]
    dec = client.post(f"{API}/me/add-ons/{aid}", headers=s["h"], json={"approve": True}).json()
    again = client.post(f"{API}/me/add-ons/{aid}", headers=s["h"], json={"approve": True}).json()
    assert again["order"]["order_id"] == dec["order"]["order_id"], "a double approval is the same order"
    with SessionLocal() as db:
        assert db.scalar(select(ServiceAddOn.case_id).where(ServiceAddOn.id == uuid.UUID(aid))) is None
    for _ in range(2):  # idempotent: paying twice activates once
        _pay(dec["order"]["order_id"])
    with SessionLocal() as db:
        row = db.get(ServiceAddOn, uuid.UUID(aid))
        assert row.status == AddOnStatus.ACTIVE and row.case_id is not None
        cases = db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == uuid.UUID(s["id"]), ServiceCase.case_type == "AIRPORT_PICKUP")).all()
        assert len(cases) == 1 and cases[0].details["referral"] is True and cases[0].cost_payer == "student"
        from app.models import AuditLog

        acts = {a for (a,) in db.execute(select(AuditLog.action).where(AuditLog.entity_id == aid))}
        assert {"addon.offer", "addon.approve", "addon.activate"} <= acts
        from app.services import addons

        case = cases[0]
        case.status = "COMPLETED"
        addons.on_case_closed(db, case)
        db.commit()
        assert db.get(ServiceAddOn, uuid.UUID(aid)).status == AddOnStatus.COMPLETED


def test_declining_grants_nothing_and_cannot_be_reopened(client, ops):
    s = _buy(client, "ALL_IN_ONE")
    o = client.post(f"{API}/agency/students/{s['id']}/add-ons", headers=ops, json={"code": "MOCK_INTERVIEW", "unit_amount_minor": 5000}).json()
    assert client.post(f"{API}/me/add-ons/{o['id']}", headers=s["h"], json={"approve": False}).json()["status"] == "DECLINED"
    assert client.post(f"{API}/me/add-ons/{o['id']}", headers=s["h"], json={"approve": True}).status_code == 409
    plan = client.get(f"{API}/me/plan", headers=s["h"]).json()
    assert next(u for u in plan["usage"] if u["key"] == "mock_interviews")["limit"] == 0


# ---------------------------------------------------------------------------------------- upgrades and versions

def test_an_upgrade_is_never_charged_without_an_approved_rule(client):
    s = _buy(client, "BASIC")
    r = client.post(f"{API}/me/orders", headers=s["h"], json={"product_code": "PREMIUM"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "UPGRADE_POLICY_REQUIRED"
    same = client.post(f"{API}/me/orders", headers=s["h"], json={"product_code": "BASIC"})
    assert same.status_code == 409 and same.json()["detail"]["code"] == "PLAN_ALREADY_ACTIVE"
    with SessionLocal() as db:
        assert not db.scalars(select(Order).where(Order.user_id == uuid.UUID(s["id"]), Order.status == "PENDING")).all()


def test_a_purchase_snapshots_the_contract_and_a_catalogue_change_does_not_rewrite_it(client):
    s = _buy(client, "ALL_IN_ONE")
    with SessionLocal() as db:
        eng = db.scalar(select(ServiceEngagement).where(ServiceEngagement.user_id == uuid.UUID(s["id"])))
        order = db.get(Order, eng.order_id)
        assert order.catalog_version == eng.catalog_version == "2026-10-30.v29"
        assert order.plan_snapshot["entitlements"]["essay_review_rounds"] == 2
        prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == "ALL_IN_ONE"))
        saved = dict(prod.entitlements)
        prod.entitlements = {**saved, "essay_review_rounds": 9}  # the catalogue changes …
        db.commit()
    try:
        plan = client.get(f"{API}/me/plan", headers=s["h"]).json()
        assert plan["entitlements"]["essay_review_rounds"] == 2, "… the purchase does not"
    finally:
        with SessionLocal() as db:
            db.scalar(select(ServiceProduct).where(ServiceProduct.code == "ALL_IN_ONE")).entitlements = saved
            db.commit()


def test_a_legacy_contract_keeps_its_terms(client):
    """A V28 buyer (catalogue 2026-10-19.v15) keeps 1 round on All-in-One until a migration is approved."""
    legacy = json.loads((ROOT / "shared/plan-catalog/2026-10-19.v15.json").read_text())
    aio = next(p for p in legacy["plans"] if p["code"] == "ALL_IN_ONE")
    s = _buy(client, "ALL_IN_ONE")
    with SessionLocal() as db:
        eng = db.scalar(select(ServiceEngagement).where(ServiceEngagement.user_id == uuid.UUID(s["id"])))
        eng.catalog_version, eng.entitlements = "2026-10-19.v15", aio["entitlements"]
        db.commit()
    plan = client.get(f"{API}/me/plan", headers=s["h"]).json()
    assert plan["catalog_version"] == "2026-10-19.v15"
    assert next(u for u in plan["usage"] if u["key"] == "essay_review_rounds")["limit"] == 1
    assert plan["engagement"]["is_current_catalog"] is False


def test_a_full_refund_ends_the_engagement(client):
    s = _buy(client, "BASIC")
    with SessionLocal() as db:
        eng = db.scalar(select(ServiceEngagement).where(ServiceEngagement.user_id == uuid.UUID(s["id"])))
        eng.status = "REFUNDED"
        db.commit()
    assert client.get(f"{API}/me/plan", headers=s["h"]).json() is None
    with SessionLocal() as db:
        assert ent_svc.active_engagement(db, uuid.UUID(s["id"])) is None
        assert db.scalars(select(Application).where(Application.student_user_id == uuid.UUID(s["id"]))).all() == []


# ---------------------------------------------------------------------------------------- names (V28 §378.11)

def test_university_names_follow_the_reader_language(client):
    """A stored English university name inside a task / notification is resolved for a Korean reader."""
    from app.core.localnames import localize

    by_id, by_en = {"u1": "부산대학교"}, {"Pusan National University": "부산대학교"}
    payload = {"items": [{"title_params": {"university": "Pusan National University", "university_id": "u1"}},
                         {"title_params": {"university": "Pusan National University"}},  # a pre-V29 row: no id
                         {"note": "Pusan National University"},  # not a university field — never touched
                         {"university": "Some text a person typed"}]}
    assert localize(payload, by_id, by_en) == 2
    assert payload["items"][0]["title_params"]["university"] == "부산대학교"
    assert payload["items"][1]["title_params"]["university"] == "부산대학교"
    assert payload["items"][2]["note"] == "Pusan National University"
    assert payload["items"][3]["university"] == "Some text a person typed"
    # Through the real API: the same student's tasks, read in Korean and in English.
    h = login(client, "student@demo.hangyul.kr", "student")
    ko = client.get(f"{API}/tasks", headers={**h, "Accept-Language": "ko"})
    en = client.get(f"{API}/tasks", headers={**h, "Accept-Language": "en"})
    assert ko.status_code == en.status_code == 200
    text_ko, text_en = ko.text, en.text
    from app.models import University

    with SessionLocal() as db:
        names = {u.name_en: u.name_ko for u in db.scalars(select(University)) if u.name_ko}
    shown_en = [n for n in names if f'"university":"{n}"' in text_en.replace(": ", ":")]
    if shown_en:  # the demo student has tasks that name a university
        assert not any(f'"university":"{n}"' in text_ko for n in shown_en), "an English name leaked into the Korean response"
