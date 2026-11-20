"""What the catalogue holds right now, and whether it is READY, PREPARING or EMPTY.

``READY``      the catalogue has universities and at least one active programme.
``PREPARING``  the catalogue is being built (a bootstrap/refresh is running) or holds universities whose programme
               information is still being prepared (no active programme yet).
``EMPTY``      nothing has been loaded and nothing is running.

The distinction is what lets a student screen say "no programme matches these filters" (READY, filter returned 0)
instead of "programme information is being prepared" (PREPARING) — never the same empty list for both.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AdmissionGuide,
    AdmissionRequirement,
    CatalogIngestionRun,
    CatalogLinkCheck,
    CatalogSourceResult,
    DocumentRequirement,
    Dormitory,
    Institution,
    Program,
    ProgramIntake,
    Scholarship,
    University,
)
from app.services.catalog_ingest.schedule import kst_iso, next_refresh_at

#: A RUNNING row older than this is a crashed run, not a running one.
RUNNING_STALE_AFTER = timedelta(hours=3)
_cache: dict = {"at": 0.0, "value": None}
_TTL = 30.0


def _n(db: Session, stmt) -> int:
    return int(db.scalar(stmt) or 0)


def running(db: Session) -> bool:
    cutoff = datetime.now(UTC) - RUNNING_STALE_AFTER
    return bool(db.scalar(select(func.count()).select_from(CatalogIngestionRun)
                          .where(CatalogIngestionRun.status == "RUNNING", CatalogIngestionRun.started_at >= cutoff)))


def summary(db: Session, *, cached: bool = True) -> dict:
    """The catalogue object attached to `/programs` and `/universities` responses (cheap; cached for 30 s)."""
    now = time.monotonic()
    if cached and _cache["value"] is not None and now - _cache["at"] < _TTL:
        return dict(_cache["value"])
    universities = _n(db, select(func.count()).select_from(University))
    programs = _n(db, select(func.count()).select_from(Program).where(Program.is_active.is_(True)))
    if universities and programs:
        state = "READY"
    elif running(db) or universities:
        state = "PREPARING"
    else:
        state = "EMPTY"
    value = {"state": state, "programs_total": programs, "universities_total": universities}
    _cache.update(at=now, value=value)
    return dict(value)


def invalidate() -> None:
    _cache.update(at=0.0, value=None)


def counts(db: Session) -> dict:
    enrichment = Institution.enrichment
    return {
        "institutions": _n(db, select(func.count()).select_from(Institution).where(Institution.status == "ACTIVE")),
        "universities": _n(db, select(func.count()).select_from(University)),
        "programmes": _n(db, select(func.count()).select_from(Program).where(Program.is_active.is_(True))),
        "programmes_official": _n(db, select(func.count()).select_from(Program).where(Program.is_active.is_(True), Program.origin == "OFFICIAL_GUIDE")),
        "intakes": _n(db, select(func.count()).select_from(ProgramIntake)),
        "open_intakes": _n(db, select(func.count()).select_from(ProgramIntake).where(ProgramIntake.is_open.is_(True))),
        "admission_requirements": _n(db, select(func.count()).select_from(AdmissionRequirement)),
        "document_requirements": _n(db, select(func.count()).select_from(DocumentRequirement)),
        "scholarships": _n(db, select(func.count()).select_from(Scholarship)),
        "dormitories": _n(db, select(func.count()).select_from(Dormitory)),
        "official_guides": _n(db, select(func.count()).select_from(AdmissionGuide)),
        "official_videos": _n(db, select(func.count()).select_from(Institution).where(
            Institution.status == "ACTIVE", enrichment["youtube"]["video_id"].as_string().is_not(None))),
    }


def _run(r: CatalogIngestionRun | None) -> dict | None:
    if r is None:
        return None
    return {
        "id": str(r.id), "kind": r.kind, "trigger": r.trigger, "status": r.status, "full": r.full,
        "started_at": kst_iso(r.started_at), "finished_at": kst_iso(r.finished_at), "duration_ms": r.duration_ms,
        "institutions": r.institution_count, "universities": r.university_count, "programmes": r.programme_count,
        "intakes": r.intake_count, "created": r.created_count, "changed": r.changed_count, "unchanged": r.unchanged_count,
        "retired": r.retired_count, "source_failures": r.source_failures, "parser_failures": r.parser_failures,
        "conflicts": r.conflicts, "stale_records": r.stale_records, "error": r.error,
    }


def health(db: Session) -> dict:
    last = db.scalar(select(CatalogIngestionRun).order_by(CatalogIngestionRun.started_at.desc()).limit(1))
    last_full = db.scalar(select(CatalogIngestionRun).where(CatalogIngestionRun.full.is_(True), CatalogIngestionRun.status == "SUCCEEDED")
                          .order_by(CatalogIngestionRun.finished_at.desc()).limit(1))
    failed = []
    if last is not None:
        failed = [{"source": s.source_key, "status": s.status, "error": (s.error or "")[:300], "detail": s.detail}
                  for s in db.scalars(select(CatalogSourceResult).where(CatalogSourceResult.run_id == last.id,
                                                                       CatalogSourceResult.status.in_(("FAILED", "PARTIAL"))))]
    broken = db.scalars(select(CatalogLinkCheck).where(CatalogLinkCheck.status == "BROKEN")
                        .order_by(CatalogLinkCheck.consecutive_failures.desc(), CatalogLinkCheck.last_checked_at.desc()).limit(50)).all()
    slugs = dict(db.execute(select(Institution.id, Institution.slug).where(Institution.id.in_({b.institution_id for b in broken}))).all()) if broken else {}
    guides = db.scalars(select(AdmissionGuide).where(AdmissionGuide.verification_status.in_(("REVIEW_DUE", "STALE")))).all()
    gslugs = dict(db.execute(select(Institution.id, Institution.slug).where(Institution.id.in_({g.institution_id for g in guides}))).all()) if guides else {}
    return {
        "state": summary(db, cached=False)["state"],
        "counts": counts(db),
        "last_run": _run(last),
        "last_full_success": _run(last_full),
        "next_refresh_at": kst_iso(next_refresh_at()),
        "schedule": {"weekday": "MONDAY", "time": "09:00", "timezone": "Asia/Seoul"},
        "running": running(db),
        "failed_sources": failed,
        "stale_records": {
            "broken_links": [{"institution": slugs.get(b.institution_id), "kind": b.kind, "url": b.url, "http_status": b.http_status,
                              "consecutive_failures": b.consecutive_failures, "last_checked_at": kst_iso(b.last_checked_at),
                              "last_ok_at": kst_iso(b.last_ok_at)} for b in broken],
            "guides_review_due": [{"institution": gslugs.get(g.institution_id), "title": g.title, "status": g.status,
                                   "verification_status": g.verification_status, "source_url": g.source_url} for g in guides],
            "stale_intakes": _n(db, select(func.count()).select_from(ProgramIntake).where(ProgramIntake.verification_status == "STALE")),
        },
    }
