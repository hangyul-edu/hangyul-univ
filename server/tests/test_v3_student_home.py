"""V3 wave 2 — the student home says what is true: a concrete profile unlock for early students, "finish" (not "submit")
while required items are missing, the closest programs with their exact gap, and scholarships checked against the degree."""
from tests.conftest import login


def test_early_student_gets_a_concrete_unlock_and_closest_programs(client):
    h = login(client, "student.new@demo.hangyul.kr", "student")
    d = client.get("/api/v1/me/dashboard", headers=h).json()
    nxt = d["next_action"]
    assert nxt["code"] == "PROFILE_UNLOCK", nxt
    assert nxt["params"]["section"] in {"education", "language", "gpa", "budget"}
    assert nxt["params"]["count"] > 0 and nxt["params"]["total"] >= nxt["params"]["count"]
    assert nxt["link"].startswith("/profile?edit=")
    # No empty recommendation block: with no programs met yet, the closest ones come with their exact gap.
    if d["recommendations_kind"] == "POSSIBLE":
        assert d["recommendations"]
        for m in d["recommendations"]:
            assert m["tier"] == "REACH"
            assert any(r["kind"] == "missing" for r in m["reasons"])
    else:
        assert d["recommendations_kind"] in {"STRONG", "NONE"}


def test_deadline_task_says_finish_while_required_items_remain(client, student, db):
    from datetime import timedelta

    from sqlalchemy import select

    from app.models import Task, User
    from app.models.base import utcnow
    from app.models.enums import TaskStatus, TaskType

    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    deadline = db.scalar(select(Task).where(Task.student_user_id == lan.id, Task.task_type == TaskType.APPLICATION_DEADLINE,
                                            Task.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]), Task.visible_to_student.is_(True)).order_by(Task.due_at))
    assert deadline is not None
    before = deadline.due_at
    deadline.due_at = utcnow() - timedelta(hours=1)  # make it the most urgent task
    db.commit()
    try:
        nxt = client.get("/api/v1/me/dashboard", headers=student).json()["next_action"]
    finally:
        deadline.due_at = before
        db.commit()
    # Lan's applications still have required items missing, so the deadline task must not say "submit". V4: the home
    # names the application's most urgent item (the same one the application page leads with) — or, when every item
    # is with the counselor, "finish your application".
    assert nxt["code"] in ("APPLICATION_ITEM", "FINISH_APPLICATION"), nxt
    assert nxt["params"]["remaining"] > 0
    assert not nxt["title"].lower().startswith("submit")
    assert nxt["link"] == f"/applications/{deadline.application_id}"
    assert len(nxt["params"]["due_at"]) == 10  # the published closing date, same as "Coming up"


def test_graduate_only_scholarships_are_not_offered_to_bachelor_applicants(client, student):
    items = client.get("/api/v1/me/scholarships", headers=student).json()
    for s in items:
        if s["degree_levels"] and "BACHELOR" not in s["degree_levels"]:
            assert s["eligibility"]["status"] == "NOT_ELIGIBLE", s["name"]


def test_support_tickets_link_to_their_conversation(client):
    h = login(client, "student02@demo.hangyul.kr", "student")
    r = client.post("/api/v1/me/support-tickets", json={"category": "VISA", "subject": "Bank certificate date", "body": "Is 20 days old okay?"}, headers=h)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    tickets = client.get("/api/v1/me/support-tickets", headers=h).json()
    t = next(x for x in tickets if x["id"] == created["id"])
    assert t["conversation_id"] == created["conversation_id"]
