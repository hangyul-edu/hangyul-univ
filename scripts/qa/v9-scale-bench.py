"""V9 scale benchmark: p50/p95 over N sequential calls per endpoint against the isolated scale API.

  HG_SCALE_API=http://127.0.0.1:8091 server/.venv/bin/python scripts/qa/v9-scale-bench.py [N] [out.json]

Never point this at the dev API (:8001): it only reads, but the numbers are meant for the scale database
(hangyul_univ_scale, seeded by server/scripts/v9_scale_seed.py).
"""
import json
import statistics
import sys
import time
import urllib.error
import urllib.request

API = __import__("os").environ.get("HG_SCALE_API", "http://127.0.0.1:8091") + "/api/v1"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 20
OUT = sys.argv[2] if len(sys.argv) > 2 else None
PW = "Hangyul!2026"


def call(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            status = r.status
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read()[:400]!r}") from e
    return (time.perf_counter() - t0) * 1000, status, raw


def login(email, client):
    _, _, raw = call("POST", "/auth/login", body={"email": email, "password": PW, "client": client})
    return json.loads(raw)["access_token"]


def pct(xs, p):
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    return xs[f] if f == len(xs) - 1 else xs[f] + (xs[f + 1] - xs[f]) * (k - f)


def main():
    counselor = login("counselor@lotus.demo.hangyul.kr", "agency")
    manager = login("manager@lotus.demo.hangyul.kr", "agency")
    pnu = login("admin@pusan.univ.demo.hangyul.kr", "university")
    hq = login("ops@demo.hangyul.kr", "agency")
    _, _, raw = call("GET", "/applications?page=1&page_size=20&sort=submitted", pnu)
    first = json.loads(raw)
    app_id = first["items"][0]["id"]
    cases = [
        ("agency: today queue (counselor)", counselor, "GET", "/agency/today/queue", None),
        ("agency: students default", counselor, "GET", "/agency/students?page=1&page_size=20", None),
        ("agency: students view=mine", counselor, "GET", "/agency/students?page=1&page_size=20&view=mine", None),
        ("agency: students view=urgent", counselor, "GET", "/agency/students?page=1&page_size=20&view=urgent", None),
        ("agency: students view=docs sort=deadline", counselor, "GET", "/agency/students?page=1&page_size=20&view=docs&sort=deadline", None),
        ("agency: students view counts", counselor, "GET", "/agency/students/views", None),
        ("agency: ops (manager)", manager, "GET", "/agency/ops", None),
        ("university: applicants default", pnu, "GET", "/applications?page=1&page_size=20&sort=submitted", None),
        ("university: applicants filtered", pnu, "GET", "/applications?page=1&page_size=20&sort=submitted&status=UNIVERSITY_REVIEW&nationality=VN&intake=2027-SPRING", None),
        ("university: analytics/questions", pnu, "GET", "/university/analytics/questions", None),
        # BULK_FILTER_CAP = 1000: "all 1,011" is refused by design (422, narrow first); the widest allowed set is measured, plus the refusal.
        ("university: bulk-filter preview (967 of 1,011)", pnu, "POST", "/university/bulk-filter/export/preview",
         {"filters": {"status": ["SUBMITTED", "UNIVERSITY_REVIEW", "ADDITIONAL_DOCUMENTS", "INTERVIEW", "OFFERED", "WAITLISTED", "REJECTED", "OFFER_ACCEPTED"]}}),
        ("university: applicant detail", pnu, "GET", f"/applications/{app_id}", None),
        ("hq: overview", hq, "GET", "/agency/hq/overview", None),
    ]
    results = []
    for name, tok, method, path, body in cases:
        _, status, raw = call(method, path, tok, body)  # warm-up (not counted)
        size = len(raw)
        try:
            j = json.loads(raw)
            total = j.get("total") if isinstance(j, dict) else len(j)
        except Exception:
            total = None
        times = [call(method, path, tok, body)[0] for _ in range(N)]
        row = {"endpoint": name, "path": path, "status": status, "n": N, "p50_ms": round(pct(times, 0.5), 1), "p95_ms": round(pct(times, 0.95), 1),
               "max_ms": round(max(times), 1), "mean_ms": round(statistics.mean(times), 1), "bytes": size, "total": total}
        results.append(row)
        print(f"{name:45s} {status} p50 {row['p50_ms']:8.1f}  p95 {row['p95_ms']:8.1f}  total={total}", flush=True)
    meta = {"api": API, "n": N, "applicants_total": first.get("total"), "measured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    if OUT:
        with open(OUT, "w") as f:
            json.dump({"meta": meta, "results": results}, f, indent=2)


if __name__ == "__main__":
    main()
