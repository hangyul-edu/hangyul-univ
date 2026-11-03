"""Server-backed message templates (V3), replacing per-browser templates.

Scopes (V9, REPORT §59 A5):
  PERSONAL  only the author sees and edits it
  TEAM      everyone in the organization sees it; the author and owners/managers edit it (any staff member may share one)
  ORG       the organization's standard text; only owners/managers create or edit it
Language variants: templates with the same ``group_key`` are one template in several languages (one per locale);
inserting one picks the student's language when a variant exists (client: lib/templates.ts ``pickVariant``).
Bodies use {{placeholders}} filled in by the client.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.common import iso, parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.models import MessageTemplate
from app.models.enums import Role

router = APIRouter(tags=["templates"])

KINDS = ("DOCUMENT_CORRECTION", "APOSTILLE", "ESSAY_FEEDBACK", "DEADLINE_REMINDER", "UNIVERSITY_REQUEST", "VISA_REMINDER",
         "PAYMENT", "ARRIVAL", "HOUSING", "GENERAL")
MANAGERS = (Role.AGENCY_ADMIN, Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS)  # V22
PLACEHOLDERS = ("student_name", "counselor_name", "document", "university", "deadline", "agency_name")


class TemplateIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)
    kind: str = Field("GENERAL", pattern="^(" + "|".join(KINDS) + ")$")
    scope: str = Field("PERSONAL", pattern="^(PERSONAL|TEAM|ORG)$")
    locale: str = Field("en", max_length=12)
    group_key: str | None = Field(default=None, max_length=64, pattern=r"^[a-z0-9_\-]+$")


def _visible(p: Principal):
    return select(MessageTemplate).where(MessageTemplate.organization_id == p.org_id,
                                         or_(MessageTemplate.scope != "PERSONAL", MessageTemplate.owner_user_id == p.id))


def _can_edit(t: MessageTemplate, p: Principal) -> bool:
    if t.scope == "PERSONAL":
        return t.owner_user_id == p.id
    if t.scope == "TEAM":
        return t.owner_user_id == p.id or p.has(*MANAGERS)
    return p.has(*MANAGERS)


def _can_publish(scope: str, p: Principal) -> bool:
    """PERSONAL and TEAM: any staff member; ORG: owners/managers only."""
    return scope != "ORG" or p.has(*MANAGERS)


def ser(t: MessageTemplate, p: Principal) -> dict:
    return {"id": str(t.id), "title": t.title, "body": t.body, "kind": t.kind, "scope": t.scope, "locale": t.locale,
            "group_key": t.group_key or f"t-{t.id}", "mine": t.owner_user_id == p.id, "can_edit": _can_edit(t, p), "updated_at": iso(t.updated_at)}


@router.get("/templates")
def list_templates(kind: str | None = Query(None), p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.org_id:
        return {"items": [], "placeholders": PLACEHOLDERS, "kinds": KINDS}
    stmt = _visible(p)
    if kind:
        stmt = stmt.where(MessageTemplate.kind == kind)
    items = db.scalars(stmt.order_by(MessageTemplate.kind, MessageTemplate.title)).all()
    return {"items": [ser(t, p) for t in items], "placeholders": PLACEHOLDERS, "kinds": KINDS, "can_publish_org": p.has(*MANAGERS)}


@router.post("/templates", status_code=201)
def create_template(body: TemplateIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.org_id:
        raise HTTPException(400, "Select an organization first.")
    if not _can_publish(body.scope, p):
        raise HTTPException(403, "Only owners and managers can publish organization templates.")
    data = body.model_dump()
    _check_variant(db, p, data, None)
    t = MessageTemplate(organization_id=p.org_id, owner_user_id=p.id, **data)
    db.add(t)
    audit(db, action="template.create", entity_type="message_template", entity_id=t.id, actor=p, detail={"scope": body.scope, "kind": body.kind})
    db.commit()
    return ser(t, p)


def _check_variant(db: Session, p: Principal, data: dict, own_id) -> None:
    """One variant per language within a group (and scope): a second Vietnamese text of the same template is refused."""
    if not data.get("group_key"):
        return
    clash = db.scalar(_visible(p).where(MessageTemplate.group_key == data["group_key"], MessageTemplate.locale == data["locale"],
                                        MessageTemplate.scope == data["scope"], *([MessageTemplate.id != own_id] if own_id else [])))
    if clash:
        raise HTTPException(409, "This template already has a version in that language.")


def _get(db: Session, p: Principal, tid: str) -> MessageTemplate:
    t = db.scalar(_visible(p).where(MessageTemplate.id == parse_uuid(tid)))
    if not t:
        raise HTTPException(404, "Not found")
    if not _can_edit(t, p):
        raise HTTPException(403, "You can't change this template.")
    return t


@router.patch("/templates/{template_id}")
def update_template(template_id: str, body: TemplateIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    t = _get(db, p, template_id)
    if not _can_publish(body.scope, p):
        raise HTTPException(403, "Only owners and managers can publish organization templates.")
    data = body.model_dump()
    if data.get("group_key") is None:
        data["group_key"] = t.group_key
    _check_variant(db, p, data, t.id)
    for k, v in data.items():
        setattr(t, k, v)
    audit(db, action="template.update", entity_type="message_template", entity_id=t.id, actor=p, detail={"scope": t.scope, "locale": t.locale})
    db.commit()
    return ser(t, p)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    t = _get(db, p, template_id)
    audit(db, action="template.delete", entity_type="message_template", entity_id=t.id, actor=p, detail={"title": t.title})
    db.delete(t)
    db.commit()
