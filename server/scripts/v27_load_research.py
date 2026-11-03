"""Refresh the V27 research in a live database: content record merge + rules/scholarships/guides.

    cd server && .venv/bin/python -m scripts.v27_load_research
"""
from app.core.db import SessionLocal
from app.seed.institutions import seed_institutions
from app.seed.v27_research import load

with SessionLocal() as db:
    print("institutions", seed_institutions(db))
    print("v27", load(db))
    db.commit()
