"""V8 manager "Operations" view — where an agency's operations break.

Six questions, each answered from records that can be listed (every figure returns, or links to, the exact rows it counts):

* backlog   — open work at the end of each of the last 8 weeks (team tasks, document reviews, essay reviews)
* ageing    — active cases by phase and by days since the case last moved (0–7 / 8–14 / 15–30 / 30+)
* load      — V9: weighted load per person (editable weights × open work) against their personal capacity, + SLA risk
* sla       — promises already broken: first replies, document reviews past 48 h, essay reviews past their time
* deadlines — applications not yet submitted, deadline within 14 days, with required items still missing
* stages    — median days an application spends in each status (completed stays in the last 365 days)

V9 adds two first-class questions (REPORT §59 A9) — `blocked` (oldest case that waits on someone and has not moved for
more than BLOCKED_DAYS) and `unassigned_paid` (paid for a service, no counselor / no agency) — and a `questions` block
that answers all six manager questions at the top of the page, each with its drill-down.

Definitions are stated in the response (`definitions`) and on the page. Nothing is estimated: medians below
MIN_DENOMINATOR completed stays are withheld.
"""
from __future__ import annotations

import statistics
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.common import iso
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    AuditLog,
    Document,
    DocumentReview,
    DocumentVersion,
    Essay,
    Organization,
    OrganizationMember,
    Program,
    ProgramIntake,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus, AssignmentStatus, Role
from app.models.v5_writing import EssayReview
from app.services import caseload
from app.services.analytics import MIN_DENOMINATOR

# Same phase grouping as Agency Today ("caseload by phase"); "studying" and closed stages are not moving cases.
PHASES: list[tuple[str, list[str]]] = [
    ("leads", ["NEW_LEAD", "PROFILE_INCOMPLETE", "QUALIFIED", "SERVICE_PURCHASED", "ASSIGNED"]),
    ("preparing", ["DOCUMENT_PREPARATION", "READY_TO_APPLY"]),
    ("applied", ["APPLIED", "INTERVIEW", "WAITLISTED"]),
    ("admitted", ["OFFERED", "TUITION_PENDING", "ENROLLED"]),
    ("visa", ["VISA_PREPARATION", "VISA_ISSUED", "ARRIVAL_PREPARATION", "ARRIVED"]),
]
PHASE_OF = {s: k for k, stages in PHASES for s in stages}
BUCKETS = [("0_7", 0, 7), ("8_14", 8, 14), ("15_30", 15, 30), ("30_plus", 31, None)]
CASE_ROLES = (Role.AGENCY_ADMIN,)  # V22: one agency permission
OPEN = caseload.OPEN
TERMINAL = {ApplicationStatus.ENROLLED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN}

DEFINITIONS = {
    "backlog": "Open work at the end of each week: team tasks (not the student's own to-dos) not yet done, document versions "
               "not yet reviewed, and essays submitted for review and not yet reviewed (current review round).",
    "ageing": "Days since the case last moved: the latest of a pipeline stage change, an application status change or the "
              "assignment to this agency.",
    "load": "Weighted load per person: each kind of open work they hold × its weight (the agency's weight table), against their "
            "personal capacity in the same points. Overloaded = load above capacity. People on leave are not assigned new work.",
    "sla": "First reply not given by its due time; documents waiting for review longer than 48 hours; essay reviews past "
           "the promised review time.",
    "deadlines": "Applications not yet submitted whose deadline is within 14 days and that still miss required items.",
    "stages": "Median days an application stayed in a status before moving on (stays that ended in the last 365 days). "
              f"Withheld below {MIN_DENOMINATOR} stays.",
    "blocked": "A case is blocked when it waits on someone (any party except nobody) and has not moved for more than 14 days. "
               "Oldest first.",
    "unassigned_paid": "Paid for a Hangyul service, and no counselor owns the case (or, for Hangyul, no agency is assigned yet).",
}
BLOCKED_DAYS = 14

# V9 weighted load (REPORT §59 A4). Weights are per agency (Organization.load_weights), editable by owners/managers.
LOAD_WEIGHTS = {
    "active_applications": 1,     # applications not yet final for the person's students
    "deadlines_14d": 2,           # applications not yet submitted with a deadline within 14 days
    "document_reviews": 1,        # documents waiting for review that are theirs (named reviewer, or their student with none)
    "writing_reviews": 2,         # essays waiting for their review
    "visa_cases": 2,              # their students' visa cases in progress
    "service_cases": 1,           # open service cases they own
    "conversations_waiting": 1,   # their students waiting for a reply
}
WEIGHT_KEYS = tuple(LOAD_WEIGHTS)
WEIGHT_MAX = 10
SLA_RISK_HOURS = 24


def weights_for(org: Organization | None) -> dict[str, int]:
    w = dict(LOAD_WEIGHTS)
    for k, v in ((org.load_weights or {}) if org else {}).items():
        if k in w and isinstance(v, (int, float)):
            w[k] = int(v)
    return w


def member_loads(db: Session, org_id: uuid.UUID, now: datetime | None = None, *, include_inactive: bool = False) -> dict:
    """Per-person open work by kind, weighted load, capacity and SLA risk for one agency (set-based, a fixed number of
    queries). People = active members who hold cases or reviews (counselors, managers, owners, reviewers)."""
    from app.models import Conversation, VisaCase
    from app.models.enums import EssayStatus, VisaStatus
    from app.models.v5_concierge import ServiceCase
    from app.services import concierge as concierge_svc
    from app.services import waiting

    now = now or utcnow()
    org = db.get(Organization, org_id)
    w = weights_for(org)
    q = select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org_id)
    if not include_inactive:
        q = q.where(OrganizationMember.is_active.is_(True))
    members = db.execute(q).all()
    active = db.execute(select(AgencyAssignment.student_user_id, AgencyAssignment.counselor_user_id, AgencyAssignment.first_response_at,
                               AgencyAssignment.first_response_due_at)
                        .where(AgencyAssignment.organization_id == org_id, AgencyAssignment.status == AssignmentStatus.ACTIVE)).all()
    counselor_of = {a.student_user_id: a.counselor_user_id for a in active}
    sids = list(counselor_of)
    counts: dict[uuid.UUID, Counter] = defaultdict(Counter)
    risk: dict[uuid.UUID, Counter] = defaultdict(Counter)
    for a in active:
        if a.counselor_user_id:
            counts[a.counselor_user_id]["cases"] += 1
            if a.first_response_at is None and a.first_response_due_at and a.first_response_due_at < now + timedelta(hours=SLA_RISK_HOURS):
                risk[a.counselor_user_id]["first_reply"] += 1
    if sids:
        final = [ApplicationStatus.ENROLLED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]
        for sid, n in db.execute(select(Application.student_user_id, func.count()).where(Application.student_user_id.in_(sids), Application.status.notin_(final))
                                 .group_by(Application.student_user_id)).all():
            if counselor_of.get(sid):
                counts[counselor_of[sid]]["active_applications"] += n
        for sid, n in db.execute(select(Application.student_user_id, func.count()).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
                                 .where(Application.student_user_id.in_(sids), Application.status.in_(caseload.PRE_SUBMIT),
                                        ProgramIntake.application_deadline >= now.date(), ProgramIntake.application_deadline <= (now + timedelta(days=14)).date())
                                 .group_by(Application.student_user_id)).all():
            if counselor_of.get(sid):
                counts[counselor_of[sid]]["deadlines_14d"] += n
        cut = now - timedelta(hours=caseload.REVIEW_SLA_HOURS)
        for sid, rev, upd in db.execute(select(Document.owner_user_id, Document.reviewer_user_id, Document.updated_at)
                                        .where(Document.owner_user_id.in_(sids), Document.status.in_(caseload.REVIEW_DOCS))).all():
            who = rev or counselor_of.get(sid)
            if who:
                counts[who]["document_reviews"] += 1
                if upd < cut:
                    risk[who]["document_review"] += 1
        review_states = [EssayStatus(x) for x in waiting.ESSAY_REVIEW]
        for rev, in db.execute(select(Essay.reviewer_user_id).where(Essay.owner_user_id.in_(sids), Essay.status.in_(review_states),
                                                                     Essay.reviewer_user_id.is_not(None))).all():
            counts[rev]["writing_reviews"] += 1
        visa_active = [VisaStatus.DOCUMENT_PREPARATION, VisaStatus.READY_TO_APPLY, VisaStatus.SUBMITTED, VisaStatus.ADDITIONAL_DOCUMENTS]
        for sid, n in db.execute(select(VisaCase.student_user_id, func.count()).where(VisaCase.student_user_id.in_(sids), VisaCase.status.in_(visa_active))
                                 .group_by(VisaCase.student_user_id)).all():
            if counselor_of.get(sid):
                counts[counselor_of[sid]]["visa_cases"] += n
        for sid in db.scalars(select(Conversation.student_user_id).where(Conversation.student_user_id.in_(sids),
                                                                         Conversation.student_user_id.in_(waiting.replies_waiting_students()))).all():
            if counselor_of.get(sid):
                counts[counselor_of[sid]]["conversations_waiting"] += 1
    for c in db.scalars(select(ServiceCase).where(ServiceCase.owner_user_id.in_([u.id for _m, u in members]), ServiceCase.closed_at.is_(None))).all():
        if concierge_svc.is_closed(c):
            continue
        counts[c.owner_user_id]["service_cases"] += 1
        if concierge_svc.is_overdue(c, now):
            risk[c.owner_user_id]["service"] += 1
    holders_roles = (Role.AGENCY_ADMIN,)
    people = []
    today = now.date()
    for m, u in members:
        c = counts.get(u.id, Counter())
        if m.role not in holders_roles and not sum(c.values()):
            continue
        work = {k: c.get(k, 0) for k in WEIGHT_KEYS}
        points = sum(w[k] * work[k] for k in WEIGHT_KEYS)
        cap = m.capacity_points
        on_leave = bool(m.on_leave_until and m.on_leave_until >= today)
        r = risk.get(u.id, Counter())
        people.append({
            "user_id": str(u.id), "name": u.full_name, "email": u.email, "role": m.role.value, "title": m.title, "active": m.is_active,
            "cases": c.get("cases", 0), "work": work, "points": points, "capacity": cap,
            "load": round(points / cap, 3) if cap else None, "overloaded": bool(cap and points > cap),
            "available": m.is_active and not on_leave, "on_leave_until": m.on_leave_until.isoformat() if on_leave else None,
            "sla_risk": sum(r.values()), "sla_risk_by": dict(r),
            "languages": m.languages or [], "countries": m.countries or [], "university_ids": m.university_ids or [],
            "degrees": m.degrees or [], "majors": m.majors or [], "leave_note": m.leave_note if on_leave else None,
        })
    people.sort(key=lambda r: (-(r["load"] or 0), -r["sla_risk"], r["name"]))
    unassigned = sum(1 for a in active if a.counselor_user_id is None)
    return {"weights": w, "default_weights": LOAD_WEIGHTS, "weight_keys": list(WEIGHT_KEYS), "people": people, "unassigned_cases": unassigned,
            "definition": DEFINITIONS["load"]}


def agency_identity(db: Session, student_user_id: uuid.UUID, application: Application | None = None) -> dict | None:
    """REPORT §59 A12 / research §9 #12: who is responsible for this applicant — the agency's legal identity, its
    registration status ("NOT_RECORDED" until a real registration is recorded; seed placeholders never count), the
    responsible counselor and any sub-agent. Additive helper; the university workstream can embed it in its payloads."""
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    org_id = a.organization_id if a else (application.agency_org_id if application is not None else None)
    if org_id is None:
        return None
    org = db.get(Organization, org_id)
    if org is None:
        return None
    counselor = db.get(User, a.counselor_user_id) if a and a.counselor_user_id else None
    recorded = org.registration_status in ("RECORDED", "VERIFIED")
    return {
        "agency_id": str(org.id), "trading_name": org.name, "legal_name": org.legal_name, "country_code": org.country_code,
        "registration": {"status": org.registration_status if recorded else "NOT_RECORDED",
                         "number": org.registration_number if recorded else None,
                         "authority": org.registration_authority if recorded else None,
                         "checked_on": org.registration_checked_on.isoformat() if recorded and org.registration_checked_on else None},
        "responsible_counselor": {"id": str(counselor.id), "name": counselor.full_name} if counselor else None,
        "sub_agent": a.sub_agent_name if a else None,
        "note": "Korea's announced Certificate-of-Admission agency field (draft, H2-2026) is not law yet; this is the record we hold.",
    }


def _days(now: datetime, at: datetime | None) -> int:
    if at is None:
        return 0
    return max(0, int((now - at).total_seconds() // 86400))


def bucket_of(days: int) -> str:
    for key, lo, hi in BUCKETS:
        if days >= lo and (hi is None or days <= hi):
            return key
    return "30_plus"


def scope_assignments(org_id: uuid.UUID | None):
    """Active assignments of one agency (or every agency for Hangyul without a filter)."""
    stmt = select(AgencyAssignment).where(AgencyAssignment.status == AssignmentStatus.ACTIVE)
    if org_id:
        stmt = stmt.where(AgencyAssignment.organization_id == org_id)
    return stmt


def last_moved(db: Session, ids: list[uuid.UUID], assigned_at: dict[uuid.UUID, datetime], now: datetime) -> dict[uuid.UUID, datetime]:
    """Latest movement per student: stage change (audit), application status change, or the assignment itself."""
    out: dict[uuid.UUID, datetime] = {sid: at for sid, at in assigned_at.items() if at}
    if not ids:
        return out

    def bump(sid, at):
        if at is None:
            return
        at = min(at, now)  # seed data may carry future-dated history; never age a case below zero
        if sid not in out or at > out[sid]:
            out[sid] = at

    for sid, at in db.execute(select(Application.student_user_id, func.max(ApplicationStatusHistory.created_at))
                              .join(ApplicationStatusHistory, ApplicationStatusHistory.application_id == Application.id)
                              .where(Application.student_user_id.in_(ids)).group_by(Application.student_user_id)).all():
        bump(sid, at)
    for sid, at in db.execute(select(AuditLog.subject_user_id, func.max(AuditLog.created_at))
                              .where(AuditLog.subject_user_id.in_(ids), AuditLog.action.in_(["student.stage", "student.bulk.set_stage"]))
                              .group_by(AuditLog.subject_user_id)).all():
        bump(sid, at)
    return out


# ----------------------------------------------------------------------------------------------- sections

def _backlog(db: Session, org_id, student_ids: list[uuid.UUID], now: datetime, weeks: int = 8) -> dict:
    ends = [now - timedelta(days=7 * i) for i in range(weeks - 1, -1, -1)]
    start = ends[0] - timedelta(days=400)

    # Team tasks: not student to-dos, owned by the agency (Hangyul all-agency view: any agency's staff tasks).
    t_stmt = select(Task.created_at, Task.completed_at, Task.updated_at, Task.status).where(Task.visible_to_student.is_(False), Task.created_at >= start)
    t_stmt = t_stmt.where(Task.owner_org_id == org_id) if org_id else t_stmt.where(Task.owner_org_id.in_(select(Organization.id).where(Organization.type == "AGENCY")))
    tasks = []
    for created, done, updated, st in db.execute(t_stmt).all():
        closed = done or (updated if st not in OPEN else None)
        tasks.append((created, closed))

    docs = []
    if student_ids:
        versions = db.execute(select(DocumentVersion.document_id, DocumentVersion.version, DocumentVersion.created_at, Document.status, Document.updated_at)
                              .join(Document, Document.id == DocumentVersion.document_id)
                              .where(Document.owner_user_id.in_(student_ids))).all()
        reviews: dict[tuple, datetime] = {}
        for did, ver, at in db.execute(select(DocumentReview.document_id, DocumentReview.version, func.min(DocumentReview.created_at))
                                       .join(Document, Document.id == DocumentReview.document_id)
                                       .where(Document.owner_user_id.in_(student_ids), DocumentReview.decision != "AI_PRECHECK")
                                       .group_by(DocumentReview.document_id, DocumentReview.version)).all():
            reviews[(did, ver)] = at
        by_doc: dict = defaultdict(list)
        for did, ver, created, st, upd in versions:
            by_doc[did].append((ver, created, st, upd))
        for did, vs in by_doc.items():
            vs.sort()
            for i, (ver, created, st, upd) in enumerate(vs):
                closed = reviews.get((did, ver))
                nxt = vs[i + 1][1] if i + 1 < len(vs) else None
                if nxt and (closed is None or nxt < closed):
                    closed = nxt
                if closed is None and i == len(vs) - 1 and st.value not in caseload.REVIEW_DOCS:
                    closed = upd  # reviewed outside the review log (e.g. imported) — closed when the document last changed
                docs.append((created, closed))

    essays = []
    if student_ids:
        from app.services.writing import REVIEW_STATES

        for submitted, reviewed, st in db.execute(select(EssayReview.submitted_at, EssayReview.last_reviewed_at, Essay.status)
                                                  .join(Essay, Essay.id == EssayReview.essay_id)
                                                  .where(Essay.owner_user_id.in_(student_ids), EssayReview.submitted_at.is_not(None))).all():
            closed = reviewed if reviewed and reviewed >= submitted else (None if st in REVIEW_STATES else submitted)
            essays.append((submitted, closed))

    def open_at(rows, w):
        return sum(1 for c, x in rows if c and c <= w and (x is None or x > w))

    points = [{"week_end": w.date().isoformat(), "tasks": open_at(tasks, w), "documents": open_at(docs, w), "essays": open_at(essays, w)} for w in ends]
    for p in points:
        p["total"] = p["tasks"] + p["documents"] + p["essays"]
    first, last = points[0]["total"], points[-1]["total"]
    return {"weeks": points, "change": last - first,
            "links": {"tasks": "/tasks?view=team", "documents": "/documents", "essays": "/essays?view=team"}}


def _ageing(db: Session, rows: list[dict], now: datetime) -> dict:
    phases = []
    for key, stages in PHASES:
        mine = [r for r in rows if r["phase"] == key]
        counts = Counter(r["bucket"] for r in mine)
        phases.append({"phase": key, "stages": stages, "total": len(mine), "buckets": {b: counts.get(b, 0) for b, _, _ in BUCKETS}})
    moving = sorted(rows, key=lambda r: -r["days"])
    return {"phases": phases, "buckets": [b for b, _, _ in BUCKETS], "students": moving, "oldest": moving[0] if moving else None}


def _load(db: Session, org_id, now: datetime, active: list[AgencyAssignment]) -> dict | None:
    """V9: weighted load per person (member_loads) — the same numbers as the Team page."""
    if not org_id:
        return None
    org = db.get(Organization, org_id)
    ml = member_loads(db, org_id, now)
    t_open = dict(db.execute(select(Task.owner_user_id, func.count()).where(Task.owner_org_id == org_id, Task.status.in_(OPEN))
                             .group_by(Task.owner_user_id)).all())
    t_over = dict(db.execute(select(Task.owner_user_id, func.count()).where(Task.owner_org_id == org_id, Task.status.in_(OPEN), Task.due_at < now)
                             .group_by(Task.owner_user_id)).all())
    total = sum(r["cases"] for r in ml["people"])
    out = []
    for r in ml["people"]:
        uid = uuid.UUID(r["user_id"])
        out.append({**r, "active_cases": r["cases"], "open_tasks": t_open.get(uid, 0), "overdue_tasks": t_over.get(uid, 0),
                    "share": round(r["cases"] / total, 3) if total else None})
    return {"capacity_total": org.capacity_active_cases if org else None, "capacity_per_counselor": None, "active_total": total,
            "unassigned": ml["unassigned_cases"], "counselors": out, "weights": ml["weights"], "weight_keys": ml["weight_keys"],
            "overloaded": [r["name"] for r in out if r["overloaded"]]}


def _sla(db: Session, p, org_id, ids: list[uuid.UUID], names: dict, now: datetime) -> dict:
    fr = db.scalars(scope_assignments(org_id).where(AgencyAssignment.first_response_at.is_(None), AgencyAssignment.first_response_due_at < now)
                    .order_by(AgencyAssignment.first_response_due_at)).all()
    first = [{"student_id": str(a.student_user_id), "student": names.get(a.student_user_id), "since": iso(a.first_response_due_at),
              "hours": int((now - a.first_response_due_at).total_seconds() // 3600), "link": f"/students/{a.student_user_id}?tab=messages"} for a in fr]
    cut = now - timedelta(hours=caseload.REVIEW_SLA_HOURS)
    docs = db.scalars(select(Document).where(Document.owner_user_id.in_(ids), Document.status.in_(caseload.REVIEW_DOCS), Document.updated_at < cut)
                      .order_by(Document.updated_at)).all() if ids else []
    documents = [{"document_id": str(d.id), "student_id": str(d.owner_user_id), "student": names.get(d.owner_user_id), "category": d.category.value,
                  "since": iso(d.updated_at), "hours": int((now - d.updated_at).total_seconds() // 3600), "link": f"/documents?doc={d.id}"} for d in docs]
    from app.services import writing as writing_svc

    idset = {str(i) for i in ids}
    essays = [{"essay_id": w["essay_id"], "student_id": w["student"]["id"], "student": w["student"]["name"], "essay_type": w["essay_type"],
               "university": w["university"], "since": w["due_at"], "reviewer": w["reviewer"], "link": w["link"],
               "hours": int((now - datetime.fromisoformat(w["due_at"])).total_seconds() // 3600) if w["due_at"] else None}
              for w in writing_svc.today_items(db, p) if w["kind"] == "WRITING_OVERDUE" and w["student"]["id"] in idset]
    return {
        "first_response": {"count": len(first), "items": first, "link": "/students?sla=1"},
        "document_review": {"count": len(documents), "items": documents, "sla_hours": caseload.REVIEW_SLA_HOURS, "link": "/documents"},
        "essay_review": {"count": len(essays), "items": essays, "link": "/essays?view=overdue"},
    }


def _deadlines(db: Session, ids: list[uuid.UUID], names: dict, counselor_of: dict, now: datetime, days: int = 14) -> dict:
    from app.services.readiness import application_readiness

    if not ids:
        return {"count": 0, "items": [], "days": days}
    rows = db.execute(select(Application, ProgramIntake.application_deadline, University.name_en, Program.name_en)
                      .join(ProgramIntake, ProgramIntake.id == Application.intake_id)
                      .join(University, University.id == Application.university_id)
                      .join(Program, Program.id == Application.program_id)
                      .where(Application.student_user_id.in_(ids), Application.status.in_(caseload.PRE_SUBMIT),
                             ProgramIntake.application_deadline >= now.date(), ProgramIntake.application_deadline <= (now + timedelta(days=days)).date())
                      .order_by(ProgramIntake.application_deadline)).all()
    profiles = {pr.user_id: pr for pr in db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_({a.student_user_id for a, *_ in rows})))}
    items = []
    for a, deadline, uni, prog in rows:
        _pct, checklist = application_readiness(db, a, profiles.get(a.student_user_id), now.date())
        missing = [i for i in checklist if i["required"] and not i["ready"]]
        from app.services.guides import state_for as guide_state

        guide_review = not checklist and guide_state(db, a)["state"] == "REVIEW_REQUIRED"
        if not missing and not guide_review:
            continue
        items.append({"application_id": str(a.id), "student_id": str(a.student_user_id), "student": names.get(a.student_user_id),
                      "university": uni, "program": prog, "deadline": deadline.isoformat(), "days_left": (deadline - now.date()).days,
                      "items_remaining": None if guide_review else len(missing), "guide_review": guide_review, "status": a.status.value, "counselor": counselor_of.get(a.student_user_id),
                      "link": f"/students/{a.student_user_id}?tab=applications"})
    return {"count": len(items), "items": items, "days": days}


def _stages(db: Session, org_id, now: datetime) -> list[dict]:
    app_q = select(Application.id).where(*([Application.agency_org_id == org_id] if org_id else [Application.agency_org_id.is_not(None)]))
    hist = db.execute(select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status, ApplicationStatusHistory.created_at)
                      .where(ApplicationStatusHistory.application_id.in_(app_q)).order_by(ApplicationStatusHistory.application_id, ApplicationStatusHistory.created_at)).all()
    by_app: dict = defaultdict(list)
    for aid, st, at in hist:
        by_app[aid].append((st, at))
    since = now - timedelta(days=365)
    spans: dict = defaultdict(list)
    for steps in by_app.values():
        for (st, at), (_nx, nat) in zip(steps, steps[1:]):
            if since <= nat <= now and nat >= at:
                spans[st].append((nat - at).total_seconds() / 86400)
    current = dict(db.execute(select(Application.status, func.count()).where(Application.id.in_(app_q)).group_by(Application.status)).all())
    out = []
    for st in ApplicationStatus:
        if st in TERMINAL:
            continue
        vals = spans.get(st, [])
        if not vals and not current.get(st):
            continue
        enough = len(vals) >= MIN_DENOMINATOR
        out.append({"status": st.value, "median_days": round(statistics.median(vals), 1) if enough else None, "n": len(vals),
                    "insufficient_data": not enough, "current": current.get(st, 0), "link": f"/applications?status={st.value}"})
    out.sort(key=lambda r: (r["median_days"] is None, -(r["median_days"] or 0), -r["current"]))
    return out


def overview(db: Session, p, org_id: uuid.UUID | None) -> dict:
    now = utcnow()
    active = db.scalars(scope_assignments(org_id)).all()
    ids = [a.student_user_id for a in active]
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(ids))).all()) if ids else {}
    counselors = {a.student_user_id: a.counselor_user_id for a in active}
    cnames = dict(db.execute(select(User.id, User.full_name).where(User.id.in_({c for c in counselors.values() if c}))).all()) if ids else {}
    counselor_of = {sid: ({"id": str(c), "name": cnames.get(c)} if c else None) for sid, c in counselors.items()}
    profiles = dict(db.execute(select(StudentProfile.user_id, StudentProfile.pipeline_stage).where(StudentProfile.user_id.in_(ids))).all()) if ids else {}
    moved = last_moved(db, ids, {a.student_user_id: a.created_at for a in active}, now)

    case_rows = []
    for sid in ids:
        stage = profiles.get(sid)
        phase = PHASE_OF.get(stage.value) if stage else None
        if not phase:
            continue
        d = _days(now, moved.get(sid))
        case_rows.append({"student_id": str(sid), "student": names.get(sid), "stage": stage.value, "phase": phase, "days": d,
                          "bucket": bucket_of(d), "since": iso(moved.get(sid)), "counselor": counselor_of.get(sid),
                          "link": f"/students/{sid}"})

    blocked = _blocked(db, case_rows, now)
    unpaid = _unassigned_paid(db, org_id, now)
    load = _load(db, org_id, now, active)
    sla = _sla(db, p, org_id, ids, names, now)
    deadlines = _deadlines(db, ids, names, counselor_of, now)
    stages = _stages(db, org_id, now)
    slowest = next((s for s in stages if s["median_days"] is not None), None)
    questions = {
        "oldest_blocked": {"count": blocked["count"], "top": blocked["items"][0] if blocked["items"] else None, "link": "#blocked"},
        "overloaded": {"count": len(load["overloaded"]) if load else None, "top": next((r for r in (load or {}).get("counselors", []) if r["overloaded"]), None),
                       "link": "#load"},
        "sla_breaches": {"count": sum(v["count"] for v in sla.values()), "link": "#sla"},
        "deadline_risk": {"count": deadlines["count"], "top": deadlines["items"][0] if deadlines["items"] else None, "link": "#deadlines"},
        "slowest_stage": {"top": slowest, "link": "#stages"},
        "unassigned_paid": {"count": unpaid["count"], "top": unpaid["items"][0] if unpaid["items"] else None, "link": "#unassigned_paid"},
    }
    return {
        "generated_at": iso(now),
        "questions": questions,
        "blocked": blocked,
        "unassigned_paid": unpaid,
        "agency_id": str(org_id) if org_id else None,
        "min_n": MIN_DENOMINATOR,
        "definitions": DEFINITIONS,
        "backlog": _backlog(db, org_id, ids, now),
        "ageing": _ageing(db, case_rows, now),
        "load": load,
        "sla": sla,
        "deadlines": deadlines,
        "stages": stages,
    }


def _blocked(db: Session, case_rows: list[dict], now: datetime) -> dict:
    """Cases that wait on someone and have not moved for more than BLOCKED_DAYS (oldest first), with who and why."""
    from app.services import waiting

    old = [r for r in case_rows if r["days"] > BLOCKED_DAYS]
    parties = waiting.evaluate(db, [uuid.UUID(r["student_id"]) for r in old], now)
    items = []
    for r in sorted(old, key=lambda r: -r["days"]):
        party, code = parties.get(uuid.UUID(r["student_id"]), (waiting.NONE, None))
        if party == waiting.NONE:
            continue
        items.append({**r, "waiting_on": party, "reason": code})
    return {"count": len(items), "days": BLOCKED_DAYS, "items": items}


def _unassigned_paid(db: Session, org_id, now: datetime) -> dict:
    """Paid service purchases whose case has no counselor (agency) or no agency at all (Hangyul, all agencies)."""
    from app.models import ServiceProduct
    from app.models.business import Order
    from app.models.enums import OrderStatus

    paid = db.execute(select(Order.user_id, func.min(Order.paid_at), func.max(ServiceProduct.name_en)).join(ServiceProduct, ServiceProduct.id == Order.product_id)
                      .where(Order.status == OrderStatus.PAID).group_by(Order.user_id)).all()
    if not paid:
        return {"count": 0, "items": []}
    uids = [u for u, *_ in paid]
    assign = {a.student_user_id: a for a in db.scalars(select(AgencyAssignment).where(AgencyAssignment.student_user_id.in_(uids),
                                                                                       AgencyAssignment.status == AssignmentStatus.ACTIVE)).all()}
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(uids))).all())
    items = []
    for uid, paid_at, product in paid:
        a = assign.get(uid)
        if org_id:
            if not a or a.organization_id != org_id or a.counselor_user_id is not None:
                continue
            what = "no_counselor"
        else:
            if a and a.counselor_user_id is not None:
                continue
            what = "no_agency" if a is None else "no_counselor"
        items.append({"student_id": str(uid), "student": names.get(uid), "paid_at": iso(paid_at), "days": _days(now, paid_at), "product": product,
                      "missing": what, "link": f"/students/{uid}" if a else f"/hq/assignments?student={uid}"})
    items.sort(key=lambda r: -r["days"])
    return {"count": len(items), "items": items}
