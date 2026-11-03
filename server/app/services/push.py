"""Push delivery adapter. `HG_PUSH_PROVIDER=none` (default) records nothing externally; `expo` posts to the Expo push
service after the database transaction commits. Delivery failures never affect the in-app notification."""
from __future__ import annotations

import logging

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import PushToken

log = logging.getLogger("hangyul.push")
EXPO_URL = "https://exp.host/--/api/v2/push/send"


def queue_push(db: Session, user_id, title: str, link: str | None) -> None:
    if get_settings().push_provider != "expo":
        return
    tokens = db.scalars(select(PushToken.token).where(PushToken.user_id == user_id, PushToken.disabled_at.is_(None))).all()
    if not tokens:
        return
    messages = [{"to": t, "title": title, "data": {"link": link}} for t in tokens]
    pending = db.info.setdefault("push_outbox", [])
    pending.extend(messages)


def flush_outbox(messages: list[dict]) -> None:
    if not messages:
        return
    try:
        import httpx

        httpx.post(EXPO_URL, json=messages, timeout=5)
    except Exception:  # noqa: BLE001 — push is best-effort by design
        log.warning("Push delivery failed for %d message(s)", len(messages))


@event.listens_for(Session, "after_commit")
def _send_after_commit(session: Session) -> None:
    messages = session.info.pop("push_outbox", None)
    if messages:
        flush_outbox(messages)


@event.listens_for(Session, "after_rollback")
def _drop_on_rollback(session: Session) -> None:
    session.info.pop("push_outbox", None)
