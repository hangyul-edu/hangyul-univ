"""Agency caseload: filters, saved-view definitions and set-based row aggregation.

Rows for a page of students are built with a fixed number of grouped queries (independent of page size) instead of
several queries per student. View filters are SQL predicates so pagination and counts stay correct at scale, and all
built-in view counts are computed in a single ``COUNT(*) FILTER (...)`` query.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.common import iso
from app.models import (
    AgencyAssignment,
    Application,
    Conversation,
    Document,
    DocumentRequest,
    Essay,
    Message,
    Organization,
    ProgramIntake,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.enums import ApplicationStatus, AssignmentStatus, MessageVisibility, PipelineStage, TaskStatus
from app.services import waiting
from app.services.readiness import profile_percent

OPEN = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS]
PRE_SUBMIT = [ApplicationStatus.DRAFT, ApplicationStatus.PROFILE_REVIEW, ApplicationStatus.DOCUMENT_PREPARATION, ApplicationStatus.READY]
AT_UNIVERSITY = [ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW, ApplicationStatus.ADDITIONAL_DOCUMENTS, ApplicationStatus.INTERVIEW]
VISA_STAGE = [ApplicationStatus.ADMISSION_CERTIFICATE_PENDING, ApplicationStatus.ADMISSION_CERTIFICATE_ISSUED,
              ApplicationStatus.VISA_PREPARATION, ApplicationStatus.VISA_SUBMITTED]
FIX_DOCS = ["NEEDS_CORRECTION", "EXPIRED"]
REVIEW_DOCS = ["UPLOADED", "NEEDS_REVIEW"]
ARRIVED = [PipelineStage.ARRIVED, PipelineStage.ACTIVE_STUDENT]
REVIEW_SLA_HOURS = 48
SLA_RISK_HOURS = 24

# "Waiting on" (V9, docs/STATE_MAP.md): one party + one reason per case, from services/waiting.py. The row value and the
# view predicates use the same rules, so a view's count equals its rows. The V4 status lists stay for old importers.
APP_WAITING_AGENCY = [ApplicationStatus.PROFILE_REVIEW, ApplicationStatus.READY]
APP_WAITING_STUDENT = [ApplicationStatus.DRAFT, ApplicationStatus.DOCUMENT_PREPARATION, ApplicationStatus.ADDITIONAL_DOCUMENTS, ApplicationStatus.OFFERED,
                       ApplicationStatus.TUITION_PENDING, ApplicationStatus.ADMISSION_CERTIFICATE_ISSUED, ApplicationStatus.VISA_PREPARATION,
                       ApplicationStatus.VISA_ISSUED]
APP_WAITING_UNIVERSITY = [ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW, ApplicationStatus.INTERVIEW, ApplicationStatus.WAITLISTED,
                          ApplicationStatus.OFFER_ACCEPTED, ApplicationStatus.TUITION_PAID, ApplicationStatus.ADMISSION_CERTIFICATE_PENDING]
APP_WAITING_EXTERNAL = [ApplicationStatus.VISA_SUBMITTED]
STUDENT_REASON_ORDER = waiting.STUDENT_ORDER
# Filter values accepted by `waiting_on=` (seven parties + legacy "us").
WAITING_ON = waiting.FILTER_VALUES

BUILT_IN_VIEWS = ("all", "mine", "attention", "waiting_student", "waiting_us", "university", "incomplete", "docs", "deadline", "visa", "arrived",
                  "waiting_external", "requested",
                  # V8 operational views (REPORT §50): each is one SQL predicate, so the count on the tab = the rows it opens.
                  "urgent", "deadline7", "student_silent", "visa_blocked", "new_paid", "unassigned",
                  # V9 waiting-on views (services/waiting.py): one per staff party.
                  "waiting_counselor", "waiting_agency", "waiting_hangyul")
STUDENT_SILENT_DAYS = 3
NEW_PAID_DAYS = 14
# Plain definitions, returned with the counts and shown under the view title.
VIEW_DEFINITIONS = {
    "urgent": "Your own cases that need you now: first reply late or due within 24 h, an overdue task, documents to review or fix, "
              "a deadline within 7 days, or the student is waiting for us.",
    "deadline7": "An application not yet submitted whose deadline is within 7 days.",
    "student_silent": f"We are waiting on the student, and the student has not written, uploaded or completed a task for more than "
                      f"{STUDENT_SILENT_DAYS} days.",
    "university": "Every application with a party to act is at the university (we and the student have nothing open).",
    "docs": "At least one document was sent back for correction or has expired.",
    "visa_blocked": "In the visa phase, with a document to correct or an overdue task holding the visa back.",
    "new_paid": f"Paid for a Hangyul service in the last {NEW_PAID_DAYS} days.",
    "unassigned": "Assigned to the agency but not to a counselor yet.",
    "waiting_counselor": "A named person on the team owns the next action (first contact, a reply, their review, their task, a final check).",
    "waiting_agency": "The agency team owns the next action but nobody is assigned (unassigned case, review or task).",
    "waiting_hangyul": "Hangyul operations owns the next action (paid with no agency, a payment issue).",
    "waiting_us": "Waiting on us: a named counselor or the agency team owns the next action.",
}


# ---------------------------------------------------------------- predicates (all return SQL over StudentProfile.user_id)

def _replies_waiting_students():
    """Students whose latest student-visible message in any of their conversations was written by the student."""
    return waiting.replies_waiting_students()


def _apps_in(states):
    return StudentProfile.user_id.in_(select(Application.student_user_id).where(Application.status.in_(states)))


def pred_waiting_us(now: datetime):
    """Legacy "us" = counselor or agency team (V9 waiting model)."""
    return waiting.pred("us", now)


def pred_waiting_student():
    from app.models.base import utcnow

    return waiting.pred(waiting.STUDENT, utcnow())


def pred_waiting_on(who: str, now: datetime):
    """Exactly one party per student (services/waiting.py rule order), matching the row's `waiting_on`. Accepts the seven
    parties and the legacy alias "us" (= counselor or agency)."""
    return waiting.pred(who, now)


def pred_university_requested():
    """Students with an open university document request (the university is waiting for one more document)."""
    return waiting.university_requested()


def pred_closing_within(now: datetime, days: int):
    """Students with an application not yet submitted whose deadline falls within `days` (same set as Today's "closing soon")."""
    return StudentProfile.user_id.in_(select(Application.student_user_id).join(ProgramIntake, ProgramIntake.id == Application.intake_id).where(
        Application.status.in_(PRE_SUBMIT), ProgramIntake.application_deadline >= now.date(),
        ProgramIntake.application_deadline <= (now + timedelta(days=days)).date()))


def pred_sla_risk(now: datetime):
    """First response not yet given and due within SLA_RISK_HOURS (or already late) — same set as Today's SLA row."""
    return StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
        AgencyAssignment.status == AssignmentStatus.ACTIVE, AgencyAssignment.first_response_at.is_(None),
        AgencyAssignment.first_response_due_at < now + timedelta(hours=SLA_RISK_HOURS)))


def pred_student_silent(now: datetime):
    """Waiting on the student, and no message, upload or completed student task from them for STUDENT_SILENT_DAYS."""
    from app.models import DocumentVersion

    since = now - timedelta(days=STUDENT_SILENT_DAYS)
    recent = or_(
        StudentProfile.user_id.in_(select(Message.author_user_id).where(Message.created_at >= since)),
        StudentProfile.user_id.in_(select(DocumentVersion.uploaded_by_id).where(DocumentVersion.created_at >= since)),
        StudentProfile.user_id.in_(select(Task.student_user_id).where(Task.visible_to_student.is_(True), Task.completed_at >= since)),
    )
    return and_(pred_waiting_on("student", now), ~recent)


def pred_visa_blocked(now: datetime):
    visa_phase = or_(StudentProfile.pipeline_stage == PipelineStage.VISA_PREPARATION,
                     StudentProfile.user_id.in_(select(Application.student_user_id).where(Application.status.in_(VISA_STAGE))))
    blocker = or_(StudentProfile.user_id.in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS))),
                  StudentProfile.user_id.in_(select(Task.student_user_id).where(Task.status.in_(OPEN), Task.due_at < now)))
    return and_(visa_phase, blocker)


def pred_new_paid(now: datetime):
    from app.models.business import Order
    from app.models.enums import OrderStatus

    return StudentProfile.user_id.in_(select(Order.user_id).where(Order.status == OrderStatus.PAID, Order.paid_at >= now - timedelta(days=NEW_PAID_DAYS)))


def pred_unassigned():
    return StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
        AgencyAssignment.status == AssignmentStatus.ACTIVE, AgencyAssignment.counselor_user_id.is_(None)))


def pred_view(view: str, now: datetime, user_id: uuid.UUID | None = None):
    open_task = select(Task.student_user_id).where(Task.status.in_(OPEN))
    if view == "urgent":
        return and_(pred_view("mine", now, user_id), or_(
            pred_sla_risk(now),
            StudentProfile.user_id.in_(open_task.where(Task.due_at < now)),
            StudentProfile.user_id.in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS + REVIEW_DOCS))),
            pred_closing_within(now, 7),
            StudentProfile.user_id.in_(_replies_waiting_students()),
        ))
    if view == "deadline7":
        return pred_closing_within(now, 7)
    if view == "student_silent":
        return pred_student_silent(now)
    if view == "visa_blocked":
        return pred_visa_blocked(now)
    if view == "new_paid":
        return pred_new_paid(now)
    if view == "unassigned":
        return pred_unassigned()
    if view == "mine":
        return StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
            AgencyAssignment.counselor_user_id == user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    if view == "attention":
        return or_(
            StudentProfile.user_id.in_(open_task.where(Task.due_at < now)),
            StudentProfile.user_id.in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS + REVIEW_DOCS))),
            StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
                AgencyAssignment.status == AssignmentStatus.ACTIVE, AgencyAssignment.first_response_at.is_(None), AgencyAssignment.first_response_due_at < now)),
        )
    if view == "waiting_us":
        return pred_waiting_on("us", now)
    if view == "waiting_counselor":
        return pred_waiting_on(waiting.COUNSELOR, now)
    if view == "waiting_agency":
        return pred_waiting_on(waiting.AGENCY, now)
    if view == "waiting_hangyul":
        return pred_waiting_on(waiting.HANGYUL, now)
    if view == "waiting_student":
        return pred_waiting_on("student", now)
    if view == "university":
        return pred_waiting_on("university", now)
    if view == "waiting_external":
        return pred_waiting_on("external", now)
    if view == "requested":
        return pred_university_requested()
    if view == "docs":
        return StudentProfile.user_id.in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS)))
    if view == "incomplete":
        return or_(
            StudentProfile.user_id.in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS))),
            StudentProfile.user_id.in_(select(Application.student_user_id).where(Application.status.in_(PRE_SUBMIT), Application.readiness_percent < 100)),
        )
    if view == "deadline":
        return pred_deadline_within(now, 14)
    if view == "visa":
        return or_(StudentProfile.pipeline_stage == PipelineStage.VISA_PREPARATION,
                   StudentProfile.user_id.in_(select(Application.student_user_id).where(Application.status.in_(VISA_STAGE))))
    if view == "arrived":
        return StudentProfile.pipeline_stage.in_(ARRIVED)
    return None


def pred_deadline_within(now: datetime, days: int):
    soon = now + timedelta(days=days)
    return or_(
        StudentProfile.user_id.in_(select(Task.student_user_id).where(Task.status.in_(OPEN), Task.due_at >= now, Task.due_at <= soon)),
        StudentProfile.user_id.in_(select(Application.student_user_id).join(ProgramIntake, ProgramIntake.id == Application.intake_id).where(
            Application.status.in_(PRE_SUBMIT), ProgramIntake.application_deadline >= now.date(), ProgramIntake.application_deadline <= soon.date())),
    )


def view_counts(db: Session, scope, now: datetime, user_id: uuid.UUID) -> dict[str, int]:
    """All built-in view counts in one query."""
    cols = [func.count().label("all")]
    for v in BUILT_IN_VIEWS[1:]:
        cols.append(func.count().filter(pred_view(v, now, user_id)).label(v))
    row = db.execute(select(*cols).select_from(StudentProfile).where(StudentProfile.user_id.in_(scope))).one()
    return dict(row._mapping)


# ---------------------------------------------------------------- waiting on (row value; mirrors pred_waiting_on)

def application_waiting_on(status: ApplicationStatus) -> str | None:
    """Status-only "waiting on" for one application (V9 vocabulary; no live signals): agency · student · university ·
    external, None when final. Lists with live signals use `waiting.application_waiting` instead."""
    party = waiting.status_party(status)
    return None if party == waiting.NONE else party


def _first(statuses: list[ApplicationStatus], order: list[ApplicationStatus]) -> ApplicationStatus | None:
    return next((s for s in order if s in statuses), None)


def waiting_for(*, review: int, fix: int, replied: bool, first_contact: bool, internal_overdue: int, student_tasks: int,
                statuses: list[ApplicationStatus]) -> tuple[str | None, dict | None]:
    """Who has to act next for this student, and the one reason shown next to it ("Us · 2 documents to review")."""
    if first_contact:
        return "us", {"code": "first_contact"}
    if review:
        return "us", {"code": "review", "count": review}
    if replied:
        return "us", {"code": "reply"}
    if internal_overdue:
        return "us", {"code": "overdue_task", "count": internal_overdue}
    if st := _first(statuses, APP_WAITING_AGENCY):
        return "us", {"code": "app", "status": st.value}
    if ApplicationStatus.ADDITIONAL_DOCUMENTS in statuses:
        return "student", {"code": "app", "status": ApplicationStatus.ADDITIONAL_DOCUMENTS.value}
    if fix:
        return "student", {"code": "fix", "count": fix}
    if st := _first(statuses, STUDENT_REASON_ORDER):
        return "student", {"code": "app", "status": st.value}
    if student_tasks:
        return "student", {"code": "student_task", "count": student_tasks}
    if st := _first(statuses, APP_WAITING_UNIVERSITY):
        return "university", {"code": "app", "status": st.value}
    if st := _first(statuses, APP_WAITING_EXTERNAL):
        return "external", {"code": "app", "status": st.value}
    return None, None


# ---------------------------------------------------------------- set-based row aggregation

# Which application status names the reason for codes tied to one application.
CODE_STATUS = {
    "university_request": [ApplicationStatus.ADDITIONAL_DOCUMENTS], "profile_check": [ApplicationStatus.PROFILE_REVIEW],
    "final_check": [ApplicationStatus.READY], "submit": [ApplicationStatus.READY], "submit_on_portal": [ApplicationStatus.READY],
    "rail_confirmation": [ApplicationStatus.READY, ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW],
    "visa_decision": [ApplicationStatus.VISA_SUBMITTED],
}


def _task_brief(t: Task | None, now: datetime) -> dict | None:
    if t is None:
        return None
    return {"id": str(t.id), "title": t.title, "title_key": t.title_key, "title_params": t.title_params, "due_at": iso(t.due_at),
            "overdue": bool(t.due_at and t.due_at < now)}


def _named_owners(db: Session, ids: list[uuid.UUID], now: datetime) -> dict[tuple[uuid.UUID, str], dict]:
    """The named person behind reasons that belong to a specific person rather than the case counselor:
    review → the reviewer of the oldest document waiting; essay_review → the essay reviewer; task → the owner of the
    oldest overdue staff task; service → the owner of the oldest open service case."""
    from app.models.v5_concierge import ServiceCase

    out: dict[tuple[uuid.UUID, str], dict] = {}
    rows = []
    rows += [("review", r) for r in db.execute(
        select(Document.owner_user_id, Document.reviewer_user_id).where(Document.owner_user_id.in_(ids), Document.status.in_(REVIEW_DOCS),
                                                                       Document.reviewer_user_id.is_not(None)).order_by(Document.updated_at)).all()]
    rows += [("essay_review", r) for r in db.execute(
        select(Essay.owner_user_id, Essay.reviewer_user_id).where(Essay.owner_user_id.in_(ids), Essay.status.in_(waiting.ESSAY_REVIEW),
                                                                 Essay.reviewer_user_id.is_not(None)).order_by(Essay.updated_at)).all()]
    rows += [("task", r) for r in db.execute(
        select(Task.student_user_id, Task.owner_user_id).where(Task.student_user_id.in_(ids), Task.status.in_(OPEN), Task.visible_to_student.is_(False),
                                                             Task.due_at < now, Task.owner_user_id.is_not(None)).order_by(Task.due_at)).all()]
    rows += [("service", r) for r in db.execute(
        select(ServiceCase.student_user_id, ServiceCase.owner_user_id).where(ServiceCase.student_user_id.in_(ids), ServiceCase.owner_user_id.is_not(None),
                                                                           ServiceCase.closed_at.is_(None)).order_by(ServiceCase.created_at)).all()]
    people = dict(db.execute(select(User.id, User.full_name).where(User.id.in_({r[1] for _c, r in rows}))).all()) if rows else {}
    for code, (sid, uid) in rows:
        out.setdefault((sid, code), {"id": str(uid), "name": people.get(uid)})
    return out


def _targets(db: Session, ids: list, now: datetime) -> dict:
    """V26 (REPORT §341 RC-01): the exact records behind a row's work, so a queue row can open the item, not the student.

    One bulk query per kind, keyed by student id. Each value is the record the counsellor acts on first:
      request        the oldest OPEN university document request (and its application)
      reply_thread   the newest conversation whose latest student-visible message is the student's (a reply is owed)
      thread         the newest conversation of any kind
      review_doc     the oldest document waiting for review;  fix_doc  the oldest document returned / expired
      essay          the oldest essay waiting for review
      deadline_app   the pre-submission application with the nearest open deadline
      task           the oldest overdue staff task
      app            the application the case is about (most recently updated); a returned one fills `request`
    """
    out: dict = {sid: {} for sid in ids}
    for sid, rid, aid in db.execute(
            select(Application.student_user_id, DocumentRequest.id, DocumentRequest.application_id)
            .join(Application, Application.id == DocumentRequest.application_id)
            .where(Application.student_user_id.in_(ids), DocumentRequest.status == "OPEN")
            .distinct(Application.student_user_id).order_by(Application.student_user_id, DocumentRequest.requested_at, DocumentRequest.id)).all():
        out[sid]["request"] = {"id": str(rid), "application_id": str(aid)}
    latest = (select(Message.conversation_id, func.max(Message.created_at).label("at"))
              .where(Message.visibility == MessageVisibility.PARTICIPANTS).group_by(Message.conversation_id).subquery())
    for sid, cid, author in db.execute(
            select(Conversation.student_user_id, Conversation.id, Message.author_user_id)
            .join(latest, latest.c.conversation_id == Conversation.id)
            .join(Message, and_(Message.conversation_id == Conversation.id, Message.created_at == latest.c.at))
            .where(Conversation.student_user_id.in_(ids))
            .order_by(Conversation.student_user_id, latest.c.at.desc())).all():
        out[sid].setdefault("thread", str(cid))
        if author == sid:
            out[sid].setdefault("reply_thread", str(cid))
    for key, states in (("review_doc", REVIEW_DOCS), ("fix_doc", FIX_DOCS)):
        for sid, did in db.execute(
                select(Document.owner_user_id, Document.id).where(Document.owner_user_id.in_(ids), Document.status.in_(states))
                .distinct(Document.owner_user_id).order_by(Document.owner_user_id, Document.updated_at, Document.id)).all():
            out[sid][key] = str(did)
    for sid, eid in db.execute(
            select(Essay.owner_user_id, Essay.id).where(Essay.owner_user_id.in_(ids), Essay.status.in_(waiting.ESSAY_REVIEW))
            .distinct(Essay.owner_user_id).order_by(Essay.owner_user_id, Essay.updated_at, Essay.id)).all():
        out[sid]["essay"] = str(eid)
    for sid, aid in db.execute(
            select(Application.student_user_id, Application.id).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
            .where(Application.student_user_id.in_(ids), Application.status.in_(PRE_SUBMIT), ProgramIntake.application_deadline >= now.date())
            .distinct(Application.student_user_id).order_by(Application.student_user_id, ProgramIntake.application_deadline, Application.id)).all():
        out[sid]["deadline_app"] = str(aid)
    for sid, tid in db.execute(
            select(Task.student_user_id, Task.id).where(Task.student_user_id.in_(ids), Task.status.in_(OPEN), Task.visible_to_student.is_(False), Task.due_at < now)
            .distinct(Task.student_user_id).order_by(Task.student_user_id, Task.due_at, Task.id)).all():
        out[sid]["task"] = str(tid)
    # An application the university returned without a recorded request (status only) is still the item to open; and
    # every row with an application gets the one the case is about (the same tie-break as `top_university`).
    for sid, aid, st in db.execute(
            select(Application.student_user_id, Application.id, Application.status).where(Application.student_user_id.in_(ids), Application.status != ApplicationStatus.WITHDRAWN)
            .order_by(Application.student_user_id, Application.updated_at.desc(), Application.id)).all():
        out[sid].setdefault("app", str(aid))
        if st == ApplicationStatus.ADDITIONAL_DOCUMENTS:
            out[sid].setdefault("request", {"id": None, "application_id": str(aid)})
    return out


def build_rows(db: Session, pairs: list[tuple[StudentProfile, User]], now: datetime) -> list[dict[str, Any]]:
    if not pairs:
        return []
    ids = [u.id for _, u in pairs]

    counselor = aliased(User)
    assignments = {r.student_user_id: r for r in db.execute(
        select(AgencyAssignment.student_user_id, AgencyAssignment.organization_id, AgencyAssignment.created_at, AgencyAssignment.first_response_at,
               AgencyAssignment.first_response_due_at, counselor.id.label("c_id"), counselor.full_name.label("c_name"))
        .outerjoin(counselor, counselor.id == AgencyAssignment.counselor_user_id)
        .where(AgencyAssignment.student_user_id.in_(ids), AgencyAssignment.status == AssignmentStatus.ACTIVE)).all()}

    tasks = {r.sid: r for r in db.execute(
        select(Task.student_user_id.label("sid"), func.count().label("open"),
               func.count().filter(Task.due_at < now).label("overdue"),
               func.count().filter(Task.visible_to_student.is_(True)).label("student_open"),
               func.count().filter(Task.due_at < now, Task.visible_to_student.is_(False)).label("internal_overdue"))
        .where(Task.student_user_id.in_(ids), Task.status.in_(OPEN)).group_by(Task.student_user_id)).all()}

    next_tasks = {t.student_user_id: t for t in db.scalars(
        select(Task).where(Task.student_user_id.in_(ids), Task.status.in_(OPEN), Task.due_at.is_not(None))
        .distinct(Task.student_user_id).order_by(Task.student_user_id, Task.due_at)).all()}

    apps = {r.sid: r for r in db.execute(
        select(Application.student_user_id.label("sid"), func.count().label("n"),
               func.count().filter(Application.status.in_(AT_UNIVERSITY)).label("at_uni"),
               func.max(Application.updated_at).label("last"))
        .where(Application.student_user_id.in_(ids)).group_by(Application.student_user_id)).all()}

    tops = {r.sid: r for r in db.execute(
        select(Application.student_user_id.label("sid"), University.name_en, University.name_ko, Application.status)
        .join(University, University.id == Application.university_id)
        .where(Application.student_user_id.in_(ids), Application.status != ApplicationStatus.WITHDRAWN)
        # V10: `Application.id` breaks ties. Seeded (and bulk-updated) applications share an `updated_at` to the
        # microsecond, so without it PostgreSQL may return a different row per call and the caseload list and the
        # student workspace — both built here — named different universities for the same next action.
        .distinct(Application.student_user_id).order_by(Application.student_user_id, Application.updated_at.desc(), Application.id)).all()}

    deadlines = {r.sid: r for r in db.execute(
        select(Application.student_user_id.label("sid"), ProgramIntake.application_deadline, University.name_en, University.name_ko)
        .join(ProgramIntake, ProgramIntake.id == Application.intake_id).join(University, University.id == Application.university_id)
        .where(Application.student_user_id.in_(ids), Application.status.in_(PRE_SUBMIT), ProgramIntake.application_deadline >= now.date())
        .distinct(Application.student_user_id).order_by(Application.student_user_id, ProgramIntake.application_deadline, Application.id)).all()}

    docs = {r.sid: r for r in db.execute(
        select(Document.owner_user_id.label("sid"),
               func.count().filter(Document.status.in_(REVIEW_DOCS)).label("review"),
               func.count().filter(Document.status.in_(FIX_DOCS)).label("fix"),
               func.count().filter(Document.status == "VERIFIED").label("ok"),
               func.count().filter(Document.status != "MISSING").label("total"),
               func.max(Document.updated_at).label("last"))
        .where(Document.owner_user_id.in_(ids)).group_by(Document.owner_user_id)).all()}

    last_msgs = dict(db.execute(
        select(Message.author_user_id, func.max(Message.created_at)).where(Message.author_user_id.in_(ids)).group_by(Message.author_user_id)).all())

    replies = set(db.scalars(_replies_waiting_students().where(Conversation.student_user_id.in_(ids))).all())

    app_states: dict[uuid.UUID, list[ApplicationStatus]] = {}
    app_uni: dict[tuple[uuid.UUID, ApplicationStatus], str] = {}
    for sid, st, uni in db.execute(select(Application.student_user_id, Application.status, University.name_en)
                                   .join(University, University.id == Application.university_id)
                                   .where(Application.student_user_id.in_(ids)).order_by(Application.updated_at.desc(), Application.id)).all():
        app_states.setdefault(sid, []).append(st)
        app_uni.setdefault((sid, st), uni)

    # V9 waiting model: one party + reason per student (same predicates as the views), then who exactly holds it.
    parties = waiting.evaluate(db, ids, now)
    orgs = dict(db.execute(select(Organization.id, Organization.name).where(Organization.id.in_({a.organization_id for a in assignments.values()})))
                .all()) if assignments else {}
    named = _named_owners(db, ids, now)
    student_tasks = {t.student_user_id: t for t in db.scalars(
        select(Task).where(Task.student_user_id.in_(ids), Task.status.in_(OPEN), Task.visible_to_student.is_(True))
        .distinct(Task.student_user_id).order_by(Task.student_user_id, Task.due_at.asc().nulls_last(), Task.created_at)).all()}
    staff_tasks = {t.student_user_id: t for t in db.scalars(
        select(Task).where(Task.student_user_id.in_(ids), Task.status.in_(OPEN), Task.visible_to_student.is_(False), Task.due_at < now)
        .distinct(Task.student_user_id).order_by(Task.student_user_id, Task.due_at)).all()}

    targets = _targets(db, ids, now)
    out = []
    for prof, user in pairs:
        a = assignments.get(user.id)
        t = tasks.get(user.id)
        nx = next_tasks.get(user.id)
        ap = apps.get(user.id)
        top = tops.get(user.id)
        dl = deadlines.get(user.id)
        d = docs.get(user.id)
        sla_due = a.first_response_due_at if a and a.first_response_at is None else None
        stamps = [prof.updated_at, d.last if d else None, ap.last if ap else None, last_msgs.get(user.id)]
        last = max((x for x in stamps if x is not None), default=None)
        review, fix = (d.review, d.fix) if d else (0, 0)
        party, code = parties.get(user.id, (waiting.NONE, None))
        statuses = app_states.get(user.id, [])
        app_status = (_first(statuses, waiting.STUDENT_ORDER) if code == "app" else _first(statuses, waiting.APP_UNIVERSITY) if code == "app_university"
                      else _first(statuses, CODE_STATUS.get(code, [])))
        ctx = {
            "review": review, "fix": fix, "internal_overdue": t.internal_overdue if t else 0, "student_tasks": t.student_open if t else 0,
            "student_task": _task_brief(student_tasks.get(user.id), now), "staff_task": _task_brief(staff_tasks.get(user.id), now),
            "app_status": app_status.value if app_status else None, "university": app_uni.get((user.id, app_status)) if app_status else None,
            "counselor": {"id": str(a.c_id), "name": a.c_name} if a and a.c_id else None, "named": named.get((user.id, code)),
            "agency": orgs.get(a.organization_id) if a else None, "student": user.full_name,
        }
        waiting_on = None if party == waiting.NONE else party
        waiting_reason = None
        if code:
            waiting_reason = {"code": code}
            if code in ("review", "review_unassigned"):
                waiting_reason["count"] = review
            elif code == "fix":
                waiting_reason["count"] = fix
            elif code in ("task", "task_unassigned"):
                waiting_reason["count"] = ctx["internal_overdue"]
            elif code == "student_task":
                waiting_reason["count"] = ctx["student_tasks"]
            if app_status:
                waiting_reason["status"] = app_status.value
        out.append({
            "id": str(user.id), "full_name": user.full_name, "email": user.email, "nationality": prof.nationality, "residence_country": prof.residence_country,
            "target_degree": prof.target_degree.value if prof.target_degree else None,
            "target_intake": f"{prof.target_intake_year}-{prof.target_intake_term.value}" if prof.target_intake_year and prof.target_intake_term else None,
            "pipeline_stage": prof.pipeline_stage.value, "profile_percent": profile_percent(prof),
            "counselor": {"id": str(a.c_id), "full_name": a.c_name} if a and a.c_id else None,
            "organization_id": str(a.organization_id) if a else None, "assigned_at": iso(a.created_at) if a else None,
            "open_tasks": t.open if t else 0, "overdue_tasks": t.overdue if t else 0, "applications": ap.n if ap else 0,
            "documents_to_review": review, "sla_first_response_due": iso(sla_due), "sla_breached": bool(sla_due and sla_due < now),
            "updated_at": iso(prof.updated_at), "is_demo": prof.is_demo,
            "next_task": {"id": str(nx.id), "title": nx.title, "title_key": nx.title_key, "title_params": nx.title_params, "task_type": nx.task_type.value,
                          "due_at": iso(nx.due_at), "overdue": bool(nx.due_at and nx.due_at < now)} if nx else None,
            "next_deadline": {"date": dl.application_deadline.isoformat(), "university": dl.name_en, "university_ko": dl.name_ko} if dl else None,
            "top_university": {"name": top.name_en, "name_ko": top.name_ko, "status": top.status.value} if top else None,
            "documents_to_fix": fix, "documents_verified": d.ok if d else 0, "documents_total": d.total if d else 0,
            "waiting_on_university": ap.at_uni if ap else 0, "waiting_on": waiting_on, "waiting_reason": waiting_reason,
            # V9: who exactly holds the next action, and that action in their voice (never a student task on a staff row).
            "waiting_owner": waiting.owner(party, code, ctx), "next_action": waiting.next_action(party, code, ctx),
            "waiting_on_legacy": waiting.legacy(party),
            "student_replied": user.id in replies,
            "targets": targets.get(user.id, {}),
            "last_activity_at": iso(last),
        })
    return out



def deadline_sort_expr(now: datetime):
    """Earliest upcoming pre-submission application deadline per student (NULLs last)."""
    return (select(func.min(ProgramIntake.application_deadline)).join(Application, Application.intake_id == ProgramIntake.id)
            .where(Application.student_user_id == StudentProfile.user_id, Application.status.in_(PRE_SUBMIT),
                   ProgramIntake.application_deadline >= now.date()).correlate(StudentProfile).scalar_subquery())


def activity_sort_expr():
    return func.greatest(
        StudentProfile.updated_at,
        func.coalesce(select(func.max(Document.updated_at)).where(Document.owner_user_id == StudentProfile.user_id).correlate(StudentProfile).scalar_subquery(),
                      StudentProfile.updated_at),
        func.coalesce(select(func.max(Application.updated_at)).where(Application.student_user_id == StudentProfile.user_id).correlate(StudentProfile).scalar_subquery(),
                      StudentProfile.updated_at),
    )



def applications_waiting(db: Session, apps: list[Application], remaining: dict | None = None) -> dict[uuid.UUID, tuple[str, str | None]]:
    """V9: (party, reason) per application with live signals (submission record, authorisation, agency assignment,
    items left / in review). `remaining` maps application id → (items_remaining, items_in_review)."""
    from app.models.v5_success import ApplicationSubmission, SubmissionAuthorization

    if not apps:
        return {}
    ids = [a.id for a in apps]
    recs = {r.application_id: r for r in db.scalars(select(ApplicationSubmission).where(ApplicationSubmission.application_id.in_(ids))).all()}
    auths: dict[uuid.UUID, SubmissionAuthorization] = {}
    for au in db.scalars(select(SubmissionAuthorization).where(SubmissionAuthorization.application_id.in_(ids))
                         .order_by(SubmissionAuthorization.granted_at)).all():
        auths[au.application_id] = au  # latest wins
    agency = set(db.scalars(select(AgencyAssignment.student_user_id).where(
        AgencyAssignment.student_user_id.in_({a.student_user_id for a in apps}), AgencyAssignment.status == AssignmentStatus.ACTIVE)).all())
    out = {}
    for a in apps:
        rem, inrev = (remaining or {}).get(a.id, (None, None))
        out[a.id] = waiting.application_waiting(a, has_agency=a.student_user_id in agency, record=recs.get(a.id), authorization=auths.get(a.id),
                                                items_remaining=rem, items_in_review=inrev)
    return out
