"""V3 agency operations: saved views, team templates, message attachments, upload on behalf, bulk review, Today."""
import pytest

from tests.conftest import login

PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"


@pytest.fixture(scope="module")
def lotus_manager(client):
    return login(client, "manager@lotus.demo.hangyul.kr", "agency")


def _lotus_student(client, headers):
    rows = client.get("/api/v1/agency/students?page_size=200", headers=headers).json()["items"]
    return next(r for r in rows if r["email"] == "student@demo.hangyul.kr")


# ------------------------------------------------------------------ saved views

def test_saved_views_personal_team_and_tenant(client, lotus_manager, lotus_counselor, silk_manager):
    r = client.post("/api/v1/agency/saved-views", headers=lotus_manager,
                    json={"name": "Spring Vietnam urgent", "scope": "TEAM", "filters": {"nationality": ["VN"], "deadline_within_days": 14, "missing_documents": True}})
    assert r.status_code == 201, r.text
    team_view = r.json()
    # V22: every admin of the agency sees team views and may publish or edit them (no counselor/manager distinction).
    assert any(v["id"] == team_view["id"] and v["can_edit"] for v in client.get("/api/v1/agency/saved-views", headers=lotus_counselor).json())
    shared = client.post("/api/v1/agency/saved-views", headers=lotus_counselor, json={"name": "x", "scope": "TEAM"})
    assert shared.status_code == 201, shared.text
    assert client.patch(f"/api/v1/agency/saved-views/{team_view['id']}", headers=lotus_counselor, json={"name": "Spring Vietnam urgent (edited)", "scope": "TEAM"}).status_code == 200
    assert client.delete(f"/api/v1/agency/saved-views/{shared.json()['id']}", headers=lotus_manager).status_code == 204
    mine = client.post("/api/v1/agency/saved-views", headers=lotus_counselor, json={"name": "Mine", "filters": {"waiting_on": "us"}}).json()
    assert all(v["id"] != mine["id"] for v in client.get("/api/v1/agency/saved-views", headers=lotus_manager).json())  # personal stays personal
    # Another agency sees neither.
    other = {v["id"] for v in client.get("/api/v1/agency/saved-views", headers=silk_manager).json()}
    assert team_view["id"] not in other and mine["id"] not in other
    assert client.delete(f"/api/v1/agency/saved-views/{team_view['id']}", headers=silk_manager).status_code == 404
    assert client.post("/api/v1/agency/saved-views", headers=lotus_manager, json={"name": "bad", "filters": {"drop_table": 1}}).status_code == 422
    assert client.delete(f"/api/v1/agency/saved-views/{team_view['id']}", headers=lotus_manager).status_code == 204


def test_custom_filters_apply_to_the_list(client, lotus_manager):
    base = client.get("/api/v1/agency/students?page_size=200", headers=lotus_manager).json()
    vn = client.get("/api/v1/agency/students?page_size=200&nationality=VN", headers=lotus_manager).json()
    assert vn["total"] <= base["total"] and all(r["nationality"] == "VN" for r in vn["items"])
    missing = client.get("/api/v1/agency/students?page_size=200&missing_documents=true", headers=lotus_manager).json()
    counts = client.get("/api/v1/agency/students/views", headers=lotus_manager).json()
    assert missing["total"] == counts["incomplete"]
    for key in ("waiting_us", "waiting_student", "arrived"):
        assert client.get(f"/api/v1/agency/students?view={key}&page_size=200", headers=lotus_manager).json()["total"] == counts[key]
    assert all(r["waiting_on"] in ("counselor", "agency", "hangyul", "student", "university", "external", None) for r in base["items"])  # V9
    by_deadline = client.get("/api/v1/agency/students?page_size=200&sort=deadline", headers=lotus_manager).json()["items"]
    dates = [r["next_deadline"]["date"] for r in by_deadline if r["next_deadline"]]
    assert dates == sorted(dates)


def test_today_links_each_item_to_a_queue(client, lotus_manager):
    t = client.get("/api/v1/agency/today", headers=lotus_manager).json()
    for key in ("overdue_tasks", "documents_waiting", "student_replies", "closing_soon", "sla_risk"):
        assert "count" in t[key] and t[key]["queue"].startswith("/")


# ------------------------------------------------------------------ templates

def test_templates_scopes_and_permissions(client, lotus_manager, lotus_counselor, silk_manager):
    org_defaults = client.get("/api/v1/templates", headers=lotus_counselor).json()
    assert any(t["scope"] == "ORG" for t in org_defaults["items"]) and "student_name" in org_defaults["placeholders"]
    personal = client.post("/api/v1/templates", headers=lotus_counselor, json={"title": "My note", "body": "Hi {{student_name}}", "kind": "GENERAL"}).json()
    # V9 (REPORT §59 A5): any staff member may share a TEAM template; ORG templates are owners/managers only.
    # V22: every agency admin may publish an organisation template (REPORT §246 A2).
    org_t = client.post("/api/v1/templates", headers=lotus_counselor, json={"title": "t", "body": "b", "scope": "ORG"})
    assert org_t.status_code == 201, org_t.text
    assert client.delete(f"/api/v1/templates/{org_t.json()['id']}", headers=lotus_counselor).status_code == 204
    shared = client.post("/api/v1/templates", headers=lotus_counselor, json={"title": "t", "body": "b", "scope": "TEAM"})
    assert shared.status_code == 201 and shared.json()["can_edit"]
    assert client.delete(f"/api/v1/templates/{shared.json()['id']}", headers=lotus_counselor).status_code == 204
    team = client.post("/api/v1/templates", headers=lotus_manager, json={"title": "Team", "body": "b", "scope": "TEAM", "kind": "APOSTILLE"}).json()
    mgr_ids = {t["id"] for t in client.get("/api/v1/templates", headers=lotus_manager).json()["items"]}
    assert team["id"] in mgr_ids and personal["id"] not in mgr_ids
    silk_ids = {t["id"] for t in client.get("/api/v1/templates", headers=silk_manager).json()["items"]}
    assert team["id"] not in silk_ids and personal["id"] not in silk_ids
    assert client.patch(f"/api/v1/templates/{team['id']}", headers=lotus_counselor, json={"title": "x", "body": "y", "scope": "TEAM"}).status_code == 200
    assert client.delete(f"/api/v1/templates/{personal['id']}", headers=lotus_counselor).status_code == 204


# ------------------------------------------------------------------ attachments

def test_attachments_round_trip_and_internal_privacy(client, student, lotus_manager, silk_manager):
    conv = client.get("/api/v1/conversations", headers=student).json()[0]
    up = client.post(f"/api/v1/conversations/{conv['id']}/attachments", headers=student, files={"file": ("bank.pdf", PDF, "application/pdf")})
    assert up.status_code == 201, up.text
    att = up.json()
    assert set(att) == {"id", "filename", "mime_type", "size_bytes"}
    # Someone else cannot link or download an unsent upload.
    assert client.post(f"/api/v1/attachments/{att['id']}/download-url", headers=lotus_manager).status_code == 404
    assert client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=student, json={"body": "", "attachment_ids": [att["id"]]}).status_code == 201
    staff_view = client.get(f"/api/v1/conversations/{conv['id']}/messages", headers=lotus_manager).json()["messages"]
    assert any(a["id"] == att["id"] for m in staff_view for a in m["attachments"])
    url = client.post(f"/api/v1/attachments/{att['id']}/download-url", headers=lotus_manager).json()["url"]
    assert client.get(url).content.startswith(b"%PDF")
    # Internal note with an attachment never reaches the student.
    note = client.post(f"/api/v1/conversations/{conv['id']}/attachments", headers=lotus_manager, files={"file": ("internal.pdf", PDF, "application/pdf")}).json()
    assert client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=lotus_manager,
                       json={"body": "internal only", "internal": True, "attachment_ids": [note["id"]]}).status_code == 201
    seen = [a["id"] for m in client.get(f"/api/v1/conversations/{conv['id']}/messages", headers=student).json()["messages"] for a in m["attachments"]]
    assert note["id"] not in seen
    assert client.post(f"/api/v1/attachments/{note['id']}/download-url", headers=student).status_code == 404
    # Other tenants can't see the conversation's attachments at all.
    assert client.post(f"/api/v1/attachments/{att['id']}/download-url", headers=silk_manager).status_code == 404
    # Non-document files are rejected.
    assert client.post(f"/api/v1/conversations/{conv['id']}/attachments", headers=student, files={"file": ("x.exe", b"MZ\x90\x00", "application/octet-stream")}).status_code in (415, 422)
    assert client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=student, json={"body": "  "}).status_code == 422


# ------------------------------------------------------------------ upload on behalf + bulk

def test_upload_on_behalf_is_scoped_and_audited(client, lotus_manager, silk_manager, pnu_admin):
    s = _lotus_student(client, lotus_manager)
    r = client.post("/api/v1/documents", headers=lotus_manager, data={"category": "PHOTO", "student_user_id": s["id"]},
                    files={"file": ("photo.pdf", PDF, "application/pdf")})
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["owner_user_id"] == s["id"] and doc["status"] == "NEEDS_REVIEW"
    assert client.post("/api/v1/documents", headers=silk_manager, data={"category": "PHOTO", "student_user_id": s["id"]},
                       files={"file": ("p.pdf", PDF, "application/pdf")}).status_code == 404
    assert client.post("/api/v1/documents", headers=pnu_admin, data={"category": "PHOTO", "student_user_id": s["id"]},
                       files={"file": ("p.pdf", PDF, "application/pdf")}).status_code == 403
    assert client.post("/api/v1/documents", headers=lotus_manager, data={"category": "PHOTO"},
                       files={"file": ("p.pdf", PDF, "application/pdf")}).status_code == 403
    audit = client.get(f"/api/v1/audit?subject_id={s['id']}&page_size=50", headers=lotus_manager).json()["items"]
    assert any(a["action"] == "document.upload_on_behalf" for a in audit)


def test_bulk_review_reports_partial_failures(client, lotus_manager, silk_manager):
    queue = client.get("/api/v1/documents/review-queue?page_size=50", headers=lotus_manager).json()
    assert queue["items"] and all("over_sla" in d and "sla_hours" in d for d in queue["items"])
    ids = [d["id"] for d in queue["items"]][:2]
    silk_doc = client.get("/api/v1/documents/review-queue?page_size=1", headers=silk_manager).json()["items"]
    foreign = [silk_doc[0]["id"]] if silk_doc else ["00000000-0000-0000-0000-000000000000"]
    me = client.get("/api/v1/auth/me", headers=lotus_manager).json()["user"]["id"]
    assign = client.post("/api/v1/documents/bulk", headers=lotus_manager, json={"ids": ids + foreign, "action": "ASSIGN_REVIEWER", "reviewer_user_id": me}).json()
    assert assign["ok"] == len(ids) and assign["failed"] == 1
    assert client.get("/api/v1/documents/review-queue?assigned=me&page_size=50", headers=lotus_manager).json()["total"] >= len(ids)
    assert client.post("/api/v1/documents/bulk", headers=lotus_manager, json={"ids": ids, "action": "REQUEST_CORRECTION"}).status_code == 422
    res = client.post("/api/v1/documents/bulk", headers=lotus_manager, json={"ids": ids[:1] + foreign, "action": "VERIFY"}).json()
    assert res["ok"] == 1 and res["results"][1]["error"] == "not_found"
    again = client.post("/api/v1/documents/bulk", headers=lotus_manager, json={"ids": ids[:1], "action": "VERIFY"}).json()
    assert again["results"][0]["error"] == "not_waiting_for_review"
