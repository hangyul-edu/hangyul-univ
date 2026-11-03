import base64
import hashlib
import hmac
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

_ph = PasswordHasher()
settings = get_settings()

#: Clock skew tolerated when decoding our own tokens: a host clock that steps back a second (seen on WSL2) must
#: not turn a token issued a moment ago into "not yet valid". SSO tokens already allow 60 s (app/core/sso.py).
JWT_LEEWAY_SECONDS = 10


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, Exception):
        return False


def create_access_token(user_id: uuid.UUID, *, client: str, org_id: uuid.UUID | None) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "client": client,
        "org": str(org_id) if org_id else None,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "typ": "access",
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), settings.access_token_minutes * 60


def decode_access_token(token: str) -> dict:
    data = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], leeway=JWT_LEEWAY_SECONDS)
    if data.get("typ") != "access":
        raise jwt.InvalidTokenError("wrong token type")
    return data


def new_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def sign_file_token(storage_key: str, user_id: uuid.UUID, disposition: str = "inline") -> str:
    """Short-lived HMAC-signed token for private file download; bound to the requesting user."""
    exp = int(time.time()) + settings.file_url_ttl_seconds
    msg = f"{storage_key}|{user_id}|{exp}|{disposition}"
    sig = hmac.new(settings.file_url_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{msg}|{sig}".encode()).decode()


def verify_file_token(token: str) -> tuple[str, str, str]:
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        storage_key, user_id, exp, disposition, sig = decoded.rsplit("|", 4)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("malformed token") from exc
    msg = f"{storage_key}|{user_id}|{exp}|{disposition}"
    expected = hmac.new(settings.file_url_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("bad signature")
    if int(exp) < time.time():
        raise ValueError("expired")
    return storage_key, user_id, disposition


def mask(value: str | None, keep: int = 3) -> str | None:
    if not value:
        return value
    return "•" * max(len(value) - keep, 0) + value[-keep:]
