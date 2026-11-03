"""V8 agency operations: operational saved views (counts = rows), ranked Today with reasons, case movement,
manager Operations drill-downs, HQ failure list and production readiness honesty."""
import pytest

from app.services import caseload, priority
from tests.conftest import login

V8_VIEWS = ("urgent", "deadline7", "student_silent", "university", "docs", "visa_blocked", "new_paid", "unassigned")


@pytest.mark.parametrize("who", ["manager@lotus.demo.hangyul.kr", "counselor@lotus.demo.hangyul.kr"])
def test_operational_view_counts_equal_rows(client, who):
    h = login(client, who, "agency")
    counts = client.get("/api/v1/agency/students/views", headers=h).json()
    for v in V8_VIEWS:
        assert v in counts, v
        r = client.get(f"/api/v1/agency/students?view={v}&page_size=200", headers=h)
        assert r.status_code == 200, (v, r.text)
        assert r.json()["total"] == counts[v], v
        assert len(r.json()["items"]) == min(200, counts[v])


def test_view_rows_match_their_definition(client):
    h = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    for row in client.get("/api/v1/agency/students?view=student_silent&page_size=200", headers=h).json()["items"]:
        assert row["waiting_on"] == "student"
    for row in client.get("/api/v1/agency/students?view=unassigned&page_size=200", headers=h).json()["items"]:
        assert row["counselor"] is None
    for row in client.get("/api/v1/agency/students?view=deadline7&page_size=200", headers=h).json()["items"]:
        assert row["next_deadline"] is not None
    assert set(V8_VIEWS) - {"university", "docs"} <= set(caseload.VIEW_DEFINITIONS)


def test_today_queue_is_ranked_by_the_stated_rule(client):
    h = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    r = client.get("/api/v1/agency/today/queue?limit=200", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "team" and len(body["rule"]) == 3
    items = body["items"]
    assert items, "seeded agency has work"
    keys = [priority.rank_key(i["reasons"]) for i in items]
    assert keys == sorted(keys)  # server order == the stated rule
    for pos, i in enumerate(items, start=1):
        assert i["position"] == pos
        assert i["reasons"] and all(r["code"] in priority.TIERS and r["tier"] == priority.TIERS[r["code"]] for r in i["reasons"])
        assert i["rank"]["tier"] == min(r["tier"] for r in i["reasons"]) == i["reasons"][0]["tier"]
        assert i["action"]["link"].startswith("/")
    assert sum(body["by_tier"].values()) == body["total"]


def test_today_queue_every_admin_can_widen_to_the_team(client):
    """V22: every admin of the agency may look at the whole team's queue; "mine" narrows to the cases they own."""
    h = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    body = client.get("/api/v1/agency/today/queue?scope=team&limit=200", headers=h).json()
    assert body["scope"] == "team"
    agency = {s["id"] for s in client.get("/api/v1/agency/students?page_size=200", headers=h).json()["items"]}
    assert {i["student"]["id"] for i in body["items"]} <= agency
    me = client.get("/api/v1/auth/me", headers=h).json()
    me_id = me.get("id") or me["user"]["id"]
    mine = {s["id"] for s in client.get("/api/v1/agency/students?page_size=200", headers=h).json()["items"]
            if s["counselor"] and s["counselor"]["id"] == me_id}
    own = client.get("/api/v1/agency/today/queue?scope=mine&limit=200", headers=h).json()
    assert own["scope"] == "mine" and {i["student"]["id"] for i in own["items"]} <= mine


def test_case_movement_explains_and_lists_next(client):
    h = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    first = client.get("/api/v1/agency/today/queue?limit=1", headers=h).json()["items"][0]
    m = client.get(f"/api/v1/agency/students/{first['student']['id']}/movement", headers=h)
    assert m.status_code == 200
    body = m.json()
    assert [r["code"] for r in body["reasons"]] == [r["code"] for r in first["reasons"]]
    assert body["days_since_moved"] is None or body["days_since_moved"] >= 0
    assert body["waiting_on"] in (None, "counselor", "agency", "hangyul", "student", "university", "external")  # V9 waiting model
    for n in body["next"]:
        assert n["kind"] in ("task", "meeting", "deadline") and n["link"].startswith("/")


def test_case_movement_is_tenant_scoped(client, silk_manager):
    lotus = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    sid = client.get("/api/v1/agency/students?page_size=1", headers=lotus).json()["items"][0]["id"]
    assert client.get(f"/api/v1/agency/students/{sid}/movement", headers=silk_manager).status_code == 404


def test_operations_view_drills_down_to_exact_records(client):
    h = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    r = client.get("/api/v1/agency/ops", headers=h)
    assert r.status_code == 200
    ops = r.json()
    for k in ("backlog", "ageing", "load", "sla", "deadlines", "stages", "definitions"):
        assert k in ops
    assert len(ops["backlog"]["weeks"]) == 8
    for w in ops["backlog"]["weeks"]:
        assert w["total"] == w["tasks"] + w["documents"] + w["essays"]
    # ageing: phase totals = the student rows it lists
    assert sum(p["total"] for p in ops["ageing"]["phases"]) == len(ops["ageing"]["students"])
    for p in ops["ageing"]["phases"]:
        assert sum(p["buckets"].values()) == p["total"]
    # load: counselor cases add up to the agency's assigned cases
    assert sum(c["active_cases"] for c in ops["load"]["counselors"]) == ops["load"]["active_total"]
    for k in ("first_response", "document_review", "essay_review"):
        assert ops["sla"][k]["count"] == len(ops["sla"][k]["items"])
    assert ops["deadlines"]["count"] == len(ops["deadlines"]["items"])
    for d in ops["deadlines"]["items"]:
        assert d["items_remaining"] > 0 and 0 <= d["days_left"] <= 14


def test_operations_view_is_for_every_admin(client, lotus_counselor, student):
    assert client.get("/api/v1/agency/ops", headers=lotus_counselor).status_code == 200  # V22: one agency permission
    assert client.get("/api/v1/agency/ops", headers=student).status_code == 403


def test_hq_failures_are_severity_ordered(client):
    h = login(client, "ops@demo.hangyul.kr", "agency")
    ov = client.get("/api/v1/agency/hq/overview", headers=h).json()
    sev = {"critical": 0, "high": 1, "medium": 2}
    order = [(sev[f["severity"]], -f["count"]) for f in ov["failures"]]
    assert order == sorted(order)
    assert all(f["count"] > 0 and f["link"].startswith("/") for f in ov["failures"])
    codes = {f["code"] for f in ov["failures"]} | set(ov["all_clear"])
    assert "first_response" in codes and "visa_blocked" in codes
    fr = next((f for f in ov["failures"] if f["code"] == "first_response"), None)
    if fr:
        assert fr["count"] == ov["sla"]["first_response"]["breached"]


def test_readiness_never_claims_active_without_configuration(client, monkeypatch):
    from app.core.config import get_settings

    h = login(client, "ops@demo.hangyul.kr", "agency")
    for k in ("HG_SMTP_HOST", "HG_WHATSAPP_TOKEN", "HG_AI_PROVIDER", "HG_FLIGHT_PROVIDER"):
        monkeypatch.delenv(k, raising=False)
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "demo")
    monkeypatch.setattr(s, "push_provider", "none")
    body = client.get("/api/v1/admin/readiness", headers=h).json()
    st = {i["key"]: i["status"] for i in body["items"]}
    assert st["payments"] == "DEVELOPMENT_ONLY"
    assert st["file_storage"] == "DEVELOPMENT_ONLY"
    assert st["malware_scan"] == "NOT_CONFIGURED"
    assert st["push"] == "NOT_CONFIGURED"
    assert st["channel_in_app"] == "ACTIVE"
    for c in ("email", "whatsapp", "kakao", "sms"):
        assert st[f"channel_{c}"] == "NOT_CONFIGURED"
    assert body["ready_for_production"] is False and "payments" in body["blocking"]
    assert sum(body["counts"].values()) == len(body["items"])
    # A key alone is not an integration: stripe with a key is still not ACTIVE.
    monkeypatch.setattr(s, "payment_provider", "stripe")
    monkeypatch.setattr(s, "stripe_secret_key", "sk_test_x")
    st = {i["key"]: i["status"] for i in client.get("/api/v1/admin/readiness", headers=h).json()["items"]}
    assert st["payments"] == "NEEDS_AGREEMENT"
    # values never leak
    assert "sk_test_x" not in client.get("/api/v1/admin/readiness", headers=h).text


def test_readiness_is_hangyul_only(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    assert client.get("/api/v1/admin/readiness", headers=mgr).status_code == 404


def test_applications_remaining_replaces_percent(client, silk_manager):
    h = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    apps = client.get("/api/v1/applications?page_size=50", headers=h).json()["items"]
    assert apps
    ids = [a["id"] for a in apps]
    r = client.get("/api/v1/agency/applications/remaining", params=[("ids", i) for i in ids], headers=h)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == set(ids)
    pre = {"DRAFT", "PROFILE_REVIEW", "DOCUMENT_PREPARATION", "READY"}
    for a in apps:
        v = body[a["id"]]
        if a["status"] in pre:
            assert isinstance(v["items_remaining"], int) and v["items_remaining"] >= 0
        else:
            assert v["items_remaining"] is None
    # another agency's applications are left out
    other = client.get("/api/v1/agency/applications/remaining", params=[("ids", i) for i in ids], headers=silk_manager).json()
    assert not set(other) & set(ids)
