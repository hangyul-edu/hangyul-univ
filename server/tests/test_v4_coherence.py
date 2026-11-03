"""V4 — one meaning across screens: the student home names the same next item as the application page, and visa
tasks are named by the requirement, not by the raw embassy rule sentence."""
from tests.conftest import login

RANK = {"UNIVERSITY_REQUEST": 0, "FIX": 1, "LEGALIZE": 3, "RENEW": 3, "TOO_OLD": 3, "UPLOAD": 4}


def test_home_next_item_is_the_most_urgent_item_of_that_application(client, student):
    nxt = client.get("/api/v1/me/dashboard", headers=student).json()["next_action"]
    assert nxt["code"] == "APPLICATION_ITEM", nxt
    app = client.get(f"/api/v1/applications/{nxt['params']['application_id']}", headers=student).json()
    open_items = [c for c in app["checklist"] if c["required"] and not c["ready"] and c["action_code"] in RANK]
    assert open_items, "the chosen application must have an open student item"
    most_urgent = min(RANK[c["action_code"]] for c in open_items)
    if nxt["params"]["item"] in RANK:
        assert RANK[nxt["params"]["item"]] == most_urgent, (nxt, [c["action_code"] for c in open_items])
    assert nxt["link"] == f"/applications/{app['id']}"
    assert nxt["params"]["label"].lower() in nxt["title"].lower()


def test_visa_task_is_named_by_the_requirement(client):
    h = login(client, "student.visa@demo.hangyul.kr", "student")
    nxt = client.get("/api/v1/me/dashboard", headers=h).json()["next_action"]
    if nxt["code"] == "TASK" and nxt["params"].get("type") == "VISA_STEP":
        assert "(reported:" not in nxt["title"], nxt["title"]
        assert len(nxt["title"]) < 60


def test_marking_a_conversation_read_twice_is_idempotent(client):
    """Opening a thread can mark it read twice at once (auto-open + mount); it used to raise a unique-constraint 500."""
    h = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    convs = client.get("/api/v1/conversations", headers=h).json()
    cid = (convs if isinstance(convs, list) else convs["items"])[0]["id"]
    for _ in range(3):
        assert client.post(f"/api/v1/conversations/{cid}/read", headers=h).status_code == 204
