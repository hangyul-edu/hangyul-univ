"""V15 — bring an existing **scale** database onto the new plan model.

The scale database was seeded under V14's commercial model and holds the retired packages. Re-seeding it
from scratch would take the better part of an hour and lose the caseload the V13 measurements were taken
against, so this converts it in place: it writes the three retail plans from ``shared/plans.json``, repoints
every paid order at the plan that matches the work on that case, and deletes the retired products.

Refuses any database whose name does not contain "scale", exactly as ``v9_scale_seed.py`` does. This must
never run against the development stack.

    HG_DATABASE_URL=…/hangyul_univ_scale server/.venv/bin/python scripts/v15_scale_plans.py
"""
import os
import random
import sys

from sqlalchemy import func, select

DB_URL = os.environ.get("HG_DATABASE_URL", "")
if "scale" not in DB_URL.rsplit("/", 1)[-1]:
    sys.exit("refusing: HG_DATABASE_URL must point at a scale database (name containing 'scale'), never the dev DB")

from app.core.db import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AddOnStatus,
    Application,
    Essay,
    EssayReview,
    Order,
    OrderStatus,
    SavedUniversity,
    ServiceAddOn,
    ServicePrice,
    ServiceProduct,
)
from app.models.base import utcnow  # noqa: E402
from app.services import entitlements as ent  # noqa: E402

rng = random.Random(20261019)
RETIRED = ("FREE_EXPLORER", "APPLICATION_SUPPORT", "PREMIUM_SUCCESS")


def plan_for(products, apps, roll):
    if apps == 0:
        return products["BASIC"] if roll < 0.75 else products["ALL_IN_ONE"]
    if apps <= 2:
        return products["ALL_IN_ONE"] if roll < 0.78 else products["PREMIUM"]
    return products["PREMIUM"]


def main():
    with SessionLocal() as db:
        have = {p.code: p for p in db.scalars(select(ServiceProduct))}
        for plan in ent.plan_defs():
            p = have.get(plan["code"])
            if p is None:
                p = ServiceProduct(code=plan["code"], name_key=f"services.{plan['code']}.name", name_en=plan["name_en"],
                                   name_ko=plan["name_ko"], features=list(plan["features"]), sort_order=plan["sort_order"])
                db.add(p)
                db.flush()
            p.entitlements = dict(plan["entitlements"])
            p.is_recommended = bool(plan["recommended"])
            p.is_active = True
            for pr in db.scalars(select(ServicePrice).where(ServicePrice.product_id == p.id)):
                db.delete(pr)
            db.flush()
            db.add(ServicePrice(product_id=p.id, currency=plan["currency"], amount_minor=plan["amount_minor"],
                                country_code=None, is_demo=False))
            have[plan["code"]] = p
        db.flush()
        # Read the prices back rather than through the relationship: the rows above were added in this
        # session and `p.prices` is still the pre-flush collection, which is how the first run of this
        # script managed to write an order pointing at a price that did not exist yet.
        price_of = {pid: pr for pid, pr in
                    ((pr.product_id, pr) for pr in db.scalars(select(ServicePrice).where(ServicePrice.country_code.is_(None))))}

        app_counts = dict(db.execute(
            select(Application.student_user_id, func.count())
            .where(Application.status != "DRAFT").group_by(Application.student_user_id)
        ).all())
        round_counts = dict(db.execute(
            select(Essay.owner_user_id, func.max(EssayReview.review_round))
            .join(EssayReview, EssayReview.essay_id == Essay.id).group_by(Essay.owner_user_id)
        ).all())

        # Every assigned student needs a plan, or the console's scope behaviour is untested at scale: the
        # scale seed predates V15 and bought a package for only a fraction of the caseload.
        from app.models import AgencyAssignment, AssignmentStatus, Payment

        assigned = set(db.scalars(select(AgencyAssignment.student_user_id)
                                  .where(AgencyAssignment.status == AssignmentStatus.ACTIVE)).all())
        has_order = set(db.scalars(select(Order.user_id).where(Order.status == OrderStatus.PAID)).all())
        created = 0
        for uid in sorted(assigned - has_order, key=str):
            apps = int(app_counts.get(uid, 0) or 0)
            chosen = plan_for(have, apps, rng.random())
            price = price_of[chosen.id]
            o = Order(user_id=uid, product_id=chosen.id, price_id=price.id, currency=price.currency,
                      amount_minor=price.amount_minor, status=OrderStatus.PAID, paid_at=utcnow())
            db.add(o)
            db.flush()
            db.add(Payment(order_id=o.id, provider="demo", provider_ref=f"scale_{o.id.hex[:12]}", status="PAID",
                           amount_minor=price.amount_minor, currency=price.currency, raw={"demo": True}))
            created += 1
        db.flush()

        moved = over = addon = 0
        for o in db.scalars(select(Order).where(Order.status == OrderStatus.PAID)):
            apps = int(app_counts.get(o.user_id, 0) or 0)
            rounds = int(round_counts.get(o.user_id, 0) or 0)
            chosen = plan_for(have, apps, rng.random())
            price = price_of[chosen.id]
            if o.product_id != chosen.id:
                o.product_id = chosen.id
                moved += 1
            if price is not None:
                o.price_id, o.currency, o.amount_minor = price.id, price.currency, price.amount_minor

            cap = (chosen.entitlements or {}).get("essay_review_rounds", 0)
            allowed = 10**6 if cap is None else int(cap)  # V29: Premium editing is not rationed within its contract
            if rounds > allowed:
                if rng.random() < 0.84:
                    for r in db.scalars(select(EssayReview).join(Essay, Essay.id == EssayReview.essay_id)
                                        .where(Essay.owner_user_id == o.user_id, EssayReview.review_round > allowed)):
                        r.review_round = max(1, allowed)
                elif rng.random() < 0.5:
                    # V29: an extra exists only as a priced offer (inside the catalogue range); scale data never grants one unpaid.
                    db.add(ServiceAddOn(user_id=o.user_id, code="EXTRA_ESSAY_ROUND",
                                        entitlement_key="essay_review_rounds", quantity=rounds - allowed,
                                        status=AddOnStatus.OFFERED, unit_amount_minor=2_000, amount_minor=2_000 * (rounds - allowed),
                                        currency="USD"))
                    addon += 1
                else:
                    over += 1

        # Staff recommendations, so 추천 대학 has something to count at scale.
        rows = db.scalars(select(SavedUniversity)).all()
        by_user: dict = {}
        for s in rows:
            by_user.setdefault(s.user_id, []).append(s)
        plan_by_user = {o.user_id: db.get(ServiceProduct, o.product_id)
                        for o in db.scalars(select(Order).where(Order.status == OrderStatus.PAID))}
        for uid, saved in by_user.items():
            plan = plan_by_user.get(uid)
            if plan is None:
                continue
            cap = int((plan.entitlements or {}).get("max_recommended_institutions") or 0)
            for s in saved[: max(0, cap - rng.choice([0, 0, 1, 2]))]:
                s.source = "HANGYUL"

        db.flush()
        # V29: one engagement per paid plan, frozen from the current catalogue (the scale DB is synthetic).
        from app.services import entitlements as ent_svc

        for o in db.scalars(select(Order).where(Order.status == OrderStatus.PAID, Order.kind != "ADD_ON").order_by(Order.paid_at)):
            prod = db.get(ServiceProduct, o.product_id)
            plan = ent_svc.plan_def(prod.code)
            if plan is not None:
                o.catalog_version = ent_svc.catalog_version()
                o.plan_snapshot = ent_svc.snapshot(plan, amount_minor=o.amount_minor, currency=o.currency)
                ent_svc.start_engagement(db, o, prod)
        db.flush()
        for code in RETIRED:
            p = have.pop(code, None) or db.scalar(select(ServiceProduct).where(ServiceProduct.code == code))
            if p is None:
                continue
            still = db.scalar(select(func.count()).select_from(Order).where(Order.product_id == p.id)) or 0  # after flush
            if still:
                print(f"  ! {code} still has {still} order(s) — deactivating rather than deleting")
                p.is_active = False
            else:
                for pr in list(p.prices):
                    db.delete(pr)
                db.delete(p)
        db.commit()
        print(f"scale plans: {created} order(s) created · {moved} repointed · {addon} covered by an add-on · "
              f"{over} over with nothing")


if __name__ == "__main__":
    main()
