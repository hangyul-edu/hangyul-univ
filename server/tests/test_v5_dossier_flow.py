"""V5 FLOW B (backend): a university asks for a document the dossier already has → "Send your existing …" → fulfilled;
a request that needs a newer copy → the upload replaces it in place → fulfilled → the application goes back to review."""
from datetime import date, timedelta

from sqlalchemy import select

from app.models import Application, University, User
from app.seed.extra_51_dossier import text_pdf
from tests.conftest import login

THU = "student.dossier@demo.hangyul.kr"


def _pnu_app(db):
    uid = db.scalar(select(User.id).where(User.email == THU))
    pnu = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
    return db.scalar(select(Application).where(Application.student_user_id == uid, Application.university_id == pnu))


def test_flow_b_send_existing_then_newer_version(client, db, pnu_admin):
    app = _pnu_app(db)
    h = login(client, THU, "student")

    # 1 · The university asks for the TOPIK certificate — already verified in the dossier.
    r = client.post(f"/api/v1/applications/{app.id}/document-requests", headers=pnu_admin,
                    json={"label": "TOPIK certificate", "note": "Please send your TOPIK score report.", "category": "TOPIK"})
    assert r.status_code == 201, r.text
    topik_req = r.json()["id"]
    d = client.get("/api/v1/me/dossier", headers=h).json()
    sug = next(x for x in d["requests"] if x["request_id"] == topik_req)
    assert sug["action"] == "SEND_EXISTING" and sug["document"]["category"] == "TOPIK"
    pkg = client.get(f"/api/v1/applications/{app.id}/package", headers=h).json()
    assert pkg["summary"]["request"] == 1 and not pkg["summary"]["complete"]
    r = client.post(f"/api/v1/dossier/requests/{topik_req}/send-existing", headers=h, json={"document_id": sug["document"]["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "FULFILLED" and r.json()["document_id"] == sug["document"]["id"]
    # The university can now open it (shared through the request).
    assert client.get(f"/api/v1/documents/{sug['document']['id']}", headers=pnu_admin).status_code == 200

    # 2 · A fresh bank certificate: the one in the dossier is 50 days old.
    r = client.post(f"/api/v1/applications/{app.id}/document-requests", headers=pnu_admin,
                    json={"label": "Bank balance certificate", "note": "Please upload a bank certificate issued within the last 30 days.", "category": "BANK_STATEMENT"})
    bank_req = r.json()["id"]
    reuse = client.get("/api/v1/me/dossier/reuse", params={"category": "BANK_STATEMENT", "request_id": bank_req}, headers=h).json()["request"]
    assert reuse["action"] == "UPLOAD_NEWER" and reuse["max_age_days"] == 30 and reuse["status"] == "NEEDS_NEW_VERSION"
    assert "within the last 30 days" in reuse["reason"]["text"]
    bank_id = reuse["document"]["id"]
    refused = client.post(f"/api/v1/dossier/requests/{bank_req}/send-existing", headers=h, json={"document_id": bank_id})
    assert refused.status_code == 409
    # Upload replaces it (new version of the same document — no duplicate), with the new issue date.
    up = client.post("/api/v1/documents", headers=h, files={"file": ("bank_new.pdf", text_pdf(["BALANCE CERTIFICATE", f"Date of issue: {date.today():%d/%m/%Y}"]), "application/pdf")},
                     data={"category": "BANK_STATEMENT", "document_id": bank_id})
    assert up.status_code == 201 and up.json()["id"] == bank_id and up.json()["current_version"] == 2
    assert client.patch(f"/api/v1/documents/{bank_id}", headers=h, json={"issue_date": date.today().isoformat()}).status_code == 200
    ok = client.post(f"/api/v1/document-requests/{bank_req}/fulfill", headers=h, json={"document_id": bank_id})
    assert ok.status_code == 200 and ok.json()["status"] == "FULFILLED"
    client.post("/api/v1/me/dossier/reuse-decisions", headers=h, json={"category": "BANK_STATEMENT", "decision": "REPLACE", "document_id": bank_id,
                                                                         "application_id": str(app.id)})

    # 3 · Every request answered → the university re-reviews; the dossier now shows the bank certificate for Kyungpook too.
    t = client.post(f"/api/v1/applications/{app.id}/transition", headers=pnu_admin, json={"to": "UNIVERSITY_REVIEW"})
    assert t.status_code == 200, t.text
    d = client.get("/api/v1/me/dossier", headers=h).json()
    bank = next(r for r in d["rows"] if r["category"] == "BANK_STATEMENT")
    kyungpook = next(u for u in bank["applications"] if u["university"] == "Kyungpook National University")
    assert kyungpook["status"] in ("IN_REVIEW", "READY")  # the new copy is being checked — no longer "too old"
    assert not d["requests"]

    # Metrics count the reuse decision.
    H = login(client, "admin@demo.hangyul.kr", "agency")
    m = client.get("/api/v1/dossier/metrics", headers=H, params={"since": (date.today() - timedelta(days=1)).isoformat()}).json()
    assert m["duplicate_uploads_avoided"]["sent_existing"] >= 1 and m["duplicate_uploads_avoided"]["new_versions"] >= 1
    assert "n" in m["first_pass_acceptance"] and m["period"]["since"]
