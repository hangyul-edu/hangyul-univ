"""V4: E2E rows written on *seeded* applications are removed by the teardown purge, and the application's status is
restored to what it was before the E2E request (demo applicant Priya Nair carried six "E2E bank certificate …" requests)."""
import importlib.util
from pathlib import Path

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import Application, ApplicationStatusHistory, DocumentRequest, Notification, Task, University
from app.models.enums import ApplicationStatus

from .conftest import login

_spec = importlib.util.spec_from_file_location("purge_e2e", Path(__file__).resolve().parents[1] / "scripts" / "purge_e2e.py")
purge = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(purge)


def test_marker_recognition():
    assert purge.is_e2e_request("E2E bank certificate 1790618525316", "E2E 1790618525316: please upload …")
    assert purge.is_e2e_request("Recent bank certificate", "E2E 1790618525316: please upload …")
    # the pre-V4 form of the student spec: only a Date.now() stamp at the end of the note
    assert purge.is_e2e_request("Recent bank certificate", "Please upload a bank certificate issued within the last 30 days (1790618525316).")
    assert not purge.is_e2e_request("Recent bank certificate", "Please upload a bank certificate issued within the last 30 days.")
    assert not purge.is_e2e_request("Bank certificate (2026)", "Issued after 12 May (2026).")


ADMISSIONS = {"pusan-national-university": "admissions@pusan.univ.demo.hangyul.kr", "sungkyunkwan-university": "admissions@sungkyunkwan.univ.demo.hangyul.kr",
              "kyung-hee-university": "admissions@kyung.univ.demo.hangyul.kr"}


def _app_awaiting_university():
    """Any application a partner university can still ask documents for (other tests consume them in any order)."""
    with SessionLocal() as db:
        for slug, email in ADMISSIONS.items():
            uid = db.scalar(select(University.id).where(University.slug == slug))
            app = db.scalar(select(Application).where(Application.university_id == uid, Application.status.in_(
                [ApplicationStatus.SUBMITTED, ApplicationStatus.UNIVERSITY_REVIEW])).order_by(Application.created_at))
            if app:
                n_hist = db.scalar(select(func.count()).select_from(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == app.id))
                return str(app.id), app.status, n_hist, email
    raise AssertionError("seed should have an application under university review")


def _request(client, uni, app_id, label, note):
    r = client.post(f"/api/v1/applications/{app_id}/document-requests", headers=uni, json={"label": label, "note": note})
    assert r.status_code == 201, r.text


def _purge():
    with SessionLocal() as db:
        counts = purge.purge_marked_requests(db)
        db.commit()
    return counts


def test_purge_removes_marked_requests_and_restores_status(client):
    app_id, original, n_hist, email = _app_awaiting_university()
    uni = login(client, email, "university")

    # 1. Only E2E requests (the Priya Nair case, including the pre-V4 unmarked-label form): everything goes, status is restored.
    _request(client, uni, app_id, "E2E bank certificate 1790000000000", "E2E 1790000000000: please upload a bank certificate.")
    _request(client, uni, app_id, "Recent bank certificate", "Please upload a bank certificate issued within the last 30 days (1790000000001).")
    with SessionLocal() as db:
        assert db.get(Application, app_id).status == ApplicationStatus.ADDITIONAL_DOCUMENTS
    counts = _purge()
    assert counts["document_requests"] == 2 and counts["tasks"] == 2 and counts["application_status_history"] >= 1
    assert counts["applications_restored"] == 1
    with SessionLocal() as db:
        app = db.get(Application, app_id)
        assert app.status == original  # the seeded state is back
        assert db.scalar(select(func.count()).select_from(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == app.id)) == n_hist
        assert not db.scalars(select(DocumentRequest).where(DocumentRequest.application_id == app_id)).all()
        assert not db.scalars(select(Task).where(Task.dedupe_key.like("docreq:%"), Task.application_id == app.id)).all()
        assert not db.scalars(select(Notification).where(Notification.fallback_text.contains("E2E bank certificate"))).all()

    # 2. A genuine request made after an E2E one keeps the status it found; only the E2E request is removed.
    _request(client, uni, app_id, "E2E bank certificate 1790000000002", "E2E 1790000000002: please upload a bank certificate.")
    _request(client, uni, app_id, "Recent bank certificate", "Please upload a bank certificate issued within the last 30 days.")
    counts = _purge()
    assert counts["document_requests"] == 1 and counts["applications_restored"] == 0
    with SessionLocal() as db:
        labels = set(db.scalars(select(DocumentRequest.label).where(DocumentRequest.application_id == app_id)).all())
        assert labels == {"Recent bank certificate"}
        assert db.get(Application, app_id).status == ApplicationStatus.ADDITIONAL_DOCUMENTS
