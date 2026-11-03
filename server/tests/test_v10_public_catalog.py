"""V10: the public catalogue must never serve an unlisted programme.

`seed/extra_60_submission_v6.py` creates an **inactive** programme ("Authorised-submission fixture (development
only)") so the authorised-agency submission flow can be exercised in development. Its docstring says the
programme is "never listed in the catalogue, matches or the public site" — which was true of `/programs` (that
endpoint filters on `is_active`) but not of `/universities/{slug}`, which loaded the relationship unfiltered.
Because the name sorts first alphabetically, it became the default programme and the `<h1>` of the public
university page for anonymous visitors.
"""
from sqlalchemy import select

from app.models import Program, University


def test_public_university_detail_lists_only_active_programs(client, db):
    r = client.get("/api/v1/universities/pusan-national-university")
    assert r.status_code == 200
    body = r.json()

    served = {p["name_en"] for p in body["programs"]}
    inactive = {
        p.name_en for p in db.scalars(
            select(Program).join(University).where(University.slug == "pusan-national-university", Program.is_active.is_(False))
        )
    }
    assert inactive, "expected the development fixture to exist in the seeded database"
    assert served.isdisjoint(inactive), f"public page serves unlisted programmes: {sorted(served & inactive)}"

    # Nothing anywhere in the public payload may advertise a development fixture.
    assert "development only" not in r.text.lower()

    # The deadline list and the sample document list are built from the same filtered set.
    assert {d["program"] for d in body["deadlines"]}.isdisjoint(inactive)


def test_public_program_search_also_excludes_them(client, db):
    r = client.get("/api/v1/programs", params={"page_size": 200})
    assert r.status_code == 200
    assert "development only" not in r.text.lower()
