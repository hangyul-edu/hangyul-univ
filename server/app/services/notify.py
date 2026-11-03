"""In-app notifications with i18n keys. Push goes through app.services.push (off unless HG_PUSH_PROVIDER=expo); email/SMS are not integrated."""
from sqlalchemy.orm import Session

from app.models import Notification
from app.models.base import utcnow
from app.services.push import queue_push


def notify(db: Session, user_id, kind: str, title_key: str, fallback: str, *, params: dict | None = None, link: str | None = None) -> None:
    db.add(
        Notification(
            user_id=user_id,
            kind=kind,
            title_key=title_key,
            params=params or {},
            fallback_text=fallback,
            link=link,
            created_at=utcnow(),
        )
    )
    queue_push(db, user_id, fallback, link)
