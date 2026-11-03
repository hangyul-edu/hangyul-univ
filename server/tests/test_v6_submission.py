"""V6 submission: authorised-agency flow (legal basis + agency permission + student consent), connector completion,
"awaiting provider" API methods, guided self-submission details, failure / duplicate / revoked-consent edge states."""
import uuid

from sqlalchemy import select

from app.models import (
    Application,
    AuditLog,
    ConsentRecord,
    Program,
    SubmissionAgencyPermission,
    SubmissionAuthorization,
    SubmissionConnector,
    Task,
    University,
    User,
)
from app.services import submission
from tests.conftest import login
from tests.test_v5_success import ready_application

AUTHORIZE = "student.authorize@demo.hangyul.kr"
AUTHORIZED = "student.authorized@demo.hangyul.kr"
PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"


def _app_of(client, headers) -> str:
    items = client.get("/api/v1/applications?page_size=10", headers=headers).json()["items"]
    return next(a["id"] for a in items if a["status"] == "READY")


def _consent(client, headers, aid, **kw):
    return client.post(f"/api/v1/applications/{aid}/submission/authorize", headers=headers,
                       json={"accept": True, "consent_version": submission.CONSENT_VERSION, **kw})


def test_only_the_dev_fixture_may_use_authorized_agency(db):
    rows = db.scalars(select(SubmissionConnector)).all()
    agency = [r for r in rows if submission.normalize_method(r.method) == "AUTHORIZED_AGENCY"]
    assert len(agency) == 1, "only the development fixture connector allows agency submission"
    fx = agency[0]
    assert fx.agency_submission_basis == submission.FIXTURE_BASIS and fx.is_demo and fx.program_id is not None
    assert db.get(Program, fx.program_id).is_active is False, "the fixture program is never listed"
    perms = db.scalars(select(SubmissionAgencyPermission)).all()
    assert perms and all(p.is_demo and p.basis == "DEMO" and p.connector_id == fx.id for p in perms)
    # Every real (university-level) connector: research-backed, never agency submission, status sync NONE/MANUAL only.
    for r in rows:
        if r.program_id is None:
            assert r.method in ("APPLICATION_PROVIDER", "GUIDED_EXTERNAL", "MANUAL") and not r.agency_submission_basis
        assert r.status_sync in ("NONE", "MANUAL")
    knu_id = db.scalar(select(University.id).where(University.slug == "kyungpook-national-university"))
    knu = next(r for r in rows if r.university_id == knu_id and r.degree_level == "BACHELOR" and r.program_id is None)
    assert knu.portal_name == "UWAY" and knu.fee_payer == "STUDENT" and knu.official_url and knu.verified_source
    assert "never asks for" in (knu.login_requirements or "")


def test_consent_is_required_and_scoped(client, db):
    S = login(client, AUTHORIZE, "student")
    aid = _app_of(client, S)
    manager = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    counselor = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    reviewer = login(client, "reviewer@lotus.demo.hangyul.kr", "agency")
    other_counselor = login(client, "counselor2@lotus.demo.hangyul.kr", "agency")
    silk = login(client, "manager@silk.demo.hangyul.kr", "agency")
    ops = login(client, "ops@demo.hangyul.kr", "agency")

    v = client.get(f"/api/v1/applications/{aid}/submission", headers=S).json()
    assert v["connector"]["method"] == "AUTHORIZED_AGENCY" and v["can_authorize"] and not v["can_handoff"] and not v["student_can_record"]
    assert v["agency_submission"]["basis"] == submission.FIXTURE_BASIS and v["agency_submission"]["counselor"]

    # Before consent: nobody records; the queue says "awaiting the student".
    r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=manager, json={"external_reference": "FX-1"})
    assert r.status_code == 409 and "hasn't authorised" in r.text
    q = client.get("/api/v1/agency/submissions?view=all", headers=manager).json()
    assert any(i["application_id"] == aid and i["group"] == "awaiting" for i in q["items"])

    # Consent must be explicit and on the current text.
    assert client.post(f"/api/v1/applications/{aid}/submission/authorize", headers=S, json={"accept": False, "consent_version": submission.CONSENT_VERSION}).status_code == 422
    assert client.post(f"/api/v1/applications/{aid}/submission/authorize", headers=S, json={"accept": True, "consent_version": "old"}).status_code == 409
    # Staff cannot authorise for the student.
    assert _consent(client, manager, aid).status_code == 403
    r = _consent(client, S, aid)
    assert r.status_code == 200, r.text
    v = r.json()
    a = v["authorization"]
    assert a["status"] == "ACTIVE" and v["can_revoke"] and not v["can_authorize"]
    snap = a["snapshot"]
    assert snap["university"]["name_en"] == "Pusan National University" and snap["intake"]["deadline"]
    assert snap["documents"] and all(d["document_id"] and d["version"] for d in snap["documents"])
    assert snap["fee"] == {"amount": 144000, "currency": "KRW", "payee": "the university (fixture)", "payer": "STUDENT", "kind": "UNIVERSITY_APPLICATION_FEE"}
    assert snap["submitter"]["agency"].startswith("Lotus Bridge") and snap["submitter"]["counselor"]
    assert {f["key"] for f in snap["form_fields"]} >= {"full_name", "date_of_birth", "nationality", "program"}
    # Idempotent: the same authorisation comes back; one consent record, one audit row.
    assert _consent(client, S, aid).json()["authorization"]["id"] == a["id"]
    student_id = db.scalar(select(User.id).where(User.email == AUTHORIZE))
    assert db.scalar(select(ConsentRecord).where(ConsentRecord.user_id == student_id, ConsentRecord.purpose == submission.CONSENT_PURPOSE)).granted
    assert len(db.scalars(select(AuditLog).where(AuditLog.action == "submission.authorize", AuditLog.entity_id == aid)).all()) == 1
    assert db.scalar(select(Task).where(Task.dedupe_key == f"submission-agency:{aid}")).status.value == "OPEN"

    # Scope: another agency 404. V22: every admin of the student's agency sees the case and may record it (the former
    # "unassigned counselor" and "document reviewer" refusals are gone); Hangyul staff still cannot record.
    assert client.get(f"/api/v1/applications/{aid}/submission", headers=silk).status_code == 404
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=silk, json={"external_reference": "X"}).status_code == 404
    assert client.get(f"/api/v1/applications/{aid}/submission", headers=other_counselor).status_code == 200
    assert not any(i["application_id"] == aid for i in client.get("/api/v1/agency/submissions?view=all", headers=silk).json()["items"])
    rq = client.get("/api/v1/agency/submissions", headers=reviewer).json()
    assert rq["can_record"] is True and any(i["application_id"] == aid for i in rq["items"])
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=ops, json={"external_reference": "X"}).status_code == 403
    # The student never records an agency submission.
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=S, json={"external_reference": "X"}).status_code == 403
    assert client.post(f"/api/v1/applications/{aid}/submission/handoff", headers=S).status_code == 409

    # Final review for the agency; the reference is required on the agency path.
    av = client.get(f"/api/v1/applications/{aid}/submission", headers=counselor).json()
    assert {i["code"] for i in av["final_review"]} >= {"CONSENT", "DOCUMENTS", "ESSAYS", "PACKAGE_UNCHANGED", "DEADLINE", "FEE"}
    assert all(i["ok"] for i in av["final_review"])
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=counselor, json={}).status_code == 422

    # Failure is recorded and shown; nothing moves.
    r = client.post(f"/api/v1/applications/{aid}/submission/failure", headers=counselor, json={"reason": "Card payment declined on the portal"})
    assert r.status_code == 200 and r.json()["record"]["failure"]["reason"].startswith("Card payment")
    assert client.get(f"/api/v1/applications/{aid}", headers=S).json()["status"] == "READY"
    assert client.get(f"/api/v1/applications/{aid}/submission", headers=S).json()["record"]["failure"]

    # Record: reference + receipt (uploaded on the student's behalf into their vault).
    up = client.post("/api/v1/documents", headers=counselor, data={"category": "OTHER", "title": "Application receipt", "student_user_id": str(student_id)},
                     files={"file": ("receipt.pdf", PDF, "application/pdf")})
    assert up.status_code in (200, 201), up.text
    rid = up.json()["id"]
    r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=counselor,
                    json={"external_reference": "FX-2027-0001", "receipt_document_id": rid, "fee_status": "CONFIRMED"})
    assert r.status_code == 200, r.text
    rec = r.json()["record"]
    assert r.json()["status"] == "SUBMITTED_CONFIRMED" and rec["evidence_kind"] == "CONFIRMATION_AND_RECEIPT" and rec["failure"] is None
    assert rec["recorded_by_role"] == "AGENCY" and rec["recorded_by_org"].startswith("Lotus Bridge")
    assert client.get(f"/api/v1/applications/{aid}", headers=S).json()["status"] == "SUBMITTED"
    auth = db.scalar(select(SubmissionAuthorization).where(SubmissionAuthorization.application_id == uuid.UUID(aid)))
    db.refresh(auth)
    assert auth.status == "USED" and auth.used_at
    assert db.scalar(select(Task).where(Task.dedupe_key == f"submission-agency:{aid}")).status.value == "DONE"
    # Duplicate action: same reference → unchanged, no second record audit; a different reference → 409.
    n = len(db.scalars(select(AuditLog).where(AuditLog.action == "submission.record", AuditLog.entity_id == str(auth.application_id))).all())
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=counselor, json={"external_reference": "FX-2027-0001"}).status_code == 200
    assert len(db.scalars(select(AuditLog).where(AuditLog.action == "submission.record", AuditLog.entity_id == str(auth.application_id))).all()) == n
    assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=counselor, json={"external_reference": "FX-OTHER"}).status_code == 409
    # Consent can't be withdrawn after submission. The student sees who submitted and the receipt.
    assert client.post(f"/api/v1/applications/{aid}/submission/authorization/revoke", headers=S, json={}).status_code == 409
    sv = client.get(f"/api/v1/applications/{aid}/submission", headers=S).json()
    assert sv["record"]["external_reference"] == "FX-2027-0001" and sv["record"]["receipt"]["id"] == rid and sv["record"]["recorded_by"]["full_name"]
    # The university sees method, reference and date only.
    u = client.get(f"/api/v1/applications/{aid}/submission", headers=login(client, "admin@pusan.univ.demo.hangyul.kr", "university")).json()
    assert u["method"] == "AUTHORIZED_AGENCY" and u["record"]["external_reference"] == "FX-2027-0001" and "fee" not in u["record"]
    q = client.get("/api/v1/agency/submissions?view=submitted", headers=manager).json()
    assert any(i["application_id"] == aid and i["external_reference"] == "FX-2027-0001" for i in q["items"])


def test_revoked_consent_blocks_and_can_be_given_again(client, db):
    S = login(client, AUTHORIZED, "student")
    aid = _app_of(client, S)
    counselor = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    v = client.get(f"/api/v1/applications/{aid}/submission", headers=S).json()
    assert v["authorization"]["status"] == "ACTIVE", "seeded persona has authorised"
    r = client.post(f"/api/v1/applications/{aid}/submission/authorization/revoke", headers=S, json={"reason": "I want to check my statement again"})
    assert r.status_code == 200 and r.json()["authorization"]["status"] == "REVOKED" and r.json()["can_authorize"]
    # Idempotent revoke.
    assert client.post(f"/api/v1/applications/{aid}/submission/authorization/revoke", headers=S, json={}).status_code == 200
    r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=counselor, json={"external_reference": "FX-9"})
    assert r.status_code == 409 and "withdrew consent" in r.text
    assert client.post(f"/api/v1/applications/{aid}/submission/failure", headers=counselor, json={"reason": "x x x"}).status_code == 409
    assert db.scalar(select(Task).where(Task.dedupe_key == f"submission-agency:{aid}")).status.value == "CANCELLED"
    student_id = db.scalar(select(User.id).where(User.email == AUTHORIZED))
    assert any(not c.granted for c in db.scalars(select(ConsentRecord).where(ConsentRecord.user_id == student_id, ConsentRecord.purpose == submission.CONSENT_PURPOSE)))
    assert db.scalar(select(AuditLog).where(AuditLog.action == "submission.revoke"))
    # Consent again → a new ACTIVE authorisation; the queue shows it as ready.
    r = _consent(client, S, aid)
    assert r.status_code == 200 and r.json()["authorization"]["status"] == "ACTIVE"
    assert len(db.scalars(select(SubmissionAuthorization).where(SubmissionAuthorization.student_user_id == student_id)).all()) == 2
    q = client.get("/api/v1/agency/submissions", headers=counselor).json()
    assert any(i["application_id"] == aid and i["group"] == "ready" and i["authorized_at"] for i in q["items"])


def test_api_methods_await_provider_and_alias_without_basis_is_guided(client, db):
    nepal = login(client, "student.nepal@demo.hangyul.kr", "student")
    himalaya = login(client, "counselor@himalaya.demo.hangyul.kr", "agency")
    with ready_application(db, "Business Administration (BBA)", method="DIRECT_API") as app:
        aid = str(app.id)
        v = client.get(f"/api/v1/applications/{aid}/submission", headers=nepal).json()
        assert v["integration_state"] == "AWAITING_PROVIDER" and v["connector"]["integration"] == "AWAITING_PROVIDER"
        assert not v["can_handoff"] and not v["can_authorize"] and v["counselor_submits"]
        r = client.post(f"/api/v1/applications/{aid}/submission/api-submit", headers=himalaya)
        assert r.status_code == 409 and "AWAITING_PROVIDER" in r.text
    with ready_application(db, "Business Administration (BBA)", method="AGENCY_ASSISTED") as app:
        aid = str(app.id)
        v = client.get(f"/api/v1/applications/{aid}/submission", headers=nepal).json()
        # Old value is read as AUTHORIZED_AGENCY, but with no legal basis on record the student submits personally.
        assert v["connector"]["configured_method"] == "AUTHORIZED_AGENCY" and v["connector"]["method"] == "GUIDED_EXTERNAL"
        assert v["agency_submission"]["unavailable_reason"] == "NO_BASIS" and v["can_handoff"] and not v["can_authorize"]
        assert _consent(client, nepal, aid).status_code == 409


def test_guided_details_and_production_guard(client, db, monkeypatch):
    nepal = login(client, "student.nepal@demo.hangyul.kr", "student")
    with ready_application(db, "Business Administration (BBA)") as app:
        v = client.get(f"/api/v1/applications/{app.id}/submission", headers=nepal).json()
        g = v["guided"]
        assert g["self_submit_required"] and g["steps"][0] == "open_portal" and g["minutes"] and g["files"]
        assert all(f["ready"] for f in g["files"]) and any(f["key"] == "passport" and "•" in f["value"] for f in g["form_fields"])
        assert "store_portal_password" in v["never"] and "bypass_mfa_or_captcha" in v["never"]
    # In production the development fixture never authorises an agency (and the dev endpoint does not exist).
    from app.seed.extra_60_submission_v6 import FIXTURE_PROGRAM
    # Looked up by the seed's own constant, not by a literal: V12 renamed the fixture to an ordinary
    # programme name so it stops announcing the development environment in agency and student screens.
    fx_app = db.scalar(select(Application).join(Program, Program.id == Application.program_id)
                       .where(Program.name_en == FIXTURE_PROGRAM))
    assert submission.connector_for(db, fx_app).method == "AUTHORIZED_AGENCY"
    monkeypatch.setattr(submission, "_production", lambda: True)
    assert submission.connector_for(db, fx_app).method == "GUIDED_EXTERNAL"
    assert client.post("/api/v1/dev/submission-fixture/application", headers=nepal).status_code == 404
    from app.seed import extra_60_submission_v6 as seed60

    monkeypatch.setattr(seed60, "_production", lambda: True)
    assert seed60.apply(db) == {"skipped": "production"}
