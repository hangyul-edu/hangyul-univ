"""V6 Hangyul operations overview (GET /agency/hq/overview): Hangyul-only, and every count matches the list it links to."""
import pytest

from tests.conftest import login

URL = "/api/v1/agency/hq/overview"


@pytest.fixture(scope="module")
def ops(client):
    return login(client, "ops@demo.hangyul.kr", "agency")


def test_agency_and_university_staff_cannot_read_it(client, lotus_counselor, silk_manager, pnu_admin, student):
    for h in (lotus_counselor, silk_manager):
        assert client.get(URL, headers=h).status_code == 404
    assert client.get(URL, headers=pnu_admin).status_code in (403, 404)
    assert client.get(URL, headers=student).status_code in (403, 404)
    assert client.get(URL).status_code == 401


def test_overview_shape_and_agencies(client, ops):
    r = client.get(URL, headers=ops)
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(d) >= {"sla", "services", "submissions", "university_requests", "freshness", "agencies"}
    names = [a["name"] for a in d["agencies"]]
    assert any("Lotus" in n for n in names) and any("Silk" in n for n in names)
    for a in d["agencies"]:
        assert a["sla_breaches"] == a["documents_late"] + a["essays_overdue"] + a["first_response_breached"] + a["services_overdue"]
    # Agencies are ordered most at risk first.
    keys = [(-a["sla_breaches"], -a["overdue_tasks"]) for a in d["agencies"]]
    assert keys == sorted(keys)
    # Freshness groups are ordered by risk and their totals add up.
    order = ["CONFLICT", "CHANGED", "REVIEW_DUE"]
    reasons = [g["reason"] for g in d["freshness"]["groups"] if g["reason"] in order]
    assert reasons == sorted(reasons, key=order.index)
    assert d["freshness"]["open"] == sum(g["total"] for g in d["freshness"]["groups"])
    for g in d["freshness"]["groups"]:
        assert g["total"] == sum(k["count"] for k in g["kinds"])


def test_counts_match_the_lists_they_link_to(client, ops):
    d = client.get(URL, headers=ops).json()
    essays = client.get("/api/v1/writing/queue", params={"view": "overdue"}, headers=ops).json()
    assert d["sla"]["essays"]["overdue"] == essays["total"]
    tasks = client.get("/api/v1/tasks", params={"scope": "team", "overdue": True, "page_size": 1}, headers=ops).json()
    assert d["sla"]["tasks"]["overdue"] == tasks["total"]
    breached = client.get("/api/v1/agency/students", params={"sla_breached": True, "page_size": 1}, headers=ops).json()
    assert d["sla"]["first_response"]["breached"] == breached["total"]
    ready = client.get("/api/v1/applications", params={"status": "READY", "page_size": 1}, headers=ops).json()
    assert d["submissions"]["ready"] == ready["total"]
    services = client.get("/api/v1/agency/service-cases", headers=ops)
    if services.status_code == 200:
        assert d["services"]["overdue"] == services.json()["counts"]["overdue"]


def test_per_agency_student_filter_respects_tenants(client, ops, lotus_counselor, silk_manager):
    d = client.get(URL, headers=ops).json()
    lotus = next(a for a in d["agencies"] if "Lotus" in a["name"])
    silk = next(a for a in d["agencies"] if "Silk" in a["name"])
    r = client.get("/api/v1/agency/students", params={"agency_id": lotus["id"], "page_size": 1}, headers=ops).json()
    assert r["total"] == lotus["students"]
    waiting = client.get("/api/v1/agency/students", params={"agency_id": lotus["id"], "view": "waiting_us", "page_size": 1}, headers=ops).json()
    assert waiting["total"] == lotus["waiting_on_us"]
    requested = client.get("/api/v1/agency/students", params={"agency_id": lotus["id"], "view": "requested", "page_size": 1}, headers=ops).json()
    assert requested["total"] == lotus["university_requests"]
    all_requested = client.get("/api/v1/agency/students", params={"view": "requested", "page_size": 1}, headers=ops).json()
    assert all_requested["total"] == d["university_requests"]["students"]
    # An agency asking for another agency's caseload gets nothing — the tenant scope still applies.
    other = client.get("/api/v1/agency/students", params={"agency_id": lotus["id"]}, headers=silk_manager).json()
    assert other["total"] == 0
    own = client.get("/api/v1/agency/students", params={"agency_id": silk["id"], "page_size": 1}, headers=silk_manager).json()
    assert own["total"] >= 0
