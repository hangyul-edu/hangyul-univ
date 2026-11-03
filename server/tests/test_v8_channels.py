"""V8 message channel model: registry statuses, honest refusal of unconnected channels, in-app unchanged."""
import pytest

from app.services import channels
from tests.conftest import login


def test_registry_lists_in_app_active_and_external_channels_not_connected(monkeypatch):
    for k in ("HG_SMTP_HOST", "HG_SMTP_USER", "HG_SMTP_PASSWORD", "HG_WHATSAPP_TOKEN", "HG_WHATSAPP_PHONE_ID", "HG_ZALO_OA_ID", "HG_ZALO_ACCESS_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    st = {c["code"]: c for c in channels.statuses()}
    assert set(st) == {"IN_APP", "EMAIL", "WHATSAPP", "KAKAO", "ZALO", "SMS"}  # V9: Zalo registered (not connected)
    assert st["IN_APP"]["status"] == channels.ACTIVE and st["IN_APP"]["can_send"]
    for code in ("EMAIL", "WHATSAPP", "KAKAO", "ZALO", "SMS"):
        assert st[code]["status"] == channels.NOT_CONFIGURED
        assert st[code]["can_send"] is False
        assert st[code]["requires"]  # names the credentials it would need


def test_credentials_alone_never_make_a_channel_active(monkeypatch):
    monkeypatch.setenv("HG_WHATSAPP_TOKEN", "x")
    monkeypatch.setenv("HG_WHATSAPP_PHONE_ID", "y")
    assert channels.get("WHATSAPP").status() == channels.NEEDS_AGREEMENT
    with pytest.raises(channels.ChannelNotConfigured):
        channels.send("WHATSAPP", to_user_id=None, body="hi", conversation_id=None)


def test_external_adapters_refuse_send_and_ingest():
    for code in ("EMAIL", "WHATSAPP", "KAKAO", "SMS"):
        with pytest.raises(channels.ChannelNotConfigured) as e:
            channels.send(code, to_user_id=None, body="hi", conversation_id=None)
        assert "not connected" in str(e.value)
        with pytest.raises(channels.ChannelNotConfigured):
            channels.get(code).ingest({})
    assert channels.send("IN_APP", to_user_id=None, body="hi", conversation_id=None).delivered
    with pytest.raises(channels.UnknownChannel):
        channels.get("PIGEON")


def test_channels_endpoint_and_sending_on_unconfigured_channel(client):
    mgr = login(client, "manager@lotus.demo.hangyul.kr", "agency")
    r = client.get("/api/v1/channels", headers=mgr)
    assert r.status_code == 200
    body = r.json()
    assert body["default"] == "IN_APP"
    assert {c["code"]: c["status"] for c in body["channels"]}["IN_APP"] == "ACTIVE"

    conv = client.get("/api/v1/conversations", headers=mgr).json()[0]
    before = len(client.get(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr).json()["messages"])
    r = client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr, json={"body": "Hello by WhatsApp", "channel": "WHATSAPP"})
    assert r.status_code == 409
    assert "WhatsApp" in r.json()["detail"] and "not connected" in r.json()["detail"]
    assert client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr, json={"body": "x", "channel": "PIGEON"}).status_code == 422
    # Nothing was stored for the refused sends.
    assert len(client.get(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr).json()["messages"]) == before

    r = client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr, json={"body": "Hello in the app"})
    assert r.status_code == 201
    msgs = client.get(f"/api/v1/conversations/{conv['id']}/messages", headers=mgr).json()["messages"]
    assert msgs[-1]["channel"] == "IN_APP" and msgs[-1]["body"] == "Hello in the app"
