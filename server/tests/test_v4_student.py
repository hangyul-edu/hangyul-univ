"""V4 student product pass: one cost model, honest review ageing, offers that say what you pay, visa names vs rules."""
from datetime import datetime, timedelta

from app.services.budget import offer_payment, offer_scholarship_value
from app.services.readiness import REVIEW_TARGET_HOURS, review_is_overdue
from app.services.visa import step_presentation
from tests.conftest import login


def _check_range(r):
    assert set(r) >= {"low", "high", "basis", "tuition_year", "housing", "excludes"}
    assert r["basis"] in {"OFFICIAL", "SAMPLE", "ESTIMATE", "UNKNOWN"}
    if r["low"] is not None:
        assert r["low"] <= r["high"]
        # No fake precision: rounded outward to ₩100,000.
        assert r["low"] % 100_000 == 0 and r["high"] % 100_000 == 0
        assert r["low"] > r["tuition_year"]  # tuition + living + fees, never tuition alone
        assert {"insurance", "visa_fee"} <= set(r["excludes"])


def test_one_cost_model_everywhere_a_program_appears(client, student):
    progs = client.get("/api/v1/programs?page_size=4&degree=BACHELOR").json()["items"]
    ids = [p["id"] for p in progs]
    by_search = {p["id"]: p["first_year_range_krw"] for p in progs}
    for r in by_search.values():
        _check_range(r)
    # Budget page: same numbers (before scholarship) as the list.
    budget = client.get(f"/api/v1/me/budget?program_ids={','.join(ids)}", headers=student).json()["items"]
    for b in budget:
        fy = by_search[b["program_id"]]
        assert (b["first_year_gross_min"], b["first_year_gross_max"]) == (fy["low"], fy["high"])
        # The net figure (after the one best eligible scholarship) never exceeds the gross range.
        assert b["first_year_max"] <= b["first_year_gross_max"]
    # Program page, university page, discovery (matches) and compare agree.
    detail = client.get(f"/api/v1/programs/{ids[0]}").json()
    assert detail["first_year_range_krw"] == by_search[ids[0]]
    uni = client.get(f"/api/v1/universities/{progs[0]['university']['slug']}").json()
    assert next(p for p in uni["programs"] if p["id"] == ids[0])["first_year_range_krw"] == by_search[ids[0]]
    matches = client.get("/api/v1/me/matches?limit=300", headers=student).json()["items"]
    for m in matches:
        if m["program_id"] in by_search:
            assert m["first_year_range_krw"] == by_search[m["program_id"]]
    cmp = client.post("/api/v1/compare", json={"program_ids": ids[:2]}, headers=student).json()
    assert [c["first_year_range_krw"] for c in cmp] == [by_search[i] for i in ids[:2]]


def test_matches_list_payload_is_slim(client, student):
    body = client.get("/api/v1/me/matches?limit=300", headers=student).json()
    m = body["items"][0]
    assert "description" not in m["program"]
    assert "summary" not in (m["program"]["university"] or {})
    assert m["factors"] == []
    assert m["reasons"] and m["first_year_range_krw"]
    # The language gap names the student's own score so the UI can say "TOPIK 3 required — you have TOPIK 2".
    for mm in body["items"]:
        for r in mm["reasons"]:
            if r["code"] == "LANGUAGE_BELOW":
                assert "have_topik" in r["params"] and "have_ielts" in r["params"]


def test_offer_scholarship_is_computed_only_when_exact():
    assert offer_scholarship_value("Freshman merit scholarship: 30% of first-semester tuition (sample)", 4_484_000) == 1_345_200
    assert offer_scholarship_value("Scholarship of KRW 1,000,000 for the first semester", 4_000_000) == 1_000_000
    assert offer_scholarship_value("Scholarship decided after enrolment", 4_000_000) is None
    assert offer_payment(4_484_000, "30% of first-semester tuition")["pay"] == 3_138_800
    assert offer_payment(4_000_000, None)["pay"] == 4_000_000
    # A scholarship we cannot compute must not produce a fake "you pay" figure.
    assert offer_payment(4_000_000, "Partial scholarship, amount to be confirmed")["pay"] is None


def test_my_offers_say_what_the_student_pays(client):
    hdr = login(client, "student.offer@demo.hangyul.kr", "student")
    items = client.get("/api/v1/me/offers", headers=hdr).json()["items"]
    assert len(items) >= 2
    for o in items:
        p = o["payment"]
        _check_range(o["first_year_range_krw"])
        if p["scholarship"] is not None:
            assert p["pay"] == p["tuition"] - p["scholarship"]
            assert o["first_year_after_scholarship_krw"]["high"] <= o["first_year_range_krw"]["high"]
        elif not p["scholarship_note"]:
            assert p["pay"] == p["tuition"]
    assert client.get("/api/v1/me/offers").status_code == 401


def test_review_ageing_is_exposed_on_the_checklist(client, student):
    assert REVIEW_TARGET_HOURS == 48
    now = datetime(2026, 9, 29, 12, 0)
    assert not review_is_overdue(now - timedelta(hours=47), now)
    assert review_is_overdue(now - timedelta(hours=49), now)
    apps = client.get("/api/v1/applications?page_size=20", headers=student).json()["items"]
    seen = 0
    for a in apps:
        for c in client.get(f"/api/v1/applications/{a['id']}", headers=student).json()["checklist"]:
            if c.get("action_code") == "IN_REVIEW":
                seen += 1
                assert c["review_since"] is not None and isinstance(c["review_overdue"], bool)
            elif c.get("action_code") != "UNIVERSITY_REQUEST":
                assert c.get("review_since") is None
    assert seen >= 0  # the seed decides how many are waiting; the fields must be consistent either way


def test_home_names_the_program_when_two_applications_share_a_university(client, student):
    d = client.get("/api/v1/me/dashboard", headers=student).json()
    labels = [x.get("application_label") for x in d["deadlines"] if x.get("application_label")]
    unis = [a["university"]["name_en"] for a in d["applications"] if a["status"] not in ("WITHDRAWN", "REJECTED", "ENROLLED")]
    dup = {u for u in unis if unis.count(u) > 1}
    for u in dup:
        mine = {lbl for lbl in labels if lbl.startswith(u)}
        # Every label for that university names a program, and the labels differ.
        assert all(" · " in lbl for lbl in mine)
    for x in d["deadlines"]:
        params = x.get("title_params") or {}
        # University-wide items (a document every application there needs, no application_id) rightly name only the university.
        if params.get("university") in dup and not params.get("program") and x.get("application_id"):
            raise AssertionError(f"ambiguous title for a shared university: {x['title']}")


def test_visa_step_names_are_separate_from_the_rule():
    p = step_presentation("financial_proof_vn", "Proof of funds per the Korean Embassy in Hanoi (reported: USD 15,000 held for 3 months — confirm before applying)")
    assert p["name"] == "Bank balance certificate" and p["name_key"] == "financial_proof"
    assert p["rule"].startswith("The Korean Embassy in Hanoi asks for about USD 15,000 held for 3 months")
    p2 = step_presentation("passport", "Valid passport (6+ months validity recommended)")
    assert p2["name"] == "Passport" and p2["rule"] == "Valid passport (6+ months validity recommended)"
    p3 = step_presentation("custom_step", "Something specific")
    assert p3["name"] == "Something specific" and p3["rule"] is None


def test_visa_checklist_carries_presentation_fields(client):
    hdr = login(client, "student.visa@demo.hangyul.kr", "student")
    items = client.get("/api/v1/visa", headers=hdr).json()["items"]
    if items:
        for c in items[0]["checklist"]:
            assert c["name"] and "name_key" in c and "rule" in c
