"""Essays (review workflow), tasks, messaging, notifications, visa cases."""
import uuid
from datetime import date, datetime
from types import SimpleNamespace

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, selectinload

from app.api.common import Page, iso, paginate, parse_uuid, ser_user_public
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, get_principal, require_staff
from app.core.scanning import ensure_servable, settle_attachment
from app.core.security import sign_file_token
from app.core.storage import get_storage, scan_bytes, sha256, validate_upload
from app.models import (
    AgencyAssignment,
    Application,
    Conversation,
    ConversationParticipant,
    Essay,
    EssayComment,
    EssayVersion,
    Message,
    MessageAttachment,
    MessageRead,
    Notification,
    OrganizationMember,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    AssignmentStatus,
    ConversationKind,
    EssayType,
    MessageVisibility,
    Role,
    TaskPriority,
    TaskStatus,
    TaskType,
    VisaStatus,
)
from app.models.enums import (
    EssayStatus as E,
)
from app.services import entitlements as entitlements_svc
from app.services import writing as writing_svc
from app.services.access import ensure_student_access, forbidden, scope_student_ids
from app.services.display_identity import author_for
from app.services.essays import diff, precheck, word_count
from app.services.notify import notify
from app.services.tasks_engine import generate_for_student
from app.services.visa import infer_visa, visa_checklist
from app.services.visa_routes import route_view

router = APIRouter(tags=["collaboration"])

# ======================= ESSAYS =======================
# Who may move an essay to which status.
ESSAY_FLOW = {
    E.DRAFT: {E.SUBMITTED: "STUDENT"},
    E.SUBMITTED: {E.AI_PRECHECK: "SYSTEM", E.AGENCY_REVIEW: "STAFF"},
    E.AI_PRECHECK: {E.AGENCY_REVIEW: "STAFF"},
    E.AGENCY_REVIEW: {E.CHANGES_REQUESTED: "STAFF", E.FINAL_REVIEW: "STAFF", E.APPROVED: "STAFF"},
    E.CHANGES_REQUESTED: {E.STUDENT_REVISION: "STUDENT", E.SUBMITTED: "STUDENT"},
    E.STUDENT_REVISION: {E.SUBMITTED: "STUDENT"},
    E.FINAL_REVIEW: {E.APPROVED: "STAFF", E.CHANGES_REQUESTED: "STAFF"},
    E.APPROVED: {E.STUDENT_REVISION: "STUDENT"},
}


def _essay(db: Session, p: Principal, essay_id: str) -> Essay:
    e = db.scalar(select(Essay).where(Essay.id == parse_uuid(essay_id)).options(selectinload(Essay.versions), selectinload(Essay.comments)))
    if not e or p.is_university:
        raise forbidden()
    ensure_student_access(db, p, e.owner_user_id)
    return e


def ser_essay(db: Session, e: Essay, p: Principal, full: bool = False) -> dict:
    latest = e.versions[-1] if e.versions else None
    d = {
        "id": str(e.id), "owner_user_id": str(e.owner_user_id), "title": e.title, "essay_type": e.essay_type.value, "status": e.status.value,
        "prompt": e.prompt, "word_limit": e.word_limit, "due_date": iso(e.due_date), "current_version": e.current_version,
        "application_id": str(e.application_id) if e.application_id else None,
        "reviewer": author_for(p, db.get(User, e.reviewer_user_id)) if e.reviewer_user_id else None,
        "word_count": word_count(latest.body) if latest else 0, "updated_at": iso(e.updated_at),
        "open_comments": sum(1 for c in e.comments if c.resolved_at is None and (p.is_student is False or c.visibility == MessageVisibility.PARTICIPANTS)),
    }
    if not p.is_student:
        d["owner_name"] = db.get(User, e.owner_user_id).full_name
    if full:
        d["body"] = latest.body if latest else ""
        d["precheck"] = e.precheck or []
        d["versions"] = [{"version": v.version, "at": iso(v.created_at), "author": author_for(p, db.get(User, v.author_user_id)) if v.author_user_id else None,
                          "note": v.note, "word_count": word_count(v.body)} for v in e.versions]
        decisions = writing_svc.decisions_for(db, e)  # V6: the student's decision on each suggested wording
        d["comments"] = [
            {"id": str(c.id), "version": c.version, "author": author_for(p, db.get(User, c.author_user_id)) if c.author_user_id else None,
             "anchor_start": c.anchor_start, "anchor_end": c.anchor_end, "quote": c.quote, "body": c.body, "suggestion": c.suggestion,
             "visibility": c.visibility.value, "resolved": c.resolved_at is not None, "resolved_at": iso(c.resolved_at), "at": iso(c.created_at),
             **writing_svc.suggestion_fields(c, decisions.get(str(c.id)))}
            for c in sorted(e.comments, key=lambda c: c.created_at)
            if not (p.is_student and c.visibility == MessageVisibility.INTERNAL)
        ]
        d["allowed_transitions"] = [s.value for s, who in ESSAY_FLOW.get(e.status, {}).items() if (who == "STUDENT") == p.is_student and who != "SYSTEM"]
    # V5 writing review: prompt version, review round + SLA, findings, rubric, quality gate, authorship (services/writing.py).
    d["writing"] = writing_svc.essay_block(db, e, p, full=full)
    return d


@router.get("/essays")
def list_essays(page: Page = Depends(), status: list[str] | None = Query(None), student_id: str | None = None, mine_to_review: bool = False,
                p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if p.is_university:
        raise forbidden()
    stmt = scope_student_ids(select(Essay).options(selectinload(Essay.versions), selectinload(Essay.comments)), Essay.owner_user_id, p)
    if status:
        stmt = stmt.where(Essay.status.in_(status))
    if student_id:
        stmt = stmt.where(Essay.owner_user_id == parse_uuid(student_id))
    if mine_to_review:
        stmt = stmt.where(or_(Essay.reviewer_user_id == p.id, Essay.reviewer_user_id.is_(None)))
    out = paginate(db, stmt.order_by(Essay.updated_at.desc()), page, lambda e: ser_essay(db, e, p))
    db.commit()  # prompt links / review records created lazily while serializing
    return out


class EssayCreate(BaseModel):
    essay_type: EssayType
    title: str = Field(min_length=1, max_length=200)
    prompt: str | None = Field(default=None, max_length=4000)
    word_limit: int | None = Field(default=None, ge=50, le=10000)
    application_id: str | None = None
    body: str = Field(default="", max_length=60000)
    due_date: date | None = None


@router.post("/essays", status_code=201)
def create_essay(body: EssayCreate, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if not p.is_student:
        raise HTTPException(403, "Students create their own essays.")
    e = Essay(owner_user_id=p.id, essay_type=body.essay_type, title=body.title, prompt=body.prompt, word_limit=body.word_limit,
              application_id=parse_uuid(body.application_id) if body.application_id else None, due_date=body.due_date)
    db.add(e)
    db.flush()
    db.add(EssayVersion(essay_id=e.id, version=1, body=body.body, author_user_id=p.id, created_at=utcnow()))
    db.commit()
    return ser_essay(db, db.get(Essay, e.id), p, full=True)


@router.get("/essays/{essay_id}")
def get_essay(essay_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    e = _essay(db, p, essay_id)
    writing_svc.sla_sweep(db, essay_ids=[e.id])  # a late review is flagged before anyone is told it is "flagged"
    out = ser_essay(db, e, p, full=True)
    db.commit()
    return out


class EssaySave(BaseModel):
    body: str = Field(max_length=60000)
    note: str | None = Field(default=None, max_length=300)
    prompt: str | None = Field(default=None, max_length=4000)
    new_version: bool = True


@router.put("/essays/{essay_id}")
def save_essay(essay_id: str, body: EssaySave, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Students edit their text. Staff propose changes via comments/suggestions; staff edits create a separate, attributed version."""
    e = _essay(db, p, essay_id)
    if not p.is_student and not (p.is_agency or p.has(Role.HANGYUL_COUNSELOR, Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN)):
        raise HTTPException(403, "Not allowed")
    if p.is_student and e.status in (E.SUBMITTED, E.AI_PRECHECK, E.AGENCY_REVIEW, E.FINAL_REVIEW):
        raise HTTPException(409, "This essay is being reviewed. You can edit it again when the reviewer responds.")
    if body.prompt is not None and p.is_student:
        e.prompt = body.prompt
    latest = e.versions[-1] if e.versions else None
    if latest and latest.body == body.body:
        return ser_essay(db, e, p, full=True)
    if body.new_version or latest is None or latest.author_user_id != p.id:
        e.current_version += 1
        e.versions.append(EssayVersion(version=e.current_version, body=body.body, author_user_id=p.id, note=body.note, created_at=utcnow()))
    else:
        latest.body, latest.created_at = body.body, utcnow()
    if p.is_student and e.status == E.CHANGES_REQUESTED:
        e.status = E.STUDENT_REVISION
    e.updated_at = utcnow()
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


class EssayStatusIn(BaseModel):
    status: E
    note: str | None = Field(default=None, max_length=1000)
    override_reason: str | None = Field(default=None, max_length=1000)  # approval with open quality-gate blockers (managers)
    # V6: the student's authorship statement ("These are my own words and facts"), recorded with the submitted version.
    attest: bool = False
    locale: str | None = Field(default=None, max_length=10)


@router.post("/essays/{essay_id}/status")
def essay_status(essay_id: str, body: EssayStatusIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    e = _essay(db, p, essay_id)
    who = ESSAY_FLOW.get(e.status, {}).get(body.status)
    if who is None or who == "SYSTEM" or (who == "STUDENT") != p.is_student:
        raise HTTPException(409, f"Cannot move essay from {e.status.value} to {body.status.value}.")
    if body.status == E.APPROVED:
        writing_svc.check_approval(db, e, p, body.override_reason)  # quality gate (409 with blockers / manager override)
    from_status = e.status
    e.status = body.status
    if body.status == E.SUBMITTED:
        # 첨삭 is a counted, priced promise — Basic 0, All-in-One 2, Premium within the contracted scope (V29 contract).
        # A round is spent when it is asked for, so the check belongs here, before the SLA clock starts.
        # V29: the contract's editing scope first (statement / study plan, contracted application, inside the term), then
        # the count — All-in-One 2 rounds, Premium not rationed inside that scope, anything outside needs a paid extra.
        try:
            entitlements_svc.check_essay(db, e)
        except entitlements_svc.OutOfScope as exc:
            raise HTTPException(409, exc.as_detail()) from exc
        if body.attest and p.is_student:
            writing_svc.attest(db, e, p, body.locale)
        latest = e.versions[-1] if e.versions else None
        e.precheck = precheck(e.essay_type.value, latest.body if latest else "", e.prompt, e.word_limit)
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == e.owner_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        # V5: new review round + SLA clock + automatic checks + reviewer matching (keeps the reviewer across rounds).
        writing_svc.on_submitted(db, e, p)
        e.status = E.AGENCY_REVIEW if (a or e.reviewer_user_id) else E.AI_PRECHECK
        if e.reviewer_user_id:
            notify(db, e.reviewer_user_id, "ESSAY_SUBMITTED", "notify.essaySubmitted", f"Essay ready for review: {e.title}", params={"title": e.title, "essay_type": e.essay_type.value}, link=f"/essays/{e.id}")
    elif not p.is_student:
        e.reviewer_user_id = e.reviewer_user_id or p.id
        writing_svc.on_staff_transition(db, e, from_status, body.status, p)
        notify(db, e.owner_user_id, "ESSAY_STATUS", f"notify.essay.{body.status.value}", f"{e.title}: {body.status.value.replace('_', ' ').lower()}",
               params={"title": e.title, "status": body.status.value}, link=f"/essays/{e.id}")
    audit(db, action="essay.status", entity_type="essay", entity_id=e.id, actor=p, subject_user_id=e.owner_user_id, detail={"to": e.status.value, "note": body.note})
    generate_for_student(db, e.owner_user_id)
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    anchor_start: int | None = Field(default=None, ge=0)
    anchor_end: int | None = Field(default=None, ge=0)
    quote: str | None = Field(default=None, max_length=4000)
    suggestion: str | None = Field(default=None, max_length=4000)
    internal: bool = False


@router.post("/essays/{essay_id}/comments", status_code=201)
def add_comment(essay_id: str, body: CommentIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    e = _essay(db, p, essay_id)
    if body.internal and p.is_student:
        raise HTTPException(403, "Students cannot create internal notes.")
    c = EssayComment(version=e.current_version, author_user_id=p.id, anchor_start=body.anchor_start, anchor_end=body.anchor_end,
                     quote=body.quote, body=body.body, suggestion=body.suggestion,
                     visibility=MessageVisibility.INTERNAL if body.internal else MessageVisibility.PARTICIPANTS, created_at=utcnow())
    e.comments.append(c)
    if not p.is_student and not body.internal:
        notify(db, e.owner_user_id, "ESSAY_COMMENT", "notify.essayComment", f"New comment on {e.title}", params={"title": e.title, "essay_type": e.essay_type.value}, link=f"/essays/{e.id}")
    db.commit()
    return {"id": str(c.id)}


@router.post("/essays/{essay_id}/comments/{comment_id}/resolve")
def resolve_comment(essay_id: str, comment_id: str, apply_suggestion: bool = False, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    e = _essay(db, p, essay_id)
    c = next((c for c in e.comments if str(c.id) == comment_id), None)
    if not c or (p.is_student and c.visibility == MessageVisibility.INTERNAL):
        raise forbidden()
    if apply_suggestion:
        if not p.is_student:
            raise HTTPException(403, "Only the student can accept a suggested change — it's their essay.")
        if e.status not in writing_svc.EDITABLE_BY_STUDENT:
            raise HTTPException(409, "This essay is being reviewed or is approved. Decide on suggestions when it's back with you.")
        latest = e.versions[-1]
        if c.suggestion is None or not c.quote or c.quote not in latest.body:
            raise HTTPException(409, "The quoted text has changed; apply the suggestion manually.")
        e.current_version += 1
        e.versions.append(EssayVersion(version=e.current_version, body=latest.body.replace(c.quote, c.suggestion, 1), author_user_id=p.id,
                                       note="Accepted reviewer suggestion", created_at=utcnow()))
        if e.status == E.CHANGES_REQUESTED:
            e.status = E.STUDENT_REVISION
    writing_svc.record_legacy_resolve(db, e, c, apply_suggestion, p)
    c.resolved_at, c.resolved_by_id = utcnow(), p.id
    db.commit()
    return ser_essay(db, _essay(db, p, essay_id), p, full=True)


@router.get("/essays/{essay_id}/diff")
def essay_diff(essay_id: str, a: int, b: int, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    e = _essay(db, p, essay_id)
    va = next((v for v in e.versions if v.version == a), None)
    vb = next((v for v in e.versions if v.version == b), None)
    if not va or not vb:
        raise HTTPException(404, "Version not found")
    return {"a": a, "b": b, "ops": diff(va.body, vb.body)}


# ======================= TASKS =======================

def ser_task(db: Session, t: Task, p: Principal) -> dict:
    now = utcnow()
    d = {"id": str(t.id), "title": t.title, "title_key": t.title_key, "title_params": t.title_params or {}, "description": t.description, "task_type": t.task_type.value, "priority": t.priority.value,
         "status": t.status.value, "due_at": iso(t.due_at), "overdue": bool(t.due_at and t.due_at < now and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS)),
         "owner": author_for(p, db.get(User, t.owner_user_id)) if t.owner_user_id else None, "owner_org_id": str(t.owner_org_id) if t.owner_org_id else None,
         "student_id": str(t.student_user_id) if t.student_user_id else None, "application_id": str(t.application_id) if t.application_id else None,
         "source": t.source, "link": t.link, "completed_at": iso(t.completed_at), "created_at": iso(t.created_at),
         "depends_on_id": str(t.depends_on_id) if t.depends_on_id else None, "visible_to_student": t.visible_to_student}
    if t.depends_on_id and not p.is_student:
        dep = db.get(Task, t.depends_on_id)
        d["depends_on"] = {"title": dep.title, "title_key": dep.title_key, "title_params": dep.title_params or {}, "done": dep.status == TaskStatus.DONE} if dep else None
    if not p.is_student and t.student_user_id:
        u = db.get(User, t.student_user_id)
        d["student_name"] = u.full_name if u else None
    if t.university_id:
        u = db.get(University, t.university_id)
        d["university"] = u.name_en if u else None
    if t.application_id and not p.is_student:
        # Lets the console say who the task is waiting on (docs/STATE_MAP.md) without a second request.
        a = db.get(Application, t.application_id)
        d["application_status"] = a.status.value if a else None
    return d


def team_task_scope(stmt, p: Principal):
    """The staff "team" task queue: the org's tasks; a counselor sees their own plus those about their students.
    Shared by GET /tasks?scope=team and the agency Today counts so a number always opens exactly its list."""
    if p.is_hangyul:
        return stmt
    # V22: every agency admin sees the agency's whole task queue (REPORT §246 A1).
    stmt = stmt.where(Task.owner_org_id == p.org_id)
    return stmt


@router.get("/tasks")
def list_tasks(page: Page = Depends(), scope: str = Query("mine", pattern="^(mine|team|student)$"), status: list[str] | None = Query(None),
               task_type: list[str] | None = Query(None), overdue: bool = False, student_id: str | None = None, due_within_days: int | None = None,
               p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    stmt = select(Task)
    if p.is_student:
        stmt = stmt.where(Task.student_user_id == p.id, Task.visible_to_student.is_(True))
    elif p.is_university:
        stmt = stmt.where(or_(Task.owner_org_id == p.org_id, Task.owner_user_id == p.id))
    elif scope == "mine":
        # My tasks plus unclaimed tasks in my organisation's queue.
        mine = Task.owner_user_id == p.id
        stmt = stmt.where(or_(mine, (Task.owner_org_id == p.org_id) & Task.owner_user_id.is_(None)) if p.org_id else mine)
    else:
        stmt = team_task_scope(stmt, p)
    if student_id:
        sid = parse_uuid(student_id)
        ensure_student_access(db, p, sid)
        stmt = stmt.where(Task.student_user_id == sid)
    stmt = stmt.where(Task.status.in_(status or [TaskStatus.OPEN.value, TaskStatus.IN_PROGRESS.value, TaskStatus.BLOCKED.value]))
    if task_type:
        stmt = stmt.where(Task.task_type.in_(task_type))
    if overdue:
        stmt = stmt.where(Task.due_at < utcnow())
    if due_within_days is not None:
        from datetime import timedelta
        stmt = stmt.where(Task.due_at <= utcnow() + timedelta(days=due_within_days))
    prio = case((Task.priority == TaskPriority.URGENT, 0), (Task.priority == TaskPriority.HIGH, 1), (Task.priority == TaskPriority.MEDIUM, 2), else_=3)
    stmt = stmt.order_by(Task.due_at.asc().nulls_last(), prio)
    return paginate(db, stmt, page, lambda t: ser_task(db, t, p))


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    task_type: TaskType = TaskType.GENERAL
    priority: TaskPriority = TaskPriority.MEDIUM
    due_at: datetime | None = None
    owner_user_id: str | None = None
    student_id: str | None = None
    application_id: str | None = None
    visible_to_student: bool = False


@router.post("/tasks", status_code=201)
def create_task(body: TaskIn, p: Principal = Depends(require_staff), db: Session = Depends(get_db)):
    sid = parse_uuid(body.student_id) if body.student_id else None
    if sid:
        ensure_student_access(db, p, sid)
    owner = parse_uuid(body.owner_user_id) if body.owner_user_id else p.id
    if owner != p.id and p.org_id and not db.scalar(select(OrganizationMember.id).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == owner)):
        if not (sid and owner == sid and body.visible_to_student):
            raise HTTPException(422, "Tasks can be assigned to your team or to the student.")
    t = Task(title=body.title, description=body.description, task_type=body.task_type, priority=body.priority, due_at=body.due_at, owner_user_id=owner,
             owner_org_id=p.org_id, student_user_id=sid, application_id=parse_uuid(body.application_id) if body.application_id else None,
             visible_to_student=body.visible_to_student, source="MANUAL", created_by_id=p.id)
    db.add(t)
    db.commit()
    return ser_task(db, t, p)


class TaskPatch(BaseModel):
    status: TaskStatus | None = None
    owner_user_id: str | None = None
    due_at: datetime | None = None
    priority: TaskPriority | None = None


@router.patch("/tasks/{task_id}")
def patch_task(task_id: str, body: TaskPatch, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    t = db.get(Task, parse_uuid(task_id))
    if not t:
        raise forbidden()
    if p.is_student:
        if t.student_user_id != p.id or not t.visible_to_student or set(body.model_dump(exclude_unset=True)) - {"status"}:
            raise forbidden()
    elif not (p.is_hangyul or t.owner_org_id == p.org_id or t.owner_user_id == p.id):
        raise forbidden()
    data = body.model_dump(exclude_unset=True)
    if "owner_user_id" in data:
        t.owner_user_id = parse_uuid(data.pop("owner_user_id")) if body.owner_user_id else None
    for k, v in data.items():
        setattr(t, k, v)
    if t.status == TaskStatus.DONE and not t.completed_at:
        t.completed_at = utcnow()
    db.commit()
    return ser_task(db, t, p)


# ======================= MESSAGING =======================

def _visible_conversations(p: Principal):
    stmt = select(Conversation)
    if p.is_hangyul:
        return stmt
    part = select(ConversationParticipant.conversation_id).where(
        or_(ConversationParticipant.user_id == p.id, ConversationParticipant.organization_id == p.org_id) if p.org_id else ConversationParticipant.user_id == p.id
    )
    return stmt.where(Conversation.id.in_(part))


def _conv(db: Session, p: Principal, conv_id: str) -> Conversation:
    c = db.scalar(_visible_conversations(p).where(Conversation.id == parse_uuid(conv_id)))
    if not c:
        raise forbidden()
    return c


def _msg_filter(stmt, p: Principal):
    # INTERNAL notes are never returned to students, regardless of the conversation.
    if p.is_student:
        return stmt.where(Message.visibility == MessageVisibility.PARTICIPANTS)
    return stmt


def conversations_awaiting_reply():
    """Conversations whose latest student-visible message was written by the student (they are waiting for us)."""
    latest = (select(Message.conversation_id, func.max(Message.created_at).label("at"))
              .where(Message.visibility == MessageVisibility.PARTICIPANTS).group_by(Message.conversation_id).subquery())
    return (select(Conversation.id)
            .join(latest, latest.c.conversation_id == Conversation.id)
            .join(Message, (Message.conversation_id == Conversation.id) & (Message.created_at == latest.c.at))
            .where(Conversation.student_user_id.is_not(None), Message.author_user_id == Conversation.student_user_id))


def needs_reply_scope(stmt, p: Principal):
    """Staff: conversations waiting for our reply about students in the caller's own caseload (same set as Today)."""
    return scope_student_ids(stmt.where(Conversation.id.in_(conversations_awaiting_reply())), Conversation.student_user_id, p)


@router.get("/conversations")
def conversations(student_id: str | None = None, needs_reply: bool = False, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    stmt = _visible_conversations(p)
    if student_id:
        stmt = stmt.where(Conversation.student_user_id == parse_uuid(student_id))
    if needs_reply and not p.is_student:
        stmt = needs_reply_scope(stmt, p)
    convs = db.scalars(stmt.order_by(Conversation.last_message_at.desc().nulls_last()).limit(100)).all()
    reads = dict(db.execute(select(MessageRead.conversation_id, MessageRead.last_read_at).where(MessageRead.user_id == p.id)).all())
    awaiting = set(db.scalars(conversations_awaiting_reply().where(Conversation.id.in_([c.id for c in convs])))) if convs and not p.is_student else set()
    out = []
    for c in convs:
        last = db.scalar(_msg_filter(select(Message).where(Message.conversation_id == c.id), p).order_by(Message.created_at.desc()).limit(1))
        unread_q = _msg_filter(select(func.count()).select_from(Message).where(Message.conversation_id == c.id, Message.author_user_id != p.id), p)
        if reads.get(c.id):
            unread_q = unread_q.where(Message.created_at > reads[c.id])
        student = db.get(User, c.student_user_id) if c.student_user_id else None
        item = {"id": str(c.id), "kind": c.kind.value, "subject": c.subject, "student": ser_user_public(student),
                "application_id": str(c.application_id) if c.application_id else None, "last_message_at": iso(c.last_message_at),
                "last_message": {"body": last.body[:160], "internal": last.visibility == MessageVisibility.INTERNAL, "author": author_for(p, db.get(User, last.author_user_id)) if last.author_user_id else None} if last else None,
                "unread": db.scalar(unread_q) or 0}
        if not p.is_student:
            item["awaiting_reply"] = c.id in awaiting
            if c.application_id:
                a = db.get(Application, c.application_id)
                u = db.get(University, a.university_id) if a else None
                item["application"] = {"id": str(a.id), "university": u.name_en if u else None, "university_id": str(u.id) if u else None, "status": a.status.value} if a else None
        out.append(item)
    return out


class ConversationIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    student_id: str | None = None
    application_id: str | None = None
    kind: ConversationKind = ConversationKind.STUDENT_SUPPORT
    body: str = Field(min_length=1, max_length=8000)


@router.post("/conversations", status_code=201)
def start_conversation(body: ConversationIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    sid = p.id if p.is_student else (parse_uuid(body.student_id) if body.student_id else None)
    if sid and not p.is_student:
        ensure_student_access(db, p, sid)
    c = Conversation(kind=body.kind, subject=body.subject, student_user_id=sid, application_id=parse_uuid(body.application_id) if body.application_id else None, last_message_at=utcnow())
    db.add(c)
    db.flush()
    db.add(ConversationParticipant(conversation_id=c.id, user_id=p.id))
    if sid and sid != p.id:
        db.add(ConversationParticipant(conversation_id=c.id, user_id=sid))
    if p.org_id:
        db.add(ConversationParticipant(conversation_id=c.id, organization_id=p.org_id))
    if p.is_student:
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if a:
            db.add(ConversationParticipant(conversation_id=c.id, organization_id=a.organization_id))
    if c.application_id and body.kind == ConversationKind.APPLICATION:
        # Application threads include the university tenant, the assigned agency and Hangyul operations.
        from app.models import Organization
        from app.models.enums import OrgType
        app = db.get(Application, c.application_id)
        orgs = {db.scalar(select(Organization.id).where(Organization.university_id == app.university_id)), app.agency_org_id,
                db.scalar(select(Organization.id).where(Organization.type == OrgType.HANGYUL))}
        for oid in orgs - {None, p.org_id}:
            db.add(ConversationParticipant(conversation_id=c.id, organization_id=oid))
    db.add(Message(conversation_id=c.id, author_user_id=p.id, body=body.body, created_at=utcnow()))
    db.commit()
    return {"id": str(c.id)}


@router.get("/conversations/{conv_id}/messages")
def messages(conv_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    c = _conv(db, p, conv_id)
    rows = db.scalars(_msg_filter(select(Message).where(Message.conversation_id == c.id), p).order_by(Message.created_at).limit(500)).all()
    files: dict = {}
    for att in db.scalars(select(MessageAttachment).where(MessageAttachment.message_id.in_([m.id for m in rows]))).all() if rows else []:
        files.setdefault(att.message_id, []).append(ser_attachment(att))
    authors = {}
    out = []
    for m in rows:
        if m.author_user_id and m.author_user_id not in authors:
            authors[m.author_user_id] = db.get(User, m.author_user_id)
        out.append({"id": str(m.id), "body": m.body, "internal": m.visibility == MessageVisibility.INTERNAL, "at": iso(m.created_at),
                    # V22: a student sees one team identity for every staff author; agency/HQ see the real actor (REPORT §246 A3).
                    "author": author_for(p, authors.get(m.author_user_id)), "mine": m.author_user_id == p.id,
                    "mentions": m.mentions or [], "created_task_id": str(m.created_task_id) if m.created_task_id else None,
                    "attachment_document_id": str(m.attachment_document_id) if m.attachment_document_id else None,
                    "attachments": files.get(m.id, []), "channel": m.channel})
    student = db.get(User, c.student_user_id) if c.student_user_id else None
    return {"id": str(c.id), "subject": c.subject, "kind": c.kind.value, "student": ser_user_public(student), "messages": out,
            "application_id": str(c.application_id) if c.application_id else None}


def ser_attachment(a: MessageAttachment) -> dict:
    return {"id": str(a.id), "filename": a.original_filename, "mime_type": a.mime_type, "size_bytes": a.size_bytes}


@router.post("/conversations/{conv_id}/attachments", status_code=201)
async def upload_attachment(conv_id: str, file: UploadFile = File(...), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Upload a private file first; it is linked to a message when that message is posted with `attachment_ids`."""
    c = _conv(db, p, conv_id)
    data = await file.read()
    mime = validate_upload(data, file.filename or "upload")
    storage = get_storage()
    key = storage.put(data, prefix=f"attachments/{c.id}")
    a = MessageAttachment(conversation_id=c.id, uploaded_by_id=p.id, storage_key=key, original_filename=(file.filename or "upload")[:255], mime_type=mime,
                          size_bytes=len(data), sha256=sha256(data), scan_status="PENDING", created_at=utcnow())
    db.add(a)
    db.flush()
    scan, signature = scan_bytes(data)  # V29: CLEAN/SKIPPED servable; ERROR retried by the worker; INFECTED blocked
    settle_attachment(db, a, scan, signature, actor=p, subject_user_id=c.student_user_id)
    if scan == "INFECTED":
        db.commit()
        raise HTTPException(422, "This file failed the security scan.")
    audit(db, action="attachment.upload", entity_type="conversation", entity_id=c.id, actor=p, subject_user_id=c.student_user_id, detail={"size": len(data)})
    db.commit()
    return ser_attachment(a)


@router.post("/attachments/{attachment_id}/download-url")
def attachment_download_url(attachment_id: str, disposition: str = Query("attachment", pattern="^(inline|attachment)$"),
                            p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    a = db.get(MessageAttachment, parse_uuid(attachment_id))
    if not a:
        raise forbidden()
    _conv(db, p, str(a.conversation_id))
    m = db.get(Message, a.message_id) if a.message_id else None
    # Unsent uploads are only visible to their uploader; attachments on internal notes never reach students.
    if (m is None and a.uploaded_by_id != p.id) or (m is not None and p.is_student and m.visibility == MessageVisibility.INTERNAL):
        raise forbidden()
    ensure_servable(a.scan_status)  # V29
    audit(db, action="attachment.access", entity_type="conversation", entity_id=a.conversation_id, actor=p, detail={"attachment": str(a.id)})
    db.commit()
    return {"url": f"/api/v1/files/{sign_file_token(a.storage_key, p.id, disposition)}", "expires_in": 300, "filename": a.original_filename, "mime_type": a.mime_type}


class MessageIn(BaseModel):
    body: str = Field(default="", max_length=8000)
    attachment_ids: list[str] = Field(default_factory=list, max_length=10)
    internal: bool = False
    mentions: list[str] | None = None
    create_task: bool = False
    task_due_at: datetime | None = None
    attachment_document_id: str | None = None
    # V8 channel model: IN_APP is the only live channel; any other registered channel is refused with a clear 409.
    channel: str = Field(default="IN_APP", max_length=16)


@router.post("/conversations/{conv_id}/messages", status_code=201)
def post_message(conv_id: str, body: MessageIn, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    c = _conv(db, p, conv_id)
    if body.internal and p.is_student:
        raise HTTPException(403, "Students cannot post internal notes.")
    if (body.mentions or body.create_task) and p.is_student:
        raise HTTPException(403, "Only staff can mention teammates or create tasks from messages.")
    if not body.body.strip() and not body.attachment_ids:
        raise HTTPException(422, "Write a message or attach a file.")
    from app.services import channels as channels_svc

    channel = (body.channel or "IN_APP").upper()
    try:
        adapter = channels_svc.get(channel)
    except channels_svc.UnknownChannel:
        raise HTTPException(422, f"Unknown channel {body.channel!r}. Use one of: {', '.join(channels_svc.codes())}.") from None
    if channel != "IN_APP" and body.internal:
        raise HTTPException(422, "Internal notes stay inside Hangyul; they can't be sent on an external channel.")
    try:
        adapter.send(to_user_id=c.student_user_id, body=body.body, conversation_id=c.id)
    except channels_svc.ChannelNotConfigured as e:
        raise HTTPException(409, str(e)) from None
    atts = []
    for aid in body.attachment_ids:
        att = db.get(MessageAttachment, parse_uuid(aid))
        if not att or att.conversation_id != c.id or att.uploaded_by_id != p.id or att.message_id is not None:
            raise HTTPException(422, "One of the attachments can't be used in this conversation.")
        atts.append(att)
    m = Message(conversation_id=c.id, author_user_id=p.id, body=body.body, created_at=utcnow(), channel=channel,
                visibility=MessageVisibility.INTERNAL if body.internal else MessageVisibility.PARTICIPANTS, mentions=body.mentions,
                attachment_document_id=parse_uuid(body.attachment_document_id) if body.attachment_document_id else None)
    db.add(m)
    db.flush()
    for att in atts:
        att.message_id = m.id
    c.last_message_at = m.created_at
    if body.create_task:
        t = Task(title=(body.body or "Follow up")[:120], description=body.body, task_type=TaskType.GENERAL, owner_user_id=parse_uuid(body.mentions[0]) if body.mentions else p.id,
                 owner_org_id=p.org_id, student_user_id=c.student_user_id, due_at=body.task_due_at, source="MESSAGE", created_by_id=p.id, link=f"/messages/{c.id}")
        db.add(t)
        db.flush()
        m.created_task_id = t.id
    for uid in body.mentions or []:
        notify(db, parse_uuid(uid), "MENTION", "notify.mention", f"{p.user.full_name} mentioned you", params={"author": p.user.full_name}, link=f"/messages/{c.id}")
    if not body.internal and c.student_user_id and c.student_user_id != p.id:
        notify(db, c.student_user_id, "MESSAGE", "notify.message", f"New message from {p.user.full_name}", params={"author": p.user.full_name}, link=f"/messages/{c.id}")
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == c.student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if a and p.is_agency and a.first_response_at is None:
            a.first_response_at = utcnow()
    if p.is_student:
        a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == p.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        if a and a.counselor_user_id:
            notify(db, a.counselor_user_id, "MESSAGE", "notify.message", f"New message from {p.user.full_name}", params={"author": p.user.full_name}, link=f"/messages/{c.id}")
    # Mark own message as read.
    r = db.scalar(select(MessageRead).where(MessageRead.conversation_id == c.id, MessageRead.user_id == p.id))
    if r:
        r.last_read_at = m.created_at
    else:
        db.add(MessageRead(conversation_id=c.id, user_id=p.id, last_read_at=m.created_at))
    audit(db, action="message.post", entity_type="conversation", entity_id=c.id, actor=p, subject_user_id=c.student_user_id,
          detail={"internal": body.internal, "attachments": len(atts)})
    if body.attachment_ids:
        track(db, "message_attachment_sent", user_id=p.id, organization_id=p.org_id, properties={"files": len(body.attachment_ids)})
    db.commit()
    return {"id": str(m.id)}


@router.post("/conversations/{conv_id}/read", status_code=204)
def mark_read(conv_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    c = _conv(db, p, conv_id)
    # Idempotent upsert: opening a thread can mark it read twice at once (two tabs, auto-open + mount).
    now = utcnow()
    db.execute(pg_insert(MessageRead).values(id=uuid.uuid4(), conversation_id=c.id, user_id=p.id, last_read_at=now)
               .on_conflict_do_update(index_elements=["conversation_id", "user_id"], set_={"last_read_at": now}))
    db.commit()


# ======================= NOTIFICATIONS =======================

@router.get("/notifications")
def notifications(unread_only: bool = False, limit: int = Query(30, le=100), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == p.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    rows = db.scalars(stmt.order_by(Notification.created_at.desc()).limit(limit)).all()
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == p.id, Notification.read_at.is_(None))) or 0
    return {"unread": unread, "items": [{"id": str(n.id), "kind": n.kind, "title_key": n.title_key, "params": n.params or {}, "text": n.fallback_text,
                                         "link": n.link, "read": n.read_at is not None, "at": iso(n.created_at)} for n in rows]}


@router.post("/notifications/read-all", status_code=204)
def read_all(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == p.id, Notification.read_at.is_(None))):
        n.read_at = utcnow()
    db.commit()


@router.post("/notifications/{nid}/read", status_code=204)
def read_one(nid: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    n = db.get(Notification, parse_uuid(nid))
    if n and n.user_id == p.id:
        n.read_at = utcnow()
        db.commit()


# ======================= VISA =======================

def ser_visa(db: Session, v: VisaCase) -> dict:
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == v.student_user_id))
    # V5: the researched embassy route when one resolves (visa_routes), else the generic rule rows.
    items, route = route_view(db, v)
    if items is None:
        items = visa_checklist(db, v, prof.nationality if prof else None, use_routes=False)
    app = db.get(Application, v.application_id) if v.application_id else None
    uni = db.get(University, app.university_id) if app else None
    return {"id": str(v.id), "student_id": str(v.student_user_id), "student_name": db.get(User, v.student_user_id).full_name,
            "visa_type": v.visa_type.value, "visa_type_reason": v.visa_type_reason, "status": v.status.value, "consulate": v.consulate,
            "submitted_on": iso(v.submitted_on), "issued_on": iso(v.issued_on), "expires_on": iso(v.expires_on), "target_entry_date": iso(v.target_entry_date),
            "notes": v.notes, "blockers": v.blockers or [], "application_id": str(v.application_id) if v.application_id else None,
            "university": uni.name_en if uni else None, "university_id": str(uni.id) if uni else None, "checklist": items, "route": route,
            "progress": round(100 * sum(i["done"] for i in items) / len(items)) if items else 0,
            "disclaimer": "Visas are issued by the Korean government (embassy/consulate or Immigration). Hangyul helps you prepare; it does not issue visas."}


@router.get("/visa")
def list_visa(page: Page = Depends(), status: list[str] | None = Query(None), p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    stmt = scope_student_ids(select(VisaCase), VisaCase.student_user_id, p)
    if status:
        stmt = stmt.where(VisaCase.status.in_(status))
    return paginate(db, stmt.order_by(VisaCase.updated_at.desc()), page, lambda v: ser_visa(db, v))


@router.get("/visa/eligibility")
def visa_eligibility(p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Pre-admission guidance: likely visa type from the student's target degree."""
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == p.id))
    vt, why = infer_visa(prof.target_degree if prof else None)
    # Preview of the real, nationality-specific checklist so students can prepare before admission (nothing is stored).
    preview = SimpleNamespace(visa_type=vt, completed_steps=[])
    checklist = visa_checklist(db, preview, prof.nationality if prof else None) if vt.value != "OTHER" else []
    return {"visa_type": vt.value, "reason": why, "status": VisaStatus.WAITING_FOR_ADMISSION.value, "checklist": checklist}


@router.get("/visa/{visa_id}")
def get_visa(visa_id: str, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    v = db.get(VisaCase, parse_uuid(visa_id))
    if not v:
        raise forbidden()
    ensure_student_access(db, p, v.student_user_id)
    return ser_visa(db, v)


class VisaPatch(BaseModel):
    status: VisaStatus | None = None
    consulate: str | None = Field(default=None, max_length=160)
    completed_steps: list[str] | None = None
    submitted_on: date | None = None
    issued_on: date | None = None
    expires_on: date | None = None
    target_entry_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    blockers: list[str] | None = None


@router.patch("/visa/{visa_id}")
def patch_visa(visa_id: str, body: VisaPatch, p: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    v = db.get(VisaCase, parse_uuid(visa_id))
    if not v or p.is_university:
        raise forbidden()
    ensure_student_access(db, p, v.student_user_id)
    data = body.model_dump(exclude_unset=True)
    if p.is_student and set(data) - {"completed_steps", "consulate", "target_entry_date", "submitted_on"}:
        raise HTTPException(403, "Your counselor updates the official visa status.")
    prev = v.status
    for k, val in data.items():
        setattr(v, k, val)
    if v.status == VisaStatus.ISSUED and prev != VisaStatus.ISSUED:
        track(db, "visa_issued", user_id=v.student_user_id)
        notify(db, v.student_user_id, "VISA_ISSUED", "notify.visaIssued", "Your visa has been issued — time to plan your arrival!", link="/arrival")
    audit(db, action="visa.update", entity_type="visa_case", entity_id=v.id, actor=p, subject_user_id=v.student_user_id, detail={"fields": sorted(data)})
    generate_for_student(db, v.student_user_id)
    db.commit()
    return ser_visa(db, v)
