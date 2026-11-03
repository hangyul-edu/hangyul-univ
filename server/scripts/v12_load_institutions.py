"""Load (or refresh) the institution directory in a database that already has data.

    server/.venv/bin/python -m scripts.v12_load_institutions

The full seeder refuses to touch a populated database, and refreshing the directory after a new disclosure year
must not mean rebuilding everyone's demo data. This does only the directory, idempotently.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.models import Institution  # noqa: E402
from app.seed.institutions import load_dataset, seed_institutions  # noqa: E402


def main() -> int:
    doc = load_dataset()
    with SessionLocal() as db:
        written = seed_institutions(db)
        db.commit()
        total = db.query(Institution).count()
        active = db.query(Institution).filter_by(status="ACTIVE").count()
        linked = db.query(Institution).filter(Institution.catalog_university_id.isnot(None)).count()
    print(f"dataset survey year {doc['survey_year']} · {written} rows written")
    print(f"institutions table: {total} rows, {active} active, {linked} linked to the application catalogue")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
