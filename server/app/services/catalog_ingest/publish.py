"""Publish: write validated payloads into the catalogue tables (universities, programmes, intakes, requirements).

Rules every writer here follows:

* **Never null-overwrite.** A payload field that is null leaves the stored value alone; a source that failed stages
  nothing, so nothing it previously published is touched.
* **Never touch what the importer does not own.** A university row marked DEMO (development fixtures) keeps its own
  values; it is only linked. A programme without a ``catalog_key`` is never updated or retired.
* **Never delete.** A programme that disappears from the official unit list is deactivated (``is_active = false``)
  and its intakes closed — applications may reference it.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import (
    AdmissionGuide,
    AdmissionRequirement,
    DocumentRequirement,
    Institution,
    Program,
    ProgramIntake,
    Scholarship,
    University,
)
from app.models.enums import DegreeLevel, InstitutionType, InstructionLanguage, IntakeTerm

ORIGIN = "OFFICIAL_GUIDE"


def _dt(v: str | None) -> datetime | None:
    if not v:
        return None
    d = date.fromisoformat(v[:10])
    return datetime.combine(d, time(0), tzinfo=timezone.utc)


def _date(v: str | None) -> date | None:
    return date.fromisoformat(v[:10]) if v else None


def _set(row, field: str, value) -> bool:
    if value is None:
        return False
    if getattr(row, field) != value:
        setattr(row, field, value)
        return True
    return False


# ------------------------------------------------------------------------------------------------ universities

def apply_university(db: Session, inst: Institution | None, payload: dict, by_slug: dict[str, University]) -> str:
    """Create or update the one University row for a directory institution. Returns CREATED | CHANGED | UNCHANGED."""
    u = None
    if inst is not None and inst.catalog_university_id:
        u = db.get(University, inst.catalog_university_id)
    if u is None:
        u = by_slug.get(payload["slug"])
    created = u is None
    if created:
        u = University(
            slug=payload["slug"], name_ko=payload["name_ko"], name_en=payload["name_en"] or payload["name_ko"],
            name_en_recorded=bool(payload["name_en"]), institution_type=InstitutionType(payload["institution_type"]),
            region=payload["region"], has_international_office=bool(payload.get("has_international_office")),
            is_partner=False, certification_status="UNKNOWN", visa_certification="UNKNOWN",
        )
        db.add(u)
        by_slug[u.slug] = u
    changed = False
    if u.verification_status != "DEMO" or created:
        changed |= _set(u, "name_ko", payload["name_ko"])
        if payload["name_en"]:
            changed |= _set(u, "name_en", payload["name_en"])
            changed |= _set(u, "name_en_recorded", True)
        elif u.name_en_recorded is False or not u.name_en:
            # No published English name: the official Korean name stands in, flagged as such (never translated).
            changed |= _set(u, "name_en", payload["name_ko"])
            changed |= _set(u, "name_en_recorded", False)
        changed |= _set(u, "institution_type", InstitutionType(payload["institution_type"]))
        changed |= _set(u, "institution_kind", payload.get("institution_kind"))
        changed |= _set(u, "region", payload["region"])
        for f in ("city", "website_url", "international_admissions_url", "founded_year", "latitude", "longitude",
                  "certification_status", "certification_source_url"):
            changed |= _set(u, f, payload.get(f))
        changed |= _set(u, "certification_verified_at", _date(payload.get("certification_verified_at")))
        if payload.get("has_international_office"):
            changed |= _set(u, "has_international_office", True)
        changed |= _set(u, "source_url", payload.get("source_url"))
        changed |= _set(u, "verified_at", _dt(payload.get("verified_at")))
        changed |= _set(u, "verification_status", "CURRENT" if payload.get("verified_at") else "REVIEW_DUE")
    else:
        # A development fixture row keeps its own (sample) values; identity facts it lacks are filled in.
        changed |= _set(u, "institution_kind", payload.get("institution_kind") if not u.institution_kind else None)
        changed |= _set(u, "name_en_recorded", bool(payload["name_en"]) if u.name_en_recorded is None else None)
    db.flush()
    if inst is not None and inst.catalog_university_id != u.id:
        inst.catalog_university_id = u.id
        changed = True
    return "CREATED" if created else ("CHANGED" if changed else "UNCHANGED")


def relink_research(db: Session) -> dict:
    """V27 rows (guides, guide document requirements, verified scholarships) were written against the institution;
    attach each to its institution's catalogue university so Student reads one set of rows."""
    uni_of = select(Institution.catalog_university_id).where(Institution.id == AdmissionGuide.institution_id).scalar_subquery()
    g = db.execute(update(AdmissionGuide).where(AdmissionGuide.university_id.is_(None)).values(university_id=uni_of)
                   .execution_options(synchronize_session=False)).rowcount
    guide_uni = select(AdmissionGuide.university_id).where(AdmissionGuide.id == DocumentRequirement.guide_id).scalar_subquery()
    d = db.execute(update(DocumentRequirement).where(DocumentRequirement.university_id.is_(None), DocumentRequirement.guide_id.is_not(None))
                   .values(university_id=guide_uni).execution_options(synchronize_session=False)).rowcount
    s_uni = select(Institution.catalog_university_id).where(Institution.id == Scholarship.institution_id).scalar_subquery()
    s = db.execute(update(Scholarship).where(Scholarship.university_id.is_(None), Scholarship.institution_id.is_not(None))
                   .values(university_id=s_uni).execution_options(synchronize_session=False)).rowcount
    return {"guides": g or 0, "document_requirements": d or 0, "scholarships": s or 0}


# ------------------------------------------------------------------------------------------------ programmes

def _status(payload: dict) -> str:
    return "CURRENT" if payload["status"] == "VERIFIED" else payload["status"]


def apply_programme(db: Session, university: University, payload: dict, existing: Program | None, today: date) -> str:
    created = existing is None
    p = existing or Program(university_id=university.id, catalog_key=payload["key"], origin=ORIGIN, is_active=True,
                            name_en=payload["name_en"] or payload["name_ko"], degree_level=DegreeLevel(payload["degree_level"]),
                            instruction_language=InstructionLanguage(payload["instruction_language"]))
    if created:
        db.add(p)
    changed = False
    changed |= _set(p, "university_id", university.id)
    changed |= _set(p, "name_ko", payload["name_ko"])
    changed |= _set(p, "name_en", payload["name_en"] or payload["name_ko"])
    changed |= _set(p, "name_en_recorded", bool(payload["name_en"]))
    changed |= _set(p, "degree_level", DegreeLevel(payload["degree_level"]))
    changed |= _set(p, "instruction_language", InstructionLanguage(payload["instruction_language"]))
    for f in ("field", "college_ko", "campus_name", "tuition_per_semester_krw", "application_fee_krw", "source_url", "source_page"):
        changed |= _set(p, f, payload.get(f))
    evidence = payload.get("evidence") or ""
    note = payload.get("tuition_unverified_period")
    if note:
        evidence += (f" · Tuition printed as {note['amount_krw']:,} KRW ({note.get('basis') or 'basis not stated'}, "
                     f"{note.get('source_page') or ''}); the guide does not state the period, so it is not stored as per-semester.")
    changed |= _set(p, "evidence", evidence or None)
    changed |= _set(p, "verified_at", _dt(payload.get("verified_at")))
    changed |= _set(p, "verification_status", _status(payload))
    changed |= _set(p, "is_active", True)
    db.flush()

    intake = payload.get("intake")
    if intake:
        rows = {(i.year, i.term.value, i.round): i for i in p.intakes} if not created else {}
        stale = payload["status"] != "VERIFIED"
        for r in intake["rounds"]:
            key = (intake["year"], intake["term"], r["round"])
            row = rows.get(key)
            deadline = _date(r["application_deadline"])
            if row is None:
                row = ProgramIntake(program_id=p.id, year=intake["year"], term=IntakeTerm(intake["term"]), round=r["round"],
                                    application_deadline=deadline)
                db.add(row)
                changed = True
            changed |= _set(row, "application_deadline", deadline)
            changed |= _set(row, "application_opens", _date(r.get("application_opens")))
            changed |= _set(row, "document_deadline", _date(r.get("document_deadline")))
            # A stale guide's dates are history: kept for reference, never offered as an open round.
            is_open = (not stale) and deadline >= today
            if row.is_open != is_open:
                row.is_open = is_open
                changed = True
            changed |= _set(row, "source_url", payload["source_url"])
            changed |= _set(row, "verified_at", _dt(payload.get("verified_at")))
            changed |= _set(row, "verification_status", "STALE" if stale else "CURRENT")
    req = payload.get("requirement")
    if req:
        row = p.requirements[0] if (not created and p.requirements) else None
        if row is None:
            row = AdmissionRequirement(program_id=p.id)
            db.add(row)
            changed = True
        for f in ("min_topik_level", "min_ielts", "min_toefl_ibt"):
            if getattr(row, f) != req.get(f):
                setattr(row, f, req.get(f))  # the guide's set of minimums replaces the previous set as a whole
                changed = True
        changed |= _set(row, "language_alternative", req["language_alternative"])
        changed |= _set(row, "notes", f"Language minimums stated in the official guide: {payload.get('guide_title') or payload['source_url']}"[:2000])
        changed |= _set(row, "source_url", payload["source_url"])
        changed |= _set(row, "verified_at", _dt(payload.get("verified_at")))
        changed |= _set(row, "verification_status", _status(payload))
    db.flush()
    return "CREATED" if created else ("CHANGED" if changed else "UNCHANGED")


def retire_programmes(db: Session, keep_keys: set[str], slugs_covered: set[str]) -> int:
    """Deactivate importer-owned programmes of the covered universities that the latest unit lists no longer name."""
    if not slugs_covered:
        return 0
    n = 0
    rows = db.execute(select(Program, University.slug).join(University, University.id == Program.university_id)
                      .where(Program.origin == ORIGIN, Program.is_active.is_(True), University.slug.in_(slugs_covered))).all()
    for p, _slug in rows:
        if p.catalog_key not in keep_keys:
            p.is_active = False
            for i in p.intakes:
                i.is_open = False
            n += 1
    db.flush()
    return n


def close_past_intakes(db: Session, today: date) -> int:
    """Rounds whose deadline has passed are no longer open (the catalogue is re-derived weekly)."""
    q = (update(ProgramIntake).where(ProgramIntake.is_open.is_(True), ProgramIntake.application_deadline < today,
                                     ProgramIntake.program_id.in_(select(Program.id).where(Program.origin == ORIGIN)))
         .values(is_open=False).execution_options(synchronize_session=False))
    return db.execute(q).rowcount or 0


def mark_superseded_guides(db: Session, pairs: set[tuple[str, str, str]]) -> int:
    """(slug, old_url, new_url): the official guide moved to a new URL. The V27 guide row keeps every value and is
    flagged REVIEW_DUE with a note naming the current document."""
    n = 0
    for slug, old, new in pairs:
        for g in db.scalars(select(AdmissionGuide).join(Institution, Institution.id == AdmissionGuide.institution_id)
                            .where(Institution.slug == slug, AdmissionGuide.source_url == old)):
            note = f"Superseded: the official guide is now published at {new}"
            if note not in (g.reviewer_note or ""):
                g.reviewer_note = ((g.reviewer_note + " · ") if g.reviewer_note else "") + note
                g.verification_status = "REVIEW_DUE"
                n += 1
    db.flush()
    return n
