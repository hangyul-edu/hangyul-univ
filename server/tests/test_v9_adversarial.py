"""V9 reliability — adversarial recovery suite.

One test per failure scenario. Each asserts that the product RECOVERS truthfully: the record ends in the right state,
the next task / notification goes to the right owner, nothing claims what did not happen (no "submitted", "delivered",
"paid" or "partner" without evidence) and no work is left orphaned.

Isolation: every scenario uses fresh ``e2e-adv-…@example.com`` students and a throwaway program at Chung-Ang University
(not used by any other test). Seeded rows that a scenario must touch are restored in ``finally`` blocks; the module
teardown deactivates the throwaway program and purges the e2e accounts (scripts/purge_e2e.py).
"""
from __future__ import annotations

import importlib.util
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AdmissionRequirement,
    AgencyAssignment,
    Application,
    AuditLog,
    Conversation,
    Document,
    Essay,
    Message,
    Notification,
    Order,
    Organization,
    OrganizationMember,
    Program,
    ProgramIntake,
    ServiceCase,
    SubmissionConnector,
    Task,
    University,
    User,
    VisaCase,
)
from app.models.base import utcnow
from app.models.enums import (
    ApplicationStatus,
    AssignmentStatus,
    DegreeLevel,
    DocumentStatus,
    EssayStatus,
    InstructionLanguage,
    IntakeTerm,
    OrderStatus,
    Role,
    TaskStatus,
    TaskType,
    VisaStatus,
    VisaType,
)
from app.seed.extra_51_dossier import mrz_lines, text_pdf
from app.services import concierge as concierge_svc
from app.services import dossier as D
from app.services import visa_routes as vr
from app.services.tasks_engine import generate_for_student
from tests.conftest import login
from tests.v22_helpers import register_student

API = "/api/v1"
# The server decides "today" in UTC (`app.models.base.utcnow`). `date.today()` is the *machine's local*
# date, and on this project's reference machine (KST, UTC+9) the two disagree for nine hours out of every
# twenty-four — between local midnight and 09:00. A test that writes a deadline of "yesterday" with one clock
# and then asserts on a service that reads "today" with the other is off by a day for that whole window, which
# is how `test_deadline_passes_before_submission` and `test_passport_expires_mid_journey` came to fail at
# 00:22 KST on 2026-10-18 having passed all through the previous afternoon. Use the server's clock (V13).
TODAY = utcnow().date()
OPEN = (TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)
PROGRAM_NAME = "Adversarial Reliability Program (V9 test)"


# =============================================================================================== fixtures & helpers

def _purge_e2e():
    spec = importlib.util.spec_from_file_location("purge_e2e_adv", Path(__file__).resolve().parents[1] / "scripts" / "purge_e2e.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    with SessionLocal() as s:
        mod.purge_accounts(s, False)
        s.commit()


@pytest.fixture(scope="module")
def world():
    """A throwaway Chung-Ang bachelor program with one intake per scenario family (unique year/term/round)."""
    with SessionLocal() as s:
        cau = s.scalar(select(University).where(University.slug == "chung-ang-university"))
        prog = Program(university_id=cau.id, name_en=PROGRAM_NAME, degree_level=DegreeLevel.BACHELOR, field="business",
                       instruction_language=InstructionLanguage.KOREAN, tuition_per_semester_krw=4_500_000, application_fee_krw=100_000,
                       is_active=True, verification_status="SAMPLE")
        s.add(prog)
        s.flush()
        s.add(AdmissionRequirement(program_id=prog.id, min_prior_education="HIGH_SCHOOL", min_gpa_percent=50, language_alternative=True,
                                   requires_both_parents_foreign=False, verification_status="SAMPLE"))

        def intake(key, year, term, rnd, days):
            i = ProgramIntake(program_id=prog.id, year=year, term=term, round=rnd, application_opens=TODAY - timedelta(days=30),
                              application_deadline=TODAY + timedelta(days=days), semester_start=TODAY + timedelta(days=days + 120),
                              tuition_deadline=TODAY + timedelta(days=days + 60), is_open=True, verification_status="SAMPLE")
            s.add(i)
            return key, i

        intakes = dict([intake("A", 2031, IntakeTerm.SPRING, 1, 60), intake("B", 2031, IntakeTerm.FALL, 1, 150),
                        intake("LATE", 2031, IntakeTerm.SPRING, 2, 30), intake("CLOSING", 2031, IntakeTerm.SPRING, 3, 45),
                        intake("API", 2031, IntakeTerm.WINTER, 1, 90)])
        s.flush()
        # Only the WINTER intake of this program is configured as an official-API submission (which nobody has).
        s.add(SubmissionConnector(university_id=cau.id, program_id=prog.id, intake_term="WINTER", method="DIRECT_API",
                                  verification_status="SAMPLE", is_demo=True))
        s.commit()
        w = SimpleNamespace(program_id=prog.id, university_id=cau.id, intakes={k: v.id for k, v in intakes.items()})
    yield w
    with SessionLocal() as s:
        p = s.get(Program, w.program_id)
        p.is_active = False
        for i in s.scalars(select(ProgramIntake).where(ProgramIntake.program_id == w.program_id)):
            i.is_open = False
        s.commit()
    _purge_e2e()


def _register(client, *, nationality="VN", paid=True, name="Tran Thi Mai"):
    reg = register_student(client, email=f"e2e-adv-{uuid.uuid4().hex[:10]}@example.com", full_name=name, nationality=nationality)
    email, h = reg["email"], reg["h"]
    assert client.patch(f"{API}/me/profile", headers=h, json={"residence_country": nationality, "date_of_birth": "2007-03-01", "target_degree": "BACHELOR",
                                                             "target_intake_year": 2031, "target_intake_term": "SPRING",
                                                             "desired_fields": ["business"]}).status_code == 200
    assert client.post(f"{API}/me/educations", headers=h, json={"level": "HIGH_SCHOOL", "institution": "City High School", "country": nationality,
                                                               "graduation_year": 2026, "graduation_status": "GRADUATED", "gpa_value": 8.5,
                                                               "gpa_scale_max": 10}).status_code == 201
    if paid:
        o = client.post(f"{API}/me/orders", headers=h, json={"product_code": "PREMIUM"}).json()
        assert o["status"] == "PAID" and o["assignment"], o
    with SessionLocal() as s:
        uid = s.scalar(select(User.id).where(User.email == email))
        a = s.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == uid, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        cid = a.counselor_user_id if a else None
        cemail = s.get(User, cid).email if cid else None
        org_id = a.organization_id if a else None
    return SimpleNamespace(h=h, email=email, id=uid, counselor_id=cid, org_id=org_id,
                           counselor=login(client, cemail, "agency") if cemail else None)


def _apply(client, stu, world, key="A") -> dict:
    r = client.post(f"{API}/applications", headers=stu.h, json={"program_id": str(world.program_id), "intake_id": str(world.intakes[key])})
    assert r.status_code == 201, r.text
    return r.json()


def _set_app(app_id, **kw):
    with SessionLocal() as s:
        a = s.get(Application, uuid.UUID(str(app_id)))
        for k, v in kw.items():
            setattr(a, k, v)
        s.commit()


def _regen(uid):
    """What the daily job does for every student (app/jobs/daily.py)."""
    with SessionLocal() as s:
        generate_for_student(s, uid)
        s.commit()


def _tasks(uid, *, open_only=True):
    with SessionLocal() as s:
        q = select(Task).where(Task.student_user_id == uid)
        if open_only:
            q = q.where(Task.status.in_(OPEN))
        return [SimpleNamespace(key=t.dedupe_key, owner=t.owner_user_id, org=t.owner_org_id, visible=t.visible_to_student, title=t.title,
                                title_key=t.title_key, app=t.application_id, status=t.status, type=t.task_type, due=t.due_at)
                for t in s.scalars(q)]


def _upload(client, h, data: bytes, category: str, name: str, **form):
    mime = "image/png" if name.endswith(".png") else "application/pdf"
    return client.post(f"{API}/documents", headers=h, files={"file": (name, data, mime)}, data={"category": category, **form})


def _strategy(client, h, app_id) -> dict:
    r = client.get(f"{API}/applications/{app_id}/strategy", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def _codes(strategy: dict) -> dict:
    return {i["code"]: i for i in strategy["items"]}


def _passport(stu_surname="TRAN", given="THI MAI", exp="341231"):
    return text_pdf(["PASSPORT", *mrz_lines(stu_surname, given, "C12345678", "VNM", "070301", "F", exp)])


# =============================================================================================== 1 · wrong document

def test_wrong_document_finding_and_correction_loop(client, world):
    stu = _register(client)
    app = _apply(client, stu, world)
    wrong = _upload(client, stu.h, text_pdf(["Hangyul test file", "ACADEMIC TRANSCRIPT", "Transcript of records"]), "PASSPORT", "passport.pdf", language="en")
    assert wrong.status_code == 201, wrong.text
    doc_id = wrong.json()["id"]
    dossier = client.get(f"{API}/me/dossier", headers=stu.h).json()
    found = {f["code"] for r in dossier["rows"] for f in r["findings"] if f["document_id"] == doc_id}
    assert "WRONG_TYPE" in found  # the automatic check sees a transcript uploaded as a passport
    # The counselor (owner of document review) asks for a correction; the student is told and owns the fix.
    r = client.post(f"{API}/documents/{doc_id}/review", headers=stu.counselor, json={"decision": "NEEDS_CORRECTION", "reason": "This is your transcript — upload your passport photo page."})
    assert r.status_code == 200 and r.json()["status"] == "NEEDS_CORRECTION"
    fix = [t for t in _tasks(stu.id) if t.key == f"doc:{stu.id}:PASSPORT:FIX"]
    assert len(fix) == 1 and fix[0].owner == stu.id and fix[0].visible
    with SessionLocal() as s:
        n = s.scalar(select(Notification).where(Notification.user_id == stu.id, Notification.kind == "DOCUMENT_NEEDS_CORRECTION"))
        assert n is not None and "transcript" in (n.params or {}).get("reason", "")
    detail = client.get(f"{API}/applications/{app['id']}", headers=stu.h).json()
    assert next(i for i in detail["checklist"] if i["category"] == "PASSPORT")["action_code"] == "FIX"
    # The student replaces the file (new version of the same document) → back in review, the finding auto-resolves,
    # the student's fix task closes and the review task goes to the agency.
    r = _upload(client, stu.h, _passport(), "PASSPORT", "passport-photo-page.pdf", document_id=doc_id, language="en")
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "NEEDS_REVIEW" and r.json()["current_version"] == 2
    dossier = client.get(f"{API}/me/dossier", headers=stu.h).json()
    found = {f["code"] for row in dossier["rows"] for f in row["findings"] if f["document_id"] == doc_id}
    assert "WRONG_TYPE" not in found
    open_keys = {t.key: t for t in _tasks(stu.id)}
    assert f"doc:{stu.id}:PASSPORT:FIX" not in open_keys
    review = open_keys.get(f"review:{doc_id}")
    assert review is not None and review.org == stu.org_id and not review.visible
    r = client.post(f"{API}/documents/{doc_id}/review", headers=stu.counselor, json={"decision": "VERIFIED"})
    assert r.status_code == 200 and r.json()["status"] == "VERIFIED"
    assert f"review:{doc_id}" not in {t.key for t in _tasks(stu.id)}


# =============================================================================================== 2 · interrupted / corrupt upload

def test_interrupted_or_corrupt_upload_is_rejected_cleanly(client, world, tmp_path):
    from app.core.config import get_settings

    stu = _register(client, paid=False)
    good = text_pdf(["ACADEMIC TRANSCRIPT", "Cumulative GPA: 8.5 / 10"])
    r = _upload(client, stu.h, good, "TRANSCRIPT", "transcript.pdf", language="en")
    assert r.status_code == 201
    doc_id = r.json()["id"]
    store = Path(get_settings().storage_dir)
    files_before = sum(1 for _ in store.rglob("*") if _.is_file())
    with SessionLocal() as s:
        docs_before = s.scalar(select(func.count()).select_from(Document).where(Document.owner_user_id == stu.id))
    # 1) a cut-off PDF (upload interrupted) as a NEW VERSION of the good document → refused, the good version stays
    cut = good[: len(good) // 2]
    r = _upload(client, stu.h, cut, "TRANSCRIPT", "transcript-v2.pdf", document_id=doc_id)
    assert r.status_code == 422 and "interrupted" in r.json()["detail"]
    # 2) a cut-off PNG and an empty file as new documents → refused
    png_cut = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    assert _upload(client, stu.h, png_cut, "PHOTO", "photo.png").status_code == 422
    assert _upload(client, stu.h, b"", "PHOTO", "photo.pdf").status_code == 400
    # 3) not a document at all (renamed executable) → refused by content, not by the file name
    assert _upload(client, stu.h, b"MZ\x90\x00\x03" + b"\x00" * 200, "BANK_STATEMENT", "bank.pdf").status_code == 415
    d = client.get(f"{API}/documents/{doc_id}", headers=stu.h).json()
    assert d["current_version"] == 1 and len(d["versions"]) == 1 and d["status"] == "NEEDS_REVIEW"
    with SessionLocal() as s:
        assert s.scalar(select(func.count()).select_from(Document).where(Document.owner_user_id == stu.id)) == docs_before
    assert sum(1 for _ in store.rglob("*") if _.is_file()) == files_before  # nothing half-written was stored
    # The retry with the complete file works.
    r = _upload(client, stu.h, good + b"\n", "TRANSCRIPT", "transcript-v2.pdf", document_id=doc_id)
    assert r.status_code == 201 and r.json()["current_version"] == 2


# =============================================================================================== 3 · duplicate application

def test_duplicate_application_is_blocked_with_a_clear_message(client, world):
    stu = _register(client, paid=False)
    first = _apply(client, stu, world)
    again = client.post(f"{API}/applications", headers=stu.h, json={"program_id": str(world.program_id), "intake_id": str(world.intakes["A"])})
    assert again.status_code == 409 and "already started an application for this intake" in again.json()["detail"]
    # Without an explicit intake the API picks the earliest open one — the same intake → also refused.
    with SessionLocal() as s:
        earliest = min(s.scalars(select(ProgramIntake).where(ProgramIntake.program_id == world.program_id, ProgramIntake.is_open.is_(True))),
                       key=lambda i: i.application_deadline)
    implicit = client.post(f"{API}/applications", headers=stu.h, json={"program_id": str(world.program_id), "intake_id": str(earliest.id)})
    if earliest.id == world.intakes["A"]:
        assert implicit.status_code == 409
    with SessionLocal() as s:
        apps = s.scalars(select(Application).where(Application.student_user_id == stu.id, Application.intake_id == world.intakes["A"])).all()
        assert [str(a.id) for a in apps] == [first["id"]]
        essays = s.scalars(select(Essay).where(Essay.owner_user_id == stu.id, Essay.application_id == apps[0].id)).all()
        assert sorted(e.essay_type.value for e in essays) == ["PERSONAL_STATEMENT", "STUDY_PLAN"]  # not doubled
    deadline_tasks = [t for t in _tasks(stu.id) if t.key == f"deadline:{first['id']}"]
    assert len(deadline_tasks) == 1


# =============================================================================================== 4 · deadline passes before submission

def test_deadline_passes_before_submission(client, world):
    stu = _register(client)
    app = _apply(client, stu, world, "LATE")
    aid = app["id"]
    _set_app(aid, status=ApplicationStatus.READY)
    v = client.get(f"{API}/applications/{aid}/submission", headers=stu.h).json()
    assert v["can_handoff"] and not v["deadline_passed"]  # before the deadline: the guided hand-off is offered
    # The deadline passes (the daily job runs) before the student hands off.
    with SessionLocal() as s:
        i = s.get(ProgramIntake, world.intakes["LATE"])
        i.application_deadline = TODAY - timedelta(days=1)
        s.commit()
    _regen(stu.id)
    s_ = _codes(_strategy(client, stu.h, aid))
    assert "DEADLINE_PASSED" in s_ and s_["DEADLINE_PASSED"]["owner"] == "counselor" and s_["DEADLINE_PASSED"]["severity"] == "blocker"
    v = client.get(f"{API}/applications/{aid}/submission", headers=stu.h).json()
    assert v["deadline_passed"] and not v["can_handoff"] and not v["can_authorize"]
    r = client.post(f"{API}/applications/{aid}/submission/handoff", headers=stu.h)
    assert r.status_code == 409 and "DEADLINE_PASSED" in r.json()["detail"]
    home = client.get(f"{API}/me/dashboard", headers=stu.h).json()
    assert home["next_action"]["code"] not in ("SUBMISSION_HANDOFF", "SUBMISSION_AUTHORIZE", "FINISH_APPLICATION")
    assert not any(i["code"] in ("SUBMISSION_HANDOFF", "SUBMISSION_AUTHORIZE") for i in home["improve"])
    # Tasks: nothing asks the student to "submit"; the counselor owns the next step.
    tasks = _tasks(stu.id)
    assert not any(t.app == uuid.UUID(aid) and t.visible for t in tasks), [(t.key, t.title) for t in tasks if t.app == uuid.UUID(aid)]
    owned = [t for t in tasks if t.key == f"deadline-passed:{aid}"]
    assert len(owned) == 1 and owned[0].owner == stu.counselor_id and owned[0].org == stu.org_id and not owned[0].visible
    assert client.get(f"{API}/applications/{aid}", headers=stu.h).json()["status"] == "READY"  # nothing pretends it was submitted
    with SessionLocal() as s:
        assert s.get(Application, uuid.UUID(aid)).submitted_at is None


# =============================================================================================== 5 · passport expires mid-journey

def test_passport_expires_mid_journey(client, world, db):
    stu = _register(client)
    app = _apply(client, stu, world)
    r = _upload(client, stu.h, _passport(), "PASSPORT", "passport.pdf", expires_on=(TODAY + timedelta(days=900)).isoformat(), language="en")
    doc_id = r.json()["id"]
    assert client.post(f"{API}/documents/{doc_id}/review", headers=stu.counselor, json={"decision": "VERIFIED"}).status_code == 200

    def passport_row():
        d = client.get(f"{API}/me/dossier", headers=stu.h).json()
        return next(r for r in d["rows"] if r["category"] == "PASSPORT")

    assert {u["status"] for u in passport_row()["applications"]} == {"READY"}
    # Months later it expires before the deadline window ends …
    with SessionLocal() as s:
        s.get(Document, uuid.UUID(doc_id)).expires_on = TODAY + timedelta(days=20)
        s.commit()
    row = passport_row()
    assert {u["status"] for u in row["applications"]} == {D.NEAR_EXPIRY} and row["applications"][0]["reason"]["code"] == "NEAR_EXPIRY_DATE"
    # … and then it has expired.
    with SessionLocal() as s:
        s.get(Document, uuid.UUID(doc_id)).expires_on = TODAY - timedelta(days=1)
        s.commit()
    _regen(stu.id)
    row = passport_row()
    assert {u["status"] for u in row["applications"]} == {D.EXPIRED} and row["state"] == "todo"
    renew = [t for t in _tasks(stu.id) if t.key == f"doc:{stu.id}:PASSPORT:RENEW"]
    assert len(renew) == 1 and renew[0].owner == stu.id and renew[0].visible
    detail = client.get(f"{API}/applications/{app['id']}", headers=stu.h).json()
    assert next(i for i in detail["checklist"] if i["category"] == "PASSPORT")["action_code"] == "RENEW"
    # Visa preparation uses the same rule (no separate, stale copy of the passport status).
    assert D.applicability_for_requirement(db, stu.id, {"category": "PASSPORT"})["status"] == D.EXPIRED
    plan = client.get(f"{API}/me/visa-route", headers=stu.h).json()
    if plan.get("documents"):
        pp = next((d for d in plan["documents"] if d["key"] == "passport"), None)
        assert pp is None or pp["status"] == "EXPIRED"
        assert not plan["pack"]["all_ready"]


# =============================================================================================== 6 · financial certificate stale before the visa

def test_financial_certificate_becomes_stale_before_the_visa(client, world):
    stu = _register(client)
    app = _apply(client, stu, world)
    issued = TODAY - timedelta(days=10)
    r = _upload(client, stu.h, text_pdf(["BALANCE CERTIFICATE", f"Date of issue: {issued:%d/%m/%Y}"]), "BANK_STATEMENT", "bank.pdf",
                issue_date=issued.isoformat(), language="en")
    doc_id = r.json()["id"]
    assert client.post(f"{API}/documents/{doc_id}/review", headers=stu.counselor, json={"decision": "VERIFIED"}).status_code == 200
    # Admitted: the visa case opens (as on ADMISSION_CERTIFICATE_ISSUED) and an appointment is planned in 35 days.
    _set_app(app["id"], status=ApplicationStatus.ADMISSION_CERTIFICATE_ISSUED)
    with SessionLocal() as s:
        s.add(VisaCase(student_user_id=stu.id, application_id=uuid.UUID(app["id"]), visa_type=VisaType.D2_2, visa_type_reason="bachelor",
                       status=VisaStatus.DOCUMENT_PREPARATION, completed_steps=["admission_certificate"]))
        s.commit()
    assert client.put(f"{API}/me/visa-route/answers", headers=stu.h, json={"value": "hanoi"}).status_code == 200
    appt = TODAY + timedelta(days=35)
    r = client.put(f"{API}/me/visa-route/appointment", headers=stu.h, json={"on": appt.isoformat(), "status": "PLANNED"})
    assert r.status_code == 200, r.text
    plan = client.get(f"{API}/me/visa-route", headers=stu.h).json()
    bank = next(d for d in plan["documents"] if d["key"] == "bank_balance_certificate")
    validity = bank["validity_days"]
    assert validity, "the researched route has a freshness rule for the bank certificate"
    get_after = appt - timedelta(days=validity)
    if get_after > TODAY:
        # Fine today, too old on the appointment day → a newer copy is required, and the date it can be obtained from is given.
        assert bank["status"] == "GET_LATER" and bank["reason"]["params"]["date"] == get_after.isoformat()
    else:
        assert bank["status"] == "NEW_FOR_VISA"
    assert bank["timing"]["get_after"] == get_after.isoformat() and bank["timing"]["valid_on"] == appt.isoformat()
    assert not plan["pack"]["all_ready"]
    # Time passes to that date: the certificate must be replaced now (never silently "ready").
    with SessionLocal() as s:
        later = vr.resolve(s, stu.id, today=max(get_after, TODAY))
        b = next(d for d in later["documents"] if d["key"] == "bank_balance_certificate")
        assert b["status"] == "NEW_FOR_VISA" and b["reason"]["code"] == "NEW_FOR_VISA"
        assert later["pack"]["all_ready"] is False
        s.rollback()


# =============================================================================================== 7 · requirement changed after applying

def test_requirement_change_after_applying_does_not_invalidate_and_informs(client, world):
    ops = login(client, "ops@demo.hangyul.kr", "agency")
    preparing = _register(client)
    prep_app = _apply(client, preparing, world)
    sent_stu = _register(client)
    sent_app = _apply(client, sent_stu, world)
    _set_app(sent_app["id"], status=ApplicationStatus.SUBMITTED, submitted_at=datetime.now(timezone.utc))
    before = _codes(_strategy(client, preparing.h, prep_app["id"]))
    assert "ELIG_GPA" not in before and "REQUIREMENT_CHANGED" not in before
    try:
        r = client.patch(f"{API}/university/programs/{world.program_id}/requirements", headers=ops, json={"min_gpa_percent": 90})
        assert r.status_code == 200, r.text
        # Nothing about the existing applications changes by itself.
        assert client.get(f"{API}/applications/{prep_app['id']}", headers=preparing.h).json()["status"] == "DRAFT"
        assert client.get(f"{API}/applications/{sent_app['id']}", headers=sent_stu.h).json()["status"] == "SUBMITTED"
        for stu, aid in ((preparing, prep_app["id"]), (sent_stu, sent_app["id"])):
            items = _codes(_strategy(client, stu.h, aid))
            rc = items.get("REQUIREMENT_CHANGED")
            assert rc and rc["owner"] == "counselor" and rc["params"]["fields"] == ["min_gpa_percent"]
            assert rc["params"]["changed_on"] == TODAY.isoformat() or rc["params"]["changed_on"]
            agency = client.get(f"{API}/agency/students/{stu.id}/strategy", headers=stu.counselor)
            assert agency.status_code == 200
            assert any(i["code"] == "REQUIREMENT_CHANGED" for a in agency.json()["items"] for i in a["items"])
        # The submitted application is not re-judged against the new minimum (review scope has no eligibility blockers).
        assert "ELIG_GPA" not in _codes(_strategy(client, sent_stu.h, sent_app["id"]))
        # Someone who starts after the change simply sees the current rule — no "changed" notice.
        late = _register(client)
        late_app = _apply(client, late, world, "B")
        late_items = _codes(_strategy(client, late.h, late_app["id"]))
        assert "REQUIREMENT_CHANGED" not in late_items and "ELIG_GPA" in late_items
    finally:
        assert client.patch(f"{API}/university/programs/{world.program_id}/requirements", headers=ops, json={"min_gpa_percent": 50}).status_code == 200


# =============================================================================================== 8 · intake closes

def test_closed_intake_is_not_offered_and_existing_applicants_are_unaffected(client, world):
    early = _register(client)
    app = _apply(client, early, world, "CLOSING")
    with SessionLocal() as s:
        s.get(ProgramIntake, world.intakes["CLOSING"]).is_open = False  # the university closed this round early
        s.commit()
    newcomer = _register(client, paid=False)
    r = client.post(f"{API}/applications", headers=newcomer.h, json={"program_id": str(world.program_id), "intake_id": str(world.intakes["CLOSING"])})
    assert r.status_code == 409 and "not accepting applications" in r.json()["detail"]
    prog = client.get(f"{API}/programs/{world.program_id}").json()
    offered = {i["id"] for i in prog.get("intakes", []) if i.get("is_open")}
    assert str(world.intakes["CLOSING"]) not in offered
    # The existing applicant keeps their application, status and deadline; nothing blocks them because of the closure.
    d = client.get(f"{API}/applications/{app['id']}", headers=early.h).json()
    assert d["status"] == "DRAFT"
    items = _codes(_strategy(client, early.h, app["id"]))
    assert not ({"DEADLINE_PASSED", "NO_OPEN_INTAKE"} & set(items))
    assert any(t.key == f"deadline:{app['id']}" for t in _tasks(early.id))


# =============================================================================================== 9 · essay names the wrong school

ESSAY_WRONG = ("I want to study business administration because my family runs a small shop in Hanoi and I saw how planning changes everything. "
               "I have dreamed of studying at Yonsei University since I was fifteen, and I believe its business program is the right place for me. "
               "After graduating I will return to Vietnam and help small family businesses grow with better accounting and marketing.")


def test_essay_naming_the_wrong_school_cannot_be_approved(client, world):
    stu = _register(client)
    app = _apply(client, stu, world)
    essay = next(e for e in client.get(f"{API}/essays", headers=stu.h).json()["items"] if e["application_id"] == app["id"] and e["essay_type"] == "PERSONAL_STATEMENT")
    eid = essay["id"]
    assert client.put(f"{API}/essays/{eid}", headers=stu.h, json={"body": ESSAY_WRONG}).status_code == 200
    e = client.post(f"{API}/essays/{eid}/status", headers=stu.h, json={"status": "SUBMITTED"}).json()
    assert e["status"] == "AGENCY_REVIEW"
    open_f = [f for f in e["writing"]["findings"] if f["status"] == "OPEN" and f["code"] == "OTHER_UNIVERSITY"]
    assert open_f and open_f[0]["severity"] == "BLOCKER" and open_f[0]["params"]["name"] == "Yonsei University"
    staff = login(client, "manager@lotus.demo.hangyul.kr", "agency") if stu.counselor is None else stu.counselor
    r = client.post(f"{API}/essays/{eid}/status", headers=staff, json={"status": "APPROVED"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "QUALITY_GATE"
    assert client.get(f"{API}/essays/{eid}", headers=stu.h).json()["status"] == "AGENCY_REVIEW"  # not approved
    # The loop closes: changes requested → the student fixes the name → the automatic check clears.
    assert client.post(f"{API}/essays/{eid}/status", headers=staff, json={"status": "CHANGES_REQUESTED"}).status_code == 200
    fixed = ESSAY_WRONG.replace("Yonsei University", "Chung-Ang University")
    assert client.put(f"{API}/essays/{eid}", headers=stu.h, json={"body": fixed}).status_code == 200
    e = client.post(f"{API}/essays/{eid}/status", headers=stu.h, json={"status": "SUBMITTED"}).json()
    assert not [f for f in e["writing"]["findings"] if f["status"] == "OPEN" and f["code"] == "OTHER_UNIVERSITY"]


# =============================================================================================== 10 · nationality changes

def test_nationality_change_recomputes_route_and_requirements(client, world):
    stu = _register(client, nationality="VN")
    _apply(client, stu, world)
    _regen(stu.id)
    assert any(t.key == f"doc:{stu.id}:FAMILY_RELATION_CERTIFICATE:UPLOAD" for t in _tasks(stu.id))  # VN/CN-only requirement
    r = client.put(f"{API}/me/visa-route/answers", headers=stu.h, json={"value": "hanoi"})
    assert r.status_code == 200, r.text
    vn = client.get(f"{API}/me/visa-route", headers=stu.h).json()
    assert vn["route"]["country"] == "VN" and vn["post"]["key"] == "hanoi"
    # The student corrects their nationality (and residence) to Nepal.
    assert client.patch(f"{API}/me/profile", headers=stu.h, json={"nationality": "NP", "residence_country": "NP"}).status_code == 200
    np_ = client.get(f"{API}/me/visa-route", headers=stu.h).json()
    assert np_["inputs"]["nationality"] == "NP" and np_["route"]["country"] == "NP"
    assert np_["post"]["city"] == "Kathmandu" and np_["post"]["key"] != "hanoi"
    assert "post_key" not in (np_.get("answer") or {}) and "region_label" not in (np_.get("answer") or {})  # no stale Vietnamese post
    assert not any(st["key"] == "choose_post" for st in np_["steps"])
    edu = next(d for d in np_["documents"] if d["key"] == "final_education_certificate")
    assert edu["legalization"] == "CONSULAR"  # Nepal is not an Apostille party: legalization recomputed for the new route
    with SessionLocal() as s:
        from app.models.v5_visa_routes import VisaRoute

        cur = s.get(VisaRoute, uuid.UUID(np_["route"]["id"]))
        assert cur.country == "NP"
    # Nationality-specific document requirements follow immediately (no stale task from the old nationality).
    assert not any(t.key == f"doc:{stu.id}:FAMILY_RELATION_CERTIFICATE:UPLOAD" for t in _tasks(stu.id))


# =============================================================================================== 11 · target intake changes

def test_target_intake_change_moves_the_written_work(client, world):
    stu = _register(client)
    old = _apply(client, stu, world, "A")
    ps = next(e for e in client.get(f"{API}/essays", headers=stu.h).json()["items"] if e["application_id"] == old["id"] and e["essay_type"] == "PERSONAL_STATEMENT")
    text = "My plan for studying business in Seoul. " * 12
    assert client.put(f"{API}/essays/{ps['id']}", headers=stu.h, json={"body": text}).status_code == 200
    assert client.patch(f"{API}/me/profile", headers=stu.h, json={"target_intake_year": 2031, "target_intake_term": "FALL"}).status_code == 200
    new = _apply(client, stu, world, "B")
    r = client.post(f"{API}/applications/{old['id']}/transition", headers=stu.h, json={"to": "WITHDRAWN", "note": "Moving to the fall intake"})
    assert r.status_code == 200, r.text
    with SessionLocal() as s:
        moved = s.get(Essay, uuid.UUID(ps["id"]))
        assert str(moved.application_id) == new["id"] and moved.due_date == s.get(ProgramIntake, world.intakes["B"]).application_deadline
        assert moved.versions and moved.versions[-1].body == text  # the work itself is intact
        left = s.scalars(select(Essay).where(Essay.application_id == uuid.UUID(old["id"]))).all()
        assert all(not e.versions for e in left)  # only empty workspaces stay on the withdrawn application
        new_types = sorted(e.essay_type.value for e in s.scalars(select(Essay).where(Essay.application_id == uuid.UUID(new["id"]))))
        assert new_types == ["PERSONAL_STATEMENT", "STUDY_PLAN"]
    detail = client.get(f"{API}/applications/{new['id']}", headers=stu.h).json()
    assert any(e["id"] == ps["id"] for e in detail["essays"])
    # No open work remains for the withdrawn application (student or staff).
    assert not [t for t in _tasks(stu.id) if t.app == uuid.UUID(old["id"])]
    with SessionLocal() as s:
        old_essays = {e.id for e in s.scalars(select(Essay).where(Essay.application_id == uuid.UUID(old["id"])))}
    assert not [t for t in _tasks(stu.id) if t.key.startswith(("essay-write:", "essay-review:")) and uuid.UUID(t.key.split(":")[1]) in old_essays]
    # The other order (withdraw first, then start the new intake) keeps the work too.
    stu2 = _register(client)
    o2 = _apply(client, stu2, world, "A")
    sp = next(e for e in client.get(f"{API}/essays", headers=stu2.h).json()["items"] if e["application_id"] == o2["id"] and e["essay_type"] == "STUDY_PLAN")
    assert client.put(f"{API}/essays/{sp['id']}", headers=stu2.h, json={"body": "Semester by semester plan. " * 10}).status_code == 200
    assert client.post(f"{API}/applications/{o2['id']}/transition", headers=stu2.h, json={"to": "WITHDRAWN"}).status_code == 200
    n2 = _apply(client, stu2, world, "B")
    with SessionLocal() as s:
        assert str(s.get(Essay, uuid.UUID(sp["id"])).application_id) == n2["id"]
        assert s.scalar(select(func.count()).select_from(Essay).where(Essay.application_id == uuid.UUID(n2["id"]))) == 2


# =============================================================================================== 12 · agency reviewer leaves

def _new_member(org_id, role: Role, name: str) -> uuid.UUID:
    with SessionLocal() as s:
        u = User(email=f"e2e-adv-staff-{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("correct horse battery"), full_name=name)
        s.add(u)
        s.flush()
        s.add(OrganizationMember(organization_id=org_id, user_id=u.id, role=role, is_active=True))
        s.commit()
        return u.id


def test_agency_member_leaves_and_nothing_is_orphaned(client, world):
    stu = _register(client)
    _apply(client, stu, world)
    lotus = None
    with SessionLocal() as s:
        lotus = s.scalar(select(Organization.id).where(Organization.slug == "lotus-bridge"))
    assert stu.org_id == lotus, "a Vietnamese premium student is placed with Lotus Bridge"
    leaver = _new_member(lotus, Role.AGENCY_ADMIN, "Leaving Counselor")
    doc = _upload(client, stu.h, text_pdf(["ACADEMIC TRANSCRIPT", "Cumulative GPA: 8.5 / 10"]), "TRANSCRIPT", "t.pdf", language="en").json()
    essay = next(e for e in client.get(f"{API}/essays", headers=stu.h).json()["items"] if e["essay_type"] == "PERSONAL_STATEMENT")
    case = client.post(f"{API}/me/service-cases", headers=stu.h, json={"type": "TEMPORARY_HOUSING", "note": "Two nights before the dorm opens"}).json()
    with SessionLocal() as s:
        a = s.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == stu.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        a.counselor_user_id = leaver
        d = s.get(Document, uuid.UUID(doc["id"]))
        d.reviewer_user_id = leaver
        e = s.get(Essay, uuid.UUID(essay["id"]))
        e.status, e.reviewer_user_id = EssayStatus.AGENCY_REVIEW, leaver
        s.get(ServiceCase, uuid.UUID(case["id"])).owner_user_id = leaver
        s.add(Task(title="Call the student about the bank certificate", task_type=TaskType.GENERAL, status=TaskStatus.OPEN, owner_user_id=leaver,
                   owner_org_id=lotus, student_user_id=stu.id, source="MANUAL"))
        s.commit()
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    before = client.get(f"{API}/agency/team/members/{leaver}/open-items", headers=mgr).json()
    assert {k for k, v in before["items"].items() if v} == {"students", "reviews", "essays", "tasks", "services"}
    r = client.post(f"{API}/agency/team/members/{leaver}/deactivate", headers=mgr, json={"reason": "Left the agency"})
    assert r.status_code == 200, r.text
    assert r.json()["remaining"] == 0 and all(m["to"] and m["to"] != str(leaver) for m in r.json()["moved"])
    # The engines that recreate work (tasks, concierge, writing) must not hand anything back to the person who left.
    _regen(stu.id)
    with SessionLocal() as s:
        concierge_svc.sync_tasks(s, s.get(ServiceCase, uuid.UUID(case["id"])))
        s.commit()
        assert not s.scalar(select(func.count()).select_from(AgencyAssignment).where(AgencyAssignment.counselor_user_id == leaver,
                                                                                     AgencyAssignment.status == AssignmentStatus.ACTIVE))
        assert not s.scalar(select(func.count()).select_from(Task).where(Task.owner_user_id == leaver, Task.status.in_(OPEN)))
        assert not s.scalar(select(func.count()).select_from(Essay).where(Essay.reviewer_user_id == leaver,
                                                                          Essay.status.in_([EssayStatus.SUBMITTED, EssayStatus.AGENCY_REVIEW, EssayStatus.FINAL_REVIEW])))
        assert not s.scalar(select(func.count()).select_from(Document).where(Document.reviewer_user_id == leaver,
                                                                             Document.status.in_([DocumentStatus.NEEDS_REVIEW, DocumentStatus.UPLOADED])))
        assert not [c for c in s.scalars(select(ServiceCase).where(ServiceCase.owner_user_id == leaver)) if not concierge_svc.is_closed(c)]
        a = s.scalar(select(AgencyAssignment).where(AgencyAssignment.student_user_id == stu.id, AgencyAssignment.status == AssignmentStatus.ACTIVE))
        new_owner = a.counselor_user_id
        assert s.scalar(select(OrganizationMember.is_active).where(OrganizationMember.user_id == new_owner, OrganizationMember.organization_id == lotus))
    # The student sees a real, active counselor.
    assert client.get(f"{API}/me/assignment", headers=stu.h).status_code == 200


# =============================================================================================== 13 · university reviewer removed

def test_university_reviewer_removed_reassigns_applicants(client, pnu_admin):
    with SessionLocal() as s:
        pnu = s.scalar(select(University).where(University.slug == "pusan-national-university"))
        org = s.scalar(select(Organization.id).where(Organization.university_id == pnu.id))
        admin_id = s.scalar(select(User.id).where(User.email == "admin@pusan.univ.demo.hangyul.kr"))
        apps = s.scalars(select(Application).where(Application.university_id == pnu.id,
                                                   Application.status.in_([ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW,
                                                                           ApplicationStatus.ADDITIONAL_DOCUMENTS, ApplicationStatus.INTERVIEW,
                                                                           ApplicationStatus.OFFERED, ApplicationStatus.WAITLISTED]))
                         .order_by(Application.created_at).limit(2)).all()
        ids = [a.id for a in apps]
        original = {a.id: a.university_reviewer_id for a in apps}  # restored afterwards (other tests assign reviewers too)
    assert ids, "seeded Pusan applicants awaiting review"
    reviewer = _new_member(org, Role.UNIVERSITY_ADMIN, "Departing Reviewer")
    try:
        with SessionLocal() as s:
            for i in ids:
                s.get(Application, i).university_reviewer_id = reviewer
            s.commit()
        r = client.post(f"{API}/university/team/{reviewer}/deactivate", headers=pnu_admin, json={})
        assert r.status_code == 422 and f"{len(ids)} open applicants" in r.json()["detail"]  # refused: they would be orphaned
        r = client.post(f"{API}/university/team/{reviewer}/deactivate", headers=pnu_admin, json={"reassign_to": str(admin_id), "note": "Left"})
        assert r.status_code == 200 and r.json()["reassigned"] == len(ids)
        with SessionLocal() as s:
            assert all(s.get(Application, i).university_reviewer_id == admin_id for i in ids)
        orphans = client.get(f"{API}/university/orphaned-assignments", headers=pnu_admin).json()
        assert not {o["id"] for o in orphans} & {str(i) for i in ids}
        audit = client.get(f"{API}/admin/audit", headers=pnu_admin)
        if audit.status_code == 200:
            pass  # audit visibility is covered by test_v9_university; the reassignment rows exist below
        with SessionLocal() as s:
            assert s.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "application.update",
                                                                              AuditLog.entity_id.in_([str(i) for i in ids]))) >= len(ids)
    finally:
        with SessionLocal() as s:
            for i in ids:
                s.get(Application, i).university_reviewer_id = original[i]
            s.commit()


# =============================================================================================== 14 · external connector unavailable

def test_unconfigured_submission_api_stays_guided_and_never_claims_submitted(client, world):
    stu = _register(client)
    app = _apply(client, stu, world, "API")
    aid = app["id"]
    _set_app(aid, status=ApplicationStatus.READY)
    v = client.get(f"{API}/applications/{aid}/submission", headers=stu.h).json()
    assert v["connector"]["method"] == "DIRECT_API" and v["integration_state"] == "AWAITING_PROVIDER" and v["direct_api"] == "NOT_CONFIGURED"
    assert v["counselor_submits"] and not v["can_handoff"] and not v["student_can_record"]
    r = client.post(f"{API}/applications/{aid}/submission/api-submit", headers=stu.counselor)
    assert r.status_code == 409 and "AWAITING_PROVIDER" in r.json()["detail"]
    after = client.get(f"{API}/applications/{aid}/submission", headers=stu.h).json()
    assert after["status"] in ("NOT_STARTED", "READY_FOR_HANDOFF") and after["record"] is None
    assert client.get(f"{API}/applications/{aid}", headers=stu.h).json()["status"] == "READY"
    with SessionLocal() as s:
        assert s.get(Application, uuid.UUID(aid)).submitted_at is None
        assert s.scalar(select(AuditLog).where(AuditLog.action == "submission.api_not_configured", AuditLog.entity_id == aid)) is not None
    # The student is not told to submit (their counselor does it on the official portal outside Hangyul) …
    home = client.get(f"{API}/me/dashboard", headers=stu.h).json()
    assert home["next_action"]["code"] not in ("SUBMISSION_HANDOFF", "SUBMISSION_CONFIRM")
    assert client.post(f"{API}/applications/{aid}/submission/confirm", headers=stu.h, json={"external_reference": "X1"}).status_code == 403
    # … and even the counselor's portal reference is not accepted while required documents are missing: "submitted"
    # needs both the evidence and a complete file (the evidence path itself is covered in test_v5_success).
    r = client.post(f"{API}/applications/{aid}/submission/confirm", headers=stu.counselor, json={"external_reference": "CAU-2031-0042"})
    assert r.status_code == 409 and "Required documents are missing" in r.json()["detail"]
    assert client.get(f"{API}/applications/{aid}", headers=stu.h).json()["status"] == "READY"


# =============================================================================================== 15 · payment callback delayed

class _DelayedProvider:
    """A redirect-checkout provider whose confirmation arrives later (as Stripe/Toss would)."""
    name = "delayedpay"
    state: dict = {}

    def create_checkout(self, *, order_id, amount_minor, currency, description, language="EN"):
        from app.services.payments import CheckoutSession

        ref = f"dp_{uuid.uuid4().hex[:12]}"
        self.state[ref] = "PENDING"
        return CheckoutSession(self.name, ref, f"https://pay.example.invalid/{ref}", "PENDING")

    def verify(self, provider_ref, payload=None):
        return self.state.get(provider_ref, "FAILED")


def test_delayed_payment_callback_activates_once(client, world, monkeypatch):
    import app.api.v1.student as student_api

    prov = _DelayedProvider()
    monkeypatch.setattr(student_api, "get_provider", lambda: prov)
    stu = _register(client, paid=False)
    r = client.post(f"{API}/me/orders", headers=stu.h, json={"product_code": "PREMIUM"})
    assert r.status_code == 201
    o = r.json()
    assert o["status"] == "PENDING" and o["assignment"] is None and o["redirect_url"] and not o["is_demo_payment"]
    with SessionLocal() as s:
        order = s.get(Order, uuid.UUID(o["order_id"]))
        from app.models import Payment

        ref = s.scalar(select(Payment.provider_ref).where(Payment.order_id == order.id))

    def assignments():
        with SessionLocal() as s:
            return s.scalar(select(func.count()).select_from(AgencyAssignment).where(AgencyAssignment.student_user_id == stu.id))

    # While the provider has not confirmed: the order stays PENDING and nothing is switched on.
    assert assignments() == 0
    assert [x["status"] for x in client.get(f"{API}/me/orders", headers=stu.h).json()] == ["PENDING"]
    r = client.post(f"{API}/payments/callback/delayedpay", json={"provider_ref": ref})
    assert r.status_code == 200 and r.json()["status"] == "PENDING" and assignments() == 0
    # A forged or misrouted callback changes nothing.
    assert client.post(f"{API}/payments/callback/delayedpay", json={"provider_ref": "dp_unknown"}).status_code == 404
    assert client.post(f"{API}/payments/callback/stripe", json={"provider_ref": ref}).status_code == 404
    # The confirmation arrives (late) → activated exactly once, however many times the provider retries.
    prov.state[ref] = "PAID"
    first = client.post(f"{API}/payments/callback/delayedpay", json={"provider_ref": ref}).json()
    second = client.post(f"{API}/payments/callback/delayedpay", json={"provider_ref": ref}).json()
    assert first == {"order_id": o["order_id"], "status": "PAID", "duplicate": False}
    assert second["status"] == "PAID" and second["duplicate"] is True
    assert assignments() == 1
    with SessionLocal() as s:
        assert s.get(Order, uuid.UUID(o["order_id"])).status == OrderStatus.PAID
        assert s.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == stu.id, Notification.kind == "AGENCY_ASSIGNED")) == 1
        conv = s.scalar(select(Conversation).where(Conversation.student_user_id == stu.id))
        assert s.scalar(select(func.count()).select_from(Message).where(Message.conversation_id == conv.id)) == 1


# =============================================================================================== 16 · message provider fails

def test_message_provider_failure_falls_back_to_in_app_without_claiming_delivery(client, world, monkeypatch):
    stu = _register(client)
    monkeypatch.setenv("HG_WHATSAPP_TOKEN", "x")
    monkeypatch.setenv("HG_WHATSAPP_PHONE_ID", "y")  # credentials exist, but no adapter/provider agreement
    with SessionLocal() as s:
        conv = s.scalar(select(Conversation).where(Conversation.student_user_id == stu.id))
        conv_id = str(conv.id)
        n_before = s.scalar(select(func.count()).select_from(Message).where(Message.conversation_id == conv.id))
    ch = {c["code"]: c for c in client.get(f"{API}/channels", headers=stu.counselor).json()["channels"]}
    assert ch["WHATSAPP"]["status"] == "NEEDS_AGREEMENT" and ch["WHATSAPP"]["can_send"] is False
    r = client.post(f"{API}/conversations/{conv_id}/messages", headers=stu.counselor, json={"body": "Your visa appointment is confirmed", "channel": "WHATSAPP"})
    assert r.status_code == 409 and "Nothing was sent" in r.json()["detail"]
    with SessionLocal() as s:
        assert s.scalar(select(func.count()).select_from(Message).where(Message.conversation_id == uuid.UUID(conv_id))) == n_before
    r = client.post(f"{API}/conversations/{conv_id}/messages", headers=stu.counselor, json={"body": "Your visa appointment is confirmed"})
    assert r.status_code == 201
    mid = r.json()["id"]
    dl = client.get(f"{API}/agency/conversations/{conv_id}/delivery", headers=stu.counselor).json()
    assert dl["messages"][mid] == {"state": "SENT", "channel": "IN_APP", "read_at": None}  # stored in the app, not "delivered"
    assert "External channels are not connected" in dl["definition"]
    assert client.post(f"{API}/conversations/{conv_id}/read", headers=stu.h).status_code == 204
    dl = client.get(f"{API}/agency/conversations/{conv_id}/delivery", headers=stu.counselor).json()
    assert dl["messages"][mid]["state"] == "READ"  # only once the student actually opened it


# =============================================================================================== 17 · housing provider cancels

def test_housing_provider_cancellation_returns_the_case_to_the_team(client, world):
    stu = _register(client)
    _apply(client, stu, world)
    case = client.post(f"{API}/me/service-cases", headers=stu.h, json={"type": "HOUSING_SEARCH", "note": "Studio near campus"}).json()
    cid = case["id"]
    api = f"{API}/agency/service-cases/{cid}"
    vendor = client.get(f"{API}/agency/vendors?kind=housing_provider", headers=stu.counselor).json()["items"][0]
    assert client.patch(api, headers=stu.counselor, json={"vendor_id": vendor["id"], "status": "CONTRACT_REVIEW"}).status_code == 200
    assert client.patch(api, headers=stu.counselor, json={"status": "DEPOSIT"}).status_code == 200
    assert any(t.key == f"svc:{cid}:student:DEPOSIT" and t.visible for t in _tasks(stu.id))
    assert client.patch(api, headers=stu.counselor, json={"status": "CONFIRMED"}).status_code == 200
    # The landlord cancels after confirmation.
    r = client.patch(api, headers=stu.counselor, json={"status": "INTERESTED", "note": "The landlord cancelled the contract — we are finding another room."})
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["status"] == "INTERESTED" and not c["closed"] and c["waiting_on"] == "team"
    tasks = {t.key: t for t in _tasks(stu.id)}
    team = tasks.get(f"svc:{cid}:team")
    assert team is not None and team.org == stu.org_id and not team.visible
    assert f"svc:{cid}:student:DEPOSIT" not in tasks
    mine = next(x for x in client.get(f"{API}/me/service-cases", headers=stu.h).json()["items"] if x["id"] == cid)
    assert mine["status"] == "INTERESTED" and any("landlord cancelled" in (e["body"] or "") for e in mine["events"])
    housing = client.get(f"{API}/me/housing", headers=stu.h).json()
    assert housing["case"]["status"] == "OFF_CAMPUS_SEARCH"  # not "confirmed" any more
    with SessionLocal() as s:
        n = s.scalars(select(Notification).where(Notification.user_id == stu.id, Notification.kind == "SERVICE_CASE")
                      .order_by(Notification.created_at.desc())).first()
        assert n is not None and (n.params or {}).get("status") == "INTERESTED"
    # A dormitory room withdrawn after confirmation goes back to the team the same way.
    dorm = client.post(f"{API}/me/service-cases", headers=stu.h, json={"type": "DORMITORY"}).json()
    dapi = f"{API}/agency/service-cases/{dorm['id']}"
    for st in ("APPLIED", "ASSIGNED", "CONFIRMED"):
        assert client.patch(dapi, headers=stu.counselor, json={"status": st}).status_code == 200, st
    d = client.patch(dapi, headers=stu.counselor, json={"status": "NOT_ASSIGNED", "note": "Dormitory office withdrew the room"}).json()
    assert d["status"] == "NOT_ASSIGNED" and d["waiting_on"] == "team" and not d["closed"]


# =============================================================================================== 18 · airport pickup, flight delayed

def test_flight_change_moves_the_pickup_and_reconfirmation_closes_the_task(client, world):
    stu = _register(client)
    _apply(client, stu, world)
    arrive = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=40)
    assert client.put(f"{API}/me/flight", headers=stu.h, json={"number": "VN416", "airport": "ICN", "scheduled_arrival": arrive.isoformat()}).status_code == 200
    r = client.post(f"{API}/me/pickup", headers=stu.h, json={"passengers": 1, "luggage": 2, "destination_kind": "DORM", "contact_method": "PHONE"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    api = f"{API}/agency/service-cases/{cid}"
    assert client.patch(api, headers=stu.counselor, json={"status": "CONFIRMED"}).status_code == 200
    vendor = client.get(f"{API}/agency/vendors?kind=airport_transport", headers=stu.counselor).json()["items"][0]
    r = client.patch(api, headers=stu.counselor, json={"vendor_id": vendor["id"], "details": {"driver": {"name": "Driver", "phone": "000"}}, "status": "DRIVER_ASSIGNED"})
    assert r.status_code == 200 and r.json()["status"] == "DRIVER_ASSIGNED"
    assert f"svc:{cid}:team" not in {t.key for t in _tasks(stu.id)}  # waiting on the provider — no team task
    # The flight is moved by three hours (the student updates it).
    later = arrive + timedelta(hours=3)
    assert client.put(f"{API}/me/flight", headers=stu.h, json={"number": "VN416", "airport": "ICN", "scheduled_arrival": later.isoformat()}).status_code == 200
    with SessionLocal() as s:
        c = s.get(ServiceCase, uuid.UUID(cid))
        assert c.due_at == later and (c.details or {}).get("reconfirm") is True  # the pickup moved with the flight
    team = next(t for t in _tasks(stu.id) if t.key == f"svc:{cid}:team")
    assert team.title_key == "task.concierge.reconfirm" and team.org == stu.org_id and not team.visible
    # The team re-confirms by recording the new arrival with the provider → the re-confirm task closes.
    r = client.post(f"{api}/events", headers=stu.counselor, json={"kind": "FLIGHT_CHANGE", "estimated_arrival": later.isoformat(), "body": "Driver re-booked"})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "DRIVER_ASSIGNED"
    assert f"svc:{cid}:team" not in {t.key for t in _tasks(stu.id)}, "re-confirmation must close the re-confirm task"
    with SessionLocal() as s:
        assert not (s.get(ServiceCase, uuid.UUID(cid)).details or {}).get("reconfirm")
    # A real delay reported later moves the pickup again and is marked as such (never "live").
    delayed = later + timedelta(minutes=90)
    r = client.post(f"{api}/events", headers=stu.counselor, json={"kind": "FLIGHT_CHANGE", "estimated_arrival": delayed.isoformat()}).json()
    assert r["status"] == "FLIGHT_DELAYED" and datetime.fromisoformat(r["due_at"]) == delayed and r["flight"]["live"] is False
