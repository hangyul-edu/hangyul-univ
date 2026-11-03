"""V4 university console: list rows say what was verified, triage filters for document requests, an honest submissions
series, one population per lifecycle row, a named current intake, the attention split by who acts next, the student
preview of a program, and the document-request loop end to end (student + agency see the exact note and due date)."""
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Application, Document, Task, University, User
from app.models.enums import ApplicationStatus

from .conftest import login

PNU = "admin@pusan.univ.demo.hangyul.kr"
ADMISSIONS = "admissions@pusan.univ.demo.hangyul.kr"


def test_list_rows_carry_verified_document_counts(client):
    h = login(client, ADMISSIONS, "university")
    items = client.get("/api/v1/applications", params={"page_size": 50}, headers=h).json()["items"]
    assert items
    for i in items:
        d = i["documents"]
        assert set(d) == {"required", "verified", "shared"}
        assert 0 <= d["verified"] <= d["required"] and 0 <= d["shared"] <= d["required"]
        assert isinstance(i["returned_document_requests"], int)


def test_submissions_series_comes_from_applications(client):
    h = login(client, PNU, "university")
    a = client.get("/api/v1/university/analytics", headers=h).json()
    monthly = a["series"]["submitted_monthly"]
    assert len(monthly) == 12 and all({"month", "value"} <= set(m) for m in monthly)
    weekly = a["series"]["submitted"]
    assert all({"week", "value"} <= set(w) for w in weekly)
    # The series is never empty while applications were submitted in the window (it used to read an empty rollup table).
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        subs = [s for (s,) in db.execute(select(Application.submitted_at).where(Application.university_id == uid, Application.submitted_at.is_not(None)))]
    first_month, last_month = monthly[0]["month"], monthly[-1]["month"]
    # V30: bounded on both sides. The window ends at the server's (UTC) current month; a submission created by an
    # earlier test "now" falls in the NEXT month in KST between 00:00 and 09:00 on the 1st, and the old one-sided
    # count failed on every month boundary (observed 2026-11-01 03:06 KST: 7 vs 8). The series itself was right.
    in_window = sum(1 for s in subs if first_month <= s.strftime("%Y-%m") <= last_month)
    assert sum(m["value"] for m in monthly) == in_window


def test_lifecycle_counts_never_exceed_the_previous_stage(client):
    h = login(client, PNU, "university")
    for nat in (None, "CN", "VN", "BD"):
        a = client.get("/api/v1/university/analytics", params={"nationality": nat} if nat else {}, headers=h).json()
        f = {s["stage"]: s["count"] for s in a["funnel"]}
        assert f["ARRIVED"] <= f["VISA_ISSUED"] <= f["TUITION_PAID"] <= f["ADMITTED"] <= f["APPLIED"], (nat, f)
    out = client.get("/api/v1/university/outcomes", params={"by": "nationality"}, headers=h).json()
    for r in out["rows"]:
        c = r["counts"]
        if r["tracked_admissions"]:
            assert c["ARRIVED"] <= c["VISA_ISSUED"] <= c["ADMITTED"], r


def test_exactly_one_current_intake(client):
    h = login(client, PNU, "university")
    intakes = client.get("/api/v1/university/metrics", headers=h).json()["intakes"]
    assert intakes
    assert sum(1 for i in intakes if i["current"]) == 1
    cur = next(i for i in intakes if i["current"])
    others = [i for i in intakes if i["next_deadline"]]
    if others:
        assert cur["next_deadline"] == min(i["next_deadline"] for i in others)


def test_attention_splits_university_actions(client):
    h = login(client, PNU, "university")
    att = client.get("/api/v1/university/attention", headers=h).json()
    for k in ("awaiting_review", "documents_returned", "interviews", "awaiting_tuition_invoice", "awaiting_tuition_payment", "awaiting_admission_letter"):
        assert isinstance(att[k], int) and att[k] >= 0, k


def test_student_preview_matches_public_program_and_is_tenant_scoped(client):
    h = login(client, PNU, "university")
    prog = client.get("/api/v1/university/programs", headers=h).json()[0]
    pv = client.get(f"/api/v1/university/programs/{prog['id']}/student-preview", headers=h)
    assert pv.status_code == 200, pv.text
    d = pv.json()
    assert d["id"] == prog["id"] and "first_year_range_krw" in d and isinstance(d["required_documents"], list)
    public = client.get(f"/api/v1/programs/{prog['id']}").json()
    assert d["first_year_range_krw"] == public["first_year_range_krw"]
    assert [x["label"] for x in d["required_documents"]] == [x["label"] for x in public["required_documents"]]
    other = login(client, "admin@sungkyunkwan.univ.demo.hangyul.kr", "university")
    assert client.get(f"/api/v1/university/programs/{prog['id']}/student-preview", headers=other).status_code == 404


def test_request_loop_exact_note_reaches_student_and_agency_then_closes(client):
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        app = db.scalar(select(Application).where(Application.university_id == uid, Application.status.in_(
            [ApplicationStatus.UNIVERSITY_REVIEW, ApplicationStatus.INTERVIEW, ApplicationStatus.SUBMITTED])).order_by(Application.submitted_at.desc()))
        app_id, student_email = str(app.id), db.get(User, app.student_user_id).email
        doc_id = str(db.scalar(select(Document.id).where(Document.owner_user_id == app.student_user_id)))
        agency_org = app.agency_org_id
    uni = login(client, ADMISSIONS, "university")
    note = "V4 check: please upload your final diploma with an apostille issued after June 2026."
    r = client.post(f"/api/v1/applications/{app_id}/document-requests", headers=uni,
                    json={"label": "Apostilled diploma", "note": note, "category": "GRADUATION_CERTIFICATE", "due_date": "2030-02-01"})
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["due_date"] == "2030-02-01"

    # Open requests are a triage filter in the university list.
    open_ids = [i["id"] for i in client.get("/api/v1/applications", params={"requests": "open", "page_size": 100}, headers=uni).json()["items"]]
    assert app_id in open_ids

    # Student: exact note, due date kept on the task.
    student = login(client, student_email, "student")
    tasks = client.get("/api/v1/tasks?scope=mine", headers=student).json()["items"]
    t = next(x for x in tasks if x["task_type"] == "UNIVERSITY_REQUEST" and x.get("description") == note)
    due = datetime.fromisoformat(t["due_at"]).astimezone(timezone.utc)
    assert due.date().isoformat() == "2030-02-01"
    # Agency: the task belongs to the student's agency with the same words.
    with SessionLocal() as db:
        task = db.scalar(select(Task).where(Task.dedupe_key == f"docreq:{req['id']}"))
        assert task.description == note and task.owner_org_id == agency_org and task.visible_to_student

    # Returned: the student sends a vault document → closed task, university sees the document, "returned" filter lists it.
    ok = client.post(f"/api/v1/document-requests/{req['id']}/fulfill", headers=student, json={"document_id": doc_id})
    assert ok.status_code == 200 and ok.json()["status"] == "FULFILLED"
    assert client.get(f"/api/v1/documents/{doc_id}", headers=uni).status_code == 200
    returned = client.get("/api/v1/applications", params={"requests": "returned", "page_size": 100}, headers=uni).json()["items"]
    row = next((i for i in returned if i["id"] == app_id), None)
    if row is not None:  # only when no other request on this application is still open
        assert row["returned_document_requests"] >= 1
    with SessionLocal() as db:
        assert db.scalar(select(Task).where(Task.dedupe_key == f"docreq:{req['id']}")).status.value == "DONE"
