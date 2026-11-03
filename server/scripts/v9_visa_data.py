"""V9: load the 2026-10-10 re-validated visa playbooks into the live dev DB as NEW route versions (history kept).

* Idempotent: unchanged routes are skipped (content hash); a second run reports ``created=0 updated=0``.
* Time-versioned rules are applied only on/after their ``effective_from`` (re-run this script on/after 2027-01-01 to
  bring Kyrgyzstan's KICB rule in force as a new version). ``--as-of YYYY-MM-DD`` is for checking only (with --dry-run).
* Arrival facts are read from docs/research/arrival-official.json / post-arrival-official.json at request time, so this
  script only verifies them.

Usage (from server/):  flock /tmp/claude-0/hg-migrate.lock .venv/bin/python scripts/v9_visa_data.py [--dry-run] [--as-of 2027-01-01]
"""
from __future__ import annotations

import argparse
import sys
from datetime import date

from sqlalchemy import func, select

sys.path.insert(0, ".")

from app.core.db import SessionLocal  # noqa: E402
from app.models.v5_visa_routes import VisaRoute  # noqa: E402
from app.seed.extra_95_visa_data import load  # noqa: E402
from app.services import concierge  # noqa: E402
from app.services import visa_routes as vr  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--as-of", type=date.fromisoformat, default=None)
    a = ap.parse_args()
    if a.as_of and not a.dry_run:
        raise SystemExit("--as-of is only allowed with --dry-run (never apply a future rule to the live DB)")
    with SessionLocal() as db:
        res = load(db, a.as_of or date.today())
        print("load:", res)
        rows = db.execute(select(VisaRoute.country, func.count(), func.max(VisaRoute.version)).group_by(VisaRoute.country).order_by(VisaRoute.country)).all()
        print("versions per country:", ", ".join(f"{c}:{n} rows/v{v}" for c, n, v in rows))
        cur = list(db.scalars(select(VisaRoute).where(VisaRoute.is_current.is_(True))).all())
        status: dict[str, int] = {}
        for r in cur:
            status[r.verification_status] = status.get(r.verification_status, 0) + 1
        print("current routes:", len(cur), status)
        bd = next(r for r in cur if r.country == "BD" and r.visa_type == "D-2-2")
        print("BD posts:", [(p["kind"], p["name_en"]) for p in vr.posts_of(bd)], "| method:", vr.post_method(bd, None))
        mm = next(r for r in cur if r.country == "MM" and r.visa_type == "D-2-2")
        print("MM NRC:", [d.name for d in vr.route_documents(db, mm) if d.key == "other_nrc"])
        kg = next(r for r in cur if r.country == "KG" and r.visa_type == "D-2")
        print("KG amount:", (kg.financial or {}).get("amount"))
        addr = concierge.official_facts(db, "address_report")
        print("address report:", addr["topic"], "15 days" in (addr["summary"] or ""), addr["status"])
        if a.dry_run:
            db.rollback()
            print("dry run — rolled back")
        else:
            db.commit()
            print("committed")


if __name__ == "__main__":
    main()
