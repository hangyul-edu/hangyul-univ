"""V3 university: one metric definition everywhere, the full document-request loop, role-restricted partnership
financials and the admission-rule review workflow."""
import uuid

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Application, Document, DocumentRequest, Task, University
from app.models.enums import ApplicationStatus

from .conftest import login

PNU = "admin@pusan.univ.demo.hangyul.kr"


def _uni(client, email=PNU):
    return login(client, email, "university")


def test_metrics_agree_across_every_screen(client):
    h = _uni(client)
    m = client.get("/api/v1/university/metrics", headers=h).json()
    a = client.get("/api/v1/university/analytics", headers=h).json()
    f = client.get("/api/v1/university/admissions-funnel", headers=h).json()
    pm = m["pipeline"]["metrics"]
    for key in ("offer_rate", "yield", "visa_conversion"):
        assert a["kpis"][key]["value"] == pm[key]["value"], key
        assert a["kpis"][key]["numerator"] == pm[key]["numerator"] and a["kpis"][key]["denominator"] == pm[key]["denominator"], key
        assert f["metrics"][key]["value"] == pm[key]["value"], key
    # Every rate states numerator, denominator, population, period and definition.
    for v in pm.values():
        assert {"value", "numerator", "denominator", "population", "period", "definition", "insufficient"} <= set(v)
    # Funnel counts are monotonic and the population is the submitted applications.
    counts = [s["count"] for s in m["pipeline"]["steps"]]
    assert counts == sorted(counts, reverse=True)
    assert m["pipeline"]["population"]["size"] == counts[0]
    # Historical cohorts are a separate population.
    assert m["cohorts"]["population"].startswith("Enrolled")
    # Scoping to one intake changes the population label, never mixes intakes.
    if m["intakes"]:
        k = m["intakes"][0]["key"]
        one = client.get(f"/api/v1/university/metrics?intake={k}", headers=h).json()
        assert one["pipeline"]["population"]["intake"] == k
        assert one["pipeline"]["steps"][0]["count"] <= counts[0]


def _app_under_review(uni_slug="pusan-national-university"):
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == uni_slug))
        # V9: deterministic pick in order of preference (row order changes once other tests update applications; an
        # INTERVIEW application cannot move to "additional documents", so it is the last resort).
        pref = [ApplicationStatus.UNIVERSITY_REVIEW, ApplicationStatus.SUBMITTED, ApplicationStatus.ADDITIONAL_DOCUMENTS, ApplicationStatus.INTERVIEW]
        cands = db.scalars(select(Application).where(Application.university_id == uid, Application.status.in_(pref))
                           .order_by(Application.submitted_at, Application.id)).all()
        app = sorted(cands, key=lambda a: pref.index(a.status))[0]
        student_email = app.student.email if hasattr(app, "student") and app.student else None
        from app.models import User

        student_email = student_email or db.get(User, app.student_user_id).email
        doc = db.scalar(select(Document).where(Document.owner_user_id == app.student_user_id))
        return str(app.id), student_email, str(doc.id)


def test_document_request_loop_reaches_student_and_returns_to_university(client):
    app_id, student_email, doc_id = _app_under_review()
    uni = login(client, "admissions@pusan.univ.demo.hangyul.kr", "university")
    note = "Please upload a bank certificate issued within the last 30 days."
    r = client.post(f"/api/v1/applications/{app_id}/document-requests", headers=uni,
                    json={"label": "Recent bank certificate", "note": note, "category": "BANK_STATEMENT", "due_date": "2030-01-15"})
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["status"] == "OPEN" and req["note"] == note

    # The application waits for documents; the student sees the exact note as a task and as the first checklist item.
    student = login(client, student_email, "student")
    detail = client.get(f"/api/v1/applications/{app_id}", headers=student).json()
    assert detail["status"] == "ADDITIONAL_DOCUMENTS"
    first = detail["checklist"][0]
    assert first["action_code"] == "UNIVERSITY_REQUEST" and first["action"] == note
    assert detail["document_requests"][0]["note"] == note
    tasks = client.get("/api/v1/tasks?scope=mine", headers=student).json()["items"]
    t = next(x for x in tasks if x["task_type"] == "UNIVERSITY_REQUEST" and x["application_id"] == app_id and x.get("description") == note)
    assert t["status"] == "OPEN"
    notes = client.get("/api/v1/notifications", headers=student).json()["items"]
    assert any(n["kind"] == "DOCUMENT_REQUEST" for n in notes)

    # Before fulfilment the university cannot open an unshared vault document.
    assert client.get(f"/api/v1/documents/{doc_id}", headers=uni).status_code in (200, 404)
    ok = client.post(f"/api/v1/document-requests/{req['id']}/fulfill", headers=student, json={"document_id": doc_id})
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "FULFILLED"
    # Completion is visible back to the university, and the document is now shared.
    assert client.get(f"/api/v1/documents/{doc_id}", headers=uni).status_code == 200
    back = client.get(f"/api/v1/applications/{app_id}", headers=uni).json()
    assert back["document_requests"][0]["status"] == "FULFILLED"
    att = client.get("/api/v1/university/attention", headers=uni).json()
    assert app_id in att["returned_application_ids"]
    with SessionLocal() as db:
        task = db.scalar(select(Task).where(Task.dedupe_key == f"docreq:{req['id']}"))
        assert task.status.value == "DONE"
    # A fulfilled request cannot be fulfilled or cancelled again.
    assert client.post(f"/api/v1/document-requests/{req['id']}/cancel", headers=uni).status_code == 409


def test_document_requests_respect_tenants_and_roles(client):
    app_id, student_email, doc_id = _app_under_review()
    other_uni = _uni(client, "admin@sungkyunkwan.univ.demo.hangyul.kr")
    body = {"label": "Passport", "note": "Please upload a clearer passport scan."}
    assert client.post(f"/api/v1/applications/{app_id}/document-requests", headers=other_uni, json=body).status_code == 404
    # V22: every admin of the university requests documents (the read-only analyst title is gone); students never do.
    analyst = login(client, "analyst@pusan.univ.demo.hangyul.kr", "university")
    by_analyst = client.post(f"/api/v1/applications/{app_id}/document-requests", headers=analyst, json=body)
    assert by_analyst.status_code == 201, by_analyst.text
    assert client.post(f"/api/v1/document-requests/{by_analyst.json()['id']}/cancel", headers=analyst).json()["status"] == "CANCELLED"
    student = login(client, student_email, "student")
    assert client.post(f"/api/v1/applications/{app_id}/document-requests", headers=student, json=body).status_code == 403
    uni = login(client, "admissions@pusan.univ.demo.hangyul.kr", "university")
    req = client.post(f"/api/v1/applications/{app_id}/document-requests", headers=uni, json=body).json()
    # Another student cannot fulfil it, and a document from someone else's vault is refused.
    other_student = login(client, "student01@demo.hangyul.kr", "student")
    if other_student and student_email != "student01@demo.hangyul.kr":
        assert client.post(f"/api/v1/document-requests/{req['id']}/fulfill", headers=other_student, json={"document_id": doc_id}).status_code == 404
    with SessionLocal() as db:
        foreign = db.scalar(select(Document.id).where(Document.owner_user_id != db.get(Application, app_id).student_user_id))
    assert client.post(f"/api/v1/document-requests/{req['id']}/fulfill", headers=student, json={"document_id": str(foreign)}).status_code == 404
    assert client.post(f"/api/v1/document-requests/{req['id']}/cancel", headers=uni).json()["status"] == "CANCELLED"
    with SessionLocal() as db:
        assert db.scalar(select(DocumentRequest).where(DocumentRequest.id == req["id"])).status == "CANCELLED"


def test_partnership_financials_are_role_restricted(client):
    admin = _uni(client)
    # V22: every admin of the university (the former analyst/reviewer/admissions titles included) sees the contract's money…
    for who in ("analyst", "reviewer", "admissions"):
        row = client.get("/api/v1/university/partnership", headers=login(client, f"{who}@pusan.univ.demo.hangyul.kr", "university")).json()[0]
        assert row["financials_visible"] is True and row["recruitment_fee_krw"] is not None, who
    # …while Hangyul staff outside finance/operations (the writing specialist) still get the limited view.
    pnu_id = client.get("/api/v1/university/overview", headers=admin).json()["university"]["id"]
    writer = login(client, "writing@demo.hangyul.kr", "university")
    full = client.get("/api/v1/university/partnership", headers=admin).json()[0]
    limited = client.get("/api/v1/university/partnership", params={"university_id": pnu_id}, headers=writer).json()[0]
    assert full["financials_visible"] is True and full["recruitment_fee_krw"] is not None
    assert limited["financials_visible"] is False
    assert limited["recruitment_fee_krw"] is None and limited["commission_percent"] is None and limited["guaranteed_minimum_krw"] is None
    assert all(not any("krw" in k for k in t) for t in limited["incentive_tiers"])
    assert "performance" in limited


def test_rule_changes_are_proposed_then_published(client, db):
    """Propose → publish, and then put the requirement back.

    The session seeds the database once and shares it, so a test that raises a programme's TOPIK minimum and
    leaves it raised silently changes every later test that counts programmes by language requirement. This one
    did, and only passed because `[0]` happened to be an *inactive* fixture programme that nothing counts —
    V12's rename of that fixture moved an active programme into the slot and
    `test_v9_student::test_quick_check_nepal_no_test_shows_language_route` started failing on a count of 20
    instead of 21. So: pick the programme by name rather than by position, and restore the value at the end.
    """
    admissions = login(client, "admissions@pusan.univ.demo.hangyul.kr", "university")
    admin = _uni(client)
    programs = client.get("/api/v1/university/programs", headers=admin).json()
    prog = next(p for p in programs if p["requirements"] and p["requirements"].get("min_topik_level") is not None)
    original_topik = prog["requirements"]["min_topik_level"]
    # V22: every admin of the university publishes directly…
    probe = 3 if original_topik != 3 else 2
    assert client.patch(f"/api/v1/university/programs/{prog['id']}/requirements", headers=admissions, json={"min_topik_level": probe}).status_code == 200
    assert next(x for x in client.get("/api/v1/university/programs", headers=admin).json() if x["id"] == prog["id"])["requirements"]["min_topik_level"] == probe
    # …and the propose → publish path still exists for a change that should be looked at first; any admin may publish it.
    pr = client.post(f"/api/v1/university/programs/{prog['id']}/requirement-proposals", headers=admissions,
                     json={"min_topik_level": 4, "note": "Faculty raised the language bar."})
    assert pr.status_code == 201, pr.text
    pending = client.get("/api/v1/university/requirement-proposals", headers=admin).json()
    assert any(x["id"] == pr.json()["id"] for x in pending)
    done = client.post(f"/api/v1/university/requirement-proposals/{pr.json()['id']}/publish", headers=admissions).json()
    assert done["status"] == "PUBLISHED"
    after = next(x for x in client.get("/api/v1/university/programs", headers=admin).json() if x["id"] == prog["id"])
    assert after["requirements"]["min_topik_level"] == 4
    assert after["requirements"]["verification_status"] == "CURRENT"

    # Restore, so the shared seed looks the same to every test that runs after this one.
    from app.models.catalog import AdmissionRequirement

    req = db.query(AdmissionRequirement).filter_by(program_id=uuid.UUID(prog["id"])).one()
    req.min_topik_level = original_topik
    db.commit()


def test_outcomes_keep_untracked_admissions_as_unknown(client):
    h = _uni(client)
    for by in ("cohort", "nationality", "program", "agency"):
        d = client.get(f"/api/v1/university/outcomes?by={by}", headers=h).json()
        assert d["steps"][0] == "ADMITTED"
        for row in d["rows"]:
            if not row["tracked_admissions"]:
                assert row["counts"]["ADMITTED"] is None
    exp = client.get("/api/v1/university/export/metrics.csv", headers=h)
    assert exp.status_code == 200 and "yield" in exp.text
    hist = client.get("/api/v1/university/exports", headers=h).json()
    assert hist["capabilities"]["scheduled"] is False and hist["jobs"][0]["kind"] == "METRICS"
