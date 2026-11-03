"""V3 coordinator additions: push token registration and readiness that counts open university requests."""
from tests.conftest import login


def test_push_token_register_is_idempotent_and_owned(client, student):
    body = {"token": "ExponentPushToken[test-device-1]", "platform": "android"}
    assert client.post("/api/v1/me/push-tokens", json=body, headers=student).status_code == 204
    assert client.post("/api/v1/me/push-tokens", json=body, headers=student).status_code == 204
    # Another user signing in on the same device takes the token over; the first user can no longer delete it.
    other = login(client, "student01@demo.hangyul.kr", "student")
    assert client.post("/api/v1/me/push-tokens", json=body, headers=other).status_code == 204
    assert client.delete("/api/v1/me/push-tokens/ExponentPushToken[test-device-1]", headers=student).status_code == 204
    from app.core.db import SessionLocal
    from app.models import PushToken, User
    with SessionLocal() as db:
        row = db.query(PushToken).filter_by(token=body["token"]).one()
        assert db.get(User, row.user_id).email == "student01@demo.hangyul.kr"


def test_push_token_validation(client, student):
    assert client.post("/api/v1/me/push-tokens", json={"token": "x", "platform": "web"}, headers=student).status_code == 422
