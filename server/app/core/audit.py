import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import AnalyticsEvent, AuditLog
from app.models.base import utcnow


def audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: Any = None,
    actor=None,  # Principal | None
    subject_user_id: uuid.UUID | None = None,
    detail: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=getattr(actor, "id", None),
            actor_org_id=getattr(actor, "org_id", None),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            subject_user_id=subject_user_id,
            detail=detail,
            ip=getattr(actor, "ip", None),
            created_at=utcnow(),
        )
    )


def track(
    db: Session,
    name: str,
    *,
    user_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
    university_id: uuid.UUID | None = None,
    application_id: uuid.UUID | None = None,
    nationality: str | None = None,
    properties: dict | None = None,
    occurred_at=None,
) -> None:
    """Product analytics event (see docs/ARCHITECTURE.md#analytics for the event catalogue)."""
    db.add(
        AnalyticsEvent(
            name=name,
            user_id=user_id,
            organization_id=organization_id,
            university_id=university_id,
            application_id=application_id,
            nationality=nationality,
            properties=properties,
            occurred_at=occurred_at or utcnow(),
        )
    )
