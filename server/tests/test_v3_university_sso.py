"""SSO (OIDC) against a fake identity provider: real RS256 ID tokens and JWKS, PKCE, state and nonce checks,
just-in-time membership, and the resulting normal session."""
import base64
import hashlib
import time
from urllib.parse import parse_qs, urlparse

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import select

from app.core import sso as sso_core
from app.core.db import SessionLocal
from app.models import Organization, OrganizationMember, OrgSSOConfig, SSOLoginState, University, User

ISSUER = "https://idp.example.test"
CLIENT_ID = "hangyul-univ-console"
DOMAIN = "pnu-sso.example.test"

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_JWK = jwt.algorithms.RSAAlgorithm.to_jwk(_KEY.public_key(), as_dict=True) | {"kid": "k1", "use": "sig", "alg": "RS256"}


class _Resp:
    def __init__(self, data):
        self._d = data

    def raise_for_status(self):
        return None

    def json(self):
        return self._d


class FakeIdP:
    """Remembers the last authorization request so the token response can echo its nonce (or tamper with it)."""

    def __init__(self):
        self.nonce = None
        self.challenge = None
        self.email = f"new.reviewer@{DOMAIN}"
        self.tamper_nonce = False
        self.seen_verifier = None

    def get(self, url, timeout=None):
        if url.endswith("/.well-known/openid-configuration"):
            return _Resp({"issuer": ISSUER, "authorization_endpoint": f"{ISSUER}/authorize", "token_endpoint": f"{ISSUER}/token", "jwks_uri": f"{ISSUER}/jwks"})
        if url.endswith("/jwks"):
            return _Resp({"keys": [_JWK]})
        raise AssertionError(url)

    def post(self, url, data=None, timeout=None):
        assert url == f"{ISSUER}/token"
        self.seen_verifier = data["code_verifier"]
        now = int(time.time())
        claims = {"iss": ISSUER, "aud": CLIENT_ID, "sub": "idp-123", "email": self.email, "email_verified": True, "name": "New Reviewer",
                  "iat": now, "exp": now + 300, "nonce": "wrong" if self.tamper_nonce else self.nonce}
        return _Resp({"id_token": jwt.encode(claims, _KEY, algorithm="RS256", headers={"kid": "k1"}), "access_token": "x"})


@pytest.fixture()
def idp(monkeypatch):
    fake = FakeIdP()
    sso_core._DISCOVERY_CACHE.clear()
    sso_core._JWKS_CACHE.clear()
    monkeypatch.setattr(sso_core.httpx, "get", fake.get)
    monkeypatch.setattr(sso_core.httpx, "post", fake.post)
    monkeypatch.setenv("HG_TEST_SSO_SECRET", "s3cret")
    with SessionLocal() as db:
        org = db.scalar(select(Organization).join(University, University.id == Organization.university_id).where(University.slug == "pusan-national-university"))
        c = db.scalar(select(OrgSSOConfig).where(OrgSSOConfig.organization_id == org.id)) or OrgSSOConfig(organization_id=org.id)
        c.protocol, c.issuer, c.client_id, c.client_secret_ref = "OIDC", ISSUER, CLIENT_ID, "HG_TEST_SSO_SECRET"
        c.allowed_domains, c.default_role, c.enabled, c.enforce = [DOMAIN], "UNIVERSITY_ADMIN", True, False  # V22: the one university role
        db.add(c)
        db.commit()
        fake.org_id = org.id
    return fake


def _start(client, fake):
    r = client.get("/api/v1/sso/lookup", params={"email": f"someone@{DOMAIN}"})
    assert r.json()["sso"] is True and r.json()["available"] is True
    start = client.get(r.json()["start_url"] + "&client=university", follow_redirects=False)
    assert start.status_code == 302
    q = parse_qs(urlparse(start.headers["location"]).query)
    assert q["code_challenge_method"] == ["S256"] and q["client_id"] == [CLIENT_ID]
    fake.nonce, fake.challenge = q["nonce"][0], q["code_challenge"][0]
    return q["state"][0]


def test_oidc_login_provisions_membership_and_issues_a_session(client, idp):
    state = _start(client, idp)
    cb = client.get("/api/v1/sso/callback", params={"code": "abc", "state": state}, follow_redirects=False)
    assert cb.status_code == 302, cb.text
    # PKCE: the verifier sent to the token endpoint hashes to the challenge sent to the browser.
    digest = base64.urlsafe_b64encode(hashlib.sha256(idp.seen_verifier.encode()).digest()).rstrip(b"=").decode()
    assert digest == idp.challenge
    assert "hg_rt_university" in cb.headers.get("set-cookie", "")
    s = client.post("/api/v1/auth/refresh", json={"client": "university"})
    assert s.status_code == 200, s.text
    assert s.json()["user"]["email"] == idp.email
    assert s.json()["active_org"]["role"] == "UNIVERSITY_ADMIN"
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == idp.email))
        assert db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == u.id, OrganizationMember.organization_id == idp.org_id))
    # A state can be used once.
    again = client.get("/api/v1/sso/callback", params={"code": "abc", "state": state}, follow_redirects=False)
    assert again.status_code == 400


def test_oidc_rejects_bad_nonce_unknown_state_and_foreign_domain(client, idp):
    assert client.get("/api/v1/sso/callback", params={"code": "abc", "state": "never-issued"}, follow_redirects=False).status_code == 400
    idp.tamper_nonce = True
    state = _start(client, idp)
    assert client.get("/api/v1/sso/callback", params={"code": "abc", "state": state}, follow_redirects=False).status_code == 401
    idp.tamper_nonce = False
    idp.email = "intruder@elsewhere.example"
    state = _start(client, idp)
    assert client.get("/api/v1/sso/callback", params={"code": "abc", "state": state}, follow_redirects=False).status_code == 403
    with SessionLocal() as db:
        assert db.scalar(select(SSOLoginState).where(SSOLoginState.state == state)).error == "domain_not_allowed"


def test_config_requires_admin_and_never_stores_secrets(client, idp):
    from .conftest import login

    admin = login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
    # V22: every admin of the university manages SSO; a student (no organisation) cannot.
    reviewer = login(client, "reviewer@pusan.univ.demo.hangyul.kr", "university")
    assert client.get("/api/v1/sso/config", headers=reviewer).status_code == 200
    assert client.get("/api/v1/sso/config", headers=login(client, "student@demo.hangyul.kr", "student")).status_code == 403
    cfg = client.get("/api/v1/sso/config", headers=admin).json()
    assert cfg["client_secret_ref"] == "HG_TEST_SSO_SECRET" and cfg["client_secret_present"] is True
    assert "s3cret" not in str(cfg)
    ok = client.put("/api/v1/sso/config", headers=admin, json={**{k: cfg[k] for k in ("protocol", "issuer", "client_id", "client_secret_ref", "allowed_domains")},
                                                              "default_role": "UNIVERSITY_ADMIN", "enabled": True})
    assert ok.status_code == 200, ok.text  # V22: the one university permission is what SSO provisions
    assert client.get("/api/v1/sso/config", headers=admin).json()["default_role"] == "UNIVERSITY_ADMIN"
    assert client.put("/api/v1/sso/config", headers=admin, json={**{k: cfg[k] for k in ("protocol", "issuer", "client_id", "client_secret_ref", "allowed_domains")},
                                                                "default_role": "NOT_A_ROLE", "enabled": True}).status_code == 422
    # Enforced SSO blocks password sign-in for that domain's users only.
    with SessionLocal() as db:
        c = db.scalar(select(OrgSSOConfig).where(OrgSSOConfig.organization_id == idp.org_id))
        c.enforce = True
        db.commit()
    try:
        r = client.post("/api/v1/auth/login", json={"email": "admin@pusan.univ.demo.hangyul.kr", "password": "Hangyul!2026", "client": "university"})
        assert r.status_code == 200  # different domain
    finally:
        with SessionLocal() as db:
            c = db.scalar(select(OrgSSOConfig).where(OrgSSOConfig.organization_id == idp.org_id))
            c.enforce, c.enabled = False, False
            db.commit()
