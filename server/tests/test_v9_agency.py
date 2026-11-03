"""V9 agency + Hangyul operations (REPORT §59 A1–A12, §61 H1–H3).

One waiting-on model (counts = rows, next action in the waiting party's voice), one work queue with type filters,
team expertise / weighted load / member-leaves reassignment, templates with language variants and scope permissions,
the submissions pipeline, providers, meeting records, manager questions, process quality, message delivery, agency
identity, HQ failures with drill-down, partner quality and launch readiness. Every new endpoint: other tenant → 404,
student → 403.
"""
import pytest

from app.services import priority, waiting
from tests.conftest import login

LOTUS_MGR = "manager@lotus.demo.hangyul.kr"
LOTUS_COUNSELOR = "counselor@lotus.demo.hangyul.kr"
LOTUS_OWNER = "owner@lotus.demo.hangyul.kr"
SILK_MGR = "manager@silk.demo.hangyul.kr"
OPS = "ops@demo.hangyul.kr"


@pytest.fixture(scope="module")
def mgr(client):
    return login(client, LOTUS_MGR, "agency")


@pytest.fixture(scope="module")
def counselor(client):
    return login(client, LOTUS_COUNSELOR, "agency")


@pytest.fixture(scope="module")
def owner(client):
    return login(client, LOTUS_OWNER, "agency")


@pytest.fixture(scope="module")
def silk(client):
    return login(client, SILK_MGR, "agency")


@pytest.fixture(scope="module")
def ops(client):
    return login(client, OPS, "agency")


def _rows(client, h, qs=""):
    return client.get(f"/api/v1/agency/students?page_size=200{qs}", headers=h).json()


# ------------------------------------------------------------------------------------------------ A1 waiting model

@pytest.mark.parametrize("who", [LOTUS_MGR, LOTUS_COUNSELOR])
def test_waiting_parties_counts_equal_rows(client, who):
    h = login(client, who, "agency")
    counts = client.get("/api/v1/agency/students/views", headers=h).json()
    today = client.get("/api/v1/agency/today", headers=h).json()["waiting_on"]
    rows = _rows(client, h)["items"]
    assert set(waiting.PARTIES) <= set(today)
    assert sum(today[p] for p in waiting.PARTIES) == len(rows)
    for view, party in (("waiting_counselor", "counselor"), ("waiting_agency", "agency"), ("waiting_hangyul", "hangyul")):
        page = _rows(client, h, f"&view={view}")
        assert page["total"] == counts[view] == today[party], view
        assert all(r["waiting_on"] == party for r in page["items"]), view
    us = _rows(client, h, "&waiting_on=us")
    assert us["total"] == counts["waiting_us"] == today["counselor"] + today["agency"]
    assert client.get("/api/v1/agency/students?waiting_on=nobody", headers=h).status_code == 422


def test_next_action_is_the_waiting_partys_action(client, mgr):
    """§55 #8: a row that waits on the team never shows a student's to-do as its next action, and vice versa."""
    rows = _rows(client, mgr)["items"]
    assert rows
    for r in rows:
        na = r["next_action"]
        if r["waiting_on"] is None:
            assert na is None
            continue
        assert na["party"] == r["waiting_on"] and na["code"] == r["waiting_reason"]["code"] and na["code"] in waiting.REASONS
        if r["waiting_on"] in waiting.STAFF_PARTIES and na["task"]:
            assert na["code"] in ("task", "task_unassigned")  # a staff task, never the student's
        assert r["waiting_owner"]["kind"] in ("person", "agency", "hangyul", "student", "university", "embassy", "rail", "provider")
    # The reported case: waiting on the counselor while the earliest task is the student's own.
    mixed = [r for r in rows if r["waiting_on"] == "counselor" and r["next_task"]]
    for r in mixed:
        assert r["next_action"]["code"] != "student_task"


def test_application_waiting_uses_the_same_vocabulary(client, counselor):
    rows = _rows(client, counselor)["items"]
    for row in rows[:8]:
        ws = client.get(f"/api/v1/agency/students/{row['id']}", headers=counselor).json()
        # V10: strict equality on purpose. This caught a real inconsistency — `build_rows` serves both the
        # caseload list and the workspace, but its application queries ordered only by `updated_at`, which ties
        # in seeded data, so the two surfaces could name a different university for the same next action.
        assert ws["waiting_on"] == row["waiting_on"]
        assert ws["next_action"] == row["next_action"]
        for a in ws["applications"]:
            assert a["waiting_on"] in (None, *waiting.PARTIES)
    ids = [a["id"] for r in rows[:5] for a in client.get(f"/api/v1/agency/students/{r['id']}", headers=counselor).json()["applications"]][:20]
    if ids:
        rem = client.get("/api/v1/agency/applications/remaining", params=[("ids", i) for i in ids], headers=counselor).json()
        assert all(v["waiting_on"] in (None, *waiting.PARTIES) for v in rem.values())


def test_handed_off_waits_on_student_and_unconfirmed_on_external(client, mgr):
    pipe = client.get("/api/v1/agency/submissions/pipeline", headers=mgr).json()
    missing = [i for i in pipe["items"] if i["state"] == "confirmation_missing"]
    sent = [i for i in pipe["items"] if i["state"] == "submitted"]
    assert missing, "seeded: handed off 4 days ago, no reference"
    assert sent, "seeded: reported submitted yesterday, no reference"
    ids = [missing[0]["application_id"], sent[0]["application_id"]]
    rem = client.get("/api/v1/agency/applications/remaining", params=[("ids", i) for i in ids], headers=mgr).json()
    assert (rem[ids[0]]["waiting_on"], rem[ids[0]]["waiting_reason"]) == ("student", "submit_on_portal")
    assert (rem[ids[1]]["waiting_on"], rem[ids[1]]["waiting_reason"]) == ("external", "rail_confirmation")


# ------------------------------------------------------------------------------------------------ A2 one work queue

def test_today_queue_types_filter_the_same_list(client, mgr):
    full = client.get("/api/v1/agency/today/queue?limit=200", headers=mgr).json()
    assert set(full["by_type"]) == set(priority.WORK_TYPES) and full["types"] == list(priority.WORK_TYPES)
    for it in full["items"]:
        assert it["types"] and set(it["types"]) <= set(priority.WORK_TYPES)
        assert it["owner"]["kind"] in ("person", "agency", "hangyul")
        assert "deadline" in it
    for t in priority.WORK_TYPES:
        page = client.get(f"/api/v1/agency/today/queue?limit=200&type={t}", headers=mgr).json()
        assert page["total"] == full["by_type"][t] == len(page["items"]), t
        for it in page["items"]:
            assert priority.TYPE_OF[it["reasons"][0]["code"]] == t
        keys = [priority.rank_key([r for r in i["reasons"] if priority.TYPE_OF[r["code"]] == t]) for i in page["items"]]
        assert keys == sorted(keys)
    assert client.get("/api/v1/agency/today/queue?type=gossip", headers=mgr).status_code == 422


def test_every_reason_has_a_type_tier_and_action():
    assert set(priority.TIERS) == set(priority.TYPE_OF) == set(priority.ACTION)


# ------------------------------------------------------------------------------------------------ A3 header + A12 identity

def test_workspace_header_answers_the_five_questions(client, counselor):
    sid = _rows(client, counselor)["items"][0]["id"]
    m = client.get(f"/api/v1/agency/students/{sid}/movement", headers=counselor).json()
    for k in ("waiting_on", "waiting_reason", "next_action", "deadline", "owner", "agency_identity", "reasons"):
        assert k in m
    ident = m["agency_identity"]
    assert ident["trading_name"] == "Lotus Bridge Education"
    assert ident["registration"]["status"] == "NOT_RECORDED" and ident["registration"]["number"] is None  # seed placeholders never count


def test_identity_owner_records_registration_and_sub_agent(client, owner, mgr, counselor, silk):
    # V22: every admin of the agency records its legal identity (the owner-only rule is gone).
    before = client.get("/api/v1/agency/identity", headers=mgr).json()
    assert before["can_edit"] is True
    r = client.patch("/api/v1/agency/identity", headers=mgr, json={"legal_name": "Lotus Bridge Education Co., Ltd (edited)"})
    assert r.status_code == 200 and r.json()["legal_name"] == "Lotus Bridge Education Co., Ltd (edited)"
    assert client.patch("/api/v1/agency/identity", headers=mgr, json={"legal_name": before["legal_name"] or ""}).json()["legal_name"] == before["legal_name"]
    assert client.patch("/api/v1/agency/identity", headers=owner, json={"registration_number": "123"}).status_code == 422
    r = client.patch("/api/v1/agency/identity", headers=owner, json={"registration_number": "HCM-2026-01", "registration_authority": "Ho Chi Minh City DOET"})
    assert r.status_code == 200 and r.json()["registration_status"] == "RECORDED"
    assert client.patch("/api/v1/agency/identity", headers=owner, json={"clear_registration": True}).json()["registration_status"] == "NOT_RECORDED"
    sid = _rows(client, counselor)["items"][0]["id"]
    r = client.patch(f"/api/v1/agency/students/{sid}/sub-agent", headers=counselor, json={"name": "Đà Nẵng partner office"})
    assert r.status_code == 200 and r.json()["sub_agent"] == "Đà Nẵng partner office"
    assert client.patch(f"/api/v1/agency/students/{sid}/sub-agent", headers=silk, json={"name": "x"}).status_code == 404
    client.patch(f"/api/v1/agency/students/{sid}/sub-agent", headers=counselor, json={"name": None})


# ------------------------------------------------------------------------------------------------ A4 team

def test_team_has_expertise_capacity_and_weighted_load(client, mgr):
    t = client.get("/api/v1/agency/team", headers=mgr).json()
    assert t["can_manage"] and set(t["weights"]) == set(t["default_weights"])
    holders = [m for m in t["members"] if m["load"]]
    assert holders
    for m in holders:
        w = m["load"]["work"]
        assert m["load"]["points"] == sum(t["weights"][k] * w[k] for k in t["weights"])
        if m["capacity_points"]:
            assert m["load"]["overloaded"] == (m["load"]["points"] > m["capacity_points"])
    assert any(m["countries"] for m in t["members"])
    assert any(m["on_leave_until"] for m in t["members"])  # seeded leave


def test_team_edit_permissions_and_tenancy(client, mgr, counselor, silk, student):
    team = client.get("/api/v1/agency/team", headers=mgr).json()
    uid = next(m["user_id"] for m in team["members"] if m["email"] == "counselor2@lotus.demo.hangyul.kr")
    # V22: every admin of the agency edits the team; another agency and a student still cannot.
    assert client.patch(f"/api/v1/agency/team/members/{uid}", headers=counselor, json={"capacity_points": 99}).status_code == 200
    assert client.patch(f"/api/v1/agency/team/members/{uid}", headers=silk, json={"capacity_points": 99}).status_code == 404
    assert client.patch(f"/api/v1/agency/team/members/{uid}", headers=student, json={"capacity_points": 99}).status_code == 403
    assert client.patch(f"/api/v1/agency/team/members/{uid}", headers=mgr, json={"degrees": ["NOPE"]}).status_code == 422
    r = client.patch(f"/api/v1/agency/team/members/{uid}", headers=mgr, json={"capacity_points": 36, "countries": ["vn", "KH"], "degrees": ["BACHELOR"]})
    assert r.status_code == 200
    m = next(m for m in client.get("/api/v1/agency/team", headers=mgr).json()["members"] if m["user_id"] == uid)
    assert m["capacity_points"] == 36 and m["countries"] == ["KH", "VN"]
    assert client.put("/api/v1/agency/team/weights", headers=mgr, json={"weights": {"gossip": 1}}).status_code == 422
    assert client.put("/api/v1/agency/team/weights", headers=mgr, json={"weights": {"visa_cases": 99}}).status_code == 422
    r = client.put("/api/v1/agency/team/weights", headers=counselor, json={"weights": {"visa_cases": 3}})  # V22: any admin sets the weights
    assert r.status_code == 200 and r.json()["weights"]["visa_cases"] == 3
    client.put("/api/v1/agency/team/weights", headers=mgr, json={"weights": {"visa_cases": 2}})


def test_member_leaves_every_open_item_is_moved_and_audited(client, mgr, silk):
    team = client.get("/api/v1/agency/team", headers=mgr).json()
    uid = next(m["user_id"] for m in team["members"] if m["email"] == "counselor2@lotus.demo.hangyul.kr")
    assert client.get(f"/api/v1/agency/team/members/{uid}/open-items", headers=silk).status_code == 404
    before = client.get(f"/api/v1/agency/team/members/{uid}/open-items", headers=mgr).json()
    assert before["items"]["students"], "seeded caseload"
    assert client.post(f"/api/v1/agency/team/members/{uid}/deactivate", headers=mgr, json={"reason": "Left", "to": {"students": "unassigned"}}).status_code == 422
    r = client.post(f"/api/v1/agency/team/members/{uid}/deactivate", headers=mgr, json={"reason": "Moved to another office", "to": {"tasks": "unassigned"}})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["remaining"] == 0 and len(body["moved"]) == before["total"]
    assert all(m["to"] != uid for m in body["moved"])
    assert all(m["to"] for m in body["moved"] if m["kind"] == "students")
    after = client.get(f"/api/v1/agency/team/members/{uid}/open-items", headers=mgr).json()
    assert after["active"] is False and after["total"] == 0
    audit = client.get("/api/v1/audit?action=team.member.reassign&page_size=100", headers=mgr).json()["items"]
    assert len([a for a in audit if (a.get("detail") or {}).get("from") == uid]) >= before["total"]
    assert client.post(f"/api/v1/agency/team/members/{uid}/reactivate", headers=mgr).status_code == 200


def test_assignment_engine_skips_people_on_leave(db):
    from datetime import date, timedelta

    from sqlalchemy import select

    from app.models import Organization, OrganizationMember
    from app.models.enums import Role
    from app.services import assignment

    org = db.scalar(select(Organization).where(Organization.slug == "lotus-bridge"))
    # V22: every member is an AGENCY_ADMIN; the engine picks among the agency's active members.
    counselors = db.scalars(select(OrganizationMember).where(OrganizationMember.organization_id == org.id,
                                                             OrganizationMember.role == Role.AGENCY_ADMIN,
                                                             OrganizationMember.is_active.is_(True))).all()
    first = assignment.pick_counselor(db, org.id)
    assert first is not None
    first.on_leave_until = date.today() + timedelta(days=3)
    db.flush()
    second = assignment.pick_counselor(db, org.id)
    assert second is None or second.user_id != first.user_id
    assert len(counselors) >= 1
    db.rollback()


# ------------------------------------------------------------------------------------------------ A5 templates

def test_template_kinds_variants_and_scopes(client, mgr, counselor, silk):
    t = client.get("/api/v1/templates", headers=counselor).json()
    assert {"PAYMENT", "ARRIVAL", "HOUSING", "VISA_REMINDER"} <= set(t["kinds"])
    assert t["can_publish_org"] is True  # V22: every admin of the agency publishes organization templates
    groups = {}
    for x in t["items"]:
        groups.setdefault(x["group_key"], set()).add(x["locale"])
    vi_groups = [g for g, locs in groups.items() if "vi" in locs and "en" in locs]
    assert len(vi_groups) >= 9, "Lotus has Vietnamese variants of its standard templates"
    assert any(x["scope"] == "TEAM" for x in t["items"]) and any(x["scope"] == "PERSONAL" for x in t["items"])
    org_t = next(x for x in t["items"] if x["scope"] == "ORG")
    assert org_t["can_edit"] is True
    made = client.post("/api/v1/templates", headers=counselor, json={"title": "x", "body": "y", "scope": "ORG", "kind": "PAYMENT"})
    assert made.status_code == 201, made.text
    assert client.delete(f"/api/v1/templates/{made.json()['id']}", headers=counselor).status_code == 204
    # One variant per language in a group.
    g = vi_groups[0]
    dup = client.post("/api/v1/templates", headers=mgr, json={"title": "dup", "body": "b", "scope": "ORG", "kind": "GENERAL", "locale": "vi", "group_key": g})
    assert dup.status_code == 409
    silk_groups = {x["group_key"] for x in client.get("/api/v1/templates", headers=silk).json()["items"] if x["locale"] == "vi"}
    assert not silk_groups  # Vietnamese variants are Lotus's own
    ko = [x for x in t["items"] if x["locale"] == "ko"]
    assert all("한결" not in x["body"] for x in ko)


# ------------------------------------------------------------------------------------------------ A6 providers, A7 submissions

def test_providers_agreement_first_and_never_partner_without_one(client, mgr, student):
    r = client.get("/api/v1/agency/providers", headers=mgr)
    assert r.status_code == 200
    for v in r.json()["items"]:
        assert v["agreement_status"] in ("ACTIVE", "INACTIVE", "NONE")
        if v["agreement_status"] != "ACTIVE":
            assert v["label"] != "PARTNER"
        assert v["late_cases"] <= v["open_cases"]
    assert client.get("/api/v1/agency/providers", headers=student).status_code == 403


def test_submissions_pipeline_states_counts_and_tenancy(client, mgr, silk, student):
    full = client.get("/api/v1/agency/submissions/pipeline", headers=mgr).json()
    assert list(full["counts"]) == full["states"] and set(full["definitions"]) == set(full["states"])
    for st in full["states"]:
        page = client.get(f"/api/v1/agency/submissions/pipeline?state={st}", headers=mgr).json()
        assert len(page["items"]) == full["counts"][st] and all(i["state"] == st for i in page["items"])
    methods = {i["method"] for i in full["items"]}
    assert methods - {"AUTHORIZED_AGENCY"}, "not only the authorised-agency fixture"
    lotus_apps = {i["application_id"] for i in full["items"]}
    silk_apps = {i["application_id"] for i in client.get("/api/v1/agency/submissions/pipeline", headers=silk).json()["items"]}
    assert not (lotus_apps & silk_apps)
    assert client.get("/api/v1/agency/submissions/pipeline", headers=student).status_code == 403
    assert client.get("/api/v1/agency/submissions", headers=mgr).status_code == 200  # V6 queue unchanged


# ------------------------------------------------------------------------------------------------ A8 meetings

def test_meeting_record_is_one_record_on_the_timeline(client, counselor, silk):
    sid = _rows(client, counselor)["items"][0]["id"]
    body = {"outcome_notes": "Agreed the plan.", "decisions": ["Apply in spring", "  "],
            "follow_ups": [{"title": "Send the checklist"}, {"title": "Upload your transcript", "for_student": True}],
            "next_meeting": {"starts_at": "2026-12-01T10:00:00+09:00"}}
    r = client.post(f"/api/v1/agency/students/{sid}/meetings", headers=counselor, json=body)
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["decisions"] == ["Apply in spring"] and len(m["follow_ups"]) == 2 and m["next_meeting"]["status"] == "SCHEDULED"
    assert {f["for_student"] for f in m["follow_ups"]} == {True, False}
    listed = client.get(f"/api/v1/agency/students/{sid}/meetings", headers=counselor).json()["items"]
    assert any(x["id"] == m["id"] for x in listed)
    assert client.get(f"/api/v1/agency/students/{sid}/meetings", headers=silk).status_code == 404
    assert client.post(f"/api/v1/agency/students/{sid}/meetings", headers=counselor, json={"outcome_notes": " "}).status_code == 422
    # Closing an existing appointment uses the same record shape.
    nxt = m["next_meeting"]["id"]
    r = client.post(f"/api/v1/agency/appointments/{nxt}/close", headers=counselor, json={"status": "NO_SHOW"})
    assert r.status_code == 200 and r.json()["meeting"]["status"] == "NO_SHOW"


# ------------------------------------------------------------------------------------------------ A9 ops, A10 quality

def test_manager_questions_at_the_top(client, mgr, counselor):
    o = client.get("/api/v1/agency/ops", headers=mgr).json()
    assert set(o["questions"]) == {"oldest_blocked", "overloaded", "sla_breaches", "deadline_risk", "slowest_stage", "unassigned_paid"}
    assert o["blocked"]["count"] == len(o["blocked"]["items"])
    assert all(i["days"] > o["blocked"]["days"] and i["waiting_on"] != "none" for i in o["blocked"]["items"])
    assert o["unassigned_paid"]["count"] == len(o["unassigned_paid"]["items"])
    assert "weights" in o["load"] and all("points" in c for c in o["load"]["counselors"])
    assert client.get("/api/v1/agency/ops", headers=counselor).status_code == 200  # V22: every admin of the agency sees Operations


def test_process_quality_has_cohorts_and_withholds_small_n(client, mgr, counselor, ops, student):
    q = client.get("/api/v1/agency/quality?days=365", headers=mgr).json()
    keys = {m["key"] for m in q["metrics"]}
    assert {"correction_loops", "essay_revision_loops", "completeness_at_submission", "university_extra_documents", "missed_deadlines",
            "review_turnaround", "student_response_time", "visa_extra_documents", "arrival_issues"} <= keys
    for m in q["metrics"]:
        assert m["definition"] and m["cohort"]
        if m["n"] < 5:
            assert m["withheld"] and m["value"] is None
    assert client.get("/api/v1/agency/quality", headers=counselor).status_code == 200  # V22: every admin of the agency
    assert client.get("/api/v1/agency/quality", headers=student).status_code == 403
    assert client.get("/api/v1/agency/quality", headers=ops).status_code == 200


# ------------------------------------------------------------------------------------------------ A11 messages

def test_message_delivery_and_thread_link(client, counselor, silk):
    convs = client.get("/api/v1/conversations", headers=counselor).json()
    c = next(x for x in convs if x.get("student"))
    d = client.get(f"/api/v1/agency/conversations/{c['id']}/delivery", headers=counselor)
    assert d.status_code == 200
    assert all(v["state"] in ("SENT", "READ") and v["channel"] == "IN_APP" for v in d.json()["messages"].values())
    assert client.get(f"/api/v1/agency/conversations/{c['id']}/delivery", headers=silk).status_code == 404
    ws = client.get(f"/api/v1/agency/students/{c['student']['id']}", headers=counselor).json()
    if ws["applications"]:
        aid = ws["applications"][0]["id"]
        r = client.patch(f"/api/v1/agency/conversations/{c['id']}/application", headers=counselor, json={"application_id": aid})
        assert r.status_code == 200 and r.json()["application_id"] == aid
        assert client.get(f"/api/v1/agency/conversations/{c['id']}/delivery", headers=counselor).json()["application"]["id"] == aid
        client.patch(f"/api/v1/agency/conversations/{c['id']}/application", headers=counselor, json={"application_id": None})
    other = next((r["id"] for r in _rows(client, counselor)["items"] if r["id"] != c["student"]["id"]), None)
    if other:
        oapps = client.get(f"/api/v1/agency/students/{other}", headers=counselor).json()["applications"]
        if oapps:
            assert client.patch(f"/api/v1/agency/conversations/{c['id']}/application", headers=counselor,
                                json={"application_id": oapps[0]["id"]}).status_code == 404


# ------------------------------------------------------------------------------------------------ H1–H3

def test_hq_failures_carry_exact_records(client, ops, mgr):
    o = client.get("/api/v1/agency/hq/overview", headers=ops).json()
    codes = {f["code"] for f in o["failures"]} | set(o["all_clear"])
    assert {"application_blocked", "submission_issue", "confirmation_missing", "arrival_failed", "integrations"} <= codes
    sev = {"critical": 0, "high": 1, "medium": 2}
    assert [sev[f["severity"]] for f in o["failures"]] == sorted(sev[f["severity"]] for f in o["failures"])
    for f in o["failures"]:
        assert f["count"] > 0 and f["link"].startswith("/")
        assert len(f["items"]) <= min(20, f["count"]) or f["code"] in ("sources_conflict", "sources_stale", "tasks_overdue")
    cm = next((f for f in o["failures"] if f["code"] == "confirmation_missing"), None)
    assert cm and cm["items"], "seeded: a hand-off without a reference for 4 days"
    assert client.get("/api/v1/agency/hq/overview", headers=mgr).status_code == 404


def test_partner_quality_is_process_only(client, ops, mgr):
    r = client.get("/api/v1/agency/hq/agencies/quality", headers=ops)
    assert r.status_code == 200
    body = r.json()
    assert "admission" not in " ".join(body["keys"]) and not any("offer" in k or "accept" in k for k in body["keys"])
    names = [a["name"] for a in body["agencies"]]
    assert names == sorted(names)  # listed, never ranked
    for a in body["agencies"]:
        for m in a["metrics"].values():
            assert m["withheld"] == (m["n"] < 5)
    assert client.get("/api/v1/agency/hq/agencies/quality", headers=mgr).status_code == 404


def test_launch_readiness_is_classified_from_real_settings(client, ops, mgr):
    r = client.get("/api/v1/agency/hq/readiness", headers=ops).json()
    allowed = {"CODE_COMPLETE", "NEEDS_CREDENTIALS", "NEEDS_PROVIDER_AGREEMENT", "NEEDS_BUSINESS_DATA", "NEEDS_LEGAL_APPROVAL",
               "NEEDS_HUMAN_REVIEW", "NEEDS_INFRASTRUCTURE"}
    keys = {i["key"]: i for i in r["items"]}
    assert all(i["category"] in allowed for i in r["items"])
    for k in ("channel_zalo", "ocr", "housing_inventory", "scheduled_jobs_worker", "university_rail_apis", "legal_pages", "verified_catalogue",
              "translation_review", "usability_research", "moe_standard_agreement"):
        assert k in keys, k
    for i in r["items"]:
        if i["integration_status"] is not None:
            assert (i["category"] == "CODE_COMPLETE") == (i["integration_status"] == "ACTIVE")
    assert keys["channel_zalo"]["integration_status"] in ("NOT_CONFIGURED", "NEEDS_AGREEMENT")
    assert r["ready_for_launch"] is False and r["blocking"]
    assert client.get("/api/v1/agency/hq/readiness", headers=mgr).status_code == 404
