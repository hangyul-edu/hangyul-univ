"""Message channel model (V8; V9 adds Zalo and per-message delivery state).

One conversation timeline, many possible delivery channels. Only IN_APP is live. External channels (email, WhatsApp,
KakaoTalk, SMS) are registered so the product can show them honestly, but none is integrated: sending on one raises
`ChannelNotConfigured`, which the API turns into a 409 with a plain sentence. A channel is never reported as active
just because an environment variable exists — credentials alone are not a working, contracted integration, so a
configured-looking channel is reported as NEEDS_AGREEMENT until an adapter is actually implemented.

Status vocabulary (shared with the production-readiness page):
  ACTIVE           messages are delivered through this channel
  NOT_CONFIGURED   no provider credentials are present
  NEEDS_AGREEMENT  credentials are present but no adapter/provider agreement is in place — nothing is sent
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Protocol

ACTIVE = "ACTIVE"
NOT_CONFIGURED = "NOT_CONFIGURED"
NEEDS_AGREEMENT = "NEEDS_AGREEMENT"


class ChannelNotConfigured(Exception):
    """Raised when something tries to send or ingest on a channel that is not connected."""

    def __init__(self, code: str, status: str):
        self.code, self.status = code, status
        label = CHANNEL_LABELS.get(code, code)
        if status == NEEDS_AGREEMENT:
            msg = f"{label} is not connected yet: credentials exist but no provider agreement or adapter is in place. Nothing was sent — use in-app messages."
        else:
            msg = f"{label} is not connected: it needs provider credentials. Nothing was sent — use in-app messages."
        super().__init__(msg)


class UnknownChannel(Exception):
    pass


@dataclass(frozen=True)
class SendResult:
    channel: str
    delivered: bool
    external_ref: str | None = None


class ChannelAdapter(Protocol):
    code: str
    #: environment variables a real provider integration would need (presence only is checked; values never read out)
    env_keys: tuple[str, ...]

    def status(self) -> str: ...

    def send(self, *, to_user_id: Any, body: str, conversation_id: Any) -> SendResult: ...

    def ingest(self, payload: dict) -> dict: ...


class InAppAdapter:
    """The live channel: the message row itself is the delivery (students read it in the app)."""
    code = "IN_APP"
    env_keys: tuple[str, ...] = ()

    def status(self) -> str:
        return ACTIVE

    def send(self, *, to_user_id: Any, body: str, conversation_id: Any) -> SendResult:
        return SendResult(channel=self.code, delivered=True)

    def ingest(self, payload: dict) -> dict:
        # In-app replies arrive through POST /conversations/{id}/messages; there is no webhook to ingest.
        return {"accepted": False, "reason": "In-app messages are posted through the API, not ingested."}


class ExternalAdapter:
    """A registered-but-unconnected provider. Every operation refuses with a clear error."""

    def __init__(self, code: str, env_keys: tuple[str, ...]):
        self.code, self.env_keys = code, env_keys

    def status(self) -> str:
        present = bool(self.env_keys) and all(os.environ.get(k) for k in self.env_keys)
        return NEEDS_AGREEMENT if present else NOT_CONFIGURED

    def send(self, *, to_user_id: Any, body: str, conversation_id: Any) -> SendResult:
        raise ChannelNotConfigured(self.code, self.status())

    def ingest(self, payload: dict) -> dict:
        raise ChannelNotConfigured(self.code, self.status())


CHANNEL_LABELS = {"IN_APP": "In-app messages", "EMAIL": "Email", "WHATSAPP": "WhatsApp", "KAKAO": "KakaoTalk", "ZALO": "Zalo", "SMS": "SMS"}

_REGISTRY: dict[str, ChannelAdapter] = {}


def register(adapter: ChannelAdapter) -> None:
    _REGISTRY[adapter.code] = adapter


def get(code: str) -> ChannelAdapter:
    try:
        return _REGISTRY[code.upper()]
    except KeyError as e:
        raise UnknownChannel(code) from e


def codes() -> list[str]:
    return list(_REGISTRY)


def statuses() -> list[dict]:
    """Every registered channel with its honest status and what it would need (env names only, never values)."""
    out = []
    for code, a in _REGISTRY.items():
        st = a.status()
        out.append({"code": code, "label": CHANNEL_LABELS.get(code, code), "status": st, "can_send": st == ACTIVE,
                    "requires": list(a.env_keys)})
    return out


def send(code: str, *, to_user_id: Any, body: str, conversation_id: Any) -> SendResult:
    return get(code).send(to_user_id=to_user_id, body=body, conversation_id=conversation_id)


register(InAppAdapter())
register(ExternalAdapter("EMAIL", ("HG_SMTP_HOST", "HG_SMTP_USER", "HG_SMTP_PASSWORD")))
register(ExternalAdapter("WHATSAPP", ("HG_WHATSAPP_TOKEN", "HG_WHATSAPP_PHONE_ID")))
register(ExternalAdapter("KAKAO", ("HG_KAKAO_API_KEY", "HG_KAKAO_SENDER_KEY")))
# V9: Zalo (Vietnam's main messenger) — registered so it is shown honestly; no Zalo Official Account or ZNS agreement exists.
register(ExternalAdapter("ZALO", ("HG_ZALO_OA_ID", "HG_ZALO_ACCESS_TOKEN")))
register(ExternalAdapter("SMS", ("HG_SMS_API_KEY", "HG_SMS_SENDER")))


# ---------------------------------------------------------------------------------------- V9 per-message delivery

SENT, READ, FAILED = "SENT", "READ", "FAILED"


def delivery_states(db, conversation, messages) -> dict[str, dict]:
    """Delivery state of every outbound (team → student) message in one conversation, from real records only:
    IN_APP is SENT when stored and READ once the student's read marker (MessageRead.last_read_at) is at or after it.
    FAILED only when a provider reported a failure — no provider is connected, so in-app messages never fail here.
    Student messages and internal notes carry no delivery state."""
    from sqlalchemy import select

    from app.models import MessageRead
    from app.models.enums import MessageVisibility

    sid = conversation.student_user_id
    read_at = db.scalar(select(MessageRead.last_read_at).where(MessageRead.conversation_id == conversation.id, MessageRead.user_id == sid)) if sid else None
    out = {}
    for m in messages:
        if m.visibility != MessageVisibility.PARTICIPANTS or m.author_user_id == sid or sid is None:
            continue
        state = READ if read_at and read_at >= m.created_at else SENT
        out[str(m.id)] = {"state": state, "channel": m.channel or "IN_APP", "read_at": read_at.isoformat() if state == READ else None}
    return out
