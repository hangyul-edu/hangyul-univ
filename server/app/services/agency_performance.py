"""Agency management performance (V3).

Every rate is computed over ONE stated population and returns numerator, denominator and an `insufficient_data`
flag (withheld below MIN_DENOMINATOR). Cohort metrics use the applications this agency handled for one intake;
operational metrics (SLA, document review) use a stated rolling period. Agencies are never ranked by raw acceptance
rate — admission decisions belong to universities and depend on each student's profile.
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    DocumentReview,
    Order,
    OrganizationMember,
    Program,
    ProgramIntake,
    StudentProfile,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, OrderStatus, TaskStatus
from app.services.analytics import MIN_DENOMINATOR, rate
from app.services.state_machine import reached

FUNNEL = [("STARTED", None), ("SUBMITTED", S.SUBMITTED), ("OFFERED", S.OFFERED), ("ACCEPTED", S.OFFER_ACCEPTED),
          ("TUITION_PAID", S.TUITION_PAID), ("VISA_ISSUED", S.VISA_ISSUED), ("ENROLLED", S.ENROLLED)]
DECISIONS = (S.OFFERED, S.REJECTED, S.WAITLISTED)
STAGES = [
    ("prepare", "Started → submitted"),
    ("decision", "Submitted → university decision"),
    ("tuition", "Offer → tuition paid"),
    ("visa", "Tuition paid → visa issued"),
]


def intakes_for(db: Session, org_id) -> list[dict]:
    rows = db.execute(
        select(ProgramIntake.year, ProgramIntake.term, func.count(Application.id))
        .join(Application, Application.intake_id == ProgramIntake.id)
        .where(*( [Application.agency_org_id == org_id] if org_id else []))
        .group_by(ProgramIntake.year, ProgramIntake.term)
    ).all()
    out = [{"intake": f"{y}-{t.value if hasattr(t, 'value') else t}", "applications": n} for y, t, n in rows]
    return sorted(out, key=lambda r: r["intake"], reverse=True)


def _median(values: list[float]) -> dict:
    if len(values) < MIN_DENOMINATOR:
        return {"median_days": None, "n": len(values), "insufficient_data": True}
    return {"median_days": round(statistics.median(values), 1), "n": len(values), "insufficient_data": False}


def performance(db: Session, org_id, *, intake: str | None, days: int, nationality: str | None = None, include_revenue: bool = False) -> dict:
    now = utcnow()
    period_start = now - timedelta(days=days)
    options = intakes_for(db, org_id)
    if not intake and options:
        # Default cohort: the intake with the most applications among current and future intakes.
        this_year = now.year
        current = [o for o in options if int(o["intake"].split("-")[0]) >= this_year] or options
        intake = max(current, key=lambda o: o["applications"])["intake"]

    # ------------------------------------------------------------ cohort population
    stmt = select(Application)
    if org_id:
        stmt = stmt.where(Application.agency_org_id == org_id)
    if intake:
        y, t = intake.split("-")
        stmt = stmt.where(Application.intake_id.in_(select(ProgramIntake.id).where(ProgramIntake.year == int(y), ProgramIntake.term == t)))
    if nationality:
        stmt = stmt.where(Application.student_user_id.in_(select(StudentProfile.user_id).where(StudentProfile.nationality == nationality)))
    apps = db.scalars(stmt).all()
    ids = [a.id for a in apps]
    history: dict = defaultdict(dict)  # app_id -> {status: first time reached}
    if ids:
        for app_id, st, at in db.execute(select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status, ApplicationStatusHistory.created_at)
                                         .where(ApplicationStatusHistory.application_id.in_(ids)).order_by(ApplicationStatusHistory.created_at)):
            history[app_id].setdefault(st, at)

    def hit(a: Application, step: S | None) -> bool:
        return step is None or step in history[a.id] or reached(a.status, step)

    funnel, prev = [], None
    for key, step in FUNNEL:
        n = sum(1 for a in apps if hit(a, step))
        funnel.append({"step": key, "count": n, "from_previous": rate(n, prev) if prev is not None else None})
        prev = n
    counts = {f["step"]: f["count"] for f in funnel}

    def days_between(a: Application, start: S | None, ends: tuple[S, ...]) -> float | None:
        h = history[a.id]
        t0 = a.created_at if start is None else h.get(start)
        t1 = min((h[e] for e in ends if e in h), default=None)
        if t0 is None or t1 is None or t1 < t0:
            return None
        return (t1 - t0).total_seconds() / 86400

    spans = {
        "prepare": [d for a in apps if (d := days_between(a, None, (S.SUBMITTED,))) is not None],
        "decision": [d for a in apps if (d := days_between(a, S.SUBMITTED, DECISIONS)) is not None],
        "tuition": [d for a in apps if (d := days_between(a, S.OFFERED, (S.TUITION_PAID,))) is not None],
        "visa": [d for a in apps if (d := days_between(a, S.TUITION_PAID, (S.VISA_ISSUED,))) is not None],
    }
    processing = [{"stage": k, "label": label, **_median(spans[k])} for k, label in STAGES]

    # Mix within the cohort
    nat = Counter()
    if ids:
        for (cc,) in db.execute(select(StudentProfile.nationality).join(Application, Application.student_user_id == StudentProfile.user_id).where(Application.id.in_(ids))):
            nat[cc or "—"] += 1
    prog = Counter()
    if ids:
        for name, uni in db.execute(select(Program.name_en, University.name_en).join(Application, Application.program_id == Program.id)
                                    .join(University, University.id == Program.university_id).where(Application.id.in_(ids))):
            prog[f"{uni} · {name}"] += 1

    # ------------------------------------------------------------ operations (rolling period)
    a_scope = [AgencyAssignment.organization_id == org_id] if org_id else []
    assigned = db.execute(select(AgencyAssignment.first_response_at, AgencyAssignment.first_response_due_at)
                          .where(*a_scope, AgencyAssignment.created_at >= period_start)).all()
    responded = [r for r in assigned if r[0] is not None]
    within = sum(1 for r in responded if r[1] is not None and r[0] <= r[1])
    unanswered = len(assigned) - len(responded)

    rv_scope = [DocumentReview.reviewer_org_id == org_id] if org_id else []
    reviews = dict(db.execute(select(DocumentReview.decision, func.count()).where(*rv_scope, DocumentReview.created_at >= period_start, DocumentReview.decision != "AI_PRECHECK")
                              .group_by(DocumentReview.decision)).all())
    total_reviews = sum(reviews.values())

    workload = []
    if org_id:
        t_scope = [Task.owner_org_id == org_id]
        active = dict(db.execute(select(AgencyAssignment.counselor_user_id, func.count()).where(*a_scope, AgencyAssignment.status == AssignmentStatus.ACTIVE)
                                 .group_by(AgencyAssignment.counselor_user_id)).all())
        open_t = dict(db.execute(select(Task.owner_user_id, func.count()).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])).group_by(Task.owner_user_id)).all())
        overdue_t = dict(db.execute(select(Task.owner_user_id, func.count()).where(*t_scope, Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]), Task.due_at < now)
                                    .group_by(Task.owner_user_id)).all())
        for m, u in db.execute(select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id)
                               .where(OrganizationMember.organization_id == org_id, OrganizationMember.is_active.is_(True))).all():
            workload.append({"user_id": str(u.id), "name": u.full_name, "role": m.role.value, "active_students": active.get(u.id, 0),
                             "open_tasks": open_t.get(u.id, 0), "overdue_tasks": overdue_t.get(u.id, 0)})
        workload.sort(key=lambda w: (-w["active_students"], w["name"]))

    revenue = None
    if include_revenue:
        rows = db.execute(select(Order.currency, func.count(), func.sum(Order.amount_minor))
                          .join(AgencyAssignment, AgencyAssignment.order_id == Order.id)
                          .where(*a_scope, Order.status == OrderStatus.PAID, Order.paid_at >= period_start)
                          .group_by(Order.currency)).all()
        revenue = {"period_days": days, "by_currency": [{"currency": c, "orders": n, "amount_minor": int(s or 0)} for c, n, s in rows], "is_demo": True}

    population = f"Applications handled by this agency for intake {intake}" if intake else "All applications handled by this agency"
    if nationality:
        population += f", nationality {nationality}"
    return {
        "intake": intake,
        "intakes": options,
        "cohort": {
            "population": population,
            "size": len(apps),
            "funnel": funnel,
            "enrollment_conversion": rate(counts["ENROLLED"], counts["OFFERED"]),
            "processing": processing,
            "by_nationality": [{"key": k, "count": v} for k, v in nat.most_common(8)],
            "by_program": [{"key": k, "count": v} for k, v in prog.most_common(8)],
        },
        "operations": {
            "period_days": days,
            "sla": {**rate(within, len(responded)), "population": f"Students assigned in the last {days} days who received a first response", "unanswered": unanswered},
            "document_correction": {**rate(reviews.get("NEEDS_CORRECTION", 0), total_reviews), "population": f"Document reviews in the last {days} days"},
        },
        "workload": workload,
        "revenue": revenue,
        "min_denominator": MIN_DENOMINATOR,
    }


# ============================================================================================ V9 process quality

QUALITY_KEYS = ("correction_loops", "first_pass_quality", "essay_revision_loops", "completeness_at_submission", "university_extra_documents",
                "missed_deadlines", "review_turnaround", "student_response_time", "first_response_time", "visa_extra_documents",
                "arrival_issues", "arrival_completion")
# Partner-agency quality (Hangyul, REPORT §61 H2): process metrics only — never admission rate.
PARTNER_KEYS = ("first_response_time", "first_pass_quality", "correction_loops", "deadline_compliance", "completeness_at_submission",
                "university_extra_documents", "visa_extra_documents", "arrival_completion")
ARRIVAL_TYPES = ("AIRPORT_PICKUP", "DORMITORY", "HOUSING_SEARCH", "TEMPORARY_HOUSING", "RESIDENCE_CARD", "ARRIVAL_SUPPORT", "SIM", "BANKING_SUPPORT")


def _q(key: str, *, unit: str, definition: str, cohort: str, value=None, num=None, den=None, n=None, drill=None, lower_is_better: bool = False,
       link: str | None = None) -> dict:
    n = n if n is not None else den
    withheld = (n or 0) < MIN_DENOMINATOR
    return {"key": key, "unit": unit, "value": None if withheld else value, "numerator": num, "denominator": den, "n": n or 0,
            "withheld": withheld, "definition": definition, "cohort": cohort, "lower_is_better": lower_is_better,
            "drill": (drill or [])[:25], "link": link}


def _med(xs: list[float]) -> float | None:
    return round(statistics.median(xs), 1) if xs else None


def process_quality(db: Session, org_id, *, days: int = 180, keys: tuple[str, ...] = QUALITY_KEYS) -> dict:
    """Where the process creates rework (REPORT §59 A10). One stated cohort per metric (records whose event falls in the
    last `days`), numerator/denominator/n on every value, n < MIN_DENOMINATOR withheld, and a drill-down to the records.
    `org_id` None = every agency (Hangyul). Students in scope = ever assigned to the agency (so moved cases still count)."""
    from app.models import Conversation, Document, DocumentRequest, DocumentVersion, Essay, Message, VisaCase
    from app.models.v5_concierge import ServiceCase, ServiceCaseEvent
    from app.models.v5_success import ApplicationSubmission
    from app.models.v5_visa_routes import VisaEmbassyRequest
    from app.models.v5_writing import EssayReview
    from app.services import concierge as concierge_svc

    now = utcnow()
    since = now - timedelta(days=days)
    cohort = f"last {days} days"
    sq = select(AgencyAssignment.student_user_id)
    if org_id:
        sq = sq.where(AgencyAssignment.organization_id == org_id)
    sids = set(db.scalars(sq).all())
    names = dict(db.execute(select(User.id, User.full_name).where(User.id.in_(sids))).all()) if sids else {}
    out: dict[str, dict] = {}
    staff = set(db.scalars(select(OrganizationMember.user_id)).all())

    # --- documents: correction loops + first-pass quality (human reviews in the period)
    if {"correction_loops", "first_pass_quality"} & set(keys):
        rows = db.execute(select(DocumentReview.document_id, DocumentReview.decision, DocumentReview.created_at, Document.owner_user_id, Document.category)
                          .join(Document, Document.id == DocumentReview.document_id)
                          .where(Document.owner_user_id.in_(sids), DocumentReview.decision.in_(["VERIFIED", "NEEDS_CORRECTION"]),
                                 DocumentReview.created_at >= since).order_by(DocumentReview.created_at)).all() if sids else []
        per: dict = defaultdict(list)
        meta = {}
        for did, dec, _at, owner, cat in rows:
            per[did].append(dec)
            meta[did] = (owner, cat)
        reviewed = list(per)
        loops = {d: sum(1 for x in v if x == "NEEDS_CORRECTION") for d, v in per.items()}
        sent_back = [d for d in reviewed if loops[d] > 0]
        first_ok = [d for d in reviewed if per[d][0] == "VERIFIED"]
        drill = [{"label": names.get(meta[d][0]), "detail": meta[d][1].value, "count": loops[d], "link": f"/documents?doc={d}"}
                 for d in sorted(sent_back, key=lambda d: -loops[d])]
        out["correction_loops"] = _q("correction_loops", unit="ratio", value=round(sum(loops.values()) / len(reviewed), 2) if reviewed else None,
                                     num=sum(loops.values()), den=len(reviewed), cohort=cohort, lower_is_better=True, drill=drill,
                                     definition="Corrections requested per reviewed document (documents with a human review in the period).")
        out["first_pass_quality"] = _q("first_pass_quality", unit="share", value=round(len(first_ok) / len(reviewed), 3) if reviewed else None,
                                       num=len(first_ok), den=len(reviewed), cohort=cohort, drill=drill,
                                       definition="Share of reviewed documents whose first human review verified them (no correction).")

    # --- essays: revision loops (review rounds until approval)
    if "essay_revision_loops" in keys:
        rows = db.execute(select(EssayReview.review_round, Essay.id, Essay.owner_user_id, Essay.essay_type).join(Essay, Essay.id == EssayReview.essay_id)
                          .where(Essay.owner_user_id.in_(sids), EssayReview.approved_at >= since)).all() if sids else []
        rounds = [r for r, *_ in rows]
        out["essay_revision_loops"] = _q("essay_revision_loops", unit="rounds", value=_med([float(x) for x in rounds]), n=len(rounds), cohort=cohort,
                                         lower_is_better=True, definition="Median review rounds until approval (essays approved in the period).",
                                         drill=[{"label": names.get(o), "detail": t.value, "count": r, "link": f"/essays/{e}"} for r, e, o, t in
                                                sorted(rows, key=lambda x: -x[0]) if r >= 3])

    # --- submissions: completeness at submission + university extra documents + missed deadlines
    subs = db.execute(select(ApplicationSubmission, Application).join(Application, Application.id == ApplicationSubmission.application_id)
                      .where(Application.student_user_id.in_(sids), ApplicationSubmission.status == "SUBMITTED_CONFIRMED",
                             ApplicationSubmission.recorded_at >= since)).all() if sids else []
    if "completeness_at_submission" in keys:
        vals = [r.completeness_at_submission for r, _a in subs if r.completeness_at_submission is not None]
        full = sum(1 for v in vals if v >= 1.0)
        out["completeness_at_submission"] = _q("completeness_at_submission", unit="share", value=round(full / len(vals), 3) if vals else None,
                                               num=full, den=len(vals), cohort=cohort,
                                               definition="Share of submissions (evidence recorded in the period) with every required item ready.",
                                               drill=[{"label": names.get(a.student_user_id), "detail": f"{round((r.completeness_at_submission or 0) * 100)}%",
                                                       "link": f"/applications/{a.id}"} for r, a in subs
                                                      if r.completeness_at_submission is not None and r.completeness_at_submission < 1.0])
    if "university_extra_documents" in keys:
        app_ids = [a.id for _r, a in subs]
        asked = set(db.scalars(select(DocumentRequest.application_id).where(DocumentRequest.application_id.in_(app_ids))).all()) if app_ids else set()
        out["university_extra_documents"] = _q("university_extra_documents", unit="share", value=round(len(asked) / len(app_ids), 3) if app_ids else None,
                                               num=len(asked), den=len(app_ids), cohort=cohort, lower_is_better=True,
                                               definition="Share of submitted applications (evidence in the period) for which the university asked for "
                                                          "at least one more document.",
                                               drill=[{"label": names.get(a.student_user_id), "detail": None, "link": f"/applications/{a.id}"}
                                                      for _r, a in subs if a.id in asked])
    if {"missed_deadlines", "deadline_compliance"} & set(keys) or "deadline_compliance" in PARTNER_KEYS:
        rows = db.execute(select(Application, ProgramIntake.application_deadline).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
                          .where(Application.student_user_id.in_(sids), ProgramIntake.application_deadline >= since.date(),
                                 ProgramIntake.application_deadline < now.date(), Application.status != S.WITHDRAWN)).all() if sids else []
        pre = (S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY)
        missed = [(a, d) for a, d in rows if a.status in pre]
        out["missed_deadlines"] = _q("missed_deadlines", unit="count", value=len(missed), num=len(missed), den=len(rows), cohort=cohort,
                                     lower_is_better=True, definition="Applications whose deadline passed in the period while still not submitted "
                                                                     "(withdrawn applications excluded).",
                                     drill=[{"label": names.get(a.student_user_id), "detail": d.isoformat(), "link": f"/applications/{a.id}"} for a, d in missed])
        out["deadline_compliance"] = _q("deadline_compliance", unit="share", value=round(1 - len(missed) / len(rows), 3) if rows else None,
                                        num=len(rows) - len(missed), den=len(rows), cohort=cohort,
                                        definition="Share of applications with a deadline in the period that were submitted in time.",
                                        drill=out["missed_deadlines"]["drill"])

    # --- document review turnaround (upload → first human review), hours
    if "review_turnaround" in keys:
        vers = db.execute(select(DocumentVersion.document_id, DocumentVersion.version, DocumentVersion.created_at, Document.owner_user_id)
                          .join(Document, Document.id == DocumentVersion.document_id)
                          .where(Document.owner_user_id.in_(sids), DocumentVersion.created_at >= since)).all() if sids else []
        first = dict(((d, v), at) for d, v, at in db.execute(
            select(DocumentReview.document_id, DocumentReview.version, func.min(DocumentReview.created_at))
            .where(DocumentReview.document_id.in_({d for d, *_ in vers}), DocumentReview.decision != "AI_PRECHECK")
            .group_by(DocumentReview.document_id, DocumentReview.version)).all()) if vers else {}
        hrs = []
        slow = []
        for d, v, at, owner in vers:
            r = first.get((d, v))
            if r and r >= at:
                h = (r - at).total_seconds() / 3600
                hrs.append(h)
                if h > 48:
                    slow.append({"label": names.get(owner), "detail": f"{round(h)} h", "link": f"/documents?doc={d}"})
        out["review_turnaround"] = _q("review_turnaround", unit="hours", value=_med(hrs), n=len(hrs), cohort=cohort, lower_is_better=True, drill=slow,
                                      definition="Median hours from a document upload to its first human review (uploads in the period).")

    # --- student response time: staff message → the student's next message in the same conversation
    if "student_response_time" in keys:
        msgs = db.execute(select(Message.conversation_id, Message.author_user_id, Message.created_at, Conversation.student_user_id)
                          .join(Conversation, Conversation.id == Message.conversation_id)
                          .where(Conversation.student_user_id.in_(sids), Message.created_at >= since, Message.visibility == "PARTICIPANTS")
                          .order_by(Message.conversation_id, Message.created_at)).all() if sids else []
        hrs = []
        pending: dict = {}
        for cid, author, at, stu in msgs:
            if author == stu:
                if cid in pending:
                    hrs.append((at - pending.pop(cid)).total_seconds() / 3600)
            elif author in staff and cid not in pending:
                pending[cid] = at
        out["student_response_time"] = _q("student_response_time", unit="hours", value=_med(hrs), n=len(hrs), cohort=cohort,
                                          definition="Median hours between a team message and the student's next reply in the same conversation "
                                                     "(messages in the period). Unanswered messages are not counted.")

    # --- first response time (agency → new student)
    if "first_response_time" in keys:
        aq = select(AgencyAssignment).where(AgencyAssignment.created_at >= since, AgencyAssignment.first_response_at.is_not(None))
        if org_id:
            aq = aq.where(AgencyAssignment.organization_id == org_id)
        asg = db.scalars(aq).all()
        hrs = [(a.first_response_at - a.created_at).total_seconds() / 3600 for a in asg if a.first_response_at >= a.created_at]
        out["first_response_time"] = _q("first_response_time", unit="hours", value=_med(hrs), n=len(hrs), cohort=cohort, lower_is_better=True,
                                        definition="Median hours from assignment to the agency's first contact (assignments in the period).",
                                        drill=[{"label": names.get(a.student_user_id), "detail": f"{round((a.first_response_at - a.created_at).total_seconds() / 3600)} h",
                                                "link": f"/students/{a.student_user_id}"} for a in asg
                                               if a.first_response_due_at and a.first_response_at > a.first_response_due_at])

    # --- visa: embassy asked for more
    if "visa_extra_documents" in keys:
        cases = db.scalars(select(VisaCase).where(VisaCase.student_user_id.in_(sids), VisaCase.submitted_on >= since.date())).all() if sids else []
        asked = set(db.scalars(select(VisaEmbassyRequest.visa_case_id).where(VisaEmbassyRequest.visa_case_id.in_([c.id for c in cases]))).all()) if cases else set()
        out["visa_extra_documents"] = _q("visa_extra_documents", unit="share", value=round(len(asked) / len(cases), 3) if cases else None,
                                         num=len(asked), den=len(cases), cohort=cohort, lower_is_better=True,
                                         definition="Share of visa applications submitted in the period for which the embassy asked for more.",
                                         drill=[{"label": names.get(c.student_user_id), "detail": c.visa_type.value, "link": f"/students/{c.student_user_id}?tab=visa"}
                                                for c in cases if c.id in asked])

    # --- arrival services: issues and completion
    if {"arrival_issues", "arrival_completion"} & set(keys):
        sc = db.scalars(select(ServiceCase).where(ServiceCase.student_user_id.in_(sids), ServiceCase.case_type.in_(ARRIVAL_TYPES),
                                                  ServiceCase.created_at >= since)).all() if sids else []
        bad_ev = set(db.scalars(select(ServiceCaseEvent.case_id).where(ServiceCaseEvent.case_id.in_([c.id for c in sc]),
                                                                       (ServiceCaseEvent.kind == "NO_SHOW") | ServiceCaseEvent.to_status.in_(["NO_SHOW", "NOT_ASSIGNED"])
                                                                       )).all()) if sc else set()
        issues = [c for c in sc if c.id in bad_ev or c.feedback_ok is False or concierge_svc.is_overdue(c, now)]
        closed = [c for c in sc if concierge_svc.is_closed(c)]
        done = [c for c in closed if concierge_svc.state(c).bucket == "done"]
        out["arrival_issues"] = _q("arrival_issues", unit="share", value=round(len(issues) / len(sc), 3) if sc else None, num=len(issues), den=len(sc),
                                   cohort=cohort, lower_is_better=True,
                                   definition="Share of arrival service cases (pickup, housing, residence card…) opened in the period with a no-show, "
                                              "a dormitory not assigned, negative feedback or a missed service time.",
                                   drill=[{"label": names.get(c.student_user_id), "detail": c.case_type, "link": f"/services?case={c.id}"} for c in issues])
        out["arrival_completion"] = _q("arrival_completion", unit="share", value=round(len(done) / len(closed), 3) if closed else None,
                                       num=len(done), den=len(closed), cohort=cohort,
                                       definition="Share of closed arrival service cases (opened in the period) that were completed rather than cancelled.")
    return {"generated_at": now.isoformat(), "days": days, "min_n": MIN_DENOMINATOR, "students_in_scope": len(sids),
            "metrics": [out[k] for k in keys if k in out]}
