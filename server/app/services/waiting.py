"""V9 — one "waiting on" model (REPORT §59 A1, docs/STATE_MAP.md "Waiting on").

Every student case (and every application) waits on exactly one party, for exactly one reason:

  counselor   a named agency person owns the next action (first contact, a reply owed, their review, their task,
              the final check / submission of an application, their service case)
  agency      the agency team owns it but nobody is assigned (unassigned case, unassigned review, unassigned task)
  hangyul     Hangyul operations owns it (a paid case with no agency, a payment issue, an unassigned case outside agencies)
  student     the student must act (fix a document, answer a university request, reply to an offer, their own task)
  university  the university must act (review, decision, tuition invoice, admission letter)
  external    someone outside all three (embassy decision, official rail confirmation, a service provider)
  none        nothing is open (finished, or nothing to do yet)

The legacy value ``us`` (V4–V8: "the agency / Hangyul team") stays accepted in filters and saved views; it means
``counselor`` OR ``agency``.

How the one party is chosen: ``rules(now)`` is an ordered list of (reason code, party, SQL predicate over
``StudentProfile.user_id``). A student's party and reason are the FIRST rule whose predicate is true. The list filter
(``pred``) and the row value (``evaluate``) are built from the same predicates, so a view's count equals its rows by
construction. Order (most actionable first): Hangyul money/assignment problems that block everything → work the agency
owes (named before unassigned) → work the student owes → the university → outside parties.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, case, exists, false, func, not_, or_, select
from sqlalchemy.orm import Session, aliased

from app.models import (
    AgencyAssignment,
    Application,
    Conversation,
    Document,
    DocumentRequest,
    Essay,
    Message,
    StudentProfile,
    Task,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, MessageVisibility, TaskStatus

COUNSELOR, AGENCY, HANGYUL, STUDENT, UNIVERSITY, EXTERNAL, NONE = "counselor", "agency", "hangyul", "student", "university", "external", "none"
PARTIES = (COUNSELOR, AGENCY, HANGYUL, STUDENT, UNIVERSITY, EXTERNAL, NONE)
# Legacy filter values → the parties they mean today.
ALIASES: dict[str, tuple[str, ...]] = {"us": (COUNSELOR, AGENCY)}
FILTER_VALUES = PARTIES + tuple(ALIASES)
FILTER_PATTERN = "^(" + "|".join(FILTER_VALUES) + ")$"
STAFF_PARTIES = (COUNSELOR, AGENCY, HANGYUL)

OPEN_TASK = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS]
REVIEW_DOCS = ["UPLOADED", "NEEDS_REVIEW"]
FIX_DOCS = ["NEEDS_CORRECTION", "EXPIRED"]
ESSAY_REVIEW = ["SUBMITTED", "AI_PRECHECK", "AGENCY_REVIEW", "FINAL_REVIEW"]
PAYMENT_FAILED_DAYS = 30
PAYMENT_PENDING_HOURS = 24
CONFIRMATION_MISSING_DAYS = 2

APP_STUDENT = [S.DRAFT, S.DOCUMENT_PREPARATION, S.OFFERED, S.TUITION_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_ISSUED]
APP_UNIVERSITY = [S.SUBMITTED, S.UNIVERSITY_REVIEW, S.INTERVIEW, S.WAITLISTED, S.OFFER_ACCEPTED, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING]
APP_EXTERNAL = [S.VISA_SUBMITTED]
# Which student-side state to name first when a student has several applications.
STUDENT_ORDER = [S.OFFERED, S.TUITION_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_ISSUED, S.DOCUMENT_PREPARATION, S.DRAFT]

# One plain definition per reason (returned by the API; the UI words are i18n keys `v9.waiting.reason.<code>`).
REASONS: dict[str, tuple[str, str]] = {
    "paid_no_agency": (HANGYUL, "Paid for a Hangyul service but no agency is assigned yet."),
    "unassigned_case": (AGENCY, "Assigned to the agency, but no counselor owns the case."),
    "first_contact": (COUNSELOR, "The counselor has not made first contact yet."),
    "reply_owed": (COUNSELOR, "The student wrote last and is waiting for an answer."),
    "review": (COUNSELOR, "Documents waiting for the named reviewer."),
    "review_unassigned": (AGENCY, "Documents waiting for review with no reviewer assigned."),
    "essay_review": (COUNSELOR, "An essay waiting for its named reviewer."),
    "essay_unassigned": (AGENCY, "An essay waiting for review with no reviewer assigned."),
    "task": (COUNSELOR, "A staff task past its due date, owned by a named person."),
    "task_unassigned": (AGENCY, "A staff task past its due date that nobody owns."),
    "submit": (COUNSELOR, "The student authorised the agency to submit; the counselor submits and records the reference."),
    "profile_check": (COUNSELOR, "An application waits for the counselor's profile check."),
    "final_check": (COUNSELOR, "An application is ready: the counselor's final check and hand-off are next."),
    "service": (COUNSELOR, "A service case waits on its owner."),
    "service_unassigned": (AGENCY, "A service case waits on the team with no owner."),
    "payment_issue": (HANGYUL, f"A payment failed in the last {PAYMENT_FAILED_DAYS} days, or is pending for more than {PAYMENT_PENDING_HOURS} h."),
    "university_request": (STUDENT, "The university asked for one more document."),
    "fix": (STUDENT, "A document was sent back for correction or has expired."),
    "submit_on_portal": (STUDENT, "Handed off: the student submits on the official portal and records the reference."),
    "app": (STUDENT, "An application waits on the student (see its status)."),
    "student_task": (STUDENT, "The student has open tasks."),
    "rail_confirmation": (EXTERNAL, "Reported as submitted on the official portal; no reference or receipt recorded yet."),
    "app_university": (UNIVERSITY, "An application waits on the university (see its status)."),
    "visa_decision": (EXTERNAL, "The visa application is with the embassy."),
    "provider": (EXTERNAL, "A service case waits on the provider."),
}


# ------------------------------------------------------------------------------------------------ signals (SQL)

def _sid():
    return StudentProfile.user_id


def _active_assignment():
    return select(AgencyAssignment.student_user_id).where(AgencyAssignment.status == AssignmentStatus.ACTIVE)


def has_agency():
    return _sid().in_(_active_assignment())


def replies_waiting_students():
    """Students whose latest student-visible message in any of their conversations was written by the student."""
    latest = (select(Message.conversation_id, func.max(Message.created_at).label("at"))
              .where(Message.visibility == MessageVisibility.PARTICIPANTS).group_by(Message.conversation_id).subquery())
    return (select(Conversation.student_user_id)
            .join(latest, latest.c.conversation_id == Conversation.id)
            .join(Message, and_(Message.conversation_id == Conversation.id, Message.created_at == latest.c.at))
            .where(Conversation.student_user_id.is_not(None), Message.author_user_id == Conversation.student_user_id))


def _apps(states, *extra):
    return _sid().in_(select(Application.student_user_id).where(Application.status.in_(states), *extra))


def _submissions():
    from app.models.v5_success import ApplicationSubmission, SubmissionAuthorization

    return ApplicationSubmission, SubmissionAuthorization


def _paid_orders():
    from app.models.business import Order
    from app.models.enums import OrderStatus

    return select(Order.user_id).where(Order.status == OrderStatus.PAID)


def _payment_issue(now: datetime):
    from app.models.business import Order
    from app.models.enums import OrderStatus

    later = aliased(Order)
    resolved = exists().where(later.user_id == Order.user_id, later.product_id == Order.product_id, later.status == OrderStatus.PAID,
                              later.created_at >= Order.created_at)
    failed = and_(Order.status == OrderStatus.FAILED, Order.updated_at >= now - timedelta(days=PAYMENT_FAILED_DAYS))
    stuck = and_(Order.status == OrderStatus.PENDING, Order.created_at < now - timedelta(hours=PAYMENT_PENDING_HOURS))
    return _sid().in_(select(Order.user_id).where(or_(failed, stuck), ~resolved))


def _service_team(owner: bool | None, routed: str | None = None):
    """Open service cases whose status waits on the team (concierge state tables), optionally by owner/route."""
    from app.models.v5_concierge import ServiceCase
    from app.services import concierge

    clauses = []
    for ct, table in concierge.TABLES.items():
        sts = [s for s, st in table.items() if st.waiting == "team" and st.bucket == "open"]
        if sts:
            clauses.append(and_(ServiceCase.case_type == ct, ServiceCase.status.in_(sts)))
    generic = [s for s, st in concierge.GENERIC.items() if st.waiting == "team" and st.bucket == "open"]
    clauses.append(and_(ServiceCase.case_type.notin_(list(concierge.TABLES)), ServiceCase.status.in_(generic)))
    q = select(ServiceCase.student_user_id).where(or_(*clauses))
    if owner is True:
        q = q.where(ServiceCase.owner_user_id.is_not(None))
    elif owner is False:
        q = q.where(ServiceCase.owner_user_id.is_(None))
    if routed:
        q = q.where(ServiceCase.routed_to == routed)
    return _sid().in_(q)


def _service_provider():
    from app.models.v5_concierge import ServiceCase
    from app.services import concierge

    clauses = []
    for ct, table in concierge.TABLES.items():
        sts = [s for s, st in table.items() if st.waiting == "provider" and st.bucket == "open"]
        if sts:
            clauses.append(and_(ServiceCase.case_type == ct, ServiceCase.status.in_(sts)))
    generic = [s for s, st in concierge.GENERIC.items() if st.waiting == "provider" and st.bucket == "open"]
    clauses.append(and_(ServiceCase.case_type.notin_(list(concierge.TABLES)), ServiceCase.status.in_(generic)))
    return _sid().in_(select(ServiceCase.student_user_id).where(or_(*clauses)))


def _ready(kind: str):
    """READY applications split by where the submission stands (submission records + authorisations)."""
    sub, auth = _submissions()
    base = select(Application.student_user_id).where(Application.status == S.READY)
    rec = lambda *st: exists().where(sub.application_id == Application.id, sub.status.in_(st))  # noqa: E731
    authorised = exists().where(auth.application_id == Application.id, auth.status == "ACTIVE")
    if kind == "authorised":
        return _sid().in_(base.where(authorised, ~rec("SUBMITTED_CONFIRMED", "SUBMITTED_UNCONFIRMED")))
    if kind == "handed_off":
        return _sid().in_(base.where(rec("HANDED_OFF"), ~authorised))
    # final check / hand-off still with the agency
    return _sid().in_(base.where(~authorised, ~rec("HANDED_OFF", "SUBMITTED_CONFIRMED", "SUBMITTED_UNCONFIRMED")))


def _unconfirmed():
    """Reported submitted on the official rail, without a reference or receipt (any application status before a decision)."""
    sub, _auth = _submissions()
    return _sid().in_(select(Application.student_user_id).join(sub, sub.application_id == Application.id).where(
        sub.status == "SUBMITTED_UNCONFIRMED", Application.status.in_([S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW])))


def university_requested():
    return or_(
        _sid().in_(select(Application.student_user_id).join(DocumentRequest, DocumentRequest.application_id == Application.id)
                   .where(DocumentRequest.status == "OPEN")),
        _apps([S.ADDITIONAL_DOCUMENTS]),
    )


def rules(now: datetime) -> list[tuple[str, str, Any]]:
    """Ordered (code, party, predicate). The first true rule names the party and the reason."""
    agency = has_agency()
    no_agency = ~agency
    unassigned = _sid().in_(_active_assignment().where(AgencyAssignment.counselor_user_id.is_(None)))
    first_contact = _sid().in_(_active_assignment().where(AgencyAssignment.first_response_at.is_(None)))
    reply = _sid().in_(replies_waiting_students())
    docs = lambda *w: _sid().in_(select(Document.owner_user_id).where(Document.status.in_(REVIEW_DOCS), *w))  # noqa: E731
    essays = lambda *w: _sid().in_(select(Essay.owner_user_id).where(Essay.status.in_(ESSAY_REVIEW), *w))  # noqa: E731
    tasks = lambda *w: _sid().in_(select(Task.student_user_id).where(Task.status.in_(OPEN_TASK), Task.visible_to_student.is_(False),  # noqa: E731
                                                                        Task.due_at < now, *w))
    return [
        ("paid_no_agency", HANGYUL, and_(no_agency, _sid().in_(_paid_orders()))),
        ("unassigned_case", AGENCY, unassigned),
        ("first_contact", COUNSELOR, first_contact),
        ("reply_owed", COUNSELOR, and_(reply, agency)),
        ("reply_owed", HANGYUL, and_(reply, no_agency)),
        ("review", COUNSELOR, docs(Document.reviewer_user_id.is_not(None))),
        ("review_unassigned", AGENCY, and_(docs(Document.reviewer_user_id.is_(None)), agency)),
        ("review_unassigned", HANGYUL, and_(docs(Document.reviewer_user_id.is_(None)), no_agency)),
        ("essay_review", COUNSELOR, essays(Essay.reviewer_user_id.is_not(None))),
        ("essay_unassigned", AGENCY, and_(essays(Essay.reviewer_user_id.is_(None)), agency)),
        ("essay_unassigned", HANGYUL, and_(essays(Essay.reviewer_user_id.is_(None)), no_agency)),
        ("task", COUNSELOR, tasks(Task.owner_user_id.is_not(None))),
        ("task_unassigned", AGENCY, and_(tasks(Task.owner_user_id.is_(None)), agency)),
        ("task_unassigned", HANGYUL, and_(tasks(Task.owner_user_id.is_(None)), no_agency)),
        ("submit", COUNSELOR, and_(_ready("authorised"), agency)),
        ("profile_check", COUNSELOR, and_(_apps([S.PROFILE_REVIEW]), agency)),
        ("profile_check", HANGYUL, and_(_apps([S.PROFILE_REVIEW]), no_agency)),
        ("final_check", COUNSELOR, and_(_ready("agency"), agency)),
        ("final_check", HANGYUL, and_(_ready("agency"), no_agency)),
        ("service", COUNSELOR, _service_team(True)),
        ("service_unassigned", AGENCY, and_(_service_team(False, "AGENCY"), agency)),
        ("service_unassigned", HANGYUL, or_(_service_team(False, "HANGYUL_OPS"), and_(_service_team(False, "AGENCY"), no_agency))),
        ("payment_issue", HANGYUL, _payment_issue(now)),
        ("university_request", STUDENT, university_requested()),
        ("fix", STUDENT, _sid().in_(select(Document.owner_user_id).where(Document.status.in_(FIX_DOCS)))),
        ("submit_on_portal", STUDENT, _ready("handed_off")),
        ("app", STUDENT, _apps(APP_STUDENT)),
        ("student_task", STUDENT, _sid().in_(select(Task.student_user_id).where(Task.status.in_(OPEN_TASK), Task.visible_to_student.is_(True)))),
        ("rail_confirmation", EXTERNAL, _unconfirmed()),
        ("app_university", UNIVERSITY, _apps(APP_UNIVERSITY)),
        ("visa_decision", EXTERNAL, _apps(APP_EXTERNAL)),
        ("provider", EXTERNAL, _service_provider()),
    ]


def first_rule(now: datetime):
    """The index of the FIRST true rule for a student, as one SQL expression (NULL when none is true).

    V26 (REPORT §344, brief §52): the previous form — `rule_i AND NOT (rule_1 OR … OR rule_{i-1})` for every rule of a
    party — copied each earlier predicate into every later one, so a party's predicate was up to 57 KB of SQL and the
    TODAY figures (`view_counts`, twenty such predicates in one statement) took 10.7 s at 1,071 students. A CASE is
    evaluated left to right and stops at the first true branch, which is exactly the rule order; every predicate appears
    once. Same answer, O(n) instead of O(n²)."""
    rs = rules(now)
    return case(*[(p, i) for i, (_code, _who, p) in enumerate(rs)], else_=None)


def pred_legacy(party: str, now: datetime):
    """The pre-V26 form of `pred` — `rule_i AND NOT (rule_1 OR … OR rule_{i-1})` per rule — kept as the oracle that
    `tests/test_v26.py::test_waiting_case_predicate_matches_the_legacy_form` compares `pred` against, student for student,
    for every party. Not used by the product."""
    if party in ALIASES:
        return or_(*[pred_legacy(p, now) for p in ALIASES[party]])
    rs = rules(now)
    if party == NONE:
        return not_(or_(*[r[2] for r in rs]))
    out, before = [], []
    for _code, who, p in rs:
        if who == party:
            out.append(and_(p, not_(or_(*before))) if before else p)
        before.append(p)
    return or_(*out) if out else false()


def pred(party: str, now: datetime):
    """Students whose ONE waiting party is `party` (legacy `us` = counselor or agency)."""
    if party in ALIASES:
        return or_(*[pred(p, now) for p in ALIASES[party]])
    rs = rules(now)
    hit = first_rule(now)
    if party == NONE:
        return hit.is_(None)
    idx = [i for i, (_code, who, _p) in enumerate(rs) if who == party]
    return hit.in_(idx) if idx else false()


def evaluate(db: Session, ids: list[uuid.UUID], now: datetime) -> dict[uuid.UUID, tuple[str, str | None]]:
    """(party, reason code) per student — one query, the same predicates as `pred`."""
    if not ids:
        return {}
    rs = rules(now)
    cols = [p.label(f"r{i}") for i, (_c, _w, p) in enumerate(rs)]
    out: dict[uuid.UUID, tuple[str, str | None]] = {}
    for row in db.execute(select(StudentProfile.user_id, *cols).where(StudentProfile.user_id.in_(ids))).all():
        hit = next((i for i in range(len(rs)) if row[i + 1]), None)
        out[row[0]] = (rs[hit][1], rs[hit][0]) if hit is not None else (NONE, None)
    return out


def counts(db: Session, scope, now: datetime) -> dict[str, int]:
    """Students per party in one grouped pass (sum = all students in scope)."""
    ids = list(db.scalars(select(StudentProfile.user_id).where(StudentProfile.user_id.in_(scope))).all())
    out = {p: 0 for p in PARTIES}
    for party, _code in evaluate(db, ids, now).values():
        out[party] += 1
    return out


def legacy(party: str | None) -> str | None:
    """V4–V8 value for old clients (agency-mobile): counselor/agency/hangyul → us."""
    if party in STAFF_PARTIES:
        return "us"
    return None if party in (None, NONE) else party


# ------------------------------------------------------------------------------------------------ per application

def application_waiting(app: Application, *, has_agency: bool, record=None, authorization=None,
                        items_remaining: int | None = None, items_in_review: int | None = None) -> tuple[str, str | None]:
    """One application's party + reason (same vocabulary as the case). `record` = ApplicationSubmission, `authorization` =
    latest SubmissionAuthorization. Without an agency, the staff side is Hangyul's."""
    st = app.status
    staff = COUNSELOR if has_agency else HANGYUL
    rec = getattr(record, "status", None)
    if st == S.READY:
        if authorization is not None and getattr(authorization, "status", None) == "ACTIVE" and rec not in ("SUBMITTED_CONFIRMED", "SUBMITTED_UNCONFIRMED"):
            return staff, "submit"
        if rec == "HANDED_OFF":
            return STUDENT, "submit_on_portal"
        if rec == "SUBMITTED_UNCONFIRMED":
            return EXTERNAL, "rail_confirmation"
        return staff, "final_check"
    if st == S.PROFILE_REVIEW:
        return staff, "profile_check"
    if st in (S.DRAFT, S.DOCUMENT_PREPARATION) and items_remaining and items_in_review and items_in_review >= items_remaining:
        return staff, "review"  # everything left is already with us for review
    if st == S.ADDITIONAL_DOCUMENTS:
        return STUDENT, "university_request"
    if st in APP_STUDENT:
        return STUDENT, "app"
    if st in (S.SUBMITTED, S.UNIVERSITY_REVIEW) and rec == "SUBMITTED_UNCONFIRMED":
        return EXTERNAL, "rail_confirmation"
    if st in APP_UNIVERSITY:
        return UNIVERSITY, "app_university"
    if st in APP_EXTERNAL:
        return EXTERNAL, "visa_decision"
    return NONE, None


def status_party(status: S) -> str:
    """Status-only fallback (no live signals): mirrors `applicationWaitingOn` in @hangyul/utils."""
    if status in (S.PROFILE_REVIEW, S.READY):
        return AGENCY
    if status == S.ADDITIONAL_DOCUMENTS or status in APP_STUDENT:
        return STUDENT
    if status in APP_UNIVERSITY:
        return UNIVERSITY
    if status in APP_EXTERNAL:
        return EXTERNAL
    return NONE


# ------------------------------------------------------------------------------------------------ next action + owner

def next_action(party: str, code: str | None, ctx: dict) -> dict | None:
    """The next action of the party the case waits on, in that party's voice (§55 #8): staff parties get an imperative
    for staff ("Reply to the student", or their own overdue task); the student gets "Student: <their task>" (their own
    next task when the reason is an application state or open tasks); outside parties get what they are doing.
    `ctx` carries the row aggregates (counts, next student task, next staff task, application status, university)."""
    if party == NONE or not code:
        return None
    params: dict[str, Any] = {}
    task = None
    if party == STUDENT and code in ("app", "student_task"):
        task = ctx.get("student_task")
    elif code in ("task", "task_unassigned"):
        task = ctx.get("staff_task")
    if code in ("review", "review_unassigned"):
        params["count"] = ctx.get("review") or 1
    elif code == "fix":
        params["count"] = ctx.get("fix") or 1
    elif code == "student_task":
        params["count"] = ctx.get("student_tasks") or 1
    elif code in ("task", "task_unassigned"):
        params["count"] = ctx.get("internal_overdue") or 1
    if code in ("app", "app_university"):
        params["status"] = ctx.get("app_status")
    if ctx.get("university"):
        params["university"] = ctx["university"]
    return {"party": party, "code": code, "params": params, "task": task}


def owner(party: str, code: str | None, ctx: dict) -> dict | None:
    """Who exactly holds the next action: a named person, the agency team, Hangyul, the student, the university or the
    outside party. Names come from `ctx` (resolved in bulk by the caller)."""
    if party == NONE:
        return None
    if party == COUNSELOR:
        person = ctx.get("named") or ctx.get("counselor")
        return {"kind": "person", "id": person["id"], "name": person["name"]} if person else {"kind": "agency", "name": ctx.get("agency")}
    if party == AGENCY:
        return {"kind": "agency", "name": ctx.get("agency")}
    if party == HANGYUL:
        return {"kind": "hangyul", "name": None}
    if party == STUDENT:
        return {"kind": "student", "name": ctx.get("student")}
    if party == UNIVERSITY:
        return {"kind": "university", "name": ctx.get("university")}
    if code == "visa_decision":
        return {"kind": "embassy", "name": None}
    if code == "rail_confirmation":
        return {"kind": "rail", "name": ctx.get("university")}
    return {"kind": "provider", "name": ctx.get("provider")}
