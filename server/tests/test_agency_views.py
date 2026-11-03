"""Caseload saved views and operational row fields (Agency Console student list)."""
from tests.conftest import login


def test_saved_view_counts_match_filtered_lists(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    counts = client.get("/api/v1/agency/students/views", headers=mgr).json()
    assert set(counts) >= {"all", "mine", "attention", "deadline", "docs", "university", "visa"}
    for view in ("attention", "deadline", "docs", "university", "visa"):
        page = client.get(f"/api/v1/agency/students?view={view}&page_size=200", headers=mgr).json()
        assert page["total"] == counts[view], view
        assert counts[view] <= counts["all"]
    assert client.get("/api/v1/agency/students?view=bogus", headers=mgr).status_code == 422


def test_docs_view_only_lists_students_with_documents_to_fix(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    rows = client.get("/api/v1/agency/students?view=docs&page_size=200", headers=mgr).json()["items"]
    assert all(r["documents_to_fix"] > 0 for r in rows)


def test_rows_carry_next_action_deadline_and_activity(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    rows = client.get("/api/v1/agency/students?page_size=200", headers=mgr).json()["items"]
    assert rows
    for r in rows:
        for key in ("next_task", "next_deadline", "top_university", "documents_to_fix", "documents_verified", "documents_total", "last_activity_at"):
            assert key in r
    assert any(r["next_task"] for r in rows)


def test_views_stay_inside_the_tenant(client):
    counselor = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    c = client.get("/api/v1/agency/students/views", headers=counselor).json()
    m = client.get("/api/v1/agency/students/views", headers=mgr).json()
    # V22: every admin of the agency sees the whole agency; "mine" is the internal owner field, a subset of "all".
    assert c["all"] == m["all"]
    assert c["mine"] <= c["all"]
