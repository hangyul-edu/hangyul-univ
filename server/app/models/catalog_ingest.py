"""V34 — the catalogue ingestion ledger (owner requirement 3: one authoritative catalogue, bootstrapped when empty,
refreshed every Monday 09:00 Asia/Seoul through a staged, provenance-preserving pipeline).

``CatalogIngestionRun``   one bootstrap / refresh / revalidation run: when, how long, what it counted and what failed.
``CatalogSourceResult``   one source inside a run (reference directory, research files, programme units, link checks):
                          a failed source is recorded here and never aborts the run or nulls a published value.
``CatalogStagedRecord``   a normalised record waiting to be compared and published. The latest PUBLISHED/UNCHANGED row
                          per ``(entity_kind, entity_key)`` is the comparison baseline for the next run.
``CatalogLinkCheck``      reachability of each official URL a catalogue entry relies on (website, international
                          admissions page, admission guide, official video), with when it was last seen working.
``CatalogState``          small durable key/value facts — the bootstrap marker, the hash of the research inputs last
                          published, a pending revalidation request.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin, fk, utcnow

RUN_KINDS = ("BOOTSTRAP", "REFRESH", "REVALIDATE")
RUN_STATUSES = ("RUNNING", "SUCCEEDED", "PARTIAL", "FAILED")
LINK_KINDS = ("WEBSITE", "INTL_ADMISSIONS", "GUIDE", "VIDEO")
LINK_STATUSES = ("OK", "BROKEN", "ERROR", "ROBOTS_DISALLOWED", "UNCHECKED")


class CatalogIngestionRun(IdMixin, Base):
    __tablename__ = "catalog_ingestion_runs"
    __table_args__ = (Index("ix_catalog_ingestion_runs_status_started", "status", "started_at"),)

    kind: Mapped[str] = mapped_column(String(16))
    trigger: Mapped[str] = mapped_column(String(24))  # STARTUP | SCHEDULE | WORKER | CLI | TEST
    status: Mapped[str] = mapped_column(String(16), default="RUNNING")
    #: True when every source ran (including the official-link revalidation); a bootstrap is not a full refresh.
    full: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    institution_count: Mapped[int] = mapped_column(Integer, default=0)
    university_count: Mapped[int] = mapped_column(Integer, default=0)
    programme_count: Mapped[int] = mapped_column(Integer, default=0)
    intake_count: Mapped[int] = mapped_column(Integer, default=0)
    created_count: Mapped[int] = mapped_column(Integer, default=0)
    changed_count: Mapped[int] = mapped_column(Integer, default=0)
    unchanged_count: Mapped[int] = mapped_column(Integer, default=0)
    retired_count: Mapped[int] = mapped_column(Integer, default=0)
    source_failures: Mapped[int] = mapped_column(Integer, default=0)
    parser_failures: Mapped[int] = mapped_column(Integer, default=0)
    conflicts: Mapped[int] = mapped_column(Integer, default=0)
    stale_records: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[dict | None] = mapped_column(JSON)
    worker_id: Mapped[str | None] = mapped_column(String(120))


class CatalogSourceResult(IdMixin, Base):
    __tablename__ = "catalog_source_results"

    run_id: Mapped[uuid.UUID] = fk("catalog_ingestion_runs.id")
    source_key: Mapped[str] = mapped_column(String(80))
    priority: Mapped[int] = mapped_column(Integer, default=100)
    status: Mapped[str] = mapped_column(String(16), default="RUNNING")  # OK | PARTIAL | FAILED | SKIPPED
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    records_fetched: Mapped[int] = mapped_column(Integer, default=0)
    records_valid: Mapped[int] = mapped_column(Integer, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0)
    changed: Mapped[int] = mapped_column(Integer, default=0)
    unchanged: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    detail: Mapped[dict | None] = mapped_column(JSON)


class CatalogStagedRecord(IdMixin, Base):
    __tablename__ = "catalog_staged_records"
    __table_args__ = (Index("ix_catalog_staged_records_entity", "entity_kind", "entity_key", "created_at"),)

    run_id: Mapped[uuid.UUID] = fk("catalog_ingestion_runs.id")
    source_key: Mapped[str] = mapped_column(String(80))
    entity_kind: Mapped[str] = mapped_column(String(24))  # UNIVERSITY | PROGRAMME
    entity_key: Mapped[str] = mapped_column(String(300))
    payload: Mapped[dict] = mapped_column(JSON)
    payload_hash: Mapped[str] = mapped_column(String(64))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: STAGED → VALID | REJECTED → PUBLISHED | UNCHANGED | CONFLICT
    status: Mapped[str] = mapped_column(String(16), default="STAGED")
    change: Mapped[str | None] = mapped_column(String(12))  # CREATED | CHANGED | UNCHANGED
    problem: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CatalogLinkCheck(IdMixin, TimestampMixin, Base):
    __tablename__ = "catalog_link_checks"
    __table_args__ = (UniqueConstraint("institution_id", "kind", "url", name="uq_catalog_link_checks_inst_kind_url"),)

    institution_id: Mapped[uuid.UUID] = fk("institutions.id")
    kind: Mapped[str] = mapped_column(String(24))
    url: Mapped[str] = mapped_column(String(1000))
    guide_id: Mapped[uuid.UUID | None] = fk("admission_guides.id", nullable=True, ondelete="SET NULL")
    status: Mapped[str] = mapped_column(String(24), default="UNCHECKED", index=True)
    http_status: Mapped[int | None] = mapped_column(Integer)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_ok_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    #: ETag / Last-Modified / Content-Length fingerprint — a change flags the record for review, it is never parsed.
    fingerprint: Mapped[str | None] = mapped_column(String(300))
    changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(String(300))


class CatalogState(Base):
    __tablename__ = "catalog_state"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
