"""V28 (UX_AUDIT MK-6): a directory card carries only verified signals — absent means "not verified", never "no"."""

from types import SimpleNamespace

from app.api.v1.directory import _signals


def _inst(enrichment):
    return SimpleNamespace(enrichment=enrichment)


def test_signals_only_when_verified():
    assert _signals(_inst(None)) is None
    assert _signals(_inst({"intl": {"english_taught_degrees": {"value": False}}, "gks": {"programmes": []}})) is None
    assert _signals(_inst({"gks": {"programmes": [{"programme": "UNDERGRADUATE"}]}}), 0) == {"gks": True}
    assert _signals(_inst({"intl": {"english_taught_degrees": {"value": True}}}), 4) == {"scholarships": 4, "english_degrees": True}


def test_directory_list_signals_have_no_false_or_zero(client):
    r = client.get("/api/v1/directory/institutions", params={"page_size": 50})
    assert r.status_code == 200, r.text
    for card in r.json()["items"]:
        sig = card["signals"]
        assert sig is None or (sig and all(sig.values()) and set(sig) <= {"scholarships", "gks", "english_degrees"})
