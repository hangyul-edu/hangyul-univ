"""V8 university console: every analytics number equals its drill-down list, safe bulk actions with per-item results and
tenant isolation, metric glossary, export presets and the program rule history."""
import time

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Application, ApplicationAdminCheck, AuditLog, DocumentRequest, University
from app.services.access import university_visible

from .conftest import login

PNU = "admin@pusan.univ.demo.hangyul.kr"
ADMISSIONS = "admissions@pusan.univ.demo.hangyul.kr"
ANALYST = "analyst@pusan.univ.demo.hangyul.kr"
SKKU = "admin@sungkyunkwan.univ.demo.hangyul.kr"
API = "/api/v1"


def _total(client, h, **params) -> int:
    r = client.get(f"{API}/applications", params={"page_size": 1, **params}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["total"]


def _uni_apps(slug: str) -> list[str]:
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == slug))
        return [str(i) for i in db.scalars(select(Application.id).where(Application.university_id == uid, university_visible())).all()]


def test_breakdowns_equal_filtered_list_totals(client):
    h = login(client, PNU, "university")
    a = client.get(f"{API}/university/analytics", headers=h).json()
    all_total = _total(client, h)
    assert sum(r["count"] for r in a["status_distribution"]) == all_total
    # Every listed application reached SUBMITTED — including those still exactly at SUBMITTED (step index 0).
    assert _total(client, h, reached="SUBMITTED") == all_total
    assert sum(r["count"] for r in a["by_intake"]) == all_total
    assert sum(r["count"] for r in a["by_degree"]) == all_total
    for r in a["by_intake"]:
        assert _total(client, h, intake=r["key"]) == r["count"], r
    for r in a["by_degree"]:
        assert _total(client, h, degree=r["key"]) == r["count"], r
    for r in a["by_program"]:
        assert _total(client, h, program_id=r["id"]) == r["count"], r
    for r in a["by_nationality"]:
        if r["key"]:
            assert _total(client, h, nationality=r["key"]) == r["count"], r
    for r in a["status_distribution"]:
        assert _total(client, h, status=r["key"]) == r["count"], r
    for r in a["by_agency"]:
        assert _total(client, h, agency_id=r["agency_id"]) == r["applications"], r


def test_breakdowns_match_under_intake_and_degree_filters(client):
    h = login(client, PNU, "university")
    base = client.get(f"{API}/university/analytics", headers=h).json()
    intake = base["by_intake"][0]["key"] if base["by_intake"] else None
    degree = base["by_degree"][0]["key"] if base["by_degree"] else None
    assert intake and degree
    for f in ({"intake": intake}, {"degree": degree}, {"intake": intake, "degree": degree}):
        a = client.get(f"{API}/university/analytics", params=f, headers=h).json()
        total = _total(client, h, **f)
        assert sum(r["count"] for r in a["status_distribution"]) == total, f
        for r in a["by_program"]:
            assert _total(client, h, program_id=r["id"], **f) == r["count"], (f, r)
        for r in a["by_agency"]:
            assert _total(client, h, agency_id=r["agency_id"], **f) == r["applications"], (f, r)
        fun = client.get(f"{API}/university/admissions-funnel", params=f, headers=h).json()
        for s in fun["steps"]:
            assert _total(client, h, reached=s["key"], **f) == s["count"], (f, s)


def test_intake_filter_accepts_key_or_id_and_rejects_garbage(client):
    h = login(client, PNU, "university")
    assert client.get(f"{API}/applications", params={"intake": "nonsense"}, headers=h).status_code == 422
    assert client.get(f"{API}/applications", params={"degree": "WIZARD"}, headers=h).status_code == 422
    with SessionLocal() as db:
        a = db.get(Application, _uni_apps("pusan-national-university")[0])
        iid = str(a.intake_id)
    items = client.get(f"{API}/applications", params={"intake": iid, "page_size": 100}, headers=h).json()["items"]
    assert items and all(i["intake_id"] == iid for i in items if "intake_id" in i)


def test_list_filters_are_tenant_safe(client):
    """Another university's ids, programs or agencies never widen what a university can list."""
    pnu_ids = set(_uni_apps("pusan-national-university"))
    h = login(client, SKKU, "university")
    got = client.get(f"{API}/applications", params={"ids": list(pnu_ids)[:20], "page_size": 100}, headers=h).json()
    assert got["total"] == 0
    a = client.get(f"{API}/university/analytics", headers=login(client, PNU, "university")).json()
    if a["by_program"]:
        assert _total(client, h, program_id=a["by_program"][0]["id"]) == 0


def test_analytics_is_one_pass_and_fast(client):
    h = login(client, PNU, "university")
    t = time.perf_counter()
    r = client.get(f"{API}/university/analytics", headers=h)
    assert r.status_code == 200
    assert time.perf_counter() - t < 2.0
    for row in r.json()["by_agency"]:
        assert {"offer_rate", "yield", "complete_on_first_review"} <= set(row)


def test_glossary_states_every_part_of_a_definition(client):
    r = client.get(f"{API}/university/glossary", headers=login(client, ANALYST, "university"))
    assert r.status_code == 200
    d = r.json()
    assert d["min_denominator"] == 5
    keys = {g["key"] for g in d["metrics"]}
    assert {"offer_rate", "yield", "submitted", "retention", "median_processing_days"} <= keys
    for g in d["metrics"]:
        for f in ("numerator", "population", "intake", "date_range", "small_sample", "definition"):
            assert g[f], (g["key"], f)
        if g["kind"] == "rate":
            assert g["denominator"], g["key"]


def test_bulk_requires_write_role_and_rejects_decisions(client):
    ids = _uni_apps("pusan-national-university")[:2]
    # V22: every admin of the university runs the safe bulk actions (the read-only analyst title is gone)…
    r = client.post(f"{API}/university/bulk/admin-check", json={"ids": ids}, headers=login(client, ANALYST, "university"))
    assert r.status_code == 200, r.text
    assert all(x["ok"] for x in r.json()["results"])
    # …a student never does, and nobody admits or rejects in bulk.
    assert client.post(f"{API}/university/bulk/admin-check", json={"ids": ids}, headers=login(client, "student@demo.hangyul.kr", "student")).status_code == 403
    h = login(client, ADMISSIONS, "university")
    for action in ("admit", "reject", "decision", "status"):
        assert client.post(f"{API}/university/bulk/{action}", json={"ids": ids}, headers=h).status_code == 404


def test_bulk_admin_check_per_item_results_and_tenancy(client):
    pnu = _uni_apps("pusan-national-university")[:3]
    skku = _uni_apps("sungkyunkwan-university")[:1]
    h = login(client, ADMISSIONS, "university")
    with SessionLocal() as db:
        statuses = {i: db.get(Application, i).status for i in pnu}
    r = client.post(f"{API}/university/bulk/admin-check", json={"ids": pnu + skku + ["not-a-uuid"]}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["total"] == len(pnu) + len(skku) + 1
    by = {x["id"]: x for x in d["results"]}
    for i in pnu:
        assert by[i]["ok"] and by[i]["result"] in ("checked", "unchanged")
    for i in skku + ["not-a-uuid"]:
        assert by[i] == {"id": i, "ok": False, "error": "not_found"}
    with SessionLocal() as db:
        for i in pnu:
            assert db.scalar(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id == i))
            assert db.get(Application, i).status == statuses[i]  # never a decision
        for i in skku:
            assert not db.scalar(select(ApplicationAdminCheck).where(ApplicationAdminCheck.application_id == i))
        assert db.scalar(select(AuditLog.id).where(AuditLog.action == "application.admin_check", AuditLog.entity_id == pnu[0]).limit(1))
    # Second run is idempotent; the list filter and the detail see the flag.
    again = client.post(f"{API}/university/bulk/admin-check", json={"ids": pnu[:1]}, headers=h).json()
    assert again["results"][0]["result"] == "unchanged"
    assert _total(client, h, admin_check="done", ids=pnu) == len(pnu)
    det = client.get(f"{API}/applications/{pnu[0]}", headers=h).json()
    assert det["admin_check"] and det["admin_check"]["checked_at"]
    # Undo is audited and cannot reach another tenant.
    assert client.delete(f"{API}/university/applications/{pnu[0]}/admin-check", headers=h).status_code == 204
    assert client.delete(f"{API}/university/applications/{skku[0]}/admin-check", headers=h).status_code == 404 if skku else True


def test_bulk_assign_reviewer_validates_member(client):
    h = login(client, ADMISSIONS, "university")
    ids = _uni_apps("pusan-national-university")[:2]
    team = client.get(f"{API}/university/team", headers=h).json()
    # V22: every active admin of the university is a valid reviewer; nobody outside it is.
    reviewer = next(m for m in team if m["is_active"])
    rid = reviewer["user_id"]
    skku_admin = client.get(f"{API}/university/team", headers=login(client, SKKU, "university")).json()[0]
    assert client.post(f"{API}/university/bulk/assign-reviewer", json={"ids": ids, "reviewer_id": skku_admin.get("user_id") or skku_admin.get("id")},
                       headers=h).status_code == 422
    r = client.post(f"{API}/university/bulk/assign-reviewer", json={"ids": ids, "reviewer_id": rid}, headers=h).json()
    assert r["succeeded"] == len(ids)
    assert _total(client, h, reviewer=rid, ids=ids) == len(ids)
    cleared = client.post(f"{API}/university/bulk/assign-reviewer", json={"ids": ids, "reviewer_id": None}, headers=h).json()
    assert all(x["result"] == "cleared" for x in cleared["results"])


def test_bulk_document_request_same_as_single_and_skips_closed(client):
    h = login(client, ADMISSIONS, "university")
    with SessionLocal() as db:
        uid = db.scalar(select(University.id).where(University.slug == "pusan-national-university"))
        apps = db.scalars(select(Application).where(Application.university_id == uid, university_visible())).all()
        open_ = [str(a.id) for a in apps if a.status.value in ("SUBMITTED", "UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "WAITLISTED")][:2]
        closed = [str(a.id) for a in apps if a.status.value in ("ENROLLED", "REJECTED", "VISA_ISSUED", "OFFER_ACCEPTED")][:1]
    assert client.post(f"{API}/university/bulk/document-request", json={"ids": open_ or closed, "category": "SELFIE", "note": "x y z"}, headers=h).status_code == 422
    assert client.post(f"{API}/university/bulk/document-request", json={"ids": open_ or closed, "category": "TRANSCRIPT"}, headers=h).status_code == 422
    r = client.post(f"{API}/university/bulk/document-request",
                    json={"ids": open_ + closed, "category": "BANK_STATEMENT", "note": "Please upload a bank statement dated this month."}, headers=h)
    assert r.status_code == 200, r.text
    by = {x["id"]: x for x in r.json()["results"]}
    for i in open_:
        assert by[i]["ok"] and by[i]["result"] == "requested"
        with SessionLocal() as db:
            req = db.get(DocumentRequest, by[i]["request_id"])
            assert req.status == "OPEN" and req.category == "BANK_STATEMENT"
    for i in closed:
        assert by[i] == {**by[i], "ok": False, "error": "not_requestable"}


def test_export_presets_shape_and_saved_configuration(client):
    h = login(client, ADMISSIONS, "university")
    d = client.get(f"{API}/university/export-presets", headers=h).json()
    assert d["capabilities"]["scheduled"] is False
    assert {p["key"] for p in d["presets"]} == {"current_intake", "admitted", "visa", "enrolment", "outcomes"}
    assert next(p for p in d["presets"] if p["key"] == "outcomes")["personal_data"] is False
    r = client.get(f"{API}/university/export/preset/admitted.csv", headers=h)
    assert r.status_code == 200 and "student_name" in r.text.splitlines()[0]
    after = client.get(f"{API}/university/export-presets", headers=h).json()
    assert next(p for p in after["presets"] if p["key"] == "admitted")["last_run"]
    saved = client.post(f"{API}/university/export-presets",
                        json={"name": "Admitted, short", "base": "admitted", "columns": ["student_name", "program", "evil"], "filters": {"degree": "MASTER", "x": 1}},
                        headers=h)
    assert saved.status_code == 201, saved.text
    s = saved.json()
    assert s["columns"] == ["student_name", "program"] and s["filters"] == {"degree": "MASTER"}
    run = client.get(f"{API}/university/export/preset/admitted.csv", params={"saved_id": s["id"]}, headers=h)
    assert run.text.lstrip("﻿").splitlines()[0] == "student_name,program"
    # Another university cannot run or delete it; every admin of this one (V22) may export, audited.
    sk = login(client, SKKU, "university")
    assert client.get(f"{API}/university/export/preset/admitted.csv", params={"saved_id": s["id"]}, headers=sk).status_code == 404
    assert client.delete(f"{API}/university/export-presets/{s['id']}", headers=sk).status_code == 404
    assert client.get(f"{API}/university/export/preset/admitted.csv", headers=login(client, ANALYST, "university")).status_code == 200
    assert client.delete(f"{API}/university/export-presets/{s['id']}", headers=h).status_code == 204


def test_export_selected_ids_only(client):
    h = login(client, ADMISSIONS, "university")
    ids = _uni_apps("pusan-national-university")[:2]
    r = client.get(f"{API}/university/export/applications.csv", params={"ids": ids}, headers=h)
    assert r.status_code == 200
    assert len(r.text.strip().splitlines()) == 1 + len(ids)
    skku = _uni_apps("sungkyunkwan-university")[:2]
    r2 = client.get(f"{API}/university/export/applications.csv", params={"ids": skku}, headers=h)
    assert len(r2.text.strip().splitlines()) == 1


def test_rule_history_is_tenant_scoped(client):
    h = login(client, PNU, "university")
    progs = client.get(f"{API}/university/programs", headers=h).json()
    assert progs
    r = client.get(f"{API}/university/programs/{progs[0]['id']}/rule-history", headers=h)
    assert r.status_code == 200
    assert "entries" in r.json() and "effective_from" in r.json()
    assert client.get(f"{API}/university/programs/{progs[0]['id']}/rule-history", headers=login(client, SKKU, "university")).status_code == 404
