"""Transactional email through Twilio SendGrid's v3 Mail Send API (V22, brief §4).

One sender — `Hangyul Univ <support@talkhangyul.com>` by default — read from server configuration. The API key
is sent as a bearer header and never logged; the response is reduced to a safe `(message_id, status)` pair. A
`console` provider stands in when SendGrid is not configured outside production: it records the send and
exposes nothing (the OTP itself is retrievable only through the dev-only peek endpoint, never from a log).

Production readiness is **not** a property of this module: the From address must be a verified sender and
`talkhangyul.com` must be domain-authenticated (SPF/DKIM) in the SendGrid account — see REPORT §255 for what
could and could not be verified from this host.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

log = logging.getLogger("hangyul.mail")


class MailError(Exception):
    """Sanitised: `code` is a short internal token, `message` is safe to show nobody but operators."""

    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class SendResult:
    provider: str
    message_id: str | None
    status: str  # QUEUED | SENT | SKIPPED


def send_email(*, to: str, subject: str, text: str, html: str | None = None, category: str = "verification") -> SendResult:
    s = get_settings()
    if not s.sendgrid_configured:
        if s.is_production:
            raise MailError("MAIL_NOT_CONFIGURED")
        log.info("mail[console] to=%s subject=%r (body withheld)", to, subject)
        return SendResult("console", None, "SKIPPED")
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": s.sendgrid_from_email, "name": s.sendgrid_from_name},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text}] + ([{"type": "text/html", "value": html}] if html else []),
        "categories": [category],
        "tracking_settings": {"click_tracking": {"enable": False}, "open_tracking": {"enable": False}},
        "mail_settings": {"sandbox_mode": {"enable": False}},
    }
    try:
        r = httpx.post(f"{s.sendgrid_api_base}/v3/mail/send", json=payload,
                       headers={"Authorization": f"Bearer {s.sendgrid_api_key}", "Content-Type": "application/json"}, timeout=10.0)
    except httpx.HTTPError as exc:
        log.warning("sendgrid unreachable: %s", exc.__class__.__name__)
        raise MailError("MAIL_UNREACHABLE")
    if r.status_code not in (200, 202):
        # SendGrid returns a JSON `errors` list; keep only the first machine-readable field, never the body.
        field = None
        try:
            field = (r.json().get("errors") or [{}])[0].get("field")
        except ValueError:
            pass
        log.warning("sendgrid refused: http=%s field=%s", r.status_code, field)
        raise MailError(f"MAIL_HTTP_{r.status_code}")
    return SendResult("sendgrid", r.headers.get("X-Message-Id"), "QUEUED")


def sender_identity() -> dict:
    """What a status surface may show: the From identity and whether a key is present. Never the key."""
    s = get_settings()
    return {"from_email": s.sendgrid_from_email, "from_name": s.sendgrid_from_name, "configured": s.sendgrid_configured}
