"""V29 staff MFA: TOTP (RFC 6238) with one-time recovery codes. No SMS factor, by design.

Who: every **staff** account — an active agency or university membership, or a global `HANGYUL_*` role. Students
never see MFA (their accounts are protected by verified email + phone and the login throttle).

Login step-up. A correct password for an enrolled staff account yields **no tokens**: the API answers 401
`MFA_REQUIRED` with a 5-minute `mfa_pending` challenge token, and only `POST /auth/mfa/verify` with a valid TOTP
code or an unused recovery code mints the access/refresh pair. When `HG_STAFF_MFA_REQUIRED` is in force (default in
production) a staff account *without* a factor gets 403 `MFA_ENROLLMENT_REQUIRED` and an `mfa_enroll` token that only
the enrol endpoints accept — it cannot read a single record.

Secrets are generated here, sealed with AES-256-GCM under `HG_MFA_ENCRYPTION_KEY`, bound to the user id, and only
returned once (as the secret and an `otpauth://` URI) during enrolment. A TOTP time-step is accepted once
(`last_used_step`), so a shoulder-surfed code cannot be replayed inside its window. Attempts are rate limited per
user and per address with the shared Redis limiter. Every event is audited.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
import uuid
from datetime import timedelta
from urllib.parse import quote

import jwt
import pyotp
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.audit import audit
from app.core.config import get_settings
from app.core.security import JWT_LEEWAY_SECONDS
from app.models import OrganizationMember, User, UserRole
from app.models.base import utcnow
from app.models.enums import AGENCY_ROLES, HANGYUL_ROLES, UNIVERSITY_ROLES
from app.models.v29_security import MfaRecoveryCode, StaffMfa
from app.services import ratelimit

STAFF_CLIENTS = ("agency", "university")
RECOVERY_CODE_COUNT = 10
TOTP_STEP = 30
MFA_VERIFY_USER = ratelimit.Limit("mfa_verify_user", 5, 900)
MFA_VERIFY_IP = ratelimit.Limit("mfa_verify_ip", 30, 900)
TYP_PENDING, TYP_ENROLL = "mfa_pending", "mfa_enroll"


# ------------------------------------------------------------------------------------------------ who needs MFA
def is_staff(db: Session, user_id: uuid.UUID) -> bool:
    if db.scalar(select(func.count()).select_from(UserRole).where(UserRole.user_id == user_id, UserRole.role.in_(list(HANGYUL_ROLES)))):
        return True
    roles = list(AGENCY_ROLES | UNIVERSITY_ROLES | HANGYUL_ROLES)
    return bool(db.scalar(select(func.count()).select_from(OrganizationMember).where(
        OrganizationMember.user_id == user_id, OrganizationMember.is_active.is_(True), OrganizationMember.role.in_(roles))))


def factor(db: Session, user_id: uuid.UUID) -> StaffMfa | None:
    return db.scalar(select(StaffMfa).where(StaffMfa.user_id == user_id))


def enabled(db: Session, user_id: uuid.UUID) -> bool:
    f = factor(db, user_id)
    return bool(f and f.enabled_at)


def status_for(db: Session, user: User) -> dict:
    f = factor(db, user.id)
    remaining = db.scalar(select(func.count()).select_from(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id, MfaRecoveryCode.used_at.is_(None))) or 0
    return {
        "eligible": is_staff(db, user.id),
        "enrolled": bool(f and f.enabled_at),
        "pending": bool(f and not f.enabled_at),
        "enabled_at": f.enabled_at.isoformat() if f and f.enabled_at else None,
        "recovery_codes_remaining": int(remaining) if f and f.enabled_at else 0,
        "required": get_settings().staff_mfa_required_effective,
    }


# ------------------------------------------------------------------------------------------------ challenge tokens
def mint_token(typ: str, user: User, *, client: str, org_id: uuid.UUID | None) -> tuple[str, int]:
    s = get_settings()
    ttl = s.mfa_challenge_ttl_seconds if typ == TYP_PENDING else s.mfa_enrollment_ttl_seconds
    now = int(time.time())
    payload = {"typ": typ, "sub": str(user.id), "client": client, "org": str(org_id) if org_id else None, "iat": now, "exp": now + ttl,
               "jti": secrets.token_hex(8)}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), ttl


def decode_token(token: str, typ: str) -> dict:
    s = get_settings()
    try:
        data = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], leeway=JWT_LEEWAY_SECONDS)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "MFA_TOKEN_EXPIRED", "message": "Sign in again."})
    if data.get("typ") != typ:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "MFA_TOKEN_EXPIRED", "message": "Sign in again."})
    return data


# ------------------------------------------------------------------------------------------------ TOTP + recovery
def _totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, digits=6, interval=TOTP_STEP)


def _normalise_code(code: str) -> str:
    return "".join(ch for ch in (code or "") if ch.isalnum()).lower()


def _hash_recovery(code: str) -> str:
    return hashlib.sha256(_normalise_code(code).encode()).hexdigest()


def _new_recovery_codes(db: Session, user_id: uuid.UUID) -> list[str]:
    db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id))
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = base64.b32encode(secrets.token_bytes(7)).decode()[:10].lower()  # 50 bits
        codes.append(f"{raw[:5]}-{raw[5:]}")
        db.add(MfaRecoveryCode(user_id=user_id, code_hash=_hash_recovery(raw), created_at=utcnow()))
    return codes


def _secret_of(f: StaffMfa) -> str:
    return crypto.open_mfa_secret(f.secret_ciphertext, user_id=str(f.user_id))


def _check_totp(f: StaffMfa, code: str, *, now: float | None = None) -> bool:
    code = _normalise_code(code)
    if len(code) != 6 or not code.isdigit():
        return False
    totp = _totp(_secret_of(f))
    current = int((now or time.time()) // TOTP_STEP)
    for step in (current - 1, current, current + 1):
        if hmac.compare_digest(totp.at(step * TOTP_STEP), code):
            if f.last_used_step is not None and step <= f.last_used_step:
                return False  # replay inside (or before) an already-used window
            f.last_used_step = step
            return True
    return False


def _limit(user_id: uuid.UUID, ip: str | None) -> None:
    for lim, subject in ((MFA_VERIFY_USER, str(user_id)), (MFA_VERIFY_IP, ratelimit.hash_id(ip or "unknown"))):
        ok, retry = ratelimit.hit(lim, subject)
        if not ok:
            raise ratelimit.too_many(retry, "MFA_LIMITED")


def _clear_limit(user_id: uuid.UUID) -> None:
    ratelimit.reset(MFA_VERIFY_USER, str(user_id))


def check(db: Session, user: User, *, code: str | None = None, recovery_code: str | None = None, ip: str | None = None,
          purpose: str = "login") -> str:
    """Verify a second factor. Returns the method used ("totp" | "recovery_code"); raises 400/429 otherwise."""
    f = factor(db, user.id)
    if not f or not f.enabled_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_NOT_ENROLLED", "message": "Two-step verification is not set up."})
    try:
        _limit(user.id, ip)
    except HTTPException:
        audit(db, action="mfa.limited", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"purpose": purpose, "ip": ip})
        db.commit()
        raise
    method = None
    if code and _check_totp(f, code):
        method = "totp"
    elif recovery_code:
        row = db.scalar(select(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id, MfaRecoveryCode.code_hash == _hash_recovery(recovery_code),
                                                      MfaRecoveryCode.used_at.is_(None)))
        if row:
            row.used_at = utcnow()
            method = "recovery_code"
    if method is None:
        audit(db, action="mfa.verify_failed", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"purpose": purpose, "ip": ip})
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_CODE_INVALID", "message": "That code is not valid. Try the current code."})
    _clear_limit(user.id)
    audit(db, action="mfa.verified" if method == "totp" else "mfa.recovery_code_used", entity_type="user", entity_id=user.id,
          subject_user_id=user.id, detail={"purpose": purpose, "ip": ip})
    return method


# ------------------------------------------------------------------------------------------------ lifecycle
def begin_enrollment(db: Session, user: User, *, ip: str | None = None) -> dict:
    if not is_staff(db, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, {"code": "MFA_NOT_ELIGIBLE", "message": "Two-step verification is for staff accounts."})
    f = factor(db, user.id)
    if f and f.enabled_at:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "MFA_ALREADY_ENABLED", "message": "Two-step verification is already on."})
    secret = pyotp.random_base32(32)  # 160 bits
    sealed = crypto.seal_mfa_secret(secret, user_id=str(user.id))
    if f is None:
        f = StaffMfa(user_id=user.id, secret_ciphertext=sealed.ciphertext, key_version=sealed.key_version, created_at=utcnow(), updated_at=utcnow())
        db.add(f)
    else:  # a pending enrolment is replaced; its secret was never confirmed
        f.secret_ciphertext, f.key_version, f.last_used_step = sealed.ciphertext, sealed.key_version, None
    issuer = get_settings().mfa_issuer
    uri = _totp(secret).provisioning_uri(name=user.email, issuer_name=issuer)
    audit(db, action="mfa.enroll_started", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"ip": ip})
    db.commit()
    return {"secret": secret, "otpauth_uri": uri, "issuer": issuer, "account": user.email,
            "label": f"{quote(issuer)}:{quote(user.email)}"}


def activate(db: Session, user: User, code: str, *, ip: str | None = None) -> list[str]:
    f = factor(db, user.id)
    if not f:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_NOT_ENROLLED", "message": "Start the set-up again."})
    if f.enabled_at:
        raise HTTPException(status.HTTP_409_CONFLICT, {"code": "MFA_ALREADY_ENABLED", "message": "Two-step verification is already on."})
    _limit(user.id, ip)
    if not _check_totp(f, code):
        audit(db, action="mfa.activate_failed", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"ip": ip})
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"code": "MFA_CODE_INVALID", "message": "That code is not valid. Try the current code."})
    _clear_limit(user.id)
    f.enabled_at = utcnow()
    codes = _new_recovery_codes(db, user.id)
    audit(db, action="mfa.enabled", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"ip": ip})
    return codes


def regenerate_recovery_codes(db: Session, user: User, code: str, *, ip: str | None = None) -> list[str]:
    check(db, user, code=code, ip=ip, purpose="regenerate_recovery_codes")
    codes = _new_recovery_codes(db, user.id)
    audit(db, action="mfa.recovery_codes_regenerated", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"ip": ip})
    return codes


def reset(db: Session, target_user_id: uuid.UUID, *, actor, reason: str | None) -> bool:
    """Remove a user's factor and recovery codes (lost phone). Their refresh tokens are revoked so every session
    has to sign in again — and, where MFA is required, enrol again before it can read anything."""
    from app.models import RefreshToken

    f = factor(db, target_user_id)
    db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == target_user_id))
    if f:
        db.delete(f)
    now = utcnow()
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == target_user_id, RefreshToken.revoked_at.is_(None))):
        rt.revoked_at = now
    audit(db, action="mfa.reset", entity_type="user", entity_id=target_user_id, actor=actor, subject_user_id=target_user_id,
          detail={"had_factor": bool(f), "reason": (reason or "")[:300]})
    return bool(f)


# ------------------------------------------------------------------------------------------------ login + step-up
def login_gate(db: Session, user: User, *, client: str, org_id: uuid.UUID | None, ip: str | None) -> None:
    """Called after the password (and org) checks succeed, before any token exists. Raises to withhold tokens."""
    if client not in STAFF_CLIENTS or not is_staff(db, user.id):
        return
    if enabled(db, user.id):
        token, ttl = mint_token(TYP_PENDING, user, client=client, org_id=org_id)
        audit(db, action="mfa.challenge_issued", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"client": client, "ip": ip})
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {
            "code": "MFA_REQUIRED", "message": "Enter the 6-digit code from your authenticator app.",
            "mfa_token": token, "expires_in": ttl, "methods": ["totp", "recovery_code"]})
    if get_settings().staff_mfa_required_effective:
        token, ttl = mint_token(TYP_ENROLL, user, client=client, org_id=org_id)
        audit(db, action="mfa.enrollment_required", entity_type="user", entity_id=user.id, subject_user_id=user.id, detail={"client": client, "ip": ip})
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, {
            "code": "MFA_ENROLLMENT_REQUIRED", "message": "Set up two-step verification to continue.",
            "enrollment_token": token, "expires_in": ttl})


def step_up(db: Session, p, code: str | None, *, action: str) -> None:
    """Sensitive actions re-check the second factor (`X-MFA-Code`). An actor without a factor passes only where MFA
    is not required (development), so local tooling and the existing suite keep working."""
    if enabled(db, p.id):
        if not code:
            raise HTTPException(status.HTTP_403_FORBIDDEN, {"code": "MFA_STEP_UP_REQUIRED", "message": "Confirm with a code from your authenticator app."})
        check(db, p.user, code=code, ip=getattr(p, "ip", None), purpose=f"step_up:{action}")
        return
    if get_settings().staff_mfa_required_effective:
        raise HTTPException(status.HTTP_403_FORBIDDEN, {"code": "MFA_ENROLLMENT_REQUIRED", "message": "Set up two-step verification first."})


def pending_older_than(db: Session, days: int) -> int:
    """Pending (never confirmed) enrolments older than `days` — removed by the worker's export/cleanup job."""
    cutoff = utcnow() - timedelta(days=days)
    res = db.execute(delete(StaffMfa).where(StaffMfa.enabled_at.is_(None), StaffMfa.created_at < cutoff))
    return res.rowcount or 0
