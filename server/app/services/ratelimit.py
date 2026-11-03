"""Shared rate limiting on Redis (V22, brief §72).

Fixed windows, one `INCR` + `EXPIRE` per hit, so the count is shared by every worker and survives a process
restart — a per-process dictionary would reset on deploy and would let N workers multiply every ceiling by N.

`hit()` never raises on a Redis outage: outside production it logs and allows (a developer without Redis is not
an attacker); in production it **fails closed** with a 503, because an auth endpoint without its limiter is the
thing this module exists to prevent.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

import redis
from fastapi import HTTPException, status

from app.core.config import get_settings

log = logging.getLogger("hangyul.ratelimit")
_client: redis.Redis | None = None
_PREFIX = "hg:rl:"


def _redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(get_settings().redis_url, socket_connect_timeout=1.5, socket_timeout=1.5, decode_responses=True)
    return _client


def hash_id(value: str) -> str:
    """Stable, non-reversible key component for an email, phone or IP. Keys never hold the raw value."""
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()[:32]


@dataclass(frozen=True)
class Limit:
    name: str
    limit: int
    window_seconds: int


# One table of ceilings so the policy can be read in one place (REPORT §263 lists the measured behaviour).
REGISTER_IP = Limit("register_ip", 10, 3600)
LOGIN_EMAIL_FAIL = Limit("login_email_fail", 5, 900)        # → CAPTCHA escalation
LOGIN_EMAIL_HARD = Limit("login_email_hard", 20, 900)       # → progressive delay
LOGIN_IP_FAIL = Limit("login_ip_fail", 60, 900)
FORGOT_EMAIL = Limit("forgot_email", 3, 3600)
FORGOT_IP = Limit("forgot_ip", 20, 3600)
OTP_SEND_TARGET = Limit("otp_send_target", 5, 3600)
OTP_SEND_IP = Limit("otp_send_ip", 20, 3600)
OTP_SEND_IP_DAY = Limit("otp_send_ip_day", 50, 86400)
OTP_VERIFY_IP = Limit("otp_verify_ip", 60, 900)
OTP_VERIFY_TARGET = Limit("otp_verify_target", 15, 900)
SIGNUP_SESSION_IP = Limit("signup_session_ip", 30, 3600)
CONTACT_CHANGE_USER = Limit("contact_change_user", 5, 3600)


def _scaled(limit: Limit) -> int:
    return max(1, limit.limit * max(1, get_settings().ratelimit_scale))


def peek(limit: Limit, subject: str) -> int:
    """Current count without incrementing (0 when unknown)."""
    try:
        v = _redis().get(f"{_PREFIX}{limit.name}:{subject}")
        return int(v) if v else 0
    except redis.RedisError:
        return 0


def hit(limit: Limit, subject: str, *, cost: int = 1) -> tuple[bool, int]:
    """Record one hit. Returns (allowed, retry_after_seconds)."""
    key = f"{_PREFIX}{limit.name}:{subject}"
    try:
        r = _redis()
        with r.pipeline() as p:
            p.incrby(key, cost)
            p.ttl(key)
            count, ttl = p.execute()
        if ttl is None or ttl < 0:
            r.expire(key, limit.window_seconds)
            ttl = limit.window_seconds
        allowed = int(count) <= _scaled(limit)
        return allowed, (0 if allowed else max(1, int(ttl)))
    except redis.RedisError as exc:
        if get_settings().ratelimit_fail_open_effective:
            log.warning("rate limiter unavailable (%s) — allowing %s", exc.__class__.__name__, limit.name)
            return True, 0
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "RATE_LIMITER_UNAVAILABLE", "message": "Please try again shortly."})


def reset(limit: Limit, subject: str) -> None:
    try:
        _redis().delete(f"{_PREFIX}{limit.name}:{subject}")
    except redis.RedisError:
        pass


def reset_all() -> int:
    """Test helper: drop every limiter key. Never called by product code."""
    try:
        r = _redis()
        keys = list(r.scan_iter(f"{_PREFIX}*", count=500))
        return r.delete(*keys) if keys else 0
    except redis.RedisError:
        return 0


def too_many(retry_after: int, code: str = "RATE_LIMITED", **extra) -> HTTPException:
    """The one shape every limited endpoint answers with: 429, `Retry-After`, a stable code, no disclosure."""
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        {"code": code, "retry_after": retry_after, **extra},
        headers={"Retry-After": str(retry_after)},
    )
