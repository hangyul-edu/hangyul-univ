"""`npm run qa:v32-data-clean` — the normal runtime database holds reference data and ZERO members (V32, REPORT §436).

Reads HG_DATABASE_URL (server/.env: the development database). Fails if any member, operational, demo-marked or
fixture row exists, and fails just as hard if the verified reference data is missing: the purge must not have taken
the 425 institutions, the scholarships, the rules, the plans or the visa routes with it.

    server/.venv/bin/python scripts/qa/v32/data-clean.py            # the development database
    HG_DATABASE_URL=... server/.venv/bin/python scripts/qa/v32/data-clean.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "server"))
os.chdir(ROOT / "server")
os.environ.setdefault("HG_ENV", "development")

from sqlalchemy import text  # noqa: E402

from app.core.db import SessionLocal, engine  # noqa: E402

#: Tables that must be EMPTY in a runtime database: every member and everything members produce.
MEMBER_TABLES = [
    "users", "user_roles", "student_profiles", "student_educations", "student_languages", "student_terms", "student_enrollments",
    "student_outcomes", "organizations", "organization_members", "agency_assignments", "applications", "application_documents",
    "application_status_history", "application_submissions", "documents", "document_versions", "document_reviews", "essays",
    "essay_versions", "essay_reviews", "essay_comments", "conversations", "conversation_participants", "messages", "message_reads",
    "orders", "payments", "notifications", "tasks", "appointments", "arrival_plans", "visa_cases", "housing_cases", "service_cases",
    "service_engagements", "consent_records", "refresh_tokens", "login_events", "verification_challenges", "saved_universities",
    "saved_views", "message_templates", "partner_contracts", "partner_quotas", "scholarship_awards", "scholarship_pools",
    "export_jobs", "audit_logs", "analytics_events", "data_requests", "vendors", "housing_listings", "writing_prompts",
    "review_rubrics", "reviewer_profiles", "language_recommendations", "submission_connectors", "universities", "programs",
    "program_intakes", "dormitories", "campuses", "admission_requirements",
]
#: Reference data that must be PRESENT (minimums, not exact counts — the research grows).
REFERENCE_MIN = {"institutions": 425, "scholarships": 400, "admission_language_rules": 900, "admission_guides": 10, "countries": 50,
                 "locales": 50, "sources": 45, "service_products": 3, "service_prices": 3, "legalization_rules": 5, "visa_requirements": 50,
                 "visa_routes": 30, "content_articles": 10}
FIXTURE_MARKERS = ["@demo.hangyul.kr", "example.invalid", "TEST FIXTURE"]


def main() -> int:
    bad: list[str] = []
    with SessionLocal() as db:
        name = engine.url.database
        tables = set(db.execute(text("select table_name from information_schema.tables where table_schema='public'")).scalars())
        cols = {}
        for t, c in db.execute(text("select table_name, column_name from information_schema.columns where table_schema='public'")).all():
            cols.setdefault(t, set()).add(c)
        for t in MEMBER_TABLES:
            if t not in tables:
                continue
            n = db.execute(text(f'select count(*) from "{t}"')).scalar()
            if n:
                bad.append(f"{t}: {n} rows (must be 0)")
        demo = 0
        for t in sorted(tables):
            if "is_demo" in cols.get(t, ()):
                demo += db.execute(text(f'select count(*) from "{t}" where is_demo')).scalar() or 0
            if "verification_status" in cols.get(t, ()):
                n = db.execute(text(f"select count(*) from \"{t}\" where verification_status in ('DEMO', 'SAMPLE')")).scalar() or 0
                if n:
                    bad.append(f"{t}: {n} rows with verification_status DEMO/SAMPLE")
        if demo:
            bad.append(f"{demo} rows marked is_demo=true")
        for t in sorted(tables):
            textcols = [c for c, in db.execute(text("select column_name from information_schema.columns where table_schema='public' and table_name=:t and data_type in ('text','character varying')"), {"t": t}).all()]
            for c in textcols:
                for marker in FIXTURE_MARKERS:
                    n = db.execute(text(f'select count(*) from "{t}" where "{c}" like :m'), {"m": f"%{marker}%"}).scalar() or 0
                    if n:
                        bad.append(f"{t}.{c}: {n} rows contain fixture marker {marker!r}")
        for t, minimum in REFERENCE_MIN.items():
            n = db.execute(text(f'select count(*) from "{t}"')).scalar() if t in tables else -1
            if n < minimum:
                bad.append(f"{t}: {n} rows (reference data missing; expected >= {minimum})")
        inst = db.execute(text("select count(*) from institutions where status='ACTIVE'")).scalar()
    print(f"database {name!r}: {inst} active institutions")
    for b in bad:
        print("FAIL ", b)
    print("PASS  runtime database is reference-only with zero members" if not bad else f"FAIL  qa:v32-data-clean ({len(bad)} findings)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
