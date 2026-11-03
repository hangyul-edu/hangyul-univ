"""V9 student workstream (REPORT §58 S1–S6, S8; §55 #1–3, #7, #24, #25).

Persona the tests are written for: a 19-year-old from Nepal with no TOPIK whose parents pay. A fresh account of that
persona is created through the register flow here (not in the seed).
"""
import json
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import ConsentRecord, ServiceCase, User, VisaCase
from app.models.enums import VisaStatus
from app.models.v9_sponsor import SponsorLink, SponsorLinkView
from tests.conftest import login
from tests.v22_helpers import register_student

PRIVATE_WORDS = ("essay", "message", "internal_notes", "note_en", "storage_key", "file_name", "passport_number", "email", "phone",
                 "counselor_note", "conversation")


def _quick(client, **kw):
    body = {"nationality": "NP", "degree": "BACHELOR", "language": {"kind": "NONE"}}
    body.update(kw)
    r = client.post("/api/v1/public/quick-eligibility", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------------------------------------ S1 routes
def test_quick_check_nepal_no_test_shows_language_route(client):
    d = _quick(client)
    assert d["meets_count"] == 0  # the degree itself still needs a test — said honestly
    r = d["routes"]
    assert r and r["not_an_offer"] is True
    k = r["korean_first"]
    assert k["count"] == 10, k
    assert k["visa_from"] == "D-4-1" and k["visa_to"] == "D-2"
    assert k["term_semesters"] == 1 and k["year_cost_min"] and k["year_cost_max"] >= k["year_cost_min"]
    assert k["opens_at"] == {"kind": "TOPIK", "level": 3, "count": 21}
    assert len(k["programs"]) <= 3
    e = r["english"]
    assert e["count"] == 5 and e["ielts_from"] == 6.0 and e["toefl_from"] == 80
    assert r["smallest_step"] == {"kind": "TOPIK", "level": 3, "count": 21}


def test_routes_absent_when_language_does_not_block(client):
    assert _quick(client, language={"kind": "TOPIK", "level": 4})["routes"] is None  # 26 programs open already
    assert _quick(client, degree="LANGUAGE")["routes"] is None  # already the language route


@pytest.fixture(scope="module")
def nepal_new(client):
    """Fresh 'Nepal, no TOPIK' persona via the register flow (not seeded)."""
    reg = register_student(client, email=f"v9.nepal.{uuid.uuid4().hex[:8]}@example.com", password="Hangyul!2026x", full_name="Aarati Test", locale="ne", nationality="NP")
    email, h = reg["email"], reg["h"]
    assert client.patch("/api/v1/me/profile", json={"target_degree": "BACHELOR"}, headers=h).status_code == 200
    return {"email": email, "h": h}


def test_signed_in_discovery_and_early_home_show_routes(client, nepal_new):
    m = client.get("/api/v1/me/matches", headers=nepal_new["h"]).json()
    assert m["routes"]["korean_first"]["count"] == 10
    d = client.get("/api/v1/me/dashboard", headers=nepal_new["h"]).json()
    assert d["routes"]["korean_first"]["count"] == 10 and d["routes"]["smallest_step"]["kind"] == "TOPIK"
    assert d["refund"] is None


# ------------------------------------------------------------------------------------------------ S2 money plan
def test_money_plan_lines_have_payee_when_refund_basis(client, nepal_new):
    # A bachelor program → the Nepal D-2-2 route (VERIFIED).
    progs = client.get("/api/v1/programs", params={"degree": ["BACHELOR"], "page_size": 1}).json()["items"]
    pid = progs[0]["id"]
    plan = client.get("/api/v1/me/money-plan", params={"program_id": pid}, headers=nepal_new["h"]).json()
    lines = {ln["key"]: ln for ln in plan["program"]["lines"]}
    for ln in lines.values():
        assert ln["payee"] in {"UNIVERSITY", "APPLICATION_RAIL", "HANGYUL", "EMBASSY", "IMMIGRATION", "INSURER", "LANDLORD", "DORMITORY", "EVERYDAY"}
        assert ln["when"] in {"APPLICATION", "OFFER", "TUITION_DEADLINE", "BEFORE_VISA", "BEFORE_ARRIVAL", "ON_ARRIVAL", "MONTHLY"}
        assert ln["refundable"] in {"YES", "NO", "UNIVERSITY_RULE", "UNKNOWN"}
        assert ln["basis"] in {"OFFICIAL", "ESTIMATE", "SAMPLE", "UNKNOWN"}
    rc = lines["residence_card"]
    assert rc["amount_min"] == 35_000 and rc["basis"] == "OFFICIAL" and rc["payee"] == "IMMIGRATION" and rc["source_url"]
    ins = lines["insurance"]
    assert ins["amount_min"] == 79_320 and ins["basis"] == "ESTIMATE" and ins["period"] == "MONTH"
    vf = lines["visa_fee"]  # Nepal D-2-2 embassy page: USD 60 (VERIFIED route)
    # OFFICIAL when the route is VERIFIED, ESTIMATE while the research marks it PARTIAL — never "no figure".
    assert vf["currency"] == "USD" and vf["amount_min"] == 60 and vf["basis"] in ("OFFICIAL", "ESTIMATE") and vf["payee"] == "EMBASSY"
    assert lines["tuition"]["guard"] is True and lines["tuition"]["payee"] == "UNIVERSITY"
    # USD is never added into the KRW totals.
    before_visa = next(g for g in plan["program"]["by_when"] if g["when"] == "BEFORE_VISA")
    assert before_visa["krw_min"] == 0 and before_visa["other"][0]["currency"] == "USD"
    assert plan["guard"]["codes"][0] == "PAY_UNIVERSITY_DIRECTLY"
    # Announced rule changes are separate and labelled as not in force.
    codes = {a["code"] for a in plan["announced"]}
    assert {"TOPIK4_FINANCIAL_EXEMPTION", "STUDY_DEPOSIT_SCHEME"} <= codes and all(a["source_url"] for a in plan["announced"])
    f = plan["funds_to_show"]
    assert f["status"] == "RESOLVED" and f["funds"]["kind"] == "NOT_STATED" and f["funds"]["period"] == {"months": 6, "kind": "HISTORY"}
    assert f["genuine"]["code"] == "GENUINE_FUNDS_ONLY"


def test_funds_to_show_before_visa_uses_region(client):
    h = login(client, "student.myanmar@demo.hangyul.kr", "student")
    b = client.get("/api/v1/me/budget", headers=h).json()
    f = b["funds_to_show"]
    assert f["status"] == "RESOLVED" and f["region_kind"] == "OTHER"  # Pusan → regional amount
    assert f["amount"] == {"currency": "KRW", "amount": 16_000_000, "area": "OTHER"}
    assert f["funds"]["certificate_max_age_days"] == 30 and f["funds"]["whose"] == "STUDENT_OR_PARENT"
    assert b["items"][0]["plan"]["lines"]
    # The visa page carries the same rule as codes + params (the English stays only as published text).
    v = client.get("/api/v1/me/visa-route", headers=h).json()
    assert v["funds"]["amount"]["amount"] == 16_000_000 and v["funds"]["funds"]["published_en"]


def test_offers_carry_money_lines(client):
    h = login(client, "student.offer@demo.hangyul.kr", "student")
    items = client.get("/api/v1/me/offers", headers=h).json()["items"]
    assert items and all(any(ln["key"] == "tuition" and ln["guard"] for ln in it["money"]) for it in items)


# ------------------------------------------------------------------------------------------------ S3 sponsor view
def test_sponsor_link_scopes_consent_audit_and_revoke(client, db, nepal_new):
    h = nepal_new["h"]
    r = client.post("/api/v1/me/sponsor-links", json={"scopes": ["money"], "label": "Mother"}, headers=h)
    assert r.status_code == 201, r.text
    link = r.json()
    token = link["token"]
    assert link["state"] == "ACTIVE" and link["locale"] == "ne"
    exp = datetime.fromisoformat(link["expires_at"])
    assert timedelta(days=29) < exp - datetime.now(timezone.utc) <= timedelta(days=30)
    sid = db.scalar(select(User.id).where(User.email == nepal_new["email"]))
    assert db.scalar(select(ConsentRecord).where(ConsentRecord.user_id == sid, ConsentRecord.purpose == "SPONSOR_VIEW", ConsentRecord.granted.is_(True)))
    row = db.scalar(select(SponsorLink).where(SponsorLink.id == uuid.UUID(link["id"])))
    assert row.token_hash != token and len(row.token_hash) == 64  # stored hashed only
    # Listing never returns the token.
    listed = client.get("/api/v1/me/sponsor-links", headers=h).json()["items"]
    assert listed and "token" not in listed[0]
    # Public view without login: only the chosen scope.
    v = client.get(f"/api/v1/public/sponsor/{token}")
    assert v.status_code == 200
    body = v.json()
    assert body["scopes"] == ["money"] and "money" in body
    for k in ("family_documents", "dates", "progress", "arrival"):
        assert k not in body
    assert body["student"] == {"first_name": "Aarati"}
    db.expire_all()
    assert db.scalar(select(SponsorLinkView).where(SponsorLinkView.link_id == row.id))
    assert client.get("/api/v1/me/sponsor-links", headers=h).json()["items"][0]["last_viewed_at"]
    # Another student cannot revoke it.
    other = login(client, "student@demo.hangyul.kr", "student")
    assert client.post(f"/api/v1/me/sponsor-links/{link['id']}/revoke", headers=other).status_code == 404
    # Revoke → 404 for the sponsor; consent withdrawal recorded.
    assert client.post(f"/api/v1/me/sponsor-links/{link['id']}/revoke", headers=h).json()["state"] == "REVOKED"
    assert client.get(f"/api/v1/public/sponsor/{token}").status_code == 404
    assert db.scalar(select(ConsentRecord).where(ConsentRecord.user_id == sid, ConsentRecord.purpose == "SPONSOR_VIEW", ConsentRecord.granted.is_(False)))


def test_sponsor_link_expired_or_unknown_is_404(client, db, nepal_new):
    r = client.post("/api/v1/me/sponsor-links", json={"scopes": ["dates", "progress"], "days": 1}, headers=nepal_new["h"]).json()
    assert client.get(f"/api/v1/public/sponsor/{r['token']}").status_code == 200
    row = db.get(SponsorLink, uuid.UUID(r["id"]))
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert client.get(f"/api/v1/public/sponsor/{r['token']}").status_code == 404
    assert client.get("/api/v1/public/sponsor/not-a-real-token").status_code == 404


def test_sponsor_payload_has_no_private_fields(client):
    h = login(client, "student.myanmar@demo.hangyul.kr", "student")
    r = client.post("/api/v1/me/sponsor-links", json={"scopes": ["money", "family_documents", "dates", "progress", "arrival"]}, headers=h).json()
    body = client.get(f"/api/v1/public/sponsor/{r['token']}").json()
    assert set(body["scopes"]) == {"money", "family_documents", "dates", "progress", "arrival"}
    text = json.dumps(body).lower()
    for w in PRIVATE_WORDS:
        assert f'"{w}' not in text, w
    assert "hangyul_fee" not in {ln["key"] for ln in (body["money"]["program"] or {}).get("lines", [])}
    assert body["family_documents"]["items"]  # the bank certificate / sponsor papers the family provides
    assert all("document" not in it for it in body["family_documents"]["items"])  # never a file
    client.post(f"/api/v1/me/sponsor-links/{r['id']}/revoke", headers=h)


def test_sponsor_scope_validation_and_staff_cannot_create(client, lotus_counselor, nepal_new):
    assert client.post("/api/v1/me/sponsor-links", json={"scopes": ["messages"]}, headers=nepal_new["h"]).status_code == 422
    assert client.post("/api/v1/me/sponsor-links", json={"scopes": []}, headers=nepal_new["h"]).status_code == 422
    assert client.post("/api/v1/me/sponsor-links", json={"scopes": ["money"], "days": 365}, headers=nepal_new["h"]).status_code == 422
    assert client.post("/api/v1/me/sponsor-links", json={"scopes": ["money"]}, headers=lotus_counselor).status_code in (401, 403)
    assert client.get("/api/v1/me/money-plan", headers=lotus_counselor).status_code in (401, 403)


# ------------------------------------------------------------------------------------------------ S4 who can see
def test_dossier_says_who_can_see(client):
    h = login(client, "student.offer@demo.hangyul.kr", "student")
    d = client.get("/api/v1/me/dossier", headers=h).json()
    v = d["visibility"]
    assert v["you"] and v["hangyul_reviewers"] and v["universities"] == "ONLY_SENT"
    assert v["agency"]["organization"] and v["agency"]["consent_at"]
    assert v["retention"]["policy_status"] == "PENDING_APPROVAL" and v["withdraw"]["sent_to_university"] is False
    sent = [s for r in d["rows"] for s in r["sent_to"]]
    assert sent and all(s["university"] and s["sent_on"] for s in sent)


# ------------------------------------------------------------------------------------------------ S8 refund path
def test_visa_refusal_after_tuition_opens_refund_case(client, db):
    from app.models.v5_visa_routes import VisaCaseTrack

    email = "student.myanmar@demo.hangyul.kr"
    h = login(client, email, "student")
    sid = db.scalar(select(User.id).where(User.email == email))
    case = db.scalar(select(VisaCase).where(VisaCase.student_user_id == sid))
    prev = case.status
    case.status = VisaStatus.SUBMITTED
    db.commit()
    try:
        r = client.post("/api/v1/me/visa-route/decision", json={"decision": "REFUSED", "decided_on": date.today().isoformat()}, headers=h)
        assert r.status_code == 200, r.text
        sc = db.scalar(select(ServiceCase).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "REFUND"))
        assert sc and sc.status == "OPEN" and sc.details["trigger"] == "VISA_REFUSED"
        d = client.get("/api/v1/me/dashboard", headers=h).json()
        rf = d["refund"]
        assert rf["rule"]["code"] == "COUNSELOR_CONFIRMS" and rf["own_account"] is True and rf["elapsed_days"] == 0
        assert rf["university"] == "Pusan National University"
        # Idempotent: a second home load does not open a second case.
        client.get("/api/v1/me/dashboard", headers=h)
        assert len(db.scalars(select(ServiceCase).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "REFUND")).all()) == 1
        # The money plan carries it too (sponsor sees the same facts).
        assert client.get("/api/v1/me/money-plan", headers=h).json()["refund"]["trigger"] == "VISA_REFUSED"
    finally:
        db.expire_all()
        from sqlalchemy import delete

        from app.models import ServiceCaseEvent, Task

        for cid in db.scalars(select(ServiceCase.id).where(ServiceCase.student_user_id == sid, ServiceCase.case_type == "REFUND")).all():
            db.execute(delete(ServiceCaseEvent).where(ServiceCaseEvent.case_id == cid))
            db.execute(delete(Task).where(Task.dedupe_key.like(f"svc:{cid}:%")))
            db.execute(delete(ServiceCase).where(ServiceCase.id == cid))
        case = db.get(VisaCase, case.id)
        case.status = prev
        tr = db.scalar(select(VisaCaseTrack).where(VisaCaseTrack.visa_case_id == case.id))
        if tr:
            tr.decision = None
            tr.decision_on = None
        db.commit()


# ------------------------------------------------------------------------------------------------ resolver follow-ups (visa-data hand-off)
def _route(db, country, visa_type):
    from app.models.v5_visa_routes import VisaRoute

    return db.scalar(select(VisaRoute).where(VisaRoute.country == country, VisaRoute.visa_type == visa_type, VisaRoute.is_current.is_(True)))


def test_kyrgyz_2027_rule_is_date_aware_in_the_resolver(db):
    from app.services import money
    from app.services import visa_routes as vr

    kg = _route(db, "KG", "D-2")
    before = money.parse_funds(vr.effective_financial(kg, date(2026, 12, 31)), "D-2")
    after = money.parse_funds(vr.effective_financial(kg, date(2027, 1, 1)), "D-2")
    assert before["amounts"] == [{"currency": "USD", "amount": 20_000, "area": "ANY"}]
    assert {a["amount"] for a in after["amounts"]} == {15_500, 12_500}
    sc = vr.scheduled_announced(kg, date(2026, 10, 10))
    assert sc and sc[0]["effective_from"] == "2027-01-01" and sc[0]["status"] == "ANNOUNCED_NOT_IN_FORCE"
    assert vr.scheduled_announced(kg, date(2027, 1, 1)) == []


def test_thai_nationals_visa_fee_is_zero_not_unknown(db):
    from app.services import money
    from app.services import visa_routes as vr

    th = _route(db, "TH", "D-2")
    assert vr.fee_free(th)
    ln = money._visa_fee_line(th)
    assert ln.amount_min == 0 and ln.note_code == "VISA_FEE_FREE"


def test_settled_conflicts_drop_and_myanmar_legalization_is_data_driven(client, db):
    from app.services import visa_routes as vr

    for c, vt in (("MM", "D-2-2"), ("PK", "D-2-2"), ("TH", "D-2"), ("PH", "D-2")):
        r = _route(db, c, vt)
        live = [k for k in vr.KNOWN_CONFLICTS.get((c, None), []) if not vr.conflict_settled(r, k)]
        assert not {"LEGALIZATION_UNCLEAR", "FEE_TIME_CONFLICT", "FEE_EXEMPTION_UNCHECKED", "POST_SPLIT_UNVERIFIED"} & set(live), (c, live)
    assert "AMOUNTS_CONFLICT" not in [k for k in vr.KNOWN_CONFLICTS[("KG", None)] if not vr.conflict_settled(_route(db, "KG", "D-2"), k)]
    h = login(client, "student.myanmar@demo.hangyul.kr", "student")
    p = client.get("/api/v1/me/visa-route", headers=h).json()
    edu = next(d for d in p["documents"] if d["key"] == "final_education_certificate")
    assert edu["legalization"] in (None, "NONE") and edu["status"] != "NEEDS_LEGALIZATION"
    assert vr.METHOD_NOTES[("BD", None)] == "VISA_CENTRE_DHAKA"
