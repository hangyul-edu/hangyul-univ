"""V5 success seed: submission connectors, sample language recommendations, submission records, one portfolio review.

* Submission connectors for every catalogued university — from ``docs/research/submission-methods.json`` when present,
  otherwise NEEDS_REVIEW placeholders ("Submission method not yet verified — your counselor confirms it").
* ``LanguageRecommendation`` rows are SAMPLE data (basis=SAMPLE, is_demo) for four Korean-taught BBA programs, so the
  strategy layer can show "TOPIK 3 meets the minimum; this program recommends 4+". They are never
  presented as a university's published figure.
* Every seeded application that already reached SUBMITTED gets a sample submission record (a provider-style confirmation number
  such as SOG-2027-0412-3F9A, recorded by the agency; is_demo stays on the application), so the university console and metrics have evidence to show. Fictional data.
* The guided-submission persona is ``student.nepal@demo.hangyul.kr`` (created by extra_15_v5_personas; READY at
  Kyungpook) — nothing is pre-recorded for her, so FLOW A starts at the hand-off.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    ApplicationStatusHistory,
    ApplicationSubmission,
    LanguageRecommendation,
    PortfolioReview,
    Program,
    University,
    User,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import AssignmentStatus, DegreeLevel
from app.seed.run import NOW
from app.services import submission

RECOMMEND_TOPIK_4 = ("korea-university", "yonsei-university", "sogang-university", "seoul-national-university")
SUBMITTED_OR_LATER = {S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.WAITLISTED, S.REJECTED, S.OFFERED, S.OFFER_ACCEPTED,
                      S.TUITION_PENDING, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION,
                      S.VISA_SUBMITTED, S.VISA_ISSUED, S.ENROLLED}



def provider_reference(app_hex: str, uni_slug: str, submitted_on) -> str:
    """Plausible application-portal confirmation number, deterministic per application (e.g. ``SOG-2027-0412-3F9A``)."""
    code = (uni_slug.replace("-", "")[:3] or "APP").upper()
    year = submitted_on.year if submitted_on else 2026
    mmdd = submitted_on.strftime("%m%d") if submitted_on else "0101"
    return f"{code}-{year}-{mmdd}-{app_hex[:4].upper()}"

def seed(db: Session, ctx: dict[str, Any]) -> None:
    stats = submission.sync_connectors(db, demo=True)
    ctx["success_connectors"] = stats

    for slug in RECOMMEND_TOPIK_4:
        uni = db.scalar(select(University).where(University.slug == slug))
        prog = db.scalar(select(Program).where(Program.university_id == uni.id, Program.degree_level == DegreeLevel.BACHELOR,
                                               Program.field == "business")) if uni else None
        if prog and not db.scalar(select(LanguageRecommendation).where(LanguageRecommendation.program_id == prog.id)):
            db.add(LanguageRecommendation(program_id=prog.id, recommended_topik_level=4, basis="SAMPLE", is_demo=True,
                                          note="The department recommends a level above its published minimum."))

    # Sample submission evidence for applications the seed already moved past submission.
    n = 0
    for app in db.scalars(select(Application).where(Application.status.in_(SUBMITTED_OR_LATER))).all():
        if submission.get_record(db, app.id):
            continue
        conn = submission.connector_for(db, app)
        fee_status, amount, cur, payee = submission._default_fee(conn)
        n += 1
        submitted = app.submitted_at or db.scalar(select(ApplicationStatusHistory.created_at).where(
            ApplicationStatusHistory.application_id == app.id, ApplicationStatusHistory.to_status == S.SUBMITTED))
        uni = db.get(University, app.university_id)
        ref = app.external_reference or provider_reference(app.id.hex, uni.slug if uni else "", submitted.date() if submitted else None)
        db.add(ApplicationSubmission(application_id=app.id, connector_id=conn.row.id if conn.row else None, method=conn.method,
                                     status="SUBMITTED_CONFIRMED", submitted_on=submitted.date() if submitted else None, external_reference=ref,
                                     evidence_kind="CONFIRMATION_ID", recorded_by_role="AGENCY", recorded_at=submitted or NOW,
                                     fee_status="CONFIRMED" if fee_status == "UNPAID" else fee_status, fee_amount=amount, fee_currency=cur, fee_payee=payee,
                                     is_demo=True))
    ctx["success_submissions"] = n

    # One recorded portfolio review for the main persona (Lan), so the agency Portfolio section shows its history.
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    a = db.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == lan.id, AgencyAssignment.status == AssignmentStatus.ACTIVE)) if lan else None
    if lan and a and not db.scalar(select(PortfolioReview).where(PortfolioReview.student_user_id == lan.id)):
        db.add(PortfolioReview(student_user_id=lan.id, organization_id=a.organization_id, reviewed_by_user_id=a.counselor_user_id,
                               reviewed_at=NOW - timedelta(days=9), decision="SPREAD_DEADLINES", is_demo=True, observations=[],
                               note="Agreed to finish the Seoul applications first; transcript correction is the priority."))
    db.flush()
