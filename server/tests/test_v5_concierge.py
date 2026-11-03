"""V5 concierge: service-case state tables, tenant isolation, honest labels, pickup lifecycle, arrival activation, help routing."""
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import ServiceCase, Task, User, Vendor
from app.services import concierge as svc
from tests.conftest import login

ARRIVAL = "student.arrival@demo.hangyul.kr"
ARRIVED = "student.arrived@demo.hangyul.kr"
VISA = "student.visa@demo.hangyul.kr"


def _uid(db, email):
    return db.scalar(select(User.id).where(User.email == email))


# ------------------------------------------------------------------------------------------------ state tables
def test_every_state_table_is_closed_and_has_a_valid_initial_status():
    for t in svc.CASE_TYPES:
        table = svc.table_for(t)
        assert svc.initial_status(t) in table
        for name, st in table.items():
            assert st.waiting in {"team", "student", "provider", "external", "none"}
            assert st.bucket in {"open", "scheduled", "done", "cancelled"}
            assert all(n in table for n in st.next), (t, name)
        # Every type can be cancelled or completed from its initial status eventually (no dead ends before closure).
        closed = {n for n, s in table.items() if s.bucket in ("done", "cancelled")}
        assert closed


def test_transitions_follow_the_table():
    assert svc.can_transition("AIRPORT_PICKUP", "REQUESTED", "CONFIRMED")
    assert not svc.can_transition("AIRPORT_PICKUP", "REQUESTED", "COMPLETED")
    assert not svc.can_transition("RESIDENCE_CARD", "PREPARING", "COLLECTED")
    assert svc.can_transition("VISA_SUPPORT", "OPEN", "IN_PROGRESS")  # generic until the visa workstream registers its table


def test_register_case_type_is_validated():
    with pytest.raises(AssertionError):
        svc.register_case_type("TEST_BAD", {"A": svc.St("team", "open", ("B",))}, "A")


# ------------------------------------------------------------------------------------------------ honesty
def test_partner_label_only_with_an_active_agreement():
    today = date(2026, 9, 29)
    v = Vendor(name="X", kind="housing_provider", is_demo=False, agreement=None)
    assert svc.student_vendor_label(v) == "PROVIDER"
    v.agreement = {"active": True, "since": "2026-01-01", "until": "2027-12-31", "reference": "HG-2026-01"}
    assert svc.agreement_active(v, today) and svc.student_vendor_label(v) == "PARTNER"
    v.agreement = {"active": True, "since": "2025-01-01", "until": "2026-01-01", "reference": "HG-2025-01"}
    assert not svc.agreement_active(v, today)
    v.agreement = {"active": False, "since": "2026-01-01", "until": None, "reference": "HG"}
    assert svc.student_vendor_label(v) == "PROVIDER"
    demo = Vendor(name="D", kind="housing_provider", is_demo=True, agreement={"active": True, "since": "2026-01-01", "until": None, "reference": "x"})
    assert svc.student_vendor_label(demo) == "DEMO"  # demo is always labelled demo, even with an agreement


def test_housing_page_shows_demo_listings_as_demo_and_no_partner_without_agreement(client):
    h = login(client, VISA, "student")
    body = client.get("/api/v1/me/housing", headers=h).json()
    assert body["partner_listings"] == [] and body["partner_providers"] == []
    assert next(o for o in body["options"] if o["value"] == "PARTNER")["available"] is False
    assert body["listings"], "Bảo's university has two demo listings"
    assert all(li["is_demo"] and li["provider"]["label"] == "DEMO" and li["verification_status"] == "DEMO" for li in body["listings"])
    assert body["dorm_case"]["status"] == "APPLIED"
    d = body["dormitories"][0]
    assert {"application_opens", "application_closes", "eligibility", "deposit_krw", "move_in_date", "required_documents", "verification_status"} <= set(d)


def test_flight_is_never_live_without_a_provider(client):
    with pytest.raises(svc.FlightProviderNotConfigured):
        svc.get_flight_provider().lookup("VN408", date(2027, 2, 20))
    h = login(client, ARRIVAL, "student")
    j = client.get("/api/v1/me/arrival-journey", headers=h).json()
    assert j["flight"]["source"] == "MANUAL" and j["flight"]["live"] is False
    assert j["flight_provider"] == "none"


def test_lease_flags_are_practical_gaps_only():
    assert set(svc.lease_flags({})) == {"MISSING_ADDRESS", "UNCLEAR_DEPOSIT", "UNCLEAR_RENT", "UNCLEAR_DATES", "MISSING_LANDLORD"}
    ok = {"address": "Seoul", "deposit_krw": 1000000, "rent_monthly_krw": 500000, "start_date": "2027-02-20", "end_date": "2028-02-19", "agent_name": "A"}
    assert svc.lease_flags(ok) == []
    assert svc.lease_flags({**ok, "end_date": "2027-01-01"}) == ["UNCLEAR_DATES"]


# ------------------------------------------------------------------------------------------------ tenant isolation
def test_service_cases_are_tenant_isolated(client, db, silk_manager, pnu_admin):
    bao = login(client, VISA, "student")
    case_id = client.get("/api/v1/me/service-cases", headers=bao).json()["items"][0]["id"]
    lan = login(client, "student@demo.hangyul.kr", "student")
    assert all(c["id"] != case_id for c in client.get("/api/v1/me/service-cases", headers=lan).json()["items"])
    assert client.post(f"/api/v1/me/service-cases/{case_id}/cancel", headers=lan).status_code == 404
    # Another agency: invisible in the queue and 404 on the record.
    assert client.get(f"/api/v1/agency/service-cases/{case_id}", headers=silk_manager).status_code == 404
    assert all(c["id"] != case_id for c in client.get("/api/v1/agency/service-cases?view=completed", headers=silk_manager).json()["items"])
    assert client.patch(f"/api/v1/agency/service-cases/{case_id}", json={"internal_notes": "x"}, headers=silk_manager).status_code == 404
    # V22: every admin of the student's agency sees the case, assigned or not.
    c2 = login(client, "counselor2@lotus.demo.hangyul.kr", "agency")
    assert client.get(f"/api/v1/agency/service-cases/{case_id}", headers=c2).status_code == 200
    # Universities have no access to service cases at all.
    assert client.get("/api/v1/agency/service-cases", headers=pnu_admin).status_code == 403
    # The assigned counselor and Hangyul ops can.
    lotus = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    assert client.get(f"/api/v1/agency/service-cases/{case_id}", headers=lotus).status_code == 200
    ops = login(client, "ops@demo.hangyul.kr", "agency")
    assert client.get(f"/api/v1/agency/service-cases/{case_id}", headers=ops).status_code == 200


def test_students_never_see_internal_notes_or_events(client, lotus_counselor):
    bao = login(client, VISA, "student")
    case_id = client.get("/api/v1/me/service-cases", headers=bao).json()["items"][0]["id"]
    r = client.post(f"/api/v1/agency/service-cases/{case_id}/events", json={"kind": "NOTE", "body": "internal: call the dorm office"}, headers=lotus_counselor)
    assert r.status_code == 201
    client.patch(f"/api/v1/agency/service-cases/{case_id}", json={"internal_notes": "secret"}, headers=lotus_counselor)
    mine = next(c for c in client.get("/api/v1/me/service-cases", headers=bao).json()["items"] if c["id"] == case_id)
    assert "internal_notes" not in mine
    assert all("internal:" not in (e["body"] or "") for e in mine["events"])


def test_student_cannot_make_staff_moves(client):
    bao = login(client, VISA, "student")
    case = client.get("/api/v1/me/service-cases", headers=bao).json()["items"][0]
    assert case["type"] == "DORMITORY" and case["status"] == "APPLIED"
    r = client.post(f"/api/v1/me/service-cases/{case['id']}/step", json={"status": "ASSIGNED"}, headers=bao)
    assert r.status_code == 409


# ------------------------------------------------------------------------------------------------ journey + home
def test_home_stage_by_persona(db):
    assert svc.home_stage(db, _uid(db, "student.new@demo.hangyul.kr")) is None  # before admission: quiet
    bao = svc.home_stage(db, _uid(db, VISA))
    assert bao["stage"] == "ADMITTED" and bao["next"] is None  # housing already under way; visa stays the main track
    arr = svc.home_stage(db, _uid(db, ARRIVAL))
    assert arr["stage"] == "READY_TO_COME"
    assert arr["next"]["key"] == "sim_esim"  # housing, flight, pickup, documents done
    done = svc.home_stage(db, _uid(db, ARRIVED))
    assert done["stage"] == "ARRIVED" and done["next"]["key"] == "residence_card"
    assert done["residence_card_due"] == "2026-11-22"


def test_arrival_journey_steps_carry_a_source_or_needs_review(client):
    h = login(client, ARRIVED, "student")
    j = client.get("/api/v1/me/arrival-journey", headers=h).json()
    keys = [s["key"] for s in j["steps"]]
    assert keys[0] == "residence_card" and "sim_esim" not in keys  # SIM done before arrival is not asked again
    for s in j["steps"]:
        o = s["official"]
        assert o["status"] in {"VERIFIED", "PARTIAL", "NEEDS_REVIEW"}
        if o["status"] != "NEEDS_REVIEW":
            assert o["source"] and o["source"]["url"]
    rc = next(s for s in j["steps"] if s["key"] == "residence_card")
    assert rc["official"]["source"]["url"].startswith("https://www.hikorea.go.kr")
    assert {n["number"] for n in j["emergency"]["numbers"]} >= {"112", "119", "1345", "1330"}
    assert j["residence_card"]["status"] == "PREPARING"


# ------------------------------------------------------------------------------------------------ pickup lifecycle
def test_pickup_lifecycle_with_delay_then_arrival_activates_residence_card(client, db, lotus_counselor):
    h = login(client, ARRIVAL, "student")
    j = client.get("/api/v1/me/arrival-journey", headers=h).json()
    assert j["stage"] == "READY_TO_COME" and j["residence_card"] is None
    pickup = j["pickup"]
    assert pickup["status"] == "REQUESTED" and pickup["status_key"] == "status.AIRPORT_PICKUP.REQUESTED"
    # A second request is refused while one is open.
    assert client.post("/api/v1/me/pickup", json={"passengers": 1, "luggage": 1, "destination_kind": "DORM", "contact_method": "PHONE"}, headers=h).status_code == 409
    cid = pickup["id"]
    q = client.get("/api/v1/agency/service-cases?view=needs_assignment", headers=lotus_counselor).json()
    assert "counts" in q and set(q["views"]) == set(svc.VIEWS)
    api = f"/api/v1/agency/service-cases/{cid}"
    assert client.patch(api, json={"status": "COMPLETED"}, headers=lotus_counselor).status_code == 409  # not allowed from REQUESTED
    assert client.patch(api, json={"status": "CONFIRMED"}, headers=lotus_counselor).status_code == 200
    # Driver needs a provider first.
    assert client.patch(api, json={"status": "DRIVER_ASSIGNED"}, headers=lotus_counselor).status_code == 422
    vendors = client.get("/api/v1/agency/vendors?kind=airport_transport", headers=lotus_counselor).json()["items"]
    vid = vendors[0]["id"]
    r = client.patch(api, json={"vendor_id": vid, "details": {"driver": {"name": "Demo driver", "phone": "000"}}, "status": "DRIVER_ASSIGNED"}, headers=lotus_counselor)
    assert r.status_code == 200 and r.json()["status"] == "DRIVER_ASSIGNED"
    # Student sees the provider honestly labelled.
    mine = client.get("/api/v1/me/arrival-journey", headers=h).json()["pickup"]
    assert mine["vendor"]["label"] == "DEMO" and "contact" not in mine["vendor"]
    # Flight delayed by 90 minutes (entered manually) → FLIGHT_DELAYED and the pickup time moves.
    sched = datetime.fromisoformat(mine["flight"]["scheduled_arrival"])
    est = (sched + timedelta(minutes=90)).isoformat()
    r = client.post(f"{api}/events", json={"kind": "FLIGHT_CHANGE", "estimated_arrival": est, "body": "Airline notice"}, headers=lotus_counselor)
    body = r.json()
    assert r.status_code == 201 and body["status"] == "FLIGHT_DELAYED"
    assert datetime.fromisoformat(body["due_at"]) == datetime.fromisoformat(est)
    assert body["flight"]["estimated_arrival"] and body["flight"]["live"] is False
    assert client.patch(api, json={"status": "PICKED_UP"}, headers=lotus_counselor).json()["status"] == "PICKED_UP"
    # Arrival is recorded by the pickup → residence card case + student task become active.
    j = client.get("/api/v1/me/arrival-journey", headers=h).json()
    assert j["stage"] == "ARRIVED" and j["residence_card"]["status"] == "PREPARING"
    sid = _uid(db, ARRIVAL)
    db.expire_all()
    rc_tasks = db.scalars(select(Task).where(Task.student_user_id == sid, Task.dedupe_key.like("svc:%:student:PREPARING"))).all()
    assert len(rc_tasks) == 1 and rc_tasks[0].status.value == "OPEN" and rc_tasks[0].visible_to_student
    # Completion needs proof.
    assert client.patch(api, json={"status": "COMPLETED"}, headers=lotus_counselor).status_code == 422
    r = client.patch(api, json={"status": "COMPLETED", "note": "Met at exit 6, dropped at dorm"}, headers=lotus_counselor)
    assert r.status_code == 200 and r.json()["closed"] is True
    assert any(e["kind"] == "PROOF" for e in r.json()["events"])
    # Feedback once finished.
    assert client.post(f"/api/v1/me/service-cases/{cid}/feedback", json={"ok": True, "comment": "On time"}, headers=h).status_code == 200
    # The team task for the pickup is closed; nothing open remains for this case.
    db.expire_all()
    open_team = db.scalars(select(Task).where(Task.dedupe_key == f"svc:{cid}:team")).all()
    assert all(t.status.value == "DONE" for t in open_team)


def test_student_flight_change_asks_the_team_to_reconfirm(client, db, lotus_counselor):
    h = login(client, ARRIVED, "student")  # arrived persona: pickup completed — no reconfirm on a closed case
    r = client.put("/api/v1/me/flight", json={"number": "vn416", "airport": "ICN", "scheduled_arrival": "2026-08-24T15:00:00+09:00"}, headers=h)
    assert r.status_code == 200 and r.json()["number"] == "VN416" and r.json()["live"] is False
    assert client.put("/api/v1/me/flight", json={"number": "VN1", "airport": "XXX", "scheduled_arrival": "2026-08-24T15:00:00+09:00"}, headers=h).status_code == 422


# ------------------------------------------------------------------------------------------------ help routing
def test_help_routing(client, db, silk_manager, lotus_counselor):
    lan = login(client, "student@demo.hangyul.kr", "student")
    r = client.post("/api/v1/me/help", json={"category": "VISA_RESIDENCE", "message": "My residence card appointment was cancelled"}, headers=lan)
    assert r.status_code == 201
    visa = r.json()
    assert visa["type"] == "VISA_SUPPORT" and visa["routed_to"] == "HANGYUL_OPS" and visa["owner"] is None
    ops = login(client, "ops@demo.hangyul.kr", "agency")
    ops_q = client.get("/api/v1/agency/service-cases?view=needs_assignment", headers=ops).json()["items"]
    assert any(c["id"] == visa["id"] for c in ops_q)
    # The agency still sees its student's case but it isn't in its "needs assignment" view (Hangyul owns it).
    ag_q = client.get("/api/v1/agency/service-cases?view=needs_assignment", headers=lotus_counselor).json()["items"]
    assert all(c["id"] != visa["id"] for c in ag_q)
    assert client.get(f"/api/v1/agency/service-cases/{visa['id']}", headers=silk_manager).status_code == 404
    med = client.post("/api/v1/me/help", json={"category": "MEDICAL", "message": "I have a high fever"}, headers=lan).json()
    assert med["routed_to"] == "AGENCY" and med["priority"] == "URGENT" and med["owner"] is not None
    assert {n["number"] for n in med["emergency"]["numbers"]} >= {"112", "119"}
    assert client.post("/api/v1/me/help", json={"category": "NOPE", "message": "x x x"}, headers=lan).status_code == 422
    # Hangyul ops gets a team task in its org queue.
    db.expire_all()
    t = db.scalar(select(Task).where(Task.dedupe_key == f"svc:{visa['id']}:team"))
    assert t is not None and t.owner_org_id == svc.hangyul_org_id(db)
    # Agency Today hook surfaces the urgent medical request.
    from app.core.deps import load_principal

    counselor = db.scalar(select(User).where(User.email == "counselor@lotus.demo.hangyul.kr"))
    from app.models import OrganizationMember

    org_id = db.scalar(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == counselor.id))
    items = svc.today_items(db, load_principal(db, counselor, org_id, "agency"))
    assert any(i["case_id"] == med["id"] and i["reason"] in ("urgent", "overdue") for i in items)


# ------------------------------------------------------------------------------------------------ vendors + metrics
def test_vendor_agreement_needs_a_reference_and_network_vendors_are_hangyul_managed(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    bad = client.post("/api/v1/agency/vendors", json={"name": "Seoul Rides", "kind": "airport_transport", "agreement": {"active": True}}, headers=mgr)
    assert bad.status_code == 422
    ok = client.post("/api/v1/agency/vendors", json={"name": "Seoul Rides", "kind": "airport_transport",
                                                     "agreement": {"active": True, "since": "2026-01-01", "reference": "LB-2026-7"}}, headers=mgr)
    assert ok.status_code == 201 and ok.json()["agreement_active"] and ok.json()["network"] is False
    network = next(v for v in client.get("/api/v1/agency/vendors", headers=mgr).json()["items"] if v["network"])
    assert client.patch(f"/api/v1/agency/vendors/{network['id']}", json={"name": "Renamed", "kind": "airport_transport"}, headers=mgr).status_code == 403
    counselor = login(client, "counselor@lotus.demo.hangyul.kr", "agency")  # V22: every admin of the agency manages its own vendors
    assert client.post("/api/v1/agency/vendors", json={"name": "Hanoi Translations", "kind": "translation"}, headers=counselor).status_code == 201
    silk = login(client, "manager@silk.demo.hangyul.kr", "agency")
    assert all(v["name"] not in ("Seoul Rides", "Hanoi Translations") for v in client.get("/api/v1/agency/vendors", headers=silk).json()["items"])


def test_metrics_withhold_small_samples(db):
    end = datetime.now(timezone.utc)
    m = svc.concierge_metrics(db, None, end - timedelta(days=365), end)
    for k in ("completion", "sla_breach", "arrival_support_completion"):
        r = m[k]
        assert r["definition"] and (r["value"] is None) == (r["denominator"] < 5)
    assert (m["feedback"]["share_yes"] is None) == (m["feedback"]["n"] < 5)
    assert (m["time_to_resolution_hours"]["median"] is None) == (m["time_to_resolution_hours"]["n"] < 5)


def test_seeded_personas_are_coherent(db):
    arrived = _uid(db, ARRIVED)
    cases = {c.case_type: c for c in db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == arrived))}
    assert cases["AIRPORT_PICKUP"].status == "COMPLETED" and cases["DORMITORY"].status == "MOVED_IN"
    assert cases["RESIDENCE_CARD"].status == "PREPARING" and all(c.is_demo for c in cases.values())
    assert all(v.is_demo and v.agreement is None for v in db.scalars(select(Vendor).where(Vendor.is_demo.is_(True))))
