"""Snapshot the public Marketing catalogue from the database (P0 hotfix 2026-11-03; DB-first since 2026-11-19).

    the canonical Postgres the API reads (seeded, then refreshed by the weekly catalogue ingestion)
      → this script: the API's **own endpoints**, called in-process, so every file is byte-for-byte the shape the
        FastAPI service returns — no second serializer, no hand-copied rows
      → apps/marketing-web/public/data/public/…

The Marketing site reads the catalogue LIVE from the same endpoints (`/api/v1/directory/*`); this snapshot is only
(1) the input of the build's prerendered SEO metadata and (2) the pages' fallback when the API is unreachable.
`scripts/seo/prerender-meta.mjs` can take the same snapshot over HTTP from the deployed API at build time
(`PUBLIC_DATA_SOURCE=api`). `manifest.json` records the snapshot's origin and when it was taken.

Usage (repo root, local DB seeded):
    server/.venv/bin/python scripts/public-data/export.py          # write
    server/.venv/bin/python scripts/public-data/export.py --check  # exit 1 if the committed files differ

Only public, anonymous endpoints are exported — the same data an anonymous visitor already receives from
`/api/v1/directory/*`. Nothing account-, tenant- or payment-related.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "server"))
os.chdir(ROOT / "server")  # the API's settings (.env) resolve relative to server/
# A read-only snapshot: the in-process API must not start the catalogue bootstrap or the weekly-refresh scheduler.
os.environ.setdefault("HG_CATALOG_BOOTSTRAP_ON_START", "0")
os.environ.setdefault("HG_CATALOG_SCHEDULER_ENABLED", "0")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

OUT = ROOT / "apps" / "marketing-web" / "public" / "data" / "public"
SCHEMA = 2


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
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode() + b"\0" + files[name])
    verified = sorted(c["last_verified"] for c in cards_ko if c.get("last_verified"))
    manifest = {"schema": SCHEMA, "version": digest.hexdigest()[:16], "institutions": len(slugs),
                "origin": "database", "via": "scripts/public-data/export.py (in-process FastAPI public endpoints)",
                "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "data_as_of": verified[-1] if verified else None}
    files["manifest.json"] = dump(manifest)
    for name, body in files.items():
        p = target / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(body)
    return manifest


def tree(d: Path) -> dict[str, bytes]:
    """Every file, with the manifest's `generated_at` / `via` removed: when and how a snapshot was taken is not its content."""
    out = {str(p.relative_to(d)): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()} if d.exists() else {}
    if "manifest.json" in out:
        m = json.loads(out["manifest.json"])
        m.pop("generated_at", None)
        m.pop("via", None)
        out["manifest.json"] = dump(m)
    return out


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
