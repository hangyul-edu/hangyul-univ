"""V31 (REPORT §424): names in the reader's language, in every shape the API actually sends.

V29's middleware matched only `{"university": <name_en>}`. A Korean reader still saw English in `top_university`
({name, name_ko}), in a waiting party {kind: "university", name}, and in programme names stored beside a university
in task params. This asks the real endpoint, as a Korean reader, and fails on any known English university name.
"""
import re

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.localnames import _maps, localize
from app.models import University

from .test_v4_university import login


def _english_names() -> set[str]:
    with SessionLocal() as db:
        return {en for en, ko in db.execute(select(University.name_en, University.name_ko)) if en and ko and en != ko}


def _strings(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from _strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from _strings(v)
    elif isinstance(o, str):
        yield o


def test_caseload_has_no_english_university_name_for_a_korean_reader(client):
    h = login(client, "counselor@lotus.demo.hangyul.kr", "agency")
    body = client.get("/api/v1/agency/students?page_size=100", headers={**h, "Accept-Language": "ko"}).json()
    names = _english_names()
    # Exact-name occurrences in structured name fields (free text such as stored English task `title` fallbacks is
    # rendered from title_key on the client and is checked by the l10n gate, not here).
    leaks = [s for it in body["items"] for k in ("top_university", "waiting_owner") if isinstance(it.get(k), dict)
             for s in [it[k].get("name")] if s in names]
    assert not leaks, leaks[:5]


def test_programme_resolved_by_university_pair():
    by_id, by_en = _maps()
    node = {"university": "Pusan National University", "program": "Business Administration (BBA)"}
    localize(node, by_id, by_en)
    assert node["university"] == "부산대학교"
    assert not re.search(r"[A-Za-z]{4,}", node["program"].replace("BBA", "")), node


def test_non_university_names_untouched():
    by_id, by_en = _maps()
    node = {"name": "Nguyễn Thị Lan", "name_ko": None, "kind": "person"}
    assert localize(node, by_id, by_en) == 0 and node["name"] == "Nguyễn Thị Lan"


def test_composite_application_label_resolved_only_when_both_parts_match():
    by_id, by_en = _maps()
    node = {"university": "Pusan National University · Business Administration (BBA)"}
    localize(node, by_id, by_en)
    assert node["university"].startswith("부산대학교 · "), node
    odd = {"university": "Pusan National University · Not A Real Programme"}
    localize(odd, by_id, by_en)
    assert odd["university"] == "Pusan National University · Not A Real Programme"


def test_application_label_resolved_only_when_both_parts_match():
    by_id, by_en = _maps()
    node = {"deadlines": [{"application_label": "Pusan National University · Business Administration (BBA)"},
                          {"application_label": "Pusan National University · Not A Real Programme"}]}
    localize(node, by_id, by_en)
    assert node["deadlines"][0]["application_label"].startswith("부산대학교 · ")
    assert node["deadlines"][1]["application_label"] == "Pusan National University · Not A Real Programme"
