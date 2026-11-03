"""V26 — impossible dates in the application timeline (REPORT §341, brief §53 data quality).

The seed backdated each application's status history from "40–80 days before its application deadline". For an intake whose
deadline is more than ~80 days away that start lay in the future, so the whole history did: 24 rows dated 2027 on a 2026
database, and the student page said "최근 변경: 서류 준비 중 · 5개월 후" ("last change … in 5 months"). The seed is fixed; this
repairs a database seeded before the fix.

Repair: for every application with a history row in the future, its rows are re-spaced, in their order, between 20 days and 6
hours ago; `created_at`, `updated_at` and `submitted_at` follow. Nothing else moves.

Usage (from server/):  .venv/bin/python scripts/v26_repair_timelines.py [--check]
  --check   count future-dated rows and exit 1 if any (used by `qa:v26` HYGIENE)
"""
from __future__ import annotations

import sys
from datetime import timedelta

from sqlalchemy import func, select

sys.path.insert(0, ".")

from app.core.db import SessionLocal  # noqa: E402
from app.models import Application, ApplicationStatusHistory  # noqa: E402
from app.models.base import utcnow  # noqa: E402


def future_counts(db) -> dict[str, int]:
    now = utcnow()
    return {
        "status history rows dated in the future": db.scalar(select(func.count()).select_from(ApplicationStatusHistory).where(ApplicationStatusHistory.created_at > now)) or 0,
        "applications submitted in the future": db.scalar(select(func.count()).select_from(Application).where(Application.submitted_at > now)) or 0,
        "applications created in the future": db.scalar(select(func.count()).select_from(Application).where(Application.created_at > now)) or 0,
    }


def repair(db) -> int:
    now = utcnow()
    app_ids = set(db.scalars(select(ApplicationStatusHistory.application_id).where(ApplicationStatusHistory.created_at > now)).all())
    app_ids |= set(db.scalars(select(Application.id).where((Application.submitted_at > now) | (Application.created_at > now))).all())
    for aid in app_ids:
        rows = db.scalars(select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == aid)
                          .order_by(ApplicationStatusHistory.created_at, ApplicationStatusHistory.id)).all()
        start, end = now - timedelta(days=20), now - timedelta(hours=6)
        n = max(len(rows) - 1, 1)
        for k, r in enumerate(rows):
            r.created_at = start + (end - start) * (k / n)
        app = db.get(Application, aid)
        if rows:
            app.created_at = rows[0].created_at
            app.updated_at = rows[-1].created_at
            sub = next((r.created_at for r in rows if r.to_status.value == "SUBMITTED"), None)
            app.submitted_at = sub if app.submitted_at is not None else None
        else:
            app.created_at = min(app.created_at, start)
            if app.submitted_at and app.submitted_at > now:
                app.submitted_at = end
    return len(app_ids)


def main() -> int:
    with SessionLocal() as db:
        if "--check" in sys.argv:
            c = future_counts(db)
            for k, v in c.items():
                print(f"{k}: {v}")
            return 1 if any(c.values()) else 0
        print(f"before: {future_counts(db)}")
        n = repair(db)
        db.commit()
        print(f"re-spaced {n} application timelines; after: {future_counts(db)}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
