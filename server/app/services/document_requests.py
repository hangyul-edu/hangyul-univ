"""University document requests — the full loop.

1. A university reviewer asks for one more document with an exact note ("Please upload a bank certificate issued within
   the last 30 days").
2. A DocumentRequest is stored; the application moves to ADDITIONAL_DOCUMENTS when the workflow allows it; a
   student-visible Task carrying the exact note is created; the student, the assigned counselor and Hangyul operations
   are notified.
3. The request appears in the student's application checklist (action_code ``UNIVERSITY_REQUEST``) and on the
   university's applicant page.
4. The student (or their agency) fulfils it with a vault document; the document becomes visible to the university, the
   task closes and the university is notified. The university sees "returned documents" waiting for review.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.audit import track
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    Document,
    DocumentRequest,
    OrganizationMember,
    Task,
    University,
    UserRole,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, Role, TaskPriority, TaskStatus, TaskType
from app.services.notify import notify
from app.services.state_machine import UNIVERSITY, allowed_next


def university_visible_document_ids(university_id):
    """Select of document ids a university may open: shared for an application, or sent for one of its requests."""
    shared = (select(ApplicationDocument.document_id).join(Application, Application.id == ApplicationDocument.application_id)
              .where(Application.university_id == university_id, ApplicationDocument.shared_with_university.is_(True),
                     ApplicationDocument.document_id.is_not(None)))
    requested = (select(DocumentRequest.document_id).join(Application, Application.id == DocumentRequest.application_id)
                 .where(Application.university_id == university_id, DocumentRequest.status == "FULFILLED", DocumentRequest.document_id.is_not(None)))
    return shared.union(requested)


def ser_request(r: DocumentRequest, db: Session) -> dict:
    from app.models import Organization, User

    by = db.get(User, r.requested_by_user_id) if r.requested_by_user_id else None
    org = db.get(Organization, r.requested_by_org_id) if r.requested_by_org_id else None
    doc = db.get(Document, r.document_id) if r.document_id else None
    return {
        "id": str(r.id), "application_id": str(r.application_id), "label": r.label, "note": r.note, "category": r.category,
        "due_date": r.due_date.isoformat() if r.due_date else None, "status": r.status,
        "requested_by_user": {"id": str(by.id), "full_name": by.full_name} if by else None,
        "requested_by_org": {"id": str(org.id), "name": org.name} if org else None,
        "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        "fulfilled_at": r.fulfilled_at.isoformat() if r.fulfilled_at else None,
        "cancelled_at": r.cancelled_at.isoformat() if r.cancelled_at else None,
        "document_id": str(r.document_id) if r.document_id else None,
        "document": {"id": str(doc.id), "title": doc.title, "category": doc.category.value, "status": doc.status.value} if doc else None,
        "task_id": str(r.task_id) if r.task_id else None,
    }


def requests_for(db: Session, app_id) -> list[DocumentRequest]:
    return list(db.scalars(select(DocumentRequest).where(DocumentRequest.application_id == app_id).order_by(DocumentRequest.requested_at.desc())).all())


def checklist_items(db: Session, app: Application) -> list[dict]:
    """Open requests as checklist items, in the same shape as readiness items, so every checklist renders them."""
    out = []
    for r in requests_for(db, app.id):
        if r.status != "OPEN":
            continue
        out.append({
            "requirement_id": f"request:{r.id}", "request_id": str(r.id), "category": r.category or "OTHER", "label": r.label,
            "required": True, "status": "MISSING", "ready": False, "document_id": None, "reused": False,
            "action_code": "UNIVERSITY_REQUEST", "action": r.note, "notes": r.note, "due_date": r.due_date.isoformat() if r.due_date else None,
            "legalization_required": False, "translation_required": False, "verification_status": "CURRENT",
        })
    return out


def _assignment(db: Session, student_user_id):
    return db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))


def _hangyul_ops(db: Session):
    return db.scalars(select(UserRole.user_id).where(UserRole.role.in_([Role.HANGYUL_OPERATIONS]))).all()


def _refresh_readiness(db: Session, app: Application) -> None:
    """Open university requests count against readiness; keep the stored percentage honest after every change."""
    from app.models import StudentProfile
    from app.services.readiness import application_readiness

    db.flush()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == app.student_user_id))
    app.readiness_percent, _ = application_readiness(db, app, prof, date.today())


def create_request(db: Session, app: Application, *, actor_id, actor_org_id, label: str, note: str, category: str | None, due_date: date | None) -> DocumentRequest:
    now = utcnow()
    uni = db.get(University, app.university_id)
    r = DocumentRequest(application_id=app.id, label=label.strip(), note=note.strip(), category=category, due_date=due_date, status="OPEN",
                        requested_by_user_id=actor_id, requested_by_org_id=actor_org_id, requested_at=now)
    db.add(r)
    db.flush()
    assignment = _assignment(db, app.student_user_id)
    due_at = datetime.combine(due_date, time(18, 0), tzinfo=timezone.utc) if due_date else None
    task = Task(
        # V31 (REPORT §424): keyed, so every reader gets the sentence in their language and the university's name
        # resolved for them; `title` stays as the English fallback. `item` is the university's own label (content).
        title=f"{uni.name_en} requested: {r.label}", title_key="task.universityRequestItem",
        title_params={"university": uni.name_en, "university_id": str(uni.id), "item": r.label},
        description=r.note, task_type=TaskType.UNIVERSITY_REQUEST,
        priority=TaskPriority.HIGH, status=TaskStatus.OPEN, due_at=due_at, owner_user_id=app.student_user_id,
        owner_org_id=assignment.organization_id if assignment else None, student_user_id=app.student_user_id, application_id=app.id,
        university_id=app.university_id, source="UNIVERSITY", dedupe_key=f"docreq:{r.id}", link=f"/applications/{app.id}",
        visible_to_student=True, created_by_id=actor_id,
    )
    db.add(task)
    db.flush()
    r.task_id = task.id
    # Asking for a document means the university has started reviewing: a SUBMITTED application passes through
    # "under review" first (recorded in history) so the state machine stays the single source of allowed moves.
    if app.status == S.SUBMITTED and S.UNIVERSITY_REVIEW in allowed_next(app.status, UNIVERSITY):
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=S.SUBMITTED, to_status=S.UNIVERSITY_REVIEW, actor_user_id=actor_id,
                                        actor_org_type=UNIVERSITY, created_at=now))
        app.status = S.UNIVERSITY_REVIEW
    # Move the application to "additional documents" when the workflow allows it from here.
    if app.status != S.ADDITIONAL_DOCUMENTS and S.ADDITIONAL_DOCUMENTS in allowed_next(app.status, UNIVERSITY):
        prev = app.status
        app.status = S.ADDITIONAL_DOCUMENTS
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=S.ADDITIONAL_DOCUMENTS, actor_user_id=actor_id,
                                        actor_org_type=UNIVERSITY, note=f"Requested: {r.label} — {r.note}", created_at=now))
    params = {"university": uni.name_en, "university_id": str(uni.id), "document": r.label, "category": r.category}
    notify(db, app.student_user_id, "DOCUMENT_REQUEST", "notify.documentRequest.student",
           f"{uni.name_en} asked you for one more document: {r.label}.", params=params, link=f"/applications/{app.id}")
    if assignment and assignment.counselor_user_id:
        notify(db, assignment.counselor_user_id, "DOCUMENT_REQUEST", "notify.documentRequest.agency",
               f"{uni.name_en} asked your student for: {r.label}.", params=params, link=f"/applications/{app.id}")
    for uid in _hangyul_ops(db):
        notify(db, uid, "DOCUMENT_REQUEST", "notify.documentRequest.agency", f"{uni.name_en} asked a student for: {r.label}.", params=params,
               link=f"/applications/{app.id}")
    _refresh_readiness(db, app)
    track(db, "document_requested", user_id=app.student_user_id, university_id=app.university_id, application_id=app.id, properties={"category": r.category})
    return r


def fulfill_request(db: Session, r: DocumentRequest, app: Application, *, actor_id, document_id) -> DocumentRequest:
    if r.status != "OPEN":
        raise HTTPException(409, "This request is no longer open.")
    doc = db.get(Document, document_id)
    if not doc or doc.owner_user_id != app.student_user_id:
        raise HTTPException(404, "Document not found in this student's vault.")
    now = utcnow()
    r.status, r.document_id, r.fulfilled_at, r.fulfilled_by_user_id = "FULFILLED", doc.id, now, actor_id
    if r.task_id and (t := db.get(Task, r.task_id)) and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED):
        t.status, t.completed_at = TaskStatus.DONE, now
    uni = db.get(University, app.university_id)
    reviewers = [app.university_reviewer_id] if app.university_reviewer_id else []
    if r.requested_by_user_id and r.requested_by_user_id not in reviewers:
        reviewers.append(r.requested_by_user_id)
    if not reviewers:
        org_members = db.scalars(select(OrganizationMember.user_id).where(OrganizationMember.organization_id == r.requested_by_org_id)).all() if r.requested_by_org_id else []
        reviewers = list(org_members)[:3]
    for uid in reviewers:
        notify(db, uid, "DOCUMENT_REQUEST", "notify.documentRequest.fulfilled", f"The applicant sent the document you requested: {r.label}.",
               params={"university": uni.name_en, "university_id": str(uni.id), "document": r.label}, link=f"/applications/{app.id}")
    _refresh_readiness(db, app)
    track(db, "document_request_fulfilled", user_id=app.student_user_id, university_id=app.university_id, application_id=app.id,
          properties={"hours_to_fulfil": round((r.fulfilled_at - r.requested_at).total_seconds() / 3600, 1) if r.fulfilled_at and r.requested_at else None})
    return r


def cancel_request(db: Session, r: DocumentRequest) -> DocumentRequest:
    if r.status != "OPEN":
        raise HTTPException(409, "Only open requests can be cancelled.")
    now = utcnow()
    r.status, r.cancelled_at = "CANCELLED", now
    if r.task_id and (t := db.get(Task, r.task_id)) and t.status != TaskStatus.DONE:
        t.status, t.completed_at = TaskStatus.CANCELLED, now
    _refresh_readiness(db, db.get(Application, r.application_id))
    return r


def returned_counts(db: Session, university_id) -> dict:
    """Applications still waiting for documents vs. those where every request was answered (ready to re-review)."""
    rows = db.execute(
        select(Application.id, DocumentRequest.status).join(DocumentRequest, DocumentRequest.application_id == Application.id)
        .where(Application.university_id == university_id, Application.status == S.ADDITIONAL_DOCUMENTS,
               or_(DocumentRequest.status == "OPEN", DocumentRequest.status == "FULFILLED"))
    ).all()
    by_app: dict = {}
    for app_id, st in rows:
        by_app.setdefault(app_id, set()).add(st)
    returned = [a for a, st in by_app.items() if st == {"FULFILLED"}]
    waiting = [a for a, st in by_app.items() if "OPEN" in st]
    return {"returned": len(returned), "waiting": len(waiting), "returned_ids": [str(a) for a in returned]}
