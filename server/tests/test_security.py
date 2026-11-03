"""Authentication, RBAC and tenant isolation. These are the guarantees the platform's trust model depends on."""
from sqlalchemy import select

from app.models import AgencyAssignment, Application, Document, Organization, University, User
from app.models.enums import ApplicationStatus, AssignmentStatus
from tests.conftest import PASSWORD, login


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={"email": "student@demo.hangyul.kr", "password": "nope", "client": "student"})
    assert r.status_code == 401


def test_student_cannot_enter_consoles(client):
    for console in ("agency", "university"):
        r = client.post("/api/v1/auth/login", json={"email": "student@demo.hangyul.kr", "password": PASSWORD, "client": console})
        assert r.status_code == 403


def test_agency_staff_cannot_use_student_platform(client):
    r = client.post("/api/v1/auth/login", json={"email": "counselor@lotus.demo.hangyul.kr", "password": PASSWORD, "client": "student"})
    assert r.status_code == 403


def test_refresh_rotation_and_reuse_detection(client):
    r = client.post("/api/v1/auth/login", json={"email": "student03@demo.hangyul.kr", "password": PASSWORD, "client": "student"})
    rt1 = r.json()["refresh_token"]
    r2 = client.post("/api/v1/auth/refresh", json={"client": "student", "refresh_token": rt1})
    assert r2.status_code == 200
    rt2 = r2.json()["refresh_token"]
    # Retrying the rotated token within the grace window (page reload during refresh) is tolerated…
    r3 = client.post("/api/v1/auth/refresh", json={"client": "student", "refresh_token": rt1})
    assert r3.status_code == 200
    rt3 = r3.json()["refresh_token"]
    # Outside the grace window, reuse of a rotated token revokes the whole family.
    from datetime import timedelta

    from app.core.db import SessionLocal
    from app.core.security import hash_token
    from app.models import RefreshToken
    with SessionLocal() as s:
        t = s.query(RefreshToken).filter_by(token_hash=hash_token(rt1)).one()
        t.revoked_at = t.revoked_at - timedelta(minutes=5)
        s.commit()
    assert client.post("/api/v1/auth/refresh", json={"client": "student", "refresh_token": rt1}).status_code == 401
    # …including the newest token and the token issued in between.
    assert client.post("/api/v1/auth/refresh", json={"client": "student", "refresh_token": rt3}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"client": "student", "refresh_token": rt2}).status_code == 401


def test_unauthenticated_requests_rejected(client):
    assert client.get("/api/v1/me/dashboard").status_code == 401
    assert client.get("/api/v1/agency/students").status_code == 401


def _student_of(db, agency_slug: str):
    org = db.scalar(select(Organization).where(Organization.slug == agency_slug))
    return db.scalar(select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == org.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))


def test_agency_cannot_see_other_agency_students(client, db, lotus_counselor, silk_manager):
    silk_student = _student_of(db, "silk-road")
    lotus_student = _student_of(db, "lotus-bridge")
    assert client.get(f"/api/v1/agency/students/{silk_student}", headers=lotus_counselor).status_code == 404
    assert client.get(f"/api/v1/agency/students/{lotus_student}", headers=silk_manager).status_code == 404
    listed = {s["id"] for s in client.get("/api/v1/agency/students?page_size=200", headers=silk_manager).json()["items"]}
    assert str(lotus_student) not in listed
    # documents of another tenant's student are invisible too
    doc = db.scalar(select(Document).where(Document.owner_user_id == lotus_student))
    if doc:
        assert client.get(f"/api/v1/documents/{doc.id}", headers=silk_manager).status_code == 404


def test_every_agency_admin_sees_the_whole_agency(client, db, lotus_counselor):
    """V22 (REPORT §246 A1): the old rule — a counselor sees only their own caseload — is retired. Every AGENCY_ADMIN
    of Lotus Bridge sees every Lotus Bridge student; the case owner stays recorded on each row for accountability."""
    me = db.scalar(select(User).where(User.email == "counselor@lotus.demo.hangyul.kr"))
    rows = client.get("/api/v1/agency/students?page_size=200", headers=lotus_counselor).json()["items"]
    assert rows, "the agency should have students"
    owners = {r["counselor"]["id"] for r in rows if r["counselor"]}
    assert len(owners) > 1 and str(me.id) in owners, "an admin sees colleagues' students too"
    other = login(client, "reviewer@lotus.demo.hangyul.kr", "agency")
    rows2 = client.get("/api/v1/agency/students?page_size=200", headers=other).json()["items"]
    assert {r["id"] for r in rows} == {r["id"] for r in rows2}


def test_university_sees_only_own_submitted_applications(client, db, pnu_admin):
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    items = client.get("/api/v1/applications?page_size=200", headers=pnu_admin).json()["items"]
    assert items
    assert all(a["university"]["id"] == str(pnu.id) for a in items)
    assert not any(a["status"] in ("DRAFT", "DOCUMENT_PREPARATION", "READY", "PROFILE_REVIEW") for a in items)
    other = db.scalar(select(Application).where(Application.university_id != pnu.id, Application.status == ApplicationStatus.UNIVERSITY_REVIEW))
    assert client.get(f"/api/v1/applications/{other.id}", headers=pnu_admin).status_code == 404
    draft = db.scalar(select(Application).where(Application.university_id == pnu.id, Application.status == ApplicationStatus.DRAFT))
    if draft:
        assert client.get(f"/api/v1/applications/{draft.id}", headers=pnu_admin).status_code == 404


def test_every_university_member_is_an_admin(client, db):
    """V22 (REPORT §247 U1): the analyst/admissions/reviewer titles are gone; every member holds UNIVERSITY_ADMIN."""
    for who in ("analyst", "admissions", "reviewer", "admin"):
        r = client.post("/api/v1/auth/login", json={"email": f"{who}@pusan.univ.demo.hangyul.kr", "password": "Hangyul!2026", "client": "university"})
        assert r.status_code == 200 and r.json()["active_org"]["role"] == "UNIVERSITY_ADMIN", who


def test_internal_notes_never_reach_students(client, student, lotus_counselor):
    convs = client.get("/api/v1/conversations", headers=student).json()
    assert convs
    msgs = client.get(f"/api/v1/conversations/{convs[0]['id']}/messages", headers=student).json()["messages"]
    assert msgs and not any(m["internal"] for m in msgs)
    staff_view = client.get(f"/api/v1/conversations/{convs[0]['id']}/messages", headers=lotus_counselor).json()["messages"]
    assert any(m["internal"] for m in staff_view)
    # students cannot post internal notes
    assert client.post(f"/api/v1/conversations/{convs[0]['id']}/messages", headers=student, json={"body": "x", "internal": True}).status_code == 403


def test_internal_essay_comments_hidden_from_student(client, student, lotus_counselor):
    essays = client.get("/api/v1/essays?status=AGENCY_REVIEW", headers=student).json()["items"]
    assert essays
    eid = essays[0]["id"]
    s_view = client.get(f"/api/v1/essays/{eid}", headers=student).json()["comments"]
    c_view = client.get(f"/api/v1/essays/{eid}", headers=lotus_counselor).json()["comments"]
    assert all(c["visibility"] != "INTERNAL" for c in s_view)
    assert any(c["visibility"] == "INTERNAL" for c in c_view)


def test_university_cannot_read_student_vault(client, pnu_admin, db):
    items = client.get("/api/v1/documents?page_size=200", headers=pnu_admin).json()["items"]
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    owners = {i["owner_user_id"] for i in items}
    for owner in owners:
        assert db.scalar(select(Application.id).where(Application.student_user_id == owner, Application.university_id == pnu.id))


def test_upload_rejects_non_documents(client, student):
    r = client.post("/api/v1/documents", headers=student, data={"category": "PASSPORT"}, files={"file": ("evil.pdf", b"#!/bin/sh\necho hi", "application/pdf")})
    assert r.status_code == 415


def test_signed_file_url_expires_and_is_private(client, student):
    doc = client.get("/api/v1/documents", headers=student).json()["items"][0]
    url = client.post(f"/api/v1/documents/{doc['id']}/download-url", headers=student).json()["url"]
    r = client.get(url)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert r.headers["cache-control"] == "private, no-store"
    tampered = url[:-4] + ("AAAA" if not url.endswith("AAAA") else "BBBB")
    assert client.get(tampered).status_code == 403
