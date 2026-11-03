"""Task & deadline engine. Idempotent: every generated task has a dedupe_key; tasks whose trigger condition
disappears are auto-closed. Run per student after relevant changes, or for everyone via app.jobs.daily."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AgencyAssignment,
    Application,
    DocumentRequest,
    Essay,
    Program,
    ProgramIntake,
    StudentProfile,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus,
    AssignmentStatus,
    EssayStatus,
    TaskPriority,
    TaskStatus,
    TaskType,
    VisaStatus,
)
from app.services.readiness import checklist
from app.services.state_machine import TERMINAL
from app.services.visa import visa_checklist

SEOUL = ZoneInfo("Asia/Seoul")


def _dt(d: date | None) -> datetime | None:
    # Korean universities publish deadlines as calendar dates in Korea time; the task is due at the end of that day in Seoul.
    return datetime.combine(d, time(23, 59), tzinfo=SEOUL) if d else None


def _priority(due: datetime | None, now: datetime) -> TaskPriority:
    if due is None:
        return TaskPriority.MEDIUM
    days = (due - now).days
    if days < 3:
        return TaskPriority.URGENT
    if days < 10:
        return TaskPriority.HIGH
    return TaskPriority.MEDIUM


def _essay_uni(db: Session, e: Essay) -> str:
    if e.application_id:
        app = db.get(Application, e.application_id)
        return db.get(University, app.university_id).name_en if app else ""
    return ""


def _prog_name(db: Session, app: Application) -> str:
    return db.get(Program, app.program_id).name_en


def _in_sentence(label: str) -> str:
    """A requirement label placed mid-sentence: lower-case the first word only, never an acronym ("TOPIK certificate",
    "Language test certificate (TOPIK / IELTS)" → "language test certificate (TOPIK / IELTS)")."""
    first, _, rest = label.partition(" ")
    if not first or first.isupper() or any(c.isupper() for c in first[1:]):
        return label
    return f"{first[0].lower()}{first[1:]}{' ' + rest if rest else ''}"


def generate_for_student(db: Session, student_user_id, today: date | None = None) -> int:
    now = utcnow()
    today = today or now.date()
    wanted: dict[str, dict] = {}
    assignment = db.scalar(
        select(AgencyAssignment).where(AgencyAssignment.student_user_id == student_user_id, AgencyAssignment.status == AssignmentStatus.ACTIVE)
    )
    agency_org = assignment.organization_id if assignment else None
    counselor = assignment.counselor_user_id if assignment else None
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student_user_id))
    sid = str(student_user_id)

    # Deterministic order (created first wins): a document task shared by several applications must always belong to the
    # same application, or its title ("… for Pusan") and its link/deadline could come from different applications.
    apps = db.scalars(select(Application).where(Application.student_user_id == student_user_id)
                      .order_by(Application.created_at, Application.id)).all()
    from app.services.strategy import deadline_passed

    inactive_apps: set = set()  # V9 reliability: withdrawn/rejected, or past the deadline unsubmitted — no student work is asked for them
    for app in apps:
        if app.status in TERMINAL:
            inactive_apps.add(app.id)
            continue
        intake = db.get(ProgramIntake, app.intake_id)
        uni = db.get(University, app.university_id)
        if deadline_passed(db, app, intake, today):
            # The deadline passed before submission: no "Submit …" or upload task for the student; the counselor owns the
            # next step (a later round or intake) — the same owner as the strategy item DEADLINE_PASSED.
            inactive_apps.add(app.id)
            if agency_org:
                stu = db.get(User, student_user_id)
                wanted[f"deadline-passed:{app.id}"] = dict(
                    title=f"Deadline passed: {stu.full_name if stu else ''} — {uni.name_en} ({_prog_name(db, app)})", title_key="task.deadlinePassed",
                    title_params={"student": stu.full_name if stu else "", "university": uni.name_en, "university_id": str(uni.id), "program": _prog_name(db, app)},
                    task_type=TaskType.GENERAL, due_at=now + timedelta(days=2), owner_user_id=counselor, owner_org_id=agency_org,
                    application_id=app.id, university_id=uni.id, visible_to_student=False, link=f"/students/{sid}?tab=applications",
                )
            continue
        if app.status in (ApplicationStatus.DRAFT, ApplicationStatus.PROFILE_REVIEW, ApplicationStatus.DOCUMENT_PREPARATION, ApplicationStatus.READY):
            due = _dt(intake.application_deadline)
            wanted[f"deadline:{app.id}"] = dict(
                # The program is part of the title: a student may apply to two programs at one university.
                title=f"Submit your {_prog_name(db, app)} application to {uni.name_en}", title_key="task.submitProgramApplication",
                title_params={"university": uni.name_en, "university_id": str(uni.id), "program": _prog_name(db, app)},
                task_type=TaskType.APPLICATION_DEADLINE, due_at=due, owner_user_id=student_user_id, owner_org_id=agency_org,
                application_id=app.id, university_id=uni.id, visible_to_student=True, link=f"/applications/{app.id}",
                reminder_offsets_hours=[24 * 14, 24 * 7, 24 * 2, 12],
            )
            program = db.get(Program, app.program_id)
            for item in checklist(db, student_user_id, program, uni, profile.nationality if profile else None, today):
                if item["action_code"] in ("UPLOAD", "FIX", "RENEW", "LEGALIZE", "TOO_OLD") and item["required"]:
                    key = f"doc:{sid}:{item['category']}:{item['action_code']}"
                    wanted.setdefault(key, dict(
                        title=item["action"], title_key=f"task.doc.{item['action_code']}", title_params={"category": item["category"], "university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.DOCUMENT_UPLOAD,
                        due_at=_dt(intake.document_deadline or intake.application_deadline) - timedelta(days=7),
                        owner_user_id=student_user_id, owner_org_id=agency_org, application_id=app.id, university_id=uni.id,
                        # V26 (REPORT §341): the exact requirement — the document itself when one exists (fix, renew,
                        # legalize: its drawer opens with the reason), otherwise the requirement row, highlighted.
                        visible_to_student=True,
                        link=f"/documents?doc={item['document_id']}" if item.get("document_id") and item["action_code"] != "UPLOAD"
                        else f"/documents?focus={item['category']}",
                    ))
                if item["status"] in ("UPLOADED", "NEEDS_REVIEW") and agency_org:
                    key = f"review:{item['document_id']}"
                    wanted.setdefault(key, dict(
                        title=f"Review {_in_sentence(item['label'])}", title_key="task.reviewDocument", title_params={"category": item["category"]}, task_type=TaskType.DOCUMENT_REVIEW,
                        due_at=now + timedelta(hours=48), owner_org_id=agency_org, owner_user_id=None,
                        application_id=app.id, university_id=uni.id, link=f"/documents?doc={item['document_id']}",
                    ))
        if app.status == ApplicationStatus.TUITION_PENDING:
            wanted[f"tuition:{app.id}"] = dict(
                title=f"Pay tuition for {uni.name_en}", title_key="task.payTuition", title_params={"university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.TUITION_PAYMENT,
                due_at=_dt(app.tuition_due or intake.tuition_deadline), owner_user_id=student_user_id, owner_org_id=agency_org,
                application_id=app.id, university_id=uni.id, visible_to_student=True, link=f"/applications/{app.id}",
            )
        # Explicit university document requests carry their own task with the exact note; the generic one is only a fallback.
        has_explicit_request = db.scalar(select(DocumentRequest.id).where(DocumentRequest.application_id == app.id, DocumentRequest.status == "OPEN").limit(1))
        if app.status == ApplicationStatus.ADDITIONAL_DOCUMENTS and not has_explicit_request:
            wanted[f"unireq:{app.id}"] = dict(
                title=f"{uni.name_en} requested additional documents", title_key="task.universityRequest", title_params={"university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.UNIVERSITY_REQUEST,
                due_at=now + timedelta(days=5), owner_user_id=student_user_id, owner_org_id=agency_org,
                application_id=app.id, university_id=uni.id, visible_to_student=True, link=f"/applications/{app.id}",
            )
        if app.status == ApplicationStatus.INTERVIEW and app.interview_at:
            wanted[f"interview:{app.id}"] = dict(
                title=f"Interview with {uni.name_en}", title_key="task.interview", title_params={"university": uni.name_en, "university_id": str(uni.id)}, task_type=TaskType.INTERVIEW, due_at=app.interview_at,
                owner_user_id=student_user_id, owner_org_id=agency_org, application_id=app.id, university_id=uni.id,
                visible_to_student=True, link=f"/applications/{app.id}",
            )

    for e in db.scalars(select(Essay).where(Essay.owner_user_id == student_user_id)).all():
        if e.application_id in inactive_apps:
            continue  # V9 reliability: no writing/review work for a withdrawn, rejected or missed-deadline application
        if e.status in (EssayStatus.SUBMITTED, EssayStatus.AI_PRECHECK, EssayStatus.AGENCY_REVIEW, EssayStatus.FINAL_REVIEW) and agency_org:
            wanted[f"essay-review:{e.id}"] = dict(
                title=f"Review essay: {e.title}", title_key="task.reviewEssay", title_params={"essayType": e.essay_type.value, "university": _essay_uni(db, e)}, task_type=TaskType.ESSAY_REVIEW, due_at=now + timedelta(hours=72),
                owner_user_id=e.reviewer_user_id or counselor, owner_org_id=agency_org, link=f"/essays/{e.id}",
            )
        if e.status in (EssayStatus.CHANGES_REQUESTED, EssayStatus.STUDENT_REVISION, EssayStatus.DRAFT):
            wanted[f"essay-write:{e.id}"] = dict(
                title=f"Revise: {e.title}" if e.status != EssayStatus.DRAFT else f"Write: {e.title}", title_key="task.reviseEssay" if e.status != EssayStatus.DRAFT else "task.writeEssay", title_params={"essayType": e.essay_type.value, "university": _essay_uni(db, e)},
                task_type=TaskType.ESSAY_WRITE, due_at=_dt(e.due_date), owner_user_id=student_user_id,
                owner_org_id=agency_org, visible_to_student=True, link=f"/essays/{e.id}",
            )

    for case in db.scalars(select(VisaCase).where(VisaCase.student_user_id == student_user_id)).all():
        if case.status in (VisaStatus.DOCUMENT_PREPARATION, VisaStatus.READY_TO_APPLY, VisaStatus.ADDITIONAL_DOCUMENTS):
            nxt = next((i for i in visa_checklist(db, case, profile.nationality if profile else None) if not i["done"] and not i["blocked"]), None)
            if nxt:
                wanted[f"visa:{case.id}:{nxt['key']}"] = dict(
                    title=nxt["title"], title_key=f"task.visa.{nxt['key']}", title_params={}, task_type=TaskType.VISA_STEP,
                    due_at=_dt(case.target_entry_date - timedelta(days=30)) if case.target_entry_date else None,
                    owner_user_id=student_user_id, owner_org_id=agency_org, visible_to_student=True, link="/visa",
                )

    if assignment and assignment.first_response_at is None and assignment.first_response_due_at:
        wanted[f"sla:{assignment.id}"] = dict(
            title="First contact with newly assigned student", title_key="task.firstContact", title_params={}, task_type=TaskType.SLA_FOLLOW_UP,
            due_at=assignment.first_response_due_at, owner_user_id=counselor, owner_org_id=agency_org,
            link=f"/students/{sid}",
        )

    # V29: the plan's own operations — dormitory / visa work by plan level, the Premium arrival window.
    from app.services import plan_operations

    wanted.update(plan_operations.tasks(db, student_user_id, agency_org=agency_org, counselor=counselor))

    existing = {t.dedupe_key: t for t in db.scalars(select(Task).where(Task.student_user_id == student_user_id, Task.source == "ENGINE"))}
    created = 0
    for key, spec in wanted.items():
        t = existing.get(key)
        if t is None:
            db.add(Task(student_user_id=student_user_id, source="ENGINE", dedupe_key=key, priority=_priority(spec.get("due_at"), now), **spec))
            created += 1
        elif t.status == TaskStatus.DONE and key.startswith(("doc:", "review:")):
            # Trigger came back (e.g. a document was rejected again) — reopen instead of duplicating.
            t.status, t.completed_at = TaskStatus.OPEN, None
        elif t.status == TaskStatus.OPEN:
            t.priority = _priority(spec.get("due_at"), now)
        if t is not None:
            t.title, t.title_key, t.title_params = spec["title"], spec.get("title_key"), spec.get("title_params")
            # Keep what the title names and what the task points at in step (application, university, link, deadline).
            for f in ("application_id", "university_id", "link"):
                if f in spec:
                    setattr(t, f, spec[f])
            if t.status == TaskStatus.OPEN and spec.get("due_at"):
                t.due_at = spec["due_at"]
    for key, t in existing.items():
        if key not in wanted and t.status in (TaskStatus.OPEN, TaskStatus.IN_PROGRESS):
            t.status, t.completed_at = TaskStatus.DONE, now
    db.flush()
    return created
