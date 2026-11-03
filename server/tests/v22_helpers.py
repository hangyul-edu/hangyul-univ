"""V22 test helpers: drive the real four-step registration without a provider (REPORT §244 R9)."""
import uuid

API = "/api/v1"


def signup_session(client) -> dict:
    r = client.post(f"{API}/auth/signup/session", json={"captcha_token": None, "locale": "en"})
    assert r.status_code == 200, r.text
    return {"X-Signup-Session": r.json()["signup_session"]}


def verify(client, sess: dict, channel: str, target: str, phone_country: str | None = None, purpose: str = "SIGNUP", auth: dict | None = None) -> str:
    """Send a code, read it through the dev-only peek route, verify it, return the proof."""
    headers = {**sess, **(auth or {})}
    r = client.post(f"{API}/auth/verification/send", headers=headers,
                    json={"channel": channel, "target": target, "phone_country": phone_country, "purpose": purpose, "locale": "en"})
    assert r.status_code == 200, r.text
    cid = r.json()["challenge_id"]
    code = client.get(f"{API}/auth/verification/peek/{cid}").json()["code"]
    v = client.post(f"{API}/auth/verification/verify", json={"challenge_id": cid, "code": code})
    assert v.status_code == 200, v.text
    return v.json()["proof"]


def register_student(client, *, email: str | None = None, password: str = "correct horse battery", full_name: str = "Test Student",
                     locale: str = "en", nationality: str = "VN", phone: str | None = None, phone_country: str | None = None,
                     marketing: bool = False) -> dict:
    email = email or f"v22-{uuid.uuid4().hex[:10]}@example.com"
    phone_country = phone_country or nationality
    phone = phone or _phone_for(phone_country)
    sess = signup_session(client)
    ep = verify(client, sess, "EMAIL", email)
    pp = verify(client, sess, "SMS", phone, phone_country)
    r = client.post(f"{API}/auth/register", headers=sess, json={
        "email": email, "email_proof": ep, "phone": phone, "phone_country": phone_country, "phone_proof": pp,
        "password": password, "password_confirm": password, "full_name": full_name, "locale": locale, "nationality": nationality,
        "consents": {"TERMS": True, "PRIVACY": True, "CROSS_BORDER_VERIFICATION": True, "MARKETING": marketing},
    })
    assert r.status_code == 201, r.text
    body = r.json()
    return {"email": email, "phone": phone, "password": password, "h": {"Authorization": f"Bearer {body['access_token']}"}, "body": body}


_SAMPLE = {"VN": "0912{n:06d}", "NP": "98{n:08d}", "MM": "09{n:09d}", "US": "415555{n:04d}", "UZ": "90{n:07d}", "KR": "010{n:08d}", "ID": "0812{n:08d}"}


def _phone_for(country: str) -> str:
    n = int(uuid.uuid4().hex[:6], 16) % 10**9
    tmpl = _SAMPLE.get(country, _SAMPLE["US"])
    width = int(tmpl[tmpl.index(":") + 1:tmpl.index("d}")])
    return tmpl.format(n=n % (10 ** width))
