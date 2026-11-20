"""The staged ingestion pipeline: fetch → parse → validate → normalise → stage → compare → provenance check → publish.

    run(kind="REFRESH", trigger="SCHEDULE", full=True)

1. **Collect** each registered source in priority order (``sources.SOURCES``). A source that raises is recorded as
   FAILED on its ``catalog_source_results`` row and the run continues — one source failing never aborts the run.
2. **Stage** every normalised record in ``catalog_staged_records`` with its payload hash and provenance.
3. **Validate** provenance (a record without a source URL is REJECTED) and resolve conflicts (same entity staged by two
   sources with different content: the higher-priority source wins, the other is marked CONFLICT).
4. **Compare** each record with the last published version of the same entity (payload hash) → CREATED / CHANGED /
   UNCHANGED.
5. **Publish** in a single transaction: reference directory (when its inputs changed), V27 research (when its inputs
   changed and nothing depends on the rows it would rebuild), universities, research relink, programmes, retirements.
   Any error rolls the whole publication back; the previously published catalogue stays as it was.
6. **Revalidate** (full runs only) the official links each entry relies on, flagging broken or changed ones.

Everything is recorded on the run row (``catalog_ingestion_runs``).
"""

from __future__ import annotations

import logging
import os
import socket
import time
import traceback
from collections import defaultdict
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import delete, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    AdmissionGuide,
    ApplicationDocument,
    CatalogIngestionRun,
    CatalogLinkCheck,
    CatalogSourceResult,
    CatalogStagedRecord,
    CatalogState,
    DocumentRequirement,
    Institution,
    Program,
    ProgramIntake,
    University,
)
from app.services.catalog_ingest import normalize, publish
from app.services.catalog_ingest.sources import LINK_SOURCE, SourceSpec, Staged, ordered

log = logging.getLogger("hangyul.catalog")
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"
LOCK_NAME = "hangyul-catalog:pipeline"
#: Staged rows of the last N runs are kept as the comparison baseline and audit trail; older ones are pruned.
KEEP_RUNS = 8


class CatalogBusy(RuntimeError):
    """Another process holds the catalogue lock (a bootstrap or refresh is already running)."""


def _defaults():
    from app.core.db import SessionLocal, engine

    return SessionLocal, engine


def lock_key(name: str) -> int:
    import hashlib

    return int.from_bytes(hashlib.sha256(name.encode()).digest()[:8], "big", signed=True)


@contextmanager
def catalog_lock(eng: Engine | None = None) -> Iterator[bool]:
    """Session-level Postgres advisory lock shared by bootstrap, refresh and revalidation (all processes)."""
    eng = eng or _defaults()[1]
    with eng.connect() as conn:
        got = bool(conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key(LOCK_NAME)}).scalar())
        conn.commit()
        try:
            yield got
        finally:
            if got:
                conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key(LOCK_NAME)})
                conn.commit()


def get_state(db: Session, key: str) -> dict | None:
    row = db.get(CatalogState, key)
    return dict(row.value) if row and row.value else None


def set_state(db: Session, key: str, value: dict) -> None:
    row = db.get(CatalogState, key)
    if row is None:
        db.add(CatalogState(key=key, value=value, updated_at=datetime.now(UTC)))
    else:
        row.value, row.updated_at = value, datetime.now(UTC)


# ------------------------------------------------------------------------------------------------ run

def run(*, kind: str = "REFRESH", trigger: str = "CLI", full: bool = True, sf: sessionmaker | None = None,
        eng: Engine | None = None, sources: list[SourceSpec] | None = None, fetcher=None, locked: bool = False,
        link_checks: bool | None = None) -> dict:
    sf_default, eng_default = _defaults() if (sf is None or eng is None) else (sf, eng)
    sf, eng = sf or sf_default, eng or eng_default
    if not locked:
        with catalog_lock(eng) as got:
            if not got:
                raise CatalogBusy("the catalogue pipeline is already running")
            return run(kind=kind, trigger=trigger, full=full, sf=sf, eng=eng, sources=sources, fetcher=fetcher,
                       locked=True, link_checks=link_checks)
    from app.core.config import get_settings

    settings = get_settings()
    started = time.monotonic()
    with sf() as db:
        r = CatalogIngestionRun(kind=kind, trigger=trigger, status="RUNNING", full=False, started_at=datetime.now(UTC),
                                worker_id=WORKER_ID)
        db.add(r)
        db.commit()
        run_id = r.id
    stats: dict = defaultdict(int)
    summary: dict = {"sources": {}, "problems": []}
    status, error = "SUCCEEDED", None
    ok_sources: set[str] = set()
    specs = sources if sources is not None else ordered()
    try:
        for spec in sorted(specs, key=lambda s: s.priority):
            if spec.key == LINK_SOURCE or spec.network:
                continue
            _collect_one(sf, run_id, spec, stats, summary, ok_sources)
        publish_stats = _publish(sf, run_id, specs, ok_sources)
        for k, v in publish_stats.items():
            if isinstance(v, int):
                stats[k] += v
        summary["publish"] = publish_stats
        do_links = full and (link_checks if link_checks is not None else settings.catalog_link_checks_enabled)
        link_spec = next((s for s in specs if s.key == LINK_SOURCE), None)
        if do_links and link_spec is not None:
            stats["link_source_failed"] += _revalidate_links(sf, run_id, link_spec, fetcher, settings, summary)
        elif link_spec is not None:
            _record_source(sf, run_id, link_spec, "SKIPPED", detail={"reason": "not a full refresh" if not full else "link checks disabled"})
    except Exception as exc:  # noqa: BLE001 - recorded on the run row; the published catalogue is untouched
        status = "FAILED"
        error = "".join(traceback.format_exception_only(type(exc), exc)).strip()[:2000]
        log.exception("catalogue %s failed", kind.lower())
    with sf() as db:
        r = db.get(CatalogIngestionRun, run_id)
        counts = _counts(db)
        r.institution_count, r.university_count = counts["institutions"], counts["universities"]
        r.programme_count, r.intake_count = counts["programmes"], counts["intakes"]
        r.created_count, r.changed_count = stats["created"], stats["changed"]
        r.unchanged_count, r.retired_count = stats["unchanged"], stats["retired"]
        r.source_failures = stats["source_failures"] + stats["link_source_failed"]
        r.parser_failures, r.conflicts = stats["parser_failures"], stats["conflicts"]
        r.stale_records = _stale_count(db)
        if status == "SUCCEEDED" and r.source_failures:
            status = "PARTIAL"
        r.status, r.error = status, error
        r.full = bool(full and status == "SUCCEEDED" and not stats["link_source_failed"]
                      and (link_checks if link_checks is not None else settings.catalog_link_checks_enabled))
        r.finished_at = datetime.now(UTC)
        r.duration_ms = int((time.monotonic() - started) * 1000)
        r.summary = _jsonable(summary)
        if r.full:
            set_state(db, "last_full_refresh", {"run_id": str(run_id), "finished_at": r.finished_at.isoformat()})
        _prune(db)
        db.commit()
        return _run_dict(r)


def _record_source(sf, run_id, spec: SourceSpec, status: str, *, error: str | None = None, detail: dict | None = None, **counts) -> None:
    with sf() as db:
        db.add(CatalogSourceResult(run_id=run_id, source_key=spec.key, priority=spec.priority, status=status, error=error,
                                   detail=detail, finished_at=datetime.now(UTC), **counts))
        db.commit()


def _collect_one(sf, run_id, spec: SourceSpec, stats, summary, ok_sources: set[str]) -> None:
    if spec.collect is None:
        _record_source(sf, run_id, spec, "SKIPPED", detail={"reason": "no parser registered", "tier": spec.tier, "description": spec.description})
        summary["sources"][spec.key] = "SKIPPED"
        return
    res = CatalogSourceResult(run_id=run_id, source_key=spec.key, priority=spec.priority, status="RUNNING", started_at=datetime.now(UTC))
    try:
        with sf() as db:
            collected = spec.collect(db)
            db.rollback()  # collectors only read
    except Exception as exc:  # noqa: BLE001 - one source failing never aborts the run
        stats["source_failures"] += 1
        res.status, res.error = "FAILED", "".join(traceback.format_exception_only(type(exc), exc)).strip()[:2000]
        res.finished_at = datetime.now(UTC)
        with sf() as db:
            db.add(res)
            db.commit()
        summary["sources"][spec.key] = "FAILED"
        log.warning("catalogue source %s failed: %s", spec.key, res.error)
        return
    valid = rejected = 0
    with sf() as db:
        for rec in collected.records:
            problem = _provenance_problem(rec)
            db.add(CatalogStagedRecord(run_id=run_id, source_key=spec.key, entity_kind=rec.entity_kind, entity_key=rec.entity_key,
                                       payload=_jsonable(rec.payload), payload_hash=normalize.payload_hash(rec.payload),
                                       source_url=rec.source_url, verified_at=rec.verified_at,
                                       status="REJECTED" if problem else "VALID", problem=problem))
            if problem:
                rejected += 1
            else:
                valid += 1
        stats["parser_failures"] += len(collected.problems) + rejected
        res.status = "PARTIAL" if (collected.problems or rejected) else "OK"
        res.records_fetched, res.records_valid, res.records_rejected = collected.fetched, valid, rejected
        res.detail = _jsonable({**collected.detail, "problems": collected.problems[:50]})
        res.finished_at = datetime.now(UTC)
        db.add(res)
        db.commit()
    ok_sources.add(spec.key)
    summary["sources"][spec.key] = res.status
    summary["problems"].extend(collected.problems[:20])


def _provenance_problem(rec: Staged) -> str | None:
    if rec.entity_kind in ("UNIVERSITY", "PROGRAMME"):
        if not rec.source_url:
            return "no source URL"
        if rec.entity_kind == "PROGRAMME" and not rec.payload.get("verified_at"):
            return "no verification date"
    return None


# ------------------------------------------------------------------------------------------------ publish

def _baseline(db: Session, run_id) -> dict[tuple[str, str], str]:
    rows = db.execute(select(CatalogStagedRecord.entity_kind, CatalogStagedRecord.entity_key, CatalogStagedRecord.payload_hash)
                      .where(CatalogStagedRecord.run_id != run_id, CatalogStagedRecord.status.in_(("PUBLISHED", "UNCHANGED")))
                      .order_by(CatalogStagedRecord.created_at.desc())).all()
    out: dict[tuple[str, str], str] = {}
    for k, key, h in rows:
        out.setdefault((k, key), h)
    return out


def _research_rebuild_safe(db: Session) -> bool:
    """The V27 loader replaces guide rows as a set; never while an application links a document to one of them."""
    return not db.scalar(select(func.count()).select_from(ApplicationDocument)
                         .join(DocumentRequirement, DocumentRequirement.id == ApplicationDocument.requirement_id)
                         .where(DocumentRequirement.guide_id.is_not(None)))


def _publish(sf, run_id, specs: list[SourceSpec], ok_sources: set[str]) -> dict:
    from app.seed import v27_research
    from app.seed.institutions import seed_institutions

    priority = {s.key: s.priority for s in specs}
    out: dict = defaultdict(int)
    today = datetime.now(UTC).date()
    with sf() as db:
        staged = db.scalars(select(CatalogStagedRecord).where(CatalogStagedRecord.run_id == run_id, CatalogStagedRecord.status == "VALID")).all()
        # Conflicts: the same entity from two sources with different content → the higher-priority source wins.
        by_entity: dict[tuple[str, str], list[CatalogStagedRecord]] = defaultdict(list)
        for s in staged:
            by_entity[(s.entity_kind, s.entity_key)].append(s)
        chosen: dict[tuple[str, str], CatalogStagedRecord] = {}
        for k, rows in by_entity.items():
            rows.sort(key=lambda s: (priority.get(s.source_key, 999), s.created_at))
            chosen[k] = rows[0]
            for other in rows[1:]:
                if other.payload_hash != rows[0].payload_hash:
                    other.status, other.problem = "CONFLICT", f"superseded by {rows[0].source_key}"
                    out["conflicts"] += 1
                else:
                    other.status = "UNCHANGED"
        base = _baseline(db, run_id)
        for k, s in chosen.items():
            prev = base.get(k)
            s.change = "CREATED" if prev is None else ("UNCHANGED" if prev == s.payload_hash else "CHANGED")

        # 1. reference directory — an idempotent upsert keyed on the registry id; runs when its inputs changed.
        ref = chosen.get(("REFERENCE_SET", "directory"))
        inst_count = db.scalar(select(func.count()).select_from(Institution)) or 0
        if ref is not None and (ref.change != "UNCHANGED" or inst_count == 0):
            out["institutions_written"] = seed_institutions(db)
        # 2. research — rebuilt as a set only when its inputs changed and no application depends on its rows.
        res = chosen.get(("RESEARCH_SET", "v27"))
        guides = db.scalar(select(func.count()).select_from(AdmissionGuide)) or 0
        if res is not None:
            if guides == 0 or (res.change == "CHANGED" and _research_rebuild_safe(db)):
                out["research"] = v27_research.load(db)
            elif res.change == "CHANGED":
                res.status, res.problem = "CONFLICT", "research changed but applications reference the current guide rows; review required"
                out["conflicts"] += 1
        # 3. universities — one per ACTIVE directory institution, same slug.
        insts = {i.slug: i for i in db.scalars(select(Institution).where(Institution.status == "ACTIVE"))}
        by_slug = {u.slug: u for u in db.scalars(select(University))}
        for (kind, key), s in chosen.items():
            if kind != "UNIVERSITY":
                continue
            inst = insts.get(key)
            if inst is None:
                s.status, s.problem = "REJECTED", "institution not in the directory"
                out["parser_failures"] += 1
                continue
            result = publish.apply_university(db, inst, s.payload, by_slug)
            out[result.lower()] += 1
        out["relinked"] = publish.relink_research(db)
        # 4. programmes — only for universities in the catalogue; retired only when their source ran.
        keep, covered, superseded = set(), set(), set()
        existing = {p.catalog_key: p for p in db.scalars(select(Program).where(Program.catalog_key.is_not(None)))}
        for (kind, key), s in chosen.items():
            if kind != "PROGRAMME":
                continue
            u = by_slug.get(s.payload["slug"])
            if u is None:
                s.status, s.problem = "REJECTED", "university not in the catalogue"
                out["parser_failures"] += 1
                continue
            result = publish.apply_programme(db, u, s.payload, existing.get(key), today)
            out[result.lower()] += 1
            keep.add(key)
            covered.add(s.payload["slug"])
            if s.payload.get("superseded_guide_url"):
                superseded.add((s.payload["slug"], s.payload["superseded_guide_url"], s.payload["source_url"]))
        out["guides_superseded"] = publish.mark_superseded_guides(db, superseded)
        if "official.guides.units" in ok_sources:
            out["retired"] += publish.retire_programmes(db, keep, covered)
        out["intakes_closed"] = publish.close_past_intakes(db, today)
        for s in chosen.values():
            if s.status == "VALID":
                s.status = "UNCHANGED" if s.change == "UNCHANGED" else "PUBLISHED"
        db.commit()
    from app.services import fit

    fit.invalidate()
    return dict(out)


# ------------------------------------------------------------------------------------------------ link revalidation

def link_targets(db: Session, limit: int = 0) -> list[dict]:
    rows = db.execute(select(Institution, University).outerjoin(University, University.id == Institution.catalog_university_id)
                      .where(Institution.status == "ACTIVE").order_by(Institution.slug)).all()
    guides = defaultdict(list)
    for g in db.scalars(select(AdmissionGuide)):
        guides[g.institution_id].append(g)
    out = []
    for inst, uni in rows:
        if inst.website_url:
            out.append({"institution_id": inst.id, "kind": "WEBSITE", "url": inst.website_url})
        if uni is not None and uni.international_admissions_url:
            out.append({"institution_id": inst.id, "kind": "INTL_ADMISSIONS", "url": uni.international_admissions_url})
        for g in guides.get(inst.id, []):
            if g.source_url:
                out.append({"institution_id": inst.id, "kind": "GUIDE", "url": g.source_url, "guide_id": g.id})
        video = ((inst.enrichment or {}).get("youtube") or {}).get("video_id")
        if video:
            out.append({"institution_id": inst.id, "kind": "VIDEO",
                        "url": f"https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={video}"})
    seen, uniq = set(), []
    for t in out:
        k = (t["institution_id"], t["kind"], t["url"][:1000])
        if k not in seen:
            seen.add(k)
            uniq.append(t)
    return uniq[:limit] if limit else uniq


def _revalidate_links(sf, run_id, spec: SourceSpec, fetcher, settings, summary) -> int:
    """Returns 1 if the link source as a whole failed, else 0. Individual broken links are data, not failures."""
    from app.services.catalog_ingest.fetcher import PoliteFetcher

    own = fetcher is None
    started = datetime.now(UTC)
    try:
        fetcher = fetcher or PoliteFetcher(min_interval=settings.catalog_fetch_min_interval_seconds,
                                           timeout=settings.catalog_fetch_timeout_seconds)
        with sf() as db:
            targets = link_targets(db, settings.catalog_link_check_limit)
        by_host: dict[str, list[dict]] = defaultdict(list)
        for t in targets:
            by_host[urlsplit(t["url"]).hostname or ""].append(t)

        def check_host(items: list[dict]) -> list[tuple[dict, object]]:
            return [(t, fetcher.check(t["url"])) for t in items]

        results: list[tuple[dict, object]] = []
        with ThreadPoolExecutor(max_workers=6, thread_name_prefix="catalog-links") as pool:
            for chunk in pool.map(check_host, by_host.values()):
                results.extend(chunk)
        counts = defaultdict(int)
        now = datetime.now(UTC)
        with sf() as db:
            existing = {(c.institution_id, c.kind, c.url): c for c in db.scalars(select(CatalogLinkCheck))}
            for t, res in results:
                key = (t["institution_id"], t["kind"], t["url"][:1000])
                row = existing.get(key)
                if row is None:
                    row = CatalogLinkCheck(institution_id=t["institution_id"], kind=t["kind"], url=t["url"][:1000],
                                           guide_id=t.get("guide_id"), consecutive_failures=0)
                    db.add(row)
                    existing[key] = row
                row.last_checked_at, row.http_status, row.error = now, res.http_status, res.error
                counts[res.status] += 1
                if res.status == "OK":
                    if row.fingerprint and res.fingerprint and row.fingerprint != res.fingerprint:
                        row.changed_at = now  # the official document changed: flagged for review, never auto-parsed
                        counts["changed"] += 1
                    row.fingerprint = res.fingerprint or row.fingerprint
                    row.status, row.last_ok_at, row.consecutive_failures = "OK", now, 0
                elif res.status == "BROKEN":
                    row.status = "BROKEN"
                    row.consecutive_failures = (row.consecutive_failures or 0) + 1
                    if t["kind"] == "GUIDE" and res.http_status in (404, 410) and t.get("guide_id"):
                        g = db.get(AdmissionGuide, t["guide_id"])
                        if g is not None and g.verification_status != "REVIEW_DUE":
                            # The guide is gone from its official URL: keep every value, ask a person to re-check it.
                            g.verification_status = "REVIEW_DUE"
                            g.reviewer_note = ((g.reviewer_note + " · ") if g.reviewer_note else "") + \
                                f"Official guide URL returned HTTP {res.http_status} on {now.date().isoformat()}; data kept, review due."
                            counts["guides_review_due"] += 1
                else:
                    row.status = res.status  # ERROR / ROBOTS_DISALLOWED: recorded, nothing flagged
            db.add(CatalogSourceResult(run_id=run_id, source_key=spec.key, priority=spec.priority,
                                       status="OK" if counts["OK"] or not targets else "FAILED", started_at=started,
                                       finished_at=datetime.now(UTC), records_fetched=len(targets), records_valid=counts["OK"],
                                       records_rejected=len(targets) - counts["OK"], changed=counts["changed"],
                                       detail=dict(counts, requests=getattr(fetcher, "requests", None))))
            db.commit()
        summary["sources"][spec.key] = dict(counts)
        # The whole source failed only when nothing at all could be reached (e.g. no network on this host).
        return 1 if targets and not counts["OK"] and not counts["BROKEN"] else 0
    except Exception as exc:  # noqa: BLE001
        _record_source(sf, run_id, spec, "FAILED", error="".join(traceback.format_exception_only(type(exc), exc)).strip()[:2000])
        summary["sources"][spec.key] = "FAILED"
        return 1
    finally:
        if own and fetcher is not None:
            fetcher.close()


# ------------------------------------------------------------------------------------------------ helpers

def _counts(db: Session) -> dict:
    return {
        "institutions": db.scalar(select(func.count()).select_from(Institution).where(Institution.status == "ACTIVE")) or 0,
        "universities": db.scalar(select(func.count()).select_from(University)) or 0,
        "programmes": db.scalar(select(func.count()).select_from(Program).where(Program.is_active.is_(True))) or 0,
        "intakes": db.scalar(select(func.count()).select_from(ProgramIntake)) or 0,
    }


def _stale_count(db: Session) -> int:
    broken = db.scalar(select(func.count()).select_from(CatalogLinkCheck).where(CatalogLinkCheck.status == "BROKEN")) or 0
    guides = db.scalar(select(func.count()).select_from(AdmissionGuide).where(AdmissionGuide.verification_status.in_(("REVIEW_DUE", "STALE")))) or 0
    stale_intakes = db.scalar(select(func.count()).select_from(ProgramIntake).where(ProgramIntake.verification_status == "STALE")) or 0
    return broken + guides + stale_intakes


def _prune(db: Session) -> None:
    keep = db.scalars(select(CatalogIngestionRun.id).order_by(CatalogIngestionRun.started_at.desc()).limit(KEEP_RUNS)).all()
    if keep:
        db.execute(delete(CatalogStagedRecord).where(CatalogStagedRecord.run_id.not_in(keep),
                                                     CatalogStagedRecord.created_at < datetime.now(UTC) - timedelta(days=1)))


def _run_dict(r: CatalogIngestionRun) -> dict:
    return {
        "id": str(r.id), "kind": r.kind, "trigger": r.trigger, "status": r.status, "full": r.full,
        "started_at": r.started_at.astimezone(UTC).isoformat() if r.started_at else None,
        "finished_at": r.finished_at.astimezone(UTC).isoformat() if r.finished_at else None, "duration_ms": r.duration_ms,
        "institutions": r.institution_count, "universities": r.university_count, "programmes": r.programme_count,
        "intakes": r.intake_count, "created": r.created_count, "changed": r.changed_count, "unchanged": r.unchanged_count,
        "retired": r.retired_count, "source_failures": r.source_failures, "parser_failures": r.parser_failures,
        "conflicts": r.conflicts, "stale_records": r.stale_records, "error": r.error,
    }


def _jsonable(v):
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [_jsonable(x) for x in v]
    return v if isinstance(v, (str, int, float, bool, type(None))) else str(v)
