"""University admissions funnel: one population, monotonic steps, consistent with the applicant list."""
from tests.conftest import login

ORDER = ["SUBMITTED", "REVIEWED", "OFFERED", "ACCEPTED", "TUITION_PAID", "VISA_ISSUED", "ARRIVED", "ENROLLED"]  # V3: ARRIVED step (unified metrics service)
PAST = {"UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "WAITLISTED", "REJECTED", "OFFERED", "OFFER_ACCEPTED", "TUITION_PENDING",
        "TUITION_PAID", "ADMISSION_CERTIFICATE_PENDING", "ADMISSION_CERTIFICATE_ISSUED", "VISA_PREPARATION", "VISA_SUBMITTED", "VISA_ISSUED", "ENROLLED"}


def test_admissions_funnel_is_monotonic_and_honest(client):
    h = login(client, "admin@pusan.univ.demo.hangyul.kr", "university")
    r = client.get("/api/v1/university/admissions-funnel", headers=h)
    assert r.status_code == 200
    d = r.json()
    assert [s["key"] for s in d["steps"]] == ORDER
    counts = [s["count"] for s in d["steps"]]
    assert counts == sorted(counts, reverse=True), "each step is a subset of the previous one"
    assert d["steps"][0]["conversion"] is None
    for s in d["steps"][1:]:
        c = s["conversion"]
        if c["denominator"] < d["min_denominator"]:
            assert c["insufficient_data"] and c["value"] is None
    # Enrolled matches the applicant list exactly.
    apps = client.get("/api/v1/applications", params={"page_size": 200}, headers=h).json()["items"]
    assert counts[-1] == sum(a["status"] == "ENROLLED" for a in apps)
    assert counts[0] >= sum(a["status"] in PAST for a in apps)


def test_admissions_funnel_requires_university_role(client):
    h = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    assert client.get("/api/v1/university/admissions-funnel", headers=h).status_code in (400, 403)
