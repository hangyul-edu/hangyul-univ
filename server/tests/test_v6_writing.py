"""V6 writing review: program-name validation, cross-application consistency, suggestions the student accepts or
declines (and the reviewer sees), the authorship statement recorded with the version, queue-view "next essay",
the V6 rubric, and no AI surface without a provider."""
import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.models import AuditLog, EssayAttestation, Program, University, User
from app.services import writing as W
from app.services import writing_checks as wc
from tests.conftest import login
from tests.v22_helpers import register_student

API = "/api/v1"
TODAY = date(2026, 10, 1)


# ------------------------------------------------------------------ pure checks

def _target(**kw):
    base = dict(university_name="Kyungpook National University", program_name="Business Administration (BBA)",
                other_programs=["Computer Science and Engineering", "M.S. Electrical Engineering", "Economics (3rd-year transfer)"])
    base.update(kw)
    return wc.Target(**base)


def test_other_program_named_is_flagged_with_the_sentence():
    text = "I am applying to Computer Science and Engineering because I love code. I want to build software."
    f = wc.check_other_program(text, _target())
    assert len(f) == 1 and f[0]["code"] == "OTHER_PROGRAM" and f[0]["kind"] == "PROGRAM"
    assert f[0]["quote"].startswith("I am applying to Computer Science") and f[0]["params"]["expected"] == "Business Administration (BBA)"
    assert text[f[0]["anchor_start"]:f[0]["anchor_end"]] == f[0]["quote"]
    # Degree prefixes are stripped ("M.S. Electrical Engineering" → "Electrical Engineering").
    assert wc.check_other_program("My cousin studies Electrical Engineering in Daegu.", _target())[0]["params"]["found"] == "Electrical Engineering"


def test_other_program_stays_silent_when_comparing_or_single_word():
    assert wc.check_other_program("Unlike Computer Science and Engineering, Business Administration lets me lead people.", _target()) == []
    assert wc.check_other_program("I studied economics at school.", _target()) == []  # one-word names are plain nouns
    assert wc.check_other_program("I am applying to Computer Science and Engineering.", _target(program_name=None)) == []


def test_cross_application_conflict_on_facts():
    me = "I passed TOPIK level 4 last spring. I graduated from high school in 2024. My GPA is 3.6/4.0."
    others = [wc.OwnEssay(text="I passed TOPIK 3 in March. I graduated from high school in 2024. My GPA was 3.6/4.0.",
                          essay_type="STUDY_PLAN", university="Pusan National University")]
    f = wc.check_cross_application(me, others)
    assert [x["params"]["topic"] for x in f] == ["TOPIK"]
    assert f[0]["code"] == "CROSS_APP_CONFLICT" and f[0]["kind"] == "CONSISTENCY"
    assert f[0]["params"]["claim"] == "TOPIK 4" and f[0]["params"]["other"] == "TOPIK 3"
    assert f[0]["params"]["other_university"] == "Pusan National University"
    assert me[f[0]["anchor_start"]:f[0]["anchor_end"]] == f[0]["quote"]


def test_cross_application_ignores_goals_scales_and_levels():
    me = "I am preparing for TOPIK 5 next year. I graduated from high school in 2024. My GPA is 8.1/10."
    others = [wc.OwnEssay(text="I passed TOPIK 4. I will graduate from university in 2028. My GPA is 3.4/4.", essay_type="PERSONAL_STATEMENT")]
    assert wc.check_cross_application(me, others) == []  # goal ≠ claim; HS vs university; /10 vs /4 not comparable
    assert wc.check_cross_application(me, None) == []
    # Ages one year apart can both be right (essays written months apart).
    assert wc.check_cross_application("I am 18 years old.", [wc.OwnEssay(text="I am 19 years old.")]) == []
    assert wc.check_cross_application("I am 18 years old.", [wc.OwnEssay(text="I am 21 years old.")])[0]["params"]["topic"] == "AGE"


def test_run_all_includes_the_new_checks():
    out = wc.run_all("I am applying to Computer Science and Engineering. I passed TOPIK 4.", prompt=None, word_limit=None, char_limit=None,
                     required_language=None, profile=wc.Profile(), target=_target(), others=[], today=TODAY,
                     own_essays=[wc.OwnEssay(text="I passed TOPIK 2.")])
    codes = {f["code"] for f in out}
    assert {"OTHER_PROGRAM", "CROSS_APP_CONFLICT"} <= codes


# ------------------------------------------------------------------ API flow

@pytest.fixture(scope="module")
def mdb():
    from app.core.db import SessionLocal

    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture(scope="module")
def case(client, mdb):
    """A Vietnamese student with Lotus Bridge, applying to Kyungpook BBA and Pusan Media & Communication."""
    reg = register_student(client, email=f"writing6-{uuid.uuid4().hex[:6]}@example.com", full_name="Vy Writing Six", locale="vi", nationality="VN")
    email, S = reg["email"], reg["h"]
    client.patch(f"{API}/me/profile", headers=S, json={"residence_country": "VN", "date_of_birth": "2007-05-01", "target_degree": "BACHELOR",
                                                       "target_intake_year": 2027, "target_intake_term": "SPRING", "desired_fields": ["business"]})
    client.post(f"{API}/me/educations", headers=S, json={"level": "HIGH_SCHOOL", "institution": "Da Nang High School", "country": "VN",
                                                         "graduation_year": 2025, "graduation_status": "GRADUATED"})
    o = client.post(f"{API}/me/orders", headers=S, json={"product_code": "PREMIUM"}).json()
    assert "Lotus" in o["assignment"]["organization"]
    ids = {}
    for slug, prefix in (("kyungpook-national-university", "Business"), ("pusan-national-university", "Media")):
        uni = mdb.scalar(select(University).where(University.slug == slug))
        prog = mdb.scalar(select(Program).where(Program.university_id == uni.id, Program.name_en.like(f"{prefix}%")))
        a = client.post(f"{API}/applications", headers=S, json={"program_id": str(prog.id)})
        assert a.status_code == 201, a.text
        ids[slug] = a.json()["id"]
    essays = client.get(f"{API}/essays", headers=S).json()["items"]
    ps = {slug: next(e["id"] for e in essays if e["application_id"] == app_id and e["essay_type"] == "PERSONAL_STATEMENT") for slug, app_id in ids.items()}
    reviewer = None
    for who in ("counselor@lotus.demo.hangyul.kr", "counselor2@lotus.demo.hangyul.kr", "manager@lotus.demo.hangyul.kr"):
        h = login(client, who, "agency")
        if client.get(f"{API}/essays/{ps['kyungpook-national-university']}", headers=h).status_code == 200:
            reviewer = h
            break
    assert reviewer
    return {"S": S, "A": reviewer, "knu": ps["kyungpook-national-university"], "pnu": ps["pusan-national-university"],
            "user": mdb.scalar(select(User).where(User.email == email))}


KNU_TEXT = ("I graduated from high school in Da Nang in 2025 and passed TOPIK level 4 last spring. I chose Business Administration (BBA) "
            "at Kyungpook National University because I want to learn how family companies grow. I studied hard.")
PNU_TEXT = ("I graduated from high school in Da Nang in 2025 and passed TOPIK level 3 this year. Media and Communication at Pusan "
            "National University fits my blog about Korean dramas.")


def test_cross_application_conflict_appears_in_the_essay_and_blocks_the_gate(client, case):
    S, A = case["S"], case["A"]
    assert client.put(f"{API}/essays/{case['pnu']}", headers=S, json={"body": PNU_TEXT}).status_code == 200
    assert client.put(f"{API}/essays/{case['knu']}", headers=S, json={"body": KNU_TEXT}).status_code == 200
    e = client.post(f"{API}/writing/essays/{case['knu']}/checks", headers=S).json()
    conflict = [f for f in e["writing"]["findings"] if f["code"] == "CROSS_APP_CONFLICT" and f["status"] == "OPEN"]
    assert len(conflict) == 1
    f = conflict[0]
    assert f["params"]["claim"] == "TOPIK 4" and f["params"]["other"] == "TOPIK 3" and f["params"]["other_university"] == "Pusan National University"
    assert f["staff_only"] is False  # the student's own essays — she sees it too
    assert KNU_TEXT[f["anchor_start"]:f["anchor_end"]] == f["quote"]
    st = client.get(f"{API}/essays/{case['knu']}", headers=A).json()
    gate = {i["key"]: i for i in st["writing"]["gate"]["items"]}
    assert gate["PROFILE_CONSISTENCY"]["state"] == "BLOCKER"
    assert any(r["code"] == "CROSS_APP_CONFLICT" for r in gate["PROFILE_CONSISTENCY"]["reasons"])


def test_suggestions_are_decided_by_the_student_and_the_reviewer_sees_it(client, case):
    S, A, eid = case["S"], case["A"], case["knu"]
    r = client.post(f"{API}/essays/{eid}/status", headers=S, json={"status": "SUBMITTED", "attest": True, "locale": "vi"})
    assert r.status_code == 200 and r.json()["status"] == "AGENCY_REVIEW"
    c1 = client.post(f"{API}/essays/{eid}/comments", headers=A, json={"body": "Be specific — what did you do?", "quote": "I studied hard.",
                                                                     "anchor_start": KNU_TEXT.index("I studied hard."), "suggestion": "I studied accounting every evening."}).json()["id"]
    c2 = client.post(f"{API}/essays/{eid}/comments", headers=A, json={"body": "Maybe shorter?", "quote": "last spring", "suggestion": "in 2026"}).json()["id"]
    note = client.post(f"{API}/essays/{eid}/comments", headers=A, json={"body": "Internal: check TOPIK certificate", "internal": True}).json()["id"]
    # While the reviewer has the text, nobody decides on suggestions.
    assert client.post(f"{API}/writing/essays/{eid}/suggestions/{c1}/decision", headers=S, json={"decision": "ACCEPT"}).status_code == 409
    assert client.post(f"{API}/writing/essays/{eid}/suggestions/{c1}/decision", headers=A, json={"decision": "ACCEPT"}).status_code == 403
    assert client.post(f"{API}/essays/{eid}/status", headers=A, json={"status": "CHANGES_REQUESTED"}).status_code == 200
    # The student sees both suggestions pending, never the internal note.
    se = client.get(f"{API}/essays/{eid}", headers=S).json()
    states = {c["id"]: c["suggestion_state"] for c in se["comments"]}
    assert states == {c1: "PENDING", c2: "PENDING"} and note not in states
    # Accept: a new version written by the student; decline: recorded with the reason.
    acc = client.post(f"{API}/writing/essays/{eid}/suggestions/{c1}/decision", headers=S, json={"decision": "ACCEPT"})
    assert acc.status_code == 200, acc.text
    body = acc.json()
    assert "I studied accounting every evening." in body["body"] and "I studied hard." not in body["body"]
    assert body["status"] == "STUDENT_REVISION"
    assert body["versions"][-1]["author"]["id"] == str(case["user"].id)
    rej = client.post(f"{API}/writing/essays/{eid}/suggestions/{c2}/decision", headers=S, json={"decision": "REJECT", "note": "I want to keep the season."})
    assert rej.status_code == 200
    assert client.post(f"{API}/writing/essays/{eid}/suggestions/{c2}/decision", headers=S, json={"decision": "ACCEPT"}).status_code == 409
    assert client.post(f"{API}/writing/essays/{eid}/suggestions/{note}/decision", headers=S, json={"decision": "ACCEPT"}).status_code == 404
    # The reviewer sees what happened to each suggestion (and the version the acceptance created).
    ae = client.get(f"{API}/essays/{eid}", headers=A).json()
    by = {c["id"]: c for c in ae["comments"]}
    assert by[c1]["suggestion_state"] == "ACCEPTED" and by[c1]["decision_version"] == body["current_version"] and by[c1]["resolved"]
    assert by[c2]["suggestion_state"] == "REJECTED" and by[c2]["decision_note"] == "I want to keep the season."
    assert by[note]["suggestion_state"] is None


def test_authorship_statement_is_recorded_with_the_version(client, mdb, case):
    S, A, eid = case["S"], case["A"], case["knu"]
    e = client.get(f"{API}/essays/{eid}", headers=A).json()
    att = e["writing"]["attestations"]
    assert len(att) == 1  # the submitted version carries the statement
    first = next(iter(att.values()))
    assert first["statement_code"] == "OWN_WORDS_AND_FACTS_V1" and first["locale"] == "vi"
    row = mdb.scalar(select(EssayAttestation).where(EssayAttestation.essay_id == uuid.UUID(eid)))
    assert row.user_id == case["user"].id and len(row.body_sha256) == 64 and "own words and facts" in row.statement_text
    assert mdb.scalar(select(AuditLog).where(AuditLog.action == "essay.attested", AuditLog.entity_id == eid))
    # The accepted suggestion made a new, not-yet-confirmed version; resubmitting with the statement confirms it.
    cur = e["current_version"]
    assert str(cur) not in att
    assert client.post(f"{API}/writing/essays/{eid}/attest", headers=A, json={"confirm": True}).status_code == 403
    assert client.post(f"{API}/writing/essays/{eid}/attest", headers=S, json={"confirm": False}).status_code == 422
    r = client.post(f"{API}/essays/{eid}/status", headers=S, json={"status": "SUBMITTED", "attest": True})
    assert r.status_code == 200
    assert str(cur) in client.get(f"{API}/essays/{eid}", headers=A).json()["writing"]["attestations"]
    # Idempotent per version.
    assert client.post(f"{API}/writing/essays/{eid}/attest", headers=S, json={"confirm": True}).status_code == 200


def test_attest_endpoint_for_clients_that_submit_without_it(client, case):
    S, eid = case["S"], case["pnu"]
    assert client.post(f"{API}/essays/{eid}/status", headers=S, json={"status": "SUBMITTED"}).status_code == 200
    e = client.get(f"{API}/essays/{eid}", headers=S).json()
    assert e["writing"]["attestations"] == {}
    r = client.post(f"{API}/writing/essays/{eid}/attest", headers=S, json={"confirm": True, "locale": "en"})
    assert r.status_code == 200
    again = client.post(f"{API}/writing/essays/{eid}/attest", headers=S, json={"confirm": True})
    assert list(again.json()["writing"]["attestations"]) == [str(e["current_version"])]


def test_application_use_rubric_groups_and_no_ai_surface(client, case):
    S, A, eid = case["S"], case["A"], case["knu"]
    se = client.get(f"{API}/essays/{eid}", headers=S).json()
    assert se["writing"]["used_by"][0]["university"] == "Kyungpook National University"
    assert se["writing"]["ai"] is None  # no HG_AI_PROVIDER → nothing AI-related
    assert "rubric" not in se["writing"]
    ae = client.get(f"{API}/essays/{eid}", headers=A).json()
    dims = {d["key"]: d["group"] for d in ae["writing"]["rubric"]["dimensions"]}
    for k in ("GENERIC", "VOICE", "STRUCTURE", "LOGIC", "MOTIVATION", "PROGRAM_CONNECTION", "FUTURE_PLAN", "EVIDENCE", "CLARITY"):
        assert dims[k] == "QUALITY"
    assert dims["FACTUAL_CONSISTENCY"] == "ACCURACY"
    assert client.put(f"{API}/writing/essays/{eid}/rubric/LOGIC", headers=A, json={"rating": "MEETS"}).status_code == 200


def test_next_essay_stays_in_the_queue_view(client, case):
    A = case["A"]
    q = client.get(f"{API}/writing/queue", headers=A, params={"view": "team"}).json()["items"]
    ids = [i["id"] for i in q]
    assert case["knu"] in ids and "escalated" in q[0]
    i = ids.index(case["knu"])
    nxt = client.get(f"{API}/writing/essays/{case['knu']}/next", headers=A, params={"view": "team"}).json()["id"]
    assert nxt == (ids[i + 1:] + ids[:i])[0]
    assert client.get(f"{API}/writing/essays/{case['knu']}/next", headers=A, params={"view": "bogus"}).status_code == 422


def test_next_after_leaving_the_view_uses_the_former_position(db):
    class P:  # minimal principal stand-in is not needed: exercise the pure ordering through a fake queue
        pass
    items = ["a", "b", "c"]
    orig = W.queue
    try:
        W.queue = lambda db_, p_, v: {"items": [{"id": x} for x in items]}
        assert W.next_in_queue(db, P(), "gone", "first", 1) == "b"
        assert W.next_in_queue(db, P(), "gone", "first", 9) == "c"
        assert W.next_in_queue(db, P(), "b", "first") == "c"
        assert W.next_in_queue(db, P(), "c", "first") == "a"
    finally:
        W.queue = orig


def test_seeded_statements_are_not_compared_with_each_other(db):
    """Seeded essays share generator templates; the "own words" blocker must flag copying between real students only."""
    from app.models import Essay

    seeded = db.scalars(select(Essay).join(User, User.id == Essay.owner_user_id)
                        .where(User.is_demo.is_(True), Essay.current_version > 0)).all()
    seeded = [e for e in seeded if W.latest_body(e) and wc.word_count(W.latest_body(e)) >= 60][:5]
    assert seeded, "the seed should contain written statements"
    for e in seeded:
        findings = W.run_checks(db, e)
        assert not [f for f in findings if f.code == "SIMILAR_TEXT" and f.status == "OPEN"]
    db.rollback()
