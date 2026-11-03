"""Coherent demo personas (V3).

Three students that each tell one complete, internally consistent story, so every number a demo shows agrees with the
records behind it:

* ``student@demo.hangyul.kr`` — Nguyễn Thị Lan (core seed): preparing applications, documents incomplete, counselor assigned.
* ``student.offer@demo.hangyul.kr`` — Bùi Thu Hà: two offers to compare (admission result, offer comparison, tuition).
* ``student.visa@demo.hangyul.kr`` — Võ Quốc Bảo: offer accepted, tuition paid, admission letter issued, visa in
  preparation, dormitory chosen, arrival being planned.
* ``student.new@demo.hangyul.kr`` — Dilnoza Karimova: early exploration (quick answers only, no applications).

Everything is fictional sample data (``is_demo=True``).
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.security import hash_password, mask
from app.core.storage import sha256
from app.models import (
    AgencyAssignment,
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    ArrivalPlan,
    ConsentRecord,
    Conversation,
    ConversationParticipant,
    Document,
    DocumentRequirement,
    DocumentReview,
    DocumentVersion,
    Dormitory,
    Essay,
    EssayVersion,
    HousingCase,
    Message,
    Order,
    Payment,
    Program,
    SavedUniversity,
    ServiceProduct,
    StudentEducation,
    StudentLanguage,
    StudentProfile,
    VisaCase,
)
from app.models.enums import (
    ApplicationStatus as S,
)
from app.models.enums import (
    AssignmentStatus,
    ConversationKind,
    DegreeLevel,
    DocumentStatus,
    EssayStatus,
    EssayType,
    HousingStatus,
    IntakeTerm,
    LanguageTest,
    LegalizationPath,
    LegalizationStatus,
    OrderStatus,
    PipelineStage,
    Role,
    VisaStatus,
)
from app.models.enums import (
    DocumentCategory as DC,
)
from app.seed import essay_text
from app.seed.fixtures import DEMO_PASSWORD, make_user
from app.seed.run import NOW, TODAY, tiny_pdf
from app.services.notify import notify
from app.services.readiness import application_readiness
from app.services.tasks_engine import generate_for_student
from app.services.visa import infer_visa

ALL_DOCS = [
    (DC.PASSPORT, "Passport"), (DC.PHOTO, "Photo"), (DC.GRADUATION_CERTIFICATE, "High school diploma"), (DC.TRANSCRIPT, "Transcript"),
    (DC.BANK_STATEMENT, "Bank balance certificate"), (DC.TOPIK, "TOPIK certificate"), (DC.FAMILY_RELATION_CERTIFICATE, "Family relationship certificate"),
    (DC.PERSONAL_STATEMENT, "Personal statement"), (DC.STUDY_PLAN, "Study plan"),
]


def _student(db: Session, email: str, name: str, preferred: str, cc: str, *, onboarded: bool = True) -> tuple:
    u = make_user(db, email, name, roles=[Role.STUDENT])
    # run.py sets its password hash on the __main__ module, so set ours explicitly.
    u.password_hash = hash_password(DEMO_PASSWORD)
    u.preferred_name = preferred
    prof = StudentProfile(
        user_id=u.id, nationality=cc, residence_country=cc, date_of_birth=date(2006, 5, 14), has_passport=onboarded,
        passport_number_masked=mask(f"{cc}8844120") if onboarded else None, passport_expiry=date(2032, 5, 1) if onboarded else None,
        target_degree=DegreeLevel.BACHELOR, target_intake_year=2027, target_intake_term=IntakeTerm.SPRING,
        desired_fields=["business"], preferred_regions=["Seoul"] if onboarded else [], annual_budget_krw=26000000 if onboarded else None,
        needs_scholarship=True, housing_preference="DORM" if onboarded else None, financial_sponsor="PARENTS" if onboarded else None,
        korean_self_level="INTERMEDIATE" if onboarded else None, onboarding_step=7 if onboarded else 1,
        onboarding_completed_at=(NOW - timedelta(days=90)) if onboarded else None, is_demo=True, lead_source="web_signup",
    )
    db.add(prof)
    db.flush()
    return u, prof


def _education_and_language(db: Session, prof: StudentProfile, gpa: float, topik: int | None):
    db.add(StudentEducation(profile_id=prof.id, level="HIGH_SCHOOL", institution="Public upper-secondary school", country=prof.nationality, major="General",
                            graduation_year=2025, graduation_status="GRADUATED", gpa_value=gpa, gpa_scale_min=0, gpa_scale_max=10, gpa_percent=round(gpa * 10, 1)))
    if topik:
        db.add(StudentLanguage(profile_id=prof.id, test=LanguageTest.TOPIK, score=topik, test_date=date(2026, 4, 12), expires_on=date(2028, 4, 12), verified=True))


def _assign(db: Session, u, ctx, slug: str) -> AgencyAssignment:
    org = ctx["agencies"][slug]
    counselor = ctx["counselors"][slug][0]
    prod = db.query(ServiceProduct).filter_by(code="PREMIUM").one()
    price = next(p for p in prod.prices if p.country_code is None)
    created = NOW - timedelta(days=120)
    order = Order(user_id=u.id, product_id=prod.id, price_id=price.id, currency=price.currency, amount_minor=price.amount_minor, status=OrderStatus.PAID, paid_at=created, created_at=created)
    db.add(order)
    db.flush()
    db.add(Payment(order_id=order.id, provider="demo", provider_ref=f"demo_persona_{u.id.hex[:8]}", status="PAID", amount_minor=price.amount_minor, currency=price.currency, raw={"demo": True}))
    a = AgencyAssignment(student_user_id=u.id, organization_id=org.id, counselor_user_id=counselor.id, status=AssignmentStatus.ACTIVE, score=84.0,
                         score_breakdown=[{"factor": "country", "weight": 25, "points": 25, "note": "Country expertise: Vietnam"}], assigned_by="ENGINE", order_id=order.id,
                         first_response_due_at=created + timedelta(hours=24), first_response_at=created + timedelta(hours=5), created_at=created)
    db.add(a)
    db.add(ConsentRecord(user_id=u.id, purpose="SHARE_WITH_AGENCY", version="2026-09", granted=True, created_at=created))
    db.flush()
    return a


def _documents(db: Session, u, prof, a: AgencyAssignment, storage, overrides: dict | None = None) -> dict:
    overrides = overrides or {}
    docs = {}
    for cat, title in ALL_DOCS:
        status = overrides.get(cat, DocumentStatus.VERIFIED)
        legal = cat in (DC.GRADUATION_CERTIFICATE, DC.TRANSCRIPT, DC.FAMILY_RELATION_CERTIFICATE)
        created = NOW - timedelta(days=80)
        d = Document(owner_user_id=u.id, category=cat, title=title, issuing_country=prof.nationality, issue_date=(TODAY - timedelta(days=20)) if cat == DC.BANK_STATEMENT else date(2025, 6, 15),
                     language="vi", translation_required=True, legalization_path=LegalizationPath.APOSTILLE if legal else LegalizationPath.NONE,
                     legalization_status=(LegalizationStatus.COMPLETED if legal else LegalizationStatus.NOT_REQUIRED), status=status, current_version=1, is_demo=True,
                     created_at=created, updated_at=created + timedelta(days=2))
        if cat == DC.PASSPORT:
            d.expires_on = prof.passport_expiry
        db.add(d)
        db.flush()
        data = tiny_pdf(f"{title} - {u.full_name}")
        key = storage.put(data, prefix=f"students/{u.id}")
        db.add(DocumentVersion(document_id=d.id, version=1, storage_key=key, original_filename=f"{cat.value.lower()}.pdf", mime_type="application/pdf",
                               size_bytes=len(data), sha256=sha256(data), scan_status="SKIPPED", uploaded_by_id=u.id, created_at=created))
        if status == DocumentStatus.VERIFIED:
            db.add(DocumentReview(document_id=d.id, version=1, reviewer_user_id=a.counselor_user_id, reviewer_org_id=a.organization_id, decision="VERIFIED", created_at=created + timedelta(days=2)))
        docs[cat] = d
    return docs


def _application(db: Session, u, a, prog: Program, path: list[S], decided_days_ago: int) -> Application:
    intake = next(i for i in sorted(prog.intakes, key=lambda i: i.application_deadline) if i.is_open)
    app = Application(student_user_id=u.id, program_id=prog.id, intake_id=intake.id, university_id=prog.university_id, agency_org_id=a.organization_id,
                      status=path[-1], is_demo=True)
    db.add(app)
    db.flush()
    start = NOW - timedelta(days=60)
    prev = None
    for k, st in enumerate(path):
        offered_at = path.index(S.OFFERED) if S.OFFERED in path else None
        if offered_at is None or k < offered_at:
            at = start + timedelta(days=k * 5)
        elif k == offered_at:
            at = NOW - timedelta(days=decided_days_ago)
        else:  # steps after the offer, spaced two days apart and never in the future
            at = NOW - timedelta(days=max(1, decided_days_ago - (k - offered_at) * 2))
        if st == S.SUBMITTED:
            app.submitted_at = at
        if st == S.OFFERED:
            app.decided_at = at
        uni_side = st in (S.UNIVERSITY_REVIEW, S.OFFERED, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED)
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=st, actor_org_type="UNIVERSITY" if uni_side else "AGENCY", created_at=at))
        prev = st
    app.created_at = start
    app.updated_at = NOW - timedelta(hours=6)
    # Every required document is shared once submitted; essays are approved.
    for req in db.query(DocumentRequirement).filter_by(university_id=app.university_id, program_id=None).all():
        if req.degree_level and req.degree_level != prog.degree_level.value:
            continue
        doc = db.query(Document).filter_by(owner_user_id=u.id, category=req.category).first()
        if doc:
            db.add(ApplicationDocument(application_id=app.id, requirement_id=req.id, document_id=doc.id, shared_with_university=True))
    for et, label, limit in ((EssayType.PERSONAL_STATEMENT, "Personal statement", 1000), (EssayType.STUDY_PLAN, "Study plan", 1500)):
        e = Essay(owner_user_id=u.id, application_id=app.id, program_id=prog.id, essay_type=et, title=f"{label} — {prog.university.name_en}",
                  prompt="Describe your motivation for applying, your academic background, and your study and career plans.", word_limit=limit,
                  status=EssayStatus.APPROVED, reviewer_user_id=a.counselor_user_id, due_date=intake.application_deadline, current_version=2)
        db.add(e)
        db.flush()
        db.add(EssayVersion(essay_id=e.id, version=1, body=essay_text.body_for(db, e, partial=True), author_user_id=u.id, created_at=NOW - timedelta(days=50)))
        db.add(EssayVersion(essay_id=e.id, version=2, body=essay_text.body_for(db, e), author_user_id=u.id, created_at=NOW - timedelta(days=40),
                            note="Final version approved by the counselor"))
    return app


def _conversation(db: Session, u, a, lines: list[tuple[bool, str, int]]):
    conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject="Your study-in-Korea team", student_user_id=u.id, last_message_at=NOW - timedelta(hours=lines[-1][2]))
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=u.id))
    db.add(ConversationParticipant(conversation_id=conv.id, organization_id=a.organization_id))
    for from_student, body, hours in lines:
        db.add(Message(conversation_id=conv.id, author_user_id=u.id if from_student else a.counselor_user_id, body=body, created_at=NOW - timedelta(hours=hours)))


def _program(ctx, uni_slug: str, field: str = "business") -> Program:
    uni = ctx["unis"][uni_slug]
    return next(p for p in uni.programs if p.degree_level == DegreeLevel.BACHELOR and p.field == field)


def _finish(db: Session, u, prof):
    for app in db.query(Application).filter_by(student_user_id=u.id).all():
        app.readiness_percent, _ = application_readiness(db, app, prof, TODAY)
    generate_for_student(db, u.id)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    storage = ctx["storage"]

    # ---------------------------------------------------------------- B · two offers to compare
    u, prof = _student(db, "student.offer@demo.hangyul.kr", "Bùi Thu Hà", "Hà", "VN")
    _education_and_language(db, prof, 8.8, 4)
    a = _assign(db, u, ctx, "lotus-bridge")
    _documents(db, u, prof, a, storage)
    kh = _application(db, u, a, _program(ctx, "kyung-hee-university"), [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED], 3)
    kh.offer_scholarship_note = "Freshman merit scholarship: 30% of first-semester tuition"
    kh.tuition_amount_krw = db.get(Program, kh.program_id).tuition_per_semester_krw
    kh.tuition_due = TODAY + timedelta(days=18)
    hy = _application(db, u, a, _program(ctx, "chung-ang-university"), [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED], 1)
    hy.tuition_amount_krw = db.get(Program, hy.program_id).tuition_per_semester_krw
    hy.tuition_due = TODAY + timedelta(days=24)
    _application(db, u, a, _program(ctx, "yonsei-university"), [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW], 0)
    prof.pipeline_stage = PipelineStage.OFFERED
    _conversation(db, u, a, [
        (False, "Congratulations, Hà! Kyung Hee has made you an offer with a 30% first-semester scholarship. Chung-Ang's offer arrived yesterday too.", 20),
        (True, "Thank you!! How do I decide between them?", 18),
        (False, "Open 'Compare offers' in your application — it lines up tuition after scholarship, deadlines and dormitory. Let's talk on Thursday.", 17),
    ])
    for app, uni in ((kh, "Kyung Hee University"), (hy, "Chung-Ang University")):
        # V17: the key real transitions raise (`applications.py`), not one the product does not have —
        # `notify.applicationStatus` existed in no locale bundle, so this seeded row rendered its English
        # fallback inside a Korean UI.
        notify(db, u.id, "APPLICATION_STATUS", "notify.application.OFFERED", f"{uni} has made you an offer", params={"university": uni, "status": "OFFERED"}, link=f"/applications/{app.id}")
    _finish(db, u, prof)

    # ---------------------------------------------------------------- B2 · after admission: tuition, admission letter, visa, housing
    u, prof = _student(db, "student.visa@demo.hangyul.kr", "Võ Quốc Bảo", "Bảo", "VN")
    _education_and_language(db, prof, 8.2, 3)
    a = _assign(db, u, ctx, "lotus-bridge")
    docs = _documents(db, u, prof, a, storage, {DC.BANK_STATEMENT: DocumentStatus.NEEDS_REVIEW})
    path = [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID,
            S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION]
    prog = _program(ctx, "sungkyunkwan-university")
    app = _application(db, u, a, prog, path, 21)
    app.tuition_amount_krw = prog.tuition_per_semester_krw
    app.tuition_due = TODAY - timedelta(days=8)
    intake = next(i for i in prog.intakes if i.id == app.intake_id)
    vt, why = infer_visa(prog.degree_level)
    db.add(VisaCase(student_user_id=u.id, application_id=app.id, visa_type=vt, visa_type_reason=why, status=VisaStatus.DOCUMENT_PREPARATION,
                    completed_steps=["admission_certificate", "passport", "application_form", "tuition_receipt"], target_entry_date=intake.semester_start - timedelta(days=10)))
    dorm = db.query(Dormitory).filter_by(university_id=prog.university_id).first()
    db.add(HousingCase(student_user_id=u.id, university_id=prog.university_id, dormitory_id=dorm.id if dorm else None, status=HousingStatus.DORM_APPLYING,
                       preference="DORM", budget_monthly_krw=550000, room_preference="Double", application_deadline=TODAY + timedelta(days=30),
                       completed_items=["compare_options", "check_eligibility"]))
    db.add(ArrivalPlan(student_user_id=u.id, arrival_airport="ICN", pickup_requested=False, completed_items=[], residence_card_due=None))
    prof.pipeline_stage = PipelineStage.VISA_PREPARATION
    _ = docs
    _conversation(db, u, a, [
        (False, "Your standard admission letter from Sungkyunkwan is in your documents. Next: the bank balance certificate for the visa.", 30),
        (True, "I uploaded it this morning — is the date okay?", 4),
    ])
    notify(db, u.id, "APPLICATION_STATUS", "notify.application.ADMISSION_CERTIFICATE_ISSUED",
           "Sungkyunkwan University issued your admission letter",
           params={"university": "Sungkyunkwan University", "status": "ADMISSION_CERTIFICATE_ISSUED"}, link=f"/applications/{app.id}")
    _finish(db, u, prof)

    # ---------------------------------------------------------------- C · early exploration
    u, prof = _student(db, "student.new@demo.hangyul.kr", "Dilnoza Karimova", "Dilnoza", "UZ", onboarded=False)
    db.add(StudentLanguage(profile_id=prof.id, test=LanguageTest.TOPIK, score=2, test_date=date(2026, 7, 5), expires_on=date(2028, 7, 5), verified=False))
    # She answered the quick check ("I'll finish high school before the program starts") — self-declared, no school name or grades yet.
    db.add(StudentEducation(profile_id=prof.id, level="HIGH_SCHOOL", institution="", country="UZ", graduation_year=2027, graduation_status="EXPECTED"))
    for slug in ("pusan-national-university", "kyungpook-national-university"):
        db.add(SavedUniversity(user_id=u.id, university_id=ctx["unis"][slug].id, created_at=NOW - timedelta(days=2)))
    prof.pipeline_stage = PipelineStage.PROFILE_INCOMPLETE
    db.flush()
