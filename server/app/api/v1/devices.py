"""Push notification device registration (native apps).

Tokens are stored per user and app; delivery happens through `app.services.push` when `HG_PUSH_PROVIDER=expo`
(default `none`: tokens are kept, nothing is sent, in-app notifications remain the source of truth).
"""
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import Principal, get_principal
from app.models import PushToken
from app.models.base import utcnow

router = APIRouter(tags=["devices"])


class PushTokenIn(BaseModel):
    token: str = Field(min_length=8, max_length=255)
    platform: str = Field(pattern="^(ios|android)$")
    app: str = Field(default="student", pattern="^(student|agency|university)$")


@router.post("/me/push-tokens", status_code=204)
def register_push_token(body: PushTokenIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    row = db.scalar(select(PushToken).where(PushToken.token == body.token))
    if row is None:
        row = PushToken(token=body.token, user_id=p.id, platform=body.platform, app=body.app, last_seen_at=utcnow())
        db.add(row)
    else:  # a device moves to whoever signed in last on it
        row.user_id, row.platform, row.app, row.last_seen_at, row.disabled_at = p.id, body.platform, body.app, utcnow(), None
    db.commit()
    return Response(status_code=204)


@router.delete("/me/push-tokens/{token}", status_code=204)
def unregister_push_token(token: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    row = db.scalar(select(PushToken).where(PushToken.token == token, PushToken.user_id == p.id))
    if row:
        db.delete(row)
        db.commit()
    return Response(status_code=204)
