"""End-to-end API flow: a new student from sign-up to visa preparation, touching agency and university consoles."""
import uuid

from sqlalchemy import select

from app.models import User
from app.seed.run import tiny_pdf
from tests.conftest import login
from tests.v22_helpers import register_student


def test_full_student_lifecycle(client, db, pnu_admin):
    reg = register_student(client, email=f"flow-{uuid.uuid4().hex[:6]}@example.com", full_name="Bishnu Tamang", locale="ne", nationality="NP")
    email, S = reg["email"], reg["h"]

    # 1) progressive profile
    r = client.patch("/api/v1/me/profile", headers=S, json={"residence_country": "NP", "date_of_birth": "2005-02-01", "target_degree": "LANGUAGE",
                                                              "target_intake_year": 2027, "target_intake_term": "SPRING", "desired_fields": ["korean_language"],
                                                              "annual_budget_krw": 15000000, "housing_preference": "DORM", "has_passport": True,
                                                              "passport_expiry": "2031-01-01", "financial_sponsor": "PARENTS", "preferred_regions": ["Busan"]})
    assert r.status_code == 200
    assert client.post("/api/v1/me/educations", headers=S, json={"level": "HIGH_SCHOOL", "institution": "Kathmandu Model School", "country": "NP",
                                                                  "gpa_value": 3.4, "gpa_scale_max": 4}).json()["gpa_percent"] == 85.0
    client.post("/api/v1/me/languages", headers=S, json={"test": "TOPIK", "score": 2, "test_date": "2026-07-01"})
    prof = client.get("/api/v1/me/profile", headers=S).json()
    assert prof["completion"]["percent"] == 100

    # 2) matches explain themselves; the PNU partner guarantee appears only for eligible language programs
    m = client.get("/api/v1/me/matches?degree=LANGUAGE", headers=S).json()
    assert m["items"] and all(item["reasons"] for item in m["items"])
    pnu = next(i for i in m["items"] if i["program"]["university"]["slug"] == "pusan-national-university")
    assert pnu["eligible"] and pnu["guarantee"] is not None

    # 3) save + compare
    assert client.put(f"/api/v1/me/saved/{pnu['program']['university_id']}", headers=S).status_code == 204
    cmp = client.post("/api/v1/compare", headers=S, json={"program_ids": [m["items"][0]["program_id"], m["items"][1]["program_id"]]})
    assert cmp.status_code == 200 and len(cmp.json()) == 2

    # 4) buy Premium in demo mode → agency assignment by the engine (Nepal → Himalaya Pathways)
    o = client.post("/api/v1/me/orders", headers=S, json={"product_code": "PREMIUM"}).json()
    assert o["status"] == "PAID" and o["is_demo_payment"] and o["assignment"]
    assert "Himalaya" in o["assignment"]["organization"]

    # 5) application to PNU language program
    app = client.post("/api/v1/applications", headers=S, json={"program_id": pnu["program_id"]})
    assert app.status_code == 201, app.text
    app_id = app.json()["id"]
    detail = client.get(f"/api/v1/applications/{app_id}", headers=S).json()
    required = [i for i in detail["checklist"] if i["required"]]
    assert required and all(i["status"] == "MISSING" for i in required)

    # 6) upload every required document
    for item in required:
        r = client.post("/api/v1/documents", headers=S, data={"category": item["category"], "issuing_country": "NP", "language": "en"},
                        files={"file": (f"{item['category']}.pdf", tiny_pdf(item["label"]), "application/pdf")})
        assert r.status_code == 201, r.text
    docs = client.get("/api/v1/documents?page_size=50", headers=S).json()["items"]
    diploma = next(d for d in docs if d["category"] == "GRADUATION_CERTIFICATE")
    assert diploma["legalization_path"] == "CONSULAR_LEGALIZATION"  # Nepal is not an Apostille party

    # 7) the assigned agency reviews: one correction, then verify everything
    user = db.scalar(select(User).where(User.email == email))
    counselor_email = None
    agency_students = None
    for cand in ("counselor@himalaya.demo.hangyul.kr", "counselor2@himalaya.demo.hangyul.kr", "manager@himalaya.demo.hangyul.kr"):
        H = login(client, cand, "agency")
        agency_students = client.get("/api/v1/agency/students?page_size=200", headers=H).json()["items"]
        if any(s["id"] == str(user.id) for s in agency_students):
            counselor_email = cand
            break
    assert counselor_email, "assigned counselor should see the student"
    A = login(client, counselor_email, "agency")
    r = client.post(f"/api/v1/documents/{diploma['id']}/review", headers=A, json={"decision": "NEEDS_CORRECTION"})
    assert r.status_code == 422  # a reason is mandatory
    client.post(f"/api/v1/documents/{diploma['id']}/review", headers=A, json={"decision": "NEEDS_CORRECTION", "reason": "Consular confirmation stamp missing"})
    notes = client.get("/api/v1/notifications", headers=S).json()
    assert any(n["kind"] == "DOCUMENT_NEEDS_CORRECTION" for n in notes["items"])
    for d in docs:
        assert client.post(f"/api/v1/documents/{d['id']}/review", headers=A, json={"decision": "VERIFIED"}).status_code == 200

    # 8) essay: student submits, reviewer comments with a suggestion, student accepts it, reviewer approves
    essay = next(e for e in client.get("/api/v1/essays", headers=S).json()["items"] if e["application_id"] == app_id)
    client.put(f"/api/v1/essays/{essay['id']}", headers=S, json={"body": "I want to study Korean in Busan because my goal is to work in tourism. I studied hard."})
    assert client.post(f"/api/v1/essays/{essay['id']}/status", headers=S, json={"status": "SUBMITTED"}).json()["status"] == "AGENCY_REVIEW"
    assert client.put(f"/api/v1/essays/{essay['id']}", headers=S, json={"body": "edit during review"}).status_code == 409
    c = client.post(f"/api/v1/essays/{essay['id']}/comments", headers=A, json={"body": "Be specific", "quote": "I studied hard.", "suggestion": "I completed 200 hours of Korean classes."})
    assert c.status_code == 201
    client.post(f"/api/v1/essays/{essay['id']}/status", headers=A, json={"status": "CHANGES_REQUESTED"})
    after = client.post(f"/api/v1/essays/{essay['id']}/comments/{c.json()['id']}/resolve?apply_suggestion=true", headers=S).json()
    assert "200 hours" in after["body"]
    client.post(f"/api/v1/essays/{essay['id']}/status", headers=S, json={"status": "SUBMITTED"})
    assert client.post(f"/api/v1/essays/{essay['id']}/status", headers=A, json={"status": "APPROVED"}).json()["status"] == "APPROVED"

    # 9) agency moves the application forward; nonsensical jumps are refused
    assert client.post(f"/api/v1/applications/{app_id}/transition", headers=A, json={"to": "OFFERED"}).status_code == 409
    for st in ("DOCUMENT_PREPARATION", "READY", "SUBMITTED"):
        r = client.post(f"/api/v1/applications/{app_id}/transition", headers=A, json={"to": st})
        assert r.status_code == 200, r.text

    # 10) university sees it and decides; students cannot decide their own admission
    uni_list = client.get("/api/v1/applications?page_size=200", headers=pnu_admin).json()["items"]
    assert any(a["id"] == app_id for a in uni_list)
    assert client.post(f"/api/v1/applications/{app_id}/transition", headers=S, json={"to": "UNIVERSITY_REVIEW"}).status_code == 403
    for st in ("UNIVERSITY_REVIEW", "OFFERED"):
        assert client.post(f"/api/v1/applications/{app_id}/transition", headers=pnu_admin, json={"to": st}).status_code == 200

    # 11) student sees the update, accepts; tuition + admission letter → visa case opens automatically (D-4-1)
    assert client.get(f"/api/v1/applications/{app_id}", headers=S).json()["status"] == "OFFERED"
    assert client.post(f"/api/v1/applications/{app_id}/transition", headers=S, json={"to": "OFFER_ACCEPTED"}).status_code == 200
    for st in ("TUITION_PENDING", "TUITION_PAID", "ADMISSION_CERTIFICATE_ISSUED"):
        assert client.post(f"/api/v1/applications/{app_id}/transition", headers=pnu_admin, json={"to": st}).status_code == 200
    visa = client.get("/api/v1/visa", headers=S).json()["items"]
    assert visa and visa[0]["visa_type"] == "D-4-1" and visa[0]["checklist"]
    assert "does not issue visas" in visa[0]["disclaimer"]

    # 12) history is complete and ordered
    hist = client.get(f"/api/v1/applications/{app_id}", headers=S).json()["history"]
    assert [h["to"] for h in hist][-3:] == ["TUITION_PENDING", "TUITION_PAID", "ADMISSION_CERTIFICATE_ISSUED"]


def test_dashboard_answers_the_core_questions(client, student):
    d = client.get("/api/v1/me/dashboard", headers=student).json()
    for key in ("next_action", "readiness", "deadlines", "recommendations", "applications", "missing_documents", "counselor", "scholarships", "cost_estimate"):
        assert key in d
    assert d["next_action"]["title"]
    assert d["counselor"]["counselor"]["kind"] == "team"  # V22: the student is served by the Hangyul team, not a named person


def test_analytics_are_honest_about_small_samples(client, pnu_admin, lotus_counselor):
    u = client.get("/api/v1/university/analytics", headers=pnu_admin).json()
    for k, v in u["kpis"].items():
        if isinstance(v, dict) and v.get("insufficient_data"):
            assert v["value"] is None
    assert [s["stage"] for s in u["funnel"]][:3] == ["INTERESTED", "PREPARING", "APPLIED"]
    a = client.get("/api/v1/agency/analytics", headers=lotus_counselor).json()
    assert a["definitions"]["offer_rate"]
