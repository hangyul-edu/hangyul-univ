"""V23 — the server environment fails closed (REPORT §268 P1).

Before V23 `Settings.env` defaulted to "development" and `is_production` was an exact string match, so a host that
forgot `HG_ENV` — or wrote `prod` — served the instant-approve demo payment provider. Now an unset, empty or
unrecognised value is production. (V32 removed demo sign-in and the paid-state action from the product entirely.)
"""
import pytest

from app.core.config import Settings


@pytest.mark.parametrize("raw", ["", "prod", "Production", " production ", "live", "typo"])
def test_anything_unrecognised_is_production(monkeypatch, raw):
    monkeypatch.setenv("HG_ENV", raw)
    s = Settings(_env_file=None)
    assert s.env == "production"
    assert s.is_production


def test_unset_is_production(monkeypatch):
    monkeypatch.delenv("HG_ENV", raising=False)
    s = Settings(_env_file=None)
    assert s.is_production


@pytest.mark.parametrize(("raw", "expected"), [("development", "development"), ("DEV", "development"), ("test", "test"), ("staging", "staging")])
def test_named_non_production_environments(monkeypatch, raw, expected):
    monkeypatch.setenv("HG_ENV", raw)
    assert Settings(_env_file=None).env == expected

