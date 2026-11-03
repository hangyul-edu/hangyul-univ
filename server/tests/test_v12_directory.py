"""V12 — the public Korean institution directory (REPORT §85, §90.2).

The point of these is the *invariants*, not the counts. The directory is the one public surface in the product
that carries real data, and the thing that keeps it trustworthy is that it can only ever carry institution-level
facts: no price, no deadline, no requirement, no match, no partnership. A regression there would not look like a
bug — it would look like a slightly richer card.
"""

from __future__ import annotations

from sqlalchemy import select

from app.api.v1.directory import INSTITUTION_TYPES, REGIONS
from app.models import Institution

API = "/api/v1"

#: Anything that would turn a directory entry back into the programme-search card V12 removed.
FORBIDDEN_CARD_FIELDS = {
    "tuition_per_semester_krw",
    "application_fee_krw",
    "est_living_cost_monthly_krw",
    "first_year_krw",
    "deadline",
    "application_deadline",
    "intakes",
    "deadlines",
    "requirements",
    "programs",
    "match",
    "tier",
    "score",
    "is_partner",
    "partner",
}


def test_regions_covers_the_seventeen_official_regions(client):
    d = client.get(f"{API}/directory/regions").json()
    assert [r["key"] for r in d["regions"]] == REGIONS
    assert len(REGIONS) == 17
    assert d["total"] == sum(r["count"] for r in d["regions"])
    # Every region reports a breakdown over exactly the three published institution kinds.
    for r in d["regions"]:
        assert set(r["by_type"]) == set(INSTITUTION_TYPES)
        assert r["count"] == sum(r["by_type"].values())


def test_directory_holds_the_national_register_not_the_catalogue(client, db):
    """Hundreds of institutions, and far more of them than Hangyul has admission data for."""
    d = client.get(f"{API}/directory/institutions?page_size=1").json()
    # The brief's threshold for the homepage's "50+ Korean universities" claim.
    assert d["total"] >= 50
    linked = db.scalar(
        select(Institution).where(Institution.catalog_university_id.isnot(None)).limit(1)
    )
    assert linked is not None, "the directory should link to the application catalogue where one exists"
    total = db.query(Institution).filter_by(status="ACTIVE").count()
    with_catalogue = db.query(Institution).filter(Institution.catalog_university_id.isnot(None)).count()
    # A directory entry without a catalogue entry is the ordinary case, not a gap (brief Part 21).
    assert with_catalogue < total


def test_a_directory_card_can_never_carry_an_application_fact(client):
    items = client.get(f"{API}/directory/institutions?page_size=40").json()["items"]
    assert items
    for i in items:
        leaked = FORBIDDEN_CARD_FIELDS & set(i)
        assert not leaked, f"{i['slug']} exposes {leaked}"
        assert i["institution_type"] in INSTITUTION_TYPES
        assert i["establishment"] in {"NATIONAL", "PUBLIC", "PRIVATE"}
        assert i["region"] in REGIONS
        assert i["name_ko"]


def test_detail_adds_provenance_and_still_no_application_facts(client, db):
    inst = db.scalar(select(Institution).where(Institution.status == "ACTIVE", Institution.ieqas_certified.is_(True)))
    d = client.get(f"{API}/directory/institutions/{inst.slug}").json()
    assert FORBIDDEN_CARD_FIELDS.isdisjoint(set(d) - {"catalog"})
    # Every published fact names where it came from and when it was checked.
    assert d["sources"]["registry"]["name"] == "대학알리미"
    assert d["sources"]["registry"]["survey_year"]
    assert d["last_verified"]
    # Certification is shown with the *list's* own date, not with today's.
    assert d["ieqas"]["certified"] is True
    assert d["ieqas_checked_on"]


def test_the_catalogue_link_is_a_count_not_a_programme_list(client, db):
    """`has_catalog` decides which call to action a visitor gets. It is never a list of programmes."""
    linked = db.scalar(select(Institution).where(Institution.catalog_university_id.isnot(None)))
    d = client.get(f"{API}/directory/institutions/{linked.slug}").json()
    assert d["has_catalog"] is True
    assert set(d["catalog"]) == {"programs", "open_intakes"}
    assert isinstance(d["catalog"]["programs"], int)

    unlinked = db.scalar(
        select(Institution).where(Institution.status == "ACTIVE", Institution.catalog_university_id.is_(None))
    )
    e = client.get(f"{API}/directory/institutions/{unlinked.slug}").json()
    assert e["has_catalog"] is False
    # No empty "catalog" object either: the absence is the answer (brief Part 22).
    assert "catalog" not in e


def test_withdrawn_institutions_are_never_browsable(client, db):
    """The registry is the arbiter of existence; something it has stopped listing is never shown as available."""
    inst = db.scalar(select(Institution).where(Institution.status == "ACTIVE"))
    slug = inst.slug
    # Committed, not flushed: the API answers on its own session and would not see an uncommitted change.
    inst.status = "WITHDRAWN"
    db.commit()
    try:
        assert client.get(f"{API}/directory/institutions/{slug}").status_code == 404
        # Scoped to its own region so one page covers it (the page size is capped at 200).
        listed = client.get(f"{API}/directory/institutions", params={"region": inst.region, "page_size": 200}).json()["items"]
        assert slug not in {i["slug"] for i in listed}
    finally:
        inst.status = "ACTIVE"
        db.commit()


def test_filters_and_ordering(client):
    seoul = client.get(f"{API}/directory/institutions?region=Seoul&page_size=5").json()
    assert seoul["total"] > 0
    assert all(i["region"] == "Seoul" for i in seoul["items"])

    unis = client.get(f"{API}/directory/institutions?institution_type=UNIVERSITY&page_size=5").json()
    assert all(i["institution_type"] == "UNIVERSITY" for i in unis["items"])

    # An unknown region or kind is not a silent empty list — it is not a thing.
    assert client.get(f"{API}/directory/institutions?region=Atlantis").status_code == 404
    assert client.get(f"{API}/directory/institutions?institution_type=ACADEMY").status_code == 404

    # Reading order follows the reader's script, so an English list is not sorted by 한글.
    en = client.get(f"{API}/directory/institutions?order=en&page_size=30").json()["items"]
    names = [(i["name_en"] or i["name_ko"]) for i in en if i["institution_type"] == "UNIVERSITY"]
    assert names == sorted(names)


def test_search_matches_either_script(client, db):
    inst = db.scalar(
        select(Institution).where(Institution.status == "ACTIVE", Institution.name_en.isnot(None))
    )
    by_ko = client.get(f"{API}/directory/institutions", params={"q": inst.name_ko}).json()
    assert inst.slug in {i["slug"] for i in by_ko["items"]}
    by_en = client.get(f"{API}/directory/institutions", params={"q": inst.name_en}).json()
    assert inst.slug in {i["slug"] for i in by_en["items"]}


def test_the_public_source_registry_hides_the_seeded_data_provenance(client):
    """§90.11.1: `/credits` was publishing a row named "Hangyul Univ development sample data"."""
    public = client.get(f"{API}/sources?page_size=200").json()["items"]
    assert public
    assert not [s for s in public if s["source_type"] == "DEMO"]
    assert not [s for s in public if "sample data" in s["name"].lower() or "demo" in s["name"].lower()]
    # The HQ registry still needs those rows, and opts in for them.
    internal = client.get(f"{API}/sources?page_size=200&include_internal=true").json()["items"]
    assert len(internal) > len(public)
