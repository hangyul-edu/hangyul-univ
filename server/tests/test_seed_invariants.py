from app.models.enums import ApplicationStatus as S
from app.seed.fixtures import history_path


def test_history_path_ends_on_the_final_status():
    # Interview is skipped at random for most applications; it must never be skipped when it is where the application stops.
    for _ in range(200):
        for final in (S.INTERVIEW, S.OFFERED, S.SUBMITTED, S.ENROLLED, S.REJECTED, S.WITHDRAWN):
            assert history_path(final)[-1] == final


def test_in_review_documents_are_recent_except_the_one_designated_overdue():
    """V4: the seed must not show silent multi-week reviews. Every document waiting for a review was uploaded within
    REVIEW_TARGET_HOURS, except exactly one deliberately late review (Lan's bank balance certificate), which keeps the
    "taking longer than usual" state demonstrable. Its review task is overdue; every other review task is not."""
    from datetime import timedelta

    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Document, Task, User
    from app.models.base import utcnow
    from app.models.enums import TaskStatus, TaskType
    from app.seed.extra_30_review_times import IN_REVIEW, OVERDUE_CATEGORY, OVERDUE_OWNER
    from app.services.readiness import REVIEW_TARGET_HOURS, review_is_overdue

    now = utcnow()
    with SessionLocal() as db:
        lan = db.scalar(select(User.id).where(User.email == OVERDUE_OWNER))
        docs = db.scalars(select(Document).where(Document.status.in_(IN_REVIEW))).all()
        assert docs, "the demo needs documents waiting for review"
        designated = [d for d in docs if d.owner_user_id == lan and d.category == OVERDUE_CATEGORY]
        others = [d for d in docs if d not in designated]
        stale = [(d.title, d.updated_at) for d in others if now - d.updated_at > timedelta(hours=REVIEW_TARGET_HOURS)]
        assert not stale, f"in-review documents older than {REVIEW_TARGET_HOURS} h: {stale[:5]}"
        for d in designated:  # still waiting (another test may have reviewed it meanwhile)
            assert review_is_overdue(d.updated_at, now) and now - d.updated_at < timedelta(days=7)
        overdue_tasks = db.scalars(select(Task).where(Task.task_type == TaskType.DOCUMENT_REVIEW, Task.status == TaskStatus.OPEN,
                                                      Task.due_at < now)).all()
        assert {t.dedupe_key for t in overdue_tasks} <= {f"review:{d.id}" for d in designated}


def test_partnership_numbers_follow_the_applications():
    """V4: quota "seats used" and partner-scholarship awards are derived from the seeded applications of that intake."""
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Application, PartnerContract, PartnerQuota, ScholarshipAward, ScholarshipPool
    from app.seed.extra_40_partner_consistency import OFFER_ONWARD, _intake_apps, award_status_for

    with SessionLocal() as db:
        for quota in db.scalars(select(PartnerQuota)).all():
            contract = db.get(PartnerContract, quota.contract_id)
            apps = _intake_apps(db, contract.university_id, quota.intake_label, quota.program_id)
            assert quota.used == sum(1 for a in apps if a.status in OFFER_ONWARD) <= quota.seats
        for award in db.scalars(select(ScholarshipAward).where(ScholarshipAward.pool_id.is_not(None))).all():
            pool = db.get(ScholarshipPool, award.pool_id)
            app = db.get(Application, award.application_id)
            contract = db.get(PartnerContract, pool.contract_id)
            assert app is not None and app.status in OFFER_ONWARD, "an award needs an offered/admitted application"
            assert app in _intake_apps(db, contract.university_id, pool.intake_label), "an award belongs to the pool's intake"
            assert award.status == award_status_for(app.status)


def test_both_university_request_queues_are_demonstrable():
    """V4: Pusan National has one genuine open document request (with the student's task) and one answered request
    waiting for the university's re-review — never E2E leftovers."""
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Application, DocumentRequest, Task, University
    from app.models.enums import ApplicationStatus, TaskStatus
    from app.seed.extra_40_partner_consistency import OPEN_REQUEST, RETURNED_REQUEST

    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        reqs = db.scalars(select(DocumentRequest).join(Application, Application.id == DocumentRequest.application_id)
                          .where(Application.university_id == uid, DocumentRequest.label.in_([OPEN_REQUEST[0], RETURNED_REQUEST[0]]))).all()
        open_r = [r for r in reqs if r.label == OPEN_REQUEST[0]]
        returned = [r for r in reqs if r.label == RETURNED_REQUEST[0]]
        assert len(open_r) == 1 and len(returned) == 1
        o, f = open_r[0], returned[0]
        assert o.status == "OPEN" and db.get(Task, o.task_id).status == TaskStatus.OPEN
        assert db.get(Application, o.application_id).status == ApplicationStatus.ADDITIONAL_DOCUMENTS
        assert f.status == "FULFILLED" and f.document_id and f.fulfilled_at > f.requested_at
        assert db.get(Application, f.application_id).status == ApplicationStatus.ADDITIONAL_DOCUMENTS
        assert not [r for r in reqs if r.label.startswith("E2E")]
