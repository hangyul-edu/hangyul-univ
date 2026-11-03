"""V9 scale validation data (REPORT §55–61, reliability workstream, Part B).

Adds to a SEPARATE database (refuses unless HG_DATABASE_URL names a database containing "scale"):
  * 200 (or HG_SCALE_STUDENTS) active students for the Lotus Bridge counselor (counselor@lotus.demo.hangyul.kr) with varied stages, engine + manual
    tasks, documents waiting for review / correction, essays in review, a support conversation each, near deadlines;
  * ~1,000 submitted applications to Pusan National University across programs, intakes and the four agencies.

Usage (from server/):
  HG_DATABASE_URL=postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_scale .venv/bin/python scripts/v9_scale_seed.py
Idempotent: does nothing when the scale students already exist (email prefix scale.).
"""
from __future__ import annotations

import os
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DB_URL = os.environ.get("HG_DATABASE_URL", "")
# V26 (REPORT §29 of the brief): the agency scale test runs at ~1,000 students — `HG_SCALE_STUDENTS=1000`.
N_STUDENTS = int(os.environ.get("HG_SCALE_STUDENTS", "200"))
if "scale" not in DB_URL.rsplit("/", 1)[-1]:
    sys.exit("refusing: HG_DATABASE_URL must point at a scale database (name containing 'scale'), never the dev DB")

from sqlalchemy import select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password, mask  # noqa: E402
from app.models import (  # noqa: E402
    AgencyAssignment,
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    ConsentRecord,
    Conversation,
    ConversationParticipant,
    Document,
    DocumentRequirement,
    DocumentVersion,
    Essay,
    EssayVersion,
    Message,
    Organization,
    OrganizationMember,
    Program,
    ProgramIntake,
    StudentEducation,
    StudentLanguage,
    StudentProfile,
    Task,
    University,
    User,
    UserRole,
)
from app.models.enums import (  # noqa: E402
    ApplicationStatus as S,
)
from app.models.enums import (  # noqa: E402
    AssignmentStatus,
    ConversationKind,
    DegreeLevel,
    DocumentStatus,
    EssayStatus,
    EssayType,
    IntakeTerm,
    LanguageTest,
    MessageVisibility,
    PipelineStage,
    Role,
    TaskPriority,
    TaskStatus,
    TaskType,
)
from app.models.enums import (  # noqa: E402
    DocumentCategory as DC,
)
from app.services.readiness import application_readiness  # noqa: E402
from app.services.tasks_engine import generate_for_student  # noqa: E402

rng = random.Random(9009)
NOW = datetime.now(timezone.utc)
TODAY = NOW.date()
PW = hash_password("Hangyul!2026")

FIRST = ["Lan", "Khoa", "Hà", "Bảo", "Huy", "Anh", "Vy", "Minh", "Linh", "Nam", "Phương", "Tùng", "Ngọc", "An", "Kiệt", "Quang", "Châu", "Trang", "Hiếu", "Thảo"]
LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý", "Phan", "Trịnh", "Mai", "Cao", "Hồ", "Tạ"]
OTHER = {"UZ": ["Dilnoza Karimova", "Jasur Tursunov", "Madina Yusupova", "Bekzod Rakhimov", "Sardor Kholmatov"],
         "MN": ["Enkhjin Bat-Erdene", "Temuulen Ganbold", "Nomin Dorj", "Anujin Batbayar"],
         "NP": ["Sita Sharma", "Aarav Adhikari", "Prakriti Gurung", "Bikash Thapa"],
         "CN": ["Wang Jiayi", "Li Hao", "Zhang Yuxin", "Liu Chen", "Chen Siyu"],
         "VN": [f"{a} {b}" for a in LAST[:6] for b in FIRST[:6]]}
AGENCY_COUNTRY = {"lotus-bridge": "VN", "silk-road": "UZ", "himalaya-pathways": "NP", "seoul-gateway": "CN"}
SUBMITTED_STATES = [S.SUBMITTED, S.UNIVERSITY_REVIEW, S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.OFFERED, S.WAITLISTED, S.REJECTED, S.OFFER_ACCEPTED, S.TUITION_PENDING]
SUBMITTED_W = [22, 30, 8, 8, 12, 4, 8, 4, 4]
PATH = [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW]
DOC_CATS = [(DC.PASSPORT, "Passport"), (DC.PHOTO, "Photo"), (DC.GRADUATION_CERTIFICATE, "High school diploma"), (DC.TRANSCRIPT, "Transcript"),
            (DC.BANK_STATEMENT, "Bank balance certificate"), (DC.TOPIK, "TOPIK certificate"), (DC.FAMILY_RELATION_CERTIFICATE, "Family relationship certificate")]


def at(d: date, hour: int = 10) -> datetime:
    return datetime.combine(d, time(hour), tzinfo=timezone.utc)


def make_student(db, email: str, name: str, cc: str, degree: DegreeLevel) -> tuple[User, StudentProfile]:
    u = User(email=email, password_hash=PW, full_name=name, locale="en", is_demo=True, created_at=NOW - timedelta(days=rng.randint(20, 300)))
    db.add(u)
    db.flush()
    db.add(UserRole(user_id=u.id, role=Role.STUDENT))
    db.add(ConsentRecord(user_id=u.id, purpose="TERMS", version="2026-09", granted=True, created_at=u.created_at))
    db.add(ConsentRecord(user_id=u.id, purpose="PRIVACY", version="2026-09", granted=True, created_at=u.created_at))
    prof = StudentProfile(user_id=u.id, nationality=cc, residence_country=cc, date_of_birth=date(rng.randint(1997, 2007), rng.randint(1, 12), rng.randint(1, 28)),
                          has_passport=True, passport_number_masked=mask(f"{cc}{rng.randint(1000000, 9999999)}"), passport_expiry=date(2031, rng.randint(1, 12), 1),
                          target_degree=degree, target_intake_year=2027, target_intake_term=IntakeTerm.SPRING if rng.random() < 0.6 else IntakeTerm.FALL,
                          desired_fields=["business"], preferred_regions=["Busan"], annual_budget_krw=rng.choice([14000000, 18000000, 22000000]),
                          needs_scholarship=rng.random() < 0.6, housing_preference="DORM", korean_self_level=rng.choice(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
                          english_self_level="INTERMEDIATE", financial_sponsor="PARENTS", onboarding_step=7, onboarding_completed_at=u.created_at + timedelta(days=1),
                          is_demo=True, lead_source="partner_event", pipeline_stage=PipelineStage.ASSIGNED)
    db.add(prof)
    db.flush()
    prior = "BACHELOR" if degree in (DegreeLevel.MASTER, DegreeLevel.DOCTORATE) else "HIGH_SCHOOL"
    gpa = round(rng.uniform(6.5, 9.5), 2)
    db.add(StudentEducation(profile_id=prof.id, level=prior, institution="Public upper-secondary school", country=cc, major="General", graduation_year=2025,
                            graduation_status="GRADUATED", gpa_value=gpa, gpa_scale_min=0, gpa_scale_max=10, gpa_percent=round(gpa * 10, 1)))
    topik = rng.choice([None, 3, 4, 5])
    if topik:
        db.add(StudentLanguage(profile_id=prof.id, test=LanguageTest.TOPIK, score=topik, test_date=date(2026, 4, 12), expires_on=date(2028, 4, 12)))
    return u, prof


def assign(db, u: User, org: Organization, counselor_id) -> AgencyAssignment:
    created = NOW - timedelta(days=rng.randint(3, 200))
    a = AgencyAssignment(student_user_id=u.id, organization_id=org.id, counselor_user_id=counselor_id, status=AssignmentStatus.ACTIVE, score=75.0,
                         assigned_by="ENGINE", first_response_due_at=created + timedelta(hours=24),
                         first_response_at=None if rng.random() < 0.04 else created + timedelta(hours=rng.choice([2, 6, 20, 30])), created_at=created)
    db.add(a)
    db.add(ConsentRecord(user_id=u.id, purpose="SHARE_WITH_AGENCY", version="2026-09", granted=True, created_at=created))
    return a


def add_app(db, u: User, prog: Program, intake: ProgramIntake, org_id, final: S) -> Application:
    app = Application(student_user_id=u.id, program_id=prog.id, intake_id=intake.id, university_id=prog.university_id, agency_org_id=org_id, status=final, is_demo=True)
    db.add(app)
    db.flush()
    path = list(PATH[:PATH.index(final) + 1]) if final in PATH else PATH + ([final] if final not in PATH else [])
    start = at(intake.application_deadline - timedelta(days=rng.randint(40, 80)))
    end = min(NOW - timedelta(hours=6), at(intake.application_deadline) + timedelta(days=60))
    span = max((end - start).total_seconds(), 3600 * len(path))
    prev, when = None, start
    for k, st in enumerate(path):
        when = start + timedelta(seconds=span * (k / max(len(path) - 1, 1)) ** 1.1)
        if st == S.SUBMITTED:
            when = min(when, at(intake.application_deadline) - timedelta(days=rng.randint(0, 10)), NOW - timedelta(days=1))
            app.submitted_at = when
        if st in (S.OFFERED, S.REJECTED, S.WAITLISTED):
            app.decided_at = when
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=st, actor_org_type="UNIVERSITY" if st in (S.UNIVERSITY_REVIEW, S.OFFERED, S.REJECTED, S.WAITLISTED, S.INTERVIEW) else "AGENCY",
                                        created_at=when))
        prev = st
    app.created_at, app.updated_at = start, when
    if final == S.INTERVIEW:
        app.interview_at = NOW + timedelta(days=rng.randint(3, 14))
    if final == S.TUITION_PENDING:
        app.tuition_amount_krw, app.tuition_due = prog.tuition_per_semester_krw, TODAY + timedelta(days=rng.randint(5, 25))
    if rng.random() < 0.05:
        app.flagged, app.flag_reason = True, "Transcript name spelling differs from passport"
    return app


def add_docs(db, u: User, prof: StudentProfile, statuses: list[DocumentStatus]) -> dict:
    docs = {}
    for (cat, title), st in zip(DOC_CATS, statuses, strict=False):
        created = NOW - timedelta(days=rng.randint(1, 50))
        d = Document(owner_user_id=u.id, category=cat, title=title, issuing_country=prof.nationality,
                     issue_date=(TODAY - timedelta(days=12)) if cat == DC.BANK_STATEMENT else date(2025, 6, 15), language="en", status=st, current_version=1,
                     is_demo=True, created_at=created, updated_at=created + timedelta(hours=rng.randint(1, 48)),
                     rejection_reason="The scan is cut off at the bottom — please upload all pages." if st == DocumentStatus.NEEDS_CORRECTION else None)
        if cat == DC.PASSPORT:
            d.expires_on = prof.passport_expiry
        db.add(d)
        db.flush()
        db.add(DocumentVersion(document_id=d.id, version=1, storage_key=f"scale/{u.id}/{cat.value.lower()}.pdf", original_filename=f"{cat.value.lower()}.pdf",
                               mime_type="application/pdf", size_bytes=1024, sha256="0" * 64, scan_status="SKIPPED", uploaded_by_id=u.id, created_at=created))
        docs[cat] = d
    return docs


def share(db, app: Application, docs: dict, reqs: list[DocumentRequirement]):
    for r in reqs:
        if r.degree_level:
            continue
        d = docs.get(r.category)
        if d:
            db.add(ApplicationDocument(application_id=app.id, requirement_id=r.id, document_id=d.id, shared_with_university=True))


def main():
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email.like("scale.%")).limit(1)):
            print("scale data already present — nothing to do")
            return
        orgs = {o.slug: o for o in db.scalars(select(Organization).where(Organization.slug.in_(list(AGENCY_COUNTRY))))}
        counselors = {slug: [m.user_id for m in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == o.id,
                                                                                           OrganizationMember.role == Role.AGENCY_COUNSELOR))] for slug, o in orgs.items()}
        lotus_c = db.scalar(select(User.id).where(User.email == "counselor@lotus.demo.hangyul.kr"))
        pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
        pnu_progs = db.scalars(select(Program).where(Program.university_id == pnu.id)).all()
        pnu_reqs = db.scalars(select(DocumentRequirement).where(DocumentRequirement.university_id == pnu.id, DocumentRequirement.program_id.is_(None))).all()
        all_progs = db.scalars(select(Program).where(Program.degree_level == DegreeLevel.BACHELOR)).all()
        intakes = {p.id: sorted(db.scalars(select(ProgramIntake).where(ProgramIntake.program_id == p.id)).all(), key=lambda i: i.application_deadline)
                   for p in set(pnu_progs) | set(all_progs)}
        pnu_reviewers = db.scalars(select(OrganizationMember.user_id).join(Organization, Organization.id == OrganizationMember.organization_id)
                                   .where(Organization.university_id == pnu.id, OrganizationMember.role == Role.UNIVERSITY_REVIEWER)).all()

        def pnu_intake(p):
            # submitted already: the closed 2026 rounds, or the open Spring 2027 round (deadline in late October)
            opts = [i for i in intakes[p.id] if i.year == 2026 or (i.year == 2027 and i.term == IntakeTerm.SPRING)]
            return rng.choice(opts or intakes[p.id])

        pnu_count = 0
        # ---- 1) 200 Lotus students for one counselor
        lotus = orgs["lotus-bridge"]
        lotus_students = []
        for i in range(N_STUDENTS):
            name = f"{rng.choice(LAST)} {rng.choice(['Thị', 'Văn', 'Minh', 'Ngọc', 'Gia'])} {rng.choice(FIRST)}"
            u, prof = make_student(db, f"scale.lotus{i:03d}@demo.hangyul.kr", name, "VN", DegreeLevel.BACHELOR)
            assign(db, u, lotus, lotus_c)
            r = rng.random()
            apps = []
            if r < 0.15:   # early: no application yet
                prof.pipeline_stage = rng.choice([PipelineStage.ASSIGNED, PipelineStage.PROFILE_INCOMPLETE, PipelineStage.QUALIFIED])
            else:
                n = rng.choice([1, 2, 3])
                progs = rng.sample(all_progs, n)
                submitted_pnu = rng.random() < 0.75
                if submitted_pnu:
                    pp = rng.choice([p for p in pnu_progs if p.degree_level == DegreeLevel.BACHELOR])
                    progs = [pp] + [p for p in progs if p.university_id != pnu.id][: n - 1]
                used = set()
                for j, p in enumerate(progs):
                    if submitted_pnu and j == 0:
                        intake = pnu_intake(p)
                        final = rng.choices(SUBMITTED_STATES, SUBMITTED_W)[0]
                    else:
                        intake = next((x for x in intakes[p.id] if x.is_open), intakes[p.id][-1])
                        final = rng.choice([S.DRAFT, S.DOCUMENT_PREPARATION, S.DOCUMENT_PREPARATION, S.READY])
                    if intake.id in used:
                        continue
                    used.add(intake.id)
                    app = add_app(db, u, p, intake, lotus.id, final)
                    if app.university_id == pnu.id and app.submitted_at:
                        pnu_count += 1
                        if pnu_reviewers and rng.random() < 0.6:
                            app.university_reviewer_id = rng.choice(pnu_reviewers)
                    apps.append(app)
                stage_for = {S.DRAFT: PipelineStage.DOCUMENT_PREPARATION, S.DOCUMENT_PREPARATION: PipelineStage.DOCUMENT_PREPARATION, S.READY: PipelineStage.READY_TO_APPLY,
                             S.INTERVIEW: PipelineStage.INTERVIEW, S.OFFERED: PipelineStage.OFFERED, S.REJECTED: PipelineStage.REJECTED,
                             S.WAITLISTED: PipelineStage.WAITLISTED, S.OFFER_ACCEPTED: PipelineStage.TUITION_PENDING, S.TUITION_PENDING: PipelineStage.TUITION_PENDING}
                prof.pipeline_stage = stage_for.get(apps[0].status, PipelineStage.APPLIED) if apps else PipelineStage.ASSIGNED
            # documents: some waiting for review, some needing correction
            sts = [rng.choices([DocumentStatus.VERIFIED, DocumentStatus.NEEDS_REVIEW, DocumentStatus.NEEDS_CORRECTION, DocumentStatus.UPLOADED], [55, 22, 10, 13])[0]
                   for _ in DOC_CATS]
            docs = add_docs(db, u, prof, sts[: rng.randint(3, len(DOC_CATS))])
            for app in apps:
                if app.submitted_at:
                    share(db, app, docs, pnu_reqs if app.university_id == pnu.id else [])
                for et, label in ((EssayType.PERSONAL_STATEMENT, "Personal statement"), (EssayType.STUDY_PLAN, "Study plan")):
                    pre = app.status in (S.DRAFT, S.DOCUMENT_PREPARATION, S.READY)
                    st = rng.choice([EssayStatus.DRAFT, EssayStatus.AGENCY_REVIEW, EssayStatus.CHANGES_REQUESTED, EssayStatus.AGENCY_REVIEW]) if pre else EssayStatus.APPROVED
                    e = Essay(owner_user_id=u.id, application_id=app.id, program_id=app.program_id, essay_type=et, title=f"{label} — scale", word_limit=1000,
                              status=st, reviewer_user_id=lotus_c, due_date=db.get(ProgramIntake, app.intake_id).application_deadline, current_version=1,
                              prompt="Describe your motivation for applying.")
                    db.add(e)
                    db.flush()
                    db.add(EssayVersion(essay_id=e.id, version=1, author_user_id=u.id, created_at=NOW - timedelta(days=rng.randint(1, 20)),
                                        body="I want to study in Busan because the program connects business and logistics. " * 20))
            # conversation: about a third have the student's message last (needs reply)
            conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject="Your study-in-Korea team", student_user_id=u.id)
            db.add(conv)
            db.flush()
            db.add(ConversationParticipant(conversation_id=conv.id, user_id=u.id))
            db.add(ConversationParticipant(conversation_id=conv.id, organization_id=lotus.id))
            hours = sorted(rng.sample(range(2, 240), rng.randint(2, 6)), reverse=True)
            student_last = rng.random() < 0.33
            for k, h in enumerate(hours):
                last = k == len(hours) - 1
                author = (u.id if student_last else lotus_c) if last else rng.choice([u.id, lotus_c])
                db.add(Message(conversation_id=conv.id, author_user_id=author, body="Could you check my bank certificate date?" if author == u.id else "Thanks — I'll check it today.",
                               visibility=MessageVisibility.PARTICIPANTS, created_at=NOW - timedelta(hours=h)))
            conv.last_message_at = NOW - timedelta(hours=hours[-1])
            # a couple of manual counselor tasks; some overdue
            for k in range(rng.randint(0, 3)):
                due = NOW + timedelta(days=rng.randint(-6, 14))
                db.add(Task(title="Call the student about the visa timeline", task_type=TaskType.CONSULTATION, priority=rng.choice(list(TaskPriority)),
                            status=TaskStatus.OPEN, due_at=due, owner_user_id=lotus_c, owner_org_id=lotus.id, student_user_id=u.id, source="MANUAL",
                            created_by_id=lotus_c, created_at=NOW - timedelta(days=rng.randint(1, 20))))
            lotus_students.append((u, prof, apps))
            if i % 50 == 49:
                db.flush()
                print(f"  lotus students: {i + 1}")
        db.flush()
        for u, prof, apps in lotus_students:
            for app in apps:
                app.readiness_percent, _ = application_readiness(db, app, prof, TODAY)
            generate_for_student(db, u.id)
        db.commit()
        print(f"lotus: {N_STUDENTS} students, PNU submitted so far {pnu_count}")

        # ---- 2) top up to ~1,000 submitted PNU applications across agencies (+ some direct applicants)
        slugs = list(orgs)
        i = 0
        while pnu_count < 1000:
            slug = rng.choices(slugs + [None], [30, 25, 20, 15, 10])[0]
            cc = AGENCY_COUNTRY.get(slug) or rng.choice(["VN", "UZ", "MN", "NP", "CN"])
            degree = rng.choices([DegreeLevel.BACHELOR, DegreeLevel.MASTER, DegreeLevel.LANGUAGE, DegreeLevel.TRANSFER], [50, 25, 15, 10])[0]
            progs = [p for p in pnu_progs if p.degree_level == degree] or pnu_progs
            u, prof = make_student(db, f"scale.pnu{i:04d}@demo.hangyul.kr", rng.choice(OTHER[cc]), cc, degree)
            org = orgs[slug] if slug else None
            if org:
                assign(db, u, org, rng.choice(counselors[slug]) if counselors[slug] else None)
            p = rng.choice(progs)
            app = add_app(db, u, p, pnu_intake(p), org.id if org else None, rng.choices(SUBMITTED_STATES, SUBMITTED_W)[0])
            if pnu_reviewers and rng.random() < 0.6:
                app.university_reviewer_id = rng.choice(pnu_reviewers)
            prof.pipeline_stage = PipelineStage.APPLIED
            docs = add_docs(db, u, prof, [DocumentStatus.VERIFIED] * rng.randint(4, len(DOC_CATS)))
            share(db, app, docs, pnu_reqs)
            app.readiness_percent = rng.choice([80, 90, 100, 100])
            pnu_count += 1
            i += 1
            if i % 100 == 0:
                db.commit()
                print(f"  pnu applicants: {i}")
        db.commit()
        total = db.query(Application).filter(Application.university_id == pnu.id, Application.submitted_at.isnot(None)).count()
        print(f"done: +{N_STUDENTS} Lotus students, +{i} PNU applicants; PNU submitted applications now {total}")


if __name__ == "__main__":
    main()
