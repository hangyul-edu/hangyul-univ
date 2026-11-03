"""V5 visa concierge — route resolver, reuse statuses, timing, form, tenant isolation, Burmese coverage.
(The state-changing flow lives in test_v5_visa_flow.py, which runs after this file.)"""
import copy
import json
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import Application, University, User, VisaCase
from app.models.enums import DegreeLevel
from app.models.v5_visa_routes import VisaCaseTrack, VisaRoute
from app.services import concierge, dossier
from app.services import visa_routes as vr
from tests.conftest import login

ROOT = Path(__file__).resolve().parents[2]
MM = "student.myanmar@demo.hangyul.kr"
NP = "student.nepal@demo.hangyul.kr"
MN = "student.visaroute@demo.hangyul.kr"
VN = "student.visa@demo.hangyul.kr"


def uid(db, email):
    return db.scalar(select(User.id).where(User.email == email))


# ------------------------------------------------------------------------------------------------ data
def test_playbooks_are_loaded_versioned_and_idempotent(db):
    assert db.scalar(select(VisaRoute).where(VisaRoute.is_current.is_(True)).limit(1)) is not None
    assert vr.load_playbooks(db) == {"created": 0, "updated": 0, "unchanged": 41, "total": 41}
    data = json.loads((ROOT / vr.DATASET).read_text())
    changed = copy.deepcopy(data)
    np22 = next(r for r in changed if r["country"] == "NP" and r["visa_type"] == "D-2-2")
    np22["processing_time"] = "changed for the test"
    res = vr.load_playbooks(db, data=changed)
    assert res["updated"] == 1 and res["unchanged"] == 40
    rows = db.scalars(select(VisaRoute).where(VisaRoute.country == "NP", VisaRoute.visa_type == "D-2-2").order_by(VisaRoute.version)).all()
    assert [r.is_current for r in rows] == [False, True] and rows[-1].version == 2
    db.rollback()
    # Research status is kept as-is (never upgraded) and each route carries its sources.
    pk = db.scalar(select(VisaRoute).where(VisaRoute.country == "PK", VisaRoute.visa_type == "D-4-1", VisaRoute.is_current.is_(True)))
    assert pk.verification_status == "NEEDS_REVIEW"
    mm = db.scalar(select(VisaRoute).where(VisaRoute.country == "MM", VisaRoute.visa_type == "D-2-2", VisaRoute.is_current.is_(True)))
    # V9 re-validation (2026-10-10) refreshed every route's sources (was 2026-09-29).
    assert mm.verification_status == "PARTIAL" and mm.sources and mm.verified_at == date(2026, 10, 10)


def test_validity_parsing():
    assert vr.parse_validity_days("Issued within 30 days of the visa application") == 30
    assert vr.parse_validity_days("issued within 2 weeks of application") == 14
    assert vr.parse_validity_days("Issued within 10 days of application") == 10
    assert vr.parse_validity_days("3 months from the visa application date") == 90
    assert vr.parse_validity_days("statement covering last 6 months") is None
    assert vr.parse_validity_days(None) is None


# ------------------------------------------------------------------------------------------------ resolver per country
def test_nepal_resolves_to_its_own_playbook_before_admission(client):
    h = login(client, NP, "student")
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    assert p["status"] == "RESOLVED" and p["preview"] is True and p["case"] is None
    assert p["route"]["country"] == "NP" and p["route"]["visa_type"] == "D-2-2"
    # V9: PARTIAL since the Embassy (6 months) and KVAC (3 months) disagree on document validity.
    assert p["route"]["verification_status"] == "PARTIAL"
    assert p["post"]["city"] == "Kathmandu" and p["centre"]["kind"] == "centre"
    assert p["method"]["code"] == "VISA_CENTRE" and p["method"]["note_code"] == "INTAKE_WINDOWS"
    keys = {d["key"] for d in p["documents"]}
    assert {"other_cover_letter", "other_study_plan", "tb_test"} <= keys
    # Nepal education documents: consular confirmation (not an Apostille party) — the persona's copies are confirmed.
    edu = next(d for d in p["documents"] if d["key"] == "final_education_certificate")
    assert edu["legalization"] == "CONSULAR" and edu["status"] in ("READY", "NEW_FOR_VISA")
    assert p["route"]["sources"] and p["route"]["verified_at"]


def test_myanmar_resolves_with_partial_caveats_reuse_and_timing(client, db):
    h = login(client, MM, "student")
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    assert p["status"] == "RESOLVED" and p["route"]["country"] == "MM" and p["route"]["visa_type"] == "D-2-2"
    assert p["post"]["key"] == "yangon" and p["method"]["code"] == "IN_PERSON" and p["method"]["note_code"] == "WAITING_NUMBER"
    codes = [c["code"] for c in p["caveats"]]
    # V9: the 2026-10-10 revalidation settled Myanmar legalization (notarised translation only) → no LEGALIZATION_UNCLEAR caveat.
    assert codes[0] == "ROUTE_PARTIAL" and "LEGALIZATION_UNCLEAR" not in codes and "EVISA_TIER_UNKNOWN" in codes
    docs = {d["key"]: d for d in p["documents"]}
    assert docs["passport"]["status"] == "READY" and docs["passport"]["reused"]
    assert docs["final_education_certificate"]["status"] == "READY"  # consular-confirmed copy in the dossier
    assert docs["family_relation_certificate"]["status"] == "READY"
    assert docs["sponsor_documents"]["applies"] == "yes"  # parents sponsor
    assert docs["other_scholarship_certificate"]["applies"] == "no"
    assert docs["tb_test"]["status"] == "NEW_FOR_VISA" and docs["tb_test"]["who"] == "authority"
    assert docs["business_registration"]["status"] == "WAITING_UNIVERSITY"
    # Bank certificate from 12 days ago is too old on the planned date 25 days out (30-day rule): new one, with the date.
    bank = docs["bank_balance_certificate"]
    appt = date.fromisoformat(p["case"]["appointment"]["on"])
    assert bank["status"] == "NEW_FOR_VISA" and bank["timing"]["get_after"] == (appt - timedelta(days=30)).isoformat()
    assert p["display_status"] == "PREPARING" and p["next"]["key"] == "document"
    assert p["form"]["declarations"] is False


def test_vietnam_post_depends_on_the_region_answer(client, db):
    h = login(client, VN, "student")
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    assert p["status"] == "NEEDS_ANSWER" and p["question"]["kind"] == "residence_region" and len(p["question"]["options"]) == 3
    assert p["next"]["key"] == "choose_post"
    try:
        r = client.put("/api/v1/me/visa-route/answers", json={"value": "da-nang"}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["post"]["key"] == "da-nang" and r.json()["method"]["code"] == "APPOINTMENT" and r.json()["method"]["note_code"] == "G4K_BOOKING"
        r = client.put("/api/v1/me/visa-route/answers", json={"value": "hanoi"}, headers=h).json()
        assert r["post"]["key"] == "hanoi" and r["method"]["code"] == "VISA_CENTRE" and r["status"] == "RESOLVED"
        assert client.put("/api/v1/me/visa-route/answers", json={"value": "nowhere"}, headers=h).status_code == 422
    finally:
        vr.set_answers(db, uid(db, VN), {"post_key": None, "region_label": None, "question_kind": None})
        db.commit()


def test_china_post_follows_the_hukou_province(db):
    route = db.scalar(select(VisaRoute).where(VisaRoute.country == "CN", VisaRoute.visa_type == "D-2-2", VisaRoute.is_current.is_(True)))
    j = vr.jurisdiction(route)
    assert j["mode"] == "regional" and j["question"]["kind"] == "hukou"
    opts = {o["label"]: o["post_key"] for o in j["question"]["options"]}
    assert opts["Shandong"] == "qingdao" and opts["Guangdong"] == "guangzhou" and opts["Sichuan"] == "chengdu" and opts["Liaoning"] == "shenyang"
    # A Chinese student: the answer picks the post, the method comes from that post's intake.
    cn = db.scalar(select(User).join(VisaCase, VisaCase.student_user_id == User.id).where(User.email.like("student%@demo.hangyul.kr"))
                   .join(Application, Application.id == VisaCase.application_id).where(User.locale == "zh-Hans").limit(1))
    assert cn is not None
    p = vr.resolve(db, cn.id)
    assert p["status"] == "NEEDS_ANSWER" and p["question"]["kind"] == "hukou"
    vr.set_answers(db, cn.id, {"post_key": "qingdao", "region_label": "Shandong"})
    p = vr.resolve(db, cn.id)
    assert p["post"]["key"] == "qingdao" and p["status"] == "RESOLVED"
    db.rollback()


def test_india_asks_the_passport_place_of_issue(db):
    route = db.scalar(select(VisaRoute).where(VisaRoute.country == "IN", VisaRoute.visa_type == "D-2-2", VisaRoute.is_current.is_(True)))
    j = vr.jurisdiction(route)
    assert j["question"]["kind"] == "passport_place"
    opts = {o["label"]: o["post_key"] for o in j["question"]["options"]}
    assert opts["Maharashtra"] == "mumbai" and opts["Kerala"] == "chennai" and opts["Delhi"] == "new-delhi"


def test_e_visa_only_when_the_university_tier_allows():
    nm = vr.national_method
    assert nm(True, "MM", "D-2-2", "EXCELLENT") == (True, False)
    assert nm(True, "MM", "D-2-2", "CERTIFIED") == (False, False)  # certified: master's/doctoral only
    assert nm(True, "MM", "D-2-3", "CERTIFIED") == (True, False)
    assert nm(True, "MM", "D-2-2", "UNKNOWN") == (False, False)  # never inferred
    assert nm(True, "MM", "D-2-2", "GENERAL") == (False, False)
    assert nm(False, "VN", "D-4-1", "EXCELLENT") == (False, False)  # no e-visa for D-4-1
    assert nm(False, "VN", "D-4-1", "GENERAL") == (False, True)  # CCVI required
    assert nm(False, "NP", "D-4-1", "GENERAL") == (False, False)
    assert nm(True, "SY", "D-2-2", "EXCELLENT") == (False, False)  # excluded nationality


def test_e_visa_route_for_an_excellent_university(db):
    sid = uid(db, MN)
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid))
    uni = db.get(University, db.get(Application, case.application_id).university_id)
    uni.visa_certification = "EXCELLENT"
    db.flush()
    p = vr.resolve(db, sid)
    assert p["method"]["code"] == "E_VISA_UNIVERSITY" and p["method"]["official_url"] == vr.EVISA_URL
    docs = {d["key"]: d for d in p["documents"]}
    assert docs["tb_test"]["status"] == "AT_REGISTRATION"
    assert docs["other_self_intro"]["applies"] == "no"  # waived at excellent-certified universities
    uni.visa_certification = "CERTIFIED"
    db.flush()
    p = vr.resolve(db, sid)
    assert p["method"]["code"] == "VISA_CENTRE" and any(w["code"] == "NO_EVISA_TIER" for w in p["why"])
    uni.visa_certification = "UNKNOWN"
    db.flush()
    p = vr.resolve(db, sid)
    assert p["method"]["code"] == "VISA_CENTRE" and any(c["code"] == "EVISA_TIER_UNKNOWN" for c in p["caveats"])
    db.rollback()


def test_no_inference_for_a_country_or_level_without_a_route(db, client):
    assert vr.find_route(db, "JP", "D-2-2", None) is None
    assert vr.find_route(db, "NP", "D-2-1", None) is None  # associate: no Nepal route covers it — never borrowed
    # Nepal D-2-3 covers doctoral study (same embassy list), but never another country's list.
    assert vr.find_route(db, "NP", "D-2-4", DegreeLevel.DOCTORATE).visa_type == "D-2-3"
    jp = db.scalar(select(User).join(VisaCase, VisaCase.student_user_id == User.id).where(User.locale == "ja").limit(1))
    p = vr.build_plan(db, jp.id, sync=False)
    assert p["status"] == "NO_ROUTE" and p["route"] is None and p["documents"] == []
    assert p["next"]["key"] == "counselor_confirms" and p["help"]["issue"]["code"] == "NO_ROUTE"
    assert p.get("fallback_checklist")  # the generic rows stay as a fallback
    db.rollback()


def test_needs_review_route_is_not_shown_as_a_checklist(db):
    pk = db.scalar(select(User).join(VisaCase, VisaCase.student_user_id == User.id).where(User.locale == "ur").limit(1))
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == pk.id))
    from app.models.enums import VisaType

    case.visa_type = VisaType.D4_1
    db.flush()
    p = vr.resolve(db, pk.id)
    assert p["status"] == "NOT_VERIFIED" and p["documents"] == [] and p["posts"]
    db.rollback()


# ------------------------------------------------------------------------------------------------ reuse + timing
def test_document_reuse_statuses_come_from_the_dossier_hook(db, monkeypatch):
    sid = uid(db, MN)
    calls = []
    real = dossier.applicability_for_requirement

    def spy(*a, **k):
        calls.append(a[2]["category"])
        return real(*a, **k)

    monkeypatch.setattr(dossier, "applicability_for_requirement", spy)
    p = vr.resolve(db, sid)
    assert {"PASSPORT", "PHOTO", "BANK_STATEMENT", "GRADUATION_CERTIFICATE"} <= set(calls)
    docs = {d["key"]: d for d in p["documents"]}
    assert docs["passport"]["status"] == real(db, sid, {"category": "PASSPORT"})["status"] == "READY"
    assert docs["final_education_certificate"]["status"] == "READY" and docs["final_education_certificate"]["reused"]
    assert docs["admission_certificate"]["status"] == "READY"  # admission letter received
    assert docs["business_registration"]["status"] == "READY"  # university paper marked received
    assert docs["other_marital_status"]["status"] == "READY" and not docs["other_marital_status"]["reused"]  # linked visa-only paper
    assert docs["tb_test"]["status"] == "NEW_FOR_VISA" and docs["criminal_record"]["applies"] == "yes"
    assert p["pack"]["all_ready"] is False and p["pack"]["reused"] >= 5


def test_bank_certificate_must_be_valid_on_the_appointment_day(db):
    sid = uid(db, MM)
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid))
    t = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id))
    today = date.today()
    t.appointment_on = today + timedelta(days=10)  # 12-day-old certificate is 22 days old then → fine
    db.flush()
    bank = next(d for d in vr.resolve(db, sid)["documents"] if d["key"] == "bank_balance_certificate")
    assert bank["status"] == "READY"
    t.appointment_on = today + timedelta(days=60)  # too early to get a new one: wait until 30 days before
    db.flush()
    bank = next(d for d in vr.resolve(db, sid)["documents"] if d["key"] == "bank_balance_certificate")
    assert bank["status"] == "GET_LATER" and bank["reason"]["params"]["date"] == (today + timedelta(days=30)).isoformat()
    db.rollback()


# ------------------------------------------------------------------------------------------------ form: never submitted or declared
def test_preparation_form_is_the_students_own_check(client, db, silk_manager):
    h = login(client, MN, "student")
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    form = p["form"]
    assert form["declarations"] is False and [s["key"] for s in form["sections"]] == vr.FORM_SECTIONS
    personal = next(s for s in form["sections"] if s["key"] == "personal")
    assert {f["field"]: f["value"] for f in personal["fields"]}["full_name"] == "Enkhjin Batbayar"
    # Staff can't confirm for the student; unknown fields can't be "corrected".
    sid = uid(db, MN)
    assert client.post(f"/api/v1/visa-route/students/{sid}/form/personal", json={}, headers=silk_manager).status_code in (404, 405)
    assert client.post("/api/v1/me/visa-route/form/school", json={"values": {"university": "X"}}, headers=h).status_code == 422
    r = client.post("/api/v1/me/visa-route/form/personal", json={"values": {"full_name": "Enkhjin BATBAYAR"}}, headers=h)
    assert r.status_code == 200
    sec = next(s for s in r.json()["form"]["sections"] if s["key"] == "personal")
    assert sec["confirmed_at"] and next(f for f in sec["fields"] if f["field"] == "full_name")["corrected"]
    db.expire_all()
    assert db.get(User, sid).full_name == "Enkhjin Batbayar"  # profile never silently overwritten
    for s in vr.FORM_SECTIONS:
        assert client.post(f"/api/v1/me/visa-route/form/{s}", json={}, headers=h).status_code == 200
    after = client.get("/api/v1/me/visa-route", headers=h).json()
    # Confirming every section never submits anything: still preparing (TB certificate + criminal record missing).
    assert after["case"]["status"] == "DOCUMENT_PREPARATION" and after["case"]["submission"] is None and after["pack"]["form_confirmed"]


# ------------------------------------------------------------------------------------------------ tenant isolation
def test_tenant_isolation(client, db, silk_manager, lotus_counselor, pnu_admin, student):
    sid = uid(db, MN)
    assert client.get(f"/api/v1/visa-route/students/{sid}", headers=silk_manager).status_code == 200
    assert client.get(f"/api/v1/visa-route/students/{sid}", headers=lotus_counselor).status_code == 404
    assert client.get(f"/api/v1/visa-route/students/{sid}", headers=pnu_admin).status_code == 404
    assert client.get(f"/api/v1/visa-route/students/{sid}", headers=student).status_code == 404
    assert client.put(f"/api/v1/visa-route/students/{sid}/appointment", json={"on": None}, headers=lotus_counselor).status_code == 404
    assert client.post(f"/api/v1/visa-route/students/{sid}/pack-reviewed", headers=student).status_code == 403
    assert client.get("/api/v1/me/visa-route", headers=pnu_admin).status_code == 404
    assert client.get("/api/v1/agency/visa-today", headers=student).status_code == 403
    uni = db.scalar(select(University.id).limit(1))
    assert client.put(f"/api/v1/visa-route/universities/{uni}/certification", json={"tier": "EXCELLENT", "verified_at": "2026-09-01"},
                      headers=silk_manager).status_code == 404
    # Another student's document can't be linked to my visa item.
    other = db.scalar(select(User.id).where(User.email == MM))
    from app.models import Document

    doc = db.scalar(select(Document.id).where(Document.owner_user_id == other).limit(1))
    h = login(client, MN, "student")
    assert client.post("/api/v1/me/visa-route/items/tb_test", json={"document_id": str(doc)}, headers=h).status_code == 404


def test_university_tier_is_hangyul_only_and_needs_a_date(client, db):
    ops = login(client, "ops@demo.hangyul.kr", "agency")
    uni = db.scalar(select(University).where(University.slug == "sogang-university"))
    assert client.put(f"/api/v1/visa-route/universities/{uni.id}/certification", json={"tier": "EXCELLENT"}, headers=ops).status_code == 422
    r = client.put(f"/api/v1/visa-route/universities/{uni.id}/certification", json={"tier": "UNKNOWN"}, headers=ops)
    assert r.status_code == 200 and r.json()["visa_certification"] == "UNKNOWN"


# ------------------------------------------------------------------------------------------------ service case table + hooks
def test_visa_support_status_table_is_registered():
    t = concierge.table_for("VISA_SUPPORT")
    assert t is vr.SUPPORT_TABLE and concierge.initial_status("VISA_SUPPORT") == "OPEN"
    assert concierge.can_transition("VISA_SUPPORT", "OPEN", "IN_PROGRESS")
    assert concierge.can_transition("VISA_SUPPORT", "IN_PROGRESS", "WAITING_EMBASSY")
    assert not concierge.can_transition("VISA_SUPPORT", "OPEN", "OPEN")


def test_home_step_for_the_myanmar_persona(db):
    step = vr.home_step(db, uid(db, MM))
    assert step["title_key"].startswith("visaroute:home.") and step["link"] == "/visa" and step["status_key"] == "visaroute:status.PREPARING"
    assert vr.home_step(db, uid(db, NP)) is None  # before admission the application stays the main track
    db.rollback()


def test_legacy_visa_endpoint_uses_the_route_checklist(client):
    h = login(client, MM, "student")
    v = client.get("/api/v1/visa", headers=h).json()["items"][0]
    assert v["route"]["post"]["key"] == "yangon" and v["route"]["verification_status"] == "PARTIAL"
    keys = [c["key"] for c in v["checklist"]]
    assert "tb_test" in keys and "other_nrc" in keys
    for c in v["checklist"]:
        assert c["name"] and "name_key" in c and "rule" in c


# ------------------------------------------------------------------------------------------------ i18n
def _flat(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flat(v, key + "."))
        else:
            out[key] = v
    return out


@pytest.mark.parametrize("loc", ["ko", "my"])
def test_visaroute_keys_are_translated(loc):
    base = ROOT / "packages/i18n/locales"
    en = _flat(json.loads((base / "en/visaroute.json").read_text()))
    other = _flat(json.loads((base / f"{loc}/visaroute.json").read_text()))
    staff = ("staff.", "today.")
    wanted = [k for k in en if loc == "ko" or not k.startswith(staff)]
    missing = [k for k in wanted if k not in other]
    assert not missing, f"{loc}: {missing[:20]}"
    if loc == "my":
        # Burmese strings are really Burmese (Myanmar script), not copied English.
        latin_only = [k for k in wanted if other[k] and not any("က" <= ch <= "႟" for ch in other[k]) and "{{" not in other[k]]
        assert len(latin_only) <= 3, latin_only
