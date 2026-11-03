"""V28 (UX_AUDIT D-1): seeded sample (DEMO) programme facts are never served as facts in production."""

from types import SimpleNamespace

from app.api import common
from app.core.config import get_settings
from app.services import facts


def _program(status: str):
    req = SimpleNamespace(min_prior_education="HIGH_SCHOOL", min_gpa_percent=70.0, min_topik_level=3, min_ielts=None, min_toefl_ibt=None,
                          language_alternative=None, requires_interview=False, requires_portfolio=False, notes="x",
                          source_url=None, verified_at=None, verification_status=status, effective_from=None, effective_to=None)
    return SimpleNamespace(id="p", university_id="u", name_en="Business", name_ko="경영학", degree_level=SimpleNamespace(value="BACHELOR"),
                           field="BUSINESS", instruction_language=SimpleNamespace(value="KOREAN"), duration_semesters=8,
                           tuition_per_semester_krw=4_000_000, application_fee_krw=100_000, description="d", requirements=[req],
                           intakes=[], source_url=None, verified_at=None, verification_status=status, effective_from=None, effective_to=None)


def test_production_withholds_demo_facts(monkeypatch):
    monkeypatch.setattr(get_settings(), "env", "production")
    d = common.ser_program(_program("DEMO"))
    assert d["withheld"] is True and d["tuition_per_semester_krw"] is None and d["application_fee_krw"] is None
    assert d["requirements"]["withheld"] is True and d["requirements"]["min_topik_level"] is None
    assert d["name_ko"] == "경영학"  # identity stays; only facts are withheld


def test_production_serves_verified_facts(monkeypatch):
    monkeypatch.setattr(get_settings(), "env", "production")
    d = common.ser_program(_program("CURRENT"))
    assert "withheld" not in d and d["tuition_per_semester_krw"] == 4_000_000 and d["requirements"]["min_topik_level"] == 3


def test_development_keeps_demo_under_the_global_indicator(monkeypatch):
    monkeypatch.setattr(get_settings(), "env", "development")
    assert facts.withheld(_program("DEMO")) is False
    assert common.ser_program(_program("DEMO"))["tuition_per_semester_krw"] == 4_000_000
