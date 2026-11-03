"""V29 logging: structured JSON in production and a redaction filter that runs in every environment.

The filter is the last line of defence, not the first — code must still not log secrets — but a stray
`log.info("config %s", settings)` or an exception message carrying a card number should not become a log line
that an operator, a log vendor or a backup can read. It masks:

* the *values* of every configured secret (`SECRET_FIELDS` in `app/core/config.py`) wherever they appear;
* `name=value` / `"name": "value"` pairs whose name looks like a credential (password, secret, token, api_key …);
* card-number-shaped digit runs (13–19 digits, separators allowed, Luhn-valid);
* one-time-code-shaped values next to a code/otp label.
"""
from __future__ import annotations

import json
import logging
import re
import sys
from datetime import UTC, datetime

REDACTED = "[REDACTED]"

_KEYVAL = re.compile(
    r"""(?ix)
    (?P<key>["']?(?:[a-z0-9_]*?(?:password|passwd|secret|token|api[_-]?key|authorization|auth[_-]?token|private[_-]?key|
        security[_-]?key|encryption[_-]?key|access[_-]?key|cookie|otp|totp|recovery[_-]?code|mfa[_-]?code))["']?)
    (?P<sep>\s*[:=]\s*|\s+)
    (?P<val>"[^"]*"|'[^']*'|Bearer\s+[A-Za-z0-9._~+/=-]+|[^\s,;&}\]]+)
    """
)
_CARD = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{8,}")


def _luhn_ok(digits: str) -> bool:
    total, alt = 0, False
    for ch in reversed(digits):
        d = ord(ch) - 48
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def _mask_card(m: re.Match) -> str:
    digits = re.sub(r"\D", "", m.group(0))
    if 13 <= len(digits) <= 19 and _luhn_ok(digits):
        return f"[CARD ****{digits[-4:]}]"
    return m.group(0)


def _secret_values() -> list[str]:
    try:
        from app.core.config import SECRET_FIELDS, get_settings

        s = get_settings()
    except Exception:  # noqa: BLE001 - logging must never fail because configuration did
        return []
    vals = []
    for name in SECRET_FIELDS:
        v = getattr(s, name, None)
        if isinstance(v, str) and len(v) >= 8:
            vals.append(v)
            # A URL with credentials: also mask the password part on its own.
            m = re.match(r"^[a-z0-9+.-]+://[^:/@]+:([^@]+)@", v)
            if m and len(m.group(1)) >= 4:
                vals.append(m.group(1))
    return sorted(set(vals), key=len, reverse=True)


def redact(text: str, secrets: list[str] | None = None) -> str:
    if not text:
        return text
    for v in (secrets if secrets is not None else _secret_values()):
        if v in text:
            text = text.replace(v, REDACTED)
    text = _BEARER.sub("Bearer " + REDACTED, text)
    text = _KEYVAL.sub(lambda m: f"{m.group('key')}{m.group('sep')}{REDACTED}", text)
    return _CARD.sub(_mask_card, text)


class RedactionFilter(logging.Filter):
    """Rewrites the record's message (args resolved) and any exception text before a handler formats it."""

    def __init__(self) -> None:
        super().__init__()
        self._secrets: list[str] | None = None

    def filter(self, record: logging.LogRecord) -> bool:
        if self._secrets is None:
            self._secrets = _secret_values()
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            msg = str(record.msg)
        record.msg, record.args = redact(msg, self._secrets), None
        if record.exc_info:
            import traceback

            record.exc_text = redact("".join(traceback.format_exception(*record.exc_info)), self._secrets)
            record.exc_info = None
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "method", "path", "status", "duration_ms", "job", "event"):
            if hasattr(record, key):
                out[key] = getattr(record, key)
        if record.exc_text:
            out["exc"] = record.exc_text
        return json.dumps(out, ensure_ascii=False)


_configured = False


def configure_logging(*, json_format: bool, level: int = logging.INFO) -> None:
    """Idempotent. Installs the redaction filter on the root handler (and uvicorn's), JSON formatting when asked."""
    global _configured
    root = logging.getLogger()
    if not root.handlers:
        root.addHandler(logging.StreamHandler(sys.stderr))
    if root.level == logging.NOTSET or root.level > level:
        root.setLevel(level)
    targets = list(root.handlers)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        targets.extend(logging.getLogger(name).handlers)
    for h in targets:
        if not any(isinstance(f, RedactionFilter) for f in h.filters):
            h.addFilter(RedactionFilter())
        if json_format:
            h.setFormatter(JsonFormatter())
    _configured = True
