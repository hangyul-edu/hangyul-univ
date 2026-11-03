"""TEST / E2E DATABASES ONLY — wrap the seeded sample requirements in labelled fixture guides (REPORT §361).

    cd server && .venv/bin/python -m scripts.v27_test_fixture_guides

Used by `tests/conftest.py` and `scripts/qa/e2e-db.mjs template`. Refuses any database whose name lacks "test"/"e2e".
"""
#: University × level combinations deliberately left WITHOUT a guide, so the V27 negative paths keep real cases.
UNCOVERED = {("sungkyunkwan-university", "MASTER")}


def build() -> int:
    """TEST DATABASE ONLY. V27 builds checklists exclusively from VERIFIED official guides; the older suites exercise the
    checklist *machinery* (upload, reuse, legalization, essays, submission) against the seeded sample requirements. For
    every catalogue university × level (bar UNCOVERED), those sample rows are wrapped in a guide titled
    "TEST FIXTURE — not an official guide" with its own `verification_status`, so the machinery stays tested while
    development and production data never contain one (the seed does not create them; this runs only here)."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.core.db import SessionLocal, engine
    from app.models import AdmissionGuide, DocumentRequirement, Institution, Program, University

    name = engine.url.database or ""
    if "test" not in name and "e2e" not in name:
        raise SystemExit(f"Refusing to write TEST FIXTURE guides into {name!r} (only a test or e2e database)")
    made = 0
    with SessionLocal() as db:
        for u in db.scalars(select(University)).all():
            inst = db.scalar(select(Institution).where(Institution.catalog_university_id == u.id))
            if inst is None:
                continue
            levels = {p.degree_level.value for p in db.scalars(select(Program).where(Program.university_id == u.id)).all()}
            demo = db.scalars(select(DocumentRequirement).where(DocumentRequirement.university_id == u.id, DocumentRequirement.guide_id.is_(None),
                                                                DocumentRequirement.verification_status == "DEMO")).all()
            for level in levels:
                g_level, applicant = ("BACHELOR", "TRANSFER") if level == "TRANSFER" else (level, "FRESHMAN")
                if (u.slug, g_level) in UNCOVERED:
                    continue
                # The fixture is a *later* round (2027 FALL) than any real guide loaded today, so the older suites keep the
                # requirement set their persona data was seeded for; the real guides stay in the table and the V27 tests
                # read them by status and evidence (test_v27_requirements.py).
                g = AdmissionGuide(institution_id=inst.id, university_id=u.id, intake_year=2027, term="FALL", degree_level=g_level,
                                   applicant_type=applicant, status="VERIFIED", title="TEST FIXTURE — not an official guide",
                                   source_url="https://example.invalid/test-fixture", verified_at=datetime.now(timezone.utc),
                                   verification_status="TEST_FIXTURE")
                db.add(g)
                db.flush()
                made += 1
                for r in demo:
                    if r.degree_level and r.degree_level != level:
                        continue
                    db.add(DocumentRequirement(university_id=u.id, guide_id=g.id, degree_level=g_level, category=r.category, label=r.label,
                                               is_required=r.is_required, legalization_required=r.legalization_required,
                                               legalization_rule="APOSTILLE_OR_CONSULAR" if r.legalization_required else None,
                                               translation_required=r.translation_required, applies_to_nationalities=r.applies_to_nationalities,
                                               max_age_days=r.max_age_days, notes=r.notes, sort_order=r.sort_order,
                                               evidence="test fixture", source_url=g.source_url, verification_status="TEST_FIXTURE"))
        db.commit()
    return made


if __name__ == "__main__":
    print("fixture guides:", build())
