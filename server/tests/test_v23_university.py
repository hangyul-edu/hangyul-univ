"""V23 — University console defects found in the final audit (REPORT §273 U1–U3)."""
import csv
import io

import pytest
from sqlalchemy import select

from app.models import Application, PartnerContract, ScholarshipPool, University

API = "/api/v1"


def _list_total(client, headers, **params) -> int:
    r = client.get(f"{API}/applications", headers=headers, params={**params, "page_size": 1})
    assert r.status_code == 200, r.text
    return r.json()["total"]


def _export_rows(client, headers, **params) -> list[dict]:
    r = client.get(f"{API}/university/export/applications.csv", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return list(csv.DictReader(io.StringIO(r.text)))


@pytest.mark.parametrize("params", [
    {},
    {"reached": "OFFERED"},
    {"flagged": "true"},
    {"requests": "open"},
    {"admin_check": "pending", "status": "SUBMITTED"},
    {"status": ["UNIVERSITY_REVIEW", "INTERVIEW"]},
])
def test_export_filtered_is_exactly_the_list(client, pnu_admin, params):
    """U1 — "Export filtered" used to accept six of thirteen filters and wrote a larger file than the table."""
    assert len(_export_rows(client, pnu_admin, **params)) == _list_total(client, pnu_admin, **params)


def test_export_with_a_search_matches_the_list(client, pnu_admin):
    first = _export_rows(client, pnu_admin)
    assert first, "seed has PNU applicants"
    term = first[0]["student_name"].split()[0]
    rows = _export_rows(client, pnu_admin, q=term)
    assert rows and len(rows) == _list_total(client, pnu_admin, q=term)
    assert len(rows) <= len(first)


def test_export_never_leaves_the_tenant(client, pnu_admin, skku_admin):
    pnu_ids = {r["application_id"] for r in _export_rows(client, pnu_admin)}
    skku_ids = {r["application_id"] for r in _export_rows(client, skku_admin)}
    assert pnu_ids and not (pnu_ids & skku_ids)


def test_outcomes_answers(client, pnu_admin):
    """U2 — the outcomes query is now scoped to submitted (university-visible) applications; it must still answer."""
    for by in ("cohort", "nationality", "program", "agency"):
        r = client.get(f"{API}/university/outcomes", headers=pnu_admin, params={"by": by})
        assert r.status_code == 200, r.text


def test_award_refuses_an_application_from_another_university(client, pnu_admin, db):
    """U3 — `application_id` on a scholarship award was stored without checking it belonged to this university."""
    pnu = db.scalar(select(University).where(University.slug == "pusan-national-university"))
    pool = db.scalar(select(ScholarshipPool).join(PartnerContract, PartnerContract.id == ScholarshipPool.contract_id)
                     .where(PartnerContract.university_id == pnu.id))
    if pool is None:
        pytest.skip("seed has no PNU scholarship pool")
    own = db.scalar(select(Application).where(Application.university_id == pnu.id, Application.submitted_at.is_not(None)))
    other = db.scalar(select(Application).where(Application.university_id != pnu.id, Application.submitted_at.is_not(None)))
    r = client.post(f"{API}/university/scholarship-awards", headers=pnu_admin, json={
        "pool_id": str(pool.id), "student_id": str(own.student_user_id), "amount_krw": 1, "application_id": str(other.id)})
    assert r.status_code == 404, r.text


def test_unknown_status_is_a_422_not_a_500(client, pnu_admin):
    r = client.get(f"{API}/applications", headers=pnu_admin, params={"status": "UNDER_REVIEW"})
    assert r.status_code == 422
