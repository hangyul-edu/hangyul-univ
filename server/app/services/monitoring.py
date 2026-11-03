"""V29 operational monitoring: failure records, an optional alert webhook and the HQ health summary.

`record()` is called from the places where something went wrong that a person should know about — an unhandled API
error (5xx), a worker job failure, a payment-provider transport error, a verification-delivery failure, a malware-scan
error or detection. It writes an `ops_events` row on **its own session** (so the failure that is being reported
cannot roll the report back) and never raises.

The alert webhook (`HG_ALERT_WEBHOOK_URL`, e.g. a Slack/Teams/Opsgenie incoming webhook) receives a small JSON
summary, at most once per kind per `HG_ALERT_MIN_INTERVAL_SECONDS` (Redis `SET NX EX`; in-process fallback). The
payload is built from an allow-list — kind, severity, source, summary, counts, ids — and every string passes the log
redaction filter, so document contents, OTPs, card data and secrets never leave the process.
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logs import redact
from app.models.base import utcnow

log = logging.getLogger("hangyul.monitoring")

KINDS = ("API_5XX", "JOB_FAILED", "PAYMENT_ERROR", "DELIVERY_FAILED", "SCAN_ERROR", "MALWARE_DETECTED", "STORAGE_ERROR")
#: Keys whose values are never copied into an event or an alert, whatever the caller passes.
_DENY_KEYS = {"code", "otp", "password", "secret", "token", "card", "card_number", "cvc", "content", "data", "body", "file", "authorization"}
_ALLOWED_TYPES = (str, int, float, bool, type(None))
_local_last_alert: dict[str, float] = {}


def sanitise(detail: dict | None) -> dict | None:
    if not detail:
        return None
    out: dict[str, Any] = {}
    for k, v in list(detail.items())[:20]:
        key = str(k)[:40]
        if key.lower() in _DENY_KEYS or any(d in key.lower() for d in ("secret", "password", "token", "otp", "card")):
            continue
        if not isinstance(v, _ALLOWED_TYPES):
            v = str(v)
        out[key] = redact(v)[:300] if isinstance(v, str) else v
    return out


def record(kind: str, source: str, summary: str, *, detail: dict | None = None, severity: str = "error", alert: bool = True) -> None:
    """Persist one failure record (own transaction) and maybe alert. Never raises."""
    try:
        from app.core.db import SessionLocal
        from app.models.v29_security import OpsEvent

        clean_summary = redact(summary or kind)[:500]
        clean = sanitise(detail)
        with SessionLocal() as s:
            ev = OpsEvent(kind=kind[:40], severity=severity[:12], source=redact(source)[:200], summary=clean_summary, detail=clean, created_at=utcnow())
            s.add(ev)
            s.commit()
            event_id = str(ev.id)
        log.warning("ops_event kind=%s source=%s summary=%s", kind, source, clean_summary)
        if alert:
            maybe_alert(kind, {"id": event_id, "kind": kind, "severity": severity, "source": source[:200], "summary": clean_summary, "detail": clean})
    except Exception:  # noqa: BLE001 - monitoring must never take the request down with it
        log.exception("could not record ops event %s", kind)


def _claim_alert_slot(kind: str) -> bool:
    interval = max(1, get_settings().alert_min_interval_seconds)
    try:
        from app.services import ratelimit

        return bool(ratelimit._redis().set(f"hg:alert:{kind}", "1", nx=True, ex=interval))
    except Exception:  # noqa: BLE001 - Redis down: fall back to a per-process window
        now = time.monotonic()
        if now - _local_last_alert.get(kind, -1e9) < interval:
            return False
        _local_last_alert[kind] = now
        return True


def build_payload(event: dict) -> dict:
    s = get_settings()
    return {
        "text": f"[Hangyul Univ {s.env}] {event.get('kind')}: {event.get('summary')}",
        "service": "hangyul-univ-api",
        "environment": s.env,
        "event": {k: event.get(k) for k in ("id", "kind", "severity", "source", "summary", "detail")},
        "at": utcnow().isoformat(),
    }


def send_webhook(url: str, payload: dict) -> bool:
    import httpx

    try:
        r = httpx.post(url, json=payload, timeout=5.0)
        return r.status_code < 400
    except httpx.HTTPError:
        return False


def maybe_alert(kind: str, event: dict, *, background: bool = True) -> bool:
    url = get_settings().alert_webhook_url
    if not url or not _claim_alert_slot(kind):
        return False
    payload = build_payload(event)

    def _send() -> None:
        ok = send_webhook(url, payload)
        if ok and event.get("id"):
            try:
                import uuid as _uuid

                from app.core.db import SessionLocal
                from app.models.v29_security import OpsEvent

                with SessionLocal() as s:
                    ev = s.get(OpsEvent, _uuid.UUID(event["id"]))
                    if ev:
                        ev.alerted = True
                        s.commit()
            except Exception:  # noqa: BLE001
                pass
        if not ok:
            log.warning("alert webhook delivery failed for %s", kind)

    if background:
        threading.Thread(target=_send, daemon=True).start()
    else:
        _send()
    return True


def health_summary(db: Session, *, hours: int = 24) -> dict:
    """What the HQ console shows: recent failures by kind, the worker's last run per job, scan backlog."""
    from app.models import DocumentVersion, MessageAttachment
    from app.models.v29_security import JobRun, OpsEvent

    since = utcnow() - timedelta(hours=hours)
    by_kind = dict(db.execute(select(OpsEvent.kind, func.count()).where(OpsEvent.created_at >= since).group_by(OpsEvent.kind)).all())
    recent = db.scalars(select(OpsEvent).where(OpsEvent.created_at >= since).order_by(OpsEvent.created_at.desc()).limit(20)).all()
    jobs = {}
    for r in db.scalars(select(JobRun).order_by(JobRun.scheduled_for.desc()).limit(200)):
        if r.name not in jobs:
            jobs[r.name] = {"status": r.status, "scheduled_for": r.scheduled_for.isoformat(), "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                            "attempts": r.attempts, "error": (r.error or "")[:300] or None}
    scan = {}
    for model, label in ((DocumentVersion, "document_versions"), (MessageAttachment, "message_attachments")):
        scan[label] = dict(db.execute(select(model.scan_status, func.count()).where(model.scan_status.in_(["PENDING", "ERROR", "INFECTED"]))
                                      .group_by(model.scan_status)).all())
    failed_jobs = sum(1 for j in jobs.values() if j["status"] == "FAILED")
    backlog = sum(v for d in scan.values() for k, v in d.items() if k in ("PENDING", "ERROR"))
    status = "OK" if not by_kind and not failed_jobs else "DEGRADED"
    return {
        "status": status,
        "window_hours": hours,
        "failures": {k: int(v) for k, v in by_kind.items()},
        "recent": [{"id": str(e.id), "kind": e.kind, "severity": e.severity, "source": e.source, "summary": e.summary, "at": e.created_at.isoformat(),
                    "alerted": e.alerted} for e in recent],
        "jobs": jobs,
        "scan": scan,
        "scan_backlog": backlog,
        "alert_webhook_configured": bool(get_settings().alert_webhook_url),
    }
