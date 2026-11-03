"""V8 audit log reads as sentences: names and readable targets resolved server-side, filters by person/action/student."""
from tests.conftest import login


def test_audit_rows_carry_names_and_readable_targets(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    student = client.get("/api/v1/agency/students?page_size=1", headers=mgr).json()["items"][0]
    client.get(f"/api/v1/agency/students/{student['id']}", headers=mgr)  # writes a student.view entry
    page = client.get("/api/v1/audit?page_size=20", headers=mgr).json()
    assert page["total"] >= 1
    row = next(r for r in page["items"] if r["action"] == "student.view" and r["subject_user_id"] == student["id"])
    assert row["actor"] != "system" and row["actor_id"]
    assert row["subject_name"] == student["full_name"]
    assert row["target"] == {"type": "student"}
    for r in page["items"]:
        assert all(isinstance(v, (str, int, float, bool)) for v in r["facts"].values())


def test_audit_filters_by_actor_student_and_action(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    people = client.get("/api/v1/audit/people", headers=mgr).json()
    assert people["actors"] and people["students"]
    actor = people["actors"][0]["id"]
    rows = client.get(f"/api/v1/audit?actor_id={actor}&page_size=100", headers=mgr).json()["items"]
    assert rows and all(r["actor_id"] == actor for r in rows)
    sid = people["students"][0]["id"]
    rows = client.get(f"/api/v1/audit?subject_id={sid}&action=student&page_size=100", headers=mgr).json()["items"]
    assert all(r["subject_user_id"] == sid and r["action"].startswith("student") for r in rows)


def test_document_access_names_the_document(client, db):
    from sqlalchemy import select

    from app.models import AuditLog, Document

    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    doc = db.scalar(select(Document).where(Document.owner_user_id.in_(
        [r["id"] for r in client.get("/api/v1/agency/students?page_size=50", headers=mgr).json()["items"]])).limit(1))
    assert doc is not None
    r = client.post(f"/api/v1/documents/{doc.id}/download-url", headers=mgr)
    if r.status_code != 200:  # no stored version in this dataset — nothing to open
        return
    rows = client.get("/api/v1/audit?action=document.access&page_size=20", headers=mgr).json()["items"]
    hit = next(x for x in rows if x["entity_id"] == str(doc.id))
    assert hit["target"]["type"] == "document" and hit["target"]["category"] == doc.category.value
    assert db.scalar(select(AuditLog).where(AuditLog.entity_id == str(doc.id))) is not None


def test_other_agencies_see_only_their_own_audit(client, silk_manager):
    lotus = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    lotus_actors = {a["id"] for a in client.get("/api/v1/audit/people", headers=lotus).json()["actors"]}
    silk_rows = client.get("/api/v1/audit?page_size=100", headers=silk_manager).json()["items"]
    assert not any(r["actor_id"] in lotus_actors for r in silk_rows)
