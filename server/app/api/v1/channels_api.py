"""V8 message channels: which delivery channels this organization can use (in-app live; external ones not connected).
V9 (REPORT §59 A11): per-message delivery state for a conversation, and linking a thread to an application."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_agency_or_hangyul
from app.models import Application, Message, University, User
from app.services import channels

router = APIRouter(tags=["v8", "messaging"])


@router.get("/channels")
def channel_status(p: Principal = Depends(get_principal)):
    """Per-organization channel status. Provider credentials are platform-wide today, so every organization sees the same
    statuses; the shape is per org so per-tenant connections can be added without a client change."""
    return {"organization_id": str(p.org_id) if p.org_id else None, "default": "IN_APP", "channels": channels.statuses()}


def _conv(db: Session, p: Principal, conv_id: str):
    from app.api.v1.collab import _conv as collab_conv

    return collab_conv(db, p, conv_id)


@router.get("/agency/conversations/{conv_id}/delivery")
def delivery(conv_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Delivery state per outbound message (SENT / READ; FAILED only from a provider report) + the linked application."""
    c = _conv(db, p, conv_id)
    msgs = db.scalars(select(Message).where(Message.conversation_id == c.id).order_by(Message.created_at)).all()
    app = None
    if c.application_id:
        row = db.execute(select(Application.id, University.name_en, Application.status).join(University, University.id == Application.university_id)
                         .where(Application.id == c.application_id)).first()
        app = {"id": str(row[0]), "university": row[1], "status": row[2].value} if row else None
    stu = db.get(User, c.student_user_id) if c.student_user_id else None
    return {"conversation_id": str(c.id), "messages": channels.delivery_states(db, c, msgs), "application": app,
            # The student's app language: inserting a template picks this language variant when one exists (A5).
            "student_locale": stu.locale if stu else None,
            "definition": "In-app: Sent when stored, Read when the student opened the conversation after it. External channels are not connected."}


class LinkIn(BaseModel):
    application_id: str | None = None


@router.patch("/agency/conversations/{conv_id}/application")
def link_application(conv_id: str, body: LinkIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Tie a thread to one of the same student's applications (or unlink with null). Audited."""
    c = _conv(db, p, conv_id)
    if body.application_id:
        a = db.get(Application, parse_uuid(body.application_id))
        if a is None or a.student_user_id != c.student_user_id:
            raise HTTPException(404, "Application not found for this student.")
        c.application_id = a.id
    else:
        c.application_id = None
    audit(db, action="conversation.link_application", entity_type="conversation", entity_id=c.id, actor=p, subject_user_id=c.student_user_id,
          detail={"application_id": body.application_id})
    db.commit()
    return {"ok": True, "application_id": str(c.application_id) if c.application_id else None}
