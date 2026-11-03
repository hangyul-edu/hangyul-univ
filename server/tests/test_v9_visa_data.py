"""V9 visa/arrival data — the 2026-10-10 re-validation is in the research files AND in the DB the product reads:
corrected values present, effective-dated rules not applied early, unconfirmed fields never shown as confirmed, and no
country's rule leaking into another country's route."""
import json
import re
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import StudentProfile, User
from app.models.v5_visa_routes import VisaRoute
from app.seed.visa_playbooks import load, load_dataset, materialize
from app.services import concierge
from app.services import visa_routes as vr
from tests.conftest import login

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "docs" / "research"
V9 = "2026-10-10"
DATA = json.loads((RES / "visa-playbooks.json").read_text(encoding="utf-8"))
ARR = {t["key"]: t for t in json.loads((RES / "arrival-official.json").read_text(encoding="utf-8"))}
POST = json.loads((RES / "post-arrival-official.json").read_text(encoding="utf-8"))
REGISTRY = {s["id"]: s for s in json.loads((RES / "v9-visa-sources.json").read_text(encoding="utf-8"))}


def route(country, visa_type):
    return next(r for r in DATA if r["country"] == country and r["visa_type"] == visa_type)


def current(db, country, visa_type) -> VisaRoute:
    return db.scalar(select(VisaRoute).where(VisaRoute.country == country, VisaRoute.visa_type == visa_type, VisaRoute.is_current.is_(True)))


def doc(r, key):
    return next((d for d in r["documents"] if d["key"] == key), None)


# ------------------------------------------------------------------------------------------------ 1. corrected values
def test_corrected_visa_values_are_in_the_research_file():
    for vt in ("D-2-2", "D-2-3", "D-4-1"):
        bd = route("BD", vt)
        assert bd["application_method"]["kind"] == "VISA_CENTER" and "2026-09-02" in bd["application_method"]["details"]
        assert "visit the Embassy consular section in person" not in bd["application_method"]["details"]
        assert "BDT 2,150" in bd["fees"]["center_fee"]
        assert any("VFS" in j["post_name"] for j in bd["jurisdiction"])
        mm = route("MM", vt)
        assert doc(mm, "final_education_certificate")["legalization"] == "NONE" and doc(mm, "other_nrc")
        assert mm["sources"][0]["page_date"].startswith("modified 2026-10-02")
        vn = route("VN", vt)
        assert vn["fees"]["amount"] == 50 and vn["fees"]["currency"] == "USD"
        assert "Kon Tum" in next(j for j in vn["jurisdiction"] if j["city"] == "Da Nang")["covers_regions"]
        assert "12 embassy-accredited agencies" in route("MN", vt)["application_method"]["details"]
        assert "Shanghai: D-2/D-4 within 5 days" in route("CN", vt)["processing_time"]
        assert "New Delhi: application day + 14 working days" in route("IN", vt)["processing_time"]
        assert doc(route("NP", vt), "bank_balance_certificate")["validity"] == "Issued within 1 month of application (KVAC)"
    for vt in ("D-2-2", "D-2-3"):
        pk = route("PK", vt)
        assert pk["fees"]["visa_fee"] == "Single entry > 91 days: Rs 18,000" and "USD 60" not in pk["fees"]["visa_fee"]
        assert pk["processing_time"].startswith("Minimum 8 weeks") and pk["verification_status"] == "VERIFIED"
        assert doc(route("ID", vt.replace("2-2", "2-3")), "final_education_certificate")["legalization"] is None
    assert doc(route("ID", "D-2-2"), "final_education_certificate")["legalization"] == "APOSTILLE"  # high-school level keeps it
    ph = route("PH", "D-2")
    assert [j["covers_regions"] for j in ph["jurisdiction"]] == [["Luzon", "Mindanao"], ["Visayas (16 provinces)"]]
    assert route("TH", "D-2")["fees"]["thai_nationals"] == "FREE"
    assert any("acceded on 5 Apr 2000" in n for n in route("KZ", "D-2-2")["special_notes"])
    assert "X-ray + PCR" in doc(route("KZ", "D-4-1"), "tb_test")["notes"]


def test_national_rule_notes_are_fixed():
    blob = json.dumps(DATA, ensure_ascii=False)
    # Third-country restriction is E-6-2 only — never stated as a D-2/D-4 rule.
    assert "Posts in third countries generally do not accept" not in blob
    assert "lower-tier or visa-restricted universities, or for D-4-1" not in blob
    for r in DATA:
        notes = " ".join(r["special_notes"])
        if "30 days" in notes and "MOJ" in notes and "balance" in notes.lower():
            # The MOJ 30-day bank-certificate rule is national only for D-4.
            assert ("[MOJ national rule, D-4]" in notes) == (r["visa_type"] == "D-4-1"), (r["country"], r["visa_type"])
        assert "비자심사강화대학" in r["e_visa_condition"] or r["visa_type"] == "D-4-1"
    for c in ("IN", "BD"):
        for r in DATA:
            if r["country"] == c and r["visa_type"] != "D-4-1":
                assert "valid if issued within 30 days" not in r["financial"]["sponsor_rules"]


def test_every_change_has_provenance_from_the_registry():
    for r in DATA:
        p = r["v9_revalidation"]
        assert p["verified_at"] == V9 and p["changes"], (r["country"], r["visa_type"])
        for ch in p["changes"] + p["confirmed"]:
            assert ch["verified_at"] == V9 and ch["sources"]
            for s in ch["sources"]:
                assert REGISTRY[s["id"]]["url"] == s["url"]
                assert any(x.get("url") == s["url"] and x.get("verified_at") == V9 for x in r["sources"])


def test_corrected_routes_are_live_in_the_db_as_new_versions(db):
    assert load(db) == {"created": 0, "updated": 0, "unchanged": 41, "total": 41}  # idempotent
    for country, vt in (("BD", "D-2-2"), ("MM", "D-2-2"), ("KG", "D-2"), ("PK", "D-2-2")):
        r = current(db, country, vt)
        assert r.verified_at == date(2026, 10, 10) and r.content_hash == vr._route_hash(materialize([route(country, vt)], date.today())[0])
    bd = current(db, "BD", "D-2-2")
    posts = vr.posts_of(bd)
    assert [p["kind"] for p in posts] == ["embassy", "centre"] and vr.jurisdiction(bd)["mode"] == "centre"
    assert vr.post_method(bd, posts[0]) == "VISA_CENTRE"
    mm = current(db, "MM", "D-2-2")
    assert any(d.key == "other_nrc" for d in vr.route_documents(db, mm))
    ph = current(db, "PH", "D-2")
    j = vr.jurisdiction(ph)
    assert j["mode"] == "regional" and {o["label"] for o in j["question"]["options"]} == {"Luzon", "Mindanao", "Visayas"}
    # History is kept: a changed playbook becomes a new version, the old one stays (not current).
    changed = [dict(r) for r in load_dataset()]
    i = next(k for k, r in enumerate(changed) if r["country"] == "NP" and r["visa_type"] == "D-2-2")
    changed[i] = {**changed[i], "processing_time": "changed for the test"}
    assert vr.load_playbooks(db, data=changed)["updated"] == 1
    rows = db.scalars(select(VisaRoute).where(VisaRoute.country == "NP", VisaRoute.visa_type == "D-2-2").order_by(VisaRoute.version)).all()
    assert rows[-1].is_current and not rows[-2].is_current and rows[-1].version == rows[-2].version + 1
    db.rollback()


def test_bangladeshi_student_sees_the_vfs_centre(client, db):
    email = db.scalar(select(User.email).join(StudentProfile, StudentProfile.user_id == User.id)
                      .where(StudentProfile.nationality == "BD", StudentProfile.residence_country.in_(("BD", None))).order_by(User.email).limit(1))
    if email is None:
        pytest.skip("no Bangladeshi student in the seed")
    p = client.get("/api/v1/me/visa-route", headers=login(client, email, "student")).json()
    if p["status"] in ("NEEDS_PROGRAM", "IN_KOREA"):
        pytest.skip(f"persona not resolvable: {p['status']}")
    assert p["route"]["country"] == "BD" and p["centre"]["kind"] == "centre" and "VFS" in p["centre"]["name_en"]
    assert p["method"]["code"] in ("VISA_CENTRE", "CCVI", "E_VISA_UNIVERSITY") and "BDT 2,150" in p["method"]["fees"]["details"]


def test_myanmar_persona_shows_the_nrc_card(client):
    p = client.get("/api/v1/me/visa-route", headers=login(client, "student.myanmar@demo.hangyul.kr", "student")).json()
    nrc = next(d for d in p["documents"] if d["key"] == "other_nrc")
    assert "NRC card" in nrc["name_en"] and nrc["applies"] == "yes"
    edu = next(d for d in p["documents"] if d["key"] == "final_education_certificate")
    assert edu["legalization"] == "NONE"


def test_arrival_corrections_and_concierge_reads_them(db):
    rc = ARR["residence_report_changes"]
    assert "15 days" in rc["summary"] and "14 days" not in json.dumps(rc["steps"]) + rc["summary"] + rc["timing"]
    assert next(i for i in POST["items"] if i["key"] == "address_change_report")["facts"][0]["status"] == "VERIFIED"
    assert "30-day pass ended" in ARR["transport_card_tmoney"]["summary"]
    assert "Exit 4" in ARR["sim_esim_arrival"]["summary"]
    assert "free" not in ARR["university_airport_pickup"]["summary"].lower()
    assert "No immigration rule requires private insurance" in ARR["private_insurance_bridge"]["summary"]
    assert "WhatsApp" in ARR["emergency_and_helplines"]["summary"]
    assert "FSC" in ARR["bank_account_opening"]["notes"]
    f = concierge.official_facts(db, "address_report")
    assert f["topic"] == "residence_report_changes" and "15 days" in f["summary"]


# ------------------------------------------------------------------------------------------------ 2. effective dates
def _amount_tokens(fin: dict) -> list[str]:
    return re.findall(r"(?:KRW|USD|CNY|NPR|PHP|Rp|UZS)\s?[\d,]+(?:\.\d+)?", fin.get("amount") or "")


def test_kyrgyz_2027_rule_is_stored_but_not_applied_before_its_date(db):
    for vt, now_amt, new_amt in (("D-2", "USD 20,000", "USD 15,500"), ("D-4-1", "USD 10,000", "USD 7,800")):
        r = route("KG", vt)
        sc = r["scheduled_changes"][0]
        assert sc["effective_from"] == "2027-01-01" and sc["status"] == "ANNOUNCED_NOT_IN_FORCE"
        assert _amount_tokens(r["financial"]) == [now_amt]
        before = materialize([r], date(2026, 12, 31))[0]
        assert before == r  # nothing applied a day early
        after = materialize([r], date(2027, 1, 1))[0]
        assert _amount_tokens(after["financial"])[0] == new_amt and "KICB" in after["financial"]["holding_period"]
        assert "Tunduk" in doc(after, "sponsor_documents")["notes"] and after["scheduled_changes"][0]["status"] == "IN_FORCE"
        assert not any(n.startswith("Announced by the embassy") for n in after["special_notes"])
        # The live DB route (today < 2027-01-01) carries only the current figure.
        if date.today() < date(2027, 1, 1):
            cur = current(db, "KG", vt)
            assert vr._financial(cur)["amounts"] == [now_amt] and "KICB" not in json.dumps(cur.financial)


def test_announced_moj_plans_are_watch_items_not_rules():
    for r in DATA:
        w = r["v9_revalidation"]["watch_items"][0]
        assert w["in_force"] is False and w["sources"] == ["V9V-S8"]
        rules = " ".join(r["special_notes"]) + r["e_visa_condition"] + json.dumps(r["financial"]) + json.dumps([d.get("notes") for d in r["documents"]])
        assert "KIIP 4" not in rules and "deposit scheme" not in rules
        assert "NOT in force" in r["reviewer_notes"]


# ------------------------------------------------------------------------------------------------ 3. unconfirmed never shown as confirmed
def test_unconfirmed_fields_keep_the_route_partial():
    verified = {(r["country"], r["visa_type"]) for r in DATA if r["verification_status"] == "VERIFIED"}
    assert verified == {("MN", "D-2-2"), ("MN", "D-2-3"), ("MN", "D-4-1"), ("PK", "D-2-2"), ("PK", "D-2-3")}
    for r in DATA:
        unc = r["v9_revalidation"]["unconfirmed"]
        assert bool(unc) == (r["verification_status"] != "VERIFIED"), (r["country"], r["visa_type"])
        for u in unc:
            assert u["status"] == "STILL_UNCONFIRMED" and "post" in u["needs"]
    assert route("PK", "D-4-1")["verification_status"] == "NEEDS_REVIEW" and route("PK", "D-4-1")["documents"] == []
    # Unknown values stay unknown: no amount invented.
    for c in ("UZ",):
        for r in DATA:
            if r["country"] == c:
                assert not (isinstance(r["fees"], dict) and r["fees"].get("amount"))
    for c, vt in (("TH", "D-2"), ("BD", "D-2-2"), ("IN", "D-2-2")):
        assert route(c, vt)["financial"]["amount"] is None


def test_unconfirmed_arrival_facts_are_not_verified():
    for t in ARR.values():
        p = t["v9_revalidation"]
        if p["unconfirmed"]:
            assert t["verification_status"] != "VERIFIED", t["key"]
    assert ARR["residence_card_registration"]["verification_status"] == "PARTIAL"
    assert "cash only" not in json.dumps(ARR["residence_card_registration"]["documents"]).replace("says cash only", "")


def test_partial_route_shows_the_caveat_in_the_api(client):
    p = client.get("/api/v1/me/visa-route", headers=login(client, "student.myanmar@demo.hangyul.kr", "student")).json()
    assert p["route"]["verification_status"] == "PARTIAL" and p["caveats"][0]["code"] == "ROUTE_PARTIAL"


# ------------------------------------------------------------------------------------------------ 4. no cross-country leaks
COUNTRY_SOURCES = {"NP": (12, 20), "MM": (21, 26), "BD": (27, 35), "VN": (36, 48), "TH": (49, 52), "PH": (53, 60), "UZ": (61, 67),
                   "MN": (68, 75), "KZ": (76, 81), "KG": (82, 86), "CN": (87, 95), "IN": (96, 103), "PK": (104, 111), "ID": (112, 117)}
SPECIFIC = {"BDT 2,150": "BD", "visaforkorea-bd": "BD", "KICB": "KG", "Tunduk": "KG", "Rs 18,000": "PK", "Kon Tum": "VN",
            "NPR 2,000": "NP", "57,000 MNT": "MN", "灵浠中心": "CN", "Luzon": "PH", "Record of passport": "TH", "115 designated": "ID",
            "вплоть до даты въезда": "KZ", "INR 5,400": "IN"}


def test_no_country_rule_leaks_into_another_country():
    for r in DATA:
        blob = json.dumps({k: v for k, v in r.items() if k != "v9_revalidation"}, ensure_ascii=False)
        for marker, owner in SPECIFIC.items():
            if marker in blob:
                assert r["country"] == owner, f"{marker!r} found on {r['country']} {r['visa_type']}"
        lo, hi = COUNTRY_SOURCES[r["country"]]
        for s in r["sources"]:
            if s.get("id", "").startswith("V9V-S"):
                n = int(s["id"].split("S")[-1])
                assert n <= 11 or lo <= n <= hi, f"{s['id']} cited on {r['country']} {r['visa_type']}"
        for sc in r.get("scheduled_changes") or []:
            assert r["country"] == "KG"
    for marker, owner in SPECIFIC.items():
        assert any(marker in json.dumps(r, ensure_ascii=False) for r in DATA if r["country"] == owner), marker


def test_resolver_never_uses_another_countrys_route(db):
    for c in COUNTRY_SOURCES:
        for r in db.scalars(select(VisaRoute).where(VisaRoute.country == c, VisaRoute.is_current.is_(True))):
            got = vr.find_route(db, c, r.visa_type, None)
            assert got is not None and got.country == c
