"""V5 admission success: strategy items, portfolio, submission evidence rules, tenant isolation."""
from contextlib import contextmanager
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models import (
    Application,
    ApplicationStatusHistory,
    ApplicationSubmission,
    Essay,
    Program,
    StudentProfile,
    SubmissionConnector,
    Task,
    University,
    User,
)
from app.models.base import utcnow
from app.models.enums import ApplicationStatus as S
from app.models.enums import EssayStatus, EssayType
from app.services import strategy, submission
from tests.conftest import login

FORBIDDEN_KEYS = {"score", "percent", "probability", "readiness_percent", "chance"}


def _walk_keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _walk_keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_keys(v)


@pytest.fixture(scope="module")
def nepal(client):
    return login(client, "student.nepal@demo.hangyul.kr", "student")


@pytest.fixture(scope="module")
def himalaya(client):
    return login(client, "counselor@himalaya.demo.hangyul.kr", "agency")


@contextmanager
def ready_application(db, program_name: str, *, slug: str = "kyungpook-national-university", intake_index: int = 0, method: str | None = None):
    """A throwaway READY application for the Nepal persona (her vault is fully verified), removed afterwards so the
    seeded persona stays exactly as FLOW A expects."""
    u = db.scalar(select(User).where(User.email == "student.nepal@demo.hangyul.kr"))
    uni = db.scalar(select(University).where(University.slug == slug))
    prog = db.scalar(select(Program).where(Program.university_id == uni.id, Program.name_en == program_name))
    taken = set(db.scalars(select(Application.intake_id).where(Application.student_user_id == u.id)))
    intakes = [i for i in sorted(prog.intakes, key=lambda i: i.application_deadline) if i.is_open and i.id not in taken]
    intake = intakes[intake_index]
    app = Application(student_user_id=u.id, program_id=prog.id, intake_id=intake.id, university_id=uni.id, status=S.READY, is_demo=True,
                      agency_org_id=db.scalar(select(Application.agency_org_id).where(Application.student_user_id == u.id).limit(1)))
    db.add(app)
    db.flush()
    db.add(ApplicationStatusHistory(application_id=app.id, from_status=None, to_status=S.READY, created_at=utcnow()))
    for et in (EssayType.PERSONAL_STATEMENT, EssayType.STUDY_PLAN):
        db.add(Essay(owner_user_id=u.id, application_id=app.id, program_id=prog.id, essay_type=et, title=f"{et.value} test", status=EssayStatus.APPROVED))
    conn = None
    if method:
        conn = SubmissionConnector(university_id=uni.id, program_id=prog.id, method=method, verification_status="SAMPLE", is_demo=True)
        db.add(conn)
    db.commit()
    try:
        yield app
    finally:
        db.rollback()
        for t in db.scalars(select(Task).where(Task.application_id == app.id)):
            db.delete(t)
        for e in db.scalars(select(Essay).where(Essay.application_id == app.id)):
            db.delete(e)
        db.delete(db.get(Application, app.id))
        if conn is not None:
            db.delete(db.get(SubmissionConnector, conn.id))
        db.commit()


# --------------------------------------------------------------------------------------------------------- strategy


def test_lan_transcript_fix_is_a_blocker(client, student):
    r = client.get("/api/v1/me/strategy", headers=student)
    assert r.status_code == 200
    body = r.json()
    assert not (FORBIDDEN_KEYS & set(_walk_keys(body))), "strategy must never carry a score, percentage or probability"
    prep = [s for s in body["items"] if s["scope"] == "prep"]
    assert prep, "Lan is preparing applications"
    for s in prep:
        fix = [i for i in s["items"] if i["code"] == "DOC_FIX"]
        assert fix and fix[0]["severity"] == "blocker" and fix[0]["owner"] == "student"
        assert fix[0]["params"]["category"] == "TRANSCRIPT"
        assert s["state"] == "BLOCKED"
        assert s["blocked_by"]["code"] in {"DOC_FIX", "REQUEST_OPEN", "DEADLINE_PASSED"}
        # Ordered: blockers, then improvements, then context.
        ranks = [strategy.SEVERITY_RANK[i["severity"]] for i in s["items"]]
        assert ranks == sorted(ranks)
        for i in s["items"]:
            assert i["title"] and i["owner"] in {"student", "counselor", "university"}
    # Today: at most three student-owned things, the transcript correction first (counted once across applications).
    today = body["today"]
    assert 1 <= len(today) <= 3
    assert today[0]["code"] == "DOC_FIX" and all(t["owner"] == "student" for t in today)
    assert sum(1 for t in today if t["code"] == "DOC_FIX") == 1


def test_ha_with_offers_has_nothing_to_improve(client):
    ha = login(client, "student.offer@demo.hangyul.kr", "student")
    body = client.get("/api/v1/me/strategy", headers=ha).json()
    assert body["items"]
    for s in body["items"]:
        assert s["items"] == [] and s["state"] == "READY"
    assert body["today"] == []


def test_ready_persona_is_ready_and_university_cannot_read_strategy(client, nepal, db):
    body = client.get("/api/v1/me/strategy", headers=nepal).json()
    ready = [s for s in body["items"] if s["status"] == "READY"]
    assert ready and ready[0]["counts"]["blocker"] == 0
    app_id = ready[0]["application_id"]
    pnu = login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
    assert client.get(f"/api/v1/applications/{app_id}/strategy", headers=pnu).status_code == 404
    assert client.get(f"/api/v1/applications/{app_id}/submission", headers=pnu).status_code == 404
    # Home hook: the hand-off is the first thing to do today.
    assert body["today"][0]["code"] == "SUBMISSION_HANDOFF"


def test_sample_recommendation_is_labelled(db):
    # A TOPIK-3 student applying to a program with a SAMPLE recommendation of 4 sees an improvement flagged as sample data.
    from app.models import LanguageRecommendation

    rec = db.scalars(select(LanguageRecommendation)).first()
    assert rec is not None and rec.basis == "SAMPLE" and rec.is_demo
    prog = db.get(Program, rec.program_id)
    prof = db.scalar(select(StudentProfile).join(User, User.id == StudentProfile.user_id).where(User.email == "student.nepal@demo.hangyul.kr"))
    m = strategy._match(db, prof, prog, db.get(University, prog.university_id), sorted(prog.intakes, key=lambda i: i.application_deadline)[-1], utcnow().date())
    items, _fit = strategy._eligibility_items(m, prof, prog, strategy._links("student", Application(id=None)), rec)
    lr = next(i for i in items if i["code"] == "LANGUAGE_RECOMMENDED")
    assert lr["sample"] is True and lr["severity"] == "improve" and lr["params"] == {"have": 3, "min": 3, "recommended": 4, "basis": "SAMPLE"}


def test_essay_hook_adds_items(db, monkeypatch):
    monkeypatch.setattr(strategy, "_ESSAY_HOOKS", [])

    @strategy.register_essay_hook
    def gate(_db, essay):
        return [{"code": "ESSAY_QUALITY_GATE", "severity": "improve", "title": "Quality gate", "owner": "counselor"}] if essay.essay_type == EssayType.STUDY_PLAN else []

    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    app = db.scalars(select(Application).where(Application.student_user_id == lan.id, Application.status.in_([S.DRAFT, S.DOCUMENT_PREPARATION]))).first()
    if not db.scalar(select(Essay.id).where(Essay.application_id == app.id, Essay.essay_type == EssayType.STUDY_PLAN)):
        pytest.skip("no study plan on this application")
    out = strategy.application_strategy(db, app)
    assert any(i["code"] == "ESSAY_QUALITY_GATE" for i in out["items"])


# -------------------------------------------------------------------------------------------------------- portfolio


def test_portfolio_shape_and_tenant_isolation(client, student, lotus_counselor, silk_manager, db):
    p = client.get("/api/v1/me/portfolio", headers=student).json()
    assert {"entries", "groups", "observations", "questions", "budget", "review"} <= set(p)
    assert not ({"score", "probability"} & set(_walk_keys(p)))
    assert {e["group"] for e in p["entries"]} <= {"strong", "possible", "not_yet"}
    assert [q["key"] for q in p["questions"]] == ["too_few", "too_difficult", "unnecessary", "deadlines", "budget", "realistic_option"]
    assert p["review"] and p["review"]["decision"] == "SPREAD_DEADLINES"
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    assert client.get(f"/api/v1/agency/students/{lan.id}/portfolio", headers=lotus_counselor).status_code == 200
    assert client.get(f"/api/v1/agency/students/{lan.id}/portfolio", headers=silk_manager).status_code == 404
    assert client.post(f"/api/v1/agency/students/{lan.id}/portfolio/review", headers=silk_manager, json={"decision": "BALANCED"}).status_code == 404
    assert client.get(f"/api/v1/agency/students/{lan.id}/strategy", headers=silk_manager).status_code == 404
    r = client.post(f"/api/v1/agency/students/{lan.id}/portfolio/review", headers=lotus_counselor, json={"decision": "ADD_OPTION", "note": "Add one Strong match."})
    assert r.status_code == 201
    rev = r.json()["review"]
    assert rev["decision"] == "ADD_OPTION" and rev["note"] == "Add one Strong match." and rev["reviewed_by"] and rev["reviewed_at"]
    assert rev["stale"] is False
    assert client.post(f"/api/v1/agency/students/{lan.id}/portfolio/review", headers=lotus_counselor, json={"decision": "PICK_FOR_THEM"}).status_code == 422


def test_portfolio_observations(db, monkeypatch):
    """Deadline concentration, all-Possible and budget observations, computed from the entries (decision support only)."""
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    today = utcnow().date()
    day = today + timedelta(days=20)
    budget = db.scalar(select(StudentProfile.annual_budget_krw).where(StudentProfile.user_id == lan.id))

    def fake_entry(_db, _profile, program, _intake, _today, *, source, app):
        return {"source": source, "application_id": str(app.id) if app else None, "status": app.status.value if app else None,
                "program": {"id": str(program.id), "name_en": program.name_en}, "university": {"id": "u", "name_en": "Uni", "slug": "u"},
                "tier": "COMPETITIVE", "group": "possible", "deadline": day.isoformat(), "pre_submission": True,
                "first_year": {"low": budget + 1_000_000, "high": budget + 5_000_000, "basis": "SAMPLE"}}

    monkeypatch.setattr(strategy, "_entry", fake_entry)
    out = strategy.portfolio(db, lan.id, today)
    codes = {o["code"] for o in out["observations"]}
    n = out["groups"]["possible"]
    assert n >= 2
    assert "ALL_POSSIBLE" in codes and "SAME_DAY_DEADLINES" in codes and "ALL_OVER_BUDGET" in codes
    if n >= strategy.CONCENTRATION_MIN:
        assert "DEADLINES_CONCENTRATED" in codes and out["deadline_cluster"]["count"] == n
    q = {x["key"]: x["flag"] for x in out["questions"]}
    assert q["too_difficult"] and q["deadlines"] and q["budget"] and q["realistic_option"]
    # Never an automatic choice: observations describe, the response has no "recommended" pick.
    assert "recommended" not in set(_walk_keys(out))


# ------------------------------------------------------------------------------------------------------- submission


def test_guided_submission_requires_evidence(client, nepal, db):
    with ready_application(db, "Computer Science and Engineering", slug="pusan-national-university") as app:
        aid = str(app.id)
        view = client.get(f"/api/v1/applications/{aid}/submission", headers=nepal).json()
        assert view["status"] == "READY_FOR_HANDOFF" and view["can_handoff"] and view["connector"]["method"] in submission.STUDENT_HANDOFF
        assert view["checklist"]["complete"] is True
        assert "password" not in str(view).lower() or "store_portal_password" in view["never"]
        # A student can never jump to SUBMITTED through the generic transition.
        assert client.post(f"/api/v1/applications/{aid}/transition", headers=nepal, json={"to": "SUBMITTED"}).status_code == 409
        # Hand-off: remembered, and a task asks for the confirmation.
        r = client.post(f"/api/v1/applications/{aid}/submission/handoff", headers=nepal)
        assert r.status_code == 200 and r.json()["status"] == "HANDED_OFF"
        db.expire_all()
        assert db.scalar(select(Task).where(Task.dedupe_key == f"submission-confirm:{aid}")).status.value == "OPEN"
        # "I submitted" without evidence: recorded as unconfirmed, the application does not move.
        r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=nepal, json={"fee_status": "PAID"})
        assert r.status_code == 200 and r.json()["status"] == "SUBMITTED_UNCONFIRMED"
        assert client.get(f"/api/v1/applications/{aid}", headers=nepal).json()["status"] == "READY"
        s = client.get(f"/api/v1/applications/{aid}/strategy", headers=nepal).json()
        assert any(i["code"] == "SUBMISSION_CONFIRM" for i in s["items"])
        # Students cannot confirm the fee themselves; the counselor does.
        assert client.post(f"/api/v1/applications/{aid}/submission/fee", headers=nepal, json={"status": "CONFIRMED"}).status_code == 403
        # Future dates are refused.
        future = (utcnow().date() + timedelta(days=3)).isoformat()
        assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=nepal, json={"external_reference": "X", "submitted_on": future}).status_code == 422
        # With a confirmation number: confirmed, and only now the state machine moves READY → SUBMITTED.
        today = utcnow().date().isoformat()
        r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=nepal, json={"external_reference": "PNU-2027-00123", "submitted_on": today})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "SUBMITTED_CONFIRMED" and body["record"]["evidence_kind"] == "CONFIRMATION_ID"
        assert body["record"]["fee"]["status"] == "PAID"
        detail = client.get(f"/api/v1/applications/{aid}", headers=nepal).json()
        assert detail["status"] == "SUBMITTED" and detail["history"][-1]["to"] == "SUBMITTED" and detail["external_reference"] == "PNU-2027-00123"
        db.expire_all()
        assert db.scalar(select(Task).where(Task.dedupe_key == f"submission-confirm:{aid}")).status.value == "DONE"
        rec = db.scalar(select(ApplicationSubmission).where(ApplicationSubmission.application_id == app.id))
        assert rec.completeness_at_submission == 1.0 and rec.recorded_by_role == "STUDENT"
        # The university now sees the evidence (method, reference, date) — and nothing else from the record.
        pnu = login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
        u = client.get(f"/api/v1/applications/{aid}/submission", headers=pnu).json()
        assert client.get(f"/api/v1/applications/{aid}/strategy", headers=pnu).status_code == 404
        assert u["record"]["external_reference"] == "PNU-2027-00123" and u["record"]["submitted_on"] == today
        assert "fee" not in u["record"] and "note" not in u["record"]
        # Other agencies and other universities: 404.
        silk = login(client, "manager@silk.demo.hangyul.kr", "agency")
        assert client.get(f"/api/v1/applications/{aid}/submission", headers=silk).status_code == 404
        assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=silk, json={"external_reference": "x"}).status_code == 404
        skku = login(client, "admin@sungkyunkwan.univ.demo.hangyul.kr", "university")
        assert client.get(f"/api/v1/applications/{aid}/submission", headers=skku).status_code == 404


def test_agency_assisted_submission(client, nepal, himalaya, db):
    # V6: AGENCY_ASSISTED became AUTHORIZED_AGENCY, which needs a legal basis + student consent (test_v6_submission.py).
    # A counselor-recorded submission without consent remains for API methods, where nothing can be submitted by Hangyul
    # ("awaiting provider integration") and the counselor only records the evidence of the real submission.
    with ready_application(db, "Business Administration (BBA)", method="PARTNER_API") as app:
        aid = str(app.id)
        view = client.get(f"/api/v1/applications/{aid}/submission", headers=nepal).json()
        assert view["counselor_submits"] and not view["can_handoff"] and not view["student_can_record"]
        assert client.post(f"/api/v1/applications/{aid}/submission/handoff", headers=nepal).status_code == 409
        assert client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=nepal, json={"external_reference": "X1"}).status_code == 403
        r = client.post(f"/api/v1/applications/{aid}/submission/confirm", headers=himalaya, json={"external_reference": "KNU-AG-777", "fee_status": "CONFIRMED"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "SUBMITTED_CONFIRMED" and r.json()["record"]["recorded_by_role"] == "AGENCY"
        assert client.get(f"/api/v1/applications/{aid}", headers=himalaya).json()["status"] == "SUBMITTED"


def test_connector_rules(db):
    with pytest.raises(submission.NotConfigured):
        submission.DirectApiConnector(row=None, method="DIRECT_API").submit(None)
    assert submission.evidence_kind(None, None) == "NONE"
    assert submission.evidence_kind("  ", None) == "NONE"
    assert submission.evidence_kind("A1", None) == "CONFIRMATION_ID"
    uni = db.scalar(select(University).where(University.slug == "kyungpook-national-university"))
    rows = submission.connector_rows_from_research({
        "slug": uni.slug, "submission_method": "DIRECT_API", "portal_url": "https://example.org/apply", "provider": "Own portal",
        "application_fee": {"amount": "60,000", "currency": "KRW", "payee": "University"}, "source_url": "https://example.org/guide",
        "last_verified": "2026-09-20", "verification_status": "verified", "documents_accepted": "online upload and mail",
        "variants": [{"degree_level": "MASTER", "submission_method": "application provider", "provider": "Provider X"}],
    }, uni)
    base, master = rows
    assert base["method"] == "GUIDED_EXTERNAL", "no official API is claimed from research text"
    assert base["fee_amount"] == 60000 and base["verification_status"] == "VERIFIED" and base["documents_accepted"] == "BOTH"
    assert master["degree_level"] == "MASTER" and master["method"] == "APPLICATION_PROVIDER"
    # The research file's shape: one entry per university and level; uncovered degrees get a NEEDS_REVIEW placeholder.
    rows = submission.connector_rows_from_research([
        {"slug": uni.slug, "level": "UNDERGRADUATE", "method": "APPLICATION_PROVIDER", "provider": "UWAY", "portal_url": "https://example.org/u",
         "fee": {"amount": 80000, "currency": "KRW"}, "documents_upload": "ONLINE", "confirmation": "Application number on payment",
         "sources": [{"url": "https://example.org/guide", "verified_at": "2026-09-29"}], "verification_status": "VERIFIED"},
        {"slug": uni.slug, "level": "GRADUATE", "method": "APPLICATION_PROVIDER", "provider": "UWAY", "fee": {"amount": None},
         "sources": [{"url": "https://example.org/g", "verified_at": "2026-09-29"}], "verification_status": "PARTIAL"},
    ], uni)
    by = {r.get("degree_level"): r for r in rows}
    assert by["BACHELOR"]["fee_amount"] == 80000 and by["BACHELOR"]["verification_status"] == "VERIFIED" and by["BACHELOR"]["last_verified"].isoformat() == "2026-09-29"
    assert by["BACHELOR"]["confirmation_method"] == "Application number on payment" and by["BACHELOR"]["documents_accepted"] == "ONLINE"
    assert by["MASTER"]["verification_status"] == "PARTIAL" and by["MASTER"]["fee_amount"] is None
    assert by[None]["verification_status"] == "NEEDS_REVIEW" and by[None]["instructions"] == submission.PLACEHOLDER_NOTE  # LANGUAGE not covered
    # Every catalogued university has a connector row (research-backed or a NEEDS_REVIEW placeholder that says so).
    for u in db.scalars(select(University)):
        rows = db.scalars(select(SubmissionConnector).where(SubmissionConnector.university_id == u.id, SubmissionConnector.program_id.is_(None))).all()
        assert rows
        for r in rows:
            assert r.method != "DIRECT_API"
            if r.verification_status == "NEEDS_REVIEW":
                assert r.instructions == submission.PLACEHOLDER_NOTE or r.source_url is None or r.instructions


def test_success_metrics_definitions(db, client, lotus_counselor):
    m = strategy.success_metrics(db, None, None)
    for k in ("time_to_ready_days", "completeness_at_submission", "submissions_with_evidence", "missed_deadlines"):
        assert m[k]["definition"] and "n" in m[k]
    small = strategy.success_metrics(db, None, "2031-SPRING")
    assert small["time_to_ready_days"]["median"] is None and small["time_to_ready_days"]["n"] < strategy.MIN_COHORT
    r = client.get("/api/v1/success/metrics", headers=lotus_counselor)
    assert r.status_code == 200 and r.json()["scope"]["organization_id"]
