"""What each plan makes the team actually *do* — the operational difference between the plans (V29 §22–§24).

The comparison table promises different dormitory, visa and arrival service per plan. A page that showed the same
screen under three labels would be a lie, so the difference is work: tasks for the team, a service case when the plan
includes doing the application, and the Premium arrival window.

    dormitory   INFORMATION   the student reads the dormitory facts — no team work
                SCHEDULE      the team tracks each offered university's dormitory application window (task)
                APPLICATION   the team runs the application (an included DORMITORY service case) + alternatives (task)
    visa        GUIDANCE      the student follows the official route page — no team work
                DOCUMENT_PREP the team prepares the visa documents with the student (task)
                INTENSIVE     … and manages the key dates against entry (a second, dated task)
    arrival     Premium       arrival date → pre-arrival support from D-N, settlement support to D+N (tasks + reminders)

Rules are evaluated by ``tasks_engine.generate_for_student`` (dedupe keys, auto-close when the trigger goes away), so
they run on purchase, on every case change and from the scheduled worker. Titles are ``common:task.v29.*`` keys whose
parameters are ids (``university_id``) resolved at render time — never a stored display name.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit, track
from app.models import Application, Appointment, ArrivalPlan, ServiceCase, ServiceEngagement, University, VisaCase
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import TaskType
from app.services import entitlements as ent_svc

#: An application at one of these stages has an offer — dormitory, visa and arrival work starts here.
OFFER_STAGES = (S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING,
                S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED)


def on_engagement_started(db: Session, eng: ServiceEngagement) -> None:
    audit(db, action="engagement.start", entity_type="service_engagement", entity_id=eng.id, subject_user_id=eng.user_id,
          detail={"plan": eng.product_code, "catalog_version": eng.catalog_version})


def _milestone(db: Session, eng: ServiceEngagement, name: str, event: str) -> None:
    m = dict(eng.milestones or {})
    if name in m:
        return
    m[name] = utcnow().isoformat()
    eng.milestones = m
    track(db, event, user_id=eng.user_id, properties={"plan": eng.product_code})


def sync(db: Session, eng: ServiceEngagement, *, counselor=None) -> None:
    """Derive the engagement's dates from the records that prove them. Never invents a contract term."""
    changed = False
    if eng.service_started_at is None:
        first = db.scalar(select(Appointment.starts_at).where(
            Appointment.student_user_id == eng.user_id, Appointment.kind == "CONSULTATION",
            Appointment.status.in_(("SCHEDULED", "COMPLETED"))).order_by(Appointment.starts_at).limit(1))
        if first is not None:
            eng.service_started_at, changed = first, True
    if eng.arrival_at is None and int((eng.entitlements or {}).get("pre_arrival_support_days") or 0) > 0:
        plan = db.scalar(select(ArrivalPlan).where(ArrivalPlan.student_user_id == eng.user_id).order_by(ArrivalPlan.created_at.desc()))
        if plan is not None and plan.arrival_at:
            eng.arrival_at, changed = plan.arrival_at, True
    if (eng.entitlements or {}).get("dedicated_support") and eng.dedicated_owner_user_id is None and counselor is not None:
        eng.dedicated_owner_user_id, changed = counselor, True
    if changed:
        ent_svc.recompute_dates(eng)


def tasks(db: Session, student_user_id, *, agency_org, counselor) -> dict[str, dict]:
    """The plan's tasks for ``tasks_engine`` — ``{dedupe_key: spec}``. Empty without an active engagement."""
    eng = ent_svc.active_engagement(db, student_user_id)
    if eng is None:
        return {}
    sync(db, eng, counselor=counselor)
    e = eng.entitlements or {}
    now = utcnow()
    sid = str(student_user_id)
    out: dict[str, dict] = {}
    staff = dict(owner_user_id=counselor, owner_org_id=agency_org)

    def team(key: str, title_en: str, title_key: str, task_type: TaskType, *, due=None, link=None, **params):
        out[f"plan:{eng.id}:{key}"] = dict(title=title_en, title_key=f"task.v29.{title_key}", title_params=params or {},
                                           task_type=task_type, due_at=due, link=link or f"/students/{sid}", **staff)

    has_consult = db.scalar(select(Appointment.id).where(Appointment.student_user_id == student_user_id,
                                                         Appointment.kind == "CONSULTATION").limit(1))
    if not has_consult and not ent_svc.term_ended(eng):
        team("diagnostic", "Schedule the diagnostic consultation", "scheduleDiagnostic", TaskType.CONSULTATION,
             due=(eng.created_at or now) + timedelta(days=2))

    offered = db.execute(select(Application, University).join(University, University.id == Application.university_id)
                         .where(Application.student_user_id == student_user_id, Application.status.in_(OFFER_STAGES))
                         .order_by(Application.created_at)).all()

    # ---- dormitory
    dorm = e.get("dormitory_support_level")
    if dorm == "SCHEDULE":
        for app, uni in offered:
            team(f"dorm-schedule:{app.id}", "Track the dormitory application window", "dormSchedule", TaskType.DORM_APPLICATION,
                 university_id=str(uni.id))
            out[f"plan:{eng.id}:dorm-schedule:{app.id}"].update(application_id=app.id, university_id=uni.id)
    elif dorm == "APPLICATION" and offered:
        app, uni = offered[0]
        existing = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == student_user_id, ServiceCase.case_type == "DORMITORY"))
        if existing is None:
            from app.services import concierge

            case = concierge.create_case(db, student_user_id, "DORMITORY", application_id=app.id,
                                         details={"source": "PLAN", "plan": eng.product_code, "university_id": str(uni.id)})
            case.cost_payer = "included"
        team("housing-alternatives", "Prepare alternative accommodation options", "housingAlternatives", TaskType.DORM_APPLICATION,
             university_id=str(uni.id))

    # ---- visa
    visa = e.get("visa_support_level")
    if visa in ("DOCUMENT_PREP", "INTENSIVE") and offered:
        team("visa-documents", "Prepare the visa application documents with the student", "visaDocuments", TaskType.VISA_STEP,
             link=f"/students/{sid}?focus=visa")
        if visa == "INTENSIVE":
            vc = db.scalar(select(VisaCase).where(VisaCase.student_user_id == student_user_id).order_by(VisaCase.created_at.desc()))
            entry = (vc.target_entry_date if vc and vc.target_entry_date else None)
            due = None
            if eng.arrival_at:
                due = eng.arrival_at - timedelta(days=45)
            elif entry:
                from datetime import datetime, time, timezone
                due = datetime.combine(entry, time(9), tzinfo=timezone.utc) - timedelta(days=45)
            team("visa-schedule", "Check the visa key dates against entry", "visaSchedule", TaskType.VISA_STEP, due=due,
                 link=f"/students/{sid}?focus=visa")

    # ---- Premium arrival window
    if int(e.get("pre_arrival_support_days") or 0) > 0 and offered:
        if eng.arrival_at is None:
            team("arrival-date", "Confirm the student's arrival date", "confirmArrival", TaskType.ARRIVAL_STEP)
        elif eng.pre_arrival_starts_at and now >= eng.pre_arrival_starts_at and now < eng.arrival_at:
            _milestone(db, eng, "pre_arrival_started", "pre_arrival_support_started")
            team("pre-arrival", "Pre-arrival support is open", "preArrival", TaskType.ARRIVAL_STEP, due=eng.arrival_at)
            out[f"plan:{eng.id}:pre-arrival-student"] = dict(
                title="Get ready to arrive in Korea", title_key="task.v29.studentPreArrival", title_params={}, task_type=TaskType.ARRIVAL_STEP,
                due_at=eng.arrival_at, owner_user_id=student_user_id, owner_org_id=agency_org, visible_to_student=True, link="/arrival")
        elif eng.settlement_ends_at and eng.arrival_at <= now <= eng.settlement_ends_at:
            _milestone(db, eng, "settlement_started", "settlement_support_started")
            team("settlement", "Initial settlement support is running", "settlement", TaskType.ARRIVAL_STEP, due=eng.settlement_ends_at)
        elif eng.settlement_ends_at and now > eng.settlement_ends_at:
            _milestone(db, eng, "settlement_completed", "settlement_support_completed")
    return out
