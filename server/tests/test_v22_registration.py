"""V22 — registration, verification, consent, password confirmation, CAPTCHA (REPORT §244–245, §254)."""
import uuid

import pytest

from app.core.config import get_settings
from app.models import ConsentRecord, User, VerificationChallenge
from app.services import ratelimit
from tests.v22_helpers import API, register_student, signup_session, verify


def _send(client, sess, channel, target, country=None):
    return client.post(f"{API}/auth/verification/send", headers=sess, json={"channel": channel, "target": target, "phone_country": country, "purpose": "SIGNUP", "locale": "en"})


def test_full_flow_creates_verified_account(client, db):
    reg = register_student(client, nationality="NP", phone_country="NP", marketing=False)
    u = db.query(User).filter(User.email == reg["email"]).one()
    assert u.email_verified_at is not None and u.phone_verified_at is not None
    assert u.phone.startswith("+977") and u.phone == reg["body"]["user"].get("phone", u.phone)
    assert reg["body"]["verified"] == {"email": True, "phone": True}
    rows = db.query(ConsentRecord).filter(ConsentRecord.user_id == u.id).all()
    by = {r.purpose: r for r in rows}
    assert set(by) == {"TERMS", "PRIVACY", "CROSS_BORDER_VERIFICATION", "MARKETING"}
    assert by["MARKETING"].granted is False and by["TERMS"].granted is True
    for r in rows:
        assert r.document_version and r.locale == "en" and r.ip_hash and r.source == "SIGNUP" and r.version == r.document_version
    # both challenges are spent and bound to the user
    chs = db.query(VerificationChallenge).filter(VerificationChallenge.user_id == u.id).all()
    assert len(chs) == 2 and all(c.used_at is not None and c.consumed_at is not None for c in chs)


def test_register_requires_signup_session(client):
    r = client.post(f"{API}/auth/register", json={"email": "x@example.com", "phone": "0912345678", "password": "correct horse battery",
                                                 "password_confirm": "correct horse battery", "full_name": "X", "consents": {}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "SIGNUP_SESSION_REQUIRED"


def test_register_without_email_proof_is_refused(client):
    sess = signup_session(client)
    email = f"v22-noproof-{uuid.uuid4().hex[:8]}@example.com"
    pp = verify(client, sess, "SMS", "0912345111", "VN")
    r = client.post(f"{API}/auth/register", headers=sess, json={"email": email, "phone": "0912345111", "phone_country": "VN", "phone_proof": pp,
                                                              "password": "correct horse battery", "password_confirm": "correct horse battery", "full_name": "X",
                                                              "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"


def test_register_without_phone_proof_is_refused(client):
    sess = signup_session(client)
    email = f"v22-nophone-{uuid.uuid4().hex[:8]}@example.com"
    ep = verify(client, sess, "EMAIL", email)
    r = client.post(f"{API}/auth/register", headers=sess, json={"email": email, "email_proof": ep, "phone": "0912345112", "phone_country": "VN",
                                                              "password": "correct horse battery", "password_confirm": "correct horse battery", "full_name": "X",
                                                              "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "PHONE_NOT_VERIFIED"


def test_proof_is_bound_to_the_verified_value(client):
    sess = signup_session(client)
    email = f"v22-bound-{uuid.uuid4().hex[:8]}@example.com"
    ep = verify(client, sess, "EMAIL", email)
    pp = verify(client, sess, "SMS", "0912345113", "VN")
    other = f"v22-other-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/auth/register", headers=sess, json={"email": other, "email_proof": ep, "phone": "0912345113", "phone_country": "VN", "phone_proof": pp,
                                                              "password": "correct horse battery", "password_confirm": "correct horse battery", "full_name": "X",
                                                              "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "VERIFICATION_MISMATCH"


def test_password_confirmation_must_match(client):
    sess = signup_session(client)
    email = f"v22-pw-{uuid.uuid4().hex[:8]}@example.com"
    ep = verify(client, sess, "EMAIL", email)
    pp = verify(client, sess, "SMS", "0912345114", "VN")
    r = client.post(f"{API}/auth/register", headers=sess, json={"email": email, "email_proof": ep, "phone": "0912345114", "phone_country": "VN", "phone_proof": pp,
                                                              "password": "correct horse battery", "password_confirm": "correct horse batteries", "full_name": "X",
                                                              "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "PASSWORD_MISMATCH"


def test_required_consents_required_and_optional_optional(client):
    sess = signup_session(client)
    email = f"v22-consent-{uuid.uuid4().hex[:8]}@example.com"
    ep = verify(client, sess, "EMAIL", email)
    pp = verify(client, sess, "SMS", "0912345115", "VN")
    base = {"email": email, "email_proof": ep, "phone": "0912345115", "phone_country": "VN", "phone_proof": pp,
            "password": "correct horse battery", "password_confirm": "correct horse battery", "full_name": "X"}
    r = client.post(f"{API}/auth/register", headers=sess, json={**base, "consents": {"TERMS": True, "PRIVACY": True, "MARKETING": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CONSENT_REQUIRED" and r.json()["detail"]["keys"] == ["CROSS_BORDER_VERIFICATION"]
    r = client.post(f"{API}/auth/register", headers=sess, json={**base, "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True, "BOGUS": True}})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CONSENT_UNKNOWN"
    # optional marketing absent → still 201
    r = client.post(f"{API}/auth/register", headers=sess, json={**base, "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}})
    assert r.status_code == 201, r.text


def test_email_is_normalised_and_duplicates_do_not_disclose(client, db):
    reg = register_student(client)
    # the registration sent a code to this address seconds ago; age it past the resend cooldown
    from datetime import timedelta
    for ch in db.query(VerificationChallenge).filter(VerificationChallenge.target == reg["email"]).all():
        ch.created_at = ch.created_at - timedelta(seconds=90)
    db.commit()
    sess = signup_session(client)
    spaced = f"  {reg['email'].upper()}  "
    a = _send(client, sess, "EMAIL", spaced)
    fresh = _send(client, sess, "EMAIL", f"v22-fresh-{uuid.uuid4().hex[:8]}@example.com")
    assert a.status_code == 200 and fresh.status_code == 200
    assert set(a.json()) == set(fresh.json()), "a registered address must get an indistinguishable response"
    # the challenge for the registered address can never verify
    ch = db.get(VerificationChallenge, uuid.UUID(a.json()["challenge_id"]))
    assert ch.target == reg["email"] and ch.invalidated_at is not None
    assert client.get(f"{API}/auth/verification/peek/{ch.id}").status_code == 404
    r = client.post(f"{API}/auth/verification/verify", json={"challenge_id": str(ch.id), "code": "000000"})
    assert r.status_code == 400 and r.json()["detail"]["code"] in ("CODE_EXPIRED", "CODE_INVALID")


def test_invalid_email_and_phone_are_rejected_with_codes(client):
    sess = signup_session(client)
    assert _send(client, sess, "EMAIL", "not-an-email").json()["detail"]["code"] == "EMAIL_INVALID"
    assert _send(client, sess, "SMS", "12", "VN").json()["detail"]["code"] == "PHONE_INVALID"


@pytest.mark.parametrize("raw,country,e164", [
    ("0912 345 678", "VN", "+84912345678"), ("98-4123-4567", "NP", "+9779841234567"), ("09771234567", "MM", "+959771234567"),
    ("(415) 555-2672", "US", "+14155552672"), ("+1 415 555 2671", None, "+14155552671"), ("00977 9841234568", None, "+9779841234568"),
    ("010-1234-5678", "KR", "+821012345678"), ("90 123 45 67", "UZ", "+998901234567"),
])
def test_phone_normalisation_to_e164(client, db, raw, country, e164):
    sess = signup_session(client)
    r = _send(client, sess, "SMS", raw, country)
    assert r.status_code == 200, r.text
    ch = db.get(VerificationChallenge, uuid.UUID(r.json()["challenge_id"]))
    assert ch.target == e164


def test_wrong_code_counts_and_exhausts(client, db):
    sess = signup_session(client)
    r = _send(client, sess, "EMAIL", f"v22-wrong-{uuid.uuid4().hex[:8]}@example.com")
    cid = r.json()["challenge_id"]
    code = client.get(f"{API}/auth/verification/peek/{cid}").json()["code"]
    bad = "000000" if code != "000000" else "111111"
    for left in (4, 3, 2, 1):
        v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": bad})
        assert v.status_code == 400 and v.json()["detail"]["code"] == "CODE_INVALID" and v.json()["detail"]["attempts_left"] == left
    v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": bad})
    assert v.json()["detail"]["code"] == "TOO_MANY_ATTEMPTS"
    # even the right code is dead now
    v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": code})
    assert v.json()["detail"]["code"] == "CODE_EXPIRED"


def test_code_expiry_and_new_code_invalidates_old(client, db, monkeypatch):
    sess = signup_session(client)
    email = f"v22-exp-{uuid.uuid4().hex[:8]}@example.com"
    r1 = _send(client, sess, "EMAIL", email)
    cid1 = r1.json()["challenge_id"]
    code1 = client.get(f"{API}/auth/verification/peek/{cid1}").json()["code"]
    # resend inside the cooldown is refused
    r2 = _send(client, sess, "EMAIL", email)
    assert r2.status_code == 429 and r2.json()["detail"]["code"] == "OTP_RESEND_TOO_SOON" and "Retry-After" in r2.headers
    # move the first challenge back in time past the cooldown, then a new send must kill it
    from datetime import timedelta
    ch1 = db.get(VerificationChallenge, uuid.UUID(cid1))
    ch1.created_at = ch1.created_at - timedelta(seconds=90)
    db.commit()
    r3 = _send(client, sess, "EMAIL", email)
    assert r3.status_code == 200
    db.expire_all()
    assert db.get(VerificationChallenge, uuid.UUID(cid1)).invalidated_at is not None
    v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid1, "code": code1})
    assert v.json()["detail"]["code"] == "CODE_EXPIRED"
    # expiry: push the new one past its TTL
    cid3 = r3.json()["challenge_id"]
    code3 = client.get(f"{API}/auth/verification/peek/{cid3}").json()["code"]
    ch3 = db.get(VerificationChallenge, uuid.UUID(cid3))
    ch3.expires_at = ch3.created_at - timedelta(seconds=1)
    db.commit()
    v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid3, "code": code3})
    assert v.json()["detail"]["code"] == "CODE_EXPIRED"


def test_proof_is_single_use(client):
    sess = signup_session(client)
    email = f"v22-once-{uuid.uuid4().hex[:8]}@example.com"
    ep = verify(client, sess, "EMAIL", email)
    pp = verify(client, sess, "SMS", "0912345116", "VN")
    body = {"email": email, "email_proof": ep, "phone": "0912345116", "phone_country": "VN", "phone_proof": pp,
            "password": "correct horse battery", "password_confirm": "correct horse battery", "full_name": "X",
            "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True}}
    assert client.post(f"{API}/auth/register", headers=sess, json=body).status_code == 201
    # same proofs again → the email is taken, but even a different email cannot reuse the phone proof
    r = client.post(f"{API}/auth/register", headers=sess, json={**body, "email": f"v22-once2-{uuid.uuid4().hex[:6]}@example.com"})
    assert r.status_code == 400 and r.json()["detail"]["code"] in ("VERIFICATION_MISMATCH", "VERIFICATION_EXPIRED")


def test_no_code_in_db_or_response_and_hash_only(client, db):
    sess = signup_session(client)
    r = _send(client, sess, "EMAIL", f"v22-hash-{uuid.uuid4().hex[:8]}@example.com")
    body = r.json()
    ch = db.get(VerificationChallenge, uuid.UUID(body["challenge_id"]))
    code = client.get(f"{API}/auth/verification/peek/{ch.id}").json()["code"]
    assert code not in str(body) and code not in ch.code_hash and len(ch.code_hash) == 64


def test_captcha_required_in_production_mode(client, monkeypatch):
    """Production without Turnstile keys cannot open a signup session at all; with keys, no token → 400."""
    s = get_settings()
    monkeypatch.setattr(type(s), "is_production", property(lambda self: True))
    r = client.post(f"{API}/auth/signup/session", json={"captcha_token": None})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "CAPTCHA_NOT_CONFIGURED"
    monkeypatch.setattr(s, "turnstile_site_key", "1x00000000000000000000AA")
    monkeypatch.setattr(s, "turnstile_secret_key", "2x0000000000000000000000000000000AA")  # Cloudflare's always-fail secret
    r = client.post(f"{API}/auth/signup/session", json={"captcha_token": None})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED"
    r = client.post(f"{API}/auth/signup/session", json={"captcha_token": "anything"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_FAILED"
    monkeypatch.setattr(s, "turnstile_secret_key", "1x0000000000000000000000000000000AA")  # always-pass
    r = client.post(f"{API}/auth/signup/session", json={"captcha_token": "XXXX.DUMMY.TOKEN"})
    assert r.status_code == 200 and "signup_session" in r.json()
    # the peek route does not exist in production
    assert client.get(f"{API}/auth/verification/peek/{uuid.uuid4()}").status_code == 404


def test_signup_config_is_public_and_secret_free(client):
    r = client.get(f"{API}/auth/signup/config")
    assert r.status_code == 200
    body = r.json()
    keys = {i["key"]: i for i in body["consents"]["items"]}
    assert keys["TERMS"]["required"] and keys["PRIVACY"]["required"] and keys["CROSS_BORDER_VERIFICATION"]["required"] and not keys["MARKETING"]["required"]
    assert body["otp"]["ttl_seconds"] == 300 and body["otp"]["resend_cooldown_seconds"] == 60 and body["otp"]["max_attempts"] == 5
    assert "secret" not in str(body).lower()


def test_contact_change_requires_fresh_verification(client, db):
    reg = register_student(client)
    h = reg["h"]
    r = client.post(f"{API}/auth/contact/phone", headers=h, json={"phone": "0912345999", "phone_country": "VN"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "PHONE_NOT_VERIFIED"
    proof = verify(client, {}, "SMS", "0912345999", "VN", purpose="CONTACT", auth=h)
    r = client.post(f"{API}/auth/contact/phone", headers=h, json={"phone": "0912345999", "phone_country": "VN", "proof": proof})
    assert r.status_code == 200 and r.json() == {"phone": "+84912345999", "phone_verified": True}
    u = db.query(User).filter(User.email == reg["email"]).one()
    db.refresh(u)
    assert u.phone == "+84912345999" and u.phone_verified_at is not None
    # email: a taken address is refused even with a proof-shaped request
    other = register_student(client)
    r = client.post(f"{API}/auth/contact/email", headers=h, json={"email": other["email"], "proof": "x"})
    assert r.status_code == 400  # proof invalid before uniqueness is even consulted
    new_email = f"v22-new-{uuid.uuid4().hex[:8]}@example.com"
    proof = verify(client, {}, "EMAIL", new_email, purpose="CONTACT", auth=h)
    r = client.post(f"{API}/auth/contact/email", headers=h, json={"email": new_email, "proof": proof})
    assert r.status_code == 200 and r.json()["email_verified"] is True


def test_forgot_and_reset_password(client):
    reg = register_student(client)
    r = client.post(f"{API}/auth/forgot-password", json={"email": reg["email"]})
    assert r.status_code == 202 and r.json()["accepted"] is True
    cid = r.json()["challenge_id"]
    code = client.get(f"{API}/auth/verification/peek/{cid}").json()["code"]
    bad = client.post(f"{API}/auth/reset-password", json={"challenge_id": cid, "code": code, "new_password": "a brand new password", "new_password_confirm": "different"})
    assert bad.json()["detail"]["code"] == "PASSWORD_MISMATCH"
    ok = client.post(f"{API}/auth/reset-password", json={"challenge_id": cid, "code": code, "new_password": "a brand new password", "new_password_confirm": "a brand new password"})
    assert ok.status_code == 200
    assert client.post(f"{API}/auth/login", json={"email": reg["email"], "password": reg["password"], "client": "student"}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": reg["email"], "password": "a brand new password", "client": "student"}).status_code == 200
    # unknown address: same 202, a decoy handle, nothing to peek
    r = client.post(f"{API}/auth/forgot-password", json={"email": f"nobody-{uuid.uuid4().hex[:6]}@example.com"})
    assert r.status_code == 202 and set(r.json()) == {"accepted", "challenge_id"}
    assert client.get(f"{API}/auth/verification/peek/{r.json()['challenge_id']}").status_code == 404


def test_rate_limits_are_real(client, monkeypatch):
    """Scale back to 1 for this test only and hit the per-target send ceiling and the IP ceiling."""
    s = get_settings()
    monkeypatch.setattr(s, "ratelimit_scale", 1)
    ratelimit.reset_all()
    sess = signup_session(client)
    email = f"v22-rl-{uuid.uuid4().hex[:8]}@example.com"
    # the per-target limit is 5/hour; the cooldown is bypassed by ageing nothing — instead distinct emails per IP:
    seen = []
    for i in range(ratelimit.OTP_SEND_IP.limit + 1):
        r = _send(client, sess, "EMAIL", f"v22-rl{i}-{uuid.uuid4().hex[:6]}@example.com")
        seen.append(r.status_code)
    assert seen[: ratelimit.OTP_SEND_IP.limit] == [200] * ratelimit.OTP_SEND_IP.limit and seen[-1] == 429
    ratelimit.reset_all()
    # verify brute force per IP
    r = _send(client, sess, "EMAIL", email)
    cid = r.json()["challenge_id"]
    codes = []
    for i in range(ratelimit.OTP_VERIFY_IP.limit + 1):
        v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": f"{i:06d}"})
        codes.append(v.json()["detail"]["code"])
    assert "OTP_VERIFY_LIMITED" in codes and codes.index("TOO_MANY_ATTEMPTS") < codes.index("OTP_VERIFY_LIMITED")
    ratelimit.reset_all()
    # login: 5 failures → CAPTCHA escalation when Turnstile is configured, progressive throttle at 20
    monkeypatch.setattr(s, "turnstile_site_key", "1x00000000000000000000AA")
    monkeypatch.setattr(s, "turnstile_secret_key", "1x0000000000000000000000000000000AA")
    victim = f"v22-login-{uuid.uuid4().hex[:6]}@example.com"
    for _ in range(ratelimit.LOGIN_EMAIL_FAIL.limit):
        assert client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student"}).status_code == 401
    r = client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED"
    r = client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student", "captcha_token": "XXXX.DUMMY"})
    assert r.status_code == 401  # captcha accepted, credentials still wrong
    for _ in range(ratelimit.LOGIN_EMAIL_HARD.limit):
        client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student", "captcha_token": "XXXX.DUMMY"})
    r = client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student", "captcha_token": "XXXX.DUMMY"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "LOGIN_THROTTLED" and int(r.headers["Retry-After"]) >= 30
    ratelimit.reset_all()
    monkeypatch.setattr(s, "turnstile_site_key", None)
    monkeypatch.setattr(s, "turnstile_secret_key", None)
    # register per IP
    for i in range(ratelimit.REGISTER_IP.limit):
        ratelimit.hit(ratelimit.REGISTER_IP, ratelimit.hash_id("testclient"))
    sess = signup_session(client)
    r = client.post(f"{API}/auth/register", headers=sess, json={"email": "x@example.com", "phone": "0912345678", "password": "correct horse battery",
                                                              "password_confirm": "correct horse battery", "full_name": "X", "consents": {}})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "REGISTER_LIMITED"
    ratelimit.reset_all()
    # forgot password per email
    for _ in range(ratelimit.FORGOT_EMAIL.limit):
        client.post(f"{API}/auth/forgot-password", json={"email": victim})
    r = client.post(f"{API}/auth/forgot-password", json={"email": victim})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "FORGOT_LIMITED"
    ratelimit.reset_all()


def test_security_events_recorded(client, db, monkeypatch):
    from app.models import AuthSecurityEvent
    s = get_settings()
    monkeypatch.setattr(s, "ratelimit_scale", 1)
    ratelimit.reset_all()
    victim = f"v22-sec-{uuid.uuid4().hex[:6]}@example.com"
    for _ in range(ratelimit.LOGIN_EMAIL_HARD.limit + 1):
        client.post(f"{API}/auth/login", json={"email": victim, "password": "wrong-password", "client": "student"})
    from app.services.identity import target_hash
    ev = db.query(AuthSecurityEvent).filter(AuthSecurityEvent.email_hash == target_hash(victim)).all()
    assert any(e.kind == "login_throttled" for e in ev)
    assert all(victim not in str(e.detail) for e in ev)
    ratelimit.reset_all()
