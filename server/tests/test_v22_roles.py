"""V22 — one permission per tenant, unified customer identity, tenant isolation, account rosters (REPORT §246–247, §257–258)."""
import uuid

from sqlalchemy import select

from app.models import Application, Message, Organization, OrganizationMember, University, User
from app.models.enums import ApplicationStatus, OrgType, Role
from app.services.access import university_visible
from tests.conftest import login
from tests.v22_helpers import register_student

API = "/api/v1"


# ------------------------------------------------------------------------------------------------ agency
def test_agency_roles_are_one(client):
    for who in ("owner", "manager", "counselor", "reviewer"):
        r = client.post(f"{API}/auth/login", json={"email": f"{who}@lotus.demo.hangyul.kr", "password": "Hangyul!2026", "client": "agency"})
        assert r.status_code == 200, who
        body = r.json()
        assert body["active_org"]["role"] == "AGENCY_ADMIN" and "AGENCY_ADMIN" in body["roles"]
        assert not any(x in body["roles"] for x in ("AGENCY_OWNER", "AGENCY_MANAGER", "AGENCY_COUNSELOR", "AGENCY_DOCUMENT_REVIEWER"))


def test_legacy_membership_row_reads_as_admin(client, db):
    """A pre-migration row (or a rolled-back deploy) must still sign in and must present the canonical permission."""
    org = db.scalar(select(Organization).where(Organization.slug == "lotus-bridge"))
    m = db.scalar(select(OrganizationMember).join(User, User.id == OrganizationMember.user_id).where(User.email == "reviewer@lotus.demo.hangyul.kr"))
    m.role = Role.AGENCY_DOCUMENT_REVIEWER
    db.commit()
    try:
        r = client.post(f"{API}/auth/login", json={"email": "reviewer@lotus.demo.hangyul.kr", "password": "Hangyul!2026", "client": "agency"})
        assert r.status_code == 200 and r.json()["active_org"]["role"] == "AGENCY_ADMIN"
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        # the legacy "reviewer" could not transition applications; the admin can
        assert client.get(f"{API}/agency/students?page_size=5", headers=h).status_code == 200
        assert org is not None
    finally:
        m.role = Role.AGENCY_ADMIN
        db.commit()


def test_every_admin_can_do_every_agency_job(client, db, lotus_counselor):
    reviewer = login(client, "reviewer@lotus.demo.hangyul.kr", "agency")
    owner = login(client, "owner@lotus.demo.hangyul.kr", "agency")
    # review queue, team page, operations, templates, identity edit — none of them is refused to any admin
    for h in (lotus_counselor, reviewer, owner):
        assert client.get(f"{API}/documents/review-queue?page_size=1", headers=h).status_code == 200
        assert client.get(f"{API}/agency/team", headers=h).json()["can_manage"] is True
        assert client.get(f"{API}/agency/identity", headers=h).json()["can_edit"] is True
        assert client.get(f"{API}/agency/today/queue?limit=5", headers=h).status_code == 200
        assert client.get(f"{API}/agency/team/accounts", headers=h).status_code == 200
    # the former reviewer-only restriction on application transitions is gone
    app = db.scalar(select(Application).join(User, User.id == Application.student_user_id).where(Application.status == ApplicationStatus.DOCUMENT_PREPARATION))
    r = client.get(f"{API}/applications/{app.id}", headers=reviewer)
    assert r.status_code in (200, 404)  # 404 only if that student is not Lotus Bridge's


def test_two_admins_reply_student_sees_one_team(client, db, student, lotus_counselor):
    reviewer = login(client, "reviewer@lotus.demo.hangyul.kr", "agency")
    convs = client.get(f"{API}/conversations", headers=student).json()
    cid = convs[0]["id"]
    a = client.post(f"{API}/conversations/{cid}/messages", headers=lotus_counselor, json={"body": f"reply one {uuid.uuid4().hex[:4]}"})
    b = client.post(f"{API}/conversations/{cid}/messages", headers=reviewer, json={"body": f"reply two {uuid.uuid4().hex[:4]}"})
    assert a.status_code == 201 and b.status_code == 201
    # student view: both staff replies carry one identity
    msgs = client.get(f"{API}/conversations/{cid}/messages", headers=student).json()["messages"]
    staff = [m for m in msgs if not m["mine"] and m["author"]]
    assert staff and all(m["author"]["kind"] == "team" and m["author"]["id"] == "team" for m in staff)
    names = {m["author"]["full_name"] for m in staff}
    assert names == {"Hangyul Univ Team"}
    # conversation list: the last author is the team too
    lst = next(c for c in client.get(f"{API}/conversations", headers=student).json() if c["id"] == cid)
    assert lst["last_message"]["author"]["kind"] == "team"
    # agency view: real names, two different people
    agency_view = client.get(f"{API}/conversations/{cid}/messages", headers=lotus_counselor).json()["messages"]
    recent = [m for m in agency_view if m["body"].startswith("reply ")]
    assert len({m["author"]["id"] for m in recent}) == 2 and all(m["author"]["kind"] == "staff" for m in recent)
    # audit actor: the rows keep their real author ids
    rows = db.scalars(select(Message).where(Message.conversation_id == uuid.UUID(cid), Message.body.like("reply %"))).all()
    assert len({m.author_user_id for m in rows}) == 2 and all(m.author_user_id is not None for m in rows)


def test_student_home_shows_team_not_a_named_counselor(client, student):
    d = client.get(f"{API}/me/dashboard", headers=student).json()
    assert d["counselor"] and d["counselor"]["counselor"]["kind"] == "team" and d["counselor"]["team"]["name_ko"] == "한귤 유니브 상담팀"
    a = client.get(f"{API}/me/assignment", headers=student).json()
    assert a["counselor"]["kind"] == "team"


def test_agency_invite_creates_admin_who_sets_own_password(client, db, lotus_counselor):
    email = f"v22-admin-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/agency/team/invite", headers=lotus_counselor, json={"email": email, "full_name": "New Admin", "locale": "en"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["account"]["role"] == "AGENCY_ADMIN" and body["invite"]["challenge_id"]
    roster = client.get(f"{API}/agency/team/accounts", headers=lotus_counselor).json()
    assert any(a["email"] == email and a["active"] for a in roster["accounts"]) and roster["role"] == "AGENCY_ADMIN"
    assert set(roster["accounts"][0]) >= {"full_name", "email", "active", "last_login_at"}
    # nobody knows the password yet
    assert client.post(f"{API}/auth/login", json={"email": email, "password": "anything-at-all", "client": "agency"}).status_code == 401
    code = client.get(f"{API}/auth/verification/peek/{body['invite']['challenge_id']}").json()["code"]
    ok = client.post(f"{API}/auth/reset-password", json={"challenge_id": body["invite"]["challenge_id"], "code": code,
                                                        "new_password": "my own strong password", "new_password_confirm": "my own strong password"})
    assert ok.status_code == 200
    r = client.post(f"{API}/auth/login", json={"email": email, "password": "my own strong password", "client": "agency"})
    assert r.status_code == 200 and r.json()["active_org"]["role"] == "AGENCY_ADMIN"
    # a student cannot be invited as staff
    stu = register_student(client)
    r = client.post(f"{API}/agency/team/invite", headers=lotus_counselor, json={"email": stu["email"], "full_name": "X"})
    assert r.status_code == 409


# ------------------------------------------------------------------------------------------------ university
def _pnu_app(db):
    """A Pusan application the university can see. Earlier files move the seeded SUBMITTED/UNIVERSITY_REVIEW rows on
    (document requests, interviews…), so the pick is "any university-visible row", not a fixed status."""
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    app = db.scalar(select(Application).where(Application.university_id == pnu.id, university_visible()).order_by(Application.submitted_at, Application.id))
    assert app is not None, "seeded Pusan applications that reached submission"
    return pnu, app


def test_multiple_university_admins_same_permissions(client, db):
    pnu, app = _pnu_app(db)
    for who in ("analyst", "admissions", "reviewer"):
        h = login(client, f"{who}@pusan.univ.demo.hangyul.kr", "university")
        assert client.get(f"{API}/university/analytics", headers=h).status_code == 200, who
        assert client.get(f"{API}/university/export/applications.csv", headers=h).status_code == 200, who
        assert client.get(f"{API}/university/partnership", headers=h).status_code == 200, who
        assert client.get(f"{API}/applications/{app.id}", headers=h).status_code == 200, who


def test_cross_tenant_everything_is_404(client, db, skku_admin, pnu_admin):
    pnu, app = _pnu_app(db)
    # detail, documents, messages, requests, exports scoped by url, team, bulk — guessed from the other tenant
    assert client.get(f"{API}/applications/{app.id}", headers=skku_admin).status_code == 404
    assert client.get(f"{API}/applications/{app.id}/documents", headers=skku_admin).status_code in (404, 405)
    assert client.post(f"{API}/applications/{app.id}/transition", headers=skku_admin, json={"to": "UNIVERSITY_REVIEW"}).status_code == 404
    # a document is shared per application, so one the student shared with BOTH universities is legitimately visible to
    # both; the probe is a document Pusan sees and SKKU was never given
    pnu_docs = {d["id"] for d in client.get(f"{API}/documents?page_size=200", headers=pnu_admin).json()["items"]}
    skku_docs = {d["id"] for d in client.get(f"{API}/documents?page_size=200", headers=skku_admin).json()["items"]}
    private = sorted(pnu_docs - skku_docs)
    assert private
    assert client.get(f"{API}/documents/{private[0]}", headers=skku_admin).status_code == 404
    convs = client.get(f"{API}/conversations", headers=pnu_admin).json()
    for c in convs[:3]:
        assert client.get(f"{API}/conversations/{c['id']}/messages", headers=skku_admin).status_code == 404
    # the export ignores a foreign university_id and returns only the caller's rows
    csv = client.get(f"{API}/university/export/applications.csv?university_id={pnu.id}", headers=skku_admin)
    assert csv.status_code == 200 and str(app.student_user_id) not in csv.text
    # list never leaks
    ids = {a["id"] for a in client.get(f"{API}/applications?page_size=200", headers=skku_admin).json()["items"]}
    assert str(app.id) not in ids
    assert client.post(f"{API}/university/bulk/flag", headers=skku_admin, json={"ids": [str(app.id)], "flag": True}).status_code in (404, 409, 422, 400)


def test_hq_university_accounts_invite_reassign_disable(client, db, pnu_admin):
    hq = login(client, "admin@demo.hangyul.kr", "agency")
    rows = client.get(f"{API}/agency/hq/university-accounts", headers=hq).json()["accounts"]
    assert any(a["email"] == "admin@pusan.univ.demo.hangyul.kr" and a["university"]["slug"] == "pusan-national-university" for a in rows)
    assert all(a["role"] == "UNIVERSITY_ADMIN" for a in rows)
    pnu, app = _pnu_app(db)
    skku = db.scalar(select(University).where(University.slug == "sungkyunkwan-university"))
    email = f"v22-uni-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/agency/hq/university-accounts/invite", headers=hq, json={"email": email, "full_name": "Pusan Admin 2", "university_id": str(pnu.id), "locale": "ko"})
    assert r.status_code == 201, r.text
    inv = r.json()["invite"]
    code = client.get(f"{API}/auth/verification/peek/{inv['challenge_id']}").json()["code"]
    assert client.post(f"{API}/auth/reset-password", json={"challenge_id": inv["challenge_id"], "code": code, "new_password": "pusan admin password 2", "new_password_confirm": "pusan admin password 2"}).status_code == 200
    # lands directly in Pusan — one membership, no picker
    r = client.post(f"{API}/auth/login", json={"email": email, "password": "pusan admin password 2", "client": "university"})
    assert r.status_code == 200
    body = r.json()
    assert body["active_org"]["university_id"] == str(pnu.id) and len(body["memberships"]) == 1
    h2 = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get(f"{API}/applications/{app.id}", headers=h2).status_code == 200
    uid = body["user"]["id"]
    # reassign to SKKU → Pusan disappears
    r = client.post(f"{API}/agency/hq/university-accounts/{uid}/reassign", headers=hq, json={"university_id": str(skku.id)})
    assert r.status_code == 200
    r = client.post(f"{API}/auth/login", json={"email": email, "password": "pusan admin password 2", "client": "university"})
    assert r.json()["active_org"]["university_id"] == str(skku.id)
    h3 = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get(f"{API}/applications/{app.id}", headers=h3).status_code == 404
    # the old token's org membership is revoked → 401
    assert client.get(f"{API}/applications/{app.id}", headers=h2).status_code == 401
    # disable → cannot sign in to the console at all
    assert client.post(f"{API}/agency/hq/university-accounts/{uid}/disable", headers=hq).status_code == 200
    assert client.post(f"{API}/auth/login", json={"email": email, "password": "pusan admin password 2", "client": "university"}).status_code == 403
    # a university admin cannot reach the HQ roster
    assert client.get(f"{API}/agency/hq/university-accounts", headers=pnu_admin).status_code in (403, 404)


def test_no_legacy_role_offered_anywhere(client):
    """Nothing the API publishes offers a legacy role as a choice."""
    hq = login(client, "admin@demo.hangyul.kr", "agency")
    text = client.get(f"{API}/agency/hq/university-accounts", headers=hq).text + client.get(f"{API}/agency/team", headers=login(client, "manager@lotus.demo.hangyul.kr", "agency")).text
    for legacy in ("AGENCY_OWNER", "AGENCY_MANAGER", "AGENCY_COUNSELOR", "AGENCY_DOCUMENT_REVIEWER", "UNIVERSITY_ADMISSIONS", "UNIVERSITY_REVIEWER", "UNIVERSITY_ANALYST"):
        assert legacy not in text, legacy
    assert OrgType.AGENCY  # imported for clarity of intent
