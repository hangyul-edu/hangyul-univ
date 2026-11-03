"""Apply the V9 university demo data (app/seed/extra_91_university.py) to the live dev database. Idempotent.

    cd server && .venv/bin/python -m scripts.v9_university_data
"""
from app.core.db import SessionLocal
from app.seed.extra_91_university import apply

if __name__ == "__main__":
    with SessionLocal() as db:
        print(apply(db))
        db.commit()
