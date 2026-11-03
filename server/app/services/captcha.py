"""Cloudflare Turnstile verification (V22, brief §13–14).

The browser only ever obtains a challenge token; the **server** asks Cloudflare whether that token is genuine,
with the secret key that never leaves this process. Cloudflare's documented testing keys are recognised so that a
development machine exercises the real request path without a network round-trip, and so that no production
bypass exists anywhere in this file: production with no keys cannot verify anything and refuses.

Testing keys (https://developers.cloudflare.com/turnstile/troubleshooting/testing/):
  site 1x00000000000000000000AA / secret 1x0000000000000000000000000000000AA  → always passes
  site 2x00000000000000000000AB / secret 2x0000000000000000000000000000000AA  → always blocks
  site 3x00000000000000000000FF / secret 3x0000000000000000000000000000000AA  → token already spent
"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

log = logging.getLogger("hangyul.captcha")
TEST_SECRET_PASS = "1x0000000000000000000000000000000AA"
TEST_SECRET_FAIL = "2x0000000000000000000000000000000AA"
TEST_SECRET_SPENT = "3x0000000000000000000000000000000AA"
TEST_SECRETS = {TEST_SECRET_PASS, TEST_SECRET_FAIL, TEST_SECRET_SPENT}


def not_configured() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                         {"code": "CAPTCHA_NOT_CONFIGURED", "message": "Sign-up is temporarily unavailable."})


def failed(code: str = "CAPTCHA_FAILED") -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, {"code": code, "message": "Please complete the verification and try again."})


def verify_token(token: str | None, remote_ip: str | None) -> dict:
    """Raise on anything that is not a genuine, fresh pass. Returns the provider's (sanitised) result."""
    s = get_settings()
    if not s.captcha_required:
        return {"success": True, "mode": "not_required"}
    if not s.turnstile_configured:
        raise not_configured()
    if not token or len(token) > 2048:
        raise failed("CAPTCHA_REQUIRED")
    secret = s.turnstile_secret_key or ""
    if secret in TEST_SECRETS:
        # Cloudflare's own documented behaviour for each test secret, reproduced locally.
        if secret == TEST_SECRET_PASS:
            return {"success": True, "mode": "test_pass"}
        raise failed("CAPTCHA_FAILED" if secret == TEST_SECRET_FAIL else "CAPTCHA_SPENT")
    data = {"secret": secret, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        r = httpx.post(s.turnstile_verify_url, data=data, timeout=6.0)
        body = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("turnstile siteverify unreachable: %s", exc.__class__.__name__)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "CAPTCHA_UNAVAILABLE", "message": "Please try again shortly."})
    if not body.get("success"):
        log.info("turnstile rejected token: %s", body.get("error-codes"))
        raise failed()
    return {"success": True, "mode": "live", "hostname": body.get("hostname")}
