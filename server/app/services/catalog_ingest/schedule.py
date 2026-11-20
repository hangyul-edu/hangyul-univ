"""The weekly refresh calendar: every Monday 09:00 **Asia/Seoul** (not UTC).

``weekly_window(now)`` is the schedule window a refresh at ``now`` belongs to — the most recent Monday 09:00 KST at or
before ``now`` — and ``next_refresh_at(now)`` the next one. The worker ledger (``job_runs``) is keyed on the window,
so a window runs at most once to success however many processes tick.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
REFRESH_WEEKDAY = 0  # Monday
REFRESH_HOUR = 9


def weekly_window(now: datetime) -> datetime:
    local = now.astimezone(KST)
    monday = (local - timedelta(days=(local.weekday() - REFRESH_WEEKDAY) % 7)).date()
    candidate = datetime(monday.year, monday.month, monday.day, REFRESH_HOUR, tzinfo=KST)
    if candidate > local:
        candidate -= timedelta(days=7)
    return candidate.astimezone(UTC)


def next_refresh_at(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return (weekly_window(now) + timedelta(days=7)).astimezone(UTC)


def kst_iso(dt: datetime | None) -> str | None:
    return dt.astimezone(KST).isoformat() if dt else None
