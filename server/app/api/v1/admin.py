"""Source registry, freshness review queue, audit log (Hangyul staff; agencies see their own org's audit)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.common import Page, iso, paginate, parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_staff
from app.models import AuditLog, FreshnessReview, Source, SourceSnapshot, User
from app.models.base import utcnow
from app.models.enums import SourceType, VerificationStatus
from app.services.freshness import run_freshness_scan

router = APIRouter(tags=["admin"])


def ser_source(s: Source) -> dict:
    return {"id": str(s.id), "key": s.key, "name": s.name, "url": s.url, "source_type": s.source_type.value, "topic": s.topic, "summary": s.summary,
            "last_checked_at": iso(s.last_checked_at), "last_changed_at": iso(s.last_changed_at), "review_interval_days": s.review_interval_days,
            "status": s.status.value, "ingestion_method": s.ingestion_method}


@router.get("/sources")
def sources(page: Page = Depends(), status: list[str] | None = Query(None), q: str | None = None,
            include_internal: bool = Query(False), db: Session = Depends(get_db)):
    """The source registry is public: every fact shown to students links back here.

    V12: `source_type == DEMO` rows are the provenance of the seeded sample data. They are real and useful
    *internally* — the HQ source registry needs them to show where a seeded figure came from — and they must
    never reach a public page, where a row reading "Hangyul Univ development sample data" is exactly the
    development-site signal this pass removes. Public callers get the real sources; internal callers opt in.
    """
    stmt = select(Source)
    if not include_internal:
        stmt = stmt.where(Source.source_type != SourceType.DEMO)
    if status:
        stmt = stmt.where(Source.status.in_(status))
    if q:
        stmt = stmt.where(Source.name.ilike(f"%{q}%") | Source.topic.ilike(f"%{q}%"))
    return paginate(db, stmt.order_by(Source.status, Source.name), page, ser_source)


class CheckIn(BaseModel):
    changed: bool
    note: str | None = Field(default=None, max_length=2000)


@router.post("/sources/{source_id}/check")
def check_source(source_id: str, body: CheckIn, p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(403, "Hangyul staff only")
    s = db.get(Source, parse_uuid(source_id))
    if not s:
        raise HTTPException(404, "Not found")
    now = utcnow()
    db.add(SourceSnapshot(source_id=s.id, checked_at=now, note=body.note, checked_by_id=p.id))
    s.last_checked_at = now
    s.reviewer_id = p.id
    if body.changed:
        s.last_changed_at = now
        s.status = VerificationStatus.CHANGED
        db.add(FreshnessReview(entity_type="source", entity_id=str(s.id), entity_label=s.name, reason=VerificationStatus.CHANGED, detail=body.note, source_id=s.id))
    else:
        s.status = VerificationStatus.CURRENT
    audit(db, action="source.check", entity_type="source", entity_id=s.id, actor=p, detail={"changed": body.changed})
    db.commit()
    return ser_source(s)


@router.get("/freshness/reviews")
def reviews(open_only: bool = True, p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(FreshnessReview)
    if open_only:
        stmt = stmt.where(FreshnessReview.resolved_at.is_(None))
    rows = db.scalars(stmt.order_by(FreshnessReview.created_at.desc()).limit(300)).all()
    # V6: the source's type travels with each item so Hangyul operations can group the queue by risk and kind.
    src_ids = {r.source_id for r in rows if r.source_id}
    src_type = {s.id: s.source_type.value for s in db.scalars(select(Source).where(Source.id.in_(src_ids)))} if src_ids else {}
    return [{"id": str(r.id), "entity_type": r.entity_type, "entity_id": r.entity_id, "entity_label": r.entity_label, "reason": r.reason.value, "detail": r.detail,
             "created_at": iso(r.created_at), "resolved_at": iso(r.resolved_at), "resolution": r.resolution,
             "source_type": src_type.get(r.source_id) if r.source_id else None} for r in rows]


class ResolveIn(BaseModel):
    resolution: str = Field(pattern="^(CONFIRMED|UPDATED|ARCHIVED)$")


@router.post("/freshness/reviews/{rid}/resolve")
def resolve(rid: str, body: ResolveIn, p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(403, "Hangyul staff only")
    r = db.get(FreshnessReview, parse_uuid(rid))
    if not r:
        raise HTTPException(404, "Not found")
    r.resolved_at, r.resolved_by_id, r.resolution = utcnow(), p.id, body.resolution
    if r.entity_type == "source" and r.source_id:
        s = db.get(Source, r.source_id)
        s.status = VerificationStatus.ARCHIVED if body.resolution == "ARCHIVED" else VerificationStatus.CURRENT
        s.last_checked_at = utcnow()
    audit(db, action="freshness.resolve", entity_type=r.entity_type, entity_id=r.entity_id, actor=p, detail={"resolution": body.resolution})
    db.commit()
    return {"ok": True}


@router.post("/freshness/scan")
def scan(p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(403, "Hangyul staff only")
    n = run_freshness_scan(db)
    db.commit()
    return {"created": n}


# V8: the audit log is read as sentences ("Đinh Thị Hoa opened Trần Minh Thư's bank balance certificate"), so every row
# carries the actor's and the student's names and a readable target (document category, university, essay type …),
# resolved in bulk. Raw ids and JSON stay out of the response's display fields; `detail` keeps only readable facts.
READABLE_DETAIL = {"from", "to", "status", "count", "scope", "name", "resolution", "changed", "decision", "kind", "internal", "attachments",
                   "version", "reason", "follow_up"}


def _audit_scope(p: Principal):
    stmt = select(AuditLog)
    if not p.is_hangyul:
        stmt = stmt.where(AuditLog.actor_org_id == p.org_id)
    return stmt


def _targets(db: Session, rows: list[AuditLog]) -> dict[tuple[str, str], dict]:
    """Readable label for each (entity_type, entity_id) in one query per type."""
    import uuid as _uuid

    from app.models import Application, Conversation, Document, Essay, SavedView, Task, University
    from app.models.student import Appointment
    from app.models.v5_concierge import ServiceCase

    by: dict[str, set] = {}
    for a in rows:
        if a.entity_id:
            try:
                by.setdefault(a.entity_type, set()).add(_uuid.UUID(str(a.entity_id)))
            except ValueError:
                pass
    out: dict[tuple[str, str], dict] = {}
    ids = by.get("document")
    if ids:
        for d in db.scalars(select(Document).where(Document.id.in_(ids))):
            out[("document", str(d.id))] = {"type": "document", "category": d.category.value, "label": d.title}
    ids = by.get("application")
    if ids:
        for a, uni in db.execute(select(Application, University.name_en).join(University, University.id == Application.university_id).where(Application.id.in_(ids))):
            out[("application", str(a.id))] = {"type": "application", "university": uni, "status": a.status.value}
    ids = by.get("essay")
    if ids:
        for e in db.scalars(select(Essay).where(Essay.id.in_(ids))):
            out[("essay", str(e.id))] = {"type": "essay", "essay_type": e.essay_type.value, "label": e.title}
    ids = by.get("saved_view")
    if ids:
        for v in db.scalars(select(SavedView).where(SavedView.id.in_(ids))):
            out[("saved_view", str(v.id))] = {"type": "saved_view", "label": v.name}
    ids = by.get("service_case")
    if ids:
        for c in db.scalars(select(ServiceCase).where(ServiceCase.id.in_(ids))):
            out[("service_case", str(c.id))] = {"type": "service_case", "case_type": c.case_type}
    ids = by.get("conversation")
    if ids:
        for c in db.scalars(select(Conversation).where(Conversation.id.in_(ids))):
            out[("conversation", str(c.id))] = {"type": "conversation", "label": c.subject}
    ids = by.get("appointment")
    if ids:
        for ap in db.scalars(select(Appointment).where(Appointment.id.in_(ids))):
            out[("appointment", str(ap.id))] = {"type": "appointment", "kind": ap.kind}
    ids = by.get("task")
    if ids:
        for t in db.scalars(select(Task).where(Task.id.in_(ids))):
            out[("task", str(t.id))] = {"type": "task", "label": t.title}
    ids = by.get("source")
    if ids:
        for s_ in db.scalars(select(Source).where(Source.id.in_(ids))):
            out[("source", str(s_.id))] = {"type": "source", "label": s_.name}
    return out


@router.get("/audit")
def audit_log(page: Page = Depends(), action: str | None = None, subject_id: str | None = None, actor_id: str | None = None,
              p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = _audit_scope(p)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"{action}%"))
    if subject_id:
        stmt = stmt.where(AuditLog.subject_user_id == parse_uuid(subject_id))
    if actor_id:
        stmt = stmt.where(AuditLog.actor_user_id == parse_uuid(actor_id))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditLog.created_at.desc()).limit(page.page_size).offset((page.page - 1) * page.page_size)).all()
    uids = {a.actor_user_id for a in rows if a.actor_user_id} | {a.subject_user_id for a in rows if a.subject_user_id}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(uids))).all()) if uids else {}
    targets = _targets(db, rows)

    def ser(a: AuditLog):
        target = targets.get((a.entity_type, str(a.entity_id))) if a.entity_id else None
        if target is None and a.entity_type == "student":
            target = {"type": "student"}
        facts = {k: v for k, v in (a.detail or {}).items() if k in READABLE_DETAIL and isinstance(v, (str, int, float, bool))}
        return {"id": str(a.id), "action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id,
                "actor": names.get(a.actor_user_id, "system") if a.actor_user_id else "system",
                "actor_id": str(a.actor_user_id) if a.actor_user_id else None,
                "subject_user_id": str(a.subject_user_id) if a.subject_user_id else None,
                "subject_name": names.get(a.subject_user_id) if a.subject_user_id else None,
                "target": target, "facts": facts, "detail": a.detail, "ip": a.ip, "at": iso(a.created_at)}

    return {"items": [ser(a) for a in rows], "total": total, "page": page.page, "page_size": page.page_size}


@router.get("/audit/people")
def audit_people(p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    """Filter options: who appears in this organization's audit log as actor or as the student concerned (names only)."""
    scope = _audit_scope(p).subquery()
    actors = db.execute(select(User.id, User.full_name).where(User.id.in_(select(scope.c.actor_user_id))).order_by(User.full_name).limit(300)).all()
    students = db.execute(select(User.id, User.full_name).where(User.id.in_(select(scope.c.subject_user_id))).order_by(User.full_name).limit(500)).all()
    return {"actors": [{"id": str(i), "name": n} for i, n in actors], "students": [{"id": str(i), "name": n} for i, n in students]}
