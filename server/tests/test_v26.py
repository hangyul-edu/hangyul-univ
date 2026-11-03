"""V26 — API-level controls for the V26 changes (REPORT §341, §349).

Each test names the user outcome it protects, not the implementation detail.
"""
from __future__ import annotations

from app.services import caseload

API = "/api/v1"


def _login(client, email, client_kind):
    from tests.conftest import login

    return login(client, email, client_kind)


def test_students_filter_rejects_unknown_stage_with_422_not_500(client):
    """RC-24 / brief §37: a stray filter value is a request error with the field named, never a stack trace.

    `PROFILE_REVIEW` is an application status, not a pipeline stage — exactly the value the V26 scale test sent by
    mistake and got a 500 for (scale-api.log, 2026-10-27)."""
    h = _login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    bad = client.get(f"{API}/agency/students", params={"stage": ["PROFILE_REVIEW"], "page_size": 1}, headers=h)
    assert bad.status_code == 422
    assert "stage" in bad.text
    worse = client.get(f"{API}/agency/students", params={"degree": ["WIZARD"], "page_size": 1}, headers=h)
    assert worse.status_code == 422
    good = client.get(f"{API}/agency/students", params={"stage": ["DOCUMENT_PREPARATION", "READY_TO_APPLY"], "nationality": ["VN"], "page_size": 1}, headers=h)
    assert good.status_code == 200


def test_queue_rows_carry_the_exact_record_their_reason_names(client):
    """RC-01: a TODAY row opens the request / thread / document / essay / task it is about, not just the student.

    For every row whose waiting reason names a record, `targets` carries that record's id; the TODAY figure for each
    view equals the rows the view returns."""
    h = _login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    rows = client.get(f"{API}/agency/students", params={"page_size": 200}, headers=h).json()["items"]
    need = {"reply_owed": "reply_thread", "review": "review_doc", "review_unassigned": "review_doc", "essay_review": "essay",
            "essay_unassigned": "essay", "university_request": "request", "fix": "fix_doc", "task": "task", "task_unassigned": "task"}
    gaps = [(r["full_name"], r["waiting_reason"]["code"]) for r in rows
            if r.get("waiting_reason") and need.get(r["waiting_reason"]["code"]) and not (r.get("targets") or {}).get(need[r["waiting_reason"]["code"]])]
    assert gaps == []
    views = client.get(f"{API}/agency/students/views", headers=h).json()
    for v in ("urgent", "deadline7", "waiting_counselor", "student_silent", "requested", "university"):
        total = client.get(f"{API}/agency/students", params={"view": v, "page_size": 1}, headers=h).json()["total"]
        assert total == views[v], v


def test_workspace_carries_open_university_requests_on_their_application(client):
    """RC-01: '대학 요청' lands on the request itself, in the university's own words.

    The university asks for a document through its own endpoint; the agency's TODAY view then names that exact request
    on the row (`targets.request.id`) and the workspace shows it on the application it belongs to."""
    uni = _login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
    ag = _login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    # A PNU application under review whose student is in Lotus Bridge's caseload.
    apps = client.get(f"{API}/applications", params={"status": ["SUBMITTED", "UNIVERSITY_REVIEW"], "page_size": 100}, headers=uni).json()["items"]
    target = next((a for a in apps if client.get(f"{API}/agency/students/{a['student']['id']}", headers=ag).status_code == 200), None)
    assert target is not None, "the seed has a PNU applicant from Lotus Bridge under review"
    made = client.post(f"{API}/applications/{target['id']}/document-requests", headers=uni,
                       json={"label": "Bank balance certificate (recent)", "note": "Issued within the last 30 days, in English.", "category": "BANK_STATEMENT"})
    assert made.status_code == 201, made.text
    rid = made.json()["id"]
    try:
        rows = client.get(f"{API}/agency/students", params={"view": "requested", "page_size": 200}, headers=ag).json()["items"]
        row = next((r for r in rows if r["id"] == target["student"]["id"]), None)
        assert row is not None and (row.get("targets") or {}).get("request", {}).get("id") == rid
        ws = client.get(f"{API}/agency/students/{row['id']}", headers=ag).json()
        reqs = [q for a in ws["applications"] if a["id"] == target["id"] for q in a.get("requests", [])]
        assert any(q["id"] == rid and q["note"].startswith("Issued within") and q["requested_at"] for q in reqs)
        assert ws["targets"]["request"]["id"] == rid
    finally:
        # The suite shares the seeded database: an open request left behind changes the dossier packages the V5 tests
        # assert on (one more "request" per package). Cancel it the way the university would.
        assert client.post(f"{API}/document-requests/{rid}/cancel", headers=uni).status_code == 200


def test_services_now_counts_match_the_allowance(client):
    """RC-09: 'which applications use my allowance' is answered by records; counted items == usage.used."""
    h = _login(client, "student@demo.hangyul.kr", "student")
    sv = client.get(f"{API}/me/services", headers=h).json()
    assert sv["plan"] is not None
    lines = {ln["key"]: ln for ln in sv["now"]}
    managed = lines["max_managed_applications"]
    assert sum(1 for i in managed["items"] if i["counted"]) == managed["usage"]["used"]
    assert all(ln["owner"] in ("TEAM", "STUDENT", "UNIVERSITY") and ln["state"] in ("ACTIVE", "YOU", "LATER", "DONE", "AVAILABLE") for ln in sv["now"])
    # Every included service is a line; nothing the plan does not include is.
    ent = sv["plan"]["entitlements"]
    # Line keys are stable display keys; the contract field is V29's `visa_support_level`.
    assert ("visa_support" in lines) == (ent.get("visa_support_level") not in (None, "NONE"))


def test_decision_first_sort_puts_awaiting_applicants_before_everyone_else(client):
    """§336 U2: the university list opens on the applicants who need a decision."""
    h = _login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
    items = client.get(f"{API}/applications", params={"sort": "decision", "page_size": 200}, headers=h).json()["items"]
    aw = {"SUBMITTED", "UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "WAITLISTED"}
    flags = [a["status"] in aw for a in items]
    assert flags == sorted(flags, reverse=True)  # all True first, then all False
    assert any(flags)


def test_student_links_open_the_exact_record(client):
    """RC-01 (student): tasks and notifications never stop at a bare page."""
    h = _login(client, "student@demo.hangyul.kr", "student")
    tasks = client.get(f"{API}/tasks", params={"page_size": 100}, headers=h).json()["items"]
    assert all(t["link"] != "/documents" for t in tasks)
    notes = client.get(f"{API}/notifications", headers=h).json()["items"]
    assert all(n["link"] not in ("/documents", "/essays", "/messages", "/applications") for n in notes)


def test_caseload_targets_are_bulk_not_per_row(db):
    """§52: `_targets` is one query per record kind, whatever the caseload size (checked by statement count)."""
    from sqlalchemy import event, select

    from app.models import StudentProfile, User
    from app.models.base import utcnow

    pairs = db.execute(select(StudentProfile, User).join(User, User.id == StudentProfile.user_id).limit(40)).all()
    ids = [u.id for _, u in pairs]
    n = {"q": 0}
    eng = db.get_bind()
    listener = lambda *a, **k: n.__setitem__("q", n["q"] + 1)  # noqa: E731
    event.listen(eng, "before_cursor_execute", listener)
    try:
        caseload._targets(db, ids, utcnow())
    finally:
        event.remove(eng, "before_cursor_execute", listener)
    assert n["q"] <= 8, n["q"]


def test_waiting_case_predicate_matches_the_legacy_form(db):
    """§344: the CASE form of `waiting.pred` (one predicate per rule, O(n)) selects exactly the students the V9 form did,
    for every party, the legacy alias and NONE — on the whole seeded database."""
    from sqlalchemy import select

    from app.models import StudentProfile
    from app.models.base import utcnow
    from app.services import waiting

    now = utcnow()
    for party in (*waiting.PARTIES, "us"):
        new = set(db.scalars(select(StudentProfile.user_id).where(waiting.pred(party, now))).all())
        old = set(db.scalars(select(StudentProfile.user_id).where(waiting.pred_legacy(party, now))).all())
        assert new == old, (party, new ^ old)


def test_readiness_memo_changes_no_answer(db):
    """§344: the per-call memo `priority.collect` passes into `application_readiness` returns the same percentage and the
    same checklist items as the unmemoised computation, for every pre-submission application in the seed."""
    from sqlalchemy import select

    from app.models import Application, StudentProfile
    from app.models.base import utcnow
    from app.services import caseload
    from app.services.readiness import application_readiness, warm_memo

    today = utcnow().date()
    apps = db.scalars(select(Application).where(Application.status.in_(caseload.PRE_SUBMIT))).all()
    assert len(apps) > 10
    profiles = {p.user_id: p for p in db.scalars(select(StudentProfile)).all()}
    memo: dict = {}
    warm_memo(db, apps, profiles, memo)  # the bulk path the queue uses
    for a in apps:
        plain = application_readiness(db, a, profiles.get(a.student_user_id), today)
        cached = application_readiness(db, a, profiles.get(a.student_user_id), today, memo)
        assert plain == cached, a.id
    assert any(k[0] == "reqs" for k in memo) and any(k[0] == "docs" for k in memo)
