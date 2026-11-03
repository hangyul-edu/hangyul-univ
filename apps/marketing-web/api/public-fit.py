"""Public Quick Fit as a Vercel Python function (P0 hotfix, 2026-11-03).

The anonymous Quick Fit (/start) and the per-university scholarship summary on a detail page need the fit engine,
`server/app/services/fit.py`. That module is imported here **unchanged** and run over the snapshot exported by
`scripts/public-data/export.py` (`public/data/public/fit-snapshot.json`), so there is one set of rules and no
database: the engine's own `snapshot()` cache is primed with the exported data instead of being read from Postgres.

    POST /api/v1/public/fit                                   → FastAPI `public.quick_fit`, same body and response
    GET  /api/v1/directory/institutions/<slug>/admissions?…   → FastAPI `directory.institution_admissions`: the exported
                                                                admissions record plus the visitor's `summary`

Both reach this file through rewrites in apps/marketing-web/vercel.json, so the page calls the same paths in development
(Vite proxy → FastAPI) and in production (→ this function).

Input validation mirrors `server/app/api/v1/public.py::FitIn` field for field; `scripts/qa/public-fit-parity.py` runs
this handler and the FastAPI endpoint on the same inputs and fails if any response differs. Not reproduced: the
anonymous `quick_fit_completed` analytics event (it needs the database) — the product works without it.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent


def _find(rel: str) -> Path:
    for base in (HERE.parent.parent.parent, HERE.parent, Path.cwd(), Path("/var/task")):
        p = base / rel
        if p.exists():
            return p
    raise RuntimeError(f"public-fit: {rel} not found")


sys.path.insert(0, str(_find("server/app").parent))
from app.services import fit  # noqa: E402  — the engine itself, unchanged

SNAPSHOT_PATH = _find("apps/marketing-web/public/data/public/fit-snapshot.json") if not (HERE.parent / "public/data/public/fit-snapshot.json").exists() \
    else HERE.parent / "public/data/public/fit-snapshot.json"


def _load() -> dict:
    raw = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    if raw.get("engine") != fit.ENGINE:
        raise RuntimeError(f"snapshot engine {raw.get('engine')} != {fit.ENGINE}; re-run scripts/public-data/export.py")
    insts = {}
    for d in raw["insts"]:
        d = dict(d)
        d["rules"] = defaultdict(list, d["rules"])
        insts[d["id"]] = fit.Inst(**d)
    return {"insts": insts, "featured": raw["featured"]}


SNAP = _load()
BY_SLUG = {i.slug: i for i in SNAP["insts"].values()}
fit.TTL = float("inf")  # the snapshot is the deployment's data; it never expires inside one deployment


def _prime() -> None:
    fit._cache["at"], fit._cache["data"] = time.monotonic(), SNAP


_prime()

# ------------------------------------------------------------------------------------------- validation (= FitIn)
LEVELS = set(fit.LEVELS)
SORTS = {"recommended", "scholarship", "region", "name"}
TIERS = {"MEETS", "ONE_STEP", "CHALLENGE", "UNCLEAR"}


class Invalid(Exception):
    def __init__(self, status: int, detail):
        self.status, self.detail = status, detail


def _num(v, name: str) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        try:
            return float(v)
        except (TypeError, ValueError):
            raise Invalid(422, [{"loc": ["body", name], "msg": "Input should be a valid number"}]) from None
    return float(v)


def _int(v, name: str, lo: int, hi: int, default: int) -> int:
    if v is None:
        return default
    if isinstance(v, bool) or not isinstance(v, int):
        raise Invalid(422, [{"loc": ["body", name], "msg": "Input should be a valid integer"}])
    if not lo <= v <= hi:
        raise Invalid(422, [{"loc": ["body", name], "msg": f"Input should be between {lo} and {hi}"}])
    return v


def validate(body) -> dict:
    if not isinstance(body, dict):
        raise Invalid(422, [{"loc": ["body"], "msg": "Input should be a valid object"}])
    nat = body.get("nationality")
    if not isinstance(nat, str) or len(nat) != 2:
        raise Invalid(422, [{"loc": ["body", "nationality"], "msg": "String should have 2 characters"}])
    level = body.get("level")
    if level not in LEVELS:
        raise Invalid(422, [{"loc": ["body", "level"], "msg": "String should match pattern"}])
    gpa_in = body.get("gpa")
    gpa = None
    if gpa_in is not None:
        if not isinstance(gpa_in, dict):
            raise Invalid(422, [{"loc": ["body", "gpa"], "msg": "Input should be a valid object"}])
        value, scale = _num(gpa_in.get("value"), "gpa.value"), _num(gpa_in.get("scale_max"), "gpa.scale_max")
        if value < 0 or not 0 < scale <= 1000:
            raise Invalid(422, [{"loc": ["body", "gpa"], "msg": "Input out of range"}])
        gpa = {"value": value, "scale_max": scale}
    langs_in = body.get("languages") or []
    if not isinstance(langs_in, list) or len(langs_in) > 6:
        raise Invalid(422, [{"loc": ["body", "languages"], "msg": "List should have at most 6 items"}])
    languages = []
    for x in langs_in:
        if not isinstance(x, dict) or not isinstance(x.get("test"), str) or len(x["test"]) > 24 or x["test"] not in fit.TESTS:
            raise Invalid(422, [{"loc": ["body", "languages", "test"], "msg": "Value error, unknown test"}])
        languages.append({"test": x["test"], "score": _num(x.get("score"), "languages.score")})
    sort = body.get("sort", "recommended")
    if sort not in SORTS:
        raise Invalid(422, [{"loc": ["body", "sort"], "msg": "String should match pattern"}])
    tier = body.get("tier")
    if tier is not None and tier not in TIERS:
        raise Invalid(422, [{"loc": ["body", "tier"], "msg": "String should match pattern"}])
    region = body.get("region")
    if region is not None and (not isinstance(region, str) or len(region) > 32):
        raise Invalid(422, [{"loc": ["body", "region"], "msg": "String should have at most 32 characters"}])
    return {"level": level, "gpa": gpa, "languages": languages, "sort": sort, "tier": tier, "region": region,
            "offset": _int(body.get("offset"), "offset", 0, 1000, 0), "limit": _int(body.get("limit"), "limit", 1, 48, 12)}


def quick_fit(body) -> dict:
    """= `server/app/api/v1/public.py::quick_fit`, minus the analytics event."""
    b = validate(body)
    for x in b["languages"]:
        d = fit.TESTS[x["test"]]
        if not (d["min"] <= x["score"] <= d["max"]):
            raise Invalid(422, {"code": "SCORE_OUT_OF_RANGE", "test": x["test"], "min": d["min"], "max": d["max"]})
    gpa = None
    if b["gpa"] is not None:
        gpa = fit.normalise_gpa(b["gpa"]["value"], b["gpa"]["scale_max"])
        if gpa is None:
            raise Invalid(422, {"code": "GPA_OUT_OF_RANGE", "max": b["gpa"]["scale_max"]})
    _prime()
    return fit.run(None, level=b["level"], languages=b["languages"], gpa=gpa, sort=b["sort"], tier=b["tier"],
                   region=b["region"], offset=b["offset"], limit=b["limit"])


ADMISSIONS_DIR = SNAPSHOT_PATH.parent / "admissions"


def admissions(q: dict[str, list[str]]) -> dict:
    """= `server/app/directory.py::institution_admissions`: the exported record (the endpoint's own output without
    answers) with `summary` computed by the engine when the visitor's quick-fit answers are given."""
    slug = (q.get("admissions") or [""])[0]
    inst = BY_SLUG.get(slug)
    path = ADMISSIONS_DIR / f"{slug}.json"
    if inst is None or not path.is_file():
        raise Invalid(404, "Not found")
    out = json.loads(path.read_text(encoding="utf-8"))
    level = (q.get("level") or [None])[0]
    if level is None:
        return out
    if level not in ADMISSION_LEVELS:
        raise Invalid(422, [{"loc": ["query", "level"], "msg": "String should match pattern"}])
    scores: dict[str, float] = {}
    for part in ((q.get("langs") or [""])[0])[:200].split(","):
        code, _, raw = part.partition(":")
        if code in fit.TESTS:
            try:
                scores[code] = float(raw)
            except ValueError:
                pass
    gpa_pct = None
    if q.get("gpa_pct"):
        try:
            gpa_pct = float(q["gpa_pct"][0])
        except ValueError:
            raise Invalid(422, [{"loc": ["query", "gpa_pct"], "msg": "Input should be a valid number"}]) from None
        if not 0 <= gpa_pct <= 100:
            raise Invalid(422, [{"loc": ["query", "gpa_pct"], "msg": "Input should be between 0 and 100"}])
    out["summary"] = fit._scholarship_fit(inst, level, scores, gpa_pct)
    return out


#: `institution_admissions`'s own `level` pattern.
ADMISSION_LEVELS = {"LANGUAGE", "ASSOCIATE", "BACHELOR", "TRANSFER", "MASTER", "DOCTORATE", "COMBINED"}


# ------------------------------------------------------------------------------------------- rate limit (= public.py)
RATE_WINDOW, FIT_RATE_LIMIT = 60.0, 90
_hits: dict[str, deque] = defaultdict(deque)


def _limited(ip: str) -> bool:
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= FIT_RATE_LIMIT:
        return True
    q.append(now)
    return False


class handler(BaseHTTPRequestHandler):  # noqa: N801 — the name the Vercel Python runtime looks for
    def _send(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _ip(self) -> str:
        return (self.headers.get("x-forwarded-for") or self.client_address[0] or "unknown").split(",")[0].strip()

    def do_POST(self) -> None:  # noqa: N802
        if _limited(self._ip()):
            return self._send(429, {"detail": {"code": "FIT_RATE_LIMITED", "retry_after": int(RATE_WINDOW)}})
        try:
            n = int(self.headers.get("content-length") or 0)
            if n > 16_384:
                raise Invalid(413, "Request body too large")
            try:
                body = json.loads(self.rfile.read(n) or b"null")
            except ValueError:
                raise Invalid(422, [{"loc": ["body"], "msg": "JSON decode error"}]) from None
            self._send(200, quick_fit(body))
        except Invalid as e:
            self._send(e.status, {"detail": e.detail})

    def do_GET(self) -> None:  # noqa: N802
        try:
            self._send(200, admissions(parse_qs(urlparse(self.path).query)))
        except Invalid as e:
            self._send(e.status, {"detail": e.detail})

    def log_message(self, *_args) -> None:  # keep request lines (which carry no personal data) out of function logs
        return


if os.environ.get("PUBLIC_FIT_SELFTEST"):
    print(json.dumps({"institutions": len(BY_SLUG), "engine": fit.ENGINE}))
