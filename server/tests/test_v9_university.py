"""V9 university console: select-all-matching safe bulk actions (filter-based, server preview, never a decision), analytics by
question with exact drill-downs, partnership value with cohort + n, the program-rule impact preview (estimate only when every
counted profile has the data) and a reviewer leaving (open applicants reassigned, never orphaned). Tenant isolation for every
new endpoint."""
from datetime import timedelta

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import (
    Application,
    AuditLog,
    MatchSnapshot,
    OrganizationMember,
    Program,
    StudentEducation,
    StudentProfile,
    University,
    User,
)
from app.models.base import utcnow
from app.services.university_value import _eval

from .conftest import login

PNU = "admin@pusan.univ.demo.hangyul.kr"
ADMISSIONS = "admissions@pusan.univ.demo.hangyul.kr"
ANALYST = "analyst@pusan.univ.demo.hangyul.kr"
REVIEWER = "reviewer@pusan.univ.demo.hangyul.kr"
SKKU = "admin@sungkyunkwan.univ.demo.hangyul.kr"
STUDENT = "student@demo.hangyul.kr"
API = "/api/v1"


def _list(client, h, **params) -> dict:
    r = client.get(f"{API}/applications", params={"page_size": 200, **params}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def _total(client, h, **params) -> int:
    return _list(client, h, page_size=1, **params)["total"]


def _uid(email: str):
    with SessionLocal() as db:
        return db.scalar(select(User.id).where(User.email == email))


# ---------------------------------------------------------------- U3 select all matching

FILTER_SETS = [{}, {"status": ["SUBMITTED", "UNIVERSITY_REVIEW", "INTERVIEW", "WAITLISTED"]}, {"reached": "OFFERED"}, {"degree": "BACHELOR"},
               {"admin_check": "pending"}, {"reviewer": "none"}, {"q": "a"}, {"eligibility": "MEETS"}]


def test_filter_preview_equals_list(client):
    h = login(client, ADMISSIONS, "university")
    for f in FILTER_SETS:
        pv = client.post(f"{API}/university/bulk-filter/admin-check/preview", json={"filters": f}, headers=h)
        assert pv.status_code == 200, (f, pv.text)
        d = pv.json()
        lst = _list(client, h, **f)
        assert d["total"] == lst["total"], f
        assert {x["id"] for x in d["first"]} <= {i["id"] for i in lst["items"]}, f
        assert len(d["first"]) == min(8, d["total"])


def test_filter_bulk_runs_across_pages_with_per_item_results(client):
    h = login(client, ADMISSIONS, "university")
    team = client.get(f"{API}/university/team", headers=h).json()
    rid = str(_uid(ADMISSIONS))
    assert any(m["user_id"] == rid and m["role"] == "UNIVERSITY_ADMIN" for m in team)  # V22: one university permission
    f = {"status": ["SUBMITTED", "UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "WAITLISTED", "OFFERED"]}
    n = _total(client, h, **f)
    assert n >= 2
    before = {i["id"]: i.get("university_reviewer_id") for i in _list(client, h, **f)["items"]}
    # The list shows one row per page; "all N matching" still covers every row.
    assert _list(client, h, page_size=1, **f)["total"] == n
    stale = client.post(f"{API}/university/bulk-filter/assign-reviewer", json={"filters": f, "reviewer_id": rid, "expected_total": n + 1}, headers=h)
    assert stale.status_code == 409
    r = client.post(f"{API}/university/bulk-filter/assign-reviewer", json={"filters": f, "reviewer_id": rid, "expected_total": n}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == n and d["failed"] == 0 and d["mode"] == "filter"
    assert {x["id"] for x in d["results"]} == set(before)
    assert _total(client, h, reviewer=rid, **f) == n
    with SessionLocal() as db:
        assert db.scalar(select(AuditLog.id).where(AuditLog.action == "application.update", AuditLog.entity_id == next(iter(before))))
    # restore
    for aid, prev in before.items():
        client.patch(f"{API}/applications/{aid}", json={"university_reviewer_id": prev}, headers=h)


def test_filter_bulk_document_request_skips_non_requestable_and_preview_says_so(client):
    h = login(client, ADMISSIONS, "university")
    f = {"status": ["OFFERED", "OFFER_ACCEPTED", "TUITION_PENDING"]}
    pv = client.post(f"{API}/university/bulk-filter/document-request/preview", json={"filters": f}, headers=h).json()
    assert pv["eligible"] == 0 and pv["skipped"].get("not_requestable") == pv["total"]
    if pv["total"]:
        r = client.post(f"{API}/university/bulk-filter/document-request", json={"filters": f, "category": "TRANSCRIPT", "note": "Please send it."}, headers=h).json()
        assert r["succeeded"] == 0 and all(x["error"] == "not_requestable" for x in r["results"])


def test_filter_bulk_never_decides_and_roles(client):
    h = login(client, ADMISSIONS, "university")
    for bad in ("offer", "reject", "OFFERED", "admit"):
        assert client.post(f"{API}/university/bulk-filter/{bad}", json={"filters": {}}, headers=h).status_code == 404
        assert client.post(f"{API}/university/bulk-filter/{bad}/preview", json={"filters": {}}, headers=h).status_code == 404
    ha = login(client, ANALYST, "university")  # V22: every admin of the university previews and exports
    assert client.post(f"{API}/university/bulk-filter/admin-check/preview", json={"filters": {}}, headers=ha).status_code == 200
    assert client.post(f"{API}/university/bulk-filter/export", json={"filters": {}}, headers=ha).status_code == 200
    hs = login(client, STUDENT, "student")
    assert client.post(f"{API}/university/bulk-filter/admin-check/preview", json={"filters": {}}, headers=hs).status_code == 403


def test_filter_bulk_is_tenant_scoped(client):
    hs = login(client, SKKU, "university")
    hp = login(client, PNU, "university")
    pnu_ids = {i["id"] for i in _list(client, hp)["items"]}
    pv = client.post(f"{API}/university/bulk-filter/admin-check/preview", json={"filters": {}}, headers=hs).json()
    assert pv["total"] == _total(client, hs)
    assert not ({x["id"] for x in pv["first"]} & pnu_ids)
    # Another tenant's program id matches nothing.
    pnu_prog = client.get(f"{API}/university/programs", headers=hp).json()[1]["id"]
    assert client.post(f"{API}/university/bulk-filter/admin-check/preview", json={"filters": {"program_id": pnu_prog}}, headers=hs).json()["total"] == 0


def test_filter_export_csv(client):
    h = login(client, ADMISSIONS, "university")
    f = {"degree": "BACHELOR"}
    n = _total(client, h, **f)
    r = client.post(f"{API}/university/bulk-filter/export", json={"filters": f, "expected_total": n}, headers=h)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert len([ln for ln in r.text.strip().splitlines() if ln]) == n + 1


# ---------------------------------------------------------------- U5 analytics by question: drill-downs match

def test_question_rows_equal_drilldowns(client):
    h = login(client, PNU, "university")
    for f in ({}, {"degree": "BACHELOR"}):
        d = client.get(f"{API}/university/analytics/questions", params=f, headers=h).json()
        assert sum(r["submitted"] for r in d["countries"]) == _total(client, h, **f) == d["population"]["size"]
        for r in d["countries"]:
            if not r["key"]:
                continue
            assert _total(client, h, nationality=r["key"], **f) == r["submitted"], r
            assert _total(client, h, nationality=r["key"], reached="OFFERED", **f) == r["offered"], r
            assert _total(client, h, nationality=r["key"], reached="ENROLLED", **f) == r["enrolled"], r
            assert r["conversion"]["numerator"] == r["enrolled"] and r["conversion"]["denominator"] == r["submitted"]
            assert (r["conversion"]["value"] is None) == (r["submitted"] < 5)
        for r in d["programs"]:
            assert _total(client, h, program_id=r["id"], **f) == r["submitted"], r
            assert _total(client, h, program_id=r["id"], eligibility="MEETS", **f) == r["qualified"], r
            assert _total(client, h, program_id=r["id"], reached="OFFERED", **f) == r["offered"], r


def test_question_endpoint_tenant_and_student(client):
    hs = login(client, SKKU, "university")
    hp = login(client, PNU, "university")
    pnu_uni = client.get(f"{API}/university/overview", headers=hp).json()["university"]["id"]
    d = client.get(f"{API}/university/analytics/questions", params={"university_id": pnu_uni}, headers=hs).json()
    assert d["population"]["size"] == _total(client, hs)  # own tenant only; the parameter is ignored for university staff
    st = login(client, STUDENT, "student")
    assert client.get(f"{API}/university/analytics/questions", headers=st).status_code == 403
    assert client.get(f"{API}/applications", params={"eligibility": "MEETS"}, headers=st).status_code == 422


# ---------------------------------------------------------------- U7 partnership value

def test_partnership_value_every_number_has_cohort_and_n(client):
    h = login(client, PNU, "university")
    d = client.get(f"{API}/university/partnership-value", headers=h).json()
    keys = [m["key"] for m in d["metrics"]]
    for k in ("complete_on_first_review", "additional_document_request_rate", "median_review_days", "offer_rate", "acceptance_rate",
              "tuition_paid_rate", "visa_conversion", "arrival_rate", "enrollment_rate", "retention", "graduation"):
        assert k in keys
    for m in d["metrics"]:
        assert m["cohort"] and m["definition"] and m["denominator"] is not None, m
        assert m["insufficient"] == (m["denominator"] < 5), m
        if m["insufficient"]:
            assert m["value"] is None
    v = d["visa"]
    assert v["cohort"] and v["definition"]
    for r in v["rows"]:
        assert r["decided"] == r["issued"] + r["refused"]
        assert r["refusal_rate"]["denominator"] == r["decided"]
        assert (r["refusal_rate"]["value"] is None) == (r["decided"] < 5)
    assert v["total"]["issued"] == sum(r["issued"] for r in v["rows"])
    # Cohort follows the intake filter.
    intake = client.get(f"{API}/university/metrics", headers=h).json()["intakes"][0]["key"]
    d2 = client.get(f"{API}/university/partnership-value", params={"intake": intake}, headers=h).json()
    assert d2["population"]["intake"] == intake


def test_partnership_value_roles_and_tenant(client):
    hr = login(client, REVIEWER, "university")
    assert client.get(f"{API}/university/partnership-value", headers=hr).status_code == 200  # V22: every admin of the university
    hs = login(client, SKKU, "university")
    hp = login(client, PNU, "university")
    pnu_uni = client.get(f"{API}/university/overview", headers=hp).json()["university"]["id"]
    d = client.get(f"{API}/university/partnership-value", params={"university_id": pnu_uni}, headers=hs).json()
    assert d["population"]["size"] == _total(client, hs)


# ---------------------------------------------------------------- U6 program rule impact preview

def test_impact_logic_three_valued():
    facts = {"gpa": 72.0, "edu": 3, "scores": {"TOPIK": 3}}
    assert _eval({"min_topik_level": 3}, facts, ["LANGUAGE"])[0] is True
    assert _eval({"min_topik_level": 4}, facts, ["LANGUAGE"])[0] is False
    # Alternative: TOPIK fails, IELTS unknown → unknown (IELTS missing); both required: a failing test decides.
    r, miss = _eval({"min_topik_level": 4, "min_ielts": 6, "language_alternative": True}, facts, ["LANGUAGE"])
    assert r is None and miss == {"IELTS"}
    assert _eval({"min_topik_level": 4, "min_ielts": 6, "language_alternative": False}, facts, ["LANGUAGE"])[0] is False
    assert _eval({"min_gpa_percent": 70}, {"gpa": None, "edu": None, "scores": {}}, ["GPA"]) == (None, {"GPA"})
    assert _eval({"min_prior_education": "MASTER"}, facts, ["PRIOR_EDUCATION"])[0] is False


def _program(db, slug="pusan-national-university", name="Business Administration (BBA)"):
    uid = db.scalar(select(University.id).where(University.slug == slug))
    return db.scalar(select(Program).where(Program.university_id == uid, Program.name_en == name))


def test_impact_preview_counts_and_insufficient_data(client):
    h = login(client, PNU, "university")
    with SessionLocal() as db:
        prog = _program(db)
        pid = str(prog.id)
        req = prog.requirements[0]
        cur_gpa = req.min_gpa_percent or 0
    base = client.post(f"{API}/university/programs/{pid}/impact-preview", json={"min_gpa_percent": cur_gpa}, headers=h).json()
    assert base["applies"] is False  # nothing changed
    notes = client.post(f"{API}/university/programs/{pid}/impact-preview", json={"notes": "x"}, headers=h).json()
    assert notes["applies"] is False
    up = client.post(f"{API}/university/programs/{pid}/impact-preview", json={"min_gpa_percent": 99}, headers=h).json()
    assert up["applies"] and up["dimensions"] == ["GPA"]
    pop = up["population"]["total"]
    if up["estimate"] is not None:
        assert 0 <= up["estimate"]["would_stop"] <= pop

    # A matching prospective student without a GPA on file makes the GPA estimate impossible: "not enough data".
    with SessionLocal() as db:
        u = User(email="v9-impact@test.hangyul.kr", full_name="Impact Probe", password_hash="x", is_active=True)
        db.add(u)
        db.flush()
        prof = StudentProfile(user_id=u.id, nationality="VN")
        db.add(prof)
        db.flush()
        db.add(StudentEducation(profile_id=prof.id, level="HIGH_SCHOOL", institution="Probe HS", country="VN", gpa_percent=None))
        db.add(MatchSnapshot(user_id=u.id, program_id=prog.id, engine_version="test", eligible=True, tier="STRONG", score=1.0, reasons=[],
                             created_at=utcnow() + timedelta(seconds=1)))
        db.commit()
        uid_probe = u.id
    try:
        r = client.post(f"{API}/university/programs/{pid}/impact-preview", json={"min_gpa_percent": 99}, headers=h).json()
        assert r["population"]["total"] == pop + 1
        assert r["estimate"] is None
        assert r["insufficient"]["profiles"] >= 1 and r["insufficient"]["missing"].get("GPA", 0) >= 1
        # Pending proposals carry the same impact in the diff.
        hp = login(client, ADMISSIONS, "university")
        c = client.post(f"{API}/university/programs/{pid}/requirement-proposals", json={"min_gpa_percent": 99, "note": "v9 test"}, headers=hp)
        assert c.status_code == 201
        pend = [x for x in client.get(f"{API}/university/requirement-proposals", headers=h).json() if x["id"] == c.json()["id"]][0]
        assert pend["impact"]["insufficient"] == r["insufficient"]
        assert client.post(f"{API}/university/requirement-proposals/{c.json()['id']}/discard", headers=h).status_code == 200
    finally:
        with SessionLocal() as db:
            for m in db.scalars(select(MatchSnapshot).where(MatchSnapshot.user_id == uid_probe)).all():
                db.delete(m)
            p2 = db.scalar(select(StudentProfile).where(StudentProfile.user_id == uid_probe))
            db.delete(p2)
            db.flush()
            db.delete(db.get(User, uid_probe))
            db.commit()


def test_impact_preview_tenant_and_roles(client):
    with SessionLocal() as db:
        pid = str(_program(db).id)
    hs = login(client, SKKU, "university")
    assert client.post(f"{API}/university/programs/{pid}/impact-preview", json={"min_gpa_percent": 90}, headers=hs).status_code == 404
    st = login(client, STUDENT, "student")
    assert client.post(f"{API}/university/programs/{pid}/impact-preview", json={"min_gpa_percent": 90}, headers=st).status_code == 403


# ---------------------------------------------------------------- U8 reviewer leaves → reassigned, never orphaned

def test_reviewer_deactivation_reassigns_open_applicants(client):
    h = login(client, PNU, "university")
    reviewer = _uid(REVIEWER)
    officer = _uid(ADMISSIONS)
    with SessionLocal() as db:
        uni = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        open_ids = [str(a.id) for a in db.scalars(select(Application).where(Application.university_id == uni, Application.status.in_(["SUBMITTED", "UNIVERSITY_REVIEW", "INTERVIEW"]))
                                                   .limit(2)).all()]
        for aid in open_ids:
            db.get(Application, aid).university_reviewer_id = reviewer
        db.commit()
    team = {m["user_id"]: m for m in client.get(f"{API}/university/team", headers=h).json()}
    assert team[str(reviewer)]["open_assignments"] >= len(open_ids)
    listed = {a["id"] for a in client.get(f"{API}/university/team/{reviewer}/assignments", headers=h).json()}
    assert set(open_ids) <= listed

    # Another tenant's admin cannot see this member (V22: inside the university every admin manages the team).
    assert client.post(f"{API}/university/team/{reviewer}/deactivate", json={"reassign_to": str(officer)}, headers=login(client, SKKU, "university")).status_code == 404
    assert client.get(f"{API}/university/team/{reviewer}/assignments", headers=login(client, SKKU, "university")).status_code == 404
    # Never orphaned: no target → refused; the leaving person, or someone outside the university, cannot take them over.
    assert client.post(f"{API}/university/team/{reviewer}/deactivate", json={}, headers=h).status_code == 422
    assert client.post(f"{API}/university/team/{reviewer}/deactivate", json={"reassign_to": str(_uid(SKKU))}, headers=h).status_code == 422
    assert client.post(f"{API}/university/team/{reviewer}/deactivate", json={"reassign_to": str(reviewer)}, headers=h).status_code == 422
    assert client.post(f"{API}/university/team/{_uid(PNU)}/deactivate", json={}, headers=h).status_code == 409  # self

    # Any admin of the university — here the former "admissions officer" — performs the deactivation.
    r = client.post(f"{API}/university/team/{reviewer}/deactivate", json={"reassign_to": str(officer), "note": "left the faculty"},
                    headers=login(client, ADMISSIONS, "university"))
    assert r.status_code == 200, r.text
    assert r.json()["reassigned"] == len(listed)
    team = {m["user_id"]: m for m in client.get(f"{API}/university/team", headers=h).json()}
    assert team[str(reviewer)]["is_active"] is False and team[str(reviewer)]["open_assignments"] == 0
    assert _total(client, h, reviewer=str(officer), ids=open_ids) == len(open_ids)
    assert client.get(f"{API}/university/orphaned-assignments", headers=h).json() == []
    # The member's access is gone.
    rv = client.post(f"{API}/auth/login", json={"email": REVIEWER, "password": "Hangyul!2026", "client": "university"})
    if rv.status_code == 200:
        assert client.get(f"{API}/university/overview", headers={"Authorization": f"Bearer {rv.json()['access_token']}"}).status_code in (401, 403)
    assert client.post(f"{API}/university/team/{reviewer}/reactivate", headers=h).status_code == 200


def test_orphans_are_listed_when_access_removed_elsewhere(client):
    h = login(client, PNU, "university")
    reviewer = _uid(REVIEWER)
    with SessionLocal() as db:
        uni = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        a = db.scalar(select(Application).where(Application.university_id == uni, Application.status.in_(["SUBMITTED", "UNIVERSITY_REVIEW", "INTERVIEW"])))
        a.university_reviewer_id = reviewer
        m = db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == reviewer))
        m.is_active = False
        db.commit()
        aid = str(a.id)
    try:
        assert aid in {x["id"] for x in client.get(f"{API}/university/orphaned-assignments", headers=h).json()}
        assert client.get(f"{API}/university/orphaned-assignments", headers=login(client, STUDENT, "student")).status_code == 403
    finally:
        with SessionLocal() as db:
            db.scalar(select(OrganizationMember).where(OrganizationMember.user_id == reviewer)).is_active = True
            db.commit()


# ---------------------------------------------------------------- agency identity on the applicant

def test_agency_identity_not_recorded_and_tenant(client):
    h = login(client, PNU, "university")
    items = _list(client, h)["items"]
    a = next(i for i in items if i.get("agency_org_id"))
    d = client.get(f"{API}/university/applications/{a['id']}/agency", headers=h).json()["agency"]
    assert d["name"] and d["registration_status"] == "NOT_RECORDED"  # seed placeholders never count as a registration
    assert client.get(f"{API}/university/applications/{a['id']}/agency", headers=login(client, SKKU, "university")).status_code == 404
