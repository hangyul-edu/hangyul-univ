"""V27 application requirements (REPORT §357, brief §47): checklists come only from verified official guides; no guide →
ADMISSION_GUIDE_REVIEW_REQUIRED and no checklist; legalization decided on the server per issuing country and date."""
from datetime import date

import pytest
from sqlalchemy import select

from app.models import AdmissionGuide, Application, DocumentRequirement, Program, StudentProfile, University
from app.models.enums import ApplicationStatus as S
from app.services import guides, verification
from app.services.readiness import application_readiness, requirements_for, treatment

PREP = (S.DRAFT, S.DOCUMENT_PREPARATION, S.READY, S.PROFILE_REVIEW)


def apps_where(db, verified: bool):
    out = []
    for a in db.scalars(select(Application).where(Application.status.in_(PREP))).all():
        prog = db.get(Program, a.program_id)
        if (guides.verified_guide(db, prog) is not None) == verified:
            out.append(a)
    return out


def test_verified_guides_exist_with_sources(db):
    gs = db.scalars(select(AdmissionGuide).where(AdmissionGuide.status == "VERIFIED")).all()
    assert gs, "V27 research loads verified 2027 guides"
    for g in gs:
        assert g.source_url and g.verified_at and g.intake_year >= 2026
        reqs = db.scalars(select(DocumentRequirement).where(DocumentRequirement.guide_id == g.id)).all()
        assert reqs and all(r.evidence and r.source_url for r in reqs)


def test_real_guide_requirements_are_complete_rows(db):
    real = db.scalars(select(AdmissionGuide).where(AdmissionGuide.status == "VERIFIED", AdmissionGuide.verification_status == "CURRENT")).all()
    assert real
    for g in real:
        rows = guides.guide_requirements(db, g)
        assert rows and all(r.guide_id == g.id and r.evidence and r.category for r in rows)
        assert any(r.category.value == "PASSPORT" for r in rows), g.title


def test_checklist_is_built_only_from_the_verified_guide(db):
    a = apps_where(db, True)[0]
    prog = db.get(Program, a.program_id)
    guide = guides.verified_guide(db, prog)
    reqs = requirements_for(db, prog, None)
    assert reqs and all(r.guide_id == guide.id for r in reqs)
    assert all(r.verification_status != "DEMO" for r in reqs)


def test_missing_guide_means_review_required_and_no_false_complete(db, client, lotus_counselor):
    a = apps_where(db, False)[0]
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == a.student_user_id))
    pct, items = application_readiness(db, a, prof, date.today())
    assert items == []
    st = guides.state_for(db, a)
    assert st["state"] == "REVIEW_REQUIRED" and st["code"] == "ADMISSION_GUIDE_REVIEW_REQUIRED"
    # the document share is unknown, so readiness cannot read as complete
    assert pct < 100
    queue = guides.review_queue(db)
    assert any(q["kind"] == "MISSING_GUIDE" for q in queue)


def test_nationality_condition_filters_items(db):
    rows = [r for r in db.scalars(select(DocumentRequirement).where(DocumentRequirement.guide_id.is_not(None))).all() if r.applies_to_nationalities]
    if not rows:
        pytest.skip("no nationality-specific item in the verified guides")
    r = rows[0]
    nat = r.applies_to_nationalities[0]
    other = "MN" if nat != "MN" else "VN"
    assert guides.applies(r, nat) is True
    assert guides.applies(r, other) is False


def test_education_country_condition_is_undecided_without_facts(db):
    r = next((x for x in db.scalars(select(DocumentRequirement).where(DocumentRequirement.guide_id.is_not(None))).all()
              if "education_country" in (x.applies_to or {})), None)
    if r is None:
        pytest.skip("no education-country item")
    assert guides.applies(r, "VN", {}) is None
    want = r.applies_to["education_country"]
    want = want[0] if isinstance(want, list) else want
    assert guides.applies(r, "VN", {"education_country": want}) is True


@pytest.mark.parametrize("country,expected", [("MN", "APOSTILLE"), ("KR", "NONE")])
def test_legalization_is_decided_on_the_server(db, country, expected):
    r = db.scalar(select(DocumentRequirement).where(DocumentRequirement.legalization_rule == "APOSTILLE_OR_CONSULAR").limit(1))
    out = treatment(db, r, None, country, date(2026, 10, 29))
    assert out["legalization"] == expected and out["country_basis"] == "nationality"


def test_consular_route_for_a_non_hague_country(db):
    r = db.scalar(select(DocumentRequirement).where(DocumentRequirement.legalization_rule == "APOSTILLE_OR_CONSULAR").limit(1))
    out = treatment(db, r, None, "MM", date(2026, 10, 29))  # Myanmar: LegalizationRule → consular
    assert out["legalization"] == "CONSULAR"


def test_translation_notarization_and_age_are_carried(db):
    r = db.scalar(select(DocumentRequirement).where(DocumentRequirement.guide_id.is_not(None), DocumentRequirement.translation_required.is_(True)).limit(1))
    assert r is not None
    t = treatment(db, r, None, "VN", date(2026, 10, 29))
    assert t["translation"] is True
    aged = db.scalar(select(DocumentRequirement).where(DocumentRequirement.guide_id.is_not(None), DocumentRequirement.max_age_days.is_not(None)).limit(1))
    if aged is not None:
        assert aged.max_age_days > 0


def test_ready_is_refused_without_a_verified_guide(db, client, lotus_counselor):
    for a in apps_where(db, False):
        if a.status in (S.DOCUMENT_PREPARATION,):
            r = client.post(f"/api/v1/applications/{a.id}/transition", json={"to": "READY"}, headers=lotus_counselor)
            if r.status_code == 404:
                continue
            assert r.status_code == 409 and r.json()["detail"]["code"] == "ADMISSION_GUIDE_REVIEW_REQUIRED", r.text
            return
    pytest.skip("no reachable preparing application without a guide for this counselor")


def test_conflicts_and_stale_guides_reach_the_review_queue(db):
    kinds = {q["kind"] for q in guides.review_queue(db)}
    stale = db.scalar(select(AdmissionGuide).where(AdmissionGuide.status == "STALE").limit(1))
    if stale is not None:
        assert "STALE" in kinds
    if db.scalar(select(AdmissionGuide).where(AdmissionGuide.conflicts.is_not(None)).limit(1)) is not None:
        assert "CONFLICT" in kinds


def test_demo_rows_never_build_a_checklist(db):
    for prog in db.scalars(select(Program)).all():
        for r in requirements_for(db, prog, None):
            assert r.verification_status != "DEMO"


# ------------------------------------------------------------------------------------------------ delivery reasons

@pytest.mark.parametrize("code,reason,retry", [
    ("MAIL_UNREACHABLE", "UNREACHABLE", 30), ("SMS_UNREACHABLE", "UNREACHABLE", 30),
    ("SMS_PROVIDER_21211", "RECIPIENT_INVALID", None), ("SMS_PROVIDER_21408", "REGION_UNSUPPORTED", None),
    ("SMS_PROVIDER_21610", "RECIPIENT_REJECTED", None), ("MAIL_HTTP_400", "RECIPIENT_INVALID", None),
    ("MAIL_HTTP_401", "SERVICE_CONFIG", 60), ("SMS_PROVIDER_20003", "SERVICE_CONFIG", 60),
])
def test_delivery_failures_map_to_actionable_reasons(code, reason, retry):
    assert verification.delivery_reason(code) == (reason, retry)


def test_universities_with_verified_guides_are_catalogue_universities(db):
    for g in db.scalars(select(AdmissionGuide).where(AdmissionGuide.status == "VERIFIED")).all():
        if g.university_id:
            assert db.get(University, g.university_id) is not None
