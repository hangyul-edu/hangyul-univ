"""TEST / E2E DATABASES ONLY — mark a fixture student's order paid through the real activation path.

    cd server && .venv/bin/python -m scripts.fixture_pay --email <student> --product ALL_IN_ONE
    cd server && .venv/bin/python -m scripts.fixture_pay --order <order-id>

The E2E suite calls this (scripts/qa/e2e-run.mjs exports HG_E2E_DB_URL) where it used to call the dev-complete endpoint
that V32 removed from the product. Refuses any database whose name lacks "test"/"e2e".
"""
from __future__ import annotations

import argparse
import uuid


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email")
    ap.add_argument("--product")
    ap.add_argument("--order")
    a = ap.parse_args()
    from sqlalchemy import select

    from app.core.db import SessionLocal
    from app.models import Order, User
    from app.seed.fixtures import grant_plan, guard, pay_order

    guard()
    with SessionLocal() as db:
        if a.order:
            order = db.get(Order, uuid.UUID(a.order))
            if order is None:
                raise SystemExit("order not found")
            pay_order(db, order)
        elif a.email and a.product:
            user = db.scalar(select(User).where(User.email == a.email.lower()))
            if user is None:
                raise SystemExit("user not found")
            grant_plan(db, user, a.product)
        else:
            raise SystemExit("give --order <id> or --email <student> --product <code>")
        db.commit()
        print("ok")


if __name__ == "__main__":
    main()
