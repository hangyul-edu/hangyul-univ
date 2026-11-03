import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.common import Page, iso, parse_uuid, ser_application, ser_document, ser_profile, ser_user_public
from app.core.audit import audit, track
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.models import (
    AgencyAssignment,
    Application,
    Appointment,
    Document,
    DocumentRequest,
    Essay,
    Order,
    Organization,
    OrganizationMember,
    ProgramIntake,
    SavedView,
    ServiceAddOn,
    ServiceProduct,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import AssignmentStatus, DegreeLevel, OrderStatus, OrgType, PipelineStage, Role, TaskStatus, TaskType, canonical_role
from app.services import agency_ops as agency_ops_svc
from app.services import agency_performance, analytics, caseload
from app.services import app_readiness as app_readiness_svc
from app.services import assignment as assignment_svc
from app.services import entitlements as entitlements_svc
from app.services import waiting as waiting_svc
from app.services.access import agency_student_ids_subquery, ensure_student_access
from app.services.readiness import application_readiness, profile_percent
from app.services.tasks_engine import generate_for_student

router = APIRouter(prefix="/agency", tags=["agency"])


def _student_scope(p: Principal):
    if p.is_hangyul:
        return select(StudentProfile.user_id)
    return agency_student_ids_subquery(p)


def _apply_filters(stmt, p: Principal, *, q=None, stage=None, nationality=None, counselor_id=None, degree=None, sla_breached=False, view=None,
                   intake=None, university_id=None, deadline_within_days=None, missing_documents=False, waiting_on=None,
                   closing_within_days=None, sla_risk=False):
    """Caseload filters shared by the list endpoint and saved views (so a saved view is exactly a set of these parameters)."""
    now = utcnow()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like)))
    if stage:
        stmt = stmt.where(StudentProfile.pipeline_stage.in_(stage))
    if nationality:
        stmt = stmt.where(StudentProfile.nationality.in_([n.upper() for n in nationality]))
    if degree:
        stmt = stmt.where(StudentProfile.target_degree.in_(degree))
    if counselor_id:
        stmt = stmt.where(StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
            AgencyAssignment.counselor_user_id == parse_uuid(counselor_id), AgencyAssignment.status == AssignmentStatus.ACTIVE)))
    if sla_breached:
        stmt = stmt.where(StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
            AgencyAssignment.status == AssignmentStatus.ACTIVE, AgencyAssignment.first_response_at.is_(None), AgencyAssignment.first_response_due_at < now)))
    if view and view != "all":
        stmt = stmt.where(caseload.pred_view(view, now, p.id))
    if intake:
        year, term = intake.split("-")
        stmt = stmt.where(StudentProfile.target_intake_year == int(year), StudentProfile.target_intake_term == term)
    if university_id:
        stmt = stmt.where(StudentProfile.user_id.in_(select(Application.student_user_id).where(Application.university_id == parse_uuid(university_id))))
    if deadline_within_days:
        stmt = stmt.where(caseload.pred_deadline_within(now, deadline_within_days))
    if missing_documents:
        stmt = stmt.where(caseload.pred_view("incomplete", now))
    if waiting_on:
        stmt = stmt.where(caseload.pred_waiting_on(waiting_on, now))
    if closing_within_days:
        stmt = stmt.where(caseload.pred_closing_within(now, closing_within_days))
    if sla_risk:
        stmt = stmt.where(caseload.pred_sla_risk(now))
    return stmt


VIEW_PATTERN = "^(" + "|".join(caseload.BUILT_IN_VIEWS) + ")$"


@router.get("/students")
def students(
    page: Page = Depends(),
    q: str | None = None,
    # V26 (REPORT §341, brief §37): typed, so an unknown value answers 422 with the field named — before V26 a stray
    # `stage=PROFILE_REVIEW` (an application status, not a pipeline stage) reached PostgreSQL and came back as a 500.
    stage: list[PipelineStage] | None = Query(None),
    nationality: list[str] | None = Query(None),
    counselor_id: str | None = None,
    degree: list[DegreeLevel] | None = Query(None),
    sla_breached: bool = False,
    view: str | None = Query(None, pattern=VIEW_PATTERN),
    intake: str | None = Query(None, pattern=r"^\d{4}-(SPRING|FALL|SUMMER|WINTER)$"),
    university_id: str | None = None,
    deadline_within_days: int | None = Query(None, ge=1, le=365),
    missing_documents: bool = False,
    waiting_on: str | None = Query(None, pattern=waiting_svc.FILTER_PATTERN),
    closing_within_days: int | None = Query(None, ge=1, le=365),
    sla_risk: bool = False,
    agency_id: str | None = None,
    sort: str = Query("updated", pattern="^(updated|name|stage|profile|deadline|activity)$"),
    p: Principal = Depends(require_agency_or_hangyul),
    db: Session = Depends(get_db),
):
    stmt = (select(StudentProfile, User).join(User, User.id == StudentProfile.user_id)
            .where(StudentProfile.user_id.in_(_student_scope(p))).options(selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))
    if agency_id:
        # V6 Hangyul operations: one agency's caseload. Inside an agency the tenant scope above already applies, so another
        # agency's id simply yields nothing.
        stmt = stmt.where(StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
            AgencyAssignment.organization_id == parse_uuid(agency_id), AgencyAssignment.status == AssignmentStatus.ACTIVE)))
    stmt = _apply_filters(stmt, p, q=q, stage=stage, nationality=nationality, counselor_id=counselor_id, degree=degree, sla_breached=sla_breached,
                          view=view, intake=intake, university_id=university_id, deadline_within_days=deadline_within_days,
                          missing_documents=missing_documents, waiting_on=waiting_on, closing_within_days=closing_within_days, sla_risk=sla_risk)
    now = utcnow()
    order = {
        "name": (User.full_name,), "stage": (StudentProfile.pipeline_stage,), "profile": (StudentProfile.updated_at.desc(),),
        "deadline": (caseload.deadline_sort_expr(now).asc().nulls_last(), User.full_name),
        "activity": (caseload.activity_sort_expr().desc(),),
    }.get(sort, (StudentProfile.updated_at.desc(),))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    pairs = [(prof, u) for prof, u in db.execute(stmt.order_by(*order, StudentProfile.user_id).limit(page.page_size).offset((page.page - 1) * page.page_size)).all()]
    return {"items": caseload.build_rows(db, pairs, now), "total": total, "page": page.page, "page_size": page.page_size}


@router.get("/students/views")
def student_views(agency_id: str | None = None, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Counts for every built-in caseload view, computed in one query (optionally one agency's caseload, as on the list)."""
    scope = _student_scope(p)
    if agency_id:
        scope = select(StudentProfile.user_id).where(StudentProfile.user_id.in_(scope), StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(
            AgencyAssignment.organization_id == parse_uuid(agency_id), AgencyAssignment.status == AssignmentStatus.ACTIVE)))
    return caseload.view_counts(db, scope, utcnow(), p.id)


@router.get("/today")
def today(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Who needs attention today: each item carries a count, the most pressing record and the exact queue to open.
    Every count is computed with the same predicate as the list its `queue` opens, so "2 documents" opens those 2."""
    from app.api.v1.collab import Conversation, needs_reply_scope, team_task_scope

    now = utcnow()
    scope = _student_scope(p)
    overdue_q = team_task_scope(select(Task), p).where(Task.status.in_(caseload.OPEN), Task.due_at < now)
    overdue_n = db.scalar(select(func.count()).select_from(overdue_q.subquery())) or 0
    oldest_task = db.scalar(overdue_q.order_by(Task.due_at).limit(1))
    docs_q = select(Document).where(Document.status.in_(caseload.REVIEW_DOCS), Document.owner_user_id.in_(scope))
    docs_n = db.scalar(select(func.count()).select_from(docs_q.subquery())) or 0
    docs_late = db.scalar(select(func.count()).select_from(docs_q.where(Document.updated_at < now - timedelta(hours=caseload.REVIEW_SLA_HOURS)).subquery())) or 0
    oldest_doc = db.scalar(docs_q.order_by(Document.updated_at).limit(1))
    replies = select(StudentProfile.user_id).where(StudentProfile.user_id.in_(scope), StudentProfile.user_id.in_(caseload._replies_waiting_students()))
    replies_n = db.scalar(select(func.count()).select_from(replies.subquery())) or 0
    reply_convs = needs_reply_scope(select(Conversation), p).where(Conversation.student_user_id.in_(scope))
    reply_convs_n = db.scalar(select(func.count()).select_from(reply_convs.subquery())) or 0
    oldest_reply = db.scalar(reply_convs.order_by(Conversation.last_message_at).limit(1))
    closing = (select(Application, ProgramIntake, University).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
               .join(University, University.id == Application.university_id)
               .where(Application.student_user_id.in_(scope), Application.status.in_(caseload.PRE_SUBMIT),
                      ProgramIntake.application_deadline >= now.date(), ProgramIntake.application_deadline <= (now + timedelta(days=7)).date()))
    closing_n = db.scalar(select(func.count()).select_from(closing.subquery())) or 0
    closing_students = db.scalar(select(func.count()).select_from(
        select(StudentProfile.user_id).where(StudentProfile.user_id.in_(scope), caseload.pred_closing_within(now, 7)).subquery())) or 0
    first_close = db.execute(closing.order_by(ProgramIntake.application_deadline).limit(1)).first()
    sla_q = select(AgencyAssignment).where(AgencyAssignment.student_user_id.in_(scope), AgencyAssignment.status == AssignmentStatus.ACTIVE,
                                           AgencyAssignment.first_response_at.is_(None), AgencyAssignment.first_response_due_at < now + timedelta(hours=caseload.SLA_RISK_HOURS))
    sla_n = db.scalar(select(func.count()).select_from(sla_q.subquery())) or 0
    sla_breached = db.scalar(select(func.count()).select_from(sla_q.where(AgencyAssignment.first_response_due_at < now).subquery())) or 0
    first_sla = db.scalar(sla_q.order_by(AgencyAssignment.first_response_due_at).limit(1))
    requested = select(StudentProfile.user_id).where(StudentProfile.user_id.in_(scope), caseload.pred_university_requested())
    requested_n = db.scalar(select(func.count()).select_from(requested.subquery())) or 0
    waiting = waiting_svc.counts(db, scope, now)
    waiting["us"] = waiting[waiting_svc.COUNSELOR] + waiting[waiting_svc.AGENCY]  # legacy key (V4–V8 clients)

    def name(uid):
        u = db.get(User, uid) if uid else None
        return u.full_name if u else None

    # V5: essay reviews, service cases (pickup, housing, residence card, visa support) and document checks join the same
    # queue — one Today, one SLA picture, no separate spreadsheets per service.
    from app.services import concierge as concierge_svc
    from app.services import dossier as dossier_svc
    from app.services import writing as writing_svc

    writing_items = writing_svc.today_items(db, p)
    w_over = [w for w in writing_items if w["kind"] == "WRITING_OVERDUE"]
    w_soon = [w for w in writing_items if w["kind"] == "WRITING_DUE_SOON"]
    w_rev = [w for w in writing_items if w["kind"] == "WRITING_REVISED"]
    service_items = concierge_svc.today_items(db, p)
    s_over = [c for c in service_items if c.get("overdue")]
    findings = dossier_svc.today_items(db, p)
    from app.services import visa_routes as visa_routes_svc

    visa_items = visa_routes_svc.today_items(db, p)
    v5 = {
        # Overdue first; otherwise reviews due within 48 h. Each count matches the queue view its link opens.
        "writing_reviews": {"count": len(w_over) if w_over else len(w_soon), "overdue": len(w_over), "revised": len(w_rev),
                            "oldest": (w_over or w_soon or [None])[0], "queue": "/essays?view=overdue" if w_over else "/essays?view=due48",
                            "revised_queue": "/essays?view=revised"},
        # Count = the Services view its link opens (same predicate), most pressing view first.
        "service_cases": _service_row(db, p, service_items, s_over),
        # Visa support: appointments within 7 days, embassy requests due, document packs ready to review (per student).
        "visa_cases": {"count": len(visa_items), "overdue": sum(1 for v in visa_items if v.get("overdue")), "oldest": visa_items[0] if visa_items else None,
                       "queue": visa_items[0]["link"] if visa_items else "/services?type=VISA_SUPPORT"},
        "document_checks": {"count": len(findings), "oldest": findings[0] if findings else None,
                            "queue": findings[0]["link"] if findings else "/documents"},
    }

    return {
        **v5,
        "overdue_tasks": {"count": overdue_n, "oldest": {"title": oldest_task.title, "title_key": oldest_task.title_key, "title_params": oldest_task.title_params,
                                                          "student": name(oldest_task.student_user_id), "due_at": iso(oldest_task.due_at)} if oldest_task else None,
                          "queue": "/tasks?view=overdue"},
        "documents_waiting": {"count": docs_n, "over_sla": docs_late, "sla_hours": caseload.REVIEW_SLA_HOURS,
                              "oldest": {"title": oldest_doc.title, "category": oldest_doc.category.value, "student": name(oldest_doc.owner_user_id),
                                         "since": iso(oldest_doc.updated_at)} if oldest_doc else None,
                              "queue": "/documents"},
        "student_replies": {"count": replies_n, "conversations": reply_convs_n,
                            "oldest": {"student": name(oldest_reply.student_user_id), "since": iso(oldest_reply.last_message_at)} if oldest_reply else None,
                            "queue": "/messages?filter=reply"},
        "closing_soon": {"count": closing_n, "students": closing_students or 0,
                         "next": {"university": first_close[2].name_en, "university_id": str(first_close[2].id), "deadline": first_close[1].application_deadline.isoformat(),
                                  "student": name(first_close[0].student_user_id)} if first_close else None,
                         "queue": "/students?closing=7"},
        "sla_risk": {"count": sla_n, "breached": sla_breached, "next": {"student": name(first_sla.student_user_id), "due_at": iso(first_sla.first_response_due_at)} if first_sla else None,
                     "queue": "/students?sla_risk=1"},
        "university_requests": {"count": requested_n, "queue": "/students?view=requested"},
        "waiting_on": waiting,
    }


def _service_row(db, p, items: list[dict], overdue_items: list[dict]) -> dict:
    from app.services import concierge as concierge_svc

    counts = concierge_svc.list_cases(db, p)["counts"]
    view = next((v for v in ("overdue", "needs_assignment", "today") if counts.get(v)), None)
    return {"count": counts.get(view, 0) if view else 0, "view": view, "overdue": counts.get("overdue", 0),
            "oldest": (overdue_items or items or [None])[0], "queue": f"/services?view={view}" if view else "/services"}


# ----------------------------------------------------------------------------- saved views

class SavedViewIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    scope: str = Field("PERSONAL", pattern="^(PERSONAL|TEAM)$")
    filters: dict = Field(default_factory=dict)
    columns: list[str] | None = None
    sort: str | None = Field(default=None, pattern="^(updated|name|stage|profile|deadline|activity)$")


ALLOWED_VIEW_FILTERS = {"q", "stage", "nationality", "counselor_id", "degree", "sla_breached", "view", "intake", "university_id",
                        "deadline_within_days", "missing_documents", "waiting_on", "closing_within_days", "sla_risk"}
MANAGERS = (Role.AGENCY_ADMIN, Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS)  # V22: every agency admin


def ser_view(v: SavedView, p: Principal) -> dict:
    return {"id": str(v.id), "name": v.name, "scope": v.scope, "filters": v.filters or {}, "columns": v.columns, "sort": v.sort,
            "owner_user_id": str(v.owner_user_id), "mine": v.owner_user_id == p.id,
            "can_edit": v.owner_user_id == p.id or (v.scope == "TEAM" and p.has(*MANAGERS)), "updated_at": iso(v.updated_at)}


def _clean_filters(f: dict) -> dict:
    bad = set(f) - ALLOWED_VIEW_FILTERS
    if bad:
        raise HTTPException(422, f"Unknown filters: {', '.join(sorted(bad))}")
    return {k: v for k, v in f.items() if v not in (None, "", [], False)}


def _visible_views(p: Principal):
    return select(SavedView).where(SavedView.organization_id == p.org_id, or_(SavedView.owner_user_id == p.id, SavedView.scope == "TEAM"))


@router.get("/saved-views")
def list_saved_views(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.org_id:
        return []
    views = db.scalars(_visible_views(p).order_by(SavedView.scope.desc(), SavedView.name)).all()
    return [ser_view(v, p) for v in views]


@router.post("/saved-views", status_code=201)
def create_saved_view(body: SavedViewIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.org_id:
        raise HTTPException(400, "Select an organization first.")
    if body.scope == "TEAM" and not p.has(*MANAGERS):
        raise HTTPException(403, "Only managers can share views with the team.")
    v = SavedView(organization_id=p.org_id, owner_user_id=p.id, scope=body.scope, name=body.name.strip(), filters=_clean_filters(body.filters),
                  columns=body.columns, sort=body.sort)
    db.add(v)
    audit(db, action="saved_view.create", entity_type="saved_view", entity_id=v.id, actor=p, detail={"scope": body.scope, "name": v.name})
    db.commit()
    return ser_view(v, p)


def _editable_view(db: Session, p: Principal, view_id: str) -> SavedView:
    v = db.scalar(_visible_views(p).where(SavedView.id == parse_uuid(view_id)))
    if not v:
        raise HTTPException(404, "Not found")
    if not (v.owner_user_id == p.id or (v.scope == "TEAM" and p.has(*MANAGERS))):
        raise HTTPException(403, "You can't change this view.")
    return v


@router.patch("/saved-views/{view_id}")
def update_saved_view(view_id: str, body: SavedViewIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    v = _editable_view(db, p, view_id)
    if body.scope == "TEAM" and not p.has(*MANAGERS):
        raise HTTPException(403, "Only managers can share views with the team.")
    v.name, v.scope, v.filters, v.columns, v.sort = body.name.strip(), body.scope, _clean_filters(body.filters), body.columns, body.sort
    db.commit()
    return ser_view(v, p)


@router.delete("/saved-views/{view_id}", status_code=204)
def delete_saved_view(view_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    v = _editable_view(db, p, view_id)
    audit(db, action="saved_view.delete", entity_type="saved_view", entity_id=v.id, actor=p, detail={"name": v.name})
    db.delete(v)
    db.commit()


@router.get("/stage-counts")
def stage_counts(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Students per pipeline stage (one grouped query) — for the Today caseload strip."""
    rows = db.execute(select(StudentProfile.pipeline_stage, func.count()).where(StudentProfile.user_id.in_(_student_scope(p)))
                      .group_by(StudentProfile.pipeline_stage)).all()
    return {stage.value: n for stage, n in rows}


@router.get("/pipeline")
def pipeline(counselor_id: str | None = None, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    stmt = (select(StudentProfile, User).join(User, User.id == StudentProfile.user_id).where(StudentProfile.user_id.in_(_student_scope(p)))
            .options(selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))
    if counselor_id:
        stmt = stmt.where(StudentProfile.user_id.in_(select(AgencyAssignment.student_user_id).where(AgencyAssignment.counselor_user_id == parse_uuid(counselor_id), AgencyAssignment.status == AssignmentStatus.ACTIVE)))
    columns = {s.value: [] for s in PipelineStage}
    pairs = [(prof, u) for prof, u in db.execute(stmt.order_by(StudentProfile.updated_at.desc()).limit(500)).all()]
    for row in caseload.build_rows(db, pairs, utcnow()):
        columns[row["pipeline_stage"]].append(row)
    return {"stages": [s.value for s in PipelineStage], "columns": columns}


@router.get("/students/{student_id}")
def student_workspace(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    user = db.get(User, sid)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == sid).options(selectinload(StudentProfile.educations), selectinload(StudentProfile.languages)))
    apps = db.scalars(select(Application).where(Application.student_user_id == sid).order_by(Application.updated_at.desc())).all()
    docs = db.scalars(select(Document).where(Document.owner_user_id == sid).options(selectinload(Document.versions)).order_by(Document.updated_at.desc())).all()
    essays = db.scalars(select(Essay).where(Essay.owner_user_id == sid)).all()
    visa = db.scalars(select(VisaCase).where(VisaCase.student_user_id == sid)).all()
    orders = db.execute(select(Order, ServiceProduct).join(ServiceProduct, ServiceProduct.id == Order.product_id).where(Order.user_id == sid, Order.status == OrderStatus.PAID)).all()
    appts = db.scalars(select(Appointment).where(Appointment.student_user_id == sid).order_by(Appointment.starts_at.desc())).all()
    from app.services.guides import state_for as guide_state

    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == sid, AgencyAssignment.status == AssignmentStatus.ACTIVE))
    now = utcnow()
    row = caseload.build_rows(db, [(prof, user)], now)[0] if prof else {}
    app_out = []
    remaining = {}
    for x in apps:
        item = ser_application(x, db, include_student=False)
        if x.status in caseload.PRE_SUBMIT:
            # "3 items remain" instead of a readiness percentage (same count the student sees on their home screen).
            _pct, items = application_readiness(db, x, prof, now.date())
            open_items = [i for i in items if i["required"] and not i["ready"]]
            # V27: no verified guide → there is no list to count; "0 left" would be a false complete (REPORT §357).
            item["guide_review"] = guide_state(db, x)["state"] == "REVIEW_REQUIRED"
            item["items_remaining"] = None if item["guide_review"] else len(open_items)
            item["items_in_review"] = sum(1 for i in open_items if i["action_code"] == "IN_REVIEW")
            if not item["guide_review"]:
                remaining[x.id] = (item["items_remaining"], item["items_in_review"])
        # V15, brief Part 10: one readiness state and its *named* blockers — never a score. This is the
        # sentence a counselor reads before promising a student that an application can go.
        item["readiness"] = app_readiness_svc.readiness(db, x, prof, now.date())
        app_out.append(item)
    # V26 (REPORT §341): the university's open requests, on the application they belong to, in its own words — so
    # "대학 요청" in TODAY can open the request itself rather than a page that never showed it.
    open_reqs: dict = {}
    for r in db.scalars(select(DocumentRequest).where(DocumentRequest.application_id.in_([x.id for x in apps]), DocumentRequest.status == "OPEN")
                        .order_by(DocumentRequest.requested_at)).all():
        open_reqs.setdefault(r.application_id, []).append({"id": str(r.id), "label": r.label, "note": r.note, "category": r.category,
                                                           "due_date": r.due_date.isoformat() if r.due_date else None, "requested_at": iso(r.requested_at)})
    for x, item in zip(apps, app_out):
        item["requests"] = open_reqs.get(x.id, [])
    # V9: one waiting-on vocabulary per application (party + reason), with live submission signals.
    app_wait = caseload.applications_waiting(db, list(apps), remaining)
    for x, item in zip(apps, app_out):
        party, code = app_wait.get(x.id, ("none", None))
        item["waiting_on"] = None if party == "none" else party
        item["waiting_reason"] = {"code": code} if code else None
    audit(db, action="student.view", entity_type="student", entity_id=sid, actor=p, subject_user_id=sid)
    db.commit()
    return {
        "student": {"id": str(user.id), "full_name": user.full_name, "preferred_name": user.preferred_name, "email": user.email, "locale": user.locale, "phone": user.phone},
        "profile": ser_profile(prof),
        "profile_percent": profile_percent(prof),
        "assignment": {"organization_id": str(a.organization_id), "organization": db.get(Organization, a.organization_id).name,
                       "counselor": ser_user_public(db.get(User, a.counselor_user_id)) if a.counselor_user_id else None, "assigned_by": a.assigned_by,
                       "score": a.score, "score_breakdown": a.score_breakdown, "since": iso(a.created_at), "first_response_due_at": iso(a.first_response_due_at),
                       "first_response_at": iso(a.first_response_at)} if a else None,
        "applications": app_out,
        "waiting_on": row.get("waiting_on"),
        "waiting_reason": row.get("waiting_reason"),
        "waiting_owner": row.get("waiting_owner"),
        "next_action": row.get("next_action"),
        "next_deadline": row.get("next_deadline"),
        "targets": row.get("targets") or {},
        "documents": [ser_document(d) for d in docs],
        "essays": [{"id": str(e.id), "title": e.title, "status": e.status.value, "essay_type": e.essay_type.value, "due_date": iso(e.due_date)} for e in essays],
        "visa_cases": [{"id": str(v.id), "visa_type": v.visa_type.value, "status": v.status.value} for v in visa],
        "services": [{"code": prod.code, "name": prod.name_en, "paid_at": iso(o.paid_at)} for o, prod in orders],
        # V15: what the student bought, what is promised and what is left. The fourth of the counselor's
        # four questions (REPORT §119) — without it the console cannot say what may be promised.
        "plan": entitlements_svc.student_plan(db, sid),
        "appointments": [{"id": str(x.id), "kind": x.kind, "starts_at": iso(x.starts_at), "status": x.status, "channel": x.channel,
                          "outcome_notes": x.outcome_notes, "decisions": x.decisions or [], "follow_ups": len(x.follow_up_task_ids or []) or (1 if x.follow_up_task_id else 0),
                          "next_appointment_id": str(x.next_appointment_id) if x.next_appointment_id else None} for x in appts],
        # V9 (REPORT §59 A12): who is responsible for this applicant.
        "agency_identity": agency_ops_svc.agency_identity(db, sid),
    }


class StageIn(BaseModel):
    stage: PipelineStage
    note: str | None = Field(default=None, max_length=1000)


@router.post("/students/{student_id}/stage")
def set_stage(student_id: str, body: StageIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == sid))
    prev = prof.pipeline_stage
    prof.pipeline_stage = body.stage
    audit(db, action="student.stage", entity_type="student", entity_id=sid, actor=p, subject_user_id=sid, detail={"from": prev.value, "to": body.stage.value, "note": body.note})
    db.commit()
    return {"ok": True, "stage": body.stage.value}


class BulkIn(BaseModel):
    student_ids: list[str] = Field(min_length=1, max_length=200)
    action: str = Field(pattern="^(SET_STAGE|ASSIGN_COUNSELOR|REGENERATE_TASKS)$")
    stage: PipelineStage | None = None
    counselor_id: str | None = None


@router.post("/students/bulk")
def bulk(body: BulkIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Safe bulk operations only: pipeline stage, counselor reassignment within the org, task regeneration."""
    if body.action == "ASSIGN_COUNSELOR" and not (p.is_agency or p.has(Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN)):
        raise HTTPException(403, "Only the agency's administrators can reassign owners.")
    done = 0
    counselor = parse_uuid(body.counselor_id) if body.counselor_id else None
    if counselor and p.org_id and not db.scalar(select(OrganizationMember.id).where(OrganizationMember.organization_id == p.org_id, OrganizationMember.user_id == counselor)):
        raise HTTPException(422, "Counselor is not in your organization.")
    for s in body.student_ids:
        sid = parse_uuid(s)
        ensure_student_access(db, p, sid)
        if body.action == "SET_STAGE" and body.stage:
            db.scalar(select(StudentProfile).where(StudentProfile.user_id == sid)).pipeline_stage = body.stage
        elif body.action == "ASSIGN_COUNSELOR" and counselor:
            a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == sid, AgencyAssignment.status == AssignmentStatus.ACTIVE))
            if a:
                a.counselor_user_id = counselor
        elif body.action == "REGENERATE_TASKS":
            generate_for_student(db, sid)
        done += 1
    audit(db, action=f"student.bulk.{body.action.lower()}", entity_type="student", actor=p, detail={"count": done})
    db.commit()
    return {"updated": done}


@router.get("/analytics")
def agency_analytics(days: int = Query(30, ge=7, le=365), nationality: str | None = None, degree: str | None = None, intake: str | None = None,
                     university_id: str | None = None, agency_id: str | None = None,
                     p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    org = p.org_id if p.is_agency else (parse_uuid(agency_id) if agency_id else None)
    return analytics.agency_dashboard(db, org, days, {"nationality": nationality, "degree": degree, "intake": intake, "university_id": university_id})


@router.get("/students/{student_id}/matches")
def student_matches(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """The same explainable verdicts the student sees, for a counselor choosing programs with them (tenant-checked)."""
    from app.api.v1.student import compute_matches  # shared engine wrapper
    from app.services.matching import ENGINE_VERSION

    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == sid))
    if prof is None:
        raise HTTPException(404, "Student profile not found.")
    res = compute_matches(db, prof, utcnow().date())
    return {"engine_version": ENGINE_VERSION, "student_id": str(sid),
            "items": [{"program_id": m["program_id"], "tier": m["tier"], "eligible": m["eligible"], "score": m["score"], "reasons": m["reasons"]} for m in res]}


@router.get("/performance")
def agency_performance_view(intake: str | None = Query(None, pattern=r"^\d{4}-(SPRING|FALL|SUMMER|WINTER)$"), days: int = Query(90, ge=7, le=365),
                            nationality: str | None = Query(None, min_length=2, max_length=2), agency_id: str | None = None,
                            p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Management view: one intake cohort (funnel, processing time, conversion, mix) + rolling operations (SLA, document review).
    Revenue is only returned to agency owners/managers and Hangyul finance/admin."""
    org = p.org_id if p.is_agency else (parse_uuid(agency_id) if agency_id else None)
    revenue = p.is_agency or p.has(Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_FINANCE)
    return agency_performance.performance(db, org, intake=intake, days=days, nationality=nationality, include_revenue=revenue)


@router.get("/team")
def team(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Team roster + V9 operations fields (expertise, availability, capacity) and weighted load (services/agency_ops)."""
    from app.services import agency_ops as ops_svc

    org_id = p.org_id
    rows = db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org_id)).all()
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(404, "Not found")
    loads = {r["user_id"]: r for r in ops_svc.member_loads(db, org_id, include_inactive=True)["people"]}
    today = utcnow().date()

    def member(m: OrganizationMember, u: User) -> dict:
        ld = loads.get(str(u.id))
        return {"user_id": str(u.id), "full_name": u.full_name, "email": u.email, "role": canonical_role(m.role).value, "title": m.title, "languages": m.languages or [],
                "active": m.is_active, "countries": m.countries or [], "university_ids": m.university_ids or [], "degrees": m.degrees or [],
                "majors": m.majors or [], "capacity_points": m.capacity_points,
                "on_leave_until": m.on_leave_until.isoformat() if m.on_leave_until and m.on_leave_until >= today else None, "leave_note": m.leave_note,
                "left_at": iso(m.left_at), "left_reason": m.left_reason,
                "load": {k: ld[k] for k in ("cases", "work", "points", "capacity", "load", "overloaded", "sla_risk", "sla_risk_by", "available")} if ld else None}
    return {"organization": {"id": str(org.id), "name": org.name, "languages": org.languages or [], "capacity_active_cases": org.capacity_active_cases,
                             "sla_first_response_hours": org.sla_first_response_hours, "specialties": [{"kind": s.kind, "value": s.value} for s in org.specialties]},
            "weights": ops_svc.weights_for(org), "default_weights": ops_svc.LOAD_WEIGHTS, "weight_max": ops_svc.WEIGHT_MAX,
            "load_definition": ops_svc.DEFINITIONS["load"], "can_manage": p.is_agency or p.is_hangyul,
            "members": [member(m, u) for m, u in rows]}


@router.get("/assignment-candidates/{student_id}")
def assignment_candidates(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(403, "Only Hangyul operations can view cross-agency assignment scoring.")
    return assignment_svc.score_agencies(db, parse_uuid(student_id))


class OverrideIn(BaseModel):
    student_id: str
    organization_id: str
    counselor_id: str | None = None
    reason: str = Field(min_length=3, max_length=300)


@router.post("/assignments/override", status_code=201)
def override_assignment(body: OverrideIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.has(Role.HANGYUL_OPERATIONS, Role.HANGYUL_SUPER_ADMIN):
        raise HTTPException(403, "Only Hangyul operations can override assignments.")
    org = db.get(Organization, parse_uuid(body.organization_id))
    if not org or org.type != OrgType.AGENCY:
        raise HTTPException(404, "Agency not found")
    sid = parse_uuid(body.student_id)
    a = assignment_svc.assign(db, sid, org_id=org.id, counselor_user_id=parse_uuid(body.counselor_id) if body.counselor_id else None,
                              assigned_by="OPERATIONS_OVERRIDE", reason=body.reason)
    for app in db.scalars(select(Application).where(Application.student_user_id == sid)):
        app.agency_org_id = org.id
    audit(db, action="assignment.override", entity_type="agency_assignment", entity_id=a.id, actor=p, subject_user_id=sid, detail={"org": str(org.id), "reason": body.reason})
    generate_for_student(db, sid)
    db.commit()
    return {"id": str(a.id)}


@router.get("/agencies")
def agencies(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    if not p.is_hangyul:
        raise HTTPException(403, "Hangyul only")
    active = dict(db.execute(select(AgencyAssignment.organization_id, func.count()).where(AgencyAssignment.status == AssignmentStatus.ACTIVE).group_by(AgencyAssignment.organization_id)).all())
    return [{"id": str(o.id), "name": o.name, "country_code": o.country_code, "languages": o.languages or [], "capacity": o.capacity_active_cases,
             "active_cases": active.get(o.id, 0), "is_partner": o.is_partner}
            for o in db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY).order_by(Organization.name))]


@router.get("/deadlines")
def deadlines(days: int = Query(30, ge=1, le=180), p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    now = utcnow()
    stmt = select(Task).where(Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]), Task.due_at.is_not(None), Task.due_at <= now + timedelta(days=days),
                              Task.student_user_id.in_(_student_scope(p))).order_by(Task.due_at)
    out = []
    for t in db.scalars(stmt.limit(300)):
        u = db.get(User, t.student_user_id) if t.student_user_id else None
        out.append({"id": str(t.id), "title": t.title, "title_key": t.title_key, "title_params": t.title_params or {}, "task_type": t.task_type.value, "due_at": iso(t.due_at), "overdue": t.due_at < now,
                    "priority": t.priority.value, "student": ser_user_public(u), "link": t.link, "owner": ser_user_public(db.get(User, t.owner_user_id)) if t.owner_user_id else None})
    return out


@router.get("/orders")
def agency_orders(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Service purchases of the agency's students (amounts are provider records; demo payments are flagged)."""
    from app.models import Payment

    rows = db.execute(
        select(Order, ServiceProduct, User).join(ServiceProduct, ServiceProduct.id == Order.product_id).join(User, User.id == Order.user_id)
        .where(Order.user_id.in_(_student_scope(p))).order_by(Order.created_at.desc()).limit(500)
    ).all()
    out = []
    for o, prod, u in rows:
        pay = db.scalar(select(Payment).where(Payment.order_id == o.id))
        out.append({"id": str(o.id), "student": ser_user_public(u), "product_code": prod.code, "product_name": prod.name_en, "status": o.status.value,
                    "amount_minor": o.amount_minor, "currency": o.currency, "paid_at": iso(o.paid_at), "created_at": iso(o.created_at),
                    "provider": pay.provider if pay else None, "is_demo_payment": bool(pay and pay.provider == "demo"),
                    # V16 (brief Part 25): the provider's own reference and method, for Finance/Operations to
                    # reconcile a Toss transaction against. Never a key, never a card — `Payment.raw` is
                    # already sanitised by `payments.sanitize()` and this reads two fields out of it.
                    "provider_ref": (pay.provider_ref if pay else None),
                    "method": ((pay.raw or {}).get("method") if pay else None),
                    "receipt_url": ((pay.raw or {}).get("receiptUrl") if pay else None)})
    return out


def _appointment_bucket(a: Appointment, now) -> str:
    if a.status == "SCHEDULED" and a.starts_at + timedelta(minutes=a.duration_minutes) >= now:
        return "upcoming"
    if a.status == "SCHEDULED":
        return "follow_up"  # happened, but nobody closed it out
    return "done"


@router.get("/appointments")
def agency_appointments(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Consultations with their context (application, service plan, follow-up task), resolved in bulk."""
    rows = db.execute(
        select(Appointment, User).join(User, User.id == Appointment.student_user_id)
        .where(Appointment.student_user_id.in_(_student_scope(p))).order_by(Appointment.starts_at.desc()).limit(300)
    ).all()
    now = utcnow()
    hosts = {u.id: u for u in db.scalars(select(User).where(User.id.in_({a.host_user_id for a, _ in rows if a.host_user_id}))).all()}
    apps = dict(db.execute(select(Application.id, University.name_en).join(University, University.id == Application.university_id)
                           .where(Application.id.in_({a.application_id for a, _ in rows if a.application_id}))).all())
    plans = dict(db.execute(select(Order.user_id, ServiceProduct.name_en).join(ServiceProduct, ServiceProduct.id == Order.product_id)
                            .where(Order.user_id.in_({u.id for _, u in rows}), Order.status == OrderStatus.PAID).order_by(Order.user_id, Order.paid_at)).all())
    tasks = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_({a.follow_up_task_id for a, _ in rows if a.follow_up_task_id}))).all()}
    out = []
    for a, u in rows:
        ft = tasks.get(a.follow_up_task_id) if a.follow_up_task_id else None
        out.append({"id": str(a.id), "student": ser_user_public(u), "kind": a.kind, "starts_at": iso(a.starts_at), "duration_minutes": a.duration_minutes,
                    "channel": a.channel, "status": a.status, "notes": a.notes, "outcome_notes": a.outcome_notes, "host": ser_user_public(hosts.get(a.host_user_id)),
                    "application": {"id": str(a.application_id), "university": apps.get(a.application_id)} if a.application_id else None,
                    "service_plan": plans.get(u.id), "bucket": _appointment_bucket(a, now),
                    "follow_up_task": {"id": str(ft.id), "title": ft.title, "due_at": iso(ft.due_at), "done": ft.status == TaskStatus.DONE} if ft else None})
    return out


class FollowUpIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_at: str | None = None
    for_student: bool = False  # a student-side to-do (visible to the student) instead of a staff task


class NextMeetingIn(BaseModel):
    starts_at: str
    kind: str = Field(default="CONSULTATION", pattern="^(CONSULTATION|INTERVIEW|INTERVIEW_PREP)$")
    channel: str = Field(default="VIDEO", pattern="^(VIDEO|PHONE|IN_PERSON)$")
    duration_minutes: int = Field(default=30, ge=10, le=240)


class CloseOutIn(BaseModel):
    status: str = Field(pattern="^(COMPLETED|NO_SHOW|CANCELLED)$")
    outcome_notes: str | None = Field(default=None, max_length=4000)
    next_task_title: str | None = Field(default=None, max_length=300)
    next_task_due_at: str | None = None
    # V9 meeting record (REPORT §59 A8): decisions + follow-up tasks + next appointment, saved as one record.
    decisions: list[str] | None = Field(default=None, max_length=20)
    follow_ups: list[FollowUpIn] | None = Field(default=None, max_length=20)
    next_meeting: NextMeetingIn | None = None


def _dt(v: str | None):
    from datetime import datetime

    return datetime.fromisoformat(v) if v else None


def _close(db: Session, p: Principal, a: Appointment, body: CloseOutIn) -> dict:
    if body.status == "COMPLETED" and not (body.outcome_notes or "").strip():
        raise HTTPException(422, "Write a short note on what was agreed.")
    a.status = body.status
    a.outcome_notes = (body.outcome_notes or "").strip() or None
    a.decisions = [d.strip() for d in (body.decisions or []) if d and d.strip()] or None
    a.closed_at, a.closed_by_user_id = utcnow(), p.id
    if a.kind == entitlements_svc.MOCK_KIND and body.status == "COMPLETED":
        track(db, "mock_interview_completed", user_id=a.student_user_id, properties={})
    follow = list(body.follow_ups or [])
    if body.next_task_title and body.next_task_title.strip():
        follow.insert(0, FollowUpIn(title=body.next_task_title.strip(), due_at=body.next_task_due_at))
    ids = []
    for f in follow:
        t = Task(title=f.title.strip(), task_type=TaskType.CONSULTATION, owner_user_id=None if f.for_student else p.id, owner_org_id=p.org_id,
                 student_user_id=a.student_user_id, application_id=a.application_id, due_at=_dt(f.due_at), source="MANUAL",
                 visible_to_student=f.for_student, created_by_id=p.id, link=f"/students/{a.student_user_id}?tab=tasks")
        db.add(t)
        db.flush()
        ids.append(str(t.id))
    if ids:
        a.follow_up_task_id = a.follow_up_task_id or uuid.UUID(ids[0])
        a.follow_up_task_ids = ids
    if body.next_meeting:
        from app.services.notify import notify

        _guard_meeting(db, a.student_user_id, body.next_meeting.kind)
        nm = Appointment(student_user_id=a.student_user_id, organization_id=p.org_id or a.organization_id, host_user_id=p.id, kind=body.next_meeting.kind,
                         starts_at=_dt(body.next_meeting.starts_at), duration_minutes=body.next_meeting.duration_minutes, channel=body.next_meeting.channel,
                         application_id=a.application_id)
        db.add(nm)
        db.flush()
        a.next_appointment_id = nm.id
        notify(db, a.student_user_id, "APPOINTMENT", "notify.appointment", f"Consultation scheduled for {body.next_meeting.starts_at[:16].replace('T', ' ')}",
               params={"at": body.next_meeting.starts_at}, link="/messages")
    audit(db, action="appointment.close", entity_type="appointment", entity_id=a.id, actor=p, subject_user_id=a.student_user_id,
          detail={"status": body.status, "follow_up": bool(ids), "follow_ups": len(ids), "decisions": len(a.decisions or []),
                  "next_meeting": bool(a.next_appointment_id)})
    return ser_meeting(db, a)


def ser_meeting(db: Session, a: Appointment) -> dict:
    """One meeting record: notes + decisions + follow-up tasks (with their state) + the next appointment."""
    ids = [uuid.UUID(x) for x in (a.follow_up_task_ids or ([] if not a.follow_up_task_id else [str(a.follow_up_task_id)]))]
    tasks = db.scalars(select(Task).where(Task.id.in_(ids))).all() if ids else []
    nxt = db.get(Appointment, a.next_appointment_id) if a.next_appointment_id else None
    host = db.get(User, a.host_user_id) if a.host_user_id else None
    return {"id": str(a.id), "kind": a.kind, "starts_at": iso(a.starts_at), "status": a.status, "channel": a.channel, "notes": a.notes,
            "outcome_notes": a.outcome_notes, "decisions": a.decisions or [], "closed_at": iso(a.closed_at),
            "host": {"id": str(host.id), "full_name": host.full_name} if host else None,
            "follow_ups": [{"id": str(t.id), "title": t.title, "due_at": iso(t.due_at), "done": t.status == TaskStatus.DONE, "for_student": t.visible_to_student}
                           for t in tasks],
            "next_meeting": {"id": str(nxt.id), "starts_at": iso(nxt.starts_at), "kind": nxt.kind, "channel": nxt.channel, "status": nxt.status} if nxt else None}


@router.post("/appointments/{appointment_id}/close")
def close_appointment(appointment_id: str, body: CloseOutIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Close out a consultation: what was agreed, the decisions, every follow-up task and the next appointment — one record."""
    a = db.get(Appointment, parse_uuid(appointment_id))
    if not a:
        raise HTTPException(404, "Not found")
    ensure_student_access(db, p, a.student_user_id)
    out = _close(db, p, a, body)
    db.commit()
    return {"ok": True, "meeting": out}


class MeetingIn(CloseOutIn):
    kind: str = Field(default="CONSULTATION", pattern="^(CONSULTATION|INTERVIEW|INTERVIEW_PREP)$")
    channel: str = Field(default="VIDEO", pattern="^(VIDEO|PHONE|IN_PERSON)$")
    starts_at: str | None = None
    duration_minutes: int = Field(default=30, ge=10, le=240)
    application_id: str | None = None
    status: str = Field(default="COMPLETED", pattern="^(COMPLETED)$")


@router.post("/students/{student_id}/meetings", status_code=201)
def record_meeting(student_id: str, body: MeetingIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """V9: record a meeting that just happened from the student workspace (creates the appointment and closes it out in
    one step, with the same rules as the close endpoint)."""
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    app_id = parse_uuid(body.application_id) if body.application_id else None
    if app_id and not db.scalar(select(Application.id).where(Application.id == app_id, Application.student_user_id == sid)):
        raise HTTPException(404, "Application not found")
    _guard_meeting(db, sid, body.kind)
    a = Appointment(student_user_id=sid, organization_id=p.org_id, host_user_id=p.id, kind=body.kind, channel=body.channel,
                    starts_at=_dt(body.starts_at) or utcnow(), duration_minutes=body.duration_minutes, application_id=app_id)
    db.add(a)
    db.flush()
    out = _close(db, p, a, body)
    db.commit()
    return out


@router.get("/students/{student_id}/meetings")
def student_meetings(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Meeting records for the workspace timeline (closed meetings first by date, then what is scheduled)."""
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    rows = db.scalars(select(Appointment).where(Appointment.student_user_id == sid).order_by(Appointment.starts_at.desc())).all()
    return {"items": [ser_meeting(db, a) for a in rows]}


def _guard_meeting(db: Session, sid, kind: str) -> None:
    """V29: a mock interview and a follow-up consultation are counted parts of the contract.

    The first CONSULTATION is the plan's diagnostic consultation; each later one is a follow-up (Basic: 1). A mock
    interview (``INTERVIEW_PREP``) uses the plan's included session or a paid extra. Out of scope → 409 with the
    add-on the console offers instead ("추가 서비스 제안"), never a dead end.
    """
    try:
        if kind == entitlements_svc.MOCK_KIND:
            entitlements_svc.check(db, sid, "mock_interviews")
        elif kind == "CONSULTATION" and entitlements_svc._used(db, sid, "consultation_sessions") >= 1:
            entitlements_svc.check(db, sid, "follow_up_consultations")
    except entitlements_svc.OutOfScope as exc:
        raise HTTPException(409, exc.as_detail()) from exc


class AppointmentIn(BaseModel):
    student_id: str
    kind: str = Field(default="CONSULTATION", pattern="^(CONSULTATION|INTERVIEW|INTERVIEW_PREP)$")
    starts_at: str
    duration_minutes: int = Field(default=30, ge=10, le=240)
    channel: str = Field(default="VIDEO", pattern="^(VIDEO|PHONE|IN_PERSON)$")
    notes: str | None = Field(default=None, max_length=1000)


@router.post("/appointments", status_code=201)
def create_appointment(body: AppointmentIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    from datetime import datetime

    from app.services.notify import notify

    sid = parse_uuid(body.student_id)
    ensure_student_access(db, p, sid)
    _guard_meeting(db, sid, body.kind)
    a = Appointment(student_user_id=sid, organization_id=p.org_id, host_user_id=p.id, kind=body.kind, starts_at=datetime.fromisoformat(body.starts_at),
                    duration_minutes=body.duration_minutes, channel=body.channel, notes=body.notes)
    db.add(a)
    notify(db, sid, "APPOINTMENT", "notify.appointment", f"Consultation scheduled for {body.starts_at[:16].replace('T', ' ')}", params={"at": body.starts_at}, link="/messages")
    db.commit()
    return {"id": str(a.id)}


# ----------------------------------------------------------------------------- V5 outcome metrics (Part Z)

def _metric(group: str, key: str, value, unit: str, definition: str, *, n=None, num=None, den=None, withheld=False) -> dict:
    return {"group": group, "key": key, "value": None if withheld else value, "unit": unit, "n": n, "numerator": num, "denominator": den,
            "withheld": bool(withheld), "definition": definition}


@router.get("/outcome-metrics")
def outcome_metrics(days: int = Query(90, ge=7, le=730), p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Outcome-oriented metrics for one agency (Hangyul staff: everyone) — admission success, documents, writing and
    services — each with its definition and population; small samples (n < 5) are withheld, never estimated."""
    from app.services import concierge as concierge_svc
    from app.services import dossier as dossier_svc
    from app.services import strategy as strategy_svc
    from app.services import writing as writing_svc

    org_id = None if p.is_hangyul else p.org_id
    now = utcnow()
    s = strategy_svc.success_metrics(db, org_id)
    d = dossier_svc.dossier_metrics(db, {"organization_id": org_id, "since": (now - timedelta(days=days)).date(), "until": now.date()} if org_id
                                    else {"since": (now - timedelta(days=days)).date(), "until": now.date()})
    w = writing_svc.writing_metrics(db, org_id, days)
    c = concierge_svc.concierge_metrics(db, org_id, now - timedelta(days=days), now)
    small = lambda n: (n or 0) < 5  # noqa: E731
    rows = [
        _metric("admission", "time_to_ready", s["time_to_ready_days"]["median"], "days", s["time_to_ready_days"]["definition"],
                n=s["time_to_ready_days"]["n"], withheld=small(s["time_to_ready_days"]["n"])),
        _metric("admission", "completeness_at_submission", s["completeness_at_submission"]["mean"], "share", s["completeness_at_submission"]["definition"],
                n=s["completeness_at_submission"]["n"], withheld=small(s["completeness_at_submission"]["n"])),
        _metric("admission", "submissions_with_evidence", s["submissions_with_evidence"]["count"], "count", s["submissions_with_evidence"]["definition"],
                n=s["submissions_with_evidence"]["n"]),
        _metric("admission", "missed_deadlines", s["missed_deadlines"]["count"], "count", s["missed_deadlines"]["definition"], n=s["missed_deadlines"]["n"]),
        _metric("documents", "first_pass_acceptance", d["first_pass_acceptance"]["value"], "share", d["first_pass_acceptance"]["definition"],
                num=d["first_pass_acceptance"]["accepted"], den=d["first_pass_acceptance"]["n"], withheld=d["first_pass_acceptance"]["withheld"]),
        _metric("documents", "duplicate_uploads_avoided", d["duplicate_uploads_avoided"]["value"], "count", d["duplicate_uploads_avoided"]["definition"]),
        _metric("documents", "documents_requested_per_application", d["documents_requested_per_application"]["value"], "ratio",
                d["documents_requested_per_application"]["definition"], num=d["documents_requested_per_application"]["requests"],
                den=d["documents_requested_per_application"]["applications"], withheld=d["documents_requested_per_application"]["withheld"]),
        _metric("writing", "review_turnaround", w["median_turnaround_hours"], "hours", w["definition"], n=w["reviews"], withheld=small(w["reviews"])),
        _metric("writing", "revision_rounds", w["median_revision_rounds"], "rounds", w["definition"], n=w["approved_essays"], withheld=small(w["approved_essays"])),
        _metric("writing", "sla_breaches", w["sla_breaches"], "count", w["definition"], n=w["reviews"]),
        _metric("services", "completion", c["completion"]["value"], "share", c["completion"]["definition"], num=c["completion"]["numerator"],
                den=c["completion"]["denominator"], withheld=c["completion"]["insufficient"]),
        _metric("services", "sla_breach", c["sla_breach"]["value"], "share", c["sla_breach"]["definition"], num=c["sla_breach"]["numerator"],
                den=c["sla_breach"]["denominator"], withheld=c["sla_breach"]["insufficient"]),
        _metric("services", "arrival_support_completion", c["arrival_support_completion"]["value"], "share", c["arrival_support_completion"]["definition"],
                num=c["arrival_support_completion"]["numerator"], den=c["arrival_support_completion"]["denominator"],
                withheld=c["arrival_support_completion"]["insufficient"]),
    ]
    return {"period_days": days, "scope": "all organisations" if org_id is None else "your agency", "includes_demo": True, "min_n": 5, "metrics": rows}


# ------------------------------------------------------------------- V15: plan scope and optional extras

@router.get("/students/{student_id}/plan")
def student_plan(student_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """What this student bought, what is promised, what is left — plus the internal dedicated owner (V29)."""
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    return entitlements_svc.student_plan(db, sid, staff=True)


class AddOnIn(BaseModel):
    """An offer from the V29 catalogue. ``entitlement_key`` is the V15 spelling, still accepted and mapped to its code."""
    code: str | None = Field(default=None, max_length=48)
    entitlement_key: str | None = Field(default=None, max_length=48)
    quantity: int = Field(default=1, ge=1, le=10)
    #: One unit's price in cents — inside the catalogue range, or the quote. ``amount_minor`` (V15) is read as the total.
    unit_amount_minor: int | None = Field(default=None, ge=0)
    amount_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=3)
    scope: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=1000)
    subject_type: str | None = Field(default=None, pattern="^(essay|application)$")
    subject_id: str | None = None


@router.post("/students/{student_id}/add-ons", status_code=201)
def offer_add_on(student_id: str, body: AddOnIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Offer the student an additional service from the catalogue (V29 §4–§5, §20 "추가 서비스 제안").

    It is an **offer**, not a grant: the row is ``OFFERED``, it raises no limit, and the student sees the exact price
    before approving and paying. The price must sit inside the catalogue's recommended range (or be a written quote
    with its scope); nothing defaults to a range end or a midpoint.
    """
    from app.services import addons as addons_svc

    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    code = body.code
    if code is None and body.entitlement_key:
        d = entitlements_svc.add_on_for_key(body.entitlement_key)
        if d is None:
            raise HTTPException(422, "This part of the plan cannot be extended with an add-on.")
        code = d["code"]
    if code is None:
        raise HTTPException(422, "Choose a service from the catalogue.")
    if body.currency and body.currency != "USD":
        raise HTTPException(422, {"code": "ADD_ON_CURRENCY", "message": "Hangyul's own services are priced in USD."})
    unit = body.unit_amount_minor
    if unit is None and body.amount_minor is not None:
        unit = body.amount_minor // body.quantity if body.amount_minor % body.quantity == 0 else -1
    row = addons_svc.offer(db, p, sid, code=code, quantity=body.quantity, unit_amount_minor=unit, scope=body.scope, note=body.note,
                           subject_type=body.subject_type, subject_id=parse_uuid(body.subject_id) if body.subject_id else None)
    db.commit()
    return {"id": str(row.id), "status": row.status.value, "amount_minor": row.amount_minor, "currency": row.currency}


@router.delete("/students/{student_id}/add-ons/{add_on_id}", status_code=204)
def withdraw_add_on(student_id: str, add_on_id: str, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """Withdraw an offer the student has not paid for yet."""
    from app.services import addons as addons_svc

    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    row = db.get(ServiceAddOn, parse_uuid(add_on_id))
    if row is None or row.user_id != sid:
        raise HTTPException(404, "Add-on not found")
    addons_svc.cancel(db, p, row)
    db.commit()


class ServiceTermIn(BaseModel):
    """The dates a contract leaves to be established when the service begins (V29 §11). Explicit, never invented."""
    service_started_at: str | None = None
    service_ends_at: str | None = None
    arrival_at: str | None = None
    dedicated_owner_user_id: str | None = None


@router.patch("/students/{student_id}/service-term")
def set_service_term(student_id: str, body: ServiceTermIn, p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    sid = parse_uuid(student_id)
    ensure_student_access(db, p, sid)
    eng = entitlements_svc.active_engagement(db, sid)
    if eng is None:
        raise HTTPException(409, {"code": "NO_PLAN", "message": "This student has no active plan."})
    changes = {}
    for f in ("service_started_at", "service_ends_at", "arrival_at"):
        v = getattr(body, f)
        if v is not None:
            try:
                dt = datetime.fromisoformat(v)
            except ValueError:
                raise HTTPException(422, f"{f} must be an ISO date-time.") from None
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            setattr(eng, f, dt)
            changes[f] = dt.isoformat()
    if eng.service_started_at and eng.service_ends_at and eng.service_ends_at <= eng.service_started_at:
        raise HTTPException(422, {"code": "TERM_INVALID", "message": "The service must end after it starts."})
    if body.dedicated_owner_user_id is not None:
        owner = parse_uuid(body.dedicated_owner_user_id)
        member = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == owner, OrganizationMember.organization_id == p.org_id)) if p.org_id else None
        if member is None and not p.is_hangyul:
            raise HTTPException(422, "The dedicated owner must belong to your organisation.")
        eng.dedicated_owner_user_id = owner
        changes["dedicated_owner_user_id"] = str(owner)
    entitlements_svc.recompute_dates(eng)
    audit(db, action="engagement.term", entity_type="service_engagement", entity_id=eng.id, actor=p, subject_user_id=sid, detail=changes)
    from app.services.tasks_engine import generate_for_student

    generate_for_student(db, sid)
    db.commit()
    return entitlements_svc.student_plan(db, sid, staff=True)


@router.get("/plan-utilization")
def plan_utilization(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    """**Service delivery** — the fourth of the manager's four Insights visuals (brief Part 15).

    What a manager needs to see here, in the brief's own words: Premium cases exceeding capacity, unused
    included consultations, plan scope overruns, and cases approaching a service deadline. All four are
    properties of the *caseload against what was sold*, which is a question nothing in the product could
    answer before V15.

    Deliberately **not** revenue. This is how much of what was promised has been delivered, not how much it
    was worth — billing analytics on an operations screen is the failure mode the benchmark records for this
    whole product category (docs/qa/v15/COMPETITIVE_OPERATIONS_AUDIT.md §4).
    """
    # The same scope every other agency list uses: this organisation's active cases, narrowed to the
    # counsellor's own when the reader is a counsellor rather than a manager.
    sids = list(db.scalars(agency_student_ids_subquery(p)).all())

    rows: dict[str, dict] = {}
    at_limit = over = offers = unused_followups = 0
    for sid in sids:
        plan = entitlements_svc.student_plan(db, sid)
        if plan is None:
            continue
        r = rows.setdefault(plan["code"], {"code": plan["code"], "students": 0, "at_limit": 0, "over": 0, "add_ons": 0})
        r["students"] += 1
        counted = [u for u in plan["usage"] if u["limit"] is not None and u["limit"] > 0]
        if any(u["used"] > u["limit"] for u in counted):
            r["over"] += 1
            over += 1
        elif any(u["remaining"] == 0 for u in counted):
            r["at_limit"] += 1
            at_limit += 1
        if any(a["status"] == "APPROVED" for a in plan["add_ons"]):
            r["add_ons"] += 1
        if any(a["status"] == "OFFERED" for a in plan["add_ons"]):
            offers += 1
        # An included follow-up consultation nobody has used: promised capacity sitting idle.
        fu = next((u for u in plan["usage"] if u["key"] == "follow_up_consultations"), None)
        if fu and fu["limit"] and fu["used"] == 0:
            unused_followups += 1

    order = {"BASIC": 0, "ALL_IN_ONE": 1, "PREMIUM": 2}
    return {
        "caseload": len(sids),
        "with_plan": sum(r["students"] for r in rows.values()),
        "by_plan": sorted(rows.values(), key=lambda r: order.get(r["code"], 9)),
        "at_limit": at_limit,
        "over": over,
        "open_offers": offers,
        "unused_follow_ups": unused_followups,
        "definition": "Counted per active case: 'at limit' has at least one allowance fully used, 'over' has "
                      "one exceeded. Usage is derived from the records that prove the work, not from a counter.",
    }
