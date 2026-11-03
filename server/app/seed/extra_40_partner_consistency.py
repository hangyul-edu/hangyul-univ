"""Partnership numbers that agree with the applications behind them, and both document-request queues (V4).

* Partner quotas ("seats used") are derived from the seeded applications of the quota's intake at that university (and
  program, when the quota is per program): an application uses a seat once it has an offer (offered or any later
  admitted state). The core seed used fixed random numbers ("8/40") while Pusan had no Spring 2027 offer at all.
* Partner-scholarship awards belong only to offered/admitted applications of the pool's intake; their status follows
  the application (offered → proposed, accepted → committed, tuition paid or later → paid). Others are removed.
* Pusan National gets one genuine university document request that is still OPEN (application in "additional
  documents", with the student's task) and one that the student already answered (RETURNED, waiting for the
  university's re-review), so both university queues are demonstrable without E2E leftovers.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Application,
    ApplicationStatusHistory,
    Document,
    OrganizationMember,
    PartnerContract,
    PartnerQuota,
    ProgramIntake,
    ScholarshipAward,
    ScholarshipPool,
    Task,
    University,
    User,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import AwardStatus, IntakeTerm

OFFER_ONWARD = {S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED,
                S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED}
PAID_ONWARD = {S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED}
DEMO_UNIVERSITY = "pusan-national-university"
OPEN_REQUEST = ("Recent bank balance certificate",
                "Please upload a bank balance certificate issued within the last 30 days, in your or your sponsor's name, with an English translation.")
RETURNED_REQUEST = ("Certified copy of your graduation certificate",
                    "Please upload a certified copy of your graduation certificate with the apostille page included.")


def intake_of(label: str) -> tuple[int, IntakeTerm]:
    year, term = label.split("-", 1)  # "2027-SPRING"
    return int(year), IntakeTerm(term)


def award_status_for(status: S) -> AwardStatus:
    return AwardStatus.PAID if status in PAID_ONWARD else AwardStatus.COMMITTED if status != S.OFFERED else AwardStatus.PROPOSED


def _intake_apps(db: Session, university_id, label: str, program_id=None) -> list[Application]:
    year, term = intake_of(label)
    q = (select(Application).join(ProgramIntake, ProgramIntake.id == Application.intake_id)
         .where(Application.university_id == university_id, ProgramIntake.year == year, ProgramIntake.term == term))
    if program_id is not None:
        q = q.where(Application.program_id == program_id)
    return list(db.scalars(q.order_by(Application.created_at)).all())


def _partnership_numbers(db: Session) -> None:
    for quota in db.scalars(select(PartnerQuota)).all():
        contract = db.get(PartnerContract, quota.contract_id)
        apps = _intake_apps(db, contract.university_id, quota.intake_label, quota.program_id)
        quota.used = sum(1 for a in apps if a.status in OFFER_ONWARD)
    for pool in db.scalars(select(ScholarshipPool)).all():
        contract = db.get(PartnerContract, pool.contract_id)
        eligible = [a for a in _intake_apps(db, contract.university_id, pool.intake_label) if a.status in OFFER_ONWARD]
        by_app = {a.id: a for a in eligible}
        kept: set = set()
        for award in list(pool.awards):
            app = by_app.get(award.application_id)
            if app is None or app.id in kept:
                db.delete(award)
                continue
            award.status = award_status_for(app.status)
            kept.add(app.id)
        for app in eligible[:3]:
            if app.id not in kept:
                db.add(ScholarshipAward(pool_id=pool.id, student_user_id=app.student_user_id, application_id=app.id, amount_krw=1500000,
                                        status=award_status_for(app.status), note="Partner scholarship award"))


def _document_requests(db: Session) -> None:
    from app.services.document_requests import create_request, fulfill_request

    uni = db.scalar(select(University).where(University.slug == DEMO_UNIVERSITY))
    if uni is None:
        return
    officer = db.scalar(select(OrganizationMember).join(User, User.id == OrganizationMember.user_id)
                        .where(User.email.like("admissions@pusan.%")))
    if officer is None:
        return
    # Keep at least one application in plain "under review" for the Needs-review queue: the open request goes on the
    # first application under review, the answered one on a submitted application (it passes through review first).
    reviewing = list(db.scalars(select(Application).where(Application.university_id == uni.id, Application.status == S.UNIVERSITY_REVIEW)
                                .order_by(Application.submitted_at, Application.id)).all())
    submitted = list(db.scalars(select(Application).where(Application.university_id == uni.id, Application.status == S.SUBMITTED)
                                .order_by(Application.submitted_at, Application.id)).all())
    candidates = [reviewing[0] if reviewing else None, submitted[0] if submitted else (reviewing[1] if len(reviewing) > 2 else None)]
    now = datetime.now(timezone.utc)
    plans = [(OPEN_REQUEST, "BANK_STATEMENT", timedelta(days=2), None), (RETURNED_REQUEST, "GRADUATION_CERTIFICATE", timedelta(days=5), timedelta(hours=20))]
    for app, ((label, note), category, asked_ago, answered_ago) in zip(candidates, plans):
        if app is None:
            continue
        doc = db.scalar(select(Document).where(Document.owner_user_id == app.student_user_id, Document.category == category)) if answered_ago else None
        if answered_ago and doc is None:
            continue
        last_change = max((h.created_at for h in db.scalars(select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == app.id)).all()),
                          default=now - asked_ago)
        r = create_request(db, app, actor_id=officer.user_id, actor_org_id=officer.organization_id, label=label, note=note, category=category,
                           due_date=(now + timedelta(days=12)).date())
        db.flush()
        asked = min(max(now - asked_ago, last_change + timedelta(hours=2)), now - timedelta(hours=3))
        # Re-date the request and everything it created in the same instant (history, task) to when it was asked.
        for h in db.scalars(select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == app.id,
                                                                    ApplicationStatusHistory.created_at == r.requested_at)).all():
            h.created_at = asked
        r.requested_at = asked
        task = db.get(Task, r.task_id) if r.task_id else None
        if task is not None:
            task.created_at = asked
        if answered_ago:
            fulfill_request(db, r, app, actor_id=app.student_user_id, document_id=doc.id)
            r.fulfilled_at = min(max(now - answered_ago, asked + timedelta(hours=1)), now - timedelta(minutes=30))
            if task is not None:
                task.completed_at = r.fulfilled_at


def seed(db: Session, ctx: dict[str, Any]) -> None:
    _partnership_numbers(db)
    db.flush()
    _document_requests(db)
