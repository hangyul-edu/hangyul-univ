"""V6 writing review — demo data upgrade (owned by the writing workstream).

- The Hangyul default rubric gets the V6 dimensions (specificity, authenticity, structure, logic, university fit, major
  fit, future plan, evidence, clarity + accuracy rules). Ratings on V5 keys stay valid (same keys where they overlap).

Idempotent: ``apply(db)`` changes nothing when the rubric already has the V6 dimensions. Apply to an existing
development database without a reset:  python -m app.seed.extra_62_writing_v6
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ReviewRubric
from app.services import writing as W


def apply(db: Session) -> dict:
    changed = 0
    for r in db.scalars(select(ReviewRubric).where(ReviewRubric.organization_id.is_(None))).all():
        keys = [d.get("key") for d in (r.dimensions or [])]
        if keys == W.V5_DIMENSION_KEYS:  # only the untouched V5 default; an edited rubric is left alone
            r.dimensions = [dict(d) for d in W.DEFAULT_DIMENSIONS]
            changed += 1
    db.flush()
    return {"rubrics_upgraded": changed}


def seed(db: Session, ctx: dict[str, Any]) -> None:
    apply(db)


if __name__ == "__main__":
    from app.core.db import SessionLocal

    with SessionLocal() as s:
        print(apply(s))
        s.commit()
