"""Honest review times (V4).

The product promises that an uploaded document is checked within ``REVIEW_TARGET_HOURS`` (48 h). The core seed spread
upload dates over 2–80 days, so every document "being checked" had silently waited for weeks — exactly the state the
V4 audit flagged ("being checked … submitted 2 months ago").

After the core seed and the persona add-ons, every document still waiting for a review (UPLOADED / NEEDS_REVIEW) is
re-dated to a recent upload (a few hours to about a day ago). Exactly ONE review is deliberately late so the
"taking longer than usual" state can be demonstrated: Lan's bank balance certificate, uploaded four days ago.

The matching review tasks (generated after the add-ons) are re-dated in ``run.py`` from these times: created when the
file was uploaded, due ``REVIEW_TARGET_HOURS`` later.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentVersion, User
from app.models.enums import DocumentCategory as DC
from app.models.enums import DocumentStatus

IN_REVIEW = (DocumentStatus.UPLOADED, DocumentStatus.NEEDS_REVIEW)
# The one review that is intentionally past its target (see tests/test_seed_invariants.py).
OVERDUE_OWNER = "student@demo.hangyul.kr"
OVERDUE_CATEGORY = DC.BANK_STATEMENT
OVERDUE_AGE = timedelta(days=4)
# Every other in-review upload is at most this old when the seed runs.
MAX_FRESH_AGE = timedelta(hours=26)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    now = datetime.now(timezone.utc)
    rng = random.Random(2604)
    overdue_owner = db.scalar(select(User.id).where(User.email == OVERDUE_OWNER))
    docs = db.scalars(select(Document).where(Document.status.in_(IN_REVIEW)).order_by(Document.id)).all()
    for d in docs:
        overdue = d.owner_user_id == overdue_owner and d.category == OVERDUE_CATEGORY
        uploaded = now - (OVERDUE_AGE if overdue else timedelta(minutes=rng.randint(2 * 60, int(MAX_FRESH_AGE.total_seconds() // 60))))
        # The latest version is the upload waiting for review; earlier versions (if any) keep their older dates.
        latest = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == d.id).order_by(DocumentVersion.version.desc()).limit(1))
        if latest is not None:
            latest.created_at = uploaded
        d.created_at = min(d.created_at, uploaded) if d.created_at else uploaded
        d.updated_at = uploaded
