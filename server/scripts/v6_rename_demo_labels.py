"""V6: apply the seed-realism renames to an already-seeded database without ``db:reset``.

The V6 seed no longer writes per-row development labels ("(Demo)" agency names, "(sample)" suffixes, "Demo provider"
vendor names, "FICTIONAL DEMO CONTRACT" notes, "development sample data" summaries, "DEMO-…" references, "Draft in
progress." essays). This script rewrites the same strings in a live development database so it matches a fresh seed.

* Idempotent: every rule matches only the old wording, so a second run changes nothing.
* Honest: ``is_demo`` / ``verification_status = 'DEMO'`` / ``SAMPLE`` flags are never touched — only visible text.
* The ``sources`` table is left alone: the "Hangyul Univ development sample data" source is the provenance record.

Usage (from server/):  .venv/bin/python scripts/v6_rename_demo_labels.py [--dry-run]
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter

from sqlalchemy import inspect, select, text
from sqlalchemy.types import JSON, String, Text

sys.path.insert(0, ".")

from app.core.db import SessionLocal, engine  # noqa: E402
from app.models import Application, Essay, EssayVersion, Organization, University  # noqa: E402
from app.models.enums import EssayStatus  # noqa: E402
from app.models.v5_success import ApplicationSubmission  # noqa: E402
from app.seed import catalog_data as C  # noqa: E402
from app.seed import essay_text  # noqa: E402
from app.seed.extra_50_success import provider_reference  # noqa: E402

# Substring rules, most specific first. Each "old" is development wording that a fresh V6 seed never writes.
SUBS: list[tuple[str, str]] = [
    ("Lotus Bridge Education (Demo)", "Lotus Bridge Education"),
    ("Silk Road Study Partners (Demo)", "Silk Road Study Partners"),
    ("Himalaya Korea Pathways (Demo)", "Himalaya Korea Pathways"),
    ("Seoul Gateway Admissions (Demo)", "Seoul Gateway Admissions"),
    ("Demo Airport Transfer (sample)", "Seoul Arrival Transfers"),
    ("Demo Housing Provider (sample)", "Campus Nest Housing"),
    ("Demo driver (sample)", "Kim Min-seok"),
    ("Development sample provider. Not a real company.", "Airport pickups from ICN and GMP; fares confirmed per booking."),
    ("Development sample provider. Listings are fictional.", "Studios and shared rooms near campuses in Jongno-gu and Seongbuk-gu."),
    ("demo-transfer", "seoul-arrival"),
    ("FICTIONAL DEMO CONTRACT — not an actual agreement with this university.",
     "Recruitment partnership for the 2027 intakes; quotas and incentives reviewed each semester."),
    (" × Hangyul recruitment partnership (demo)", " × Hangyul recruitment partnership"),
    (" Demo terms.", ""),
    ("first-semester tuition credit (demo)", "first-semester tuition credit"),
    ("Sample upper-secondary school", "Public upper-secondary school"),
    ("Sample institution", "Public upper-secondary school"),
    ("Demo award", "Partner scholarship award"),
    ("Sample data: illustrates a program recommending a level above its published minimum.",
     "The department recommends a level above its published minimum."),
    ("Sample: agreed to finish", "Agreed to finish"),
    ("Sample prompt written by Hangyul for the demo — not the university's official wording.",
     "Drafted by Hangyul — not the university's official wording."),
    (" Program lists, costs and dates shown here are development sample data.", ""),
    ("Sample scholarship record for development. Check the university's current scholarship rules.",
     "Check the university's current scholarship rules before you apply."),
    ("Figures marked **Sample data** in the development environment are placeholders, not verified prices.",
     "Figures not yet checked against an official source are marked **Not yet verified**."),
    ("Hangyul Univ demo file: ", "Hangyul Univ document: "),
    (" (sample)", ""),
]
REGEX: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Sample \w+ program record for development\. Confirm details on the university's official site\."),
     "Confirm the current curriculum, fees and dates on the university's official admissions site before you apply."),
]
NEEDLES = [o for o, _ in SUBS] + ["program record for development"]
SKIP_TABLES = {"alembic_version", "sources"}
PLACEHOLDER_BODIES = {"Draft in progress.", "First draft.", "Final version approved by the counselor."}


def fix_str(s: str) -> str:
    for old, new in SUBS:
        if old in s:
            s = s.replace(old, new)
    for rx, new in REGEX:
        s = rx.sub(new, s)
    return s


def fix_obj(v):
    if isinstance(v, str):
        return fix_str(v)
    if isinstance(v, list):
        return [fix_obj(x) for x in v]
    if isinstance(v, dict):
        return {k: fix_obj(x) for k, x in v.items()}
    return v


def sweep_text_columns(db, counts: Counter) -> None:
    """Every string/JSON column of every table: rewrite values that contain an old development label."""
    insp = inspect(engine)
    for table in insp.get_table_names():
        if table in SKIP_TABLES:
            continue
        for col in insp.get_columns(table):
            t = col["type"]
            is_json = isinstance(t, JSON) or t.__class__.__name__.upper() in ("JSON", "JSONB")
            if not (is_json or isinstance(t, (String, Text))):
                continue
            name = col["name"]
            expr = f'"{name}"::text' if is_json else f'"{name}"'
            where = " OR ".join(f"{expr} LIKE :n{i}" for i in range(len(NEEDLES)))
            params = {f"n{i}": f"%{n}%" for i, n in enumerate(NEEDLES)}
            rows = db.execute(text(f'SELECT ctid::text, "{name}" FROM "{table}" WHERE {where}'), params).all()
            for ctid, val in rows:
                if is_json:
                    data = val if not isinstance(val, str) else json.loads(val)
                    new = fix_obj(data)
                    if new != data:
                        cast = "jsonb" if t.__class__.__name__.upper() == "JSONB" else "json"
                        db.execute(text(f'UPDATE "{table}" SET "{name}" = CAST(:v AS {cast}) WHERE ctid = CAST(:c AS tid)'),
                                   {"v": json.dumps(new), "c": ctid})
                        counts[f"{table}.{name}"] += 1
                else:
                    new = fix_str(val)
                    if new != val:
                        db.execute(text(f'UPDATE "{table}" SET "{name}" = :v WHERE ctid = CAST(:c AS tid)'), {"v": new, "c": ctid})
                        counts[f"{table}.{name}"] += 1


def fix_license_numbers(db, counts: Counter) -> None:
    order = {slug: i + 1 for i, (_, slug, *_rest) in enumerate(C.AGENCIES)}
    for org in db.scalars(select(Organization).where(Organization.license_number == "DEMO-0000")).all():
        if org.slug in order:
            org.license_number = f"{org.country_code}-AG-{order[org.slug]:04d}"
            counts["organizations.license_number"] += 1


def fix_references(db, counts: Counter) -> None:
    for rec in db.scalars(select(ApplicationSubmission).where(ApplicationSubmission.external_reference.like("DEMO-%"))).all():
        app = db.get(Application, rec.application_id)
        uni = db.get(University, app.university_id) if app else None
        new = provider_reference(rec.application_id.hex, uni.slug if uni else "", rec.submitted_on)
        if app is not None and app.external_reference == rec.external_reference:
            app.external_reference = new
            counts["applications.external_reference"] += 1
        rec.external_reference = new
        counts["application_submissions.external_reference"] += 1
    for app in db.scalars(select(Application).where(Application.external_reference.like("DEMO-%"))).all():
        uni = db.get(University, app.university_id)
        app.external_reference = provider_reference(app.id.hex, uni.slug if uni else "", app.submitted_at.date() if app.submitted_at else None)
        counts["applications.external_reference"] += 1


def fix_essays(db, counts: Counter) -> None:
    rows = db.execute(select(EssayVersion, Essay).join(Essay, Essay.id == EssayVersion.essay_id)
                      .where(EssayVersion.body.in_(PLACEHOLDER_BODIES))).all()
    for v, e in rows:
        if v.version < e.current_version:
            body = essay_text.body_for(db, e, partial=True) if v.body == "First draft." else essay_text.body_for(db, e).split("\n\n")[0]
        else:
            body = essay_text.body_for(db, e, partial=e.status == EssayStatus.DRAFT)
        if v.body == "Final version approved by the counselor." and not v.note:
            v.note = "Final version approved by the counselor"
        v.body = body
        counts["essay_versions.body"] += 1


def main() -> None:
    dry = "--dry-run" in sys.argv
    assert "test" not in str(engine.url).rsplit("/", 1)[-1] or "--allow-test" in sys.argv, "Refusing to run against a test database"
    counts: Counter = Counter()
    with SessionLocal() as db:
        sweep_text_columns(db, counts)
        fix_license_numbers(db, counts)
        fix_references(db, counts)
        fix_essays(db, counts)
        if dry:
            db.rollback()
        else:
            db.commit()
    print(("DRY RUN — " if dry else "") + (", ".join(f"{k}: {n}" for k, n in sorted(counts.items())) or "nothing to change"))


if __name__ == "__main__":
    main()
