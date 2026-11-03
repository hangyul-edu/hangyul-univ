"""V27 user simulations (brief §53) against the running dev API → docs/qa/v27/SIMULATIONS.md.

    cd server && .venv/bin/python ../scripts/qa/v27/simulations.py

Each persona answers the quick fit the way that student would; the record shows the groups, whether the desirable
universities are visible and in which group, the first reasons and scholarship hints, and — for the two legalization
personas — the route the server decides for a document issued in their country (apostille vs consular), via the same
`readiness.treatment` the checklist uses.
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "server"))

from sqlalchemy import select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.models import DocumentRequirement  # noqa: E402
from app.services.readiness import treatment  # noqa: E402

API = "http://127.0.0.1:8001/api/v1/public/fit"
WATCH = ["seoul-national-university", "yonsei-university", "korea-university", "kaist", "sungkyunkwan-university", "hanyang-university"]
PERSONAS = [
    ("Vietnamese undergraduate, TOPIK 3", {"nationality": "VN", "level": "BACHELOR", "gpa": {"value": 8.2, "scale_max": 10}, "languages": [{"test": "TOPIK", "score": 3}]}),
    ("Chinese undergraduate, TOPIK 4", {"nationality": "CN", "level": "BACHELOR", "gpa": {"value": 85, "scale_max": 100}, "languages": [{"test": "TOPIK", "score": 4}]}),
    ("Uzbek undergraduate, IELTS 6.0", {"nationality": "UZ", "level": "BACHELOR", "gpa": {"value": 4.3, "scale_max": 5}, "languages": [{"test": "IELTS_ACADEMIC", "score": 6}]}),
    ("Mongolian student, TOPIK 2", {"nationality": "MN", "level": "BACHELOR", "gpa": {"value": 3.2, "scale_max": 4}, "languages": [{"test": "TOPIK", "score": 2}]}),
    ("Nepali student, no language result", {"nationality": "NP", "level": "BACHELOR", "gpa": {"value": 3.4, "scale_max": 4}, "languages": []}),
    ("Burmese student, Korean language programme", {"nationality": "MM", "level": "LANGUAGE", "gpa": None, "languages": []}),
    ("English-speaking graduate applicant, TOEFL 100", {"nationality": "US", "level": "MASTER", "gpa": {"value": 3.7, "scale_max": 4}, "languages": [{"test": "TOEFL_IBT", "score": 100}]}),
    ("Doctoral applicant, IELTS 7.0", {"nationality": "IN", "level": "DOCTORATE", "gpa": {"value": 8.6, "scale_max": 10}, "languages": [{"test": "IELTS_ACADEMIC", "score": 7}]}),
    ("Strong GPA, no language score", {"nationality": "ID", "level": "BACHELOR", "gpa": {"value": 3.95, "scale_max": 4}, "languages": []}),
    ("Interested in Yonsei, TOPIK 5", {"nationality": "VN", "level": "BACHELOR", "gpa": {"value": 3.5, "scale_max": 4.3}, "languages": [{"test": "TOPIK", "score": 5}]}),
]
LEGAL = [("Documents issued in an apostille country (Mongolia)", "MN"), ("Documents needing consular legalization (Myanmar)", "MM"),
         ("Documents issued in Viet Nam (apostille from 2026-09-11)", "VN"), ("Documents issued in China (CHSI route where the guide says so)", "CN")]


def fit(body: dict, **extra) -> dict:
    import time

    for _ in range(5):
        req = urllib.request.Request(API, data=json.dumps({**body, **extra}).encode(), headers={"content-type": "application/json"})
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(62)  # the public limiter (90/min/IP) is working as designed; wait it out
    raise RuntimeError("rate limited")


def tiers_of(body: dict) -> dict:
    out, off = {}, 0
    while True:
        page = fit(body, sort="name", limit=48, offset=off)
        out.update({i["slug"]: i["tier"] for i in page["items"]})
        off += 48
        if off >= page["page_total"]:
            return out


lines = ["# V27 user simulations (brief §53)", "", f"Generated {date.today().isoformat()} by `scripts/qa/v27/simulations.py` against the dev API "
         "(the same endpoint and data the product uses). No probability is shown anywhere; tiers are the four honest groups.", ""]
for name, body in PERSONAS:
    d = fit(body)
    lines += [f"## {name}", "", f"- Answers: `{json.dumps(body, ensure_ascii=False)}`",
              f"- Universities in scope: **{d['total']}** — meets {d['counts']['MEETS']} · one step {d['counts']['ONE_STEP']} · "
              f"worth a closer look {d['counts']['CHALLENGE']} · hard to confirm {d['counts']['UNCLEAR']}; verified rules for {d['verified_rule_institutions']}",
              f"- GPA used: {d['gpa']['normalized_percent']}% ({d['gpa']['raw_value']} of {d['gpa']['scale_max']}, {d['gpa']['normalization_method']})" if d.get("gpa") else "- GPA: not asked for this level",
              f"- Next step offered: {d.get('unlock') or 'none'}"]
    if body["level"] != "LANGUAGE":
        t = tiers_of(body)
        lines.append("- Desirable universities: " + " · ".join(f"{s.split('-')[0]}={t.get(s, 'NOT SHOWN')}" for s in WATCH))
    first = [i for s in d["sections"] for i in s["items"]][:4]
    for i in first:
        sch = i["scholarship"] and (i["scholarship"]["best"] or i["scholarship"]["unlock"])
        lines.append(f"  - {i['name_ko']} — {i['tier']} — {i['reason']['code']} {json.dumps(i['reason']['params'], ensure_ascii=False)}"
                     + (f" — scholarship: {sch['name']} (≤{sch['waiver_max']}%)" if sch else ""))
    lines.append("")

with SessionLocal() as db:
    r = db.scalar(select(DocumentRequirement).where(DocumentRequirement.legalization_rule == "APOSTILLE_OR_CONSULAR").limit(1))
    chsi = db.scalar(select(DocumentRequirement).where(DocumentRequirement.legalization_rule == "CHINA_CHSI").limit(1))
    lines += ["## Legalization (server-side, `readiness.treatment`)", "", f"Requirement used: {r.name_ko or r.label} (guide rule {r.legalization_rule}).", ""]
    for name, cc in LEGAL:
        req = chsi if cc == "CN" and chsi else r
        t = treatment(db, req, None, cc, date.today())
        lines.append(f"- {name}: **{t['legalization']}** (country {t['country']}, basis {t['country_basis']}, translation {t['translation']}, notarization {t['notarization']})")
Path(__file__).resolve().parents[3].joinpath("docs/qa/v27/SIMULATIONS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines[:12]))
