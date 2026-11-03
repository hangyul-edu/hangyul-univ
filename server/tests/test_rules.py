"""Pure rule logic: GPA normalization, matching tiers, legalization paths, state machine."""
from datetime import date

import pytest
from fastapi import HTTPException

from app.models import AdmissionRequirement, Program, ProgramIntake, StudentEducation, StudentLanguage, StudentProfile, University
from app.models.enums import ApplicationStatus as S
from app.models.enums import DegreeLevel, IntakeTerm, LanguageTest
from app.services.matching import match_program, normalize_gpa
from app.services.readiness import legalization_for
from app.services.state_machine import check_transition


def test_gpa_normalization():
    assert normalize_gpa(3.4, 0, 4) == 85.0
    assert normalize_gpa(8.4, 0, 10) == 84.0
    with pytest.raises(ValueError):
        normalize_gpa(3, 4, 4)


def _profile(topik=None, gpa=85.0, degree=DegreeLevel.BACHELOR):
    p = StudentProfile(target_degree=degree, desired_fields=["business"], preferred_regions=["Seoul"], annual_budget_krw=30_000_000, housing_preference="DORM")
    p.educations = [StudentEducation(level="HIGH_SCHOOL", institution="x", country="VN", graduation_status="GRADUATED", gpa_percent=gpa)]
    p.languages = [StudentLanguage(test=LanguageTest.TOPIK, score=topik, is_planned=False)] if topik else []
    return p


def _program(min_topik=3, min_gpa=70):
    prog = Program(name_en="BBA", degree_level=DegreeLevel.BACHELOR, field="business", instruction_language="KOREAN", tuition_per_semester_krw=5_000_000)
    prog.requirements = [AdmissionRequirement(min_topik_level=min_topik, min_gpa_percent=min_gpa, language_alternative=False)]
    uni = University(name_en="U", region="Seoul", est_living_cost_monthly_krw=1_000_000, institution_type="PRIVATE")
    intake = ProgramIntake(year=2027, term=IntakeTerm.SPRING, application_deadline=date(2026, 12, 31), is_open=True)
    return prog, uni, [intake]


def test_match_strong_with_explanations():
    prog, uni, intakes = _program()
    r = match_program(_profile(topik=4), prog, uni, intakes, [], True, date(2026, 10, 1))
    assert r.eligible and r.tier == "STRONG"
    codes = {x.code for x in r.reasons}
    assert {"TOPIK_EXCEEDS", "GPA_MET", "WITHIN_BUDGET", "FIELD_MATCH"} <= codes
    assert sum(f["points"] for f in r.factors) == pytest.approx(r.score, abs=1)


def test_match_small_language_gap_is_reach_not_hidden():
    prog, uni, intakes = _program(min_topik=3)
    r = match_program(_profile(topik=2), prog, uni, intakes, [], True, date(2026, 10, 1))
    assert r.tier == "REACH"
    assert any(x.code == "LANGUAGE_GAP_SMALL" for x in r.reasons)


def test_match_large_gap_not_eligible():
    prog, uni, intakes = _program(min_topik=5, min_gpa=90)
    r = match_program(_profile(topik=None, gpa=60), prog, uni, intakes, [], True, date(2026, 10, 1))
    assert not r.eligible and r.tier == "NOT_ELIGIBLE"


def test_no_open_intake_blocks():
    prog, uni, intakes = _program()
    r = match_program(_profile(topik=4), prog, uni, intakes, [], True, date(2027, 1, 15))
    assert any(x.code == "NO_OPEN_INTAKE" for x in r.reasons) and not r.eligible


def test_state_machine_rejects_nonsense():
    with pytest.raises(HTTPException) as e:
        check_transition(S.DRAFT, S.OFFERED, "UNIVERSITY")
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        check_transition(S.UNIVERSITY_REVIEW, S.OFFERED, "STUDENT")
    assert e.value.status_code == 403
    check_transition(S.UNIVERSITY_REVIEW, S.OFFERED, "UNIVERSITY")


def test_legalization_paths(db):
    assert legalization_for(db, "NP", "TRANSCRIPT")["path"] == "CONSULAR_LEGALIZATION"
    assert legalization_for(db, "KR", "TRANSCRIPT")["path"] == "NONE"
    vn = legalization_for(db, "VN", "TRANSCRIPT")
    # Vietnam: apostille in force from 2026-09-11 (time-versioned)
    assert vn["path"] == ("APOSTILLE" if date.today() >= date(2026, 9, 11) else "CONSULAR_LEGALIZATION")
    th = legalization_for(db, "TH", "TRANSCRIPT")
    if date.today() < date(2027, 2, 28):
        assert th["path"] == "CONSULAR_LEGALIZATION" and "2027-02-28" in th["note"]
    assert legalization_for(db, "TW", "TRANSCRIPT")["path"] == "UNKNOWN"
