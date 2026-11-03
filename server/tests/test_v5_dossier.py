"""V5 universal dossier: applicability rules, document intelligence, extraction-as-suggestion, packages, tenant isolation."""
import struct
import uuid
import zlib
from datetime import date, timedelta

from sqlalchemy import select

from app.models import Application, Document, StudentProfile, University, User
from app.models.enums import DocumentCategory as DC
from app.models.enums import DocumentStatus, LegalizationPath, LegalizationStatus
from app.seed.extra_51_dossier import mrz_lines, text_pdf
from app.services import dossier as D
from app.services import extraction as X
from tests.conftest import login

THU = "student.dossier@demo.hangyul.kr"
TODAY = date(2026, 9, 29)


def _doc(cat=DC.BANK_STATEMENT, status=DocumentStatus.VERIFIED, **kw) -> Document:
    base = dict(category=cat, title="x", status=status, current_version=1, legalization_path=LegalizationPath.NONE,
                legalization_status=LegalizationStatus.NOT_REQUIRED, language="en", versions=[])
    base.update(kw)
    return Document(**base)


def _req(cat="BANK_STATEMENT", **kw) -> D.Req:
    return D.Req(category=cat, label="Bank balance certificate", university=kw.pop("university", "Pusan National University"), **kw)


# ----------------------------------------------------------------------------- applicability rules

def test_max_age_days_needs_a_newer_copy_with_the_reason(db):
    old = _doc(issue_date=TODAY - timedelta(days=45))
    ev = D.evaluate(db, old, _req(max_age_days=30), today=TODAY)
    assert ev["status"] == D.NEEDS_NEW_VERSION and ev["code"] == "TOO_OLD"
    assert "Pusan National University needs a certificate issued within the last 30 days" in ev["text"]
    fresh = _doc(issue_date=TODAY - timedelta(days=10))
    assert D.evaluate(db, fresh, _req(max_age_days=30), today=TODAY)["status"] == D.READY
    # Judged at the submission date for an application already sent: it was fine then.
    assert D.evaluate(db, old, _req(max_age_days=30), today=TODAY, ref_date=TODAY - timedelta(days=30))["status"] == D.READY
    # Still preparing: fine today but too old by the deadline → near expiry, not blocked.
    ev = D.evaluate(db, fresh, _req(max_age_days=30), today=TODAY, window_end=TODAY + timedelta(days=30))
    assert ev["status"] == D.NEAR_EXPIRY and ev["code"] == "NEAR_TOO_OLD"


def test_expired_and_near_expiry(db):
    ev = D.evaluate(db, _doc(DC.PASSPORT, expires_on=TODAY - timedelta(days=1)), _req("PASSPORT"), today=TODAY)
    assert ev["status"] == D.EXPIRED
    ev = D.evaluate(db, _doc(DC.PASSPORT, expires_on=TODAY + timedelta(days=20)), _req("PASSPORT"), today=TODAY, window_end=TODAY + timedelta(days=40))
    assert ev["status"] == D.NEAR_EXPIRY and ev["code"] == "NEAR_EXPIRY_DATE"
    # Passport valid today and through the deadline, but not 6 months past the semester start → warned, still usable.
    ev = D.evaluate(db, _doc(DC.PASSPORT, expires_on=TODAY + timedelta(days=200)), _req("PASSPORT"), today=TODAY, passport_until=TODAY + timedelta(days=330))
    assert ev["status"] == D.NEAR_EXPIRY and ev["code"] == "PASSPORT_VALIDITY" and ev["status"] in D.USABLE
    assert D.evaluate(db, _doc(DC.PASSPORT, expires_on=TODAY + timedelta(days=900)), _req("PASSPORT"), today=TODAY,
                      passport_until=TODAY + timedelta(days=330))["status"] == D.READY


def test_vietnam_apostille_is_time_versioned(db):
    before = D.route_for(db, "VN", "TRANSCRIPT", date(2026, 9, 1))
    after = D.route_for(db, "VN", "TRANSCRIPT", date(2026, 9, 11))
    assert before["path"] == "CONSULAR_LEGALIZATION" and after["path"] == "APOSTILLE"
    req = _req("TRANSCRIPT", legalization_required=True)
    pending = _doc(DC.TRANSCRIPT, issuing_country="VN", language="vi", legalization_path=LegalizationPath.APOSTILLE, legalization_status=LegalizationStatus.REQUIRED)
    ev = D.evaluate(db, pending, req, today=TODAY)
    assert ev["status"] == D.NEEDS_LEGALIZATION and ev["path"] == "APOSTILLE" and "apostille" in ev["text"]
    ev = D.evaluate(db, pending, req, today=date(2026, 9, 1))
    assert ev["status"] == D.NEEDS_LEGALIZATION and ev["path"] == "CONSULAR_LEGALIZATION"
    # A consular legalization completed before Viet Nam joined is still accepted.
    consular_done = _doc(DC.TRANSCRIPT, issuing_country="VN", language="vi", legalization_path=LegalizationPath.CONSULAR_LEGALIZATION,
                         legalization_status=LegalizationStatus.COMPLETED)
    assert D.evaluate(db, consular_done, req, today=TODAY)["status"] == D.READY


def test_nepal_and_myanmar_need_consular_legalization(db):
    for cc in ("NP", "MM"):
        assert D.route_for(db, cc, "GRADUATION_CERTIFICATE", TODAY)["path"] == "CONSULAR_LEGALIZATION"
        apostilled = _doc(DC.GRADUATION_CERTIFICATE, issuing_country=cc, language="ne", legalization_path=LegalizationPath.APOSTILLE,
                          legalization_status=LegalizationStatus.COMPLETED)
        ev = D.evaluate(db, apostilled, _req("GRADUATION_CERTIFICATE", legalization_required=True), today=TODAY)
        assert ev["status"] == D.NEEDS_LEGALIZATION and ev["path"] == "CONSULAR_LEGALIZATION"
    assert D.route_for(db, "KR", "TRANSCRIPT", TODAY)["path"] == "NONE"


def test_translation_needed_only_when_marked(db):
    d = _doc(language="vi")
    req = _req(translation_required=True)
    assert D.evaluate(db, d, req, today=TODAY, ts="NEEDED")["status"] == D.NEEDS_TRANSLATION
    assert D.evaluate(db, d, req, today=TODAY, ts=D.translation_status(d, None))["status"] == D.READY  # verified → translation checked
    assert D.translation_status(_doc(language="vi", status=DocumentStatus.NEEDS_REVIEW), None) == "CHECK"
    assert D.translation_status(_doc(language="ko"), None) == "NOT_NEEDED"


def test_visa_hook(db):
    thu = db.scalar(select(User).where(User.email == THU))
    out = D.applicability_for_requirement(db, thu, {"category": "BANK_STATEMENT", "label": "Bank balance certificate", "max_age_days": 30})
    assert out["status"] == D.NEEDS_NEW_VERSION and out["document"]["category"] == "BANK_STATEMENT"
    out = D.applicability_for_requirement(db, thu, {"category": "PASSPORT", "window_end": date(2032, 6, 1)})
    assert out["status"] == D.NEAR_EXPIRY  # her passport (2032-05-01) expires before that window ends
    assert D.applicability_for_requirement(db, thu, {"category": "VISA"})["status"] == D.MISSING


# ----------------------------------------------------------------------------- extraction

def test_mrz_parsing_and_name_folding():
    lines = mrz_lines("NGUYEN", "THI LAN", "C09063512", "VNM", "980721", "F", "310901")
    m = X.parse_mrz("\n".join(lines))
    assert m["valid"] and m["date_of_birth"] == date(1998, 7, 21) and m["expiry"] == date(2031, 9, 1) and m["full_name"] == "NGUYEN THI LAN"
    broken = lines[1][:9] + "0" + lines[1][10:]
    assert X.parse_mrz(f"{lines[0]}\n{broken}")["valid"] is False
    assert X.names_match("NGUYEN THI LAN", "Nguyễn Thị Lan") and not X.names_match("TRAN VAN BINH", "Nguyễn Thị Lan")
    fields = {f["field"]: f for f in X.extract_fields("\n".join(lines), "passport.pdf", "PASSPORT")}
    assert fields["passport_number"]["value"] == "••••••512"  # never stored in clear
    assert fields["passport_expiry"]["confidence"] == "high" and fields["passport_expiry"]["source"] == "mrz"


def _png(w: int, h: int) -> bytes:
    def chunk(t, data):
        return struct.pack(">I", len(data)) + t + data + struct.pack(">I", zlib.crc32(t + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\xff" * (w * 3) for _ in range(h))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def test_image_size_parsing():
    assert X.image_size(_png(320, 200)) == (320, 200)


def _upload(client, h, data: bytes, category: str, name: str, **form):
    mime = "image/png" if name.endswith(".png") else "application/pdf"
    r = client.post("/api/v1/documents", headers=h, files={"file": (name, data, mime)}, data={"category": category, **form})
    assert r.status_code == 201, r.text
    return r.json()


def _row_findings(dossier: dict, doc_id: str) -> set:
    return {f["code"] for r in dossier["rows"] for f in r["findings"] if f["document_id"] == doc_id}


def test_findings_duplicate_wrong_type_poor_scan_name_mismatch(client, db):
    h = login(client, "student.new@demo.hangyul.kr", "student")
    same = text_pdf(["Hangyul test file", "ACADEMIC TRANSCRIPT", "Transcript of records"])
    a = _upload(client, h, same, "TRANSCRIPT", "transcript.pdf", language="en")
    b = _upload(client, h, same, "PASSPORT", "passport_copy.pdf", language="en")  # same file, wrong category
    small = _upload(client, h, _png(300, 200), "PHOTO", "photo.png")
    other_name = text_pdf(mrz_lines("TRAN", "VAN BINH", "B12345678", "UZB", "060514", "M", "320501"))
    p = _upload(client, h, other_name, "PASSPORT", "passport.pdf", language="en")
    dossier = client.get("/api/v1/me/dossier", headers=h).json()
    assert "DUPLICATE" in _row_findings(dossier, b["id"]) and "DUPLICATE" not in _row_findings(dossier, a["id"])
    assert "WRONG_TYPE" in _row_findings(dossier, b["id"])
    assert "POOR_SCAN" in _row_findings(dossier, small["id"])
    assert "NAME_MISMATCH" in _row_findings(dossier, p["id"])
    f = next(f for r in dossier["rows"] for f in r["findings"] if f["document_id"] == small["id"])
    assert f["explanation"].startswith("The image is small (300×200 pixels)") and f["action"] == "UPLOAD_CLEARER"


def test_extraction_never_writes_the_profile_without_confirmation(client, db):
    h = login(client, "student.new@demo.hangyul.kr", "student")
    uid = db.scalar(select(User.id).where(User.email == "student.new@demo.hangyul.kr"))
    before = db.scalar(select(StudentProfile).where(StudentProfile.user_id == uid))
    dob_before, exp_before = before.date_of_birth, before.passport_expiry
    pdf = text_pdf(["PASSPORT", *mrz_lines("KARIMOVA", "DILNOZA", "FA1234567", "UZB", "070302", "F", "340615")])
    doc = _upload(client, h, pdf, "PASSPORT", "passport_dilnoza.pdf", language="en")
    dossier = client.get("/api/v1/me/dossier", headers=h).json()
    mine = {s["field"]: s for s in dossier["suggestions"] if s["document_id"] == doc["id"]}
    assert mine["passport_expiry"]["value"] == "2034-06-15" and mine["passport_expiry"]["status"] == "SUGGESTED"
    assert mine["date_of_birth"]["value"] == "2007-03-02"
    db.expire_all()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == uid))
    assert (prof.date_of_birth, prof.passport_expiry) == (dob_before, exp_before)  # nothing written yet
    # Not right → nothing changes; Confirm → written.
    r = client.post(f"/api/v1/dossier/extractions/{mine['date_of_birth']['id']}/reject", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "REJECTED"
    r = client.post(f"/api/v1/dossier/extractions/{mine['passport_expiry']['id']}/confirm", headers=h, json={})
    assert r.status_code == 200, r.text
    assert "profile.passport_expiry" in r.json()["applied"]
    db.expire_all()
    prof = db.scalar(select(StudentProfile).where(StudentProfile.user_id == uid))
    assert prof.passport_expiry == date(2034, 6, 15) and prof.date_of_birth == dob_before
    assert db.get(Document, uuid.UUID(doc["id"])).expires_on == date(2034, 6, 15)
    # Answered once only; other students cannot touch it.
    assert client.post(f"/api/v1/dossier/extractions/{mine['passport_expiry']['id']}/confirm", headers=h, json={}).status_code == 409
    other = login(client, THU, "student")
    assert client.post(f"/api/v1/dossier/extractions/{mine['passport_number']['id']}/confirm", headers=other, json={}).status_code == 404


def test_edited_confirmation_validates(client):
    h = login(client, "student.new@demo.hangyul.kr", "student")
    pdf = text_pdf(["ACADEMIC TRANSCRIPT", "Cumulative GPA: 7.9 / 10"])
    doc = _upload(client, h, pdf, "TRANSCRIPT", "transcript2.pdf", language="en")
    dossier = client.get("/api/v1/me/dossier", headers=h).json()
    gpa = next(s for s in dossier["suggestions"] if s["document_id"] == doc["id"] and s["field"] == "gpa")
    assert client.post(f"/api/v1/dossier/extractions/{gpa['id']}/confirm", headers=h, json={"value": "banana"}).status_code == 422
    r = client.post(f"/api/v1/dossier/extractions/{gpa['id']}/confirm", headers=h, json={"value": "8.0/10"})
    assert r.status_code == 200 and r.json()["confirmed_value"] == "8.0/10"


def test_lan_seeded_suggestions_are_real_extraction_output(client):
    h = login(client, "student@demo.hangyul.kr", "student")
    d = client.get("/api/v1/me/dossier", headers=h).json()
    by = {(s["category"], s["field"]): s for s in d["suggestions"]}
    assert by[("PASSPORT", "passport_expiry")]["source"] == "mrz" and by[("PASSPORT", "passport_expiry")]["matches_profile"]
    assert by[("TRANSCRIPT", "gpa")]["value"] == "8.6/10" and not by[("TRANSCRIPT", "gpa")]["matches_profile"]
    assert d["counts"]["suggestions"] >= 1 and d["ocr_available"] is False


# ----------------------------------------------------------------------------- dossier, packages, tenant isolation

def _thu_apps(db):
    uid = db.scalar(select(User.id).where(User.email == THU))
    apps = db.scalars(select(Application).where(Application.student_user_id == uid)).all()
    by = {db.get(University, a.university_id).slug: a for a in apps}
    return uid, by["pusan-national-university"], by["kyungpook-national-university"]


def test_dossier_applicability_copy_and_packages(client, db):
    h = login(client, THU, "student")
    d = client.get("/api/v1/me/dossier", headers=h).json()
    rows = {r["category"]: r for r in d["rows"]}
    bank = rows["BANK_STATEMENT"]
    assert bank["summary"]["code"] == "S_PARTIAL"
    assert bank["summary"]["text"].startswith("Can be used for Pusan National University. Kyungpook National University needs a certificate issued within the last 30 days")
    assert rows["PASSPORT"]["summary"]["text"] == "Ready for 2 of 2 applications."
    assert any(f["code"] == "NEW_ISSUE_NEEDED" for f in bank["findings"])
    _uid, pnu, knu = _thu_apps(db)
    pk = client.get(f"/api/v1/applications/{knu.id}/package", headers=h).json()
    s = pk["summary"]
    assert s["total"] == s["ready"] + s["student"] + s["counselor"] + s["request"]
    assert s["student"] == 1 and not s["complete"]
    assert next(i for i in pk["items"] if i["category"] == "BANK_STATEMENT")["status"] == D.NEEDS_NEW_VERSION
    pp = client.get(f"/api/v1/applications/{pnu.id}/package", headers=h).json()
    assert pp["summary"]["complete"] is True and pp["summary"]["ready"] == pp["summary"]["total"]


def test_tenant_isolation(client, db, lotus_counselor, silk_manager, pnu_admin):
    uid, pnu, knu = _thu_apps(db)
    assert client.get(f"/api/v1/agency/students/{uid}/dossier", headers=lotus_counselor).status_code == 200
    assert client.get(f"/api/v1/agency/students/{uid}/dossier", headers=silk_manager).status_code == 404
    other_counselor = login(client, "counselor2@lotus.demo.hangyul.kr", "agency")  # V22: every admin of the agency sees every student
    assert client.get(f"/api/v1/agency/students/{uid}/dossier", headers=other_counselor).status_code == 200
    assert client.get(f"/api/v1/agency/students/{uid}/dossier", headers=pnu_admin).status_code == 403
    assert client.get(f"/api/v1/applications/{knu.id}/package", headers=silk_manager).status_code == 404
    lan = login(client, "student@demo.hangyul.kr", "student")
    assert client.get(f"/api/v1/applications/{pnu.id}/package", headers=lan).status_code == 404
    # University: its own submitted application, only shared + verified documents, no internal states.
    u = client.get(f"/api/v1/applications/{pnu.id}/package", headers=pnu_admin).json()
    assert set(u) == {"application", "shared", "summary"} and u["summary"]["shared"] == len(u["shared"]) > 0
    assert client.get(f"/api/v1/applications/{knu.id}/package", headers=pnu_admin).status_code == 404  # another university, not submitted
    # Findings: staff of another agency cannot close them; the right counselor can, and it sticks.
    d = client.get(f"/api/v1/agency/students/{uid}/dossier", headers=lotus_counselor).json()
    f = next(f for r in d["rows"] for f in r["findings"])
    assert client.post(f"/api/v1/dossier/findings/{f['id']}/dismiss", headers=silk_manager, json={}).status_code == 404
    lan_h = login(client, "student@demo.hangyul.kr", "student")
    assert client.post(f"/api/v1/dossier/findings/{f['id']}/dismiss", headers=lan_h, json={}).status_code == 403
    r = client.post(f"/api/v1/dossier/findings/{f['id']}/dismiss", headers=lotus_counselor, json={"note": "Checked with the student"})
    assert r.status_code == 200 and r.json()["status"] == "DISMISSED"
    d = client.get(f"/api/v1/agency/students/{uid}/dossier", headers=lotus_counselor).json()
    assert f["id"] not in {x["id"] for r in d["rows"] for x in r["findings"]}
    client.post(f"/api/v1/dossier/findings/{f['id']}/reopen", headers=lotus_counselor, json={})


def test_duplicate_upload_prompt_data(client):
    h = login(client, THU, "student")
    r = client.get("/api/v1/me/dossier/reuse", params={"category": "TRANSCRIPT"}, headers=h).json()
    top = r["existing"][0]
    assert top["document"]["status"] == "VERIFIED" and top["used_by"] == 2 and not top["needs_new"]
    r = client.get("/api/v1/me/dossier/reuse", params={"category": "BANK_STATEMENT"}, headers=h).json()
    top = r["existing"][0]
    assert top["used_by"] == 1 and top["needs_new"][0]["university"] == "Kyungpook National University"
    ok = client.post("/api/v1/me/dossier/reuse-decisions", headers=h, json={"category": "BANK_STATEMENT", "decision": "KEEP", "document_id": top["document"]["id"]})
    assert ok.status_code == 201 and ok.json()["kind"] == "KEPT_EXISTING"
    lan = login(client, "student@demo.hangyul.kr", "student")
    bad = client.post("/api/v1/me/dossier/reuse-decisions", headers=lan, json={"category": "BANK_STATEMENT", "decision": "KEEP", "document_id": top["document"]["id"]})
    assert bad.status_code == 404
