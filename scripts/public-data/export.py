"""Export the public Marketing discovery data to static files (P0 hotfix, 2026-11-03).

    source of truth (server/app/data/korean_institutions.json, enrichment, research/…)
      → `npm run db:seed` (the canonical Postgres the API reads)
      → this script: the API's **own endpoints**, called in-process, so every file is byte-for-byte the shape the
        FastAPI service returns — no second serializer, no hand-copied rows
      → apps/marketing-web/public/data/public/…  (served by the CDN; the marketing app reads it, no API needed)

Usage (repo root, local DB seeded):
    server/.venv/bin/python scripts/public-data/export.py          # write
    server/.venv/bin/python scripts/public-data/export.py --check  # exit 1 if the committed files differ

Only public, anonymous endpoints are exported — the same data an anonymous visitor already receives from
`/api/v1/directory/*`, `/api/v1/meta/countries`. Nothing account-, tenant- or payment-related.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server"))
os.chdir(ROOT / "server")  # the API's settings (.env) resolve relative to server/

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

OUT = ROOT / "apps" / "marketing-web" / "public" / "data" / "public"
SCHEMA = 1


def dump(obj) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def get(client: TestClient, path: str, **params):
    r = client.get(f"/api/v1{path}", params=params)
    if r.status_code != 200:
        raise SystemExit(f"export: GET {path} {params} -> {r.status_code} {r.text[:200]}")
    return r.json()


def all_cards(client: TestClient, order: str) -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        res = get(client, "/directory/institutions", order=order, page=page, page_size=200)
        items += res["items"]
        if len(items) >= res["total"]:
            return items
        page += 1


def fit_snapshot() -> dict:
    """The Quick Fit engine's own snapshot (`app.services.fit.snapshot`), serialised for the serverless function in
    apps/marketing-web/api/public-fit.py, which runs the same engine over it. Every value in it is already public:
    the cards, verified language rules and current scholarships the directory and detail pages show."""
    from dataclasses import asdict

    from app.core.db import SessionLocal
    from app.services import fit

    fit.invalidate()
    with SessionLocal() as db:
        snap = fit.snapshot(db)
    insts = []
    for inst in sorted(snap["insts"].values(), key=lambda i: i.slug):
        d = asdict(inst)
        d["id"] = str(d["id"])
        d["rules"] = {k: d["rules"][k] for k in sorted(d["rules"])}
        insts.append(d)
    return {"engine": fit.ENGINE, "insts": insts, "featured": snap["featured"]}


def build(target: Path) -> dict:
    files: dict[str, bytes] = {}
    with TestClient(app) as client:
        regions = get(client, "/directory/regions")
        cards_ko = all_cards(client, "ko")
        cards_en = all_cards(client, "en")
        slugs = [c["slug"] for c in cards_ko]
        assert sorted(slugs) == sorted(c["slug"] for c in cards_en), "ko/en orders disagree on the institution set"
        assert regions["total"] == len(cards_ko), f"regions total {regions['total']} != {len(cards_ko)} cards"
        files["regions.json"] = dump(regions)
        # One card list (in the API's default Korean order) + the English order as positions into it.
        pos = {s: n for n, s in enumerate(slugs)}
        files["institutions.json"] = dump({"items": cards_ko, "order_en": [pos[c["slug"]] for c in cards_en]})
        for s in slugs:
            files[f"institutions/{s}.json"] = dump(get(client, f"/directory/institutions/{s}"))
            files[f"admissions/{s}.json"] = dump(get(client, f"/directory/institutions/{s}/admissions"))
        files["countries.json"] = dump(get(client, "/meta/countries", priority_only="true"))
    files["fit-snapshot.json"] = dump(fit_snapshot())
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode() + b"\0" + files[name])
    manifest = {"schema": SCHEMA, "version": digest.hexdigest()[:16], "institutions": len(slugs),
                "source": "scripts/public-data/export.py (FastAPI public endpoints over the seeded canonical DB)"}
    files["manifest.json"] = dump(manifest)
    for name, body in files.items():
        p = target / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(body)
    return manifest


def tree(d: Path) -> dict[str, bytes]:
    return {str(p.relative_to(d)): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()} if d.exists() else {}


if __name__ == "__main__":
    if "--check" in sys.argv:
        with tempfile.TemporaryDirectory() as tmp:
            m = build(Path(tmp))
            if tree(Path(tmp)) != tree(OUT):
                print(f"public data is stale — run scripts/public-data/export.py (fresh version {m['version']})")
                sys.exit(1)
        print(f"public data up to date ({m['institutions']} institutions, version {m['version']})")
    else:
        if OUT.exists():
            shutil.rmtree(OUT)
        m = build(OUT)
        print(f"wrote {OUT.relative_to(ROOT)}: {m['institutions']} institutions, version {m['version']}")
