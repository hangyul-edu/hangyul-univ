"""V5 writing review: prompts by intake, fact verification, quality gate, reviewer matching + override audit,
SLA escalation, tenant isolation, internal notes, and the application using the approved version."""
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models import AuditLog, Essay, EssayReview, Organization, OrganizationMember, Program, Task, University, User, WritingPrompt
from app.models.base import utcnow
from app.services import writing as W
from tests.conftest import login
from tests.v22_helpers import register_student

API = "/api/v1"
ESSAY = ("I graduated in 2024 from high school in Hanoi. I chose the Business Administration (BBA) program at Kyungpook National University "
         "because I want to learn how family companies grow. My academic background is in economics classes, where I studied how markets work. "
         "I also visited Yonsei University last summer. During my studies I plan to take marketing courses, and after graduation my career plan "
         "is to work for a Korean company in Vietnam.")


@pytest.fixture(scope="module")
def mdb():
    from app.core.db import SessionLocal

    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture(scope="module")
def case(client, mdb):
    """A new Vietnamese student with Lotus Bridge (paid service) and a Kyungpook BBA application for 2027 Spring."""
    reg = register_student(client, email=f"writing-{uuid.uuid4().hex[:6]}@example.com", full_name="Mai Writing Test", locale="vi", nationality="VN")
    email, S = reg["email"], reg["h"]
    client.patch(f"{API}/me/profile", headers=S, json={"residence_country": "VN", "date_of_birth": "2008-03-01", "target_degree": "BACHELOR",
                                                       "target_intake_year": 2027, "target_intake_term": "SPRING", "desired_fields": ["business"]})
    client.post(f"{API}/me/educations", headers=S, json={"level": "HIGH_SCHOOL", "institution": "Hanoi High School", "country": "VN",
                                                         "graduation_year": 2027, "graduation_status": "EXPECTED", "gpa_value": 8.1, "gpa_scale_max": 10})
    o = client.post(f"{API}/me/orders", headers=S, json={"product_code": "PREMIUM"}).json()
    assert "Lotus" in o["assignment"]["organization"]
    knu = mdb.scalar(select(University).where(University.slug == "kyungpook-national-university"))
    prog = mdb.scalar(select(Program).where(Program.university_id == knu.id, Program.name_en.like("Business%")))
    app = client.post(f"{API}/applications", headers=S, json={"program_id": str(prog.id)})
    assert app.status_code == 201, app.text
    app_id = app.json()["id"]
    essay = next(e for e in client.get(f"{API}/essays", headers=S).json()["items"] if e["application_id"] == app_id and e["essay_type"] == "PERSONAL_STATEMENT")
    counselor = None
    for who in ("counselor@lotus.demo.hangyul.kr", "counselor2@lotus.demo.hangyul.kr"):
        h = login(client, who, "agency")
        if client.get(f"{API}/essays/{essay['id']}", headers=h).status_code == 200:
            counselor = h
            break
    assert counselor
    user = mdb.scalar(select(User).where(User.email == email))
    return {"S": S, "A": counselor, "M": login(client, "manager@lotus.demo.hangyul.kr", "agency"), "essay_id": essay["id"], "app_id": app_id,
            "program_id": str(prog.id), "university_id": str(knu.id), "user_id": user.id}


def test_prompt_is_the_version_for_the_intake(client, db, case):
    e = client.get(f"{API}/essays/{case['essay_id']}", headers=case["S"]).json()
    w = e["writing"]
    assert w["prompt_status"] == "LINKED" and w["prompt"]["verification_status"] == "SAMPLE" and w["prompt"]["source_url"] is None
    assert w["context"]["intake"]["year"] == 2027 and w["context"]["university"]["name"] == "Kyungpook National University"
    # Pusan BBA: 2026 Fall uses v1, 2027 Spring uses v2 (which superseded v1 for later intakes).
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    prog = db.scalar(select(Program).where(Program.university_id == pnu.id, Program.name_en.like("Business%")))
    kw = dict(university_id=pnu.id, program_id=prog.id, essay_type="PERSONAL_STATEMENT")
    fall26 = W.resolve_prompt(db, intake_year=2026, intake_term="FALL", **kw)
    spring27 = W.resolve_prompt(db, intake_year=2027, intake_term="SPRING", **kw)
    assert fall26.version == 1 and spring27.version == 2 and fall26.superseded_by_id == spring27.id and fall26.prompt_text != spring27.prompt_text
    assert W.resolve_prompt(db, intake_year=2025, intake_term="FALL", **kw) is None  # no prompt known before 2026 Fall


def test_reviewer_enters_a_new_prompt_version_for_a_later_intake(client, case):
    body = {"university_id": case["university_id"], "program_id": case["program_id"], "essay_type": "STUDY_PLAN", "effective_from_year": 2027,
            "effective_from_term": "FALL", "prompt_text": "Write your study plan for four years at Kyungpook, including Korean language goals.", "word_limit": 1200}
    r = client.post(f"{API}/writing/prompts", headers=case["A"], json=body)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["verification_status"] == "COUNSELOR_ENTERED" and p["version"] >= 1 and p["entered_by_org"].startswith("Lotus")
    # A counselor cannot claim a prompt is verified.
    r = client.post(f"{API}/writing/prompts", headers=case["A"], json={**body, "verification_status": "VERIFIED", "source_url": "https://example.org"})
    assert r.status_code == 422


def test_submit_runs_checks_assigns_a_reviewer_and_starts_the_sla(client, db, case):
    S = case["S"]
    r = client.put(f"{API}/essays/{case['essay_id']}", headers=S, json={"body": ESSAY})
    assert r.status_code == 200
    e = client.post(f"{API}/essays/{case['essay_id']}/status", headers=S, json={"status": "SUBMITTED"}).json()
    assert e["status"] == "AGENCY_REVIEW" and e["reviewer"]
    w = e["writing"]
    assert w["review"]["round"] == 1 and w["review"]["expected_review_by"]
    assert w["status_line"]["code"] == "REVIEWING" and w["status_line"]["reviewer"]["name"] == e["reviewer"]["full_name"]
    codes = {f["code"] for f in w["findings"] if f["status"] == "OPEN"}
    assert {"FACT_GRAD_YEAR", "OTHER_UNIVERSITY"} <= codes
    fact = next(f for f in w["findings"] if f["code"] == "FACT_GRAD_YEAR")
    assert fact["quote"] == "I graduated in 2024 from high school in Hanoi." and fact["params"]["profile_year"] == 2027
    assert fact["source"] == "AUTOMATIC_CHECK"
    # Never auto-changed: same text, no new version from the checks.
    assert e["body"] == ESSAY and e["current_version"] == 2
    rev = db.scalar(select(EssayReview).where(EssayReview.essay_id == uuid.UUID(case["essay_id"])))
    db.refresh(rev)
    assert rev.assigned_by == "ENGINE" and rev.assignment_reasons is not None
    assert (rev.expected_review_by - rev.submitted_at) == timedelta(hours=48)
    # Students see no rubric, no assignment reasons.
    assert "rubric" not in w and "assignment_reasons" not in w["review"]


def test_quality_gate_blocks_approval_and_override_needs_a_reason(client, case):
    A = case["A"]
    e = client.get(f"{API}/essays/{case['essay_id']}", headers=A).json()
    gate = e["writing"]["gate"]
    assert {"PROFILE_CONSISTENCY", "NAMES"} <= set(gate["blockers"]) and not gate["can_approve"]
    assert all("percent" not in i and "score" not in i for i in gate["items"])
    r = client.post(f"{API}/essays/{case['essay_id']}/status", headers=A, json={"status": "APPROVED"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "QUALITY_GATE"
    # V22: every admin of the agency may override, but only with a recorded reason of substance; the student never approves.
    r = client.post(f"{API}/essays/{case['essay_id']}/status", headers=A, json={"status": "APPROVED", "override_reason": "ok"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "QUALITY_GATE"
    assert client.post(f"{API}/essays/{case['essay_id']}/status", headers=case["S"],
                       json={"status": "APPROVED", "override_reason": "Deadline tomorrow, student confirmed"}).status_code == 409
    assert client.get(f"{API}/essays/{case['essay_id']}", headers=A).json()["status"] == "AGENCY_REVIEW"


def test_student_never_sees_internal_notes_or_staff_only_data(client, case):
    A, S = case["A"], case["S"]
    assert client.post(f"{API}/essays/{case['essay_id']}/comments", headers=A, json={"body": "Internal: check the TOPIK plan with the manager", "internal": True}).status_code == 201
    staff = client.get(f"{API}/essays/{case['essay_id']}", headers=A).json()
    mine = client.get(f"{API}/essays/{case['essay_id']}", headers=S).json()
    assert any(c["visibility"] == "INTERNAL" for c in staff["comments"])
    assert not any(c["visibility"] == "INTERNAL" or "Internal:" in c["body"] for c in mine["comments"])
    assert all(not f["staff_only"] for f in mine["writing"]["findings"])
    assert mine["writing"]["gate"] is None  # the student sees the gate once the essay is in final review
    assert client.post(f"{API}/essays/{case['essay_id']}/comments", headers=S, json={"body": "x", "internal": True}).status_code == 403


def test_reviewer_matching_and_audited_override(client, db, case):
    A, M = case["A"], case["M"]
    c = client.get(f"{API}/writing/essays/{case['essay_id']}/candidates", headers=M).json()
    assert c["items"] and c["can_override"]
    for item in c["items"]:
        assert item["reasons"] is not None and "percent" not in item
    langs = [r for item in c["items"] for r in item["reasons"] if r["code"] == "LANGUAGE"]
    assert langs, "Vietnamese-speaking reviewers match a Vietnamese student"
    target = next(i for i in c["items"] if i["user"]["id"] != c["current"] and i["organization"]["type"] == "AGENCY")
    # V22: any admin of the agency may reassign; a reason is still required, and a student is never a reviewer-manager.
    assert client.post(f"{API}/writing/essays/{case['essay_id']}/reviewer", headers=A, json={"user_id": target["user"]["id"], "reason": "x"}).status_code == 422
    assert client.post(f"{API}/writing/essays/{case['essay_id']}/reviewer", headers=case["S"], json={"user_id": target["user"]["id"], "reason": "I am on leave"}).status_code == 404
    r = client.post(f"{API}/writing/essays/{case['essay_id']}/reviewer", headers=M, json={"user_id": target["user"]["id"], "reason": "Specialist in business essays"})
    assert r.status_code == 200, r.text
    assert r.json()["reviewer"]["id"] == target["user"]["id"]
    log = db.scalar(select(AuditLog).where(AuditLog.action == "essay.reviewer_override", AuditLog.entity_id == case["essay_id"]))
    assert log and log.detail["reason"] == "Specialist in business essays" and log.detail["to"] == target["user"]["id"]
    # Put the counselor back for the next steps (also audited).
    client.post(f"{API}/writing/essays/{case['essay_id']}/reviewer", headers=M, json={"user_id": c["current"], "reason": "Back to the own counselor"})


def test_overdue_review_creates_tasks_and_escalates_truthfully(client, db, case):
    rev = db.scalar(select(EssayReview).where(EssayReview.essay_id == uuid.UUID(case["essay_id"])))
    rev.expected_review_by = utcnow() - timedelta(hours=2)
    rev.submitted_at = utcnow() - timedelta(hours=50)
    db.commit()
    st = client.get(f"{API}/essays/{case['essay_id']}", headers=case["S"]).json()["writing"]["status_line"]
    assert st["code"] == "LATE_FLAGGED" and st["flagged_to"].startswith("Lotus")
    tasks = db.scalars(select(Task).where(Task.link == f"/essays/{case['essay_id']}", Task.source == "WRITING")).all()
    keys = {t.dedupe_key.split(":")[0] for t in tasks}
    assert keys == {"writing-overdue", "writing-escalate"}
    esc = next(t for t in tasks if t.dedupe_key.startswith("writing-escalate"))
    # V22: there is no "manager" title — the escalation goes to an active admin of the agency who is not the late reviewer.
    lotus = db.scalar(select(Organization).where(Organization.slug == "lotus-bridge"))
    admins = {m.user_id for m in db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == lotus.id,
                                                                                OrganizationMember.is_active.is_(True)))}
    essay_reviewer = db.get(Essay, uuid.UUID(case["essay_id"])).reviewer_user_id
    assert esc.owner_user_id in admins and esc.owner_user_id != essay_reviewer
    # Idempotent: a second read does not duplicate.
    client.get(f"{API}/essays/{case['essay_id']}", headers=case["S"])
    assert len(db.scalars(select(Task).where(Task.link == f"/essays/{case['essay_id']}", Task.source == "WRITING")).all()) == 2
    q = client.get(f"{API}/writing/queue?view=overdue", headers=case["M"]).json()
    assert any(i["id"] == case["essay_id"] for i in q["items"]) and q["counts"]["overdue"] == len(q["items"])
    today = client.get(f"{API}/writing/today", headers=case["M"]).json()["items"]
    assert any(i["essay_id"] == case["essay_id"] and i["kind"] == "WRITING_OVERDUE" for i in today)


def test_tenant_isolation(client, case, silk_manager, pnu_admin, lotus_counselor):
    eid = case["essay_id"]
    assert client.get(f"{API}/essays/{eid}", headers=silk_manager).status_code == 404
    assert client.get(f"{API}/writing/essays/{eid}/candidates", headers=silk_manager).status_code == 404
    assert client.post(f"{API}/writing/essays/{eid}/checks", headers=silk_manager).status_code == 404
    q = client.get(f"{API}/writing/queue?view=team", headers=silk_manager).json()
    assert all(i["id"] != eid for i in q["items"])
    lotus_prompts = {p["id"] for p in client.get(f"{API}/writing/prompts", headers=case["A"]).json()["items"] if p["entered_by_org"]}
    silk_prompts = {p["id"] for p in client.get(f"{API}/writing/prompts", headers=silk_manager).json()["items"]}
    assert lotus_prompts and not (lotus_prompts & silk_prompts)
    assert client.get(f"{API}/essays/{eid}", headers=pnu_admin).status_code == 404
    assert client.get(f"{API}/writing/queue", headers=pnu_admin).status_code == 404
    assert client.get(f"{API}/writing/applications/{case['app_id']}/approved", headers=pnu_admin).status_code == 404  # not submitted


def test_fix_then_final_approval_and_the_application_uses_the_approved_version(client, db, case):
    S, A = case["S"], case["A"]
    eid = case["essay_id"]
    client.post(f"{API}/essays/{eid}/status", headers=A, json={"status": "CHANGES_REQUESTED"})
    fixed = ESSAY.replace("I graduated in 2024 from high school in Hanoi.", "I will graduate from high school in Hanoi in 2027.").replace(
        " I also visited Yonsei University last summer.", "")
    assert client.put(f"{API}/essays/{eid}", headers=S, json={"body": fixed}).status_code == 200
    e = client.post(f"{API}/essays/{eid}/status", headers=S, json={"status": "SUBMITTED"}).json()
    assert e["writing"]["review"]["round"] == 2
    assert not [f for f in e["writing"]["findings"] if f["status"] == "OPEN" and f["kind"] in ("FACT", "OTHER_UNIVERSITY")]
    for c in e["comments"]:
        if not c["resolved"] and c["visibility"] == "PARTICIPANTS":
            client.post(f"{API}/essays/{eid}/comments/{c['id']}/resolve", headers=A)
    for dim in ("ANSWERS_PROMPT", "MOTIVATION", "PROGRAM_CONNECTION", "FUTURE_PLAN"):
        assert client.put(f"{API}/writing/essays/{eid}/rubric/{dim}", headers=A, json={"rating": "MEETS"}).status_code == 200
    e = client.post(f"{API}/essays/{eid}/status", headers=A, json={"status": "FINAL_REVIEW"}).json()
    assert e["status"] == "FINAL_REVIEW"
    student_view = client.get(f"{API}/essays/{eid}", headers=S).json()["writing"]
    assert student_view["gate"] and all(i["key"] != "ORIGINALITY" for i in student_view["gate"]["items"])
    staff_gate = client.get(f"{API}/essays/{eid}", headers=A).json()["writing"]["gate"]
    assert staff_gate["can_approve"], staff_gate
    e = client.post(f"{API}/essays/{eid}/status", headers=A, json={"status": "APPROVED"}).json()
    assert e["status"] == "APPROVED" and e["writing"]["approved_version"] == e["current_version"]
    approved_version = e["current_version"]

    detail = client.get(f"{API}/applications/{case['app_id']}", headers=S).json()
    ps = next(i for i in detail["checklist"] if i["category"] == "PERSONAL_STATEMENT")
    assert ps["ready"] and ps["essay_approved_version"] == approved_version and ps.get("source") == "APPROVED_ESSAY"
    pkg = client.get(f"{API}/writing/applications/{case['app_id']}/approved", headers=S).json()["items"]
    assert pkg[0]["version"] == approved_version and pkg[0]["body"] == fixed and pkg[0]["newer_draft"] is False
    # The student reopens and edits: the application keeps using the approved version until a new approval.
    client.post(f"{API}/essays/{eid}/status", headers=S, json={"status": "STUDENT_REVISION"})
    client.put(f"{API}/essays/{eid}", headers=S, json={"body": fixed + " One more sentence."})
    pkg = client.get(f"{API}/writing/applications/{case['app_id']}/approved", headers=S).json()["items"]
    assert pkg[0]["version"] == approved_version and pkg[0]["body"] == fixed and pkg[0]["newer_draft"] is True


def test_manager_override_is_recorded(client, db, case):
    """A second essay (study plan) approved with an open blocker by the manager: reason + blockers recorded."""
    S, M = case["S"], case["M"]
    sp = next(e for e in client.get(f"{API}/essays", headers=S).json()["items"] if e["application_id"] == case["app_id"] and e["essay_type"] == "STUDY_PLAN")
    client.put(f"{API}/essays/{sp['id']}", headers=S, json={"body": "My study plan: first year Korean, then business courses. I am 30 years old."})
    client.post(f"{API}/essays/{sp['id']}/status", headers=S, json={"status": "SUBMITTED"})
    r = client.post(f"{API}/essays/{sp['id']}/status", headers=M, json={"status": "APPROVED", "override_reason": "University confirmed age is not assessed"})
    assert r.status_code == 200, r.text
    assert r.json()["writing"]["approval_override"]["reason"] == "University confirmed age is not assessed"
    log = db.scalar(select(AuditLog).where(AuditLog.action == "essay.approve_override", AuditLog.entity_id == sp["id"]))
    assert log and "PROFILE_CONSISTENCY" in log.detail["blockers"]


def test_unknown_prompt_is_said_honestly(client, student):
    items = client.get(f"{API}/essays?page_size=50", headers=student).json()["items"]
    unknown = [e for e in items if e["writing"]["prompt_status"] == "UNKNOWN"]
    assert unknown, "Lan's Pusan Media personal statement has no known prompt"
    assert all(e["writing"]["prompt"] is None for e in unknown)


def test_seeded_demo_states(client, db, lotus_counselor):
    m = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    q = client.get(f"{API}/writing/queue?view=team", headers=m).json()
    assert q["counts"]["overdue"] >= 1 and q["counts"]["revised"] >= 1 and q["counts"]["final"] >= 1
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    lan_ps = [e for e in db.scalars(select(Essay).where(Essay.owner_user_id == lan.id, Essay.status == "AGENCY_REVIEW")).all()]
    w = [client.get(f"{API}/essays/{e.id}", headers=lotus_counselor).json()["writing"] for e in lan_ps]
    facts = [f for x in w for f in x["findings"] if f["code"] == "FACT_DEGREE"]
    assert facts and facts[0]["quote"].startswith("At university I studied")
    assert any(a["kind"] == "HANGYUL" for x in w for a in x["authors"].values())
    prompts = db.scalars(select(WritingPrompt).where(WritingPrompt.is_demo.is_(True))).all()
    assert prompts and all(p.verification_status == "SAMPLE" and p.source_url is None for p in prompts)


def test_metrics_and_patterns_are_internal_and_withhold_small_groups(client, db, student, lotus_counselor):
    m = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    r = client.get(f"{API}/writing/insights?period_days=365", headers=m)
    assert r.status_code == 200
    d = r.json()
    assert d["metrics"]["reviews"] > 0 and d["metrics"]["median_turnaround_hours"] is not None
    for groups in d["patterns"]["groups"].values():
        for g in groups:
            assert (g["offers"] is None) == (g["n"] < 5)
    assert "no causal" in d["patterns"]["caveat"].lower()
    assert client.get(f"{API}/writing/insights", headers=lotus_counselor).status_code == 200  # V22: every admin of the agency
    assert client.get(f"{API}/writing/insights", headers=student).status_code == 403
    metrics = W.writing_metrics(db, None, 365)
    assert set(metrics) >= {"median_turnaround_hours", "median_revision_rounds", "sla_breaches"}
