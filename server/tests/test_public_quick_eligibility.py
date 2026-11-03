"""Anonymous quick eligibility: value before sign-up, same rules engine, nothing stored."""
from app.api.v1 import public
from app.models import StudentProfile, User

URL = "/api/v1/public/quick-eligibility"


def check(client, **body):
    return client.post(URL, json=body)


def test_counts_tiers_and_sample(client):
    r = check(client, nationality="VN", degree="BACHELOR", language={"kind": "TOPIK", "level": 3})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["engine_version"]
    assert d["meets_count"] + d["possible_count"] + d["not_yet_count"] >= d["total_open"] > 0
    assert d["meets_count"] > 0
    assert 0 < len(d["sample"]) <= 6
    order = {"STRONG": 0, "POSSIBLE": 1, "NOT_YET": 2}
    tiers = [s["tier"] for s in d["sample"]]
    assert tiers == sorted(tiers, key=order.get), "best first"
    assert all(s["degree_level"] == "BACHELOR" for s in d["sample"])
    assert d["data_quality"]["status"] in ("SAMPLE", "MIXED", "VERIFIED") and d["data_quality"]["note"]


def test_better_score_never_reduces_matches_and_unlock_is_consistent(client):
    low = check(client, nationality="VN", degree="BACHELOR", language={"kind": "TOPIK", "level": 2}).json()
    high = check(client, nationality="VN", degree="BACHELOR", language={"kind": "TOPIK", "level": 3}).json()
    assert high["meets_count"] >= low["meets_count"]
    assert low["unlock"]["kind"] == "TOPIK" and low["unlock"]["level"] == 3
    assert low["unlock"]["additional_count"] == high["meets_count"] - low["meets_count"]


def test_no_language_suggests_topik_and_english_takers_get_ielts(client):
    none = check(client, nationality="VN", degree="BACHELOR", language={"kind": "NONE"}).json()
    assert none["unlock"] is None or none["unlock"]["kind"] == "TOPIK"
    ielts = check(client, nationality="CN", degree="MASTER", language={"kind": "IELTS", "level": 5.5}).json()
    assert ielts["unlock"] is None or ielts["unlock"]["kind"] == "IELTS"


def test_nothing_is_persisted(client, seeded_db):
    from app.core.db import SessionLocal
    with SessionLocal() as db:
        before = (db.query(User).count(), db.query(StudentProfile).count())
    check(client, nationality="UZ", degree="LANGUAGE", language={"kind": "PREPARING"})
    with SessionLocal() as db:
        assert (db.query(User).count(), db.query(StudentProfile).count()) == before


def test_validation(client):
    assert check(client, nationality="VN", degree="BACHELOR", language={"kind": "TOPIK"}).status_code == 422
    assert check(client, nationality="VN", degree="BACHELOR", language={"kind": "TOPIK", "level": 9}).status_code == 422
    assert check(client, nationality="VN", degree="NOPE", language={"kind": "NONE"}).status_code == 422
    assert check(client, nationality="VNM", degree="BACHELOR", language={"kind": "NONE"}).status_code == 422
    assert client.get(URL + "/options").json()["degrees"][0] == "LANGUAGE"


def test_rate_limit(client, monkeypatch):
    public._hits.clear()
    monkeypatch.setattr(public, "RATE_LIMIT", 3)
    codes = [check(client, nationality="VN", degree="LANGUAGE", language={"kind": "NONE"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    public._hits.clear()
