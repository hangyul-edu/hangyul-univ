"""Catalogue bootstrap and the in-process scheduler.

Bootstrap (owner requirement 3): when the catalogue has no universities —

    1. seed the reference directory first if there are no institutions (reference data only: no users, no fixtures);
    2. run the pipeline (kind BOOTSTRAP, no network): materialise one University per ACTIVE institution, import the
       official programme units, intakes and language minimums, relink the V27 research rows;
    3. write the durable bootstrap marker (``catalog_state['bootstrap']``);
    4. enqueue a revalidation (``catalog_state['revalidation']``) — the official-link check runs later, under the
       scheduler/worker, never in the start-up path.

It runs automatically from the API lifespan in a background thread, guarded by the catalogue advisory lock so several
processes never double-run; it never blocks start-up, and the non-empty check plus the marker keep a restart from
re-running it. The same function is the ``catalog_bootstrap`` worker job and ``python -m app.services.catalog_ingest
bootstrap``.

Scheduler: ``start_scheduler()`` ticks every ``catalog_scheduler_tick_seconds`` and calls the worker's own locked
``run_job`` for ``catalog_refresh`` (window = the most recent Monday 09:00 Asia/Seoul) and ``catalog_revalidate``
(window = the pending request), so the refresh happens even where the separate worker is not deployed — and when it
is, the job ledger and advisory locks make the two cooperate instead of double-running.
"""

from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Institution, University
from app.services.catalog_ingest import pipeline, status

log = logging.getLogger("hangyul.catalog")
_threads: dict[str, threading.Thread] = {}
_stop = threading.Event()


def needs_bootstrap(db: Session) -> bool:
    if db.scalar(select(func.count()).select_from(University)):
        return False
    marker = pipeline.get_state(db, "bootstrap") or {}
    # A bootstrap that completed with nothing to load (no reference data at all) is not retried on every restart.
    if marker.get("completed_at") and not marker.get("universities"):
        done = datetime.fromisoformat(marker["completed_at"])
        if datetime.now(UTC) - done < timedelta(days=1):
            return False
    return True


def seed_reference_if_empty(db: Session) -> dict | None:
    if db.scalar(select(func.count()).select_from(Institution)):
        return None
    from app.seed.run import seed_reference_all

    out = seed_reference_all(db)
    db.commit()
    return out


def run_bootstrap(*, trigger: str = "CLI", sf: sessionmaker | None = None, eng: Engine | None = None, sources=None) -> dict:
    sf_d, eng_d = pipeline._defaults() if (sf is None or eng is None) else (sf, eng)
    sf, eng = sf or sf_d, eng or eng_d
    with pipeline.catalog_lock(eng) as got:
        if not got:
            return {"status": "BUSY"}
        with sf() as db:
            if not needs_bootstrap(db):
                return {"status": "NOT_NEEDED", **status.summary(db, cached=False)}
            seeded = seed_reference_if_empty(db)
        result = pipeline.run(kind="BOOTSTRAP", trigger=trigger, full=False, sf=sf, eng=eng, sources=sources, locked=True,
                              link_checks=False)
        with sf() as db:
            now = datetime.now(UTC).isoformat()
            pipeline.set_state(db, "bootstrap", {"completed_at": now, "run_id": result["id"], "status": result["status"],
                                                 "universities": result["universities"], "programmes": result["programmes"],
                                                 "reference_seeded": bool(seeded)})
            request_revalidation(db, reason="bootstrap")
            db.commit()
        status.invalidate()
        return {"status": result["status"], "run": result, "reference_seeded": seeded}


def request_revalidation(db: Session, *, reason: str) -> None:
    pipeline.set_state(db, "revalidation", {"requested_at": datetime.now(UTC).isoformat(), "reason": reason, "done_at": None})


# ------------------------------------------------------------------------------------------------ worker job windows

def revalidation_window(now: datetime) -> datetime | None:
    """The pending revalidation request is its own window (one ledger row per request); None when nothing is pending."""
    from app.core.db import SessionLocal

    with SessionLocal() as db:
        st = pipeline.get_state(db, "revalidation") or {}
    if not st.get("requested_at") or st.get("done_at"):
        return None
    return datetime.fromisoformat(st["requested_at"]).replace(microsecond=0)


def bootstrap_window(now: datetime) -> datetime | None:
    from app.core.db import SessionLocal

    with SessionLocal() as db:
        if not needs_bootstrap(db):
            return None
    ts = int(now.timestamp())
    return datetime.fromtimestamp(ts - ts % 300, UTC)


def job_refresh(db: Session) -> dict:
    db.close()  # the pipeline manages its own sessions and the catalogue lock
    out = pipeline.run(kind="REFRESH", trigger="SCHEDULE", full=True)
    if out.get("full"):
        _mark_revalidated(out["id"])  # a full refresh is also the revalidation a bootstrap asked for
    status.invalidate()
    return out


def _mark_revalidated(run_id: str) -> None:
    from app.core.db import SessionLocal

    with SessionLocal() as s:
        st = pipeline.get_state(s, "revalidation")
        if st and st.get("requested_at") and not st.get("done_at"):
            st.update(done_at=datetime.now(UTC).isoformat(), run_id=run_id)
            pipeline.set_state(s, "revalidation", st)
            s.commit()


def job_revalidate(db: Session) -> dict:
    db.close()
    out = pipeline.run(kind="REVALIDATE", trigger="SCHEDULE", full=True)
    _mark_revalidated(out["id"])  # done even when partial: the next weekly refresh re-checks every link
    status.invalidate()
    return out


def job_bootstrap(db: Session) -> dict:
    db.close()
    return run_bootstrap(trigger="WORKER")


# ------------------------------------------------------------------------------------------------ API lifespan threads

def _bootstrap_thread() -> None:
    try:
        out = run_bootstrap(trigger="STARTUP")
        log.info("catalogue bootstrap: %s", out.get("status"))
    except Exception:  # noqa: BLE001 - never takes the API down
        log.exception("catalogue bootstrap failed")


def _scheduler_loop(tick: int) -> None:
    from app.worker import JOBS, run_job

    while not _stop.is_set():
        for name in ("catalog_refresh", "catalog_revalidate"):
            try:
                out = run_job(JOBS[name])
                if out not in ("SKIPPED_DONE", "SKIPPED_NOT_DUE", "SKIPPED_LOCKED", "SKIPPED_BACKOFF"):
                    log.info("catalogue scheduler: %s → %s", name, out)
            except Exception:  # noqa: BLE001 - the loop survives a database blip
                log.exception("catalogue scheduler tick failed (%s)", name)
        _stop.wait(max(30, tick))


def start_background(*, bootstrap: bool, scheduler: bool, tick: int = 300) -> None:
    """Called from the FastAPI lifespan. Daemon threads: start-up never waits for them."""
    _stop.clear()
    if bootstrap and not (_threads.get("bootstrap") and _threads["bootstrap"].is_alive()):
        t = threading.Thread(target=_bootstrap_thread, name="catalog-bootstrap", daemon=True)
        _threads["bootstrap"] = t
        t.start()
    if scheduler and not (_threads.get("scheduler") and _threads["scheduler"].is_alive()):
        def loop():
            if (b := _threads.get("bootstrap")) is not None:
                b.join()  # first tick after the bootstrap, so the revalidation it enqueues follows it
            _scheduler_loop(tick)

        t = threading.Thread(target=loop, name="catalog-scheduler", daemon=True)
        _threads["scheduler"] = t
        t.start()


def stop_background() -> None:
    _stop.set()
