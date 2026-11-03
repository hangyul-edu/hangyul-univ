"""V29 — publish the service catalogue, and (only when explicitly approved) move existing engagements onto it.

    python -m scripts.v29_migrate_contracts                     publish: service_products ← shared/plans.json (prices + entitlements)
    python -m scripts.v29_migrate_contracts --migrate-demo      … and move DEMO/test engagements to the current catalogue
    python -m scripts.v29_migrate_contracts --dry-run [...]     print what would change, write nothing

What it never does: change a historical order's ``plan_snapshot`` or ``amount_minor`` (a receipt is what was sold), or
touch a real customer's engagement. ``--migrate-demo`` only moves engagements whose user is a seeded demo/test account
(``users.is_demo`` or an ``@demo.hangyul.kr`` / ``@example.com`` address) and refuses outside development/test unless
``--i-have-owner-approval`` is also given (a real migration is an owner decision, REPORT §390). Each moved engagement
records ``migrated_from_version`` and an audit row.
"""
from __future__ import annotations

import argparse
import sys

from sqlalchemy import select

from app.core.audit import audit
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import ServiceEngagement, ServicePrice, ServiceProduct, User
from app.models.base import utcnow
from app.services import entitlements as ent_svc


def _is_test_user(u: User | None) -> bool:
    if u is None:
        return False
    return bool(getattr(u, "is_demo", False)) or (u.email or "").endswith(("@demo.hangyul.kr", "@example.com"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--migrate-demo", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--i-have-owner-approval", action="store_true")
    a = ap.parse_args(argv)
    env = get_settings().env
    if a.migrate_demo and env not in ("development", "test") and not a.i_have_owner_approval:
        print(f"refused: --migrate-demo in {env} needs --i-have-owner-approval (an owner decision)", file=sys.stderr)
        return 2
    version = ent_svc.catalog_version()
    with SessionLocal() as db:
        published = 0
        for plan in ent_svc.plan_defs():
            prod = db.scalar(select(ServiceProduct).where(ServiceProduct.code == plan["code"]))
            if prod is None:
                print(f"  ! {plan['code']} missing from service_products — run the seed")
                continue
            if prod.entitlements != plan["entitlements"] or prod.name_ko != plan["name_ko"] or prod.sort_order != plan["sort_order"]:
                published += 1
                prod.entitlements, prod.name_ko, prod.name_en = dict(plan["entitlements"]), plan["name_ko"], plan["name_en"]
                prod.is_recommended, prod.sort_order, prod.features = bool(plan["recommended"]), plan["sort_order"], []
            price = db.scalar(select(ServicePrice).where(ServicePrice.product_id == prod.id, ServicePrice.country_code.is_(None)))
            if price is not None and (price.amount_minor, price.currency) != (plan["amount_minor"], plan["currency"]):
                price.amount_minor, price.currency = plan["amount_minor"], plan["currency"]
                published += 1
        print(f"catalogue {version}: {published} product/price row(s) updated")
        moved = skipped = 0
        if a.migrate_demo:
            for eng in db.scalars(select(ServiceEngagement).where(ServiceEngagement.status == "ACTIVE",
                                                                  ServiceEngagement.catalog_version != version)):
                if not _is_test_user(db.get(User, eng.user_id)):
                    skipped += 1
                    continue
                plan = ent_svc.plan_def(eng.product_code)
                if plan is None:
                    continue
                old = eng.catalog_version
                eng.migrated_from_version, eng.catalog_version = old, version
                eng.entitlements = dict(plan["entitlements"])
                eng.plan_snapshot = {**(eng.plan_snapshot or {}), "catalog_version": version, "entitlements": dict(plan["entitlements"]),
                                     "cells": plan.get("cells"), "migrated_from_version": old, "migrated_at": utcnow().isoformat()}
                ent_svc.recompute_dates(eng)
                audit(db, action="contract.migrated", entity_type="service_engagement", entity_id=eng.id, subject_user_id=eng.user_id,
                      detail={"from": old, "to": version, "scope": "DEMO_TEST_DATA"})
                moved += 1
            print(f"engagements moved to {version}: {moved} (demo/test) · left on their purchased contract: {skipped} (real customers)")
        if a.dry_run:
            db.rollback()
            print("dry run — nothing written")
        else:
            db.commit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
