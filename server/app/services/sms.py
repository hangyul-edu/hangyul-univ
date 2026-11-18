"""SMS through Twilio Programmable Messaging (V22, brief §7–10).

Authentication is the **API key pair** (`Basic <KeySid>:<KeySecret>` against `/2010-04-01/Accounts/{AccountSid}`),
never the primary auth token, which this module reads for exactly one purpose: validating the signature Twilio
puts on its status callbacks (`twilio.request_validator.RequestValidator` — Twilio signs with the auth token).

The sender is the configured **Messaging Service** (`MessagingServiceSid`), not a hard-coded number, so sender
selection, geo-permissions and compliance live in the Twilio console rather than in code. Where the API supports
it the message is flagged as a verification, and every provider error is reduced to an internal code —
the student sees "인증문자를 보내지 못했어요", not error 30007.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

log = logging.getLogger("hangyul.sms")


class SmsError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class SendResult:
    provider: str
    message_id: str | None
    status: str  # QUEUED | SENT | SKIPPED


TWILIO_STATUS_MAP = {
    "accepted": "QUEUED", "scheduled": "QUEUED", "queued": "QUEUED", "sending": "QUEUED",
    "sent": "SENT", "delivered": "DELIVERED",
    "undelivered": "UNDELIVERED", "failed": "FAILED", "canceled": "FAILED",
}


def send_sms(*, to_e164: str, body: str, status_callback: str | None = None) -> SendResult:
    s = get_settings()
    if not s.twilio_configured:
        if s.is_production:
            raise SmsError("SMS_NOT_CONFIGURED")
        log.info("sms[console] to=%s (body withheld)", to_e164[:-4] + "****")
        return SendResult("console", None, "SKIPPED")
    data = {"To": to_e164, "MessagingServiceSid": s.twilio_messaging_service_sid, "Body": body}
    if status_callback:
        data["StatusCallback"] = status_callback
    url = f"{s.twilio_api_base}/2010-04-01/Accounts/{s.twilio_account_sid}/Messages.json"
    try:
        r = httpx.post(url, data=data, auth=(s.twilio_api_key_sid or "", s.twilio_api_key_secret or ""), timeout=10.0)
    except httpx.HTTPError as exc:
        log.warning("twilio unreachable: %s", exc.__class__.__name__)
        raise SmsError("SMS_UNREACHABLE")
    try:
        body_json = r.json()
    except ValueError:
        body_json = {}
    if r.status_code >= 400:
        code = str(body_json.get("code") or r.status_code)
        log.warning("twilio refused: http=%s code=%s", r.status_code, code)
        raise SmsError(f"SMS_PROVIDER_{code}")
    return SendResult("twilio", body_json.get("sid"), TWILIO_STATUS_MAP.get(str(body_json.get("status")), "QUEUED"))


def validate_callback(url: str, form: dict, signature: str | None) -> bool:
    """Twilio's documented signature check via its SDK. False when unconfigured or unsigned."""
    s = get_settings()
    if not (s.twilio_auth_token and signature):
        return False
    from twilio.request_validator import RequestValidator

    return RequestValidator(s.twilio_auth_token).validate(url, form, signature)


# The SMS wording (per purpose and locale) lives in app/services/messages.py::sms_text.
