from tests.v22_helpers import register_student

"""V3 student journey: first-year budget, indicative FX and "what completing your profile unlocks"."""


def _programs(client, n=2):
    return [p["id"] for p in client.get("/api/v1/programs?page_size=5&degree=BACHELOR").json()["items"][:n]]


def test_budget_lines_are_labelled_and_totals_are_honest(client, student):
    ids = _programs(client)
    r = client.get(f"/api/v1/me/budget?program_ids={','.join(ids)}", headers=student)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "selected"
    assert [i["program_id"] for i in body["items"]] == ids
    for item in body["items"]:
        keys = {ln["key"]: ln for ln in item["lines"]}
        assert {"tuition", "application_fee", "living", "insurance", "visa_fee"} <= keys.keys()
        # Every line says where it comes from; unknown costs are shown, never invented.
        assert all(ln["basis"] in {"OFFICIAL", "SAMPLE", "ESTIMATE", "UNKNOWN"} for ln in item["lines"])
        assert keys["insurance"]["amount_min"] is None and keys["insurance"]["basis"] == "UNKNOWN"
        assert set(item["unknown_keys"]) >= {"insurance", "visa_fee"}
        # A range, not a point: min never exceeds max; living is an estimate range.
        assert item["first_year_min"] <= item["first_year_max"]
        assert keys["living"]["amount_min"] < keys["living"]["amount_max"]
        # Only ELIGIBLE scholarships reduce the total, and at most one of them.
        known_max = sum(ln["amount_max"] for ln in item["lines"] if ln["amount_max"] is not None)
        eligible = [s for s in item["scholarships"] if s["status"] == "ELIGIBLE" and s["amount_max"]]
        best = max(eligible, key=lambda s: s["amount_max"]) if eligible else None
        best_min = (best["amount_min"] or 0) if best else 0
        assert item["first_year_max"] == known_max - best_min
        assert item["cash_before_arrival_min"] <= item["cash_before_arrival_max"] < item["first_year_max"] + 1


def test_budget_defaults_to_the_shortlist_and_requires_a_student(client, student):
    r = client.get("/api/v1/me/budget", headers=student)
    assert r.status_code == 200
    assert r.json()["source"] == "shortlist"
    assert len(r.json()["items"]) >= 1
    assert client.get("/api/v1/me/budget").status_code == 401


def test_budget_housing_switch_changes_living_basis(client, student):
    pid = _programs(client, 1)[0]
    dorm = client.get(f"/api/v1/me/budget?program_ids={pid}&housing=DORM", headers=student).json()["items"][0]
    off = client.get(f"/api/v1/me/budget?program_ids={pid}&housing=OFF_CAMPUS", headers=student).json()["items"][0]
    assert off["housing"] == "OFF_CAMPUS"
    assert not any(ln["key"] == "dormitory" for ln in off["lines"])
    if dorm["housing"] == "DORM":
        # Living without rent is cheaper than living including rent.
        assert dorm["monthly_living_max"] < off["monthly_living_max"]


def test_fx_is_public_and_marked_indicative(client):
    r = client.get("/api/v1/meta/fx")
    assert r.status_code == 200
    body = r.json()
    assert body["base"] == "KRW" and body["indicative"] is True and body["basis"] == "SAMPLE"
    assert body["krw_per_unit"]["USD"] > 0 and body["as_of"]


def test_profile_unlocks_are_derived_from_matches(client, student):
    r = client.get("/api/v1/me/profile/unlocks", headers=student)
    assert r.status_code == 200
    body = r.json()
    keys = [s["key"] for s in body["sections"]]
    assert keys == ["basics", "education", "gpa", "language", "goals", "budget", "documents", "sponsor"]
    assert body["total_programs"] > 0
    for s in body["sections"]:
        assert isinstance(s["complete"], bool)
        assert s["count"] is None or 0 <= s["count"] <= body["total_programs"]


def test_new_student_unlocks_point_at_language(client):
    import uuid
    h = register_student(client, email=f"e2e-unlock-{uuid.uuid4().hex[:8]}@example.com", password="long-enough-pw", full_name="Unlock Test", nationality="VN")["h"]
    lang = next(s for s in client.get("/api/v1/me/profile/unlocks", headers=h).json()["sections"] if s["key"] == "language")
    assert lang["complete"] is False and lang["effect"]["kind"] == "UNBLOCK"
    assert lang["count"] > 0
    assert client.get("/api/v1/me/budget", headers=h).json()["items"] == []
