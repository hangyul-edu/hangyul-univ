"""Pre-admission visa guidance: students see their real, nationality-specific checklist before a visa case exists."""


def test_eligibility_includes_nationality_specific_preview(client, student):
    body = client.get("/api/v1/visa/eligibility", headers=student).json()
    assert body["visa_type"].startswith("D-")
    items = body["checklist"]
    assert items, "a preview checklist is returned before admission"
    keys = {i["key"] for i in items}
    assert all(not i["done"] for i in items), "nothing is stored or pre-completed"
    # Vietnamese students get the embassy funds rule instead of the generic financial step.
    assert any(i["country_specific"] for i in items)
    # Every dependency points at a step that is actually in the list (replaced generic steps are remapped).
    for i in items:
        assert set(i["depends_on"]) <= keys, i["depends_on"]
    # Each step carries its provenance.
    assert all("verification_status" in i and "source_url" in i for i in items)
