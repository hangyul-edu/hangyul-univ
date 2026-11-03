"""Staleness detection. Flags sources and sourced records whose verification is older than the review interval,
or whose effective window has ended. Creates review-queue items; never silently changes facts."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import FreshnessReview, Program, ProgramIntake, Scholarship, Source, University, VisaRequirement
from app.models.base import utcnow
from app.models.enums import VerificationStatus


def _open_review_exists(db: Session, entity_type: str, entity_id: str) -> bool:
    return db.scalar(select(FreshnessReview.id).where(FreshnessReview.entity_type == entity_type, FreshnessReview.entity_id == entity_id,
                                                      FreshnessReview.resolved_at.is_(None))) is not None


def run_freshness_scan(db: Session) -> int:
    now = utcnow()
    created = 0
    for s in db.scalars(select(Source).where(Source.status != VerificationStatus.ARCHIVED)):
        due = (s.last_checked_at or s.created_at) + timedelta(days=s.review_interval_days)
        if due < now and s.status == VerificationStatus.CURRENT:
            s.status = VerificationStatus.REVIEW_DUE
        if s.status in (VerificationStatus.REVIEW_DUE, VerificationStatus.CHANGED, VerificationStatus.CONFLICT) and not _open_review_exists(db, "source", str(s.id)):
            db.add(FreshnessReview(entity_type="source", entity_id=str(s.id), entity_label=s.name, reason=s.status, source_id=s.id,
                                   detail=f"Last checked {s.last_checked_at.date() if s.last_checked_at else 'never'}"))
            created += 1
    horizon = now - timedelta(days=get_settings().freshness_review_days)
    for model, label in ((University, lambda o: o.name_en), (Program, lambda o: o.name_en), (Scholarship, lambda o: o.name),
                         (VisaRequirement, lambda o: f"{o.visa_type.value}: {o.title}")):
        for o in db.scalars(select(model).where(model.verification_status == VerificationStatus.CURRENT.value)):
            expired = o.effective_to is not None and o.effective_to < now.date()
            stale = o.verified_at is None or o.verified_at < horizon
            if (expired or stale) and not _open_review_exists(db, model.__tablename__, str(o.id)):
                o.verification_status = VerificationStatus.REVIEW_DUE.value
                db.add(FreshnessReview(entity_type=model.__tablename__, entity_id=str(o.id), entity_label=label(o), reason=VerificationStatus.REVIEW_DUE,
                                       detail="Effective period ended" if expired else "Verification older than review window", source_id=o.source_id))
                created += 1
    # Intakes whose deadline passed are closed automatically (a factual consequence, not a data change).
    for i in db.scalars(select(ProgramIntake).where(ProgramIntake.is_open.is_(True), ProgramIntake.application_deadline < now.date())):
        i.is_open = False
    db.flush()
    return created
