"""V6 Hangyul operations overview: "what is at risk across agencies, universities, services and data right now?"

Hangyul staff only (other principals get the same 404 as any record outside their tenant — see services/access.forbidden).
Every figure is computed with the rule the linked list already uses, so a number opens exactly the records it counts:
  * document reviews: caseload.REVIEW_DOCS + caseload.REVIEW_SLA_HOURS (agency Today / Documents queue)
  * essay reviews: writing.today_items (sweeps the writing SLA first; same predicate as /essays?view=overdue)
  * first responses: active assignment without first_response_at past first_response_due_at (/students?sla=1)
  * overdue tasks: collab.team_task_scope + caseload.OPEN (/tasks?view=overdue)
  * service cases: concierge.in_view / is_overdue (/services?view=…)
  * submissions waiting on agencies: applications in READY (STATE_MAP: waiting on agency)
  * university document requests: DocumentRequest OPEN (/students?view=requested)
  * source freshness: open FreshnessReview items grouped by reason and kind (/hq/sources)
"""
from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.common import iso
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.models import (
    AgencyAssignment,
    Application,
    Document,
    FreshnessReview,
    Organization,
    Source,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.business import Order
from app.models.enums import ApplicationStatus, AssignmentStatus, OrderStatus, OrgType, VerificationStatus
from app.models.university_ops import DocumentRequest
from app.models.v5_concierge import ServiceCase
from app.services import caseload
from app.services import concierge as concierge_svc
from app.services import writing as writing_svc
from app.services.access import forbidden

router = APIRouter(prefix="/agency/hq", tags=["hq"])

# Service types the overview breaks out (the rest are summed under "other").
SERVICE_GROUPS = {
    "AIRPORT_PICKUP": "pickup",
    "DORMITORY": "housing", "HOUSING_SEARCH": "housing", "TEMPORARY_HOUSING": "housing",
    "VISA_SUPPORT": "visa",
}
RISK_ORDER = [VerificationStatus.CONFLICT.value, VerificationStatus.CHANGED.value, VerificationStatus.REVIEW_DUE.value]


def require_hangyul(p: Principal = Depends(require_agency_or_hangyul)) -> Principal:
    if not p.is_hangyul:
        raise forbidden()
    return p


def _count(db: Session, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0


@router.get("/overview")
def overview(p: Principal = Depends(require_hangyul), db: Session = Depends(get_db)):
    from app.api.v1.collab import team_task_scope

    now = utcnow()
    today = now.astimezone(concierge_svc.SEOUL).date()

    # student → agency (active assignment); everything per agency is attributed through this one map.
    student_org: dict[uuid.UUID, uuid.UUID] = dict(db.execute(
        select(AgencyAssignment.student_user_id, AgencyAssignment.organization_id).where(AgencyAssignment.status == AssignmentStatus.ACTIVE)).all())
    agencies = db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY).order_by(Organization.name)).all()
    per: dict[uuid.UUID, Counter] = defaultdict(Counter)
    for org_id in student_org.values():
        per[org_id]["students"] += 1

    # V9 scale: one query for every attributed student's name instead of one db.get per row (411 queries at 1,300 students).
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(list(student_org)))).all()) if student_org else {}

    def name(uid):
        if not uid:
            return None
        if uid in names:
            return names[uid]
        u = db.get(User, uid)
        return u.full_name if u else None

    # --- document reviews past 48 h
    docs_q = select(Document).where(Document.status.in_(caseload.REVIEW_DOCS))
    late_cut = now - timedelta(hours=caseload.REVIEW_SLA_HOURS)
    docs_waiting = _count(db, docs_q)
    late_docs = db.scalars(docs_q.where(Document.updated_at < late_cut).order_by(Document.updated_at)).all()
    for d in late_docs:
        if d.owner_user_id in student_org:
            per[student_org[d.owner_user_id]]["documents_late"] += 1
    oldest_doc = late_docs[0] if late_docs else None

    # --- essay reviews past their promised time (writing SLA, swept first)
    writing_rows = writing_svc.today_items(db, p)
    essays_over = [w for w in writing_rows if w["kind"] == "WRITING_OVERDUE"]
    for w in essays_over:
        org = student_org.get(uuid.UUID(w["student"]["id"]))
        if org:
            per[org]["essays_overdue"] += 1

    # --- first responses
    fr_q = select(AgencyAssignment).where(AgencyAssignment.status == AssignmentStatus.ACTIVE, AgencyAssignment.first_response_at.is_(None))
    fr_breached = db.scalars(fr_q.where(AgencyAssignment.first_response_due_at < now).order_by(AgencyAssignment.first_response_due_at)).all()
    fr_risk = _count(db, fr_q.where(AgencyAssignment.first_response_due_at >= now,
                                    AgencyAssignment.first_response_due_at < now + timedelta(hours=caseload.SLA_RISK_HOURS)))
    for a in fr_breached:
        per[a.organization_id]["first_response_breached"] += 1

    # --- overdue tasks (owner organisation)
    overdue_tasks_q = team_task_scope(select(Task), p).where(Task.status.in_(caseload.OPEN), Task.due_at < now)
    overdue_tasks = _count(db, overdue_tasks_q)
    for org_id, n in db.execute(select(Task.owner_org_id, func.count()).where(Task.status.in_(caseload.OPEN), Task.due_at < now)
                                .group_by(Task.owner_org_id)).all():
        if org_id:
            per[org_id]["overdue_tasks"] += n

    # --- service cases (concierge rules)
    cases = db.scalars(concierge_svc.scope_cases(select(ServiceCase), p)).all()
    svc: dict[str, Counter] = defaultdict(Counter)
    at_risk = []
    for c in cases:
        if concierge_svc.is_closed(c):
            continue
        g = SERVICE_GROUPS.get(c.case_type, "other")
        overdue = concierge_svc.is_overdue(c, now)
        unassigned = c.owner_user_id is None
        needs = concierge_svc.in_view(c, "needs_assignment", now=now, today=today, hangyul=True)
        svc[g]["open"] += 1
        svc[g]["overdue"] += overdue
        svc[g]["unassigned"] += unassigned
        svc[g]["needs_assignment"] += needs
        org = c.agency_org_id or student_org.get(c.student_user_id)
        if overdue and org:
            per[org]["services_overdue"] += 1
        if overdue or unassigned:
            at_risk.append((not overdue, c.sla_due_at or c.due_at or now, c))
    at_risk.sort(key=lambda x: (x[0], x[1]))
    service_totals = Counter()
    for g in svc.values():
        service_totals.update(g)

    # --- submissions waiting on agencies (READY = agency submits next)
    ready = db.execute(select(Application.agency_org_id, func.count()).where(Application.status == ApplicationStatus.READY)
                       .group_by(Application.agency_org_id)).all()
    for org_id, n in ready:
        if org_id:
            per[org_id]["ready_to_submit"] += n
    ready_total = sum(n for _, n in ready)
    # Authorised agency submissions (V6): the student consented, the agency must now submit and record evidence.
    from app.models.v5_success import SubmissionAuthorization
    authorised = db.scalar(select(func.count()).select_from(SubmissionAuthorization)
                           .join(Application, Application.id == SubmissionAuthorization.application_id)
                           .where(SubmissionAuthorization.status == "ACTIVE", Application.status == ApplicationStatus.READY)) or 0

    # --- university document requests still open
    req_rows = db.execute(select(DocumentRequest, Application.agency_org_id, Application.student_user_id, University.name_en)
                          .join(Application, Application.id == DocumentRequest.application_id)
                          .join(University, University.id == Application.university_id)
                          .where(DocumentRequest.status == "OPEN").order_by(DocumentRequest.requested_at)).all()
    req_overdue = 0
    by_uni: Counter = Counter()
    for r, _org_id, _sid, uni in req_rows:
        by_uni[uni] += 1
        late = bool(r.due_date and r.due_date < today)
        req_overdue += late

    # Per agency and in total: students the university is waiting on (same predicate as /students?view=requested).
    for org_id, n in db.execute(select(AgencyAssignment.organization_id, func.count())
                                .join(StudentProfile, StudentProfile.user_id == AgencyAssignment.student_user_id)
                                .where(AgencyAssignment.status == AssignmentStatus.ACTIVE, caseload.pred_university_requested())
                                .group_by(AgencyAssignment.organization_id)).all():
        per[org_id]["university_requests"] += n
    req_students = _count(db, select(StudentProfile.user_id).where(caseload.pred_university_requested()))

    # --- students waiting on the agency (STATE_MAP "waiting on us")
    for org_id, n in db.execute(select(AgencyAssignment.organization_id, func.count())
                                .join(StudentProfile, StudentProfile.user_id == AgencyAssignment.student_user_id)
                                .where(AgencyAssignment.status == AssignmentStatus.ACTIVE, caseload.pred_waiting_on("us", now))
                                .group_by(AgencyAssignment.organization_id)).all():
        per[org_id]["waiting_on_us"] += n

    # --- source freshness by risk
    fresh = db.execute(select(FreshnessReview.reason, FreshnessReview.entity_type, Source.source_type, func.count())
                       .outerjoin(Source, Source.id == FreshnessReview.source_id)
                       .where(FreshnessReview.resolved_at.is_(None))
                       .group_by(FreshnessReview.reason, FreshnessReview.entity_type, Source.source_type)).all()
    groups: dict[str, Counter] = defaultdict(Counter)
    for reason, entity_type, source_type, n in fresh:
        kind = (source_type.value if source_type is not None else "OTHER") if entity_type == "source" else entity_type
        groups[reason.value][kind] += n
    freshness = [{"reason": r, "total": sum(groups[r].values()),
                  "kinds": [{"kind": k, "count": n} for k, n in groups[r].most_common()]}
                 for r in RISK_ORDER + sorted(set(groups) - set(RISK_ORDER)) if groups.get(r)]

    rows = []
    for o in agencies:
        c = per.get(o.id, Counter())
        breaches = c["documents_late"] + c["essays_overdue"] + c["first_response_breached"] + c["services_overdue"]
        rows.append({"id": str(o.id), "name": o.name, "country_code": o.country_code, "students": c["students"],
                     "overdue_tasks": c["overdue_tasks"], "sla_breaches": breaches, "documents_late": c["documents_late"],
                     "essays_overdue": c["essays_overdue"], "first_response_breached": c["first_response_breached"],
                     "services_overdue": c["services_overdue"], "waiting_on_us": c["waiting_on_us"],
                     "ready_to_submit": c["ready_to_submit"], "university_requests": c["university_requests"]})
    rows.sort(key=lambda r: (-r["sla_breaches"], -r["overdue_tasks"], -r["waiting_on_us"], r["name"]))

    first_case = at_risk[0][2] if at_risk else None

    # --- V8: "Where is the ecosystem failing?" — one severity-ordered list; every row opens the records it counts.
    cap = {o.id: o.capacity_active_cases for o in agencies}
    for r in rows:
        c = cap.get(uuid.UUID(r["id"]))
        r["capacity"] = c
        r["load"] = round(r["students"] / c, 2) if c else None
    overloaded = [r for r in rows if r["load"] is not None and r["load"] > 1]
    visa_blocked = _count(db, select(StudentProfile.user_id).where(caseload.pred_visa_blocked(now)))
    pay_failed = _count(db, select(Order.id).where(Order.status == OrderStatus.FAILED, Order.updated_at >= now - timedelta(days=30)))
    pay_stuck = _count(db, select(Order.id).where(Order.status == OrderStatus.PENDING, Order.created_at < now - timedelta(hours=24)))
    conflicts = sum(g["total"] for g in freshness if g["reason"] == VerificationStatus.CONFLICT.value)
    stale = sum(g["total"] for g in freshness) - conflicts

    def fail(code, severity, count, link, items=None, **extra):
        # V9 (REPORT §61 H1): every failure carries its exact records (`items`, ≤ 20, oldest first) for in-place drill-down.
        return {"code": code, "severity": severity, "count": count, "link": link, "items": (items or [])[:20], **extra}

    def stu(uid, since, link, **x):
        return {"student": name(uid), "student_id": str(uid) if uid else None, "since": iso(since) if hasattr(since, "isoformat") else since,
                "link": link, **x}

    # V9: application blockers — not yet submitted, deadline within 7 days, required items still missing.
    from app.services import agency_ops as ops_svc
    from app.services import submission as submission_svc

    all_ids = list(student_org)
    blockers = ops_svc._deadlines(db, all_ids, {}, {}, now, days=7) if all_ids else {"items": []}
    app_block = [{"student": name(uuid.UUID(i["student_id"])), "student_id": i["student_id"], "since": i["deadline"], "university": i["university"],
                  "detail": i["items_remaining"], "link": i["link"]} for i in blockers["items"]]
    # V9: submission blockers — failed attempts and confirmations missing > 2 days (services/submission.submission_pipeline).
    pipe = submission_svc.submission_pipeline(db, p)
    sub_issue = [i for i in pipe["items"] if i["state"] == "issue"]
    sub_missing = [i for i in pipe["items"] if i["state"] == "confirmation_missing"]
    as_items = lambda rows: [{"student": r["student"]["full_name"], "student_id": r["student"]["id"], "since": r["since"], "university": r["university"],  # noqa: E731
                              "link": r["link"]} for r in rows]
    # V9: housing / arrival failures — open arrival cases in a failure state (no-show, dormitory not assigned).
    arrival_fail = [c for c in cases if not concierge_svc.is_closed(c) and c.status in ("NO_SHOW", "NOT_ASSIGNED")]
    # V9: integration failures — required production integrations that are not ACTIVE (/admin/readiness).
    from app.api.v1.readiness import REQUIRED as READY_REQUIRED
    from app.api.v1.readiness import integrations as ready_items

    integ = [i for i in ready_items(db) if i["key"] in READY_REQUIRED and i["status"] != "ACTIVE"]
    visa_rows = db.scalars(select(StudentProfile.user_id).where(caseload.pred_visa_blocked(now))).all()
    pay_failed_rows = db.scalars(select(Order).where(Order.status == OrderStatus.FAILED, Order.updated_at >= now - timedelta(days=30))
                                 .order_by(Order.updated_at)).all()
    pay_stuck_rows = db.scalars(select(Order).where(Order.status == OrderStatus.PENDING, Order.created_at < now - timedelta(hours=24))
                                .order_by(Order.created_at)).all()
    svc_late = sorted([c for c in cases if not concierge_svc.is_closed(c) and concierge_svc.is_overdue(c, now)], key=lambda c: c.sla_due_at or now)
    svc_unassigned = [c for c in cases if concierge_svc.in_view(c, "needs_assignment", now=now, today=today, hangyul=True)]
    req_late_rows = [(r, sid, uni) for r, _o, sid, uni in req_rows if r.due_date and r.due_date < today]
    req_open_rows = [(r, sid, uni) for r, _o, sid, uni in req_rows if not (r.due_date and r.due_date < today)]

    failures = [
        fail("first_response", "critical", len(fr_breached), "/students?sla=1",
             [stu(a.student_user_id, a.first_response_due_at, f"/students/{a.student_user_id}?tab=messages") for a in fr_breached],
             oldest={"student": name(fr_breached[0].student_user_id), "since": iso(fr_breached[0].first_response_due_at)} if fr_breached else None),
        fail("documents_late", "critical", len(late_docs), "/documents",
             [stu(d.owner_user_id, d.updated_at, f"/documents?doc={d.id}", detail=d.category.value) for d in late_docs],
             oldest={"student": name(oldest_doc.owner_user_id), "since": iso(oldest_doc.updated_at)} if oldest_doc else None),
        fail("essays_late", "critical", len(essays_over), "/essays?view=overdue",
             [{"student": w["student"]["name"], "student_id": w["student"]["id"], "since": w["due_at"], "link": w["link"]} for w in essays_over],
             oldest={"student": essays_over[0]["student"]["name"], "since": essays_over[0]["due_at"]} if essays_over else None),
        fail("application_blocked", "critical", len(app_block), "/students?view=deadline7", app_block,
             oldest={"student": app_block[0]["student"], "since": app_block[0]["since"]} if app_block else None),
        fail("submission_issue", "critical", len(sub_issue), "/submissions?state=issue", as_items(sub_issue)),
        fail("confirmation_missing", "critical", len(sub_missing), "/submissions?state=confirmation_missing", as_items(sub_missing),
             oldest={"student": sub_missing[0]["student"]["full_name"], "since": sub_missing[0]["since"]} if sub_missing else None),
        fail("university_requests_late", "critical", req_overdue, "/students?view=requested",
             [stu(sid, r.due_date.isoformat(), f"/students/{sid}?tab=applications", university=uni) for r, sid, uni in req_late_rows]),
        fail("visa_blocked", "critical", visa_blocked, "/students?view=visa_blocked", [stu(u, None, f"/students/{u}?tab=visa") for u in visa_rows]),
        fail("payments_failed", "critical", pay_failed, "/payments?status=FAILED", [stu(o.user_id, o.updated_at, "/payments?status=FAILED") for o in pay_failed_rows]),
        fail("arrival_failed", "critical", len(arrival_fail), "/services?view=overdue",
             [stu(c.student_user_id, c.updated_at, f"/services?case={c.id}", detail=c.case_type) for c in arrival_fail]),
        fail("integrations", "high", len(integ), "/hq/readiness", [{"student": None, "detail": i["key"], "status": i["status"], "link": "/hq/readiness"} for i in integ]),
        fail("agencies_overloaded", "high", len(overloaded), "/hq/agencies?sort=load",
             [{"student": None, "detail": r["name"], "load": r["load"], "link": f"/students?agency={r['id']}"} for r in overloaded],
             agencies=[r["name"] for r in overloaded][:3]),
        fail("services_late", "high", service_totals["overdue"], "/services?view=overdue",
             [stu(c.student_user_id, c.sla_due_at, f"/services?case={c.id}", detail=c.case_type) for c in svc_late]),
        fail("university_requests", "high", len(req_rows) - req_overdue, "/students?view=requested",
             [stu(sid, r.requested_at, f"/students/{sid}?tab=applications", university=uni) for r, sid, uni in req_open_rows]),
        fail("payments_stuck", "high", pay_stuck, "/payments?status=PENDING", [stu(o.user_id, o.created_at, "/payments?status=PENDING") for o in pay_stuck_rows]),
        fail("sources_conflict", "high", conflicts, "/hq/sources?reason=CONFLICT"),
        fail("services_unassigned", "medium", service_totals["needs_assignment"], "/services?view=needs_assignment",
             [stu(c.student_user_id, c.created_at, f"/services?case={c.id}", detail=c.case_type) for c in svc_unassigned]),
        fail("tasks_overdue", "medium", overdue_tasks, "/tasks?view=overdue"),
        fail("sources_stale", "medium", stale, "/hq/sources"),
    ]
    sev = {"critical": 0, "high": 1, "medium": 2}
    failing = sorted([f for f in failures if f["count"]], key=lambda f: (sev[f["severity"]], -f["count"]))
    clear = [f["code"] for f in failures if not f["count"]]
    return {
        "failures": failing, "all_clear": clear,
        "generated_at": iso(now),
        "sla": {
            "documents": {"late": len(late_docs), "waiting": docs_waiting, "sla_hours": caseload.REVIEW_SLA_HOURS,
                          "oldest": {"student": name(oldest_doc.owner_user_id), "category": oldest_doc.category.value, "since": iso(oldest_doc.updated_at)} if oldest_doc else None,
                          "queue": "/documents"},
            "essays": {"overdue": len(essays_over), "oldest": essays_over[0] if essays_over else None, "queue": "/essays?view=overdue"},
            "first_response": {"breached": len(fr_breached), "at_risk": fr_risk,
                               "oldest": {"student": name(fr_breached[0].student_user_id), "due_at": iso(fr_breached[0].first_response_due_at)} if fr_breached else None,
                               "queue": "/students?sla=1"},
            "tasks": {"overdue": overdue_tasks, "queue": "/tasks?view=overdue"},
        },
        "services": {
            "open": service_totals["open"], "overdue": service_totals["overdue"], "unassigned": service_totals["unassigned"],
            "needs_assignment": service_totals["needs_assignment"],
            "groups": [{"group": g, **{k: svc[g][k] for k in ("open", "overdue", "unassigned", "needs_assignment")}}
                       for g in ("pickup", "housing", "visa", "other") if svc[g]["open"]],
            "next": {"type": first_case.case_type, "student": name(first_case.student_user_id), "overdue": concierge_svc.is_overdue(first_case, now),
                     "sla_due_at": iso(first_case.sla_due_at)} if first_case else None,
        },
        "submissions": {"ready": ready_total, "queue": "/applications?status=READY", "authorised": authorised, "authorised_queue": "/submissions"},
        "university_requests": {"open": len(req_rows), "overdue": req_overdue, "students": req_students,
                                "universities": [{"name": u, "count": n} for u, n in by_uni.most_common(5)],
                                "queue": "/students?view=requested"},
        "freshness": {"open": sum(g["total"] for g in freshness), "groups": freshness, "queue": "/hq/sources"},
        "agencies": rows,
    }


@router.get("/agencies/quality")
def partner_quality(days: int = Query(180, ge=30, le=730), p: Principal = Depends(require_hangyul), db: Session = Depends(get_db)):
    """V9 (REPORT §61 H2) "Which partner agency needs help?" — process metrics per agency (response time, first-pass
    document quality, correction loops, deadline compliance, completeness at submission, university extra-document rate,
    visa extra-document rate, arrival completion), each with cohort, numerator/denominator/n, n < 5 withheld. Agencies are
    listed by name — never ranked, and never by admission rate (decisions belong to universities)."""
    from app.services import agency_performance

    agencies = db.scalars(select(Organization).where(Organization.type == OrgType.AGENCY).order_by(Organization.name)).all()
    rows = []
    for o in agencies:
        q = agency_performance.process_quality(db, o.id, days=days, keys=agency_performance.PARTNER_KEYS)
        rows.append({"id": str(o.id), "name": o.name, "country_code": o.country_code, "students": q["students_in_scope"],
                     "registration_status": o.registration_status if o.registration_status in ("RECORDED", "VERIFIED") else "NOT_RECORDED",
                     "metrics": {m["key"]: m for m in q["metrics"]}})
    return {"generated_at": iso(utcnow()), "days": days, "min_n": 5, "keys": list(agency_performance.PARTNER_KEYS), "agencies": rows,
            "note": "Process quality, not outcomes: no admission rates, no ranking. Satisfaction is not shown — no verified survey data exists."}


# ============================================================================================ V9 launch readiness (H3)

CATEGORIES = ("NEEDS_LEGAL_APPROVAL", "NEEDS_PROVIDER_AGREEMENT", "NEEDS_CREDENTIALS", "NEEDS_INFRASTRUCTURE", "NEEDS_BUSINESS_DATA",
              "NEEDS_HUMAN_REVIEW", "CODE_COMPLETE")
# Integration key → category when the integration is not ACTIVE (what is missing is a credential, a contract or infrastructure).
INTEGRATION_CATEGORY = {
    "database": "NEEDS_INFRASTRUCTURE", "secrets": "NEEDS_CREDENTIALS", "demo_signin": "NEEDS_INFRASTRUCTURE", "file_storage": "NEEDS_INFRASTRUCTURE",
    "malware_scan": "NEEDS_INFRASTRUCTURE", "payments": "NEEDS_PROVIDER_AGREEMENT", "channel_email": "NEEDS_CREDENTIALS",
    "channel_whatsapp": "NEEDS_PROVIDER_AGREEMENT", "channel_kakao": "NEEDS_PROVIDER_AGREEMENT", "channel_zalo": "NEEDS_PROVIDER_AGREEMENT",
    "channel_sms": "NEEDS_PROVIDER_AGREEMENT", "push": "NEEDS_CREDENTIALS", "sso": "NEEDS_CREDENTIALS", "ai_provider": "NEEDS_PROVIDER_AGREEMENT",
    "flight_data": "NEEDS_PROVIDER_AGREEMENT", "channel_in_app": "NEEDS_INFRASTRUCTURE",
}


def launch_items(db: Session) -> list[dict]:
    """Every launch dependency, classified from real settings and real records. An item is CODE_COMPLETE only when it
    works with the current configuration (integration ACTIVE) or needs nothing outside the code; nothing is called
    active because a variable exists (readiness.integrations already refuses that)."""
    from sqlalchemy import func as f

    from app.api.v1.readiness import REQUIRED, integrations
    from app.models import Locale, Program, ServicePrice, SubmissionConnector
    from app.models.v5_concierge import HousingListing, Vendor

    out = []
    for i in integrations(db):
        cat = "CODE_COMPLETE" if i["status"] == "ACTIVE" else INTEGRATION_CATEGORY.get(i["key"], "NEEDS_INFRASTRUCTURE")
        out.append({"key": i["key"], "group": i["group"], "category": cat, "required": i["key"] in REQUIRED, "integration_status": i["status"],
                    "evidence": i.get("note") or (f"{i['setting']}" if i.get("setting") else None), "requires": i["requires"], "fallback": i.get("fallback")})

    def add(key, group, cat, required, evidence, requires=None, fallback=None):
        out.append({"key": key, "group": group, "category": cat, "required": required, "integration_status": None, "evidence": evidence,
                    "requires": requires or [], "fallback": fallback})

    # OCR: extraction is rule-based (PDF text layer + MRZ); no OCR engine or provider in this build.
    add("ocr", "data", "NEEDS_PROVIDER_AGREEMENT", False, "Rule-based extraction only (PDF text layer, passport MRZ); images are not read.",
        ["OCR provider (or self-hosted engine) + data-processing agreement"], "Staff read scanned images.")
    # Housing inventory: real (non-demo) listings with a provider agreement.
    real_listings = db.scalar(select(f.count()).select_from(HousingListing).where(
        HousingListing.is_demo.is_(False), HousingListing.verification_status.in_(["PROVIDER_CONFIRMED", "STAFF_VERIFIED"]))) or 0
    add("housing_inventory", "data", "CODE_COMPLETE" if real_listings else "NEEDS_BUSINESS_DATA", False,
        f"{real_listings} confirmed, non-sample housing listings.", ["listings from contracted housing providers"], "Students are referred to university dormitory pages.")
    partners = [v for v in db.scalars(select(Vendor).where(Vendor.is_demo.is_(False))).all() if concierge_svc.agreement_active(v)]
    add("provider_agreements", "services", "CODE_COMPLETE" if partners else "NEEDS_PROVIDER_AGREEMENT", False,
        f"{len(partners)} providers with an active, recorded agreement.", ["signed agreements with pickup / housing providers"], "No provider is called a partner.")
    # Scheduled jobs: exports, reminders and freshness scans have no worker process in this build.
    add("scheduled_jobs_worker", "platform", "NEEDS_INFRASTRUCTURE", True, "No scheduler/worker process is deployed; scans and exports run on request.",
        ["a job runner (cron / queue worker) in production"], "Staff trigger scans and exports by hand.")
    api_conns = db.scalar(select(f.count()).select_from(SubmissionConnector).where(SubmissionConnector.method.in_(["DIRECT_API", "PARTNER_API"]),
                                                                                    SubmissionConnector.is_demo.is_(False))) or 0
    add("university_rail_apis", "submission", "CODE_COMPLETE" if api_conns else "NEEDS_PROVIDER_AGREEMENT", False,
        f"{api_conns} university/application-provider API connectors; UWAY, JinhakApply and Gradnet publish no agency API.",
        ["an API agreement with a university or application provider"], "Guided hand-off: the student submits on the official portal.")
    # Legal
    add("legal_pages", "legal", "NEEDS_LEGAL_APPROVAL", True, "Terms and privacy pages exist; their text has not been approved by counsel.",
        ["review by Korean counsel (PIPA, e-commerce)"])
    add("pipa_cross_border", "legal", "NEEDS_LEGAL_APPROVAL", True, "Cross-border transfer consent wording is drafted, not approved.", ["PIPA review"])
    add("moe_standard_agreement", "legal", "NEEDS_LEGAL_APPROVAL", True, "MOE standard university–agency agreement announced (Oct 2026); text not public.",
        ["the published agreement text, then disclosures per case"])
    # Business data
    total = db.scalar(select(f.count()).select_from(Program).where(Program.is_active.is_(True))) or 0
    verified = db.scalar(select(f.count()).select_from(Program).where(Program.is_active.is_(True), Program.verification_status == "VERIFIED")) or 0
    add("verified_catalogue", "data", "CODE_COMPLETE" if total and verified == total else "NEEDS_BUSINESS_DATA", True,
        f"{verified} of {total} active programs verified against an official source.", ["verification of every published program"])
    demo_prices = db.scalar(select(f.count()).select_from(ServicePrice).where(ServicePrice.is_demo.is_(True))) or 0
    add("service_pricing", "money", "NEEDS_BUSINESS_DATA" if demo_prices else "CODE_COMPLETE", True, f"{demo_prices} service prices are sample prices.",
        ["approved Hangyul service prices"])
    recorded = db.scalar(select(f.count()).select_from(Organization).where(Organization.type == OrgType.AGENCY,
                                                                          Organization.registration_status.in_(["RECORDED", "VERIFIED"]))) or 0
    agencies = db.scalar(select(f.count()).select_from(Organization).where(Organization.type == OrgType.AGENCY)) or 0
    add("agency_registration", "partners", "CODE_COMPLETE" if agencies and recorded == agencies else "NEEDS_BUSINESS_DATA", False,
        f"{recorded} of {agencies} partner agencies have a recorded registration.", ["each agency's legal name and registration"])
    # Human review
    reviewed = db.scalar(select(f.count()).select_from(Locale).where(Locale.translation_status == "HUMAN_REVIEWED")) or 0
    add("translation_review", "language", "CODE_COMPLETE" if reviewed else "NEEDS_HUMAN_REVIEW", True,
        f"{reviewed} locales reviewed by a named human; the rest are machine drafts or synthetic reviews.", ["a native reviewer per launch locale"])
    add("usability_research", "research", "NEEDS_HUMAN_REVIEW", False, "No moderated sessions with real students, counselors or university staff are recorded.",
        ["the four V8 research protocols run with real participants"])
    order = {c: i for i, c in enumerate(CATEGORIES)}
    out.sort(key=lambda r: (r["category"] == "CODE_COMPLETE", not r["required"], order[r["category"]], r["key"]))
    return out


@router.get("/readiness")
def launch_readiness(p: Principal = Depends(require_hangyul), db: Session = Depends(get_db)):
    """V9 (REPORT §61 H3) "What still blocks launch?" — each item classified CODE-COMPLETE · NEEDS CREDENTIALS · NEEDS
    PROVIDER AGREEMENT · NEEDS BUSINESS DATA · NEEDS LEGAL APPROVAL · NEEDS HUMAN REVIEW · NEEDS INFRASTRUCTURE."""
    from app.core.config import get_settings

    items = launch_items(db)
    counts = {c: sum(1 for i in items if i["category"] == c) for c in CATEGORIES}
    blocking = [i["key"] for i in items if i["required"] and i["category"] != "CODE_COMPLETE"]
    return {"generated_at": iso(utcnow()), "environment": get_settings().env, "categories": list(CATEGORIES), "counts": counts,
            "blocking": blocking, "ready_for_launch": not blocking, "items": items}


@router.get("/admission-guides/review")
def admission_guide_review(p: Principal = Depends(require_hangyul), db: Session = Depends(get_db)):
    """V27 (REPORT §357): university × level with preparing applications and no VERIFIED guide, then every guide a
    person must look at (STALE, CONFLICT, REVIEW_REQUIRED). Ordered by students waiting."""
    from app.services.guides import review_queue

    return {"items": review_queue(db)}
