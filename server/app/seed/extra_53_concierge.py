"""V5 concierge demo data (all fictional, ``is_demo=True``).

* Two DEMO vendors in the Hangyul network (airport transport, housing provider) — no agreement, so they are never shown
  as a partner. ``is_demo=True`` stays on every row; V6 removed per-row "(sample)"/"Demo provider" wording from visible text.
* Two clearly-labelled DEMO off-campus listings near Sungkyunkwan from the demo housing provider (no invented real listings).
* SAMPLE decision facts on every dormitory (application window, eligibility, deposit, move-in, documents) — still DEMO.
* Personas:
  - ``student.visa@`` Bảo (existing): dormitory application submitted → DORMITORY case APPLIED.
  - ``student.arrival@`` Phạm Gia Huy: Sogang BBA Spring 2027, visa ISSUED, dorm confirmed, flight entered, pickup REQUESTED.
  - ``student.arrived@`` Lê Thảo Vy: Korea University BBA Fall 2026, arrived 2026-08-24 with a completed pickup, enrolled,
    residence-card case open (due 90 days after entry).
Non-partner universities are used for the new personas so partnership quotas (extra_40) stay derived from their own data.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import (
    Application,
    ApplicationDocument,
    ApplicationStatusHistory,
    ArrivalPlan,
    Document,
    DocumentRequirement,
    Dormitory,
    HousingCase,
    HousingListing,
    Program,
    StudentEnrollment,
    User,
    Vendor,
    VisaCase,
)
from app.models.enums import ApplicationStatus as S
from app.models.enums import EnrollmentStatus, HousingStatus, PipelineStage, VisaStatus
from app.seed.extra_10_personas import _assign, _conversation, _documents, _education_and_language, _finish, _program, _student
from app.seed.run import NOW, TODAY
from app.services import concierge as svc
from app.services.visa import infer_visa

SEOUL = ZoneInfo("Asia/Seoul")
PATH_TO_VISA = [S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING,
                S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED, S.VISA_ISSUED]


def _kst(d: date, hh: int, mm: int = 0) -> datetime:
    return datetime.combine(d, time(hh, mm), tzinfo=SEOUL)


def _application_for(db: Session, u, a, prog: Program, intake, path: list[S], last_at: datetime) -> Application:
    """Like extra_10's helper but for a chosen intake; history spaced 5 days apart, ending at ``last_at``."""
    app = Application(student_user_id=u.id, program_id=prog.id, intake_id=intake.id, university_id=prog.university_id, agency_org_id=a.organization_id,
                      status=path[-1], is_demo=True, tuition_amount_krw=prog.tuition_per_semester_krw)
    db.add(app)
    db.flush()
    prev = None
    for k, st in enumerate(path):
        at = last_at - timedelta(days=(len(path) - 1 - k) * 5)
        if st == S.SUBMITTED:
            app.submitted_at = at
        if st == S.OFFERED:
            app.decided_at = at
        if st == S.TUITION_PENDING:
            app.tuition_due = (at + timedelta(days=14)).date()
        uni_side = st in (S.UNIVERSITY_REVIEW, S.OFFERED, S.TUITION_PAID, S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED)
        db.add(ApplicationStatusHistory(application_id=app.id, from_status=prev, to_status=st, actor_org_type="UNIVERSITY" if uni_side else "AGENCY", created_at=at))
        prev = st
    app.created_at = last_at - timedelta(days=len(path) * 5)
    app.updated_at = last_at
    for req in db.query(DocumentRequirement).filter_by(university_id=app.university_id, program_id=None).all():
        if req.degree_level and req.degree_level != prog.degree_level.value:
            continue
        doc = db.query(Document).filter_by(owner_user_id=u.id, category=req.category).first()
        if doc:
            db.add(ApplicationDocument(application_id=app.id, requirement_id=req.id, document_id=doc.id, shared_with_university=True))
    return app


def _backdate(db: Session, case, at: datetime) -> None:
    case.created_at = at
    case.sla_due_at = at + timedelta(hours=svc.SLA_HOURS.get(case.case_type, 48))
    for ev in db.query(svc.ServiceCaseEvent).filter_by(case_id=case.id, kind="CREATED").all():
        ev.created_at = at


def _intake(prog: Program, year: int, term: str):
    return next(i for i in prog.intakes if i.year == year and i.term.value == term)


def seed(db: Session, ctx: dict[str, Any]) -> None:
    storage = ctx["storage"]

    # ------------------------------------------------------------------ vendors + listings (DEMO, no agreements)
    transport = Vendor(name="Seoul Arrival Transfers", kind="airport_transport", service_area=["ICN", "GMP"], languages=["ko", "en", "vi"],
                       price_model="Fixed fare per vehicle, quoted per booking", availability="Every day, flights 06:00–23:00",
                       sla_hours=12, contact={"name": "Dispatch desk", "phone": "+82-2-0000-0000", "kakao": "seoul-arrival"},
                       quality_status="GOOD", agreement=None, notes="Airport pickups from ICN and GMP; fares confirmed per booking.", is_demo=True)
    housing = Vendor(name="Campus Nest Housing", kind="housing_provider", service_area=["Seoul"], languages=["ko", "en"],
                     price_model="Monthly rent + deposit set by each landlord", availability="Weekdays 10:00–18:00",
                     sla_hours=48, contact={"name": "Leasing desk", "email": "housing@example.com"},
                     quality_status="NEW", agreement=None, notes="Studios and shared rooms near campuses in Jongno-gu and Seongbuk-gu.", is_demo=True)
    db.add_all([transport, housing])
    db.flush()
    skku = ctx["unis"]["sungkyunkwan-university"]
    for title, area, rtype, rent, dep, fee, months, mins, util, avail in (
        ("Studio near Hyehwa station", "Jongno-gu, Myeongnyun-dong", "studio", 550000, 5000000, 70000, 12, 12,
         "Gas and electricity billed separately", TODAY + timedelta(days=60)),
        ("Room in a shared house", "Seongbuk-gu, Samseon-dong", "shared", 420000, 1000000, 50000, 6, 20,
         "Internet and water included", TODAY + timedelta(days=90)),
    ):
        db.add(HousingListing(vendor_id=housing.id, university_id=skku.id, title=title, area=area, room_type=rtype, rent_monthly_krw=rent, deposit_krw=dep,
                              management_fee_krw=fee, contract_months_min=months, commute_minutes=mins, furnished=True, utilities=util,
                              available_from=avail, verification_status="DEMO", is_active=True, is_demo=True))

    # ------------------------------------------------------------------ SAMPLE dormitory decision facts
    for d in db.query(Dormitory).all():
        d.application_opens = TODAY - timedelta(days=10)
        d.application_closes = TODAY + timedelta(days=30)
        d.eligibility = "Admitted first-year international students; rooms are allocated within the dormitory's quota."
        d.meal_required = bool(d.meal_plan)
        d.move_in_date = date(2027, 2, 24)
        d.deposit_krw = 200000
        d.required_documents = ["Standard admission letter", "Passport copy", "Health check (chest X-ray) result"]
        d.location = "On campus"

    counselor = ctx["counselors"]["lotus-bridge"][0]

    # ------------------------------------------------------------------ Bảo: dormitory application submitted
    bao = db.query(User).filter_by(email="student.visa@demo.hangyul.kr").one()
    h = db.query(HousingCase).filter_by(student_user_id=bao.id).one()
    dorm = db.get(Dormitory, h.dormitory_id) if h.dormitory_id else None
    c = svc.create_case(db, bao.id, "DORMITORY", details={"dormitory_id": str(dorm.id) if dorm else None, "dormitory": dorm.name if dorm else None},
                        due_at=_kst(TODAY + timedelta(days=30), 23, 59), created_at=NOW - timedelta(days=6), is_demo=True)
    svc.transition(db, c, "APPLIED", actor_id=bao.id, staff=False, note="Applied on the university housing portal", at=NOW - timedelta(days=5))

    # ------------------------------------------------------------------ student.arrival@: visa issued, flight entered, pickup requested
    u, prof = _student(db, "student.arrival@demo.hangyul.kr", "Phạm Gia Huy", "Huy", "VN")
    _education_and_language(db, prof, 8.4, 4)
    a = _assign(db, u, ctx, "lotus-bridge")
    _documents(db, u, prof, a, storage)
    prog = _program(ctx, "sogang-university")
    intake = _intake(prog, 2027, "SPRING")
    app = _application_for(db, u, a, prog, intake, PATH_TO_VISA, NOW - timedelta(days=3))
    vt, why = infer_visa(prog.degree_level)
    db.add(VisaCase(student_user_id=u.id, application_id=app.id, visa_type=vt, visa_type_reason=why, status=VisaStatus.ISSUED,
                    completed_steps=["admission_certificate", "passport", "application_form", "tuition_receipt", "financial_proof", "final_education", "visa_application", "visa_issued"],
                    submitted_on=TODAY - timedelta(days=13), issued_on=TODAY - timedelta(days=3), target_entry_date=intake.semester_start - timedelta(days=10)))
    sdorm = db.query(Dormitory).filter_by(university_id=prog.university_id).first()
    db.add(HousingCase(student_user_id=u.id, university_id=prog.university_id, dormitory_id=sdorm.id if sdorm else None, status=HousingStatus.DORM_CONFIRMED,
                       preference="DORM", budget_monthly_krw=500000, room_preference="Double", completed_items=["compare_options", "submit_dorm_application"],
                       profile={"monthly_budget_krw": 500000, "room": "shared", "move_in_date": "2027-02-24", "stay_months": 12, "furnished": True},
                       move_in={"date": "2027-02-24", "address": f"{sdorm.name if sdorm else 'Dormitory'}, Sogang University", "check_in_method": "Front desk with passport",
                                "deposit_status": "PAID"}))
    db.flush()
    dc = svc.create_case(db, u.id, "DORMITORY", details={"dormitory_id": str(sdorm.id) if sdorm else None, "dormitory": sdorm.name if sdorm else None},
                         created_at=NOW - timedelta(days=20), is_demo=True)
    svc.transition(db, dc, "APPLIED", actor_id=u.id, staff=False, at=NOW - timedelta(days=19))
    svc.transition(db, dc, "ASSIGNED", actor_id=counselor.id, note="Double room assigned", at=NOW - timedelta(days=9))
    svc.transition(db, dc, "CONFIRMED", actor_id=u.id, staff=False, note="Deposit paid to the university", at=NOW - timedelta(days=7))
    svc.set_flight(db, u.id, number="VN408", airport="ICN", scheduled_arrival=_kst(date(2027, 2, 20), 14, 35), terminal="T1")
    svc.request_pickup(db, u.id, {"passengers": 1, "luggage": 2, "destination_kind": "DORM", "destination_address": "Sogang University dormitory",
                                  "special_requests": None, "contact_method": "KAKAOTALK", "contact_handle": "huy.pham"}, actor_id=u.id)
    pick = svc.latest_case(db, u.id, "AIRPORT_PICKUP")
    pick.is_demo = True
    _backdate(db, pick, NOW - timedelta(hours=5))
    plan = db.query(ArrivalPlan).filter_by(student_user_id=u.id).one()
    plan.completed_items = sorted(set(plan.completed_items or []) | {"documents_to_carry"})
    prof.pipeline_stage = PipelineStage.ARRIVAL_PREPARATION
    _conversation(db, u, a, [
        (False, "Your D-2 visa is issued — congratulations, Huy! Next: your flight and airport pickup.", 60),
        (True, "I booked VN408 on 20 February and asked for a pickup.", 5),
    ])
    svc.sync_tasks(db, pick)
    _finish(db, u, prof)

    # ------------------------------------------------------------------ student.arrived@: arrived, enrolled, residence card open
    u, prof = _student(db, "student.arrived@demo.hangyul.kr", "Lê Thảo Vy", "Vy", "VN")
    _education_and_language(db, prof, 8.6, 4)
    a = _assign(db, u, ctx, "lotus-bridge")
    _documents(db, u, prof, a, storage)
    prog = _program(ctx, "korea-university")
    intake = _intake(prog, 2026, "FALL")
    arrived = _kst(date(2026, 8, 24), 15, 40)
    app = _application_for(db, u, a, prog, intake, PATH_TO_VISA, arrived - timedelta(days=20))
    vt, why = infer_visa(prog.degree_level)
    db.add(VisaCase(student_user_id=u.id, application_id=app.id, visa_type=vt, visa_type_reason=why, status=VisaStatus.ISSUED,
                    completed_steps=["admission_certificate", "passport", "application_form", "tuition_receipt", "financial_proof", "final_education", "visa_application", "visa_issued"],
                    submitted_on=date(2026, 7, 20), issued_on=date(2026, 8, 4), expires_on=date(2027, 8, 31), target_entry_date=date(2026, 8, 24)))
    kdorm = db.query(Dormitory).filter_by(university_id=prog.university_id).first()
    db.add(HousingCase(student_user_id=u.id, university_id=prog.university_id, dormitory_id=kdorm.id if kdorm else None, status=HousingStatus.DORM_CONFIRMED,
                       preference="DORM", completed_items=["compare_options", "submit_dorm_application", "pay_deposit", "confirm_move_in"],
                       move_in={"date": "2026-08-24", "address": f"{kdorm.name if kdorm else 'Dormitory'}, Korea University",
                                "check_in_method": "Front desk with passport", "deposit_status": "PAID",
                                "checklist_done": ["keys_or_code", "room_photos", "deposit_receipt"]}))
    db.flush()
    dc = svc.create_case(db, u.id, "DORMITORY", details={"dormitory_id": str(kdorm.id) if kdorm else None, "dormitory": kdorm.name if kdorm else None},
                         created_at=arrived - timedelta(days=60), is_demo=True)
    for st, who, days in (("APPLIED", u.id, 59), ("ASSIGNED", counselor.id, 40), ("CONFIRMED", u.id, 35)):
        svc.transition(db, dc, st, actor_id=who, staff=who != u.id, at=arrived - timedelta(days=days))
    svc.set_flight(db, u.id, number="VN416", airport="ICN", scheduled_arrival=arrived - timedelta(hours=1), terminal="T1")
    pick = svc.request_pickup(db, u.id, {"passengers": 1, "luggage": 2, "destination_kind": "DORM", "destination_address": "Korea University dormitory",
                                         "special_requests": None, "contact_method": "WHATSAPP", "contact_handle": "+84 000 000 000"}, actor_id=u.id)
    pick.is_demo = True
    _backdate(db, pick, arrived - timedelta(days=14))
    svc.transition(db, pick, "CONFIRMED", actor_id=counselor.id, at=arrived - timedelta(days=13, hours=20))
    pick.vendor_id = transport.id
    pick.details = {**(pick.details or {}), "driver": {"name": "Kim Min-seok", "phone": "+82-10-0000-0000", "vehicle": "Grey van"},
                    "meeting_point": "Arrival hall, Terminal 1, exit 6"}
    pick.cost_amount, pick.cost_currency, pick.cost_payer = None, "KRW", "included"
    svc.transition(db, pick, "DRIVER_ASSIGNED", actor_id=counselor.id, at=arrived - timedelta(days=2))
    dc_move = arrived + timedelta(hours=2)
    svc.transition(db, pick, "PICKED_UP", actor_id=counselor.id, at=arrived)  # records arrival → residence-card case opens
    svc.transition(db, pick, "COMPLETED", actor_id=counselor.id, note="Met at exit 6, dropped at the dormitory front desk", at=dc_move)
    pick.feedback_ok, pick.feedback_comment, pick.feedback_at = True, "The driver was on time.", dc_move + timedelta(days=1)
    svc.transition(db, dc, "MOVED_IN", actor_id=u.id, staff=False, at=dc_move)
    plan = db.query(ArrivalPlan).filter_by(student_user_id=u.id).one()
    plan.completed_items = sorted(set(plan.completed_items or []) | {"documents_to_carry", "sim_esim", "orientation", "emergency_info", "transport_card"})
    rc = svc.latest_case(db, u.id, "RESIDENCE_CARD")
    rc.is_demo = True
    for c in db.query(svc.ServiceCase).filter_by(student_user_id=u.id).all():
        c.is_demo = True
    db.add(StudentEnrollment(student_user_id=u.id, university_id=prog.university_id, program_id=prog.id, application_id=app.id, agency_org_id=a.organization_id,
                             cohort_label="2026-FALL", nationality="VN", status=EnrollmentStatus.ENROLLED, enrolled_on=intake.semester_start,
                             expected_graduation=intake.semester_start + timedelta(days=365 * 4), visa_expires_on=date(2027, 8, 31), is_demo=True))
    app.status = S.ENROLLED
    db.add(ApplicationStatusHistory(application_id=app.id, from_status=S.VISA_ISSUED, to_status=S.ENROLLED, actor_org_type="UNIVERSITY",
                                    created_at=_kst(intake.semester_start, 9)))
    prof.pipeline_stage = PipelineStage.ACTIVE_STUDENT
    _conversation(db, u, a, [
        (False, "Welcome to Seoul, Vy! Your next step is the residence card — you have until 22 November.", 24 * 30),
        (True, "Thank you! Does the university register us as a group?", 24 * 29),
        (False, "Not confirmed for this semester — please book your own HiKorea visit. Hangyul Univ shows the steps.", 24 * 29 - 2),
    ])
    _finish(db, u, prof)
    db.flush()
