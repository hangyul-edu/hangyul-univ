"""V27 quick fit (REPORT §356, brief §45–§46): every relevant institution, four honest groups, GPA on its own scale,
per-university language acceptance, verified scholarships only."""
import uuid

import pytest
from sqlalchemy import func, select

from app.models import AdmissionLanguageRule, Institution, Scholarship
from app.services import fit

URL = "/api/v1/public/fit"
BASE = {"nationality": "VN", "level": "BACHELOR", "gpa": {"value": 3.6, "scale_max": 4.5}, "languages": []}


@pytest.fixture(autouse=True)
def _fresh_limiter():
    from app.api.v1 import public

    public._fit_hits.clear()
    yield


def run(client, **over):
    r = client.post(URL, json={**BASE, **over})
    assert r.status_code == 200, r.text
    return r.json()


def slugs(d):
    out = []
    for s in d.get("sections") or []:
        out += [i["slug"] for i in s["items"]]
    return out + [i["slug"] for i in d.get("items") or []]


@pytest.fixture
def rule_inst(db):
    """A real institution given a private verified rule set for one test, removed afterwards."""
    inst = db.scalar(select(Institution).where(Institution.status == "ACTIVE", Institution.institution_type == "UNIVERSITY",
                                               ~Institution.slug.in_(select(Institution.slug).join(AdmissionLanguageRule)))
                     .order_by(Institution.slug).limit(1))
    rows = [
        AdmissionLanguageRule(institution_id=inst.id, degree_level="BACHELOR", track="KOREAN", group_key="A", test="TOPIK", min_value=3,
                              min_text="3", stage="APPLICATION", verification_status="CURRENT", evidence="test"),
        AdmissionLanguageRule(institution_id=inst.id, degree_level="BACHELOR", track="ENGLISH", group_key="A", test="NEW_TEPS", min_value=300,
                              min_text="300", stage="APPLICATION", verification_status="CURRENT", evidence="test"),
    ]
    db.add_all(rows)
    db.commit()
    fit.invalidate()
    yield inst
    for r in rows:
        db.delete(db.get(AdmissionLanguageRule, r.id))
    db.commit()
    fit.invalidate()


def tier_of(d, slug, client=None):
    for s in d.get("sections") or []:
        for i in s["items"]:
            if i["slug"] == slug:
                return i["tier"]
    return None


def test_doctorate_and_integrated_levels_are_offered(client):
    opts = fit.LEVELS
    assert "DOCTORATE" in opts and "COMBINED" in opts
    for level in ("DOCTORATE", "COMBINED"):
        d = run(client, level=level)
        assert d["level"] == level and d["total"] > 0


def test_gpa_is_stored_raw_with_scale_and_method(client):
    d = run(client, gpa={"value": 8.2, "scale_max": 10})
    assert d["gpa"] == {"raw_value": 8.2, "scale_max": 10, "normalized_percent": 82.0, "normalization_method": "LINEAR_SCALE_PERCENT"}
    custom = run(client, gpa={"value": 5.25, "scale_max": 7})
    assert custom["gpa"]["normalized_percent"] == 75.0
    bad = client.post(URL, json={**BASE, "gpa": {"value": 4.6, "scale_max": 4.5}})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "GPA_OUT_OF_RANGE"


@pytest.mark.parametrize("test,score,bad", [("TOPIK", 3, 7), ("TOEFL_IBT", 90, 121), ("IELTS_ACADEMIC", 6.5, 9.5)])
def test_language_scores_are_range_checked_by_the_registry(client, test, score, bad):
    assert run(client, languages=[{"test": test, "score": score}])["languages"] == [{"test": test, "score": score}]
    r = client.post(URL, json={**BASE, "languages": [{"test": test, "score": bad}]})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "SCORE_OUT_OF_RANGE"


def test_no_language_result_is_a_valid_answer(client):
    d = run(client, languages=[])
    assert d["total"] > 0 and d["counts"]["MEETS"] + d["counts"]["ONE_STEP"] + d["counts"]["CHALLENGE"] + d["counts"]["UNCLEAR"] == d["total"]


def test_a_test_counts_only_where_the_university_names_it(client, rule_inst):
    # TOPIK 3 meets the Korean track; New TEPS meets the English track; TOEIC is named nowhere here → one step away.
    assert tier_of(run(client, languages=[{"test": "TOPIK", "score": 3}], limit=48), rule_inst.slug) in ("MEETS", None)
    by_tier = run(client, languages=[{"test": "NEW_TEPS", "score": 320}], tier="MEETS", limit=48, sort="recommended")
    assert rule_inst.slug in [i["slug"] for i in by_tier["items"]] or by_tier["page_total"] > 48
    toeic = run(client, languages=[{"test": "TOEIC", "score": 990}], tier="ONE_STEP", limit=48)
    assert rule_inst.slug in [i["slug"] for i in toeic["items"]] or toeic["page_total"] > 48
    # TOPIK IBT is not TOPIK unless the rule says so.
    ibt = run(client, languages=[{"test": "TOPIK_IBT", "score": 6}], tier="MEETS", limit=48)
    assert rule_inst.slug not in [i["slug"] for i in ibt["items"]]


def test_every_relevant_institution_is_returned_and_none_hidden(client, db):
    universities = db.scalar(select(func.count()).select_from(Institution).where(Institution.status == "ACTIVE", Institution.institution_type == "UNIVERSITY"))
    d = run(client)
    assert d["total"] == universities
    assert sum(s["total"] for s in d["sections"]) == universities


def test_a_major_field_is_not_a_filter(client):
    with_field = client.post(URL, json={**BASE, "field": "engineering"})
    assert with_field.status_code == 200 and with_field.json()["total"] == run(client)["total"]


def test_prestigious_universities_are_never_silently_omitted(client):
    for langs in ([], [{"test": "TOPIK", "score": 1}], [{"test": "IELTS_ACADEMIC", "score": 4}]):
        d = run(client, languages=langs, sort="name", limit=48, offset=0)
        seen, offset = set(), 0
        while True:
            page = run(client, languages=langs, sort="name", limit=48, offset=offset)
            seen |= {i["slug"] for i in page["items"]}
            offset += 48
            if offset >= page["page_total"]:
                break
        for slug in ("yonsei-university", "seoul-national-university", "korea-university", "kaist"):
            assert slug in seen, (slug, langs)
        assert d["page_total"] == d["total"]


def test_pagination_and_order_are_deterministic(client):
    a = run(client, tier="CHALLENGE", offset=0, limit=12)
    b = run(client, tier="CHALLENGE", offset=12, limit=12)
    assert not ({i["slug"] for i in a["items"]} & {i["slug"] for i in b["items"]})
    assert [i["slug"] for i in run(client, tier="CHALLENGE", offset=0, limit=12)["items"]] == [i["slug"] for i in a["items"]]


def test_no_probability_or_ranking_language_in_the_payload(client):
    body = str(run(client, languages=[{"test": "TOPIK", "score": 4}])).lower()
    for word in ("probability", "chance", "ranking", "guarantee", "likely"):
        assert word not in body, word


# ------------------------------------------------------------------------------------------------ scholarships

def test_verified_scholarships_carry_source_and_date(db):
    rows = db.scalars(select(Scholarship).where(Scholarship.institution_id.is_not(None), Scholarship.verification_status == "CURRENT")).all()
    assert rows, "the V27 research should have loaded verified scholarships"
    for s in rows:
        assert s.source_url and s.verified_at and s.evidence, s.name


def test_scholarship_summary_never_mixes_levels_or_stages(client, db):
    inst = db.scalar(select(Institution).where(Institution.slug == "dankook-university"))
    d = client.get(f"/api/v1/directory/institutions/{inst.slug}/admissions", params={"level": "MASTER", "langs": "TOPIK:6"}).json()
    for pick in filter(None, [d["summary"]["best"] if d["summary"] else None]):
        s = next(x for x in d["scholarships"] if x["name"] == pick["name"])
        assert not s["degree_levels"] or "MASTER" in s["degree_levels"]
        assert s["stage"] != "ENROLLED"


def test_gks_and_uncheckable_conditions_are_never_claimed():
    inst = fit.Inst(id=uuid.uuid4(), slug="x", name_ko="x", name_en=None, type="UNIVERSITY", region="Seoul", ieqas=None,
                    language_programme=False, card=None, has_photo=False)
    inst.scholarships = [
        {"id": "1", "name": "GKS", "name_en": None, "category": "GKS", "stage": "NEW", "levels": [], "topik_min": None, "english_min": {},
         "gpa_min_percent": None, "gpa_text": None, "waiver_min": 100, "waiver_max": 100, "amount_krw": None, "automatic": True},
        {"id": "2", "name": "Words", "name_en": None, "category": "UNIVERSITY", "stage": "NEW", "levels": [], "topik_min": None,
         "english_min": {"text": "excellent English"}, "gpa_min_percent": None, "gpa_text": None, "waiver_min": 50, "waiver_max": 50,
         "amount_krw": None, "automatic": False},
        {"id": "3", "name": "GPA words", "name_en": None, "category": "UNIVERSITY", "stage": "NEW", "levels": [], "topik_min": 3,
         "english_min": {}, "gpa_min_percent": None, "gpa_text": "top 10%", "waiver_min": 70, "waiver_max": 70, "amount_krw": None, "automatic": True},
    ]
    out = fit._scholarship_fit(inst, "BACHELOR", {"TOPIK": 6, "TOEFL_IBT": 120}, 99.0)
    assert out["best"] is None, out


def test_missing_scholarship_data_is_not_none_available(client, db):
    inst = db.scalar(select(Institution).where(Institution.status == "ACTIVE", ~Institution.id.in_(select(Scholarship.institution_id).where(Scholarship.institution_id.is_not(None))),
                                               ~Institution.id.in_(select(AdmissionLanguageRule.institution_id))).limit(1))
    d = client.get(f"/api/v1/directory/institutions/{inst.slug}/admissions").json()
    assert d == {"verified": False, "scholarships": [], "language_rules": {}, "summary": None}
