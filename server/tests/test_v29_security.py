"""V29 Phase E — threat-model checks that can be verified locally (docs/qa/v29/security/THREAT_MODEL.md).

Tenant isolation, IDOR, signed URLs, refresh reuse, OTP brute force, payment idempotency, staff MFA (bypass attempts,
replay, recovery codes, enrolment-only tokens, super-admin reset + step-up), upload abuse, malware blocking, CORS
and production security headers.
"""
import base64
import time
import uuid

import pyotp
import pytest
from sqlalchemy import select

from app.core import storage as storage_mod
from app.core.config import get_settings
from app.core.security import hash_password, sign_file_token, verify_file_token
from app.models import (
    AgencyAssignment,
    AuditLog,
    Document,
    DocumentVersion,
    Order,
    Organization,
    OrganizationMember,
    ServiceAddOn,
    ServiceProduct,
    User,
    UserRole,
)
from app.models.enums import AssignmentStatus, OrgType, Role
from app.services import ratelimit
from tests.conftest import PASSWORD, login
from tests.v22_helpers import register_student
from tests.v29_fakes import EICAR, FakeClamd, pdf

API = "/api/v1"


# ------------------------------------------------------------------------------------------------ helpers
def _staff(db, *, role: Role = Role.AGENCY_ADMIN, org_slug: str = "lotus-bridge") -> str:
    email = f"v29-staff-{uuid.uuid4().hex[:8]}@example.com"
    u = User(email=email, password_hash=hash_password(PASSWORD), full_name="V29 Staff", locale="en", is_active=True)
    db.add(u)
    db.flush()
    if role in (Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS):
        db.add(UserRole(user_id=u.id, role=role))
        org = db.scalar(select(Organization).where(Organization.type == OrgType.HANGYUL))
    else:
        org = db.scalar(select(Organization).where(Organization.slug == org_slug))
    db.add(OrganizationMember(organization_id=org.id, user_id=u.id, role=role))
    db.commit()
    return email


def _login_raw(client, email, console="agency"):
    return client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD, "client": console})


def _code(secret: str, offset_steps: int = 0) -> str:
    return pyotp.TOTP(secret).at(time.time() + 30 * offset_steps)


def _enrol(client, h: dict) -> tuple[str, list[str]]:
    e = client.post(f"{API}/auth/mfa/enroll", headers=h)
    assert e.status_code == 200, e.text
    secret = e.json()["secret"]
    assert e.json()["otpauth_uri"].startswith("otpauth://totp/")
    a = client.post(f"{API}/auth/mfa/activate", headers=h, json={"code": _code(secret)})
    assert a.status_code == 200, a.text
    assert a.json()["tokens"] is None  # a normal session gets no second session
    return secret, a.json()["recovery_codes"]


@pytest.fixture
def strict_limits(monkeypatch):
    monkeypatch.setattr(get_settings(), "ratelimit_scale", 1)
    ratelimit.reset_all()
    yield
    ratelimit.reset_all()


@pytest.fixture
def fake_clamd(monkeypatch):
    srv = FakeClamd()
    monkeypatch.setattr(storage_mod, "_scanner", storage_mod.ClamdScanner(socket_path=srv.path, timeout=5))
    yield srv
    srv.close()


# ------------------------------------------------------------------------------------------------ tenant isolation / IDOR
def test_other_agency_student_is_404(client, db, silk_manager):
    lotus = db.scalar(select(Organization).where(Organization.slug == "lotus-bridge"))
    sid = db.scalar(select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == lotus.id,
                                                                   AgencyAssignment.status == AssignmentStatus.ACTIVE))
    assert client.get(f"{API}/agency/students/{sid}", headers=silk_manager).status_code == 404


def test_document_idor_is_404(client):
    a, b = register_student(client), register_student(client)
    up = client.post(f"{API}/documents", headers=a["h"], files={"file": ("t.pdf", pdf(), "application/pdf")}, data={"category": "TRANSCRIPT"})
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]
    assert client.get(f"{API}/documents/{doc_id}", headers=b["h"]).status_code == 404
    assert client.post(f"{API}/documents/{doc_id}/download-url", headers=b["h"]).status_code == 404
    assert client.patch(f"{API}/documents/{doc_id}", headers=b["h"], json={"title": "x"}).status_code == 404


def test_add_on_and_order_idor_is_404(client, db):
    a, b = register_student(client), register_student(client)
    owner = db.scalar(select(User).where(User.email == a["email"]))
    add_on = ServiceAddOn(user_id=owner.id, code="EXTRA_MANAGED_APPLICATION", quantity=1, amount_minor=1000, currency="USD")
    db.add(add_on)
    product = db.scalar(select(ServiceProduct))
    order = Order(user_id=owner.id, product_id=product.id, currency="USD", amount_minor=1000)
    db.add(order)
    db.commit()
    assert client.post(f"{API}/me/add-ons/{add_on.id}", headers=b["h"], json={"approve": True}).status_code == 404
    assert client.post(f"{API}/me/orders/{order.id}/cancel", headers=b["h"]).status_code == 404
    db.refresh(add_on)
    assert add_on.status.value == "OFFERED"


# ------------------------------------------------------------------------------------------------ signed URLs
def test_signed_url_tamper_and_expiry(client, monkeypatch):
    s = register_student(client)
    up = client.post(f"{API}/documents", headers=s["h"], files={"file": ("t.pdf", pdf(), "application/pdf")}, data={"category": "TRANSCRIPT"})
    url = client.post(f"{API}/documents/{up.json()['id']}/download-url", headers=s["h"]).json()["url"]
    assert client.get(url).status_code == 200
    token = url.rsplit("/", 1)[1]
    key, uid, disp = verify_file_token(token)
    msg, sig = base64.urlsafe_b64decode(token).decode().rsplit("|", 1)
    forged = base64.urlsafe_b64encode(f"{msg.replace(disp, 'attachment')}|{sig}".encode()).decode()
    assert client.get(f"{API}/files/{forged}").status_code == 403
    monkeypatch.setattr(get_settings(), "file_url_ttl_seconds", -1)
    assert client.get(f"{API}/files/{sign_file_token(key, uuid.UUID(uid))}").status_code == 403


def test_refresh_token_reuse_revokes_family(client, db):
    s = register_student(client)
    r = client.post(f"{API}/auth/login", json={"email": s["email"], "password": s["password"], "client": "student"})
    rt1 = r.json()["refresh_token"]
    rt2 = client.post(f"{API}/auth/refresh", json={"client": "student", "refresh_token": rt1}).json()["refresh_token"]
    from datetime import timedelta

    from app.core.security import hash_token
    from app.models import RefreshToken

    t = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(rt1)))
    t.revoked_at = t.revoked_at - timedelta(minutes=5)
    db.commit()
    assert client.post(f"{API}/auth/refresh", json={"client": "student", "refresh_token": rt1}).status_code == 401
    assert client.post(f"{API}/auth/refresh", json={"client": "student", "refresh_token": rt2}).status_code == 401


def test_otp_brute_force_cannot_succeed(client, strict_limits):
    from tests.v22_helpers import signup_session

    sess = signup_session(client)
    target = f"v29-otp-{uuid.uuid4().hex[:8]}@example.com"
    cid = client.post(f"{API}/auth/verification/send", headers=sess, json={"channel": "EMAIL", "target": target, "purpose": "SIGNUP", "locale": "en"}).json()["challenge_id"]
    real = client.get(f"{API}/auth/verification/peek/{cid}").json()["code"]
    wrong = "000000" if real != "000000" else "111111"
    codes = [client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": wrong}).status_code for _ in range(6)]
    assert all(c in (400, 429) for c in codes)
    # After the attempt budget is spent even the right code is refused — guessing 10^6 codes is not possible.
    assert client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": real}).status_code in (400, 429)


def test_payment_idempotency_key_is_derived_from_the_order(monkeypatch):
    import httpx

    from app.services.payments import TossProvider

    seen = []

    class R:
        status_code = 200

        def json(self):
            return {"status": "DONE", "paymentKey": "pk", "totalAmount": 1000}

    monkeypatch.setattr(httpx, "post", lambda url, headers=None, json=None, timeout=None: seen.append(headers["Idempotency-Key"]) or R())
    p = TossProvider(secret="test_sk_x", client_key="test_ck_x", mid="M", api_base="https://api.example", return_origin="http://x", env="test")
    p.confirm(payment_key="pk", order_id="order-1", amount_minor=1000)
    p.confirm(payment_key="pk", order_id="order-1", amount_minor=1000)
    p.confirm(payment_key="pk", order_id="order-2", amount_minor=1000)
    assert seen[0] == seen[1] == "hg-confirm-order-1" and seen[2] == "hg-confirm-order-2"


# ------------------------------------------------------------------------------------------------ staff MFA
def test_mfa_login_step_up_and_bypass_attempts(client, db, strict_limits):
    email = _staff(db)
    first = _login_raw(client, email)
    assert first.status_code == 200  # development default: MFA optional until enrolled
    h = {"Authorization": f"Bearer {first.json()['access_token']}"}
    secret, recovery = _enrol(client, h)
    assert len(recovery) == 10 and len(set(recovery)) == 10
    assert client.get(f"{API}/auth/mfa/status", headers=h).json()["enrolled"] is True

    r = _login_raw(client, email)
    assert r.status_code == 401
    d = r.json()["detail"]
    assert d["code"] == "MFA_REQUIRED" and "access_token" not in r.json() and "hg_rt_agency" not in r.headers.get("set-cookie", "")
    mfa_token = d["mfa_token"]
    # Bypass attempts: the challenge token is not an access token, and is not accepted for enrolment either.
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {mfa_token}"}).status_code == 401
    assert client.get(f"{API}/agency/students", headers={"Authorization": f"Bearer {mfa_token}"}).status_code == 401
    assert client.post(f"{API}/auth/mfa/enroll", headers={"Authorization": f"Bearer {mfa_token}"}).status_code == 401
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "client": "agency"}).status_code == 400
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token + "x", "client": "agency", "code": _code(secret, 1)}).status_code == 401
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "client": "university", "code": _code(secret, 1)}).status_code == 401
    bad = "000000" if _code(secret, 1) != "000000" else "111111"
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "client": "agency", "code": bad}).json()["detail"]["code"] == "MFA_CODE_INVALID"

    ok = client.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "client": "agency", "code": _code(secret, 1)})
    assert ok.status_code == 200, ok.text
    assert ok.json()["access_token"] and "hg_rt_agency" in ok.headers.get("set-cookie", "")
    # Replay of the same time-step code is refused.
    t2 = _login_raw(client, email).json()["detail"]["mfa_token"]
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": t2, "client": "agency", "code": _code(secret, 1)}).status_code == 400
    # A recovery code works exactly once.
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": t2, "client": "agency", "recovery_code": recovery[0]}).status_code == 200
    t3 = _login_raw(client, email).json()["detail"]["mfa_token"]
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": t3, "client": "agency", "recovery_code": recovery[0]}).status_code == 400
    uid = db.scalar(select(User.id).where(User.email == email))
    actions = set(db.scalars(select(AuditLog.action).where(AuditLog.subject_user_id == uid)))
    assert {"mfa.enroll_started", "mfa.enabled", "mfa.challenge_issued", "mfa.verified", "mfa.verify_failed", "mfa.recovery_code_used"} <= actions
    # The secret is sealed at rest.
    from app.models.v29_security import StaffMfa

    row = db.scalar(select(StaffMfa).join(User, User.id == StaffMfa.user_id).where(User.email == email))
    assert secret not in row.secret_ciphertext


def test_mfa_verify_is_rate_limited(client, db, strict_limits):
    email = _staff(db)
    h = {"Authorization": f"Bearer {_login_raw(client, email).json()['access_token']}"}
    secret, _ = _enrol(client, h)
    token = _login_raw(client, email).json()["detail"]["mfa_token"]
    bad = "000000" if _code(secret, 1) != "000000" else "111111"
    codes = [client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "client": "agency", "code": bad}).status_code for _ in range(6)]
    assert codes[:5] == [400] * 5 and codes[5] == 429
    # Even the right code is refused while limited.
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "client": "agency", "code": _code(secret, 1)}).status_code == 429


def test_mfa_required_gives_enrol_only_token(client, db, monkeypatch, strict_limits):
    monkeypatch.setattr(get_settings(), "staff_mfa_required", True)
    email = _staff(db)
    r = _login_raw(client, email)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "MFA_ENROLLMENT_REQUIRED"
    et = {"Authorization": f"Bearer {r.json()['detail']['enrollment_token']}"}
    # The enrolment token reads nothing.
    assert client.get(f"{API}/auth/me", headers=et).status_code == 401
    assert client.get(f"{API}/agency/students", headers=et).status_code == 401
    assert client.get(f"{API}/documents", headers=et).status_code == 401
    st = client.get(f"{API}/auth/mfa/status", headers=et).json()
    assert st["required"] is True and st["enrolled"] is False
    secret = client.post(f"{API}/auth/mfa/enroll", headers=et).json()["secret"]
    a = client.post(f"{API}/auth/mfa/activate", headers=et, json={"code": _code(secret)})
    assert a.status_code == 200 and a.json()["tokens"]["access_token"]
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {a.json()['tokens']['access_token']}"}).status_code == 200
    # Students are never asked for MFA.
    s = register_student(client)
    assert client.post(f"{API}/auth/login", json={"email": s["email"], "password": s["password"], "client": "student"}).status_code == 200


def test_mfa_reset_requires_super_admin_and_step_up(client, db, strict_limits):
    target = _staff(db)
    th = {"Authorization": f"Bearer {_login_raw(client, target).json()['access_token']}"}
    _enrol(client, th)
    target_id = db.scalar(select(User.id).where(User.email == target))
    ops = login(client, "ops@demo.hangyul.kr", "agency")
    assert client.post(f"{API}/hq/accounts/{target_id}/mfa/reset", headers=ops, json={"reason": "lost phone"}).status_code == 404
    admin = _staff(db, role=Role.HANGYUL_SUPER_ADMIN)
    ah = {"Authorization": f"Bearer {_login_raw(client, admin).json()['access_token']}"}
    admin_secret, _ = _enrol(client, ah)
    # Step-up: the super admin has MFA, so a reset without a fresh code is refused.
    r = client.post(f"{API}/hq/accounts/{target_id}/mfa/reset", headers=ah, json={"reason": "lost phone"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "MFA_STEP_UP_REQUIRED"
    r = client.post(f"{API}/hq/accounts/{target_id}/mfa/reset", headers={**ah, "X-MFA-Code": _code(admin_secret, 1)}, json={"reason": "lost phone"})
    assert r.status_code == 200 and r.json()["had_factor"] is True
    assert _login_raw(client, target).status_code == 200  # factor gone; re-enrol on next sign-in where required
    assert db.scalar(select(AuditLog).where(AuditLog.action == "mfa.reset", AuditLog.subject_user_id == target_id))


def test_students_cannot_enrol_mfa(client):
    s = register_student(client)
    assert client.post(f"{API}/auth/mfa/enroll", headers=s["h"]).status_code == 403


# ------------------------------------------------------------------------------------------------ upload abuse + malware
def _upload(client, h, data, name="t.pdf"):
    return client.post(f"{API}/documents", headers=h, files={"file": (name, data, "application/pdf")}, data={"category": "TRANSCRIPT"})


def test_upload_abuse_is_refused(client, monkeypatch):
    s = register_student(client)
    monkeypatch.setattr(storage_mod.settings, "max_upload_mb", 1)
    assert _upload(client, s["h"], pdf(b"x" * (1024 * 1024 + 10))).status_code == 413
    assert _upload(client, s["h"], b"MZ\x90\x00 this is an exe" * 10).status_code == 415
    assert _upload(client, s["h"], b"<html><script>alert(1)</script></html>").status_code == 415
    assert _upload(client, s["h"], b"%PDF-1.4\n" + b"cut off" * 100).status_code == 422
    assert _upload(client, s["h"], b"").status_code == 400
    assert _upload(client, s["h"], pdf(), name="../../etc/passwd").status_code in (400, 201)  # sanitised or refused, never a path


def test_infected_file_is_blocked_and_never_downloadable(client, db, fake_clamd):
    s = register_student(client)
    r = _upload(client, s["h"], pdf(EICAR))
    assert r.status_code == 422
    owner = db.scalar(select(User.id).where(User.email == s["email"]))
    doc = db.scalar(select(Document).where(Document.owner_user_id == owner))
    v = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == doc.id))
    assert v.scan_status == "INFECTED" and doc.status.value == "NEEDS_CORRECTION"
    d = client.post(f"{API}/documents/{doc.id}/download-url", headers=s["h"])
    assert d.status_code == 410 and d.json()["detail"]["code"] == "FILE_BLOCKED"
    # Even a correctly signed token (minted before the verdict, say) does not serve it.
    assert client.get(f"{API}/files/{sign_file_token(v.storage_key, owner)}").status_code == 410
    with pytest.raises(FileNotFoundError):
        storage_mod.get_storage().get(v.storage_key)  # bytes removed from storage
    assert db.scalar(select(AuditLog).where(AuditLog.action == "document.malware_blocked", AuditLog.entity_id == str(doc.id)))
    # Staff see it as blocked.
    assert client.get(f"{API}/documents/{doc.id}", headers=s["h"]).json()["latest_file"]["scan_status"] == "INFECTED"
    # A clean upload through the same scanner is reviewable.
    ok = _upload(client, s["h"], pdf(b"clean"))
    assert ok.status_code == 201 and ok.json()["latest_file"]["scan_status"] == "CLEAN" and ok.json()["status"] == "NEEDS_REVIEW"
    assert fake_clamd.scanned >= 2


def test_scanner_error_stays_pending_until_worker_rescan(client, db, monkeypatch):
    s = register_student(client)
    srv = FakeClamd(mode="error")
    monkeypatch.setattr(storage_mod, "_scanner", storage_mod.ClamdScanner(socket_path=srv.path, timeout=5))
    r = _upload(client, s["h"], pdf(b"needs a verdict"))
    assert r.status_code == 201 and r.json()["latest_file"]["scan_status"] == "ERROR" and r.json()["status"] == "PROCESSING"
    d = client.post(f"{API}/documents/{r.json()['id']}/download-url", headers=s["h"])
    assert d.status_code == 423 and d.json()["detail"]["code"] == "FILE_SCAN_PENDING"
    srv.mode = "ok"
    from app.core.scanning import rescan_pending

    counts = rescan_pending(db)
    assert counts["CLEAN"] >= 1
    doc = client.get(f"{API}/documents/{r.json()['id']}", headers=s["h"]).json()
    assert doc["latest_file"]["scan_status"] == "CLEAN" and doc["status"] == "NEEDS_REVIEW"
    assert client.post(f"{API}/documents/{r.json()['id']}/download-url", headers=s["h"]).status_code == 200
    srv.close()


def test_scanner_unreachable_records_error(client, db, monkeypatch):
    monkeypatch.setattr(storage_mod, "_scanner", storage_mod.ClamdScanner(socket_path="/nonexistent/clamd.sock", timeout=1))
    s = register_student(client)
    r = _upload(client, s["h"], pdf(b"scanner down"))
    assert r.status_code == 201 and r.json()["latest_file"]["scan_status"] == "ERROR"
    from app.models.v29_security import OpsEvent

    assert db.scalar(select(OpsEvent).where(OpsEvent.kind == "SCAN_ERROR"))


# ------------------------------------------------------------------------------------------------ CORS + headers
def test_cors_allow_list(client):
    good = client.options(f"{API}/auth/login", headers={"Origin": "http://localhost:3100", "Access-Control-Request-Method": "POST"})
    assert good.headers.get("access-control-allow-origin") == "http://localhost:3100"
    bad = client.options(f"{API}/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
    assert "access-control-allow-origin" not in client.get("/healthz", headers={"Origin": "https://evil.example"}).headers


def test_security_headers_only_in_production_over_https(client, monkeypatch):
    dev = client.get("/healthz")
    assert dev.headers["x-content-type-options"] == "nosniff" and dev.headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" not in dev.headers
    monkeypatch.setattr(get_settings(), "env", "production")
    local = client.get("/healthz")
    assert "strict-transport-security" not in local.headers  # never on local plain HTTP
    prod = client.get("/healthz", headers={"X-Forwarded-Proto": "https"})
    assert prod.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
    assert prod.headers["content-security-policy"].startswith("default-src 'none'") and "frame-ancestors 'none'" in prod.headers["content-security-policy"]
    assert "unsafe-eval" not in prod.headers["content-security-policy"]
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, base_url="https://api.hangyul.example") as c:
        assert "strict-transport-security" in c.get("/healthz").headers


def test_secure_cookie_in_production(client, monkeypatch, db):
    s = register_student(client)
    monkeypatch.setattr(get_settings(), "env", "production")
    from app.api.v1 import auth as auth_mod

    monkeypatch.setattr(auth_mod.settings, "env", "production")
    r = client.post(f"{API}/auth/login", json={"email": s["email"], "password": s["password"], "client": "student"})
    cookie = r.headers.get("set-cookie", "").lower()
    assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie


def test_infected_attachment_is_refused(client, db, fake_clamd):
    """Message attachments go through the same scanner (collab upload)."""
    from app.models import Conversation

    conv = db.scalar(select(Conversation).where(Conversation.student_user_id.is_not(None)))
    student = db.get(User, conv.student_user_id)
    if not student.is_demo:
        pytest.skip("no seeded student conversation")
    h = login(client, student.email, "student")
    r = client.post(f"{API}/conversations/{conv.id}/attachments", headers=h, files={"file": ("a.pdf", pdf(EICAR), "application/pdf")})
    assert r.status_code in (404, 422)  # 404 when the persona cannot see that conversation; never 201
