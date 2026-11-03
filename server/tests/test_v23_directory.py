"""V23 — the public directory's name search ranks the institution called that first (REPORT §279)."""
import pytest

API = "/api/v1/directory/institutions"


@pytest.mark.parametrize(("q", "first"), [("한국외국어대학교", "한국외국어대학교"), ("서울대학교", "서울대학교"), ("연세", "연세대학교")])
def test_exact_and_prefix_matches_lead(client, q, first):
    r = client.get(API, params={"q": q, "page_size": 5})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items and items[0]["name_ko"] == first


def test_directory_has_425(client):
    assert client.get(API, params={"page_size": 1}).json()["total"] == 425
