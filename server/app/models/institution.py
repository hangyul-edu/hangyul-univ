"""The Korean institution **directory** — deliberately not the application catalogue (V12, REPORT §85, brief Part 21).

Two things that look alike and are not:

``Institution``  every institution in the national public-disclosure registry (대학알리미). It exists because the
                institution exists. Its fields are facts a student can verify from an official source, and it
                carries **no** price, no deadline, no requirement and no match. Hundreds of rows.
``University``   (``app.models.catalog``) an institution Hangyul holds enough verified admission data for to
                prepare a real application against: programmes, intakes, requirements, costs. A handful of rows.

A university in the directory without a ``University`` row is the normal case, not a gap and not an error — the
public site is a directory of Korean higher education, and preparing an application is a different, authenticated
job. ``catalog_university_id`` is the one link between the two, and it is nullable for exactly that reason.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin

#: Registry divisions we publish. 대학원 (a university's own graduate school) is not an institution and is excluded
#: by the importer, so it never reaches this table.
INSTITUTION_TYPES = ("UNIVERSITY", "JUNIOR_COLLEGE", "GRADUATE_UNIVERSITY")
#: The three establishment tiers a student actually distinguishes; the registry's exact legal form is kept beside it.
ESTABLISHMENTS = ("NATIONAL", "PUBLIC", "PRIVATE")
#: ACTIVE = currently listed by the registry. WITHDRAWN = the registry has stopped listing it (closed, merged or
#: renamed away). A withdrawn institution is never offered as somewhere you can currently apply to study.
STATUSES = ("ACTIVE", "WITHDRAWN")


class Institution(IdMixin, TimestampMixin, Base):
    __tablename__ = "institutions"

    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    #: 대학알리미's own institution id — the stable key across disclosure years, and how a rename is recognised
    #: as a rename rather than as one institution closing and another opening.
    academyinfo_id: Mapped[str] = mapped_column(String(16), unique=True, index=True)

    name_ko: Mapped[str] = mapped_column(String(200), index=True)
    name_en: Mapped[str | None] = mapped_column(String(200), index=True)
    #: The registry's full string when it differs from `name_ko` (it carries a campus suffix for some entries).
    registry_name_ko: Mapped[str | None] = mapped_column(String(200))

    institution_type: Mapped[str] = mapped_column(String(24), index=True)
    establishment: Mapped[str] = mapped_column(String(16), index=True)
    #: 국립 / 국립대법인 / 특별법국립 / 공립 / 사립 / 특별법법인 — the registry's exact wording, kept so the
    #: simplification into three tiers is always traceable back to the source.
    establishment_source: Mapped[str | None] = mapped_column(String(24))

    region: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", index=True)
    withdrawn_at: Mapped[date | None] = mapped_column(Date)

    website_url: Mapped[str | None] = mapped_column(String(500))
    #: V17 — verified facts the registry does not carry: founding year, mission, media with their licences,
    #: the official YouTube channel. Shape and provenance rules: `scripts/catalog/enrich_universities.py`.
    #: Every value inside carries its own `source` and `verified_at`; a page renders only what is there.
    enrichment: Mapped[dict | None] = mapped_column(JSONB)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    #: Majors the institution disclosed for the survey year. A count of its own published programmes — not
    #: anything Hangyul can prepare an application for.
    major_count: Mapped[int | None] = mapped_column(Integer)

    # ---- International-student enrichment (Study in Korea, 교육국제화역량 인증제 / IEQAS).
    # Certification is a fact with a visa consequence, which is why it is worth a student's attention; each flag
    # is false only because the published list does not name the institution, so they are shown as "listed" and
    # never as "not certified".
    ieqas_certified: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ieqas_excellent: Mapped[bool] = mapped_column(Boolean, default=False)
    ieqas_language_programme: Mapped[bool] = mapped_column(Boolean, default=False)
    ieqas_checked_on: Mapped[date | None] = mapped_column(Date)

    #: When the importer last reconciled this row against the registry.
    last_verified: Mapped[date | None] = mapped_column(Date)
    #: Branch and second/third campuses, as the registry lists them: [{name_ko, role, region}].
    other_campuses: Mapped[list[dict] | None] = mapped_column(JSON)
    #: Per-tier provenance: {registry: {...}, reference: {...}, international: {...}}.
    sources: Mapped[dict | None] = mapped_column(JSON)

    #: Set only where Hangyul holds verified admission data. Null is the ordinary case.
    catalog_university_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("universities.id", ondelete="SET NULL"), nullable=True, index=True
    )
