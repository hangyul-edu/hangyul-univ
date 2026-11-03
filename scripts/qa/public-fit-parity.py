"""Parity: apps/marketing-web/api/public-fit.py (serverless, exported snapshot) == FastAPI (database), same inputs.

    server/.venv/bin/python scripts/qa/public-fit-parity.py

Runs on the local seeded DB right after `scripts/public-data/export.py`. Fails on any response difference.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server"))
os.chdir(ROOT / "server")

spec = importlib.util.spec_from_file_location("public_fit", ROOT / "apps/marketing-web/api/public-fit.py")
fn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fn)

from fastapi.testclient import TestClient  # noqa: E402

import app.api.v1.public as public_api  # noqa: E402
from app.main import app  # noqa: E402
from app.services import fit  # noqa: E402

public_api.track = lambda *a, **k: None  # parity only: no analytics rows in the dev DB
public_api.FIT_RATE_LIMIT = 10**9

CASES = [
    {"nationality": "VN", "level": "BACHELOR"},
    {"nationality": "VN", "level": "BACHELOR", "languages": [{"test": "TOPIK", "score": 3}]},
    {"nationality": "US", "level": "MASTER", "languages": [{"test": "TOEFL_IBT", "score": 85}], "gpa": {"value": 3.4, "scale_max": 4.0}},
    {"nationality": "CN", "level": "LANGUAGE"},
    {"nationality": "UZ", "level": "ASSOCIATE", "languages": [{"test": "TOPIK", "score": 2}], "sort": "scholarship"},
    {"nationality": "MN", "level": "DOCTORATE", "languages": [{"test": "IELTS", "score": 6.5}], "sort": "region"},
    {"nationality": "JP", "level": "BACHELOR", "languages": [{"test": "TOPIK", "score": 4}], "tier": "MEETS", "offset": 12, "limit": 24},
    {"nationality": "ID", "level": "TRANSFER", "sort": "name", "region": "Seoul"},
    {"nationality": "VN", "level": "BACHELOR", "languages": [{"test": "TOPIK", "score": 9}]},   # out of range → 422
    {"nationality": "VN", "level": "NOPE"},                                                    # bad level → 422
]
SUMMARIES = [("yonsei-university", "BACHELOR", "TOPIK:4", None), ("gachon-university", "BACHELOR", "", 82.5),
             ("kaist", "MASTER", "TOEFL_IBT:90", 90.0), ("seoul-national-university", "BACHELOR", "TOPIK:3,IELTS:6", None)]



def fresh_db_snapshot():
    """Both sides share `app.services.fit` in this one process; the API must read its own DB snapshot, not the one
    the function primed (on Vercel the function runs alone)."""
    fit.TTL = 300.0
    fit.invalidate()


bad = 0
with TestClient(app) as client:
    for c in CASES:
        fresh_db_snapshot()
        r = client.post("/api/v1/public/fit", json=c)
        try:
            mine, status = fn.quick_fit(c), 200
        except fn.Invalid as e:
            mine, status = {"detail": e.detail}, e.status
        same = r.status_code == status and (status != 200 or r.json() == json.loads(json.dumps(mine)))
        if status != 200:  # validation messages differ in wording; the status and the domain codes must agree
            same = r.status_code == status and (not isinstance(mine["detail"], dict) or r.json()["detail"] == mine["detail"])
        bad += not same
        print(f"{'PASS' if same else 'FAIL'} fit {json.dumps(c)[:90]} → {r.status_code}/{status}")
    for slug, level, langs, gpa in SUMMARIES + [("yonsei-university", None, "", None), ("no-such-slug", None, "", None)]:
        params = {**({"level": level} if level else {}), **({"langs": langs} if langs else {}), **({"gpa_pct": gpa} if gpa is not None else {})}
        fresh_db_snapshot()
        r = client.get(f"/api/v1/directory/institutions/{slug}/admissions", params=params)
        try:
            mine, status = fn.admissions({"admissions": [slug], **{k: [str(v)] for k, v in params.items()}}), 200
        except fn.Invalid as e:
            mine, status = {"detail": e.detail}, e.status
        same = r.status_code == status and r.json() == json.loads(json.dumps(mine))
        bad += not same
        print(f"{'PASS' if same else 'FAIL'} admissions {slug} {params} → {r.status_code}/{status}")
fit.invalidate()
print("RESULT", "FAIL" if bad else "PASS", f"({bad} differences)")
sys.exit(1 if bad else 0)
