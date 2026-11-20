"""The source registry, in priority order (owner requirement 3):

    1. official university international/admissions pages and admission guides (모집요강)
    2. Study in Korea (studyinkorea.go.kr — IEQAS certified list)
    3. 대학알리미 (academyinfo.go.kr — the national registry)
    4. NIIED / GKS
    5. other government sources

Each source is a ``SourceSpec`` with a ``collect`` function (fetch → parse → validate → normalise) returning staged
records. Priority decides a conflict: when two sources stage the same entity with different content, the
higher-priority (lower number) record is published and the other is recorded as a CONFLICT.

Adding an official-source parser = writing a ``collect`` and registering a ``SourceSpec`` here; the pipeline,
comparison, provenance validation, publication and the run ledger come for free. Sources listed without a parser
are recorded as SKIPPED in every run so the gap is visible in the ops health view, never silently absent.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone

from sqlalchemy.orm import Session

from app.services.catalog_ingest import normalize


@dataclass
class Staged:
    entity_kind: str  # REFERENCE_SET | RESEARCH_SET | UNIVERSITY | PROGRAMME
    entity_key: str
    payload: dict
    source_url: str | None
    verified_at: datetime | None


@dataclass
class Collected:
    records: list[Staged] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)
    fetched: int = 0
    detail: dict = field(default_factory=dict)


@dataclass(frozen=True)
class SourceSpec:
    key: str
    priority: int
    tier: str  # OFFICIAL_UNIVERSITY | STUDY_IN_KOREA | ACADEMYINFO | NIIED | GOVERNMENT
    description: str
    collect: Callable[[Session], Collected] | None = None
    #: Needs the network (only runs in a full refresh; the bootstrap never crawls).
    network: bool = False


def _ts(v: str | None) -> datetime | None:
    if not v:
        return None
    d = date.fromisoformat(v[:10])
    return datetime.combine(d, time(0), tzinfo=timezone.utc)


# ------------------------------------------------------------------------------------------------ collectors

def collect_programmes(_db: Session) -> Collected:
    files = normalize.programme_files()
    payloads, problems = normalize.programme_payloads(files=files)
    out = Collected(fetched=len(files), problems=problems, detail={"files": [p.name for p in files]})
    for p in payloads:
        out.records.append(Staged("PROGRAMME", p["key"], p, p.get("source_url"), _ts(p.get("verified_at"))))
    return out


def collect_research(_db: Session) -> Collected:
    files = normalize.research_files()
    h = normalize.files_hash(files)
    return Collected(fetched=len(files), records=[Staged("RESEARCH_SET", "v27", {"hash": h, "files": len(files)},
                                                         "app/data/research/v27", None)])


def collect_reference(_db: Session) -> Collected:
    files = normalize.reference_files()
    h = normalize.files_hash(files)
    payloads, problems = normalize.university_payloads()
    out = Collected(fetched=len(payloads), problems=problems)
    out.records.append(Staged("REFERENCE_SET", "directory", {"hash": h, "institutions": len(payloads)}, normalize.REGISTRY_URL, None))
    for p in payloads:
        out.records.append(Staged("UNIVERSITY", p["slug"], p, p.get("source_url"), _ts(p.get("verified_at"))))
    return out


SOURCES: tuple[SourceSpec, ...] = (
    SourceSpec("official.guides.units", 10, "OFFICIAL_UNIVERSITY",
               "모집단위, tuition and application fees read from official admission guides (research/v33/programmes)",
               collect_programmes),
    SourceSpec("official.guides.research", 11, "OFFICIAL_UNIVERSITY",
               "Official admission guides, language rules, scholarships, official videos (research/v27)", collect_research),
    SourceSpec("official.links", 12, "OFFICIAL_UNIVERSITY",
               "Reachability of each institution's official website, international-admissions page, guide and video",
               None, network=True),
    SourceSpec("studyinkorea.ieqas", 20, "STUDY_IN_KOREA",
               "IEQAS certified list — published through the committed directory snapshot", None),
    SourceSpec("academyinfo.registry", 30, "ACADEMYINFO",
               "대학알리미 institution registry + verified enrichment (korean_institutions.json)", collect_reference),
    SourceSpec("niied.gks", 40, "NIIED", "GKS participating institutions — merged into the directory enrichment", None),
    SourceSpec("gov.other", 50, "GOVERNMENT", "Other government sources — no parser registered yet", None),
)

#: The link-check source is executed by the pipeline's revalidation phase, not through ``collect``.
LINK_SOURCE = "official.links"


def ordered() -> list[SourceSpec]:
    return sorted(SOURCES, key=lambda s: s.priority)
