"""One-time-code verification: issue, deliver, check, prove, spend (V22, REPORT §244, brief §5, §9, §15).

Lifecycle of one challenge
    issue()   rate limits (target, IP), enforces the resend cooldown, **invalidates** every earlier open challenge
              for the same target+purpose, stores an HMAC of a `secrets`-generated 6-digit code, dispatches it
              through mail/sms (or the console provider in development) and returns the public handle.
    check()   constant-time compare; wrong → attempt_count++ and, at the ceiling, the challenge is invalidated;
              right → consumed_at and a short-lived signed **proof** bound to (challenge, target, purpose).
    spend()   the endpoint that finally acts (register, change contact, reset password) hands the proof back; it
              is validated and the challenge is marked used — a proof is single-use.

Nothing here logs a code. In non-production the plaintext is parked in Redis for the lifetime of the challenge so
the dev-only peek endpoint and the test suite can read it; production parks nothing.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import timedelta

import jwt
import redis
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import JWT_LEEWAY_SECONDS
from app.models import AuthSecurityEvent, VerificationChallenge
from app.models.base import utcnow
from app.services import mail, ratelimit, sms
from app.services.identity import mask_email, mask_phone, target_hash

log = logging.getLogger("hangyul.verification")

PURPOSES = {"SIGNUP_EMAIL": "EMAIL", "SIGNUP_PHONE": "SMS", "CONTACT_EMAIL": "EMAIL", "CONTACT_PHONE": "SMS",
            "PASSWORD_RESET": "EMAIL", "INVITE": "EMAIL"}
_DEV_KEY = "hg:otp:dev:"


def _key() -> bytes:
    return hashlib.sha256(("otp:" + get_settings().jwt_secret).encode()).digest()


def code_hash(challenge_id: uuid.UUID, code: str) -> str:
    return hmac.new(_key(), f"{challenge_id}:{code}".encode(), hashlib.sha256).hexdigest()


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def err(http: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(http, {"code": code, "message": message, **extra})


def security_event(db: Session, kind: str, *, email: str | None = None, target: str | None = None, ip: str | None = None,
                   client: str | None = None, detail: dict | None = None) -> None:
    db.add(AuthSecurityEvent(kind=kind, email_hash=target_hash(email) if email else None, target_hash=target_hash(target) if target else None,
                             ip_hash=ratelimit.hash_id(ip) if ip else None, client=client, detail=detail, created_at=utcnow()))


# ------------------------------------------------------------------------------------------------ issue
def issue(db: Session, *, purpose: str, target: str, locale: str, ip: str | None, user_id: uuid.UUID | None = None,
          signup_session_hash: str | None = None, already_registered: bool = False) -> dict:
    s = get_settings()
    channel = PURPOSES[purpose]
    now = utcnow()
    th = target_hash(target)
    iph = ratelimit.hash_id(ip or "unknown")

    ok, retry = ratelimit.hit(ratelimit.OTP_SEND_TARGET, th)
    if not ok:
        security_event(db, "otp_send_limited_target", target=target, ip=ip, detail={"purpose": purpose})
        raise ratelimit.too_many(retry, "OTP_SEND_LIMITED")
    for lim in (ratelimit.OTP_SEND_IP, ratelimit.OTP_SEND_IP_DAY):
        ok, retry = ratelimit.hit(lim, iph)
        if not ok:
            security_event(db, "otp_send_limited_ip", target=target, ip=ip, detail={"purpose": purpose})
            raise ratelimit.too_many(retry, "OTP_SEND_LIMITED")

    latest = db.scalar(select(VerificationChallenge).where(VerificationChallenge.target_hash == th, VerificationChallenge.purpose == purpose)
                       .order_by(VerificationChallenge.created_at.desc()).limit(1))
    # A send the provider refused delivered nothing, so it imposes no cooldown (V27, REPORT §358).
    if latest and latest.delivery_status != "FAILED" and (now - latest.created_at).total_seconds() < s.otp_resend_cooldown_seconds:
        wait = s.otp_resend_cooldown_seconds - int((now - latest.created_at).total_seconds())
        raise ratelimit.too_many(max(1, wait), "OTP_RESEND_TOO_SOON")

    # A new code makes every earlier open code for this target+purpose dead (brief §5).
    db.execute(update(VerificationChallenge).where(VerificationChallenge.target_hash == th, VerificationChallenge.purpose == purpose,
                                                   VerificationChallenge.consumed_at.is_(None), VerificationChallenge.invalidated_at.is_(None))
               .values(invalidated_at=now))

    ch = VerificationChallenge(id=uuid.uuid4(), user_id=user_id, purpose=purpose, channel=channel, target=target, target_hash=th,
                               code_hash="", locale=locale, created_at=now, expires_at=now + timedelta(seconds=s.otp_ttl_seconds),
                               attempt_count=0, max_attempts=s.otp_max_attempts, send_count=(latest.send_count + 1) if latest else 1,
                               request_ip_hash=iph, signup_session_hash=signup_session_hash, delivery_status="QUEUED")
    code = generate_code()
    ch.code_hash = code_hash(ch.id, code)
    if already_registered:
        # Enumeration defence: identical response shape and timing; the message says "you already have an account"
        # and carries no code, so nothing this challenge accepts can exist.
        ch.invalidated_at = now
    db.add(ch)
    db.flush()

    try:
        if channel == "EMAIL":
            res = _send_email(ch, code, locale, already_registered)
        else:
            res = _send_sms(ch, code, locale)
        ch.provider, ch.provider_message_id, ch.delivery_status = res.provider, res.message_id, res.status
    except (mail.MailError, sms.SmsError) as exc:
        ch.provider = "sendgrid" if channel == "EMAIL" else "twilio"
        ch.delivery_status, ch.delivery_error_code, ch.delivery_updated_at = "FAILED", exc.code[:32], now
        db.flush()
        from app.services import monitoring  # V29: a code that never arrives is an operational failure (no target, no code)

        monitoring.record("DELIVERY_FAILED", f"verification.{channel.lower()}", f"{ch.provider} could not deliver a {purpose} code",
                          detail={"provider": ch.provider, "error_code": exc.code[:32], "challenge_id": str(ch.id)}, severity="warning")
        # V27 (REPORT §358, brief §31): say what failed and what the person can do, never a generic server error.
        reason, retry = delivery_reason(exc.code)
        raise err(status.HTTP_502_BAD_GATEWAY, "DELIVERY_FAILED",
                  "We could not send the verification code. Please try again." if channel == "EMAIL" else
                  "We could not send the verification text. Please try again.", channel=channel, reason=reason,
                  **({"retry_after": retry} if retry else {}))
    if not s.is_production and not already_registered:
        try:
            redis.Redis.from_url(s.redis_url, decode_responses=True).set(f"{_DEV_KEY}{ch.id}", code, ex=s.otp_ttl_seconds)
        except redis.RedisError:
            pass
    return {"challenge_id": str(ch.id), "channel": channel, "target_masked": mask_email(target) if channel == "EMAIL" else mask_phone(target),
            "expires_in": s.otp_ttl_seconds, "resend_in": s.otp_resend_cooldown_seconds, "delivery": "console" if res.provider == "console" else "sent"}


#: Provider error → what the person can act on. Twilio codes: 21211 invalid 'To', 21612/21408 cannot route to that
#: number or region, 21610 recipient opted out (STOP), 21614 not a mobile number, 30003-30008 carrier/handset.
_SMS_REASON = {"21211": "RECIPIENT_INVALID", "21614": "RECIPIENT_INVALID", "21612": "REGION_UNSUPPORTED", "21408": "REGION_UNSUPPORTED",
               "21610": "RECIPIENT_REJECTED", "30004": "RECIPIENT_REJECTED", "30003": "RECIPIENT_UNREACHABLE",
               "30005": "RECIPIENT_INVALID", "30006": "RECIPIENT_INVALID", "30007": "RECIPIENT_REJECTED", "30008": "RECIPIENT_UNREACHABLE"}


def delivery_reason(code: str) -> tuple[str, int | None]:
    """(reason, retry_after seconds or None). UNREACHABLE = the provider could not be reached (try again shortly);
    SERVICE_CONFIG = our sending setup was refused (the person can retry later, staff are alerted by the log);
    RECIPIENT_* / REGION_UNSUPPORTED = the address or number itself, so retrying unchanged will not help."""
    if code in ("MAIL_UNREACHABLE", "SMS_UNREACHABLE") or code.endswith("_429") or code.endswith("_HTTP_429"):
        return "UNREACHABLE", 30
    if code.startswith("SMS_PROVIDER_"):
        return _SMS_REASON.get(code.removeprefix("SMS_PROVIDER_"), "SERVICE_CONFIG"), (60 if code.removeprefix("SMS_PROVIDER_") not in _SMS_REASON else None)
    if code in ("MAIL_HTTP_400",):
        return "RECIPIENT_INVALID", None
    if code.startswith("MAIL_HTTP_5") or code.startswith("SMS_HTTP_5"):
        return "UNREACHABLE", 30
    return "SERVICE_CONFIG", 60


def _send_email(ch: VerificationChallenge, code: str, locale: str, already_registered: bool) -> mail.SendResult:
    subject, text, html = email_content(ch.purpose, code, locale, already_registered)
    return mail.send_email(to=ch.target, subject=subject, text=text, html=html, category=ch.purpose.lower())


def _send_sms(ch: VerificationChallenge, code: str, locale: str) -> sms.SendResult:
    s = get_settings()
    cb = f"{s.public_api_origin.rstrip('/')}/api/v1/auth/webhooks/twilio/status" if s.public_api_origin else None
    return sms.send_sms(to_e164=ch.target, body=sms.otp_text(code, locale), status_callback=cb)


_SUBJECT = {
    "ko": {"code": "[Hangyul Univ] 인증번호 {code}", "exists": "[Hangyul Univ] 이미 가입된 이메일입니다", "reset": "[Hangyul Univ] 비밀번호 재설정 인증번호 {code}", "invite": "[Hangyul Univ] 관리자 계정 초대"},
    "en": {"code": "[Hangyul Univ] Your verification code is {code}", "exists": "[Hangyul Univ] You already have an account", "reset": "[Hangyul Univ] Password reset code {code}", "invite": "[Hangyul Univ] You have been invited as an administrator"},
}
_BODY = {
    "ko": {"code": "인증번호는 {code}입니다. 5분 안에 입력해 주세요.\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다. 한귤은 인증번호를 묻지 않습니다.",
           "exists": "이 이메일로 이미 Hangyul Univ 계정이 있습니다. 로그인하시거나, 비밀번호를 잊으셨다면 재설정해 주세요.\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.",
           "reset": "비밀번호 재설정 인증번호는 {code}입니다. 5분 안에 입력해 주세요.\n\n요청하지 않으셨다면 이 메일을 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.",
           "invite": "Hangyul Univ 콘솔 관리자 계정에 초대되었습니다. 아래 인증번호로 비밀번호를 설정해 주세요: {code}\n\n인증번호는 5분간 유효합니다."},
    "en": {"code": "Your verification code is {code}. Enter it within 5 minutes.\n\nIf you did not request this, you can ignore this email. Hangyul will never ask you for this code.",
           "exists": "There is already a Hangyul Univ account for this email. Sign in, or reset your password if you have forgotten it.\n\nIf you did not request this, you can ignore this email.",
           "reset": "Your password reset code is {code}. Enter it within 5 minutes.\n\nIf you did not request this, you can ignore this email; your password will not change.",
           "invite": "You have been invited to a Hangyul Univ console administrator account. Set your password with this code: {code}\n\nThe code is valid for 5 minutes."},
}


def email_content(purpose: str, code: str, locale: str, already_registered: bool) -> tuple[str, str, str]:
    lang = "ko" if locale.startswith("ko") else "en"
    kind = "exists" if already_registered else "reset" if purpose == "PASSWORD_RESET" else "invite" if purpose == "INVITE" else "code"
    subject = _SUBJECT[lang][kind].format(code=code)
    text = _BODY[lang][kind].format(code=code)
    big = "" if kind == "exists" else f'<p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">{code}</p>'
    html = (f'<div style="font-family:Pretendard,Apple SD Gothic Neo,Segoe UI,sans-serif;color:#282828;max-width:520px">'
            f'<p style="color:#FF6700;font-weight:700;margin:0 0 12px">Hangyul Univ</p>{big}'
            + "".join(f"<p>{line}</p>" for line in text.split("\n") if line) + "</div>")
    return subject, text, html


# ------------------------------------------------------------------------------------------------ check
def check(db: Session, *, challenge_id: str, code: str, ip: str | None, expect_purpose: str | None = None) -> VerificationChallenge:
    try:
        cid = uuid.UUID(challenge_id)
    except (ValueError, TypeError):
        raise err(status.HTTP_400_BAD_REQUEST, "CODE_EXPIRED", "This code has expired. Request a new one.")
    iph = ratelimit.hash_id(ip or "unknown")
    ok, retry = ratelimit.hit(ratelimit.OTP_VERIFY_IP, iph)
    if not ok:
        security_event(db, "otp_verify_limited_ip", ip=ip)
        raise ratelimit.too_many(retry, "OTP_VERIFY_LIMITED")
    ch = db.get(VerificationChallenge, cid)
    now = utcnow()
    if ch is None or (expect_purpose and ch.purpose != expect_purpose):
        raise err(status.HTTP_400_BAD_REQUEST, "CODE_EXPIRED", "This code has expired. Request a new one.")
    ok, retry = ratelimit.hit(ratelimit.OTP_VERIFY_TARGET, ch.target_hash)
    if not ok:
        security_event(db, "otp_verify_limited_target", target=ch.target, ip=ip)
        raise ratelimit.too_many(retry, "OTP_VERIFY_LIMITED")
    if ch.consumed_at or ch.invalidated_at or ch.expires_at < now:
        raise err(status.HTTP_400_BAD_REQUEST, "CODE_EXPIRED", "This code has expired. Request a new one.")
    code = (code or "").strip()
    if not (len(code) == 6 and code.isdigit()) or not hmac.compare_digest(code_hash(ch.id, code), ch.code_hash):
        ch.attempt_count += 1
        left = ch.max_attempts - ch.attempt_count
        if left <= 0:
            ch.invalidated_at = now
            security_event(db, "otp_attempts_exhausted", target=ch.target, ip=ip, detail={"purpose": ch.purpose})
            db.flush()
            raise err(status.HTTP_400_BAD_REQUEST, "TOO_MANY_ATTEMPTS", "Too many incorrect codes. Request a new one.", attempts_left=0)
        db.flush()
        raise err(status.HTTP_400_BAD_REQUEST, "CODE_INVALID", "That code is not correct.", attempts_left=left)
    ch.consumed_at = now
    db.flush()
    return ch


def mint_proof(ch: VerificationChallenge) -> str:
    s = get_settings()
    now = utcnow()
    payload = {"typ": "verification", "ch": str(ch.id), "purpose": ch.purpose, "channel": ch.channel, "th": ch.target_hash,
               "iat": int(now.timestamp()), "exp": int((now + timedelta(seconds=s.otp_proof_ttl_seconds)).timestamp())}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def spend(db: Session, *, proof: str | None, purpose: str, target: str, mark_used: bool = True) -> VerificationChallenge:
    """Validate a proof against (purpose, target) and mark the challenge used. Raises a stable code on any mismatch."""
    s = get_settings()
    if not proof:
        raise err(status.HTTP_400_BAD_REQUEST, f"{'EMAIL' if PURPOSES[purpose] == 'EMAIL' else 'PHONE'}_NOT_VERIFIED", "Verify first.")
    try:
        data = jwt.decode(proof, s.jwt_secret, algorithms=[s.jwt_algorithm], leeway=JWT_LEEWAY_SECONDS)
    except jwt.PyJWTError:
        raise err(status.HTTP_400_BAD_REQUEST, "VERIFICATION_EXPIRED", "Your verification expired. Verify again.")
    if data.get("typ") != "verification" or data.get("purpose") != purpose or data.get("th") != target_hash(target):
        raise err(status.HTTP_400_BAD_REQUEST, "VERIFICATION_MISMATCH", "The verified value does not match. Verify again.")
    ch = db.get(VerificationChallenge, uuid.UUID(data["ch"]))
    if ch is None or ch.consumed_at is None or ch.used_at is not None or ch.target_hash != target_hash(target):
        raise err(status.HTTP_400_BAD_REQUEST, "VERIFICATION_EXPIRED", "Your verification expired. Verify again.")
    if mark_used:
        ch.used_at = utcnow()
    return ch


# ------------------------------------------------------------------------------------------------ dev + ops
def dev_peek(challenge_id: str) -> str | None:
    """Non-production only: the plaintext parked at issue time, or None."""
    if get_settings().is_production:
        return None
    try:
        return redis.Redis.from_url(get_settings().redis_url, decode_responses=True).get(f"{_DEV_KEY}{challenge_id}")
    except redis.RedisError:
        return None


def record_delivery(db: Session, *, provider_message_id: str, provider_status: str, error_code: str | None) -> bool:
    ch = db.scalar(select(VerificationChallenge).where(VerificationChallenge.provider_message_id == provider_message_id))
    if ch is None:
        return False
    ch.delivery_status = sms.TWILIO_STATUS_MAP.get(provider_status, ch.delivery_status)
    ch.delivery_error_code = (error_code or None) and str(error_code)[:32]
    ch.delivery_updated_at = utcnow()
    return True


def purge_expired(db: Session, *, older_than_hours: int = 24) -> int:
    cutoff = utcnow() - timedelta(hours=older_than_hours)
    rows = db.scalars(select(VerificationChallenge).where(VerificationChallenge.expires_at < cutoff)).all()
    for r in rows:
        db.delete(r)
    return len(rows)
