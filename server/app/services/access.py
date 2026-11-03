"""Tenant isolation. Every read/write of student-scoped data goes through these helpers.

Rules
- Students see only their own data.
- Hangyul staff see everything (audited).
- Agencies see students with an ACTIVE assignment to their organisation. V22 (REPORT §246 A1): every
  AGENCY_ADMIN sees every student of the agency; `counselor_user_id` is an internal accountability field,
  never a visibility rule.
- Universities see only applications to their own university that have been submitted
  (drafts and pre-submission preparation stay private), plus documents explicitly shared
  for those applications.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, exists, or_, select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.models import AgencyAssignment, Application
from app.models.enums import ApplicationStatus, AssignmentStatus

PRE_SUBMISSION = {
    ApplicationStatus.DRAFT,
    ApplicationStatus.PROFILE_REVIEW,
    ApplicationStatus.DOCUMENT_PREPARATION,
    ApplicationStatus.READY,
}


def university_visible():
    """The one population a university sees (V8): applications that reached submission. Pre-submission work stays private,
    and so does an application the student withdrew *before* submitting it (status WITHDRAWN without ``submitted_at``).
    Used by tenancy, the applicant list and every university breakdown, so a chart count always equals its drill-down list."""
    return and_(
        Application.status.not_in(PRE_SUBMISSION),
        or_(Application.status != ApplicationStatus.WITHDRAWN, Application.submitted_at.is_not(None)),
    )


def forbidden(msg: str = "Not found or not permitted.") -> HTTPException:
    # 404 instead of 403 so tenants cannot probe for the existence of other tenants' records.
    return HTTPException(status.HTTP_404_NOT_FOUND, msg)


def agency_student_ids_subquery(p: Principal):
    q = select(AgencyAssignment.student_user_id).where(
        AgencyAssignment.organization_id == p.org_id,
        AgencyAssignment.status == AssignmentStatus.ACTIVE,
    )
    return q


def university_student_ids_subquery(p: Principal):
    return select(Application.student_user_id).where(Application.university_id == p.university_id, university_visible())


def can_view_student(db: Session, p: Principal, student_user_id: uuid.UUID) -> bool:
    if p.id == student_user_id and p.is_student:
        return True
    if p.is_hangyul:
        return True
    if p.is_agency:
        return db.scalar(select(exists(agency_student_ids_subquery(p).where(AgencyAssignment.student_user_id == student_user_id)))) or False
    if p.is_university:
        return db.scalar(
            select(exists(university_student_ids_subquery(p).where(Application.student_user_id == student_user_id)))
        ) or False
    return False


def ensure_student_access(db: Session, p: Principal, student_user_id: uuid.UUID) -> None:
    if not can_view_student(db, p, student_user_id):
        raise forbidden()


def scope_applications(stmt: Select, p: Principal) -> Select:
    """Apply tenant filter to any select over Application."""
    if p.is_hangyul:
        return stmt
    if p.is_agency:
        return stmt.where(Application.student_user_id.in_(agency_student_ids_subquery(p)))
    if p.is_university:
        return stmt.where(and_(Application.university_id == p.university_id, university_visible()))
    return stmt.where(Application.student_user_id == p.id)


def get_application_for(db: Session, p: Principal, application_id: uuid.UUID) -> Application:
    app = db.scalar(scope_applications(select(Application).where(Application.id == application_id), p))
    if not app:
        raise forbidden()
    return app


def scope_student_ids(stmt: Select, column, p: Principal) -> Select:
    """Filter any statement by a student_user_id-like column."""
    if p.is_hangyul:
        return stmt
    if p.is_agency:
        return stmt.where(column.in_(agency_student_ids_subquery(p)))
    if p.is_university:
        return stmt.where(column.in_(university_student_ids_subquery(p)))
    return stmt.where(column == p.id)
