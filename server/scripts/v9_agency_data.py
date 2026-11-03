"""Apply the V9 agency demo data (app/seed/extra_90_agency_v9.py) to the live development database. Idempotent.

    cd server && .venv/bin/python scripts/v9_agency_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.seed import extra_90_agency_v9  # noqa: E402

if __name__ == "__main__":
    if get_settings().env == "production":
        raise SystemExit("Refusing to write demo data in production.")
    with SessionLocal() as db:
        extra_90_agency_v9.apply(db)
        db.commit()
    print("V9 agency demo data applied.")
