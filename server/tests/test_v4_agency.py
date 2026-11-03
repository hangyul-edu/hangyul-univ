"""V4 agency: one "waiting on" meaning everywhere, and every Today number opens exactly its records."""
import pytest

from tests.conftest import login

# V9 (REPORT §59 A1): seven parties; legacy "us" stays a filter alias for counselor + agency (asserted below).
WAITING = ("counselor", "agency", "hangyul", "student", "university", "external")


@pytest.fixture(scope="module", params=["manager@lotus.demo.hangyul.kr", "counselor@lotus.demo.hangyul.kr"])
def staff(client, request):
    return login(client, request.param, "agency")


def _students(client, h, qs=""):
    return client.get(f"/api/v1/agency/students?page_size=200{qs}", headers=h).json()


def test_waiting_on_is_one_party_per_student_and_matches_filters(client, staff):
    rows = _students(client, staff)["items"]
    today = client.get("/api/v1/agency/today", headers=staff).json()
    views = client.get("/api/v1/agency/students/views", headers=staff).json()
    for who in WAITING:
        page = _students(client, staff, f"&waiting_on={who}")
        assert all(r["waiting_on"] == who for r in page["items"]), who
        assert page["total"] == sum(r["waiting_on"] == who for r in rows) == today["waiting_on"][who], who
    us = _students(client, staff, "&waiting_on=us")
    assert all(r["waiting_on"] in ("counselor", "agency") for r in us["items"])
    assert us["total"] == today["waiting_on"]["counselor"] + today["waiting_on"]["agency"] == today["waiting_on"]["us"]
    assert views["waiting_us"] == today["waiting_on"]["us"]
    assert views["waiting_student"] == today["waiting_on"]["student"]
    assert views["university"] == today["waiting_on"]["university"]
    assert views["waiting_external"] == today["waiting_on"]["external"]
    for r in rows:
        assert (r["waiting_on"] is None) == (r["waiting_reason"] is None)
        if r["waiting_reason"] and r["waiting_reason"]["code"] == "app":
            assert r["waiting_reason"]["status"]


def test_today_counts_equal_the_lists_they_open(client, staff):
    t = client.get("/api/v1/agency/today", headers=staff).json()
    queue = client.get("/api/v1/documents/review-queue?page_size=100", headers=staff).json()
    assert t["documents_waiting"]["count"] == queue["total"]
    tasks = client.get("/api/v1/tasks?scope=team&page_size=200", headers=staff).json()["items"]
    assert t["overdue_tasks"]["count"] == sum(x["overdue"] for x in tasks)
    convs = client.get("/api/v1/conversations?needs_reply=true", headers=staff).json()
    assert t["student_replies"]["conversations"] == len(convs)
    assert all(c["awaiting_reply"] for c in convs)
    assert t["closing_soon"]["students"] == _students(client, staff, "&closing_within_days=7")["total"]
    assert t["sla_risk"]["count"] == _students(client, staff, "&sla_risk=true")["total"]
    assert t["university_requests"]["count"] == _students(client, staff, "&view=requested")["total"]
    assert t["student_replies"]["queue"] == "/messages?filter=reply"


def test_new_filters_can_be_saved_as_views(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    r = client.post("/api/v1/agency/saved-views", headers=mgr, json={"name": "V4 closing", "filters": {"closing_within_days": 14, "waiting_on": "external"}})
    assert r.status_code == 201, r.text
    assert client.delete(f"/api/v1/agency/saved-views/{r.json()['id']}", headers=mgr).status_code == 204


def test_workspace_says_who_the_case_waits_on_and_items_left(client, lotus_counselor):
    rows = _students(client, lotus_counselor)["items"]
    for row in rows:
        ws = client.get(f"/api/v1/agency/students/{row['id']}", headers=lotus_counselor).json()
        assert ws["waiting_on"] == row["waiting_on"]
        for a in ws["applications"]:
            assert "waiting_on" in a
            if a["status"] in ("DRAFT", "PROFILE_REVIEW", "DOCUMENT_PREPARATION", "READY"):
                assert isinstance(a["items_remaining"], int) and 0 <= a["items_in_review"] <= a["items_remaining"]
            else:
                assert "items_remaining" not in a


def test_tasks_and_conversations_carry_context_for_staff_only(client, lotus_counselor, student):
    tasks = client.get("/api/v1/tasks?scope=team&page_size=200", headers=lotus_counselor).json()["items"]
    linked = [x for x in tasks if x["application_id"]]
    assert linked and all(x.get("application_status") for x in linked)
    staff_convs = client.get("/api/v1/conversations", headers=lotus_counselor).json()
    assert staff_convs and all("awaiting_reply" in c for c in staff_convs)
    own = client.get("/api/v1/conversations?needs_reply=true", headers=student).json()
    assert all("awaiting_reply" not in c and "application" not in c for c in own)
    student_tasks = client.get("/api/v1/tasks", headers=student).json()["items"]
    assert all("application_status" not in x for x in student_tasks)


def test_document_detail_names_the_student_and_university_for_staff(client, lotus_counselor, student):
    queue = client.get("/api/v1/documents/review-queue?page_size=5", headers=lotus_counselor).json()["items"]
    assert queue
    d = client.get(f"/api/v1/documents/{queue[0]['id']}", headers=lotus_counselor).json()
    assert d["owner_name"]
    assert all("university" in a for a in d["used_in_applications"])
    own = client.get("/api/v1/documents", headers=student).json()["items"]
    if own:
        assert "owner_name" not in client.get(f"/api/v1/documents/{own[0]['id']}", headers=student).json()
