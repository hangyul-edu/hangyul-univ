"""V10: `GET /auth/session-hint` — the public marketing site asking "is this browser signed in as a student?".

The endpoint exists so the public header can read "Login" or "Continue my journey" and so a personalised link can
decide whether it needs a `?next=` detour through the login page (REPORT §68.5). The properties that matter:

* it must **never rotate** the refresh token — a marketing page load happens on every navigation, and rotating
  there would either consume the student's session or trip the reuse detector in `/auth/refresh`;
* it must be per-client, so an agency cookie never makes the student site look signed in;
* it must answer honestly for an anonymous visitor, a revoked session and an expired one.
"""
from datetime import timedelta

from sqlalchemy import select

from app.models import RefreshToken
from app.models.base import utcnow
from tests.conftest import PASSWORD

HINT = "/api/v1/auth/session-hint"


def _login(client, email: str, as_client: str = "student"):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD, "client": as_client})
    assert r.status_code == 200, r.text
    return r.json()


def test_anonymous_visitor_is_not_authenticated(client):
    client.cookies.clear()
    r = client.get(HINT, params={"client": "student"})
    assert r.status_code == 200
    assert r.json() == {"authenticated": False, "name": None}


def test_signed_in_student_is_recognised_without_rotating_the_token(client, db):
    client.cookies.clear()
    _login(client, "student04@demo.hangyul.kr")
    cookie = client.cookies.get("hg_rt_student")
    assert cookie

    before = db.scalar(select(RefreshToken).where(RefreshToken.token_hash.isnot(None)).order_by(RefreshToken.created_at.desc()))
    issued_before = db.query(RefreshToken).count()

    r = client.get(HINT, params={"client": "student"})
    assert r.status_code == 200
    body = r.json()
    assert body["authenticated"] is True
    assert body["name"]

    # The whole point: no new token, no revocation, and the browser's cookie is untouched.
    db.expire_all()
    assert db.query(RefreshToken).count() == issued_before
    assert client.cookies.get("hg_rt_student") == cookie
    if before is not None:
        db.refresh(before)
        assert before.revoked_at is None

    # And the real refresh still works afterwards — the hint did not consume the session.
    assert client.post("/api/v1/auth/refresh", json={"client": "student"}).status_code == 200
    client.cookies.clear()


def test_hint_is_per_client(client):
    """An agency console cookie must not make the public student site look signed in."""
    client.cookies.clear()
    _login(client, "counselor@lotus.demo.hangyul.kr", as_client="agency")
    assert client.get(HINT, params={"client": "agency"}).json()["authenticated"] is True
    assert client.get(HINT, params={"client": "student"}).json()["authenticated"] is False
    client.cookies.clear()


def test_revoked_and_expired_sessions_report_anonymous(client, db):
    client.cookies.clear()
    _login(client, "student05@demo.hangyul.kr")
    assert client.get(HINT, params={"client": "student"}).json()["authenticated"] is True

    rt = db.scalars(select(RefreshToken).where(RefreshToken.revoked_at.is_(None)).order_by(RefreshToken.created_at.desc())).first()
    rt.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get(HINT, params={"client": "student"}).json()["authenticated"] is False

    rt.expires_at = utcnow() + timedelta(days=1)
    rt.revoked_at = utcnow()
    db.commit()
    assert client.get(HINT, params={"client": "student"}).json()["authenticated"] is False
    client.cookies.clear()


def test_a_forged_cookie_is_not_accepted(client):
    client.cookies.clear()
    client.cookies.set("hg_rt_student", "not-a-real-token", path="/api/v1/auth")
    assert client.get(HINT, params={"client": "student"}).json() == {"authenticated": False, "name": None}
    client.cookies.clear()
