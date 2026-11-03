"""V3 wave 2 agency: cohort performance (honest rates) and per-student program matches for staff."""
import pytest

from tests.conftest import login


@pytest.fixture(scope="module")
def lotus_manager(client):
    return login(client, "manager@lotus.demo.hangyul.kr", "agency")


def _lotus_student_id(client, headers):
    rows = client.get("/api/v1/agency/students?page_size=200", headers=headers).json()["items"]
    return next(r for r in rows if r["email"] == "student@demo.hangyul.kr")["id"]


def _is_rate(r):
    return {"numerator", "denominator", "insufficient_data"} <= set(r)


def test_performance_shape_and_withheld_rates(client, lotus_manager):
    r = client.get("/api/v1/agency/performance", headers=lotus_manager)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["intake"] and any(o["intake"] == p["intake"] for o in p["intakes"])
    cohort = p["cohort"]
    assert cohort["population"] and [s["step"] for s in cohort["funnel"]] == ["STARTED", "SUBMITTED", "OFFERED", "ACCEPTED", "TUITION_PAID", "VISA_ISSUED", "ENROLLED"]
    assert cohort["funnel"][0]["count"] == cohort["size"] and cohort["funnel"][0]["from_previous"] is None
    counts = [s["count"] for s in cohort["funnel"]]
    assert counts == sorted(counts, reverse=True)  # a funnel never widens
    for step in cohort["funnel"][1:]:
        rate = step["from_previous"]
        assert _is_rate(rate)
        # Below the minimum denominator the value is withheld, never shown.
        if rate["denominator"] < p["min_denominator"]:
            assert rate["insufficient_data"] and rate["value"] is None
    for s in cohort["processing"]:
        assert (s["median_days"] is None) == s["insufficient_data"]
    ops = p["operations"]
    assert ops["period_days"] == 90 and _is_rate(ops["sla"]) and ops["sla"]["population"] and _is_rate(ops["document_correction"])
    assert p["workload"] and {"name", "active_students", "open_tasks", "overdue_tasks"} <= set(p["workload"][0])
    assert p["revenue"] is not None and p["revenue"]["is_demo"] is True  # owners/managers see demo revenue

    assert client.get("/api/v1/agency/performance?intake=2027-AUTUMN", headers=lotus_manager).status_code == 422
    assert client.get("/api/v1/agency/performance?days=3", headers=lotus_manager).status_code == 422
    assert client.get("/api/v1/agency/performance?days=30", headers=lotus_manager).json()["operations"]["period_days"] == 30


def test_performance_shows_demo_revenue_to_every_admin(client, lotus_counselor):
    # V22: one agency permission — the former counselor title sees the same (demo-labelled) revenue as everyone else.
    p = client.get("/api/v1/agency/performance", headers=lotus_counselor).json()
    assert p["revenue"] is not None and p["revenue"]["is_demo"] is True


def test_performance_is_tenant_scoped(client, lotus_manager, silk_manager):
    lotus = client.get("/api/v1/agency/performance", headers=lotus_manager).json()
    silk = client.get("/api/v1/agency/performance", headers=silk_manager).json()
    lotus_people = {w["user_id"] for w in lotus["workload"]}
    assert lotus_people and not lotus_people & {w["user_id"] for w in silk["workload"]}


def test_student_matches_for_staff_and_isolation(client, lotus_manager, silk_manager):
    sid = _lotus_student_id(client, lotus_manager)
    r = client.get(f"/api/v1/agency/students/{sid}/matches", headers=lotus_manager)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["student_id"] == sid and body["engine_version"] and body["items"]
    item = body["items"][0]
    assert {"program_id", "tier", "eligible", "score", "reasons"} <= set(item)
    # Another agency cannot see this student's matches (and cannot learn the student exists).
    assert client.get(f"/api/v1/agency/students/{sid}/matches", headers=silk_manager).status_code == 404
