"""Operational analytics. Every metric returned carries a definition. Rates with small denominators are
returned as null with `insufficient_data` so dashboards stay honest instead of showing noisy percentages."""
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    ArrivalPlan,
    DailyMetric,
    DocumentReview,
    Organization,
    OrganizationMember,
    PartnerContract,
    Program,
    ProgramIntake,
    SavedUniversity,
    StudentEnrollment,
    StudentProfile,
    StudentTerm,
    Task,
    User,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus as S,
)
from app.models.enums import (
    AssignmentStatus,
    AwardStatus,
    EnrollmentStatus,
    TaskStatus,
)
from app.services.state_machine import reached

MIN_DENOMINATOR = 5

DEFINITIONS = {
    "new_leads": "Students newly assigned to the agency during the period.",
    "active_students": "Students with an active agency assignment right now.",
    "applications_submitted": "Applications that entered SUBMITTED during the period.",
    "offers": "Applications that entered OFFERED during the period.",
    "enrollments": "Applications that entered ENROLLED during the period.",
    "visas_issued": "Applications that entered VISA_ISSUED during the period.",
    "offer_rate": "Offers ÷ decisions (offered + rejected) for applications decided in the period.",
    "overdue_tasks": "Open tasks past their due date right now.",
    "sla_met_rate": "Share of new assignments contacted before the first-response SLA deadline (period).",
    "median_first_response_hours": "Median hours from assignment to first counselor contact (period).",
    "document_correction_rate": "Document reviews returned for correction ÷ all document reviews (period).",
    "yield": "Enrolled ÷ offers made.",
    "visa_conversion": "Visas issued ÷ tuition confirmed.",
    "no_show": "Visa issued but no arrival reported ÷ visas issued.",
    "retention": "Students still enrolled, on leave or graduated after their second term ÷ students who reached a second term.",
    "graduation_rate": "Graduated ÷ students whose expected graduation date has passed.",
    "median_processing_days": "Median days from submission to the first decision (offer, waitlist or not admitted).",
}


def rate(num: int, den: int) -> dict:
    if den < MIN_DENOMINATOR:
        return {"value": None, "numerator": num, "denominator": den, "insufficient_data": True}
    return {"value": round(num / den, 4), "numerator": num, "denominator": den, "insufficient_data": False}


def _range(days: int, end: date | None = None) -> tuple[datetime, datetime, datetime, datetime]:
    end_dt = datetime.combine(end or utcnow().date(), time.max, tzinfo=timezone.utc)
    start = end_dt - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    return start, end_dt, prev_start, start


def intake_clause(intake):
    """``intake`` is an intake key (``2027-SPRING``: every program's intake of that term) or one ProgramIntake id."""
    import re
    import uuid as _uuid

    if isinstance(intake, _uuid.UUID):
        return Application.intake_id == intake
    v = str(intake).strip()
    m = re.fullmatch(r"(\d{4})-(SPRING|SUMMER|FALL|WINTER)", v.upper())
    if m:
        return Application.intake_id.in_(select(ProgramIntake.id).where(ProgramIntake.year == int(m.group(1)), ProgramIntake.term == m.group(2)))
    try:
        return Application.intake_id == _uuid.UUID(v)
    except ValueError:
        from fastapi import HTTPException

        raise HTTPException(422, "intake must be YYYY-TERM (e.g. 2027-SPRING) or an intake id") from None


def _app_filter(stmt, *, agency_org_id=None, university_id=None, filters: dict | None = None):
    f = filters or {}
    if agency_org_id:
        stmt = stmt.where(Application.agency_org_id == agency_org_id)
    if university_id:
        stmt = stmt.where(Application.university_id == university_id)
    if f.get("nationality"):
        stmt = stmt.where(Application.student_user_id.in_(select(StudentProfile.user_id).where(StudentProfile.nationality == f["nationality"])))
    if f.get("program_id"):
        stmt = stmt.where(Application.program_id == f["program_id"])
    if f.get("degree"):
        stmt = stmt.where(Application.program_id.in_(select(Program.id).where(Program.degree_level == f["degree"])))
    if f.get("intake"):
        stmt = stmt.where(intake_clause(f["intake"]))
    if f.get("agency_id"):
        stmt = stmt.where(Application.agency_org_id == f["agency_id"])
    if f.get("university_id"):
        stmt = stmt.where(Application.university_id == f["university_id"])
    return stmt


def _entered(db, status: S, start, end, **scope) -> int:
    stmt = (
        select(func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .where(ApplicationStatusHistory.to_status == status, ApplicationStatusHistory.created_at.between(start, end))
    )
    return db.scalar(_app_filter(stmt, **scope)) or 0


def _kpi(db, status, start, end, pstart, pend, **scope) -> dict:
    cur, prev = _entered(db, status, start, end, **scope), _entered(db, status, pstart, pend, **scope)
    return {"value": cur, "previous": prev, "delta_pct": round((cur - prev) / prev * 100, 1) if prev else None}


def timeseries(db: Session, metric: str, scope_type: str, scope_id: str, weeks: int = 26) -> list[dict]:
    """Weekly series from the DailyMetric rollup table."""
    since = utcnow().date() - timedelta(weeks=weeks)
    rows = db.execute(
        select(DailyMetric.day, DailyMetric.value).where(
            DailyMetric.metric == metric, DailyMetric.scope_type == scope_type, DailyMetric.scope_id == scope_id,
            DailyMetric.dimension == "*", DailyMetric.day >= since,
        )
    ).all()
    buckets: dict[date, float] = defaultdict(float)
    for d, v in rows:
        buckets[d - timedelta(days=d.weekday())] += v
    start = since - timedelta(days=since.weekday())
    return [{"week": (start + timedelta(weeks=i)).isoformat(), "value": buckets.get(start + timedelta(weeks=i), 0)} for i in range(weeks + 1)]


def submitted_series(apps, weeks: int = 26, today: date | None = None) -> list[dict]:
    """Weekly submissions (Monday-start weeks) from ``Application.submitted_at`` — same shape as ``timeseries``."""
    today = today or utcnow().date()
    since = today - timedelta(weeks=weeks)
    start = since - timedelta(days=since.weekday())
    buckets: dict[date, int] = defaultdict(int)
    for a in apps:
        if a.submitted_at is None:
            continue
        d = a.submitted_at.date()
        if d >= start:
            buckets[d - timedelta(days=d.weekday())] += 1
    return [{"week": (start + timedelta(weeks=i)).isoformat(), "value": buckets.get(start + timedelta(weeks=i), 0)} for i in range(weeks + 1)]


def submitted_monthly(apps, months: int = 12, today: date | None = None) -> list[dict]:
    """Submissions per calendar month for the last ``months`` months (oldest first), from ``Application.submitted_at``."""
    today = today or utcnow().date()
    keys = []
    y, m = today.year, today.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    keys.reverse()
    counts: dict[str, int] = defaultdict(int)
    for a in apps:
        if a.submitted_at is not None:
            counts[a.submitted_at.strftime("%Y-%m")] += 1
    return [{"month": k, "value": counts.get(k, 0)} for k in keys]


def apps_by(db: Session, dim: str, submitted_only: bool = False, **scope) -> list[dict]:
    stmt0 = _app_filter(select(Application), **scope)
    if submitted_only:
        stmt0 = stmt0.where(Application.submitted_at.is_not(None))
    base = stmt0.subquery()
    if dim == "university":
        from app.models import University
        stmt = select(University.name_en, func.count()).join(base, base.c.university_id == University.id).group_by(University.name_en)
    elif dim == "nationality":
        stmt = select(StudentProfile.nationality, func.count()).join(base, base.c.student_user_id == StudentProfile.user_id).group_by(StudentProfile.nationality)
    elif dim == "degree":
        stmt = select(Program.degree_level, func.count()).join(base, base.c.program_id == Program.id).group_by(Program.degree_level)
    elif dim == "program":
        stmt = select(Program.name_en, func.count()).join(base, base.c.program_id == Program.id).group_by(Program.name_en)
    elif dim == "intake":
        stmt = (
            select(func.concat(ProgramIntake.year, "-", ProgramIntake.term), func.count())
            .join(base, base.c.intake_id == ProgramIntake.id)
            .group_by(ProgramIntake.year, ProgramIntake.term)
        )
    elif dim == "status":
        stmt = select(base.c.status, func.count()).group_by(base.c.status)
    elif dim == "agency":
        stmt = select(Organization.name, func.count()).join(base, base.c.agency_org_id == Organization.id).group_by(Organization.name)
    else:
        raise ValueError(dim)
    rows = db.execute(stmt).all()
    return sorted([{"key": str(k.value if hasattr(k, "value") else k), "count": c} for k, c in rows], key=lambda r: -r["count"])


FUNNEL_STEPS = [S.SUBMITTED, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PAID, S.VISA_ISSUED, S.ENROLLED]


def application_funnel(db: Session, **scope) -> list[dict]:
    apps = db.scalars(_app_filter(select(Application), **scope)).all()
    ids = [a.id for a in apps]
    hist = defaultdict(set)
    if ids:
        for app_id, st in db.execute(select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status).where(ApplicationStatusHistory.application_id.in_(ids))):
            hist[app_id].add(st)
    out = []
    for step in FUNNEL_STEPS:
        n = sum(1 for a in apps if step in hist[a.id] or reached(a.status, step))
        out.append({"stage": step.value, "count": n})
    return out


def agency_dashboard(db: Session, org_id, days: int = 30, filters: dict | None = None) -> dict:
    start, end, pstart, pend = _range(days)
    scope = {"agency_org_id": org_id, "filters": filters}
    a_scope = [AgencyAssignment.organization_id == org_id] if org_id else []

    def count_assign(s, e):
        return db.scalar(select(func.count()).select_from(AgencyAssignment).where(*a_scope, AgencyAssignment.created_at.between(s, e))) or 0

    new_cur, new_prev = count_assign(start, end), count_assign(pstart, pend)
    active = db.scalar(select(func.count()).select_from(AgencyAssignment).where(*a_scope, AgencyAssignment.status == AssignmentStatus.ACTIVE)) or 0
    now = utcnow()
    t_scope = [Task.owner_org_id == org_id] if org_id else []
    overdue = db.scalar(select(func.count()).select_from(Task).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]), Task.due_at < now)) or 0

    responded = db.execute(
        select(AgencyAssignment.created_at, AgencyAssignment.first_response_at, AgencyAssignment.first_response_due_at).where(
            *a_scope, AgencyAssignment.created_at.between(start, end), AgencyAssignment.first_response_at.is_not(None)
        )
    ).all()
    hours = [(r[1] - r[0]).total_seconds() / 3600 for r in responded]
    sla_ok = sum(1 for r in responded if r[2] and r[1] <= r[2])

    rv_scope = [DocumentReview.reviewer_org_id == org_id] if org_id else []
    reviews = db.execute(
        select(DocumentReview.decision, func.count()).where(*rv_scope, DocumentReview.created_at.between(start, end), DocumentReview.decision != "AI_PRECHECK").group_by(DocumentReview.decision)
    ).all()
    rv = dict(reviews)
    total_rv = sum(rv.values())

    decided_offer = _entered(db, S.OFFERED, start, end, **scope)
    decided_reject = _entered(db, S.REJECTED, start, end, **scope)

    # Counselor workload
    workload = []
    if org_id:
        members = db.execute(
            select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == org_id, OrganizationMember.is_active.is_(True))
        ).all()
        act = dict(db.execute(select(AgencyAssignment.counselor_user_id, func.count()).where(*a_scope, AgencyAssignment.status == AssignmentStatus.ACTIVE).group_by(AgencyAssignment.counselor_user_id)).all())
        open_t = dict(db.execute(select(Task.owner_user_id, func.count()).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])).group_by(Task.owner_user_id)).all())
        od_t = dict(db.execute(select(Task.owner_user_id, func.count()).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]), Task.due_at < now).group_by(Task.owner_user_id)).all())
        for m, u in members:
            workload.append({"user_id": str(u.id), "name": u.full_name, "role": m.role.value, "active_students": act.get(u.id, 0), "open_tasks": open_t.get(u.id, 0), "overdue_tasks": od_t.get(u.id, 0)})
        workload.sort(key=lambda w: -w["active_students"])

    # Task aging (open tasks by age since creation)
    aging = Counter()
    for (created,) in db.execute(select(Task.created_at).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]))):
        d = (now - created).days
        aging["0-2d" if d <= 2 else "3-7d" if d <= 7 else "8-14d" if d <= 14 else "15d+"] += 1

    scope_id = str(org_id) if org_id else "*"
    scope_type = "AGENCY" if org_id else "GLOBAL"
    return {
        "period_days": days,
        "definitions": DEFINITIONS,
        "kpis": {
            "new_leads": {"value": new_cur, "previous": new_prev, "delta_pct": round((new_cur - new_prev) / new_prev * 100, 1) if new_prev else None},
            "active_students": {"value": active},
            "applications_submitted": _kpi(db, S.SUBMITTED, start, end, pstart, pend, **scope),
            "offers": _kpi(db, S.OFFERED, start, end, pstart, pend, **scope),
            "visas_issued": _kpi(db, S.VISA_ISSUED, start, end, pstart, pend, **scope),
            "enrollments": _kpi(db, S.ENROLLED, start, end, pstart, pend, **scope),
            "overdue_tasks": {"value": overdue},
            "offer_rate": rate(decided_offer, decided_offer + decided_reject),
            "sla_met_rate": rate(sla_ok, len(responded)),
            "median_first_response_hours": {"value": round(statistics.median(hours), 1) if hours else None},
            "document_correction_rate": rate(rv.get("NEEDS_CORRECTION", 0), total_rv),
        },
        "funnel": application_funnel(db, **scope),
        "status_distribution": apps_by(db, "status", **scope),
        "by_university": apps_by(db, "university", **scope)[:10],
        "by_nationality": apps_by(db, "nationality", **scope)[:12],
        "by_degree": apps_by(db, "degree", **scope),
        "by_intake": apps_by(db, "intake", **scope),
        "workload": workload,
        "task_aging": [{"bucket": b, "count": aging.get(b, 0)} for b in ["0-2d", "3-7d", "8-14d", "15d+"]],
        "series": {
            "submitted": timeseries(db, "applications_submitted", scope_type, scope_id),
            "offers": timeseries(db, "offers", scope_type, scope_id),
        },
    }


def university_breakdown(db: Session, university_id, filters: dict | None, dim: str) -> list[dict]:
    """Counts of the university-visible population by one dimension, each row with the exact filter value that reproduces
    it on ``GET /applications`` (``key`` + ``id`` where the list filters by id)."""
    from app.models import University  # noqa: F401
    from app.services.access import university_visible

    base = _app_filter(select(Application.id, Application.status, Application.program_id, Application.intake_id, Application.agency_org_id,
                              Application.student_user_id), university_id=university_id, filters=filters).where(university_visible()).subquery()
    if dim == "nationality":
        stmt = select(StudentProfile.nationality, func.count()).join(base, base.c.student_user_id == StudentProfile.user_id).group_by(StudentProfile.nationality)
        rows = [{"key": k, "count": c} for k, c in db.execute(stmt).all()]
    elif dim == "program":
        stmt = select(Program.id, Program.name_en, Program.degree_level, func.count()).join(base, base.c.program_id == Program.id).group_by(Program.id, Program.name_en, Program.degree_level)
        rows = [{"key": name, "id": str(pid), "degree": dl.value, "count": c} for pid, name, dl, c in db.execute(stmt).all()]
    elif dim == "degree":
        stmt = select(Program.degree_level, func.count()).join(base, base.c.program_id == Program.id).group_by(Program.degree_level)
        rows = [{"key": k.value, "count": c} for k, c in db.execute(stmt).all()]
    elif dim == "intake":
        stmt = select(ProgramIntake.year, ProgramIntake.term, func.count()).join(base, base.c.intake_id == ProgramIntake.id).group_by(ProgramIntake.year, ProgramIntake.term)
        rows = [{"key": f"{y}-{t.value}", "count": c} for y, t, c in db.execute(stmt).all()]
    elif dim == "status":
        rows = [{"key": k.value, "count": c} for k, c in db.execute(select(base.c.status, func.count()).group_by(base.c.status)).all()]
    else:
        raise ValueError(dim)
    return sorted(rows, key=lambda r: (-r["count"], str(r["key"])))


def university_dashboard(db: Session, university_id, filters: dict | None = None) -> dict:
    scope = {"university_id": university_id, "filters": filters}
    apps = db.scalars(_app_filter(select(Application), **scope)).all()
    ids = [a.id for a in apps]
    hist = defaultdict(dict)
    if ids:
        for app_id, st, at in db.execute(
            select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status, ApplicationStatusHistory.created_at).where(ApplicationStatusHistory.application_id.in_(ids))
        ):
            hist[app_id][st] = at

    def hit(a, st):
        return st in hist[a.id] or reached(a.status, st)

    interested = db.scalar(select(func.count()).select_from(SavedUniversity).where(SavedUniversity.university_id == university_id)) or 0
    preparing = sum(1 for a in apps if a.status in (S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY))
    submitted = sum(1 for a in apps if hit(a, S.SUBMITTED))
    offered = sum(1 for a in apps if hit(a, S.OFFERED))
    paid = sum(1 for a in apps if hit(a, S.TUITION_PAID))
    visa = sum(1 for a in apps if hit(a, S.VISA_ISSUED))
    enrolled_apps = sum(1 for a in apps if hit(a, S.ENROLLED))

    enrollments = db.scalars(select(StudentEnrollment).where(StudentEnrollment.university_id == university_id)).all()
    # One application population: an application counts as "arrived" once its student (who reached visa issued for it)
    # reported arrival — distinct students, never more than the visas issued (a student may have several arrival plans).
    visa_students = {a.student_user_id for a in apps if hit(a, S.VISA_ISSUED)}
    arrived_students = set(db.scalars(select(ArrivalPlan.student_user_id).where(
        ArrivalPlan.arrived_at.is_not(None), ArrivalPlan.student_user_id.in_(visa_students or [None]))).all())
    arrived = min(sum(1 for a in apps if hit(a, S.VISA_ISSUED) and (a.student_user_id in arrived_students or hit(a, S.ENROLLED))), visa)
    terms = defaultdict(int)
    if enrollments:
        for eid, n in db.execute(select(StudentTerm.enrollment_id, func.count()).where(StudentTerm.enrollment_id.in_([e.id for e in enrollments])).group_by(StudentTerm.enrollment_id)):
            terms[eid] = n
    reached_t2 = [e for e in enrollments if terms[e.id] >= 2 or e.status == EnrollmentStatus.GRADUATED]
    retained = [e for e in reached_t2 if e.status in (EnrollmentStatus.ENROLLED, EnrollmentStatus.GRADUATED, EnrollmentStatus.ON_LEAVE)]
    today = utcnow().date()
    grad_due = [e for e in enrollments if e.expected_graduation and e.expected_graduation < today]
    graduated = [e for e in grad_due if e.status == EnrollmentStatus.GRADUATED]
    withdrawn = sum(1 for e in enrollments if e.status == EnrollmentStatus.WITHDRAWN)

    # agency performance — same definitions as the unified metrics, computed in ONE pass over the population (V8: the
    # console used to make one metrics request per agency; 25 s at 1024 px on the dev stack).
    from app.services import metrics as metrics_svc

    org_names = dict(db.execute(select(Organization.id, Organization.name)).all())
    agency_perf = []
    for org_id, m in metrics_svc.pipeline_by(db, university_id, filters, "agency").items():
        if org_id is None or m["counts"]["SUBMITTED"] == 0:
            continue
        agency_perf.append({
            "agency_id": str(org_id), "agency": org_names.get(org_id, "—"),
            "applications": m["counts"]["SUBMITTED"], "offers": m["counts"]["OFFERED"], "enrolled": m["counts"]["ENROLLED"],
            "offer_rate": m["metrics"]["offer_rate"], "yield": m["metrics"]["yield"],
            "complete_on_first_review": m["metrics"]["complete_on_first_review"],
            "avg_readiness_at_submission": m["avg_readiness_at_submission"],
        })
    agency_perf.sort(key=lambda r: (-r["applications"], r["agency"]))

    # cohorts
    cohorts = defaultdict(lambda: Counter())
    for e in enrollments:
        cohorts[e.cohort_label][e.status.value] += 1
    cohort_rows = [{"cohort": c, **dict(v), "total": sum(v.values())} for c, v in sorted(cohorts.items())]

    # scholarship pools + quotas
    contracts = db.scalars(select(PartnerContract).where(PartnerContract.university_id == university_id)).all()
    pools = []
    quotas = []
    for c in contracts:
        for p in c.pools:
            committed = sum(aw.amount_krw for aw in p.awards if aw.status == AwardStatus.COMMITTED)
            paid_amt = sum(aw.amount_krw for aw in p.awards if aw.status == AwardStatus.PAID)
            pools.append({
                "pool_id": str(p.id), "name": p.name, "intake": p.intake_label, "total": p.total_krw, "committed": committed,
                "paid": paid_amt, "remaining": p.total_krw - committed - paid_amt,
                "recipients": sum(1 for aw in p.awards if aw.status in (AwardStatus.COMMITTED, AwardStatus.PAID)),
                "contract_status": c.status.value, "is_demo": c.is_demo,
            })
        for q in c.quotas:
            quotas.append({"intake": q.intake_label, "program_id": str(q.program_id) if q.program_id else None, "seats": q.seats, "used": q.used, "remaining": q.seats - q.used})

    unified = metrics_svc.pipeline(db, university_id, filters)
    unified_cohorts = metrics_svc.cohorts(db, university_id, filters)
    return {
        # V8: one glossary (services/metrics.py) — never two versions of a definition.
        "definitions": {**DEFINITIONS, **{g["key"]: g["definition"] for g in metrics_svc.GLOSSARY}},
        "funnel": [
            {"stage": "INTERESTED", "count": interested, "note": "Hangyul students who saved this university"},
            {"stage": "PREPARING", "count": preparing, "note": "Aggregate only — identities hidden until submission"},
            {"stage": "APPLIED", "count": submitted},
            {"stage": "ADMITTED", "count": offered},
            {"stage": "TUITION_PAID", "count": paid},
            {"stage": "VISA_ISSUED", "count": visa},
            {"stage": "ARRIVED", "count": arrived},
            {"stage": "ENROLLED", "count": max(enrolled_apps, len(enrollments))},
            {"stage": "RETAINED", "count": len(retained)},
            {"stage": "GRADUATED", "count": len(graduated)},
        ],
        # Rates come from the unified metrics service so every screen shows the same number (see services/metrics.py).
        "kpis": {
            "applicants": {"value": unified["counts"]["SUBMITTED"]},
            "offers": {"value": unified["counts"]["OFFERED"]},
            "offer_rate": unified["metrics"]["offer_rate"],
            "yield": unified["metrics"]["yield"],
            "visa_conversion": unified["metrics"]["visa_conversion"],
            "no_show": rate(max(unified["counts"]["VISA_ISSUED"] - unified["counts"]["ARRIVED"], 0), unified["counts"]["VISA_ISSUED"]),
            "retention": unified_cohorts["total"]["retention"],
            "graduation_rate": unified_cohorts["total"]["graduation"],
            "withdrawals": {"value": withdrawn},
            "median_processing_days": {"value": unified["metrics"]["median_processing_days"]["value"], "n": unified["metrics"]["median_processing_days"]["denominator"]},
        },
        "population": unified["population"],
        # V8: breakdowns count exactly the applications the university can list (services.access.university_visible) and
        # carry the id the applicant list filters by, so every row drills down to the same number of records.
        "by_nationality": university_breakdown(db, university_id, filters, "nationality"),
        "by_program": university_breakdown(db, university_id, filters, "program"),
        "by_degree": university_breakdown(db, university_id, filters, "degree"),
        "by_intake": university_breakdown(db, university_id, filters, "intake"),
        "by_agency": agency_perf,
        "status_distribution": university_breakdown(db, university_id, filters, "status"),
        # Pre-submission work stays private: one aggregate number, never a list.
        "preparing": db.scalar(_app_filter(select(func.count()).select_from(Application), **scope)
                               .where(Application.status.in_([S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY]))) or 0,
        "cohorts": cohort_rows,
        "scholarship_pools": pools,
        "quotas": quotas,
        # Computed from the applications themselves (same filters as every other figure) — the daily rollup table can be
        # empty for a tenant, which drew a flat zero line while applications existed.
        "series": {"submitted": submitted_series(apps, weeks=26), "submitted_monthly": submitted_monthly(apps, months=12)},
    }


def rollup(db: Session, days: int = 400) -> int:
    """Rebuild DailyMetric from status history. Safe to re-run (deletes and recomputes the window)."""
    since = utcnow() - timedelta(days=days)
    metrics = {S.SUBMITTED: "applications_submitted", S.OFFERED: "offers", S.ENROLLED: "enrollments", S.VISA_ISSUED: "visas_issued"}
    db.query(DailyMetric).filter(DailyMetric.day >= since.date()).delete(synchronize_session=False)
    rows = db.execute(
        select(ApplicationStatusHistory.to_status, func.date(ApplicationStatusHistory.created_at), Application.agency_org_id, Application.university_id, func.count())
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .where(ApplicationStatusHistory.created_at >= since, ApplicationStatusHistory.to_status.in_(list(metrics)))
        .group_by(ApplicationStatusHistory.to_status, func.date(ApplicationStatusHistory.created_at), Application.agency_org_id, Application.university_id)
    ).all()
    agg: dict[tuple, float] = defaultdict(float)
    for st, day, agency, uni, n in rows:
        m = metrics[st]
        agg[(day, m, "GLOBAL", "*")] += n
        if agency:
            agg[(day, m, "AGENCY", str(agency))] += n
        agg[(day, m, "UNIVERSITY", str(uni))] += n
    for (day, m, st, sid), v in agg.items():
        db.add(DailyMetric(day=day, metric=m, scope_type=st, scope_id=sid, value=v))
    db.flush()
    return len(agg)


# ---------------------------------------------------------------- V9 U5: analytics organised by question

def university_questions(db: Session, university_id, filters: dict | None = None) -> dict:
    """Per-country and per-program conversion from the same pipeline population (services/metrics.py), each row with the
    exact filter that reproduces its counts on ``GET /applications`` (``reached`` / ``eligibility``).

    * Which countries convert to enrollment? — submitted → offered → enrolled per nationality.
    * Which programs attract qualified demand? — submitted applications that meet every published minimum (the same check
      as the applicant list's "Meets requirements"), per program, next to offers.
    """
    from app.services import eligibility_summary
    from app.services import metrics as m

    f = {k: v for k, v in (filters or {}).items() if v}
    rows = m._filtered(db, university_id, f)
    ctx = m._context(db, rows)
    nat = dict(db.execute(select(StudentProfile.user_id, StudentProfile.nationality).where(
        StudentProfile.user_id.in_({r.student_user_id for r in rows} or {None}))).all())
    submitted = [r for r in rows if m.top_step(r, ctx) is not None]
    apps = db.scalars(select(Application).where(Application.id.in_([r.id for r in submitted] or [None]))).all()
    elig = eligibility_summary.summarize(db, apps)
    idx = {s: i for i, s in enumerate(m.STEPS)}

    def bucket():
        return {"submitted": 0, "offered": 0, "enrolled": 0, "decided": 0, "qualified": 0, "checked": 0}

    countries: dict = defaultdict(bucket)
    programs: dict = defaultdict(bucket)
    for r in submitted:
        top = m.top_step(r, ctx)
        rejected = "REJECTED" in ctx["reached"][r.id]
        e = (elig.get(r.id) or {}).get("status")
        for g in (countries[nat.get(r.student_user_id)], programs[r.program_id]):
            g["submitted"] += 1
            g["offered"] += top >= idx["OFFERED"]
            g["enrolled"] += top >= idx["ENROLLED"]
            g["decided"] += top >= idx["OFFERED"] or rejected
            g["qualified"] += e == "MEETS"
            g["checked"] += e in ("MEETS", "BELOW")
    prog = {p.id: p for p in db.scalars(select(Program).where(Program.id.in_(list(programs) or [None]))).all()}
    c_rows = [{"key": k, **g, "conversion": rate(g["enrolled"], g["submitted"]), "offer_rate": rate(g["offered"], g["decided"])}
              for k, g in countries.items()]
    p_rows = [{"id": str(k), "key": prog[k].name_en if k in prog else "—", "degree": prog[k].degree_level.value if k in prog else None, **g,
               "qualified_rate": rate(g["qualified"], g["submitted"]), "offer_rate": rate(g["offered"], g["decided"])}
              for k, g in programs.items()]
    c_rows.sort(key=lambda r: (-r["submitted"], str(r["key"])))
    p_rows.sort(key=lambda r: (-r["submitted"], r["key"]))
    return {
        "population": m._population(f, submitted), "countries": c_rows, "programs": p_rows, "min_denominator": MIN_DENOMINATOR,
        "definitions": {
            "conversion": "Enrolled ÷ submitted applications from the same country (same intake and filters).",
            "qualified_rate": "Submitted applications that meet every published minimum (GPA, language) ÷ submitted applications to the program. "
                              "Applications with a value not on file are not counted as qualified.",
            "offer_rate": "Offers ÷ decided applications (offered + not admitted).",
        },
    }
