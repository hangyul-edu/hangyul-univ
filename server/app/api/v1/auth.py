import secrets
import uuid
from datetime import date, timedelta

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import legal
from app.core.audit import audit, track
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import CLIENT_ALLOWED_ROLES, Principal, get_principal, load_principal
from app.core.security import JWT_LEEWAY_SECONDS, create_access_token, hash_password, hash_token, new_refresh_token, verify_password
from app.models import ConsentRecord, LoginEvent, RefreshToken, StudentProfile, User, UserRole
from app.models.base import utcnow
from app.models.enums import OrgType, Role, canonical_role
from app.services import captcha, mfa, ratelimit, verification
from app.services.identity import IdentityError, normalize_email, normalize_phone

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
Client = str  # "student" | "agency" | "university" | "marketing"
REUSE_GRACE_SECONDS = 20


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    client: Client = "student"
    org_id: uuid.UUID | None = None
    #: Present only after the server has answered `CAPTCHA_REQUIRED` for this account (V22, brief §73).
    captcha_token: str | None = None


class RefreshIn(BaseModel):
    client: Client = "student"
    refresh_token: str | None = None  # mobile clients send it in the body; web uses the httpOnly cookie


class RegisterIn(BaseModel):
    """V22 registration commit (REPORT §244). Everything before this call is verification; this is the one write."""
    email: str = Field(min_length=3, max_length=255)
    email_proof: str | None = None
    phone: str = Field(min_length=3, max_length=40)
    phone_country: str | None = Field(default=None, min_length=2, max_length=2)
    phone_proof: str | None = None
    password: str = Field(min_length=10, max_length=200)
    password_confirm: str = Field(min_length=1, max_length=200)
    full_name: str = Field(min_length=1, max_length=200)
    locale: str = "en"
    nationality: str | None = Field(default=None, min_length=2, max_length=2)
    #: Granular consents keyed by `app.core.legal.SIGNUP_CONSENTS`; every required key must be true.
    consents: dict[str, bool] = Field(default_factory=dict)


class SwitchOrgIn(BaseModel):
    org_id: uuid.UUID
    client: Client


def _sso_enforced(db: Session, email: str) -> bool:
    from app.api.v1.sso import config_for_email  # local import: sso imports this module

    c = config_for_email(db, email)
    return bool(c and c.enforce and c.protocol == "OIDC")


def cookie_name(client: str) -> str:
    return f"hg_rt_{client}"


def session_payload(db: Session, user: User, client: str, org_id: uuid.UUID | None) -> dict:
    p = load_principal(db, user, org_id, client)
    return {
        "user": {
            "id": str(user.id), "email": user.email, "full_name": user.full_name, "preferred_name": user.preferred_name,
            "locale": user.locale, "timezone": user.timezone, "is_demo": user.is_demo,
        },
        "roles": sorted({canonical_role(r).value for r in p.roles}),
        "memberships": [
            {"org_id": str(m.org_id), "org_type": m.org_type.value, "org_name": m.org_name, "role": canonical_role(m.role).value,
             "university_id": str(m.university_id) if m.university_id else None}
            for m in p.memberships
        ],
        "active_org": (
            {"org_id": str(p.active.org_id), "org_type": p.active.org_type.value, "org_name": p.active.org_name,
             "role": canonical_role(p.active.role).value, "university_id": str(p.active.university_id) if p.active.university_id else None}
            if p.active else None
        ),
        # V22: verification state, so a client can prompt for a missing phone without a second request.
        "verified": {"email": user.email_verified_at is not None, "phone": user.phone_verified_at is not None},
    }


def default_org_for_client(db: Session, user: User, client: str, requested: uuid.UUID | None) -> uuid.UUID | None:
    p = load_principal(db, user, None, client)
    allowed = CLIENT_ALLOWED_ROLES.get(client, set())
    if client in ("student", "marketing"):
        if Role.STUDENT not in p.global_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account cannot sign in to the student platform.")
        return None
    wanted_types = {"agency": {OrgType.AGENCY, OrgType.HANGYUL}, "university": {OrgType.UNIVERSITY, OrgType.HANGYUL}}[client]
    options = [m for m in p.memberships if m.org_type in wanted_types and m.role in allowed]
    if requested:
        options = [m for m in options if m.org_id == requested]
    if not options:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has no access to this console.")
    # Prefer a real tenant over the Hangyul org when the user belongs to both.
    options.sort(key=lambda m: m.org_type == OrgType.HANGYUL)
    return options[0].org_id


def issue_tokens(db: Session, response: Response, request: Request, user: User, client: str, org_id, family_id=None) -> dict:
    access, expires_in = create_access_token(user.id, client=client, org_id=org_id)
    raw, hashed = new_refresh_token()
    now = utcnow()
    rt = RefreshToken(
        user_id=user.id, token_hash=hashed, family_id=family_id or uuid.uuid4(), client=client, active_org_id=org_id,
        created_at=now, expires_at=now + timedelta(days=settings.refresh_token_days),
        user_agent=(request.headers.get("user-agent") or "")[:300], ip=request.client.host if request.client else None,
    )
    db.add(rt)
    db.flush()
    response.set_cookie(
        cookie_name(client), raw, httponly=True, samesite="lax", secure=settings.is_production,
        max_age=settings.refresh_token_days * 86400, path="/api/v1/auth",
    )
    return {"access_token": access, "token_type": "bearer", "expires_in": expires_in, "refresh_token": raw, "_rt": rt}


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _login_guard(db: Session, email: str, ip: str | None, client: str, captcha_token: str | None) -> None:
    """Progressive protection (brief §73): nothing for a normal user; a CAPTCHA after 5 failures on one account in
    15 minutes; a growing wait after 20; a per-address ceiling for credential stuffing. Nothing is ever locked
    permanently — every counter is a Redis key with a window."""
    s = get_settings()
    eh, iph = ratelimit.hash_id(email), ratelimit.hash_id(ip or "unknown")
    if ratelimit.peek(ratelimit.LOGIN_IP_FAIL, iph) >= ratelimit.LOGIN_IP_FAIL.limit * max(1, s.ratelimit_scale):
        verification.security_event(db, "login_ip_limited", email=email, ip=ip, client=client)
        db.commit()
        raise ratelimit.too_many(300, "LOGIN_LIMITED")
    hard = ratelimit.peek(ratelimit.LOGIN_EMAIL_HARD, eh)
    if hard >= ratelimit.LOGIN_EMAIL_HARD.limit * max(1, s.ratelimit_scale):
        wait = min(900, 30 * (2 ** min(6, hard - ratelimit.LOGIN_EMAIL_HARD.limit * max(1, s.ratelimit_scale))))
        verification.security_event(db, "login_throttled", email=email, ip=ip, client=client, detail={"wait": wait})
        db.commit()
        raise ratelimit.too_many(wait, "LOGIN_THROTTLED")
    soft = ratelimit.peek(ratelimit.LOGIN_EMAIL_FAIL, eh)
    if soft >= ratelimit.LOGIN_EMAIL_FAIL.limit * max(1, s.ratelimit_scale) and s.turnstile_configured:
        if not captcha_token:
            verification.security_event(db, "login_captcha_required", email=email, ip=ip, client=client)
            db.commit()
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, {"code": "CAPTCHA_REQUIRED", "captcha_required": True, "retry_after": 0},
                                headers={"Retry-After": "0"})
        captcha.verify_token(captcha_token, ip)


def _login_failed(db: Session, email: str, ip: str | None) -> None:
    eh, iph = ratelimit.hash_id(email), ratelimit.hash_id(ip or "unknown")
    ratelimit.hit(ratelimit.LOGIN_EMAIL_FAIL, eh)
    ratelimit.hit(ratelimit.LOGIN_EMAIL_HARD, eh)
    ratelimit.hit(ratelimit.LOGIN_IP_FAIL, iph)


def _login_succeeded(email: str) -> None:
    eh = ratelimit.hash_id(email)
    ratelimit.reset(ratelimit.LOGIN_EMAIL_FAIL, eh)
    ratelimit.reset(ratelimit.LOGIN_EMAIL_HARD, eh)


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    ip = _ip(request)
    _login_guard(db, email, ip, body.client, body.captcha_token)
    user = db.scalar(select(User).where(User.email == email))
    ok = bool(user and user.is_active and verify_password(body.password, user.password_hash))
    db.add(LoginEvent(user_id=user.id if user else None, email=email, success=ok, reason=None if ok else "bad_credentials",
                      client=body.client, ip=ip, user_agent=(request.headers.get("user-agent") or "")[:300], created_at=utcnow()))
    if not ok:
        _login_failed(db, email, ip)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    _login_succeeded(email)
    if body.client in ("university", "agency") and _sso_enforced(db, user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your organisation signs in with single sign-on. Use “Continue with your organisation account”.")
    org_id = default_org_for_client(db, user, body.client, body.org_id)
    # V29: staff second factor. Raises 401 MFA_REQUIRED (challenge token, no session) or 403 MFA_ENROLLMENT_REQUIRED
    # (enrol-only token) — in both cases before any access or refresh token exists.
    mfa.login_gate(db, user, client=body.client, org_id=org_id, ip=ip)
    user.last_login_at = utcnow()
    tokens = issue_tokens(db, response, request, user, body.client, org_id)
    tokens.pop("_rt")
    db.commit()
    return {**tokens, **session_payload(db, user, body.client, org_id)}


class DemoLoginIn(BaseModel):
    email: EmailStr
    client: Client = "student"


@router.post("/demo-login")
def demo_login(body: DemoLoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    """Development-only persona sign-in (Demo access). Seeded demo accounts only; refused in production."""
    if not settings.demo_logins_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not user.is_demo or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown demo persona")
    org_id = default_org_for_client(db, user, body.client, None)
    mfa.login_gate(db, user, client=body.client, org_id=org_id, ip=_ip(request))  # V29: no MFA bypass via demo access
    db.add(LoginEvent(user_id=user.id, email=user.email, success=True, reason="demo_access", client=body.client,
                      ip=request.client.host if request.client else None,
                      user_agent=(request.headers.get("user-agent") or "")[:300], created_at=utcnow()))
    user.last_login_at = utcnow()
    tokens = issue_tokens(db, response, request, user, body.client, org_id)
    tokens.pop("_rt")
    db.commit()
    return {**tokens, **session_payload(db, user, body.client, org_id)}


@router.post("/refresh")
def refresh(body: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    raw = body.refresh_token or request.cookies.get(cookie_name(body.client))
    if not raw:
        # Anonymous visitor: nothing to restore. 204 keeps browser consoles clean on public pages.
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    now = utcnow()
    if rt is None or rt.client != body.client:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    if rt.revoked_at is not None and rt.replaced_by is not None and (now - rt.revoked_at).total_seconds() < REUSE_GRACE_SECONDS:
        # Benign race: the page reloaded while a refresh was in flight, so the browser never stored the rotated cookie.
        # Allow the retry within a short window; only the newest token of the family stays valid.
        for t in db.scalars(select(RefreshToken).where(RefreshToken.family_id == rt.family_id, RefreshToken.revoked_at.is_(None))):
            t.revoked_at = now
    elif rt.revoked_at is not None:
        # Reuse of a rotated token outside the grace window → likely theft. Revoke the whole family.
        for t in db.scalars(select(RefreshToken).where(RefreshToken.family_id == rt.family_id, RefreshToken.revoked_at.is_(None))):
            t.revoked_at = now
        audit(db, action="auth.refresh_reuse_detected", entity_type="user", entity_id=rt.user_id, subject_user_id=rt.user_id)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    if rt.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    user = db.get(User, rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    if (rt.client in mfa.STAFF_CLIENTS and get_settings().staff_mfa_required_effective and mfa.is_staff(db, user.id)
            and not mfa.enabled(db, user.id)):
        # V29: a session from before MFA became mandatory (or after a reset) cannot be extended — sign in and enrol.
        rt.revoked_at = now
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    tokens = issue_tokens(db, response, request, user, rt.client, rt.active_org_id, family_id=rt.family_id)
    new_rt = tokens.pop("_rt")
    if rt.revoked_at is None:
        rt.revoked_at = now
    rt.replaced_by = new_rt.id
    db.commit()
    return {**tokens, **session_payload(db, user, rt.client, rt.active_org_id)}


@router.get("/session-hint")
def session_hint(request: Request, client: Client = "student", db: Session = Depends(get_db)):
    """V10: does a session for `client` already exist in this browser?

    The public marketing site is a separate origin from the Student Platform and signs nobody in, but it must know
    whether to offer "Login" or "Continue my journey", and whether a personalised link needs a `?next=` detour
    through the login page (REPORT §68.5).

    This is deliberately **not** `/refresh`: it issues no access token and rotates nothing, so a marketing page
    load can never consume a refresh token or trip the rotation-reuse detector. It only answers a question the
    caller could already answer by using the cookie it is holding, so it discloses nothing new.
    """
    raw = request.cookies.get(cookie_name(client))
    if not raw:
        return {"authenticated": False, "name": None}
    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if rt is None or rt.client != client or rt.revoked_at is not None or rt.expires_at < utcnow():
        return {"authenticated": False, "name": None}
    user = db.get(User, rt.user_id)
    if user is None or not user.is_active:
        return {"authenticated": False, "name": None}
    return {"authenticated": True, "name": user.preferred_name or user.full_name.split(" ")[-1]}


@router.post("/logout")
def logout(body: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    raw = body.refresh_token or request.cookies.get(cookie_name(body.client))
    if raw:
        rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
        if rt and rt.revoked_at is None:
            rt.revoked_at = utcnow()
            db.commit()
    response.delete_cookie(cookie_name(body.client), path="/api/v1/auth")
    return {"ok": True}


# ================================================================================================ V22 signup flow
#
#   1. POST /auth/signup/session     CAPTCHA proof → short-lived signed signup session (the ticket for steps 2–4)
#   2. POST /auth/verification/send  one-time code to an email address or an E.164 phone (SendGrid / Twilio)
#   3. POST /auth/verification/verify code → single-use proof bound to the verified value
#   4. POST /auth/register           both proofs + password + confirmation + granular consents → the account
#
# No account exists before step 4 succeeds, so there is no half-created or provisional user to clean up
# (brief §16). REPORT §244 and §253 record the design; `tests/test_v22_registration.py` the behaviour.


class SignupSessionIn(BaseModel):
    captcha_token: str | None = Field(default=None, max_length=2048)
    locale: str = "en"


def _signup_session_hash(token: str) -> str:
    return hash_token(token)


def require_signup_session(request: Request, x_signup_session: str | None = Header(default=None)) -> dict:
    """The CAPTCHA-backed ticket every pre-account signup call must carry (brief §13: never trust only the browser)."""
    s = get_settings()
    if not x_signup_session:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "SIGNUP_SESSION_REQUIRED", "message": "Start again from the sign-up page."})
    try:
        data = jwt.decode(x_signup_session, s.jwt_secret, algorithms=[s.jwt_algorithm], leeway=JWT_LEEWAY_SECONDS)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "SIGNUP_SESSION_EXPIRED", "message": "Your sign-up session expired. Start again."})
    if data.get("typ") != "signup" or data.get("iph") != ratelimit.hash_id(_ip(request) or "unknown"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "SIGNUP_SESSION_EXPIRED", "message": "Your sign-up session expired. Start again."})
    data["_hash"] = _signup_session_hash(x_signup_session)
    return data


@router.get("/signup/config")
def signup_config():
    """Public, non-secret configuration the sign-up screen needs: whether a CAPTCHA is required, the site key (public
    by design), the OTP timings and the consent catalogue with document versions."""
    s = get_settings()
    return {
        "captcha": {"required": s.captcha_required, "provider": "turnstile" if s.turnstile_configured else None,
                    "site_key": s.turnstile_site_key if s.turnstile_configured else None},
        "otp": {"ttl_seconds": s.otp_ttl_seconds, "resend_cooldown_seconds": s.otp_resend_cooldown_seconds, "max_attempts": s.otp_max_attempts,
                "delivery_mode": s.otp_delivery_mode},
        "password": {"min_length": 10},
        "consents": legal.public_catalogue(),
    }


@router.post("/signup/session")
def signup_session(body: SignupSessionIn, request: Request, db: Session = Depends(get_db)):
    s = get_settings()
    ip = _ip(request)
    ok, retry = ratelimit.hit(ratelimit.SIGNUP_SESSION_IP, ratelimit.hash_id(ip or "unknown"))
    if not ok:
        verification.security_event(db, "signup_session_limited", ip=ip)
        db.commit()
        raise ratelimit.too_many(retry, "SIGNUP_LIMITED")
    result = captcha.verify_token(body.captcha_token, ip)  # raises 400/503 — production without keys cannot pass this line
    now = utcnow()
    payload = {"typ": "signup", "sid": secrets.token_urlsafe(12), "iph": ratelimit.hash_id(ip or "unknown"), "mode": result.get("mode"),
               "iat": int(now.timestamp()), "exp": int((now + timedelta(seconds=s.signup_session_ttl_seconds)).timestamp())}
    return {"signup_session": jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), "expires_in": s.signup_session_ttl_seconds}


class VerificationSendIn(BaseModel):
    channel: str = Field(pattern="^(EMAIL|SMS)$")
    target: str = Field(min_length=1, max_length=255)
    phone_country: str | None = Field(default=None, min_length=2, max_length=2)
    #: SIGNUP (default, needs a signup session) or CONTACT (needs a signed-in principal).
    purpose: str = Field(default="SIGNUP", pattern="^(SIGNUP|CONTACT)$")
    locale: str = "en"


def _normalize_target(channel: str, target: str, country: str | None) -> str:
    try:
        return normalize_email(target) if channel == "EMAIL" else normalize_phone(target, country)
    except IdentityError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": exc.code, "message": str(exc)})


@router.post("/verification/send")
def verification_send(body: VerificationSendIn, request: Request, db: Session = Depends(get_db),
                      x_signup_session: str | None = Header(default=None), authorization: str | None = Header(default=None)):
    ip = _ip(request)
    target = _normalize_target(body.channel, body.target, body.phone_country)
    user_id = None
    session_hash = None
    if body.purpose == "SIGNUP":
        sess = require_signup_session(request, x_signup_session)
        session_hash = sess["_hash"]
        purpose = "SIGNUP_EMAIL" if body.channel == "EMAIL" else "SIGNUP_PHONE"
    else:
        p = get_principal(request, db, authorization)
        user_id = p.id
        ok, retry = ratelimit.hit(ratelimit.CONTACT_CHANGE_USER, str(p.id))
        if not ok:
            raise ratelimit.too_many(retry, "OTP_SEND_LIMITED")
        purpose = "CONTACT_EMAIL" if body.channel == "EMAIL" else "CONTACT_PHONE"
    already = False
    if body.channel == "EMAIL":
        existing = db.scalar(select(User.id).where(User.email == target))
        already = existing is not None and (body.purpose == "SIGNUP" or existing != user_id)
    try:
        out = verification.issue(db, purpose=purpose, target=target, locale=body.locale, ip=ip, user_id=user_id,
                                 signup_session_hash=session_hash, already_registered=already)
    finally:
        db.commit()  # the challenge row, the invalidations and any security event are evidence even when the send fails
    return out


class VerificationVerifyIn(BaseModel):
    challenge_id: str
    code: str = Field(min_length=1, max_length=12)


@router.post("/verification/verify")
def verification_verify(body: VerificationVerifyIn, request: Request, db: Session = Depends(get_db)):
    try:
        ch = verification.check(db, challenge_id=body.challenge_id, code=body.code, ip=_ip(request))
    finally:
        db.commit()
    return {"verified": True, "channel": ch.channel, "proof": verification.mint_proof(ch), "proof_expires_in": get_settings().otp_proof_ttl_seconds}


@router.get("/verification/peek/{challenge_id}")
def verification_peek(challenge_id: str):
    """Development/test only: the code just issued, so a local sign-up and the e2e suite can complete without a
    provider. Answers 404 in production — the route does not exist there, and nothing is ever logged."""
    if get_settings().is_production:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    code = verification.dev_peek(challenge_id)
    if code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return {"code": code}


def _consent_rows(user_id: uuid.UUID, consents: dict[str, bool], *, locale: str, ip: str | None, user_agent: str, source: str):
    now = utcnow()
    eff = date.fromisoformat(legal.POLICY_EFFECTIVE_ON) if legal.POLICY_EFFECTIVE_ON else None
    for item in legal.SIGNUP_CONSENTS:
        yield ConsentRecord(user_id=user_id, purpose=item.key, version=item.version, granted=bool(consents.get(item.key)), created_at=now,
                            locale=locale, document_version=item.version, policy_effective_on=eff,
                            ip_hash=ratelimit.hash_id(ip or "unknown"), user_agent=user_agent[:300], source=source)


@router.post("/register", status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db),
             x_signup_session: str | None = Header(default=None)):
    ip = _ip(request)
    require_signup_session(request, x_signup_session)  # CAPTCHA-backed; production without a CAPTCHA cannot reach here
    ok, retry = ratelimit.hit(ratelimit.REGISTER_IP, ratelimit.hash_id(ip or "unknown"))
    if not ok:
        verification.security_event(db, "register_ip_limited", ip=ip)
        db.commit()
        raise ratelimit.too_many(retry, "REGISTER_LIMITED")
    email = _normalize_target("EMAIL", body.email, None)
    phone = _normalize_target("SMS", body.phone, body.phone_country)
    if body.password != body.password_confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "PASSWORD_MISMATCH", "message": "The two passwords do not match."})
    unknown = set(body.consents) - legal.ALL_SIGNUP_KEYS
    if unknown:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "CONSENT_UNKNOWN", "message": "Unknown consent item.", "keys": sorted(unknown)})
    missing = sorted(k for k in legal.REQUIRED_SIGNUP_KEYS if not body.consents.get(k))
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "CONSENT_REQUIRED", "message": "Please agree to the required items.", "keys": missing})
    # Proofs are checked before the uniqueness check so the response for a taken email is identical with or
    # without a proof — and a taken email can never obtain a proof in the first place (see verification_send).
    email_ch = verification.spend(db, proof=body.email_proof, purpose="SIGNUP_EMAIL", target=email, mark_used=False)
    phone_ch = verification.spend(db, proof=body.phone_proof, purpose="SIGNUP_PHONE", target=phone, mark_used=False)
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "EMAIL_TAKEN", "message": "An account with this email already exists."})
    now = utcnow()
    user = User(email=email, password_hash=hash_password(body.password), full_name=body.full_name.strip(), locale=body.locale,
                phone=phone, email_verified_at=now, phone_verified_at=now)
    db.add(user)
    db.flush()
    email_ch.used_at = phone_ch.used_at = now
    email_ch.user_id = phone_ch.user_id = user.id
    db.add(UserRole(user_id=user.id, role=Role.STUDENT))
    db.add(StudentProfile(user_id=user.id, nationality=body.nationality.upper() if body.nationality else None, lead_source="web_signup"))
    for row in _consent_rows(user.id, body.consents, locale=body.locale, ip=ip, user_agent=request.headers.get("user-agent") or "", source="SIGNUP"):
        db.add(row)
    track(db, "student_registered", user_id=user.id, nationality=body.nationality,
          properties={"email_verified": True, "phone_verified": True, "marketing_opt_in": bool(body.consents.get("MARKETING"))})
    tokens = issue_tokens(db, response, request, user, "student", None)
    tokens.pop("_rt")
    db.commit()
    return {**tokens, **session_payload(db, user, "student", None)}


# ------------------------------------------------------------------------------------ contact re-verification (brief §17)
class ContactEmailIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    proof: str | None = None


class ContactPhoneIn(BaseModel):
    phone: str = Field(min_length=3, max_length=40)
    phone_country: str | None = Field(default=None, min_length=2, max_length=2)
    proof: str | None = None


@router.post("/contact/email")
def change_email(body: ContactEmailIn, request: Request, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    email = _normalize_target("EMAIL", body.email, None)
    if email == p.user.email:
        return {"email": email, "email_verified": p.user.email_verified_at is not None}
    verification.spend(db, proof=body.proof, purpose="CONTACT_EMAIL", target=email)
    if db.scalar(select(User.id).where(User.email == email, User.id != p.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "EMAIL_TAKEN", "message": "An account with this email already exists."})
    audit(db, action="auth.email_changed", entity_type="user", entity_id=p.id, actor=p, subject_user_id=p.id)
    p.user.email, p.user.email_verified_at = email, utcnow()
    db.commit()
    return {"email": email, "email_verified": True}


@router.post("/contact/phone")
def change_phone(body: ContactPhoneIn, request: Request, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    phone = _normalize_target("SMS", body.phone, body.phone_country)
    if phone == p.user.phone and p.user.phone_verified_at is not None:
        return {"phone": phone, "phone_verified": True}
    verification.spend(db, proof=body.proof, purpose="CONTACT_PHONE", target=phone)
    audit(db, action="auth.phone_changed", entity_type="user", entity_id=p.id, actor=p, subject_user_id=p.id)
    p.user.phone, p.user.phone_verified_at = phone, utcnow()
    db.commit()
    return {"phone": phone, "phone_verified": True}


# ------------------------------------------------------------------------------------ forgot / reset password
class ForgotIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    locale: str = "en"


class ResetIn(BaseModel):
    challenge_id: str
    code: str = Field(min_length=1, max_length=12)
    new_password: str = Field(min_length=10, max_length=200)
    new_password_confirm: str = Field(min_length=1, max_length=200)


@router.post("/forgot-password", status_code=202)
def forgot_password(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    """Always 202. A code goes to the address only if an active account has it; the response never says which."""
    ip = _ip(request)
    try:
        email = normalize_email(body.email)
    except IdentityError:
        return {"accepted": True}
    for lim, subject in ((ratelimit.FORGOT_EMAIL, ratelimit.hash_id(email)), (ratelimit.FORGOT_IP, ratelimit.hash_id(ip or "unknown"))):
        ok, retry = ratelimit.hit(lim, subject)
        if not ok:
            verification.security_event(db, "forgot_limited", email=email, ip=ip)
            db.commit()
            raise ratelimit.too_many(retry, "FORGOT_LIMITED")
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    out: dict = {"accepted": True}
    if user:
        try:
            res = verification.issue(db, purpose="PASSWORD_RESET", target=email, locale=body.locale, ip=ip, user_id=user.id)
            out["challenge_id"] = res["challenge_id"]
        except HTTPException as exc:
            if exc.status_code != status.HTTP_502_BAD_GATEWAY:
                raise
    else:
        # Same shape, nothing sent, nothing accepted: a decoy handle so the reply does not reveal the account's absence.
        out["challenge_id"] = str(uuid.uuid4())
    db.commit()
    return out


@router.post("/reset-password")
def reset_password(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    if body.new_password != body.new_password_confirm:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "PASSWORD_MISMATCH", "message": "The two passwords do not match."})
    try:
        ch = verification.check(db, challenge_id=body.challenge_id, code=body.code, ip=_ip(request))
    finally:
        db.commit()
    if ch.purpose not in ("PASSWORD_RESET", "INVITE"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "CODE_EXPIRED", "message": "This code has expired. Request a new one."})
    user = db.scalar(select(User).where(User.email == ch.target))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "CODE_EXPIRED", "message": "This code has expired. Request a new one."})
    user.password_hash = hash_password(body.new_password)
    user.email_verified_at = user.email_verified_at or utcnow()
    now = utcnow()
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))):
        rt.revoked_at = now
    ch.used_at = now
    audit(db, action="auth.password_reset", entity_type="user", entity_id=user.id, subject_user_id=user.id)
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------------------------ Twilio delivery status (brief §10)
@router.post("/webhooks/twilio/status", include_in_schema=False)
async def twilio_status(request: Request, db: Session = Depends(get_db), x_twilio_signature: str | None = Header(default=None)):
    from app.services import sms

    s = get_settings()
    form = {k: v for k, v in (await request.form()).items()}
    public = f"{s.public_api_origin.rstrip('/')}{request.url.path}" if s.public_api_origin else str(request.url)
    if request.url.query:
        public = f"{public}?{request.url.query}"
    if not sms.validate_callback(public, form, x_twilio_signature):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid signature")
    sid, st = form.get("MessageSid") or form.get("SmsSid"), (form.get("MessageStatus") or form.get("SmsStatus") or "").lower()
    if sid and st:
        verification.record_delivery(db, provider_message_id=sid, provider_status=st, error_code=form.get("ErrorCode"))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def me(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return session_payload(db, p.user, p.client, p.org_id)


@router.post("/switch-org")
def switch_org(body: SwitchOrgIn, request: Request, response: Response, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    org_id = default_org_for_client(db, p.user, body.client, body.org_id)
    tokens = issue_tokens(db, response, request, p.user, body.client, org_id)
    tokens.pop("_rt")
    audit(db, action="auth.switch_org", entity_type="organization", entity_id=org_id, actor=p)
    db.commit()
    return {**tokens, **session_payload(db, p.user, body.client, org_id)}
