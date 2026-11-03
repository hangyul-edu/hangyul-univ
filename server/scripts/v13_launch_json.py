"""V13 — emit the launch-dependency list as JSON for `npm run release:check`.

`hq_ops.launch_items` is the one place that classifies every launch dependency from real settings and real
records, and the HQ console reads it over HTTP behind Hangyul-staff auth. The release gate needs the same
facts without a running server or a session, so it reads them straight from the database.

    server/.venv/bin/python -m scripts.v13_launch_json
"""
import json
import sys

from app.api.v1.hq_ops import launch_items
from app.core.config import get_settings
from app.core.db import SessionLocal


def main() -> int:
    db = SessionLocal()
    try:
        items = launch_items(db)
    finally:
        db.close()
    json.dump({"environment": get_settings().env, "items": items}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
