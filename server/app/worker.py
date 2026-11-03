"""V29 durable background worker: `python -m app.worker` (loop), `--once` (one pass), `--job NAME` (run one job now).

No new distributed system. A single-process scheduler loop backed by Postgres:

* Each job has an interval; the **schedule window** is `floor(now / interval)`. `job_runs` has a unique key on
  `(name, scheduled_for)`, so a window can only ever have one ledger row.
* A Postgres **session advisory lock** per job (`pg_try_advisory_lock`) means two worker replicas never execute the same
  job at the same moment; the loser simply skips.
* Under the lock the worker reads the window's row: SUCCEEDED → skip; RUNNING with a live lock is impossible, so a
  RUNNING row is a crashed attempt and is retried; FAILED → retried with backoff up to `max_attempts`.
* Delivery is **at-least-once**, so every job is idempotent (the daily rebuild, rescans of PENDING rows only,
  retention by cutoff, cleanup by age).
* A failure is recorded on the row (error text, attempts) and as a `JOB_FAILED` ops event (alert webhook).

Ops: `infra/systemd/hangyul-worker.service`. `--once` exits non-zero if any job failed.
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import os
import signal
import socket
import sys
import time
import traceback
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.core.logs import configure_logging
from app.models.v29_security import JobRun

log = logging.getLogger("hangyul.worker")
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"


@dataclass(frozen=True)
class Job:
    name: str
    interval_seconds: int
    fn: Callable[[Session], dict]
    max_attempts: int = 5
    retry_backoff_seconds: int = 300


# ------------------------------------------------------------------------------------------------ jobs (idempotent)
def job_daily(db: Session) -> dict:
    """The contents of `app/jobs/daily.py` (reminders/deadlines via the task engine, stale-source scan, rollups, writing SLA)."""
    from app.jobs.daily import run as daily_run

    return daily_run(db)


def job_scan_retry(db: Session) -> dict:
    from app.core.scanning import rescan_pending

    return rescan_pending(db)


def job_retention(db: Session) -> dict:
    from app.services import retention

    report = retention.run(db, dry_run=False)
    return {"status": report["status"]["policy"], "affected": {k: v.get("affected", 0) for k, v in report["policies"].items()},
            "skipped": [k for k, v in report["policies"].items() if v.get("skipped")]}


def job_cleanup(db: Session) -> dict:
    """Export/temporary cleanup: expired verification challenges (> 24 h), unconfirmed MFA enrolments (> 1 day), local
    export scratch files older than a day. Operational hygiene only — personal-data retention is the retention job."""
    from app.services import mfa, verification

    challenges = verification.purge_expired(db, older_than_hours=24)
    pending_mfa = mfa.pending_older_than(db, 1)
    db.commit()
    removed = 0
    s = get_settings()
    export_dir = s.storage_path / "exports"
    if export_dir.is_dir():
        cutoff = time.time() - 86400
        for f in export_dir.rglob("*"):
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
                removed += 1
    return {"verification_challenges": challenges, "pending_mfa": pending_mfa, "export_files": removed}


def job_notifications(db: Session) -> dict:
    """Notification dispatch. In-app notifications are written inline by the API; the only queued channel is push,
    whose sender (`services/push.py`) is synchronous today. This job reports the backlog so a stuck queue is visible."""
    from sqlalchemy import func

    from app.models import Notification

    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.read_at.is_(None))) or 0
    return {"unread_in_app": int(unread), "queued_push": 0}


JOBS: dict[str, Job] = {j.name: j for j in (
    Job("daily", 86400, job_daily, max_attempts=3, retry_backoff_seconds=900),
    Job("scan_retry", 300, job_scan_retry),
    Job("retention", 86400, job_retention, max_attempts=3, retry_backoff_seconds=3600),
    Job("cleanup", 3600, job_cleanup),
    Job("notifications", 300, job_notifications),
)}


# ------------------------------------------------------------------------------------------------ scheduling
def window_for(job: Job, now: datetime) -> datetime:
    ts = int(now.timestamp())
    return datetime.fromtimestamp(ts - ts % job.interval_seconds, UTC)


def lock_key(name: str) -> int:
    return int.from_bytes(hashlib.sha256(f"hangyul-worker:{name}".encode()).digest()[:8], "big", signed=True)


def run_job(job: Job, *, now: datetime | None = None, force: bool = False) -> str:
    """Run one job for its current window if due. Returns SUCCEEDED | FAILED | SKIPPED_LOCKED | SKIPPED_DONE | SKIPPED_BACKOFF."""
    now = now or datetime.now(UTC)
    window = window_for(job, now)
    with engine.connect() as lock_conn:
        got = lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key(job.name)}).scalar()
        lock_conn.commit()
        if not got:
            return "SKIPPED_LOCKED"
        try:
            return _run_locked(job, window, now, force)
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key(job.name)})
            lock_conn.commit()


def _run_locked(job: Job, window: datetime, now: datetime, force: bool) -> str:
    with SessionLocal() as db:
        row = db.scalar(select(JobRun).where(JobRun.name == job.name, JobRun.scheduled_for == window))
        if row is None:
            row = JobRun(name=job.name, scheduled_for=window, status="RUNNING", attempts=0)
            db.add(row)
            try:
                db.commit()
            except IntegrityError:  # another replica inserted it between our read and write (it then held the lock)
                db.rollback()
                return "SKIPPED_LOCKED"
        if row.status == "SUCCEEDED" and not force:
            return "SKIPPED_DONE"
        if row.status == "FAILED" and not force:
            if row.attempts >= job.max_attempts:
                return "SKIPPED_DONE"
            if row.finished_at and datetime.now(UTC) < row.finished_at + timedelta(seconds=job.retry_backoff_seconds * row.attempts):
                return "SKIPPED_BACKOFF"
        row.status, row.started_at, row.finished_at, row.error, row.worker_id = "RUNNING", now, None, None, WORKER_ID
        row.attempts += 1
        db.commit()
        run_id = row.id
    try:
        with SessionLocal() as db:
            result = job.fn(db) or {}
            db.commit()
        outcome, error = "SUCCEEDED", None
    except Exception as exc:  # noqa: BLE001 - recorded, surfaced, retried
        outcome, error, result = "FAILED", "".join(traceback.format_exception_only(type(exc), exc)).strip()[:2000], None
        log.exception("job %s failed", job.name)
    with SessionLocal() as db:
        row = db.get(JobRun, run_id)
        row.status, row.finished_at, row.error = outcome, datetime.now(UTC), error
        row.result = _jsonable(result) if result is not None else None
        attempts = row.attempts
        db.commit()
    if outcome == "FAILED":
        from app.services import monitoring

        monitoring.record("JOB_FAILED", f"worker.{job.name}", f"job {job.name} failed (attempt {attempts}/{job.max_attempts})",
                          detail={"job": job.name, "attempts": attempts, "error": (error or "")[:200]})
    return outcome


def _jsonable(v):
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    return v if isinstance(v, (str, int, float, bool, type(None))) else str(v)


def run_pass(names: list[str] | None = None, *, force: bool = False) -> dict[str, str]:
    return {n: run_job(JOBS[n], force=force) for n in (names or list(JOBS))}


_stop = False


def _handle_stop(*_):
    global _stop
    _stop = True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.worker")
    ap.add_argument("--once", action="store_true", help="run every due job once and exit")
    ap.add_argument("--job", choices=sorted(JOBS), help="run this job now (forces a re-run of the current window)")
    ap.add_argument("--list", action="store_true", help="list jobs and their intervals")
    args = ap.parse_args(argv)
    configure_logging(json_format=get_settings().log_json)
    if args.list:
        for j in JOBS.values():
            print(f"{j.name:15s} every {j.interval_seconds:>6d}s  max_attempts={j.max_attempts}")
        return 0
    if args.job:
        out = run_pass([args.job], force=True)
        print(out)
        return 0 if out[args.job] in ("SUCCEEDED", "SKIPPED_LOCKED") else 1
    if args.once:
        out = run_pass()
        print(out)
        return 1 if "FAILED" in out.values() else 0
    signal.signal(signal.SIGTERM, _handle_stop)
    signal.signal(signal.SIGINT, _handle_stop)
    log.info("worker %s started; jobs=%s", WORKER_ID, ",".join(JOBS))
    while not _stop:
        try:
            run_pass()
        except Exception:  # noqa: BLE001 - the loop survives a database blip
            log.exception("worker pass failed")
        for _ in range(max(1, get_settings().worker_poll_seconds)):
            if _stop:
                break
            time.sleep(1)
    log.info("worker %s stopped", WORKER_ID)
    return 0


if __name__ == "__main__":
    sys.exit(main())
