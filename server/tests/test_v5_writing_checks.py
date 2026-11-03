"""V5 writing — the deterministic automatic checks (pure functions, no database)."""
from datetime import date

from app.services import ai_provider
from app.services import writing_checks as wc

TODAY = date(2026, 9, 29)
DILNOZA = wc.Profile(nationality="UZ", date_of_birth=date(2006, 5, 14),
                     educations=[wc.Education("HIGH_SCHOOL", "Tashkent School No. 5", 2027, "EXPECTED", 4.5, 5)], languages={"TOPIK": 2})
KHU = wc.Target("Kyung Hee University", ["Kyung Hee", "KHU"], "Media and Communication",
                [("Yonsei University", ["Yonsei University", "Yonsei", "연세대학교"]), ("Pusan National University", ["Pusan National University", "Pusan National", "PNU"])])


def codes(findings):
    return [f["code"] for f in findings]


def test_graduation_year_mismatch_is_flagged_with_the_sentence_and_profile_value():
    text = "I graduated in 2024. Since then I have worked in my uncle's shop."
    f = [x for x in wc.check_facts(text, DILNOZA, TODAY) if x["code"] == "FACT_GRAD_YEAR"]
    assert len(f) == 1
    assert f[0]["quote"] == "I graduated in 2024."
    assert f[0]["params"] == {"claim_year": 2024, "profile_year": 2027, "profile_expected": True}
    assert "expected graduation 2027" in f[0]["text"] and f[0]["text"].endswith("Please check.")
    assert f[0]["severity"] == "BLOCKER" and text[f[0]["anchor_start"]:f[0]["anchor_end"]] == "I graduated in 2024."


def test_consistent_facts_and_future_goals_are_not_flagged():
    text = "I will graduate in 2027 from high school. I passed TOPIK level 2 and I am preparing for TOPIK 4. My GPA is 4.5/5."
    assert wc.check_facts(text, DILNOZA, TODAY) == []


def test_other_fact_mismatches():
    text = ("At university I studied economics. My GPA is 3.1/4.0 and I have TOPIK level 3. As a Chinese student I love Seoul. "
            "I am 25 years old. I graduated in 2023 from Samarkand Lyceum.")
    got = set(codes(wc.check_facts(text, DILNOZA, TODAY)))
    assert {"FACT_DEGREE", "FACT_GPA", "FACT_TOPIK", "FACT_NATIONALITY", "FACT_AGE", "FACT_GRAD_YEAR", "FACT_SCHOOL"} <= got


def test_other_university_mention_but_never_the_target_itself():
    f = wc.check_other_university("Studying at Yonsei University has been my goal.", KHU)
    assert codes(f) == ["OTHER_UNIVERSITY"] and f[0]["params"]["name"] == "Yonsei University" and f[0]["severity"] == "BLOCKER"
    assert wc.check_other_university("Kyung Hee University and KHU's media school.", KHU) == []
    pnu = wc.Target("Pusan National University", ["Pusan National", "PNU"], "Business Administration", [("Yonsei University", ["Yonsei"])])
    assert wc.check_other_university("Pusan National University in Busan", pnu) == []


def test_misspelled_target_name():
    f = wc.check_names("I want to join Kyunghee University next year.", KHU)
    assert codes(f) == ["NAME_MISSPELLED"] and f[0]["params"]["expected"] == "Kyung Hee University"
    assert wc.check_names("I want to join Kyung Hee University next year.", KHU) == []


def test_word_and_character_limits():
    assert codes(wc.check_limit("word " * 120, 100, None)) == ["OVER_LIMIT"]
    assert codes(wc.check_limit("word " * 30, 100, None)) == ["UNDER_LENGTH"]
    assert wc.check_limit("word " * 80, 100, None) == []
    assert codes(wc.check_limit("가" * 1200, None, 1000)) == ["OVER_CHAR_LIMIT"]


def test_prompt_clauses_are_extracted_and_checked():
    prompt = "Describe your motivation for applying, your academic background, and your study and career plans."
    assert wc.prompt_parts(prompt) == ["Describe your motivation for applying", "your academic background", "your study and career plans"]
    text = ("I chose this program because I want to understand media. " * 3) + ("My friends and I watch many films together every weekend. " * 3)
    missing = [f["params"]["part"] for f in wc.check_prompt(text, prompt)]
    assert "your academic background" in missing and "your study and career plans" in missing
    assert "Describe your motivation for applying" not in missing


def test_repetition_generic_and_similarity():
    text = "I love media and film. " + "I want to learn more about film. " * 2 + "Since I was young I have always dreamed of Korea."
    got = codes(wc.check_repetition(text) + wc.check_generic(text, KHU))
    assert "REPEATED_SENTENCE" in got and "GENERIC_PHRASE" in got
    base = "When I was fifteen my family shop sold snacks and I translated labels for customers every weekend which made me curious. " * 6
    sim = wc.check_similarity(base + "Mine.", [base + "Theirs."])
    assert codes(sim) == ["SIMILAR_TEXT"] and sim[0]["staff_only"] and "Theirs" not in (sim[0]["quote"] + sim[0]["text"])
    assert wc.check_similarity("short text " * 10, ["short text " * 10]) == []  # too short to judge


def test_checks_never_return_rewritten_content():
    text = "I graduated in 2024. I studied hard. I want to go to Yonsei University."
    out = wc.run_all(text, prompt="Why this program?", word_limit=500, char_limit=None, required_language="en", profile=DILNOZA, target=KHU,
                     others=[], today=TODAY)
    for f in out:
        assert set(f) >= {"kind", "code", "severity", "text", "fingerprint"}
        assert "suggestion" not in f and "replacement" not in f
        if f["quote"]:
            assert f["quote"] in text  # anchored to the student's own words


def test_ai_provider_defaults_to_rule_based(monkeypatch):
    monkeypatch.delenv("HG_AI_PROVIDER", raising=False)
    s = ai_provider.status()
    assert s.active == "none" and s.label == "AUTOMATIC_CHECK"
    monkeypatch.setenv("HG_AI_PROVIDER", "anthropic")
    s = ai_provider.status()
    assert s.active == "none" and s.note  # not implemented in this build: says so, never pretends
