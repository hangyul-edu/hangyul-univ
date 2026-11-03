"""V5 i18n: server text that reaches student screens carries codes + params next to the English fallback."""
from datetime import date

from app.services.readiness import legalization_for


def test_legalization_note_has_code_and_params(db):
    th = legalization_for(db, "TH", "TRANSCRIPT")
    if date.today() < date(2027, 2, 28):
        assert th["note_code"] == "JOINS"
        assert th["note_params"] == {"country": "TH", "date": "2027-02-28"}
        assert "2027-02-28" in th["note"]  # English fallback kept
    assert legalization_for(db, "TW", "TRANSCRIPT")["note_code"] == "UNVERIFIED"
    for s in legalization_for(db, "NP", "TRANSCRIPT")["steps"]:
        assert s["key"] and s["title"]  # clients translate by step key
