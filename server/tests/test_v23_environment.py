"""V23 — the server environment fails closed (REPORT §268 P1).

Before V23 `Settings.env` defaulted to "development" and `is_production` was an exact string match, so a host that
forgot `HG_ENV` — or wrote `prod` — served passwordless demo sign-in, the test paid-state action and the instant-approve
demo payment provider. Now an unset, empty or unrecognised value is production.
"""
import pytest

from app.core.config import Settings, get_settings


@pytest.mark.parametrize("raw", ["", "prod", "Production", " production ", "live", "typo"])
def test_anything_unrecognised_is_production(monkeypatch, raw):
    monkeypatch.setenv("HG_ENV", raw)
    s = Settings(_env_file=None)
    assert s.env == "production"
    assert s.is_production
    assert not s.demo_logins_enabled
    assert not s.test_payment_bypass_enabled


def test_unset_is_production(monkeypatch):
    monkeypatch.delenv("HG_ENV", raising=False)
    s = Settings(_env_file=None)
    assert s.is_production


@pytest.mark.parametrize(("raw", "expected"), [("development", "development"), ("DEV", "development"), ("test", "test"), ("staging", "staging")])
def test_named_non_production_environments(monkeypatch, raw, expected):
    monkeypatch.setenv("HG_ENV", raw)
    assert Settings(_env_file=None).env == expected


def test_production_refuses_demo_login_even_with_the_flag(client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "env", "production")
    monkeypatch.setattr(s, "demo_logins", True)
    r = client.post("/api/v1/auth/demo-login", json={"email": "student@demo.hangyul.kr", "client": "student"})
    assert r.status_code == 404


def test_development_allows_demo_login(client):
    r = client.post("/api/v1/auth/demo-login", json={"email": "student@demo.hangyul.kr", "client": "student"})
    assert r.status_code == 200, r.text
