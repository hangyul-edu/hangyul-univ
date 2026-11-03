"""V5 visa concierge — FLOW E on the API (Mongolian persona): route resolved → documents reused → missing visa documents
added → ready to apply → appointment + official hand-off → submission recorded (with evidence) → embassy request → task →
answered → decision → visa issued (with the visa uploaded) → the concierge home stage takes over."""
from datetime import date, timedelta

from sqlalchemy import select

from app.core.deps import load_principal
from app.models import Application, OrganizationMember, ServiceCase, Task, User, VisaCase
from app.models.enums import ApplicationStatus, TaskStatus, VisaStatus
from app.services import concierge
from app.services import visa_routes as vr
from tests.conftest import login

MN = "student.visaroute@demo.hangyul.kr"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _upload(client, h, category, title):
    r = client.post("/api/v1/documents", headers=h, files={"file": (f"{title}.pdf", PDF, "application/pdf")},
                    data={"category": category, "title": title, "issuing_country": "MN", "issue_date": date.today().isoformat()})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_flow_e_visa_from_route_to_issued(client, db):
    h = login(client, MN, "student")
    ah = login(client, "counselor@silk.demo.hangyul.kr", "agency")
    sid = db.scalar(select(User.id).where(User.email == MN))
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    assert p["status"] == "RESOLVED" and p["route"]["country"] == "MN" and p["post"]["city"] == "Ulaanbaatar"
    assert p["method"]["code"] == "VISA_CENTRE" and p["pack"]["reused"] >= 5 and not p["pack"]["all_ready"]
    missing = [d["key"] for d in p["documents"] if d["applies"] == "yes" and d["status"] not in ("READY", "NEAR_EXPIRY", "FORM")]
    assert set(missing) == {"tb_test", "criminal_record"}, missing

    # Submission can't be recorded without evidence.
    assert client.post("/api/v1/me/visa-route/submission", json={"submitted_on": date.today().isoformat()}, headers=h).status_code == 422

    # The student adds the two visa-only documents; the counselor verifies them.
    for key, title in (("tb_test", "TB certificate"), ("criminal_record", "Criminal record certificate")):
        doc = _upload(client, h, "OTHER", title)
        r = client.post(f"/api/v1/me/visa-route/items/{key}", json={"document_id": doc}, headers=h)
        assert r.status_code == 200 and next(d for d in r.json()["documents"] if d["key"] == key)["status"] == "IN_REVIEW"
        assert client.post(f"/api/v1/documents/{doc}/review", json={"decision": "VERIFIED"}, headers=ah).status_code == 200
    for s in vr.FORM_SECTIONS:
        client.post(f"/api/v1/me/visa-route/form/{s}", json={}, headers=h)
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    assert p["pack"]["all_ready"] and p["case"]["status"] == "READY_TO_APPLY" and p["display_status"] == "READY"
    assert p["next"]["key"] == "book"

    # Counselor's Today shows the pack to review; appointment within 7 days shows too.
    appt = date.today() + timedelta(days=5)
    r = client.put("/api/v1/me/visa-route/appointment", json={"on": appt.isoformat(), "status": "BOOKED", "reference": "KVAC-2291"}, headers=h).json()
    assert r["case"]["appointment"]["status"] == "BOOKED" and r["next"]["key"] == "go_to_appointment"
    counselor = db.scalar(select(User).where(User.email == "counselor@silk.demo.hangyul.kr"))
    org = db.scalar(select(OrganizationMember.organization_id).where(OrganizationMember.user_id == counselor.id))
    items = vr.today_items(db, load_principal(db, counselor, org, "agency"))
    mine = [i for i in items if i["student"] and i["student"]["id"] == str(sid)]
    assert {i["reason"] for i in mine} >= {"appointment_soon", "pack_ready"}
    assert client.post(f"/api/v1/visa-route/students/{sid}/pack-reviewed", headers=ah).status_code == 200

    # Official hand-off, then the submission with its receipt number.
    assert client.post("/api/v1/me/visa-route/handoff", headers=h).json()["case"]["handoff_opened_at"]
    r = client.post("/api/v1/me/visa-route/submission", json={"submitted_on": date.today().isoformat(), "reference": "KVAC-R-88120"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["case"]["status"] == "SUBMITTED" and r.json()["display_status"] == "SUBMITTED"
    db.expire_all()
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid))
    assert db.get(Application, case.application_id).status == ApplicationStatus.VISA_SUBMITTED

    # The embassy asks for something → student task + visa support case.
    due = date.today() + timedelta(days=2)
    r = client.post("/api/v1/me/visa-route/requests", json={"note": "Bring the original bank book", "due_on": due.isoformat()}, headers=h).json()
    assert r["case"]["status"] == "ADDITIONAL_DOCUMENTS" and r["display_status"] == "EMBASSY_REQUEST"
    rid = r["case"]["requests"][0]["id"]
    db.expire_all()
    task = db.scalar(select(Task).where(Task.dedupe_key == f"visaroute:req:{rid}"))
    assert task and task.visible_to_student and task.status == TaskStatus.OPEN and task.due_at.date() == due
    sc = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "VISA_SUPPORT"))
    assert sc and sc.details["reason"] == "EMBASSY_REQUEST" and sc.status == "OPEN"
    assert r["help"]["issue"]["code"] == "EMBASSY_REQUEST" and r["help"]["support_case"]["id"] == str(sc.id)
    assert any(i["reason"] == "request_due" for i in vr.today_items(db, load_principal(db, counselor, org, "agency")))
    r = client.post(f"/api/v1/me/visa-route/requests/{rid}/sent", json={}, headers=h).json()
    assert r["case"]["status"] == "SUBMITTED"
    db.expire_all()
    assert db.scalar(select(Task).where(Task.dedupe_key == f"visaroute:req:{rid}")).status == TaskStatus.DONE

    # Decision, then the issued visa — only with the visa uploaded.
    assert client.post("/api/v1/me/visa-route/decision", json={"decision": "APPROVED", "decided_on": date.today().isoformat()}, headers=h).json()["case"]["status"] == "APPROVED"
    assert client.post("/api/v1/me/visa-route/issued", json={"document_id": ""}, headers=h).status_code in (404, 422)
    visa_doc = _upload(client, h, "VISA", "D-2-2 visa")
    r = client.post("/api/v1/me/visa-route/issued", json={"document_id": visa_doc, "issued_on": date.today().isoformat()}, headers=h)
    assert r.status_code == 200 and r.json()["case"]["status"] == "ISSUED" and r.json()["next"] is None
    db.expire_all()
    case = db.get(VisaCase, case.id)
    assert case.status == VisaStatus.ISSUED and case.issued_on == date.today()
    assert db.get(Application, case.application_id).status == ApplicationStatus.VISA_ISSUED
    assert concierge.home_stage(db, sid)["stage"] == "READY_TO_COME"
    assert vr.home_step(db, sid) is None


def test_refusal_goes_to_a_person(client, db):
    """A refusal is never left to the student alone: an urgent VISA_SUPPORT case for the team."""
    h = login(client, "student.myanmar@demo.hangyul.kr", "student")
    sid = db.scalar(select(User.id).where(User.email == "student.myanmar@demo.hangyul.kr"))
    assert client.post("/api/v1/me/visa-route/decision", json={"decision": "REFUSED", "decided_on": date.today().isoformat()}, headers=h).status_code == 409
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid))
    case.status = VisaStatus.SUBMITTED
    db.commit()
    try:
        r = client.post("/api/v1/me/visa-route/decision", json={"decision": "REFUSED", "decided_on": date.today().isoformat()}, headers=h).json()
        assert r["display_status"] == "NEEDS_ATTENTION" and r["next"]["key"] == "refused" and r["help"]["issue"]["code"] == "REFUSED"
        sc = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "VISA_SUPPORT"))
        assert sc.priority == "URGENT" and sc.details["reason"] == "REFUSAL"
    finally:
        db.expire_all()
        case = db.get(VisaCase, case.id)
        case.status = VisaStatus.DOCUMENT_PREPARATION
        db.commit()


def test_student_help_opens_a_visa_support_case(client, db):
    h = login(client, "student.nepal@demo.hangyul.kr", "student")
    r = client.post("/api/v1/me/visa-route/help", json={"message": "Can I apply in Pokhara?"}, headers=h)
    assert r.status_code == 201
    sid = db.scalar(select(User.id).where(User.email == "student.nepal@demo.hangyul.kr"))
    sc = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "VISA_SUPPORT"))
    assert sc and sc.status == "OPEN" and sc.details["reason"] == "STUDENT_QUESTION"
    assert r.json()["help"]["support_case"]["id"] == str(sc.id)
