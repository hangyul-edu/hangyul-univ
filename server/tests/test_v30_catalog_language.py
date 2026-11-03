"""V30 (REPORT §410): a UI locale leaking into the catalogue's instruction-language filter must never 500.

The agency catalogue kept that filter in the URL as `lang` — the platform's locale parameter — so any localized
link (`/universities?lang=ko`) sent `language=ko` to /programs, and the enum lookup in the DB driver raised.
The client now uses its own key (`teach`); the API types the parameter so an unknown value is a 422.
"""


def test_unknown_instruction_language_is_422_not_500(client):
    r = client.get("/api/v1/programs?language=ko&page_size=2")
    assert r.status_code == 422, r.text


def test_known_instruction_language_still_filters(client):
    r = client.get("/api/v1/programs?language=ENGLISH&page_size=50")
    assert r.status_code == 200
    assert all(p["instruction_language"] == "ENGLISH" for p in r.json()["items"])
