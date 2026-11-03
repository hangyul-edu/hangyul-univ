"""V8 agency operations: Today's ranked queue, a case's "why is this not moving?", and the manager Operations view.

* GET /agency/today/queue            — "Who needs me now?" ranked with plain reasons (services/priority.py states the rule)
* GET /agency/students/{id}/movement — why this case is not moving + what happens next (workspace top)
* GET /agency/ops                    — manager Operations (services/agency_ops.py): backlog, ageing, load, SLA, deadlines, stages
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.common import iso, parse_uuid
from app.core.audit import audit
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.models import AgencyAssignment, Application, Organization, OrganizationMember, ProgramIntake, StudentProfile, Task, University, User
from app.models.base import utcnow
from app.models.enums import AssignmentStatus, Role
from app.models.student import Appointment
from app.services import agency_ops, caseload, priority
from app.services.access import agency_student_ids_subquery, ensure_student_access, forbidden

router = APIRouter(tags=["v8", "agency"])

MANAGERS = (Role.AGENCY_ADMIN,)  # V22


def _scope_ids(db: Session, p: Principal, scope: str) -> list:
    if p.is_hangyul and not p.is_agency:
        stmt = select(AgencyAssignment.student_user_id).where(AgencyAssignment.status == AssignmentStatus.ACTIVE)
        if scope == "mine":
            stmt = stmt.where(AgencyAssignment.counselor_user_id == p.id)
        return list(db.scalars(stmt).all())
    stmt = agency_student_ids_subquery(p)
    if scope == "mine":
        stmt = stmt.where(AgencyAssignment.counselor_user_id == p.id)
    return list(db.scalars(stmt).all())


@router.get("/agency/today/queue")
def today_queue(scope: str | None = Query(None, pattern="^(mine|team)$"), limit: int = Query(40, ge=1, le=200),
                type: str | None = Query(None, pattern="^(" + "|".join(priority.WORK_TYPES) + ")$"),  # noqa: A002 — public query name
                state: str | None = Query(None, pattern="^(" + "|".join(priority.STATES) + ")$"),
                p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Ranked "who needs me now". Counselors see their own cases; managers default to the team (scope=mine narrows).

    V9: `type` filters the same ranked list to one work type (`by_type` = each type's row count).
    V13: `state` filters it to one operational state — urgent, ours to do, or waiting on the student or the
    university (`by_state`). `state` is what Today's chips now offer, because at a real caseload the nine work
    types are nine double-digit numbers; `type` moved behind one Filter control. They compose: a state and a
    type together narrow the same list with the same rule, and every count still equals the rows it shows."""
    is_manager = p.has(*MANAGERS) or p.is_hangyul
    eff = scope or ("team" if is_manager else "mine")
    if eff == "team" and not is_manager:
        eff = "mine"
    out = priority.ranked(db, p, _scope_ids(db, p, eff), limit=limit, work_type=type, state=state)
    return {**out, "scope": eff}


@router.get("/agency/students/{student_id}/movement")
def movement(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Why this case is not moving (who must act, the reasons, days since it last moved) and what happens next."""
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    now = utcnow()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == sid))
    user = db.get(User, sid)
    if not prof or not user:
        raise forbidden()
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == sid, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    moved = agency_ops.last_moved(db, [sid], {sid: a.created_at} if a else {}, now).get(sid)
    row = caseload.build_rows(db, [(prof, user)], now)[0]
    reasons = sorted(priority.collect(db, p, [sid], now).get(sid, []), key=lambda r: (r["tier"], r["at"] or "9999"))

    nxt = []
    for t in db.scalars(select(Task).where(Task.student_user_id == sid, Task.status.in_(caseload.OPEN))
                        .order_by(Task.due_at.asc().nulls_last()).limit(4)).all():
        nxt.append({"kind": "task", "title": t.title, "title_key": t.title_key, "title_params": t.title_params, "due_at": iso(t.due_at),
                    "overdue": bool(t.due_at and t.due_at < now), "student_side": t.visible_to_student, "link": f"/students/{sid}?tab=tasks"})
    for ap in db.scalars(select(Appointment).where(Appointment.student_user_id == sid, Appointment.status == "SCHEDULED",
                                                   Appointment.starts_at >= now - timedelta(hours=1)).order_by(Appointment.starts_at).limit(2)).all():
        nxt.append({"kind": "meeting", "meeting_kind": ap.kind, "channel": ap.channel, "due_at": iso(ap.starts_at), "overdue": False,
                    "link": f"/tasks?view=meetings&student={sid}"})
    for app_, deadline, uni in db.execute(select(Application, ProgramIntake.application_deadline, University.name_en)
                                          .join(ProgramIntake, ProgramIntake.id == Application.intake_id)
                                          .join(University, University.id == Application.university_id)
                                          .where(Application.student_user_id == sid, Application.status.in_(caseload.PRE_SUBMIT),
                                                 ProgramIntake.application_deadline >= now.date())
                                          .order_by(ProgramIntake.application_deadline).limit(2)).all():
        nxt.append({"kind": "deadline", "university": uni, "due_at": deadline.isoformat(), "overdue": False,
                    "days": (deadline - now.date()).days, "link": f"/students/{sid}?tab=applications"})
    nxt.sort(key=lambda x: (not x["overdue"], x["due_at"] or "9999"))
    return {
        "student_id": str(sid),
        "stage": prof.pipeline_stage.value,
        "last_moved_at": iso(moved),
        "days_since_moved": max(0, (now - moved).days) if moved else None,
        "waiting_on": row["waiting_on"], "waiting_reason": row["waiting_reason"],
        # V9 workspace header: why it is not moving · next action · waiting on · deadline · owner (services/waiting.py).
        "owner": row["waiting_owner"], "next_action": row["next_action"], "deadline": row["next_deadline"], "counselor": row["counselor"],
        "agency_identity": agency_ops.agency_identity(db, sid),
        "reasons": reasons,
        "next": nxt[:6],
        "definition": agency_ops.DEFINITIONS["ageing"],
    }


@router.get("/agency/applications/remaining")
def applications_remaining(ids: list[str] = Query(..., max_length=100), p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """V8: "N items remain" for a page of applications (replaces readiness % in agency lists). Applications outside the
    caller's tenant are silently left out; submitted ones have no remaining items (null)."""
    from app.services.access import scope_applications
    from app.services.readiness import application_readiness

    uids = [parse_uuid(i) for i in ids]
    apps = db.scalars(scope_applications(select(Application).where(Application.id.in_(uids)), p)).all()
    profs = {pr.user_id: pr for pr in db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_({a.student_user_id for a in apps})))} if apps else {}
    today = utcnow().date()
    out, remaining = {}, {}
    for a in apps:
        if a.status not in caseload.PRE_SUBMIT:
            out[str(a.id)] = {"items_remaining": None, "items_in_review": None}
            continue
        _pct, items = application_readiness(db, a, profs.get(a.student_user_id), today)
        open_items = [i for i in items if i["required"] and not i["ready"]]
        from app.services.guides import state_for as guide_state

        if guide_state(db, a)["state"] == "REVIEW_REQUIRED":  # V27: nothing to count yet — never "0 left"
            out[str(a.id)] = {"items_remaining": None, "items_in_review": None, "guide_review": True}
            continue
        out[str(a.id)] = {"items_remaining": len(open_items), "items_in_review": sum(1 for i in open_items if i["action_code"] == "IN_REVIEW")}
        remaining[a.id] = (out[str(a.id)]["items_remaining"], out[str(a.id)]["items_in_review"])
    # V9: the same waiting-on vocabulary as the caseload (party + reason, live submission signals).
    for aid, (party, code) in caseload.applications_waiting(db, list(apps), remaining).items():
        out[str(aid)]["waiting_on"] = None if party == "none" else party
        out[str(aid)]["waiting_reason"] = code
    return out


@router.get("/agency/ops")
def operations(agency_id: str | None = None, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Manager Operations. Agency owners/managers see their agency; Hangyul staff any agency (or all with no agency_id)."""
    if p.is_agency:
        if not p.has(*MANAGERS):
            raise forbidden()
        org = p.org_id
    else:
        org = parse_uuid(agency_id) if agency_id else None
    return agency_ops.overview(db, p, org)


# ============================================================================================ V9 team (REPORT §59 A4)

class MemberIn(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    languages: list[str] | None = Field(default=None, max_length=20)
    countries: list[str] | None = Field(default=None, max_length=40)
    university_ids: list[str] | None = Field(default=None, max_length=60)
    degrees: list[str] | None = Field(default=None, max_length=10)
    majors: list[str] | None = Field(default=None, max_length=30)
    capacity_points: int | None = Field(default=None, ge=0, le=1000)
    on_leave_until: date | None = None
    leave_note: str | None = Field(default=None, max_length=200)


def _require_manager(p: Principal) -> None:
    if not (p.is_agency and p.has(*MANAGERS)):
        raise forbidden()


def _member(db: Session, p: Principal, user_id: str) -> tuple[OrganizationMember, User]:
    row = db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id)
                     .where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == parse_uuid(user_id))).first()
    if not row:
        raise forbidden()
    return row[0], row[1]


@router.patch("/agency/team/members/{user_id}")
def update_member(user_id: str, body: MemberIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Owners/managers edit a person's expertise, availability and capacity (only the fields sent). Audited."""
    _require_manager(p)
    m, u = _member(db, p, user_id)
    data = body.model_dump(exclude_unset=True)
    if "countries" in data and data["countries"] is not None:
        data["countries"] = sorted({c.upper()[:2] for c in data["countries"] if c})
    if "university_ids" in data and data["university_ids"] is not None:
        data["university_ids"] = [str(parse_uuid(x)) for x in data["university_ids"]]
    if "degrees" in data and data["degrees"] is not None:
        from app.models.enums import DegreeLevel

        allowed = {d.value for d in DegreeLevel}
        bad = [d for d in data["degrees"] if d not in allowed]
        if bad:
            raise HTTPException(422, f"Unknown degree levels: {', '.join(bad)}")
    for k, v in data.items():
        setattr(m, k, v)
    audit(db, action="team.member.update", entity_type="organization_member", entity_id=m.id, actor=p,
          detail={k: (v.isoformat() if isinstance(v, date) else v) for k, v in data.items()})
    db.commit()
    return {"ok": True, "user_id": str(u.id)}


class WeightsIn(BaseModel):
    weights: dict[str, int]


@router.put("/agency/team/weights")
def update_weights(body: WeightsIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """The agency's load weight table (owners/managers). Unknown keys are refused; each weight 0–WEIGHT_MAX."""
    _require_manager(p)
    bad = set(body.weights) - set(agency_ops.WEIGHT_KEYS)
    if bad:
        raise HTTPException(422, f"Unknown weights: {', '.join(sorted(bad))}")
    if any(v < 0 or v > agency_ops.WEIGHT_MAX for v in body.weights.values()):
        raise HTTPException(422, f"Each weight must be between 0 and {agency_ops.WEIGHT_MAX}.")
    org = db.get(Organization, p.org_id)
    before = agency_ops.weights_for(org)
    org.load_weights = {**before, **body.weights}
    audit(db, action="team.weights.update", entity_type="organization", entity_id=org.id, actor=p, detail={"before": before, "after": org.load_weights})
    db.commit()
    return {"weights": agency_ops.weights_for(org)}


OPEN_ITEM_KINDS = ("students", "reviews", "essays", "tasks", "services")


def _open_items(db: Session, org_id, uid) -> dict:
    """Everything a person holds that would be orphaned if they left: their students, document reviews, essay reviews,
    open tasks and open service cases."""
    from app.models import Document, Essay
    from app.models.v5_concierge import ServiceCase
    from app.services import concierge as concierge_svc
    from app.services import waiting

    students = db.execute(select(AgencyAssignment.id, User.id, User.full_name).join(User, User.id == AgencyAssignment.student_user_id)
                          .where(AgencyAssignment.organization_id == org_id, AgencyAssignment.status == AssignmentStatus.ACTIVE,
                                 AgencyAssignment.counselor_user_id == uid).order_by(User.full_name)).all()
    org_students = select(AgencyAssignment.student_user_id).where(AgencyAssignment.organization_id == org_id, AgencyAssignment.status == AssignmentStatus.ACTIVE)
    reviews = db.execute(select(Document.id, Document.category, User.full_name).join(User, User.id == Document.owner_user_id)
                         .where(Document.reviewer_user_id == uid, Document.status.in_(caseload.REVIEW_DOCS), Document.owner_user_id.in_(org_students))).all()
    from app.models.enums import EssayStatus

    essays = db.execute(select(Essay.id, Essay.title, User.full_name).join(User, User.id == Essay.owner_user_id)
                        .where(Essay.reviewer_user_id == uid, Essay.status.in_([EssayStatus(x) for x in waiting.ESSAY_REVIEW]),
                               Essay.owner_user_id.in_(org_students))).all()
    tasks = db.execute(select(Task.id, Task.title, Task.title_key, Task.title_params, Task.due_at, Task.student_user_id)
                       .where(Task.owner_user_id == uid, Task.owner_org_id == org_id, Task.status.in_(caseload.OPEN))).all()
    tnames = dict(db.execute(select(User.id, User.full_name).where(User.id.in_({t.student_user_id for t in tasks if t.student_user_id}))).all()) if tasks else {}
    services = [(c, db.get(User, c.student_user_id)) for c in db.scalars(select(ServiceCase).where(ServiceCase.owner_user_id == uid, ServiceCase.closed_at.is_(None))).all()
                if not concierge_svc.is_closed(c)]
    return {
        "students": [{"id": str(sid), "assignment_id": str(aid), "label": name} for aid, sid, name in students],
        "reviews": [{"id": str(did), "label": name, "category": cat.value} for did, cat, name in reviews],
        "essays": [{"id": str(eid), "label": name, "title": title} for eid, title, name in essays],
        "tasks": [{"id": str(t.id), "label": tnames.get(t.student_user_id), "title": t.title, "title_key": t.title_key, "title_params": t.title_params,
                   "due_at": iso(t.due_at)} for t in tasks],
        "services": [{"id": str(c.id), "label": su.full_name if su else None, "type": c.case_type} for c, su in services],
    }


@router.get("/agency/team/members/{user_id}/open-items")
def member_open_items(user_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    _require_manager(p)
    m, u = _member(db, p, user_id)
    items = _open_items(db, p.org_id, u.id)
    return {"user_id": str(u.id), "name": u.full_name, "active": m.is_active, "items": items, "total": sum(len(v) for v in items.values())}


class LeaveIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)
    # Per kind: a user id of an active colleague, "auto" (the assignment engine: availability + weighted load), or
    # "unassigned" (back to the team queue — reviews, essays, tasks and services only).
    to: dict[str, str] = Field(default_factory=dict)


@router.post("/agency/team/members/{user_id}/deactivate")
def deactivate_member(user_id: str, body: LeaveIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """"Member leaves": every open item is moved (to a named colleague, by the engine, or back to the team queue), each
    move audited with the reason; then the membership is deactivated. Nothing is left owned by someone who has gone."""
    from app.models import Document, Essay
    from app.models.v5_concierge import ServiceCase
    from app.services import assignment as assignment_svc

    _require_manager(p)
    m, u = _member(db, p, user_id)
    if u.id == p.id:
        raise HTTPException(409, "You can't deactivate yourself.")
    bad = set(body.to) - set(OPEN_ITEM_KINDS)
    if bad:
        raise HTTPException(422, f"Unknown item kinds: {', '.join(sorted(bad))}")
    colleagues = {mm.user_id: mm for mm in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == p.org_id,
                                                                                         OrganizationMember.is_active.is_(True),
                                                                                         OrganizationMember.user_id != u.id)).all()}

    def target(kind: str, student_id=None):
        v = body.to.get(kind, "auto")
        if v == "unassigned":
            if kind == "students":
                raise HTTPException(422, "Students need a counselor: choose a colleague or let the engine choose.")
            return None
        if v == "auto":
            pick = assignment_svc.pick_counselor(db, p.org_id, exclude={u.id}, student_user_id=student_id)
            return pick.user_id if pick else None
        uid = parse_uuid(v)
        if uid not in colleagues:
            raise HTTPException(422, "Reassign to an active colleague in your agency.")
        return uid

    items = _open_items(db, p.org_id, u.id)
    moved = []

    def log(kind, entity_type, eid, to_uid, subject=None):
        moved.append({"kind": kind, "id": eid, "to": str(to_uid) if to_uid else None})
        audit(db, action="team.member.reassign", entity_type=entity_type, entity_id=eid, actor=p, subject_user_id=subject,
              detail={"from": str(u.id), "to": str(to_uid) if to_uid else None, "kind": kind, "reason": body.reason})

    for it in items["students"]:
        a = db.get(AgencyAssignment, parse_uuid(it["assignment_id"]))
        to = target("students", a.student_user_id)
        if to is None:
            raise HTTPException(409, "Nobody is available to take this person's students — add capacity or choose a colleague.")
        a.counselor_user_id = to
        log("students", "agency_assignment", str(a.id), to, a.student_user_id)
        db.flush()
    for it in items["reviews"]:
        d = db.get(Document, parse_uuid(it["id"]))
        d.reviewer_user_id = target("reviews")
        log("reviews", "document", str(d.id), d.reviewer_user_id, d.owner_user_id)
    for it in items["essays"]:
        e = db.get(Essay, parse_uuid(it["id"]))
        e.reviewer_user_id = target("essays")
        log("essays", "essay", str(e.id), e.reviewer_user_id, e.owner_user_id)
    for it in items["tasks"]:
        t = db.get(Task, parse_uuid(it["id"]))
        t.owner_user_id = target("tasks")
        log("tasks", "task", str(t.id), t.owner_user_id, t.student_user_id)
    for it in items["services"]:
        c = db.get(ServiceCase, parse_uuid(it["id"]))
        c.owner_user_id = target("services")
        log("services", "service_case", str(c.id), c.owner_user_id, c.student_user_id)
    m.is_active = False
    m.left_at = utcnow()
    m.left_reason = body.reason.strip()
    audit(db, action="team.member.deactivate", entity_type="organization_member", entity_id=m.id, actor=p,
          detail={"user": str(u.id), "reason": body.reason, "moved": len(moved)})
    db.commit()
    return {"ok": True, "moved": moved, "remaining": sum(len(v) for v in _open_items(db, p.org_id, u.id).values())}


@router.post("/agency/team/members/{user_id}/reactivate")
def reactivate_member(user_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    _require_manager(p)
    m, u = _member(db, p, user_id)
    m.is_active, m.left_at, m.left_reason = True, None, None
    audit(db, action="team.member.reactivate", entity_type="organization_member", entity_id=m.id, actor=p, detail={"user": str(u.id)})
    db.commit()
    return {"ok": True}


# ============================================================================================ V9 submissions (A7)

@router.get("/agency/submissions/pipeline")
def submissions_pipeline(state: str | None = Query(None, pattern="^(" + "|".join(("issue", "confirmation_missing", "authorized", "ready",
                                                                                  "needs_final_review", "submitted", "received")) + ")$"),
                         p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Every application between "almost ready" and "the university has it", across all connector methods, in seven
    states derived from submission records and evidence (services/submission.submission_pipeline)."""
    from app.services import submission as submission_svc

    return submission_svc.submission_pipeline(db, p, state=state)


# ============================================================================================ V9 providers (A6)

ISSUE_STATUSES = ("NO_SHOW", "CANCELLED", "NOT_ASSIGNED")


@router.get("/agency/providers")
def providers_overview(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Per provider, agreement status first ("NONE" = no agreement recorded — never called a partner), then the service
    types it handles, open and late cases (in the caller's scope), and the last issue (no-show, cancellation, negative
    feedback). Counts use the concierge rules (is_closed / is_overdue) the Services queue uses."""
    from app.models.v5_concierge import ServiceCase, ServiceCaseEvent, Vendor
    from app.services import concierge as concierge_svc

    now = utcnow()
    vendors = db.scalars(concierge_svc.vendors_visible_to(db, p).order_by(Vendor.name)).all()
    cases = db.scalars(concierge_svc.scope_cases(select(ServiceCase), p).where(ServiceCase.vendor_id.in_([v.id for v in vendors]))).all() if vendors else []
    by_vendor: dict = {}
    for c in cases:
        by_vendor.setdefault(c.vendor_id, []).append(c)
    case_ids = [c.id for c in cases]
    issues: dict = {}
    if case_ids:
        for ev, c in db.execute(select(ServiceCaseEvent, ServiceCase).join(ServiceCase, ServiceCase.id == ServiceCaseEvent.case_id)
                                .where(ServiceCaseEvent.case_id.in_(case_ids),
                                       (ServiceCaseEvent.kind == "NO_SHOW") | ServiceCaseEvent.to_status.in_(ISSUE_STATUSES))
                                .order_by(ServiceCaseEvent.created_at.desc())).all():
            issues.setdefault(c.vendor_id, {"kind": ev.to_status or ev.kind, "at": iso(ev.created_at), "case_type": c.case_type, "link": f"/services?case={c.id}"})
        for c in cases:
            if c.feedback_ok is False and c.feedback_at:
                cur = issues.get(c.vendor_id)
                if not cur or (cur["at"] or "") < iso(c.feedback_at):
                    issues[c.vendor_id] = {"kind": "NEGATIVE_FEEDBACK", "at": iso(c.feedback_at), "case_type": c.case_type, "link": f"/services?case={c.id}"}
    out = []
    for v in vendors:
        cs = by_vendor.get(v.id, [])
        open_cs = [c for c in cs if not concierge_svc.is_closed(c)]
        late = [c for c in open_cs if concierge_svc.is_overdue(c, now)]
        ag = v.agreement or {}
        status = ("ACTIVE" if concierge_svc.agreement_active(v) else "INACTIVE") if ag else "NONE"
        out.append({**concierge_svc.ser_vendor(v, staff=True),
                    "agreement_status": status, "agreement_since": ag.get("since"), "agreement_until": ag.get("until"),
                    "service_types": sorted({c.case_type for c in cs}), "open_cases": len(open_cs), "late_cases": len(late),
                    "last_issue": issues.get(v.id), "cases_link": f"/services?vendor={v.id}"})
    order = {"ACTIVE": 0, "INACTIVE": 1, "NONE": 2}
    out.sort(key=lambda r: (-r["late_cases"], -r["open_cases"], order[r["agreement_status"]], r["name"]))
    return {"items": out, "counts": {k: sum(1 for r in out if r["agreement_status"] == k) for k in order}, "generated_at": iso(now)}


# ============================================================================================ V9 process quality (A10)

@router.get("/agency/quality")
def process_quality(days: int = Query(180, ge=30, le=730), agency_id: str | None = None,
                    p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Where the agency's process creates rework (owners/managers; Hangyul for one agency or all). Every metric has a
    definition, cohort, numerator/denominator/n, n < 5 withheld, and drill-down records. No causal claims, no ranking."""
    from app.services import agency_performance

    if p.is_agency:
        if not p.has(*MANAGERS):
            raise forbidden()
        org = p.org_id
    else:
        org = parse_uuid(agency_id) if agency_id else None
    return agency_performance.process_quality(db, org, days=days)


# ============================================================================================ V9 agency identity (A12)

class IdentityIn(BaseModel):
    legal_name: str | None = Field(default=None, max_length=200)
    registration_number: str | None = Field(default=None, max_length=80)
    registration_authority: str | None = Field(default=None, max_length=160)
    clear_registration: bool = False


@router.get("/agency/identity")
def get_identity(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.is_agency:
        raise forbidden()
    org = db.get(Organization, p.org_id)
    recorded = org.registration_status in ("RECORDED", "VERIFIED")
    return {"trading_name": org.name, "legal_name": org.legal_name, "registration_status": org.registration_status if recorded else "NOT_RECORDED",
            "registration_number": org.registration_number if recorded else None, "registration_authority": org.registration_authority if recorded else None,
            "registration_checked_on": org.registration_checked_on.isoformat() if recorded and org.registration_checked_on else None,
            "can_edit": p.is_agency}


@router.patch("/agency/identity")
def update_identity(body: IdentityIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """The agency owner records its legal name and registration (number + issuing authority). A registration recorded
    here is RECORDED (self-declared); only Hangyul verification makes it VERIFIED. Audited."""
    if not p.is_agency:
        raise forbidden()
    org = db.get(Organization, p.org_id)
    if body.legal_name is not None:
        org.legal_name = body.legal_name.strip() or None
    if body.clear_registration:
        org.registration_status, org.registration_number, org.registration_authority, org.registration_checked_on = "NOT_RECORDED", None, None, None
    elif body.registration_number is not None or body.registration_authority is not None:
        num, auth = (body.registration_number or "").strip(), (body.registration_authority or "").strip()
        if not num or not auth:
            raise HTTPException(422, "Enter both the registration number and the authority that issued it.")
        org.registration_number, org.registration_authority, org.registration_status, org.registration_checked_on = num, auth, "RECORDED", None
    audit(db, action="agency.identity.update", entity_type="organization", entity_id=org.id, actor=p,
          detail={"legal_name": org.legal_name, "registration_status": org.registration_status})
    db.commit()
    return get_identity(p, db)


class SubAgentIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)


@router.patch("/agency/students/{student_id}/sub-agent")
def set_sub_agent(student_id: str, body: SubAgentIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Record (or clear) the sub-agent on this student's case — shown with the agency identity. Audited."""
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == sid, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    if a is None:
        raise HTTPException(409, "This student has no agency assignment.")
    a.sub_agent_name = (body.name or "").strip() or None
    audit(db, action="assignment.sub_agent", entity_type="agency_assignment", entity_id=a.id, actor=p, subject_user_id=sid, detail={"name": a.sub_agent_name})
    db.commit()
    return agency_ops.agency_identity(db, sid)
