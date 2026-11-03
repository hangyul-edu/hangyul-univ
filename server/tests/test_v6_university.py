"""V6 university console: measured preparation value and the statement reader view, with tenant isolation."""
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Application, AuditLog, University
from app.models.enums import ApplicationStatus
from app.services.access import PRE_SUBMISSION

from .conftest import login

PNU = "admin@pusan.univ.demo.hangyul.kr"
ADMISSIONS = "admissions@pusan.univ.demo.hangyul.kr"
ANALYST = "analyst@pusan.univ.demo.hangyul.kr"
SKKU = "admin@sungkyunkwan.univ.demo.hangyul.kr"


def _pnu_app(submitted: bool = True):
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        q = select(Application).where(Application.university_id == uid)
        q = q.where(Application.status.not_in(PRE_SUBMISSION)) if submitted else q.where(Application.status.in_(PRE_SUBMISSION))
        a = db.scalars(q.where(Application.status != ApplicationStatus.WITHDRAWN)).first()
        return (str(a.id), a.student_user_id) if a else (None, None)


def test_preparation_shape_and_honest_rates(client):
    h = login(client, PNU, "university")
    r = client.get("/api/v1/university/preparation", headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    dv = d["documents_verified"]
    assert {"value", "numerator", "denominator", "definition"} <= set(dv)
    assert 0 <= dv["numerator"] <= dv["denominator"]
    if dv["denominator"] < d["min_denominator"]:
        assert dv["value"] is None
    rq = d["requests"]
    assert rq["answered"] + rq["open"] + rq["cancelled"] == rq["total"]
    # The turnaround median is withheld below the minimum number of answered requests.
    assert (rq["median_days_to_answer"] is None) == (rq["answered_n"] < d["min_denominator"])


def test_preparation_is_tenant_scoped(client):
    pnu = client.get("/api/v1/university/preparation", headers=login(client, PNU, "university")).json()
    skku = client.get("/api/v1/university/preparation", headers=login(client, SKKU, "university")).json()
    with SessionLocal() as db:
        from app.models import ApplicationDocument

        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        shared = db.scalar(
            select(ApplicationDocument.id)
            .join(Application, Application.id == ApplicationDocument.application_id)
            .where(Application.university_id == uid, Application.status.not_in(PRE_SUBMISSION),
                   ApplicationDocument.shared_with_university.is_(True), ApplicationDocument.document_id.is_not(None))
            .limit(1)
        )
    if shared:
        assert pnu["documents_verified"]["denominator"] > 0
    # A university user cannot pass another university's id to read its numbers: the principal's own tenant wins.
    with SessionLocal() as db:
        pnu_id = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
    forced = client.get("/api/v1/university/preparation", params={"university_id": str(pnu_id)}, headers=login(client, SKKU, "university")).json()
    assert forced == skku


def test_statements_reader_view_for_own_submitted_application(client):
    app_id, student_id = _pnu_app()
    assert app_id
    r = client.get(f"/api/v1/university/applications/{app_id}/statements", headers=login(client, ADMISSIONS, "university"))
    assert r.status_code == 200, r.text
    for s in r.json():
        assert {"essay_type", "title", "body", "words", "version"} <= set(s)
        assert s["words"] == len(s["body"].split())
    # Analysts (read-only) may read too; the read is audited when there is text.
    assert client.get(f"/api/v1/university/applications/{app_id}/statements", headers=login(client, ANALYST, "university")).status_code == 200
    if r.json():
        with SessionLocal() as db:
            assert db.scalar(select(AuditLog.id).where(AuditLog.action == "application.statements_view", AuditLog.entity_id == app_id).limit(1))


def test_statements_hidden_from_other_university(client):
    app_id, _ = _pnu_app()
    r = client.get(f"/api/v1/university/applications/{app_id}/statements", headers=login(client, SKKU, "university"))
    assert r.status_code in (403, 404)


def test_statements_require_university_console(client, student):
    app_id, _ = _pnu_app()
    assert client.get(f"/api/v1/university/applications/{app_id}/statements", headers=student).status_code == 403
